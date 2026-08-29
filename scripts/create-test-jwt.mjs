import { SignJWT } from 'jose';
import { generateKeyPairSync } from 'crypto';

// Generate a fresh RS256 key pair for test tokens
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Accept TTL as first argument, default to 12 hours
const ttlArg = process.argv[2] || '12h';

// Parse simple TTL formats: "12h", "6h", "30m", "1d"
function parseTTL(ttl) {
  const match = /^(\d+)([hmds])$/.exec(ttl);
  if (!match) {
    throw new Error('Invalid time period format. Use e.g. 12h, 6h, 30m, 1d');
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const secondsPerUnit = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };
  return value * secondsPerUnit[unit];
}

const ttlSeconds = parseTTL(ttlArg);

const sub = 'sakshi-test-user';
const iss = 'https://auth.cyberchurchonchain.org/';
const aud = 'cyberchurch-api';

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setSubject(sub)
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  console.log(jwt);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
