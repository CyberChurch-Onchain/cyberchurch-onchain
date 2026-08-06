const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Sanitize any object for Firestore: convert BigInt to string, drop non-JSON types
const sanitizePayload = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
};

exports.onSessionStatusChange = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const sessionId = context.params.sessionId;

    console.log('TRIGGERED: session updated', {
      sessionId,
      before,
      after,
    });

    const prevStatusRaw = before.sessionStatus ?? before.status ?? '';
    const newStatusRaw = after.sessionStatus ?? after.status ?? '';

    const prevStatus = String(prevStatusRaw).toLowerCase();
    const newStatus = String(newStatusRaw).toLowerCase();

    console.log('Status check:', {
      prevStatusRaw,
      newStatusRaw,
      prevStatus,
      newStatus,
    });

    if (prevStatus === newStatus) {
      console.log('Status unchanged, exiting.');
      return null;
    }

    if (newStatus === 'completed') {
      console.log(`Session ${sessionId} completed – generating ZK cryptoMetadata`);

      try {
        const zkInput = {
          sessionId,
          sessionNumericId: after.sessionNumericId ?? 0,
          totalParlays: after.totalParlays ?? 0,
        };

        const { generateZkProofForSession } = require('./cryptoPipeline');

        const zk = await generateZkProofForSession(zkInput);

        console.log('ZK payload generated:', {
          zkStatus: zk.zkStatus,
          proofId: zk.proofId,
          hasPoseidonHash: !!zk.poseidonHash,
          hasProof: !!zk.proof,
        });

        // Build a simple, flat cryptoMetadata object
        const safeCryptoMetadata = sanitizePayload({
          poseidonHash: String(zk.poseidonHash),
          eddsaSignature: {
            r8: [
              String(zk.eddsaSignature.r8[0]),
              String(zk.eddsaSignature.r8[1]),
            ],
            s: String(zk.eddsaSignature.s),
          },
          proof: {
            pi_a: zk.proof.pi_a,        // already array of strings
            pi_b: zk.proof.pi_b,        // now an object with row0/row1/row2
            pi_c: zk.proof.pi_c,        // already array of strings
            protocol: String(zk.proof.protocol),
            curve: String(zk.proof.curve),
          },
          zkStatus: String(zk.zkStatus),
          proofId: String(zk.proofId),
        });

        console.log('CRYPTO_PAYLOAD_BEFORE_WRITE', JSON.stringify(safeCryptoMetadata));

        await change.after.ref.update({
          cryptoMetadata: safeCryptoMetadata,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`cryptoMetadata updated for session ${sessionId}`);
      } catch (err) {
        console.error('ZK Pipeline Error:', err);

        // Very simple error payload to avoid nested entity issues
        const safeErrorCrypto = sanitizePayload({
          zkStatus: 'ERROR',
          proofId: `zk_error_${sessionId}_${Date.now()}`,
          errorMessage: String(err.message || err),
        });

        console.log('ERROR_PAYLOAD_BEFORE_WRITE', JSON.stringify(safeErrorCrypto));

        await change.after.ref.update({
          cryptoMetadata: safeErrorCrypto,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      console.log(`Session ${sessionId} status changed to "${newStatus}" – not "completed", skipping ZK.`);
    }

    return null;
  });