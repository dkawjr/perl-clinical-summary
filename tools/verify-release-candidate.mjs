import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReleaseArchive } from "../src/release-candidate.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function latestArchive(repositoryRoot) {
  const candidates = await readdir(repositoryRoot, { withFileTypes: true });
  const archives = [];
  for (const candidate of candidates) {
    if (!candidate.isDirectory() || !/^perl-rc-[a-f0-9]{20}$/.test(candidate.name)) continue;
    const candidateRoot = resolve(repositoryRoot, candidate.name);
    const files = await readdir(candidateRoot);
    const archive = files.find(name => /^PERL-perl-rc-[a-f0-9]{20}\.tar\.gz$/.test(name));
    if (!archive) continue;
    let createdAt = "";
    try {
      const receipt = JSON.parse(await readFile(resolve(candidateRoot, "receipt.json"), "utf8"));
      createdAt = typeof receipt.createdAt === "string" ? receipt.createdAt : "";
    } catch {
      // A standalone candidate without a receipt remains eligible as the oldest entry.
    }
    archives.push({ path: resolve(candidateRoot, archive), createdAt, artifactId: candidate.name });
  }
  archives.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.artifactId.localeCompare(b.artifactId));
  if (!archives.length) throw new Error("No release candidate archive exists. Run npm run release:build first.");
  return archives.at(-1).path;
}

export async function verifyLocalReleaseCandidate(archivePath) {
  const resolved = resolve(archivePath);
  const receiptPath = resolve(dirname(resolved), "receipt.json");
  let expected = null;
  try {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    expected = receipt.archiveSha256;
  } catch {
    // A standalone candidate can still be verified from its internal manifest.
  }
  return verifyReleaseArchive(await readFile(resolved), expected);
}

async function main() {
  const archivePath = process.argv[2]
    ? resolve(process.argv[2])
    : await latestArchive(resolve(projectRoot, "dist/releases"));
  const verification = await verifyLocalReleaseCandidate(archivePath);
  console.log(JSON.stringify({
    archive: basename(archivePath),
    ...verification
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
