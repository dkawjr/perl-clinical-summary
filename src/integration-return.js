import { createHash, randomUUID } from "node:crypto";

export const INTEGRATION_RETURN_CONTRACT = "perl-eqpass-owner-return-preflight/1.0";

export const INTEGRATION_RETURN_BOUNDARY = "This desk preflights a metadata-only candidate return from Mike and the named e-QPASS owner. It never receives workbook bytes, assessment records, raw responses, patient identifiers, Findings content, or PHI; it does not authenticate the submitter, accept scoring logic, establish an authoritative source contract, approve a production data flow, connect Azure, authorize integration, or permit clinical use. A complete metadata checklist only makes the external handoff inspectable—the RFI remains open until named owners inspect the governed source artifacts and sign the production contract.";

export const INTEGRATION_RETURN_ARTIFACTS = Object.freeze([
  Object.freeze({
    id: "threshold-response-workbook",
    index: "01",
    label: "Threshold + fixed responses",
    expectedFilename: "meta_thresholds_responses_cs.xlsx",
    expectedMediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    expectedDataClass: "configuration-no-records",
    accountableRoles: Object.freeze(["program-integration-lead", "eqpass-owner", "clinical-lead"]),
    purpose: "Confirm source-owned thresholds and hard-coded response behavior without copying respondent rows."
  }),
  Object.freeze({
    id: "question-category-workbook",
    index: "02",
    label: "Question + category map",
    expectedFilename: "question_categories_capitalized.xlsx",
    expectedMediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    expectedDataClass: "configuration-no-records",
    accountableRoles: Object.freeze(["program-integration-lead", "eqpass-owner", "clinical-lead"]),
    purpose: "Confirm the authoritative question-to-construct map and current production labels."
  }),
  Object.freeze({
    id: "authoritative-scored-event",
    index: "03",
    label: "Authoritative scored event",
    expectedFilename: "eqpass-authoritative-scored-event.deidentified.json",
    expectedMediaType: "application/json",
    expectedDataClass: "deidentified-fixture-metadata",
    accountableRoles: Object.freeze(["eqpass-owner", "security-privacy-owner"]),
    purpose: "Replace the RFI-shaped rehearsal with a governed de-identified event candidate."
  }),
  Object.freeze({
    id: "field-dictionary",
    index: "04",
    label: "Field dictionary + code sets",
    expectedFilename: "eqpass-field-dictionary.json",
    expectedMediaType: "application/json",
    expectedDataClass: "interface-documentation",
    accountableRoles: Object.freeze(["eqpass-owner", "clinical-lead"]),
    purpose: "Define every score, level, subscale, critical flag, routing reference, and null rule."
  }),
  Object.freeze({
    id: "scoring-version-manifest",
    index: "05",
    label: "Scoring + instrument versions",
    expectedFilename: "eqpass-scoring-version-manifest.json",
    expectedMediaType: "application/json",
    expectedDataClass: "interface-documentation",
    accountableRoles: Object.freeze(["eqpass-owner", "clinical-lead"]),
    purpose: "Bind formulas, severity bands, GPI authority, item inventory, and deployed instrument version."
  }),
  Object.freeze({
    id: "report-lifecycle",
    index: "06",
    label: "Findings lifecycle + rescoring",
    expectedFilename: "eqpass-report-lifecycle.json",
    expectedMediaType: "application/json",
    expectedDataClass: "interface-documentation",
    accountableRoles: Object.freeze(["eqpass-owner", "engineering-owner"]),
    purpose: "Define finalized, reprinted, rescored, superseded, and failed report states."
  }),
  Object.freeze({
    id: "attachment-interface",
    index: "07",
    label: "PDF attachment interface",
    expectedFilename: "eqpass-pdf-attachment-interface.json",
    expectedMediaType: "application/json",
    expectedDataClass: "interface-documentation",
    accountableRoles: Object.freeze(["eqpass-owner", "engineering-owner"]),
    purpose: "Describe the authenticated merge request, acknowledgement, idempotency, and supersession behavior."
  }),
  Object.freeze({
    id: "security-data-flow",
    index: "08",
    label: "Security + data-flow decision",
    expectedFilename: "eqpass-security-data-flow.json",
    expectedMediaType: "application/json",
    expectedDataClass: "security-control-documentation",
    accountableRoles: Object.freeze(["security-privacy-owner", "eqpass-owner"]),
    purpose: "Classify every field and name the Azure, identity, retention, logging, backup, and model boundary."
  })
]);

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const DATA_CLASSES = new Set([
  "configuration-no-records",
  "deidentified-fixture-metadata",
  "interface-documentation",
  "security-control-documentation"
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
  const actual = Object.keys(value);
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = actual.filter(key => !keys.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`${label} contains fields outside the metadata contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

export function integrationReturnManifestTemplate() {
  return {
    contractVersion: INTEGRATION_RETURN_CONTRACT,
    returnId: "FF-RETURN-REPLACE-ME",
    environment: "calibration",
    authorityStatus: "unverified-candidate",
    artifacts: INTEGRATION_RETURN_ARTIFACTS.map(item => ({
      id: item.id,
      status: "not-supplied",
      filename: item.expectedFilename,
      version: null,
      sha256: null,
      mediaType: null,
      dataClass: null
    })),
    privacyBoundary: {
      fileBytesIncluded: false,
      recordLevelDataIncluded: false,
      patientIdentifiersIncluded: false,
      rawResponsesIncluded: false,
      findingsContentIncluded: false,
      externalTransferPerformed: false,
      phiApprovalRecorded: false,
      ownerIdentityVerified: false,
      authoritativeContractAccepted: false,
      productionIntegrationAuthorized: false
    }
  };
}

export function validateIntegrationReturnContract() {
  const errors = [];
  if (INTEGRATION_RETURN_ARTIFACTS.length !== 8) errors.push("The owner return requires eight fixed artifact classes.");
  if (new Set(INTEGRATION_RETURN_ARTIFACTS.map(item => item.id)).size !== 8) errors.push("Owner-return artifact IDs must be unique.");
  if (new Set(INTEGRATION_RETURN_ARTIFACTS.map(item => item.expectedFilename)).size !== 8) errors.push("Owner-return filenames must be unique.");
  const names = INTEGRATION_RETURN_ARTIFACTS.map(item => item.expectedFilename);
  if (!names.includes("meta_thresholds_responses_cs.xlsx") || !names.includes("question_categories_capitalized.xlsx")) errors.push("The two source-named Mike workbooks must stay explicit in the return contract.");
  if (INTEGRATION_RETURN_BOUNDARY.length < 420 || !/RFI remains open/i.test(INTEGRATION_RETURN_BOUNDARY)) errors.push("The owner-return claim boundary is incomplete.");
  return errors;
}

export function validateIntegrationReturnManifest(manifest) {
  const errors = [];
  const manifestKeys = ["contractVersion", "returnId", "environment", "authorityStatus", "artifacts", "privacyBoundary"];
  if (!exactKeys(manifest, manifestKeys, "Manifest", errors)) return errors;
  if (manifest.contractVersion !== INTEGRATION_RETURN_CONTRACT) errors.push(`contractVersion must be ${INTEGRATION_RETURN_CONTRACT}.`);
  if (!/^FF-RETURN-[A-Z0-9-]{3,80}$/.test(String(manifest.returnId || ""))) errors.push("returnId must be a visibly synthetic FF-RETURN reference.");
  if (manifest.environment !== "calibration") errors.push("The local preflight accepts calibration metadata only.");
  if (manifest.authorityStatus !== "unverified-candidate") errors.push("authorityStatus must remain unverified-candidate.");
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== INTEGRATION_RETURN_ARTIFACTS.length) {
    errors.push("artifacts must contain the eight fixed return classes.");
  } else {
    manifest.artifacts.forEach((artifact, index) => {
      const expected = INTEGRATION_RETURN_ARTIFACTS[index];
      const label = `artifacts[${index}]`;
      const keys = ["id", "status", "filename", "version", "sha256", "mediaType", "dataClass"];
      if (!exactKeys(artifact, keys, label, errors)) return;
      if (artifact.id !== expected.id) errors.push(`${label}.id must be ${expected.id}.`);
      if (!["not-supplied", "metadata-declared-unverified"].includes(artifact.status)) errors.push(`${label}.status must be not-supplied or metadata-declared-unverified.`);
      if (typeof artifact.filename !== "string" || !SAFE_FILENAME.test(artifact.filename)) errors.push(`${label}.filename must be a safe metadata-only filename.`);
      if (artifact.status === "not-supplied") {
        for (const key of ["version", "sha256", "mediaType", "dataClass"]) if (artifact[key] !== null) errors.push(`${label}.${key} must be null while the artifact is not supplied.`);
      } else {
        if (typeof artifact.version !== "string" || !SAFE_VERSION.test(artifact.version)) errors.push(`${label}.version is invalid.`);
        if (typeof artifact.sha256 !== "string" || !HEX_64.test(artifact.sha256)) errors.push(`${label}.sha256 must be a lowercase SHA-256 digest.`);
        if (typeof artifact.mediaType !== "string" || artifact.mediaType.length < 4 || artifact.mediaType.length > 120) errors.push(`${label}.mediaType is invalid.`);
        if (!DATA_CLASSES.has(artifact.dataClass)) errors.push(`${label}.dataClass is invalid.`);
      }
    });
  }
  const privacyKeys = [
    "fileBytesIncluded", "recordLevelDataIncluded", "patientIdentifiersIncluded", "rawResponsesIncluded",
    "findingsContentIncluded", "externalTransferPerformed", "phiApprovalRecorded", "ownerIdentityVerified",
    "authoritativeContractAccepted", "productionIntegrationAuthorized"
  ];
  if (exactKeys(manifest.privacyBoundary, privacyKeys, "privacyBoundary", errors)) {
    for (const key of privacyKeys) if (manifest.privacyBoundary[key] !== false) errors.push(`privacyBoundary.${key} must remain false.`);
  }
  return [...new Set(errors)];
}

function artifactResults(manifest) {
  return INTEGRATION_RETURN_ARTIFACTS.map((expected, index) => {
    const artifact = manifest.artifacts[index];
    const metadataDeclared = artifact.status === "metadata-declared-unverified";
    const filenameMatches = artifact.filename === expected.expectedFilename;
    const mediaTypeMatches = metadataDeclared && artifact.mediaType === expected.expectedMediaType;
    const dataClassMatches = metadataDeclared && artifact.dataClass === expected.expectedDataClass;
    const metadataComplete = metadataDeclared
      && filenameMatches
      && mediaTypeMatches
      && dataClassMatches
      && SAFE_VERSION.test(artifact.version)
      && HEX_64.test(artifact.sha256);
    return {
      id: expected.id,
      expectedFilename: expected.expectedFilename,
      metadataDeclared,
      filenameMatches,
      mediaTypeMatches,
      dataClassMatches,
      metadataComplete,
      candidateDataClass: metadataDeclared ? artifact.dataClass : null
    };
  });
}

function resultCounts(results) {
  return {
    required: INTEGRATION_RETURN_ARTIFACTS.length,
    metadataDeclared: results.filter(result => result.metadataDeclared).length,
    metadataComplete: results.filter(result => result.metadataComplete).length,
    missing: results.filter(result => !result.metadataDeclared).length,
    workbookMetadataDeclared: results.slice(0, 2).filter(result => result.metadataDeclared).length,
    exactWorkbookFilenameMatches: results.slice(0, 2).filter(result => result.metadataDeclared && result.filenameMatches).length
  };
}

export function createIntegrationReturnPreflight({ manifest, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID(), requestFingerprint }) {
  const manifestErrors = validateIntegrationReturnManifest(manifest);
  if (manifestErrors.length) throw new Error(manifestErrors.join(" "));
  const results = artifactResults(manifest);
  const counts = resultCounts(results);
  const metadataChecklistComplete = counts.metadataComplete === counts.required;
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: INTEGRATION_RETURN_CONTRACT,
    type: "eqpass-owner-return-metadata-preflight-recorded",
    status: metadataChecklistComplete ? "metadata-complete-unverified" : "metadata-incomplete",
    requestFingerprint,
    manifestHash: digest(manifest),
    candidateReturnIdHash: digest(manifest.returnId),
    artifactResults: results,
    counts,
    metadataChecklistComplete,
    decision: "rfi-remains-open",
    fileBytesReceived: false,
    recordLevelDataReceived: false,
    patientIdentifiersReceived: false,
    rawResponsesReceived: false,
    findingsContentReceived: false,
    externalTransferPerformed: false,
    phiApproved: false,
    ownerIdentityVerified: false,
    authoritativeContractAccepted: false,
    scoringLogicAccepted: false,
    productionIntegrationAuthorized: false,
    clinicalUseAuthorized: false,
    actor,
    createdAt,
    note: "Metadata-only preflight recorded. No source bytes or record-level content were received; owner identity and every authoritative integration decision remain external."
  };
  return { ...core, hash: digest(core) };
}

export function validateIntegrationReturnPreflight(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Owner-return preflight event is required."];
  const { hash, ...core } = event;
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1) errors.push("Preflight sequence is invalid.");
  if (event.previousHash !== previousHash || !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Preflight previous hash is invalid.");
  if (event.contractVersion !== INTEGRATION_RETURN_CONTRACT || event.type !== "eqpass-owner-return-metadata-preflight-recorded") errors.push("Preflight contract identity is invalid.");
  for (const key of ["requestFingerprint", "manifestHash", "candidateReturnIdHash"]) if (!HEX_64.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  if (!Array.isArray(event.artifactResults) || event.artifactResults.length !== 8) {
    errors.push("Preflight artifact results are incomplete.");
  } else {
    event.artifactResults.forEach((result, index) => {
      const expected = INTEGRATION_RETURN_ARTIFACTS[index];
      if (result.id !== expected.id || result.expectedFilename !== expected.expectedFilename) errors.push(`Artifact result ${index + 1} is not the fixed return class.`);
      for (const key of ["metadataDeclared", "filenameMatches", "mediaTypeMatches", "dataClassMatches", "metadataComplete"]) if (typeof result[key] !== "boolean") errors.push(`Artifact result ${index + 1}.${key} must be boolean.`);
      if (result.candidateDataClass !== null && !DATA_CLASSES.has(result.candidateDataClass)) errors.push(`Artifact result ${index + 1} data class is invalid.`);
      const expectedComplete = result.metadataDeclared && result.filenameMatches && result.mediaTypeMatches && result.dataClassMatches;
      if (result.metadataComplete !== expectedComplete) errors.push(`Artifact result ${index + 1} metadata state is inconsistent.`);
    });
  }
  const recomputed = Array.isArray(event.artifactResults) && event.artifactResults.length === 8 ? resultCounts(event.artifactResults) : null;
  if (!recomputed || JSON.stringify(event.counts) !== JSON.stringify(recomputed)) errors.push("Preflight counts are invalid.");
  const complete = recomputed?.metadataComplete === 8;
  if (event.metadataChecklistComplete !== complete) errors.push("Metadata checklist completion is invalid.");
  if (event.status !== (complete ? "metadata-complete-unverified" : "metadata-incomplete")) errors.push("Preflight status is invalid.");
  if (event.decision !== "rfi-remains-open") errors.push("Preflight decision must keep the RFI open.");
  for (const key of [
    "fileBytesReceived", "recordLevelDataReceived", "patientIdentifiersReceived", "rawResponsesReceived",
    "findingsContentReceived", "externalTransferPerformed", "phiApproved", "ownerIdentityVerified",
    "authoritativeContractAccepted", "scoringLogicAccepted", "productionIntegrationAuthorized", "clinicalUseAuthorized"
  ]) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Preflight actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt))) errors.push("Preflight timestamp is invalid.");
  if (typeof event.note !== "string" || event.note.length < 100) errors.push("Preflight note is incomplete.");
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Preflight fingerprint is invalid.");
  return [...new Set(errors)];
}

export function buildIntegrationReturnDesk({ events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const contractErrors = validateIntegrationReturnContract();
  if (contractErrors.length) throw new Error(contractErrors.join(" "));
  const requestCore = {
    contractVersion: INTEGRATION_RETURN_CONTRACT,
    status: "metadata-request-only",
    preparedFor: "Mike and the named e-QPASS technical owner",
    requestQuestion: "Can the production owner return the exact source, scoring, lifecycle, attachment, and control metadata needed to replace the local RFI rehearsal without sending patient files through this desk?",
    artifacts: clone(INTEGRATION_RETURN_ARTIFACTS),
    manifestTemplate: integrationReturnManifestTemplate(),
    boundary: INTEGRATION_RETURN_BOUNDARY
  };
  const requestFingerprint = digest(requestCore);
  const latest = events.at(-1) || null;
  const currentResults = latest?.artifactResults || INTEGRATION_RETURN_ARTIFACTS.map(item => ({
    id: item.id,
    expectedFilename: item.expectedFilename,
    metadataDeclared: false,
    filenameMatches: false,
    mediaTypeMatches: false,
    dataClassMatches: false,
    metadataComplete: false,
    candidateDataClass: null
  }));
  const currentCounts = latest?.counts || resultCounts(currentResults);
  const artifacts = INTEGRATION_RETURN_ARTIFACTS.map((artifact, index) => ({
    ...clone(artifact),
    preflight: clone(currentResults[index]),
    status: currentResults[index].metadataComplete
      ? "candidate-metadata-complete-unverified"
      : currentResults[index].metadataDeclared
        ? "candidate-metadata-needs-correction"
        : "not-supplied"
  }));
  return {
    contractVersion: INTEGRATION_RETURN_CONTRACT,
    status: latest ? latest.status : "return-package-not-received",
    headline: "Bring back the contract, not the records.",
    preparedFor: requestCore.preparedFor,
    requestQuestion: requestCore.requestQuestion,
    artifacts,
    counts: clone(currentCounts),
    requestFingerprint,
    manifestTemplate: clone(requestCore.manifestTemplate),
    latestPreflight: latest ? clone(latest) : null,
    history: events.map(event => ({
      id: event.id,
      sequence: event.sequence,
      actor: event.actor,
      createdAt: event.createdAt,
      status: event.status,
      metadataComplete: event.counts.metadataComplete,
      hash: event.hash
    })),
    chain: clone(chain),
    fileBytesReceived: false,
    recordLevelDataReceived: false,
    patientIdentifiersReceived: false,
    rawResponsesReceived: false,
    findingsContentReceived: false,
    externalTransferPerformed: false,
    phiApproved: false,
    ownerIdentityVerified: false,
    authoritativeContractAccepted: false,
    scoringLogicAccepted: false,
    productionIntegrationAuthorized: false,
    clinicalUseAuthorized: false,
    boundary: INTEGRATION_RETURN_BOUNDARY,
    generatedAt
  };
}

