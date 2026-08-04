const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const { generateZkProofForSession } = require('./cryptoPipeline');

exports.onSessionStatusChange = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const sessionId = context.params.sessionId;

    const prevStatus = before.sessionStatus || before.status;
    const newStatus = after.sessionStatus || after.status;

    if (prevStatus === newStatus) {
      return null;
    }

    if (newStatus === 'completed' || newStatus === 'Completed') {
      console.log(`Session ${sessionId} completed – generating ZK cryptoMetadata`);

      const zkInput = {
        sessionId,
        sessionNumericId: after.sessionNumericId || 0,
        totalParlays: after.totalParlays || 0,
      };

      const zk = await generateZkProofForSession(zkInput);

      await change.after.ref.update({
        cryptoMetadata: {
          zkStatus: zk.zkStatus,
          proofId: zk.proofId,
          poseidonHash: zk.poseidonHash,
          eddsaSignature: zk.eddsaSignature,
          proof: zk.proof,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`cryptoMetadata updated for session ${sessionId}`);
    }

    return null;
  });