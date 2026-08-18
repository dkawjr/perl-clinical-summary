import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createPerlServer, loadReleasePromotionTrustPolicyFile } from "../server.mjs";
import { ReleaseAdmissionRepository } from "../src/release-admission.js";
import { ReleaseCandidateRepository, canonicalJson, sha256 } from "../src/release-candidate.js";
import {
  RELEASE_PROMOTION_ATTESTATION_CONTRACT,
  RELEASE_PROMOTION_CONTRACT,
  RELEASE_PROMOTION_GATES,
  RELEASE_PROMOTION_REQUEST_CONTRACT,
  RELEASE_PROMOTION_TRUST_POLICY_CONTRACT,
  ReleasePromotionRepository,
  releasePromotionAttestationTemplate,
  validateReleasePromotionRequest,
  validateReleasePromotionTrustPolicy,
  verifyReleasePromotionAttestation
} from "../src/release-promotion.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const NOW = "2026-08-14T12:00:00.000Z";
const DIGEST = sha256("external-evidence");

function successfulAdmissionRun() {
  return {
    checks: ["archive-integrity", "fixture-completeness", "dependency-boundary", "full-archive-tests", "clinical-calibration", "ephemeral-cleanup"].map((id, index) => ({ id, label: `Check ${index + 1}`, status: "passed", evidence: { verified: true } })),
    environment: { executionMode: "local-ephemeral-owner-only-copy", runtime: process.version, platform: process.platform, architecture: process.arch, shellUsed: false, credentialEnvironmentInherited: false, networkIsolationEnforced: false }
  };
}

function promotionPolicy(publicKeyPem, overrides = {}) {
  return {
    contractVersion: RELEASE_PROMOTION_TRUST_POLICY_CONTRACT,
    status: "approved-for-promotion-verification",
    policyId: "FF-PROMOTION-POLICY-QA-2026",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    signerRole: "production-promotion-attestation-authority",
    keyId: "promotion-qa-ed25519",
    algorithm: "Ed25519",
    publicKeyPem,
    maxAttestationAgeSeconds: 604800,
    ...overrides
  };
}

function signedAttestation(request, privateKey, overrides = {}) {
  const template = releasePromotionAttestationTemplate(request);
  const payload = {
    ...template,
    execution: {
      system: "Azure-Trusted-Pipeline",
      runId: "azdo:perl:20260814.42",
      runUri: "https://dev.azure.com/focused-future/perl/_build/results?buildId=42",
      startedAt: "2026-08-14T11:40:00.000Z",
      completedAt: "2026-08-14T11:55:00.000Z",
      isolatedRunner: true,
      networkPolicy: "deny-by-default",
      credentialIsolation: true,
      workloadIdentity: true
    },
    image: {
      repository: "focusedfuture.azurecr.io/perl-clinical-summary",
      digest: `sha256:${sha256("oci-image")}`,
      registryResourceId: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/perl-production/providers/Microsoft.ContainerRegistry/registries/focusedfuture",
      immutable: true
    },
    gates: RELEASE_PROMOTION_GATES.map(gate => ({ id: gate.id, status: "passed", evidenceRef: `urn:focused-future:promotion-evidence:${gate.id}`, evidenceSha256: sha256(gate.id) })),
    issuedAt: "2026-08-14T12:00:00.000Z",
    expiresAt: "2026-08-21T12:00:00.000Z",
    keyId: "promotion-qa-ed25519",
    ...overrides,
    signature: null
  };
  const { signature: _signature, ...unsigned } = payload;
  return { ...unsigned, signature: sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString("base64") };
}

async function fixture(root, { trustPolicy } = {}) {
  const releaseRepository = new ReleaseCandidateRepository({ sourceRoot: projectRoot, repositoryRoot: join(root, "releases"), clock: () => new Date(NOW) });
  const built = await releaseRepository.build("PROMOTION-QA");
  const admissionRepository = new ReleaseAdmissionRepository({ releaseRepository, repositoryRoot: join(root, "admissions"), qualifier: async () => successfulAdmissionRun(), clock: () => new Date(NOW) });
  await admissionRepository.qualify(built.candidate.artifactId, "PROMOTION-QA");
  const promotionRepository = new ReleasePromotionRepository({ releaseRepository, admissionRepository, repositoryRoot: join(root, "promotions"), ...(trustPolicy ? { trustPolicy } : {}), clock: () => new Date(NOW) });
  return { releaseRepository, admissionRepository, promotionRepository, candidateId: built.candidate.artifactId };
}

test("promotion request deterministically binds the qualified archive to ten external gates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-promotion-request-test-"));
  try {
    const { promotionRepository, candidateId } = await fixture(directory);
    const first = await promotionRepository.prepare(candidateId);
    const second = await promotionRepository.prepare(candidateId);
    assert.equal(first.contractVersion, RELEASE_PROMOTION_CONTRACT);
    assert.equal(first.request.requestId, second.request.requestId);
    assert.equal(second.idempotent, true);
    assert.equal(first.status, "external-evidence-required");
    assert.equal(first.latest.gateCount, 10);
    assert.equal(first.trust.mode, "disabled");
    assert.equal(first.externalEvidenceVerified, false);
    assert.equal(first.deploymentAuthorized, false);
    const request = JSON.parse(await readFile(join(directory, "promotions", first.request.requestId, "request.json"), "utf8"));
    assert.equal(request.contractVersion, RELEASE_PROMOTION_REQUEST_CONTRACT);
    assert.equal(request.artifact.artifactId, candidateId);
    assert.equal(request.localAdmission.status, "qualified-local");
    assert.deepEqual(validateReleasePromotionRequest(request), []);
    assert.equal((await stat(join(directory, "promotions", first.request.requestId, "request.json"))).mode & 0o777, 0o400);
    assert.equal((await stat(join(directory, "promotions"))).mode & 0o777, 0o700);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a trusted external Ed25519 attestation verifies all gates without granting deployment or clinical authority", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-promotion-attestation-test-"));
  try {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const policy = promotionPolicy(publicKey.export({ type: "spki", format: "pem" }));
    const { promotionRepository, candidateId } = await fixture(directory, { trustPolicy: policy });
    const prepared = await promotionRepository.prepare(candidateId);
    const request = (await promotionRepository.readPromotion(prepared.request.requestId)).request;
    const attestation = signedAttestation(request, privateKey);
    const verified = verifyReleasePromotionAttestation(attestation, policy, request, () => new Date(NOW));
    assert.equal(verified.status, "verified-external-promotion-evidence");
    assert.equal(verified.gateCount, 10);
    assert.equal(verified.productionArtifactPromoted, true);
    assert.equal(verified.deploymentAuthorized, false);
    assert.equal(verified.azureDeploymentPerformed, false);
    assert.equal(verified.clinicalReleaseAuthorized, false);
    assert.equal(verified.patientUseAuthorized, false);
    const result = await promotionRepository.verifyAndStoreAttestation(attestation);
    assert.equal(result.status, "verified-external-promotion-evidence");
    assert.equal(result.externalEvidenceVerified, true);
    assert.equal(result.latest.verified.privateKeyReceived, false);
    assert.equal((await stat(join(directory, "promotions", request.requestId, "verified-attestation.json"))).mode & 0o777, 0o400);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("promotion API accepts a complete trusted return end to end and keeps the deployment switch absent", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-promotion-api-test-"));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const policy = promotionPolicy(publicKey.export({ type: "spki", format: "pem" }));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), releasePromotionTrustPolicy: policy, releaseAdmissionQualifier: async () => successfulAdmissionRun(), clock: () => new Date(NOW) });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise(resolve => runtime.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${runtime.server.address().port}`;
  const built = await fetch(`${base}/api/operations/release/build`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(response => response.json());
  await fetch(`${base}/api/operations/release/candidates/${built.candidate.artifactId}/admission/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const prepared = await fetch(`${base}/api/operations/release/candidates/${built.candidate.artifactId}/promotion/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(response => response.json());
  const request = await fetch(`${base}${prepared.latest.downloads.request}`).then(response => response.json());
  const attestation = signedAttestation(request, privateKey);
  const response = await fetch(`${base}/api/operations/release/promotions/attestations/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attestation }) });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.status, "verified-external-promotion-evidence");
  assert.equal(result.latest.verified.gateCount, 10);
  assert.equal(result.productionArtifactPromoted, true);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.azureDeploymentPerformed, false);
  assert.equal(result.clinicalReleaseAuthorized, false);
  assert.equal(result.patientUseAuthorized, false);
});

test("promotion verification rejects altered gates, artifact bindings, authority inflation, and untrusted signatures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-promotion-tamper-test-"));
  try {
    const trusted = generateKeyPairSync("ed25519");
    const untrusted = generateKeyPairSync("ed25519");
    const policy = promotionPolicy(trusted.publicKey.export({ type: "spki", format: "pem" }));
    const { promotionRepository, candidateId } = await fixture(directory, { trustPolicy: policy });
    const prepared = await promotionRepository.prepare(candidateId);
    const request = (await promotionRepository.readPromotion(prepared.request.requestId)).request;
    const incomplete = signedAttestation(request, trusted.privateKey);
    incomplete.gates[3].status = "failed";
    assert.throws(() => verifyReleasePromotionAttestation(incomplete, policy, request, () => new Date(NOW)), error => error.code === "RELEASE_PROMOTION_ATTESTATION_INVALID");
    const inflated = signedAttestation(request, trusted.privateKey, { authority: { ...releasePromotionAttestationTemplate(request).authority, deploymentAuthorized: true } });
    assert.throws(() => verifyReleasePromotionAttestation(inflated, policy, request, () => new Date(NOW)), error => error.code === "RELEASE_PROMOTION_ATTESTATION_INVALID");
    const wrongArtifact = signedAttestation(request, trusted.privateKey);
    wrongArtifact.artifact.archiveSha256 = DIGEST;
    assert.throws(() => verifyReleasePromotionAttestation(wrongArtifact, policy, request, () => new Date(NOW)), error => error.code === "RELEASE_PROMOTION_ATTESTATION_MISMATCH");
    const wrongSigner = signedAttestation(request, untrusted.privateKey);
    assert.throws(() => verifyReleasePromotionAttestation(wrongSigner, policy, request, () => new Date(NOW)), error => error.code === "RELEASE_PROMOTION_ATTESTATION_INVALID");
    const stale = signedAttestation(request, trusted.privateKey);
    assert.throws(() => verifyReleasePromotionAttestation(stale, policy, request, () => new Date("2026-08-22T12:00:00.000Z")), error => error.code === "RELEASE_PROMOTION_ATTESTATION_EXPIRED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("promotion trust policy loading is owner-only and private-key free", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-promotion-policy-test-"));
  try {
    const { publicKey } = generateKeyPairSync("ed25519");
    const policy = promotionPolicy(publicKey.export({ type: "spki", format: "pem" }));
    assert.deepEqual(validateReleasePromotionTrustPolicy(policy, () => new Date(NOW)), []);
    const path = join(directory, "promotion-policy.json");
    await writeFile(path, `${JSON.stringify(policy)}\n`, { mode: 0o600 });
    assert.equal((await loadReleasePromotionTrustPolicyFile(path)).contractVersion, RELEASE_PROMOTION_TRUST_POLICY_CONTRACT);
    await chmod(path, 0o644);
    await assert.rejects(() => loadReleasePromotionTrustPolicyFile(path), /owner-only/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("published promotion schemas preserve the no-deploy and no-clinical-authority ceiling", async () => {
  const requestSchema = JSON.parse(await readFile(new URL("../schemas/release-promotion-request.schema.json", import.meta.url), "utf8"));
  const attestationSchema = JSON.parse(await readFile(new URL("../schemas/release-promotion-attestation.schema.json", import.meta.url), "utf8"));
  assert.equal(requestSchema.additionalProperties, false);
  assert.equal(requestSchema.properties.contractVersion.const, RELEASE_PROMOTION_REQUEST_CONTRACT);
  assert.equal(requestSchema.properties.gates.minItems, 10);
  assert.equal(requestSchema.properties.authority.properties.productionArtifactPromoted.const, false);
  assert.equal(requestSchema.properties.authority.properties.deploymentAuthorized.const, false);
  assert.equal(attestationSchema.properties.contractVersion.const, RELEASE_PROMOTION_ATTESTATION_CONTRACT);
  assert.equal(attestationSchema.properties.gates.minItems, 10);
  assert.equal(attestationSchema.properties.authority.properties.productionArtifactPromoted.const, true);
  assert.equal(attestationSchema.properties.authority.properties.deploymentAuthorized.const, false);
  assert.equal(attestationSchema.properties.authority.properties.azureDeploymentPerformed.const, false);
  assert.equal(attestationSchema.properties.authority.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(attestationSchema.properties.authority.properties.patientUseAuthorized.const, false);
});
