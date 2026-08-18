import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ReleaseAdmissionRepository } from "../src/release-admission.js";
import { ReleaseCandidateRepository } from "../src/release-candidate.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function qualifyLocalReleaseCandidate({
  sourceRoot = projectRoot,
  releaseRepositoryRoot = resolve(projectRoot, "dist/releases"),
  admissionRepositoryRoot = resolve(projectRoot, "dist/release-admissions"),
  artifactId,
  actor = "LOCAL-RELEASE-CLI"
} = {}) {
  const releaseRepository = new ReleaseCandidateRepository({ sourceRoot, repositoryRoot: releaseRepositoryRoot });
  const release = await releaseRepository.status();
  const targetId = artifactId || release.latest?.artifactId;
  if (!targetId) throw new Error("No release candidate exists. Run npm run release:build first.");
  const repository = new ReleaseAdmissionRepository({ releaseRepository, repositoryRoot: admissionRepositoryRoot });
  return repository.qualify(targetId, actor);
}

async function main() {
  const releaseRepositoryRoot = resolve(process.argv[2] || "dist/releases");
  const admissionRepositoryRoot = resolve(process.argv[3] || "dist/release-admissions");
  const artifactId = process.argv[4] || undefined;
  const result = await qualifyLocalReleaseCandidate({ releaseRepositoryRoot, admissionRepositoryRoot, artifactId });
  console.log(JSON.stringify({
    status: result.status,
    admissionId: result.report.admissionId,
    artifactId: result.report.artifactId,
    evidenceHash: result.report.evidenceHash,
    checks: result.report.summary,
    report: resolve(admissionRepositoryRoot, result.report.admissionId, "report.json"),
    isolatedCiRun: false,
    externalVulnerabilityReviewCompleted: false,
    productionDeploymentAuthorized: false,
    clinicalReleaseAuthorized: false
  }, null, 2));
  if (result.status !== "qualified-local") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
