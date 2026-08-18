import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import { createPerlServer } from "../server.mjs";
import {
  AUTHORITY_TRUST_BOUNDARY,
  AUTHORITY_TRUST_CONTRACT,
  AUTHORITY_TRUST_RECEIPT_CONTRACT,
  AUTHORITY_TRUST_REGISTRY_CONTRACT,
  AUTHORITY_TRUST_SCOPES,
  authorityTrustReceiptSigningPayload,
  authorityTrustRegistryFingerprint,
  buildAuthorityTrustBridge,
  createAuthorityTrustChallenge,
  createAuthorityTrustReceiptEvent,
  disabledAuthorityTrustRegistry,
  validateAuthorityTrustChallenge,
  validateAuthorityTrustEvent,
  validateAuthorityTrustReceipt,
  validateAuthorityTrustRegistry
} from "../src/authority-trust.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
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

function trustFixture({ scopes = AUTHORITY_TRUST_SCOPES.map(item => item.scope) } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const registry = {
    contractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
    registryId: "FF-TRUST-REGISTRY-TEST-2026",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    keys: [{
      keyId: "FF-TRUST-KEY-TEST-2026",
      algorithm: "Ed25519",
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      notBefore: "2026-08-14T00:00:00.000Z",
      notAfter: "2026-08-16T00:00:00.000Z",
      candidateIds: ["north-central-counseling-center", "cooper-psych-clinic-qi"],
      scopes
    }]
  };
  const dossier = {
    candidate: { id: "north-central-counseling-center", index: "01", label: "North Central University Counseling Center" },
    dossierFingerprint: HASH_A
  };
  const challengeEvent = createAuthorityTrustChallenge({
    dossier,
    portfolioFingerprint: HASH_B,
    registry,
    actor: "TRUST-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: NOW,
    id: "11111111-1111-4111-8111-111111111111",
    challengeId: "FF-TRUST-CHALLENGE-11111111-1111-4111-8111-111111111111",
    nonce: "A".repeat(43)
  });
  return { registry, privateKey, dossier, challengeEvent };
}

function signedReceipt({ registry, privateKey, challengeEvent }, assertions = [{ scope: "site:identity", outcome: "verified", referenceHash: HASH_C }], overrides = {}) {
  const challenge = challengeEvent.challenge;
  const receipt = {
    contractVersion: AUTHORITY_TRUST_RECEIPT_CONTRACT,
    challengeId: challenge.challengeId,
    candidateId: challenge.candidateId,
    dossierFingerprint: challenge.dossierFingerprint,
    registryFingerprint: authorityTrustRegistryFingerprint(registry),
    keyId: "FF-TRUST-KEY-TEST-2026",
    receiptId: "FF-TRUST-RECEIPT-TEST-0001",
    issuedAt: "2026-08-14T12:01:00.000Z",
    expiresAt: "2026-08-15T11:59:00.000Z",
    assertions,
    contentBoundary: structuredClone(BOUNDARY),
    signature: { algorithm: "Ed25519", keyId: "FF-TRUST-KEY-TEST-2026", value: "" },
    ...overrides
  };
  receipt.signature.value = sign(null, Buffer.from(authorityTrustReceiptSigningPayload(receipt)), privateKey).toString("base64url");
  return receipt;
}

function siteAdmission(dossier) {
  return {
    portfolioFingerprint: HASH_B,
    dossiers: [dossier],
    boundary: "External site-admission boundary."
  };
}

test("authority trust fixes 36 exact scopes and defaults to no trust root", () => {
  assert.equal(AUTHORITY_TRUST_SCOPES.length, 36);
  assert.equal(new Set(AUTHORITY_TRUST_SCOPES.map(item => item.scope)).size, 36);
  assert.deepEqual(validateAuthorityTrustRegistry(disabledAuthorityTrustRegistry()), []);
  assert.match(AUTHORITY_TRUST_BOUNDARY, /no HTTP, browser, import, or local-state path/i);
  assert.match(AUTHORITY_TRUST_BOUNDARY, /does not start the pilot clock/i);
});

test("challenge is registry, dossier, portfolio, nonce, and exact-24-hour bound", () => {
  const fixture = trustFixture();
  assert.deepEqual(validateAuthorityTrustRegistry(fixture.registry, { allowDisabled: false }), []);
  assert.equal(Date.parse(fixture.challengeEvent.challenge.expiresAt) - Date.parse(fixture.challengeEvent.challenge.issuedAt), 24 * 60 * 60 * 1000);
  assert.equal(fixture.challengeEvent.challenge.requiredScopes.length, 36);
  const shortNonce = structuredClone(fixture.challengeEvent.challenge);
  shortNonce.nonce = "A".repeat(42);
  assert.ok(validateAuthorityTrustChallenge(shortNonce).some(error => /256 random bits/i.test(error)));
  assert.deepEqual(validateAuthorityTrustEvent(fixture.challengeEvent, { sequence: 1, previousHash: "GENESIS" }), []);
  const stale = structuredClone(fixture.challengeEvent.challenge);
  stale.portfolioFingerprint = HASH_C;
  const errors = validateAuthorityTrustEvent({ ...fixture.challengeEvent, challenge: stale }, { sequence: 1, previousHash: "GENESIS" });
  assert.ok(errors.some(error => /hash is invalid/i.test(error)));
});

test("valid Ed25519 metadata receipt verifies while tampering, replay, expiry, and ungranted scopes fail closed", () => {
  const fixture = trustFixture({ scopes: ["site:identity"] });
  const receipt = signedReceipt(fixture);
  assert.deepEqual(validateAuthorityTrustReceipt(receipt, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-14T12:02:00.000Z" }), []);

  const tampered = structuredClone(receipt);
  tampered.assertions[0].referenceHash = HASH_B;
  assert.ok(validateAuthorityTrustReceipt(tampered, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-14T12:02:00.000Z" }).some(error => /signature is invalid/i.test(error)));

  const shortSignature = structuredClone(receipt);
  shortSignature.signature.value = "A".repeat(85);
  assert.ok(validateAuthorityTrustReceipt(shortSignature, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-14T12:02:00.000Z" }).some(error => /signature metadata is invalid/i.test(error)));

  assert.ok(validateAuthorityTrustReceipt(receipt, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-14T12:02:00.000Z", seenReceiptIds: new Set([receipt.receiptId]) }).some(error => /already been recorded/i.test(error)));
  assert.ok(validateAuthorityTrustReceipt(receipt, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-15T12:02:00.000Z" }).some(error => /expired/i.test(error)));

  const expiredRegistry = structuredClone(fixture.registry);
  expiredRegistry.expiresAt = "2026-08-14T12:01:30.000Z";
  expiredRegistry.keys[0].notAfter = expiredRegistry.expiresAt;
  const expiredRegistryReceipt = signedReceipt({ ...fixture, registry: expiredRegistry }, undefined, { expiresAt: expiredRegistry.expiresAt, receiptId: "FF-TRUST-RECEIPT-TEST-0003" });
  assert.ok(validateAuthorityTrustReceipt(expiredRegistryReceipt, { challenge: fixture.challengeEvent.challenge, registry: expiredRegistry, now: "2026-08-14T12:02:00.000Z" }).some(error => /registry is outside/i.test(error)));

  const unauthorized = signedReceipt(fixture, [{ scope: "authorization:pilot", outcome: "accepted", referenceHash: HASH_C }], { receiptId: "FF-TRUST-RECEIPT-TEST-0002" });
  assert.ok(validateAuthorityTrustReceipt(unauthorized, { challenge: fixture.challengeEvent.challenge, registry: fixture.registry, now: "2026-08-14T12:02:00.000Z" }).some(error => /scope not granted/i.test(error)));
});

test("verified receipt events remain tamper evident and can satisfy bounded authorization without starting or releasing a pilot", () => {
  const fixture = trustFixture();
  const assertions = AUTHORITY_TRUST_SCOPES.map(scope => ({ scope: scope.scope, outcome: scope.requiredOutcome, referenceHash: HASH_C }));
  const receipt = signedReceipt(fixture, assertions);
  const receiptEvent = createAuthorityTrustReceiptEvent({
    receipt,
    registry: fixture.registry,
    actor: "TRUST-QA",
    sequence: 2,
    previousHash: fixture.challengeEvent.hash,
    verifiedAt: "2026-08-14T12:02:00.000Z",
    id: "22222222-2222-4222-8222-222222222222"
  });
  assert.deepEqual(validateAuthorityTrustEvent(receiptEvent, {
    sequence: 2,
    previousHash: fixture.challengeEvent.hash,
    registry: fixture.registry,
    challenge: fixture.challengeEvent.challenge,
    now: receiptEvent.createdAt
  }), []);
  const bridge = buildAuthorityTrustBridge({
    siteAdmission: siteAdmission(fixture.dossier),
    registry: fixture.registry,
    events: [fixture.challengeEvent, receiptEvent],
    chain: { valid: true, count: 2, head: receiptEvent.hash },
    generatedAt: "2026-08-14T12:03:00.000Z"
  });
  assert.equal(bridge.contractVersion, AUTHORITY_TRUST_CONTRACT);
  assert.equal(bridge.candidates[0].counts.satisfiedScopes, 36);
  assert.equal(bridge.candidates[0].pilotAuthorizationRecorded, true);
  assert.equal(bridge.candidates[0].pilotStarted, false);
  assert.equal(bridge.productionReleaseAuthorized, false);
  assert.equal(bridge.patientUseAuthorized, false);

  const tampered = structuredClone(receiptEvent);
  tampered.receipt.assertions[0].outcome = "rejected";
  assert.ok(validateAuthorityTrustEvent(tampered, {
    sequence: 2,
    previousHash: fixture.challengeEvent.hash,
    registry: fixture.registry,
    challenge: fixture.challengeEvent.challenge,
    now: receiptEvent.createdAt
  }).length > 0);
});

test("store persists and re-verifies the signed authority chain and fails startup after receipt tampering", async t => {
  const fixture = trustFixture();
  const directory = await mkdtemp(join(tmpdir(), "perl-authority-trust-"));
  const filePath = join(directory, "sandbox-state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider(),
    authorityTrustRegistry: fixture.registry,
    clock: () => new Date("2026-08-14T12:02:00.000Z")
  });
  const store = make();
  await store.init();
  assert.equal(store.state.schemaVersion, 49);
  const issued = await store.issueAuthorityTrustChallenge("north-central-counseling-center", "TRUST-STORE-QA");
  const receipt = signedReceipt({ ...fixture, challengeEvent: issued.event });
  const verified = await store.verifyAuthorityTrustReceipt(receipt, "TRUST-STORE-QA");
  assert.equal(verified.authorityTrust.chain.valid, true);
  assert.equal(verified.authorityTrust.chain.count, 2);
  assert.equal(verified.authorityTrust.candidates[0].counts.satisfiedScopes, 1);
  assert.equal(verified.authorityTrust.candidates[0].pilotAuthorizationRecorded, false);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyAuthorityTrustEventChain().verifiedReceipts, 1);

  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.authorityTrustEvents[1].receipt.assertions[0].referenceHash = HASH_B;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /authority-trust receipt history integrity/i.test(error.message));
});

test("schema 33 migrates through schema 45 without inventing authority, reference drafts, adjudication, reference decisions, review admission, campus review posture, candidate returns, candidate reviews, a pilot start, release authority, traffic, or identity access", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-authority-migration-"));
  const filePath = join(directory, "sandbox-state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider()
  });
  const initial = make();
  await initial.init();
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 33;
  delete legacy.authorityTrustEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");
  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateReturnEvents, []);
  assert.deepEqual(migrated.state.campusObservatoryEvents, []);
  assert.deepEqual(migrated.state.independentReviewAdmissionEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceAdjudicationEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceDrafts, []);
  assert.deepEqual(migrated.state.authorityTrustEvents, []);
  assert.deepEqual(migrated.state.pilotStartEvents, []);
  assert.deepEqual(migrated.state.clinicalReleaseEvents, []);
  assert.deepEqual(migrated.state.identityAccessEvents, []);
  const status = await migrated.authorityTrustStatus();
  assert.equal(status.registry.externallyProvisioned, false);
  assert.equal(status.counts.verifiedReceipts, 0);
  assert.equal(status.counts.candidatesWithPilotAuthorization, 0);
  assert.equal(status.pilotStarted, false);
});

test("HTTP bridge is disabled by default and verifies receipts only against a startup-provisioned registry", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-authority-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const disabledRuntime = await createPerlServer({
    storePath: join(directory, "disabled-state.json"),
    clock: () => new Date("2026-08-14T12:02:00.000Z")
  });
  await new Promise((resolve, reject) => {
    disabledRuntime.server.once("error", reject);
    disabledRuntime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => disabledRuntime.server.close(resolve)));
  const disabledBase = `http://127.0.0.1:${disabledRuntime.server.address().port}`;
  const health = await fetch(`${disabledBase}/api/health`).then(response => response.json());
  assert.equal(health.authorityTrust.trustRootsProvisioned, false);
  assert.equal(health.authorityTrust.registryWriteApiAvailable, false);
  const denied = await fetch(`${disabledBase}/api/governance/authority-trust/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId: "north-central-counseling-center" })
  });
  assert.equal(denied.status, 409);

  const fixture = trustFixture();
  const runtime = await createPerlServer({
    storePath: join(directory, "trusted-state.json"),
    authorityTrustRegistry: fixture.registry,
    clock: () => new Date("2026-08-14T12:02:00.000Z")
  });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  const challengeResponse = await fetch(`${base}/api/governance/authority-trust/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "TRUST-API-QA" },
    body: JSON.stringify({ candidateId: "north-central-counseling-center" })
  });
  const issued = await challengeResponse.json();
  assert.equal(challengeResponse.status, 201);
  assert.equal(issued.challenge.requiredScopes.length, 36);
  const receipt = signedReceipt({ ...fixture, challengeEvent: issued.event });
  const receiptResponse = await fetch(`${base}/api/governance/authority-trust/receipts/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "TRUST-API-QA" },
    body: JSON.stringify({ receipt })
  });
  const verified = await receiptResponse.json();
  assert.equal(receiptResponse.status, 201);
  assert.equal(verified.authorityTrust.chain.valid, true);
  assert.equal(verified.authorityTrust.counts.verifiedReceipts, 1);
  assert.equal(verified.authorityTrust.pilotStarted, false);
  const registryWrite = await fetch(`${base}/api/governance/authority-trust/registry`, { method: "PUT" });
  assert.equal(registryWrite.status, 404);
});

test("authority-trust schema and surface lock cryptographic verification without local key creation", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/authority-trust-event.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../authority-trust.css", import.meta.url), "utf8");
  assert.equal(schema.oneOf.length, 2);
  assert.equal(schema.$defs.receipt.properties.signature.properties.algorithm.const, "Ed25519");
  assert.equal(schema.$defs.receipt.properties.signature.properties.value.pattern, "^[A-Za-z0-9_-]{86}$");
  assert.equal(schema.$defs.assertion.oneOf.length, 2);
  assert.equal(schema.$defs.contentBoundary.properties.phiIncluded.const, false);
  assert.match(html, /Trust doesn’t arrive as a checkbox/);
  assert.match(html, /id="authority-trust-receipt-file"[^>]*type="file"/);
  assert.doesNotMatch(html, /create trust key|add trust key|upload private key|private-key-input/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*4[48]px/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
