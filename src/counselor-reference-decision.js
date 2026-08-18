import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const COUNSELOR_REFERENCE_DECISION_CONTRACT = "perl-counselor-reference-decision-docket/1.0";
export const COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT = "perl-counselor-reference-decision-registry/1.0";
export const COUNSELOR_REFERENCE_DECISION_CHALLENGE_CONTRACT = "perl-counselor-reference-decision-challenge/1.0";
export const COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT = "perl-counselor-reference-decision-attestation/1.0";

export const COUNSELOR_REFERENCE_DECISION_PURPOSES = Object.freeze([
  "reference-authorship-attestation",
  "reference-language-safety-acceptance",
  "reference-adjudication-decision",
  "reference-protocol-freeze"
]);

export const COUNSELOR_REFERENCE_DECISION_BOUNDARY = "This docket verifies four distinct, externally provisioned Ed25519 duties against one exact sealed counselor-reference adjudication dossier: independent authorship, clinical language and safety, case-level adjudication with preserved dissent, and protocol freeze with an independent-review handoff. It stores hashes and bounded decisions rather than counselor names, signatures, credentials, evidence files, candidate prose, Findings content, raw responses, patient records, or PHI. A verified freeze establishes only the exact counselor-reference set and protocol handoff named in the signed metadata. It does not establish accuracy, reliability, clinical validity, model performance, trial results, pilot authority, production release, traffic activation, patient use, diagnosis, or a care decision; and PERL cannot create trust keys, sign a return, or approve its own evidence.";

const HEX_64 = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-REFERENCE-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-REFERENCE-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-REFERENCE-CHALLENGE-[A-F0-9-]{20,80}$/;
const ATTESTATION_ID = /^FF-REFERENCE-ATTEST-[A-Z0-9-]{3,80}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const NONCE_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE_BASE64URL = /^[A-Za-z0-9_-]{86}$/;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_ATTESTATION_BYTES = 64 * 1024;
const CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const clone = value => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalCounselorReferenceDecisionJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function counselorReferenceDecisionDigest(value) {
  return createHash("sha256").update(canonicalCounselorReferenceDecisionJson(value)).digest("hex");
}

function finiteDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
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
  candidateProseIncluded: false,
  findingsContentIncluded: false,
  rawResponseContentIncluded: false,
  patientRecordsIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

function validateContentBoundary(boundary, label, errors) {
  const keys = [
    "evidenceFilesIncluded", "humanNamesIncluded", "humanSignaturesIncluded", "credentialsOrSecretsIncluded",
    "candidateProseIncluded", "findingsContentIncluded", "rawResponseContentIncluded", "patientRecordsIncluded",
    "phiIncluded", "perlExternalTransmissionPerformed"
  ];
  if (exactKeys(boundary, keys, label, errors)) {
    for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
  }
}

export function disabledCounselorReferenceDecisionRegistry() {
  return {
    contractVersion: COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT,
    registryId: "FF-REFERENCE-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function counselorReferenceDecisionRegistryTemplate() {
  return {
    contractVersion: COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT,
    registryId: "FF-REFERENCE-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: COUNSELOR_REFERENCE_DECISION_PURPOSES.map((purpose, index) => ({
      keyId: `FF-REFERENCE-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null
    })),
    provisioningBoundary: "Provision four distinct purpose-bound public keys in this owner-only file outside PERL and supply its path only at server startup. PERL exposes no registry-write or signing API."
  };
}

export function validateCounselorReferenceDecisionRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Counselor-reference decision registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Counselor-reference decision registry", errors)) return errors;
  if (registry.contractVersion !== COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT) errors.push(`Counselor-reference decision registry contractVersion must be ${COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT}.`);
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Counselor-reference decision registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Counselor-reference decision registry version is invalid.");
  if (!Array.isArray(registry.keys)) errors.push("Counselor-reference decision registry keys must be an array.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (disabled && !allowDisabled) errors.push("Four counselor-reference decision keys are required.");
  if (disabled && (registry.registryId !== "FF-REFERENCE-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty counselor-reference decision registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Counselor-reference decision registry dates must define a valid window.");
  if (keys.length > 32) errors.push("Counselor-reference decision registry may contain at most 32 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Counselor-reference decision key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats keyId ${key.keyId}.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    if (!COUNSELOR_REFERENCE_DECISION_PURPOSES.includes(key.purpose)) errors.push(`${label} purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a valid bounded Ed25519 SPKI key.`);
    if (fingerprint && fingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material; all four decision duties require distinct keys.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must remain inside the registry window.`);
  }
  if (!disabled) {
    for (const purpose of COUNSELOR_REFERENCE_DECISION_PURPOSES) if (!keys.some(key => key.purpose === purpose)) errors.push(`Counselor-reference decision registry requires a key for ${purpose}.`);
  }
  return [...new Set(errors)];
}

export function counselorReferenceDecisionRegistryFingerprint(registry) {
  return counselorReferenceDecisionDigest(registry);
}

export function summarizeCounselorReferenceDecisionRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateCounselorReferenceDecisionRegistry(registry);
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
    active: registryCurrent && Date.parse(key.notBefore) <= now && now <= Date.parse(key.notAfter)
  }));
  return {
    contractVersion: registry.contractVersion,
    registryId: registry.registryId,
    version: registry.version,
    registryFingerprint: counselorReferenceDecisionRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(COUNSELOR_REFERENCE_DECISION_PURPOSES.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false,
    signingApiAvailable: false
  };
}

function caseBindingsFromDossier(dossier) {
  return dossier.cases.map(item => ({
    assessmentId: item.assessmentId,
    sourceProfileHash: item.sourceProfileHash,
    draftHashes: item.candidates.map(candidate => candidate.draftHash)
  }));
}

export function createCounselorReferenceDecisionChallenge({ dossier, adjudicationChainHead, referenceDraftChainHead, registry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), challengeId = `FF-REFERENCE-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const challenge = {
    contractVersion: COUNSELOR_REFERENCE_DECISION_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    dossierFingerprint: dossier.dossierFingerprint,
    adjudicationChainHead,
    referenceDraftChainHead,
    registryFingerprint: counselorReferenceDecisionRegistryFingerprint(registry),
    caseSet: clone(dossier.caseSet),
    caseBindings: caseBindingsFromDossier(dossier),
    requiredPurposeOrder: [...COUNSELOR_REFERENCE_DECISION_PURPOSES],
    decisionMode: "source-only-reference-freeze-independent-review-next",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: contentBoundary()
  };
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "reference-decision-challenge-issued",
    contractVersion: COUNSELOR_REFERENCE_DECISION_CONTRACT,
    challenge,
    actor,
    createdAt,
    authorshipIndependenceVerified: false,
    languageSafetyAccepted: false,
    adjudicationDecisionRecorded: false,
    referenceSetAccepted: false,
    protocolFrozen: false,
    independentReviewHandoffReady: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    trialExecutionAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: COUNSELOR_REFERENCE_DECISION_BOUNDARY
  };
  return { ...core, hash: counselorReferenceDecisionDigest(core) };
}

export function validateCounselorReferenceDecisionChallenge(challenge, { dossier, adjudicationChainHead, referenceDraftChainHead, registryFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "dossierFingerprint", "adjudicationChainHead", "referenceDraftChainHead", "registryFingerprint", "caseSet", "caseBindings", "requiredPurposeOrder", "decisionMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Counselor-reference decision challenge", errors)) return errors;
  if (challenge.contractVersion !== COUNSELOR_REFERENCE_DECISION_CHALLENGE_CONTRACT) errors.push("Counselor-reference decision challenge contractVersion is invalid.");
  if (!CHALLENGE_ID.test(String(challenge.challengeId || "")) || !NONCE_BASE64URL.test(String(challenge.nonce || ""))) errors.push("Counselor-reference decision challenge identifiers are invalid.");
  if (![challenge.dossierFingerprint, challenge.adjudicationChainHead, challenge.referenceDraftChainHead, challenge.registryFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("Counselor-reference decision challenge fingerprints are invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Counselor-reference decision challenge must use the exact 24-hour window.");
  if (!challenge.caseSet || Object.keys(challenge.caseSet).sort().join(",") !== "id,version" || !String(challenge.caseSet.id || "").trim() || !String(challenge.caseSet.version || "").trim()) errors.push("Counselor-reference decision challenge caseSet is invalid.");
  if (!Array.isArray(challenge.caseBindings) || !challenge.caseBindings.length || challenge.caseBindings.some(item => !item || Object.keys(item).sort().join(",") !== "assessmentId,draftHashes,sourceProfileHash" || !String(item.assessmentId || "").trim() || !HEX_64.test(String(item.sourceProfileHash || "")) || !Array.isArray(item.draftHashes) || item.draftHashes.length < 2 || item.draftHashes.some(hash => !HEX_64.test(String(hash))) || new Set(item.draftHashes).size !== item.draftHashes.length)) errors.push("Counselor-reference decision challenge case bindings are invalid.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(COUNSELOR_REFERENCE_DECISION_PURPOSES)) errors.push("Counselor-reference decision challenge purpose order is invalid.");
  if (challenge.decisionMode !== "source-only-reference-freeze-independent-review-next") errors.push("Counselor-reference decision challenge mode is invalid.");
  validateContentBoundary(challenge.contentBoundary, "Counselor-reference decision challenge contentBoundary", errors);
  if (dossier) {
    if (challenge.dossierFingerprint !== dossier.dossierFingerprint || JSON.stringify(challenge.caseSet) !== JSON.stringify(dossier.caseSet) || JSON.stringify(challenge.caseBindings) !== JSON.stringify(caseBindingsFromDossier(dossier))) errors.push("Counselor-reference decision challenge is stale against the current sealed dossier.");
  }
  if (adjudicationChainHead && challenge.adjudicationChainHead !== adjudicationChainHead) errors.push("Counselor-reference decision challenge adjudication chain is stale.");
  if (referenceDraftChainHead && challenge.referenceDraftChainHead !== referenceDraftChainHead) errors.push("Counselor-reference decision challenge draft chain is stale.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Counselor-reference decision challenge registry is stale.");
  return [...new Set(errors)];
}

function validateHashList(value, label, errors, { minimum = 1, maximum = 16, allowed = null } = {}) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some(item => !HEX_64.test(String(item))) || new Set(value).size !== value.length) {
    errors.push(`${label} must contain ${minimum}–${maximum} unique SHA-256 values.`);
    return;
  }
  if (allowed && value.some(item => !allowed.has(item))) errors.push(`${label} contains a hash outside the issued challenge.`);
}

function validateDecisionPayload(attestation, challenge, priorAttestations, errors) {
  const decision = attestation.decision;
  const allDraftHashes = new Set((challenge?.caseBindings || []).flatMap(item => item.draftHashes));
  if (attestation.purpose === "reference-authorship-attestation") {
    const keys = ["candidateDraftHashes", "distinctAuthorCount", "qualifiedAuthorsVerified", "independenceVerified", "conflictsReviewed", "outcome"];
    if (!exactKeys(decision, keys, "Authorship decision", errors)) return;
    validateHashList(decision.candidateDraftHashes, "Authorship candidateDraftHashes", errors, { minimum: allDraftHashes.size || 1, maximum: allDraftHashes.size || 16, allowed: allDraftHashes });
    if (allDraftHashes.size && (decision.candidateDraftHashes.length !== allDraftHashes.size || [...allDraftHashes].some(hash => !decision.candidateDraftHashes.includes(hash)))) errors.push("Authorship decision must cover every challenge draft hash exactly once.");
    if (!Number.isInteger(decision.distinctAuthorCount) || decision.distinctAuthorCount < 2 || decision.distinctAuthorCount > decision.candidateDraftHashes.length) errors.push("Authorship distinctAuthorCount is invalid.");
    for (const key of ["qualifiedAuthorsVerified", "independenceVerified", "conflictsReviewed"]) if (decision[key] !== true) errors.push(`Authorship ${key} must be true.`);
    if (decision.outcome !== "verified") errors.push("Authorship outcome must be verified.");
  } else if (attestation.purpose === "reference-language-safety-acceptance") {
    const keys = ["standardReferenceHash", "directReviewRouteAccepted", "indicatorLanguageAccepted", "diagnosticRestraintAccepted", "uncertaintyStandardAccepted", "outcome"];
    if (!exactKeys(decision, keys, "Language and safety decision", errors)) return;
    if (!HEX_64.test(String(decision.standardReferenceHash || ""))) errors.push("Language and safety standardReferenceHash is invalid.");
    for (const key of ["directReviewRouteAccepted", "indicatorLanguageAccepted", "diagnosticRestraintAccepted", "uncertaintyStandardAccepted"]) if (decision[key] !== true) errors.push(`Language and safety ${key} must be true.`);
    if (decision.outcome !== "accepted") errors.push("Language and safety outcome must be accepted.");
  } else if (attestation.purpose === "reference-adjudication-decision") {
    const keys = ["caseDecisions", "allDisagreementsDispositioned", "majorityVoteUsed", "outcome"];
    if (!exactKeys(decision, keys, "Adjudication decision", errors)) return;
    if (!Array.isArray(decision.caseDecisions) || decision.caseDecisions.length !== (challenge?.caseBindings?.length || 0)) errors.push("Adjudication decision must cover every challenge case exactly once.");
    const seenCases = new Set();
    for (const item of Array.isArray(decision.caseDecisions) ? decision.caseDecisions : []) {
      const itemKeys = ["assessmentId", "disposition", "basisDraftHashes", "acceptedReferenceHash", "rationaleHash", "dissentHashes", "dissentDisposition"];
      if (!exactKeys(item, itemKeys, "Case adjudication decision", errors)) continue;
      const binding = challenge?.caseBindings?.find(candidate => candidate.assessmentId === item.assessmentId);
      if (!binding || seenCases.has(item.assessmentId)) errors.push("Case adjudication decision assessmentId is unknown or repeated.");
      seenCases.add(item.assessmentId);
      const allowed = new Set(binding?.draftHashes || []);
      const disposition = item.disposition;
      if (!["accepted-candidate", "accepted-synthesis", "no-reference"].includes(disposition)) errors.push("Case adjudication disposition is invalid.");
      validateHashList(item.basisDraftHashes, "Case adjudication basisDraftHashes", errors, { minimum: disposition === "no-reference" ? 0 : 1, maximum: allowed.size || 1, allowed });
      if (disposition === "accepted-candidate" && (item.basisDraftHashes.length !== 1 || item.acceptedReferenceHash !== item.basisDraftHashes[0])) errors.push("An accepted candidate must bind one exact draft hash as the accepted reference.");
      if (disposition === "accepted-synthesis" && (item.basisDraftHashes.length < 2 || !HEX_64.test(String(item.acceptedReferenceHash || "")) || allowed.has(item.acceptedReferenceHash))) errors.push("An accepted synthesis must bind at least two source drafts and a distinct accepted-reference hash.");
      if (disposition === "no-reference" && (item.acceptedReferenceHash !== null || item.basisDraftHashes.length !== 0)) errors.push("A no-reference decision cannot carry an accepted reference or basis draft.");
      if (!HEX_64.test(String(item.rationaleHash || ""))) errors.push("Case adjudication rationaleHash is invalid.");
      validateHashList(item.dissentHashes, "Case adjudication dissentHashes", errors, { minimum: 1, maximum: 8 });
      if (item.dissentDisposition !== "preserved") errors.push("Case adjudication dissent must remain preserved.");
    }
    if (decision.allDisagreementsDispositioned !== true || decision.majorityVoteUsed !== false) errors.push("Adjudication must disposition every disagreement without majority voting.");
    const everyAccepted = (decision.caseDecisions || []).length > 0 && decision.caseDecisions.every(item => ["accepted-candidate", "accepted-synthesis"].includes(item.disposition));
    if (decision.outcome !== (everyAccepted ? "accepted" : "decision-recorded-incomplete")) errors.push("Adjudication outcome does not match the case decisions.");
  } else if (attestation.purpose === "reference-protocol-freeze") {
    const keys = ["authorshipAttestationFingerprint", "languageSafetyAttestationFingerprint", "adjudicationAttestationFingerprint", "acceptedReferenceSetHash", "protocolHash", "independentReviewHandoffHash", "frozen", "independentReviewHandoffAccepted", "outcome"];
    if (!exactKeys(decision, keys, "Protocol-freeze decision", errors)) return;
    const authorship = priorAttestations?.get("reference-authorship-attestation");
    const language = priorAttestations?.get("reference-language-safety-acceptance");
    const adjudication = priorAttestations?.get("reference-adjudication-decision");
    if (!authorship || !language || !adjudication) errors.push("Protocol freeze requires the three earlier verified duties on the same challenge.");
    if (authorship && decision.authorshipAttestationFingerprint !== counselorReferenceDecisionDigest(authorship)) errors.push("Protocol freeze authorship fingerprint is stale.");
    if (language && decision.languageSafetyAttestationFingerprint !== counselorReferenceDecisionDigest(language)) errors.push("Protocol freeze language-safety fingerprint is stale.");
    if (adjudication && decision.adjudicationAttestationFingerprint !== counselorReferenceDecisionDigest(adjudication)) errors.push("Protocol freeze adjudication fingerprint is stale.");
    if (adjudication?.decision?.outcome !== "accepted") errors.push("Protocol freeze requires an accepted case-level reference decision for every case.");
    for (const key of ["acceptedReferenceSetHash", "protocolHash", "independentReviewHandoffHash"]) if (!HEX_64.test(String(decision[key] || ""))) errors.push(`Protocol freeze ${key} is invalid.`);
    if (decision.frozen !== true || decision.independentReviewHandoffAccepted !== true || decision.outcome !== "frozen-for-independent-review") errors.push("Protocol freeze outcome is incomplete.");
  } else {
    errors.push("Counselor-reference decision purpose is invalid.");
  }
}

function registryKeyForAttestation(attestation, registry, now, errors) {
  const registryErrors = registry ? validateCounselorReferenceDecisionRegistry(registry, { allowDisabled: false }) : ["Counselor-reference decision registry is unavailable."];
  if (registryErrors.length) errors.push(...registryErrors);
  const key = registry?.keys?.find(item => item.keyId === attestation.keyId);
  if (!key) errors.push("Counselor-reference decision key is not in the startup registry.");
  const nowMs = Date.parse(now);
  if (registry && (nowMs < Date.parse(registry.issuedAt) || nowMs > Date.parse(registry.expiresAt))) errors.push("Counselor-reference decision registry is outside its validity window.");
  if (key) {
    if (key.purpose !== attestation.purpose) errors.push("Counselor-reference decision key is not granted to this duty.");
    if (Date.parse(attestation.issuedAt) < Date.parse(key.notBefore) || Date.parse(attestation.issuedAt) > Date.parse(key.notAfter) || nowMs > Date.parse(key.notAfter)) errors.push("Counselor-reference decision key is outside its validity window.");
  }
  return key;
}

export function validateCounselorReferenceDecisionAttestation(attestation, { challenge, registry, priorAttestations = new Map(), now = new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(attestation ?? null)) > MAX_ATTESTATION_BYTES) errors.push("Counselor-reference decision attestation exceeds the 64 KB metadata limit.");
  const keys = ["contractVersion", "challengeId", "dossierFingerprint", "registryFingerprint", "keyId", "attestationId", "purpose", "issuedAt", "expiresAt", "evidenceReferences", "decision", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "Counselor-reference decision attestation", errors)) return errors;
  if (attestation.contractVersion !== COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT) errors.push("Counselor-reference decision attestation contractVersion is invalid.");
  if (!CHALLENGE_ID.test(String(attestation.challengeId || "")) || !KEY_ID.test(String(attestation.keyId || "")) || !ATTESTATION_ID.test(String(attestation.attestationId || ""))) errors.push("Counselor-reference decision attestation identifiers are invalid.");
  if (!COUNSELOR_REFERENCE_DECISION_PURPOSES.includes(attestation.purpose)) errors.push("Counselor-reference decision attestation purpose is invalid.");
  const purposeIndex = COUNSELOR_REFERENCE_DECISION_PURPOSES.indexOf(attestation.purpose);
  if (purposeIndex > 0) {
    const missingEarlierDuty = COUNSELOR_REFERENCE_DECISION_PURPOSES.slice(0, purposeIndex).find(purpose => !priorAttestations.has(purpose));
    if (missingEarlierDuty) errors.push(`Counselor-reference decision duty ${attestation.purpose} requires verified ${missingEarlierDuty} first.`);
  }
  if (seenAttestationIds.has(attestation.attestationId)) errors.push("Counselor-reference decision attestation ID has already been recorded.");
  if (seenPurposes.has(attestation.purpose)) errors.push("This decision duty is already recorded for the issued challenge.");
  if (![attestation.dossierFingerprint, attestation.registryFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("Counselor-reference decision attestation fingerprints are invalid.");
  if (!finiteDate(attestation.issuedAt) || !finiteDate(attestation.expiresAt) || Date.parse(attestation.expiresAt) <= Date.parse(attestation.issuedAt)) errors.push("Counselor-reference decision attestation validity window is invalid.");
  const nowMs = Date.parse(now);
  if (finiteDate(attestation.issuedAt) && Date.parse(attestation.issuedAt) > nowMs + CLOCK_SKEW_MS) errors.push("Counselor-reference decision attestation issuedAt is in the future.");
  if (finiteDate(attestation.expiresAt) && nowMs > Date.parse(attestation.expiresAt)) errors.push("Counselor-reference decision attestation has expired.");
  if (challenge) {
    if (attestation.challengeId !== challenge.challengeId || attestation.dossierFingerprint !== challenge.dossierFingerprint || attestation.registryFingerprint !== challenge.registryFingerprint) errors.push("Counselor-reference decision attestation does not match its issued challenge.");
    if (Date.parse(attestation.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(attestation.issuedAt) > Date.parse(challenge.expiresAt) || Date.parse(attestation.expiresAt) > Date.parse(challenge.expiresAt)) errors.push("Counselor-reference decision attestation falls outside the challenge window.");
  }
  if (!Array.isArray(attestation.evidenceReferences) || !attestation.evidenceReferences.length || attestation.evidenceReferences.length > 16 || attestation.evidenceReferences.some(reference => !SAFE_REF.test(String(reference))) || new Set(attestation.evidenceReferences).size !== attestation.evidenceReferences.length) errors.push("Counselor-reference decision evidenceReferences must contain 1–16 unique governed references.");
  validateDecisionPayload(attestation, challenge, priorAttestations, errors);
  validateContentBoundary(attestation.contentBoundary, "Counselor-reference decision attestation contentBoundary", errors);
  if (!exactKeys(attestation.signature, ["algorithm", "keyId", "value"], "Counselor-reference decision signature", errors)) return [...new Set(errors)];
  if (attestation.signature.algorithm !== "Ed25519" || attestation.signature.keyId !== attestation.keyId || !SIGNATURE_BASE64URL.test(String(attestation.signature.value || ""))) errors.push("Counselor-reference decision signature metadata is invalid.");
  const signatureHash = counselorReferenceDecisionDigest(attestation.signature.value);
  if (seenSignatureHashes.has(signatureHash)) errors.push("Counselor-reference decision signature has already been recorded.");
  const key = registryKeyForAttestation(attestation, registry, now, errors);
  if (registry && attestation.registryFingerprint !== counselorReferenceDecisionRegistryFingerprint(registry)) errors.push("Counselor-reference decision registry fingerprint is stale.");
  if (key && SIGNATURE_BASE64URL.test(String(attestation.signature.value || ""))) {
    const { signature, ...signedPayload } = attestation;
    try {
      const verified = verifySignature(null, Buffer.from(canonicalCounselorReferenceDecisionJson(signedPayload)), createPublicKey(key.publicKeyPem), Buffer.from(signature.value, "base64url"));
      if (!verified) errors.push("Counselor-reference decision Ed25519 signature is invalid.");
    } catch {
      errors.push("Counselor-reference decision Ed25519 signature could not be verified.");
    }
  }
  return [...new Set(errors)];
}

export function createCounselorReferenceDecisionAttestationEvent({ attestation, registry, actor, sequence, previousHash, verifiedAt = new Date().toISOString(), id = randomUUID() }) {
  const referenceSetAccepted = attestation.purpose === "reference-adjudication-decision" && attestation.decision.outcome === "accepted";
  const protocolFrozen = attestation.purpose === "reference-protocol-freeze" && attestation.decision.outcome === "frozen-for-independent-review";
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "reference-decision-attestation-verified",
    contractVersion: COUNSELOR_REFERENCE_DECISION_CONTRACT,
    attestation: clone(attestation),
    attestationFingerprint: counselorReferenceDecisionDigest(attestation),
    keyFingerprint: publicKeyFingerprint(registry.keys.find(key => key.keyId === attestation.keyId)?.publicKeyPem || "") || "",
    actor,
    createdAt: verifiedAt,
    authorshipIndependenceVerified: attestation.purpose === "reference-authorship-attestation",
    languageSafetyAccepted: attestation.purpose === "reference-language-safety-acceptance",
    adjudicationDecisionRecorded: attestation.purpose === "reference-adjudication-decision",
    referenceSetAccepted,
    protocolFrozen,
    independentReviewHandoffReady: protocolFrozen,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    trialExecutionAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: COUNSELOR_REFERENCE_DECISION_BOUNDARY
  };
  return { ...core, hash: counselorReferenceDecisionDigest(core) };
}

const EVENT_FALSE_CLAIMS = Object.freeze(["accuracyEstablished", "reliabilityEstablished", "clinicalValidation", "trialExecutionAuthorized", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"]);

export function validateCounselorReferenceDecisionEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, priorAttestations = new Map(), now = event?.createdAt || new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Counselor-reference decision event is required."];
  const common = ["id", "sequence", "previousHash", "eventType", "contractVersion"];
  const claims = ["authorshipIndependenceVerified", "languageSafetyAccepted", "adjudicationDecisionRecorded", "referenceSetAccepted", "protocolFrozen", "independentReviewHandoffReady", ...EVENT_FALSE_CLAIMS, "boundary", "actor", "createdAt", "hash"];
  const keys = event.eventType === "reference-decision-challenge-issued" ? [...common, "challenge", ...claims] : [...common, "attestation", "attestationFingerprint", "keyFingerprint", ...claims];
  if (!exactKeys(event, keys, "Counselor-reference decision event", errors)) return errors;
  if (!/^[0-9a-f-]{20,40}$/i.test(String(event.id || "")) || event.sequence !== sequence || !Number.isInteger(event.sequence) || event.sequence < 1 || event.previousHash !== previousHash || (event.previousHash !== "GENESIS" && !HEX_64.test(String(event.previousHash || "")))) errors.push("Counselor-reference decision event chain metadata is invalid.");
  if (event.contractVersion !== COUNSELOR_REFERENCE_DECISION_CONTRACT || !["reference-decision-challenge-issued", "reference-decision-attestation-verified"].includes(event.eventType)) errors.push("Counselor-reference decision event identity is invalid.");
  if (!ACTOR.test(String(event.actor || "")) || !finiteDate(event.createdAt)) errors.push("Counselor-reference decision event actor or timestamp is invalid.");
  if (event.boundary !== COUNSELOR_REFERENCE_DECISION_BOUNDARY) errors.push("Counselor-reference decision event boundary is invalid.");
  for (const key of EVENT_FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (event.eventType === "reference-decision-challenge-issued") {
    errors.push(...validateCounselorReferenceDecisionChallenge(event.challenge));
    for (const key of ["authorshipIndependenceVerified", "languageSafetyAccepted", "adjudicationDecisionRecorded", "referenceSetAccepted", "protocolFrozen", "independentReviewHandoffReady"]) if (event[key] !== false) errors.push(`A challenge cannot set ${key}.`);
  } else {
    errors.push(...validateCounselorReferenceDecisionAttestation(event.attestation, { challenge, registry, priorAttestations, now, seenAttestationIds, seenSignatureHashes, seenPurposes }));
    if (event.attestationFingerprint !== counselorReferenceDecisionDigest(event.attestation) || !HEX_64.test(String(event.keyFingerprint || ""))) errors.push("Counselor-reference decision attestation evidence fingerprints are invalid.");
    const expected = {
      authorshipIndependenceVerified: event.attestation.purpose === "reference-authorship-attestation",
      languageSafetyAccepted: event.attestation.purpose === "reference-language-safety-acceptance",
      adjudicationDecisionRecorded: event.attestation.purpose === "reference-adjudication-decision",
      referenceSetAccepted: event.attestation.purpose === "reference-adjudication-decision" && event.attestation.decision.outcome === "accepted",
      protocolFrozen: event.attestation.purpose === "reference-protocol-freeze" && event.attestation.decision.outcome === "frozen-for-independent-review",
      independentReviewHandoffReady: event.attestation.purpose === "reference-protocol-freeze" && event.attestation.decision.outcome === "frozen-for-independent-review"
    };
    for (const [key, value] of Object.entries(expected)) if (event[key] !== value) errors.push(`Counselor-reference decision event ${key} does not match its attestation.`);
  }
  const { hash, ...core } = event;
  if (!HEX_64.test(String(hash || "")) || counselorReferenceDecisionDigest(core) !== hash) errors.push("Counselor-reference decision event hash is invalid.");
  return [...new Set(errors)];
}

export function buildCounselorReferenceDecisionDocket({ dossier, registry = disabledCounselorReferenceDecisionRegistry(), events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizeCounselorReferenceDecisionRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const currentSnapshot = dossier?.history?.[0]?.dossierFingerprint === dossier?.dossierFingerprint;
  const localEvidenceReady = Boolean(currentSnapshot) && (dossier?.cases || []).length > 0 && dossier.cases.every(item => item.locallyComparable);
  const boundChallenges = events.filter(event => event.eventType === "reference-decision-challenge-issued" && event.challenge.dossierFingerprint === dossier?.dossierFingerprint && event.challenge.adjudicationChainHead === dossier?.chain?.head && event.challenge.referenceDraftChainHead === dossier?.referenceDraftChain?.head && event.challenge.registryFingerprint === registrySummary.registryFingerprint);
  const activeChallengeEvent = [...boundChallenges].reverse().find(event => now <= Date.parse(event.challenge.expiresAt)) || null;
  const activeChallenge = activeChallengeEvent?.challenge || null;
  const verifiedEvents = activeChallenge ? events.filter(event => event.eventType === "reference-decision-attestation-verified" && event.attestation.challengeId === activeChallenge.challengeId) : [];
  const verifiedByPurpose = new Map(verifiedEvents.map(event => [event.attestation.purpose, event]));
  const purposes = COUNSELOR_REFERENCE_DECISION_PURPOSES.map((purpose, index) => {
    const event = verifiedByPurpose.get(purpose);
    return {
      index: String(index + 1).padStart(2, "0"),
      purpose,
      label: {
        "reference-authorship-attestation": "Independent authorship",
        "reference-language-safety-acceptance": "Language + safety standard",
        "reference-adjudication-decision": "Case decisions + dissent",
        "reference-protocol-freeze": "Protocol freeze + evaluator handoff"
      }[purpose],
      status: event ? "verified-external-duty" : "external-signature-required",
      attestationFingerprint: event?.attestationFingerprint || null,
      keyFingerprint: event?.keyFingerprint || null
    };
  });
  const authorshipIndependenceVerified = verifiedByPurpose.has("reference-authorship-attestation");
  const languageSafetyAccepted = verifiedByPurpose.has("reference-language-safety-acceptance");
  const adjudicationEvent = verifiedByPurpose.get("reference-adjudication-decision");
  const adjudicationDecisionRecorded = Boolean(adjudicationEvent);
  const referenceSetAccepted = adjudicationEvent?.attestation?.decision?.outcome === "accepted";
  const freezeEvent = verifiedByPurpose.get("reference-protocol-freeze");
  const protocolFrozen = Boolean(freezeEvent) && referenceSetAccepted;
  let status = "sealed-adjudication-required";
  if (localEvidenceReady) status = registrySummary.registryCurrent && registrySummary.activeKeyCount >= 4 ? activeChallenge ? "external-decisions-in-progress" : "reference-decision-challenge-required" : "external-decision-registry-required";
  if (protocolFrozen) status = "reference-protocol-frozen-for-independent-review";
  const counts = {
    developmentCases: Number(dossier?.counts?.developmentCases || 0),
    locallyComparableCases: Number(dossier?.counts?.locallyComparableCases || 0),
    sealedAdjudicationSnapshots: Number(dossier?.chain?.count || 0),
    requiredExternalDuties: COUNSELOR_REFERENCE_DECISION_PURPOSES.length,
    verifiedExternalDuties: verifiedEvents.length,
    acceptedReferences: referenceSetAccepted ? (adjudicationEvent.attestation.decision.caseDecisions || []).filter(item => item.disposition !== "no-reference").length : 0,
    protocolFreezes: protocolFrozen ? 1 : 0
  };
  const docketCore = {
    contractVersion: COUNSELOR_REFERENCE_DECISION_CONTRACT,
    status,
    dossierFingerprint: dossier?.dossierFingerprint || null,
    adjudicationChainHead: dossier?.chain?.head || null,
    referenceDraftChainHead: dossier?.referenceDraftChain?.head || null,
    localEvidenceReady,
    registry: registrySummary,
    activeChallenge,
    purposes,
    counts,
    authorshipIndependenceVerified,
    languageSafetyAccepted,
    adjudicationDecisionRecorded,
    referenceSetAccepted,
    protocolFrozen,
    independentReviewHandoffReady: protocolFrozen,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    trialExecutionAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    registryWriteApiAvailable: false,
    signingApiAvailable: false,
    externalTransmissionPerformed: false,
    boundary: COUNSELOR_REFERENCE_DECISION_BOUNDARY
  };
  return {
    ...docketCore,
    docketFingerprint: counselorReferenceDecisionDigest(docketCore),
    history: events.slice().reverse().map(event => ({
      sequence: event.sequence,
      eventType: event.eventType,
      purpose: event.attestation?.purpose || null,
      challengeId: event.challenge?.challengeId || event.attestation?.challengeId || null,
      actor: event.actor,
      createdAt: event.createdAt,
      hash: event.hash
    })),
    chain: clone(chain),
    generatedAt
  };
}
