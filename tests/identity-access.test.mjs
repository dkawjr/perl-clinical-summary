import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createPerlServer } from "../server.mjs";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import {
  IDENTITY_ACCESS_CONTRACT,
  IDENTITY_ACCESS_EVENT_CONTRACT,
  IDENTITY_ACCESS_POLICY_CONTRACT,
  IDENTITY_ROLES,
  accessRequirement,
  createIdentityAccessEvent,
  createIdentityAccessGateway,
  disabledIdentityAccessPolicy,
  validateIdentityAccessEvent,
  validateIdentityAccessPolicy,
  verifyIdentityAccessToken
} from "../src/identity-access.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";

const NOW = "2026-08-14T12:00:00.000Z";

function fixture() {
  const keys = generateKeyPairSync("ed25519");
  const policy = {
    contractVersion: IDENTITY_ACCESS_POLICY_CONTRACT,
    policyId: "FF-IDENTITY-POLICY-QA-2026",
    version: "1.0.0",
    issuer: "https://identity.focusedfuture.example/",
    audience: "perl-clinical-summary",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    maximumSessionSeconds: 900,
    keys: [{
      keyId: "FF-IDENTITY-KEY-QA-2026",
      algorithm: "Ed25519",
      publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }),
      notBefore: "2026-08-14T00:00:00.000Z",
      notAfter: "2026-08-16T00:00:00.000Z"
    }]
  };
  return { keys, policy };
}

function token(context, { roles = ["operations-operator"], sub = "FF-ID-OPERATIONS-01", now = NOW, overrides = {}, headerOverrides = {} } = {}) {
  const nowSeconds = Math.floor(Date.parse(now) / 1000);
  const header = { alg: "EdDSA", kid: context.policy.keys[0].keyId, typ: "JWT", ...headerOverrides };
  const claims = {
    iss: context.policy.issuer,
    aud: context.policy.audience,
    sub,
    jti: randomUUID(),
    iat: nowSeconds,
    nbf: nowSeconds,
    exp: nowSeconds + 600,
    roles,
    ...overrides
  };
  const signingInput = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${signingInput}.${sign(null, Buffer.from(signingInput), context.keys.privateKey).toString("base64url")}`;
}

async function withServer(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "perl-identity-access-api-"));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), clock: () => new Date(NOW), ...options });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise(resolve => runtime.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${runtime.server.address().port}`, runtime };
}

test("identity perimeter defaults to synthetic codes and fixes seven least-privilege roles", () => {
  assert.deepEqual(validateIdentityAccessPolicy(disabledIdentityAccessPolicy()), []);
  assert.equal(IDENTITY_ROLES.length, 7);
  assert.equal(new Set(IDENTITY_ROLES.map(role => role.id)).size, 7);
  const gateway = createIdentityAccessGateway({ clock: () => new Date(NOW) });
  assert.equal(gateway.status().authenticationRequired, false);
  assert.equal(gateway.status().authorizationEnforced, false);
  const identity = gateway.authorize({ "x-perl-demo-actor": "REVIEWER-01" }, "/api/changes", "POST");
  assert.equal(identity.actorRef, "REVIEWER-01");
  assert.equal(identity.authenticated, false);
  assert.equal(identity.auditRequired, true);
  assert.deepEqual(accessRequirement("/api/operations/recovery/rehearse", "POST"), { public: false, permission: "operations:operate", routeClass: "operations", auditRequired: true });
  assert.equal(accessRequirement("/api/live", "GET").public, true);
  assert.equal(accessRequirement("/api/ready", "HEAD").public, true);
  assert.equal(accessRequirement("/api/assessments/FF-TEST-2407-A/approve", "POST").permission, "clinical:approve");
  assert.equal(accessRequirement("/api/health", "POST").public, false);
});

test("short-lived Ed25519 assertions verify exact identity claims and fail closed", () => {
  const context = fixture();
  assert.deepEqual(validateIdentityAccessPolicy(context.policy, { allowDisabled: false }), []);
  const wrongKey = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const wrongKeyPolicy = structuredClone(context.policy);
  wrongKeyPolicy.keys[0].publicKeyPem = wrongKey.publicKey.export({ type: "spki", format: "pem" });
  assert.ok(validateIdentityAccessPolicy(wrongKeyPolicy, { allowDisabled: false }).some(error => /valid Ed25519 SPKI key/i.test(error)));
  const assertion = token(context);
  const identity = verifyIdentityAccessToken(assertion, context.policy, NOW);
  assert.equal(identity.actorRef, "FF-ID-OPERATIONS-01");
  assert.deepEqual(identity.roles, ["operations-operator"]);
  assert.equal(identity.signatureVerified, true);
  assert.equal(Object.hasOwn(identity, "token"), false);

  const assertionParts = assertion.split(".");
  assertionParts[2] = `${assertionParts[2][0] === "A" ? "B" : "A"}${assertionParts[2].slice(1)}`;
  assert.throws(() => verifyIdentityAccessToken(assertionParts.join("."), context.policy, NOW), /signature is invalid/i);
  assert.throws(() => verifyIdentityAccessToken(token(context, { overrides: { aud: "another-product" } }), context.policy, NOW), /issuer or audience/i);
  assert.throws(() => verifyIdentityAccessToken(token(context, { overrides: { exp: Math.floor(Date.parse(NOW) / 1000) + 901 } }), context.policy, NOW), /time claims/i);
  assert.throws(() => verifyIdentityAccessToken(token(context, { roles: ["root"] }), context.policy, NOW), /roles are invalid/i);
  assert.throws(() => verifyIdentityAccessToken(token(context, { headerOverrides: { alg: "RS256" } }), context.policy, NOW), /trusted EdDSA JWT key/i);
});

test("RBAC grants only fixed route permissions and authenticated mutation events exclude credentials", () => {
  const context = fixture();
  const gateway = createIdentityAccessGateway({ policy: context.policy, clock: () => new Date(NOW) });
  const operations = token(context);
  const allowed = gateway.authorize({ authorization: `Bearer ${operations}` }, "/api/operations/recovery/rehearse", "POST");
  assert.equal(allowed.permission, "operations:operate");
  assert.equal(allowed.authenticated, true);
  assert.throws(() => gateway.authorize({ authorization: `Bearer ${operations}` }, "/api/governance/readiness/snapshot", "POST"), /does not grant governance:verify/i);
  assert.throws(() => gateway.authorize({}, "/api/assessments", "GET"), /bearer assertion is required/i);

  const event = createIdentityAccessEvent({ identity: allowed, method: "POST", routeClass: allowed.routeClass, permission: allowed.permission, sequence: 1, previousHash: "GENESIS", createdAt: NOW, id: "11111111-1111-4111-8111-111111111111" });
  assert.deepEqual(validateIdentityAccessEvent(event, { sequence: 1, previousHash: "GENESIS" }), []);
  assert.equal(event.bearerTokenStored, false);
  assert.equal(event.passwordStored, false);
  assert.equal(event.humanNameStored, false);
  assert.equal(event.phiStored, false);
  assert.equal(Object.hasOwn(event, "token"), false);
  const tampered = structuredClone(event);
  tampered.permission = "governance:verify";
  assert.ok(validateIdentityAccessEvent(tampered, { sequence: 1, previousHash: "GENESIS" }).length > 0);
});

test("schema 37 migrates to schema 45 without inventing an authenticated identity event, counselor reference draft, adjudication snapshot, reference decision, review admission, campus review posture, candidate return, or candidate review", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-identity-access-migration-"));
  const filePath = join(directory, "state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider(), clock: () => new Date(NOW) });
  await make().init();
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 37;
  delete legacy.identityAccessEvents;
  await writeFile(filePath, JSON.stringify(legacy), { encoding: "utf8", mode: 0o600 });
  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateReturnEvents, []);
  assert.deepEqual(migrated.state.campusObservatoryEvents, []);
  assert.deepEqual(migrated.state.independentReviewAdmissionEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceAdjudicationEvents, []);
  assert.deepEqual(migrated.state.identityAccessEvents, []);
  assert.deepEqual(migrated.state.counselorReferenceDrafts, []);
  const status = await migrated.identityAccessStatus(createIdentityAccessGateway({ clock: () => new Date(NOW) }).status());
  assert.equal(status.authenticatedMutationCount, 0);
  assert.equal(status.chain.valid, true);
  assert.equal(status.bearerTokensStored, false);
});

test("HTTP perimeter keeps health public, enforces signed RBAC, and persists successful mutation grants", async t => {
  const context = fixture();
  const { base, runtime } = await withServer(t, { identityAccessPolicy: context.policy });
  const healthResponse = await fetch(`${base}/api/health`);
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.integration.identityAccessContract, IDENTITY_ACCESS_CONTRACT);
  assert.equal(health.identityAccess.authenticationRequired, true);
  assert.equal(health.identityAccess.authorizationEnforced, true);
  assert.equal(health.identityAccess.bearerTokensStored, false);
  assert.equal(Object.hasOwn(health.identityAccess, "trustedKeys"), false);
  assert.equal(Object.hasOwn(health.identityAccess, "policyId"), false);

  const publicStatus = await fetch(`${base}/api/security/identity/public`).then(response => response.json());
  assert.equal(publicStatus.identityAccess.trustedKeyCount, 1);
  assert.equal(publicStatus.identityAccess.productionSsoConnected, false);
  assert.equal(Object.hasOwn(publicStatus.identityAccess, "trustedKeys"), false);

  const missing = await fetch(`${base}/api/assessments`);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get("www-authenticate") || "", /Bearer realm="PERL"/);

  const auditorToken = token(context, { roles: ["read-only-auditor"], sub: "FF-ID-AUDITOR-01" });
  const auditorHeaders = { Authorization: `Bearer ${auditorToken}`, "Content-Type": "application/json" };
  assert.equal((await fetch(`${base}/api/assessments`, { headers: auditorHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/operations/recovery/rehearse`, { method: "POST", headers: auditorHeaders, body: "{}" })).status, 403);
  assert.equal(runtime.store.verifyIdentityAccessEventChain().count, 0);

  const operationsToken = token(context);
  const operationsHeaders = { Authorization: `Bearer ${operationsToken}`, "Content-Type": "application/json" };
  const rehearsal = await fetch(`${base}/api/operations/recovery/rehearse`, { method: "POST", headers: operationsHeaders, body: "{}" });
  assert.equal(rehearsal.status, 200);
  const status = await fetch(`${base}/api/security/identity`, { headers: operationsHeaders }).then(response => response.json());
  assert.equal(status.identityAccess.authenticatedMutationCount, 1);
  assert.equal(status.identityAccess.history[0].actorRef, "FF-ID-OPERATIONS-01");
  assert.equal(status.identityAccess.history[0].permission, "operations:operate");
  assert.equal(status.identityAccess.chain.valid, true);
  assert.equal(JSON.stringify(status).includes(operationsToken), false);
});

test("identity ledger fails startup after a persisted decision is altered", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-identity-access-tamper-"));
  const filePath = join(directory, "state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const context = fixture();
  const store = new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider(), clock: () => new Date(NOW) });
  await store.init();
  const gateway = createIdentityAccessGateway({ policy: context.policy, clock: () => new Date(NOW) });
  const identity = gateway.authorize({ authorization: `Bearer ${token(context)}` }, "/api/operations/recovery/rehearse", "POST");
  await store.recordIdentityAccessDecision(identity, { method: "POST", routeClass: identity.routeClass, permission: identity.permission });
  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  persisted.identityAccessEvents[0].actorRef = "FF-ID-ALTERED-01";
  await writeFile(filePath, JSON.stringify(persisted), { encoding: "utf8", mode: 0o600 });
  const reopened = new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider(), clock: () => new Date(NOW) });
  await assert.rejects(() => reopened.init(), /Identity-access decision history integrity check failed/i);
});

test("published identity surface and schema expose the boundary without login or token collection", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../identity-access.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/api-client.js", import.meta.url), "utf8");
  const schema = JSON.parse(await readFile(new URL("../schemas/identity-access-event.schema.json", import.meta.url), "utf8"));
  assert.match(html, /A role is not a label\. It is a permission boundary\./);
  assert.match(html, /identity begins outside this screen/i);
  assert.doesNotMatch(html, /type="password"|id="identity-access-token"/i);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(app, /function renderIdentityAccess/);
  assert.match(client, /setAccessToken/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
  assert.equal(schema.properties.contractVersion.const, IDENTITY_ACCESS_EVENT_CONTRACT);
  assert.equal(schema.properties.bearerTokenStored.const, false);
  assert.equal(schema.properties.passwordStored.const, false);
  assert.equal(schema.properties.phiStored.const, false);
});
