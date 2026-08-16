template SessionProof() {
    signal input sessionId;
    signal input totalParlays;
    signal output result;

    result <== sessionId + totalParlays;
}

component main = SessionProof();