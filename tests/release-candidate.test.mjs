import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadReleaseTrustPolicyFile } from "../server.mjs";
import {
  RELEASE_CANDIDATE_CONTRACT,
  RELEASE_MANIFEST_CONTRACT,
  RELEASE_SIGNATURE_CONTRACT,
  RELEASE_TRUST_POLICY_CONTRACT,
  ReleaseCandidateRepository,
  buildReleaseCandidate,
  canonicalJson,
  collectReleaseFiles,
  materializeVerifiedReleaseArchive,
  validateReleaseConfiguration,
  validateReleaseTrustPolicy,
  verifyReleaseArchive,
  verifyReleaseSignature
} from "../src/release-candidate.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const NOW = "2026-08-14T12:00:00.000Z";

function releasePolicy(publicKeyPem, overrides = {}) {
  return {
    contractVersion: RELEASE_TRUST_POLICY_CONTRACT,
    status: "approved-for-release-verification",
    policyId: "FF-RELEASE-POLICY-QA-2026",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    signerRole: "production-release-authority",
    keyId: "release-qa-ed25519",
    algorithm: "Ed25519",
    publicKeyPem,
    maxSignatureAgeSeconds: 604800,
    ...overrides
  };
}

test("release candidate is byte-reproducible, self-verifying, and excludes runtime state", async () => {
  const first = await buildReleaseCandidate(projectRoot);
  const second = await buildReleaseCandidate(projectRoot);
  assert.equal(first.artifactId, second.artifactId);
  assert.equal(first.archiveSha256, second.archiveSha256);
  assert.equal(first.archiveBytes.equals(second.archiveBytes), true);
  assert.equal(first.manifest.contractVersion, RELEASE_MANIFEST_CONTRACT);
  assert.equal(first.manifest.claims.syntheticOnly, true);
  assert.equal(first.manifest.claims.runtimeStateIncluded, false);
  assert.equal(first.manifest.claims.phiIncluded, false);
  assert.equal(first.manifest.claims.credentialsIncluded, false);
  assert.equal(first.manifest.claims.productionSignatureVerified, false);
  assert.equal(first.manifest.claims.azureDeploymentPerformed, false);
  assert.equal(first.manifest.claims.clinicalReleaseAuthorized, false);
  assert.ok(first.manifest.source.fileCount > 200);

  const paths = new Set(first.manifest.contents.map(file => file.path));
  assert.ok(paths.has("server.mjs"));
  assert.ok(paths.has("src/release-candidate.js"));
  assert.ok(paths.has("src/runtime-envelope.js"));
  assert.ok(paths.has("schemas/runtime-envelope-policy.schema.json"));
  assert.ok(paths.has("deploy/Containerfile"));
  assert.ok(paths.has("deploy/runtime-policy.template.json"));
  assert.ok(paths.has("tools/runtime-healthcheck.mjs"));
  assert.ok(paths.has("tools/verify-runtime-envelope.mjs"));
  assert.ok(paths.has("tests/release-candidate.test.mjs"));
  assert.ok(paths.has("examples/synthetic-assessment.json"));
  assert.ok(paths.has("examples/synthetic-eqpass-scored-event.json"));
  assert.ok(paths.has("qa/report-render-evidence.json"));
  assert.ok(paths.has("qa/release-admission-lab-desktop.png"));
  assert.ok(paths.has("qa/release-admission-lab-mobile.png"));
  assert.ok(paths.has("qa/release-promotion-airlock-desktop.png"));
  assert.ok(paths.has("qa/clinical-brief-desktop.png"));
  assert.ok(paths.has("qa/clinical-brief-mobile.png"));
  assert.ok(paths.has("qa/clinical-brief-print-final.png"));
  assert.ok(paths.has("qa/clinical-brief-print.pdf"));
  assert.ok(paths.has("qa/reference-room-desktop.png"));
  assert.ok(paths.has("qa/reference-room-mobile.png"));
  assert.ok(paths.has("qa/reference-adjudication-desktop.png"));
  assert.ok(paths.has("qa/reference-adjudication-mobile.png"));
  assert.ok(paths.has("qa/reference-decision-docket-desktop.png"));
  assert.ok(paths.has("qa/reference-decision-docket-mobile.png"));
  assert.ok(paths.has("qa/evaluation-chamber-desktop.png"));
  assert.ok(paths.has("qa/evaluation-chamber-admission-desktop.png"));
  assert.ok(paths.has("qa/evaluation-chamber-mobile.png"));
  assert.ok(paths.has("qa/evaluation-chamber-admission-mobile.png"));
  assert.ok(paths.has("output/pdf/PERL-clinician-summary-approved-synthetic.pdf"));
  for (const forbidden of ["data/sandbox-state.json", "qa/model-transport-default-desktop.png", ".env", "dist/releases"]) {
    assert.equal(paths.has(forbidden), false);
  }

  const verified = verifyReleaseArchive(first.archiveBytes, first.archiveSha256);
  assert.equal(verified.contractVersion, RELEASE_CANDIDATE_CONTRACT);
  assert.equal(verified.status, "verified-release-candidate");
  assert.equal(verified.artifactId, first.artifactId);
  assert.equal(verified.productionSignatureVerified, false);
  assert.equal(verified.deployableCandidateAvailable, true);
  assert.equal(verified.clinicalReleaseAuthorized, false);
});

test("verified release archives materialize only into an empty owner-controlled target", async () => {
  const candidate = await buildReleaseCandidate(projectRoot);
  const directory = await mkdtemp(join(tmpdir(), "perl-release-materialize-test-"));
  try {
    const verification = await materializeVerifiedReleaseArchive(candidate.archiveBytes, directory, candidate.archiveSha256);
    assert.equal(verification.artifactId, candidate.artifactId);
    assert.equal(JSON.parse(await readFile(join(directory, "perl", "package.json"), "utf8")).name, "perl-clinical-summary");
    assert.deepEqual((await readdir(join(directory, "release"))).sort(), ["configuration.json", "manifest.json", "sbom.cdx.json"]);
    await assert.rejects(
      materializeVerifiedReleaseArchive(candidate.archiveBytes, directory, candidate.archiveSha256),
      error => error.code === "RELEASE_MATERIALIZATION_TARGET_NOT_EMPTY"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("historical safe configuration inventories remain verifiable without borrowing today's template", async () => {
  const candidate = await buildReleaseCandidate(projectRoot);
  const historical = structuredClone(candidate.configuration);
  historical.environmentVariables = historical.environmentVariables.filter(variable => variable.name !== "PERL_RELEASE_ADMISSION_REPOSITORY_DIR");
  assert.deepEqual(validateReleaseConfiguration(historical), []);
  const unsafe = structuredClone(historical);
  unsafe.environmentVariables.find(variable => variable.classification === "runtime-secret").default = "embedded-secret";
  assert.match(validateReleaseConfiguration(unsafe).join(" "), /descriptor is invalid/i);
});

test("release verification fails closed on archive tampering", async () => {
  const candidate = await buildReleaseCandidate(projectRoot);
  const altered = Buffer.from(candidate.archiveBytes);
  altered[Math.floor(altered.length / 2)] ^= 0xff;
  assert.throws(
    () => verifyReleaseArchive(altered, candidate.archiveSha256),
    error => ["RELEASE_ARCHIVE_TAMPERED", "RELEASE_ARCHIVE_INVALID"].includes(error.code)
  );
});

test("source collector rejects private-key material and omits unbounded workspace folders", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-release-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const folder of ["assets", "docs", "examples", "schemas", "src", "tests", "tools", "qa", "output/pdf", "data", "dist"]) await mkdir(join(directory, folder), { recursive: true });
  for (const name of ["README.md", "app.js", "index.html", "package.json", "server.mjs", "styles.css"]) await writeFile(join(directory, name), `${name}\n`, "utf8");
  for (let index = 0; index < 16; index += 1) await writeFile(join(directory, "src", `file-${index}.js`), `export const value${index} = ${index};\n`, "utf8");
  await writeFile(join(directory, "examples/synthetic-assessment.json"), "{}\n", "utf8");
  for (const path of [
    "qa/report-render-evidence.json",
    "qa/clinician-report-draft-desktop.png",
    "qa/clinician-report-approved-desktop.png",
    "qa/clinician-report-approved-mobile.png",
    "qa/release-admission-lab-desktop.png",
    "qa/release-admission-lab-mobile.png",
    "qa/release-promotion-airlock-desktop.png",
    "qa/clinical-brief-desktop.png",
    "qa/clinical-brief-mobile.png",
    "qa/clinical-brief-print-final.png",
    "qa/clinical-brief-print.pdf",
    "qa/reference-room-desktop.png",
    "qa/reference-room-mobile.png",
    "qa/reference-adjudication-desktop.png",
    "qa/reference-adjudication-mobile.png",
    "qa/reference-decision-docket-desktop.png",
    "qa/reference-decision-docket-mobile.png",
    "qa/evaluation-chamber-desktop.png",
    "qa/evaluation-chamber-admission-desktop.png",
    "qa/evaluation-chamber-mobile.png",
    "qa/evaluation-chamber-admission-mobile.png",
    "output/pdf/PERL-clinician-summary-approved-synthetic.pdf"
  ]) await writeFile(join(directory, path), "synthetic-evidence", "utf8");
  await writeFile(join(directory, "data/sandbox-state.json"), "PRIVATE-RUNTIME-STATE", "utf8");
  await writeFile(join(directory, "dist/old.tar.gz"), "OLD-ARCHIVE", "utf8");

  const inventory = await collectReleaseFiles(directory);
  assert.equal(inventory.files.some(file => file.path.startsWith("data/")), false);
  assert.equal(inventory.files.some(file => file.path.startsWith("dist/")), false);

  await writeFile(join(directory, "docs/leaked-key.md"), "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n", "utf8");
  await assert.rejects(() => collectReleaseFiles(directory), error => error.code === "RELEASE_SECRET_DETECTED");
});

test("content-addressed repository writes owner-only immutable artifacts idempotently", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-release-repository-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new ReleaseCandidateRepository({ sourceRoot: projectRoot, repositoryRoot: directory, clock: () => new Date(NOW) });
  const first = await repository.build("RELEASE-QA");
  const second = await repository.build("RELEASE-QA");
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(first.candidate.artifactId, second.candidate.artifactId);
  assert.equal(first.candidate.archiveSha256, second.candidate.archiveSha256);
  assert.equal(first.status, "verified-release-candidate");
  assert.equal(first.productionSignatureVerified, false);
  assert.equal(first.azureDeploymentPerformed, false);
  const artifact = await repository.download(first.candidate.artifactId, "archive");
  assert.equal(artifact.bytes.length, first.candidate.archiveBytes);
  assert.equal((await stat(join(directory, first.candidate.artifactId, first.candidate.archiveFilename))).mode & 0o777, 0o400);
  assert.equal((await stat(directory)).mode & 0o077, 0);
  const receipt = JSON.parse(await readFile(join(directory, first.candidate.artifactId, "receipt.json"), "utf8"));
  const provenancePath = join(directory, first.candidate.artifactId, receipt.provenanceFilename);
  await chmod(provenancePath, 0o600);
  await writeFile(provenancePath, `${await readFile(provenancePath, "utf8")} `, "utf8");
  await chmod(provenancePath, 0o400);
  const corrupted = await repository.status();
  assert.equal(corrupted.status, "repository-integrity-failed");
  assert.equal(corrupted.candidateCount, 0);
  assert.equal(corrupted.corruptCandidateCount, 1);
});

test("external Ed25519 verification attests only the exact release artifact", async () => {
  const candidate = await buildReleaseCandidate(projectRoot);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const policy = releasePolicy(publicKey.export({ type: "spki", format: "pem" }));
  assert.deepEqual(validateReleaseTrustPolicy(policy, () => new Date(NOW)), []);
  const payload = {
    ...candidate.signingRequest.payloadTemplate,
    keyId: policy.keyId,
    signedAt: "2026-08-14T11:55:00.000Z",
    expiresAt: "2026-08-21T11:55:00.000Z"
  };
  const envelope = {
    ...payload,
    signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64")
  };
  const expected = {
    artifactId: candidate.artifactId,
    archiveSha256: candidate.archiveSha256,
    manifestSha256: candidate.signingRequest.payloadTemplate.manifestSha256,
    provenanceSha256: candidate.signingRequest.payloadTemplate.provenanceSha256,
    sbomSha256: candidate.signingRequest.payloadTemplate.sbomSha256
  };
  const verified = verifyReleaseSignature(envelope, policy, expected, () => new Date(NOW));
  assert.equal(verified.status, "verified-external-signature");
  assert.equal(verified.artifactIntegrityAttested, true);
  assert.equal(verified.deploymentAuthorized, false);
  assert.equal(verified.clinicalReleaseAuthorized, false);
  assert.equal(verified.trafficActivationAuthorized, false);
  assert.equal(verified.patientUseAuthorized, false);
  assert.equal(verified.privateKeyReceived, false);
  assert.throws(
    () => verifyReleaseSignature({ ...envelope, archiveSha256: "0".repeat(64) }, policy, expected, () => new Date(NOW)),
    error => error.code === "RELEASE_SIGNATURE_MISMATCH"
  );
});

test("stored release signatures are cryptographically re-verified on every repository read", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-release-signed-repository-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const policy = releasePolicy(publicKey.export({ type: "spki", format: "pem" }));
  const repository = new ReleaseCandidateRepository({ sourceRoot: projectRoot, repositoryRoot: directory, trustPolicy: policy, clock: () => new Date(NOW) });
  const built = await repository.build("RELEASE-SIGNATURE-QA");
  const request = JSON.parse((await repository.download(built.candidate.artifactId, "signingRequest")).bytes.toString("utf8"));
  const payload = {
    ...request.payloadTemplate,
    keyId: policy.keyId,
    signedAt: "2026-08-14T11:55:00.000Z",
    expiresAt: "2026-08-21T11:55:00.000Z"
  };
  const envelope = { ...payload, signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64") };
  const verified = await repository.verifyAndStoreSignature(envelope);
  assert.equal(verified.productionSignatureVerified, true);
  assert.equal((await repository.status()).latest.signature.status, "verified-external-signature");

  const signaturePath = join(directory, built.candidate.artifactId, "verified-signature.json");
  const stored = JSON.parse(await readFile(signaturePath, "utf8"));
  assert.equal(stored.signature, envelope.signature);
  assert.equal(Object.hasOwn(stored, "privateKeyPem"), false);
  stored.signature = `${stored.signature[0] === "A" ? "B" : "A"}${stored.signature.slice(1)}`;
  await chmod(signaturePath, 0o600);
  await writeFile(signaturePath, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  await chmod(signaturePath, 0o400);
  const corrupted = await repository.status();
  assert.equal(corrupted.status, "repository-integrity-failed");
  assert.equal(corrupted.productionSignatureVerified, false);
  assert.equal(corrupted.corruptCandidateCount, 1);
});

test("startup release-trust loader requires a current owner-only policy file", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-release-policy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { publicKey } = generateKeyPairSync("ed25519");
  const policy = releasePolicy(publicKey.export({ type: "spki", format: "pem" }), {
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  const filePath = join(directory, "release-policy.json");
  await writeFile(filePath, JSON.stringify(policy), { encoding: "utf8", mode: 0o600 });
  assert.deepEqual(await loadReleaseTrustPolicyFile(filePath), policy);
  await chmod(filePath, 0o644);
  await assert.rejects(() => loadReleaseTrustPolicyFile(filePath), /owner-only/i);
});

test("published release schemas preserve exact integrity and authority boundaries", async () => {
  const [manifest, policy, signature] = await Promise.all([
    readFile(new URL("../schemas/release-candidate-manifest.schema.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../schemas/release-trust-policy.schema.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../schemas/release-signature-envelope.schema.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.equal(manifest.additionalProperties, false);
  assert.equal(manifest.properties.contractVersion.const, RELEASE_MANIFEST_CONTRACT);
  assert.equal(manifest.properties.claims.properties.phiIncluded.const, false);
  assert.equal(manifest.properties.claims.properties.credentialsIncluded.const, false);
  assert.equal(manifest.properties.claims.properties.productionSignatureVerified.const, false);
  assert.equal(manifest.properties.claims.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(policy.additionalProperties, false);
  assert.equal(policy.properties.contractVersion.const, RELEASE_TRUST_POLICY_CONTRACT);
  assert.equal(policy.properties.algorithm.const, "Ed25519");
  assert.equal(Object.hasOwn(policy.properties, "privateKeyPem"), false);
  assert.equal(signature.additionalProperties, false);
  assert.equal(signature.properties.signatureContractVersion.const, RELEASE_SIGNATURE_CONTRACT);
  assert.equal(signature.properties.deploymentAuthorized.const, false);
  assert.equal(signature.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(signature.properties.patientUseAuthorized.const, false);
});
