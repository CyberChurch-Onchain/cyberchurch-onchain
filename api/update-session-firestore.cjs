const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "bold-ally-485107-b8",
});

const db = admin.firestore();
const sessionRef = db.collection("sessions").doc("test-session-001");

async function main() {
  await sessionRef.set(
    {
      sessionId: "test-session-001",
      status: "ACTIVE",
      userId: "test-user-123",
      currentAgentId: "peacemaker",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const snapshot = await sessionRef.get();

  if (!snapshot.exists) {
    throw new Error("sessions/test-session-001 was not found after update");
  }

  const data = snapshot.data();

  console.log(JSON.stringify({
    path: sessionRef.path,
    sessionId: data.sessionId,
    status: data.status,
    userId: data.userId,
    currentAgentId: data.currentAgentId,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    error: error.code || "UNKNOWN_ERROR",
    message: error.message,
  }, null, 2));

  process.exit(1);
});
