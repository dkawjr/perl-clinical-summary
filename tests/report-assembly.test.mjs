import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  REPORT_ASSEMBLY_BOUNDARY,
  REPORT_ASSEMBLY_CONTRACT,
  SOURCE_PAGE_BLUEPRINT,
  buildReportAssemblyProof,
  renderReportAssemblyPage,
  validateReportAssemblyInput
} from "../src/report-assembly.js";

function fixture() {
  const artifactHash = "b".repeat(64);
  const detail = {
    assessment: { id: "FF-TEST-ASSEMBLY-001" },
    review: { status: "approved" },
    sourceEvent: {
      contractVersion: "eqpass-perl-score-event/rfi-0.1",
      contractStatus: "proposed-rfi-only",
      scoringVersion: "synthetic-score-rules-2026-08",
      findingsReportVersion: "synthetic-findings-v1",
      receiptHash: "a".repeat(64)
    },
    reportArtifact: {
      id: "FF-TEST-ARTIFACT-001",
      hash: artifactHash,
      reportFormat: "perl-clinician-report/1.0",
      disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08"
    },
    attachment: {
      status: "prepared-not-attached",
      preparation: {
        status: "prepared-not-attached",
        contractStatus: "proposed-rfi-only",
        reportArtifactHash: artifactHash,
        findingsReportHash: "c".repeat(64),
        renderedContentHash: "d".repeat(64),
        renderedMediaType: "text/html",
        hash: "e".repeat(64)
      }
    }
  };
  const artifact = {
    hash: artifactHash,
    assessment: {
      id: "FF-TEST-ASSEMBLY-001",
      completedAt: "2026-08-14T12:00:00.000Z",
      itemsAnswered: 105,
      scales: { depression: 35, anxiety: 20, anger: 27, gpi: 82 },
      scaleLevels: { depression: "mild", anxiety: "mild", anger: "mild", gpi: "mild" },
      criticalResponses: [{ item: "RF_85", score: 2 }]
    },
    narrative: { text: "Indicators suggest a mild, mixed burden that should be clarified in conversation." },
    interpretation: {
      hypotheses: [
        { title: "Affective burden", body: "The profile may indicate elevated negative affect.", evidence: ["GPI 82", "Depression 35"] },
        { title: "Anxiety pattern", body: "Anxiety indicators warrant contextual review.", evidence: ["Anxiety 20"] },
        { title: "Anger pattern", body: "Anger indicators may merit follow-up.", evidence: ["Anger 27"] }
      ],
      questions: ["What was happening when these responses were recorded?", "How is functioning affected?", "What feels most urgent?", "What support is available?"]
    },
    review: { status: "approved", reviewer: "ASSEMBLY-QA", safetyAcknowledged: true, approvedAt: "2026-08-14T12:05:00.000Z" },
    disclaimer: "This structured decision-support summary does not diagnose, prescribe, or replace licensed clinical judgment.",
    disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08"
  };
  return { detail, report: { mode: "approved", artifact } };
}

test("report assembly fixes four source leaves and one PERL page without claiming a merge", () => {
  const { detail, report } = fixture();
  assert.equal(REPORT_ASSEMBLY_CONTRACT, "perl-report-assembly-proof/1.0");
  assert.equal(SOURCE_PAGE_BLUEPRINT.length, 4);
  assert.match(REPORT_ASSEMBLY_BOUNDARY, /No PDF merge, e-QPASS write, remote attachment/i);
  assert.deepEqual(validateReportAssemblyInput(detail, report), []);
  const proof = buildReportAssemblyProof(detail, report);
  assert.equal(proof.pageCount, 5);
  assert.equal(proof.sourcePageCount, 4);
  assert.equal(proof.perlPageCount, 1);
  assert.deepEqual(proof.pageOrder.map(item => item.page), [1, 2, 3, 4, 5]);
  assert.ok(proof.pageOrder.slice(0, 4).every(item => item.contentIncluded === false && item.modifiedByPerl === false));
  assert.equal(proof.pageOrder[4].label, "PERL clinician summary");
  for (const key of ["sourcePackageContentIncluded", "pdfMergePerformed", "eqpassWritePerformed", "remoteAttachmentPerformed", "productionValidationComplete", "pilotAuthorizationRecorded", "clinicalReleaseAuthorized", "patientUseAuthorized"]) assert.equal(proof[key], false);
  assert.match(proof.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(proof.fingerprint, buildReportAssemblyProof(detail, report).fingerprint);
});

test("report assembly rejects drafts, unattached lineage gaps, and invented authority", () => {
  const { detail, report } = fixture();
  report.mode = "draft";
  assert.match(validateReportAssemblyInput(detail, report).join(" "), /approved synthetic clinician artifact/i);
  report.mode = "approved";
  detail.attachment.status = "attached";
  assert.match(validateReportAssemblyInput(detail, report).join(" "), /prepared, explicitly unattached/i);
  detail.attachment.status = "prepared-not-attached";
  detail.attachment.preparation.contractStatus = "authoritative";
  assert.match(validateReportAssemblyInput(detail, report).join(" "), /cannot claim an authoritative/i);
});

test("assembly page renders the exact semantic page order and approved synthetic content", () => {
  const { detail, report } = fixture();
  const proof = buildReportAssemblyProof(detail, report);
  const html = renderReportAssemblyPage(proof, report.artifact);
  assert.equal((html.match(/class="packet-page/g) || []).length, 5);
  assert.equal((html.match(/class="packet-page source-page"/g) || []).length, 4);
  assert.equal((html.match(/class="packet-page perl-page"/g) || []).length, 1);
  assert.match(html, /Questionnaire responses/);
  assert.match(html, /Emotional Temperature/);
  assert.match(html, /Scale \+ crisis analysis/);
  assert.match(html, /Subscale analysis/);
  assert.match(html, /What this profile may indicate/);
  assert.match(html, /Indicators suggest a mild, mixed burden/);
  assert.match(html, /Prepared—not attached/);
  assert.match(html, /Print QA proof/);
  assert.doesNotMatch(html, /Print clinical packet/);
});

test("assembly page escapes all approved artifact prose", () => {
  const { detail, report } = fixture();
  report.artifact.narrative.text = '<script>alert("narrative")</script>';
  report.artifact.interpretation.hypotheses[0].title = '<img src=x onerror="alert(1)">';
  const html = renderReportAssemblyPage(buildReportAssemblyProof(detail, report), report.artifact);
  assert.match(html, /&lt;script&gt;alert\(&quot;narrative&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
});

test("assembly stylesheet locks Letter geometry, page breaks, focus, and mobile reflow", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../report-assembly.css", import.meta.url), "utf8"),
    readFile(new URL("../report-assembly-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /\.packet-page \{[^}]*width: 8\.5in; height: 11in;/s);
  assert.match(css, /@page \{ size: Letter; margin: 0; \}/);
  assert.match(css, /page-break-after: always/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /print-color-adjust: exact/);
  assert.match(script, /window\.print\(\)/);
});
