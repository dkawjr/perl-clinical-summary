import { createHash, randomUUID } from "node:crypto";

export const CANDIDATE_REFINEMENT_RETEST_CONTRACT = "perl-candidate-refinement-retest/1.0";
export const CANDIDATE_REFINEMENT_RETEST_PROTOCOL = "candidate-refinement-retest-v1";
export const CANDIDATE_REFINEMENT_MINIMUM_CASES = 3;
export const CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE = 2;

export const CANDIDATE_REFINEMENT_RETEST_BOUNDARY = "This lab opens only after the current Candidate Blind Review evidence contains independent overlap on all three frozen synthetic cases. It decodes the concealed A–D mapping only inside the store to find repeated structured correction patterns, then publishes three fixed anonymous lanes in declaration order without candidate scores, averages, ordering, a winner, or provider/model/prompt identity. One eligible repeated pattern may scope one bounded intervention and three content-free same-case retest envelopes. The lab never changes a model, calls a provider, sends source data, accepts a retest output, verifies execution, interprets dissent as a vote, establishes improvement, accuracy, reliability, safety, usefulness, clinical validity, or satisfaction with the Clinical Standard, ranks or selects an engine, changes care, starts a pilot, releases production, or permits patient use.";

export const CANDIDATE_REFINEMENT_LANES = Object.freeze([
  Object.freeze({ id: "lane-i", label: "Lane I", candidateSlot: "candidate-01", index: "I" }),
  Object.freeze({ id: "lane-ii", label: "Lane II", candidateSlot: "candidate-02", index: "II" }),
  Object.freeze({ id: "lane-iii", label: "Lane III", candidateSlot: "candidate-03", index: "III" })
]);

export const CANDIDATE_REFINEMENT_SIGNAL_RULES = Object.freeze([
  Object.freeze({
    correctionFlag: "factual-mismatch",
    label: "Factual grounding",
    interventionType: "evidence-grounding-constraint",
    targetMeasure: "evidence-fidelity",
    iterationGoal: "reduce-repeated-correction"
  }),
  Object.freeze({
    correctionFlag: "unsupported-overreach",
    label: "Diagnostic restraint",
    interventionType: "diagnostic-restraint-constraint",
    targetMeasure: "clinical-restraint",
    iterationGoal: "preserve-fidelity-and-restraint"
  }),
  Object.freeze({
    correctionFlag: "material-omission",
    label: "Material signal coverage",
    interventionType: "material-signal-coverage",
    targetMeasure: "evidence-fidelity",
    iterationGoal: "reduce-material-burden"
  }),
  Object.freeze({
    correctionFlag: "tone-or-clarity",
    label: "Tone and clarity",
    interventionType: "tone-and-clarity-structure",
    targetMeasure: "conversation-usefulness",
    iterationGoal: "improve-usefulness-without-overreach"
  }),
  Object.freeze({
    correctionFlag: "workflow-usefulness",
    label: "Workflow usefulness",
    interventionType: "workflow-usefulness-structure",
    targetMeasure: "conversation-usefulness",
    iterationGoal: "improve-usefulness-without-overreach"
  }),
  Object.freeze({
    correctionFlag: "safety-routing",
    label: "Safety routing",
    interventionType: "safety-escalation-only",
    targetMeasure: "critical-safety-handling",
    iterationGoal: "preserve-safety-before-refinement",
    safetyOnly: true
  })
]);

const HEX = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYCLE_ID = /^FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80}$/;
const ENVELOPE_ID = /^FF-CANDIDATE-RETEST-[A-F0-9-]{20,80}$/;
const CASE_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;

const FALSE_CLAIMS = Object.freeze([
  "reviewerIdentityVerified",
  "counselorQualificationVerified",
  "candidateRunExternallyVerified",
  "providerVerified",
  "modelModificationPerformed",
  "candidateRetestExecuted",
  "candidateRetestReturnReceived",
  "retestReviewCompleted",
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

const CONTENT_BOUNDARY = Object.freeze({
  scoredSourceIncluded: false,
  baselineSummaryIncluded: false,
  revisedSummaryIncluded: false,
  rawProviderResponseIncluded: false,
  findingsContentIncluded: false,
  providerIdentityIncluded: false,
  modelIdentityIncluded: false,
  promptContentIncluded: false,
  reviewerIdentityIncluded: false,
  counselorIdentityIncluded: false,
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

export function candidateRefinementDigest(value) {
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

function laneForId(laneId) {
  return CANDIDATE_REFINEMENT_LANES.find(lane => lane.id === laneId) || null;
}

function ruleForFlag(flag) {
  return CANDIDATE_REFINEMENT_SIGNAL_RULES.find(rule => rule.correctionFlag === flag) || null;
}

function eventMatchesEvidence(event, evidence) {
  return Boolean(event?.evidence)
    && event.evidence.candidateReturnChainHead === evidence?.candidateReturnChainHead
    && event.evidence.referenceDecisionChainHead === evidence?.referenceDecisionChainHead
    && event.evidence.clinicalStandardHash === evidence?.clinicalStandardHash
    && event.evidence.candidateTrialProtocolFingerprint === evidence?.candidateTrialProtocolFingerprint;
}

function observationForLane(event, lane) {
  const blindPosition = Object.entries(event.authorMapping || {}).find(([, arm]) => arm === lane.candidateSlot)?.[0];
  const cell = event.cells?.find(item => item.blindPosition === blindPosition);
  if (!cell) return null;
  return {
    caseId: event.caseId,
    reviewerCodeHash: event.reviewerCodeHash,
    eventHash: event.hash,
    correctionBurden: cell.correctionBurden,
    correctionFlags: clone(cell.correctionFlags || []),
    dissentFlags: clone(cell.dissentFlags || []),
    useDisposition: cell.useDisposition
  };
}

function buildLanePortrait(lane, events) {
  const observations = events.map(event => observationForLane(event, lane)).filter(Boolean);
  const caseIds = [...new Set(observations.map(item => item.caseId))].sort();
  const reviewers = [...new Set(observations.map(item => item.reviewerCodeHash))].sort();
  const unsafeCorrectionObserved = observations.some(item => item.correctionBurden === "unsafe");
  const signals = CANDIDATE_REFINEMENT_SIGNAL_RULES.map(rule => {
    const matches = observations.filter(item => item.correctionFlags.includes(rule.correctionFlag));
    const signalCases = [...new Set(matches.map(item => item.caseId))].sort();
    const signalReviewers = [...new Set(matches.map(item => item.reviewerCodeHash))].sort();
    const evidenceEventHashes = [...new Set(matches.map(item => item.eventHash))].sort();
    const thresholdMet = signalCases.length >= CANDIDATE_REFINEMENT_MINIMUM_CASES
      && signalReviewers.length >= CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE;
    const eligible = thresholdMet && !rule.safetyOnly && !unsafeCorrectionObserved;
    const state = rule.safetyOnly && matches.length
      ? "safety-triage-only"
      : unsafeCorrectionObserved
        ? "held-for-safety-triage"
        : eligible
          ? "evidence-threshold-met"
          : "collect-more-evidence";
    const core = {
      id: `${lane.id}:${rule.correctionFlag}`,
      laneId: lane.id,
      label: rule.label,
      correctionFlag: rule.correctionFlag,
      interventionType: rule.interventionType,
      targetMeasure: rule.targetMeasure,
      iterationGoal: rule.iterationGoal,
      evidenceCount: matches.length,
      caseCount: signalCases.length,
      reviewerCount: signalReviewers.length,
      evidenceEventHashes,
      thresholdMet,
      eligible,
      state,
      nextEvidence: rule.safetyOnly && matches.length
        ? "Route the safety judgment for governed triage; it cannot become an optimization target."
        : unsafeCorrectionObserved
          ? "This lane remains held until the unsafe correction is independently triaged."
          : eligible
            ? "This repeated correction may scope one bounded same-case retest cycle."
            : `Require ${CANDIDATE_REFINEMENT_MINIMUM_CASES} cases and ${CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE} reviewer codes before scoping a cycle.`
    };
    return { ...core, signalHash: candidateRefinementDigest(core) };
  });
  return {
    id: lane.id,
    index: lane.index,
    label: lane.label,
    observations: observations.length,
    caseCoverage: caseIds.length,
    reviewerCoverage: reviewers.length,
    correctionObservations: observations.filter(item => item.correctionBurden !== "none").length,
    materialOrUnsafeObservations: observations.filter(item => ["material", "unsafe"].includes(item.correctionBurden)).length,
    dissentFlagsObserved: observations.reduce((sum, item) => sum + item.dissentFlags.length, 0),
    unsafeCorrectionObserved,
    eligibleSignalCount: signals.filter(signal => signal.eligible).length,
    signals,
    candidateIdentityPublished: false,
    providerIdentityPublished: false,
    scorePublished: false,
    rankPublished: false
  };
}

function sourceGateSatisfied(candidateReview, id) {
  return candidateReview?.gates?.find(gate => gate.id === id)?.satisfied === true;
}

function readinessGates({ candidateReview, currentEvents, caseIds, studyActive, chain }) {
  const reviewerSets = new Map(caseIds.map(caseId => [caseId, new Set()]));
  for (const event of currentEvents) reviewerSets.get(event.caseId)?.add(event.reviewerCodeHash);
  const casesWithOverlap = [...reviewerSets.values()].filter(reviewers => reviewers.size >= CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE).length;
  const minimumPackets = CANDIDATE_REFINEMENT_MINIMUM_CASES * CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE;
  const sourceBundleCurrent = ["candidate-returns", "accepted-reference-set", "reference-protocol-freeze", "reference-content-resolution"].every(id => sourceGateSatisfied(candidateReview, id));
  return [
    {
      id: "source-bundle-current",
      index: "01",
      label: "Current source bundle",
      satisfied: sourceBundleCurrent,
      detail: sourceBundleCurrent ? "Candidate returns and the accepted counselor-reference set remain current." : "Current candidate-return or reference evidence is incomplete."
    },
    {
      id: "review-chain-integrity",
      index: "02",
      label: "Review chain integrity",
      satisfied: chain?.valid === true,
      detail: chain?.valid === true ? `${Number(chain.count || 0)} blind-review outcomes remain hash-linked.` : "The blind-review chain is not valid."
    },
    {
      id: "current-review-cohort",
      index: "03",
      label: "Current review cohort",
      satisfied: currentEvents.length >= minimumPackets,
      detail: `${currentEvents.length} of at least ${minimumPackets} current anonymous review packets are available.`
    },
    {
      id: "independent-case-overlap",
      index: "04",
      label: "Independent case overlap",
      satisfied: casesWithOverlap === CANDIDATE_REFINEMENT_MINIMUM_CASES,
      detail: `${casesWithOverlap} of ${CANDIDATE_REFINEMENT_MINIMUM_CASES} frozen cases have at least ${CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE} reviewer codes.`
    },
    {
      id: "pre-outcome-standard",
      index: "05",
      label: "Pre-outcome standard",
      satisfied: sourceGateSatisfied(candidateReview, "pre-outcome-standard"),
      detail: sourceGateSatisfied(candidateReview, "pre-outcome-standard") ? "The Clinical Standard predates the review outcomes." : "A current pre-outcome Clinical Standard draft is required."
    },
    {
      id: "study-control",
      index: "06",
      label: "Local study control",
      satisfied: studyActive === true,
      detail: studyActive === true ? "No open stopping event blocks local cycle scoping." : "An open stopping event pauses refinement and retest planning."
    }
  ];
}

export function validateCandidateRefinementContract() {
  const errors = [];
  if (CANDIDATE_REFINEMENT_LANES.length !== 3 || new Set(CANDIDATE_REFINEMENT_LANES.map(lane => lane.candidateSlot)).size !== 3) errors.push("Candidate refinement must preserve exactly three fixed anonymous lanes.");
  if (CANDIDATE_REFINEMENT_SIGNAL_RULES.length !== 6 || CANDIDATE_REFINEMENT_SIGNAL_RULES.filter(rule => rule.safetyOnly).length !== 1) errors.push("Candidate refinement signal rules are incomplete.");
  if (!/without candidate scores, averages, ordering, a winner/i.test(CANDIDATE_REFINEMENT_RETEST_BOUNDARY) || !/never changes a model, calls a provider/i.test(CANDIDATE_REFINEMENT_RETEST_BOUNDARY)) errors.push("Candidate refinement claim boundary is incomplete.");
  return errors;
}

export function buildCandidateRefinementDesk({
  candidateReview,
  reviewEvents = [],
  cycles = [],
  evidence = {},
  caseIds = [],
  studyActive = true,
  chain = { valid: true, count: 0, failedAt: null, head: null },
  generatedAt = new Date().toISOString()
} = {}) {
  const expectedCases = [...new Set(caseIds)].sort();
  const currentEvents = reviewEvents.filter(event => expectedCases.includes(event.caseId) && eventMatchesEvidence(event, evidence));
  const gates = readinessGates({ candidateReview, currentEvents, caseIds: expectedCases, studyActive, chain: candidateReview?.chain || { valid: false, count: 0 } });
  const lanes = CANDIDATE_REFINEMENT_LANES.map(lane => buildLanePortrait(lane, currentEvents));
  const locallyReady = gates.every(gate => gate.satisfied);
  const eligibleSignalCount = lanes.reduce((sum, lane) => sum + lane.eligibleSignalCount, 0);
  const openLaneIds = new Set(cycles.map(cycle => cycle.laneId));
  const cycleIssuanceEnabled = locallyReady && lanes.some(lane => lane.eligibleSignalCount > 0 && !openLaneIds.has(lane.id));
  const status = !locallyReady
    ? "blocked-awaiting-independent-overlap"
    : cycles.length
      ? "retest-kits-issued-awaiting-manual-return"
      : eligibleSignalCount
        ? "refinement-scope-ready"
        : "evidence-ready-no-repeated-pattern";
  const core = {
    contractVersion: CANDIDATE_REFINEMENT_RETEST_CONTRACT,
    protocol: CANDIDATE_REFINEMENT_RETEST_PROTOCOL,
    status,
    headline: "Change one thing. Test the same truth again.",
    descriptor: "Correction becomes a bounded intervention. The original cases remain the control. No lane becomes a winner.",
    counts: {
      readinessGatesSatisfied: gates.filter(gate => gate.satisfied).length,
      readinessGatesRequired: gates.length,
      currentReviewPackets: currentEvents.length,
      currentBlindCells: currentEvents.length * 4,
      casesWithIndependentOverlap: Number(candidateReview?.counts?.casesWithIndependentOverlap || 0),
      anonymousLanes: lanes.length,
      eligibleSignals: eligibleSignalCount,
      unsafeLanes: lanes.filter(lane => lane.unsafeCorrectionObserved).length,
      cyclesIssued: cycles.length,
      retestEnvelopesIssued: cycles.reduce((sum, cycle) => sum + cycle.retestEnvelopes.length, 0),
      retestReturnsReceived: 0,
      engineRankingsPublished: 0
    },
    gates,
    thresholds: {
      minimumIndependentCases: CANDIDATE_REFINEMENT_MINIMUM_CASES,
      minimumReviewersPerCase: CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE,
      recurrenceRule: "A correction flag must recur across all three frozen cases and at least two reviewer codes."
    },
    lanes,
    cycles: cycles.slice().reverse().map(cycle => candidateRefinementCycleReceipt(cycle)),
    locallyReady,
    cycleIssuanceEnabled,
    candidateScoresPublished: false,
    candidateAveragesPublished: false,
    candidateOrderingPublished: false,
    dissentUsedAsVote: false,
    ...falseBook(),
    chain: clone(chain),
    evidence: clone(evidence),
    boundary: CANDIDATE_REFINEMENT_RETEST_BOUNDARY
  };
  return { ...core, deskFingerprint: candidateRefinementDigest(core), generatedAt };
}

function validateCycleInput(input, desk, errors) {
  const keys = ["laneId", "signalId", "interventionType", "targetMeasure", "iterationGoal"];
  if (!exactKeys(input, keys, "Candidate refinement cycle input", errors)) return null;
  const lane = desk?.lanes?.find(item => item.id === input.laneId);
  const signal = lane?.signals?.find(item => item.id === input.signalId);
  if (!lane || !laneForId(input.laneId)) errors.push("Candidate refinement lane is invalid.");
  if (!signal || !signal.eligible) errors.push("Candidate refinement signal is missing or not eligible.");
  if (signal && (input.interventionType !== signal.interventionType || input.targetMeasure !== signal.targetMeasure || input.iterationGoal !== signal.iterationGoal)) errors.push("Candidate refinement intervention must match the predeclared signal rule.");
  return { lane, signal };
}

export function createCandidateRefinementCycle({
  input,
  desk,
  baselineByCase,
  evidence,
  actor,
  sequence,
  previousHash = "GENESIS",
  cycleNumber,
  createdAt = new Date().toISOString(),
  id = randomUUID(),
  cycleId = `FF-REFINEMENT-CYCLE-${randomUUID().toUpperCase()}`
} = {}) {
  const errors = [];
  const selected = validateCycleInput(input, desk, errors);
  if (!desk?.locallyReady || !desk?.cycleIssuanceEnabled) errors.push("Candidate refinement cycle intake is not ready.");
  if (!ACTOR.test(String(actor || ""))) errors.push("Candidate refinement actor code is invalid.");
  const baselines = Object.values(baselineByCase || {}).sort((left, right) => String(left.caseId).localeCompare(String(right.caseId)));
  if (baselines.length !== CANDIDATE_REFINEMENT_MINIMUM_CASES || new Set(baselines.map(item => item.caseId)).size !== CANDIDATE_REFINEMENT_MINIMUM_CASES) errors.push("Candidate refinement requires three unique frozen baseline cases.");
  for (const baseline of baselines) {
    if (!CASE_ID.test(String(baseline.caseId || "")) || !HEX.test(String(baseline.caseFingerprint || "")) || !HEX.test(String(baseline.baselineArtifactHash || ""))) errors.push("Candidate refinement baseline evidence is invalid.");
  }
  if (errors.length) throw new Error([...new Set(errors)].join(" "));
  const signal = selected.signal;
  const signalSnapshotCore = {
    signalId: signal.id,
    correctionFlag: signal.correctionFlag,
    label: signal.label,
    evidenceCount: signal.evidenceCount,
    caseCount: signal.caseCount,
    reviewerCount: signal.reviewerCount,
    evidenceEventHashes: clone(signal.evidenceEventHashes),
    sourceSignalHash: signal.signalHash
  };
  const signalSnapshot = { ...signalSnapshotCore, snapshotHash: candidateRefinementDigest(signalSnapshotCore) };
  const intervention = {
    type: input.interventionType,
    targetMeasure: input.targetMeasure,
    iterationGoal: input.iterationGoal,
    changesDeclared: true,
    changesPerformed: false
  };
  const retestProtocolFingerprint = candidateRefinementDigest({
    contractVersion: CANDIDATE_REFINEMENT_RETEST_CONTRACT,
    protocol: CANDIDATE_REFINEMENT_RETEST_PROTOCOL,
    cycleId,
    laneId: input.laneId,
    signalSnapshot,
    intervention,
    evidence,
    baselines
  });
  const retestEnvelopes = baselines.map(baseline => ({
    envelopeId: `FF-CANDIDATE-RETEST-${randomUUID().toUpperCase()}`,
    cycleId,
    laneId: input.laneId,
    caseId: baseline.caseId,
    caseFingerprint: baseline.caseFingerprint,
    baselineArtifactHash: baseline.baselineArtifactHash,
    retestProtocolFingerprint,
    expectedReturnContract: "perl-candidate-retest-return/1.0",
    sourceContentIncluded: false,
    baselineSummaryIncluded: false,
    providerIdentityIncluded: false,
    modelIdentityIncluded: false,
    promptContentIncluded: false,
    endpointIncluded: false,
    credentialIncluded: false,
    phiIncluded: false
  }));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CANDIDATE_REFINEMENT_RETEST_CONTRACT,
    eventType: "candidate-refinement-cycle-scoped",
    status: "retest-kit-issued-awaiting-manual-return",
    cycleId,
    cycleNumber,
    laneId: input.laneId,
    laneLabel: selected.lane.label,
    signalSnapshot,
    intervention,
    evidence: clone(evidence),
    retestPolicy: {
      caseSetSize: CANDIDATE_REFINEMENT_MINIMUM_CASES,
      sameCasesRequired: true,
      oneInterventionPerCycle: true,
      blindReReviewRequired: true,
      independentAccuracyReliabilityReviewRequired: true,
      manualProviderExecutionOnly: true,
      retestProtocolFingerprint
    },
    retestEnvelopes,
    contentBoundary: clone(CONTENT_BOUNDARY),
    candidateIdentityPublished: false,
    providerIdentityPublished: false,
    reviewerIdentityPublished: false,
    authorMappingPublished: false,
    ...falseBook(),
    actorCodeHash: candidateRefinementDigest(actor),
    createdAt,
    note: "One repeated structured correction pattern scoped one bounded intervention against one fixed anonymous lane. Three content-free envelopes preserve the exact frozen cases and baseline artifact hashes for a manually executed retest. No model change, provider call, retest return, performance result, ranking, selection, clinical authorization, release, or patient-use claim was created."
  };
  return { ...core, hash: candidateRefinementDigest(core) };
}

function validateEvidence(evidence, errors) {
  const keys = ["candidateReviewChainHead", "candidateReviewDeskFingerprint", "candidateReturnChainHead", "clinicalStandardHash", "candidateTrialProtocolFingerprint"];
  if (!exactKeys(evidence, keys, "candidate refinement evidence", errors)) return;
  for (const key of keys) if (!HEX.test(String(evidence[key] || ""))) errors.push(`candidate refinement evidence ${key} is invalid.`);
}

function validateContentBoundary(boundary, errors) {
  const keys = Object.keys(CONTENT_BOUNDARY);
  if (!exactKeys(boundary, keys, "contentBoundary", errors)) return;
  for (const key of keys) if (boundary[key] !== CONTENT_BOUNDARY[key]) errors.push(`contentBoundary.${key} is invalid.`);
}

export function validateCandidateRefinementCycleEvent(event, {
  sequence = event?.sequence,
  previousHash = event?.previousHash,
  knownReviewEventHashes = null,
  knownBaselineArtifactHashes = null
} = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Candidate refinement cycle event is required."];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "eventType", "status", "cycleId", "cycleNumber", "laneId", "laneLabel", "signalSnapshot", "intervention", "evidence", "retestPolicy", "retestEnvelopes", "contentBoundary", "candidateIdentityPublished", "providerIdentityPublished", "reviewerIdentityPublished", "authorMappingPublished", ...FALSE_CLAIMS, "actorCodeHash", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Candidate refinement cycle event", errors)) return errors;
  const lane = laneForId(event.laneId);
  if (event.contractVersion !== CANDIDATE_REFINEMENT_RETEST_CONTRACT || event.eventType !== "candidate-refinement-cycle-scoped" || event.status !== "retest-kit-issued-awaiting-manual-return") errors.push("Candidate refinement cycle identity is invalid.");
  if (!UUID.test(String(event.id || "")) || !Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1 || event.previousHash !== previousHash || !CHAIN_HEAD.test(String(event.previousHash || ""))) errors.push("Candidate refinement chain position is invalid.");
  if (!CYCLE_ID.test(String(event.cycleId || "")) || !Number.isInteger(event.cycleNumber) || event.cycleNumber < 1 || !lane || event.laneLabel !== lane?.label) errors.push("Candidate refinement cycle or lane is invalid.");
  const snapshotKeys = ["signalId", "correctionFlag", "label", "evidenceCount", "caseCount", "reviewerCount", "evidenceEventHashes", "sourceSignalHash", "snapshotHash"];
  if (exactKeys(event.signalSnapshot, snapshotKeys, "signalSnapshot", errors)) {
    const rule = ruleForFlag(event.signalSnapshot.correctionFlag);
    if (!rule || rule.safetyOnly || event.signalSnapshot.signalId !== `${event.laneId}:${event.signalSnapshot.correctionFlag}` || event.signalSnapshot.label !== rule.label) errors.push("Candidate refinement signal snapshot is invalid.");
    if (!Number.isInteger(event.signalSnapshot.evidenceCount) || event.signalSnapshot.evidenceCount < 1 || event.signalSnapshot.caseCount < CANDIDATE_REFINEMENT_MINIMUM_CASES || event.signalSnapshot.reviewerCount < CANDIDATE_REFINEMENT_MINIMUM_REVIEWERS_PER_CASE) errors.push("Candidate refinement signal threshold is invalid.");
    if (!Array.isArray(event.signalSnapshot.evidenceEventHashes) || !event.signalSnapshot.evidenceEventHashes.length || new Set(event.signalSnapshot.evidenceEventHashes).size !== event.signalSnapshot.evidenceEventHashes.length || event.signalSnapshot.evidenceEventHashes.some(hash => !HEX.test(String(hash)) || (knownReviewEventHashes && !knownReviewEventHashes.has(hash)))) errors.push("Candidate refinement review evidence hashes are invalid.");
    const { snapshotHash, ...snapshotCore } = event.signalSnapshot;
    if (!HEX.test(String(event.signalSnapshot.sourceSignalHash || "")) || candidateRefinementDigest(snapshotCore) !== snapshotHash) errors.push("Candidate refinement signal snapshot hash is invalid.");
  }
  const interventionKeys = ["type", "targetMeasure", "iterationGoal", "changesDeclared", "changesPerformed"];
  if (exactKeys(event.intervention, interventionKeys, "intervention", errors)) {
    const rule = ruleForFlag(event.signalSnapshot?.correctionFlag);
    if (!rule || event.intervention.type !== rule.interventionType || event.intervention.targetMeasure !== rule.targetMeasure || event.intervention.iterationGoal !== rule.iterationGoal || event.intervention.changesDeclared !== true || event.intervention.changesPerformed !== false) errors.push("Candidate refinement intervention is invalid.");
  }
  validateEvidence(event.evidence, errors);
  const policyKeys = ["caseSetSize", "sameCasesRequired", "oneInterventionPerCycle", "blindReReviewRequired", "independentAccuracyReliabilityReviewRequired", "manualProviderExecutionOnly", "retestProtocolFingerprint"];
  if (exactKeys(event.retestPolicy, policyKeys, "retestPolicy", errors)) {
    if (event.retestPolicy.caseSetSize !== 3 || ["sameCasesRequired", "oneInterventionPerCycle", "blindReReviewRequired", "independentAccuracyReliabilityReviewRequired", "manualProviderExecutionOnly"].some(key => event.retestPolicy[key] !== true) || !HEX.test(String(event.retestPolicy.retestProtocolFingerprint || ""))) errors.push("Candidate refinement retest policy is invalid.");
  }
  if (!Array.isArray(event.retestEnvelopes) || event.retestEnvelopes.length !== 3) errors.push("Candidate refinement cycle must contain three retest envelopes.");
  const seenCases = new Set();
  const seenEnvelopes = new Set();
  for (const [index, envelope] of (event.retestEnvelopes || []).entries()) {
    const label = `retestEnvelopes[${index}]`;
    const envelopeKeys = ["envelopeId", "cycleId", "laneId", "caseId", "caseFingerprint", "baselineArtifactHash", "retestProtocolFingerprint", "expectedReturnContract", "sourceContentIncluded", "baselineSummaryIncluded", "providerIdentityIncluded", "modelIdentityIncluded", "promptContentIncluded", "endpointIncluded", "credentialIncluded", "phiIncluded"];
    if (!exactKeys(envelope, envelopeKeys, label, errors)) continue;
    if (!ENVELOPE_ID.test(String(envelope.envelopeId || "")) || seenEnvelopes.has(envelope.envelopeId) || envelope.cycleId !== event.cycleId || envelope.laneId !== event.laneId || !CASE_ID.test(String(envelope.caseId || "")) || seenCases.has(envelope.caseId)) errors.push(`${label} identity is invalid.`);
    seenEnvelopes.add(envelope.envelopeId);
    seenCases.add(envelope.caseId);
    if (!HEX.test(String(envelope.caseFingerprint || "")) || !HEX.test(String(envelope.baselineArtifactHash || "")) || (knownBaselineArtifactHashes && !knownBaselineArtifactHashes.has(envelope.baselineArtifactHash)) || envelope.retestProtocolFingerprint !== event.retestPolicy?.retestProtocolFingerprint || envelope.expectedReturnContract !== "perl-candidate-retest-return/1.0") errors.push(`${label} evidence binding is invalid.`);
    for (const key of ["sourceContentIncluded", "baselineSummaryIncluded", "providerIdentityIncluded", "modelIdentityIncluded", "promptContentIncluded", "endpointIncluded", "credentialIncluded", "phiIncluded"]) if (envelope[key] !== false) errors.push(`${label}.${key} must remain false.`);
  }
  validateContentBoundary(event.contentBoundary, errors);
  for (const key of ["candidateIdentityPublished", "providerIdentityPublished", "reviewerIdentityPublished", "authorMappingPublished", ...FALSE_CLAIMS]) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!HEX.test(String(event.actorCodeHash || "")) || !Number.isFinite(Date.parse(event.createdAt)) || String(event.note || "").length < 300) errors.push("Candidate refinement actor, timestamp, or note is invalid.");
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || candidateRefinementDigest(core) !== hash) errors.push("Candidate refinement event hash is invalid.");
  return [...new Set(errors)];
}

export function candidateRefinementCycleReceipt(event) {
  return {
    sequence: event.sequence,
    cycleId: event.cycleId,
    cycleNumber: event.cycleNumber,
    laneId: event.laneId,
    laneLabel: event.laneLabel,
    signalLabel: event.signalSnapshot.label,
    interventionType: event.intervention.type,
    targetMeasure: event.intervention.targetMeasure,
    status: event.status,
    retestEnvelopesIssued: event.retestEnvelopes.length,
    modelModificationPerformed: false,
    retestExecuted: false,
    engineRanked: false,
    engineSelected: false,
    createdAt: event.createdAt,
    hash: event.hash
  };
}

export function candidateRefinementRetestKit(event) {
  return {
    contractVersion: CANDIDATE_REFINEMENT_RETEST_CONTRACT,
    protocol: CANDIDATE_REFINEMENT_RETEST_PROTOCOL,
    cycle: candidateRefinementCycleReceipt(event),
    signalSnapshot: clone(event.signalSnapshot),
    intervention: clone(event.intervention),
    evidence: clone(event.evidence),
    retestPolicy: clone(event.retestPolicy),
    retestEnvelopes: clone(event.retestEnvelopes),
    contentBoundary: clone(event.contentBoundary),
    candidateIdentityIncluded: false,
    providerIdentityIncluded: false,
    reviewerIdentityIncluded: false,
    modelModificationPerformed: false,
    retestExecuted: false,
    boundary: CANDIDATE_REFINEMENT_RETEST_BOUNDARY
  };
}
