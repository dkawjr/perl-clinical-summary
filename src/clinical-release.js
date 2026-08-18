import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const CLINICAL_RELEASE_CONTRACT = "perl-governed-clinical-release/1.0";
export const CLINICAL_RELEASE_REGISTRY_CONTRACT = "perl-clinical-release-registry/1.0";
export const CLINICAL_RELEASE_CHALLENGE_CONTRACT = "perl-clinical-release-challenge/1.0";
export const CLINICAL_USE_AUTHORIZATION_CONTRACT = "perl-clinical-use-authorization/1.0";
export const PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT = "perl-production-release-authorization/1.0";
export const RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT = "perl-release-deployment-attestation/1.0";

export const CLINICAL_RELEASE_KEY_PURPOSES = Object.freeze([
  "clinical-use-authorization",
  "production-release-authorization",
  "release-deployment-attestation"
]);

export const CLINICAL_RELEASE_BOUNDARY = "This gate requires three distinct externally provisioned Ed25519 duties before it can record bounded clinical-use, patient-use, production-release, and deployment-conformance authority. It verifies metadata and signatures only. It does not create a key, inspect evidence files, identify a person, receive a patient record, transmit to e-QPASS, deploy an artifact, enable clinical traffic, start a live pilot, process a patient record, modify Findings, score an assessment, make a diagnosis or care decision, establish clinical validity or outcomes, renew or expand a site, or replace identity, legal, privacy, security, accessibility, monitoring, backup, incident-response, stop/restart, and operational controls. Even all three verified duties produce release-ready evidence; a later external traffic-activation control must still turn traffic on and attest the first governed transaction.";

const CANDIDATE_IDS = Object.freeze(["north-central-counseling-center", "cooper-psych-clinic-qi"]);
const HEX_64 = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-RELEASE-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-RELEASE-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-RELEASE-CHALLENGE-[A-F0-9-]{20,80}$/;
const CLINICAL_AUTH_ID = /^FF-CLINICAL-AUTH-[A-Z0-9-]{3,80}$/;
const PRODUCTION_AUTH_ID = /^FF-PRODUCTION-AUTH-[A-Z0-9-]{3,80}$/;
const ATTESTATION_ID = /^FF-RELEASE-ATTEST-[A-Z0-9-]{3,80}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const NONCE_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const ED25519_SIGNATURE_BASE64URL = /^[A-Za-z0-9_-]{86}$/;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_RECEIPT_BYTES = 64 * 1024;
const CHALLENGE_LIFETIME_MS = 20 * 60 * 1000;
const MAX_USE_WINDOW_MS = 400 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const clone = value => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalClinicalReleaseJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalClinicalReleaseJson(value)).digest("hex");
}

function finiteDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value);
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = actual.filter(key => !keys.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`${label} contains fields outside the contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function publicKeyFingerprint(publicKeyPem) {
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return null;
    return createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
  } catch {
    return null;
  }
}

const contentBoundary = () => ({
  evidenceFilesIncluded: false,
  humanNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  patientRecordsIncluded: false,
  findingsContentIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

function validateContentBoundary(boundary, label, errors) {
  const keys = ["evidenceFilesIncluded", "humanNamesIncluded", "humanSignaturesIncluded", "credentialsOrSecretsIncluded", "patientRecordsIncluded", "findingsContentIncluded", "phiIncluded", "perlExternalTransmissionPerformed"];
  if (exactKeys(boundary, keys, label, errors)) for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
}

export function disabledClinicalReleaseRegistry() {
  return {
    contractVersion: CLINICAL_RELEASE_REGISTRY_CONTRACT,
    registryId: "FF-RELEASE-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function clinicalReleaseRegistryTemplate() {
  return {
    contractVersion: CLINICAL_RELEASE_REGISTRY_CONTRACT,
    registryId: "FF-RELEASE-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: CLINICAL_RELEASE_KEY_PURPOSES.map((purpose, index) => ({
      keyId: `FF-RELEASE-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null,
      candidateIds: ["north-central-counseling-center"]
    })),
    provisioningBoundary: "Provision three distinct purpose-bound keys in this owner-only file outside PERL and supply its path only at server startup. There is no registry-write API."
  };
}

export function validateClinicalReleaseRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Clinical-release registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Clinical-release registry", errors)) return errors;
  if (registry.contractVersion !== CLINICAL_RELEASE_REGISTRY_CONTRACT) errors.push(`Clinical-release registry contractVersion must be ${CLINICAL_RELEASE_REGISTRY_CONTRACT}.`);
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Clinical-release registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Clinical-release registry version is invalid.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (!Array.isArray(registry.keys)) errors.push("Clinical-release registry keys must be an array.");
  if (disabled && !allowDisabled) errors.push("Clinical-use, production-release, and deployment-attestation keys are required.");
  if (disabled && (registry.registryId !== "FF-RELEASE-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty clinical-release registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Clinical-release registry dates must define a valid window.");
  if (keys.length > 24) errors.push("Clinical-release registry may contain at most 24 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Clinical-release key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter", "candidateIds"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats keyId ${key.keyId}.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    if (!CLINICAL_RELEASE_KEY_PURPOSES.includes(key.purpose)) errors.push(`${label} purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a valid bounded Ed25519 SPKI key.`);
    if (fingerprint && fingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material; all three release duties require distinct keys.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must remain inside the registry window.`);
    if (!Array.isArray(key.candidateIds) || !key.candidateIds.length || key.candidateIds.some(id => !CANDIDATE_IDS.includes(id)) || new Set(key.candidateIds).size !== key.candidateIds.length) errors.push(`${label} candidate grants are invalid.`);
  }
  return [...new Set(errors)];
}

export function clinicalReleaseRegistryFingerprint(registry) {
  return digest(registry);
}

export function summarizeClinicalReleaseRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateClinicalReleaseRegistry(registry);
  if (errors.length) throw new Error(errors.join(" "));
  const now = Date.parse(generatedAt);
  const registryCurrent = registry.keys.length > 0 && Date.parse(registry.issuedAt) <= now && now <= Date.parse(registry.expiresAt);
  const trustedKeys = registry.keys.map(key => ({
    keyId: key.keyId,
    algorithm: key.algorithm,
    purpose: key.purpose,
    publicKeyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    notBefore: key.notBefore,
    notAfter: key.notAfter,
    candidateCount: key.candidateIds.length,
    active: registryCurrent && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter)
  }));
  return {
    contractVersion: registry.contractVersion,
    registryId: registry.registryId,
    version: registry.version,
    registryFingerprint: clinicalReleaseRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(CLINICAL_RELEASE_KEY_PURPOSES.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false
  };
}

export function createClinicalReleaseChallenge({ candidate, authorityBridgeFingerprint, pilotStartProof, continuityFingerprint, registry, actor, sequence, previousHash, createdAt, id = randomUUID(), challengeId = `FF-RELEASE-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const challenge = {
    contractVersion: CLINICAL_RELEASE_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    candidateId: candidate.candidate.id,
    dossierFingerprint: candidate.dossierFingerprint,
    authorityBridgeFingerprint,
    pilotStartControlFingerprint: pilotStartProof.controlFingerprint,
    pilotStartChainHead: pilotStartProof.chainHead,
    preparationAcknowledgementFingerprint: pilotStartProof.acknowledgementFingerprint,
    continuityFingerprint,
    registryFingerprint: clinicalReleaseRegistryFingerprint(registry),
    requiredPurposeOrder: [...CLINICAL_RELEASE_KEY_PURPOSES],
    releaseMode: "release-authority-only-traffic-off",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: contentBoundary()
  };
  const core = {
    id, sequence, previousHash, eventType: "release-challenge-issued", contractVersion: CLINICAL_RELEASE_CONTRACT, challenge, actor, createdAt,
    clinicalUseAuthorized: false, patientUseAuthorized: false, productionReleaseAuthorized: false, deploymentVerified: false,
    releaseReadyForTrafficActivation: false, clinicalTrafficEnabled: false, pilotStarted: false, boundary: CLINICAL_RELEASE_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateClinicalReleaseChallenge(challenge, { candidate, authorityBridgeFingerprint, pilotStartProof, continuityFingerprint, registryFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "candidateId", "dossierFingerprint", "authorityBridgeFingerprint", "pilotStartControlFingerprint", "pilotStartChainHead", "preparationAcknowledgementFingerprint", "continuityFingerprint", "registryFingerprint", "requiredPurposeOrder", "releaseMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Clinical-release challenge", errors)) return errors;
  if (challenge.contractVersion !== CLINICAL_RELEASE_CHALLENGE_CONTRACT) errors.push(`Clinical-release challenge contractVersion must be ${CLINICAL_RELEASE_CHALLENGE_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(challenge.challengeId || ""))) errors.push("Clinical-release challenge ID is invalid.");
  if (!NONCE_BASE64URL.test(String(challenge.nonce || ""))) errors.push("Clinical-release challenge nonce must encode exactly 256 random bits.");
  if (!CANDIDATE_IDS.includes(challenge.candidateId)) errors.push("Clinical-release challenge candidate is invalid.");
  const fingerprints = [challenge.dossierFingerprint, challenge.authorityBridgeFingerprint, challenge.pilotStartControlFingerprint, challenge.pilotStartChainHead, challenge.preparationAcknowledgementFingerprint, challenge.continuityFingerprint, challenge.registryFingerprint];
  if (!fingerprints.every(value => HEX_64.test(String(value || "")))) errors.push("Clinical-release challenge fingerprints are invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Clinical-release challenge must use the exact 20-minute window.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(CLINICAL_RELEASE_KEY_PURPOSES)) errors.push("Clinical-release challenge purpose order is invalid.");
  if (challenge.releaseMode !== "release-authority-only-traffic-off") errors.push("Clinical-release challenge must keep traffic off.");
  if (candidate && (challenge.candidateId !== candidate.candidate.id || challenge.dossierFingerprint !== candidate.dossierFingerprint)) errors.push("Clinical-release challenge does not match the current authority candidate.");
  if (authorityBridgeFingerprint && challenge.authorityBridgeFingerprint !== authorityBridgeFingerprint) errors.push("Clinical-release challenge does not match the current authority bridge.");
  if (pilotStartProof && (challenge.pilotStartControlFingerprint !== pilotStartProof.controlFingerprint || challenge.pilotStartChainHead !== pilotStartProof.chainHead || challenge.preparationAcknowledgementFingerprint !== pilotStartProof.acknowledgementFingerprint)) errors.push("Clinical-release challenge does not match the provider-preparation proof.");
  if (continuityFingerprint && challenge.continuityFingerprint !== continuityFingerprint) errors.push("Clinical-release challenge does not match current continuity evidence.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Clinical-release challenge does not match the current release registry.");
  validateContentBoundary(challenge.contentBoundary, "Clinical-release challenge contentBoundary", errors);
  return [...new Set(errors)];
}

function validateSignature(signature, keyId, label, errors) {
  if (!exactKeys(signature, ["algorithm", "keyId", "value"], `${label} signature`, errors)) return;
  if (signature.algorithm !== "Ed25519" || signature.keyId !== keyId || !ED25519_SIGNATURE_BASE64URL.test(String(signature.value || ""))) errors.push(`${label} signature metadata is invalid.`);
}

function validateRegistryKey({ registry, keyId, purpose, candidateId, issuedAt, now, label, errors }) {
  const registryErrors = registry ? validateClinicalReleaseRegistry(registry, { allowDisabled: false }) : ["Clinical-release registry is unavailable."];
  if (registryErrors.length) errors.push(...registryErrors);
  const key = registry?.keys?.find(item => item.keyId === keyId);
  if (!key) errors.push(`${label} key is not in the startup registry.`);
  const nowMs = Date.parse(now);
  if (registry && (nowMs < Date.parse(registry.issuedAt) || nowMs > Date.parse(registry.expiresAt))) errors.push("Clinical-release registry is outside its validity window.");
  if (key) {
    if (key.purpose !== purpose) errors.push(`${label} key is not granted to purpose ${purpose}.`);
    if (!key.candidateIds.includes(candidateId)) errors.push(`${label} key is not granted to this candidate.`);
    if (Date.parse(issuedAt) < Date.parse(key.notBefore) || Date.parse(issuedAt) > Date.parse(key.notAfter) || nowMs > Date.parse(key.notAfter)) errors.push(`${label} key is outside its validity window.`);
  }
  return key;
}

function validateCommonReceipt(receipt, { challenge, registry, now, idPattern, idField, purpose, label, errors, seenReceiptIds, seenSignatureHashes, pointInTime = false }) {
  if (Buffer.byteLength(JSON.stringify(receipt ?? null)) > MAX_RECEIPT_BYTES) errors.push(`${label} exceeds the 64 KB metadata limit.`);
  if (!idPattern.test(String(receipt?.[idField] || "")) || !KEY_ID.test(String(receipt?.keyId || ""))) errors.push(`${label} identifiers are invalid.`);
  if (!finiteDate(receipt?.issuedAt) || !finiteDate(receipt?.expiresAt) || (pointInTime ? Date.parse(receipt.expiresAt) !== Date.parse(receipt.issuedAt) : Date.parse(receipt.expiresAt) <= Date.parse(receipt.issuedAt))) errors.push(`${label} validity window is invalid.`);
  if (challenge && (receipt.challengeId !== challenge.challengeId || receipt.candidateId !== challenge.candidateId || receipt.registryFingerprint !== challenge.registryFingerprint)) errors.push(`${label} does not match its issued challenge.`);
  if (challenge && (Date.parse(receipt.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(receipt.issuedAt) > Date.parse(challenge.expiresAt) || Date.parse(receipt.expiresAt) > Date.parse(challenge.expiresAt))) errors.push(`${label} falls outside the challenge window.`);
  const nowMs = Date.parse(now);
  if (finiteDate(receipt?.issuedAt) && Date.parse(receipt.issuedAt) > nowMs + CLOCK_SKEW_MS) errors.push(`${label} issuedAt is in the future.`);
  if (!pointInTime && finiteDate(receipt?.expiresAt) && nowMs > Date.parse(receipt.expiresAt)) errors.push(`${label} has expired.`);
  if (registry && receipt.registryFingerprint !== clinicalReleaseRegistryFingerprint(registry)) errors.push(`${label} registry fingerprint is stale.`);
  if (seenReceiptIds.has(receipt?.[idField])) errors.push(`${label} ID has already been recorded.`);
  const signatureHash = digest(String(receipt?.signature?.value || ""));
  if (seenSignatureHashes.has(signatureHash)) errors.push(`${label} signature has already been recorded.`);
  validateContentBoundary(receipt?.contentBoundary, `${label} contentBoundary`, errors);
  validateSignature(receipt?.signature, receipt?.keyId, label, errors);
  return validateRegistryKey({ registry, keyId: receipt?.keyId, purpose, candidateId: receipt?.candidateId, issuedAt: receipt?.issuedAt, now, label, errors });
}

export function clinicalUseAuthorizationSigningPayload(authorization) {
  const { signature: _signature, ...payload } = authorization || {};
  return canonicalClinicalReleaseJson(payload);
}

export function validateClinicalUseAuthorization(authorization, { challenge, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "candidateId", "dossierFingerprint", "registryFingerprint", "keyId", "authorizationId", "issuedAt", "expiresAt", "useWindow", "scope", "evidenceReferences", "contentBoundary", "signature"];
  if (!exactKeys(authorization, keys, "Clinical-use authorization", errors)) return errors;
  if (authorization.contractVersion !== CLINICAL_USE_AUTHORIZATION_CONTRACT) errors.push(`Clinical-use authorization contractVersion must be ${CLINICAL_USE_AUTHORIZATION_CONTRACT}.`);
  const key = validateCommonReceipt(authorization, { challenge, registry, now, idPattern: CLINICAL_AUTH_ID, idField: "authorizationId", purpose: "clinical-use-authorization", label: "Clinical-use authorization", errors, seenReceiptIds, seenSignatureHashes });
  if (challenge && authorization.dossierFingerprint !== challenge.dossierFingerprint) errors.push("Clinical-use authorization dossier fingerprint is stale.");
  if (exactKeys(authorization.useWindow, ["notBefore", "notAfter"], "Clinical-use authorization useWindow", errors)) {
    const duration = Date.parse(authorization.useWindow.notAfter) - Date.parse(authorization.useWindow.notBefore);
    if (!finiteDate(authorization.useWindow.notBefore) || !finiteDate(authorization.useWindow.notAfter) || duration <= 0 || duration > MAX_USE_WINDOW_MS) errors.push("Clinical-use window must be valid and no longer than 400 days.");
  }
  const scopeKeys = ["settingRef", "populationRef", "maximumRecords", "purpose", "allowedAudience", "clinicalUseAuthorized", "patientUseAuthorized", "autonomousClinicalDecisionAllowed", "diagnosticUseAllowed", "scoringByPerlAllowed", "findingsModificationAllowed"];
  if (exactKeys(authorization.scope, scopeKeys, "Clinical-use authorization scope", errors)) {
    if (!SAFE_REF.test(String(authorization.scope.settingRef || "")) || !SAFE_REF.test(String(authorization.scope.populationRef || "")) || !Number.isInteger(authorization.scope.maximumRecords) || authorization.scope.maximumRecords < 1 || authorization.scope.maximumRecords > 1000) errors.push("Clinical-use authorization setting, population, or maximum-record scope is invalid.");
    if (authorization.scope.purpose !== "provider-reviewed-quality-improvement" || authorization.scope.allowedAudience !== "licensed-clinical-provider") errors.push("Clinical-use authorization purpose or audience is outside the provider-first scope.");
    if (authorization.scope.clinicalUseAuthorized !== true || authorization.scope.patientUseAuthorized !== true) errors.push("Clinical-use and patient-use authority must be explicit.");
    for (const field of ["autonomousClinicalDecisionAllowed", "diagnosticUseAllowed", "scoringByPerlAllowed", "findingsModificationAllowed"]) if (authorization.scope[field] !== false) errors.push(`Clinical-use authorization scope.${field} must remain false.`);
  }
  const evidenceKeys = ["intendedUse", "language", "clinicalStandard", "independentReview", "eqpassContract", "privacySecurity", "accessibility"];
  if (exactKeys(authorization.evidenceReferences, evidenceKeys, "Clinical-use authorization evidenceReferences", errors) && evidenceKeys.some(field => !HEX_64.test(String(authorization.evidenceReferences[field] || "")))) errors.push("Clinical-use authorization evidence references must be SHA-256 fingerprints.");
  if (key) {
    try { if (!verifySignature(null, Buffer.from(clinicalUseAuthorizationSigningPayload(authorization)), createPublicKey(key.publicKeyPem), Buffer.from(authorization.signature.value, "base64url"))) errors.push("Clinical-use authorization signature is invalid."); }
    catch { errors.push("Clinical-use authorization signature could not be verified."); }
  }
  return [...new Set(errors)];
}

export function productionReleaseAuthorizationSigningPayload(authorization) {
  const { signature: _signature, ...payload } = authorization || {};
  return canonicalClinicalReleaseJson(payload);
}

export function validateProductionReleaseAuthorization(authorization, { challenge, clinicalAuthorization, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "candidateId", "registryFingerprint", "keyId", "authorizationId", "clinicalAuthorizationId", "clinicalAuthorizationFingerprint", "issuedAt", "expiresAt", "deployment", "controlReferences", "releaseState", "contentBoundary", "signature"];
  if (!exactKeys(authorization, keys, "Production-release authorization", errors)) return errors;
  if (authorization.contractVersion !== PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT) errors.push(`Production-release authorization contractVersion must be ${PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT}.`);
  const key = validateCommonReceipt(authorization, { challenge, registry, now, idPattern: PRODUCTION_AUTH_ID, idField: "authorizationId", purpose: "production-release-authorization", label: "Production-release authorization", errors, seenReceiptIds, seenSignatureHashes });
  if (clinicalAuthorization && (authorization.clinicalAuthorizationId !== clinicalAuthorization.authorizationId || authorization.clinicalAuthorizationFingerprint !== digest(clinicalAuthorization))) errors.push("Production-release authorization does not match the verified clinical-use authorization.");
  if (exactKeys(authorization.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "Production-release authorization deployment", errors)) {
    if (authorization.deployment.environmentId !== "eqpass-azure-pilot" || !SAFE_REF.test(String(authorization.deployment.tenantRef || "")) || !SAFE_REF.test(String(authorization.deployment.releaseId || "")) || !HEX_64.test(String(authorization.deployment.artifactDigest || "")) || !HEX_64.test(String(authorization.deployment.configurationDigest || ""))) errors.push("Production-release deployment metadata is invalid.");
  }
  const controlKeys = ["securityApproval", "privacyApproval", "eqpassOwnerApproval", "rollbackEvidence", "monitoringEvidence", "incidentResponseEvidence"];
  if (exactKeys(authorization.controlReferences, controlKeys, "Production-release authorization controlReferences", errors) && controlKeys.some(field => !HEX_64.test(String(authorization.controlReferences[field] || "")))) errors.push("Production-release control references must be SHA-256 fingerprints.");
  if (exactKeys(authorization.releaseState, ["productionReleaseAuthorized", "patientUseAuthorityConfirmed", "clinicalTrafficEnabled", "pilotStarted"], "Production-release authorization releaseState", errors)) {
    if (authorization.releaseState.productionReleaseAuthorized !== true || authorization.releaseState.patientUseAuthorityConfirmed !== true || authorization.releaseState.clinicalTrafficEnabled !== false || authorization.releaseState.pilotStarted !== false) errors.push("Production-release authorization state must authorize release while keeping traffic and pilot start false.");
  }
  if (key) {
    try { if (!verifySignature(null, Buffer.from(productionReleaseAuthorizationSigningPayload(authorization)), createPublicKey(key.publicKeyPem), Buffer.from(authorization.signature.value, "base64url"))) errors.push("Production-release authorization signature is invalid."); }
    catch { errors.push("Production-release authorization signature could not be verified."); }
  }
  return [...new Set(errors)];
}

export function releaseDeploymentAttestationSigningPayload(attestation) {
  const { signature: _signature, ...payload } = attestation || {};
  return canonicalClinicalReleaseJson(payload);
}

export function validateReleaseDeploymentAttestation(attestation, { challenge, clinicalAuthorization, productionAuthorization, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "candidateId", "registryFingerprint", "keyId", "attestationId", "clinicalAuthorizationFingerprint", "productionAuthorizationFingerprint", "observedAt", "deployment", "controlChecks", "releaseState", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "Release-deployment attestation", errors)) return errors;
  if (attestation.contractVersion !== RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT) errors.push(`Release-deployment attestation contractVersion must be ${RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT}.`);
  const receiptShape = { ...attestation, issuedAt: attestation.observedAt, expiresAt: attestation.observedAt };
  const key = validateCommonReceipt(receiptShape, { challenge, registry, now, idPattern: ATTESTATION_ID, idField: "attestationId", purpose: "release-deployment-attestation", label: "Release-deployment attestation", errors, seenReceiptIds, seenSignatureHashes, pointInTime: true });
  if (clinicalAuthorization && attestation.clinicalAuthorizationFingerprint !== digest(clinicalAuthorization)) errors.push("Release-deployment attestation does not match the clinical authorization.");
  if (productionAuthorization && (attestation.productionAuthorizationFingerprint !== digest(productionAuthorization) || canonicalClinicalReleaseJson(attestation.deployment) !== canonicalClinicalReleaseJson(productionAuthorization.deployment))) errors.push("Release-deployment attestation does not match the production authorization.");
  if (exactKeys(attestation.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "Release-deployment attestation deployment", errors) && attestation.deployment.environmentId !== "eqpass-azure-pilot") errors.push("Release-deployment attestation environment is invalid.");
  const checkKeys = ["artifactMatched", "configurationMatched", "identityAccessReady", "continuousMonitoringReady", "encryptedBackupReady", "incidentRoutesReady", "auditRetentionReady", "rollbackReady"];
  if (exactKeys(attestation.controlChecks, checkKeys, "Release-deployment attestation controlChecks", errors)) for (const field of checkKeys) if (attestation.controlChecks[field] !== true) errors.push(`Release-deployment attestation controlChecks.${field} must be true.`);
  if (exactKeys(attestation.releaseState, ["deploymentVerified", "releaseReadyForTrafficActivation", "clinicalTrafficEnabled", "patientRecordsProcessed", "pilotStarted"], "Release-deployment attestation releaseState", errors)) {
    if (attestation.releaseState.deploymentVerified !== true || attestation.releaseState.releaseReadyForTrafficActivation !== true || attestation.releaseState.clinicalTrafficEnabled !== false || attestation.releaseState.patientRecordsProcessed !== false || attestation.releaseState.pilotStarted !== false) errors.push("Release-deployment attestation must verify readiness while keeping traffic, records, and pilot start false.");
  }
  if (key) {
    try { if (!verifySignature(null, Buffer.from(releaseDeploymentAttestationSigningPayload(attestation)), createPublicKey(key.publicKeyPem), Buffer.from(attestation.signature.value, "base64url"))) errors.push("Release-deployment attestation signature is invalid."); }
    catch { errors.push("Release-deployment attestation signature could not be verified."); }
  }
  return [...new Set(errors)];
}

function createReceiptEvent({ eventType, payloadName, payload, registry, actor, sequence, previousHash, verifiedAt, state, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === payload.keyId);
  const core = {
    id, sequence, previousHash, eventType, contractVersion: CLINICAL_RELEASE_CONTRACT,
    [payloadName]: clone(payload), [`${payloadName}Fingerprint`]: digest(payload), keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actor, createdAt: verifiedAt, ...state, clinicalTrafficEnabled: false, pilotStarted: false, boundary: CLINICAL_RELEASE_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function createClinicalUseAuthorizationEvent(args) {
  return createReceiptEvent({ ...args, eventType: "clinical-use-authorized", payloadName: "clinicalAuthorization", payload: args.authorization, state: { clinicalUseAuthorized: true, patientUseAuthorized: true, productionReleaseAuthorized: false, deploymentVerified: false, releaseReadyForTrafficActivation: false } });
}

export function createProductionReleaseAuthorizationEvent(args) {
  return createReceiptEvent({ ...args, eventType: "production-release-authorized", payloadName: "productionAuthorization", payload: args.authorization, state: { clinicalUseAuthorized: true, patientUseAuthorized: true, productionReleaseAuthorized: true, deploymentVerified: false, releaseReadyForTrafficActivation: false } });
}

export function createReleaseDeploymentAttestationEvent(args) {
  return createReceiptEvent({ ...args, eventType: "release-deployment-attested", payloadName: "deploymentAttestation", payload: args.attestation, state: { clinicalUseAuthorized: true, patientUseAuthorized: true, productionReleaseAuthorized: true, deploymentVerified: true, releaseReadyForTrafficActivation: true } });
}

export function validateClinicalReleaseEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, clinicalAuthorization, productionAuthorization, now = event?.createdAt, seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Clinical-release event is required."];
  const { hash, ...core } = event;
  const definitions = {
    "release-challenge-issued": { payload: "challenge", fingerprint: null },
    "clinical-use-authorized": { payload: "clinicalAuthorization", fingerprint: "clinicalAuthorizationFingerprint" },
    "production-release-authorized": { payload: "productionAuthorization", fingerprint: "productionAuthorizationFingerprint" },
    "release-deployment-attested": { payload: "deploymentAttestation", fingerprint: "deploymentAttestationFingerprint" }
  };
  const definition = definitions[event.eventType];
  if (!definition) errors.push("Clinical-release event type is invalid.");
  const evidenceKeys = definition?.fingerprint ? [definition.fingerprint, "keyFingerprint"] : [];
  if (definition) exactKeys(core, ["id", "sequence", "previousHash", "eventType", "contractVersion", definition.payload, ...evidenceKeys, "actor", "createdAt", "clinicalUseAuthorized", "patientUseAuthorized", "productionReleaseAuthorized", "deploymentVerified", "releaseReadyForTrafficActivation", "clinicalTrafficEnabled", "pilotStarted", "boundary"], "Clinical-release event", errors);
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Clinical-release event chain position is invalid.");
  if (event.contractVersion !== CLINICAL_RELEASE_CONTRACT) errors.push(`Clinical-release event contractVersion must be ${CLINICAL_RELEASE_CONTRACT}.`);
  if (!/^[0-9a-f-]{36}$/i.test(String(event.id || "")) || !finiteDate(event.createdAt) || typeof event.actor !== "string" || event.actor.length < 2 || event.actor.length > 48) errors.push("Clinical-release event provenance is invalid.");
  if (event.boundary !== CLINICAL_RELEASE_BOUNDARY || event.clinicalTrafficEnabled !== false || event.pilotStarted !== false) errors.push("Clinical-release event boundary or traffic state is invalid.");
  if (event.eventType === "release-challenge-issued") {
    errors.push(...validateClinicalReleaseChallenge(event.challenge));
    if ([event.clinicalUseAuthorized, event.patientUseAuthorized, event.productionReleaseAuthorized, event.deploymentVerified, event.releaseReadyForTrafficActivation].some(Boolean)) errors.push("A release challenge cannot claim authority or readiness.");
  }
  if (event.eventType === "clinical-use-authorized") {
    errors.push(...validateClinicalUseAuthorization(event.clinicalAuthorization, { challenge, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.clinicalAuthorizationFingerprint !== digest(event.clinicalAuthorization) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Clinical-use authorization evidence is inconsistent.");
    if (!event.clinicalUseAuthorized || !event.patientUseAuthorized || event.productionReleaseAuthorized || event.deploymentVerified || event.releaseReadyForTrafficActivation) errors.push("Clinical-use authorization event state is invalid.");
  }
  if (event.eventType === "production-release-authorized") {
    errors.push(...validateProductionReleaseAuthorization(event.productionAuthorization, { challenge, clinicalAuthorization, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.productionAuthorizationFingerprint !== digest(event.productionAuthorization) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Production-release authorization evidence is inconsistent.");
    if (!event.clinicalUseAuthorized || !event.patientUseAuthorized || !event.productionReleaseAuthorized || event.deploymentVerified || event.releaseReadyForTrafficActivation) errors.push("Production-release authorization event state is invalid.");
  }
  if (event.eventType === "release-deployment-attested") {
    errors.push(...validateReleaseDeploymentAttestation(event.deploymentAttestation, { challenge, clinicalAuthorization, productionAuthorization, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.deploymentAttestationFingerprint !== digest(event.deploymentAttestation) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Release-deployment attestation evidence is inconsistent.");
    if (!event.clinicalUseAuthorized || !event.patientUseAuthorized || !event.productionReleaseAuthorized || !event.deploymentVerified || !event.releaseReadyForTrafficActivation) errors.push("Release-deployment attestation event state is invalid.");
  }
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Clinical-release event hash is invalid.");
  return [...new Set(errors)];
}

export function buildClinicalReleaseGate({ authorityTrust, pilotStart, continuity, registry, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizeClinicalReleaseRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const candidates = (authorityTrust?.candidates || []).map(authorityCandidate => {
    const candidateId = authorityCandidate.candidate.id;
    const preparation = pilotStart?.candidates?.find(item => item.candidate.id === candidateId);
    const preparationEvent = [...(pilotStart?.history || [])].reverse().find(event => event.eventType === "deployment-start-acknowledged" && event.acknowledgement.candidateId === candidateId) || null;
    const preparationAcknowledgementFingerprint = preparationEvent?.acknowledgementFingerprint || (preparation?.currentAcknowledgement ? digest(preparation.currentAcknowledgement) : null);
    const activeKeys = registry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter));
    const duties = Object.fromEntries(CLINICAL_RELEASE_KEY_PURPOSES.map(purpose => [purpose, activeKeys.filter(key => key.purpose === purpose)]));
    const separationReady = CLINICAL_RELEASE_KEY_PURPOSES.every(purpose => duties[purpose].length > 0) && new Set(activeKeys.map(key => publicKeyFingerprint(key.publicKeyPem))).size >= 3;
    const challengeEvents = events.filter(event => event.eventType === "release-challenge-issued" && event.challenge.candidateId === candidateId);
    const boundChallenges = challengeEvents.filter(event => event.challenge.dossierFingerprint === authorityCandidate.dossierFingerprint && event.challenge.authorityBridgeFingerprint === authorityTrust.bridgeFingerprint && event.challenge.pilotStartControlFingerprint === pilotStart.controlFingerprint && event.challenge.pilotStartChainHead === pilotStart.chain?.head && event.challenge.preparationAcknowledgementFingerprint === preparationAcknowledgementFingerprint && event.challenge.continuityFingerprint === continuity.continuityFingerprint && event.challenge.registryFingerprint === registrySummary.registryFingerprint);
    const boundChallengeIds = new Set(boundChallenges.map(event => event.challenge.challengeId));
    const clinicalEvents = events.filter(event => event.eventType === "clinical-use-authorized" && event.clinicalAuthorization.candidateId === candidateId && boundChallengeIds.has(event.clinicalAuthorization.challengeId) && Date.parse(event.clinicalAuthorization.useWindow.notBefore) <= now && now <= Date.parse(event.clinicalAuthorization.useWindow.notAfter));
    const productionEvents = events.filter(event => event.eventType === "production-release-authorized" && event.productionAuthorization.candidateId === candidateId);
    const attestationEvents = events.filter(event => event.eventType === "release-deployment-attested" && event.deploymentAttestation.candidateId === candidateId);
    const latestChallenge = boundChallenges.filter(event => now <= Date.parse(event.challenge.expiresAt)).at(-1) || null;
    const latestClinical = clinicalEvents.at(-1) || null;
    const latestProduction = latestClinical ? productionEvents.find(event => event.productionAuthorization.clinicalAuthorizationFingerprint === latestClinical.clinicalAuthorizationFingerprint) || null : null;
    const latestAttestation = latestProduction ? attestationEvents.find(event => event.deploymentAttestation.productionAuthorizationFingerprint === latestProduction.productionAuthorizationFingerprint) || null : null;
    let status = "provider-preparation-required";
    if (preparationEvent) status = "release-authority-required";
    if (preparationEvent && registrySummary.registryCurrent && separationReady) status = latestChallenge ? "clinical-use-authorization-required" : "release-challenge-required";
    if (latestClinical) status = "production-release-authorization-required";
    if (latestProduction) status = "deployment-attestation-required";
    if (latestAttestation) status = "release-ready-traffic-off";
    return {
      candidate: clone(authorityCandidate.candidate),
      dossierFingerprint: authorityCandidate.dossierFingerprint,
      authoritySealCurrent: authorityCandidate.pilotAuthorizationRecorded === true,
      providerPreparationStarted: Boolean(preparationEvent),
      preparationAcknowledgementFingerprint,
      separationReady,
      status,
      activeChallenge: latestChallenge?.challenge || null,
      clinicalAuthorization: latestClinical?.clinicalAuthorization || null,
      productionAuthorization: latestProduction?.productionAuthorization || null,
      deploymentAttestation: latestAttestation?.deploymentAttestation || null,
      clinicalUseAuthorized: Boolean(latestClinical),
      patientUseAuthorized: Boolean(latestClinical),
      productionReleaseAuthorized: Boolean(latestProduction),
      deploymentVerified: Boolean(latestAttestation),
      releaseReadyForTrafficActivation: Boolean(latestAttestation),
      clinicalTrafficEnabled: false,
      pilotStarted: false
    };
  });
  const gateFingerprint = digest({ contractVersion: CLINICAL_RELEASE_CONTRACT, authorityBridgeFingerprint: authorityTrust?.bridgeFingerprint || null, pilotStartControlFingerprint: pilotStart?.controlFingerprint || null, continuityFingerprint: continuity?.continuityFingerprint || null, registryFingerprint: registrySummary.registryFingerprint, eventHead: chain.head || "GENESIS" });
  return {
    contractVersion: CLINICAL_RELEASE_CONTRACT,
    registryContractVersion: CLINICAL_RELEASE_REGISTRY_CONTRACT,
    challengeContractVersion: CLINICAL_RELEASE_CHALLENGE_CONTRACT,
    clinicalAuthorizationContractVersion: CLINICAL_USE_AUTHORIZATION_CONTRACT,
    productionAuthorizationContractVersion: PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT,
    deploymentAttestationContractVersion: RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT,
    status: candidates.some(candidate => candidate.releaseReadyForTrafficActivation) ? "release-ready-traffic-off" : registrySummary.registryCurrent ? "clinical-release-gate-armed" : "clinical-release-registry-required",
    headline: "Three seals may release. None may turn on traffic.",
    subhead: "Authorize clinical use. Authorize production. Verify the deployment. Keep the switch elsewhere.",
    registry: registrySummary,
    continuity: clone(continuity),
    candidates,
    counts: {
      trustedKeys: registrySummary.trustedKeys.length,
      challengesIssued: events.filter(event => event.eventType === "release-challenge-issued").length,
      clinicalAuthorizations: events.filter(event => event.eventType === "clinical-use-authorized").length,
      productionAuthorizations: events.filter(event => event.eventType === "production-release-authorized").length,
      deploymentAttestations: events.filter(event => event.eventType === "release-deployment-attested").length,
      releasesReady: candidates.filter(candidate => candidate.releaseReadyForTrafficActivation).length
    },
    gateFingerprint,
    history: clone(events),
    chain: clone(chain),
    generatedAt,
    registryWriteApiAvailable: false,
    clinicalUseAuthorized: candidates.some(candidate => candidate.clinicalUseAuthorized),
    patientUseAuthorized: candidates.some(candidate => candidate.patientUseAuthorized),
    productionReleaseAuthorized: candidates.some(candidate => candidate.productionReleaseAuthorized),
    deploymentVerified: candidates.some(candidate => candidate.deploymentVerified),
    releaseReadyForTrafficActivation: candidates.some(candidate => candidate.releaseReadyForTrafficActivation),
    clinicalTrafficEnabled: false,
    pilotStarted: false,
    patientRecordsProcessed: false,
    boundary: CLINICAL_RELEASE_BOUNDARY
  };
}
