import { createHash, randomUUID } from "node:crypto";
import { PILOT_AUTHORITY_REGISTER, PILOT_READINESS_GATES } from "./pilot-readiness.js";

export const DECISION_EXCHANGE_CONTRACT = "perl-external-decision-exchange/1.0";
export const DECISION_RETURN_CONTRACT = "perl-external-decision-return/rfi-1.0";

export const DECISION_EXCHANGE_BOUNDARY = "This exchange prepares and preflights metadata-only decision returns for the seven externally owned PERL readiness gates. It does not send email, transmit a packet, receive evidence files, patient records, Findings content, credentials, secrets, or PHI; authenticate a submitter; verify identity, licensure, authority, evidence, a cryptographic signature, or trusted time; assign an owner; record acceptance; close a gate; establish clinical validity; authorize a pilot or production release; or permit patient use. A complete preflight proves only that the return metadata is structurally inspectable. Every substantive decision remains outside this synthetic sandbox until a governed production trust layer verifies it.";

const requirement = (id, label, detail) => Object.freeze({ id, label, detail });

export const DECISION_EXCHANGE_GATES = Object.freeze([
  Object.freeze({
    id: "intended-use-approval", index: "01", shortLabel: "Words + purpose", label: "Intended use & legal language",
    headline: "Approve the job—and every word that travels with it.",
    decisionQuestion: "Do the accountable product, clinical, and legal authorities accept the provider-first intended use, prohibited uses, page-five relationship, exact live language, and disclaimer for the bounded pilot context?",
    ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "legal-owner"]),
    requirements: Object.freeze([
      requirement("accepted-intended-use", "Accepted intended-use version", "Identify the exact immutable charter version, pilot context, prohibited uses, and any conditions."),
      requirement("accepted-copy-corpus", "Accepted copy-corpus fingerprint", "Bind the nine live clauses, clinician page, audience boundaries, and disclaimer to one fingerprint."),
      requirement("clinical-legal-resolution", "Clinical + legal resolution record", "Return clause-level accept, revise, or decline decisions, dissent, conditions, and supersession rules.")
    ])
  }),
  Object.freeze({
    id: "authoritative-eqpass", index: "02", shortLabel: "Source contract", label: "Authoritative e-QPASS contract",
    headline: "Replace the rehearsal with source authority.",
    decisionQuestion: "Do the named e-QPASS and clinical owners accept the scored-event semantics, critical-screen disclosure, report lifecycle, attachment behavior, idempotency, rescoring, and failure authority PERL will rely on?",
    ownerRoles: Object.freeze(["eqpass-owner", "clinical-lead"]),
    requirements: Object.freeze([
      requirement("source-contract", "Signed interface contract", "Bind required fields, code sets, score and severity authority, versions, null rules, and lifecycle states."),
      requirement("safety-routing", "Critical-screen routing decision", "Define minimum-necessary disclosure, authorized viewers, direct-review behavior, and stop authority."),
      requirement("report-attachment", "Findings + attachment lifecycle", "Define unchanged-source preservation, merge/attachment acknowledgement, retries, supersession, and replay."),
      requirement("owner-return", "Governed owner-return package", "Resolve the two named workbooks and six interface/control artifacts requested by the Owner Return Desk.")
    ])
  }),
  Object.freeze({
    id: "clinical-beta", index: "03", shortLabel: "Counselor beta", label: "Counselor calibration acceptance",
    headline: "Let the people who use it define what good means.",
    decisionQuestion: "Does a named qualified counselor panel, under a licensed clinical lead, accept the language, safety behavior, usefulness threshold, workflow fit, and frozen comparison protocol for the bounded beta?",
    ownerRoles: Object.freeze(["clinical-lead", "counselor-panel"]),
    requirements: Object.freeze([
      requirement("panel-authority", "Panel + clinical authority record", "Identify the qualified panel, credential-verification owner, clinical lead, scope, and conflicts."),
      requirement("session-outputs", "Three-session decision package", "Return language/safety, blinded usefulness/workflow, and freeze/handoff decisions with dissent."),
      requirement("clinical-standard", "Accepted clinical standard", "Bind preference, accuracy, restraint, usefulness, correction burden, agreement, workflow, and zero-tolerance safety limits."),
      requirement("reference-freeze", "Counselor-reference freeze", "Identify the accepted reference set, version, exclusions, and change authority.")
    ])
  }),
  Object.freeze({
    id: "independent-reliability", index: "04", shortLabel: "Outside review", label: "Independent reliability decision",
    headline: "Let an outsider challenge the whole proof.",
    decisionQuestion: "Does a named independent evaluator accept the analysis plan and issue a signed accuracy, agreement, failure, reliability, limitations, and recommendation decision against the governed evidence package?",
    ownerRoles: Object.freeze(["independent-evaluator", "clinical-lead"]),
    requirements: Object.freeze([
      requirement("evaluator-engagement", "Independent evaluator engagement", "Identify scope, independence, conflicts, qualifications, access boundary, and decision authority."),
      requirement("analysis-plan", "Frozen analysis plan", "Predeclare denominators, exclusions, strata, thresholds, stopping rules, and missing-data handling."),
      requirement("independent-findings", "Signed findings + limitations", "Return accuracy, restraint, usefulness, agreement, correction, safety, and workflow findings with limitations."),
      requirement("independent-recommendation", "Stop / revise / prepare recommendation", "Record the bounded next-step recommendation and every condition or dissent.")
    ])
  }),
  Object.freeze({
    id: "security-production", index: "05", shortLabel: "Azure boundary", label: "Azure security & privacy acceptance",
    headline: "Make the production boundary provable.",
    decisionQuestion: "Do security, privacy, engineering, and e-QPASS authorities accept the exact Azure data flow, identities, vendors, retention, recovery, monitoring, incident response, and clinical stop/restart controls?",
    ownerRoles: Object.freeze(["security-privacy-owner", "engineering-owner", "eqpass-owner"]),
    requirements: Object.freeze([
      requirement("data-flow", "Approved field-level data flow", "Classify each field, system boundary, model projection, log, report, queue, backup, and prohibited path."),
      requirement("identity-control", "Identity + RBAC evidence", "Bind SSO, service identities, reviewer role/licensure checks, separation of duties, access tests, and revocation."),
      requirement("continuity-control", "Continuity + operations acceptance", "Accept encryption, retention, backups, RPO/RTO, restore, rollback, telemetry, alerting, and incident response."),
      requirement("vendor-legal", "Vendor + privacy disposition", "Resolve provider terms, data use, residency, subprocessors, risk treatment, and counsel/privacy conditions.")
    ])
  }),
  Object.freeze({
    id: "accessibility-acceptance", index: "06", shortLabel: "Accessible use", label: "Independent accessibility acceptance",
    headline: "Make every review path usable without exception.",
    decisionQuestion: "Does the named accessibility authority accept the interactive workflow, responsive reflow, assistive-technology behavior, error recovery, and final report/PDF delivery against the approved pilot scope?",
    ownerRoles: Object.freeze(["accessibility-owner"]),
    requirements: Object.freeze([
      requirement("manual-matrix", "Completed manual accessibility matrix", "Return keyboard, zoom, reflow, text-spacing, contrast, forced-colors, and error-recovery evidence."),
      requirement("assistive-technology", "Assistive-technology evidence", "Return scoped VoiceOver, NVDA, TalkBack where applicable, and clinician-participant findings."),
      requirement("document-accessibility", "Report + PDF disposition", "Resolve tagged-PDF structure, reading order, language, metadata, bookmarks, and PDF/UA validation."),
      requirement("exceptions-remediation", "Exceptions + remediation decision", "Name accepted exceptions, owners, dates, compensating controls, and retest evidence.")
    ])
  }),
  Object.freeze({
    id: "pilot-authorization", index: "07", shortLabel: "Named-site pilot", label: "Named-site pilot authorization",
    headline: "Authorize only the site, people, and time actually reviewed.",
    decisionQuestion: "After every prerequisite is verified, does the named decision group authorize a bounded pilot with identified sites, users, training, support, measures, stopping rules, incident authority, and end date?",
    ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"]),
    requirements: Object.freeze([
      requirement("prerequisite-register", "Verified prerequisite register", "Bind the accepted intended-use, e-QPASS, counselor, independent, security/privacy, and accessibility decisions."),
      requirement("site-scope", "Named site + participant scope", "Identify sites, roles, record volume, inclusion/exclusion, prohibited expansion, and accountable local leadership."),
      requirement("operating-plan", "Training + support + operating plan", "Bind onboarding, supervision, support, monitoring, incident escalation, downtime, and rollback behavior."),
      requirement("pilot-decision", "Signed bounded authorization", "Record start/end, success and stop measures, authority, conditions, dissent, renewal, and closeout requirements.")
    ])
  })
]);

const RETURN_DECISIONS = new Set(["not-recorded", "accept", "revise", "decline"]);
const REFERENCE = /^FF-(?:AUTH|EVIDENCE|DECISION)-[A-Z0-9-]{3,80}$/;
const HEX_64 = /^[a-f0-9]{64}$/;

function clone(value) { return structuredClone(value); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function digest(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label} must be an object.`); return false; }
  const actual = Object.keys(value);
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = actual.filter(key => !keys.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`${label} contains fields outside the metadata contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

export function decisionExchangeGate(id) { return DECISION_EXCHANGE_GATES.find(gate => gate.id === id) || null; }

export function validateDecisionExchangeContract() {
  const errors = [];
  const external = PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority");
  if (DECISION_EXCHANGE_GATES.length !== 7) errors.push("The exchange must contain seven external decision packets.");
  if (new Set(DECISION_EXCHANGE_GATES.map(gate => gate.id)).size !== 7) errors.push("Decision gate IDs must be unique.");
  if (DECISION_EXCHANGE_GATES.some((gate, index) => gate.index !== String(index + 1).padStart(2, "0"))) errors.push("Decision packet order is invalid.");
  if (external.some((gate, index) => DECISION_EXCHANGE_GATES[index]?.id !== gate.id)) errors.push("Decision packets must exactly follow the readiness external-gate order.");
  const roleIds = new Set(PILOT_AUTHORITY_REGISTER.map(role => role.id));
  for (const gate of DECISION_EXCHANGE_GATES) {
    if (!gate.headline || !gate.decisionQuestion || gate.decisionQuestion.length < 80) errors.push(`Decision packet ${gate.id} is incomplete.`);
    if (!gate.ownerRoles.length || gate.ownerRoles.some(role => !roleIds.has(role))) errors.push(`Decision packet ${gate.id} has an invalid authority role.`);
    if (gate.requirements.length < 3 || new Set(gate.requirements.map(item => item.id)).size !== gate.requirements.length) errors.push(`Decision packet ${gate.id} has an invalid evidence register.`);
  }
  if (DECISION_EXCHANGE_BOUNDARY.length < 620 || !/does not.*record acceptance/i.test(DECISION_EXCHANGE_BOUNDARY) || !/complete preflight proves only/i.test(DECISION_EXCHANGE_BOUNDARY)) errors.push("The Decision Exchange claim boundary is incomplete.");
  return [...new Set(errors)];
}

function stableRequestCore(gate, readiness, evidenceContext = {}) {
  const roleById = new Map((readiness?.current?.authorityRegister || PILOT_AUTHORITY_REGISTER).map(role => [role.id, role]));
  return {
    contractVersion: DECISION_EXCHANGE_CONTRACT,
    returnContractVersion: DECISION_RETURN_CONTRACT,
    gate: clone(gate),
    authorities: gate.ownerRoles.map(roleId => {
      const role = roleById.get(roleId) || PILOT_AUTHORITY_REGISTER.find(item => item.id === roleId);
      return { id: roleId, label: role?.label || roleId, name: role?.name || null, status: role?.status || "unassigned" };
    }),
    readinessStateHash: readiness?.current?.readinessStateHash || null,
    evidenceContext: clone(evidenceContext),
    decisionOptions: ["accept", "revise", "decline"],
    externalDecisionRecorded: false,
    gateAccepted: false,
    boundary: DECISION_EXCHANGE_BOUNDARY
  };
}

export function decisionReturnTemplate(packet) {
  return {
    contractVersion: DECISION_RETURN_CONTRACT,
    requestFingerprint: packet.requestFingerprint,
    returnId: "FF-DECISION-REPLACE-ME",
    gateId: packet.id,
    decision: "not-recorded",
    decisionRecordReference: null,
    decidedAt: null,
    authorities: packet.authorities.map(role => ({ roleId: role.id, identityReference: null, attestation: "not-declared" })),
    evidence: packet.requirements.map(item => ({ requirementId: item.id, evidenceReference: null, status: "not-declared" })),
    trustBoundary: {
      evidenceFilesIncluded: false,
      patientRecordsIncluded: false,
      findingsContentIncluded: false,
      credentialsOrSecretsIncluded: false,
      phiIncluded: false,
      externalTransmissionPerformed: false,
      cryptographicSignatureVerified: false,
      identityVerified: false,
      authorityVerified: false,
      externalAcceptanceRecorded: false,
      gateAccepted: false,
      clinicalValidationEstablished: false,
      pilotAuthorized: false,
      productionReleaseAuthorized: false,
      patientUseAuthorized: false
    }
  };
}

export function buildDecisionExchange({ readiness, evidenceContext = {}, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const errors = validateDecisionExchangeContract();
  if (errors.length) throw new Error(errors.join(" "));
  const latestByGate = new Map();
  for (const event of events) latestByGate.set(event.gateId, event);
  const packets = DECISION_EXCHANGE_GATES.map(gate => {
    const requestCore = stableRequestCore(gate, readiness, evidenceContext);
    const requestFingerprint = digest(requestCore);
    const latest = latestByGate.get(gate.id) || null;
    const preflightCurrent = latest?.requestFingerprint === requestFingerprint;
    const packet = {
      ...requestCore.gate,
      authorities: requestCore.authorities,
      requestFingerprint,
      status: latest ? (preflightCurrent ? latest.status : "preflight-stale") : "return-not-received",
      latestPreflight: latest ? {
        sequence: latest.sequence, status: latest.status, decisionPreview: latest.decisionPreview,
        metadataChecklistComplete: latest.metadataChecklistComplete, current: preflightCurrent, createdAt: latest.createdAt, hash: latest.hash
      } : null,
      externalDecisionRecorded: false,
      gateAccepted: false
    };
    return { ...packet, returnTemplate: decisionReturnTemplate(packet) };
  });
  const latest = [...latestByGate.values()];
  const currentPreflights = packets.filter(packet => packet.latestPreflight?.current).map(packet => packet.latestPreflight);
  const counts = {
    requestPackets: 7,
    returnedGates: latest.length,
    currentPreflights: currentPreflights.length,
    stalePreflights: latest.length - currentPreflights.length,
    completeUnverified: currentPreflights.filter(event => event.metadataChecklistComplete).length,
    needsCorrection: currentPreflights.filter(event => !event.metadataChecklistComplete).length,
    authorityVerified: 0,
    externalAccepted: 0,
    gatesClosed: 0
  };
  const exchangeFingerprint = digest({
    contractVersion: DECISION_EXCHANGE_CONTRACT,
    readinessStateHash: readiness?.current?.readinessStateHash || null,
    evidenceContext: clone(evidenceContext),
    packetFingerprints: packets.map(packet => packet.requestFingerprint),
    chainHead: chain.head || "GENESIS"
  });
  return {
    contractVersion: DECISION_EXCHANGE_CONTRACT,
    returnContractVersion: DECISION_RETURN_CONTRACT,
    status: latest.length ? "returns-preflighted-unverified" : "awaiting-external-returns",
    headline: "Permission needs a return address.",
    subhead: "Seven exact decisions. Seven bounded packets. One trust boundary that never blurs metadata with authority.",
    packets,
    counts,
    history: clone(events),
    chain: clone(chain),
    exchangeFingerprint,
    readinessStateHash: readiness?.current?.readinessStateHash || null,
    generatedAt,
    evidenceFilesReceived: false,
    externalTransmissionPerformed: false,
    identityVerified: false,
    authorityVerified: false,
    externalAcceptanceRecorded: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: DECISION_EXCHANGE_BOUNDARY
  };
}

export function validateDecisionReturnManifest(manifest, packet) {
  const errors = [];
  if (JSON.stringify(manifest ?? null).length > 64 * 1024) errors.push("Decision return exceeds the 64 KB metadata limit.");
  const rootKeys = ["contractVersion", "requestFingerprint", "returnId", "gateId", "decision", "decisionRecordReference", "decidedAt", "authorities", "evidence", "trustBoundary"];
  const rootObject = Boolean(manifest && typeof manifest === "object" && !Array.isArray(manifest));
  exactKeys(manifest, rootKeys, "Manifest", errors);
  if (!rootObject) return errors;
  if (!packet) errors.push("The decision packet is unavailable.");
  if (manifest.contractVersion !== DECISION_RETURN_CONTRACT) errors.push(`contractVersion must be ${DECISION_RETURN_CONTRACT}.`);
  if (manifest.requestFingerprint !== packet?.requestFingerprint) errors.push("requestFingerprint does not match the current decision packet.");
  if (manifest.gateId !== packet?.id) errors.push("gateId does not match the current decision packet.");
  if (!/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(manifest.returnId || ""))) errors.push("returnId must be a visibly synthetic FF-DECISION reference.");
  if (!RETURN_DECISIONS.has(manifest.decision)) errors.push("decision must be not-recorded, accept, revise, or decline.");
  if (manifest.decision === "not-recorded") {
    if (manifest.decisionRecordReference !== null || manifest.decidedAt !== null) errors.push("Decision reference and time must remain null while no decision is recorded.");
  } else {
    if (!REFERENCE.test(String(manifest.decisionRecordReference || "")) || !String(manifest.decisionRecordReference || "").startsWith("FF-DECISION-")) errors.push("decisionRecordReference must be a visibly synthetic FF-DECISION reference.");
    if (!Number.isFinite(Date.parse(manifest.decidedAt))) errors.push("decidedAt must be an ISO timestamp when a decision is declared.");
  }
  if (!Array.isArray(manifest.authorities) || manifest.authorities.length !== packet?.ownerRoles?.length) {
    errors.push("authorities must contain the exact required role register.");
  } else manifest.authorities.forEach((item, index) => {
    const label = `authorities[${index}]`;
    if (!exactKeys(item, ["roleId", "identityReference", "attestation"], label, errors)) return;
    if (item.roleId !== packet.ownerRoles[index]) errors.push(`${label}.roleId must be ${packet.ownerRoles[index]}.`);
    if (!["not-declared", "declared-unverified"].includes(item.attestation)) errors.push(`${label}.attestation is invalid.`);
    if (item.attestation === "not-declared" && item.identityReference !== null) errors.push(`${label}.identityReference must be null while not declared.`);
    if (item.attestation === "declared-unverified" && (!REFERENCE.test(String(item.identityReference || "")) || !String(item.identityReference).startsWith("FF-AUTH-"))) errors.push(`${label}.identityReference must be a visibly synthetic FF-AUTH reference.`);
  });
  if (!Array.isArray(manifest.evidence) || manifest.evidence.length !== packet?.requirements?.length) {
    errors.push("evidence must contain the exact packet requirement register.");
  } else manifest.evidence.forEach((item, index) => {
    const label = `evidence[${index}]`;
    if (!exactKeys(item, ["requirementId", "evidenceReference", "status"], label, errors)) return;
    if (item.requirementId !== packet.requirements[index].id) errors.push(`${label}.requirementId must be ${packet.requirements[index].id}.`);
    if (!["not-declared", "declared-unverified"].includes(item.status)) errors.push(`${label}.status is invalid.`);
    if (item.status === "not-declared" && item.evidenceReference !== null) errors.push(`${label}.evidenceReference must be null while not declared.`);
    if (item.status === "declared-unverified" && (!REFERENCE.test(String(item.evidenceReference || "")) || !String(item.evidenceReference).startsWith("FF-EVIDENCE-"))) errors.push(`${label}.evidenceReference must be a visibly synthetic FF-EVIDENCE reference.`);
  });
  const boundaryKeys = ["evidenceFilesIncluded", "patientRecordsIncluded", "findingsContentIncluded", "credentialsOrSecretsIncluded", "phiIncluded", "externalTransmissionPerformed", "cryptographicSignatureVerified", "identityVerified", "authorityVerified", "externalAcceptanceRecorded", "gateAccepted", "clinicalValidationEstablished", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"];
  if (exactKeys(manifest.trustBoundary, boundaryKeys, "trustBoundary", errors)) for (const key of boundaryKeys) if (manifest.trustBoundary[key] !== false) errors.push(`trustBoundary.${key} must remain false in the local preflight.`);
  return [...new Set(errors)];
}

function preflightResults(manifest, packet) {
  const authorityResults = packet.ownerRoles.map((roleId, index) => ({
    roleId,
    metadataDeclared: manifest.authorities[index].attestation === "declared-unverified",
    identityReferenceHash: manifest.authorities[index].identityReference ? digest(manifest.authorities[index].identityReference) : null,
    identityVerified: false,
    authorityVerified: false
  }));
  const evidenceResults = packet.requirements.map((requirement, index) => ({
    requirementId: requirement.id,
    metadataDeclared: manifest.evidence[index].status === "declared-unverified",
    evidenceReferenceHash: manifest.evidence[index].evidenceReference ? digest(manifest.evidence[index].evidenceReference) : null,
    evidenceReceived: false,
    evidenceVerified: false
  }));
  return { authorityResults, evidenceResults };
}

export function createDecisionReturnPreflight({ manifest, packet, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() }) {
  const errors = validateDecisionReturnManifest(manifest, packet);
  if (errors.length) throw new Error(errors.join(" "));
  const { authorityResults, evidenceResults } = preflightResults(manifest, packet);
  const counts = {
    authorityRequired: authorityResults.length,
    authorityDeclared: authorityResults.filter(item => item.metadataDeclared).length,
    evidenceRequired: evidenceResults.length,
    evidenceDeclared: evidenceResults.filter(item => item.metadataDeclared).length
  };
  const decisionMetadataComplete = manifest.decision !== "not-recorded";
  const metadataChecklistComplete = decisionMetadataComplete
    && counts.authorityDeclared === counts.authorityRequired
    && counts.evidenceDeclared === counts.evidenceRequired;
  const core = {
    id, sequence, previousHash,
    contractVersion: DECISION_EXCHANGE_CONTRACT,
    returnContractVersion: DECISION_RETURN_CONTRACT,
    type: "external-decision-return-metadata-preflight-recorded",
    status: metadataChecklistComplete ? "metadata-complete-unverified" : "metadata-incomplete",
    gateId: packet.id,
    requestFingerprint: packet.requestFingerprint,
    manifestHash: digest(manifest),
    returnIdHash: digest(manifest.returnId),
    decisionPreview: manifest.decision,
    decisionRecordReferenceHash: manifest.decisionRecordReference ? digest(manifest.decisionRecordReference) : null,
    decisionTimeDeclared: manifest.decidedAt !== null,
    authorityResults,
    evidenceResults,
    counts,
    decisionMetadataComplete,
    metadataChecklistComplete,
    gateDecision: "external-decision-remains-open",
    evidenceFilesReceived: false,
    patientRecordsReceived: false,
    findingsContentReceived: false,
    credentialsOrSecretsReceived: false,
    phiReceived: false,
    externalTransmissionPerformed: false,
    cryptographicSignatureVerified: false,
    identityVerified: false,
    authorityVerified: false,
    evidenceVerified: false,
    externalAcceptanceRecorded: false,
    gateAccepted: false,
    clinicalValidationEstablished: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt,
    note: "Metadata-only decision return preflight recorded. No evidence file, identity proof, signature, authority decision, gate acceptance, pilot authorization, production release, or patient-use permission was created."
  };
  return { ...core, hash: digest(core) };
}

export function validateDecisionReturnPreflight(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Decision-return preflight event is required."];
  const { hash, ...core } = event;
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1) errors.push("Decision-return sequence is invalid.");
  if (event.previousHash !== previousHash || !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Decision-return previous hash is invalid.");
  if (event.contractVersion !== DECISION_EXCHANGE_CONTRACT || event.returnContractVersion !== DECISION_RETURN_CONTRACT || event.type !== "external-decision-return-metadata-preflight-recorded") errors.push("Decision-return contract identity is invalid.");
  if (!decisionExchangeGate(event.gateId)) errors.push("Decision-return gate is invalid.");
  for (const key of ["requestFingerprint", "manifestHash", "returnIdHash"]) if (!HEX_64.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  if (!RETURN_DECISIONS.has(event.decisionPreview)) errors.push("Decision preview is invalid.");
  if (event.decisionRecordReferenceHash !== null && !HEX_64.test(String(event.decisionRecordReferenceHash))) errors.push("Decision record reference hash is invalid.");
  if (typeof event.decisionTimeDeclared !== "boolean" || event.decisionTimeDeclared !== (event.decisionPreview !== "not-recorded")) errors.push("Decision time state is invalid.");
  const gate = decisionExchangeGate(event.gateId);
  if (!Array.isArray(event.authorityResults) || event.authorityResults.length !== gate?.ownerRoles.length) errors.push("Authority results are incomplete.");
  else event.authorityResults.forEach((item, index) => {
    if (item.roleId !== gate.ownerRoles[index]) errors.push(`Authority result ${index + 1} role is invalid.`);
    if (typeof item.metadataDeclared !== "boolean" || item.identityVerified !== false || item.authorityVerified !== false) errors.push(`Authority result ${index + 1} trust state is invalid.`);
    if (item.identityReferenceHash !== null && !HEX_64.test(String(item.identityReferenceHash))) errors.push(`Authority result ${index + 1} reference hash is invalid.`);
    if (item.metadataDeclared !== Boolean(item.identityReferenceHash)) errors.push(`Authority result ${index + 1} metadata state is inconsistent.`);
  });
  if (!Array.isArray(event.evidenceResults) || event.evidenceResults.length !== gate?.requirements.length) errors.push("Evidence results are incomplete.");
  else event.evidenceResults.forEach((item, index) => {
    if (item.requirementId !== gate.requirements[index].id) errors.push(`Evidence result ${index + 1} requirement is invalid.`);
    if (typeof item.metadataDeclared !== "boolean" || item.evidenceReceived !== false || item.evidenceVerified !== false) errors.push(`Evidence result ${index + 1} trust state is invalid.`);
    if (item.evidenceReferenceHash !== null && !HEX_64.test(String(item.evidenceReferenceHash))) errors.push(`Evidence result ${index + 1} reference hash is invalid.`);
    if (item.metadataDeclared !== Boolean(item.evidenceReferenceHash)) errors.push(`Evidence result ${index + 1} metadata state is inconsistent.`);
  });
  const counts = {
    authorityRequired: gate?.ownerRoles.length || 0,
    authorityDeclared: Array.isArray(event.authorityResults) ? event.authorityResults.filter(item => item.metadataDeclared).length : 0,
    evidenceRequired: gate?.requirements.length || 0,
    evidenceDeclared: Array.isArray(event.evidenceResults) ? event.evidenceResults.filter(item => item.metadataDeclared).length : 0
  };
  if (JSON.stringify(event.counts) !== JSON.stringify(counts)) errors.push("Decision-return counts are invalid.");
  const complete = event.decisionPreview !== "not-recorded" && counts.authorityDeclared === counts.authorityRequired && counts.evidenceDeclared === counts.evidenceRequired;
  if (event.decisionMetadataComplete !== (event.decisionPreview !== "not-recorded") || event.metadataChecklistComplete !== complete) errors.push("Decision-return completion state is invalid.");
  if (event.status !== (complete ? "metadata-complete-unverified" : "metadata-incomplete") || event.gateDecision !== "external-decision-remains-open") errors.push("Decision-return status is invalid.");
  for (const key of ["evidenceFilesReceived", "patientRecordsReceived", "findingsContentReceived", "credentialsOrSecretsReceived", "phiReceived", "externalTransmissionPerformed", "cryptographicSignatureVerified", "identityVerified", "authorityVerified", "evidenceVerified", "externalAcceptanceRecorded", "gateAccepted", "clinicalValidationEstablished", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"]) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Decision-return actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt))) errors.push("Decision-return timestamp is invalid.");
  if (typeof event.note !== "string" || event.note.length < 160) errors.push("Decision-return note is incomplete.");
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Decision-return fingerprint is invalid.");
  return [...new Set(errors)];
}

function roleLabel(id) { return PILOT_AUTHORITY_REGISTER.find(role => role.id === id)?.label || id; }

export function renderDecisionRequestPage(exchange, gateId) {
  if (exchange?.contractVersion !== DECISION_EXCHANGE_CONTRACT || exchange?.externalAcceptanceRecorded !== false || exchange?.pilotAuthorized !== false) throw new Error("Decision request renderer requires a non-authorizing exchange.");
  const packet = exchange.packets.find(item => item.id === gateId);
  if (!packet) throw new Error("Decision request packet was not found.");
  const roles = packet.ownerRoles.map((role, index) => `<article><span>0${index + 1}</span><div><strong>${escapeHtml(roleLabel(role))}</strong><p>Identity and decision authority must be verified outside this sandbox.</p></div></article>`).join("");
  const requirements = packet.requirements.map((item, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.detail)}</p><code>${escapeHtml(item.id)}</code></div></article>`).join("");
  const authorityRows = packet.ownerRoles.map(role => `<tr><th scope="row">${escapeHtml(roleLabel(role))}</th><td>FF-AUTH-________________</td><td>□ declared · unverified</td></tr>`).join("");
  const evidenceRows = packet.requirements.map(item => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>FF-EVIDENCE-________________</td><td>□ declared · unverified</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Metadata-only PERL external decision request"><title>${escapeHtml(packet.index)} · ${escapeHtml(packet.label)} · PERL Decision Exchange</title><link rel="stylesheet" href="/decision-exchange.css"></head><body>
  <nav class="exchange-toolbar" aria-label="Decision request actions"><a href="/">Return to PERL</a><span>Decision Exchange · no PHI</span><div><a href="/api/governance/decision-exchange/${encodeURIComponent(packet.id)}/request.json">Export request</a><button id="print-decision-request" type="button">Print request</button></div></nav>
  <main aria-label="External decision request packet">
    <section class="decision-sheet request-sheet" aria-labelledby="request-title">
      <header class="sheet-head"><div class="brand"><b>P</b><span>PERL</span><small>Clinical intelligence by Focused Future</small></div><div><span>DECISION EXCHANGE / ${escapeHtml(packet.index)}</span><strong>Page 01 / 02</strong></div></header>
      <div class="request-hero"><span>External decision required</span><h1 id="request-title">${escapeHtml(packet.headline)}</h1><p>${escapeHtml(packet.decisionQuestion)}</p></div>
      <section class="authority-block" aria-labelledby="authority-title"><header><span>01</span><div><h2 id="authority-title">Who must answer.</h2><p>Source ownership does not establish verified authority.</p></div></header><div>${roles}</div></section>
      <section class="requirement-block" aria-labelledby="requirements-title"><header><span>02</span><div><h2 id="requirements-title">What must come back.</h2><p>Return governed references—not evidence files or protected content.</p></div></header><div>${requirements}</div></section>
      <footer class="sheet-foot"><div><span>Current state</span><strong>${escapeHtml(packet.status.replaceAll("-", " "))}</strong></div><div><span>Request fingerprint</span><code>${escapeHtml(packet.requestFingerprint.slice(0, 20))}…</code></div><div><span>Gate</span><strong>Open · external</strong></div></footer>
      <div class="sheet-boundary">Metadata-only request · no transmission · no acceptance · no clinical or pilot authority</div>
    </section>
    <section class="decision-sheet return-sheet" aria-labelledby="return-title">
      <header class="sheet-head"><div class="brand"><b>P</b><span>PERL</span><small>Clinical intelligence by Focused Future</small></div><div><span>RETURN WORKSHEET / ${escapeHtml(packet.index)}</span><strong>Page 02 / 02</strong></div></header>
      <div class="return-title"><span>Structured return cover</span><h1 id="return-title">Make the decision inspectable.</h1><p>This paper worksheet is for discussion and governed signature outside PERL. The local product accepts only the matching metadata JSON for structural preflight; it cannot verify this page or turn it into authority.</p></div>
      <section class="decision-line" aria-label="Decision options"><span>Decision</span><div>□ Accept</div><div>□ Revise</div><div>□ Decline</div><div>Decision record · FF-DECISION-________________</div></section>
      <section class="return-register" aria-labelledby="return-authority-title"><header><span>01</span><h2 id="return-authority-title">Authority references</h2></header><table><thead><tr><th>Required role</th><th>Identity reference</th><th>Local preflight state</th></tr></thead><tbody>${authorityRows}</tbody></table></section>
      <section class="return-register" aria-labelledby="return-evidence-title"><header><span>02</span><h2 id="return-evidence-title">Evidence references</h2></header><table><thead><tr><th>Requirement</th><th>Governed reference</th><th>Local preflight state</th></tr></thead><tbody>${evidenceRows}</tbody></table></section>
      <section class="signature-boundary"><div><span>Decision date</span><strong>____ / ____ / ______</strong></div><div><span>Conditions / dissent</span><strong>Governed decision record only</strong></div><div><span>Trusted signature</span><strong>Outside PERL</strong></div></section>
      <footer class="return-warning"><strong>This is not a signature surface.</strong><p>${escapeHtml(DECISION_EXCHANGE_BOUNDARY)}</p></footer>
      <div class="sheet-boundary">Return metadata may be preflighted · identity, evidence, signature, authority, and acceptance stay unverified</div>
    </section>
  </main><script src="/decision-exchange-print.js"></script></body></html>`;
}
