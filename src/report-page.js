import { resolveScaleLevel, riskDisposition } from "./engine.js";
import { buildClinicalBrief } from "./clinical-brief.js";

export const REPORT_CONTRACT = Object.freeze({
  format: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  disclaimer: "This structured decision-support summary is derived from self-report scores. It does not diagnose, prescribe, determine level of care, or replace interview data, history, functional assessment, direct safety assessment, or licensed clinical judgment.",
  artifactRelationship: "Additional page for the unchanged e-QPASS Findings report",
  signalAuthority: "Scored e-QPASS output stays authoritative.",
  interpretationBoundary: "Interview hypotheses, not diagnostic conclusions.",
  safetyReviewBoundary: "Critical-screen responses route to direct clinician review; generated prose cannot resolve safety.",
  pageFit: Object.freeze({
    maximumNarrativeCharacters: 1500,
    maximumHypotheses: 3,
    maximumQuestions: 5,
    maximumInterpretationCharacters: 4200
  })
});

export function validateReportContent(narrative, interpretation) {
  const limits = REPORT_CONTRACT.pageFit;
  const errors = [];
  const narrativeLength = String(narrative?.text || "").trim().length;
  const hypotheses = Array.isArray(interpretation?.hypotheses) ? interpretation.hypotheses : [];
  const questions = Array.isArray(interpretation?.questions) ? interpretation.questions : [];
  const interpretationLength = hypotheses.reduce((sum, item) => sum + String(item?.title || "").length + String(item?.body || "").length + (item?.evidence || []).join("").length, 0)
    + questions.reduce((sum, item) => sum + String(item || "").length, 0);
  if (narrativeLength > limits.maximumNarrativeCharacters) errors.push(`Clinician narrative exceeds the ${limits.maximumNarrativeCharacters}-character report limit.`);
  if (hypotheses.length > limits.maximumHypotheses) errors.push(`Clinician report supports up to ${limits.maximumHypotheses} evidence-linked hypotheses.`);
  if (questions.length > limits.maximumQuestions) errors.push(`Clinician report supports up to ${limits.maximumQuestions} follow-up questions.`);
  if (interpretationLength > limits.maximumInterpretationCharacters) errors.push(`Clinical interpretation exceeds the ${limits.maximumInterpretationCharacters}-character report limit.`);
  return errors;
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(date);
}

function scoreCard(label, key, score, assessment) {
  return `<article class="score-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(score)}</strong><small>${escapeHtml(resolveScaleLevel(assessment, key))}</small></article>`;
}

function evidenceList(items = []) {
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
}

export function renderReportPage({ mode, artifact }) {
  const approved = mode === "approved" && artifact.review?.status === "approved";
  const assessment = artifact.assessment;
  const narrative = artifact.narrative;
  const interpretation = artifact.interpretation;
  const clinicalBrief = artifact.clinicalBrief || buildClinicalBrief({ assessment, interpretation, narrative: narrative.text });
  const disposition = riskDisposition(assessment);
  const title = `${assessment.id} · PERL clinician summary`;
  const safetyLabel = disposition.requiresReview
    ? artifact.review?.safetyAcknowledged
      ? "Direct critical-screen review acknowledged"
      : "Direct critical-screen review still required"
    : "No non-zero critical-screen response in this record";
  const provenanceHash = artifact.hash || artifact.sourceAssessmentHash;
  const generationProvenance = artifact.provider.promptVersion && artifact.provider.policyHash
    ? `<small>Prompt ${escapeHtml(artifact.provider.promptVersion)} · Policy ${escapeHtml(artifact.provider.policyHash.slice(0, 12))}</small>`
    : "";
  const sourceProvenance = artifact.sourceProvenance
    ? `<small>Scoring ${escapeHtml(artifact.sourceProvenance.scoringVersion)} · Findings ${escapeHtml(artifact.sourceProvenance.findingsReportVersion)} · receipt ${escapeHtml(artifact.sourceProvenance.sourceEventReceiptHash.slice(0, 12))}</small>`
    : "";

  const hypotheses = clinicalBrief.clinicalThemes.map((item, index) => `
    <article class="hypothesis">
      <div class="hypothesis-index">0${index + 1}</div>
      <div>
        <div class="hypothesis-head"><small>${escapeHtml(item.domain)}</small><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(item.confidence)} confidence</span></div>
        <p>${escapeHtml(item.hypothesis)}</p>
        <p class="theme-limit"><strong>Uncertainty</strong> ${escapeHtml(item.uncertainty)}</p>
        <ul class="evidence-list" aria-label="Scored evidence">${evidenceList(item.evidence)}</ul>
      </div>
    </article>`).join("");

  const questions = interpretation.questions.map((question, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(question)}</p></li>`).join("");
  const mixedSignals = clinicalBrief.mixedSignals.items.length
    ? clinicalBrief.mixedSignals.items.slice(0, 2).map(item => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statement)}</span><small>${escapeHtml(item.evidence.join(" · "))}</small></li>`).join("")
    : `<li><strong>No automated mismatch</strong><span>${escapeHtml(clinicalBrief.mixedSignals.statement)}</span></li>`;
  const qualityChecks = clinicalBrief.qualityChecks.map(item => `<li data-status="${escapeHtml(item.status)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></li>`).join("");
  const limitations = clinicalBrief.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join("");

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
<body data-report-state="${approved ? "approved" : "draft"}">
  <nav class="report-toolbar" aria-label="Report actions">
    <a href="/" aria-label="Return to PERL workspace">Back to workspace</a>
    <div><span>${approved ? "Approved synthetic attachment" : "Review draft"}</span><button id="report-print" type="button">Print or save PDF</button></div>
  </nav>
  <main class="report-sheet" aria-labelledby="report-title">
    ${approved ? "" : '<div class="draft-watermark" aria-hidden="true">Review draft</div>'}
    <header class="report-header">
      <div class="report-brand"><span class="brand-mark">P</span><div><strong>PERL</strong><small>Clinical intelligence by Focused Future</small></div></div>
      <div class="report-state"><span>${approved ? "Approved synthetic clinician attachment" : "Clinical review required"}</span><small>${escapeHtml(REPORT_CONTRACT.artifactRelationship)}</small></div>
    </header>

    <section class="report-title-block">
      <div><span class="section-label">Clinician summary</span><h1 id="report-title">What this profile may indicate.</h1><p>${escapeHtml(narrative.text)}</p></div>
      <dl class="report-meta">
        <div><dt>Record</dt><dd>${escapeHtml(assessment.id)}</dd></div>
        <div><dt>Completed</dt><dd>${escapeHtml(assessment.completedAt)}</dd></div>
        <div><dt>Coverage</dt><dd>${escapeHtml(assessment.itemsAnswered)} of 105</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(assessment.source)}</dd></div>
      </dl>
    </section>

    <section class="signal-section" aria-labelledby="signal-title">
      <div class="section-head"><div><span class="section-number">01</span><h2 id="signal-title">Core dimensions</h2></div><p>${escapeHtml(REPORT_CONTRACT.signalAuthority)}</p></div>
      <div class="score-grid">
        ${scoreCard("Depression", "depression", assessment.scales.depression, assessment)}
        ${scoreCard("Anxiety", "anxiety", assessment.scales.anxiety, assessment)}
        ${scoreCard("Anger", "anger", assessment.scales.anger, assessment)}
        ${scoreCard("Global index", "gpi", assessment.scales.gpi, assessment)}
      </div>
      <div class="safety-line ${disposition.requiresReview ? "requires-review" : "clear"}"><span>Safety routing</span><strong>${escapeHtml(safetyLabel)}</strong><small>${assessment.criticalResponses.length} highlighted source response${assessment.criticalResponses.length === 1 ? "" : "s"}</small></div>
    </section>

    <section class="pattern-section" aria-labelledby="pattern-title">
      <div class="section-head"><div><span class="section-number">02</span><h2 id="pattern-title">Pattern checks</h2></div><p>Comparison prompts, not conclusions.</p></div>
      <div class="pattern-grid">
        <article class="pattern-card"><header><span>Mixed signals</span><strong>${escapeHtml(clinicalBrief.mixedSignals.headline)}</strong></header><ul>${mixedSignals}</ul></article>
        <article class="pattern-card red-flag-card" data-status="${escapeHtml(clinicalBrief.redFlags.status)}"><header><span>Red flags</span><strong>${escapeHtml(clinicalBrief.redFlags.headline)}</strong></header><p>${escapeHtml(clinicalBrief.redFlags.statement)}</p><small>${escapeHtml(clinicalBrief.redFlags.sourceDisclosure)}</small></article>
      </div>
    </section>

    <section class="interpretation-section" aria-labelledby="interpretation-title">
      <div class="section-head"><div><span class="section-number">03</span><h2 id="interpretation-title">Clinical themes</h2></div><p>${escapeHtml(REPORT_CONTRACT.interpretationBoundary)}</p></div>
      <div class="hypothesis-list">${hypotheses}</div>
    </section>

    <section class="question-section" aria-labelledby="question-title">
      <div class="section-head"><div><span class="section-number">04</span><h2 id="question-title">Questions for the next conversation</h2></div><p>Use context and clinical judgment to test the pattern.</p></div>
      <ol class="question-list">${questions}</ol>
    </section>

    <section class="assurance-section" aria-label="Quality checks and limitations">
      <article><header><span>Quality checks</span><small>Automated draft controls</small></header><ul class="quality-list">${qualityChecks}</ul></article>
      <article><header><span>Confidence + limitations</span><small>No omitted uncertainty</small></header><ol class="limitation-list">${limitations}</ol></article>
    </section>

    <footer class="report-footer">
      <div class="clinical-boundary"><span>Clinical boundary</span><p>${escapeHtml(REPORT_CONTRACT.disclaimer)}</p><small>Legal review pending · ${escapeHtml(REPORT_CONTRACT.disclaimerVersion)}</small></div>
      <div class="approval-block">
        <span>${approved ? "Approved by" : "Current state"}</span>
        <strong>${approved ? escapeHtml(artifact.review.reviewer) : "Not approved"}</strong>
        <small>${approved ? formatDate(artifact.review.approvedAt) : "A qualified reviewer must approve this content before attachment."}</small>
      </div>
      <div class="provenance-block">
        <span>${escapeHtml(artifact.reportFormat)} · ${escapeHtml(clinicalBrief.format)}</span>
        <strong>${escapeHtml(artifact.provider.id)} · ${escapeHtml(artifact.provider.version)}</strong>
        <small>Source ${escapeHtml(artifact.sourceAssessmentHash.slice(0, 12))} · Artifact ${escapeHtml(provenanceHash.slice(0, 12))}</small>
        ${generationProvenance}
        ${sourceProvenance}
      </div>
    </footer>
    <div class="environment-boundary">Synthetic calibration sandbox · no PHI · not for live clinical use</div>
  </main>
</body>
</html>`;
}
