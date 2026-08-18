import { createHash, randomUUID } from "node:crypto";

export const INDEPENDENT_REVIEW_CONTRACT = "perl-independent-review-dossier/1.0";

export const INDEPENDENT_REVIEW_BOUNDARY = "This dossier seals reproducible local synthetic evidence for an outside accuracy and reliability review. It does not name or authenticate an independent evaluator, accept the missing source workbooks, approve a clinical standard or case set, establish accuracy, reliability, clinical validity, legal or privacy permission, authorize a pilot, authorize production release, or permit patient use. A local seal is evidence packaging only and can never substitute for an evaluator's signed decision.";

export const INDEPENDENT_REVIEW_DOMAINS = Object.freeze([
  Object.freeze({
    id: "source-fidelity",
    index: "01",
    label: "Source fidelity",
    question: "Does every statement remain traceable to authoritative scored Findings evidence?",
    evidence: Object.freeze(["Authoritative score and severity contract", "Question-to-category map", "Threshold and fixed-response logic"])
  }),
  Object.freeze({
    id: "clinical-restraint",
    index: "02",
    label: "Clinical restraint",
    question: "Does the summary stay useful without becoming diagnostic or prescriptive?",
    evidence: Object.freeze(["Blind accuracy and restraint ratings", "Material correction taxonomy", "Accepted language and disclaimer contract"])
  }),
  Object.freeze({
    id: "safety-performance",
    index: "03",
    label: "Safety performance",
    question: "Are critical screens, unsupported certainty, and evidence mismatches held at zero?",
    evidence: Object.freeze(["Critical-screen regression", "Incident and stopping ledger", "Direct-review escalation route"])
  }),
  Object.freeze({
    id: "reliability",
    index: "04",
    label: "Reliability",
    question: "Do independent reviewers reach sufficiently consistent judgments on repeated cases?",
    evidence: Object.freeze(["Repeated-case allocation", "Preference agreement and rating gaps", "Predeclared denominator and analysis method"])
  }),
  Object.freeze({
    id: "workflow-utility",
    index: "05",
    label: "Workflow utility",
    question: "Does PERL improve the counselor task without hiding correction burden or time?",
    evidence: Object.freeze(["Matched unaided and assisted observations", "Usefulness ratings", "Server-timed protocol eligibility"])
  }),
  Object.freeze({
    id: "reproducibility",
    index: "06",
    label: "Reproducibility",
    question: "Can an outsider reconstruct the exact case, model, policy, report, and evidence state?",
    evidence: Object.freeze(["Frozen case manifest", "Model, prompt, policy, and schema provenance", "Hash-linked export and chain heads"])
  })
]);

export const INDEPENDENT_REVIEW_INPUTS = Object.freeze([
  Object.freeze({ id: "threshold-response-workbook", label: "Threshold + response workbook", filename: "meta_thresholds_responses_cs.xlsx", status: "named-in-correspondence-not-connected", requiredFor: "Authoritative threshold and fixed-response reconciliation" }),
  Object.freeze({ id: "question-category-workbook", label: "Question + category workbook", filename: "question_categories_capitalized.xlsx", status: "named-in-correspondence-not-connected", requiredFor: "Authoritative question-to-category reconciliation" }),
  Object.freeze({ id: "scored-event-contract", label: "Authoritative scored event", filename: null, status: "rfi-rehearsal-only", requiredFor: "Score, level, scoring-version, critical-screen, and Findings lineage" }),
  Object.freeze({ id: "approved-case-inventory", label: "Approved de-identified case inventory", filename: null, status: "source-reported-not-received", requiredFor: "Eligibility, strata, development set, unseen holdout, and denominators" }),
  Object.freeze({ id: "counselor-reference-freeze", label: "Counselor reference freeze", filename: null, status: "external-decision-required", requiredFor: "Qualified authorship, case linkage, adjudication, and intended-use limits" }),
  Object.freeze({ id: "analysis-plan", label: "Accepted analysis plan", filename: null, status: "external-decision-required", requiredFor: "Measures, thresholds, stopping rules, missingness, multiplicity, and decision rule" }),
  Object.freeze({ id: "evaluator-charter", label: "Independent evaluator charter", filename: null, status: "external-decision-required", requiredFor: "Named reviewer, qualifications, conflicts, access, deliverable, and signature authority" }),
  Object.freeze({ id: "permission-record", label: "Legal + privacy permission", filename: null, status: "external-decision-required", requiredFor: "Permitted data class, transfer, retention, deletion, and named-site scope" })
]);

export const INDEPENDENT_REVIEW_GATES = Object.freeze([
  Object.freeze({ id: "package-integrity", label: "Synthetic package integrity", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "independent-evaluator"]) }),
  Object.freeze({ id: "engineering-regression", label: "Engineering safety regression", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "clinical-lead"]) }),
  Object.freeze({ id: "version-provenance", label: "Version + provenance inventory", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "eqpass-owner"]) }),
  Object.freeze({ id: "safety-stop-rehearsal", label: "Safety stop evidence", category: "local-pattern", ownerRoles: Object.freeze(["clinical-lead", "engineering-owner"]) }),
  Object.freeze({ id: "authoritative-inputs", label: "Authoritative source contracts", category: "external-authority", ownerRoles: Object.freeze(["eqpass-owner", "clinical-lead"]) }),
  Object.freeze({ id: "approved-case-set", label: "Representative case set + holdout", category: "external-authority", ownerRoles: Object.freeze(["clinical-lead", "security-privacy-owner", "independent-evaluator"]) }),
  Object.freeze({ id: "counselor-reference-freeze", label: "Counselor reference freeze", category: "external-authority", ownerRoles: Object.freeze(["clinical-lead", "counselor-panel"]) }),
  Object.freeze({ id: "accepted-clinical-standard", label: "Accepted clinical standard", category: "external-authority", ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "independent-evaluator"]) }),
  Object.freeze({ id: "independent-evaluator-protocol", label: "Evaluator + frozen protocol", category: "external-authority", ownerRoles: Object.freeze(["independent-evaluator", "clinical-lead"]) }),
  Object.freeze({ id: "legal-privacy-permission", label: "Legal + privacy permission", category: "external-authority", ownerRoles: Object.freeze(["legal-owner", "security-privacy-owner"]) })
]);

function clone(value) {
  return structuredClone(value);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function chainHeads(integrity = {}) {
  return Object.fromEntries(Object.entries(integrity).map(([key, chain]) => [key, chain?.head || "GENESIS"]));
}

function allChainsValid(integrity = {}) {
  const chains = Object.values(integrity);
  return chains.length > 0 && chains.every(chain => chain?.valid === true);
}

export function validateIndependentReviewContract() {
  const errors = [];
  if (INDEPENDENT_REVIEW_DOMAINS.length !== 6) errors.push("Independent review requires six fixed review domains.");
  if (INDEPENDENT_REVIEW_INPUTS.length !== 8) errors.push("Independent review requires eight controlled input classes.");
  if (INDEPENDENT_REVIEW_GATES.length !== 10) errors.push("Independent review requires ten gates.");
  if (INDEPENDENT_REVIEW_GATES.filter(gate => gate.category === "local-pattern").length !== 4) errors.push("Independent review requires four local evidence gates.");
  if (INDEPENDENT_REVIEW_GATES.filter(gate => gate.category === "external-authority").length !== 6) errors.push("Independent review requires six external authority gates.");
  for (const values of [INDEPENDENT_REVIEW_DOMAINS, INDEPENDENT_REVIEW_INPUTS, INDEPENDENT_REVIEW_GATES]) {
    if (new Set(values.map(item => item.id)).size !== values.length) errors.push("Independent-review IDs must be unique within each register.");
  }
  const filenames = INDEPENDENT_REVIEW_INPUTS.map(item => item.filename).filter(Boolean);
  if (!filenames.includes("meta_thresholds_responses_cs.xlsx") || !filenames.includes("question_categories_capitalized.xlsx")) errors.push("The two source-named Mike workbooks must remain explicit controlled inputs.");
  if (INDEPENDENT_REVIEW_BOUNDARY.length < 320 || !/can never substitute/i.test(INDEPENDENT_REVIEW_BOUNDARY)) errors.push("Independent-review claim boundary is incomplete.");
  return [...new Set(errors)];
}

export function buildIndependentReviewDossier({ analysis = {}, clinicalStandard = {}, manifestPackage = {}, runtimeVersions = {}, referenceDecision = null, snapshots = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const contractErrors = validateIndependentReviewContract();
  if (contractErrors.length) throw new Error(contractErrors.join(" "));
  const sample = analysis.sample || {};
  const caseSet = analysis.caseSet || {};
  const safety = analysis.safety || {};
  const integrity = analysis.integrity || {};
  const releaseEvidence = analysis.releaseEvidence || {};
  const manifestHash = manifestPackage.integrity?.manifestHash || null;
  const heads = chainHeads(integrity);
  const integrityCurrent = allChainsValid(integrity) && /^[a-f0-9]{64}$/.test(String(manifestHash || ""));
  const regressionCurrent = releaseEvidence.engineeringRegressionPassed === true;
  const provenanceCurrent = ["model", "report-template", "disclaimer", "state-schema", "release-evaluator"].every(key => typeof runtimeVersions[key] === "string" && runtimeVersions[key].length > 1);
  const safetyCurrent = Number(safety.unresolvedHighSeverity || 0) === 0
    && releaseEvidence.outcomes?.criticalScreenHandling?.status === "pass";
  const referenceFreezePurpose = referenceDecision?.purposes?.find(item => item.purpose === "reference-protocol-freeze");
  const referenceFreezeVerified = referenceDecision?.protocolFrozen === true
    && referenceDecision?.referenceSetAccepted === true
    && referenceDecision?.independentReviewHandoffReady === true
    && referenceDecision?.chain?.valid === true
    && /^[a-f0-9]{64}$/.test(String(referenceDecision?.docketFingerprint || ""))
    && /^[a-f0-9]{64}$/.test(String(referenceDecision?.chain?.head || ""))
    && /^[a-f0-9]{64}$/.test(String(referenceFreezePurpose?.attestationFingerprint || ""));
  const localState = { "package-integrity": integrityCurrent, "engineering-regression": regressionCurrent, "version-provenance": provenanceCurrent, "safety-stop-rehearsal": safetyCurrent };
  const gates = INDEPENDENT_REVIEW_GATES.map(gate => ({
    ...clone(gate),
    status: gate.category === "local-pattern"
      ? (localState[gate.id] ? "local-evidence-current" : "local-evidence-required")
      : (gate.id === "counselor-reference-freeze" && referenceFreezeVerified ? "externally-verified-dependency" : "external-decision-required"),
    productionAccepted: false
  }));
  const gateCounts = {
    localCurrent: gates.filter(gate => gate.status === "local-evidence-current").length,
    localRequired: gates.filter(gate => gate.status === "local-evidence-required").length,
    externalAccepted: gates.filter(gate => gate.status === "externally-verified-dependency").length,
    externalDecisionRequired: gates.filter(gate => gate.status === "external-decision-required").length,
    total: gates.length
  };
  const evidenceSnapshot = {
    syntheticCases: Number(caseSet.cases || 0),
    pairedBlindComparisons: Number(sample.pairedComparisons || 0),
    independentReviewerCodes: Number(sample.reviewers || 0),
    workflowTimingObservations: Number(sample.workflowTimingObservations || 0),
    structuredFeedbackEntries: Number(sample.feedbackEntries || 0),
    unresolvedHighSeverityIncidents: Number(safety.unresolvedHighSeverity || 0),
    clinicalStandardDrafts: Number(clinicalStandard.history?.length || 0),
    clinicalStandardAccepted: false,
    representativeCaseSetAccepted: false,
    holdoutValid: false,
    authoritativeSourceContractAccepted: false,
    counselorReferenceFreezeVerified: referenceFreezeVerified,
    referenceDecisionDocketFingerprint: referenceFreezeVerified ? referenceDecision.docketFingerprint : null,
    referenceDecisionChainHead: referenceFreezeVerified ? referenceDecision.chain.head : null,
    referenceProtocolFreezeAttestationFingerprint: referenceFreezeVerified ? referenceFreezePurpose.attestationFingerprint : null,
    referenceDecisionVerifiedDuties: referenceFreezeVerified ? Number(referenceDecision.counts?.verifiedExternalDuties || 0) : 0,
    evaluatorNamed: false,
    evaluatorDecisionRecorded: false,
    manifestId: caseSet.id || manifestPackage.manifest?.id || null,
    manifestVersion: caseSet.version || manifestPackage.manifest?.version || null,
    manifestHash,
    runtimeVersions: clone(runtimeVersions),
    chainHeads: heads
  };
  const packetCore = {
    contractVersion: INDEPENDENT_REVIEW_CONTRACT,
    status: "external-evidence-required",
    headline: "Let the outsider see the whole proof.",
    preparedFor: "A named, conflict-disclosed independent accuracy and reliability evaluator",
    reviewQuestion: "On an approved representative case set, does the frozen PERL candidate produce evidence-faithful, appropriately restrained, safe, useful, and reproducible counselor summaries with acceptable independent-reviewer agreement?",
    evidenceSnapshot,
    gates,
    gateCounts,
    domains: clone(INDEPENDENT_REVIEW_DOMAINS),
    controlledInputs: INDEPENDENT_REVIEW_INPUTS.map(input => input.id === "counselor-reference-freeze" && referenceFreezeVerified
      ? { ...clone(input), status: "externally-verified-dependency" }
      : clone(input)),
    sourceWorkbooksConnected: false,
    externalApprovalsRecorded: false,
    independentEvaluatorNamed: false,
    independentReviewComplete: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorizationRecorded: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: INDEPENDENT_REVIEW_BOUNDARY
  };
  const reviewPackageHash = digest({ evidenceSnapshot, gates, domains: packetCore.domains, controlledInputs: packetCore.controlledInputs });
  return {
    ...packetCore,
    reviewPackageHash,
    dossierFingerprint: digest(packetCore),
    generatedAt,
    latestSeal: snapshots.at(-1) ? clone(snapshots.at(-1)) : null,
    sealHistory: snapshots.map(event => ({ id: event.id, sequence: event.sequence, actor: event.actor, createdAt: event.createdAt, dossierFingerprint: event.dossierFingerprint, hash: event.hash })),
    chain: clone(chain)
  };
}

export function createIndependentReviewSnapshot({ dossier, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() }) {
  const referenceDependency = dossier.evidenceSnapshot.counselorReferenceFreezeVerified === true ? {
    docketFingerprint: dossier.evidenceSnapshot.referenceDecisionDocketFingerprint,
    chainHead: dossier.evidenceSnapshot.referenceDecisionChainHead,
    freezeAttestationFingerprint: dossier.evidenceSnapshot.referenceProtocolFreezeAttestationFingerprint,
    verifiedDuties: dossier.evidenceSnapshot.referenceDecisionVerifiedDuties
  } : null;
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: INDEPENDENT_REVIEW_CONTRACT,
    type: "independent-review-local-dossier-sealed",
    status: "sealed-local-evidence-only",
    dossierFingerprint: dossier.dossierFingerprint,
    reviewPackageHash: dossier.reviewPackageHash,
    evidenceStateHash: digest({ evidenceSnapshot: dossier.evidenceSnapshot, gates: dossier.gates }),
    gateCounts: clone(dossier.gateCounts),
    ...(referenceDependency ? { referenceDependency } : {}),
    evidenceCounts: {
      syntheticCases: dossier.evidenceSnapshot.syntheticCases,
      pairedBlindComparisons: dossier.evidenceSnapshot.pairedBlindComparisons,
      independentReviewerCodes: dossier.evidenceSnapshot.independentReviewerCodes,
      workflowTimingObservations: dossier.evidenceSnapshot.workflowTimingObservations,
      structuredFeedbackEntries: dossier.evidenceSnapshot.structuredFeedbackEntries,
      unresolvedHighSeverityIncidents: dossier.evidenceSnapshot.unresolvedHighSeverityIncidents,
      clinicalStandardDrafts: dossier.evidenceSnapshot.clinicalStandardDrafts
    },
    chainHeads: clone(dossier.evidenceSnapshot.chainHeads),
    decision: "independent-review-not-authorized",
    externalApprovalsRecorded: false,
    independentEvaluatorNamed: false,
    independentReviewComplete: false,
    accuracyEstablished: false,
    reliabilityEstablished: false,
    clinicalValidation: false,
    pilotAuthorizationRecorded: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor,
    createdAt,
    note: referenceDependency
      ? "Local synthetic evidence was packaged for outside review; one separately verified upstream counselor-reference dependency is bound, five outside decisions remain open, and no evaluator decision was recorded."
      : "Local synthetic evidence was packaged for outside review; all six external decisions remain open and no evaluator decision was recorded."
  };
  return { ...core, hash: digest(core) };
}

export function validateIndependentReviewSnapshot(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Independent-review snapshot is required."];
  const { hash, ...core } = event;
  if (event.sequence !== sequence || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Snapshot sequence is invalid.");
  if (event.previousHash !== previousHash || !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Snapshot previous hash is invalid.");
  if (event.contractVersion !== INDEPENDENT_REVIEW_CONTRACT || event.type !== "independent-review-local-dossier-sealed" || event.status !== "sealed-local-evidence-only") errors.push("Snapshot contract identity is invalid.");
  for (const key of ["dossierFingerprint", "reviewPackageHash", "evidenceStateHash"]) if (!/^[a-f0-9]{64}$/.test(String(event[key] || ""))) errors.push(`${key} is invalid.`);
  const hasReferenceDependency = event.referenceDependency !== undefined;
  const expectedGateCounts = { localCurrent: event.gateCounts?.localCurrent, localRequired: event.gateCounts?.localRequired, externalAccepted: hasReferenceDependency ? 1 : 0, externalDecisionRequired: hasReferenceDependency ? 5 : 6, total: 10 };
  if (JSON.stringify(event.gateCounts) !== JSON.stringify(expectedGateCounts) || event.gateCounts.localCurrent + event.gateCounts.localRequired !== 4) errors.push("Snapshot gate counts are invalid.");
  if (hasReferenceDependency) {
    const dependency = event.referenceDependency;
    const exactDependencyKeys = dependency && Object.keys(dependency).sort().join(",") === "chainHead,docketFingerprint,freezeAttestationFingerprint,verifiedDuties";
    if (!exactDependencyKeys || ![dependency?.docketFingerprint, dependency?.chainHead, dependency?.freezeAttestationFingerprint].every(value => /^[a-f0-9]{64}$/.test(String(value || ""))) || dependency?.verifiedDuties !== 4) errors.push("Snapshot counselor-reference dependency is invalid.");
  }
  const counts = Object.values(event.evidenceCounts || {});
  if (counts.length !== 7 || counts.some(value => !Number.isInteger(value) || value < 0)) errors.push("Snapshot evidence counts are invalid.");
  const heads = Object.values(event.chainHeads || {});
  if (!heads.length || heads.some(value => !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(value)))) errors.push("Snapshot chain heads are invalid.");
  if (event.decision !== "independent-review-not-authorized") errors.push("Snapshot decision must remain non-authorizing.");
  for (const key of ["externalApprovalsRecorded", "independentEvaluatorNamed", "independentReviewComplete", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation", "pilotAuthorizationRecorded", "productionReleaseAuthorized", "patientUseAuthorized"]) if (event[key] !== false) errors.push(`${key} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Snapshot actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt))) errors.push("Snapshot timestamp is invalid.");
  if (typeof event.note !== "string" || event.note.length < 80) errors.push("Snapshot note is incomplete.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Snapshot fingerprint is invalid.");
  return [...new Set(errors)];
}
