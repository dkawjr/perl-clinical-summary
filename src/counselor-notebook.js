import { createHash, randomUUID } from "node:crypto";

export const COUNSELOR_NOTEBOOK_CONTRACT = "perl-counselor-session-notebook/1.0";

export const COUNSELOR_NOTEBOOK_BOUNDARY = "This notebook records structured local rehearsal notes against synthetic PERL evidence. It contains no counselor names, credentials, attendance, meeting transcript, patient narrative, raw response, Findings content, or PHI; it does not authenticate a counselor, prove that a session occurred, establish training completion, accept a clinical decision or counselor reference, freeze a protocol, complete independent review, establish accuracy, reliability, or clinical validity, authorize a pilot or production release, or permit patient use. Every entry is a non-authorizing rehearsal observation for a future governed session.";

export const COUNSELOR_NOTEBOOK_DISPOSITIONS = Object.freeze([
  Object.freeze({ id: "carry-forward-for-rehearsal", label: "Carry forward for rehearsal" }),
  Object.freeze({ id: "revise-before-next-rehearsal", label: "Revise before next rehearsal" }),
  Object.freeze({ id: "defer-awaiting-evidence", label: "Defer · evidence missing" }),
  Object.freeze({ id: "stopping-concern", label: "Stopping concern" })
]);

export const COUNSELOR_NOTEBOOK_FINDINGS = Object.freeze([
  Object.freeze({ id: "source-supported", label: "Supported by current source evidence" }),
  Object.freeze({ id: "needs-more-evidence", label: "More evidence required" }),
  Object.freeze({ id: "overreach-risk", label: "Overreach risk" }),
  Object.freeze({ id: "omission-risk", label: "Omission risk" }),
  Object.freeze({ id: "workflow-friction", label: "Workflow friction" }),
  Object.freeze({ id: "reviewer-disagreement", label: "Reviewer disagreement" }),
  Object.freeze({ id: "external-prerequisite-missing", label: "External prerequisite missing" })
]);

export const COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES = Object.freeze([
  Object.freeze({ id: "synthetic-regression", label: "Synthetic safety regression" }),
  Object.freeze({ id: "blind-outcome-ledger", label: "Blind outcome ledger" }),
  Object.freeze({ id: "reviewer-feedback-ledger", label: "Reviewer feedback ledger" }),
  Object.freeze({ id: "revision-ledger", label: "Clinical revision ledger" }),
  Object.freeze({ id: "safety-incident-ledger", label: "Safety incident ledger" }),
  Object.freeze({ id: "workflow-timing-ledger", label: "Workflow timing ledger" }),
  Object.freeze({ id: "source-contract-rfi", label: "Source contract RFI" }),
  Object.freeze({ id: "no-local-evidence", label: "No local evidence yet" })
]);

export const COUNSELOR_NOTEBOOK_SESSIONS = Object.freeze([
  Object.freeze({
    id: "language-safety",
    index: "01",
    label: "Language + safety",
    title: "Set the clinical voice.",
    decisions: Object.freeze([
      Object.freeze({ id: "indicator-language", label: "Indicator language", question: "Does the language remain useful without becoming diagnostic or certain?" }),
      Object.freeze({ id: "uncertainty-pattern", label: "Uncertainty pattern", question: "Does every interpretation tell the counselor what still needs verification?" }),
      Object.freeze({ id: "evidence-citation", label: "Evidence citation", question: "Can each claim be traced to a scored scale, subscale, or critical flag?" }),
      Object.freeze({ id: "critical-screen-route", label: "Critical-screen route", question: "Does a non-zero critical screen interrupt interpretation and force direct review?" }),
      Object.freeze({ id: "prohibited-claims", label: "Prohibited claims", question: "Are unsupported diagnoses, prescriptions, and certainty phrases kept out?" })
    ])
  }),
  Object.freeze({
    id: "usefulness-workflow",
    index: "02",
    label: "Evidence + workflow",
    title: "Test the next conversation.",
    decisions: Object.freeze([
      Object.freeze({ id: "source-fidelity", label: "Source fidelity", question: "Does the page preserve the meaning and severity of the scored Findings evidence?" }),
      Object.freeze({ id: "clinical-restraint", label: "Clinical restraint", question: "Does the summary avoid conclusions the scored evidence cannot support?" }),
      Object.freeze({ id: "next-conversation-utility", label: "Next-conversation utility", question: "Does the page help a counselor decide what to clarify next?" }),
      Object.freeze({ id: "correction-burden", label: "Correction burden", question: "Are material edits visible, categorized, and small enough to review safely?" }),
      Object.freeze({ id: "workflow-time", label: "Workflow time", question: "Is assisted review measured against the same task without hiding pauses or exclusions?" })
    ])
  }),
  Object.freeze({
    id: "freeze-handoff",
    index: "03",
    label: "Freeze + handoff",
    title: "Close the local questions.",
    decisions: Object.freeze([
      Object.freeze({ id: "reference-readiness", label: "Reference readiness", question: "Are counselor references versioned, attributable, adjudicated, and externally acceptable?" }),
      Object.freeze({ id: "change-register", label: "Change register", question: "Is every material pattern carried, revised, deferred, or stopped with evidence?" }),
      Object.freeze({ id: "analysis-plan-readiness", label: "Analysis-plan readiness", question: "Are denominators, thresholds, stopping rules, and missingness fixed before holdout review?" }),
      Object.freeze({ id: "unresolved-risk", label: "Unresolved risk", question: "Does the handoff expose every open safety, source, workflow, and authority limitation?" }),
      Object.freeze({ id: "independent-handoff", label: "Independent handoff", question: "Can an outside evaluator reconstruct the exact local evidence without borrowing a decision?" })
    ])
  })
]);

const DISPOSITIONS = new Set(COUNSELOR_NOTEBOOK_DISPOSITIONS.map(item => item.id));
const FINDINGS = new Set(COUNSELOR_NOTEBOOK_FINDINGS.map(item => item.id));
const EVIDENCE_SOURCES = new Set(COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES.map(item => item.id));
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const SYNTHETIC_ID = /^FF-TEST-[A-Z0-9-]{3,40}$/;
const HEX = /^[a-f0-9]{64}$/;

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

function sessionFor(sessionId) {
  return COUNSELOR_NOTEBOOK_SESSIONS.find(session => session.id === sessionId) || null;
}

function decisionFor(sessionId, decisionId) {
  return sessionFor(sessionId)?.decisions.find(decision => decision.id === decisionId) || null;
}

export function validateCounselorNotebookContract() {
  const errors = [];
  if (COUNSELOR_NOTEBOOK_SESSIONS.length !== 3) errors.push("The counselor notebook requires three fixed sessions.");
  if (COUNSELOR_NOTEBOOK_SESSIONS.some(session => session.decisions.length !== 5)) errors.push("Every notebook session requires five fixed decision questions.");
  const decisionIds = COUNSELOR_NOTEBOOK_SESSIONS.flatMap(session => session.decisions.map(decision => `${session.id}:${decision.id}`));
  if (new Set(decisionIds).size !== 15) errors.push("Notebook decision identities must be unique.");
  if (COUNSELOR_NOTEBOOK_DISPOSITIONS.length !== 4 || COUNSELOR_NOTEBOOK_FINDINGS.length !== 7 || COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES.length !== 8) errors.push("Notebook option registers are incomplete.");
  if (COUNSELOR_NOTEBOOK_BOUNDARY.length < 420 || !/does not authenticate a counselor/i.test(COUNSELOR_NOTEBOOK_BOUNDARY)) errors.push("The counselor notebook boundary is incomplete.");
  return errors;
}

export function validateCounselorNotebookInput(input) {
  const errors = [];
  const keys = ["sessionId", "decisionId", "disposition", "finding", "evidenceSource", "assessmentId"];
  if (!exactKeys(input, keys, "Notebook entry", errors)) return errors;
  if (!sessionFor(input.sessionId)) errors.push("sessionId must name one of the three Counselor Lab sessions.");
  if (!decisionFor(input.sessionId, input.decisionId)) errors.push("decisionId must belong to the selected session.");
  if (!DISPOSITIONS.has(input.disposition)) errors.push("disposition is outside the fixed rehearsal register.");
  if (!FINDINGS.has(input.finding)) errors.push("finding is outside the fixed observation register.");
  if (!EVIDENCE_SOURCES.has(input.evidenceSource)) errors.push("evidenceSource is outside the fixed evidence register.");
  if (input.assessmentId !== null && !SYNTHETIC_ID.test(String(input.assessmentId || ""))) errors.push("assessmentId must be null or a visibly synthetic FF-TEST reference.");
  return [...new Set(errors)];
}

function validateEvidenceSnapshot(snapshot, errors) {
  const keys = ["counts", "heads", "caseSet", "sourceContractStatus"];
  if (!exactKeys(snapshot, keys, "evidenceSnapshot", errors)) return;
  const countKeys = ["pairedBlindComparisons", "structuredFeedbackEntries", "revisions", "workflowTimingObservations", "openSafetyIncidents"];
  if (exactKeys(snapshot.counts, countKeys, "evidenceSnapshot.counts", errors)) {
    for (const key of countKeys) if (!Number.isInteger(snapshot.counts[key]) || snapshot.counts[key] < 0) errors.push(`evidenceSnapshot.counts.${key} must be a non-negative integer.`);
  }
  const headKeys = ["feedback", "revisions", "blindOutcomes", "incidents", "workflowTiming"];
  if (exactKeys(snapshot.heads, headKeys, "evidenceSnapshot.heads", errors)) {
    for (const key of headKeys) if (snapshot.heads[key] !== null && !HEX.test(String(snapshot.heads[key] || ""))) errors.push(`evidenceSnapshot.heads.${key} must be null or a SHA-256 digest.`);
  }
  if (!snapshot.caseSet || typeof snapshot.caseSet !== "object" || Array.isArray(snapshot.caseSet) || Object.keys(snapshot.caseSet).sort().join(",") !== "id,version" || typeof snapshot.caseSet.id !== "string" || typeof snapshot.caseSet.version !== "string") errors.push("evidenceSnapshot.caseSet must contain only the case-set ID and version.");
  if (snapshot.sourceContractStatus !== "proposed-rfi-only") errors.push("sourceContractStatus must remain proposed-rfi-only.");
}

const FALSE_CLAIMS = [
  "counselorIdentityVerified", "attendanceRecorded", "trainingCompleted", "clinicalDecisionAccepted",
  "counselorReferenceAccepted", "protocolFrozen", "independentReviewCompleted", "accuracyEstablished",
  "reliabilityEstablished", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
];

export function createCounselorNotebookEntry({ input, actor, sequence, previousHash = "GENESIS", evidenceSnapshot, createdAt = new Date().toISOString(), id = randomUUID() }) {
  const inputErrors = validateCounselorNotebookInput(input);
  if (inputErrors.length) throw new Error(inputErrors.join(" "));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: COUNSELOR_NOTEBOOK_CONTRACT,
    type: "counselor-session-rehearsal-note-recorded",
    ...clone(input),
    evidenceSnapshot: clone(evidenceSnapshot),
    counselorIdentityVerified: false,
    attendanceRecorded: false,
    trainingCompleted: false,
    clinicalDecisionAccepted: false,
    counselorReferenceAccepted: false,
    protocolFrozen: false,
    independentReviewCompleted: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt,
    note: "Structured local rehearsal observation recorded without counselor identity, attendance, transcript, patient content, clinical acceptance, protocol freeze, or release authority."
  };
  return { ...core, hash: digest(core) };
}

export function validateCounselorNotebookEntry(entry, { sequence = entry?.sequence, previousHash = entry?.previousHash } = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "sessionId", "decisionId", "disposition",
    "finding", "evidenceSource", "assessmentId", "evidenceSnapshot", ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(entry, keys, "Notebook event", errors)) return errors;
  errors.push(...validateCounselorNotebookInput({
    sessionId: entry.sessionId,
    decisionId: entry.decisionId,
    disposition: entry.disposition,
    finding: entry.finding,
    evidenceSource: entry.evidenceSource,
    assessmentId: entry.assessmentId
  }));
  if (entry.contractVersion !== COUNSELOR_NOTEBOOK_CONTRACT) errors.push("Notebook contract version is invalid.");
  if (entry.type !== "counselor-session-rehearsal-note-recorded") errors.push("Notebook event type is invalid.");
  if (!/^[0-9a-f-]{20,40}$/i.test(String(entry.id || ""))) errors.push("Notebook event ID is invalid.");
  if (entry.sequence !== sequence || !Number.isInteger(entry.sequence) || entry.sequence < 1) errors.push("Notebook event sequence is invalid.");
  if (entry.previousHash !== previousHash || (entry.previousHash !== "GENESIS" && !HEX.test(String(entry.previousHash || "")))) errors.push("Notebook previous hash is invalid.");
  validateEvidenceSnapshot(entry.evidenceSnapshot, errors);
  for (const key of FALSE_CLAIMS) if (entry[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(entry.actor || ""))) errors.push("Notebook actor must be a bounded reviewer code.");
  if (Number.isNaN(Date.parse(entry.createdAt))) errors.push("Notebook createdAt is invalid.");
  if (typeof entry.note !== "string" || entry.note.length < 120 || !/without counselor identity/i.test(entry.note)) errors.push("Notebook note boundary is incomplete.");
  const { hash, ...core } = entry;
  if (!HEX.test(String(hash || "")) || digest(core) !== hash) errors.push("Notebook event hash is invalid.");
  return [...new Set(errors)];
}

function labelFor(register, id) {
  return register.find(item => item.id === id)?.label || id;
}

export function buildCounselorNotebook({ entries = [], chain = { valid: true, count: 0, head: null }, assessmentIds = [], generatedAt = new Date().toISOString() } = {}) {
  const latestByDecision = new Map();
  for (const entry of entries) latestByDecision.set(`${entry.sessionId}:${entry.decisionId}`, entry);
  const sessions = COUNSELOR_NOTEBOOK_SESSIONS.map(session => {
    const decisions = session.decisions.map(decision => {
      const latest = latestByDecision.get(`${session.id}:${decision.id}`) || null;
      return {
        ...clone(decision),
        status: latest ? latest.disposition : "not-observed",
        latestSequence: latest?.sequence || null,
        latestFinding: latest?.finding || null,
        latestEvidenceSource: latest?.evidenceSource || null,
        latestAssessmentId: latest?.assessmentId || null
      };
    });
    const covered = decisions.filter(decision => decision.latestSequence !== null).length;
    return {
      id: session.id,
      index: session.index,
      label: session.label,
      title: session.title,
      decisions,
      covered,
      total: decisions.length,
      status: covered === 0 ? "not-observed" : covered === decisions.length ? "local-rehearsal-covered" : "local-rehearsal-in-progress"
    };
  });
  const currentEntries = [...latestByDecision.values()];
  const stoppingConcerns = currentEntries.filter(entry => entry.disposition === "stopping-concern").length;
  const decisionsCovered = currentEntries.length;
  const sessionsTouched = new Set(currentEntries.map(entry => entry.sessionId)).size;
  const catalogCore = {
    contractVersion: COUNSELOR_NOTEBOOK_CONTRACT,
    sessions: COUNSELOR_NOTEBOOK_SESSIONS,
    dispositions: COUNSELOR_NOTEBOOK_DISPOSITIONS,
    findings: COUNSELOR_NOTEBOOK_FINDINGS,
    evidenceSources: COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES,
    boundary: COUNSELOR_NOTEBOOK_BOUNDARY
  };
  return {
    contractVersion: COUNSELOR_NOTEBOOK_CONTRACT,
    status: stoppingConcerns > 0 ? "local-stopping-concern" : entries.length > 0 ? "local-notes-recorded" : "ready-for-synthetic-rehearsal",
    sessions,
    dispositions: clone(COUNSELOR_NOTEBOOK_DISPOSITIONS),
    findings: clone(COUNSELOR_NOTEBOOK_FINDINGS),
    evidenceSources: clone(COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES),
    allowedAssessmentIds: [...new Set(assessmentIds.filter(id => SYNTHETIC_ID.test(String(id))))],
    metrics: {
      notesRecorded: entries.length,
      decisionsCovered,
      totalDecisions: 15,
      sessionsTouched,
      totalSessions: 3,
      stoppingConcerns
    },
    history: clone(entries),
    chain: clone(chain),
    catalogFingerprint: digest(catalogCore),
    counselorIdentityVerified: false,
    attendanceRecorded: false,
    trainingCompleted: false,
    clinicalDecisionAccepted: false,
    counselorReferenceAccepted: false,
    protocolFrozen: false,
    independentReviewCompleted: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    generatedAt,
    headline: "The room leaves a trace—without pretending it convened.",
    boundary: COUNSELOR_NOTEBOOK_BOUNDARY,
    labels: {
      disposition: Object.fromEntries(COUNSELOR_NOTEBOOK_DISPOSITIONS.map(item => [item.id, item.label])),
      finding: Object.fromEntries(COUNSELOR_NOTEBOOK_FINDINGS.map(item => [item.id, item.label])),
      evidenceSource: Object.fromEntries(COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES.map(item => [item.id, item.label])),
      session: Object.fromEntries(COUNSELOR_NOTEBOOK_SESSIONS.map(item => [item.id, item.label])),
      decision: Object.fromEntries(COUNSELOR_NOTEBOOK_SESSIONS.flatMap(session => session.decisions.map(item => [`${session.id}:${item.id}`, item.label])))
    }
  };
}
