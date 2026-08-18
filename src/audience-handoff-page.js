import { riskDisposition } from "./engine.js";

export const AUDIENCE_HANDOFF_CONTRACT = Object.freeze({
  format: "perl-audience-handoff/1.0",
  audiences: Object.freeze(["care", "payer", "admin"]),
  approvalScope: "preview-only",
  claimBoundary: "Audience handoffs are synthetic previews. Only the clinician report artifact can be approved in this sandbox."
});

export const AUDIENCE_HANDOFF_PRESENTATION = Object.freeze({
  care: Object.freeze({
    label: "Care coordination handoff",
    title: "Prepare the next team conversation.",
    purpose: "Give a care coordinator a concise, clinically bounded orientation to the scored pattern and the next verification step.",
    boundary: "Use after clinician review for coordination. This preview does not diagnose, prescribe, replace direct safety assessment, or authorize a care plan."
  }),
  payer: Object.freeze({
    label: "Utilization context",
    title: "Support review without deciding coverage.",
    purpose: "Provide restrained assessment context for a payer or utilization reviewer while leaving medical necessity and level-of-care decisions to the authorized process.",
    boundary: "This preview does not establish diagnosis, medical necessity, authorization, eligibility, or level of care. Source documentation and clinician judgment remain authoritative."
  }),
  admin: Object.freeze({
    label: "Administrative routing note",
    title: "Move the record without exposing the interpretation.",
    purpose: "Show completion, review, and routing state to an operations user without reproducing scored domains, clinical hypotheses, or counselor-reference prose.",
    boundary: "Administrative use only. This preview contains no clinical interpretation and does not authorize care, coverage, release, or attachment to e-QPASS."
  })
});

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(date);
}

export function validateHandoffAudience(audience) {
  if (!AUDIENCE_HANDOFF_CONTRACT.audiences.includes(audience)) {
    fail("Audience handoff must be care, payer, or admin.");
  }
  return audience;
}

export function renderAudienceHandoffPage({ audience, assessment, narrative, review, sourceAssessmentHash, createdAt }) {
  validateHandoffAudience(audience);
  const presentation = AUDIENCE_HANDOFF_PRESENTATION[audience];
  const disposition = riskDisposition(assessment);
  const reviewState = review?.status === "approved" ? "Clinician artifact approved" : "Clinician review pending";
  const safetyState = disposition.requiresReview ? "Direct clinical review required" : "Routine clinical verification";
  const title = `${assessment.id} · PERL ${presentation.label}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/report.css">
  <script type="module" src="/report.js"></script>
</head>
<body data-report-state="draft" data-report-kind="audience-handoff" data-audience="${escapeHtml(audience)}">
  <nav class="report-toolbar" aria-label="Handoff actions">
    <a href="/" aria-label="Return to PERL workspace">Back to workspace</a>
    <div><span>Synthetic ${escapeHtml(presentation.label)}</span><button id="report-print" type="button">Print or save PDF</button></div>
  </nav>
  <main class="report-sheet handoff-sheet" aria-labelledby="report-title">
    <div class="draft-watermark" aria-hidden="true">Preview</div>
    <header class="report-header">
      <div class="report-brand"><span class="brand-mark">P</span><div><strong>PERL</strong><small>Clinical intelligence by Focused Future</small></div></div>
      <div class="report-state"><span>Synthetic audience preview</span><small>Not an approved clinician artifact</small></div>
    </header>

    <section class="report-title-block handoff-title-block">
      <div><span class="section-label">${escapeHtml(presentation.label)}</span><h1 id="report-title">${escapeHtml(presentation.title)}</h1><p>${escapeHtml(narrative.text)}</p></div>
      <dl class="report-meta">
        <div><dt>Record</dt><dd>${escapeHtml(assessment.id)}</dd></div>
        <div><dt>Completed</dt><dd>${escapeHtml(assessment.completedAt)}</dd></div>
        <div><dt>Coverage</dt><dd>${escapeHtml(assessment.itemsAnswered)} of 105</dd></div>
        <div><dt>Audience</dt><dd>${escapeHtml(presentation.label)}</dd></div>
      </dl>
    </section>

    <section class="handoff-purpose" aria-labelledby="handoff-purpose-title">
      <span class="section-number">01</span>
      <div><span class="section-label">Purpose</span><h2 id="handoff-purpose-title">A narrower view of the same source record.</h2><p>${escapeHtml(presentation.purpose)}</p></div>
    </section>

    <section class="handoff-routing" aria-label="Workflow routing state">
      <article><span>Assessment</span><strong>${assessment.itemsAnswered === 105 ? "Scoring complete" : "Completion pending"}</strong><small>e-QPASS scoring remains authoritative</small></article>
      <article><span>Clinical release</span><strong>${escapeHtml(reviewState)}</strong><small>Audience preview is never the approval artifact</small></article>
      <article><span>Safety route</span><strong>${escapeHtml(safetyState)}</strong><small>Deterministic routing, not generated judgment</small></article>
    </section>

    <section class="handoff-boundary" aria-labelledby="handoff-boundary-title">
      <span>Use boundary</span><h2 id="handoff-boundary-title">Right audience. Minimum necessary context.</h2><p>${escapeHtml(presentation.boundary)}</p>
    </section>

    <footer class="report-footer handoff-footer">
      <div class="clinical-boundary"><span>Approval boundary</span><p>${escapeHtml(AUDIENCE_HANDOFF_CONTRACT.claimBoundary)}</p><small>${escapeHtml(AUDIENCE_HANDOFF_CONTRACT.approvalScope)}</small></div>
      <div class="approval-block"><span>Clinician workflow</span><strong>${escapeHtml(reviewState)}</strong><small>${review?.approvedAt ? formatDate(review.approvedAt) : "No clinician approval is represented by this handoff."}</small></div>
      <div class="provenance-block"><span>${escapeHtml(AUDIENCE_HANDOFF_CONTRACT.format)}</span><strong>${escapeHtml(narrative.provider)} · ${escapeHtml(narrative.version)}</strong><small>Source ${escapeHtml(String(sourceAssessmentHash).slice(0, 12))} · Preview ${formatDate(createdAt)}</small></div>
    </footer>
    <div class="environment-boundary">Synthetic calibration sandbox · no PHI · audience preview only · not for live clinical use</div>
  </main>
</body>
</html>`;
}
