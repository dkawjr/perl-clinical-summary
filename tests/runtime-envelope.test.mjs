import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPerlServer, startPerlServer } from "../server.mjs";
import {
  RUNTIME_ENVELOPE_CONTRACT,
  RuntimeEnvelope,
  createRuntimeEnvelope,
  loadRuntimeEnvelopePolicyFile,
  runtimeEnvelopePolicyTemplate,
  validateContainerBuildAssets,
  validateRuntimeEnvelopePolicy
} from "../src/runtime-envelope.js";

const NOW = "2026-08-14T12:00:00.000Z";
const clock = () => new Date(NOW);

async function temporaryDirectory() {
  return mkdtemp(join(tmpdir(), "perl-runtime-envelope-"));
}

function policy(dataDirectory, overrides = {}) {
  return {
    ...runtimeEnvelopePolicyTemplate(),
    policyId: "FF-RUNTIME-POLICY-TEST-001",
    dataDirectory,
    ...overrides
  };
}

async function listen(runtime) {
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const address = runtime.server.address();
  return `http://127.0.0.1:${address.port}`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => resolve({ code, stdout, stderr }));
  });
}

test("runtime policy is exact, current, fixed to the container boundary, and non-root", async () => {
  const directory = await temporaryDirectory();
  assert.deepEqual(validateRuntimeEnvelopePolicy(policy(directory), clock), []);
  assert.match(validateRuntimeEnvelopePolicy({ ...policy(directory), port: 8080 }, clock).join(" "), /fixed internal port/);
  assert.match(validateRuntimeEnvelopePolicy({ ...policy(directory), publicBaseUrl: "http://example.test/" }, clock).join(" "), /HTTPS origin/);
  assert.throws(() => new RuntimeEnvelope({ policy: policy(directory), clock, processUid: 0 }), /non-root process identity/);

  const envelope = await createRuntimeEnvelope({ policy: policy(directory), clock, processUid: 10001 });
  assert.equal(envelope.publicStatus().mode, "policy-controlled-synthetic-container");
  assert.equal(envelope.publicStatus().dataMountPrepared, true);
  assert.equal(envelope.publicStatus().containerImageBuilt, false);
});

test("runtime policy loader rejects broad permissions and symbolic links", async () => {
  const directory = await temporaryDirectory();
  const policyPath = join(directory, "runtime-policy.json");
  await writeFile(policyPath, JSON.stringify(policy(join(directory, "data"))), { mode: 0o600 });
  assert.equal((await loadRuntimeEnvelopePolicyFile(policyPath, clock)).policyId, "FF-RUNTIME-POLICY-TEST-001");
  await chmod(policyPath, 0o644);
  await assert.rejects(() => loadRuntimeEnvelopePolicyFile(policyPath, clock), /owner-only/);
  await chmod(policyPath, 0o600);
  const linkPath = join(directory, "runtime-policy-link.json");
  await symlink(policyPath, linkPath);
  await assert.rejects(() => loadRuntimeEnvelopePolicyFile(linkPath, clock), /non-symlink/);
});

test("liveness stays separate from readiness and drain immediately removes readiness", async () => {
  const directory = await temporaryDirectory();
  const envelope = await createRuntimeEnvelope({ dataDirectory: directory, clock, processUid: 501 });
  envelope.markInitialized();
  envelope.markListening();
  assert.equal(envelope.liveness().status, "live");
  assert.equal(envelope.readiness().status, "ready");
  assert.equal(envelope.readiness().authority.patientUseAuthorized, false);
  assert.equal(envelope.beginShutdown("SIGTERM"), true);
  assert.equal(envelope.beginShutdown("SIGINT"), false);
  assert.equal(envelope.liveness().status, "draining");
  assert.equal(envelope.readiness().status, "draining");
  assert.equal(envelope.readiness().ok, false);
});

test("public probe endpoints report bounded runtime state and health exports the contract", async t => {
  const directory = await temporaryDirectory();
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), clock });
  const base = await listen(runtime);
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));

  const liveResponse = await fetch(`${base}/api/live`);
  const live = await liveResponse.json();
  assert.equal(liveResponse.status, 200);
  assert.equal(live.contractVersion, RUNTIME_ENVELOPE_CONTRACT);
  assert.equal(live.processAlive, true);

  const readyResponse = await fetch(`${base}/api/ready`);
  const ready = await readyResponse.json();
  assert.equal(readyResponse.status, 200);
  assert.equal(ready.status, "ready");
  assert.equal(ready.authority.containerImageBuilt, false);

  const health = await fetch(`${base}/api/health`).then(response => response.json());
  assert.equal(health.integration.runtimeEnvelopeContract, RUNTIME_ENVELOPE_CONTRACT);
  assert.equal(health.runtime.policyConfigured, false);
  assert.equal(health.runtime.patientUseAuthorized, false);

  const probe = await run(process.execPath, [fileURLToPath(new URL("../tools/runtime-healthcheck.mjs", import.meta.url))], {
    env: { ...process.env, PORT: String(new URL(base).port) }
  });
  assert.equal(probe.code, 0, probe.stderr);
});

test("container assets are dependency-free, digest-input-only, non-root, and probe-bounded", async () => {
  const [containerfile, healthcheck, schema] = await Promise.all([
    readFile(new URL("../deploy/Containerfile", import.meta.url), "utf8"),
    readFile(new URL("../tools/runtime-healthcheck.mjs", import.meta.url), "utf8"),
    readFile(new URL("../schemas/runtime-envelope-policy.schema.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.deepEqual(validateContainerBuildAssets({ containerfile, healthcheck }), []);
  assert.equal(schema.properties.contractVersion.const, "perl-runtime-envelope-policy/1.0");
  assert.equal(schema.additionalProperties, false);
});

test("production-style startup fails closed when its required runtime policy is missing", async () => {
  const result = await run(process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url))], {
    env: { ...process.env, PERL_REQUIRE_RUNTIME_POLICY: "true", PERL_RUNTIME_POLICY_FILE: "" }
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /requires an owner-only PERL_RUNTIME_POLICY_FILE/);
});

test("server shutdown is idempotent, graceful, and removes readiness before exit", async () => {
  const directory = await temporaryDirectory();
  const runtime = await startPerlServer({ port: 0, storePath: join(directory, "state.json") });
  const first = runtime.shutdown("SIGTERM");
  const second = runtime.shutdown("SIGINT");
  assert.equal(first, second);
  const result = await first;
  assert.deepEqual(result, { graceful: true, signal: "SIGTERM" });
  assert.equal(runtime.server.listening, false);
  assert.equal(runtime.runtimeEnvelope.liveness().status, "draining");
  assert.equal(runtime.runtimeEnvelope.readiness().ok, false);
  assert.equal(runtime.runtimeEnvelope.shutdownSignal, "SIGTERM");
});
