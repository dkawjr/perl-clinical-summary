import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const INDEPENDENT_REVIEW_ADMISSION_CONTRACT = "perl-independent-review-admission-docket/1.0";
export const INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT = "perl-independent-review-admission-registry/1.0";
export const INDEPENDENT_REVIEW_ADMISSION_CHALLENGE_CONTRACT = "perl-independent-review-admission-challenge/1.0";
export const INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT = "perl-independent-review-admission-attestation/1.0";

export const INDEPENDENT_REVIEW_ADMISSION_PURPOSES = Object.freeze([
  "authoritative-source-contract-acceptance",
  "representative-case-set-freeze",
  "clinical-standard-acceptance",
  "evaluator-charter-attestation",
  "legal-permission-attestation",
  "privacy-permission-attestation",
  "independent-review-protocol-freeze"
]);

export const INDEPENDENT_REVIEW_ADMISSION_BOUNDARY = "This docket verifies seven distinct, externally provisioned Ed25519 duties against one exact, locally sealed independent-review dossier and one verified counselor-reference freeze: authoritative source contracts, representative case-set and holdout freeze, clinical-standard acceptance, evaluator qualifications and independence, legal permission, privacy permission, and a final protocol freeze. It stores hashes and bounded decisions rather than names, signatures, credentials, workbooks, case files, Findings content, raw responses, patient records, or PHI. A complete chain authorizes only execution of the exact independent evaluation protocol named in the signed metadata. It does not complete the evaluation, establish accuracy, reliability, clinical validity, model performance, pilot authority, production release, traffic activation, patient use, diagnosis, or a care decision; and PERL cannot create trust keys, sign a return, accept its own evidence, or record an evaluator result through this surface.";

const HEX = /^[a-f0-9]{64}$/;
const KEY_ID = /^FF-REVIEW-ADMISSION-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-REVIEW-ADMISSION-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-REVIEW-ADMISSION-CHALLENGE-[A-F0-9-]{20,80}$/;
const ATTESTATION_ID = /^FF-REVIEW-ADMISSION-ATTEST-[A-Z0-9-]{3,80}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const NONCE = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_ATTESTATION_BYTES = 64 * 1024;

const clone = value => structuredClone(value);
const finiteDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalIndependentReviewAdmissionJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function independentReviewAdmissionDigest(value) {
  return createHash("sha256").update(canonicalIndependentReviewAdmissionJson(value)).digest("hex");
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
  workbookBytesIncluded: false,
  caseRecordsIncluded: false,
  findingsContentIncluded: false,
  rawResponseContentIncluded: false,
  patientRecordsIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

function validateContentBoundary(boundary, label, errors) {
  const keys = ["evidenceFilesIncluded", "humanNamesIncluded", "humanSignaturesIncluded", "credentialsOrSecretsIncluded", "workbookBytesIncluded", "caseRecordsIncluded", "findingsContentIncluded", "rawResponseContentIncluded", "patientRecordsIncluded", "phiIncluded", "perlExternalTransmissionPerformed"];
  if (exactKeys(boundary, keys, label, errors)) for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
}

export function disabledIndependentReviewAdmissionRegistry() {
  return {
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT,
    registryId: "FF-REVIEW-ADMISSION-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function independentReviewAdmissionRegistryTemplate() {
  return {
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT,
    registryId: "FF-REVIEW-ADMISSION-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: INDEPENDENT_REVIEW_ADMISSION_PURPOSES.map((purpose, index) => ({
      keyId: `FF-REVIEW-ADMISSION-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null
    })),
    provisioningBoundary: "Provision seven distinct purpose-bound public keys in this owner-only file outside PERL and supply its path only at server startup. PERL exposes no registry-write or signing API."
  };
}

export function validateIndependentReviewAdmissionRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Independent-review admission registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Independent-review admission registry", errors)) return errors;
  if (registry.contractVersion !== INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT) errors.push("Independent-review admission registry contractVersion is invalid.");
  if (!REGISTRY_ID.test(String(registry.registryId || ""))) errors.push("Independent-review admission registry ID is invalid.");
  if (!/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Independent-review admission registry version is invalid.");
  if (!Array.isArray(registry.keys)) errors.push("Independent-review admission registry keys must be an array.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (disabled && !allowDisabled) errors.push("Seven independent-review admission keys are required.");
  if (disabled && (registry.registryId !== "FF-REVIEW-ADMISSION-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty independent-review admission registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Independent-review admission registry dates must define a valid window.");
  if (keys.length > 32) errors.push("Independent-review admission registry may contain at most 32 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Independent-review admission key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || ""))) errors.push(`${label} keyId is invalid.`);
    if (keyIds.has(key.keyId)) errors.push(`${label} repeats a keyId.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} must use Ed25519.`);
    if (!INDEPENDENT_REVIEW_ADMISSION_PURPOSES.includes(key.purpose)) errors.push(`${label} purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint) errors.push(`${label} public key is not a bounded Ed25519 SPKI key.`);
    if (fingerprint && fingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material; all seven duties require distinct keys.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must stay inside the registry window.`);
  }
  if (!disabled) for (const purpose of INDEPENDENT_REVIEW_ADMISSION_PURPOSES) if (keys.filter(key => key.purpose === purpose).length !== 1) errors.push(`Independent-review admission registry requires exactly one key for ${purpose}.`);
  return [...new Set(errors)];
}

export const independentReviewAdmissionRegistryFingerprint = registry => independentReviewAdmissionDigest(registry);

export function summarizeIndependentReviewAdmissionRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateIndependentReviewAdmissionRegistry(registry);
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
    registryFingerprint: independentReviewAdmissionRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(INDEPENDENT_REVIEW_ADMISSION_PURPOSES.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false,
    signingApiAvailable: false
  };
}

function referenceFreezeFingerprint(referenceDecision) {
  return referenceDecision?.purposes?.find(item => item.purpose === "reference-protocol-freeze")?.attestationFingerprint || null;
}

export function createIndependentReviewAdmissionChallenge({ dossier, referenceDecision, clinicalStandard, registry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), challengeId = `FF-REVIEW-ADMISSION-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") }) {
  const challenge = {
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    dossierFingerprint: dossier.dossierFingerprint,
    reviewPackageHash: dossier.reviewPackageHash,
    dossierChainHead: dossier.chain.head,
    referenceDecisionDocketFingerprint: referenceDecision.docketFingerprint,
    referenceDecisionChainHead: referenceDecision.chain.head,
    referenceFreezeAttestationFingerprint: referenceFreezeFingerprint(referenceDecision),
    clinicalStandardDraftHash: clinicalStandard.latestDraft.hash,
    registryFingerprint: independentReviewAdmissionRegistryFingerprint(registry),
    requiredPurposeOrder: [...INDEPENDENT_REVIEW_ADMISSION_PURPOSES],
    decisionMode: "admit-exact-independent-evaluation-protocol-no-results",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: contentBoundary()
  };
  const core = {
    id, sequence, previousHash,
    eventType: "independent-review-admission-challenge-issued",
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
    challenge,
    actor,
    createdAt,
    sourceContractsAccepted: false,
    caseSetFrozen: false,
    clinicalStandardAccepted: false,
    evaluatorCharterVerified: false,
    legalPermissionVerified: false,
    privacyPermissionVerified: false,
    independentReviewProtocolFrozen: false,
    independentReviewExecutionReady: false,
    independentReviewComplete: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: INDEPENDENT_REVIEW_ADMISSION_BOUNDARY
  };
  return { ...core, hash: independentReviewAdmissionDigest(core) };
}

export function validateIndependentReviewAdmissionChallenge(challenge, { dossier, referenceDecision, clinicalStandard, registryFingerprint } = {}) {
  const errors = [];
  const keys = ["contractVersion", "challengeId", "nonce", "dossierFingerprint", "reviewPackageHash", "dossierChainHead", "referenceDecisionDocketFingerprint", "referenceDecisionChainHead", "referenceFreezeAttestationFingerprint", "clinicalStandardDraftHash", "registryFingerprint", "requiredPurposeOrder", "decisionMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Independent-review admission challenge", errors)) return errors;
  if (challenge.contractVersion !== INDEPENDENT_REVIEW_ADMISSION_CHALLENGE_CONTRACT) errors.push("Independent-review admission challenge contractVersion is invalid.");
  if (!CHALLENGE_ID.test(String(challenge.challengeId || "")) || !NONCE.test(String(challenge.nonce || ""))) errors.push("Independent-review admission challenge identifiers are invalid.");
  for (const key of ["dossierFingerprint", "reviewPackageHash", "dossierChainHead", "referenceDecisionDocketFingerprint", "referenceDecisionChainHead", "referenceFreezeAttestationFingerprint", "clinicalStandardDraftHash", "registryFingerprint"]) if (!HEX.test(String(challenge[key] || ""))) errors.push(`Independent-review admission challenge ${key} is invalid.`);
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Independent-review admission challenge must use the exact 24-hour window.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(INDEPENDENT_REVIEW_ADMISSION_PURPOSES)) errors.push("Independent-review admission challenge purpose order is invalid.");
  if (challenge.decisionMode !== "admit-exact-independent-evaluation-protocol-no-results") errors.push("Independent-review admission challenge mode is invalid.");
  validateContentBoundary(challenge.contentBoundary, "Independent-review admission challenge contentBoundary", errors);
  if (dossier && (challenge.dossierFingerprint !== dossier.dossierFingerprint || challenge.reviewPackageHash !== dossier.reviewPackageHash || challenge.dossierChainHead !== dossier.chain?.head || dossier.latestSeal?.dossierFingerprint !== dossier.dossierFingerprint)) errors.push("Independent-review admission challenge is stale against the current sealed dossier.");
  if (referenceDecision && (challenge.referenceDecisionDocketFingerprint !== referenceDecision.docketFingerprint || challenge.referenceDecisionChainHead !== referenceDecision.chain?.head || challenge.referenceFreezeAttestationFingerprint !== referenceFreezeFingerprint(referenceDecision) || referenceDecision.protocolFrozen !== true || referenceDecision.independentReviewHandoffReady !== true)) errors.push("Independent-review admission challenge is stale against the counselor-reference freeze.");
  if (clinicalStandard && challenge.clinicalStandardDraftHash !== clinicalStandard.latestDraft?.hash) errors.push("Independent-review admission challenge is stale against the clinical-standard draft.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Independent-review admission challenge registry is stale.");
  return [...new Set(errors)];
}

function hashFields(decision, fields, label, errors) {
  for (const key of fields) if (!HEX.test(String(decision?.[key] || ""))) errors.push(`${label} ${key} is invalid.`);
}

function validateDecision(attestation, challenge, priorAttestations, errors) {
  const decision = attestation.decision;
  if (attestation.purpose === "authoritative-source-contract-acceptance") {
    const keys = ["thresholdWorkbookHash", "categoryWorkbookHash", "scoredEventContractHash", "scoringVersionReference", "findingsLifecycleHash", "outcome"];
    if (!exactKeys(decision, keys, "Source-contract decision", errors)) return;
    hashFields(decision, ["thresholdWorkbookHash", "categoryWorkbookHash", "scoredEventContractHash", "findingsLifecycleHash"], "Source-contract decision", errors);
    if (!SAFE_REF.test(String(decision.scoringVersionReference || "")) || decision.outcome !== "accepted") errors.push("Source-contract decision is incomplete.");
  } else if (attestation.purpose === "representative-case-set-freeze") {
    const keys = ["caseInventoryHash", "caseSetReference", "eligibilityProtocolHash", "strataProtocolHash", "developmentPartitionHash", "holdoutPartitionHash", "holdoutAccessPolicyHash", "outcome"];
    if (!exactKeys(decision, keys, "Case-set decision", errors)) return;
    hashFields(decision, ["caseInventoryHash", "eligibilityProtocolHash", "strataProtocolHash", "developmentPartitionHash", "holdoutPartitionHash", "holdoutAccessPolicyHash"], "Case-set decision", errors);
    if (!SAFE_REF.test(String(decision.caseSetReference || "")) || decision.outcome !== "frozen") errors.push("Case-set decision is incomplete.");
  } else if (attestation.purpose === "clinical-standard-acceptance") {
    const keys = ["clinicalStandardDraftHash", "analysisPlanHash", "measureDefinitionsHash", "zeroSafetyToleranceAccepted", "preOutcomeStatusReviewed", "outcome"];
    if (!exactKeys(decision, keys, "Clinical-standard decision", errors)) return;
    hashFields(decision, ["clinicalStandardDraftHash", "analysisPlanHash", "measureDefinitionsHash"], "Clinical-standard decision", errors);
    if (decision.clinicalStandardDraftHash !== challenge?.clinicalStandardDraftHash || decision.zeroSafetyToleranceAccepted !== true || decision.preOutcomeStatusReviewed !== true || decision.outcome !== "accepted") errors.push("Clinical-standard decision is incomplete or stale.");
  } else if (attestation.purpose === "evaluator-charter-attestation") {
    const keys = ["evaluatorAuthorityReferenceHash", "qualificationsReferenceHash", "conflictDisclosureHash", "charterHash", "independenceConfirmed", "outcome"];
    if (!exactKeys(decision, keys, "Evaluator-charter decision", errors)) return;
    hashFields(decision, ["evaluatorAuthorityReferenceHash", "qualificationsReferenceHash", "conflictDisclosureHash", "charterHash"], "Evaluator-charter decision", errors);
    if (decision.independenceConfirmed !== true || decision.outcome !== "verified") errors.push("Evaluator-charter decision is incomplete.");
  } else if (attestation.purpose === "legal-permission-attestation") {
    const keys = ["permissionReferenceHash", "permittedDataClass", "retentionPolicyHash", "deletionPolicyHash", "purposeLimited", "outcome"];
    if (!exactKeys(decision, keys, "Legal-permission decision", errors)) return;
    hashFields(decision, ["permissionReferenceHash", "retentionPolicyHash", "deletionPolicyHash"], "Legal-permission decision", errors);
    if (decision.permittedDataClass !== "approved-deidentified-evaluation-records" || decision.purposeLimited !== true || decision.outcome !== "approved") errors.push("Legal-permission decision is incomplete.");
  } else if (attestation.purpose === "privacy-permission-attestation") {
    const keys = ["privacyReviewReferenceHash", "transferControlsHash", "accessControlsHash", "deidentificationStandardHash", "minimumNecessaryConfirmed", "outcome"];
    if (!exactKeys(decision, keys, "Privacy-permission decision", errors)) return;
    hashFields(decision, ["privacyReviewReferenceHash", "transferControlsHash", "accessControlsHash", "deidentificationStandardHash"], "Privacy-permission decision", errors);
    if (decision.minimumNecessaryConfirmed !== true || decision.outcome !== "approved") errors.push("Privacy-permission decision is incomplete.");
  } else if (attestation.purpose === "independent-review-protocol-freeze") {
    const keys = ["priorAttestationFingerprints", "frozenProtocolHash", "evaluatorHandoffHash", "analysisPlanHash", "caseSetReference", "referenceDecisionDocketFingerprint", "outcome"];
    if (!exactKeys(decision, keys, "Protocol-freeze decision", errors)) return;
    hashFields(decision, ["frozenProtocolHash", "evaluatorHandoffHash", "analysisPlanHash", "referenceDecisionDocketFingerprint"], "Protocol-freeze decision", errors);
    const priorPurposes = INDEPENDENT_REVIEW_ADMISSION_PURPOSES.slice(0, -1);
    const expected = priorPurposes.map(purpose => priorAttestations.get(purpose)).filter(Boolean).map(item => independentReviewAdmissionDigest(item));
    if (expected.length !== priorPurposes.length || JSON.stringify(decision.priorAttestationFingerprints) !== JSON.stringify(expected)) errors.push("Protocol-freeze decision must bind the six prior attestations in required order.");
    const standard = priorAttestations.get("clinical-standard-acceptance")?.decision;
    const cases = priorAttestations.get("representative-case-set-freeze")?.decision;
    if (decision.analysisPlanHash !== standard?.analysisPlanHash || decision.caseSetReference !== cases?.caseSetReference || decision.referenceDecisionDocketFingerprint !== challenge?.referenceDecisionDocketFingerprint || decision.outcome !== "frozen-for-independent-execution") errors.push("Protocol-freeze decision is incomplete or inconsistent with prior duties.");
  }
}

export function validateIndependentReviewAdmissionAttestation(attestation, { challenge, registry, priorAttestations = new Map(), now = new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(attestation ?? null)) > MAX_ATTESTATION_BYTES) errors.push("Independent-review admission attestation exceeds the 64 KB limit.");
  const keys = ["contractVersion", "attestationId", "challengeId", "nonce", "registryFingerprint", "dossierFingerprint", "referenceDecisionDocketFingerprint", "purpose", "keyId", "issuedAt", "decision", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "Independent-review admission attestation", errors)) return errors;
  if (attestation.contractVersion !== INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT || !ATTESTATION_ID.test(String(attestation.attestationId || "")) || !INDEPENDENT_REVIEW_ADMISSION_PURPOSES.includes(attestation.purpose) || !KEY_ID.test(String(attestation.keyId || ""))) errors.push("Independent-review admission attestation identity is invalid.");
  if (!finiteDate(attestation.issuedAt) || !NONCE.test(String(attestation.nonce || "")) || ![attestation.registryFingerprint, attestation.dossierFingerprint, attestation.referenceDecisionDocketFingerprint].every(value => HEX.test(String(value || "")))) errors.push("Independent-review admission attestation evidence metadata is invalid.");
  validateContentBoundary(attestation.contentBoundary, "Independent-review admission attestation contentBoundary", errors);
  if (!challenge || attestation.challengeId !== challenge.challengeId || attestation.nonce !== challenge.nonce || attestation.registryFingerprint !== challenge.registryFingerprint || attestation.dossierFingerprint !== challenge.dossierFingerprint || attestation.referenceDecisionDocketFingerprint !== challenge.referenceDecisionDocketFingerprint) errors.push("Independent-review admission attestation does not match the issued challenge.");
  if (challenge && (Date.parse(now) > Date.parse(challenge.expiresAt) || Date.parse(attestation.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(attestation.issuedAt) > Date.parse(now) + CLOCK_SKEW_MS)) errors.push("Independent-review admission attestation is outside the challenge time window.");
  if (seenAttestationIds.has(attestation.attestationId)) errors.push("Independent-review admission attestation ID has already been recorded.");
  if (seenPurposes.has(attestation.purpose)) errors.push("Independent-review admission purpose has already been satisfied for this challenge.");
  const expectedPurpose = INDEPENDENT_REVIEW_ADMISSION_PURPOSES[priorAttestations.size];
  if (attestation.purpose !== expectedPurpose) errors.push(`Independent-review admission duties must be verified in order; ${expectedPurpose || "no further purpose"} is next.`);
  validateDecision(attestation, challenge, priorAttestations, errors);
  if (!exactKeys(attestation.signature, ["algorithm", "keyId", "value"], "Independent-review admission signature", errors)) return [...new Set(errors)];
  if (attestation.signature.algorithm !== "Ed25519" || attestation.signature.keyId !== attestation.keyId || !SIGNATURE.test(String(attestation.signature.value || ""))) errors.push("Independent-review admission signature metadata is invalid.");
  const signatureHash = independentReviewAdmissionDigest(attestation.signature.value);
  if (seenSignatureHashes.has(signatureHash)) errors.push("Independent-review admission signature has already been recorded.");
  const key = registry?.keys?.find(item => item.keyId === attestation.keyId && item.purpose === attestation.purpose);
  if (!key || !finiteDate(now) || Date.parse(now) < Date.parse(key.notBefore) || Date.parse(now) > Date.parse(key.notAfter) || Date.parse(now) < Date.parse(registry?.issuedAt) || Date.parse(now) > Date.parse(registry?.expiresAt)) errors.push("Independent-review admission key or registry is absent, purpose-mismatched, or outside its validity window.");
  if (registry && attestation.registryFingerprint !== independentReviewAdmissionRegistryFingerprint(registry)) errors.push("Independent-review admission registry fingerprint is stale.");
  if (key && SIGNATURE.test(String(attestation.signature.value || ""))) {
    const { signature, ...signedPayload } = attestation;
    try {
      const verified = verifySignature(null, Buffer.from(canonicalIndependentReviewAdmissionJson(signedPayload)), createPublicKey(key.publicKeyPem), Buffer.from(signature.value, "base64url"));
      if (!verified) errors.push("Independent-review admission Ed25519 signature is invalid.");
    } catch {
      errors.push("Independent-review admission Ed25519 signature could not be verified.");
    }
  }
  return [...new Set(errors)];
}

const CLAIMS = Object.freeze(["sourceContractsAccepted", "caseSetFrozen", "clinicalStandardAccepted", "evaluatorCharterVerified", "legalPermissionVerified", "privacyPermissionVerified", "independentReviewProtocolFrozen", "independentReviewExecutionReady"]);
const FALSE_CLAIMS = Object.freeze(["independentReviewComplete", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"]);

function claimsForPurpose(purpose) {
  const index = INDEPENDENT_REVIEW_ADMISSION_PURPOSES.indexOf(purpose);
  return Object.fromEntries(CLAIMS.map((claim, claimIndex) => [claim, claimIndex <= index || (index === INDEPENDENT_REVIEW_ADMISSION_PURPOSES.length - 1 && claim === "independentReviewExecutionReady")]));
}

export function createIndependentReviewAdmissionAttestationEvent({ attestation, registry, actor, sequence, previousHash, verifiedAt = new Date().toISOString(), id = randomUUID() }) {
  const core = {
    id, sequence, previousHash,
    eventType: "independent-review-admission-attestation-verified",
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
    attestation: clone(attestation),
    attestationFingerprint: independentReviewAdmissionDigest(attestation),
    keyFingerprint: publicKeyFingerprint(registry.keys.find(key => key.keyId === attestation.keyId)?.publicKeyPem || "") || "",
    actor,
    createdAt: verifiedAt,
    ...claimsForPurpose(attestation.purpose),
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    boundary: INDEPENDENT_REVIEW_ADMISSION_BOUNDARY
  };
  return { ...core, hash: independentReviewAdmissionDigest(core) };
}

export function validateIndependentReviewAdmissionEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, priorAttestations = new Map(), now = event?.createdAt || new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Independent-review admission event is required."];
  const common = ["id", "sequence", "previousHash", "eventType", "contractVersion"];
  const tail = ["actor", "createdAt", ...CLAIMS, ...FALSE_CLAIMS, "boundary", "hash"];
  const keys = event.eventType === "independent-review-admission-challenge-issued" ? [...common, "challenge", ...tail] : [...common, "attestation", "attestationFingerprint", "keyFingerprint", ...tail];
  if (!exactKeys(event, keys, "Independent-review admission event", errors)) return errors;
  if (!/^[0-9a-f-]{20,40}$/i.test(String(event.id || "")) || event.sequence !== sequence || !Number.isInteger(event.sequence) || event.sequence < 1 || event.previousHash !== previousHash || (event.previousHash !== "GENESIS" && !HEX.test(String(event.previousHash || "")))) errors.push("Independent-review admission event chain metadata is invalid.");
  if (event.contractVersion !== INDEPENDENT_REVIEW_ADMISSION_CONTRACT || !["independent-review-admission-challenge-issued", "independent-review-admission-attestation-verified"].includes(event.eventType)) errors.push("Independent-review admission event identity is invalid.");
  if (!ACTOR.test(String(event.actor || "")) || !finiteDate(event.createdAt) || event.boundary !== INDEPENDENT_REVIEW_ADMISSION_BOUNDARY) errors.push("Independent-review admission event actor, timestamp, or boundary is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (event.eventType === "independent-review-admission-challenge-issued") {
    errors.push(...validateIndependentReviewAdmissionChallenge(event.challenge));
    for (const key of CLAIMS) if (event[key] !== false) errors.push(`A challenge cannot set ${key}.`);
  } else {
    errors.push(...validateIndependentReviewAdmissionAttestation(event.attestation, { challenge, registry, priorAttestations, now, seenAttestationIds, seenSignatureHashes, seenPurposes }));
    if (event.attestationFingerprint !== independentReviewAdmissionDigest(event.attestation) || !HEX.test(String(event.keyFingerprint || ""))) errors.push("Independent-review admission evidence fingerprints are invalid.");
    const expected = claimsForPurpose(event.attestation.purpose);
    for (const [key, value] of Object.entries(expected)) if (event[key] !== value) errors.push(`Independent-review admission event ${key} does not match the completed duty sequence.`);
  }
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || independentReviewAdmissionDigest(core) !== hash) errors.push("Independent-review admission event hash is invalid.");
  return [...new Set(errors)];
}

export function buildIndependentReviewAdmissionDocket({ dossier, referenceDecision, clinicalStandard, registry = disabledIndependentReviewAdmissionRegistry(), events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const registrySummary = summarizeIndependentReviewAdmissionRegistry(registry, generatedAt);
  const now = Date.parse(generatedAt);
  const localDossierCurrent = dossier?.chain?.valid === true && dossier?.latestSeal?.dossierFingerprint === dossier?.dossierFingerprint && dossier?.gateCounts?.localCurrent === 4;
  const referenceFreezeCurrent = referenceDecision?.chain?.valid === true && referenceDecision?.protocolFrozen === true && referenceDecision?.independentReviewHandoffReady === true && dossier?.evidenceSnapshot?.referenceDecisionDocketFingerprint === referenceDecision?.docketFingerprint;
  const clinicalStandardDraftCurrent = HEX.test(String(clinicalStandard?.latestDraft?.hash || "")) && clinicalStandard?.chain?.valid === true;
  const boundChallenges = events.filter(event => event.eventType === "independent-review-admission-challenge-issued" && event.challenge.dossierFingerprint === dossier?.dossierFingerprint && event.challenge.dossierChainHead === dossier?.chain?.head && event.challenge.referenceDecisionDocketFingerprint === referenceDecision?.docketFingerprint && event.challenge.referenceDecisionChainHead === referenceDecision?.chain?.head && event.challenge.clinicalStandardDraftHash === clinicalStandard?.latestDraft?.hash && event.challenge.registryFingerprint === registrySummary.registryFingerprint);
  const activeChallengeEvent = [...boundChallenges].reverse().find(event => now <= Date.parse(event.challenge.expiresAt)) || null;
  const activeChallenge = activeChallengeEvent?.challenge || null;
  const verifiedEvents = activeChallenge ? events.filter(event => event.eventType === "independent-review-admission-attestation-verified" && event.attestation.challengeId === activeChallenge.challengeId) : [];
  const verifiedByPurpose = new Map(verifiedEvents.map(event => [event.attestation.purpose, event]));
  const duties = INDEPENDENT_REVIEW_ADMISSION_PURPOSES.map((purpose, index) => ({
    index: String(index + 1).padStart(2, "0"),
    purpose,
    label: {
      "authoritative-source-contract-acceptance": "Authoritative source contracts",
      "representative-case-set-freeze": "Representative case set + holdout",
      "clinical-standard-acceptance": "Clinical standard + analysis plan",
      "evaluator-charter-attestation": "Evaluator independence + charter",
      "legal-permission-attestation": "Legal permission",
      "privacy-permission-attestation": "Privacy permission",
      "independent-review-protocol-freeze": "Independent-review protocol freeze"
    }[purpose],
    status: verifiedByPurpose.has(purpose) ? "verified-external-duty" : "external-signature-required",
    attestationFingerprint: verifiedByPurpose.get(purpose)?.attestationFingerprint || null,
    keyFingerprint: verifiedByPurpose.get(purpose)?.keyFingerprint || null
  }));
  const protocolFrozen = verifiedByPurpose.has("independent-review-protocol-freeze") && verifiedEvents.length === 7;
  let status = "sealed-independent-review-dossier-required";
  if (localDossierCurrent) status = "counselor-reference-freeze-required";
  if (localDossierCurrent && referenceFreezeCurrent) status = "clinical-standard-draft-required";
  if (localDossierCurrent && referenceFreezeCurrent && clinicalStandardDraftCurrent) status = registrySummary.registryCurrent && registrySummary.activeKeyCount >= 7 ? activeChallenge ? "independent-review-admission-in-progress" : "independent-review-admission-challenge-required" : "independent-review-admission-registry-required";
  if (protocolFrozen) status = "independent-review-protocol-admitted";
  const flags = {
    sourceContractsAccepted: verifiedByPurpose.has("authoritative-source-contract-acceptance"),
    caseSetFrozen: verifiedByPurpose.has("representative-case-set-freeze"),
    clinicalStandardAccepted: verifiedByPurpose.has("clinical-standard-acceptance"),
    evaluatorCharterVerified: verifiedByPurpose.has("evaluator-charter-attestation"),
    legalPermissionVerified: verifiedByPurpose.has("legal-permission-attestation"),
    privacyPermissionVerified: verifiedByPurpose.has("privacy-permission-attestation"),
    independentReviewProtocolFrozen: protocolFrozen,
    independentReviewExecutionReady: protocolFrozen
  };
  const core = {
    contractVersion: INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
    status,
    dossierFingerprint: dossier?.dossierFingerprint || null,
    reviewPackageHash: dossier?.reviewPackageHash || null,
    dossierChainHead: dossier?.chain?.head || null,
    referenceDecisionDocketFingerprint: referenceDecision?.docketFingerprint || null,
    referenceDecisionChainHead: referenceDecision?.chain?.head || null,
    referenceFreezeAttestationFingerprint: referenceFreezeFingerprint(referenceDecision),
    clinicalStandardDraftHash: clinicalStandard?.latestDraft?.hash || null,
    prerequisites: { localDossierCurrent, referenceFreezeCurrent, clinicalStandardDraftCurrent },
    registry: registrySummary,
    activeChallenge,
    duties,
    counts: { requiredExternalDuties: 7, verifiedExternalDuties: verifiedEvents.length, admissionChallenges: boundChallenges.length, protocolFreezes: protocolFrozen ? 1 : 0 },
    ...flags,
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    registryWriteApiAvailable: false,
    signingApiAvailable: false,
    resultSubmissionApiAvailable: false,
    externalTransmissionPerformed: false,
    boundary: INDEPENDENT_REVIEW_ADMISSION_BOUNDARY
  };
  return {
    ...core,
    admissionFingerprint: independentReviewAdmissionDigest(core),
    history: events.slice().reverse().map(event => ({ sequence: event.sequence, eventType: event.eventType, purpose: event.attestation?.purpose || null, challengeId: event.challenge?.challengeId || event.attestation?.challengeId || null, actor: event.actor, createdAt: event.createdAt, hash: event.hash })),
    chain: clone(chain),
    generatedAt
  };
}
