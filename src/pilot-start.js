import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const PILOT_START_CONTRACT = "perl-governed-pilot-start/1.0";
export const PILOT_START_REGISTRY_CONTRACT = "perl-pilot-start-registry/1.0";
export const PILOT_START_CHALLENGE_CONTRACT = "perl-pilot-start-challenge/1.0";
export const PILOT_START_ORDER_CONTRACT = "perl-pilot-start-order/1.0";
export const PILOT_START_ACK_CONTRACT = "perl-pilot-start-acknowledgement/1.0";
export const PILOT_START_CONTINUITY_CONTRACT = "perl-pilot-start-continuity/1.0";

export const PILOT_START_BOUNDARY = "This interlock separates a bounded authority seal from a start order and separates that order from an observed deployment acknowledgement: one key orders, and a distinct purpose-bound Ed25519 key observes. Both keys are provisioned in an owner-only startup registry outside PERL. This first contract can open only a provider-preparation window with synthetic or de-identified rehearsal material; it cannot enable clinical traffic, receive patient records or Findings content, authorize patient use, start a live clinical pilot, release production, establish validation or outcomes, execute an agreement, contact a site, make a care decision, or replace e-QPASS deployment, identity, security, privacy, legal, clinical, accessibility, support, stop-authority, and incident-response controls. A verified acknowledgement means only that the exact metadata-bound preparation environment was reported started inside the signed window.";

export const PILOT_START_KEY_PURPOSES = Object.freeze(["pilot-start-order", "deployment-start-acknowledgement"]);

const CANDIDATE_IDS = Object.freeze(["north-central-counseling-center", "cooper-psych-clinic-qi"]);
const HEX_64 = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-START-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-START-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-START-CHALLENGE-[A-F0-9-]{20,80}$/;
const ORDER_ID = /^FF-START-ORDER-[A-Z0-9-]{3,80}$/;
const ACK_ID = /^FF-START-ACK-[A-Z0-9-]{3,80}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const NONCE_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const ED25519_SIGNATURE_BASE64URL = /^[A-Za-z0-9_-]{86}$/;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_RECEIPT_BYTES = 64 * 1024;
const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
const MAX_START_WINDOW_MS = 4 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const clone = value => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalPilotStartJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalPilotStartJson(value)).digest("hex");
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

export function disabledPilotStartRegistry() {
  return {
    contractVersion: PILOT_START_REGISTRY_CONTRACT,
    registryId: "FF-START-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function pilotStartRegistryTemplate() {
  return {
    contractVersion: PILOT_START_REGISTRY_CONTRACT,
    registryId: "FF-START-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: PILOT_START_KEY_PURPOSES.map((purpose, index) => ({
      keyId: `FF-START-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null,
      candidateIds: ["north-central-counseling-center"]
    })),
    provisioningBoundary: "Provision two distinct purpose-bound keys in this owner-only file outside PERL and supply its path only at server startup. There is no registry-write API."
  };
}

export function validatePilotStartRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Pilot-start registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Pilot-start registry", errors)) return errors;
  if (registry.contractVersion !== PILOT_START_REGISTRY_CONTRACT) errors.push(`Pilot-start registry contractVersion must be ${PILOT_START_REGISTRY_CONTRACT}.`);
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Pilot-start registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Pilot-start registry version is invalid.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (!Array.isArray(registry.keys)) errors.push("Pilot-start registry keys must be an array.");
  if (disabled && !allowDisabled) errors.push("Distinct start-order and deployment-acknowledgement keys are required.");
  if (disabled && (registry.registryId !== "FF-START-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty pilot-start registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Pilot-start registry dates must define a valid window.");
  if (keys.length > 16) errors.push("Pilot-start registry may contain at most 16 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Pilot-start key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter", "candidateIds"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats keyId ${key.keyId}.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    if (!PILOT_START_KEY_PURPOSES.includes(key.purpose)) errors.push(`${label} purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a valid bounded Ed25519 SPKI key.`);
    if (fingerprint && fingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material; start order and deployment acknowledgement require distinct keys.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must remain inside the registry window.`);
    if (!Array.isArray(key.candidateIds) || !key.candidateIds.length || key.candidateIds.some(id => !CANDIDATE_IDS.includes(id)) || new Set(key.candidateIds).size !== key.candidateIds.length) errors.push(`${label} candidate grants are invalid.`);
  }
  return [...new Set(errors)];
}

export function pilotStartRegistryFingerprint(registry) {
  return digest(registry);
}

export function summarizePilotStartRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validatePilotStartRegistry(registry);
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
    registryFingerprint: pilotStartRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activeOrderKeyCount: trustedKeys.filter(key => key.active && key.purpose === "pilot-start-order").length,
    activeAcknowledgementKeyCount: trustedKeys.filter(key => key.active && key.purpose === "deployment-start-acknowledgement").length,
    registryWriteApiAvailable: false
  };
}

export function buildPilotStartContinuity({ stateSchemaVersion, recovery, rollback, monitoring, incidentResponse, studyControl }) {
  const items = [recovery, rollback, monitoring, incidentResponse].map(item => ({ id: item.id, label: item.label, current: item.current === true, evidenceHash: item.evidenceHash || null }));
  const current = items.every(item => item.current && HEX_64.test(String(item.evidenceHash || ""))) && studyControl?.state === "active" && Number(studyControl?.highSeverityOpen || 0) === 0;
  const core = {
    contractVersion: PILOT_START_CONTINUITY_CONTRACT,
    stateSchemaVersion,
    items,
    studyState: studyControl?.state || "unknown",
    highSeverityOpen: Number(studyControl?.highSeverityOpen || 0),
    allCurrent: current
  };
  return { ...core, continuityFingerprint: digest(core) };
}

export function createPilotStartChallenge({ candidate, authorityBridgeFingerprint, continuity, registry, actor, sequence, previousHash, createdAt, id = randomUUID(), challengeId = `FF-START-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const challenge = {
    contractVersion: PILOT_START_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    candidateId: candidate.candidate.id,
    dossierFingerprint: candidate.dossierFingerprint,
    authorityBridgeFingerprint,
    registryFingerprint: pilotStartRegistryFingerprint(registry),
    continuityFingerprint: continuity.continuityFingerprint,
    requiredPurposeOrder: [...PILOT_START_KEY_PURPOSES],
    launchMode: "provider-preparation-only",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: contentBoundary()
  };
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "challenge-issued",
    contractVersion: PILOT_START_CONTRACT,
    challenge,
    actor,
    createdAt,
    startOrderVerified: false,
    deploymentStartAcknowledged: false,
    providerPreparationStarted: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: PILOT_START_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validatePilotStartChallenge(challenge, { candidate, authorityBridgeFingerprint, registryFingerprint, continuityFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "candidateId", "dossierFingerprint", "authorityBridgeFingerprint", "registryFingerprint", "continuityFingerprint", "requiredPurposeOrder", "launchMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Pilot-start challenge", errors)) return errors;
  if (challenge.contractVersion !== PILOT_START_CHALLENGE_CONTRACT) errors.push(`Pilot-start challenge contractVersion must be ${PILOT_START_CHALLENGE_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(challenge.challengeId || ""))) errors.push("Pilot-start challenge ID is invalid.");
  if (!NONCE_BASE64URL.test(String(challenge.nonce || ""))) errors.push("Pilot-start challenge nonce must encode exactly 256 random bits.");
  if (!CANDIDATE_IDS.includes(challenge.candidateId)) errors.push("Pilot-start challenge candidate is invalid.");
  if (![challenge.dossierFingerprint, challenge.authorityBridgeFingerprint, challenge.registryFingerprint, challenge.continuityFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("Pilot-start challenge fingerprints are invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Pilot-start challenge must use the exact 15-minute window.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(PILOT_START_KEY_PURPOSES)) errors.push("Pilot-start challenge purpose order is invalid.");
  if (challenge.launchMode !== "provider-preparation-only") errors.push("Pilot-start challenge may open only provider preparation.");
  if (candidate && (challenge.candidateId !== candidate.candidate.id || challenge.dossierFingerprint !== candidate.dossierFingerprint)) errors.push("Pilot-start challenge does not match the current authority candidate.");
  if (authorityBridgeFingerprint && challenge.authorityBridgeFingerprint !== authorityBridgeFingerprint) errors.push("Pilot-start challenge does not match the current authority bridge.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Pilot-start challenge does not match the current pilot-start registry.");
  if (continuityFingerprint && challenge.continuityFingerprint !== continuityFingerprint) errors.push("Pilot-start challenge does not match current continuity evidence.");
  validateContentBoundary(challenge.contentBoundary, "Pilot-start challenge contentBoundary", errors);
  return [...new Set(errors)];
}

function validateSignature(signature, keyId, label, errors) {
  if (!exactKeys(signature, ["algorithm", "keyId", "value"], `${label} signature`, errors)) return;
  if (signature.algorithm !== "Ed25519" || signature.keyId !== keyId || !ED25519_SIGNATURE_BASE64URL.test(String(signature.value || ""))) errors.push(`${label} signature metadata is invalid.`);
}

function validateRegistryAndKey({ registry, keyId, purpose, candidateId, issuedAt, expiresAt, now, label, errors }) {
  const registryErrors = registry ? validatePilotStartRegistry(registry, { allowDisabled: false }) : ["Pilot-start registry is unavailable."];
  if (registryErrors.length) errors.push(...registryErrors);
  const key = registry?.keys?.find(item => item.keyId === keyId);
  if (!key) errors.push(`${label} key is not in the startup registry.`);
  const nowMs = Date.parse(now);
  if (registry && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || nowMs < Date.parse(registry.issuedAt) || nowMs > Date.parse(registry.expiresAt))) errors.push("Pilot-start registry is outside its validity window.");
  if (registry && finiteDate(issuedAt) && finiteDate(expiresAt) && (Date.parse(issuedAt) < Date.parse(registry.issuedAt) || Date.parse(expiresAt) > Date.parse(registry.expiresAt))) errors.push(`${label} falls outside the registry window.`);
  if (key) {
    if (key.purpose !== purpose) errors.push(`${label} key is not granted to purpose ${purpose}.`);
    if (!key.candidateIds.includes(candidateId)) errors.push(`${label} key is not granted to this candidate.`);
    if (Date.parse(issuedAt) < Date.parse(key.notBefore) || Date.parse(issuedAt) > Date.parse(key.notAfter) || nowMs > Date.parse(key.notAfter)) errors.push(`${label} key is outside its validity window.`);
  }
  return key;
}

export function pilotStartOrderSigningPayload(order) {
  const { signature: _signature, ...payload } = order || {};
  return canonicalPilotStartJson(payload);
}

export function validatePilotStartOrder(order, { challenge, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(order ?? null)) > MAX_RECEIPT_BYTES) errors.push("Pilot-start order exceeds the 64 KB metadata limit.");
  const keys = ["contractVersion", "challengeId", "candidateId", "dossierFingerprint", "authorityBridgeFingerprint", "registryFingerprint", "continuityFingerprint", "keyId", "orderId", "issuedAt", "expiresAt", "startWindow", "deployment", "operatingConditions", "contentBoundary", "signature"];
  if (!exactKeys(order, keys, "Pilot-start order", errors)) return errors;
  if (order.contractVersion !== PILOT_START_ORDER_CONTRACT) errors.push(`Pilot-start order contractVersion must be ${PILOT_START_ORDER_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(order.challengeId || "")) || !ORDER_ID.test(String(order.orderId || "")) || !KEY_ID.test(String(order.keyId || ""))) errors.push("Pilot-start order identifiers are invalid.");
  if (![order.dossierFingerprint, order.authorityBridgeFingerprint, order.registryFingerprint, order.continuityFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("Pilot-start order fingerprints are invalid.");
  if (!finiteDate(order.issuedAt) || !finiteDate(order.expiresAt) || Date.parse(order.expiresAt) <= Date.parse(order.issuedAt)) errors.push("Pilot-start order validity window is invalid.");
  if (exactKeys(order.startWindow, ["notBefore", "notAfter"], "Pilot-start order startWindow", errors)) {
    if (!finiteDate(order.startWindow.notBefore) || !finiteDate(order.startWindow.notAfter) || Date.parse(order.startWindow.notAfter) <= Date.parse(order.startWindow.notBefore) || Date.parse(order.startWindow.notAfter) - Date.parse(order.startWindow.notBefore) > MAX_START_WINDOW_MS) errors.push("Pilot-start window must be valid and no longer than four hours.");
    if (finiteDate(order.issuedAt) && finiteDate(order.expiresAt) && finiteDate(order.startWindow.notBefore) && finiteDate(order.startWindow.notAfter) && (Date.parse(order.startWindow.notBefore) < Date.parse(order.issuedAt) - CLOCK_SKEW_MS || Date.parse(order.startWindow.notAfter) > Date.parse(order.expiresAt))) errors.push("Pilot-start window must remain inside the signed order window.");
  }
  if (exactKeys(order.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "Pilot-start order deployment", errors)) {
    if (order.deployment.environmentId !== "eqpass-azure-pilot" || !SAFE_REF.test(String(order.deployment.tenantRef || "")) || !SAFE_REF.test(String(order.deployment.releaseId || "")) || !HEX_64.test(String(order.deployment.artifactDigest || "")) || !HEX_64.test(String(order.deployment.configurationDigest || ""))) errors.push("Pilot-start deployment metadata is invalid.");
  }
  const conditionKeys = ["trainingAndObjectivesCompleted", "quarterlyReviewsAccepted", "stopAuthorityAssigned", "supportOwnerAssigned", "clinicalTrafficEnabled", "patientUseEnabled"];
  if (exactKeys(order.operatingConditions, conditionKeys, "Pilot-start order operatingConditions", errors)) {
    for (const key of conditionKeys.slice(0, 4)) if (order.operatingConditions[key] !== true) errors.push(`Pilot-start order operatingConditions.${key} must be true.`);
    for (const key of conditionKeys.slice(4)) if (order.operatingConditions[key] !== false) errors.push(`Pilot-start order operatingConditions.${key} must remain false.`);
  }
  validateContentBoundary(order.contentBoundary, "Pilot-start order contentBoundary", errors);
  validateSignature(order.signature, order.keyId, "Pilot-start order", errors);
  if (seenReceiptIds.has(order.orderId)) errors.push("Pilot-start order ID has already been recorded.");
  const signatureHash = digest(String(order.signature?.value || ""));
  if (seenSignatureHashes.has(signatureHash)) errors.push("Pilot-start order signature has already been recorded.");
  if (challenge) {
    if (order.challengeId !== challenge.challengeId || order.candidateId !== challenge.candidateId || order.dossierFingerprint !== challenge.dossierFingerprint || order.authorityBridgeFingerprint !== challenge.authorityBridgeFingerprint || order.registryFingerprint !== challenge.registryFingerprint || order.continuityFingerprint !== challenge.continuityFingerprint) errors.push("Pilot-start order does not match its issued challenge.");
    if (Date.parse(order.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(order.issuedAt) > Date.parse(challenge.expiresAt) || Date.parse(order.expiresAt) > Date.parse(challenge.expiresAt)) errors.push("Pilot-start order falls outside the challenge window.");
  }
  const nowMs = Date.parse(now);
  if (finiteDate(order.issuedAt) && Date.parse(order.issuedAt) > nowMs + CLOCK_SKEW_MS) errors.push("Pilot-start order issuedAt is in the future.");
  if (finiteDate(order.expiresAt) && nowMs > Date.parse(order.expiresAt)) errors.push("Pilot-start order has expired.");
  if (registry && order.registryFingerprint !== pilotStartRegistryFingerprint(registry)) errors.push("Pilot-start order registry fingerprint is stale.");
  const key = validateRegistryAndKey({ registry, keyId: order.keyId, purpose: "pilot-start-order", candidateId: order.candidateId, issuedAt: order.issuedAt, expiresAt: order.expiresAt, now, label: "Pilot-start order", errors });
  if (key) {
    try {
      if (!verifySignature(null, Buffer.from(pilotStartOrderSigningPayload(order)), createPublicKey(key.publicKeyPem), Buffer.from(order.signature.value, "base64url"))) errors.push("Pilot-start order signature is invalid.");
    } catch {
      errors.push("Pilot-start order signature could not be verified.");
    }
  }
  return [...new Set(errors)];
}

export function pilotStartAcknowledgementSigningPayload(acknowledgement) {
  const { signature: _signature, ...payload } = acknowledgement || {};
  return canonicalPilotStartJson(payload);
}

export function validatePilotStartAcknowledgement(acknowledgement, { challenge, order, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(acknowledgement ?? null)) > MAX_RECEIPT_BYTES) errors.push("Deployment-start acknowledgement exceeds the 64 KB metadata limit.");
  const keys = ["contractVersion", "challengeId", "candidateId", "registryFingerprint", "keyId", "acknowledgementId", "orderId", "orderFingerprint", "observedAt", "deployment", "status", "launchState", "contentBoundary", "signature"];
  if (!exactKeys(acknowledgement, keys, "Deployment-start acknowledgement", errors)) return errors;
  if (acknowledgement.contractVersion !== PILOT_START_ACK_CONTRACT) errors.push(`Deployment-start acknowledgement contractVersion must be ${PILOT_START_ACK_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(acknowledgement.challengeId || "")) || !ACK_ID.test(String(acknowledgement.acknowledgementId || "")) || !ORDER_ID.test(String(acknowledgement.orderId || "")) || !KEY_ID.test(String(acknowledgement.keyId || ""))) errors.push("Deployment-start acknowledgement identifiers are invalid.");
  if (!HEX_64.test(String(acknowledgement.registryFingerprint || "")) || !HEX_64.test(String(acknowledgement.orderFingerprint || ""))) errors.push("Deployment-start acknowledgement fingerprints are invalid.");
  if (!finiteDate(acknowledgement.observedAt)) errors.push("Deployment-start acknowledgement observedAt is invalid.");
  if (acknowledgement.status !== "started") errors.push("Deployment-start acknowledgement status must be started.");
  if (exactKeys(acknowledgement.deployment, ["environmentId", "tenantRef", "releaseId", "artifactDigest", "configurationDigest"], "Deployment-start acknowledgement deployment", errors) && order && canonicalPilotStartJson(acknowledgement.deployment) !== canonicalPilotStartJson(order.deployment)) errors.push("Deployment-start acknowledgement does not match the ordered deployment.");
  const stateKeys = ["providerPreparationEnvironmentStarted", "clinicalTrafficEnabled", "patientUseEnabled", "productionReleaseAuthorized"];
  if (exactKeys(acknowledgement.launchState, stateKeys, "Deployment-start acknowledgement launchState", errors)) {
    if (acknowledgement.launchState.providerPreparationEnvironmentStarted !== true) errors.push("Provider-preparation environment start must be observed.");
    for (const key of stateKeys.slice(1)) if (acknowledgement.launchState[key] !== false) errors.push(`Deployment-start acknowledgement launchState.${key} must remain false.`);
  }
  validateContentBoundary(acknowledgement.contentBoundary, "Deployment-start acknowledgement contentBoundary", errors);
  validateSignature(acknowledgement.signature, acknowledgement.keyId, "Deployment-start acknowledgement", errors);
  if (seenReceiptIds.has(acknowledgement.acknowledgementId)) errors.push("Deployment-start acknowledgement ID has already been recorded.");
  const signatureHash = digest(String(acknowledgement.signature?.value || ""));
  if (seenSignatureHashes.has(signatureHash)) errors.push("Deployment-start acknowledgement signature has already been recorded.");
  if (order) {
    if (acknowledgement.challengeId !== order.challengeId || acknowledgement.candidateId !== order.candidateId || acknowledgement.registryFingerprint !== order.registryFingerprint || acknowledgement.orderId !== order.orderId || acknowledgement.orderFingerprint !== digest(order)) errors.push("Deployment-start acknowledgement does not match its verified order.");
    if (acknowledgement.keyId === order.keyId) errors.push("Deployment-start acknowledgement must use a key distinct from the start-order key.");
    if (finiteDate(acknowledgement.observedAt) && (Date.parse(acknowledgement.observedAt) < Date.parse(order.startWindow.notBefore) || Date.parse(acknowledgement.observedAt) > Date.parse(order.startWindow.notAfter))) errors.push("Deployment-start acknowledgement falls outside the ordered start window.");
  }
  if (challenge && acknowledgement.challengeId !== challenge.challengeId) errors.push("Deployment-start acknowledgement does not match the issued challenge.");
  const nowMs = Date.parse(now);
  if (finiteDate(acknowledgement.observedAt) && Date.parse(acknowledgement.observedAt) > nowMs + CLOCK_SKEW_MS) errors.push("Deployment-start acknowledgement observedAt is in the future.");
  if (registry && acknowledgement.registryFingerprint !== pilotStartRegistryFingerprint(registry)) errors.push("Deployment-start acknowledgement registry fingerprint is stale.");
  const key = validateRegistryAndKey({ registry, keyId: acknowledgement.keyId, purpose: "deployment-start-acknowledgement", candidateId: acknowledgement.candidateId, issuedAt: acknowledgement.observedAt, expiresAt: acknowledgement.observedAt, now, label: "Deployment-start acknowledgement", errors });
  if (key) {
    try {
      if (!verifySignature(null, Buffer.from(pilotStartAcknowledgementSigningPayload(acknowledgement)), createPublicKey(key.publicKeyPem), Buffer.from(acknowledgement.signature.value, "base64url"))) errors.push("Deployment-start acknowledgement signature is invalid.");
    } catch {
      errors.push("Deployment-start acknowledgement signature could not be verified.");
    }
  }
  return [...new Set(errors)];
}

export function createPilotStartOrderEvent({ order, registry, actor, sequence, previousHash, verifiedAt, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === order.keyId);
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "start-order-verified",
    contractVersion: PILOT_START_CONTRACT,
    order: clone(order),
    orderFingerprint: digest(order),
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actor,
    createdAt: verifiedAt,
    startOrderVerified: true,
    deploymentStartAcknowledged: false,
    providerPreparationStarted: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: PILOT_START_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function createPilotStartAcknowledgementEvent({ acknowledgement, registry, actor, sequence, previousHash, verifiedAt, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === acknowledgement.keyId);
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "deployment-start-acknowledged",
    contractVersion: PILOT_START_CONTRACT,
    acknowledgement: clone(acknowledgement),
    acknowledgementFingerprint: digest(acknowledgement),
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actor,
    createdAt: verifiedAt,
    startOrderVerified: true,
    deploymentStartAcknowledged: true,
    providerPreparationStarted: true,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: PILOT_START_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validatePilotStartEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, order, now = event?.createdAt, seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Pilot-start event is required."];
  const { hash, ...core } = event;
  const payloadKey = event.eventType === "challenge-issued" ? "challenge" : event.eventType === "start-order-verified" ? "order" : "acknowledgement";
  const evidenceKeys = event.eventType === "challenge-issued" ? [] : [event.eventType === "start-order-verified" ? "orderFingerprint" : "acknowledgementFingerprint", "keyFingerprint"];
  exactKeys(core, ["id", "sequence", "previousHash", "eventType", "contractVersion", payloadKey, ...evidenceKeys, "actor", "createdAt", "startOrderVerified", "deploymentStartAcknowledged", "providerPreparationStarted", "pilotStarted", "productionReleaseAuthorized", "patientUseAuthorized", "boundary"], "Pilot-start event", errors);
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Pilot-start event chain position is invalid.");
  if (!["challenge-issued", "start-order-verified", "deployment-start-acknowledged"].includes(event.eventType)) errors.push("Pilot-start event type is invalid.");
  if (event.contractVersion !== PILOT_START_CONTRACT) errors.push(`Pilot-start event contractVersion must be ${PILOT_START_CONTRACT}.`);
  if (!/^[0-9a-f-]{36}$/i.test(String(event.id || "")) || !finiteDate(event.createdAt) || typeof event.actor !== "string" || event.actor.length < 2 || event.actor.length > 48) errors.push("Pilot-start event provenance is invalid.");
  if (event.boundary !== PILOT_START_BOUNDARY) errors.push("Pilot-start event boundary is invalid.");
  if (event.pilotStarted !== false || event.productionReleaseAuthorized !== false || event.patientUseAuthorized !== false) errors.push("A pilot-start event cannot start a live clinical pilot or authorize production or patient use.");
  if (event.eventType === "challenge-issued") {
    errors.push(...validatePilotStartChallenge(event.challenge));
    if (event.startOrderVerified !== false || event.deploymentStartAcknowledged !== false || event.providerPreparationStarted !== false) errors.push("A challenge cannot claim a start order or observed start.");
  }
  if (event.eventType === "start-order-verified") {
    errors.push(...validatePilotStartOrder(event.order, { challenge, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.orderFingerprint !== digest(event.order) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Pilot-start order evidence is inconsistent.");
    if (event.startOrderVerified !== true || event.deploymentStartAcknowledged !== false || event.providerPreparationStarted !== false) errors.push("Pilot-start order event state is invalid.");
  }
  if (event.eventType === "deployment-start-acknowledged") {
    errors.push(...validatePilotStartAcknowledgement(event.acknowledgement, { challenge, order, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.acknowledgementFingerprint !== digest(event.acknowledgement) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Deployment-start acknowledgement evidence is inconsistent.");
    if (event.startOrderVerified !== true || event.deploymentStartAcknowledged !== true || event.providerPreparationStarted !== true) errors.push("Deployment-start acknowledgement event state is invalid.");
  }
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Pilot-start event hash is invalid.");
  return [...new Set(errors)];
}

export function buildPilotStartControl({ authorityTrust, continuity, registry, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizePilotStartRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const candidates = (authorityTrust?.candidates || []).map(authorityCandidate => {
    const candidateId = authorityCandidate.candidate.id;
    const activeKeys = registry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter));
    const orderKeys = activeKeys.filter(key => key.purpose === "pilot-start-order");
    const ackKeys = activeKeys.filter(key => key.purpose === "deployment-start-acknowledgement");
    const separationReady = orderKeys.some(orderKey => ackKeys.some(ackKey => publicKeyFingerprint(orderKey.publicKeyPem) !== publicKeyFingerprint(ackKey.publicKeyPem)));
    const challengeEvents = events.filter(event => event.eventType === "challenge-issued" && event.challenge.candidateId === candidateId);
    const activeChallenges = challengeEvents.filter(event => event.challenge.dossierFingerprint === authorityCandidate.dossierFingerprint && event.challenge.authorityBridgeFingerprint === authorityTrust.bridgeFingerprint && event.challenge.registryFingerprint === registrySummary.registryFingerprint && event.challenge.continuityFingerprint === continuity.continuityFingerprint && now <= Date.parse(event.challenge.expiresAt));
    const orderEvents = events.filter(event => event.eventType === "start-order-verified" && event.order.candidateId === candidateId && event.order.authorityBridgeFingerprint === authorityTrust.bridgeFingerprint && event.order.continuityFingerprint === continuity.continuityFingerprint && event.order.registryFingerprint === registrySummary.registryFingerprint);
    const currentOrders = orderEvents.filter(event => now <= Date.parse(event.order.expiresAt));
    const currentOrder = currentOrders.at(-1) || null;
    const acknowledgementEvents = events.filter(event => event.eventType === "deployment-start-acknowledged" && event.acknowledgement.candidateId === candidateId);
    const currentAcknowledgement = currentOrder ? acknowledgementEvents.find(event => event.acknowledgement.orderId === currentOrder.order.orderId && event.acknowledgement.orderFingerprint === currentOrder.orderFingerprint) || null : null;
    let status = "authority-seal-required";
    if (authorityCandidate.pilotAuthorizationRecorded) status = "continuity-evidence-required";
    if (authorityCandidate.pilotAuthorizationRecorded && continuity.allCurrent) status = "start-keys-required";
    if (authorityCandidate.pilotAuthorizationRecorded && continuity.allCurrent && registrySummary.registryCurrent && separationReady) status = activeChallenges.length ? "start-order-required" : "start-challenge-required";
    if (currentOrder) status = "deployment-acknowledgement-required";
    if (currentAcknowledgement) status = "provider-preparation-started";
    return {
      candidate: clone(authorityCandidate.candidate),
      dossierFingerprint: authorityCandidate.dossierFingerprint,
      authoritySealCurrent: authorityCandidate.pilotAuthorizationRecorded === true,
      authorityScopesSatisfied: authorityCandidate.counts?.satisfiedScopes || 0,
      continuityCurrent: continuity.allCurrent,
      separationReady,
      status,
      activeChallenge: activeChallenges.at(-1)?.challenge || null,
      currentOrder: currentOrder?.order || null,
      currentAcknowledgement: currentAcknowledgement?.acknowledgement || null,
      counts: {
        activeOrderKeys: orderKeys.length,
        activeAcknowledgementKeys: ackKeys.length,
        challengesIssued: challengeEvents.length,
        ordersVerified: orderEvents.length,
        acknowledgementsVerified: acknowledgementEvents.length
      },
      startOrderVerified: Boolean(currentOrder),
      deploymentStartAcknowledged: Boolean(currentAcknowledgement),
      providerPreparationStarted: Boolean(currentAcknowledgement),
      pilotStarted: false,
      clinicalTrafficEnabled: false,
      productionReleaseAuthorized: false,
      patientUseAuthorized: false
    };
  });
  const controlFingerprint = digest({
    contractVersion: PILOT_START_CONTRACT,
    authorityBridgeFingerprint: authorityTrust?.bridgeFingerprint || null,
    continuityFingerprint: continuity?.continuityFingerprint || null,
    registryFingerprint: registrySummary.registryFingerprint,
    eventHead: chain.head || "GENESIS"
  });
  return {
    contractVersion: PILOT_START_CONTRACT,
    registryContractVersion: PILOT_START_REGISTRY_CONTRACT,
    challengeContractVersion: PILOT_START_CHALLENGE_CONTRACT,
    orderContractVersion: PILOT_START_ORDER_CONTRACT,
    acknowledgementContractVersion: PILOT_START_ACK_CONTRACT,
    status: candidates.some(candidate => candidate.providerPreparationStarted) ? "provider-preparation-started" : registrySummary.registryCurrent ? "pilot-start-interlock-armed" : "pilot-start-registry-required",
    headline: "One seal may authorize. It may not press Start.",
    subhead: "Order with one key. Observe with another. Keep clinical traffic dark.",
    registry: registrySummary,
    continuity: clone(continuity),
    candidates,
    counts: {
      trustedKeys: registrySummary.trustedKeys.length,
      activeOrderKeys: registrySummary.activeOrderKeyCount,
      activeAcknowledgementKeys: registrySummary.activeAcknowledgementKeyCount,
      challengesIssued: events.filter(event => event.eventType === "challenge-issued").length,
      ordersVerified: events.filter(event => event.eventType === "start-order-verified").length,
      acknowledgementsVerified: events.filter(event => event.eventType === "deployment-start-acknowledged").length,
      providerPreparationStarts: candidates.filter(candidate => candidate.providerPreparationStarted).length
    },
    controlFingerprint,
    history: clone(events),
    chain: clone(chain),
    generatedAt,
    launchMode: "provider-preparation-only",
    registryWriteApiAvailable: false,
    providerPreparationStarted: candidates.some(candidate => candidate.providerPreparationStarted),
    pilotStarted: false,
    clinicalTrafficEnabled: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: PILOT_START_BOUNDARY
  };
}
