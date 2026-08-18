import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const CANDIDATE_RETEST_DISPOSITION_CONTRACT = "perl-candidate-retest-independent-disposition/1.0";
export const CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT = "perl-candidate-retest-disposition-registry/1.0";
export const CANDIDATE_RETEST_DISPOSITION_CHALLENGE_CONTRACT = "perl-candidate-retest-disposition-challenge/1.0";
export const CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT = "perl-candidate-retest-disposition-attestation/1.0";

export const CANDIDATE_RETEST_DISPOSITION_PURPOSES = Object.freeze([
  "independent-accuracy-disposition",
  "independent-reliability-disposition",
  "clinical-standard-satisfaction-disposition",
  "independent-result-freeze"
]);

export const CANDIDATE_RETEST_DISPOSITION_BOUNDARY = "This chamber receives four ordered, purpose-bound Ed25519 decisions against one exact Same-Case Retest and Re-Review cycle after the independently admitted evaluation protocol is current: an independent accuracy disposition, an independent reliability disposition, the Clinical Standard owner's satisfaction disposition, and a final independent result freeze. It stores hashes, bounded decision enums, and public-key fingerprints—not evaluator names, human signatures, credentials, source workbooks, summary prose, Findings content, raw responses, case files, patient records, or PHI. A complete chain may recommend closing this exact synthetic refinement cycle or continuing refinement. It does not itself close the cycle, verify an external model execution, establish generalized accuracy, generalized reliability, comparative improvement, clinical performance, safety, clinical validity, or patient benefit; rank or select an engine; change care; authorize a pilot, deployment, production release, traffic activation, or patient use; or allow PERL to create trust keys, sign a return, or accept its own evidence.";

export const CANDIDATE_RETEST_CYCLE_COMPARISONS = Object.freeze([
  "retest-supported",
  "baseline-supported",
  "materially-equivalent",
  "inconclusive"
]);

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HASH = /^(GENESIS|[a-f0-9]{64})$/;
const KEY_ID = /^FF-RETEST-DISPOSITION-KEY-[A-Z0-9-]{3,80}$/;
const REGISTRY_ID = /^FF-RETEST-DISPOSITION-REGISTRY-[A-Z0-9-]{3,80}$/;
const CHALLENGE_ID = /^FF-RETEST-DISPOSITION-CHALLENGE-[A-F0-9-]{20,80}$/;
const ATTESTATION_ID = /^FF-RETEST-DISPOSITION-ATTEST-[A-Z0-9-]{3,80}$/;
const CYCLE_ID = /^FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const NONCE = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_ATTESTATION_BYTES = 64 * 1024;

const DOMAIN_DISPOSITIONS = Object.freeze(["meets-standard", "does-not-meet-standard", "inconclusive"]);
const BURDEN_DISPOSITIONS = Object.freeze(["acceptable", "not-acceptable", "inconclusive"]);
const ACCURACY_OUTCOMES = Object.freeze(["accuracy-supported-for-frozen-cycle", "accuracy-not-supported", "inconclusive"]);
const RELIABILITY_ESTIMATES = Object.freeze(["sufficient-for-frozen-cycle", "insufficient", "inconclusive"]);
const RELIABILITY_OUTCOMES = Object.freeze(["reliability-supported-for-frozen-cycle", "reliability-not-supported", "inconclusive"]);
const STANDARD_OUTCOMES = Object.freeze(["clinical-standard-met-for-frozen-cycle", "clinical-standard-not-met", "further-refinement-required"]);
const CYCLE_RECOMMENDATIONS = Object.freeze(["close-this-refinement-cycle", "continue-refinement", "hold-study"]);
const CANDIDATE_RECOMMENDATIONS = Object.freeze(["advance-to-separate-provider-model-decision", "retain-baseline-and-refine", "no-advancement"]);

const CONTENT_BOUNDARY = Object.freeze({
  evaluatorNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  sourceWorkbookBytesIncluded: false,
  summaryProseIncluded: false,
  findingsContentIncluded: false,
  rawResponsesIncluded: false,
  caseFilesIncluded: false,
  patientIdentifiersIncluded: false,
  patientRecordsIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

const FALSE_CLAIMS = Object.freeze([
  "externalModelExecutionVerified",
  "generalizedAccuracyEstablished",
  "generalizedReliabilityEstablished",
  "comparativeImprovementEstablished",
  "clinicalPerformanceEstablished",
  "safetyEstablished",
  "clinicalValidation",
  "engineRanked",
  "engineSelected",
  "cycleClosed",
  "carePlanChanged",
  "pilotAuthorized",
  "deploymentAuthorized",
  "productionReleaseAuthorized",
  "trafficActivationAuthorized",
  "patientUseAuthorized"
]);

const clone = value => structuredClone(value);
const finiteDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalCandidateRetestDispositionJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function candidateRetestDispositionDigest(value) {
  return createHash("sha256").update(canonicalCandidateRetestDispositionJson(value)).digest("hex");
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

function falseClaims() {
  return Object.fromEntries(FALSE_CLAIMS.map(key => [key, false]));
}

function validateContentBoundary(boundary, label, errors) {
  const keys = Object.keys(CONTENT_BOUNDARY);
  if (!exactKeys(boundary, keys, label, errors)) return;
  for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
}

function mappedDifference(event) {
  if (event?.differenceDisposition === "materially-equivalent") return "materially-equivalent";
  if (event?.differenceDisposition === "uncertain") return "inconclusive";
  if (event?.differenceDisposition === "retest-stronger") return "retest-supported";
  if (event?.differenceDisposition === "baseline-stronger") return "baseline-supported";
  if (event?.differenceDisposition === "x-stronger") return event?.pairMapping?.X === "retest" ? "retest-supported" : "baseline-supported";
  if (event?.differenceDisposition === "y-stronger") return event?.pairMapping?.Y === "retest" ? "retest-supported" : "baseline-supported";
  return "inconclusive";
}

export function candidateRetestDispositionAnalysis({ cycleId, reviewEvents = [] } = {}) {
  const events = reviewEvents.filter(event => event.cycleId === cycleId).slice().sort((left, right) => left.sequence - right.sequence);
  const mapped = events.map(mappedDifference);
  const counts = Object.fromEntries(CANDIDATE_RETEST_CYCLE_COMPARISONS.map(value => [value, mapped.filter(item => item === value).length]));
  const reviewerHashes = [...new Set(events.map(event => event.reviewerCodeHash))].sort();
  const caseIds = [...new Set(events.map(event => event.caseId))].sort();
  const correctionCells = events.flatMap(event => event.cells || []).filter(cell => cell.correctionBurden !== "none").length;
  const dissentFlags = events.flatMap(event => event.cells || []).reduce((sum, cell) => sum + (cell.dissentFlags?.length || 0), 0);
  const directRatingCount = events.flatMap(event => event.cells || []).length * 4;
  const core = {
    protocol: "same-case-retest-independent-disposition-analysis-v1",
    cycleId: cycleId || null,
    reviewPacketCount: events.length,
    distinctReviewerCodeCount: reviewerHashes.length,
    distinctCaseCount: caseIds.length,
    comparisonCounts: counts,
    correctionCells,
    dissentFlags,
    directRatingCount,
    sourceEventHashes: events.map(event => event.hash),
    reviewerIdentityIncluded: false,
    summaryProseIncluded: false,
    generalizedPerformanceClaimed: false
  };
  return { ...core, analysisHash: candidateRetestDispositionDigest(core) };
}

export function disabledCandidateRetestDispositionRegistry() {
  return {
    contractVersion: CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT,
    registryId: "FF-RETEST-DISPOSITION-REGISTRY-DISABLED",
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export function candidateRetestDispositionRegistryTemplate() {
  return {
    contractVersion: CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT,
    registryId: "FF-RETEST-DISPOSITION-REGISTRY-REPLACE-ME",
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: CANDIDATE_RETEST_DISPOSITION_PURPOSES.map((purpose, index) => ({
      keyId: `FF-RETEST-DISPOSITION-KEY-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null
    })),
    provisioningBoundary: "Provision four distinct purpose-bound public keys in this owner-only file outside PERL and supply its path only at server startup. PERL exposes no registry-write or signing API."
  };
}

export function validateCandidateRetestDispositionRegistry(registry, { allowDisabled = true } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push("Candidate retest disposition registry exceeds the 256 KB startup limit.");
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], "Candidate retest disposition registry", errors)) return errors;
  if (registry.contractVersion !== CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT) errors.push("Candidate retest disposition registry contractVersion is invalid.");
  if (!REGISTRY_ID.test(String(registry.registryId || "")) || !/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push("Candidate retest disposition registry identity is invalid.");
  if (!Array.isArray(registry.keys)) errors.push("Candidate retest disposition registry keys must be an array.");
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (disabled && !allowDisabled) errors.push("Four candidate retest disposition keys are required.");
  if (disabled && (registry.registryId !== "FF-RETEST-DISPOSITION-REGISTRY-DISABLED" || registry.version !== "0.0.0")) errors.push("An empty candidate retest disposition registry must use the disabled identity.");
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push("Candidate retest disposition registry dates must define a valid window.");
  if (keys.length > 16) errors.push("Candidate retest disposition registry may contain at most 16 keys.");
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `Candidate retest disposition key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || "")) || keyIds.has(key.keyId)) errors.push(`${label} keyId is invalid or repeated.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519" || !CANDIDATE_RETEST_DISPOSITION_PURPOSES.includes(key.purpose)) errors.push(`${label} algorithm or purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint || fingerprints.has(fingerprint)) errors.push(`${label} must contain distinct bounded Ed25519 key material.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must stay inside the registry window.`);
  }
  if (!disabled) for (const purpose of CANDIDATE_RETEST_DISPOSITION_PURPOSES) if (keys.filter(key => key.purpose === purpose).length !== 1) errors.push(`Candidate retest disposition registry requires exactly one key for ${purpose}.`);
  return [...new Set(errors)];
}

export const candidateRetestDispositionRegistryFingerprint = registry => candidateRetestDispositionDigest(registry);

export function summarizeCandidateRetestDispositionRegistry(registry, generatedAt = new Date().toISOString()) {
  const errors = validateCandidateRetestDispositionRegistry(registry);
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
    registryFingerprint: candidateRetestDispositionRegistryFingerprint(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(CANDIDATE_RETEST_DISPOSITION_PURPOSES.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false,
    signingApiAvailable: false
  };
}

function selectedCycle(candidateRetest, cycleId = null) {
  return candidateRetest?.cycles?.find(cycle => cycle.cycleId === (cycleId || candidateRetest.selectedCycleId)) || null;
}

function dispositionPackage({ candidateRetest, cycle, analysis, admission }) {
  const core = {
    cycleId: cycle?.cycleId || null,
    cycleEventHash: cycle?.cycleEventHash || null,
    returnSetFingerprint: cycle?.returnSetFingerprint || null,
    retestProtocolFingerprint: cycle?.retestProtocolFingerprint || null,
    candidateRetestStudioFingerprint: candidateRetest?.studioFingerprint || null,
    candidateRefinementChainHead: candidateRetest?.chains?.refinement?.head || null,
    candidateRetestReturnChainHead: candidateRetest?.chains?.retestReturns?.head || null,
    candidateRetestReviewChainHead: candidateRetest?.chains?.pairedReviews?.head || null,
    reviewAnalysisHash: analysis?.analysisHash || null,
    independentReviewAdmissionFingerprint: admission?.admissionFingerprint || null,
    independentReviewAdmissionChainHead: admission?.chain?.head || null,
    clinicalStandardDraftHash: admission?.clinicalStandardDraftHash || null
  };
  return { ...core, dispositionPackageHash: candidateRetestDispositionDigest(core) };
}

export function createCandidateRetestDispositionChallenge({ candidateRetest, cycleId = null, analysis, admission, registry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), challengeId = `FF-RETEST-DISPOSITION-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") } = {}) {
  const cycle = selectedCycle(candidateRetest, cycleId);
  const evidence = dispositionPackage({ candidateRetest, cycle, analysis, admission });
  const challenge = {
    contractVersion: CANDIDATE_RETEST_DISPOSITION_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    ...evidence,
    registryFingerprint: candidateRetestDispositionRegistryFingerprint(registry),
    requiredPurposeOrder: [...CANDIDATE_RETEST_DISPOSITION_PURPOSES],
    decisionMode: "record-exact-independent-cycle-disposition-no-release-authority",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: clone(CONTENT_BOUNDARY)
  };
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "candidate-retest-disposition-challenge-issued",
    contractVersion: CANDIDATE_RETEST_DISPOSITION_CONTRACT,
    challenge,
    actor,
    createdAt,
    independentAccuracyDispositionRecorded: false,
    independentReliabilityDispositionRecorded: false,
    clinicalStandardSatisfactionRecorded: false,
    independentResultFrozen: false,
    cycleCloseRecommended: false,
    candidateAdvancementRecommended: false,
    ...falseClaims(),
    boundary: CANDIDATE_RETEST_DISPOSITION_BOUNDARY
  };
  return { ...core, hash: candidateRetestDispositionDigest(core) };
}

export function validateCandidateRetestDispositionChallenge(challenge, { candidateRetest, analysis, admission, registryFingerprint, cycleId = null } = {}) {
  const errors = [];
  const evidenceKeys = ["cycleId", "cycleEventHash", "returnSetFingerprint", "retestProtocolFingerprint", "candidateRetestStudioFingerprint", "candidateRefinementChainHead", "candidateRetestReturnChainHead", "candidateRetestReviewChainHead", "reviewAnalysisHash", "independentReviewAdmissionFingerprint", "independentReviewAdmissionChainHead", "clinicalStandardDraftHash", "dispositionPackageHash"];
  const keys = ["contractVersion", "challengeId", "nonce", ...evidenceKeys, "registryFingerprint", "requiredPurposeOrder", "decisionMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Candidate retest disposition challenge", errors)) return errors;
  if (challenge.contractVersion !== CANDIDATE_RETEST_DISPOSITION_CHALLENGE_CONTRACT || !CHALLENGE_ID.test(String(challenge.challengeId || "")) || !NONCE.test(String(challenge.nonce || "")) || !CYCLE_ID.test(String(challenge.cycleId || ""))) errors.push("Candidate retest disposition challenge identity is invalid.");
  for (const key of evidenceKeys.filter(key => key !== "cycleId")) if (!HEX.test(String(challenge[key] || ""))) errors.push(`Candidate retest disposition challenge ${key} is invalid.`);
  if (!HEX.test(String(challenge.registryFingerprint || ""))) errors.push("Candidate retest disposition challenge registryFingerprint is invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Candidate retest disposition challenge must use the exact 24-hour window.");
  if (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(CANDIDATE_RETEST_DISPOSITION_PURPOSES) || challenge.decisionMode !== "record-exact-independent-cycle-disposition-no-release-authority") errors.push("Candidate retest disposition challenge purpose order or mode is invalid.");
  validateContentBoundary(challenge.contentBoundary, "Candidate retest disposition challenge contentBoundary", errors);
  if (candidateRetest) {
    const cycle = selectedCycle(candidateRetest, cycleId || challenge.cycleId);
    const expected = dispositionPackage({ candidateRetest, cycle, analysis, admission });
    for (const key of evidenceKeys) if (challenge[key] !== expected[key]) errors.push(`Candidate retest disposition challenge is stale at ${key}.`);
    if (cycle?.localPairedEvidenceComplete !== true) errors.push("Candidate retest disposition challenge requires complete local paired evidence.");
    if (candidateRetest?.chains?.refinement?.valid !== true || candidateRetest?.chains?.retestReturns?.valid !== true || candidateRetest?.chains?.pairedReviews?.valid !== true) errors.push("Candidate retest disposition challenge requires three intact upstream evidence chains.");
  }
  if (admission && (admission.independentReviewProtocolFrozen !== true || admission.independentReviewExecutionReady !== true || admission.chain?.valid !== true)) errors.push("Candidate retest disposition challenge requires the current admitted independent-review protocol.");
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Candidate retest disposition challenge registry is stale.");
  return [...new Set(errors)];
}

function hashFields(decision, fields, label, errors) {
  for (const key of fields) if (!HEX.test(String(decision?.[key] || ""))) errors.push(`${label} ${key} is invalid.`);
}

function validateDecision(attestation, challenge, priorAttestations, errors) {
  const decision = attestation.decision;
  if (attestation.purpose === "independent-accuracy-disposition") {
    const keys = ["analysisPlanHash", "sourceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness", "correctionBurden", "cycleComparison", "outcome"];
    if (!exactKeys(decision, keys, "Accuracy decision", errors)) return;
    hashFields(decision, ["analysisPlanHash"], "Accuracy decision", errors);
    for (const key of ["sourceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"]) if (!DOMAIN_DISPOSITIONS.includes(decision[key])) errors.push(`Accuracy decision ${key} is invalid.`);
    if (!BURDEN_DISPOSITIONS.includes(decision.correctionBurden) || !CANDIDATE_RETEST_CYCLE_COMPARISONS.includes(decision.cycleComparison) || !ACCURACY_OUTCOMES.includes(decision.outcome)) errors.push("Accuracy decision disposition is invalid.");
    const allMeet = [decision.sourceFidelity, decision.criticalSafetyHandling, decision.clinicalRestraint, decision.conversationUsefulness].every(value => value === "meets-standard") && decision.correctionBurden === "acceptable";
    if ((decision.outcome === "accuracy-supported-for-frozen-cycle") !== allMeet) errors.push("Accuracy outcome is inconsistent with its domain dispositions.");
  } else if (attestation.purpose === "independent-reliability-disposition") {
    const keys = ["agreementAnalysisHash", "reviewerOverlapAccepted", "caseCoverageAccepted", "reliabilityEstimate", "outcome"];
    if (!exactKeys(decision, keys, "Reliability decision", errors)) return;
    hashFields(decision, ["agreementAnalysisHash"], "Reliability decision", errors);
    if (typeof decision.reviewerOverlapAccepted !== "boolean" || typeof decision.caseCoverageAccepted !== "boolean" || !RELIABILITY_ESTIMATES.includes(decision.reliabilityEstimate) || !RELIABILITY_OUTCOMES.includes(decision.outcome)) errors.push("Reliability decision is invalid.");
    const supported = decision.reviewerOverlapAccepted && decision.caseCoverageAccepted && decision.reliabilityEstimate === "sufficient-for-frozen-cycle";
    if ((decision.outcome === "reliability-supported-for-frozen-cycle") !== supported) errors.push("Reliability outcome is inconsistent with its evidence dispositions.");
  } else if (attestation.purpose === "clinical-standard-satisfaction-disposition") {
    const keys = ["clinicalStandardDraftHash", "accuracyAttestationFingerprint", "reliabilityAttestationFingerprint", "clientConfirmationReferenceHash", "satisfactionThresholdMet", "outcome"];
    if (!exactKeys(decision, keys, "Clinical Standard decision", errors)) return;
    hashFields(decision, ["clinicalStandardDraftHash", "accuracyAttestationFingerprint", "reliabilityAttestationFingerprint", "clientConfirmationReferenceHash"], "Clinical Standard decision", errors);
    const accuracy = priorAttestations.get("independent-accuracy-disposition");
    const reliability = priorAttestations.get("independent-reliability-disposition");
    if (decision.clinicalStandardDraftHash !== challenge?.clinicalStandardDraftHash || decision.accuracyAttestationFingerprint !== candidateRetestDispositionDigest(accuracy) || decision.reliabilityAttestationFingerprint !== candidateRetestDispositionDigest(reliability)) errors.push("Clinical Standard decision does not bind the current standard and two prior dispositions.");
    if (typeof decision.satisfactionThresholdMet !== "boolean" || !STANDARD_OUTCOMES.includes(decision.outcome) || (decision.outcome === "clinical-standard-met-for-frozen-cycle") !== decision.satisfactionThresholdMet) errors.push("Clinical Standard decision outcome is inconsistent.");
  } else if (attestation.purpose === "independent-result-freeze") {
    const keys = ["priorAttestationFingerprints", "frozenDispositionPackageHash", "cycleCloseRecommendation", "candidateRecommendation", "outcome"];
    if (!exactKeys(decision, keys, "Independent result-freeze decision", errors)) return;
    const priorPurposes = CANDIDATE_RETEST_DISPOSITION_PURPOSES.slice(0, -1);
    const expected = priorPurposes.map(purpose => priorAttestations.get(purpose)).filter(Boolean).map(item => candidateRetestDispositionDigest(item));
    if (expected.length !== priorPurposes.length || JSON.stringify(decision.priorAttestationFingerprints) !== JSON.stringify(expected)) errors.push("Independent result freeze must bind the three prior attestations in required order.");
    if (decision.frozenDispositionPackageHash !== challenge?.dispositionPackageHash || !CYCLE_RECOMMENDATIONS.includes(decision.cycleCloseRecommendation) || !CANDIDATE_RECOMMENDATIONS.includes(decision.candidateRecommendation) || decision.outcome !== "independent-result-frozen") errors.push("Independent result-freeze decision is incomplete.");
    const accuracySupported = priorAttestations.get("independent-accuracy-disposition")?.decision?.outcome === "accuracy-supported-for-frozen-cycle";
    const reliabilitySupported = priorAttestations.get("independent-reliability-disposition")?.decision?.outcome === "reliability-supported-for-frozen-cycle";
    const standardMet = priorAttestations.get("clinical-standard-satisfaction-disposition")?.decision?.outcome === "clinical-standard-met-for-frozen-cycle";
    const closeAllowed = accuracySupported && reliabilitySupported && standardMet;
    if (!closeAllowed && decision.cycleCloseRecommendation === "close-this-refinement-cycle") errors.push("Cycle-close recommendation is inconsistent with the three prior dispositions.");
    if (!closeAllowed && decision.candidateRecommendation === "advance-to-separate-provider-model-decision") errors.push("Candidate advancement recommendation is inconsistent with the three prior dispositions.");
  }
}

function signaturePayload(attestation) {
  const { signature, ...unsigned } = attestation;
  return Buffer.from(canonicalCandidateRetestDispositionJson(unsigned));
}

export function validateCandidateRetestDispositionAttestation(attestation, { challenge, registry, priorAttestations = new Map(), now = new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(attestation ?? null)) > MAX_ATTESTATION_BYTES) errors.push("Candidate retest disposition attestation exceeds the 64 KB limit.");
  const keys = ["contractVersion", "attestationId", "challengeId", "nonce", "registryFingerprint", "dispositionPackageHash", "purpose", "keyId", "issuedAt", "decision", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "Candidate retest disposition attestation", errors)) return errors;
  if (attestation.contractVersion !== CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT || !ATTESTATION_ID.test(String(attestation.attestationId || "")) || !CANDIDATE_RETEST_DISPOSITION_PURPOSES.includes(attestation.purpose) || !KEY_ID.test(String(attestation.keyId || ""))) errors.push("Candidate retest disposition attestation identity is invalid.");
  if (!finiteDate(attestation.issuedAt) || !NONCE.test(String(attestation.nonce || "")) || !HEX.test(String(attestation.registryFingerprint || "")) || !HEX.test(String(attestation.dispositionPackageHash || ""))) errors.push("Candidate retest disposition attestation evidence metadata is invalid.");
  validateContentBoundary(attestation.contentBoundary, "Candidate retest disposition attestation contentBoundary", errors);
  if (!challenge || attestation.challengeId !== challenge.challengeId || attestation.nonce !== challenge.nonce || attestation.registryFingerprint !== challenge.registryFingerprint || attestation.dispositionPackageHash !== challenge.dispositionPackageHash) errors.push("Candidate retest disposition attestation does not match the issued challenge.");
  if (challenge && (Date.parse(now) > Date.parse(challenge.expiresAt) || Date.parse(attestation.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(attestation.issuedAt) > Date.parse(now) + CLOCK_SKEW_MS)) errors.push("Candidate retest disposition attestation is outside the challenge time window.");
  if (seenAttestationIds.has(attestation.attestationId) || seenPurposes.has(attestation.purpose)) errors.push("Candidate retest disposition attestation ID or purpose has already been recorded.");
  const expectedPurpose = CANDIDATE_RETEST_DISPOSITION_PURPOSES[priorAttestations.size];
  if (attestation.purpose !== expectedPurpose) errors.push(`Candidate retest disposition duties must be verified in order; ${expectedPurpose || "no further purpose"} is next.`);
  validateDecision(attestation, challenge, priorAttestations, errors);
  if (!exactKeys(attestation.signature, ["algorithm", "keyId", "value"], "Candidate retest disposition signature", errors)) return [...new Set(errors)];
  if (attestation.signature.algorithm !== "Ed25519" || attestation.signature.keyId !== attestation.keyId || !SIGNATURE.test(String(attestation.signature.value || ""))) errors.push("Candidate retest disposition signature envelope is invalid.");
  const key = registry?.keys?.find(item => item.keyId === attestation.keyId && item.purpose === attestation.purpose);
  if (!key) errors.push("Candidate retest disposition signing key is not trusted for this purpose.");
  if (key && (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(attestation.issuedAt) < Date.parse(key.notBefore) || Date.parse(attestation.issuedAt) > Date.parse(key.notAfter))) errors.push("Candidate retest disposition signing key is outside its validity window.");
  const signatureHash = candidateRetestDispositionDigest(attestation.signature.value);
  if (seenSignatureHashes.has(signatureHash)) errors.push("Candidate retest disposition signature has already been used.");
  if (key && SIGNATURE.test(String(attestation.signature.value || ""))) {
    try {
      const valid = verifySignature(null, signaturePayload(attestation), createPublicKey(key.publicKeyPem), Buffer.from(attestation.signature.value, "base64url"));
      if (!valid) errors.push("Candidate retest disposition signature verification failed.");
    } catch {
      errors.push("Candidate retest disposition signature verification failed.");
    }
  }
  return [...new Set(errors)];
}

export function createCandidateRetestDispositionAttestationEvent({ attestation, registry, actor, sequence, previousHash, verifiedAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const key = registry.keys.find(item => item.keyId === attestation.keyId && item.purpose === attestation.purpose);
  const core = {
    id,
    sequence,
    previousHash,
    eventType: "candidate-retest-disposition-attestation-verified",
    contractVersion: CANDIDATE_RETEST_DISPOSITION_CONTRACT,
    attestation: clone(attestation),
    attestationFingerprint: candidateRetestDispositionDigest(attestation),
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actor,
    createdAt: verifiedAt,
    independentAccuracyDispositionRecorded: attestation.purpose === "independent-accuracy-disposition",
    independentReliabilityDispositionRecorded: attestation.purpose === "independent-reliability-disposition",
    clinicalStandardSatisfactionRecorded: attestation.purpose === "clinical-standard-satisfaction-disposition",
    independentResultFrozen: attestation.purpose === "independent-result-freeze",
    cycleCloseRecommended: attestation.purpose === "independent-result-freeze" && attestation.decision.cycleCloseRecommendation === "close-this-refinement-cycle",
    candidateAdvancementRecommended: attestation.purpose === "independent-result-freeze" && attestation.decision.candidateRecommendation === "advance-to-separate-provider-model-decision",
    ...falseClaims(),
    boundary: CANDIDATE_RETEST_DISPOSITION_BOUNDARY
  };
  return { ...core, hash: candidateRetestDispositionDigest(core) };
}

export function validateCandidateRetestDispositionEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, registry, challenge, priorAttestations = new Map(), now = event?.createdAt || new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  const claimKeys = ["independentAccuracyDispositionRecorded", "independentReliabilityDispositionRecorded", "clinicalStandardSatisfactionRecorded", "independentResultFrozen", "cycleCloseRecommended", "candidateAdvancementRecommended", ...FALSE_CLAIMS];
  const common = ["id", "sequence", "previousHash", "eventType", "contractVersion", "actor", "createdAt", ...claimKeys, "boundary", "hash"];
  const keys = event?.eventType === "candidate-retest-disposition-challenge-issued" ? [...common.slice(0, 5), "challenge", ...common.slice(5)] : [...common.slice(0, 5), "attestation", "attestationFingerprint", "keyFingerprint", ...common.slice(5)];
  if (!exactKeys(event, keys, "Candidate retest disposition event", errors)) return errors;
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1 || event.previousHash !== previousHash || !CHAIN_HASH.test(String(event.previousHash || "")) || event.contractVersion !== CANDIDATE_RETEST_DISPOSITION_CONTRACT || !ACTOR.test(String(event.actor || "")) || !finiteDate(event.createdAt)) errors.push("Candidate retest disposition event chain position or identity is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (String(event.boundary || "") !== CANDIDATE_RETEST_DISPOSITION_BOUNDARY) errors.push("Candidate retest disposition boundary is invalid.");
  if (event.eventType === "candidate-retest-disposition-challenge-issued") {
    if (validateCandidateRetestDispositionChallenge(event.challenge).length) errors.push("Candidate retest disposition challenge event contains an invalid challenge.");
    for (const key of claimKeys.filter(key => !FALSE_CLAIMS.includes(key))) if (event[key] !== false) errors.push(`${key} must remain false on challenge issuance.`);
  } else if (event.eventType === "candidate-retest-disposition-attestation-verified") {
    errors.push(...validateCandidateRetestDispositionAttestation(event.attestation, { challenge, registry, priorAttestations, now, seenAttestationIds, seenSignatureHashes, seenPurposes }));
    if (event.attestationFingerprint !== candidateRetestDispositionDigest(event.attestation) || !HEX.test(String(event.keyFingerprint || ""))) errors.push("Candidate retest disposition attestation fingerprints are invalid.");
    const purpose = event.attestation?.purpose;
    if (event.independentAccuracyDispositionRecorded !== (purpose === "independent-accuracy-disposition") || event.independentReliabilityDispositionRecorded !== (purpose === "independent-reliability-disposition") || event.clinicalStandardSatisfactionRecorded !== (purpose === "clinical-standard-satisfaction-disposition") || event.independentResultFrozen !== (purpose === "independent-result-freeze")) errors.push("Candidate retest disposition event purpose claims are inconsistent.");
    const close = purpose === "independent-result-freeze" && event.attestation.decision.cycleCloseRecommendation === "close-this-refinement-cycle";
    const advance = purpose === "independent-result-freeze" && event.attestation.decision.candidateRecommendation === "advance-to-separate-provider-model-decision";
    if (event.cycleCloseRecommended !== close || event.candidateAdvancementRecommended !== advance) errors.push("Candidate retest disposition recommendations are inconsistent.");
  } else {
    errors.push("Candidate retest disposition event type is invalid.");
  }
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || candidateRetestDispositionDigest(core) !== hash) errors.push("Candidate retest disposition event hash is invalid.");
  return [...new Set(errors)];
}

export function buildCandidateRetestDispositionDocket({ candidateRetest, cycleId = null, analysis, admission, registry = disabledCandidateRetestDispositionRegistry(), events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const cycle = selectedCycle(candidateRetest, cycleId);
  const evidence = dispositionPackage({ candidateRetest, cycle, analysis, admission });
  const registrySummary = summarizeCandidateRetestDispositionRegistry(registry, generatedAt);
  const localPairedEvidenceCurrent = cycle?.localPairedEvidenceComplete === true && candidateRetest?.chains?.refinement?.valid === true && candidateRetest?.chains?.retestReturns?.valid === true && candidateRetest?.chains?.pairedReviews?.valid === true && analysis?.reviewPacketCount >= 6 && analysis?.distinctCaseCount === 3 && analysis?.distinctReviewerCodeCount >= 2;
  const independentProtocolCurrent = admission?.independentReviewProtocolFrozen === true && admission?.independentReviewExecutionReady === true && admission?.chain?.valid === true && HEX.test(String(admission?.admissionFingerprint || ""));
  const boundChallenges = events.filter(event => event.eventType === "candidate-retest-disposition-challenge-issued" && event.challenge.dispositionPackageHash === evidence.dispositionPackageHash && event.challenge.registryFingerprint === registrySummary.registryFingerprint);
  const now = Date.parse(generatedAt);
  const activeChallengeEvent = [...boundChallenges].reverse().find(event => now <= Date.parse(event.challenge.expiresAt)) || null;
  const activeChallenge = activeChallengeEvent?.challenge || null;
  const verifiedEvents = activeChallenge ? events.filter(event => event.eventType === "candidate-retest-disposition-attestation-verified" && event.attestation.challengeId === activeChallenge.challengeId) : [];
  const verifiedByPurpose = new Map(verifiedEvents.map(event => [event.attestation.purpose, event]));
  const duties = CANDIDATE_RETEST_DISPOSITION_PURPOSES.map((purpose, index) => ({
    index: String(index + 1).padStart(2, "0"),
    purpose,
    label: {
      "independent-accuracy-disposition": "Independent accuracy disposition",
      "independent-reliability-disposition": "Independent reliability disposition",
      "clinical-standard-satisfaction-disposition": "Clinical Standard satisfaction",
      "independent-result-freeze": "Independent result freeze"
    }[purpose],
    authority: {
      "independent-accuracy-disposition": "Independent evaluator · accuracy duty",
      "independent-reliability-disposition": "Independent evaluator · reliability duty",
      "clinical-standard-satisfaction-disposition": "Clinical Standard owner",
      "independent-result-freeze": "Independent evaluation custodian"
    }[purpose],
    status: verifiedByPurpose.has(purpose) ? "verified-external-duty" : "external-signature-required",
    attestationFingerprint: verifiedByPurpose.get(purpose)?.attestationFingerprint || null,
    keyFingerprint: verifiedByPurpose.get(purpose)?.keyFingerprint || null
  }));
  const frozenEvent = verifiedByPurpose.get("independent-result-freeze") || null;
  const independentResultFrozen = verifiedEvents.length === 4 && Boolean(frozenEvent);
  const accuracyOutcome = verifiedByPurpose.get("independent-accuracy-disposition")?.attestation?.decision?.outcome || null;
  const reliabilityOutcome = verifiedByPurpose.get("independent-reliability-disposition")?.attestation?.decision?.outcome || null;
  const standardOutcome = verifiedByPurpose.get("clinical-standard-satisfaction-disposition")?.attestation?.decision?.outcome || null;
  const cycleRecommendation = frozenEvent?.attestation?.decision?.cycleCloseRecommendation || null;
  const candidateRecommendation = frozenEvent?.attestation?.decision?.candidateRecommendation || null;
  let status = "local-paired-evidence-required";
  if (localPairedEvidenceCurrent) status = "independent-review-protocol-admission-required";
  if (localPairedEvidenceCurrent && independentProtocolCurrent) status = registrySummary.registryCurrent && registrySummary.activeKeyCount >= 4 ? activeChallenge ? "independent-disposition-in-progress" : "disposition-challenge-required" : "disposition-registry-required";
  if (independentResultFrozen) status = "independent-disposition-frozen";
  const core = {
    contractVersion: CANDIDATE_RETEST_DISPOSITION_CONTRACT,
    status,
    headline: "Let the outside decision arrive with its own key.",
    descriptor: "Four signatures can freeze an exact cycle disposition. None can quietly turn it into clinical validation or release.",
    cycleId: cycle?.cycleId || null,
    evidence,
    prerequisites: { localPairedEvidenceCurrent, independentProtocolCurrent },
    registry: registrySummary,
    activeChallenge,
    duties,
    counts: {
      requiredExternalDuties: 4,
      verifiedExternalDuties: verifiedEvents.length,
      reviewPackets: Number(analysis?.reviewPacketCount || 0),
      casesCovered: Number(analysis?.distinctCaseCount || 0),
      reviewerCodesObserved: Number(analysis?.distinctReviewerCodeCount || 0),
      resultFreezes: independentResultFrozen ? 1 : 0
    },
    analysis: analysis ? clone(analysis) : null,
    disposition: {
      accuracyOutcome,
      reliabilityOutcome,
      clinicalStandardOutcome: standardOutcome,
      cycleCloseRecommendation: cycleRecommendation,
      candidateRecommendation
    },
    independentAccuracyDispositionRecorded: verifiedByPurpose.has("independent-accuracy-disposition"),
    independentReliabilityDispositionRecorded: verifiedByPurpose.has("independent-reliability-disposition"),
    clinicalStandardSatisfactionRecorded: verifiedByPurpose.has("clinical-standard-satisfaction-disposition"),
    independentResultFrozen,
    cycleCloseRecommended: cycleRecommendation === "close-this-refinement-cycle",
    candidateAdvancementRecommended: candidateRecommendation === "advance-to-separate-provider-model-decision",
    ...falseClaims(),
    registryWriteApiAvailable: false,
    signingApiAvailable: false,
    externalTransmissionPerformed: false,
    boundary: CANDIDATE_RETEST_DISPOSITION_BOUNDARY
  };
  return {
    ...core,
    dispositionFingerprint: candidateRetestDispositionDigest(core),
    history: events.slice().reverse().map(event => ({ sequence: event.sequence, eventType: event.eventType, purpose: event.attestation?.purpose || null, challengeId: event.challenge?.challengeId || event.attestation?.challengeId || null, actor: event.actor, createdAt: event.createdAt, hash: event.hash })),
    chain: clone(chain),
    generatedAt
  };
}

export function validateCandidateRetestDispositionContract() {
  const errors = [];
  if (CANDIDATE_RETEST_DISPOSITION_PURPOSES.length !== 4 || new Set(CANDIDATE_RETEST_DISPOSITION_PURPOSES).size !== 4) errors.push("Candidate retest disposition must preserve four distinct ordered duties.");
  if (!/third|outside|independent/i.test(CANDIDATE_RETEST_DISPOSITION_BOUNDARY) || !/does not itself close the cycle/i.test(CANDIDATE_RETEST_DISPOSITION_BOUNDARY) || !/generalized accuracy/i.test(CANDIDATE_RETEST_DISPOSITION_BOUNDARY) || !/patient use/i.test(CANDIDATE_RETEST_DISPOSITION_BOUNDARY)) errors.push("Candidate retest disposition boundary is incomplete.");
  if (Object.values(CONTENT_BOUNDARY).some(Boolean)) errors.push("Candidate retest disposition content boundary must remain metadata-only.");
  return errors;
}
