import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalibrationIntake,
  CALIBRATION_INTAKE_BOUNDARY,
  CALIBRATION_INTAKE_CONTRACT,
  validateCalibrationIntakeContract
} from "../src/calibration-intake.js";

const analysis = {
  caseSet: {
    id: "perl-synthetic-rehearsal-2026-08-v1",
    version: "1.0.0",
    cases: 3,
    partitionCoverage: {
      development: { cases: 2, reviewedCases: 1 },
      holdout: { cases: 1, reviewedCases: 0 }
    },
    stratumCoverage: {
      "low-signal": { cases: 0, reviewedCases: 0 },
      "contained-domain": { cases: 2, reviewedCases: 1 },
      "broad-burden": { cases: 1, reviewedCases: 0 },
      "critical-screen": { cases: 1, reviewedCases: 0 }
    },
    missingStrata: ["low-signal"],
    holdoutValid: false
  }
};

const manifestPackage = {
  manifest: { id: "perl-synthetic-rehearsal-2026-08-v1", version: "1.0.0" },
  integrity: { manifestHash: "a".repeat(64) }
};

test("calibration intake fixes the five-lane, nine-return, aggregate-only contract", () => {
  assert.deepEqual(validateCalibrationIntakeContract(), []);
  const intake = buildCalibrationIntake({ analysis, manifestPackage, generatedAt: "2026-08-14T00:00:00.000Z" });
  assert.equal(intake.contractVersion, CALIBRATION_INTAKE_CONTRACT);
  assert.equal(intake.lanes.length, 5);
  assert.equal(intake.requiredReturns.length, 9);
  assert.equal(intake.prohibitedContent.length, 5);
  assert.equal(intake.sourceReport.reportedAssessmentCount, 600);
  assert.equal(intake.sourceReport.reportedClinicalQualityPercent, 80);
  assert.equal(intake.sourceReport.reportedMarketingNoisePercent, 20);
  assert.match(intake.sourceReport.status, /not-received/);
  assert.match(intake.packetFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(intake.boundary, CALIBRATION_INTAKE_BOUNDARY);
});

test("calibration intake derives current synthetic coverage without turning it into a real cohort", () => {
  const intake = buildCalibrationIntake({ analysis, manifestPackage, generatedAt: "2026-08-14T00:00:00.000Z" });
  assert.equal(intake.status, "source-data-not-received");
  assert.equal(intake.currentSandbox.cases, 3);
  assert.equal(intake.currentSandbox.developmentCases, 2);
  assert.equal(intake.currentSandbox.holdoutRehearsalCases, 1);
  assert.equal(intake.currentSandbox.reviewedCases, 1);
  assert.equal(intake.currentSandbox.presentStrata, 3);
  assert.equal(intake.currentSandbox.targetStrata, 4);
  assert.deepEqual(intake.currentSandbox.missingStrata, ["low-signal"]);
  assert.equal(intake.currentSandbox.manifestHash, "a".repeat(64));
  assert.equal(intake.currentSandbox.holdoutValid, false);
  assert.equal(intake.currentSandbox.clinicalValidation, false);
});

test("calibration intake keeps every external and clinical claim false", () => {
  const intake = buildCalibrationIntake({ analysis, manifestPackage });
  for (const field of [
    "recordsReceived",
    "recordLevelIntakeEnabled",
    "phiApproved",
    "deidentificationAccepted",
    "sourceAuthorityAccepted",
    "holdoutValid",
    "counselorReferencesAccepted",
    "clinicalValidation",
    "trainingDatasetCreated",
    "productionDataConnected",
    "pilotAuthorizationRecorded"
  ]) assert.equal(intake[field], false, `${field} must remain false`);
  assert.equal(intake.recordsInspected, 0);
  assert.match(intake.boundary, /does not confirm/i);
  assert.match(intake.nextDecision, /before any record-level transfer/i);
});
