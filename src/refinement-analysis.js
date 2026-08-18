export const REFINEMENT_CONTRACT = Object.freeze({
  id: "perl-refinement-brief/1.0",
  minimumIndependentCases: 3,
  minimumIndependentReviewers: 2,
  claimBoundary: "A repeated sandbox signal may scope a loaded change candidate. It may not change clinical logic automatically, establish clinical validity, or authorize release."
});

const FEEDBACK_TARGETS = Object.freeze({
  "factual-mismatch": {
    title: "Factual grounding needs attention",
    improvementTarget: "Constrain narrative claims to values and indicators present in the scored source projection.",
    regressionFocus: "Source-to-claim traceability and invented-fact checks"
  },
  accuracy: {
    title: "Clinical accuracy needs attention",
    improvementTarget: "Review the score-to-language mapping and preserve qualified, evidence-bounded interpretation.",
    regressionFocus: "Counselor-rated accuracy on frozen cases"
  },
  overreach: {
    title: "Diagnostic restraint needs attention",
    improvementTarget: "Strengthen uncertainty language and remove conclusions not supported by the scored profile.",
    regressionFocus: "Diagnostic restraint and prohibited-language checks"
  },
  tone: {
    title: "Clinical tone needs refinement",
    improvementTarget: "Use concise, respectful clinical language without minimizing concern or overstating certainty.",
    regressionFocus: "Counselor-rated utility and qualitative tone review"
  },
  evidence: {
    title: "Evidence linkage needs attention",
    improvementTarget: "Require every interpretation hypothesis to retain explicit scored-domain provenance.",
    regressionFocus: "Evidence lineage completeness"
  },
  safety: {
    title: "Safety handling needs escalation",
    improvementTarget: "Review deterministic hold logic and the narrative treatment of critical-screen responses.",
    regressionFocus: "Critical-screen gating and omission checks"
  },
  omission: {
    title: "Important content is being omitted",
    improvementTarget: "Review inclusion rules for clinically material scored signals and required follow-up prompts.",
    regressionFocus: "Eligible-signal coverage on frozen cases"
  },
  usefulness: {
    title: "Counselor usefulness needs refinement",
    improvementTarget: "Improve summary structure and follow-up prompts while preserving evidence and restraint.",
    regressionFocus: "Counselor-rated utility on frozen cases"
  }
});

const COMPARISON_TARGETS = Object.freeze({
  accuracy: {
    title: "PERL trails the counselor reference on accuracy",
    improvementTarget: "Inspect recurring score-to-language differences before changing the loaded model or rules.",
    regressionFocus: "Paired accuracy rating difference"
  },
  restraint: {
    title: "PERL trails the counselor reference on restraint",
    improvementTarget: "Inspect over-interpretation patterns and strengthen qualified language where the source is ambiguous.",
    regressionFocus: "Paired restraint rating difference"
  },
  utility: {
    title: "PERL trails the counselor reference on utility",
    improvementTarget: "Inspect structure, prioritization, and follow-up usefulness without adding unsupported clinical claims.",
    regressionFocus: "Paired utility rating difference"
  }
});

const REVISION_TARGETS = Object.freeze({
  narrative: {
    title: "Generated narratives require repeated rewriting",
    improvementTarget: "Review recurring edit patterns before revising the loaded summary model or rules.",
    regressionFocus: "Narrative changed-token burden"
  },
  interpretation: {
    title: "Structured interpretations require repeated revision",
    improvementTarget: "Review recurring hypothesis and follow-up corrections while retaining scored evidence links.",
    regressionFocus: "Hypothesis and follow-up revision frequency"
  }
});

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function readiness({ caseIds, reviewers, safetyEscalation = false, blockedBySafety = false }) {
  if (safetyEscalation || blockedBySafety) {
    return {
      status: "safety-escalation",
      candidateEligible: false,
      nextEvidence: "Resolve the linked high-severity safety event before any candidate can advance."
    };
  }
  const missingCases = Math.max(0, REFINEMENT_CONTRACT.minimumIndependentCases - caseIds.length);
  const missingReviewers = Math.max(0, REFINEMENT_CONTRACT.minimumIndependentReviewers - reviewers.length);
  if (!missingCases && !missingReviewers) {
    return {
      status: "evidence-threshold-met",
      candidateEligible: true,
      nextEvidence: "The signal may scope a loaded sandbox candidate; independent clinical review remains required."
    };
  }
  const needs = [];
  if (missingCases) needs.push(`${missingCases} more independent case${missingCases === 1 ? "" : "s"}`);
  if (missingReviewers) needs.push(`${missingReviewers} more reviewer${missingReviewers === 1 ? "" : "s"}`);
  return {
    status: "collect-more-evidence",
    candidateEligible: false,
    nextEvidence: `Collect ${needs.join(" and ")} before using this pattern to scope a change candidate.`
  };
}

function signal({ id, sourceType, title, improvementTarget, regressionFocus, entries, caseIdFor, actorFor, blockedBySafety = false, safetyEscalation = false, metric = null }) {
  const caseIds = unique(entries.map(caseIdFor));
  const reviewers = unique(entries.map(actorFor));
  const evidenceIds = unique(entries.map(entry => entry.id || entry.hash));
  return {
    id,
    sourceType,
    component: "model",
    title,
    improvementTarget,
    regressionFocus,
    evidenceCount: entries.length,
    caseIds,
    reviewers,
    evidenceIds,
    metric,
    ...readiness({ caseIds, reviewers, blockedBySafety, safetyEscalation }),
    clinicalValidation: false
  };
}

function authorRating(comparison, author, dimension) {
  const position = comparison.authorMapping?.A === author ? "A" : comparison.authorMapping?.B === author ? "B" : null;
  return position ? Number(comparison.ratings?.[position]?.[dimension]) : NaN;
}

function rank(signalItem) {
  if (signalItem.status === "safety-escalation") return 0;
  if (signalItem.status === "evidence-threshold-met") return 1;
  return 2;
}

export function buildRefinementBrief({ feedback = [], revisions = [], comparisons = [], incidents = [], manifest = null, generatedAt = new Date().toISOString() } = {}) {
  const unresolvedHighSeverity = incidents.filter(item => item.status === "open" && ["high", "critical"].includes(item.severity));
  const signals = [];

  for (const [category, target] of Object.entries(FEEDBACK_TARGETS)) {
    const entries = feedback.filter(item => item.reasons?.includes(category));
    if (!entries.length) continue;
    signals.push(signal({
      id: `feedback:${category}`,
      sourceType: "reviewer-feedback",
      ...target,
      entries,
      caseIdFor: entry => entry.assessmentId,
      actorFor: entry => entry.actor,
      blockedBySafety: unresolvedHighSeverity.length > 0,
      safetyEscalation: category === "safety"
    }));
  }

  for (const [dimension, target] of Object.entries(COMPARISON_TARGETS)) {
    const entries = comparisons.filter(item => {
      const perl = authorRating(item, "perl-generated", dimension);
      const counselor = authorRating(item, "human-reference", dimension);
      return Number.isFinite(perl) && Number.isFinite(counselor) && perl < counselor;
    });
    if (!entries.length) continue;
    const differences = entries.map(item => authorRating(item, "perl-generated", dimension) - authorRating(item, "human-reference", dimension));
    signals.push(signal({
      id: `comparison-gap:${dimension}`,
      sourceType: "blind-comparison",
      ...target,
      entries,
      caseIdFor: entry => entry.assessmentId,
      actorFor: entry => entry.actor,
      blockedBySafety: unresolvedHighSeverity.length > 0,
      metric: {
        direction: "PERL minus counselor reference",
        meanDifference: Number((differences.reduce((sum, value) => sum + value, 0) / differences.length).toFixed(2))
      }
    }));
  }

  for (const [kind, target] of Object.entries(REVISION_TARGETS)) {
    const entries = revisions.filter(item => item.kind === kind);
    if (!entries.length) continue;
    const metric = kind === "narrative"
      ? { changedTokens: entries.reduce((sum, entry) => sum + Number(entry.change?.changedTokens || 0), 0) }
      : {
          hypothesisRevisions: entries.filter(entry => entry.changed?.includes("hypotheses")).length,
          followUpRevisions: entries.filter(entry => entry.changed?.includes("follow-up questions")).length
        };
    signals.push(signal({
      id: `revision:${kind}`,
      sourceType: "reviewer-revision",
      ...target,
      entries,
      caseIdFor: entry => entry.assessmentId,
      actorFor: entry => entry.actor,
      blockedBySafety: unresolvedHighSeverity.length > 0,
      metric
    }));
  }

  const incidentCategories = unique(incidents.map(item => item.category));
  for (const category of incidentCategories) {
    const entries = incidents.filter(item => item.category === category);
    const openHigh = entries.some(item => item.status === "open" && ["high", "critical"].includes(item.severity));
    signals.push(signal({
      id: `incident:${category}`,
      sourceType: "safety-incident",
      title: `Safety review: ${category.replaceAll("-", " ")}`,
      improvementTarget: "Resolve the incident and inspect the implicated safety control before any model or rule change advances.",
      regressionFocus: "Linked safety incident and deterministic stopping rule",
      entries,
      caseIdFor: entry => entry.assessmentId,
      actorFor: entry => entry.reportedBy || entry.actor,
      safetyEscalation: openHigh,
      blockedBySafety: unresolvedHighSeverity.length > 0,
      metric: {
        open: entries.filter(item => item.status === "open").length,
        highOrCritical: entries.filter(item => ["high", "critical"].includes(item.severity)).length
      }
    }));
  }

  signals.sort((left, right) => rank(left) - rank(right) || right.evidenceCount - left.evidenceCount || left.id.localeCompare(right.id));
  const eligibleSignals = signals.filter(item => item.candidateEligible).length;
  const observedCases = unique(signals.flatMap(item => item.caseIds));
  const observedReviewers = unique(signals.flatMap(item => item.reviewers));
  const manifestedCases = Object.keys(manifest?.cases || {});

  return {
    contract: REFINEMENT_CONTRACT.id,
    generatedAt,
    population: "synthetic calibration sandbox",
    clinicalValidation: false,
    status: unresolvedHighSeverity.length ? "safety-paused" : signals.length ? "signals-observed" : "awaiting-reviewer-evidence",
    thresholds: {
      minimumIndependentCases: REFINEMENT_CONTRACT.minimumIndependentCases,
      minimumIndependentReviewers: REFINEMENT_CONTRACT.minimumIndependentReviewers
    },
    sourceCounts: {
      feedbackEntries: feedback.length,
      revisions: revisions.length,
      pairedComparisons: comparisons.filter(item => item.ratings?.A && item.ratings?.B && item.authorMapping?.A && item.authorMapping?.B).length,
      incidents: incidents.length,
      manifestedCases: manifestedCases.length
    },
    coverage: {
      observedCases: observedCases.length,
      observedReviewers: observedReviewers.length,
      signals: signals.length,
      eligibleSignals,
      unresolvedHighSeverity: unresolvedHighSeverity.length
    },
    signals,
    method: "Deterministic clustering of structured reviewer returns, revisions, paired blind-rating gaps, and safety events. Notes are not interpreted and no model changes are made.",
    claimBoundary: REFINEMENT_CONTRACT.claimBoundary
  };
}
