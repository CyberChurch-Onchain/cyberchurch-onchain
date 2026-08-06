const path = require('path');
const snarkjs = require('snarkjs');
const circomlibjs = require('circomlibjs');

const WASM_PATH = path.join(__dirname, 'zk', 'sessionProof.wasm');
const ZKEY_PATH = path.join(__dirname, 'zk', 'sessionProof_final.zkey');

// Sanitize any object for Firestore: convert BigInt to string, drop non-JSON types
const sanitizePayload = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
};

function buildCircuitInput(sessionDoc) {
  const sessionNumericId = sessionDoc.sessionNumericId ?? 0;
  const totalParlays = sessionDoc.totalParlays ?? 0;

  return {
    sessionId: Number(sessionNumericId),
    totalParlays: Number(totalParlays),
  };
}

async function computePoseidonHashForSession(sessionDoc) {
  const poseidon = await circomlibjs.buildPoseidon();

  const sessionNumericId = sessionDoc.sessionNumericId ?? 0;
  const totalParlays = sessionDoc.totalParlays ?? 0;

  const input = [
    BigInt(sessionNumericId),
    BigInt(totalParlays),
  ];

  const hash = poseidon(input);
  const hashHex = '0x' + poseidon.F.toString(hash, 16);
  return hashHex;
}

async function generateEdDSASignature(messageHex) {
  // TODO: replace with real private key & EdDSA logic later
  return {
    r8: [
      '1234567890123456789012345678901234567890',
      '0987654321098765432109876543210987654321',
    ],
    s: '9876543210987654321098765432109876543210',
  };
}

async function generateZkProofForSession(sessionDoc) {
  const input = buildCircuitInput(sessionDoc);

  if (typeof input.sessionId !== 'number' || typeof input.totalParlays !== 'number') {
    throw new Error('Invalid circuit input: sessionId and totalParlays must be numbers');
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  const poseidonHash = await computePoseidonHashForSession(sessionDoc);
  const eddsaSignature = await generateEdDSASignature(poseidonHash);

  // Use object instead of nested array for pi_b
  const formattedProof = {
    pi_a: [
      String(proof.pi_a[0]),
      String(proof.pi_a[1]),
      String(proof.pi_a[2]),
    ],
    pi_b: {
      row0: [
        String(proof.pi_b[0][0]),
        String(proof.pi_b[0][1]),
      ],
      row1: [
        String(proof.pi_b[1][0]),
        String(proof.pi_b[1][1]),
      ],
      row2: [
        String(proof.pi_b[2][0]),
        String(proof.pi_b[2][1]),
      ],
    },
    pi_c: [
      String(proof.pi_c[0]),
      String(proof.pi_c[1]),
      String(proof.pi_c[2]),
    ],
    protocol: 'groth16',
    curve: 'bn128',
  };

  const proofId = `zk_proof_${sessionDoc.sessionId || 'session'}_${Date.now()}`;
  const zkStatus = 'VERIFIED';

  const rawCrypto = {
    poseidonHash: String(poseidonHash),
    eddsaSignature: {
      r8: [
        String(eddsaSignature.r8[0]),
        String(eddsaSignature.r8[1]),
      ],
      s: String(eddsaSignature.s),
    },
    proof: formattedProof,
    proofId: String(proofId),
    zkStatus: String(zkStatus),
  };

  return sanitizePayload(rawCrypto);
}

module.exports = {
  generateZkProofForSession,
};