import { createHash, randomUUID } from "node:crypto";
import {
  GENERATION_OUTPUT_CONTRACT,
  GENERATION_POLICY_HASH,
  GENERATION_POLICY_VERSION,
  validateGenerationBundle
} from "./model-gateway.js";

export const CANDIDATE_RETEST_RETURN_CONTRACT = "perl-candidate-retest-return/1.0";
export const CANDIDATE_RETEST_RETURN_MAX_BYTES = 262144;

export const CANDIDATE_RETEST_RETURN_BOUNDARY = "This return seam accepts exactly the three structured synthetic outputs bound to one open Candidate Refinement and Retest cycle. Each return must preserve the same case, anonymous lane, candidate fingerprint, provider, model version, baseline artifact, and retest protocol while declaring one externally applied intervention and a new prompt version. PERL validates the bundle but does not perform or verify the external model change or provider run, expose returned prose in the public desk, accept raw responses, Findings content, source files, identities, credentials, endpoints, production records, or PHI. Receipt does not establish improvement, accuracy, reliability, safety, usefulness, clinical validity, satisfaction with the Clinical Standard, ranking, selection, pilot authority, production release, or patient use.";

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYCLE_ID = /^FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80}$/;
const ENVELOPE_ID = /^FF-CANDIDATE-RETEST-[A-F0-9-]{20,80}$/;
const CASE_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const LANE_ID = /^lane-i{1,3}$/;
const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;

const PRIVACY_FIELDS = Object.freeze([
  "assessmentPayloadIncluded",
  "rawResponsesIncluded",
  "findingsContentIncluded",
  "sourceFileBytesIncluded",
  "patientIdentifiersIncluded",
  "counselorIdentityIncluded",
  "reviewerIdentityIncluded",
  "credentialsIncluded",
  "endpointIncluded",
  "phiIncluded"
]);

const FALSE_CLAIMS = Object.freeze([
  "providerCallPerformedByPerl",
  "modelModificationPerformedByPerl",
  "externalTransferPerformedByPerl",
  "candidateRetestExecutionVerified",
  "candidateRunExternallyVerified",
  "providerVerified",
  "reviewerIdentityVerified",
  "counselorQualificationVerified",
  "blindReReviewCompleted",
  "improvementEstablished",
  "accuracyEstablished",
  "reliabilityEstablished",
  "safetyEstablished",
  "usefulnessEstablished",
  "clinicalStandardMet",
  "clinicalValidation",
  "engineRanked",
  "engineSelected",
  "carePlanChanged",
  "pilotAuthorized",
  "productionReleaseAuthorized",
  "patientUseAuthorized"
]);

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function candidateRetestReturnDigest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
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

function falseBook(fields) {
  return Object.fromEntries(fields.map(key => [key, false]));
}

function interventionProjection(cycle) {
  return {
    type: cycle.intervention.type,
    targetMeasure: cycle.intervention.targetMeasure,
    iterationGoal: cycle.intervention.iterationGoal
  };
}

function validateIntervention(intervention, expected, label, errors) {
  const keys = ["type", "targetMeasure", "iterationGoal"];
  if (!exactKeys(intervention, keys, label, errors)) return;
  for (const key of keys) if (intervention[key] !== expected?.[key]) errors.push(`${label}.${key} does not match the scoped cycle intervention.`);
}

function validatePrivacyBoundary(boundary, errors) {
  if (!exactKeys(boundary, PRIVACY_FIELDS, "privacyBoundary", errors)) return;
  for (const key of PRIVACY_FIELDS) if (boundary[key] !== false) errors.push(`privacyBoundary.${key} must remain false.`);
}

export function validateCandidateRetestReturnContract() {
  const errors = [];
  if (!/exactly the three structured synthetic outputs/i.test(CANDIDATE_RETEST_RETURN_BOUNDARY)) errors.push("Candidate retest-return boundary must preserve the exact three-output limit.");
  if (!/does not perform or verify the external model change or provider run/i.test(CANDIDATE_RETEST_RETURN_BOUNDARY)) errors.push("Candidate retest-return execution boundary is incomplete.");
  if (!/does not establish improvement, accuracy, reliability/i.test(CANDIDATE_RETEST_RETURN_BOUNDARY) || !/ranking, selection/i.test(CANDIDATE_RETEST_RETURN_BOUNDARY)) errors.push("Candidate retest-return authority boundary is incomplete.");
  if (PRIVACY_FIELDS.length !== 10 || FALSE_CLAIMS.length !== 22) errors.push("Candidate retest-return privacy or false-claim book is incomplete.");
  return errors;
}

export function buildCandidateRetestReturnTemplate({ cycle, baselineByArtifactHash = {} } = {}) {
  if (!cycle || cycle.contractVersion !== "perl-candidate-refinement-retest/1.0") throw new Error("A current candidate refinement cycle is required.");
  const returns = cycle.retestEnvelopes.map(envelope => {
    const baseline = baselineByArtifactHash[envelope.baselineArtifactHash] || {};
    return {
      envelopeId: envelope.envelopeId,
      cycleId: cycle.cycleId,
      laneId: cycle.laneId,
      caseId: envelope.caseId,
      caseFingerprint: envelope.caseFingerprint,
      baselineArtifactHash: envelope.baselineArtifactHash,
      retestProtocolFingerprint: envelope.retestProtocolFingerprint,
      candidateFingerprint: baseline.candidateFingerprint || "REPLACE-WITH-EXACT-CANDIDATE-FINGERPRINT",
      providerId: baseline.providerId || "REPLACE-WITH-EXACT-PROVIDER-ID",
      modelVersion: baseline.modelVersion || "REPLACE-WITH-EXACT-MODEL-VERSION",
      promptVersion: "REPLACE-WITH-NEW-EXACT-PROMPT-VERSION",
      executionReference: "REPLACE-WITH-BOUNDED-EXTERNAL-EXECUTION-REFERENCE",
      intervention: interventionProjection(cycle),
      outputContract: GENERATION_OUTPUT_CONTRACT,
      policyVersion: GENERATION_POLICY_VERSION,
      policyHash: GENERATION_POLICY_HASH,
      manualExecutionDeclared: true,
      interventionAppliedDeclared: true,
      sameProviderModelDeclared: true,
      syntheticOnly: true,
      authorityStatus: "unverified-manual-synthetic-retest-return",
      bundle: null
    };
  });
  return {
    contractVersion: CANDIDATE_RETEST_RETURN_CONTRACT,
    environment: "synthetic-calibration",
    authorityStatus: "unverified-manual-synthetic-retest-return",
    cycleId: cycle.cycleId,
    retestProtocolFingerprint: cycle.retestPolicy.retestProtocolFingerprint,
    returns,
    privacyBoundary: falseBook(PRIVACY_FIELDS)
  };
}

export function validateCandidateRetestReturnManifest(manifest, { cycle, baselineByArtifactHash = {}, assessmentsById = {} } = {}) {
  const errors = [];
  const rootKeys = ["contractVersion", "environment", "authorityStatus", "cycleId", "retestProtocolFingerprint", "returns", "privacyBoundary"];
  if (!exactKeys(manifest, rootKeys, "Candidate retest-return manifest", errors)) return errors;
  if (Buffer.byteLength(JSON.stringify(manifest), "utf8") > CANDIDATE_RETEST_RETURN_MAX_BYTES) errors.push("Candidate retest-return manifest exceeds the 256 KB limit.");
  if (manifest.contractVersion !== CANDIDATE_RETEST_RETURN_CONTRACT) errors.push(`contractVersion must be ${CANDIDATE_RETEST_RETURN_CONTRACT}.`);
  if (manifest.environment !== "synthetic-calibration" || manifest.authorityStatus !== "unverified-manual-synthetic-retest-return") errors.push("Candidate retest returns must remain an unverified synthetic-calibration handoff.");
  if (!cycle || manifest.cycleId !== cycle?.cycleId || manifest.retestProtocolFingerprint !== cycle?.retestPolicy?.retestProtocolFingerprint) errors.push("Candidate retest-return manifest does not match the current scoped cycle.");
  validatePrivacyBoundary(manifest.privacyBoundary, errors);
  if (!Array.isArray(manifest.returns) || manifest.returns.length < 1 || manifest.returns.length > 3) {
    errors.push("returns must contain one through three current same-case retest envelopes.");
    return [...new Set(errors)];
  }
  const envelopes = new Map((cycle?.retestEnvelopes || []).map(envelope => [envelope.envelopeId, envelope]));
  const seen = new Set();
  const returnKeys = ["envelopeId", "cycleId", "laneId", "caseId", "caseFingerprint", "baselineArtifactHash", "retestProtocolFingerprint", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "executionReference", "intervention", "outputContract", "policyVersion", "policyHash", "manualExecutionDeclared", "interventionAppliedDeclared", "sameProviderModelDeclared", "syntheticOnly", "authorityStatus", "bundle"];
  manifest.returns.forEach((item, index) => {
    const label = `returns[${index}]`;
    if (!exactKeys(item, returnKeys, label, errors)) return;
    if (seen.has(item.envelopeId)) errors.push(`${label}.envelopeId is repeated.`);
    seen.add(item.envelopeId);
    const envelope = envelopes.get(item.envelopeId);
    if (!envelope) {
      errors.push(`${label}.envelopeId is not part of the current scoped cycle.`);
      return;
    }
    for (const key of ["cycleId", "laneId", "caseId", "caseFingerprint", "baselineArtifactHash", "retestProtocolFingerprint"]) {
      const expected = key === "laneId" ? cycle.laneId : key === "cycleId" ? cycle.cycleId : envelope[key];
      if (item[key] !== expected) errors.push(`${label}.${key} does not match the immutable retest envelope.`);
    }
    const baseline = baselineByArtifactHash[item.baselineArtifactHash];
    if (!baseline) errors.push(`${label}.baselineArtifactHash does not resolve to a current baseline return.`);
    else {
      for (const key of ["candidateFingerprint", "providerId", "modelVersion"]) if (item[key] !== baseline[key]) errors.push(`${label}.${key} does not match the bound baseline provenance.`);
      if (item.promptVersion === baseline.promptVersion) errors.push(`${label}.promptVersion must identify the new scoped intervention version, not the baseline prompt version.`);
    }
    for (const key of ["providerId", "modelVersion", "promptVersion", "executionReference"]) if (!SAFE_TEXT.test(String(item[key] || ""))) errors.push(`${label}.${key} is invalid.`);
    if (!HEX.test(String(item.candidateFingerprint || ""))) errors.push(`${label}.candidateFingerprint is invalid.`);
    validateIntervention(item.intervention, interventionProjection(cycle), `${label}.intervention`, errors);
    if (item.outputContract !== GENERATION_OUTPUT_CONTRACT || item.policyVersion !== GENERATION_POLICY_VERSION || item.policyHash !== GENERATION_POLICY_HASH) errors.push(`${label} generation-contract provenance is invalid.`);
    if (item.manualExecutionDeclared !== true || item.interventionAppliedDeclared !== true || item.sameProviderModelDeclared !== true || item.syntheticOnly !== true || item.authorityStatus !== "unverified-manual-synthetic-retest-return") errors.push(`${label} must preserve the exact external-execution declaration and unverified synthetic authority status.`);
    const assessment = assessmentsById[item.caseId];
    if (!assessment) errors.push(`${label} does not resolve to a current synthetic case.`);
    else errors.push(...validateGenerationBundle(item.bundle, assessment).map(error => `${label}.bundle: ${error}`));
  });
  return [...new Set(errors)];
}

export function createCandidateRetestReturnEvent({ returnItem, cycle, baseline, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  if (!ACTOR.test(String(actor || ""))) throw new Error("Candidate retest-return actor code is invalid.");
  const bundleHash = candidateRetestReturnDigest(returnItem.bundle);
  const executionReferenceHash = candidateRetestReturnDigest(returnItem.executionReference);
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CANDIDATE_RETEST_RETURN_CONTRACT,
    eventType: "manual-synthetic-candidate-retest-return-recorded",
    status: "structured-retest-return-held-unverified",
    envelopeId: returnItem.envelopeId,
    cycleId: returnItem.cycleId,
    cycleEventHash: cycle.hash,
    laneId: returnItem.laneId,
    caseId: returnItem.caseId,
    caseFingerprint: returnItem.caseFingerprint,
    baselineArtifactHash: returnItem.baselineArtifactHash,
    baselinePromptVersionHash: candidateRetestReturnDigest(baseline.promptVersion),
    retestProtocolFingerprint: returnItem.retestProtocolFingerprint,
    candidateFingerprint: returnItem.candidateFingerprint,
    providerId: returnItem.providerId,
    modelVersion: returnItem.modelVersion,
    promptVersion: returnItem.promptVersion,
    executionReferenceHash,
    intervention: clone(returnItem.intervention),
    outputContract: returnItem.outputContract,
    policyVersion: returnItem.policyVersion,
    policyHash: returnItem.policyHash,
    bundle: clone(returnItem.bundle),
    bundleHash,
    outputGatePassed: true,
    outputGateCount: 10,
    syntheticOnly: true,
    manualExternalExecutionDeclared: true,
    sameProviderModelDeclared: true,
    interventionAppliedDeclared: true,
    candidateRetestReturnReceived: true,
    privacyBoundary: falseBook(PRIVACY_FIELDS),
    decision: "hold-structured-retest-output-for-blinded-same-case-rereview",
    ...falseBook(FALSE_CLAIMS),
    actorCodeHash: candidateRetestReturnDigest(actor),
    createdAt,
    note: "One structured output for an exact same-case retest envelope passed the local generation contract and entered the immutable retest-return ledger. The return declares—but PERL does not verify—manual external execution, the same provider and model, and application of the single scoped intervention. Output remains hidden from the public desk and held for a fresh blinded baseline-versus-retest review. No improvement, accuracy, reliability, safety, usefulness, clinical-standard, ranking, selection, clinical, pilot, production, or patient-use claim was created."
  };
  return { ...core, hash: candidateRetestReturnDigest(core) };
}

function validateEventPrivacyBoundary(boundary, errors) {
  validatePrivacyBoundary(boundary, errors);
}

export function validateCandidateRetestReturnEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, knownEnvelopeById = null, assessment = null } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Candidate retest-return event is required."];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "eventType", "status", "envelopeId", "cycleId", "cycleEventHash", "laneId", "caseId", "caseFingerprint", "baselineArtifactHash", "baselinePromptVersionHash", "retestProtocolFingerprint", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "executionReferenceHash", "intervention", "outputContract", "policyVersion", "policyHash", "bundle", "bundleHash", "outputGatePassed", "outputGateCount", "syntheticOnly", "manualExternalExecutionDeclared", "sameProviderModelDeclared", "interventionAppliedDeclared", "candidateRetestReturnReceived", "privacyBoundary", "decision", ...FALSE_CLAIMS, "actorCodeHash", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Candidate retest-return event", errors)) return errors;
  if (event.contractVersion !== CANDIDATE_RETEST_RETURN_CONTRACT || event.eventType !== "manual-synthetic-candidate-retest-return-recorded" || event.status !== "structured-retest-return-held-unverified") errors.push("Candidate retest-return event identity is invalid.");
  if (!UUID.test(String(event.id || "")) || !Number.isInteger(event.sequence) || event.sequence < 1 || event.sequence !== sequence || event.previousHash !== previousHash || !CHAIN_HEAD.test(String(event.previousHash || ""))) errors.push("Candidate retest-return chain position is invalid.");
  if (!ENVELOPE_ID.test(String(event.envelopeId || "")) || !CYCLE_ID.test(String(event.cycleId || "")) || !LANE_ID.test(String(event.laneId || "")) || !CASE_ID.test(String(event.caseId || ""))) errors.push("Candidate retest-return envelope identity is invalid.");
  for (const key of ["cycleEventHash", "caseFingerprint", "baselineArtifactHash", "baselinePromptVersionHash", "retestProtocolFingerprint", "candidateFingerprint", "executionReferenceHash", "policyHash", "bundleHash", "actorCodeHash", "hash"]) if (!HEX.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  for (const key of ["providerId", "modelVersion", "promptVersion"]) if (!SAFE_TEXT.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  const known = knownEnvelopeById?.get(event.envelopeId) || null;
  if (known) {
    const expected = {
      cycleId: known.cycle.cycleId,
      cycleEventHash: known.cycle.hash,
      laneId: known.cycle.laneId,
      caseId: known.envelope.caseId,
      caseFingerprint: known.envelope.caseFingerprint,
      baselineArtifactHash: known.envelope.baselineArtifactHash,
      retestProtocolFingerprint: known.envelope.retestProtocolFingerprint,
      candidateFingerprint: known.baseline.candidateFingerprint,
      providerId: known.baseline.providerId,
      modelVersion: known.baseline.modelVersion,
      baselinePromptVersionHash: candidateRetestReturnDigest(known.baseline.promptVersion)
    };
    for (const [key, value] of Object.entries(expected)) if (event[key] !== value) errors.push(`${key} does not match the immutable cycle or baseline evidence.`);
    if (event.promptVersion === known.baseline.promptVersion) errors.push("promptVersion must differ from the bound baseline prompt version.");
    validateIntervention(event.intervention, interventionProjection(known.cycle), "intervention", errors);
  } else if (knownEnvelopeById) errors.push("Candidate retest-return envelope does not resolve to immutable cycle evidence.");
  if (event.outputContract !== GENERATION_OUTPUT_CONTRACT || event.policyVersion !== GENERATION_POLICY_VERSION || event.policyHash !== GENERATION_POLICY_HASH || event.outputGatePassed !== true || event.outputGateCount !== 10) errors.push("Candidate retest-return generation gate evidence is invalid.");
  if (assessment) errors.push(...validateGenerationBundle(event.bundle, assessment).map(error => `bundle: ${error}`));
  if (candidateRetestReturnDigest(event.bundle) !== event.bundleHash) errors.push("Candidate retest-return bundle fingerprint is invalid.");
  if (event.syntheticOnly !== true || event.manualExternalExecutionDeclared !== true || event.sameProviderModelDeclared !== true || event.interventionAppliedDeclared !== true || event.candidateRetestReturnReceived !== true) errors.push("Candidate retest-return execution declaration is invalid.");
  validateEventPrivacyBoundary(event.privacyBoundary, errors);
  if (event.decision !== "hold-structured-retest-output-for-blinded-same-case-rereview") errors.push("Candidate retest-return disposition is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!Number.isFinite(Date.parse(event.createdAt)) || String(event.note || "").length < 420 || String(event.note || "").length > 1400) errors.push("Candidate retest-return timestamp or note is invalid.");
  const { hash, ...core } = event;
  if (candidateRetestReturnDigest(core) !== hash) errors.push("Candidate retest-return event hash is invalid.");
  return [...new Set(errors)];
}

export function candidateRetestReturnReceipt(event) {
  return {
    sequence: event.sequence,
    envelopeId: event.envelopeId,
    cycleId: event.cycleId,
    laneId: event.laneId,
    caseId: event.caseId,
    status: event.status,
    bundleHash: event.bundleHash,
    outputGateCount: event.outputGateCount,
    externalExecutionVerified: false,
    outputContentRendered: false,
    comparativeOutcomePublished: false,
    improvementEstablished: false,
    createdAt: event.createdAt,
    hash: event.hash
  };
}
