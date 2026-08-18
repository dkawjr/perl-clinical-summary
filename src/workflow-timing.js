import { resolveScaleLevel, riskDisposition, validateNarrative } from "./engine.js";

export const WORKFLOW_TIMING_CONTRACT = Object.freeze({
  id: "perl-workflow-timing/1.0",
  protocol: "workflow-timing-v1",
  conditions: Object.freeze(["unaided", "perl-assisted"]),
  pendingHours: 4,
  eligibilityWindowSeconds: Object.freeze({ minimum: 30, maximum: 45 * 60 }),
  minimumEligiblePerCondition: 30,
  minimumMatchedCases: 20,
  maximumSummaryCharacters: 1500,
  minimumSummaryCharacters: 80,
  sourceProjection: "scored-profile-v1",
  claimBoundary: "Synthetic workflow rehearsal only. A completed observation or mechanical threshold does not establish time saved, clinical validity, or production readiness."
});

const SCALE_LABELS = Object.freeze({
  depression: "Depression",
  anxiety: "Anxiety",
  anger: "Anger",
  gpi: "Global index",
  phobicAvoidance: "Phobic avoidance",
  obsessiveCompulsive: "Obsessive-compulsive",
  psychoticism: "Psychoticism",
  suicideRisk: "Suicide risk",
  violenceRisk: "Violence risk"
});

export function workflowSourceProfile(assessment) {
  const disposition = riskDisposition(assessment);
  return {
    projection: WORKFLOW_TIMING_CONTRACT.sourceProjection,
    assessmentId: assessment.id,
    completedAt: assessment.completedAt,
    itemsAnswered: assessment.itemsAnswered,
    source: assessment.source,
    scales: Object.entries(SCALE_LABELS).map(([key, label]) => ({
      key,
      label,
      score: assessment.scales[key],
      level: resolveScaleLevel(assessment, key)
    })),
    subscales: (assessment.subscales || []).map(item => ({
      label: item.label,
      domain: item.domain,
      score: item.score,
      level: item.level || null,
      evidence: item.evidence
    })),
    safety: {
      directReviewRequired: disposition.requiresReview,
      highlightedResponses: assessment.criticalResponses?.length || 0,
      instruction: disposition.requiresReview
        ? "A non-zero critical screen requires direct source review and must be surfaced in the final summary."
        : "No non-zero critical screen is present; routine clinical verification remains required."
    },
    boundary: "Scored synthetic source profile only. No respondent identity, raw response text, counselor reference, or generated interpretation is included."
  };
}

export function validateWorkflowSummary(text) {
  const value = String(text || "").trim();
  const errors = validateNarrative(value);
  if (value.length < WORKFLOW_TIMING_CONTRACT.minimumSummaryCharacters) {
    errors.push(`The timed clinician summary must contain at least ${WORKFLOW_TIMING_CONTRACT.minimumSummaryCharacters} characters.`);
  }
  if (value.length > WORKFLOW_TIMING_CONTRACT.maximumSummaryCharacters) {
    errors.push(`The timed clinician summary must contain no more than ${WORKFLOW_TIMING_CONTRACT.maximumSummaryCharacters} characters.`);
  }
  return [...new Set(errors)];
}
