import { createHash, randomUUID } from "node:crypto";
import { PILOT_READINESS_GATES } from "./pilot-readiness.js";

export const PILOT_OPERATIONS_CONTRACT = "perl-provider-pilot-operations-plan/1.0";

export const PILOT_OPERATIONS_BOUNDARY = "This studio converts source correspondence into a bounded provider-pilot working plan. It does not verify a site, student population, caseload, counselor roster, licensure, authority, budget, contract, training attendance, e-QPASS access, data path, consent basis, privacy or security acceptance, accessibility, clinical validity, pilot participation, implementation, performance, outcome, renewal, or expansion; ingest records, Findings content, identities, files, credentials, or PHI; send a packet; sign an agreement; start a clock; authorize a pilot, production release, patient use, or consumer offering; or permit a care decision. Source-reported interest and working assumptions remain visibly different from authenticated acceptance. A sealed snapshot proves only which local plan and evidence heads were assembled at that moment. Every site-specific decision remains external until governed authorities verify the evidence and sign an exact bounded authorization.";

const freeze = value => Object.freeze(value);
const item = (id, label, detail) => freeze({ id, label, detail });

export const PILOT_CANDIDATE_PATHWAYS = freeze([
  freeze({
    id: "north-central-counseling-center",
    index: "01",
    label: "North Central University",
    setting: "Counseling-center candidate",
    status: "source-reported-working-plan",
    proposition: "Begin with the counseling center’s existing provider workflow before considering any campus-wide or consumer expansion.",
    population: "Approximately 50 on-campus students in the current counselor caseload—source-reported, not rostered or verified here.",
    scope: "Counseling-center use only; group/dashboard access was source-proposed. Broad all-student access remains deferred.",
    workingWindow: "Ten-month working term, August–May, for the 2026–27 academic year; no start date or agreement is recorded here.",
    training: "August working session with the counselor; objectives, safety routing, review duties, and support path fixed before any use.",
    decisionPath: "Dr. Brown and the Provost were source-reported as part of the approval path; identity and authority are not authenticated here.",
    customization: "One page-level customization or survey-question decision was offered for discussion and remains open.",
    siteVerified: false,
    pilotAuthorized: false
  }),
  freeze({
    id: "cooper-psych-clinic-qi",
    index: "02",
    label: "Cooper University",
    setting: "Psychiatric-clinic QI candidate",
    status: "source-reported-interest",
    proposition: "Evaluate a diagnostic-agnostic baseline workflow in which e-QPASS is considered for patients regardless of presenting pathology.",
    population: "A student quality-improvement concept in a psychiatric clinic; no participant, record, or implementation count is present here.",
    scope: "Provider-side quality-improvement exploration only; clinical, site, ethics, data, and operational boundaries remain to be decided.",
    workingWindow: "No verified window. Sequence only after intended use, e-QPASS authority, clinical standard, privacy/security, and site approval.",
    training: "Training design remains required for every authorized reviewer and supervisor before any bounded use.",
    decisionPath: "Named local clinical, QI, privacy, security, legal, and site authorities must be returned through the Decision Exchange.",
    customization: "No site-specific customization is assumed.",
    siteVerified: false,
    pilotAuthorized: false
  })
]);

export const PILOT_TRAINING_MODULES = freeze([
  item("scope-and-role", "01 · Scope & role", "Provider-first intended use, unchanged Findings authority, prohibited uses, reviewer accountability, and the no-autonomous-decision boundary."),
  item("review-workflow", "02 · Review workflow", "Open the evidence-linked summary, inspect every section, correct or return it, and preserve the clinician-approved artifact before any downstream step."),
  item("safety-and-escalation", "03 · Safety & escalation", "Direct critical-screen review, stop conditions, incident escalation, downtime behavior, and named clinical restart authority."),
  item("feedback-and-data-quality", "04 · Feedback & data quality", "Structured feedback, correction taxonomy, activity denominators, missing-data handling, quarterly review, and change-control handoff.")
]);

export const PILOT_REVIEW_CADENCE = freeze([
  freeze({ id: "admission", index: "00", label: "Admission review", timing: "Before any use", decision: "Verify all seven external gates, the named site boundary, counselor roster, training plan, measures, stop rules, support, and signed dates." }),
  freeze({ id: "quarter-one", index: "01", label: "Quarter-one learning review", timing: "First authorized quarter", decision: "Inspect denominator coverage, review completion, correction burden, safety routing, workflow time, and counselor usefulness without claiming outcomes." }),
  freeze({ id: "midyear", index: "02", label: "Midyear control review", timing: "Second authorized quarter", decision: "Continue, pause, or revise the bounded workflow; reconcile incidents, evidence drift, training gaps, and open corrective actions." }),
  freeze({ id: "closeout", index: "03", label: "Closeout & renewal review", timing: "End of bounded term", decision: "Stop, revise, renew, or consider a separately authorized expansion. Renewal and broad access never occur automatically." })
]);

export const PILOT_MEASURES = freeze([
  freeze({ id: "eligible-activity", index: "01", label: "Eligible workflow activity", definition: "Eligible authoritative e-QPASS assessments with a PERL review initiated ÷ all assessments inside the accepted site/time/scope denominator.", guardrail: "Requires an authoritative source denominator; no record-level intake exists here." }),
  freeze({ id: "review-completion", index: "02", label: "Clinician review completion", definition: "Clinician-reviewed summaries with an explicit disposition ÷ initiated summaries.", guardrail: "Preparation or generation cannot count as clinical review." }),
  freeze({ id: "correction-burden", index: "03", label: "Correction burden", definition: "Changed tokens and structured return reasons per reviewed summary, stratified by approved synthetic or de-identified cohort.", guardrail: "Low editing does not establish accuracy or clinical validity." }),
  freeze({ id: "critical-routing", index: "04", label: "Critical-screen routing", definition: "Critical-screen cases receiving the accepted direct-review workflow ÷ all authoritative critical-screen cases in scope.", guardrail: "Any routing miss triggers the accepted stop and incident path." }),
  freeze({ id: "workflow-time", index: "05", label: "Review workflow time", definition: "Median and distribution of start-to-disposition time under the frozen measurement protocol.", guardrail: "No time-savings claim without an accepted comparator and denominator." }),
  freeze({ id: "counselor-usefulness", index: "06", label: "Counselor usefulness", definition: "Predeclared qualified-reviewer ratings across the accepted usefulness scale and required strata.", guardrail: "Preference is not diagnostic accuracy, reliability, or patient benefit." })
]);

export const PILOT_CLOSEOUT_DECISIONS = freeze([
  item("stop", "Stop", "Close access, preserve evidence, reconcile incidents and unresolved duties, and document why the bounded pilot will not continue."),
  item("revise", "Revise", "Return to the applicable evidence gate, freeze the change, retest, and seek a new scoped authorization."),
  item("renew", "Renew", "Require a new named term, accepted evidence, price and support agreement, and signed authority; never roll over by default."),
  item("expand", "Consider expansion", "Open a separate decision for new sites or populations only after provider-market evidence; consumer PERL stays a different product track.")
]);

export const PILOT_COMMERCIAL_ASSUMPTIONS = freeze([
  item("working-budget", "Working budget", "Source correspondence placed the first university pilot below $1,000 and preferably nearer $500; no budget approval is verified."),
  item("working-offer", "Working offer", "$750 flat for the source-proposed August–May term, no setup/training fee, and unlimited group/dashboard access; no quote or agreement is executed."),
  item("renewal-reference", "Renewal reference", "$75 per month was a source-proposed renewal anchor; renewal, pricing, scope, and term remain external decisions.")
]);

const clone = value => structuredClone(value);
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function digest(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

export function pilotCandidatePathway(id) { return PILOT_CANDIDATE_PATHWAYS.find(candidate => candidate.id === id) || null; }

export function validatePilotOperationsContract() {
  const errors = [];
  if (PILOT_CANDIDATE_PATHWAYS.length !== 2 || new Set(PILOT_CANDIDATE_PATHWAYS.map(item => item.id)).size !== 2) errors.push("The pilot portfolio must contain two unique source-reported pathways.");
  if (PILOT_CANDIDATE_PATHWAYS.some(item => item.siteVerified !== false || item.pilotAuthorized !== false)) errors.push("Candidate pathways must deny local site verification and pilot authority.");
  if (PILOT_TRAINING_MODULES.length !== 4 || PILOT_REVIEW_CADENCE.length !== 4 || PILOT_MEASURES.length !== 6) errors.push("The operating spine must fix four training modules, four reviews, and six measures.");
  if (PILOT_CLOSEOUT_DECISIONS.length !== 4 || PILOT_COMMERCIAL_ASSUMPTIONS.length !== 3) errors.push("Closeout and commercial registers are incomplete.");
  const external = PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority");
  if (external.length !== 7) errors.push("The plan requires exactly seven external admission decisions.");
  if (PILOT_OPERATIONS_BOUNDARY.length < 800 || !/does not verify a site/i.test(PILOT_OPERATIONS_BOUNDARY) || !/sealed snapshot proves only/i.test(PILOT_OPERATIONS_BOUNDARY)) errors.push("The pilot-operations claim boundary is incomplete.");
  return [...new Set(errors)];
}

function planCore(readiness, decisionExchange, evidenceContext) {
  const gates = (readiness?.current?.gates || PILOT_READINESS_GATES).filter(gate => gate.category === "external-authority").map((gate, index) => {
    const packet = decisionExchange?.packets?.find(item => item.id === gate.id);
    return {
      id: gate.id,
      index: String(index + 1).padStart(2, "0"),
      label: gate.label,
      state: packet?.status || gate.status || "external-decision-required",
      requestFingerprint: packet?.requestFingerprint || null,
      authorityVerified: false,
      accepted: false
    };
  });
  return {
    contractVersion: PILOT_OPERATIONS_CONTRACT,
    sourceRegister: {
      direction: "Dolores correspondence · 2026-01-12 and 2026-03-30",
      providerFirst: true,
      sourceClaimsVerifiedExternally: false,
      sourceRecordsIncluded: false,
      phiIncluded: false
    },
    candidates: clone(PILOT_CANDIDATE_PATHWAYS),
    training: clone(PILOT_TRAINING_MODULES),
    cadence: clone(PILOT_REVIEW_CADENCE),
    measures: clone(PILOT_MEASURES),
    closeoutDecisions: clone(PILOT_CLOSEOUT_DECISIONS),
    commercialAssumptions: clone(PILOT_COMMERCIAL_ASSUMPTIONS),
    admissionGates: gates,
    evidenceContext: clone(evidenceContext || {}),
    providerPilotFirst: true,
    consumerExpansionDeferred: true,
    siteVerified: false,
    authorityVerified: false,
    pilotAuthorized: false,
    clinicalValidationEstablished: false,
    patientUseAuthorized: false,
    boundary: PILOT_OPERATIONS_BOUNDARY
  };
}

export function buildPilotOperationsPlan({ readiness, decisionExchange, evidenceContext = {}, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const errors = validatePilotOperationsContract();
  if (errors.length) throw new Error(errors.join(" "));
  const core = planCore(readiness, decisionExchange, evidenceContext);
  const planFingerprint = digest(core);
  const latest = events.at(-1) || null;
  const latestCurrent = latest?.planFingerprint === planFingerprint;
  const readinessCounts = readiness?.current?.gateCounts || readiness?.current?.counts || {};
  const localCurrent = Number(readinessCounts.localCurrent || 0);
  const externalAccepted = Number(readinessCounts.externalAccepted ?? (7 - Number(readinessCounts.externalDecisionRequired ?? 7)));
  return {
    ...core,
    status: externalAccepted === 7 ? "authorization-must-be-verified-outside-sandbox" : "source-plan-assembled-external-authorization-required",
    headline: "A pilot should begin as an operating agreement—not a hopeful launch.",
    subhead: "Two source-reported pathways. One provider-first discipline. Measures, training, reviews, and stop decisions fixed before the first authorized use.",
    counts: {
      candidatePathways: 2,
      sourceWorkingPlans: 1,
      sourceReportedCaseload: 50,
      workingMonths: 10,
      quarterlyReviews: 4,
      trainingModules: 4,
      measures: 6,
      admissionGates: 7,
      localReadinessCurrent: localCurrent,
      externalAccepted,
      sitesVerified: 0,
      pilotsAuthorized: 0
    },
    planFingerprint,
    latestSnapshot: latest ? { sequence: latest.sequence, createdAt: latest.createdAt, actor: latest.actor, hash: latest.hash, current: latestCurrent } : null,
    history: clone(events),
    chain: clone(chain),
    generatedAt,
    planAccepted: false,
    trainingCompleted: false,
    pilotStarted: false,
    outcomeEstablished: false,
    renewalApproved: false,
    expansionApproved: false
  };
}

export function createPilotOperationsSnapshot({ plan, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const cleanActor = String(actor || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(cleanActor)) throw new Error("Actor must be 2–48 safe characters.");
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: PILOT_OPERATIONS_CONTRACT,
    type: "provider-pilot-operations-snapshot-recorded",
    status: "source-plan-assembled-external-authorization-required",
    planFingerprint: plan.planFingerprint,
    counts: clone(plan.counts),
    evidenceContext: clone(plan.evidenceContext),
    decision: "site-specific-pilot-authorization-remains-external",
    sourceClaimsVerifiedExternally: false,
    sourceRecordsIncluded: false,
    siteIdentityVerified: false,
    counselorRosterReceived: false,
    licensureVerified: false,
    authorityVerified: false,
    agreementExecuted: false,
    budgetApproved: false,
    trainingCompleted: false,
    dataPathApproved: false,
    phiReceived: false,
    planAccepted: false,
    pilotAuthorized: false,
    pilotStarted: false,
    outcomeEstablished: false,
    renewalApproved: false,
    expansionApproved: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor: cleanActor,
    createdAt,
    note: "Local planning snapshot only. It pins the source-backed provider-pilot plan and current evidence references without verifying a site, accepting a contract, completing training, starting a pilot, establishing outcomes, renewing access, or authorizing expansion."
  };
  return { ...core, hash: digest(core) };
}

export function validatePilotOperationsSnapshot(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Pilot-operations snapshot is required."];
  if (event.contractVersion !== PILOT_OPERATIONS_CONTRACT || event.type !== "provider-pilot-operations-snapshot-recorded") errors.push("Pilot-operations snapshot contract is invalid.");
  if (event.sequence !== sequence || event.previousHash !== previousHash || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Pilot-operations snapshot chain position is invalid.");
  if (!/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Pilot-operations previous hash is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(event.planFingerprint || ""))) errors.push("Pilot-operations plan fingerprint is invalid.");
  if (event.status !== "source-plan-assembled-external-authorization-required" || event.decision !== "site-specific-pilot-authorization-remains-external") errors.push("Pilot-operations snapshot overstates its disposition.");
  const falseFields = ["sourceClaimsVerifiedExternally", "sourceRecordsIncluded", "siteIdentityVerified", "counselorRosterReceived", "licensureVerified", "authorityVerified", "agreementExecuted", "budgetApproved", "trainingCompleted", "dataPathApproved", "phiReceived", "planAccepted", "pilotAuthorized", "pilotStarted", "outcomeEstablished", "renewalApproved", "expansionApproved", "productionReleaseAuthorized", "patientUseAuthorized"];
  for (const field of falseFields) if (event[field] !== false) errors.push(`${field} must remain false.`);
  if (event.counts?.candidatePathways !== 2 || event.counts?.workingMonths !== 10 || event.counts?.quarterlyReviews !== 4 || event.counts?.measures !== 6 || event.counts?.admissionGates !== 7 || event.counts?.sitesVerified !== 0 || event.counts?.pilotsAuthorized !== 0) errors.push("Pilot-operations snapshot counts are invalid.");
  if (!event.evidenceContext || typeof event.evidenceContext !== "object" || Array.isArray(event.evidenceContext)) errors.push("Pilot-operations evidence context is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Pilot-operations actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt))) errors.push("Pilot-operations timestamp is invalid.");
  if (String(event.note || "").length < 180) errors.push("Pilot-operations non-authorization note is incomplete.");
  const { hash, ...core } = event;
  if (hash !== digest(core)) errors.push("Pilot-operations snapshot fingerprint is invalid.");
  return [...new Set(errors)];
}

function briefList(items, formatter) { return items.map(formatter).join(""); }

export function renderPilotOperationsBrief(plan) {
  if (!plan?.planFingerprint || !Array.isArray(plan.candidates)) throw new Error("A current pilot-operations plan is required.");
  const northCentral = plan.candidates[0];
  const cooper = plan.candidates[1];
  const gates = briefList(plan.admissionGates, gate => `<li><span>${escapeHtml(gate.index)}</span><strong>${escapeHtml(gate.label)}</strong><small>${escapeHtml(gate.state.replaceAll("-", " "))}</small></li>`);
  const measures = briefList(plan.measures, measure => `<li><span>${escapeHtml(measure.index)}</span><div><strong>${escapeHtml(measure.label)}</strong><p>${escapeHtml(measure.definition)}</p><small>${escapeHtml(measure.guardrail)}</small></div></li>`);
  const modules = briefList(plan.training, module => `<li><strong>${escapeHtml(module.label)}</strong><p>${escapeHtml(module.detail)}</p></li>`);
  const cadence = briefList(plan.cadence, review => `<li><span>${escapeHtml(review.index)}</span><div><strong>${escapeHtml(review.label)}</strong><small>${escapeHtml(review.timing)}</small><p>${escapeHtml(review.decision)}</p></div></li>`);
  const closeout = briefList(plan.closeoutDecisions, decision => `<li><strong>${escapeHtml(decision.label)}</strong><p>${escapeHtml(decision.detail)}</p></li>`);
  const commercial = briefList(plan.commercialAssumptions, assumption => `<li><strong>${escapeHtml(assumption.label)}</strong><p>${escapeHtml(assumption.detail)}</p></li>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PERL Provider Pilot Operating Brief</title><link rel="stylesheet" href="/pilot-operations.css"></head><body>
  <nav class="pilot-brief-toolbar" aria-label="Pilot brief actions"><a href="/">Return to PERL</a><span>Provider pilot operating brief · no PHI</span><button id="print-pilot-brief" type="button">Print brief</button></nav>
  <main>
    <section class="pilot-sheet pilot-cover" aria-label="Page 1 of 3"><header><span>Focused Future® · PERL</span><small>Page 01 / 03</small></header><div class="pilot-cover-grid"><div><p class="kicker">Source-backed operating plan · working draft</p><h1>A pilot should begin as an operating agreement.</h1><p class="standfirst">Two source-reported pathways. One provider-first discipline. No site, signature, start, outcome, or expansion claim.</p></div><div class="cover-mark"><span>PILOT</span><strong>02</strong><small>PATHWAYS</small></div></div><div class="candidate-lead"><article><span>${escapeHtml(northCentral.index)} · ${escapeHtml(northCentral.status.replaceAll("-", " "))}</span><h2>${escapeHtml(northCentral.label)}</h2><h3>${escapeHtml(northCentral.setting)}</h3><p>${escapeHtml(northCentral.proposition)}</p><dl><div><dt>Population</dt><dd>${escapeHtml(northCentral.population)}</dd></div><div><dt>Working window</dt><dd>${escapeHtml(northCentral.workingWindow)}</dd></div><div><dt>Training</dt><dd>${escapeHtml(northCentral.training)}</dd></div><div><dt>Decision path</dt><dd>${escapeHtml(northCentral.decisionPath)}</dd></div></dl></article><aside><span>${escapeHtml(cooper.index)} · ${escapeHtml(cooper.status.replaceAll("-", " "))}</span><h2>${escapeHtml(cooper.label)}</h2><h3>${escapeHtml(cooper.setting)}</h3><p>${escapeHtml(cooper.proposition)}</p><p>${escapeHtml(cooper.scope)}</p><small>${escapeHtml(cooper.decisionPath)}</small></aside></div><footer><code>${escapeHtml(plan.planFingerprint.slice(0, 24))}…</code><p>Provider pilot first. Consumer PERL remains deferred.</p></footer></section>
    <section class="pilot-sheet pilot-operating" aria-label="Page 2 of 3"><header><span>PERL · Operating spine</span><small>Page 02 / 03</small></header><div class="sheet-title"><span>01 / PREPARE</span><h2>Train the work. Measure the work.</h2><p>The plan fixes accountable behaviors and denominators before any claim can travel.</p></div><div class="operating-columns"><section><h3>Four training modules</h3><ol class="modules">${modules}</ol><h3>Quarterly decision rhythm</h3><ol class="cadence">${cadence}</ol></section><section><h3>Six measures before claims</h3><ol class="measures">${measures}</ol></section></div><footer><p>Training design is not attendance. A working measure is not a result.</p></footer></section>
    <section class="pilot-sheet pilot-authority" aria-label="Page 3 of 3"><header><span>PERL · Admission & closeout</span><small>Page 03 / 03</small></header><div class="sheet-title"><span>02 / AUTHORIZE</span><h2>Permission enters through seven doors.</h2><p>All seven remain externally owned. Local completeness cannot substitute for authenticated acceptance.</p></div><ol class="gates">${gates}</ol><div class="authority-columns"><section><h3>Closeout is a decision</h3><ul>${closeout}</ul></section><section><h3>Commercial assumptions stay provisional</h3><ul>${commercial}</ul></section></div><div class="boundary"><strong>Non-authorization boundary</strong><p>${escapeHtml(plan.boundary)}</p></div><footer><code>CHAIN ${escapeHtml(String(plan.chain?.count || 0))} · ${escapeHtml(plan.contractVersion)}</code><p>Site-specific pilot authorization remains external.</p></footer></section>
  </main><script src="/pilot-operations-print.js"></script></body></html>`;
}
