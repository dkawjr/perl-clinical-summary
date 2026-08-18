import { createHash, createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { chmod, lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const RELEASE_CANDIDATE_CONTRACT = "perl-release-candidate/1.0";
export const RELEASE_MANIFEST_CONTRACT = "perl-release-candidate-manifest/1.0";
export const RELEASE_CONFIGURATION_CONTRACT = "perl-release-configuration/1.0";
export const RELEASE_SIGNATURE_REQUEST_CONTRACT = "perl-release-signing-request/1.0";
export const RELEASE_SIGNATURE_CONTRACT = "perl-release-signature/1.0";
export const RELEASE_TRUST_POLICY_CONTRACT = "perl-release-trust-policy/1.0";
export const RELEASE_BUILD_TYPE = "https://focusedfuture.org/perl/build/release-candidate/v1";
export const RELEASE_BOUNDARY = "This content-addressed bundle is a reproducible, PHI-excluding release candidate. Local verification does not provide a production signature, deploy to Azure, configure e-QPASS, authorize clinical use, activate traffic, or establish clinical validation.";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 48 * 1024 * 1024;
const MAX_FILES = 512;
const RELEASE_SOURCE_EXTENSION = /\.(?:css|html|js|json|md|mjs|pdf|png|py|svg|ya?ml)$/i;
const ROOT_FILES = new Set([
  "Launch PERL.command",
  "README.md",
  "app.js",
  "index.html",
  "package-lock.json",
  "package.json",
  "server.mjs",
  "styles.css"
]);
const SOURCE_DIRECTORIES = Object.freeze(["assets", "deploy", "docs", "examples", "schemas", "src", "tests", "tools"]);
const PINNED_EVIDENCE = Object.freeze([
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
]);
const METADATA_PATHS = Object.freeze([
  "release/configuration.json",
  "release/sbom.cdx.json",
  "release/manifest.json"
]);
const ENVIRONMENT_CONTRACT = Object.freeze([
  Object.freeze({ name: "PORT", classification: "configuration", required: false, default: "4173", persisted: false }),
  Object.freeze({ name: "PERL_AUTHORITY_TRUST_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_CLINICAL_RELEASE_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_COUNSELOR_REFERENCE_DECISION_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_INDEPENDENT_REVIEW_ADMISSION_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_IDENTITY_ACCESS_POLICY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_MODEL_TRANSPORT_POLICY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_PILOT_START_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_RELEASE_ADMISSION_REPOSITORY_DIR", classification: "configuration", required: false, default: "data/release-admissions", persisted: false }),
  Object.freeze({ name: "PERL_RELEASE_PROMOTION_REPOSITORY_DIR", classification: "configuration", required: false, default: "data/release-promotions", persisted: false }),
  Object.freeze({ name: "PERL_RELEASE_PROMOTION_TRUST_POLICY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_RELEASE_REPOSITORY_DIR", classification: "configuration", required: false, default: "data/releases", persisted: false }),
  Object.freeze({ name: "PERL_RELEASE_TRUST_POLICY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_REQUIRE_RUNTIME_POLICY", classification: "configuration", required: false, default: "false", persisted: false }),
  Object.freeze({ name: "PERL_RUNTIME_POLICY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_TRAFFIC_ACTIVATION_REGISTRY_FILE", classification: "owner-only-policy-path", required: false, default: null, persisted: false }),
  Object.freeze({ name: "PERL_MODEL_*_TOKEN", classification: "runtime-secret", required: false, default: null, persisted: false })
]);

function fail(message, status = 400, code = "RELEASE_CANDIDATE_INVALID") {
  throw Object.assign(new Error(message), { status, code });
}

const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(ordered(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeRelativePath(path) {
  return typeof path === "string"
    && path.length > 0
    && path.length <= 240
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").some(part => !part || part === "." || part === "..");
}

function rootRuntimeFile(name) {
  return ROOT_FILES.has(name)
    || /^[A-Za-z0-9][A-Za-z0-9-]*\.css$/.test(name)
    || /^[A-Za-z0-9][A-Za-z0-9-]*(?:-print)?\.js$/.test(name);
}

function releasableSourcePath(path) {
  if (!safeRelativePath(path)) return false;
  if (!path.includes("/")) return rootRuntimeFile(path);
  if (PINNED_EVIDENCE.includes(path)) return true;
  if (path === "deploy/Containerfile" || path === "deploy/production-review.env.example") return true;
  return SOURCE_DIRECTORIES.some(directory => path.startsWith(`${directory}/`))
    && RELEASE_SOURCE_EXTENSION.test(path)
    && !path.split("/").some(part => part.startsWith("."));
}

function secretPattern(path, bytes) {
  const text = /(?:\.(?:command|css|html|js|json|md|mjs|svg)|Containerfile)$/i.test(path) ? bytes.toString("utf8") : "";
  if (/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) return "private-key-material";
  if (/\bAKIA[0-9A-Z]{16}\b/.test(text)) return "aws-access-key";
  if (/\b(?:sk|rk|pk)-(?:live|prod)-[A-Za-z0-9_-]{16,}\b/.test(text)) return "live-service-key";
  if (/\bBearer\s+[A-Za-z0-9._~+/-]{40,}={0,2}\b/.test(text)) return "bearer-credential";
  return null;
}

async function collectDirectory(sourceRoot, directory, output) {
  const absolute = join(sourceRoot, directory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  entries.sort((a, b) => compareText(a.name, b.name));
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (!safeRelativePath(path)) fail(`Unsafe release source path: ${path}.`);
    const metadata = await lstat(join(sourceRoot, path));
    if (metadata.isSymbolicLink()) fail(`Release source must not contain symbolic links: ${path}.`);
    if (metadata.isDirectory()) await collectDirectory(sourceRoot, path, output);
    else if (metadata.isFile() && releasableSourcePath(path)) output.push(path);
    else if (metadata.isFile()) fail(`Release source type is outside the allowlist: ${path}.`, 409, "RELEASE_SOURCE_TYPE_INVALID");
    else fail(`Release source must contain regular files only: ${path}.`);
  }
}

async function collectPinnedFile(sourceRoot, path, output) {
  try {
    const metadata = await lstat(join(sourceRoot, path));
    if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`Pinned release evidence must be a regular file: ${path}.`);
    output.push(path);
  } catch (error) {
    if (error.code === "ENOENT") fail(`Pinned release evidence is missing: ${path}.`, 500, "RELEASE_EVIDENCE_MISSING");
    throw error;
  }
}

export async function collectReleaseFiles(sourceRoot) {
  const resolvedRoot = resolve(sourceRoot);
  const paths = [];
  const rootEntries = await readdir(resolvedRoot, { withFileTypes: true });
  for (const entry of rootEntries.sort((a, b) => compareText(a.name, b.name))) {
    if (!entry.isFile() || !rootRuntimeFile(entry.name)) continue;
    const metadata = await lstat(join(resolvedRoot, entry.name));
    if (metadata.isSymbolicLink()) fail(`Release source must not contain symbolic links: ${entry.name}.`);
    paths.push(entry.name);
  }
  for (const directory of SOURCE_DIRECTORIES) await collectDirectory(resolvedRoot, directory, paths);
  for (const path of PINNED_EVIDENCE) await collectPinnedFile(resolvedRoot, path, paths);
  const unique = [...new Set(paths)].sort(compareText);
  if (unique.length < 20 || unique.length > MAX_FILES) fail("Release source inventory is outside the bounded file-count range.", 500, "RELEASE_INVENTORY_INVALID");
  const files = [];
  let totalBytes = 0;
  for (const path of unique) {
    const bytes = await readFile(join(resolvedRoot, path));
    if (bytes.length > MAX_FILE_BYTES) fail(`Release source exceeds the per-file limit: ${path}.`, 500, "RELEASE_FILE_TOO_LARGE");
    const secret = secretPattern(path, bytes);
    if (secret) fail(`Release source privacy scan rejected ${path} (${secret}).`, 409, "RELEASE_SECRET_DETECTED");
    totalBytes += bytes.length;
    if (totalBytes > MAX_SOURCE_BYTES) fail("Release source exceeds the total-size limit.", 500, "RELEASE_SOURCE_TOO_LARGE");
    files.push(Object.freeze({ path, bytes, size: bytes.length, sha256: sha256(bytes) }));
  }
  return Object.freeze({ sourceRoot: resolvedRoot, files: Object.freeze(files), totalBytes });
}

function mediaTypeFor(path) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  return ({
    css: "text/css",
    html: "text/html",
    js: "text/javascript",
    json: "application/json",
    md: "text/markdown",
    mjs: "text/javascript",
    command: "text/x-shellscript",
    pdf: "application/pdf",
    png: "image/png",
    py: "text/x-python",
    svg: "image/svg+xml",
    yaml: "application/yaml",
    yml: "application/yaml"
  })[extension] || "application/octet-stream";
}

function buildConfiguration() {
  return {
    contractVersion: RELEASE_CONFIGURATION_CONTRACT,
    runtime: { engine: "node", supported: ">=18", entrypoint: "server.mjs", packageManagerDependencies: 0 },
    server: { defaultHost: "127.0.0.1", defaultPort: 4173, tlsTerminatedUpstream: true },
    environmentVariables: ENVIRONMENT_CONTRACT,
    persistence: { runtimePath: "data/sandbox-state.json", includedInArtifact: false, ownerOnlyRequired: true },
    releaseRepository: { defaultRuntimePath: "data/releases", includedInArtifact: false, contentAddressed: true },
    network: { inboundDefault: "loopback-only", outboundDefault: "disabled", modelOutboundRequiresStartupPolicy: true },
    dataBoundary: {
      syntheticFixturesIncluded: true,
      runtimeStateIncluded: false,
      emailMaterialIncluded: false,
      productionRecordsIncluded: false,
      phiIncluded: false,
      credentialsIncluded: false,
      privateKeysIncluded: false
    },
    productionDependencies: [
      "TLS ingress and approved Azure hosting",
      "Production SSO/RBAC and service identity",
      "Authoritative e-QPASS event and attachment contracts",
      "Encrypted transactional persistence and backups",
      "Continuous telemetry, alerting, and incident ownership",
      "External release signature and governed deployment authority"
    ]
  };
}

export function validateReleaseConfiguration(configuration) {
  const errors = [];
  const exact = (value, keys) => exactObject(value, keys);
  if (!exact(configuration, ["contractVersion", "runtime", "server", "environmentVariables", "persistence", "releaseRepository", "network", "dataBoundary", "productionDependencies"])) return ["Release configuration must contain the exact contract fields."];
  if (configuration.contractVersion !== RELEASE_CONFIGURATION_CONTRACT) errors.push("Release configuration contract is invalid.");
  if (!exact(configuration.runtime, ["engine", "supported", "entrypoint", "packageManagerDependencies"]) || configuration.runtime.engine !== "node" || configuration.runtime.supported !== ">=18" || configuration.runtime.entrypoint !== "server.mjs" || configuration.runtime.packageManagerDependencies !== 0) errors.push("Release runtime configuration is invalid.");
  if (!exact(configuration.server, ["defaultHost", "defaultPort", "tlsTerminatedUpstream"]) || configuration.server.defaultHost !== "127.0.0.1" || configuration.server.defaultPort !== 4173 || configuration.server.tlsTerminatedUpstream !== true) errors.push("Release server configuration is invalid.");
  if (!Array.isArray(configuration.environmentVariables) || configuration.environmentVariables.length < 2 || configuration.environmentVariables.length > 32) {
    errors.push("Release environment-variable inventory is invalid.");
  } else {
    const names = new Set();
    for (const variable of configuration.environmentVariables) {
      if (!exact(variable, ["name", "classification", "required", "default", "persisted"]) || !/^(?:PORT|PERL_[A-Z0-9_*]+)$/.test(variable?.name || "") || names.has(variable.name) || !["configuration", "owner-only-policy-path", "runtime-secret"].includes(variable.classification) || variable.required !== false || variable.persisted !== false || !(variable.default === null || typeof variable.default === "string" && variable.default.length <= 128) || variable.classification !== "configuration" && variable.default !== null || variable.classification === "runtime-secret" && !variable.name.includes("*")) errors.push("Release environment-variable descriptor is invalid.");
      names.add(variable?.name);
    }
    if (!names.has("PORT") || !names.has("PERL_MODEL_*_TOKEN")) errors.push("Release environment-variable boundary is incomplete.");
  }
  if (!exact(configuration.persistence, ["runtimePath", "includedInArtifact", "ownerOnlyRequired"]) || configuration.persistence.runtimePath !== "data/sandbox-state.json" || configuration.persistence.includedInArtifact !== false || configuration.persistence.ownerOnlyRequired !== true) errors.push("Release persistence boundary is invalid.");
  if (!exact(configuration.releaseRepository, ["defaultRuntimePath", "includedInArtifact", "contentAddressed"]) || configuration.releaseRepository.defaultRuntimePath !== "data/releases" || configuration.releaseRepository.includedInArtifact !== false || configuration.releaseRepository.contentAddressed !== true) errors.push("Release repository boundary is invalid.");
  if (!exact(configuration.network, ["inboundDefault", "outboundDefault", "modelOutboundRequiresStartupPolicy"]) || configuration.network.inboundDefault !== "loopback-only" || configuration.network.outboundDefault !== "disabled" || configuration.network.modelOutboundRequiresStartupPolicy !== true) errors.push("Release network boundary is invalid.");
  const dataBoundary = configuration.dataBoundary || {};
  if (!exact(dataBoundary, ["syntheticFixturesIncluded", "runtimeStateIncluded", "emailMaterialIncluded", "productionRecordsIncluded", "phiIncluded", "credentialsIncluded", "privateKeysIncluded"]) || dataBoundary.syntheticFixturesIncluded !== true || dataBoundary.runtimeStateIncluded !== false || dataBoundary.emailMaterialIncluded !== false || dataBoundary.productionRecordsIncluded !== false || dataBoundary.phiIncluded !== false || dataBoundary.credentialsIncluded !== false || dataBoundary.privateKeysIncluded !== false) errors.push("Release data boundary is invalid.");
  if (!Array.isArray(configuration.productionDependencies) || configuration.productionDependencies.length < 4 || configuration.productionDependencies.length > 16 || new Set(configuration.productionDependencies).size !== configuration.productionDependencies.length || configuration.productionDependencies.some(item => typeof item !== "string" || item.length < 8 || item.length > 160)) errors.push("Release production-dependency inventory is invalid.");
  return [...new Set(errors)];
}

function buildSbom(files, sourceDigest) {
  const rootRef = `pkg:generic/focused-future-perl@0.1.0?source_sha256=${sourceDigest}`;
  const components = files.map(file => ({
    type: "file",
    "bom-ref": `file:${file.sha256}`,
    name: file.path,
    hashes: [{ alg: "SHA-256", content: file.sha256 }],
    properties: [
      { name: "perl:bytes", value: String(file.size) },
      { name: "perl:media-type", value: mediaTypeFor(file.path) }
    ]
  }));
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: {
        type: "application",
        "bom-ref": rootRef,
        group: "Focused Future",
        name: "PERL clinical-summary workspace",
        version: "0.1.0",
        properties: [
          { name: "perl:artifact-contract", value: RELEASE_CANDIDATE_CONTRACT },
          { name: "perl:data-classification", value: "synthetic-only" },
          { name: "perl:clinical-validation", value: "false" }
        ]
      }
    },
    components,
    dependencies: [{ ref: rootRef, dependsOn: components.map(component => component["bom-ref"]) }]
  };
}

function buildProvenance(manifest, archiveSha256) {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: manifest.archiveFilename, digest: { sha256: archiveSha256 } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: RELEASE_BUILD_TYPE,
        externalParameters: { artifactId: manifest.artifactId, contractVersion: RELEASE_CANDIDATE_CONTRACT, sourceDigest: manifest.source.digest },
        internalParameters: { deterministicTar: true, gzipMtime: 0, runtimeStateIncluded: false, phiIncluded: false, credentialsIncluded: false },
        resolvedDependencies: manifest.contents.map(file => ({ uri: `file:perl/${file.path}`, digest: { sha256: file.sha256 } }))
      },
      runDetails: {
        builder: { id: "urn:focused-future:perl:local-release-builder:v1" },
        metadata: { invocationId: `urn:sha256:${archiveSha256}` }
      }
    }
  };
}

function buildSigningRequest(manifest, archiveSha256, provenanceSha256) {
  return {
    contractVersion: RELEASE_SIGNATURE_REQUEST_CONTRACT,
    artifactId: manifest.artifactId,
    requiredSignerRole: "production-release-authority",
    algorithm: "Ed25519",
    payloadTemplate: {
      signatureContractVersion: RELEASE_SIGNATURE_CONTRACT,
      artifactId: manifest.artifactId,
      archiveSha256,
      manifestSha256: sha256(jsonBytes(manifest)),
      provenanceSha256,
      sbomSha256: manifest.sbom.sha256,
      keyId: null,
      purpose: "verify-exact-release-candidate",
      signedAt: null,
      expiresAt: null,
      artifactIntegrityAttested: true,
      deploymentAuthorized: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false
    },
    signatureEncoding: "base64",
    privateKeyAcceptedByPerl: false,
    boundary: "Sign the canonical JSON payload outside PERL. Returning a valid signature attests artifact integrity only; it does not authorize deployment, clinical use, traffic, or patient use."
  };
}

function splitTarPath(path) {
  const nameBytes = Buffer.byteLength(path);
  if (nameBytes <= 100) return { name: path, prefix: "" };
  for (let index = path.lastIndexOf("/"); index > 0; index = path.lastIndexOf("/", index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  fail(`Release archive path is too long: ${path}.`, 500, "RELEASE_PATH_TOO_LONG");
}

function tarOctal(value, width) {
  const encoded = Math.trunc(value).toString(8);
  if (encoded.length > width - 1) fail("Release tar field exceeds its bounded width.", 500, "RELEASE_TAR_INVALID");
  return `${encoded.padStart(width - 1, "0")}\0`;
}

function tarEntry(path, bytes) {
  const { name, prefix } = splitTarPath(path);
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, "utf8");
  header.write(tarOctal(0o644, 8), 100, 8, "ascii");
  header.write(tarOctal(0, 8), 108, 8, "ascii");
  header.write(tarOctal(0, 8), 116, 8, "ascii");
  header.write(tarOctal(bytes.length, 12), 124, 12, "ascii");
  header.write(tarOctal(0, 12), 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write(prefix, 345, 155, "utf8");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512, 0);
  return Buffer.concat([header, bytes, padding]);
}

function makeTar(entries) {
  return Buffer.concat([...entries.map(entry => tarEntry(entry.path, entry.bytes)), Buffer.alloc(1024, 0)]);
}

function parseTarOctal(buffer) {
  const value = buffer.toString("ascii").replace(/\0.*$/, "").trim();
  return value ? Number.parseInt(value, 8) : 0;
}

function parseTar(archiveBytes) {
  if (!Buffer.isBuffer(archiveBytes) || archiveBytes.length < 64 || archiveBytes.length > MAX_ARCHIVE_BYTES) fail("Release archive is outside the bounded size range.", 400, "RELEASE_ARCHIVE_SIZE_INVALID");
  if (archiveBytes[0] !== 0x1f || archiveBytes[1] !== 0x8b || archiveBytes[2] !== 8 || archiveBytes[3] !== 0 || archiveBytes.subarray(4, 8).some(byte => byte !== 0)) fail("Release archive does not use the deterministic gzip envelope.", 400, "RELEASE_ARCHIVE_INVALID");
  let tar;
  try {
    tar = gunzipSync(archiveBytes, { maxOutputLength: MAX_SOURCE_BYTES + 8 * 1024 * 1024 });
  } catch {
    fail("Release archive is not a valid bounded gzip stream.", 400, "RELEASE_ARCHIVE_INVALID");
  }
  const entries = new Map();
  let offset = 0;
  let zeroBlocks = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every(byte => byte === 0)) {
      zeroBlocks += 1;
      if (zeroBlocks === 2) break;
      continue;
    }
    zeroBlocks = 0;
    const expectedChecksum = parseTarOctal(header.subarray(148, 156));
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (expectedChecksum !== actualChecksum) fail("Release archive header checksum failed.", 400, "RELEASE_ARCHIVE_TAMPERED");
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const path = prefix ? `${prefix}/${name}` : name;
    const type = header.subarray(156, 157).toString("ascii") || "0";
    const size = parseTarOctal(header.subarray(124, 136));
    if (!safeRelativePath(path) || type !== "0" || entries.has(path)) fail("Release archive contains an unsafe, non-regular, or repeated entry.", 400, "RELEASE_ARCHIVE_ENTRY_INVALID");
    if (!Number.isInteger(size) || size < 0 || size > MAX_FILE_BYTES || offset + size > tar.length) fail("Release archive entry size is invalid.", 400, "RELEASE_ARCHIVE_ENTRY_INVALID");
    const bytes = Buffer.from(tar.subarray(offset, offset + size));
    if (!header.equals(tarEntry(path, bytes).subarray(0, 512))) fail("Release archive entry header is not canonical.", 400, "RELEASE_ARCHIVE_ENTRY_INVALID");
    entries.set(path, bytes);
    if (entries.size > MAX_FILES + METADATA_PATHS.length) fail("Release archive contains too many entries.", 400, "RELEASE_ARCHIVE_ENTRY_INVALID");
    offset += Math.ceil(size / 512) * 512;
  }
  if (zeroBlocks < 2 || offset !== tar.length) fail("Release archive terminator is missing or contains trailing data.", 400, "RELEASE_ARCHIVE_INVALID");
  return entries;
}

function sourceDigestFor(entries) {
  return sha256(canonicalJson(entries.map(file => ({ path: file.path, size: file.size, sha256: file.sha256 }))));
}

function validateManifestShape(manifest) {
  const exactKeys = ["artifactId", "archiveFilename", "authority", "boundary", "claims", "configuration", "contents", "contractVersion", "entrypoint", "runtime", "sbom", "source"];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify([...exactKeys].sort())) fail("Release manifest shape is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (manifest.contractVersion !== RELEASE_MANIFEST_CONTRACT) fail("Release manifest contract is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!/^perl-rc-[a-f0-9]{20}$/.test(manifest.artifactId || "")) fail("Release artifact identity is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (manifest.archiveFilename !== `PERL-${manifest.artifactId}.tar.gz`) fail("Release archive filename is not bound to its identity.", 400, "RELEASE_MANIFEST_INVALID");
  if (manifest.entrypoint !== "server.mjs" || manifest.runtime !== "node>=18") fail("Release runtime contract is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!exactObject(manifest.source, ["digest", "fileCount", "totalBytes"]) || !/^[a-f0-9]{64}$/.test(manifest.source.digest || "") || !Number.isInteger(manifest.source.fileCount) || !Number.isInteger(manifest.source.totalBytes) || manifest.source.totalBytes < 1 || manifest.source.totalBytes > MAX_SOURCE_BYTES) fail("Release source summary is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!exactObject(manifest.configuration, ["path", "sha256", "contractVersion"]) || manifest.configuration.path !== "release/configuration.json" || manifest.configuration.contractVersion !== RELEASE_CONFIGURATION_CONTRACT || !/^[a-f0-9]{64}$/.test(manifest.configuration.sha256 || "")) fail("Release configuration descriptor is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!exactObject(manifest.sbom, ["path", "sha256", "format", "specVersion"]) || manifest.sbom.path !== "release/sbom.cdx.json" || manifest.sbom.format !== "CycloneDX" || manifest.sbom.specVersion !== "1.6" || !/^[a-f0-9]{64}$/.test(manifest.sbom.sha256 || "")) fail("Release SBOM descriptor is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!Array.isArray(manifest.contents) || manifest.contents.length < 20 || manifest.contents.length > MAX_FILES) fail("Release manifest content inventory is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (!exactObject(manifest.authority, ["localBuildVerified", "externalSignatureRequired", "deploymentAuthorityExternal"])) fail("Release authority shape is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  const claims = manifest.claims || {};
  if (!exactObject(claims, ["syntheticOnly", "runtimeStateIncluded", "phiIncluded", "credentialsIncluded", "privateKeysIncluded", "productionSignatureVerified", "azureDeploymentPerformed", "eqpassProductionConnected", "clinicalValidation", "clinicalReleaseAuthorized", "trafficActivationAuthorized", "patientUseAuthorized"])) fail("Release claim shape is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (claims.syntheticOnly !== true || claims.runtimeStateIncluded !== false || claims.phiIncluded !== false || claims.credentialsIncluded !== false || claims.privateKeysIncluded !== false || claims.productionSignatureVerified !== false || claims.azureDeploymentPerformed !== false || claims.eqpassProductionConnected !== false || claims.clinicalValidation !== false || claims.clinicalReleaseAuthorized !== false || claims.trafficActivationAuthorized !== false || claims.patientUseAuthorized !== false) fail("Release manifest claim boundary is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (manifest.authority?.localBuildVerified !== true || manifest.authority?.externalSignatureRequired !== true || manifest.authority?.deploymentAuthorityExternal !== true) fail("Release authority boundary is invalid.", 400, "RELEASE_MANIFEST_INVALID");
  if (manifest.boundary !== RELEASE_BOUNDARY) fail("Release boundary text is invalid.", 400, "RELEASE_MANIFEST_INVALID");
}

export async function buildReleaseCandidate(sourceRoot) {
  const inventory = await collectReleaseFiles(sourceRoot);
  const contents = inventory.files.map(file => ({ path: file.path, size: file.size, sha256: file.sha256, mediaType: mediaTypeFor(file.path), mode: "0644" }));
  const sourceDigest = sourceDigestFor(contents);
  const configuration = buildConfiguration();
  const sbom = buildSbom(contents, sourceDigest);
  const configurationBytes = jsonBytes(configuration);
  const sbomBytes = jsonBytes(sbom);
  const identityDigest = sha256(canonicalJson({
    contractVersion: RELEASE_CANDIDATE_CONTRACT,
    sourceDigest,
    configurationSha256: sha256(configurationBytes),
    sbomSha256: sha256(sbomBytes)
  }));
  const artifactId = `perl-rc-${identityDigest.slice(0, 20)}`;
  const archiveFilename = `PERL-${artifactId}.tar.gz`;
  const manifest = {
    contractVersion: RELEASE_MANIFEST_CONTRACT,
    artifactId,
    archiveFilename,
    entrypoint: "server.mjs",
    runtime: "node>=18",
    source: { digest: sourceDigest, fileCount: contents.length, totalBytes: inventory.totalBytes },
    configuration: { path: "release/configuration.json", sha256: sha256(configurationBytes), contractVersion: RELEASE_CONFIGURATION_CONTRACT },
    sbom: { path: "release/sbom.cdx.json", sha256: sha256(sbomBytes), format: "CycloneDX", specVersion: "1.6" },
    contents,
    authority: { localBuildVerified: true, externalSignatureRequired: true, deploymentAuthorityExternal: true },
    claims: {
      syntheticOnly: true,
      runtimeStateIncluded: false,
      phiIncluded: false,
      credentialsIncluded: false,
      privateKeysIncluded: false,
      productionSignatureVerified: false,
      azureDeploymentPerformed: false,
      eqpassProductionConnected: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false
    },
    boundary: RELEASE_BOUNDARY
  };
  validateManifestShape(manifest);
  const manifestBytes = jsonBytes(manifest);
  const entries = [
    { path: "release/configuration.json", bytes: configurationBytes },
    { path: "release/sbom.cdx.json", bytes: sbomBytes },
    { path: "release/manifest.json", bytes: manifestBytes },
    ...inventory.files.map(file => ({ path: `perl/${file.path}`, bytes: file.bytes }))
  ].sort((a, b) => compareText(a.path, b.path));
  const archiveBytes = gzipSync(makeTar(entries), { level: 9, mtime: 0 });
  const archiveSha256 = sha256(archiveBytes);
  const provenance = buildProvenance(manifest, archiveSha256);
  const provenanceBytes = jsonBytes(provenance);
  const signingRequest = buildSigningRequest(manifest, archiveSha256, sha256(provenanceBytes));
  return Object.freeze({
    artifactId,
    archiveFilename,
    archiveBytes,
    archiveSha256,
    manifest,
    manifestBytes,
    configuration,
    configurationBytes,
    sbom,
    sbomBytes,
    provenance,
    provenanceBytes,
    signingRequest,
    signingRequestBytes: jsonBytes(signingRequest)
  });
}

export function verifyReleaseArchive(archiveBytes, expectedArchiveSha256 = null) {
  const archiveSha256 = sha256(archiveBytes);
  if (expectedArchiveSha256 && archiveSha256 !== expectedArchiveSha256) fail("Release archive digest does not match the expected candidate.", 409, "RELEASE_ARCHIVE_TAMPERED");
  const entries = parseTar(archiveBytes);
  for (const path of METADATA_PATHS) if (!entries.has(path)) fail(`Release archive is missing ${path}.`, 400, "RELEASE_MANIFEST_INVALID");
  let manifest;
  let configuration;
  let sbom;
  try {
    manifest = JSON.parse(entries.get("release/manifest.json").toString("utf8"));
    configuration = JSON.parse(entries.get("release/configuration.json").toString("utf8"));
    sbom = JSON.parse(entries.get("release/sbom.cdx.json").toString("utf8"));
  } catch {
    fail("Release metadata must be valid JSON.", 400, "RELEASE_MANIFEST_INVALID");
  }
  validateManifestShape(manifest);
  if (validateReleaseConfiguration(configuration).length || sha256(entries.get("release/configuration.json")) !== manifest.configuration.sha256) fail("Release configuration integrity failed.", 409, "RELEASE_ARCHIVE_TAMPERED");
  const seen = new Set();
  let totalBytes = 0;
  for (const [index, file] of manifest.contents.entries()) {
    if (!exactObject(file, ["path", "size", "sha256", "mediaType", "mode"]) || !releasableSourcePath(file.path) || seen.has(file.path) || (index > 0 && compareText(manifest.contents[index - 1].path, file.path) >= 0) || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(file.sha256 || "") || file.mediaType !== mediaTypeFor(file.path) || file.mode !== "0644") fail("Release content manifest is invalid.", 400, "RELEASE_MANIFEST_INVALID");
    seen.add(file.path);
    const bytes = entries.get(`perl/${file.path}`);
    if (!bytes || bytes.length !== file.size || sha256(bytes) !== file.sha256) fail(`Release content integrity failed for ${file.path}.`, 409, "RELEASE_ARCHIVE_TAMPERED");
    totalBytes += file.size;
  }
  const expectedEntries = new Set([...METADATA_PATHS, ...manifest.contents.map(file => `perl/${file.path}`)]);
  if (entries.size !== expectedEntries.size || [...entries.keys()].some(path => !expectedEntries.has(path))) fail("Release archive contains undeclared content.", 409, "RELEASE_ARCHIVE_TAMPERED");
  if (totalBytes !== manifest.source.totalBytes || manifest.contents.length !== manifest.source.fileCount || sourceDigestFor(manifest.contents) !== manifest.source.digest) fail("Release source aggregate integrity failed.", 409, "RELEASE_ARCHIVE_TAMPERED");
  if (canonicalJson(sbom) !== canonicalJson(buildSbom(manifest.contents, manifest.source.digest)) || sha256(entries.get("release/sbom.cdx.json")) !== manifest.sbom.sha256) fail("Release SBOM integrity failed.", 409, "RELEASE_ARCHIVE_TAMPERED");
  const identityDigest = sha256(canonicalJson({
    contractVersion: RELEASE_CANDIDATE_CONTRACT,
    sourceDigest: manifest.source.digest,
    configurationSha256: manifest.configuration.sha256,
    sbomSha256: manifest.sbom.sha256
  }));
  if (manifest.artifactId !== `perl-rc-${identityDigest.slice(0, 20)}`) fail("Release artifact identity is not content bound.", 409, "RELEASE_ARCHIVE_TAMPERED");
  return {
    contractVersion: RELEASE_CANDIDATE_CONTRACT,
    status: "verified-release-candidate",
    artifactId: manifest.artifactId,
    archiveSha256,
    sourceDigest: manifest.source.digest,
    sourceFileCount: manifest.source.fileCount,
    sourceBytes: manifest.source.totalBytes,
    manifestSha256: sha256(entries.get("release/manifest.json")),
    sbomSha256: sha256(entries.get("release/sbom.cdx.json")),
    configurationSha256: sha256(entries.get("release/configuration.json")),
    syntheticOnly: true,
    productionSignatureVerified: false,
    deployableCandidateAvailable: true,
    azureDeploymentPerformed: false,
    clinicalReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: RELEASE_BOUNDARY
  };
}

export async function materializeVerifiedReleaseArchive(archiveBytes, targetRoot, expectedArchiveSha256 = null) {
  const verification = verifyReleaseArchive(archiveBytes, expectedArchiveSha256);
  const root = resolve(targetRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  if ((await readdir(root)).length) fail("Release materialization target must be empty.", 409, "RELEASE_MATERIALIZATION_TARGET_NOT_EMPTY");
  const entries = parseTar(archiveBytes);
  for (const [path, bytes] of [...entries.entries()].sort(([a], [b]) => compareText(a, b))) {
    const destination = resolve(root, path);
    if (!destination.startsWith(`${root}${sep}`)) fail("Release archive materialization path is unsafe.", 400, "RELEASE_ARCHIVE_ENTRY_INVALID");
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  }
  return verification;
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateReceipt(receipt) {
  const keys = ["actor", "archiveBytes", "archiveFilename", "archiveSha256", "artifactId", "azureDeploymentPerformed", "clinicalReleaseAuthorized", "configurationFilename", "configurationSha256", "contractVersion", "createdAt", "credentialsIncluded", "immutableFiles", "manifestFilename", "manifestSha256", "patientUseAuthorized", "phiIncluded", "productionSignatureVerified", "provenanceFilename", "provenanceSha256", "runtimeStateIncluded", "sbomFilename", "sbomSha256", "signingRequestFilename", "signingRequestSha256", "sourceBytes", "sourceDigest", "sourceFileCount"];
  if (!exactObject(receipt, keys)) fail("Release receipt must contain the exact contract fields.", 500, "RELEASE_RECEIPT_INVALID");
  if (receipt.contractVersion !== RELEASE_CANDIDATE_CONTRACT || !/^perl-rc-[a-f0-9]{20}$/.test(receipt.artifactId || "")) fail("Release receipt contract or identity is invalid.", 500, "RELEASE_RECEIPT_INVALID");
  if (receipt.archiveFilename !== `PERL-${receipt.artifactId}.tar.gz` || receipt.manifestFilename !== "manifest.json" || receipt.configurationFilename !== "configuration.json" || receipt.sbomFilename !== "sbom.cdx.json" || receipt.provenanceFilename !== `PERL-${receipt.artifactId}.provenance.json` || receipt.signingRequestFilename !== `PERL-${receipt.artifactId}.signing-request.json`) fail("Release receipt filenames are invalid.", 500, "RELEASE_RECEIPT_INVALID");
  for (const field of ["archiveSha256", "manifestSha256", "configurationSha256", "sbomSha256", "provenanceSha256", "signingRequestSha256", "sourceDigest"]) if (!/^[a-f0-9]{64}$/.test(receipt[field] || "")) fail(`Release receipt ${field} is invalid.`, 500, "RELEASE_RECEIPT_INVALID");
  if (!Number.isInteger(receipt.archiveBytes) || receipt.archiveBytes < 64 || receipt.archiveBytes > MAX_ARCHIVE_BYTES || !Number.isInteger(receipt.sourceBytes) || receipt.sourceBytes < 1 || receipt.sourceBytes > MAX_SOURCE_BYTES || !Number.isInteger(receipt.sourceFileCount) || receipt.sourceFileCount < 20 || receipt.sourceFileCount > MAX_FILES) fail("Release receipt size summary is invalid.", 500, "RELEASE_RECEIPT_INVALID");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(receipt.actor || "") || !Number.isFinite(Date.parse(receipt.createdAt))) fail("Release receipt actor or creation time is invalid.", 500, "RELEASE_RECEIPT_INVALID");
  if (receipt.immutableFiles !== true || receipt.runtimeStateIncluded !== false || receipt.phiIncluded !== false || receipt.credentialsIncluded !== false || receipt.productionSignatureVerified !== false || receipt.azureDeploymentPerformed !== false || receipt.clinicalReleaseAuthorized !== false || receipt.patientUseAuthorized !== false) fail("Release receipt authority boundary is invalid.", 500, "RELEASE_RECEIPT_INVALID");
}

export function validateReleaseTrustPolicy(policy, clock = () => new Date()) {
  const errors = [];
  const keys = ["algorithm", "contractVersion", "expiresAt", "issuedAt", "keyId", "maxSignatureAgeSeconds", "policyId", "publicKeyPem", "signerRole", "status"];
  if (!exactObject(policy, keys)) return ["Release-trust policy must contain the exact contract fields."];
  if (policy.contractVersion !== RELEASE_TRUST_POLICY_CONTRACT) errors.push("Release-trust policy contract is invalid.");
  if (policy.status !== "approved-for-release-verification") errors.push("Release-trust policy is not approved for verification.");
  if (!/^FF-RELEASE-POLICY-[A-Z0-9_-]{3,48}$/.test(policy.policyId || "")) errors.push("Release-trust policy ID is invalid.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(policy.keyId || "")) errors.push("Release-trust key ID is invalid.");
  if (policy.algorithm !== "Ed25519") errors.push("Release-trust policy must use Ed25519.");
  if (policy.signerRole !== "production-release-authority") errors.push("Release-trust signer role is invalid.");
  if (!Number.isInteger(policy.maxSignatureAgeSeconds) || policy.maxSignatureAgeSeconds < 300 || policy.maxSignatureAgeSeconds > 30 * 24 * 60 * 60) errors.push("Release signature age must be 300 seconds to 30 days.");
  const issued = Date.parse(policy.issuedAt);
  const expires = Date.parse(policy.expiresAt);
  const now = clock().getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued >= expires || now < issued || now > expires) errors.push("Release-trust policy is not current.");
  try {
    const key = createPublicKey(policy.publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") errors.push("Release-trust public key must be Ed25519.");
  } catch {
    errors.push("Release-trust public key is invalid.");
  }
  return [...new Set(errors)];
}

export function disabledReleaseTrustPolicy() {
  return Object.freeze({
    mode: "disabled",
    policyCurrent: false,
    trustedKeyCount: 0,
    signerRole: "production-release-authority",
    privateKeyAccepted: false,
    productionSignatureVerified: false,
    boundary: "No external release-verification policy is configured."
  });
}

function policyStatus(policy, clock) {
  if (!policy) return disabledReleaseTrustPolicy();
  const errors = validateReleaseTrustPolicy(policy, clock);
  if (errors.length) fail(errors.join(" "), 500, "RELEASE_TRUST_POLICY_INVALID");
  const key = createPublicKey(policy.publicKeyPem);
  const fingerprint = sha256(key.export({ type: "spki", format: "der" }));
  return {
    mode: "external-ed25519",
    policyCurrent: true,
    trustedKeyCount: 1,
    signerRole: policy.signerRole,
    keyFingerprint: fingerprint,
    policyFingerprint: sha256(canonicalJson(policy)),
    privateKeyAccepted: false,
    productionSignatureVerified: false,
    boundary: "PERL verifies one externally produced, time-bounded Ed25519 artifact-integrity signature. It never receives the private key or turns that signature into deployment or clinical authority."
  };
}

export function verifyReleaseSignature(envelope, policy, expected, clock = () => new Date()) {
  const policyErrors = validateReleaseTrustPolicy(policy, clock);
  if (policyErrors.length) fail(policyErrors.join(" "), 403, "RELEASE_TRUST_POLICY_INVALID");
  const keys = ["archiveSha256", "artifactId", "artifactIntegrityAttested", "clinicalReleaseAuthorized", "deploymentAuthorized", "expiresAt", "keyId", "manifestSha256", "patientUseAuthorized", "provenanceSha256", "purpose", "sbomSha256", "signature", "signatureContractVersion", "signedAt", "trafficActivationAuthorized"];
  if (!exactObject(envelope, keys)) fail("Release signature envelope must contain the exact contract fields.", 400, "RELEASE_SIGNATURE_INVALID");
  if (envelope.signatureContractVersion !== RELEASE_SIGNATURE_CONTRACT || envelope.purpose !== "verify-exact-release-candidate") fail("Release signature purpose or contract is invalid.", 400, "RELEASE_SIGNATURE_INVALID");
  if (envelope.keyId !== policy.keyId || envelope.artifactId !== expected.artifactId) fail("Release signature identity does not match the trust policy or candidate.", 409, "RELEASE_SIGNATURE_MISMATCH");
  for (const field of ["archiveSha256", "manifestSha256", "provenanceSha256", "sbomSha256"]) {
    if (!/^[a-f0-9]{64}$/.test(envelope[field] || "") || envelope[field] !== expected[field]) fail(`Release signature ${field} does not match the candidate.`, 409, "RELEASE_SIGNATURE_MISMATCH");
  }
  if (envelope.artifactIntegrityAttested !== true || envelope.deploymentAuthorized !== false || envelope.clinicalReleaseAuthorized !== false || envelope.trafficActivationAuthorized !== false || envelope.patientUseAuthorized !== false) fail("Release signature authority claims are invalid.", 400, "RELEASE_SIGNATURE_INVALID");
  const signedAt = Date.parse(envelope.signedAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  const now = clock().getTime();
  if (!Number.isFinite(signedAt) || !Number.isFinite(expiresAt) || signedAt > now || expiresAt < now || signedAt >= expiresAt || expiresAt - signedAt > policy.maxSignatureAgeSeconds * 1000 || signedAt < Date.parse(policy.issuedAt) || expiresAt > Date.parse(policy.expiresAt)) fail("Release signature time window is invalid.", 409, "RELEASE_SIGNATURE_EXPIRED");
  if (!/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature || "")) fail("Release signature encoding is invalid.", 400, "RELEASE_SIGNATURE_INVALID");
  const signature = Buffer.from(envelope.signature, "base64");
  if (signature.length !== 64) fail("Release signature must be a 64-byte Ed25519 signature.", 400, "RELEASE_SIGNATURE_INVALID");
  const { signature: _signature, ...payload } = envelope;
  if (!verifySignature(null, Buffer.from(canonicalJson(payload)), createPublicKey(policy.publicKeyPem), signature)) fail("Release signature verification failed.", 409, "RELEASE_SIGNATURE_INVALID");
  return {
    contractVersion: RELEASE_SIGNATURE_CONTRACT,
    status: "verified-external-signature",
    artifactId: envelope.artifactId,
    archiveSha256: envelope.archiveSha256,
    keyId: envelope.keyId,
    signerRole: policy.signerRole,
    signedAt: envelope.signedAt,
    expiresAt: envelope.expiresAt,
    artifactIntegrityAttested: true,
    deploymentAuthorized: false,
    clinicalReleaseAuthorized: false,
    trafficActivationAuthorized: false,
    patientUseAuthorized: false,
    privateKeyReceived: false
  };
}

async function atomicImmutableWrite(path, bytes) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
  await rename(temporary, path);
  await chmod(path, 0o400);
}

function candidateSummary(receipt, signature = null) {
  return {
    artifactId: receipt.artifactId,
    status: signature ? "verified-external-signature" : "verified-release-candidate",
    archiveFilename: receipt.archiveFilename,
    archiveSha256: receipt.archiveSha256,
    manifestSha256: receipt.manifestSha256,
    provenanceSha256: receipt.provenanceSha256,
    sbomSha256: receipt.sbomSha256,
    sourceDigest: receipt.sourceDigest,
    sourceFileCount: receipt.sourceFileCount,
    sourceBytes: receipt.sourceBytes,
    archiveBytes: receipt.archiveBytes,
    createdAt: receipt.createdAt,
    signature: signature ? {
      status: signature.status,
      keyId: signature.keyId,
      signerRole: signature.signerRole,
      signedAt: signature.signedAt,
      expiresAt: signature.expiresAt,
      privateKeyReceived: false
    } : null,
    downloads: {
      archive: `/api/operations/release/candidates/${receipt.artifactId}/archive`,
      manifest: `/api/operations/release/candidates/${receipt.artifactId}/manifest.json`,
      configuration: `/api/operations/release/candidates/${receipt.artifactId}/configuration.json`,
      sbom: `/api/operations/release/candidates/${receipt.artifactId}/sbom.cdx.json`,
      provenance: `/api/operations/release/candidates/${receipt.artifactId}/provenance.json`,
      signingRequest: `/api/operations/release/candidates/${receipt.artifactId}/signing-request.json`
    },
    productionSignatureVerified: Boolean(signature),
    deployableCandidateAvailable: true,
    azureDeploymentPerformed: false,
    clinicalValidation: false,
    clinicalReleaseAuthorized: false,
    trafficActivationAuthorized: false,
    patientUseAuthorized: false
  };
}

export class ReleaseCandidateRepository {
  constructor({ sourceRoot, repositoryRoot, trustPolicy, clock = () => new Date() }) {
    this.sourceRoot = resolve(sourceRoot);
    this.repositoryRoot = resolve(repositoryRoot);
    this.trustPolicy = trustPolicy;
    this.clock = clock;
    this.buildInFlight = null;
    if (trustPolicy) {
      const errors = validateReleaseTrustPolicy(trustPolicy, clock);
      if (errors.length) fail(errors.join(" "), 500, "RELEASE_TRUST_POLICY_INVALID");
    }
  }

  async ensureRepository() {
    await mkdir(this.repositoryRoot, { recursive: true, mode: 0o700 });
    await chmod(this.repositoryRoot, 0o700);
  }

  candidateDirectory(artifactId) {
    if (!/^perl-rc-[a-f0-9]{20}$/.test(artifactId || "")) fail("Release candidate ID is invalid.", 400, "RELEASE_CANDIDATE_ID_INVALID");
    return join(this.repositoryRoot, artifactId);
  }

  async readCandidate(artifactId) {
    const directory = this.candidateDirectory(artifactId);
    let receipt;
    try {
      receipt = JSON.parse(await readFile(join(directory, "receipt.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") fail("Release candidate was not found.", 404, "RELEASE_CANDIDATE_NOT_FOUND");
      fail("Release candidate receipt is unreadable or invalid.", 500, "RELEASE_RECEIPT_INVALID");
    }
    validateReceipt(receipt);
    if (receipt.artifactId !== artifactId) fail("Release receipt does not match its content-addressed directory.", 500, "RELEASE_RECEIPT_INVALID");
    const archiveBytes = await readFile(join(directory, receipt.archiveFilename));
    const verification = verifyReleaseArchive(archiveBytes, receipt.archiveSha256);
    if (archiveBytes.length !== receipt.archiveBytes || verification.artifactId !== artifactId || verification.manifestSha256 !== receipt.manifestSha256 || verification.configurationSha256 !== receipt.configurationSha256 || verification.sbomSha256 !== receipt.sbomSha256 || verification.sourceDigest !== receipt.sourceDigest || verification.sourceFileCount !== receipt.sourceFileCount || verification.sourceBytes !== receipt.sourceBytes) fail("Release receipt does not match the verified archive.", 500, "RELEASE_RECEIPT_INVALID");
    const [manifestBytes, configurationBytes, sbomBytes, provenanceBytes, signingRequestBytes] = await Promise.all([
      readFile(join(directory, receipt.manifestFilename)),
      readFile(join(directory, receipt.configurationFilename)),
      readFile(join(directory, receipt.sbomFilename)),
      readFile(join(directory, receipt.provenanceFilename)),
      readFile(join(directory, receipt.signingRequestFilename))
    ]);
    if (sha256(manifestBytes) !== receipt.manifestSha256 || sha256(configurationBytes) !== receipt.configurationSha256 || sha256(sbomBytes) !== receipt.sbomSha256 || sha256(provenanceBytes) !== receipt.provenanceSha256 || sha256(signingRequestBytes) !== receipt.signingRequestSha256) fail("Release sidecar integrity failed.", 500, "RELEASE_SIDECAR_INVALID");
    let manifest;
    let provenance;
    let signingRequest;
    try {
      manifest = JSON.parse(manifestBytes.toString("utf8"));
      provenance = JSON.parse(provenanceBytes.toString("utf8"));
      signingRequest = JSON.parse(signingRequestBytes.toString("utf8"));
    } catch {
      fail("Release sidecar metadata is invalid JSON.", 500, "RELEASE_SIDECAR_INVALID");
    }
    const expectedProvenance = buildProvenance(manifest, receipt.archiveSha256);
    const expectedSigningRequest = buildSigningRequest(manifest, receipt.archiveSha256, receipt.provenanceSha256);
    if (!provenanceBytes.equals(jsonBytes(expectedProvenance)) || !signingRequestBytes.equals(jsonBytes(expectedSigningRequest)) || canonicalJson(provenance) !== canonicalJson(expectedProvenance) || canonicalJson(signingRequest) !== canonicalJson(expectedSigningRequest)) fail("Release provenance or signing request is not bound to the verified archive.", 500, "RELEASE_SIDECAR_INVALID");
    let signature = null;
    try {
      const envelope = JSON.parse(await readFile(join(directory, "verified-signature.json"), "utf8"));
      if (this.trustPolicy) {
        try {
          signature = verifyReleaseSignature(envelope, this.trustPolicy, {
            artifactId,
            archiveSha256: receipt.archiveSha256,
            manifestSha256: receipt.manifestSha256,
            provenanceSha256: receipt.provenanceSha256,
            sbomSha256: receipt.sbomSha256
          }, this.clock);
        } catch (error) {
          if (error.code !== "RELEASE_SIGNATURE_EXPIRED") throw error;
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return { directory, receipt, archiveBytes, verification, signature };
  }

  async listCandidateIds() {
    try {
      const entries = await readdir(this.repositoryRoot, { withFileTypes: true });
      return entries.filter(entry => entry.isDirectory() && /^perl-rc-[a-f0-9]{20}$/.test(entry.name)).map(entry => entry.name);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async status() {
    const ids = await this.listCandidateIds();
    const candidates = [];
    let corruptCount = 0;
    for (const id of ids) {
      try {
        const candidate = await this.readCandidate(id);
        candidates.push(candidateSummary(candidate.receipt, candidate.signature));
      } catch {
        corruptCount += 1;
      }
    }
    candidates.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.artifactId.localeCompare(b.artifactId));
    const latest = candidates[0] || null;
    return {
      contractVersion: RELEASE_CANDIDATE_CONTRACT,
      status: corruptCount ? "repository-integrity-failed" : latest?.status || "not-built",
      repositoryMode: "local-content-addressed",
      candidateCount: candidates.length,
      corruptCandidateCount: corruptCount,
      latest,
      trust: policyStatus(this.trustPolicy, this.clock),
      deployableCandidateAvailable: Boolean(latest),
      productionSignatureVerified: latest?.productionSignatureVerified === true,
      runtimeStateIncluded: false,
      phiIncluded: false,
      credentialsIncluded: false,
      privateKeysAccepted: false,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false,
      boundary: RELEASE_BOUNDARY
    };
  }

  async build(actor = "LOCAL-RELEASE-BUILDER") {
    if (this.buildInFlight) return this.buildInFlight;
    this.buildInFlight = this.buildOnce(actor).finally(() => { this.buildInFlight = null; });
    return this.buildInFlight;
  }

  async buildOnce(actor) {
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(actor || "")) fail("Release builder code is invalid.");
    await this.ensureRepository();
    const candidate = await buildReleaseCandidate(this.sourceRoot);
    const directory = this.candidateDirectory(candidate.artifactId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const receiptPath = join(directory, "receipt.json");
    try {
      const existing = await this.readCandidate(candidate.artifactId);
      if (existing.receipt.archiveSha256 !== candidate.archiveSha256) fail("Existing content-addressed release candidate conflicts with the current build.", 409, "RELEASE_CANDIDATE_CONFLICT");
      return { ...(await this.status()), candidate: candidateSummary(existing.receipt, existing.signature), idempotent: true };
    } catch (error) {
      if (error.code !== "RELEASE_CANDIDATE_NOT_FOUND") throw error;
    }
    const provenanceFilename = `PERL-${candidate.artifactId}.provenance.json`;
    const signingRequestFilename = `PERL-${candidate.artifactId}.signing-request.json`;
    const receipt = {
      contractVersion: RELEASE_CANDIDATE_CONTRACT,
      artifactId: candidate.artifactId,
      archiveFilename: candidate.archiveFilename,
      archiveSha256: candidate.archiveSha256,
      archiveBytes: candidate.archiveBytes.length,
      manifestFilename: "manifest.json",
      manifestSha256: sha256(candidate.manifestBytes),
      configurationFilename: "configuration.json",
      configurationSha256: sha256(candidate.configurationBytes),
      sbomFilename: "sbom.cdx.json",
      sbomSha256: sha256(candidate.sbomBytes),
      provenanceFilename,
      provenanceSha256: sha256(candidate.provenanceBytes),
      signingRequestFilename,
      signingRequestSha256: sha256(candidate.signingRequestBytes),
      sourceDigest: candidate.manifest.source.digest,
      sourceFileCount: candidate.manifest.source.fileCount,
      sourceBytes: candidate.manifest.source.totalBytes,
      actor,
      createdAt: this.clock().toISOString(),
      immutableFiles: true,
      runtimeStateIncluded: false,
      phiIncluded: false,
      credentialsIncluded: false,
      productionSignatureVerified: false,
      azureDeploymentPerformed: false,
      clinicalReleaseAuthorized: false,
      patientUseAuthorized: false
    };
    await atomicImmutableWrite(join(directory, candidate.archiveFilename), candidate.archiveBytes);
    await atomicImmutableWrite(join(directory, "manifest.json"), candidate.manifestBytes);
    await atomicImmutableWrite(join(directory, "configuration.json"), candidate.configurationBytes);
    await atomicImmutableWrite(join(directory, "sbom.cdx.json"), candidate.sbomBytes);
    await atomicImmutableWrite(join(directory, provenanceFilename), candidate.provenanceBytes);
    await atomicImmutableWrite(join(directory, signingRequestFilename), candidate.signingRequestBytes);
    await atomicImmutableWrite(receiptPath, jsonBytes(receipt));
    const verification = verifyReleaseArchive(await readFile(join(directory, candidate.archiveFilename)), candidate.archiveSha256);
    if (verification.status !== "verified-release-candidate") fail("Written release candidate did not verify.", 500, "RELEASE_WRITE_VERIFICATION_FAILED");
    return { ...(await this.status()), candidate: candidateSummary(receipt), idempotent: false };
  }

  async download(artifactId, kind) {
    const candidate = await this.readCandidate(artifactId);
    const map = {
      archive: { filename: candidate.receipt.archiveFilename, mediaType: "application/gzip" },
      manifest: { filename: candidate.receipt.manifestFilename, mediaType: "application/json" },
      configuration: { filename: candidate.receipt.configurationFilename, mediaType: "application/json" },
      sbom: { filename: candidate.receipt.sbomFilename, mediaType: "application/vnd.cyclonedx+json" },
      provenance: { filename: candidate.receipt.provenanceFilename, mediaType: "application/json" },
      signingRequest: { filename: candidate.receipt.signingRequestFilename, mediaType: "application/json" }
    };
    if (!map[kind]) fail("Release candidate artifact type is invalid.", 400, "RELEASE_ARTIFACT_KIND_INVALID");
    const descriptor = map[kind];
    const bytes = await readFile(join(candidate.directory, descriptor.filename));
    return { ...descriptor, bytes };
  }

  async verifyAndStoreSignature(envelope) {
    if (!this.trustPolicy) fail("Release signature verification is disabled until an owner-only startup policy is configured.", 409, "RELEASE_TRUST_DISABLED");
    const candidate = await this.readCandidate(envelope?.artifactId);
    const expected = {
      artifactId: candidate.receipt.artifactId,
      archiveSha256: candidate.receipt.archiveSha256,
      manifestSha256: candidate.receipt.manifestSha256,
      provenanceSha256: candidate.receipt.provenanceSha256,
      sbomSha256: candidate.receipt.sbomSha256
    };
    const verified = verifyReleaseSignature(envelope, this.trustPolicy, expected, this.clock);
    const path = join(candidate.directory, "verified-signature.json");
    try {
      const existing = JSON.parse(await readFile(path, "utf8"));
      verifyReleaseSignature(existing, this.trustPolicy, expected, this.clock);
      if (canonicalJson(existing) !== canonicalJson(envelope)) fail("A different verified signature is already pinned to this candidate.", 409, "RELEASE_SIGNATURE_CONFLICT");
    } catch (error) {
      if (error.code === "ENOENT") await atomicImmutableWrite(path, jsonBytes(envelope));
      else throw error;
    }
    return { ...(await this.status()), signature: verified };
  }
}

export function releaseTrustPolicyTemplate() {
  return {
    contractVersion: RELEASE_TRUST_POLICY_CONTRACT,
    status: "approved-for-release-verification",
    policyId: "FF-RELEASE-POLICY-REPLACE-ME",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    signerRole: "production-release-authority",
    keyId: "replace-with-release-key-id",
    algorithm: "Ed25519",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_ED25519_PUBLIC_KEY\n-----END PUBLIC KEY-----\n",
    maxSignatureAgeSeconds: 604800
  };
}
