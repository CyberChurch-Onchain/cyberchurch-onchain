const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  SecretManagerServiceClient,
} = require('@google-cloud/secret-manager');
const { jwtVerify, importSPKI } = require('jose');

initializeApp();

const db = getFirestore();
const secretsClient = new SecretManagerServiceClient();
const streamTickets = new Map();

const STREAM_TICKET_TTL_MS = 5 * 60 * 1000;
const app = express();

const port = Number(process.env.PORT || 8080);
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'bold-ally-485107-b8';

const jwtSecretName =
  process.env.JWT_SECRET_NAME || 'jwt-rs256-public-key';

const jwtIssuer =
  process.env.JWT_ISSUER ||
  'https://auth.cyberchurchonchain.org/';

const jwtAudience =
  process.env.JWT_AUDIENCE || 'cyberchurch-api';

const allowedOrigins = [
  'https://staging.cyberchurchonchain.org',
  'https://bold-ally-485107-b8.web.app',
  'http://localhost:3000',
];

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

let publicKeyPromise = null;

async function loadJwtPublicKey() {
  if (!publicKeyPromise) {
    const name =
      `projects/${projectId}/secrets/${jwtSecretName}/versions/latest`;

    publicKeyPromise = secretsClient
      .accessSecretVersion({ name })
      .then(async ([response]) => {
        const data = response?.payload?.data;

        if (!data) {
          throw new Error(
            'Secret Manager returned an empty JWT public key'
          );
        }

        const pem = data.toString('utf8').trim();

        if (!pem.includes('BEGIN PUBLIC KEY')) {
          throw new Error(
            'JWT secret is not a valid PEM public key'
          );
        }

        return importSPKI(pem, 'RS256');
      })
      .catch((error) => {
        publicKeyPromise = null;
        throw error;
      });
  }

  return publicKeyPromise;
}

function getRequestToken(req, allowQueryToken = false) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (match && match[1].trim()) {
    return match[1].trim();
  }

  if (
    allowQueryToken &&
    typeof req.query.token === 'string' &&
    req.query.token.trim()
  ) {
    return req.query.token.trim();
  }

  return null;
}

async function verifyRequestToken(
  req,
  res,
  next,
  allowQueryToken = false
) {
  try {
    const token = getRequestToken(req, allowQueryToken);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing token',
      });
    }

    const result = await jwtVerify(
      token,
      await loadJwtPublicKey(),
      {
        algorithms: ['RS256'],
        issuer: jwtIssuer,
        audience: jwtAudience,
      }
    );

    req.user = result.payload;
    return next();
  } catch (error) {
    console.error('JWT verification failed:', {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

function requireJwt(req, res, next) {
  return verifyRequestToken(req, res, next, false);
}

function requireStreamJwt(req, res, next) {
  return verifyRequestToken(req, res, next, true);
}

function consumeStreamTicket(ticket, sessionId, userId) {
  const ticketHash = crypto
    .createHash('sha256')
    .update(ticket)
    .digest('hex');

  const record = streamTickets.get(ticketHash);

  if (!record) {
    return null;
  }

  streamTickets.delete(ticketHash);

  if (record.expiresAt <= Date.now()) {
    return null;
  }

  if (record.sessionId !== sessionId) {
    return null;
  }

  if (record.userId !== userId) {
    return null;
  }

  return record;
}

async function authorizeStream(req, res, next) {
  const ticket =
    typeof req.query.ticket === 'string'
      ? req.query.ticket.trim()
      : '';

  if (!ticket) {
    return requireStreamJwt(req, res, next);
  }

  try {
    const sessionSnapshot = await db
      .collection('sessions')
      .doc(req.params.sessionId)
      .get();

    if (!sessionSnapshot.exists) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid stream ticket',
      });
    }

    const session = sessionSnapshot.data();

    const record = consumeStreamTicket(
      ticket,
      req.params.sessionId,
      session.userId
    );

    if (!record) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid, expired, or already-used stream ticket',
      });
    }

    req.user = { sub: record.userId };
    return next();
  } catch (error) {
    console.error(
      'Stream ticket validation failed:',
      error.message
    );

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid stream ticket',
    });
  }
}

app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'cyberchurch-api',
  });
});

app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'cyberchurch-api',
    version: 'v1',
  });
});

app.get(
  '/api/v1/sessions/:sessionId',
  requireJwt,
  async (req, res) => {
    try {
      const snapshot = await db
        .collection('sessions')
        .doc(req.params.sessionId)
        .get();

      if (!snapshot.exists) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Session not found',
        });
      }

      return res.status(200).json({
        id: snapshot.id,
        ...snapshot.data(),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'session_endpoint_failed',
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          stack: error.stack,
          sessionId: req.params.sessionId,
        })
      );

      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
);

const telemetryRequired = {
  user_checkin: ['metric', 'value', 'scale'],
  zone_enter: ['zoneId', 'zoneLabel', 'x', 'y', 'z'],
  zone_exit: ['zoneId', 'zoneLabel', 'x', 'y', 'z', 'dwellSeconds'],
  onboarding_milestone: [
    'interaction',
    'sessionId',
    'clientId',
    'userId',
    'milestone',
    'status',
  ]
};

function validateTelemetry(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return 'Request body must be an object';
  }

  if (
    !body.eventType ||
    !body.timestamp ||
    !body.payload
  ) {
    return 'eventType, timestamp and payload are required';
  }

  if (!telemetryRequired[body.eventType]) {
    return `Unsupported eventType: ${body.eventType}`;
  }

  if (
    typeof body.timestamp !== 'string' ||
    Number.isNaN(Date.parse(body.timestamp))
  ) {
    return 'timestamp must be a valid ISO date';
  }

  if (
    typeof body.payload !== 'object' ||
    Array.isArray(body.payload)
  ) {
    return 'payload must be an object';
  }

  if (body.eventType === 'onboarding_milestone') {
    for (const field of [
      'interaction',
      'sessionId',
      'clientId',
      'userId',
    ]) {
      if (
        body[field] === undefined ||
        body[field] === null ||
        body[field] === ''
      ) {
        return `${field} is required`;
      }
    }

    for (const field of ['milestone', 'status']) {
      if (
        body.payload[field] === undefined ||
        body.payload[field] === null ||
        body.payload[field] === ''
      ) {
        return `payload.${field} is required`;
      }
    }

    if (
      !['M1', 'M2', 'M3', 'M4']
        .includes(body.payload.milestone)
    ) {
      return 'payload.milestone must be one of M1, M2, M3, or M4';
    }

    if (
      !['Started', 'started', 'completed']
        .includes(body.payload.status)
    ) {
      return 'payload.status must be Started, started, or completed';
    }

    return null;
  }

  for (const field of telemetryRequired[body.eventType]) {
    if (
      body.payload[field] === undefined ||
      body.payload[field] === null
    ) {
      return `payload.${field} is required`;
    }
  }

  if (
    body.eventType === 'user_checkin' &&
    (
      typeof body.payload.value !== 'number' ||
      body.payload.value < 0 ||
      body.payload.value > 1
    )
  ) {
    return 'payload.value must be between 0 and 1';
  }

  if (
    body.eventType === 'zone_exit' &&
    (
      typeof body.payload.dwellSeconds !== 'number' ||
      body.payload.dwellSeconds < 0
    )
  ) {
    return 'payload.dwellSeconds must be non-negative';
  }

  return null;
}


app.post('/api/v1/telemetry',
  requireJwt,
  async (req, res) => {
    try {
      const validationError = validateTelemetry(req.body);

      if (validationError) {
         console.warn('Telemetry validation failed', {
         eventType: req.body?.eventType || null,
         message: validationError,
  });

  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: validationError,
  });
}
  const telemetryEvent = {
    ...req.body,
    authenticatedUserId: req.user?.sub || null,
    receivedAt: new Date().toISOString(),
  };

  const ref = await db
   .collection('telemetry')
   .add(telemetryEvent);

      return res.status(202).json({
        accepted: true,
        eventId: ref.id,
      });
    } catch (error) {
      console.error(
        'Telemetry endpoint failed:',
        error.message
      );

      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
);

function createMockCryptoMetadata(sessionId) {
  return {
    zkStatus: 'MOCKED',
    proofId: `mock-proof-${sessionId}-${Date.now()}`,
    poseidonHash: '0xmock-poseidon-hash',
    eddsaSignature: {
      r8: ['0x0', '0x0'],
      s: '0x0',
    },
    proof: {
      pi_a: ['0x0', '0x0', '1'],
      pi_b: [
        ['0x0', '0x0'],
        ['0x0', '0x0'],
        ['1', '0'],
      ],
      pi_c: ['0x0', '0x0', '1'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    isMock: true,
    artifactStatus: 'NOT_UPLOADED',
    generatedAt: new Date().toISOString(),
  };
}

app.get(
  '/api/v1/sessions/:sessionId/proof',
  requireJwt,
  (req, res) => {
    return res.status(200).json({
      sessionId: req.params.sessionId,
      cryptoMetadata: createMockCryptoMetadata(
        req.params.sessionId
      ),
    });
  }
);

function sendSse(req, res, sessionId) {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(
    `event: connected\ndata: ${JSON.stringify({
      sessionId,
      connected: true,
    })}\n\n`
  );

  const heartbeat = setInterval(() => {
    res.write(
      `event: heartbeat\ndata: ${JSON.stringify({
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    res.end();
  });
}

app.get(
  '/api/v1/sessions/:sessionId/events',
  authorizeStream,
  (req, res) => {
    return sendSse(req, res, req.params.sessionId);
  }
);

app.get(
  '/api/v1/sessions/:sessionId/stream',
  authorizeStream,
  (req, res) => {
    return sendSse(req, res, req.params.sessionId);
  }
);

app.post(
  '/api/v1/sessions/:sessionId/stream-ticket',
  requireJwt,
  async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.sub;

    try {
      const snapshot = await db
        .collection('sessions')
        .doc(sessionId)
        .get();

      if (!snapshot.exists) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          sessionId,
        });
      }

      const session = snapshot.data();

      if (session.userId !== userId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
        });
      }

      const ticket = crypto
        .randomBytes(32)
        .toString('base64url');

      const ticketHash = crypto
        .createHash('sha256')
        .update(ticket)
        .digest('hex');

      const expiresAt = Date.now() + STREAM_TICKET_TTL_MS;

      streamTickets.set(ticketHash, {
        sessionId,
        userId,
        expiresAt,
      });

      const origin =
        process.env.PUBLIC_API_ORIGIN ||
        'https://staging-api-7f3myik6uq-uc.a.run.app';

      const streamUrl =
        `${origin}/api/v1/sessions/` +
        `${encodeURIComponent(sessionId)}/stream?ticket=` +
        `${encodeURIComponent(ticket)}`;

      return res.status(200).json({
        streamUrl,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'stream_ticket_failed',
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          sessionId,
        })
      );

      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
);

app.use((error, req, res, next) => {
  if (error.message === 'CORS origin not allowed') {
    return res.status(403).json({
      error: 'CORS origin not allowed',
    });
  }

  console.error(
    'Unhandled application error:',
    error.message
  );

  return res.status(500).json({
    error: 'Internal server error',
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `cyberchurch-api listening on port ${port}`
  );
});
