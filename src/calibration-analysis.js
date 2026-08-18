import { WORKFLOW_TIMING_CONTRACT } from "./workflow-timing.js";

function sortedNumeric(values) {
  return values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}

export function mean(values) {
  const data = sortedNumeric(values);
  return data.length ? data.reduce((sum, value) => sum + value, 0) / data.length : null;
}

export function quantile(values, probability) {
  const data = sortedNumeric(values);
  if (!data.length) return null;
  const position = (data.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return data[lower];
  return data[lower] + (data[upper] - data[lower]) * (position - lower);
}

export function describe(values) {
  const data = sortedNumeric(values);
  if (!data.length) return { n: 0, mean: null, median: null, q1: null, q3: null, min: null, max: null };
  return {
    n: data.length,
    mean: Number(mean(data).toFixed(2)),
    median: Number(quantile(data, 0.5).toFixed(2)),
    q1: Number(quantile(data, 0.25).toFixed(2)),
    q3: Number(quantile(data, 0.75).toFixed(2)),
    min: data[0],
    max: data.at(-1)
  };
}

export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(successes) || successes < 0 || successes > total) return null;
  const p = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const center = (p + (z ** 2) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) / total) + (z ** 2 / (4 * total ** 2)));
  return {
    estimate: Number(p.toFixed(4)),
    lower: Number(Math.max(0, center - margin).toFixed(4)),
    upper: Number(Math.min(1, center + margin).toFixed(4)),
    confidence: 0.95,
    method: "Wilson score"
  };
}

export function binaryGwetAc1({ agreeingPairs, reviewerPairs, perlEndpoints, totalEndpoints }) {
  if (!reviewerPairs || !totalEndpoints) return null;
  const observedAgreement = agreeingPairs / reviewerPairs;
  const perlMarginal = perlEndpoints / totalEndpoints;
  const chanceAgreement = 2 * perlMarginal * (1 - perlMarginal);
  const coefficient = (observedAgreement - chanceAgreement) / (1 - chanceAgreement);
  return {
    coefficient: Number(coefficient.toFixed(4)),
    observedAgreement: Number(observedAgreement.toFixed(4)),
    chanceAgreement: Number(chanceAgreement.toFixed(4)),
    reviewerPairs,
    method: "pairwise binary Gwet AC1"
  };
}

export function analyzeCalibration({ comparisons = [], feedback = [], revisions = [], assessments = [], incidents = [], manifest = null, timingObservations = [] } = {}) {
  const revealed = comparisons.filter(item => item.preferredAuthor);
  const paired = revealed.filter(item => item.ratings?.A && item.ratings?.B && item.authorMapping?.A && item.authorMapping?.B);
  const preferredPerlCount = revealed.filter(item => item.preferredAuthor === "perl-generated").length;
  const reviewerSet = new Set(paired.map(item => item.actor).filter(Boolean));
  const categories = ["factual-mismatch", "accuracy", "overreach", "tone", "evidence", "safety", "omission", "usefulness"];
  const correctionTaxonomy = Object.fromEntries(categories.map(category => [category, feedback.filter(item => item.reasons?.includes(category)).length]));
  const positionA = revealed.filter(item => item.authorMapping?.A === "perl-generated").length;
  const positionB = revealed.filter(item => item.authorMapping?.B === "perl-generated").length;
  const pairedPositionA = paired.filter(item => item.authorMapping.A === "perl-generated").length;
  const pairedPositionB = paired.filter(item => item.authorMapping.B === "perl-generated").length;
  const narrativeRevisions = revisions.filter(item => item.kind === "narrative");
  const interpretationRevisions = revisions.filter(item => item.kind === "interpretation");
  const minimumComparisons = 60;
  const minimumReviewers = 2;
  const minimumPositionAssignmentsPerGroup = 30;
  const minimumOverlappedCases = 30;
  const minimumTimedComparisons = 30;
  const highSeverityIncidents = incidents.filter(item => ["high", "critical"].includes(item.severity));
  const unresolvedHighSeverity = highSeverityIncidents.filter(item => item.status === "open");
  const safetyReady = unresolvedHighSeverity.length === 0;
  const completedBlindCaseIds = new Set(revealed.map(item => item.caseId).filter(Boolean));
  const exposedIncidents = incidents.filter(item => item.caseId && completedBlindCaseIds.has(item.caseId));
  const safetyCategories = [...new Set(exposedIncidents.map(item => item.category).filter(Boolean))].sort();
  const incidentExposure = revealed.length ? Number(((exposedIncidents.length / revealed.length) * 100).toFixed(2)) : null;
  const safetyByCategory = Object.fromEntries(safetyCategories.map(category => {
    const count = exposedIncidents.filter(item => item.category === category).length;
    return [category, {
      reportedEvents: count,
      eventsPer100CompletedComparisons: revealed.length ? Number(((count / revealed.length) * 100).toFixed(2)) : null
    }];
  }));
  const manifestedCases = Object.entries(manifest?.cases || {});
  const partitionCoverage = Object.fromEntries(["development", "holdout"].map(partition => {
    const caseIds = manifestedCases.filter(([, entry]) => entry.partition === partition).map(([id]) => id);
    const completed = paired.filter(item => item.partition === partition || caseIds.includes(item.assessmentId));
    return [partition, {
      cases: caseIds.length,
      reviewedCases: new Set(completed.map(item => item.assessmentId)).size,
      pairedComparisons: completed.length,
      reviewers: new Set(completed.map(item => item.actor).filter(Boolean)).size
    }];
  }));
  const stratumCoverage = Object.fromEntries((manifest?.targetStrata || []).map(stratum => {
    const caseIds = manifestedCases.filter(([, entry]) => entry.strata?.includes(stratum)).map(([id]) => id);
    const completed = paired.filter(item => item.strata?.includes(stratum) || caseIds.includes(item.assessmentId));
    return [stratum, {
      cases: caseIds.length,
      reviewedCases: new Set(completed.map(item => item.assessmentId)).size,
      pairedComparisons: completed.length,
      reviewers: new Set(completed.map(item => item.actor).filter(Boolean)).size
    }];
  }));
  const missingStrata = Object.entries(stratumCoverage).filter(([, coverage]) => coverage.cases === 0).map(([stratum]) => stratum);
  const caseSetReady = !manifest || (
    partitionCoverage.development.cases > 0
    && partitionCoverage.holdout.cases > 0
    && missingStrata.length === 0
  );
  const workflowCompleted = timingObservations.filter(item => WORKFLOW_TIMING_CONTRACT.conditions.includes(item.condition) && Number.isFinite(item.reviewTiming?.activeSeconds));
  const workflowEligible = workflowCompleted.filter(item => item.reviewTiming.eligible);
  const workflowByCondition = Object.fromEntries(WORKFLOW_TIMING_CONTRACT.conditions.map(condition => {
    const observed = workflowCompleted.filter(item => item.condition === condition);
    const eligible = workflowEligible.filter(item => item.condition === condition);
    return [condition, {
      captured: observed.length,
      eligible: eligible.length,
      flagged: observed.length - eligible.length,
      reviewers: new Set(observed.map(item => item.actor).filter(Boolean)).size,
      allObservedMinutes: describe(observed.map(item => Number((item.reviewTiming.activeSeconds / 60).toFixed(4)))),
      protocolEligibleMinutes: describe(eligible.map(item => Number((item.reviewTiming.activeSeconds / 60).toFixed(4)))),
      pausedSeconds: observed.reduce((sum, item) => sum + Number(item.reviewTiming.pausedSeconds || 0), 0)
    }];
  }));
  const workflowByCase = new Map();
  for (const observation of workflowEligible) {
    if (!workflowByCase.has(observation.assessmentId)) workflowByCase.set(observation.assessmentId, { unaided: [], "perl-assisted": [] });
    workflowByCase.get(observation.assessmentId)[observation.condition].push(observation);
  }
  const matchedWorkflowCases = [...workflowByCase.entries()].filter(([, conditions]) => conditions.unaided.length && conditions["perl-assisted"].length).map(([assessmentId, conditions]) => {
    const unaidedSeconds = mean(conditions.unaided.map(item => item.reviewTiming.activeSeconds));
    const assistedSeconds = mean(conditions["perl-assisted"].map(item => item.reviewTiming.activeSeconds));
    const differenceSeconds = unaidedSeconds - assistedSeconds;
    return {
      assessmentId,
      unaided: { n: conditions.unaided.length, meanMinutes: Number((unaidedSeconds / 60).toFixed(2)) },
      perlAssisted: { n: conditions["perl-assisted"].length, meanMinutes: Number((assistedSeconds / 60).toFixed(2)) },
      differenceMinutes: Number((differenceSeconds / 60).toFixed(2)),
      percentDifference: unaidedSeconds > 0 ? Number(((differenceSeconds / unaidedSeconds) * 100).toFixed(2)) : null,
      direction: "unaided minus PERL-assisted"
    };
  });
  const workflowTimingReady = workflowByCondition.unaided.eligible >= WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition
    && workflowByCondition["perl-assisted"].eligible >= WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition
    && matchedWorkflowCases.length >= WORKFLOW_TIMING_CONTRACT.minimumMatchedCases
    && safetyReady
    && caseSetReady;
  const timed = paired.filter(item => Number.isFinite(item.reviewTiming?.activeSeconds));
  const eligibleTimed = timed.filter(item => item.reviewTiming.eligible);
  const timingReady = eligibleTimed.length >= minimumTimedComparisons;
  const timingMinutes = items => describe(items.map(item => Number((item.reviewTiming.activeSeconds / 60).toFixed(4))));

  const ratingForAuthor = (comparison, author, key) => {
    const position = comparison.authorMapping.A === author ? "A" : "B";
    return comparison.ratings[position][key];
  };
  const pairedDescription = author => Object.fromEntries(
    ["accuracy", "restraint", "utility"].map(key => [key, describe(paired.map(item => ratingForAuthor(item, author, key)))])
  );
  const pairedDifference = Object.fromEntries(["accuracy", "restraint", "utility"].map(key => [key, describe(paired.map(item => (
    ratingForAuthor(item, "perl-generated", key) - ratingForAuthor(item, "human-reference", key)
  )))]));
  const byAssessment = new Map();
  for (const comparison of paired) {
    if (!comparison.assessmentId || !comparison.actor) continue;
    if (!byAssessment.has(comparison.assessmentId)) byAssessment.set(comparison.assessmentId, new Map());
    if (!byAssessment.get(comparison.assessmentId).has(comparison.actor)) byAssessment.get(comparison.assessmentId).set(comparison.actor, comparison);
  }
  let agreeingPairs = 0;
  let reviewerPairs = 0;
  let perlEndpoints = 0;
  let totalEndpoints = 0;
  let overlappedCases = 0;
  const absoluteRatingDifferences = Object.fromEntries(["perl-generated", "human-reference"].map(author => [
    author,
    Object.fromEntries(["accuracy", "restraint", "utility"].map(key => [key, []]))
  ]));
  for (const reviewers of byAssessment.values()) {
    const entries = [...reviewers.values()];
    if (entries.length < 2) continue;
    overlappedCases += 1;
    for (let left = 0; left < entries.length - 1; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const first = entries[left];
        const second = entries[right];
        reviewerPairs += 1;
        if (first.preferredAuthor === second.preferredAuthor) agreeingPairs += 1;
        perlEndpoints += Number(first.preferredAuthor === "perl-generated") + Number(second.preferredAuthor === "perl-generated");
        totalEndpoints += 2;
        for (const author of ["perl-generated", "human-reference"]) {
          for (const key of ["accuracy", "restraint", "utility"]) {
            absoluteRatingDifferences[author][key].push(Math.abs(ratingForAuthor(first, author, key) - ratingForAuthor(second, author, key)));
          }
        }
      }
    }
  }
  const agreementReady = overlappedCases >= minimumOverlappedCases && reviewerPairs >= minimumOverlappedCases;
  const inferenceReady = paired.length >= minimumComparisons
    && reviewerSet.size >= minimumReviewers
    && pairedPositionA >= minimumPositionAssignmentsPerGroup
    && pairedPositionB >= minimumPositionAssignmentsPerGroup
    && agreementReady
    && safetyReady
    && caseSetReady
    && timingReady;
  const ratingAgreement = Object.fromEntries(Object.entries(absoluteRatingDifferences).map(([author, values]) => [
    author === "perl-generated" ? "perlGenerated" : "counselorReference",
    Object.fromEntries(Object.entries(values).map(([key, differenceValues]) => [key, describe(differenceValues)]))
  ]));

  return {
    generatedAt: new Date().toISOString(),
    population: "synthetic calibration sandbox",
    clinicalValidation: false,
    status: inferenceReady ? "protocol-threshold-met" : "exploratory",
    inferenceReady,
    limitations: inferenceReady
      ? ["Threshold attainment does not replace the predeclared clinical analysis plan or independent review."]
      : [
          `At least ${minimumComparisons} completed paired blind comparisons are required before basic proportion inference is considered.`,
          `At least ${minimumReviewers} independent reviewers are required to reduce single-reviewer dependence.`,
          `At least ${minimumPositionAssignmentsPerGroup} PERL assignments in each A/B position are required to inspect position balance.`,
          `At least ${minimumOverlappedCases} cases require independent repeated review before inter-rater agreement is interpreted.`,
          ...(safetyReady ? [] : ["Every high-severity or critical safety incident must be resolved before protocol review can proceed."]),
          ...(caseSetReady ? [] : [`The frozen case set has no eligible case for declared strata: ${missingStrata.join(", ")}.`]),
          ...(timingReady ? [] : [`At least ${minimumTimedComparisons} protocol-eligible server-timed comparisons are required before review duration is interpreted.`]),
          ...(workflowTimingReady ? [] : [`Matched workflow timing remains blocked until each condition has ${WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition} eligible observations and at least ${WORKFLOW_TIMING_CONTRACT.minimumMatchedCases} cases have both conditions across independent reviewers.`]),
          "Synthetic cases do not establish clinical validity, reliability, or real-world safety."
        ],
    sample: {
      assessments: assessments.length,
      comparisons: comparisons.length,
      revealedComparisons: revealed.length,
      pairedComparisons: paired.length,
      overlappedCases,
      reviewerPairs,
      reviewers: reviewerSet.size,
      feedbackEntries: feedback.length,
      revisions: revisions.length,
      workflowTimingObservations: workflowCompleted.length
    },
    preference: {
      perlPreferred: preferredPerlCount,
      counselorPreferred: revealed.length - preferredPerlCount,
      perlRate: revealed.length ? Number((preferredPerlCount / revealed.length).toFixed(4)) : null,
      confidenceInterval: wilsonInterval(preferredPerlCount, revealed.length),
      perlPositionA: positionA,
      perlPositionB: positionB,
      pairedPerlPositionA: pairedPositionA,
      pairedPerlPositionB: pairedPositionB
    },
    ratings: {
      accuracy: describe(comparisons.map(item => item.accuracy)),
      restraint: describe(comparisons.map(item => item.restraint)),
      utility: describe(comparisons.map(item => item.utility)),
      selectedSummary: {
        accuracy: describe(comparisons.map(item => item.accuracy)),
        restraint: describe(comparisons.map(item => item.restraint)),
        utility: describe(comparisons.map(item => item.utility))
      },
      pairedCases: paired.length,
      byAuthor: {
        perlGenerated: pairedDescription("perl-generated"),
        counselorReference: pairedDescription("human-reference")
      },
      difference: pairedDifference,
      differenceDirection: "PERL minus counselor reference"
    },
    agreement: {
      ready: agreementReady,
      casesWithMultipleReviewers: overlappedCases,
      reviewerPairs,
      preference: binaryGwetAc1({ agreeingPairs, reviewerPairs, perlEndpoints, totalEndpoints }),
      ratingAbsoluteDifference: ratingAgreement,
      ratingDifferenceInterpretation: "Absolute difference across reviewer pairs; lower values indicate closer ratings."
    },
    safety: {
      ready: safetyReady,
      incidents: incidents.length,
      openIncidents: incidents.filter(item => item.status === "open").length,
      highSeverityReported: highSeverityIncidents.length,
      unresolvedHighSeverity: unresolvedHighSeverity.length,
      stoppingRule: "Any unresolved high-severity or critical incident pauses blind generation, submission, and approval.",
      exposure: {
        completedBlindComparisons: revealed.length,
        reportedEvents: exposedIncidents.length,
        eventsPer100CompletedComparisons: incidentExposure,
        eventsOutsideCompletedComparisonExposure: incidents.length - exposedIncidents.length,
        byCategory: safetyByCategory,
        interpretation: "Only incidents linked to a completed blind case enter this exposure rate. These are reported-event counts per completed comparison, not unique affected-case rates or estimates of clinical risk. Unlinked, assessment-review, and not-yet-completed case incidents are reported separately. Zero completed comparisons has no calculable rate."
      }
    },
    caseSet: manifest ? {
      id: manifest.id,
      version: manifest.version,
      status: manifest.status,
      frozenAt: manifest.frozenAt,
      holdoutValid: manifest.holdoutValid,
      ready: caseSetReady,
      missingStrata,
      claimBoundary: manifest.claimBoundary,
      cases: manifestedCases.length,
      assignmentEnabled: manifestedCases.filter(([, entry]) => entry.assignmentEnabled).length,
      partitionCoverage,
      stratumCoverage
    } : null,
    timing: {
      ready: timingReady,
      captured: timed.length,
      uncaptured: paired.length - timed.length,
      eligible: eligibleTimed.length,
      flagged: timed.length - eligibleTimed.length,
      allObservedMinutes: timingMinutes(timed),
      protocolEligibleMinutes: timingMinutes(eligibleTimed),
      pausedSeconds: timed.reduce((sum, item) => sum + Number(item.reviewTiming.pausedSeconds || 0), 0),
      eligibilityWindowSeconds: { minimum: 30, maximum: 2700 },
      measurement: "Server wall time from blind-case assignment to submission, less recorded study-pause intervals.",
      interpretation: "All observations are retained. This measures time to rate two finished summaries, not time to produce a clinician summary, and must not be used as a time-saving result. Use the separate matched workflow-timing study for that question."
    },
    workflowTiming: {
      contract: WORKFLOW_TIMING_CONTRACT.id,
      protocol: WORKFLOW_TIMING_CONTRACT.protocol,
      ready: workflowTimingReady,
      captured: workflowCompleted.length,
      conditions: workflowByCondition,
      matchedCases: matchedWorkflowCases.length,
      matchedCaseResults: matchedWorkflowCases,
      matchedDifferenceMinutes: describe(matchedWorkflowCases.map(item => item.differenceMinutes)),
      matchedPercentDifference: describe(matchedWorkflowCases.map(item => item.percentDifference)),
      assistedChangedTokens: describe(workflowCompleted.filter(item => item.condition === "perl-assisted").map(item => item.changedTokens)),
      thresholds: {
        minimumEligiblePerCondition: WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition,
        minimumMatchedCases: WORKFLOW_TIMING_CONTRACT.minimumMatchedCases,
        maximumUnresolvedHighSeverity: 0
      },
      eligibilityWindowSeconds: WORKFLOW_TIMING_CONTRACT.eligibilityWindowSeconds,
      measurement: "Server wall time from workflow assignment to final clinician summary submission, less recorded study-pause intervals.",
      assignmentBoundary: "Each reviewer sees a timing-study case once. Case-level condition overlap is created across independent reviewers to avoid within-reviewer case carryover.",
      interpretation: workflowTimingReady
        ? "The mechanical timing package is ready for the frozen independent analysis plan. This status is not evidence that PERL saves time."
        : `No time-saving claim is permitted. The rehearsal requires ${WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition} eligible observations in each condition, ${WORKFLOW_TIMING_CONTRACT.minimumMatchedCases} matched cases, complete strata, and no unresolved stopping event.`,
      claimBoundary: WORKFLOW_TIMING_CONTRACT.claimBoundary
    },
    correctionTaxonomy,
    revisionProfile: {
      narrative: narrativeRevisions.length,
      interpretation: interpretationRevisions.length,
      total: revisions.length,
      changedTokens: narrativeRevisions.reduce((sum, item) => sum + Number(item.change?.changedTokens || 0), 0),
      hypothesisSectionsChanged: interpretationRevisions.filter(item => item.changed?.includes("hypotheses")).length,
      questionSectionsChanged: interpretationRevisions.filter(item => item.changed?.includes("follow-up questions")).length
    },
    thresholds: { minimumComparisons, minimumReviewers, minimumPositionAssignmentsPerGroup, minimumOverlappedCases, minimumTimedComparisons, minimumWorkflowTimingPerCondition: WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition, minimumMatchedTimingCases: WORKFLOW_TIMING_CONTRACT.minimumMatchedCases, maximumUnresolvedHighSeverity: 0 }
  };
}
