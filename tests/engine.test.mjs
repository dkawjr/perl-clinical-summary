import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessments } from "../src/demo-data.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { calibrationManifest, validateCalibrationManifest } from "../src/calibration-manifest.js";
import {
  SCALE_THRESHOLDS,
  classifyScale,
  coverageScore,
  generateClinicalInterpretation,
  generateSummary,
  riskDisposition,
  validateAssessment,
  validateClinicalInterpretation,
  validateNarrative
} from "../src/engine.js";

test("published scale boundaries classify correctly", () => {
  assert.equal(classifyScale("depression", 21), "minimal");
  assert.equal(classifyScale("depression", 22), "mild");
  assert.equal(classifyScale("depression", 47), "moderate");
  assert.equal(classifyScale("depression", 65), "severe");
  assert.equal(classifyScale("anxiety", 56), "severe");
  assert.equal(classifyScale("anger", 35), "moderate");
});

test("critical responses hold the record for clinician review", () => {
  const disposition = riskDisposition(assessments[0]);
  assert.equal(disposition.requiresReview, true);
  assert.equal(disposition.urgency, "priority");
});

test("generated language remains decision support rather than diagnosis", () => {
  const summary = generateSummary(assessments[0]);
  assert.match(summary, /self-report/i);
  assert.match(summary, /do not establish a diagnosis/i);
  assert.doesNotMatch(summary, /\b(has|diagnosed with|meets criteria for)\b/i);
});

test("administrative audience preserves routing facts without clinical interpretation", async () => {
  const summary = generateSummary(assessments[0], "admin");
  assert.match(summary, /105 required responses/i);
  assert.match(summary, /critical-screen hold/i);
  assert.match(summary, /administrative routing note/i);
  assert.match(summary, /does not establish a diagnosis/i);
  assert.doesNotMatch(summary, /depression|anxiety|anger|global distress/i);

  const schema = JSON.parse(await readFile(new URL("../schemas/clinical-summary.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.audience.enum, ["clinician", "care", "payer", "admin"]);
});

test("complete synthetic fixtures report full coverage", () => {
  assert.equal(coverageScore(assessments[0]), 100);
});

test("imports require non-identifying internal record IDs", () => {
  const unsafe = structuredClone(assessments[0]);
  unsafe.id = "0000076";
  assert.ok(validateAssessment(unsafe).some(error => error.includes("non-identifying record ID")));
  assert.deepEqual(validateAssessment(assessments[0]), []);
});

test("server-side language guard rejects diagnostic certainty", () => {
  assert.deepEqual(validateNarrative("Self-report results may indicate a mild pattern that should be clarified in interview and does not establish a diagnosis."), []);
  assert.ok(validateNarrative("The person has anxiety and definitely meets criteria for a disorder.").length > 0);
});

test("canonical payload validation catches incomplete e-QPASS fixtures", () => {
  const incomplete = structuredClone(assessments[0]);
  incomplete.itemsAnswered = 104;
  incomplete.scales.anxiety = -1;
  const errors = validateAssessment(incomplete);
  assert.ok(errors.some(error => error.includes("105 answered items")));
  assert.ok(errors.some(error => error.includes("anxiety")));
});

test("canonical payload rejects direct-identifier fields and unknown sources", () => {
  const unsafe = structuredClone(assessments[1]);
  unsafe.email = "person@example.org";
  unsafe.source = "production export";
  const errors = validateAssessment(unsafe);
  assert.ok(errors.some(error => error.includes("direct-identifier")));
  assert.ok(errors.some(error => error.includes("identify e-QPASS or PERL")));
});

test("published schema and example fixture stay aligned with runtime validation", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/assessment.schema.json", import.meta.url), "utf8"));
  const example = JSON.parse(await readFile(new URL("../examples/synthetic-assessment.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(schema.properties.scales.properties).sort(), Object.keys(SCALE_THRESHOLDS).sort());
  assert.ok(!schema.required.includes("hypotheses"));
  assert.ok(!schema.required.includes("questions"));
  assert.ok(!("hypotheses" in schema.properties));
  assert.ok(!("questions" in schema.properties));
  assert.deepEqual(validateAssessment(example), []);
});

test("paired blind-comparison schema requires both author-hidden rating sets", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/calibration-comparison.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.protocol.const, "blind-v3");
  assert.ok(schema.required.includes("caseSet"));
  assert.ok(schema.required.includes("partition"));
  assert.ok(schema.required.includes("reviewTiming"));
  assert.equal(schema.properties.reviewTiming.properties.measurement.const, "server-wall-clock-v1");
  assert.deepEqual(schema.properties.ratings.required, ["A", "B"]);
  assert.deepEqual(schema.$defs.ratingSet.required, ["accuracy", "restraint", "utility"]);
  assert.equal(schema.$defs.rating.minimum, 1);
  assert.equal(schema.$defs.rating.maximum, 5);
});

test("safety incident schema preserves linked report and resolution events", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/safety-incident-event.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.type.enum, ["reported", "resolved"]);
  assert.deepEqual(schema.properties.severity.enum, ["low", "moderate", "high", "critical"]);
  assert.equal(schema.properties.previousHash.pattern, "^(GENESIS|[a-f0-9]{64})$");
  assert.equal(schema.allOf[0].then.required.includes("summary"), true);
  assert.deepEqual(schema.allOf[1].then.required, ["resolution"]);
});

test("frozen calibration manifest covers every referenced synthetic case", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/calibration-case-set.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.holdoutValid.const, false);
  assert.deepEqual(validateCalibrationManifest(calibrationManifest, assessments, calibrationReferences), []);
  assert.deepEqual(Object.keys(calibrationManifest.cases).sort(), Object.keys(calibrationReferences).sort());
  assert.ok(calibrationManifest.claimBoundary.includes("not a valid unseen clinical holdout"));
  const invalid = structuredClone(calibrationManifest);
  delete invalid.cases["FF-TEST-2411-C"];
  assert.ok(validateCalibrationManifest(invalid, assessments, calibrationReferences).some(error => /missing from the case-set manifest/i.test(error)));
});

test("blind outcome event schema distinguishes recorded events from migration baselines", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/blind-outcome-event.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.type.enum, ["recorded", "legacy-baseline"]);
  assert.equal(schema.properties.comparisonHash.pattern, "^[a-f0-9]{64}$");
  assert.ok(schema.required.includes("previousHash"));
});

test("release-evidence schema requires denominator-first outcomes and a non-validation boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/release-evidence.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.clinicalValidation.const, false);
  assert.deepEqual(schema.properties.outcomes.required, ["inputContract", "criticalScreenHandling", "diagnosticRestraint", "evidenceLineage"]);
  assert.ok(schema.$defs.outcome.required.includes("numerator"));
  assert.ok(schema.$defs.outcome.required.includes("denominator"));
  assert.deepEqual(schema.$defs.outcome.properties.status.enum, ["passed", "failed", "not-observed"]);
});

test("approved report artifacts are versioned, clinician-only, and hash-linked", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/report-artifact.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.type.enum, ["approved", "legacy-baseline"]);
  assert.equal(schema.properties.reportFormat.const, "perl-clinician-report/1.0");
  assert.equal(schema.properties.audience.const, "clinician");
  assert.equal(schema.properties.review.properties.status.const, "approved");
  assert.equal(schema.properties.previousHash.pattern, "^(GENESIS|[a-f0-9]{64})$");
  assert.equal(schema.properties.sourceProvenance.properties.contractStatus.const, "proposed-rfi-only");
  assert.equal(schema.properties.clinicalBrief.$ref, "clinical-brief.schema.json");
});

test("attachment preparation stays explicitly synthetic and never claims attachment", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/attachment-preparation-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contractStatus.const, "proposed-rfi-only");
  assert.equal(schema.properties.status.const, "prepared-not-attached");
  assert.equal(schema.properties.renderedMediaType.const, "text/html");
  assert.ok(schema.required.includes("sourceEventReceiptHash"));
  assert.ok(schema.required.includes("reportArtifactHash"));
  assert.ok(schema.required.includes("findingsReportHash"));
});

test("provider workflow schema preserves human approval and the no-write boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/provider-workflow-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contractVersion.const, "perl-provider-workflow/0.1");
  assert.deepEqual(schema.properties.type.enum, ["review-queued", "handoff-queued", "handoff-prepared", "handoff-failed"]);
  assert.ok(schema.properties.status.enum.includes("prepared-not-attached"));
  assert.equal(schema.properties.origin.enum.includes("runtime-automation"), true);
  assert.equal(schema.properties.trigger.enum.includes("clinician-approval"), true);
});

test("change-control event schema keeps clinical release authorization false", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/change-control-event.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.type.enum, ["proposed", "replayed", "disposition"]);
  assert.deepEqual(schema.properties.disposition.enum, ["advance-for-clinical-review", "rollback"]);
  assert.equal(schema.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(schema.properties.previousHash.pattern, "^(GENESIS|[a-f0-9]{64})$");
  assert.equal(schema.properties.refinementEvidence.oneOf[1].properties.contract.const, "perl-refinement-brief/1.0");
});

test("reviewer-feedback event schema preserves recorded and migration evidence", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/reviewer-feedback-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.oneOf[0].properties.type.const, "recorded");
  assert.equal(schema.oneOf[1].properties.type.const, "legacy-baseline");
  assert.match(schema.oneOf[0].properties.feedbackHash.pattern, /64/);
});

test("refinement brief schema prohibits automatic clinical change claims", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/refinement-brief.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contract.const, "perl-refinement-brief/1.0");
  assert.equal(schema.properties.clinicalValidation.const, false);
  assert.match(schema.properties.claimBoundary.pattern, /may not change clinical logic automatically/);
  assert.equal(schema.properties.signals.items.properties.component.const, "model");
});

test("scored fixtures contain no prewritten interpretation output", () => {
  for (const assessment of assessments) {
    assert.equal("hypotheses" in assessment, false);
    assert.equal("questions" in assessment, false);
  }
  assert.ok(calibrationReferences["FF-TEST-2407-A"].hypotheses.length > 0);
});

test("PERL generates evidence-linked interpretation downstream of scoring", () => {
  const first = generateClinicalInterpretation(assessments[0]);
  assert.deepEqual(first.hypotheses.map(item => item.title), [
    "Reduced reward and self-evaluative strain",
    "Cognitive tension with limited somatic load",
    "Domain signal without corresponding global elevation"
  ]);
  assert.ok(first.hypotheses.every(item => item.evidence.length > 0));
  assert.match(first.questions[0], /critical-screen/i);

  const broad = generateClinicalInterpretation(assessments[2]);
  assert.equal(broad.hypotheses[0].title, "Broad negative-affect burden");
  assert.ok(broad.questions.some(question => /daily functioning/i.test(question)));
});

test("structured interpretation revisions must remain evidence-grounded and cautious", () => {
  const generated = generateClinicalInterpretation(assessments[0]);
  assert.deepEqual(validateClinicalInterpretation(generated, assessments[0]), []);
  const unsupported = structuredClone(generated);
  unsupported.hypotheses[0].evidence = ["Invented construct · 99"];
  unsupported.hypotheses[0].body = "The person definitely has a disorder and this result proves it beyond any uncertainty in context or history.";
  const errors = validateClinicalInterpretation(unsupported, assessments[0]);
  assert.ok(errors.some(error => /evidence not present/i.test(error)));
  assert.ok(errors.some(error => /overly certain/i.test(error)));
});
