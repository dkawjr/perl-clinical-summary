import { assessments as seedAssessments, auditSeed } from "./src/demo-data.js";
import { ApiClient } from "./src/api-client.js";
import { SCALE_THRESHOLDS, coverageScore, generateClinicalInterpretation, generateSummary, resolveScaleLevel, riskDisposition, validateAssessment, validateClinicalInterpretation, validateNarrative } from "./src/engine.js";
import { buildClinicalBrief } from "./src/clinical-brief.js";
import { buildSyntheticAssessmentFromScoreForm } from "./src/test-form-entry.js";
import { parseEqpassScoreReport, readEqpassPdfPages } from "./src/eqpass-pdf.js";

const DEFAULT_REVIEWER = "REVIEWER-01";
const HOSTED_EVALUATION = new URLSearchParams(window.location.search).get("mode") === "product"
  || (["http:", "https:"].includes(window.location.protocol)
    && !["127.0.0.1", "localhost"].includes(window.location.hostname));
const HOSTED_EVALUATION_STORAGE_KEY = "perl-product-workspace-v2";
let mobileNavigationBound = false;

function storedReviewerCode() {
  try {
    const value = String(window.sessionStorage.getItem("perl-calibration-reviewer") || "").trim();
    return /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(value) ? value : DEFAULT_REVIEWER;
  } catch {
    return DEFAULT_REVIEWER;
  }
}

const state = {
  assessments: structuredClone(seedAssessments).map(assessment => withInterpretation(assessment)),
  currentIndex: 0,
  audience: "clinician",
  narratives: {},
  audit: [...auditSeed],
  riskAcknowledged: false,
  selectedFixture: null,
  pdfImport: null,
  reviewerCode: storedReviewerCode(),
  api: new ApiClient(),
  connected: false,
  hostedEvaluation: HOSTED_EVALUATION,
  model: null,
  deploymentPresentation: null,
  calibrationCase: null,
  timingTask: null,
  timingResult: null,
  analysis: null,
  calibrationIntake: null,
  modelTrial: null,
  modelTrialManifest: null,
  candidateTrial: null,
  candidateReturns: null,
  candidateReturnManifest: null,
  candidateReview: null,
  candidateReviewAssignment: null,
  candidateRefinement: null,
  candidateRetest: null,
  candidateRetestManifest: null,
  candidateRetestAssignment: null,
  candidateRetestDisposition: null,
  candidateRetestDispositionAttestation: null,
  candidateAdvancement: null,
  candidateCycleActionAttestation: null,
  candidateAdvancementAttestation: null,
  intendedUse: null,
  languageReview: null,
  counselorLab: null,
  counselorNotebook: null,
  counselorNotebookSessionId: "language-safety",
  counselorReferenceRoom: null,
  counselorReferenceCaseId: null,
  counselorReferenceAdjudication: null,
  counselorReferenceDecision: null,
  counselorReferenceDecisionAttestation: null,
  counselorFieldwork: null,
  progressReview: null,
  clinicalStandard: null,
  independentReview: null,
  independentReviewAdmission: null,
  independentReviewAdmissionAttestation: null,
  integrationReturn: null,
  integrationReturnManifest: null,
  incidents: [],
  studyControl: { state: "active", generationAllowed: true, openIncidents: 0, highSeverityOpen: 0 },
  resolvingIncidentId: null,
  changes: [],
  changeChain: { valid: true, count: 0, head: null },
  runtimeVersions: {},
  decidingChange: null,
  refinement: null,
  refinementSignalIds: [],
  revisions: [],
  revisionChain: { valid: true, count: 0, head: null },
  sourceIntegration: null,
  integrationRehearsal: null,
  workspaceExperience: null,
  experienceMode: "clinical",
  attachmentIntegration: null,
  providerWorkflow: null,
  deliveryOutbox: null,
  recovery: null,
  rollback: null,
  releaseCandidate: null,
  releaseAdmission: null,
  releasePromotion: null,
  releasePromotionAttestation: null,
  monitoring: null,
  incidentResponse: null,
  pilotReadiness: null,
  marketabilityMap: null,
  executiveHandoff: null,
  decisionExchange: null,
  decisionExchangeGateId: "intended-use-approval",
  decisionReturnManifest: null,
  pilotOperations: null,
  pilotPathwayId: "north-central-counseling-center",
  providerActivation: null,
  campusObservatory: null,
  campusCandidateId: "north-central-counseling-center",
  campusReviewMomentId: "admission",
  campusCustomizationPositionId: "no-position-recorded",
  siteAdmission: null,
  siteAdmissionCandidateId: "north-central-counseling-center",
  siteAdmissionReturnManifest: null,
  authorityTrust: null,
  authorityTrustCandidateId: "north-central-counseling-center",
  authorityTrustReceipt: null,
  pilotStart: null,
  pilotStartCandidateId: "north-central-counseling-center",
  pilotStartOrder: null,
  pilotStartAcknowledgement: null,
  clinicalRelease: null,
  clinicalReleaseCandidateId: "north-central-counseling-center",
  clinicalReleaseClinicalAuthorization: null,
  clinicalReleaseProductionAuthorization: null,
  clinicalReleaseDeploymentAttestation: null,
  trafficActivation: null,
  trafficActivationCandidateId: "north-central-counseling-center",
  trafficActivationClinicalAuthorization: null,
  trafficActivationOperationsAuthorization: null,
  trafficActivationTransactionAttestation: null,
  identityAccess: null,
  responseScenarioSelection: null,
  modelGateway: null,
  sourceEvent: null,
  attachment: { status: "not-source-event", eligible: false, preparation: null },
  workflow: { status: "not-source-event", eligible: false, currentJob: null, events: [] },
  reportArtifact: null,
  clinicalBrief: null
};
state.api.setActor(state.reviewerCode);

function restoreHostedEvaluation() {
  if (!state.hostedEvaluation) return;
  try {
    const saved = JSON.parse(window.localStorage.getItem(HOSTED_EVALUATION_STORAGE_KEY) || "null");
    if (!saved || saved.version !== 1 || !Array.isArray(saved.assessments)) return;
    const restored = saved.assessments.filter(assessment => validateAssessment(assessment).length === 0);
    if (restored.length) state.assessments = restored;
    if (saved.narratives && typeof saved.narratives === "object" && !Array.isArray(saved.narratives)) state.narratives = saved.narratives;
    if (Array.isArray(saved.audit)) state.audit = saved.audit.slice(-120);
    if (saved.workspaceProfile && typeof saved.workspaceProfile === "object") {
      state.workspaceExperience = { ...fallbackWorkspaceExperience(), profile: saved.workspaceProfile, saved: true, savedAt: saved.savedAt || null };
    }
  } catch {
    window.localStorage.removeItem(HOSTED_EVALUATION_STORAGE_KEY);
  }
}

function persistHostedEvaluation() {
  if (!state.hostedEvaluation || state.connected) return;
  try {
    const payload = {
      version: 1,
      assessments: state.assessments,
      narratives: state.narratives,
      audit: state.audit.slice(-120),
      workspaceProfile: state.workspaceExperience?.profile || null,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(HOSTED_EVALUATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    showToast("This browser blocked local saving. The current test still works until the tab is closed.");
  }
}

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const dialogOpeners = new WeakMap();
const escapeHTML = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const SCALE_META = [
  { key: "depression", label: "Depression", max: 104 },
  { key: "anxiety", label: "Anxiety", max: 116 },
  { key: "anger", label: "Anger", max: 112 },
  { key: "gpi", label: "Global index", max: 420 }
];

const AUDIENCE_PRESENTATION = Object.freeze({
  clinician: Object.freeze({
    label: "clinician",
    kicker: "01 / Overall distress",
    heading: "Overall distress",
    boundary: "Clinician decision-support draft. Approval applies only to this clinician artifact.",
    editLabel: "Edit clinician narrative",
    editKicker: "Clinician edit",
    editHelp: "Edit for clinical accuracy and clarity. PERL records the change in the review history.",
    printLabel: "Clinician report / PDF"
  }),
  care: Object.freeze({
    label: "care coordination",
    kicker: "01 / Care coordination handoff",
    heading: "What the next team needs",
    boundary: "Audience preview only. It may support coordination after clinician review and is not an approved clinical artifact.",
    editLabel: "Edit care handoff",
    editKicker: "Care handoff edit",
    editHelp: "Refine what a care coordinator needs while preserving uncertainty, clinical ownership, and the deterministic safety route.",
    printLabel: "Care handoff / PDF"
  }),
  payer: Object.freeze({
    label: "payer",
    kicker: "01 / Utilization context",
    heading: "What the record supports",
    boundary: "Audience preview only. It does not decide diagnosis, medical necessity, authorization, eligibility, or level of care.",
    editLabel: "Edit payer handoff",
    editKicker: "Payer handoff edit",
    editHelp: "Refine utilization context without turning scored indicators into a diagnosis, authorization, or level-of-care decision.",
    printLabel: "Payer handoff / PDF"
  }),
  admin: Object.freeze({
    label: "administrative",
    kicker: "01 / Administrative routing",
    heading: "What needs to happen next",
    boundary: "Minimum-necessary audience preview. It contains no clinical interpretation and cannot authorize care, coverage, release, or attachment.",
    editLabel: "Edit admin handoff",
    editKicker: "Administrative handoff edit",
    editHelp: "Refine completion and routing language without adding scored domains, clinical interpretation, or counselor-reference prose.",
    printLabel: "Admin handoff / PDF"
  })
});

const STUDIO_VIEWS = new Set(["studio", "campus", "calibration", "governance"]);
const FALLBACK_WORKSPACE_OPTIONS = Object.freeze({
  modes: [{ id: "clinical", label: "Clinical", note: "One record, one accountable review decision." }, { id: "studio", label: "Administration", note: "Configure the workspace and inspect aggregate patterns." }],
  clinicianRoles: [
    { id: "licensed-clinician", label: "Licensed clinician", note: "Prioritizes evidence review, clinical questions, and the approval boundary." },
    { id: "clinical-supervisor", label: "Clinical supervisor", note: "Adds quality, lineage, and coaching context around the review." },
    { id: "care-coordinator", label: "Care coordinator", note: "Emphasizes handoff context while keeping clinical approval separate." },
    { id: "operations-lead", label: "Operations lead", note: "Emphasizes aggregate workflow and hides patient-level clinical decision controls in Studio." }
  ],
  careSettings: [{ id: "university-counseling", label: "University counseling" }, { id: "community-behavioral-health", label: "Community behavioral health" }, { id: "private-practice", label: "Private practice" }, { id: "utilization-review", label: "Utilization review" }],
  reviewFocuses: [{ id: "balanced", label: "Balanced review", note: "Evidence, context, safety, and follow-up share the page." }, { id: "safety-first", label: "Safety first", note: "Keeps the safety gate and pattern checks closest to the decision." }, { id: "evidence-first", label: "Evidence first", note: "Brings score lineage and quality controls forward." }, { id: "conversation-first", label: "Conversation first", note: "Brings clinical themes and follow-up questions forward." }],
  densities: [{ id: "calm", label: "Calm", note: "Generous spacing for deliberate review." }, { id: "compact", label: "Compact", note: "More context in view without changing content." }],
  modules: [{ id: "metadata", label: "Record metadata" }, { id: "evidence", label: "Score evidence" }, { id: "patterns", label: "Pattern checks" }, { id: "questions", label: "Follow-up questions" }, { id: "quality", label: "Draft quality" }, { id: "handoff", label: "e-QPASS handoff" }, { id: "lineage", label: "Revision lineage" }, { id: "audit", label: "Audit trail" }],
  demographicDimensions: [{ id: "age-band", label: "Age band" }, { id: "gender", label: "Gender" }, { id: "first-generation", label: "First-generation status" }, { id: "service-language", label: "Service language" }]
});

const FALLBACK_DEMOGRAPHIC_DIMENSIONS = Object.freeze([
  { id: "age-band", label: "Age band", question: "Does review access or routing look meaningfully different across age bands?", cells: [
    { label: "18–20", count: 13, reviewCompletion: 85, directReviewRouting: 15, averageGpi: 76, suppressed: false },
    { label: "21–24", count: 18, reviewCompletion: 89, directReviewRouting: 11, averageGpi: 82, suppressed: false },
    { label: "25+", count: 11, reviewCompletion: 82, directReviewRouting: 18, averageGpi: 71, suppressed: false }
  ] },
  { id: "gender", label: "Gender", question: "Are completion and direct-review routing patterns visible without identifying a person?", cells: [
    { label: "Woman", count: 20, reviewCompletion: 90, directReviewRouting: 15, averageGpi: 81, suppressed: false },
    { label: "Man", count: 15, reviewCompletion: 80, directReviewRouting: 13, averageGpi: 73, suppressed: false },
    { label: "Nonbinary / self-described", count: 7, reviewCompletion: 86, directReviewRouting: 14, averageGpi: 79, suppressed: false }
  ] },
  { id: "first-generation", label: "First-generation status", question: "Does the cohort suggest an access or review-completion question worth investigating?", cells: [
    { label: "First-generation", count: 18, reviewCompletion: 83, directReviewRouting: 17, averageGpi: 84, suppressed: false },
    { label: "Not first-generation", count: 19, reviewCompletion: 89, directReviewRouting: 11, averageGpi: 72, suppressed: false },
    { label: "Not recorded", count: 5, reviewCompletion: 80, directReviewRouting: 20, averageGpi: 78, suppressed: false }
  ] },
  { id: "service-language", label: "Service language", question: "Where might language access deserve operational follow-up?", cells: [
    { label: "English", count: 30, reviewCompletion: 90, directReviewRouting: 13, averageGpi: 76, suppressed: false },
    { label: "Spanish / bilingual", count: 7, reviewCompletion: 71, directReviewRouting: 14, averageGpi: 87, suppressed: false },
    { label: "Other / not recorded", count: 5, reviewCompletion: 80, directReviewRouting: 20, averageGpi: 74, suppressed: false }
  ] }
]);

function fallbackWorkspaceExperience() {
  const profile = {
    defaultMode: "clinical",
    clinicianRole: "licensed-clinician",
    careSetting: "university-counseling",
    reviewFocus: "balanced",
    density: "calm",
    visibleModules: FALLBACK_WORKSPACE_OPTIONS.modules.map(item => item.id),
    demographicDimension: "age-band"
  };
  return {
    profile,
    context: { role: FALLBACK_WORKSPACE_OPTIONS.clinicianRoles[0], setting: FALLBACK_WORKSPACE_OPTIONS.careSettings[0], focus: FALLBACK_WORKSPACE_OPTIONS.reviewFocuses[0], statement: "Licensed clinician · University counseling · Balanced review", roleContextGrantsAuthorization: false },
    display: { alwaysVisibleModules: ["safety", "limitations", "approval"], configurableModules: FALLBACK_WORKSPACE_OPTIONS.modules, visibleModules: profile.visibleModules, safetyCanBeHidden: false, clinicalContentChanged: false },
    options: FALLBACK_WORKSPACE_OPTIONS,
    demographics: { selectedDimension: "age-band", totalSyntheticRecords: 42, minimumCellSize: 5, dimensions: structuredClone(FALLBACK_DEMOGRAPHIC_DIMENSIONS), personLevelRecordsAvailable: false, protectedAttributeDecisioningAllowed: false, phiIncluded: false },
    saved: false,
    savedAt: null,
    chain: { valid: true, count: 0, head: null },
    boundary: "Aggregate operational view. Minimum cell size five; no person-level drill-down or protected-attribute decisioning."
  };
}

function optionMarkup(options = [], selected = "") {
  return options.map(option => `<option value="${escapeHTML(option.id)}"${option.id === selected ? " selected" : ""}>${escapeHTML(option.label)}</option>`).join("");
}

function workspaceOption(group, id) {
  return state.workspaceExperience?.options?.[group]?.find(item => item.id === id) || FALLBACK_WORKSPACE_OPTIONS[group]?.find(item => item.id === id) || { id, label: String(id || "").replaceAll("-", " "), note: "" };
}

function applyExperienceMode(mode) {
  const next = mode === "studio" ? "studio" : "clinical";
  state.experienceMode = next;
  document.body.dataset.experienceMode = next;
  $$("[data-experience-mode]").forEach(button => {
    const active = button.dataset.experienceMode === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const modeName = $("#workspace-mode-name");
  const activeLabel = $("#active-experience-label");
  if (modeName) modeName.textContent = next === "studio" ? "Administration" : "Clinical workspace";
  if (activeLabel) activeLabel.textContent = next === "studio" ? "Admin" : "Clinical";
}

function chooseExperienceMode(mode, { focus = true } = {}) {
  applyExperienceMode(mode);
  switchView(mode === "studio" ? "studio" : "review", { focus });
}

function applyWorkspaceProfile(profile = state.workspaceExperience?.profile) {
  if (!profile) return;
  const visible = new Set(profile.visibleModules || []);
  $$('[data-workspace-module]').forEach(element => {
    const hidden = !visible.has(element.dataset.workspaceModule);
    element.classList.toggle("workspace-module-hidden", hidden);
    if (hidden) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  });
  if (!visible.has("questions") && $("#questions-tab").classList.contains("active")) selectContentTab($("#hypotheses-tab"));
  document.body.dataset.workspaceDensity = profile.density;
  document.body.dataset.reviewFocus = profile.reviewFocus;
  document.body.dataset.clinicianRole = profile.clinicianRole;
  const role = workspaceOption("clinicianRoles", profile.clinicianRole);
  const setting = workspaceOption("careSettings", profile.careSetting);
  const focus = workspaceOption("reviewFocuses", profile.reviewFocus);
  $("#clinical-context-line").textContent = `${role.label} · ${setting.label} · ${focus.label}`;
  $("#review-lede").textContent = ({
    "licensed-clinician": "Verify the generated draft against scored evidence before it enters the clinical workflow.",
    "clinical-supervisor": "Review the draft, its evidence trail, and the decision conditions that support accountable supervision.",
    "care-coordinator": "Read the clinical draft in context, then keep coordination separate from clinical approval.",
    "operations-lead": "Inspect how the configured clinical surface supports review without changing clinical authority."
  })[profile.clinicianRole] || "Verify the generated draft against scored evidence before it enters the clinical workflow.";
}

function workspaceDraftFromForm() {
  const current = state.workspaceExperience?.profile || fallbackWorkspaceExperience().profile;
  return {
    defaultMode: document.querySelector('input[name="workspaceDefaultMode"]:checked')?.value || current.defaultMode,
    clinicianRole: $("#workspace-role").value || current.clinicianRole,
    careSetting: $("#workspace-setting").value || current.careSetting,
    reviewFocus: $("#workspace-focus").value || current.reviewFocus,
    density: $("#workspace-density").value || current.density,
    visibleModules: $$('#workspace-module-options input[type="checkbox"]:checked').map(input => input.value),
    demographicDimension: $("#demographic-dimension").value || current.demographicDimension
  };
}

function renderStudioPreview(profile) {
  const role = workspaceOption("clinicianRoles", profile.clinicianRole);
  const setting = workspaceOption("careSettings", profile.careSetting);
  const focus = workspaceOption("reviewFocuses", profile.reviewFocus);
  $("#studio-profile-role").textContent = role.label;
  $("#studio-profile-setting").textContent = setting.label;
  $("#studio-preview-note").textContent = `${role.label} · ${setting.label} · ${focus.label}`;
  $("#workspace-role-note").textContent = role.note || "Changes emphasis, never authorization.";
  $("#workspace-focus-note").textContent = focus.note || "Display emphasis only.";
  const visible = new Set(profile.visibleModules || []);
  const modules = (state.workspaceExperience?.options?.modules || FALLBACK_WORKSPACE_OPTIONS.modules).filter(item => visible.has(item.id));
  $("#studio-preview-modules").innerHTML = modules.length
    ? modules.map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHTML(item.label)}</strong></li>`).join("")
    : "<li><span>—</span><strong>Only the locked clinical boundary will remain.</strong></li>";
}

function renderDemographicLens(dimensionId) {
  const demographics = state.workspaceExperience?.demographics;
  const dimension = demographics?.dimensions?.find(item => item.id === dimensionId) || demographics?.dimensions?.[0];
  if (!dimension) {
    $("#demographic-question").textContent = "Aggregate demographic data will appear as the workspace receives eligible records.";
    $("#demographic-cells").innerHTML = '<p class="demographic-empty">No eligible aggregate groups are available yet.</p>';
    return;
  }
  $("#demographic-question").textContent = dimension.question;
  $("#demographic-cells").innerHTML = dimension.cells.map((cell, index) => cell.suppressed
    ? `<article class="demographic-cell suppressed"><header><span>${String(index + 1).padStart(2, "0")}</span><h3>Small cell suppressed</h3></header><p>Fewer than ${demographics.minimumCellSize} aggregate records. No metrics displayed.</p></article>`
    : `<article class="demographic-cell">
      <header><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHTML(cell.label)}</h3><small>${cell.count} aggregate records</small></div></header>
      <div class="demographic-metric completion"><span>Review completion</span><strong>${cell.reviewCompletion}%</strong><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, cell.reviewCompletion))}%"></b></i></div>
      <div class="demographic-metric routing"><span>Direct-review route</span><strong>${cell.directReviewRouting}%</strong><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, cell.directReviewRouting))}%"></b></i></div>
      <div class="demographic-metric gpi"><span>Average GPI</span><strong>${cell.averageGpi}</strong><i aria-hidden="true"><b style="width:${Math.max(0, Math.min(100, (cell.averageGpi / 186) * 100))}%"></b></i></div>
    </article>`).join("");
}

function renderWorkspaceExperience(workspace) {
  state.workspaceExperience = workspace || fallbackWorkspaceExperience();
  const { profile, options, context, demographics, chain } = state.workspaceExperience;
  $("#workspace-role").innerHTML = optionMarkup(options.clinicianRoles, profile.clinicianRole);
  $("#workspace-setting").innerHTML = optionMarkup(options.careSettings, profile.careSetting);
  $("#workspace-focus").innerHTML = optionMarkup(options.reviewFocuses, profile.reviewFocus);
  $("#workspace-density").innerHTML = optionMarkup(options.densities, profile.density);
  $("#workspace-default-modes").innerHTML = options.modes.map(item => `<label><input type="radio" name="workspaceDefaultMode" value="${escapeHTML(item.id)}"${item.id === profile.defaultMode ? " checked" : ""}><span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.note)}</small></span></label>`).join("");
  const visible = new Set(profile.visibleModules || []);
  $("#workspace-module-options").innerHTML = options.modules.map(item => `<label><input type="checkbox" value="${escapeHTML(item.id)}"${visible.has(item.id) ? " checked" : ""}><span><strong>${escapeHTML(item.label)}</strong><small>${visible.has(item.id) ? "Shown" : "Hidden"}</small></span></label>`).join("");
  $("#demographic-dimension").innerHTML = optionMarkup(options.demographicDimensions, profile.demographicDimension);
  $("#studio-save-state").textContent = state.workspaceExperience.saved ? "Workspace profile saved" : "Workspace profile ready";
  $("#workspace-save-announcement").textContent = state.workspaceExperience.savedAt
    ? `Saved ${new Date(state.workspaceExperience.savedAt).toLocaleString()} · display choices only.`
    : "No display choices have been changed.";
  $("#demographic-chain").textContent = chain?.head ? `PROFILE ${chain.head.slice(0, 14)}… · ${chain.count} event${chain.count === 1 ? "" : "s"}` : "PROFILE GENESIS";
  $("#demographic-chain").classList.toggle("failed", chain?.valid === false);
  $("#demographic-boundary").textContent = state.workspaceExperience.boundary;
  renderStudioPreview(profile);
  renderDemographicLens(profile.demographicDimension);
  applyWorkspaceProfile(profile);
  if (context?.statement) $("#clinical-context-line").textContent = context.statement;
}

async function loadWorkspaceExperience({ applyDefault = false } = {}) {
  try {
    const { workspace } = state.connected ? await state.api.workspaceExperience() : { workspace: fallbackWorkspaceExperience() };
    renderWorkspaceExperience(workspace);
    if (applyDefault) chooseExperienceMode(workspace.profile.defaultMode, { focus: false });
  } catch (error) {
    renderWorkspaceExperience(fallbackWorkspaceExperience());
    showToast(error.message);
  }
}

function currentAssessment() {
  return state.assessments[state.currentIndex];
}

function displayRecordId(value) {
  return String(value || "").replace(/^FF-TEST-/, "");
}

function displayEngineVersion(value) {
  const version = String(value || "").trim();
  return !version || /^cal-/i.test(version) ? "PERL 2.49" : version;
}

function reviewerInitials(value) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2) || "DR";
}

function renderReviewerIdentity() {
  const profile = $("#reviewer-profile");
  profile.textContent = reviewerInitials(state.reviewerCode);
  profile.setAttribute("aria-label", `Change reviewer; current code ${state.reviewerCode}`);
  profile.title = `Reviewer: ${state.reviewerCode}`;
  $("#reviewer-code").value = state.reviewerCode;
  $("#study-current-reviewer").textContent = `Reviewer · ${state.reviewerCode}`;
}

function withInterpretation(assessment, interpretation = generateClinicalInterpretation(assessment)) {
  return {
    ...assessment,
    hypotheses: interpretation.hypotheses,
    questions: interpretation.questions,
    interpretationProvenance: {
      provider: interpretation.provider || "deterministic-calibration",
      version: interpretation.version || "cal-0.9.3",
      source: interpretation.source || "generated",
      revision: Number(interpretation.revision || 0),
      actor: interpretation.actor || null,
      changed: interpretation.changed || []
    }
  };
}

function setConnectionState(connected, health = null) {
  state.connected = connected;
  state.model = health?.model || null;
  state.deploymentPresentation = health?.deploymentPresentation || null;
  const chip = $(".environment-chip");
  chip.classList.toggle("offline", !connected && !state.hostedEvaluation);
  chip.classList.toggle("hosted", !connected && state.hostedEvaluation);
  chip.classList.toggle("deployment", Boolean(connected && state.deploymentPresentation?.mode === "deployment-review"));
  $("#report-incident").disabled = !connected;
  $("#register-change").disabled = !connected;
  $("#timing-start").disabled = !connected;
  $("#save-counselor-notebook").disabled = !connected;
  $("#save-progress-observation").disabled = !connected;
  $("#seal-independent-review").disabled = !connected;
  $("#issue-independent-admission-challenge").disabled = !connected || !state.independentReviewAdmission?.registry?.registryCurrent || state.independentReviewAdmission?.registry?.activeKeyCount < 7 || !Object.values(state.independentReviewAdmission?.prerequisites || {}).every(Boolean);
  $("#verify-independent-admission-attestation").disabled = !connected || !state.independentReviewAdmissionAttestation;
  $("#preflight-model-trial").disabled = !connected || !state.modelTrialManifest;
  $("#issue-authority-trust-challenge").disabled = !connected || !state.authorityTrust?.registry?.registryCurrent || !state.authorityTrust?.registry?.activeKeyCount;
  $("#verify-authority-trust-receipt").disabled = !connected || !state.authorityTrustReceipt;
  $("#issue-pilot-start-challenge").disabled = !connected || !state.pilotStart?.registry?.registryCurrent;
  $("#verify-pilot-start-order").disabled = !connected || !state.pilotStartOrder;
  $("#verify-pilot-start-ack").disabled = !connected || !state.pilotStartAcknowledgement;
  $("#issue-clinical-release-challenge").disabled = !connected || !state.clinicalRelease?.registry?.registryCurrent;
  $("#verify-clinical-release-clinical").disabled = !connected || !state.clinicalReleaseClinicalAuthorization;
  $("#verify-clinical-release-production").disabled = !connected || !state.clinicalReleaseProductionAuthorization;
  $("#verify-clinical-release-attestation").disabled = !connected || !state.clinicalReleaseDeploymentAttestation;
  $("#issue-traffic-activation-challenge").disabled = !connected || !state.trafficActivation?.registry?.registryCurrent;
  $("#verify-traffic-activation-clinical").disabled = !connected || !state.trafficActivationClinicalAuthorization;
  $("#verify-traffic-activation-operations").disabled = !connected || !state.trafficActivationOperationsAuthorization;
  $("#verify-traffic-activation-transaction").disabled = !connected || !state.trafficActivationTransactionAttestation;
  $("#snapshot-candidate-trial").disabled = !connected;
  $("#record-candidate-returns").disabled = !connected || !state.candidateReturnManifest;
  $("#open-candidate-review").disabled = !connected || !state.candidateReview?.packetIssuanceEnabled || Number(state.candidateReview?.reviewerProgress?.completed || 0) >= Number(state.candidateReview?.reviewerProgress?.available || 0);
  $("#submit-candidate-review").disabled = !connected || !state.candidateReviewAssignment;
  $("#next-candidate-review").disabled = !connected;
  $("#candidate-refinement-create").disabled = !connected || !state.candidateRefinement?.cycleIssuanceEnabled;
  $("#record-candidate-retest-returns").disabled = !connected || !state.candidateRetestManifest || !state.candidateRetest?.returnIntakeEnabled;
  $("#open-candidate-retest-review").disabled = !connected || !state.candidateRetest?.packetIssuanceEnabled;
  $("#submit-candidate-retest-review").disabled = !connected || !state.candidateRetestAssignment;
  $("#next-candidate-retest-review").disabled = !connected || !state.candidateRetest?.packetIssuanceEnabled;
  $("#issue-candidate-disposition-challenge").disabled = !connected || !state.candidateRetestDisposition?.registry?.registryCurrent || state.candidateRetestDisposition?.registry?.activeKeyCount < 4 || !Object.values(state.candidateRetestDisposition?.prerequisites || {}).every(Boolean) || state.candidateRetestDisposition?.independentResultFrozen;
  $("#verify-candidate-disposition-attestation").disabled = !connected || !state.candidateRetestDispositionAttestation || !state.candidateRetestDisposition?.activeChallenge || state.candidateRetestDisposition?.independentResultFrozen;
  $("#issue-candidate-cycle-action-challenge").disabled = !connected || !state.candidateAdvancement?.prerequisites?.independentResultCurrent || !state.candidateAdvancement?.registries?.cycleAction?.registryCurrent || state.candidateAdvancement?.cycleActionFrozen;
  $("#verify-candidate-cycle-action-attestation").disabled = !connected || !state.candidateCycleActionAttestation || !state.candidateAdvancement?.rooms?.cycleAction?.activeChallenge || state.candidateAdvancement?.cycleActionFrozen;
  $("#issue-candidate-advancement-challenge").disabled = !connected || !state.candidateAdvancement?.prerequisites?.candidateEligible || !state.candidateAdvancement?.registries?.candidateAdvancement?.registryCurrent || state.candidateAdvancement?.candidateAdvancementFrozen;
  $("#verify-candidate-advancement-attestation").disabled = !connected || !state.candidateAdvancementAttestation || !state.candidateAdvancement?.rooms?.candidateAdvancement?.activeChallenge || state.candidateAdvancement?.candidateAdvancementFrozen;
  $("#preflight-owner-return").disabled = !connected || !state.integrationReturnManifest;
  $("#preflight-decision-return").disabled = !connected || !state.decisionReturnManifest;
  $("#preflight-site-admission").disabled = !connected || !state.siteAdmissionReturnManifest;
  $("#seal-campus-snapshot").disabled = !connected;
  $("#export-campus-observatory").classList.toggle("disabled", !connected);
  $("#export-campus-observatory").setAttribute("aria-disabled", String(!connected));
  const presentation = state.deploymentPresentation;
  const deploymentReview = connected && presentation?.mode === "deployment-review";
  const hostedEvaluation = !connected && state.hostedEvaluation;
  $("#connection-label").textContent = deploymentReview
    ? "PERL workspace"
    : connected
      ? "Secure clinical workspace"
      : hostedEvaluation
        ? "Private browser workspace"
      : window.location.protocol === "file:"
        ? "Open the live workspace"
        : "Workspace offline";
  document.body.dataset.runtimePresentation = deploymentReview ? "deployment-review" : connected ? "clinical-server" : hostedEvaluation ? "hosted-product" : "source-file";
  $("#runtime-note-kicker").textContent = deploymentReview ? `PERL ${presentation.candidateVersion}` : connected ? "PERL workspace" : hostedEvaluation ? "PERL workspace" : "Application source";
  $("#runtime-note-title").textContent = deploymentReview ? "Clinical operations" : connected ? "Secure clinical operations" : hostedEvaluation ? "Private browser processing" : "Live workspace required";
  $("#runtime-note-copy").textContent = deploymentReview ? "Persistent application services and audit controls are active." : connected ? "Persistent records, safety controls, and audit history are active." : hostedEvaluation ? "Reports and workspace settings remain on this device." : "Open the live PERL link to use PDF processing, persistence, and reports.";
  const candidateBar = $("#deployment-candidate-bar");
  candidateBar.hidden = !(deploymentReview || hostedEvaluation);
  if (deploymentReview) {
    $("#deployment-candidate-version").textContent = presentation.candidateVersion;
    $("#deployment-candidate-state").textContent = presentation.deploymentReviewReady ? "Ready" : "Initializing";
    $("#deployment-candidate-boundary").textContent = "Clinical review and organizational policy govern use of every generated summary.";
    document.title = `PERL ${presentation.candidateVersion} · Clinical intelligence`;
  } else if (hostedEvaluation) {
    $("#deployment-candidate-version").textContent = "2.49";
    $("#deployment-candidate-state").textContent = "Ready";
    $("#deployment-candidate-boundary").textContent = "Your selected PDF is processed locally and is not retained by PERL.";
    candidateBar.querySelector("div:nth-child(2) span").textContent = "PDF processing";
    candidateBar.querySelector("div:nth-child(2) strong").textContent = "On this device";
    document.title = "PERL · Clinical intelligence workspace";
  }
  $$(".export-link").forEach(link => {
    link.classList.toggle("disabled", !connected);
    link.setAttribute("aria-disabled", String(!connected));
    if (connected) link.href = {
      "export-manifest": "/api/calibration/manifest",
      "export-json": "/api/calibration/export.json",
      "export-csv": "/api/calibration/export.csv",
      "export-timing": "/api/calibration/timing/export.csv",
      "export-intake": "/api/calibration/intake.json",
      "export-model-trial-request": "/api/calibration/model-trial/request.json",
      "export-model-trial": "/api/calibration/model-trial.json",
      "export-candidate-trial": "/api/calibration/candidate-trial.json",
      "export-candidate-returns": "/api/calibration/candidate-returns.json",
      "export-candidate-review": "/api/calibration/candidate-review.json",
      "export-candidate-refinement": "/api/calibration/candidate-refinement.json",
      "export-candidate-retest": "/api/calibration/candidate-retest.json",
      "export-candidate-disposition": "/api/calibration/candidate-retest/disposition.json",
      "export-candidate-advancement": "/api/calibration/candidate-advancement.json",
      "export-counselor-lab": "/api/calibration/counselor-lab.json",
      "export-counselor-notebook": "/api/calibration/counselor-notebook.json",
      "export-progress": "/api/progress.json",
      "open-progress-report": "/api/progress/report.html",
      "export-clinical-standard": "/api/calibration/clinical-standard.json",
      "export-independent-review": "/api/calibration/independent-review.json",
      "export-independent-admission": "/api/calibration/independent-review/admission.json",
      "export-owner-return": "/api/integration/owner-return/request.json",
      "export-refinement": "/api/calibration/refinement.json"
    }[link.id];
    else link.removeAttribute("href");
  });
}

function applyDetail(detail) {
  const id = detail.assessment.id;
  const enriched = withInterpretation(detail.assessment, detail.interpretation);
  const index = state.assessments.findIndex(assessment => assessment.id === id);
  if (index >= 0) state.assessments[index] = { ...state.assessments[index], ...enriched };
  else state.assessments.unshift(enriched);
  state.currentIndex = Math.max(0, state.assessments.findIndex(assessment => assessment.id === id));
  for (const [audience, narrative] of Object.entries(detail.narratives || {})) {
    state.narratives[`${id}:${audience}`] = narrative.text;
  }
  state.audit = detail.audit || [];
  state.revisions = detail.revisions || [];
  state.revisionChain = detail.revisionChain || { valid: true, count: state.revisions.length, head: null };
  state.riskAcknowledged = Boolean(detail.review?.safetyAcknowledged);
  state.sourceEvent = detail.sourceEvent || null;
  state.attachment = detail.attachment || { status: "not-source-event", eligible: false, preparation: null };
  state.workflow = detail.workflow || { status: "not-source-event", eligible: false, currentJob: null, events: [] };
  state.reportArtifact = detail.reportArtifact || null;
  state.clinicalBrief = detail.clinicalBrief || null;
}

function formatPairedRating(analysis, key) {
  const perl = analysis.ratings.byAuthor.perlGenerated[key];
  const counselor = analysis.ratings.byAuthor.counselorReference[key];
  const difference = analysis.ratings.difference[key];
  if (!perl.n) return { headline: "—", spread: "No paired ratings" };
  const delta = difference.mean > 0 ? `+${difference.mean.toFixed(2)}` : difference.mean.toFixed(2);
  return {
    headline: `${perl.mean.toFixed(2)} / ${counselor.mean.toFixed(2)} · Δ ${delta}`,
    spread: `Medians ${perl.median.toFixed(2)} / ${counselor.median.toFixed(2)} · IQR ${perl.q1.toFixed(2)}–${perl.q3.toFixed(2)} / ${counselor.q1.toFixed(2)}–${counselor.q3.toFixed(2)}`
  };
}

function renderCalibrationAnalysis(analysis) {
  if (!analysis) return;
  state.analysis = analysis;
  const preference = analysis.preference;
  const interval = preference.confidenceInterval;
  $("#study-perl-rate").textContent = preference.perlRate == null ? "—" : `${(preference.perlRate * 100).toFixed(1)}%`;
  $("#study-perl-ci").textContent = interval
    ? `Wilson 95% CI ${(interval.lower * 100).toFixed(1)}–${(interval.upper * 100).toFixed(1)}% · n=${analysis.sample.revealedComparisons}`
    : "No revealed blind outcomes yet.";
  $("#study-comparisons").innerHTML = `${analysis.sample.pairedComparisons} <small>/ ${analysis.thresholds.minimumComparisons}</small>`;
  $("#comparison-count").textContent = String(analysis.sample.pairedComparisons).padStart(2, "0");
  $("#study-reviewers").innerHTML = `${analysis.sample.reviewers} <small>/ ${analysis.thresholds.minimumReviewers}</small>`;
  const timing = analysis.timing;
  const eligibleTiming = timing.protocolEligibleMinutes;
  $("#study-review-time").textContent = eligibleTiming.n ? `${eligibleTiming.median.toFixed(1)} min` : "—";
  $("#study-review-time-detail").textContent = eligibleTiming.n
    ? `IQR ${eligibleTiming.q1.toFixed(1)}–${eligibleTiming.q3.toFixed(1)} min · n=${timing.eligible} · ${timing.flagged} flagged · no baseline`
    : timing.captured
      ? `${timing.captured} captured · ${timing.flagged} outside the 30 sec–45 min window`
      : "No protocol-eligible server timing yet.";
  const workflowTiming = analysis.workflowTiming;
  if (workflowTiming) {
    const unaided = workflowTiming.conditions.unaided;
    const assisted = workflowTiming.conditions["perl-assisted"];
    const eligibleTarget = workflowTiming.thresholds.minimumEligiblePerCondition;
    $("#workflow-unaided").innerHTML = `${unaided.eligible} <small>/ ${eligibleTarget}</small>`;
    $("#workflow-assisted").innerHTML = `${assisted.eligible} <small>/ ${eligibleTarget}</small>`;
    $("#workflow-matched").innerHTML = `${workflowTiming.matchedCases} <small>/ ${workflowTiming.thresholds.minimumMatchedCases}</small>`;
    $("#workflow-unaided-detail").textContent = unaided.protocolEligibleMinutes.n
      ? `Median ${unaided.protocolEligibleMinutes.median.toFixed(1)} min · ${unaided.flagged} flagged`
      : `${unaided.captured} captured · no eligible timing yet`;
    $("#workflow-assisted-detail").textContent = assisted.protocolEligibleMinutes.n
      ? `Median ${assisted.protocolEligibleMinutes.median.toFixed(1)} min · ${assisted.flagged} flagged`
      : `${assisted.captured} captured · no eligible timing yet`;
    $("#workflow-difference").textContent = workflowTiming.matchedDifferenceMinutes.n
      ? `${workflowTiming.matchedDifferenceMinutes.median > 0 ? "+" : ""}${workflowTiming.matchedDifferenceMinutes.median.toFixed(1)} min`
      : "—";
    $("#workflow-timing-status").textContent = workflowTiming.ready ? "Mechanical threshold met · independent analysis required" : "Timing claim blocked";
    $("#workflow-timing-status").classList.toggle("ready", workflowTiming.ready);
    $("#workflow-timing-boundary").textContent = workflowTiming.interpretation;
    const timingChain = analysis.integrity?.workflowTiming;
    $("#workflow-timing-integrity").textContent = timingChain?.valid
      ? `Timing ledger verified · ${timingChain.count} observation${timingChain.count === 1 ? "" : "s"}`
      : "Timing ledger integrity unavailable";
    $("#workflow-timing-integrity").classList.toggle("failed", timingChain && !timingChain.valid);
  }
  const releaseEvidence = analysis.releaseEvidence;
  if (releaseEvidence) {
    const outcomeTargets = {
      inputContract: ["#release-input-contract", "#release-input-contract-unit"],
      criticalScreenHandling: ["#release-critical-screen", "#release-critical-screen-unit"],
      diagnosticRestraint: ["#release-diagnostic-restraint", "#release-diagnostic-restraint-unit"],
      evidenceLineage: ["#release-evidence-lineage", "#release-evidence-lineage-unit"]
    };
    for (const [key, [valueTarget, unitTarget]] of Object.entries(outcomeTargets)) {
      const outcome = releaseEvidence.outcomes[key];
      $(valueTarget).innerHTML = `${outcome.numerator} <small>/ ${outcome.denominator}</small>`;
      $(unitTarget).textContent = outcome.unit;
      const card = $(`[data-release-outcome="${key}"]`);
      card.dataset.status = outcome.status;
      card.setAttribute("aria-label", `${outcome.label}: ${outcome.numerator} of ${outcome.denominator} ${outcome.unit}; ${outcome.status}`);
    }
    $("#release-regression-status").textContent = releaseEvidence.engineeringRegressionPassed ? "Synthetic regression passed" : "Synthetic regression failed";
    $("#release-regression-status").classList.toggle("failed", !releaseEvidence.engineeringRegressionPassed);
    $("#release-clinical-status").textContent = analysis.releaseDecision?.decision || "Clinical release blocked";
    $("#release-evidence-boundary").textContent = releaseEvidence.boundary;
    $("#release-evidence-provider").textContent = `${releaseEvidence.evaluator} · ${releaseEvidence.provider.id} ${releaseEvidence.provider.version}`;
  }
  const exposure = analysis.safety.exposure;
  const outsideExposure = exposure.eventsOutsideCompletedComparisonExposure
    ? ` · ${exposure.eventsOutsideCompletedComparisonExposure} outside completed-case exposure`
    : "";
  $("#study-safety-exposure").textContent = exposure.completedBlindComparisons
    ? `Reported-event exposure · ${exposure.reportedEvents} linked event${exposure.reportedEvents === 1 ? "" : "s"} / ${exposure.completedBlindComparisons} completed comparisons · ${exposure.eventsPer100CompletedComparisons.toFixed(2)} per 100${outsideExposure}. Events may repeat a case.`
    : `Reported-event exposure · no completed-comparison denominator yet${outsideExposure}.`;
  $("#study-position-balance").textContent = analysis.sample.pairedComparisons
    ? `PERL position A ${preference.pairedPerlPositionA} · position B ${preference.pairedPerlPositionB}`
    : "Position balance appears after author reveal.";
  const caseSet = analysis.caseSet;
  if (caseSet) {
    $("#case-set-version").textContent = `${caseSet.id} · v${caseSet.version}`;
    $("#case-set-status").textContent = caseSet.ready ? caseSet.status.replaceAll("-", " ") : `Coverage gap · ${caseSet.missingStrata.join(", ").replaceAll("-", " ")}`;
    const development = caseSet.partitionCoverage.development;
    const holdout = caseSet.partitionCoverage.holdout;
    $("#case-set-development").textContent = `${development.reviewedCases} / ${development.cases}`;
    $("#case-set-development-comparisons").textContent = development.pairedComparisons;
    $("#case-set-holdout").textContent = `${holdout.reviewedCases} / ${holdout.cases}`;
    $("#case-set-holdout-comparisons").textContent = holdout.pairedComparisons;
    $("#case-set-strata").innerHTML = Object.entries(caseSet.stratumCoverage).map(([stratum, coverage]) => (
      `<span>${escapeHTML(stratum.replaceAll("-", " "))}<strong>${coverage.reviewedCases}/${coverage.cases}</strong></span>`
    )).join("");
    $("#case-set-boundary").textContent = caseSet.claimBoundary;
  }
  const outcomeChain = analysis.integrity?.blindOutcomes;
  if (outcomeChain) {
    const legacy = outcomeChain.legacyBaselines ? ` · ${outcomeChain.legacyBaselines} migration baseline${outcomeChain.legacyBaselines === 1 ? "" : "s"}` : "";
    $("#outcome-integrity").textContent = outcomeChain.valid
      ? `Blind outcome ledger verified · ${outcomeChain.count} linked outcome${outcomeChain.count === 1 ? "" : "s"}${legacy}`
      : "Blind outcome ledger integrity failed";
    $("#outcome-integrity").classList.toggle("failed", !outcomeChain.valid);
  }
  for (const key of ["accuracy", "restraint", "utility"]) {
    const rating = formatPairedRating(analysis, key);
    $(`#study-rating-${key}`).textContent = rating.headline;
    $(`#study-spread-${key}`).textContent = rating.spread;
  }
  const agreement = analysis.agreement;
  $("#agreement-cases").innerHTML = `${agreement.casesWithMultipleReviewers} <small>/ ${analysis.thresholds.minimumOverlappedCases}</small>`;
  $("#agreement-pairs").textContent = agreement.reviewerPairs;
  $("#agreement-observed").textContent = agreement.preference ? `${(agreement.preference.observedAgreement * 100).toFixed(1)}%` : "—";
  $("#agreement-ac1").textContent = agreement.preference ? agreement.preference.coefficient.toFixed(2) : "—";
  $("#agreement-status").textContent = agreement.ready ? "Overlap threshold met · still synthetic" : "Exploratory · overlap threshold not met";
  $("#agreement-status").classList.toggle("ready", agreement.ready);
  const perlGap = agreement.ratingAbsoluteDifference.perlGenerated;
  const counselorGap = agreement.ratingAbsoluteDifference.counselorReference;
  $("#agreement-rating-note").textContent = perlGap.accuracy.n
    ? `Mean absolute rating difference · PERL A/R/U ${perlGap.accuracy.mean.toFixed(2)} / ${perlGap.restraint.mean.toFixed(2)} / ${perlGap.utility.mean.toFixed(2)} · counselor ${counselorGap.accuracy.mean.toFixed(2)} / ${counselorGap.restraint.mean.toFixed(2)} / ${counselorGap.utility.mean.toFixed(2)}. Lower is closer.`
    : "No independently repeated ratings yet. Lower absolute rating differences indicate closer reviewer judgments.";

  const taxonomy = Object.entries(analysis.correctionTaxonomy);
  const maxCount = Math.max(1, ...taxonomy.map(([, count]) => count));
  $("#study-taxonomy").innerHTML = taxonomy.some(([, count]) => count)
    ? taxonomy.map(([label, count]) => `<div class="taxonomy-row"><span>${escapeHTML(label)}</span><div><i style="width:${(count / maxCount) * 100}%"></i></div><strong>${count}</strong></div>`).join("")
    : "<p>No structured corrections recorded.</p>";
  $("#study-limitations").innerHTML = analysis.limitations.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  const status = $("#study-status");
  status.classList.toggle("ready", analysis.inferenceReady);
  status.textContent = analysis.inferenceReady ? "Protocol threshold met · still synthetic" : "Exploratory · threshold not met";
}

function intakeStatusLabel(value) {
  return {
    "decision-required": "Decision required",
    "not-started": "Not started",
    "rfi-open": "RFI open",
    "rehearsal-only": "Rehearsal only"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderCalibrationIntake(intake = null) {
  state.calibrationIntake = intake;
  if (!intake) return;
  const source = intake.sourceReport || {};
  const sandbox = intake.currentSandbox || {};
  $("#intake-reported-count").textContent = `~${Number(source.reportedAssessmentCount || 0).toLocaleString()}`;
  $("#intake-received-count").textContent = String(Number(intake.recordsInspected || 0)).padStart(2, "0");
  $("#intake-sandbox-count").textContent = `${String(Number(sandbox.cases || 0)).padStart(2, "0")} cases`;
  $("#intake-strata-count").textContent = `${sandbox.presentStrata || 0} / ${sandbox.targetStrata || 0} strata present`;
  $("#intake-holdout-state").textContent = sandbox.holdoutValid ? "Accepted" : "Not valid";
  $("#intake-lanes").innerHTML = (intake.lanes || []).map(lane => `<article>
    <span>${escapeHTML(lane.index)}</span>
    <div><small>${escapeHTML(intakeStatusLabel(lane.status))}</small><h4>${escapeHTML(lane.title)}</h4><p>${escapeHTML(lane.purpose)}</p></div>
  </article>`).join("");
  $("#intake-returns").innerHTML = (intake.requiredReturns || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#intake-prohibited").innerHTML = (intake.prohibitedContent || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#intake-fingerprint").textContent = intake.packetFingerprint ? `INTAKE ${intake.packetFingerprint.slice(0, 16)}…` : "INTAKE —";
  $("#intake-boundary").textContent = intake.boundary;
}

function modelTrialStatusLabel(value) {
  return {
    "awaiting-candidate-metadata": "Awaiting candidate metadata",
    "candidate-metadata-incomplete": "Candidate metadata incomplete",
    "metadata-complete-external-review-required": "Metadata complete · review required"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderModelTrial(modelTrial = null) {
  state.modelTrial = modelTrial;
  if (!modelTrial) return;
  const counts = modelTrial.counts || {};
  const baseline = modelTrial.baseline || {};
  $("#model-trial-state").dataset.state = modelTrial.status;
  $("#model-trial-state").textContent = modelTrialStatusLabel(modelTrial.status);
  $("#model-trial-candidate-count").textContent = `${String(Number(counts.candidatesDeclared || 0)).padStart(2, "0")} / ${String(Number(counts.slotsRequired || 3)).padStart(2, "0")}`;
  $("#model-trial-evidence-count").textContent = `${String(Number(counts.domainEvidenceDeclared || 0)).padStart(2, "0")} / ${String(Number(counts.domainEvidenceRequired || 18)).padStart(2, "0")}`;
  $("#model-trial-baseline").textContent = baseline.mode === "rules" ? "Rules" : (baseline.mode || "Local");
  $("#model-trial-selection").textContent = modelTrial.engineSelected ? "Selected" : "Blocked";
  $("#model-trial-candidates").innerHTML = (modelTrial.candidates || []).map(candidate => {
    const declared = (candidate.domainEvidence || []).filter(item => item.status === "metadata-declared-unverified").length;
    const identity = candidate.providerId && candidate.modelVersion
      ? `${candidate.providerId} · ${candidate.modelVersion}`
      : "Identity not declared";
    const detail = candidate.providerId
      ? `${candidate.hostingPattern || "Deployment open"} · ${candidate.region || "Region open"}`
      : "Provider, model, deployment pattern, and region are still open.";
    return `<article class="model-trial-candidate" data-state="${escapeHTML(candidate.status)}">
      <div class="model-trial-candidate-top"><span>${escapeHTML(candidate.label)}</span><strong>${escapeHTML(candidate.index)}</strong></div>
      <h4>${escapeHTML(identity)}</h4>
      <p>${escapeHTML(detail)}</p>
      <div class="model-trial-candidate-meta"><span>${escapeHTML(modelTrialStatusLabel(candidate.status))}</span>${candidate.fingerprint ? `<span>REF ${escapeHTML(candidate.fingerprint.slice(0, 10))}…</span>` : ""}</div>
      <div class="model-trial-domain-dots" aria-label="${declared} of 6 evidence domains declared">${(candidate.domainEvidence || []).map(item => `<i class="${item.status === "metadata-declared-unverified" ? "declared" : ""}" aria-hidden="true"></i>`).join("")}</div>
      <small>${String(declared).padStart(2, "0")} / 06 references · unverified</small>
    </article>`;
  }).join("");
  $("#model-trial-domains").innerHTML = (modelTrial.domains || []).map(domain => `<li><span>${escapeHTML(domain.index)}</span><div><strong>${escapeHTML(domain.label)}</strong><p>${escapeHTML(domain.question)}</p></div></li>`).join("");
  $("#model-trial-fingerprint").textContent = modelTrial.benchFingerprint ? `TRIAL ${modelTrial.benchFingerprint.slice(0, 16)}… · CHAIN ${modelTrial.chain?.count || 0}` : "TRIAL —";
  $("#model-trial-boundary").textContent = modelTrial.boundary;
}

function candidateTrialStatusLabel(value) {
  return {
    "awaiting-candidate-metadata": "Awaiting candidate metadata",
    "pre-execution-authority-required": "Pre-execution authority required"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderCandidateTrial(candidateTrial = null) {
  state.candidateTrial = candidateTrial;
  if (!candidateTrial) return;
  const counts = candidateTrial.counts || {};
  $("#candidate-trial-state").dataset.state = candidateTrial.status;
  $("#candidate-trial-state").textContent = candidateTrialStatusLabel(candidateTrial.status);
  $("#candidate-trial-run-count").textContent = String(Number(counts.candidateRunsPlanned || 9)).padStart(2, "0");
  $("#candidate-trial-blind-count").textContent = String(Number(counts.blindCellsPlanned || 12)).padStart(2, "0");
  $("#candidate-trial-measure-count").textContent = String(Number(counts.measuresPredeclared || 6)).padStart(2, "0");
  $("#candidate-trial-authority").textContent = String(Number(counts.trialExecutionsAuthorized || 0)).padStart(2, "0");
  $("#candidate-trial-local-gates").textContent = `${String(Number(counts.gatesLocallySatisfied || 0)).padStart(2, "0")} / ${String(Number(counts.gatesRequired || 7)).padStart(2, "0")}`;

  const candidates = (candidateTrial.arms || []).filter(arm => arm.kind === "engine-candidate");
  $("#candidate-trial-runs").innerHTML = candidates.map(candidate => {
    const runs = (candidateTrial.runEnvelopes || []).filter(run => run.candidateSlot === candidate.id);
    return `<article><div><small>${escapeHTML(candidate.label)}</small><strong>${escapeHTML(candidate.index)}</strong></div>${runs.map(run => `<span data-state="held" title="${escapeHTML(run.status)}">${escapeHTML(run.runId.slice(-2))}</span>`).join("")}</article>`;
  }).join("");
  $("#candidate-trial-measures").innerHTML = (candidateTrial.measures || []).map(measure => `<li><span>${escapeHTML(measure.index)}</span><div><strong>${escapeHTML(measure.label)}</strong><p>${escapeHTML(measure.question)}</p></div></li>`).join("");
  $("#candidate-trial-sequence").innerHTML = (candidateTrial.sequence || []).map(step => `<article><span>${escapeHTML(step.index)}</span><small>${escapeHTML(step.label)}</small><p>${escapeHTML(step.detail)}</p></article>`).join("");
  $("#candidate-trial-gates").innerHTML = (candidateTrial.gates || []).map(gate => `<li data-state="${escapeHTML(gate.state)}" data-satisfied="${String(gate.satisfied)}" title="${escapeHTML(gate.detail)}"><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(gate.state.replaceAll("-", " "))}</small></div></li>`).join("");
  $("#candidate-trial-fingerprint").textContent = candidateTrial.protocolFingerprint ? `PROTOCOL ${candidateTrial.protocolFingerprint.slice(0, 16)}… · CHAIN ${candidateTrial.chain?.count || 0}` : "PROTOCOL —";
  $("#candidate-trial-boundary").textContent = candidateTrial.boundary;
  const latestSnapshot = candidateTrial.latestSnapshot;
  $("#candidate-trial-announcement").textContent = latestSnapshot
    ? `Planning snapshot ${String(latestSnapshot.sequence).padStart(2, "0")} recorded with ${latestSnapshot.counts.gatesLocallySatisfied} of 7 gates locally satisfied. All 9 candidate runs remain held and trial execution remains unauthorized.`
    : "No planning snapshot recorded. Candidate execution remains unauthorized.";
}

function candidateReturnStatusLabel(value) {
  return {
    "awaiting-candidate-metadata": "Awaiting candidate metadata",
    "ready-for-manual-synthetic-returns": "Ready for manual returns",
    "local-synthetic-return-set-complete": "Local return set complete"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderCandidateReturns(candidateReturns = null) {
  state.candidateReturns = candidateReturns;
  if (!candidateReturns) return;
  const counts = candidateReturns.counts || {};
  const status = candidateReturns.status || "awaiting-candidate-metadata";
  $("#candidate-return-state").dataset.state = status;
  $("#candidate-return-state").textContent = candidateReturnStatusLabel(status);
  $("#candidate-return-candidates").textContent = `${String(Number(counts.candidateMetadataComplete || 0)).padStart(2, "0")} / ${String(Number(counts.candidateSlots || 3)).padStart(2, "0")}`;
  $("#candidate-return-count").textContent = `${String(Number(counts.currentReturnsReceived || 0)).padStart(2, "0")} / ${String(Number(counts.runsPlanned || 9)).padStart(2, "0")}`;
  $("#candidate-return-gates").textContent = `${String(Number(counts.outputGatesRequired || 10)).padStart(2, "0")} / 10`;
  $("#candidate-return-calls").textContent = Number(counts.providerCallsPerformedByPerl || 0) === 0 ? "ZERO" : String(counts.providerCallsPerformedByPerl);

  const runs = candidateReturns.runs || [];
  $("#candidate-return-runs").innerHTML = ["candidate-01", "candidate-02", "candidate-03"].map((candidateSlot, candidateIndex) => {
    const laneRuns = runs.filter(run => run.candidateSlot === candidateSlot);
    const provider = laneRuns.find(run => run.providerId)?.providerId || `Candidate ${String(candidateIndex + 1).padStart(2, "0")}`;
    return `<article><div><small>${escapeHTML(provider)}</small><strong>${String(candidateIndex + 1).padStart(2, "0")}</strong></div>${laneRuns.map(run => {
      const receipt = run.currentReturn ? ` · receipt ${run.currentReturn.bundleHash.slice(0, 10)}…` : "";
      return `<span data-state="${escapeHTML(run.status)}" title="${escapeHTML(candidateReturnStatusLabel(run.status) + receipt)}" aria-label="${escapeHTML(`${run.runId}: ${candidateReturnStatusLabel(run.status)}${receipt}`)}">${escapeHTML(run.runId.slice(-2))}</span>`;
    }).join("")}</article>`;
  }).join("");

  const history = [...(candidateReturns.history || [])].reverse();
  $("#candidate-return-history").innerHTML = history.length ? history.map(event => `<li><span>${String(Number(event.sequence)).padStart(2, "0")}</span><div><strong>${escapeHTML(event.runId)} · ${escapeHTML(event.candidateSlot)}</strong><small>${escapeHTML(event.caseId)} · ${escapeHTML(event.bundleHash.slice(0, 12))}… · ${event.current ? "current sealed receipt" : "superseded receipt"}</small></div></li>`).join("") : `<li><span>—</span><div><strong>No returns sealed</strong><small>The chain begins only after a valid manual synthetic return.</small></div></li>`;
  const chainCount = Number(candidateReturns.chain?.count || 0);
  $("#candidate-return-fingerprint").textContent = candidateReturns.requestFingerprint ? `RETURN ${candidateReturns.requestFingerprint.slice(0, 16)}… · CHAIN ${chainCount}` : "RETURN DESK —";
  $("#candidate-return-boundary").textContent = candidateReturns.boundary;

  if (!state.candidateReturnManifest) {
    $("#candidate-return-announcement").textContent = status === "awaiting-candidate-metadata"
      ? "Candidate metadata must be complete before any return can be received."
      : status === "local-synthetic-return-set-complete"
        ? "All nine current envelopes have sealed structural receipts. Outputs remain hidden and blind review is not authorized."
        : `${counts.currentReturnsMissing || 9} current envelope${Number(counts.currentReturnsMissing || 9) === 1 ? "" : "s"} await a manual structured synthetic return.`;
  }
}

function candidateReviewStatusLabel(value) {
  return {
    "blocked-awaiting-governed-evidence": "Intake closed",
    "local-rehearsal-intake-ready": "Blind intake ready"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function candidateReviewChoiceLabel(value) {
  return {
    "factual-mismatch": "Factual mismatch",
    "unsupported-overreach": "Unsupported overreach",
    "material-omission": "Material omission",
    "tone-or-clarity": "Tone / clarity",
    "safety-routing": "Safety routing",
    "workflow-usefulness": "Workflow usefulness",
    "rubric-interpretation": "Rubric interpretation",
    "source-evidence": "Source evidence",
    "safety-judgment": "Safety judgment",
    "clinical-utility": "Clinical utility",
    "usable-as-is": "Usable as is",
    "usable-after-revision": "Usable after revision",
    "not-usable": "Not usable",
    "uncertain": "Uncertain"
  }[value] || String(value || "").replaceAll("-", " ");
}

function resetCandidateReviewSurface() {
  state.candidateReviewAssignment = null;
  $("#candidate-review-form").hidden = true;
  $("#candidate-review-receipt").hidden = true;
  $("#candidate-review-lobby").hidden = false;
  $("#candidate-review-cells").innerHTML = "";
}

function renderCandidateReview(candidateReview = null) {
  state.candidateReview = candidateReview;
  if (!candidateReview) return;
  const counts = candidateReview.counts || {};
  const progress = candidateReview.reviewerProgress || {};
  const ready = candidateReview.locallyReady === true;
  const reviewerComplete = Number(progress.available || 0) > 0 && Number(progress.completed || 0) >= Number(progress.available || 0);
  $("#candidate-review-state").dataset.state = candidateReview.status;
  $("#candidate-review-state").textContent = candidateReviewStatusLabel(candidateReview.status);
  $("#candidate-review-readiness").textContent = `${String(Number(counts.readinessGatesSatisfied || 0)).padStart(2, "0")} / ${String(Number(counts.readinessGatesRequired || 6)).padStart(2, "0")}`;
  $("#candidate-review-cell-count").textContent = `${String(Number(counts.blindCellsCompleted || 0)).padStart(2, "0")} / ${String(Number(counts.blindCellsPlanned || 12)).padStart(2, "0")}`;
  $("#candidate-review-overlap").textContent = `${String(Number(counts.casesWithIndependentOverlap || 0)).padStart(2, "0")} / ${String(Number(counts.casesPlanned || 3)).padStart(2, "0")}`;
  $("#candidate-review-corrections").textContent = String(Number(counts.correctionsObserved || 0)).padStart(2, "0");
  $("#candidate-review-rankings").textContent = Number(counts.engineRankingsPublished || 0) === 0 ? "ZERO" : String(counts.engineRankingsPublished);

  $("#candidate-review-gates").innerHTML = (candidateReview.gates || []).map(gate => `<li data-ready="${gate.satisfied ? "true" : "false"}"><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(gate.detail)}</small></div></li>`).join("");
  const blocked = $("#candidate-review-blocked");
  blocked.dataset.ready = String(ready);
  blocked.innerHTML = ready
    ? `<strong>${reviewerComplete ? "This reviewer’s case set is complete" : "The gallery can admit a reviewer"}</strong><small>${reviewerComplete ? "Switch to a distinct reviewer code for independent overlap." : `${Number(progress.completed || 0)} of ${Number(progress.available || 3)} cases completed for this local reviewer code. Authorship remains closed.`}</small>`
    : `<strong>Gallery held in darkness</strong><small>${Number(counts.readinessGatesSatisfied || 0)} of ${Number(counts.readinessGatesRequired || 6)} current gates are satisfied. Missing evidence stays outside the room.</small>`;
  const openButton = $("#open-candidate-review");
  openButton.disabled = !state.connected || !candidateReview.packetIssuanceEnabled || reviewerComplete;
  openButton.textContent = candidateReview.currentAssignment ? "Resume sealed blind case" : reviewerComplete ? "Reviewer case set complete" : "Open next blind case";

  const history = candidateReview.history || [];
  $("#candidate-review-history").innerHTML = history.length
    ? history.map(item => `<li><span>${String(Number(item.sequence)).padStart(2, "0")}</span><div><strong>${escapeHTML(item.caseId)} · four blind cells sealed</strong><small>${Number(item.correctionCells || 0)} correction cell${Number(item.correctionCells || 0) === 1 ? "" : "s"} · ${Number(item.dissentFlags || 0)} dissent flag${Number(item.dissentFlags || 0) === 1 ? "" : "s"} · ${escapeHTML(new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</small></div></li>`).join("")
    : `<li><span>—</span><div><strong>No candidate reviews recorded</strong><small>The forty-second chain begins only after a complete anonymous packet.</small></div></li>`;
  const chainCount = Number(candidateReview.chain?.count || 0);
  $("#candidate-review-fingerprint").textContent = candidateReview.deskFingerprint ? `GALLERY ${candidateReview.deskFingerprint.slice(0, 14)}… · CHAIN ${chainCount}` : "REVIEW GALLERY —";
  $("#candidate-review-boundary").textContent = candidateReview.boundary;
  if (!state.candidateReviewAssignment && $("#candidate-review-receipt").hidden) {
    $("#candidate-review-announcement").textContent = ready
      ? reviewerComplete
        ? "This reviewer code completed all available cases. Use a distinct reviewer code to create independent overlap."
        : "All six readiness gates are current. Opening a packet reveals A–D summary content, never authorship."
      : "Candidate review remains closed. No authorship or summary content is visible.";
  }
}

function candidateReviewRatingOptions() {
  return `<option value="">Choose 1–5</option>${[1, 2, 3, 4, 5].map(value => `<option value="${value}">${value}</option>`).join("")}`;
}

function renderCandidateReviewAssignment(assignment) {
  state.candidateReviewAssignment = assignment;
  $("#candidate-review-lobby").hidden = true;
  $("#candidate-review-receipt").hidden = true;
  $("#candidate-review-form").hidden = false;
  $("#candidate-review-packet-title").textContent = `${assignment.caseId} · anonymous A—D`;
  $("#candidate-review-packet-meta").textContent = `${assignment.packetFingerprint.slice(0, 18)}… · expires ${new Date(assignment.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  const source = assignment.sourceProfile || {};
  $("#candidate-review-source-grid").innerHTML = (source.scales || []).map(scale => `<article><span>${escapeHTML(scale.label)}</span><strong>${escapeHTML(scale.score)}</strong><small>${escapeHTML(scale.level || "scored")}</small></article>`).join("");
  $("#candidate-review-safety").dataset.required = String(source.safety?.directReviewRequired === true);
  $("#candidate-review-safety").textContent = source.safety?.instruction || "Direct clinical verification remains required.";
  const measures = new Map((state.candidateReview?.measures || []).map(item => [item.key, item]));
  const ratingFields = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
  const corrections = state.candidateReview?.correctionTaxonomy || [];
  const dissent = state.candidateReview?.dissentTaxonomy || [];
  $("#candidate-review-cells").innerHTML = (assignment.cells || []).map(cell => `<article class="candidate-review-cell" data-position="${escapeHTML(cell.blindPosition)}">
    <header class="candidate-review-cell-head"><span>Blind reading ${escapeHTML(cell.blindPosition)}</span><strong>Anonymous summary</strong><small>${Number(cell.wordCount || 0)} words · ${escapeHTML(cell.artifactHash.slice(0, 12))}…</small></header>
    <p class="candidate-review-summary">${escapeHTML(cell.summary)}</p>
    <div class="candidate-review-rating-grid">${ratingFields.map(key => {
      const measure = measures.get(key) || { label: key, description: "Record one bounded rating." };
      return `<label><span>${escapeHTML(measure.label)}<small>${escapeHTML(measure.description)}</small></span><select name="${escapeHTML(cell.blindPosition)}-${escapeHTML(key)}" required aria-label="${escapeHTML(`${cell.blindPosition} ${measure.label}`)}">${candidateReviewRatingOptions()}</select></label>`;
    }).join("")}</div>
    <div class="candidate-review-decision">
      <label><span>Correction burden</span><select name="${escapeHTML(cell.blindPosition)}-correctionBurden" required><option value="">Choose burden</option><option value="none">None</option><option value="minor">Minor</option><option value="material">Material</option><option value="unsafe">Unsafe · stop use</option></select></label>
      <label><span>Use disposition</span><select name="${escapeHTML(cell.blindPosition)}-useDisposition" required><option value="">Choose disposition</option>${["usable-as-is", "usable-after-revision", "not-usable", "uncertain"].map(value => `<option value="${value}">${escapeHTML(candidateReviewChoiceLabel(value))}</option>`).join("")}</select></label>
    </div>
    <div class="candidate-review-flags">
      <fieldset><legend>Correction flags</legend>${corrections.map(value => `<label><input type="checkbox" name="${escapeHTML(cell.blindPosition)}-correctionFlags" value="${escapeHTML(value)}"><span>${escapeHTML(candidateReviewChoiceLabel(value))}</span></label>`).join("")}</fieldset>
      <fieldset><legend>Dissent flags</legend>${dissent.map(value => `<label><input type="checkbox" name="${escapeHTML(cell.blindPosition)}-dissentFlags" value="${escapeHTML(value)}"><span>${escapeHTML(candidateReviewChoiceLabel(value))}</span></label>`).join("")}</fieldset>
    </div>
  </article>`).join("");
  $("#submit-candidate-review").disabled = !state.connected;
  $("#candidate-review-announcement").textContent = `Anonymous packet opened for ${state.reviewerCode}. Authorship remains concealed before and after submission.`;
}

function candidateReviewPayload(formElement) {
  const form = new FormData(formElement);
  const assignment = state.candidateReviewAssignment;
  return {
    assignmentId: assignment.assignmentId,
    packetFingerprint: assignment.packetFingerprint,
    cells: ["A", "B", "C", "D"].map(blindPosition => ({
      blindPosition,
      ratings: {
        evidenceFidelity: Number(form.get(`${blindPosition}-evidenceFidelity`)),
        criticalSafetyHandling: Number(form.get(`${blindPosition}-criticalSafetyHandling`)),
        clinicalRestraint: Number(form.get(`${blindPosition}-clinicalRestraint`)),
        conversationUsefulness: Number(form.get(`${blindPosition}-conversationUsefulness`))
      },
      correctionBurden: form.get(`${blindPosition}-correctionBurden`),
      correctionFlags: form.getAll(`${blindPosition}-correctionFlags`),
      dissentFlags: form.getAll(`${blindPosition}-dissentFlags`),
      useDisposition: form.get(`${blindPosition}-useDisposition`)
    }))
  };
}

async function openCandidateReviewAssignment() {
  if (!state.connected || !state.candidateReview?.packetIssuanceEnabled) return showToast("All six governed evidence gates must be current before a blind packet can open.");
  const button = $("#open-candidate-review");
  const nextButton = $("#next-candidate-review");
  button.disabled = true;
  nextButton.disabled = true;
  button.textContent = "Opening sealed packet…";
  nextButton.textContent = "Opening sealed packet…";
  try {
    const result = await state.api.nextCandidateReview();
    renderCandidateReview(result.candidateReview);
    renderCandidateReviewAssignment(result.assignment);
    $("#candidate-review-form").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(result.resumed ? "Sealed packet resumed. Candidate authorship is still hidden." : "Anonymous case opened. Review A through D against the scored source.");
  } catch (error) {
    $("#candidate-review-announcement").textContent = error.message;
    showToast(error.message);
  } finally {
    button.textContent = state.candidateReview?.currentAssignment ? "Resume sealed blind case" : "Open next blind case";
    button.disabled = !state.connected || !state.candidateReview?.packetIssuanceEnabled;
    nextButton.textContent = "Open another case";
    nextButton.disabled = !state.connected;
  }
}

function candidateRefinementStatusLabel(value) {
  return {
    "blocked-awaiting-independent-overlap": "Evidence gathering",
    "evidence-ready-no-repeated-pattern": "No repeated signal",
    "refinement-scope-ready": "Cycle desk ready",
    "retest-kits-issued-awaiting-manual-return": "Retest kit issued"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function candidateRefinementSignalForSelection() {
  const lane = state.candidateRefinement?.lanes?.find(item => item.id === $("#candidate-refinement-lane").value);
  return lane?.signals?.find(item => item.id === $("#candidate-refinement-signal").value) || null;
}

function renderCandidateRefinementSelection() {
  const signal = candidateRefinementSignalForSelection();
  $("#candidate-refinement-intervention").textContent = signal ? candidateReviewChoiceLabel(signal.interventionType) : "—";
  $("#candidate-refinement-target").textContent = signal ? candidateReviewChoiceLabel(signal.targetMeasure) : "—";
  $("#candidate-refinement-goal").textContent = signal ? candidateReviewChoiceLabel(signal.iterationGoal) : "—";
  $("#candidate-refinement-create").disabled = !state.connected || !state.candidateRefinement?.cycleIssuanceEnabled || !signal;
}

function syncCandidateRefinementSignals(preferredSignalId = null) {
  const lane = state.candidateRefinement?.lanes?.find(item => item.id === $("#candidate-refinement-lane").value);
  const signals = (lane?.signals || []).filter(item => item.eligible);
  $("#candidate-refinement-signal").innerHTML = signals.map(signal => `<option value="${escapeHTML(signal.id)}">${escapeHTML(signal.label)} · ${Number(signal.caseCount || 0)} cases / ${Number(signal.reviewerCount || 0)} readers</option>`).join("");
  if (preferredSignalId && signals.some(signal => signal.id === preferredSignalId)) $("#candidate-refinement-signal").value = preferredSignalId;
  renderCandidateRefinementSelection();
}

function renderCandidateRefinement(candidateRefinement = null) {
  state.candidateRefinement = candidateRefinement;
  if (!candidateRefinement) return;
  const counts = candidateRefinement.counts || {};
  const openLanes = new Set((candidateRefinement.cycles || []).map(cycle => cycle.laneId));
  $("#candidate-refinement-state").dataset.state = candidateRefinement.status;
  $("#candidate-refinement-state").textContent = candidateRefinementStatusLabel(candidateRefinement.status);
  $("#candidate-refinement-readiness").textContent = `${String(Number(counts.readinessGatesSatisfied || 0)).padStart(2, "0")} / ${String(Number(counts.readinessGatesRequired || 6)).padStart(2, "0")}`;
  $("#candidate-refinement-packets").textContent = `${String(Number(counts.currentReviewPackets || 0)).padStart(2, "0")} / 06`;
  $("#candidate-refinement-signals").textContent = String(Number(counts.eligibleSignals || 0)).padStart(2, "0");
  $("#candidate-refinement-cycle-count").textContent = String(Number(counts.cyclesIssued || 0)).padStart(2, "0");
  $("#candidate-refinement-gates").innerHTML = (candidateRefinement.gates || []).map(gate => `<li data-ready="${gate.satisfied ? "true" : "false"}"><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(gate.detail)}</small></div></li>`).join("");

  $("#candidate-refinement-lanes").innerHTML = (candidateRefinement.lanes || []).map(lane => {
    const eligible = (lane.signals || []).filter(signal => signal.eligible);
    const open = openLanes.has(lane.id);
    const stateName = open ? "open" : lane.unsafeCorrectionObserved ? "held" : eligible.length ? "eligible" : "waiting";
    const primary = eligible[0];
    const heading = open ? "Retest kit issued" : lane.unsafeCorrectionObserved ? "Held for safety triage" : primary ? primary.label : "No repeated pattern yet";
    const detail = open
      ? "This lane has one open bounded cycle awaiting manual execution and return."
      : lane.unsafeCorrectionObserved
        ? "An unsafe correction removes this lane from optimization until independent triage."
        : primary
          ? `${primary.caseCount} cases and ${primary.reviewerCount} reviewer codes support one bounded intervention.`
          : `${Number(lane.correctionObservations || 0)} correction observations; recurrence across all three cases and two reviewer codes is required.`;
    return `<article data-state="${stateName}"><span>${escapeHTML(lane.index)}</span><div><small>${escapeHTML(lane.label)} · anonymous</small><h4>${escapeHTML(heading)}</h4><p>${escapeHTML(detail)}</p><footer><span>${Number(lane.caseCoverage || 0)} / 3 cases</span><span>${Number(lane.reviewerCoverage || 0)} readers</span><span>${Number(lane.eligibleSignalCount || 0)} eligible</span></footer></div></article>`;
  }).join("");

  const blocked = $("#candidate-refinement-blocked");
  blocked.dataset.ready = String(candidateRefinement.locallyReady === true);
  blocked.innerHTML = candidateRefinement.locallyReady
    ? candidateRefinement.cycleIssuanceEnabled
      ? `<strong>The smallest useful change can be declared</strong><small>${Number(counts.eligibleSignals || 0)} repeated signal${Number(counts.eligibleSignals || 0) === 1 ? " clears" : "s clear"} the evidence threshold.</small>`
      : `<strong>Evidence is current; no new lane can open</strong><small>${Number(counts.cyclesIssued || 0)} cycle${Number(counts.cyclesIssued || 0) === 1 ? " is" : "s are"} already open or no correction signal recurs across the full cohort.</small>`
    : `<strong>Cycle desk remains closed</strong><small>${Number(counts.readinessGatesSatisfied || 0)} of ${Number(counts.readinessGatesRequired || 6)} gates are current. Independent overlap cannot be inferred.</small>`;

  const laneOptions = (candidateRefinement.lanes || []).filter(lane => lane.eligibleSignalCount > 0 && !openLanes.has(lane.id));
  const previousLane = $("#candidate-refinement-lane").value;
  $("#candidate-refinement-form").hidden = !candidateRefinement.cycleIssuanceEnabled;
  $("#candidate-refinement-lane").innerHTML = laneOptions.map(lane => `<option value="${escapeHTML(lane.id)}">${escapeHTML(lane.label)} · anonymous</option>`).join("");
  if (laneOptions.some(lane => lane.id === previousLane)) $("#candidate-refinement-lane").value = previousLane;
  syncCandidateRefinementSignals();

  const cycles = candidateRefinement.cycles || [];
  $("#candidate-refinement-cycles").innerHTML = cycles.length
    ? cycles.map(cycle => `<li><span>${String(Number(cycle.sequence || 0)).padStart(2, "0")}</span><div><strong>${escapeHTML(cycle.laneLabel)} · ${escapeHTML(cycle.signalLabel)}</strong><small>${escapeHTML(candidateReviewChoiceLabel(cycle.interventionType))} · ${Number(cycle.retestEnvelopesIssued || 0)} same-case envelopes · ${escapeHTML(new Date(cycle.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</small></div><a href="/api/calibration/candidate-refinement/cycles/${encodeURIComponent(cycle.cycleId)}/retest-kit.json" download="perl-${escapeHTML(cycle.cycleId.toLowerCase())}-retest-kit.json">Retest kit</a></li>`).join("")
    : `<li><span>—</span><div><strong>No retest kits issued</strong><small>The forty-third chain begins only after a repeated correction clears every gate.</small></div></li>`;
  $("#candidate-refinement-fingerprint").textContent = candidateRefinement.deskFingerprint ? `REFINEMENT ${candidateRefinement.deskFingerprint.slice(0, 14)}… · CHAIN ${Number(candidateRefinement.chain?.count || 0)}` : "REFINEMENT DESK —";
  $("#candidate-refinement-boundary").textContent = candidateRefinement.boundary;
  $("#candidate-refinement-announcement").textContent = candidateRefinement.cycleIssuanceEnabled
    ? "A repeated anonymous correction signal can scope one content-free same-case retest kit."
    : candidateRefinement.status === "retest-kits-issued-awaiting-manual-return"
      ? "A retest kit is open. Manual execution and a separately governed return remain outside this desk."
      : "No refinement cycle can be issued from the current evidence.";
}

function candidateRefinementPayload() {
  const signal = candidateRefinementSignalForSelection();
  if (!signal) return null;
  return {
    laneId: $("#candidate-refinement-lane").value,
    signalId: signal.id,
    interventionType: signal.interventionType,
    targetMeasure: signal.targetMeasure,
    iterationGoal: signal.iterationGoal
  };
}

function candidateRetestStatusLabel(value) {
  return {
    "blocked-awaiting-scoped-cycle": "Cycle required",
    "accepting-manual-retest-returns": "Return intake open",
    "blind-rereview-intake-ready": "Fresh reading ready",
    "local-paired-evidence-complete-awaiting-independent-disposition": "External disposition required"
  }[value] || String(value || "Evidence pending").replaceAll("-", " ");
}

function resetCandidateRetestSurface() {
  state.candidateRetestAssignment = null;
  $("#candidate-retest-review-form").reset();
  $("#candidate-retest-review-form").hidden = true;
  $("#candidate-retest-receipt").hidden = true;
  $("#candidate-retest-lobby").hidden = false;
}

function renderCandidateRetest(candidateRetest = null) {
  state.candidateRetest = candidateRetest;
  if (!candidateRetest) return;
  const counts = candidateRetest.counts || {};
  const cycles = candidateRetest.cycles || [];
  const selectedCycle = cycles.find(cycle => cycle.cycleId === candidateRetest.selectedCycleId) || cycles[0] || null;
  $("#candidate-retest-state").dataset.state = candidateRetest.status;
  $("#candidate-retest-state").textContent = candidateRetestStatusLabel(candidateRetest.status);
  $("#candidate-retest-returns").textContent = `${String(Number(counts.selectedReturnsReceived || 0)).padStart(2, "0")} / 03`;
  $("#candidate-retest-reviews").textContent = `${String(Number(counts.selectedReviewPackets || 0)).padStart(2, "0")} / 06`;
  $("#candidate-retest-overlap").textContent = `${String(Number(counts.selectedCasesWithIndependentOverlap || 0)).padStart(2, "0")} / 03`;
  $("#candidate-retest-reader-progress").textContent = `${String(Number(candidateRetest.reviewerProgress?.completed || 0)).padStart(2, "0")} / ${String(Number(candidateRetest.reviewerProgress?.available || 3)).padStart(2, "0")}`;
  $("#candidate-retest-gates").innerHTML = (candidateRetest.gates || []).map(gate => `<li data-ready="${gate.satisfied ? "true" : "false"}"><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(gate.detail)}</small></div></li>`).join("");

  const cycleSelect = $("#candidate-retest-cycle");
  const previousCycleId = cycleSelect.value;
  cycleSelect.innerHTML = cycles.length
    ? cycles.map(cycle => `<option value="${escapeHTML(cycle.cycleId)}">Cycle ${String(Number(cycle.cycleNumber || 0)).padStart(2, "0")} · ${escapeHTML(cycle.laneLabel)} · ${escapeHTML(candidateReviewChoiceLabel(cycle.status))}</option>`).join("")
    : `<option value="">No cycle available</option>`;
  const preferredCycleId = cycles.some(cycle => cycle.cycleId === previousCycleId) ? previousCycleId : candidateRetest.selectedCycleId;
  if (preferredCycleId && cycles.some(cycle => cycle.cycleId === preferredCycleId)) cycleSelect.value = preferredCycleId;
  cycleSelect.disabled = !state.connected || cycles.length < 2;
  $("#candidate-retest-cycle-note").textContent = selectedCycle
    ? `${selectedCycle.laneLabel} · ${candidateReviewChoiceLabel(selectedCycle.interventionType)} · ${selectedCycle.returnsReceived} of 3 exact returns received.`
    : "A recurrence-gated cycle must exist before a return kit can be prepared.";
  const kit = $("#download-candidate-retest-kit");
  if (selectedCycle) {
    kit.hidden = false;
    kit.href = `/api/calibration/candidate-retest/cycles/${encodeURIComponent(selectedCycle.cycleId)}/return-kit.json`;
    kit.download = `perl-${selectedCycle.cycleId.toLowerCase()}-return-kit.json`;
    $("#candidate-retest-kit-state").textContent = selectedCycle.returnsReceived === 3 ? "All exact returns sealed" : `${3 - selectedCycle.returnsReceived} return${3 - selectedCycle.returnsReceived === 1 ? "" : "s"} still expected`;
  } else {
    kit.hidden = true;
    kit.removeAttribute("href");
    $("#candidate-retest-kit-state").textContent = "Return kit unavailable";
  }
  $("#candidate-retest-file").disabled = !state.connected || !candidateRetest.returnIntakeEnabled;
  $("#record-candidate-retest-returns").disabled = !state.connected || !candidateRetest.returnIntakeEnabled || !state.candidateRetestManifest;

  $("#candidate-retest-cycle-list").innerHTML = cycles.length
    ? cycles.map(cycle => `<li><span>${String(Number(cycle.cycleNumber || 0)).padStart(2, "0")}</span><div><strong>${escapeHTML(cycle.laneLabel)} · ${escapeHTML(cycle.signalLabel)}</strong><small>${Number(cycle.returnsReceived || 0)} / 3 returns · ${Number(cycle.reviewPacketsRecorded || 0)} / 6 readings · ${Number(cycle.casesWithIndependentOverlap || 0)} / 3 overlap · ${escapeHTML(candidateReviewChoiceLabel(cycle.status))}</small></div><a href="/api/calibration/candidate-retest/cycles/${encodeURIComponent(cycle.cycleId)}/return-kit.json" download="perl-${escapeHTML(cycle.cycleId.toLowerCase())}-return-kit.json">Return kit</a></li>`).join("")
    : `<li><span>—</span><div><strong>No scoped cycles available</strong><small>The register begins after one recurring correction creates a bounded same-case cycle.</small></div></li>`;

  const readerComplete = Number(candidateRetest.reviewerProgress?.completed || 0) >= Number(candidateRetest.reviewerProgress?.available || 3);
  $("#candidate-retest-review-state").textContent = candidateRetest.localPairedEvidenceComplete
    ? "Local paired evidence complete"
    : candidateRetest.packetIssuanceEnabled
      ? candidateRetest.currentAssignment ? "Paired packet waiting" : "Fresh packet available"
      : readerComplete ? "Current reader complete" : "Paired room held";
  $("#candidate-retest-review-detail").textContent = candidateRetest.localPairedEvidenceComplete
    ? "Two distinct reviewer codes cover every case. Separately signed independent accuracy and reliability disposition remains external."
    : candidateRetest.packetIssuanceEnabled
      ? candidateRetest.currentAssignment
        ? `Resume ${candidateRetest.currentAssignment.caseId}; X/Y mapping remains sealed.`
        : "Three exact returns are current. The next case opens against the same scored source."
      : readerComplete
        ? "Use a distinct reviewer code to create independent overlap on the same three cases."
        : "Three current returns and intact evidence ledgers are required before a fresh packet can open.";
  $("#open-candidate-retest-review").disabled = !state.connected || !candidateRetest.packetIssuanceEnabled;
  $("#open-candidate-retest-review").textContent = candidateRetest.currentAssignment ? "Resume X / Y case" : "Open next X / Y case";
  $("#next-candidate-retest-review").disabled = !state.connected || !candidateRetest.packetIssuanceEnabled;

  const history = candidateRetest.history || [];
  $("#candidate-retest-history").innerHTML = history.length
    ? history.map(item => `<li><span>${String(Number(item.sequence || 0)).padStart(2, "0")}</span><div><strong>${escapeHTML(item.caseId)} · anonymous paired receipt</strong><small>${Number(item.correctionCells || 0)} correction cell${Number(item.correctionCells || 0) === 1 ? "" : "s"} · ${Number(item.dissentFlags || 0)} dissent flag${Number(item.dissentFlags || 0) === 1 ? "" : "s"} · mapping withheld</small></div><time datetime="${escapeHTML(item.createdAt)}">${escapeHTML(new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</time><code>${escapeHTML(item.hash.slice(0, 11))}…</code></li>`).join("")
    : `<li><span>—</span><div><strong>No paired readings recorded</strong><small>The forty-fifth chain begins only after a complete X/Y packet.</small></div></li>`;
  $("#candidate-retest-fingerprint").textContent = candidateRetest.studioFingerprint ? `RETEST ${candidateRetest.studioFingerprint.slice(0, 14)}…` : "RETEST STUDIO —";
  $("#candidate-retest-chain").textContent = `RETURN ${String(Number(candidateRetest.chains?.retestReturns?.count || 0)).padStart(2, "0")} · REVIEW ${String(Number(candidateRetest.chains?.pairedReviews?.count || 0)).padStart(2, "0")}`;
  $("#candidate-retest-boundary").textContent = candidateRetest.boundary;
  if (!state.candidateRetestAssignment) {
    $("#candidate-retest-review-form").hidden = true;
    $("#candidate-retest-lobby").hidden = false;
  }
}

function candidateRetestRatingOptions() {
  return `<option value="">Choose 1–5</option>${[1, 2, 3, 4, 5].map(value => `<option value="${value}">${value}</option>`).join("")}`;
}

function renderCandidateRetestAssignment(assignment) {
  state.candidateRetestAssignment = assignment;
  $("#candidate-retest-lobby").hidden = true;
  $("#candidate-retest-receipt").hidden = true;
  $("#candidate-retest-review-form").hidden = false;
  $("#candidate-retest-packet-title").textContent = `${assignment.caseId} · anonymous X / Y`;
  $("#candidate-retest-packet-meta").textContent = `${assignment.packetFingerprint.slice(0, 18)}… · expires ${new Date(assignment.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  const source = assignment.sourceProfile || {};
  $("#candidate-retest-source-grid").innerHTML = (source.scales || []).map(scale => `<article><span>${escapeHTML(scale.label)}</span><strong>${escapeHTML(scale.score)}</strong><small>${escapeHTML(scale.level || "scored")}</small></article>`).join("");
  $("#candidate-retest-safety").dataset.required = String(source.safety?.directReviewRequired === true);
  $("#candidate-retest-safety").textContent = source.safety?.instruction || "Direct clinical verification remains required.";
  const measures = new Map((state.candidateRetest?.measures || []).map(item => [item.key, item]));
  const ratingFields = ["evidenceFidelity", "criticalSafetyHandling", "clinicalRestraint", "conversationUsefulness"];
  const corrections = state.candidateRetest?.correctionTaxonomy || [];
  const dissent = state.candidateRetest?.dissentTaxonomy || [];
  $("#candidate-retest-cells").innerHTML = (assignment.cells || []).map(cell => `<article class="candidate-retest-cell" data-position="${escapeHTML(cell.blindPosition)}">
    <header class="candidate-retest-cell-head"><span>${escapeHTML(cell.blindPosition)}</span><strong>Anonymous summary</strong><small>${Number(cell.wordCount || 0)} words · ${escapeHTML(cell.artifactHash.slice(0, 12))}…</small></header>
    <p class="candidate-retest-summary">${escapeHTML(cell.summary)}</p>
    <div class="candidate-retest-rating-grid">${ratingFields.map(key => {
      const measure = measures.get(key) || { label: key, description: "Record one bounded rating." };
      return `<label><span>${escapeHTML(measure.label)}<small>${escapeHTML(measure.description)}</small></span><select name="${escapeHTML(cell.blindPosition)}-${escapeHTML(key)}" required aria-label="${escapeHTML(`${cell.blindPosition} ${measure.label}`)}">${candidateRetestRatingOptions()}</select></label>`;
    }).join("")}</div>
    <div class="candidate-retest-decision">
      <label><span>Correction burden</span><select name="${escapeHTML(cell.blindPosition)}-correctionBurden" required><option value="">Choose burden</option><option value="none">None</option><option value="minor">Minor</option><option value="material">Material</option><option value="unsafe">Unsafe · stop use</option></select></label>
      <label><span>Use disposition</span><select name="${escapeHTML(cell.blindPosition)}-useDisposition" required><option value="">Choose disposition</option>${["usable-as-is", "usable-after-revision", "not-usable", "uncertain"].map(value => `<option value="${value}">${escapeHTML(candidateReviewChoiceLabel(value))}</option>`).join("")}</select></label>
    </div>
    <div class="candidate-retest-flags">
      <fieldset><legend>Correction flags</legend>${corrections.map(value => `<label><input type="checkbox" name="${escapeHTML(cell.blindPosition)}-correctionFlags" value="${escapeHTML(value)}"><span>${escapeHTML(candidateReviewChoiceLabel(value))}</span></label>`).join("")}</fieldset>
      <fieldset><legend>Dissent flags</legend>${dissent.map(value => `<label><input type="checkbox" name="${escapeHTML(cell.blindPosition)}-dissentFlags" value="${escapeHTML(value)}"><span>${escapeHTML(candidateReviewChoiceLabel(value))}</span></label>`).join("")}</fieldset>
    </div>
  </article>`).join("");
  $("#candidate-retest-difference").innerHTML = `<option value="">Choose a paired disposition</option>${(state.candidateRetest?.differenceTaxonomy || []).map(value => `<option value="${escapeHTML(value)}">${escapeHTML(candidateReviewChoiceLabel(value))}</option>`).join("")}`;
  $("#submit-candidate-retest-review").disabled = !state.connected;
  $("#candidate-retest-return-announcement").textContent = `Fresh X/Y packet opened for ${state.reviewerCode}. Baseline and retest mapping remains concealed before and after submission.`;
}

function candidateRetestReviewPayload(formElement) {
  const form = new FormData(formElement);
  const assignment = state.candidateRetestAssignment;
  return {
    assignmentId: assignment.assignmentId,
    packetFingerprint: assignment.packetFingerprint,
    cells: ["X", "Y"].map(blindPosition => ({
      blindPosition,
      ratings: {
        evidenceFidelity: Number(form.get(`${blindPosition}-evidenceFidelity`)),
        criticalSafetyHandling: Number(form.get(`${blindPosition}-criticalSafetyHandling`)),
        clinicalRestraint: Number(form.get(`${blindPosition}-clinicalRestraint`)),
        conversationUsefulness: Number(form.get(`${blindPosition}-conversationUsefulness`))
      },
      correctionBurden: form.get(`${blindPosition}-correctionBurden`),
      correctionFlags: form.getAll(`${blindPosition}-correctionFlags`),
      dissentFlags: form.getAll(`${blindPosition}-dissentFlags`),
      useDisposition: form.get(`${blindPosition}-useDisposition`)
    })),
    differenceDisposition: form.get("differenceDisposition")
  };
}

async function openCandidateRetestReviewAssignment() {
  if (!state.connected || !state.candidateRetest?.packetIssuanceEnabled || !state.candidateRetest?.selectedCycleId) return showToast("Three current exact returns and intact evidence are required before opening a paired packet.");
  const button = $("#open-candidate-retest-review");
  button.disabled = true;
  button.textContent = "Opening sealed pair…";
  try {
    const result = await state.api.nextCandidateRetestReview(state.candidateRetest.selectedCycleId);
    renderCandidateRetest(result.candidateRetest);
    renderCandidateRetestAssignment(result.assignment);
    $("#candidate-retest-review-form").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    $("#candidate-retest-return-announcement").textContent = error.message;
    showToast(error.message);
  } finally {
    button.textContent = "Open next X / Y case";
    button.disabled = !state.connected || !state.candidateRetest?.packetIssuanceEnabled;
  }
}

function candidateDispositionStatusLabel(value) {
  return {
    "local-paired-evidence-required": "Same-case evidence required",
    "independent-review-protocol-admission-required": "Protocol admission required",
    "disposition-registry-required": "Four external keys required",
    "disposition-challenge-required": "Ready for outside challenge",
    "independent-disposition-in-progress": "Signed duties in progress",
    "independent-disposition-frozen": "Exact-cycle result frozen",
    "verified-external-duty": "Verified external duty",
    "external-signature-required": "External signature required"
  }[value] || String(value || "Evidence required").replaceAll("-", " ");
}

function candidateDispositionValue(value, fallback = "No disposition") {
  return value ? String(value).replaceAll("-", " ") : fallback;
}

function renderCandidateRetestDisposition(disposition = null) {
  state.candidateRetestDisposition = disposition;
  if (!disposition) return;
  const counts = disposition.counts || {};
  const registry = disposition.registry || {};
  const cycles = state.candidateRetest?.cycles || [];
  const cycleSelect = $("#candidate-disposition-cycle");
  const priorCycleId = cycleSelect.value;
  cycleSelect.innerHTML = cycles.length
    ? cycles.map(cycle => `<option value="${escapeHTML(cycle.cycleId)}">Cycle ${String(Number(cycle.cycleNumber || 0)).padStart(2, "0")} · ${escapeHTML(cycle.laneLabel)} · ${escapeHTML(candidateReviewChoiceLabel(cycle.status))}</option>`).join("")
    : `<option value="">No cycle available</option>`;
  const preferredCycleId = cycles.some(cycle => cycle.cycleId === priorCycleId) ? priorCycleId : disposition.cycleId;
  if (preferredCycleId && cycles.some(cycle => cycle.cycleId === preferredCycleId)) cycleSelect.value = preferredCycleId;
  cycleSelect.disabled = !state.connected || cycles.length < 2;

  $("#candidate-disposition-state").dataset.state = disposition.status;
  $("#candidate-disposition-state").textContent = candidateDispositionStatusLabel(disposition.status);
  $("#candidate-disposition-packets").textContent = `${String(Number(counts.reviewPackets || 0)).padStart(2, "0")} / 06`;
  $("#candidate-disposition-protocol").textContent = disposition.prerequisites?.independentProtocolCurrent ? "ADMITTED" : "OPEN";
  $("#candidate-disposition-keys").textContent = `${String(Number(registry.activeKeyCount || 0)).padStart(2, "0")} / 04`;
  $("#candidate-disposition-duties-count").textContent = `${String(Number(counts.verifiedExternalDuties || 0)).padStart(2, "0")} / 04`;

  const prerequisites = [
    ["localPairedEvidenceCurrent", "Same-case paired evidence", "Exact two-reader, three-case cycle"],
    ["independentProtocolCurrent", "Independent protocol admission", "Seven-duty signed protocol freeze"]
  ];
  $("#candidate-disposition-prerequisites").innerHTML = prerequisites.map(([key, label, requirement], index) => {
    const current = disposition.prerequisites?.[key] === true;
    return `<article data-state="${current ? "current" : "required"}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(label)}</strong><small>${current ? "Current and fingerprint-bound" : `${escapeHTML(requirement)} required`}</small></div></article>`;
  }).join("");
  $("#candidate-disposition-duties").innerHTML = (disposition.duties || []).map(duty => `<article data-state="${escapeHTML(duty.status)}"><span>${escapeHTML(duty.index)}</span><i aria-hidden="true"></i><div><strong>${escapeHTML(duty.label)}</strong><small>${escapeHTML(duty.authority)} · ${escapeHTML(candidateDispositionStatusLabel(duty.status))}</small></div>${duty.attestationFingerprint ? `<code>${escapeHTML(duty.attestationFingerprint.slice(0, 14))}…</code>` : ""}</article>`).join("");

  const challenge = disposition.activeChallenge;
  $("#candidate-disposition-challenge-state").textContent = challenge ? "Open · awaiting next purpose" : "Not issued";
  $("#candidate-disposition-challenge-id").textContent = challenge?.challengeId || "CHALLENGE —";
  $("#candidate-disposition-challenge-detail").textContent = challenge
    ? `Expires ${new Date(challenge.expiresAt).toLocaleString()} · binds the exact cycle, local evidence heads, independent protocol, Clinical Standard, and four-key registry.`
    : registry.registryCurrent
      ? "A challenge becomes available when the same-case evidence and admitted independent protocol are both current."
      : "Provision four distinct purpose-bound Ed25519 keys in the owner-only startup registry; PERL cannot create or write them.";
  const challengeDownload = $("#download-candidate-disposition-challenge");
  challengeDownload.hidden = !challenge;
  if (challenge) {
    challengeDownload.href = `/api/calibration/candidate-retest/disposition/challenges/${encodeURIComponent(challenge.challengeId)}.json`;
    challengeDownload.download = `PERL-${challenge.challengeId}-candidate-retest-disposition-challenge.json`;
  } else challengeDownload.removeAttribute("href");
  const canIssue = state.connected && registry.registryCurrent === true && Number(registry.activeKeyCount || 0) >= 4 && Object.values(disposition.prerequisites || {}).every(Boolean) && !disposition.independentResultFrozen;
  $("#issue-candidate-disposition-challenge").disabled = !canIssue;
  $("#issue-candidate-disposition-challenge").textContent = challenge ? "Reuse current challenge" : "Issue result challenge";
  $("#candidate-disposition-file").disabled = !state.connected || !challenge || disposition.independentResultFrozen;
  $("#verify-candidate-disposition-attestation").disabled = !state.connected || !state.candidateRetestDispositionAttestation || !challenge || disposition.independentResultFrozen;

  const exportDocket = $("#export-candidate-disposition");
  if (state.connected) exportDocket.href = `/api/calibration/candidate-retest/disposition.json${disposition.cycleId ? `?cycleId=${encodeURIComponent(disposition.cycleId)}` : ""}`;
  $("#candidate-disposition-result-state").textContent = disposition.independentResultFrozen ? "RESULT FROZEN" : "RESULT OPEN";
  $("#candidate-disposition-accuracy").textContent = candidateDispositionValue(disposition.disposition?.accuracyOutcome);
  $("#candidate-disposition-reliability").textContent = candidateDispositionValue(disposition.disposition?.reliabilityOutcome);
  $("#candidate-disposition-standard").textContent = candidateDispositionValue(disposition.disposition?.clinicalStandardOutcome);
  $("#candidate-disposition-cycle-recommendation").textContent = candidateDispositionValue(disposition.disposition?.cycleCloseRecommendation, "No recommendation");
  $("#candidate-disposition-candidate-recommendation").textContent = candidateDispositionValue(disposition.disposition?.candidateRecommendation, "No recommendation");

  const history = disposition.history || [];
  $("#candidate-disposition-history").innerHTML = history.length
    ? history.map(item => `<li><span>${String(Number(item.sequence || 0)).padStart(2, "0")}</span><div><strong>${escapeHTML(item.purpose ? candidateDispositionValue(item.purpose) : "24-hour result challenge")}</strong><small>${escapeHTML(item.challengeId || "challenge unavailable")} · ${escapeHTML(item.hash.slice(0, 13))}…</small></div><time datetime="${escapeHTML(item.createdAt)}">${escapeHTML(new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</time></li>`).join("")
    : `<li><span>—</span><div><strong>No disposition events recorded</strong><small>The forty-sixth evidence chain begins only when an eligible challenge is issued.</small></div></li>`;
  $("#candidate-disposition-chain").textContent = disposition.chain?.valid
    ? `DISPOSITION LEDGER · ${String(Number(disposition.chain.count || 0)).padStart(2, "0")} EVENT${Number(disposition.chain.count || 0) === 1 ? "" : "S"}`
    : "DISPOSITION LEDGER · INTEGRITY FAILED";
  $("#candidate-disposition-chain").classList.toggle("failed", disposition.chain && !disposition.chain.valid);
  $("#candidate-disposition-fingerprint").textContent = disposition.dispositionFingerprint ? `DISPOSITION ${disposition.dispositionFingerprint.slice(0, 16)}…` : "DISPOSITION —";
  $("#candidate-disposition-boundary").textContent = disposition.boundary;
}

function candidateAdvancementStatusLabel(value) {
  return {
    "independent-result-required": "Independent result required",
    "cycle-action-registry-required": "Room I keys required",
    "cycle-action-challenge-required": "Room I ready",
    "cycle-action-in-progress": "Room I signatures in progress",
    "cycle-action-frozen-no-advancement": "Cycle action frozen · Room II sealed",
    "cycle-closed-no-advancement": "Cycle closed · no advancement recommendation",
    "candidate-identity-evidence-required": "Exact identity evidence required",
    "candidate-advancement-registry-required": "Room II keys required",
    "candidate-advancement-challenge-required": "Room II ready",
    "candidate-advancement-in-progress": "Room II signatures in progress",
    "candidate-advancement-frozen": "Exact candidate decision frozen",
    "verified-external-duty": "Verified external duty",
    "external-signature-required": "External signature required"
  }[value] || candidateDispositionValue(value, "Evidence required");
}

function renderAdvancementDuties(selector, duties = []) {
  $(selector).innerHTML = duties.map(duty => `<article data-state="${escapeHTML(duty.status)}"><span>${escapeHTML(duty.index)}</span><i aria-hidden="true"></i><div><strong>${escapeHTML(duty.label)}</strong><small>${escapeHTML(duty.authority)} · ${escapeHTML(candidateAdvancementStatusLabel(duty.status))}</small></div>${duty.attestationFingerprint ? `<code>${escapeHTML(duty.attestationFingerprint.slice(0, 14))}…</code>` : ""}</article>`).join("");
}

function renderAdvancementChallenge(prefix, room, { eligible, complete, fileReady }) {
  const challenge = room?.activeChallenge || null;
  $(`#${prefix}-challenge-state`).textContent = challenge ? "Open · awaiting next purpose" : "Not issued";
  $(`#${prefix}-challenge-id`).textContent = challenge?.challengeId || "CHALLENGE —";
  $(`#${prefix}-challenge-detail`).textContent = challenge
    ? `Expires ${new Date(challenge.expiresAt).toLocaleString()} · exact evidence, registry, room, order, and nonce are bound.`
    : prefix === "candidate-cycle-action"
      ? "A current independently frozen result and two active startup-only keys are required."
      : "A separately frozen close, advancement recommendation, exact candidate identity, and four active keys are required.";
  const download = $(`#download-${prefix}-challenge`);
  download.hidden = !challenge;
  if (challenge) {
    download.href = `/api/calibration/candidate-advancement/challenges/${encodeURIComponent(challenge.challengeId)}.json`;
    download.download = `PERL-${challenge.challengeId}-challenge.json`;
  } else download.removeAttribute("href");
  $(`#${prefix}-file`).disabled = !state.connected || !challenge || complete;
  $(`#verify-${prefix}-attestation`).disabled = !state.connected || !fileReady || !challenge || complete;
  return state.connected && eligible && !complete;
}

function renderCandidateAdvancement(airlock = null) {
  state.candidateAdvancement = airlock;
  if (!airlock) return;
  const cycles = state.candidateRetest?.cycles || [];
  const select = $("#candidate-advancement-cycle");
  const priorCycleId = select.value;
  select.innerHTML = cycles.length
    ? cycles.map(cycle => `<option value="${escapeHTML(cycle.cycleId)}">Cycle ${String(Number(cycle.cycleNumber || 0)).padStart(2, "0")} · ${escapeHTML(cycle.laneLabel)} · ${escapeHTML(candidateReviewChoiceLabel(cycle.status))}</option>`).join("")
    : `<option value="">No cycle available</option>`;
  const preferredCycleId = cycles.some(cycle => cycle.cycleId === priorCycleId) ? priorCycleId : airlock.cycleId;
  if (preferredCycleId && cycles.some(cycle => cycle.cycleId === preferredCycleId)) select.value = preferredCycleId;
  select.disabled = !state.connected || cycles.length < 2;

  const cycleRegistry = airlock.registries?.cycleAction || {};
  const advancementRegistry = airlock.registries?.candidateAdvancement || {};
  const cycleRoom = airlock.rooms?.cycleAction || {};
  const advancementRoom = airlock.rooms?.candidateAdvancement || {};
  const counts = airlock.counts || {};
  $("#candidate-advancement-state").dataset.state = airlock.status;
  $("#candidate-advancement-state").textContent = candidateAdvancementStatusLabel(airlock.status);
  $("#candidate-advancement-upstream").textContent = airlock.prerequisites?.independentResultCurrent ? "FROZEN" : "OPEN";
  $("#candidate-cycle-action-keys").textContent = `${String(Number(cycleRegistry.activeKeyCount || 0)).padStart(2, "0")} / 02`;
  $("#candidate-cycle-action-duty-count").textContent = `${String(Number(counts.cycleActionDutiesVerified || 0)).padStart(2, "0")} / 02`;
  $("#candidate-advancement-keys").textContent = `${String(Number(advancementRegistry.activeKeyCount || 0)).padStart(2, "0")} / 04`;
  $("#candidate-advancement-duty-count").textContent = `${String(Number(counts.candidateAdvancementDutiesVerified || 0)).padStart(2, "0")} / 04`;
  $("#candidate-cycle-action-state").textContent = airlock.cycleActionFrozen ? "FROZEN" : airlock.prerequisites?.independentResultCurrent ? "READY" : "LOCKED";
  $("#candidate-cycle-action-result").textContent = candidateDispositionValue(airlock.cycleAction?.decision, "No action frozen");
  $("#candidate-advancement-room-state").textContent = airlock.candidateAdvancementFrozen ? "FROZEN" : airlock.prerequisites?.candidateEligible ? "READY" : "SEALED";
  renderAdvancementDuties("#candidate-cycle-action-duties", cycleRoom.duties || []);
  renderAdvancementDuties("#candidate-advancement-duties", advancementRoom.duties || []);

  const cycleEligible = cycleRegistry.registryCurrent === true && Number(cycleRegistry.activeKeyCount || 0) >= 2 && airlock.prerequisites?.independentResultCurrent === true;
  const canIssueCycle = renderAdvancementChallenge("candidate-cycle-action", cycleRoom, { eligible: cycleEligible, complete: airlock.cycleActionFrozen, fileReady: Boolean(state.candidateCycleActionAttestation) });
  $("#issue-candidate-cycle-action-challenge").disabled = !canIssueCycle;
  $("#issue-candidate-cycle-action-challenge").textContent = cycleRoom.activeChallenge ? "Reuse Room I challenge" : "Issue Room I challenge";

  const candidateEligible = advancementRegistry.registryCurrent === true && Number(advancementRegistry.activeKeyCount || 0) >= 4 && airlock.prerequisites?.candidateEligible === true;
  const canIssueCandidate = renderAdvancementChallenge("candidate-advancement", advancementRoom, { eligible: candidateEligible, complete: airlock.candidateAdvancementFrozen, fileReady: Boolean(state.candidateAdvancementAttestation) });
  $("#issue-candidate-advancement-challenge").disabled = !canIssueCandidate;
  $("#issue-candidate-advancement-challenge").textContent = advancementRoom.activeChallenge ? "Reuse Room II challenge" : "Issue Room II challenge";

  const interlock = $("#candidate-advancement-interlock");
  interlock.textContent = airlock.prerequisites?.candidateEligible ? "ROOM II OPEN" : "ROOM II SEALED";
  interlock.classList.toggle("open", airlock.prerequisites?.candidateEligible === true);
  const identity = airlock.candidateIdentity || {};
  $("#candidate-identity-status").textContent = identity.disclosed ? "DISCLOSED · EXACT" : "CONCEALED";
  $("#candidate-identity-lane").textContent = identity.disclosed ? `${identity.laneId} / ${identity.candidateSlot}` : "—";
  $("#candidate-identity-provider").textContent = identity.providerId || "—";
  $("#candidate-identity-model").textContent = identity.modelVersion || "—";
  $("#candidate-identity-prompt").textContent = identity.promptVersion || "—";
  $("#candidate-identity-policy").textContent = identity.policyVersion || "—";
  $("#candidate-identity-protocol").textContent = identity.retestProtocolFingerprint ? `${identity.retestProtocolFingerprint.slice(0, 16)}…` : "—";
  $("#candidate-advancement-cycle-result").textContent = candidateDispositionValue(airlock.cycleAction?.decision, "No action");
  $("#candidate-advancement-result").textContent = candidateDispositionValue(airlock.candidateAdvancement?.decision, "No decision");

  const exportLink = $("#export-candidate-advancement");
  if (state.connected) exportLink.href = `/api/calibration/candidate-advancement.json${airlock.cycleId ? `?cycleId=${encodeURIComponent(airlock.cycleId)}` : ""}`;
  const history = airlock.history || [];
  $("#candidate-advancement-history").innerHTML = history.length
    ? history.map(item => `<li><span>${String(Number(item.sequence || 0)).padStart(2, "0")}</span><div><strong>${escapeHTML(item.purpose ? candidateDispositionValue(item.purpose) : `${item.room} 24-hour challenge`)}</strong><small>${escapeHTML(item.room)} · ${escapeHTML(item.challengeId || "challenge unavailable")} · ${escapeHTML(item.hash.slice(0, 13))}…</small></div><time datetime="${escapeHTML(item.createdAt)}">${escapeHTML(new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</time></li>`).join("")
    : `<li><span>—</span><div><strong>No airlock events recorded</strong><small>The forty-seventh integrity family begins only when an eligible Room I challenge is issued.</small></div></li>`;
  $("#candidate-advancement-chain").textContent = airlock.chain?.valid
    ? `AIRLOCK LEDGER · ${String(Number(airlock.chain.count || 0)).padStart(2, "0")} EVENT${Number(airlock.chain.count || 0) === 1 ? "" : "S"}`
    : "AIRLOCK LEDGER · INTEGRITY FAILED";
  $("#candidate-advancement-chain").classList.toggle("failed", airlock.chain && !airlock.chain.valid);
  $("#candidate-advancement-fingerprint").textContent = airlock.airlockFingerprint ? `AIRLOCK ${airlock.airlockFingerprint.slice(0, 16)}…` : "AIRLOCK —";
  $("#candidate-advancement-boundary").textContent = airlock.boundary;
}

function counselorLabStatusLabel(value) {
  return {
    "synthetic-rehearsal-available": "Synthetic rehearsal available",
    "blocked-awaiting-external-evidence": "Awaiting external evidence"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderCounselorLab(lab = null) {
  state.counselorLab = lab;
  if (!lab) return;
  const evidence = lab.currentEvidence || {};
  $("#lab-counselor-count").textContent = String(Number(evidence.namedCounselorsRegistered || 0)).padStart(2, "0");
  $("#lab-reviewer-count").textContent = `${String(Number(evidence.sandboxReviewerCodesObserved || 0)).padStart(2, "0")} codes`;
  $("#lab-session-count").textContent = `${String(Number(evidence.sessionsCompleted || 0)).padStart(2, "0")} / ${String(Number(lab.strategy?.selectedSessionCount || 3)).padStart(2, "0")}`;
  $("#lab-evidence-count").textContent = String(Number(evidence.evidenceStreamsWithEntries || 0)).padStart(2, "0");
  $("#lab-freeze-state").textContent = lab.protocolFrozen ? "Frozen" : "Open";
  $("#counselor-lab-sessions").innerHTML = (lab.sessions || []).map(session => `<article class="counselor-session-card" data-status="${escapeHTML(session.status)}">
    <div class="counselor-session-number">${escapeHTML(session.index)}</div>
    <div class="counselor-session-main">
      <span class="counselor-session-status">${escapeHTML(counselorLabStatusLabel(session.status))}</span>
      <small>${escapeHTML(session.eyebrow)}</small>
      <h3>${escapeHTML(session.title)}</h3>
      <p>${escapeHTML(session.intent)}</p>
      <div class="counselor-session-gate"><span>Entry gate</span>${escapeHTML(session.entryGate)}</div>
      <details><summary>Agenda + required outputs</summary>
        <div class="counselor-session-detail"><div><span>In the room</span><ol>${session.agenda.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ol></div><div><span>Leaves the room</span><ul>${session.outputs.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div></div>
      </details>
      <a class="counselor-session-link" href="${escapeHTML(session.workingSurface.href)}">${escapeHTML(session.workingSurface.label)} <span aria-hidden="true">↘</span></a>
    </div>
  </article>`).join("");
  $("#counselor-lab-preflight").innerHTML = (lab.preflightReturns || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#counselor-lab-next").textContent = lab.nextDecision;
  $("#counselor-lab-fingerprint").textContent = lab.packetFingerprint ? `LAB ${lab.packetFingerprint.slice(0, 16)}…` : "LAB —";
  $("#counselor-lab-boundary").textContent = lab.boundary;
}

function counselorNotebookStatusLabel(value) {
  return {
    "ready-for-synthetic-rehearsal": "Ready for rehearsal",
    "local-notes-recorded": "Local notes recorded",
    "local-stopping-concern": "Stopping concern open",
    "not-observed": "Not observed",
    "carry-forward-for-rehearsal": "Carry forward · rehearsal",
    "revise-before-next-rehearsal": "Revise before next rehearsal",
    "defer-awaiting-evidence": "Deferred · evidence missing",
    "stopping-concern": "Stopping concern"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function syncCounselorNotebookDecisionOptions(sessionId = $("#notebook-session")?.value) {
  const notebook = state.counselorNotebook;
  if (!notebook) return;
  const session = notebook.sessions.find(item => item.id === sessionId) || notebook.sessions[0];
  const select = $("#notebook-decision");
  const current = select.value;
  select.innerHTML = session.decisions.map(decision => `<option value="${escapeHTML(decision.id)}">${escapeHTML(decision.label)}</option>`).join("");
  if (session.decisions.some(decision => decision.id === current)) select.value = current;
}

function renderCounselorNotebook(notebook = null) {
  state.counselorNotebook = notebook;
  if (!notebook) return;
  const metrics = notebook.metrics || {};
  const labels = notebook.labels || {};
  const status = $("#notebook-state");
  status.textContent = counselorNotebookStatusLabel(notebook.status);
  status.dataset.state = notebook.status;
  $("#notebook-note-count").textContent = String(Number(metrics.notesRecorded || 0)).padStart(2, "0");
  $("#notebook-decision-count").textContent = `${String(Number(metrics.decisionsCovered || 0)).padStart(2, "0")} / ${metrics.totalDecisions || 15}`;
  $("#notebook-session-count").textContent = `${String(Number(metrics.sessionsTouched || 0)).padStart(2, "0")} / ${String(Number(metrics.totalSessions || 3)).padStart(2, "0")}`;
  $("#notebook-concern-count").textContent = String(Number(metrics.stoppingConcerns || 0)).padStart(2, "0");

  const sessionOptions = notebook.sessions.map(session => `<option value="${escapeHTML(session.id)}">${escapeHTML(session.index)} · ${escapeHTML(session.label)}</option>`).join("");
  const viewSelect = $("#notebook-session-view");
  const formSession = $("#notebook-session");
  const currentFormSession = formSession.value;
  viewSelect.innerHTML = sessionOptions;
  formSession.innerHTML = sessionOptions;
  if (notebook.sessions.some(session => session.id === state.counselorNotebookSessionId)) viewSelect.value = state.counselorNotebookSessionId;
  else state.counselorNotebookSessionId = notebook.sessions[0]?.id || "language-safety";
  if (notebook.sessions.some(session => session.id === currentFormSession)) formSession.value = currentFormSession;
  else formSession.value = state.counselorNotebookSessionId;

  const session = notebook.sessions.find(item => item.id === state.counselorNotebookSessionId)
    || notebook.sessions[0];
  $("#notebook-decisions").innerHTML = (session?.decisions || []).map((decision, index) => `<article data-status="${escapeHTML(decision.status)}">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <div><small>${escapeHTML(counselorNotebookStatusLabel(decision.status))}${decision.latestSequence ? ` · entry ${String(decision.latestSequence).padStart(2, "0")}` : ""}</small><h4>${escapeHTML(decision.label)}</h4><p>${escapeHTML(decision.question)}</p>${decision.latestSequence ? `<p class="notebook-decision-evidence">${escapeHTML(labels.finding?.[decision.latestFinding] || decision.latestFinding)} · ${escapeHTML(labels.evidenceSource?.[decision.latestEvidenceSource] || decision.latestEvidenceSource)}${decision.latestAssessmentId ? ` · ${escapeHTML(decision.latestAssessmentId)}` : ""}</p>` : ""}</div>
  </article>`).join("");

  const fillOptions = (selector, items) => {
    const select = $(selector);
    const current = select.value;
    select.innerHTML = items.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.label)}</option>`).join("");
    if (items.some(item => item.id === current)) select.value = current;
  };
  fillOptions("#notebook-disposition", notebook.dispositions || []);
  fillOptions("#notebook-finding", notebook.findings || []);
  fillOptions("#notebook-evidence", notebook.evidenceSources || []);
  const assessmentSelect = $("#notebook-assessment");
  const currentAssessmentId = assessmentSelect.value;
  assessmentSelect.innerHTML = `<option value="">No case reference</option>${(notebook.allowedAssessmentIds || []).map(id => `<option value="${escapeHTML(id)}">${escapeHTML(id)}</option>`).join("")}`;
  if ((notebook.allowedAssessmentIds || []).includes(currentAssessmentId)) assessmentSelect.value = currentAssessmentId;
  syncCounselorNotebookDecisionOptions(formSession.value);

  $("#notebook-history").innerHTML = (notebook.history || []).length
    ? [...notebook.history].reverse().slice(0, 8).map(entry => `<li><div><span>Entry ${String(entry.sequence).padStart(2, "0")} · ${escapeHTML(labels.session?.[entry.sessionId] || entry.sessionId)}</span><strong>${escapeHTML(labels.decision?.[`${entry.sessionId}:${entry.decisionId}`] || entry.decisionId)} · ${escapeHTML(labels.disposition?.[entry.disposition] || entry.disposition)}</strong></div><time datetime="${escapeHTML(entry.createdAt)}">${new Date(entry.createdAt).toLocaleString()}</time><p>${escapeHTML(labels.finding?.[entry.finding] || entry.finding)} · ${escapeHTML(labels.evidenceSource?.[entry.evidenceSource] || entry.evidenceSource)}${entry.assessmentId ? ` · ${escapeHTML(entry.assessmentId)}` : " · no case reference"}</p><code>${escapeHTML(entry.actor)} · ${entry.hash.slice(0, 12)}…</code></li>`).join("")
    : "<li class=\"notebook-history-empty\">No rehearsal observations recorded. The first save establishes the genesis entry.</li>";
  $("#notebook-chain").textContent = notebook.chain?.valid
    ? `Notebook ledger verified · ${notebook.chain.count} linked entr${notebook.chain.count === 1 ? "y" : "ies"}`
    : "Notebook ledger integrity failed";
  $("#notebook-chain").classList.toggle("failed", notebook.chain && !notebook.chain.valid);
  $("#notebook-fingerprint").textContent = notebook.catalogFingerprint ? `CATALOG ${notebook.catalogFingerprint.slice(0, 16)}…` : "CATALOG —";
  $("#notebook-boundary").textContent = notebook.boundary;
}

function counselorReferenceEvidence(profile = {}) {
  const rows = [
    ...(profile.scales || []).map(item => ({ token: `${item.label} · ${item.score}`, label: item.label, score: item.score, level: item.level })),
    ...(profile.subscales || []).map(item => ({ token: `${item.label} · ${item.score}`, label: item.label, score: item.score, level: item.level }))
  ];
  return [...new Map(rows.map(item => [item.token, item])).values()];
}

function counselorReferenceThemeMarkup(theme = {}, index = 0, profile = {}) {
  const selected = new Set(theme.evidence || []);
  const evidence = counselorReferenceEvidence(profile);
  return `<article class="reference-theme" data-reference-theme>
    <div class="reference-theme-index"><span>Theme ${String(index + 1).padStart(2, "0")}</span><button class="reference-theme-remove" type="button">Remove</button></div>
    <div class="reference-theme-grid">
      <label>Theme title<input class="reference-theme-title" maxlength="180" required value="${escapeHTML(theme.title || "")}"></label>
      <label>Confidence<select class="reference-theme-confidence">${["Low", "Moderate", "High"].map(value => `<option${value === (theme.confidence || "Moderate") ? " selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="full">Evidence-grounded explanation<textarea class="reference-theme-body" minlength="40" maxlength="1000" required>${escapeHTML(theme.body || "")}</textarea></label>
      <label class="full">Explicit uncertainty<textarea class="reference-theme-uncertainty" minlength="30" maxlength="500" required>${escapeHTML(theme.uncertainty || "")}</textarea></label>
      <fieldset class="reference-evidence-set"><legend>Scored evidence · select 1–6</legend><div class="reference-evidence-options">${evidence.map(item => `<label><input type="checkbox" value="${escapeHTML(item.token)}"${selected.has(item.token) ? " checked" : ""}><span>${escapeHTML(item.label)} · ${escapeHTML(item.score)}</span></label>`).join("")}</div></fieldset>
    </div>
  </article>`;
}

function counselorReferenceQuestionMarkup(value = "", index = 0) {
  return `<div class="reference-question"><span>${String(index + 1).padStart(2, "0")}</span><input class="reference-question-value" minlength="12" maxlength="300" required aria-label="Follow-up question ${index + 1}" value="${escapeHTML(value)}" placeholder="What should the counselor clarify directly?"><button class="reference-question-remove" type="button">Remove</button></div>`;
}

function renumberCounselorReferenceEditors() {
  $$("#reference-themes [data-reference-theme]").forEach((theme, index) => { theme.querySelector(".reference-theme-index span").textContent = `Theme ${String(index + 1).padStart(2, "0")}`; });
  $$("#reference-questions .reference-question").forEach((question, index) => {
    question.querySelector("span").textContent = String(index + 1).padStart(2, "0");
    question.querySelector("input").setAttribute("aria-label", `Follow-up question ${index + 1}`);
  });
}

function setCounselorReferenceFormDisabled(disabled) {
  $$("#reference-draft-form input, #reference-draft-form textarea, #reference-draft-form select, #reference-draft-form button").forEach(control => { control.disabled = disabled; });
}

function renderCounselorReferenceCase(caseId = state.counselorReferenceCaseId) {
  const room = state.counselorReferenceRoom;
  if (!room) return;
  const selected = room.cases.find(item => item.assessmentId === caseId) || room.cases[0];
  if (!selected) return;
  state.counselorReferenceCaseId = selected.assessmentId;
  $("#reference-case").value = selected.assessmentId;
  const profile = selected.sourceProfile || {};
  const safety = profile.safety || {};
  const safetyCard = $("#reference-source-safety");
  safetyCard.dataset.state = safety.directReviewRequired ? "direct" : "routine";
  safetyCard.innerHTML = `<span>Safety route</span><strong>${safety.directReviewRequired ? "Direct review required" : "Routine verification"}</strong><p>${escapeHTML(safety.instruction || "Direct source verification remains required.")}</p>`;
  $("#reference-source-scales").innerHTML = (profile.scales || []).map(item => `<div><span>${escapeHTML(item.label)}</span><strong>${escapeHTML(item.score)}</strong><small>${escapeHTML(item.level)}</small></div>`).join("");
  $("#reference-source-subscales").innerHTML = (profile.subscales || []).map(item => `<div><span>${escapeHTML(item.label)}</span><strong>${escapeHTML(item.score)}</strong><small>${escapeHTML(item.domain)} · ${escapeHTML(item.level || "source level unavailable")}</small></div>`).join("");
  $("#reference-source-hash").textContent = `SOURCE ${selected.sourceProfileHash.slice(0, 12)}…`;

  const existing = (room.currentReviewerHistory || []).find(draft => draft.assessmentId === selected.assessmentId) || null;
  $("#reference-summary").value = existing?.summary || "";
  $("#reference-themes").innerHTML = (existing?.themes || [{}]).map((theme, index) => counselorReferenceThemeMarkup(theme, index, profile)).join("");
  const questions = existing?.questions || ["", ""];
  $("#reference-questions").innerHTML = questions.map(counselorReferenceQuestionMarkup).join("");
  const selectedTone = new Set(existing?.toneMarkers || room.toneMarkers.map(item => item.id));
  $$('#reference-tone-markers input[type="checkbox"]').forEach(input => { input.checked = selectedTone.has(input.value); });
  setCounselorReferenceFormDisabled(Boolean(existing));
  $("#reference-draft-status").classList.remove("failed");
  $("#reference-draft-status").textContent = existing
    ? `Immutable draft ${String(existing.sequence).padStart(2, "0")} is sealed for this reviewer code and case. Select another development case to continue.`
    : "No source-only draft recorded for this reviewer and case.";
  renumberCounselorReferenceEditors();
}

function renderCounselorReferenceRoom(room = null) {
  state.counselorReferenceRoom = room;
  if (!room) return;
  const metrics = room.metrics || {};
  $("#reference-room-state").textContent = room.status === "local-reference-drafts-recorded" ? "Local drafts recorded · unaccepted" : "Source-only authoring ready";
  $("#reference-case-count").textContent = String(Number(metrics.developmentCases || 0)).padStart(2, "0");
  $("#reference-draft-count").textContent = String(Number(metrics.localDrafts || 0)).padStart(2, "0");
  $("#reference-reviewer-count").textContent = String(Number(metrics.currentReviewerDrafts || 0)).padStart(2, "0");
  $("#reference-accepted-count").textContent = String(Number(metrics.acceptedReferences || 0)).padStart(2, "0");
  const caseSelect = $("#reference-case");
  caseSelect.innerHTML = (room.cases || []).map(item => `<option value="${escapeHTML(item.assessmentId)}">${escapeHTML(item.assessmentId)} · ${item.draftedByCurrentReviewer ? "draft sealed" : "source only"}</option>`).join("");
  if (!(room.cases || []).some(item => item.assessmentId === state.counselorReferenceCaseId)) state.counselorReferenceCaseId = room.activeCaseId;
  $("#reference-tone-markers").innerHTML = (room.toneMarkers || []).map(item => `<label title="${escapeHTML(item.description)}"><input type="checkbox" value="${escapeHTML(item.id)}" checked><span>${escapeHTML(item.label)}</span></label>`).join("");
  $("#reference-history-list").innerHTML = (room.currentReviewerHistory || []).length
    ? room.currentReviewerHistory.map(draft => `<li><span>Draft ${String(draft.sequence).padStart(2, "0")} · ${escapeHTML(draft.assessmentId)}</span><strong>${draft.themes.length} theme${draft.themes.length === 1 ? "" : "s"} · ${draft.questions.length} questions</strong><small>${new Date(draft.createdAt).toLocaleString()} · source-only</small><code>${draft.hash.slice(0, 12)}…</code></li>`).join("")
    : "<li>No drafts under this reviewer code.</li>";
  $("#reference-chain-head").textContent = room.chain?.head ? `REFERENCE · ${room.chain.head.slice(0, 14)}…` : "REFERENCE · GENESIS";
  $("#reference-room-boundary").textContent = room.boundary;
  renderCounselorReferenceCase(state.counselorReferenceCaseId);
}

function adjudicationStatusLabel(value) {
  return {
    "local-structure-ready": "Local structure ready",
    "local-evidence-current": "Source lineage current",
    "local-evidence-current-unverified": "Local evidence · unverified",
    "local-evidence-required": "Local evidence required",
    "external-decision-required": "External decision required"
  }[value] || String(value || "Required").replaceAll("-", " ");
}

function renderCounselorReferenceAdjudication(dossier = null) {
  state.counselorReferenceAdjudication = dossier;
  if (!dossier) return;
  const counts = dossier.counts || {};
  $("#adjudication-room-state").textContent = Number(counts.locallyComparableCases || 0) > 0
    ? `${Number(counts.locallyComparableCases)} case${Number(counts.locallyComparableCases) === 1 ? "" : "s"} locally comparable · unverified`
    : "Awaiting independent source-only drafts";
  $("#adjudication-draft-count").textContent = String(Number(counts.candidateDrafts || 0)).padStart(2, "0");
  $("#adjudication-case-count").textContent = String(Number(counts.locallyComparableCases || 0)).padStart(2, "0");
  $("#adjudication-author-count").textContent = "00";
  $("#adjudication-accepted-count").textContent = String(Number(counts.acceptedReferences || 0)).padStart(2, "0");

  $("#adjudication-cases").innerHTML = (dossier.cases || []).map((item, caseIndex) => {
    const candidateMarkup = item.candidates.length
      ? item.candidates.map(candidate => candidate.contentWithheld
        ? `<article class="adjudication-candidate"><header><strong>${escapeHTML(candidate.candidateLabel)}</strong><small>Author code masked</small></header><div class="adjudication-withheld"><strong>Comparison remains veiled.</strong><p>${item.locallyComparable ? "Contribute a source-only draft for this case before viewing other candidates." : "A second distinct reviewer-code draft is required before comparison."}</p></div></article>`
        : `<article class="adjudication-candidate"><header><strong>${escapeHTML(candidate.candidateLabel)}</strong><small>Author code masked</small></header><blockquote>${escapeHTML(candidate.summary || "")}</blockquote><h5>Clinical themes</h5><ul>${candidate.themes.map(theme => `<li><strong>${escapeHTML(theme.title)}</strong> · ${escapeHTML(theme.confidence)} confidence<br>${escapeHTML(theme.body)}</li>`).join("")}</ul><h5>Questions carried forward</h5><ul>${candidate.questions.map(question => `<li>${escapeHTML(question)}</li>`).join("")}</ul></article>`).join("")
      : `<article class="adjudication-candidate"><div class="adjudication-withheld"><strong>No candidate recorded.</strong><p>This frozen development case is waiting for source-only counselor drafting.</p></div></article>`;
    const synthesis = item.structuralSynthesis || {};
    return `<article class="adjudication-case">
      <header class="adjudication-case-head"><div><span>Case ${String(caseIndex + 1).padStart(2, "0")} · ${escapeHTML(item.partition)}</span><h4>${escapeHTML(item.assessmentId)}</h4></div><em data-ready="${item.locallyComparable}">${escapeHTML(item.comparisonStatus.replaceAll("-", " "))}</em></header>
      <div class="adjudication-candidates">${candidateMarkup}</div>
      <div class="adjudication-synthesis"><div><span>Draft candidates</span><strong>${String(Number(item.draftCount || 0)).padStart(2, "0")}</strong></div><div><span>Shared citations</span><strong>${String(Number(synthesis.sharedEvidenceCitationCount || 0)).padStart(2, "0")}</strong></div><div><span>Candidate-only</span><strong>${String(Number(synthesis.candidateOnlyEvidenceCitationCount || 0)).padStart(2, "0")}</strong></div><div><span>Decision method</span><strong>No vote</strong></div></div>
    </article>`;
  }).join("") || `<article class="adjudication-empty"><span>00</span><div><strong>No development case is available.</strong><p>The frozen manifest must be present before local comparison can begin.</p></div></article>`;

  $("#adjudication-gates").innerHTML = (dossier.gates || []).map((gate, index) => `<li data-state="${escapeHTML(gate.status)}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(adjudicationStatusLabel(gate.status))}</small></div></li>`).join("");
  $("#adjudication-history").innerHTML = (dossier.history || []).length
    ? dossier.history.slice(0, 4).map(event => `<article><strong>Evidence snapshot ${String(event.sequence).padStart(2, "0")}</strong><small>${new Date(event.createdAt).toLocaleString()} · ${event.dossierFingerprint.slice(0, 12)}…</small></article>`).join("")
    : "<p>No dossier snapshots recorded.</p>";
  $("#adjudication-chain-head").textContent = dossier.chain?.head ? `ADJUDICATION · ${dossier.chain.head.slice(0, 12)}…` : "ADJUDICATION · GENESIS";
  $("#adjudication-boundary").textContent = dossier.boundary;
  const sealButton = $("#seal-reference-adjudication");
  const currentSealed = dossier.history?.[0]?.dossierFingerprint === dossier.dossierFingerprint;
  sealButton.disabled = Boolean(currentSealed);
  sealButton.textContent = currentSealed ? "Current evidence state sealed" : "Seal current evidence state";
}

function referenceDecisionStatusLabel(value) {
  return {
    "sealed-adjudication-required": "Complete and seal every comparison",
    "external-decision-registry-required": "External decision registry required",
    "reference-decision-challenge-required": "Ready for an exact decision challenge",
    "external-decisions-in-progress": "External decision sequence in progress",
    "reference-protocol-frozen-for-independent-review": "Reference protocol frozen · independent review next"
  }[value] || String(value || "External decision required").replaceAll("-", " ");
}

function referenceDecisionDutyDescription(purpose) {
  return {
    "reference-authorship-attestation": "Verify qualified, conflict-reviewed authors without placing their names or credentials in PERL.",
    "reference-language-safety-acceptance": "Accept indicator language, uncertainty, diagnostic restraint, and the direct-review route.",
    "reference-adjudication-decision": "Bind an accepted candidate or synthesis for every case and preserve dissent without a vote.",
    "reference-protocol-freeze": "Freeze the exact reference set and protocol, then bind the independent-review handoff."
  }[purpose] || "Return the next exact externally signed duty.";
}

function renderCounselorReferenceDecision(docket = null) {
  state.counselorReferenceDecision = docket;
  if (!docket) return;
  const counts = docket.counts || {};
  const registry = docket.registry || {};
  const verified = Number(counts.verifiedExternalDuties || 0);
  const required = Number(counts.requiredExternalDuties || 4);
  $("#reference-decision-state").textContent = referenceDecisionStatusLabel(docket.status);
  $("#reference-decision-seal-count").textContent = `${verified} / ${required}`;
  $("#reference-decision-case-count").textContent = `${String(Number(counts.locallyComparableCases || 0)).padStart(2, "0")} / ${String(Number(counts.developmentCases || 0)).padStart(2, "0")}`;
  $("#reference-decision-duty-count").textContent = `${String(verified).padStart(2, "0")} / ${String(required).padStart(2, "0")}`;
  $("#reference-decision-accepted-count").textContent = String(Number(counts.acceptedReferences || 0)).padStart(2, "0");
  $("#reference-decision-freeze-state").textContent = docket.protocolFrozen ? "Frozen" : "Open";
  $("#reference-decision-freeze-card").dataset.state = docket.protocolFrozen ? "frozen" : "open";
  $("#reference-decision-registry-id").textContent = String(registry.registryId || "FF-REFERENCE-REGISTRY-DISABLED").replace("FF-REFERENCE-REGISTRY-", "");
  $("#reference-decision-key-count").textContent = `${String(Number(registry.activeKeyCount || 0)).padStart(2, "0")} / 04`;
  $("#reference-decision-dossier-hash").textContent = docket.dossierFingerprint ? `${docket.dossierFingerprint.slice(0, 12)}…` : "—";
  $("#reference-decision-chain-head").textContent = docket.chain?.head ? `${docket.chain.head.slice(0, 12)}…` : "GENESIS";
  $("#reference-decision-duties").innerHTML = (docket.purposes || []).map((item, index) => `<li data-state="${escapeHTML(item.status)}"><span>${escapeHTML(item.index || String(index + 1).padStart(2, "0"))}</span><div><small>Duty ${["one", "two", "three", "four"][index] || index + 1}</small><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(referenceDecisionDutyDescription(item.purpose))}</p>${item.attestationFingerprint ? `<code>${escapeHTML(item.attestationFingerprint.slice(0, 12))}…</code>` : ""}</div><em>${item.status === "verified-external-duty" ? "VERIFIED" : "OPEN"}</em></li>`).join("");

  const challenge = docket.activeChallenge;
  const challengeLink = $("#reference-decision-challenge-download");
  if (challenge) {
    challengeLink.hidden = false;
    challengeLink.href = `/api/calibration/reference-decision/challenges/${encodeURIComponent(challenge.challengeId)}.json`;
    challengeLink.download = `PERL-${challenge.challengeId}-reference-decision-challenge.json`;
    $("#reference-decision-challenge-state").textContent = `Current exact challenge · expires ${new Date(challenge.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Next duty: ${(docket.purposes || []).find(item => item.status !== "verified-external-duty")?.label || "sequence complete"}.`;
  } else {
    challengeLink.hidden = true;
    challengeLink.href = "#";
    $("#reference-decision-challenge-state").textContent = docket.localEvidenceReady
      ? registry.registryCurrent ? "Issue one exact 24-hour challenge before accepting signed duty returns." : "Provision four distinct purpose-bound keys through the owner-only startup registry."
      : "Every development case needs two distinct-code drafts and a current sealed adjudication snapshot.";
  }
  const issueButton = $("#issue-reference-decision-challenge");
  issueButton.disabled = !state.connected || docket.status !== "reference-decision-challenge-required";
  issueButton.textContent = challenge ? "Current challenge already issued" : "Issue exact 24-hour challenge";
  $("#verify-reference-decision-attestation").disabled = !state.connected || !challenge || !state.counselorReferenceDecisionAttestation || docket.protocolFrozen;
  $("#reference-decision-history").innerHTML = (docket.history || []).length
    ? docket.history.slice(0, 8).map(event => `<li><div><strong>${event.eventType === "reference-decision-challenge-issued" ? "Exact challenge issued" : escapeHTML((event.purpose || "external duty").replaceAll("-", " "))}</strong><small>${escapeHTML(new Date(event.createdAt).toLocaleString())}</small></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`).join("")
    : "<li>No challenge or verified duty recorded.</li>";
  $("#reference-decision-boundary").textContent = docket.boundary;
}

function counselorFieldworkSessionLabel(value) {
  return {
    "synthetic-rehearsal-available": "Rehearsal available",
    "blocked-awaiting-external-evidence": "Outside evidence required",
    "not-observed": "Not observed",
    "local-notes-recorded": "Local notes recorded",
    "local-stopping-concern": "Stopping concern"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderCounselorFieldwork(payload = null) {
  if (!payload) return;
  state.counselorFieldwork = payload;
  const { metrics = {}, analysis = {}, lab = {}, notebook = {}, referenceRoom = {}, adjudication = {}, referenceDecision = {}, incidents = {}, intendedUse = {}, languageReview = {}, providerActivation = {} } = payload;
  const sample = analysis.sample || {};
  const safety = analysis.safety || {};
  const evidence = lab.currentEvidence || {};
  const notebookMetrics = notebook.metrics || {};
  const stopped = Number(safety.unresolvedHighSeverity || incidents.control?.highSeverityOpen || 0) > 0;

  $("#fieldwork-case-count").textContent = String(Number(evidence.syntheticCases ?? analysis.caseSet?.cases ?? metrics.assessments ?? 0)).padStart(2, "0");
  $("#fieldwork-awaiting-count").textContent = String(Number(metrics.awaitingReview || 0)).padStart(2, "0");
  $("#fieldwork-decision-count").textContent = `${String(Number(notebookMetrics.decisionsCovered || 0)).padStart(2, "0")} / ${Number(notebookMetrics.totalDecisions || 15)}`;
  $("#fieldwork-safety-state").textContent = stopped ? "Stopped" : "Clear";
  $("#fieldwork-safety-copy").textContent = stopped ? "Unresolved stopping event" : "No open stopping event";
  $("#fieldwork-room-state").textContent = stopped ? "Rehearsal paused by safety control" : "Synthetic rehearsal ready";
  $(".fieldwork-brief-state").dataset.state = stopped ? "stopped" : "ready";
  $(".fieldwork-pulse [data-signal=\"safety\"]").dataset.state = stopped ? "stopped" : "clear";

  const notebookBySession = new Map((notebook.sessions || []).map(session => [session.id, session]));
  const destinations = {
    "language-safety": { target: "review", label: "Inspect a summary" },
    "usefulness-workflow": { target: "comparison-form", label: "Run a blind comparison" },
    "freeze-handoff": { target: "counselor-notebook", label: "Record the decision" }
  };
  $("#fieldwork-sessions").innerHTML = (lab.sessions || []).map(session => {
    const noteSession = notebookBySession.get(session.id) || {};
    const status = noteSession.status && noteSession.status !== "not-observed" ? noteSession.status : session.status;
    const destination = destinations[session.id] || destinations["language-safety"];
    return `<article class="fieldwork-session" data-status="${escapeHTML(status)}">
      <span>${escapeHTML(session.index)}</span>
      <div><small>${escapeHTML(session.eyebrow)}</small><h3>${escapeHTML(session.title)}</h3><p>${escapeHTML(session.intent)}</p></div>
      <div class="fieldwork-session-action"><div class="fieldwork-session-state">${escapeHTML(counselorFieldworkSessionLabel(status))} · ${Number(noteSession.covered || 0)}/${Number(noteSession.total || 5)} observed</div><button type="button" data-fieldwork-destination="${escapeHTML(destination.target)}">${escapeHTML(destination.label)} <span aria-hidden="true">→</span></button></div>
    </article>`;
  }).join("");

  $("#fieldwork-next-copy").textContent = lab.nextDecision || "Return the named counselor panel, approved source samples, language guidance, direct-review route, and independent evaluator.";
  const languageCounts = languageReview.counts || {};
  const activationCounts = providerActivation.counts || {};
  const acceptanceRows = intendedUse.requiredAcceptances || [];
  const acceptanceCount = acceptanceRows.filter(item => !String(item.state || "").includes("required")).length;
  const readiness = [
    { label: "Named counselor panel", detail: `${Number(evidence.namedCounselorsRegistered || 0)} registered · roster stays external`, local: false },
    { label: "Approved source samples", detail: `${Number(evidence.syntheticCases || 0)} synthetic cases · authoritative return required`, local: false },
    { label: "Intended-use acceptance", detail: `${acceptanceCount} / ${acceptanceRows.length || 5} named acceptances`, local: false },
    { label: "Language + safety acceptance", detail: `${Number(languageCounts.acceptancesRecorded || 0)} / ${Number(languageCounts.acceptancesRequired || 5)} named acceptances`, local: false },
    { label: "Reference decision sequence", detail: `${Number(referenceDecision.counts?.verifiedExternalDuties || 0)} / ${Number(referenceDecision.counts?.requiredExternalDuties || 4)} signed duties`, local: false },
    { label: "Provider rehearsal design", detail: `${Number(activationCounts.objectives || 8)} working objectives · externally unaccepted`, local: true },
    { label: "Independent evaluator", detail: lab.independentReviewComplete ? "External review recorded" : "Named evaluator and handoff required", local: false }
  ];
  $("#fieldwork-readiness-list").innerHTML = readiness.map((item, index) => `<li data-state="${item.local ? "local" : "external"}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.detail)}</small></div></li>`).join("");

  const blindCount = Number(sample.pairedComparisons || 0);
  const blindMinimum = Number(analysis.thresholds?.minimumComparisons || 60);
  const evidenceRows = [
    ["Frozen synthetic cases", String(Number(analysis.caseSet?.cases || evidence.syntheticCases || 0)).padStart(2, "0"), "Engineering rehearsal"],
    ["Source-only reference drafts", String(Number(referenceRoom.metrics?.localDrafts || 0)).padStart(2, "0"), "Local candidates · unaccepted"],
    ["Comparable reference cases", String(Number(adjudication.counts?.locallyComparableCases || 0)).padStart(2, "0"), "Dissent preserved · no vote"],
    ["Verified reference duties", `${String(Number(referenceDecision.counts?.verifiedExternalDuties || 0)).padStart(2, "0")} / 04`, referenceDecision.protocolFrozen ? "Protocol frozen · review next" : "External signatures required"],
    ["Blind comparisons", `${String(blindCount).padStart(2, "0")} / ${blindMinimum}`, "Minimum protocol denominator"],
    ["Structured feedback", String(Number(sample.feedbackEntries || 0)).padStart(2, "0"), "Local entries"],
    ["Notebook coverage", `${String(Number(notebookMetrics.decisionsCovered || 0)).padStart(2, "0")} / ${Number(notebookMetrics.totalDecisions || 15)}`, "Fixed decisions observed"],
    ["Open stopping events", String(Number(safety.unresolvedHighSeverity || incidents.control?.highSeverityOpen || 0)).padStart(2, "0"), "High severity or critical"]
  ];
  $("#fieldwork-evidence-list").innerHTML = evidenceRows.map(([label, value, note]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div>`).join("");
  $("#fieldwork-chain-state").textContent = `${referenceRoom.chain?.head ? `REFERENCE · ${referenceRoom.chain.head.slice(0, 10)}…` : "REFERENCE · GENESIS"} · ${adjudication.chain?.head ? `ADJUDICATION · ${adjudication.chain.head.slice(0, 10)}…` : "ADJUDICATION · GENESIS"} · ${referenceDecision.chain?.head ? `DECISION · ${referenceDecision.chain.head.slice(0, 10)}…` : "DECISION · GENESIS"} · ${notebook.chain?.head ? `NOTEBOOK · ${notebook.chain.head.slice(0, 10)}…` : "NOTEBOOK · GENESIS"}`;
  $("#fieldwork-boundary-copy").textContent = "This local synthetic rehearsal records bounded observations only. It does not authenticate a counselor, prove attendance or training, accept a clinical decision or reference, establish accuracy, reliability, or validity, authorize a pilot or release, or permit patient use.";
  $("#fieldwork-announcement").textContent = stopped
    ? "Counselor fieldwork is paused because an unresolved stopping event is open."
    : `Counselor fieldwork loaded with ${metrics.awaitingReview || 0} synthetic summaries awaiting review and ${notebookMetrics.decisionsCovered || 0} of ${notebookMetrics.totalDecisions || 15} decisions observed.`;
}

function formatStandardThreshold(field, value) {
  if (value == null) return "—";
  const displayed = field.scale === 100 ? Math.round(value * 100) : value;
  return `${displayed}${field.unit === "%" ? "%" : ` ${field.unit}`}`;
}

function renderClinicalStandard(standard = null) {
  state.clinicalStandard = standard;
  if (!standard) return;
  const latest = standard.latestDraft;
  const evidence = standard.currentEvidence || {};
  const counts = evidence.counts || {};
  const status = $("#clinical-standard-state");
  status.textContent = latest ? (latest.preOutcomeCandidate ? "Pre-results working draft" : "Post-outcome working draft") : "Definition required";
  status.dataset.state = latest ? (latest.preOutcomeCandidate ? "pre-outcome" : "post-outcome") : "required";
  $("#standard-draft-version").textContent = latest ? `v${String(latest.version).padStart(2, "0")}` : "v—";
  $("#standard-draft-count").textContent = String((standard.history || []).length).padStart(2, "0");
  $("#standard-evidence-state").textContent = evidence.outcomeEvidenceObserved ? "Outcomes observed" : "No outcomes yet";
  $("#standard-evidence-detail").textContent = `${counts.pairedBlindComparisons || 0} comparisons · ${counts.structuredFeedbackEntries || 0} feedback · ${counts.workflowTimingObservations || 0} timing`;
  $("#standard-chain-state").textContent = standard.chain?.valid
    ? `Draft ledger verified · ${standard.chain.count} linked version${standard.chain.count === 1 ? "" : "s"}`
    : "Draft ledger integrity failed";
  $("#standard-chain-state").classList.toggle("failed", standard.chain && !standard.chain.valid);
  $("#standard-latest").innerHTML = latest
    ? `<span>${latest.preOutcomeCandidate ? "Recorded before outcomes" : "Recorded after outcomes"}</span><strong>Working draft v${String(latest.version).padStart(2, "0")}</strong><p>${escapeHTML(latest.rationale)}</p><code>${latest.hash.slice(0, 16)}…</code>`
    : "<span>No draft recorded</span><strong>The study has measures, but no jointly defined standard.</strong><p>Complete all seven fields and explain why these thresholds answer the client’s question before outcome evidence is inspected.</p>";
  $("#standard-history").innerHTML = (standard.history || []).length
    ? [...standard.history].reverse().map(item => `<li><div><span>v${String(item.version).padStart(2, "0")} · ${item.preOutcomeCandidate ? "pre-results candidate" : "post-outcome draft"}</span><strong>${escapeHTML(item.actor)}</strong></div><time datetime="${escapeHTML(item.createdAt)}">${new Date(item.createdAt).toLocaleString()}</time><code>${item.hash.slice(0, 12)}…</code></li>`).join("")
    : "<li class=\"standard-history-empty\">The first save establishes the genesis version.</li>";
  if (latest) {
    for (const field of standard.fields || []) {
      const input = $(`#standard-${field.key}`);
      if (input) input.value = String(field.scale === 100 ? latest.thresholds[field.key] * 100 : latest.thresholds[field.key]);
    }
    $("#standard-rationale").value = latest.rationale;
  }
  $("#standard-threshold-summary").innerHTML = latest
    ? (standard.fields || []).map(field => `<div><span>${escapeHTML(field.label)}</span><strong>${escapeHTML(formatStandardThreshold(field, latest.thresholds[field.key]))}</strong></div>`).join("")
    : "<p>Thresholds appear here after the first immutable draft is saved.</p>";
  $("#clinical-standard-boundary").textContent = standard.boundary;
}

function independentReviewStatusLabel(value) {
  return {
    "local-evidence-current": "Current local evidence",
    "local-evidence-required": "Local evidence required",
    "external-decision-required": "External decision required",
    "externally-verified-dependency": "Verified upstream dependency",
    "named-in-correspondence-not-connected": "Named source · not connected",
    "rfi-rehearsal-only": "RFI rehearsal only",
    "source-reported-not-received": "Source-reported · not received"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderIndependentReview(review = null) {
  state.independentReview = review;
  if (!review) return;
  const counts = review.gateCounts || {};
  const evidence = review.evidenceSnapshot || {};
  $("#independent-local-count").textContent = `${counts.localCurrent || 0} / 4`;
  $("#independent-external-count").textContent = `${counts.externalAccepted || 0} / 6`;
  $("#independent-case-count").textContent = String(Number(evidence.syntheticCases || 0)).padStart(2, "0");
  $("#independent-comparison-count").textContent = String(Number(evidence.pairedBlindComparisons || 0)).padStart(2, "0");
  $("#independent-reviewer-count").textContent = `${Number(evidence.independentReviewerCodes || 0)} reviewer code${Number(evidence.independentReviewerCodes || 0) === 1 ? "" : "s"}`;
  $("#independent-review-state").textContent = Number(counts.externalAccepted || 0) > 0 ? "Reference freeze received · five decisions open" : "Outside evidence required";
  $("#independent-external-detail").textContent = Number(counts.externalAccepted || 0) > 0 ? "Counselor freeze verified" : "Nothing verified";
  $("#independent-domains").innerHTML = (review.domains || []).map(domain => `<article>
    <span>${escapeHTML(domain.index)}</span><div><small>${escapeHTML(domain.label)}</small><h4>${escapeHTML(domain.question)}</h4><details><summary>Evidence the evaluator inspects</summary><ul>${domain.evidence.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul></details></div>
  </article>`).join("");
  $("#independent-inputs").innerHTML = (review.controlledInputs || []).map(input => `<article class="${input.status === "named-in-correspondence-not-connected" ? "missing" : input.status === "externally-verified-dependency" ? "verified" : ""}">
    <span>${escapeHTML(independentReviewStatusLabel(input.status))}</span><strong>${escapeHTML(input.filename || input.label)}</strong><p>${escapeHTML(input.requiredFor)}</p>
  </article>`).join("");
  const renderGates = gates => gates.map(gate => `<article class="independent-gate" data-state="${escapeHTML(gate.status)}"><i aria-hidden="true"></i><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(independentReviewStatusLabel(gate.status))}</small></article>`).join("");
  $("#independent-local-gates").innerHTML = renderGates((review.gates || []).filter(gate => gate.category === "local-pattern"));
  $("#independent-external-gates").innerHTML = renderGates((review.gates || []).filter(gate => gate.category === "external-authority"));
  const latest = review.latestSeal;
  $("#independent-seal-state").textContent = latest ? `Local dossier seal ${String(latest.sequence).padStart(2, "0")}` : "No dossier sealed";
  $("#independent-seal-detail").textContent = latest
    ? `${latest.actor} · ${new Date(latest.createdAt).toLocaleString()} · ${latest.gateCounts?.externalAccepted === 1 ? "one upstream dependency bound; five decisions remained open" : "all six external decisions remained open"}.`
    : "Seal the current reproducible state for an outside reviewer. This does not name the reviewer or record a decision.";
  $("#independent-review-chain").textContent = review.chain?.valid
    ? `Dossier ledger verified · ${review.chain.count} seal${review.chain.count === 1 ? "" : "s"}`
    : "Dossier ledger integrity failed";
  $("#independent-review-chain").classList.toggle("failed", review.chain && !review.chain.valid);
  $("#independent-review-fingerprint").textContent = review.dossierFingerprint ? `DOSSIER ${review.dossierFingerprint.slice(0, 16)}…` : "DOSSIER —";
  $("#independent-review-boundary").textContent = review.boundary;
  $("#seal-independent-review").disabled = !state.connected;
}

function independentAdmissionStatusLabel(value) {
  return {
    "sealed-independent-review-dossier-required": "Seal the current evidence dossier",
    "counselor-reference-freeze-required": "Verify the counselor reference freeze",
    "clinical-standard-draft-required": "Record the clinical standard draft",
    "independent-review-admission-registry-required": "Provision seven external trust keys",
    "independent-review-admission-challenge-required": "Ready to issue the admission challenge",
    "independent-review-admission-in-progress": "External decisions in progress",
    "independent-review-protocol-admitted": "Independent evaluation may begin",
    "verified-external-duty": "Verified external duty",
    "external-signature-required": "External signature required"
  }[value] || String(value || "Required").replaceAll("-", " ");
}

function renderIndependentReviewAdmission(admission = null) {
  state.independentReviewAdmission = admission;
  if (!admission) return;
  const verified = Number(admission.counts?.verifiedExternalDuties || 0);
  const registry = admission.registry || {};
  $("#independent-admission-count").textContent = `${verified} / 7`;
  $("#independent-admission-result").textContent = admission.independentReviewExecutionReady ? "Execution admitted" : "Not run";
  $("#independent-admission-state").textContent = independentAdmissionStatusLabel(admission.status);
  $("#independent-admission-registry").textContent = registry.registryCurrent
    ? `Registry current · ${Number(registry.activeKeyCount || 0)} / 7 active keys`
    : `Registry ${registry.externallyProvisioned ? "not current" : "disabled"} · ${Number(registry.activeKeyCount || 0)} / 7 active keys`;
  const prerequisiteItems = [
    ["localDossierCurrent", "Current evidence dossier", "Exact four-gate seal"],
    ["referenceFreezeCurrent", "Counselor reference freeze", "Four-duty upstream proof"],
    ["clinicalStandardDraftCurrent", "Clinical standard draft", "Exact draft fingerprint"]
  ];
  $("#independent-admission-prerequisites").innerHTML = prerequisiteItems.map(([key, label, detail], index) => {
    const current = admission.prerequisites?.[key] === true;
    return `<article data-state="${current ? "current" : "required"}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(label)}</strong><small>${current ? "Current and bound" : escapeHTML(detail + " required")}</small></div></article>`;
  }).join("");
  $("#independent-admission-duties").innerHTML = (admission.duties || []).map(duty => `<article data-state="${escapeHTML(duty.status)}">
    <span>${escapeHTML(duty.index)}</span><i aria-hidden="true"></i><div><strong>${escapeHTML(duty.label)}</strong><small>${escapeHTML(independentAdmissionStatusLabel(duty.status))}</small></div>${duty.attestationFingerprint ? `<code>${escapeHTML(duty.attestationFingerprint.slice(0, 12))}…</code>` : ""}
  </article>`).join("");
  const challenge = admission.activeChallenge;
  $("#independent-admission-challenge-state").textContent = challenge ? "Open · awaiting next duty" : "Not issued";
  $("#independent-admission-challenge-id").textContent = challenge ? challenge.challengeId : "CHALLENGE —";
  $("#independent-admission-challenge-detail").textContent = challenge
    ? `Expires ${new Date(challenge.expiresAt).toLocaleString()} · binds the current dossier, reference freeze, standard draft, and seven purpose-bound keys.`
    : "A challenge becomes available only after all three prerequisites and seven current trust keys are present.";
  const download = $("#download-independent-admission-challenge");
  download.hidden = !challenge;
  if (challenge) {
    download.href = `/api/calibration/independent-review/admission/challenges/${encodeURIComponent(challenge.challengeId)}.json`;
    download.download = `PERL-${challenge.challengeId}-independent-review-admission-challenge.json`;
  } else download.removeAttribute("href");
  const canIssue = state.connected && registry.registryCurrent === true && Number(registry.activeKeyCount || 0) >= 7 && Object.values(admission.prerequisites || {}).every(Boolean) && !admission.independentReviewProtocolFrozen;
  $("#issue-independent-admission-challenge").disabled = !canIssue;
  $("#issue-independent-admission-challenge").textContent = challenge ? "Reuse current challenge" : "Issue 24-hour challenge";
  $("#verify-independent-admission-attestation").disabled = !state.connected || !state.independentReviewAdmissionAttestation || !challenge || admission.independentReviewProtocolFrozen;
  $("#independent-admission-chain").textContent = admission.chain?.valid
    ? `Admission ledger verified · ${admission.chain.count} event${admission.chain.count === 1 ? "" : "s"}`
    : "Admission ledger integrity failed";
  $("#independent-admission-chain").classList.toggle("failed", admission.chain && !admission.chain.valid);
  $("#independent-admission-fingerprint").textContent = admission.admissionFingerprint ? `ADMISSION ${admission.admissionFingerprint.slice(0, 16)}…` : "ADMISSION —";
  $("#independent-admission-boundary").textContent = admission.boundary;
}

function integrationReturnStatusLabel(value) {
  return {
    "not-supplied": "Not supplied",
    "candidate-metadata-needs-correction": "Metadata needs correction",
    "candidate-metadata-complete-unverified": "Metadata complete · unverified"
  }[value] || String(value || "Open").replaceAll("-", " ");
}

function renderIntegrationReturn(integrationReturn = null) {
  state.integrationReturn = integrationReturn;
  if (!integrationReturn) return;
  const counts = integrationReturn.counts || {};
  const latest = integrationReturn.latestPreflight;
  $("#owner-return-metadata-count").textContent = `${String(Number(counts.metadataComplete || 0)).padStart(2, "0")} / 08`;
  $("#owner-return-metadata-detail").textContent = counts.metadataDeclared
    ? `${counts.metadataDeclared} declared · ${counts.missing} missing`
    : "Nothing declared";
  $("#owner-return-workbook-count").textContent = `${counts.exactWorkbookFilenameMatches || 0} / 2`;
  $("#owner-return-state").textContent = latest
    ? (latest.metadataChecklistComplete ? "Metadata complete · unverified" : "Metadata preflight incomplete")
    : "Return not received";
  $("#owner-return-artifacts").innerHTML = (integrationReturn.artifacts || []).map(artifact => `<article data-state="${escapeHTML(artifact.status)}">
    <span>${escapeHTML(artifact.index)} · ${escapeHTML(integrationReturnStatusLabel(artifact.status))}</span>
    <strong>${escapeHTML(artifact.expectedFilename)}</strong>
    <p>${escapeHTML(artifact.label)} · ${escapeHTML(artifact.purpose)}</p>
  </article>`).join("");
  $("#owner-return-chain").textContent = integrationReturn.chain?.valid
    ? `Return ledger verified · ${integrationReturn.chain.count} preflight${integrationReturn.chain.count === 1 ? "" : "s"}`
    : "Return ledger integrity failed";
  $("#owner-return-chain").classList.toggle("failed", integrationReturn.chain && !integrationReturn.chain.valid);
  $("#owner-return-fingerprint").textContent = integrationReturn.requestFingerprint
    ? `REQUEST ${integrationReturn.requestFingerprint.slice(0, 16)}…`
    : "REQUEST —";
  $("#owner-return-boundary").textContent = integrationReturn.boundary;
  $("#owner-return-announcement").textContent = latest
    ? `Metadata preflight ${String(latest.sequence).padStart(2, "0")} recorded by ${latest.actor}. ${latest.counts.metadataComplete} of 8 artifact descriptions are complete and unverified; the RFI remains open.`
    : "The RFI remains open. No source material has entered PERL.";
  $("#preflight-owner-return").disabled = !state.connected || !state.integrationReturnManifest;
}

function incidentCategoryLabel(value) {
  return String(value || "").split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function renderStudySafety({ incidents = [], control, chain } = {}) {
  state.incidents = incidents;
  state.studyControl = control || state.studyControl;
  const paused = state.studyControl.state === "paused";
  const status = $("#study-safety-status");
  status.textContent = paused ? "Study paused" : "Study active";
  status.classList.toggle("paused", paused);
  $("#study-safety-count").textContent = `${state.studyControl.openIncidents} open · ${state.studyControl.highSeverityOpen} stopping`;
  $("#study-safety-reason").textContent = state.studyControl.reason;
  $("#incident-chain").textContent = chain?.valid
    ? `Incident history verified · ${chain.count} linked event${chain.count === 1 ? "" : "s"}`
    : "Incident history unavailable";
  $("#incident-list").innerHTML = incidents.length
    ? incidents.map(incident => `<article class="incident-row ${escapeHTML(incident.severity)}">
        <div><span>${escapeHTML(incident.severity)} · ${escapeHTML(incidentCategoryLabel(incident.category))}</span><strong>${escapeHTML(incident.summary)}</strong><small>${escapeHTML(incident.reportedBy)} · ${new Date(incident.reportedAt).toLocaleString()}</small></div>
        <div class="incident-state"><span>${escapeHTML(incident.status)}</span>${incident.status === "open" ? `<button class="text-button resolve-incident" type="button" data-incident-id="${escapeHTML(incident.id)}">Document resolution</button>` : `<small>${escapeHTML(incident.resolution?.actor || "Resolved")}</small>`}</div>
      </article>`).join("")
    : '<p class="empty-incidents">No study incidents recorded.</p>';

  if (paused) {
    setComparisonInputsDisabled(true);
    $("#comparison-submit").disabled = true;
    $("#comparison-unavailable").hidden = false;
    $("#comparison-unavailable strong").textContent = "Study paused";
    $("#comparison-unavailable span").textContent = state.studyControl.reason;
  } else if (state.calibrationCase && $("#comparison-reveal").hidden) {
    $("#comparison-unavailable").hidden = true;
    setComparisonInputsDisabled(false);
    $("#comparison-submit").disabled = false;
  }
  if (currentAssessment()) setApprovalState(currentAssessment());
}

function changeComponentLabel(value) {
  return {
    model: "Summary model or rules",
    "report-template": "Clinician report template",
    disclaimer: "Clinical disclaimer",
    "state-schema": "State schema",
    "release-evaluator": "Release evaluator"
  }[value] || value;
}

function changeStatusLabel(value) {
  return {
    proposed: "Replay required",
    "replay-passed": "Synthetic replay passed",
    "replay-failed": "Synthetic replay failed",
    "advance-for-clinical-review": "Advanced to clinical review",
    rollback: "Rolled back"
  }[value] || value;
}

function refinementStatusLabel(value) {
  return {
    "evidence-threshold-met": "Evidence threshold met",
    "collect-more-evidence": "Collect more evidence",
    "safety-escalation": "Safety escalation"
  }[value] || value;
}

function renderRefinement(refinement = null) {
  state.refinement = refinement;
  const coverage = refinement?.coverage || {};
  $("#refinement-signal-count").textContent = String(coverage.signals || 0).padStart(2, "0");
  $("#refinement-ready-count").textContent = String(coverage.eligibleSignals || 0).padStart(2, "0");
  $("#refinement-case-count").textContent = String(coverage.observedCases || 0).padStart(2, "0");
  $("#refinement-reviewer-count").textContent = String(coverage.observedReviewers || 0).padStart(2, "0");
  $("#refinement-boundary").textContent = refinement?.claimBoundary || "A repeated sandbox signal may scope a loaded change candidate. It may not change clinical logic automatically, establish clinical validity, or authorize release.";
  const sourceChains = Object.values(refinement?.integrity?.sources || {});
  const integrityValid = sourceChains.every(chain => chain.valid !== false);
  const fingerprint = refinement?.integrity?.fingerprint;
  $("#refinement-integrity").textContent = fingerprint
    ? `${integrityValid ? "Evidence chains verified" : "Evidence integrity failed"} · ${fingerprint.slice(0, 12)}…`
    : "Evidence chains ready";
  $("#refinement-integrity").classList.toggle("failed", !integrityValid);
  const signals = refinement?.signals || [];
  $("#refinement-signals").innerHTML = signals.length ? signals.map((signal, index) => {
    const cardClass = signal.status === "evidence-threshold-met" ? "ready" : signal.status === "safety-escalation" ? "escalation" : "collecting";
    const action = signal.candidateEligible
      ? `<button type="button" data-refinement-link="${escapeHTML(signal.id)}">Link to loaded change</button>`
      : "";
    return `<article class="refinement-signal ${cardClass}">
      <div class="refinement-rank">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <div class="refinement-signal-kicker"><span>${escapeHTML(refinementStatusLabel(signal.status))}</span>${escapeHTML(signal.sourceType.replaceAll("-", " "))}</div>
        <h3>${escapeHTML(signal.title)}</h3>
        <p>${escapeHTML(signal.improvementTarget)}</p>
        <div class="refinement-signal-meta"><span>${signal.evidenceCount} signal${signal.evidenceCount === 1 ? "" : "s"}</span><span>${signal.caseIds.length} case${signal.caseIds.length === 1 ? "" : "s"}</span><span>${signal.reviewers.length} reviewer${signal.reviewers.length === 1 ? "" : "s"}</span></div>
        <p class="refinement-next">${escapeHTML(signal.nextEvidence)}</p>
        <div class="refinement-actions"><span>Regression focus · ${escapeHTML(signal.regressionFocus)}</span>${action}</div>
      </div>
    </article>`;
  }).join("") : `<div class="refinement-empty"><span>Learning queue empty</span><h3>Reviewer evidence will collect here.</h3><p>Return a draft, revise a summary, or complete a blind comparison. PERL will preserve the source and show when a pattern is repeated enough to scope a loaded change.</p></div>`;
}

function renderChangeControl({ runtimeVersions = {}, candidates = [], chain, boundary } = {}) {
  state.runtimeVersions = runtimeVersions;
  state.changes = candidates;
  state.changeChain = chain || state.changeChain;
  $("#change-boundary").textContent = boundary || "A passed synthetic replay can advance a candidate to clinical review. It cannot authorize live clinical release.";
  const versionCount = Object.keys(runtimeVersions).length;
  $("#change-runtime").textContent = versionCount ? `${versionCount} loaded versions pinned by the server` : "Loaded versions unavailable";
  $("#change-chain").textContent = chain?.valid
    ? `Change history verified · ${chain.count} linked event${chain.count === 1 ? "" : "s"}`
    : "Change history integrity unavailable";
  $("#change-chain").classList.toggle("failed", chain?.valid === false);
  $("#change-list").innerHTML = candidates.length ? candidates.map(candidate => {
    const replay = candidate.latestReplay;
    const linkedSignals = candidate.refinementEvidence?.signalSnapshots || [];
    const outcomes = replay?.evidence?.outcomes
      ? Object.values(replay.evidence.outcomes).map(outcome => `<span>${escapeHTML(outcome.numerator)}/${escapeHTML(outcome.denominator)} ${escapeHTML(outcome.status)}</span>`).join("")
      : "";
    const actions = candidate.disposition ? "" : `<div class="change-actions">
      <button type="button" data-change-action="replay" data-change-id="${escapeHTML(candidate.id)}">${replay ? "Run replay again" : "Run frozen replay"}</button>
      ${replay?.engineeringRegressionPassed ? `<button type="button" data-change-action="advance-for-clinical-review" data-change-id="${escapeHTML(candidate.id)}">Advance to clinical review</button>` : ""}
      <button type="button" data-change-action="rollback" data-change-id="${escapeHTML(candidate.id)}">Roll back</button>
    </div>`;
    return `<article class="change-card ${escapeHTML(candidate.status)}">
      <div>
        <div class="change-card-kicker"><span>${escapeHTML(changeStatusLabel(candidate.status))}</span>${escapeHTML(changeComponentLabel(candidate.component))}</div>
        <h3>${escapeHTML(candidate.baselineVersion)} → ${escapeHTML(candidate.candidateVersion)}</h3>
        <p>${escapeHTML(candidate.reason)}</p>
        <div class="change-meta"><span>Owner ${escapeHTML(candidate.owner)}</span><span>${escapeHTML(candidate.affectedCases.length)} frozen cases</span><span>${escapeHTML(candidate.events.length)} linked events</span>${linkedSignals.length ? `<span>${linkedSignals.length} reviewer signal${linkedSignals.length === 1 ? "" : "s"} pinned</span>` : ""}</div>
      </div>
      <div class="change-evidence">
        <div><span>Latest evidence</span><strong>${replay ? (replay.engineeringRegressionPassed ? "All synthetic invariants passed" : "Synthetic replay failed") : "Replay not run"}</strong></div>
        ${outcomes ? `<div class="change-outcomes">${outcomes}</div>` : ""}
        ${actions}
      </div>
    </article>`;
  }).join("") : '<p class="empty-changes">No governed change candidate is recorded yet.</p>';
}

async function loadChangeControl() {
  if (!state.connected) return renderChangeControl();
  try {
    renderChangeControl(await state.api.changes());
  } catch (error) {
    showToast(error.message);
  }
}

function deliveryStatusLabel(status) {
  return ({
    "awaiting-authorized-connector": "Held · no attempt",
    ready: "Ready for connector",
    "in-flight": "Attempt in flight",
    "retry-wait": "Retry review",
    "dead-lettered": "Dead letter",
    "rehearsed-not-attached": "Receipt verified"
  })[status] || "State unavailable";
}

function renderDeliveryOutbox(deliveryOutbox = null) {
  state.deliveryOutbox = deliveryOutbox;
  const counts = deliveryOutbox?.counts || { packages: 0, awaitingConnector: 0, retryWait: 0, deadLettered: 0, receipts: 0 };
  $("#delivery-package-count").textContent = String(counts.packages || 0).padStart(2, "0");
  $("#delivery-waiting-count").textContent = String(counts.awaitingConnector || 0).padStart(2, "0");
  $("#delivery-retry-count").textContent = String(counts.retryWait || 0).padStart(2, "0");
  $("#delivery-dead-count").textContent = String(counts.deadLettered || 0).padStart(2, "0");
  $("#delivery-receipt-count").textContent = String(counts.receipts || 0).padStart(2, "0");
  const connector = deliveryOutbox?.connector || {};
  $("#delivery-connector-state").textContent = connector.enabled
    ? `${connector.id || "Candidate"} · synthetic only`
    : "Connector held · no network attempt";
  const chain = deliveryOutbox?.chain;
  $("#delivery-chain-state").textContent = chain?.valid === false
    ? `OUTBOX INTEGRITY FAILURE · ${chain.failedAt || "UNKNOWN"}`
    : `OUTBOX VERIFIED · ${chain?.jobs || 0} PACKAGE${chain?.jobs === 1 ? "" : "S"} · ${chain?.events || 0} EVENT${chain?.events === 1 ? "" : "S"}`;
  $("#delivery-chain-state").classList.toggle("failed", chain?.valid === false);
  $("#delivery-boundary").textContent = deliveryOutbox?.boundary
    || "No package leaves this device without an injected connector, explicit synthetic authorization, a strict acknowledgement, and a preserved no-write claim.";
  $("#delivery-control").classList.toggle("connector-active", Boolean(connector.enabled));
  $("#delivery-control").classList.toggle("has-dead-letter", Number(counts.deadLettered || 0) > 0);

  const jobs = deliveryOutbox?.jobs || [];
  $("#delivery-job-list").innerHTML = jobs.length ? jobs.map(item => {
    const action = connector.enabled && item.active && item.status === "ready"
      ? `<button type="button" data-delivery-action="process" data-delivery-id="${escapeHTML(item.job.id)}">Run rehearsal</button>`
      : connector.enabled && item.active && item.status === "retry-wait"
        ? `<button type="button" data-delivery-action="retry" data-delivery-id="${escapeHTML(item.job.id)}">Retry safely</button>`
        : "";
    return `<article class="delivery-job" data-status="${escapeHTML(item.status)}">
      <div class="delivery-job-copy"><strong>${escapeHTML(item.job.assessmentId)} · ${escapeHTML(item.job.reportArtifactHash.slice(0, 12))}…</strong><span>Attempt ${escapeHTML(item.attempt)} / ${escapeHTML(item.job.maxAttempts)} · ${item.active ? "active package" : "historical package"}</span></div>
      <div class="delivery-job-state"><small>${escapeHTML(deliveryStatusLabel(item.status))}</small>${action}</div>
    </article>`;
  }).join("") : '<div class="delivery-empty"><span>Queue clear</span><p>Approved source-linked packages will enter the durable outbox automatically.</p></div>';
}

function integrationBindingLabel(status) {
  return ({
    "deterministic-baseline": "Deterministic baseline · local proof",
    "exact-candidate-match": "Exact advanced candidate · six-field match",
    "exact-candidate-mismatch": "Exact candidate mismatch · held",
    "candidate-unbound": "Structured candidate · not advancement-bound",
    "candidate-not-advanced": "Candidate advancement still open"
  })[status] || "Candidate binding unavailable";
}

function renderIntegrationRehearsal(rehearsal = null) {
  state.integrationRehearsal = rehearsal;
  const counts = rehearsal?.counts || { runs: 0, awaitingClinician: 0, preparedAndHeld: 0, exactCandidateMatches: 0 };
  $("#automation-run-count").textContent = String(counts.runs || 0).padStart(2, "0");
  $("#automation-review-count").textContent = String(counts.awaitingClinician || 0).padStart(2, "0");
  $("#automation-held-count").textContent = String(counts.preparedAndHeld || 0).padStart(2, "0");
  $("#automation-match-count").textContent = String(counts.exactCandidateMatches || 0).padStart(2, "0");
  const binding = rehearsal?.providerPreflight || { status: "deterministic-baseline", statement: "The deterministic baseline is available for local workflow proof." };
  $("#automation-binding-state").textContent = integrationBindingLabel(binding.status);
  $("#automation-binding-state").dataset.state = binding.status;
  $("#automation-binding-detail").textContent = binding.statement;
  $("#automation-observatory-fingerprint").textContent = rehearsal?.observatoryFingerprint
    ? `OBSERVATORY ${rehearsal.observatoryFingerprint.slice(0, 16)}…`
    : "OBSERVATORY —";
  const start = $("#start-integration-rehearsal");
  start.disabled = !state.connected;
  const runs = rehearsal?.runs || [];
  const latest = runs[0];
  if (!latest) {
    $("#automation-latest-title").textContent = "No run started";
    $("#automation-latest-detail").textContent = "Begin with the canonical 105-item synthetic scored profile. PERL will pause at clinician review before preparing any handoff.";
    $("#automation-latest-state").textContent = state.connected ? "READY" : "OFFLINE";
    $("#automation-runline").innerHTML = '<div class="automation-run-empty"><span>THE LINE IS READY</span><p>Six evidence stages will appear here after the first synthetic run begins.</p></div>';
    $("#automation-run-list").innerHTML = "<p>No source-linked automation runs are recorded yet.</p>";
    return;
  }
  $("#automation-latest-title").textContent = latest.label;
  $("#automation-latest-detail").textContent = `${latest.assessmentId} · ${latest.completedStages} of ${latest.totalStages} evidence stages verified. ${latest.candidateBinding.statement}`;
  $("#automation-latest-state").textContent = latest.status.replaceAll("-", " ");
  $("#automation-runline").innerHTML = latest.stages.map((item, index) => `<article class="automation-stage" data-state="${escapeHTML(item.status)}" title="${escapeHTML(item.detail)}">
    <span>${String(index + 1).padStart(2, "0")} · ${escapeHTML(item.status)}</span>
    <strong>${escapeHTML(item.label)}</strong>
    <p>${escapeHTML(item.detail)}</p>
    <code>${item.evidenceHash ? `${escapeHTML(item.evidenceHash.slice(0, 7))}…` : "—"}</code>
  </article>`).join("");
  $("#automation-run-list").innerHTML = runs.slice(0, 4).map(run => `<article class="automation-run-card">
    <span>${escapeHTML(run.status.replaceAll("-", " "))}</span>
    <strong>${escapeHTML(run.assessmentId)}</strong>
    <small>${run.completedStages} / ${run.totalStages} stages · ${escapeHTML(run.evidenceFingerprint.slice(0, 9))}…</small>
    <button type="button" data-open-integration-assessment="${escapeHTML(run.assessmentId)}">Open clinical record</button>
  </article>`).join("");
}

function renderRecovery(recovery = null) {
  state.recovery = recovery;
  const vault = $("#recovery-vault");
  const status = recovery?.status || "not-run";
  const event = recovery?.lastEvent || null;
  const checks = event?.verification || {};
  vault.classList.remove("verified", "failed", "running");
  if (status === "verified" || status === "failed") vault.classList.add(status);
  $("#recovery-state-chip").textContent = status === "verified"
    ? "Restore verified"
    : status === "failed"
      ? "Rehearsal failed"
      : "Not rehearsed";
  $("#recovery-schema").textContent = `v${recovery?.current?.schemaVersion || 18}`;
  $("#recovery-record-count").textContent = event ? String(event.reconciledRecords).padStart(2, "0") : "—";
  $("#recovery-ledger-count").textContent = event ? `${String(event.ledgerCount).padStart(2, "0")} / ${String(event.ledgerCount).padStart(2, "0")}` : "—";
  $("#recovery-objective-state").textContent = recovery?.rpo?.configured || recovery?.rto?.configured ? "Configured" : "Decision required";
  const checkLabels = {
    fileHashMatch: ["#recovery-file-check", "Exact hash matched"],
    stateDigestMatch: ["#recovery-state-check", "State reopened"],
    allLedgersValid: ["#recovery-chain-check", "All chains valid"],
    isolatedCopyRemoved: ["#recovery-cleanup-check", "Copy removed"]
  };
  for (const [key, [selector, passedLabel]] of Object.entries(checkLabels)) {
    const node = $(`[data-recovery-check="${key}"]`);
    delete node.dataset.state;
    if (!event) {
      $(selector).textContent = "Awaiting rehearsal";
    } else if (checks[key]) {
      node.dataset.state = "passed";
      $(selector).textContent = passedLabel;
    } else {
      node.dataset.state = "failed";
      $(selector).textContent = "Verification failed";
    }
  }
  $("#recovery-evidence-hash").textContent = event ? `EVIDENCE ${event.hash.slice(0, 16)}…` : "EVIDENCE —";
  $("#recovery-last-run").textContent = event
    ? `${status === "verified" ? "Verified" : "Failed"} ${new Date(event.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${event.durationMs} ms.`
    : "No recovery evidence has been recorded.";
  $("#recovery-boundary").textContent = recovery?.boundary
    || "This verifies only the local synthetic state; it is not a production backup or an approved recovery objective.";
}

function renderRollback(rollback = null) {
  state.rollback = rollback;
  const dossier = $("#rollback-dossier");
  const status = rollback?.status || "not-run";
  const event = rollback?.lastEvent || null;
  const checks = event?.verification || {};
  dossier.classList.remove("verified", "failed", "running");
  if (status === "verified-local-compatibility") dossier.classList.add("verified");
  if (status === "failed") dossier.classList.add("failed");
  $("#rollback-state-chip").textContent = status === "verified-local-compatibility"
    ? "Compatibility verified"
    : status === "failed"
      ? "Rehearsal failed"
      : "Not rehearsed";
  $("#rollback-baseline-id").textContent = rollback?.baseline
    ? `${rollback.baseline.id} · ${rollback.baseline.version}`
    : "PERL local baseline";
  $("#rollback-manifest-hash").textContent = rollback?.baseline?.manifestHash
    ? `MANIFEST ${rollback.baseline.manifestHash.slice(0, 16)}…`
    : "MANIFEST —";
  $("#rollback-version-count").textContent = event ? `${checks.runtimeVersionsMatch ? "05 / 05" : "Mismatch"}` : "—";
  $("#rollback-file-count").textContent = event ? `${event.sourceFiles.filter(file => file.match).length} / ${event.sourceFileCount}` : "—";
  $("#rollback-regression-state").textContent = event ? (checks.syntheticRegressionPassed ? "Passed" : "Failed") : "—";
  $("#rollback-artifact-state").textContent = rollback?.baseline?.deployableArtifactAvailable ? "Available" : "Unavailable";
  const checkLabels = {
    manifestValid: ["#rollback-manifest-check", "Manifest valid"],
    sourceFilesMatch: ["#rollback-source-check", "All files matched"],
    syntheticRegressionPassed: ["#rollback-safety-check", "Invariants passed"],
    recoveryPrerequisiteVerified: ["#rollback-restore-check", "Restore evidence linked"]
  };
  for (const [key, [selector, passedLabel]] of Object.entries(checkLabels)) {
    const node = $(`[data-rollback-check="${key}"]`);
    delete node.dataset.state;
    if (!event) {
      $(selector).textContent = "Awaiting rehearsal";
    } else if (checks[key]) {
      node.dataset.state = "passed";
      $(selector).textContent = passedLabel;
    } else {
      node.dataset.state = "failed";
      $(selector).textContent = "Verification failed";
    }
  }
  $("#rollback-evidence-hash").textContent = event ? `EVIDENCE ${event.hash.slice(0, 16)}…` : "EVIDENCE —";
  $("#rollback-last-run").textContent = event
    ? `${status === "verified-local-compatibility" ? "Verified" : "Failed"} ${new Date(event.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${event.durationMs} ms.`
    : "No compatibility evidence has been recorded.";
  $("#rollback-boundary").textContent = rollback?.boundary
    || "This does not restore a deployable artifact, change the running application, or perform a production rollback.";
}

function releaseSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderReleaseCandidate(release = null) {
  state.releaseCandidate = release;
  const foundry = $("#release-foundry");
  const latest = release?.latest || null;
  const signed = latest?.productionSignatureVerified === true;
  const failed = release?.status === "repository-integrity-failed";
  foundry.classList.remove("built", "signed", "failed", "building");
  if (failed) foundry.classList.add("failed");
  else if (signed) foundry.classList.add("signed");
  else if (latest) foundry.classList.add("built");

  $("#release-state-chip").textContent = failed
    ? "Integrity failed"
    : signed
      ? "Externally signed"
      : latest
        ? "Candidate verified"
        : "Not built";
  $("#release-file-count").textContent = latest ? String(latest.sourceFileCount).padStart(3, "0") : "—";
  $("#release-archive-size").textContent = latest ? releaseSize(latest.archiveBytes) : "—";
  $("#release-evidence-state").textContent = latest ? "Verified" : "Pending";
  $("#release-signature-state").textContent = signed ? "Verified" : latest ? "Awaiting" : "Required";
  $("#release-short-id").textContent = latest ? `RC / ${latest.artifactId.slice(-8).toUpperCase()}` : "RC / —";
  $("#release-trust-mode").textContent = release?.trust?.mode === "external-ed25519"
    ? `${release.trust.policyCurrent ? "Current" : "Expired"} · Ed25519`
    : "Not provisioned";
  $("#release-deployment-state").textContent = release?.azureDeploymentPerformed ? "Recorded" : "Not performed";
  for (const step of ["collect", "seal", "verify", "sign", "deploy"]) {
    const node = $(`[data-release-step="${step}"]`);
    delete node.dataset.state;
    if (latest && ["collect", "seal", "verify"].includes(step)) node.dataset.state = "passed";
    if ((step === "sign" && latest && !signed) || step === "deploy") node.dataset.state = "held";
    if (step === "sign" && signed) node.dataset.state = "passed";
  }
  const downloads = $("#release-downloads");
  downloads.innerHTML = latest ? [
    ["archive", "Runnable archive", "Tar + gzip"],
    ["manifest", "Content manifest", "Every source hash"],
    ["sbom", "CycloneDX SBOM", "Version 1.6"],
    ["provenance", "Build provenance", "in-toto + SLSA"],
    ["configuration", "Configuration contract", "Startup boundaries"],
    ["signingRequest", "Signing request", "External Ed25519"]
  ].map(([key, label, detail]) => `<a href="${escapeHTML(latest.downloads[key])}"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(detail)}</small></a>`).join("")
    : "<p>No candidate has been built from the current source.</p>";
  $("#release-digest").textContent = latest ? `ARCHIVE ${latest.archiveSha256.slice(0, 16)}…` : "ARCHIVE —";
  $("#release-last-build").textContent = failed
    ? "The local candidate repository failed closed."
    : latest
      ? `Candidate ${latest.artifactId} verified ${new Date(latest.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
      : "No release candidate exists.";
  $("#release-boundary").textContent = release?.boundary
    || "Local verification cannot deploy to Azure, configure e-QPASS, or authorize clinical use.";
  $("#build-release-candidate").disabled = !state.connected || failed;
}

function renderReleaseAdmission(admission = null) {
  state.releaseAdmission = admission;
  const lab = $("#release-admission-lab");
  const report = admission?.latest || null;
  const status = admission?.status || "candidate-required";
  const candidate = admission?.candidateId || state.releaseCandidate?.latest?.artifactId || null;
  lab.classList.remove("qualified", "failed", "running");
  if (status === "qualified-local") lab.classList.add("qualified");
  if (["failed-local", "repository-integrity-failed"].includes(status)) lab.classList.add("failed");
  $("#admission-state-chip").textContent = ({
    "qualified-local": "Qualified locally",
    "failed-local": "Checks failed",
    "repository-integrity-failed": "Evidence integrity failed",
    "not-run": "Awaiting qualification",
    "candidate-required": "Candidate required"
  })[status] || "Awaiting qualification";
  $("#admission-short-id").textContent = report ? `ADM / ${report.admissionId.slice(-8).toUpperCase()}` : "ADM / —";
  $("#admission-candidate-id").textContent = candidate ? candidate.slice(-8).toUpperCase() : "—";
  $("#admission-check-count").textContent = report ? `${String(report.summary.passed).padStart(2, "0")} / ${String(report.summary.total).padStart(2, "0")}` : "—";
  const testEvidence = report?.checks?.find(check => check.id === "full-archive-tests")?.evidence;
  $("#admission-test-count").textContent = Number.isInteger(testEvidence?.testCount) ? String(testEvidence.testCount) : "—";
  $("#admission-authority-state").textContent = report?.authority?.localArchiveQualificationPassed ? "Local only" : "Held";
  const checkCopy = {
    "archive-integrity": ["Archive integrity", "Content, manifest + SBOM"],
    "fixture-completeness": ["Fixture completeness", "Two synthetic source records"],
    "dependency-boundary": ["Dependency boundary", "Zero package dependencies"],
    "full-archive-tests": ["Full archive tests", "Every archived test file"],
    "clinical-calibration": ["Clinical invariants", "Safety, restraint + lineage"],
    "ephemeral-cleanup": ["Ephemeral cleanup", "Owner-only copy removed"]
  };
  $("#admission-checks").innerHTML = Object.entries(checkCopy).map(([id, [label, detail]], index) => {
    const check = report?.checks?.find(item => item.id === id);
    const stateName = check?.status || "pending";
    const result = stateName === "passed" ? "Passed" : stateName === "failed" ? "Failed" : "Pending";
    return `<article data-state="${stateName}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(label)}</strong><small>${escapeHTML(detail)}</small></div><b>${result}</b></article>`;
  }).join("");
  const reportLink = $("#admission-report-link");
  if (report) {
    reportLink.href = `/api/operations/release/admissions/${encodeURIComponent(report.admissionId)}/report.json`;
    reportLink.removeAttribute("aria-disabled");
    reportLink.textContent = "Download exact evidence report";
  } else {
    reportLink.removeAttribute("href");
    reportLink.setAttribute("aria-disabled", "true");
    reportLink.textContent = "Evidence report pending";
  }
  $("#admission-evidence-hash").textContent = report ? `EVIDENCE ${report.evidenceHash.slice(0, 16)}…` : "EVIDENCE —";
  $("#admission-last-run").textContent = report
    ? `${report.status === "qualified-local" ? "Locally qualified" : "Failed closed"} ${new Date(report.qualifiedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
    : candidate ? "The exact candidate has not been qualified from inside its archive." : "Build an exact candidate before running archive admission.";
  $("#admission-boundary").textContent = admission?.boundary
    || "Local archive qualification is not isolated CI, production signing, deployment, clinical validation, or permission for patient use.";
  $("#run-release-admission").disabled = !state.connected || !candidate || status === "repository-integrity-failed";
}

function renderReleasePromotion(promotion = null) {
  state.releasePromotion = promotion;
  const airlock = $("#release-promotion-airlock");
  const latest = promotion?.latest || null;
  const verified = latest?.verified || null;
  const status = promotion?.status || "candidate-required";
  airlock.classList.remove("prepared", "verified", "failed");
  if (latest) airlock.classList.add("prepared");
  if (verified) airlock.classList.add("verified");
  if (["repository-integrity-failed", "external-attestation-expired"].includes(status)) airlock.classList.add("failed");
  $("#promotion-state-chip").textContent = ({
    "candidate-required": "Candidate required",
    "admission-required": "Local admission required",
    "request-required": "Handoff not prepared",
    "external-evidence-required": "Awaiting external evidence",
    "external-attestation-expired": "External evidence expired",
    "verified-external-promotion-evidence": "External evidence verified",
    "repository-integrity-failed": "Evidence integrity failed"
  })[status] || "Held at boundary";
  $("#promotion-request-id").textContent = latest ? latest.requestId.slice(-8).toUpperCase() : "—";
  $("#promotion-gate-count").textContent = latest ? `${verified ? "10" : "00"} / 10` : "—";
  $("#promotion-trust-state").textContent = promotion?.trust?.mode === "external-ed25519" ? "External key armed" : "Not provisioned";
  $("#promotion-image-state").textContent = verified ? verified.imageDigest.slice(7, 19).toUpperCase() : "HELD";
  const gateLabels = [
    ["isolated-ci", "Isolated CI", "Runner · network · identity"],
    ["exact-archive-retest", "Exact archive retest", "Suite · calibration · digest"],
    ["vulnerability-review", "Vulnerability review", "Scanner · database · disposition"],
    ["license-review", "License review", "SBOM · policy · approval"],
    ["oci-image", "Locked OCI image", "Non-root · digest · provenance"],
    ["immutable-registry", "Immutable registry", "Azure · workload identity"],
    ["artifact-signature", "Hardware-backed signature", "Custody · rotation · transparency"],
    ["schema-environment", "Schema + environment", "Configuration · migration"],
    ["rollback-reconciliation", "Rollback + reconciliation", "LKG · staged recovery"],
    ["telemetry-runbook", "Telemetry + runbook", "Alerts · owners · operations"]
  ];
  $("#promotion-gates").innerHTML = gateLabels.map(([id, label, detail], index) => `<article data-state="${verified ? "verified" : latest ? "requested" : "pending"}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(label)}</strong><small>${escapeHTML(detail)}</small></div><b>${verified ? "Verified" : latest ? "External" : "Pending"}</b></article>`).join("");
  const requestLink = $("#promotion-request-link");
  const templateLink = $("#promotion-template-link");
  for (const [link, url, pending] of [[requestLink, latest?.downloads?.request, "Request pending"], [templateLink, latest?.downloads?.attestationTemplate, "Template pending"]]) {
    if (url) {
      link.href = url;
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
    if (!url) link.textContent = pending;
  }
  if (latest?.downloads?.request) requestLink.textContent = "Download exact promotion request";
  if (latest?.downloads?.attestationTemplate) templateLink.textContent = "Download signed-return template";
  $("#promotion-boundary-hash").textContent = latest ? `REQUEST ${latest.requestHash.slice(0, 16)}…` : "REQUEST —";
  $("#promotion-announcement-copy").textContent = verified
    ? `Ten external controls were verified for ${verified.imageDigest.slice(0, 22)}…. Deployment and clinical authority remain separate.`
    : latest
      ? "The exact handoff is sealed. An independently controlled pipeline must return all ten gates under the configured trust policy."
      : promotion?.localArchiveQualificationPassed
        ? "The locally qualified candidate is eligible for an exact external handoff."
        : "Build and locally qualify the exact candidate before preparing its external handoff.";
  $("#promotion-boundary").textContent = promotion?.boundary || "Promotion evidence cannot deploy, authorize clinical release, activate traffic, or permit patient use.";
  $("#prepare-release-promotion").disabled = !state.connected || !promotion?.candidateId || !promotion?.localArchiveQualificationPassed || status === "repository-integrity-failed";
  $("#verify-promotion-attestation").disabled = !state.connected || !latest || !state.releasePromotionAttestation || promotion?.trust?.mode !== "external-ed25519" || status === "repository-integrity-failed";
  $("#promotion-file-state").textContent = state.releasePromotionAttestation ? "Signed external attestation loaded locally." : "No attestation selected. JSON stays in this browser until verification.";
  $("#promotion-file-state").classList.toggle("ready", Boolean(state.releasePromotionAttestation));
}

function monitoringStatusLabel(status) {
  return {
    pass: "Clear",
    attention: "Attention",
    fail: "Failed",
    unavailable: "Not connected"
  }[status] || "Unknown";
}

function renderMonitoring(monitoring = null) {
  state.monitoring = monitoring;
  const watch = $("#operations-watch");
  const current = monitoring?.current || null;
  const event = monitoring?.lastEvent || null;
  const status = current?.status || "not-run";
  const localSignals = current?.signals?.filter(signal => signal.scope === "local") || [];
  const gaps = current?.signals?.filter(signal => signal.scope === "production-gap") || [];
  const localPassed = localSignals.filter(signal => signal.status === "pass").length;
  watch.classList.remove("clear", "attention", "failed", "running");
  if (status === "local-controls-clear") watch.classList.add("clear");
  if (status === "local-attention-required") watch.classList.add("attention");
  if (status === "local-control-failure") watch.classList.add("failed");
  $("#monitoring-state-chip").textContent = status === "local-controls-clear"
    ? "Local controls clear"
    : status === "local-attention-required"
      ? "Local attention required"
      : status === "local-control-failure"
        ? "Local control failure"
        : "Awaiting probe";
  $("#monitoring-local-count").textContent = current ? `${String(localPassed).padStart(2, "0")} / ${String(localSignals.length).padStart(2, "0")}` : "—";
  $("#monitoring-probe-time").textContent = current ? `${current.probeDurationMs} ms` : "—";
  $("#monitoring-alert-count").textContent = current ? String(current.localAlerts.length).padStart(2, "0") : "—";
  $("#monitoring-gap-count").textContent = String(gaps.length || 3).padStart(2, "0");
  $("#monitoring-local-signals").innerHTML = localSignals.length ? localSignals.map((signal, index) => `
    <article class="monitoring-signal" data-state="${escapeHTML(signal.status)}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeHTML(signal.label)}</strong><p>${escapeHTML(signal.detail)}</p></div>
      <small>${escapeHTML(monitoringStatusLabel(signal.status))}</small>
    </article>`).join("") : '<p class="monitoring-empty">Run the point-in-time probe to inspect local operational controls.</p>';
  $("#monitoring-gap-signals").innerHTML = gaps.length ? gaps.map(signal => `
    <article data-state="${escapeHTML(signal.status)}">
      <i aria-hidden="true"></i><div><strong>${escapeHTML(signal.label)}</strong><p>${escapeHTML(signal.detail)}</p></div><small>${escapeHTML(monitoringStatusLabel(signal.status))}</small>
    </article>`).join("") : `
      <article><i></i><div><strong>Access alerts</strong><p>Production identity telemetry is not connected.</p></div><small>Open gap</small></article>
      <article><i></i><div><strong>Backup jobs</strong><p>Production backup monitoring is not connected.</p></div><small>Open gap</small></article>
      <article><i></i><div><strong>Notifications</strong><p>External paging and escalation are not connected.</p></div><small>Open gap</small></article>`;
  $("#monitoring-evidence-hash").textContent = event ? `EVIDENCE ${event.hash.slice(0, 16)}…` : "EVIDENCE —";
  $("#monitoring-last-run").textContent = event
    ? `Recorded ${new Date(event.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${event.durationMs} ms · ${event.localAlerts.length} local alert${event.localAlerts.length === 1 ? "" : "s"}.`
    : "No operational evidence has been recorded.";
  $("#monitoring-boundary").textContent = monitoring?.boundary
    || "This is not continuous telemetry, an SLA/SLO, security monitoring, backup monitoring, or external alert delivery.";
}

function renderIncidentResponse(response = null) {
  state.incidentResponse = response;
  const desk = $("#response-desk");
  const event = response?.lastEvent || null;
  const scenarios = response?.scenarios || [];
  const select = $("#response-scenario");
  const selectedId = scenarios.some(item => item.id === state.responseScenarioSelection)
    ? state.responseScenarioSelection
    : event?.scenarioId || scenarios[0]?.id || "critical-safety-routing";
  select.value = selectedId;
  const scenario = scenarios.find(item => item.id === selectedId) || {
    id: selectedId,
    title: select.selectedOptions[0]?.textContent || "Critical safety routing failure",
    severity: "SEV1",
    signal: "A critical screen is omitted, softened, or allowed past the study stopping rule.",
    notificationRoles: ["clinical-lead", "engineering-owner", "security-privacy-owner", "legal-owner"]
  };
  const severity = response?.severityModel?.find(item => item.id === scenario.severity) || { responseTarget: "Immediate" };
  const ownerById = new Map((response?.ownerTree || [
    { id: "clinical-lead", label: "Clinical lead" },
    { id: "engineering-owner", label: "Engineering owner" },
    { id: "security-privacy-owner", label: "Security & privacy" },
    { id: "legal-owner", label: "Legal owner" },
    { id: "eqpass-owner", label: "e-QPASS owner" }
  ]).map(owner => [owner.id, owner]));
  const phases = event?.scenarioId === selectedId ? event.phases : (response?.phases || [
    { id: "classify", label: "Detect & classify" },
    { id: "contain", label: "Stop & contain" },
    { id: "preserve", label: "Preserve & reconcile" },
    { id: "restart", label: "Decide restart" }
  ]);
  const phaseDefaults = {
    classify: "Map the observed signal to the frozen severity model.",
    contain: "Name the stop authority and fail-closed action.",
    preserve: "Bind the evidence needed to reconstruct the event.",
    restart: "Evaluate criteria without granting production authority."
  };
  const prerequisites = response?.prerequisites || [
    { id: "monitoring", label: "Control probe", status: "required" },
    { id: "recovery", label: "Current restore", status: "required" },
    { id: "rollback", label: "Sealed baseline", status: "required" }
  ];
  desk.classList.remove("complete", "ready", "running");
  if (event) desk.classList.add("complete");
  else if (response?.readyToRehearse) desk.classList.add("ready");
  $("#response-state-chip").textContent = event ? "Tabletop complete" : response?.readyToRehearse ? "Ready to rehearse" : "Evidence required";
  $("#response-scenario-count").textContent = `${String(scenarios.length || 6).padStart(2, "0")} / 06`;
  $("#response-phase-count").textContent = `${String(phases.length || 4).padStart(2, "0")} / 04`;
  $("#response-route-state").textContent = "Unconnected";
  $("#response-authority-state").textContent = "Unassigned";
  $("#response-scenario-brief").innerHTML = `<span>${escapeHTML(scenario.severity)} · ${escapeHTML(severity.responseTarget)}</span><strong>${escapeHTML(scenario.title)}</strong><p>${escapeHTML(scenario.signal)}</p>`;
  $("#response-phase-list").innerHTML = phases.map((phase, index) => `
    <article data-state="${phase.result === "verified-design" ? "verified" : "awaiting"}">
      <span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(phase.label)}</strong><p>${escapeHTML(phase.detail || phaseDefaults[phase.id])}</p></div><small>${phase.result === "verified-design" ? "Design verified" : "Awaiting"}</small>
    </article>`).join("");
  $("#response-owner-tree").innerHTML = (scenario.notificationRoles || []).map(roleId => {
    const owner = ownerById.get(roleId) || { label: roleId };
    return `<div><i aria-hidden="true"></i><span>${escapeHTML(owner.label)}</span><small>Unassigned</small></div>`;
  }).join("");
  $("#response-prerequisites").innerHTML = prerequisites.map((item, index) => `
    <div data-state="${escapeHTML(item.status)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHTML(item.label)}</strong><small>${item.status === "ready" ? "Evidence linked" : "Evidence required"}</small></div>`).join("");
  $("#response-evidence-hash").textContent = event ? `EVIDENCE ${event.hash.slice(0, 16)}…` : "EVIDENCE —";
  $("#response-last-run").textContent = event
    ? `${event.scenarioTitle} rehearsed ${new Date(event.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${event.severity} · ${event.phases.length} stages.`
    : "No response evidence has been recorded.";
  $("#response-boundary").textContent = response?.boundary
    || "This is a local tabletop—not a production incident, notification, containment action, or restart approval.";
  $("#run-response-rehearsal").disabled = !state.connected || !response?.readyToRehearse;
}

function readinessStatusLabel(status) {
  return {
    "local-evidence-current": "Evidence current",
    "local-evidence-required": "Rehearsal required",
    "external-decision-required": "Decision required"
  }[status] || "Unresolved";
}

function renderIntendedUse(intendedUse = null) {
  state.intendedUse = intendedUse;
  const counts = intendedUse?.counts || { drafts: 0, audiences: 4, prohibitedUses: 8, acceptancesRequired: 5, acceptancesRecorded: 0 };
  const latest = intendedUse?.latestDraft || null;
  const status = intendedUse?.status || "definition-required-before-legal-review";
  const stateChip = $("#intended-use-state");
  stateChip.dataset.state = status;
  stateChip.textContent = status === "working-charter-recorded" ? "Working charter recorded" : intendedUse ? "Definition required" : "Awaiting workspace";
  $("#intended-use-version").textContent = latest ? `v${String(latest.version).padStart(2, "0")}` : "v—";
  $("#intended-use-audience-count").textContent = String(Number(counts.audiences || 4)).padStart(2, "0");
  $("#intended-use-prohibition-count").textContent = String(Number(counts.prohibitedUses || 8)).padStart(2, "0");
  $("#intended-use-acceptance-count").textContent = `${String(Number(counts.acceptancesRecorded || 0)).padStart(2, "0")} / ${String(Number(counts.acceptancesRequired || 5)).padStart(2, "0")}`;

  const audiences = intendedUse?.audiences || [];
  $("#intended-use-audiences").innerHTML = audiences.length ? audiences.map(audience => `<article class="intended-use-audience"><span>${escapeHTML(audience.index)}</span><small>${escapeHTML(audience.priority)}</small><strong>${escapeHTML(audience.label)}</strong><p>${escapeHTML(audience.purpose)}</p><em>${escapeHTML(audience.boundary)}</em></article>`).join("") : "<p>Connect the local workspace to inspect audience boundaries.</p>";
  const prohibitions = intendedUse?.prohibitedUses || [];
  $("#intended-use-prohibitions").innerHTML = prohibitions.length ? prohibitions.map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.detail)}</p></div></li>`).join("") : "<li>Prohibited-use contract unavailable.</li>";
  const acceptances = intendedUse?.requiredAcceptances || [];
  $("#intended-use-acceptances").innerHTML = acceptances.length ? acceptances.map(item => `<li><span>${escapeHTML(item.index)}</span><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.state.replaceAll("-", " "))}</small></div></li>`).join("") : "<li>External acceptance register unavailable.</li>";
  const history = intendedUse?.history || [];
  $("#intended-use-history").innerHTML = history.length ? [...history].reverse().map(item => `<li><span>v${String(item.version).padStart(2, "0")} · ${escapeHTML(item.pilotContext.replaceAll("-", " "))}</span><time datetime="${escapeHTML(item.createdAt)}">${escapeHTML(new Date(item.createdAt).toLocaleString())}</time><code>${escapeHTML(item.actor)} · ${escapeHTML(item.hash.slice(0, 12))}…</code></li>`).join("") : "<li>No versions recorded.</li>";
  if (latest) {
    $("#intended-use-context").value = latest.pilotContext;
    $("#intended-use-statement").value = latest.scopeStatement;
    $("#intended-use-rationale").value = latest.rationale;
  }
  $("#intended-use-announcement").classList.remove("failed");
  $("#intended-use-announcement").textContent = latest
    ? `Working charter v${String(latest.version).padStart(2, "0")} recorded by ${latest.actor}. All five external acceptances, legal approval, freeze, pilot, and patient-use authority remain absent.`
    : "No working charter recorded. All five external acceptances remain open.";
  $("#intended-use-fingerprint").textContent = intendedUse?.charterFingerprint ? `CHARTER ${intendedUse.charterFingerprint.slice(0, 16)}… · CHAIN ${intendedUse.chain?.count || 0}` : "CHARTER — · CHAIN 0";
  $("#intended-use-boundary").textContent = intendedUse?.boundary || "A working intended-use draft cannot approve legal language, freeze scope, authorize a pilot, or permit patient use.";
  $("#save-intended-use").disabled = !state.connected;
}

function renderLanguageReview(languageReview = null) {
  state.languageReview = languageReview;
  const counts = languageReview?.counts || { packets: 0, copySurfaces: 9, reviewQuestions: 6, acceptancesRequired: 5, acceptancesRecorded: 0 };
  const packet = languageReview?.latestPacket || null;
  const status = languageReview?.status || "intended-use-required";
  const stateChip = $("#language-review-state");
  stateChip.dataset.state = status;
  stateChip.textContent = status === "review-packet-sealed-unaccepted"
    ? "Review packet sealed · unaccepted"
    : status === "review-packet-ready-unaccepted"
      ? "Ready to seal · unaccepted"
      : languageReview ? "Intended use required" : "Awaiting workspace";
  $("#language-review-version").textContent = packet ? `v${String(packet.version).padStart(2, "0")}` : "v—";
  $("#language-review-surface-count").textContent = String(Number(counts.copySurfaces || 9)).padStart(2, "0");
  $("#language-review-question-count").textContent = String(Number(counts.reviewQuestions || 6)).padStart(2, "0");
  $("#language-review-acceptance-count").textContent = `${String(Number(counts.acceptancesRecorded || 0)).padStart(2, "0")} / ${String(Number(counts.acceptancesRequired || 5)).padStart(2, "0")}`;

  const surfaces = languageReview?.surfaces || [];
  $("#language-review-surfaces").innerHTML = surfaces.length ? surfaces.map(item => `<article class="language-review-clause"><span>${escapeHTML(item.index)}</span><small>${escapeHTML(item.placement)} · ${escapeHTML(item.audience)}</small><strong>${escapeHTML(item.label)}</strong><blockquote>${escapeHTML(item.currentText)}</blockquote><footer>${escapeHTML(item.sourceVersion)} · ${escapeHTML(item.state.replaceAll("-", " "))}</footer></article>`).join("") : '<p class="language-review-empty">Connect the local workspace to assemble the live copy proof.</p>';
  const questions = languageReview?.reviewQuestions || [];
  $("#language-review-questions").innerHTML = questions.length ? questions.map(item => `<li><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.prompt)}</p><small>${escapeHTML(item.ownerRoles.join(" + ").replaceAll("-", " "))}</small></li>`).join("") : "<li>Review brief unavailable.</li>";
  const acceptances = languageReview?.requiredAcceptances || [];
  $("#language-review-acceptances").innerHTML = acceptances.length ? acceptances.map(item => `<li><span>${escapeHTML(item.index)}</span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.state.replaceAll("-", " "))}</small></li>`).join("") : "<li>External acceptance register unavailable.</li>";
  $("#language-review-fingerprint").textContent = languageReview?.currentCorpusFingerprint ? `COPY ${languageReview.currentCorpusFingerprint.slice(0, 16)}… · CHAIN ${languageReview.chain?.count || 0}` : "COPY — · CHAIN 0";
  $("#language-review-last-run").textContent = packet
    ? `Working packet v${String(packet.version).padStart(2, "0")} sealed by ${packet.actor} ${new Date(packet.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. All five outside acceptances remain open.`
    : languageReview?.intendedUse ? "The current live corpus is ready for a working seal; no outside acceptance has been recorded." : "Record an intended-use working draft before sealing this proof.";
  $("#language-review-boundary").textContent = languageReview?.boundary || "The local office cannot create clinical or legal acceptance, freeze language, authorize a pilot, or permit patient use.";
  $("#seal-language-review").disabled = !state.connected || !languageReview?.intendedUse;
}

function authorityStatusLabel(status) {
  return {
    "confirmed-source-owner": "Source-confirmed",
    "provisional-source-owner": "Provisional from source",
    unassigned: "Authority unassigned"
  }[status] || "Unresolved";
}

function marketabilityStatusLabel(status) {
  return {
    "local-proof-current": "Local proof current",
    "local-proof-open": "Local proof open",
    "decision-required": "Decision required",
    "pilot-blocked": "Pilot blocked"
  }[status] || "Evidence required";
}

function renderMarketability(map = null) {
  state.marketabilityMap = map;
  const snapshot = map?.evidenceSnapshot || {
    localCurrent: 0,
    externalAccepted: 0,
    externalDecisionRequired: 7,
    authorityUnassigned: 8
  };
  $("#marketability-state-chip").textContent = map ? "Evidence building" : "Awaiting workspace";
  $("#marketability-local-count").textContent = map ? `${String(snapshot.localCurrent).padStart(2, "0")} / 07` : "— / 07";
  $("#marketability-external-count").textContent = `${String(snapshot.externalAccepted).padStart(2, "0")} / 07`;
  $("#marketability-owner-count").textContent = String(snapshot.authorityUnassigned).padStart(2, "0");
  $("#marketability-clock-state").textContent = map ? "Not started" : "Not connected";
  $("#marketability-headline").textContent = map?.headline
    || "The working window begins after named owners, an approved data path, and a counselor panel are available.";
  const phases = map?.phases || [];
  $("#marketability-phases").innerHTML = phases.length ? phases.map(phase => {
    const evidence = [];
    if (phase.localEvidence.total) evidence.push(`${phase.localEvidence.current}/${phase.localEvidence.total} local`);
    if (phase.externalDecisions.required) evidence.push(`${phase.externalDecisions.accepted}/${phase.externalDecisions.required} accepted`);
    evidence.push(`${phase.unassignedOwners} owner gap${phase.unassignedOwners === 1 ? "" : "s"}`);
    return `<article class="marketability-phase" data-state="${escapeHTML(phase.status)}" aria-label="${escapeHTML(`${phase.label}: ${marketabilityStatusLabel(phase.status)}`)}">
      <span class="marketability-phase-index">${escapeHTML(phase.index)}</span>
      <div class="marketability-phase-window"><span>${escapeHTML(phase.window)}</span><strong>${escapeHTML(phase.label)}</strong></div>
      <div class="marketability-phase-copy"><span>Required outcome</span><h3>${escapeHTML(phase.title)}</h3><p>${escapeHTML(phase.outcome)}</p></div>
      <div class="marketability-phase-evidence"><span>Current state</span><strong>${escapeHTML(marketabilityStatusLabel(phase.status))}</strong><small>${escapeHTML(evidence.join(" · "))}</small></div>
    </article>`;
  }).join("") : '<p class="marketability-empty">Connect the local workspace to resolve the evidence-gated path.</p>';
  const decisions = map?.immediateDecisions || [
    "Confirm the program and integration lead.",
    "Name clinical and e-QPASS authority.",
    "Nominate the counselor panel and first bounded provider site."
  ];
  $("#marketability-decisions").innerHTML = decisions.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#marketability-contract").textContent = map?.contractVersion === "perl-marketability-map/1.0" ? "MARKETABILITY MAP 1.0" : "MARKETABILITY MAP —";
  $("#marketability-boundary").textContent = map?.boundary
    || "This is an evidence-gated planning view, not a delivery-date commitment, production-readiness claim, or pilot authorization.";
}

function handoffRoleStatusLabel(status) {
  return {
    "confirmed-source-owner": "Source-confirmed",
    "provisional-source-owner": "Provisional—confirm role",
    unassigned: "Unassigned"
  }[status] || "Decision required";
}

function renderExecutiveHandoff(handoff = null) {
  state.executiveHandoff = handoff;
  const sponsor = handoff?.preparedFor?.[0] || { name: "Dolores", status: "confirmed-source-owner" };
  const program = handoff?.preparedFor?.[1] || { name: "Mike", status: "provisional-source-owner" };
  $("#handoff-sponsor-name").textContent = sponsor.name;
  $("#handoff-sponsor-status").textContent = handoffRoleStatusLabel(sponsor.status);
  $("#handoff-program-name").textContent = program.name;
  $("#handoff-program-status").textContent = handoffRoleStatusLabel(program.status);
  const packets = handoff?.packets || [];
  const decisions = packets.reduce((total, packet) => total + Number(packet.decisionCount || 0), 0);
  $("#handoff-packet-count").textContent = handoff ? `${String(packets.length).padStart(2, "0")} packets · ${String(decisions).padStart(2, "0")} decisions` : "04 packets · 21 decisions";
  const evidence = handoff?.evidenceSnapshot;
  $("#handoff-proof-state").textContent = evidence
    ? `${evidence.localCurrent} / 7 local patterns current · ${evidence.externalAccepted} / 7 accepted`
    : "Connect the workspace for live evidence";
  $("#handoff-clock-state").textContent = "Not started";
  $("#handoff-packets").innerHTML = packets.length ? packets.map(packet => `<article class="decision-packet-card" data-state="${escapeHTML(packet.status)}">
    <span>${escapeHTML(packet.index)}</span><small>Decision required</small><b>${escapeHTML(packet.label)}</b><h4>${escapeHTML(packet.title)}</h4><p>${escapeHTML(packet.purpose)}</p>
    <div class="decision-packet-meta"><span>${escapeHTML(`${packet.decisionCount} decisions`)}</span><span>${escapeHTML(`${packet.openOwnerCount} owner gap${packet.openOwnerCount === 1 ? "" : "s"}`)}</span></div>
  </article>`).join("") : '<p class="decision-room-empty">Connect the local workspace to prepare the handoff.</p>';
  const returnManifest = handoff?.returnManifest || [
    "Named owners and decision cadence.",
    "Intended use and report-language acceptance.",
    "Authoritative e-QPASS contract."
  ];
  $("#handoff-return-manifest").innerHTML = returnManifest.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  const exclusions = handoff?.exclusions || ["Respondent data or PHI.", "Private report samples.", "Production credentials or secrets."];
  $("#handoff-exclusions").innerHTML = exclusions.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#handoff-fingerprint").textContent = handoff?.packetFingerprint ? `PACKET ${handoff.packetFingerprint.slice(0, 16)}…` : "PACKET —";
  $("#handoff-boundary").textContent = handoff?.boundary
    || "This read-only packet organizes questions and requested returns. It cannot assign authority, accept evidence, commit a delivery date, or authorize clinical use.";
}

function decisionExchangeStatusLabel(status) {
  return {
    "return-not-received": "Return not received",
    "metadata-incomplete": "Metadata needs correction",
    "metadata-complete-unverified": "Complete metadata · unverified",
    "preflight-stale": "Preflight stale · reissue"
  }[status] || "External decision open";
}

function renderDecisionExchange(exchange = null) {
  state.decisionExchange = exchange;
  const packets = exchange?.packets || [];
  const counts = exchange?.counts || { requestPackets: 7, currentPreflights: 0, authorityVerified: 0, gatesClosed: 0 };
  const selected = packets.find(packet => packet.id === state.decisionExchangeGateId) || packets[0] || null;
  if (selected) state.decisionExchangeGateId = selected.id;
  $("#decision-exchange-state").textContent = exchange?.status === "returns-preflighted-unverified" ? "Returns preflighted · unverified" : exchange ? "Awaiting external returns" : "Awaiting workspace";
  $("#decision-exchange-packet-count").textContent = `${String(Number(counts.requestPackets || packets.length || 7)).padStart(2, "0")} / 07`;
  $("#decision-exchange-return-count").textContent = `${String(Number(counts.currentPreflights || 0)).padStart(2, "0")} / 07`;
  $("#decision-exchange-authority-count").textContent = String(Number(counts.authorityVerified || 0)).padStart(2, "0");
  $("#decision-exchange-closed-count").textContent = `${String(Number(counts.gatesClosed || 0)).padStart(2, "0")} / 07`;
  $("#decision-exchange-gates").innerHTML = packets.length ? packets.map(packet => `<button class="decision-exchange-gate" type="button" data-decision-gate="${escapeHTML(packet.id)}" aria-pressed="${packet.id === selected?.id}"><span>${escapeHTML(packet.index)}</span><div><strong>${escapeHTML(packet.shortLabel)}</strong><small>${escapeHTML(decisionExchangeStatusLabel(packet.status))}</small></div></button>`).join("") : '<p class="decision-exchange-empty">Connect the local workspace to assemble the seven requests.</p>';
  $("#decision-exchange-selected-index").textContent = selected ? `${selected.index} / 07` : "— / 07";
  $("#decision-exchange-selected-state").textContent = decisionExchangeStatusLabel(selected?.status);
  $("#decision-exchange-dossier-title").textContent = selected?.headline || "Choose a decision packet.";
  $("#decision-exchange-question").textContent = selected?.decisionQuestion || "The exact decision question and return contract will appear here.";
  $("#decision-exchange-roles").innerHTML = selected?.authorities?.length ? selected.authorities.map(role => `<em>${escapeHTML(role.label)} · ${escapeHTML(role.status.replaceAll("-", " "))}</em>`).join("") : "<em>Outside owners loading.</em>";
  $("#decision-exchange-requirement-list").innerHTML = selected?.requirements?.length ? selected.requirements.map(item => `<li><strong>${escapeHTML(item.label)}</strong><span>${escapeHTML(item.detail)}</span></li>`).join("") : "<li>Decision requirements loading.</li>";
  const printLink = $("#decision-exchange-print");
  const templateLink = $("#decision-exchange-template");
  if (selected) {
    printLink.href = `/api/governance/decision-exchange/${encodeURIComponent(selected.id)}/request.html`;
    templateLink.href = `/api/governance/decision-exchange/${encodeURIComponent(selected.id)}/request.json`;
    templateLink.download = `PERL-${selected.id}-decision-return.json`;
    printLink.removeAttribute("aria-disabled");
    templateLink.removeAttribute("aria-disabled");
  } else {
    printLink.href = "#";
    templateLink.href = "#";
    printLink.setAttribute("aria-disabled", "true");
    templateLink.setAttribute("aria-disabled", "true");
  }
  $("#decision-exchange-request-fingerprint").textContent = selected?.requestFingerprint ? `REQUEST ${selected.requestFingerprint.slice(0, 20)}…` : "REQUEST —";
  const selectedPreflight = selected?.latestPreflight || null;
  $("#decision-return-trust-state").textContent = selectedPreflight
    ? selectedPreflight.current
      ? selectedPreflight.metadataChecklistComplete ? "Complete metadata · unverified" : "Needs correction · unverified"
      : "Stale return · reissue packet"
    : "Unverified by design";
  const history = exchange?.history || [];
  const gateById = new Map(packets.map(packet => [packet.id, packet]));
  $("#decision-return-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "entry" : "entries"}`;
  $("#decision-return-history").innerHTML = history.length ? [...history].reverse().map(event => `<li><span>${escapeHTML(event.decisionPreview)} · unverified</span><div><strong>${escapeHTML(gateById.get(event.gateId)?.shortLabel || event.gateId)}</strong><time datetime="${escapeHTML(event.createdAt)}">${escapeHTML(new Date(event.createdAt).toLocaleString())}</time></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`).join("") : "<li>No decision-return metadata has been preflighted.</li>";
  $("#decision-exchange-fingerprint").textContent = exchange?.exchangeFingerprint ? `EXCHANGE ${exchange.exchangeFingerprint.slice(0, 16)}… · CHAIN ${exchange.chain?.count || 0}` : "EXCHANGE — · CHAIN 0";
  $("#decision-exchange-boundary").textContent = exchange?.boundary || "A complete local preflight proves structure only. It cannot send a packet, verify identity or authority, record acceptance, close a gate, or authorize clinical use.";
  $("#preflight-decision-return").disabled = !state.connected || !state.decisionReturnManifest;
}

function renderPilotOperations(plan = null) {
  state.pilotOperations = plan;
  const counts = plan?.counts || { candidatePathways: 2, workingMonths: 10, quarterlyReviews: 4, pilotsAuthorized: 0 };
  const candidates = plan?.candidates || [];
  const selected = candidates.find(candidate => candidate.id === state.pilotPathwayId) || candidates[0] || null;
  if (selected) state.pilotPathwayId = selected.id;
  $("#pilot-operations-state").textContent = plan ? "Plan assembled · authority open" : "Authorization required";
  $("#pilot-pathway-count").textContent = String(Number(counts.candidatePathways || 2)).padStart(2, "0");
  $("#pilot-working-term").textContent = `${Number(counts.workingMonths || 10)} mo`;
  $("#pilot-review-count").textContent = String(Number(counts.quarterlyReviews || 4)).padStart(2, "0");
  $("#pilot-authorized-count").textContent = String(Number(counts.pilotsAuthorized || 0)).padStart(2, "0");
  $("#pilot-pathway-buttons").innerHTML = candidates.length ? candidates.map(candidate => `<button class="pilot-pathway-button" type="button" data-pilot-pathway="${escapeHTML(candidate.id)}" aria-pressed="${candidate.id === selected?.id}"><span>${escapeHTML(candidate.index)}</span><div><strong>${escapeHTML(candidate.label)}</strong><small>${escapeHTML(candidate.setting)}</small></div></button>`).join("") : '<p class="pilot-operations-empty">Connect the workspace to assemble the pathways.</p>';
  $("#pilot-selected-index").textContent = selected ? `${selected.index} / 02` : "— / 02";
  $("#pilot-selected-status").textContent = selected ? selected.status.replaceAll("-", " ") : "Source context loading";
  $("#pilot-selected-name").textContent = selected?.label || "Select a provider pathway.";
  $("#pilot-selected-setting").textContent = selected?.setting || "Bounded setting";
  $("#pilot-selected-proposition").textContent = selected?.proposition || "The proposed operating boundary will appear here.";
  $("#pilot-selected-population").textContent = selected?.population || "No population verified.";
  $("#pilot-selected-window").textContent = selected?.workingWindow || "No calendar commitment.";
  $("#pilot-selected-training").textContent = selected?.training || "Training remains required.";
  $("#pilot-selected-decision").textContent = selected?.decisionPath || "Named authority remains external.";
  const training = plan?.training || [];
  $("#pilot-training-modules").innerHTML = training.length ? training.map(module => `<li><strong>${escapeHTML(module.label)}</strong><p>${escapeHTML(module.detail)}</p></li>`).join("") : "<li>Operating plan loading.</li>";
  const cadence = plan?.cadence || [];
  $("#pilot-review-cadence").innerHTML = cadence.length ? cadence.map(review => `<li><span>${escapeHTML(review.index)}</span><strong>${escapeHTML(review.label)}</strong><small>${escapeHTML(review.timing)}</small><p>${escapeHTML(review.decision)}</p></li>`).join("") : "<li>Decision rhythm loading.</li>";
  const measures = plan?.measures || [];
  $("#pilot-measures").innerHTML = measures.length ? measures.map(measure => `<li><strong>${escapeHTML(measure.label)}</strong><p>${escapeHTML(measure.definition)}</p><small>${escapeHTML(measure.guardrail)}</small></li>`).join("") : '<li class="pilot-operations-empty">Measures loading.</li>';
  const gates = plan?.admissionGates || [];
  $("#pilot-admission-gates").innerHTML = gates.length ? gates.map(gate => `<li><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(gate.state.replaceAll("-", " "))}</small></div></li>`).join("") : "<li>Admission decisions loading.</li>";
  const assumptions = plan?.commercialAssumptions || [];
  $("#pilot-commercial-assumptions").innerHTML = assumptions.length ? assumptions.map(assumption => `<li><strong>${escapeHTML(assumption.label)}</strong><p>${escapeHTML(assumption.detail)}</p></li>`).join("") : "<li>No approved budget or agreement is recorded.</li>";
  $("#pilot-operations-fingerprint").textContent = plan?.planFingerprint ? `PLAN ${plan.planFingerprint.slice(0, 16)}… · CHAIN ${plan.chain?.count || 0}` : "PLAN — · CHAIN 0";
  $("#pilot-operations-snapshot-state").textContent = plan?.latestSnapshot
    ? `${plan.latestSnapshot.current ? "Current" : "Stale"} planning snapshot ${String(plan.latestSnapshot.sequence).padStart(2, "0")} · ${new Date(plan.latestSnapshot.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
    : "No planning snapshot has been sealed.";
  $("#pilot-operations-boundary").textContent = plan?.boundary || "A local snapshot cannot verify a site, execute an agreement, complete training, start a pilot, establish outcomes, renew access, or authorize expansion.";
  $("#seal-pilot-operations").disabled = !state.connected;
}

function renderProviderActivation(workbook = null) {
  state.providerActivation = workbook;
  const counts = workbook?.counts || { workingMinutes: 100, modules: 4, objectives: 8, acceptedCompletions: 0 };
  $("#activation-state").textContent = workbook ? "Working rehearsal · no activation" : "Training evidence required";
  $("#activation-minute-count").textContent = String(Number(counts.workingMinutes || 100)).padStart(3, "0");
  $("#activation-module-count").textContent = String(Number(counts.modules || 4)).padStart(2, "0");
  $("#activation-objective-count").textContent = String(Number(counts.objectives || 8)).padStart(2, "0");
  $("#activation-completion-count").textContent = String(Number(counts.acceptedCompletions || 0)).padStart(2, "0");
  const modules = workbook?.modules || [];
  $("#activation-modules").innerHTML = modules.length ? modules.map(module => `<li><span>${escapeHTML(module.index)}</span><div><strong>${escapeHTML(module.label)}</strong><p>${escapeHTML(module.detail)}</p><small>${escapeHTML(module.workingMinutes)} min · working design</small></div></li>`).join("") : "<li>Activation modules loading.</li>";
  const objectives = workbook?.objectives || [];
  $("#activation-objectives").innerHTML = objectives.length ? objectives.map(objective => `<li><span>${escapeHTML(objective.index)}</span><div><strong>${escapeHTML(objective.label)}</strong><p>${escapeHTML(objective.detail)}</p></div></li>`).join("") : "<li>Learning objectives loading.</li>";
  const drills = workbook?.drills || [];
  $("#activation-drills").innerHTML = drills.length ? drills.map(drill => `<article data-critical="${drill.critical}"><header><span>${escapeHTML(drill.index)}</span><div><strong>${escapeHTML(drill.label)}</strong><small>${escapeHTML(drill.fixture)} · ${escapeHTML(drill.surface)}</small></div><em>${drill.critical ? "Critical" : "Standard"}</em></header><p>${escapeHTML(drill.prompt)}</p><ul>${drill.observable.map(value => `<li>${escapeHTML(value)}</li>`).join("")}</ul></article>`).join("") : '<p class="activation-empty">Synthetic drills loading.</p>';
  const returns = workbook?.requiredReturns || [];
  $("#activation-returns").innerHTML = returns.length ? returns.map(item => `<li><span>${escapeHTML(item.index)}</span><div><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.detail)}</p></div><small>OPEN</small></li>`).join("") : "<li>Completion evidence loading.</li>";
  $("#activation-fingerprint").textContent = workbook?.workbookFingerprint ? `WORKBOOK ${workbook.workbookFingerprint.slice(0, 16)}… · CHAIN ${workbook.chain?.count || 0}` : "WORKBOOK — · CHAIN 0";
  $("#activation-snapshot-state").textContent = workbook?.latestSnapshot
    ? `${workbook.latestSnapshot.current ? "Current" : "Stale"} rehearsal snapshot ${String(workbook.latestSnapshot.sequence).padStart(2, "0")} · ${new Date(workbook.latestSnapshot.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
    : "No rehearsal-workbook snapshot has been sealed.";
  $("#activation-boundary").textContent = workbook?.boundary || "A local workbook cannot schedule training, verify attendance or competency, activate a site, or authorize clinical use.";
  $("#seal-provider-activation").disabled = !state.connected;
}

function renderCampusObservatory(observatory = null) {
  state.campusObservatory = observatory;
  const candidates = observatory?.candidates || [];
  const selected = candidates.find(item => item.id === state.campusCandidateId) || candidates[0] || null;
  if (selected) state.campusCandidateId = selected.id;
  const reviewMoments = observatory?.reviewMoments || [];
  const review = reviewMoments.find(item => item.id === state.campusReviewMomentId) || reviewMoments[0] || null;
  if (review) state.campusReviewMomentId = review.id;

  $("#campus-operating-state").textContent = observatory ? "Site data unavailable" : "Workspace disconnected";
  $("#campus-operating-state-detail").textContent = observatory ? "Synthetic rehearsal · no pilot authority" : "Connect the local synthetic workspace";
  $("#campus-candidate-tabs").innerHTML = candidates.length ? candidates.map(candidate => `<button type="button" aria-pressed="${candidate.id === selected?.id}" data-campus-candidate="${escapeHTML(candidate.id)}">${escapeHTML(candidate.index)} · ${escapeHTML(candidate.label.replace(" University", ""))}</button>`).join("") : '<button type="button" aria-pressed="true" disabled>Source pathways unavailable</button>';
  $("#campus-review-tabs").innerHTML = reviewMoments.length ? reviewMoments.map(moment => `<button type="button" aria-pressed="${moment.id === review?.id}" data-campus-review="${escapeHTML(moment.id)}">${escapeHTML(moment.index === "00" ? "00" : moment.id === "quarter-one" ? "Q1" : moment.id === "midyear" ? "MID" : "END")}</button>`).join("") : '<button type="button" aria-pressed="true" disabled>—</button>';

  $("#campus-site-index").textContent = selected ? `PATHWAY ${selected.index}` : "PATHWAY —";
  $("#campus-site-name").textContent = selected?.label || "Source-backed pathway unavailable";
  $("#campus-site-setting").textContent = selected ? `${selected.setting} · ${selected.status.replaceAll("-", " ")}` : "Connect the synthetic workspace.";
  $("#campus-site-scope").textContent = selected?.scope || "No site scope is available.";
  const workingWindow = selected?.workingWindow || "Not available";
  $("#campus-site-window").textContent = selected?.id === "north-central-counseling-center" ? "August–May" : "Not fixed";
  $("#campus-site-window-detail").textContent = workingWindow;

  const counts = observatory?.operatingCounts || {};
  const count = key => Math.max(0, Number(counts[key] || 0));
  $("#campus-eligible-count").textContent = String(count("assessmentsEligible")).padStart(2, "0");
  $("#campus-generated-count").textContent = String(count("summariesGenerated")).padStart(2, "0");
  $("#campus-reviewed-count").textContent = String(count("reviewsDisposed")).padStart(2, "0");
  $("#campus-critical-count").textContent = String(count("criticalRoutesRequired")).padStart(2, "0");
  $("#campus-flow-eligible").textContent = String(count("assessmentsEligible")).padStart(2, "0");
  $("#campus-flow-generated").textContent = String(count("summariesGenerated")).padStart(2, "0");
  $("#campus-flow-reviewed").textContent = String(count("reviewsDisposed")).padStart(2, "0");
  $("#campus-flow-approved").textContent = String(count("summariesApproved")).padStart(2, "0");
  const eligible = Math.max(1, count("assessmentsEligible"));
  $("#campus-flow-generated-bar").style.setProperty("--flow", Math.min(1, count("summariesGenerated") / eligible));
  $("#campus-flow-reviewed-bar").style.setProperty("--flow", Math.min(1, count("reviewsDisposed") / eligible));
  $("#campus-flow-approved-bar").style.setProperty("--flow", Math.min(1, count("summariesApproved") / eligible));
  $("#campus-flow-caption").textContent = observatory ? `${count("summariesGenerated")} of ${count("assessmentsEligible")} synthetic profiles materialized · ${count("reviewsDisposed")} explicit dispositions.` : "Awaiting aggregate evidence.";

  $("#campus-review-index").textContent = review ? `REVIEW ${review.index}` : "REVIEW —";
  $("#campus-review-title").textContent = review?.label || "Review unavailable";
  $("#campus-review-timing").textContent = review?.timing || "No timing available";
  $("#campus-review-question").textContent = review?.question || "Connect the workspace to inspect the bounded review question.";

  const measures = observatory?.measures || [];
  $("#campus-measures").innerHTML = measures.length ? measures.map(measure => {
    const value = measure.percentage == null ? (measure.numerator ? `${measure.numerator} obs` : "—") : `${measure.percentage}%`;
    const denominator = measure.denominator == null ? (measure.numerator ? `n=${measure.numerator}` : "No eligible observation") : `${measure.numerator} / ${measure.denominator}`;
    return `<article data-state="${escapeHTML(measure.state)}"><span>${escapeHTML(measure.index)} · ${escapeHTML(measure.state.replaceAll("-", " "))}</span><strong>${escapeHTML(measure.label)}</strong><div><b>${escapeHTML(value)}</b><small>${escapeHTML(denominator)}</small></div><p>${escapeHTML(measure.guardrail)}</p></article>`;
  }).join("") : '<article data-state="awaiting-evidence"><span>— · Awaiting evidence</span><strong>Measure book unavailable</strong><div><b>—</b><small>No denominator</small></div><p>Connect the synthetic workspace.</p></article>';

  const training = observatory?.training || {};
  const objectives = Math.max(0, Number(training.objectivesDesigned || 0));
  const accepted = Math.max(0, Number(training.acceptedCompletions || 0));
  $("#campus-training-modules").textContent = String(Math.max(0, Number(training.modulesDesigned || 0))).padStart(2, "0");
  $("#campus-training-objectives").textContent = String(objectives).padStart(2, "0");
  $("#campus-training-accepted").textContent = String(accepted).padStart(2, "0");
  $("#campus-training-sites").textContent = String(Math.max(0, Number(training.activatedSites || 0))).padStart(2, "0");
  $("#campus-training-ring").style.strokeDashoffset = String(320.4 * (1 - Math.min(1, objectives ? accepted / objectives : 0)));

  const positions = observatory?.customizationPositions || [];
  if (!positions.some(item => item.id === state.campusCustomizationPositionId)) state.campusCustomizationPositionId = positions[0]?.id || "no-position-recorded";
  $("#campus-customization-options").innerHTML = positions.length ? positions.map(position => `<label><input type="radio" name="customizationPositionId" value="${escapeHTML(position.id)}" ${position.id === state.campusCustomizationPositionId ? "checked" : ""}><span><strong>${escapeHTML(position.label)}</strong><small>${escapeHTML(position.detail)}</small></span></label>`).join("") : '<label><input type="radio" name="customizationPositionId" value="no-position-recorded" checked><span><strong>Decision open</strong><small>Connect the workspace.</small></span></label>';

  const history = observatory?.history || [];
  const candidateMap = new Map(candidates.map(item => [item.id, item]));
  const reviewMap = new Map(reviewMoments.map(item => [item.id, item]));
  const positionMap = new Map(positions.map(item => [item.id, item]));
  $("#campus-history-list").innerHTML = history.length ? [...history].reverse().slice(0, 8).map(event => `<li><span>${String(event.sequence).padStart(2, "0")}</span><div><strong>${escapeHTML(reviewMap.get(event.reviewMomentId)?.label || event.reviewMomentId)} · ${escapeHTML(candidateMap.get(event.candidateId)?.label || event.candidateId)}</strong><small>${escapeHTML(positionMap.get(event.customizationPositionId)?.label || event.customizationPositionId)} · ${escapeHTML(new Date(event.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</small></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`).join("") : '<li><span>—</span><div><strong>No aggregate snapshots yet.</strong><small>A snapshot cannot verify that a quarter or pilot occurred.</small></div></li>';
  $("#campus-snapshot-announcement").textContent = observatory?.latestSnapshot ? `${observatory.latestSnapshot.current ? "Current" : "Stale"} posture ${String(observatory.latestSnapshot.sequence).padStart(2, "0")} · no quarter, site, or pilot claim.` : "No quarterly-review posture has been recorded.";
  $("#campus-observatory-fingerprint").textContent = observatory?.observatoryFingerprint ? `OBSERVATORY ${observatory.observatoryFingerprint.slice(0, 16)}… · CHAIN ${observatory.chain?.count || 0}` : "OBSERVATORY — · CHAIN 0";
  $("#campus-observatory-boundary").textContent = observatory?.boundary || "Aggregate synthetic rehearsal only. No site, quarter, pilot, outcome, production release, or patient use is established.";
  $("#seal-campus-snapshot").disabled = !state.connected;
}

async function loadCampusObservatory(force = false) {
  if (!state.connected) return renderCampusObservatory(null);
  if (state.campusObservatory && !force) return renderCampusObservatory(state.campusObservatory);
  try {
    const { campusObservatory } = await state.api.campusObservatory();
    renderCampusObservatory(campusObservatory);
  } catch (error) {
    renderCampusObservatory(null);
    showToast(error.message);
  }
}

function siteAdmissionStatusLabel(status) {
  return {
    "admission-return-not-received": "Admission return not received",
    "metadata-incomplete": "Metadata needs correction",
    "metadata-complete-unverified": "Complete metadata · unverified",
    "preflight-stale": "Preflight stale · reissue"
  }[status] || "External authorization required";
}

function renderSiteAdmission(portfolio = null) {
  state.siteAdmission = portfolio;
  const dossiers = portfolio?.dossiers || [];
  const counts = portfolio?.counts || { candidateDossiers: 2, admissionQuestions: 12, currentPreflights: 0, pilotsAuthorized: 0, externalReturnsCurrent: 0, activationCompletionsAccepted: 0 };
  const selected = dossiers.find(item => item.candidate.id === state.siteAdmissionCandidateId) || dossiers[0] || null;
  if (selected) state.siteAdmissionCandidateId = selected.candidate.id;
  $("#site-admission-state").textContent = portfolio?.status === "admission-returns-preflighted-unverified" ? "Returns preflighted · unverified" : portfolio ? "Dossiers assembled · authority open" : "External authorization required";
  $("#site-admission-candidate-count").textContent = String(Number(counts.candidateDossiers || 2)).padStart(2, "0");
  $("#site-admission-question-count").textContent = String(Number(counts.admissionQuestions || 12)).padStart(2, "0");
  $("#site-admission-preflight-count").textContent = `${String(Number(counts.currentPreflights || 0)).padStart(2, "0")} / 02`;
  $("#site-admission-authorized-count").textContent = String(Number(counts.pilotsAuthorized || 0)).padStart(2, "0");
  $("#site-admission-candidates").innerHTML = dossiers.length ? dossiers.map(item => `<button class="site-admission-candidate" type="button" data-site-candidate="${escapeHTML(item.candidate.id)}" aria-pressed="${item.candidate.id === selected?.candidate.id}"><span>${escapeHTML(item.candidate.index)}</span><div><strong>${escapeHTML(item.candidate.label)}</strong><small>${escapeHTML(siteAdmissionStatusLabel(item.status))}</small></div></button>`).join("") : '<p class="site-admission-empty">Connect the workspace to assemble candidate dossiers.</p>';
  $("#site-admission-selected-index").textContent = selected ? `${selected.candidate.index} / 02` : "— / 02";
  $("#site-admission-selected-status").textContent = siteAdmissionStatusLabel(selected?.status);
  $("#site-admission-selected-name").textContent = selected?.candidate?.label || "Choose a candidate dossier.";
  $("#site-admission-selected-setting").textContent = selected?.candidate?.setting || "Bounded provider setting";
  $("#site-admission-selected-proposition").textContent = selected?.candidate?.proposition || "The source-reported proposition will appear here.";
  $("#site-admission-selected-population").textContent = selected?.candidate?.population || "No population verified.";
  $("#site-admission-selected-window").textContent = selected?.candidate?.workingWindow || "No date authorized.";
  $("#site-admission-selected-decision").textContent = selected?.candidate?.decisionPath || "Named authority remains external.";
  const dossierLink = $("#site-admission-dossier");
  const templateLink = $("#site-admission-template");
  if (selected) {
    dossierLink.href = `/api/governance/site-admission/${encodeURIComponent(selected.candidate.id)}/dossier.html`;
    templateLink.href = `/api/governance/site-admission/${encodeURIComponent(selected.candidate.id)}/return.json`;
    templateLink.download = `PERL-${selected.candidate.id}-admission-return.json`;
  } else {
    dossierLink.href = "#";
    templateLink.href = "#";
  }
  $("#site-admission-gate-count").textContent = `${String(Number(counts.externalReturnsCurrent || 0)).padStart(2, "0")} / 07 current`;
  $("#site-admission-activation-count").textContent = `${String(Number(counts.activationCompletionsAccepted || 0)).padStart(2, "0")} / ${String(Number(counts.activationReturnsRequired || 10)).padStart(2, "0")} accepted`;
  const gates = selected?.externalGates || [];
  $("#site-admission-gates").innerHTML = gates.length ? gates.map(gate => `<li><span>${escapeHTML(gate.index)}</span><div><strong>${escapeHTML(gate.label)}</strong><small>${escapeHTML(siteAdmissionStatusLabel(gate.status))}</small></div><em>OPEN</em></li>`).join("") : "<li>External decisions loading.</li>";
  const books = selected?.books || [];
  const questions = selected?.questions || [];
  $("#site-admission-books").innerHTML = books.length ? books.map(book => `<article class="site-admission-book"><header><span>${escapeHTML(book.index)}</span><div><h4>${escapeHTML(book.label)}</h4><p>${escapeHTML(book.thesis)}</p></div></header><ol>${questions.filter(item => item.bookId === book.id).map(item => `<li><span>${escapeHTML(item.index)}</span><div><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.prompt)}</p><code>${escapeHTML(item.id)}</code></div></li>`).join("")}</ol></article>`).join("") : '<p class="site-admission-empty">Admission books loading.</p>';
  const history = portfolio?.history || [];
  const dossierById = new Map(dossiers.map(item => [item.candidate.id, item]));
  $("#site-admission-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "entry" : "entries"}`;
  $("#site-admission-history-list").innerHTML = history.length ? [...history].reverse().map(event => `<li><div><span>${escapeHTML(event.decisionPreview.replaceAll("-", " "))} · unverified</span><time datetime="${escapeHTML(event.createdAt)}">${escapeHTML(dossierById.get(event.candidateId)?.candidate?.label || event.candidateId)} · ${escapeHTML(new Date(event.createdAt).toLocaleString())}</time></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`).join("") : "<li>No site-admission metadata has been preflighted.</li>";
  $("#site-admission-fingerprint").textContent = portfolio?.portfolioFingerprint ? `PORTFOLIO ${portfolio.portfolioFingerprint.slice(0, 16)}… · CHAIN ${portfolio.chain?.count || 0}` : "PORTFOLIO — · CHAIN 0";
  $("#site-admission-boundary").textContent = portfolio?.boundary || "A complete local return cannot verify a site, identity, evidence, signature, authority, agreement, date window, activation, or pilot authorization.";
  $("#preflight-site-admission").disabled = !state.connected || !state.siteAdmissionReturnManifest;
}

function authorityTrustStatusLabel(status) {
  return {
    "trust-root-required": "Trust root required",
    "challenge-required": "Challenge required",
    "signed-receipts-required": "Signed receipts required",
    "verification-in-progress": "Verification in progress",
    "decision-blocked": "Decision blocked",
    "bounded-pilot-authorization-recorded": "Bounded authority recorded"
  }[status] || "External trust required";
}

function authorityScopeStatusLabel(status) {
  return {
    "not-returned": "Open",
    verified: "Verified",
    accepted: "Accepted",
    rejected: "Rejected",
    declined: "Declined",
    revoked: "Revoked"
  }[status] || String(status || "open").replaceAll("-", " ");
}

function renderAuthorityTrust(bridge = null) {
  state.authorityTrust = bridge;
  const candidates = bridge?.candidates || [];
  const registry = bridge?.registry || { registryId: "FF-TRUST-REGISTRY-DISABLED", registryCurrent: false, activeKeyCount: 0, trustedKeys: [] };
  const counts = bridge?.counts || { trustedKeys: 0, verifiedReceipts: 0, candidatesWithPilotAuthorization: 0 };
  const selected = candidates.find(item => item.candidate.id === state.authorityTrustCandidateId) || candidates[0] || null;
  if (selected) state.authorityTrustCandidateId = selected.candidate.id;
  $("#authority-trust-state").textContent = registry.registryCurrent ? (counts.verifiedReceipts ? "Governed verification in progress" : "Trust registry ready") : "External trust registry required";
  $(".authority-trust-sigil strong").textContent = String(Number(counts.activeKeys || 0)).padStart(2, "0");
  $("#authority-trust-key-count").textContent = String(Number(counts.trustedKeys || 0)).padStart(2, "0");
  $("#authority-trust-receipt-count").textContent = String(Number(counts.verifiedReceipts || 0)).padStart(2, "0");
  $("#authority-trust-gate-count").textContent = `${String(Number(selected?.counts?.acceptedGates || 0)).padStart(2, "0")} / 07`;
  $("#authority-trust-pilot-count").textContent = String(Number(counts.candidatesWithPilotAuthorization || 0)).padStart(2, "0");
  $("#authority-trust-registry-id").textContent = registry.registryId?.replace("FF-TRUST-REGISTRY-", "") || "DISABLED";
  const keys = registry.trustedKeys || [];
  $("#authority-trust-keys").innerHTML = keys.length ? keys.map(key => `<li><div><strong>${escapeHTML(key.keyId)}</strong><span>${key.active ? "Current startup key" : "Outside validity window"} · ${escapeHTML(key.scopeCount)} scopes · ${escapeHTML(key.candidateCount)} candidates</span></div><code>${escapeHTML(key.publicKeyFingerprint.slice(0, 12))}…</code></li>`).join("") : "<li>No startup trust keys are provisioned. The registry can be supplied only as an owner-only file when the server starts.</li>";
  $("#authority-trust-candidates").innerHTML = candidates.length ? candidates.map(item => `<button class="authority-trust-candidate" type="button" data-authority-trust-candidate="${escapeHTML(item.candidate.id)}" aria-pressed="${item.candidate.id === selected?.candidate.id}"><span>${escapeHTML(item.candidate.index)}</span><div><strong>${escapeHTML(item.candidate.label)}</strong><small>${escapeHTML(authorityTrustStatusLabel(item.status))}</small></div></button>`).join("") : "<p>Connect the workspace to inspect candidate trust state.</p>";
  $("#authority-trust-selected-index").textContent = selected ? `${selected.candidate.index} / 02` : "— / 02";
  $("#authority-trust-selected-state").textContent = authorityTrustStatusLabel(selected?.status);
  $("#authority-trust-selected-name").textContent = selected?.candidate?.label || "Choose a named-site candidate.";
  $("#authority-trust-selected-setting").textContent = selected ? `${selected.candidate.setting} · ${selected.counts.satisfiedScopes} / ${selected.counts.requiredScopes} scopes satisfied.` : "The current candidate dossier will be bound here.";
  const issueButton = $("#issue-authority-trust-challenge");
  issueButton.disabled = !state.connected || !registry.registryCurrent || !registry.activeKeyCount || !selected;
  const challengeLink = $("#authority-trust-challenge-download");
  if (selected?.activeChallenge) {
    challengeLink.hidden = false;
    challengeLink.href = `/api/governance/authority-trust/challenges/${encodeURIComponent(selected.activeChallenge.challengeId)}.json`;
    challengeLink.download = `PERL-${selected.candidate.id}-authority-challenge.json`;
    $("#authority-trust-challenge-state").className = "authority-trust-action-state ready";
    $("#authority-trust-challenge-state").textContent = `Current challenge · expires ${new Date(selected.activeChallenge.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${selected.activeChallenge.requiredScopes.length} scopes.`;
  } else {
    challengeLink.hidden = true;
    challengeLink.href = "#";
    $("#authority-trust-challenge-state").className = "authority-trust-action-state";
    $("#authority-trust-challenge-state").textContent = registry.registryCurrent ? "Issue a fresh 24-hour candidate-bound challenge." : "Provision a current startup trust key before issuing a challenge.";
  }
  const groups = selected?.groups || bridge?.scopeGroups?.map(group => ({ ...group, satisfied: 0, required: group.items.length, items: group.items.map(item => ({ ...item, status: "not-returned", satisfied: false })) })) || [];
  $("#authority-trust-scopes").innerHTML = groups.length ? groups.map(group => `<article class="authority-trust-scope-group"><header><span>${escapeHTML(group.index)}</span><div><h4>${escapeHTML(group.label)}</h4><p>${escapeHTML(group.thesis)}</p></div></header><div><strong>${String(Number(group.satisfied || 0)).padStart(2, "0")} / ${String(Number(group.required || group.items.length)).padStart(2, "0")}</strong><span>${group.satisfied === group.required ? "Satisfied" : "Governed returns"}</span></div><ol>${group.items.map(item => `<li class="${item.satisfied ? "satisfied" : ["rejected", "declined", "revoked"].includes(item.status) ? "blocked" : ""}"><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.scope)}</small></div><em>${escapeHTML(authorityScopeStatusLabel(item.status))}</em></li>`).join("")}</ol></article>`).join("") : "<p>Trust scopes loading.</p>";
  const history = bridge?.history || [];
  $("#authority-trust-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "event" : "events"}`;
  $("#authority-trust-history-list").innerHTML = history.length ? [...history].reverse().slice(0, 12).map(event => {
    const candidateId = event.eventType === "challenge-issued" ? event.challenge.candidateId : event.receipt.candidateId;
    const candidate = candidates.find(item => item.candidate.id === candidateId)?.candidate?.label || candidateId;
    const label = event.eventType === "challenge-issued" ? "Challenge issued" : `${event.assertionCount} signed scope${event.assertionCount === 1 ? "" : "s"} verified`;
    return `<li><div><strong>${escapeHTML(label)}</strong><span>${escapeHTML(candidate)} · ${escapeHTML(new Date(event.createdAt).toLocaleString())}</span></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`;
  }).join("") : "<li>No challenge or verified receipt has been recorded.</li>";
  $("#authority-trust-fingerprint").textContent = bridge?.bridgeFingerprint ? `BRIDGE ${bridge.bridgeFingerprint.slice(0, 16)}… · CHAIN ${bridge.chain?.count || 0}` : "BRIDGE — · CHAIN 0";
  $("#authority-trust-boundary").textContent = bridge?.boundary || "A verified authorization receipt may record external authority. It still cannot start a pilot, activate a provider, release production, authorize patient use, or make a care decision.";
  $("#verify-authority-trust-receipt").disabled = !state.connected || !state.authorityTrustReceipt;
}

function pilotStartStatusLabel(status) {
  return {
    "authority-seal-required": "Authority seal required",
    "continuity-evidence-required": "Continuity evidence required",
    "start-keys-required": "Two start keys required",
    "start-challenge-required": "Ready for bounded challenge",
    "start-order-required": "Signed start order required",
    "deployment-acknowledgement-required": "Deployment acknowledgement required",
    "provider-preparation-started": "Provider preparation started"
  }[status] || "Start interlock blocked";
}

function renderPilotStart(control = null) {
  state.pilotStart = control;
  const candidates = control?.candidates || [];
  const registry = control?.registry || { registryId: "FF-START-REGISTRY-DISABLED", registryCurrent: false, trustedKeys: [], activeOrderKeyCount: 0, activeAcknowledgementKeyCount: 0 };
  const counts = control?.counts || { providerPreparationStarts: 0 };
  const selected = candidates.find(item => item.candidate.id === state.pilotStartCandidateId) || candidates[0] || null;
  if (selected) state.pilotStartCandidateId = selected.candidate.id;
  $("#pilot-start-state").textContent = control?.status === "provider-preparation-started" ? "Pre-use environment observed" : registry.registryCurrent ? "Interlock armed · start held" : "Start interlock disabled";
  $("#pilot-start-authority-count").textContent = `${String(Number(selected?.authorityScopesSatisfied || 0)).padStart(2, "0")} / 36`;
  $("#pilot-start-order-key-count").textContent = String(Number(selected?.counts?.activeOrderKeys || 0)).padStart(2, "0");
  $("#pilot-start-ack-key-count").textContent = String(Number(selected?.counts?.activeAcknowledgementKeys || 0)).padStart(2, "0");
  $("#pilot-start-started-count").textContent = String(Number(counts.providerPreparationStarts || 0)).padStart(2, "0");
  $("#pilot-start-registry-id").textContent = registry.registryId?.replace("FF-START-REGISTRY-", "") || "DISABLED";
  $("#pilot-start-candidates").innerHTML = candidates.length ? candidates.map(item => `<button class="pilot-start-candidate" type="button" data-pilot-start-candidate="${escapeHTML(item.candidate.id)}" aria-pressed="${item.candidate.id === selected?.candidate.id}"><span>${escapeHTML(item.candidate.index)}</span><div><strong>${escapeHTML(item.candidate.label)}</strong><small>${escapeHTML(pilotStartStatusLabel(item.status))}</small></div></button>`).join("") : "<p>Connect the workspace to inspect the deployment interlock.</p>";
  $("#pilot-start-selected-index").textContent = selected ? `${selected.candidate.index} / 02` : "— / 02";
  $("#pilot-start-selected-state").textContent = pilotStartStatusLabel(selected?.status);
  $("#pilot-start-selected-name").textContent = selected?.candidate?.label || "Choose a named-site candidate.";
  $("#pilot-start-selected-detail").textContent = selected ? `${selected.authorityScopesSatisfied} of 36 authority scopes · ${control.continuity.items.filter(item => item.current).length} of 4 continuity proofs · ${selected.separationReady ? "two duties separated" : "two distinct duties required"}.` : "Thirty-six governed scopes and four current continuity proofs must converge before a start challenge exists.";
  const prerequisiteRows = selected ? [
    { label: "Bounded authority", detail: `${selected.authorityScopesSatisfied} / 36 exact scopes`, ready: selected.authoritySealCurrent },
    { label: "Continuity evidence", detail: `${control.continuity.items.filter(item => item.current).length} / 4 current`, ready: selected.continuityCurrent },
    { label: "Start-order duty", detail: `${selected.counts.activeOrderKeys} current key${selected.counts.activeOrderKeys === 1 ? "" : "s"}`, ready: selected.counts.activeOrderKeys > 0 },
    { label: "Deployment observer", detail: `${selected.counts.activeAcknowledgementKeys} distinct key${selected.counts.activeAcknowledgementKeys === 1 ? "" : "s"}`, ready: selected.separationReady }
  ] : [];
  $("#pilot-start-prerequisites").innerHTML = prerequisiteRows.length ? prerequisiteRows.map((item, index) => `<li class="${item.ready ? "ready" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.detail)}</small></div><em>${item.ready ? "CURRENT" : "OPEN"}</em></li>`).join("") : "<li><span>—</span><div><strong>Evidence loading</strong><small>Connect the workspace</small></div><em>OPEN</em></li>";
  const keys = registry.trustedKeys || [];
  $("#pilot-start-keys").innerHTML = keys.length ? keys.map(key => `<li><div><strong>${escapeHTML(key.keyId)}</strong><span>${escapeHTML(key.purpose.replaceAll("-", " "))} · ${key.active ? "current" : "outside window"}</span></div><code>${escapeHTML(key.publicKeyFingerprint.slice(0, 12))}…</code></li>`).join("") : "<li>No pilot-start keys are provisioned. Supply the owner-only registry only when the server starts.</li>";
  const challengeLink = $("#pilot-start-challenge-download");
  if (selected?.activeChallenge) {
    challengeLink.hidden = false;
    challengeLink.href = `/api/governance/pilot-start/challenges/${encodeURIComponent(selected.activeChallenge.challengeId)}.json`;
    challengeLink.download = `PERL-${selected.candidate.id}-pilot-start-challenge.json`;
    $("#pilot-start-challenge-state").className = "pilot-start-action-state ready";
    $("#pilot-start-challenge-state").textContent = `Challenge current until ${new Date(selected.activeChallenge.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · provider preparation only.`;
  } else {
    challengeLink.hidden = true;
    challengeLink.href = "#";
    $("#pilot-start-challenge-state").className = "pilot-start-action-state";
    $("#pilot-start-challenge-state").textContent = selected ? pilotStartStatusLabel(selected.status) : "Distinct startup keys and a current authority seal are required.";
  }
  $("#issue-pilot-start-challenge").disabled = !state.connected || selected?.status !== "start-challenge-required";
  $("#verify-pilot-start-order").disabled = !state.connected || !state.pilotStartOrder;
  $("#verify-pilot-start-ack").disabled = !state.connected || !state.pilotStartAcknowledgement;
  const history = control?.history || [];
  $("#pilot-start-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "event" : "events"}`;
  $("#pilot-start-history-list").innerHTML = history.length ? [...history].reverse().slice(0, 12).map(event => {
    const payload = event.challenge || event.order || event.acknowledgement;
    const candidate = candidates.find(item => item.candidate.id === payload.candidateId)?.candidate?.label || payload.candidateId;
    const label = event.eventType === "challenge-issued" ? "15-minute challenge issued" : event.eventType === "start-order-verified" ? "Start order verified" : "Deployment start acknowledged";
    return `<li><div><strong>${escapeHTML(label)}</strong><span>${escapeHTML(candidate)} · ${escapeHTML(new Date(event.createdAt).toLocaleString())}</span></div><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`;
  }).join("") : "<li>No challenge, order, or deployment acknowledgement has been recorded.</li>";
  $("#pilot-start-fingerprint").textContent = control?.controlFingerprint ? `INTERLOCK ${control.controlFingerprint.slice(0, 16)}… · CHAIN ${control.chain?.count || 0}` : "INTERLOCK — · CHAIN 0";
  $("#pilot-start-boundary").textContent = control?.boundary || "A verified deployment acknowledgement can open only provider preparation. It cannot start a live clinical pilot, enable clinical traffic, authorize patient use, or release production.";
}

function clinicalReleaseStatusLabel(status) {
  return {
    "provider-preparation-required": "Provider preparation required",
    "release-authority-required": "Three release duties required",
    "release-challenge-required": "Ready for release challenge",
    "clinical-use-authorization-required": "Clinical-use authorization required",
    "production-release-authorization-required": "Production authorization required",
    "deployment-attestation-required": "Deployment attestation required",
    "release-ready-traffic-off": "Release ready · traffic off"
  }[status] || "Clinical release blocked";
}

function renderClinicalRelease(gate = null) {
  state.clinicalRelease = gate;
  const candidates = gate?.candidates || [];
  const registry = gate?.registry || { registryId: "FF-RELEASE-REGISTRY-DISABLED", registryCurrent: false, trustedKeys: [], activePurposeCounts: {} };
  const counts = gate?.counts || { clinicalAuthorizations: 0, productionAuthorizations: 0, releasesReady: 0 };
  const selected = candidates.find(item => item.candidate.id === state.clinicalReleaseCandidateId) || candidates[0] || null;
  if (selected) state.clinicalReleaseCandidateId = selected.candidate.id;
  $("#clinical-release-state").textContent = gate?.status === "release-ready-traffic-off" ? "Release ready · traffic off" : registry.registryCurrent ? "Release gate armed" : "Release registry disabled";
  $("#clinical-release-preparation-count").textContent = String(candidates.filter(item => item.providerPreparationStarted).length).padStart(2, "0");
  $("#clinical-release-clinical-count").textContent = String(Number(counts.clinicalAuthorizations || 0)).padStart(2, "0");
  $("#clinical-release-production-count").textContent = String(Number(counts.productionAuthorizations || 0)).padStart(2, "0");
  $("#clinical-release-ready-count").textContent = String(Number(counts.releasesReady || 0)).padStart(2, "0");
  $("#clinical-release-registry-id").textContent = registry.registryId?.replace("FF-RELEASE-REGISTRY-", "") || "DISABLED";
  $("#clinical-release-candidates").innerHTML = candidates.length ? candidates.map(item => `<button type="button" data-clinical-release-candidate="${escapeHTML(item.candidate.id)}" aria-pressed="${item.candidate.id === selected?.candidate.id}"><strong>${escapeHTML(item.candidate.index)} · ${escapeHTML(item.candidate.label)}</strong><small>${escapeHTML(clinicalReleaseStatusLabel(item.status))}</small></button>`).join("") : "<p>Connect the workspace to inspect clinical-release authority.</p>";
  $("#clinical-release-selected-index").textContent = selected ? `${selected.candidate.index} / 02` : "— / 02";
  $("#clinical-release-selected-state").textContent = clinicalReleaseStatusLabel(selected?.status);
  $("#clinical-release-selected-name").textContent = selected?.candidate?.label || "Choose a named-site candidate.";
  $("#clinical-release-selected-detail").textContent = selected ? `${selected.providerPreparationStarted ? "provider preparation acknowledged" : "provider preparation open"} · ${selected.separationReady ? "three duties separated" : "three distinct duties required"} · ${selected.releaseReadyForTrafficActivation ? "release evidence complete, traffic off" : "release evidence incomplete"}.` : "A current provider-preparation acknowledgement and three separated release duties must converge before a challenge exists.";
  const purposeCounts = registry.activePurposeCounts || {};
  const prerequisites = selected ? [
    { label: "Provider preparation", detail: selected.providerPreparationStarted ? "Exact acknowledgement current" : "Acknowledgement required", ready: selected.providerPreparationStarted },
    { label: "Clinical-use authority", detail: `${purposeCounts["clinical-use-authorization"] || 0} current duty key`, ready: (purposeCounts["clinical-use-authorization"] || 0) > 0 },
    { label: "Production authority", detail: `${purposeCounts["production-release-authorization"] || 0} current duty key`, ready: (purposeCounts["production-release-authorization"] || 0) > 0 },
    { label: "Deployment attestation", detail: selected.separationReady ? "Third distinct duty ready" : "Distinct attestation key required", ready: selected.separationReady }
  ] : [];
  $("#clinical-release-prerequisites").innerHTML = prerequisites.length ? prerequisites.map((item, index) => `<li data-ready="${item.ready}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.detail)}</small></div><em>${item.ready ? "CURRENT" : "OPEN"}</em></li>`).join("") : "<li><span>—</span><div><strong>Evidence loading</strong><small>Connect the workspace</small></div><em>OPEN</em></li>";
  const keys = registry.trustedKeys || [];
  $("#clinical-release-keys").innerHTML = keys.length ? keys.map(key => `<li><strong>${escapeHTML(key.keyId)}</strong><br><span>${escapeHTML(key.purpose.replaceAll("-", " "))} · ${key.active ? "current" : "outside window"}</span> · <code>${escapeHTML(key.publicKeyFingerprint.slice(0, 12))}…</code></li>`).join("") : "<li>No clinical-release keys are provisioned. Supply the owner-only registry only when the server starts.</li>";
  const challengeLink = $("#clinical-release-challenge-download");
  if (selected?.activeChallenge) {
    challengeLink.hidden = false;
    challengeLink.href = `/api/governance/clinical-release/challenges/${encodeURIComponent(selected.activeChallenge.challengeId)}.json`;
    challengeLink.download = `PERL-${selected.candidate.id}-clinical-release-challenge.json`;
    $("#clinical-release-challenge-state").className = "clinical-release-action-state ready";
    $("#clinical-release-challenge-state").textContent = `Challenge current until ${new Date(selected.activeChallenge.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · release authority only, traffic off.`;
  } else {
    challengeLink.hidden = true;
    challengeLink.href = "#";
    $("#clinical-release-challenge-state").className = "clinical-release-action-state";
    $("#clinical-release-challenge-state").textContent = selected ? clinicalReleaseStatusLabel(selected.status) : "A current preparation proof and three startup keys are required.";
  }
  $("#issue-clinical-release-challenge").disabled = !state.connected || selected?.status !== "release-challenge-required";
  $("#verify-clinical-release-clinical").disabled = !state.connected || !state.clinicalReleaseClinicalAuthorization;
  $("#verify-clinical-release-production").disabled = !state.connected || !state.clinicalReleaseProductionAuthorization;
  $("#verify-clinical-release-attestation").disabled = !state.connected || !state.clinicalReleaseDeploymentAttestation;
  const history = gate?.history || [];
  $("#clinical-release-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "event" : "events"}`;
  $("#clinical-release-history-list").innerHTML = history.length ? [...history].reverse().slice(0, 12).map(event => {
    const payload = event.challenge || event.clinicalAuthorization || event.productionAuthorization || event.deploymentAttestation;
    const candidate = candidates.find(item => item.candidate.id === payload.candidateId)?.candidate?.label || payload.candidateId;
    const label = event.eventType === "release-challenge-issued" ? "20-minute challenge issued" : event.eventType === "clinical-use-authorized" ? "Clinical use authorized" : event.eventType === "production-release-authorized" ? "Production release authorized" : "Deployment conformance attested";
    return `<li><strong>${escapeHTML(label)}</strong><br><span>${escapeHTML(candidate)} · ${escapeHTML(new Date(event.createdAt).toLocaleString())}</span><br><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`;
  }).join("") : "<li>No challenge, authorization, or deployment attestation has been recorded.</li>";
  $("#clinical-release-fingerprint").textContent = gate?.gateFingerprint ? `RELEASE ${gate.gateFingerprint.slice(0, 16)}… · CHAIN ${gate.chain?.count || 0}` : "RELEASE — · CHAIN 0";
  $("#clinical-release-boundary").textContent = gate?.boundary || "All three verified duties can record release readiness. They cannot enable clinical traffic, start the live pilot, process a patient record, or make a care decision.";
}

function trafficActivationStatusLabel(status) {
  return {
    "clinical-release-required": "Three-seal release required",
    "traffic-witness-registry-required": "Three witness duties required",
    "traffic-activation-challenge-required": "Ready for witness challenge",
    "clinical-activation-concurrence-required": "Clinical concurrence required",
    "operations-activation-concurrence-required": "Operations concurrence required",
    "first-transaction-attestation-required": "First transaction witness required",
    "activation-window-expired": "Activation window expired",
    "first-governed-transaction-verified": "First governed transaction verified"
  }[status] || "Traffic witness blocked";
}

function renderIdentityAccess(perimeter = null) {
  state.identityAccess = perimeter;
  const runtime = perimeter?.runtime || {};
  const roles = perimeter?.roles || runtime.roles || [];
  const history = perimeter?.history || [];
  const chain = perimeter?.chain || { valid: true, count: 0, head: null };
  const external = runtime.mode === "external-eddsa-assertion";
  const current = runtime.policyCurrent === true;
  const activeKeys = Number(runtime.activeKeyCount || 0);
  const sessionMinutes = Math.round(Number(runtime.maximumSessionSeconds || 900) / 60);

  $("#identity-access-state").textContent = external
    ? (current && activeKeys > 0 ? "Assertion perimeter armed" : "Policy outside trust window")
    : "Synthetic identity only";
  $("#identity-access-state").dataset.state = external && current && activeKeys > 0 ? "armed" : "sandbox";
  $("#identity-access-mode").textContent = external ? "SIGNED" : "DEMO";
  $("#identity-access-policy").textContent = external ? `${runtime.version || "—"} / CURRENT ${current ? "YES" : "NO"}` : "NOT PROVISIONED";
  $("#identity-access-keys").textContent = String(activeKeys).padStart(2, "0");
  $("#identity-access-session").textContent = `${String(sessionMinutes).padStart(2, "0")} MIN`;
  $("#identity-access-role-count").textContent = String(roles.length).padStart(2, "0");
  $("#identity-access-policy-id").textContent = runtime.policyId || "FF-IDENTITY-POLICY-DISABLED";
  $("#identity-access-issuer").textContent = runtime.issuerFingerprint ? `${runtime.issuerFingerprint.slice(0, 16)}…` : "NO EXTERNAL ISSUER";
  $("#identity-access-policy-fingerprint").textContent = runtime.policyFingerprint ? `${runtime.policyFingerprint.slice(0, 20)}…` : "DISABLED";

  $("#identity-access-role-book").innerHTML = roles.length ? roles.map((role, index) => `
    <article>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><h4>${escapeHTML(role.label)}</h4><code>${escapeHTML(role.id)}</code></div>
      <ul>${role.permissions.map(permission => `<li>${escapeHTML(permission.replace(":", " / "))}</li>`).join("")}</ul>
    </article>`).join("") : '<p class="identity-perimeter-empty">Connect the workspace to inspect the fixed role book.</p>';

  $("#identity-access-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "DECISION" : "DECISIONS"}`;
  $("#identity-access-history").innerHTML = history.length ? [...history].reverse().slice(0, 12).map(event => `
    <li>
      <span>${String(event.sequence).padStart(2, "0")}</span>
      <div><strong>${escapeHTML(event.actorRef)}</strong><small>${escapeHTML(event.method)} · ${escapeHTML(event.routeClass)} · ${escapeHTML(event.permission)}</small></div>
      <code>${escapeHTML(event.hash.slice(0, 12))}…</code>
    </li>`).join("") : "<li class=\"identity-perimeter-empty\">No externally authenticated mutation has been granted.</li>";
  $("#identity-access-chain").textContent = chain.valid === false ? `CHAIN FAILED / EVENT ${chain.failedAt || "—"}` : `CHAIN VERIFIED / ${String(chain.count || 0).padStart(2, "0")}`;
  $("#identity-access-chain").dataset.state = chain.valid === false ? "failed" : "valid";
  $("#identity-access-fingerprint").textContent = chain.head ? `ACCESS ${chain.head.slice(0, 18)}…` : "ACCESS GENESIS";
  $("#identity-access-boundary").textContent = perimeter?.boundary || runtime.boundary || "Identity begins outside this screen. PERL does not issue tokens, collect passwords, verify licensure, authorize PHI, or replace production SSO and e-QPASS RBAC.";
}

function renderTrafficActivation(witness = null) {
  state.trafficActivation = witness;
  const candidates = witness?.candidates || [];
  const registry = witness?.registry || { registryId: "FF-TRAFFIC-REGISTRY-DISABLED", registryCurrent: false, trustedKeys: [], activePurposeCounts: {} };
  const selected = candidates.find(item => item.candidate.id === state.trafficActivationCandidateId) || candidates[0] || null;
  if (selected) state.trafficActivationCandidateId = selected.candidate.id;
  $("#traffic-activation-state").textContent = witness?.status === "first-governed-transaction-verified" ? "First transaction verified" : registry.registryCurrent ? "Witness armed · no switch" : "Witness registry disabled";
  $("#traffic-activation-release-count").textContent = String(candidates.filter(item => item.releaseReadyForTrafficActivation).length).padStart(2, "0");
  $("#traffic-activation-concurrence-count").textContent = String(candidates.filter(item => item.clinicalActivationConcurrenceVerified && item.operationsActivationConcurrenceVerified).length).padStart(2, "0");
  $("#traffic-activation-window-count").textContent = String(candidates.filter(item => item.activationWindowCurrent).length).padStart(2, "0");
  $("#traffic-activation-transaction-count").textContent = String(candidates.filter(item => item.firstGovernedTransactionVerified).length).padStart(2, "0");
  $("#traffic-activation-registry-id").textContent = registry.registryId?.replace("FF-TRAFFIC-REGISTRY-", "") || "DISABLED";
  $("#traffic-activation-candidates").innerHTML = candidates.length ? candidates.map(item => `<button type="button" data-traffic-activation-candidate="${escapeHTML(item.candidate.id)}" aria-pressed="${item.candidate.id === selected?.candidate.id}"><strong>${escapeHTML(item.candidate.index)} · ${escapeHTML(item.candidate.label)}</strong><small>${escapeHTML(trafficActivationStatusLabel(item.status))}</small></button>`).join("") : "<p>Connect the workspace to inspect external activation evidence.</p>";
  $("#traffic-activation-selected-index").textContent = selected ? `${selected.candidate.index} / 02` : "— / 02";
  $("#traffic-activation-selected-state").textContent = trafficActivationStatusLabel(selected?.status);
  $("#traffic-activation-selected-name").textContent = selected?.candidate?.label || "Choose a release-ready candidate.";
  $("#traffic-activation-selected-detail").textContent = selected ? `${selected.releaseReadyForTrafficActivation ? "three-seal release current" : "release evidence incomplete"} · ${selected.separationReady ? "three witness duties separated" : "three distinct witness duties required"} · ${selected.firstGovernedTransactionVerified ? "first external transaction witnessed" : "no first-transaction witness"}. PERL sandbox traffic remains off.` : "No activation evidence may exist until the exact three-seal release proof and all continuity evidence are current.";
  const prerequisites = selected ? [
    { label: "Release proof", detail: selected.releaseReadyForTrafficActivation ? "Three-seal release ready · traffic off" : "Release evidence required", ready: selected.releaseReadyForTrafficActivation },
    { label: "Continuity", detail: witness?.continuity?.allCurrent ? "Restore through response current" : "Continuity evidence required", ready: witness?.continuity?.allCurrent === true },
    { label: "Duty separation", detail: selected.separationReady ? "Clinical, operations, and observer keys distinct" : "Three distinct startup keys required", ready: selected.separationReady }
  ] : [];
  $("#traffic-activation-prerequisites").innerHTML = prerequisites.length ? prerequisites.map((item, index) => `<li data-ready="${item.ready}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.detail)}</small></div><em>${item.ready ? "CURRENT" : "OPEN"}</em></li>`).join("") : "<li data-ready=\"false\"><span>—</span><div><strong>Evidence loading</strong><small>Connect the workspace</small></div><em>OPEN</em></li>";
  const keys = registry.trustedKeys || [];
  $("#traffic-activation-keys").innerHTML = keys.length ? keys.map(key => `<li><strong>${escapeHTML(key.keyId)}</strong><br><span>${escapeHTML(key.purpose.replaceAll("-", " "))} · ${key.active ? "current" : "outside window"}</span> · <code>${escapeHTML(key.publicKeyFingerprint.slice(0, 12))}…</code></li>`).join("") : "<li>No traffic-witness keys are provisioned. Supply the owner-only registry only when the server starts.</li>";
  const challengeLink = $("#traffic-activation-challenge-download");
  if (selected?.activeChallenge) {
    challengeLink.hidden = false;
    challengeLink.href = `/api/governance/traffic-activation/challenges/${encodeURIComponent(selected.activeChallenge.challengeId)}.json`;
    challengeLink.download = `PERL-${selected.candidate.id}-traffic-activation-challenge.json`;
    $("#traffic-activation-challenge-state").className = "traffic-witness-action-state ready";
    $("#traffic-activation-challenge-state").textContent = `Challenge current until ${new Date(selected.activeChallenge.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · external switch witness only.`;
  } else {
    challengeLink.hidden = true;
    challengeLink.href = "#";
    $("#traffic-activation-challenge-state").className = "traffic-witness-action-state";
    $("#traffic-activation-challenge-state").textContent = selected ? trafficActivationStatusLabel(selected.status) : "A release-ready candidate and three startup duties are required.";
  }
  $("#issue-traffic-activation-challenge").disabled = !state.connected || selected?.status !== "traffic-activation-challenge-required";
  $("#verify-traffic-activation-clinical").disabled = !state.connected || !state.trafficActivationClinicalAuthorization;
  $("#verify-traffic-activation-operations").disabled = !state.connected || !state.trafficActivationOperationsAuthorization;
  $("#verify-traffic-activation-transaction").disabled = !state.connected || !state.trafficActivationTransactionAttestation;
  const history = witness?.history || [];
  $("#traffic-activation-history-count").textContent = `${String(history.length).padStart(2, "0")} ${history.length === 1 ? "event" : "events"}`;
  $("#traffic-activation-history").innerHTML = history.length ? [...history].reverse().slice(0, 12).map(event => {
    const payload = event.challenge || event.authorization || event.attestation;
    const candidate = candidates.find(item => item.candidate.id === payload.candidateId)?.candidate?.label || payload.candidateId;
    const label = event.eventType === "traffic-activation-challenge-issued" ? "15-minute witness challenge" : event.eventType === "traffic-activation-clinical-authorized" ? "Clinical activation concurrence" : event.eventType === "traffic-activation-operations-authorized" ? "Operations activation concurrence" : "First governed transaction witnessed";
    return `<li><strong>${escapeHTML(label)}</strong><br><span>${escapeHTML(candidate)} · ${escapeHTML(new Date(event.createdAt).toLocaleString())}</span><br><code>${escapeHTML(event.hash.slice(0, 12))}…</code></li>`;
  }).join("") : "<li>No challenge, concurrence, or first-transaction witness has been recorded.</li>";
  $("#traffic-activation-fingerprint").textContent = witness?.witnessFingerprint ? `WITNESS ${witness.witnessFingerprint.slice(0, 16)}… · CHAIN ${witness.chain?.count || 0}` : "WITNESS — · CHAIN 0";
  $("#traffic-activation-boundary").textContent = witness?.boundary || "This workspace can verify signed external metadata. It cannot configure an endpoint, enable traffic, receive a record, store PHI, or operate the authoritative production audit.";
}

function renderPilotReadiness(readiness = null) {
  state.pilotReadiness = readiness;
  const current = readiness?.current || null;
  const counts = current?.gateCounts || { localCurrent: 0, localRequired: 7, externalDecisionRequired: 7, total: 14 };
  const authorityCounts = current?.authorityCounts || { confirmed: 1, provisional: 1, unassigned: 8, total: 10 };
  const gates = current?.gates || [];
  const localGates = gates.filter(gate => gate.category === "local-pattern");
  const externalGates = gates.filter(gate => gate.category === "external-authority");
  const lastEvent = readiness?.lastEvent || null;
  $("#permission-state-chip").textContent = "Pilot blocked";
  $("#permission-local-count").textContent = `${String(counts.localCurrent).padStart(2, "0")} / 07`;
  $("#permission-external-count").textContent = `${String(7 - counts.externalDecisionRequired).padStart(2, "0")} / 07`;
  $("#permission-authority-count").textContent = `${String(authorityCounts.confirmed).padStart(2, "0")} / ${String(authorityCounts.total).padStart(2, "0")}`;
  $("#permission-decision").textContent = "Blocked";
  const gateMarkup = gate => `<article class="permission-gate" data-state="${escapeHTML(gate.status)}">
    <i aria-hidden="true"></i><div><strong>${escapeHTML(gate.label)}</strong><p>${escapeHTML(gate.detail)}</p></div><small>${escapeHTML(readinessStatusLabel(gate.status))}</small>
  </article>`;
  $("#permission-local-gates").innerHTML = localGates.length
    ? localGates.map(gateMarkup).join("")
    : '<p class="permission-empty">Connect the local workspace to inspect evidence.</p>';
  $("#permission-external-gates").innerHTML = externalGates.length
    ? externalGates.map(gateMarkup).join("")
    : '<p class="permission-empty">Seven external decisions remain open.</p>';
  const authorities = current?.authorityRegister || [];
  $("#permission-authority-register").innerHTML = authorities.length ? authorities.map(role => `<article class="authority-card" data-state="${escapeHTML(role.status)}">
    <span>${escapeHTML(role.label)}</span><strong>${escapeHTML(role.name || "Unassigned")}</strong><small>${escapeHTML(authorityStatusLabel(role.status))}</small>
  </article>`).join("") : '<p class="permission-empty">Authority roles are loading.</p>';
  $("#permission-evidence-hash").textContent = lastEvent ? `READINESS ${lastEvent.hash.slice(0, 16)}…` : "READINESS —";
  $("#permission-last-run").textContent = lastEvent
    ? `Blocked snapshot sealed ${new Date(lastEvent.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${lastEvent.gateCounts.localCurrent} local patterns current.`
    : "No readiness snapshot has been sealed.";
  $("#permission-boundary").textContent = readiness?.boundary
    || "Local evidence cannot grant external approval, assign a production owner, authorize a pilot, or authorize clinical release.";
  $("#seal-readiness").disabled = !state.connected;
}

function renderSourceIntegration(integration = null, attachmentIntegration = null, providerWorkflow = null, deliveryOutbox = null, modelGateway = null) {
  state.sourceIntegration = integration;
  state.attachmentIntegration = attachmentIntegration;
  state.providerWorkflow = providerWorkflow;
  state.deliveryOutbox = deliveryOutbox;
  state.modelGateway = modelGateway;
  const chain = integration?.chain;
  const count = Number(chain?.count || 0);
  $("#source-contract-state").textContent = integration?.authoritativeContract ? "Authoritative" : "RFI only";
  $("#source-contract-state").classList.toggle("authoritative", Boolean(integration?.authoritativeContract));
  $("#source-contract-version").textContent = "RFI 0.1";
  $("#source-projection").textContent = integration?.modelProjection === "scoring-only" ? "Scoring only" : "Unavailable";
  $("#source-receipt-count").textContent = String(count).padStart(2, "0");
  $("#source-chain-state").textContent = chain?.valid === false
    ? `Integrity failure at receipt ${chain.failedAt || "unknown"}`
    : `${count} linked receipt${count === 1 ? "" : "s"} · ${chain ? "verified" : "ready"}`;
  $("#source-chain-state").classList.toggle("failed", chain?.valid === false);
  $("#source-rescore-state").textContent = integration?.rescoreBehavior?.startsWith("fail-closed") ? "Fail closed" : "Unavailable";
  const attachmentCount = Number(attachmentIntegration?.chain?.count || 0);
  $("#attachment-event-count").textContent = `${String(attachmentCount).padStart(2, "0")} prepared`;
  $("#attachment-chain-state").textContent = attachmentIntegration?.chain?.valid === false
    ? `Integrity failure at event ${attachmentIntegration.chain.failedAt || "unknown"}`
    : `${attachmentCount} linked event${attachmentCount === 1 ? "" : "s"} · ${attachmentIntegration?.chain ? "verified" : "ready"}`;
  const workflowCounts = providerWorkflow?.counts || { sourceEvents: 0, awaitingReview: 0, queued: 0, prepared: 0, failed: 0 };
  $("#workflow-source-count").textContent = String(workflowCounts.sourceEvents).padStart(2, "0");
  $("#workflow-review-count").textContent = String(workflowCounts.awaitingReview).padStart(2, "0");
  $("#workflow-prepared-count").textContent = String(workflowCounts.prepared).padStart(2, "0");
  $("#workflow-failed-count").textContent = String(workflowCounts.failed).padStart(2, "0");
  $("#workflow-contract-version").textContent = providerWorkflow?.contractVersion ? "Workflow 0.1" : "Workflow ready";
  $("#workflow-chain-state").textContent = providerWorkflow?.chain?.valid === false
    ? `Integrity failure at event ${providerWorkflow.chain.failedAt || "unknown"}`
    : `${providerWorkflow?.chain?.count || 0} linked workflow event${providerWorkflow?.chain?.count === 1 ? "" : "s"} · ${providerWorkflow?.chain ? "verified" : "ready"}`;
  $("#workflow-chain-state").classList.toggle("failed", providerWorkflow?.chain?.valid === false);
  $("#provider-workflow").classList.toggle("has-failure", workflowCounts.failed > 0);
  renderDeliveryOutbox(deliveryOutbox);
  const activeProvider = modelGateway?.activeProvider || {};
  const modelTransport = modelGateway?.transport || {};
  const external = Boolean(activeProvider.externalTransmission);
  const httpsBridge = modelTransport.mode === "authenticated-https-bridge";
  $("#model-engine").textContent = activeProvider.mode === "rules" ? "Deterministic baseline" : (activeProvider.id || "Unavailable");
  $("#model-version").textContent = activeProvider.version || "Not loaded";
  $("#model-link-state").textContent = httpsBridge ? "HTTPS bridge armed" : external ? "Candidate active" : "Disabled";
  $("#model-approval-scope").textContent = httpsBridge
    ? `${modelTransport.policyCurrent ? "Policy current" : "Policy expired"} · synthetic only`
    : external ? (activeProvider.approvalScope || "Restricted") : "No external transmission";
  $("#model-output-gate").textContent = modelGateway ? "Strict" : "Unavailable";
  $("#model-contract").textContent = modelGateway?.outputSchemaVersion === "perl-generation-bundle/1.0" ? "Bundle 1.0" : "Contract unavailable";
  const activeSnapshots = Number(modelGateway?.materialization?.active || 0);
  const snapshotRecords = Number(modelGateway?.materialization?.records || 0);
  $("#model-snapshot-count").textContent = `${String(activeSnapshots).padStart(2, "0")} / ${String(snapshotRecords).padStart(2, "0")}`;
  $("#model-chain-state").textContent = modelGateway?.chain?.valid === false
    ? `Integrity failure at event ${modelGateway.chain.failedAt || "unknown"}`
    : `${modelGateway?.chain?.count || 0} linked snapshot${modelGateway?.chain?.count === 1 ? "" : "s"} · ${modelGateway?.chain ? "verified" : "ready"}`;
  $("#model-chain-state").classList.toggle("failed", modelGateway?.chain?.valid === false);
  $("#model-policy-state").textContent = modelGateway?.policyVersion ? "Policy pinned" : "Policy unavailable";
  $("#model-policy-hash").textContent = modelGateway?.policyHash
    ? `POLICY ${modelGateway.policyHash.slice(0, 12)}…${httpsBridge && modelTransport.policyFingerprint ? ` · BRIDGE ${modelTransport.policyFingerprint.slice(0, 12)}…` : ""}`
    : "POLICY —";
  $("#model-gateway").classList.toggle("candidate-active", external);
  $("#source-integration-note").textContent = integration
    ? `The local adapter accepts ${integration.acceptedEnvironment || "calibration"} events only. It is ${integration.phiApproved ? "marked PHI-capable" : "not approved for PHI"} and the contract remains ${integration.authoritativeContract ? "authoritative" : "a synthetic RFI rehearsal"}.`
    : "The local adapter accepts synthetic calibration events only. It does not connect to e-QPASS, authorize PHI, or establish a production contract.";
}

async function loadGovernance() {
  if (!state.connected) {
    renderSourceIntegration(null, null, null, null, null);
    renderIntegrationRehearsal(null);
    renderIntegrationReturn(null);
    renderRecovery(null);
    renderRollback(null);
    renderReleaseCandidate(null);
    renderReleaseAdmission(null);
    renderReleasePromotion(null);
    renderMonitoring(null);
    renderIncidentResponse(null);
    renderIntendedUse(null);
    renderLanguageReview(null);
    renderPilotReadiness(null);
    renderMarketability(null);
    renderExecutiveHandoff(null);
    renderDecisionExchange(null);
    renderPilotOperations(null);
    renderProviderActivation(null);
    renderSiteAdmission(null);
    renderAuthorityTrust(null);
    renderPilotStart(null);
    renderClinicalRelease(null);
    renderTrafficActivation(null);
    renderIdentityAccess(null);
    renderRefinement();
    renderChangeControl();
    return;
  }
  try {
    const [integration, attachmentIntegration, providerWorkflow, deliveryOutbox, modelGateway, integrationRehearsal, { integrationReturn }, recovery, rollback, releaseCandidate, releaseAdmission, releasePromotion, monitoring, incidentResponse, { intendedUse }, { languageReview }, pilotReadiness, marketabilityMap, executiveHandoff, { decisionExchange }, { pilotOperations }, { providerActivation }, { siteAdmission }, { authorityTrust }, { pilotStart }, { clinicalRelease }, { trafficActivation }, { identityAccess }, changes, { refinement }] = await Promise.all([state.api.sourceEvents(), state.api.attachments(), state.api.providerWorkflow(), state.api.deliveryOutbox(), state.api.modelStatus(), state.api.integrationRehearsal(), state.api.integrationReturn(), state.api.recoveryStatus(), state.api.rollbackStatus(), state.api.releaseCandidateStatus(), state.api.releaseAdmissionStatus(), state.api.releasePromotionStatus(), state.api.monitoringStatus(), state.api.incidentResponseStatus(), state.api.intendedUse(), state.api.languageReview(), state.api.pilotReadinessStatus(), state.api.marketabilityMap(), state.api.executiveHandoff(), state.api.decisionExchange(), state.api.pilotOperations(), state.api.providerActivation(), state.api.siteAdmission(), state.api.authorityTrust(), state.api.pilotStart(), state.api.clinicalRelease(), state.api.trafficActivation(), state.api.identityAccess(), state.api.changes(), state.api.refinement()]);
    renderSourceIntegration(integration, attachmentIntegration, providerWorkflow, deliveryOutbox, modelGateway);
    renderIntegrationRehearsal(integrationRehearsal);
    renderIntegrationReturn(integrationReturn);
    renderRecovery(recovery);
    renderRollback(rollback);
    renderReleaseCandidate(releaseCandidate);
    renderReleaseAdmission(releaseAdmission);
    renderReleasePromotion(releasePromotion);
    renderMonitoring(monitoring);
    renderIncidentResponse(incidentResponse);
    renderIntendedUse(intendedUse);
    renderLanguageReview(languageReview);
    renderPilotReadiness(pilotReadiness);
    renderMarketability(marketabilityMap);
    renderExecutiveHandoff(executiveHandoff);
    renderDecisionExchange(decisionExchange);
    renderPilotOperations(pilotOperations);
    renderProviderActivation(providerActivation);
    renderSiteAdmission(siteAdmission);
    renderAuthorityTrust(authorityTrust);
    renderPilotStart(pilotStart);
    renderClinicalRelease(clinicalRelease);
    renderTrafficActivation(trafficActivation);
    renderIdentityAccess(identityAccess);
    renderRefinement(refinement);
    renderChangeControl(changes);
  } catch (error) {
    showToast(error.message);
  }
}

async function loadCounselorFieldwork(force = false) {
  if (!state.connected) return;
  if (state.counselorFieldwork && !force) {
    renderCounselorFieldwork(state.counselorFieldwork);
    return;
  }
  try {
    const [{ metrics }, { analysis }, incidents, lab, { counselorNotebook: notebook }, { referenceRoom }, { adjudication }, { referenceDecision }, { intendedUse }, { languageReview }, { providerActivation }] = await Promise.all([
      state.api.metrics(),
      state.api.analysis(),
      state.api.incidents(),
      state.api.counselorLab(),
      state.api.counselorNotebook(),
      state.api.counselorReferenceRoom(),
      state.api.counselorReferenceAdjudication(),
      state.api.counselorReferenceDecision(),
      state.api.intendedUse(),
      state.api.languageReview(),
      state.api.providerActivation()
    ]);
    state.analysis = analysis;
    state.counselorLab = lab;
    state.counselorNotebook = notebook;
    state.counselorReferenceRoom = referenceRoom;
    state.counselorReferenceAdjudication = adjudication;
    state.counselorReferenceDecision = referenceDecision;
    state.intendedUse = intendedUse;
    state.languageReview = languageReview;
    state.providerActivation = providerActivation;
    renderCounselorReferenceRoom(referenceRoom);
    renderCounselorReferenceAdjudication(adjudication);
    renderCounselorReferenceDecision(referenceDecision);
    renderCounselorFieldwork({ metrics, analysis, incidents, lab, notebook, referenceRoom, adjudication, referenceDecision, intendedUse, languageReview, providerActivation });
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshReadinessSurfaces(readiness = null) {
  const [pilotReadiness, marketabilityMap, executiveHandoff, { decisionExchange }, { pilotOperations }, { providerActivation }, { siteAdmission }, { authorityTrust }, { pilotStart }, { clinicalRelease }, { trafficActivation }, { identityAccess }] = await Promise.all([
    readiness ? Promise.resolve(readiness) : state.api.pilotReadinessStatus(),
    state.api.marketabilityMap(),
    state.api.executiveHandoff(),
    state.api.decisionExchange(),
    state.api.pilotOperations(),
    state.api.providerActivation(),
    state.api.siteAdmission(),
    state.api.authorityTrust(),
    state.api.pilotStart(),
    state.api.clinicalRelease(),
    state.api.trafficActivation(),
    state.api.identityAccess()
  ]);
  renderPilotReadiness(pilotReadiness);
  renderMarketability(marketabilityMap);
  renderExecutiveHandoff(executiveHandoff);
  renderDecisionExchange(decisionExchange);
  renderPilotOperations(pilotOperations);
  renderProviderActivation(providerActivation);
  renderSiteAdmission(siteAdmission);
  renderAuthorityTrust(authorityTrust);
  renderPilotStart(pilotStart);
  renderClinicalRelease(clinicalRelease);
  renderTrafficActivation(trafficActivation);
  renderIdentityAccess(identityAccess);
}

async function refreshMetrics() {
  if (!state.connected) return;
  const [{ metrics }, { analysis }, incidentState, calibrationIntake, { modelTrial }, { candidateTrial }, { candidateReturns }, { candidateReview }, { candidateRefinement }, { candidateRetest }, { candidateRetestDisposition }, { candidateAdvancement }, counselorLab, { counselorNotebook }, { referenceRoom }, { adjudication }, { referenceDecision }, { clinicalStandard }, { independentReview }, { independentReviewAdmission }] = await Promise.all([state.api.metrics(), state.api.analysis(), state.api.incidents(), state.api.calibrationIntake(), state.api.modelTrial(), state.api.candidateTrial(), state.api.candidateReturns(), state.api.candidateReview(), state.api.candidateRefinement(), state.api.candidateRetest(), state.api.candidateRetestDisposition(), state.api.candidateAdvancement(), state.api.counselorLab(), state.api.counselorNotebook(), state.api.counselorReferenceRoom(), state.api.counselorReferenceAdjudication(), state.api.counselorReferenceDecision(), state.api.clinicalStandard(), state.api.independentReview(), state.api.independentReviewAdmission()]);
  $("#metric-awaiting").textContent = metrics.awaitingReview;
  $("#nav-queue-count").textContent = metrics.awaitingReview;
  $("#metric-safety").textContent = metrics.safetyHolds;
  $("#metric-correction").textContent = metrics.correctionRate;
  $("#comparison-count").textContent = String(metrics.comparisons).padStart(2, "0");
  renderCalibrationAnalysis(analysis);
  renderCalibrationIntake(calibrationIntake);
  renderModelTrial(modelTrial);
  renderCandidateTrial(candidateTrial);
  renderCandidateReturns(candidateReturns);
  renderCandidateReview(candidateReview);
  renderCandidateRefinement(candidateRefinement);
  renderCandidateRetest(candidateRetest);
  renderCandidateRetestDisposition(candidateRetestDisposition);
  renderCandidateAdvancement(candidateAdvancement);
  renderCounselorLab(counselorLab);
  renderCounselorNotebook(counselorNotebook);
  renderCounselorReferenceRoom(referenceRoom);
  renderCounselorReferenceAdjudication(adjudication);
  renderCounselorReferenceDecision(referenceDecision);
  if (state.counselorFieldwork) renderCounselorFieldwork({
    ...state.counselorFieldwork,
    metrics,
    analysis,
    incidents: incidentState,
    lab: counselorLab,
    notebook: counselorNotebook,
    referenceRoom,
    adjudication,
    referenceDecision
  });
  renderClinicalStandard(clinicalStandard);
  renderIndependentReview(independentReview);
  renderIndependentReviewAdmission(independentReviewAdmission);
  renderStudySafety(incidentState);
}

async function refreshCurrent() {
  if (!state.connected) return;
  const id = currentAssessment().id;
  const [{ assessments }, detail] = await Promise.all([
    state.api.listAssessments(),
    state.api.getAssessment(id)
  ]);
  state.assessments = assessments;
  applyDetail(detail);
  renderQueue($("#queue-search").value);
  renderReview();
  await refreshMetrics();
}

async function loadAssessment(index, showReview = true) {
  state.currentIndex = index;
  state.riskAcknowledged = Boolean(currentAssessment().safetyAcknowledged);
  if (state.connected) {
    const detail = await state.api.getAssessment(currentAssessment().id);
    applyDetail(detail);
  } else {
    state.audit = [...auditSeed];
  }
  renderReview();
  if (showReview) switchView("review");
}

async function hydrateFromApi() {
  if (window.location.protocol === "file:") {
    $("#server-required").hidden = false;
    setConnectionState(false);
    return;
  }
  if (state.hostedEvaluation) {
    setConnectionState(false);
    showToast("PERL is ready. Assessments and settings save in this browser.");
    return;
  }
  try {
    const health = await state.api.health();
    setConnectionState(true, health);
    const { assessments } = await state.api.listAssessments();
    state.assessments = assessments;
    await loadAssessment(0, false);
    renderQueue();
    await refreshMetrics();
    await loadProgressReview();
    await loadWorkspaceExperience({ applyDefault: true });
  } catch (error) {
    console.warn("PERL API unavailable; using local browser persistence.", error);
    setConnectionState(false);
    showToast(state.hostedEvaluation
      ? "PERL is ready. Assessments and settings save in this browser."
      : "Local persistence is unavailable; this session will remain in memory.");
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function switchView(name, { focus = true } = {}) {
  $$(".view").forEach(view => {
    const active = view.id === `view-${name}`;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  $$(".nav-item").forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  applyExperienceMode(STUDIO_VIEWS.has(name) ? "studio" : "clinical");
  $(".sidebar").classList.remove("open");
  $("#mobile-menu").setAttribute("aria-expanded", "false");
  $("#mobile-menu").setAttribute("aria-label", "Open navigation");
  const heading = $(`#${name}-title`);
  if (focus) window.requestAnimationFrame(() => {
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });
  if (name === "calibration" && state.connected && !state.calibrationCase) void loadCalibrationCase();
  if (name === "progress" && state.connected && !state.progressReview) void loadProgressReview();
  if (name === "fieldwork") void loadCounselorFieldwork();
  if (name === "campus") void loadCampusObservatory();
  if (name === "governance") void loadGovernance();
}

function switchViewFromHash() {
  const name = window.location.hash.slice(1);
  if (["queue", "review", "studio"].includes(name)) switchView(name, { focus: false });
}

function authorLabel(value) {
  return value === "human-reference" ? "Counselor reference" : "PERL generated";
}

function renderComparisonSummary(label, summary) {
  $(`#summary-${label.toLowerCase()}-text`).textContent = summary.text;
  $(`#summary-${label.toLowerCase()}-signals`).innerHTML = [
    ...summary.signals,
    `${summary.wordCount} words`
  ].map(signal => `<li>${escapeHTML(signal)}</li>`).join("");
}

function setComparisonInputsDisabled(disabled) {
  $$('#comparison-form input, #comparison-form textarea').forEach(input => { input.disabled = disabled; });
}

async function loadCalibrationCase(force = false) {
  if (!state.connected || (state.calibrationCase && !force)) return;
  $$(".comparison-card").forEach(card => card.classList.add("loading"));
  $("#comparison-reveal").hidden = true;
  $("#comparison-unavailable").hidden = true;
  $("#next-comparison").hidden = true;
  $("#comparison-submit").hidden = false;
  $("#comparison-submit").disabled = false;
  setComparisonInputsDisabled(false);
  $("#comparison-form").reset();
  try {
    const { comparisonCase } = await state.api.nextComparison();
    state.calibrationCase = comparisonCase;
    renderComparisonSummary("A", comparisonCase.summaries.A);
    renderComparisonSummary("B", comparisonCase.summaries.B);
    $("#comparison-count").textContent = String(comparisonCase.progress.completed).padStart(2, "0");
    const reviewerProgress = comparisonCase.reviewerProgress || { completed: 0, available: state.assessments.length };
    $("#comparison-assignment").textContent = `Reviewer set · ${reviewerProgress.completed} of ${reviewerProgress.available} complete`;
  } catch (error) {
    state.calibrationCase = null;
    state.counselorReferenceRoom = null;
    state.counselorReferenceCaseId = null;
    setComparisonInputsDisabled(true);
    $("#comparison-submit").disabled = true;
    $("#comparison-unavailable").hidden = false;
    $("#comparison-unavailable strong").textContent = error.message.includes("completed every") ? "Reviewer set complete" : "Case unavailable";
    $("#comparison-unavailable span").textContent = error.message;
    $("#comparison-assignment").textContent = "Reviewer set · no case assigned";
    showToast(error.message);
  } finally {
    $$(".comparison-card").forEach(card => card.classList.remove("loading"));
  }
}

function formatActiveDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(Math.round(total % 60)).padStart(2, "0")}`;
}

function updateTimingCharacterCount() {
  $("#timing-character-count").textContent = `${$("#timing-summary").value.length.toLocaleString()} / 1,500`;
}

function resetTimingWorkspace() {
  state.timingTask = null;
  state.timingResult = null;
  $("#timing-task").hidden = true;
  $("#timing-result").hidden = true;
  $("#timing-start").hidden = false;
  $("#timing-start").disabled = !state.connected;
  $("#timing-start").textContent = "Start timing task";
  $("#timing-lane-status").textContent = "No task started";
  $("#timing-form").reset();
  updateTimingCharacterCount();
}

function renderTimingTask(task) {
  state.timingTask = task;
  state.timingResult = null;
  const assisted = task.condition === "perl-assisted";
  const condition = $("#timing-condition");
  condition.textContent = assisted ? "PERL-assisted review" : "Unaided synthesis";
  condition.classList.toggle("unaided", !assisted);
  $("#timing-task-title").textContent = assisted ? "Verify and revise the draft" : "Create the summary from scored evidence";
  $("#timing-task-case").textContent = `${task.assessmentId} · ${task.partition}`;
  $("#timing-task-progress").textContent = `${task.reviewerProgress.completed} of ${task.reviewerProgress.available} complete`;
  $("#timing-instructions").textContent = task.instructions;
  $("#timing-boundary").textContent = task.claimBoundary;
  $("#timing-scales").innerHTML = task.sourceProfile.scales.map(scale => `<article class="timing-scale">
    <span title="${escapeHTML(scale.label)}">${escapeHTML(scale.label)}</span>
    <strong>${escapeHTML(scale.score)}</strong><small>${escapeHTML(scale.level)}</small>
  </article>`).join("");
  const safety = task.sourceProfile.safety;
  $("#timing-safety").classList.toggle("requires-review", safety.directReviewRequired);
  $("#timing-safety").innerHTML = `<strong>${safety.directReviewRequired ? "Direct review required" : "Routine verification"}</strong>${escapeHTML(safety.instruction)}`;
  $("#timing-subscale-list").innerHTML = task.sourceProfile.subscales.map(item => `<div class="timing-subscale-row">
    <span>${escapeHTML(item.label)}</span><strong>${escapeHTML(item.score)}</strong><small>${escapeHTML(item.level || "source")}</small>
  </div>`).join("");
  $("#timing-summary").value = task.initialDraft || "";
  updateTimingCharacterCount();
  $("#timing-result").hidden = true;
  $("#timing-task").hidden = false;
  $("#timing-start").disabled = true;
  $("#timing-start").textContent = "Task active";
  $("#timing-lane-status").textContent = `${assisted ? "Assisted" : "Unaided"} condition · server timer running`;
  window.requestAnimationFrame(() => $("#timing-summary").focus());
}

async function loadTimingTask() {
  if (!state.connected) return showToast("The workflow-timing study requires the persistent local API.");
  const button = $("#timing-start");
  button.disabled = true;
  button.textContent = "Assigning task…";
  try {
    const { timingTask } = await state.api.nextTimingTask();
    renderTimingTask(timingTask);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Start timing task";
    $("#timing-lane-status").textContent = error.message.includes("completed every") ? "Reviewer timing set complete" : "Task unavailable";
    showToast(error.message);
  }
}

function getNarrative(assessment) {
  const key = `${assessment.id}:${state.audience}`;
  return state.narratives[key] || generateSummary(assessment, state.audience);
}

function scorePosition(key, score, maximum) {
  const thresholds = SCALE_THRESHOLDS[key];
  const bounds = [0, thresholds[0], thresholds[1], thresholds[2], maximum];
  const band = Math.min(3, thresholds.findIndex(limit => score <= limit) === -1 ? 3 : thresholds.findIndex(limit => score <= limit));
  const lower = band === 0 ? 0 : bounds[band] + 1;
  const upper = bounds[band + 1];
  const progress = upper <= lower ? 1 : Math.min(1, Math.max(0, (score - lower) / (upper - lower)));
  return Math.min(100, Math.max(3, band * 25 + progress * 25));
}

function renderScoreProfile(assessment) {
  $("#score-profile").innerHTML = SCALE_META.map(scale => {
    const score = assessment.scales[scale.key];
    const level = resolveScaleLevel(assessment, scale.key);
    const width = scorePosition(scale.key, score, scale.max);
    return `<div class="score-row">
      <span class="score-name">${escapeHTML(scale.label)}</span>
      <div class="score-track" aria-label="${escapeHTML(scale.label)} ${score}, ${level}"><span class="score-fill" style="width:${width}%"></span></div>
      <strong class="score-value">${score}</strong>
      <span class="severity-pill severity-${level}">${level}</span>
    </div>`;
  }).join("");
}

function currentClinicalBrief(assessment) {
  const interpretation = { hypotheses: assessment.hypotheses, questions: assessment.questions };
  const clinicianNarrative = state.narratives[`${assessment.id}:clinician`] || generateSummary(assessment, "clinician");
  return buildClinicalBrief({ assessment, interpretation, narrative: clinicianNarrative });
}

function renderClinicalBrief(assessment, brief) {
  $("#clinical-brief-format").textContent = brief.format;
  $("#summary-heading").textContent = state.audience === "clinician" ? brief.overallDistress.headline : $("#summary-heading").textContent;
  $("#core-dimension-title").textContent = "Primary domains + overall distress";
  const mixed = brief.mixedSignals;
  $("#mixed-signal-count").textContent = String(mixed.items.length).padStart(2, "0");
  $("#mixed-signal-title").textContent = mixed.headline;
  $("#mixed-signal-summary").textContent = mixed.statement;
  $("#mixed-signal-list").innerHTML = mixed.items.length
    ? mixed.items.map(item => `<li><strong>${escapeHTML(item.label)}</strong><p>${escapeHTML(item.statement)}</p><small>${item.evidence.map(escapeHTML).join(" · ")}</small></li>`).join("")
    : "";
  const flags = brief.redFlags;
  const flagCard = $("#brief-red-flags");
  flagCard.dataset.status = flags.status;
  $("#brief-red-flag-count").textContent = String(flags.highlightedResponses).padStart(2, "0");
  $("#brief-red-flag-title").textContent = flags.headline;
  $("#brief-red-flag-statement").textContent = flags.statement;
  $("#brief-red-flag-source").textContent = flags.sourceDisclosure;
  $("#brief-limitations-list").innerHTML = brief.limitations.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#brief-limitation-count").textContent = `${brief.limitations.length} explicit limits`;
  const checks = new Map(brief.qualityChecks.map(item => [item.id, item]));
  for (const [id, selector] of [["diagnostic-restraint", "#quality-diagnostic"], ["evidence-lineage", "#quality-lineage"], ["specificity", "#quality-specificity"]]) {
    const check = checks.get(id);
    const node = $(selector);
    node.textContent = check?.value || "Review";
    node.className = check?.status === "pass" ? "pass" : check?.status === "fail" ? "fail" : "review";
    node.title = check?.detail || "";
  }
}

function renderHypotheses(assessment, brief) {
  const themes = brief?.clinicalThemes || assessment.hypotheses.map((hypothesis, index) => ({ ...hypothesis, id: `theme-${index + 1}`, domain: "Scored profile", hypothesis: hypothesis.body, uncertainty: "Context remains to be established." }));
  $("#hypotheses-list").innerHTML = themes.map((theme, index) => `<article class="hypothesis-item">
    <span class="hypothesis-index">${String(index + 1).padStart(2, "0")}</span>
    <div>
      <small class="theme-domain">${escapeHTML(theme.domain)}</small>
      <h3>${escapeHTML(theme.title)}</h3>
      <p>${escapeHTML(theme.hypothesis)}</p>
      <p class="theme-uncertainty"><strong>Uncertainty</strong>${escapeHTML(theme.uncertainty)}</p>
      <div class="evidence-pills">${theme.evidence.map(item => `<span>${escapeHTML(item)}</span>`).join("")}</div>
    </div>
    <div class="confidence">Confidence<strong>${escapeHTML(theme.confidence)}</strong></div>
  </article>`).join("");
  $("#questions-list").innerHTML = assessment.questions.map(question => `<li>${escapeHTML(question)}</li>`).join("");
  $("#question-count").textContent = assessment.questions.length;
}

function renderInterpretationStatus(assessment) {
  const provenance = assessment.interpretationProvenance || {};
  const status = $("#interpretation-status");
  const revised = provenance.source === "reviewer";
  status.classList.toggle("revised", revised);
  status.textContent = revised
    ? `Reviewer revised · r${provenance.revision}`
    : `Generated · ${displayEngineVersion(provenance.version)}`;
}

function hypothesisEditorMarkup(hypothesis, index) {
  return `<article class="hypothesis-editor" data-hypothesis-index="${index}">
    <div class="hypothesis-editor-head"><span class="hypothesis-editor-index">${String(index + 1).padStart(2, "0")}</span><button class="remove-editor remove-hypothesis" type="button">Remove</button></div>
    <div class="editor-grid">
      <label class="editor-field">Hypothesis title<input class="hypothesis-title" value="${escapeHTML(hypothesis.title)}" maxlength="180"></label>
      <label class="editor-field">Confidence<select class="hypothesis-confidence">${["Low", "Moderate", "High"].map(value => `<option${value === hypothesis.confidence ? " selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="editor-field full">Clinical explanation<textarea class="hypothesis-body" maxlength="1400">${escapeHTML(hypothesis.body)}</textarea></label>
      <div class="locked-evidence"><span>Locked scored evidence</span><div class="evidence-pills">${hypothesis.evidence.map(item => `<span data-evidence="${escapeHTML(item)}">${escapeHTML(item)}</span>`).join("")}</div></div>
    </div>
  </article>`;
}

function questionEditorMarkup(question, index) {
  return `<div class="question-editor" data-question-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><textarea maxlength="500">${escapeHTML(question)}</textarea><button class="remove-editor remove-question" type="button">Remove</button></div>`;
}

function renumberInterpretationEditors() {
  $$("#interpretation-hypotheses .hypothesis-editor").forEach((editor, index) => {
    editor.dataset.hypothesisIndex = index;
    editor.querySelector(".hypothesis-editor-index").textContent = String(index + 1).padStart(2, "0");
  });
  $$("#interpretation-questions .question-editor").forEach((editor, index) => {
    editor.dataset.questionIndex = index;
    editor.querySelector(":scope > span").textContent = String(index + 1).padStart(2, "0");
  });
}

function renderInterpretationEditor(assessment) {
  $("#interpretation-hypotheses").innerHTML = assessment.hypotheses.map(hypothesisEditorMarkup).join("");
  $("#interpretation-questions").innerHTML = assessment.questions.map(questionEditorMarkup).join("");
}

function collectInterpretationEditor() {
  return {
    hypotheses: $$("#interpretation-hypotheses .hypothesis-editor").map(editor => ({
      title: editor.querySelector(".hypothesis-title").value.trim(),
      body: editor.querySelector(".hypothesis-body").value.trim(),
      confidence: editor.querySelector(".hypothesis-confidence").value,
      evidence: [...editor.querySelectorAll("[data-evidence]")].map(node => node.dataset.evidence)
    })),
    questions: $$("#interpretation-questions .question-editor textarea").map(textarea => textarea.value.trim())
  };
}

function renderEvidence(assessment) {
  const visible = assessment.subscales.slice(0, 4);
  $("#evidence-ledger").innerHTML = visible.map(item => `<div class="ledger-row"><span class="ledger-node"></span><strong>${escapeHTML(item.label)}</strong><span>${escapeHTML(item.score)}</span></div>`).join("");
  $("#evidence-table").innerHTML = `<div class="evidence-table-row header"><span>Construct</span><span>Domain</span><span>Score</span><span>Range</span></div>` + assessment.subscales.map(item => `<div class="evidence-table-row"><strong>${escapeHTML(item.label)}</strong><span>${escapeHTML(item.domain)}</span><code>${escapeHTML(item.score)}</code><span class="severity-pill severity-${escapeHTML(item.level)}">${escapeHTML(item.level)}</span></div>`).join("");
}

function renderAudit() {
  $("#audit-list").innerHTML = state.audit.slice(0, 5).map(entry => `<div class="audit-entry"><time>${escapeHTML(entry.time)}</time><div><strong>${escapeHTML(entry.action)}</strong><span>${escapeHTML(entry.actor)} · ${escapeHTML(displayRecordId(entry.detail))}</span></div></div>`).join("");
}

function renderRevisionLineage() {
  const revisions = state.revisions || [];
  $("#lineage-count").textContent = revisions.length ? `${revisions.length} linked revision${revisions.length === 1 ? "" : "s"}` : "No revisions";
  $("#lineage-integrity").textContent = state.revisionChain?.valid ? "Integrity verified" : "Integrity failed";
  $("#lineage-integrity").classList.toggle("failed", state.revisionChain?.valid === false);
  $("#revision-head").textContent = state.revisionChain?.head ? `HEAD ${state.revisionChain.head.slice(0, 12)}…` : "GENESIS";
  $("#revision-list").innerHTML = revisions.length
    ? revisions.slice(0, 4).map(revision => {
        const label = revision.kind === "narrative" ? `${revision.audience} narrative` : "structured interpretation";
        const change = revision.kind === "narrative"
          ? `${revision.change?.changedTokens || 0} changed tokens`
          : (revision.changed || []).join(" + ");
        const time = revision.createdAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(revision.createdAt)) : "Recorded";
        return `<article class="revision-entry"><span>${String(revision.sequence).padStart(2, "0")}</span><div><strong>${escapeHTML(label)}</strong><p>${escapeHTML(revision.actor)} · ${escapeHTML(change)}</p><time>${escapeHTML(time)}</time></div><code>${escapeHTML(revision.hash.slice(0, 7))}</code></article>`;
      }).join("")
    : "<p>Reviewer changes will appear here with linked integrity hashes.</p>";
}

function renderAttachmentState() {
  const card = $("#attachment-card");
  const button = $("#prepare-attachment");
  const assembly = $("#open-assembly-proof");
  const receipt = $("#attachment-receipt");
  const attachment = state.attachment || { status: "not-source-event", eligible: false, preparation: null };
  const workflow = state.workflow || { status: attachment.status, eligible: attachment.eligible, currentJob: null };
  const content = {
    "not-source-event": ["Report source", "Upload the scored e-QPASS report to keep the summary linked to verified source scores."],
    "awaiting-review": ["Findings received", "PERL routed this score event into clinician review automatically. Approval remains required."],
    "ready-to-queue": ["Approved · automation gap", "The approved artifact is eligible for bounded preparation, but no workflow job was recorded."],
    queued: ["Handoff preparing", "The approved artifact is in the idempotent preparation queue. No e-QPASS write is occurring."],
    "prepared-not-attached": ["Prepared · boundary held", "Lineage and idempotency are verified. No PDF was written to e-QPASS and no attachment is claimed."],
    failed: ["Preparation stopped safely", "Approval is preserved. Retry the bounded preparation job; no duplicate attachment will be created."]
  }[workflow.status] || ["Handoff unavailable", "The workflow state could not be resolved."];
  $("#attachment-title").textContent = content[0];
  $("#attachment-detail").textContent = content[1];
  button.hidden = workflow.status !== "failed" && workflow.status !== "ready-to-queue";
  button.disabled = !state.connected || !workflow.eligible || !state.reportArtifact;
  button.dataset.action = workflow.status === "failed" ? "retry" : "prepare";
  button.textContent = workflow.status === "failed" ? "Retry preparation" : "Prepare handoff";
  card.classList.toggle("prepared", workflow.status === "prepared-not-attached");
  card.classList.toggle("failed", workflow.status === "failed");
  assembly.hidden = workflow.status !== "prepared-not-attached";
  if (!assembly.hidden) assembly.href = `/api/assessments/${encodeURIComponent(currentAssessment().id)}/report-package.html`;
  else assembly.removeAttribute("href");
  const receiptHash = attachment.preparation?.hash || workflow.currentJob?.hash;
  receipt.hidden = !receiptHash;
  receipt.textContent = receiptHash ? `${workflow.status === "failed" ? "Job" : "Receipt"} ${receiptHash.slice(0, 12)}…` : "";
}

function setApprovalState(assessment) {
  const risk = riskDisposition(assessment);
  const checkbox = $("#risk-ack");
  const approve = $("#approve-button");
  const safetyCard = $("#safety-gate");
  const banner = $("#risk-banner");
  const safetyQuality = $("#safety-quality");

  if (risk.requiresReview) {
    banner.hidden = false;
    checkbox.disabled = false;
    checkbox.checked = state.riskAcknowledged;
    $("#risk-reason").textContent = risk.reason;
    $("#critical-responses").innerHTML = assessment.criticalResponses.length
      ? assessment.criticalResponses.map(item => `<strong>${escapeHTML(item.item)} · score ${escapeHTML(item.score)}</strong><span>${escapeHTML(item.note)}</span>`).join("")
      : `<strong>Risk scale · non-zero</strong><span>Review the source e-QPASS record directly.</span>`;
    approve.disabled = !state.riskAcknowledged;
    safetyCard.classList.toggle("resolved", state.riskAcknowledged);
    $("#safety-title").textContent = state.riskAcknowledged ? "Safety response reviewed" : "Direct review required";
    $(".acknowledge").hidden = false;
    banner.classList.toggle("resolved", state.riskAcknowledged);
    $("#dock-status").textContent = state.riskAcknowledged ? "Safety review acknowledged" : "Approval held";
    $("#dock-help").textContent = state.riskAcknowledged ? "Approve when the full draft is clinically accurate." : "Acknowledge the safety gate to continue.";
    banner.querySelector("strong").textContent = state.riskAcknowledged ? "Critical screen acknowledged" : "Critical screen needs direct review";
    banner.querySelector("div:nth-child(2) span").textContent = state.riskAcknowledged ? "The source response was reviewed; direct follow-up remains a clinical responsibility." : "A non-zero self-report is present. The draft cannot be approved until a qualified reviewer acknowledges the source response.";
    safetyQuality.textContent = state.riskAcknowledged ? "Pass" : "Review";
    safetyQuality.className = state.riskAcknowledged ? "pass" : "review";
  } else {
    banner.hidden = true;
    checkbox.checked = true;
    checkbox.disabled = true;
    $("#risk-reason").textContent = risk.reason;
    $("#critical-responses").innerHTML = `<strong>Critical screens · 0</strong><span>No non-zero critical-screen response is present.</span>`;
    approve.disabled = false;
    safetyCard.classList.add("resolved");
    $("#safety-title").textContent = "No automated hold";
    $(".acknowledge").hidden = true;
    $("#dock-status").textContent = "Ready for decision";
    $("#dock-help").textContent = "All automated holds are clear; clinical review remains required.";
    safetyQuality.textContent = "Pass";
    safetyQuality.className = "pass";
  }
  if (state.studyControl.state === "paused") {
    approve.disabled = true;
    $("#dock-status").textContent = "Study paused";
    $("#dock-help").textContent = "Resolve the high-severity safety incident before approval can continue.";
  }
  if (assessment.status === "approved") {
    approve.disabled = true;
    approve.textContent = "Approved";
    $("#dock-status").textContent = "Approved";
    $("#dock-help").textContent = "The immutable clinician artifact is ready for its next governed step.";
  } else {
    approve.innerHTML = 'Approve clinician summary <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  }
  if (state.audience !== "clinician") {
    approve.disabled = true;
    $("#dock-status").textContent = "Audience preview only";
    $("#dock-help").textContent = "Switch to Clinician before making a clinical approval or return decision.";
  }
}

function renderReview() {
  const assessment = currentAssessment();
  const clinicalBrief = currentClinicalBrief(assessment);
  $("#record-crumb").textContent = displayRecordId(assessment.id);
  $("#meta-id").textContent = displayRecordId(assessment.id);
  $("#meta-completion").textContent = assessment.completedAt;
  $("#meta-duration").textContent = assessment.duration;
  $("#meta-items").textContent = `${assessment.itemsAnswered} / 105`;
  $("#meta-version").textContent = displayEngineVersion(assessment.interpretationProvenance?.version || state.model?.version);
  $("#generation-mode").textContent = assessment.interpretationProvenance?.provider === "deterministic-calibration" ? "Rules" : "Model";
  $("#summary-text").textContent = getNarrative(assessment);
  $("#coverage-score").textContent = coverageScore(assessment);
  renderClinicalBrief(assessment, clinicalBrief);
  renderScoreProfile(assessment);
  renderHypotheses(assessment, clinicalBrief);
  renderInterpretationStatus(assessment);
  renderEvidence(assessment);
  renderRevisionLineage();
  renderAudit();
  setApprovalState(assessment);
  renderAttachmentState();
  renderAudiencePresentation(assessment);
}

function progressDelta(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number).replace("-", "−");
}

function progressOptionMarkup(options, selectedId = null) {
  return options.map((option, index) => `<option value="${escapeHTML(option.id)}"${option.id === selectedId || (!selectedId && index === 0) ? " selected" : ""}>${escapeHTML(option.label)}</option>`).join("");
}

function renderProgressReview(progressReview) {
  if (!progressReview) return;
  state.progressReview = progressReview;
  const metrics = progressReview.metrics;
  $("#progress-timepoints").textContent = String(metrics.timepoints).padStart(2, "0");
  $("#progress-core-count").textContent = String(metrics.coreScales).padStart(2, "0");
  $("#progress-shared-count").textContent = String(metrics.sharedSubscales).padStart(2, "0");
  $("#progress-observation-count").textContent = String(metrics.observationsRecorded).padStart(2, "0");
  $("#progress-series-state").textContent = metrics.observationsRecorded ? "Local observations recorded" : "Rehearsal ready";
  $("#progress-series-id").textContent = progressReview.series.id;
  $("#progress-series-input").value = progressReview.series.id;
  $("#progress-fingerprint").textContent = `SERIES ${progressReview.seriesFingerprint.slice(0, 12)}…`;
  const brief = progressReview.brief;
  $("#progress-brief-title").textContent = brief.headline;
  $("#progress-brief-summary").textContent = brief.summary;
  $("#progress-brief-opening").textContent = `“${brief.affirmingOpening}”`;
  $("#progress-brief-generator").textContent = `${brief.generator.version} · deterministic rules · no external transmission`;
  $("#progress-brief-evidence").innerHTML = brief.evidence.map(item => `<span>${escapeHTML(item.label)} <b>${item.earlier}→${item.later}</b> <em>${progressDelta(item.delta)}</em></span>`).join("");
  $("#progress-brief-priorities").innerHTML = brief.conversationPriorities.map((priority, index) => `<article>
    <span>${String(index + 1).padStart(2, "0")}</span>
    <div><strong>${escapeHTML(priority.label)}</strong><p>${escapeHTML(priority.prompt)}</p><small>${priority.evidence.map(escapeHTML).join(" · ")}</small></div>
  </article>`).join("");

  $("#progress-core-chart").innerHTML = progressReview.scales.map(scale => {
    const earlierY = 38 - (scale.earlier / scale.maximum) * 30;
    const laterY = 38 - (scale.later / scale.maximum) * 30;
    const directionLabel = scale.delta < 0 ? "raw score lower" : scale.delta > 0 ? "raw score higher" : "no raw movement";
    return `<article class="progress-scale-row" aria-label="${escapeHTML(scale.label)}: ${scale.earlier} at Point 01, ${scale.later} at Point 02, delta ${progressDelta(scale.delta)}, ${directionLabel}">
      <div class="progress-scale-label"><strong>${escapeHTML(scale.label)}</strong><small>0–${scale.maximum}</small></div>
      <div class="progress-slope">
        <span class="progress-reading earlier"><b>${scale.earlier}</b><small>${escapeHTML(scale.earlierLevel)}</small></span>
        <svg viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
          <path class="progress-guide" d="M10 38H90"/>
          <path class="progress-line" d="M10 ${earlierY.toFixed(2)} L90 ${laterY.toFixed(2)}"/>
          <circle cx="10" cy="${earlierY.toFixed(2)}" r="3"/>
          <circle cx="90" cy="${laterY.toFixed(2)}" r="3"/>
        </svg>
        <span class="progress-reading later"><b>${scale.later}</b><small>${escapeHTML(scale.laterLevel)}</small></span>
      </div>
      <div class="progress-delta ${scale.delta < 0 ? "lower" : scale.delta > 0 ? "higher" : "flat"}"><strong>${progressDelta(scale.delta)}</strong><span>${directionLabel}</span></div>
    </article>`;
  }).join("");

  $("#progress-subscale-list").innerHTML = progressReview.sharedSubscales.map(item => {
    const maximum = Math.max(item.earlier, item.later, 1);
    return `<article class="progress-subscale-row" aria-label="${escapeHTML(item.label)}: ${item.earlier} at Point 01, ${item.later} at Point 02, delta ${progressDelta(item.delta)}">
      <div><small>${escapeHTML(item.domain)}</small><strong>${escapeHTML(item.label)}</strong></div>
      <div class="progress-pair-bars" aria-hidden="true"><i style="--value:${(item.earlier / maximum) * 100}%"></i><i style="--value:${(item.later / maximum) * 100}%"></i></div>
      <span><b>${item.earlier}</b><em>→</em><b>${item.later}</b></span>
      <strong class="progress-mini-delta">${progressDelta(item.delta)}</strong>
    </article>`;
  }).join("");

  $("#progress-safety-list").innerHTML = progressReview.series.points.map(point => {
    const route = point.criticalRoute;
    return `<div class="progress-safety-row ${route.requiresDirectReview ? "requires-review" : "clear"}">
      <span>${escapeHTML(point.marker)}</span>
      <strong>${route.requiresDirectReview ? "Direct review required" : "No automated hold"}</strong>
      <small>${route.requiresDirectReview ? `${route.nonZeroCriticalResponses} non-zero critical response${route.nonZeroCriticalResponses === 1 ? "" : "s"}` : "No non-zero critical screen in this fixture"}</small>
    </div>`;
  }).join("");

  const latest = progressReview.latestObservation;
  $("#progress-focus").innerHTML = progressOptionMarkup(progressReview.focusOptions, latest?.focus);
  $("#progress-finding").innerHTML = progressOptionMarkup(progressReview.findingOptions, latest?.finding);
  $("#progress-disposition").innerHTML = progressOptionMarkup(progressReview.dispositionOptions, latest?.disposition);
  $("#progress-observation-status").textContent = latest
    ? `Latest local observation ${String(latest.sequence).padStart(2, "0")} · ${latest.actor} · no clinical conclusion recorded.`
    : "No observation has been recorded.";
  const labels = {
    ...Object.fromEntries(progressReview.focusOptions.map(item => [item.id, item.label])),
    ...Object.fromEntries(progressReview.findingOptions.map(item => [item.id, item.label])),
    ...Object.fromEntries(progressReview.dispositionOptions.map(item => [item.id, item.label]))
  };
  $("#progress-history").innerHTML = progressReview.history.length ? [...progressReview.history].reverse().map(entry => `<article>
    <span>${String(entry.sequence).padStart(2, "0")}</span>
    <div><strong>${escapeHTML(labels[entry.focus] || entry.focus)}</strong><p>${escapeHTML(labels[entry.finding] || entry.finding)} · ${escapeHTML(labels[entry.disposition] || entry.disposition)}</p><small>${escapeHTML(entry.actor)} · ${escapeHTML(new Date(entry.createdAt).toLocaleString())}</small></div>
  </article>`).join("") : "<p>No structured observations yet.</p>";
  $("#progress-chain-head").textContent = progressReview.chain.head ? `HEAD ${progressReview.chain.head.slice(0, 12)}…` : "GENESIS";
  $("#progress-chain-head").classList.toggle("failed", progressReview.chain.valid === false);
}

async function loadProgressReview(force = false) {
  if (!state.connected || (state.progressReview && !force)) return;
  try {
    const { progressReview } = await state.api.progressReview();
    renderProgressReview(progressReview);
  } catch (error) {
    showToast(error.message);
  }
}

function renderAudiencePresentation(assessment) {
  const presentation = AUDIENCE_PRESENTATION[state.audience] || AUDIENCE_PRESENTATION.clinician;
  const clinician = state.audience === "clinician";
  $("#summary-kicker").textContent = presentation.kicker;
  $("#summary-heading").textContent = clinician ? currentClinicalBrief(assessment).overallDistress.headline : presentation.heading;
  $("#audience-boundary").textContent = presentation.boundary;
  $("#edit-summary-label").textContent = presentation.editLabel;
  $("#print-button-label").textContent = presentation.printLabel;
  $("#edit-dialog-kicker").textContent = presentation.editKicker;
  $("#edit-dialog-help").textContent = presentation.editHelp;
  const sheet = $("#review-report-sheet");
  sheet.setAttribute("aria-label", `${presentation.label} summary preview`);
  sheet.classList.toggle("audience-preview", !clinician);
  $("#draft-stamp").innerHTML = clinician
    ? assessment.status === "approved"
      ? "<span></span> Approved clinician artifact"
      : "<span></span> Generated draft · review required"
    : "<span></span> Audience handoff preview · clinician approval separate";

  const feedback = $("#feedback-open");
  feedback.disabled = !clinician;
  feedback.title = clinician ? "" : "Switch to the clinician audience to return the clinical draft.";
  if (!clinician) {
    const approve = $("#approve-button");
    approve.disabled = true;
    $("#dock-status").textContent = "Audience preview only";
    $("#dock-help").textContent = "Switch to Clinician before making a clinical approval or return decision.";
  }
}

function signalBars(assessment) {
  return ["depression", "anxiety", "anger"].map(key => {
    const level = resolveScaleLevel(assessment, key);
    return `<span class="mini-signal ${level}" title="${key}: ${level}"></span>`;
  }).join("");
}

function renderQueue(filter = "") {
  const query = filter.trim().toLowerCase();
  const rows = state.assessments.map((assessment, index) => ({ assessment, index })).filter(({ assessment }) => assessment.id.toLowerCase().includes(query));
  $("#queue-body").innerHTML = rows.map(({ assessment, index }) => `<tr data-record-index="${index}">
    <td><span class="record-id">${escapeHTML(displayRecordId(assessment.id))}</span><span class="record-detail">105 scored responses</span></td>
    <td>${escapeHTML(assessment.completedAt)}</td>
    <td><span class="signal-stack">${signalBars(assessment)}</span></td>
    <td>${escapeHTML(assessment.reviewer)}</td>
    <td><span class="status-badge status-${escapeHTML(assessment.status)}">${escapeHTML(assessment.status)}</span></td>
    <td><button class="row-open" type="button" aria-label="Open record ${escapeHTML(displayRecordId(assessment.id))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></td>
  </tr>`).join("") || `<tr><td colspan="6">No records match that ID.</td></tr>`;

  $$("#queue-body tr[data-record-index]").forEach(row => {
    const open = async () => {
      try {
        await loadAssessment(Number(row.dataset.recordIndex));
      } catch (error) {
        showToast(error.message);
      }
    };
    row.addEventListener("click", open);
  });
}

function buildRatings() {
  $$(".rating-options").forEach(container => {
    container.innerHTML = [1,2,3,4,5].map(value => `<label><input type="radio" name="${escapeHTML(container.dataset.rating)}" value="${value}" required><span>${value}</span></label>`).join("");
  });
}

function audit(action, detail, actor = state.reviewerCode) {
  state.audit.unshift({
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()),
    actor,
    action,
    detail
  });
  renderAudit();
}

function openDialog(selector) {
  const dialog = $(selector);
  if (typeof dialog.showModal !== "function" || dialog.open) return;
  dialogOpeners.set(dialog, document.activeElement);
  dialog.showModal();
  window.requestAnimationFrame(() => dialog.querySelector("[aria-labelledby] h2, h2")?.focus());
}

function closeDialog(selector) {
  const dialog = $(selector);
  if (dialog.open) dialog.close();
}

function selectContentTab(tab, { focus = false } = {}) {
  const tabs = $$(".content-tab");
  tabs.forEach(candidate => {
    const selected = candidate === tab;
    candidate.classList.toggle("active", selected);
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    const panel = $(`#${candidate.getAttribute("aria-controls")}`);
    if (panel) panel.hidden = !selected;
  });
  if (focus) tab.focus();
}

function addEventListeners() {
  $$("dialog").forEach(dialog => dialog.addEventListener("close", () => {
    const opener = dialogOpeners.get(dialog);
    dialogOpeners.delete(dialog);
    if (opener?.isConnected) opener.focus();
  }));

  $$(".nav-item").forEach(button => button.addEventListener("click", event => switchView(button.dataset.view, { focus: event.detail === 0 })));
  $$('[data-view-jump]').forEach(button => button.addEventListener("click", event => switchView(button.dataset.viewJump, { focus: event.detail === 0 })));
  $(".primary-nav")?.addEventListener("click", event => {
    const button = event.target.closest(".nav-item[data-view]");
    if (button) switchView(button.dataset.view, { focus: event.detail === 0 });
  });
  $("#main-content")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view-jump]");
    if (button) switchView(button.dataset.viewJump, { focus: event.detail === 0 });
  });
  $$("[data-experience-mode]").forEach(button => button.addEventListener("click", event => chooseExperienceMode(button.dataset.experienceMode, { focus: event.detail === 0 })));
  $("#open-clinical-mode").addEventListener("click", event => chooseExperienceMode("clinical", { focus: event.detail === 0 }));
  $("#workspace-profile-form").addEventListener("change", event => {
    if (event.target.matches('#workspace-module-options input[type="checkbox"]')) {
      const label = event.target.closest("label");
      if (label) label.querySelector("small").textContent = event.target.checked ? "Shown" : "Hidden";
    }
    renderStudioPreview(workspaceDraftFromForm());
    $("#workspace-save-announcement").textContent = "Unsaved workspace changes · clinical content and permissions remain unchanged.";
  });
  $("#demographic-dimension").addEventListener("change", event => {
    renderDemographicLens(event.target.value);
    $("#workspace-save-announcement").textContent = "Unsaved demographic view · aggregate display only.";
  });
  $("#workspace-profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const profile = workspaceDraftFromForm();
    const button = $("#save-workspace-profile");
    button.disabled = true;
    button.textContent = "Saving profile…";
    try {
      if (state.connected) {
        const result = await state.api.saveWorkspaceExperience(profile);
        renderWorkspaceExperience(result.workspace);
        $("#workspace-save-announcement").textContent = result.changed ? "Workspace profile saved." : "The workspace already matches these settings.";
      } else {
        const savedAt = state.hostedEvaluation ? new Date().toISOString() : null;
        renderWorkspaceExperience({ ...state.workspaceExperience, profile, saved: state.hostedEvaluation, savedAt });
        persistHostedEvaluation();
        $("#workspace-save-announcement").textContent = state.hostedEvaluation
          ? "Workspace profile saved in this browser."
          : "Profile applied for this in-memory session only.";
      }
      showToast("Workspace profile saved. Safety, evidence content, and clinical authority remain unchanged.");
    } catch (error) {
      $("#workspace-save-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Save workspace profile";
    }
  });
  $("#campus-candidate-tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-campus-candidate]");
    if (!button || !state.campusObservatory?.candidates?.some(item => item.id === button.dataset.campusCandidate)) return;
    state.campusCandidateId = button.dataset.campusCandidate;
    renderCampusObservatory(state.campusObservatory);
  });
  $("#campus-review-tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-campus-review]");
    if (!button || !state.campusObservatory?.reviewMoments?.some(item => item.id === button.dataset.campusReview)) return;
    state.campusReviewMomentId = button.dataset.campusReview;
    renderCampusObservatory(state.campusObservatory);
  });
  $("#campus-customization-options").addEventListener("change", event => {
    if (event.target.name === "customizationPositionId") state.campusCustomizationPositionId = event.target.value;
  });
  $("#campus-snapshot-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected || !state.campusObservatory) return showToast("Connect the local synthetic workspace before recording an aggregate review posture.");
    const button = $("#seal-campus-snapshot");
    const form = new FormData(event.currentTarget);
    const payload = {
      candidateId: state.campusCandidateId,
      reviewMomentId: state.campusReviewMomentId,
      customizationPositionId: form.get("customizationPositionId")
    };
    state.campusCustomizationPositionId = payload.customizationPositionId;
    button.disabled = true;
    button.textContent = "Sealing aggregate posture…";
    try {
      const result = await state.api.recordCampusObservatorySnapshot(payload);
      renderCampusObservatory(result.campusObservatory);
      $("#campus-snapshot-announcement").textContent = `Posture ${String(result.event.sequence).padStart(2, "0")} sealed · no quarter, site, or pilot claim.`;
      showToast("Aggregate quarterly-review posture sealed. No student record, site verification, customization approval, pilot, outcome, or patient-use authority was created.");
    } catch (error) {
      renderCampusObservatory(state.campusObservatory);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Seal review posture";
    }
  });
  $("#print-campus-view").addEventListener("click", () => window.print());
  $("#view-fieldwork").addEventListener("click", event => {
    const button = event.target.closest("[data-fieldwork-destination]");
    if (!button) return;
    const destination = button.dataset.fieldworkDestination;
    const view = destination === "review" ? "review" : ["reference-room", "reference-adjudication", "reference-decision"].includes(destination) ? "fieldwork" : "calibration";
    switchView(view);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = destination === "review" ? $("#review-title") : $(`#${destination}`);
      if (!target) return;
      target.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      const focusTarget = target.matches("form") ? target.querySelector("input, select, textarea, button") : target;
      if (!focusTarget) return;
      if (!focusTarget.matches("input, select, textarea, button, a[href], [tabindex]")) focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }));
  });

  $("#reference-case").addEventListener("change", event => {
    state.counselorReferenceCaseId = event.target.value;
    renderCounselorReferenceCase(event.target.value);
  });

  $("#add-reference-theme").addEventListener("click", () => {
    const themes = $$("#reference-themes [data-reference-theme]");
    if (themes.length >= 4) return showToast("A source-only reference draft supports up to four clinical themes.");
    const selected = state.counselorReferenceRoom?.cases.find(item => item.assessmentId === state.counselorReferenceCaseId);
    $("#reference-themes").insertAdjacentHTML("beforeend", counselorReferenceThemeMarkup({}, themes.length, selected?.sourceProfile || {}));
    renumberCounselorReferenceEditors();
    $("#reference-themes [data-reference-theme]:last-child .reference-theme-title")?.focus();
  });

  $("#reference-themes").addEventListener("click", event => {
    const remove = event.target.closest(".reference-theme-remove");
    if (!remove) return;
    if ($$("#reference-themes [data-reference-theme]").length <= 1) return showToast("At least one evidence-bound theme is required.");
    remove.closest("[data-reference-theme]").remove();
    renumberCounselorReferenceEditors();
  });

  $("#add-reference-question").addEventListener("click", () => {
    const questions = $$("#reference-questions .reference-question");
    if (questions.length >= 6) return showToast("A source-only reference draft supports up to six follow-up questions.");
    $("#reference-questions").insertAdjacentHTML("beforeend", counselorReferenceQuestionMarkup("", questions.length));
    renumberCounselorReferenceEditors();
    $("#reference-questions .reference-question:last-child input")?.focus();
  });

  $("#reference-questions").addEventListener("click", event => {
    const remove = event.target.closest(".reference-question-remove");
    if (!remove) return;
    if ($$("#reference-questions .reference-question").length <= 2) return showToast("At least two direct follow-up questions are required.");
    remove.closest(".reference-question").remove();
    renumberCounselorReferenceEditors();
  });

  $("#reference-draft-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording a source-only draft.");
    const selected = state.counselorReferenceRoom?.cases.find(item => item.assessmentId === state.counselorReferenceCaseId);
    if (!selected) return showToast("Choose a frozen development case before drafting.");
    const themes = $$("#reference-themes [data-reference-theme]").map(theme => ({
      title: theme.querySelector(".reference-theme-title").value.trim(),
      body: theme.querySelector(".reference-theme-body").value.trim(),
      confidence: theme.querySelector(".reference-theme-confidence").value,
      evidence: [...theme.querySelectorAll('.reference-evidence-options input[type="checkbox"]:checked')].map(input => input.value),
      uncertainty: theme.querySelector(".reference-theme-uncertainty").value.trim()
    }));
    if (themes.some(theme => theme.evidence.length < 1)) return showToast("Every reference theme needs at least one scored evidence link.");
    const toneMarkers = $$('#reference-tone-markers input[type="checkbox"]:checked').map(input => input.value);
    if (toneMarkers.length < 3) return showToast("Select at least three fixed tone markers.");
    const payload = {
      assessmentId: selected.assessmentId,
      sourceProfileHash: selected.sourceProfileHash,
      authoringMode: "source-only",
      summary: $("#reference-summary").value.trim(),
      themes,
      questions: $$("#reference-questions .reference-question-value").map(input => input.value.trim()),
      toneMarkers,
      criticalReviewDisposition: selected.sourceProfile.safety.directReviewRequired ? "requires-direct-review" : "routine-verification"
    };
    const button = $("#save-reference-draft");
    button.disabled = true;
    button.textContent = "Sealing source-only draft…";
    $("#reference-draft-status").classList.remove("failed");
    try {
      const result = await state.api.recordCounselorReferenceDraft(payload);
      renderCounselorReferenceRoom(result.referenceRoom);
      const { adjudication } = await state.api.counselorReferenceAdjudication();
      renderCounselorReferenceAdjudication(adjudication);
      const { referenceDecision } = await state.api.counselorReferenceDecision();
      renderCounselorReferenceDecision(referenceDecision);
      if (state.counselorFieldwork) renderCounselorFieldwork({ ...state.counselorFieldwork, referenceRoom: result.referenceRoom, adjudication, referenceDecision });
      $("#reference-draft-status").textContent = `Immutable draft ${String(result.draft.sequence).padStart(2, "0")} recorded from scored evidence only. It remains unaccepted and cannot enter the blind reference set from this room.`;
      $("#fieldwork-announcement").textContent = `Source-only reference draft ${String(result.draft.sequence).padStart(2, "0")} recorded for ${result.draft.assessmentId}. No counselor identity, acceptance, protocol freeze, or clinical authority was created.`;
      showToast("Source-only reference draft sealed. Acceptance and adjudication remain external.");
    } catch (error) {
      $("#reference-draft-status").classList.add("failed");
      $("#reference-draft-status").textContent = error.message;
      showToast(error.message);
    } finally {
      const currentCase = state.counselorReferenceRoom?.cases.find(item => item.assessmentId === selected.assessmentId);
      button.disabled = Boolean(currentCase?.draftedByCurrentReviewer);
      button.textContent = "Record source-only draft";
    }
  });

  $("#seal-reference-adjudication").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing an evidence dossier.");
    const button = $("#seal-reference-adjudication");
    button.disabled = true;
    button.textContent = "Sealing evidence state…";
    try {
      const result = await state.api.sealCounselorReferenceAdjudication();
      renderCounselorReferenceAdjudication(result.adjudication);
      const { referenceDecision } = await state.api.counselorReferenceDecision();
      renderCounselorReferenceDecision(referenceDecision);
      if (state.counselorFieldwork) renderCounselorFieldwork({ ...state.counselorFieldwork, adjudication: result.adjudication, referenceDecision });
      $("#fieldwork-announcement").textContent = `Reference adjudication evidence snapshot ${String(result.snapshot.sequence).padStart(2, "0")} is sealed. Disagreement remains unresolved and no reference decision or protocol freeze was created.`;
      showToast(result.created ? "Adjudication evidence state sealed. Decision authority remains external." : "The current adjudication evidence state was already sealed.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Seal current evidence state";
      showToast(error.message);
    }
  });

  $("#issue-reference-decision-challenge").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before issuing a decision challenge.");
    const button = $("#issue-reference-decision-challenge");
    button.disabled = true;
    button.textContent = "Binding exact dossier…";
    try {
      const result = await state.api.issueCounselorReferenceDecisionChallenge();
      renderCounselorReferenceDecision(result.referenceDecision);
      if (state.counselorFieldwork) renderCounselorFieldwork({ ...state.counselorFieldwork, referenceDecision: result.referenceDecision });
      $("#fieldwork-announcement").textContent = `A 24-hour counselor-reference decision challenge is bound to the exact sealed adjudication dossier. Four distinct external duties remain required.`;
      showToast(result.created ? "Exact decision challenge issued. PERL still cannot sign it." : "The current exact decision challenge is already active.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Issue exact 24-hour challenge";
      showToast(error.message);
    }
  });

  $("#reference-decision-attestation-file").addEventListener("change", async event => {
    state.counselorReferenceDecisionAttestation = null;
    const fileState = $("#reference-decision-file-state");
    const button = $("#verify-reference-decision-attestation");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No attestation selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.className = "failed";
      fileState.textContent = "Attestation exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const attestation = JSON.parse(await file.text());
      if (attestation?.contractVersion !== "perl-counselor-reference-decision-attestation/1.0") throw new Error("The selected file is not a counselor-reference decision attestation.");
      state.counselorReferenceDecisionAttestation = attestation;
      fileState.className = "ready";
      fileState.textContent = `${attestation.purpose?.replaceAll("-", " ") || "Signed duty"} · ${file.name}`;
      button.disabled = !state.connected || !state.counselorReferenceDecision?.activeChallenge || state.counselorReferenceDecision?.protocolFrozen;
    } catch (error) {
      fileState.className = "failed";
      fileState.textContent = error.message;
    }
  });

  $("#verify-reference-decision-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.counselorReferenceDecisionAttestation) return showToast("Choose one signed counselor-reference duty return first.");
    const button = $("#verify-reference-decision-attestation");
    button.disabled = true;
    button.textContent = "Verifying external signature…";
    try {
      const result = await state.api.verifyCounselorReferenceDecisionAttestation(state.counselorReferenceDecisionAttestation);
      state.counselorReferenceDecisionAttestation = null;
      $("#reference-decision-attestation-file").value = "";
      $("#reference-decision-file-state").className = "ready";
      $("#reference-decision-file-state").textContent = "External duty verified and committed to the immutable docket.";
      renderCounselorReferenceDecision(result.referenceDecision);
      if (state.counselorFieldwork) renderCounselorFieldwork({ ...state.counselorFieldwork, referenceDecision: result.referenceDecision });
      $("#fieldwork-announcement").textContent = `Counselor-reference duty ${result.event.attestation.purpose.replaceAll("-", " ")} verified against its externally provisioned key. Clinical validation and use authority remain unchanged.`;
      showToast(result.referenceDecision.protocolFrozen ? "Reference protocol frozen for independent review. No clinical validity was established." : "External duty verified. The next distinct duty remains open.");
    } catch (error) {
      $("#reference-decision-file-state").className = "failed";
      $("#reference-decision-file-state").textContent = error.message;
      button.disabled = false;
      showToast(error.message);
    } finally {
      button.textContent = "Verify next external duty";
    }
  });

  if (mobileNavigationBound) throw new Error("Mobile navigation was initialized more than once.");
  mobileNavigationBound = true;
  document.addEventListener("click", event => {
    const mobileMenu = event.target.closest("#mobile-menu");
    if (!mobileMenu) return;
    const sidebar = $(".sidebar");
    const open = sidebar.classList.toggle("open");
    mobileMenu.setAttribute("aria-expanded", String(open));
    mobileMenu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (open) window.requestAnimationFrame(() => sidebar.querySelector(".nav-item.active")?.focus());
  });

  $("#reviewer-profile").addEventListener("click", () => openDialog("#reviewer-dialog"));
  $("#save-reviewer").addEventListener("click", () => {
    const value = $("#reviewer-code").value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(value)) {
      return showToast("Use a 2–48 character reviewer code with letters, numbers, spaces, periods, underscores, or hyphens.");
    }
    state.reviewerCode = value;
    state.api.setActor(value);
    state.calibrationCase = null;
    resetCandidateReviewSurface();
    resetCandidateRetestSurface();
    resetTimingWorkspace();
    try { window.sessionStorage.setItem("perl-calibration-reviewer", value); } catch { /* session-only memory still works */ }
    renderReviewerIdentity();
    closeDialog("#reviewer-dialog");
    showToast(`Clinical review actions will now be attributed to ${value}.`);
    if (!$("#view-calibration").hidden && state.connected) void loadCalibrationCase(true);
    if (!$("#view-fieldwork").hidden && state.connected) void loadCounselorFieldwork(true);
    if (state.connected) void loadWorkspaceExperience({ applyDefault: true });
    if (state.connected) void Promise.all([state.api.candidateReview(), state.api.candidateRetest(), state.api.candidateRetestDisposition()])
      .then(([{ candidateReview }, { candidateRetest }, { candidateRetestDisposition }]) => {
        renderCandidateReview(candidateReview);
        renderCandidateRetest(candidateRetest);
        renderCandidateRetestDisposition(candidateRetestDisposition);
      })
      .catch(error => showToast(error.message));
  });

  $("#notebook-session-view").addEventListener("change", event => {
    state.counselorNotebookSessionId = event.target.value;
    renderCounselorNotebook(state.counselorNotebook);
  });

  $("#notebook-session").addEventListener("change", event => syncCounselorNotebookDecisionOptions(event.target.value));

  $("#model-trial-file").addEventListener("change", async event => {
    state.modelTrialManifest = null;
    const fileState = $("#model-trial-file-state");
    const button = $("#preflight-model-trial");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No manifest selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Manifest exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      state.modelTrialManifest = manifest;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for strict server preflight.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected manifest is not valid JSON.";
    }
  });

  $("#preflight-model-trial").addEventListener("click", async () => {
    if (!state.connected || !state.modelTrialManifest) return showToast("Choose a completed candidate metadata request before preflight.");
    const button = $("#preflight-model-trial");
    button.disabled = true;
    button.textContent = "Checking candidate metadata…";
    try {
      const result = await state.api.preflightModelTrial(state.modelTrialManifest);
      state.modelTrialManifest = null;
      $("#model-trial-file").value = "";
      $("#model-trial-file-state").className = "";
      $("#model-trial-file-state").textContent = "No manifest selected · 64 KB maximum";
      renderModelTrial(result.modelTrial);
      const [{ candidateTrial }, { candidateReturns }, { candidateReview }] = await Promise.all([state.api.candidateTrial(), state.api.candidateReturns(), state.api.candidateReview()]);
      renderCandidateTrial(candidateTrial);
      renderCandidateReturns(candidateReturns);
      renderCandidateReview(candidateReview);
      $("#model-trial-announcement").textContent = `Local preflight ${String(result.event.sequence).padStart(2, "0")} recorded: ${result.event.counts.metadataComplete} of 3 candidates and ${result.event.counts.domainEvidenceDeclared} of 18 evidence references are complete-unverified. No engine was selected or contacted.`;
      showToast("Candidate metadata preflighted. Vendor claims and engine selection remain unverified.");
    } catch (error) {
      $("#model-trial-file-state").classList.add("failed");
      $("#model-trial-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.modelTrialManifest;
      button.textContent = "Preflight candidate metadata";
    }
  });

  $("#snapshot-candidate-trial").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording planning evidence.");
    const button = $("#snapshot-candidate-trial");
    button.disabled = true;
    button.textContent = "Sealing current plan…";
    try {
      const result = await state.api.recordCandidateTrialSnapshot();
      renderCandidateTrial(result.candidateTrial);
      $("#candidate-trial-announcement").textContent = `Planning snapshot ${String(result.event.sequence).padStart(2, "0")} recorded with ${result.event.counts.gatesLocallySatisfied} of 7 gates locally satisfied. All 9 candidate runs remain held and trial execution remains unauthorized.`;
      showToast("Candidate trial plan sealed. No provider call or engine selection was authorized.");
    } catch (error) {
      $("#candidate-trial-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Record planning snapshot";
    }
  });

  $("#candidate-return-file").addEventListener("change", async event => {
    state.candidateReturnManifest = null;
    const fileState = $("#candidate-return-file-state");
    const button = $("#record-candidate-returns");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No return selected · 256 KB maximum";
      return;
    }
    if (file.size > 256 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Return exceeds the 256 KB contract limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      if (manifest?.contractVersion !== "perl-manual-candidate-return/1.0" || manifest?.environment !== "synthetic-calibration" || !Array.isArray(manifest?.returns) || manifest.returns.length < 1 || manifest.returns.length > 9) {
        throw new Error("This file is not a valid PERL manual candidate-return manifest.");
      }
      state.candidateReturnManifest = manifest;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${manifest.returns.length} return${manifest.returns.length === 1 ? "" : "s"} · ready for strict server verification.`;
      $("#candidate-return-announcement").textContent = "Ready to verify envelope bindings, generation provenance, ten output gates, and the synthetic-only boundary.";
      button.disabled = !state.connected;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = error instanceof SyntaxError ? "The selected return is not valid JSON." : error.message;
    }
  });

  $("#record-candidate-returns").addEventListener("click", async () => {
    if (!state.connected || !state.candidateReturnManifest) return showToast("Choose a completed candidate-return manifest before verification.");
    const button = $("#record-candidate-returns");
    button.disabled = true;
    button.textContent = "Verifying narrow return…";
    try {
      const result = await state.api.recordCandidateReturns(state.candidateReturnManifest);
      const count = result.events?.length || 0;
      state.candidateReturnManifest = null;
      $("#candidate-return-file").value = "";
      $("#candidate-return-file-state").className = "";
      $("#candidate-return-file-state").textContent = "No return selected · 256 KB maximum";
      renderCandidateReturns(result.candidateReturns);
      const [{ candidateReview }, { candidateRefinement }] = await Promise.all([state.api.candidateReview(), state.api.candidateRefinement()]);
      renderCandidateReview(candidateReview);
      renderCandidateRefinement(candidateRefinement);
      $("#candidate-return-announcement").textContent = result.idempotent
        ? `${count} previously sealed receipt${count === 1 ? " was" : "s were"} verified unchanged. No new ledger event was created.`
        : `${count} structured synthetic return${count === 1 ? "" : "s"} passed ten local output gates and entered the immutable ledger. Content remains closed; review and selection remain unauthorized.`;
      showToast(result.idempotent ? "Candidate return already sealed and unchanged." : "Candidate return sealed. Output remains held for separately governed blind review.");
    } catch (error) {
      $("#candidate-return-file-state").classList.add("failed");
      $("#candidate-return-file-state").textContent = error.message;
      $("#candidate-return-announcement").textContent = "Return rejected. Nothing entered the immutable ledger.";
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.candidateReturnManifest;
      button.textContent = "Verify + seal return";
    }
  });

  $("#open-candidate-review").addEventListener("click", () => void openCandidateReviewAssignment());
  $("#next-candidate-review").addEventListener("click", () => void openCandidateReviewAssignment());

  $("#candidate-review-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected || !state.candidateReviewAssignment) return showToast("Open a current blind packet before submitting a review.");
    const payload = candidateReviewPayload(event.currentTarget);
    const inconsistent = payload.cells.find(cell => (cell.correctionBurden === "none") !== (cell.correctionFlags.length === 0));
    if (inconsistent) {
      const message = inconsistent.correctionBurden === "none"
        ? `Blind ${inconsistent.blindPosition}: clear correction flags or choose a correction burden.`
        : `Blind ${inconsistent.blindPosition}: select at least one structured correction flag.`;
      $("#candidate-review-announcement").textContent = message;
      return showToast(message);
    }
    const button = $("#submit-candidate-review");
    button.disabled = true;
    button.textContent = "Sealing four blind cells…";
    try {
      const result = await state.api.submitCandidateReview(payload);
      state.candidateReviewAssignment = null;
      renderCandidateReview(result.candidateReview);
      const { candidateRefinement } = await state.api.candidateRefinement();
      renderCandidateRefinement(candidateRefinement);
      $("#candidate-review-form").hidden = true;
      $("#candidate-review-lobby").hidden = true;
      $("#candidate-review-receipt").hidden = false;
      $("#candidate-review-receipt-detail").textContent = `Receipt ${String(Number(result.receipt.sequence)).padStart(2, "0")} · ${result.receipt.caseId} · four blind cells · ${result.receipt.hash.slice(0, 14)}… · authorship not revealed.`;
      $("#candidate-review-announcement").textContent = "Anonymous outcome recorded. Candidate identity, reviewer identity, scores, ranking, and selection remain unverified or withheld.";
      $("#candidate-review-receipt").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Anonymous review sealed. The answer key remains closed.");
    } catch (error) {
      $("#candidate-review-announcement").textContent = error.message;
      button.disabled = false;
      showToast(error.message);
    } finally {
      button.textContent = "Seal anonymous review";
    }
  });

  $("#candidate-refinement-lane").addEventListener("change", () => syncCandidateRefinementSignals());
  $("#candidate-refinement-signal").addEventListener("change", renderCandidateRefinementSelection);
  $("#candidate-refinement-form").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = candidateRefinementPayload();
    if (!state.connected || !state.candidateRefinement?.cycleIssuanceEnabled || !payload) return showToast("A current eligible correction signal is required before a retest kit can be issued.");
    const button = $("#candidate-refinement-create");
    button.disabled = true;
    button.textContent = "Binding three baselines…";
    try {
      const result = await state.api.createCandidateRefinementCycle(payload);
      renderCandidateRefinement(result.candidateRefinement);
      const [{ candidateRetest }, { candidateRetestDisposition }] = await Promise.all([state.api.candidateRetest(result.cycle.cycleId), state.api.candidateRetestDisposition(result.cycle.cycleId)]);
      renderCandidateRetest(candidateRetest);
      renderCandidateRetestDisposition(candidateRetestDisposition);
      $("#candidate-refinement-announcement").textContent = `${result.cycle.laneLabel} cycle ${String(Number(result.cycle.cycleNumber)).padStart(2, "0")} issued with three content-free same-case envelopes. No model change or retest was performed.`;
      $("#candidate-refinement-cycles").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Same-case retest kit issued. Manual execution remains outside PERL.");
    } catch (error) {
      $("#candidate-refinement-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue same-case retest kit";
      button.disabled = !state.connected || !state.candidateRefinement?.cycleIssuanceEnabled || !candidateRefinementSignalForSelection();
    }
  });

  $("#candidate-retest-cycle").addEventListener("change", async event => {
    if (!state.connected || !event.target.value) return;
    state.candidateRetestManifest = null;
    state.candidateRetestAssignment = null;
    $("#candidate-retest-file").value = "";
    $("#candidate-retest-file-state").className = "";
    $("#candidate-retest-file-state").textContent = "No return selected · 256 KB maximum";
    resetCandidateRetestSurface();
    try {
      const [{ candidateRetest }, { candidateRetestDisposition }] = await Promise.all([state.api.candidateRetest(event.target.value), state.api.candidateRetestDisposition(event.target.value)]);
      renderCandidateRetest(candidateRetest);
      renderCandidateRetestDisposition(candidateRetestDisposition);
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#candidate-retest-file").addEventListener("change", async event => {
    state.candidateRetestManifest = null;
    const fileState = $("#candidate-retest-file-state");
    const button = $("#record-candidate-retest-returns");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No return selected · 256 KB maximum";
      return;
    }
    if (file.size > 256 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Return exceeds the 256 KB contract limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      if (manifest?.contractVersion !== "perl-candidate-retest-return/1.0" || manifest?.environment !== "synthetic-calibration" || manifest?.cycleId !== state.candidateRetest?.selectedCycleId || !Array.isArray(manifest?.returns) || manifest.returns.length < 1 || manifest.returns.length > 3) {
        throw new Error("This file is not a current PERL same-case retest-return manifest for the selected cycle.");
      }
      state.candidateRetestManifest = manifest;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${manifest.returns.length} exact return${manifest.returns.length === 1 ? "" : "s"} · ready for strict server verification.`;
      $("#candidate-retest-return-announcement").textContent = "Ready to verify the original case, baseline artifact, candidate and provider provenance, new prompt version, one intervention, ten output gates, and synthetic-only boundary.";
      button.disabled = !state.connected || !state.candidateRetest?.returnIntakeEnabled;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = error instanceof SyntaxError ? "The selected return is not valid JSON." : error.message;
    }
  });

  $("#record-candidate-retest-returns").addEventListener("click", async () => {
    if (!state.connected || !state.candidateRetestManifest || !state.candidateRetest?.returnIntakeEnabled) return showToast("Choose a current completed same-case return manifest before verification.");
    const button = $("#record-candidate-retest-returns");
    button.disabled = true;
    button.textContent = "Verifying exact returns…";
    try {
      const result = await state.api.recordCandidateRetestReturns(state.candidateRetestManifest);
      const count = result.receipts?.length || 0;
      state.candidateRetestManifest = null;
      $("#candidate-retest-file").value = "";
      $("#candidate-retest-file-state").className = "";
      $("#candidate-retest-file-state").textContent = "No return selected · 256 KB maximum";
      renderCandidateRetest(result.candidateRetest);
      const { candidateRetestDisposition } = await state.api.candidateRetestDisposition(result.candidateRetest.selectedCycleId);
      renderCandidateRetestDisposition(candidateRetestDisposition);
      $("#candidate-retest-return-announcement").textContent = result.idempotent
        ? `${count} previously sealed retest receipt${count === 1 ? " was" : "s were"} verified unchanged. No new ledger event was created.`
        : `${count} exact synthetic retest return${count === 1 ? "" : "s"} entered the immutable return ledger. External execution remains declared but unverified; no comparative result was created.`;
      showToast(result.idempotent ? "Retest return already sealed and unchanged." : "Exact retest return sealed. X/Y review remains separately governed.");
    } catch (error) {
      $("#candidate-retest-file-state").classList.add("failed");
      $("#candidate-retest-file-state").textContent = error.message;
      $("#candidate-retest-return-announcement").textContent = "Retest return rejected. Nothing entered the immutable ledger.";
      showToast(error.message);
    } finally {
      button.textContent = "Verify + seal exact returns";
      button.disabled = !state.connected || !state.candidateRetestManifest || !state.candidateRetest?.returnIntakeEnabled;
    }
  });

  $("#open-candidate-retest-review").addEventListener("click", () => void openCandidateRetestReviewAssignment());
  $("#next-candidate-retest-review").addEventListener("click", () => void openCandidateRetestReviewAssignment());

  $("#candidate-retest-review-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected || !state.candidateRetestAssignment) return showToast("Open a current X/Y packet before submitting a paired reading.");
    const payload = candidateRetestReviewPayload(event.currentTarget);
    const inconsistent = payload.cells.find(cell => (cell.correctionBurden === "none") !== (cell.correctionFlags.length === 0));
    if (inconsistent) {
      const message = inconsistent.correctionBurden === "none"
        ? `Blind ${inconsistent.blindPosition}: clear correction flags or choose a correction burden.`
        : `Blind ${inconsistent.blindPosition}: select at least one structured correction flag.`;
      $("#candidate-retest-return-announcement").textContent = message;
      return showToast(message);
    }
    const button = $("#submit-candidate-retest-review");
    button.disabled = true;
    button.textContent = "Sealing paired reading…";
    try {
      const result = await state.api.submitCandidateRetestReview(payload);
      state.candidateRetestAssignment = null;
      event.currentTarget.reset();
      renderCandidateRetest(result.candidateRetest);
      const { candidateRetestDisposition } = await state.api.candidateRetestDisposition(result.candidateRetest.selectedCycleId);
      renderCandidateRetestDisposition(candidateRetestDisposition);
      $("#candidate-retest-review-form").hidden = true;
      $("#candidate-retest-lobby").hidden = true;
      $("#candidate-retest-receipt").hidden = false;
      $("#candidate-retest-receipt-detail").textContent = `Receipt ${String(Number(result.receipt.sequence)).padStart(2, "0")} · ${result.receipt.caseId} · two blind cells · ${result.receipt.hash.slice(0, 14)}… · baseline/retest mapping not revealed.`;
      $("#candidate-retest-return-announcement").textContent = "Paired judgment recorded. Ratings, corrections, dissent, use disposition, and bounded difference are preserved without an improvement, performance, ranking, or selection claim.";
      $("#candidate-retest-receipt").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Paired reading sealed. The X/Y mapping remains closed.");
    } catch (error) {
      $("#candidate-retest-return-announcement").textContent = error.message;
      button.disabled = false;
      showToast(error.message);
    } finally {
      button.textContent = "Seal paired reading";
    }
  });

  $("#candidate-disposition-cycle").addEventListener("change", async event => {
    if (!state.connected || !event.target.value) return;
    state.candidateRetestDispositionAttestation = null;
    $("#candidate-disposition-file").value = "";
    $("#candidate-disposition-file-state").className = "";
    $("#candidate-disposition-file-state").textContent = "No signed envelope selected.";
    try {
      const { candidateRetestDisposition } = await state.api.candidateRetestDisposition(event.target.value);
      renderCandidateRetestDisposition(candidateRetestDisposition);
    } catch (error) {
      $("#candidate-disposition-announcement").textContent = error.message;
      showToast(error.message);
    }
  });

  $("#issue-candidate-disposition-challenge").addEventListener("click", async () => {
    const cycleId = state.candidateRetestDisposition?.cycleId;
    if (!state.connected || !cycleId) return showToast("Select one current same-case cycle before issuing a result challenge.");
    const button = $("#issue-candidate-disposition-challenge");
    button.disabled = true;
    button.textContent = "Binding frozen evidence…";
    try {
      const result = await state.api.issueCandidateRetestDispositionChallenge(cycleId);
      renderCandidateRetestDisposition(result.candidateRetestDisposition);
      $("#candidate-disposition-announcement").textContent = `${result.created ? "New" : "Current"} 24-hour result challenge ready. Four ordered external duties remain bound to this exact synthetic cycle.`;
      showToast(result.created ? "Independent result challenge issued." : "Current result challenge reused.");
    } catch (error) {
      renderCandidateRetestDisposition(state.candidateRetestDisposition);
      $("#candidate-disposition-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue result challenge";
    }
  });

  $("#candidate-disposition-file").addEventListener("change", async event => {
    state.candidateRetestDispositionAttestation = null;
    const fileState = $("#candidate-disposition-file-state");
    const button = $("#verify-candidate-disposition-attestation");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No signed envelope selected.";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Envelope exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Envelope must be one JSON object.");
      if (parsed.contractVersion !== "perl-candidate-retest-disposition-attestation/1.0") throw new Error("Envelope contract is not the PERL candidate retest disposition attestation contract.");
      state.candidateRetestDispositionAttestation = parsed;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${candidateDispositionValue(parsed.purpose)} · ready for local Ed25519 verification.`;
      button.disabled = !state.connected || !state.candidateRetestDisposition?.activeChallenge || state.candidateRetestDisposition?.independentResultFrozen;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = `Envelope rejected before verification: ${error.message}`;
    }
  });

  $("#verify-candidate-disposition-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.candidateRetestDispositionAttestation) return showToast("Select one signed result-disposition envelope first.");
    const button = $("#verify-candidate-disposition-attestation");
    button.disabled = true;
    button.textContent = "Verifying outside signature…";
    try {
      const result = await state.api.verifyCandidateRetestDispositionAttestation(state.candidateRetestDispositionAttestation);
      state.candidateRetestDispositionAttestation = null;
      $("#candidate-disposition-file").value = "";
      $("#candidate-disposition-file-state").className = "verified";
      $("#candidate-disposition-file-state").textContent = `${candidateDispositionValue(result.event.attestation.purpose)} verified and hash-linked.`;
      renderCandidateRetestDisposition(result.candidateRetestDisposition);
      const { candidateAdvancement } = await state.api.candidateAdvancement(result.candidateRetestDisposition.cycleId);
      renderCandidateAdvancement(candidateAdvancement);
      const verified = Number(result.candidateRetestDisposition.counts?.verifiedExternalDuties || 0);
      $("#candidate-disposition-announcement").textContent = `External duty ${verified} of 4 verified. ${result.candidateRetestDisposition.independentResultFrozen ? "The exact-cycle disposition is frozen; no cycle, release, or patient-use authority was created." : "The next purpose-bound signature remains external."}`;
      showToast(result.candidateRetestDisposition.independentResultFrozen ? "Independent exact-cycle result frozen." : "External disposition duty verified.");
    } catch (error) {
      $("#candidate-disposition-file-state").className = "failed";
      $("#candidate-disposition-file-state").textContent = `Envelope rejected: ${error.message}`;
      $("#candidate-disposition-announcement").textContent = "Signature or evidence binding failed. Nothing entered the disposition ledger.";
      showToast(error.message);
    } finally {
      button.textContent = "Verify next signed duty";
      button.disabled = !state.connected || !state.candidateRetestDispositionAttestation || !state.candidateRetestDisposition?.activeChallenge || state.candidateRetestDisposition?.independentResultFrozen;
    }
  });

  $("#candidate-advancement-cycle").addEventListener("change", async event => {
    if (!state.connected || !event.target.value) return;
    state.candidateCycleActionAttestation = null;
    state.candidateAdvancementAttestation = null;
    for (const [fileId, stateId, copy] of [
      ["candidate-cycle-action-file", "candidate-cycle-action-file-state", "No signed Room I envelope selected."],
      ["candidate-advancement-file", "candidate-advancement-file-state", "No signed Room II envelope selected."]
    ]) {
      $(`#${fileId}`).value = "";
      $(`#${stateId}`).className = "";
      $(`#${stateId}`).textContent = copy;
    }
    try {
      const { candidateAdvancement } = await state.api.candidateAdvancement(event.target.value);
      renderCandidateAdvancement(candidateAdvancement);
    } catch (error) {
      $("#candidate-advancement-announcement").textContent = error.message;
      showToast(error.message);
    }
  });

  $("#issue-candidate-cycle-action-challenge").addEventListener("click", async () => {
    const cycleId = state.candidateAdvancement?.cycleId;
    if (!state.connected || !cycleId) return showToast("Select one exact cycle before issuing a Room I challenge.");
    const button = $("#issue-candidate-cycle-action-challenge");
    button.disabled = true;
    button.textContent = "Binding independent result…";
    try {
      const result = await state.api.issueCandidateCycleActionChallenge(cycleId);
      renderCandidateAdvancement(result.candidateAdvancement);
      $("#candidate-advancement-announcement").textContent = `${result.created ? "New" : "Current"} Room I challenge ready. The clinical action and custody confirmation remain external.`;
      showToast(result.created ? "Room I cycle-action challenge issued." : "Current Room I challenge reused.");
    } catch (error) {
      renderCandidateAdvancement(state.candidateAdvancement);
      $("#candidate-advancement-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue Room I challenge";
    }
  });

  $("#candidate-cycle-action-file").addEventListener("change", async event => {
    state.candidateCycleActionAttestation = null;
    const fileState = $("#candidate-cycle-action-file-state");
    const button = $("#verify-candidate-cycle-action-attestation");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No signed Room I envelope selected.");
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Room I envelope exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Envelope must be one JSON object.");
      if (parsed.contractVersion !== "perl-candidate-cycle-action-attestation/1.0") throw new Error("Envelope contract is not the PERL cycle-action attestation contract.");
      state.candidateCycleActionAttestation = parsed;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${candidateDispositionValue(parsed.purpose)} · ready for local Ed25519 verification.`;
      button.disabled = !state.connected || !state.candidateAdvancement?.rooms?.cycleAction?.activeChallenge || state.candidateAdvancement?.cycleActionFrozen;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = `Room I envelope rejected before verification: ${error.message}`;
    }
  });

  $("#verify-candidate-cycle-action-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.candidateCycleActionAttestation) return showToast("Select one signed Room I envelope first.");
    const button = $("#verify-candidate-cycle-action-attestation");
    button.disabled = true;
    button.textContent = "Verifying Room I signature…";
    try {
      const result = await state.api.verifyCandidateCycleActionAttestation(state.candidateCycleActionAttestation);
      state.candidateCycleActionAttestation = null;
      $("#candidate-cycle-action-file").value = "";
      $("#candidate-cycle-action-file-state").className = "verified";
      $("#candidate-cycle-action-file-state").textContent = `${candidateDispositionValue(result.event.attestation.purpose)} verified and hash-linked.`;
      renderCandidateAdvancement(result.candidateAdvancement);
      const verified = Number(result.candidateAdvancement.counts?.cycleActionDutiesVerified || 0);
      $("#candidate-advancement-announcement").textContent = `Room I duty ${verified} of 2 verified. ${result.candidateAdvancement.cycleActionFrozen ? result.candidateAdvancement.cycleClosed ? "The exact cycle is closed; Room II opens only if the candidate recommendation and provenance are current." : "The cycle action is frozen without a close; Room II remains sealed." : "The custody confirmation remains external."}`;
      showToast(result.candidateAdvancement.cycleActionFrozen ? "Exact cycle action frozen." : "Room I duty verified.");
    } catch (error) {
      $("#candidate-cycle-action-file-state").className = "failed";
      $("#candidate-cycle-action-file-state").textContent = `Room I envelope rejected: ${error.message}`;
      $("#candidate-advancement-announcement").textContent = "Room I signature or evidence binding failed. Nothing entered the ledger.";
      showToast(error.message);
    } finally {
      button.textContent = "Verify next Room I duty";
      button.disabled = !state.connected || !state.candidateCycleActionAttestation || !state.candidateAdvancement?.rooms?.cycleAction?.activeChallenge || state.candidateAdvancement?.cycleActionFrozen;
    }
  });

  $("#issue-candidate-advancement-challenge").addEventListener("click", async () => {
    const cycleId = state.candidateAdvancement?.cycleId;
    if (!state.connected || !cycleId) return showToast("Select the exact closed cycle before issuing a Room II challenge.");
    const button = $("#issue-candidate-advancement-challenge");
    button.disabled = true;
    button.textContent = "Binding exact candidate tuple…";
    try {
      const result = await state.api.issueCandidateAdvancementChallenge(cycleId);
      renderCandidateAdvancement(result.candidateAdvancement);
      $("#candidate-advancement-announcement").textContent = `${result.created ? "New" : "Current"} Room II challenge ready. Four external duties bind the disclosed exact candidate package.`;
      showToast(result.created ? "Room II exact-candidate challenge issued." : "Current Room II challenge reused.");
    } catch (error) {
      renderCandidateAdvancement(state.candidateAdvancement);
      $("#candidate-advancement-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue Room II challenge";
    }
  });

  $("#candidate-advancement-file").addEventListener("change", async event => {
    state.candidateAdvancementAttestation = null;
    const fileState = $("#candidate-advancement-file-state");
    const button = $("#verify-candidate-advancement-attestation");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No signed Room II envelope selected.");
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Room II envelope exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Envelope must be one JSON object.");
      if (parsed.contractVersion !== "perl-candidate-advancement-attestation/1.0") throw new Error("Envelope contract is not the PERL candidate-advancement attestation contract.");
      state.candidateAdvancementAttestation = parsed;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${candidateDispositionValue(parsed.purpose)} · ready for exact-package and Ed25519 verification.`;
      button.disabled = !state.connected || !state.candidateAdvancement?.rooms?.candidateAdvancement?.activeChallenge || state.candidateAdvancement?.candidateAdvancementFrozen;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = `Room II envelope rejected before verification: ${error.message}`;
    }
  });

  $("#verify-candidate-advancement-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.candidateAdvancementAttestation) return showToast("Select one signed Room II envelope first.");
    const button = $("#verify-candidate-advancement-attestation");
    button.disabled = true;
    button.textContent = "Verifying exact-candidate duty…";
    try {
      const result = await state.api.verifyCandidateAdvancementAttestation(state.candidateAdvancementAttestation);
      state.candidateAdvancementAttestation = null;
      $("#candidate-advancement-file").value = "";
      $("#candidate-advancement-file-state").className = "verified";
      $("#candidate-advancement-file-state").textContent = `${candidateDispositionValue(result.event.attestation.purpose)} verified and hash-linked.`;
      renderCandidateAdvancement(result.candidateAdvancement);
      const verified = Number(result.candidateAdvancement.counts?.candidateAdvancementDutiesVerified || 0);
      $("#candidate-advancement-announcement").textContent = `Room II duty ${verified} of 4 verified. ${result.candidateAdvancement.candidateAdvancementFrozen ? "The exact candidate decision is frozen for integration-readiness work only; release, traffic, pilot, and patient use remain off." : "The next purpose-bound duty remains external."}`;
      showToast(result.candidateAdvancement.candidateAdvancementFrozen ? "Exact candidate advancement decision frozen." : "Room II duty verified.");
    } catch (error) {
      $("#candidate-advancement-file-state").className = "failed";
      $("#candidate-advancement-file-state").textContent = `Room II envelope rejected: ${error.message}`;
      $("#candidate-advancement-announcement").textContent = "Room II signature or exact-package binding failed. Nothing entered the ledger.";
      showToast(error.message);
    } finally {
      button.textContent = "Verify next Room II duty";
      button.disabled = !state.connected || !state.candidateAdvancementAttestation || !state.candidateAdvancement?.rooms?.candidateAdvancement?.activeChallenge || state.candidateAdvancement?.candidateAdvancementFrozen;
    }
  });

  $("#counselor-notebook-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording a rehearsal observation.");
    const form = new FormData(event.currentTarget);
    const button = $("#save-counselor-notebook");
    const payload = {
      sessionId: form.get("sessionId"),
      decisionId: form.get("decisionId"),
      disposition: form.get("disposition"),
      finding: form.get("finding"),
      evidenceSource: form.get("evidenceSource"),
      assessmentId: form.get("assessmentId") || null
    };
    button.disabled = true;
    button.textContent = "Recording observation…";
    try {
      const result = await state.api.recordCounselorNotebookEntry(payload);
      state.counselorNotebookSessionId = payload.sessionId;
      renderCounselorNotebook(result.counselorNotebook);
      if (state.counselorFieldwork) renderCounselorFieldwork({ ...state.counselorFieldwork, notebook: result.counselorNotebook });
      $("#counselor-notebook-announcement").textContent = `Local rehearsal note ${String(result.entry.sequence).padStart(2, "0")} recorded. No attendance, clinical acceptance, or protocol freeze was created.`;
      showToast("Local rehearsal observation recorded. No counselor or clinical authority was claimed.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Record local observation";
    }
  });

  $("#progress-observation-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording a rehearsal observation.");
    const form = new FormData(event.currentTarget);
    const button = $("#save-progress-observation");
    const payload = {
      seriesId: form.get("seriesId"),
      focus: form.get("focus"),
      finding: form.get("finding"),
      disposition: form.get("disposition")
    };
    button.disabled = true;
    button.textContent = "Recording observation…";
    try {
      const result = await state.api.recordProgressReviewObservation(payload);
      renderProgressReview(result.progressReview);
      $("#progress-observation-status").textContent = `Local rehearsal observation ${String(result.event.sequence).padStart(2, "0")} recorded. No progress, treatment-response, or care-plan claim was created.`;
      showToast("Raw-score observation recorded without creating a clinical progress claim.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Record rehearsal observation";
    }
  });

  $("#clinical-standard-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected) return showToast("Connect the local workspace before recording an immutable draft.");
    const form = new FormData(event.currentTarget);
    const button = $("#save-clinical-standard");
    const payload = {
      thresholds: {
        minimumBlindPreferenceRate: form.get("minimumBlindPreferenceRate"),
        minimumMedianAccuracy: form.get("minimumMedianAccuracy"),
        minimumMedianRestraint: form.get("minimumMedianRestraint"),
        minimumMedianUtility: form.get("minimumMedianUtility"),
        maximumMaterialCorrectionsPer100: form.get("maximumMaterialCorrectionsPer100"),
        minimumPreferenceAgreementAc1: form.get("minimumPreferenceAgreementAc1"),
        maximumMedianAssistedMinutes: form.get("maximumMedianAssistedMinutes")
      },
      rationale: form.get("rationale")
    };
    button.disabled = true;
    button.textContent = "Sealing draft…";
    try {
      const result = await state.api.saveClinicalStandardDraft(payload);
      renderClinicalStandard(result.clinicalStandard);
      const { independentReview } = await state.api.independentReview();
      renderIndependentReview(independentReview);
      const { independentReviewAdmission } = await state.api.independentReviewAdmission();
      renderIndependentReviewAdmission(independentReviewAdmission);
      $("#clinical-standard-announcement").textContent = `Working draft v${String(result.draft.version).padStart(2, "0")} recorded. ${result.draft.preOutcomeCandidate ? "No outcome evidence was present at creation." : "Outcome evidence already existed; the draft is permanently labeled post-outcome."}`;
      showToast("Clinical-standard working draft sealed. No approval or release claim was created.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Record immutable draft";
    }
  });

  $("#seal-independent-review").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing the independent-review dossier.");
    const button = $("#seal-independent-review");
    button.disabled = true;
    button.textContent = "Sealing dossier…";
    try {
      const result = await state.api.sealIndependentReview();
      renderIndependentReview(result.independentReview);
      const { independentReviewAdmission } = await state.api.independentReviewAdmission();
      renderIndependentReviewAdmission(independentReviewAdmission);
      $("#independent-review-announcement").textContent = `Local dossier seal ${String(result.event.sequence).padStart(2, "0")} recorded. ${result.event.gateCounts.externalAccepted === 1 ? "One verified upstream dependency was bound and five outside decisions remain open." : "All six external decisions remain open."} No evaluator result was recorded.`;
      showToast("Independent-review evidence packaged. Accuracy, reliability, validation, and release remain unclaimed.");
    } catch (error) {
      renderIndependentReview(state.independentReview);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Seal local dossier";
    }
  });

  $("#issue-independent-admission-challenge").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local workspace before issuing an admission challenge.");
    const button = $("#issue-independent-admission-challenge");
    button.disabled = true;
    button.textContent = "Issuing challenge…";
    try {
      const result = await state.api.issueIndependentReviewAdmissionChallenge();
      renderIndependentReviewAdmission(result.independentReviewAdmission);
      $("#independent-admission-announcement").textContent = `${result.created ? "New" : "Current"} 24-hour admission challenge ready. Seven ordered external duties remain bounded to the exact evidence state.`;
      showToast(result.created ? "Independent-review admission challenge issued." : "Current admission challenge reused.");
    } catch (error) {
      renderIndependentReviewAdmission(state.independentReviewAdmission);
      showToast(error.message);
    }
  });

  $("#independent-admission-file").addEventListener("change", async event => {
    state.independentReviewAdmissionAttestation = null;
    const fileState = $("#independent-admission-file-state");
    const button = $("#verify-independent-admission-attestation");
    button.disabled = true;
    fileState.className = "admission-file-state";
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No signed envelope selected.";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Envelope exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Envelope must be one JSON object.");
      state.independentReviewAdmissionAttestation = parsed;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ready for local signature verification.`;
      button.disabled = !state.connected || !state.independentReviewAdmission?.activeChallenge;
    } catch (error) {
      fileState.classList.add("failed");
      fileState.textContent = `Envelope rejected before verification: ${error.message}`;
    }
  });

  $("#verify-independent-admission-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.independentReviewAdmissionAttestation) return showToast("Select one signed metadata envelope first.");
    const button = $("#verify-independent-admission-attestation");
    button.disabled = true;
    button.textContent = "Verifying signature…";
    try {
      const result = await state.api.verifyIndependentReviewAdmissionAttestation(state.independentReviewAdmissionAttestation);
      state.independentReviewAdmissionAttestation = null;
      $("#independent-admission-file").value = "";
      $("#independent-admission-file-state").className = "admission-file-state verified";
      $("#independent-admission-file-state").textContent = `${result.event.attestation.purpose.replaceAll("-", " ")} verified and hash-linked.`;
      renderIndependentReviewAdmission(result.independentReviewAdmission);
      const { candidateRetestDisposition } = await state.api.candidateRetestDisposition(state.candidateRetestDisposition?.cycleId || "");
      renderCandidateRetestDisposition(candidateRetestDisposition);
      $("#independent-admission-announcement").textContent = `External duty ${result.independentReviewAdmission.counts.verifiedExternalDuties} of 7 verified. ${result.independentReviewAdmission.independentReviewExecutionReady ? "The exact independent evaluation may begin; no evaluation result has been recorded." : "The next ordered duty remains external."}`;
      showToast(result.independentReviewAdmission.independentReviewExecutionReady ? "Evaluation execution admitted. No result or clinical claim was created." : "External admission duty verified.");
    } catch (error) {
      $("#independent-admission-file-state").className = "admission-file-state failed";
      $("#independent-admission-file-state").textContent = `Envelope rejected: ${error.message}`;
      showToast(error.message);
    } finally {
      button.textContent = "Verify next external duty";
      button.disabled = !state.connected || !state.independentReviewAdmissionAttestation || !state.independentReviewAdmission?.activeChallenge;
    }
  });

  $("#owner-return-file").addEventListener("change", async event => {
    state.integrationReturnManifest = null;
    const fileState = $("#owner-return-file-state");
    const button = $("#preflight-owner-return");
    fileState.className = "owner-return-file-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No manifest selected.";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Manifest exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      state.integrationReturnManifest = manifest;
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for strict server preflight.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected manifest is not valid JSON.";
    }
  });

  $("#decision-exchange-gates").addEventListener("click", event => {
    const button = event.target.closest("[data-decision-gate]");
    if (!button || !state.decisionExchange?.packets?.some(packet => packet.id === button.dataset.decisionGate)) return;
    state.decisionExchangeGateId = button.dataset.decisionGate;
    state.decisionReturnManifest = null;
    $("#decision-return-file").value = "";
    const fileState = $("#decision-return-file-state");
    fileState.className = "";
    fileState.textContent = "No return selected · 64 KB maximum";
    renderDecisionExchange(state.decisionExchange);
  });

  $("#pilot-pathway-buttons").addEventListener("click", event => {
    const button = event.target.closest("[data-pilot-pathway]");
    if (!button || !state.pilotOperations?.candidates?.some(candidate => candidate.id === button.dataset.pilotPathway)) return;
    state.pilotPathwayId = button.dataset.pilotPathway;
    renderPilotOperations(state.pilotOperations);
  });

  $("#seal-pilot-operations").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing the pilot operating plan.");
    const button = $("#seal-pilot-operations");
    button.disabled = true;
    button.textContent = "Sealing working plan…";
    try {
      const result = await state.api.recordPilotOperationsSnapshot();
      renderPilotOperations(result.pilotOperations);
      showToast("Provider-pilot planning snapshot sealed. No site, agreement, training, pilot, outcome, renewal, expansion, production, or patient-use authority was created.");
    } catch (error) {
      renderPilotOperations(state.pilotOperations);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Seal planning snapshot";
    }
  });

  $("#seal-provider-activation").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing the provider-activation workbook.");
    const button = $("#seal-provider-activation");
    button.disabled = true;
    button.textContent = "Sealing rehearsal…";
    try {
      const result = await state.api.recordProviderActivationSnapshot();
      renderProviderActivation(result.providerActivation);
      showToast("Provider-activation workbook snapshot sealed. No session, attendance, competency, completion, site activation, pilot, production, or patient-use authority was created.");
    } catch (error) {
      renderProviderActivation(state.providerActivation);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Seal rehearsal workbook";
    }
  });

  $("#site-admission-candidates").addEventListener("click", event => {
    const button = event.target.closest("[data-site-candidate]");
    if (!button || !state.siteAdmission?.dossiers?.some(item => item.candidate.id === button.dataset.siteCandidate)) return;
    state.siteAdmissionCandidateId = button.dataset.siteCandidate;
    state.siteAdmissionReturnManifest = null;
    $("#site-admission-return-file").value = "";
    $("#site-admission-file-state").className = "site-admission-file-state";
    $("#site-admission-file-state").textContent = "No return selected · 96 KB maximum";
    renderSiteAdmission(state.siteAdmission);
  });

  $("#site-admission-return-file").addEventListener("change", async event => {
    state.siteAdmissionReturnManifest = null;
    const fileState = $("#site-admission-file-state");
    const button = $("#preflight-site-admission");
    fileState.className = "site-admission-file-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No return selected · 96 KB maximum";
      return;
    }
    if (file.size > 96 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Site-admission return exceeds the 96 KB metadata limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      const dossier = state.siteAdmission?.dossiers?.find(item => item.candidate.id === manifest.candidateId);
      if (dossier) state.siteAdmissionCandidateId = dossier.candidate.id;
      state.siteAdmissionReturnManifest = manifest;
      renderSiteAdmission(state.siteAdmission);
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for strict metadata preflight.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected site-admission return is not valid JSON.";
    }
  });

  $("#preflight-site-admission").addEventListener("click", async () => {
    if (!state.connected || !state.siteAdmissionReturnManifest) return showToast("Choose a completed named-site metadata return before preflight.");
    const button = $("#preflight-site-admission");
    button.disabled = true;
    button.textContent = "Checking admission envelope…";
    try {
      const result = await state.api.preflightSiteAdmissionReturn(state.siteAdmissionReturnManifest);
      state.siteAdmissionReturnManifest = null;
      $("#site-admission-return-file").value = "";
      $("#site-admission-file-state").className = "site-admission-file-state";
      $("#site-admission-file-state").textContent = "No return selected · 96 KB maximum";
      renderSiteAdmission(result.siteAdmission);
      showToast(result.event.metadataChecklistComplete
        ? "Admission metadata is complete and tamper-evident. Site, evidence, identity, signature, authority, agreement, dates, activation, and pilot authorization remain unverified."
        : "Admission metadata was recorded as incomplete. The site decision and every authority claim remain open.");
    } catch (error) {
      $("#site-admission-file-state").classList.add("failed");
      $("#site-admission-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.siteAdmissionReturnManifest;
      button.textContent = "Preflight site metadata";
    }
  });

  $("#authority-trust-candidates").addEventListener("click", event => {
    const button = event.target.closest("[data-authority-trust-candidate]");
    if (!button || !state.authorityTrust?.candidates?.some(item => item.candidate.id === button.dataset.authorityTrustCandidate)) return;
    state.authorityTrustCandidateId = button.dataset.authorityTrustCandidate;
    state.authorityTrustReceipt = null;
    $("#authority-trust-receipt-file").value = "";
    $("#authority-trust-file-state").className = "authority-trust-action-state";
    $("#authority-trust-file-state").textContent = "No receipt selected · 64 KB maximum";
    renderAuthorityTrust(state.authorityTrust);
  });

  $("#issue-authority-trust-challenge").addEventListener("click", async () => {
    if (!state.connected || !state.authorityTrustCandidateId) return showToast("Connect the local workspace and select a named-site candidate.");
    const button = $("#issue-authority-trust-challenge");
    button.disabled = true;
    button.textContent = "Issuing challenge…";
    try {
      const result = await state.api.issueAuthorityTrustChallenge(state.authorityTrustCandidateId);
      renderAuthorityTrust(result.authorityTrust);
      showToast("A 24-hour candidate-bound challenge was issued locally. Nothing was transmitted, signed, approved, started, or released.");
    } catch (error) {
      $("#authority-trust-challenge-state").className = "authority-trust-action-state failed";
      $("#authority-trust-challenge-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue governed challenge";
      button.disabled = !state.connected || !state.authorityTrust?.registry?.registryCurrent || !state.authorityTrust?.registry?.activeKeyCount;
    }
  });

  $("#authority-trust-receipt-file").addEventListener("change", async event => {
    state.authorityTrustReceipt = null;
    const fileState = $("#authority-trust-file-state");
    const button = $("#verify-authority-trust-receipt");
    fileState.className = "authority-trust-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No receipt selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Governed trust receipt exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const receipt = JSON.parse(await file.text());
      const candidate = state.authorityTrust?.candidates?.find(item => item.candidate.id === receipt.candidateId);
      if (candidate) state.authorityTrustCandidateId = candidate.candidate.id;
      state.authorityTrustReceipt = receipt;
      renderAuthorityTrust(state.authorityTrust);
      fileState.className = "authority-trust-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for signature and scope verification.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected governed trust receipt is not valid JSON.";
    }
  });

  $("#verify-authority-trust-receipt").addEventListener("click", async () => {
    if (!state.connected || !state.authorityTrustReceipt) return showToast("Choose a signed governed trust receipt before verification.");
    const button = $("#verify-authority-trust-receipt");
    button.disabled = true;
    button.textContent = "Verifying receipt…";
    try {
      const result = await state.api.verifyAuthorityTrustReceipt(state.authorityTrustReceipt);
      state.authorityTrustReceipt = null;
      $("#authority-trust-receipt-file").value = "";
      $("#authority-trust-file-state").className = "authority-trust-action-state ready";
      $("#authority-trust-file-state").textContent = "Signature, challenge, registry, scope grant, time window, and replay checks passed.";
      renderAuthorityTrust(result.authorityTrust);
      const { pilotStart } = await state.api.pilotStart();
      renderPilotStart(pilotStart);
      showToast("Governed metadata receipt verified. Any satisfied scope is now visible; pilot start, provider activation, production release, patient use, and care decisions remain separate.");
    } catch (error) {
      $("#authority-trust-file-state").className = "authority-trust-action-state failed";
      $("#authority-trust-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Verify governed receipt";
      button.disabled = !state.connected || !state.authorityTrustReceipt;
    }
  });

  $("#pilot-start-candidates").addEventListener("click", event => {
    const button = event.target.closest("[data-pilot-start-candidate]");
    if (!button || !state.pilotStart?.candidates?.some(item => item.candidate.id === button.dataset.pilotStartCandidate)) return;
    state.pilotStartCandidateId = button.dataset.pilotStartCandidate;
    state.pilotStartOrder = null;
    state.pilotStartAcknowledgement = null;
    $("#pilot-start-order-file").value = "";
    $("#pilot-start-ack-file").value = "";
    $("#pilot-start-order-file-state").className = "pilot-start-action-state";
    $("#pilot-start-order-file-state").textContent = "No order selected · 64 KB maximum";
    $("#pilot-start-ack-file-state").className = "pilot-start-action-state";
    $("#pilot-start-ack-file-state").textContent = "No acknowledgement selected · 64 KB maximum";
    renderPilotStart(state.pilotStart);
  });

  $("#issue-pilot-start-challenge").addEventListener("click", async () => {
    if (!state.connected || !state.pilotStartCandidateId) return showToast("Connect the local workspace and select a named-site candidate.");
    const button = $("#issue-pilot-start-challenge");
    button.disabled = true;
    button.textContent = "Binding current evidence…";
    try {
      const result = await state.api.issuePilotStartChallenge(state.pilotStartCandidateId);
      renderPilotStart(result.pilotStart);
      showToast("A 15-minute, candidate-bound start challenge was issued. No start was ordered, observed, or authorized for clinical use.");
    } catch (error) {
      $("#pilot-start-challenge-state").className = "pilot-start-action-state failed";
      $("#pilot-start-challenge-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue 15-minute challenge";
      button.disabled = !state.connected || state.pilotStart?.candidates?.find(item => item.candidate.id === state.pilotStartCandidateId)?.status !== "start-challenge-required";
    }
  });

  $("#pilot-start-order-file").addEventListener("change", async event => {
    state.pilotStartOrder = null;
    const fileState = $("#pilot-start-order-file-state");
    const button = $("#verify-pilot-start-order");
    fileState.className = "pilot-start-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No order selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Pilot-start order exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const order = JSON.parse(await file.text());
      const candidate = state.pilotStart?.candidates?.find(item => item.candidate.id === order.candidateId);
      if (candidate) state.pilotStartCandidateId = candidate.candidate.id;
      state.pilotStartOrder = order;
      renderPilotStart(state.pilotStart);
      fileState.className = "pilot-start-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for duty, signature, deployment, condition, window, and replay checks.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected pilot-start order is not valid JSON.";
    }
  });

  $("#verify-pilot-start-order").addEventListener("click", async () => {
    if (!state.connected || !state.pilotStartOrder) return showToast("Choose a signed pilot-start order before verification.");
    const button = $("#verify-pilot-start-order");
    button.disabled = true;
    button.textContent = "Verifying order…";
    try {
      const result = await state.api.verifyPilotStartOrder(state.pilotStartOrder);
      state.pilotStartOrder = null;
      $("#pilot-start-order-file").value = "";
      $("#pilot-start-order-file-state").className = "pilot-start-action-state ready";
      $("#pilot-start-order-file-state").textContent = "Start order verified. The separate deployment observer must still acknowledge the exact release inside the signed window.";
      renderPilotStart(result.pilotStart);
      showToast("Start order verified. No deployment start, clinical traffic, production release, or patient use was inferred.");
    } catch (error) {
      $("#pilot-start-order-file-state").className = "pilot-start-action-state failed";
      $("#pilot-start-order-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Verify start order";
      button.disabled = !state.connected || !state.pilotStartOrder;
    }
  });

  $("#pilot-start-ack-file").addEventListener("change", async event => {
    state.pilotStartAcknowledgement = null;
    const fileState = $("#pilot-start-ack-file-state");
    const button = $("#verify-pilot-start-ack");
    fileState.className = "pilot-start-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No acknowledgement selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Deployment-start acknowledgement exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const acknowledgement = JSON.parse(await file.text());
      const candidate = state.pilotStart?.candidates?.find(item => item.candidate.id === acknowledgement.candidateId);
      if (candidate) state.pilotStartCandidateId = candidate.candidate.id;
      state.pilotStartAcknowledgement = acknowledgement;
      renderPilotStart(state.pilotStart);
      fileState.className = "pilot-start-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for distinct-duty, deployment-match, window, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected deployment-start acknowledgement is not valid JSON.";
    }
  });

  $("#verify-pilot-start-ack").addEventListener("click", async () => {
    if (!state.connected || !state.pilotStartAcknowledgement) return showToast("Choose a signed deployment-start acknowledgement before verification.");
    const button = $("#verify-pilot-start-ack");
    button.disabled = true;
    button.textContent = "Verifying deployment…";
    try {
      const result = await state.api.verifyPilotStartAcknowledgement(state.pilotStartAcknowledgement);
      state.pilotStartAcknowledgement = null;
      $("#pilot-start-ack-file").value = "";
      $("#pilot-start-ack-file-state").className = "pilot-start-action-state ready";
      $("#pilot-start-ack-file-state").textContent = "The exact provider-preparation deployment was acknowledged by the separate duty key. Clinical traffic remains off.";
      renderPilotStart(result.pilotStart);
      const { clinicalRelease } = await state.api.clinicalRelease();
      renderClinicalRelease(clinicalRelease);
      showToast("Provider-preparation start acknowledged. The live clinical pilot, clinical traffic, production release, and patient use remain blocked.");
    } catch (error) {
      $("#pilot-start-ack-file-state").className = "pilot-start-action-state failed";
      $("#pilot-start-ack-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Verify acknowledgement";
      button.disabled = !state.connected || !state.pilotStartAcknowledgement;
    }
  });

  $("#clinical-release-candidates").addEventListener("click", event => {
    const button = event.target.closest("[data-clinical-release-candidate]");
    if (!button || !state.clinicalRelease?.candidates?.some(item => item.candidate.id === button.dataset.clinicalReleaseCandidate)) return;
    state.clinicalReleaseCandidateId = button.dataset.clinicalReleaseCandidate;
    state.clinicalReleaseClinicalAuthorization = null;
    state.clinicalReleaseProductionAuthorization = null;
    state.clinicalReleaseDeploymentAttestation = null;
    for (const [inputId, stateId, copy] of [
      ["clinical-release-clinical-file", "clinical-release-clinical-file-state", "No authorization selected · 64 KB maximum"],
      ["clinical-release-production-file", "clinical-release-production-file-state", "No authorization selected · 64 KB maximum"],
      ["clinical-release-attestation-file", "clinical-release-attestation-file-state", "No attestation selected · 64 KB maximum"]
    ]) {
      $(`#${inputId}`).value = "";
      $(`#${stateId}`).className = "clinical-release-action-state";
      $(`#${stateId}`).textContent = copy;
    }
    renderClinicalRelease(state.clinicalRelease);
  });

  $("#issue-clinical-release-challenge").addEventListener("click", async () => {
    if (!state.connected || !state.clinicalReleaseCandidateId) return showToast("Connect the local workspace and select a clinical-release candidate.");
    const button = $("#issue-clinical-release-challenge");
    button.disabled = true;
    button.textContent = "Binding release evidence…";
    try {
      const result = await state.api.issueClinicalReleaseChallenge(state.clinicalReleaseCandidateId);
      renderClinicalRelease(result.clinicalRelease);
      showToast("A 20-minute release challenge was issued. No clinical authority, production authority, deployment verification, traffic, or pilot start was inferred.");
    } catch (error) {
      $("#clinical-release-challenge-state").className = "clinical-release-action-state failed";
      $("#clinical-release-challenge-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue 20-minute challenge";
      button.disabled = !state.connected || state.clinicalRelease?.candidates?.find(item => item.candidate.id === state.clinicalReleaseCandidateId)?.status !== "release-challenge-required";
    }
  });

  $("#clinical-release-clinical-file").addEventListener("change", async event => {
    state.clinicalReleaseClinicalAuthorization = null;
    const fileState = $("#clinical-release-clinical-file-state");
    const button = $("#verify-clinical-release-clinical");
    fileState.className = "clinical-release-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No authorization selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "Clinical-use authorization exceeds the 64 KB metadata limit."; return; }
    try {
      const authorization = JSON.parse(await file.text());
      state.clinicalReleaseClinicalAuthorization = authorization;
      if (state.clinicalRelease?.candidates?.some(item => item.candidate.id === authorization.candidateId)) state.clinicalReleaseCandidateId = authorization.candidateId;
      renderClinicalRelease(state.clinicalRelease);
      fileState.className = "clinical-release-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for scope, evidence, window, duty, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected clinical-use authorization is not valid JSON."; }
  });

  $("#verify-clinical-release-clinical").addEventListener("click", async () => {
    if (!state.connected || !state.clinicalReleaseClinicalAuthorization) return showToast("Choose a signed clinical-use authorization before verification.");
    const button = $("#verify-clinical-release-clinical");
    button.disabled = true;
    button.textContent = "Verifying clinical authority…";
    try {
      const result = await state.api.verifyClinicalUseAuthorization(state.clinicalReleaseClinicalAuthorization);
      state.clinicalReleaseClinicalAuthorization = null;
      $("#clinical-release-clinical-file").value = "";
      $("#clinical-release-clinical-file-state").className = "clinical-release-action-state ready";
      $("#clinical-release-clinical-file-state").textContent = "Bounded provider-first clinical and patient-use authority verified. Production authority and deployment conformance remain separate.";
      renderClinicalRelease(result.clinicalRelease);
      showToast("Clinical-use authority verified. Clinical traffic and pilot start remain off.");
    } catch (error) { $("#clinical-release-clinical-file-state").className = "clinical-release-action-state failed"; $("#clinical-release-clinical-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify clinical authority"; button.disabled = !state.connected || !state.clinicalReleaseClinicalAuthorization; }
  });

  $("#clinical-release-production-file").addEventListener("change", async event => {
    state.clinicalReleaseProductionAuthorization = null;
    const fileState = $("#clinical-release-production-file-state");
    const button = $("#verify-clinical-release-production");
    fileState.className = "clinical-release-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No authorization selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "Production-release authorization exceeds the 64 KB metadata limit."; return; }
    try {
      const authorization = JSON.parse(await file.text());
      state.clinicalReleaseProductionAuthorization = authorization;
      if (state.clinicalRelease?.candidates?.some(item => item.candidate.id === authorization.candidateId)) state.clinicalReleaseCandidateId = authorization.candidateId;
      renderClinicalRelease(state.clinicalRelease);
      fileState.className = "clinical-release-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for clinical-binding, deployment, control-reference, duty, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected production-release authorization is not valid JSON."; }
  });

  $("#verify-clinical-release-production").addEventListener("click", async () => {
    if (!state.connected || !state.clinicalReleaseProductionAuthorization) return showToast("Choose a signed production-release authorization before verification.");
    const button = $("#verify-clinical-release-production");
    button.disabled = true;
    button.textContent = "Verifying production authority…";
    try {
      const result = await state.api.verifyProductionReleaseAuthorization(state.clinicalReleaseProductionAuthorization);
      state.clinicalReleaseProductionAuthorization = null;
      $("#clinical-release-production-file").value = "";
      $("#clinical-release-production-file-state").className = "clinical-release-action-state ready";
      $("#clinical-release-production-file-state").textContent = "Exact production release authorized. A third duty must still attest the deployed artifact, configuration, and controls.";
      renderClinicalRelease(result.clinicalRelease);
      showToast("Production authority verified. Deployment conformance, traffic activation, and pilot start remain separate.");
    } catch (error) { $("#clinical-release-production-file-state").className = "clinical-release-action-state failed"; $("#clinical-release-production-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify production authority"; button.disabled = !state.connected || !state.clinicalReleaseProductionAuthorization; }
  });

  $("#clinical-release-attestation-file").addEventListener("change", async event => {
    state.clinicalReleaseDeploymentAttestation = null;
    const fileState = $("#clinical-release-attestation-file-state");
    const button = $("#verify-clinical-release-attestation");
    fileState.className = "clinical-release-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No attestation selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "Release-deployment attestation exceeds the 64 KB metadata limit."; return; }
    try {
      const attestation = JSON.parse(await file.text());
      state.clinicalReleaseDeploymentAttestation = attestation;
      if (state.clinicalRelease?.candidates?.some(item => item.candidate.id === attestation.candidateId)) state.clinicalReleaseCandidateId = attestation.candidateId;
      renderClinicalRelease(state.clinicalRelease);
      fileState.className = "clinical-release-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for authorization-match, eight-control, duty, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected release-deployment attestation is not valid JSON."; }
  });

  $("#verify-clinical-release-attestation").addEventListener("click", async () => {
    if (!state.connected || !state.clinicalReleaseDeploymentAttestation) return showToast("Choose a signed release-deployment attestation before verification.");
    const button = $("#verify-clinical-release-attestation");
    button.disabled = true;
    button.textContent = "Verifying deployment…";
    try {
      const result = await state.api.verifyReleaseDeploymentAttestation(state.clinicalReleaseDeploymentAttestation);
      state.clinicalReleaseDeploymentAttestation = null;
      $("#clinical-release-attestation-file").value = "";
      $("#clinical-release-attestation-file-state").className = "clinical-release-action-state ready";
      $("#clinical-release-attestation-file-state").textContent = "Deployment conformance verified. Release evidence is ready, while the traffic switch and first governed transaction remain external.";
      renderClinicalRelease(result.clinicalRelease);
      renderTrafficActivation((await state.api.trafficActivation()).trafficActivation);
      showToast("Release evidence complete. Clinical traffic, patient-record processing, and pilot start remain off until a separate external activation control.");
    } catch (error) { $("#clinical-release-attestation-file-state").className = "clinical-release-action-state failed"; $("#clinical-release-attestation-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify deployment"; button.disabled = !state.connected || !state.clinicalReleaseDeploymentAttestation; }
  });

  $("#traffic-activation-candidates").addEventListener("click", event => {
    const button = event.target.closest("[data-traffic-activation-candidate]");
    if (!button || !state.trafficActivation?.candidates?.some(item => item.candidate.id === button.dataset.trafficActivationCandidate)) return;
    state.trafficActivationCandidateId = button.dataset.trafficActivationCandidate;
    state.trafficActivationClinicalAuthorization = null;
    state.trafficActivationOperationsAuthorization = null;
    state.trafficActivationTransactionAttestation = null;
    for (const [inputId, stateId, copy] of [
      ["traffic-activation-clinical-file", "traffic-activation-clinical-file-state", "No concurrence selected · 64 KB maximum"],
      ["traffic-activation-operations-file", "traffic-activation-operations-file-state", "No concurrence selected · 64 KB maximum"],
      ["traffic-activation-transaction-file", "traffic-activation-transaction-file-state", "No attestation selected · 64 KB maximum"]
    ]) {
      $(`#${inputId}`).value = "";
      $(`#${stateId}`).className = "traffic-witness-action-state";
      $(`#${stateId}`).textContent = copy;
    }
    renderTrafficActivation(state.trafficActivation);
  });

  $("#issue-traffic-activation-challenge").addEventListener("click", async () => {
    if (!state.connected || !state.trafficActivationCandidateId) return showToast("Connect the local workspace and select a release-ready candidate.");
    const button = $("#issue-traffic-activation-challenge");
    button.disabled = true;
    button.textContent = "Binding release proof…";
    try {
      const result = await state.api.issueTrafficActivationChallenge(state.trafficActivationCandidateId);
      renderTrafficActivation(result.trafficActivation);
      showToast("A 15-minute external-switch witness challenge was issued. PERL did not configure an endpoint or enable traffic.");
    } catch (error) {
      $("#traffic-activation-challenge-state").className = "traffic-witness-action-state failed";
      $("#traffic-activation-challenge-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.textContent = "Issue 15-minute witness";
      button.disabled = !state.connected || state.trafficActivation?.candidates?.find(item => item.candidate.id === state.trafficActivationCandidateId)?.status !== "traffic-activation-challenge-required";
    }
  });

  $("#traffic-activation-clinical-file").addEventListener("change", async event => {
    state.trafficActivationClinicalAuthorization = null;
    const fileState = $("#traffic-activation-clinical-file-state");
    const button = $("#verify-traffic-activation-clinical");
    fileState.className = "traffic-witness-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No concurrence selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "Clinical activation concurrence exceeds the 64 KB metadata limit."; return; }
    try {
      const authorization = JSON.parse(await file.text());
      state.trafficActivationClinicalAuthorization = authorization;
      if (state.trafficActivation?.candidates?.some(item => item.candidate.id === authorization.candidateId)) state.trafficActivationCandidateId = authorization.candidateId;
      renderTrafficActivation(state.trafficActivation);
      fileState.className = "traffic-witness-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for exact-plan, release-proof, window, duty, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected clinical activation concurrence is not valid JSON."; }
  });

  $("#verify-traffic-activation-clinical").addEventListener("click", async () => {
    if (!state.connected || !state.trafficActivationClinicalAuthorization) return showToast("Choose a signed clinical activation concurrence before verification.");
    const button = $("#verify-traffic-activation-clinical");
    button.disabled = true;
    button.textContent = "Verifying clinical concurrence…";
    try {
      const result = await state.api.verifyClinicalTrafficAuthorization(state.trafficActivationClinicalAuthorization);
      state.trafficActivationClinicalAuthorization = null;
      $("#traffic-activation-clinical-file").value = "";
      $("#traffic-activation-clinical-file-state").className = "traffic-witness-action-state ready";
      $("#traffic-activation-clinical-file-state").textContent = "Clinical concurrence verified for the exact external activation plan. Operations concurrence remains separate.";
      renderTrafficActivation(result.trafficActivation);
      showToast("Clinical activation concurrence verified. PERL traffic remains off and the external switch remains untouched.");
    } catch (error) { $("#traffic-activation-clinical-file-state").className = "traffic-witness-action-state failed"; $("#traffic-activation-clinical-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify clinical concurrence"; button.disabled = !state.connected || !state.trafficActivationClinicalAuthorization; }
  });

  $("#traffic-activation-operations-file").addEventListener("change", async event => {
    state.trafficActivationOperationsAuthorization = null;
    const fileState = $("#traffic-activation-operations-file-state");
    const button = $("#verify-traffic-activation-operations");
    fileState.className = "traffic-witness-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No concurrence selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "Operations activation concurrence exceeds the 64 KB metadata limit."; return; }
    try {
      const authorization = JSON.parse(await file.text());
      state.trafficActivationOperationsAuthorization = authorization;
      if (state.trafficActivation?.candidates?.some(item => item.candidate.id === authorization.candidateId)) state.trafficActivationCandidateId = authorization.candidateId;
      renderTrafficActivation(state.trafficActivation);
      fileState.className = "traffic-witness-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for identical-plan, endpoint-policy, tenant-isolation, duty, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected operations activation concurrence is not valid JSON."; }
  });

  $("#verify-traffic-activation-operations").addEventListener("click", async () => {
    if (!state.connected || !state.trafficActivationOperationsAuthorization) return showToast("Choose a signed operations activation concurrence before verification.");
    const button = $("#verify-traffic-activation-operations");
    button.disabled = true;
    button.textContent = "Verifying operations concurrence…";
    try {
      const result = await state.api.verifyOperationsTrafficAuthorization(state.trafficActivationOperationsAuthorization);
      state.trafficActivationOperationsAuthorization = null;
      $("#traffic-activation-operations-file").value = "";
      $("#traffic-activation-operations-file-state").className = "traffic-witness-action-state ready";
      $("#traffic-activation-operations-file-state").textContent = "Operations concurrence verified against the identical exact activation plan. The external switch remains outside PERL.";
      renderTrafficActivation(result.trafficActivation);
      showToast("Dual concurrence verified for the exact activation plan. No traffic was enabled by this workspace.");
    } catch (error) { $("#traffic-activation-operations-file-state").className = "traffic-witness-action-state failed"; $("#traffic-activation-operations-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify operations concurrence"; button.disabled = !state.connected || !state.trafficActivationOperationsAuthorization; }
  });

  $("#traffic-activation-transaction-file").addEventListener("change", async event => {
    state.trafficActivationTransactionAttestation = null;
    const fileState = $("#traffic-activation-transaction-file-state");
    const button = $("#verify-traffic-activation-transaction");
    fileState.className = "traffic-witness-action-state";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) return void (fileState.textContent = "No attestation selected · 64 KB maximum");
    if (file.size > 64 * 1024) { fileState.classList.add("failed"); fileState.textContent = "First-transaction attestation exceeds the 64 KB metadata limit."; return; }
    try {
      const attestation = JSON.parse(await file.text());
      state.trafficActivationTransactionAttestation = attestation;
      if (state.trafficActivation?.candidates?.some(item => item.candidate.id === attestation.candidateId)) state.trafficActivationCandidateId = attestation.candidateId;
      renderTrafficActivation(state.trafficActivation);
      fileState.className = "traffic-witness-action-state ready";
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for dual-concurrence, exact-deployment, transaction-reference, governance, signature, and replay checks.`;
      button.disabled = !state.connected;
    } catch { fileState.classList.add("failed"); fileState.textContent = "The selected first-transaction attestation is not valid JSON."; }
  });

  $("#verify-traffic-activation-transaction").addEventListener("click", async () => {
    if (!state.connected || !state.trafficActivationTransactionAttestation) return showToast("Choose a signed first-governed-transaction attestation before verification.");
    const button = $("#verify-traffic-activation-transaction");
    button.disabled = true;
    button.textContent = "Verifying first transaction…";
    try {
      const result = await state.api.verifyFirstGovernedTransactionAttestation(state.trafficActivationTransactionAttestation);
      state.trafficActivationTransactionAttestation = null;
      $("#traffic-activation-transaction-file").value = "";
      $("#traffic-activation-transaction-file-state").className = "traffic-witness-action-state ready";
      $("#traffic-activation-transaction-file-state").textContent = "First governed external transaction witnessed from hashes and control assertions only. No record content entered PERL.";
      renderTrafficActivation(result.trafficActivation);
      showToast("First governed transaction verified as external metadata evidence. PERL stored no PHI, identifier, endpoint, credential, or clinical payload.");
    } catch (error) { $("#traffic-activation-transaction-file-state").className = "traffic-witness-action-state failed"; $("#traffic-activation-transaction-file-state").textContent = error.message; showToast(error.message); }
    finally { button.textContent = "Verify first transaction"; button.disabled = !state.connected || !state.trafficActivationTransactionAttestation; }
  });

  $("#decision-return-file").addEventListener("change", async event => {
    state.decisionReturnManifest = null;
    const fileState = $("#decision-return-file-state");
    const button = $("#preflight-decision-return");
    fileState.className = "";
    button.disabled = true;
    const file = event.target.files[0];
    if (!file) {
      fileState.textContent = "No return selected · 64 KB maximum";
      return;
    }
    if (file.size > 64 * 1024) {
      fileState.classList.add("failed");
      fileState.textContent = "Decision return exceeds the 64 KB metadata limit.";
      return;
    }
    try {
      const manifest = JSON.parse(await file.text());
      const packet = state.decisionExchange?.packets?.find(item => item.id === manifest.gateId);
      if (packet) state.decisionExchangeGateId = packet.id;
      state.decisionReturnManifest = manifest;
      renderDecisionExchange(state.decisionExchange);
      fileState.classList.add("ready");
      fileState.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · ready for strict metadata preflight.`;
      button.disabled = !state.connected;
    } catch {
      fileState.classList.add("failed");
      fileState.textContent = "The selected decision return is not valid JSON.";
    }
  });

  $("#preflight-decision-return").addEventListener("click", async () => {
    if (!state.connected || !state.decisionReturnManifest) return showToast("Choose a completed Decision Exchange metadata return before preflight.");
    const button = $("#preflight-decision-return");
    button.disabled = true;
    button.textContent = "Checking return envelope…";
    try {
      const result = await state.api.preflightDecisionReturn(state.decisionReturnManifest);
      state.decisionReturnManifest = null;
      $("#decision-return-file").value = "";
      $("#decision-return-file-state").className = "";
      $("#decision-return-file-state").textContent = "No return selected · 64 KB maximum";
      renderDecisionExchange(result.decisionExchange);
      showToast(result.event.metadataChecklistComplete
        ? "Decision metadata is complete and tamper-evident. Identity, evidence, signature, authority, acceptance, and the gate remain unverified."
        : "Decision metadata was recorded as incomplete. The outside decision and every authority claim remain open.");
    } catch (error) {
      $("#decision-return-file-state").classList.add("failed");
      $("#decision-return-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.decisionReturnManifest;
      button.textContent = "Preflight decision metadata";
    }
  });

  $("#preflight-owner-return").addEventListener("click", async () => {
    if (!state.connected || !state.integrationReturnManifest) return showToast("Choose a completed metadata request before preflight.");
    const button = $("#preflight-owner-return");
    button.disabled = true;
    button.textContent = "Checking metadata…";
    try {
      const result = await state.api.preflightIntegrationReturn(state.integrationReturnManifest);
      state.integrationReturnManifest = null;
      $("#owner-return-file").value = "";
      $("#owner-return-file-state").className = "owner-return-file-state";
      $("#owner-return-file-state").textContent = "No manifest selected.";
      renderIntegrationReturn(result.integrationReturn);
      showToast(`${result.event.counts.metadataComplete} of 8 artifact descriptions passed preflight. The RFI remains open.`);
    } catch (error) {
      $("#owner-return-file-state").classList.add("failed");
      $("#owner-return-file-state").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.integrationReturnManifest;
      button.textContent = "Preflight metadata manifest";
    }
  });

  $("#audience-select").addEventListener("change", event => {
    state.audience = event.target.value;
    renderReview();
    if (!state.connected) audit("Audience changed", event.target.options[event.target.selectedIndex].text);
    showToast(state.audience === "clinician"
      ? "Clinician decision view restored."
      : "Audience handoff adapted; scored evidence and clinician approval remain unchanged.");
  });

  $("#print-button").addEventListener("click", () => {
    if (!state.connected) return window.print();
    const id = encodeURIComponent(currentAssessment().id);
    const path = state.audience === "clinician"
      ? `/api/assessments/${id}/report.html`
      : `/api/assessments/${id}/handoff/${encodeURIComponent(state.audience)}.html`;
    window.open(path, "_blank", "noopener,noreferrer");
  });
  $("#jump-risk").addEventListener("click", () => {
    const gate = $("#safety-gate");
    gate.focus({ preventScroll: true });
    gate.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  });
  $("#risk-ack").addEventListener("change", async event => {
    const desired = event.target.checked;
    event.target.disabled = true;
    try {
      if (state.connected) {
        await state.api.acknowledgeSafety(currentAssessment().id, desired);
        await refreshCurrent();
      } else {
        state.riskAcknowledged = desired;
        currentAssessment().safetyAcknowledged = desired;
        if (desired) audit("Safety hold acknowledged", "Source response marked reviewed");
        setApprovalState(currentAssessment());
        persistHostedEvaluation();
      }
    } catch (error) {
      state.riskAcknowledged = !desired;
      setApprovalState(currentAssessment());
      showToast(error.message);
    } finally {
      if (riskDisposition(currentAssessment()).requiresReview) $("#risk-ack").disabled = false;
    }
  });

  $("#approve-button").addEventListener("click", async () => {
    const assessment = currentAssessment();
    if (riskDisposition(assessment).requiresReview && !state.riskAcknowledged) return;
    const button = $("#approve-button");
    button.disabled = true;
    try {
      if (state.connected) {
        await state.api.approve(assessment.id);
        await refreshCurrent();
      } else {
        assessment.status = "approved";
        assessment.reviewer = state.reviewerCode;
        audit("Clinical summary approved", "Reviewer approval recorded in this browser");
        renderQueue($("#queue-search").value);
        persistHostedEvaluation();
      }
      $("#dock-status").textContent = "Approved";
      $("#dock-help").textContent = state.sourceEvent
        ? "Approved and prepared for the governed handoff; the source e-QPASS record was not changed."
        : "Approval was recorded in the local audit trail.";
      showToast(state.sourceEvent
        ? "Approved. The hash-bound handoff was prepared automatically."
        : "Clinical summary approved and added to the audit trail.");
    } catch (error) {
      setApprovalState(assessment);
      showToast(error.message);
    }
  });

  $("#prepare-attachment").addEventListener("click", async () => {
    if (!state.connected || !state.reportArtifact || !state.workflow?.eligible) return;
    const button = $("#prepare-attachment");
    button.disabled = true;
    try {
      if (button.dataset.action === "retry") {
        await state.api.retryProviderWorkflow(currentAssessment().id);
      } else {
        const artifact = state.reportArtifact;
        await state.api.prepareAttachment({
          contractVersion: "eqpass-perl-attachment/rfi-0.1",
          environment: "calibration",
          assessmentId: currentAssessment().id,
          reportArtifactId: artifact.id,
          reportArtifactHash: artifact.hash,
          idempotencyKey: `FF-TEST-ATTACH-${artifact.hash.slice(0, 24).toUpperCase()}`
        });
      }
      await refreshCurrent();
      showToast("Synthetic handoff prepared. No PDF was attached to e-QPASS.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#delivery-job-list").addEventListener("click", async event => {
    const button = event.target.closest("button[data-delivery-action]");
    if (!button || !state.connected) return;
    button.disabled = true;
    try {
      const result = button.dataset.deliveryAction === "retry"
        ? await state.api.retryDelivery(button.dataset.deliveryId)
        : await state.api.processDelivery(button.dataset.deliveryId);
      await loadGovernance();
      showToast(result.status === "rehearsed-not-attached"
        ? "Synthetic delivery receipt verified. No production attachment is claimed."
        : result.status === "dead-lettered"
          ? "Attempt limit reached. The package is held in the dead-letter queue."
          : "The package remains durable and requires an explicit retry.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#start-integration-rehearsal").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before starting the automation rehearsal.");
    const button = $("#start-integration-rehearsal");
    button.disabled = true;
    button.textContent = "Materializing summary…";
    try {
      const result = await state.api.startIntegrationRehearsal();
      const { assessments } = await state.api.listAssessments();
      state.assessments = assessments;
      applyDetail(result.assessment);
      renderQueue($("#queue-search").value);
      renderReview();
      renderIntegrationRehearsal(result.rehearsal);
      showToast("Synthetic Findings accepted and summary materialized. Open the clinical record to make the required human decision.");
    } catch (error) {
      renderIntegrationRehearsal(state.integrationRehearsal);
      showToast(error.message);
    } finally {
      button.textContent = "Start synthetic run";
      button.disabled = !state.connected;
    }
  });

  $("#automation-run-list").addEventListener("click", async event => {
    const button = event.target.closest("[data-open-integration-assessment]");
    if (!button) return;
    try {
      if (!state.assessments.some(item => item.id === button.dataset.openIntegrationAssessment)) {
        state.assessments = (await state.api.listAssessments()).assessments;
      }
      const index = state.assessments.findIndex(item => item.id === button.dataset.openIntegrationAssessment);
      if (index < 0) throw new Error("The source-linked synthetic record is no longer available.");
      await loadAssessment(index);
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#run-recovery").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before running a recovery rehearsal.");
    const button = $("#run-recovery");
    const vault = $("#recovery-vault");
    button.disabled = true;
    button.textContent = "Restoring isolated copy…";
    vault.classList.remove("verified", "failed");
    vault.classList.add("running");
    $("#recovery-state-chip").textContent = "Rehearsal running";
    try {
      const result = await state.api.rehearseRecovery();
      renderRecovery(result);
      renderIncidentResponse(await state.api.incidentResponseStatus());
      await refreshReadinessSurfaces();
      showToast(result.status === "verified"
        ? "Isolated restore verified. Production backup and RPO/RTO still require owner approval."
        : "Recovery rehearsal failed closed. No production recovery capability is claimed.");
    } catch (error) {
      renderRecovery(state.recovery);
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Run isolated rehearsal";
    }
  });

  $("#run-rollback").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before running a compatibility rehearsal.");
    const button = $("#run-rollback");
    const dossier = $("#rollback-dossier");
    button.disabled = true;
    button.textContent = "Verifying local baseline…";
    dossier.classList.remove("verified", "failed");
    dossier.classList.add("running");
    $("#rollback-state-chip").textContent = "Rehearsal running";
    try {
      const result = await state.api.rehearseRollback();
      renderRollback(result);
      renderIncidentResponse(await state.api.incidentResponseStatus());
      await refreshReadinessSurfaces();
      showToast(result.status === "verified-local-compatibility"
        ? "Local compatibility verified. No deployment rollback or artifact restoration occurred."
        : "Compatibility rehearsal failed closed. No application rollback is claimed.");
    } catch (error) {
      renderRollback(state.rollback);
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Run compatibility rehearsal";
    }
  });

  $("#build-release-candidate").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before building a release candidate.");
    const button = $("#build-release-candidate");
    const foundry = $("#release-foundry");
    button.disabled = true;
    button.textContent = "Collecting exact source…";
    foundry.classList.remove("built", "signed", "failed");
    foundry.classList.add("building");
    $("#release-state-chip").textContent = "Candidate building";
    $("#release-last-build").textContent = "Hashing the bounded source inventory and verifying the resulting archive.";
    try {
      const result = await state.api.buildReleaseCandidate();
      renderReleaseCandidate(result);
      renderReleaseAdmission(await state.api.releaseAdmissionStatus());
      renderReleasePromotion(await state.api.releasePromotionStatus());
      showToast(result.idempotent
        ? "The current content-addressed release candidate already exists and still verifies."
        : "Exact release candidate verified. External signature and deployment authority remain separate.");
    } catch (error) {
      renderReleaseCandidate(state.releaseCandidate);
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Build exact candidate";
    }
  });

  $("#run-release-admission").addEventListener("click", async () => {
    const artifactId = state.releaseAdmission?.candidateId || state.releaseCandidate?.latest?.artifactId;
    if (!state.connected || !artifactId) return showToast("Build an exact release candidate before running archive admission.");
    const button = $("#run-release-admission");
    const lab = $("#release-admission-lab");
    button.disabled = true;
    button.textContent = "Running every archived check…";
    lab.classList.remove("qualified", "failed");
    lab.classList.add("running");
    $("#admission-state-chip").textContent = "Qualification running";
    $("#admission-last-run").textContent = "Materializing the exact archive in an owner-only ephemeral copy. This may take a moment.";
    try {
      const result = await state.api.runReleaseAdmission(artifactId);
      renderReleaseAdmission(result);
      renderReleasePromotion(await state.api.releasePromotionStatus());
      showToast(result.status === "qualified-local"
        ? "Exact archive qualified locally. CI, vulnerability review, signing, deployment, and clinical authority remain external."
        : "Archive admission failed closed. Inspect the content-bound evidence report.");
    } catch (error) {
      renderReleaseAdmission(state.releaseAdmission);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.releaseCandidate?.latest;
      button.textContent = "Run archive admission";
    }
  });

  $("#prepare-release-promotion").addEventListener("click", async () => {
    const artifactId = state.releasePromotion?.candidateId || state.releaseCandidate?.latest?.artifactId;
    if (!state.connected || !artifactId || !state.releasePromotion?.localArchiveQualificationPassed) return showToast("Qualify the exact archive locally before preparing its external promotion handoff.");
    const button = $("#prepare-release-promotion");
    button.disabled = true;
    button.textContent = "Sealing ten-gate handoff…";
    try {
      const result = await state.api.prepareReleasePromotion(artifactId);
      renderReleasePromotion(result);
      showToast(result.idempotent
        ? "The exact promotion request already exists and still verifies. External evidence remains required."
        : "Exact ten-gate promotion handoff sealed. No deployment or clinical authority was granted.");
    } catch (error) {
      renderReleasePromotion(state.releasePromotion);
      showToast(error.message);
    } finally {
      button.textContent = "Prepare exact handoff";
      button.disabled = !state.connected || !state.releasePromotion?.localArchiveQualificationPassed;
    }
  });

  $("#promotion-attestation-file").addEventListener("change", async event => {
    state.releasePromotionAttestation = null;
    const file = event.target.files?.[0];
    if (!file) return renderReleasePromotion(state.releasePromotion);
    if (file.size < 2 || file.size > 1024 * 1024) {
      event.target.value = "";
      renderReleasePromotion(state.releasePromotion);
      return showToast("The promotion attestation must be a JSON file no larger than 1 MB.");
    }
    try {
      const attestation = JSON.parse(await file.text());
      if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) throw new Error("not an object");
      state.releasePromotionAttestation = attestation;
      renderReleasePromotion(state.releasePromotion);
    } catch {
      event.target.value = "";
      renderReleasePromotion(state.releasePromotion);
      showToast("The selected promotion attestation is not valid JSON.");
    }
  });

  $("#verify-promotion-attestation").addEventListener("click", async () => {
    if (!state.releasePromotionAttestation) return showToast("Load a signed external promotion attestation first.");
    const button = $("#verify-promotion-attestation");
    button.disabled = true;
    button.textContent = "Verifying signature + gates…";
    try {
      const result = await state.api.verifyReleasePromotionAttestation(state.releasePromotionAttestation);
      state.releasePromotionAttestation = null;
      $("#promotion-attestation-file").value = "";
      renderReleasePromotion(result);
      showToast("External promotion evidence verified. Deployment and clinical authority remain separate.");
    } catch (error) {
      renderReleasePromotion(state.releasePromotion);
      showToast(error.message);
    } finally {
      button.textContent = "Verify signed return";
    }
  });

  $("#run-monitoring-probe").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording operational evidence.");
    const button = $("#run-monitoring-probe");
    const watch = $("#operations-watch");
    button.disabled = true;
    button.textContent = "Inspecting controls…";
    watch.classList.remove("clear", "attention", "failed");
    watch.classList.add("running");
    $("#monitoring-state-chip").textContent = "Probe running";
    try {
      const result = await state.api.probeMonitoring();
      renderMonitoring(result);
      renderIncidentResponse(await state.api.incidentResponseStatus());
      await refreshReadinessSurfaces();
      showToast(result.status === "local-controls-clear"
        ? "Local controls are clear. Production telemetry and alert delivery remain unconnected."
        : "The local probe recorded attention evidence. No external alert was sent.");
    } catch (error) {
      renderMonitoring(state.monitoring);
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Run control probe";
    }
  });

  $("#response-scenario").addEventListener("change", () => {
    state.responseScenarioSelection = $("#response-scenario").value;
    renderIncidentResponse(state.incidentResponse);
  });

  $("#run-response-rehearsal").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before running a response tabletop.");
    const button = $("#run-response-rehearsal");
    const desk = $("#response-desk");
    button.disabled = true;
    button.textContent = "Rehearsing response arc…";
    desk.classList.remove("complete", "ready");
    desk.classList.add("running");
    $("#response-state-chip").textContent = "Tabletop running";
    try {
      const result = await state.api.rehearseIncidentResponse($("#response-scenario").value);
      renderIncidentResponse(result);
      await refreshReadinessSurfaces();
      showToast("Tabletop complete. No production incident was declared, no notification was sent, and restart remains unauthorized.");
    } catch (error) {
      renderIncidentResponse(state.incidentResponse);
      showToast(error.message);
    } finally {
      button.disabled = !state.incidentResponse?.readyToRehearse;
      button.textContent = "Run tabletop rehearsal";
    }
  });

  $("#intended-use-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.connected) return showToast("Connect the local synthetic workspace before recording a working charter.");
    const form = new FormData(event.currentTarget);
    const button = $("#save-intended-use");
    button.disabled = true;
    button.textContent = "Recording working charter…";
    try {
      const result = await state.api.saveIntendedUseDraft({
        pilotContext: form.get("pilotContext"),
        scopeStatement: form.get("scopeStatement"),
        rationale: form.get("rationale")
      });
      renderIntendedUse(result.intendedUse);
      const { languageReview } = await state.api.languageReview();
      renderLanguageReview(languageReview);
      showToast(`Working charter v${String(result.draft.version).padStart(2, "0")} recorded. No clinical, legal, pilot, or patient-use approval was created.`);
    } catch (error) {
      $("#intended-use-announcement").classList.add("failed");
      $("#intended-use-announcement").textContent = error.message;
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Record immutable draft";
    }
  });

  $("#seal-language-review").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing a review packet.");
    const button = $("#seal-language-review");
    button.disabled = true;
    button.textContent = "Sealing exact live copy…";
    try {
      const result = await state.api.sealLanguageReview();
      renderLanguageReview(result.languageReview);
      showToast(`Working copy packet v${String(result.packet.version).padStart(2, "0")} sealed. Clinical, legal, privacy, e-QPASS, pilot, and patient-use authority remain absent.`);
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = !state.connected || !state.languageReview?.intendedUse;
      button.textContent = "Seal current review packet";
    }
  });

  $("#seal-readiness").addEventListener("click", async () => {
    if (!state.connected) return showToast("Connect the local synthetic workspace before sealing readiness evidence.");
    const button = $("#seal-readiness");
    button.disabled = true;
    button.textContent = "Sealing evidence…";
    try {
      const result = await state.api.recordPilotReadinessSnapshot();
      await refreshReadinessSurfaces(result);
      showToast(`Blocked snapshot sealed: ${result.current.gateCounts.localCurrent} local patterns current; all 7 external decisions remain open.`);
    } catch (error) {
      renderPilotReadiness(state.pilotReadiness);
      renderMarketability(state.marketabilityMap);
      renderExecutiveHandoff(state.executiveHandoff);
      showToast(error.message);
    } finally {
      button.disabled = !state.connected;
      button.textContent = "Seal blocked snapshot";
    }
  });

  $("#edit-summary").addEventListener("click", () => {
    $("#summary-editor").value = getNarrative(currentAssessment());
    openDialog("#edit-dialog");
  });

  $("#edit-interpretation").addEventListener("click", () => {
    renderInterpretationEditor(currentAssessment());
    openDialog("#interpretation-dialog");
  });

  $("#interpretation-hypotheses").addEventListener("click", event => {
    const remove = event.target.closest(".remove-hypothesis");
    if (!remove) return;
    if ($$("#interpretation-hypotheses .hypothesis-editor").length <= 1) return showToast("At least one evidence-linked hypothesis is required.");
    remove.closest(".hypothesis-editor").remove();
    renumberInterpretationEditors();
  });

  $("#interpretation-questions").addEventListener("click", event => {
    const remove = event.target.closest(".remove-question");
    if (!remove) return;
    if ($$("#interpretation-questions .question-editor").length <= 1) return showToast("At least one follow-up question is required.");
    remove.closest(".question-editor").remove();
    renumberInterpretationEditors();
  });

  $("#add-question").addEventListener("click", () => {
    const list = $("#interpretation-questions");
    const count = list.querySelectorAll(".question-editor").length;
    if (count >= 8) return showToast("The structured interpretation supports up to eight follow-up questions.");
    list.insertAdjacentHTML("beforeend", questionEditorMarkup("", count));
    list.querySelector(".question-editor:last-child textarea").focus();
  });

  $("#save-interpretation").addEventListener("click", async () => {
    const interpretation = collectInterpretationEditor();
    const validationErrors = validateClinicalInterpretation(interpretation, currentAssessment());
    if (validationErrors.length) return showToast(validationErrors[0]);
    const button = $("#save-interpretation");
    button.disabled = true;
    try {
      if (state.connected) {
        await state.api.saveInterpretation(currentAssessment().id, interpretation);
        await refreshCurrent();
      } else {
        const assessment = currentAssessment();
        assessment.hypotheses = interpretation.hypotheses;
        assessment.questions = interpretation.questions;
        assessment.interpretationProvenance = { ...assessment.interpretationProvenance, source: "reviewer", revision: Number(assessment.interpretationProvenance?.revision || 0) + 1, actor: "Demo reviewer" };
        audit("Interpretation revised", "hypotheses and follow-up questions");
        renderReview();
        persistHostedEvaluation();
      }
      closeDialog("#interpretation-dialog");
      showToast("Structured interpretation revision saved with evidence provenance.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });
  $("#save-summary").addEventListener("click", async () => {
    const value = $("#summary-editor").value.trim();
    const errors = validateNarrative(value);
    if (errors.length) return showToast(errors[0]);
    const button = $("#save-summary");
    button.disabled = true;
    try {
      if (state.connected) {
        const { narrative } = await state.api.saveNarrative(currentAssessment().id, state.audience, value);
        state.narratives[`${currentAssessment().id}:${state.audience}`] = narrative.text;
        await refreshCurrent();
      } else {
        state.narratives[`${currentAssessment().id}:${state.audience}`] = value;
        $("#summary-text").textContent = value;
        audit("Narrative revised", `${state.audience} version updated`);
        persistHostedEvaluation();
      }
      closeDialog("#edit-dialog");
      showToast("Revision saved to the clinical review history.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#feedback-open").addEventListener("click", () => openDialog("#feedback-dialog"));
  $("#submit-feedback").addEventListener("click", async () => {
    const reasons = $$('#feedback-form input[name="reason"]:checked').map(input => input.value);
    const note = $("#feedback-note").value.trim();
    if (!reasons.length && !note) return showToast("Choose a reason or add a reviewer note.");
    const button = $("#submit-feedback");
    button.disabled = true;
    try {
      if (state.connected) {
        await state.api.submitFeedback(currentAssessment().id, reasons, note);
        await refreshCurrent();
      } else {
        currentAssessment().status = "priority";
        audit("Draft returned", [...reasons, note && "reviewer note"].filter(Boolean).join(", "));
        renderQueue($("#queue-search").value);
        persistHostedEvaluation();
      }
      closeDialog("#feedback-dialog");
      $("#feedback-form").reset();
      showToast("Feedback captured in the clinical quality log.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#report-incident").addEventListener("click", () => {
    $("#incident-form").reset();
    const assessmentId = state.timingTask?.assessmentId || state.calibrationCase?.assessmentId || currentAssessment()?.id;
    $("#incident-context").textContent = state.timingTask
      ? `${assessmentId} · ${state.timingTask.condition} timing task ${state.timingTask.taskId.slice(0, 8)}…`
      : state.calibrationCase
      ? `${assessmentId} · blind case ${state.calibrationCase.caseId.slice(0, 8)}…`
      : assessmentId || "General study event";
    openDialog("#incident-dialog");
  });

  $("#submit-incident").addEventListener("click", async () => {
    if (!$("#incident-form").reportValidity()) return;
    const button = $("#submit-incident");
    button.disabled = true;
    try {
      const payload = {
        assessmentId: state.timingTask?.assessmentId || state.calibrationCase?.assessmentId || currentAssessment()?.id || null,
        caseId: state.timingTask ? null : state.calibrationCase?.caseId || null,
        category: $("#incident-category").value,
        severity: $("#incident-severity").value,
        summary: $("#incident-summary").value.trim(),
        detail: $("#incident-detail").value.trim()
      };
      const result = await state.api.reportIncident(payload);
      closeDialog("#incident-dialog");
      $("#incident-form").reset();
      await refreshMetrics();
      showToast(result.control.state === "paused" ? "Incident recorded. The study is now paused." : "Incident recorded in the linked safety history.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#incident-list").addEventListener("click", event => {
    const button = event.target.closest(".resolve-incident");
    if (!button) return;
    const incident = state.incidents.find(item => item.id === button.dataset.incidentId);
    if (!incident) return;
    state.resolvingIncidentId = incident.id;
    $("#resolution-note").value = "";
    $("#resolution-incident").textContent = `${incident.severity.toUpperCase()} · ${incidentCategoryLabel(incident.category)} · ${incident.summary}`;
    openDialog("#resolution-dialog");
  });

  $("#submit-resolution").addEventListener("click", async () => {
    if (!state.resolvingIncidentId || !$("#resolution-form").reportValidity()) return;
    const button = $("#submit-resolution");
    button.disabled = true;
    try {
      const result = await state.api.resolveIncident(state.resolvingIncidentId, $("#resolution-note").value.trim());
      state.resolvingIncidentId = null;
      closeDialog("#resolution-dialog");
      await refreshMetrics();
      showToast(result.control.state === "active" ? "Resolution recorded. The study workflow is active." : "Resolution recorded; another stopping event remains open.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  const openChangeDialog = (signal = null) => {
    $("#change-form").reset();
    state.refinementSignalIds = signal ? [signal.id] : [];
    $("#change-refinement-link").hidden = !signal;
    $("#change-refinement-title").textContent = signal?.title || "Evidence signal";
    if (signal) {
      $("#change-component").value = signal.component || "model";
      $("#change-candidate-version").textContent = state.runtimeVersions[signal.component || "model"] || "Version unavailable";
      $("#change-reason").value = `${signal.improvementTarget} Regression focus: ${signal.regressionFocus}.`;
    } else {
      $("#change-candidate-version").textContent = "Choose a component";
    }
    openDialog("#change-dialog");
  };

  $("#register-change").addEventListener("click", () => openChangeDialog());

  $("#refinement-signals").addEventListener("click", event => {
    const button = event.target.closest("[data-refinement-link]");
    if (!button) return;
    const signal = state.refinement?.signals?.find(item => item.id === button.dataset.refinementLink);
    if (!signal?.candidateEligible) return showToast("This signal needs more independent evidence before it can scope a loaded candidate.");
    openChangeDialog(signal);
  });

  $("#change-component").addEventListener("change", event => {
    $("#change-candidate-version").textContent = state.runtimeVersions[event.target.value] || "Version unavailable";
  });

  $("#submit-change").addEventListener("click", async () => {
    if (!$("#change-form").reportValidity()) return;
    const button = $("#submit-change");
    button.disabled = true;
    try {
      await state.api.proposeChange({
        component: $("#change-component").value,
        baselineVersion: $("#change-baseline").value.trim(),
        reason: $("#change-reason").value.trim(),
        refinementSignalIds: state.refinementSignalIds
      });
      state.refinementSignalIds = [];
      closeDialog("#change-dialog");
      await loadChangeControl();
      showToast("Loaded candidate registered with the frozen synthetic case set.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#change-list").addEventListener("click", async event => {
    const button = event.target.closest("[data-change-action]");
    if (!button) return;
    const candidate = state.changes.find(item => item.id === button.dataset.changeId);
    if (!candidate) return;
    const action = button.dataset.changeAction;
    if (action === "replay") {
      button.disabled = true;
      try {
        const result = await state.api.replayChange(candidate.id);
        await loadChangeControl();
        showToast(result.event.engineeringRegressionPassed ? "Frozen synthetic replay passed. Clinical release remains blocked." : "Frozen synthetic replay failed. Do not advance this candidate.");
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
      return;
    }
    state.decidingChange = { id: candidate.id, disposition: action };
    $("#change-decision-form").reset();
    const advancing = action === "advance-for-clinical-review";
    $("#change-decision-title").textContent = advancing ? "Advance to clinical review" : "Roll back candidate";
    $("#change-decision-help").textContent = advancing
      ? "Record why the synthetic replay supports independent counselor and legal review."
      : "Record why this candidate must stop and what should happen next.";
    $("#change-decision-candidate").textContent = `${changeComponentLabel(candidate.component)} · ${candidate.candidateVersion}`;
    $("#submit-change-decision").textContent = advancing ? "Advance to clinical review" : "Record rollback";
    $("#submit-change-decision").classList.toggle("danger-button", !advancing);
    openDialog("#change-decision-dialog");
  });

  $("#submit-change-decision").addEventListener("click", async () => {
    if (!state.decidingChange || !$("#change-decision-form").reportValidity()) return;
    const button = $("#submit-change-decision");
    button.disabled = true;
    try {
      await state.api.decideChange(state.decidingChange.id, state.decidingChange.disposition, $("#change-decision-note").value.trim());
      const advanced = state.decidingChange.disposition === "advance-for-clinical-review";
      state.decidingChange = null;
      closeDialog("#change-decision-dialog");
      await loadChangeControl();
      showToast(advanced ? "Candidate advanced to independent clinical review. Live release remains blocked." : "Candidate rollback recorded in the linked history.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  ["#open-evidence", "#open-source"].forEach(selector => $(selector).addEventListener("click", () => openDialog("#evidence-dialog")));
  $("#command-open").addEventListener("click", () => openDialog("#guide-dialog"));
  $("#import-open").addEventListener("click", () => openDialog("#import-dialog"));

  const setPdfImportStatus = (status, title, detail) => {
    const element = $("#eqpass-pdf-status");
    element.dataset.state = status;
    element.innerHTML = `<span>${escapeHTML(title)}</span><p>${escapeHTML(detail)}</p>`;
  };

  const populateScoredForm = values => {
    const form = $("#scored-form-entry");
    for (const [name, value] of Object.entries(values)) {
      const control = form.elements.namedItem(name);
      if (control && "value" in control) control.value = String(value);
    }
  };

  const resetPdfImportPresentation = () => {
    state.pdfImport = null;
    $("#eqpass-pdf-label").textContent = "Choose e-QPASS PDF";
    setPdfImportStatus("idle", "Ready", "Select a report to extract all 15 required scores.");
  };

  $("#eqpass-pdf-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return resetPdfImportPresentation();
    $("#eqpass-pdf-label").textContent = file.name;
    setPdfImportStatus("reading", "Reading locally", "Finding the verified score tables. The PDF is not being uploaded.");
    try {
      const pages = await readEqpassPdfPages(file);
      const result = parseEqpassScoreReport(pages);
      populateScoredForm(result.values);
      state.pdfImport = {
        format: result.format,
        pageCount: result.pageCount,
        extractedFieldCount: result.extractedFieldCount,
        safetyHoldDetected: result.safetyHoldDetected
      };
      setPdfImportStatus(
        result.safetyHoldDetected ? "attention" : "complete",
        `${result.extractedFieldCount} scores extracted`,
        result.safetyHoldDetected
          ? "A non-zero critical screen was detected. Verify the scores below; PERL will hold approval for direct review."
          : "Score rows verified. Review the populated fields below, then generate the clinical summary."
      );
      $("#manual-entry-title").textContent = "Verify the extracted scores";
      $("#create-test-summary").textContent = "Generate from verified scores";
      $("#manual-entry-title").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      state.pdfImport = null;
      $("#scored-form-entry").elements.namedItem("entrySource").value = "manual";
      setPdfImportStatus("error", "PDF needs manual review", error.message);
      $("#create-test-summary").textContent = "Generate clinical summary";
    } finally {
      event.target.value = "";
    }
  });

  $("#fixture-file").addEventListener("change", async event => {
    state.selectedFixture = null;
    $("#import-errors").textContent = "";
    const file = event.target.files[0];
    if (!file) return;
    try {
      const candidate = JSON.parse(await file.text());
      if (candidate?.contractVersion === "eqpass-perl-score-event/rfi-0.1") {
        if (!state.connected) throw new Error("The proposed source-event fixture requires the local persistent API.");
        state.selectedFixture = { kind: "source-event", payload: candidate };
        $("#import-errors").style.color = "#347268";
        $("#import-errors").textContent = `${candidate.eventId || "Source event"} is ready for server validation.`;
        return;
      }
      const errors = validateAssessment(candidate);
      if (errors.length) $("#import-errors").innerHTML = errors.map(error => `• ${escapeHTML(error)}`).join("<br>");
      else {
        state.selectedFixture = { kind: "assessment", payload: candidate };
        $("#import-errors").style.color = "#347268";
        $("#import-errors").textContent = `${candidate.id} passed the assessment checks.`;
      }
    } catch (error) {
      $("#import-errors").textContent = error instanceof SyntaxError ? "The selected file is not valid JSON." : error.message;
    }
  });

  $("#load-fixture").addEventListener("click", async () => {
    if (!state.selectedFixture) return showToast("Choose a valid JSON assessment first.");
    const button = $("#load-fixture");
    button.disabled = true;
    try {
      const selected = state.selectedFixture;
      if (state.connected) {
        const detail = selected.kind === "source-event"
          ? (await state.api.importSourceEvent(selected.payload)).assessment
          : await state.api.importAssessment(selected.payload);
        const { assessments } = await state.api.listAssessments();
        state.assessments = assessments;
        applyDetail(detail);
        await refreshMetrics();
      } else {
        state.assessments.unshift(withInterpretation(selected.payload));
        state.currentIndex = 0;
        state.riskAcknowledged = false;
        state.audit = [{ time: "Now", actor: "Local import", action: "Assessment imported", detail: selected.payload.id }];
        persistHostedEvaluation();
      }
      renderQueue();
      renderReview();
      closeDialog("#import-dialog");
      switchView("review");
      showToast(state.connected
        ? (selected.kind === "source-event" ? "e-QPASS event validated and imported." : "Assessment persisted locally.")
        : "Assessment loaded into this workspace.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("#create-test-summary").addEventListener("click", async () => {
    const form = $("#scored-form-entry");
    if (!form.reportValidity()) return;
    const button = $("#create-test-summary");
    button.disabled = true;
    button.textContent = "Building summary…";
    $("#manual-entry-errors").textContent = "";
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const cameFromPdf = values.entrySource === "pdf";
      const assessment = buildSyntheticAssessmentFromScoreForm(values);
      const errors = validateAssessment(assessment);
      if (errors.length) throw new Error(errors[0]);
      if (state.assessments.some(item => item.id === assessment.id)) {
        throw new Error("That record ID already exists. Use a different internal reference.");
      }
      if (state.connected) {
        const detail = await state.api.importAssessment(assessment);
        const { assessments } = await state.api.listAssessments();
        state.assessments = assessments;
        applyDetail(detail);
        await refreshMetrics();
      } else {
        state.assessments.unshift(withInterpretation(assessment));
        state.currentIndex = 0;
        state.riskAcknowledged = false;
        state.audit = [{
          time: "Now",
          actor: state.reviewerCode,
          action: cameFromPdf ? "e-QPASS PDF extracted and verified" : "Scored assessment entered",
          detail: assessment.id
        }];
        persistHostedEvaluation();
      }
      renderQueue();
      renderReview();
      closeDialog("#import-dialog");
      switchView("review");
      form.reset();
      resetPdfImportPresentation();
      $("#manual-entry-title").textContent = "Review before generating";
      showToast(cameFromPdf
        ? "e-QPASS PDF scores converted into a clinician-review draft."
        : "Assessment scores converted into a clinician-review draft.");
    } catch (error) {
      $("#manual-entry-errors").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Generate clinical summary";
    }
  });

  $("#queue-search").addEventListener("input", event => renderQueue(event.target.value));

  $$(".content-tab").forEach(tab => {
    tab.addEventListener("click", () => selectContentTab(tab));
    tab.addEventListener("keydown", event => {
      const tabs = $$(".content-tab");
      const current = tabs.indexOf(tab);
      const targetIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
          : event.key === "ArrowRight" ? (current + 1) % tabs.length
            : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length
              : -1;
      if (targetIndex < 0) return;
      event.preventDefault();
      selectContentTab(tabs[targetIndex], { focus: true });
    });
  });

  $("#timing-start").addEventListener("click", () => void loadTimingTask());
  $("#timing-summary").addEventListener("input", updateTimingCharacterCount);
  $("#timing-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.timingTask || !event.currentTarget.reportValidity()) return;
    const button = $("#timing-submit");
    button.disabled = true;
    button.textContent = "Committing observation…";
    try {
      const result = await state.api.submitTimingTask(state.timingTask.taskId, $("#timing-summary").value.trim());
      state.timingResult = result.observation;
      state.timingTask = null;
      $("#timing-task").hidden = true;
      $("#timing-start").hidden = true;
      $("#timing-result").hidden = false;
      $("#timing-result-time").textContent = `${formatActiveDuration(result.observation.reviewTiming.activeSeconds)} active`;
      $("#timing-result-detail").textContent = result.observation.reviewTiming.eligible
        ? `${result.observation.condition === "perl-assisted" ? "PERL-assisted review" : "Unaided synthesis"} · protocol-eligible · ${result.observation.reviewTiming.pausedSeconds}s recorded pause time.`
        : `${result.observation.condition === "perl-assisted" ? "PERL-assisted review" : "Unaided synthesis"} · retained but flagged ${String(result.observation.reviewTiming.flag).replaceAll("-", " ")}. No observation alone supports a time-saving claim.`;
      $("#timing-lane-status").textContent = "Observation committed to linked history";
      await refreshMetrics();
      $("#timing-next").focus();
      showToast("Synthetic workflow timing committed with server provenance.");
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Submit timing observation";
    }
  });
  $("#timing-next").addEventListener("click", async () => {
    $("#timing-result").hidden = true;
    $("#timing-start").hidden = false;
    await loadTimingTask();
  });

  $("#comparison-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (state.connected && !state.calibrationCase) return showToast("The blind comparison is still loading.");
    const data = new FormData(event.currentTarget);
    const payload = {
      caseId: state.calibrationCase?.caseId || null,
      assessmentId: state.calibrationCase?.assessmentId || currentAssessment().id,
      preferred: data.get("preferred"),
      ratings: {
        A: {
          accuracy: Number(data.get("a-accuracy")),
          restraint: Number(data.get("a-restraint")),
          utility: Number(data.get("a-utility"))
        },
        B: {
          accuracy: Number(data.get("b-accuracy")),
          restraint: Number(data.get("b-restraint")),
          utility: Number(data.get("b-utility"))
        }
      },
      comment: data.get("comment") || ""
    };
    try {
      if (state.connected) {
        const result = await state.api.submitComparison(payload);
        await refreshMetrics();
        if (result.reveal) {
          $("#reveal-title").textContent = `You preferred ${authorLabel(result.reveal.preferredAuthor)}`;
          $("#reveal-detail").textContent = `Summary A was ${authorLabel(result.reveal.A)}. Summary B was ${authorLabel(result.reveal.B)}. The blinded mapping and ratings are now stored in the study log.`;
          $("#comparison-reveal").hidden = false;
          $("#comparison-submit").hidden = true;
          $("#next-comparison").hidden = false;
          setComparisonInputsDisabled(true);
          const reviewerProgress = state.calibrationCase?.reviewerProgress;
          if (reviewerProgress) $("#comparison-assignment").textContent = `Reviewer set · ${reviewerProgress.completed + 1} of ${reviewerProgress.available} complete`;
        }
      }
      showToast(`Comparison submitted: Summary ${payload.preferred} selected.`);
      if (!state.connected) event.currentTarget.reset();
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#next-comparison").addEventListener("click", async () => {
    state.calibrationCase = null;
    await loadCalibrationCase(true);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $(".sidebar").classList.contains("open")) {
      $(".sidebar").classList.remove("open");
      $("#mobile-menu").setAttribute("aria-expanded", "false");
      $("#mobile-menu").setAttribute("aria-label", "Open navigation");
      $("#mobile-menu").focus();
      return;
    }
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      switchView("queue");
      $("#queue-search").focus();
    }
  });
  window.addEventListener("hashchange", switchViewFromHash);
}

async function init() {
  restoreHostedEvaluation();
  buildRatings();
  renderReviewerIdentity();
  renderWorkspaceExperience(state.workspaceExperience || fallbackWorkspaceExperience());
  renderQueue();
  renderReview();
  addEventListeners();
  switchViewFromHash();
  await hydrateFromApi();
}

init();
