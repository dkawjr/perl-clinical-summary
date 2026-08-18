import { createHash, randomUUID } from "node:crypto";

export const INTENDED_USE_CONTRACT = "perl-intended-use-charter/1.0";

export const INTENDED_USE_BOUNDARY = "This registry records immutable working drafts of PERL's proposed provider-first intended use. A draft is not executive acceptance, clinical approval, legal advice or approval, privacy or security approval, e-QPASS owner acceptance, disclaimer approval, a frozen intended-use statement, clinical validation, pilot authorization, production release, or permission for patient use. Reviewer codes record local authorship only and are not professional credentials or signatures.";

export const INTENDED_USE_CONTEXTS = Object.freeze([
  Object.freeze({ id: "session-preparation", label: "Before the care conversation", description: "A qualified clinician reviews the summary while preparing for the next conversation." }),
  Object.freeze({ id: "point-of-care-review", label: "At the start of the session", description: "A qualified clinician reviews scored signals and follow-up questions at the point of care." }),
  Object.freeze({ id: "post-assessment-review", label: "After scoring, before clinical use", description: "A completed scored assessment enters a held review queue before any summary can be used." })
]);

export const INTENDED_USE_AUDIENCES = Object.freeze([
  Object.freeze({ id: "clinician", index: "01", label: "Clinician / counselor", priority: "primary", purpose: "Review evidence-linked indicators, uncertainty, critical-screen routing, and questions for the next conversation.", boundary: "Licensed judgment remains required; the summary does not diagnose or prescribe." }),
  Object.freeze({ id: "care-coordination", index: "02", label: "Care coordination", priority: "secondary", purpose: "See minimum-necessary coordination signals and follow-up status from the same reviewed record.", boundary: "No independent clinical interpretation or treatment direction." }),
  Object.freeze({ id: "payer-utilization", index: "03", label: "Payer / utilization", priority: "secondary", purpose: "See a bounded, role-specific utilization view of approved facts when separately authorized.", boundary: "No automated coverage, eligibility, or level-of-care decision." }),
  Object.freeze({ id: "operations-admin", index: "04", label: "Operations / admin", priority: "minimum-necessary", purpose: "See routing, completion, and workflow state without scored-domain detail or clinical hypotheses.", boundary: "No clinical narrative, counselor-reference prose, or safety interpretation." })
]);

export const INTENDED_USE_PROHIBITIONS = Object.freeze([
  Object.freeze({ id: "diagnosis", label: "Diagnosis", detail: "PERL cannot establish or communicate a diagnosis." }),
  Object.freeze({ id: "prescription", label: "Prescription or treatment instruction", detail: "PERL cannot prescribe, direct treatment, or choose an intervention." }),
  Object.freeze({ id: "level-of-care", label: "Level-of-care determination", detail: "PERL cannot determine placement, acuity, admission, discharge, or service level." }),
  Object.freeze({ id: "emergency-triage", label: "Emergency or crisis triage", detail: "Critical screens route to direct human review; generated prose cannot resolve safety." }),
  Object.freeze({ id: "autonomous-release", label: "Autonomous clinical release", detail: "No generated summary may enter care without accountable human review." }),
  Object.freeze({ id: "source-replacement", label: "Replacement of Findings", detail: "The PERL page remains additional to the unchanged authoritative Findings report." }),
  Object.freeze({ id: "automated-adverse-decision", label: "Automated adverse decision", detail: "PERL cannot independently deny coverage, eligibility, access, or services." }),
  Object.freeze({ id: "consumer-self-interpretation", label: "Consumer self-interpretation", detail: "The current scope is provider-first and is not a direct-to-consumer clinical product." })
]);

export const INTENDED_USE_ACCEPTANCES = Object.freeze([
  Object.freeze({ id: "executive-product", index: "01", label: "Executive + product sponsor", ownerRoles: Object.freeze(["executive-sponsor"]), state: "external-acceptance-required" }),
  Object.freeze({ id: "clinical", index: "02", label: "Licensed clinical lead", ownerRoles: Object.freeze(["clinical-lead"]), state: "external-acceptance-required" }),
  Object.freeze({ id: "legal", index: "03", label: "Legal owner", ownerRoles: Object.freeze(["legal-owner"]), state: "external-acceptance-required" }),
  Object.freeze({ id: "privacy-security", index: "04", label: "Privacy + security owner", ownerRoles: Object.freeze(["security-privacy-owner"]), state: "external-acceptance-required" }),
  Object.freeze({ id: "eqpass", index: "05", label: "e-QPASS owner", ownerRoles: Object.freeze(["eqpass-owner"]), state: "external-acceptance-required" })
]);

const FIXED_CHARTER = Object.freeze({
  providerFirst: true,
  primaryAudience: "clinician",
  sourceAuthority: "authoritative-eqpass-scored-output",
  modelProjection: "scoring-only",
  artifactRelationship: "additional-page-beside-unchanged-findings",
  humanReviewRequired: true,
  criticalScreenHandling: "deterministic-direct-review",
  automatedClinicalDecisionAllowed: false,
  consumerUseInCurrentScope: false
});

function clone(value) {
  return structuredClone(value);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function compactText(value, label, min, max) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) throw Object.assign(new Error(`${label} must be ${min}–${max} characters.`), { status: 400 });
  return text;
}

export function normalizeIntendedUseInput(input = {}) {
  const pilotContext = String(input.pilotContext || "");
  if (!INTENDED_USE_CONTEXTS.some(context => context.id === pilotContext)) {
    throw Object.assign(new Error("Choose one bounded provider-first pilot context."), { status: 400 });
  }
  const scopeStatement = compactText(input.scopeStatement, "Intended-use statement", 120, 1200);
  const rationale = compactText(input.rationale, "Decision rationale", 40, 1200);
  const unsafeAssertions = [
    /\b(?:will|can) diagnos(?:e|is)\b/i,
    /\b(?:will|can) prescribe\b/i,
    /\bautomatically determines? (?:level of care|coverage|eligibility|treatment)\b/i,
    /\breplaces? (?:the )?(?:clinician|counselor|findings report)\b/i,
    /\bwithout (?:human|clinical|clinician|counselor) review\b/i,
    /\b(?:validated|approved) for (?:clinical|patient|production) use\b/i
  ];
  if (unsafeAssertions.some(pattern => pattern.test(scopeStatement) || pattern.test(rationale))) {
    throw Object.assign(new Error("Working charter text cannot assert diagnosis, prescription, autonomous decision making, source replacement, review bypass, or clinical approval."), { status: 400 });
  }
  return { pilotContext, scopeStatement, rationale };
}

export function intendedUseCharterFingerprint() {
  return digest({
    contractVersion: INTENDED_USE_CONTRACT,
    fixedCharter: FIXED_CHARTER,
    contexts: INTENDED_USE_CONTEXTS,
    audiences: INTENDED_USE_AUDIENCES,
    prohibitions: INTENDED_USE_PROHIBITIONS,
    acceptances: INTENDED_USE_ACCEPTANCES
  });
}

export function validateIntendedUseContract() {
  const errors = [];
  if (INTENDED_USE_CONTEXTS.length !== 3 || new Set(INTENDED_USE_CONTEXTS.map(item => item.id)).size !== 3) errors.push("Intended-use contexts must contain three unique choices.");
  if (INTENDED_USE_AUDIENCES.length !== 4 || new Set(INTENDED_USE_AUDIENCES.map(item => item.id)).size !== 4 || INTENDED_USE_AUDIENCES[0].id !== "clinician") errors.push("Intended-use audiences must contain the four ordered provider formats with clinician first.");
  if (INTENDED_USE_PROHIBITIONS.length !== 8 || new Set(INTENDED_USE_PROHIBITIONS.map(item => item.id)).size !== 8) errors.push("Intended-use prohibitions must contain eight unique boundaries.");
  if (INTENDED_USE_ACCEPTANCES.length !== 5 || new Set(INTENDED_USE_ACCEPTANCES.map(item => item.id)).size !== 5 || INTENDED_USE_ACCEPTANCES.some(item => item.state !== "external-acceptance-required")) errors.push("Intended-use acceptance register must contain five external decisions.");
  if (FIXED_CHARTER.providerFirst !== true || FIXED_CHARTER.primaryAudience !== "clinician" || FIXED_CHARTER.modelProjection !== "scoring-only" || FIXED_CHARTER.humanReviewRequired !== true || FIXED_CHARTER.automatedClinicalDecisionAllowed !== false || FIXED_CHARTER.consumerUseInCurrentScope !== false) errors.push("Fixed intended-use charter is unsafe.");
  if (!/^[a-f0-9]{64}$/.test(intendedUseCharterFingerprint())) errors.push("Intended-use charter fingerprint is invalid.");
  return [...new Set(errors)];
}

export function createIntendedUseDraft({ input, actor, version, evidenceSnapshot, createdAt = new Date().toISOString(), id = randomUUID() }) {
  const normalized = normalizeIntendedUseInput(input);
  const core = {
    id,
    contractVersion: INTENDED_USE_CONTRACT,
    type: "intended-use-working-draft",
    version,
    status: "working-charter-unaccepted",
    ...clone(FIXED_CHARTER),
    pilotContext: normalized.pilotContext,
    scopeStatement: normalized.scopeStatement,
    rationale: normalized.rationale,
    audiences: clone(INTENDED_USE_AUDIENCES),
    prohibitedUses: clone(INTENDED_USE_PROHIBITIONS),
    requiredAcceptances: clone(INTENDED_USE_ACCEPTANCES),
    evidenceSnapshot: clone(evidenceSnapshot),
    charterFingerprint: intendedUseCharterFingerprint(),
    executiveSponsorAccepted: false,
    clinicalLeadApproved: false,
    legalApproved: false,
    privacySecurityApproved: false,
    eqpassOwnerAccepted: false,
    disclaimerApproved: false,
    intendedUseFrozen: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt
  };
  return { ...core, hash: digest(core) };
}

export function validateIntendedUseDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return ["Intended-use draft is required."];
  const { hash, ...core } = draft;
  if (draft.contractVersion !== INTENDED_USE_CONTRACT || draft.type !== "intended-use-working-draft" || draft.status !== "working-charter-unaccepted") errors.push("Intended-use draft identity is invalid.");
  if (!Number.isInteger(draft.version) || draft.version < 1) errors.push("Intended-use draft version is invalid.");
  try { normalizeIntendedUseInput(draft); } catch (error) { errors.push(error.message); }
  for (const [key, value] of Object.entries(FIXED_CHARTER)) if (draft[key] !== value) errors.push(`${key} changed from the fixed provider-first charter.`);
  if (digest(draft.audiences) !== digest(INTENDED_USE_AUDIENCES)) errors.push("Audience contract changed.");
  if (digest(draft.prohibitedUses) !== digest(INTENDED_USE_PROHIBITIONS)) errors.push("Prohibited-use contract changed.");
  if (digest(draft.requiredAcceptances) !== digest(INTENDED_USE_ACCEPTANCES)) errors.push("Required-acceptance contract changed.");
  if (draft.charterFingerprint !== intendedUseCharterFingerprint()) errors.push("Charter fingerprint is invalid.");
  const evidence = draft.evidenceSnapshot || {};
  if (evidence.reportContract !== "perl-clinician-report/1.0" || evidence.disclaimerVersion !== "ff-clinical-disclaimer/draft-2026-08") errors.push("Report-language evidence is incomplete.");
  if (evidence.modelInputContract !== "perl-scored-profile/1.0" || evidence.generationPolicyVersion !== "perl-clinical-generation-policy/1.0" || !/^[a-f0-9]{64}$/.test(String(evidence.generationPolicyHash || ""))) errors.push("Generation evidence is incomplete.");
  if (evidence.audienceFormatCount !== 4) errors.push("Audience-format evidence is incomplete.");
  const heads = evidence.chainHeads || {};
  if (["reportArtifacts", "generationSnapshots", "pilotReadiness", "clinicalStandard"].some(key => !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(heads[key] || "")))) errors.push("Evidence chain heads are incomplete.");
  for (const field of ["executiveSponsorAccepted", "clinicalLeadApproved", "legalApproved", "privacySecurityApproved", "eqpassOwnerAccepted", "disclaimerApproved", "intendedUseFrozen", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"]) {
    if (draft[field] !== false) errors.push(`${field} must remain false.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(draft.actor || ""))) errors.push("Draft actor is invalid.");
  if (!Number.isFinite(Date.parse(draft.createdAt))) errors.push("Draft timestamp is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Draft fingerprint is invalid.");
  return [...new Set(errors)];
}

export function createIntendedUseEvent({ draft, sequence, previousHash, createdAt = draft.createdAt, id = randomUUID() }) {
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: INTENDED_USE_CONTRACT,
    type: "intended-use-draft-recorded",
    status: "working-charter-unaccepted",
    draftId: draft.id,
    draftHash: draft.hash,
    draftVersion: draft.version,
    pilotContext: draft.pilotContext,
    providerFirst: true,
    acceptancesRequired: INTENDED_USE_ACCEPTANCES.length,
    acceptancesRecorded: 0,
    executiveSponsorAccepted: false,
    clinicalLeadApproved: false,
    legalApproved: false,
    privacySecurityApproved: false,
    eqpassOwnerAccepted: false,
    disclaimerApproved: false,
    intendedUseFrozen: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor: draft.actor,
    createdAt,
    note: "A provider-first intended-use working draft was recorded. All five external acceptances, disclaimer approval, freeze, validation, pilot, production, and patient-use authority remain absent."
  };
  return { ...core, hash: digest(core) };
}

export function validateIntendedUseEvent(event, { sequence, previousHash, draft } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Intended-use event is required."];
  const { hash, ...core } = event;
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Intended-use event chain position is invalid.");
  if (event.contractVersion !== INTENDED_USE_CONTRACT || event.type !== "intended-use-draft-recorded" || event.status !== "working-charter-unaccepted") errors.push("Intended-use event identity is invalid.");
  if (!draft || event.draftId !== draft.id || event.draftHash !== draft.hash || event.draftVersion !== draft.version || event.pilotContext !== draft.pilotContext || event.actor !== draft.actor || event.createdAt !== draft.createdAt) errors.push("Intended-use event does not match its draft.");
  if (event.providerFirst !== true || event.acceptancesRequired !== 5 || event.acceptancesRecorded !== 0) errors.push("Intended-use acceptance counts are invalid.");
  for (const field of ["executiveSponsorAccepted", "clinicalLeadApproved", "legalApproved", "privacySecurityApproved", "eqpassOwnerAccepted", "disclaimerApproved", "intendedUseFrozen", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"]) {
    if (event[field] !== false) errors.push(`${field} must remain false.`);
  }
  if (typeof event.note !== "string" || event.note.length < 80 || event.note.length > 360) errors.push("Intended-use event note is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Intended-use event fingerprint is invalid.");
  return [...new Set(errors)];
}

export function intendedUseStatus({ drafts = [], chain, generatedAt = new Date().toISOString() }) {
  const latestDraft = drafts.at(-1) || null;
  return {
    contractVersion: INTENDED_USE_CONTRACT,
    status: latestDraft ? "working-charter-recorded" : "definition-required-before-legal-review",
    headline: "Define the job before approving the language.",
    descriptor: "Provider-first intended use · immutable working drafts",
    contexts: clone(INTENDED_USE_CONTEXTS),
    audiences: clone(INTENDED_USE_AUDIENCES),
    prohibitedUses: clone(INTENDED_USE_PROHIBITIONS),
    requiredAcceptances: clone(INTENDED_USE_ACCEPTANCES),
    fixedCharter: clone(FIXED_CHARTER),
    charterFingerprint: intendedUseCharterFingerprint(),
    latestDraft: clone(latestDraft),
    history: drafts.map(draft => ({ id: draft.id, version: draft.version, pilotContext: draft.pilotContext, actor: draft.actor, createdAt: draft.createdAt, hash: draft.hash })),
    counts: {
      drafts: drafts.length,
      audiences: INTENDED_USE_AUDIENCES.length,
      prohibitedUses: INTENDED_USE_PROHIBITIONS.length,
      acceptancesRequired: INTENDED_USE_ACCEPTANCES.length,
      acceptancesRecorded: 0
    },
    executiveSponsorAccepted: false,
    clinicalLeadApproved: false,
    legalApproved: false,
    privacySecurityApproved: false,
    eqpassOwnerAccepted: false,
    disclaimerApproved: false,
    intendedUseFrozen: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    chain: clone(chain),
    generatedAt,
    boundary: INTENDED_USE_BOUNDARY
  };
}
