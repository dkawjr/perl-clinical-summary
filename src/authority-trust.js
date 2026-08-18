import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";
import { PILOT_READINESS_GATES } from "./pilot-readiness.js";
import { ACTIVATION_REQUIRED_RETURNS } from "./provider-activation.js";
import { SITE_ADMISSION_QUESTIONS } from "./site-admission.js";

export const AUTHORITY_TRUST_CONTRACT = "perl-governed-authority-trust/1.0";
export const AUTHORITY_TRUST_REGISTRY_CONTRACT = "perl-authority-trust-registry/1.0";
export const AUTHORITY_TRUST_CHALLENGE_CONTRACT = "perl-governed-authority-challenge/1.0";
export const AUTHORITY_TRUST_RECEIPT_CONTRACT = "perl-governed-authority-receipt/1.0";

export const AUTHORITY_TRUST_BOUNDARY = "This bridge verifies only cryptographically signed, metadata-only receipts against an externally provisioned startup trust registry. PERL exposes no HTTP, browser, import, or local-state path for creating, adding, editing, approving, or trusting a key. A receipt may advance only the exact candidate and scope granted to its pinned key, while stale dossiers, stale registries, expired challenges, expired keys, duplicate receipts, replayed signatures, unknown scopes, ungranted scopes, malformed references, and invalid signatures fail closed. The bridge does not receive evidence files, human names or handwritten signatures, credentials, secrets, patient records, raw answers, Findings content, or PHI; contact a site; verify facts that are not asserted by a governed receipt; execute an agreement; start a pilot; activate a provider; release production; establish clinical validity, reliability, performance, outcomes, renewal, or expansion; authorize patient use; or make a care decision. Even a complete bounded pilot-authorization receipt records external authority only—it does not start the pilot clock or replace deployment, clinical, legal, security, accessibility, support, incident-response, and named-site operating controls.";

const freeze = value => Object.freeze(value);
const clone = value => structuredClone(value);
const HEX_64 = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-TRUST-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-TRUST-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-TRUST-CHALLENGE-[A-F0-9-]{20,80}$/;
const RECEIPT_ID = /^FF-TRUST-RECEIPT-[A-Z0-9-]{3,80}$/;
const NONCE_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const ED25519_SIGNATURE_BASE64URL = /^[A-Za-z0-9_-]{86}$/;
const MAX_RECEIPT_BYTES = 64 * 1024;
const CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_REGISTRY_BYTES = 256 * 1024;
const AUTHORITY_ROLE_IDS = freeze(["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"]);
const CANDIDATE_IDS = freeze(["north-central-counseling-center", "cooper-psych-clinic-qi"]);
const EXTERNAL_GATE_DEFINITIONS = freeze(PILOT_READINESS_GATES.filter(item => item.category === "external-authority"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalAuthorityJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalAuthorityJson(value)).digest("hex");
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

function finiteDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
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

function item(id, index, label, kind, requiredOutcome) {
  return freeze({ id, index, label, kind, scope: `${kind}:${id}`, requiredOutcome });
}

export const AUTHORITY_TRUST_SCOPE_GROUPS = freeze([
  freeze({
    id: "site",
    index: "01",
    label: "Site identity",
    thesis: "Bind the legal institution and operating unit before any local candidate context is treated as fact.",
    items: freeze([item("identity", "01", "Authenticated named site", "site", "verified")])
  }),
  freeze({
    id: "authority",
    index: "02",
    label: "Decision authority",
    thesis: "Verify each required role through a key that was provisioned outside PERL.",
    items: freeze(AUTHORITY_ROLE_IDS.map((id, index) => item(id, String(index + 1).padStart(2, "0"), id.replaceAll("-", " "), "authority", "verified")))
  }),
  freeze({
    id: "evidence",
    index: "03",
    label: "Governed evidence",
    thesis: "Record only hashes of governed references; evidence content remains in its authoritative repository.",
    items: freeze(SITE_ADMISSION_QUESTIONS.map(entry => item(entry.id, entry.index, entry.label, "evidence", "verified")))
  }),
  freeze({
    id: "gate",
    index: "04",
    label: "External gates",
    thesis: "Advance a gate only from a current, role-scoped, signed decision receipt.",
    items: freeze(EXTERNAL_GATE_DEFINITIONS.map((entry, index) => item(entry.id, String(index + 1).padStart(2, "0"), entry.label, "gate", "accepted")))
  }),
  freeze({
    id: "activation",
    index: "05",
    label: "Provider activation",
    thesis: "Training and operating readiness require governed returns, not attendance or familiarity claims.",
    items: freeze(ACTIVATION_REQUIRED_RETURNS.map(entry => item(entry.id, entry.index, entry.label, "activation", "accepted")))
  }),
  freeze({
    id: "authorization",
    index: "06",
    label: "Bounded authorization",
    thesis: "The final receipt may record a bounded external authorization; it still cannot start or release the pilot.",
    items: freeze([item("pilot", "01", "Named-site pilot authorization", "authorization", "accepted")])
  })
]);

export const AUTHORITY_TRUST_SCOPES = freeze(AUTHORITY_TRUST_SCOPE_GROUPS.flatMap(group => group.items));
const SCOPE_BY_ID = new Map(AUTHORITY_TRUST_SCOPES.map(scope => [scope.scope, scope]));

export function disabledAuthorityTrustRegistry() {
  return {
    contractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
    registryId: "FF-TRUST-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function authorityTrustRegistryTemplate() {
  return {
    contractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
    registryId: "FF-TRUST-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: [{
      keyId: "FF-TRUST-KEY-REPLACE-ME",
      algorithm: "Ed25519",
      publicKeyPem: "REPLACE WITH AN EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null,
      candidateIds: ["north-central-counseling-center"],
      scopes: AUTHORITY_TRUST_SCOPES.map(item => item.scope)
    }],
    provisioningBoundary: "Provision this owner-only file outside PERL and supply its path only at server startup. There is no registry-write API."
  };
}

export function validateAuthorityTrustRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Trust registry exceeds the 256 KB startup limit.");
  const rootKeys = ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"];
  if (!exactKeys(registry, rootKeys, "Trust registry", errors)) return errors;
  if (registry.contractVersion !== AUTHORITY_TRUST_REGISTRY_CONTRACT) errors.push(`Trust registry contractVersion must be ${AUTHORITY_TRUST_REGISTRY_CONTRACT}.`);
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Trust registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Trust registry version is invalid.");
  const keyList = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keyList.length === 0;
  if (!Array.isArray(registry.keys)) errors.push("Trust registry keys must be an array.");
  if (disabled && !allowDisabled) errors.push("At least one externally provisioned trust key is required.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Trust registry dates must define a valid window.");
  if (disabled && (registry.registryId !== "FF-TRUST-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty registry must use the disabled identity.");
  if (keyList.length > 64) errors.push("Trust registry may contain at most 64 keys.");
  const keyIds = new Set();
  const keyFingerprints = new Set();
  for (const [index, key] of keyList.entries()) {
    const label = `Trust key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "publicKeyPem", "notBefore", "notAfter", "candidateIds", "scopes"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats keyId ${key.keyId}.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a valid bounded Ed25519 SPKI key.`);
    if (fingerprint && keyFingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material.`);
    if (fingerprint) keyFingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must remain inside the registry window.`);
    if (!Array.isArray(key.candidateIds) || !key.candidateIds.length || key.candidateIds.some(id => !CANDIDATE_IDS.includes(id)) || new Set(key.candidateIds).size !== key.candidateIds.length) errors.push(`${label} candidate grants are invalid.`);
    if (!Array.isArray(key.scopes) || !key.scopes.length || key.scopes.some(scope => !SCOPE_BY_ID.has(scope)) || new Set(key.scopes).size !== key.scopes.length) errors.push(`${label} scope grants are invalid.`);
  }
  return [...new Set(errors)];
}

export function authorityTrustRegistryFingerprint(registry) {
  return digest(registry);
}

export function summarizeAuthorityTrustRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateAuthorityTrustRegistry(registry);
  if (errors.length) throw new Error(errors.join(" "));
  const now = Date.parse(generatedAt);
  const registryCurrent = registry.keys.length > 0 && Date.parse(registry.issuedAt) <= now && now <= Date.parse(registry.expiresAt);
  const keys = registry.keys.map(key => ({
    keyId: key.keyId,
    algorithm: key.algorithm,
    publicKeyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    notBefore: key.notBefore,
    notAfter: key.notAfter,
    candidateCount: key.candidateIds.length,
    scopeCount: key.scopes.length,
    active: registryCurrent && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter)
  }));
  return {
    contractVersion: registry.contractVersion,
    registryId: registry.registryId,
    version: registry.version,
    registryFingerprint: authorityTrustRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys: keys,
    activeKeyCount: keys.filter(key => key.active).length,
    registryWriteApiAvailable: false
  };
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

export function createAuthorityTrustChallenge({ dossier, portfolioFingerprint, registry, actor, sequence, previousHash, createdAt, id = randomUUID(), challengeId = `FF-TRUST-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const registrySummary = summarizeAuthorityTrustRegistry(registry, createdAt);
  const issuedAt = createdAt;
  const expiresAt = new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString();
  const challenge = {
    contractVersion: AUTHORITY_TRUST_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    candidateId: dossier.candidate.id,
    dossierFingerprint: dossier.dossierFingerprint,
    portfolioFingerprint,
    registryFingerprint: registrySummary.registryFingerprint,
    requiredScopes: AUTHORITY_TRUST_SCOPES.map(item => item.scope),
    issuedAt,
    expiresAt,
    contentBoundary: contentBoundary()
  };
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "challenge-issued",
    contractVersion: AUTHORITY_TRUST_CONTRACT,
    challenge,
    actor,
    createdAt,
    cryptographicSignatureVerified: false,
    scopeVerificationRecorded: false,
    pilotAuthorizationRecorded: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: AUTHORITY_TRUST_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateAuthorityTrustChallenge(challenge, { dossier, portfolioFingerprint, registryFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "candidateId", "dossierFingerprint", "portfolioFingerprint", "registryFingerprint", "requiredScopes", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Trust challenge", errors)) return errors;
  if (challenge.contractVersion !== AUTHORITY_TRUST_CHALLENGE_CONTRACT) errors.push(`Trust challenge contractVersion must be ${AUTHORITY_TRUST_CHALLENGE_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(challenge.challengeId || ""))) errors.push("Trust challenge ID is invalid.");
  if (!NONCE_BASE64URL.test(String(challenge.nonce || ""))) errors.push("Trust challenge nonce must encode exactly 256 random bits.");
  if (!CANDIDATE_IDS.includes(challenge.candidateId)) errors.push("Trust challenge candidate is invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Trust challenge must use the exact 24-hour window.");
  if (!HEX_64.test(String(challenge.dossierFingerprint || "")) || !HEX_64.test(String(challenge.portfolioFingerprint || "")) || !HEX_64.test(String(challenge.registryFingerprint || ""))) errors.push("Trust challenge fingerprints are invalid.");
  if (!Array.isArray(challenge.requiredScopes) || challenge.requiredScopes.length !== AUTHORITY_TRUST_SCOPES.length || challenge.requiredScopes.some((scope, index) => scope !== AUTHORITY_TRUST_SCOPES[index].scope)) errors.push("Trust challenge scopes must match the complete ordered admission contract.");
  if (dossier && (challenge.candidateId !== dossier.candidate.id || challenge.dossierFingerprint !== dossier.dossierFingerprint)) errors.push("Trust challenge does not match the current candidate dossier.");
  if (portfolioFingerprint && challenge.portfolioFingerprint !== portfolioFingerprint) errors.push("Trust challenge does not match the current admission portfolio.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Trust challenge does not match the current trust registry.");
  validateContentBoundary(challenge.contentBoundary, "Trust challenge contentBoundary", errors);
  return [...new Set(errors)];
}

function expectedOutcomes(scope) {
  return ["site", "authority", "evidence"].includes(scope.kind) ? ["verified", "rejected", "revoked"] : ["accepted", "declined", "revoked"];
}

export function authorityTrustReceiptSigningPayload(receipt) {
  const { signature: _signature, ...payload } = receipt || {};
  return canonicalAuthorityJson(payload);
}

export function validateAuthorityTrustReceipt(receipt, { challenge, registry, now = new Date().toISOString(), seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(receipt ?? null)) > MAX_RECEIPT_BYTES) errors.push("Governed trust receipt exceeds the 64 KB metadata limit.");
  const keys = ["contractVersion", "challengeId", "candidateId", "dossierFingerprint", "registryFingerprint", "keyId", "receiptId", "issuedAt", "expiresAt", "assertions", "contentBoundary", "signature"];
  if (!exactKeys(receipt, keys, "Governed trust receipt", errors)) return errors;
  if (receipt.contractVersion !== AUTHORITY_TRUST_RECEIPT_CONTRACT) errors.push(`Governed trust receipt contractVersion must be ${AUTHORITY_TRUST_RECEIPT_CONTRACT}.`);
  if (!CHALLENGE_ID.test(String(receipt.challengeId || ""))) errors.push("Governed trust receipt challengeId is invalid.");
  if (!RECEIPT_ID.test(String(receipt.receiptId || ""))) errors.push("Governed trust receipt receiptId is invalid.");
  if (!KEY_ID.test(String(receipt.keyId || ""))) errors.push("Governed trust receipt keyId is invalid.");
  if (!HEX_64.test(String(receipt.dossierFingerprint || "")) || !HEX_64.test(String(receipt.registryFingerprint || ""))) errors.push("Governed trust receipt fingerprints are invalid.");
  if (!finiteDate(receipt.issuedAt) || !finiteDate(receipt.expiresAt) || Date.parse(receipt.expiresAt) <= Date.parse(receipt.issuedAt)) errors.push("Governed trust receipt validity window is invalid.");
  validateContentBoundary(receipt.contentBoundary, "Governed trust receipt contentBoundary", errors);
  if (!Array.isArray(receipt.assertions) || receipt.assertions.length < 1 || receipt.assertions.length > AUTHORITY_TRUST_SCOPES.length) errors.push(`Governed trust receipt assertions must contain 1–${AUTHORITY_TRUST_SCOPES.length} items.`);
  const assertionScopes = new Set();
  for (const [index, assertion] of (receipt.assertions || []).entries()) {
    const label = `Governed trust assertion ${index + 1}`;
    if (!exactKeys(assertion, ["scope", "outcome", "referenceHash"], label, errors)) continue;
    const definition = SCOPE_BY_ID.get(assertion.scope);
    if (!definition) errors.push(`${label} scope is not in the admission contract.`);
    if (assertionScopes.has(assertion.scope)) errors.push(`${label} repeats scope ${assertion.scope}.`);
    assertionScopes.add(assertion.scope);
    if (definition && !expectedOutcomes(definition).includes(assertion.outcome)) errors.push(`${label} outcome is invalid for ${definition.kind}.`);
    if (!HEX_64.test(String(assertion.referenceHash || ""))) errors.push(`${label} referenceHash must be SHA-256 metadata.`);
  }
  if (!exactKeys(receipt.signature, ["algorithm", "keyId", "value"], "Governed trust receipt signature", errors)) return [...new Set(errors)];
  if (receipt.signature.algorithm !== "Ed25519" || receipt.signature.keyId !== receipt.keyId || !ED25519_SIGNATURE_BASE64URL.test(String(receipt.signature.value || ""))) errors.push("Governed trust receipt signature metadata is invalid.");
  if (seenReceiptIds.has(receipt.receiptId)) errors.push("Governed trust receipt ID has already been recorded.");
  const signatureHash = digest(String(receipt.signature.value || ""));
  if (seenSignatureHashes.has(signatureHash)) errors.push("Governed trust receipt signature has already been recorded.");
  if (challenge) {
    if (receipt.challengeId !== challenge.challengeId || receipt.candidateId !== challenge.candidateId || receipt.dossierFingerprint !== challenge.dossierFingerprint || receipt.registryFingerprint !== challenge.registryFingerprint) errors.push("Governed trust receipt does not match its issued challenge.");
    const issued = Date.parse(receipt.issuedAt);
    const expires = Date.parse(receipt.expiresAt);
    if (issued < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || issued > Date.parse(challenge.expiresAt) || expires > Date.parse(challenge.expiresAt)) errors.push("Governed trust receipt falls outside the challenge window.");
  }
  const nowMs = Date.parse(now);
  if (finiteDate(receipt.issuedAt) && Date.parse(receipt.issuedAt) > nowMs + CLOCK_SKEW_MS) errors.push("Governed trust receipt issuedAt is in the future.");
  if (finiteDate(receipt.expiresAt) && nowMs > Date.parse(receipt.expiresAt)) errors.push("Governed trust receipt has expired.");
  const registryErrors = registry ? validateAuthorityTrustRegistry(registry, { allowDisabled: false }) : ["Trust registry is unavailable."];
  if (registryErrors.length) errors.push(...registryErrors);
  const key = registry?.keys?.find(item => item.keyId === receipt.keyId);
  if (!key) errors.push("Governed trust receipt key is not in the startup registry.");
  if (registry && receipt.registryFingerprint !== authorityTrustRegistryFingerprint(registry)) errors.push("Governed trust receipt registry fingerprint is stale.");
  if (registry && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || nowMs < Date.parse(registry.issuedAt) || nowMs > Date.parse(registry.expiresAt))) errors.push("Governed trust registry is outside its validity window.");
  if (registry && finiteDate(receipt.issuedAt) && finiteDate(receipt.expiresAt) && (Date.parse(receipt.issuedAt) < Date.parse(registry.issuedAt) || Date.parse(receipt.expiresAt) > Date.parse(registry.expiresAt))) errors.push("Governed trust receipt falls outside the registry window.");
  if (key) {
    const issued = Date.parse(receipt.issuedAt);
    if (!key.candidateIds.includes(receipt.candidateId)) errors.push("Governed trust key is not granted to this candidate.");
    if ((receipt.assertions || []).some(assertion => !key.scopes.includes(assertion.scope))) errors.push("Governed trust receipt requests a scope not granted to its key.");
    if (issued < Date.parse(key.notBefore) || issued > Date.parse(key.notAfter) || nowMs > Date.parse(key.notAfter)) errors.push("Governed trust key is outside its validity window.");
    try {
      const signature = Buffer.from(receipt.signature.value, "base64url");
      const valid = verifySignature(null, Buffer.from(authorityTrustReceiptSigningPayload(receipt)), createPublicKey(key.publicKeyPem), signature);
      if (!valid) errors.push("Governed trust receipt signature is invalid.");
    } catch {
      errors.push("Governed trust receipt signature could not be verified.");
    }
  }
  return [...new Set(errors)];
}

export function createAuthorityTrustReceiptEvent({ receipt, registry, actor, sequence, previousHash, verifiedAt, id = randomUUID() }) {
  const key = registry.keys.find(item => item.keyId === receipt.keyId);
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "receipt-verified",
    contractVersion: AUTHORITY_TRUST_CONTRACT,
    receipt: clone(receipt),
    receiptFingerprint: digest(receipt),
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    assertionCount: receipt.assertions.length,
    actor,
    createdAt: verifiedAt,
    cryptographicSignatureVerified: true,
    scopeVerificationRecorded: true,
    pilotAuthorizationRecorded: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: AUTHORITY_TRUST_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateAuthorityTrustEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, now = event?.createdAt, seenReceiptIds = new Set(), seenSignatureHashes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Authority-trust event is required."];
  const { hash, ...core } = event;
  const commonKeys = ["id", "sequence", "previousHash", "eventType", "contractVersion", event.eventType === "challenge-issued" ? "challenge" : "receipt", ...(event.eventType === "receipt-verified" ? ["receiptFingerprint", "keyFingerprint", "assertionCount"] : []), "actor", "createdAt", "cryptographicSignatureVerified", "scopeVerificationRecorded", "pilotAuthorizationRecorded", "pilotStarted", "productionReleaseAuthorized", "patientUseAuthorized", "boundary"];
  exactKeys(core, commonKeys, "Authority-trust event", errors);
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Authority-trust event chain position is invalid.");
  if (!["challenge-issued", "receipt-verified"].includes(event.eventType)) errors.push("Authority-trust event type is invalid.");
  if (event.contractVersion !== AUTHORITY_TRUST_CONTRACT) errors.push(`Authority-trust event contractVersion must be ${AUTHORITY_TRUST_CONTRACT}.`);
  if (!/^[0-9a-f-]{36}$/i.test(String(event.id || "")) || !finiteDate(event.createdAt) || typeof event.actor !== "string" || event.actor.length < 2 || event.actor.length > 48) errors.push("Authority-trust event provenance is invalid.");
  if (event.boundary !== AUTHORITY_TRUST_BOUNDARY) errors.push("Authority-trust event boundary is invalid.");
  if (event.pilotAuthorizationRecorded !== false || event.pilotStarted !== false || event.productionReleaseAuthorized !== false || event.patientUseAuthorized !== false) errors.push("An authority-trust event cannot start or release a pilot.");
  if (event.eventType === "challenge-issued") {
    errors.push(...validateAuthorityTrustChallenge(event.challenge));
    if (event.cryptographicSignatureVerified !== false || event.scopeVerificationRecorded !== false) errors.push("A challenge event cannot claim signature or scope verification.");
  }
  if (event.eventType === "receipt-verified") {
    errors.push(...validateAuthorityTrustReceipt(event.receipt, { challenge, registry, now, seenReceiptIds, seenSignatureHashes }));
    if (event.receiptFingerprint !== digest(event.receipt) || !HEX_64.test(String(event.keyFingerprint || "")) || event.assertionCount !== event.receipt?.assertions?.length) errors.push("Verified receipt evidence is inconsistent.");
    if (event.cryptographicSignatureVerified !== true || event.scopeVerificationRecorded !== true) errors.push("A verified receipt event must record cryptographic and scope verification.");
  }
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Authority-trust event hash is invalid.");
  return [...new Set(errors)];
}

function scopeState(scope, assertions) {
  const assertion = assertions.get(scope.scope) || null;
  return {
    ...clone(scope),
    status: assertion?.outcome || "not-returned",
    current: Boolean(assertion),
    satisfied: assertion?.outcome === scope.requiredOutcome,
    receiptId: assertion?.receiptId || null,
    keyId: assertion?.keyId || null,
    referenceHash: assertion?.referenceHash || null,
    verifiedAt: assertion?.verifiedAt || null,
    expiresAt: assertion?.expiresAt || null
  };
}

export function buildAuthorityTrustBridge({ siteAdmission, registry, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizeAuthorityTrustRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const dossiers = siteAdmission?.dossiers || [];
  const candidates = dossiers.map(dossier => {
    const challengeEvents = events.filter(event => event.eventType === "challenge-issued" && event.challenge.candidateId === dossier.candidate.id);
    const activeChallenges = challengeEvents.filter(event => event.challenge.dossierFingerprint === dossier.dossierFingerprint && event.challenge.registryFingerprint === registrySummary.registryFingerprint && now <= Date.parse(event.challenge.expiresAt));
    const assertions = new Map();
    for (const event of events) {
      if (event.eventType !== "receipt-verified") continue;
      const receipt = event.receipt;
      if (receipt.candidateId !== dossier.candidate.id || receipt.dossierFingerprint !== dossier.dossierFingerprint || receipt.registryFingerprint !== registrySummary.registryFingerprint || now > Date.parse(receipt.expiresAt)) continue;
      for (const assertion of receipt.assertions) assertions.set(assertion.scope, { ...assertion, receiptId: receipt.receiptId, keyId: receipt.keyId, verifiedAt: event.createdAt, expiresAt: receipt.expiresAt });
    }
    const groups = AUTHORITY_TRUST_SCOPE_GROUPS.map(group => {
      const items = group.items.map(scope => scopeState(scope, assertions));
      return { id: group.id, index: group.index, label: group.label, thesis: group.thesis, items, satisfied: items.filter(item => item.satisfied).length, required: items.length };
    });
    const blocked = groups.some(group => group.items.some(item => ["rejected", "declined", "revoked"].includes(item.status)));
    const allSatisfied = groups.every(group => group.satisfied === group.required);
    let status = "trust-root-required";
    if (registrySummary.registryCurrent && registrySummary.activeKeyCount > 0) status = activeChallenges.length ? "signed-receipts-required" : "challenge-required";
    if (assertions.size > 0) status = "verification-in-progress";
    if (blocked) status = "decision-blocked";
    if (allSatisfied) status = "bounded-pilot-authorization-recorded";
    return {
      candidate: clone(dossier.candidate),
      dossierFingerprint: dossier.dossierFingerprint,
      status,
      activeChallenge: activeChallenges.at(-1)?.challenge || null,
      challengeCount: challengeEvents.length,
      receiptCount: events.filter(event => event.eventType === "receipt-verified" && event.receipt.candidateId === dossier.candidate.id).length,
      groups,
      counts: {
        requiredScopes: AUTHORITY_TRUST_SCOPES.length,
        currentAssertions: assertions.size,
        satisfiedScopes: groups.reduce((sum, group) => sum + group.satisfied, 0),
        verifiedAuthorities: groups.find(group => group.id === "authority")?.satisfied || 0,
        verifiedEvidence: groups.find(group => group.id === "evidence")?.satisfied || 0,
        acceptedGates: groups.find(group => group.id === "gate")?.satisfied || 0,
        acceptedActivationReturns: groups.find(group => group.id === "activation")?.satisfied || 0
      },
      siteIdentityVerified: groups.find(group => group.id === "site")?.satisfied === 1,
      authorityVerified: groups.find(group => group.id === "authority")?.satisfied === 5,
      evidenceVerified: groups.find(group => group.id === "evidence")?.satisfied === 12,
      externalAcceptanceRecorded: (groups.find(group => group.id === "gate")?.satisfied || 0) > 0,
      pilotAuthorizationRecorded: allSatisfied,
      pilotStarted: false,
      productionReleaseAuthorized: false,
      patientUseAuthorized: false
    };
  });
  const receiptEvents = events.filter(event => event.eventType === "receipt-verified");
  const challengeEvents = events.filter(event => event.eventType === "challenge-issued");
  const bridgeFingerprint = digest({
    contractVersion: AUTHORITY_TRUST_CONTRACT,
    portfolioFingerprint: siteAdmission?.portfolioFingerprint || null,
    registryFingerprint: registrySummary.registryFingerprint,
    eventHead: chain.head || "GENESIS"
  });
  return {
    contractVersion: AUTHORITY_TRUST_CONTRACT,
    registryContractVersion: AUTHORITY_TRUST_REGISTRY_CONTRACT,
    challengeContractVersion: AUTHORITY_TRUST_CHALLENGE_CONTRACT,
    receiptContractVersion: AUTHORITY_TRUST_RECEIPT_CONTRACT,
    status: registrySummary.registryCurrent && registrySummary.activeKeyCount > 0 ? (receiptEvents.length ? "governed-verification-in-progress" : "trust-registry-ready") : "external-trust-registry-required",
    headline: "Trust doesn’t arrive as a checkbox.",
    subhead: "Pin the key. Issue the challenge. Verify the receipt. Keep the launch separate.",
    registry: registrySummary,
    candidates,
    scopeGroups: clone(AUTHORITY_TRUST_SCOPE_GROUPS),
    counts: {
      trustedKeys: registrySummary.trustedKeys.length,
      activeKeys: registrySummary.activeKeyCount,
      challengesIssued: challengeEvents.length,
      verifiedReceipts: receiptEvents.length,
      requiredScopesPerCandidate: AUTHORITY_TRUST_SCOPES.length,
      candidatesWithPilotAuthorization: candidates.filter(candidate => candidate.pilotAuthorizationRecorded).length,
      pilotsStarted: 0
    },
    history: clone(events),
    chain: clone(chain),
    bridgeFingerprint,
    generatedAt,
    registryWriteApiAvailable: false,
    humanIdentityDataStored: false,
    evidenceFilesStored: false,
    cryptographicSignaturesVerified: receiptEvents.length > 0,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: AUTHORITY_TRUST_BOUNDARY
  };
}
