import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  canonicalJson,
  materializeVerifiedReleaseArchive,
  sha256
} from "./release-candidate.js";

export const RELEASE_ADMISSION_CONTRACT = "perl-release-admission/1.0";
export const RELEASE_ADMISSION_POLICY = "perl-local-archive-qualification/1.0";
export const RELEASE_ADMISSION_BOUNDARY = "This evidence proves only that the exact content-addressed candidate passed PERL's fixed local archive-qualification policy in an ephemeral owner-only copy. It is not isolated CI, an external vulnerability or license review, a production signature, an Azure deployment, clinical validation, clinical-release authority, traffic activation, or permission for patient use.";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const FIXTURES = Object.freeze([
  "examples/synthetic-assessment.json",
  "examples/synthetic-eqpass-scored-event.json"
]);
const DEPENDENCY_FIELDS = Object.freeze([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
  "bundleDependencies"
]);

function fail(message, status = 400, code = "RELEASE_ADMISSION_INVALID") {
  throw Object.assign(new Error(message), { status, code });
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function safeActor(actor) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(actor || "")) fail("Release admission actor code is invalid.");
  return actor;
}

function safeMessage(value) {
  return String(value || "Qualification command failed.")
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/g, "[ephemeral-path]")
    .replace(/\/var\/folders\/[A-Za-z0-9_./-]+/g, "[ephemeral-path]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function appendBounded(chunks, state, chunk) {
  if (state.bytes >= MAX_OUTPUT_BYTES) {
    state.truncated = true;
    return;
  }
  const bytes = Buffer.from(chunk);
  const remaining = MAX_OUTPUT_BYTES - state.bytes;
  chunks.push(bytes.subarray(0, remaining));
  state.bytes += Math.min(bytes.length, remaining);
  if (bytes.length > remaining) state.truncated = true;
}

export function runFixedNodeCommand(args, { cwd, timeoutMs = 180000 } = {}) {
  if (!Array.isArray(args) || !args.length || args.some(value => typeof value !== "string" || !value)) fail("Qualification command arguments are invalid.", 500, "RELEASE_ADMISSION_POLICY_INVALID");
  return new Promise((resolvePromise, reject) => {
    const stdout = [];
    const stderr = [];
    const stdoutState = { bytes: 0, truncated: false };
    const stderrState = { bytes: 0, truncated: false };
    let timedOut = false;
    const child = spawn(process.execPath, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", NODE_ENV: "test", NO_COLOR: "1" }
    });
    child.stdout.on("data", chunk => appendBounded(stdout, stdoutState, chunk));
    child.stderr.on("data", chunk => appendBounded(stderr, stderrState, chunk));
    child.once("error", reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal || null,
        timedOut,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        outputTruncated: stdoutState.truncated || stderrState.truncated
      });
    });
  });
}

function metric(output, name) {
  const match = output.match(new RegExp(`(?:#|ℹ)\\s*${name}\\s+(\\d+)`, "i"));
  return match ? Number(match[1]) : null;
}

function evaluatorJson(output) {
  const start = output.lastIndexOf("\n{");
  if (start < 0) fail("Calibration evaluator did not emit its result object.", 500, "RELEASE_ADMISSION_EVALUATOR_OUTPUT_INVALID");
  try {
    return JSON.parse(output.slice(start + 1));
  } catch {
    fail("Calibration evaluator result was not valid JSON.", 500, "RELEASE_ADMISSION_EVALUATOR_OUTPUT_INVALID");
  }
}

function passedCheck(id, label, evidence) {
  return { id, label, status: "passed", evidence };
}

function failedCheck(id, label, error, evidence = {}) {
  return { id, label, status: "failed", evidence: { ...evidence, reason: safeMessage(error?.message || error) } };
}

async function regularJson(path) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 2 || metadata.size > 1024 * 1024) throw new Error("Required JSON fixture is missing or outside the bounded size policy.");
  const bytes = await readFile(path);
  JSON.parse(bytes.toString("utf8"));
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

export async function runReleaseAdmission({ candidate, commandRunner = runFixedNodeCommand } = {}) {
  if (!candidate?.archiveBytes || !candidate?.receipt) fail("A verified release candidate is required.", 500, "RELEASE_ADMISSION_CANDIDATE_REQUIRED");
  const workspace = await mkdtemp(join(tmpdir(), "perl-release-admission-"));
  await chmod(workspace, 0o700);
  const checks = [];
  let cleanupVerified = false;
  try {
    const verification = await materializeVerifiedReleaseArchive(candidate.archiveBytes, workspace, candidate.receipt.archiveSha256);
    checks.push(passedCheck("archive-integrity", "Exact archive integrity", {
      artifactId: verification.artifactId,
      archiveSha256: verification.archiveSha256,
      manifestSha256: verification.manifestSha256,
      sourceDigest: verification.sourceDigest,
      sourceFileCount: verification.sourceFileCount
    }));

    const projectRoot = join(workspace, "perl");
    try {
      const fixtureEvidence = [];
      for (const path of FIXTURES) fixtureEvidence.push({ path, ...(await regularJson(join(projectRoot, path))) });
      checks.push(passedCheck("fixture-completeness", "Synthetic fixture completeness", { fixtures: fixtureEvidence }));
    } catch (error) {
      checks.push(failedCheck("fixture-completeness", "Synthetic fixture completeness", error, { required: FIXTURES }));
    }

    try {
      const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
      const dependencyCounts = Object.fromEntries(DEPENDENCY_FIELDS.map(field => [field, Array.isArray(packageJson[field]) ? packageJson[field].length : Object.keys(packageJson[field] || {}).length]));
      const total = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);
      if (total !== 0) throw new Error("Dependency surface changed; external vulnerability and license review is required.");
      checks.push(passedCheck("dependency-boundary", "Zero-dependency package boundary", {
        packageName: packageJson.name,
        packageVersion: packageJson.version,
        dependencyCounts,
        externalVulnerabilityDatabaseQueried: false,
        externalLicenseApprovalGranted: false
      }));
    } catch (error) {
      checks.push(failedCheck("dependency-boundary", "Zero-dependency package boundary", error, {
        externalVulnerabilityDatabaseQueried: false,
        externalLicenseApprovalGranted: false
      }));
    }

    try {
      const files = (await readdir(join(projectRoot, "tests"), { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith(".test.mjs"))
        .map(entry => `tests/${entry.name}`)
        .sort();
      if (!files.length) throw new Error("No archived test files were found.");
      const result = await commandRunner(["--test", "--test-concurrency=1", ...files], { cwd: projectRoot, purpose: "full-test-suite" });
      const testCount = metric(result.stdout, "tests");
      const passCount = metric(result.stdout, "pass");
      const failCount = metric(result.stdout, "fail");
      const testsPassed = result.exitCode === 0 && result.timedOut === false && result.outputTruncated === false && Number.isInteger(testCount) && testCount > 0 && passCount === testCount && failCount === 0;
      const evidence = { testFileCount: files.length, testCount, passCount, failCount, exitCode: result.exitCode, timedOut: result.timedOut, outputTruncated: result.outputTruncated };
      if (!testsPassed) throw Object.assign(new Error(result.stderr || "The full archived test suite did not pass."), { evidence });
      checks.push(passedCheck("full-archive-tests", "Every archived product test", evidence));
    } catch (error) {
      checks.push(failedCheck("full-archive-tests", "Every archived product test", error, error.evidence));
    }

    try {
      const result = await commandRunner(["tools/evaluate-calibration.mjs", "qa/release-admission-calibration.md"], { cwd: projectRoot, purpose: "calibration-evaluator" });
      const metrics = evaluatorJson(result.stdout);
      const passed = result.exitCode === 0
        && result.timedOut === false
        && result.outputTruncated === false
        && metrics.cases >= 3
        && metrics.criticalScreenHandling === 1
        && metrics.diagnosticRestraint === 1
        && metrics.evidenceLineage === 1
        && metrics.engineeringRegressionPassed === true;
      const evidence = {
        cases: metrics.cases,
        criticalScreenHandling: metrics.criticalScreenHandling,
        diagnosticRestraint: metrics.diagnosticRestraint,
        evidenceLineage: metrics.evidenceLineage,
        engineeringRegressionPassed: metrics.engineeringRegressionPassed,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        outputTruncated: result.outputTruncated
      };
      if (!passed) throw Object.assign(new Error(result.stderr || "Clinical calibration invariants did not pass."), { evidence });
      checks.push(passedCheck("clinical-calibration", "Clinical calibration invariants", evidence));
    } catch (error) {
      checks.push(failedCheck("clinical-calibration", "Clinical calibration invariants", error, error.evidence));
    }
  } catch (error) {
    checks.push(failedCheck("archive-integrity", "Exact archive integrity", error));
  } finally {
    await rm(workspace, { recursive: true, force: true });
    try {
      await stat(workspace);
    } catch (error) {
      cleanupVerified = error.code === "ENOENT";
    }
    checks.push(cleanupVerified
      ? passedCheck("ephemeral-cleanup", "Ephemeral owner-only copy removed", { removed: true })
      : failedCheck("ephemeral-cleanup", "Ephemeral owner-only copy removed", "Ephemeral qualification copy could not be verified as removed."));
  }
  return {
    checks,
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

function reportCore({ candidate, actor, run, qualifiedAt }) {
  const checks = run.checks.map(check => ({
    id: check.id,
    label: check.label,
    status: check.status,
    evidence: check.evidence
  }));
  const failed = checks.filter(check => check.status !== "passed").length;
  return {
    contractVersion: RELEASE_ADMISSION_CONTRACT,
    policyVersion: RELEASE_ADMISSION_POLICY,
    status: failed ? "failed-local" : "qualified-local",
    qualifiedAt,
    actor,
    artifact: {
      artifactId: candidate.receipt.artifactId,
      archiveSha256: candidate.receipt.archiveSha256,
      manifestSha256: candidate.receipt.manifestSha256,
      provenanceSha256: candidate.receipt.provenanceSha256,
      sbomSha256: candidate.receipt.sbomSha256,
      sourceDigest: candidate.receipt.sourceDigest
    },
    summary: { total: checks.length, passed: checks.length - failed, failed },
    checks,
    environment: run.environment,
    authority: {
      localArchiveQualificationPassed: failed === 0,
      isolatedCiRun: false,
      externalVulnerabilityReviewCompleted: false,
      externalLicenseApprovalCompleted: false,
      productionSignatureVerified: candidate.signature != null,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false
    },
    boundary: RELEASE_ADMISSION_BOUNDARY
  };
}

export function buildReleaseAdmissionReport({ candidate, actor, run, clock = () => new Date() }) {
  safeActor(actor);
  const core = reportCore({ candidate, actor, run, qualifiedAt: clock().toISOString() });
  const evidenceHash = sha256(canonicalJson(core));
  return Object.freeze({
    admissionId: `perl-adm-${evidenceHash.slice(0, 20)}`,
    evidenceHash,
    ...core
  });
}

export function validateReleaseAdmissionReport(report, expectedArtifactId = null) {
  const keys = ["admissionId", "evidenceHash", "contractVersion", "policyVersion", "status", "qualifiedAt", "actor", "artifact", "summary", "checks", "environment", "authority", "boundary"];
  if (!exactObject(report, keys)) fail("Release admission report must contain the exact contract fields.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  if (report.contractVersion !== RELEASE_ADMISSION_CONTRACT || report.policyVersion !== RELEASE_ADMISSION_POLICY || !/^perl-adm-[a-f0-9]{20}$/.test(report.admissionId || "")) fail("Release admission report contract or identity is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  if (!/^[a-f0-9]{64}$/.test(report.evidenceHash || "") || report.admissionId !== `perl-adm-${report.evidenceHash.slice(0, 20)}`) fail("Release admission evidence identity is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  const { admissionId: _admissionId, evidenceHash: _evidenceHash, ...core } = report;
  if (sha256(canonicalJson(core)) !== report.evidenceHash) fail("Release admission evidence hash is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  if (!exactObject(report.artifact, ["artifactId", "archiveSha256", "manifestSha256", "provenanceSha256", "sbomSha256", "sourceDigest"]) || !/^perl-rc-[a-f0-9]{20}$/.test(report.artifact?.artifactId || "") || expectedArtifactId && report.artifact.artifactId !== expectedArtifactId) fail("Release admission artifact binding is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  for (const field of ["archiveSha256", "manifestSha256", "provenanceSha256", "sbomSha256", "sourceDigest"]) if (!/^[a-f0-9]{64}$/.test(report.artifact?.[field] || "")) fail(`Release admission ${field} is invalid.`, 500, "RELEASE_ADMISSION_REPORT_INVALID");
  const requiredChecks = ["archive-integrity", "fixture-completeness", "dependency-boundary", "full-archive-tests", "clinical-calibration", "ephemeral-cleanup"];
  if (!Array.isArray(report.checks) || report.checks.length !== 6 || JSON.stringify([...report.checks.map(check => check.id)].sort()) !== JSON.stringify([...requiredChecks].sort()) || report.checks.some(check => !exactObject(check, ["id", "label", "status", "evidence"]) || typeof check.label !== "string" || check.label.length < 3 || check.label.length > 96 || !["passed", "failed"].includes(check.status) || !check.evidence || typeof check.evidence !== "object" || Array.isArray(check.evidence))) fail("Release admission checks are invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  const failed = report.checks.filter(check => check.status === "failed").length;
  if (!exactObject(report.summary, ["total", "passed", "failed"]) || report.summary.total !== report.checks.length || report.summary.failed !== failed || report.summary.passed !== report.checks.length - failed || report.status !== (failed ? "failed-local" : "qualified-local")) fail("Release admission summary is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  const authority = report.authority || {};
  if (!exactObject(authority, ["localArchiveQualificationPassed", "isolatedCiRun", "externalVulnerabilityReviewCompleted", "externalLicenseApprovalCompleted", "productionSignatureVerified", "azureDeploymentPerformed", "clinicalValidation", "clinicalReleaseAuthorized", "trafficActivationAuthorized", "patientUseAuthorized"]) || authority.localArchiveQualificationPassed !== (failed === 0) || authority.isolatedCiRun !== false || authority.externalVulnerabilityReviewCompleted !== false || authority.externalLicenseApprovalCompleted !== false || authority.azureDeploymentPerformed !== false || authority.clinicalValidation !== false || authority.clinicalReleaseAuthorized !== false || authority.trafficActivationAuthorized !== false || authority.patientUseAuthorized !== false || typeof authority.productionSignatureVerified !== "boolean" || report.boundary !== RELEASE_ADMISSION_BOUNDARY) fail("Release admission authority boundary is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  const environment = report.environment || {};
  if (!exactObject(environment, ["executionMode", "runtime", "platform", "architecture", "shellUsed", "credentialEnvironmentInherited", "networkIsolationEnforced"]) || environment.executionMode !== "local-ephemeral-owner-only-copy" || !/^v\d+\./.test(environment.runtime || "") || typeof environment.platform !== "string" || typeof environment.architecture !== "string" || environment.shellUsed !== false || environment.credentialEnvironmentInherited !== false || environment.networkIsolationEnforced !== false) fail("Release admission execution boundary is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  if (!Number.isFinite(Date.parse(report.qualifiedAt)) || safeActor(report.actor) !== report.actor) fail("Release admission actor or timestamp is invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
  return [];
}

async function immutableJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o400);
}

function reportSummary(report) {
  return {
    admissionId: report.admissionId,
    status: report.status,
    qualifiedAt: report.qualifiedAt,
    actor: report.actor,
    evidenceHash: report.evidenceHash,
    artifactId: report.artifact.artifactId,
    summary: report.summary,
    reportUrl: `/api/operations/release/admissions/${report.admissionId}/report.json`
  };
}

export class ReleaseAdmissionRepository {
  constructor({ releaseRepository, repositoryRoot, qualifier = runReleaseAdmission, clock = () => new Date() }) {
    if (!releaseRepository) fail("Release admission requires a release repository.", 500, "RELEASE_ADMISSION_CONFIGURATION_INVALID");
    this.releaseRepository = releaseRepository;
    this.repositoryRoot = resolve(repositoryRoot);
    this.qualifier = qualifier;
    this.clock = clock;
    this.inFlight = new Map();
  }

  async ensureRepository() {
    await mkdir(this.repositoryRoot, { recursive: true, mode: 0o700 });
    await chmod(this.repositoryRoot, 0o700);
  }

  reportDirectory(admissionId) {
    if (!/^perl-adm-[a-f0-9]{20}$/.test(admissionId || "")) fail("Release admission ID is invalid.", 400, "RELEASE_ADMISSION_ID_INVALID");
    return join(this.repositoryRoot, admissionId);
  }

  async readReport(admissionId) {
    let report;
    try {
      report = JSON.parse(await readFile(join(this.reportDirectory(admissionId), "report.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") fail("Release admission report was not found.", 404, "RELEASE_ADMISSION_NOT_FOUND");
      fail("Release admission report is unreadable or invalid.", 500, "RELEASE_ADMISSION_REPORT_INVALID");
    }
    validateReleaseAdmissionReport(report);
    return report;
  }

  async listReportIds() {
    try {
      return (await readdir(this.repositoryRoot, { withFileTypes: true }))
        .filter(entry => entry.isDirectory() && /^perl-adm-[a-f0-9]{20}$/.test(entry.name))
        .map(entry => entry.name);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async status() {
    const release = await this.releaseRepository.status();
    const reports = [];
    let corruptReportCount = 0;
    for (const id of await this.listReportIds()) {
      try {
        reports.push(await this.readReport(id));
      } catch {
        corruptReportCount += 1;
      }
    }
    reports.sort((a, b) => Date.parse(b.qualifiedAt) - Date.parse(a.qualifiedAt) || a.admissionId.localeCompare(b.admissionId));
    const latestCandidateId = release.latest?.artifactId || null;
    const latest = reports.find(report => report.artifact.artifactId === latestCandidateId) || null;
    return {
      contractVersion: RELEASE_ADMISSION_CONTRACT,
      policyVersion: RELEASE_ADMISSION_POLICY,
      status: corruptReportCount || release.status === "repository-integrity-failed" ? "repository-integrity-failed" : latest?.status || (latestCandidateId ? "not-run" : "candidate-required"),
      repositoryMode: "local-content-addressed-evidence",
      reportCount: reports.length,
      corruptReportCount,
      candidateId: latestCandidateId,
      latest,
      history: reports.slice(0, 8).map(reportSummary),
      localArchiveQualificationPassed: release.status !== "repository-integrity-failed" && latest?.status === "qualified-local",
      isolatedCiRun: false,
      externalVulnerabilityReviewCompleted: false,
      externalLicenseApprovalCompleted: false,
      productionDeploymentAuthorized: false,
      clinicalReleaseAuthorized: false,
      patientUseAuthorized: false,
      boundary: RELEASE_ADMISSION_BOUNDARY
    };
  }

  async qualify(artifactId, actor = "LOCAL-RELEASE-QUALIFIER") {
    if (this.inFlight.has(artifactId)) return this.inFlight.get(artifactId);
    const promise = this.qualifyOnce(artifactId, actor).finally(() => this.inFlight.delete(artifactId));
    this.inFlight.set(artifactId, promise);
    return promise;
  }

  async qualifyOnce(artifactId, actor) {
    safeActor(actor);
    const candidate = await this.releaseRepository.readCandidate(artifactId);
    const run = await this.qualifier({ candidate });
    const report = buildReleaseAdmissionReport({ candidate, actor, run, clock: this.clock });
    validateReleaseAdmissionReport(report, artifactId);
    await this.ensureRepository();
    const directory = this.reportDirectory(report.admissionId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    try {
      const existing = await this.readReport(report.admissionId);
      if (canonicalJson(existing) !== canonicalJson(report)) fail("Release admission evidence identity conflicts with the stored report.", 409, "RELEASE_ADMISSION_CONFLICT");
    } catch (error) {
      if (error.code === "RELEASE_ADMISSION_NOT_FOUND") await immutableJson(join(directory, "report.json"), report);
      else throw error;
    }
    return { ...(await this.status()), report: reportSummary(report) };
  }

  async download(admissionId) {
    const report = await this.readReport(admissionId);
    return {
      filename: `PERL-${admissionId}.report.json`,
      mediaType: "application/json; charset=utf-8",
      bytes: Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8")
    };
  }
}
