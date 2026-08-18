import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import {
  COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT,
  COUNSELOR_REFERENCE_DECISION_CONTRACT,
  COUNSELOR_REFERENCE_DECISION_PURPOSES,
  buildCounselorReferenceDecisionDocket,
  canonicalCounselorReferenceDecisionJson,
  counselorReferenceDecisionDigest,
  createCounselorReferenceDecisionAttestationEvent,
  createCounselorReferenceDecisionChallenge,
  disabledCounselorReferenceDecisionRegistry,
  validateCounselorReferenceDecisionAttestation,
  validateCounselorReferenceDecisionEvent,
  validateCounselorReferenceDecisionRegistry
} from "../src/counselor-reference-decision.js";

const now = "2026-08-14T16:00:00.000Z";
const hash = label => counselorReferenceDecisionDigest({ label });
const boundary = () => ({
  evidenceFilesIncluded: false,
  humanNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  candidateProseIncluded: false,
  findingsContentIncluded: false,
  rawResponseContentIncluded: false,
  patientRecordsIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

function fixture() {
  const keys = new Map();
  const registryKeys = COUNSELOR_REFERENCE_DECISION_PURPOSES.map((purpose, index) => {
    const pair = generateKeyPairSync("ed25519");
    const keyId = `FF-REFERENCE-KEY-TEST-${index + 1}`;
    keys.set(purpose, { keyId, privateKey: pair.privateKey });
    return {
      keyId,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }),
      notBefore: "2026-08-01T00:00:00.000Z",
      notAfter: "2026-09-01T00:00:00.000Z"
    };
  });
  const registry = {
    contractVersion: "perl-counselor-reference-decision-registry/1.0",
    registryId: "FF-REFERENCE-REGISTRY-TEST",
    version: "1.0.0",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    keys: registryKeys
  };
  const draftHashes = [hash("A1"), hash("A2"), hash("B1"), hash("B2")];
  const dossierFingerprint = hash("dossier");
  const adjudicationHead = hash("adjudication-head");
  const referenceHead = hash("reference-head");
  const dossier = {
    dossierFingerprint,
    caseSet: { id: "perl-synthetic-case-set", version: "1.0.0" },
    counts: { developmentCases: 2, locallyComparableCases: 2 },
    cases: [
      { assessmentId: "FF-TEST-2407-A", sourceProfileHash: hash("source-a"), locallyComparable: true, candidates: [{ draftHash: draftHashes[0] }, { draftHash: draftHashes[1] }] },
      { assessmentId: "FF-TEST-2407-B", sourceProfileHash: hash("source-b"), locallyComparable: true, candidates: [{ draftHash: draftHashes[2] }, { draftHash: draftHashes[3] }] }
    ],
    history: [{ dossierFingerprint }],
    chain: { valid: true, count: 1, head: adjudicationHead },
    referenceDraftChain: { valid: true, count: 4, head: referenceHead }
  };
  const challengeEvent = createCounselorReferenceDecisionChallenge({
    dossier,
    adjudicationChainHead: adjudicationHead,
    referenceDraftChainHead: referenceHead,
    registry,
    actor: "RELEASE-STEWARD",
    sequence: 1,
    createdAt: now
  });
  return { registry, keys, dossier, draftHashes, challengeEvent };
}

function signedAttestation({ fixture: value, purpose, decision, index }) {
  const key = value.keys.get(purpose);
  const payload = {
    contractVersion: COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT,
    challengeId: value.challengeEvent.challenge.challengeId,
    dossierFingerprint: value.dossier.dossierFingerprint,
    registryFingerprint: counselorReferenceDecisionDigest(value.registry),
    keyId: key.keyId,
    attestationId: `FF-REFERENCE-ATTEST-TEST-${index}`,
    purpose,
    issuedAt: `2026-08-14T16:0${index}:00.000Z`,
    expiresAt: "2026-08-15T15:59:00.000Z",
    evidenceReferences: [`FF-EVIDENCE-REFERENCE-${index}`],
    decision,
    contentBoundary: boundary()
  };
  return {
    ...payload,
    signature: {
      algorithm: "Ed25519",
      keyId: key.keyId,
      value: sign(null, Buffer.from(canonicalCounselorReferenceDecisionJson(payload)), key.privateKey).toString("base64url")
    }
  };
}

function completeSequence(value) {
  const authorship = signedAttestation({ fixture: value, purpose: "reference-authorship-attestation", index: 1, decision: {
    candidateDraftHashes: [...value.draftHashes],
    distinctAuthorCount: 2,
    qualifiedAuthorsVerified: true,
    independenceVerified: true,
    conflictsReviewed: true,
    outcome: "verified"
  } });
  const language = signedAttestation({ fixture: value, purpose: "reference-language-safety-acceptance", index: 2, decision: {
    standardReferenceHash: hash("language-standard"),
    directReviewRouteAccepted: true,
    indicatorLanguageAccepted: true,
    diagnosticRestraintAccepted: true,
    uncertaintyStandardAccepted: true,
    outcome: "accepted"
  } });
  const adjudication = signedAttestation({ fixture: value, purpose: "reference-adjudication-decision", index: 3, decision: {
    caseDecisions: [
      { assessmentId: "FF-TEST-2407-A", disposition: "accepted-candidate", basisDraftHashes: [value.draftHashes[0]], acceptedReferenceHash: value.draftHashes[0], rationaleHash: hash("rationale-a"), dissentHashes: [hash("dissent-a")], dissentDisposition: "preserved" },
      { assessmentId: "FF-TEST-2407-B", disposition: "accepted-synthesis", basisDraftHashes: [value.draftHashes[2], value.draftHashes[3]], acceptedReferenceHash: hash("synthesis-b"), rationaleHash: hash("rationale-b"), dissentHashes: [hash("dissent-b")], dissentDisposition: "preserved" }
    ],
    allDisagreementsDispositioned: true,
    majorityVoteUsed: false,
    outcome: "accepted"
  } });
  const prior = new Map([
    [authorship.purpose, authorship],
    [language.purpose, language],
    [adjudication.purpose, adjudication]
  ]);
  const freeze = signedAttestation({ fixture: value, purpose: "reference-protocol-freeze", index: 4, decision: {
    authorshipAttestationFingerprint: counselorReferenceDecisionDigest(authorship),
    languageSafetyAttestationFingerprint: counselorReferenceDecisionDigest(language),
    adjudicationAttestationFingerprint: counselorReferenceDecisionDigest(adjudication),
    acceptedReferenceSetHash: hash("reference-set"),
    protocolHash: hash("protocol"),
    independentReviewHandoffHash: hash("independent-handoff"),
    frozen: true,
    independentReviewHandoffAccepted: true,
    outcome: "frozen-for-independent-review"
  } });
  return { authorship, language, adjudication, freeze, prior };
}

test("decision registry is disabled by default and requires four distinct purpose keys", () => {
  assert.deepEqual(validateCounselorReferenceDecisionRegistry(disabledCounselorReferenceDecisionRegistry()), []);
  const value = fixture();
  assert.deepEqual(validateCounselorReferenceDecisionRegistry(value.registry, { allowDisabled: false }), []);
  const repeated = structuredClone(value.registry);
  repeated.keys[1].publicKeyPem = repeated.keys[0].publicKeyPem;
  assert.match(validateCounselorReferenceDecisionRegistry(repeated).join(" "), /distinct keys/i);
});

test("four external duties can freeze an exact reference set without granting clinical authority", () => {
  const value = fixture();
  assert.equal(value.challengeEvent.contractVersion, COUNSELOR_REFERENCE_DECISION_CONTRACT);
  assert.deepEqual(validateCounselorReferenceDecisionEvent(value.challengeEvent, { sequence: 1, previousHash: "GENESIS" }), []);
  const sequence = completeSequence(value);
  const events = [value.challengeEvent];
  const prior = new Map();
  const seenAttestationIds = new Set();
  const seenSignatureHashes = new Set();
  const seenPurposes = new Set();
  let previousHash = value.challengeEvent.hash;
  for (const attestation of [sequence.authorship, sequence.language, sequence.adjudication, sequence.freeze]) {
    assert.deepEqual(validateCounselorReferenceDecisionAttestation(attestation, {
      challenge: value.challengeEvent.challenge,
      registry: value.registry,
      priorAttestations: prior,
      now: attestation.issuedAt,
      seenAttestationIds,
      seenSignatureHashes,
      seenPurposes
    }), []);
    const event = createCounselorReferenceDecisionAttestationEvent({
      attestation,
      registry: value.registry,
      actor: "RELEASE-STEWARD",
      sequence: events.length + 1,
      previousHash,
      verifiedAt: attestation.issuedAt
    });
    assert.deepEqual(validateCounselorReferenceDecisionEvent(event, {
      sequence: event.sequence,
      previousHash,
      registry: value.registry,
      challenge: value.challengeEvent.challenge,
      priorAttestations: prior,
      now: event.createdAt,
      seenAttestationIds,
      seenSignatureHashes,
      seenPurposes
    }), []);
    events.push(event);
    previousHash = event.hash;
    prior.set(attestation.purpose, attestation);
    seenAttestationIds.add(attestation.attestationId);
    seenSignatureHashes.add(counselorReferenceDecisionDigest(attestation.signature.value));
    seenPurposes.add(attestation.purpose);
  }
  const docket = buildCounselorReferenceDecisionDocket({ dossier: value.dossier, registry: value.registry, events, chain: { valid: true, count: events.length, head: previousHash }, generatedAt: "2026-08-14T16:05:00.000Z" });
  assert.equal(docket.status, "reference-protocol-frozen-for-independent-review");
  assert.equal(docket.counts.verifiedExternalDuties, 4);
  assert.equal(docket.counts.acceptedReferences, 2);
  assert.equal(docket.authorshipIndependenceVerified, true);
  assert.equal(docket.referenceSetAccepted, true);
  assert.equal(docket.protocolFrozen, true);
  assert.equal(docket.independentReviewHandoffReady, true);
  assert.equal(docket.clinicalValidation, false);
  assert.equal(docket.trialExecutionAuthorized, false);
  assert.equal(docket.productionReleaseAuthorized, false);
  assert.equal(docket.patientUseAuthorized, false);
  assert.equal(docket.signingApiAvailable, false);
});

test("freeze rejects missing prior duties, stale fingerprints, and signature tampering", () => {
  const value = fixture();
  const sequence = completeSequence(value);
  assert.match(validateCounselorReferenceDecisionAttestation(sequence.freeze, {
    challenge: value.challengeEvent.challenge,
    registry: value.registry,
    now: sequence.freeze.issuedAt
  }).join(" "), /three earlier verified duties/i);
  const stale = structuredClone(sequence.freeze);
  stale.decision.adjudicationAttestationFingerprint = hash("stale");
  assert.match(validateCounselorReferenceDecisionAttestation(stale, {
    challenge: value.challengeEvent.challenge,
    registry: value.registry,
    priorAttestations: sequence.prior,
    now: stale.issuedAt
  }).join(" "), /adjudication fingerprint is stale/i);
  const tampered = structuredClone(sequence.authorship);
  tampered.decision.distinctAuthorCount = 3;
  assert.match(validateCounselorReferenceDecisionAttestation(tampered, {
    challenge: value.challengeEvent.challenge,
    registry: value.registry,
    now: tampered.issuedAt
  }).join(" "), /signature is invalid/i);
});

test("default docket is visibly blocked and cannot borrow authority from local draft counts", () => {
  const value = fixture();
  const dossier = structuredClone(value.dossier);
  dossier.cases[1].locallyComparable = false;
  dossier.counts.locallyComparableCases = 1;
  const docket = buildCounselorReferenceDecisionDocket({ dossier, registry: disabledCounselorReferenceDecisionRegistry(), generatedAt: now });
  assert.equal(docket.status, "sealed-adjudication-required");
  assert.equal(docket.localEvidenceReady, false);
  assert.equal(docket.counts.verifiedExternalDuties, 0);
  assert.equal(docket.referenceSetAccepted, false);
  assert.equal(docket.protocolFrozen, false);
});

test("published decision schemas fix four duties, denied content, and denied clinical authority", async () => {
  const load = async name => JSON.parse(await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8"));
  const registry = await load("counselor-reference-decision-registry.schema.json");
  const challenge = await load("counselor-reference-decision-challenge.schema.json");
  const attestation = await load("counselor-reference-decision-attestation.schema.json");
  const event = await load("counselor-reference-decision-event.schema.json");
  assert.equal(registry.additionalProperties, false);
  assert.equal(registry.properties.contractVersion.const, "perl-counselor-reference-decision-registry/1.0");
  assert.equal(challenge.properties.requiredPurposeOrder.minItems, 4);
  assert.equal(challenge.properties.contentBoundary.$ref, "#/$defs/boundary");
  assert.equal(challenge.$defs.boundary.properties.candidateProseIncluded.const, false);
  assert.equal(attestation.properties.decision.oneOf.length, 4);
  assert.equal(attestation.$defs.adjudicationDecision.properties.majorityVoteUsed.const, false);
  assert.equal(attestation.$defs.caseDecision.properties.dissentDisposition.const, "preserved");
  assert.equal(event.oneOf.length, 2);
  assert.equal(event.$defs.attestationEvent.properties.clinicalValidation.const, false);
  assert.equal(event.$defs.attestationEvent.properties.patientUseAuthorized.const, false);
});

test("schema-44 preserves decision history and fails startup closed after authority tampering", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-reference-decision-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "state.json");
  const value = fixture();
  const sequence = completeSequence(value);
  const authorshipEvent = createCounselorReferenceDecisionAttestationEvent({
    attestation: sequence.authorship,
    registry: value.registry,
    actor: "REFERENCE-QA",
    sequence: 2,
    previousHash: value.challengeEvent.hash,
    verifiedAt: sequence.authorship.issuedAt
  });
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider(), counselorReferenceDecisionRegistry: value.registry, clock: () => new Date(now) });
  const store = make();
  await store.init();
  store.state.counselorReferenceDecisionEvents = [value.challengeEvent, authorshipEvent];
  await store.persist();
  const reopened = make();
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.deepEqual(reopened.state.campusObservatoryEvents, []);
  assert.equal(reopened.verifyCounselorReferenceDecisionChain().valid, true);
  assert.equal(reopened.verifyCounselorReferenceDecisionChain().verifiedAttestations, 1);

  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  persisted.counselorReferenceDecisionEvents[1].clinicalValidation = true;
  await writeFile(filePath, JSON.stringify(persisted, null, 2) + "\n", "utf8");
  await assert.rejects(() => make().init(), /Counselor reference decision history integrity check failed/i);
});
