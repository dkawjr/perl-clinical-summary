import { createHash, randomUUID } from "node:crypto";
import {
  GENERATION_OUTPUT_CONTRACT,
  GENERATION_POLICY_HASH,
  GENERATION_POLICY_VERSION,
  validateGenerationBundle
} from "./model-gateway.js";

export const CANDIDATE_RETURN_CONTRACT = "perl-manual-candidate-return/1.0";
export const CANDIDATE_RETURN_MAX_BYTES = 262144;

export const CANDIDATE_RETURN_BOUNDARY = "This desk receives only structured candidate-output returns for the nine predeclared synthetic run envelopes after candidate metadata is declared. PERL does not send the scored case, call a provider, configure an endpoint, receive credentials, accept raw responses, Findings content, source files, patient or counselor identities, production records, or PHI through this boundary. Returned prose is validated against the current synthetic case and generation contract, stored without being rendered in the return desk, and held for a separately governed blind-review workflow. A complete local return set does not verify the provider or the external run, authorize trial execution or counselor review, establish accuracy, reliability, safety, usefulness, or clinical validity, select an engine, change care, authorize a pilot, release production, or permit patient use.";

const HEX_64 = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;
const SAFE_ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;

const PRIVACY_FIELDS = Object.freeze([
  "assessmentPayloadIncluded",
  "rawResponsesIncluded",
  "findingsContentIncluded",
  "sourceFileBytesIncluded",
  "patientIdentifiersIncluded",
  "counselorIdentityIncluded",
  "credentialsIncluded",
  "endpointIncluded",
  "phiIncluded"
]);

const FALSE_CLAIMS = Object.freeze([
  "providerCallPerformedByPerl",
  "externalTransferPerformedByPerl",
  "candidateRunExternallyVerified",
  "vendorVerified",
  "trialExecutionAuthorized",
  "counselorPanelAccepted",
  "blindReviewAuthorized",
  "clinicalPerformanceEstablished",
  "accuracyEstablished",
  "reliabilityEstablished",
  "safetyEstablished",
  "usefulnessEstablished",
  "clinicalValidation",
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

function digest(value) {
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
  if (unknown.length) errors.push(`${label} contains fields outside the return contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function falseBook(fields) {
  return Object.fromEntries(fields.map(key => [key, false]));
}

function candidateMap(modelTrial) {
  return new Map((modelTrial?.candidates || []).map(candidate => [candidate.id, candidate]));
}

function currentEventForRun(events, run, candidate) {
  return [...events].reverse().find(event => event.runId === run.runId
    && event.protocolFingerprint === run.protocolFingerprint
    && event.candidateFingerprint === candidate?.fingerprint) || null;
}

function returnEnvelope(run, candidate) {
  return {
    runId: run.runId,
    candidateSlot: run.candidateSlot,
    caseId: run.caseId,
    caseFingerprint: run.caseFingerprint,
    protocolFingerprint: run.protocolFingerprint,
    candidateFingerprint: candidate?.fingerprint || null,
    providerId: candidate?.providerId || null,
    modelVersion: candidate?.modelVersion || null,
    promptVersion: "REPLACE-WITH-EXACT-PROMPT-VERSION",
    outputContract: GENERATION_OUTPUT_CONTRACT,
    policyVersion: GENERATION_POLICY_VERSION,
    policyHash: GENERATION_POLICY_HASH,
    syntheticOnly: true,
    authorityStatus: "unverified-manual-synthetic-return",
    bundle: null
  };
}

export function validateCandidateReturnContract() {
  const errors = [];
  if (!/nine predeclared synthetic run envelopes/i.test(CANDIDATE_RETURN_BOUNDARY)) errors.push("Candidate-return boundary must name the nine-run limit.");
  if (!/does not send the scored case/i.test(CANDIDATE_RETURN_BOUNDARY) || !/does not .*select an engine/i.test(CANDIDATE_RETURN_BOUNDARY)) errors.push("Candidate-return execution and authority boundary is incomplete.");
  if (PRIVACY_FIELDS.length !== 9 || FALSE_CLAIMS.length !== 18) errors.push("Candidate-return false-claim books are incomplete.");
  return errors;
}

export function buildCandidateReturnDesk({ candidateTrial, modelTrial, events = [], chain = { valid: true, count: 0, failedAt: null, head: null, returns: 0 }, generatedAt = new Date().toISOString() } = {}) {
  const candidates = candidateMap(modelTrial);
  const runs = (candidateTrial?.runEnvelopes || []).map(run => {
    const candidate = candidates.get(run.candidateSlot);
    const protocolFingerprint = candidateTrial?.protocolFingerprint || null;
    const current = currentEventForRun(events, { ...run, protocolFingerprint }, candidate);
    return {
      runId: run.runId,
      candidateSlot: run.candidateSlot,
      caseId: run.caseId,
      caseFingerprint: run.caseFingerprint,
      protocolFingerprint,
      candidateFingerprint: candidate?.fingerprint || null,
      providerId: candidate?.providerId || null,
      modelVersion: candidate?.modelVersion || null,
      candidateMetadataComplete: candidate?.status === "candidate-metadata-complete-unverified",
      status: current ? "structured-return-held-unverified" : candidate?.status === "candidate-metadata-complete-unverified" ? "awaiting-manual-synthetic-return" : "awaiting-candidate-metadata",
      currentReturn: current ? {
        sequence: current.sequence,
        createdAt: current.createdAt,
        bundleHash: current.bundleHash,
        hash: current.hash
      } : null,
      outputContentRendered: false
    };
  });
  const metadataComplete = Number(modelTrial?.counts?.metadataComplete || 0);
  const received = runs.filter(run => run.currentReturn).length;
  const candidatesWithReturns = new Set(runs.filter(run => run.currentReturn).map(run => run.candidateSlot)).size;
  const complete = received === 9;
  const status = complete
    ? "local-synthetic-return-set-complete"
    : metadataComplete === 3 ? "ready-for-manual-synthetic-returns" : "awaiting-candidate-metadata";
  const templateRuns = runs.map(run => returnEnvelope(run, candidates.get(run.candidateSlot)));
  const requestTemplate = {
    contractVersion: CANDIDATE_RETURN_CONTRACT,
    environment: "synthetic-calibration",
    authorityStatus: "unverified-manual-synthetic-return",
    returns: templateRuns,
    privacyBoundary: falseBook(PRIVACY_FIELDS)
  };
  return {
    contractVersion: CANDIDATE_RETURN_CONTRACT,
    status,
    headline: "The model comes back through a narrow door.",
    descriptor: "Nine structured synthetic returns, accepted without exposing the case or announcing a winner.",
    counts: {
      candidateSlots: 3,
      candidateMetadataComplete: metadataComplete,
      runsPlanned: runs.length,
      currentReturnsReceived: received,
      currentReturnsMissing: Math.max(0, runs.length - received),
      candidatesWithReturns,
      outputGatesRequired: 10,
      providerCallsPerformedByPerl: 0
    },
    runs,
    requestTemplate,
    requestFingerprint: digest({ contractVersion: CANDIDATE_RETURN_CONTRACT, returns: templateRuns.map(({ bundle, promptVersion, ...item }) => item), privacyBoundary: requestTemplate.privacyBoundary, boundary: CANDIDATE_RETURN_BOUNDARY }),
    protocolFingerprint: candidateTrial?.protocolFingerprint || null,
    returnSetStructurallyComplete: complete,
    outputContentRendered: false,
    ...falseBook(FALSE_CLAIMS),
    history: events.map(event => ({
      sequence: event.sequence,
      runId: event.runId,
      candidateSlot: event.candidateSlot,
      caseId: event.caseId,
      status: event.status,
      bundleHash: event.bundleHash,
      createdAt: event.createdAt,
      hash: event.hash,
      current: runs.some(run => run.runId === event.runId && run.currentReturn?.hash === event.hash)
    })),
    chain: clone(chain),
    boundary: CANDIDATE_RETURN_BOUNDARY,
    generatedAt
  };
}

export function validateCandidateReturnManifest(manifest, { desk, assessmentsById = {} } = {}) {
  const errors = [];
  const rootKeys = ["contractVersion", "environment", "authorityStatus", "returns", "privacyBoundary"];
  if (!exactKeys(manifest, rootKeys, "Candidate-return manifest", errors)) return errors;
  if (Buffer.byteLength(JSON.stringify(manifest), "utf8") > CANDIDATE_RETURN_MAX_BYTES) errors.push("Candidate-return manifest exceeds the 256 KB limit.");
  if (manifest.contractVersion !== CANDIDATE_RETURN_CONTRACT) errors.push(`contractVersion must be ${CANDIDATE_RETURN_CONTRACT}.`);
  if (manifest.environment !== "synthetic-calibration" || manifest.authorityStatus !== "unverified-manual-synthetic-return") errors.push("Candidate returns must remain an unverified synthetic-calibration handoff.");
  if (exactKeys(manifest.privacyBoundary, PRIVACY_FIELDS, "privacyBoundary", errors)) {
    for (const key of PRIVACY_FIELDS) if (manifest.privacyBoundary[key] !== false) errors.push(`privacyBoundary.${key} must remain false.`);
  }
  if (!Array.isArray(manifest.returns) || manifest.returns.length < 1 || manifest.returns.length > 9) {
    errors.push("returns must contain one through nine predeclared synthetic run returns.");
    return [...new Set(errors)];
  }
  const deskRuns = new Map((desk?.runs || []).map(run => [run.runId, run]));
  const seen = new Set();
  const returnKeys = ["runId", "candidateSlot", "caseId", "caseFingerprint", "protocolFingerprint", "candidateFingerprint", "providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "policyHash", "syntheticOnly", "authorityStatus", "bundle"];
  manifest.returns.forEach((item, index) => {
    const label = `returns[${index}]`;
    if (!exactKeys(item, returnKeys, label, errors)) return;
    if (seen.has(item.runId)) errors.push(`${label}.runId is repeated.`);
    seen.add(item.runId);
    const run = deskRuns.get(item.runId);
    if (!run) {
      errors.push(`${label}.runId is not one of the nine current envelopes.`);
      return;
    }
    if (!run.candidateMetadataComplete || !run.candidateFingerprint) errors.push(`${label} cannot return until its candidate metadata is complete.`);
    for (const key of ["candidateSlot", "caseId", "caseFingerprint", "protocolFingerprint", "candidateFingerprint", "providerId", "modelVersion"]) {
      if (item[key] !== run[key]) errors.push(`${label}.${key} does not match the current run envelope.`);
    }
    if (!SAFE_TEXT.test(String(item.promptVersion || ""))) errors.push(`${label}.promptVersion is invalid.`);
    if (item.outputContract !== GENERATION_OUTPUT_CONTRACT || item.policyVersion !== GENERATION_POLICY_VERSION || item.policyHash !== GENERATION_POLICY_HASH) errors.push(`${label} generation contract provenance is invalid.`);
    if (item.syntheticOnly !== true || item.authorityStatus !== "unverified-manual-synthetic-return") errors.push(`${label} must remain an unverified synthetic return.`);
    const assessment = assessmentsById[item.caseId];
    if (!assessment) errors.push(`${label} does not resolve to a current synthetic case.`);
    else errors.push(...validateGenerationBundle(item.bundle, assessment).map(error => `${label}.bundle: ${error}`));
  });
  return [...new Set(errors)];
}

export function createCandidateReturnEvent({ returnItem, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const bundleHash = digest(returnItem.bundle);
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CANDIDATE_RETURN_CONTRACT,
    type: "manual-synthetic-candidate-output-return-recorded",
    status: "structured-return-held-unverified",
    runId: returnItem.runId,
    candidateSlot: returnItem.candidateSlot,
    caseId: returnItem.caseId,
    caseFingerprint: returnItem.caseFingerprint,
    protocolFingerprint: returnItem.protocolFingerprint,
    candidateFingerprint: returnItem.candidateFingerprint,
    providerId: returnItem.providerId,
    modelVersion: returnItem.modelVersion,
    promptVersion: returnItem.promptVersion,
    outputContract: returnItem.outputContract,
    policyVersion: returnItem.policyVersion,
    policyHash: returnItem.policyHash,
    bundle: clone(returnItem.bundle),
    bundleHash,
    outputGatePassed: true,
    outputGateCount: 10,
    syntheticOnly: true,
    privacyBoundary: falseBook(PRIVACY_FIELDS),
    decision: "hold-structured-synthetic-output-for-separately-governed-blind-review",
    ...falseBook(FALSE_CLAIMS),
    actor,
    createdAt,
    note: "A structured output for one predeclared synthetic candidate run passed the local generation contract and entered the immutable return ledger. PERL did not perform or verify the external run, expose the output in this desk, authorize blind review, establish performance, select an engine, or authorize clinical, pilot, production, or patient use."
  };
  return { ...core, hash: digest(core) };
}

export function validateCandidateReturnEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, assessment = null } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Candidate-return event is required."];
  if (event.contractVersion !== CANDIDATE_RETURN_CONTRACT || event.type !== "manual-synthetic-candidate-output-return-recorded" || event.status !== "structured-return-held-unverified") errors.push("Candidate-return event identity is invalid.");
  if (!Number.isInteger(event.sequence) || event.sequence < 1 || event.sequence !== sequence || event.previousHash !== previousHash || !CHAIN_HEAD.test(String(event.previousHash || ""))) errors.push("Candidate-return chain position is invalid.");
  for (const key of ["caseFingerprint", "protocolFingerprint", "candidateFingerprint", "policyHash", "bundleHash", "hash"]) if (!HEX_64.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  if (!/^FF-CANDIDATE-RUN-\d{2}$/.test(String(event.runId || "")) || !/^candidate-0[1-3]$/.test(String(event.candidateSlot || "")) || !/^FF-TEST-[A-Z0-9-]+$/.test(String(event.caseId || ""))) errors.push("Candidate-return run identity is invalid.");
  for (const key of ["providerId", "modelVersion", "promptVersion"]) if (!SAFE_TEXT.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  if (event.outputContract !== GENERATION_OUTPUT_CONTRACT || event.policyVersion !== GENERATION_POLICY_VERSION || event.policyHash !== GENERATION_POLICY_HASH || event.outputGatePassed !== true || event.outputGateCount !== 10) errors.push("Candidate-return generation gate evidence is invalid.");
  if (assessment) errors.push(...validateGenerationBundle(event.bundle, assessment).map(error => `bundle: ${error}`));
  if (digest(event.bundle) !== event.bundleHash) errors.push("Candidate-return bundle fingerprint is invalid.");
  if (event.syntheticOnly !== true || !event.privacyBoundary || PRIVACY_FIELDS.some(key => event.privacyBoundary[key] !== false)) errors.push("Candidate-return privacy boundary is invalid.");
  if (event.decision !== "hold-structured-synthetic-output-for-separately-governed-blind-review") errors.push("Candidate-return disposition is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!SAFE_ACTOR.test(String(event.actor || "")) || !Number.isFinite(Date.parse(event.createdAt)) || String(event.note || "").length < 260) errors.push("Candidate-return actor, timestamp, or note is invalid.");
  const { hash, ...core } = event;
  if (digest(core) !== hash) errors.push("Candidate-return event hash is invalid.");
  return [...new Set(errors)];
}

export function candidateReturnBundleHash(bundle) {
  return digest(bundle);
}
