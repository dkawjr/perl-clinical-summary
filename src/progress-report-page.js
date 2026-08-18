import { PROGRESS_BRIEF_CONTRACT, PROGRESS_REVIEW_CONTRACT, validateProgressConversationBrief } from "./progress-review.js";

export const PROGRESS_REPORT_CONTRACT = Object.freeze({
  format: "perl-synthetic-progress-addendum/1.0",
  state: "rehearsal-draft",
  page: "Letter",
  subjectLinkageAuthoritative: false,
  clinicalProgressEstablished: false,
  clinicalRecommendationCreated: false,
  patientUseAuthorized: false
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}

function directionLabel(value) {
  return value < 0 ? "Raw score lower" : value > 0 ? "Raw score higher" : "No raw movement";
}

export function validateProgressReport(progressReview) {
  const errors = [];
  if (!progressReview || typeof progressReview !== "object" || Array.isArray(progressReview)) return ["Progress Review status is required."];
  if (progressReview.contractVersion !== PROGRESS_REVIEW_CONTRACT) errors.push("Progress Review contract is invalid.");
  if (progressReview.brief?.contractVersion !== PROGRESS_BRIEF_CONTRACT) errors.push("Progress conversation brief is missing.");
  errors.push(...validateProgressConversationBrief(progressReview.brief || {}).map(error => `Brief: ${error}`));
  if (!Array.isArray(progressReview.scales) || progressReview.scales.length !== 4) errors.push("The progress addendum requires four core scales.");
  if (!Array.isArray(progressReview.series?.points) || progressReview.series.points.length !== 2) errors.push("The progress addendum requires two frozen points.");
  if (progressReview.series?.id !== "FF-TEST-SERIES-01" || progressReview.series?.points?.[0]?.assessmentId !== "FF-TEST-2388-B" || progressReview.series?.points?.[1]?.assessmentId !== "FF-TEST-2411-C") errors.push("The progress addendum source series is not the frozen synthetic pair.");
  if (progressReview.authoritativeSubjectLinkage !== false || progressReview.clinicalProgressEstablished !== false || progressReview.improvementEstablished !== false || progressReview.treatmentResponseEstablished !== false || progressReview.patientUseAuthorized !== false) errors.push("Progress addendum authority boundaries are invalid.");
  return [...new Set(errors)];
}

export function renderProgressReportPage(progressReview) {
  const errors = validateProgressReport(progressReview);
  if (errors.length) throw new Error(errors.join(" "));
  const brief = progressReview.brief;
  const points = progressReview.series.points;
  const coreRows = progressReview.scales.map(scale => `<article class="movement-row" aria-label="${escapeHtml(scale.label)}: ${scale.earlier} at Point 01, ${scale.later} at Point 02, delta ${signed(scale.delta)}">
    <div><span>${escapeHtml(scale.label)}</span><small>Range 0–${escapeHtml(scale.maximum)}</small></div>
    <strong>${escapeHtml(scale.earlier)}</strong>
    <i aria-hidden="true">→</i>
    <strong>${escapeHtml(scale.later)}</strong>
    <div class="movement-delta"><b>${signed(scale.delta)}</b><small>${directionLabel(scale.delta)}</small></div>
  </article>`).join("");
  const priorities = brief.conversationPriorities.map((priority, index) => `<article class="priority">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <div><h3>${escapeHtml(priority.label)}</h3><p>${escapeHtml(priority.prompt)}</p><small>${priority.evidence.map(escapeHtml).join(" · ")}</small></div>
  </article>`).join("");
  const safety = points.map(point => `<div><span>${escapeHtml(point.marker)}</span><strong>${point.criticalRoute.requiresDirectReview ? "Direct review required" : "No automated hold"}</strong><small>${point.criticalRoute.requiresDirectReview ? `${point.criticalRoute.nonZeroCriticalResponses} non-zero critical response${point.criticalRoute.nonZeroCriticalResponses === 1 ? "" : "s"}` : "No non-zero critical screen in this synthetic fixture"}</small></div>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>PERL · Synthetic progress conversation brief</title>
  <link rel="stylesheet" href="/progress-report.css">
  <script type="module" src="/report.js"></script>
</head>
<body>
  <nav class="progress-report-toolbar" aria-label="Report actions">
    <a href="/">Back to workspace</a>
    <div><span>Constructed synthetic pair · rehearsal draft</span><button id="report-print" type="button">Print or save PDF</button></div>
  </nav>
  <main class="progress-report-sheet" aria-labelledby="progress-report-title">
    <header class="progress-report-header">
      <div class="progress-report-brand"><span>P</span><div><strong>PERL</strong><small>Clinical intelligence by Focused Future</small></div></div>
      <div class="progress-report-state"><span>Progress conversation brief</span><small>${escapeHtml(PROGRESS_REPORT_CONTRACT.format)}</small></div>
    </header>

    <section class="progress-report-title-block">
      <div>
        <span class="section-label">Longitudinal rehearsal · constructed synthetic pair</span>
        <h1 id="progress-report-title">Let the person’s account explain the line.</h1>
        <p>${escapeHtml(brief.summary)}</p>
      </div>
      <dl>
        <div><dt>Series</dt><dd>${escapeHtml(progressReview.series.id)}</dd></div>
        <div><dt>Point 01</dt><dd>${escapeHtml(points[0].assessmentId)}</dd></div>
        <div><dt>Point 02</dt><dd>${escapeHtml(points[1].assessmentId)}</dd></div>
        <div><dt>Generator</dt><dd>${escapeHtml(brief.generator.version)}</dd></div>
      </dl>
    </section>

    <section class="opening-line" aria-labelledby="opening-title">
      <span>Affirming opening</span>
      <blockquote id="opening-title">“${escapeHtml(brief.affirmingOpening)}”</blockquote>
    </section>

    <section class="movement-section" aria-labelledby="movement-title">
      <div class="section-head"><div><span>01</span><h2 id="movement-title">Raw movement</h2></div><p>Printed values are descriptive. Lower does not mean better.</p></div>
      <div class="point-head" aria-hidden="true"><span>Scale</span><span>Point 01</span><span></span><span>Point 02</span><span>Delta</span></div>
      <div class="movement-list">${coreRows}</div>
    </section>

    <section class="priority-section" aria-labelledby="priority-title">
      <div class="section-head"><div><span>02</span><h2 id="priority-title">Questions for the next conversation</h2></div><p>Provider guidance, not a treatment recommendation.</p></div>
      <div class="priority-grid">${priorities}</div>
    </section>

    <section class="safety-section" aria-labelledby="safety-title">
      <div><span class="section-label">Direct source review</span><h2 id="safety-title">Safety stays outside the trend line.</h2></div>
      <div class="safety-grid">${safety}</div>
    </section>

    <footer class="progress-report-footer">
      <div><span>What this can show</span><p>Exact raw direction, magnitude, scale level, shared signal detail, and deterministic critical-screen routing for two synthetic fixtures.</p></div>
      <div><span>What this cannot conclude</span><p>No subject linkage, improvement, deterioration, reliable or meaningful change, treatment response, diagnosis, causality, or care-plan decision.</p></div>
      <div class="report-provenance"><span>Evidence</span><code>SERIES ${escapeHtml(progressReview.seriesFingerprint.slice(0, 12))}…</code><code>BRIEF ${escapeHtml(brief.fingerprint.slice(0, 12))}…</code></div>
    </footer>
    <div class="environment-boundary">Synthetic calibration sandbox · no PHI · not a progress note · not for live clinical use</div>
  </main>
</body>
</html>`;
}
