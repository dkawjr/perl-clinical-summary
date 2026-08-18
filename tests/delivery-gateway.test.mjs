import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildDeliveryRequest,
  createDeliveryConnector,
  DELIVERY_ACK_CONTRACT,
  DELIVERY_REQUEST_CONTRACT,
  validateDeliveryAcknowledgement,
  validateDeliveryRequest
} from "../src/delivery-gateway.js";

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const hex = value => createHash("sha256").update(value).digest("hex");

function deliveryFixture() {
  const renderedContent = "<!doctype html><html><head><title>PERL</title></head><body><main>" + "Synthetic clinician attachment. ".repeat(8) + "</main></body></html>";
  const artifact = { id: randomUUID(), hash: hex("artifact") };
  const attachment = {
    hash: hex("preparation"),
    reportArtifactHash: artifact.hash,
    sourceEventReceiptHash: hex("source-event"),
    findingsReportHash: hex("findings"),
    renderedContentHash: digest(renderedContent)
  };
  const job = {
    id: randomUUID(),
    assessmentId: "FF-TEST-DELIVERY-CASE",
    idempotencyKey: "FF-TEST-DELIVERY-0123456789ABCDEF",
    reportArtifactId: artifact.id,
    reportArtifactHash: artifact.hash,
    attachmentReceiptHash: attachment.hash
  };
  return { artifact, attachment, job, renderedContent };
}

function validAck(request, receivedAt = "2026-08-13T20:00:00.000Z") {
  return {
    contractVersion: DELIVERY_ACK_CONTRACT,
    requestId: request.requestId,
    jobId: request.jobId,
    idempotencyKey: request.idempotencyKey,
    environment: "calibration",
    status: "rehearsed-not-attached",
    remoteWriteClaimed: false,
    receiptId: "FF-TEST-ACK-0123456789",
    receivedAt
  };
}

test("delivery request is hash-bound, synthetic-only, and schema-exact", () => {
  const fixture = deliveryFixture();
  const request = buildDeliveryRequest(fixture);
  assert.equal(request.contractVersion, DELIVERY_REQUEST_CONTRACT);
  assert.equal(request.environment, "calibration");
  assert.equal(request.contentHash, fixture.attachment.renderedContentHash);
  assert.deepEqual(validateDeliveryRequest(request), []);
  assert.equal(JSON.stringify(request).includes("subjectRef"), false);
  assert.equal(JSON.stringify(request).includes("reportRef"), false);

  const changed = structuredClone(request);
  changed.content += "undisclosed mutation";
  assert.match(validateDeliveryRequest(changed).join(" "), /contentHash/i);
  changed.contentHash = digest(changed.content);
  changed.provenance.renderedContentHash = changed.contentHash;
  changed.patientName = "Not allowed";
  assert.match(validateDeliveryRequest(changed).join(" "), /undeclared fields/i);
});

test("structured connector requires explicit authorization and a strict no-write acknowledgement", async () => {
  assert.throws(() => createDeliveryConnector({ connector: "structured-candidate", transport: async () => ({}) }), /explicit synthetic-calibration authorization/i);
  const fixture = deliveryFixture();
  const request = buildDeliveryRequest(fixture);
  let seen;
  const connector = createDeliveryConnector({
    connector: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-synthetic-contract-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async value => {
      seen = value;
      return validAck(value);
    }
  });
  const ack = await connector.deliver(request);
  assert.equal(ack.remoteWriteClaimed, false);
  assert.equal(connector.describe().externalTransmission, true);
  assert.equal(connector.describe().phiApproved, false);
  assert.equal(seen.contentHash, fixture.attachment.renderedContentHash);

  const unsafe = { ...validAck(request), status: "attached", remoteWriteClaimed: true };
  assert.match(validateDeliveryAcknowledgement(unsafe, request).join(" "), /rehearsed-not-attached/i);
});

test("connector rejects malformed acknowledgements and sanitizes transport failures without fallback", async () => {
  const fixture = deliveryFixture();
  const request = buildDeliveryRequest(fixture);
  const authorization = {
    status: "approved-for-synthetic-calibration",
    connectorId: "eqpass-synthetic-contract-test",
    connectorVersion: "rfi-fixed-v1",
    approvedBy: "INTEGRATION-QA"
  };
  const malformed = createDeliveryConnector({
    connector: "structured-candidate",
    authorization,
    transport: async value => ({ ...validAck(value), remoteWriteClaimed: true })
  });
  await assert.rejects(() => malformed.deliver(request), error => error.code === "DELIVERY_ACK_REJECTED" && !error.message.includes("remoteWriteClaimed"));

  const unavailable = createDeliveryConnector({
    connector: "structured-candidate",
    authorization,
    transport: async () => { throw new Error("secret endpoint and credential detail"); }
  });
  await assert.rejects(() => unavailable.deliver(request), error => error.code === "DELIVERY_UNAVAILABLE" && !error.message.includes("credential"));

  const disabled = createDeliveryConnector();
  assert.equal(disabled.describe().enabled, false);
  await assert.rejects(() => disabled.deliver(request), error => error.code === "DELIVERY_CONNECTOR_DISABLED");
});

test("connector timeout aborts the synthetic attempt", async () => {
  const fixture = deliveryFixture();
  const request = buildDeliveryRequest(fixture);
  let aborted = false;
  const connector = createDeliveryConnector({
    connector: "structured-candidate",
    timeoutMs: 500,
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-timeout-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async (_value, { signal }) => new Promise(resolve => {
      signal.addEventListener("abort", () => { aborted = true; resolve({}); }, { once: true });
    })
  });
  await assert.rejects(() => connector.deliver(request), error => error.code === "DELIVERY_TIMEOUT");
  assert.equal(aborted, true);
});

test("published delivery schemas prohibit undeclared fields and attachment claims", async () => {
  const names = ["delivery-request", "delivery-acknowledgement", "delivery-job", "delivery-event"];
  const schemas = Object.fromEntries(await Promise.all(names.map(async name => [
    name,
    JSON.parse(await readFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), "utf8"))
  ])));
  for (const schema of Object.values(schemas)) assert.equal(schema.additionalProperties, false);
  assert.equal(schemas["delivery-request"].properties.environment.const, "calibration");
  assert.equal(schemas["delivery-acknowledgement"].properties.remoteWriteClaimed.const, false);
  assert.equal(schemas["delivery-acknowledgement"].properties.status.const, "rehearsed-not-attached");
  assert.equal(schemas["delivery-job"].properties.maxAttempts.const, 3);
  assert.ok(schemas["delivery-event"].properties.type.enum.includes("delivery-dead-lettered"));
});
