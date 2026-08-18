import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadModelTransportPolicyFile } from "../server.mjs";
import { assessments } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { generationGatewayStatus } from "../src/model-gateway.js";
import { createModelProvider } from "../src/model-provider.js";
import {
  MODEL_TRANSPORT_CONTRACT,
  MODEL_TRANSPORT_POLICY_CONTRACT,
  createHttpsModelTransport,
  summarizeModelTransportPolicy,
  validateModelTransportPolicy
} from "../src/model-transport.js";

const NOW = "2026-08-14T12:00:00.000Z";
const TOKEN = "synthetic-candidate-token-with-at-least-32-characters";

function policy(overrides = {}) {
  return {
    contractVersion: MODEL_TRANSPORT_POLICY_CONTRACT,
    policyId: "FF-MODEL-TRANSPORT-QA-2026",
    version: "1.0.0",
    status: "approved-for-synthetic-calibration",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
    endpoint: "https://candidate.focusedfuture.example/v1/perl/generate",
    timeoutMs: 15000,
    maximumRequestBytes: 131072,
    credential: {
      type: "bearer-environment",
      environmentVariable: "PERL_MODEL_CANDIDATE_TOKEN"
    },
    candidate: {
      providerId: "candidate-bridge-qa",
      modelVersion: "candidate-version-2026-08-14",
      promptVersion: "perl-candidate-prompt/1.0",
      approvedBy: "MODEL-GOVERNANCE-QA"
    },
    ...overrides
  };
}

function validBundle(assessment) {
  return {
    narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(assessment, audience)])),
    interpretation: generateClinicalInterpretation(assessment)
  };
}

test("model-transport policy is exact, HTTPS-only, time-bound, and synthetic-only", () => {
  const candidatePolicy = policy();
  assert.deepEqual(validateModelTransportPolicy(candidatePolicy), []);
  assert.ok(validateModelTransportPolicy(policy({ endpoint: "http://candidate.example/v1/generate" })).some(error => /HTTPS path/i.test(error)));
  assert.ok(validateModelTransportPolicy(policy({ status: "approved-for-production" })).some(error => /synthetic calibration only/i.test(error)));
  assert.ok(validateModelTransportPolicy({ ...candidatePolicy, extra: true }).some(error => /exactly/i.test(error)));
  assert.ok(validateModelTransportPolicy(policy({ credential: { type: "bearer-environment", environmentVariable: "AWS_SECRET_ACCESS_KEY" } })).some(error => /PERL_MODEL/i.test(error)));

  const status = summarizeModelTransportPolicy(candidatePolicy, { now: NOW, credentialAvailable: true });
  assert.equal(status.contractVersion, MODEL_TRANSPORT_CONTRACT);
  assert.equal(status.policyCurrent, true);
  assert.equal(status.authorizationScope, "synthetic-calibration-only");
  assert.equal(status.credentialPersisted, false);
  assert.equal(status.credentialExposedByApi, false);
  assert.equal(status.retryCount, 0);
  assert.equal(status.fallbackEnabled, false);
  assert.equal(status.phiApproved, false);
  assert.equal(Object.hasOwn(status, "endpoint"), false);
  assert.equal(Object.hasOwn(status, "environmentVariable"), false);
});

test("HTTPS candidate bridge sends one bounded scoring-only request and exposes no secret", async () => {
  const assessment = assessments[0];
  let captured;
  const provider = createModelProvider({
    provider: "structured-candidate-https",
    policy: policy(),
    credential: TOKEN,
    clock: () => new Date(NOW),
    fetchImpl: async (url, options) => {
      captured = { url, options, request: JSON.parse(options.body) };
      return new Response(JSON.stringify(validBundle(assessment)), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
    }
  });
  const generated = await provider.generateCase(assessment);
  assert.equal(generated.narratives.clinician.provider, "candidate-bridge-qa");
  assert.equal(captured.url, policy().endpoint);
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(captured.options.headers["Idempotency-Key"], captured.request.requestId);
  assert.equal(captured.request.payload.itemsAnswered, 105);

  const serializedRequest = JSON.stringify(captured.request);
  for (const privateValue of [assessment.id, assessment.source, assessment.completedAt, assessment.reviewer, assessment.criticalResponses[0].note]) {
    assert.equal(serializedRequest.includes(privateValue), false);
  }
  const gateway = generationGatewayStatus(provider);
  const serializedStatus = JSON.stringify(gateway);
  assert.equal(gateway.transport.mode, "authenticated-https-bridge");
  assert.equal(gateway.transport.policyCurrent, true);
  assert.equal(gateway.transport.credentialAvailable, true);
  assert.equal(serializedStatus.includes(TOKEN), false);
  assert.equal(serializedStatus.includes(policy().endpoint), false);
  assert.equal(serializedStatus.includes(policy().credential.environmentVariable), false);
});

test("HTTPS candidate bridge rejects unsafe responses and never falls back", async () => {
  const assessment = assessments[1];
  const cases = [
    async () => new Response("upstream detail with secret", { status: 503, headers: { "Content-Type": "text/plain" } }),
    async () => new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    async () => new Response("x".repeat(65537), { status: 200, headers: { "Content-Type": "application/json", "Content-Length": "65537" } })
  ];
  for (const fetchImpl of cases) {
    const provider = createModelProvider({ provider: "structured-candidate-https", policy: policy(), credential: TOKEN, clock: () => new Date(NOW), fetchImpl });
    await assert.rejects(
      () => provider.generateCase(assessment),
      error => ["MODEL_UNAVAILABLE", "MODEL_OUTPUT_REJECTED"].includes(error.code) && !error.message.includes("upstream detail") && !error.message.includes("secret")
    );
  }
  assert.throws(
    () => createHttpsModelTransport({ policy: policy(), credential: "too-short", clock: () => new Date(NOW), fetchImpl: async () => null }),
    /bounded opaque startup credential/i
  );
  assert.throws(
    () => createHttpsModelTransport({ policy: policy({ expiresAt: "2026-08-14T01:00:00.000Z" }), credential: TOKEN, clock: () => new Date(NOW), fetchImpl: async () => null }),
    /not current/i
  );
});

test("startup policy loader requires a private regular JSON file", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-model-transport-policy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "policy.json");
  await writeFile(filePath, JSON.stringify(policy()), { encoding: "utf8", mode: 0o600 });
  assert.deepEqual(await loadModelTransportPolicyFile(filePath), policy());
  await chmod(filePath, 0o644);
  await assert.rejects(() => loadModelTransportPolicyFile(filePath), /owner-only/i);
});

test("published transport policy schema excludes credentials and arbitrary extensions", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/model-transport-policy.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, MODEL_TRANSPORT_POLICY_CONTRACT);
  assert.equal(schema.properties.status.const, "approved-for-synthetic-calibration");
  assert.equal(schema.properties.credential.additionalProperties, false);
  assert.equal(Object.hasOwn(schema.properties.credential.properties, "value"), false);
  assert.equal(Object.hasOwn(schema.properties, "apiKey"), false);
});
