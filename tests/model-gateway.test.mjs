import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessments } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { createModelProvider } from "../src/model-provider.js";
import {
  GENERATION_OUTPUT_CONTRACT,
  GENERATION_POLICY_HASH,
  GENERATION_POLICY_VERSION,
  StructuredCandidateProvider,
  validateGenerationBundle
} from "../src/model-gateway.js";

function validBundle(assessment) {
  return {
    narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(assessment, audience)])),
    interpretation: generateClinicalInterpretation(assessment)
  };
}

function authorization() {
  return {
    status: "approved-for-synthetic-calibration",
    providerId: "candidate-gateway-test",
    modelVersion: "candidate-2026-08-13",
    promptVersion: "perl-candidate-prompt/1.0",
    approvedBy: "MODEL-GOVERNANCE-QA"
  };
}

test("structured candidate receives only the scored projection and pins configured provenance", async () => {
  const assessment = assessments[0];
  let captured;
  const provider = new StructuredCandidateProvider({
    authorization: authorization(),
    transport: async request => {
      captured = request;
      return validBundle(assessment);
    }
  });
  const generated = await provider.generateCase(assessment);
  assert.equal(generated.narratives.clinician.provider, "candidate-gateway-test");
  assert.equal(generated.narratives.clinician.version, "candidate-2026-08-13");
  assert.equal(generated.narratives.clinician.promptVersion, "perl-candidate-prompt/1.0");
  assert.equal(generated.narratives.clinician.policyHash, GENERATION_POLICY_HASH);
  assert.equal(generated.interpretation.outputSchemaVersion, GENERATION_OUTPUT_CONTRACT);
  assert.equal(captured.policyVersion, GENERATION_POLICY_VERSION);
  assert.equal(captured.payload.itemsAnswered, 105);
  assert.equal(captured.payload.scales.depression, assessment.scales.depression);

  const serialized = JSON.stringify(captured);
  for (const privateValue of [assessment.id, assessment.source, assessment.completedAt, assessment.reviewer, assessment.criticalResponses[0].note]) {
    assert.equal(serialized.includes(privateValue), false);
  }
  for (const forbiddenKey of ["assessmentId", "subjectRef", "reportRef", "email", "dateOfBirth", "rawItemResponses"]) {
    assert.equal(Object.hasOwn(captured.payload, forbiddenKey), false);
  }
});

test("candidate output fails closed on certainty, invented evidence, safety omission, audience leakage, or extra fields", async () => {
  const assessment = assessments[0];
  const cases = [];

  const certainty = validBundle(assessment);
  certainty.narratives.clinician = "The person has anxiety and definitely meets criteria for a disorder based on these scores.";
  cases.push(certainty);

  const invented = validBundle(assessment);
  invented.interpretation.hypotheses[0].evidence = ["Invented construct · 99"];
  cases.push(invented);

  const missingSafety = validBundle(assessment);
  missingSafety.narratives.clinician = "Self-report results may indicate a pattern that requires contextual clarification with a licensed clinician. These findings do not establish a diagnosis and remain decision support only.";
  cases.push(missingSafety);

  const audienceLeak = validBundle(assessment);
  audienceLeak.narratives.admin += " Depression is elevated.";
  cases.push(audienceLeak);

  const extra = validBundle(assessment);
  extra.respondent = { name: "Injected person" };
  cases.push(extra);

  for (const output of cases) {
    assert.ok(validateGenerationBundle(output, assessment).length > 0);
    const provider = new StructuredCandidateProvider({ authorization: authorization(), transport: async () => output });
    await assert.rejects(() => provider.generateCase(assessment), error => error.code === "MODEL_OUTPUT_REJECTED" && !error.message.includes("Injected person"));
  }
});

test("candidate gateway requires explicit authorization and never falls back on transport failure", async () => {
  assert.throws(() => createModelProvider({ provider: "structured-candidate", transport: async () => ({}) }), /authorization/i);
  assert.throws(() => createModelProvider({ provider: "structured-candidate", authorization: authorization() }), /transport/i);
  const provider = createModelProvider({
    provider: "structured-candidate",
    authorization: authorization(),
    transport: async () => { throw new Error("vendor detail must not escape"); }
  });
  await assert.rejects(
    () => provider.generateCase(assessments[1]),
    error => error.code === "MODEL_UNAVAILABLE" && !error.message.includes("vendor detail")
  );
});

test("candidate timeout aborts the request and creates no fallback output", async () => {
  let aborted = false;
  const provider = new StructuredCandidateProvider({
    authorization: authorization(),
    timeoutMs: 500,
    transport: async (_request, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      }, { once: true });
    })
  });
  await assert.rejects(() => provider.generateCase(assessments[1]), error => error.code === "MODEL_TIMEOUT" && error.status === 504);
  assert.equal(aborted, true);
});

test("published model gateway schemas prohibit undeclared routing and output fields", async () => {
  const request = JSON.parse(await readFile(new URL("../schemas/model-generation-request.schema.json", import.meta.url), "utf8"));
  const response = JSON.parse(await readFile(new URL("../schemas/model-generation-response.schema.json", import.meta.url), "utf8"));
  const snapshot = JSON.parse(await readFile(new URL("../schemas/generation-snapshot.schema.json", import.meta.url), "utf8"));
  const event = JSON.parse(await readFile(new URL("../schemas/generation-snapshot-event.schema.json", import.meta.url), "utf8"));
  assert.equal(request.additionalProperties, false);
  assert.equal(request.properties.payload.additionalProperties, false);
  assert.equal(Object.hasOwn(request.properties.payload.properties, "assessmentId"), false);
  assert.equal(response.additionalProperties, false);
  assert.equal(response.properties.narratives.additionalProperties, false);
  assert.equal(snapshot.properties.provider.properties.phiApproved.const, false);
  assert.deepEqual(event.properties.type.enum, ["generated", "migration-materialized"]);
});
