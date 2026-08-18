import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  INTEGRATION_REHEARSAL_BOUNDARY,
  INTEGRATION_REHEARSAL_CONTRACT,
  buildIntegrationRehearsalObservatory,
  buildSyntheticIntegrationRehearsalEvent
} from "../src/integration-rehearsal.js";
import { validateSyntheticEqpassEvent } from "../src/eqpass-adapter.js";

const hex = character => character.repeat(64);

function provider(overrides = {}) {
  return {
    id: "candidate-alpha",
    version: "2026.08.1",
    mode: "structured-candidate",
    promptVersion: "perl-prompt/1.0",
    policyVersion: "perl-clinical-generation-policy/1.0",
    policyHash: hex("a"),
    outputSchemaVersion: "perl-generation-bundle/1.0",
    externalTransmission: true,
    ...overrides
  };
}

function advancement(overrides = {}) {
  const loaded = provider();
  return {
    exactCandidateAdvancedToIntegrationReadiness: true,
    candidateIdentity: {
      disclosed: true,
      candidateFingerprint: hex("b"),
      providerId: loaded.id,
      modelVersion: loaded.version,
      promptVersion: loaded.promptVersion,
      outputContract: loaded.outputSchemaVersion,
      policyVersion: loaded.policyVersion,
      policyHash: loaded.policyHash
    },
    candidateAdvancement: { freezeFingerprint: hex("c") },
    airlockFingerprint: hex("d"),
    ...overrides
  };
}

function fullFixture(overrides = {}) {
  const loaded = provider();
  const assessmentId = "FF-TEST-AUTOMATION-ABCDEF0123456789";
  return {
    sourceEvents: [{ assessmentId, hash: hex("1"), createdAt: "2026-08-14T12:00:00.000Z" }],
    generationRecords: [{
      id: "generation-1",
      assessmentId,
      provider: loaded,
      bundle: { narratives: { clinician: { text: "private generated prose" } } },
      hash: hex("2"),
      createdAt: "2026-08-14T12:00:01.000Z"
    }],
    activeGenerations: { [assessmentId]: "generation-1" },
    reviews: { [assessmentId]: { status: "approved", approvedAt: "2026-08-14T12:05:00.000Z" } },
    reportArtifacts: [{ id: "artifact-1", assessmentId, type: "approved", hash: hex("3"), createdAt: "2026-08-14T12:05:01.000Z" }],
    attachmentEvents: [{ assessmentId, reportArtifactHash: hex("3"), hash: hex("4"), createdAt: "2026-08-14T12:05:02.000Z" }],
    automationEvents: [{ assessmentId, type: "handoff-prepared", hash: hex("5"), createdAt: "2026-08-14T12:05:02.000Z" }],
    deliveryJobs: [{ id: "delivery-1", assessmentId, hash: hex("6"), createdAt: "2026-08-14T12:05:03.000Z" }],
    deliveryEvents: [{ jobId: "delivery-1", type: "delivery-queued", hash: hex("7"), createdAt: "2026-08-14T12:05:03.000Z" }],
    activeDeliveries: { [assessmentId]: "delivery-1" },
    provider: loaded,
    advancement: advancement(),
    connector: { enabled: false },
    chains: Object.fromEntries(["sourceEvents", "generationSnapshots", "reportArtifacts", "providerWorkflow", "attachmentPreparation", "deliveryOutbox", "candidateAdvancement"].map((key, index) => [key, { valid: true, head: String(index + 1).repeat(64).slice(0, 64) }])),
    generatedAt: "2026-08-14T12:06:00.000Z",
    ...overrides
  };
}

test("synthetic launcher creates a unique strict e-QPASS rehearsal event", async () => {
  const template = JSON.parse(await readFile(new URL("../examples/synthetic-eqpass-scored-event.json", import.meta.url), "utf8"));
  const event = buildSyntheticIntegrationRehearsalEvent(template, {
    token: "ABCDEF0123456789",
    occurredAt: "2026-08-14T12:00:00.000Z"
  });
  assert.deepEqual(validateSyntheticEqpassEvent(event), []);
  assert.equal(event.sourceAssessment.assessmentRef, "FF-TEST-AUTOMATION-ABCDEF0123456789");
  assert.equal(event.findingsReport.sha256.length, 64);
  assert.notEqual(event.findingsReport.sha256, template.findingsReport.sha256);
  assert.throws(() => buildSyntheticIntegrationRehearsalEvent(template, { token: "unsafe" }), /uppercase hexadecimal/i);
});

test("observatory traces the complete prepared-and-held automation line without exposing generated prose", () => {
  const observatory = buildIntegrationRehearsalObservatory(fullFixture());
  assert.equal(observatory.contractVersion, INTEGRATION_REHEARSAL_CONTRACT);
  assert.equal(observatory.integrity.valid, true);
  assert.equal(observatory.counts.runs, 1);
  assert.equal(observatory.counts.preparedAndHeld, 1);
  assert.equal(observatory.counts.exactCandidateMatches, 1);
  assert.equal(observatory.runs[0].status, "prepared-and-held");
  assert.equal(observatory.runs[0].completedStages, 5);
  assert.deepEqual(observatory.runs[0].stages.map(item => item.status), ["verified", "verified", "verified", "verified", "verified", "held"]);
  assert.equal(JSON.stringify(observatory).includes("private generated prose"), false);
  assert.equal(observatory.remoteWriteClaimed, false);
  assert.match(INTEGRATION_REHEARSAL_BOUNDARY, /does not ingest a Findings PDF/i);
});

test("observatory preserves a valid start timestamp for persisted source receipts", () => {
  const fixture = fullFixture();
  fixture.sourceEvents[0].receivedAt = fixture.sourceEvents[0].createdAt;
  delete fixture.sourceEvents[0].createdAt;
  const observatory = buildIntegrationRehearsalObservatory(fixture);
  assert.equal(observatory.runs[0].startedAt, "2026-08-14T12:00:00.000Z");
  assert.equal(observatory.runs[0].stages[0].at, "2026-08-14T12:00:00.000Z");
});

test("exact candidate mismatch is explicit and holds the run for attention", () => {
  const changed = provider({ version: "2026.08.2" });
  const fixture = fullFixture({
    provider: changed,
    generationRecords: [{
      id: "generation-1",
      assessmentId: "FF-TEST-AUTOMATION-ABCDEF0123456789",
      provider: changed,
      hash: hex("2"),
      createdAt: "2026-08-14T12:00:01.000Z"
    }]
  });
  const observatory = buildIntegrationRehearsalObservatory(fixture);
  assert.equal(observatory.providerPreflight.status, "exact-candidate-mismatch");
  assert.deepEqual(observatory.providerPreflight.mismatchedFields, ["modelVersion"]);
  assert.equal(observatory.runs[0].status, "attention");
  assert.equal(observatory.runs[0].stages[1].status, "attention");
});

test("deterministic baseline is clearly separated from exact candidate advancement", () => {
  const local = provider({ id: "deterministic-calibration", version: "cal-0.9.3", mode: "rules", externalTransmission: false });
  const observatory = buildIntegrationRehearsalObservatory({
    provider: local,
    advancement: null,
    chains: {},
    generatedAt: "2026-08-14T12:00:00.000Z"
  });
  assert.equal(observatory.providerPreflight.status, "deterministic-baseline");
  assert.equal(observatory.providerPreflight.exactMatch, false);
  assert.equal(observatory.providerPreflight.candidateTransportAuthorized, false);
  assert.equal(observatory.counts.runs, 0);
});

test("published observatory schema freezes the six stages and denied authority claims", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/integration-rehearsal-observatory.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contractVersion.const, INTEGRATION_REHEARSAL_CONTRACT);
  assert.equal(schema.properties.clinicalDecisionAutomated.const, false);
  assert.equal(schema.properties.findingsPdfIngested.const, false);
  assert.equal(schema.properties.remoteWriteClaimed.const, false);
  assert.equal(schema.$defs.run.properties.totalStages.const, 6);
  assert.deepEqual(schema.$defs.stage.properties.id.enum, ["findings", "generation", "clinical-review", "report", "handoff", "delivery"]);
  assert.equal(schema.$defs.binding.properties.candidateTransportAuthorized.const, false);
});
