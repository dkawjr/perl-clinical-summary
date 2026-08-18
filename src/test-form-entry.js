const SCORE_FIELDS = Object.freeze({
  depression: 104,
  anxiety: 116,
  anger: 112,
  gpi: 420,
  phobicAvoidance: 40,
  obsessiveCompulsive: 40,
  psychoticism: 40,
  suicideRisk: 8,
  violenceRisk: 8
});

const SUBSCALE_FIELDS = Object.freeze([
  { id: "dysphoria", label: "Dysphoria", domain: "Depression" },
  { id: "negative-cognition", label: "Negative cognition", domain: "Depression" },
  { id: "anhedonia", label: "Anhedonia", domain: "Depression" },
  { id: "apprehension", label: "Apprehension", domain: "Anxiety" },
  { id: "physiological-arousal", label: "Physiological arousal", domain: "Anxiety" },
  { id: "anger-out-verbal", label: "Anger-out verbal", domain: "Anger" }
]);

function boundedInteger(value, field, maximum) {
  const text = String(value ?? "").trim();
  const score = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(score) || score < 0 || score > maximum) {
    throw new TypeError(`${field} must be a whole number from 0 to ${maximum}.`);
  }
  return score;
}

function normalizeRecordId(value, now) {
  const entered = String(value ?? "").trim().toUpperCase();
  const candidate = entered
    ? (entered.startsWith("FF-TEST-") ? entered : `FF-TEST-${entered}`)
    : `FF-TEST-${now.toISOString().replaceAll(/[^0-9]/g, "").slice(2, 14)}`;
  if (!/^FF-TEST-[A-Z0-9-]+$/.test(candidate) || candidate.length > 64) {
    throw new TypeError("Test record ID may use letters, numbers, and hyphens only.");
  }
  return candidate;
}

function normalizeDuration(value) {
  const duration = String(value || "10:00").trim();
  if (!/^\d{2}:\d{2}$/.test(duration)) throw new TypeError("Response time must use MM:SS, for example 09:42.");
  return duration;
}

function normalizeLevel(value, label) {
  const level = String(value || "").trim().toLowerCase();
  if (!["minimal", "mild", "moderate", "severe"].includes(level)) {
    throw new TypeError(`${label} needs a severity level.`);
  }
  return level;
}

export function buildSyntheticAssessmentFromScoreForm(values, { now = new Date() } = {}) {
  if (!values || typeof values !== "object") throw new TypeError("Scored test-form values are required.");
  const scales = Object.fromEntries(Object.entries(SCORE_FIELDS).map(([key, maximum]) => [
    key,
    boundedInteger(values[key], key, maximum)
  ]));
  const subscales = SUBSCALE_FIELDS.map(field => ({
    label: field.label,
    domain: field.domain,
    score: boundedInteger(values[`subscale-${field.id}-score`], field.label, 120),
    level: normalizeLevel(values[`subscale-${field.id}-level`], field.label),
    evidence: "Synthetic test form · manually transcribed scored output"
  }));
  const criticalResponses = [
    scales.suicideRisk > 0 ? {
      item: "Suicide-risk screen",
      score: scales.suicideRisk,
      directReviewRequired: true,
      note: "Non-zero synthetic scored field; source wording is not stored."
    } : null,
    scales.violenceRisk > 0 ? {
      item: "Violence-risk screen",
      score: scales.violenceRisk,
      directReviewRequired: true,
      note: "Non-zero synthetic scored field; source wording is not stored."
    } : null
  ].filter(Boolean);

  return {
    id: normalizeRecordId(values.recordId, now),
    completedAt: String(values.completedAt || "Today · test entry").trim().slice(0, 120) || "Today · test entry",
    duration: normalizeDuration(values.duration),
    status: criticalResponses.length ? "priority" : "ready",
    reviewer: "Unassigned",
    source: "PERL hosted synthetic scored-form entry",
    itemsAnswered: 105,
    scales,
    subscales,
    criticalResponses
  };
}

export const TEST_FORM_ENTRY_CONTRACT = Object.freeze({
  scoreFields: SCORE_FIELDS,
  subscales: SUBSCALE_FIELDS,
  acceptsRawResponses: false,
  acceptsIdentifiers: false,
  syntheticOnly: true
});
