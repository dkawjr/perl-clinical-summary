import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCalibration, binaryGwetAc1, describe, wilsonInterval } from "../src/calibration-analysis.js";

test("descriptive summaries report mean, median, and spread", () => {
  assert.deepEqual(describe([1, 2, 3, 4, 5]), {
    n: 5,
    mean: 3,
    median: 3,
    q1: 2,
    q3: 4,
    min: 1,
    max: 5
  });
  assert.equal(describe([]).median, null);
});

test("preference uncertainty uses a Wilson 95 percent interval", () => {
  const interval = wilsonInterval(5, 10);
  assert.equal(interval.estimate, 0.5);
  assert.ok(Math.abs(interval.lower - 0.2366) < 0.0002);
  assert.ok(Math.abs(interval.upper - 0.7634) < 0.0002);
  assert.equal(interval.method, "Wilson score");
  assert.equal(wilsonInterval(0, 0), null);
});

test("binary Gwet AC1 reports observed and chance agreement", () => {
  const agreement = binaryGwetAc1({ agreeingPairs: 2, reviewerPairs: 2, perlEndpoints: 2, totalEndpoints: 4 });
  assert.equal(agreement.observedAgreement, 1);
  assert.equal(agreement.chanceAgreement, 0.5);
  assert.equal(agreement.coefficient, 1);
  assert.equal(binaryGwetAc1({ agreeingPairs: 0, reviewerPairs: 0, perlEndpoints: 0, totalEndpoints: 0 }), null);
});

test("small synthetic samples remain explicitly exploratory", () => {
  const analysis = analyzeCalibration({
    comparisons: [{
      preferredAuthor: "perl-generated",
      authorMapping: { A: "perl-generated", B: "human-reference" },
      ratings: { A: { accuracy: 5, restraint: 4, utility: 4 }, B: { accuracy: 4, restraint: 5, utility: 3 } },
      accuracy: 5,
      restraint: 4,
      utility: 4,
      actor: "Reviewer A",
      assessmentId: "FF-TEST-A"
    }],
    assessments: [{ id: "FF-TEST-A" }]
  });
  assert.equal(analysis.status, "exploratory");
  assert.equal(analysis.inferenceReady, false);
  assert.equal(analysis.clinicalValidation, false);
  assert.equal(analysis.ratings.accuracy.median, 5);
  assert.ok(analysis.limitations.some(item => /Synthetic cases/.test(item)));
});

test("protocol threshold requires volume, multiple reviewers, and balanced positions", () => {
  const comparisons = Array.from({ length: 60 }, (_, index) => {
    const perlInA = index < 30;
    const perlRatings = { accuracy: 5, restraint: 4, utility: 4 };
    const counselorRatings = { accuracy: 4, restraint: 5, utility: 3 };
    return {
      preferredAuthor: index < 36 ? "perl-generated" : "human-reference",
      authorMapping: perlInA
        ? { A: "perl-generated", B: "human-reference" }
        : { A: "human-reference", B: "perl-generated" },
      ratings: perlInA ? { A: perlRatings, B: counselorRatings } : { A: counselorRatings, B: perlRatings },
      accuracy: index < 36 ? 5 : 4,
      restraint: index < 36 ? 4 : 5,
      utility: index < 36 ? 4 : 3,
      reviewTiming: { activeSeconds: 540 + (index % 5) * 60, pausedSeconds: 0, eligible: true },
      actor: index < 30 ? "Reviewer A" : "Reviewer B",
      assessmentId: `FF-TEST-${String(index % 30).padStart(2, "0")}`
    };
  });
  const analysis = analyzeCalibration({ comparisons });
  assert.equal(analysis.inferenceReady, true);
  assert.equal(analysis.status, "protocol-threshold-met");
  assert.equal(analysis.preference.perlPositionA, 30);
  assert.equal(analysis.preference.perlPositionB, 30);
  assert.equal(analysis.preference.perlRate, 0.6);
  assert.equal(analysis.sample.pairedComparisons, 60);
  assert.equal(analysis.ratings.byAuthor.perlGenerated.accuracy.mean, 5);
  assert.equal(analysis.ratings.byAuthor.counselorReference.accuracy.mean, 4);
  assert.equal(analysis.ratings.difference.accuracy.mean, 1);
  assert.equal(analysis.ratings.difference.restraint.mean, -1);
  assert.equal(analysis.agreement.ready, true);
  assert.equal(analysis.agreement.casesWithMultipleReviewers, 30);
  assert.equal(analysis.agreement.reviewerPairs, 30);
  assert.equal(analysis.agreement.preference.observedAgreement, 0.2);
  assert.equal(analysis.agreement.preference.coefficient, -0.5385);
  assert.equal(analysis.agreement.ratingAbsoluteDifference.perlGenerated.accuracy.mean, 0);
  assert.equal(analysis.timing.ready, true);
  assert.equal(analysis.timing.protocolEligibleMinutes.mean, 11);
  assert.equal(analysis.timing.protocolEligibleMinutes.median, 11);
  assert.equal(analysis.clinicalValidation, false);
});

test("an unresolved high-severity incident overrides an otherwise ready protocol gate", () => {
  const comparisons = Array.from({ length: 60 }, (_, index) => ({
    preferredAuthor: "perl-generated",
    authorMapping: index < 30
      ? { A: "perl-generated", B: "human-reference" }
      : { A: "human-reference", B: "perl-generated" },
    ratings: index < 30
      ? { A: { accuracy: 4, restraint: 4, utility: 4 }, B: { accuracy: 4, restraint: 4, utility: 4 } }
      : { A: { accuracy: 4, restraint: 4, utility: 4 }, B: { accuracy: 4, restraint: 4, utility: 4 } },
    accuracy: 4,
    restraint: 4,
    utility: 4,
    reviewTiming: { activeSeconds: 600, pausedSeconds: 0, eligible: true },
    actor: index < 30 ? "Reviewer A" : "Reviewer B",
    assessmentId: `FF-TEST-${String(index % 30).padStart(2, "0")}`
  }));
  const analysis = analyzeCalibration({
    comparisons,
    incidents: [{ id: "incident-1", severity: "critical", status: "open" }]
  });
  assert.equal(analysis.agreement.ready, true);
  assert.equal(analysis.safety.ready, false);
  assert.equal(analysis.safety.unresolvedHighSeverity, 1);
  assert.equal(analysis.inferenceReady, false);
  assert.equal(analysis.status, "exploratory");
});

test("review timing retains flagged observations but separates the protocol summary", () => {
  const base = {
    preferredAuthor: "perl-generated",
    authorMapping: { A: "perl-generated", B: "human-reference" },
    ratings: { A: { accuracy: 4, restraint: 4, utility: 4 }, B: { accuracy: 4, restraint: 4, utility: 4 } },
    accuracy: 4,
    restraint: 4,
    utility: 4,
    actor: "Reviewer A",
    assessmentId: "FF-TEST-TIMING"
  };
  const analysis = analyzeCalibration({ comparisons: [
    { ...base, reviewTiming: { activeSeconds: 12, pausedSeconds: 0, eligible: false } },
    { ...base, actor: "Reviewer B", reviewTiming: { activeSeconds: 600, pausedSeconds: 120, eligible: true } }
  ] });
  assert.equal(analysis.timing.captured, 2);
  assert.equal(analysis.timing.eligible, 1);
  assert.equal(analysis.timing.flagged, 1);
  assert.equal(analysis.timing.allObservedMinutes.mean, 5.1);
  assert.equal(analysis.timing.protocolEligibleMinutes.median, 10);
  assert.equal(analysis.timing.pausedSeconds, 120);
  assert.match(analysis.timing.interpretation, /All observations are retained/);
});

test("safety event exposure always names its completed-comparison denominator", () => {
  const comparison = {
    caseId: "case-a",
    preferredAuthor: "perl-generated",
    authorMapping: { A: "perl-generated", B: "human-reference" },
    ratings: { A: { accuracy: 4, restraint: 4, utility: 4 }, B: { accuracy: 4, restraint: 4, utility: 4 } },
    accuracy: 4,
    restraint: 4,
    utility: 4,
    actor: "Reviewer A",
    assessmentId: "FF-TEST-SAFETY"
  };
  const analysis = analyzeCalibration({
    comparisons: [comparison, { ...comparison, caseId: "case-b", actor: "Reviewer B" }],
    incidents: [
      { caseId: "case-a", category: "invented-evidence", severity: "moderate", status: "open" },
      { category: "diagnostic-overreach", severity: "moderate", status: "open" }
    ]
  });
  assert.equal(analysis.safety.exposure.completedBlindComparisons, 2);
  assert.equal(analysis.safety.exposure.reportedEvents, 1);
  assert.equal(analysis.safety.exposure.eventsPer100CompletedComparisons, 50);
  assert.equal(analysis.safety.exposure.eventsOutsideCompletedComparisonExposure, 1);
  assert.equal(analysis.safety.exposure.byCategory["invented-evidence"].reportedEvents, 1);
  assert.match(analysis.safety.exposure.interpretation, /not unique affected-case rates/);
});
