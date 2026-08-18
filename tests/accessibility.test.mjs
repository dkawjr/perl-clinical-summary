import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, script, styles, fieldworkStyles, reportStyles, languageReviewStyles, reportAssemblyStyles, decisionExchangeStyles, pilotOperationsStyles, providerActivationStyles, siteAdmissionStyles, authorityTrustStyles, pilotStartStyles, clinicalReleaseStyles, identityAccessStyles] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("fieldwork.css", root), "utf8"),
  readFile(new URL("report.css", root), "utf8"),
  readFile(new URL("language-review.css", root), "utf8"),
  readFile(new URL("report-assembly.css", root), "utf8"),
  readFile(new URL("decision-exchange.css", root), "utf8"),
  readFile(new URL("pilot-operations.css", root), "utf8"),
  readFile(new URL("provider-activation.css", root), "utf8"),
  readFile(new URL("site-admission.css", root), "utf8"),
  readFile(new URL("authority-trust.css", root), "utf8"),
  readFile(new URL("pilot-start.css", root), "utf8"),
  readFile(new URL("clinical-release.css", root), "utf8"),
  readFile(new URL("identity-access.css", root), "utf8")
]);

function luminance(hex) {
  const channels = hex.replace("#", "").match(/.{2}/g).map(value => Number.parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("views and mobile navigation expose a logical keyboard destination", () => {
  assert.match(html, /id="primary-sidebar"[^>]*aria-label="Primary navigation"/);
  assert.match(html, /id="mobile-menu"[^>]*aria-controls="primary-sidebar"[^>]*aria-expanded="false"/);
  for (const id of ["review", "queue", "progress", "fieldwork", "studio", "calibration", "governance"]) {
    assert.match(html, new RegExp(`id="${id}-title" tabindex="-1"`));
  }
  assert.match(script, /heading\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(script, /sidebar\.querySelector\("\.nav-item\.active"\)\?\.focus\(\)/);
  assert.match(styles, /\.sidebar \{ visibility: hidden;/);
  assert.match(styles, /\.sidebar\.open \{ visibility: visible;/);
});

test("Practice Studio separates display customization from safety and demographic decisioning", () => {
  const studio = html.match(/<section id="view-studio"[\s\S]*?<section id="view-calibration"/)?.[0] || "";
  const studioStyles = styles.split("/* Practice Studio · deliberate dual-mode workspace */")[1] || "";
  assert.match(html, /role="group" aria-label="Workspace mode"/);
  assert.equal((html.match(/<button[^>]*data-experience-mode="(?:clinical|studio)"/g) || []).length, 2);
  assert.match(html, /id="view-studio"[^>]*aria-labelledby="studio-title"/);
  assert.match(html, /id="studio-title" tabindex="-1"/);
  assert.match(studio, /id="workspace-profile-form"[^>]*aria-labelledby="profile-sheet-title"/);
  for (const id of ["workspace-role", "workspace-setting", "workspace-focus", "workspace-density", "demographic-dimension"]) assert.match(studio, new RegExp(`<label for="${id}">`));
  assert.match(studio, /id="workspace-save-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(studio, /id="demographic-cells"[^>]*aria-live="polite"/);
  assert.match(studio, /Minimum cell size five/);
  assert.match(studio, /no person-level drill-down/i);
  assert.doesNotMatch(studio, /type="text"|<textarea/);
  assert.match(html, /data-workspace-locked="safety"/);
  assert.match(html, /data-workspace-locked="limitations"/);
  assert.match(html, /data-workspace-locked="approval"/);
  assert.match(script, /state\.api\.workspaceExperience\(\)/);
  assert.match(script, /state\.api\.saveWorkspaceExperience\(profile\)/);
  assert.match(script, /safetyVisible|safetyCanBeHidden|alwaysVisibleModules|clinicalAuthorityChanged/);
  assert.match(styles, /\.experience-option \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.studio-masthead-action button,\.studio-form-foot button \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.studio-field-grid select,\.demographic-observatory select \{[^}]*min-height: 48px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.demographic-cells \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(studioStyles, /(?:linear|radial|conic)-gradient\(/);
  assert.ok(contrast("#b9c9c2", "#0b2625") >= 4.5);
  assert.ok(contrast("#d8b676", "#0b2625") >= 4.5);
});

test("deployment candidate blocks source-file impersonation and exposes a restrained runtime status", () => {
  const deploymentStyles = styles.match(/\.server-required \{[\s\S]*?@media \(max-width: 560px\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(html, /id="server-required"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="server-required-title"[^>]*hidden/);
  assert.match(html, /id="server-required-title"/);
  assert.match(html, /href="http:\/\/127\.0\.0\.1:4173\/"/);
  assert.match(html, /Launch PERL\.command/);
  assert.match(html, /id="deployment-candidate-bar"[^>]*aria-label="Deployment candidate status"[^>]*hidden/);
  assert.match(script, /window\.location\.protocol === "file:"/);
  assert.match(script, /\$\("#server-required"\)\.hidden = false/);
  assert.match(script, /presentation\.deploymentReviewReady \? "Ready for review" : "Initializing"/);
  assert.match(styles, /\.server-required-actions > a \{[^}]*min-height: 68px;/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*\.server-required \{ display: block; overflow: auto; \}/);
  assert.doesNotMatch(deploymentStyles, /(?:linear|radial|conic)-gradient\(/);
  assert.ok(contrast("#b5c4be", "#0d2521") >= 4.5);
  assert.ok(contrast("#172821", "#ddb86c") >= 4.5);
});

test("e-QPASS PDF intake is explicit, local, reviewable, and keyboard-native", () => {
  assert.match(html, /id="eqpass-pdf-file" type="file" accept="application\/pdf,\.pdf"/);
  assert.match(html, /id="eqpass-pdf-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /No PDF upload · no PDF retention · identifiers ignored/);
  assert.match(html, /PDF fills these fields · clinician verifies/);
  assert.match(script, /readEqpassPdfPages\(file\)/);
  assert.match(script, /parseEqpassScoreReport\(pages\)/);
  assert.match(script, /Generate from verified scores/);
  assert.match(styles, /\.eqpass-pdf-zone \{[\s\S]*?min-height: 172px;/);
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*?\.pdf-intake-section \{ grid-template-columns: 1fr; \}/);
});

test("every modal has an accessible name, a focus target, and non-validating dismiss controls", () => {
  const dialogs = [...html.matchAll(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/g)];
  assert.equal(dialogs.length, 11);
  for (const [, attributes, content] of dialogs) {
    const label = attributes.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(label, `Dialog is missing aria-labelledby: ${attributes.trim()}`);
    assert.match(content, new RegExp(`<h2 id="${label}" tabindex="-1">`));
    const dismissButtons = [...content.matchAll(/<button\b[^>]*value="cancel"[^>]*>/g)].map(match => match[0]);
    assert.ok(dismissButtons.length > 0, `${label} has no dismiss control`);
    for (const button of dismissButtons) assert.match(button, /formnovalidate/);
  }
  assert.match(script, /dialogOpeners\.set\(dialog, document\.activeElement\)/);
  assert.match(script, /dialog\.querySelector\("\[aria-labelledby\] h2, h2"\)\?\.focus\(\)/);
  assert.match(script, /opener\?\.isConnected/);
});

test("tabs and queue actions use native keyboard semantics", () => {
  assert.match(html, /id="hypotheses-tab"[^>]*role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(html, /id="questions-tab"[^>]*role="tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(script, /event\.key === "ArrowRight"/);
  assert.match(script, /event\.key === "ArrowLeft"/);
  assert.match(script, /event\.key === "Home"/);
  assert.match(script, /event\.key === "End"/);
  assert.doesNotMatch(script, /<tr data-record-index="\$\{index\}" tabindex=/);
  assert.match(script, /<button class="row-open" type="button" aria-label="Open record/);
});

test("focus indicators, touch targets, contrast, and motion preferences are explicit", () => {
  assert.match(styles, /a:focus-visible,/);
  assert.match(styles, /\.comparison-card:has\(input:focus-visible\)/);
  assert.match(styles, /\.search-field:focus-within,/);
  assert.match(styles, /\.icon-button, \.profile-button, \.dialog-close, \.row-open \{ width: 44px; height: 44px; \}/);
  assert.match(styles, /\.rating-options span \{ height: 44px; min-height: 44px; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(script, /prefersReducedMotion\(\) \? "auto" : "smooth"/);
  assert.ok(contrast("#53605c", "#fffefa") >= 4.5);
  assert.ok(contrast("#53605c", "#f4f1e9") >= 4.5);
  assert.ok(contrast("#8b4f00", "#fffefa") >= 3);
  assert.ok(contrast("#d9a85e", "#0b3538") >= 3);
  assert.ok(contrast("#d6b4a8", "#713b32") >= 4.5);
  assert.ok(contrast("#646a65", "#f7f2e8") >= 4.5);
  assert.ok(contrast("#d1b884", "#263330") >= 4.5);
  assert.ok(contrast("#ffffff", "#b63227") >= 4.5);
  assert.ok(contrast("#101517", "#c8ef39") >= 4.5);
  assert.match(identityAccessStyles, /\.identity-perimeter a:focus-visible/);
  assert.match(identityAccessStyles, /@media \(max-width: 680px\)/);
  assert.match(identityAccessStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(reportStyles, /@media screen \{/);
  assert.match(reportStyles, /\.report-toolbar a:focus-visible, \.report-toolbar button:focus-visible/);
  assert.match(reportAssemblyStyles, /\.assembly-toolbar a:focus-visible, \.assembly-toolbar button:focus-visible/);
});

test("approval and handoff language do not imply a pilot release", () => {
  assert.doesNotMatch(html, /Approve for pilot/);
  assert.doesNotMatch(script, /Approve for pilot/);
  assert.match(html, /Approve clinician summary/);
  assert.match(html, /id="attachment-card"[^>]*aria-live="polite"/);
  assert.match(html, /id="open-assembly-proof"[^>]*target="_blank"[^>]*rel="noopener"[^>]*hidden/);
  assert.match(html, /id="provider-workflow"[^>]*aria-live="polite"/);
  assert.match(html, /id="model-gateway"[^>]*aria-live="polite"/);
  assert.match(html, /id="delivery-control"[^>]*aria-live="polite"/);
  assert.match(html, /id="automation-atelier"[^>]*aria-labelledby="automation-atelier-title"[^>]*aria-live="polite"/);
  assert.match(html, /id="start-integration-rehearsal"[^>]*type="button"/);
  assert.match(html, /id="automation-runline"[^>]*aria-label="Latest Findings-to-summary automation run"/);
  assert.match(html, /id="recovery-vault"[^>]*aria-labelledby="recovery-vault-title"/);
  assert.match(html, /class="recovery-proofline" aria-label="Recovery rehearsal verification sequence"/);
  assert.match(html, /id="recovery-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="run-recovery"[^>]*type="button"/);
  assert.match(html, /id="rollback-dossier"[^>]*aria-labelledby="rollback-dossier-title"/);
  assert.match(html, /class="rollback-proofline" aria-label="Application rollback compatibility sequence"/);
  assert.match(html, /id="rollback-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="run-rollback"[^>]*type="button"/);
  assert.match(html, /id="operations-watch"[^>]*aria-labelledby="operations-watch-title"/);
  assert.match(html, /id="monitoring-local-signals"[^>]*aria-live="polite"/);
  assert.match(html, /id="monitoring-gap-signals"[^>]*aria-live="polite"/);
  assert.match(html, /id="monitoring-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="run-monitoring-probe"[^>]*type="button"/);
  assert.match(html, /id="response-desk"[^>]*aria-labelledby="response-desk-title"/);
  assert.match(html, /id="response-phase-list"[^>]*aria-live="polite"/);
  assert.match(html, /id="response-owner-tree"[^>]*aria-live="polite"/);
  assert.match(html, /id="response-prerequisites"[^>]*aria-label="Incident-response rehearsal prerequisites"[^>]*aria-live="polite"/);
  assert.match(html, /id="response-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="run-response-rehearsal"[^>]*type="button"/);
  assert.match(html, /id="marketability-map"[^>]*aria-labelledby="marketability-map-title"/);
  assert.match(html, /id="marketability-phases"[^>]*aria-live="polite"/);
  assert.match(html, /id="marketability-runway-title"/);
  assert.match(html, /id="marketability-decisions"/);
  assert.match(html, /id="decision-room"[^>]*aria-labelledby="decision-room-title"/);
  assert.match(html, /id="handoff-packets"[^>]*aria-live="polite"/);
  assert.match(html, /id="decision-return-title"/);
  assert.match(html, /href="\/api\/governance\/handoff\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /href="\/api\/governance\/handoff\.json"[^>]*download=/);
  assert.match(html, /id="permission-ledger"[^>]*aria-labelledby="permission-ledger-title"/);
  assert.match(html, /id="permission-local-gates"[^>]*aria-live="polite"/);
  assert.match(html, /id="permission-external-gates"[^>]*aria-live="polite"/);
  assert.match(html, /id="permission-authority-register"[^>]*aria-live="polite"/);
  assert.match(html, /id="permission-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="seal-readiness"[^>]*type="button"/);
  assert.match(html, /id="clinical-standard"[^>]*aria-labelledby="clinical-standard-title"/);
  assert.match(html, /id="clinical-standard-form"[^>]*aria-labelledby="standard-drafting-title"/);
  assert.match(html, /id="clinical-standard-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="save-clinical-standard"[^>]*type="submit"/);
  assert.match(html, /id="standard-minimumBlindPreferenceRate"[^>]*required/);
  assert.match(html, /id="standard-rationale"[^>]*minlength="40"[^>]*maxlength="1200"[^>]*required/);
  assert.match(html, /id="independent-review"[^>]*aria-labelledby="independent-review-title"/);
  assert.match(html, /id="independent-domains"[^>]*class="independent-domain-grid"/);
  assert.match(html, /id="independent-local-gates"[^>]*aria-live="polite"/);
  assert.match(html, /id="independent-external-gates"[^>]*aria-live="polite"/);
  assert.match(html, /id="independent-review-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="seal-independent-review"[^>]*type="button"/);
  assert.match(html, /href="\/api\/calibration\/independent-review\.json"[^>]*download="perl-independent-review-dossier\.json"/);
  assert.match(html, /class="evaluation-admission"[^>]*aria-labelledby="evaluation-admission-title"/);
  assert.match(html, /id="independent-admission-prerequisites"[^>]*aria-live="polite"/);
  assert.match(html, /id="independent-admission-duties"[^>]*aria-live="polite"/);
  assert.match(html, /id="independent-admission-file"[^>]*type="file"[^>]*accept="application\/json,\.json"[^>]*aria-describedby="independent-admission-file-help independent-admission-file-state"/);
  assert.match(html, /id="independent-admission-file-state"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="issue-independent-admission-challenge"[^>]*type="button"/);
  assert.match(html, /id="verify-independent-admission-attestation"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="independent-admission-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /href="\/api\/calibration\/independent-review\/admission\.json"[^>]*download="perl-independent-review-admission-docket\.json"/);
  assert.match(html, /id="owner-return-desk"[^>]*aria-labelledby="owner-return-title"/);
  assert.match(html, /id="owner-return-artifacts"[^>]*aria-live="polite"/);
  assert.match(html, /<label class="owner-return-file" for="owner-return-file">/);
  assert.match(html, /id="owner-return-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="owner-return-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="preflight-owner-return"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /href="\/api\/integration\/owner-return\/request\.json"[^>]*download="perl-eqpass-owner-return-request\.json"/);
  assert.match(html, /aria-label="Automated Findings-to-handoff workflow"/);
  assert.match(html, /A complete automation line, with the human decision left intact/);
  assert.match(script, /No production attachment is claimed\./);
  assert.match(script, /Production backup and RPO\/RTO still require owner approval\./);
  assert.match(script, /No PDF was written to e-QPASS and no attachment is claimed\./);
  assert.match(script, /\/report-package\.html/);
  assert.match(styles, /\.recovery-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.rollback-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.monitoring-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.response-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.response-scenario-select \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.permission-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.decision-room-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.standard-save-row button \{[^}]*min-height: 46px;/);
  assert.match(styles, /\.standard-field-grid input \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.independent-seal-row button \{[^}]*min-height: 46px;/);
  assert.match(styles, /\.owner-return-file input \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.owner-return-preflight button \{[^}]*min-height: 46px;/);
  assert.match(styles, /\.assembly-proof-link \{[^}]*min-height: 52px;/);
  assert.match(styles, /\.automation-atelier-action button \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.automation-run-card button \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.automation-runline \{ grid-template-columns: 1fr 1fr; \}/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.owner-return-artifacts \{ grid-template-columns: 1fr; \}/);
  assert.match(script, /Production telemetry and alert delivery remain unconnected\./);
  assert.match(script, /No production incident was declared, no notification was sent, and restart remains unauthorized\./);
  assert.match(script, /all 7 external decisions remain open\./);
  assert.match(script, /All six external decisions remain open\./);
  assert.match(script, /No evaluator result was recorded\./);
  assert.match(styles, /\.admission-challenge-actions button,[\s\S]*?min-height: 48px;/);
  assert.match(script, /The RFI remains open\./);
  assert.match(script, /64 \* 1024/);
  assert.match(script, /not a delivery-date commitment, production-readiness claim, or pilot authorization/);
  assert.match(script, /This read-only packet organizes questions and requested returns\./);
});

test("Decision Exchange exposes seven keyboard-native requests and a metadata-only return preflight", () => {
  const exchange = html.match(/<section id="decision-exchange"[\s\S]*?<\/section>\s*<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="decision-exchange"[^>]*aria-labelledby="decision-exchange-title"/);
  assert.match(html, /id="decision-exchange-title">Permission needs a return address\.<\/h2>/);
  assert.match(html, /id="decision-exchange-gates"[^>]*aria-label="External decision packets"/);
  assert.match(html, /id="decision-exchange-state"/);
  assert.match(html, /id="decision-exchange-scoreboard"|class="decision-exchange-scoreboard" aria-live="polite"/);
  assert.match(html, /<label class="decision-return-file" for="decision-return-file">/);
  assert.match(html, /id="decision-return-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="preflight-decision-return"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="decision-return-history"/);
  assert.match(html, /href="\/api\/governance\/decision-exchange\.json"[^>]*download="perl-external-decision-exchange\.json"/);
  assert.doesNotMatch(exchange, /<button[^>]*>\s*(?:Approve|Accept|Close gate|Authorize)\b/i);
  assert.match(script, /function renderDecisionExchange\(/);
  assert.match(script, /state\.api\.decisionExchange\(\)/);
  assert.match(script, /preflightDecisionReturn\(state\.decisionReturnManifest\)/);
  assert.match(script, /64 \* 1024/);
  assert.match(script, /Identity, evidence, signature, authority, acceptance, and the gate remain unverified/);
  assert.match(styles, /\.decision-exchange-head-actions span,\.decision-exchange-head-actions a \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.decision-exchange-gate \{[^}]*min-height: 88px;/);
  assert.match(styles, /#preflight-decision-return \{[^}]*min-height: 48px;/);
  assert.match(styles, /@media \(max-width:680px\) \{[\s\S]*\.decision-exchange-gates \{ grid-template-columns: 1fr; \}/);
  assert.match(decisionExchangeStyles, /:focus-visible \{ outline:3px solid #d8ad67;/);
  assert.match(decisionExchangeStyles, /@page \{ size:Letter; margin:0; \}/);
  assert.match(decisionExchangeStyles, /@media \(max-width:620px\)/);
  assert.match(decisionExchangeStyles, /\.exchange-toolbar>a,\.exchange-toolbar div a,\.exchange-toolbar button \{[^}]*min-height:44px;/);
});

test("Provider Pilot Operations exposes a keyboard-native plan without a launch control", () => {
  const studio = html.match(/<section id="pilot-operations"[\s\S]*?<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="pilot-operations"[^>]*aria-labelledby="pilot-operations-title"/);
  assert.match(html, /id="pilot-operations-title">Start with an operating agreement\.<\/h2>/);
  assert.match(html, /id="pilot-pathway-buttons"[^>]*aria-label="Source-reported pilot pathways"/);
  assert.match(html, /id="pilot-training-modules"/);
  assert.match(html, /id="pilot-review-cadence"/);
  assert.match(html, /id="pilot-measures"/);
  assert.match(html, /id="pilot-admission-gates"/);
  assert.match(html, /id="pilot-commercial-assumptions"/);
  assert.match(html, /id="seal-pilot-operations"[^>]*type="button"/);
  assert.match(html, /href="\/api\/governance\/pilot-operations\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /href="\/api\/governance\/pilot-operations\.json"[^>]*download=/);
  assert.doesNotMatch(studio, /<button[^>]*>\s*(?:Approve site|Authorize pilot|Start pilot|Renew|Expand)\b/i);
  assert.match(script, /function renderPilotOperations\(/);
  assert.match(script, /state\.api\.pilotOperations\(\)/);
  assert.match(script, /recordPilotOperationsSnapshot\(\)/);
  assert.match(script, /No site, agreement, training, pilot, outcome, renewal, expansion, production, or patient-use authority was created/);
  assert.match(styles, /\.pilot-pathway-button:focus-visible/);
  assert.match(styles, /\.pilot-operations-foot button \{[^}]*min-height:44px;/);
  assert.match(styles, /@media \(max-width:680px\) \{[\s\S]*\.pilot-pathway-buttons,\.pilot-measure-ledger>ol,\.pilot-admission-gates \{ grid-template-columns:1fr; \}/);
  assert.match(pilotOperationsStyles, /\.pilot-brief-toolbar a:focus-visible/);
  assert.match(pilotOperationsStyles, /@page \{ size:Letter; margin:0; \}/);
  assert.match(pilotOperationsStyles, /@media \(max-width:620px\)/);
  assert.match(pilotOperationsStyles, /min-height:44px/);
});

test("Provider Activation exposes observable rehearsal evidence without a completion control", () => {
  const workbook = html.match(/<section id="provider-activation"[\s\S]*?<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="provider-activation"[^>]*aria-labelledby="provider-activation-title"/);
  assert.match(html, /id="provider-activation-title">Practice the judgment before the workflow goes live\.<\/h2>/);
  assert.match(html, /id="activation-modules"/);
  assert.match(html, /id="activation-objectives"/);
  assert.match(html, /id="activation-drills"/);
  assert.match(html, /id="activation-returns"/);
  assert.match(html, /id="seal-provider-activation"[^>]*type="button"/);
  assert.match(html, /href="\/api\/governance\/provider-activation\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /href="\/api\/governance\/provider-activation\.json"[^>]*download=/);
  assert.doesNotMatch(workbook, /<button[^>]*>\s*(?:Record attendance|Pass drill|Complete training|Activate site|Authorize pilot)\b/i);
  assert.match(script, /function renderProviderActivation\(/);
  assert.match(script, /state\.api\.providerActivation\(\)/);
  assert.match(script, /recordProviderActivationSnapshot\(\)/);
  assert.match(script, /No session, attendance, competency, completion, site activation, pilot, production, or patient-use authority was created/);
  assert.match(styles, /\.provider-activation-actions a:focus-visible/);
  assert.match(styles, /\.provider-activation-foot button\{min-height:48px/);
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.activation-objective-list,\.activation-drills,\.activation-return-book ol\{grid-template-columns:1fr\}/);
  assert.match(providerActivationStyles, /\.activation-toolbar a:focus-visible/);
  assert.match(providerActivationStyles, /@page\{size:Letter;margin:0\}/);
  assert.match(providerActivationStyles, /@media\(max-width:540px\)/);
  assert.match(providerActivationStyles, /min-height:44px/);
});

test("Named-Site Admission exposes exact candidate returns without a local authorization control", () => {
  const admission = html.match(/<section id="site-admission"[\s\S]*?<section id="authority-trust"/)?.[0] || "";
  assert.match(html, /id="site-admission"[^>]*aria-labelledby="site-admission-title"/);
  assert.match(html, /id="site-admission-title">Name the boundary\. Then earn the signature\.<\/h2>/);
  assert.match(html, /id="site-admission-candidates"[^>]*aria-label="Named-site candidate dossiers"/);
  assert.match(html, /id="site-admission-books"/);
  assert.match(html, /id="site-admission-gates"/);
  assert.match(html, /id="site-admission-return-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="preflight-site-admission"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="site-admission-dossier"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /href="\/api\/governance\/site-admission\.json"[^>]*download=/);
  assert.doesNotMatch(admission, /<button[^>]*>\s*(?:Verify site|Accept evidence|Sign|Authorize|Start pilot)\b/i);
  assert.match(script, /function renderSiteAdmission\(/);
  assert.match(script, /state\.api\.siteAdmission\(\)/);
  assert.match(script, /preflightSiteAdmissionReturn\(state\.siteAdmissionReturnManifest\)/);
  assert.match(script, /96 \* 1024/);
  assert.match(script, /Site, evidence, identity, signature, authority, agreement, dates, activation, and pilot authorization remain unverified/);
  assert.match(styles, /\.site-admission-actions a\{[^}]*min-height:44px/);
  assert.match(styles, /\.site-admission-return-actions a,\.site-admission-return-actions label,\.site-admission-return-actions button\{[^}]*min-height:48px/);
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.site-admission-candidates,\.site-admission-books\{grid-template-columns:1fr\}/);
  assert.match(siteAdmissionStyles, /\.admission-toolbar a:focus-visible/);
  assert.match(siteAdmissionStyles, /@page\{size:Letter;margin:0\}/);
  assert.match(siteAdmissionStyles, /@media\(max-width:540px\)/);
  assert.match(siteAdmissionStyles, /min-height:44px/);
});

test("Governed Authority Trust exposes signed receipt verification without a local trust-root or pilot-start control", () => {
  const trust = html.match(/<section id="authority-trust"[\s\S]*?<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="authority-trust"[^>]*aria-labelledby="authority-trust-title"/);
  assert.match(html, /id="authority-trust-title">Trust doesn’t arrive as a checkbox\.<\/h2>/);
  assert.match(html, /id="authority-trust-candidates"[^>]*aria-label="Authority-trust candidates"/);
  assert.match(html, /id="issue-authority-trust-challenge"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="authority-trust-receipt-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="verify-authority-trust-receipt"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /href="\/api\/governance\/authority-trust\/registry-template\.json"[^>]*download=/);
  assert.match(html, /href="\/api\/governance\/authority-trust\.json"[^>]*download=/);
  assert.doesNotMatch(trust, /<button[^>]*>\s*(?:Create key|Add key|Trust key|Start pilot|Activate provider|Release production)\b/i);
  assert.match(script, /function renderAuthorityTrust\(/);
  assert.match(script, /state\.api\.authorityTrust\(\)/);
  assert.match(script, /issueAuthorityTrustChallenge\(state\.authorityTrustCandidateId\)/);
  assert.match(script, /verifyAuthorityTrustReceipt\(state\.authorityTrustReceipt\)/);
  assert.match(script, /64 \* 1024/);
  assert.match(authorityTrustStyles, /\.authority-trust a:focus-visible/);
  assert.match(authorityTrustStyles, /min-height:44px/);
  assert.match(authorityTrustStyles, /min-height:48px/);
  assert.match(authorityTrustStyles, /@media\(max-width:680px\)/);
  assert.doesNotMatch(authorityTrustStyles, /linear-gradient|radial-gradient/);
});

test("Pilot-Start Interlock exposes two bounded verification duties without a clinical launch control", () => {
  const interlock = html.match(/<section id="pilot-start"[\s\S]*?<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="pilot-start"[^>]*aria-labelledby="pilot-start-title"/);
  assert.match(html, /id="pilot-start-title">One seal may authorize\. It may not press Start\.<\/h2>/);
  assert.match(html, /id="pilot-start-candidates"[^>]*aria-label="Pilot-start candidates"/);
  assert.match(html, /id="pilot-start-prerequisites"/);
  assert.match(html, /id="pilot-start-order-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="pilot-start-ack-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="verify-pilot-start-order"[^>]*disabled/);
  assert.match(html, /id="verify-pilot-start-ack"[^>]*disabled/);
  assert.doesNotMatch(interlock, /<button[^>]*>\s*(?:Start live pilot|Enable clinical traffic|Authorize patient use|Release production)\b/i);
  assert.match(script, /function renderPilotStart\(/);
  assert.match(script, /state\.api\.pilotStart\(\)/);
  assert.match(script, /verifyPilotStartOrder\(state\.pilotStartOrder\)/);
  assert.match(script, /verifyPilotStartAcknowledgement\(state\.pilotStartAcknowledgement\)/);
  assert.match(pilotStartStyles, /:focus-visible/);
  assert.match(pilotStartStyles, /min-height:48px/);
  assert.match(pilotStartStyles, /@media\(max-width:680px\)/);
  assert.doesNotMatch(pilotStartStyles, /linear-gradient|radial-gradient/);
});

test("Governed Clinical Release exposes three separated seals while keeping traffic activation external", () => {
  const release = html.match(/<section id="clinical-release"[\s\S]*?<section id="intended-use-registry"/)?.[0] || "";
  assert.match(html, /id="clinical-release"[^>]*aria-labelledby="clinical-release-title"/);
  assert.match(html, /id="clinical-release-title">Three seals may release\. None may turn on traffic\.<\/h2>/);
  assert.match(html, /id="clinical-release-candidates"[^>]*aria-label="Clinical-release candidates"/);
  assert.match(html, /id="clinical-release-prerequisites"/);
  assert.match(html, /id="clinical-release-clinical-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="clinical-release-production-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="clinical-release-attestation-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="verify-clinical-release-clinical"[^>]*disabled/);
  assert.match(html, /id="verify-clinical-release-production"[^>]*disabled/);
  assert.match(html, /id="verify-clinical-release-attestation"[^>]*disabled/);
  assert.doesNotMatch(release, /<button[^>]*>\s*(?:Enable clinical traffic|Start live pilot|Process first record)\b/i);
  assert.match(script, /function renderClinicalRelease\(/);
  assert.match(script, /state\.api\.clinicalRelease\(\)/);
  assert.match(script, /verifyClinicalUseAuthorization\(state\.clinicalReleaseClinicalAuthorization\)/);
  assert.match(script, /verifyProductionReleaseAuthorization\(state\.clinicalReleaseProductionAuthorization\)/);
  assert.match(script, /verifyReleaseDeploymentAttestation\(state\.clinicalReleaseDeploymentAttestation\)/);
  assert.match(script, /Release evidence is ready, while the traffic switch and first governed transaction remain external/);
  assert.match(clinicalReleaseStyles, /:focus-visible/);
  assert.match(clinicalReleaseStyles, /min-height:48px/);
  assert.match(clinicalReleaseStyles, /@media\(max-width:680px\)/);
  assert.doesNotMatch(clinicalReleaseStyles, /linear-gradient|radial-gradient/);
});

test("Intended Use Registry exposes a bounded provider-first charter without an approval control", () => {
  assert.match(html, /id="intended-use-registry"[^>]*aria-labelledby="intended-use-title"/);
  assert.match(html, /id="intended-use-title">Define the job before approving the language\.<\/h2>/);
  assert.match(html, /id="intended-use-form"/);
  assert.match(html, /name="pilotContext"[^>]*required/);
  assert.match(html, /id="intended-use-statement"[^>]*minlength="120"[^>]*maxlength="1200"[^>]*required/);
  assert.match(html, /id="intended-use-rationale"[^>]*minlength="40"[^>]*maxlength="1200"[^>]*required/);
  assert.match(html, /id="save-intended-use"[^>]*type="submit"/);
  assert.match(html, /id="intended-use-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="intended-use-audiences"[^>]*aria-live="polite"/);
  assert.match(html, /href="\/api\/governance\/intended-use\.json"[^>]*download="perl-intended-use-charter\.json"/);
  assert.match(script, /function renderIntendedUse\(/);
  assert.match(script, /state\.api\.intendedUse\(\)/);
  assert.match(script, /saveIntendedUseDraft\(/);
  assert.match(script, /No clinical, legal, pilot, or patient-use approval was created/);
  assert.match(styles, /#save-intended-use \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.intended-use-state, \.intended-use-export \{[^}]*min-height: 44px;/);
  assert.match(styles, /#intended-use-form select \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.intended-use-audiences \{ grid-template-columns: 1fr; \}/);
});

test("Language Review Office exposes exact copy review without a local approval control", () => {
  const office = html.match(/<section id="language-review-office"[\s\S]*?<\/section>\s*<section id="permission-ledger"/)?.[0] || "";
  assert.match(html, /id="language-review-office"[^>]*aria-labelledby="language-review-title"/);
  assert.match(html, /id="language-review-title">Approve the words before they travel\.<\/h2>/);
  assert.match(html, /id="language-review-surfaces"[^>]*aria-live="polite"/);
  assert.match(html, /id="language-review-questions"/);
  assert.match(html, /id="language-review-acceptances"/);
  assert.match(html, /id="language-review-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="seal-language-review"[^>]*type="button">Seal current review packet<\/button>/);
  assert.match(html, /href="\/api\/governance\/language-review\.json"[^>]*download="perl-language-review-packet\.json"/);
  assert.match(html, /href="\/api\/governance\/language-review\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.doesNotMatch(office, /<button[^>]*>\s*(?:Approve|Accept|Freeze)\b/i);
  assert.match(script, /function renderLanguageReview\(/);
  assert.match(script, /state\.api\.languageReview\(\)/);
  assert.match(script, /sealLanguageReview\(\)/);
  assert.match(script, /Clinical, legal, privacy, e-QPASS, pilot, and patient-use authority remain absent/);
  assert.match(styles, /\.language-review-state, \.language-review-export \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.language-review-action \{[^}]*min-height: 48px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.language-review-surfaces, \.language-review-brief ol, \.language-acceptance-book ol \{ grid-template-columns: 1fr; \}/);
  assert.match(languageReviewStyles, /\.review-toolbar button \{[^}]*min-height: 44px;/);
  assert.match(languageReviewStyles, /@page \{ size: Letter; margin: 0; \}/);
  assert.match(languageReviewStyles, /@media \(max-width: 620px\)/);
});

test("audience previews expose all promised roles without borrowing clinician approval", () => {
  assert.match(html, /<option value="care">Care coordinator<\/option>/);
  assert.match(html, /<option value="payer">Payer \/ utilization<\/option>/);
  assert.match(html, /<option value="admin">Operations \/ admin<\/option>/);
  assert.match(html, /id="audience-boundary" class="audience-boundary"/);
  assert.match(script, /Audience handoff preview · clinician approval separate/);
  assert.match(script, /Switch to Clinician before making a clinical approval or return decision/);
  assert.match(script, /sheet\.classList\.toggle\("audience-preview", !clinician\)/);
  assert.match(script, /\/handoff\/\$\{encodeURIComponent\(state\.audience\)\}\.html/);
  assert.match(styles, /\.summary-block \.audience-boundary/);
  assert.match(styles, /\.report-sheet\.audience-preview > \.instrument/);
  assert.match(styles, /@media \(max-width: 1150px\) \{[\s\S]*\.review-grid \{ grid-template-columns: 1fr; \}[\s\S]*\.context-rail \{ grid-template-columns: 1fr 1fr; \}/);
});

test("workflow timing lane exposes a labeled bounded form and explicit non-claim status", () => {
  assert.match(html, /<section class="timing-lane" aria-labelledby="timing-lane-title">/);
  assert.match(html, /<label for="timing-summary">Summary text<\/label>/);
  assert.match(html, /id="timing-summary"[^>]*minlength="80"[^>]*maxlength="1500"[^>]*required/);
  assert.match(html, /id="timing-result"[^>]*role="status"/);
  assert.match(html, /class="workflow-timing-grid" aria-live="polite"/);
  assert.match(html, /No result here establishes time saved/);
  assert.match(script, /window\.requestAnimationFrame\(\(\) => \$\("#timing-summary"\)\.focus\(\)\)/);
  assert.match(styles, /\.timing-start-button \{[^}]*min-height: 44px;/);
});

test("calibration intake exposes a named aggregate-only decision surface", () => {
  assert.match(html, /<section class="intake-studio" aria-labelledby="intake-studio-title">/);
  assert.match(html, /id="intake-score-grid"|class="intake-score-grid" aria-live="polite"/);
  assert.match(html, /id="intake-lanes" class="intake-lane-grid"/);
  assert.match(html, /id="intake-return-title"/);
  assert.match(html, /id="intake-returns"/);
  assert.match(html, /id="intake-prohibited"/);
  assert.match(html, /href="\/api\/calibration\/intake\.json"[^>]*download="perl-calibration-intake-map\.json"/);
  assert.match(html, /No assessment files have been received or inspected/);
  assert.match(script, /function renderCalibrationIntake\(/);
  assert.match(script, /state\.api\.calibrationIntake\(\)/);
  assert.match(styles, /\.intake-export \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.intake-lane-grid \{ grid-template-columns: 1fr; \}/);
});

test("Model Trial Bench exposes exactly three comparable candidates without provider or clinical authority", () => {
  assert.match(html, /id="model-trial-bench"[^>]*aria-labelledby="model-trial-title"/);
  assert.match(html, /id="model-trial-title">Three candidates\. One standard\.<\/h2>/);
  assert.match(html, /id="model-trial-candidates"[^>]*aria-live="polite"/);
  assert.equal((html.match(/class="model-trial-candidate"/g) || []).length, 3);
  assert.match(html, /id="model-trial-domains"/);
  assert.match(html, /id="model-trial-file"[^>]*type="file"[^>]*accept="application\/json,\.json"/);
  assert.match(html, /id="preflight-model-trial"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="model-trial-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /href="\/api\/calibration\/model-trial\/request\.json"[^>]*download="perl-model-trial-candidate-request\.json"/);
  assert.match(html, /href="\/api\/calibration\/model-trial\.json"[^>]*download="perl-model-trial-bench\.json"/);
  assert.match(html, /Do not include credentials, endpoints, files, output, responses, Findings, identifiers, records, or PHI/);
  assert.match(script, /function renderModelTrial\(/);
  assert.match(script, /state\.api\.modelTrial\(\)/);
  assert.match(script, /preflightModelTrial\(state\.modelTrialManifest\)/);
  assert.match(script, /No engine was selected or contacted/);
  assert.match(styles, /#preflight-model-trial \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.model-trial-file input \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.model-trial-state,\.model-trial-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.model-trial-candidates \{ grid-template-columns: 1fr; \}/);
});

test("Candidate Trial Foundry exposes a predeclared nine-run and twelve-blind workflow without an execution control", () => {
  assert.match(html, /id="candidate-trial-foundry"[^>]*aria-labelledby="candidate-trial-title"/);
  assert.match(html, /id="candidate-trial-title">Nine runs\. Twelve blinds\. No winner by impression\.<\/h2>/);
  assert.match(html, /id="candidate-trial-runs"[^>]*aria-live="polite"/);
  assert.equal((html.match(/<article><div><small>Candidate 0[1-3]<\/small><strong>0[1-3]<\/strong><\/div><span data-state="held">/g) || []).length, 3);
  assert.match(html, /id="candidate-trial-measures"/);
  assert.match(html, /id="candidate-trial-gates"/);
  assert.match(html, /id="snapshot-candidate-trial"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="candidate-trial-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /href="\/api\/calibration\/candidate-trial\.json"[^>]*download="perl-candidate-trial-protocol\.json"/);
  assert.match(html, /No payloads, outputs, reviewers, provider calls, or PHI are present/);
  assert.match(script, /function renderCandidateTrial\(/);
  assert.match(script, /state\.api\.candidateTrial\(\)/);
  assert.match(script, /recordCandidateTrialSnapshot\(\)/);
  assert.match(script, /const latestSnapshot = candidateTrial\.latestSnapshot/);
  assert.match(script, /Planning snapshot \$\{String\(latestSnapshot\.sequence\)\.padStart\(2, "0"\)\} recorded/);
  assert.match(script, /All 9 candidate runs remain held and trial execution remains unauthorized/);
  assert.match(styles, /#snapshot-candidate-trial \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.candidate-trial-state,\.candidate-trial-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.candidate-trial-gate-zone ol \{ grid-template-columns: 1fr; \}/);
});

test("Counselor Lab exposes a named three-session sequence without clinical acceptance language", () => {
  assert.match(html, /<section class="counselor-lab" aria-labelledby="counselor-lab-title">/);
  assert.match(html, /id="counselor-lab-score"|class="counselor-lab-score" aria-live="polite"/);
  assert.match(html, /id="counselor-lab-sessions" class="counselor-lab-sessions"/);
  assert.match(html, /id="counselor-lab-preflight-title"/);
  assert.match(html, /id="counselor-lab-preflight"/);
  assert.match(html, /id="counselor-lab-fingerprint"/);
  assert.match(html, /href="\/api\/calibration\/counselor-lab\.json"[^>]*download="perl-counselor-lab-session-plan\.json"/);
  assert.match(html, /only a named clinical panel can make it clinical/);
  assert.match(script, /function renderCounselorLab\(/);
  assert.match(script, /state\.api\.counselorLab\(\)/);
  assert.match(styles, /\.counselor-lab-export \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.counselor-session-link \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.counselor-lab-preflight-zone ol \{ grid-template-columns: 1fr; \}/);
});

test("Counselor Session Notebook is a bounded native-form workflow with no narrative intake", () => {
  assert.match(html, /id="counselor-notebook"[^>]*aria-labelledby="counselor-notebook-title"/);
  assert.match(html, /id="counselor-notebook-form"[^>]*aria-labelledby="notebook-entry-title"/);
  for (const id of ["notebook-session", "notebook-decision", "notebook-disposition", "notebook-finding", "notebook-evidence", "notebook-assessment"]) {
    assert.match(html, new RegExp(`<label for="${id}">`));
    assert.match(html, new RegExp(`id="${id}"[^>]*name=`));
  }
  assert.match(html, /id="counselor-notebook-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="save-counselor-notebook"[^>]*type="submit"/);
  assert.match(html, /href="\/api\/calibration\/counselor-notebook\.json"[^>]*download="perl-counselor-session-notebook\.json"/);
  assert.match(html, /No names, narrative notes, transcript, raw responses, Findings content, or PHI/);
  const form = html.match(/<form id="counselor-notebook-form"[\s\S]*?<\/form>/)?.[0] || "";
  assert.doesNotMatch(form, /<textarea|type="text"/);
  assert.match(script, /function renderCounselorNotebook\(/);
  assert.match(script, /state\.api\.counselorNotebook\(\)/);
  assert.match(script, /recordCounselorNotebookEntry\(payload\)/);
  assert.match(script, /No attendance, clinical acceptance, or protocol freeze was created/);
  assert.match(styles, /#save-counselor-notebook \{[^}]*min-height: 48px;/);
  assert.match(styles, /\.notebook-entry select \{[^}]*min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.notebook-register \{ grid-template-columns: 1fr; \}/);
});

test("Counselor Fieldwork adds source-only reference authoring without identity, attendance, or authority capture", () => {
  assert.match(html, /data-view="fieldwork"/);
  assert.match(html, /id="view-fieldwork"[^>]*aria-labelledby="fieldwork-title"/);
  assert.match(html, /id="fieldwork-title" tabindex="-1">The counselor’s room\.<\/h1>/);
  assert.match(html, /class="fieldwork-primary-actions" aria-label="Counselor rehearsal actions"/);
  for (const destination of ["review", "reference-room", "reference-adjudication", "reference-decision", "comparison-form", "counselor-notebook"]) {
    assert.match(html, new RegExp(`data-fieldwork-destination="${destination}"`));
  }
  assert.match(html, /class="fieldwork-pulse"[^>]*aria-live="polite"/);
  assert.match(html, /id="fieldwork-sessions"[^>]*aria-live="polite"/);
  assert.match(html, /id="fieldwork-readiness-list"/);
  assert.match(html, /id="fieldwork-evidence-list"[^>]*aria-live="polite"/);
  assert.match(html, /id="fieldwork-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="reference-room"[^>]*aria-labelledby="reference-room-title"/);
  assert.match(html, /id="reference-room-title">Write without the model in the room\.<\/h2>/);
  assert.match(html, /id="reference-draft-form"[^>]*class="reference-draft-desk"/);
  assert.match(html, /id="reference-case"/);
  assert.match(html, /id="reference-summary"[^>]*minlength="80"[^>]*maxlength="1500"[^>]*required/);
  assert.match(html, /id="reference-draft-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="save-reference-draft"[^>]*type="submit"/);
  assert.match(html, /href="\/api\/calibration\/reference-room\.json"[^>]*download="perl-source-only-reference-room\.json"/);
  assert.match(html, /Generated content withheld/);
  assert.match(html, /holdout withheld/i);
  assert.match(html, /id="reference-adjudication"[^>]*aria-labelledby="reference-adjudication-title"/);
  assert.match(html, /id="reference-adjudication-title">Disagreement deserves a chair—not a majority vote\.<\/h2>/);
  assert.match(html, /id="adjudication-cases"[^>]*aria-live="polite"/);
  assert.match(html, /id="adjudication-gates"/);
  assert.match(html, /id="seal-reference-adjudication"[^>]*type="button"/);
  assert.match(html, /href="\/api\/calibration\/reference-adjudication\.json"[^>]*download="perl-counselor-reference-adjudication-dossier\.json"/);
  assert.match(html, /Dissent preserved · vote absent/);
  assert.match(html, /Capture the judgment\. Leave the person out\./);
  assert.match(html, /Counselor names, credentials, or roster/);
  assert.match(html, /Attendance, transcript, or narrative notes/);
  assert.match(html, /Patient content, raw responses, or PHI/);
  assert.match(html, /id="reference-decision"[^>]*aria-labelledby="reference-decision-title"/);
  assert.match(html, /id="reference-decision-title">Four duties\. One exact record\. No borrowed signature\.<\/h2>/);
  assert.match(html, /class="reference-decision-register"[^>]*aria-label="Reference decision evidence"[^>]*aria-live="polite"/);
  assert.match(html, /id="reference-decision-challenge-state"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<label class="reference-decision-file" for="reference-decision-attestation-file">/);
  assert.match(html, /id="reference-decision-attestation-file"[^>]*type="file"[^>]*accept="application\/json,\.json"[^>]*aria-describedby="reference-decision-file-state"/);
  assert.match(html, /id="reference-decision-file-state"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="reference-decision-history"[^>]*aria-live="polite"/);
  assert.match(html, /id="issue-reference-decision-challenge"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="verify-reference-decision-attestation"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /href="\/api\/calibration\/reference-decision\.json"[^>]*download="perl-counselor-reference-decision-docket\.json"/);
  assert.match(html, /href="\/api\/calibration\/reference-decision\/registry-template\.json"[^>]*download="PERL-counselor-reference-decision-registry-template\.json"/);
  assert.match(script, /function renderCounselorFieldwork\(/);
  assert.match(script, /async function loadCounselorFieldwork\(/);
  assert.match(script, /state\.api\.counselorLab\(\)/);
  assert.match(script, /state\.api\.counselorNotebook\(\)/);
  assert.match(script, /state\.api\.counselorReferenceRoom\(\)/);
  assert.match(script, /state\.api\.counselorReferenceAdjudication\(\)/);
  assert.match(script, /state\.api\.counselorReferenceDecision\(\)/);
  assert.match(script, /function renderCounselorReferenceAdjudication\(/);
  assert.match(script, /function renderCounselorReferenceDecision\(/);
  assert.match(script, /sealCounselorReferenceAdjudication\(\)/);
  assert.match(script, /issueCounselorReferenceDecisionChallenge\(\)/);
  assert.match(script, /verifyCounselorReferenceDecisionAttestation\(state\.counselorReferenceDecisionAttestation\)/);
  assert.match(script, /recordCounselorReferenceDraft\(payload\)/);
  assert.match(script, /No counselor identity, acceptance, protocol freeze, or clinical authority was created/);
  assert.match(script, /state\.api\.providerActivation\(\)/);
  assert.match(script, /if \(name === "fieldwork"\) void loadCounselorFieldwork\(\)/);
  assert.match(script, /focusTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(fieldworkStyles, /\.fieldwork-action,[\s\S]*min-height: 46px;/);
  assert.match(fieldworkStyles, /\.fieldwork-session-action button \{[^}]*min-height: 44px;/);
  assert.match(fieldworkStyles, /\.reference-editor-head button, \.reference-theme-remove \{[^}]*min-height: 44px;/);
  assert.match(fieldworkStyles, /\.reference-evidence-options label \{[^}]*min-height: 44px;/);
  assert.match(fieldworkStyles, /#save-reference-draft \{[^}]*min-height: 48px;/);
  assert.match(fieldworkStyles, /\.adjudication-actions span, \.adjudication-actions a, \.adjudication-actions button \{[^}]*min-height: 46px;/);
  assert.match(fieldworkStyles, /\.reference-decision-actions button, \.reference-decision-actions a, \.reference-decision-verify \{[^}]*min-height: 48px;/);
  assert.match(fieldworkStyles, /\.reference-decision-file input \{[^}]*min-height: 48px;/);
  assert.match(fieldworkStyles, /\.fieldwork-room button:focus-visible/);
  assert.match(fieldworkStyles, /@media \(max-width: 760px\) \{[\s\S]*\.reference-room-body \{ grid-template-columns: 1fr; \}[\s\S]*\.adjudication-candidates \{ grid-template-columns: 1fr; \}[\s\S]*\.reference-decision-duties \{ grid-template-columns: 1fr; \}[\s\S]*\.fieldwork-evidence-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(fieldworkStyles, /@media \(prefers-reduced-motion: reduce\)/);
  const fieldwork = html.match(/<section id="view-fieldwork"[\s\S]*?<\/section>\s*<section id="view-queue"/)?.[0] || "";
  const referenceForm = html.match(/<form id="reference-draft-form"[\s\S]*?<\/form>/)?.[0] || "";
  const referenceDecision = html.match(/<section id="reference-decision"[\s\S]*?<\/section>\s*<\/div>\s*<footer class="reference-decision-foot"/)?.[0] || "";
  assert.doesNotMatch(referenceForm, /type="file"|type="text"|personal name|credential|attendance|transcript|PHI/i);
  assert.equal((fieldwork.match(/type="file"/g) || []).length, 1);
  assert.doesNotMatch(referenceDecision, /type="text"|<textarea|name|credential|attendance|transcript|PHI/i);
  assert.doesNotMatch(fieldwork, /<button[^>]*>\s*(?:Accept|Freeze|Promote|Approve|Authorize)\b/i);
  assert.doesNotMatch(fieldwork, /record attendance|complete training|approve clinical|authorize pilot/i);
});

test("Progress Review is a named, bounded, native-form longitudinal rehearsal", () => {
  assert.match(html, /id="view-progress"[^>]*aria-labelledby="progress-title"/);
  assert.match(html, /id="progress-ledger-title"/);
  assert.match(html, /id="progress-core-chart"[^>]*aria-live="polite"/);
  assert.match(html, /id="progress-safety-list"[^>]*aria-live="polite"/);
  assert.match(html, /id="progress-observation-form"/);
  for (const id of ["progress-focus", "progress-finding", "progress-disposition"]) {
    assert.match(html, new RegExp(`<label for="${id}">`));
    assert.match(html, new RegExp(`id="${id}"[^>]*name=`));
  }
  const form = html.match(/<form id="progress-observation-form"[\s\S]*?<\/form>/)?.[0] || "";
  assert.doesNotMatch(form, /<textarea|type="text"/);
  assert.match(form, /id="save-progress-observation"[^>]*type="submit"/);
  assert.match(form, /id="progress-observation-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /href="\/api\/progress\.json"[^>]*download="perl-synthetic-progress-review\.json"/);
  assert.match(html, /href="\/api\/progress\/report\.html"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /id="progress-brief-title"/);
  assert.match(html, /id="progress-brief-summary"/);
  assert.match(html, /id="progress-brief-opening"/);
  assert.match(html, /id="progress-brief-priorities"[^>]*aria-live="polite"/);
  assert.match(html, /No subject linkage, improvement, deterioration, reliable change, treatment response, causality, diagnosis, or care-plan decision/);
  assert.match(script, /function renderProgressReview\(/);
  assert.match(script, /state\.api\.progressReview\(\)/);
  assert.match(script, /recordProgressReviewObservation\(payload\)/);
  assert.match(script, /brief\.conversationPriorities\.map/);
  assert.match(script, /brief\.generator\.version/);
  assert.match(script, /without creating a clinical progress claim/);
  assert.match(styles, /\.progress-observation-card select \{[^}]*height: 44px;/);
  assert.match(styles, /\.progress-observation-card \.primary-button \{[^}]*min-height: 48px;/);
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*\.progress-plate \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*\.progress-brief \{ grid-template-columns: 1fr; \}/);
  assert.ok(contrast("#abc1ba", "#102f32") >= 4.5);
  assert.ok(contrast("#e8bd7b", "#102f32") >= 4.5);
  assert.ok(contrast("#f7f2e8", "#784335") >= 4.5);
});

test("Release Foundry exposes a keyboard-native artifact handoff without a deployment control", () => {
  const foundry = html.match(/<section id="release-foundry"[\s\S]*?<section id="operations-watch"/)?.[0] || "";
  assert.match(html, /id="release-foundry"[^>]*aria-labelledby="release-foundry-title"/);
  assert.match(html, /id="release-foundry-title">Ship what you can prove\.<\/h2>/);
  assert.match(html, /aria-label="Release candidate verification sequence"/);
  assert.match(html, /id="release-downloads"/);
  assert.match(html, /id="build-release-candidate"[^>]*type="button"/);
  assert.match(html, /href="\/api\/operations\/release\/trust-policy-template\.json"/);
  assert.doesNotMatch(foundry, /<button[^>]*>\s*(?:Deploy|Sign|Authorize|Activate)\b/i);
  assert.match(script, /function renderReleaseCandidate\(/);
  assert.match(script, /state\.api\.releaseCandidateStatus\(\)/);
  assert.match(script, /state\.api\.buildReleaseCandidate\(\)/);
  assert.match(script, /External signature and deployment authority remain separate/);
  assert.match(styles, /\.release-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.release-foundry a:focus-visible, \.release-foundry button:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.release-flow \{ grid-template-columns: 1fr;/);
});

test("Release Admission Laboratory exposes exact local evidence without presenting production authority", () => {
  const lab = html.match(/<section id="release-admission-lab"[\s\S]*?<section id="release-promotion-airlock"/)?.[0] || "";
  assert.match(html, /id="release-admission-lab"[^>]*aria-labelledby="release-admission-title"/);
  assert.match(html, /id="release-admission-title">Prove it from the inside\.<\/h2>/);
  assert.match(html, /id="admission-checks"[^>]*aria-live="polite"/);
  assert.equal((lab.match(/<article data-state="pending">/g) || []).length, 6);
  assert.match(html, /id="admission-report-link"[^>]*aria-disabled="true"/);
  assert.match(html, /id="run-release-admission"[^>]*type="button"[^>]*disabled/);
  assert.doesNotMatch(lab, /<button[^>]*>\s*(?:Deploy|Sign|Authorize|Activate)\b/i);
  assert.match(script, /function renderReleaseAdmission\(/);
  assert.match(script, /state\.api\.releaseAdmissionStatus\(\)/);
  assert.match(script, /state\.api\.runReleaseAdmission\(artifactId\)/);
  assert.match(script, /CI, vulnerability review, signing, deployment, and clinical authority remain external/);
  assert.match(styles, /\.admission-action \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.release-admission-lab a:focus-visible, \.release-admission-lab button:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.admission-checks \{ grid-template-columns: 1fr;/);
  assert.ok(contrast("#143d3a", "#f4f0e7") >= 4.5);
  assert.ok(contrast("#805c2d", "#f4f0e7") >= 4.5);
  assert.ok(contrast("#789990", "#112f31") >= 4.5);
  assert.ok(contrast("#68716c", "#ffffff") >= 4.5);
  assert.ok(contrast("#6c6557", "#eae3d5") >= 4.5);
  assert.ok(contrast("#8faaa2", "#163638") >= 4.5);
});

test("Production Promotion Airlock exposes ten signed-return gates without a deploy or clinical-authority control", () => {
  const airlock = html.match(/<section id="release-promotion-airlock"[\s\S]*?<section id="operations-watch"/)?.[0] || "";
  assert.match(html, /id="release-promotion-airlock"[^>]*aria-labelledby="release-promotion-title"/);
  assert.match(html, /id="release-promotion-title">Cross the line with receipts\.<\/h2>/);
  assert.match(html, /aria-label="Release promotion evidence boundary"/);
  assert.match(html, /id="promotion-gates"[^>]*aria-live="polite"/);
  assert.equal((airlock.match(/<article data-state="pending">/g) || []).length, 10);
  assert.match(html, /id="promotion-request-link"[^>]*aria-disabled="true"/);
  assert.match(html, /id="promotion-template-link"[^>]*aria-disabled="true"/);
  assert.match(html, /id="promotion-attestation-file"[^>]*type="file"/);
  assert.match(html, /id="verify-promotion-attestation"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /id="prepare-release-promotion"[^>]*type="button"[^>]*disabled/);
  assert.doesNotMatch(airlock, /<button[^>]*>\s*(?:Deploy|Sign|Authorize|Activate)\b/i);
  assert.match(script, /function renderReleasePromotion\(/);
  assert.match(script, /state\.api\.releasePromotionStatus\(\)/);
  assert.match(script, /state\.api\.prepareReleasePromotion\(artifactId\)/);
  assert.match(script, /state\.api\.verifyReleasePromotionAttestation\(state\.releasePromotionAttestation\)/);
  assert.match(styles, /\.promotion-return-control button,\.promotion-foot>button\{min-height:44px/);
  assert.match(styles, /\.release-promotion-airlock a:focus-visible,\.release-promotion-airlock button:focus-visible,\.release-promotion-airlock input:focus-visible/);
  assert.match(styles, /@media\(max-width:680px\)\{[\s\S]*\.promotion-gates\{grid-template-columns:1fr\}/);
  assert.ok(contrast("#ecf0ea", "#101b24") >= 4.5);
  assert.ok(contrast("#b9c6c8", "#101b24") >= 4.5);
  assert.ok(contrast("#1e2b31", "#f8f5ed") >= 4.5);
  assert.ok(contrast("#c3d1d3", "#1d4254") >= 4.5);
});
