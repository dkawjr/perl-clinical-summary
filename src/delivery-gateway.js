import { createHash, randomUUID } from "node:crypto";

export const DELIVERY_OUTBOX_CONTRACT = "perl-delivery-outbox/1.0";
export const DELIVERY_REQUEST_CONTRACT = "perl-attachment-delivery-request/0.1";
export const DELIVERY_ACK_CONTRACT = "perl-attachment-delivery-ack/0.1";
export const DELIVERY_MAX_ATTEMPTS = 3;

export const DELIVERY_BOUNDARY =
  "The local outbox may commit and rehearse synthetic delivery packages. It does not attach a file to e-QPASS, authorize PHI, or establish an authoritative production connector.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64 = /^[a-f0-9]{64}$/;
const SYNTHETIC_REF = /^FF-TEST-[A-Z0-9-]+$/;
const BOUNDED_LABEL = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [`${label} must be an object.`];
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.hasOwn(value, key));
  return [
    ...(unknown.length ? [`${label} contains undeclared fields: ${unknown.join(", ")}.`] : []),
    ...(missing.length ? [`${label} is missing: ${missing.join(", ")}.`] : [])
  ];
}

export function validateDeliveryRequest(request) {
  const allowed = [
    "contractVersion", "requestId", "environment", "assessmentId", "jobId", "idempotencyKey",
    "reportArtifactId", "reportArtifactHash", "preparationReceiptHash", "mediaType", "content",
    "contentHash", "provenance"
  ];
  const errors = exactKeys(request, allowed, "Delivery request");
  if (errors.length) return errors;
  if (request.contractVersion !== DELIVERY_REQUEST_CONTRACT) errors.push(`contractVersion must be ${DELIVERY_REQUEST_CONTRACT}.`);
  if (request.environment !== "calibration") errors.push("The local delivery gateway accepts calibration requests only.");
  if (!UUID.test(String(request.requestId || ""))) errors.push("requestId must be a UUID.");
  if (!SYNTHETIC_REF.test(String(request.assessmentId || ""))) errors.push("assessmentId must be an approved synthetic reference.");
  if (!UUID.test(String(request.jobId || ""))) errors.push("jobId must be a UUID.");
  if (!SYNTHETIC_REF.test(String(request.idempotencyKey || "")) || String(request.idempotencyKey || "").length < 20 || String(request.idempotencyKey || "").length > 240) {
    errors.push("idempotencyKey must be a 20–240 character synthetic reference beginning FF-TEST-.");
  }
  if (!UUID.test(String(request.reportArtifactId || ""))) errors.push("reportArtifactId must be a UUID.");
  for (const key of ["reportArtifactHash", "preparationReceiptHash", "contentHash"]) {
    if (!HEX_64.test(String(request[key] || ""))) errors.push(`${key} must be a lowercase SHA-256 digest.`);
  }
  if (request.mediaType !== "text/html") errors.push("mediaType must be text/html for this rehearsal.");
  if (typeof request.content !== "string" || request.content.length < 100) errors.push("content must contain the bounded rendered clinician attachment.");
  if (typeof request.content === "string" && Buffer.byteLength(request.content, "utf8") > 131072) errors.push("content exceeds the 128 KB delivery limit.");
  if (typeof request.content === "string" && HEX_64.test(String(request.contentHash || "")) && digest(request.content) !== request.contentHash) {
    errors.push("contentHash does not match the rendered attachment content.");
  }
  errors.push(...exactKeys(request.provenance, ["sourceEventReceiptHash", "findingsReportHash", "renderedContentHash"], "Delivery provenance"));
  for (const key of ["sourceEventReceiptHash", "findingsReportHash", "renderedContentHash"]) {
    if (!HEX_64.test(String(request.provenance?.[key] || ""))) errors.push(`provenance.${key} must be a lowercase SHA-256 digest.`);
  }
  if (request.provenance?.renderedContentHash && request.contentHash && request.provenance.renderedContentHash !== request.contentHash) {
    errors.push("provenance.renderedContentHash must match contentHash.");
  }
  return [...new Set(errors)];
}

export function validateDeliveryAcknowledgement(acknowledgement, request) {
  const allowed = [
    "contractVersion", "requestId", "jobId", "idempotencyKey", "environment", "status",
    "remoteWriteClaimed", "receiptId", "receivedAt"
  ];
  const errors = exactKeys(acknowledgement, allowed, "Delivery acknowledgement");
  if (errors.length) return errors;
  if (acknowledgement.contractVersion !== DELIVERY_ACK_CONTRACT) errors.push(`contractVersion must be ${DELIVERY_ACK_CONTRACT}.`);
  if (acknowledgement.requestId !== request.requestId) errors.push("Acknowledgement requestId does not match the delivery request.");
  if (acknowledgement.jobId !== request.jobId) errors.push("Acknowledgement jobId does not match the delivery request.");
  if (acknowledgement.idempotencyKey !== request.idempotencyKey) errors.push("Acknowledgement idempotencyKey does not match the delivery request.");
  if (acknowledgement.environment !== "calibration") errors.push("Acknowledgement environment must remain calibration.");
  if (acknowledgement.status !== "rehearsed-not-attached") errors.push("Synthetic acknowledgement status must be rehearsed-not-attached.");
  if (acknowledgement.remoteWriteClaimed !== false) errors.push("Synthetic acknowledgement must explicitly state that no remote write is claimed.");
  if (!SYNTHETIC_REF.test(String(acknowledgement.receiptId || ""))) errors.push("receiptId must be a visibly synthetic reference.");
  if (!Number.isFinite(Date.parse(String(acknowledgement.receivedAt || "")))) errors.push("receivedAt must be an ISO date-time.");
  return [...new Set(errors)];
}

export function buildDeliveryRequest({ job, artifact, attachment, renderedContent, requestId = randomUUID() }) {
  const request = {
    contractVersion: DELIVERY_REQUEST_CONTRACT,
    requestId,
    environment: "calibration",
    assessmentId: job.assessmentId,
    jobId: job.id,
    idempotencyKey: job.idempotencyKey,
    reportArtifactId: job.reportArtifactId,
    reportArtifactHash: job.reportArtifactHash,
    preparationReceiptHash: job.attachmentReceiptHash,
    mediaType: "text/html",
    content: renderedContent,
    contentHash: digest(renderedContent),
    provenance: {
      sourceEventReceiptHash: attachment.sourceEventReceiptHash,
      findingsReportHash: attachment.findingsReportHash,
      renderedContentHash: attachment.renderedContentHash
    }
  };
  const errors = validateDeliveryRequest(request);
  if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 409, code: "DELIVERY_REQUEST_REJECTED" });
  if (artifact.id !== request.reportArtifactId || artifact.hash !== request.reportArtifactHash) {
    throw Object.assign(new Error("The delivery job is not bound to the supplied report artifact."), { status: 409, code: "DELIVERY_REQUEST_REJECTED" });
  }
  if (attachment.hash !== request.preparationReceiptHash || attachment.reportArtifactHash !== artifact.hash) {
    throw Object.assign(new Error("The delivery job is not bound to the supplied preparation receipt."), { status: 409, code: "DELIVERY_REQUEST_REJECTED" });
  }
  return request;
}

export class DisabledDeliveryConnector {
  describe() {
    return {
      id: "disabled-eqpass-connector",
      version: "rfi-0.1",
      mode: "disabled",
      approvedBy: null,
      approvalScope: "none",
      authoritativeContract: false,
      phiApproved: false,
      externalTransmission: false,
      enabled: false,
      failureMode: "hold-without-attempt"
    };
  }

  async deliver() {
    throw Object.assign(new Error("The delivery connector is disabled pending an authoritative e-QPASS contract and explicit approval."), {
      status: 409,
      code: "DELIVERY_CONNECTOR_DISABLED"
    });
  }
}

export class StructuredDeliveryConnector {
  constructor({ transport, authorization, timeoutMs = 15000, clock = () => new Date() } = {}) {
    if (typeof transport !== "function") throw new Error("Structured delivery connector requires an injected transport function.");
    if (!authorization || authorization.status !== "approved-for-synthetic-calibration") {
      throw new Error("Structured delivery connector requires explicit synthetic-calibration authorization.");
    }
    for (const key of ["connectorId", "connectorVersion", "approvedBy"]) {
      if (!BOUNDED_LABEL.test(String(authorization[key] || ""))) throw new Error(`Structured delivery authorization requires a bounded ${key}.`);
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) throw new Error("Delivery timeout must be 500–30,000 milliseconds.");
    this.transport = transport;
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    this.id = authorization.connectorId;
    this.version = authorization.connectorVersion;
    this.approvedBy = authorization.approvedBy;
  }

  describe() {
    return {
      id: this.id,
      version: this.version,
      mode: "structured-candidate",
      approvedBy: this.approvedBy,
      approvalScope: "synthetic-calibration-only",
      authoritativeContract: false,
      phiApproved: false,
      externalTransmission: true,
      enabled: true,
      failureMode: "bounded-retry-no-fallback"
    };
  }

  async deliver(request) {
    const requestErrors = validateDeliveryRequest(request);
    if (requestErrors.length) throw Object.assign(new Error("Delivery request failed the connector boundary."), { status: 409, code: "DELIVERY_REQUEST_REJECTED" });
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error("Synthetic delivery timed out and was stopped safely."), { status: 504, code: "DELIVERY_TIMEOUT" }));
        }, this.timeoutMs);
      });
      const response = await Promise.race([this.transport(structuredClone(request), { signal: controller.signal }), timeout]);
      const serialized = typeof response === "string" ? response : JSON.stringify(response);
      if (Buffer.byteLength(serialized, "utf8") > 32768) throw Object.assign(new Error("Delivery acknowledgement exceeded the 32 KB contract limit."), { status: 502, code: "DELIVERY_ACK_REJECTED" });
      let acknowledgement;
      try {
        acknowledgement = typeof response === "string" ? JSON.parse(response) : structuredClone(response);
      } catch {
        throw Object.assign(new Error("Delivery acknowledgement was not valid structured JSON."), { status: 502, code: "DELIVERY_ACK_REJECTED" });
      }
      const errors = validateDeliveryAcknowledgement(acknowledgement, request);
      if (errors.length) throw Object.assign(new Error(`Delivery acknowledgement failed the contract (${errors.length} validation issue${errors.length === 1 ? "" : "s"}).`), { status: 502, code: "DELIVERY_ACK_REJECTED" });
      return acknowledgement;
    } catch (error) {
      if (["DELIVERY_TIMEOUT", "DELIVERY_ACK_REJECTED", "DELIVERY_REQUEST_REJECTED"].includes(error?.code)) throw error;
      throw Object.assign(new Error("The synthetic delivery connector was unavailable; no remote write is claimed."), { status: 502, code: "DELIVERY_UNAVAILABLE", cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createDeliveryConnector(options = {}) {
  const connector = options.connector || "disabled";
  if (connector === "disabled") return new DisabledDeliveryConnector();
  if (connector === "structured-candidate") return new StructuredDeliveryConnector(options);
  throw new Error(`Unsupported delivery connector: ${connector}`);
}

export function deliveryGatewayStatus(connector) {
  return {
    outboxContractVersion: DELIVERY_OUTBOX_CONTRACT,
    requestContractVersion: DELIVERY_REQUEST_CONTRACT,
    acknowledgementContractVersion: DELIVERY_ACK_CONTRACT,
    maxAttempts: DELIVERY_MAX_ATTEMPTS,
    connector: connector?.describe ? connector.describe() : new DisabledDeliveryConnector().describe(),
    boundary: DELIVERY_BOUNDARY,
    attachmentClaimed: false,
    clinicalValidation: false
  };
}
