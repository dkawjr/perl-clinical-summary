import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT,
  CANDIDATE_RETEST_DISPOSITION_BOUNDARY,
  CANDIDATE_RETEST_DISPOSITION_CONTRACT,
  CANDIDATE_RETEST_DISPOSITION_PURPOSES,
  buildCandidateRetestDispositionDocket,
  candidateRetestDispositionAnalysis,
  candidateRetestDispositionDigest,
  canonicalCandidateRetestDispositionJson,
  createCandidateRetestDispositionAttestationEvent,
  createCandidateRetestDispositionChallenge,
  disabledCandidateRetestDispositionRegistry,
  summarizeCandidateRetestDispositionRegistry,
  validateCandidateRetestDispositionAttestation,
  validateCandidateRetestDispositionChallenge,
  validateCandidateRetestDispositionEvent,
  validateCandidateRetestDispositionRegistry
} from "../src/candidate-retest-disposition.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HEX = value => String(value).repeat(64).slice(0, 64);
const CYCLE_ID = "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD";
const cycle = {
  cycleId: CYCLE_ID,
  cycleEventHash: HEX("a"),
  returnSetFingerprint: HEX("b"),
  retestProtocolFingerprint: HEX("c"),
  localPairedEvidenceComplete: true
};
const candidateRetest = {
  selectedCycleId: CYCLE_ID,
  cycles: [cycle],
  studioFingerprint: HEX("d"),
  chains: {
    refinement: { valid: true, count: 1, head: HEX("e") },
    retestReturns: { valid: true, count: 3, head: HEX("f") },
    pairedReviews: { valid: true, count: 6, head: HEX("1") }
  }
};
const admission = {
  admissionFingerprint: HEX("2"),
  clinicalStandardDraftHash: HEX("3"),
  independentReviewProtocolFrozen: true,
  independentReviewExecutionReady: true,
  chain: { valid: true, count: 8, head: HEX("4") }
};

function reviewEvents() {
  let sequence = 0;
  return ["REVIEWER-A", "REVIEWER-B"].flatMap((reviewer, reviewerIndex) => ["PERL-1007", "PERL-1042", "PERL-1188"].map((caseId, caseIndex) => {
    sequence += 1;
    const retestAtX = (reviewerIndex + caseIndex) % 2 === 0;
    return {
      sequence,
      cycleId: CYCLE_ID,
      caseId,
      reviewerCodeHash: candidateRetestDispositionDigest(reviewer),
      pairMapping: retestAtX ? { X: "retest", Y: "baseline" } : { X: "baseline", Y: "retest" },
      differenceDisposition: caseIndex === 2 ? "materially-equivalent" : retestAtX ? "x-stronger" : "y-stronger",
      cells: [{ correctionBurden: caseIndex === 0 ? "minor" : "none", dissentFlags: [] }, { correctionBurden: "none", dissentFlags: reviewerIndex ? ["clinical-utility"] : [] }],
      hash: candidateRetestDispositionDigest({ sequence, reviewer, caseId })
    };
  }));
}

function registryFixture() {
  const privateKeys = new Map();
  const keys = CANDIDATE_RETEST_DISPOSITION_PURPOSES.map((purpose, index) => {
    const pair = generateKeyPairSync("ed25519");
    const keyId = `FF-RETEST-DISPOSITION-KEY-TEST-${index + 1}`;
    privateKeys.set(purpose, pair.privateKey);
    return { keyId, algorithm: "Ed25519", purpose, publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-13T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z" };
  });
  return { registry: { contractVersion: "perl-candidate-retest-disposition-registry/1.0", registryId: "FF-RETEST-DISPOSITION-REGISTRY-TEST-001", version: "1.0.0", issuedAt: "2026-08-13T00:00:00.000Z", expiresAt: "2026-08-16T00:00:00.000Z", keys }, privateKeys };
}

const contentBoundary = () => ({ evaluatorNamesIncluded: false, humanSignaturesIncluded: false, credentialsOrSecretsIncluded: false, sourceWorkbookBytesIncluded: false, summaryProseIncluded: false, findingsContentIncluded: false, rawResponsesIncluded: false, caseFilesIncluded: false, patientIdentifiersIncluded: false, patientRecordsIncluded: false, phiIncluded: false, perlExternalTransmissionPerformed: false });

function decisionFor(purpose, challenge, prior, { supported = true } = {}) {
  if (purpose === "independent-accuracy-disposition") return {
    analysisPlanHash: HEX("5"),
    sourceFidelity: supported ? "meets-standard" : "does-not-meet-standard",
    criticalSafetyHandling: "meets-standard",
    clinicalRestraint: "meets-standard",
    conversationUsefulness: "meets-standard",
    correctionBurden: "acceptable",
    cycleComparison: "retest-supported",
    outcome: supported ? "accuracy-supported-for-frozen-cycle" : "accuracy-not-supported"
  };
  if (purpose === "independent-reliability-disposition") return {
    agreementAnalysisHash: HEX("6"), reviewerOverlapAccepted: supported, caseCoverageAccepted: true,
    reliabilityEstimate: supported ? "sufficient-for-frozen-cycle" : "insufficient",
    outcome: supported ? "reliability-supported-for-frozen-cycle" : "reliability-not-supported"
  };
  if (purpose === "clinical-standard-satisfaction-disposition") return {
    clinicalStandardDraftHash: challenge.clinicalStandardDraftHash,
    accuracyAttestationFingerprint: candidateRetestDispositionDigest(prior.get("independent-accuracy-disposition")),
    reliabilityAttestationFingerprint: candidateRetestDispositionDigest(prior.get("independent-reliability-disposition")),
    clientConfirmationReferenceHash: HEX("7"), satisfactionThresholdMet: supported,
    outcome: supported ? "clinical-standard-met-for-frozen-cycle" : "further-refinement-required"
  };
  return {
    priorAttestationFingerprints: CANDIDATE_RETEST_DISPOSITION_PURPOSES.slice(0, -1).map(item => candidateRetestDispositionDigest(prior.get(item))),
    frozenDispositionPackageHash: challenge.dispositionPackageHash,
    cycleCloseRecommendation: supported ? "close-this-refinement-cycle" : "continue-refinement",
    candidateRecommendation: supported ? "advance-to-separate-provider-model-decision" : "retain-baseline-and-refine",
    outcome: "independent-result-frozen"
  };
}

function signedAttestation({ purpose, challenge, registry, privateKey, prior, index, supported = true }) {
  const core = {
    contractVersion: CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT,
    attestationId: `FF-RETEST-DISPOSITION-ATTEST-TEST-${index + 1}`,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    registryFingerprint: challenge.registryFingerprint,
    dispositionPackageHash: challenge.dispositionPackageHash,
    purpose,
    keyId: registry.keys.find(key => key.purpose === purpose).keyId,
    issuedAt: NOW,
    decision: decisionFor(purpose, challenge, prior, { supported }),
    contentBoundary: contentBoundary()
  };
  return { ...core, signature: { algorithm: "Ed25519", keyId: core.keyId, value: sign(null, Buffer.from(canonicalCandidateRetestDispositionJson(core)), privateKey).toString("base64url") } };
}

function completeChain({ supported = true } = {}) {
  const analysis = candidateRetestDispositionAnalysis({ cycleId: CYCLE_ID, reviewEvents: reviewEvents() });
  const { registry, privateKeys } = registryFixture();
  const challengeEvent = createCandidateRetestDispositionChallenge({ candidateRetest, cycleId: CYCLE_ID, analysis, admission, registry, actor: "DISPOSITION-QA", sequence: 1, createdAt: NOW });
  const events = [challengeEvent];
  const prior = new Map();
  let previousHash = challengeEvent.hash;
  for (const [index, purpose] of CANDIDATE_RETEST_DISPOSITION_PURPOSES.entries()) {
    const attestation = signedAttestation({ purpose, challenge: challengeEvent.challenge, registry, privateKey: privateKeys.get(purpose), prior, index, supported });
    assert.deepEqual(validateCandidateRetestDispositionAttestation(attestation, { challenge: challengeEvent.challenge, registry, priorAttestations: prior, now: NOW, seenPurposes: new Set(prior.keys()) }), []);
    const event = createCandidateRetestDispositionAttestationEvent({ attestation, registry, actor: "DISPOSITION-QA", sequence: index + 2, previousHash, verifiedAt: NOW });
    assert.deepEqual(validateCandidateRetestDispositionEvent(event, { sequence: index + 2, previousHash, challenge: challengeEvent.challenge, registry, priorAttestations: prior, now: NOW, seenPurposes: new Set(prior.keys()) }), []);
    events.push(event);
    prior.set(purpose, attestation);
    previousHash = event.hash;
  }
  return { analysis, registry, privateKeys, challengeEvent, events, prior };
}

test("blind X/Y dispositions are decoded only inside the independent analysis boundary", () => {
  const analysis = candidateRetestDispositionAnalysis({ cycleId: CYCLE_ID, reviewEvents: reviewEvents() });
  assert.equal(analysis.reviewPacketCount, 6);
  assert.equal(analysis.distinctCaseCount, 3);
  assert.equal(analysis.distinctReviewerCodeCount, 2);
  assert.equal(analysis.comparisonCounts["retest-supported"], 4);
  assert.equal(analysis.comparisonCounts["materially-equivalent"], 2);
  assert.equal(analysis.summaryProseIncluded, false);
  assert.equal(analysis.generalizedPerformanceClaimed, false);
});

test("disposition registry requires four distinct purpose-bound Ed25519 keys", () => {
  assert.match(CANDIDATE_RETEST_DISPOSITION_BOUNDARY, /does not itself close the cycle/i);
  assert.deepEqual(validateCandidateRetestDispositionRegistry(disabledCandidateRetestDispositionRegistry()), []);
  const { registry } = registryFixture();
  assert.deepEqual(validateCandidateRetestDispositionRegistry(registry), []);
  assert.equal(summarizeCandidateRetestDispositionRegistry(registry, NOW).activeKeyCount, 4);
  const repeated = structuredClone(registry);
  repeated.keys[1].publicKeyPem = repeated.keys[0].publicKeyPem;
  assert.ok(validateCandidateRetestDispositionRegistry(repeated).some(error => /distinct bounded/i.test(error)));
});

test("24-hour challenge binds exact local evidence, admitted protocol, standard, and registry", () => {
  const analysis = candidateRetestDispositionAnalysis({ cycleId: CYCLE_ID, reviewEvents: reviewEvents() });
  const { registry } = registryFixture();
  const event = createCandidateRetestDispositionChallenge({ candidateRetest, cycleId: CYCLE_ID, analysis, admission, registry, actor: "DISPOSITION-QA", sequence: 1, createdAt: NOW });
  assert.deepEqual(validateCandidateRetestDispositionChallenge(event.challenge, { candidateRetest, cycleId: CYCLE_ID, analysis, admission, registryFingerprint: event.challenge.registryFingerprint }), []);
  assert.deepEqual(validateCandidateRetestDispositionEvent(event), []);
  assert.equal(Date.parse(event.challenge.expiresAt) - Date.parse(event.challenge.issuedAt), 86_400_000);
  assert.equal(event.independentResultFrozen, false);
  assert.equal(event.cycleClosed, false);
});

test("four ordered signatures freeze an exact-cycle result without creating validation or release authority", () => {
  const { analysis, registry, events } = completeChain();
  const docket = buildCandidateRetestDispositionDocket({ candidateRetest, cycleId: CYCLE_ID, analysis, admission, registry, events, chain: { valid: true, count: events.length, head: events.at(-1).hash }, generatedAt: NOW });
  assert.equal(docket.status, "independent-disposition-frozen");
  assert.equal(docket.counts.verifiedExternalDuties, 4);
  assert.equal(docket.independentResultFrozen, true);
  assert.equal(docket.cycleCloseRecommended, true);
  assert.equal(docket.cycleClosed, false);
  assert.equal(docket.generalizedAccuracyEstablished, false);
  assert.equal(docket.generalizedReliabilityEstablished, false);
  assert.equal(docket.comparativeImprovementEstablished, false);
  assert.equal(docket.clinicalValidation, false);
  assert.equal(docket.engineSelected, false);
  assert.equal(docket.patientUseAuthorized, false);
});

test("result chain fails closed on skipped purpose, reused signature, tamper, and unsupported close", () => {
  const analysis = candidateRetestDispositionAnalysis({ cycleId: CYCLE_ID, reviewEvents: reviewEvents() });
  const { registry, privateKeys } = registryFixture();
  const challengeEvent = createCandidateRetestDispositionChallenge({ candidateRetest, cycleId: CYCLE_ID, analysis, admission, registry, actor: "DISPOSITION-QA", sequence: 1, createdAt: NOW });
  const skipped = signedAttestation({ purpose: CANDIDATE_RETEST_DISPOSITION_PURPOSES[1], challenge: challengeEvent.challenge, registry, privateKey: privateKeys.get(CANDIDATE_RETEST_DISPOSITION_PURPOSES[1]), prior: new Map(), index: 1 });
  assert.ok(validateCandidateRetestDispositionAttestation(skipped, { challenge: challengeEvent.challenge, registry, now: NOW }).some(error => /verified in order/i.test(error)));

  const failed = completeChain({ supported: false });
  const priorBeforeFreeze = new Map(CANDIDATE_RETEST_DISPOSITION_PURPOSES.slice(0, -1).map((purpose, index) => [purpose, failed.events[index + 1].attestation]));
  const illegalFreeze = signedAttestation({ purpose: "independent-result-freeze", challenge: failed.challengeEvent.challenge, registry: failed.registry, privateKey: failed.privateKeys.get("independent-result-freeze"), prior: priorBeforeFreeze, index: 3, supported: true });
  assert.ok(validateCandidateRetestDispositionAttestation(illegalFreeze, { challenge: failed.challengeEvent.challenge, registry: failed.registry, priorAttestations: priorBeforeFreeze, now: NOW, seenPurposes: new Set(priorBeforeFreeze.keys()) }).some(error => /inconsistent/i.test(error)));
  assert.ok(validateCandidateRetestDispositionEvent({ ...failed.events.at(-1), cycleClosed: true }, { sequence: 5, previousHash: failed.events.at(-2).hash }).some(error => /cycleClosed/i.test(error)));
});

test("published disposition schemas are strict and keep global claims false", async () => {
  const names = ["registry", "challenge", "attestation", "event"];
  const schemas = await Promise.all(names.map(name => readFile(new URL(`../schemas/candidate-retest-disposition-${name}.schema.json`, import.meta.url), "utf8").then(JSON.parse)));
  assert.equal(schemas[0].additionalProperties, false);
  assert.equal(schemas[1].additionalProperties, false);
  assert.equal(schemas[2].additionalProperties, false);
  assert.equal(schemas[3].$defs.challengeEvent.additionalProperties, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.cycleClosed.const, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.clinicalValidation.const, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.patientUseAuthorized.const, false);
  assert.equal(CANDIDATE_RETEST_DISPOSITION_CONTRACT, "perl-candidate-retest-independent-disposition/1.0");
});

test("disposition chamber is a responsive four-key instrument with no local approval control", async () => {
  const [html, css, app, apiClient] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../candidate-retest-disposition.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/api-client.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="candidate-retest-disposition-chamber"/);
  assert.match(html, /Let the outside decision arrive with its own key\./);
  assert.match(html, /Independent accuracy disposition[\s\S]*Independent reliability disposition[\s\S]*Clinical Standard satisfaction[\s\S]*Independent result freeze/);
  assert.match(html, /id="candidate-disposition-file"[^>]*accept="application\/json,.json"[^>]*disabled/);
  assert.match(app, /\$\("#candidate-disposition-file"\)\.disabled = !state\.connected \|\| !challenge \|\| disposition\.independentResultFrozen/);
  assert.match(html, /Clinical validation[\s\S]*NOT CLAIMED/);
  assert.doesNotMatch(html, /id="candidate-disposition-(approve|accept|close|select)/i);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /@media \(max-width:1080px\)/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /candidateRetestDispositionAttestation/);
  assert.match(app, /file\.size > 64 \* 1024/);
  assert.match(apiClient, /issueCandidateRetestDispositionChallenge/);
  assert.match(apiClient, /verifyCandidateRetestDispositionAttestation/);
});
