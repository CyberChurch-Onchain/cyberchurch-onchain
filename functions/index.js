const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

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
        return await triggerZKPipeline(sessionId, newData);
      } catch (error) {
        console.error(
          `Failed to trigger ZK pipeline for session ${sessionId}:`,
          error
        );
        return null;
      }
    }

    console.log(
      `Session ${sessionId} updated but status is ${newData.sessionStatus}. No ZK action taken.`
    );
    return null;
  });

/**
 * Handles the ZK-SNARK/STARK pipeline execution
 * @param {string} sessionId 
 * @param {Object} sessionData 
 */
async function triggerZKPipeline(sessionId, sessionData) {
  console.log(`Initializing ZK pipeline for session: ${sessionId}`);

  // TODO: Import cryptographic modules once fully compiled
  // const proofArtifacts = await generateZKProof(sessionData);
  // const signature = await signSettlement(proofArtifacts);

  // Example placeholder: update timestamps and keep cryptoMetadata ready
  const sessionRef = db.collection('sessions').doc(sessionId);

  return sessionRef.update({
    // cryptoMetadata: {
    //   poseidonHash: poseidonResult,
    //   eddsaSignature: signature,
    //   proof: proofArtifacts,
    // },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}