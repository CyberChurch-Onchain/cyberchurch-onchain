// functions/index.js

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { generateZkProofForSession } = require('./cryptoPipeline');

admin.initializeApp();
const db = admin.firestore();

/**
 * Firestore trigger:
 * Runs whenever a document in sessions/{sessionId} is updated.
 */
exports.onSessionStatusChange = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    const sessionId = context.params.sessionId;

    // Trigger ZK pipeline only when status flips to 'Completed'
    if (
      newData.sessionStatus === 'Completed' &&
      previousData.sessionStatus !== 'Completed'
    ) {
      try {
        console.log(
          `Session ${sessionId} status changed to Completed. Triggering ZK pipeline...`
        );
        //await triggerZKPipeline(sessionId, newData);
      } catch (error) {
        console.error(
          `Failed to trigger ZK pipeline for session ${sessionId}:`,
          error
        );
      }
    } else {
      console.log(
        `Session ${sessionId} updated but status is ${newData.sessionStatus}. No ZK action taken.`
      );
    }

    return null;
  });

/**
 * Handles the ZK pipeline execution
 * @param {string} sessionId
 * @param {Object} sessionData
 */
async function triggerZKPipeline(sessionId, sessionData) {
  console.log(`Initializing ZK pipeline for session: ${sessionId}`);

  // Example: build the ZK input and generate a proof object
  const zkInput = {
    sessionId,
    sessionNumericId: sessionData.sessionNumericId || 0,
    totalParlays: sessionData.totalParlays || 0,
    createdAt: sessionData.createdAt,
    completedAt: sessionData.completedAt,
  };

  // Call the ZK helper (Poseidon hash, etc.)
  const proof = await generateZkProofForSession(zkInput);

  console.log(`Generated ZK proof for session ${sessionId}`, proof);

  const sessionRef = db.collection('sessions').doc(sessionId);

  // Write ZK metadata back to Firestore
  return sessionRef.update({
    cryptoMetadata: {
      zkStatus: 'generated',
      zkProof: proof,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}