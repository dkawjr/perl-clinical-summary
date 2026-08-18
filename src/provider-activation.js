import { createHash, randomUUID } from "node:crypto";

export const PROVIDER_ACTIVATION_CONTRACT = "perl-provider-activation-workbook/1.0";

export const PROVIDER_ACTIVATION_BOUNDARY = "This workbook is a local, source-backed rehearsal plan for the August provider training and objectives-before-use instruction in Dolores’s March 30, 2026 correspondence. It does not verify a site, counselor, license, trainer, facilitator, participant, authority, date, venue, roster, attendance, comprehension, competency, completion, intended-use acceptance, language acceptance, support route, data path, agreement, pilot, outcome, renewal, production release, or patient use; ingest identities, records, Findings content, files, credentials, signatures, attestations, or PHI; conduct or schedule a session; issue continuing-education credit; replace site policy, clinical supervision, emergency procedure, legal review, or accessibility accommodation; or permit a care decision. The agenda, time boxes, learning objectives, synthetic drills, observation standard, and evidence-return list are working design controls rather than source-reported commitments. A sealed local snapshot proves only which rehearsal workbook and evidence references were assembled at that moment. Named authorities must accept the exact objectives, facilitate and observe the session, return governed evidence, close every admission gate, and separately authorize the bounded site before any live use.";

const freeze = value => Object.freeze(value);
const item = (id, index, label, detail, extra = {}) => freeze({ id, index, label, detail, ...extra });

export const ACTIVATION_MODULES = freeze([
  item("scope-and-role", "01", "Hold the boundary", "Separate PERL’s provider-side decision support from the unchanged e-QPASS Findings authority, then identify prohibited uses and the human-review obligation.", { workingMinutes: 20, source: "pilot-operations-training-module" }),
  item("review-workflow", "02", "Read the evidence trail", "Move from source scores to evidence-linked summary, inspect the clinical interpretation, correct or return it, and preserve only the reviewed artifact.", { workingMinutes: 30, source: "pilot-operations-training-module" }),
  item("safety-and-escalation", "03", "Route the hard moment", "Recognize a critical-screen hold, perform the required direct review, invoke stop or incident paths, and leave restart authority with the named clinical owner.", { workingMinutes: 30, source: "pilot-operations-training-module" }),
  item("feedback-and-data-quality", "04", "Leave a usable trace", "Record structured correction reasons, distinguish activity from outcomes, preserve denominators, and route evidence into quarterly review and governed change control.", { workingMinutes: 20, source: "pilot-operations-training-module" })
]);

export const ACTIVATION_OBJECTIVES = freeze([
  item("state-intended-use", "01", "State the intended use", "Explain what PERL supports, what the unchanged Findings report still controls, and why PERL does not diagnose, prescribe, or make an autonomous care decision."),
  item("choose-audience", "02", "Choose the minimum audience", "Distinguish clinician, care-coordination, payer, and administrative formats and select only the minimum-necessary presentation for the approved purpose."),
  item("trace-evidence", "03", "Trace every claim", "Move from narrative and hypothesis language back to the exact score, subscale, or source-screen evidence before disposition."),
  item("complete-review", "04", "Complete a review disposition", "Approve only after the evidence, language, structured interpretation, and required safety acknowledgement are reviewed; otherwise return with a structured reason."),
  item("route-critical", "05", "Route critical screens", "Demonstrate direct critical-screen review and preserve the hold until the accepted clinical response and acknowledgement are complete."),
  item("handle-change", "06", "Handle change and supersession", "Recognize that relevant edits, feedback, or a source rescore reopen approval and make an older preparation historical."),
  item("operate-downtime", "07", "Operate a safe hold", "When generation, integration, delivery, or evidence integrity is unavailable, stop the affected path without inventing a result or bypassing review."),
  item("record-learning", "08", "Record bounded learning", "Use structured corrections, denominator-first measures, and incident evidence without translating preference or low editing into accuracy, reliability, or patient benefit.")
]);

export const ACTIVATION_DRILLS = freeze([
  freeze({
    id: "evidence-review",
    index: "A",
    label: "The ordinary review",
    fixture: "FF-TEST-2411-C",
    surface: "Summary Review",
    prompt: "Inspect the evidence-linked draft, trace two statements to source scores, choose the clinician audience, and identify whether approval prerequisites are satisfied.",
    observable: ["Names the unchanged Findings authority", "Traces two claims to visible evidence", "Uses an explicit disposition rather than assuming review"],
    critical: false,
    syntheticOnly: true
  }),
  freeze({
    id: "critical-route",
    index: "B",
    label: "The critical hold",
    fixture: "FF-TEST-2407-A",
    surface: "Summary Review · Safety",
    prompt: "Find the non-zero critical screen, explain why generated prose is not the response, and demonstrate the direct-review, acknowledgement, escalation, and stop sequence.",
    observable: ["Finds the source critical-screen evidence", "Keeps approval held before acknowledgement", "Names the site-owned escalation and restart authority"],
    critical: true,
    syntheticOnly: true
  }),
  freeze({
    id: "approval-reopened",
    index: "C",
    label: "The changed artifact",
    fixture: "FF-TEST-2388-B",
    surface: "Summary Review · Audit",
    prompt: "Inspect an approved synthetic artifact, identify which changes reopen approval, and distinguish the current artifact from a historical preparation.",
    observable: ["Identifies approval-time provenance", "Explains why relevant change reopens approval", "Does not attach or reuse a superseded artifact"],
    critical: false,
    syntheticOnly: true
  }),
  freeze({
    id: "delivery-hold",
    index: "D",
    label: "The unavailable connector",
    fixture: "synthetic-disabled-connector",
    surface: "Governance · Delivery outbox",
    prompt: "Respond to a held delivery path, preserve the no-write state, identify retry/dead-letter evidence, and show where production authority must enter.",
    observable: ["Does not bypass the disabled connector", "Separates preparation from remote attachment", "Escalates without claiming delivery or patient use"],
    critical: true,
    syntheticOnly: true
  })
]);

export const ACTIVATION_OBSERVATION_STANDARD = freeze([
  item("observed", "01", "Observed", "A named, qualified facilitator directly observes the required behavior in the accepted environment and records the governed evidence reference."),
  item("needs-rehearsal", "02", "Needs rehearsal", "The behavior is incomplete or ambiguous; repeat the synthetic drill after correction. This is not a disciplinary or licensure finding."),
  item("critical-miss", "03", "Critical miss", "Any bypass of a critical hold, invented result, unauthorized disclosure, or unsupported approval stops completion and requires the accepted escalation path."),
  item("not-observed", "04", "Not observed", "No evidence means no completion. Attendance, familiarity, or self-attestation alone cannot substitute for observation.")
]);

export const ACTIVATION_REQUIRED_RETURNS = freeze([
  item("accepted-objectives", "01", "Accepted objectives", "Clinical, product, legal, accessibility, and site owners accept the exact learning objectives and prohibited-use boundary."),
  item("named-facilitator", "02", "Named facilitator", "A qualified facilitator and backup are authenticated with role, scope, and session responsibility."),
  item("counselor-roster", "03", "Counselor roster", "The minimum-necessary participant roster and reviewer roles are governed outside this sandbox."),
  item("license-and-role", "04", "License and role check", "The site verifies reviewer qualifications and role authorization; PERL does not infer licensure."),
  item("scheduled-session", "05", "Session record", "Date, time, accessible venue, support channel, and approved materials are confirmed by the site."),
  item("attendance-evidence", "06", "Attendance evidence", "The site preserves an approved attendance record without placing participant identities in this sandbox."),
  item("objective-observations", "07", "Objective observations", "Each participant has governed, facilitator-observed evidence for all eight objectives."),
  item("critical-drill-pass", "08", "Critical drill evidence", "Both critical drills are observed without a critical miss; any miss remains unresolved until accepted remediation."),
  item("accommodation-check", "09", "Accessibility and accommodation check", "Materials, environment, assistive technology, and requested accommodations are accepted before the session."),
  item("support-and-escalation", "10", "Support and escalation path", "Named clinical, technical, privacy/security, and operational contacts accept availability, stop, incident, and restart duties.")
]);

const clone = value => structuredClone(value);
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function digest(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

export function validateProviderActivationContract() {
  const errors = [];
  if (ACTIVATION_MODULES.length !== 4 || ACTIVATION_MODULES.reduce((sum, module) => sum + module.workingMinutes, 0) !== 100) errors.push("Activation must contain four modules and a 100-minute working design.");
  if (ACTIVATION_OBJECTIVES.length !== 8 || new Set(ACTIVATION_OBJECTIVES.map(objective => objective.id)).size !== 8) errors.push("Activation must contain eight unique learning objectives.");
  if (ACTIVATION_DRILLS.length !== 4 || ACTIVATION_DRILLS.filter(drill => drill.critical).length !== 2 || ACTIVATION_DRILLS.some(drill => drill.syntheticOnly !== true)) errors.push("Activation must contain four synthetic drills and exactly two critical drills.");
  if (ACTIVATION_OBSERVATION_STANDARD.length !== 4 || ACTIVATION_REQUIRED_RETURNS.length !== 10) errors.push("Activation observation and evidence registers are incomplete.");
  if (PROVIDER_ACTIVATION_BOUNDARY.length < 1050 || !/working design controls/i.test(PROVIDER_ACTIVATION_BOUNDARY) || !/does not verify a site/i.test(PROVIDER_ACTIVATION_BOUNDARY)) errors.push("Provider-activation claim boundary is incomplete.");
  return [...new Set(errors)];
}

function workbookCore(pilotOperations, readiness, evidenceContext) {
  return {
    contractVersion: PROVIDER_ACTIVATION_CONTRACT,
    sourceRegister: {
      direction: "Dolores correspondence · 2026-03-30 · August training and objectives before use",
      sourceReportedTrainingWindow: "August 2026 working target",
      sourceReportedWindowVerified: false,
      workingDesignApproved: false,
      sourceRecordsIncluded: false,
      phiIncluded: false
    },
    operatingContext: {
      pilotOperationsContract: pilotOperations?.contractVersion || "perl-provider-pilot-operations-plan/1.0",
      pilotPlanFingerprint: pilotOperations?.planFingerprint || null,
      candidatePathways: Number(pilotOperations?.counts?.candidatePathways || 2),
      sitesVerified: Number(pilotOperations?.counts?.sitesVerified || 0),
      pilotsAuthorized: Number(pilotOperations?.counts?.pilotsAuthorized || 0),
      localReadinessCurrent: Number(readiness?.current?.gateCounts?.localCurrent || 0),
      externalAccepted: Number(readiness?.current?.gateCounts?.externalAccepted || 0)
    },
    modules: clone(ACTIVATION_MODULES),
    objectives: clone(ACTIVATION_OBJECTIVES),
    drills: clone(ACTIVATION_DRILLS),
    observationStandard: clone(ACTIVATION_OBSERVATION_STANDARD),
    requiredReturns: clone(ACTIVATION_REQUIRED_RETURNS),
    evidenceContext: clone(evidenceContext || {}),
    designState: "working-rehearsal-plan",
    sourceReportedWindowVerified: false,
    siteVerified: false,
    facilitatorAssigned: false,
    rosterReceived: false,
    licensureVerified: false,
    participantsRegistered: false,
    trainingScheduled: false,
    sessionHeld: false,
    attendanceVerified: false,
    objectivesAccepted: false,
    modulesCompleted: false,
    drillsPassed: false,
    completionAccepted: false,
    supportConfirmed: false,
    activationAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: PROVIDER_ACTIVATION_BOUNDARY
  };
}

export function buildProviderActivationWorkbook({ pilotOperations, readiness, evidenceContext = {}, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const errors = validateProviderActivationContract();
  if (errors.length) throw new Error(errors.join(" "));
  const core = workbookCore(pilotOperations, readiness, evidenceContext);
  const workbookFingerprint = digest(core);
  const latest = events.at(-1) || null;
  return {
    ...core,
    status: "working-activation-plan-external-training-acceptance-required",
    headline: "Practice the judgment before the workflow goes live.",
    subhead: "Four modules. Eight observable objectives. Four synthetic drills. No attendance or readiness claim without governed proof.",
    counts: {
      workingMinutes: 100,
      modules: 4,
      objectives: 8,
      drills: 4,
      criticalDrills: 2,
      requiredReturns: 10,
      registeredParticipants: 0,
      completedModules: 0,
      passedDrills: 0,
      acceptedCompletions: 0,
      activatedSites: 0
    },
    workbookFingerprint,
    latestSnapshot: latest ? { sequence: latest.sequence, createdAt: latest.createdAt, actor: latest.actor, hash: latest.hash, current: latest.workbookFingerprint === workbookFingerprint } : null,
    history: clone(events),
    chain: clone(chain),
    generatedAt
  };
}

export function createProviderActivationSnapshot({ workbook, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const cleanActor = String(actor || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(cleanActor)) throw new Error("Actor must be 2–48 safe characters.");
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: PROVIDER_ACTIVATION_CONTRACT,
    type: "provider-activation-workbook-snapshot-recorded",
    status: "working-activation-plan-external-training-acceptance-required",
    workbookFingerprint: workbook.workbookFingerprint,
    counts: clone(workbook.counts),
    evidenceContext: clone(workbook.evidenceContext),
    decision: "training-completion-and-site-activation-remain-external",
    sourceReportedWindowVerified: false,
    siteVerified: false,
    facilitatorAssigned: false,
    rosterReceived: false,
    licensureVerified: false,
    participantsRegistered: false,
    trainingScheduled: false,
    sessionHeld: false,
    attendanceVerified: false,
    objectivesAccepted: false,
    modulesCompleted: false,
    drillsPassed: false,
    completionAccepted: false,
    supportConfirmed: false,
    activationAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor: cleanActor,
    createdAt,
    note: "Local workbook snapshot only. It pins the working provider-training design and current evidence references without scheduling or conducting a session, registering participants, verifying attendance or competency, accepting objectives or completion, activating a site, or authorizing clinical use."
  };
  return { ...core, hash: digest(core) };
}

export function validateProviderActivationSnapshot(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Provider-activation snapshot is required."];
  if (event.contractVersion !== PROVIDER_ACTIVATION_CONTRACT || event.type !== "provider-activation-workbook-snapshot-recorded") errors.push("Provider-activation snapshot contract is invalid.");
  if (event.sequence !== sequence || event.previousHash !== previousHash || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Provider-activation snapshot chain position is invalid.");
  if (!/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || "")) || !/^[a-f0-9]{64}$/.test(String(event.workbookFingerprint || ""))) errors.push("Provider-activation fingerprint is invalid.");
  if (event.status !== "working-activation-plan-external-training-acceptance-required" || event.decision !== "training-completion-and-site-activation-remain-external") errors.push("Provider-activation snapshot overstates its disposition.");
  const falseFields = ["sourceReportedWindowVerified", "siteVerified", "facilitatorAssigned", "rosterReceived", "licensureVerified", "participantsRegistered", "trainingScheduled", "sessionHeld", "attendanceVerified", "objectivesAccepted", "modulesCompleted", "drillsPassed", "completionAccepted", "supportConfirmed", "activationAuthorized", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"];
  for (const field of falseFields) if (event[field] !== false) errors.push(`${field} must remain false.`);
  if (event.counts?.workingMinutes !== 100 || event.counts?.modules !== 4 || event.counts?.objectives !== 8 || event.counts?.drills !== 4 || event.counts?.criticalDrills !== 2 || event.counts?.requiredReturns !== 10 || event.counts?.registeredParticipants !== 0 || event.counts?.acceptedCompletions !== 0 || event.counts?.activatedSites !== 0) errors.push("Provider-activation snapshot counts are invalid.");
  if (!event.evidenceContext || typeof event.evidenceContext !== "object" || Array.isArray(event.evidenceContext)) errors.push("Provider-activation evidence context is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || "")) || !Number.isFinite(Date.parse(event.createdAt))) errors.push("Provider-activation actor or timestamp is invalid.");
  if (String(event.note || "").length < 220) errors.push("Provider-activation non-authorization note is incomplete.");
  const { hash, ...core } = event;
  if (hash !== digest(core)) errors.push("Provider-activation snapshot hash is invalid.");
  return [...new Set(errors)];
}

const list = (items, render) => items.map(render).join("");

export function renderProviderActivationWorkbook(workbook) {
  if (!workbook?.workbookFingerprint || workbook.contractVersion !== PROVIDER_ACTIVATION_CONTRACT) throw new Error("A current provider-activation workbook is required.");
  const modules = list(workbook.modules, module => `<li><span>${escapeHtml(module.index)}</span><div><strong>${escapeHtml(module.label)}</strong><p>${escapeHtml(module.detail)}</p><small>${escapeHtml(module.workingMinutes)} min · working design</small></div></li>`);
  const objectives = list(workbook.objectives, objective => `<li><span>${escapeHtml(objective.index)}</span><div><strong>${escapeHtml(objective.label)}</strong><p>${escapeHtml(objective.detail)}</p></div></li>`);
  const drills = list(workbook.drills, drill => `<article><header><span>${escapeHtml(drill.index)}</span><div><h3>${escapeHtml(drill.label)}</h3><small>${escapeHtml(drill.fixture)} · ${escapeHtml(drill.surface)}</small></div><em>${drill.critical ? "CRITICAL" : "STANDARD"}</em></header><p>${escapeHtml(drill.prompt)}</p><ul>${drill.observable.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></article>`);
  const observation = list(workbook.observationStandard, item => `<li><span>${escapeHtml(item.index)}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p></div></li>`);
  const returns = list(workbook.requiredReturns, item => `<li><span>${escapeHtml(item.index)}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p></div><i>OPEN</i></li>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PERL Provider Activation Workbook</title><link rel="stylesheet" href="/provider-activation.css"></head><body>
  <nav class="activation-toolbar" aria-label="Activation workbook actions"><a href="/">Return to PERL</a><span>Provider activation workbook · synthetic rehearsal only</span><button id="print-provider-activation" type="button">Print workbook</button></nav>
  <main>
    <section class="activation-sheet activation-cover" aria-label="Page 1 of 4"><header><span>Focused Future® · PERL</span><small>Page 01 / 04</small></header><div class="cover-grid"><div><p class="kicker">Provider activation · working rehearsal</p><h1>Practice the judgment before the workflow goes live.</h1><p class="standfirst">Four modules. Eight observable objectives. Four synthetic drills. No attendance, competency, or site-readiness claim without governed proof.</p></div><div class="activation-seal"><span>AUG</span><strong>00</strong><small>ACTIVATED SITES</small></div></div><div class="cover-register"><article><span>Source direction</span><strong>August training</strong><p>Dolores’s March 30, 2026 correspondence calls for counselor training and objectives fixed before use.</p></article><article><span>Working design</span><strong>100 minutes</strong><p>A facilitator-led rehearsal allocation designed here; not a source-approved duration or scheduled session.</p></article><article><span>Evidence state</span><strong>0 completions</strong><p>No roster, attendance, observation, acceptance, activation, or live-use record is present.</p></article></div><div class="activation-thesis"><span>THE RULE</span><blockquote>Attendance is presence. Activation requires observed judgment, accepted evidence, and separate site authority.</blockquote></div><footer><code>${escapeHtml(workbook.workbookFingerprint.slice(0, 24))}…</code><p>Source-reported August target · not verified or scheduled</p></footer></section>
    <section class="activation-sheet activation-agenda" aria-label="Page 2 of 4"><header><span>PERL · Run of show</span><small>Page 02 / 04</small></header><div class="sheet-title"><span>01 / TEACH</span><h2>Make the boundary executable.</h2><p>Every module ends in an observable action. The time boxes are working design controls.</p></div><div class="agenda-grid"><section><h3>Four modules · 100 minutes</h3><ol class="module-list">${modules}</ol></section><section><h3>Eight objectives before use</h3><ol class="objective-list">${objectives}</ol></section></div><footer><p>Named authorities must accept the objectives and materials before a real session.</p></footer></section>
    <section class="activation-sheet activation-drills" aria-label="Page 3 of 4"><header><span>PERL · Synthetic drills</span><small>Page 03 / 04</small></header><div class="sheet-title"><span>02 / OBSERVE</span><h2>Rehearse the moment that can fail.</h2><p>All fixtures are synthetic. A critical miss stops completion; no average can erase it.</p></div><div class="drill-grid">${drills}</div><div class="observation-band"><h3>Observation language</h3><ol>${observation}</ol></div><footer><p>Preference, speed, or low editing cannot substitute for safe behavior.</p></footer></section>
    <section class="activation-sheet activation-evidence" aria-label="Page 4 of 4"><header><span>PERL · Completion evidence</span><small>Page 04 / 04</small></header><div class="sheet-title"><span>03 / AUTHORIZE</span><h2>Bring back proof—not a training claim.</h2><p>These ten returns remain governed outside the sandbox. All are open.</p></div><ol class="return-ledger">${returns}</ol><div class="activation-boundary"><strong>Non-activation boundary</strong><p>${escapeHtml(workbook.boundary)}</p></div><footer><code>CHAIN ${escapeHtml(String(workbook.chain?.count || 0))} · ${escapeHtml(workbook.contractVersion)}</code><p>Training completion and site activation remain external.</p></footer></section>
  </main><script src="/provider-activation-print.js"></script></body></html>`;
}
