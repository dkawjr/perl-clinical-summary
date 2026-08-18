import { createHash } from "node:crypto";
import { validateAssessment } from "./engine.js";
import { MODEL_SCALE_KEYS, projectModelInput } from "./model-input.js";

export const EQPASS_RFI_CONTRACT = "eqpass-perl-score-event/rfi-0.1";
export const EQPASS_RFI_STATUS = "proposed-rfi-only";

const LEVELS = new Set(["minimal", "mild", "moderate", "severe"]);
const EVENT_TYPES = new Set(["assessment.scored", "assessment.rescored"]);
const FLAG_CATEGORIES = new Set(["suicide", "violence", "other-red-flag"]);
const SYNTHETIC_REF = /^FF-TEST-[A-Z0-9-]+$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const SUBSCALE_INVENTORY = Object.freeze({
  DEP_DYSPHORIA: ["Dysphoria", "depression"],
  DEP_UNSUSTAINED_EFFORT: ["Unsustained effort", "depression"],
  DEP_NEGATIVE_COGNITION: ["Negative cognition", "depression"],
  DEP_FATIGUE: ["Fatigue", "depression"],
  DEP_ANHEDONIA: ["Anhedonia", "depression"],
  ANX_APPREHENSION: ["Apprehension", "anxiety"],
  ANX_INTERPERSONAL: ["Interpersonal anxiety", "anxiety"],
  ANX_PHYSIOLOGICAL: ["Physiological arousal", "anxiety"],
  ANG_ANGRY_MOOD: ["Angry mood", "anger"],
  ANG_RESENTMENT: ["Resentment", "anger"],
  ANG_INDIGNATION: ["Indignation", "anger"],
  ANG_IN: ["Anger in", "anger"],
  ANG_OUT_VERBAL: ["Anger out verbal", "anger"],
  ANG_OUT_PHYSICAL: ["Anger out physical", "anger"]
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function canonicalDigest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function exactKeys(value, allowed, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) errors.push(`${label} contains fields outside the proposed contract: ${unknown.join(", ")}.`);
  return true;
}

function requiredKeys(value, required, label, errors) {
  const missing = required.filter(key => !Object.hasOwn(value || {}, key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
}

function stringField(value, label, errors, { pattern, maximum = 240 } = {}) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) errors.push(`${label} must be a non-empty string of at most ${maximum} characters.`);
  else if (pattern && !pattern.test(value)) errors.push(`${label} is not an approved synthetic reference.`);
}

function integerField(value, label, errors, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) errors.push(`${label} must be an integer from ${minimum} through ${maximum}.`);
}

export function validateSyntheticEqpassEvent(event) {
  const errors = [];
  const eventKeys = ["contractVersion", "eventId", "eventType", "occurredAt", "environment", "tenantRef", "sourceAssessment", "scoring", "findingsReport", "trace"];
  if (!exactKeys(event, eventKeys, "Event", errors)) return errors;
  requiredKeys(event, eventKeys, "Event", errors);
  if (event.contractVersion !== EQPASS_RFI_CONTRACT) errors.push(`contractVersion must be ${EQPASS_RFI_CONTRACT}.`);
  stringField(event.eventId, "eventId", errors, { pattern: SYNTHETIC_REF, maximum: 160 });
  if (!EVENT_TYPES.has(event.eventType)) errors.push("eventType must be assessment.scored or assessment.rescored.");
  if (event.environment !== "calibration") errors.push("The local rehearsal accepts calibration events only; pilot and production events are blocked.");
  stringField(event.tenantRef, "tenantRef", errors, { pattern: SYNTHETIC_REF, maximum: 128 });
  if (typeof event.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt))) errors.push("occurredAt must be an ISO-8601 timestamp.");

  const sourceKeys = ["assessmentRef", "subjectRef", "instrument", "completedAt", "durationSeconds", "scoringVersion", "responseVersion"];
  if (exactKeys(event.sourceAssessment, sourceKeys, "sourceAssessment", errors)) {
    requiredKeys(event.sourceAssessment, ["assessmentRef", "instrument", "completedAt", "scoringVersion"], "sourceAssessment", errors);
    stringField(event.sourceAssessment.assessmentRef, "sourceAssessment.assessmentRef", errors, { pattern: SYNTHETIC_REF, maximum: 160 });
    if (Object.hasOwn(event.sourceAssessment, "subjectRef")) stringField(event.sourceAssessment.subjectRef, "sourceAssessment.subjectRef", errors, { pattern: SYNTHETIC_REF, maximum: 160 });
    if (typeof event.sourceAssessment.completedAt !== "string" || Number.isNaN(Date.parse(event.sourceAssessment.completedAt))) errors.push("sourceAssessment.completedAt must be an ISO-8601 timestamp.");
    if (Object.hasOwn(event.sourceAssessment, "durationSeconds")) integerField(event.sourceAssessment.durationSeconds, "sourceAssessment.durationSeconds", errors, { maximum: 5999 });
    stringField(event.sourceAssessment.scoringVersion, "sourceAssessment.scoringVersion", errors, { maximum: 120 });
    if (Object.hasOwn(event.sourceAssessment, "responseVersion")) stringField(event.sourceAssessment.responseVersion, "sourceAssessment.responseVersion", errors, { maximum: 120 });

    const instrumentKeys = ["name", "version", "itemCount"];
    if (exactKeys(event.sourceAssessment.instrument, instrumentKeys, "sourceAssessment.instrument", errors)) {
      requiredKeys(event.sourceAssessment.instrument, instrumentKeys, "sourceAssessment.instrument", errors);
      if (event.sourceAssessment.instrument.name !== "e-QPASS") errors.push("sourceAssessment.instrument.name must be e-QPASS.");
      stringField(event.sourceAssessment.instrument.version, "sourceAssessment.instrument.version", errors, { maximum: 80 });
      if (event.sourceAssessment.instrument.itemCount !== 105) errors.push("sourceAssessment.instrument.itemCount must be 105.");
    }
  }

  const scoringKeys = ["answeredItemCount", "scales", "redFlagSectionScore", "subscales", "criticalFlags"];
  if (exactKeys(event.scoring, scoringKeys, "scoring", errors)) {
    requiredKeys(event.scoring, ["answeredItemCount", "scales", "subscales", "criticalFlags"], "scoring", errors);
    if (event.scoring.answeredItemCount !== 105) errors.push("scoring.answeredItemCount must be 105.");
    if (Object.hasOwn(event.scoring, "redFlagSectionScore")) integerField(event.scoring.redFlagSectionScore, "scoring.redFlagSectionScore", errors);

    if (exactKeys(event.scoring.scales, MODEL_SCALE_KEYS, "scoring.scales", errors)) {
      requiredKeys(event.scoring.scales, MODEL_SCALE_KEYS, "scoring.scales", errors);
      for (const key of MODEL_SCALE_KEYS) {
        const construct = event.scoring.scales?.[key];
        if (exactKeys(construct, ["score", "level"], `scoring.scales.${key}`, errors)) {
          requiredKeys(construct, ["score", "level"], `scoring.scales.${key}`, errors);
          integerField(construct.score, `scoring.scales.${key}.score`, errors);
          if (!LEVELS.has(construct.level)) errors.push(`scoring.scales.${key}.level must be minimal, mild, moderate, or severe.`);
        }
      }
    }

    if (!Array.isArray(event.scoring.subscales) || event.scoring.subscales.length !== 14) {
      errors.push("scoring.subscales must contain exactly fourteen source-scored constructs.");
    } else {
      const codes = new Set();
      const domainCounts = { depression: 0, anxiety: 0, anger: 0 };
      for (const [index, subscale] of event.scoring.subscales.entries()) {
        const label = `scoring.subscales[${index}]`;
        if (!exactKeys(subscale, ["code", "label", "domain", "score", "level"], label, errors)) continue;
        requiredKeys(subscale, ["code", "label", "domain", "score", "level"], label, errors);
        stringField(subscale.code, `${label}.code`, errors, { pattern: /^[A-Z0-9][A-Z0-9_-]{0,79}$/ });
        stringField(subscale.label, `${label}.label`, errors, { maximum: 120 });
        if (codes.has(subscale.code)) errors.push(`${label}.code must be unique.`);
        codes.add(subscale.code);
        const expected = SUBSCALE_INVENTORY[subscale.code];
        if (!expected) errors.push(`${label}.code is not in the local fourteen-subscale RFI rehearsal inventory.`);
        else if (subscale.label !== expected[0] || subscale.domain !== expected[1]) errors.push(`${label} does not match the local RFI codebook for ${subscale.code}.`);
        if (!Object.hasOwn(domainCounts, subscale.domain)) errors.push(`${label}.domain must be depression, anxiety, or anger.`);
        else domainCounts[subscale.domain] += 1;
        integerField(subscale.score, `${label}.score`, errors, { maximum: 120 });
        if (!LEVELS.has(subscale.level)) errors.push(`${label}.level must be minimal, mild, moderate, or severe.`);
      }
      if (domainCounts.depression !== 5 || domainCounts.anxiety !== 3 || domainCounts.anger !== 6) {
        errors.push("The rehearsal inventory must contain five depression, three anxiety, and six anger subscales.");
      }
      const missingCodes = Object.keys(SUBSCALE_INVENTORY).filter(code => !codes.has(code));
      if (missingCodes.length) errors.push(`The rehearsal inventory is missing source codes: ${missingCodes.join(", ")}.`);
    }

    if (!Array.isArray(event.scoring.criticalFlags) || event.scoring.criticalFlags.length > 22) {
      errors.push("scoring.criticalFlags must be an array with no more than 22 entries.");
    } else {
      const codes = new Set();
      for (const [index, flag] of event.scoring.criticalFlags.entries()) {
        const label = `scoring.criticalFlags[${index}]`;
        if (!exactKeys(flag, ["code", "category", "score", "directReviewRequired", "labelRef"], label, errors)) continue;
        requiredKeys(flag, ["code", "category", "score", "directReviewRequired"], label, errors);
        stringField(flag.code, `${label}.code`, errors, { pattern: /^[A-Z0-9][A-Z0-9_-]{0,79}$/ });
        if (codes.has(flag.code)) errors.push(`${label}.code must be unique.`);
        codes.add(flag.code);
        if (!FLAG_CATEGORIES.has(flag.category)) errors.push(`${label}.category is unsupported.`);
        integerField(flag.score, `${label}.score`, errors, { maximum: 8 });
        if (typeof flag.directReviewRequired !== "boolean") errors.push(`${label}.directReviewRequired must be boolean.`);
        if (Object.hasOwn(flag, "labelRef")) stringField(flag.labelRef, `${label}.labelRef`, errors, { pattern: /^[A-Z0-9][A-Z0-9_-]{0,119}$/ });
      }
    }
  }

  const reportKeys = ["reportRef", "reportVersion", "status", "mimeType", "sha256"];
  if (exactKeys(event.findingsReport, reportKeys, "findingsReport", errors)) {
    requiredKeys(event.findingsReport, reportKeys, "findingsReport", errors);
    stringField(event.findingsReport.reportRef, "findingsReport.reportRef", errors, { pattern: SYNTHETIC_REF, maximum: 200 });
    stringField(event.findingsReport.reportVersion, "findingsReport.reportVersion", errors, { maximum: 120 });
    if (event.findingsReport.status !== "finalized") errors.push("Only a finalized synthetic Findings report can enter generation.");
    if (event.findingsReport.mimeType !== "application/pdf") errors.push("findingsReport.mimeType must be application/pdf.");
    if (typeof event.findingsReport.sha256 !== "string" || !HEX_64.test(event.findingsReport.sha256)) errors.push("findingsReport.sha256 must be a lowercase SHA-256 digest.");
  }

  const traceKeys = ["correlationId", "idempotencyKey"];
  if (exactKeys(event.trace, traceKeys, "trace", errors)) {
    requiredKeys(event.trace, traceKeys, "trace", errors);
    stringField(event.trace.correlationId, "trace.correlationId", errors, { pattern: SYNTHETIC_REF, maximum: 160 });
    stringField(event.trace.idempotencyKey, "trace.idempotencyKey", errors, { pattern: SYNTHETIC_REF, maximum: 240 });
    if (String(event.trace.idempotencyKey || "").length < 16) errors.push("trace.idempotencyKey must contain at least 16 characters.");
  }
  return errors;
}

function durationText(seconds) {
  if (!Number.isInteger(seconds)) return "00:00";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function titleCaseDomain(value) {
  return value[0].toUpperCase() + value.slice(1);
}

export function adaptSyntheticEqpassEvent(event) {
  const errors = validateSyntheticEqpassEvent(event);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 400 });

  const scales = Object.fromEntries(MODEL_SCALE_KEYS.map(key => [key, event.scoring.scales[key].score]));
  const scaleLevels = Object.fromEntries(MODEL_SCALE_KEYS.map(key => [key, event.scoring.scales[key].level]));
  const assessment = {
    id: event.sourceAssessment.assessmentRef,
    completedAt: event.sourceAssessment.completedAt,
    duration: durationText(event.sourceAssessment.durationSeconds),
    status: event.scoring.scales.suicideRisk.score > 0
      || event.scoring.scales.violenceRisk.score > 0
      || event.scoring.criticalFlags.some(flag => flag.directReviewRequired || flag.score > 0)
      ? "priority"
      : "ready",
    reviewer: "Unassigned",
    source: "e-QPASS proposed RFI synthetic scored event",
    itemsAnswered: event.scoring.answeredItemCount,
    scales,
    scaleLevels,
    subscales: event.scoring.subscales.map(item => ({
      label: item.label,
      domain: titleCaseDomain(item.domain),
      score: item.score,
      level: item.level,
      evidence: `Source construct ${item.code}; scoring version ${event.sourceAssessment.scoringVersion}`
    })),
    criticalResponses: event.scoring.criticalFlags.map(flag => ({
      item: `Source flag ${flag.code}`,
      score: flag.score,
      directReviewRequired: flag.directReviewRequired,
      note: `Category ${flag.category}; exact source wording remains in e-QPASS.`
    }))
  };
  const assessmentErrors = validateAssessment(assessment);
  if (assessmentErrors.length) throw Object.assign(new Error(assessmentErrors.join(" ")), { status: 400 });

  const modelInput = projectModelInput(assessment);
  return {
    assessment,
    modelInput,
    provenance: {
      contractVersion: event.contractVersion,
      contractStatus: EQPASS_RFI_STATUS,
      eventType: event.eventType,
      eventIdHash: canonicalDigest(event.eventId),
      idempotencyKeyHash: canonicalDigest(event.trace.idempotencyKey),
      sourceEventHash: canonicalDigest(event),
      modelProjectionHash: canonicalDigest(modelInput),
      instrumentVersion: event.sourceAssessment.instrument.version,
      scoringVersion: event.sourceAssessment.scoringVersion,
      responseVersion: event.sourceAssessment.responseVersion || null,
      findingsReportVersion: event.findingsReport.reportVersion,
      findingsReportHash: event.findingsReport.sha256,
      sourceAssessmentRef: event.sourceAssessment.assessmentRef
    }
  };
}
