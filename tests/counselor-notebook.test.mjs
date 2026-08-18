import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  COUNSELOR_NOTEBOOK_BOUNDARY,
  COUNSELOR_NOTEBOOK_CONTRACT,
  COUNSELOR_NOTEBOOK_DISPOSITIONS,
  COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES,
  COUNSELOR_NOTEBOOK_FINDINGS,
  COUNSELOR_NOTEBOOK_SESSIONS,
  buildCounselorNotebook,
  createCounselorNotebookEntry,
  validateCounselorNotebookContract,
  validateCounselorNotebookEntry,
  validateCounselorNotebookInput
} from "../src/counselor-notebook.js";

const evidenceSnapshot = {
  counts: {
    pairedBlindComparisons: 0,
    structuredFeedbackEntries: 0,
    revisions: 0,
    workflowTimingObservations: 0,
    openSafetyIncidents: 0
  },
  heads: {
    feedback: null,
    revisions: null,
    blindOutcomes: null,
    incidents: null,
    workflowTiming: null
  },
  caseSet: { id: "perl-synthetic-rehearsal-2026-08-v1", version: "1.0.0" },
  sourceContractStatus: "proposed-rfi-only"
};

const input = {
  sessionId: "language-safety",
  decisionId: "indicator-language",
  disposition: "revise-before-next-rehearsal",
  finding: "overreach-risk",
  evidenceSource: "synthetic-regression",
  assessmentId: "FF-TEST-2407-A"
};

test("counselor notebook fixes three sessions and fifteen structured decisions", () => {
  assert.equal(COUNSELOR_NOTEBOOK_CONTRACT, "perl-counselor-session-notebook/1.0");
  assert.deepEqual(validateCounselorNotebookContract(), []);
  assert.equal(COUNSELOR_NOTEBOOK_SESSIONS.length, 3);
  assert.equal(COUNSELOR_NOTEBOOK_SESSIONS.flatMap(session => session.decisions).length, 15);
  assert.equal(COUNSELOR_NOTEBOOK_DISPOSITIONS.length, 4);
  assert.equal(COUNSELOR_NOTEBOOK_FINDINGS.length, 7);
  assert.equal(COUNSELOR_NOTEBOOK_EVIDENCE_SOURCES.length, 8);
  assert.match(COUNSELOR_NOTEBOOK_BOUNDARY, /no counselor names/i);
  assert.match(COUNSELOR_NOTEBOOK_BOUNDARY, /does not authenticate a counselor/i);
});

test("notebook input is enum-only and rejects cross-session or unknown fields", () => {
  assert.deepEqual(validateCounselorNotebookInput(input), []);
  assert.match(validateCounselorNotebookInput({ ...input, decisionId: "workflow-time" }).join(" "), /selected session/i);
  assert.match(validateCounselorNotebookInput({ ...input, narrative: "free text" }).join(" "), /unsupported fields/i);
  assert.match(validateCounselorNotebookInput({ ...input, assessmentId: "PATIENT-123" }).join(" "), /visibly synthetic/i);
});

test("a notebook entry pins evidence while every clinical and authority claim stays false", () => {
  const entry = createCounselorNotebookEntry({
    input,
    actor: "REVIEWER-01",
    sequence: 1,
    previousHash: "GENESIS",
    evidenceSnapshot,
    createdAt: "2026-08-14T12:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111"
  });
  assert.deepEqual(validateCounselorNotebookEntry(entry), []);
  for (const key of [
    "counselorIdentityVerified", "attendanceRecorded", "trainingCompleted", "clinicalDecisionAccepted",
    "counselorReferenceAccepted", "protocolFrozen", "independentReviewCompleted", "accuracyEstablished",
    "reliabilityEstablished", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
  ]) assert.equal(entry[key], false);
  const altered = structuredClone(entry);
  altered.protocolFrozen = true;
  assert.match(validateCounselorNotebookEntry(altered).join(" "), /protocolFrozen must remain false|hash is invalid/i);
});

test("notebook status keeps append-only history and derives current decision coverage", () => {
  const first = createCounselorNotebookEntry({ input, actor: "REVIEWER-01", sequence: 1, evidenceSnapshot, createdAt: "2026-08-14T12:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" });
  const second = createCounselorNotebookEntry({
    input: { ...input, disposition: "carry-forward-for-rehearsal", finding: "source-supported" },
    actor: "REVIEWER-02",
    sequence: 2,
    previousHash: first.hash,
    evidenceSnapshot,
    createdAt: "2026-08-14T12:05:00.000Z",
    id: "22222222-2222-4222-8222-222222222222"
  });
  const notebook = buildCounselorNotebook({ entries: [first, second], chain: { valid: true, count: 2, head: second.hash }, assessmentIds: ["FF-TEST-2407-A", "PERSON-1"] });
  assert.equal(notebook.metrics.notesRecorded, 2);
  assert.equal(notebook.metrics.decisionsCovered, 1);
  assert.equal(notebook.metrics.sessionsTouched, 1);
  assert.equal(notebook.metrics.stoppingConcerns, 0);
  assert.equal(notebook.sessions[0].decisions[0].status, "carry-forward-for-rehearsal");
  assert.deepEqual(notebook.allowedAssessmentIds, ["FF-TEST-2407-A"]);
  assert.equal(notebook.protocolFrozen, false);
  assert.equal(notebook.history.length, 2);
});

test("published notebook schema hard-codes non-authorizing evidence", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/counselor-session-notebook-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, COUNSELOR_NOTEBOOK_CONTRACT);
  assert.equal(schema.properties.type.const, "counselor-session-rehearsal-note-recorded");
  assert.equal(schema.properties.assessmentId.oneOf[0].type, "null");
  for (const key of [
    "counselorIdentityVerified", "attendanceRecorded", "trainingCompleted", "clinicalDecisionAccepted",
    "counselorReferenceAccepted", "protocolFrozen", "independentReviewCompleted", "accuracyEstablished",
    "reliabilityEstablished", "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
  ]) assert.equal(schema.properties[key].const, false);
});
