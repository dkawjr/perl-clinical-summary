import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createPerlServer } from "../server.mjs";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import {
  AUTHORITY_TRUST_RECEIPT_CONTRACT,
  AUTHORITY_TRUST_REGISTRY_CONTRACT,
  AUTHORITY_TRUST_SCOPES,
  authorityTrustReceiptSigningPayload,
  authorityTrustRegistryFingerprint
} from "../src/authority-trust.js";
import {
  PILOT_START_ACK_CONTRACT,
  PILOT_START_ORDER_CONTRACT,
  PILOT_START_REGISTRY_CONTRACT,
  pilotStartAcknowledgementSigningPayload,
  pilotStartOrderSigningPayload,
  pilotStartRegistryFingerprint
} from "../src/pilot-start.js";
import {
  CLINICAL_RELEASE_BOUNDARY,
  CLINICAL_RELEASE_CONTRACT,
  CLINICAL_RELEASE_REGISTRY_CONTRACT,
  CLINICAL_RELEASE_CHALLENGE_CONTRACT,
  CLINICAL_USE_AUTHORIZATION_CONTRACT,
  PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT,
  RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT,
  buildClinicalReleaseGate,
  clinicalReleaseRegistryFingerprint,
  clinicalUseAuthorizationSigningPayload,
  createClinicalReleaseChallenge,
  createClinicalUseAuthorizationEvent,
  createProductionReleaseAuthorizationEvent,
  createReleaseDeploymentAttestationEvent,
  disabledClinicalReleaseRegistry,
  productionReleaseAuthorizationSigningPayload,
  releaseDeploymentAttestationSigningPayload,
  validateClinicalReleaseChallenge,
  validateClinicalReleaseEvent,
  validateClinicalReleaseRegistry,
  validateClinicalUseAuthorization,
  validateProductionReleaseAuthorization,
  validateReleaseDeploymentAttestation
} from "../src/clinical-release.js";
import {
  FIRST_GOVERNED_TRANSACTION_CONTRACT,
  TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
  TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
  firstGovernedTransactionSigningPayload,
  trafficActivationAuthorizationSigningPayload,
  trafficActivationPlanFingerprint,
  trafficActivationRegistryFingerprint
} from "../src/traffic-activation.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const BOUNDARY = {
  evidenceFilesIncluded: false,
  humanNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  patientRecordsIncluded: false,
  findingsContentIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
};
const TRAFFIC_BOUNDARY = {
  evidenceFilesIncluded: false,
  humanNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  patientRecordContentIncluded: false,
  directIdentifiersIncluded: false,
  findingsContentIncluded: false,
  phiIncluded: false,
  endpointOrCredentialIncluded: false,
  perlExternalTransmissionPerformed: false
};

function fixture() {
  const clinicalKeys = generateKeyPairSync("ed25519");
  const productionKeys = generateKeyPairSync("ed25519");
  const attestationKeys = generateKeyPairSync("ed25519");
  const registry = {
    contractVersion: CLINICAL_RELEASE_REGISTRY_CONTRACT,
    registryId: "FF-RELEASE-REGISTRY-QA-2026",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [
      { keyId: "FF-RELEASE-KEY-CLINICAL-QA", algorithm: "Ed25519", purpose: "clinical-use-authorization", publicKeyPem: clinicalKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-RELEASE-KEY-PRODUCTION-QA", algorithm: "Ed25519", purpose: "production-release-authorization", publicKeyPem: productionKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-RELEASE-KEY-ATTEST-QA", algorithm: "Ed25519", purpose: "release-deployment-attestation", publicKeyPem: attestationKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] }
    ]
  };
  const authorityCandidate = { candidate: { id: "north-central-counseling-center", index: "01", label: "North Central University", setting: "Counseling-center candidate" }, dossierFingerprint: HASH_A, counts: { satisfiedScopes: 36 }, pilotAuthorizationRecorded: true };
  const authorityTrust = { bridgeFingerprint: HASH_B, candidates: [authorityCandidate] };
  const preparationAcknowledgement = { deployment: { environmentId: "eqpass-azure-pilot", tenantRef: "ncu-counseling", releaseId: "perl-release-2026.08.14", artifactDigest: HASH_C, configurationDigest: HASH_D }, status: "started" };
  const pilotStart = { controlFingerprint: HASH_C, chain: { head: HASH_D }, history: [{ eventType: "deployment-start-acknowledged", acknowledgement: { candidateId: "north-central-counseling-center", ...preparationAcknowledgement }, acknowledgementFingerprint: HASH_E }], candidates: [{ candidate: authorityCandidate.candidate, providerPreparationStarted: true, currentAcknowledgement: preparationAcknowledgement }] };
  const continuity = { allCurrent: true, continuityFingerprint: HASH_E };
  const challengeEvent = createClinicalReleaseChallenge({
    candidate: authorityCandidate,
    authorityBridgeFingerprint: authorityTrust.bridgeFingerprint,
    pilotStartProof: { controlFingerprint: pilotStart.controlFingerprint, chainHead: pilotStart.chain.head, acknowledgementFingerprint: HASH_E },
    continuityFingerprint: continuity.continuityFingerprint,
    registry,
    actor: "RELEASE-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: NOW,
    id: "11111111-1111-4111-8111-111111111111",
    challengeId: "FF-RELEASE-CHALLENGE-11111111-1111-4111-8111-111111111111",
    nonce: "A".repeat(43)
  });
  return { registry, clinicalKeys, productionKeys, attestationKeys, authorityCandidate, authorityTrust, pilotStart, continuity, challengeEvent };
}

function clinicalAuthorization(context, overrides = {}) {
  const challenge = context.challengeEvent.challenge;
  const authorization = {
    contractVersion: CLINICAL_USE_AUTHORIZATION_CONTRACT,
    challengeId: challenge.challengeId,
    candidateId: challenge.candidateId,
    dossierFingerprint: challenge.dossierFingerprint,
    registryFingerprint: clinicalReleaseRegistryFingerprint(context.registry),
    keyId: "FF-RELEASE-KEY-CLINICAL-QA",
    authorizationId: "FF-CLINICAL-AUTH-QA-0001",
    issuedAt: "2026-08-14T12:01:00.000Z",
    expiresAt: "2026-08-14T12:19:00.000Z",
    useWindow: { notBefore: "2026-08-14T12:00:00.000Z", notAfter: "2027-05-31T23:59:59.000Z" },
    scope: { settingRef: "ncu-counseling-center", populationRef: "ncu-current-students", maximumRecords: 50, purpose: "provider-reviewed-quality-improvement", allowedAudience: "licensed-clinical-provider", clinicalUseAuthorized: true, patientUseAuthorized: true, autonomousClinicalDecisionAllowed: false, diagnosticUseAllowed: false, scoringByPerlAllowed: false, findingsModificationAllowed: false },
    evidenceReferences: { intendedUse: HASH_A, language: HASH_B, clinicalStandard: HASH_C, independentReview: HASH_D, eqpassContract: HASH_E, privacySecurity: HASH_A, accessibility: HASH_B },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-RELEASE-KEY-CLINICAL-QA", value: "" },
    ...overrides
  };
  authorization.signature.value = sign(null, Buffer.from(clinicalUseAuthorizationSigningPayload(authorization)), context.clinicalKeys.privateKey).toString("base64url");
  return authorization;
}

function productionAuthorization(context, clinicalEvent, overrides = {}) {
  const challenge = context.challengeEvent.challenge;
  const authorization = {
    contractVersion: PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT,
    challengeId: challenge.challengeId,
    candidateId: challenge.candidateId,
    registryFingerprint: clinicalReleaseRegistryFingerprint(context.registry),
    keyId: "FF-RELEASE-KEY-PRODUCTION-QA",
    authorizationId: "FF-PRODUCTION-AUTH-QA-0001",
    clinicalAuthorizationId: clinicalEvent.clinicalAuthorization.authorizationId,
    clinicalAuthorizationFingerprint: clinicalEvent.clinicalAuthorizationFingerprint,
    issuedAt: "2026-08-14T12:03:00.000Z",
    expiresAt: "2026-08-14T12:19:00.000Z",
    deployment: { environmentId: "eqpass-azure-pilot", tenantRef: "ncu-counseling", releaseId: "perl-release-2026.08.14", artifactDigest: HASH_C, configurationDigest: HASH_D },
    controlReferences: { securityApproval: HASH_A, privacyApproval: HASH_B, eqpassOwnerApproval: HASH_C, rollbackEvidence: HASH_D, monitoringEvidence: HASH_E, incidentResponseEvidence: HASH_A },
    releaseState: { productionReleaseAuthorized: true, patientUseAuthorityConfirmed: true, clinicalTrafficEnabled: false, pilotStarted: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-RELEASE-KEY-PRODUCTION-QA", value: "" },
    ...overrides
  };
  authorization.signature.value = sign(null, Buffer.from(productionReleaseAuthorizationSigningPayload(authorization)), context.productionKeys.privateKey).toString("base64url");
  return authorization;
}

function deploymentAttestation(context, clinicalEvent, productionEvent, overrides = {}) {
  const attestation = {
    contractVersion: RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT,
    challengeId: context.challengeEvent.challenge.challengeId,
    candidateId: context.challengeEvent.challenge.candidateId,
    registryFingerprint: clinicalReleaseRegistryFingerprint(context.registry),
    keyId: "FF-RELEASE-KEY-ATTEST-QA",
    attestationId: "FF-RELEASE-ATTEST-QA-0001",
    clinicalAuthorizationFingerprint: clinicalEvent.clinicalAuthorizationFingerprint,
    productionAuthorizationFingerprint: productionEvent.productionAuthorizationFingerprint,
    observedAt: "2026-08-14T12:05:00.000Z",
    deployment: structuredClone(productionEvent.productionAuthorization.deployment),
    controlChecks: { artifactMatched: true, configurationMatched: true, identityAccessReady: true, continuousMonitoringReady: true, encryptedBackupReady: true, incidentRoutesReady: true, auditRetentionReady: true, rollbackReady: true },
    releaseState: { deploymentVerified: true, releaseReadyForTrafficActivation: true, clinicalTrafficEnabled: false, patientRecordsProcessed: false, pilotStarted: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-RELEASE-KEY-ATTEST-QA", value: "" },
    ...overrides
  };
  attestation.signature.value = sign(null, Buffer.from(releaseDeploymentAttestationSigningPayload(attestation)), context.attestationKeys.privateKey).toString("base64url");
  return attestation;
}

test("clinical-release registry defaults disabled and enforces three distinct duties", () => {
  assert.deepEqual(validateClinicalReleaseRegistry(disabledClinicalReleaseRegistry()), []);
  const context = fixture();
  assert.deepEqual(validateClinicalReleaseRegistry(context.registry, { allowDisabled: false }), []);
  const reused = structuredClone(context.registry);
  reused.keys[2].publicKeyPem = reused.keys[0].publicKeyPem;
  assert.ok(validateClinicalReleaseRegistry(reused).some(error => /all three release duties require distinct keys/i.test(error)));
  assert.match(CLINICAL_RELEASE_BOUNDARY, /later external traffic-activation control/i);
});

test("release challenge binds authority, provider preparation, continuity, registry, and an exact 20-minute window", () => {
  const context = fixture();
  const challenge = context.challengeEvent.challenge;
  assert.equal(challenge.contractVersion, CLINICAL_RELEASE_CHALLENGE_CONTRACT);
  assert.equal(Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt), 20 * 60 * 1000);
  assert.deepEqual(validateClinicalReleaseChallenge(challenge), []);
  assert.deepEqual(validateClinicalReleaseEvent(context.challengeEvent), []);
  const stale = structuredClone(challenge);
  stale.pilotStartChainHead = HASH_A;
  assert.ok(validateClinicalReleaseChallenge(stale, { pilotStartProof: { controlFingerprint: HASH_C, chainHead: HASH_D, acknowledgementFingerprint: HASH_E } }).some(error => /provider-preparation proof/i.test(error)));
});

test("clinical authorization is provider-first, evidence-bound, time-bounded, and signed", () => {
  const context = fixture();
  const authorization = clinicalAuthorization(context);
  assert.deepEqual(validateClinicalUseAuthorization(authorization, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:02:00.000Z" }), []);
  const diagnostic = clinicalAuthorization(context, { scope: { ...authorization.scope, diagnosticUseAllowed: true } });
  assert.ok(validateClinicalUseAuthorization(diagnostic, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:02:00.000Z" }).some(error => /diagnosticUseAllowed must remain false/i.test(error)));
  const tampered = structuredClone(authorization);
  tampered.scope.maximumRecords = 500;
  assert.ok(validateClinicalUseAuthorization(tampered, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:02:00.000Z" }).some(error => /signature is invalid/i.test(error)));
});

test("production authorization requires the verified clinical authorization while traffic stays off", () => {
  const context = fixture();
  const clinical = clinicalAuthorization(context);
  const clinicalEvent = createClinicalUseAuthorizationEvent({ authorization: clinical, registry: context.registry, actor: "RELEASE-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:02:00.000Z", id: "22222222-2222-4222-8222-222222222222" });
  assert.deepEqual(validateClinicalReleaseEvent(clinicalEvent, { registry: context.registry, challenge: context.challengeEvent.challenge }), []);
  const production = productionAuthorization(context, clinicalEvent);
  assert.deepEqual(validateProductionReleaseAuthorization(production, { challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, registry: context.registry, now: "2026-08-14T12:04:00.000Z" }), []);
  const traffic = productionAuthorization(context, clinicalEvent, { releaseState: { ...production.releaseState, clinicalTrafficEnabled: true } });
  assert.ok(validateProductionReleaseAuthorization(traffic, { challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, registry: context.registry, now: "2026-08-14T12:04:00.000Z" }).some(error => /keeping traffic and pilot start false/i.test(error)));
});

test("deployment attestation verifies eight controls but cannot activate traffic or start the pilot", () => {
  const context = fixture();
  const clinical = clinicalAuthorization(context);
  const clinicalEvent = createClinicalUseAuthorizationEvent({ authorization: clinical, registry: context.registry, actor: "RELEASE-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:02:00.000Z", id: "22222222-2222-4222-8222-222222222222" });
  const production = productionAuthorization(context, clinicalEvent);
  const productionEvent = createProductionReleaseAuthorizationEvent({ authorization: production, registry: context.registry, actor: "RELEASE-QA", sequence: 3, previousHash: clinicalEvent.hash, verifiedAt: "2026-08-14T12:04:00.000Z", id: "33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(validateClinicalReleaseEvent(productionEvent, { registry: context.registry, challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical }), []);
  const attestation = deploymentAttestation(context, clinicalEvent, productionEvent);
  assert.deepEqual(validateReleaseDeploymentAttestation(attestation, { challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, productionAuthorization: production, registry: context.registry, now: "2026-08-14T12:06:00.000Z" }), []);
  const event = createReleaseDeploymentAttestationEvent({ attestation, registry: context.registry, actor: "RELEASE-QA", sequence: 4, previousHash: productionEvent.hash, verifiedAt: "2026-08-14T12:06:00.000Z", id: "44444444-4444-4444-8444-444444444444" });
  assert.deepEqual(validateClinicalReleaseEvent(event, { registry: context.registry, challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, productionAuthorization: production }), []);
  const gate = buildClinicalReleaseGate({ authorityTrust: context.authorityTrust, pilotStart: context.pilotStart, continuity: context.continuity, registry: context.registry, events: [context.challengeEvent, clinicalEvent, productionEvent, event], chain: { valid: true, count: 4, head: event.hash }, generatedAt: "2026-08-14T12:07:00.000Z" });
  assert.equal(gate.contractVersion, CLINICAL_RELEASE_CONTRACT);
  assert.equal(gate.releaseReadyForTrafficActivation, true);
  assert.equal(gate.clinicalUseAuthorized, true);
  assert.equal(gate.patientUseAuthorized, true);
  assert.equal(gate.productionReleaseAuthorized, true);
  assert.equal(gate.deploymentVerified, true);
  assert.equal(gate.clinicalTrafficEnabled, false);
  assert.equal(gate.pilotStarted, false);
});

test("store persists the complete authority-to-first-transaction chain and fails startup after tampering", async t => {
  const release = fixture();
  const authorityKeys = generateKeyPairSync("ed25519");
  const orderKeys = generateKeyPairSync("ed25519");
  const acknowledgementKeys = generateKeyPairSync("ed25519");
  const trafficClinicalKeys = generateKeyPairSync("ed25519");
  const trafficOperationsKeys = generateKeyPairSync("ed25519");
  const trafficObserverKeys = generateKeyPairSync("ed25519");
  const authorityRegistry = {
    contractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
    registryId: "FF-TRUST-REGISTRY-RELEASE-QA",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [{ keyId: "FF-TRUST-KEY-RELEASE-QA", algorithm: "Ed25519", publicKeyPem: authorityKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"], scopes: AUTHORITY_TRUST_SCOPES.map(item => item.scope) }]
  };
  const pilotRegistry = {
    contractVersion: PILOT_START_REGISTRY_CONTRACT,
    registryId: "FF-START-REGISTRY-RELEASE-QA",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [
      { keyId: "FF-START-KEY-ORDER-RELEASE-QA", algorithm: "Ed25519", purpose: "pilot-start-order", publicKeyPem: orderKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-START-KEY-ACK-RELEASE-QA", algorithm: "Ed25519", purpose: "deployment-start-acknowledgement", publicKeyPem: acknowledgementKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] }
    ]
  };
  const trafficRegistry = {
    contractVersion: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
    registryId: "FF-TRAFFIC-REGISTRY-RELEASE-QA",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [
      { keyId: "FF-TRAFFIC-KEY-CLINICAL-RELEASE-QA", algorithm: "Ed25519", purpose: "clinical-traffic-activation-clinical", publicKeyPem: trafficClinicalKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-TRAFFIC-KEY-OPERATIONS-RELEASE-QA", algorithm: "Ed25519", purpose: "clinical-traffic-activation-operations", publicKeyPem: trafficOperationsKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-TRAFFIC-KEY-OBSERVER-RELEASE-QA", algorithm: "Ed25519", purpose: "first-governed-transaction-attestation", publicKeyPem: trafficObserverKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] }
    ]
  };
  const directory = await mkdtemp(join(tmpdir(), "perl-clinical-release-store-"));
  const filePath = join(directory, "state.json");
  let clockValue = "2026-08-14T12:00:00.000Z";
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider(), authorityTrustRegistry: authorityRegistry, pilotStartRegistry: pilotRegistry, clinicalReleaseRegistry: release.registry, trafficActivationRegistry: trafficRegistry, clock: () => new Date(clockValue) });
  const store = make();
  await store.init();
  await store.rehearseRecovery("RELEASE-STORE-QA");
  await store.rehearseRollbackCompatibility("RELEASE-STORE-QA");
  await store.recordOperationalMonitoringSnapshot("RELEASE-STORE-QA");
  await store.rehearseIncidentResponse("critical-safety-routing", "RELEASE-STORE-QA");

  const trustChallenge = await store.issueAuthorityTrustChallenge("north-central-counseling-center", "RELEASE-STORE-QA");
  const receipt = {
    contractVersion: AUTHORITY_TRUST_RECEIPT_CONTRACT,
    challengeId: trustChallenge.challenge.challengeId,
    candidateId: trustChallenge.challenge.candidateId,
    dossierFingerprint: trustChallenge.challenge.dossierFingerprint,
    registryFingerprint: authorityTrustRegistryFingerprint(authorityRegistry),
    keyId: "FF-TRUST-KEY-RELEASE-QA",
    receiptId: "FF-TRUST-RECEIPT-RELEASE-QA-0001",
    issuedAt: "2026-08-14T12:01:00.000Z",
    expiresAt: "2026-08-15T11:59:00.000Z",
    assertions: AUTHORITY_TRUST_SCOPES.map(item => ({ scope: item.scope, outcome: item.requiredOutcome, referenceHash: HASH_A })),
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-TRUST-KEY-RELEASE-QA", value: "" }
  };
  receipt.signature.value = sign(null, Buffer.from(authorityTrustReceiptSigningPayload(receipt)), authorityKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:02:00.000Z";
  await store.verifyAuthorityTrustReceipt(receipt, "RELEASE-STORE-QA");

  clockValue = "2026-08-14T12:03:00.000Z";
  const startChallenge = await store.issuePilotStartChallenge("north-central-counseling-center", "RELEASE-STORE-QA");
  const order = {
    contractVersion: PILOT_START_ORDER_CONTRACT,
    challengeId: startChallenge.challenge.challengeId,
    candidateId: startChallenge.challenge.candidateId,
    dossierFingerprint: startChallenge.challenge.dossierFingerprint,
    authorityBridgeFingerprint: startChallenge.challenge.authorityBridgeFingerprint,
    registryFingerprint: pilotStartRegistryFingerprint(pilotRegistry),
    continuityFingerprint: startChallenge.challenge.continuityFingerprint,
    keyId: "FF-START-KEY-ORDER-RELEASE-QA",
    orderId: "FF-START-ORDER-RELEASE-QA-0001",
    issuedAt: "2026-08-14T12:04:00.000Z",
    expiresAt: "2026-08-14T12:17:00.000Z",
    startWindow: { notBefore: "2026-08-14T12:05:00.000Z", notAfter: "2026-08-14T12:10:00.000Z" },
    deployment: { environmentId: "eqpass-azure-pilot", tenantRef: "ncu-counseling", releaseId: "perl-release-2026.08.14", artifactDigest: HASH_C, configurationDigest: HASH_D },
    operatingConditions: { trainingAndObjectivesCompleted: true, quarterlyReviewsAccepted: true, stopAuthorityAssigned: true, supportOwnerAssigned: true, clinicalTrafficEnabled: false, patientUseEnabled: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-START-KEY-ORDER-RELEASE-QA", value: "" }
  };
  order.signature.value = sign(null, Buffer.from(pilotStartOrderSigningPayload(order)), orderKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:04:30.000Z";
  const verifiedOrder = await store.verifyPilotStartOrder(order, "RELEASE-STORE-QA");
  const acknowledgement = {
    contractVersion: PILOT_START_ACK_CONTRACT,
    challengeId: order.challengeId,
    candidateId: order.candidateId,
    registryFingerprint: order.registryFingerprint,
    keyId: "FF-START-KEY-ACK-RELEASE-QA",
    acknowledgementId: "FF-START-ACK-RELEASE-QA-0001",
    orderId: order.orderId,
    orderFingerprint: verifiedOrder.event.orderFingerprint,
    observedAt: "2026-08-14T12:06:00.000Z",
    deployment: structuredClone(order.deployment),
    status: "started",
    launchState: { providerPreparationEnvironmentStarted: true, clinicalTrafficEnabled: false, patientUseEnabled: false, productionReleaseAuthorized: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-START-KEY-ACK-RELEASE-QA", value: "" }
  };
  acknowledgement.signature.value = sign(null, Buffer.from(pilotStartAcknowledgementSigningPayload(acknowledgement)), acknowledgementKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:06:30.000Z";
  await store.verifyPilotStartAcknowledgement(acknowledgement, "RELEASE-STORE-QA");

  clockValue = "2026-08-14T12:07:00.000Z";
  const releaseChallenge = await store.issueClinicalReleaseChallenge("north-central-counseling-center", "RELEASE-STORE-QA");
  const releaseContext = { ...release, challengeEvent: releaseChallenge.event };
  const clinical = clinicalAuthorization(releaseContext, { issuedAt: "2026-08-14T12:08:00.000Z", expiresAt: "2026-08-14T12:26:00.000Z" });
  clockValue = "2026-08-14T12:08:30.000Z";
  const verifiedClinical = await store.verifyClinicalUseAuthorization(clinical, "RELEASE-STORE-QA");
  const production = productionAuthorization(releaseContext, verifiedClinical.event, { issuedAt: "2026-08-14T12:09:00.000Z", expiresAt: "2026-08-14T12:26:00.000Z" });
  clockValue = "2026-08-14T12:09:30.000Z";
  const verifiedProduction = await store.verifyProductionReleaseAuthorization(production, "RELEASE-STORE-QA");
  const wrongDeployment = productionAuthorization(releaseContext, verifiedClinical.event, {
    authorizationId: "FF-PRODUCTION-AUTH-RELEASE-QA-WRONG-DEPLOYMENT",
    issuedAt: "2026-08-14T12:09:15.000Z",
    expiresAt: "2026-08-14T12:26:00.000Z",
    deployment: { ...production.deployment, releaseId: "perl-release-wrong" }
  });
  await assert.rejects(() => store.verifyProductionReleaseAuthorization(wrongDeployment, "RELEASE-STORE-QA"), error => error.status === 400 && /provider-preparation deployment/i.test(error.message));
  const attestation = deploymentAttestation(releaseContext, verifiedClinical.event, verifiedProduction.event, { observedAt: "2026-08-14T12:10:00.000Z" });
  clockValue = "2026-08-14T12:10:30.000Z";
  const verifiedAttestation = await store.verifyReleaseDeploymentAttestation(attestation, "RELEASE-STORE-QA");
  assert.equal(verifiedAttestation.clinicalRelease.chain.valid, true);
  assert.equal(verifiedAttestation.clinicalRelease.chain.count, 4);
  assert.equal(verifiedAttestation.clinicalRelease.releaseReadyForTrafficActivation, true);
  assert.equal(verifiedAttestation.clinicalRelease.clinicalUseAuthorized, true);
  assert.equal(verifiedAttestation.clinicalRelease.patientUseAuthorized, true);
  assert.equal(verifiedAttestation.clinicalRelease.productionReleaseAuthorized, true);
  assert.equal(verifiedAttestation.clinicalRelease.deploymentVerified, true);
  assert.equal(verifiedAttestation.clinicalRelease.clinicalTrafficEnabled, false);
  assert.equal(verifiedAttestation.clinicalRelease.pilotStarted, false);

  clockValue = "2026-08-14T12:11:00.000Z";
  const trafficChallenge = await store.issueTrafficActivationChallenge("north-central-counseling-center", "RELEASE-STORE-QA");
  const activationPlan = {
    challengeId: trafficChallenge.challenge.challengeId,
    candidateId: trafficChallenge.challenge.candidateId,
    registryFingerprint: trafficActivationRegistryFingerprint(trafficRegistry),
    releaseGateFingerprint: trafficChallenge.challenge.releaseGateFingerprint,
    expiresAt: "2026-08-14T12:24:00.000Z",
    activationWindow: { notBefore: "2026-08-14T12:15:00.000Z", notAfter: "2026-08-14T16:15:00.000Z" },
    deployment: structuredClone(attestation.deployment),
    endpointBindings: { connectionProfileRef: "eqpass-private-traffic-v1", endpointIdentityFingerprint: HASH_A, rolePolicyFingerprint: HASH_B, tenantIsolationFingerprint: HASH_C },
    controlReferences: { releaseEvidence: HASH_A, clinicalStopAuthority: HASH_B, monitoring: HASH_C, backup: HASH_D, incidentRoutes: HASH_E, rollback: HASH_A, identityAccess: HASH_B, minimumNecessary: HASH_C },
    authorityState: { externalTrafficActivationAuthorized: true, perlSandboxControlsTraffic: false, perlSandboxReceivesPatientRecords: false, autonomousClinicalDecisionAllowed: false },
    contentBoundary: structuredClone(TRAFFIC_BOUNDARY)
  };
  const clinicalTrafficAuthorization = {
    contractVersion: TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
    ...activationPlan,
    keyId: "FF-TRAFFIC-KEY-CLINICAL-RELEASE-QA",
    authorizationId: "FF-TRAFFIC-AUTH-CLINICAL-RELEASE-QA-0001",
    duty: "clinical-traffic-activation-clinical",
    issuedAt: "2026-08-14T12:12:00.000Z",
    signature: { algorithm: "Ed25519", keyId: "FF-TRAFFIC-KEY-CLINICAL-RELEASE-QA", value: "" }
  };
  clinicalTrafficAuthorization.signature.value = sign(null, Buffer.from(trafficActivationAuthorizationSigningPayload(clinicalTrafficAuthorization)), trafficClinicalKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:12:30.000Z";
  const verifiedTrafficClinical = await store.verifyClinicalTrafficAuthorization(clinicalTrafficAuthorization, "RELEASE-STORE-QA");
  const operationsTrafficAuthorization = {
    contractVersion: TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
    ...activationPlan,
    keyId: "FF-TRAFFIC-KEY-OPERATIONS-RELEASE-QA",
    authorizationId: "FF-TRAFFIC-AUTH-OPERATIONS-RELEASE-QA-0001",
    duty: "clinical-traffic-activation-operations",
    issuedAt: "2026-08-14T12:13:00.000Z",
    signature: { algorithm: "Ed25519", keyId: "FF-TRAFFIC-KEY-OPERATIONS-RELEASE-QA", value: "" }
  };
  operationsTrafficAuthorization.signature.value = sign(null, Buffer.from(trafficActivationAuthorizationSigningPayload(operationsTrafficAuthorization)), trafficOperationsKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:13:30.000Z";
  const verifiedTrafficOperations = await store.verifyOperationsTrafficAuthorization(operationsTrafficAuthorization, "RELEASE-STORE-QA");
  const firstTransactionAttestation = {
    contractVersion: FIRST_GOVERNED_TRANSACTION_CONTRACT,
    challengeId: trafficChallenge.challenge.challengeId,
    candidateId: trafficChallenge.challenge.candidateId,
    registryFingerprint: trafficActivationRegistryFingerprint(trafficRegistry),
    keyId: "FF-TRAFFIC-KEY-OBSERVER-RELEASE-QA",
    attestationId: "FF-FIRST-TXN-ATTEST-RELEASE-QA-0001",
    clinicalAuthorizationFingerprint: verifiedTrafficClinical.event.authorizationFingerprint,
    operationsAuthorizationFingerprint: verifiedTrafficOperations.event.authorizationFingerprint,
    activationPlanFingerprint: trafficActivationPlanFingerprint(clinicalTrafficAuthorization),
    observedAt: "2026-08-14T12:16:00.000Z",
    deployment: structuredClone(attestation.deployment),
    transactionReferences: { sourceEventReceipt: HASH_A, findingsReport: HASH_B, summaryArtifact: HASH_C, remoteAcknowledgement: HASH_D, auditRecord: HASH_E },
    controlChecks: { authenticatedRole: true, namedSiteScope: true, minimumNecessary: true, scoringUpstream: true, findingsUnchanged: true, humanReviewCompleted: true, criticalRoutingVerified: true, remoteAttachmentAcknowledged: true, auditCommitted: true },
    transactionState: { externalClinicalTrafficObserved: true, firstGovernedTransactionObserved: true, safetyDisposition: "routine-review", perlSandboxReceivedRecord: false, perlSandboxStoredPhi: false, autonomousClinicalDecision: false },
    contentBoundary: structuredClone(TRAFFIC_BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-TRAFFIC-KEY-OBSERVER-RELEASE-QA", value: "" }
  };
  firstTransactionAttestation.signature.value = sign(null, Buffer.from(firstGovernedTransactionSigningPayload(firstTransactionAttestation)), trafficObserverKeys.privateKey).toString("base64url");
  clockValue = "2026-08-14T12:16:30.000Z";
  const verifiedFirstTransaction = await store.verifyFirstGovernedTransactionAttestation(firstTransactionAttestation, "RELEASE-STORE-QA");
  assert.equal(verifiedFirstTransaction.trafficActivation.firstGovernedTransactionVerified, true);
  assert.equal(verifiedFirstTransaction.trafficActivation.externalClinicalTrafficObserved, true);
  assert.equal(verifiedFirstTransaction.trafficActivation.perlSandboxTrafficEnabled, false);
  assert.equal(verifiedFirstTransaction.trafficActivation.perlSandboxPatientRecordsProcessed, false);
  assert.equal(verifiedFirstTransaction.trafficActivation.phiStored, false);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyClinicalReleaseEventChain().valid, true);
  assert.equal(reopened.verifyTrafficActivationEventChain().valid, true);
  assert.equal((await reopened.clinicalReleaseStatus()).releaseReadyForTrafficActivation, true);
  assert.equal((await reopened.trafficActivationStatus()).firstGovernedTransactionVerified, true);
  const state = JSON.parse(await readFile(filePath, "utf8"));
  const pristine = structuredClone(state);
  state.clinicalReleaseEvents[3].deploymentAttestation.releaseState.clinicalTrafficEnabled = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /clinical-release gate history integrity/i.test(error.message));
  pristine.trafficActivationEvents[3].attestation.transactionState.perlSandboxStoredPhi = true;
  await writeFile(filePath, JSON.stringify(pristine), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /traffic-activation witness history integrity/i.test(error.message));
});

test("schema 35 migrates through schema 45 without inventing release authority, reference drafts, adjudication, reference decisions, review admission, campus review posture, candidate returns, candidate reviews, traffic, or identity access", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-clinical-release-migration-"));
  const filePath = join(directory, "state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const initial = make();
  await initial.init();
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 35;
  delete legacy.clinicalReleaseEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");
  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateReturnEvents, []);
  assert.deepEqual(migrated.state.campusObservatoryEvents, []);
  assert.deepEqual(migrated.state.independentReviewAdmissionEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceAdjudicationEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceDrafts, []);
  assert.deepEqual(migrated.state.clinicalReleaseEvents, []);
  assert.deepEqual(migrated.state.trafficActivationEvents, []);
  assert.deepEqual(migrated.state.identityAccessEvents, []);
  const gate = await migrated.clinicalReleaseStatus();
  assert.equal(gate.registry.externallyProvisioned, false);
  assert.equal(gate.clinicalUseAuthorized, false);
  assert.equal(gate.patientUseAuthorized, false);
  assert.equal(gate.productionReleaseAuthorized, false);
  assert.equal(gate.clinicalTrafficEnabled, false);
  assert.equal(gate.pilotStarted, false);
});

test("HTTP clinical-release gate is disabled by default and exposes no registry-write or traffic route", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-clinical-release-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), clock: () => new Date("2026-08-14T12:00:00.000Z") });
  await new Promise((resolve, reject) => { runtime.server.once("error", reject); runtime.server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  const health = await fetch(`${base}/api/health`).then(response => response.json());
  assert.equal(health.integration.clinicalReleaseContract, CLINICAL_RELEASE_CONTRACT);
  assert.equal(health.clinicalRelease.trustRootsProvisioned, false);
  assert.equal(health.clinicalRelease.registryWriteApiAvailable, false);
  assert.equal(health.clinicalRelease.clinicalTrafficEnabled, false);
  assert.equal(health.clinicalRelease.pilotStarted, false);
  const gate = await fetch(`${base}/api/governance/clinical-release`).then(response => response.json());
  assert.equal(gate.clinicalRelease.status, "clinical-release-registry-required");
  const denied = await fetch(`${base}/api/governance/clinical-release/challenges`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: "north-central-counseling-center" }) });
  assert.equal(denied.status, 409);
  assert.equal((await fetch(`${base}/api/governance/clinical-release/registry`, { method: "PUT" })).status, 404);
  assert.equal((await fetch(`${base}/api/governance/clinical-release/traffic`, { method: "POST" })).status, 404);
});

test("clinical-release surface and schema preserve the three-duty, traffic-off boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/clinical-release-event.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../clinical-release.css", import.meta.url), "utf8");
  assert.equal(schema.oneOf.length, 4);
  assert.equal(schema.$defs.signature.properties.algorithm.const, "Ed25519");
  assert.match(html, /Three seals may release\. None may turn on traffic\./);
  assert.match(html, /id="clinical-release-clinical-file"[^>]*type="file"/);
  assert.match(html, /id="clinical-release-production-file"[^>]*type="file"/);
  assert.match(html, /id="clinical-release-attestation-file"[^>]*type="file"/);
  assert.doesNotMatch(html, /id="enable-clinical-traffic"/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
