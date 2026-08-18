import { createHash, randomUUID } from "node:crypto";

export const MODEL_TRIAL_CONTRACT = "perl-model-trial-preflight/1.0";

export const MODEL_TRIAL_BOUNDARY = "This bench preflights metadata for exactly three AI-engine candidates against one fixed evidence standard. It receives no credentials, endpoints, file bytes, model output, assessment records, raw responses, patient identifiers, Findings content, or PHI and performs no provider call or external transfer. A complete manifest does not verify vendor claims, approve privacy or security, establish clinical performance, select an engine, authorize a pilot or production release, or permit patient use. Named security, privacy, clinical, engineering, legal, and independent-review owners must inspect governed evidence and sign the final selection outside this synthetic sandbox.";

export const MODEL_TRIAL_SLOTS = Object.freeze([
  Object.freeze({ id: "candidate-01", index: "01", label: "Candidate 01" }),
  Object.freeze({ id: "candidate-02", index: "02", label: "Candidate 02" }),
  Object.freeze({ id: "candidate-03", index: "03", label: "Candidate 03" })
]);

export const MODEL_TRIAL_DOMAINS = Object.freeze([
  Object.freeze({
    id: "privacy-use",
    index: "01",
    label: "Privacy + use terms",
    question: "What happens to data after the request ends?",
    requiredEvidence: Object.freeze(["Retention and deletion", "Training use and subprocessors", "Region, incident notice, and BAA position"])
  }),
  Object.freeze({
    id: "security-architecture",
    index: "02",
    label: "Security architecture",
    question: "Can the provider seam live inside the approved e-QPASS control boundary?",
    requiredEvidence: Object.freeze(["Private networking and service identity", "Secrets, encryption, and access review", "Logs, monitoring, and data-flow diagram"])
  }),
  Object.freeze({
    id: "technical-behavior",
    index: "03",
    label: "Technical behavior",
    question: "Can exact structured output remain versioned, bounded, and fail-closed?",
    requiredEvidence: Object.freeze(["Structured-output contract", "Timeout, rate-limit, and idempotency behavior", "Version pinning, deprecation, and change notice"])
  }),
  Object.freeze({
    id: "clinical-evaluation",
    index: "04",
    label: "Clinical evaluation",
    question: "Does the candidate earn counselor trust on a frozen representative set?",
    requiredEvidence: Object.freeze(["Blind paired review", "Safety and error taxonomy", "Correction burden and reviewer agreement"])
  }),
  Object.freeze({
    id: "operational-fit",
    index: "05",
    label: "Operational fit",
    question: "Can the engine support a dependable provider workflow at a defensible cost?",
    requiredEvidence: Object.freeze(["Latency and availability", "Cost per completed report", "Retry, no-fallback, and rollback behavior"])
  }),
  Object.freeze({
    id: "governance-change",
    index: "06",
    label: "Governance + change control",
    question: "Who can approve the model, prompt, and every future change?",
    requiredEvidence: Object.freeze(["Named accountable owner", "Approved prompt and policy", "Regression gate and signed disposition"])
  })
]);

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;
const SAFE_REGION = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,63}$/;
const SAFE_EVIDENCE_REF = /^FF-EVIDENCE-[A-Z0-9][A-Z0-9._-]{2,79}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const HOSTING_PATTERNS = new Set(["azure-managed", "private-cloud", "vendor-managed", "self-hosted", "other"]);
const CANDIDATE_STATUSES = new Set(["not-declared", "metadata-declared-unverified"]);
const DOMAIN_STATUSES = new Set(["not-supplied", "metadata-declared-unverified"]);

const FALSE_CLAIMS = Object.freeze([
  "credentialsReceived", "endpointReceived", "fileBytesReceived", "modelOutputReceived",
  "recordLevelDataReceived", "patientIdentifiersReceived", "rawResponsesReceived", "phiReceived",
  "externalTransferPerformed", "vendorClaimsVerified", "securityApproved", "privacyApproved",
  "clinicalPerformanceEstablished", "independentReviewComplete", "engineSelected", "phiApproved",
  "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
]);

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`${label} contains fields outside the metadata contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function emptyDomainEvidence() {
  return MODEL_TRIAL_DOMAINS.map(domain => ({
    domainId: domain.id,
    status: "not-supplied",
    evidenceRef: null
  }));
}

export function modelTrialManifestTemplate() {
  return {
    contractVersion: MODEL_TRIAL_CONTRACT,
    trialId: "FF-MODEL-TRIAL-REPLACE-ME",
    environment: "synthetic-calibration",
    authorityStatus: "unverified-candidate-metadata",
    candidates: MODEL_TRIAL_SLOTS.map(slot => ({
      slotId: slot.id,
      status: "not-declared",
      providerId: null,
      modelVersion: null,
      hostingPattern: null,
      region: null,
      domainEvidence: emptyDomainEvidence()
    })),
    privacyBoundary: Object.fromEntries(FALSE_CLAIMS.map(key => [key, false]))
  };
}

export function validateModelTrialContract() {
  const errors = [];
  if (MODEL_TRIAL_SLOTS.length !== 3 || new Set(MODEL_TRIAL_SLOTS.map(slot => slot.id)).size !== 3) errors.push("The model trial must preserve exactly three unique candidate slots.");
  if (MODEL_TRIAL_DOMAINS.length !== 6 || new Set(MODEL_TRIAL_DOMAINS.map(domain => domain.id)).size !== 6) errors.push("The model trial must preserve six unique evidence domains.");
  if (!/exactly three AI-engine candidates/i.test(MODEL_TRIAL_BOUNDARY) || !/does not .*select an engine/i.test(MODEL_TRIAL_BOUNDARY)) errors.push("The model-trial claim boundary is incomplete.");
  return errors;
}

function validateDomainEvidence(items, label, errors) {
  if (!Array.isArray(items) || items.length !== MODEL_TRIAL_DOMAINS.length) {
    errors.push(`${label} must contain the six fixed evidence domains.`);
    return;
  }
  items.forEach((item, index) => {
    const expected = MODEL_TRIAL_DOMAINS[index];
    const itemLabel = `${label}[${index}]`;
    if (!exactKeys(item, ["domainId", "status", "evidenceRef"], itemLabel, errors)) return;
    if (item.domainId !== expected.id) errors.push(`${itemLabel}.domainId must be ${expected.id}.`);
    if (!DOMAIN_STATUSES.has(item.status)) errors.push(`${itemLabel}.status is invalid.`);
    if (item.status === "not-supplied" && item.evidenceRef !== null) errors.push(`${itemLabel}.evidenceRef must be null while evidence is not supplied.`);
    if (item.status === "metadata-declared-unverified" && !SAFE_EVIDENCE_REF.test(String(item.evidenceRef || ""))) errors.push(`${itemLabel}.evidenceRef must be a bounded FF-EVIDENCE reference.`);
  });
}

export function validateModelTrialManifest(manifest) {
  const errors = [];
  const keys = ["contractVersion", "trialId", "environment", "authorityStatus", "candidates", "privacyBoundary"];
  if (!exactKeys(manifest, keys, "Manifest", errors)) return errors;
  if (Buffer.byteLength(JSON.stringify(manifest), "utf8") > 65536) errors.push("Model-trial metadata manifest exceeds the 64 KB limit.");
  if (manifest.contractVersion !== MODEL_TRIAL_CONTRACT) errors.push(`contractVersion must be ${MODEL_TRIAL_CONTRACT}.`);
  if (!/^FF-MODEL-TRIAL-[A-Z0-9-]{3,80}$/.test(String(manifest.trialId || ""))) errors.push("trialId must be a visibly synthetic FF-MODEL-TRIAL reference.");
  if (manifest.environment !== "synthetic-calibration") errors.push("The bench accepts synthetic-calibration metadata only.");
  if (manifest.authorityStatus !== "unverified-candidate-metadata") errors.push("authorityStatus must remain unverified-candidate-metadata.");
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length !== MODEL_TRIAL_SLOTS.length) {
    errors.push("candidates must contain the three fixed engine slots.");
  } else {
    manifest.candidates.forEach((candidate, index) => {
      const expected = MODEL_TRIAL_SLOTS[index];
      const label = `candidates[${index}]`;
      const candidateKeys = ["slotId", "status", "providerId", "modelVersion", "hostingPattern", "region", "domainEvidence"];
      if (!exactKeys(candidate, candidateKeys, label, errors)) return;
      if (candidate.slotId !== expected.id) errors.push(`${label}.slotId must be ${expected.id}.`);
      if (!CANDIDATE_STATUSES.has(candidate.status)) errors.push(`${label}.status is invalid.`);
      validateDomainEvidence(candidate.domainEvidence, `${label}.domainEvidence`, errors);
      if (candidate.status === "not-declared") {
        for (const key of ["providerId", "modelVersion", "hostingPattern", "region"]) if (candidate[key] !== null) errors.push(`${label}.${key} must be null while the candidate is not declared.`);
        if (Array.isArray(candidate.domainEvidence) && candidate.domainEvidence.some(item => item.status !== "not-supplied" || item.evidenceRef !== null)) errors.push(`${label}.domainEvidence must remain empty while the candidate is not declared.`);
      } else {
        if (!SAFE_ID.test(String(candidate.providerId || ""))) errors.push(`${label}.providerId is invalid.`);
        if (!SAFE_ID.test(String(candidate.modelVersion || ""))) errors.push(`${label}.modelVersion is invalid.`);
        if (!HOSTING_PATTERNS.has(candidate.hostingPattern)) errors.push(`${label}.hostingPattern is invalid.`);
        if (!SAFE_REGION.test(String(candidate.region || ""))) errors.push(`${label}.region is invalid.`);
      }
    });
  }
  if (exactKeys(manifest.privacyBoundary, FALSE_CLAIMS, "privacyBoundary", errors)) {
    for (const key of FALSE_CLAIMS) if (manifest.privacyBoundary[key] !== false) errors.push(`privacyBoundary.${key} must remain false.`);
  }
  return [...new Set(errors)];
}

function candidateResults(candidates) {
  return MODEL_TRIAL_SLOTS.map((slot, index) => {
    const candidate = candidates[index];
    const metadataDeclared = candidate.status === "metadata-declared-unverified";
    const providerIdentityDeclared = metadataDeclared && SAFE_ID.test(String(candidate.providerId || ""));
    const modelVersionDeclared = metadataDeclared && SAFE_ID.test(String(candidate.modelVersion || ""));
    const deploymentMetadataDeclared = metadataDeclared && HOSTING_PATTERNS.has(candidate.hostingPattern) && SAFE_REGION.test(String(candidate.region || ""));
    const domainEvidenceDeclared = (candidate.domainEvidence || []).filter(item => item.status === "metadata-declared-unverified").length;
    const domainEvidenceComplete = domainEvidenceDeclared === MODEL_TRIAL_DOMAINS.length
      && candidate.domainEvidence.every(item => SAFE_EVIDENCE_REF.test(String(item.evidenceRef || "")));
    const metadataComplete = providerIdentityDeclared && modelVersionDeclared && deploymentMetadataDeclared && domainEvidenceComplete;
    return {
      slotId: slot.id,
      metadataDeclared,
      providerIdentityDeclared,
      modelVersionDeclared,
      deploymentMetadataDeclared,
      domainEvidenceDeclared,
      domainEvidenceComplete,
      metadataComplete,
      candidateFingerprint: metadataDeclared ? digest(candidate) : null
    };
  });
}

function resultCounts(results) {
  return {
    slotsRequired: MODEL_TRIAL_SLOTS.length,
    candidatesDeclared: results.filter(result => result.metadataDeclared).length,
    metadataComplete: results.filter(result => result.metadataComplete).length,
    missing: results.filter(result => !result.metadataDeclared).length,
    domainEvidenceRequired: MODEL_TRIAL_SLOTS.length * MODEL_TRIAL_DOMAINS.length,
    domainEvidenceDeclared: results.reduce((sum, result) => sum + result.domainEvidenceDeclared, 0)
  };
}

function validateEvidenceSnapshot(snapshot, errors) {
  const keys = ["caseSet", "syntheticCases", "generationRecords", "generationChainHead", "policyVersion", "policyHash", "outputGateCount", "activeProvider"];
  if (!exactKeys(snapshot, keys, "evidenceSnapshot", errors)) return;
  if (exactKeys(snapshot.caseSet, ["id", "version", "manifestHash"], "evidenceSnapshot.caseSet", errors)) {
    if (!SAFE_ID.test(String(snapshot.caseSet.id || "")) || !SAFE_ID.test(String(snapshot.caseSet.version || "")) || !HEX_64.test(String(snapshot.caseSet.manifestHash || ""))) errors.push("evidenceSnapshot.caseSet is invalid.");
  }
  if (!Number.isInteger(snapshot.syntheticCases) || snapshot.syntheticCases < 1) errors.push("evidenceSnapshot.syntheticCases is invalid.");
  if (!Number.isInteger(snapshot.generationRecords) || snapshot.generationRecords < 1) errors.push("evidenceSnapshot.generationRecords is invalid.");
  if (!HEX_64.test(String(snapshot.generationChainHead || ""))) errors.push("evidenceSnapshot.generationChainHead is invalid.");
  if (!SAFE_ID.test(String(snapshot.policyVersion || "")) || !HEX_64.test(String(snapshot.policyHash || ""))) errors.push("evidenceSnapshot policy provenance is invalid.");
  if (snapshot.outputGateCount !== 10) errors.push("evidenceSnapshot.outputGateCount must remain 10.");
  if (exactKeys(snapshot.activeProvider, ["id", "version", "mode", "externalTransmission", "phiApproved"], "evidenceSnapshot.activeProvider", errors)) {
    if (!SAFE_ID.test(String(snapshot.activeProvider.id || "")) || !SAFE_ID.test(String(snapshot.activeProvider.version || "")) || !SAFE_ID.test(String(snapshot.activeProvider.mode || ""))) errors.push("evidenceSnapshot.activeProvider identity is invalid.");
    if (typeof snapshot.activeProvider.externalTransmission !== "boolean" || snapshot.activeProvider.phiApproved !== false) errors.push("evidenceSnapshot.activeProvider boundary is invalid.");
  }
}

export function createModelTrialPreflight({ manifest, evidenceSnapshot, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), requestFingerprint }) {
  const manifestErrors = validateModelTrialManifest(manifest);
  if (manifestErrors.length) throw new Error(manifestErrors.join(" "));
  const snapshotErrors = [];
  validateEvidenceSnapshot(evidenceSnapshot, snapshotErrors);
  if (snapshotErrors.length) throw new Error(snapshotErrors.join(" "));
  const results = candidateResults(manifest.candidates);
  const counts = resultCounts(results);
  const shortlistMetadataComplete = counts.metadataComplete === counts.slotsRequired;
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: MODEL_TRIAL_CONTRACT,
    type: "model-trial-metadata-preflight-recorded",
    status: shortlistMetadataComplete ? "metadata-complete-unverified" : "metadata-incomplete",
    requestFingerprint,
    manifestHash: digest(manifest),
    trialIdHash: digest(manifest.trialId),
    candidateSnapshots: clone(manifest.candidates),
    candidateResults: results,
    counts,
    shortlistMetadataComplete,
    evidenceSnapshot: clone(evidenceSnapshot),
    decision: "engine-selection-not-authorized",
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    actor,
    createdAt,
    note: shortlistMetadataComplete
      ? "Metadata for all three engine candidates was preflighted against the six fixed evidence domains. Every declaration remains unverified and no provider, clinical, privacy, security, pilot, or production decision was recorded."
      : `Candidate metadata remains incomplete: ${counts.metadataComplete} of ${counts.slotsRequired} engine slots have complete-unverified metadata and ${counts.domainEvidenceDeclared} of ${counts.domainEvidenceRequired} evidence references are declared. No engine-selection decision was recorded.`
  };
  return { ...core, hash: digest(core) };
}

export function validateModelTrialPreflight(event, expected = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "status", "requestFingerprint", "manifestHash", "trialIdHash",
    "candidateSnapshots", "candidateResults", "counts", "shortlistMetadataComplete", "evidenceSnapshot", "decision", ...FALSE_CLAIMS,
    "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Model-trial preflight", errors)) return errors;
  if (event.contractVersion !== MODEL_TRIAL_CONTRACT || event.type !== "model-trial-metadata-preflight-recorded") errors.push("Model-trial preflight identity is invalid.");
  if (!Number.isInteger(event.sequence) || event.sequence < 1 || (expected.sequence && event.sequence !== expected.sequence)) errors.push("Model-trial preflight sequence is invalid.");
  if (!/^(GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || "")) || (expected.previousHash && event.previousHash !== expected.previousHash)) errors.push("Model-trial preflight previousHash is invalid.");
  for (const key of ["requestFingerprint", "manifestHash", "trialIdHash", "hash"]) if (!HEX_64.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  const manifestLike = {
    contractVersion: MODEL_TRIAL_CONTRACT,
    trialId: "FF-MODEL-TRIAL-VALIDATE",
    environment: "synthetic-calibration",
    authorityStatus: "unverified-candidate-metadata",
    candidates: event.candidateSnapshots,
    privacyBoundary: Object.fromEntries(FALSE_CLAIMS.map(key => [key, false]))
  };
  const snapshotErrors = validateModelTrialManifest(manifestLike).filter(error => !/trialId/i.test(error));
  errors.push(...snapshotErrors.map(error => `candidateSnapshots: ${error}`));
  const expectedResults = Array.isArray(event.candidateSnapshots) && event.candidateSnapshots.length === 3 ? candidateResults(event.candidateSnapshots) : [];
  const expectedCounts = resultCounts(expectedResults);
  if (JSON.stringify(event.candidateResults) !== JSON.stringify(expectedResults)) errors.push("Candidate result metadata is inconsistent.");
  if (JSON.stringify(event.counts) !== JSON.stringify(expectedCounts)) errors.push("Model-trial counts are inconsistent.");
  const complete = expectedCounts.metadataComplete === expectedCounts.slotsRequired;
  if (event.shortlistMetadataComplete !== complete || event.status !== (complete ? "metadata-complete-unverified" : "metadata-incomplete")) errors.push("Model-trial completion status is inconsistent.");
  validateEvidenceSnapshot(event.evidenceSnapshot, errors);
  if (event.decision !== "engine-selection-not-authorized") errors.push("Engine selection must remain unauthorized.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Model-trial actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt)) || typeof event.note !== "string" || event.note.length < 120 || event.note.length > 500) errors.push("Model-trial timestamp or note is invalid.");
  const { hash, ...core } = event;
  if (digest(core) !== hash) errors.push("Model-trial preflight fingerprint is invalid.");
  return [...new Set(errors)];
}

export function buildModelTrialBench({ events = [], chain = { valid: true, count: 0, failedAt: null, head: null, preflights: 0 }, evidenceSnapshot, generatedAt = new Date().toISOString() } = {}) {
  const template = modelTrialManifestTemplate();
  const requestFingerprint = digest({
    contractVersion: MODEL_TRIAL_CONTRACT,
    slots: MODEL_TRIAL_SLOTS,
    domains: MODEL_TRIAL_DOMAINS,
    privacyBoundary: template.privacyBoundary,
    boundary: MODEL_TRIAL_BOUNDARY
  });
  const latest = events.at(-1) || null;
  const results = latest?.candidateResults || candidateResults(template.candidates);
  const counts = latest?.counts || resultCounts(results);
  const snapshots = latest?.candidateSnapshots || template.candidates;
  const candidates = MODEL_TRIAL_SLOTS.map((slot, index) => ({
    ...slot,
    status: results[index]?.metadataComplete
      ? "candidate-metadata-complete-unverified"
      : results[index]?.metadataDeclared ? "candidate-metadata-incomplete" : "awaiting-candidate-metadata",
    providerId: snapshots[index]?.providerId || null,
    modelVersion: snapshots[index]?.modelVersion || null,
    hostingPattern: snapshots[index]?.hostingPattern || null,
    region: snapshots[index]?.region || null,
    domainEvidence: MODEL_TRIAL_DOMAINS.map((domain, domainIndex) => ({
      domainId: domain.id,
      status: snapshots[index]?.domainEvidence?.[domainIndex]?.status || "not-supplied",
      evidenceRef: snapshots[index]?.domainEvidence?.[domainIndex]?.evidenceRef || null
    })),
    fingerprint: results[index]?.candidateFingerprint || null
  }));
  return {
    contractVersion: MODEL_TRIAL_CONTRACT,
    status: latest
      ? latest.shortlistMetadataComplete ? "metadata-complete-external-review-required" : "candidate-metadata-incomplete"
      : "awaiting-candidate-metadata",
    headline: "Three candidates. One standard.",
    descriptor: "A metadata-only engine shortlist for Dolores’s provider-side AI decision.",
    baseline: evidenceSnapshot?.activeProvider ? clone(evidenceSnapshot.activeProvider) : null,
    baselineRole: "engineering comparator-not-shortlist-candidate",
    domains: clone(MODEL_TRIAL_DOMAINS),
    candidates,
    counts,
    requestTemplate: template,
    requestFingerprint,
    latestPreflight: latest ? clone(latest) : null,
    history: events.map(event => ({ id: event.id, sequence: event.sequence, status: event.status, counts: clone(event.counts), createdAt: event.createdAt, hash: event.hash })),
    chain: clone(chain),
    decision: "engine-selection-not-authorized",
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    boundary: MODEL_TRIAL_BOUNDARY,
    generatedAt,
    benchFingerprint: digest({ contractVersion: MODEL_TRIAL_CONTRACT, slots: MODEL_TRIAL_SLOTS, domains: MODEL_TRIAL_DOMAINS, boundary: MODEL_TRIAL_BOUNDARY })
  };
}

