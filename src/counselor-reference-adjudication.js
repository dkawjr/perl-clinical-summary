import { createHash, randomUUID } from "node:crypto";
import { buildCounselorReferenceSource, counselorReferenceSourceHash } from "./counselor-reference.js";

export const COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT = "perl-counselor-reference-adjudication-dossier/1.0";

export const COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY = "This antechamber assembles immutable source-only counselor-reference candidates for a future governed adjudication. Candidate content is revealed only after the current reviewer code has already submitted for that case and at least two distinct reviewer codes are present; author codes remain hidden. Structural overlap is not semantic agreement, majority vote is not clinical acceptance, and a local packet cannot verify identity or independence, assign an adjudicator, accept or freeze a reference, establish accuracy, reliability, or clinical validity, authorize a trial, release production, or permit patient use.";

export const COUNSELOR_REFERENCE_ADJUDICATION_GATES = Object.freeze([
  Object.freeze({ id: "development-manifest", label: "Frozen development manifest", category: "local-structure" }),
  Object.freeze({ id: "source-lineage", label: "Current source-profile lineage", category: "local-structure" }),
  Object.freeze({ id: "candidate-overlap", label: "Two draft candidates per case", category: "local-evidence" }),
  Object.freeze({ id: "authorship-independence", label: "Qualified independent authorship", category: "external-authority" }),
  Object.freeze({ id: "named-adjudicator", label: "Named adjudicator + decision rights", category: "external-authority" }),
  Object.freeze({ id: "language-safety-standard", label: "Accepted language + safety standard", category: "external-authority" }),
  Object.freeze({ id: "reference-decision", label: "Signed reference decision + dissent", category: "external-authority" }),
  Object.freeze({ id: "protocol-freeze", label: "Protocol freeze + independent handoff", category: "external-authority" })
]);

const HEX = /^[a-f0-9]{64}$/;
const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const FALSE_CLAIMS = Object.freeze([
  "counselorIdentityVerified", "authorshipIndependenceEstablished", "adjudicatorAssigned", "adjudicationCompleted",
  "referenceAccepted", "protocolFrozen", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation",
  "trialExecutionAuthorized", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
]);

function clone(value) { return structuredClone(value); }

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
  if (unknown.length) errors.push(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

function candidateLabel(index) {
  return `Draft ${String.fromCharCode(65 + index)}`;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, count }));
}

function safeCandidate(draft, index, contentVisible) {
  return {
    candidateLabel: candidateLabel(index),
    sequence: draft.sequence,
    draftHash: draft.hash,
    sourceProfileHash: draft.sourceProfileHash,
    createdAt: draft.createdAt,
    authorCodeIncluded: false,
    contentWithheld: !contentVisible,
    summary: contentVisible ? draft.summary : null,
    themes: contentVisible ? clone(draft.themes) : [],
    questions: contentVisible ? [...draft.questions] : [],
    toneMarkers: contentVisible ? [...draft.toneMarkers] : [],
    criticalReviewDisposition: contentVisible ? draft.criticalReviewDisposition : null
  };
}

function buildCase({ assessment, manifestCase, drafts, actor }) {
  const sourceProfile = buildCounselorReferenceSource(assessment);
  const sourceProfileHash = counselorReferenceSourceHash(sourceProfile);
  const caseDrafts = drafts.filter(draft => draft.assessmentId === assessment.id).sort((a, b) => a.sequence - b.sequence);
  const reviewerCodeCount = new Set(caseDrafts.map(draft => draft.actor)).size;
  const currentReviewerContributed = caseDrafts.some(draft => draft.actor === actor);
  const locallyComparable = caseDrafts.length >= 2 && reviewerCodeCount >= 2 && caseDrafts.every(draft => draft.sourceProfileHash === sourceProfileHash);
  const candidateContentVisible = locallyComparable && currentReviewerContributed;
  const evidence = caseDrafts.flatMap((draft, index) => draft.themes.flatMap(theme => theme.evidence.map(token => ({ token, label: candidateLabel(index) }))));
  const evidenceCounts = countBy(evidence.map(item => item.token));
  const candidateLabelsByEvidence = new Map();
  for (const item of evidence) {
    const labels = candidateLabelsByEvidence.get(item.token) || new Set();
    labels.add(item.label);
    candidateLabelsByEvidence.set(item.token, labels);
  }
  const evidenceConcordance = candidateContentVisible
    ? evidenceCounts.map(item => ({ token: item.value, draftCount: item.count, candidateLabels: [...candidateLabelsByEvidence.get(item.value)] }))
    : [];
  const sharedEvidenceCount = evidenceCounts.filter(item => item.count === caseDrafts.length && caseDrafts.length > 0).length;
  const candidateOnlyEvidenceCount = evidenceCounts.filter(item => item.count === 1).length;
  const toneCounts = countBy(caseDrafts.flatMap(draft => draft.toneMarkers));
  const confidenceCounts = countBy(caseDrafts.flatMap(draft => draft.themes.map(theme => theme.confidence)));
  const requiredDisposition = sourceProfile.safety?.directReviewRequired ? "requires-direct-review" : "routine-verification";
  const safetyRouteAligned = caseDrafts.every(draft => draft.criticalReviewDisposition === requiredDisposition);
  const comparisonStatus = locallyComparable
    ? candidateContentVisible ? "reviewer-eligible-local-comparison" : "comparison-withheld-until-current-reviewer-contributes"
    : "awaiting-second-independent-draft";
  return {
    assessmentId: assessment.id,
    partition: manifestCase.partition,
    referenceVersion: manifestCase.referenceVersion,
    sourceProfileHash,
    sourceProfileIncludesGeneratedContent: false,
    sourceProfileIncludesHoldout: false,
    requiredCriticalReviewDisposition: requiredDisposition,
    draftCount: caseDrafts.length,
    reviewerCodeCount,
    minimumDistinctDrafts: 2,
    currentReviewerContributed,
    locallyComparable,
    candidateContentVisible,
    authorCodesVisible: false,
    comparisonStatus,
    candidates: caseDrafts.map((draft, index) => safeCandidate(draft, index, candidateContentVisible)),
    structuralSynthesis: {
      semanticAgreementAssessed: false,
      majorityDecisionCreated: false,
      safetyRouteAligned,
      uniqueEvidenceCitationCount: candidateContentVisible ? evidenceCounts.length : 0,
      sharedEvidenceCitationCount: candidateContentVisible ? sharedEvidenceCount : 0,
      candidateOnlyEvidenceCitationCount: candidateContentVisible ? candidateOnlyEvidenceCount : 0,
      evidenceConcordance,
      toneCoverage: candidateContentVisible ? toneCounts.map(item => ({ marker: item.value, draftCount: item.count })) : [],
      confidenceDistribution: candidateContentVisible ? confidenceCounts.map(item => ({ confidence: item.value, themeCount: item.count })) : [],
      disagreementsPreserved: true
    },
    referenceAccepted: false,
    adjudicationCompleted: false,
    protocolFrozen: false
  };
}

export function validateCounselorReferenceAdjudicationContract() {
  const errors = [];
  if (COUNSELOR_REFERENCE_ADJUDICATION_GATES.length !== 8 || new Set(COUNSELOR_REFERENCE_ADJUDICATION_GATES.map(gate => gate.id)).size !== 8) errors.push("The adjudication dossier requires eight unique gates.");
  if (!/only after the current reviewer code has already submitted/i.test(COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY)) errors.push("The adjudication boundary must prevent pre-authoring contamination.");
  if (!/majority vote is not clinical acceptance/i.test(COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY)) errors.push("The adjudication boundary must deny majority-vote authority.");
  if (COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY.length < 480) errors.push("The adjudication boundary is incomplete.");
  return errors;
}

export function buildCounselorReferenceAdjudicationDossier({ assessments = [], drafts = [], referenceChain = { valid: true, count: 0, head: null }, manifest, events = [], chain = { valid: true, count: 0, head: null }, actor = "REVIEWER-01", generatedAt = new Date().toISOString() } = {}) {
  const developmentDrafts = drafts.filter(draft => manifest?.cases?.[draft.assessmentId]?.partition === "development");
  const cases = assessments
    .filter(assessment => manifest?.cases?.[assessment.id]?.partition === "development")
    .map(assessment => buildCase({ assessment, manifestCase: manifest.cases[assessment.id], drafts, actor }));
  const sourceLineageCurrent = referenceChain.valid && cases.every(item => drafts.filter(draft => draft.assessmentId === item.assessmentId).every(draft => draft.sourceProfileHash === item.sourceProfileHash));
  const allCasesLocallyComparable = cases.length > 0 && cases.every(item => item.locallyComparable);
  const gates = COUNSELOR_REFERENCE_ADJUDICATION_GATES.map(gate => ({
    ...gate,
    status: gate.id === "development-manifest"
      ? cases.length > 0 ? "local-structure-ready" : "local-evidence-required"
      : gate.id === "source-lineage"
        ? sourceLineageCurrent ? "local-evidence-current" : "local-evidence-required"
        : gate.id === "candidate-overlap"
          ? allCasesLocallyComparable ? "local-evidence-current-unverified" : "local-evidence-required"
          : "external-decision-required"
  }));
  const counts = {
    developmentCases: cases.length,
    candidateDrafts: developmentDrafts.length,
    reviewerCodesObserved: new Set(developmentDrafts.map(draft => draft.actor)).size,
    locallyComparableCases: cases.filter(item => item.locallyComparable).length,
    contentVisibleCases: cases.filter(item => item.candidateContentVisible).length,
    externalDecisionGates: gates.filter(gate => gate.category === "external-authority").length,
    acceptedReferences: 0
  };
  const fingerprintCore = {
    contractVersion: COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
    caseSet: { id: manifest?.id || "unavailable", version: manifest?.version || "unavailable" },
    referenceChain: { valid: Boolean(referenceChain.valid), count: Number(referenceChain.count || 0), head: referenceChain.head || null },
    cases: cases.map(item => ({ assessmentId: item.assessmentId, sourceProfileHash: item.sourceProfileHash, draftHashes: item.candidates.map(candidate => candidate.draftHash), locallyComparable: item.locallyComparable })),
    gates: gates.map(({ id, status }) => ({ id, status })),
    counts
  };
  return {
    contractVersion: COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
    status: allCasesLocallyComparable ? "local-comparison-structure-ready-unverified" : "awaiting-independent-source-only-drafts",
    headline: "Disagreement deserves a chair—not a majority vote.",
    caseSet: clone(fingerprintCore.caseSet),
    counts,
    cases,
    gates,
    referenceDraftChain: clone(referenceChain),
    dossierFingerprint: digest(fingerprintCore),
    history: clone(events.slice().reverse()),
    chain: clone(chain),
    generatedContentIncluded: false,
    holdoutIncluded: false,
    counselorIdentityVerified: false,
    authorshipIndependenceEstablished: false,
    adjudicatorAssigned: false,
    adjudicationCompleted: false,
    referenceAccepted: false,
    protocolFrozen: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    trialExecutionAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    generatedAt,
    boundary: COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY
  };
}

export function createCounselorReferenceAdjudicationSnapshot({ dossier, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() }) {
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
    type: "counselor-reference-adjudication-dossier-sealed",
    dossierFingerprint: dossier.dossierFingerprint,
    caseSet: clone(dossier.caseSet),
    referenceDraftChain: { count: dossier.referenceDraftChain.count, head: dossier.referenceDraftChain.head },
    counts: clone(dossier.counts),
    cases: dossier.cases.map(item => ({
      assessmentId: item.assessmentId,
      sourceProfileHash: item.sourceProfileHash,
      draftHashes: item.candidates.map(candidate => candidate.draftHash),
      draftCount: item.draftCount,
      reviewerCodeCount: item.reviewerCodeCount,
      locallyComparable: item.locallyComparable
    })),
    gateStates: dossier.gates.map(({ id: gateId, status }) => ({ id: gateId, status })),
    counselorIdentityVerified: false,
    authorshipIndependenceEstablished: false,
    adjudicatorAssigned: false,
    adjudicationCompleted: false,
    referenceAccepted: false,
    protocolFrozen: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    trialExecutionAuthorized: false,
    pilotAuthorized: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt,
    note: "Local source-only reference adjudication dossier sealed for evidence handoff. Candidate authors remain unverified, disagreement remains unresolved, and no reference decision, protocol freeze, clinical conclusion, trial authority, release, or patient-use permission was created."
  };
  return { ...core, hash: digest(core) };
}

export function validateCounselorReferenceAdjudicationSnapshot(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  const keys = [
    "id", "sequence", "previousHash", "contractVersion", "type", "dossierFingerprint", "caseSet", "referenceDraftChain",
    "counts", "cases", "gateStates", ...FALSE_CLAIMS, "actor", "createdAt", "note", "hash"
  ];
  if (!exactKeys(event, keys, "Counselor reference adjudication event", errors)) return errors;
  if (event.contractVersion !== COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT) errors.push("Adjudication contract version is invalid.");
  if (event.type !== "counselor-reference-adjudication-dossier-sealed") errors.push("Adjudication event type is invalid.");
  if (!/^[0-9a-f-]{20,40}$/i.test(String(event.id || ""))) errors.push("Adjudication event ID is invalid.");
  if (event.sequence !== sequence || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Adjudication event sequence is invalid.");
  if (event.previousHash !== previousHash || (event.previousHash !== "GENESIS" && !HEX.test(String(event.previousHash || "")))) errors.push("Adjudication previous hash is invalid.");
  if (!HEX.test(String(event.dossierFingerprint || ""))) errors.push("Adjudication dossier fingerprint is invalid.");
  if (!event.caseSet || Object.keys(event.caseSet).sort().join(",") !== "id,version" || !String(event.caseSet.id || "").trim() || !String(event.caseSet.version || "").trim()) errors.push("Adjudication caseSet is invalid.");
  if (!event.referenceDraftChain || Object.keys(event.referenceDraftChain).sort().join(",") !== "count,head" || !Number.isInteger(event.referenceDraftChain.count) || event.referenceDraftChain.count < 0 || (event.referenceDraftChain.head !== null && !HEX.test(String(event.referenceDraftChain.head)))) errors.push("Adjudication referenceDraftChain is invalid.");
  const countKeys = ["acceptedReferences", "candidateDrafts", "contentVisibleCases", "developmentCases", "externalDecisionGates", "locallyComparableCases", "reviewerCodesObserved"];
  if (!event.counts || Object.keys(event.counts).sort().join(",") !== countKeys.sort().join(",") || Object.values(event.counts || {}).some(value => !Number.isInteger(value) || value < 0) || event.counts.acceptedReferences !== 0) errors.push("Adjudication counts are invalid.");
  if (!Array.isArray(event.cases) || event.cases.some(item => !item || Object.keys(item).sort().join(",") !== "assessmentId,draftCount,draftHashes,locallyComparable,reviewerCodeCount,sourceProfileHash" || !HEX.test(String(item.sourceProfileHash || "")) || !Array.isArray(item.draftHashes) || item.draftHashes.some(hash => !HEX.test(String(hash))) || item.draftCount !== item.draftHashes.length || !Number.isInteger(item.reviewerCodeCount) || typeof item.locallyComparable !== "boolean")) errors.push("Adjudication case snapshots are invalid.");
  const expectedGateIds = COUNSELOR_REFERENCE_ADJUDICATION_GATES.map(gate => gate.id);
  if (!Array.isArray(event.gateStates) || event.gateStates.length !== expectedGateIds.length || event.gateStates.some((gate, index) => gate?.id !== expectedGateIds[index] || !["local-structure-ready", "local-evidence-current", "local-evidence-current-unverified", "local-evidence-required", "external-decision-required"].includes(gate.status))) errors.push("Adjudication gate states are invalid.");
  for (const key of FALSE_CLAIMS) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!ACTOR.test(String(event.actor || ""))) errors.push("Adjudication actor must be a bounded reviewer code.");
  if (Number.isNaN(Date.parse(event.createdAt))) errors.push("Adjudication createdAt is invalid.");
  if (typeof event.note !== "string" || event.note.length < 190 || !/no reference decision/i.test(event.note)) errors.push("Adjudication note boundary is incomplete.");
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || digest(core) !== hash) errors.push("Adjudication event hash is invalid.");
  return [...new Set(errors)];
}
