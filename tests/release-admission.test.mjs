import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  RELEASE_ADMISSION_BOUNDARY,
  RELEASE_ADMISSION_CONTRACT,
  ReleaseAdmissionRepository,
  buildReleaseAdmissionReport,
  runReleaseAdmission,
  validateReleaseAdmissionReport
} from "../src/release-admission.js";
import { ReleaseCandidateRepository, buildReleaseCandidate } from "../src/release-candidate.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const NOW = "2026-08-14T12:00:00.000Z";

function successfulCommand(args, options) {
  if (options.purpose === "full-test-suite") {
    assert.equal(args[0], "--test");
    assert.ok(args.some(value => value === "tests/release-admission.test.mjs"));
    return Promise.resolve({ exitCode: 0, signal: null, timedOut: false, stdout: "ℹ tests 371\nℹ pass 371\nℹ fail 0\n", stderr: "", outputTruncated: false });
  }
  assert.deepEqual(args, ["tools/evaluate-calibration.mjs", "qa/release-admission-calibration.md"]);
  return Promise.resolve({
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: `Wrote release-admission-calibration.md\n${JSON.stringify({ cases: 3, criticalScreenHandling: 1, diagnosticRestraint: 1, evidenceLineage: 1, engineeringRegressionPassed: true }, null, 2)}\n`,
    stderr: "",
    outputTruncated: false
  });
}

function fakeRun(status = "passed") {
  const ids = ["archive-integrity", "fixture-completeness", "dependency-boundary", "full-archive-tests", "clinical-calibration", "ephemeral-cleanup"];
  return {
    checks: ids.map((id, index) => ({ id, label: `Check ${index + 1}`, status: index === 3 ? status : "passed", evidence: index === 3 && status === "failed" ? { reason: "Synthetic failure" } : { verified: true } })),
    environment: {
      executionMode: "local-ephemeral-owner-only-copy",
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      shellUsed: false,
      credentialEnvironmentInherited: false,
      networkIsolationEnforced: false
    }
  };
}

test("release admission runs every archived test file and clinical invariant in an ephemeral copy", async () => {
  const candidate = await buildReleaseCandidate(projectRoot);
  const run = await runReleaseAdmission({
    candidate: { receipt: { ...candidate.manifest, archiveSha256: candidate.archiveSha256 }, archiveBytes: candidate.archiveBytes },
    commandRunner: successfulCommand
  });
  assert.equal(run.checks.length, 6);
  assert.deepEqual(run.checks.map(check => check.status), Array(6).fill("passed"));
  assert.equal(run.environment.shellUsed, false);
  assert.equal(run.environment.credentialEnvironmentInherited, false);
  assert.equal(run.environment.networkIsolationEnforced, false);
  assert.deepEqual(run.checks.find(check => check.id === "dependency-boundary").evidence.dependencyCounts, {
    dependencies: 0,
    devDependencies: 0,
    optionalDependencies: 0,
    peerDependencies: 0,
    bundledDependencies: 0,
    bundleDependencies: 0
  });
});

test("admission reports are content-bound and preserve the production-authority boundary", async () => {
  const release = await buildReleaseCandidate(projectRoot);
  const candidate = {
    receipt: {
      artifactId: release.artifactId,
      archiveSha256: release.archiveSha256,
      manifestSha256: release.manifest.source.digest,
      provenanceSha256: release.manifest.source.digest,
      sbomSha256: release.manifest.sbom.sha256,
      sourceDigest: release.manifest.source.digest
    },
    signature: null
  };
  const report = buildReleaseAdmissionReport({ candidate, actor: "QA-RELEASE", run: fakeRun(), clock: () => new Date(NOW) });
  assert.equal(report.contractVersion, RELEASE_ADMISSION_CONTRACT);
  assert.equal(report.status, "qualified-local");
  assert.equal(report.summary.passed, 6);
  assert.equal(report.authority.localArchiveQualificationPassed, true);
  assert.equal(report.authority.isolatedCiRun, false);
  assert.equal(report.authority.productionSignatureVerified, false);
  assert.equal(report.authority.clinicalReleaseAuthorized, false);
  assert.equal(report.boundary, RELEASE_ADMISSION_BOUNDARY);
  assert.deepEqual(validateReleaseAdmissionReport(report, release.artifactId), []);
  const changed = structuredClone(report);
  changed.summary.passed = 5;
  assert.throws(() => validateReleaseAdmissionReport(changed), error => error.code === "RELEASE_ADMISSION_REPORT_INVALID");
});

test("release admission repository stores immutable owner-only evidence for the exact candidate", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-admission-repository-test-"));
  try {
    const releaseRepository = new ReleaseCandidateRepository({
      sourceRoot: projectRoot,
      repositoryRoot: join(directory, "releases"),
      clock: () => new Date(NOW)
    });
    const built = await releaseRepository.build("QA-RELEASE");
    const repository = new ReleaseAdmissionRepository({
      releaseRepository,
      repositoryRoot: join(directory, "admissions"),
      qualifier: async () => fakeRun(),
      clock: () => new Date(NOW)
    });
    const qualified = await repository.qualify(built.candidate.artifactId, "QA-RELEASE");
    assert.equal(qualified.status, "qualified-local");
    assert.equal(qualified.localArchiveQualificationPassed, true);
    assert.equal(qualified.latest.artifact.artifactId, built.candidate.artifactId);
    const reportPath = join(directory, "admissions", qualified.latest.admissionId, "report.json");
    assert.equal((await stat(reportPath)).mode & 0o777, 0o400);
    assert.equal(JSON.parse(await readFile(reportPath, "utf8")).evidenceHash, qualified.latest.evidenceHash);
    const download = await repository.download(qualified.latest.admissionId);
    assert.match(download.filename, /^PERL-perl-adm-[a-f0-9]{20}\.report\.json$/);
    assert.equal(JSON.parse(download.bytes).admissionId, qualified.latest.admissionId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failed fixed check produces failed-local evidence instead of an authority claim", async () => {
  const release = await buildReleaseCandidate(projectRoot);
  const candidate = {
    receipt: {
      artifactId: release.artifactId,
      archiveSha256: release.archiveSha256,
      manifestSha256: release.manifest.source.digest,
      provenanceSha256: release.manifest.source.digest,
      sbomSha256: release.manifest.sbom.sha256,
      sourceDigest: release.manifest.source.digest
    },
    signature: null
  };
  const report = buildReleaseAdmissionReport({ candidate, actor: "QA-RELEASE", run: fakeRun("failed"), clock: () => new Date(NOW) });
  assert.equal(report.status, "failed-local");
  assert.equal(report.summary.failed, 1);
  assert.equal(report.authority.localArchiveQualificationPassed, false);
  assert.equal(report.authority.patientUseAuthorized, false);
});

test("published admission schema keeps local qualification below production and clinical authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/release-admission-report.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, RELEASE_ADMISSION_CONTRACT);
  assert.equal(schema.properties.policyVersion.const, "perl-local-archive-qualification/1.0");
  assert.equal(schema.properties.summary.properties.total.const, 6);
  assert.equal(schema.properties.environment.properties.shellUsed.const, false);
  assert.equal(schema.properties.environment.properties.credentialEnvironmentInherited.const, false);
  assert.equal(schema.properties.environment.properties.networkIsolationEnforced.const, false);
  assert.equal(schema.properties.authority.properties.isolatedCiRun.const, false);
  assert.equal(schema.properties.authority.properties.externalVulnerabilityReviewCompleted.const, false);
  assert.equal(schema.properties.authority.properties.azureDeploymentPerformed.const, false);
  assert.equal(schema.properties.authority.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(schema.properties.authority.properties.patientUseAuthorized.const, false);
});

test("admission status fails closed when the underlying candidate repository loses integrity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-admission-fail-closed-test-"));
  try {
    const repository = new ReleaseAdmissionRepository({
      releaseRepository: {
        status: async () => ({ status: "repository-integrity-failed", latest: { artifactId: "perl-rc-00000000000000000000" } })
      },
      repositoryRoot: directory
    });
    const status = await repository.status();
    assert.equal(status.status, "repository-integrity-failed");
    assert.equal(status.localArchiveQualificationPassed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
