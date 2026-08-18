import { createHash } from "node:crypto";

export const MODEL_TRANSPORT_POLICY_CONTRACT = "perl-model-transport-policy/1.0";
export const MODEL_TRANSPORT_CONTRACT = "perl-https-model-transport/1.0";
export const MODEL_TRANSPORT_BOUNDARY = "This bridge may transmit only PERL's scoring-only synthetic calibration request to one startup-approved HTTPS endpoint. It does not approve a provider, authorize PHI, select an engine, persist or expose a credential, retry or fall back silently, establish a BAA, prove private networking, or authorize clinical, pilot, production, or patient use.";

const POLICY_ID = /^FF-MODEL-TRANSPORT-[A-Z0-9][A-Z0-9-]{5,63}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const BOUNDED_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;
const CREDENTIAL_ENV = /^PERL_MODEL_[A-Z0-9_]{3,64}_TOKEN$/;
const MAX_POLICY_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

export function canonicalTransportJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalTransportJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalTransportJson(value[key])}`).join(",")}}`;
}

const digest = value => createHash("sha256").update(typeof value === "string" ? value : canonicalTransportJson(value)).digest("hex");
const finiteDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    errors.push(`${label} must contain exactly: ${keys.join(", ")}.`);
    return false;
  }
  return true;
}

function validEndpoint(value) {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:"
      && !endpoint.username
      && !endpoint.password
      && !endpoint.search
      && !endpoint.hash
      && endpoint.pathname !== "/";
  } catch {
    return false;
  }
}

export function modelTransportPolicyTemplate() {
  return {
    contractVersion: MODEL_TRANSPORT_POLICY_CONTRACT,
    policyId: "FF-MODEL-TRANSPORT-REPLACE-ME",
    version: "1.0.0",
    status: "approved-for-synthetic-calibration",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-11-12T00:00:00.000Z",
    endpoint: "https://model-gateway.example.invalid/v1/perl/generate",
    timeoutMs: 15000,
    maximumRequestBytes: 131072,
    credential: {
      type: "bearer-environment",
      environmentVariable: "PERL_MODEL_CANDIDATE_TOKEN"
    },
    candidate: {
      providerId: "replace-with-candidate-id",
      modelVersion: "replace-with-pinned-model-version",
      promptVersion: "perl-candidate-prompt/1.0",
      approvedBy: "replace-with-governance-reference"
    }
  };
}

export function validateModelTransportPolicy(policy) {
  const errors = [];
  const keys = ["contractVersion", "policyId", "version", "status", "issuedAt", "expiresAt", "endpoint", "timeoutMs", "maximumRequestBytes", "credential", "candidate"];
  if (!exactKeys(policy, keys, "Model-transport policy", errors)) return errors;
  if (policy.contractVersion !== MODEL_TRANSPORT_POLICY_CONTRACT) errors.push(`Model-transport policy contractVersion must be ${MODEL_TRANSPORT_POLICY_CONTRACT}.`);
  if (!POLICY_ID.test(String(policy.policyId || "")) || !VERSION.test(String(policy.version || "")) || policy.version === "0.0.0") errors.push("Model-transport policy identity or version is invalid.");
  if (policy.status !== "approved-for-synthetic-calibration") errors.push("Model-transport policy may authorize synthetic calibration only.");
  if (!finiteDate(policy.issuedAt) || !finiteDate(policy.expiresAt) || Date.parse(policy.expiresAt) <= Date.parse(policy.issuedAt)) errors.push("Model-transport policy time window is invalid.");
  if (!validEndpoint(policy.endpoint)) errors.push("Model-transport endpoint must be a specific HTTPS path without credentials, query, or fragment.");
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 500 || policy.timeoutMs > 30000) errors.push("Model-transport timeoutMs must be between 500 and 30,000 milliseconds.");
  if (!Number.isInteger(policy.maximumRequestBytes) || policy.maximumRequestBytes < 16384 || policy.maximumRequestBytes > 262144) errors.push("Model-transport maximumRequestBytes must be between 16 KB and 256 KB.");
  if (exactKeys(policy.credential, ["type", "environmentVariable"], "Model-transport credential", errors)) {
    if (policy.credential.type !== "bearer-environment" || !CREDENTIAL_ENV.test(String(policy.credential.environmentVariable || ""))) errors.push("Model-transport credential must name a dedicated PERL_MODEL_*_TOKEN environment variable.");
  }
  if (exactKeys(policy.candidate, ["providerId", "modelVersion", "promptVersion", "approvedBy"], "Model-transport candidate", errors)) {
    for (const key of ["providerId", "modelVersion", "promptVersion", "approvedBy"]) {
      if (!BOUNDED_NAME.test(String(policy.candidate[key] || ""))) errors.push(`Model-transport candidate ${key} is invalid.`);
    }
  }
  if (Buffer.byteLength(JSON.stringify(policy), "utf8") > MAX_POLICY_BYTES) errors.push("Model-transport policy exceeds the 256 KB limit.");
  return [...new Set(errors)];
}

export function modelTransportPolicyFingerprint(policy) {
  return digest(policy);
}

export function summarizeModelTransportPolicy(policy, { now = new Date(), credentialAvailable = false } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const errors = validateModelTransportPolicy(policy);
  const policyCurrent = errors.length === 0 && Date.parse(policy.issuedAt) <= nowMs && nowMs <= Date.parse(policy.expiresAt);
  return {
    contractVersion: MODEL_TRANSPORT_CONTRACT,
    policyContractVersion: MODEL_TRANSPORT_POLICY_CONTRACT,
    policyVersion: policy.version,
    policyFingerprint: modelTransportPolicyFingerprint(policy),
    endpointFingerprint: digest(policy.endpoint),
    mode: "authenticated-https-bridge",
    authorizationScope: "synthetic-calibration-only",
    policyCurrent,
    credentialAvailable: Boolean(credentialAvailable),
    credentialSource: "startup-environment",
    credentialPersisted: false,
    credentialExposedByApi: false,
    maximumRequestBytes: policy.maximumRequestBytes,
    maximumResponseBytes: MAX_RESPONSE_BYTES,
    timeoutMs: policy.timeoutMs,
    retryCount: 0,
    fallbackEnabled: false,
    phiApproved: false,
    externalTransmission: true,
    productionProviderApproved: false,
    clinicalValidation: false,
    boundary: MODEL_TRANSPORT_BOUNDARY
  };
}

async function readBoundedResponse(response, controller) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    controller.abort();
    throw Object.assign(new Error("Candidate response exceeded the transport limit."), { code: "MODEL_OUTPUT_REJECTED", status: 502 });
  }
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw Object.assign(new Error("Candidate response exceeded the transport limit."), { code: "MODEL_OUTPUT_REJECTED", status: 502 });
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        controller.abort();
        throw Object.assign(new Error("Candidate response exceeded the transport limit."), { code: "MODEL_OUTPUT_REJECTED", status: 502 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8");
}

export function createHttpsModelTransport({ policy, credential, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  const errors = validateModelTransportPolicy(policy);
  if (errors.length) throw new Error(errors.join(" "));
  if (typeof fetchImpl !== "function") throw new Error("Model transport requires an HTTPS fetch implementation.");
  if (typeof credential !== "string" || Buffer.byteLength(credential, "utf8") < 32 || Buffer.byteLength(credential, "utf8") > 8192 || /[\s\u0000-\u001f\u007f]/.test(credential)) {
    throw new Error("Model transport requires a bounded opaque startup credential.");
  }
  const status = () => summarizeModelTransportPolicy(policy, { now: clock(), credentialAvailable: true });
  if (!status().policyCurrent) throw new Error("Model-transport policy is not current.");

  const transport = async (request, { signal } = {}) => {
    const current = status();
    if (!current.policyCurrent) throw Object.assign(new Error("Candidate transport authorization is no longer current."), { code: "MODEL_UNAVAILABLE", status: 502 });
    const body = JSON.stringify(request);
    if (Buffer.byteLength(body, "utf8") > policy.maximumRequestBytes) throw Object.assign(new Error("Candidate request exceeded the transport limit."), { code: "MODEL_UNAVAILABLE", status: 502 });
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetchImpl(policy.endpoint, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.requestId,
          "X-PERL-Contract": request.contractVersion,
          "X-PERL-Policy-Fingerprint": current.policyFingerprint,
          "X-PERL-Request-Id": request.requestId
        },
        body
      });
      if (!response?.ok) throw Object.assign(new Error("Candidate endpoint rejected the bounded request."), { code: "MODEL_UNAVAILABLE", status: 502 });
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      if (!/(?:application\/json|\+json)(?:\s*;|$)/.test(contentType)) throw Object.assign(new Error("Candidate endpoint returned an unsupported content type."), { code: "MODEL_OUTPUT_REJECTED", status: 502 });
      return await readBoundedResponse(response, controller);
    } finally {
      signal?.removeEventListener?.("abort", abort);
    }
  };
  transport.describe = status;
  return transport;
}
