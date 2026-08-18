import test from "node:test";
import assert from "node:assert/strict";
import { EQPASS_PDF_CONTRACT, parseEqpassScoreReport } from "../src/eqpass-pdf.js";

const pages = [
  "Global Psychopathology Index (\"GPI\"): 55\nTest Duration: 00:14:00",
  "22 DEPRESSION SCORE 16 ANXIETY SCORE 9 ANGER SCORE",
  `QPASS Client Profile Report - Scale Analysis
NEGATIVE AFFECT SCALES
SCORES 22 16 9 8 55
CLINICAL SCALES CRISIS SCALES
SCORES 3 3 2 1 0`,
  `QPASS Client Profile Report - Subscale Analysis
DEPRESSION PROFILE
SCORES 2 2 7 2 5
ANXIETY PROFILE
SCORES 9 2 3
ANGER PROFILE
SCORES 2 1 2 2 2 0`
];

test("e-QPASS score report parser extracts the verified score rows", () => {
  const result = parseEqpassScoreReport(pages, { now: new Date("2026-08-18T12:00:00Z") });
  assert.deepEqual({
    depression: result.values.depression,
    anxiety: result.values.anxiety,
    anger: result.values.anger,
    gpi: result.values.gpi,
    suicideRisk: result.values.suicideRisk,
    violenceRisk: result.values.violenceRisk
  }, {
    depression: "22",
    anxiety: "16",
    anger: "9",
    gpi: "55",
    suicideRisk: "1",
    violenceRisk: "0"
  });
  assert.equal(result.values.duration, "14:00");
  assert.equal(result.values["subscale-negative-cognition-level"], "mild");
  assert.equal(result.values["subscale-anger-out-verbal-level"], "mild");
  assert.equal(result.safetyHoldDetected, true);
  assert.equal(result.extractedFieldCount, 15);
  assert.equal(result.ignoredIdentifiers, true);
});

test("e-QPASS parser fails closed when the scored report pages are incomplete", () => {
  assert.throws(
    () => parseEqpassScoreReport([pages[2]]),
    /does not match the e-QPASS scored report format/
  );
});

test("e-QPASS PDF contract keeps the source document in browser memory only", () => {
  assert.equal(EQPASS_PDF_CONTRACT.processing, "browser-only");
  assert.equal(EQPASS_PDF_CONTRACT.retainsPdf, false);
  assert.equal(EQPASS_PDF_CONTRACT.extractsIdentifiers, false);
  assert.equal(EQPASS_PDF_CONTRACT.requiresScoreVerification, true);
  assert.equal(EQPASS_PDF_CONTRACT.pdfJsVersion, "6.2.108");
});
