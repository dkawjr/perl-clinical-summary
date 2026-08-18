import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessments } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { buildClinicalBrief, CLINICAL_BRIEF_CONTRACT, validateClinicalBrief } from "../src/clinical-brief.js";
import { renderReportPage } from "../src/report-page.js";

function briefFor(assessment) {
  return buildClinicalBrief({
    assessment,
    interpretation: generateClinicalInterpretation(assessment),
    narrative: generateSummary(assessment, "clinician")
  });
}

test("clinical brief exposes every source-requested section under a versioned contract", () => {
  const brief = briefFor(assessments[0]);
  assert.equal(brief.format, "perl-clinical-brief/1.0");
  assert.ok(brief.overallDistress);
  assert.equal(brief.coreDimensions.length, 4);
  assert.ok(brief.clinicalThemes.length >= 1);
  assert.ok(brief.mixedSignals);
  assert.ok(brief.redFlags);
  assert.ok(brief.qualityChecks.length >= 5);
  assert.equal(brief.limitations.length, 5);
  assert.deepEqual(validateClinicalBrief(brief, assessments[0]), []);
});

test("clinical brief is deterministic and honors supplied source range labels", () => {
  const assessment = structuredClone(assessments[0]);
  assessment.scaleLevels = {
    depression: "moderate",
    anxiety: "mild",
    anger: "minimal",
    gpi: "mild",
    phobicAvoidance: "mild",
    obsessiveCompulsive: "minimal",
    psychoticism: "minimal",
    suicideRisk: "moderate",
    violenceRisk: "minimal"
  };
  const interpretation = generateClinicalInterpretation(assessment);
  const input = { assessment, interpretation, narrative: generateSummary(assessment) };
  const first = buildClinicalBrief(input);
  const second = buildClinicalBrief(input);
  assert.deepEqual(first, second);
  assert.equal(first.overallDistress.level, "mild");
  assert.equal(first.coreDimensions.find(item => item.key === "depression").level, "moderate");
});

test("critical-screen red flags remain a direct-review route without raw response wording", () => {
  const brief = briefFor(assessments[0]);
  assert.equal(brief.redFlags.status, "direct-review-required");
  assert.equal(brief.redFlags.highlightedResponses, 1);
  assert.match(brief.redFlags.statement, /qualified clinician/i);
  assert.match(brief.redFlags.sourceDisclosure, /raw response wording is intentionally not reproduced/i);
});

test("themes preserve exact scored evidence and state uncertainty explicitly", () => {
  const assessment = assessments[2];
  const interpretation = generateClinicalInterpretation(assessment);
  const brief = buildClinicalBrief({ assessment, interpretation, narrative: generateSummary(assessment) });
  assert.deepEqual(brief.clinicalThemes.flatMap(theme => theme.evidence), interpretation.hypotheses.flatMap(theme => theme.evidence));
  assert.ok(brief.clinicalThemes.every(theme => /does not establish/i.test(theme.uncertainty)));
  assert.ok(brief.clinicalThemes.every(theme => theme.followUp.endsWith("?")));
});

test("unsupported specificity is disclosed instead of becoming a fabricated quality score", () => {
  const brief = briefFor(assessments[1]);
  const specificity = brief.qualityChecks.find(item => item.id === "specificity");
  assert.equal(specificity.status, "not-scored");
  assert.equal(specificity.value, "Not scored");
  assert.equal(CLINICAL_BRIEF_CONTRACT.specificityMetric.value, null);
  assert.match(specificity.detail, /no clinically approved/i);
});

test("clinical brief schema and review surface preserve the same contract", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/clinical-brief.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal(schema.properties.format.const, CLINICAL_BRIEF_CONTRACT.format);
  assert.deepEqual(schema.required, ["format", "recordId", "overallDistress", "coreDimensions", "clinicalThemes", "mixedSignals", "redFlags", "qualityChecks", "limitations", "boundaries"]);
  assert.match(html, /01 \/ Overall distress/);
  assert.match(html, /02 \/ Core dimensions/);
  assert.match(html, /03 \/ Pattern checks/);
  assert.match(html, /04 \/ Clinical themes/);
  assert.match(html, /Confidence \+ limitations/);
  assert.match(css, /\.brief-check-grid\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.brief-check-grid, \.brief-limitations ol \{ grid-template-columns: 1fr;/);
});

test("print report renders clinical themes, pattern checks, quality, and limitations from the brief", () => {
  const assessment = assessments[0];
  const interpretation = generateClinicalInterpretation(assessment);
  const clinicalBrief = briefFor(assessment);
  const html = renderReportPage({
    mode: "draft",
    artifact: {
      reportFormat: "perl-clinician-report/1.0",
      sourceAssessmentHash: "a".repeat(64),
      assessment,
      narrative: { text: generateSummary(assessment), provider: "deterministic", version: "test" },
      interpretation,
      clinicalBrief,
      review: { status: "ready", safetyAcknowledged: false },
      provider: { id: "deterministic", version: "test" }
    }
  });
  assert.match(html, /Core dimensions/);
  assert.match(html, /Pattern checks/);
  assert.match(html, /Clinical themes/);
  assert.match(html, /Quality checks/);
  assert.match(html, /Confidence \+ limitations/);
  assert.match(html, /perl-clinical-brief\/1\.0/);
});
