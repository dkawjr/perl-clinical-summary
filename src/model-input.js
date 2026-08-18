const SCALE_KEYS = Object.freeze([
  "depression",
  "anxiety",
  "anger",
  "gpi",
  "phobicAvoidance",
  "obsessiveCompulsive",
  "psychoticism",
  "suicideRisk",
  "violenceRisk"
]);

export const MODEL_INPUT_CONTRACT = "perl-scored-profile/1.0";

/**
 * Produce the only object a summary provider is allowed to receive.
 *
 * Routing references, dates, reviewer identity, source-report references,
 * narrative evidence strings, and critical-item notes stay in the application
 * boundary. The provider receives scored constructs and bounded safety routing.
 */
export function projectModelInput(assessment) {
  const scales = Object.fromEntries(SCALE_KEYS.map(key => [key, assessment.scales?.[key]]));
  const scaleLevels = assessment.scaleLevels
    ? Object.fromEntries(SCALE_KEYS.map(key => [key, assessment.scaleLevels?.[key]]))
    : undefined;
  const projected = {
    itemsAnswered: assessment.itemsAnswered,
    scales,
    subscales: (assessment.subscales || []).map(item => ({
      label: item.label,
      domain: item.domain,
      score: item.score,
      level: item.level
    })),
    criticalResponses: (assessment.criticalResponses || []).map(item => ({
      item: item.item,
      score: item.score,
      directReviewRequired: item.directReviewRequired === true
    }))
  };
  if (scaleLevels) projected.scaleLevels = scaleLevels;
  return projected;
}

export { SCALE_KEYS as MODEL_SCALE_KEYS };
