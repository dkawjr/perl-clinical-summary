import { createHash, randomUUID } from "node:crypto";

export const CANDIDATE_BLIND_REVIEW_CONTRACT = "perl-candidate-blind-review/1.0";
export const CANDIDATE_BLIND_REVIEW_PROTOCOL = "candidate-blind-review-v1";
export const CANDIDATE_BLIND_REVIEW_ASSIGNMENT_HOURS = 24;

export const CANDIDATE_BLIND_REVIEW_BOUNDARY = "This gallery opens only after all nine current structured synthetic candidate returns are sealed, an exact three-case counselor-reference set is externally accepted and frozen, its source-only content resolves locally, and a pre-outcome clinical-standard draft exists. A reviewer receives one scored synthetic source profile and four anonymous summaries labeled A through D. The surface never reveals candidate, provider, model, prompt, or counselor authorship; accepts no names, credentials, narrative notes, raw responses, Findings content, files, patient records, or PHI; and performs no provider call or external transfer. A local reviewer code is not authentication or a counselor credential. A completed packet records bounded ratings, correction burden, structured correction flags, and dissent while keeping authorship concealed. It does not verify an external run or reviewer identity, establish accuracy, reliability, safety, usefulness, clinical validity, rank or select an engine, authorize model modification, change care, start a pilot, release production, or permit patient use.";

export const CANDIDATE_BLIND_REVIEW_MEASURES = Object.freeze([
  Object.freeze({ id: "evidence-fidelity", key: "evidenceFidelity", index: "01", label: "Evidence fidelity", description: "Material statements remain traceable to the scored source." , mode: "direct-rating"}),
  Object.freeze({ id: "critical-safety-handling", key: "criticalSafetyHandling", index: "02", label: "Critical safety", description: "Required direct-review routing is visible and not interpreted away.", mode: "direct-rating" }),
  Object.freeze({ id: "clinical-restraint", key: "clinicalRestraint", index: "03", label: "Clinical restraint", description: "Language preserves uncertainty and avoids diagnosis or prescription.", mode: "direct-rating" }),
  Object.freeze({ id: "conversation-usefulness", key: "conversationUsefulness", index: "04", label: "Conversation usefulness", description: "The summary helps the counselor decide what to clarify next.", mode: "direct-rating" }),
  Object.freeze({ id: "correction-burden", key: "correctionBurden", index: "05", label: "Correction burden", description: "The material work required before the summary could be useful.", mode: "direct-ordinal" }),
  Object.freeze({ id: "reviewer-agreement", key: "reviewerAgreement", index: "06", label: "Reviewer agreement", description: "Calculated only across independent packets; never self-rated.", mode: "derived-across-reviewers" })
]);

export const CANDIDATE_REVIEW_CORRECTION_FLAGS = Object.freeze([
  "factual-mismatch",
  "unsupported-overreach",
  "material-omission",
  "tone-or-clarity",
  "safety-routing",
  "workflow-usefulness"
]);

export const CANDIDATE_REVIEW_DISSENT_FLAGS = Object.freeze([
  "rubric-interpretation",
  "source-evidence",
  "safety-judgment",
  "clinical-utility"
]);

export const CANDIDATE_REVIEW_CORRECTION_BURDENS = Object.freeze(["none", "minor", "material", "unsafe"]);
export const CANDIDATE_REVIEW_USE_DISPOSITIONS = Object.freeze(["usable-as-is", "usable-after-revision", "not-usable", "uncertain"]);

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const ASSIGNMENT_ID = /^FF-CANDIDATE-REVIEW-[A-F0-9-]{20,80}$/;
const SYNTHETIC_CASE_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const POSITIONS = Object.freeze(["A", "B", "C", "D"]);
const ARMS = Object.freeze(["candidate-01", "candidate-02", "candidate-03", "counselor-reference"]);

const FALSE_CLAIMS = Object.freeze([
  "reviewerIdentityVerified",
  "counselorQualificationVerified",
  "candidateRunExternallyVerified",
  "providerVerified",
  "trialExecutionAuthorized",
  "accuracyEstablished",
  "reliabilityEstablished",
  "safetyEstablished",
  "usefulnessEstablished",
  "clinicalValidation",
  "engineRanked",
  "engineSelected",
  "modelModificationAuthorized",
  "carePlanChanged",
  "pilotAuthorized",
  "productionReleaseAuthorized",
  "patientUseAuthorized"
]);

const CONTENT_BOUNDARY = Object.freeze({
  syntheticScoredSourceIncluded: true,
  anonymousSummaryContentIncluded: true,
  candidateIdentityIncluded: false,
  providerIdentityIncluded: false,
  modelIdentityIncluded: false,
  counselorIdentityIncluded: false,
  reviewerIdentityIncluded: false,
  rawResponsesIncluded: false,
  findingsContentIncluded: false,
  fileBytesIncluded: false,
  patientIdentifiersIncluded: false,
  credentialsIncluded: false,
  phiIncluded: false
});

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function candidateBlindReviewDigest(value) {
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

function falseBook() {
  return Object.fromEntries(FALSE_CLAIMS.map(key => [key, false]));
}

function uniqueKnownList(value, allowed, label, errors, maximum = allowed.length) {
  if (!Array.isArray(value) || value.length > maximum || value.some(item => !allowed.includes(item)) || new Set(value).size !== value.length) {
    errors.push(`${label} must contain only unique values from the fixed taxonomy.`);
    return false;
  }
  return true;
}

function readinessGates({ candidateReturns, referenceDecision, referenceAssets, clinicalStandard, studyActive }) {
  const acceptedReferenceCount = Number(referenceDecision?.counts?.acceptedReferences || 0);
  const resolvedReferenceCount = Object.values(referenceAssets || {}).filter(item => item?.summary && HEX.test(String(item?.artifactHash || ""))).length;
  return [
    {
      id: "candidate-returns",
      index: "01",
      label: "Nine current returns",
      satisfied: candidateReturns?.returnSetStructurallyComplete === true && Number(candidateReturns?.counts?.currentReturnsReceived || 0) === 9,
      detail: `${Number(candidateReturns?.counts?.currentReturnsReceived || 0)} of 9 structured synthetic candidate returns are current.`
    },
    {
      id: "accepted-reference-set",
      index: "02",
      label: "Accepted reference set",
      satisfied: referenceDecision?.referenceSetAccepted === true && acceptedReferenceCount === 3,
      detail: `${acceptedReferenceCount} of 3 counselor references are externally accepted in the current decision docket.`
    },
    {
      id: "reference-protocol-freeze",
      index: "03",
      label: "Reference protocol freeze",
      satisfied: referenceDecision?.protocolFrozen === true && referenceDecision?.independentReviewHandoffReady === true,
      detail: referenceDecision?.protocolFrozen === true ? "The exact reference protocol is frozen for independent review." : "The four-duty reference decision is not complete." 
    },
    {
      id: "reference-content-resolution",
      index: "04",
      label: "Reference content resolved",
      satisfied: resolvedReferenceCount === 3,
      detail: `${resolvedReferenceCount} of 3 accepted reference hashes resolve to immutable source-only content.`
    },
    {
      id: "pre-outcome-standard",
      index: "05",
      label: "Pre-outcome standard",
      satisfied: clinicalStandard?.latestDraft?.preOutcomeCandidate === true,
      detail: clinicalStandard?.latestDraft?.preOutcomeCandidate === true ? `Working draft v${clinicalStandard.latestDraft.version} was recorded before outcomes.` : "A pre-outcome clinical-standard draft is required."
    },
    {
      id: "study-control",
      index: "06",
      label: "Local study control",
      satisfied: studyActive === true,
      detail: studyActive === true ? "No open stopping event blocks local rehearsal." : "An open stopping event pauses assignment and submission."
    }
  ];
}

export function validateCandidateBlindReviewContract() {
  const errors = [];
  if (CANDIDATE_BLIND_REVIEW_MEASURES.length !== 6 || CANDIDATE_BLIND_REVIEW_MEASURES.filter(item => item.mode.startsWith("direct")).length !== 5) errors.push("Candidate blind review must preserve five direct measures and one derived agreement measure.");
  if (CANDIDATE_REVIEW_CORRECTION_FLAGS.length !== 6 || CANDIDATE_REVIEW_DISSENT_FLAGS.length !== 4) errors.push("Candidate blind-review correction or dissent taxonomy is incomplete.");
  if (!/four anonymous summaries labeled A through D/i.test(CANDIDATE_BLIND_REVIEW_BOUNDARY) || !/never reveals candidate, provider, model, prompt, or counselor authorship/i.test(CANDIDATE_BLIND_REVIEW_BOUNDARY)) errors.push("Candidate blind-review concealment boundary is incomplete.");
  if (!/does not verify an external run or reviewer identity/i.test(CANDIDATE_BLIND_REVIEW_BOUNDARY) || !/rank or select an engine/i.test(CANDIDATE_BLIND_REVIEW_BOUNDARY)) errors.push("Candidate blind-review authority boundary is incomplete.");
  return errors;
}

export function buildCandidateBlindReviewDesk({
  candidateTrial,
  candidateReturns,
  referenceDecision,
  referenceAssets = {},
  clinicalStandard,
  events = [],
  pendingAssignments = {},
  actor = "Demo reviewer",
  studyActive = true,
  chain = { valid: true, count: 0, failedAt: null, head: null, outcomes: 0 },
  generatedAt = new Date().toISOString()
} = {}) {
  const gates = readinessGates({ candidateReturns, referenceDecision, referenceAssets, clinicalStandard, studyActive });
  const locallyReady = gates.every(gate => gate.satisfied);
  const reviewerCodeHash = ACTOR.test(actor) ? candidateBlindReviewDigest(actor) : null;
  const currentAssignment = Object.values(pendingAssignments || {}).find(item => item?.actor === actor && Date.parse(item.expiresAt) >= Date.parse(generatedAt)) || null;
  const caseReviewers = new Map();
  for (const event of events) {
    if (!caseReviewers.has(event.caseId)) caseReviewers.set(event.caseId, new Set());
    caseReviewers.get(event.caseId).add(event.reviewerCodeHash);
  }
  const directRatings = events.length * 4 * 5;
  const corrections = events.flatMap(event => event.cells || []).filter(cell => cell.correctionBurden !== "none").length;
  const materialCorrections = events.flatMap(event => event.cells || []).filter(cell => ["material", "unsafe"].includes(cell.correctionBurden)).length;
  const dissentFlags = events.flatMap(event => event.cells || []).reduce((sum, cell) => sum + (cell.dissentFlags?.length || 0), 0);
  const completedForActor = new Set(events.filter(event => event.reviewerCodeHash === reviewerCodeHash).map(event => event.caseId)).size;
  const status = locallyReady ? "local-rehearsal-intake-ready" : "blocked-awaiting-governed-evidence";
  const core = {
    contractVersion: CANDIDATE_BLIND_REVIEW_CONTRACT,
    protocol: CANDIDATE_BLIND_REVIEW_PROTOCOL,
    status,
    headline: "Four unlabeled voices. One disciplined read.",
    descriptor: "The scored source stays visible. Authorship stays closed. Corrections and dissent stay intact.",
    counts: {
      readinessGatesSatisfied: gates.filter(gate => gate.satisfied).length,
      readinessGatesRequired: gates.length,
      casesPlanned: Number(candidateTrial?.counts?.syntheticCases || 3),
      blindCellsPlanned: Number(candidateTrial?.counts?.blindCellsPlanned || 12),
      packetsCompleted: events.length,
      blindCellsCompleted: events.length * 4,
      reviewerCodesObserved: new Set(events.map(event => event.reviewerCodeHash)).size,
      casesWithIndependentOverlap: [...caseReviewers.values()].filter(reviewers => reviewers.size >= 2).length,
      directRatingsRecorded: directRatings,
      correctionFlagsRecorded: events.flatMap(event => event.cells || []).reduce((sum, cell) => sum + (cell.correctionFlags?.length || 0), 0),
      correctionsObserved: corrections,
      materialOrUnsafeCorrections: materialCorrections,
      dissentFlagsRecorded: dissentFlags,
      engineRankingsPublished: 0
    },
    gates,
    measures: clone(CANDIDATE_BLIND_REVIEW_MEASURES),
    correctionTaxonomy: clone(CANDIDATE_REVIEW_CORRECTION_FLAGS),
    dissentTaxonomy: clone(CANDIDATE_REVIEW_DISSENT_FLAGS),
    reviewerProgress: { completed: completedForActor, available: Number(candidateTrial?.counts?.syntheticCases || 3) },
    currentAssignment: currentAssignment ? {
      assignmentId: currentAssignment.assignmentId,
      caseId: currentAssignment.caseId,
      packetFingerprint: currentAssignment.packetFingerprint,
      createdAt: currentAssignment.createdAt,
      expiresAt: currentAssignment.expiresAt
    } : null,
    locallyReady,
    packetIssuanceEnabled: locallyReady,
    anonymousContentVisibleOnlyDuringAssignment: true,
    candidateIdentityVisibleToReviewer: false,
    authorMappingRevealedAfterSubmission: false,
    reviewerAgreementDerivedOnly: true,
    ...falseBook(),
    history: events.slice().reverse().map(event => ({
      sequence: event.sequence,
      assignmentId: event.assignmentId,
      caseId: event.caseId,
      reviewerCodeHash: event.reviewerCodeHash,
      status: event.status,
      correctionCells: event.cells.filter(cell => cell.correctionBurden !== "none").length,
      dissentFlags: event.cells.reduce((sum, cell) => sum + cell.dissentFlags.length, 0),
      createdAt: event.createdAt,
      hash: event.hash
    })),
    chain: clone(chain),
    protocolFingerprint: candidateTrial?.protocolFingerprint || null,
    boundary: CANDIDATE_BLIND_REVIEW_BOUNDARY
  };
  return { ...core, deskFingerprint: candidateBlindReviewDigest(core), generatedAt };
}

function validateAssignmentEvidence(evidence, errors) {
  const keys = ["candidateReturnChainHead", "referenceDecisionChainHead", "clinicalStandardHash", "candidateTrialProtocolFingerprint"];
  if (!exactKeys(evidence, keys, "assignment evidence", errors)) return;
  for (const key of keys) if (!HEX.test(String(evidence[key] || ""))) errors.push(`assignment evidence ${key} is invalid.`);
}

export function createCandidateBlindReviewAssignment({
  candidateTrial,
  caseId,
  sourceProfile,
  artifactsByArm,
  evidence,
  actor,
  reviewerProgress,
  createdAt = new Date().toISOString(),
  assignmentId = `FF-CANDIDATE-REVIEW-${randomUUID().toUpperCase()}`
} = {}) {
  if (!ACTOR.test(String(actor || ""))) throw new Error("Candidate blind-review actor is invalid.");
  if (!SYNTHETIC_CASE_ID.test(String(caseId || "")) || sourceProfile?.assessmentId !== caseId) throw new Error("Candidate blind-review synthetic case is invalid.");
  const cells = (candidateTrial?.blindCells || []).filter(cell => cell.caseId === caseId).sort((left, right) => POSITIONS.indexOf(left.blindPosition) - POSITIONS.indexOf(right.blindPosition));
  if (cells.length !== 4 || cells.some((cell, index) => cell.blindPosition !== POSITIONS[index]) || new Set(cells.map(cell => cell.armId)).size !== 4) throw new Error("Candidate blind-review plan does not contain one exact A–D rotation for the case.");
  const caseRun = (candidateTrial?.runEnvelopes || []).find(run => run.caseId === caseId);
  if (!caseRun?.caseFingerprint || !HEX.test(caseRun.caseFingerprint)) throw new Error("Candidate blind-review case fingerprint is unavailable.");
  const authorMapping = {};
  const packetCells = cells.map(cell => {
    const artifact = artifactsByArm?.[cell.armId];
    if (!artifact?.summary || !HEX.test(String(artifact?.artifactHash || ""))) throw new Error(`Candidate blind-review artifact ${cell.armId} is unavailable.`);
    authorMapping[cell.blindPosition] = cell.armId;
    return {
      blindPosition: cell.blindPosition,
      artifactHash: artifact.artifactHash,
      summary: String(artifact.summary),
      wordCount: String(artifact.summary).trim().split(/\s+/).filter(Boolean).length
    };
  });
  const mappingHash = candidateBlindReviewDigest(authorMapping);
  const expiresAt = new Date(Date.parse(createdAt) + CANDIDATE_BLIND_REVIEW_ASSIGNMENT_HOURS * 60 * 60 * 1000).toISOString();
  const assignmentCore = {
    contractVersion: CANDIDATE_BLIND_REVIEW_CONTRACT,
    protocol: CANDIDATE_BLIND_REVIEW_PROTOCOL,
    assignmentId,
    caseId,
    caseFingerprint: caseRun.caseFingerprint,
    protocolFingerprint: candidateTrial.protocolFingerprint,
    sourceProfile: clone(sourceProfile),
    sourceProfileHash: candidateBlindReviewDigest(sourceProfile),
    cells: packetCells,
    authorMappingHash: mappingHash,
    evidence: clone(evidence),
    reviewerProgress: clone(reviewerProgress),
    createdAt,
    expiresAt,
    contentBoundary: clone(CONTENT_BOUNDARY),
    boundary: CANDIDATE_BLIND_REVIEW_BOUNDARY
  };
  const errors = [];
  validateAssignmentEvidence(evidence, errors);
  if (errors.length) throw new Error(errors.join(" "));
  const packetFingerprint = candidateBlindReviewDigest(assignmentCore);
  return {
    pending: { ...assignmentCore, packetFingerprint, authorMapping, actor },
    packet: { ...assignmentCore, packetFingerprint }
  };
}

export function publicCandidateBlindReviewAssignment(pending) {
  if (!pending) return null;
  const { authorMapping, actor, ...packet } = pending;
  return clone(packet);
}

export function validateCandidateBlindReviewSubmission(input, pending, actor, submittedAt = new Date().toISOString()) {
  const errors = [];
  const rootKeys = ["assignmentId", "packetFingerprint", "cells"];
  if (!exactKeys(input, rootKeys, "Candidate blind-review submission", errors)) return errors;
  if (!pending || input.assignmentId !== pending.assignmentId || input.packetFingerprint !== pending.packetFingerprint) errors.push("Candidate blind-review submission does not match the active packet.");
  if (pending?.actor !== actor) errors.push("Candidate blind-review packet belongs to a different reviewer code.");
  if (!Number.isFinite(Date.parse(submittedAt)) || !Number.isFinite(Date.parse(pending?.expiresAt)) || Date.parse(submittedAt) > Date.parse(pending?.expiresAt)) errors.push("Candidate blind-review packet has expired.");
  if (!Array.isArray(input.cells) || input.cells.length !== 4) {
    errors.push("Candidate blind-review submission must rate exactly four blind cells.");
    return [...new Set(errors)];
  }
  const seen = new Set();
  for (const [index, cell] of input.cells.entries()) {
    const label = `cells[${index}]`;
    const keys = ["blindPosition", "ratings", "correctionBurden", "correctionFlags", "dissentFlags", "useDisposition"];
    if (!exactKeys(cell, keys, label, errors)) continue;
    if (!POSITIONS.includes(cell.blindPosition) || seen.has(cell.blindPosition)) errors.push(`${label}.blindPosition is invalid or repeated.`);
    seen.add(cell.blindPosition);
    const expectedCell = pending?.cells?.find(item => item.blindPosition === cell.blindPosition);
    if (!expectedCell) errors.push(`${label} does not belong to the active packet.`);
    const ratingKeys = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
    if (exactKeys(cell.ratings, ratingKeys, `${label}.ratings`, errors)) {
      for (const key of ratingKeys) if (!Number.isInteger(cell.ratings[key]) || cell.ratings[key] < 1 || cell.ratings[key] > 5) errors.push(`${label}.ratings.${key} must be an integer from 1 through 5.`);
    }
    if (!CANDIDATE_REVIEW_CORRECTION_BURDENS.includes(cell.correctionBurden)) errors.push(`${label}.correctionBurden is invalid.`);
    const validCorrections = uniqueKnownList(cell.correctionFlags, CANDIDATE_REVIEW_CORRECTION_FLAGS, `${label}.correctionFlags`, errors);
    uniqueKnownList(cell.dissentFlags, CANDIDATE_REVIEW_DISSENT_FLAGS, `${label}.dissentFlags`, errors);
    if (validCorrections && cell.correctionBurden === "none" && cell.correctionFlags.length) errors.push(`${label}.correctionFlags must be empty when correction burden is none.`);
    if (validCorrections && cell.correctionBurden !== "none" && !cell.correctionFlags.length) errors.push(`${label}.correctionFlags must identify at least one structured correction when burden is not none.`);
    if (!CANDIDATE_REVIEW_USE_DISPOSITIONS.includes(cell.useDisposition)) errors.push(`${label}.useDisposition is invalid.`);
  }
  if (seen.size !== 4 || POSITIONS.some(position => !seen.has(position))) errors.push("Candidate blind-review submission must cover A through D exactly once.");
  return [...new Set(errors)];
}

export function createCandidateBlindReviewEvent({ input, pending, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const errors = validateCandidateBlindReviewSubmission(input, pending, actor, createdAt);
  if (errors.length) throw new Error(errors.join(" "));
  const cells = POSITIONS.map(position => {
    const submitted = input.cells.find(item => item.blindPosition === position);
    const assigned = pending.cells.find(item => item.blindPosition === position);
    return {
      blindPosition: position,
      artifactHash: assigned.artifactHash,
      ratings: clone(submitted.ratings),
      correctionBurden: submitted.correctionBurden,
      correctionFlags: [...submitted.correctionFlags],
      dissentFlags: [...submitted.dissentFlags],
      useDisposition: submitted.useDisposition
    };
  });
  const durationSeconds = Math.max(0, Math.floor((Date.parse(createdAt) - Date.parse(pending.createdAt)) / 1000));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CANDIDATE_BLIND_REVIEW_CONTRACT,
    type: "candidate-blind-review-outcome-recorded",
    status: "anonymous-review-held-unverified",
    assignmentId: pending.assignmentId,
    packetFingerprint: pending.packetFingerprint,
    caseId: pending.caseId,
    caseFingerprint: pending.caseFingerprint,
    protocolFingerprint: pending.protocolFingerprint,
    reviewProtocol: CANDIDATE_BLIND_REVIEW_PROTOCOL,
    reviewerCodeHash: candidateBlindReviewDigest(actor),
    sourceProfileHash: pending.sourceProfileHash,
    cells,
    authorMapping: clone(pending.authorMapping),
    authorMappingHash: pending.authorMappingHash,
    evidence: clone(pending.evidence),
    measureProtocol: { predeclaredMeasures: 6, directlyRecordedMeasures: 5, reviewerAgreementDerivedAcrossIndependentPackets: true },
    reviewTiming: { assignedAt: pending.createdAt, submittedAt: createdAt, durationSeconds, protocolEligible: durationSeconds <= CANDIDATE_BLIND_REVIEW_ASSIGNMENT_HOURS * 60 * 60 },
    contentBoundary: clone(CONTENT_BOUNDARY),
    candidateIdentityVisibleDuringReview: false,
    authorMappingRevealedAfterSubmission: false,
    ...falseBook(),
    actor,
    createdAt,
    note: "One four-arm anonymous synthetic candidate-review packet was completed against the visible scored source. Structured ratings, correction burden, correction flags, and dissent entered the immutable outcome ledger; authorship remained concealed and no provider, reviewer, performance, ranking, selection, modification, clinical, pilot, production, or patient-use claim was created."
  };
  return { ...core, hash: candidateBlindReviewDigest(core) };
}

function validateContentBoundary(boundary, errors) {
  const keys = Object.keys(CONTENT_BOUNDARY);
  if (!exactKeys(boundary, keys, "contentBoundary", errors)) return;
  for (const key of keys) if (boundary[key] !== CONTENT_BOUNDARY[key]) errors.push(`contentBoundary.${key} is invalid.`);
}

export function validateCandidateBlindReviewEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, knownArtifactHashes = null } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Candidate blind-review event is required."];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "status", "assignmentId", "packetFingerprint", "caseId", "caseFingerprint", "protocolFingerprint", "reviewProtocol", "reviewerCodeHash", "sourceProfileHash", "cells", "authorMapping", "authorMappingHash", "evidence", "measureProtocol", "reviewTiming", "contentBoundary", "candidateIdentityVisibleDuringReview", "authorMappingRevealedAfterSubmission", ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Candidate blind-review event", errors)) return errors;
  if (event.contractVersion !== CANDIDATE_BLIND_REVIEW_CONTRACT || event.type !== "candidate-blind-review-outcome-recorded" || event.status !== "anonymous-review-held-unverified" || event.reviewProtocol !== CANDIDATE_BLIND_REVIEW_PROTOCOL) errors.push("Candidate blind-review event identity is invalid.");
  if (!Number.isInteger(event.sequence) || event.sequence < 1 || event.sequence !== sequence || event.previousHash !== previousHash || !CHAIN_HEAD.test(String(event.previousHash || ""))) errors.push("Candidate blind-review chain position is invalid.");
  if (!ASSIGNMENT_ID.test(String(event.assignmentId || "")) || !SYNTHETIC_CASE_ID.test(String(event.caseId || ""))) errors.push("Candidate blind-review assignment or case identity is invalid.");
  for (const key of ["packetFingerprint", "caseFingerprint", "protocolFingerprint", "reviewerCodeHash", "sourceProfileHash", "authorMappingHash", "hash"]) if (!HEX.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  validateAssignmentEvidence(event.evidence, errors);
  if (!Array.isArray(event.cells) || event.cells.length !== 4) errors.push("Candidate blind-review event must contain four cells.");
  const seenPositions = new Set();
  for (const [index, cell] of (event.cells || []).entries()) {
    const label = `cells[${index}]`;
    const cellKeys = ["blindPosition", "artifactHash", "ratings", "correctionBurden", "correctionFlags", "dissentFlags", "useDisposition"];
    if (!exactKeys(cell, cellKeys, label, errors)) continue;
    if (!POSITIONS.includes(cell.blindPosition) || seenPositions.has(cell.blindPosition)) errors.push(`${label}.blindPosition is invalid or repeated.`);
    seenPositions.add(cell.blindPosition);
    if (!HEX.test(String(cell.artifactHash || ""))) errors.push(`${label}.artifactHash is invalid.`);
    if (knownArtifactHashes && !knownArtifactHashes.has(cell.artifactHash)) errors.push(`${label}.artifactHash does not resolve to immutable candidate-return or counselor-reference evidence.`);
    const ratingKeys = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
    if (exactKeys(cell.ratings, ratingKeys, `${label}.ratings`, errors)) for (const key of ratingKeys) if (!Number.isInteger(cell.ratings[key]) || cell.ratings[key] < 1 || cell.ratings[key] > 5) errors.push(`${label}.ratings.${key} is invalid.`);
    if (!CANDIDATE_REVIEW_CORRECTION_BURDENS.includes(cell.correctionBurden)) errors.push(`${label}.correctionBurden is invalid.`);
    const validCorrections = uniqueKnownList(cell.correctionFlags, CANDIDATE_REVIEW_CORRECTION_FLAGS, `${label}.correctionFlags`, errors);
    uniqueKnownList(cell.dissentFlags, CANDIDATE_REVIEW_DISSENT_FLAGS, `${label}.dissentFlags`, errors);
    if (validCorrections && ((cell.correctionBurden === "none") !== (cell.correctionFlags.length === 0))) errors.push(`${label} correction burden and flags are inconsistent.`);
    if (!CANDIDATE_REVIEW_USE_DISPOSITIONS.includes(cell.useDisposition)) errors.push(`${label}.useDisposition is invalid.`);
  }
  if (seenPositions.size !== 4) errors.push("Candidate blind-review event must cover A through D exactly once.");
  if (!exactKeys(event.authorMapping, POSITIONS, "authorMapping", errors)) {
    // Exact-key diagnostics already recorded.
  } else if (POSITIONS.some(position => !ARMS.includes(event.authorMapping[position])) || new Set(Object.values(event.authorMapping)).size !== 4) errors.push("Candidate blind-review author mapping must bind the four unique trial arms.");
  if (candidateBlindReviewDigest(event.authorMapping) !== event.authorMappingHash) errors.push("Candidate blind-review author mapping hash is invalid.");
  if (!exactKeys(event.measureProtocol, ["predeclaredMeasures", "directlyRecordedMeasures", "reviewerAgreementDerivedAcrossIndependentPackets"], "measureProtocol", errors) || event.measureProtocol?.predeclaredMeasures !== 6 || event.measureProtocol?.directlyRecordedMeasures !== 5 || event.measureProtocol?.reviewerAgreementDerivedAcrossIndependentPackets !== true) errors.push("Candidate blind-review measure protocol is invalid.");
  if (exactKeys(event.reviewTiming, ["assignedAt", "submittedAt", "durationSeconds", "protocolEligible"], "reviewTiming", errors)) {
    const duration = Math.floor((Date.parse(event.reviewTiming.submittedAt) - Date.parse(event.reviewTiming.assignedAt)) / 1000);
    if (!Number.isFinite(duration) || duration < 0 || event.reviewTiming.durationSeconds !== duration || event.reviewTiming.protocolEligible !== (duration <= CANDIDATE_BLIND_REVIEW_ASSIGNMENT_HOURS * 60 * 60)) errors.push("Candidate blind-review timing provenance is invalid.");
  }
  validateContentBoundary(event.contentBoundary, errors);
  if (event.candidateIdentityVisibleDuringReview !== false || event.authorMappingRevealedAfterSubmission !== false) errors.push("Candidate blind-review concealment claims are invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(event.actor || "")) || candidateBlindReviewDigest(event.actor) !== event.reviewerCodeHash || !Number.isFinite(Date.parse(event.createdAt)) || event.createdAt !== event.reviewTiming?.submittedAt || String(event.note || "").length < 300) errors.push("Candidate blind-review actor, timestamp, or note is invalid.");
  const { hash, ...core } = event;
  if (candidateBlindReviewDigest(core) !== hash) errors.push("Candidate blind-review event hash is invalid.");
  return [...new Set(errors)];
}

export function candidateBlindReviewReceipt(event) {
  return {
    sequence: event.sequence,
    assignmentId: event.assignmentId,
    caseId: event.caseId,
    packetFingerprint: event.packetFingerprint,
    status: event.status,
    blindCellsRecorded: event.cells.length,
    candidateIdentityRevealed: false,
    authorMappingRevealed: false,
    createdAt: event.createdAt,
    hash: event.hash
  };
}
