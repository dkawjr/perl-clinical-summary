import test from "node:test";
import assert from "node:assert/strict";
import { buildSyntheticAssessmentFromScoreForm, TEST_FORM_ENTRY_CONTRACT } from "../src/test-form-entry.js";
import { validateAssessment } from "../src/engine.js";

const valid = {
  recordId: "DOLORES-01",
  completedAt: "Today · test entry",
  duration: "09:42",
  depression: "22",
  anxiety: "16",
  anger: "9",
  gpi: "55",
  phobicAvoidance: "3",
  obsessiveCompulsive: "3",
  psychoticism: "2",
  suicideRisk: "0",
  violenceRisk: "0",
  "subscale-dysphoria-score": "2",
  "subscale-dysphoria-level": "minimal",
  "subscale-negative-cognition-score": "7",
  "subscale-negative-cognition-level": "mild",
  "subscale-anhedonia-score": "5",
  "subscale-anhedonia-level": "mild",
  "subscale-apprehension-score": "9",
  "subscale-apprehension-level": "mild",
  "subscale-physiological-arousal-score": "3",
  "subscale-physiological-arousal-level": "mild",
  "subscale-anger-out-verbal-score": "2",
  "subscale-anger-out-verbal-level": "mild"
};

test("manual scored-form entry creates a canonical synthetic assessment", () => {
  const assessment = buildSyntheticAssessmentFromScoreForm(valid, { now: new Date("2026-08-18T12:00:00Z") });
  assert.equal(assessment.id, "FF-TEST-DOLORES-01");
  assert.equal(assessment.status, "ready");
  assert.equal(assessment.subscales.length, 6);
  assert.deepEqual(validateAssessment(assessment), []);
  assert.equal(TEST_FORM_ENTRY_CONTRACT.acceptsRawResponses, false);
  assert.equal(TEST_FORM_ENTRY_CONTRACT.acceptsIdentifiers, false);
  assert.equal(TEST_FORM_ENTRY_CONTRACT.acceptsSyntheticEqpassPdf, true);
  assert.equal(TEST_FORM_ENTRY_CONTRACT.retainsSourcePdf, false);
});

test("PDF-derived scored entry records local extraction provenance without retaining the PDF", () => {
  const assessment = buildSyntheticAssessmentFromScoreForm({ ...valid, entrySource: "pdf" });
  assert.match(assessment.source, /PDF score extraction/);
  assert.match(assessment.subscales[0].evidence, /locally extracted and reviewer verified/);
});

test("manual scored-form entry routes a non-zero critical score to priority review", () => {
  const assessment = buildSyntheticAssessmentFromScoreForm({ ...valid, suicideRisk: "1" });
  assert.equal(assessment.status, "priority");
  assert.equal(assessment.criticalResponses.length, 1);
  assert.equal(assessment.criticalResponses[0].directReviewRequired, true);
});

test("manual scored-form entry rejects out-of-range and identifying record fields", () => {
  assert.throws(() => buildSyntheticAssessmentFromScoreForm({ ...valid, depression: "105" }), /0 to 104/);
  assert.throws(() => buildSyntheticAssessmentFromScoreForm({ ...valid, recordId: "person name" }), /letters, numbers, and hyphens/);
});
