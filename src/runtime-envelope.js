import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

export const RUNTIME_ENVELOPE_CONTRACT = "perl-runtime-envelope/1.0";
export const RUNTIME_ENVELOPE_POLICY_CONTRACT = "perl-runtime-envelope-policy/1.0";
export const RUNTIME_ENVELOPE_BOUNDARY = "This envelope makes PERL's synthetic runtime explicit, probeable, non-root, drainable, and compatible with a read-only container root plus one writable data mount. A verified policy does not prove that a Linux image was built, scanned, signed, published, deployed to Azure, connected to e-QPASS, approved for PHI, clinically validated, released for clinical use, activated for traffic, or permitted to process patient records.";

const POLICY_ID = /^FF-RUNTIME-POLICY-[A-Z0-9_-]{3,48}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const SAFE_HOSTS = new Set(["0.0.0.0", "::"]);

function fail(message, status = 500, code = "RUNTIME_ENVELOPE_INVALID") {
  throw Object.assign(new Error(message), { status, code });
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
}

function canonical(value) {
  return JSON.stringify(ordered(value));
}

function digest(value) {
  return createHash("sha256").update(Buffer.isBuffer(value) ? value : String(value)).digest("hex");
}

function safeAbsoluteDirectory(value) {
  if (typeof value !== "string" || value.length < 2 || value.length > 240 || !isAbsolute(value) || value.includes("\0")) return false;
  const normalized = resolve(value);
  return normalized === value && normalized !== "/" && !["/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root", "/run", "/sbin", "/sys", "/usr"].includes(normalized);
}

export function validateRuntimeEnvelopePolicy(policy, clock = () => new Date()) {
  const errors = [];
  const keys = ["bindHost", "contractVersion", "dataDirectory", "environment", "expiresAt", "gracefulShutdownSeconds", "issuedAt", "livenessPath", "policyId", "port", "publicBaseUrl", "readOnlyRootFilesystemRequired", "readinessPath", "runAsNonRootRequired", "secretsMountReadOnly", "stateMountReadWrite", "status", "tlsTerminatedUpstream", "version"];
  if (!exactObject(policy, keys)) return ["Runtime-envelope policy must contain the exact contract fields."];
  if (policy.contractVersion !== RUNTIME_ENVELOPE_POLICY_CONTRACT) errors.push("Runtime-envelope policy contract is invalid.");
  if (policy.status !== "approved-for-synthetic-container-rehearsal") errors.push("Runtime-envelope policy is not approved for the synthetic container rehearsal.");
  if (!POLICY_ID.test(policy.policyId || "") || !SEMVER.test(policy.version || "") || policy.version === "0.0.0") errors.push("Runtime-envelope policy identity or version is invalid.");
  const issuedAt = Date.parse(policy.issuedAt);
  const expiresAt = Date.parse(policy.expiresAt);
  const now = clock().getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt >= expiresAt || now < issuedAt || now > expiresAt) errors.push("Runtime-envelope policy is not current.");
  if (!SAFE_HOSTS.has(policy.bindHost)) errors.push("Controlled container mode must bind to 0.0.0.0 or ::.");
  if (policy.port !== 4173) errors.push("Controlled container mode must use the fixed internal port 4173.");
  try {
    const url = new URL(policy.publicBaseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.pathname !== "/") errors.push("Runtime-envelope public base URL must be an HTTPS origin without credentials, path, query, or fragment.");
  } catch {
    errors.push("Runtime-envelope public base URL is invalid.");
  }
  if (!safeAbsoluteDirectory(policy.dataDirectory)) errors.push("Runtime-envelope data directory must be a bounded absolute non-system path.");
  if (policy.environment !== "synthetic-sandbox" || policy.tlsTerminatedUpstream !== true || policy.runAsNonRootRequired !== true || policy.readOnlyRootFilesystemRequired !== true || policy.stateMountReadWrite !== true || policy.secretsMountReadOnly !== true) errors.push("Runtime-envelope isolation requirements are invalid.");
  if (!Number.isInteger(policy.gracefulShutdownSeconds) || policy.gracefulShutdownSeconds < 5 || policy.gracefulShutdownSeconds > 60) errors.push("Runtime-envelope graceful shutdown must be between 5 and 60 seconds.");
  if (policy.livenessPath !== "/api/live" || policy.readinessPath !== "/api/ready") errors.push("Runtime-envelope probe paths are invalid.");
  return [...new Set(errors)];
}

export async function loadRuntimeEnvelopePolicyFile(filePath, clock = () => new Date()) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch {
    fail("PERL runtime-envelope policy could not be read.", 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail("PERL runtime-envelope policy must be a regular non-symlink file.", 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  if ((metadata.mode & 0o077) !== 0) fail("PERL runtime-envelope policy must be owner-only (mode 0600 or stricter).", 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  if (metadata.size < 2 || metadata.size > 256 * 1024) fail("PERL runtime-envelope policy must be between 2 bytes and 256 KB.", 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  let policy;
  try {
    policy = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    fail("PERL runtime-envelope policy must be valid JSON.", 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  }
  const errors = validateRuntimeEnvelopePolicy(policy, clock);
  if (errors.length) fail(errors.join(" "), 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
  return policy;
}

function localDescriptor({ dataDirectory, port = 4173, host = "127.0.0.1" }) {
  return {
    mode: "local-synthetic-loopback",
    policy: null,
    policyFingerprint: null,
    bindHost: host,
    port,
    publicBaseUrlFingerprint: null,
    dataDirectory: resolve(dataDirectory),
    gracefulShutdownSeconds: 10,
    tlsTerminatedUpstream: false,
    runAsNonRootRequired: false,
    readOnlyRootFilesystemRequired: false,
    stateMountReadWrite: true,
    secretsMountReadOnly: false
  };
}

function controlledDescriptor(policy) {
  return {
    mode: "policy-controlled-synthetic-container",
    policy,
    policyFingerprint: digest(canonical(policy)),
    bindHost: policy.bindHost,
    port: policy.port,
    publicBaseUrlFingerprint: digest(policy.publicBaseUrl),
    dataDirectory: policy.dataDirectory,
    gracefulShutdownSeconds: policy.gracefulShutdownSeconds,
    tlsTerminatedUpstream: true,
    runAsNonRootRequired: true,
    readOnlyRootFilesystemRequired: true,
    stateMountReadWrite: true,
    secretsMountReadOnly: true
  };
}

export class RuntimeEnvelope {
  constructor({ policy, dataDirectory, port = 4173, host = "127.0.0.1", clock = () => new Date(), processUid = typeof process.getuid === "function" ? process.getuid() : null } = {}) {
    if (policy) {
      const errors = validateRuntimeEnvelopePolicy(policy, clock);
      if (errors.length) fail(errors.join(" "), 500, "RUNTIME_ENVELOPE_POLICY_INVALID");
    }
    this.clock = clock;
    this.processUid = processUid;
    this.descriptor = policy ? controlledDescriptor(policy) : localDescriptor({ dataDirectory, port, host });
    if (!safeAbsoluteDirectory(this.descriptor.dataDirectory)) fail("Runtime data directory is unsafe.", 500, "RUNTIME_DATA_DIRECTORY_INVALID");
    if (policy && (!Number.isInteger(processUid) || processUid === 0)) fail("Controlled container mode requires a known non-root process identity.", 500, "RUNTIME_PROCESS_IDENTITY_INVALID");
    this.startedAt = clock().toISOString();
    this.dataMountPrepared = false;
    this.applicationInitialized = false;
    this.listening = false;
    this.shutdownRequested = false;
    this.shutdownSignal = null;
    this.shutdownStartedAt = null;
  }

  get host() { return this.descriptor.bindHost; }
  get port() { return this.descriptor.port; }
  get dataDirectory() { return this.descriptor.dataDirectory; }
  get storePath() { return join(this.dataDirectory, "sandbox-state.json"); }
  get releaseRepositoryRoot() { return join(this.dataDirectory, "releases"); }
  get admissionRepositoryRoot() { return join(this.dataDirectory, "release-admissions"); }
  get promotionRepositoryRoot() { return join(this.dataDirectory, "release-promotions"); }

  async prepare() {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    const metadata = await lstat(this.dataDirectory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail("Runtime data mount must be a regular directory, not a symbolic link.", 500, "RUNTIME_DATA_DIRECTORY_INVALID");
    await chmod(this.dataDirectory, 0o700);
    const probe = join(this.dataDirectory, `.perl-write-probe-${randomUUID()}`);
    try {
      await writeFile(probe, "runtime-mount-probe\n", { flag: "wx", mode: 0o600 });
      const probeMetadata = await stat(probe);
      if (!probeMetadata.isFile() || (probeMetadata.mode & 0o077) !== 0) fail("Runtime data mount did not preserve owner-only file permissions.", 500, "RUNTIME_DATA_DIRECTORY_INVALID");
    } finally {
      await unlink(probe).catch(() => {});
    }
    this.dataMountPrepared = true;
    return this;
  }

  markInitialized() { this.applicationInitialized = true; }
  markListening() { this.listening = true; }
  beginShutdown(signal = "SIGTERM") {
    if (this.shutdownRequested) return false;
    this.shutdownRequested = true;
    this.shutdownSignal = signal;
    this.shutdownStartedAt = this.clock().toISOString();
    return true;
  }

  liveness() {
    return {
      ok: true,
      contractVersion: RUNTIME_ENVELOPE_CONTRACT,
      status: this.shutdownRequested ? "draining" : "live",
      processAlive: true,
      shutdownRequested: this.shutdownRequested,
      startedAt: this.startedAt,
      clinicalValidation: false,
      patientUseAuthorized: false
    };
  }

  readiness({ repositoryIntegrity = true } = {}) {
    const checks = [
      { id: "runtime-policy", status: this.descriptor.mode === "policy-controlled-synthetic-container" ? "passed" : "local-only", evidence: { mode: this.descriptor.mode, policyCurrent: Boolean(this.descriptor.policy) } },
      { id: "process-identity", status: !this.descriptor.runAsNonRootRequired || Number.isInteger(this.processUid) && this.processUid !== 0 ? "passed" : "failed", evidence: { uidKnown: Number.isInteger(this.processUid), runningAsRoot: this.processUid === 0, nonRootRequired: this.descriptor.runAsNonRootRequired } },
      { id: "data-mount", status: this.dataMountPrepared ? "passed" : "failed", evidence: { ownerOnly: this.dataMountPrepared, writeProbePassed: this.dataMountPrepared } },
      { id: "application-state", status: this.applicationInitialized ? "passed" : "failed", evidence: { initialized: this.applicationInitialized } },
      { id: "repository-integrity", status: repositoryIntegrity ? "passed" : "failed", evidence: { candidateAdmissionPromotionReadable: repositoryIntegrity } },
      { id: "shutdown-drain", status: this.shutdownRequested ? "failed" : "passed", evidence: { shutdownRequested: this.shutdownRequested } }
    ];
    const ready = this.listening && checks.every(check => ["passed", "local-only"].includes(check.status));
    return {
      ok: ready,
      contractVersion: RUNTIME_ENVELOPE_CONTRACT,
      status: ready ? "ready" : this.shutdownRequested ? "draining" : "not-ready",
      checks,
      authority: {
        containerImageBuilt: false,
        externalVulnerabilityReviewCompleted: false,
        externalLicenseApprovalCompleted: false,
        azureDeploymentPerformed: false,
        clinicalValidation: false,
        clinicalReleaseAuthorized: false,
        trafficActivationAuthorized: false,
        patientUseAuthorized: false
      },
      boundary: RUNTIME_ENVELOPE_BOUNDARY
    };
  }

  publicStatus() {
    return {
      contractVersion: RUNTIME_ENVELOPE_CONTRACT,
      mode: this.descriptor.mode,
      status: this.shutdownRequested ? "draining" : this.listening && this.applicationInitialized && this.dataMountPrepared ? "ready" : "initializing",
      policyConfigured: Boolean(this.descriptor.policy),
      policyFingerprint: this.descriptor.policyFingerprint,
      bindScope: SAFE_HOSTS.has(this.host) ? "container-all-interfaces" : "loopback-only",
      internalPort: this.port,
      publicBaseUrlFingerprint: this.descriptor.publicBaseUrlFingerprint,
      dataDirectoryFingerprint: digest(this.dataDirectory),
      dataMountPrepared: this.dataMountPrepared,
      applicationInitialized: this.applicationInitialized,
      listening: this.listening,
      processUidKnown: Number.isInteger(this.processUid),
      runningAsRoot: this.processUid === 0,
      tlsTerminatedUpstream: this.descriptor.tlsTerminatedUpstream,
      runAsNonRootRequired: this.descriptor.runAsNonRootRequired,
      readOnlyRootFilesystemRequired: this.descriptor.readOnlyRootFilesystemRequired,
      readOnlyRootFilesystemObserved: false,
      stateMountReadWrite: this.descriptor.stateMountReadWrite,
      secretsMountReadOnly: this.descriptor.secretsMountReadOnly,
      gracefulShutdownSeconds: this.descriptor.gracefulShutdownSeconds,
      shutdownRequested: this.shutdownRequested,
      shutdownSignal: this.shutdownSignal,
      startedAt: this.startedAt,
      containerImageBuilt: false,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      patientUseAuthorized: false,
      boundary: RUNTIME_ENVELOPE_BOUNDARY
    };
  }
}

export async function createRuntimeEnvelope(options = {}) {
  const envelope = new RuntimeEnvelope(options);
  await envelope.prepare();
  return envelope;
}

export function runtimeEnvelopePolicyTemplate() {
  return {
    contractVersion: RUNTIME_ENVELOPE_POLICY_CONTRACT,
    status: "approved-for-synthetic-container-rehearsal",
    policyId: "FF-RUNTIME-POLICY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    environment: "synthetic-sandbox",
    bindHost: "0.0.0.0",
    port: 4173,
    publicBaseUrl: "https://perl.example.invalid/",
    dataDirectory: "/var/lib/perl",
    tlsTerminatedUpstream: true,
    runAsNonRootRequired: true,
    readOnlyRootFilesystemRequired: true,
    stateMountReadWrite: true,
    secretsMountReadOnly: true,
    gracefulShutdownSeconds: 30,
    livenessPath: "/api/live",
    readinessPath: "/api/ready"
  };
}

export function validateContainerBuildAssets({ containerfile, healthcheck }) {
  const errors = [];
  const source = String(containerfile || "");
  const health = String(healthcheck || "");
  const required = [
    [/^ARG PERL_NODE_IMAGE\s*$/m, "Containerfile must require an externally supplied base-image reference."],
    [/^FROM \$\{PERL_NODE_IMAGE\}\s*$/m, "Containerfile must build from the supplied base-image reference."],
    [/^COPY --chown=10001:10001 \. \.\s*$/m, "Containerfile must copy the verified archive as the non-root runtime identity."],
    [/^USER 10001:10001\s*$/m, "Containerfile must run as UID/GID 10001."],
    [/PERL_REQUIRE_RUNTIME_POLICY=true/, "Containerfile must require the runtime policy."],
    [/PERL_RUNTIME_POLICY_FILE=\/run\/perl\/runtime-policy\.json/, "Containerfile must use the read-only policy mount path."],
    [/^HEALTHCHECK .*CMD \["node", "tools\/runtime-healthcheck\.mjs"\]\s*$/m, "Containerfile must use the bounded liveness probe."],
    [/^CMD \["node", "server\.mjs"\]\s*$/m, "Containerfile must use the non-shell server command."]
  ];
  for (const [pattern, message] of required) if (!pattern.test(source)) errors.push(message);
  if (/^(?:RUN|ADD|ENTRYPOINT)\b/m.test(source) || /\b(?:apk|apt|curl|wget|npm\s+(?:install|ci))\b/i.test(source)) errors.push("Containerfile must not install packages, download content, add unbounded inputs, or use a shell entrypoint.");
  if (/^ARG PERL_NODE_IMAGE\s*=\s*\S+/m.test(source)) errors.push("Containerfile must not supply a mutable default base image.");
  if (!/method:\s*["']GET["']/.test(health) || !/path:\s*["']\/api\/live["']/.test(health) || !/127\.0\.0\.1/.test(health) || !/timeout/i.test(health) || /\/api\/ready/.test(health)) errors.push("Runtime healthcheck must query loopback liveness with a timeout and must not use readiness as liveness.");
  return [...new Set(errors)];
}
