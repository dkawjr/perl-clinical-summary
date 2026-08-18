import test from "node:test";
import assert from "node:assert/strict";
import { buildRefinementBrief, REFINEMENT_CONTRACT } from "../src/refinement-analysis.js";

function feedback(id, assessmentId, actor, reason) {
  return { id, assessmentId, actor, reasons: [reason], note: "", createdAt: "2026-08-13T12:00:00.000Z" };
}

test("refinement signals require repeated independent cases and reviewers", () => {
  const brief = buildRefinementBrief({
    feedback: [
      feedback("F-1", "CASE-1", "REVIEWER-1", "overreach"),
      feedback("F-2", "CASE-2", "REVIEWER-1", "overreach"),
      feedback("F-3", "CASE-3", "REVIEWER-2", "overreach")
    ],
    generatedAt: "2026-08-13T12:00:00.000Z"
  });
  const signal = brief.signals.find(item => item.id === "feedback:overreach");
  assert.equal(brief.contract, REFINEMENT_CONTRACT.id);
  assert.equal(signal.status, "evidence-threshold-met");
  assert.equal(signal.candidateEligible, true);
  assert.equal(signal.caseIds.length, 3);
  assert.equal(signal.reviewers.length, 2);
  assert.equal(brief.clinicalValidation, false);
  assert.match(brief.claimBoundary, /may not change clinical logic automatically/i);
});

test("single-reviewer patterns remain evidence collection, not change instructions", () => {
  const brief = buildRefinementBrief({
    feedback: [
      feedback("F-1", "CASE-1", "REVIEWER-1", "tone"),
      feedback("F-2", "CASE-2", "REVIEWER-1", "tone"),
      feedback("F-3", "CASE-3", "REVIEWER-1", "tone")
    ]
  });
  const signal = brief.signals[0];
  assert.equal(signal.status, "collect-more-evidence");
  assert.equal(signal.candidateEligible, false);
  assert.match(signal.nextEvidence, /1 more reviewer/i);
});

test("an unresolved high-severity incident blocks every refinement candidate", () => {
  const brief = buildRefinementBrief({
    feedback: [
      feedback("F-1", "CASE-1", "REVIEWER-1", "usefulness"),
      feedback("F-2", "CASE-2", "REVIEWER-1", "usefulness"),
      feedback("F-3", "CASE-3", "REVIEWER-2", "usefulness")
    ],
    incidents: [{
      id: "I-1",
      assessmentId: "CASE-1",
      category: "critical-screen-omission",
      severity: "high",
      status: "open",
      reportedBy: "SAFETY-1"
    }]
  });
  assert.equal(brief.status, "safety-paused");
  assert.equal(brief.coverage.unresolvedHighSeverity, 1);
  assert.ok(brief.signals.every(item => item.candidateEligible === false));
  assert.equal(brief.signals[0].status, "safety-escalation");
});
