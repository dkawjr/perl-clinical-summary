import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessments } from "../src/demo-data.js";
import { buildProgressReview } from "../src/progress-review.js";
import { PROGRESS_REPORT_CONTRACT, renderProgressReportPage, validateProgressReport } from "../src/progress-report-page.js";

const progressReview = buildProgressReview({ assessments, generatedAt: "2026-08-14T12:00:00.000Z" });

test("progress addendum is a Letter-ready rehearsal draft with denied clinical authority", () => {
  assert.equal(PROGRESS_REPORT_CONTRACT.format, "perl-synthetic-progress-addendum/1.0");
  assert.equal(PROGRESS_REPORT_CONTRACT.state, "rehearsal-draft");
  assert.equal(PROGRESS_REPORT_CONTRACT.subjectLinkageAuthoritative, false);
  assert.equal(PROGRESS_REPORT_CONTRACT.clinicalProgressEstablished, false);
  assert.equal(PROGRESS_REPORT_CONTRACT.clinicalRecommendationCreated, false);
  assert.equal(PROGRESS_REPORT_CONTRACT.patientUseAuthorized, false);
  assert.deepEqual(validateProgressReport(progressReview), []);
});

test("progress addendum renders exact score movement, affirming guidance, safety, and claim boundaries", () => {
  const html = renderProgressReportPage(progressReview);
  assert.match(html, /<main class="progress-report-sheet" aria-labelledby="progress-report-title">/);
  assert.match(html, /Let the person’s account explain the line/);
  assert.match(html, /Affirming opening/);
  assert.match(html, /Lower does not mean better/);
  assert.equal((html.match(/class="movement-row"/g) || []).length, 4);
  assert.equal((html.match(/class="priority"/g) || []).length, 4);
  assert.match(html, /Depression[\s\S]*51[\s\S]*12[\s\S]*−39/);
  assert.match(html, /No subject linkage, improvement, deterioration, reliable or meaningful change/);
  assert.match(html, /Synthetic calibration sandbox · no PHI · not a progress note · not for live clinical use/);
  assert.match(html, /id="report-print"/);
});

test("progress addendum rejects an altered source series or clinical claim", () => {
  const alteredSeries = structuredClone(progressReview);
  alteredSeries.series.id = "OTHER-SERIES";
  assert.match(validateProgressReport(alteredSeries).join(" "), /not the frozen synthetic pair/i);
  const alteredClaim = structuredClone(progressReview);
  alteredClaim.improvementEstablished = true;
  assert.match(validateProgressReport(alteredClaim).join(" "), /authority boundaries are invalid/i);
});

test("progress addendum stylesheet declares Letter print geometry and a responsive single-column path", async () => {
  const css = await readFile(new URL("../progress-report.css", import.meta.url), "utf8");
  assert.match(css, /@page \{ size: Letter; margin: 0; \}/);
  assert.match(css, /\.progress-report-sheet \{[^}]*width: min\(8\.5in,100%\);[^}]*min-height: 11in;/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.priority-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
