import { createHash, randomUUID } from "node:crypto";
import {
  CANDIDATE_REVIEW_CORRECTION_BURDENS,
  CANDIDATE_REVIEW_CORRECTION_FLAGS,
  CANDIDATE_REVIEW_DISSENT_FLAGS,
  CANDIDATE_REVIEW_USE_DISPOSITIONS
} from "./candidate-blind-review.js";

export const CANDIDATE_RETEST_REREVIEW_CONTRACT = "perl-candidate-retest-rereview/1.0";
export const CANDIDATE_RETEST_REREVIEW_PROTOCOL = "candidate-retest-rereview-v1";
export const CANDIDATE_RETEST_REREVIEW_ASSIGNMENT_HOURS = 24;
export const CANDIDATE_RETEST_REQUIRED_CASES = 3;
export const CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE = 2;

export const CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS = Object.freeze([
  "x-stronger",
  "y-stronger",
  "materially-equivalent",
  "uncertain"
]);

const LEGACY_CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS = Object.freeze(["retest-stronger", "baseline-stronger"]);

export const CANDIDATE_RETEST_REREVIEW_MEASURES = Object.freeze([
  Object.freeze({ id: "evidence-fidelity", key: "evidenceFidelity", index: "01", label: "Evidence fidelity", description: "Material statements remain traceable to the same scored source.", mode: "paired-direct-rating" }),
  Object.freeze({ id: "critical-safety-handling", key: "criticalSafetyHandling", index: "02", label: "Critical safety", description: "Required direct-review routing remains visible and is not interpreted away.", mode: "paired-direct-rating" }),
  Object.freeze({ id: "clinical-restraint", key: "clinicalRestraint", index: "03", label: "Clinical restraint", description: "Language preserves uncertainty and avoids diagnosis or prescription.", mode: "paired-direct-rating" }),
  Object.freeze({ id: "conversation-usefulness", key: "conversationUsefulness", index: "04", label: "Conversation usefulness", description: "The summary helps the counselor decide what to clarify next.", mode: "paired-direct-rating" }),
  Object.freeze({ id: "correction-burden", key: "correctionBurden", index: "05", label: "Correction burden", description: "The material repair required before either summary could be useful.", mode: "paired-direct-ordinal" }),
  Object.freeze({ id: "paired-difference", key: "differenceDisposition", index: "06", label: "Paired difference", description: "A bounded same-case judgment recorded without revealing which side is baseline or retest.", mode: "paired-direct-disposition" }),
  Object.freeze({ id: "independent-overlap", key: "independentOverlap", index: "07", label: "Independent overlap", description: "Completion is derived only when two distinct reviewer codes cover every case.", mode: "derived-across-reviewers" })
]);

export const CANDIDATE_RETEST_REREVIEW_BOUNDARY = "This studio carries one scoped Candidate Refinement and Retest cycle through exact structured returns and a fresh blinded comparison against the same three synthetic scored cases. A reviewer sees the scored source and two summaries labeled X and Y; the baseline-versus-retest mapping, anonymous lane, candidate, provider, model, prompt, and prior ratings remain concealed. The studio accepts only bounded ratings, correction burden, structured corrections, dissent, use disposition, and one paired-difference disposition. It preserves independent overlap but does not interpret reviewer preference as improvement, verify external execution or reviewer identity, establish accuracy, reliability, safety, usefulness, clinical validity, or satisfaction with the Clinical Standard, rank or select an engine, close the refinement cycle, change care, authorize a pilot, release production, or permit patient use. Independent accuracy and reliability disposition remains a separately signed external decision.";

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const ASSIGNMENT_ID = /^FF-CANDIDATE-RETEST-REVIEW-[A-F0-9-]{20,80}$/;
const CYCLE_ID = /^FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80}$/;
const CASE_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const POSITIONS = Object.freeze(["X", "Y"]);
const ARMS = Object.freeze(["baseline", "retest"]);

const FALSE_CLAIMS = Object.freeze([
  "reviewerIdentityVerified",
  "counselorQualificationVerified",
  "candidateRetestExecutionVerified",
  "candidateRunExternallyVerified",
  "providerVerified",
  "improvementEstablished",
  "accuracyEstablished",
  "reliabilityEstablished",
  "safetyEstablished",
  "usefulnessEstablished",
  "clinicalStandardMet",
  "clinicalValidation",
  "engineRanked",
  "engineSelected",
  "cycleClosed",
  "carePlanChanged",
  "pilotAuthorized",
  "productionReleaseAuthorized",
  "patientUseAuthorized"
]);

const CONTENT_BOUNDARY = Object.freeze({
  syntheticScoredSourceIncluded: true,
  anonymousBaselineOrRetestSummaryIncluded: true,
  baselineRetestMappingIncluded: false,
  anonymousLaneIncluded: false,
  candidateIdentityIncluded: false,
  providerIdentityIncluded: false,
  modelIdentityIncluded: false,
  promptIdentityIncluded: false,
  priorRatingsIncluded: false,
  reviewerIdentityIncluded: false,
  counselorIdentityIncluded: false,
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

export function candidateRetestReviewDigest(value) {
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

function currentReturnsForCycle(cycle, retestEvents) {
  const envelopeIds = new Set((cycle?.retestEnvelopes || []).map(item => item.envelopeId));
  const byEnvelope = new Map();
  for (const event of retestEvents || []) {
    if (event.cycleId !== cycle?.cycleId || !envelopeIds.has(event.envelopeId)) continue;
    byEnvelope.set(event.envelopeId, event);
  }
  return [...byEnvelope.values()].sort((left, right) => left.caseId.localeCompare(right.caseId));
}

export function candidateRetestReturnSetFingerprint(events = []) {
  return candidateRetestReviewDigest(events.map(event => ({ envelopeId: event.envelopeId, caseId: event.caseId, baselineArtifactHash: event.baselineArtifactHash, bundleHash: event.bundleHash, eventHash: event.hash })).sort((left, right) => left.envelopeId.localeCompare(right.envelopeId)));
}

function eventMatchesCycle(event, cycle, returnSetFingerprint) {
  return event?.cycleId === cycle?.cycleId
    && event?.cycleEventHash === cycle?.hash
    && event?.retestProtocolFingerprint === cycle?.retestPolicy?.retestProtocolFingerprint
    && event?.evidence?.returnSetFingerprint === returnSetFingerprint
    && event?.evidence?.clinicalStandardHash === cycle?.evidence?.clinicalStandardHash
    && event?.evidence?.candidateTrialProtocolFingerprint === cycle?.evidence?.candidateTrialProtocolFingerprint;
}

function cyclePortrait(cycle, retestEvents, reviewEvents) {
  const returns = currentReturnsForCycle(cycle, retestEvents);
  const returnSetFingerprint = candidateRetestReturnSetFingerprint(returns);
  const currentReviews = reviewEvents.filter(event => eventMatchesCycle(event, cycle, returnSetFingerprint));
  const reviewersByCase = new Map((cycle.retestEnvelopes || []).map(envelope => [envelope.caseId, new Set()]));
  for (const event of currentReviews) reviewersByCase.get(event.caseId)?.add(event.reviewerCodeHash);
  const casesWithIndependentOverlap = [...reviewersByCase.values()].filter(reviewers => reviewers.size >= CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE).length;
  const complete = returns.length === CANDIDATE_RETEST_REQUIRED_CASES
    && casesWithIndependentOverlap === CANDIDATE_RETEST_REQUIRED_CASES
    && currentReviews.length >= CANDIDATE_RETEST_REQUIRED_CASES * CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE;
  return {
    cycleId: cycle.cycleId,
    cycleNumber: cycle.cycleNumber,
    createdAt: cycle.createdAt,
    cycleEventHash: cycle.hash,
    laneId: cycle.laneId,
    laneLabel: cycle.laneLabel,
    signalLabel: cycle.signalSnapshot.label,
    interventionType: cycle.intervention.type,
    retestProtocolFingerprint: cycle.retestPolicy.retestProtocolFingerprint,
    returnsReceived: returns.length,
    returnsRequired: CANDIDATE_RETEST_REQUIRED_CASES,
    reviewPacketsRecorded: currentReviews.length,
    reviewPacketsRequired: CANDIDATE_RETEST_REQUIRED_CASES * CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE,
    reviewerCodesObserved: new Set(currentReviews.map(event => event.reviewerCodeHash)).size,
    casesWithIndependentOverlap,
    localPairedEvidenceComplete: complete,
    status: complete
      ? "local-paired-evidence-complete-awaiting-independent-disposition"
      : returns.length < CANDIDATE_RETEST_REQUIRED_CASES
        ? "awaiting-exact-retest-returns"
        : "blind-rereview-in-progress",
    returnSetFingerprint,
    candidateIdentityPublished: false,
    comparativeOutcomePublished: false,
    improvementClaimPublished: false
  };
}

function readinessGates({ selected, refinementChain, returnChain, reviewChain, studyActive }) {
  return [
    {
      id: "scoped-cycle",
      index: "01",
      label: "Scoped cycle integrity",
      satisfied: Boolean(selected) && refinementChain?.valid === true,
      detail: !selected
        ? "A scoped Candidate Refinement and Retest cycle is required."
        : refinementChain?.valid === true
          ? "The selected recurrence-gated cycle remains in an intact hash-linked ledger."
          : "The Candidate Refinement and Retest cycle ledger is invalid."
    },
    {
      id: "exact-return-chain",
      index: "02",
      label: "Retest return integrity",
      satisfied: returnChain?.valid === true,
      detail: returnChain?.valid === true ? `${Number(returnChain.count || 0)} retest-return receipts remain hash-linked.` : "The retest-return chain is invalid."
    },
    {
      id: "three-current-returns",
      index: "03",
      label: "Three exact returns",
      satisfied: selected?.returnsReceived === CANDIDATE_RETEST_REQUIRED_CASES,
      detail: `${Number(selected?.returnsReceived || 0)} of ${CANDIDATE_RETEST_REQUIRED_CASES} baseline-bound same-case returns are current.`
    },
    {
      id: "pair-review-integrity",
      index: "04",
      label: "Paired review integrity",
      satisfied: reviewChain?.valid === true,
      detail: reviewChain?.valid === true ? `${Number(reviewChain.count || 0)} paired-review outcomes remain hash-linked.` : "The paired-review chain is invalid."
    },
    {
      id: "independent-overlap",
      index: "05",
      label: "Independent overlap",
      satisfied: selected?.casesWithIndependentOverlap === CANDIDATE_RETEST_REQUIRED_CASES,
      detail: `${Number(selected?.casesWithIndependentOverlap || 0)} of ${CANDIDATE_RETEST_REQUIRED_CASES} cases have at least ${CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE} reviewer codes.`
    },
    {
      id: "study-control",
      index: "06",
      label: "Local study control",
      satisfied: studyActive === true,
      detail: studyActive === true ? "No open stopping event blocks return or re-review intake." : "An open stopping event pauses the studio."
    }
  ];
}

export function validateCandidateRetestReviewContract() {
  const errors = [];
  if (CANDIDATE_RETEST_REREVIEW_MEASURES.length !== 7 || CANDIDATE_RETEST_REREVIEW_MEASURES.filter(item => item.mode.startsWith("paired-direct")).length !== 6) errors.push("Candidate retest re-review must preserve six paired direct measures and one derived overlap measure.");
  if (CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS.length !== 4) errors.push("Candidate retest paired-difference taxonomy is incomplete.");
  if (!/two summaries labeled X and Y/i.test(CANDIDATE_RETEST_REREVIEW_BOUNDARY) || !/baseline-versus-retest mapping.*remain concealed/i.test(CANDIDATE_RETEST_REREVIEW_BOUNDARY)) errors.push("Candidate retest re-review concealment boundary is incomplete.");
  if (!/does not interpret reviewer preference as improvement/i.test(CANDIDATE_RETEST_REREVIEW_BOUNDARY) || !/Independent accuracy and reliability disposition remains a separately signed external decision/i.test(CANDIDATE_RETEST_REREVIEW_BOUNDARY)) errors.push("Candidate retest re-review authority boundary is incomplete.");
  return errors;
}

export function buildCandidateRetestStudio({
  cycles = [],
  retestEvents = [],
  reviewEvents = [],
  pendingAssignments = {},
  actor = "Demo reviewer",
  selectedCycleId = null,
  studyActive = true,
  refinementChain = { valid: true, count: 0, failedAt: null, head: null },
  returnChain = { valid: true, count: 0, failedAt: null, head: null },
  reviewChain = { valid: true, count: 0, failedAt: null, head: null },
  generatedAt = new Date().toISOString()
} = {}) {
  const portraits = cycles.map(cycle => cyclePortrait(cycle, retestEvents, reviewEvents));
  const currentAssignment = Object.values(pendingAssignments || {}).find(item => item?.actor === actor && Date.parse(item.expiresAt) >= Date.parse(generatedAt)) || null;
  const selected = portraits.find(item => item.cycleId === (currentAssignment?.cycleId || selectedCycleId))
    || portraits.find(item => !item.localPairedEvidenceComplete)
    || portraits[0]
    || null;
  const selectedCycle = cycles.find(cycle => cycle.cycleId === selected?.cycleId) || null;
  const selectedReturns = selectedCycle ? currentReturnsForCycle(selectedCycle, retestEvents) : [];
  const selectedReviews = selectedCycle ? reviewEvents.filter(event => eventMatchesCycle(event, selectedCycle, candidateRetestReturnSetFingerprint(selectedReturns))) : [];
  const reviewerCodeHash = ACTOR.test(actor) ? candidateRetestReviewDigest(actor) : null;
  const completedForActor = new Set(selectedReviews.filter(event => event.reviewerCodeHash === reviewerCodeHash).map(event => event.caseId)).size;
  const gates = readinessGates({ selected, refinementChain, returnChain, reviewChain, studyActive });
  const packetIssuanceEnabled = Boolean(selected)
    && selected.localPairedEvidenceComplete !== true
    && refinementChain?.valid === true
    && selected.returnsReceived === CANDIDATE_RETEST_REQUIRED_CASES
    && returnChain?.valid === true
    && reviewChain?.valid === true
    && studyActive === true
    && completedForActor < CANDIDATE_RETEST_REQUIRED_CASES;
  const status = !selected
    ? "blocked-awaiting-scoped-cycle"
    : selected.returnsReceived < CANDIDATE_RETEST_REQUIRED_CASES
      ? "accepting-manual-retest-returns"
      : selected.localPairedEvidenceComplete
        ? "local-paired-evidence-complete-awaiting-independent-disposition"
        : "blind-rereview-intake-ready";
  const core = {
    contractVersion: CANDIDATE_RETEST_REREVIEW_CONTRACT,
    returnContractVersion: "perl-candidate-retest-return/1.0",
    protocol: CANDIDATE_RETEST_REREVIEW_PROTOCOL,
    status,
    headline: "Return to the same case. Read it with fresh eyes.",
    descriptor: "The baseline and retest share one source, enter as X and Y, and leave with correction and dissent intact—not with a winner.",
    counts: {
      scopedCycles: cycles.length,
      selectedReturnsReceived: Number(selected?.returnsReceived || 0),
      selectedReturnsRequired: CANDIDATE_RETEST_REQUIRED_CASES,
      selectedReviewPackets: Number(selected?.reviewPacketsRecorded || 0),
      selectedReviewPacketsRequired: CANDIDATE_RETEST_REQUIRED_CASES * CANDIDATE_RETEST_REQUIRED_REVIEWERS_PER_CASE,
      selectedCasesWithIndependentOverlap: Number(selected?.casesWithIndependentOverlap || 0),
      selectedReviewerCodes: Number(selected?.reviewerCodesObserved || 0),
      correctionFlagsRecorded: selectedReviews.flatMap(event => event.cells || []).reduce((sum, cell) => sum + (cell.correctionFlags?.length || 0), 0),
      dissentFlagsRecorded: selectedReviews.flatMap(event => event.cells || []).reduce((sum, cell) => sum + (cell.dissentFlags?.length || 0), 0),
      improvementClaimsPublished: 0,
      engineRankingsPublished: 0
    },
    gates,
    measures: clone(CANDIDATE_RETEST_REREVIEW_MEASURES),
    correctionTaxonomy: clone(CANDIDATE_REVIEW_CORRECTION_FLAGS),
    dissentTaxonomy: clone(CANDIDATE_REVIEW_DISSENT_FLAGS),
    differenceTaxonomy: clone(CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS),
    cycles: portraits,
    selectedCycleId: selected?.cycleId || null,
    reviewerProgress: { completed: completedForActor, available: selected ? CANDIDATE_RETEST_REQUIRED_CASES : 0 },
    currentAssignment: currentAssignment ? {
      assignmentId: currentAssignment.assignmentId,
      cycleId: currentAssignment.cycleId,
      caseId: currentAssignment.caseId,
      packetFingerprint: currentAssignment.packetFingerprint,
      createdAt: currentAssignment.createdAt,
      expiresAt: currentAssignment.expiresAt
    } : null,
    returnIntakeEnabled: Boolean(selected) && selected.returnsReceived < CANDIDATE_RETEST_REQUIRED_CASES && refinementChain?.valid === true && returnChain?.valid === true && studyActive === true,
    packetIssuanceEnabled,
    localPairedEvidenceComplete: selected?.localPairedEvidenceComplete === true,
    independentDispositionRequired: true,
    anonymousContentVisibleOnlyDuringAssignment: true,
    baselineRetestMappingVisibleToReviewer: false,
    mappingRevealedAfterSubmission: false,
    candidateIdentityPublished: false,
    comparativeOutcomePublished: false,
    improvementClaimPublished: false,
    ...falseBook(),
    history: selectedReviews.slice().reverse().map(event => ({
      sequence: event.sequence,
      assignmentId: event.assignmentId,
      cycleId: event.cycleId,
      caseId: event.caseId,
      reviewerCodeHash: event.reviewerCodeHash,
      status: event.status,
      correctionCells: event.cells.filter(cell => cell.correctionBurden !== "none").length,
      dissentFlags: event.cells.reduce((sum, cell) => sum + cell.dissentFlags.length, 0),
      createdAt: event.createdAt,
      hash: event.hash
    })),
    chains: {
      refinement: clone(refinementChain),
      retestReturns: clone(returnChain),
      pairedReviews: clone(reviewChain)
    },
    boundary: CANDIDATE_RETEST_REREVIEW_BOUNDARY
  };
  return { ...core, studioFingerprint: candidateRetestReviewDigest(core), generatedAt };
}

export function candidateRetestReviewEvidence({ cycle, refinementChain, returnChain, retestEvents }) {
  const returns = currentReturnsForCycle(cycle, retestEvents);
  return {
    cycleEventHash: cycle.hash,
    returnSetFingerprint: candidateRetestReturnSetFingerprint(returns),
    candidateRefinementChainHead: refinementChain?.head || "",
    candidateRetestReturnChainHead: returnChain?.head || "",
    clinicalStandardHash: cycle.evidence.clinicalStandardHash,
    candidateTrialProtocolFingerprint: cycle.evidence.candidateTrialProtocolFingerprint,
    retestProtocolFingerprint: cycle.retestPolicy.retestProtocolFingerprint
  };
}

function validateAssignmentEvidence(evidence, errors) {
  const keys = ["cycleEventHash", "returnSetFingerprint", "candidateRefinementChainHead", "candidateRetestReturnChainHead", "clinicalStandardHash", "candidateTrialProtocolFingerprint", "retestProtocolFingerprint"];
  if (!exactKeys(evidence, keys, "assignment evidence", errors)) return;
  for (const key of keys) if (!HEX.test(String(evidence[key] || ""))) errors.push(`assignment evidence ${key} is invalid.`);
}

export function createCandidateRetestReviewAssignment({
  cycle,
  caseId,
  sourceProfile,
  baselineArtifact,
  retestArtifact,
  evidence,
  actor,
  reviewerProgress,
  mappingOrientation = "baseline-first",
  createdAt = new Date().toISOString(),
  assignmentId = `FF-CANDIDATE-RETEST-REVIEW-${randomUUID().toUpperCase()}`
} = {}) {
  const errors = [];
  if (!ACTOR.test(String(actor || ""))) errors.push("Candidate retest re-review actor is invalid.");
  if (!CYCLE_ID.test(String(cycle?.cycleId || "")) || !CASE_ID.test(String(caseId || "")) || sourceProfile?.assessmentId !== caseId) errors.push("Candidate retest re-review cycle or synthetic case is invalid.");
  if (!baselineArtifact?.summary || !HEX.test(String(baselineArtifact?.artifactHash || ""))) errors.push("Candidate retest baseline artifact is unavailable.");
  if (!retestArtifact?.summary || !HEX.test(String(retestArtifact?.artifactHash || ""))) errors.push("Candidate retest output artifact is unavailable.");
  if (!['baseline-first', 'retest-first'].includes(mappingOrientation)) errors.push("Candidate retest re-review mapping orientation is invalid.");
  validateAssignmentEvidence(evidence, errors);
  if (errors.length) throw new Error([...new Set(errors)].join(" "));
  const pairMapping = mappingOrientation === "baseline-first" ? { X: "baseline", Y: "retest" } : { X: "retest", Y: "baseline" };
  const byArm = { baseline: baselineArtifact, retest: retestArtifact };
  const cells = POSITIONS.map(blindPosition => {
    const artifact = byArm[pairMapping[blindPosition]];
    return {
      blindPosition,
      artifactHash: artifact.artifactHash,
      summary: String(artifact.summary),
      wordCount: String(artifact.summary).trim().split(/\s+/).filter(Boolean).length
    };
  });
  const pairMappingHash = candidateRetestReviewDigest(pairMapping);
  const expiresAt = new Date(Date.parse(createdAt) + CANDIDATE_RETEST_REREVIEW_ASSIGNMENT_HOURS * 60 * 60 * 1000).toISOString();
  const assignmentCore = {
    contractVersion: CANDIDATE_RETEST_REREVIEW_CONTRACT,
    protocol: CANDIDATE_RETEST_REREVIEW_PROTOCOL,
    assignmentId,
    cycleId: cycle.cycleId,
    caseId,
    caseFingerprint: cycle.retestEnvelopes.find(envelope => envelope.caseId === caseId)?.caseFingerprint || "",
    retestProtocolFingerprint: cycle.retestPolicy.retestProtocolFingerprint,
    sourceProfile: clone(sourceProfile),
    sourceProfileHash: candidateRetestReviewDigest(sourceProfile),
    cells,
    pairMappingHash,
    evidence: clone(evidence),
    reviewerProgress: clone(reviewerProgress),
    createdAt,
    expiresAt,
    contentBoundary: clone(CONTENT_BOUNDARY),
    boundary: CANDIDATE_RETEST_REREVIEW_BOUNDARY
  };
  if (!HEX.test(assignmentCore.caseFingerprint)) throw new Error("Candidate retest re-review case fingerprint is unavailable.");
  const packetFingerprint = candidateRetestReviewDigest(assignmentCore);
  return {
    pending: { ...assignmentCore, packetFingerprint, pairMapping, actor },
    packet: { ...assignmentCore, packetFingerprint }
  };
}

export function publicCandidateRetestReviewAssignment(pending) {
  if (!pending) return null;
  const { pairMapping, actor, ...packet } = pending;
  return clone(packet);
}

export function validateCandidateRetestReviewSubmission(input, pending, actor, submittedAt = new Date().toISOString()) {
  const errors = [];
  const rootKeys = ["assignmentId", "packetFingerprint", "cells", "differenceDisposition"];
  if (!exactKeys(input, rootKeys, "Candidate retest re-review submission", errors)) return errors;
  if (!pending || input.assignmentId !== pending.assignmentId || input.packetFingerprint !== pending.packetFingerprint) errors.push("Candidate retest re-review submission does not match the active packet.");
  if (pending?.actor !== actor) errors.push("Candidate retest re-review packet belongs to a different reviewer code.");
  if (!Number.isFinite(Date.parse(submittedAt)) || !Number.isFinite(Date.parse(pending?.expiresAt)) || Date.parse(submittedAt) > Date.parse(pending?.expiresAt)) errors.push("Candidate retest re-review packet has expired.");
  if (!CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS.includes(input.differenceDisposition)) errors.push("Candidate retest paired-difference disposition is invalid.");
  if (!Array.isArray(input.cells) || input.cells.length !== 2) {
    errors.push("Candidate retest re-review submission must rate exactly two blind cells.");
    return [...new Set(errors)];
  }
  const seen = new Set();
  for (const [index, cell] of input.cells.entries()) {
    const label = `cells[${index}]`;
    const keys = ["blindPosition", "ratings", "correctionBurden", "correctionFlags", "dissentFlags", "useDisposition"];
    if (!exactKeys(cell, keys, label, errors)) continue;
    if (!POSITIONS.includes(cell.blindPosition) || seen.has(cell.blindPosition)) errors.push(`${label}.blindPosition is invalid or repeated.`);
    seen.add(cell.blindPosition);
    if (!pending?.cells?.some(item => item.blindPosition === cell.blindPosition)) errors.push(`${label} does not belong to the active packet.`);
    const ratingKeys = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
    if (exactKeys(cell.ratings, ratingKeys, `${label}.ratings`, errors)) for (const key of ratingKeys) if (!Number.isInteger(cell.ratings[key]) || cell.ratings[key] < 1 || cell.ratings[key] > 5) errors.push(`${label}.ratings.${key} must be an integer from 1 through 5.`);
    if (!CANDIDATE_REVIEW_CORRECTION_BURDENS.includes(cell.correctionBurden)) errors.push(`${label}.correctionBurden is invalid.`);
    const validCorrections = uniqueKnownList(cell.correctionFlags, CANDIDATE_REVIEW_CORRECTION_FLAGS, `${label}.correctionFlags`, errors);
    uniqueKnownList(cell.dissentFlags, CANDIDATE_REVIEW_DISSENT_FLAGS, `${label}.dissentFlags`, errors);
    if (validCorrections && ((cell.correctionBurden === "none") !== (cell.correctionFlags.length === 0))) errors.push(`${label} correction burden and flags are inconsistent.`);
    if (!CANDIDATE_REVIEW_USE_DISPOSITIONS.includes(cell.useDisposition)) errors.push(`${label}.useDisposition is invalid.`);
  }
  if (seen.size !== 2 || POSITIONS.some(position => !seen.has(position))) errors.push("Candidate retest re-review submission must cover X and Y exactly once.");
  return [...new Set(errors)];
}

export function createCandidateRetestReviewEvent({ input, pending, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const errors = validateCandidateRetestReviewSubmission(input, pending, actor, createdAt);
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
    contractVersion: CANDIDATE_RETEST_REREVIEW_CONTRACT,
    eventType: "candidate-retest-rereview-outcome-recorded",
    status: "anonymous-paired-review-held-unverified",
    assignmentId: pending.assignmentId,
    packetFingerprint: pending.packetFingerprint,
    cycleId: pending.cycleId,
    cycleEventHash: pending.evidence.cycleEventHash,
    caseId: pending.caseId,
    caseFingerprint: pending.caseFingerprint,
    retestProtocolFingerprint: pending.retestProtocolFingerprint,
    reviewerCodeHash: candidateRetestReviewDigest(actor),
    sourceProfileHash: pending.sourceProfileHash,
    cells,
    pairMapping: clone(pending.pairMapping),
    pairMappingHash: pending.pairMappingHash,
    differenceDisposition: input.differenceDisposition,
    evidence: clone(pending.evidence),
    measureProtocol: { predeclaredMeasures: 7, directlyRecordedMeasures: 6, independentOverlapDerivedAcrossPackets: true },
    reviewTiming: { assignedAt: pending.createdAt, submittedAt: createdAt, durationSeconds, protocolEligible: durationSeconds <= CANDIDATE_RETEST_REREVIEW_ASSIGNMENT_HOURS * 60 * 60 },
    contentBoundary: clone(CONTENT_BOUNDARY),
    baselineRetestMappingVisibleDuringReview: false,
    mappingRevealedAfterSubmission: false,
    baselineRetestComparisonRecorded: true,
    ...falseBook(),
    actor,
    createdAt,
    note: "One blinded baseline-versus-retest packet was completed against the same visible synthetic scored source. Ratings, correction burden, structured corrections, dissent, use disposition, and one bounded paired-difference disposition entered the immutable ledger. The X/Y mapping remains concealed before and after submission. This local record does not verify execution or reviewer identity, interpret preference as improvement, establish accuracy, reliability, safety, usefulness, clinical validity, or the Clinical Standard, rank or select an engine, close the cycle, or authorize clinical, pilot, production, or patient use."
  };
  return { ...core, hash: candidateRetestReviewDigest(core) };
}

function validateContentBoundary(boundary, errors) {
  const keys = Object.keys(CONTENT_BOUNDARY);
  if (!exactKeys(boundary, keys, "contentBoundary", errors)) return;
  for (const key of keys) if (boundary[key] !== CONTENT_BOUNDARY[key]) errors.push(`contentBoundary.${key} is invalid.`);
}

export function validateCandidateRetestReviewEvent(event, { sequence = event?.sequence, previousHash = event?.previousHash, knownArtifactHashes = null, knownCycleHashes = null } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Candidate retest re-review event is required."];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "eventType", "status", "assignmentId", "packetFingerprint", "cycleId", "cycleEventHash", "caseId", "caseFingerprint", "retestProtocolFingerprint", "reviewerCodeHash", "sourceProfileHash", "cells", "pairMapping", "pairMappingHash", "differenceDisposition", "evidence", "measureProtocol", "reviewTiming", "contentBoundary", "baselineRetestMappingVisibleDuringReview", "mappingRevealedAfterSubmission", "baselineRetestComparisonRecorded", ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Candidate retest re-review event", errors)) return errors;
  if (event.contractVersion !== CANDIDATE_RETEST_REREVIEW_CONTRACT || event.eventType !== "candidate-retest-rereview-outcome-recorded" || event.status !== "anonymous-paired-review-held-unverified") errors.push("Candidate retest re-review event identity is invalid.");
  if (!UUID.test(String(event.id || "")) || !Number.isInteger(event.sequence) || event.sequence < 1 || event.sequence !== sequence || event.previousHash !== previousHash || !CHAIN_HEAD.test(String(event.previousHash || ""))) errors.push("Candidate retest re-review chain position is invalid.");
  if (!ASSIGNMENT_ID.test(String(event.assignmentId || "")) || !CYCLE_ID.test(String(event.cycleId || "")) || !CASE_ID.test(String(event.caseId || ""))) errors.push("Candidate retest re-review assignment, cycle, or case identity is invalid.");
  for (const key of ["packetFingerprint", "cycleEventHash", "caseFingerprint", "retestProtocolFingerprint", "reviewerCodeHash", "sourceProfileHash", "pairMappingHash", "hash"]) if (!HEX.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  if (knownCycleHashes && !knownCycleHashes.has(event.cycleEventHash)) errors.push("Candidate retest re-review cycle evidence is unknown.");
  validateAssignmentEvidence(event.evidence, errors);
  if (event.evidence?.cycleEventHash !== event.cycleEventHash || event.evidence?.retestProtocolFingerprint !== event.retestProtocolFingerprint) errors.push("Candidate retest re-review evidence binding is inconsistent.");
  if (!Array.isArray(event.cells) || event.cells.length !== 2) errors.push("Candidate retest re-review event must contain two cells.");
  const seen = new Set();
  for (const [index, cell] of (event.cells || []).entries()) {
    const label = `cells[${index}]`;
    const cellKeys = ["blindPosition", "artifactHash", "ratings", "correctionBurden", "correctionFlags", "dissentFlags", "useDisposition"];
    if (!exactKeys(cell, cellKeys, label, errors)) continue;
    if (!POSITIONS.includes(cell.blindPosition) || seen.has(cell.blindPosition)) errors.push(`${label}.blindPosition is invalid or repeated.`);
    seen.add(cell.blindPosition);
    if (!HEX.test(String(cell.artifactHash || "")) || (knownArtifactHashes && !knownArtifactHashes.has(cell.artifactHash))) errors.push(`${label}.artifactHash does not resolve to immutable baseline or retest evidence.`);
    const ratingKeys = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
    if (exactKeys(cell.ratings, ratingKeys, `${label}.ratings`, errors)) for (const key of ratingKeys) if (!Number.isInteger(cell.ratings[key]) || cell.ratings[key] < 1 || cell.ratings[key] > 5) errors.push(`${label}.ratings.${key} is invalid.`);
    if (!CANDIDATE_REVIEW_CORRECTION_BURDENS.includes(cell.correctionBurden)) errors.push(`${label}.correctionBurden is invalid.`);
    const validCorrections = uniqueKnownList(cell.correctionFlags, CANDIDATE_REVIEW_CORRECTION_FLAGS, `${label}.correctionFlags`, errors);
    uniqueKnownList(cell.dissentFlags, CANDIDATE_REVIEW_DISSENT_FLAGS, `${label}.dissentFlags`, errors);
    if (validCorrections && ((cell.correctionBurden === "none") !== (cell.correctionFlags.length === 0))) errors.push(`${label} correction burden and flags are inconsistent.`);
    if (!CANDIDATE_REVIEW_USE_DISPOSITIONS.includes(cell.useDisposition)) errors.push(`${label}.useDisposition is invalid.`);
  }
  if (seen.size !== 2) errors.push("Candidate retest re-review event must cover X and Y exactly once.");
  if (!exactKeys(event.pairMapping, POSITIONS, "pairMapping", errors)) {
    // Exact-key diagnostics already recorded.
  } else if (POSITIONS.some(position => !ARMS.includes(event.pairMapping[position])) || new Set(Object.values(event.pairMapping)).size !== 2) errors.push("Candidate retest pair mapping must bind one baseline and one retest artifact.");
  if (candidateRetestReviewDigest(event.pairMapping) !== event.pairMappingHash) errors.push("Candidate retest pair mapping hash is invalid.");
  if (![...CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS, ...LEGACY_CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS].includes(event.differenceDisposition)) errors.push("Candidate retest paired-difference disposition is invalid.");
  if (!exactKeys(event.measureProtocol, ["predeclaredMeasures", "directlyRecordedMeasures", "independentOverlapDerivedAcrossPackets"], "measureProtocol", errors) || event.measureProtocol?.predeclaredMeasures !== 7 || event.measureProtocol?.directlyRecordedMeasures !== 6 || event.measureProtocol?.independentOverlapDerivedAcrossPackets !== true) errors.push("Candidate retest re-review measure protocol is invalid.");
  if (exactKeys(event.reviewTiming, ["assignedAt", "submittedAt", "durationSeconds", "protocolEligible"], "reviewTiming", errors)) {
    const duration = Math.floor((Date.parse(event.reviewTiming.submittedAt) - Date.parse(event.reviewTiming.assignedAt)) / 1000);
    if (!Number.isFinite(duration) || duration < 0 || event.reviewTiming.durationSeconds !== duration || event.reviewTiming.protocolEligible !== (duration <= CANDIDATE_RETEST_REREVIEW_ASSIGNMENT_HOURS * 60 * 60)) errors.push("Candidate retest re-review timing provenance is invalid.");
  }
  validateContentBoundary(event.contentBoundary, errors);
  if (event.baselineRetestMappingVisibleDuringReview !== false || event.mappingRevealedAfterSubmission !== false || event.baselineRetestComparisonRecorded !== true) errors.push("Candidate retest re-review concealment or comparison claim is invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(event.actor || "")) || candidateRetestReviewDigest(event.actor) !== event.reviewerCodeHash || !Number.isFinite(Date.parse(event.createdAt)) || event.createdAt !== event.reviewTiming?.submittedAt || String(event.note || "").length < 430) errors.push("Candidate retest re-review actor, timestamp, or note is invalid.");
  const { hash, ...core } = event;
  if (candidateRetestReviewDigest(core) !== hash) errors.push("Candidate retest re-review event hash is invalid.");
  return [...new Set(errors)];
}

export function candidateRetestReviewReceipt(event) {
  return {
    sequence: event.sequence,
    assignmentId: event.assignmentId,
    cycleId: event.cycleId,
    caseId: event.caseId,
    packetFingerprint: event.packetFingerprint,
    status: event.status,
    blindCellsRecorded: event.cells.length,
    baselineRetestMappingRevealed: false,
    comparativeOutcomePublished: false,
    improvementEstablished: false,
    createdAt: event.createdAt,
    hash: event.hash
  };
}
