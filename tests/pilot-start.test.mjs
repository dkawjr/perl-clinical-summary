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
  PILOT_START_BOUNDARY,
  PILOT_START_CONTRACT,
  PILOT_START_ORDER_CONTRACT,
  PILOT_START_REGISTRY_CONTRACT,
  buildPilotStartContinuity,
  buildPilotStartControl,
  createPilotStartAcknowledgementEvent,
  createPilotStartChallenge,
  createPilotStartOrderEvent,
  disabledPilotStartRegistry,
  pilotStartAcknowledgementSigningPayload,
  pilotStartOrderSigningPayload,
  pilotStartRegistryFingerprint,
  validatePilotStartAcknowledgement,
  validatePilotStartEvent,
  validatePilotStartOrder,
  validatePilotStartRegistry
} from "../src/pilot-start.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
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

function fixture() {
  const orderKeys = generateKeyPairSync("ed25519");
  const acknowledgementKeys = generateKeyPairSync("ed25519");
  const registry = {
    contractVersion: PILOT_START_REGISTRY_CONTRACT,
    registryId: "FF-START-REGISTRY-QA-2026",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [
      {
        keyId: "FF-START-KEY-ORDER-QA",
        algorithm: "Ed25519",
        purpose: "pilot-start-order",
        publicKeyPem: orderKeys.publicKey.export({ type: "spki", format: "pem" }),
        notBefore: "2026-08-14T00:00:00.000Z",
        notAfter: "2026-08-16T00:00:00.000Z",
        candidateIds: ["north-central-counseling-center"]
      },
      {
        keyId: "FF-START-KEY-ACK-QA",
        algorithm: "Ed25519",
        purpose: "deployment-start-acknowledgement",
        publicKeyPem: acknowledgementKeys.publicKey.export({ type: "spki", format: "pem" }),
        notBefore: "2026-08-14T00:00:00.000Z",
        notAfter: "2026-08-16T00:00:00.000Z",
        candidateIds: ["north-central-counseling-center"]
      }
    ]
  };
  const candidate = {
    candidate: { id: "north-central-counseling-center", index: "01", label: "North Central University", setting: "Counseling-center candidate" },
    dossierFingerprint: HASH_A,
    counts: { satisfiedScopes: 36 },
    pilotAuthorizationRecorded: true
  };
  const authorityTrust = { bridgeFingerprint: HASH_B, candidates: [candidate] };
  const continuity = buildPilotStartContinuity({
    stateSchemaVersion: 35,
    recovery: { id: "recovery", label: "Restore", current: true, evidenceHash: HASH_A },
    rollback: { id: "rollback", label: "Rollback", current: true, evidenceHash: HASH_B },
    monitoring: { id: "monitoring", label: "Monitor", current: true, evidenceHash: HASH_C },
    incidentResponse: { id: "incident-response", label: "Response", current: true, evidenceHash: HASH_D },
    studyControl: { state: "active", highSeverityOpen: 0 }
  });
  const challengeEvent = createPilotStartChallenge({
    candidate,
    authorityBridgeFingerprint: authorityTrust.bridgeFingerprint,
    continuity,
    registry,
    actor: "START-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: NOW,
    id: "11111111-1111-4111-8111-111111111111",
    challengeId: "FF-START-CHALLENGE-11111111-1111-4111-8111-111111111111",
    nonce: "A".repeat(43)
  });
  return { registry, orderKeys, acknowledgementKeys, candidate, authorityTrust, continuity, challengeEvent };
}

function signedOrder(context, overrides = {}) {
  const challenge = context.challengeEvent.challenge;
  const order = {
    contractVersion: PILOT_START_ORDER_CONTRACT,
    challengeId: challenge.challengeId,
    candidateId: challenge.candidateId,
    dossierFingerprint: challenge.dossierFingerprint,
    authorityBridgeFingerprint: challenge.authorityBridgeFingerprint,
    registryFingerprint: pilotStartRegistryFingerprint(context.registry),
    continuityFingerprint: challenge.continuityFingerprint,
    keyId: "FF-START-KEY-ORDER-QA",
    orderId: "FF-START-ORDER-QA-0001",
    issuedAt: "2026-08-14T12:01:00.000Z",
    expiresAt: "2026-08-14T12:14:00.000Z",
    startWindow: { notBefore: "2026-08-14T12:02:00.000Z", notAfter: "2026-08-14T12:10:00.000Z" },
    deployment: { environmentId: "eqpass-azure-pilot", tenantRef: "ncu-counseling", releaseId: "perl-release-2026.08.14", artifactDigest: HASH_C, configurationDigest: HASH_D },
    operatingConditions: { trainingAndObjectivesCompleted: true, quarterlyReviewsAccepted: true, stopAuthorityAssigned: true, supportOwnerAssigned: true, clinicalTrafficEnabled: false, patientUseEnabled: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-START-KEY-ORDER-QA", value: "" },
    ...overrides
  };
  order.signature.value = sign(null, Buffer.from(pilotStartOrderSigningPayload(order)), context.orderKeys.privateKey).toString("base64url");
  return order;
}

function signedAcknowledgement(context, orderEvent, overrides = {}) {
  const order = orderEvent.order;
  const acknowledgement = {
    contractVersion: PILOT_START_ACK_CONTRACT,
    challengeId: order.challengeId,
    candidateId: order.candidateId,
    registryFingerprint: order.registryFingerprint,
    keyId: "FF-START-KEY-ACK-QA",
    acknowledgementId: "FF-START-ACK-QA-0001",
    orderId: order.orderId,
    orderFingerprint: orderEvent.orderFingerprint,
    observedAt: "2026-08-14T12:03:00.000Z",
    deployment: structuredClone(order.deployment),
    status: "started",
    launchState: { providerPreparationEnvironmentStarted: true, clinicalTrafficEnabled: false, patientUseEnabled: false, productionReleaseAuthorized: false },
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-START-KEY-ACK-QA", value: "" },
    ...overrides
  };
  acknowledgement.signature.value = sign(null, Buffer.from(pilotStartAcknowledgementSigningPayload(acknowledgement)), context.acknowledgementKeys.privateKey).toString("base64url");
  return acknowledgement;
}

function authorityFixture() {
  const keys = generateKeyPairSync("ed25519");
  return {
    keys,
    registry: {
      contractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
      registryId: "FF-TRUST-REGISTRY-START-QA",
      version: "1.0.0",
      issuedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-16T00:00:00.000Z",
      keys: [{
        keyId: "FF-TRUST-KEY-START-QA",
        algorithm: "Ed25519",
        publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }),
        notBefore: "2026-08-14T00:00:00.000Z",
        notAfter: "2026-08-16T00:00:00.000Z",
        candidateIds: ["north-central-counseling-center"],
        scopes: AUTHORITY_TRUST_SCOPES.map(item => item.scope)
      }]
    }
  };
}

function signedAuthorityReceipt(context, challenge) {
  const receipt = {
    contractVersion: AUTHORITY_TRUST_RECEIPT_CONTRACT,
    challengeId: challenge.challengeId,
    candidateId: challenge.candidateId,
    dossierFingerprint: challenge.dossierFingerprint,
    registryFingerprint: authorityTrustRegistryFingerprint(context.registry),
    keyId: "FF-TRUST-KEY-START-QA",
    receiptId: "FF-TRUST-RECEIPT-START-QA-0001",
    issuedAt: "2026-08-14T12:01:00.000Z",
    expiresAt: "2026-08-15T11:59:00.000Z",
    assertions: AUTHORITY_TRUST_SCOPES.map(item => ({ scope: item.scope, outcome: item.requiredOutcome, referenceHash: HASH_A })),
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-TRUST-KEY-START-QA", value: "" }
  };
  receipt.signature.value = sign(null, Buffer.from(authorityTrustReceiptSigningPayload(receipt)), context.keys.privateKey).toString("base64url");
  return receipt;
}

test("pilot-start registry defaults disabled and rejects reused duty keys", () => {
  assert.deepEqual(validatePilotStartRegistry(disabledPilotStartRegistry()), []);
  const context = fixture();
  assert.deepEqual(validatePilotStartRegistry(context.registry, { allowDisabled: false }), []);
  const reused = structuredClone(context.registry);
  reused.keys[1].publicKeyPem = reused.keys[0].publicKeyPem;
  assert.ok(validatePilotStartRegistry(reused).some(error => /distinct keys|repeats trusted key material/i.test(error)));
  assert.match(PILOT_START_BOUNDARY, /one key orders/i);
  assert.match(PILOT_START_BOUNDARY, /cannot enable clinical traffic/i);
});

test("start order is bound to the 15-minute challenge, exact deployment, conditions, window, and order-duty signature", () => {
  const context = fixture();
  assert.equal(Date.parse(context.challengeEvent.challenge.expiresAt) - Date.parse(context.challengeEvent.challenge.issuedAt), 15 * 60 * 1000);
  assert.deepEqual(validatePilotStartEvent(context.challengeEvent), []);
  const order = signedOrder(context);
  assert.deepEqual(validatePilotStartOrder(order, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:01:30.000Z" }), []);
  const clinicalTraffic = structuredClone(order);
  clinicalTraffic.operatingConditions.clinicalTrafficEnabled = true;
  assert.ok(validatePilotStartOrder(clinicalTraffic, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:01:30.000Z" }).some(error => /clinicalTrafficEnabled must remain false/i.test(error)));
  const tampered = structuredClone(order);
  tampered.deployment.releaseId = "perl-release-tampered";
  assert.ok(validatePilotStartOrder(tampered, { challenge: context.challengeEvent.challenge, registry: context.registry, now: "2026-08-14T12:01:30.000Z" }).some(error => /signature is invalid/i.test(error)));
});

test("deployment acknowledgement requires the distinct observer key and exact ordered deployment", () => {
  const context = fixture();
  const order = signedOrder(context);
  const orderEvent = createPilotStartOrderEvent({ order, registry: context.registry, actor: "START-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:01:30.000Z", id: "22222222-2222-4222-8222-222222222222" });
  assert.deepEqual(validatePilotStartEvent(orderEvent, { registry: context.registry, challenge: context.challengeEvent.challenge }), []);
  const acknowledgement = signedAcknowledgement(context, orderEvent);
  assert.deepEqual(validatePilotStartAcknowledgement(acknowledgement, { challenge: context.challengeEvent.challenge, order, registry: context.registry, now: "2026-08-14T12:03:30.000Z" }), []);
  const wrongDeployment = structuredClone(acknowledgement);
  wrongDeployment.deployment.configurationDigest = HASH_A;
  assert.ok(validatePilotStartAcknowledgement(wrongDeployment, { challenge: context.challengeEvent.challenge, order, registry: context.registry, now: "2026-08-14T12:03:30.000Z" }).some(error => /does not match the ordered deployment/i.test(error)));
  const sameDuty = structuredClone(acknowledgement);
  sameDuty.keyId = order.keyId;
  sameDuty.signature.keyId = order.keyId;
  sameDuty.signature.value = sign(null, Buffer.from(pilotStartAcknowledgementSigningPayload(sameDuty)), context.orderKeys.privateKey).toString("base64url");
  assert.ok(validatePilotStartAcknowledgement(sameDuty, { challenge: context.challengeEvent.challenge, order, registry: context.registry, now: "2026-08-14T12:03:30.000Z" }).some(error => /distinct from the start-order key|not granted to purpose/i.test(error)));
});

test("two verified duties can open provider preparation without starting a clinical pilot", () => {
  const context = fixture();
  const order = signedOrder(context);
  const orderEvent = createPilotStartOrderEvent({ order, registry: context.registry, actor: "START-QA", sequence: 2, previousHash: context.challengeEvent.hash, verifiedAt: "2026-08-14T12:01:30.000Z", id: "22222222-2222-4222-8222-222222222222" });
  const acknowledgement = signedAcknowledgement(context, orderEvent);
  const acknowledgementEvent = createPilotStartAcknowledgementEvent({ acknowledgement, registry: context.registry, actor: "START-QA", sequence: 3, previousHash: orderEvent.hash, verifiedAt: "2026-08-14T12:03:30.000Z", id: "33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(validatePilotStartEvent(acknowledgementEvent, { registry: context.registry, challenge: context.challengeEvent.challenge, order }), []);
  const control = buildPilotStartControl({ authorityTrust: context.authorityTrust, continuity: context.continuity, registry: context.registry, events: [context.challengeEvent, orderEvent, acknowledgementEvent], chain: { valid: true, count: 3, head: acknowledgementEvent.hash }, generatedAt: "2026-08-14T12:04:00.000Z" });
  assert.equal(control.contractVersion, PILOT_START_CONTRACT);
  assert.equal(control.candidates[0].providerPreparationStarted, true);
  assert.equal(control.providerPreparationStarted, true);
  assert.equal(control.pilotStarted, false);
  assert.equal(control.clinicalTrafficEnabled, false);
  assert.equal(control.productionReleaseAuthorized, false);
  assert.equal(control.patientUseAuthorized, false);
});

test("store persists the full authority-to-preparation sequence and fails startup after acknowledgement tampering", async t => {
  const start = fixture();
  const authority = authorityFixture();
  const directory = await mkdtemp(join(tmpdir(), "perl-start-store-"));
  const filePath = join(directory, "sandbox-state.json");
  let clockValue = "2026-08-14T12:00:00.000Z";
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider(),
    authorityTrustRegistry: authority.registry,
    pilotStartRegistry: start.registry,
    clock: () => new Date(clockValue)
  });
  const store = make();
  await store.init();
  await store.rehearseRecovery("START-STORE-QA");
  await store.rehearseRollbackCompatibility("START-STORE-QA");
  await store.recordOperationalMonitoringSnapshot("START-STORE-QA");
  await store.rehearseIncidentResponse("critical-safety-routing", "START-STORE-QA");

  const authorityChallenge = await store.issueAuthorityTrustChallenge("north-central-counseling-center", "START-STORE-QA");
  clockValue = "2026-08-14T12:02:00.000Z";
  await store.verifyAuthorityTrustReceipt(signedAuthorityReceipt(authority, authorityChallenge.challenge), "START-STORE-QA");
  clockValue = "2026-08-14T12:03:00.000Z";
  const startChallenge = await store.issuePilotStartChallenge("north-central-counseling-center", "START-STORE-QA");
  const orderContext = { ...start, challengeEvent: startChallenge.event };
  const order = signedOrder(orderContext, {
    issuedAt: "2026-08-14T12:04:00.000Z",
    expiresAt: "2026-08-14T12:17:00.000Z",
    startWindow: { notBefore: "2026-08-14T12:05:00.000Z", notAfter: "2026-08-14T12:10:00.000Z" }
  });
  clockValue = "2026-08-14T12:04:30.000Z";
  const verifiedOrder = await store.verifyPilotStartOrder(order, "START-STORE-QA");
  const acknowledgement = signedAcknowledgement(orderContext, verifiedOrder.event, { observedAt: "2026-08-14T12:06:00.000Z" });
  clockValue = "2026-08-14T12:06:30.000Z";
  const acknowledged = await store.verifyPilotStartAcknowledgement(acknowledgement, "START-STORE-QA");
  assert.equal(acknowledged.pilotStart.chain.valid, true);
  assert.equal(acknowledged.pilotStart.chain.count, 3);
  assert.equal(acknowledged.pilotStart.providerPreparationStarted, true);
  assert.equal(acknowledged.pilotStart.pilotStarted, false);
  assert.equal(acknowledged.pilotStart.clinicalTrafficEnabled, false);
  assert.equal(acknowledged.pilotStart.productionReleaseAuthorized, false);
  assert.equal(acknowledged.pilotStart.patientUseAuthorized, false);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyPilotStartEventChain().valid, true);
  assert.equal((await reopened.pilotStartStatus()).providerPreparationStarted, true);

  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.pilotStartEvents[2].acknowledgement.deployment.configurationDigest = HASH_A;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /pilot-start interlock history integrity/i.test(error.message));
});

test("schema 34 migrates through schema 45 with empty reference, adjudication, decision, review-admission, campus, candidate-return, candidate-review, start, release, traffic, and identity-access ledgers", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-start-migration-"));
  const filePath = join(directory, "state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const initial = make();
  await initial.init();
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 34;
  delete legacy.pilotStartEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");
  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateReturnEvents, []);
  assert.deepEqual(migrated.state.campusObservatoryEvents, []);
  assert.deepEqual(migrated.state.independentReviewAdmissionEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceAdjudicationEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceDrafts, []);
  assert.deepEqual(migrated.state.pilotStartEvents, []);
  assert.deepEqual(migrated.state.clinicalReleaseEvents, []);
  assert.deepEqual(migrated.state.trafficActivationEvents, []);
  assert.deepEqual(migrated.state.identityAccessEvents, []);
  const control = await migrated.pilotStartStatus();
  assert.equal(control.registry.externallyProvisioned, false);
  assert.equal(control.pilotStarted, false);
  assert.equal(control.patientUseAuthorized, false);
});

test("HTTP pilot-start interlock is disabled by default and exposes no registry-write route", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-start-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), clock: () => new Date("2026-08-14T12:02:00.000Z") });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  const health = await fetch(`${base}/api/health`).then(response => response.json());
  assert.equal(health.integration.pilotStartContract, PILOT_START_CONTRACT);
  assert.equal(health.pilotStart.trustRootsProvisioned, false);
  assert.equal(health.pilotStart.registryWriteApiAvailable, false);
  assert.equal(health.pilotStart.pilotStarted, false);
  const control = await fetch(`${base}/api/governance/pilot-start`).then(response => response.json());
  assert.equal(control.pilotStart.status, "pilot-start-registry-required");
  const denied = await fetch(`${base}/api/governance/pilot-start/challenges`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: "north-central-counseling-center" }) });
  assert.equal(denied.status, 409);
  const registryWrite = await fetch(`${base}/api/governance/pilot-start/registry`, { method: "PUT" });
  assert.equal(registryWrite.status, 404);
});

test("pilot-start schema and responsive evidence room preserve the two-duty and no-clinical-use boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/pilot-start-event.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../pilot-start.css", import.meta.url), "utf8");
  assert.equal(schema.oneOf.length, 3);
  assert.equal(schema.$defs.signature.properties.algorithm.const, "Ed25519");
  assert.equal(schema.$defs.order.properties.operatingConditions.properties.clinicalTrafficEnabled.const, false);
  assert.equal(schema.$defs.acknowledgement.properties.launchState.properties.patientUseEnabled.const, false);
  assert.match(html, /One seal may authorize\. It may not press Start\./);
  assert.match(html, /id="pilot-start-order-file"[^>]*type="file"/);
  assert.match(html, /id="pilot-start-ack-file"[^>]*type="file"/);
  assert.doesNotMatch(html, /create start key|add start key/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
