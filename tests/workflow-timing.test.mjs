import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessments } from "../src/demo-data.js";
import { WORKFLOW_TIMING_CONTRACT, validateWorkflowSummary, workflowSourceProfile } from "../src/workflow-timing.js";

const observationSchema = JSON.parse(await readFile(new URL("../schemas/workflow-timing-observation.schema.json", import.meta.url), "utf8"));
const eventSchema = JSON.parse(await readFile(new URL("../schemas/workflow-timing-event.schema.json", import.meta.url), "utf8"));

test("workflow timing contract defines balanced conditions and a non-claim boundary", () => {
  assert.deepEqual(WORKFLOW_TIMING_CONTRACT.conditions, ["unaided", "perl-assisted"]);
  assert.equal(WORKFLOW_TIMING_CONTRACT.eligibilityWindowSeconds.minimum, 30);
  assert.equal(WORKFLOW_TIMING_CONTRACT.eligibilityWindowSeconds.maximum, 2700);
  assert.equal(WORKFLOW_TIMING_CONTRACT.minimumEligiblePerCondition, 30);
  assert.equal(WORKFLOW_TIMING_CONTRACT.minimumMatchedCases, 20);
  assert.match(WORKFLOW_TIMING_CONTRACT.claimBoundary, /does not establish time saved/i);
});

test("workflow source projection contains scored evidence but no generated or counselor prose", () => {
  const profile = workflowSourceProfile(assessments[0]);
  assert.equal(profile.projection, "scored-profile-v1");
  assert.equal(profile.scales.length, 9);
  assert.equal(profile.subscales.length, assessments[0].subscales.length);
  assert.equal(profile.safety.directReviewRequired, true);
  const serialized = JSON.stringify(profile);
  for (const prohibited of ["initialDraft", "counselor-reference", "hypotheses", "questions", "narrative"]) {
    assert.equal(serialized.includes(prohibited), false);
  }
});

test("timed final summaries use the same bounded non-diagnostic language contract", () => {
  assert.ok(validateWorkflowSummary("Too short.").some(error => /at least 80 characters/i.test(error)));
  assert.ok(validateWorkflowSummary("The client is diagnosed with major depression and requires medication immediately. This definitive conclusion is presented as established fact.").some(error => /indicator language/i.test(error)));
  assert.deepEqual(validateWorkflowSummary("Self-report scores may indicate a pattern that should be clarified through direct interview, history, context, functional impact, protective factors, and routine safety verification; these indicators do not establish a diagnosis."), []);
});

test("published timing schemas bind every observation to a linked integrity event", () => {
  assert.ok(observationSchema.required.includes("reviewTiming"));
  assert.ok(observationSchema.required.includes("sourceAssessmentHash"));
  assert.ok(observationSchema.required.includes("claimBoundary"));
  assert.deepEqual(observationSchema.properties.condition.enum, ["unaided", "perl-assisted"]);
  assert.equal(observationSchema.properties.clinicalValidation.const, false);
  assert.ok(eventSchema.required.includes("observationHash"));
  assert.deepEqual(eventSchema.properties.type.enum, ["recorded", "legacy-baseline"]);
});
