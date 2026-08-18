import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const TRAFFIC_ACTIVATION_CONTRACT = "perl-clinical-traffic-activation-witness/1.0";
export const TRAFFIC_ACTIVATION_REGISTRY_CONTRACT = "perl-traffic-activation-registry/1.0";
export const TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT = "perl-traffic-activation-challenge/1.0";
export const TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT = "perl-traffic-activation-authorization/1.0";
export const FIRST_GOVERNED_TRANSACTION_CONTRACT = "perl-first-governed-transaction-attestation/1.0";

export const TRAFFIC_ACTIVATION_KEY_PURPOSES = Object.freeze([
  "clinical-traffic-activation-clinical",
  "clinical-traffic-activation-operations",
  "first-governed-transaction-attestation"
]);

export const TRAFFIC_ACTIVATION_BOUNDARY = "This witness verifies three externally signed metadata duties: clinical concurrence for a bounded traffic window, operations concurrence for the identical deployment and window, and a separate observation of the first governed transaction. It does not create or rotate a key, inspect evidence files, connect to e-QPASS, expose an endpoint, send or receive a record, store an identifier or PHI, enable or disable traffic, deploy software, attach a report, modify Findings, score an assessment, make a diagnosis or care decision, or control clinical stop/restart. The switch, patient-data path, authoritative transaction, and production audit remain outside this synthetic PERL workspace.";

const CANDIDATE_IDS = Object.freeze(["north-central-counseling-center", "cooper-psych-clinic-qi"]);
const HEX_64 = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-TRAFFIC-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-TRAFFIC-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-TRAFFIC-CHALLENGE-[A-F0-9-]{20,80}$/;
const AUTHORIZATION_ID = /^FF-TRAFFIC-AUTH-[A-Z0-9-]{3,80}$/;
const ATTESTATION_ID = /^FF-FIRST-TXN-ATTEST-[A-Z0-9-]{3,80}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const NONCE_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const ED25519_SIGNATURE_BASE64URL = /^[A-Za-z0-9_-]{86}$/;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_RECEIPT_BYTES = 64 * 1024;
const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
const MAX_ACTIVATION_WINDOW_MS = 4 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const clone = value => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalTrafficActivationJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalTrafficActivationJson(value)).digest("hex");
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
  patientRecordContentIncluded: false,
  directIdentifiersIncluded: false,
  findingsContentIncluded: false,
  phiIncluded: false,
  endpointOrCredentialIncluded: false,
  perlExternalTransmissionPerformed: false
});

function validateContentBoundary(boundary, label, errors) {
  const keys = ["evidenceFilesIncluded", "humanNamesIncluded", "humanSignaturesIncluded", "credentialsOrSecretsIncluded", "patientRecordContentIncluded", "directIdentifiersIncluded", "findingsContentIncluded", "phiIncluded", "endpointOrCredentialIncluded", "perlExternalTransmissionPerformed"];
  if (exactKeys(boundary, keys, label, errors)) for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
}

export function disabledTrafficActivationRegistry() {
  return {
    contractVersion: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
    registryId: "FF-TRAFFIC-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function trafficActivationRegistryTemplate() {
  return {
    contractVersion: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
    registryId: "FF-TRAFFIC-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: TRAFFIC_ACTIVATION_KEY_PURPOSES.map((purpose, index) => ({
      keyId: `FF-TRAFFIC-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null,
      candidateIds: ["north-central-counseling-center"]
    })),
    provisioningBoundary: "Provision three distinct purpose-bound public keys outside PERL in this owner-only startup file. PERL has no registry-write, traffic-control, endpoint, or patient-record API."
  };
}

export function validateTrafficActivationRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Traffic-activation registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Traffic-activation registry", errors)) return errors;
  if (registry.contractVersion !== TRAFFIC_ACTIVATION_REGISTRY_CONTRACT) errors.push(`Traffic-activation registry contractVersion must be ${TRAFFIC_ACTIVATION_REGISTRY_CONTRACT}.`);
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Traffic-activation registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Traffic-activation registry version is invalid.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (!Array.isArray(registry.keys)) errors.push("Traffic-activation registry keys must be an array.");
  if (disabled && !allowDisabled) errors.push("Clinical, operations, and first-transaction witness keys are required.");
  if (disabled && (registry.registryId !== "FF-TRAFFIC-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty traffic-activation registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Traffic-activation registry dates must define a valid window.");
  if (keys.length > 24) errors.push("Traffic-activation registry may contain at most 24 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Traffic-activation key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter", "candidateIds"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats keyId ${key.keyId}.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    if (!TRAFFIC_ACTIVATION_KEY_PURPOSES.includes(key.purpose)) errors.push(`${label} purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a valid bounded Ed25519 SPKI key.`);
    if (fingerprint && fingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material; all three witness duties require distinct keys.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must remain inside the registry window.`);
    if (!Array.isArray(key.candidateIds) || !key.candidateIds.length || key.candidateIds.some(id => !CANDIDATE_IDS.includes(id)) || new Set(key.candidateIds).size !== key.candidateIds.length) errors.push(`${label} candidate grants are invalid.`);
  }
  return [...new Set(errors)];
}

export function trafficActivationRegistryFingerprint(registry) {
  return digest(registry);
}

export function summarizeTrafficActivationRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateTrafficActivationRegistry(registry);
  if (errors.length) throw new Error(errors.join(" "));
  const now = Date.parse(generatedAt);
  const registryCurrent = registry.keys.length > 0 && Date.parse(registry.issuedAt) <= now && now <= Date.parse(registry.expiresAt);
  const trustedKeys = registry.keys.map(key => ({
    keyId: key.keyId,
    purpose: key.purpose,
    algorithm: key.algorithm,
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
    registryFingerprint: trafficActivationRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(TRAFFIC_ACTIVATION_KEY_PURPOSES.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false
  };
}

export function createTrafficActivationChallenge({ candidate, releaseProof, continuityFingerprint, registry, actor, sequence, previousHash, createdAt, id = randomUUID(), challengeId = `FF-TRAFFIC-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const challenge = {
    contractVersion: TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    candidateId: candidate.candidate.id,
    dossierFingerprint: candidate.dossierFingerprint,
    releaseGateFingerprint: releaseProof.gateFingerprint,
    releaseChainHead: releaseProof.chainHead,
    clinicalAuthorizationFingerprint: releaseProof.clinicalAuthorizationFingerprint,
    productionAuthorizationFingerprint: releaseProof.productionAuthorizationFingerprint,
    deploymentAttestationFingerprint: releaseProof.deploymentAttestationFingerprint,
    continuityFingerprint,
    registryFingerprint: trafficActivationRegistryFingerprint(registry),
    requiredPurposeOrder: [...TRAFFIC_ACTIVATION_KEY_PURPOSES],
    witnessMode: "external-switch-dual-control-first-transaction-witness",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: contentBoundary()
  };
  const core = {
    id, sequence, previousHash, eventType: "traffic-activation-challenge-issued", contractVersion: TRAFFIC_ACTIVATION_CONTRACT,
    challenge, actor, createdAt, clinicalActivationConcurrenceVerified: false, operationsActivationConcurrenceVerified: false,
    externalTrafficActivationAuthorized: false, firstGovernedTransactionVerified: false, perlSandboxTrafficEnabled: false,
    perlSandboxPatientRecordsProcessed: false, phiStored: false, boundary: TRAFFIC_ACTIVATION_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateTrafficActivationChallenge(challenge, { candidate, releaseProof, continuityFingerprint, registryFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "candidateId", "dossierFingerprint", "releaseGateFingerprint", "releaseChainHead", "clinicalAuthorizationFingerprint", "productionAuthorizationFingerprint", "deploymentAttestationFingerprint", "continuityFingerprint", "registryFingerprint", "requiredPurposeOrder", "witnessMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Traffic-activation challenge", errors)) return errors;
  if (challenge.contractVersion !== TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT) errors.push(`Traffic-activation challenge contractVersion must be ${TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(challenge.challengeId || ""))) errors.push("Traffic-activation challenge ID is invalid.");
  if (!NONCE_BASE64URL.test(String(challenge.nonce || ""))) errors.push("Traffic-activation challenge nonce must encode exactly 256 random bits.");
  if (!CANDIDATE_IDS.includes(challenge.candidateId)) errors.push("Traffic-activation challenge candidate is invalid.");
  const fingerprints = [challenge.dossierFingerprint, challenge.releaseGateFingerprint, challenge.releaseChainHead, challenge.clinicalAuthorizationFingerprint, challenge.productionAuthorizationFingerprint, challenge.deploymentAttestationFingerprint, challenge.continuityFingerprint, challenge.registryFingerprint];
  if (!fingerprints.every(value => HEX_64.test(String(value || "")))) errors.push("Traffic-activation challenge fingerprints are invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Traffic-activation challenge must use the exact 15-minute window.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(TRAFFIC_ACTIVATION_KEY_PURPOSES)) errors.push("Traffic-activation challenge purpose order is invalid.");
  if (challenge.witnessMode !== "external-switch-dual-control-first-transaction-witness") errors.push("Traffic-activation challenge witness mode is invalid.");
  if (candidate && (challenge.candidateId !== candidate.candidate.id || challenge.dossierFingerprint !== candidate.dossierFingerprint)) errors.push("Traffic-activation challenge does not match the current release candidate.");
  if (releaseProof && ["gateFingerprint", "chainHead", "clinicalAuthorizationFingerprint", "productionAuthorizationFingerprint", "deploymentAttestationFingerprint"].some(field => challenge[field === "gateFingerprint" ? "releaseGateFingerprint" : field === "chainHead" ? "releaseChainHead" : field] !== releaseProof[field])) errors.push("Traffic-activation challenge does not match the current release proof.");
  if (continuityFingerprint && challenge.continuityFingerprint !== continuityFingerprint) errors.push("Traffic-activation challenge does not match current continuity evidence.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Traffic-activation challenge does not match the current witness registry.");
  validateContentBoundary(challenge.contentBoundary, "Traffic-activation challenge contentBoundary", errors);
  return [...new Set(errors)];
}

function validateSignature(signature, keyId, label, errors) {
  if (!exactKeys(signature, ["algorithm", "keyId", "value"], `${label} signature`, errors)) return;
  if (signature.algorithm !== "Ed25519" || signature.keyId !== keyId || !ED25519_SIGNATURE_BASE64URL.test(String(signature.value || ""))) errors.push(`${label} signature metadata is invalid.`);
}

function validateRegistryKey({ registry, keyId, purpose, candidateId, at, label, errors }) {
  const registryErrors = registry ? validateTrafficActivationRegistry(registry, { allowDisabled: false }) : ["Traffic-activation registry is unavailable."];
  if (registryErrors.length) errors.push(...registryErrors);
  const key = registry?.keys?.find(item => item.keyId === keyId);
  if (!key) errors.push(`${label} key is not in the startup registry.`);
  const atMs = Date.parse(at);
  if (registry && (atMs < Date.parse(registry.issuedAt) || atMs > Date.parse(registry.expiresAt))) errors.push("Traffic-activation registry is outside its validity window.");
  if (key) {
    if (key.purpose !== purpose) errors.push(`${label} key is not granted to purpose ${purpose}.`);
    if (!key.candidateIds.includes(candidateId)) errors.push(`${label} key is not granted to this candidate.`);
    if (atMs < Date.parse(key.notBefore) || atMs > Date.parse(key.notAfter)) errors.push(`${label} key is outside its validity window.`);
  }
  return key;
}

function replayErrors(receipt, idField, label, seenReceiptIds, seenSignatureHashes, errors) {
  if (seenReceiptIds.has(receipt?.[idField])) errors.push(`${label} ID has already been recorded.`);
  const signatureHash = digest(String(receipt?.signature?.value || ""));
  if (seenSignatureHashes.has(signatureHash)) errors.push(`${label} signature has already been recorded.`);
}

export function trafficActivationPlanFingerprint(authorization) {
  return digest({
    challengeId: authorization.challengeId,
    candidateId: authorization.candidateId,
    releaseGateFingerprint: authorization.releaseGateFingerprint,
    activationWindow: authorization.activationWindow,
    deployment: authorization.deployment,
    endpointBindings: authorization.endpointBindings,
    controlReferences: authorization.controlReferences,
    authorityState: authorization.authorityState,
    contentBoundary: authorization.contentBoundary
  });
}

export function trafficActivationAuthorizationSigningPayload(authorization) {
  const { signature: _signature, ...payload } = authorization || {};
  return canonicalTrafficActivationJson(payload);
}

export function validateTrafficActivationAuthorization(authorization, { challenge, registry, purpose, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "candidateId", "registryFingerprint", "keyId", "authorizationId", "duty", "releaseGateFingerprint", "issuedAt", "expiresAt", "activationWindow", "deployment", "endpointBindings", "controlReferences", "authorityState", "contentBoundary", "signature"];
  if (!exactKeys(authorization, keys, "Traffic-activation authorization", errors)) return errors;
  if (authorization.contractVersion !== TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT) errors.push(`Traffic-activation authorization contractVersion must be ${TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT}.`);
  if (!AUTHORIZATION_ID.test(String(authorization.authorizationId || "")) || !KEY_ID.test(String(authorization.keyId || ""))) errors.push("Traffic-activation authorization identifiers are invalid.");
  if (!TRAFFIC_ACTIVATION_KEY_PURPOSES.slice(0, 2).includes(purpose) || authorization.duty !== purpose) errors.push("Traffic-activation authorization duty is invalid.");
  if (!finiteDate(authorization.issuedAt) || !finiteDate(authorization.expiresAt) || Date.parse(authorization.expiresAt) <= Date.parse(authorization.issuedAt)) errors.push("Traffic-activation authorization validity window is invalid.");
  if (challenge && (authorization.challengeId !== challenge.challengeId || authorization.candidateId !== challenge.candidateId || authorization.registryFingerprint !== challenge.registryFingerprint || authorization.releaseGateFingerprint !== challenge.releaseGateFingerprint)) errors.push("Traffic-activation authorization does not match its challenge.");
  if (challenge && (Date.parse(authorization.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(authorization.issuedAt) > Date.parse(challenge.expiresAt) || Date.parse(authorization.expiresAt) > Date.parse(challenge.expiresAt))) errors.push("Traffic-activation authorization falls outside the challenge window.");
  const nowMs = Date.parse(now);
  if (finiteDate(authorization.issuedAt) && Date.parse(authorization.issuedAt) > nowMs + CLOCK_SKEW_MS) errors.push("Traffic-activation authorization issuedAt is in the future.");
  if (finiteDate(authorization.expiresAt) && nowMs > Date.parse(authorization.expiresAt)) errors.push("Traffic-activation authorization has expired.");
  if (registry && authorization.registryFingerprint !== trafficActivationRegistryFingerprint(registry)) errors.push("Traffic-activation authorization registry fingerprint is stale.");
  if (Buffer.byteLength(JSON.stringify(authorization)) > MAX_RECEIPT_BYTES) errors.push("Traffic-activation authorization exceeds the 64 KB metadata limit.");
  replayErrors(authorization, "authorizationId", "Traffic-activation authorization", seenReceiptIds, seenSignatureHashes, errors);
  validateContentBoundary(authorization.contentBoundary, "Traffic-activation authorization contentBoundary", errors);
  validateSignature(authorization.signature, authorization.keyId, "Traffic-activation authorization", errors);
  const key = validateRegistryKey({ registry, keyId: authorization.keyId, purpose, candidateId: authorization.candidateId, at: authorization.issuedAt, label: "Traffic-activation authorization", errors });
  if (exactKeys(authorization.activationWindow, ["notBefore", "notAfter"], "Traffic-activation authorization activationWindow", errors)) {
    const duration = Date.parse(authorization.activationWindow.notAfter) - Date.parse(authorization.activationWindow.notBefore);
    if (!finiteDate(authorization.activationWindow.notBefore) || !finiteDate(authorization.activationWindow.notAfter) || duration <= 0 || duration > MAX_ACTIVATION_WINDOW_MS || Date.parse(authorization.activationWindow.notBefore) < Date.parse(authorization.issuedAt) - CLOCK_SKEW_MS) errors.push("Traffic-activation window must be valid, no longer than four hours, and no earlier than the authorization.");
  }
  if (exactKeys(authorization.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "Traffic-activation authorization deployment", errors)) {
    if (authorization.deployment.environmentId !== "eqpass-azure-pilot" || !SAFE_REF.test(String(authorization.deployment.tenantRef || "")) || !SAFE_REF.test(String(authorization.deployment.releaseId || "")) || !HEX_64.test(String(authorization.deployment.artifactDigest || "")) || !HEX_64.test(String(authorization.deployment.configurationDigest || ""))) errors.push("Traffic-activation deployment metadata is invalid.");
  }
  if (exactKeys(authorization.endpointBindings, ["connectionProfileRef", "endpointIdentityFingerprint", "rolePolicyFingerprint", "tenantIsolationFingerprint"], "Traffic-activation authorization endpointBindings", errors)) {
    if (!SAFE_REF.test(String(authorization.endpointBindings.connectionProfileRef || "")) || ["endpointIdentityFingerprint", "rolePolicyFingerprint", "tenantIsolationFingerprint"].some(field => !HEX_64.test(String(authorization.endpointBindings[field] || "")))) errors.push("Traffic-activation endpoint bindings are invalid.");
  }
  const controlKeys = ["releaseEvidence", "clinicalStopAuthority", "monitoring", "backup", "incidentRoutes", "rollback", "identityAccess", "minimumNecessary"];
  if (exactKeys(authorization.controlReferences, controlKeys, "Traffic-activation authorization controlReferences", errors) && controlKeys.some(field => !HEX_64.test(String(authorization.controlReferences[field] || "")))) errors.push("Traffic-activation control references must be SHA-256 fingerprints.");
  if (exactKeys(authorization.authorityState, ["externalTrafficActivationAuthorized", "perlSandboxControlsTraffic", "perlSandboxReceivesPatientRecords", "autonomousClinicalDecisionAllowed"], "Traffic-activation authorization authorityState", errors)) {
    if (authorization.authorityState.externalTrafficActivationAuthorized !== true || authorization.authorityState.perlSandboxControlsTraffic !== false || authorization.authorityState.perlSandboxReceivesPatientRecords !== false || authorization.authorityState.autonomousClinicalDecisionAllowed !== false) errors.push("Traffic-activation authority must remain external to the PERL sandbox and autonomous care decisions must remain false.");
  }
  if (key) {
    try { if (!verifySignature(null, Buffer.from(trafficActivationAuthorizationSigningPayload(authorization)), createPublicKey(key.publicKeyPem), Buffer.from(authorization.signature.value, "base64url"))) errors.push("Traffic-activation authorization signature is invalid."); }
    catch { errors.push("Traffic-activation authorization signature could not be verified."); }
  }
  return [...new Set(errors)];
}

export function firstGovernedTransactionSigningPayload(attestation) {
  const { signature: _signature, ...payload } = attestation || {};
  return canonicalTrafficActivationJson(payload);
}

export function validateFirstGovernedTransactionAttestation(attestation, { challenge, clinicalAuthorization, operationsAuthorization, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "candidateId", "registryFingerprint", "keyId", "attestationId", "clinicalAuthorizationFingerprint", "operationsAuthorizationFingerprint", "activationPlanFingerprint", "observedAt", "deployment", "transactionReferences", "controlChecks", "transactionState", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "First-governed-transaction attestation", errors)) return errors;
  if (attestation.contractVersion !== FIRST_GOVERNED_TRANSACTION_CONTRACT) errors.push(`First-governed-transaction attestation contractVersion must be ${FIRST_GOVERNED_TRANSACTION_CONTRACT}.`);
  if (!ATTESTATION_ID.test(String(attestation.attestationId || "")) || !KEY_ID.test(String(attestation.keyId || ""))) errors.push("First-governed-transaction attestation identifiers are invalid.");
  if (![attestation.clinicalAuthorizationFingerprint, attestation.operationsAuthorizationFingerprint, attestation.activationPlanFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("First-governed-transaction authority fingerprints must be SHA-256 values.");
  if (!finiteDate(attestation.observedAt) || Date.parse(attestation.observedAt) > Date.parse(now) + CLOCK_SKEW_MS) errors.push("First-governed-transaction observedAt is invalid or in the future.");
  if (challenge && (attestation.challengeId !== challenge.challengeId || attestation.candidateId !== challenge.candidateId || attestation.registryFingerprint !== challenge.registryFingerprint)) errors.push("First-governed-transaction attestation does not match its challenge.");
  if (registry && attestation.registryFingerprint !== trafficActivationRegistryFingerprint(registry)) errors.push("First-governed-transaction registry fingerprint is stale.");
  if (Buffer.byteLength(JSON.stringify(attestation)) > MAX_RECEIPT_BYTES) errors.push("First-governed-transaction attestation exceeds the 64 KB metadata limit.");
  replayErrors(attestation, "attestationId", "First-governed-transaction attestation", seenReceiptIds, seenSignatureHashes, errors);
  validateContentBoundary(attestation.contentBoundary, "First-governed-transaction attestation contentBoundary", errors);
  validateSignature(attestation.signature, attestation.keyId, "First-governed-transaction attestation", errors);
  const key = validateRegistryKey({ registry, keyId: attestation.keyId, purpose: "first-governed-transaction-attestation", candidateId: attestation.candidateId, at: attestation.observedAt, label: "First-governed-transaction attestation", errors });
  const clinicalFingerprint = clinicalAuthorization ? digest(clinicalAuthorization) : null;
  const operationsFingerprint = operationsAuthorization ? digest(operationsAuthorization) : null;
  if (clinicalAuthorization && operationsAuthorization) {
    const clinicalPlan = trafficActivationPlanFingerprint(clinicalAuthorization);
    const operationsPlan = trafficActivationPlanFingerprint(operationsAuthorization);
    if (clinicalPlan !== operationsPlan) errors.push("Activation authorities did not authorize the same plan.");
    if (attestation.clinicalAuthorizationFingerprint !== clinicalFingerprint || attestation.operationsAuthorizationFingerprint !== operationsFingerprint || attestation.activationPlanFingerprint !== clinicalPlan) errors.push("First-governed-transaction attestation does not match both activation authorities.");
    if (Date.parse(attestation.observedAt) < Date.parse(clinicalAuthorization.activationWindow.notBefore) || Date.parse(attestation.observedAt) > Date.parse(clinicalAuthorization.activationWindow.notAfter)) errors.push("First governed transaction falls outside the dual-authorized activation window.");
    if (canonicalTrafficActivationJson(attestation.deployment) !== canonicalTrafficActivationJson(clinicalAuthorization.deployment)) errors.push("First-governed-transaction deployment does not match the authorized deployment.");
  }
  if (exactKeys(attestation.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "First-governed-transaction deployment", errors)) {
    if (attestation.deployment.environmentId !== "eqpass-azure-pilot" || !SAFE_REF.test(String(attestation.deployment.tenantRef || "")) || !SAFE_REF.test(String(attestation.deployment.releaseId || "")) || !HEX_64.test(String(attestation.deployment.artifactDigest || "")) || !HEX_64.test(String(attestation.deployment.configurationDigest || ""))) errors.push("First-governed-transaction deployment metadata is invalid.");
  }
  const referenceKeys = ["sourceEventReceipt", "findingsReport", "summaryArtifact", "remoteAcknowledgement", "auditRecord"];
  if (exactKeys(attestation.transactionReferences, referenceKeys, "First-governed-transaction transactionReferences", errors) && referenceKeys.some(field => !HEX_64.test(String(attestation.transactionReferences[field] || "")))) errors.push("First-governed-transaction references must be SHA-256 fingerprints.");
  const checkKeys = ["authenticatedRole", "namedSiteScope", "minimumNecessary", "scoringUpstream", "findingsUnchanged", "humanReviewCompleted", "criticalRoutingVerified", "remoteAttachmentAcknowledged", "auditCommitted"];
  if (exactKeys(attestation.controlChecks, checkKeys, "First-governed-transaction controlChecks", errors)) for (const field of checkKeys) if (attestation.controlChecks[field] !== true) errors.push(`First-governed-transaction controlChecks.${field} must be true.`);
  if (exactKeys(attestation.transactionState, ["externalClinicalTrafficObserved", "firstGovernedTransactionObserved", "safetyDisposition", "perlSandboxReceivedRecord", "perlSandboxStoredPhi", "autonomousClinicalDecision"], "First-governed-transaction transactionState", errors)) {
    if (attestation.transactionState.externalClinicalTrafficObserved !== true || attestation.transactionState.firstGovernedTransactionObserved !== true || !["routine-review", "clinical-hold"].includes(attestation.transactionState.safetyDisposition) || attestation.transactionState.perlSandboxReceivedRecord !== false || attestation.transactionState.perlSandboxStoredPhi !== false || attestation.transactionState.autonomousClinicalDecision !== false) errors.push("First-governed-transaction state must record an external governed observation without patient content, PHI, or autonomous care in the sandbox.");
  }
  if (key) {
    try { if (!verifySignature(null, Buffer.from(firstGovernedTransactionSigningPayload(attestation)), createPublicKey(key.publicKeyPem), Buffer.from(attestation.signature.value, "base64url"))) errors.push("First-governed-transaction attestation signature is invalid."); }
    catch { errors.push("First-governed-transaction attestation signature could not be verified."); }
  }
  return [...new Set(errors)];
}

function createAuthorizationEvent({ eventType, authorization, registry, actor, sequence, previousHash, verifiedAt, state, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === authorization.keyId);
  const core = {
    id, sequence, previousHash, eventType, contractVersion: TRAFFIC_ACTIVATION_CONTRACT,
    authorization: clone(authorization), authorizationFingerprint: digest(authorization), activationPlanFingerprint: trafficActivationPlanFingerprint(authorization), keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actor, createdAt: verifiedAt, ...state, perlSandboxTrafficEnabled: false, perlSandboxPatientRecordsProcessed: false, phiStored: false, boundary: TRAFFIC_ACTIVATION_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function createClinicalTrafficAuthorizationEvent(args) {
  return createAuthorizationEvent({ ...args, eventType: "traffic-activation-clinical-authorized", state: { clinicalActivationConcurrenceVerified: true, operationsActivationConcurrenceVerified: false, externalTrafficActivationAuthorized: false, firstGovernedTransactionVerified: false } });
}

export function createOperationsTrafficAuthorizationEvent(args) {
  return createAuthorizationEvent({ ...args, eventType: "traffic-activation-operations-authorized", state: { clinicalActivationConcurrenceVerified: true, operationsActivationConcurrenceVerified: true, externalTrafficActivationAuthorized: true, firstGovernedTransactionVerified: false } });
}

export function createFirstGovernedTransactionEvent({ attestation, registry, actor, sequence, previousHash, verifiedAt, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === attestation.keyId);
  const core = {
    id, sequence, previousHash, eventType: "first-governed-transaction-attested", contractVersion: TRAFFIC_ACTIVATION_CONTRACT,
    attestation: clone(attestation), attestationFingerprint: digest(attestation), keyFingerprint: publicKeyFingerprint(key.publicKeyPem), actor, createdAt: verifiedAt,
    clinicalActivationConcurrenceVerified: true, operationsActivationConcurrenceVerified: true, externalTrafficActivationAuthorized: true,
    firstGovernedTransactionVerified: true, perlSandboxTrafficEnabled: false, perlSandboxPatientRecordsProcessed: false, phiStored: false,
    boundary: TRAFFIC_ACTIVATION_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateTrafficActivationEvent(event, { sequence, previousHash, registry, challenge, clinicalAuthorization, operationsAuthorization, now = event?.createdAt || new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Traffic-activation event is required."];
  const { hash, ...core } = event;
  const common = ["id", "sequence", "previousHash", "eventType", "contractVersion", "actor", "createdAt", "clinicalActivationConcurrenceVerified", "operationsActivationConcurrenceVerified", "externalTrafficActivationAuthorized", "firstGovernedTransactionVerified", "perlSandboxTrafficEnabled", "perlSandboxPatientRecordsProcessed", "phiStored", "boundary"];
  if (event.eventType === "traffic-activation-challenge-issued") exactKeys(core, [...common.slice(0, 5), "challenge", ...common.slice(5)], "Traffic-activation event", errors);
  else if (["traffic-activation-clinical-authorized", "traffic-activation-operations-authorized"].includes(event.eventType)) exactKeys(core, [...common.slice(0, 5), "authorization", "authorizationFingerprint", "activationPlanFingerprint", "keyFingerprint", ...common.slice(5)], "Traffic-activation event", errors);
  else if (event.eventType === "first-governed-transaction-attested") exactKeys(core, [...common.slice(0, 5), "attestation", "attestationFingerprint", "keyFingerprint", ...common.slice(5)], "Traffic-activation event", errors);
  else errors.push("Traffic-activation event type is invalid.");
  if (event.contractVersion !== TRAFFIC_ACTIVATION_CONTRACT || event.sequence !== sequence || event.previousHash !== previousHash || !finiteDate(event.createdAt) || typeof event.actor !== "string" || event.actor.length < 2 || event.actor.length > 80) errors.push("Traffic-activation event metadata is invalid.");
  if (event.perlSandboxTrafficEnabled !== false || event.perlSandboxPatientRecordsProcessed !== false || event.phiStored !== false || event.boundary !== TRAFFIC_ACTIVATION_BOUNDARY) errors.push("Traffic-activation event violates the sandbox boundary.");
  if (event.eventType === "traffic-activation-challenge-issued") {
    errors.push(...validateTrafficActivationChallenge(event.challenge));
    if ([event.clinicalActivationConcurrenceVerified, event.operationsActivationConcurrenceVerified, event.externalTrafficActivationAuthorized, event.firstGovernedTransactionVerified].some(Boolean)) errors.push("A traffic-activation challenge cannot claim authority or a transaction.");
  }
  if (event.eventType === "traffic-activation-clinical-authorized") {
    errors.push(...validateTrafficActivationAuthorization(event.authorization, { challenge, registry, purpose: "clinical-traffic-activation-clinical", now, seenReceiptIds, seenSignatureHashes }));
    if (event.authorizationFingerprint !== digest(event.authorization) || event.activationPlanFingerprint !== trafficActivationPlanFingerprint(event.authorization) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Clinical activation authorization evidence is inconsistent.");
    if (!event.clinicalActivationConcurrenceVerified || event.operationsActivationConcurrenceVerified || event.externalTrafficActivationAuthorized || event.firstGovernedTransactionVerified) errors.push("Clinical activation event state is invalid.");
  }
  if (event.eventType === "traffic-activation-operations-authorized") {
    errors.push(...validateTrafficActivationAuthorization(event.authorization, { challenge, registry, purpose: "clinical-traffic-activation-operations", now, seenReceiptIds, seenSignatureHashes }));
    if (clinicalAuthorization && trafficActivationPlanFingerprint(clinicalAuthorization) !== trafficActivationPlanFingerprint(event.authorization)) errors.push("Operations activation authority does not match the clinical activation plan.");
    if (event.authorizationFingerprint !== digest(event.authorization) || event.activationPlanFingerprint !== trafficActivationPlanFingerprint(event.authorization) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Operations activation authorization evidence is inconsistent.");
    if (!event.clinicalActivationConcurrenceVerified || !event.operationsActivationConcurrenceVerified || !event.externalTrafficActivationAuthorized || event.firstGovernedTransactionVerified) errors.push("Operations activation event state is invalid.");
  }
  if (event.eventType === "first-governed-transaction-attested") {
    errors.push(...validateFirstGovernedTransactionAttestation(event.attestation, { challenge, clinicalAuthorization, operationsAuthorization, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.attestationFingerprint !== digest(event.attestation) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("First-governed-transaction evidence is inconsistent.");
    if (!event.clinicalActivationConcurrenceVerified || !event.operationsActivationConcurrenceVerified || !event.externalTrafficActivationAuthorized || !event.firstGovernedTransactionVerified) errors.push("First-governed-transaction event state is invalid.");
  }
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Traffic-activation event hash is invalid.");
  return [...new Set(errors)];
}

export function buildTrafficActivationWitness({ clinicalRelease, continuity, registry, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizeTrafficActivationRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const candidates = (clinicalRelease?.candidates || []).map(releaseCandidate => {
    const candidateId = releaseCandidate.candidate.id;
    const releaseProof = {
      gateFingerprint: clinicalRelease.gateFingerprint,
      chainHead: clinicalRelease.chain?.head,
      clinicalAuthorizationFingerprint: releaseCandidate.clinicalAuthorization ? digest(releaseCandidate.clinicalAuthorization) : null,
      productionAuthorizationFingerprint: releaseCandidate.productionAuthorization ? digest(releaseCandidate.productionAuthorization) : null,
      deploymentAttestationFingerprint: releaseCandidate.deploymentAttestation ? digest(releaseCandidate.deploymentAttestation) : null
    };
    const activeKeys = registry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter));
    const separationReady = TRAFFIC_ACTIVATION_KEY_PURPOSES.every(purpose => activeKeys.some(key => key.purpose === purpose)) && new Set(activeKeys.map(key => publicKeyFingerprint(key.publicKeyPem))).size >= 3;
    const challenges = events.filter(event => event.eventType === "traffic-activation-challenge-issued" && event.challenge.candidateId === candidateId);
    const boundChallenges = challenges.filter(event => releaseCandidate.releaseReadyForTrafficActivation && event.challenge.dossierFingerprint === releaseCandidate.dossierFingerprint && event.challenge.releaseGateFingerprint === releaseProof.gateFingerprint && event.challenge.releaseChainHead === releaseProof.chainHead && event.challenge.clinicalAuthorizationFingerprint === releaseProof.clinicalAuthorizationFingerprint && event.challenge.productionAuthorizationFingerprint === releaseProof.productionAuthorizationFingerprint && event.challenge.deploymentAttestationFingerprint === releaseProof.deploymentAttestationFingerprint && event.challenge.continuityFingerprint === continuity.continuityFingerprint && event.challenge.registryFingerprint === registrySummary.registryFingerprint);
    const challengeIds = new Set(boundChallenges.map(event => event.challenge.challengeId));
    const clinicalEvents = events.filter(event => event.eventType === "traffic-activation-clinical-authorized" && event.authorization.candidateId === candidateId && challengeIds.has(event.authorization.challengeId));
    const operationsEvents = events.filter(event => event.eventType === "traffic-activation-operations-authorized" && event.authorization.candidateId === candidateId && challengeIds.has(event.authorization.challengeId));
    const attestationEvents = events.filter(event => event.eventType === "first-governed-transaction-attested" && event.attestation.candidateId === candidateId && challengeIds.has(event.attestation.challengeId));
    const latestChallenge = boundChallenges.filter(event => now <= Date.parse(event.challenge.expiresAt)).at(-1) || null;
    const latestClinical = clinicalEvents.at(-1) || null;
    const latestOperations = latestClinical ? [...operationsEvents].reverse().find(event => event.authorization.challengeId === latestClinical.authorization.challengeId && event.activationPlanFingerprint === latestClinical.activationPlanFingerprint) || null : null;
    const latestAttestation = latestOperations ? [...attestationEvents].reverse().find(event => event.attestation.clinicalAuthorizationFingerprint === latestClinical.authorizationFingerprint && event.attestation.operationsAuthorizationFingerprint === latestOperations.authorizationFingerprint) || null : null;
    const windowCurrent = latestClinical ? Date.parse(latestClinical.authorization.activationWindow.notBefore) <= now && now <= Date.parse(latestClinical.authorization.activationWindow.notAfter) : false;
    let status = "clinical-release-required";
    if (releaseCandidate.releaseReadyForTrafficActivation) status = registrySummary.registryCurrent && separationReady ? "traffic-activation-challenge-required" : "traffic-witness-registry-required";
    if (latestChallenge) status = "clinical-activation-concurrence-required";
    if (latestClinical) status = "operations-activation-concurrence-required";
    if (latestOperations) status = windowCurrent ? "first-transaction-attestation-required" : "activation-window-expired";
    if (latestAttestation) status = "first-governed-transaction-verified";
    return {
      candidate: clone(releaseCandidate.candidate),
      dossierFingerprint: releaseCandidate.dossierFingerprint,
      releaseReadyForTrafficActivation: releaseCandidate.releaseReadyForTrafficActivation,
      releaseProof,
      separationReady,
      status,
      activeChallenge: latestChallenge?.challenge || null,
      clinicalAuthorization: latestClinical?.authorization || null,
      operationsAuthorization: latestOperations?.authorization || null,
      firstTransactionAttestation: latestAttestation?.attestation || null,
      activationWindowCurrent: windowCurrent,
      clinicalActivationConcurrenceVerified: Boolean(latestClinical),
      operationsActivationConcurrenceVerified: Boolean(latestOperations),
      externalTrafficActivationAuthorized: Boolean(latestOperations),
      externalClinicalTrafficObserved: Boolean(latestAttestation),
      firstGovernedTransactionVerified: Boolean(latestAttestation),
      perlSandboxTrafficEnabled: false,
      perlSandboxPatientRecordsProcessed: false,
      phiStored: false
    };
  });
  const witnessFingerprint = digest({ contractVersion: TRAFFIC_ACTIVATION_CONTRACT, releaseGateFingerprint: clinicalRelease?.gateFingerprint || null, releaseChainHead: clinicalRelease?.chain?.head || null, continuityFingerprint: continuity?.continuityFingerprint || null, registryFingerprint: registrySummary.registryFingerprint, eventHead: chain.head || "GENESIS" });
  return {
    contractVersion: TRAFFIC_ACTIVATION_CONTRACT,
    registryContractVersion: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
    challengeContractVersion: TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT,
    authorizationContractVersion: TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
    firstTransactionContractVersion: FIRST_GOVERNED_TRANSACTION_CONTRACT,
    status: candidates.some(candidate => candidate.firstGovernedTransactionVerified) ? "first-governed-transaction-verified" : registrySummary.registryCurrent ? "traffic-activation-witness-armed" : "traffic-witness-registry-required",
    headline: "The switch lives elsewhere. The witness stays here.",
    subhead: "Two authorities concur. One observer verifies the first governed transaction. PERL never becomes the switch.",
    registry: registrySummary,
    continuity: clone(continuity),
    candidates,
    counts: {
      trustedKeys: registrySummary.trustedKeys.length,
      challengesIssued: events.filter(event => event.eventType === "traffic-activation-challenge-issued").length,
      clinicalConcurrences: events.filter(event => event.eventType === "traffic-activation-clinical-authorized").length,
      operationsConcurrences: events.filter(event => event.eventType === "traffic-activation-operations-authorized").length,
      firstTransactionsVerified: events.filter(event => event.eventType === "first-governed-transaction-attested").length
    },
    witnessFingerprint,
    history: clone(events),
    chain: clone(chain),
    generatedAt,
    registryWriteApiAvailable: false,
    trafficControlApiAvailable: false,
    endpointConfigurationApiAvailable: false,
    patientRecordApiAvailable: false,
    externalTrafficActivationAuthorized: candidates.some(candidate => candidate.externalTrafficActivationAuthorized),
    externalClinicalTrafficObserved: candidates.some(candidate => candidate.externalClinicalTrafficObserved),
    firstGovernedTransactionVerified: candidates.some(candidate => candidate.firstGovernedTransactionVerified),
    perlSandboxTrafficEnabled: false,
    perlSandboxPatientRecordsProcessed: false,
    phiStored: false,
    boundary: TRAFFIC_ACTIVATION_BOUNDARY
  };
}
