import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CANDIDATE_TRIAL_ARMS,
  CANDIDATE_TRIAL_BOUNDARY,
  CANDIDATE_TRIAL_CONTRACT,
  CANDIDATE_TRIAL_GATES,
  CANDIDATE_TRIAL_MEASURES,
  buildCandidateTrialFoundry,
  createCandidateTrialSnapshot,
  validateCandidateTrialContract,
  validateCandidateTrialSnapshot
} from "../src/candidate-trial.js";

function evidenceSnapshot(metadataComplete = 0, clinicalDrafts = 0) {
  return {
    modelTrial: {
      status: metadataComplete === 3 ? "metadata-complete-external-review-required" : "awaiting-candidate-metadata",
      metadataComplete,
      slotsRequired: 3,
      eventCount: metadataComplete === 3 ? 1 : 0,
      chainHead: metadataComplete === 3 ? "a".repeat(64) : "GENESIS"
    },
    caseSet: {
      id: "perl-synthetic-rehearsal-2026-08-v1",
      version: "1.0.0",
      manifestHash: "b".repeat(64),
      caseIds: ["SYN-2026-001", "SYN-2026-002", "SYN-2026-003"],
      caseFingerprints: ["c".repeat(64), "d".repeat(64), "e".repeat(64)],
      syntheticCases: 3,
      frozen: true
    },
    modelInput: {
      contractVersion: "eqpass-perl-model-input/1.0",
      projection: "scoring-only",
      assessmentPayloadIncluded: false,
      recordLevelDataReceived: false,
      phiReceived: false
    },
    generation: {
      outputContract: "perl-clinical-generation-output/1.0",
      policyVersion: "perl-clinical-generation-policy/1.0",
      policyHash: "f".repeat(64),
      outputGateCount: 10,
      generationRecords: 3,
      chainHead: "1".repeat(64),
      externalTransmission: false
    },
    clinicalStandard: {
      draftCount: clinicalDrafts,
      chainHead: clinicalDrafts ? "2".repeat(64) : "GENESIS",
      accepted: false
    },
    counselorPanel: { registered: 0, rosterAccepted: false, credentialsVerified: false },
    candidateTransports: { required: 3, authorized: 0, configured: 0, externalCallsPerformed: false }
  };
}

test("candidate trial fixes three candidates, one reference, six measures, and seven gates", () => {
  assert.equal(CANDIDATE_TRIAL_CONTRACT, "perl-candidate-trial-protocol/1.0");
  assert.deepEqual(validateCandidateTrialContract(), []);
  assert.equal(CANDIDATE_TRIAL_ARMS.length, 4);
  assert.equal(CANDIDATE_TRIAL_ARMS.filter(arm => arm.kind === "engine-candidate").length, 3);
  assert.equal(CANDIDATE_TRIAL_ARMS.filter(arm => arm.kind === "human-reference").length, 1);
  assert.equal(CANDIDATE_TRIAL_MEASURES.length, 6);
  assert.equal(CANDIDATE_TRIAL_GATES.length, 7);
  assert.match(CANDIDATE_TRIAL_BOUNDARY, /nine held candidate runs and twelve blinded review cells/i);
  assert.match(CANDIDATE_TRIAL_BOUNDARY, /performs no provider call/i);
});

test("foundry predeclares nine runs and twelve balanced blind cells without content", () => {
  const foundry = buildCandidateTrialFoundry({ evidenceSnapshot: evidenceSnapshot() });
  assert.equal(foundry.status, "awaiting-candidate-metadata");
  assert.equal(foundry.runEnvelopes.length, 9);
  assert.equal(foundry.blindCells.length, 12);
  assert.equal(foundry.measures.length, 6);
  assert.equal(foundry.counts.candidateOutputsReceived, 0);
  assert.equal(foundry.runEnvelopes.every(run => run.assessmentPayloadIncluded === false && run.modelOutputIncluded === false && run.externalTransmission === false), true);
  assert.equal(foundry.blindCells.every(cell => cell.artifactIncluded === false && cell.reviewerIdentityIncluded === false), true);
  for (const caseId of foundry.evidenceSnapshot.caseSet.caseIds) {
    const cells = foundry.blindCells.filter(cell => cell.caseId === caseId);
    assert.deepEqual(new Set(cells.map(cell => cell.blindPosition)), new Set(["A", "B", "C", "D"]));
    assert.deepEqual(new Set(cells.map(cell => cell.armId)), new Set(CANDIDATE_TRIAL_ARMS.map(arm => arm.id)));
  }
  assert.equal(foundry.providerCallPerformed, false);
  assert.equal(foundry.engineSelected, false);
});

test("three complete metadata declarations advance planning but never authorize execution", () => {
  const foundry = buildCandidateTrialFoundry({ evidenceSnapshot: evidenceSnapshot(3, 1) });
  assert.equal(foundry.status, "pre-execution-authority-required");
  assert.equal(foundry.counts.candidateMetadataComplete, 3);
  assert.equal(foundry.gates.find(gate => gate.id === "three-candidate-shortlist").satisfied, true);
  assert.equal(foundry.gates.find(gate => gate.id === "pre-outcome-clinical-standard").state, "working-draft-recorded-not-accepted");
  assert.equal(foundry.gates.find(gate => gate.id === "authorized-candidate-transports").satisfied, false);
  assert.equal(foundry.trialExecutionAuthorized, false);
  assert.equal(foundry.candidateTransportAuthorized, false);
  assert.equal(foundry.clinicalStandardAccepted, false);
});

test("planning snapshots are hash-linked, evidence-pinned, and non-authorizing", () => {
  const foundry = buildCandidateTrialFoundry({ evidenceSnapshot: evidenceSnapshot() });
  const first = createCandidateTrialSnapshot({ foundry, actor: "TRIAL-OWNER-01", sequence: 1, createdAt: "2026-08-14T12:00:00.000Z" });
  assert.deepEqual(validateCandidateTrialSnapshot(first), []);
  const second = createCandidateTrialSnapshot({ foundry, actor: "TRIAL-OWNER-01", sequence: 2, previousHash: first.hash, createdAt: "2026-08-14T12:10:00.000Z" });
  assert.deepEqual(validateCandidateTrialSnapshot(second, { sequence: 2, previousHash: first.hash }), []);
  assert.equal(first.counts.candidateRunsPlanned, 9);
  assert.equal(first.counts.blindCellsPlanned, 12);
  assert.equal(first.providerCallPerformed, false);
  assert.equal(first.trialExecutionAuthorized, false);
});

test("candidate-trial validation fails closed on gate, authority, or evidence tampering", () => {
  const foundry = buildCandidateTrialFoundry({ evidenceSnapshot: evidenceSnapshot() });
  const event = createCandidateTrialSnapshot({ foundry, actor: "TRIAL-OWNER-01", sequence: 1 });
  assert.ok(validateCandidateTrialSnapshot({ ...event, engineSelected: true }).some(error => /engineSelected/i.test(error)));
  const gateChanged = structuredClone(event);
  gateChanged.gateSnapshot[4].satisfied = true;
  assert.ok(validateCandidateTrialSnapshot(gateChanged).some(error => /gate snapshot|fingerprint/i.test(error)));
  const transportChanged = structuredClone(event);
  transportChanged.evidenceSnapshot.candidateTransports.authorized = 1;
  assert.ok(validateCandidateTrialSnapshot(transportChanged).some(error => /transports|fingerprint/i.test(error)));
});

test("candidate-trial event schema fixes counts and denies content, calls, and authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/candidate-trial-planning-snapshot-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, CANDIDATE_TRIAL_CONTRACT);
  assert.equal(schema.properties.counts.properties.candidateRunsPlanned.const, 9);
  assert.equal(schema.properties.counts.properties.blindCellsPlanned.const, 12);
  assert.equal(schema.properties.gateSnapshot.minItems, 7);
  assert.equal(schema.properties.gateSnapshot.maxItems, 7);
  assert.equal(schema.properties.providerCallPerformed.const, false);
  assert.equal(schema.properties.modelOutputReceived.const, false);
  assert.equal(schema.properties.trialExecutionAuthorized.const, false);
  assert.equal(schema.properties.engineSelected.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});

