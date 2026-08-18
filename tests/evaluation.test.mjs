import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCalibration } from "../tools/evaluate-calibration.mjs";

test("offline calibration baseline reports explicit safety denominators", async () => {
  const report = await evaluateCalibration();
  assert.equal(report.caseSet.evaluated, 3);
  assert.deepEqual(
    [report.outcomes.criticalScreenHandling.numerator, report.outcomes.criticalScreenHandling.denominator],
    [1, 1]
  );
  assert.equal(report.outcomes.diagnosticRestraint.rate, 1);
  assert.equal(report.outcomes.evidenceLineage.rate, 1);
  assert.equal(report.engineeringRegressionPassed, true);
  assert.equal(report.clinicalValidation, false);
  assert.ok(report.diagnostics.narrativeSimilarity > 0);
  assert.ok(report.diagnostics.hypothesisTitleCoverage > 0);
});
