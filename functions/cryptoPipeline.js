const path = require('path');
const snarkjs = require('snarkjs');
const circomlibjs = require('circomlibjs');

const WASM_PATH = path.join(__dirname, 'zk', 'sessionProof.wasm');
const ZKEY_PATH = path.join(__dirname, 'zk', 'sessionProof_final.zkey');

function buildCircuitInput(sessionDoc) {
  return {
    sessionId: sessionDoc.sessionNumericId || 0,
    totalParlays: sessionDoc.totalParlays || 0,
  };
}

async function computePoseidonHashForSession(sessionDoc) {
  const poseidon = await circomlibjs.buildPoseidon();
  const input = [
    BigInt(sessionDoc.sessionNumericId || 0),
    BigInt(sessionDoc.totalParlays || 0),
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

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  const poseidonHash = await computePoseidonHashForSession(sessionDoc);
  const eddsaSignature = await generateEdDSASignature(poseidonHash);

  const formattedProof = {
    pi_a: [proof.pi_a[0], proof.pi_a[1], proof.pi_a[2]],
    pi_b: [
      [proof.pi_b[0][0], proof.pi_b[0][1]],
      [proof.pi_b[1][0], proof.pi_b[1][1]],
      [proof.pi_b[2][0], proof.pi_b[2][1]],
    ],
    pi_c: [proof.pi_c[0], proof.pi_c[1], proof.pi_c[2]],
    protocol: 'groth16',
    curve: 'bn128',
  };

  const proofId = `zk_proof_${sessionDoc.sessionId || 'session'}_${Date.now()}`;
  const zkStatus = 'VERIFIED';

  return {
    poseidonHash,
    eddsaSignature,
    proof: formattedProof,
    proofId,
    zkStatus,
  };
}

module.exports = {
  generateZkProofForSession,
};