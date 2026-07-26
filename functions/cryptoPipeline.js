// functions/cryptoPipeline.js

const circomlib = require('circomlibjs');  // Poseidon, etc.
const jose = require('jose');              // EdDSA / JWT style verification

async function computePoseidonHash(inputs) {
  // inputs: array of BigInt, e.g. [BigInt(1), BigInt(2)]
  const poseidon = await circomlib.buildPoseidon();
  const hashBigInt = poseidon(inputs);
  const hashHex = '0x' + poseidon.F.toString(hashBigInt, 16);
  return hashHex;
}

async function verifyEdDSASignature(message, signature, publicKeyJwk) {
  // message: string, signature: compact JWS or similar, publicKeyJwk: Ed25519 JWK
  const publicKey = await jose.importJWK(publicKeyJwk, 'Ed25519');
  try {
    const { payload } = await jose.compactVerify(signature, publicKey);
    const decoded = new TextDecoder().decode(payload);
    return {
      valid: true,
      payload: decoded,
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

async function generateZkProofForSession(sessionDoc) {
  // Phase 3: structured placeholder that already matches our cryptoMetadata format.
  // Later: plug in real zk-SNARK/zk-STARK prover here.

  const poseidonInput = [
    BigInt(sessionDoc.sessionNumericId || 0),
    BigInt(sessionDoc.totalParlays || 0),
  ];

  const poseidonHash = await computePoseidonHash(poseidonInput);

  return {
    version: 'v1',
    poseidonHash,
    proofId: `zk_${sessionDoc.sessionId}_${Date.now()}`,
    // TODO: attach actual zk proof blob, public signals, etc.
  };
}

module.exports = {
  computePoseidonHash,
  verifyEdDSASignature,
  generateZkProofForSession,
};