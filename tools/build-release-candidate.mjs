import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ReleaseCandidateRepository } from "../src/release-candidate.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function buildLocalReleaseCandidate({
  sourceRoot = projectRoot,
  repositoryRoot = resolve(projectRoot, "dist/releases"),
  actor = "LOCAL-RELEASE-CLI"
} = {}) {
  const repository = new ReleaseCandidateRepository({ sourceRoot, repositoryRoot });
  return repository.build(actor);
}

async function main() {
  const repositoryRoot = resolve(process.argv[2] || "dist/releases");
  const result = await buildLocalReleaseCandidate({ repositoryRoot });
  console.log(JSON.stringify({
    status: result.candidate.status,
    artifactId: result.candidate.artifactId,
    archive: resolve(repositoryRoot, result.candidate.artifactId, result.candidate.archiveFilename),
    archiveSha256: result.candidate.archiveSha256,
    sourceFileCount: result.candidate.sourceFileCount,
    sourceBytes: result.candidate.sourceBytes,
    archiveBytes: result.candidate.archiveBytes,
    idempotent: result.idempotent,
    productionSignatureVerified: result.candidate.productionSignatureVerified,
    azureDeploymentPerformed: false,
    clinicalReleaseAuthorized: false
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
