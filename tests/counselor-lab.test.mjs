import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCounselorLab,
  COUNSELOR_LAB_BOUNDARY,
  COUNSELOR_LAB_CONTRACT,
  validateCounselorLabContract
} from "../src/counselor-lab.js";

const analysis = {
  sample: {
    reviewers: 2,
    pairedComparisons: 5,
    feedbackEntries: 3,
    revisions: 2,
    workflowTimingObservations: 4
  },
  caseSet: {
    id: "perl-synthetic-rehearsal-2026-08-v1",
    version: "1.0.0",
    cases: 3,
    holdoutValid: false
  },
  safety: { unresolvedHighSeverity: 0 },
  integrity: {
    feedback: { valid: true, count: 3 },
    revisions: { valid: true, count: 2 },
    blindOutcomes: { valid: true, count: 5 },
    incidents: { valid: true, count: 0 },
    workflowTiming: { valid: true, count: 4 }
  },
  releaseDecision: { clinicalReleaseEligible: false }
};

const refinement = { signals: [{ id: "feedback:overreach" }] };
const manifestPackage = {
  manifest: { id: "perl-synthetic-rehearsal-2026-08-v1", version: "1.0.0" },
  integrity: { manifestHash: "b".repeat(64) }
};

test("Counselor Lab fixes a source-backed three-session working sequence", () => {
  assert.deepEqual(validateCounselorLabContract(), []);
  const lab = buildCounselorLab({ analysis, refinement, manifestPackage, generatedAt: "2026-08-14T00:00:00.000Z" });
  assert.equal(lab.contractVersion, COUNSELOR_LAB_CONTRACT);
  assert.equal(lab.strategy.selectedSessionCount, 3);
  assert.equal(lab.strategy.permittedRange, "2–3 guided sessions");
  assert.deepEqual(lab.sessions.map(item => item.id), ["language-safety", "usefulness-workflow", "freeze-handoff"]);
  assert.ok(lab.sessions.every(item => item.agenda.length === 4 && item.outputs.length >= 4));
  assert.equal(lab.preflightReturns.length, 8);
  assert.equal(lab.sourceBasis.length, 3);
  assert.equal(lab.boundary, COUNSELOR_LAB_BOUNDARY);
  assert.match(lab.packetFingerprint, /^[a-f0-9]{64}$/);
});

test("Counselor Lab reports synthetic evidence without inventing a counselor roster or session history", () => {
  const lab = buildCounselorLab({ analysis, refinement, manifestPackage });
  assert.equal(lab.status, "awaiting-named-counselor-panel");
  assert.equal(lab.currentEvidence.sourceReportedCounselorsAvailable, true);
  assert.equal(lab.currentEvidence.namedCounselorsRegistered, 0);
  assert.equal(lab.currentEvidence.authenticatedClinicalReviewers, 0);
  assert.equal(lab.currentEvidence.sandboxReviewerCodesObserved, 2);
  assert.equal(lab.currentEvidence.sessionsScheduled, 0);
  assert.equal(lab.currentEvidence.sessionsCompleted, 0);
  assert.equal(lab.currentEvidence.syntheticCases, 3);
  assert.equal(lab.currentEvidence.pairedBlindComparisons, 5);
  assert.equal(lab.currentEvidence.evidenceStreamsWithEntries, 4);
  assert.equal(lab.currentEvidence.refinementSignals, 1);
  assert.equal(lab.currentEvidence.manifestHash, "b".repeat(64));
  assert.equal(lab.currentEvidence.holdoutValid, false);
  assert.equal(lab.sessions[1].status, "synthetic-rehearsal-available");
});

test("Counselor Lab leaves every external, clinical, and release claim false", () => {
  const lab = buildCounselorLab({ analysis, refinement, manifestPackage });
  for (const field of [
    "rosterAccepted",
    "attendanceRecorded",
    "trainingCompleted",
    "counselorReferencesAccepted",
    "protocolFrozen",
    "independentReviewComplete",
    "accuracyEstablished",
    "reliabilityEstablished",
    "clinicalValidation",
    "pilotAuthorizationRecorded",
    "productionReleaseAuthorized",
    "patientUseAuthorized"
  ]) assert.equal(lab[field], false, `${field} must remain false`);
  assert.ok(lab.sessions.every(item => item.attendanceRecorded === false && item.accepted === false && item.completed === false));
  assert.match(lab.boundary, /does not register or authenticate/i);
  assert.match(lab.nextDecision, /before Session 01/i);
});

test("Counselor Lab fingerprint is stable across generation times", () => {
  const one = buildCounselorLab({ analysis, refinement, manifestPackage, generatedAt: "2026-08-14T00:00:00.000Z" });
  const two = buildCounselorLab({ analysis, refinement, manifestPackage, generatedAt: "2027-01-01T00:00:00.000Z" });
  assert.notEqual(one.generatedAt, two.generatedAt);
  assert.equal(one.packetFingerprint, two.packetFingerprint);
});
