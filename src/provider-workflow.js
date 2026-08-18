export const PROVIDER_WORKFLOW_CONTRACT = "perl-provider-workflow/0.1";

export const PROVIDER_WORKFLOW_BOUNDARY =
  "Automation may queue review and prepare a synthetic handoff manifest after clinician approval. It does not attach a file, write to e-QPASS, authorize PHI, or bypass clinical judgment.";

export const PROVIDER_WORKFLOW_TYPES = Object.freeze([
  "review-queued",
  "handoff-queued",
  "handoff-prepared",
  "handoff-failed"
]);

export const PROVIDER_WORKFLOW_STATUSES = Object.freeze([
  "awaiting-review",
  "queued",
  "prepared-not-attached",
  "failed"
]);

export function automaticAttachmentRequest(assessmentId, artifact) {
  return {
    contractVersion: "eqpass-perl-attachment/rfi-0.1",
    environment: "calibration",
    assessmentId,
    reportArtifactId: artifact.id,
    reportArtifactHash: artifact.hash,
    idempotencyKey: `FF-TEST-AUTO-HANDOFF-${artifact.hash.slice(0, 32).toUpperCase()}`
  };
}
