// functions/index.js

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const { generateZkProofForSession } = require('./cryptoPipeline');

/**
 * Firestore trigger:
 * Runs whenever a document in sessions/{sessionId} is updated.
 */
exports.onSessionStatusChange = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const sessionId = context.params.sessionId;

    const prevStatus = before.sessionStatus || before.status;
    const newStatus = after.sessionStatus || after.status;

    // If status didn't change, do nothing
    if (prevStatus === newStatus) {
      return null;
    }

    // Only act when the session moves into a completed state
    if (newStatus === 'COMPLETED' || newStatus === 'Completed') {
      console.log(`Session ${sessionId} completed – generating ZK cryptoMetadata`);

      const zkInput = {
        sessionId,
        sessionNumericId: after.sessionNumericId || 0,
        totalParlays: after.totalParlays || 0,
        createdAt: after.createdAt,
        completedAt: after.completedAt,
      };

      // Call the ZK prover helper (structure defined in cryptoPipeline.js)
      const zk = await generateZkProofForSession(zkInput);

      // Write Jean's exact cryptoMetadata structure to Firestore
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

      console.log(`cryptoMetadata written for session ${sessionId}`);
    }

    return null;
  });