import { canonicalDigest } from "./eqpass-adapter.js";

export const EQPASS_ATTACHMENT_RFI_CONTRACT = "eqpass-perl-attachment/rfi-0.1";
export const EQPASS_ATTACHMENT_RFI_STATUS = "proposed-rfi-only";

const SYNTHETIC_REF = /^FF-TEST-[A-Z0-9-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64 = /^[a-f0-9]{64}$/;

export function validateSyntheticAttachmentRequest(request) {
  const errors = [];
  const allowed = ["contractVersion", "environment", "assessmentId", "reportArtifactId", "reportArtifactHash", "idempotencyKey"];
  if (!request || typeof request !== "object" || Array.isArray(request)) return ["Attachment request must be an object."];
  const unknown = Object.keys(request).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.hasOwn(request, key));
  if (unknown.length) errors.push(`Attachment request contains fields outside the proposed contract: ${unknown.join(", ")}.`);
  if (missing.length) errors.push(`Attachment request is missing: ${missing.join(", ")}.`);
  if (request.contractVersion !== EQPASS_ATTACHMENT_RFI_CONTRACT) errors.push(`contractVersion must be ${EQPASS_ATTACHMENT_RFI_CONTRACT}.`);
  if (request.environment !== "calibration") errors.push("The local attachment rehearsal accepts calibration requests only.");
  if (typeof request.assessmentId !== "string" || !SYNTHETIC_REF.test(request.assessmentId)) errors.push("assessmentId must be an approved synthetic reference.");
  if (typeof request.reportArtifactId !== "string" || !UUID.test(request.reportArtifactId)) errors.push("reportArtifactId must be the UUID of an approved report artifact.");
  if (typeof request.reportArtifactHash !== "string" || !HEX_64.test(request.reportArtifactHash)) errors.push("reportArtifactHash must be a lowercase SHA-256 digest.");
  if (typeof request.idempotencyKey !== "string" || !SYNTHETIC_REF.test(request.idempotencyKey) || request.idempotencyKey.length < 20 || request.idempotencyKey.length > 240) {
    errors.push("idempotencyKey must be a 20–240 character synthetic reference beginning FF-TEST-.");
  }
  return errors;
}

export function attachmentRequestProvenance(request) {
  const errors = validateSyntheticAttachmentRequest(request);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 400 });
  return {
    requestHash: canonicalDigest(request),
    idempotencyKeyHash: canonicalDigest(request.idempotencyKey)
  };
}
