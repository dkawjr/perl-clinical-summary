import { createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { chmod, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "./release-candidate.js";

export const RELEASE_PROMOTION_CONTRACT = "perl-release-promotion/1.0";
export const RELEASE_PROMOTION_REQUEST_CONTRACT = "perl-release-promotion-request/1.0";
export const RELEASE_PROMOTION_ATTESTATION_CONTRACT = "perl-release-promotion-attestation/1.0";
export const RELEASE_PROMOTION_TRUST_POLICY_CONTRACT = "perl-release-promotion-trust-policy/1.0";
export const RELEASE_PROMOTION_PURPOSE = "attest-external-production-artifact-promotion";
export const RELEASE_PROMOTION_BOUNDARY = "A promotion request binds PERL's exact locally qualified archive to the evidence an independently controlled pipeline must return. Only a current owner-provisioned Ed25519 policy can verify a returned external attestation. Verification establishes bounded production-artifact promotion evidence only; it does not deploy to Azure, authorize a deployment, validate clinical performance, grant clinical-release authority, activate traffic, or permit patient use.";

export const RELEASE_PROMOTION_GATES = Object.freeze([
  Object.freeze({ id: "isolated-ci", label: "Isolated CI execution", requiredEvidence: "Independently controlled runner, deny-by-default network policy, workload identity, and credential isolation." }),
  Object.freeze({ id: "exact-archive-retest", label: "Exact archive retest", requiredEvidence: "The candidate archive digest is reverified and its complete archived suite and frozen clinical invariants pass." }),
  Object.freeze({ id: "vulnerability-review", label: "External vulnerability review", requiredEvidence: "Scanner identity, database version and time, findings, exceptions, and an approved disposition are retained." }),
  Object.freeze({ id: "license-review", label: "External license review", requiredEvidence: "SBOM-bound license inventory, policy result, exceptions, and accountable approval are retained." }),
  Object.freeze({ id: "oci-image", label: "Locked OCI image", requiredEvidence: "A non-root, digest-addressed OCI image is built from the exact archive with runtime and base-image provenance." }),
  Object.freeze({ id: "immutable-registry", label: "Immutable registry publication", requiredEvidence: "The image digest resolves in an approved immutable Azure registry through workload identity." }),
  Object.freeze({ id: "artifact-signature", label: "Hardware-backed artifact signature", requiredEvidence: "The promoted digest is signed outside PERL with approved key custody, rotation, revocation, and transparency evidence." }),
  Object.freeze({ id: "schema-environment", label: "Schema and environment compatibility", requiredEvidence: "Environment configuration, schema compatibility, migration posture, and secrets references are version bound." }),
  Object.freeze({ id: "rollback-reconciliation", label: "Rollback and reconciliation", requiredEvidence: "Authorized last-known-good selection, staged rollback, and e-QPASS, report, queue, and audit reconciliation are verified." }),
  Object.freeze({ id: "telemetry-runbook", label: "Telemetry and operator runbook", requiredEvidence: "Release telemetry, alert ownership, escalation, and the jointly accepted production runbook are verified." })
]);

function fail(message, status = 400, code = "RELEASE_PROMOTION_INVALID") {
  throw Object.assign(new Error(message), { status, code });
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const artifactId = value => typeof value === "string" && /^perl-rc-[a-f0-9]{20}$/.test(value);
const admissionId = value => typeof value === "string" && /^perl-adm-[a-f0-9]{20}$/.test(value);
const requestId = value => typeof value === "string" && /^perl-prm-[a-f0-9]{20}$/.test(value);

function requestCore({ candidate, admission }) {
  const receipt = candidate.receipt;
  return {
    contractVersion: RELEASE_PROMOTION_REQUEST_CONTRACT,
    requestedAt: admission.qualifiedAt,
    artifact: {
      artifactId: receipt.artifactId,
      archiveSha256: receipt.archiveSha256,
      manifestSha256: receipt.manifestSha256,
      configurationSha256: receipt.configurationSha256,
      provenanceSha256: receipt.provenanceSha256,
      sbomSha256: receipt.sbomSha256,
      sourceDigest: receipt.sourceDigest
    },
    localAdmission: {
      admissionId: admission.admissionId,
      evidenceHash: admission.evidenceHash,
      policyVersion: admission.policyVersion,
      status: admission.status
    },
    target: {
      platform: "Microsoft Azure",
      artifactFormat: "OCI image",
      registryClass: "approved-immutable-registry",
      executionClass: "independently-controlled-network-isolated-ci",
      scope: "production-artifact-promotion-only"
    },
    gates: RELEASE_PROMOTION_GATES.map(gate => ({ ...gate, blocking: true })),
    returnContract: {
      contractVersion: RELEASE_PROMOTION_ATTESTATION_CONTRACT,
      purpose: RELEASE_PROMOTION_PURPOSE,
      algorithm: "Ed25519",
      signerRole: "production-promotion-attestation-authority",
      signatureEncoding: "base64",
      privateKeyAcceptedByPerl: false
    },
    authority: {
      localArchiveQualificationPassed: true,
      externalEvidenceVerified: false,
      productionArtifactPromoted: false,
      deploymentAuthorized: false,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false
    },
    boundary: RELEASE_PROMOTION_BOUNDARY
  };
}

export function buildReleasePromotionRequest({ candidate, admission }) {
  if (!candidate?.receipt || admission?.status !== "qualified-local" || admission?.authority?.localArchiveQualificationPassed !== true || admission.artifact?.artifactId !== candidate.receipt.artifactId) fail("The exact candidate must have a current qualified-local admission report before promotion handoff.", 409, "RELEASE_PROMOTION_ADMISSION_REQUIRED");
  const core = requestCore({ candidate, admission });
  const requestHash = sha256(canonicalJson(core));
  return Object.freeze({ requestId: `perl-prm-${requestHash.slice(0, 20)}`, requestHash, ...core });
}

export function validateReleasePromotionRequest(request) {
  const keys = ["requestId", "requestHash", "contractVersion", "requestedAt", "artifact", "localAdmission", "target", "gates", "returnContract", "authority", "boundary"];
  if (!exactObject(request, keys) || request.contractVersion !== RELEASE_PROMOTION_REQUEST_CONTRACT || !requestId(request.requestId) || !digest(request.requestHash)) fail("Release promotion request contract or identity is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  const { requestId: _requestId, requestHash: _requestHash, ...core } = request;
  if (sha256(canonicalJson(core)) !== request.requestHash || request.requestId !== `perl-prm-${request.requestHash.slice(0, 20)}`) fail("Release promotion request hash is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  if (!Number.isFinite(Date.parse(request.requestedAt))) fail("Release promotion request time is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  if (!exactObject(request.artifact, ["artifactId", "archiveSha256", "manifestSha256", "configurationSha256", "provenanceSha256", "sbomSha256", "sourceDigest"]) || !artifactId(request.artifact.artifactId) || Object.entries(request.artifact).some(([key, value]) => key !== "artifactId" && !digest(value))) fail("Release promotion artifact binding is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  if (!exactObject(request.localAdmission, ["admissionId", "evidenceHash", "policyVersion", "status"]) || !admissionId(request.localAdmission.admissionId) || !digest(request.localAdmission.evidenceHash) || request.localAdmission.policyVersion !== "perl-local-archive-qualification/1.0" || request.localAdmission.status !== "qualified-local") fail("Release promotion admission binding is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  if (!exactObject(request.target, ["platform", "artifactFormat", "registryClass", "executionClass", "scope"]) || request.target.platform !== "Microsoft Azure" || request.target.artifactFormat !== "OCI image" || request.target.registryClass !== "approved-immutable-registry" || request.target.executionClass !== "independently-controlled-network-isolated-ci" || request.target.scope !== "production-artifact-promotion-only") fail("Release promotion target is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  const expectedGates = RELEASE_PROMOTION_GATES;
  if (!Array.isArray(request.gates) || request.gates.length !== expectedGates.length || request.gates.some((gate, index) => !exactObject(gate, ["id", "label", "requiredEvidence", "blocking"]) || gate.id !== expectedGates[index].id || gate.label !== expectedGates[index].label || gate.requiredEvidence !== expectedGates[index].requiredEvidence || gate.blocking !== true)) fail("Release promotion gates are invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  if (!exactObject(request.returnContract, ["contractVersion", "purpose", "algorithm", "signerRole", "signatureEncoding", "privateKeyAcceptedByPerl"]) || request.returnContract.contractVersion !== RELEASE_PROMOTION_ATTESTATION_CONTRACT || request.returnContract.purpose !== RELEASE_PROMOTION_PURPOSE || request.returnContract.algorithm !== "Ed25519" || request.returnContract.signerRole !== "production-promotion-attestation-authority" || request.returnContract.signatureEncoding !== "base64" || request.returnContract.privateKeyAcceptedByPerl !== false) fail("Release promotion return contract is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  const authority = request.authority || {};
  if (!exactObject(authority, ["localArchiveQualificationPassed", "externalEvidenceVerified", "productionArtifactPromoted", "deploymentAuthorized", "azureDeploymentPerformed", "clinicalValidation", "clinicalReleaseAuthorized", "trafficActivationAuthorized", "patientUseAuthorized"]) || authority.localArchiveQualificationPassed !== true || Object.entries(authority).some(([key, value]) => key !== "localArchiveQualificationPassed" && value !== false) || request.boundary !== RELEASE_PROMOTION_BOUNDARY) fail("Release promotion authority boundary is invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
  return [];
}

export function releasePromotionAttestationTemplate(request) {
  validateReleasePromotionRequest(request);
  return {
    contractVersion: RELEASE_PROMOTION_ATTESTATION_CONTRACT,
    promotionRequestId: request.requestId,
    requestHash: request.requestHash,
    artifact: { ...request.artifact },
    localAdmission: { admissionId: request.localAdmission.admissionId, evidenceHash: request.localAdmission.evidenceHash },
    execution: {
      system: "REPLACE_WITH_CI_SYSTEM",
      runId: "REPLACE_WITH_RUN_ID",
      runUri: "https://REPLACE_WITH_EVIDENCE_URI",
      startedAt: null,
      completedAt: null,
      isolatedRunner: true,
      networkPolicy: "deny-by-default",
      credentialIsolation: true,
      workloadIdentity: true
    },
    image: {
      repository: "REPLACE_WITH_APPROVED_AZURE_REGISTRY_REPOSITORY",
      digest: "sha256:REPLACE_WITH_64_HEX_CHARACTERS",
      registryResourceId: "REPLACE_WITH_AZURE_RESOURCE_ID",
      immutable: true
    },
    gates: RELEASE_PROMOTION_GATES.map(gate => ({ id: gate.id, status: "passed", evidenceRef: "https://REPLACE_WITH_EVIDENCE_URI", evidenceSha256: "REPLACE_WITH_64_HEX_CHARACTERS" })),
    issuedAt: null,
    expiresAt: null,
    keyId: null,
    purpose: RELEASE_PROMOTION_PURPOSE,
    authority: {
      externalEvidenceVerified: true,
      productionArtifactPromoted: true,
      deploymentAuthorized: false,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false
    },
    signature: null
  };
}

export function validateReleasePromotionTrustPolicy(policy, clock = () => new Date()) {
  const errors = [];
  const keys = ["algorithm", "contractVersion", "expiresAt", "issuedAt", "keyId", "maxAttestationAgeSeconds", "policyId", "publicKeyPem", "signerRole", "status"];
  if (!exactObject(policy, keys)) return ["Release-promotion trust policy must contain the exact contract fields."];
  if (policy.contractVersion !== RELEASE_PROMOTION_TRUST_POLICY_CONTRACT) errors.push("Release-promotion trust policy contract is invalid.");
  if (policy.status !== "approved-for-promotion-verification") errors.push("Release-promotion trust policy is not approved for verification.");
  if (!/^FF-PROMOTION-POLICY-[A-Z0-9_-]{3,48}$/.test(policy.policyId || "")) errors.push("Release-promotion policy ID is invalid.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(policy.keyId || "")) errors.push("Release-promotion key ID is invalid.");
  if (policy.algorithm !== "Ed25519" || policy.signerRole !== "production-promotion-attestation-authority") errors.push("Release-promotion signer configuration is invalid.");
  if (!Number.isInteger(policy.maxAttestationAgeSeconds) || policy.maxAttestationAgeSeconds < 300 || policy.maxAttestationAgeSeconds > 30 * 24 * 60 * 60) errors.push("Release-promotion attestation age must be 300 seconds to 30 days.");
  const issued = Date.parse(policy.issuedAt);
  const expires = Date.parse(policy.expiresAt);
  const now = clock().getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued >= expires || now < issued || now > expires) errors.push("Release-promotion trust policy is not current.");
  try {
    if (createPublicKey(policy.publicKeyPem).asymmetricKeyType !== "ed25519") errors.push("Release-promotion public key must be Ed25519.");
  } catch {
    errors.push("Release-promotion public key is invalid.");
  }
  return [...new Set(errors)];
}

function trustStatus(policy, clock) {
  if (!policy) return { mode: "disabled", policyCurrent: false, trustedKeyCount: 0, signerRole: "production-promotion-attestation-authority", privateKeyAccepted: false, boundary: "No external production-promotion attestation policy is configured." };
  const errors = validateReleasePromotionTrustPolicy(policy, clock);
  if (errors.length) fail(errors.join(" "), 500, "RELEASE_PROMOTION_TRUST_POLICY_INVALID");
  const key = createPublicKey(policy.publicKeyPem);
  return {
    mode: "external-ed25519",
    policyCurrent: true,
    trustedKeyCount: 1,
    signerRole: policy.signerRole,
    keyFingerprint: sha256(key.export({ type: "spki", format: "der" })),
    policyFingerprint: sha256(canonicalJson(policy)),
    privateKeyAccepted: false,
    boundary: "PERL verifies one externally produced promotion attestation. The private key, CI credentials, registry credentials, and production records never enter PERL."
  };
}

function validateAttestationShape(attestation, request) {
  const keys = ["contractVersion", "promotionRequestId", "requestHash", "artifact", "localAdmission", "execution", "image", "gates", "issuedAt", "expiresAt", "keyId", "purpose", "authority", "signature"];
  if (!exactObject(attestation, keys) || attestation.contractVersion !== RELEASE_PROMOTION_ATTESTATION_CONTRACT || attestation.promotionRequestId !== request.requestId || attestation.requestHash !== request.requestHash || attestation.purpose !== RELEASE_PROMOTION_PURPOSE) fail("Release promotion attestation contract or request binding is invalid.", 409, "RELEASE_PROMOTION_ATTESTATION_MISMATCH");
  if (canonicalJson(attestation.artifact) !== canonicalJson(request.artifact) || !exactObject(attestation.localAdmission, ["admissionId", "evidenceHash"]) || attestation.localAdmission.admissionId !== request.localAdmission.admissionId || attestation.localAdmission.evidenceHash !== request.localAdmission.evidenceHash) fail("Release promotion attestation artifact or admission binding is invalid.", 409, "RELEASE_PROMOTION_ATTESTATION_MISMATCH");
  const execution = attestation.execution || {};
  if (!exactObject(execution, ["system", "runId", "runUri", "startedAt", "completedAt", "isolatedRunner", "networkPolicy", "credentialIsolation", "workloadIdentity"]) || typeof execution.system !== "string" || execution.system.length < 2 || execution.system.length > 96 || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/.test(execution.runId || "") || !/^(?:https:\/\/|urn:)[^\s]{4,500}$/.test(execution.runUri || "") || execution.isolatedRunner !== true || execution.networkPolicy !== "deny-by-default" || execution.credentialIsolation !== true || execution.workloadIdentity !== true) fail("Release promotion execution evidence is invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  const started = Date.parse(execution.startedAt);
  const completed = Date.parse(execution.completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) fail("Release promotion execution window is invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  const image = attestation.image || {};
  if (!exactObject(image, ["repository", "digest", "registryResourceId", "immutable"]) || !/^[a-z0-9][a-z0-9._/-]{2,255}$/.test(image.repository || "") || !/^sha256:[a-f0-9]{64}$/.test(image.digest || "") || !/^\/subscriptions\/[A-Za-z0-9-]+\/resourceGroups\/[A-Za-z0-9._()-]+\/providers\/Microsoft\.ContainerRegistry\/registries\/[A-Za-z0-9]+$/i.test(image.registryResourceId || "") || image.immutable !== true) fail("Release promotion OCI registry evidence is invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  if (!Array.isArray(attestation.gates) || attestation.gates.length !== RELEASE_PROMOTION_GATES.length || attestation.gates.some((gate, index) => !exactObject(gate, ["id", "status", "evidenceRef", "evidenceSha256"]) || gate.id !== RELEASE_PROMOTION_GATES[index].id || gate.status !== "passed" || !/^(?:https:\/\/|urn:)[^\s]{4,500}$/.test(gate.evidenceRef || "") || !digest(gate.evidenceSha256))) fail("Release promotion gate evidence is incomplete or invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  const authority = attestation.authority || {};
  if (!exactObject(authority, ["externalEvidenceVerified", "productionArtifactPromoted", "deploymentAuthorized", "azureDeploymentPerformed", "clinicalValidation", "clinicalReleaseAuthorized", "trafficActivationAuthorized", "patientUseAuthorized"]) || authority.externalEvidenceVerified !== true || authority.productionArtifactPromoted !== true || Object.entries(authority).some(([key, value]) => !["externalEvidenceVerified", "productionArtifactPromoted"].includes(key) && value !== false)) fail("Release promotion authority claims are invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  if (!/^[A-Za-z0-9+/]{86}==$/.test(attestation.signature || "") || Buffer.from(attestation.signature, "base64").length !== 64) fail("Release promotion attestation signature encoding is invalid.", 400, "RELEASE_PROMOTION_ATTESTATION_INVALID");
}

export function verifyReleasePromotionAttestation(attestation, policy, request, clock = () => new Date()) {
  validateReleasePromotionRequest(request);
  const errors = validateReleasePromotionTrustPolicy(policy, clock);
  if (errors.length) fail(errors.join(" "), 403, "RELEASE_PROMOTION_TRUST_POLICY_INVALID");
  validateAttestationShape(attestation, request);
  if (attestation.keyId !== policy.keyId) fail("Release promotion attestation key is not trusted by the active policy.", 409, "RELEASE_PROMOTION_ATTESTATION_MISMATCH");
  const issued = Date.parse(attestation.issuedAt);
  const expires = Date.parse(attestation.expiresAt);
  const now = clock().getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires < now || issued >= expires || expires - issued > policy.maxAttestationAgeSeconds * 1000 || issued < Date.parse(policy.issuedAt) || expires > Date.parse(policy.expiresAt)) fail("Release promotion attestation time window is invalid.", 409, "RELEASE_PROMOTION_ATTESTATION_EXPIRED");
  if (Date.parse(attestation.execution.completedAt) > issued) fail("Release promotion attestation cannot precede its external execution evidence.", 409, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  const { signature, ...payload } = attestation;
  if (!verifySignature(null, Buffer.from(canonicalJson(payload)), createPublicKey(policy.publicKeyPem), Buffer.from(signature, "base64"))) fail("Release promotion attestation signature verification failed.", 409, "RELEASE_PROMOTION_ATTESTATION_INVALID");
  return {
    contractVersion: RELEASE_PROMOTION_ATTESTATION_CONTRACT,
    status: "verified-external-promotion-evidence",
    promotionRequestId: request.requestId,
    artifactId: request.artifact.artifactId,
    imageDigest: attestation.image.digest,
    registryResourceId: attestation.image.registryResourceId,
    gateCount: attestation.gates.length,
    keyId: attestation.keyId,
    signerRole: policy.signerRole,
    issuedAt: attestation.issuedAt,
    expiresAt: attestation.expiresAt,
    externalEvidenceVerified: true,
    productionArtifactPromoted: true,
    deploymentAuthorized: false,
    azureDeploymentPerformed: false,
    clinicalReleaseAuthorized: false,
    trafficActivationAuthorized: false,
    patientUseAuthorized: false,
    privateKeyReceived: false
  };
}

async function immutableJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o400);
}

function promotionSummary(request, verified = null, attestationStored = false, verificationStatus = "not-stored") {
  return {
    requestId: request.requestId,
    status: verified ? verified.status : verificationStatus === "expired" ? "external-attestation-expired" : "external-evidence-required",
    requestedAt: request.requestedAt,
    requestHash: request.requestHash,
    artifactId: request.artifact.artifactId,
    admissionId: request.localAdmission.admissionId,
    gateCount: request.gates.length,
    attestationStored,
    verificationStatus,
    verified,
    downloads: {
      request: `/api/operations/release/promotions/${request.requestId}/request.json`,
      attestationTemplate: `/api/operations/release/promotions/${request.requestId}/attestation-template.json`
    }
  };
}

export class ReleasePromotionRepository {
  constructor({ releaseRepository, admissionRepository, repositoryRoot, trustPolicy, clock = () => new Date() }) {
    if (!releaseRepository || !admissionRepository) fail("Release promotion requires candidate and admission repositories.", 500, "RELEASE_PROMOTION_CONFIGURATION_INVALID");
    this.releaseRepository = releaseRepository;
    this.admissionRepository = admissionRepository;
    this.repositoryRoot = resolve(repositoryRoot);
    this.trustPolicy = trustPolicy;
    this.clock = clock;
    if (trustPolicy) {
      const errors = validateReleasePromotionTrustPolicy(trustPolicy, clock);
      if (errors.length) fail(errors.join(" "), 500, "RELEASE_PROMOTION_TRUST_POLICY_INVALID");
    }
  }

  directory(id) {
    if (!requestId(id)) fail("Release promotion request ID is invalid.", 400, "RELEASE_PROMOTION_ID_INVALID");
    return join(this.repositoryRoot, id);
  }

  async ensureRepository() {
    await mkdir(this.repositoryRoot, { recursive: true, mode: 0o700 });
    await chmod(this.repositoryRoot, 0o700);
  }

  async readPromotion(id) {
    let request;
    try {
      request = JSON.parse(await readFile(join(this.directory(id), "request.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") fail("Release promotion request was not found.", 404, "RELEASE_PROMOTION_NOT_FOUND");
      fail("Release promotion request is unreadable or invalid.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
    }
    validateReleasePromotionRequest(request);
    if (request.requestId !== id) fail("Release promotion request does not match its content-addressed directory.", 500, "RELEASE_PROMOTION_REQUEST_INVALID");
    let attestation = null;
    let verified = null;
    let verificationStatus = "not-stored";
    try {
      attestation = JSON.parse(await readFile(join(this.directory(id), "verified-attestation.json"), "utf8"));
      validateAttestationShape(attestation, request);
      verificationStatus = "stored-unverified";
      if (this.trustPolicy) {
        try {
          verified = verifyReleasePromotionAttestation(attestation, this.trustPolicy, request, this.clock);
          verificationStatus = "verified-current";
        } catch (error) {
          if (error.code === "RELEASE_PROMOTION_ATTESTATION_EXPIRED") verificationStatus = "expired";
          else throw error;
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return { request, attestation, verified, verificationStatus };
  }

  async listIds() {
    try {
      return (await readdir(this.repositoryRoot, { withFileTypes: true })).filter(entry => entry.isDirectory() && requestId(entry.name)).map(entry => entry.name);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async status() {
    const [release, admission] = await Promise.all([this.releaseRepository.status(), this.admissionRepository.status()]);
    const promotions = [];
    let corruptRequestCount = 0;
    for (const id of await this.listIds()) {
      try {
        const record = await this.readPromotion(id);
        promotions.push(promotionSummary(record.request, record.verified, Boolean(record.attestation), record.verificationStatus));
      } catch {
        corruptRequestCount += 1;
      }
    }
    promotions.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt) || a.requestId.localeCompare(b.requestId));
    const candidate = release.latest?.artifactId || null;
    const latest = promotions.find(item => item.artifactId === candidate) || null;
    const admissionReady = admission.status === "qualified-local" && admission.latest?.artifact?.artifactId === candidate;
    let status = latest?.status || (candidate ? admissionReady ? "request-required" : "admission-required" : "candidate-required");
    if (corruptRequestCount || release.status === "repository-integrity-failed" || admission.status === "repository-integrity-failed") status = "repository-integrity-failed";
    return {
      contractVersion: RELEASE_PROMOTION_CONTRACT,
      requestContractVersion: RELEASE_PROMOTION_REQUEST_CONTRACT,
      attestationContractVersion: RELEASE_PROMOTION_ATTESTATION_CONTRACT,
      status,
      repositoryMode: "local-content-addressed-promotion-evidence",
      requestCount: promotions.length,
      corruptRequestCount,
      candidateId: candidate,
      admissionId: admissionReady ? admission.latest.admissionId : null,
      latest,
      history: promotions.slice(0, 8),
      trust: trustStatus(this.trustPolicy, this.clock),
      localArchiveQualificationPassed: admissionReady,
      externalEvidenceVerified: latest?.verified?.externalEvidenceVerified === true,
      productionArtifactPromoted: latest?.verified?.productionArtifactPromoted === true,
      deploymentAuthorized: false,
      azureDeploymentPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      trafficActivationAuthorized: false,
      patientUseAuthorized: false,
      boundary: RELEASE_PROMOTION_BOUNDARY
    };
  }

  async prepare(candidateId) {
    const candidate = await this.releaseRepository.readCandidate(candidateId);
    const admissionStatus = await this.admissionRepository.status();
    const admission = admissionStatus.latest;
    const request = buildReleasePromotionRequest({ candidate, admission });
    await this.ensureRepository();
    const directory = this.directory(request.requestId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    try {
      const existing = await this.readPromotion(request.requestId);
      if (canonicalJson(existing.request) !== canonicalJson(request)) fail("Release promotion identity conflicts with the stored request.", 409, "RELEASE_PROMOTION_CONFLICT");
      return { ...(await this.status()), request: promotionSummary(existing.request, existing.verified, Boolean(existing.attestation), existing.verificationStatus), idempotent: true };
    } catch (error) {
      if (error.code !== "RELEASE_PROMOTION_NOT_FOUND") throw error;
    }
    await immutableJson(join(directory, "request.json"), request);
    await immutableJson(join(directory, "attestation-template.json"), releasePromotionAttestationTemplate(request));
    return { ...(await this.status()), request: promotionSummary(request), idempotent: false };
  }

  async verifyAndStoreAttestation(attestation) {
    if (!this.trustPolicy) fail("Release promotion verification is disabled until an owner-only startup trust policy is configured.", 409, "RELEASE_PROMOTION_TRUST_DISABLED");
    const record = await this.readPromotion(attestation?.promotionRequestId);
    const verified = verifyReleasePromotionAttestation(attestation, this.trustPolicy, record.request, this.clock);
    const path = join(this.directory(record.request.requestId), "verified-attestation.json");
    try {
      const existing = JSON.parse(await readFile(path, "utf8"));
      verifyReleasePromotionAttestation(existing, this.trustPolicy, record.request, this.clock);
      if (canonicalJson(existing) !== canonicalJson(attestation)) fail("A different verified attestation is already pinned to this promotion request.", 409, "RELEASE_PROMOTION_ATTESTATION_CONFLICT");
    } catch (error) {
      if (error.code === "ENOENT") await immutableJson(path, attestation);
      else throw error;
    }
    return { ...(await this.status()), attestation: verified };
  }

  async download(id, kind) {
    const record = await this.readPromotion(id);
    if (kind === "request") return { filename: `PERL-${id}.request.json`, mediaType: "application/json; charset=utf-8", bytes: Buffer.from(`${JSON.stringify(record.request, null, 2)}\n`) };
    if (kind === "attestationTemplate") return { filename: `PERL-${id}.attestation-template.json`, mediaType: "application/json; charset=utf-8", bytes: Buffer.from(`${JSON.stringify(releasePromotionAttestationTemplate(record.request), null, 2)}\n`) };
    fail("Release promotion artifact type is invalid.", 400, "RELEASE_PROMOTION_ARTIFACT_KIND_INVALID");
  }
}

export function releasePromotionTrustPolicyTemplate() {
  return {
    contractVersion: RELEASE_PROMOTION_TRUST_POLICY_CONTRACT,
    status: "approved-for-promotion-verification",
    policyId: "FF-PROMOTION-POLICY-REPLACE-ME",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-09-13T00:00:00.000Z",
    signerRole: "production-promotion-attestation-authority",
    keyId: "replace-with-promotion-attestation-key-id",
    algorithm: "Ed25519",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_ED25519_PUBLIC_KEY\n-----END PUBLIC KEY-----\n",
    maxAttestationAgeSeconds: 604800
  };
}
