import { createHash } from "node:crypto";
import { PILOT_AUTHORITY_REGISTER, PILOT_READINESS_GATES } from "./pilot-readiness.js";

export const EXECUTIVE_HANDOFF_CONTRACT = "perl-executive-handoff/1.0";

export const EXECUTIVE_HANDOFF_BOUNDARY = "This read-only packet organizes source-backed questions, local synthetic evidence, and requested external returns. It does not assign authority, record acceptance, commit a delivery date or budget, establish clinical validity, authorize PHI, certify production readiness, authorize a pilot, or replace counsel, security, clinical, accessibility, e-QPASS, or independent review.";

const decision = (id, label, gateId, ownerRoles, returnEvidence) => Object.freeze({
  id,
  label,
  gateId,
  ownerRoles: Object.freeze(ownerRoles),
  returnEvidence
});

export const EXECUTIVE_HANDOFF_PACKETS = Object.freeze([
  Object.freeze({
    id: "product-clinical-charter",
    index: "01",
    label: "Product + clinical charter",
    title: "Agree on what PERL is allowed to do.",
    audience: "Dolores · Mike · clinical lead · legal",
    purpose: "Freeze provider-first intended use, accountable leadership, report language, counselor participation, and the first bounded site before the planning clock begins.",
    decisions: Object.freeze([
      decision("confirm-program-lead", "Confirm Mike as program and integration lead.", "intended-use-approval", ["executive-sponsor", "program-integration-lead"], "Named decision-log owner and weekly dependency cadence."),
      decision("approve-intended-use", "Approve provider-first intended and prohibited use.", "intended-use-approval", ["executive-sponsor", "clinical-lead", "legal-owner"], "Signed intended-use statement with prohibited-use language."),
      decision("approve-report-language", "Approve the clinician page, disclaimer, and unchanged Findings relationship.", "intended-use-approval", ["clinical-lead", "legal-owner"], "Annotated report sample and locked language version."),
      decision("name-review-team-site", "Name the clinical lead, two to three counselors, and first bounded provider site.", "clinical-beta", ["executive-sponsor", "clinical-lead", "counselor-panel"], "Named participants, protected session time, and site candidate." )
    ])
  }),
  Object.freeze({
    id: "eqpass-integration-contract",
    index: "02",
    label: "e-QPASS integration contract",
    title: "Replace the rehearsal with source authority.",
    audience: "Mike · e-QPASS owner · clinical · engineering",
    purpose: "Return the authoritative scoring, lifecycle, and attachment contract PERL needs without sending respondent data or treating local workbooks as production semantics.",
    decisions: Object.freeze([
      decision("name-eqpass-owner", "Name the accountable e-QPASS technical owner.", "authoritative-eqpass", ["program-integration-lead", "eqpass-owner"], "Owner, system inventory, interface path, and decision cadence."),
      decision("return-scored-event", "Return one de-identified authoritative scored event and field dictionary.", "authoritative-eqpass", ["eqpass-owner", "clinical-lead"], "Versioned sample, required/optional fields, code sets, and scoring version."),
      decision("confirm-score-authority", "Confirm scale, fourteen-subscale, GPI, and Red Flag semantics.", "authoritative-eqpass", ["eqpass-owner", "clinical-lead"], "Machine codebook, formulas, ranges, levels, thresholds, and item membership."),
      decision("define-critical-disclosure", "Define minimum-necessary critical-response disclosure and routing.", "authoritative-eqpass", ["clinical-lead", "security-privacy-owner", "eqpass-owner"], "Field decision, deterministic safety workflow, and authorized roles."),
      decision("define-report-lifecycle", "Define Findings finalization, PDF merge, attachment acknowledgement, and preservation.", "authoritative-eqpass", ["eqpass-owner", "engineering-owner", "clinical-lead"], "Lifecycle diagram, private API/service contract, version/hash rules, and unchanged-source guarantee."),
      decision("define-supersession-replay", "Define rescoring, supersession, idempotency, retries, replay, and failure authority.", "authoritative-eqpass", ["eqpass-owner", "engineering-owner", "clinical-lead", "security-privacy-owner"], "State machine, retry matrix, operator runbook, and stopping/rollback rule.")
    ])
  }),
  Object.freeze({
    id: "azure-production-controls",
    index: "03",
    label: "Azure production controls",
    title: "Make the production boundary provable.",
    audience: "Security · privacy · engineering · e-QPASS · legal",
    purpose: "Translate the existing Azure and SOC 2 context into evidence for the exact PERL data path, identities, retention, continuity, monitoring, response, and accessible report service.",
    decisions: Object.freeze([
      decision("approve-data-classification", "Approve field-level data classification and the scoring-only model projection.", "security-production", ["security-privacy-owner", "clinical-lead", "eqpass-owner"], "Data-flow diagram, prohibited-field list, model/provider terms, and approved data class."),
      decision("approve-identity-controls", "Approve SSO, RBAC, service identities, reviewer licensure, and stop/restart roles.", "security-production", ["security-privacy-owner", "engineering-owner", "eqpass-owner", "clinical-lead"], "Role matrix, authentication design, separation of duties, and access-test evidence."),
      decision("approve-encryption-retention", "Approve encryption, secrets, retention, deletion, redaction, and legal-hold behavior.", "security-production", ["security-privacy-owner", "engineering-owner", "legal-owner"], "Control inventory, key ownership, retention schedule, deletion tests, and log/dead-letter redaction."),
      decision("approve-continuity", "Set RPO/RTO and approve backup, restore, reconciliation, and application rollback evidence.", "security-production", ["security-privacy-owner", "engineering-owner", "eqpass-owner", "clinical-lead"], "Impact-derived targets, monitored backup policy, isolated Azure restore, signed artifact provenance, and rollback runbook."),
      decision("connect-operations", "Connect continuous telemetry, alerts, incident command, notifications, and restart criteria.", "security-production", ["security-privacy-owner", "engineering-owner", "clinical-lead", "legal-owner"], "Objectives, alert routes, acknowledgements, escalation tree, failure injection, evidence retention, and accepted response playbook."),
      decision("approve-accessibility", "Approve assistive-technology evidence and accessible HTML/PDF delivery.", "accessibility-acceptance", ["accessibility-owner", "engineering-owner", "clinical-lead"], "Manual matrix, independent audit, remediations, tagged PDF/PDF-UA validation, and exception record.")
    ])
  }),
  Object.freeze({
    id: "independent-pilot-decision",
    index: "04",
    label: "Independent review + pilot",
    title: "Let evidence—not enthusiasm—open the site.",
    audience: "Independent evaluator · counselors · pilot decision group",
    purpose: "Freeze the study before approved cases are opened, obtain a signed reliability disposition, and authorize only identified sites with accepted controls and support.",
    decisions: Object.freeze([
      decision("freeze-study", "Freeze case eligibility, strata, partitions, analysis, and stopping rules.", "independent-reliability", ["independent-evaluator", "clinical-lead", "legal-owner", "security-privacy-owner"], "Signed protocol, approved de-identified manifest, access rules, denominators, thresholds, and analysis version."),
      decision("commit-reviewers", "Commit qualified counselors and independent review capacity.", "clinical-beta", ["clinical-lead", "counselor-panel", "independent-evaluator"], "Reviewer roster, qualifications, conflicts, training, allocation, and protected time."),
      decision("accept-calibration", "Accept counselor correction patterns and development-set behavior.", "clinical-beta", ["clinical-lead", "counselor-panel"], "Session record, structured corrections, severity dispositions, gold references, and clinical sign-off."),
      decision("issue-reliability-decision", "Issue the independent stop, revise, or prepare-pilot decision.", "independent-reliability", ["independent-evaluator", "clinical-lead"], "Signed denominator-first findings, limitations, failure review, timing analysis, and recommendation."),
      decision("authorize-named-sites", "Accept legal terms, training, support, and controls; then decide named-site authorization.", "pilot-authorization", ["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"], "Signed site scope, versions, conditions, expiry, revocation, support plan, and stop/go decision.")
    ])
  })
]);

export const EXECUTIVE_HANDOFF_ARTIFACTS = Object.freeze([
  Object.freeze({ id: "source-rfi", label: "e-QPASS production mapping RFI", path: "/docs/EQPASS_PRODUCTION_MAPPING_RFI.md", classification: "sendable-question-set" }),
  Object.freeze({ id: "source-schema", label: "Proposed scored-event schema", path: "/schemas/eqpass-scored-event.proposed.schema.json", classification: "sendable-proposed-contract" }),
  Object.freeze({ id: "synthetic-event", label: "Synthetic scored-event example", path: "/examples/synthetic-eqpass-scored-event.json", classification: "sendable-synthetic-example" }),
  Object.freeze({ id: "launch-plan", label: "Evidence-gated launch-readiness plan", path: "/docs/LAUNCH_READINESS_PLAN.md", classification: "sendable-planning-reference" }),
  Object.freeze({ id: "clinical-protocol", label: "Clinical-beta measurement protocol", path: "/docs/CLINICAL_BETA_PROTOCOL.md", classification: "sendable-draft-protocol" }),
  Object.freeze({ id: "timing-protocol", label: "Workflow timing study design", path: "/docs/TIMING_STUDY_DESIGN.md", classification: "sendable-draft-protocol" }),
  Object.freeze({ id: "readiness-dossier", label: "Pilot-readiness dossier", path: "/docs/PILOT_READINESS_DOSSIER.md", classification: "sendable-evidence-boundary" }),
  Object.freeze({ id: "synthetic-export", label: "Current synthetic evidence export", path: "/api/calibration/export.json", classification: "internal-synthetic-evidence" })
]);

export const EXECUTIVE_HANDOFF_EXCLUSIONS = Object.freeze([
  "B2C response exports or consumer-workstream files",
  "Private or respondent-derived report samples",
  "Names, birth dates, contacts, demographics, examiner details, or raw item responses",
  "Credentials, secrets, production endpoints, or unredacted logs",
  "Any statement that the local build is clinically validated, production ready, approved, attached to e-QPASS, or pilot authorized"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateExecutiveHandoffContract() {
  const errors = [];
  const roleIds = new Set(PILOT_AUTHORITY_REGISTER.map(role => role.id));
  const gateIds = new Set(PILOT_READINESS_GATES.map(gate => gate.id));
  const packetIds = new Set();
  const decisionIds = new Set();
  for (const packet of EXECUTIVE_HANDOFF_PACKETS) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(packet.id) || packetIds.has(packet.id)) errors.push(`Invalid or repeated handoff packet: ${packet.id}.`);
    packetIds.add(packet.id);
    if (!/^\d{2}$/.test(packet.index) || !packet.label || !packet.title || !packet.audience || !packet.purpose) errors.push(`Handoff packet ${packet.id} is incomplete.`);
    if (!Array.isArray(packet.decisions) || packet.decisions.length < 4) errors.push(`Handoff packet ${packet.id} needs at least four decisions.`);
    for (const item of packet.decisions || []) {
      if (!/^[a-z][a-z0-9-]{3,63}$/.test(item.id) || decisionIds.has(item.id)) errors.push(`Invalid or repeated handoff decision: ${item.id}.`);
      decisionIds.add(item.id);
      if (!gateIds.has(item.gateId) || PILOT_READINESS_GATES.find(gate => gate.id === item.gateId)?.category !== "external-authority") errors.push(`Handoff decision ${item.id} must map to an external gate.`);
      if (!Array.isArray(item.ownerRoles) || item.ownerRoles.length < 1 || item.ownerRoles.some(role => !roleIds.has(role))) errors.push(`Handoff decision ${item.id} has an invalid owner role.`);
      if (!item.label || !item.returnEvidence) errors.push(`Handoff decision ${item.id} is incomplete.`);
    }
  }
  if (EXECUTIVE_HANDOFF_PACKETS.length !== 4) errors.push("The executive handoff must contain four fixed packets.");
  if (decisionIds.size !== 21) errors.push("The executive handoff must contain twenty-one unique decisions.");
  for (const artifact of EXECUTIVE_HANDOFF_ARTIFACTS) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(artifact.id) || !/^\/(?:api|docs|examples|schemas)\/[A-Za-z0-9._/-]+$/.test(artifact.path) || artifact.path.includes("..")) errors.push(`Invalid handoff artifact: ${artifact.id}.`);
  }
  if (EXECUTIVE_HANDOFF_EXCLUSIONS.length < 5 || !EXECUTIVE_HANDOFF_EXCLUSIONS.some(item => /respondent/i.test(item))) errors.push("The handoff exclusion boundary is incomplete.");
  if (!/does not assign authority/i.test(EXECUTIVE_HANDOFF_BOUNDARY) || !/authorize a pilot/i.test(EXECUTIVE_HANDOFF_BOUNDARY)) errors.push("The executive handoff claim boundary is incomplete.");
  return [...new Set(errors)];
}

export function buildExecutiveHandoff(readinessStatus = {}, marketabilityMap = {}, generatedAt = new Date().toISOString()) {
  const current = readinessStatus.current || readinessStatus;
  const authorityRegister = Array.isArray(current.authorityRegister) ? current.authorityRegister : clone(PILOT_AUTHORITY_REGISTER);
  const gateRegister = Array.isArray(current.gates) ? current.gates : [];
  const authorityById = new Map(authorityRegister.map(role => [role.id, role]));
  const gateById = new Map(gateRegister.map(gate => [gate.id, gate]));
  const packets = EXECUTIVE_HANDOFF_PACKETS.map(packet => {
    const owners = [...new Set(packet.decisions.flatMap(item => item.ownerRoles))].map(id => authorityById.get(id) || { id, label: id, name: null, status: "unassigned" });
    const gates = [...new Set(packet.decisions.map(item => item.gateId))].map(id => gateById.get(id) || { id, status: "external-decision-required", productionAccepted: false });
    return {
      ...clone(packet),
      status: "decision-required",
      decisionCount: packet.decisions.length,
      acceptedDecisionCount: 0,
      openOwnerCount: owners.filter(role => role.status === "unassigned").length,
      owners: owners.map(role => ({ id: role.id, label: role.label, name: role.name, status: role.status })),
      gates: gates.map(gate => ({ id: gate.id, label: gate.label || gate.id, status: gate.status, productionAccepted: false })),
      decisions: packet.decisions.map(item => ({ ...clone(item), status: "external-decision-required", accepted: false }))
    };
  });
  const gateCounts = current.gateCounts || { localCurrent: 0, localRequired: 7, externalDecisionRequired: 7, total: 14 };
  const authorityCounts = current.authorityCounts || { confirmed: 1, provisional: 1, unassigned: 8, total: 10 };
  const core = {
    contractVersion: EXECUTIVE_HANDOFF_CONTRACT,
    status: "decision-room-open",
    generatedAt,
    preparedFor: [
      { role: "Executive & product sponsor", name: authorityById.get("executive-sponsor")?.name || "Dolores", status: authorityById.get("executive-sponsor")?.status || "confirmed-source-owner" },
      { role: "Program & integration lead", name: authorityById.get("program-integration-lead")?.name || "Mike", status: authorityById.get("program-integration-lead")?.status || "provisional-source-owner" }
    ],
    meetingObjective: "Leave the next working session with named owners, an approved return list, and a dated decision cadence—without treating discussion as approval.",
    evidenceSnapshot: {
      localCurrent: gateCounts.localCurrent,
      localRequired: gateCounts.localRequired,
      externalAccepted: 0,
      externalDecisionRequired: gateCounts.externalDecisionRequired,
      authorityConfirmed: authorityCounts.confirmed,
      authorityProvisional: authorityCounts.provisional,
      authorityUnassigned: authorityCounts.unassigned,
      readinessStateHash: current.readinessStateHash || null
    },
    planningWindow: clone(marketabilityMap.planningWindow || {
      label: "14-week evidence-gated window",
      startsWhen: "Named owners, an approved data path, and the counselor panel are available.",
      calendarCommitment: false
    }),
    packets,
    returnManifest: [
      "Confirmed program lead, e-QPASS owner, clinical lead, engineering owner, legal/privacy/security/accessibility owners, independent evaluator, and counselor panel.",
      "Signed provider-first intended use and annotated clinician report language.",
      "One de-identified authoritative scored event, field dictionary, score codebook, lifecycle, and PDF attachment interface.",
      "Approved Azure data-flow and control evidence plan, including identity, retention, backup, recovery, rollback, monitoring, response, and accessibility.",
      "Frozen counselor and independent-evaluation protocol plus the first bounded provider-site candidate."
    ],
    artifacts: clone(EXECUTIVE_HANDOFF_ARTIFACTS),
    exclusions: clone(EXECUTIVE_HANDOFF_EXCLUSIONS),
    externalApprovalsRecorded: false,
    productionOwnersAssigned: false,
    calendarCommitment: false,
    productionReadinessClaimed: false,
    pilotAuthorizationRecorded: false,
    clinicalReleaseAuthorized: false,
    phiIncluded: false,
    boundary: EXECUTIVE_HANDOFF_BOUNDARY
  };
  return { ...core, packetFingerprint: digest(core) };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handoffStatusLabel(status) {
  return {
    "confirmed-source-owner": "Source-confirmed",
    "provisional-source-owner": "Provisional—confirm role",
    unassigned: "Unassigned"
  }[status] || "Decision required";
}

export function renderExecutiveHandoffPage(packet) {
  const safe = clone(packet);
  const packets = safe.packets.map(section => `<section class="packet">
    <header><span>${escapeHtml(section.index)}</span><div><small>${escapeHtml(section.label)}</small><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.purpose)}</p></div><b>${escapeHtml(section.decisionCount)} decisions</b></header>
    <div class="decision-list">${section.decisions.map(item => `<article><i aria-hidden="true"></i><div><h3>${escapeHtml(item.label)}</h3><p><strong>Return:</strong> ${escapeHtml(item.returnEvidence)}</p><small>${escapeHtml(item.ownerRoles.join(" · "))}</small></div></article>`).join("")}</div>
  </section>`).join("");
  const participants = safe.preparedFor.map(person => `<div><span>${escapeHtml(person.role)}</span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(handoffStatusLabel(person.status))}</small></div>`).join("");
  const returnManifest = safe.returnManifest.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const artifacts = safe.artifacts.map(item => `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a><span>${escapeHtml(item.classification.replaceAll("-", " "))}</span></li>`).join("");
  const exclusions = safe.exclusions.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PERL · Build &amp; integration decision brief</title>
<style>
:root{--ink:#143a38;--deep:#102e2e;--night:#172522;--ivory:#f7f2e7;--paper:#fffdf8;--gold:#c99750;--muted:#68746d;--line:#d5cdbc;--risk:#9b5a46}*{box-sizing:border-box}html{background:#d9d6ce}body{max-width:980px;margin:0 auto;color:var(--ink);background:var(--ivory);font-family:Avenir Next,Avenir,Helvetica Neue,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit}.mast{padding:54px 58px 44px;color:#fdf7ea;background:var(--deep);border-bottom:7px solid var(--gold)}.brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:54px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.brand b{color:#e4b775}.mast h1{max-width:720px;margin:0;font:400 54px/.98 Georgia,serif;letter-spacing:-.04em}.mast>p{max-width:720px;margin:18px 0 0;color:#bad0c7;font:400 15px/1.55 Georgia,serif}.prepared{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line);background:var(--paper)}.prepared>div{padding:23px 28px;border-right:1px solid var(--line)}.prepared>div:last-child{border-right:0}.prepared span,.metrics span,.section-kicker{display:block;color:#748078;font-size:8px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.prepared strong{display:block;margin:7px 0 4px;font:600 20px Georgia,serif}.prepared small{color:#9a7139;font-size:8px;font-weight:700;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(4,1fr);color:#fff;background:var(--night)}.metrics>div{min-height:112px;padding:23px 24px;border-right:1px solid rgba(255,255,255,.1)}.metrics>div:last-child{border-right:0;background:rgba(155,90,70,.12)}.metrics span{color:#8fa69e}.metrics strong{display:block;margin:13px 0 5px;color:#fff8eb;font:400 24px Georgia,serif}.metrics>div:nth-child(2) strong,.metrics>div:last-child strong{color:#e2b474}.metrics small{color:#83968f;font-size:7px;font-weight:700;text-transform:uppercase}.objective{display:grid;grid-template-columns:125px 1fr;gap:24px;padding:29px 44px;border-bottom:1px solid var(--line)}.objective p{margin:0;font:400 17px/1.45 Georgia,serif}.packet{padding:33px 44px 29px;border-bottom:1px solid var(--line);background:var(--paper);break-inside:avoid-page}.packet:nth-of-type(even){background:#f2ecdf}.packet>header{display:grid;grid-template-columns:38px 1fr auto;gap:16px;align-items:start;margin-bottom:22px}.packet>header>span{display:grid;width:32px;height:32px;place-items:center;border:1px solid #b59b71;border-radius:50%;color:#8d6937;font:italic 11px Georgia,serif}.packet>header small{color:#94703c;font-size:8px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.packet h2{margin:5px 0 8px;font:600 27px/1.05 Georgia,serif;letter-spacing:-.02em}.packet header p{max-width:680px;margin:0;color:var(--muted);font:400 11px/1.5 Georgia,serif}.packet header b{padding:6px 8px;color:var(--risk);border:1px solid #dfc5b8;font-size:7px;letter-spacing:.1em;text-transform:uppercase}.decision-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.decision-list article{display:grid;grid-template-columns:16px 1fr;gap:10px;min-height:116px;padding:15px;border:1px solid var(--line);background:rgba(255,255,255,.66);break-inside:avoid}.decision-list i{width:13px;height:13px;margin-top:2px;border:1px solid #a87a46}.decision-list h3{margin:0 0 7px;font:600 14px/1.25 Georgia,serif}.decision-list p{margin:0;color:var(--muted);font:400 9px/1.48 Georgia,serif}.decision-list small{display:block;margin-top:9px;color:#8c6a3c;font-size:7px;font-weight:700;text-transform:uppercase}.closeout{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--ivory)}.closeout>section{padding:34px 40px;border-right:1px solid var(--line)}.closeout>section:last-child{border-right:0}.closeout h2{margin:7px 0 15px;font:500 25px Georgia,serif}.closeout ol,.closeout ul{display:grid;gap:9px;margin:0;padding-left:18px;color:var(--muted);font:400 10px/1.45 Georgia,serif}.artifacts{padding:32px 40px;border-top:1px solid var(--line);background:#e8e0d1}.artifacts h2{margin:7px 0 16px;font:500 25px Georgia,serif}.artifacts ul{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0;padding:0;list-style:none}.artifacts li{display:flex;justify-content:space-between;gap:15px;padding:10px 11px;border-bottom:1px solid #cbc1ad;font-size:9px}.artifacts li span{color:#8a6a3c;font-size:7px;text-align:right;text-transform:uppercase}.boundary{padding:25px 40px;color:#aebfb8;background:var(--deep);font:400 9px/1.55 Georgia,serif}.boundary code{display:block;margin-bottom:7px;color:#dfb476;font:700 8px monospace}.boundary p{margin:0}.fingerprint{display:block;margin-top:10px;overflow-wrap:anywhere;color:#829a91;font:700 7px monospace}@page{size:Letter;margin:.35in}@media print{html{background:#fff}body{max-width:none}.mast{padding-top:34px}.packet{break-before:auto}.decision-list article{min-height:102px}.artifacts a{text-decoration:none}}@media(max-width:700px){body{width:100%}.mast{padding:38px 24px 32px}.mast h1{font-size:40px}.brand{margin-bottom:38px}.prepared,.metrics,.closeout{grid-template-columns:1fr 1fr}.prepared>div:nth-child(2),.metrics>div:nth-child(2){border-right:0}.metrics>div{border-bottom:1px solid rgba(255,255,255,.1)}.objective{grid-template-columns:1fr;gap:8px;padding:24px}.packet{padding:27px 22px}.packet>header{grid-template-columns:36px 1fr}.packet header b{grid-column:2;justify-self:start}.decision-list,.artifacts ul{grid-template-columns:1fr}.closeout>section{border-bottom:1px solid var(--line)}.artifacts{padding:28px 22px}.boundary{padding:23px 22px}}
@media(max-width:700px){.closeout{grid-template-columns:minmax(0,1fr)}.closeout>section{min-width:0;border-right:0}}
</style></head><body>
<header class="mast"><div class="brand"><span>Focused Future · PERL</span><b>Decision room / 1.0</b></div><h1>Build &amp; integration decision brief.</h1><p>${escapeHtml(safe.meetingObjective)}</p></header>
<section class="prepared" aria-label="Prepared for">${participants}</section>
<section class="metrics" aria-label="Current readiness evidence"><div><span>Local evidence</span><strong>${escapeHtml(safe.evidenceSnapshot.localCurrent)} / 7</strong><small>Reproducible patterns</small></div><div><span>External acceptance</span><strong>0 / 7</strong><small>None recorded here</small></div><div><span>Authority gaps</span><strong>${escapeHtml(safe.evidenceSnapshot.authorityUnassigned)}</strong><small>Roles unassigned</small></div><div><span>Planning clock</span><strong>Not started</strong><small>No calendar commitment</small></div></section>
<section class="objective"><span class="section-kicker">Working-session objective</span><p>${escapeHtml(safe.meetingObjective)}</p></section>
<main>${packets}</main>
<div class="closeout"><section><span class="section-kicker">Return manifest</span><h2>What comes back.</h2><ol>${returnManifest}</ol></section><section><span class="section-kicker">Do not include</span><h2>Keep the boundary clean.</h2><ul>${exclusions}</ul></section></div>
<section class="artifacts"><span class="section-kicker">Controlled references</span><h2>Files that answer the questions.</h2><ul>${artifacts}</ul></section>
<footer class="boundary"><code>${escapeHtml(safe.contractVersion)} · ${escapeHtml(safe.generatedAt)}</code><p>${escapeHtml(safe.boundary)}</p><span class="fingerprint">PACKET ${escapeHtml(safe.packetFingerprint)}</span></footer>
</body></html>`;
}
