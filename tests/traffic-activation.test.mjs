import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
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
  FIRST_GOVERNED_TRANSACTION_CONTRACT,
  TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
  TRAFFIC_ACTIVATION_CONTRACT,
  TRAFFIC_ACTIVATION_KEY_PURPOSES,
  TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
  buildTrafficActivationWitness,
  canonicalTrafficActivationJson,
  createClinicalTrafficAuthorizationEvent,
  createFirstGovernedTransactionEvent,
  createOperationsTrafficAuthorizationEvent,
  createTrafficActivationChallenge,
  disabledTrafficActivationRegistry,
  firstGovernedTransactionSigningPayload,
  summarizeTrafficActivationRegistry,
  trafficActivationAuthorizationSigningPayload,
  trafficActivationPlanFingerprint,
  trafficActivationRegistryFingerprint,
  validateFirstGovernedTransactionAttestation,
  validateTrafficActivationAuthorization,
  validateTrafficActivationChallenge,
  validateTrafficActivationEvent,
  validateTrafficActivationRegistry
} from "../src/traffic-activation.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const HASH_1 = "1".repeat(64);
const HASH_2 = "2".repeat(64);
const HASH_3 = "3".repeat(64);
const HASH_4 = "4".repeat(64);
const BOUNDARY = {
  evidenceFilesIncluded: false, humanNamesIncluded: false, humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false, patientRecordContentIncluded: false, directIdentifiersIncluded: false,
  findingsContentIncluded: false, phiIncluded: false, endpointOrCredentialIncluded: false,
  perlExternalTransmissionPerformed: false
};

const hash = value => createHash("sha256").update(canonicalTrafficActivationJson(value)).digest("hex");

function fixture() {
  const clinicalKeys = generateKeyPairSync("ed25519");
  const operationsKeys = generateKeyPairSync("ed25519");
  const observerKeys = generateKeyPairSync("ed25519");
  const registry = {
    contractVersion: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
    registryId: "FF-TRAFFIC-REGISTRY-WITNESS-QA",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [
      { keyId: "FF-TRAFFIC-KEY-CLINICAL-QA", algorithm: "Ed25519", purpose: "clinical-traffic-activation-clinical", publicKeyPem: clinicalKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-TRAFFIC-KEY-OPERATIONS-QA", algorithm: "Ed25519", purpose: "clinical-traffic-activation-operations", publicKeyPem: operationsKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] },
      { keyId: "FF-TRAFFIC-KEY-OBSERVER-QA", algorithm: "Ed25519", purpose: "first-governed-transaction-attestation", publicKeyPem: observerKeys.publicKey.export({ type: "spki", format: "pem" }), notBefore: "2026-08-14T00:00:00.000Z", notAfter: "2026-08-16T00:00:00.000Z", candidateIds: ["north-central-counseling-center"] }
    ]
  };
  const clinicalReleaseCandidate = {
    candidate: { id: "north-central-counseling-center", index: "01", label: "North Central University Counseling Center" },
    dossierFingerprint: HASH_C,
    releaseReadyForTrafficActivation: true,
    clinicalAuthorization: { authorizationId: "FF-CLINICAL-AUTH-WITNESS-QA", scope: "bounded" },
    productionAuthorization: { authorizationId: "FF-PRODUCTION-AUTH-WITNESS-QA", deployment: "exact" },
    deploymentAttestation: { attestationId: "FF-RELEASE-ATTEST-WITNESS-QA", deployment: "verified" }
  };
  const clinicalRelease = { gateFingerprint: HASH_A, chain: { valid: true, count: 4, head: HASH_B }, candidates: [clinicalReleaseCandidate] };
  const continuity = { allCurrent: true, continuityFingerprint: HASH_D };
  const releaseProof = {
    gateFingerprint: clinicalRelease.gateFingerprint,
    chainHead: clinicalRelease.chain.head,
    clinicalAuthorizationFingerprint: hash(clinicalReleaseCandidate.clinicalAuthorization),
    productionAuthorizationFingerprint: hash(clinicalReleaseCandidate.productionAuthorization),
    deploymentAttestationFingerprint: hash(clinicalReleaseCandidate.deploymentAttestation)
  };
  const challengeEvent = createTrafficActivationChallenge({
    candidate: clinicalReleaseCandidate,
    releaseProof,
    continuityFingerprint: continuity.continuityFingerprint,
    registry,
    actor: "WITNESS-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T12:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
    challengeId: "FF-TRAFFIC-CHALLENGE-11111111-1111-4111-8111-111111111111",
    nonce: "A".repeat(43)
  });
  return { clinicalKeys, operationsKeys, observerKeys, registry, clinicalRelease, continuity, releaseProof, challengeEvent };
}

function authorization(context, purpose, overrides = {}) {
  const clinical = purpose === "clinical-traffic-activation-clinical";
  const authorization = {
    contractVersion: TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
    challengeId: context.challengeEvent.challenge.challengeId,
    candidateId: context.challengeEvent.challenge.candidateId,
    registryFingerprint: trafficActivationRegistryFingerprint(context.registry),
    keyId: clinical ? "FF-TRAFFIC-KEY-CLINICAL-QA" : "FF-TRAFFIC-KEY-OPERATIONS-QA",
    authorizationId: clinical ? "FF-TRAFFIC-AUTH-CLINICAL-QA-0001" : "FF-TRAFFIC-AUTH-OPERATIONS-QA-0001",
    duty: purpose,
    releaseGateFingerprint: context.challengeEvent.challenge.releaseGateFingerprint,
    issuedAt: clinical ? "2026-08-14T12:01:00.000Z" : "2026-08-14T12:02:00.000Z",
    expiresAt: "2026-08-14T12:14:00.000Z",
    activationWindow: { notBefore: "2026-08-14T12:05:00.000Z", notAfter: "2026-08-14T16:05:00.000Z" },
    deployment: { environmentId: "eqpass-azure-pilot", tenantRef: "ncu-counseling", releaseId: "perl-release-2026.08.14", artifactDigest: HASH_E, configurationDigest: HASH_F },
    endpointBindings: { connectionProfileRef: "eqpass-private-traffic-v1", endpointIdentityFingerprint: HASH_1, rolePolicyFingerprint: HASH_2, tenantIsolationFingerprint: HASH_3 },
    controlReferences: { releaseEvidence: HASH_A, clinicalStopAuthority: HASH_B, monitoring: HASH_C, backup: HASH_D, incidentRoutes: HASH_E, rollback: HASH_F, identityAccess: HASH_1, minimumNecessary: HASH_2 },
    authorityState: { externalTrafficActivationAuthorized: true, perlSandboxControlsTraffic: false, perlSandboxReceivesPatientRecords: false, autonomousClinicalDecisionAllowed: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: clinical ? "FF-TRAFFIC-KEY-CLINICAL-QA" : "FF-TRAFFIC-KEY-OPERATIONS-QA", value: "" },
    ...overrides
  };
  const privateKey = clinical ? context.clinicalKeys.privateKey : context.operationsKeys.privateKey;
  authorization.signature.value = sign(null, Buffer.from(trafficActivationAuthorizationSigningPayload(authorization)), privateKey).toString("base64url");
  return authorization;
}

function firstTransaction(context, clinicalEvent, operationsEvent, overrides = {}) {
  const attestation = {
    contractVersion: FIRST_GOVERNED_TRANSACTION_CONTRACT,
    challengeId: context.challengeEvent.challenge.challengeId,
    candidateId: context.challengeEvent.challenge.candidateId,
    registryFingerprint: trafficActivationRegistryFingerprint(context.registry),
    keyId: "FF-TRAFFIC-KEY-OBSERVER-QA",
    attestationId: "FF-FIRST-TXN-ATTEST-WITNESS-QA-0001",
    clinicalAuthorizationFingerprint: clinicalEvent.authorizationFingerprint,
    operationsAuthorizationFingerprint: operationsEvent.authorizationFingerprint,
    activationPlanFingerprint: clinicalEvent.activationPlanFingerprint,
    observedAt: "2026-08-14T12:10:00.000Z",
    deployment: structuredClone(clinicalEvent.authorization.deployment),
    transactionReferences: { sourceEventReceipt: HASH_A, findingsReport: HASH_B, summaryArtifact: HASH_C, remoteAcknowledgement: HASH_D, auditRecord: HASH_E },
    controlChecks: { authenticatedRole: true, namedSiteScope: true, minimumNecessary: true, scoringUpstream: true, findingsUnchanged: true, humanReviewCompleted: true, criticalRoutingVerified: true, remoteAttachmentAcknowledged: true, auditCommitted: true },
    transactionState: { externalClinicalTrafficObserved: true, firstGovernedTransactionObserved: true, safetyDisposition: "routine-review", perlSandboxReceivedRecord: false, perlSandboxStoredPhi: false, autonomousClinicalDecision: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-TRAFFIC-KEY-OBSERVER-QA", value: "" },
    ...overrides
  };
  attestation.signature.value = sign(null, Buffer.from(firstGovernedTransactionSigningPayload(attestation)), context.observerKeys.privateKey).toString("base64url");
  return attestation;
}

test("traffic witness registry defaults disabled and requires three distinct duties", () => {
  assert.deepEqual(validateTrafficActivationRegistry(disabledTrafficActivationRegistry()), []);
  const context = fixture();
  assert.deepEqual(validateTrafficActivationRegistry(context.registry, { allowDisabled: false }), []);
  const summary = summarizeTrafficActivationRegistry(context.registry, "2026-08-14T12:00:00.000Z");
  assert.equal(summary.activeKeyCount, 3);
  assert.deepEqual(Object.keys(summary.activePurposeCounts), TRAFFIC_ACTIVATION_KEY_PURPOSES);
  const reused = structuredClone(context.registry);
  reused.keys[1].publicKeyPem = reused.keys[0].publicKeyPem;
  assert.ok(validateTrafficActivationRegistry(reused, { allowDisabled: false }).some(error => /distinct keys|repeats trusted key material/i.test(error)));
});

test("activation challenge binds release proof, continuity, registry, and an exact 15-minute window", () => {
  const context = fixture();
  assert.deepEqual(validateTrafficActivationChallenge(context.challengeEvent.challenge, { candidate: context.clinicalRelease.candidates[0], releaseProof: context.releaseProof, continuityFingerprint: context.continuity.continuityFingerprint, registryFingerprint: trafficActivationRegistryFingerprint(context.registry) }), []);
  assert.deepEqual(validateTrafficActivationEvent(context.challengeEvent, { sequence: 1, previousHash: "GENESIS" }), []);
  const stale = structuredClone(context.challengeEvent.challenge);
  stale.releaseChainHead = HASH_4;
  assert.ok(validateTrafficActivationChallenge(stale, { releaseProof: context.releaseProof }).some(error => /current release proof/i.test(error)));
});

test("clinical and operations duties must sign the identical bounded activation plan", () => {
  const context = fixture();
  const clinical = authorization(context, "clinical-traffic-activation-clinical");
  const operations = authorization(context, "clinical-traffic-activation-operations");
  assert.deepEqual(validateTrafficActivationAuthorization(clinical, { challenge: context.challengeEvent.challenge, registry: context.registry, purpose: clinical.duty, now: "2026-08-14T12:03:00.000Z" }), []);
  assert.deepEqual(validateTrafficActivationAuthorization(operations, { challenge: context.challengeEvent.challenge, registry: context.registry, purpose: operations.duty, now: "2026-08-14T12:03:00.000Z" }), []);
  assert.equal(trafficActivationPlanFingerprint(clinical), trafficActivationPlanFingerprint(operations));
  const clinicalEvent = createClinicalTrafficAuthorizationEvent({ authorization: clinical, registry: context.registry, actor: "WITNESS-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:01:30.000Z", id: "22222222-2222-4222-8222-222222222222" });
  assert.deepEqual(validateTrafficActivationEvent(clinicalEvent, { sequence: 2, previousHash: context.challengeEvent.hash, registry: context.registry, challenge: context.challengeEvent.challenge }), []);
  const wrong = authorization(context, "clinical-traffic-activation-operations", { activationWindow: { notBefore: "2026-08-14T12:06:00.000Z", notAfter: "2026-08-14T16:05:00.000Z" } });
  const wrongEvent = createOperationsTrafficAuthorizationEvent({ authorization: wrong, registry: context.registry, actor: "WITNESS-QA", sequence: 3, previousHash: clinicalEvent.hash, verifiedAt: "2026-08-14T12:02:30.000Z" });
  assert.ok(validateTrafficActivationEvent(wrongEvent, { sequence: 3, previousHash: clinicalEvent.hash, registry: context.registry, challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical }).some(error => /same plan|does not match the clinical activation plan/i.test(error)));
});

test("first transaction witness binds both authorities and verifies governance without bringing a record into PERL", () => {
  const context = fixture();
  const clinical = authorization(context, "clinical-traffic-activation-clinical");
  const clinicalEvent = createClinicalTrafficAuthorizationEvent({ authorization: clinical, registry: context.registry, actor: "WITNESS-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:01:30.000Z", id: "22222222-2222-4222-8222-222222222222" });
  const operations = authorization(context, "clinical-traffic-activation-operations");
  const operationsEvent = createOperationsTrafficAuthorizationEvent({ authorization: operations, registry: context.registry, actor: "WITNESS-QA", sequence: 3, previousHash: clinicalEvent.hash, verifiedAt: "2026-08-14T12:02:30.000Z", id: "33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(validateTrafficActivationEvent(operationsEvent, { sequence: 3, previousHash: clinicalEvent.hash, registry: context.registry, challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical }), []);
  const attestation = firstTransaction(context, clinicalEvent, operationsEvent);
  assert.deepEqual(validateFirstGovernedTransactionAttestation(attestation, { challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, operationsAuthorization: operations, registry: context.registry, now: "2026-08-14T12:11:00.000Z" }), []);
  const event = createFirstGovernedTransactionEvent({ attestation, registry: context.registry, actor: "WITNESS-QA", sequence: 4, previousHash: operationsEvent.hash, verifiedAt: "2026-08-14T12:11:00.000Z", id: "44444444-4444-4444-8444-444444444444" });
  assert.deepEqual(validateTrafficActivationEvent(event, { sequence: 4, previousHash: operationsEvent.hash, registry: context.registry, challenge: context.challengeEvent.challenge, clinicalAuthorization: clinical, operationsAuthorization: operations }), []);
  const witness = buildTrafficActivationWitness({ clinicalRelease: context.clinicalRelease, continuity: context.continuity, registry: context.registry, events: [context.challengeEvent, clinicalEvent, operationsEvent, event], chain: { valid: true, count: 4, head: event.hash }, generatedAt: "2026-08-14T12:12:00.000Z" });
  assert.equal(witness.contractVersion, TRAFFIC_ACTIVATION_CONTRACT);
  assert.equal(witness.firstGovernedTransactionVerified, true);
  assert.equal(witness.externalClinicalTrafficObserved, true);
  assert.equal(witness.perlSandboxTrafficEnabled, false);
  assert.equal(witness.perlSandboxPatientRecordsProcessed, false);
  assert.equal(witness.phiStored, false);
  assert.equal(witness.trafficControlApiAvailable, false);
});

test("traffic witness schema preserves the three-duty, no-payload boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/traffic-activation-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$defs.base.properties.perlSandboxTrafficEnabled.const, false);
  assert.equal(schema.$defs.base.properties.perlSandboxPatientRecordsProcessed.const, false);
  assert.equal(schema.$defs.base.properties.phiStored.const, false);
  assert.equal(schema.$defs.attestation.properties.contractVersion.const, FIRST_GOVERNED_TRANSACTION_CONTRACT);
});

test("schema 36 migrates through schema 45 without inventing activation concurrence, reference drafts, adjudication, reference decisions, review admission, campus review posture, candidate returns, candidate reviews, traffic, or identity access", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-traffic-activation-migration-"));
  const filePath = join(directory, "state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const initial = make();
  await initial.init();
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 36;
  delete legacy.trafficActivationEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");
  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateReturnEvents, []);
  assert.deepEqual(migrated.state.campusObservatoryEvents, []);
  assert.deepEqual(migrated.state.independentReviewAdmissionEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceAdjudicationEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceDrafts, []);
  assert.deepEqual(migrated.state.trafficActivationEvents, []);
  assert.deepEqual(migrated.state.identityAccessEvents, []);
  const witness = await migrated.trafficActivationStatus();
  assert.equal(witness.registry.externallyProvisioned, false);
  assert.equal(witness.externalTrafficActivationAuthorized, false);
  assert.equal(witness.externalClinicalTrafficObserved, false);
  assert.equal(witness.firstGovernedTransactionVerified, false);
  assert.equal(witness.perlSandboxTrafficEnabled, false);
  assert.equal(witness.perlSandboxPatientRecordsProcessed, false);
  assert.equal(witness.phiStored, false);
});

test("HTTP traffic witness defaults disabled and exposes no registry, endpoint, traffic, or record control", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-traffic-activation-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), clock: () => new Date("2026-08-14T12:00:00.000Z") });
  await new Promise((resolve, reject) => { runtime.server.once("error", reject); runtime.server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  const health = await fetch(`${base}/api/health`).then(response => response.json());
  assert.equal(health.integration.trafficActivationContract, TRAFFIC_ACTIVATION_CONTRACT);
  assert.equal(health.integration.firstGovernedTransactionContract, FIRST_GOVERNED_TRANSACTION_CONTRACT);
  assert.equal(health.trafficActivation.trustRootsProvisioned, false);
  assert.equal(health.trafficActivation.registryWriteApiAvailable, false);
  assert.equal(health.trafficActivation.trafficControlApiAvailable, false);
  assert.equal(health.trafficActivation.endpointConfigurationApiAvailable, false);
  assert.equal(health.trafficActivation.patientRecordApiAvailable, false);
  assert.equal(health.trafficActivation.perlSandboxTrafficEnabled, false);
  const witness = await fetch(`${base}/api/governance/traffic-activation`).then(response => response.json());
  assert.equal(witness.trafficActivation.status, "traffic-witness-registry-required");
  const denied = await fetch(`${base}/api/governance/traffic-activation/challenges`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: "north-central-counseling-center" }) });
  assert.equal(denied.status, 409);
  for (const [path, method] of [["registry", "PUT"], ["traffic", "POST"], ["endpoints", "POST"], ["records", "POST"]]) {
    assert.equal((await fetch(`${base}/api/governance/traffic-activation/${path}`, { method })).status, 404);
  }
});

test("traffic witness surface is bold, keyboard-native, and contains no switch control", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../traffic-activation.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /The switch lives elsewhere\. The witness stays here\./);
  assert.match(html, /id="traffic-activation-clinical-file"[^>]*type="file"/);
  assert.match(html, /id="traffic-activation-operations-file"[^>]*type="file"/);
  assert.match(html, /id="traffic-activation-transaction-file"[^>]*type="file"/);
  assert.doesNotMatch(html, /id="(?:enable|activate|start)-clinical-traffic"/i);
  assert.match(app, /function renderTrafficActivation/);
  assert.match(app, /verifyFirstGovernedTransactionAttestation/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
