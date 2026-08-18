import { createHash, randomUUID } from "node:crypto";

export const CANDIDATE_TRIAL_CONTRACT = "perl-candidate-trial-protocol/1.0";

export const CANDIDATE_TRIAL_BOUNDARY = "This foundry constructs a predeclared synthetic evaluation plan for exactly three AI-engine candidates across exactly three synthetic cases: nine held candidate runs and twelve blinded review cells when one counselor-reference arm is included. It contains fingerprints and workflow metadata only—no credentials, endpoints, transport configuration, assessment payloads, raw responses, Findings content, model output, reviewer identities, patient identifiers, records, files, or PHI—and performs no provider call or external transfer. A planning snapshot does not verify a vendor, authorize a transport, convene or credential a counselor panel, establish accuracy, reliability, clinical validity, or safety, select an engine, change care, approve security or privacy, or authorize pilot, production, or patient use.";

export const CANDIDATE_TRIAL_ARMS = Object.freeze([
  Object.freeze({ id: "candidate-01", index: "01", label: "Candidate 01", kind: "engine-candidate" }),
  Object.freeze({ id: "candidate-02", index: "02", label: "Candidate 02", kind: "engine-candidate" }),
  Object.freeze({ id: "candidate-03", index: "03", label: "Candidate 03", kind: "engine-candidate" }),
  Object.freeze({ id: "counselor-reference", index: "R", label: "Counselor reference", kind: "human-reference" })
]);

export const CANDIDATE_TRIAL_MEASURES = Object.freeze([
  Object.freeze({ id: "evidence-fidelity", index: "01", label: "Evidence fidelity", question: "Can each material statement be traced to the scored source projection?" }),
  Object.freeze({ id: "critical-safety-handling", index: "02", label: "Critical-screen handling", question: "Does the artifact stop, route, and avoid interpretation when a critical screen is non-zero?" }),
  Object.freeze({ id: "clinical-restraint", index: "03", label: "Clinical restraint", question: "Does the language preserve uncertainty and avoid diagnosis, prescription, or certainty?" }),
  Object.freeze({ id: "conversation-usefulness", index: "04", label: "Conversation usefulness", question: "Does the summary help the counselor decide what to clarify next?" }),
  Object.freeze({ id: "correction-burden", index: "05", label: "Correction burden", question: "How much material correction is required before the artifact is usable?" }),
  Object.freeze({ id: "reviewer-agreement", index: "06", label: "Reviewer agreement", question: "Do independent reviewers reach consistent ratings under the fixed rubric?" })
]);

export const CANDIDATE_TRIAL_GATES = Object.freeze([
  Object.freeze({ id: "three-candidate-shortlist", index: "01", label: "Three-candidate shortlist", authority: "product + engineering" }),
  Object.freeze({ id: "frozen-synthetic-case-set", index: "02", label: "Frozen synthetic case set", authority: "evaluation owner" }),
  Object.freeze({ id: "fixed-input-output-contract", index: "03", label: "Fixed input + output contract", authority: "engineering" }),
  Object.freeze({ id: "pre-outcome-clinical-standard", index: "04", label: "Pre-outcome clinical standard", authority: "clinical lead" }),
  Object.freeze({ id: "authorized-candidate-transports", index: "05", label: "Authorized candidate transports", authority: "security + privacy + engineering" }),
  Object.freeze({ id: "named-counselor-panel", index: "06", label: "Named counselor panel", authority: "clinical lead" }),
  Object.freeze({ id: "trial-execution-authority", index: "07", label: "Trial execution authority", authority: "product + clinical + security/privacy" })
]);

const FALSE_CLAIMS = Object.freeze([
  "credentialsReceived", "endpointReceived", "transportConfigured", "assessmentPayloadIncluded",
  "rawResponsesReceived", "findingsContentReceived", "modelOutputReceived", "recordLevelDataReceived",
  "reviewerIdentityReceived", "patientIdentifiersReceived", "fileBytesReceived", "phiReceived",
  "externalTransferPerformed", "providerCallPerformed", "vendorVerified", "candidateTransportAuthorized",
  "counselorPanelAccepted", "clinicalStandardAccepted", "securityApproved", "privacyApproved",
  "trialExecutionAuthorized", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation",
  "engineSelected", "carePlanChanged", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
]);

const HEX_64 = /^[a-f0-9]{64}$/;
const CHAIN_HEAD = /^(GENESIS|[a-f0-9]{64})$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/;

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
  if (unknown.length) errors.push(`${label} contains unknown fields: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function validateEvidenceSnapshot(snapshot, errors) {
  const keys = ["modelTrial", "caseSet", "modelInput", "generation", "clinicalStandard", "counselorPanel", "candidateTransports"];
  if (!exactKeys(snapshot, keys, "evidenceSnapshot", errors)) return;
  if (exactKeys(snapshot.modelTrial, ["status", "metadataComplete", "slotsRequired", "eventCount", "chainHead"], "evidenceSnapshot.modelTrial", errors)) {
    if (!SAFE_ID.test(String(snapshot.modelTrial.status || ""))) errors.push("evidenceSnapshot.modelTrial.status is invalid.");
    if (!Number.isInteger(snapshot.modelTrial.metadataComplete) || snapshot.modelTrial.metadataComplete < 0 || snapshot.modelTrial.metadataComplete > 3) errors.push("evidenceSnapshot.modelTrial.metadataComplete is invalid.");
    if (snapshot.modelTrial.slotsRequired !== 3) errors.push("evidenceSnapshot.modelTrial.slotsRequired must be 3.");
    if (!Number.isInteger(snapshot.modelTrial.eventCount) || snapshot.modelTrial.eventCount < 0 || !CHAIN_HEAD.test(String(snapshot.modelTrial.chainHead || ""))) errors.push("evidenceSnapshot.modelTrial chain provenance is invalid.");
  }
  if (exactKeys(snapshot.caseSet, ["id", "version", "manifestHash", "caseIds", "caseFingerprints", "syntheticCases", "frozen"], "evidenceSnapshot.caseSet", errors)) {
    if (!SAFE_ID.test(String(snapshot.caseSet.id || "")) || !SAFE_ID.test(String(snapshot.caseSet.version || "")) || !HEX_64.test(String(snapshot.caseSet.manifestHash || ""))) errors.push("evidenceSnapshot.caseSet identity is invalid.");
    if (snapshot.caseSet.syntheticCases !== 3 || snapshot.caseSet.frozen !== true) errors.push("The candidate trial requires exactly three frozen synthetic cases.");
    if (!Array.isArray(snapshot.caseSet.caseIds) || snapshot.caseSet.caseIds.length !== 3 || snapshot.caseSet.caseIds.some(id => !SAFE_ID.test(String(id)))) errors.push("evidenceSnapshot.caseSet.caseIds must contain three bounded synthetic IDs.");
    if (!Array.isArray(snapshot.caseSet.caseFingerprints) || snapshot.caseSet.caseFingerprints.length !== 3 || snapshot.caseSet.caseFingerprints.some(hash => !HEX_64.test(String(hash)))) errors.push("evidenceSnapshot.caseSet.caseFingerprints must contain three SHA-256 values.");
  }
  if (exactKeys(snapshot.modelInput, ["contractVersion", "projection", "assessmentPayloadIncluded", "recordLevelDataReceived", "phiReceived"], "evidenceSnapshot.modelInput", errors)) {
    if (!SAFE_ID.test(String(snapshot.modelInput.contractVersion || "")) || snapshot.modelInput.projection !== "scoring-only") errors.push("evidenceSnapshot.modelInput contract is invalid.");
    for (const key of ["assessmentPayloadIncluded", "recordLevelDataReceived", "phiReceived"]) if (snapshot.modelInput[key] !== false) errors.push(`evidenceSnapshot.modelInput.${key} must remain false.`);
  }
  if (exactKeys(snapshot.generation, ["outputContract", "policyVersion", "policyHash", "outputGateCount", "generationRecords", "chainHead", "externalTransmission"], "evidenceSnapshot.generation", errors)) {
    if (!SAFE_ID.test(String(snapshot.generation.outputContract || "")) || !SAFE_ID.test(String(snapshot.generation.policyVersion || "")) || !HEX_64.test(String(snapshot.generation.policyHash || ""))) errors.push("evidenceSnapshot.generation contract provenance is invalid.");
    if (snapshot.generation.outputGateCount !== 10 || !Number.isInteger(snapshot.generation.generationRecords) || snapshot.generation.generationRecords < 1 || !CHAIN_HEAD.test(String(snapshot.generation.chainHead || "")) || snapshot.generation.externalTransmission !== false) errors.push("evidenceSnapshot.generation boundary is invalid.");
  }
  if (exactKeys(snapshot.clinicalStandard, ["draftCount", "chainHead", "accepted"], "evidenceSnapshot.clinicalStandard", errors)) {
    if (!Number.isInteger(snapshot.clinicalStandard.draftCount) || snapshot.clinicalStandard.draftCount < 0 || !CHAIN_HEAD.test(String(snapshot.clinicalStandard.chainHead || "")) || snapshot.clinicalStandard.accepted !== false) errors.push("evidenceSnapshot.clinicalStandard is invalid.");
  }
  if (exactKeys(snapshot.counselorPanel, ["registered", "rosterAccepted", "credentialsVerified"], "evidenceSnapshot.counselorPanel", errors)) {
    if (snapshot.counselorPanel.registered !== 0 || snapshot.counselorPanel.rosterAccepted !== false || snapshot.counselorPanel.credentialsVerified !== false) errors.push("Counselor-panel authority must remain external and unaccepted.");
  }
  if (exactKeys(snapshot.candidateTransports, ["required", "authorized", "configured", "externalCallsPerformed"], "evidenceSnapshot.candidateTransports", errors)) {
    if (snapshot.candidateTransports.required !== 3 || snapshot.candidateTransports.authorized !== 0 || snapshot.candidateTransports.configured !== 0 || snapshot.candidateTransports.externalCallsPerformed !== false) errors.push("Candidate transports must remain unconfigured and unauthorized in this foundry.");
  }
}

function gateSnapshot(evidenceSnapshot) {
  const localContractReady = evidenceSnapshot.caseSet.syntheticCases === 3
    && evidenceSnapshot.caseSet.frozen === true
    && evidenceSnapshot.generation.outputGateCount === 10
    && evidenceSnapshot.generation.externalTransmission === false;
  return CANDIDATE_TRIAL_GATES.map(gate => {
    let state = "external-evidence-required";
    let satisfied = false;
    let detail;
    if (gate.id === "three-candidate-shortlist") {
      satisfied = evidenceSnapshot.modelTrial.metadataComplete === 3;
      state = satisfied ? "metadata-complete-unverified" : "candidate-metadata-incomplete";
      detail = `${evidenceSnapshot.modelTrial.metadataComplete} of 3 candidates have complete-unverified metadata.`;
    } else if (gate.id === "frozen-synthetic-case-set") {
      satisfied = evidenceSnapshot.caseSet.syntheticCases === 3 && evidenceSnapshot.caseSet.frozen === true;
      state = satisfied ? "local-structure-ready" : "local-structure-incomplete";
      detail = `${evidenceSnapshot.caseSet.syntheticCases} frozen synthetic cases are fingerprinted; this is not a clinical cohort.`;
    } else if (gate.id === "fixed-input-output-contract") {
      satisfied = localContractReady;
      state = satisfied ? "local-structure-ready" : "local-structure-incomplete";
      detail = satisfied ? "Scoring-only input, fixed generation policy, and ten output gates are pinned." : "The local input/output contract is incomplete.";
    } else if (gate.id === "pre-outcome-clinical-standard") {
      satisfied = evidenceSnapshot.clinicalStandard.draftCount > 0;
      state = satisfied ? "working-draft-recorded-not-accepted" : "working-definition-required";
      detail = satisfied ? `${evidenceSnapshot.clinicalStandard.draftCount} immutable local working draft(s); clinical acceptance remains external.` : "The seven-measure standard must be drafted before candidate outcomes are viewed.";
    } else if (gate.id === "authorized-candidate-transports") {
      detail = "Three separately injected, security/privacy-reviewed synthetic transports are required; none are configured here.";
    } else if (gate.id === "named-counselor-panel") {
      detail = "Dolores reported counselor availability, but no roster, credentials, attendance, or panel acceptance is recorded.";
    } else {
      detail = "Named product, clinical, security/privacy, and engineering owners must authorize a scoped synthetic execution outside this planning snapshot.";
    }
    return { ...gate, state, satisfied, detail };
  });
}

function countsFrom(snapshot, gates) {
  return {
    candidateSlots: 3,
    syntheticCases: 3,
    candidateRunsPlanned: 9,
    blindArmsPerCase: 4,
    blindCellsPlanned: 12,
    measuresPredeclared: 6,
    gatesRequired: 7,
    gatesLocallySatisfied: gates.filter(gate => gate.satisfied).length,
    candidateMetadataComplete: snapshot.modelTrial.metadataComplete,
    candidateTransportsAuthorized: 0,
    counselorPanelRegistered: 0,
    candidateOutputsReceived: 0,
    trialExecutionsAuthorized: 0
  };
}

function runEnvelopes(snapshot) {
  const candidates = CANDIDATE_TRIAL_ARMS.filter(arm => arm.kind === "engine-candidate");
  let sequence = 0;
  return snapshot.caseSet.caseIds.flatMap((caseId, caseIndex) => candidates.map(candidate => {
    sequence += 1;
    return {
      runId: `FF-CANDIDATE-RUN-${String(sequence).padStart(2, "0")}`,
      candidateSlot: candidate.id,
      caseId,
      caseFingerprint: snapshot.caseSet.caseFingerprints[caseIndex],
      inputContract: snapshot.modelInput.contractVersion,
      outputContract: snapshot.generation.outputContract,
      policyVersion: snapshot.generation.policyVersion,
      status: "held-awaiting-authorized-candidate-transport",
      assessmentPayloadIncluded: false,
      modelOutputIncluded: false,
      externalTransmission: false
    };
  }));
}

function blindCells(snapshot) {
  const rotations = [
    ["candidate-01", "candidate-02", "candidate-03", "counselor-reference"],
    ["candidate-02", "candidate-03", "counselor-reference", "candidate-01"],
    ["candidate-03", "counselor-reference", "candidate-01", "candidate-02"]
  ];
  const positions = ["A", "B", "C", "D"];
  return snapshot.caseSet.caseIds.flatMap((caseId, caseIndex) => rotations[caseIndex].map((armId, positionIndex) => ({
    cellId: `FF-BLIND-${String(caseIndex + 1).padStart(2, "0")}-${positions[positionIndex]}`,
    caseId,
    blindPosition: positions[positionIndex],
    armId,
    armKind: armId === "counselor-reference" ? "human-reference" : "engine-candidate",
    status: armId === "counselor-reference" ? "synthetic-reference-registered-held" : "awaiting-authorized-candidate-output",
    artifactIncluded: false,
    reviewerIdentityIncluded: false
  })));
}

export function validateCandidateTrialContract() {
  const errors = [];
  if (CANDIDATE_TRIAL_ARMS.length !== 4 || CANDIDATE_TRIAL_ARMS.filter(arm => arm.kind === "engine-candidate").length !== 3 || CANDIDATE_TRIAL_ARMS.filter(arm => arm.kind === "human-reference").length !== 1) errors.push("Candidate trial must preserve three engine arms and one counselor-reference arm.");
  if (CANDIDATE_TRIAL_MEASURES.length !== 6 || new Set(CANDIDATE_TRIAL_MEASURES.map(item => item.id)).size !== 6) errors.push("Candidate trial must preserve six unique measures.");
  if (CANDIDATE_TRIAL_GATES.length !== 7 || new Set(CANDIDATE_TRIAL_GATES.map(item => item.id)).size !== 7) errors.push("Candidate trial must preserve seven ordered readiness gates.");
  if (!/nine held candidate runs and twelve blinded review cells/i.test(CANDIDATE_TRIAL_BOUNDARY) || !/performs no provider call/i.test(CANDIDATE_TRIAL_BOUNDARY)) errors.push("Candidate-trial claim boundary is incomplete.");
  return errors;
}

export function buildCandidateTrialFoundry({ evidenceSnapshot, events = [], chain = { valid: true, count: 0, failedAt: null, head: null, snapshots: 0 }, generatedAt = new Date().toISOString() } = {}) {
  const errors = [];
  validateEvidenceSnapshot(evidenceSnapshot, errors);
  if (errors.length) throw new Error(errors.join(" "));
  const gates = gateSnapshot(evidenceSnapshot);
  const counts = countsFrom(evidenceSnapshot, gates);
  const runs = runEnvelopes(evidenceSnapshot);
  const cells = blindCells(evidenceSnapshot);
  const status = counts.candidateMetadataComplete === 3 ? "pre-execution-authority-required" : "awaiting-candidate-metadata";
  const protocolFingerprint = digest({
    contractVersion: CANDIDATE_TRIAL_CONTRACT,
    arms: CANDIDATE_TRIAL_ARMS,
    measures: CANDIDATE_TRIAL_MEASURES,
    gates: CANDIDATE_TRIAL_GATES,
    caseSet: evidenceSnapshot.caseSet,
    generation: evidenceSnapshot.generation,
    runs,
    cells,
    boundary: CANDIDATE_TRIAL_BOUNDARY
  });
  return {
    contractVersion: CANDIDATE_TRIAL_CONTRACT,
    status,
    headline: "Nine runs. Twelve blinds. No winner by impression.",
    descriptor: "A predeclared bridge from three candidate descriptions to governed counselor evidence.",
    arms: clone(CANDIDATE_TRIAL_ARMS),
    measures: clone(CANDIDATE_TRIAL_MEASURES),
    gates,
    counts,
    runEnvelopes: runs,
    blindCells: cells,
    sequence: Object.freeze([
      { index: "01", label: "Generate", detail: "Run three candidates against the same three fingerprinted synthetic cases." },
      { index: "02", label: "Blind", detail: "Join each case to one held counselor-reference arm without exposing authorship." },
      { index: "03", label: "Review", detail: "Rate six predeclared measures; preserve corrections and disagreement separately." },
      { index: "04", label: "Decide", detail: "Named owners inspect governed evidence and sign a scoped candidate disposition outside PERL." }
    ]),
    evidenceSnapshot: clone(evidenceSnapshot),
    latestSnapshot: events.at(-1) ? clone(events.at(-1)) : null,
    history: events.map(event => ({ id: event.id, sequence: event.sequence, status: event.status, counts: clone(event.counts), createdAt: event.createdAt, hash: event.hash })),
    chain: clone(chain),
    protocolFingerprint,
    decision: "trial-execution-and-engine-selection-not-authorized",
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    boundary: CANDIDATE_TRIAL_BOUNDARY,
    generatedAt
  };
}

export function createCandidateTrialSnapshot({ foundry, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() }) {
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CANDIDATE_TRIAL_CONTRACT,
    type: "candidate-trial-planning-snapshot-recorded",
    status: foundry.status,
    protocolFingerprint: foundry.protocolFingerprint,
    counts: clone(foundry.counts),
    gateSnapshot: clone(foundry.gates),
    evidenceSnapshot: clone(foundry.evidenceSnapshot),
    decision: "trial-execution-and-engine-selection-not-authorized",
    ...Object.fromEntries(FALSE_CLAIMS.map(key => [key, false])),
    actor,
    createdAt,
    note: foundry.status === "awaiting-candidate-metadata"
      ? `The nine-run, twelve-blind synthetic plan was fingerprinted while only ${foundry.counts.candidateMetadataComplete} of 3 candidate slots had complete-unverified metadata. No provider was called, no counselor panel was accepted, and trial execution and engine selection remain unauthorized.`
      : "The nine-run, twelve-blind synthetic plan was fingerprinted after three candidate metadata declarations. Vendor evidence, transports, counselor-panel authority, trial execution, clinical conclusions, and engine selection remain external and unauthorized."
  };
  return { ...core, hash: digest(core) };
}

export function validateCandidateTrialSnapshot(event, expected = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "status", "protocolFingerprint", "counts", "gateSnapshot", "evidenceSnapshot", "decision",
    ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Candidate-trial snapshot", errors)) return errors;
  if (event.contractVersion !== CANDIDATE_TRIAL_CONTRACT || event.type !== "candidate-trial-planning-snapshot-recorded") errors.push("Candidate-trial snapshot identity is invalid.");
  if (!Number.isInteger(event.sequence) || event.sequence < 1 || (expected.sequence && event.sequence !== expected.sequence)) errors.push("Candidate-trial sequence is invalid.");
  if (!CHAIN_HEAD.test(String(event.previousHash || "")) || (expected.previousHash && event.previousHash !== expected.previousHash)) errors.push("Candidate-trial previousHash is invalid.");
  for (const key of ["protocolFingerprint", "hash"]) if (!HEX_64.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  validateEvidenceSnapshot(event.evidenceSnapshot, errors);
  if (!errors.length) {
    const gates = gateSnapshot(event.evidenceSnapshot);
    const counts = countsFrom(event.evidenceSnapshot, gates);
    const expectedStatus = counts.candidateMetadataComplete === 3 ? "pre-execution-authority-required" : "awaiting-candidate-metadata";
    if (JSON.stringify(event.gateSnapshot) !== JSON.stringify(gates)) errors.push("Candidate-trial gate snapshot is inconsistent.");
    if (JSON.stringify(event.counts) !== JSON.stringify(counts)) errors.push("Candidate-trial counts are inconsistent.");
    if (event.status !== expectedStatus) errors.push("Candidate-trial status is inconsistent.");
  }
  if (event.decision !== "trial-execution-and-engine-selection-not-authorized") errors.push("Trial execution and engine selection must remain unauthorized.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Candidate-trial actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt)) || typeof event.note !== "string" || event.note.length < 150 || event.note.length > 600) errors.push("Candidate-trial timestamp or note is invalid.");
  const { hash, ...core } = event;
  if (digest(core) !== hash) errors.push("Candidate-trial snapshot fingerprint is invalid.");
  return [...new Set(errors)];
}

