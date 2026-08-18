import { createHash } from "node:crypto";

export const REPORT_ASSEMBLY_CONTRACT = "perl-report-assembly-proof/1.0";

export const REPORT_ASSEMBLY_BOUNDARY = "This five-page view is a local synthetic assembly proof. Pages 1–4 are sealed placeholders for the source-owned Findings PDF; their content is not reproduced. Page 5 is derived from the approved synthetic PERL artifact. No PDF merge, e-QPASS write, remote attachment, production validation, pilot authorization, clinical release, or patient use is claimed.";

export const SOURCE_PAGE_BLUEPRINT = Object.freeze([
  Object.freeze({ page: 1, label: "Questionnaire responses", code: "SOURCE / RESPONSES" }),
  Object.freeze({ page: 2, label: "Emotional Temperature", code: "SOURCE / TEMPERATURE" }),
  Object.freeze({ page: 3, label: "Scale + crisis analysis", code: "SOURCE / ANALYSIS" }),
  Object.freeze({ page: 4, label: "Subscale analysis", code: "SOURCE / SUBSCALES" })
]);

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value) {
  return String(value || "").replaceAll("-", " ");
}

function displayDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
}

export function validateReportAssemblyInput(detail, report) {
  const errors = [];
  const preparation = detail?.attachment?.preparation;
  const artifact = report?.artifact;
  if (!detail?.assessment?.id?.startsWith("FF-TEST-")) errors.push("Assembly proof requires a visibly synthetic assessment.");
  if (detail?.review?.status !== "approved" || report?.mode !== "approved" || artifact?.review?.status !== "approved") errors.push("Assembly proof requires an approved synthetic clinician artifact.");
  if (!detail?.sourceEvent || !/^[a-f0-9]{64}$/.test(String(detail.sourceEvent.receiptHash || ""))) errors.push("Assembly proof requires a source-event receipt.");
  if (detail?.attachment?.status !== "prepared-not-attached" || !preparation) errors.push("Assembly proof requires a prepared, explicitly unattached handoff.");
  if (!/^[a-f0-9]{64}$/.test(String(preparation?.findingsReportHash || ""))) errors.push("Assembly proof requires the source Findings package digest.");
  if (!/^[a-f0-9]{64}$/.test(String(preparation?.renderedContentHash || ""))) errors.push("Assembly proof requires the exact rendered PERL content digest.");
  if (!/^[a-f0-9]{64}$/.test(String(detail?.reportArtifact?.hash || "")) || detail?.reportArtifact?.hash !== artifact?.hash || preparation?.reportArtifactHash !== artifact?.hash) errors.push("Assembly proof requires one matching approved artifact lineage.");
  if (preparation?.status !== "prepared-not-attached" || preparation?.contractStatus !== "proposed-rfi-only") errors.push("Assembly proof cannot claim an authoritative or attached source contract.");
  if (artifact?.assessment?.id !== detail?.assessment?.id) errors.push("Assembly proof assessment lineage does not match.");
  return [...new Set(errors)];
}

export function buildReportAssemblyProof(detail, report) {
  const errors = validateReportAssemblyInput(detail, report);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 409 });
  const preparation = detail.attachment.preparation;
  const artifact = report.artifact;
  const core = {
    contractVersion: REPORT_ASSEMBLY_CONTRACT,
    status: "assembly-proof-only",
    assessmentId: detail.assessment.id,
    pageCount: 5,
    sourcePageCount: 4,
    perlPageCount: 1,
    pageOrder: [
      ...SOURCE_PAGE_BLUEPRINT.map(item => ({ ...item, owner: "e-QPASS", contentIncluded: false, modifiedByPerl: false })),
      { page: 5, label: "PERL clinician summary", code: "PERL / CLINICIAN SUMMARY", owner: "Focused Future", contentIncluded: true, modifiedByPerl: false }
    ],
    source: {
      contractVersion: detail.sourceEvent.contractVersion,
      contractStatus: detail.sourceEvent.contractStatus,
      scoringVersion: detail.sourceEvent.scoringVersion,
      findingsReportVersion: detail.sourceEvent.findingsReportVersion,
      sourceEventReceiptHash: detail.sourceEvent.receiptHash,
      findingsReportHash: preparation.findingsReportHash,
      contentIncluded: false,
      pagesModified: false
    },
    perl: {
      reportArtifactId: detail.reportArtifact.id,
      reportArtifactHash: detail.reportArtifact.hash,
      reportFormat: detail.reportArtifact.reportFormat,
      disclaimerVersion: detail.reportArtifact.disclaimerVersion,
      renderedContentHash: preparation.renderedContentHash,
      approvalActor: artifact.review.reviewer,
      approvedAt: artifact.review.approvedAt,
      page: 5
    },
    preparation: {
      receiptHash: preparation.hash,
      status: preparation.status,
      mediaType: preparation.renderedMediaType
    },
    sourcePackageContentIncluded: false,
    pdfMergePerformed: false,
    eqpassWritePerformed: false,
    remoteAttachmentPerformed: false,
    productionValidationComplete: false,
    pilotAuthorizationRecorded: false,
    clinicalReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: REPORT_ASSEMBLY_BOUNDARY
  };
  return Object.freeze({ ...core, fingerprint: hash(core) });
}

function sourcePlaceholder(item, proof) {
  const shape = item.page === 1
    ? '<div class="source-shape rows" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
    : item.page === 2
      ? '<div class="source-shape temperature" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'
      : item.page === 3
        ? '<div class="source-shape scales" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
        : '<div class="source-shape subscales" aria-hidden="true">' + Array.from({ length: 14 }, () => "<i></i>").join("") + "</div>";
  return `<section class="packet-page source-page" aria-labelledby="source-page-${item.page}-title">
      <header class="packet-head"><div class="source-brand"><span>e-QPASS</span><small>Source-owned Findings package</small></div><div><span>${escapeHtml(item.code)}</span><strong>Page ${item.page} / 05</strong></div></header>
      <div class="source-body">
        <div class="page-index" aria-hidden="true">0${item.page}</div>
        <p class="packet-eyebrow">Position ${item.page} · unchanged source leaf</p>
        <h1 id="source-page-${item.page}-title">${escapeHtml(item.label)}</h1>
        <p class="source-deck">This local proof reserves the exact page position without reproducing the private Findings content. In production, e-QPASS must supply this page from the immutable source PDF.</p>
        ${shape}
        <aside><span>Content seal</span><strong>Withheld by design.</strong><p>PERL does not regenerate, summarize, or modify this source page inside the assembly proof.</p></aside>
      </div>
      <footer class="packet-foot"><span>Source package ${escapeHtml(proof.source.findingsReportVersion)}</span><code>${escapeHtml(proof.source.findingsReportHash.slice(0, 20))}…</code><strong>Placeholder · not a clinical report</strong></footer>
    </section>`;
}

function scoreCard(labelText, key, artifact) {
  const score = artifact.assessment.scales[key];
  const levelText = artifact.assessment.scaleLevels?.[key] || "source level unavailable";
  return `<article><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(score)}</strong><small>${escapeHtml(label(levelText))}</small></article>`;
}

function perlPage(proof, artifact) {
  const criticalCount = artifact.assessment.criticalResponses?.length || 0;
  const safety = criticalCount
    ? artifact.review.safetyAcknowledged ? "Direct source review acknowledged" : "Direct source review required"
    : "No non-zero critical-screen response in this record";
  const hypotheses = artifact.interpretation.hypotheses.slice(0, 3).map((item, index) => `<article class="proof-hypothesis"><span>0${index + 1}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><small>${escapeHtml(item.evidence.join(" · "))}</small></div></article>`).join("");
  const questions = artifact.interpretation.questions.slice(0, 4).map((item, index) => `<li><span>0${index + 1}</span><p>${escapeHtml(item)}</p></li>`).join("");
  return `<section class="packet-page perl-page" aria-labelledby="perl-page-title">
      <header class="packet-head"><div class="perl-brand"><b>P</b><div><span>PERL</span><small>Clinical intelligence by Focused Future</small></div></div><div><span>PERL / CLINICIAN SUMMARY</span><strong>Page 05 / 05</strong></div></header>
      <div class="perl-title"><div><span>Approved synthetic clinician attachment</span><h1 id="perl-page-title">What this profile may indicate.</h1><p>${escapeHtml(artifact.narrative.text)}</p></div><dl><div><dt>Record</dt><dd>${escapeHtml(artifact.assessment.id)}</dd></div><div><dt>Completed</dt><dd>${escapeHtml(artifact.assessment.completedAt)}</dd></div><div><dt>Coverage</dt><dd>${escapeHtml(artifact.assessment.itemsAnswered)} / 105</dd></div><div><dt>State</dt><dd>Approved synthetic</dd></div></dl></div>
      <section class="perl-signals" aria-labelledby="perl-signal-title"><header><span>01</span><h2 id="perl-signal-title">Source signal profile</h2><p>e-QPASS supplies the score and level.</p></header><div>${scoreCard("Depression", "depression", artifact)}${scoreCard("Anxiety", "anxiety", artifact)}${scoreCard("Anger", "anger", artifact)}${scoreCard("Global index", "gpi", artifact)}</div><aside><span>Safety routing</span><strong>${escapeHtml(safety)}</strong><small>${criticalCount} highlighted source response${criticalCount === 1 ? "" : "s"}</small></aside></section>
      <section class="perl-interpretation" aria-labelledby="perl-interpretation-title"><header><span>02</span><h2 id="perl-interpretation-title">Evidence-linked hypotheses</h2><p>Indicators for interview—not diagnoses.</p></header><div>${hypotheses}</div></section>
      <section class="perl-questions" aria-labelledby="perl-question-title"><header><span>03</span><h2 id="perl-question-title">Questions for the next conversation</h2></header><ol>${questions}</ol></section>
      <footer class="perl-foot"><div><span>Clinical boundary</span><p>${escapeHtml(artifact.disclaimer)}</p><small>${escapeHtml(artifact.disclaimerVersion)} · legal review pending</small></div><div><span>Approved by</span><strong>${escapeHtml(artifact.review.reviewer)}</strong><small>${escapeHtml(displayDate(artifact.review.approvedAt))}</small></div><div><span>Artifact lineage</span><code>${escapeHtml(proof.perl.reportArtifactHash.slice(0, 16))}…</code><small>Rendered ${escapeHtml(proof.perl.renderedContentHash.slice(0, 16))}…</small></div></footer>
      <div class="proof-boundary">Synthetic assembly proof · page five derived from the approved artifact · no PDF merge or e-QPASS attachment</div>
    </section>`;
}

export function renderReportAssemblyPage(proof, artifact) {
  if (proof?.contractVersion !== REPORT_ASSEMBLY_CONTRACT || proof?.pageCount !== 5 || proof?.pdfMergePerformed !== false || proof?.remoteAttachmentPerformed !== false || proof?.patientUseAuthorized !== false) throw new Error("Report assembly renderer requires a non-authorizing five-page proof.");
  const sourcePages = SOURCE_PAGE_BLUEPRINT.map(item => sourcePlaceholder(item, proof)).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="Synthetic five-page e-QPASS and PERL report assembly proof. No source content, production merge, or attachment is claimed.">
  <title>${escapeHtml(proof.assessmentId)} · PERL page-five assembly proof</title>
  <link rel="stylesheet" href="/report-assembly.css">
  <script src="/report-assembly-print.js" defer></script>
</head>
<body>
  <nav class="assembly-toolbar" aria-label="Assembly proof actions"><a href="/">Return to PERL</a><span>Assembly proof · no PHI</span><div><a href="/api/assessments/${encodeURIComponent(proof.assessmentId)}/report-package.json">Export manifest</a><button id="print-assembly-proof" type="button">Print QA proof</button></div></nav>
  <header class="assembly-intro">
    <div><p>e-QPASS → PERL · report architecture</p><h1>Four source pages.<br><em>One accountable addition.</em></h1></div>
    <div class="assembly-status"><span>Current state</span><strong>Prepared—not attached</strong><p>${escapeHtml(REPORT_ASSEMBLY_BOUNDARY)}</p><dl><div><dt>Order</dt><dd>04 + 01</dd></div><div><dt>Merge</dt><dd>Not performed</dd></div><div><dt>Authority</dt><dd>Outside PERL</dd></div></dl><code>${escapeHtml(proof.fingerprint)}</code></div>
  </header>
  <main class="packet" aria-label="Five-page synthetic report assembly proof">
    ${sourcePages}
    ${perlPage(proof, artifact)}
  </main>
</body>
</html>`;
}
