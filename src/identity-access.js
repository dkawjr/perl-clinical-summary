import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";

export const IDENTITY_ACCESS_CONTRACT = "perl-identity-access-perimeter/1.0";
export const IDENTITY_ACCESS_POLICY_CONTRACT = "perl-identity-access-policy/1.0";
export const IDENTITY_ACCESS_EVENT_CONTRACT = "perl-authenticated-access-decision/1.0";
export const IDENTITY_ACCESS_BOUNDARY = "This perimeter verifies short-lived externally issued Ed25519 bearer assertions and applies a fixed local route-permission map. It does not issue a token, collect a password, connect an SSO login, verify licensure or employment, resolve a patient or production site, store a bearer token, authorize PHI, replace e-QPASS RBAC, or create clinical, pilot, release, traffic, stop, restart, or care-decision authority.";

export const IDENTITY_ROLES = Object.freeze([
  Object.freeze({ id: "licensed-clinician", label: "Licensed clinician", permissions: Object.freeze(["workspace:read", "evidence:export", "clinical:review", "clinical:approve", "safety:report"]) }),
  Object.freeze({ id: "clinical-lead", label: "Clinical lead", permissions: Object.freeze(["workspace:read", "evidence:export", "clinical:review", "clinical:approve", "safety:report", "safety:manage", "governance:verify", "change:manage"]) }),
  Object.freeze({ id: "calibration-reviewer", label: "Calibration reviewer", permissions: Object.freeze(["workspace:read", "evidence:export", "calibration:operate", "safety:report"]) }),
  Object.freeze({ id: "integration-operator", label: "Integration operator", permissions: Object.freeze(["workspace:read", "evidence:export", "integration:operate"]) }),
  Object.freeze({ id: "operations-operator", label: "Operations operator", permissions: Object.freeze(["workspace:read", "evidence:export", "operations:operate"]) }),
  Object.freeze({ id: "governance-owner", label: "Governance owner", permissions: Object.freeze(["workspace:read", "evidence:export", "governance:verify"]) }),
  Object.freeze({ id: "read-only-auditor", label: "Read-only auditor", permissions: Object.freeze(["workspace:read", "evidence:export"]) })
]);

const ROLE_MAP = new Map(IDENTITY_ROLES.map(role => [role.id, role]));
const KEY_ID = /^FF-IDENTITY-KEY-[A-Z0-9][A-Z0-9-]{5,63}$/;
const POLICY_ID = /^FF-IDENTITY-POLICY-[A-Z0-9][A-Z0-9-]{5,63}$/;
const ACTOR_REF = /^FF-ID-[A-Z0-9][A-Z0-9._-]{3,41}$/;
const JTI = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64 = /^[a-f0-9]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const CLOCK_SKEW_SECONDS = 60;
const MAX_POLICY_BYTES = 256 * 1024;
const MAX_TOKEN_BYTES = 16 * 1024;
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ROUTE_CLASSES = Object.freeze(["clinical-record", "calibration", "integration", "operations", "governance", "safety", "change-control"]);

const clone = value => structuredClone(value);

export function canonicalIdentityJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalIdentityJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalIdentityJson(value[key])}`).join(",")}}`;
}

const digest = value => createHash("sha256").update(Buffer.isBuffer(value) || typeof value === "string" ? value : canonicalIdentityJson(value)).digest("hex");
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

function publicKeyFingerprint(publicKeyPem) {
  try {
    const publicKey = createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") return null;
    return digest(publicKey.export({ type: "spki", format: "der" }));
  } catch {
    return null;
  }
}

export function disabledIdentityAccessPolicy() {
  return {
    contractVersion: IDENTITY_ACCESS_POLICY_CONTRACT,
    policyId: "FF-IDENTITY-POLICY-DISABLED",
    version: "0.0.0",
    issuer: "disabled://identity",
    audience: "perl-clinical-summary",
    issuedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:00:00.000Z",
    maximumSessionSeconds: 900,
    keys: []
  };
}

export function identityAccessPolicyTemplate() {
  return {
    contractVersion: IDENTITY_ACCESS_POLICY_CONTRACT,
    policyId: "FF-IDENTITY-POLICY-REPLACE-ME",
    version: "1.0.0",
    issuer: "https://identity.example.invalid",
    audience: "perl-clinical-summary",
    issuedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-11-12T00:00:00.000Z",
    maximumSessionSeconds: 900,
    keys: [{
      keyId: "FF-IDENTITY-KEY-REPLACE-ME",
      algorithm: "Ed25519",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_ED25519_SPKI_PUBLIC_KEY\n-----END PUBLIC KEY-----\n",
      notBefore: "2026-08-14T00:00:00.000Z",
      notAfter: "2026-11-12T00:00:00.000Z"
    }]
  };
}

export function identityAccessPolicyFingerprint(policy) {
  return digest(policy);
}

export function validateIdentityAccessPolicy(policy, { allowDisabled = true } = {}) {
  const errors = [];
  const keys = ["contractVersion", "policyId", "version", "issuer", "audience", "issuedAt", "expiresAt", "maximumSessionSeconds", "keys"];
  if (!exactKeys(policy, keys, "Identity-access policy", errors)) return errors;
  if (policy.contractVersion !== IDENTITY_ACCESS_POLICY_CONTRACT) errors.push(`Identity-access policy contractVersion must be ${IDENTITY_ACCESS_POLICY_CONTRACT}.`);
  const disabled = policy.policyId === "FF-IDENTITY-POLICY-DISABLED";
  if (disabled && allowDisabled) {
    if (canonicalIdentityJson(policy) !== canonicalIdentityJson(disabledIdentityAccessPolicy())) errors.push("Disabled identity-access policy must match the fixed disabled policy.");
    return errors;
  }
  if (!POLICY_ID.test(String(policy.policyId || "")) || !SEMVER.test(String(policy.version || "")) || policy.version === "0.0.0") errors.push("Identity-access policy identity or version is invalid.");
  try {
    const issuer = new URL(policy.issuer);
    if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.hash) errors.push("Identity-access policy issuer must be an HTTPS origin or path without credentials or fragment.");
  } catch {
    errors.push("Identity-access policy issuer must be a valid HTTPS URL.");
  }
  if (policy.audience !== "perl-clinical-summary") errors.push("Identity-access policy audience must be perl-clinical-summary.");
  if (!finiteDate(policy.issuedAt) || !finiteDate(policy.expiresAt) || Date.parse(policy.expiresAt) <= Date.parse(policy.issuedAt)) errors.push("Identity-access policy time window is invalid.");
  if (!Number.isInteger(policy.maximumSessionSeconds) || policy.maximumSessionSeconds < 300 || policy.maximumSessionSeconds > 900) errors.push("Identity-access policy maximumSessionSeconds must be between 300 and 900.");
  if (!Array.isArray(policy.keys) || policy.keys.length < 1 || policy.keys.length > 8) errors.push("Identity-access policy requires one to eight trusted keys.");
  const keyIds = new Set();
  const keyFingerprints = new Set();
  for (const [index, key] of (policy.keys || []).entries()) {
    const label = `Identity-access policy key ${index + 1}`;
    if (!exactKeys(key, ["keyId", "algorithm", "publicKeyPem", "notBefore", "notAfter"], label, errors)) continue;
    if (!KEY_ID.test(String(key.keyId || "")) || keyIds.has(key.keyId)) errors.push(`${label} keyId is invalid or repeated.`);
    keyIds.add(key.keyId);
    if (key.algorithm !== "Ed25519") errors.push(`${label} algorithm must be Ed25519.`);
    if (!finiteDate(key.notBefore) || !finiteDate(key.notAfter) || Date.parse(key.notAfter) <= Date.parse(key.notBefore) || Date.parse(key.notBefore) < Date.parse(policy.issuedAt) || Date.parse(key.notAfter) > Date.parse(policy.expiresAt)) errors.push(`${label} validity must be inside the policy window.`);
    const fingerprint = publicKeyFingerprint(key.publicKeyPem);
    if (!fingerprint) errors.push(`${label} public key is not a valid Ed25519 SPKI key.`);
    else if (keyFingerprints.has(fingerprint)) errors.push(`${label} repeats trusted key material.`);
    else keyFingerprints.add(fingerprint);
  }
  if (Buffer.byteLength(JSON.stringify(policy)) > MAX_POLICY_BYTES) errors.push("Identity-access policy exceeds the 256 KB limit.");
  return [...new Set(errors)];
}

export function summarizeIdentityAccessPolicy(policy, now = new Date().toISOString()) {
  const disabled = policy.policyId === "FF-IDENTITY-POLICY-DISABLED";
  const nowMs = Date.parse(now);
  const policyCurrent = !disabled && Date.parse(policy.issuedAt) <= nowMs && nowMs <= Date.parse(policy.expiresAt);
  const trustedKeys = (policy.keys || []).map(key => ({
    keyId: key.keyId,
    algorithm: key.algorithm,
    publicKeyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    notBefore: key.notBefore,
    notAfter: key.notAfter,
    active: policyCurrent && Date.parse(key.notBefore) <= nowMs && nowMs <= Date.parse(key.notAfter)
  }));
  return {
    contractVersion: IDENTITY_ACCESS_POLICY_CONTRACT,
    policyId: policy.policyId,
    version: policy.version,
    issuerFingerprint: digest(policy.issuer),
    audience: policy.audience,
    maximumSessionSeconds: policy.maximumSessionSeconds,
    policyFingerprint: identityAccessPolicyFingerprint(policy),
    externallyProvisioned: !disabled,
    policyCurrent,
    trustedKeyCount: trustedKeys.length,
    activeKeyCount: trustedKeys.filter(key => key.active).length,
    trustedKeys,
    policyWriteApiAvailable: false,
    tokenIssueApiAvailable: false,
    passwordInputAvailable: false
  };
}

export function accessRequirement(pathname, method = "GET") {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (["GET", "HEAD"].includes(normalizedMethod) && ["/api/health", "/api/live", "/api/ready", "/api/security/identity/public"].includes(pathname)) return { public: true, permission: null, routeClass: "public-status", auditRequired: false };
  if (["GET", "HEAD"].includes(normalizedMethod)) {
    const exportRoute = /(?:\.json$|\.csv$|\.html$|\/export(?:\/|$)|\/request\.(?:json|html)$|\/dossier\.html$|\/workbook\.html$|\/brief\.html$|\/report-package\.html$)/.test(pathname);
    return { public: false, permission: exportRoute ? "evidence:export" : "workspace:read", routeClass: exportRoute ? "evidence-export" : "workspace-read", auditRequired: false };
  }
  if (pathname.startsWith("/api/operations/")) return { public: false, permission: "operations:operate", routeClass: "operations", auditRequired: true };
  if (pathname.startsWith("/api/integration/")) return { public: false, permission: "integration:operate", routeClass: "integration", auditRequired: true };
  if (pathname.startsWith("/api/governance/")) return { public: false, permission: "governance:verify", routeClass: "governance", auditRequired: true };
  if (pathname.startsWith("/api/calibration/")) return { public: false, permission: "calibration:operate", routeClass: "calibration", auditRequired: true };
  if (pathname.startsWith("/api/changes")) return { public: false, permission: "change:manage", routeClass: "change-control", auditRequired: true };
  if (pathname.startsWith("/api/incidents")) return { public: false, permission: pathname.endsWith("/resolve") ? "safety:manage" : "safety:report", routeClass: "safety", auditRequired: true };
  if (pathname === "/api/assessments/import") return { public: false, permission: "integration:operate", routeClass: "integration", auditRequired: true };
  if (/^\/api\/assessments\/[^/]+\/approve$/.test(pathname)) return { public: false, permission: "clinical:approve", routeClass: "clinical-record", auditRequired: true };
  if (pathname.startsWith("/api/assessments/") || pathname === "/api/comparisons" || pathname === "/api/progress/observations") return { public: false, permission: "clinical:review", routeClass: "clinical-record", auditRequired: true };
  if (STATE_CHANGING_METHODS.has(normalizedMethod)) return { public: false, permission: "governance:verify", routeClass: "governance", auditRequired: true };
  return { public: false, permission: "workspace:read", routeClass: "workspace-read", auditRequired: false };
}

function parseDemoActor(headers) {
  const actor = String(headers?.["x-perl-demo-actor"] || headers?.["X-PERL-Demo-Actor"] || "Demo reviewer").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(actor)) throw Object.assign(new Error("Calibration reviewer code must use 2–48 letters, numbers, spaces, periods, underscores, or hyphens."), { status: 400 });
  return actor;
}

function decodeJsonSegment(segment, label) {
  if (!BASE64URL.test(segment) || segment.length > 8192) throw Object.assign(new Error(`${label} is not valid base64url.`), { status: 401 });
  try {
    const value = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value;
  } catch {
    throw Object.assign(new Error(`${label} must be a valid JSON object.`), { status: 401 });
  }
}

export function verifyIdentityAccessToken(token, policy, now = new Date().toISOString()) {
  if (typeof token !== "string" || token.length < 64 || Buffer.byteLength(token) > MAX_TOKEN_BYTES) throw Object.assign(new Error("Bearer assertion is missing or outside the bounded size."), { status: 401 });
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some(segment => !BASE64URL.test(segment))) throw Object.assign(new Error("Bearer assertion must be a compact JWS."), { status: 401 });
  const header = decodeJsonSegment(segments[0], "Bearer assertion header");
  const claims = decodeJsonSegment(segments[1], "Bearer assertion claims");
  const headerErrors = [];
  if (exactKeys(header, ["alg", "kid", "typ"], "Bearer assertion header", headerErrors) && (header.alg !== "EdDSA" || header.typ !== "JWT" || !KEY_ID.test(String(header.kid || "")))) headerErrors.push("Bearer assertion header must use a trusted EdDSA JWT key.");
  if (headerErrors.length) throw Object.assign(new Error(headerErrors.join(" ")), { status: 401 });
  const claimErrors = [];
  if (exactKeys(claims, ["iss", "aud", "sub", "jti", "iat", "nbf", "exp", "roles"], "Bearer assertion claims", claimErrors)) {
    if (claims.iss !== policy.issuer || claims.aud !== policy.audience) claimErrors.push("Bearer assertion issuer or audience is invalid.");
    if (!ACTOR_REF.test(String(claims.sub || "")) || !JTI.test(String(claims.jti || ""))) claimErrors.push("Bearer assertion subject or session identifier is invalid.");
    if (![claims.iat, claims.nbf, claims.exp].every(Number.isInteger) || claims.nbf < claims.iat - CLOCK_SKEW_SECONDS || claims.exp <= claims.iat || claims.exp - claims.iat > policy.maximumSessionSeconds) claimErrors.push("Bearer assertion time claims are invalid or exceed the policy session bound.");
    if (!Array.isArray(claims.roles) || claims.roles.length < 1 || claims.roles.length > 3 || new Set(claims.roles).size !== claims.roles.length || claims.roles.some(role => !ROLE_MAP.has(role))) claimErrors.push("Bearer assertion roles are invalid, repeated, or outside the fixed role book.");
  }
  const nowSeconds = Math.floor(Date.parse(now) / 1000);
  if (!Number.isFinite(nowSeconds) || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS || claims.nbf > nowSeconds + CLOCK_SKEW_SECONDS || claims.exp < nowSeconds - CLOCK_SKEW_SECONDS) claimErrors.push("Bearer assertion is not current.");
  const policySummary = summarizeIdentityAccessPolicy(policy, now);
  if (!policySummary.policyCurrent) claimErrors.push("Identity-access policy is not current.");
  const key = (policy.keys || []).find(item => item.keyId === header.kid);
  if (!key || Date.parse(key.notBefore) > Number(claims.iat) * 1000 || Date.parse(key.notAfter) < Number(claims.exp) * 1000) claimErrors.push("Bearer assertion key is unknown or outside its trusted window.");
  if (claimErrors.length) throw Object.assign(new Error([...new Set(claimErrors)].join(" ")), { status: 401 });
  try {
    const valid = verify(null, Buffer.from(`${segments[0]}.${segments[1]}`), createPublicKey(key.publicKeyPem), Buffer.from(segments[2], "base64url"));
    if (!valid) throw new Error("invalid");
  } catch {
    throw Object.assign(new Error("Bearer assertion signature is invalid."), { status: 401 });
  }
  return {
    actorRef: claims.sub,
    sessionId: claims.jti,
    roles: clone(claims.roles),
    keyId: key.keyId,
    tokenFingerprint: digest(token),
    policyFingerprint: policySummary.policyFingerprint,
    issuerFingerprint: policySummary.issuerFingerprint,
    issuedAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    signatureVerified: true
  };
}

export function createIdentityAccessGateway({ policy = disabledIdentityAccessPolicy(), clock = () => new Date() } = {}) {
  const policyErrors = validateIdentityAccessPolicy(policy);
  if (policyErrors.length) throw new Error(policyErrors.join(" "));
  const policySummary = () => summarizeIdentityAccessPolicy(policy, clock().toISOString());
  return {
    policy,
    status() {
      const summary = policySummary();
      return {
        ...summary,
        mode: summary.externallyProvisioned ? "external-eddsa-assertion" : "synthetic-demo-code",
        authenticationRequired: summary.externallyProvisioned,
        authorizationEnforced: summary.externallyProvisioned,
        roleCount: IDENTITY_ROLES.length,
        roles: clone(IDENTITY_ROLES),
        bearerTokensStored: false,
        passwordsAccepted: false,
        productionSsoConnected: false,
        licensureVerified: false,
        phiAuthorized: false,
        boundary: IDENTITY_ACCESS_BOUNDARY
      };
    },
    authorize(headers, pathname, method = "GET") {
      const requirement = accessRequirement(pathname, method);
      const summary = policySummary();
      if (requirement.public) return { mode: "public-status", actorRef: "PUBLIC", roles: [], authenticated: false, authorizationEnforced: summary.externallyProvisioned, ...requirement };
      if (!summary.externallyProvisioned) return { mode: "synthetic-demo-code", actorRef: parseDemoActor(headers), roles: ["synthetic-demo"], authenticated: false, authorizationEnforced: false, ...requirement };
      const authorization = String(headers?.authorization || headers?.Authorization || "");
      if (!authorization.startsWith("Bearer ") || authorization.slice(7).includes(" ")) throw Object.assign(new Error("A bounded bearer assertion is required for this API route."), { status: 401 });
      const identity = verifyIdentityAccessToken(authorization.slice(7), policy, clock().toISOString());
      const permissions = new Set(identity.roles.flatMap(role => ROLE_MAP.get(role).permissions));
      if (!permissions.has(requirement.permission)) throw Object.assign(new Error(`The authenticated role set does not grant ${requirement.permission}.`), { status: 403 });
      return { ...identity, mode: "external-eddsa-assertion", authenticated: true, authorizationEnforced: true, ...requirement };
    }
  };
}

export function createIdentityAccessEvent({ identity, method, routeClass, permission, sequence, previousHash, createdAt, id = randomUUID() }) {
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: IDENTITY_ACCESS_EVENT_CONTRACT,
    eventType: "authenticated-api-access-granted",
    actorRef: identity.actorRef,
    keyId: identity.keyId,
    roles: clone(identity.roles),
    tokenFingerprint: identity.tokenFingerprint,
    policyFingerprint: identity.policyFingerprint,
    issuerFingerprint: identity.issuerFingerprint,
    method: String(method).toUpperCase(),
    routeClass,
    permission,
    authenticatedAt: createdAt,
    signatureVerified: true,
    authorizationGranted: true,
    bearerTokenStored: false,
    passwordStored: false,
    humanNameStored: false,
    phiStored: false,
    boundary: IDENTITY_ACCESS_BOUNDARY
  };
  return { ...core, hash: digest(core) };
}

export function validateIdentityAccessEvent(event, { sequence, previousHash } = {}) {
  const errors = [];
  const keys = ["id", "sequence", "previousHash", "contractVersion", "eventType", "actorRef", "keyId", "roles", "tokenFingerprint", "policyFingerprint", "issuerFingerprint", "method", "routeClass", "permission", "authenticatedAt", "signatureVerified", "authorizationGranted", "bearerTokenStored", "passwordStored", "humanNameStored", "phiStored", "boundary", "hash"];
  if (!exactKeys(event, keys, "Identity-access event", errors)) return errors;
  if (event.contractVersion !== IDENTITY_ACCESS_EVENT_CONTRACT || event.eventType !== "authenticated-api-access-granted") errors.push("Identity-access event contract or type is invalid.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(event.id || "")) || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Identity-access event identity or sequence is invalid.");
  if (sequence !== undefined && event.sequence !== sequence) errors.push("Identity-access event sequence is invalid.");
  if (previousHash !== undefined && event.previousHash !== previousHash) errors.push("Identity-access event previous hash is invalid.");
  if (event.previousHash !== "GENESIS" && !HEX_64.test(String(event.previousHash || ""))) errors.push("Identity-access event previous hash is invalid.");
  if (!ACTOR_REF.test(String(event.actorRef || "")) || !KEY_ID.test(String(event.keyId || ""))) errors.push("Identity-access event actor or key reference is invalid.");
  if (!Array.isArray(event.roles) || event.roles.length < 1 || event.roles.length > 3 || new Set(event.roles).size !== event.roles.length || event.roles.some(role => !ROLE_MAP.has(role))) errors.push("Identity-access event roles are invalid.");
  const permissions = new Set((event.roles || []).flatMap(role => ROLE_MAP.get(role)?.permissions || []));
  if (!permissions.has(event.permission)) errors.push("Identity-access event permission is not granted by its role set.");
  if (![event.tokenFingerprint, event.policyFingerprint, event.issuerFingerprint].every(value => HEX_64.test(String(value || "")))) errors.push("Identity-access event fingerprints must be SHA-256 values.");
  if (!STATE_CHANGING_METHODS.has(event.method) || !ROUTE_CLASSES.includes(event.routeClass) || !finiteDate(event.authenticatedAt)) errors.push("Identity-access event method, route class, or time is invalid.");
  if (event.signatureVerified !== true || event.authorizationGranted !== true || event.bearerTokenStored !== false || event.passwordStored !== false || event.humanNameStored !== false || event.phiStored !== false) errors.push("Identity-access event must preserve the verified, allowed, no-secret, no-name, and no-PHI boundary.");
  if (event.boundary !== IDENTITY_ACCESS_BOUNDARY) errors.push("Identity-access event boundary is invalid.");
  const { hash, ...core } = event;
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Identity-access event hash is invalid.");
  return [...new Set(errors)];
}

export function buildIdentityAccessStatus({ gatewayStatus, events = [], chain, generatedAt = new Date().toISOString() }) {
  return {
    contractVersion: IDENTITY_ACCESS_CONTRACT,
    headline: "A role is not a label. It is a permission boundary.",
    runtime: clone(gatewayStatus),
    roles: clone(IDENTITY_ROLES),
    authenticatedMutationCount: events.length,
    lastDecision: events.at(-1) ? clone(events.at(-1)) : null,
    history: clone(events),
    chain: clone(chain),
    generatedAt,
    policyWriteApiAvailable: false,
    tokenIssueApiAvailable: false,
    passwordInputAvailable: false,
    bearerTokensStored: false,
    productionSsoConnected: false,
    licensureVerified: false,
    phiAuthorized: false,
    boundary: IDENTITY_ACCESS_BOUNDARY
  };
}
