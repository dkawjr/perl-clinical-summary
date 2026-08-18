import { createHash, randomUUID } from "node:crypto";
import { classifyScale } from "./engine.js";

export const PROGRESS_REVIEW_CONTRACT = "perl-synthetic-progress-review/1.0";
export const PROGRESS_BRIEF_CONTRACT = "perl-synthetic-progress-conversation-brief/1.0";

export const PROGRESS_REVIEW_BOUNDARY = "This Progress Review compares raw scores from a deliberately constructed pair of synthetic PERL fixtures for workflow rehearsal only. The pairing is not an authoritative subject, episode, or treatment-course link and contains no patient identity, clinician identity, narrative, raw response, Findings content, or PHI. A lower or higher raw score is a descriptive difference only: it does not establish improvement, deterioration, reliable or meaningful change, causality, treatment response, diagnosis, care-plan direction, clinical validity, pilot authority, production release, or patient-use permission. Every observation remains structured, local, non-authorizing, and subject to direct review of source evidence and safety screens.";

export const PROGRESS_BRIEF_BOUNDARY = "This generated conversation brief summarizes exact raw-score movement in a constructed synthetic pair and offers provider-facing questions in affirming language. It is not a clinical recommendation, progress note, diagnosis, treatment plan, or determination of improvement, deterioration, reliable change, meaningful change, causality, or treatment response. It cannot verify that the readings belong to one person or episode, replace direct source and safety review, establish clinical validity, authorize a pilot or production release, or permit patient use.";

export const PROGRESS_REVIEW_SERIES = Object.freeze({
  id: "FF-TEST-SERIES-01",
  label: "Constructed synthetic pair",
  sourceStatus: "synthetic-rehearsal-linkage-only",
  points: Object.freeze([
    Object.freeze({ order: 1, assessmentId: "FF-TEST-2388-B", label: "Earlier synthetic reading", marker: "Point 01" }),
    Object.freeze({ order: 2, assessmentId: "FF-TEST-2411-C", label: "Later synthetic reading", marker: "Point 02" })
  ])
});

export const PROGRESS_REVIEW_FOCI = Object.freeze([
  Object.freeze({ id: "depression", label: "Depression indicators" }),
  Object.freeze({ id: "anxiety", label: "Anxiety indicators" }),
  Object.freeze({ id: "anger", label: "Anger indicators" }),
  Object.freeze({ id: "global-distress", label: "Global distress index" }),
  Object.freeze({ id: "critical-screen", label: "Critical-screen route" }),
  Object.freeze({ id: "cross-domain-pattern", label: "Cross-domain pattern" })
]);

export const PROGRESS_REVIEW_FINDINGS = Object.freeze([
  Object.freeze({ id: "raw-score-lower", label: "Raw score lower" }),
  Object.freeze({ id: "raw-score-higher", label: "Raw score higher" }),
  Object.freeze({ id: "mixed-direction", label: "Mixed direction" }),
  Object.freeze({ id: "no-material-raw-movement", label: "No material raw movement" }),
  Object.freeze({ id: "incomparable-source-state", label: "Source state not comparable" }),
  Object.freeze({ id: "safety-change-requires-direct-review", label: "Safety change · direct review" })
]);

export const PROGRESS_REVIEW_DISPOSITIONS = Object.freeze([
  Object.freeze({ id: "carry-to-next-conversation", label: "Carry to next conversation" }),
  Object.freeze({ id: "clarify-context-before-interpretation", label: "Clarify context first" }),
  Object.freeze({ id: "reassess-source-and-safety", label: "Reassess source + safety" }),
  Object.freeze({ id: "exclude-as-incomparable", label: "Exclude as incomparable" })
]);

const CORE_SCALES = Object.freeze([
  Object.freeze({ id: "depression", label: "Depression", maximum: 104 }),
  Object.freeze({ id: "anxiety", label: "Anxiety", maximum: 116 }),
  Object.freeze({ id: "anger", label: "Anger", maximum: 112 }),
  Object.freeze({ id: "gpi", label: "Global distress", maximum: 420 })
]);

const FOCI = new Set(PROGRESS_REVIEW_FOCI.map(item => item.id));
const FINDINGS = new Set(PROGRESS_REVIEW_FINDINGS.map(item => item.id));
const DISPOSITIONS = new Set(PROGRESS_REVIEW_DISPOSITIONS.map(item => item.id));
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const HEX = /^[a-f0-9]{64}$/;

const FALSE_CLAIMS = Object.freeze([
  "authoritativeSubjectLinkage", "patientIdentityResolved", "clinicianIdentityVerified",
  "clinicalProgressEstablished", "improvementEstablished", "deteriorationEstablished",
  "treatmentResponseEstablished", "reliableChangeEstablished", "meaningfulChangeEstablished",
  "carePlanChanged", "clinicalDecisionAccepted", "clinicalValidation", "pilotAuthorized",
  "productionReleaseAuthorized", "patientUseAuthorized"
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
  if (unknown.length) errors.push(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function normalizedLabel(value) {
  return String(value || "").toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function assessmentSourceHash(assessment) {
  const { status, reviewer, ...scoredPayload } = assessment;
  return digest(scoredPayload);
}

function pointAssessment(assessments, point) {
  return assessments.find(assessment => assessment.id === point.assessmentId) || null;
}

function criticalRoute(assessment) {
  const criticalResponses = Array.isArray(assessment?.criticalResponses) ? assessment.criticalResponses : [];
  const suicide = Number(assessment?.scales?.suicideRisk || 0);
  const violence = Number(assessment?.scales?.violenceRisk || 0);
  const requiresDirectReview = suicide > 0 || violence > 0 || criticalResponses.some(item => Number(item.score || 0) > 0 || item.directReviewRequired === true);
  return {
    requiresDirectReview,
    nonZeroCriticalResponses: criticalResponses.filter(item => Number(item.score || 0) > 0 || item.directReviewRequired === true).length,
    suicideRiskRaw: suicide,
    violenceRiskRaw: violence
  };
}

function sentenceList(parts) {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}

export function buildProgressConversationBrief({ scales, points, sharedSubscales, seriesFingerprint, generatedAt }) {
  const lower = scales.filter(scale => scale.delta < 0);
  const higher = scales.filter(scale => scale.delta > 0);
  const flat = scales.filter(scale => scale.delta === 0);
  const movements = scales.map(scale => `${scale.label.toLowerCase()} ${signed(scale.delta)}`);
  const directionSentence = lower.length === scales.length
    ? `All four core raw scores are lower at Point 02: ${sentenceList(movements)}.`
    : higher.length === scales.length
      ? `All four core raw scores are higher at Point 02: ${sentenceList(movements)}.`
      : `The core raw scores move in a mixed pattern: ${sentenceList(movements)}.`;
  const directReviewPoints = points.filter(point => point.criticalRoute.requiresDirectReview);
  const safetyPrompt = directReviewPoints.length
    ? `${sentenceList(directReviewPoints.map(point => point.marker))} requires direct review of the source critical screen before the score pattern is discussed.`
    : "Neither synthetic point has an automated critical-screen hold; direct safety assessment still remains a clinical responsibility.";
  const summary = `Across this constructed synthetic pair, ${directionSentence} This is a descriptive score pattern, not evidence of improvement, deterioration, or treatment response. Before interpreting it, verify comparability and ask what changed in functioning, stressors, health, supports, and care context.`;
  const conversationPriorities = [
    {
      id: "person-account",
      label: "Begin with the person’s account",
      prompt: "Ask what feels different, what has helped, what remains hard, and whether the scores fit the person’s own experience.",
      evidence: ["Point 01 and Point 02 raw-score plate"]
    },
    {
      id: "function-context-strengths",
      label: "Connect scores to life and strengths",
      prompt: "Invite concrete examples of functioning, relationships, sleep, health, stressors, coping, support, and care exposure—without presuming the direction of change.",
      evidence: [`${sharedSubscales.length} like-label subscales available for contextual review`]
    },
    {
      id: "source-comparability",
      label: "Verify the comparison first",
      prompt: "Confirm subject and episode linkage, instrument and scoring version, timing, completion context, missingness, and material intervening events before drawing a longitudinal conclusion.",
      evidence: ["Series status · synthetic-rehearsal-linkage-only"]
    },
    {
      id: "safety-source-review",
      label: "Keep safety direct",
      prompt: safetyPrompt,
      evidence: points.map(point => `${point.marker} · ${point.criticalRoute.requiresDirectReview ? "direct review required" : "no automated hold"}`)
    }
  ];
  const core = {
    contractVersion: PROGRESS_BRIEF_CONTRACT,
    status: "generated-synthetic-rehearsal",
    generator: {
      id: "deterministic-progress-baseline",
      version: "progress-brief-0.1.0",
      mode: "rules",
      externalTransmission: false
    },
    sourceSeriesFingerprint: seriesFingerprint,
    sourceStatus: "synthetic-rehearsal-linkage-only",
    headline: "Let the person’s account explain the line.",
    summary,
    affirmingOpening: "Start with the person’s account: what feels different, what has helped, and what remains hard?",
    evidence: scales.map(scale => ({
      scale: scale.id,
      label: scale.label,
      earlier: scale.earlier,
      later: scale.later,
      delta: scale.delta,
      direction: scale.direction
    })),
    conversationPriorities,
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    clinicalRecommendationCreated: false,
    progressNoteCreated: false,
    boundary: PROGRESS_BRIEF_BOUNDARY
  };
  return { ...core, fingerprint: digest(core), generatedAt };
}

export function validateProgressConversationBrief(brief) {
  const errors = [];
  const keys = [
    "contractVersion", "status", "generator", "sourceSeriesFingerprint", "sourceStatus", "headline", "summary",
    "affirmingOpening", "evidence", "conversationPriorities", ...FALSE_CLAIMS, "clinicalRecommendationCreated",
    "progressNoteCreated", "boundary", "fingerprint", "generatedAt"
  ];
  if (!exactKeys(brief, keys, "Progress conversation brief", errors)) return errors;
  if (brief.contractVersion !== PROGRESS_BRIEF_CONTRACT || brief.status !== "generated-synthetic-rehearsal") errors.push("Progress conversation brief identity is invalid.");
  if (!brief.generator || Object.keys(brief.generator).sort().join(",") !== "externalTransmission,id,mode,version" || brief.generator.mode !== "rules" || brief.generator.externalTransmission !== false) errors.push("Progress conversation brief generator provenance is invalid.");
  if (!HEX.test(String(brief.sourceSeriesFingerprint || "")) || !HEX.test(String(brief.fingerprint || ""))) errors.push("Progress conversation brief fingerprints are invalid.");
  if (brief.sourceStatus !== "synthetic-rehearsal-linkage-only") errors.push("Progress conversation brief source status must remain rehearsal-only.");
  if (typeof brief.summary !== "string" || brief.summary.length < 300 || !/not evidence of improvement/i.test(brief.summary)) errors.push("Progress conversation brief summary boundary is incomplete.");
  if (typeof brief.affirmingOpening !== "string" || !/person.s account/i.test(brief.affirmingOpening)) errors.push("Progress conversation brief affirming opening is missing.");
  if (!Array.isArray(brief.evidence) || brief.evidence.length !== 4 || brief.evidence.some(item => !Number.isFinite(item.delta))) errors.push("Progress conversation brief must expose four exact score movements.");
  if (!Array.isArray(brief.conversationPriorities) || brief.conversationPriorities.length !== 4 || brief.conversationPriorities.some(item => !item.id || !item.label || !item.prompt || !Array.isArray(item.evidence))) errors.push("Progress conversation brief must expose four evidence-linked conversation priorities.");
  for (const key of FALSE_CLAIMS) if (brief[key] !== false) errors.push(`${key} must remain false.`);
  if (brief.clinicalRecommendationCreated !== false || brief.progressNoteCreated !== false) errors.push("Progress conversation brief cannot create a recommendation or progress note.");
  if (typeof brief.boundary !== "string" || brief.boundary.length < 480 || !/not a clinical recommendation/i.test(brief.boundary)) errors.push("Progress conversation brief claim boundary is incomplete.");
  const { fingerprint, generatedAt, ...core } = brief;
  if (digest(core) !== fingerprint) errors.push("Progress conversation brief fingerprint is invalid.");
  if (Number.isNaN(Date.parse(generatedAt))) errors.push("Progress conversation brief generatedAt is invalid.");
  return [...new Set(errors)];
}

export function validateProgressReviewContract() {
  const errors = [];
  if (PROGRESS_REVIEW_SERIES.points.length !== 2) errors.push("Progress Review requires exactly two frozen synthetic points.");
  if (new Set(PROGRESS_REVIEW_SERIES.points.map(point => point.assessmentId)).size !== 2) errors.push("Progress Review point identities must be unique.");
  if (PROGRESS_REVIEW_SERIES.sourceStatus !== "synthetic-rehearsal-linkage-only") errors.push("Progress Review source status must remain rehearsal-only.");
  if (CORE_SCALES.length !== 4 || PROGRESS_REVIEW_FOCI.length !== 6 || PROGRESS_REVIEW_FINDINGS.length !== 6 || PROGRESS_REVIEW_DISPOSITIONS.length !== 4) errors.push("Progress Review option registers are incomplete.");
  if (PROGRESS_REVIEW_BOUNDARY.length < 650 || !/does not establish improvement/i.test(PROGRESS_REVIEW_BOUNDARY) || !/not an authoritative subject/i.test(PROGRESS_REVIEW_BOUNDARY)) errors.push("Progress Review boundary is incomplete.");
  return errors;
}

export function validateProgressReviewInput(input) {
  const errors = [];
  const keys = ["seriesId", "focus", "finding", "disposition"];
  if (!exactKeys(input, keys, "Progress observation", errors)) return errors;
  if (input.seriesId !== PROGRESS_REVIEW_SERIES.id) errors.push("seriesId must name the frozen synthetic rehearsal series.");
  if (!FOCI.has(input.focus)) errors.push("focus is outside the fixed clinical-focus register.");
  if (!FINDINGS.has(input.finding)) errors.push("finding is outside the fixed descriptive-finding register.");
  if (!DISPOSITIONS.has(input.disposition)) errors.push("disposition is outside the fixed next-conversation register.");
  return [...new Set(errors)];
}

function validateEvidenceSnapshot(snapshot, errors) {
  const keys = ["seriesFingerprint", "assessmentSources", "coreDeltas", "criticalRoutes"];
  if (!exactKeys(snapshot, keys, "evidenceSnapshot", errors)) return;
  if (!HEX.test(String(snapshot.seriesFingerprint || ""))) errors.push("evidenceSnapshot.seriesFingerprint must be a SHA-256 digest.");
  if (!Array.isArray(snapshot.assessmentSources) || snapshot.assessmentSources.length !== 2) {
    errors.push("evidenceSnapshot.assessmentSources must pin two source assessments.");
  } else {
    snapshot.assessmentSources.forEach((source, index) => {
      const sourceErrors = [];
      if (exactKeys(source, ["assessmentId", "sourceHash"], `evidenceSnapshot.assessmentSources[${index}]`, sourceErrors)) {
        if (source.assessmentId !== PROGRESS_REVIEW_SERIES.points[index].assessmentId) sourceErrors.push(`evidenceSnapshot.assessmentSources[${index}] assessment ID is not frozen.`);
        if (!HEX.test(String(source.sourceHash || ""))) sourceErrors.push(`evidenceSnapshot.assessmentSources[${index}].sourceHash must be a SHA-256 digest.`);
      }
      errors.push(...sourceErrors);
    });
  }
  if (!Array.isArray(snapshot.coreDeltas) || snapshot.coreDeltas.length !== 4 || snapshot.coreDeltas.some(item => !CORE_SCALES.some(scale => scale.id === item.scale) || !Number.isFinite(item.delta))) errors.push("evidenceSnapshot.coreDeltas must pin four numeric raw-score deltas.");
  if (!Array.isArray(snapshot.criticalRoutes) || snapshot.criticalRoutes.length !== 2 || snapshot.criticalRoutes.some(item => typeof item.requiresDirectReview !== "boolean")) errors.push("evidenceSnapshot.criticalRoutes must pin two deterministic safety routes.");
}

export function createProgressReviewObservation({ input, actor, sequence, previousHash = "GENESIS", evidenceSnapshot, createdAt = new Date().toISOString(), id = randomUUID() }) {
  const inputErrors = validateProgressReviewInput(input);
  if (inputErrors.length) throw new Error(inputErrors.join(" "));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: PROGRESS_REVIEW_CONTRACT,
    type: "synthetic-progress-rehearsal-observation-recorded",
    ...clone(input),
    evidenceSnapshot: clone(evidenceSnapshot),
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    actor,
    createdAt,
    note: "Structured raw-score observation recorded against a constructed synthetic pair without subject linkage, identity, clinical progress, improvement, deterioration, treatment-response, care-plan, validation, or release authority."
  };
  return { ...core, hash: digest(core) };
}

export function validateProgressReviewObservation(entry, { sequence = entry?.sequence, previousHash = entry?.previousHash } = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "seriesId", "focus", "finding",
    "disposition", "evidenceSnapshot", ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(entry, keys, "Progress observation event", errors)) return errors;
  errors.push(...validateProgressReviewInput({ seriesId: entry.seriesId, focus: entry.focus, finding: entry.finding, disposition: entry.disposition }));
  if (entry.contractVersion !== PROGRESS_REVIEW_CONTRACT) errors.push("Progress Review contract version is invalid.");
  if (entry.type !== "synthetic-progress-rehearsal-observation-recorded") errors.push("Progress Review event type is invalid.");
  if (!/^[0-9a-f-]{20,40}$/i.test(String(entry.id || ""))) errors.push("Progress Review event ID is invalid.");
  if (entry.sequence !== sequence || !Number.isInteger(entry.sequence) || entry.sequence < 1) errors.push("Progress Review event sequence is invalid.");
  if (entry.previousHash !== previousHash || (entry.previousHash !== "GENESIS" && !HEX.test(String(entry.previousHash || "")))) errors.push("Progress Review previous hash is invalid.");
  validateEvidenceSnapshot(entry.evidenceSnapshot, errors);
  for (const key of FALSE_CLAIMS) if (entry[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(entry.actor || ""))) errors.push("Progress Review actor must be a bounded reviewer code.");
  if (Number.isNaN(Date.parse(entry.createdAt))) errors.push("Progress Review createdAt is invalid.");
  if (typeof entry.note !== "string" || entry.note.length < 150 || !/without subject linkage/i.test(entry.note)) errors.push("Progress Review note boundary is incomplete.");
  const { hash, ...core } = entry;
  if (!HEX.test(String(hash || "")) || digest(core) !== hash) errors.push("Progress Review event hash is invalid.");
  return [...new Set(errors)];
}

export function buildProgressReview({ assessments = [], observations = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const pointAssessments = PROGRESS_REVIEW_SERIES.points.map(point => pointAssessment(assessments, point));
  const missingAssessmentIds = PROGRESS_REVIEW_SERIES.points.filter((point, index) => !pointAssessments[index]).map(point => point.assessmentId);
  if (missingAssessmentIds.length) throw new Error(`Progress Review synthetic source is incomplete: ${missingAssessmentIds.join(", ")}.`);

  const points = PROGRESS_REVIEW_SERIES.points.map((point, index) => ({
    ...clone(point),
    sourceHash: assessmentSourceHash(pointAssessments[index]),
    criticalRoute: criticalRoute(pointAssessments[index])
  }));
  const scales = CORE_SCALES.map(scale => {
    const earlier = Number(pointAssessments[0].scales?.[scale.id]);
    const later = Number(pointAssessments[1].scales?.[scale.id]);
    const delta = later - earlier;
    return {
      ...clone(scale),
      earlier,
      later,
      delta,
      direction: delta < 0 ? "raw-score-lower" : delta > 0 ? "raw-score-higher" : "no-raw-movement",
      earlierLevel: classifyScale(scale.id, earlier),
      laterLevel: classifyScale(scale.id, later)
    };
  });
  const earlierSubscales = new Map(pointAssessments[0].subscales.map(item => [normalizedLabel(item.label), item]));
  const laterSubscales = new Map(pointAssessments[1].subscales.map(item => [normalizedLabel(item.label), item]));
  const sharedSubscales = [...earlierSubscales.entries()].filter(([key]) => laterSubscales.has(key)).map(([, earlierItem]) => {
    const laterItem = laterSubscales.get(normalizedLabel(earlierItem.label));
    return {
      label: earlierItem.label,
      domain: earlierItem.domain,
      earlier: Number(earlierItem.score),
      later: Number(laterItem.score),
      delta: Number(laterItem.score) - Number(earlierItem.score)
    };
  });
  const seriesCore = {
    contractVersion: PROGRESS_REVIEW_CONTRACT,
    series: PROGRESS_REVIEW_SERIES,
    assessmentSources: points.map(point => ({ assessmentId: point.assessmentId, sourceHash: point.sourceHash }))
  };
  const seriesFingerprint = digest(seriesCore);
  const brief = buildProgressConversationBrief({ scales, points, sharedSubscales, seriesFingerprint, generatedAt });
  const briefErrors = validateProgressConversationBrief(brief);
  if (briefErrors.length) throw new Error(`Progress conversation brief is invalid: ${briefErrors.join(" ")}`);
  const latest = observations.at(-1) || null;
  return {
    contractVersion: PROGRESS_REVIEW_CONTRACT,
    status: observations.length ? "local-observations-recorded" : "ready-for-synthetic-rehearsal",
    series: { ...clone(PROGRESS_REVIEW_SERIES), points },
    seriesFingerprint,
    brief,
    scales,
    sharedSubscales,
    criticalRoutes: points.map(point => ({ marker: point.marker, ...point.criticalRoute })),
    focusOptions: clone(PROGRESS_REVIEW_FOCI),
    findingOptions: clone(PROGRESS_REVIEW_FINDINGS),
    dispositionOptions: clone(PROGRESS_REVIEW_DISPOSITIONS),
    metrics: {
      timepoints: points.length,
      coreScales: scales.length,
      sharedSubscales: sharedSubscales.length,
      observationsRecorded: observations.length,
      directReviewPoints: points.filter(point => point.criticalRoute.requiresDirectReview).length
    },
    latestObservation: clone(latest),
    history: clone(observations),
    chain: clone(chain),
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    generatedAt,
    headline: "Two readings. One cautious question.",
    descriptor: "Raw movement is visible; meaning still belongs to context.",
    boundary: PROGRESS_REVIEW_BOUNDARY
  };
}

export function progressReviewEvidenceSnapshot(progressReview) {
  return {
    seriesFingerprint: progressReview.seriesFingerprint,
    assessmentSources: progressReview.series.points.map(point => ({ assessmentId: point.assessmentId, sourceHash: point.sourceHash })),
    coreDeltas: progressReview.scales.map(scale => ({ scale: scale.id, delta: scale.delta })),
    criticalRoutes: progressReview.series.points.map(point => ({ marker: point.marker, requiresDirectReview: point.criticalRoute.requiresDirectReview }))
  };
}
