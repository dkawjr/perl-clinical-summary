import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT,
  INDEPENDENT_REVIEW_ADMISSION_BOUNDARY,
  INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
  INDEPENDENT_REVIEW_ADMISSION_PURPOSES,
  buildIndependentReviewAdmissionDocket,
  canonicalIndependentReviewAdmissionJson,
  createIndependentReviewAdmissionAttestationEvent,
  createIndependentReviewAdmissionChallenge,
  disabledIndependentReviewAdmissionRegistry,
  independentReviewAdmissionDigest,
  summarizeIndependentReviewAdmissionRegistry,
  validateIndependentReviewAdmissionAttestation,
  validateIndependentReviewAdmissionChallenge,
  validateIndependentReviewAdmissionEvent,
  validateIndependentReviewAdmissionRegistry
} from "../src/independent-review-admission.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HEX = value => String(value).repeat(64).slice(0, 64);
const dossier = {
  dossierFingerprint: HEX("a"), reviewPackageHash: HEX("b"),
  chain: { valid: true, count: 1, head: HEX("c") },
  latestSeal: { dossierFingerprint: HEX("a") },
  gateCounts: { localCurrent: 4 },
  evidenceSnapshot: { referenceDecisionDocketFingerprint: HEX("d") }
};
const referenceDecision = {
  docketFingerprint: HEX("d"), protocolFrozen: true, independentReviewHandoffReady: true,
  chain: { valid: true, count: 5, head: HEX("e") },
  purposes: [{ purpose: "reference-protocol-freeze", attestationFingerprint: HEX("f") }]
};
const clinicalStandard = { latestDraft: { hash: HEX("1") }, chain: { valid: true, count: 1, head: HEX("2") } };

function registryFixture() {
  const privateKeys = new Map();
  const keys = INDEPENDENT_REVIEW_ADMISSION_PURPOSES.map((purpose, index) => {
    const pair = generateKeyPairSync("ed25519");
    const keyId = `FF-REVIEW-ADMISSION-KEY-TEST-${index + 1}`;
    privateKeys.set(purpose, pair.privateKey);
    return { keyId, algorithm: "Ed25519", purpose, publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-13T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z" };
  });
  return { registry: { contractVersion: "perl-independent-review-admission-registry/1.0", registryId: "FF-REVIEW-ADMISSION-REGISTRY-TEST-001", version: "1.0.0", issuedAt: "2026-08-13T00:00:00.000Z", expiresAt: "2026-08-16T00:00:00.000Z", keys }, privateKeys };
}

const boundary = () => ({ evidenceFilesIncluded: false, humanNamesIncluded: false, humanSignaturesIncluded: false, credentialsOrSecretsIncluded: false, workbookBytesIncluded: false, caseRecordsIncluded: false, findingsContentIncluded: false, rawResponseContentIncluded: false, patientRecordsIncluded: false, phiIncluded: false, perlExternalTransmissionPerformed: false });

function decisionFor(purpose, challenge, prior) {
  const h = offset => HEX(String((offset % 8) + 1));
  if (purpose === "authoritative-source-contract-acceptance") return { thresholdWorkbookHash: h(0), categoryWorkbookHash: h(1), scoredEventContractHash: h(2), scoringVersionReference: "eqpass-score-v1.4", findingsLifecycleHash: h(3), outcome: "accepted" };
  if (purpose === "representative-case-set-freeze") return { caseInventoryHash: h(0), caseSetReference: "FF-EVAL-CASESET-2026-01", eligibilityProtocolHash: h(1), strataProtocolHash: h(2), developmentPartitionHash: h(3), holdoutPartitionHash: h(4), holdoutAccessPolicyHash: h(5), outcome: "frozen" };
  if (purpose === "clinical-standard-acceptance") return { clinicalStandardDraftHash: challenge.clinicalStandardDraftHash, analysisPlanHash: h(1), measureDefinitionsHash: h(2), zeroSafetyToleranceAccepted: true, preOutcomeStatusReviewed: true, outcome: "accepted" };
  if (purpose === "evaluator-charter-attestation") return { evaluatorAuthorityReferenceHash: h(0), qualificationsReferenceHash: h(1), conflictDisclosureHash: h(2), charterHash: h(3), independenceConfirmed: true, outcome: "verified" };
  if (purpose === "legal-permission-attestation") return { permissionReferenceHash: h(0), permittedDataClass: "approved-deidentified-evaluation-records", retentionPolicyHash: h(1), deletionPolicyHash: h(2), purposeLimited: true, outcome: "approved" };
  if (purpose === "privacy-permission-attestation") return { privacyReviewReferenceHash: h(0), transferControlsHash: h(1), accessControlsHash: h(2), deidentificationStandardHash: h(3), minimumNecessaryConfirmed: true, outcome: "approved" };
  return {
    priorAttestationFingerprints: INDEPENDENT_REVIEW_ADMISSION_PURPOSES.slice(0, -1).map(item => independentReviewAdmissionDigest(prior.get(item))),
    frozenProtocolHash: h(0), evaluatorHandoffHash: h(1), analysisPlanHash: prior.get("clinical-standard-acceptance").decision.analysisPlanHash,
    caseSetReference: prior.get("representative-case-set-freeze").decision.caseSetReference,
    referenceDecisionDocketFingerprint: challenge.referenceDecisionDocketFingerprint,
    outcome: "frozen-for-independent-execution"
  };
}

function signedAttestation({ purpose, challenge, registry, privateKey, prior, index }) {
  const core = {
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT,
    attestationId: `FF-REVIEW-ADMISSION-ATTEST-TEST-${index + 1}`,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    registryFingerprint: challenge.registryFingerprint,
    dossierFingerprint: challenge.dossierFingerprint,
    referenceDecisionDocketFingerprint: challenge.referenceDecisionDocketFingerprint,
    purpose,
    keyId: registry.keys.find(key => key.purpose === purpose).keyId,
    issuedAt: NOW,
    decision: decisionFor(purpose, challenge, prior),
    contentBoundary: boundary()
  };
  return { ...core, signature: { algorithm: "Ed25519", keyId: core.keyId, value: sign(null, Buffer.from(canonicalIndependentReviewAdmissionJson(core)), privateKey).toString("base64url") } };
}

function completeChain() {
  const { registry, privateKeys } = registryFixture();
  const challengeEvent = createIndependentReviewAdmissionChallenge({ dossier, referenceDecision, clinicalStandard, registry, actor: "ADMISSION-QA", sequence: 1, createdAt: NOW });
  const events = [challengeEvent];
  const prior = new Map();
  let previousHash = challengeEvent.hash;
  for (const [index, purpose] of INDEPENDENT_REVIEW_ADMISSION_PURPOSES.entries()) {
    const attestation = signedAttestation({ purpose, challenge: challengeEvent.challenge, registry, privateKey: privateKeys.get(purpose), prior, index });
    const errors = validateIndependentReviewAdmissionAttestation(attestation, { challenge: challengeEvent.challenge, registry, priorAttestations: prior, now: NOW, seenPurposes: new Set(prior.keys()) });
    assert.deepEqual(errors, []);
    const event = createIndependentReviewAdmissionAttestationEvent({ attestation, registry, actor: "ADMISSION-QA", sequence: index + 2, previousHash, verifiedAt: NOW });
    assert.deepEqual(validateIndependentReviewAdmissionEvent(event, { sequence: index + 2, previousHash, challenge: challengeEvent.challenge, registry, priorAttestations: prior, now: NOW, seenPurposes: new Set(prior.keys()) }), []);
    events.push(event);
    prior.set(purpose, attestation);
    previousHash = event.hash;
  }
  return { registry, events, challengeEvent, prior };
}

test("independent-review admission registry requires seven distinct purpose-bound Ed25519 keys", () => {
  assert.match(INDEPENDENT_REVIEW_ADMISSION_BOUNDARY, /does not complete the evaluation/i);
  assert.deepEqual(validateIndependentReviewAdmissionRegistry(disabledIndependentReviewAdmissionRegistry()), []);
  const { registry } = registryFixture();
  assert.deepEqual(validateIndependentReviewAdmissionRegistry(registry), []);
  assert.equal(summarizeIndependentReviewAdmissionRegistry(registry, NOW).activeKeyCount, 7);
  const repeated = structuredClone(registry);
  repeated.keys[1].publicKeyPem = repeated.keys[0].publicKeyPem;
  assert.ok(validateIndependentReviewAdmissionRegistry(repeated).some(error => /distinct keys|repeats trusted key material/i.test(error)));
});

test("admission challenge binds the current sealed dossier, reference freeze, standard draft, and 24-hour window", () => {
  const { registry } = registryFixture();
  const event = createIndependentReviewAdmissionChallenge({ dossier, referenceDecision, clinicalStandard, registry, actor: "ADMISSION-QA", sequence: 1, createdAt: NOW });
  assert.deepEqual(validateIndependentReviewAdmissionChallenge(event.challenge, { dossier, referenceDecision, clinicalStandard, registryFingerprint: event.challenge.registryFingerprint }), []);
  assert.deepEqual(validateIndependentReviewAdmissionEvent(event), []);
  assert.equal(Date.parse(event.challenge.expiresAt) - Date.parse(event.challenge.issuedAt), 86_400_000);
  assert.equal(event.independentReviewExecutionReady, false);
  assert.equal(event.accuracyEstablished, false);
});

test("seven ordered signatures admit execution but cannot manufacture a result or clinical claim", () => {
  const { registry, events } = completeChain();
  const docket = buildIndependentReviewAdmissionDocket({ dossier, referenceDecision, clinicalStandard, registry, events, chain: { valid: true, count: events.length, head: events.at(-1).hash }, generatedAt: NOW });
  assert.equal(docket.status, "independent-review-protocol-admitted");
  assert.equal(docket.counts.verifiedExternalDuties, 7);
  assert.equal(docket.independentReviewExecutionReady, true);
  assert.equal(docket.independentReviewProtocolFrozen, true);
  assert.equal(docket.independentReviewComplete, false);
  assert.equal(docket.accuracyEstablished, false);
  assert.equal(docket.reliabilityEstablished, false);
  assert.equal(docket.clinicalValidation, false);
  assert.equal(docket.resultSubmissionApiAvailable, false);
});

test("admission fails closed on skipped duty, reused signature, altered claim, or stale upstream evidence", () => {
  const { registry, privateKeys } = registryFixture();
  const challengeEvent = createIndependentReviewAdmissionChallenge({ dossier, referenceDecision, clinicalStandard, registry, actor: "ADMISSION-QA", sequence: 1, createdAt: NOW });
  const skipped = signedAttestation({ purpose: INDEPENDENT_REVIEW_ADMISSION_PURPOSES[1], challenge: challengeEvent.challenge, registry, privateKey: privateKeys.get(INDEPENDENT_REVIEW_ADMISSION_PURPOSES[1]), prior: new Map(), index: 1 });
  assert.ok(validateIndependentReviewAdmissionAttestation(skipped, { challenge: challengeEvent.challenge, registry, now: NOW }).some(error => /must be verified in order/i.test(error)));
  const { events } = completeChain();
  assert.ok(validateIndependentReviewAdmissionEvent({ ...events.at(-1), independentReviewComplete: true }, { sequence: 8, previousHash: events.at(-2).hash }).some(error => /independentReviewComplete/i.test(error)));
  assert.ok(validateIndependentReviewAdmissionChallenge(challengeEvent.challenge, { dossier: { ...dossier, dossierFingerprint: HEX("9") } }).some(error => /stale/i.test(error)));
});

test("published admission schemas are strict and preserve the authority ceiling", async () => {
  const names = ["registry", "challenge", "attestation", "event"];
  const schemas = await Promise.all(names.map(name => readFile(new URL(`../schemas/independent-review-admission-${name}.schema.json`, import.meta.url), "utf8").then(JSON.parse)));
  assert.equal(schemas[0].additionalProperties, false);
  assert.equal(schemas[1].additionalProperties, false);
  assert.equal(schemas[2].additionalProperties, false);
  assert.equal(schemas[3].$defs.challengeEvent.additionalProperties, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.independentReviewComplete.const, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.clinicalValidation.const, false);
  assert.equal(INDEPENDENT_REVIEW_ADMISSION_CONTRACT, "perl-independent-review-admission-docket/1.0");
});
