import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ReleaseAdmissionRepository } from "../src/release-admission.js";
import { ReleaseCandidateRepository } from "../src/release-candidate.js";
import { ReleasePromotionRepository } from "../src/release-promotion.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function prepareLocalReleasePromotion({
  sourceRoot = projectRoot,
  releaseRepositoryRoot = resolve(projectRoot, "dist/releases"),
  admissionRepositoryRoot = resolve(projectRoot, "dist/release-admissions"),
  promotionRepositoryRoot = resolve(projectRoot, "dist/release-promotions"),
  artifactId
} = {}) {
  const releaseRepository = new ReleaseCandidateRepository({ sourceRoot, repositoryRoot: releaseRepositoryRoot });
  const admissionRepository = new ReleaseAdmissionRepository({ releaseRepository, repositoryRoot: admissionRepositoryRoot });
  const release = await releaseRepository.status();
  const targetId = artifactId || release.latest?.artifactId;
  if (!targetId) throw new Error("No release candidate exists. Run npm run release:build first.");
  const promotionRepository = new ReleasePromotionRepository({ releaseRepository, admissionRepository, repositoryRoot: promotionRepositoryRoot });
  return promotionRepository.prepare(targetId);
}

async function main() {
  const releaseRepositoryRoot = resolve(process.argv[2] || "dist/releases");
  const admissionRepositoryRoot = resolve(process.argv[3] || "dist/release-admissions");
  const promotionRepositoryRoot = resolve(process.argv[4] || "dist/release-promotions");
  const artifactId = process.argv[5] || undefined;
  const result = await prepareLocalReleasePromotion({ releaseRepositoryRoot, admissionRepositoryRoot, promotionRepositoryRoot, artifactId });
  console.log(JSON.stringify({
    status: result.status,
    requestId: result.request.requestId,
    artifactId: result.request.artifactId,
    requestHash: result.request.requestHash,
    gates: result.request.gateCount,
    request: resolve(promotionRepositoryRoot, result.request.requestId, "request.json"),
    attestationTemplate: resolve(promotionRepositoryRoot, result.request.requestId, "attestation-template.json"),
    externalEvidenceVerified: false,
    deploymentAuthorized: false,
    clinicalReleaseAuthorized: false
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
