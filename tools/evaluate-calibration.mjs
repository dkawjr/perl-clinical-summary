import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessments } from "../src/demo-data.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { createModelProvider } from "../src/model-provider.js";
import { evaluateReleaseEvidence } from "../src/release-evidence.js";

export async function evaluateCalibration() {
  return evaluateReleaseEvidence({
    assessments,
    references: calibrationReferences,
    manifest: calibrationManifest,
    modelProvider: createModelProvider()
  });
}

function markdown(report) {
  const pct = value => `${Math.round(value * 100)}%`;
  const rows = report.cases.map(item => `| ${item.id} | ${pct(item.narrativeSimilarity)} | ${pct(item.hypothesisTitleCoverage)} | ${item.criticalScreenHandled ? "Pass" : "Fail"} | ${item.diagnosticRestraint ? "Pass" : "Fail"} | ${item.evidenceLinkedHypotheses}/${item.hypotheses} |`).join("\n");
  const outcomeRows = Object.values(report.outcomes).map(item => `| ${item.label} | ${item.numerator}/${item.denominator} ${item.unit} | ${item.rate == null ? "Not observed" : pct(item.rate)} | ${item.status} |`).join("\n");
  return `# PERL offline calibration baseline

Generated: ${report.generatedAt}

This report compares PERL’s deterministic synthetic output with the separately stored human-authored calibration references. It is an engineering regression baseline—not clinical validation, reliability evidence, or permission for live use.

## Denominator-first safety outcomes

| Measure | Passed / eligible | Rate | Gate |
|---|---:|---:|---|
${outcomeRows}

Engineering regression: **${report.engineeringRegressionPassed ? "passed" : "failed"}**

## Descriptive calibration diagnostics

| Measure | Result |
|---|---:|
| Synthetic cases evaluated | ${report.caseSet.evaluated}/${report.caseSet.manifested} |
| Narrative token overlap | ${pct(report.diagnostics.narrativeSimilarity)} |
| Exact reference hypothesis-title coverage | ${pct(report.diagnostics.hypothesisTitleCoverage)} |

## Cases

| Case | Narrative overlap | Title coverage | Critical handling | Restraint | Evidence |
|---|---:|---:|---|---|---|
${rows}

## Interpretation

- Critical-screen handling, diagnostic restraint, and evidence lineage are release invariants for the frozen synthetic regression set.
- Token overlap and exact title coverage are descriptive calibration signals, not quality targets by themselves.
- Clinical beta thresholds must be predeclared with Dolores and the reviewer panel, then measured on an approved de-identified holdout set.
- ${report.boundary}
`;
}

async function main() {
  const report = await evaluateCalibration();
  const output = resolve(process.argv[2] || "qa/calibration-baseline.md");
  await writeFile(output, markdown(report), "utf8");
  console.log(`Wrote ${basename(output)}`);
  console.log(JSON.stringify({
    cases: report.caseSet.evaluated,
    narrativeSimilarity: report.diagnostics.narrativeSimilarity,
    hypothesisTitleCoverage: report.diagnostics.hypothesisTitleCoverage,
    criticalScreenHandling: report.outcomes.criticalScreenHandling.rate,
    diagnosticRestraint: report.outcomes.diagnosticRestraint.rate,
    evidenceLineage: report.outcomes.evidenceLineage.rate,
    engineeringRegressionPassed: report.engineeringRegressionPassed
  }, null, 2));
  if (!report.engineeringRegressionPassed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
