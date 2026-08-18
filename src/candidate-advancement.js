import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";

export const CANDIDATE_ADVANCEMENT_CONTRACT = "perl-exact-candidate-advancement-airlock/1.0";
export const CANDIDATE_CYCLE_ACTION_REGISTRY_CONTRACT = "perl-candidate-cycle-action-registry/1.0";
export const CANDIDATE_CYCLE_ACTION_CHALLENGE_CONTRACT = "perl-candidate-cycle-action-challenge/1.0";
export const CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT = "perl-candidate-cycle-action-attestation/1.0";
export const CANDIDATE_ADVANCEMENT_REGISTRY_CONTRACT = "perl-candidate-advancement-registry/1.0";
export const CANDIDATE_ADVANCEMENT_CHALLENGE_CONTRACT = "perl-candidate-advancement-challenge/1.0";
export const CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT = "perl-candidate-advancement-attestation/1.0";

export const CANDIDATE_CYCLE_ACTION_PURPOSES = Object.freeze([
  "clinical-cycle-action",
  "evaluation-custody-confirmation"
]);

export const CANDIDATE_ADVANCEMENT_PURPOSES = Object.freeze([
  "clinical-suitability-advancement",
  "privacy-security-transport-fit",
  "eqpass-integration-fit",
  "product-sponsor-advancement-freeze"
]);

export const CANDIDATE_ADVANCEMENT_BOUNDARY = "This two-room airlock acts only after an independently signed result exists for one exact synthetic Same-Case Retest cycle. Room I records a separately signed close, continue, or hold action for that exact refinement cycle. Only a signed close paired with an upstream advancement recommendation can unblind Room II, where four distinct duties may advance, retain, or hold the exact candidate, provider, model version, prompt version, policy, output contract, and retest protocol for integration-readiness work. The airlock stores bounded metadata, hashes, decision enums, public-key fingerprints, and exact non-secret candidate provenance—not evaluator names, human signatures, credentials, endpoints, source workbooks, summary prose, Findings content, raw responses, case files, patient identifiers, records, or PHI. It does not verify an external model execution; establish generalized accuracy, reliability, comparative improvement, clinical performance, safety, clinical validity, or patient benefit; approve a provider or model generally; authorize transport, a pilot, deployment, production release, traffic activation, patient-record processing, or patient use; change care; or allow PERL to create trust keys, sign a return, or accept its own evidence.";

const CYCLE_ACTIONS = Object.freeze(["close-this-refinement-cycle", "continue-refinement", "hold-study"]);
const CANDIDATE_DECISIONS = Object.freeze(["advance-exact-candidate-to-integration-readiness", "retain-baseline-and-refine", "hold-candidate-decision"]);
const CLINICAL_SUITABILITY = Object.freeze(["fit-for-integration-readiness", "retain-and-refine", "hold"]);
const TRANSPORT_FIT = Object.freeze(["fit-for-controlled-integration", "not-fit", "hold"]);
const INTEGRATION_FIT = Object.freeze(["fit-for-eqpass-integration-readiness", "not-fit", "hold"]);

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HASH = /^(GENESIS|[a-f0-9]{64})$/;
const CYCLE_ID = /^FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80}$/;
const CYCLE_KEY_ID = /^FF-CYCLE-ACTION-KEY-[A-Z0-9-]{3,80}$/;
const ADVANCEMENT_KEY_ID = /^FF-CANDIDATE-ADVANCEMENT-KEY-[A-Z0-9-]{3,80}$/;
const CYCLE_REGISTRY_ID = /^FF-CYCLE-ACTION-REGISTRY-[A-Z0-9-]{3,80}$/;
const ADVANCEMENT_REGISTRY_ID = /^FF-CANDIDATE-ADVANCEMENT-REGISTRY-[A-Z0-9-]{3,80}$/;
const CYCLE_CHALLENGE_ID = /^FF-CYCLE-ACTION-CHALLENGE-[A-F0-9-]{20,80}$/;
const ADVANCEMENT_CHALLENGE_ID = /^FF-CANDIDATE-ADVANCEMENT-CHALLENGE-[A-F0-9-]{20,80}$/;
const CYCLE_ATTESTATION_ID = /^FF-CYCLE-ACTION-ATTEST-[A-Z0-9-]{3,80}$/;
const ADVANCEMENT_ATTESTATION_ID = /^FF-CANDIDATE-ADVANCEMENT-ATTEST-[A-Z0-9-]{3,80}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,159}$/;
const CANDIDATE_SLOT = /^candidate-0[1-3]$/;
const LANE_ID = /^lane-i{1,3}$/;
const NONCE = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_ATTESTATION_BYTES = 64 * 1024;

const CONTENT_BOUNDARY = Object.freeze({
  evaluatorNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  endpointsIncluded: false,
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
  "providerApprovedGenerally",
  "modelApprovedGenerally",
  "productionEngineSelected",
  "candidateTransportAuthorized",
  "carePlanChanged",
  "pilotAuthorized",
  "deploymentAuthorized",
  "productionReleaseAuthorized",
  "trafficActivationAuthorized",
  "patientRecordProcessingAuthorized",
  "patientUseAuthorized"
]);

const clone = value => structuredClone(value);
const finiteDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const falseClaims = () => Object.fromEntries(FALSE_CLAIMS.map(key => [key, false]));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalCandidateAdvancementJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function candidateAdvancementDigest(value) {
  return createHash("sha256").update(canonicalCandidateAdvancementJson(value)).digest("hex");
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

function validateContentBoundary(boundary, label, errors) {
  const keys = Object.keys(CONTENT_BOUNDARY);
  if (!exactKeys(boundary, keys, label, errors)) return;
  for (const key of keys) if (boundary[key] !== false) errors.push(`${label}.${key} must remain false.`);
}

const roomConfiguration = room => room === "cycle-action" ? {
  room,
  registryContract: CANDIDATE_CYCLE_ACTION_REGISTRY_CONTRACT,
  registryIdPattern: CYCLE_REGISTRY_ID,
  disabledId: "FF-CYCLE-ACTION-REGISTRY-DISABLED",
  keyIdPattern: CYCLE_KEY_ID,
  purposes: CANDIDATE_CYCLE_ACTION_PURPOSES,
  keyPrefix: "FF-CYCLE-ACTION-KEY"
} : room === "candidate-advancement" ? {
  room,
  registryContract: CANDIDATE_ADVANCEMENT_REGISTRY_CONTRACT,
  registryIdPattern: ADVANCEMENT_REGISTRY_ID,
  disabledId: "FF-CANDIDATE-ADVANCEMENT-REGISTRY-DISABLED",
  keyIdPattern: ADVANCEMENT_KEY_ID,
  purposes: CANDIDATE_ADVANCEMENT_PURPOSES,
  keyPrefix: "FF-CANDIDATE-ADVANCEMENT-KEY"
} : null;

function disabledRegistry(room) {
  const config = roomConfiguration(room);
  return {
    contractVersion: config.registryContract,
    registryId: config.disabledId,
    version: "0.0.0",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    keys: []
  };
}

export const disabledCandidateCycleActionRegistry = () => disabledRegistry("cycle-action");
export const disabledCandidateAdvancementRegistry = () => disabledRegistry("candidate-advancement");

function registryTemplate(room) {
  const config = roomConfiguration(room);
  const id = room === "cycle-action" ? "FF-CYCLE-ACTION-REGISTRY-REPLACE-ME" : "FF-CANDIDATE-ADVANCEMENT-REGISTRY-REPLACE-ME";
  return {
    contractVersion: config.registryContract,
    registryId: id,
    version: "1.0.0",
    issuedAt: null,
    expiresAt: null,
    keys: config.purposes.map((purpose, index) => ({
      keyId: `${config.keyPrefix}-REPLACE-${index + 1}`,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: "REPLACE WITH A DISTINCT EXTERNALLY PROVISIONED ED25519 PUBLIC KEY",
      notBefore: null,
      notAfter: null
    }))
  };
}

export const candidateCycleActionRegistryTemplate = () => registryTemplate("cycle-action");
export const candidateAdvancementRegistryTemplate = () => registryTemplate("candidate-advancement");

function validateRegistry(registry, room, { allowDisabled = true } = {}) {
  const config = roomConfiguration(room);
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(registry ?? null)) > MAX_REGISTRY_BYTES) errors.push(`${room} registry exceeds the 256 KB startup limit.`);
  if (!exactKeys(registry, ["contractVersion", "registryId", "version", "issuedAt", "expiresAt", "keys"], `${room} registry`, errors)) return errors;
  if (registry.contractVersion !== config.registryContract) errors.push(`${room} registry contractVersion is invalid.`);
  if (!config.registryIdPattern.test(String(registry.registryId || "")) || !/^\d+\.\d+\.\d+$/.test(String(registry.version || ""))) errors.push(`${room} registry identity is invalid.`);
  if (!Array.isArray(registry.keys)) errors.push(`${room} registry keys must be an array.`);
  const keys = Array.isArray(registry.keys) ? registry.keys : [];
  const disabled = keys.length === 0;
  if (disabled && !allowDisabled) errors.push(`${config.purposes.length} ${room} keys are required.`);
  if (disabled && (registry.registryId !== config.disabledId || registry.version !== "0.0.0")) errors.push(`An empty ${room} registry must use the disabled identity.`);
  if (!disabled && (!finiteDate(registry.issuedAt) || !finiteDate(registry.expiresAt) || Date.parse(registry.expiresAt) <= Date.parse(registry.issuedAt))) errors.push(`${room} registry dates must define a valid window.`);
  if (keys.length > 16) errors.push(`${room} registry may contain at most 16 keys.`);
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const [index, key] of keys.entries()) {
    const label = `${room} key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "purpose", "publicKeyPem", "notBefore", "notAfter"], label, errors)) continue;
    if (!config.keyIdPattern.test(String(key.keyId || "")) || keyIds.has(key.keyId)) errors.push(`${label} keyId is invalid or repeated.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519" || !config.purposes.includes(key.purpose)) errors.push(`${label} algorithm or purpose is invalid.`);
    const fingerprint = typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 1024 ? publicKeyFingerprint(key.publicKeyPem) : null;
    if (!fingerprint || fingerprints.has(fingerprint)) errors.push(`${label} must contain distinct bounded Ed25519 key material.`);
    if (fingerprint) fingerprints.add(fingerprint);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore)) errors.push(`${label} validity window is invalid.`);
    if (!disabled && finiteDate(key.notBefore) && finiteDate(key.notAfter) && (Date.parse(key.notBefore) < Date.parse(registry.issuedAt) || Date.parse(key.notAfter) > Date.parse(registry.expiresAt))) errors.push(`${label} validity window must stay inside the registry window.`);
  }
  if (!disabled) for (const purpose of config.purposes) if (keys.filter(key => key.purpose === purpose).length !== 1) errors.push(`${room} registry requires exactly one key for ${purpose}.`);
  return [...new Set(errors)];
}

export const validateCandidateCycleActionRegistry = (registry, options) => validateRegistry(registry, "cycle-action", options);
export const validateCandidateAdvancementRegistry = (registry, options) => validateRegistry(registry, "candidate-advancement", options);
export const candidateCycleActionRegistryFingerprint = registry => candidateAdvancementDigest(registry);
export const candidateAdvancementRegistryFingerprint = registry => candidateAdvancementDigest(registry);

function summarizeRegistry(registry, room, generatedAt) {
  const errors = validateRegistry(registry, room);
  if (errors.length) throw new Error(errors.join(" "));
  const config = roomConfiguration(room);
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
    room,
    registryFingerprint: candidateAdvancementDigest(registry),
    externallyProvisioned: registry.keys.length > 0,
    registryCurrent,
    trustedKeys,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    activePurposeCounts: Object.fromEntries(config.purposes.map(purpose => [purpose, trustedKeys.filter(key => key.active && key.purpose === purpose).length])),
    registryWriteApiAvailable: false,
    signingApiAvailable: false
  };
}

export const summarizeCandidateCycleActionRegistry = (registry, generatedAt = new Date().toISOString()) => summarizeRegistry(registry, "cycle-action", generatedAt);
export const summarizeCandidateAdvancementRegistry = (registry, generatedAt = new Date().toISOString()) => summarizeRegistry(registry, "candidate-advancement", generatedAt);

function cycleActionPackage(upstream) {
  const core = {
    cycleId: upstream?.cycleId || null,
    cycleEventHash: upstream?.cycleEventHash || null,
    dispositionPackageHash: upstream?.dispositionPackageHash || null,
    independentResultAttestationFingerprint: upstream?.independentResultAttestationFingerprint || null,
    independentResultEventHash: upstream?.independentResultEventHash || null,
    candidateRetestDispositionChainHead: upstream?.candidateRetestDispositionChainHead || null,
    recommendedCycleAction: upstream?.cycleCloseRecommendation || null,
    candidateRecommendation: upstream?.candidateRecommendation || null
  };
  return { ...core, cycleActionPackageHash: candidateAdvancementDigest(core) };
}

function candidatePackage({ upstream, cycleActionFreeze, candidateIdentity }) {
  const core = {
    cycleId: upstream?.cycleId || null,
    cycleEventHash: upstream?.cycleEventHash || null,
    independentResultEventHash: upstream?.independentResultEventHash || null,
    candidateRetestDispositionChainHead: upstream?.candidateRetestDispositionChainHead || null,
    cycleActionAttestationFingerprint: cycleActionFreeze?.attestationFingerprint || null,
    cycleActionEventHash: cycleActionFreeze?.eventHash || null,
    laneId: candidateIdentity?.laneId || null,
    candidateSlot: candidateIdentity?.candidateSlot || null,
    candidateFingerprint: candidateIdentity?.candidateFingerprint || null,
    providerId: candidateIdentity?.providerId || null,
    modelVersion: candidateIdentity?.modelVersion || null,
    promptVersion: candidateIdentity?.promptVersion || null,
    outputContract: candidateIdentity?.outputContract || null,
    policyVersion: candidateIdentity?.policyVersion || null,
    policyHash: candidateIdentity?.policyHash || null,
    retestProtocolFingerprint: candidateIdentity?.retestProtocolFingerprint || null,
    hostingPattern: candidateIdentity?.hostingPattern || null,
    region: candidateIdentity?.region || null,
    domainEvidenceFingerprint: candidateIdentity?.domainEvidenceFingerprint || null,
    modelTrialChainHead: candidateIdentity?.modelTrialChainHead || null,
    candidateTrialChainHead: candidateIdentity?.candidateTrialChainHead || null,
    candidateTrialProtocolFingerprint: candidateIdentity?.candidateTrialProtocolFingerprint || null,
    candidateReturnChainHead: candidateIdentity?.candidateReturnChainHead || null,
    candidateRetestReturnChainHead: candidateIdentity?.candidateRetestReturnChainHead || null
  };
  return { ...core, candidatePackageHash: candidateAdvancementDigest(core) };
}

function baseEvent({ eventType, actor, sequence, previousHash, createdAt, id }) {
  return {
    id,
    sequence,
    previousHash,
    eventType,
    contractVersion: CANDIDATE_ADVANCEMENT_CONTRACT,
    actor,
    createdAt,
    cycleActionRecorded: false,
    cycleActionFrozen: false,
    cycleClosed: false,
    candidateSuitabilityRecorded: false,
    privacySecurityFitRecorded: false,
    eqpassIntegrationFitRecorded: false,
    candidateAdvancementFrozen: false,
    exactCandidateAdvancedToIntegrationReadiness: false,
    ...falseClaims(),
    boundary: CANDIDATE_ADVANCEMENT_BOUNDARY
  };
}

export function createCandidateCycleActionChallenge({ upstream, registry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), challengeId = `FF-CYCLE-ACTION-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") } = {}) {
  const evidence = cycleActionPackage(upstream);
  const challenge = {
    contractVersion: CANDIDATE_CYCLE_ACTION_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    room: "cycle-action",
    ...evidence,
    registryFingerprint: candidateCycleActionRegistryFingerprint(registry),
    requiredPurposeOrder: [...CANDIDATE_CYCLE_ACTION_PURPOSES],
    decisionMode: "act-on-exact-frozen-synthetic-cycle-no-release-authority",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: clone(CONTENT_BOUNDARY)
  };
  const core = { ...baseEvent({ eventType: "candidate-cycle-action-challenge-issued", actor, sequence, previousHash, createdAt, id }), challenge };
  return { ...core, hash: candidateAdvancementDigest(core) };
}

export function createCandidateAdvancementChallenge({ upstream, cycleActionFreeze, candidateIdentity, registry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), challengeId = `FF-CANDIDATE-ADVANCEMENT-CHALLENGE-${randomUUID().toUpperCase()}`, nonce = randomBytes(32).toString("base64url") } = {}) {
  const evidence = candidatePackage({ upstream, cycleActionFreeze, candidateIdentity });
  const challenge = {
    contractVersion: CANDIDATE_ADVANCEMENT_CHALLENGE_CONTRACT,
    challengeId,
    nonce,
    room: "candidate-advancement",
    ...evidence,
    registryFingerprint: candidateAdvancementRegistryFingerprint(registry),
    requiredPurposeOrder: [...CANDIDATE_ADVANCEMENT_PURPOSES],
    decisionMode: "advance-exact-candidate-to-integration-readiness-no-release-authority",
    issuedAt: createdAt,
    expiresAt: new Date(Date.parse(createdAt) + CHALLENGE_LIFETIME_MS).toISOString(),
    contentBoundary: clone(CONTENT_BOUNDARY)
  };
  const core = { ...baseEvent({ eventType: "candidate-advancement-challenge-issued", actor, sequence, previousHash, createdAt, id }), challenge };
  return { ...core, hash: candidateAdvancementDigest(core) };
}

const CYCLE_EVIDENCE_KEYS = ["cycleId", "cycleEventHash", "dispositionPackageHash", "independentResultAttestationFingerprint", "independentResultEventHash", "candidateRetestDispositionChainHead", "recommendedCycleAction", "candidateRecommendation", "cycleActionPackageHash"];
const CANDIDATE_EVIDENCE_KEYS = ["cycleId", "cycleEventHash", "independentResultEventHash", "candidateRetestDispositionChainHead", "cycleActionAttestationFingerprint", "cycleActionEventHash", "laneId", "candidateSlot", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "policyHash", "retestProtocolFingerprint", "hostingPattern", "region", "domainEvidenceFingerprint", "modelTrialChainHead", "candidateTrialChainHead", "candidateTrialProtocolFingerprint", "candidateReturnChainHead", "candidateRetestReturnChainHead", "candidatePackageHash"];

export function validateCandidateAdvancementChallenge(challenge, { upstream, cycleActionFreeze, candidateIdentity, registryFingerprint } = {}) {
  const errors = [];
  const cycleRoom = challenge?.room === "cycle-action";
  const evidenceKeys = cycleRoom ? CYCLE_EVIDENCE_KEYS : CANDIDATE_EVIDENCE_KEYS;
  const keys = ["contractVersion", "challengeId", "nonce", "room", ...evidenceKeys, "registryFingerprint", "requiredPurposeOrder", "decisionMode", "issuedAt", "expiresAt", "contentBoundary"];
  if (!exactKeys(challenge, keys, "Candidate advancement challenge", errors)) return errors;
  const config = cycleRoom ? {
    contract: CANDIDATE_CYCLE_ACTION_CHALLENGE_CONTRACT,
    idPattern: CYCLE_CHALLENGE_ID,
    purposes: CANDIDATE_CYCLE_ACTION_PURPOSES,
    mode: "act-on-exact-frozen-synthetic-cycle-no-release-authority"
  } : challenge.room === "candidate-advancement" ? {
    contract: CANDIDATE_ADVANCEMENT_CHALLENGE_CONTRACT,
    idPattern: ADVANCEMENT_CHALLENGE_ID,
    purposes: CANDIDATE_ADVANCEMENT_PURPOSES,
    mode: "advance-exact-candidate-to-integration-readiness-no-release-authority"
  } : null;
  if (!config || challenge.contractVersion !== config?.contract || !config?.idPattern.test(String(challenge.challengeId || "")) || !NONCE.test(String(challenge.nonce || "")) || !CYCLE_ID.test(String(challenge.cycleId || ""))) errors.push("Candidate advancement challenge identity is invalid.");
  if (!HEX.test(String(challenge.registryFingerprint || ""))) errors.push("Candidate advancement challenge registryFingerprint is invalid.");
  if (!finiteDate(challenge.issuedAt) || !finiteDate(challenge.expiresAt) || Date.parse(challenge.expiresAt) - Date.parse(challenge.issuedAt) !== CHALLENGE_LIFETIME_MS) errors.push("Candidate advancement challenge must use the exact 24-hour window.");
  if (config && (JSON.stringify(challenge.requiredPurposeOrder) !== JSON.stringify(config.purposes) || challenge.decisionMode !== config.mode)) errors.push("Candidate advancement challenge purpose order or mode is invalid.");
  validateContentBoundary(challenge.contentBoundary, "Candidate advancement challenge contentBoundary", errors);
  if (cycleRoom) {
    for (const key of ["cycleEventHash", "dispositionPackageHash", "independentResultAttestationFingerprint", "independentResultEventHash", "candidateRetestDispositionChainHead", "cycleActionPackageHash"]) if (!HEX.test(String(challenge[key] || ""))) errors.push(`Cycle-action challenge ${key} is invalid.`);
    if (!CYCLE_ACTIONS.includes(challenge.recommendedCycleAction) || !["advance-to-separate-provider-model-decision", "retain-baseline-and-refine", "no-advancement"].includes(challenge.candidateRecommendation)) errors.push("Cycle-action challenge upstream recommendations are invalid.");
    if (upstream) {
      const expected = cycleActionPackage(upstream);
      for (const key of CYCLE_EVIDENCE_KEYS) if (challenge[key] !== expected[key]) errors.push(`Cycle-action challenge is stale at ${key}.`);
    }
  } else {
    for (const key of ["cycleEventHash", "independentResultEventHash", "candidateRetestDispositionChainHead", "cycleActionAttestationFingerprint", "cycleActionEventHash", "candidateFingerprint", "policyHash", "retestProtocolFingerprint", "domainEvidenceFingerprint", "modelTrialChainHead", "candidateTrialChainHead", "candidateTrialProtocolFingerprint", "candidateReturnChainHead", "candidateRetestReturnChainHead", "candidatePackageHash"]) if (!HEX.test(String(challenge[key] || ""))) errors.push(`Candidate-advancement challenge ${key} is invalid.`);
    if (!LANE_ID.test(String(challenge.laneId || "")) || !CANDIDATE_SLOT.test(String(challenge.candidateSlot || ""))) errors.push("Candidate-advancement lane or slot is invalid.");
    for (const key of ["providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "hostingPattern", "region"]) if (!SAFE_TEXT.test(String(challenge[key] || ""))) errors.push(`Candidate-advancement challenge ${key} is invalid.`);
    if (upstream || cycleActionFreeze || candidateIdentity) {
      const expected = candidatePackage({ upstream, cycleActionFreeze, candidateIdentity });
      for (const key of CANDIDATE_EVIDENCE_KEYS) if (challenge[key] !== expected[key]) errors.push(`Candidate-advancement challenge is stale at ${key}.`);
    }
  }
  if (registryFingerprint && challenge.registryFingerprint !== registryFingerprint) errors.push("Candidate advancement challenge registry is stale.");
  return [...new Set(errors)];
}

function validateDecision(attestation, challenge, priorAttestations, errors) {
  const decision = attestation.decision;
  if (attestation.purpose === "clinical-cycle-action") {
    const keys = ["independentResultAttestationFingerprint", "clinicalActionReferenceHash", "cycleAction", "outcome"];
    if (!exactKeys(decision, keys, "Clinical cycle action", errors)) return;
    if (decision.independentResultAttestationFingerprint !== challenge?.independentResultAttestationFingerprint || !HEX.test(String(decision.clinicalActionReferenceHash || "")) || !CYCLE_ACTIONS.includes(decision.cycleAction) || decision.outcome !== "clinical-cycle-action-recorded") errors.push("Clinical cycle action is invalid or does not bind the frozen independent result.");
    if (decision.cycleAction === "close-this-refinement-cycle" && challenge?.recommendedCycleAction !== "close-this-refinement-cycle") errors.push("The exact cycle cannot close without the upstream close recommendation.");
  } else if (attestation.purpose === "evaluation-custody-confirmation") {
    const keys = ["clinicalCycleActionAttestationFingerprint", "custodyReferenceHash", "cycleAction", "outcome"];
    if (!exactKeys(decision, keys, "Evaluation custody confirmation", errors)) return;
    const prior = priorAttestations.get("clinical-cycle-action");
    if (!prior || decision.clinicalCycleActionAttestationFingerprint !== candidateAdvancementDigest(prior) || !HEX.test(String(decision.custodyReferenceHash || "")) || decision.cycleAction !== prior?.decision?.cycleAction || decision.outcome !== "cycle-action-frozen") errors.push("Evaluation custody confirmation must bind and mirror the prior clinical cycle action.");
  } else if (attestation.purpose === "clinical-suitability-advancement") {
    const keys = ["candidatePackageHash", "cycleActionAttestationFingerprint", "clinicalEvidenceReferenceHash", "clinicalSuitability", "outcome"];
    if (!exactKeys(decision, keys, "Clinical suitability advancement", errors)) return;
    if (decision.candidatePackageHash !== challenge?.candidatePackageHash || decision.cycleActionAttestationFingerprint !== challenge?.cycleActionAttestationFingerprint || !HEX.test(String(decision.clinicalEvidenceReferenceHash || "")) || !CLINICAL_SUITABILITY.includes(decision.clinicalSuitability) || decision.outcome !== "clinical-suitability-recorded") errors.push("Clinical suitability advancement is invalid or stale.");
  } else if (attestation.purpose === "privacy-security-transport-fit") {
    const keys = ["clinicalSuitabilityAttestationFingerprint", "securityEvidenceReferenceHash", "transportFit", "outcome"];
    if (!exactKeys(decision, keys, "Privacy and security transport fit", errors)) return;
    const prior = priorAttestations.get("clinical-suitability-advancement");
    if (!prior || decision.clinicalSuitabilityAttestationFingerprint !== candidateAdvancementDigest(prior) || !HEX.test(String(decision.securityEvidenceReferenceHash || "")) || !TRANSPORT_FIT.includes(decision.transportFit) || decision.outcome !== "privacy-security-fit-recorded") errors.push("Privacy and security transport fit must bind the clinical-suitability duty.");
  } else if (attestation.purpose === "eqpass-integration-fit") {
    const keys = ["priorAttestationFingerprints", "ownerEvidenceReferenceHash", "integrationFit", "outcome"];
    if (!exactKeys(decision, keys, "e-QPASS integration fit", errors)) return;
    const expected = CANDIDATE_ADVANCEMENT_PURPOSES.slice(0, 2).map(purpose => priorAttestations.get(purpose)).filter(Boolean).map(candidateAdvancementDigest);
    if (expected.length !== 2 || JSON.stringify(decision.priorAttestationFingerprints) !== JSON.stringify(expected) || !HEX.test(String(decision.ownerEvidenceReferenceHash || "")) || !INTEGRATION_FIT.includes(decision.integrationFit) || decision.outcome !== "eqpass-integration-fit-recorded") errors.push("e-QPASS integration fit must bind both prior duties in order.");
  } else if (attestation.purpose === "product-sponsor-advancement-freeze") {
    const keys = ["priorAttestationFingerprints", "candidatePackageHash", "sponsorDecisionReferenceHash", "advancementDecision", "outcome"];
    if (!exactKeys(decision, keys, "Product sponsor advancement freeze", errors)) return;
    const expected = CANDIDATE_ADVANCEMENT_PURPOSES.slice(0, 3).map(purpose => priorAttestations.get(purpose)).filter(Boolean).map(candidateAdvancementDigest);
    if (expected.length !== 3 || JSON.stringify(decision.priorAttestationFingerprints) !== JSON.stringify(expected) || decision.candidatePackageHash !== challenge?.candidatePackageHash || !HEX.test(String(decision.sponsorDecisionReferenceHash || "")) || !CANDIDATE_DECISIONS.includes(decision.advancementDecision) || decision.outcome !== "candidate-advancement-frozen") errors.push("Product sponsor advancement freeze is invalid or does not bind the three prior duties.");
    const positive = priorAttestations.get("clinical-suitability-advancement")?.decision?.clinicalSuitability === "fit-for-integration-readiness"
      && priorAttestations.get("privacy-security-transport-fit")?.decision?.transportFit === "fit-for-controlled-integration"
      && priorAttestations.get("eqpass-integration-fit")?.decision?.integrationFit === "fit-for-eqpass-integration-readiness";
    if (!positive && decision.advancementDecision === "advance-exact-candidate-to-integration-readiness") errors.push("Exact-candidate advancement is inconsistent with the three prior fit duties.");
  } else {
    errors.push("Candidate advancement attestation purpose is invalid.");
  }
}

function signaturePayload(attestation) {
  const { signature, ...unsigned } = attestation;
  return Buffer.from(canonicalCandidateAdvancementJson(unsigned));
}

export function validateCandidateAdvancementAttestation(attestation, { challenge, registry, priorAttestations = new Map(), now = new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  if (Buffer.byteLength(JSON.stringify(attestation ?? null)) > MAX_ATTESTATION_BYTES) errors.push("Candidate advancement attestation exceeds the 64 KB limit.");
  const keys = ["contractVersion", "attestationId", "challengeId", "nonce", "registryFingerprint", "packageHash", "purpose", "keyId", "issuedAt", "decision", "contentBoundary", "signature"];
  if (!exactKeys(attestation, keys, "Candidate advancement attestation", errors)) return errors;
  const cycleRoom = challenge?.room === "cycle-action";
  const config = cycleRoom ? {
    contract: CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT,
    attestationId: CYCLE_ATTESTATION_ID,
    challengeId: CYCLE_CHALLENGE_ID,
    keyId: CYCLE_KEY_ID,
    purposes: CANDIDATE_CYCLE_ACTION_PURPOSES,
    packageHash: challenge?.cycleActionPackageHash
  } : {
    contract: CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT,
    attestationId: ADVANCEMENT_ATTESTATION_ID,
    challengeId: ADVANCEMENT_CHALLENGE_ID,
    keyId: ADVANCEMENT_KEY_ID,
    purposes: CANDIDATE_ADVANCEMENT_PURPOSES,
    packageHash: challenge?.candidatePackageHash
  };
  if (attestation.contractVersion !== config.contract || !config.attestationId.test(String(attestation.attestationId || "")) || !config.challengeId.test(String(attestation.challengeId || "")) || !config.purposes.includes(attestation.purpose) || !config.keyId.test(String(attestation.keyId || ""))) errors.push("Candidate advancement attestation identity is invalid.");
  if (!finiteDate(attestation.issuedAt) || !NONCE.test(String(attestation.nonce || "")) || !HEX.test(String(attestation.registryFingerprint || "")) || !HEX.test(String(attestation.packageHash || ""))) errors.push("Candidate advancement attestation evidence metadata is invalid.");
  validateContentBoundary(attestation.contentBoundary, "Candidate advancement attestation contentBoundary", errors);
  if (!challenge || attestation.challengeId !== challenge.challengeId || attestation.nonce !== challenge.nonce || attestation.registryFingerprint !== challenge.registryFingerprint || attestation.packageHash !== config.packageHash) errors.push("Candidate advancement attestation does not match the issued challenge.");
  if (challenge && (Date.parse(now) > Date.parse(challenge.expiresAt) || Date.parse(attestation.issuedAt) < Date.parse(challenge.issuedAt) - CLOCK_SKEW_MS || Date.parse(attestation.issuedAt) > Date.parse(now) + CLOCK_SKEW_MS)) errors.push("Candidate advancement attestation is outside the challenge time window.");
  if (seenAttestationIds.has(attestation.attestationId) || seenPurposes.has(attestation.purpose)) errors.push("Candidate advancement attestation ID or purpose has already been recorded.");
  const expectedPurpose = config.purposes[priorAttestations.size];
  if (attestation.purpose !== expectedPurpose) errors.push(`Candidate advancement duties must be verified in order; ${expectedPurpose || "no further purpose"} is next.`);
  validateDecision(attestation, challenge, priorAttestations, errors);
  if (!exactKeys(attestation.signature, ["algorithm", "keyId", "value"], "Candidate advancement signature", errors)) return [...new Set(errors)];
  if (attestation.signature.algorithm !== "Ed25519" || attestation.signature.keyId !== attestation.keyId || !SIGNATURE.test(String(attestation.signature.value || ""))) errors.push("Candidate advancement signature envelope is invalid.");
  const key = registry?.keys?.find(item => item.keyId === attestation.keyId && item.purpose === attestation.purpose);
  if (!key) errors.push("Candidate advancement signing key is not trusted for this purpose.");
  if (key && (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(attestation.issuedAt) < Date.parse(key.notBefore) || Date.parse(attestation.issuedAt) > Date.parse(key.notAfter))) errors.push("Candidate advancement signing key is outside its validity window.");
  const signatureHash = candidateAdvancementDigest(attestation.signature.value);
  if (seenSignatureHashes.has(signatureHash)) errors.push("Candidate advancement signature has already been used.");
  if (key && SIGNATURE.test(String(attestation.signature.value || ""))) {
    try {
      if (!verifySignature(null, signaturePayload(attestation), createPublicKey(key.publicKeyPem), Buffer.from(attestation.signature.value, "base64url"))) errors.push("Candidate advancement signature verification failed.");
    } catch {
      errors.push("Candidate advancement signature verification failed.");
    }
  }
  return [...new Set(errors)];
}

export function createCandidateAdvancementAttestationEvent({ attestation, challenge, registry, actor, sequence, previousHash, verifiedAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const key = registry.keys.find(item => item.keyId === attestation.keyId && item.purpose === attestation.purpose);
  const eventType = challenge.room === "cycle-action" ? "candidate-cycle-action-attestation-verified" : "candidate-advancement-attestation-verified";
  const core = {
    ...baseEvent({ eventType, actor, sequence, previousHash, createdAt: verifiedAt, id }),
    attestation: clone(attestation),
    attestationFingerprint: candidateAdvancementDigest(attestation),
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem)
  };
  core.cycleActionRecorded = attestation.purpose === "clinical-cycle-action";
  core.cycleActionFrozen = attestation.purpose === "evaluation-custody-confirmation";
  core.cycleClosed = core.cycleActionFrozen && attestation.decision.cycleAction === "close-this-refinement-cycle";
  core.candidateSuitabilityRecorded = attestation.purpose === "clinical-suitability-advancement";
  core.privacySecurityFitRecorded = attestation.purpose === "privacy-security-transport-fit";
  core.eqpassIntegrationFitRecorded = attestation.purpose === "eqpass-integration-fit";
  core.candidateAdvancementFrozen = attestation.purpose === "product-sponsor-advancement-freeze";
  core.exactCandidateAdvancedToIntegrationReadiness = core.candidateAdvancementFrozen && attestation.decision.advancementDecision === "advance-exact-candidate-to-integration-readiness";
  return { ...core, hash: candidateAdvancementDigest(core) };
}

const EVENT_CLAIM_KEYS = ["cycleActionRecorded", "cycleActionFrozen", "cycleClosed", "candidateSuitabilityRecorded", "privacySecurityFitRecorded", "eqpassIntegrationFitRecorded", "candidateAdvancementFrozen", "exactCandidateAdvancedToIntegrationReadiness", ...FALSE_CLAIMS];

export function validateCandidateAdvancementEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, cycleActionRegistry, candidateAdvancementRegistry, challenge, priorAttestations = new Map(), now = event?.createdAt || new Date().toISOString(), seenAttestationIds = new Set(), seenSignatureHashes = new Set(), seenPurposes = new Set() } = {}) {
  const errors = [];
  const challengeEvent = event?.eventType?.endsWith("challenge-issued");
  const common = ["id", "sequence", "previousHash", "eventType", "contractVersion", "actor", "createdAt", ...EVENT_CLAIM_KEYS, "boundary", "hash"];
  const keys = challengeEvent ? [...common.slice(0, 5), "challenge", ...common.slice(5)] : [...common.slice(0, 5), "attestation", "attestationFingerprint", "keyFingerprint", ...common.slice(5)];
  if (!exactKeys(event, keys, "Candidate advancement event", errors)) return errors;
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1 || event.previousHash !== previousHash || !CHAIN_HASH.test(String(event.previousHash || "")) || event.contractVersion !== CANDIDATE_ADVANCEMENT_CONTRACT || !ACTOR.test(String(event.actor || "")) || !finiteDate(event.createdAt)) errors.push("Candidate advancement event chain position or identity is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (event.boundary !== CANDIDATE_ADVANCEMENT_BOUNDARY) errors.push("Candidate advancement event boundary is invalid.");
  if (challengeEvent) {
    if (!["candidate-cycle-action-challenge-issued", "candidate-advancement-challenge-issued"].includes(event.eventType) || validateCandidateAdvancementChallenge(event.challenge).length) errors.push("Candidate advancement challenge event contains an invalid challenge.");
    for (const key of EVENT_CLAIM_KEYS.filter(key => !FALSE_CLAIMS.includes(key))) if (event[key] !== false) errors.push(`${key} must remain false on challenge issuance.`);
  } else if (["candidate-cycle-action-attestation-verified", "candidate-advancement-attestation-verified"].includes(event.eventType)) {
    const registry = challenge?.room === "cycle-action" ? cycleActionRegistry : candidateAdvancementRegistry;
    errors.push(...validateCandidateAdvancementAttestation(event.attestation, { challenge, registry, priorAttestations, now, seenAttestationIds, seenSignatureHashes, seenPurposes }));
    if (event.attestationFingerprint !== candidateAdvancementDigest(event.attestation) || !HEX.test(String(event.keyFingerprint || ""))) errors.push("Candidate advancement attestation fingerprints are invalid.");
    const purpose = event.attestation?.purpose;
    const expected = {
      cycleActionRecorded: purpose === "clinical-cycle-action",
      cycleActionFrozen: purpose === "evaluation-custody-confirmation",
      cycleClosed: purpose === "evaluation-custody-confirmation" && event.attestation?.decision?.cycleAction === "close-this-refinement-cycle",
      candidateSuitabilityRecorded: purpose === "clinical-suitability-advancement",
      privacySecurityFitRecorded: purpose === "privacy-security-transport-fit",
      eqpassIntegrationFitRecorded: purpose === "eqpass-integration-fit",
      candidateAdvancementFrozen: purpose === "product-sponsor-advancement-freeze",
      exactCandidateAdvancedToIntegrationReadiness: purpose === "product-sponsor-advancement-freeze" && event.attestation?.decision?.advancementDecision === "advance-exact-candidate-to-integration-readiness"
    };
    for (const [key, value] of Object.entries(expected)) if (event[key] !== value) errors.push(`${key} is inconsistent with the verified purpose.`);
  } else {
    errors.push("Candidate advancement event type is invalid.");
  }
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || candidateAdvancementDigest(core) !== hash) errors.push("Candidate advancement event hash is invalid.");
  return [...new Set(errors)];
}

function challengeView({ room, purposes, challenge, verifiedEvents }) {
  const verifiedByPurpose = new Map(verifiedEvents.map(event => [event.attestation.purpose, event]));
  const labels = {
    "clinical-cycle-action": ["Clinical cycle action", "Clinical Standard owner"],
    "evaluation-custody-confirmation": ["Evaluation custody confirmation", "Independent evaluation custodian"],
    "clinical-suitability-advancement": ["Clinical suitability", "Clinical Standard owner"],
    "privacy-security-transport-fit": ["Privacy + security fit", "Privacy and security owner"],
    "eqpass-integration-fit": ["e-QPASS integration fit", "e-QPASS integration owner"],
    "product-sponsor-advancement-freeze": ["Advancement freeze", "Product sponsor"]
  };
  return {
    room,
    activeChallenge: challenge || null,
    duties: purposes.map((purpose, index) => ({
      index: String(index + 1).padStart(2, "0"),
      purpose,
      label: labels[purpose][0],
      authority: labels[purpose][1],
      status: verifiedByPurpose.has(purpose) ? "verified-external-duty" : "external-signature-required",
      attestationFingerprint: verifiedByPurpose.get(purpose)?.attestationFingerprint || null,
      keyFingerprint: verifiedByPurpose.get(purpose)?.keyFingerprint || null
    })),
    verifiedExternalDuties: verifiedEvents.length
  };
}

function roomChallenge(events, room, packageHash, registryFingerprint, purposes, generatedAt) {
  const challengeEvents = events.filter(event => event.eventType === (room === "cycle-action" ? "candidate-cycle-action-challenge-issued" : "candidate-advancement-challenge-issued")
    && (event.challenge.cycleActionPackageHash || event.challenge.candidatePackageHash) === packageHash
    && event.challenge.registryFingerprint === registryFingerprint);
  const withAttestations = challengeEvents.map(event => ({
    event,
    attestations: events.filter(item => item.eventType === (room === "cycle-action" ? "candidate-cycle-action-attestation-verified" : "candidate-advancement-attestation-verified") && item.attestation.challengeId === event.challenge.challengeId)
  }));
  const complete = [...withAttestations].reverse().find(item => item.attestations.length === purposes.length) || null;
  const active = [...withAttestations].reverse().find(item => Date.parse(generatedAt) <= Date.parse(item.event.challenge.expiresAt)) || null;
  return complete || active || null;
}

function maskedCandidateIdentity(candidateIdentity, disclosed) {
  const keys = ["laneId", "candidateSlot", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "policyHash", "retestProtocolFingerprint", "hostingPattern", "region", "domainEvidenceFingerprint"];
  return {
    disclosed,
    ...Object.fromEntries(keys.map(key => [key, disclosed ? candidateIdentity?.[key] || null : null]))
  };
}

export function buildCandidateAdvancementAirlock({ upstream = null, candidateIdentity = null, cycleActionRegistry = disabledCandidateCycleActionRegistry(), candidateAdvancementRegistry = disabledCandidateAdvancementRegistry(), events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const cycleRegistry = summarizeCandidateCycleActionRegistry(cycleActionRegistry, generatedAt);
  const advancementRegistry = summarizeCandidateAdvancementRegistry(candidateAdvancementRegistry, generatedAt);
  const independentResultCurrent = upstream?.independentResultFrozen === true && CYCLE_ID.test(String(upstream?.cycleId || "")) && ["close-this-refinement-cycle", "continue-refinement", "hold-study"].includes(upstream?.cycleCloseRecommendation);
  const cycleEvidence = cycleActionPackage(upstream);
  const cycleRoomRecord = independentResultCurrent ? roomChallenge(events, "cycle-action", cycleEvidence.cycleActionPackageHash, cycleRegistry.registryFingerprint, CANDIDATE_CYCLE_ACTION_PURPOSES, generatedAt) : null;
  const cycleVerifiedEvents = cycleRoomRecord?.attestations || [];
  const cycleFreezeEvent = cycleVerifiedEvents.find(event => event.attestation.purpose === "evaluation-custody-confirmation") || null;
  const cycleActionFrozen = cycleVerifiedEvents.length === CANDIDATE_CYCLE_ACTION_PURPOSES.length && Boolean(cycleFreezeEvent);
  const cycleAction = cycleFreezeEvent?.attestation?.decision?.cycleAction || null;
  const cycleClosed = cycleActionFrozen && cycleAction === "close-this-refinement-cycle";
  const cycleActionFreeze = cycleFreezeEvent ? { attestationFingerprint: cycleFreezeEvent.attestationFingerprint, eventHash: cycleFreezeEvent.hash } : null;
  const advancementRecommended = upstream?.candidateRecommendation === "advance-to-separate-provider-model-decision";
  const candidateIdentityReady = Boolean(candidateIdentity && ["laneId", "candidateSlot", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "policyHash", "retestProtocolFingerprint", "hostingPattern", "region", "domainEvidenceFingerprint", "modelTrialChainHead", "candidateTrialChainHead", "candidateTrialProtocolFingerprint", "candidateReturnChainHead", "candidateRetestReturnChainHead"].every(key => candidateIdentity[key]));
  const candidateEligible = cycleClosed && advancementRecommended && candidateIdentityReady;
  const candidateEvidence = candidatePackage({ upstream, cycleActionFreeze, candidateIdentity });
  const candidateRoomRecord = candidateEligible ? roomChallenge(events, "candidate-advancement", candidateEvidence.candidatePackageHash, advancementRegistry.registryFingerprint, CANDIDATE_ADVANCEMENT_PURPOSES, generatedAt) : null;
  const candidateVerifiedEvents = candidateRoomRecord?.attestations || [];
  const candidateFreezeEvent = candidateVerifiedEvents.find(event => event.attestation.purpose === "product-sponsor-advancement-freeze") || null;
  const candidateAdvancementFrozen = candidateVerifiedEvents.length === CANDIDATE_ADVANCEMENT_PURPOSES.length && Boolean(candidateFreezeEvent);
  const advancementDecision = candidateFreezeEvent?.attestation?.decision?.advancementDecision || null;
  const exactCandidateAdvancedToIntegrationReadiness = candidateAdvancementFrozen && advancementDecision === "advance-exact-candidate-to-integration-readiness";
  let status = "independent-result-required";
  if (independentResultCurrent) status = cycleRegistry.registryCurrent && cycleRegistry.activeKeyCount >= 2 ? cycleRoomRecord ? "cycle-action-in-progress" : "cycle-action-challenge-required" : "cycle-action-registry-required";
  if (cycleActionFrozen && !cycleClosed) status = "cycle-action-frozen-no-advancement";
  if (cycleClosed && !advancementRecommended) status = "cycle-closed-no-advancement";
  if (cycleClosed && advancementRecommended && !candidateIdentityReady) status = "candidate-identity-evidence-required";
  if (candidateEligible) status = advancementRegistry.registryCurrent && advancementRegistry.activeKeyCount >= 4 ? candidateRoomRecord ? "candidate-advancement-in-progress" : "candidate-advancement-challenge-required" : "candidate-advancement-registry-required";
  if (candidateAdvancementFrozen) status = "candidate-advancement-frozen";
  const cycleRoom = challengeView({ room: "cycle-action", purposes: CANDIDATE_CYCLE_ACTION_PURPOSES, challenge: cycleRoomRecord?.event?.challenge || null, verifiedEvents: cycleVerifiedEvents });
  const advancementRoom = challengeView({ room: "candidate-advancement", purposes: CANDIDATE_ADVANCEMENT_PURPOSES, challenge: candidateRoomRecord?.event?.challenge || null, verifiedEvents: candidateVerifiedEvents });
  const core = {
    contractVersion: CANDIDATE_ADVANCEMENT_CONTRACT,
    status,
    headline: "Close the cycle. Then name the exact candidate.",
    descriptor: "Two separately signed rooms turn a recommendation into bounded action without borrowing release authority.",
    cycleId: upstream?.cycleId || null,
    prerequisites: {
      independentResultCurrent,
      cycleActionFrozen,
      cycleClosed,
      advancementRecommended,
      candidateIdentityReady,
      candidateEligible
    },
    evidence: {
      cycleAction: cycleEvidence,
      candidate: candidateEligible ? candidateEvidence : null
    },
    registries: {
      cycleAction: cycleRegistry,
      candidateAdvancement: advancementRegistry
    },
    rooms: {
      cycleAction: cycleRoom,
      candidateAdvancement: advancementRoom
    },
    cycleAction: {
      frozen: cycleActionFrozen,
      decision: cycleAction,
      cycleClosed,
      recommendation: upstream?.cycleCloseRecommendation || null,
      freezeFingerprint: cycleFreezeEvent?.attestationFingerprint || null
    },
    candidateIdentity: maskedCandidateIdentity(candidateIdentity, candidateEligible),
    candidateAdvancement: {
      frozen: candidateAdvancementFrozen,
      decision: advancementDecision,
      exactCandidateAdvancedToIntegrationReadiness,
      freezeFingerprint: candidateFreezeEvent?.attestationFingerprint || null
    },
    counts: {
      cycleActionDutiesRequired: 2,
      cycleActionDutiesVerified: cycleVerifiedEvents.length,
      candidateAdvancementDutiesRequired: 4,
      candidateAdvancementDutiesVerified: candidateVerifiedEvents.length,
      exactCandidatesAdvanced: exactCandidateAdvancedToIntegrationReadiness ? 1 : 0
    },
    cycleActionRecorded: cycleVerifiedEvents.some(event => event.attestation.purpose === "clinical-cycle-action"),
    cycleActionFrozen,
    cycleClosed,
    candidateSuitabilityRecorded: candidateVerifiedEvents.some(event => event.attestation.purpose === "clinical-suitability-advancement"),
    privacySecurityFitRecorded: candidateVerifiedEvents.some(event => event.attestation.purpose === "privacy-security-transport-fit"),
    eqpassIntegrationFitRecorded: candidateVerifiedEvents.some(event => event.attestation.purpose === "eqpass-integration-fit"),
    candidateAdvancementFrozen,
    exactCandidateAdvancedToIntegrationReadiness,
    ...falseClaims(),
    registryWriteApiAvailable: false,
    signingApiAvailable: false,
    externalTransmissionPerformed: false,
    boundary: CANDIDATE_ADVANCEMENT_BOUNDARY
  };
  return {
    ...core,
    airlockFingerprint: candidateAdvancementDigest(core),
    history: events.slice().reverse().map(event => ({
      sequence: event.sequence,
      eventType: event.eventType,
      room: event.challenge?.room || (event.eventType.startsWith("candidate-cycle") ? "cycle-action" : "candidate-advancement"),
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

export function validateCandidateAdvancementContract() {
  const errors = [];
  if (CANDIDATE_CYCLE_ACTION_PURPOSES.length !== 2 || new Set(CANDIDATE_CYCLE_ACTION_PURPOSES).size !== 2) errors.push("Cycle action must preserve two distinct ordered duties.");
  if (CANDIDATE_ADVANCEMENT_PURPOSES.length !== 4 || new Set(CANDIDATE_ADVANCEMENT_PURPOSES).size !== 4) errors.push("Candidate advancement must preserve four distinct ordered duties.");
  if (!/Room I records a separately signed close, continue, or hold action/i.test(CANDIDATE_ADVANCEMENT_BOUNDARY) || !/Only a signed close/i.test(CANDIDATE_ADVANCEMENT_BOUNDARY) || !/does not verify an external model execution/i.test(CANDIDATE_ADVANCEMENT_BOUNDARY) || !/patient use/i.test(CANDIDATE_ADVANCEMENT_BOUNDARY)) errors.push("Candidate advancement boundary is incomplete.");
  if (Object.values(CONTENT_BOUNDARY).some(Boolean)) errors.push("Candidate advancement content boundary must remain metadata-only.");
  return errors;
}
