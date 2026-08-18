import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { REPORT_CONTRACT, validateReportContent } from "../src/report-page.js";

test("clinician attachment declares Letter print geometry and a mobile single-column layout", async () => {
  const css = await readFile(new URL("../report.css", import.meta.url), "utf8");
  assert.match(css, /width:\s*min\(8\.5in,/);
  assert.match(css, /min-height:\s*11in/);
  assert.match(css, /@page\s*\{\s*size:\s*Letter;\s*margin:\s*0;/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /\.score-grid,\s*\.pattern-grid,\s*\.hypothesis-list,\s*\.question-list,\s*\.assurance-section,\s*\.report-footer\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media\s+print[\s\S]*height:\s*calc\(11in\s*\/\s*1\.4\)[\s\S]*overflow:\s*hidden[\s\S]*zoom:\s*1\.4/);
});

test("clinician attachment approval contract keeps generated content within its page budget", () => {
  assert.equal(REPORT_CONTRACT.pageFit.maximumHypotheses, 3);
  assert.equal(REPORT_CONTRACT.pageFit.maximumQuestions, 5);
  const errors = validateReportContent(
    { text: "x".repeat(REPORT_CONTRACT.pageFit.maximumNarrativeCharacters + 1) },
    { hypotheses: Array.from({ length: 4 }, () => ({ title: "Pattern", body: "Evidence-linked explanation", evidence: ["GPI · 55"] })), questions: Array.from({ length: 6 }, () => "What context should be clarified?") }
  );
  assert.ok(errors.some(error => /narrative exceeds/i.test(error)));
  assert.ok(errors.some(error => /up to 3/i.test(error)));
  assert.ok(errors.some(error => /up to 5/i.test(error)));
});
