import { createHash, randomUUID } from "node:crypto";

export const CLINICAL_STANDARD_CONTRACT = "perl-clinical-standard-draft/1.0";

export const CLINICAL_STANDARD_BOUNDARY = "This workspace records immutable working drafts of a proposed client-satisfaction and clinical-review standard. A draft is not counselor-panel acceptance, clinical-lead approval, a frozen protocol, independent review, evidence of accuracy or reliability, clinical validation, pilot authorization, production release, or permission for patient use. Reviewer codes are not clinical credentials, and a draft created after outcome evidence exists cannot be represented as pre-results intent.";

export const CLINICAL_STANDARD_FIELDS = Object.freeze([
  Object.freeze({ key: "minimumBlindPreferenceRate", label: "Minimum PERL blind preference", unit: "%", min: 50, max: 100, step: 1, scale: 100, description: "Share of revealed, eligible paired comparisons preferring PERL." }),
  Object.freeze({ key: "minimumMedianAccuracy", label: "Minimum median accuracy", unit: "/ 5", min: 1, max: 5, step: 0.1, scale: 1, description: "Median counselor rating for fidelity to scored evidence." }),
  Object.freeze({ key: "minimumMedianRestraint", label: "Minimum median restraint", unit: "/ 5", min: 1, max: 5, step: 0.1, scale: 1, description: "Median counselor rating for appropriately cautious language." }),
  Object.freeze({ key: "minimumMedianUtility", label: "Minimum median usefulness", unit: "/ 5", min: 1, max: 5, step: 0.1, scale: 1, description: "Median counselor rating for usefulness in the next conversation." }),
  Object.freeze({ key: "maximumMaterialCorrectionsPer100", label: "Maximum material corrections", unit: "/ 100", min: 0, max: 100, step: 1, scale: 1, description: "Adjudicated material corrections per 100 eligible outputs." }),
  Object.freeze({ key: "minimumPreferenceAgreementAc1", label: "Minimum preference agreement", unit: "AC1", min: 0, max: 1, step: 0.01, scale: 1, description: "Gwet AC1 across independently repeated preference judgments." }),
  Object.freeze({ key: "maximumMedianAssistedMinutes", label: "Maximum assisted workflow time", unit: "min", min: 0.5, max: 60, step: 0.5, scale: 1, description: "Median protocol-eligible PERL-assisted task time." })
]);

export const NON_NEGOTIABLE_SAFETY_LIMITS = Object.freeze({
  criticalScreenOmissions: 0,
  unsupportedDiagnosticCertainty: 0,
  inventedOrMismatchedEvidence: 0,
  unresolvedHighOrCriticalIncidents: 0
});

function clone(value) {
  return structuredClone(value);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boundedNumber(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new Error(`${field.label} is required.`), { status: 400 });
  const normalized = parsed / field.scale;
  const normalizedMin = field.min / field.scale;
  const normalizedMax = field.max / field.scale;
  if (normalized < normalizedMin || normalized > normalizedMax) {
    throw Object.assign(new Error(`${field.label} must be between ${field.min} and ${field.max}${field.unit === "%" ? "%" : ""}.`), { status: 400 });
  }
  return Number(normalized.toFixed(field.scale === 100 ? 4 : 2));
}

export function normalizeClinicalStandardInput(input = {}) {
  const rationale = String(input.rationale || "").trim().replace(/\s+/g, " ");
  if (rationale.length < 40 || rationale.length > 1200) {
    throw Object.assign(new Error("Draft rationale must be 40–1,200 characters."), { status: 400 });
  }
  const thresholds = Object.fromEntries(CLINICAL_STANDARD_FIELDS.map(field => [field.key, boundedNumber(input.thresholds?.[field.key], field)]));
  return { thresholds, rationale };
}

export function currentOutcomeEvidence(analysis = {}) {
  const sample = analysis.sample || {};
  const safety = analysis.safety || {};
  const counts = {
    pairedBlindComparisons: Number(sample.pairedComparisons || 0),
    structuredFeedbackEntries: Number(sample.feedbackEntries || 0),
    revisions: Number(sample.revisions || 0),
    workflowTimingObservations: Number(sample.workflowTimingObservations || 0),
    reportedSafetyIncidents: Number(safety.exposure?.reportedEvents || 0)
  };
  return {
    counts,
    outcomeEvidenceObserved: Object.values(counts).some(count => count > 0)
  };
}

export function createClinicalStandardDraft({ input, actor, version, analysis, evidenceHeads, createdAt = new Date().toISOString(), id = randomUUID() }) {
  const normalized = normalizeClinicalStandardInput(input);
  const evidenceAtDraft = currentOutcomeEvidence(analysis);
  const core = {
    id,
    contractVersion: CLINICAL_STANDARD_CONTRACT,
    type: "clinical-standard-working-draft",
    version,
    status: "working-draft-unaccepted",
    preparedFor: "Dolores, the clinical lead, and the named counselor panel",
    thresholds: normalized.thresholds,
    nonNegotiableSafetyLimits: clone(NON_NEGOTIABLE_SAFETY_LIMITS),
    rationale: normalized.rationale,
    evidenceAtDraft: {
      ...evidenceAtDraft,
      chainHeads: clone(evidenceHeads)
    },
    preOutcomeCandidate: !evidenceAtDraft.outcomeEvidenceObserved,
    counselorPanelAccepted: false,
    clinicalLeadApproved: false,
    protocolFrozen: false,
    independentReviewComplete: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorizationRecorded: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt
  };
  return { ...core, hash: digest(core) };
}

export function validateClinicalStandardDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return ["Clinical-standard draft is required."];
  const { hash, ...core } = draft;
  if (draft.contractVersion !== CLINICAL_STANDARD_CONTRACT || draft.type !== "clinical-standard-working-draft" || draft.status !== "working-draft-unaccepted") errors.push("Draft contract identity is invalid.");
  if (!Number.isInteger(draft.version) || draft.version < 1) errors.push("Draft version is invalid.");
  try { normalizeClinicalStandardInput({ thresholds: Object.fromEntries(CLINICAL_STANDARD_FIELDS.map(field => [field.key, Number(draft.thresholds?.[field.key]) * field.scale])), rationale: draft.rationale }); } catch (error) { errors.push(error.message); }
  if (digest(draft.nonNegotiableSafetyLimits) !== digest(NON_NEGOTIABLE_SAFETY_LIMITS)) errors.push("Non-negotiable safety limits changed.");
  const counts = Object.values(draft.evidenceAtDraft?.counts || {});
  if (counts.length !== 5 || counts.some(count => !Number.isInteger(count) || count < 0)) errors.push("Evidence-at-draft counts are invalid.");
  const observed = counts.some(count => count > 0);
  if (draft.evidenceAtDraft?.outcomeEvidenceObserved !== observed || draft.preOutcomeCandidate !== !observed) errors.push("Pre-outcome classification is inconsistent with the evidence snapshot.");
  const heads = draft.evidenceAtDraft?.chainHeads || {};
  if (["feedback", "revisions", "blindOutcomes", "incidents", "workflowTiming"].some(key => !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(heads[key] || "")))) errors.push("Evidence chain heads are incomplete.");
  for (const field of ["counselorPanelAccepted", "clinicalLeadApproved", "protocolFrozen", "independentReviewComplete", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation", "pilotAuthorizationRecorded", "productionReleaseAuthorized", "patientUseAuthorized"]) {
    if (draft[field] !== false) errors.push(`${field} must remain false.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(draft.actor || ""))) errors.push("Draft actor is invalid.");
  if (!Number.isFinite(Date.parse(draft.createdAt))) errors.push("Draft timestamp is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Draft fingerprint is invalid.");
  return [...new Set(errors)];
}

export function clinicalStandardStatus({ drafts = [], chain, analysis, generatedAt = new Date().toISOString() }) {
  const latestDraft = drafts.at(-1) || null;
  return {
    contractVersion: CLINICAL_STANDARD_CONTRACT,
    status: latestDraft ? "working-draft-recorded" : "definition-required-before-testing",
    headline: "Decide what good means before seeing what wins.",
    fields: clone(CLINICAL_STANDARD_FIELDS),
    nonNegotiableSafetyLimits: clone(NON_NEGOTIABLE_SAFETY_LIMITS),
    currentEvidence: currentOutcomeEvidence(analysis),
    latestDraft: clone(latestDraft),
    history: drafts.map(draft => ({ id: draft.id, version: draft.version, actor: draft.actor, createdAt: draft.createdAt, preOutcomeCandidate: draft.preOutcomeCandidate, hash: draft.hash })),
    chain: clone(chain),
    counselorPanelAccepted: false,
    clinicalLeadApproved: false,
    protocolFrozen: false,
    independentReviewComplete: false,
    clinicalValidation: false,
    pilotAuthorizationRecorded: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    generatedAt,
    boundary: CLINICAL_STANDARD_BOUNDARY
  };
}
