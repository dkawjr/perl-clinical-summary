import { createHash, randomUUID } from "node:crypto";
import { validateNarrative } from "./engine.js";
import { workflowSourceProfile } from "./workflow-timing.js";

export const COUNSELOR_REFERENCE_CONTRACT = "perl-counselor-reference-draft/1.0";

export const COUNSELOR_REFERENCE_BOUNDARY = "This source-only room records immutable draft reference interpretations against visibly synthetic scored profiles. The authoring surface contains no PERL-generated summary, counselor reference, respondent identity, raw response wording, or PHI. A local reviewer code is not a verified counselor identity. A submitted draft is not an accepted reference, adjudication, protocol freeze, clinical-performance result, training record, clinical validation, pilot authorization, production release, or permission for patient use.";

export const COUNSELOR_REFERENCE_TONE_MARKERS = Object.freeze([
  Object.freeze({ id: "indicator-language", label: "Indicator language", description: "Describe scored signals without diagnosis or certainty." }),
  Object.freeze({ id: "explicit-uncertainty", label: "Explicit uncertainty", description: "State what the scored profile cannot establish." }),
  Object.freeze({ id: "plain-clinical-language", label: "Plain clinical language", description: "Prefer concise language a counselor can use quickly." }),
  Object.freeze({ id: "next-conversation", label: "Next conversation", description: "Make the next clarification or interview question visible." }),
  Object.freeze({ id: "critical-route-visible", label: "Critical route visible", description: "Keep direct review separate from interpretation." })
]);

const TONE_MARKERS = new Set(COUNSELOR_REFERENCE_TONE_MARKERS.map(item => item.id));
const CONFIDENCE = new Set(["Low", "Moderate", "High"]);
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const SYNTHETIC_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const HEX = /^[a-f0-9]{64}$/;
const DIRECT_IDENTIFIER = /\b(?:patient|client|respondent|member)\s*(?:name|id|number)\b|\b(?:mrn|ssn|dob|date of birth)\b|\b\d{3}[-. ]\d{2}[-. ]\d{4}\b|\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

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

function sourceEvidenceTokens(sourceProfile) {
  return new Set([
    ...(sourceProfile?.scales || []).map(item => `${item.label} · ${item.score}`),
    ...(sourceProfile?.subscales || []).map(item => `${item.label} · ${item.score}`)
  ]);
}

function textHasIdentifier(value) {
  return DIRECT_IDENTIFIER.test(String(value || ""));
}

export function buildCounselorReferenceSource(assessment) {
  const profile = workflowSourceProfile(assessment);
  return {
    ...profile,
    boundary: "Scored synthetic source profile only. No respondent identity, raw response wording, counselor reference, PERL summary, generated hypothesis, or generated follow-up question is included.",
    generatedContentIncluded: false,
    counselorReferenceIncluded: false
  };
}

export function counselorReferenceSourceHash(sourceProfile) {
  return digest(sourceProfile);
}

export function validateCounselorReferenceContract() {
  const errors = [];
  if (COUNSELOR_REFERENCE_TONE_MARKERS.length !== 5 || TONE_MARKERS.size !== 5) errors.push("The counselor reference room requires five unique tone markers.");
  if (!/no PERL-generated summary/i.test(COUNSELOR_REFERENCE_BOUNDARY)) errors.push("The counselor reference boundary must preserve source-only authoring.");
  if (!/not an accepted reference/i.test(COUNSELOR_REFERENCE_BOUNDARY)) errors.push("The counselor reference boundary must deny reference acceptance.");
  if (COUNSELOR_REFERENCE_BOUNDARY.length < 420) errors.push("The counselor reference boundary is incomplete.");
  return errors;
}

export function validateCounselorReferenceInput(input, sourceProfile) {
  const errors = [];
  const keys = ["assessmentId", "sourceProfileHash", "authoringMode", "summary", "themes", "questions", "toneMarkers", "criticalReviewDisposition"];
  if (!exactKeys(input, keys, "Reference draft", errors)) return errors;
  if (!SYNTHETIC_ID.test(String(input.assessmentId || ""))) errors.push("assessmentId must be a visibly synthetic FF-TEST reference.");
  if (input.assessmentId !== sourceProfile?.assessmentId) errors.push("assessmentId must match the source-only scored profile.");
  if (input.sourceProfileHash !== counselorReferenceSourceHash(sourceProfile)) errors.push("sourceProfileHash must match the exact source-only scored profile.");
  if (input.authoringMode !== "source-only") errors.push("authoringMode must remain source-only.");

  const summary = String(input.summary || "").trim();
  errors.push(...validateNarrative(summary));
  if (summary.length < 80) errors.push("The counselor reference summary must contain at least 80 characters.");
  if (summary.length > 1500) errors.push("The counselor reference summary must contain no more than 1,500 characters.");
  if (textHasIdentifier(summary)) errors.push("The counselor reference summary appears to contain a direct identifier.");

  if (!Array.isArray(input.themes) || input.themes.length < 1 || input.themes.length > 4) {
    errors.push("A reference draft must contain between 1 and 4 clinical themes.");
  }
  const allowedEvidence = sourceEvidenceTokens(sourceProfile);
  for (const [index, theme] of (input.themes || []).entries()) {
    const prefix = `Theme ${index + 1}`;
    if (!exactKeys(theme, ["title", "body", "confidence", "evidence", "uncertainty"], prefix, errors)) continue;
    const title = String(theme.title || "").trim();
    const body = String(theme.body || "").trim();
    const uncertainty = String(theme.uncertainty || "").trim();
    if (title.length < 3 || title.length > 180) errors.push(`${prefix} title must contain 3–180 characters.`);
    if (body.length < 40 || body.length > 1000) errors.push(`${prefix} explanation must contain 40–1,000 characters.`);
    if (uncertainty.length < 30 || uncertainty.length > 500) errors.push(`${prefix} uncertainty must contain 30–500 characters.`);
    for (const value of [title, body, uncertainty]) {
      const narrativeErrors = validateNarrative(value.length >= 40 ? value : `${value} requires direct interview context and cautious interpretation.`);
      if (narrativeErrors.some(error => /diagnostic|certain/i.test(error))) errors.push(`${prefix} uses diagnostic or overly certain wording.`);
      if (textHasIdentifier(value)) errors.push(`${prefix} appears to contain a direct identifier.`);
    }
    if (!CONFIDENCE.has(theme.confidence)) errors.push(`${prefix} must use Low, Moderate, or High confidence.`);
    if (!Array.isArray(theme.evidence) || theme.evidence.length < 1 || theme.evidence.length > 6) {
      errors.push(`${prefix} must cite between 1 and 6 scored evidence tokens.`);
    } else {
      if (new Set(theme.evidence).size !== theme.evidence.length) errors.push(`${prefix} evidence tokens must be unique.`);
      const unknown = theme.evidence.filter(token => !allowedEvidence.has(token));
      if (unknown.length) errors.push(`${prefix} cites evidence outside the scored source profile: ${unknown.join(", ")}.`);
    }
  }

  if (!Array.isArray(input.questions) || input.questions.length < 2 || input.questions.length > 6) {
    errors.push("A reference draft must contain between 2 and 6 follow-up questions.");
  }
  for (const [index, question] of (input.questions || []).entries()) {
    const value = String(question || "").trim();
    if (value.length < 12 || value.length > 300) errors.push(`Follow-up question ${index + 1} must contain 12–300 characters.`);
    if (!value.endsWith("?")) errors.push(`Follow-up question ${index + 1} must end with a question mark.`);
    if (textHasIdentifier(value)) errors.push(`Follow-up question ${index + 1} appears to contain a direct identifier.`);
    if (validateNarrative(value.length >= 40 ? value : `${value} Please clarify this scored indicator directly.`).some(error => /diagnostic|certain/i.test(error))) errors.push(`Follow-up question ${index + 1} uses diagnostic or overly certain wording.`);
  }
  if (new Set((input.questions || []).map(item => String(item).trim().toLowerCase())).size !== (input.questions || []).length) errors.push("Follow-up questions must be unique.");

  if (!Array.isArray(input.toneMarkers) || input.toneMarkers.length < 3 || input.toneMarkers.length > 5) {
    errors.push("Select between 3 and 5 fixed tone markers.");
  } else {
    if (new Set(input.toneMarkers).size !== input.toneMarkers.length) errors.push("Tone markers must be unique.");
    const unknown = input.toneMarkers.filter(marker => !TONE_MARKERS.has(marker));
    if (unknown.length) errors.push(`Unsupported tone markers: ${unknown.join(", ")}.`);
  }
  const requiredDisposition = sourceProfile?.safety?.directReviewRequired ? "requires-direct-review" : "routine-verification";
  if (input.criticalReviewDisposition !== requiredDisposition) errors.push(`criticalReviewDisposition must be ${requiredDisposition} for this scored source profile.`);
  return [...new Set(errors)];
}

const FALSE_CLAIMS = [
  "sourceSurfaceIncludesGeneratedContent", "authorshipIndependenceEstablished", "counselorIdentityVerified",
  "referenceAccepted", "adjudicationCompleted", "protocolFrozen", "accuracyEstablished", "reliabilityEstablished",
  "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
];

export function createCounselorReferenceDraft({ input, sourceProfile, caseSet, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() }) {
  const errors = validateCounselorReferenceInput(input, sourceProfile);
  if (errors.length) throw new Error(errors.join(" "));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: COUNSELOR_REFERENCE_CONTRACT,
    type: "counselor-reference-draft-recorded",
    assessmentId: input.assessmentId,
    caseSet: clone(caseSet),
    sourceProfile: clone(sourceProfile),
    sourceProfileHash: input.sourceProfileHash,
    authoringMode: input.authoringMode,
    summary: input.summary.trim(),
    themes: clone(input.themes).map(theme => ({ ...theme, title: theme.title.trim(), body: theme.body.trim(), uncertainty: theme.uncertainty.trim(), evidence: [...theme.evidence] })),
    questions: input.questions.map(question => question.trim()),
    toneMarkers: [...input.toneMarkers],
    criticalReviewDisposition: input.criticalReviewDisposition,
    sourceSurfaceIncludesGeneratedContent: false,
    authorshipIndependenceEstablished: false,
    counselorIdentityVerified: false,
    referenceAccepted: false,
    adjudicationCompleted: false,
    protocolFrozen: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt,
    note: "Source-only synthetic reference draft recorded. The surface excluded PERL output, but the sandbox cannot verify counselor identity, independent authorship, adjudication, acceptance, validation, or release authority."
  };
  return { ...core, hash: digest(core) };
}

export function validateCounselorReferenceDraft(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "assessmentId", "caseSet", "sourceProfile", "sourceProfileHash",
    "authoringMode", "summary", "themes", "questions", "toneMarkers", "criticalReviewDisposition", ...FALSE_CLAIMS,
    "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Counselor reference event", errors)) return errors;
  if (event.contractVersion !== COUNSELOR_REFERENCE_CONTRACT) errors.push("Counselor reference contract version is invalid.");
  if (event.type !== "counselor-reference-draft-recorded") errors.push("Counselor reference event type is invalid.");
  if (!/^[0-9a-f-]{20,40}$/i.test(String(event.id || ""))) errors.push("Counselor reference event ID is invalid.");
  if (event.sequence !== sequence || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Counselor reference event sequence is invalid.");
  if (event.previousHash !== previousHash || (event.previousHash !== "GENESIS" && !HEX.test(String(event.previousHash || "")))) errors.push("Counselor reference previous hash is invalid.");
  if (!event.caseSet || typeof event.caseSet !== "object" || Array.isArray(event.caseSet) || Object.keys(event.caseSet).sort().join(",") !== "id,partition,referenceVersion,version") errors.push("caseSet must contain only id, version, partition, and referenceVersion.");
  if (event.caseSet && [event.caseSet.id, event.caseSet.version, event.caseSet.partition, event.caseSet.referenceVersion].some(value => typeof value !== "string" || !value.trim())) errors.push("caseSet values must be non-empty strings.");
  errors.push(...validateCounselorReferenceInput({
    assessmentId: event.assessmentId,
    sourceProfileHash: event.sourceProfileHash,
    authoringMode: event.authoringMode,
    summary: event.summary,
    themes: event.themes,
    questions: event.questions,
    toneMarkers: event.toneMarkers,
    criticalReviewDisposition: event.criticalReviewDisposition
  }, event.sourceProfile));
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(event.actor || ""))) errors.push("Counselor reference actor must be a bounded reviewer code.");
  if (Number.isNaN(Date.parse(event.createdAt))) errors.push("Counselor reference createdAt is invalid.");
  if (typeof event.note !== "string" || event.note.length < 150 || !/excluded PERL output/i.test(event.note)) errors.push("Counselor reference note boundary is incomplete.");
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || digest(core) !== hash) errors.push("Counselor reference event hash is invalid.");
  return [...new Set(errors)];
}

export function buildCounselorReferenceRoom({ assessments = [], drafts = [], chain = { valid: true, count: 0, head: null }, manifest, actor = "REVIEWER-01", generatedAt = new Date().toISOString() } = {}) {
  const reviewerDrafts = drafts.filter(draft => draft.actor === actor);
  const reviewerCodes = new Set(drafts.map(draft => draft.actor));
  const cases = assessments.filter(assessment => manifest?.cases?.[assessment.id]?.partition === "development").map(assessment => {
    const sourceProfile = buildCounselorReferenceSource(assessment);
    const manifestCase = manifest?.cases?.[assessment.id] || {};
    const caseDrafts = drafts.filter(draft => draft.assessmentId === assessment.id);
    return {
      assessmentId: assessment.id,
      partition: manifestCase.partition,
      referenceVersion: manifestCase.referenceVersion,
      sourceProfile,
      sourceProfileHash: counselorReferenceSourceHash(sourceProfile),
      localDraftCount: caseDrafts.length,
      draftedByCurrentReviewer: caseDrafts.some(draft => draft.actor === actor),
      acceptedReferenceAvailable: false
    };
  });
  return {
    contractVersion: COUNSELOR_REFERENCE_CONTRACT,
    status: drafts.length ? "local-reference-drafts-recorded" : "source-only-authoring-ready",
    headline: "Read the evidence first. Write without the model in the room.",
    cases,
    activeCaseId: cases.find(item => !item.draftedByCurrentReviewer)?.assessmentId || cases[0]?.assessmentId || null,
    toneMarkers: clone(COUNSELOR_REFERENCE_TONE_MARKERS),
    metrics: {
      syntheticCases: cases.length,
      developmentCases: cases.filter(item => item.partition === "development").length,
      localDrafts: drafts.length,
      currentReviewerDrafts: reviewerDrafts.length,
      sandboxReviewerCodesObserved: reviewerCodes.size,
      acceptedReferences: 0
    },
    currentReviewerHistory: clone(reviewerDrafts.slice().reverse()),
    chain: clone(chain),
    authoringSurfaceIncludesGeneratedContent: false,
    counselorIdentityVerified: false,
    referencesAccepted: false,
    protocolFrozen: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    generatedAt,
    boundary: COUNSELOR_REFERENCE_BOUNDARY
  };
}
