import { createHash } from "node:crypto";

export const COUNSELOR_LAB_CONTRACT = "perl-counselor-lab/1.0";

export const COUNSELOR_LAB_BOUNDARY = "This read-only working-session plan translates source-reported counselor availability and the current synthetic evidence into a governed review sequence. It does not register or authenticate a counselor, schedule or prove attendance at a session, accept a counselor reference, convert reviewer codes into clinical credentials, establish training completion, freeze a clinical protocol, complete independent review, demonstrate accuracy or reliability, establish clinical validity, or authorize pilot, production, or patient use.";

const SOURCE_BASIS = Object.freeze([
  Object.freeze({
    id: "proposal-working-sessions",
    source: "Focused Future — AI Clinical Summary Tool Proposal · July 2026",
    fact: "The proposed build includes two to three guided sessions with Dolores and counselors, report samples, counselor interpretation notes, and language and tone guidance.",
    status: "source-reported"
  }),
  Object.freeze({
    id: "dolores-review-loop",
    source: "Dolores product update · 12 January 2026",
    fact: "Live reviewers should assess general accuracy, return structured feedback, support modification and further testing, and precede independent accuracy and reliability review.",
    status: "source-reported"
  }),
  Object.freeze({
    id: "dolores-counselor-availability",
    source: "Dolores product update · 13 August 2026",
    fact: "Counselors are available for review and training; no roster, qualifications, conflicts, schedule, or acceptance record is connected to this sandbox.",
    status: "source-reported-unregistered"
  })
]);

const PREFLIGHT_RETURNS = Object.freeze([
  "Named clinical lead and counselor-panel roster with qualifications, roles, conflicts, and permitted-use attestations.",
  "Approved de-identified Findings-report samples linked to authoritative scoring and report versions.",
  "Versioned counselor interpretation notes with authorship, case linkage, and intended-use restrictions.",
  "Accepted indicator-language, tone, uncertainty, disclaimer, and prohibited-claim guidance.",
  "Direct critical-screen review and escalation route, including the accountable clinical owner.",
  "Frozen development-case manifest, reviewer allocation, blind protocol, and adjudication method.",
  "Predeclared session objectives, attendance record, decision rights, stopping rules, and completion criteria.",
  "Named independent evaluator and approved handoff format for accuracy and reliability review."
]);

const SESSION_BLUEPRINT = Object.freeze([
  Object.freeze({
    id: "language-safety",
    index: "01",
    eyebrow: "Language + safety",
    title: "Set the clinical voice before judging the model.",
    intent: "Align on what the Findings report supports, which phrases remain indicators, how uncertainty is expressed, and where direct counselor review must interrupt interpretation.",
    entryGate: "Clinical lead, counselor roster, approved samples, tone guide, and critical-screen route returned.",
    agenda: Object.freeze([
      "Read the same scored Findings source without model authorship cues.",
      "Mark supported, ambiguous, missing, overreaching, and unsafe language.",
      "Agree the minimum evidence citation and direct-review pattern.",
      "Record disagreements without averaging away a safety concern."
    ]),
    outputs: Object.freeze([
      "Versioned language and tone rules",
      "Prohibited-phrase and omission register",
      "Critical-screen escalation rule",
      "Open disagreements with named adjudicator"
    ]),
    workingSurface: Object.freeze({ label: "Open blind language rehearsal", href: "#comparison-form" })
  }),
  Object.freeze({
    id: "usefulness-workflow",
    index: "02",
    eyebrow: "Evidence + workflow",
    title: "Test whether the page changes the next conversation.",
    intent: "Run balanced, blinded comparisons and matched workflow tasks so fidelity, restraint, usefulness, correction burden, and review time remain separate measures.",
    entryGate: "Session 01 decisions versioned; development cases frozen; blind allocation and stopping rules active.",
    agenda: Object.freeze([
      "Rate counselor-reference and PERL summaries before author reveal.",
      "Return structured corrections and a rationale for every material edit.",
      "Complete matched unaided and PERL-assisted workflow tasks.",
      "Pause on any unresolved high-severity or critical incident."
    ]),
    outputs: Object.freeze([
      "Paired blind ratings and preferences",
      "Hash-linked correction taxonomy",
      "Matched workflow observations",
      "Incident, pause, and exposure record"
    ]),
    workingSurface: Object.freeze({ label: "Open matched workflow rehearsal", href: "#timing-lane-title" })
  }),
  Object.freeze({
    id: "freeze-handoff",
    index: "03",
    eyebrow: "Freeze + handoff",
    title: "Close decisions before an independent reviewer opens the file.",
    intent: "Adjudicate material patterns, freeze accepted counselor references and the analysis plan, expose unresolved risks, and prepare an evidence-pinned independent-review packet.",
    entryGate: "Required denominators met on approved cases, correction patterns adjudicated, safety events resolved, and independent evaluator named.",
    agenda: Object.freeze([
      "Review denominator-first evidence and repeated-review agreement.",
      "Accept, reject, or defer each material language and workflow pattern.",
      "Freeze reference, prompt, rule, case-set, and analysis-plan versions.",
      "Record a continue, revise, or pause disposition for independent review."
    ]),
    outputs: Object.freeze([
      "Signed counselor-reference freeze",
      "Accepted and deferred change register",
      "Locked protocol and analysis plan",
      "Unresolved-risk and limitation register",
      "Independent-review handoff fingerprint"
    ]),
    workingSurface: Object.freeze({ label: "Open evidence board", href: "#study-board-title" })
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function countEvidenceStreams(integrity = {}) {
  return ["feedback", "revisions", "blindOutcomes", "incidents", "workflowTiming"]
    .filter(key => Number(integrity?.[key]?.count || 0) > 0).length;
}

export function validateCounselorLabContract() {
  const errors = [];
  if (SESSION_BLUEPRINT.length !== 3) errors.push("Counselor Lab requires exactly three ordered sessions.");
  if (new Set(SESSION_BLUEPRINT.map(item => item.id)).size !== SESSION_BLUEPRINT.length) errors.push("Counselor Lab session IDs must be unique.");
  if (PREFLIGHT_RETURNS.length !== 8) errors.push("Counselor Lab requires exactly eight preflight returns.");
  if (SOURCE_BASIS.length !== 3) errors.push("Counselor Lab requires exactly three source-basis records.");
  if (SESSION_BLUEPRINT.some(item => item.agenda.length !== 4 || item.outputs.length < 4)) errors.push("Every Counselor Lab session requires four agenda steps and at least four outputs.");
  if (COUNSELOR_LAB_BOUNDARY.length < 260) errors.push("Counselor Lab claim boundary is incomplete.");
  return errors;
}

export function buildCounselorLab({ analysis, refinement, manifestPackage, generatedAt = new Date().toISOString() } = {}) {
  const contractErrors = validateCounselorLabContract();
  if (contractErrors.length) throw new Error(contractErrors.join(" "));
  const sample = analysis?.sample || {};
  const caseSet = analysis?.caseSet || {};
  const integrity = analysis?.integrity || {};
  const manifest = manifestPackage?.manifest || {};
  const manifestIntegrity = manifestPackage?.integrity || {};
  const currentEvidence = {
    sourceReportedCounselorsAvailable: true,
    namedCounselorsRegistered: 0,
    authenticatedClinicalReviewers: 0,
    sandboxReviewerCodesObserved: Number(sample.reviewers || 0),
    sessionsScheduled: 0,
    sessionsCompleted: 0,
    syntheticCases: Number(caseSet.cases || 0),
    pairedBlindComparisons: Number(sample.pairedComparisons || 0),
    structuredFeedbackEntries: Number(sample.feedbackEntries || 0),
    revisions: Number(sample.revisions || 0),
    workflowTimingObservations: Number(sample.workflowTimingObservations || 0),
    evidenceStreamsWithEntries: countEvidenceStreams(integrity),
    refinementSignals: Number(refinement?.signals?.length || 0),
    unresolvedHighSeverityIncidents: Number(analysis?.safety?.unresolvedHighSeverity || 0),
    manifestId: caseSet.id || manifest.id || null,
    manifestVersion: caseSet.version || manifest.version || null,
    manifestHash: manifestIntegrity.manifestHash || null,
    holdoutValid: false,
    clinicalReleaseEligible: false
  };
  const sessions = SESSION_BLUEPRINT.map((session, index) => ({
    ...clone(session),
    status: index === 1 && currentEvidence.syntheticCases > 0 ? "synthetic-rehearsal-available" : "blocked-awaiting-external-evidence",
    attendanceRecorded: false,
    accepted: false,
    completed: false
  }));
  const packetCore = {
    contractVersion: COUNSELOR_LAB_CONTRACT,
    sourceBasis: SOURCE_BASIS,
    strategy: {
      selectedSessionCount: 3,
      permittedRange: "2–3 guided sessions",
      rationale: "Use three sessions to keep language and safety decisions, blinded workflow evidence, and protocol freeze under separate decision gates."
    },
    currentEvidence,
    sessions,
    preflightReturns: PREFLIGHT_RETURNS,
    rosterAccepted: false,
    attendanceRecorded: false,
    trainingCompleted: false,
    counselorReferencesAccepted: false,
    protocolFrozen: false,
    independentReviewComplete: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorizationRecorded: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: COUNSELOR_LAB_BOUNDARY
  };
  return {
    ...clone(packetCore),
    status: "awaiting-named-counselor-panel",
    generatedAt,
    headline: "Three sessions. One evidence trail. No borrowed authority.",
    nextDecision: "Dolores and the clinical lead return the named counselor roster, approved samples, tone guide, direct-review route, session decision rights, and independent evaluator before Session 01 is represented as a clinical working session.",
    packetFingerprint: digest(packetCore)
  };
}
