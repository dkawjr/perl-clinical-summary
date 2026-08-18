import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { coverageScore, riskDisposition, validateAssessment, validateClinicalInterpretation, validateNarrative } from "./engine.js";
import { analyzeCalibration } from "./calibration-analysis.js";
import { validateCalibrationManifest } from "./calibration-manifest.js";
import { buildReleaseDecision, evaluateReleaseEvidence } from "./release-evidence.js";
import { REPORT_CONTRACT, renderReportPage, validateReportContent } from "./report-page.js";
import { buildClinicalBrief, validateClinicalBrief } from "./clinical-brief.js";
import { adaptSyntheticEqpassEvent } from "./eqpass-adapter.js";
import { buildIntegrationRehearsalObservatory } from "./integration-rehearsal.js";
import { attachmentRequestProvenance, EQPASS_ATTACHMENT_RFI_CONTRACT, EQPASS_ATTACHMENT_RFI_STATUS } from "./attachment-adapter.js";
import { WORKFLOW_TIMING_CONTRACT, validateWorkflowSummary, workflowSourceProfile } from "./workflow-timing.js";
import { AUDIENCE_HANDOFF_CONTRACT, validateHandoffAudience } from "./audience-handoff-page.js";
import { buildRefinementBrief, REFINEMENT_CONTRACT } from "./refinement-analysis.js";
import { MODEL_INPUT_CONTRACT, projectModelInput } from "./model-input.js";
import {
  GENERATION_OUTPUT_CONTRACT,
  GENERATION_POLICY_HASH,
  GENERATION_POLICY_VERSION,
  generationGatewayStatus,
  validateGenerationBundle
} from "./model-gateway.js";
import {
  automaticAttachmentRequest,
  PROVIDER_WORKFLOW_BOUNDARY,
  PROVIDER_WORKFLOW_CONTRACT,
  PROVIDER_WORKFLOW_TYPES
} from "./provider-workflow.js";
import {
  buildDeliveryRequest,
  createDeliveryConnector,
  DELIVERY_BOUNDARY,
  DELIVERY_MAX_ATTEMPTS,
  DELIVERY_OUTBOX_CONTRACT,
  deliveryGatewayStatus
} from "./delivery-gateway.js";
import {
  LOCAL_LAST_KNOWN_GOOD,
  ROLLBACK_REHEARSAL_BOUNDARY,
  ROLLBACK_REHEARSAL_CONTRACT,
  rollbackManifestHash,
  validateRollbackManifest
} from "./rollback-rehearsal.js";
import {
  LOCAL_PROBE_BUDGET_MS,
  OPERATIONAL_MONITORING_BOUNDARY,
  OPERATIONAL_MONITORING_CONTRACT,
  OPERATIONAL_SIGNALS,
  PRODUCTION_MONITORING_GAPS,
  validateOperationalSignalSet
} from "./operational-monitoring.js";
import {
  INCIDENT_OWNER_TREE,
  INCIDENT_RESPONSE_BOUNDARY,
  INCIDENT_RESPONSE_CONTRACT,
  INCIDENT_RESPONSE_SCENARIOS,
  INCIDENT_SEVERITY_MODEL,
  RESPONSE_PHASES,
  incidentResponseScenario,
  incidentSeverity,
  validateIncidentResponseContract
} from "./incident-response.js";
import {
  PILOT_AUTHORITY_REGISTER,
  PILOT_READINESS_BOUNDARY,
  PILOT_READINESS_CONTRACT,
  PILOT_READINESS_GATES,
  validatePilotReadinessContract
} from "./pilot-readiness.js";
import {
  CLINICAL_STANDARD_CONTRACT,
  clinicalStandardStatus as buildClinicalStandardStatus,
  createClinicalStandardDraft,
  validateClinicalStandardDraft
} from "./clinical-standard.js";
import {
  INDEPENDENT_REVIEW_CONTRACT,
  buildIndependentReviewDossier,
  createIndependentReviewSnapshot,
  validateIndependentReviewContract,
  validateIndependentReviewSnapshot
} from "./independent-review.js";
import {
  INTEGRATION_RETURN_CONTRACT,
  buildIntegrationReturnDesk,
  createIntegrationReturnPreflight,
  validateIntegrationReturnContract,
  validateIntegrationReturnManifest,
  validateIntegrationReturnPreflight
} from "./integration-return.js";
import {
  COUNSELOR_NOTEBOOK_CONTRACT,
  buildCounselorNotebook,
  createCounselorNotebookEntry,
  validateCounselorNotebookContract,
  validateCounselorNotebookEntry,
  validateCounselorNotebookInput
} from "./counselor-notebook.js";
import {
  COUNSELOR_REFERENCE_CONTRACT,
  buildCounselorReferenceRoom,
  buildCounselorReferenceSource,
  createCounselorReferenceDraft,
  validateCounselorReferenceContract,
  validateCounselorReferenceDraft,
  validateCounselorReferenceInput
} from "./counselor-reference.js";
import {
  COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
  buildCounselorReferenceAdjudicationDossier,
  createCounselorReferenceAdjudicationSnapshot,
  validateCounselorReferenceAdjudicationContract,
  validateCounselorReferenceAdjudicationSnapshot
} from "./counselor-reference-adjudication.js";
import {
  COUNSELOR_REFERENCE_DECISION_CONTRACT,
  buildCounselorReferenceDecisionDocket,
  counselorReferenceDecisionDigest,
  counselorReferenceDecisionRegistryFingerprint,
  createCounselorReferenceDecisionAttestationEvent,
  createCounselorReferenceDecisionChallenge,
  disabledCounselorReferenceDecisionRegistry,
  summarizeCounselorReferenceDecisionRegistry,
  validateCounselorReferenceDecisionAttestation,
  validateCounselorReferenceDecisionChallenge,
  validateCounselorReferenceDecisionEvent,
  validateCounselorReferenceDecisionRegistry
} from "./counselor-reference-decision.js";
import {
  buildIndependentReviewAdmissionDocket,
  createIndependentReviewAdmissionAttestationEvent,
  createIndependentReviewAdmissionChallenge,
  disabledIndependentReviewAdmissionRegistry,
  independentReviewAdmissionDigest,
  independentReviewAdmissionRegistryFingerprint,
  summarizeIndependentReviewAdmissionRegistry,
  validateIndependentReviewAdmissionAttestation,
  validateIndependentReviewAdmissionChallenge,
  validateIndependentReviewAdmissionEvent,
  validateIndependentReviewAdmissionRegistry
} from "./independent-review-admission.js";
import {
  PROGRESS_REVIEW_CONTRACT,
  buildProgressReview,
  createProgressReviewObservation,
  progressReviewEvidenceSnapshot,
  validateProgressReviewContract,
  validateProgressReviewInput,
  validateProgressReviewObservation
} from "./progress-review.js";
import {
  MODEL_TRIAL_CONTRACT,
  buildModelTrialBench,
  createModelTrialPreflight,
  validateModelTrialContract,
  validateModelTrialManifest,
  validateModelTrialPreflight
} from "./model-trial.js";
import {
  CANDIDATE_TRIAL_CONTRACT,
  buildCandidateTrialFoundry,
  createCandidateTrialSnapshot,
  validateCandidateTrialContract,
  validateCandidateTrialSnapshot
} from "./candidate-trial.js";
import {
  CANDIDATE_RETURN_CONTRACT,
  buildCandidateReturnDesk,
  candidateReturnBundleHash,
  createCandidateReturnEvent,
  validateCandidateReturnContract,
  validateCandidateReturnEvent,
  validateCandidateReturnManifest
} from "./candidate-return.js";
import {
  CANDIDATE_BLIND_REVIEW_CONTRACT,
  buildCandidateBlindReviewDesk,
  candidateBlindReviewDigest,
  candidateBlindReviewReceipt,
  createCandidateBlindReviewAssignment,
  createCandidateBlindReviewEvent,
  publicCandidateBlindReviewAssignment,
  validateCandidateBlindReviewContract,
  validateCandidateBlindReviewEvent,
  validateCandidateBlindReviewSubmission
} from "./candidate-blind-review.js";
import {
  CANDIDATE_REFINEMENT_LANES,
  CANDIDATE_REFINEMENT_RETEST_CONTRACT,
  buildCandidateRefinementDesk,
  candidateRefinementCycleReceipt,
  candidateRefinementRetestKit,
  createCandidateRefinementCycle,
  validateCandidateRefinementContract,
  validateCandidateRefinementCycleEvent
} from "./candidate-refinement-retest.js";
import {
  CANDIDATE_RETEST_RETURN_CONTRACT,
  buildCandidateRetestReturnTemplate,
  candidateRetestReturnDigest,
  candidateRetestReturnReceipt,
  createCandidateRetestReturnEvent,
  validateCandidateRetestReturnContract,
  validateCandidateRetestReturnEvent,
  validateCandidateRetestReturnManifest
} from "./candidate-retest-return.js";
import {
  CANDIDATE_RETEST_REREVIEW_CONTRACT,
  buildCandidateRetestStudio,
  candidateRetestReviewDigest,
  candidateRetestReviewEvidence,
  candidateRetestReviewReceipt,
  candidateRetestReturnSetFingerprint,
  createCandidateRetestReviewAssignment,
  createCandidateRetestReviewEvent,
  publicCandidateRetestReviewAssignment,
  validateCandidateRetestReviewContract,
  validateCandidateRetestReviewEvent,
  validateCandidateRetestReviewSubmission
} from "./candidate-retest-rereview.js";
import {
  buildCandidateRetestDispositionDocket,
  candidateRetestDispositionAnalysis,
  candidateRetestDispositionDigest,
  candidateRetestDispositionRegistryFingerprint,
  createCandidateRetestDispositionAttestationEvent,
  createCandidateRetestDispositionChallenge,
  disabledCandidateRetestDispositionRegistry,
  summarizeCandidateRetestDispositionRegistry,
  validateCandidateRetestDispositionAttestation,
  validateCandidateRetestDispositionChallenge,
  validateCandidateRetestDispositionContract,
  validateCandidateRetestDispositionEvent,
  validateCandidateRetestDispositionRegistry
} from "./candidate-retest-disposition.js";
import {
  buildCandidateAdvancementAirlock,
  candidateAdvancementDigest,
  candidateAdvancementRegistryFingerprint,
  candidateCycleActionRegistryFingerprint,
  createCandidateAdvancementAttestationEvent,
  createCandidateAdvancementChallenge,
  createCandidateCycleActionChallenge,
  disabledCandidateAdvancementRegistry,
  disabledCandidateCycleActionRegistry,
  summarizeCandidateAdvancementRegistry,
  summarizeCandidateCycleActionRegistry,
  validateCandidateAdvancementAttestation,
  validateCandidateAdvancementChallenge,
  validateCandidateAdvancementContract,
  validateCandidateAdvancementEvent,
  validateCandidateAdvancementRegistry,
  validateCandidateCycleActionRegistry
} from "./candidate-advancement.js";
import {
  INTENDED_USE_CONTRACT,
  createIntendedUseDraft,
  createIntendedUseEvent,
  intendedUseStatus as buildIntendedUseStatus,
  validateIntendedUseContract,
  validateIntendedUseDraft,
  validateIntendedUseEvent
} from "./intended-use.js";
import {
  buildLanguageReviewOffice,
  createLanguageReviewEvent,
  createLanguageReviewPacket,
  validateLanguageReviewContract,
  validateLanguageReviewEvent,
  validateLanguageReviewPacket
} from "./language-review.js";
import {
  buildDecisionExchange,
  createDecisionReturnPreflight,
  validateDecisionExchangeContract,
  validateDecisionReturnManifest,
  validateDecisionReturnPreflight
} from "./decision-exchange.js";
import {
  buildPilotOperationsPlan,
  createPilotOperationsSnapshot,
  validatePilotOperationsContract,
  validatePilotOperationsSnapshot
} from "./pilot-operations.js";
import {
  buildProviderActivationWorkbook,
  createProviderActivationSnapshot,
  validateProviderActivationContract,
  validateProviderActivationSnapshot
} from "./provider-activation.js";
import {
  buildCampusObservatory,
  createCampusObservatorySnapshot,
  validateCampusObservatoryContract,
  validateCampusObservatorySnapshot,
  validateCampusObservatorySnapshotInput
} from "./campus-observatory.js";
import {
  buildSiteAdmissionPortfolio,
  createSiteAdmissionReturnPreflight,
  validateSiteAdmissionContract,
  validateSiteAdmissionReturnManifest,
  validateSiteAdmissionReturnPreflight
} from "./site-admission.js";
import {
  AUTHORITY_TRUST_CONTRACT,
  authorityTrustRegistryFingerprint,
  buildAuthorityTrustBridge,
  createAuthorityTrustChallenge,
  createAuthorityTrustReceiptEvent,
  disabledAuthorityTrustRegistry,
  summarizeAuthorityTrustRegistry,
  validateAuthorityTrustChallenge,
  validateAuthorityTrustEvent,
  validateAuthorityTrustReceipt,
  validateAuthorityTrustRegistry
} from "./authority-trust.js";
import {
  PILOT_START_CONTRACT,
  buildPilotStartContinuity,
  buildPilotStartControl,
  createPilotStartAcknowledgementEvent,
  createPilotStartChallenge,
  createPilotStartOrderEvent,
  disabledPilotStartRegistry,
  pilotStartRegistryFingerprint,
  summarizePilotStartRegistry,
  validatePilotStartAcknowledgement,
  validatePilotStartChallenge,
  validatePilotStartEvent,
  validatePilotStartOrder,
  validatePilotStartRegistry
} from "./pilot-start.js";
import {
  CLINICAL_RELEASE_CONTRACT,
  buildClinicalReleaseGate,
  canonicalClinicalReleaseJson,
  clinicalReleaseRegistryFingerprint,
  createClinicalReleaseChallenge,
  createClinicalUseAuthorizationEvent,
  createProductionReleaseAuthorizationEvent,
  createReleaseDeploymentAttestationEvent,
  disabledClinicalReleaseRegistry,
  summarizeClinicalReleaseRegistry,
  validateClinicalReleaseChallenge,
  validateClinicalReleaseEvent,
  validateClinicalReleaseRegistry,
  validateClinicalUseAuthorization,
  validateProductionReleaseAuthorization,
  validateReleaseDeploymentAttestation
} from "./clinical-release.js";
import {
  TRAFFIC_ACTIVATION_CONTRACT,
  TRAFFIC_ACTIVATION_KEY_PURPOSES,
  buildTrafficActivationWitness,
  canonicalTrafficActivationJson,
  createClinicalTrafficAuthorizationEvent,
  createFirstGovernedTransactionEvent,
  createOperationsTrafficAuthorizationEvent,
  createTrafficActivationChallenge,
  disabledTrafficActivationRegistry,
  summarizeTrafficActivationRegistry,
  trafficActivationPlanFingerprint,
  trafficActivationRegistryFingerprint,
  validateFirstGovernedTransactionAttestation,
  validateTrafficActivationAuthorization,
  validateTrafficActivationChallenge,
  validateTrafficActivationEvent,
  validateTrafficActivationRegistry
} from "./traffic-activation.js";
import {
  buildIdentityAccessStatus,
  createIdentityAccessEvent,
  validateIdentityAccessEvent
} from "./identity-access.js";

function clone(value) {
  return structuredClone(value);
}

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function trafficActivationDigest(value) {
  return createHash("sha256").update(canonicalTrafficActivationJson(value)).digest("hex");
}

function digestBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function scoredSourceDigest(assessment) {
  const { status, reviewer, ...scoredPayload } = assessment;
  return digest(scoredPayload);
}

function tokens(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || [];
}

function changedTokenCount(before, after) {
  const counts = new Map();
  for (const token of tokens(before)) counts.set(token, (counts.get(token) || 0) + 1);
  for (const token of tokens(after)) counts.set(token, (counts.get(token) || 0) - 1);
  return [...counts.values()].reduce((sum, count) => sum + Math.abs(count), 0);
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const BLIND_ASSIGNMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TIMING_TASK_EXPIRY_MS = 4 * 60 * 60 * 1000;
export const RECOVERY_REHEARSAL_CONTRACT = "perl-recovery-rehearsal/1.0";
export const RECOVERY_REHEARSAL_BOUNDARY = "This verifies an isolated restore of the local synthetic state. It is not an encrypted production backup, an Azure recovery test, or an approved RPO/RTO claim.";

export class SandboxStore {
  constructor({ filePath, seedAssessments, auditSeed = [], calibrationReferences = {}, calibrationManifest, modelProvider, deliveryConnector = createDeliveryConnector(), rollbackManifest = LOCAL_LAST_KNOWN_GOOD, counselorReferenceDecisionRegistry = disabledCounselorReferenceDecisionRegistry(), independentReviewAdmissionRegistry = disabledIndependentReviewAdmissionRegistry(), candidateRetestDispositionRegistry = disabledCandidateRetestDispositionRegistry(), candidateCycleActionRegistry = disabledCandidateCycleActionRegistry(), candidateAdvancementRegistry = disabledCandidateAdvancementRegistry(), authorityTrustRegistry = disabledAuthorityTrustRegistry(), pilotStartRegistry = disabledPilotStartRegistry(), clinicalReleaseRegistry = disabledClinicalReleaseRegistry(), trafficActivationRegistry = disabledTrafficActivationRegistry(), clock = () => new Date() }) {
    this.filePath = filePath;
    this.seedAssessments = clone(seedAssessments);
    this.auditSeed = clone(auditSeed);
    this.calibrationReferences = clone(calibrationReferences);
    this.calibrationManifest = clone(calibrationManifest);
    this.modelProvider = modelProvider;
    this.deliveryConnector = deliveryConnector;
    this.rollbackManifest = clone(rollbackManifest);
    this.counselorReferenceDecisionRegistry = clone(counselorReferenceDecisionRegistry);
    this.independentReviewAdmissionRegistry = clone(independentReviewAdmissionRegistry);
    this.candidateRetestDispositionRegistry = clone(candidateRetestDispositionRegistry);
    this.candidateCycleActionRegistry = clone(candidateCycleActionRegistry);
    this.candidateAdvancementRegistry = clone(candidateAdvancementRegistry);
    this.authorityTrustRegistry = clone(authorityTrustRegistry);
    this.pilotStartRegistry = clone(pilotStartRegistry);
    this.clinicalReleaseRegistry = clone(clinicalReleaseRegistry);
    this.trafficActivationRegistry = clone(trafficActivationRegistry);
    this.clock = clock;
    this.state = null;
    this.writeChain = Promise.resolve();
  }

  initialState() {
    const reviews = Object.fromEntries(this.seedAssessments.map(assessment => [assessment.id, {
      status: assessment.status || "ready",
      reviewer: assessment.reviewer || "Unassigned",
      safetyAcknowledged: false,
      approvedAt: null,
      updatedAt: null
    }]));
    const audit = {};
    if (this.seedAssessments[0]) audit[this.seedAssessments[0].id] = this.auditSeed.map(entry => ({ ...entry, id: randomUUID(), createdAt: this.clock().toISOString() }));
    return {
      schemaVersion: 49,
      environment: "synthetic-sandbox",
      assessments: this.seedAssessments,
      reviews,
      narratives: {},
      interpretations: {},
      feedback: [],
      feedbackEvents: [],
      comparisons: [],
      comparisonEvents: [],
      reportArtifacts: [],
      changeEvents: [],
      sourceEvents: [],
      attachmentEvents: [],
      automationEvents: [],
      generationRecords: [],
      generationEvents: [],
      activeGenerations: {},
      deliveryJobs: [],
      deliveryEvents: [],
      activeDeliveries: {},
      recoveryEvents: [],
      rollbackEvents: [],
      monitoringEvents: [],
      responseDrillEvents: [],
      readinessEvents: [],
      clinicalStandardDrafts: [],
      clinicalStandardEvents: [],
      independentReviewEvents: [],
      integrationReturnEvents: [],
      counselorNotebookEntries: [],
      counselorReferenceDrafts: [],
      counselorReferenceAdjudicationEvents: [],
      counselorReferenceDecisionEvents: [],
      independentReviewAdmissionEvents: [],
      progressReviewEvents: [],
      modelTrialEvents: [],
      candidateTrialEvents: [],
      candidateReturnEvents: [],
      candidateBlindReviewEvents: [],
      candidateRefinementEvents: [],
      candidateRetestReturnEvents: [],
      candidateRetestReviewEvents: [],
      candidateRetestDispositionEvents: [],
      candidateAdvancementEvents: [],
      intendedUseDrafts: [],
      intendedUseEvents: [],
      languageReviewPackets: [],
      languageReviewEvents: [],
      decisionExchangeEvents: [],
      pilotOperationsEvents: [],
      providerActivationEvents: [],
      campusObservatoryEvents: [],
      siteAdmissionEvents: [],
      authorityTrustEvents: [],
      pilotStartEvents: [],
      clinicalReleaseEvents: [],
      trafficActivationEvents: [],
      identityAccessEvents: [],
      pendingComparisons: {},
      pendingCandidateBlindReviews: {},
      pendingCandidateRetestReviews: {},
      pendingTimingTasks: {},
      timingObservations: [],
      timingEvents: [],
      revisions: [],
      incidentEvents: [],
      audit
    };
  }

  async init() {
    if (this.state) return;
    const manifestErrors = validateCalibrationManifest(this.calibrationManifest, this.seedAssessments, this.calibrationReferences);
    if (manifestErrors.length) fail(`Calibration case-set manifest is invalid: ${manifestErrors.join(" ")}`, 500);
    const responseContractErrors = validateIncidentResponseContract();
    if (responseContractErrors.length) fail(`Incident-response contract is invalid: ${responseContractErrors.join(" ")}`, 500);
    const readinessContractErrors = validatePilotReadinessContract();
    if (readinessContractErrors.length) fail(`Pilot-readiness contract is invalid: ${readinessContractErrors.join(" ")}`, 500);
    const independentReviewContractErrors = validateIndependentReviewContract();
    if (independentReviewContractErrors.length) fail(`Independent-review contract is invalid: ${independentReviewContractErrors.join(" ")}`, 500);
    const integrationReturnContractErrors = validateIntegrationReturnContract();
    if (integrationReturnContractErrors.length) fail(`e-QPASS owner-return contract is invalid: ${integrationReturnContractErrors.join(" ")}`, 500);
    const counselorNotebookContractErrors = validateCounselorNotebookContract();
    if (counselorNotebookContractErrors.length) fail(`Counselor notebook contract is invalid: ${counselorNotebookContractErrors.join(" ")}`, 500);
    const counselorReferenceContractErrors = validateCounselorReferenceContract();
    if (counselorReferenceContractErrors.length) fail(`Counselor reference contract is invalid: ${counselorReferenceContractErrors.join(" ")}`, 500);
    const counselorReferenceAdjudicationContractErrors = validateCounselorReferenceAdjudicationContract();
    if (counselorReferenceAdjudicationContractErrors.length) fail(`Counselor reference adjudication contract is invalid: ${counselorReferenceAdjudicationContractErrors.join(" ")}`, 500);
    const counselorReferenceDecisionRegistryErrors = validateCounselorReferenceDecisionRegistry(this.counselorReferenceDecisionRegistry);
    if (counselorReferenceDecisionRegistryErrors.length) fail(`Counselor reference decision registry is invalid: ${counselorReferenceDecisionRegistryErrors.join(" ")}`, 500);
    const independentReviewAdmissionRegistryErrors = validateIndependentReviewAdmissionRegistry(this.independentReviewAdmissionRegistry);
    if (independentReviewAdmissionRegistryErrors.length) fail(`Independent-review admission registry is invalid: ${independentReviewAdmissionRegistryErrors.join(" ")}`, 500);
    const progressReviewContractErrors = validateProgressReviewContract();
    if (progressReviewContractErrors.length) fail(`Progress Review contract is invalid: ${progressReviewContractErrors.join(" ")}`, 500);
    const modelTrialContractErrors = validateModelTrialContract();
    if (modelTrialContractErrors.length) fail(`Model-trial contract is invalid: ${modelTrialContractErrors.join(" ")}`, 500);
    const candidateTrialContractErrors = validateCandidateTrialContract();
    if (candidateTrialContractErrors.length) fail(`Candidate-trial contract is invalid: ${candidateTrialContractErrors.join(" ")}`, 500);
    const candidateReturnContractErrors = validateCandidateReturnContract();
    if (candidateReturnContractErrors.length) fail(`Candidate-return contract is invalid: ${candidateReturnContractErrors.join(" ")}`, 500);
    const candidateBlindReviewContractErrors = validateCandidateBlindReviewContract();
    if (candidateBlindReviewContractErrors.length) fail(`Candidate blind-review contract is invalid: ${candidateBlindReviewContractErrors.join(" ")}`, 500);
    const candidateRefinementContractErrors = validateCandidateRefinementContract();
    if (candidateRefinementContractErrors.length) fail(`Candidate refinement and retest contract is invalid: ${candidateRefinementContractErrors.join(" ")}`, 500);
    const candidateRetestReturnContractErrors = validateCandidateRetestReturnContract();
    if (candidateRetestReturnContractErrors.length) fail(`Candidate retest-return contract is invalid: ${candidateRetestReturnContractErrors.join(" ")}`, 500);
    const candidateRetestReviewContractErrors = validateCandidateRetestReviewContract();
    if (candidateRetestReviewContractErrors.length) fail(`Candidate retest re-review contract is invalid: ${candidateRetestReviewContractErrors.join(" ")}`, 500);
    const candidateRetestDispositionContractErrors = validateCandidateRetestDispositionContract();
    if (candidateRetestDispositionContractErrors.length) fail(`Candidate retest disposition contract is invalid: ${candidateRetestDispositionContractErrors.join(" ")}`, 500);
    const candidateRetestDispositionRegistryErrors = validateCandidateRetestDispositionRegistry(this.candidateRetestDispositionRegistry);
    if (candidateRetestDispositionRegistryErrors.length) fail(`Candidate retest disposition registry is invalid: ${candidateRetestDispositionRegistryErrors.join(" ")}`, 500);
    const candidateAdvancementContractErrors = validateCandidateAdvancementContract();
    if (candidateAdvancementContractErrors.length) fail(`Candidate advancement airlock contract is invalid: ${candidateAdvancementContractErrors.join(" ")}`, 500);
    const candidateCycleActionRegistryErrors = validateCandidateCycleActionRegistry(this.candidateCycleActionRegistry);
    if (candidateCycleActionRegistryErrors.length) fail(`Candidate cycle-action registry is invalid: ${candidateCycleActionRegistryErrors.join(" ")}`, 500);
    const candidateAdvancementRegistryErrors = validateCandidateAdvancementRegistry(this.candidateAdvancementRegistry);
    if (candidateAdvancementRegistryErrors.length) fail(`Candidate advancement registry is invalid: ${candidateAdvancementRegistryErrors.join(" ")}`, 500);
    const intendedUseContractErrors = validateIntendedUseContract();
    if (intendedUseContractErrors.length) fail(`Intended-use contract is invalid: ${intendedUseContractErrors.join(" ")}`, 500);
    const languageReviewContractErrors = validateLanguageReviewContract();
    if (languageReviewContractErrors.length) fail(`Language-review contract is invalid: ${languageReviewContractErrors.join(" ")}`, 500);
    const decisionExchangeContractErrors = validateDecisionExchangeContract();
    if (decisionExchangeContractErrors.length) fail(`Decision Exchange contract is invalid: ${decisionExchangeContractErrors.join(" ")}`, 500);
    const pilotOperationsContractErrors = validatePilotOperationsContract();
    if (pilotOperationsContractErrors.length) fail(`Pilot-operations contract is invalid: ${pilotOperationsContractErrors.join(" ")}`, 500);
    const providerActivationContractErrors = validateProviderActivationContract();
    if (providerActivationContractErrors.length) fail(`Provider-activation contract is invalid: ${providerActivationContractErrors.join(" ")}`, 500);
    const campusObservatoryContractErrors = validateCampusObservatoryContract();
    if (campusObservatoryContractErrors.length) fail(`Campus-observatory contract is invalid: ${campusObservatoryContractErrors.join(" ")}`, 500);
    const siteAdmissionContractErrors = validateSiteAdmissionContract();
    if (siteAdmissionContractErrors.length) fail(`Site-admission contract is invalid: ${siteAdmissionContractErrors.join(" ")}`, 500);
    const authorityTrustRegistryErrors = validateAuthorityTrustRegistry(this.authorityTrustRegistry);
    if (authorityTrustRegistryErrors.length) fail(`Authority-trust registry is invalid: ${authorityTrustRegistryErrors.join(" ")}`, 500);
    const pilotStartRegistryErrors = validatePilotStartRegistry(this.pilotStartRegistry);
    if (pilotStartRegistryErrors.length) fail(`Pilot-start registry is invalid: ${pilotStartRegistryErrors.join(" ")}`, 500);
    const clinicalReleaseRegistryErrors = validateClinicalReleaseRegistry(this.clinicalReleaseRegistry);
    if (clinicalReleaseRegistryErrors.length) fail(`Clinical-release registry is invalid: ${clinicalReleaseRegistryErrors.join(" ")}`, 500);
    const trafficActivationRegistryErrors = validateTrafficActivationRegistry(this.trafficActivationRegistry);
    if (trafficActivationRegistryErrors.length) fail(`Traffic-activation registry is invalid: ${trafficActivationRegistryErrors.join(" ")}`, 500);
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49].includes(parsed.schemaVersion) || parsed.environment !== "synthetic-sandbox") fail("Unsupported or unsafe sandbox state file.", 500);
      let migrated = false;
      let workflowBaselinesRequired = false;
      let generationBaselinesRequired = false;
      let deliveryBaselinesRequired = false;
      if (parsed.schemaVersion === 1) {
        parsed.assessments = parsed.assessments.map(({ hypotheses, questions, ...assessment }) => assessment);
        parsed.schemaVersion = 2;
        migrated = true;
      }
      if (parsed.schemaVersion === 2) {
        parsed.interpretations = {};
        parsed.schemaVersion = 3;
        migrated = true;
      }
      if (parsed.schemaVersion === 3) {
        parsed.revisions = [];
        parsed.schemaVersion = 4;
        migrated = true;
      }
      if (parsed.schemaVersion === 4) {
        parsed.incidentEvents = [];
        parsed.schemaVersion = 5;
        migrated = true;
      }
      if (parsed.schemaVersion === 5) {
        parsed.comparisonEvents = [];
        for (const comparison of [...(parsed.comparisons || [])].reverse()) {
          const previous = parsed.comparisonEvents.at(-1);
          const core = {
            id: randomUUID(),
            sequence: parsed.comparisonEvents.length + 1,
            previousHash: previous?.hash || "GENESIS",
            type: "legacy-baseline",
            comparisonId: comparison.id,
            comparisonHash: digest(comparison),
            createdAt: this.clock().toISOString(),
            note: "Integrity baseline established during schema-v6 migration; this does not prove pre-migration immutability."
          };
          parsed.comparisonEvents.push({ ...core, hash: digest(core) });
        }
        parsed.schemaVersion = 6;
        migrated = true;
      }
      if (parsed.schemaVersion === 6) {
        parsed.reportArtifacts = [];
        parsed.schemaVersion = 7;
        migrated = true;
      }
      if (parsed.schemaVersion === 7) {
        parsed.changeEvents = [];
        parsed.schemaVersion = 8;
        migrated = true;
      }
      if (parsed.schemaVersion === 8) {
        parsed.sourceEvents = [];
        parsed.schemaVersion = 9;
        migrated = true;
      }
      if (parsed.schemaVersion === 9) {
        parsed.attachmentEvents = [];
        parsed.schemaVersion = 10;
        migrated = true;
      }
      if (parsed.schemaVersion === 10) {
        parsed.pendingTimingTasks = {};
        parsed.timingObservations = [];
        parsed.timingEvents = [];
        parsed.schemaVersion = 11;
        migrated = true;
      }
      if (parsed.schemaVersion === 11) {
        parsed.feedbackEvents = [];
        for (const feedback of [...(parsed.feedback || [])].reverse()) {
          const previous = parsed.feedbackEvents.at(-1);
          const core = {
            id: randomUUID(),
            sequence: parsed.feedbackEvents.length + 1,
            previousHash: previous?.hash || "GENESIS",
            type: "legacy-baseline",
            feedbackId: feedback.id,
            feedbackHash: digest(feedback),
            createdAt: this.clock().toISOString(),
            note: "Integrity baseline established during schema-v12 migration; this does not prove pre-migration immutability."
          };
          parsed.feedbackEvents.push({ ...core, hash: digest(core) });
        }
        parsed.schemaVersion = 12;
        migrated = true;
      }
      if (parsed.schemaVersion === 12) {
        parsed.automationEvents = [];
        parsed.schemaVersion = 13;
        workflowBaselinesRequired = true;
        migrated = true;
      }
      if (parsed.schemaVersion === 13) {
        parsed.generationRecords = [];
        parsed.generationEvents = [];
        parsed.activeGenerations = {};
        parsed.schemaVersion = 14;
        generationBaselinesRequired = true;
        migrated = true;
      }
      if (parsed.schemaVersion === 14) {
        parsed.deliveryJobs = [];
        parsed.deliveryEvents = [];
        parsed.activeDeliveries = {};
        parsed.schemaVersion = 15;
        deliveryBaselinesRequired = true;
        migrated = true;
      }
      if (parsed.schemaVersion === 15) {
        parsed.recoveryEvents = [];
        parsed.schemaVersion = 16;
        migrated = true;
      }
      if (parsed.schemaVersion === 16) {
        parsed.rollbackEvents = [];
        parsed.schemaVersion = 17;
        migrated = true;
      }
      if (parsed.schemaVersion === 17) {
        parsed.monitoringEvents = [];
        parsed.schemaVersion = 18;
        migrated = true;
      }
      if (parsed.schemaVersion === 18) {
        parsed.responseDrillEvents = [];
        parsed.schemaVersion = 19;
        migrated = true;
      }
      if (parsed.schemaVersion === 19) {
        parsed.readinessEvents = [];
        parsed.schemaVersion = 20;
        migrated = true;
      }
      if (parsed.schemaVersion === 20) {
        parsed.clinicalStandardDrafts = [];
        parsed.clinicalStandardEvents = [];
        parsed.schemaVersion = 21;
        migrated = true;
      }
      if (parsed.schemaVersion === 21) {
        parsed.independentReviewEvents = [];
        parsed.schemaVersion = 22;
        migrated = true;
      }
      if (parsed.schemaVersion === 22) {
        parsed.integrationReturnEvents = [];
        parsed.schemaVersion = 23;
        migrated = true;
      }
      if (parsed.schemaVersion === 23) {
        parsed.counselorNotebookEntries = [];
        parsed.schemaVersion = 24;
        migrated = true;
      }
      if (parsed.schemaVersion === 24) {
        parsed.progressReviewEvents = [];
        parsed.schemaVersion = 25;
        migrated = true;
      }
      if (parsed.schemaVersion === 25) {
        parsed.modelTrialEvents = [];
        parsed.schemaVersion = 26;
        migrated = true;
      }
      if (parsed.schemaVersion === 26) {
        parsed.candidateTrialEvents = [];
        parsed.schemaVersion = 27;
        migrated = true;
      }
      if (parsed.schemaVersion === 27) {
        parsed.intendedUseDrafts = [];
        parsed.intendedUseEvents = [];
        parsed.schemaVersion = 28;
        migrated = true;
      }
      if (parsed.schemaVersion === 28) {
        parsed.languageReviewPackets = [];
        parsed.languageReviewEvents = [];
        parsed.schemaVersion = 29;
        migrated = true;
      }
      if (parsed.schemaVersion === 29) {
        parsed.decisionExchangeEvents = [];
        parsed.schemaVersion = 30;
        migrated = true;
      }
      if (parsed.schemaVersion === 30) {
        parsed.pilotOperationsEvents = [];
        parsed.schemaVersion = 31;
        migrated = true;
      }
      if (parsed.schemaVersion === 31) {
        parsed.providerActivationEvents = [];
        parsed.schemaVersion = 32;
        migrated = true;
      }
      if (parsed.schemaVersion === 32) {
        parsed.siteAdmissionEvents = [];
        parsed.schemaVersion = 33;
        migrated = true;
      }
      if (parsed.schemaVersion === 33) {
        parsed.authorityTrustEvents = [];
        parsed.schemaVersion = 34;
        migrated = true;
      }
      if (parsed.schemaVersion === 34) {
        parsed.pilotStartEvents = [];
        parsed.schemaVersion = 35;
        migrated = true;
      }
      if (parsed.schemaVersion === 35) {
        parsed.clinicalReleaseEvents = [];
        parsed.schemaVersion = 36;
        migrated = true;
      }
      if (parsed.schemaVersion === 36) {
        parsed.trafficActivationEvents = [];
        parsed.schemaVersion = 37;
        migrated = true;
      }
      if (parsed.schemaVersion === 37) {
        parsed.identityAccessEvents = [];
        parsed.schemaVersion = 38;
        migrated = true;
      }
      if (parsed.schemaVersion === 38) {
        parsed.counselorReferenceDrafts = [];
        parsed.schemaVersion = 39;
        migrated = true;
      }
      if (parsed.schemaVersion === 39) {
        parsed.counselorReferenceAdjudicationEvents = [];
        parsed.schemaVersion = 40;
        migrated = true;
      }
      if (parsed.schemaVersion === 40) {
        parsed.counselorReferenceDecisionEvents = [];
        parsed.schemaVersion = 41;
        migrated = true;
      }
      if (parsed.schemaVersion === 41) {
        parsed.independentReviewAdmissionEvents = [];
        parsed.schemaVersion = 42;
        migrated = true;
      }
      if (parsed.schemaVersion === 42) {
        parsed.campusObservatoryEvents = [];
        parsed.schemaVersion = 43;
        migrated = true;
      }
      if (parsed.schemaVersion === 43) {
        parsed.candidateReturnEvents = [];
        parsed.schemaVersion = 44;
        migrated = true;
      }
      if (parsed.schemaVersion === 44) {
        parsed.candidateBlindReviewEvents = [];
        parsed.pendingCandidateBlindReviews = {};
        parsed.schemaVersion = 45;
        migrated = true;
      }
      if (parsed.schemaVersion === 45) {
        parsed.candidateRefinementEvents = [];
        parsed.schemaVersion = 46;
        migrated = true;
      }
      if (parsed.schemaVersion === 46) {
        parsed.candidateRetestReturnEvents = [];
        parsed.candidateRetestReviewEvents = [];
        parsed.pendingCandidateRetestReviews = {};
        parsed.schemaVersion = 47;
        migrated = true;
      }
      if (parsed.schemaVersion === 47) {
        parsed.candidateRetestDispositionEvents = [];
        parsed.schemaVersion = 48;
        migrated = true;
      }
      if (parsed.schemaVersion === 48) {
        parsed.candidateAdvancementEvents = [];
        parsed.schemaVersion = 49;
        migrated = true;
      }
      this.state = parsed;
      this.state.pendingComparisons ||= {};
      this.state.revisions ||= [];
      this.state.feedbackEvents ||= [];
      this.state.incidentEvents ||= [];
      this.state.comparisonEvents ||= [];
      this.state.reportArtifacts ||= [];
      this.state.changeEvents ||= [];
      this.state.sourceEvents ||= [];
      this.state.attachmentEvents ||= [];
      this.state.automationEvents ||= [];
      this.state.generationRecords ||= [];
      this.state.generationEvents ||= [];
      this.state.activeGenerations ||= {};
      this.state.deliveryJobs ||= [];
      this.state.deliveryEvents ||= [];
      this.state.activeDeliveries ||= {};
      this.state.recoveryEvents ||= [];
      this.state.rollbackEvents ||= [];
      this.state.monitoringEvents ||= [];
      this.state.responseDrillEvents ||= [];
      this.state.readinessEvents ||= [];
      this.state.clinicalStandardDrafts ||= [];
      this.state.clinicalStandardEvents ||= [];
      this.state.independentReviewEvents ||= [];
      this.state.integrationReturnEvents ||= [];
      this.state.counselorNotebookEntries ||= [];
      this.state.counselorReferenceDrafts ||= [];
      this.state.counselorReferenceAdjudicationEvents ||= [];
      this.state.counselorReferenceDecisionEvents ||= [];
      this.state.independentReviewAdmissionEvents ||= [];
      this.state.progressReviewEvents ||= [];
      this.state.modelTrialEvents ||= [];
      this.state.candidateTrialEvents ||= [];
      this.state.candidateReturnEvents ||= [];
      this.state.candidateBlindReviewEvents ||= [];
      this.state.candidateRefinementEvents ||= [];
      this.state.candidateRetestReturnEvents ||= [];
      this.state.candidateRetestReviewEvents ||= [];
      this.state.candidateRetestDispositionEvents ||= [];
      this.state.candidateAdvancementEvents ||= [];
      this.state.intendedUseDrafts ||= [];
      this.state.intendedUseEvents ||= [];
      this.state.languageReviewPackets ||= [];
      this.state.languageReviewEvents ||= [];
      this.state.decisionExchangeEvents ||= [];
      this.state.pilotOperationsEvents ||= [];
      this.state.providerActivationEvents ||= [];
      this.state.campusObservatoryEvents ||= [];
      this.state.siteAdmissionEvents ||= [];
      this.state.authorityTrustEvents ||= [];
      this.state.pilotStartEvents ||= [];
      this.state.clinicalReleaseEvents ||= [];
      this.state.trafficActivationEvents ||= [];
      this.state.identityAccessEvents ||= [];
      this.state.pendingTimingTasks ||= {};
      this.state.pendingCandidateBlindReviews ||= {};
      this.state.pendingCandidateRetestReviews ||= {};
      this.state.timingObservations ||= [];
      this.state.timingEvents ||= [];
      const blindAssignmentExpiry = this.clock().getTime() - BLIND_ASSIGNMENT_EXPIRY_MS;
      for (const [caseId, pending] of Object.entries(this.state.pendingComparisons)) {
        if (!pending.actor || !pending.summaries || !pending.createdAt || new Date(pending.createdAt).getTime() < blindAssignmentExpiry) {
          delete this.state.pendingComparisons[caseId];
          migrated = true;
        } else if (!pending.caseSet && this.calibrationManifest.cases[pending.assessmentId]) {
          const manifestCase = this.calibrationManifest.cases[pending.assessmentId];
          pending.caseSet = { id: this.calibrationManifest.id, version: this.calibrationManifest.version };
          pending.partition = manifestCase.partition;
          pending.strata = clone(manifestCase.strata);
          pending.sourceVersion = manifestCase.sourceVersion;
          pending.referenceVersion = manifestCase.referenceVersion;
          migrated = true;
        }
      }
      for (const [assignmentId, pending] of Object.entries(this.state.pendingCandidateBlindReviews)) {
        if (!pending?.actor || !pending?.packetFingerprint || !pending?.createdAt || !pending?.expiresAt || Date.parse(pending.expiresAt) < this.clock().getTime()) {
          delete this.state.pendingCandidateBlindReviews[assignmentId];
          migrated = true;
        }
      }
      for (const [assignmentId, pending] of Object.entries(this.state.pendingCandidateRetestReviews)) {
        if (!pending?.actor || !pending?.packetFingerprint || !pending?.createdAt || !pending?.expiresAt || Date.parse(pending.expiresAt) < this.clock().getTime()) {
          delete this.state.pendingCandidateRetestReviews[assignmentId];
          migrated = true;
        }
      }
      const timingTaskExpiry = this.clock().getTime() - TIMING_TASK_EXPIRY_MS;
      for (const [taskId, pending] of Object.entries(this.state.pendingTimingTasks)) {
        if (
          !pending.actor
          || !WORKFLOW_TIMING_CONTRACT.conditions.includes(pending.condition)
          || !pending.assessmentId
          || !pending.createdAt
          || new Date(pending.createdAt).getTime() < timingTaskExpiry
        ) {
          delete this.state.pendingTimingTasks[taskId];
          migrated = true;
        }
      }
      const chain = this.verifyRevisionChain();
      if (!chain.valid) fail(`Revision history integrity check failed at sequence ${chain.failedAt}.`, 500);
      const feedbackChain = this.verifyFeedbackEventChain();
      if (!feedbackChain.valid) fail(`Reviewer feedback history integrity check failed${feedbackChain.failedAt ? ` at sequence ${feedbackChain.failedAt}` : ""}.`, 500);
      const incidentChain = this.verifyIncidentChain();
      if (!incidentChain.valid) fail(`Safety incident history integrity check failed at sequence ${incidentChain.failedAt}.`, 500);
      const comparisonChain = this.verifyComparisonChain();
      if (!comparisonChain.valid) fail(`Blind outcome history integrity check failed${comparisonChain.failedAt ? ` at sequence ${comparisonChain.failedAt}` : ""}.`, 500);
      const reportChain = this.verifyReportArtifactChain();
      if (!reportChain.valid) fail(`Approved report artifact integrity check failed${reportChain.failedAt ? ` at sequence ${reportChain.failedAt}` : ""}.`, 500);
      const changeChain = this.verifyChangeEventChain();
      if (!changeChain.valid) fail(`Change-control history integrity check failed${changeChain.failedAt ? ` at sequence ${changeChain.failedAt}` : ""}.`, 500);
      const sourceEventChain = this.verifySourceEventChain();
      if (!sourceEventChain.valid) fail(`Source-event receipt integrity check failed${sourceEventChain.failedAt ? ` at sequence ${sourceEventChain.failedAt}` : ""}.`, 500);
      const attachmentEventChain = this.verifyAttachmentEventChain();
      if (!attachmentEventChain.valid) fail(`Attachment-preparation history integrity check failed${attachmentEventChain.failedAt ? ` at sequence ${attachmentEventChain.failedAt}` : ""}.`, 500);
      if (workflowBaselinesRequired && this.ensureWorkflowBaselines()) migrated = true;
      const automationEventChain = this.verifyAutomationEventChain();
      if (!automationEventChain.valid) fail(`Provider-workflow history integrity check failed${automationEventChain.failedAt ? ` at sequence ${automationEventChain.failedAt}` : ""}.`, 500);
      if (generationBaselinesRequired && await this.ensureGenerationSnapshots("schema-v14-migration", "schema-v14-migration")) migrated = true;
      const generationEventChain = this.verifyGenerationEventChain();
      if (!generationEventChain.valid) fail(`Generation-snapshot history integrity check failed${generationEventChain.failedAt ? ` at sequence ${generationEventChain.failedAt}` : ""}.`, 500);
      if (deliveryBaselinesRequired && this.ensureDeliveryBaselines()) migrated = true;
      let deliveryChain = this.verifyDeliveryChain();
      if (!deliveryChain.valid) fail(`Delivery-outbox history integrity check failed${deliveryChain.failedAt ? ` at sequence ${deliveryChain.failedAt}` : ""}.`, 500);
      if (this.recoverInterruptedDeliveryAttempts()) migrated = true;
      deliveryChain = this.verifyDeliveryChain();
      if (!deliveryChain.valid) fail(`Delivery-outbox history integrity check failed${deliveryChain.failedAt ? ` at sequence ${deliveryChain.failedAt}` : ""}.`, 500);
      const timingEventChain = this.verifyTimingEventChain();
      if (!timingEventChain.valid) fail(`Workflow-timing history integrity check failed${timingEventChain.failedAt ? ` at sequence ${timingEventChain.failedAt}` : ""}.`, 500);
      const recoveryEventChain = this.verifyRecoveryEventChain();
      if (!recoveryEventChain.valid) fail(`Recovery-rehearsal history integrity check failed${recoveryEventChain.failedAt ? ` at sequence ${recoveryEventChain.failedAt}` : ""}.`, 500);
      const rollbackEventChain = this.verifyRollbackEventChain();
      if (!rollbackEventChain.valid) fail(`Application-rollback history integrity check failed${rollbackEventChain.failedAt ? ` at sequence ${rollbackEventChain.failedAt}` : ""}.`, 500);
      const monitoringEventChain = this.verifyMonitoringEventChain();
      if (!monitoringEventChain.valid) fail(`Operational-monitoring history integrity check failed${monitoringEventChain.failedAt ? ` at sequence ${monitoringEventChain.failedAt}` : ""}.`, 500);
      const responseDrillChain = this.verifyResponseDrillEventChain();
      if (!responseDrillChain.valid) fail(`Incident-response rehearsal history integrity check failed${responseDrillChain.failedAt ? ` at sequence ${responseDrillChain.failedAt}` : ""}.`, 500);
      const readinessChain = this.verifyReadinessEventChain();
      if (!readinessChain.valid) fail(`Pilot-readiness snapshot history integrity check failed${readinessChain.failedAt ? ` at sequence ${readinessChain.failedAt}` : ""}.`, 500);
      const clinicalStandardChain = this.verifyClinicalStandardEventChain();
      if (!clinicalStandardChain.valid) fail(`Clinical-standard draft history integrity check failed${clinicalStandardChain.failedAt ? ` at sequence ${clinicalStandardChain.failedAt}` : ""}.`, 500);
      const independentReviewChain = this.verifyIndependentReviewEventChain();
      if (!independentReviewChain.valid) fail(`Independent-review dossier history integrity check failed${independentReviewChain.failedAt ? ` at sequence ${independentReviewChain.failedAt}` : ""}.`, 500);
      const integrationReturnChain = this.verifyIntegrationReturnEventChain();
      if (!integrationReturnChain.valid) fail(`e-QPASS owner-return preflight history integrity check failed${integrationReturnChain.failedAt ? ` at sequence ${integrationReturnChain.failedAt}` : ""}.`, 500);
      const counselorNotebookChain = this.verifyCounselorNotebookEntryChain();
      if (!counselorNotebookChain.valid) fail(`Counselor session notebook history integrity check failed${counselorNotebookChain.failedAt ? ` at sequence ${counselorNotebookChain.failedAt}` : ""}.`, 500);
      const counselorReferenceChain = this.verifyCounselorReferenceDraftChain();
      if (!counselorReferenceChain.valid) fail(`Counselor reference draft history integrity check failed${counselorReferenceChain.failedAt ? ` at sequence ${counselorReferenceChain.failedAt}` : ""}.`, 500);
      const counselorReferenceAdjudicationChain = this.verifyCounselorReferenceAdjudicationChain();
      if (!counselorReferenceAdjudicationChain.valid) fail(`Counselor reference adjudication history integrity check failed${counselorReferenceAdjudicationChain.failedAt ? ` at sequence ${counselorReferenceAdjudicationChain.failedAt}` : ""}.`, 500);
      const counselorReferenceDecisionChain = this.verifyCounselorReferenceDecisionChain();
      if (!counselorReferenceDecisionChain.valid) fail(`Counselor reference decision history integrity check failed${counselorReferenceDecisionChain.failedAt ? ` at sequence ${counselorReferenceDecisionChain.failedAt}` : ""}.`, 500);
      const independentReviewAdmissionChain = this.verifyIndependentReviewAdmissionChain();
      if (!independentReviewAdmissionChain.valid) fail(`Independent-review admission history integrity check failed${independentReviewAdmissionChain.failedAt ? ` at sequence ${independentReviewAdmissionChain.failedAt}` : ""}.`, 500);
      const progressReviewChain = this.verifyProgressReviewObservationChain();
      if (!progressReviewChain.valid) fail(`Progress Review history integrity check failed${progressReviewChain.failedAt ? ` at sequence ${progressReviewChain.failedAt}` : ""}.`, 500);
      const modelTrialChain = this.verifyModelTrialPreflightChain();
      if (!modelTrialChain.valid) fail(`Model-trial preflight history integrity check failed${modelTrialChain.failedAt ? ` at sequence ${modelTrialChain.failedAt}` : ""}.`, 500);
      const candidateTrialChain = this.verifyCandidateTrialSnapshotChain();
      if (!candidateTrialChain.valid) fail(`Candidate-trial planning history integrity check failed${candidateTrialChain.failedAt ? ` at sequence ${candidateTrialChain.failedAt}` : ""}.`, 500);
      const candidateReturnChain = this.verifyCandidateReturnEventChain();
      if (!candidateReturnChain.valid) fail(`Candidate-return history integrity check failed${candidateReturnChain.failedAt ? ` at sequence ${candidateReturnChain.failedAt}` : ""}.`, 500);
      const candidateBlindReviewChain = this.verifyCandidateBlindReviewEventChain();
      if (!candidateBlindReviewChain.valid) fail(`Candidate blind-review history integrity check failed${candidateBlindReviewChain.failedAt ? ` at sequence ${candidateBlindReviewChain.failedAt}` : ""}.`, 500);
      const candidateRefinementChain = this.verifyCandidateRefinementCycleChain();
      if (!candidateRefinementChain.valid) fail(`Candidate refinement and retest history integrity check failed${candidateRefinementChain.failedAt ? ` at sequence ${candidateRefinementChain.failedAt}` : ""}.`, 500);
      const candidateRetestReturnChain = this.verifyCandidateRetestReturnChain();
      if (!candidateRetestReturnChain.valid) fail(`Candidate retest-return history integrity check failed${candidateRetestReturnChain.failedAt ? ` at sequence ${candidateRetestReturnChain.failedAt}` : ""}.`, 500);
      const candidateRetestReviewChain = this.verifyCandidateRetestReviewChain();
      if (!candidateRetestReviewChain.valid) fail(`Candidate retest re-review history integrity check failed${candidateRetestReviewChain.failedAt ? ` at sequence ${candidateRetestReviewChain.failedAt}` : ""}.`, 500);
      const candidateRetestDispositionChain = this.verifyCandidateRetestDispositionChain();
      if (!candidateRetestDispositionChain.valid) fail(`Candidate retest disposition history integrity check failed${candidateRetestDispositionChain.failedAt ? ` at sequence ${candidateRetestDispositionChain.failedAt}` : ""}.`, 500);
      const candidateAdvancementChain = this.verifyCandidateAdvancementChain();
      if (!candidateAdvancementChain.valid) fail(`Candidate advancement airlock history integrity check failed${candidateAdvancementChain.failedAt ? ` at sequence ${candidateAdvancementChain.failedAt}` : ""}.`, 500);
      const intendedUseChain = this.verifyIntendedUseEventChain();
      if (!intendedUseChain.valid) fail(`Intended-use draft history integrity check failed${intendedUseChain.failedAt ? ` at sequence ${intendedUseChain.failedAt}` : ""}.`, 500);
      const languageReviewChain = this.verifyLanguageReviewEventChain();
      if (!languageReviewChain.valid) fail(`Language-review packet history integrity check failed${languageReviewChain.failedAt ? ` at sequence ${languageReviewChain.failedAt}` : ""}.`, 500);
      const decisionExchangeChain = this.verifyDecisionExchangeEventChain();
      if (!decisionExchangeChain.valid) fail(`Decision Exchange preflight history integrity check failed${decisionExchangeChain.failedAt ? ` at sequence ${decisionExchangeChain.failedAt}` : ""}.`, 500);
      const pilotOperationsChain = this.verifyPilotOperationsSnapshotChain();
      if (!pilotOperationsChain.valid) fail(`Pilot-operations planning history integrity check failed${pilotOperationsChain.failedAt ? ` at sequence ${pilotOperationsChain.failedAt}` : ""}.`, 500);
      const providerActivationChain = this.verifyProviderActivationSnapshotChain();
      if (!providerActivationChain.valid) fail(`Provider-activation workbook history integrity check failed${providerActivationChain.failedAt ? ` at sequence ${providerActivationChain.failedAt}` : ""}.`, 500);
      const campusObservatoryChain = this.verifyCampusObservatorySnapshotChain();
      if (!campusObservatoryChain.valid) fail(`Campus-observatory history integrity check failed${campusObservatoryChain.failedAt ? ` at sequence ${campusObservatoryChain.failedAt}` : ""}.`, 500);
      const siteAdmissionChain = this.verifySiteAdmissionEventChain();
      if (!siteAdmissionChain.valid) fail(`Site-admission return history integrity check failed${siteAdmissionChain.failedAt ? ` at sequence ${siteAdmissionChain.failedAt}` : ""}.`, 500);
      const authorityTrustChain = this.verifyAuthorityTrustEventChain();
      if (!authorityTrustChain.valid) fail(`Authority-trust receipt history integrity check failed${authorityTrustChain.failedAt ? ` at sequence ${authorityTrustChain.failedAt}` : ""}.`, 500);
      const pilotStartChain = this.verifyPilotStartEventChain();
      if (!pilotStartChain.valid) fail(`Pilot-start interlock history integrity check failed${pilotStartChain.failedAt ? ` at sequence ${pilotStartChain.failedAt}` : ""}.`, 500);
      const clinicalReleaseChain = this.verifyClinicalReleaseEventChain();
      if (!clinicalReleaseChain.valid) fail(`Clinical-release gate history integrity check failed${clinicalReleaseChain.failedAt ? ` at sequence ${clinicalReleaseChain.failedAt}` : ""}.`, 500);
      const trafficActivationChain = this.verifyTrafficActivationEventChain();
      if (!trafficActivationChain.valid) fail(`Traffic-activation witness history integrity check failed${trafficActivationChain.failedAt ? ` at sequence ${trafficActivationChain.failedAt}` : ""}.`, 500);
      const identityAccessChain = this.verifyIdentityAccessEventChain();
      if (!identityAccessChain.valid) fail(`Identity-access decision history integrity check failed${identityAccessChain.failedAt ? ` at sequence ${identityAccessChain.failedAt}` : ""}.`, 500);
      if (await this.ensureApprovedReportBaselines()) migrated = true;
      if (migrated) await this.persist();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = this.initialState();
      await this.ensureGenerationSnapshots("seed-initialization", "PERL baseline");
      await this.ensureApprovedReportBaselines();
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2) + "\n";
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await writeFile(temporaryPath, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    });
    await this.writeChain;
  }

  recordCounts(state = this.state) {
    const countKeys = [
      "assessments", "feedback", "feedbackEvents", "comparisons", "comparisonEvents",
      "reportArtifacts", "changeEvents", "sourceEvents", "attachmentEvents", "automationEvents",
      "generationRecords", "generationEvents", "deliveryJobs", "deliveryEvents", "recoveryEvents", "rollbackEvents", "monitoringEvents", "responseDrillEvents", "readinessEvents",
      "clinicalStandardDrafts", "clinicalStandardEvents", "independentReviewEvents", "integrationReturnEvents", "counselorNotebookEntries", "counselorReferenceDrafts", "counselorReferenceAdjudicationEvents", "counselorReferenceDecisionEvents", "independentReviewAdmissionEvents", "progressReviewEvents", "modelTrialEvents", "candidateTrialEvents", "candidateReturnEvents", "candidateBlindReviewEvents", "candidateRefinementEvents", "candidateRetestReturnEvents", "candidateRetestReviewEvents", "candidateRetestDispositionEvents", "candidateAdvancementEvents", "intendedUseDrafts", "intendedUseEvents", "languageReviewPackets", "languageReviewEvents", "decisionExchangeEvents", "pilotOperationsEvents", "providerActivationEvents", "campusObservatoryEvents", "siteAdmissionEvents", "authorityTrustEvents", "pilotStartEvents", "clinicalReleaseEvents", "trafficActivationEvents", "identityAccessEvents",
      "timingObservations", "timingEvents", "revisions", "incidentEvents"
    ];
    const counts = Object.fromEntries(countKeys.map(key => [key, Array.isArray(state?.[key]) ? state[key].length : 0]));
    counts.reviews = Object.keys(state?.reviews || {}).length;
    counts.narratives = Object.values(state?.narratives || {}).reduce((sum, audienceSet) => sum + Object.keys(audienceSet || {}).length, 0);
    counts.interpretations = Object.keys(state?.interpretations || {}).length;
    counts.activeGenerations = Object.keys(state?.activeGenerations || {}).length;
    counts.activeDeliveries = Object.keys(state?.activeDeliveries || {}).length;
    counts.pendingComparisons = Object.keys(state?.pendingComparisons || {}).length;
    counts.pendingCandidateBlindReviews = Object.keys(state?.pendingCandidateBlindReviews || {}).length;
    counts.pendingCandidateRetestReviews = Object.keys(state?.pendingCandidateRetestReviews || {}).length;
    counts.pendingTimingTasks = Object.keys(state?.pendingTimingTasks || {}).length;
    counts.auditEntries = Object.values(state?.audit || {}).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
    counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return counts;
  }

  integritySnapshot() {
    return {
      revisions: this.verifyRevisionChain(),
      feedback: this.verifyFeedbackEventChain(),
      incidents: this.verifyIncidentChain(),
      blindOutcomes: this.verifyComparisonChain(),
      reportArtifacts: this.verifyReportArtifactChain(),
      changeControl: this.verifyChangeEventChain(),
      sourceEvents: this.verifySourceEventChain(),
      attachments: this.verifyAttachmentEventChain(),
      providerWorkflow: this.verifyAutomationEventChain(),
      generationSnapshots: this.verifyGenerationEventChain(),
      deliveryOutbox: this.verifyDeliveryChain(),
      workflowTiming: this.verifyTimingEventChain(),
      recoveryEvidence: this.verifyRecoveryEventChain(),
      rollbackEvidence: this.verifyRollbackEventChain(),
      operationalMonitoring: this.verifyMonitoringEventChain(),
      incidentResponse: this.verifyResponseDrillEventChain(),
      pilotReadiness: this.verifyReadinessEventChain(),
      clinicalStandard: this.verifyClinicalStandardEventChain(),
      independentReview: this.verifyIndependentReviewEventChain(),
      integrationReturn: this.verifyIntegrationReturnEventChain(),
      counselorNotebook: this.verifyCounselorNotebookEntryChain(),
      counselorReferences: this.verifyCounselorReferenceDraftChain(),
      counselorReferenceAdjudication: this.verifyCounselorReferenceAdjudicationChain(),
      counselorReferenceDecision: this.verifyCounselorReferenceDecisionChain(),
      independentReviewAdmission: this.verifyIndependentReviewAdmissionChain(),
      progressReview: this.verifyProgressReviewObservationChain(),
      modelTrial: this.verifyModelTrialPreflightChain(),
      candidateTrial: this.verifyCandidateTrialSnapshotChain(),
      candidateReturns: this.verifyCandidateReturnEventChain(),
      candidateBlindReviews: this.verifyCandidateBlindReviewEventChain(),
      candidateRefinementCycles: this.verifyCandidateRefinementCycleChain(),
      candidateRetestReturns: this.verifyCandidateRetestReturnChain(),
      candidateRetestReviews: this.verifyCandidateRetestReviewChain(),
      candidateRetestDisposition: this.verifyCandidateRetestDispositionChain(),
      candidateAdvancement: this.verifyCandidateAdvancementChain(),
      intendedUse: this.verifyIntendedUseEventChain(),
      languageReview: this.verifyLanguageReviewEventChain(),
      decisionExchange: this.verifyDecisionExchangeEventChain(),
      pilotOperations: this.verifyPilotOperationsSnapshotChain(),
      providerActivation: this.verifyProviderActivationSnapshotChain(),
      campusObservatory: this.verifyCampusObservatorySnapshotChain(),
      siteAdmission: this.verifySiteAdmissionEventChain(),
      authorityTrust: this.verifyAuthorityTrustEventChain(),
      pilotStart: this.verifyPilotStartEventChain(),
      clinicalRelease: this.verifyClinicalReleaseEventChain(),
      trafficActivation: this.verifyTrafficActivationEventChain(),
      identityAccess: this.verifyIdentityAccessEventChain()
    };
  }

  appendRecoveryEvent(entry) {
    this.state.recoveryEvents ||= [];
    const previous = this.state.recoveryEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.recoveryEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: RECOVERY_REHEARSAL_CONTRACT,
      type: "isolated-restore-rehearsed",
      ...clone(entry)
    };
    const event = { ...core, hash: digest(core) };
    this.state.recoveryEvents.push(event);
    return event;
  }

  verifyRecoveryEventChain() {
    const events = this.state?.recoveryEvents || [];
    const requiredChecks = [
      "fileHashMatch", "stateDigestMatch", "schemaMatch", "recordCountsMatch",
      "ledgerEvidenceMatch", "allLedgersValid", "sourceFileOwnerOnly",
      "restoredFileOwnerOnly", "isolationDirectoryOwnerOnly", "isolatedCopyRemoved"
    ];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const checks = core.verification || {};
      const checksValid = requiredChecks.every(key => typeof checks[key] === "boolean")
        && Object.keys(checks).length === requiredChecks.length;
      const countValues = Object.values(core.recordCounts || {});
      const countsValid = countValues.length > 0
        && countValues.every(value => Number.isInteger(value) && value >= 0)
        && core.recordCounts?.total === core.reconciledRecords
        && digest(core.recordCounts) === core.recordCountsHash;
      const hashPairValid = /^[a-f0-9]{64}$/.test(core.sourceFileHash || "")
        && /^[a-f0-9]{64}$/.test(core.sourceStateDigest || "")
        && (core.status === "verified"
          ? core.restoredFileHash === core.sourceFileHash && core.restoredStateDigest === core.sourceStateDigest
          : core.restoredFileHash === null || /^[a-f0-9]{64}$/.test(core.restoredFileHash || ""))
        && (core.status === "verified" || core.restoredStateDigest === null || /^[a-f0-9]{64}$/.test(core.restoredStateDigest || ""));
      const verified = requiredChecks.every(key => checks[key] === true);
      const statusValid = core.status === "verified"
        ? verified && core.errorCode === null
        : core.status === "failed" && !verified && /^[A-Z][A-Z0-9_]{2,63}$/.test(core.errorCode || "");
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === RECOVERY_REHEARSAL_CONTRACT
        && core.type === "isolated-restore-rehearsed"
        && core.mode === "ephemeral-isolated-copy"
        && core.productionRecoveryClaimed === false
        && core.rpoConfigured === false
        && core.rtoConfigured === false
        && Number.isInteger(core.sourceSchemaVersion)
        && core.sourceSchemaVersion >= 16
        && Number.isInteger(core.ledgerCount)
        && core.ledgerCount >= 1
        && /^[a-f0-9]{64}$/.test(core.ledgerEvidenceHash || "")
        && /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(core.actor || "")
        && Number.isFinite(Date.parse(core.startedAt))
        && Number.isFinite(Date.parse(core.completedAt))
        && Number.isInteger(core.durationMs)
        && core.durationMs >= 0
        && checksValid
        && countsValid
        && hashPairValid
        && statusValid
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, verified: events.filter(item => item.status === "verified").length, failed: events.filter(item => item.status === "failed").length };
      previousHash = hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      verified: events.filter(item => item.status === "verified").length,
      failed: events.filter(item => item.status === "failed").length
    };
  }

  createRecoveryStore(filePath) {
    return new SandboxStore({
      filePath,
      seedAssessments: this.seedAssessments,
      auditSeed: this.auditSeed,
      calibrationReferences: this.calibrationReferences,
      calibrationManifest: this.calibrationManifest,
      modelProvider: this.modelProvider,
      deliveryConnector: this.deliveryConnector,
      rollbackManifest: this.rollbackManifest,
      counselorReferenceDecisionRegistry: this.counselorReferenceDecisionRegistry,
      independentReviewAdmissionRegistry: this.independentReviewAdmissionRegistry,
      clock: this.clock
    });
  }

  async recoveryStatus() {
    await this.init();
    const lastEvent = this.state.recoveryEvents.at(-1) || null;
    return {
      contractVersion: RECOVERY_REHEARSAL_CONTRACT,
      status: lastEvent?.status || "not-run",
      mode: "ephemeral-isolated-copy",
      productionRecoveryClaimed: false,
      rpo: { configured: false, status: "decision-required" },
      rto: { configured: false, status: "decision-required" },
      boundary: RECOVERY_REHEARSAL_BOUNDARY,
      current: { schemaVersion: this.state.schemaVersion, recordCounts: this.recordCounts() },
      lastEvent: lastEvent ? clone(lastEvent) : null,
      chain: this.verifyRecoveryEventChain()
    };
  }

  async rehearseRecovery(actor = "Demo reviewer") {
    await this.init();
    if (this.recoveryInFlight) fail("A recovery rehearsal is already in progress.", 409);
    this.recoveryInFlight = true;
    const startedAt = this.clock().toISOString();
    const monotonicStart = Date.now();
    let temporaryDirectory = null;
    let sourceBytes = Buffer.from(JSON.stringify(this.state));
    let sourceState = clone(this.state);
    let sourceFileHash = digestBytes(sourceBytes);
    let sourceStateDigest = digest(sourceState);
    let restoredFileHash = null;
    let restoredStateDigest = null;
    let recordCounts = this.recordCounts(sourceState);
    let ledgerEvidenceHash = digest(this.integritySnapshot());
    let ledgerCount = Object.keys(this.integritySnapshot()).length;
    let errorCode = null;
    const verification = {
      fileHashMatch: false,
      stateDigestMatch: false,
      schemaMatch: false,
      recordCountsMatch: false,
      ledgerEvidenceMatch: false,
      allLedgersValid: false,
      sourceFileOwnerOnly: false,
      restoredFileOwnerOnly: false,
      isolationDirectoryOwnerOnly: false,
      isolatedCopyRemoved: false
    };
    try {
      await this.writeChain;
      sourceBytes = await readFile(this.filePath);
      sourceState = JSON.parse(sourceBytes.toString("utf8"));
      sourceFileHash = digestBytes(sourceBytes);
      sourceStateDigest = digest(sourceState);
      recordCounts = this.recordCounts(sourceState);
      const sourceIntegrity = this.integritySnapshot();
      ledgerEvidenceHash = digest(sourceIntegrity);
      ledgerCount = Object.keys(sourceIntegrity).length;
      verification.sourceFileOwnerOnly = ((await stat(this.filePath)).mode & 0o077) === 0;

      temporaryDirectory = await mkdtemp(join(tmpdir(), "perl-recovery-"));
      verification.isolationDirectoryOwnerOnly = ((await stat(temporaryDirectory)).mode & 0o077) === 0;
      const restoredPath = join(temporaryDirectory, "restored-sandbox-state.json");
      await writeFile(restoredPath, sourceBytes, { mode: 0o600 });
      const restoredStore = this.createRecoveryStore(restoredPath);
      await restoredStore.init();
      const restoredBytes = await readFile(restoredPath);
      const restoredIntegrity = restoredStore.integritySnapshot();
      restoredFileHash = digestBytes(restoredBytes);
      restoredStateDigest = digest(restoredStore.state);
      verification.fileHashMatch = restoredFileHash === sourceFileHash;
      verification.stateDigestMatch = restoredStateDigest === sourceStateDigest;
      verification.schemaMatch = restoredStore.state.schemaVersion === sourceState.schemaVersion;
      verification.recordCountsMatch = JSON.stringify(restoredStore.recordCounts()) === JSON.stringify(recordCounts);
      verification.ledgerEvidenceMatch = digest(restoredIntegrity) === ledgerEvidenceHash;
      verification.allLedgersValid = Object.values(restoredIntegrity).every(chain => chain.valid === true);
      verification.restoredFileOwnerOnly = ((await stat(restoredPath)).mode & 0o077) === 0;
      if (![verification.fileHashMatch, verification.stateDigestMatch, verification.schemaMatch, verification.recordCountsMatch, verification.ledgerEvidenceMatch, verification.allLedgersValid, verification.sourceFileOwnerOnly, verification.restoredFileOwnerOnly, verification.isolationDirectoryOwnerOnly].every(Boolean)) {
        errorCode = "RECOVERY_RECONCILIATION_FAILED";
      }
    } catch (error) {
      errorCode = /integrity check failed/i.test(String(error?.message || ""))
        ? "RESTORE_INTEGRITY_REJECTED"
        : "RECOVERY_REHEARSAL_FAILED";
    } finally {
      if (temporaryDirectory) {
        try {
          await rm(temporaryDirectory, { recursive: true, force: true });
          try {
            await stat(temporaryDirectory);
          } catch (error) {
            verification.isolatedCopyRemoved = error?.code === "ENOENT";
          }
        } catch {
          verification.isolatedCopyRemoved = false;
        }
      }
      if (!verification.isolatedCopyRemoved) errorCode = "ISOLATION_CLEANUP_FAILED";
      this.recoveryInFlight = false;
    }
    const verified = Object.values(verification).every(Boolean);
    const status = verified ? "verified" : "failed";
    const event = this.appendRecoveryEvent({
      status,
      mode: "ephemeral-isolated-copy",
      productionRecoveryClaimed: false,
      rpoConfigured: false,
      rtoConfigured: false,
      sourceSchemaVersion: sourceState.schemaVersion,
      sourceFileHash,
      restoredFileHash,
      sourceStateDigest,
      restoredStateDigest,
      recordCounts,
      recordCountsHash: digest(recordCounts),
      reconciledRecords: recordCounts.total,
      ledgerCount,
      ledgerEvidenceHash,
      verification,
      errorCode: verified ? null : (errorCode || "RECOVERY_REHEARSAL_FAILED"),
      actor,
      startedAt,
      completedAt: this.clock().toISOString(),
      durationMs: Math.max(0, Date.now() - monotonicStart),
      note: verified
        ? "The current synthetic state reopened in an isolated environment with exact record counts, valid evidence chains, owner-only permissions, and confirmed cleanup."
        : "The isolated restore rehearsal failed closed; no production recovery capability is claimed."
    });
    await this.persist();
    return { ...(await this.recoveryStatus()), event: clone(event) };
  }

  appendRollbackEvent(entry) {
    this.state.rollbackEvents ||= [];
    const previous = this.state.rollbackEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.rollbackEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: ROLLBACK_REHEARSAL_CONTRACT,
      type: "local-lkg-compatibility-rehearsed",
      ...clone(entry)
    };
    const event = { ...core, hash: digest(core) };
    this.state.rollbackEvents.push(event);
    return event;
  }

  verifyRollbackEventChain() {
    const events = this.state?.rollbackEvents || [];
    const requiredChecks = [
      "manifestValid", "runtimeVersionsMatch", "policyMatch", "caseSetMatch",
      "sourceFilesMatch", "stateSchemaCompatible", "generationSnapshotsValid",
      "reportArtifactsValid", "syntheticRegressionPassed", "recoveryPrerequisiteVerified",
      "studySafetyActive"
    ];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const checks = core.verification || {};
      const checksValid = requiredChecks.every(key => typeof checks[key] === "boolean")
        && Object.keys(checks).length === requiredChecks.length;
      const files = Array.isArray(core.sourceFiles) ? core.sourceFiles : [];
      const filePaths = new Set();
      const filesValid = files.length === core.sourceFileCount && files.every(file => {
        const valid = typeof file.path === "string"
          && !file.path.includes("..")
          && /^[a-f0-9]{64}$/.test(file.expectedHash || "")
          && (file.actualHash === null || /^[a-f0-9]{64}$/.test(file.actualHash || ""))
          && typeof file.match === "boolean"
          && !filePaths.has(file.path);
        filePaths.add(file.path);
        return valid;
      });
      const allChecks = requiredChecks.every(key => checks[key] === true);
      const statusValid = core.status === "verified-local-compatibility"
        ? allChecks && files.every(file => file.match) && core.errorCode === null && /^[a-f0-9]{64}$/.test(core.regressionEvidenceHash || "") && /^[a-f0-9]{64}$/.test(core.recoveryEvidenceHash || "")
        : core.status === "failed" && !allChecks && /^[A-Z][A-Z0-9_]{2,63}$/.test(core.errorCode || "") && (core.regressionEvidenceHash === null || /^[a-f0-9]{64}$/.test(core.regressionEvidenceHash || "")) && (core.recoveryEvidenceHash === null || /^[a-f0-9]{64}$/.test(core.recoveryEvidenceHash || ""));
      const versions = Object.values(core.observedVersions || {});
      const expectedVersions = Object.values(core.expectedVersions || {});
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === ROLLBACK_REHEARSAL_CONTRACT
        && core.type === "local-lkg-compatibility-rehearsed"
        && /^perl-local-lkg-\d{4}-\d{2}-\d{2}$/.test(core.baselineId || "")
        && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(core.baselineVersion || "")
        && /^[a-f0-9]{64}$/.test(core.manifestHash || "")
        && versions.length === 5
        && expectedVersions.length === 5
        && versions.every(value => typeof value === "string" && value.length >= 2)
        && expectedVersions.every(value => typeof value === "string" && value.length >= 2)
        && /^[a-f0-9]{64}$/.test(core.observedPolicyHash || "")
        && /^[a-f0-9]{64}$/.test(core.expectedPolicyHash || "")
        && Number.isInteger(core.sourceFileCount)
        && core.sourceFileCount >= 10
        && filesValid
        && checksValid
        && statusValid
        && core.artifactRepository === "working-tree-only"
        && core.deployableArtifactRestored === false
        && core.productionRollbackPerformed === false
        && core.clinicalValidation === false
        && core.clinicalReleaseAuthorized === false
        && /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(core.actor || "")
        && Number.isFinite(Date.parse(core.startedAt))
        && Number.isFinite(Date.parse(core.completedAt))
        && Number.isInteger(core.durationMs)
        && core.durationMs >= 0
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, verified: events.filter(item => item.status === "verified-local-compatibility").length, failed: events.filter(item => item.status === "failed").length };
      previousHash = hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      verified: events.filter(item => item.status === "verified-local-compatibility").length,
      failed: events.filter(item => item.status === "failed").length
    };
  }

  async readRollbackFile(path) {
    if (typeof path !== "string" || path.includes("..")) fail("Unsafe rollback-manifest path.", 500);
    return readFile(new URL(`../${path}`, import.meta.url));
  }

  async rollbackStatus() {
    await this.init();
    const lastEvent = this.state.rollbackEvents.at(-1) || null;
    return {
      contractVersion: ROLLBACK_REHEARSAL_CONTRACT,
      status: lastEvent?.status || "not-run",
      productionRollbackPerformed: false,
      deployableArtifactRestored: false,
      clinicalReleaseAuthorized: false,
      boundary: ROLLBACK_REHEARSAL_BOUNDARY,
      baseline: {
        id: this.rollbackManifest.id,
        version: this.rollbackManifest.version,
        manifestHash: rollbackManifestHash(this.rollbackManifest),
        artifactRepository: this.rollbackManifest.artifactRepository,
        deployableArtifactAvailable: this.rollbackManifest.deployableArtifactAvailable,
        sourceFileCount: this.rollbackManifest.sourceFiles?.length || 0
      },
      current: { runtimeVersions: this.loadedRuntimeVersions(), stateSchemaVersion: this.state.schemaVersion },
      lastEvent: lastEvent ? clone(lastEvent) : null,
      chain: this.verifyRollbackEventChain()
    };
  }

  async rehearseRollbackCompatibility(actor = "Demo reviewer") {
    await this.init();
    if (this.rollbackInFlight) fail("An application rollback rehearsal is already in progress.", 409);
    this.rollbackInFlight = true;
    const startedAt = this.clock().toISOString();
    const monotonicStart = Date.now();
    const expectedVersions = clone(this.rollbackManifest.expectedVersions || {});
    const observedVersions = this.loadedRuntimeVersions();
    const descriptor = this.providerDescriptor();
    const sourceFiles = [];
    let regressionEvidenceHash = null;
    let recoveryEvidenceHash = this.state.recoveryEvents.at(-1)?.hash || null;
    let errorCode = null;
    const verification = {
      manifestValid: false,
      runtimeVersionsMatch: false,
      policyMatch: false,
      caseSetMatch: false,
      sourceFilesMatch: false,
      stateSchemaCompatible: false,
      generationSnapshotsValid: false,
      reportArtifactsValid: false,
      syntheticRegressionPassed: false,
      recoveryPrerequisiteVerified: false,
      studySafetyActive: false
    };
    try {
      verification.manifestValid = validateRollbackManifest(this.rollbackManifest).length === 0;
      verification.runtimeVersionsMatch = JSON.stringify(observedVersions) === JSON.stringify(expectedVersions);
      verification.policyMatch = descriptor.policyHash === this.rollbackManifest.expectedPolicyHash;
      verification.caseSetMatch = this.calibrationManifest.id === this.rollbackManifest.caseSet?.id
        && this.calibrationManifest.version === this.rollbackManifest.caseSet?.version;
      verification.stateSchemaCompatible = observedVersions["state-schema"] === `sandbox-state/${this.state.schemaVersion}`
        && observedVersions["state-schema"] === expectedVersions["state-schema"];
      for (const file of this.rollbackManifest.sourceFiles || []) {
        try {
          const actualHash = digestBytes(await this.readRollbackFile(file.path));
          sourceFiles.push({ path: file.path, expectedHash: file.expectedHash, actualHash, match: actualHash === file.expectedHash });
        } catch {
          sourceFiles.push({ path: file.path, expectedHash: file.expectedHash, actualHash: null, match: false });
        }
      }
      verification.sourceFilesMatch = sourceFiles.length === (this.rollbackManifest.sourceFiles?.length || 0)
        && sourceFiles.length >= 10
        && sourceFiles.every(file => file.match);
      verification.generationSnapshotsValid = this.verifyGenerationEventChain().valid;
      const reportChain = this.verifyReportArtifactChain();
      verification.reportArtifactsValid = reportChain.valid && (this.state.reportArtifacts || []).every(artifact => {
        const contentValid = validateReportContent(artifact.narrative, artifact.interpretation).length === 0;
        const rendered = renderReportPage({ mode: artifact.type === "approved" ? "approved" : "draft", artifact });
        return contentValid
          && artifact.reportFormat === REPORT_CONTRACT.format
          && artifact.disclaimerVersion === REPORT_CONTRACT.disclaimerVersion
          && rendered.includes(REPORT_CONTRACT.disclaimerVersion);
      });
      const regression = await evaluateReleaseEvidence({
        assessments: this.state.assessments,
        references: this.calibrationReferences,
        manifest: this.calibrationManifest,
        modelProvider: this.modelProvider,
        clock: this.clock
      });
      regressionEvidenceHash = digest(regression);
      verification.syntheticRegressionPassed = regression.engineeringRegressionPassed === true;
      const recoveryChain = this.verifyRecoveryEventChain();
      verification.recoveryPrerequisiteVerified = recoveryChain.valid
        && this.state.recoveryEvents.at(-1)?.status === "verified"
        && this.state.recoveryEvents.at(-1)?.sourceSchemaVersion === this.state.schemaVersion;
      verification.studySafetyActive = this.studyControl().state === "active";
      if (!Object.values(verification).every(Boolean)) errorCode = "ROLLBACK_COMPATIBILITY_FAILED";
    } catch {
      errorCode = "ROLLBACK_REHEARSAL_FAILED";
    } finally {
      this.rollbackInFlight = false;
    }
    const verified = Object.values(verification).every(Boolean);
    const status = verified ? "verified-local-compatibility" : "failed";
    const event = this.appendRollbackEvent({
      status,
      baselineId: this.rollbackManifest.id,
      baselineVersion: this.rollbackManifest.version,
      manifestHash: rollbackManifestHash(this.rollbackManifest),
      artifactRepository: "working-tree-only",
      expectedVersions,
      observedVersions,
      expectedPolicyHash: this.rollbackManifest.expectedPolicyHash,
      observedPolicyHash: descriptor.policyHash,
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version, manifestHash: digest(this.calibrationManifest) },
      sourceFileCount: sourceFiles.length,
      sourceFiles,
      regressionEvidenceHash,
      recoveryEvidenceHash,
      verification,
      deployableArtifactRestored: false,
      productionRollbackPerformed: false,
      clinicalValidation: false,
      clinicalReleaseAuthorized: false,
      errorCode: verified ? null : (errorCode || "ROLLBACK_REHEARSAL_FAILED"),
      actor,
      startedAt,
      completedAt: this.clock().toISOString(),
      durationMs: Math.max(0, Date.now() - monotonicStart),
      note: verified
        ? "The sealed local engineering baseline matches the running versions and source fingerprints, remains state/report/generation compatible, passes the frozen safety regression, and has verified restore evidence."
        : "The local compatibility rehearsal failed closed; no application rollback, deployable artifact restoration, or clinical release is claimed."
    });
    await this.persist();
    return { ...(await this.rollbackStatus()), event: clone(event) };
  }

  appendMonitoringEvent(entry) {
    this.state.monitoringEvents ||= [];
    const previous = this.state.monitoringEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.monitoringEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: OPERATIONAL_MONITORING_CONTRACT,
      type: "point-in-time-control-probe",
      ...clone(entry)
    };
    const event = { ...core, hash: digest(core) };
    this.state.monitoringEvents.push(event);
    return event;
  }

  verifyMonitoringEventChain() {
    const events = this.state?.monitoringEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const localSignals = Array.isArray(core.signals) ? core.signals.filter(signal => signal.scope === "local") : [];
      const expectedStatus = localSignals.some(signal => signal.status === "fail")
        ? "local-control-failure"
        : localSignals.some(signal => signal.status !== "pass")
          ? "local-attention-required"
          : "local-controls-clear";
      const signalCounts = core.signalCounts || {};
      const countsValid = ["pass", "attention", "unavailable", "fail"].every(status => Number.isInteger(signalCounts[status]) && signalCounts[status] >= 0)
        && Object.values(signalCounts).reduce((sum, count) => sum + count, 0) === OPERATIONAL_SIGNALS.length;
      const alerts = Array.isArray(core.localAlerts) ? core.localAlerts : [];
      const expectedAlerts = localSignals.filter(signal => signal.status !== "pass");
      const alertsValid = alerts.length === expectedAlerts.length && alerts.every((alert, alertIndex) => {
        const source = expectedAlerts[alertIndex];
        return alert.signalId === source?.id
          && alert.severity === source?.severity
          && alert.state === "open-local-evidence"
          && alert.externalNotificationSent === false;
      });
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === OPERATIONAL_MONITORING_CONTRACT
        && core.type === "point-in-time-control-probe"
        && core.status === expectedStatus
        && core.scope === "local-synthetic-point-in-time"
        && core.continuousMonitoringClaimed === false
        && core.productionAlertingConnected === false
        && core.availabilitySlaClaimed === false
        && core.latencySloClaimed === false
        && core.productionBackupMonitoring === false
        && core.securityMonitoringConnected === false
        && core.externalNotificationsSent === false
        && core.probeBudgetMs === LOCAL_PROBE_BUDGET_MS
        && Number.isInteger(core.probeDurationMs)
        && core.probeDurationMs >= 0
        && validateOperationalSignalSet(core.signals)
        && countsValid
        && alertsValid
        && JSON.stringify(core.productionGaps) === JSON.stringify(PRODUCTION_MONITORING_GAPS)
        && /^[a-f0-9]{64}$/.test(core.operationalStateHash || "")
        && /^[a-f0-9]{64}$/.test(core.integrityEvidenceHash || "")
        && /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(core.actor || "")
        && Number.isFinite(Date.parse(core.startedAt))
        && Number.isFinite(Date.parse(core.completedAt))
        && Number.isInteger(core.durationMs)
        && core.durationMs >= 0
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, clear: events.filter(item => item.status === "local-controls-clear").length, attention: events.filter(item => item.status === "local-attention-required").length, failed: events.filter(item => item.status === "local-control-failure").length };
      previousHash = hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      clear: events.filter(item => item.status === "local-controls-clear").length,
      attention: events.filter(item => item.status === "local-attention-required").length,
      failed: events.filter(item => item.status === "local-control-failure").length
    };
  }

  collectOperationalSignals() {
    const monotonicStart = Date.now();
    const generation = this.verifyGenerationEventChain();
    const delivery = this.verifyDeliveryChain();
    const integrity = this.integritySnapshot();
    const study = this.studyControl();
    const deliveryStates = (this.state.deliveryJobs || []).map(job => this.deliveryStateFor(job));
    const deadLetters = deliveryStates.filter(item => item.status === "dead-lettered").length;
    const retrying = deliveryStates.filter(item => ["retry-wait", "in-flight"].includes(item.status)).length;
    const recovery = this.verifyRecoveryEventChain();
    const rollback = this.verifyRollbackEventChain();
    const recoveryReady = recovery.valid
      && this.state.recoveryEvents.at(-1)?.status === "verified"
      && this.state.recoveryEvents.at(-1)?.sourceSchemaVersion === this.state.schemaVersion;
    const rollbackReady = rollback.valid
      && this.state.rollbackEvents.at(-1)?.status === "verified-local-compatibility"
      && this.state.rollbackEvents.at(-1)?.observedVersions?.["state-schema"] === `sandbox-state/${this.state.schemaVersion}`
      && this.state.rollbackEvents.at(-1)?.manifestHash === rollbackManifestHash(this.rollbackManifest);
    const integrityValid = Object.values(integrity).every(chain => chain.valid === true);
    const baseSignals = [
      {
        id: "availability", label: "Availability", scope: "local", requiredByLaunchPlan: true,
        status: this.state.environment === "synthetic-sandbox" && this.state.schemaVersion === 49 ? "pass" : "fail",
        severity: this.state.environment === "synthetic-sandbox" && this.state.schemaVersion === 49 ? "info" : "critical",
        detail: "Local store opened through the ordinary schema and integrity checks.",
        evidenceHash: digest({ environment: this.state.environment, schemaVersion: this.state.schemaVersion })
      },
      {
        id: "generation-failure", label: "Generation", scope: "local", requiredByLaunchPlan: true,
        status: generation.valid && generation.active === this.state.assessments.length ? "pass" : "fail",
        severity: generation.valid && generation.active === this.state.assessments.length ? "info" : "critical",
        detail: generation.valid ? `${generation.active} active generation snapshots have intact lineage.` : "Generation snapshot lineage failed verification.",
        evidenceHash: generation.head || digest(generation)
      },
      {
        id: "safety-routing", label: "Safety routing", scope: "local", requiredByLaunchPlan: true,
        status: study.state === "active" ? "pass" : "attention",
        severity: study.state === "active" ? "info" : "critical",
        detail: study.state === "active" ? "No unresolved high-severity stopping event is recorded." : `${study.highSeverityOpen} stopping safety event${study.highSeverityOpen === 1 ? " is" : "s are"} open.`,
        evidenceHash: digest({ study, incidentHead: this.verifyIncidentChain().head || "GENESIS" })
      },
      {
        id: "delivery-queue", label: "Delivery queue", scope: "local", requiredByLaunchPlan: false,
        status: !delivery.valid ? "fail" : deadLetters || retrying ? "attention" : "pass",
        severity: !delivery.valid ? "critical" : deadLetters ? "high" : retrying ? "warning" : "info",
        detail: !delivery.valid ? "Delivery-outbox lineage failed verification." : deadLetters ? `${deadLetters} package${deadLetters === 1 ? " is" : "s are"} dead-lettered for operator review.` : retrying ? `${retrying} package${retrying === 1 ? " requires" : "s require"} retry or uncertain-outcome review.` : "The durable local delivery queue has no failed package.",
        evidenceHash: delivery.head || digest(delivery)
      },
      {
        id: "artifact-integrity", label: "Artifact integrity", scope: "local", requiredByLaunchPlan: true,
        status: integrityValid ? "pass" : "fail",
        severity: integrityValid ? "info" : "critical",
        detail: integrityValid ? `${Object.keys(integrity).length} evidence families passed integrity verification.` : "One or more local evidence families failed integrity verification.",
        evidenceHash: digest(integrity)
      },
      {
        id: "restore-readiness", label: "Restore evidence", scope: "local", requiredByLaunchPlan: false,
        status: recoveryReady ? "pass" : "attention",
        severity: recoveryReady ? "info" : "high",
        detail: recoveryReady ? "The latest isolated local restore evidence is verified." : "No current verified isolated restore evidence is available.",
        evidenceHash: recovery.head || digest(recovery)
      },
      {
        id: "rollback-readiness", label: "Rollback evidence", scope: "local", requiredByLaunchPlan: false,
        status: rollbackReady ? "pass" : "attention",
        severity: rollbackReady ? "info" : "high",
        detail: rollbackReady ? "The latest local compatibility rehearsal is verified." : "No current verified local compatibility evidence is available.",
        evidenceHash: rollback.head || digest(rollback)
      },
      {
        id: "unauthorized-access", label: "Access alerts", scope: "production-gap", requiredByLaunchPlan: true,
        status: "unavailable", severity: "critical",
        detail: "No production identity provider, access-event stream, or security alert route is connected.", evidenceHash: null
      },
      {
        id: "backup-job", label: "Backup jobs", scope: "production-gap", requiredByLaunchPlan: true,
        status: "unavailable", severity: "critical",
        detail: "No encrypted production backup job, retention monitor, or failure alert is connected.", evidenceHash: null
      },
      {
        id: "external-notification-delivery", label: "Notifications", scope: "production-gap", requiredByLaunchPlan: false,
        status: "unavailable", severity: "high",
        detail: "No production paging, email, ticket, or escalation notification channel is connected.", evidenceHash: null
      }
    ];
    const probeDurationMs = Math.max(0, Date.now() - monotonicStart);
    const latencyPassed = probeDurationMs <= LOCAL_PROBE_BUDGET_MS;
    const latencySignal = {
      id: "latency", label: "Latency", scope: "local", requiredByLaunchPlan: true,
      status: latencyPassed ? "pass" : "attention",
      severity: latencyPassed ? "info" : "warning",
      detail: `Point-in-time local control probe completed in ${probeDurationMs} ms; no service-level objective is claimed.`,
      evidenceHash: digest({ probeDurationMs, probeBudgetMs: LOCAL_PROBE_BUDGET_MS })
    };
    const signals = [baseSignals[0], latencySignal, ...baseSignals.slice(1)];
    const signalCounts = Object.fromEntries(["pass", "attention", "unavailable", "fail"].map(status => [status, signals.filter(signal => signal.status === status).length]));
    const localAlerts = signals.filter(signal => signal.scope === "local" && signal.status !== "pass").map(signal => ({
      signalId: signal.id,
      severity: signal.severity,
      state: "open-local-evidence",
      externalNotificationSent: false
    }));
    const localSignals = signals.filter(signal => signal.scope === "local");
    const status = localSignals.some(signal => signal.status === "fail")
      ? "local-control-failure"
      : localSignals.some(signal => signal.status !== "pass")
        ? "local-attention-required"
        : "local-controls-clear";
    return {
      status,
      scope: "local-synthetic-point-in-time",
      continuousMonitoringClaimed: false,
      productionAlertingConnected: false,
      availabilitySlaClaimed: false,
      latencySloClaimed: false,
      productionBackupMonitoring: false,
      securityMonitoringConnected: false,
      externalNotificationsSent: false,
      probeBudgetMs: LOCAL_PROBE_BUDGET_MS,
      probeDurationMs,
      signals,
      signalCounts,
      localAlerts,
      productionGaps: clone(PRODUCTION_MONITORING_GAPS),
      operationalStateHash: digest({ schemaVersion: this.state.schemaVersion, records: this.recordCounts(), study, delivery, generation, signals }),
      integrityEvidenceHash: digest(integrity)
    };
  }

  async operationalMonitoringStatus() {
    await this.init();
    const current = this.collectOperationalSignals();
    const lastEvent = this.state.monitoringEvents.at(-1) || null;
    return {
      contractVersion: OPERATIONAL_MONITORING_CONTRACT,
      status: current.status,
      boundary: OPERATIONAL_MONITORING_BOUNDARY,
      current,
      lastEvent: lastEvent ? clone(lastEvent) : null,
      chain: this.verifyMonitoringEventChain()
    };
  }

  async recordOperationalMonitoringSnapshot(actor = "Demo reviewer") {
    await this.init();
    if (this.monitoringInFlight) fail("An operational control probe is already in progress.", 409);
    this.monitoringInFlight = true;
    const startedAt = this.clock().toISOString();
    const monotonicStart = Date.now();
    let snapshot;
    try {
      snapshot = this.collectOperationalSignals();
    } finally {
      this.monitoringInFlight = false;
    }
    const event = this.appendMonitoringEvent({
      ...snapshot,
      actor,
      startedAt,
      completedAt: this.clock().toISOString(),
      durationMs: Math.max(0, Date.now() - monotonicStart),
      note: snapshot.status === "local-controls-clear"
        ? "The local synthetic control matrix is clear at this point in time; production monitoring and alert delivery remain unconnected."
        : "The point-in-time local probe recorded one or more controls requiring attention; production monitoring and alert delivery remain unconnected."
    });
    await this.persist();
    return { ...(await this.operationalMonitoringStatus()), event: clone(event) };
  }

  responsePhases(scenario, severity, evidence) {
    const details = {
      classify: `${scenario.severity} is mapped to an ${severity.responseTarget.toLowerCase()} response target from the frozen severity model.`,
      contain: `${scenario.stopAction} Production stop authority remains unassigned.`,
      preserve: `Preserve ${scenario.evidenceSources.join(", ")} and link current monitoring, recovery, rollback, and integrity evidence.`,
      restart: `${scenario.restartCriteria.length} restart criteria are evaluated in the tabletop; production acceptance and authorization remain absent.`
    };
    return RESPONSE_PHASES.map(phase => {
      const detail = details[phase.id];
      return {
        id: phase.id,
        label: phase.label,
        result: "verified-design",
        detail,
        evidenceHash: digest({ phase: phase.id, scenarioId: scenario.id, detail, ...evidence })
      };
    });
  }

  responseNotificationTree(scenario) {
    const owners = new Map(INCIDENT_OWNER_TREE.map(owner => [owner.id, owner]));
    return scenario.notificationRoles.map(roleId => ({
      roleId,
      label: owners.get(roleId).label,
      ownerState: "unassigned-production-owner",
      externalNotificationSent: false
    }));
  }

  responseRestartCriteria(scenario) {
    return scenario.restartCriteria.map(criterion => ({
      criterion,
      tabletopEvaluated: true,
      productionEvidencePresent: false
    }));
  }

  appendResponseDrillEvent(entry) {
    this.state.responseDrillEvents ||= [];
    const previous = this.state.responseDrillEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.responseDrillEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: INCIDENT_RESPONSE_CONTRACT,
      type: "tabletop-response-rehearsed",
      ...clone(entry)
    };
    const event = { ...core, hash: digest(core) };
    this.state.responseDrillEvents.push(event);
    return event;
  }

  verifyResponseDrillEventChain() {
    const events = this.state?.responseDrillEvents || [];
    const verificationKeys = [
      "scenarioRecognized", "severityMapped", "stopRuleDefined", "evidencePlanBounded",
      "notificationTreeDefined", "restartCriteriaDefined", "currentMonitoringLinked",
      "currentRecoveryLinked", "currentRollbackLinked", "studySafetyControlPresent"
    ];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const scenario = incidentResponseScenario(core.scenarioId);
      const severity = scenario ? incidentSeverity(scenario.severity) : null;
      const evidence = {
        monitoringEvidenceHash: core.monitoringEvidenceHash,
        recoveryEvidenceHash: core.recoveryEvidenceHash,
        rollbackEvidenceHash: core.rollbackEvidenceHash,
        integrityEvidenceHash: core.integrityEvidenceHash
      };
      const expectedPhases = scenario && severity ? this.responsePhases(scenario, severity, evidence) : [];
      const expectedTree = scenario ? this.responseNotificationTree(scenario) : [];
      const expectedRestart = scenario ? this.responseRestartCriteria(scenario) : [];
      const verification = core.verification || {};
      const evidenceHashesValid = Object.values(evidence).every(value => /^[a-f0-9]{64}$/.test(value || ""));
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === INCIDENT_RESPONSE_CONTRACT
        && core.type === "tabletop-response-rehearsed"
        && core.status === "tabletop-complete"
        && core.scope === "local-synthetic-tabletop"
        && scenario
        && severity
        && core.scenarioTitle === scenario.title
        && core.scenarioHash === digest(scenario)
        && core.severity === scenario.severity
        && core.responseTarget === severity.responseTarget
        && core.stopAuthorityRole === scenario.stopAuthorityRole
        && core.stopAction === scenario.stopAction
        && core.stopAuthorityAssigned === false
        && core.ownerAssignmentsComplete === false
        && core.notificationTreeConnected === false
        && core.externalNotificationsSent === false
        && core.productionIncidentDeclared === false
        && core.productionServiceStopped === false
        && core.productionContainmentClaimed === false
        && core.clinicalRestartAuthorized === false
        && core.clinicalReleaseAuthorized === false
        && core.localControlSimulation === true
        && JSON.stringify(core.phases) === JSON.stringify(expectedPhases)
        && JSON.stringify(core.notificationTree) === JSON.stringify(expectedTree)
        && JSON.stringify(core.evidenceSources) === JSON.stringify(scenario.evidenceSources)
        && JSON.stringify(core.restartCriteria) === JSON.stringify(expectedRestart)
        && verificationKeys.every(key => verification[key] === true)
        && Object.keys(verification).length === verificationKeys.length
        && evidenceHashesValid
        && (core.incidentChainHead === "GENESIS" || /^[a-f0-9]{64}$/.test(core.incidentChainHead || ""))
        && /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(core.actor || "")
        && Number.isFinite(Date.parse(core.startedAt))
        && Number.isFinite(Date.parse(core.completedAt))
        && Number.isInteger(core.durationMs)
        && core.durationMs >= 0
        && typeof core.note === "string"
        && core.note.length >= 1
        && core.note.length <= 420
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, completed: events.filter(item => item.status === "tabletop-complete").length };
      previousHash = hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, completed: events.filter(item => item.status === "tabletop-complete").length };
  }

  responsePrerequisites() {
    const monitoring = this.verifyMonitoringEventChain();
    const recovery = this.verifyRecoveryEventChain();
    const rollback = this.verifyRollbackEventChain();
    const monitoringEvent = this.state.monitoringEvents.at(-1) || null;
    const recoveryEvent = this.state.recoveryEvents.at(-1) || null;
    const rollbackEvent = this.state.rollbackEvents.at(-1) || null;
    const monitoringSchemaCurrent = monitoringEvent?.signals?.find(signal => signal.id === "availability")?.evidenceHash
      === digest({ environment: this.state.environment, schemaVersion: this.state.schemaVersion });
    return [
      {
        id: "monitoring", label: "Control probe", status: monitoring.valid && monitoringEvent?.status === "local-controls-clear" && monitoringSchemaCurrent ? "ready" : "required",
        evidenceHash: monitoringEvent?.hash || null
      },
      {
        id: "recovery", label: "Current restore", status: recovery.valid && recoveryEvent?.status === "verified" && recoveryEvent.sourceSchemaVersion === this.state.schemaVersion ? "ready" : "required",
        evidenceHash: recoveryEvent?.hash || null
      },
      {
        id: "rollback", label: "Sealed baseline", status: rollback.valid && rollbackEvent?.status === "verified-local-compatibility" && rollbackEvent.observedVersions?.["state-schema"] === `sandbox-state/${this.state.schemaVersion}` && rollbackEvent.manifestHash === rollbackManifestHash(this.rollbackManifest) ? "ready" : "required",
        evidenceHash: rollbackEvent?.hash || null
      }
    ];
  }

  async incidentResponseStatus() {
    await this.init();
    const lastEvent = this.state.responseDrillEvents.at(-1) || null;
    const prerequisites = this.responsePrerequisites();
    return {
      contractVersion: INCIDENT_RESPONSE_CONTRACT,
      status: lastEvent?.status || "not-run",
      scope: "local-synthetic-tabletop",
      boundary: INCIDENT_RESPONSE_BOUNDARY,
      productionIncidentDeclared: false,
      productionServiceStopped: false,
      notificationTreeConnected: false,
      ownerAssignmentsComplete: false,
      clinicalRestartAuthorized: false,
      severityModel: clone(INCIDENT_SEVERITY_MODEL),
      scenarios: clone(INCIDENT_RESPONSE_SCENARIOS),
      ownerTree: INCIDENT_OWNER_TREE.map(owner => ({ ...owner, status: "unassigned-production-owner" })),
      phases: clone(RESPONSE_PHASES),
      prerequisites,
      readyToRehearse: prerequisites.every(item => item.status === "ready"),
      lastEvent: lastEvent ? clone(lastEvent) : null,
      chain: this.verifyResponseDrillEventChain()
    };
  }

  async rehearseIncidentResponse(scenarioId, actor = "Demo reviewer") {
    await this.init();
    const scenario = incidentResponseScenario(scenarioId);
    if (!scenario) fail("Choose a fixed incident-response scenario.", 400);
    if (this.responseDrillInFlight) fail("An incident-response rehearsal is already in progress.", 409);
    const prerequisites = this.responsePrerequisites();
    const missing = prerequisites.filter(item => item.status !== "ready");
    if (missing.length) fail(`Incident-response rehearsal requires current ${missing.map(item => item.label.toLowerCase()).join(", ")} evidence.`, 409);
    if (this.studyControl().state !== "active") fail("Resolve the active study stopping event before rehearsing restart governance.", 409);
    this.responseDrillInFlight = true;
    const startedAt = this.clock().toISOString();
    const monotonicStart = Date.now();
    try {
      const severity = incidentSeverity(scenario.severity);
      const monitoringEvidenceHash = prerequisites.find(item => item.id === "monitoring").evidenceHash;
      const recoveryEvidenceHash = prerequisites.find(item => item.id === "recovery").evidenceHash;
      const rollbackEvidenceHash = prerequisites.find(item => item.id === "rollback").evidenceHash;
      const integrityEvidenceHash = digest(this.integritySnapshot());
      const evidence = { monitoringEvidenceHash, recoveryEvidenceHash, rollbackEvidenceHash, integrityEvidenceHash };
      const event = this.appendResponseDrillEvent({
        status: "tabletop-complete",
        scope: "local-synthetic-tabletop",
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioHash: digest(scenario),
        severity: scenario.severity,
        responseTarget: severity.responseTarget,
        stopAuthorityRole: scenario.stopAuthorityRole,
        stopAction: scenario.stopAction,
        stopAuthorityAssigned: false,
        ownerAssignmentsComplete: false,
        notificationTreeConnected: false,
        externalNotificationsSent: false,
        productionIncidentDeclared: false,
        productionServiceStopped: false,
        productionContainmentClaimed: false,
        clinicalRestartAuthorized: false,
        clinicalReleaseAuthorized: false,
        localControlSimulation: true,
        phases: this.responsePhases(scenario, severity, evidence),
        notificationTree: this.responseNotificationTree(scenario),
        evidenceSources: clone(scenario.evidenceSources),
        restartCriteria: this.responseRestartCriteria(scenario),
        verification: {
          scenarioRecognized: true,
          severityMapped: true,
          stopRuleDefined: true,
          evidencePlanBounded: true,
          notificationTreeDefined: true,
          restartCriteriaDefined: true,
          currentMonitoringLinked: true,
          currentRecoveryLinked: true,
          currentRollbackLinked: true,
          studySafetyControlPresent: true
        },
        ...evidence,
        incidentChainHead: this.verifyIncidentChain().head || "GENESIS",
        actor,
        startedAt,
        completedAt: this.clock().toISOString(),
        durationMs: Math.max(0, Date.now() - monotonicStart),
        note: "The fixed local tabletop playbook completed and linked current continuity evidence. Production owners, notification delivery, containment, and restart authority remain unassigned or unconnected."
      });
      await this.persist();
      return { ...(await this.incidentResponseStatus()), event: clone(event) };
    } finally {
      this.responseDrillInFlight = false;
    }
  }

  readinessAuthorityRegister() {
    return clone(PILOT_AUTHORITY_REGISTER);
  }

  appendReadinessEvent(entry) {
    this.state.readinessEvents ||= [];
    const previous = this.state.readinessEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.readinessEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: PILOT_READINESS_CONTRACT,
      type: "pilot-readiness-snapshot-recorded",
      ...clone(entry)
    };
    const event = { ...core, hash: digest(core) };
    this.state.readinessEvents.push(event);
    return event;
  }

  verifyReadinessEventChain() {
    const events = this.state?.readinessEvents || [];
    const authorityRegister = this.readinessAuthorityRegister();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const gates = Array.isArray(core.gates) ? core.gates : [];
      const gatesValid = gates.length === PILOT_READINESS_GATES.length && gates.every((gate, gateIndex) => {
        const definition = PILOT_READINESS_GATES[gateIndex];
        const local = definition.category === "local-pattern";
        return gate.id === definition.id
          && gate.label === definition.label
          && gate.category === definition.category
          && JSON.stringify(gate.ownerRoles) === JSON.stringify(definition.ownerRoles)
          && (local ? ["local-evidence-current", "local-evidence-required"].includes(gate.status) : gate.status === "external-decision-required")
          && typeof gate.detail === "string"
          && gate.detail.length >= 12
          && gate.detail.length <= 220
          && (local ? /^[a-f0-9]{64}$/.test(gate.evidenceHash || "") : gate.evidenceHash === null)
          && gate.productionAccepted === false;
      });
      const gateCounts = core.gateCounts || {};
      const expectedGateCounts = {
        localCurrent: gates.filter(gate => gate.status === "local-evidence-current").length,
        localRequired: gates.filter(gate => gate.status === "local-evidence-required").length,
        externalDecisionRequired: gates.filter(gate => gate.status === "external-decision-required").length,
        total: gates.length
      };
      const authorityCounts = core.authorityCounts || {};
      const expectedAuthorityCounts = {
        confirmed: authorityRegister.filter(role => role.status === "confirmed-source-owner").length,
        provisional: authorityRegister.filter(role => role.status === "provisional-source-owner").length,
        unassigned: authorityRegister.filter(role => role.status === "unassigned").length,
        total: authorityRegister.length
      };
      const heads = core.evidenceHeads || {};
      const headKeys = ["engineeringRegression", "reportArtifacts", "deliveryOutbox", "recovery", "rollback", "monitoring", "incidentResponse", "integrity"];
      const headsValid = Object.keys(heads).length === headKeys.length
        && headKeys.every(key => typeof heads[key] === "string")
        && /^[a-f0-9]{64}$/.test(heads.engineeringRegression || "")
        && /^[a-f0-9]{64}$/.test(heads.integrity || "")
        && headKeys.slice(1, -1).every(key => heads[key] === "GENESIS" || /^[a-f0-9]{64}$/.test(heads[key] || ""));
      const stateHashValid = core.readinessStateHash === digest({
        gates: core.gates,
        gateCounts: core.gateCounts,
        authorityRegister: core.authorityRegister,
        authorityCounts: core.authorityCounts,
        evidenceHeads: core.evidenceHeads
      });
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === PILOT_READINESS_CONTRACT
        && core.type === "pilot-readiness-snapshot-recorded"
        && core.status === "pilot-authorization-blocked"
        && core.scope === "local-synthetic-readiness-dossier"
        && core.decision === "pilot-authorization-blocked"
        && gatesValid
        && JSON.stringify(gateCounts) === JSON.stringify(expectedGateCounts)
        && JSON.stringify(core.authorityRegister) === JSON.stringify(authorityRegister)
        && JSON.stringify(authorityCounts) === JSON.stringify(expectedAuthorityCounts)
        && headsValid
        && stateHashValid
        && core.productionReadinessClaimed === false
        && core.externalApprovalsRecorded === false
        && core.productionOwnersAssigned === false
        && core.pilotAuthorizationRecorded === false
        && core.clinicalReleaseAuthorized === false
        && /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(core.actor || "")
        && Number.isFinite(Date.parse(core.startedAt))
        && Number.isFinite(Date.parse(core.completedAt))
        && Number.isInteger(core.durationMs)
        && core.durationMs >= 0
        && typeof core.note === "string"
        && core.note.length >= 1
        && core.note.length <= 420
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, blocked: events.filter(item => item.status === "pilot-authorization-blocked").length };
      previousHash = hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, blocked: events.filter(item => item.status === "pilot-authorization-blocked").length };
  }

  async collectPilotReadiness() {
    const releaseEvidence = await evaluateReleaseEvidence({
      assessments: this.state.assessments,
      references: this.calibrationReferences,
      manifest: this.calibrationManifest,
      modelProvider: this.modelProvider,
      clock: this.clock
    });
    const study = this.studyControl();
    const generation = this.verifyGenerationEventChain();
    const reports = this.verifyReportArtifactChain();
    const source = this.verifySourceEventChain();
    const attachments = this.verifyAttachmentEventChain();
    const workflow = this.verifyAutomationEventChain();
    const delivery = this.verifyDeliveryChain();
    const recovery = this.verifyRecoveryEventChain();
    const rollback = this.verifyRollbackEventChain();
    const monitoring = this.verifyMonitoringEventChain();
    const response = this.verifyResponseDrillEventChain();
    const prerequisites = this.responsePrerequisites();
    const prerequisite = id => prerequisites.find(item => item.id === id);
    const responseEvent = this.state.responseDrillEvents.at(-1) || null;
    const { generatedAt: _releaseEvidenceGeneratedAt, ...stableReleaseEvidence } = releaseEvidence;
    const reportArtifactsCurrent = reports.valid
      && this.state.reportArtifacts.length > 0
      && this.state.reportArtifacts.every(artifact => validateReportContent(artifact.narrative, artifact.interpretation).length === 0);
    const deliveryCurrent = source.valid
      && attachments.valid
      && workflow.valid
      && delivery.valid
      && this.state.sourceEvents.length > 0
      && this.state.attachmentEvents.length > 0
      && this.state.automationEvents.length > 0
      && this.state.deliveryJobs.length > 0;
    const responseCurrent = response.valid
      && responseEvent?.status === "tabletop-complete"
      && responseEvent.monitoringEvidenceHash === prerequisite("monitoring")?.evidenceHash
      && responseEvent.recoveryEvidenceHash === prerequisite("recovery")?.evidenceHash
      && responseEvent.rollbackEvidenceHash === prerequisite("rollback")?.evidenceHash;
    const {
      decisionExchange: _decisionExchangeIntegrity,
      pilotOperations: _pilotOperationsIntegrity,
      providerActivation: _providerActivationIntegrity,
      campusObservatory: _campusObservatoryIntegrity,
      siteAdmission: _siteAdmissionIntegrity,
      authorityTrust: _authorityTrustIntegrity,
      pilotStart: _pilotStartIntegrity,
      clinicalRelease: _clinicalReleaseIntegrity,
      trafficActivation: _trafficActivationIntegrity,
      identityAccess: _identityAccessIntegrity,
      ...readinessIntegrity
    } = this.integritySnapshot();
    const evidenceHeads = {
      engineeringRegression: digest(stableReleaseEvidence),
      reportArtifacts: reports.head || "GENESIS",
      deliveryOutbox: delivery.head || "GENESIS",
      recovery: recovery.head || "GENESIS",
      rollback: rollback.head || "GENESIS",
      monitoring: monitoring.head || "GENESIS",
      incidentResponse: response.head || "GENESIS",
      integrity: digest(readinessIntegrity)
    };
    const localEvidence = {
      "engineering-safety": {
        current: releaseEvidence.engineeringRegressionPassed === true && study.state === "active" && generation.valid,
        detail: releaseEvidence.engineeringRegressionPassed === true && study.state === "active" && generation.valid
          ? "Frozen synthetic safety invariants pass with active study controls and intact generation lineage."
          : "Synthetic regression, study safety, or generation lineage requires attention.",
        evidenceHash: digest({ releaseEvidence: stableReleaseEvidence, study, generation })
      },
      "report-governance": {
        current: reportArtifactsCurrent,
        detail: reportArtifactsCurrent
          ? `${this.state.reportArtifacts.length} versioned clinician artifact${this.state.reportArtifacts.length === 1 ? " is" : "s are"} content-valid with intact lineage.`
          : "A content-valid versioned clinician artifact and intact report lineage are required.",
        evidenceHash: digest({ reports, artifacts: this.state.reportArtifacts.map(artifact => artifact.hash) })
      },
      "delivery-rehearsal": {
        current: deliveryCurrent,
        detail: deliveryCurrent
          ? "A scored source event completed the governed preparation and durable outbox rehearsal."
          : "Run one complete synthetic scored-event, approval, preparation, and outbox rehearsal.",
        evidenceHash: digest({ source, attachments, workflow, delivery, sourceEvents: this.state.sourceEvents.length, attachmentEvents: this.state.attachmentEvents.length, automationEvents: this.state.automationEvents.length, deliveryJobs: this.state.deliveryJobs.length })
      },
      "recovery-evidence": {
        current: prerequisite("recovery")?.status === "ready",
        detail: prerequisite("recovery")?.status === "ready" ? "The latest isolated restore is verified against the current state schema." : "Current-schema isolated restore evidence is required.",
        evidenceHash: digest({ recovery, current: prerequisite("recovery") })
      },
      "rollback-evidence": {
        current: prerequisite("rollback")?.status === "ready",
        detail: prerequisite("rollback")?.status === "ready" ? "The sealed local baseline matches the current state schema and source manifest." : "Current-manifest application compatibility evidence is required.",
        evidenceHash: digest({ rollback, current: prerequisite("rollback") })
      },
      "monitoring-evidence": {
        current: prerequisite("monitoring")?.status === "ready" && monitoring.valid,
        detail: prerequisite("monitoring")?.status === "ready" && monitoring.valid ? "The latest current-schema local control matrix is clear." : "A clear current-schema operational control snapshot is required.",
        evidenceHash: digest({ monitoring, current: prerequisite("monitoring") })
      },
      "response-evidence": {
        current: responseCurrent,
        detail: responseCurrent ? "The latest response tabletop links the current monitoring, recovery, and rollback evidence." : "A response tabletop linked to the latest continuity evidence is required.",
        evidenceHash: digest({ response, responseEvent })
      }
    };
    const externalDetails = {
      "intended-use-approval": "Dolores, the clinical lead, and legal owner must approve the exact intended use and report language.",
      "authoritative-eqpass": "The e-QPASS and clinical owners must sign the scored-event, severity, lifecycle, and attachment mapping.",
      "clinical-beta": "A named clinical lead and counselor panel must accept guided calibration evidence from approved cases.",
      "independent-reliability": "A named independent evaluator must freeze the analysis plan and issue a signed reliability decision.",
      "security-production": "Security, engineering, and e-QPASS owners must accept the Azure data flow and production controls.",
      "accessibility-acceptance": "A named accessibility owner and independent audit path must accept manual and assistive-technology evidence.",
      "pilot-authorization": "The named decision group must authorize only identified sites after every prerequisite is accepted."
    };
    const gates = PILOT_READINESS_GATES.map(definition => {
      const evidence = localEvidence[definition.id];
      return {
        ...clone(definition),
        status: definition.category === "local-pattern"
          ? evidence.current ? "local-evidence-current" : "local-evidence-required"
          : "external-decision-required",
        detail: definition.category === "local-pattern" ? evidence.detail : externalDetails[definition.id],
        evidenceHash: definition.category === "local-pattern" ? evidence.evidenceHash : null,
        productionAccepted: false
      };
    });
    const gateCounts = {
      localCurrent: gates.filter(gate => gate.status === "local-evidence-current").length,
      localRequired: gates.filter(gate => gate.status === "local-evidence-required").length,
      externalDecisionRequired: gates.filter(gate => gate.status === "external-decision-required").length,
      total: gates.length
    };
    const authorityRegister = this.readinessAuthorityRegister();
    const authorityCounts = {
      confirmed: authorityRegister.filter(role => role.status === "confirmed-source-owner").length,
      provisional: authorityRegister.filter(role => role.status === "provisional-source-owner").length,
      unassigned: authorityRegister.filter(role => role.status === "unassigned").length,
      total: authorityRegister.length
    };
    const current = {
      status: "pilot-authorization-blocked",
      scope: "local-synthetic-readiness-dossier",
      decision: "pilot-authorization-blocked",
      gates,
      gateCounts,
      authorityRegister,
      authorityCounts,
      evidenceHeads,
      productionReadinessClaimed: false,
      externalApprovalsRecorded: false,
      productionOwnersAssigned: false,
      pilotAuthorizationRecorded: false,
      clinicalReleaseAuthorized: false
    };
    current.readinessStateHash = digest({ gates, gateCounts, authorityRegister, authorityCounts, evidenceHeads });
    return current;
  }

  async pilotReadinessStatus() {
    await this.init();
    const current = await this.collectPilotReadiness();
    const lastEvent = this.state.readinessEvents.at(-1) || null;
    return {
      contractVersion: PILOT_READINESS_CONTRACT,
      status: current.status,
      boundary: PILOT_READINESS_BOUNDARY,
      current,
      lastEvent: lastEvent ? clone(lastEvent) : null,
      chain: this.verifyReadinessEventChain()
    };
  }

  async recordPilotReadinessSnapshot(actor = "Demo reviewer") {
    await this.init();
    if (this.readinessSnapshotInFlight) fail("A pilot-readiness snapshot is already in progress.", 409);
    this.readinessSnapshotInFlight = true;
    const startedAt = this.clock().toISOString();
    const monotonicStart = Date.now();
    try {
      const current = await this.collectPilotReadiness();
      const event = this.appendReadinessEvent({
        ...current,
        actor,
        startedAt,
        completedAt: this.clock().toISOString(),
        durationMs: Math.max(0, Date.now() - monotonicStart),
        note: `Readiness remains blocked: ${current.gateCounts.localRequired} local evidence gate${current.gateCounts.localRequired === 1 ? "" : "s"} and ${current.gateCounts.externalDecisionRequired} external authority gates remain open; no production approval was recorded.`
      });
      await this.persist();
      return { ...(await this.pilotReadinessStatus()), event: clone(event) };
    } finally {
      this.readinessSnapshotInFlight = false;
    }
  }

  clinicalStandardEvidenceHeads() {
    return Object.fromEntries([
      ["feedback", this.verifyFeedbackEventChain()],
      ["revisions", this.verifyRevisionChain()],
      ["blindOutcomes", this.verifyComparisonChain()],
      ["incidents", this.verifyIncidentChain()],
      ["workflowTiming", this.verifyTimingEventChain()]
    ].map(([key, chain]) => [key, chain.head || "GENESIS"]));
  }

  appendClinicalStandardEvent(draft) {
    this.state.clinicalStandardEvents ||= [];
    const previous = this.state.clinicalStandardEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.clinicalStandardEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: CLINICAL_STANDARD_CONTRACT,
      type: "clinical-standard-draft-recorded",
      draftId: draft.id,
      draftHash: draft.hash,
      draftVersion: draft.version,
      preOutcomeCandidate: draft.preOutcomeCandidate,
      actor: draft.actor,
      createdAt: draft.createdAt,
      note: draft.preOutcomeCandidate
        ? "Working intent was recorded before this sandbox contained outcome evidence; external acceptance remains absent."
        : "Working intent was recorded after outcome evidence existed and is permanently labeled post-outcome; external acceptance remains absent."
    };
    const event = { ...core, hash: digest(core) };
    this.state.clinicalStandardEvents.push(event);
    return event;
  }

  verifyClinicalStandardEventChain() {
    const drafts = this.state?.clinicalStandardDrafts || [];
    const events = this.state?.clinicalStandardEvents || [];
    const byId = new Map(drafts.map(draft => [draft.id, draft]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const draft = byId.get(core.draftId);
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === CLINICAL_STANDARD_CONTRACT
        && core.type === "clinical-standard-draft-recorded"
        && draft
        && !seen.has(core.draftId)
        && draft.version === index + 1
        && core.draftVersion === draft.version
        && core.draftHash === draft.hash
        && core.preOutcomeCandidate === draft.preOutcomeCandidate
        && core.actor === draft.actor
        && core.createdAt === draft.createdAt
        && typeof core.note === "string"
        && core.note.length >= 20
        && validateClinicalStandardDraft(draft).length === 0
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, preOutcomeDrafts: drafts.filter(item => item.preOutcomeCandidate).length };
      seen.add(core.draftId);
      previousHash = hash;
    }
    const valid = seen.size === drafts.length && drafts.every((draft, index) => draft.version === index + 1);
    return {
      valid,
      count: events.length,
      failedAt: valid ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      preOutcomeDrafts: drafts.filter(item => item.preOutcomeCandidate).length
    };
  }

  async clinicalStandardStatus() {
    await this.init();
    return buildClinicalStandardStatus({
      drafts: this.state.clinicalStandardDrafts,
      chain: this.verifyClinicalStandardEventChain(),
      analysis: await this.calibrationAnalysis(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordClinicalStandardDraft(input, actor = "Demo reviewer") {
    await this.init();
    const draft = createClinicalStandardDraft({
      input,
      actor,
      version: this.state.clinicalStandardDrafts.length + 1,
      analysis: await this.calibrationAnalysis(),
      evidenceHeads: this.clinicalStandardEvidenceHeads(),
      createdAt: this.clock().toISOString()
    });
    const validationErrors = validateClinicalStandardDraft(draft);
    if (validationErrors.length) fail(validationErrors.join(" "), 400);
    this.state.clinicalStandardDrafts.push(draft);
    const event = this.appendClinicalStandardEvent(draft);
    await this.persist();
    return { clinicalStandard: await this.clinicalStandardStatus(), draft: clone(draft), event: clone(event) };
  }

  verifyIndependentReviewEventChain() {
    const events = this.state?.independentReviewEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateIndependentReviewSnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, sealed: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, sealed: events.length };
  }

  async independentReviewStatus() {
    await this.init();
    const [analysis, clinicalStandard, manifestPackage, referenceDecision] = await Promise.all([
      this.calibrationAnalysis(),
      this.clinicalStandardStatus(),
      this.caseSetManifest(),
      this.counselorReferenceDecisionStatus()
    ]);
    return buildIndependentReviewDossier({
      analysis,
      clinicalStandard,
      manifestPackage,
      runtimeVersions: this.loadedRuntimeVersions(),
      referenceDecision,
      snapshots: this.state.independentReviewEvents,
      chain: this.verifyIndependentReviewEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async sealIndependentReviewDossier(actor = "Demo reviewer") {
    await this.init();
    const dossier = await this.independentReviewStatus();
    const previous = this.state.independentReviewEvents.at(-1);
    const event = createIndependentReviewSnapshot({
      dossier,
      actor,
      sequence: this.state.independentReviewEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString()
    });
    const errors = validateIndependentReviewSnapshot(event, { sequence: event.sequence, previousHash: event.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.independentReviewEvents.push(event);
    await this.persist();
    return { event: clone(event), independentReview: await this.independentReviewStatus() };
  }

  verifyIntegrationReturnEventChain() {
    const events = this.state?.integrationReturnEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateIntegrationReturnPreflight(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, preflights: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, preflights: events.length };
  }

  async integrationReturnStatus() {
    await this.init();
    return buildIntegrationReturnDesk({
      events: this.state.integrationReturnEvents,
      chain: this.verifyIntegrationReturnEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async preflightIntegrationReturnManifest(manifest, actor = "Demo reviewer") {
    await this.init();
    const manifestErrors = validateIntegrationReturnManifest(manifest);
    if (manifestErrors.length) fail(manifestErrors.join(" "), 400);
    const desk = await this.integrationReturnStatus();
    const previous = this.state.integrationReturnEvents.at(-1);
    const event = createIntegrationReturnPreflight({
      manifest,
      actor,
      sequence: this.state.integrationReturnEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString(),
      requestFingerprint: desk.requestFingerprint
    });
    const errors = validateIntegrationReturnPreflight(event, { sequence: event.sequence, previousHash: event.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.integrationReturnEvents.push(event);
    await this.persist();
    return { event: clone(event), integrationReturn: await this.integrationReturnStatus() };
  }

  verifyCounselorNotebookEntryChain() {
    const entries = this.state?.counselorNotebookEntries || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const errors = validateCounselorNotebookEntry(entry, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: entries.length, failedAt: index + 1, head: entries.at(-1)?.hash || null, notes: entries.length };
      }
      previousHash = entry.hash;
    }
    return { valid: true, count: entries.length, failedAt: null, head: entries.at(-1)?.hash || null, notes: entries.length };
  }

  counselorNotebookEvidenceSnapshot() {
    const integrity = this.integritySnapshot();
    return {
      counts: {
        pairedBlindComparisons: this.state.comparisons.length,
        structuredFeedbackEntries: this.state.feedback.length,
        revisions: this.state.revisions.length,
        workflowTimingObservations: this.state.timingObservations.length,
        openSafetyIncidents: this.incidentRecords().filter(item => item.status === "open").length
      },
      heads: {
        feedback: integrity.feedback.head,
        revisions: integrity.revisions.head,
        blindOutcomes: integrity.blindOutcomes.head,
        incidents: integrity.incidents.head,
        workflowTiming: integrity.workflowTiming.head
      },
      caseSet: {
        id: this.calibrationManifest.id,
        version: this.calibrationManifest.version
      },
      sourceContractStatus: "proposed-rfi-only"
    };
  }

  async counselorNotebookStatus() {
    await this.init();
    return buildCounselorNotebook({
      entries: this.state.counselorNotebookEntries,
      chain: this.verifyCounselorNotebookEntryChain(),
      assessmentIds: this.state.assessments.map(item => item.id),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordCounselorNotebookEntry(input, actor = "Demo reviewer") {
    await this.init();
    const inputErrors = validateCounselorNotebookInput(input);
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    if (input.assessmentId !== null) this.assessmentIndex(input.assessmentId);
    const previous = this.state.counselorNotebookEntries.at(-1);
    const entry = createCounselorNotebookEntry({
      input,
      actor,
      sequence: this.state.counselorNotebookEntries.length + 1,
      previousHash: previous?.hash || "GENESIS",
      evidenceSnapshot: this.counselorNotebookEvidenceSnapshot(),
      createdAt: this.clock().toISOString()
    });
    const errors = validateCounselorNotebookEntry(entry, { sequence: entry.sequence, previousHash: entry.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.counselorNotebookEntries.push(entry);
    await this.persist();
    return { entry: clone(entry), counselorNotebook: await this.counselorNotebookStatus() };
  }

  verifyCounselorReferenceDraftChain() {
    const drafts = this.state?.counselorReferenceDrafts || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const errors = validateCounselorReferenceDraft(draft, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: drafts.length, failedAt: index + 1, head: drafts.at(-1)?.hash || null, drafts: drafts.length };
      }
      previousHash = draft.hash;
    }
    return { valid: true, count: drafts.length, failedAt: null, head: drafts.at(-1)?.hash || null, drafts: drafts.length };
  }

  async counselorReferenceRoomStatus(actor = "Demo reviewer") {
    await this.init();
    return buildCounselorReferenceRoom({
      assessments: this.state.assessments,
      drafts: this.state.counselorReferenceDrafts,
      chain: this.verifyCounselorReferenceDraftChain(),
      manifest: this.calibrationManifest,
      actor,
      generatedAt: this.clock().toISOString()
    });
  }

  async recordCounselorReferenceDraft(input, actor = "Demo reviewer") {
    await this.init();
    const assessment = this.state.assessments[this.assessmentIndex(input?.assessmentId)];
    const manifestCase = this.calibrationManifest.cases?.[assessment.id];
    if (!manifestCase || manifestCase.partition !== "development") fail("Counselor reference drafting is limited to the frozen development partition; the holdout remains unopened.", 409);
    if (this.state.counselorReferenceDrafts.some(draft => draft.assessmentId === assessment.id && draft.actor === actor)) {
      fail("This reviewer code already submitted a source-only draft for the selected case. Immutable drafts cannot be overwritten.", 409);
    }
    const sourceProfile = buildCounselorReferenceSource(assessment);
    const inputErrors = validateCounselorReferenceInput(input, sourceProfile);
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    const previous = this.state.counselorReferenceDrafts.at(-1);
    const draft = createCounselorReferenceDraft({
      input,
      sourceProfile,
      caseSet: {
        id: this.calibrationManifest.id,
        version: this.calibrationManifest.version,
        partition: manifestCase.partition,
        referenceVersion: manifestCase.referenceVersion
      },
      actor,
      sequence: this.state.counselorReferenceDrafts.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString()
    });
    const errors = validateCounselorReferenceDraft(draft, { sequence: draft.sequence, previousHash: draft.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.counselorReferenceDrafts.push(draft);
    await this.persist();
    return { draft: clone(draft), referenceRoom: await this.counselorReferenceRoomStatus(actor) };
  }

  verifyCounselorReferenceAdjudicationChain() {
    const events = this.state?.counselorReferenceAdjudicationEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCounselorReferenceAdjudicationSnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, snapshots: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, snapshots: events.length };
  }

  async counselorReferenceAdjudicationStatus(actor = "Demo reviewer") {
    await this.init();
    return buildCounselorReferenceAdjudicationDossier({
      assessments: this.state.assessments,
      drafts: this.state.counselorReferenceDrafts,
      referenceChain: this.verifyCounselorReferenceDraftChain(),
      manifest: this.calibrationManifest,
      events: this.state.counselorReferenceAdjudicationEvents,
      chain: this.verifyCounselorReferenceAdjudicationChain(),
      actor,
      generatedAt: this.clock().toISOString()
    });
  }

  async sealCounselorReferenceAdjudication(actor = "Demo reviewer") {
    await this.init();
    const dossier = await this.counselorReferenceAdjudicationStatus(actor);
    const previous = this.state.counselorReferenceAdjudicationEvents.at(-1);
    if (previous?.dossierFingerprint === dossier.dossierFingerprint) {
      return { created: false, snapshot: clone(previous), adjudication: dossier };
    }
    const snapshot = createCounselorReferenceAdjudicationSnapshot({
      dossier,
      actor,
      sequence: this.state.counselorReferenceAdjudicationEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString()
    });
    const errors = validateCounselorReferenceAdjudicationSnapshot(snapshot, { sequence: snapshot.sequence, previousHash: snapshot.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.counselorReferenceAdjudicationEvents.push(snapshot);
    await this.persist();
    return { created: true, snapshot: clone(snapshot), adjudication: await this.counselorReferenceAdjudicationStatus(actor) };
  }

  verifyCounselorReferenceDecisionChain() {
    const events = this.state?.counselorReferenceDecisionEvents || [];
    const challenges = new Map();
    const attestations = new Map();
    const seenAttestationIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "reference-decision-challenge-issued" ? event.challenge?.challengeId : event.attestation?.challengeId;
      const challenge = event.eventType === "reference-decision-attestation-verified" ? challenges.get(challengeId) : null;
      const priorAttestations = attestations.get(challengeId) || new Map();
      const seenPurposes = new Set(priorAttestations.keys());
      const errors = validateCounselorReferenceDecisionEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.counselorReferenceDecisionRegistry,
        challenge,
        priorAttestations,
        now: event.createdAt,
        seenAttestationIds,
        seenSignatureHashes,
        seenPurposes
      });
      if (event.eventType === "reference-decision-attestation-verified" && !challenge) errors.push("Verified counselor-reference decision attestation has no prior challenge event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "reference-decision-challenge-issued").length,
        verifiedAttestations: events.filter(item => item.eventType === "reference-decision-attestation-verified").length
      };
      if (event.eventType === "reference-decision-challenge-issued") {
        challenges.set(event.challenge.challengeId, event.challenge);
        attestations.set(event.challenge.challengeId, new Map());
      } else {
        priorAttestations.set(event.attestation.purpose, event.attestation);
        seenAttestationIds.add(event.attestation.attestationId);
        seenSignatureHashes.add(counselorReferenceDecisionDigest(event.attestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "reference-decision-challenge-issued").length,
      verifiedAttestations: events.filter(item => item.eventType === "reference-decision-attestation-verified").length
    };
  }

  async counselorReferenceDecisionStatus() {
    await this.init();
    const latestAdjudication = this.state.counselorReferenceAdjudicationEvents.at(-1);
    const dossier = await this.counselorReferenceAdjudicationStatus(latestAdjudication?.actor || "REFERENCE-DECISION");
    return buildCounselorReferenceDecisionDocket({
      dossier,
      registry: this.counselorReferenceDecisionRegistry,
      events: this.state.counselorReferenceDecisionEvents,
      chain: this.verifyCounselorReferenceDecisionChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueCounselorReferenceDecisionChallenge(actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeCounselorReferenceDecisionRegistry(this.counselorReferenceDecisionRegistry, createdAt);
    const everyDutyCurrent = registrySummary.registryCurrent && Object.values(registrySummary.activePurposeCounts).every(count => count > 0);
    if (!everyDutyCurrent || registrySummary.activeKeyCount < 4) fail("Provision four current, distinct counselor-reference decision keys in an owner-only startup registry before issuing a challenge.", 409);
    const latestAdjudication = this.state.counselorReferenceAdjudicationEvents.at(-1);
    if (!latestAdjudication) fail("Seal the current counselor-reference adjudication dossier before issuing a decision challenge.", 409);
    const dossier = await this.counselorReferenceAdjudicationStatus(latestAdjudication.actor);
    if (latestAdjudication.dossierFingerprint !== dossier.dossierFingerprint) fail("The sealed counselor-reference adjudication dossier is stale. Seal the current evidence state before issuing a challenge.", 409);
    if (!dossier.cases.length || dossier.cases.some(item => !item.locallyComparable)) fail("Every frozen development case requires at least two current source-only drafts from distinct reviewer codes before issuing a decision challenge.", 409);
    const active = this.state.counselorReferenceDecisionEvents.findLast(event => event.eventType === "reference-decision-challenge-issued" && event.challenge.dossierFingerprint === dossier.dossierFingerprint && event.challenge.adjudicationChainHead === dossier.chain.head && event.challenge.referenceDraftChainHead === dossier.referenceDraftChain.head && event.challenge.registryFingerprint === registrySummary.registryFingerprint && Date.parse(createdAt) <= Date.parse(event.challenge.expiresAt));
    if (active) return { created: false, challenge: clone(active.challenge), event: clone(active), referenceDecision: await this.counselorReferenceDecisionStatus() };
    const previousHash = this.state.counselorReferenceDecisionEvents.at(-1)?.hash || "GENESIS";
    const event = createCounselorReferenceDecisionChallenge({
      dossier,
      adjudicationChainHead: dossier.chain.head,
      referenceDraftChainHead: dossier.referenceDraftChain.head,
      registry: this.counselorReferenceDecisionRegistry,
      actor,
      sequence: this.state.counselorReferenceDecisionEvents.length + 1,
      previousHash,
      createdAt
    });
    const errors = validateCounselorReferenceDecisionEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.counselorReferenceDecisionEvents.push(event);
    await this.persist();
    return { created: true, challenge: clone(event.challenge), event: clone(event), referenceDecision: await this.counselorReferenceDecisionStatus() };
  }

  async counselorReferenceDecisionChallenge(challengeId) {
    await this.init();
    const event = this.state.counselorReferenceDecisionEvents.find(item => item.eventType === "reference-decision-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) fail("Counselor-reference decision challenge was not found.", 404);
    return clone(event.challenge);
  }

  async verifyCounselorReferenceDecisionAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.counselorReferenceDecisionEvents.find(event => event.eventType === "reference-decision-challenge-issued" && event.challenge.challengeId === attestation?.challengeId);
    if (!challengeEvent) fail("Counselor-reference decision attestation does not reference an issued challenge.", 400);
    const latestAdjudication = this.state.counselorReferenceAdjudicationEvents.at(-1);
    const dossier = await this.counselorReferenceAdjudicationStatus(latestAdjudication?.actor || "REFERENCE-DECISION");
    const challengeErrors = validateCounselorReferenceDecisionChallenge(challengeEvent.challenge, {
      dossier,
      adjudicationChainHead: dossier.chain.head,
      referenceDraftChainHead: dossier.referenceDraftChain.head,
      registryFingerprint: counselorReferenceDecisionRegistryFingerprint(this.counselorReferenceDecisionRegistry)
    });
    if (latestAdjudication?.dossierFingerprint !== dossier.dossierFingerprint) challengeErrors.push("The counselor-reference adjudication dossier changed after the challenge was issued.");
    if (Date.parse(verifiedAt) > Date.parse(challengeEvent.challenge.expiresAt)) challengeErrors.push("Counselor-reference decision challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const priorEvents = this.state.counselorReferenceDecisionEvents.filter(event => event.eventType === "reference-decision-attestation-verified" && event.attestation.challengeId === challengeEvent.challenge.challengeId);
    const priorAttestations = new Map(priorEvents.map(event => [event.attestation.purpose, event.attestation]));
    const seenAttestationIds = new Set(this.state.counselorReferenceDecisionEvents.filter(event => event.eventType === "reference-decision-attestation-verified").map(event => event.attestation.attestationId));
    const seenSignatureHashes = new Set(this.state.counselorReferenceDecisionEvents.filter(event => event.eventType === "reference-decision-attestation-verified").map(event => counselorReferenceDecisionDigest(event.attestation.signature.value)));
    const seenPurposes = new Set(priorAttestations.keys());
    const attestationErrors = validateCounselorReferenceDecisionAttestation(attestation, {
      challenge: challengeEvent.challenge,
      registry: this.counselorReferenceDecisionRegistry,
      priorAttestations,
      now: verifiedAt,
      seenAttestationIds,
      seenSignatureHashes,
      seenPurposes
    });
    if (attestationErrors.length) fail(attestationErrors.join(" "), 400);
    const previousHash = this.state.counselorReferenceDecisionEvents.at(-1)?.hash || "GENESIS";
    const event = createCounselorReferenceDecisionAttestationEvent({
      attestation,
      registry: this.counselorReferenceDecisionRegistry,
      actor,
      sequence: this.state.counselorReferenceDecisionEvents.length + 1,
      previousHash,
      verifiedAt
    });
    const eventErrors = validateCounselorReferenceDecisionEvent(event, {
      sequence: event.sequence,
      previousHash,
      registry: this.counselorReferenceDecisionRegistry,
      challenge: challengeEvent.challenge,
      priorAttestations,
      now: verifiedAt,
      seenAttestationIds,
      seenSignatureHashes,
      seenPurposes
    });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.counselorReferenceDecisionEvents.push(event);
    await this.persist();
    return { event: clone(event), referenceDecision: await this.counselorReferenceDecisionStatus() };
  }

  verifyIndependentReviewAdmissionChain() {
    const events = this.state?.independentReviewAdmissionEvents || [];
    const challenges = new Map();
    const attestations = new Map();
    const seenAttestationIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "independent-review-admission-challenge-issued" ? event.challenge?.challengeId : event.attestation?.challengeId;
      const challenge = event.eventType === "independent-review-admission-attestation-verified" ? challenges.get(challengeId) : null;
      const priorAttestations = attestations.get(challengeId) || new Map();
      const seenPurposes = new Set(priorAttestations.keys());
      const errors = validateIndependentReviewAdmissionEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.independentReviewAdmissionRegistry,
        challenge,
        priorAttestations,
        now: event.createdAt,
        seenAttestationIds,
        seenSignatureHashes,
        seenPurposes
      });
      if (event.eventType === "independent-review-admission-attestation-verified" && !challenge) errors.push("Verified independent-review admission attestation has no prior challenge event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "independent-review-admission-challenge-issued").length,
        verifiedAttestations: events.filter(item => item.eventType === "independent-review-admission-attestation-verified").length
      };
      if (event.eventType === "independent-review-admission-challenge-issued") {
        challenges.set(event.challenge.challengeId, event.challenge);
        attestations.set(event.challenge.challengeId, new Map());
      } else {
        priorAttestations.set(event.attestation.purpose, event.attestation);
        seenAttestationIds.add(event.attestation.attestationId);
        seenSignatureHashes.add(independentReviewAdmissionDigest(event.attestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "independent-review-admission-challenge-issued").length,
      verifiedAttestations: events.filter(item => item.eventType === "independent-review-admission-attestation-verified").length
    };
  }

  async independentReviewAdmissionStatus() {
    await this.init();
    const [dossier, referenceDecision, clinicalStandard] = await Promise.all([
      this.independentReviewStatus(),
      this.counselorReferenceDecisionStatus(),
      this.clinicalStandardStatus()
    ]);
    return buildIndependentReviewAdmissionDocket({
      dossier,
      referenceDecision,
      clinicalStandard,
      registry: this.independentReviewAdmissionRegistry,
      events: this.state.independentReviewAdmissionEvents,
      chain: this.verifyIndependentReviewAdmissionChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueIndependentReviewAdmissionChallenge(actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeIndependentReviewAdmissionRegistry(this.independentReviewAdmissionRegistry, createdAt);
    const everyDutyCurrent = registrySummary.registryCurrent && Object.values(registrySummary.activePurposeCounts).every(count => count === 1);
    if (!everyDutyCurrent || registrySummary.activeKeyCount < 7) fail("Provision seven current, distinct independent-review admission keys in an owner-only startup registry before issuing a challenge.", 409);
    const [dossier, referenceDecision, clinicalStandard] = await Promise.all([this.independentReviewStatus(), this.counselorReferenceDecisionStatus(), this.clinicalStandardStatus()]);
    if (dossier.chain?.valid !== true || dossier.latestSeal?.dossierFingerprint !== dossier.dossierFingerprint || dossier.gateCounts?.localCurrent !== 4) fail("Seal the current four-gate independent-review dossier before issuing an admission challenge.", 409);
    if (referenceDecision.protocolFrozen !== true || referenceDecision.independentReviewHandoffReady !== true || dossier.evidenceSnapshot?.referenceDecisionDocketFingerprint !== referenceDecision.docketFingerprint) fail("Verify and bind the current counselor-reference protocol freeze before issuing an admission challenge.", 409);
    if (!clinicalStandard.latestDraft?.hash || clinicalStandard.chain?.valid !== true) fail("Record a current clinical-standard draft before issuing an admission challenge.", 409);
    const active = this.state.independentReviewAdmissionEvents.findLast(event => event.eventType === "independent-review-admission-challenge-issued" && event.challenge.dossierFingerprint === dossier.dossierFingerprint && event.challenge.dossierChainHead === dossier.chain.head && event.challenge.referenceDecisionDocketFingerprint === referenceDecision.docketFingerprint && event.challenge.referenceDecisionChainHead === referenceDecision.chain.head && event.challenge.clinicalStandardDraftHash === clinicalStandard.latestDraft.hash && event.challenge.registryFingerprint === registrySummary.registryFingerprint && Date.parse(createdAt) <= Date.parse(event.challenge.expiresAt));
    if (active) return { created: false, challenge: clone(active.challenge), event: clone(active), independentReviewAdmission: await this.independentReviewAdmissionStatus() };
    const previousHash = this.state.independentReviewAdmissionEvents.at(-1)?.hash || "GENESIS";
    const event = createIndependentReviewAdmissionChallenge({ dossier, referenceDecision, clinicalStandard, registry: this.independentReviewAdmissionRegistry, actor, sequence: this.state.independentReviewAdmissionEvents.length + 1, previousHash, createdAt });
    const errors = validateIndependentReviewAdmissionEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.independentReviewAdmissionEvents.push(event);
    await this.persist();
    return { created: true, challenge: clone(event.challenge), event: clone(event), independentReviewAdmission: await this.independentReviewAdmissionStatus() };
  }

  async independentReviewAdmissionChallenge(challengeId) {
    await this.init();
    const event = this.state.independentReviewAdmissionEvents.find(item => item.eventType === "independent-review-admission-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) fail("Independent-review admission challenge was not found.", 404);
    return clone(event.challenge);
  }

  async verifyIndependentReviewAdmissionAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.independentReviewAdmissionEvents.find(event => event.eventType === "independent-review-admission-challenge-issued" && event.challenge.challengeId === attestation?.challengeId);
    if (!challengeEvent) fail("Independent-review admission attestation does not reference an issued challenge.", 400);
    const [dossier, referenceDecision, clinicalStandard] = await Promise.all([this.independentReviewStatus(), this.counselorReferenceDecisionStatus(), this.clinicalStandardStatus()]);
    const challengeErrors = validateIndependentReviewAdmissionChallenge(challengeEvent.challenge, { dossier, referenceDecision, clinicalStandard, registryFingerprint: independentReviewAdmissionRegistryFingerprint(this.independentReviewAdmissionRegistry) });
    if (Date.parse(verifiedAt) > Date.parse(challengeEvent.challenge.expiresAt)) challengeErrors.push("Independent-review admission challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const priorEvents = this.state.independentReviewAdmissionEvents.filter(event => event.eventType === "independent-review-admission-attestation-verified" && event.attestation.challengeId === challengeEvent.challenge.challengeId);
    const priorAttestations = new Map(priorEvents.map(event => [event.attestation.purpose, event.attestation]));
    const seenAttestationIds = new Set(this.state.independentReviewAdmissionEvents.filter(event => event.eventType === "independent-review-admission-attestation-verified").map(event => event.attestation.attestationId));
    const seenSignatureHashes = new Set(this.state.independentReviewAdmissionEvents.filter(event => event.eventType === "independent-review-admission-attestation-verified").map(event => independentReviewAdmissionDigest(event.attestation.signature.value)));
    const seenPurposes = new Set(priorAttestations.keys());
    const attestationErrors = validateIndependentReviewAdmissionAttestation(attestation, { challenge: challengeEvent.challenge, registry: this.independentReviewAdmissionRegistry, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (attestationErrors.length) fail(attestationErrors.join(" "), 400);
    const previousHash = this.state.independentReviewAdmissionEvents.at(-1)?.hash || "GENESIS";
    const event = createIndependentReviewAdmissionAttestationEvent({ attestation, registry: this.independentReviewAdmissionRegistry, actor, sequence: this.state.independentReviewAdmissionEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateIndependentReviewAdmissionEvent(event, { sequence: event.sequence, previousHash, registry: this.independentReviewAdmissionRegistry, challenge: challengeEvent.challenge, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.independentReviewAdmissionEvents.push(event);
    await this.persist();
    return { event: clone(event), independentReviewAdmission: await this.independentReviewAdmissionStatus() };
  }

  verifyProgressReviewObservationChain() {
    const events = this.state?.progressReviewEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateProgressReviewObservation(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, observations: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, observations: events.length };
  }

  async progressReviewStatus() {
    await this.init();
    return buildProgressReview({
      assessments: this.state.assessments,
      observations: this.state.progressReviewEvents,
      chain: this.verifyProgressReviewObservationChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordProgressReviewObservation(input, actor = "Demo reviewer") {
    await this.init();
    const inputErrors = validateProgressReviewInput(input);
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    const progressReview = await this.progressReviewStatus();
    const previous = this.state.progressReviewEvents.at(-1);
    const event = createProgressReviewObservation({
      input,
      actor,
      sequence: this.state.progressReviewEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      evidenceSnapshot: progressReviewEvidenceSnapshot(progressReview),
      createdAt: this.clock().toISOString()
    });
    const errors = validateProgressReviewObservation(event, { sequence: event.sequence, previousHash: event.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.progressReviewEvents.push(event);
    await this.persist();
    return { event: clone(event), progressReview: await this.progressReviewStatus() };
  }

  verifyModelTrialPreflightChain() {
    const events = this.state?.modelTrialEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateModelTrialPreflight(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, preflights: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, preflights: events.length };
  }

  modelTrialEvidenceSnapshot() {
    const provider = generationGatewayStatus(this.modelProvider).activeProvider;
    const generationChain = this.verifyGenerationEventChain();
    return {
      caseSet: {
        id: this.calibrationManifest.id,
        version: this.calibrationManifest.version,
        manifestHash: digest(this.calibrationManifest)
      },
      syntheticCases: this.state.assessments.length,
      generationRecords: this.state.generationRecords.length,
      generationChainHead: generationChain.head,
      policyVersion: GENERATION_POLICY_VERSION,
      policyHash: GENERATION_POLICY_HASH,
      outputGateCount: 10,
      activeProvider: {
        id: provider.id,
        version: provider.version,
        mode: provider.mode,
        externalTransmission: provider.externalTransmission,
        phiApproved: false
      }
    };
  }

  async modelTrialStatus() {
    await this.init();
    return buildModelTrialBench({
      events: this.state.modelTrialEvents,
      chain: this.verifyModelTrialPreflightChain(),
      evidenceSnapshot: this.modelTrialEvidenceSnapshot(),
      generatedAt: this.clock().toISOString()
    });
  }

  async preflightModelTrialManifest(manifest, actor = "Demo reviewer") {
    await this.init();
    const manifestErrors = validateModelTrialManifest(manifest);
    if (manifestErrors.length) fail(manifestErrors.join(" "), 400);
    const bench = await this.modelTrialStatus();
    const previous = this.state.modelTrialEvents.at(-1);
    const event = createModelTrialPreflight({
      manifest,
      evidenceSnapshot: this.modelTrialEvidenceSnapshot(),
      actor,
      sequence: this.state.modelTrialEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString(),
      requestFingerprint: bench.requestFingerprint
    });
    const errors = validateModelTrialPreflight(event, { sequence: event.sequence, previousHash: event.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.modelTrialEvents.push(event);
    await this.persist();
    return { event: clone(event), modelTrial: await this.modelTrialStatus() };
  }

  verifyCandidateTrialSnapshotChain() {
    const events = this.state?.candidateTrialEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateTrialSnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, snapshots: events.length };
      }
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, snapshots: events.length };
  }

  async candidateTrialEvidenceSnapshot() {
    const modelTrial = await this.modelTrialStatus();
    const generationChain = this.verifyGenerationEventChain();
    const clinicalStandardChain = this.verifyClinicalStandardEventChain();
    const caseIds = Object.keys(this.calibrationManifest.cases);
    return {
      modelTrial: {
        status: modelTrial.status,
        metadataComplete: modelTrial.counts.metadataComplete,
        slotsRequired: modelTrial.counts.slotsRequired,
        eventCount: modelTrial.chain.count,
        chainHead: modelTrial.chain.head || "GENESIS"
      },
      caseSet: {
        id: this.calibrationManifest.id,
        version: this.calibrationManifest.version,
        manifestHash: digest(this.calibrationManifest),
        caseIds,
        caseFingerprints: caseIds.map(caseId => digest({
          scoredSource: scoredSourceDigest(this.state.assessments[this.assessmentIndex(caseId)]),
          reference: this.calibrationReferences[caseId],
          manifest: this.calibrationManifest.cases[caseId]
        })),
        syntheticCases: caseIds.length,
        frozen: this.calibrationManifest.status === "frozen-engineering-rehearsal"
      },
      modelInput: {
        contractVersion: MODEL_INPUT_CONTRACT,
        projection: "scoring-only",
        assessmentPayloadIncluded: false,
        recordLevelDataReceived: false,
        phiReceived: false
      },
      generation: {
        outputContract: GENERATION_OUTPUT_CONTRACT,
        policyVersion: GENERATION_POLICY_VERSION,
        policyHash: GENERATION_POLICY_HASH,
        outputGateCount: 10,
        generationRecords: this.state.generationRecords.length,
        chainHead: generationChain.head || "GENESIS",
        externalTransmission: false
      },
      clinicalStandard: {
        draftCount: this.state.clinicalStandardDrafts.length,
        chainHead: clinicalStandardChain.head || "GENESIS",
        accepted: false
      },
      counselorPanel: {
        registered: 0,
        rosterAccepted: false,
        credentialsVerified: false
      },
      candidateTransports: {
        required: 3,
        authorized: 0,
        configured: 0,
        externalCallsPerformed: false
      }
    };
  }

  async candidateTrialStatus() {
    await this.init();
    return buildCandidateTrialFoundry({
      evidenceSnapshot: await this.candidateTrialEvidenceSnapshot(),
      events: this.state.candidateTrialEvents,
      chain: this.verifyCandidateTrialSnapshotChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordCandidateTrialSnapshot(actor = "Demo reviewer") {
    await this.init();
    const foundry = await this.candidateTrialStatus();
    const previous = this.state.candidateTrialEvents.at(-1);
    const event = createCandidateTrialSnapshot({
      foundry,
      actor,
      sequence: this.state.candidateTrialEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      createdAt: this.clock().toISOString()
    });
    const errors = validateCandidateTrialSnapshot(event, { sequence: event.sequence, previousHash: event.previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.candidateTrialEvents.push(event);
    await this.persist();
    return { event: clone(event), candidateTrial: await this.candidateTrialStatus() };
  }

  verifyCandidateReturnEventChain() {
    const events = this.state?.candidateReturnEvents || [];
    const assessments = new Map((this.state?.assessments || []).map(item => [item.id, item]));
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateReturnEvent(event, {
        sequence: index + 1,
        previousHash,
        assessment: assessments.get(event.caseId) || null
      });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, returns: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, returns: events.length };
  }

  async candidateReturnStatus() {
    await this.init();
    const [candidateTrial, modelTrial] = await Promise.all([this.candidateTrialStatus(), this.modelTrialStatus()]);
    return buildCandidateReturnDesk({
      candidateTrial,
      modelTrial,
      events: this.state.candidateReturnEvents,
      chain: this.verifyCandidateReturnEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async candidateReturnRequest() {
    const desk = await this.candidateReturnStatus();
    return clone(desk.requestTemplate);
  }

  async recordCandidateReturns(manifest, actor = "Demo reviewer") {
    await this.init();
    const desk = await this.candidateReturnStatus();
    const assessmentsById = Object.fromEntries(this.state.assessments.map(item => [item.id, item]));
    const errors = validateCandidateReturnManifest(manifest, { desk, assessmentsById });
    if (errors.length) fail(errors.join(" "), 400);
    for (const returnItem of manifest.returns) {
      const existing = this.state.candidateReturnEvents.find(event => event.runId === returnItem.runId
        && event.protocolFingerprint === returnItem.protocolFingerprint
        && event.candidateFingerprint === returnItem.candidateFingerprint);
      if (existing && (existing.bundleHash !== candidateReturnBundleHash(returnItem.bundle)
        || existing.providerId !== returnItem.providerId
        || existing.modelVersion !== returnItem.modelVersion
        || existing.promptVersion !== returnItem.promptVersion)) {
        fail(`The current ${returnItem.runId} envelope already has a different immutable return.`, 409);
      }
    }
    const accepted = [];
    let idempotent = true;
    for (const returnItem of manifest.returns) {
      const bundleHash = candidateReturnBundleHash(returnItem.bundle);
      const existing = this.state.candidateReturnEvents.find(event => event.runId === returnItem.runId
        && event.protocolFingerprint === returnItem.protocolFingerprint
        && event.candidateFingerprint === returnItem.candidateFingerprint);
      if (existing) {
        if (existing.bundleHash !== bundleHash
          || existing.providerId !== returnItem.providerId
          || existing.modelVersion !== returnItem.modelVersion
          || existing.promptVersion !== returnItem.promptVersion) {
          fail(`The current ${returnItem.runId} envelope already has a different immutable return.`, 409);
        }
        accepted.push(existing);
        continue;
      }
      idempotent = false;
      const previousHash = this.state.candidateReturnEvents.at(-1)?.hash || "GENESIS";
      const event = createCandidateReturnEvent({
        returnItem,
        actor,
        sequence: this.state.candidateReturnEvents.length + 1,
        previousHash,
        createdAt: this.clock().toISOString()
      });
      const eventErrors = validateCandidateReturnEvent(event, {
        sequence: event.sequence,
        previousHash,
        assessment: assessmentsById[event.caseId]
      });
      if (eventErrors.length) fail(eventErrors.join(" "), 500);
      this.state.candidateReturnEvents.push(event);
      accepted.push(event);
    }
    if (!idempotent) await this.persist();
    return { events: clone(accepted), idempotent, candidateReturns: await this.candidateReturnStatus() };
  }

  candidateBlindReviewReferenceAssets() {
    const freezeEvent = [...this.state.counselorReferenceDecisionEvents].reverse().find(event => (
      event.eventType === "reference-decision-attestation-verified"
      && event.attestation?.purpose === "reference-protocol-freeze"
      && event.protocolFrozen === true
    ));
    if (!freezeEvent) return {};
    const challengeId = freezeEvent.attestation.challengeId;
    const adjudicationEvent = [...this.state.counselorReferenceDecisionEvents].reverse().find(event => (
      event.eventType === "reference-decision-attestation-verified"
      && event.attestation?.challengeId === challengeId
      && event.attestation?.purpose === "reference-adjudication-decision"
      && event.referenceSetAccepted === true
    ));
    const assets = {};
    for (const decision of adjudicationEvent?.attestation?.decision?.caseDecisions || []) {
      if (decision.disposition !== "accepted-candidate") continue;
      const draft = this.state.counselorReferenceDrafts.find(item => item.assessmentId === decision.assessmentId && item.hash === decision.acceptedReferenceHash);
      if (!draft) continue;
      assets[decision.assessmentId] = {
        summary: draft.summary,
        artifactHash: draft.hash,
        artifactKind: "accepted-counselor-reference"
      };
    }
    return assets;
  }

  candidateBlindReviewArtifacts(candidateTrial, candidateReturns, referenceAssets) {
    const assets = {};
    for (const run of candidateReturns.runs || []) {
      if (!run.currentReturn) continue;
      const event = this.state.candidateReturnEvents.find(item => item.hash === run.currentReturn.hash);
      const clinicianNarrative = event?.bundle?.narratives?.clinician;
      const summary = typeof clinicianNarrative === "string" ? clinicianNarrative : clinicianNarrative?.text;
      if (!event || !summary) continue;
      assets[run.caseId] ||= {};
      assets[run.caseId][run.candidateSlot] = {
        summary,
        artifactHash: event.bundleHash,
        artifactKind: "structured-candidate-return"
      };
    }
    for (const [caseId, reference] of Object.entries(referenceAssets || {})) {
      assets[caseId] ||= {};
      assets[caseId]["counselor-reference"] = clone(reference);
    }
    return assets;
  }

  candidateBlindReviewEvidence({ candidateTrial, candidateReturns, referenceDecision, clinicalStandard }) {
    return {
      candidateReturnChainHead: candidateReturns.chain?.head || "",
      referenceDecisionChainHead: referenceDecision.chain?.head || "",
      clinicalStandardHash: clinicalStandard.latestDraft?.hash || "",
      candidateTrialProtocolFingerprint: candidateTrial.protocolFingerprint || ""
    };
  }

  verifyCandidateBlindReviewEventChain() {
    const events = this.state?.candidateBlindReviewEvents || [];
    const knownArtifactHashes = new Set([
      ...(this.state?.candidateReturnEvents || []).map(event => event.bundleHash),
      ...(this.state?.counselorReferenceDrafts || []).map(event => event.hash)
    ]);
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateBlindReviewEvent(event, {
        sequence: index + 1,
        previousHash,
        knownArtifactHashes
      });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, outcomes: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, outcomes: events.length };
  }

  async candidateBlindReviewContext(actor = "Demo reviewer") {
    const [candidateTrial, candidateReturns, referenceDecision, clinicalStandard] = await Promise.all([
      this.candidateTrialStatus(),
      this.candidateReturnStatus(),
      this.counselorReferenceDecisionStatus(),
      this.clinicalStandardStatus()
    ]);
    const referenceAssets = this.candidateBlindReviewReferenceAssets();
    return {
      candidateTrial,
      candidateReturns,
      referenceDecision,
      clinicalStandard,
      referenceAssets,
      artifacts: this.candidateBlindReviewArtifacts(candidateTrial, candidateReturns, referenceAssets),
      evidence: this.candidateBlindReviewEvidence({ candidateTrial, candidateReturns, referenceDecision, clinicalStandard }),
      actor
    };
  }

  async candidateBlindReviewStatus(actor = "Demo reviewer") {
    await this.init();
    const context = await this.candidateBlindReviewContext(actor);
    return buildCandidateBlindReviewDesk({
      ...context,
      events: this.state.candidateBlindReviewEvents,
      pendingAssignments: this.state.pendingCandidateBlindReviews,
      actor,
      studyActive: this.studyControl().state === "active",
      chain: this.verifyCandidateBlindReviewEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async nextCandidateBlindReview(actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const now = this.clock().toISOString();
    for (const [assignmentId, pending] of Object.entries(this.state.pendingCandidateBlindReviews)) {
      if (Date.parse(pending.expiresAt) < Date.parse(now)) delete this.state.pendingCandidateBlindReviews[assignmentId];
    }
    const context = await this.candidateBlindReviewContext(actor);
    const desk = buildCandidateBlindReviewDesk({
      ...context,
      events: this.state.candidateBlindReviewEvents,
      pendingAssignments: this.state.pendingCandidateBlindReviews,
      actor,
      studyActive: true,
      chain: this.verifyCandidateBlindReviewEventChain(),
      generatedAt: now
    });
    if (!desk.locallyReady) {
      const missing = desk.gates.filter(gate => !gate.satisfied).map(gate => gate.label).join(", ");
      fail(`Candidate blind-review intake remains closed: ${missing}.`, 409);
    }
    const currentEvidence = context.evidence;
    const existing = Object.values(this.state.pendingCandidateBlindReviews).find(item => item.actor === actor);
    if (existing) {
      if (candidateBlindReviewDigest(existing.evidence) !== candidateBlindReviewDigest(currentEvidence) || existing.protocolFingerprint !== context.candidateTrial.protocolFingerprint) {
        delete this.state.pendingCandidateBlindReviews[existing.assignmentId];
      } else {
        return { assignment: publicCandidateBlindReviewAssignment(existing), candidateReview: desk, resumed: true };
      }
    }
    const reviewerCodeHash = candidateBlindReviewDigest(actor);
    const completedForActor = new Set(this.state.candidateBlindReviewEvents.filter(event => event.reviewerCodeHash === reviewerCodeHash).map(event => event.caseId));
    const caseIds = [...new Set((context.candidateTrial.blindCells || []).map(cell => cell.caseId))];
    const eligible = caseIds.filter(caseId => !completedForActor.has(caseId) && Object.keys(context.artifacts[caseId] || {}).length === 4);
    if (!eligible.length) fail("This reviewer code has completed every available candidate-review case. Switch reviewer code or expand the governed case set.", 409);
    const counts = new Map(eligible.map(caseId => [caseId, this.state.candidateBlindReviewEvents.filter(event => event.caseId === caseId).length]));
    eligible.sort((left, right) => counts.get(left) - counts.get(right) || left.localeCompare(right));
    const caseId = eligible[0];
    const assessment = this.state.assessments[this.assessmentIndex(caseId)];
    const reviewerProgress = { completed: completedForActor.size, available: caseIds.length };
    const { pending, packet } = createCandidateBlindReviewAssignment({
      candidateTrial: context.candidateTrial,
      caseId,
      sourceProfile: workflowSourceProfile(assessment),
      artifactsByArm: context.artifacts[caseId],
      evidence: currentEvidence,
      actor,
      reviewerProgress,
      createdAt: now
    });
    this.state.pendingCandidateBlindReviews[pending.assignmentId] = pending;
    await this.persist();
    return { assignment: packet, candidateReview: await this.candidateBlindReviewStatus(actor), resumed: false };
  }

  async submitCandidateBlindReview(input, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const pending = this.state.pendingCandidateBlindReviews[input?.assignmentId];
    if (!pending) fail("Candidate blind-review assignment is missing, expired, or already submitted.", 409);
    const submittedAt = this.clock().toISOString();
    const inputErrors = validateCandidateBlindReviewSubmission(input, pending, actor, submittedAt);
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    const context = await this.candidateBlindReviewContext(actor);
    const desk = buildCandidateBlindReviewDesk({
      ...context,
      events: this.state.candidateBlindReviewEvents,
      pendingAssignments: this.state.pendingCandidateBlindReviews,
      actor,
      studyActive: true,
      chain: this.verifyCandidateBlindReviewEventChain(),
      generatedAt: submittedAt
    });
    if (!desk.locallyReady || candidateBlindReviewDigest(pending.evidence) !== candidateBlindReviewDigest(context.evidence) || pending.protocolFingerprint !== context.candidateTrial.protocolFingerprint) {
      fail("Candidate blind-review evidence changed after assignment. Discard this packet and request a current one.", 409);
    }
    const previousHash = this.state.candidateBlindReviewEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateBlindReviewEvent({
      input,
      pending,
      actor,
      sequence: this.state.candidateBlindReviewEvents.length + 1,
      previousHash,
      createdAt: submittedAt
    });
    const knownArtifactHashes = new Set([
      ...this.state.candidateReturnEvents.map(item => item.bundleHash),
      ...this.state.counselorReferenceDrafts.map(item => item.hash)
    ]);
    const eventErrors = validateCandidateBlindReviewEvent(event, { sequence: event.sequence, previousHash, knownArtifactHashes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.candidateBlindReviewEvents.push(event);
    delete this.state.pendingCandidateBlindReviews[pending.assignmentId];
    await this.persist();
    return {
      receipt: candidateBlindReviewReceipt(event),
      candidateReview: await this.candidateBlindReviewStatus(actor)
    };
  }

  verifyCandidateRefinementCycleChain() {
    const events = this.state?.candidateRefinementEvents || [];
    const knownReviewEventHashes = new Set((this.state?.candidateBlindReviewEvents || []).map(event => event.hash));
    const knownBaselineArtifactHashes = new Set((this.state?.candidateReturnEvents || []).map(event => event.bundleHash));
    const cycleIds = new Set();
    const laneIds = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateRefinementCycleEvent(event, {
        sequence: index + 1,
        previousHash,
        knownReviewEventHashes,
        knownBaselineArtifactHashes
      });
      if (cycleIds.has(event.cycleId) || laneIds.has(event.laneId)) errors.push("Candidate refinement cycle or lane is repeated.");
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, cycles: events.length };
      cycleIds.add(event.cycleId);
      laneIds.add(event.laneId);
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, cycles: events.length };
  }

  async candidateRefinementContext() {
    const context = await this.candidateBlindReviewContext("REFINEMENT-SCOPE");
    const generatedAt = this.clock().toISOString();
    const studyActive = this.studyControl().state === "active";
    const candidateReview = buildCandidateBlindReviewDesk({
      ...context,
      events: this.state.candidateBlindReviewEvents,
      pendingAssignments: this.state.pendingCandidateBlindReviews,
      actor: "REFINEMENT-SCOPE",
      studyActive,
      chain: this.verifyCandidateBlindReviewEventChain(),
      generatedAt
    });
    const caseIds = [...new Set((context.candidateTrial.runEnvelopes || []).map(run => run.caseId))].sort();
    const evidence = {
      candidateReturnChainHead: context.candidateReturns.chain?.head || "",
      referenceDecisionChainHead: context.referenceDecision.chain?.head || "",
      clinicalStandardHash: context.clinicalStandard.latestDraft?.hash || "",
      candidateTrialProtocolFingerprint: context.candidateTrial.protocolFingerprint || ""
    };
    return { ...context, candidateReview, caseIds, evidence, studyActive, generatedAt };
  }

  async candidateRefinementStatus() {
    await this.init();
    const context = await this.candidateRefinementContext();
    return buildCandidateRefinementDesk({
      candidateReview: context.candidateReview,
      reviewEvents: this.state.candidateBlindReviewEvents,
      cycles: this.state.candidateRefinementEvents,
      evidence: context.evidence,
      caseIds: context.caseIds,
      studyActive: context.studyActive,
      chain: this.verifyCandidateRefinementCycleChain(),
      generatedAt: context.generatedAt
    });
  }

  candidateRefinementBaselineByCase(laneId, context) {
    const lane = CANDIDATE_REFINEMENT_LANES.find(item => item.id === laneId);
    if (!lane) return {};
    const baselines = {};
    for (const run of context.candidateReturns.runs || []) {
      if (run.candidateSlot !== lane.candidateSlot || !run.currentReturn?.bundleHash) continue;
      baselines[run.caseId] = {
        caseId: run.caseId,
        caseFingerprint: run.caseFingerprint,
        baselineArtifactHash: run.currentReturn.bundleHash
      };
    }
    return baselines;
  }

  candidateRefinementCycleEvidence(context) {
    return {
      candidateReviewChainHead: context.candidateReview.chain?.head || "",
      candidateReviewDeskFingerprint: context.candidateReview.deskFingerprint || "",
      candidateReturnChainHead: context.evidence.candidateReturnChainHead,
      clinicalStandardHash: context.evidence.clinicalStandardHash,
      candidateTrialProtocolFingerprint: context.evidence.candidateTrialProtocolFingerprint
    };
  }

  async createCandidateRefinementCycle(input, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    if (this.state.candidateRefinementEvents.some(event => event.laneId === input?.laneId)) fail("This anonymous lane already has an open refinement and retest cycle.", 409);
    const context = await this.candidateRefinementContext();
    const desk = buildCandidateRefinementDesk({
      candidateReview: context.candidateReview,
      reviewEvents: this.state.candidateBlindReviewEvents,
      cycles: this.state.candidateRefinementEvents,
      evidence: context.evidence,
      caseIds: context.caseIds,
      studyActive: context.studyActive,
      chain: this.verifyCandidateRefinementCycleChain(),
      generatedAt: context.generatedAt
    });
    if (!desk.locallyReady) {
      const missing = desk.gates.filter(gate => !gate.satisfied).map(gate => gate.label).join(", ");
      fail(`Candidate refinement and retest intake remains closed: ${missing}.`, 409);
    }
    const baselineByCase = this.candidateRefinementBaselineByCase(input?.laneId, context);
    const previousHash = this.state.candidateRefinementEvents.at(-1)?.hash || "GENESIS";
    let event;
    try {
      event = createCandidateRefinementCycle({
        input,
        desk,
        baselineByCase,
        evidence: this.candidateRefinementCycleEvidence(context),
        actor,
        sequence: this.state.candidateRefinementEvents.length + 1,
        previousHash,
        cycleNumber: this.state.candidateRefinementEvents.length + 1,
        createdAt: context.generatedAt
      });
    } catch (error) {
      fail(error.message, 400);
    }
    const errors = validateCandidateRefinementCycleEvent(event, {
      sequence: event.sequence,
      previousHash,
      knownReviewEventHashes: new Set(this.state.candidateBlindReviewEvents.map(item => item.hash)),
      knownBaselineArtifactHashes: new Set(this.state.candidateReturnEvents.map(item => item.bundleHash))
    });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.candidateRefinementEvents.push(event);
    await this.persist();
    return {
      cycle: candidateRefinementCycleReceipt(event),
      candidateRefinement: await this.candidateRefinementStatus()
    };
  }

  async candidateRefinementRetestKit(cycleId) {
    await this.init();
    const event = this.state.candidateRefinementEvents.find(item => item.cycleId === cycleId);
    if (!event) fail("Candidate refinement and retest cycle not found.", 404);
    return candidateRefinementRetestKit(event);
  }

  candidateRetestEnvelopeIndex() {
    const baselines = new Map((this.state?.candidateReturnEvents || []).map(event => [event.bundleHash, event]));
    const index = new Map();
    for (const cycle of this.state?.candidateRefinementEvents || []) {
      for (const envelope of cycle.retestEnvelopes || []) {
        const baseline = baselines.get(envelope.baselineArtifactHash);
        if (baseline) index.set(envelope.envelopeId, { cycle, envelope, baseline });
      }
    }
    return index;
  }

  verifyCandidateRetestReturnChain() {
    const events = this.state?.candidateRetestReturnEvents || [];
    const assessmentsById = new Map((this.state?.assessments || []).map(item => [item.id, item]));
    const knownEnvelopeById = this.candidateRetestEnvelopeIndex();
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateRetestReturnEvent(event, {
        sequence: index + 1,
        previousHash,
        knownEnvelopeById,
        assessment: assessmentsById.get(event.caseId) || null
      });
      if (seen.has(event.envelopeId)) errors.push("Candidate retest envelope has more than one immutable return.");
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, returns: events.length };
      seen.add(event.envelopeId);
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, returns: events.length };
  }

  verifyCandidateRetestReviewChain() {
    const events = this.state?.candidateRetestReviewEvents || [];
    const knownArtifactHashes = new Set([
      ...(this.state?.candidateReturnEvents || []).map(event => event.bundleHash),
      ...(this.state?.candidateRetestReturnEvents || []).map(event => event.bundleHash)
    ]);
    const knownCycleHashes = new Set((this.state?.candidateRefinementEvents || []).map(event => event.hash));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCandidateRetestReviewEvent(event, {
        sequence: index + 1,
        previousHash,
        knownArtifactHashes,
        knownCycleHashes
      });
      const participation = `${event.cycleId}:${event.caseId}:${event.reviewerCodeHash}`;
      if (seen.has(participation)) errors.push("One reviewer code may record only one paired review per cycle and case.");
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, outcomes: events.length };
      seen.add(participation);
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, outcomes: events.length };
  }

  candidateRetestCycle(cycleId) {
    return (this.state?.candidateRefinementEvents || []).find(event => event.cycleId === cycleId) || null;
  }

  candidateRetestBaselineByArtifactHash() {
    return Object.fromEntries((this.state?.candidateReturnEvents || []).map(event => [event.bundleHash, event]));
  }

  async candidateRetestStatus(actor = "Demo reviewer", selectedCycleId = null) {
    await this.init();
    return buildCandidateRetestStudio({
      cycles: this.state.candidateRefinementEvents,
      retestEvents: this.state.candidateRetestReturnEvents,
      reviewEvents: this.state.candidateRetestReviewEvents,
      pendingAssignments: this.state.pendingCandidateRetestReviews,
      actor,
      selectedCycleId,
      studyActive: this.studyControl().state === "active",
      refinementChain: this.verifyCandidateRefinementCycleChain(),
      returnChain: this.verifyCandidateRetestReturnChain(),
      reviewChain: this.verifyCandidateRetestReviewChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async candidateRetestReturnRequest(cycleId) {
    await this.init();
    if (!this.verifyCandidateRefinementCycleChain().valid) fail("Candidate refinement history integrity check failed.", 409);
    const cycle = this.candidateRetestCycle(cycleId);
    if (!cycle) fail("Candidate retest cycle not found.", 404);
    return buildCandidateRetestReturnTemplate({ cycle });
  }

  async recordCandidateRetestReturns(manifest, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    if (!this.verifyCandidateRefinementCycleChain().valid) fail("Candidate refinement history integrity check failed.", 409);
    const cycle = this.candidateRetestCycle(manifest?.cycleId);
    if (!cycle) fail("Candidate retest cycle not found.", 404);
    const baselineByArtifactHash = this.candidateRetestBaselineByArtifactHash();
    const assessmentsById = Object.fromEntries(this.state.assessments.map(item => [item.id, item]));
    const errors = validateCandidateRetestReturnManifest(manifest, { cycle, baselineByArtifactHash, assessmentsById });
    if (errors.length) fail(errors.join(" "), 400);
    const accepted = [];
    let idempotent = true;
    for (const returnItem of manifest.returns) {
      const existing = this.state.candidateRetestReturnEvents.find(event => event.envelopeId === returnItem.envelopeId);
      if (existing) {
        const sameBundle = existing.bundleHash === candidateRetestReturnDigest(returnItem.bundle);
        const sameExecutionReference = existing.executionReferenceHash === candidateRetestReturnDigest(returnItem.executionReference);
        if (!sameBundle || !sameExecutionReference || existing.promptVersion !== returnItem.promptVersion) fail(`The current ${returnItem.envelopeId} already has a different immutable retest return.`, 409);
        accepted.push(existing);
        continue;
      }
      idempotent = false;
      const baseline = baselineByArtifactHash[returnItem.baselineArtifactHash];
      const previousHash = this.state.candidateRetestReturnEvents.at(-1)?.hash || "GENESIS";
      let event;
      try {
        event = createCandidateRetestReturnEvent({
          returnItem,
          cycle,
          baseline,
          actor,
          sequence: this.state.candidateRetestReturnEvents.length + 1,
          previousHash,
          createdAt: this.clock().toISOString()
        });
      } catch (error) {
        fail(error.message, 400);
      }
      const eventErrors = validateCandidateRetestReturnEvent(event, {
        sequence: event.sequence,
        previousHash,
        knownEnvelopeById: this.candidateRetestEnvelopeIndex(),
        assessment: assessmentsById[event.caseId]
      });
      if (eventErrors.length) fail(eventErrors.join(" "), 500);
      this.state.candidateRetestReturnEvents.push(event);
      accepted.push(event);
    }
    if (!idempotent) await this.persist();
    return {
      receipts: accepted.map(event => candidateRetestReturnReceipt(event)),
      idempotent,
      candidateRetest: await this.candidateRetestStatus(actor, cycle.cycleId)
    };
  }

  candidateRetestArtifacts(cycle, caseId) {
    const envelope = cycle?.retestEnvelopes?.find(item => item.caseId === caseId);
    if (!envelope) return null;
    const baseline = this.state.candidateReturnEvents.find(event => event.bundleHash === envelope.baselineArtifactHash);
    const retest = this.state.candidateRetestReturnEvents.find(event => event.envelopeId === envelope.envelopeId && event.cycleId === cycle.cycleId);
    const baselineNarrative = baseline?.bundle?.narratives?.clinician;
    const retestNarrative = retest?.bundle?.narratives?.clinician;
    const baselineSummary = typeof baselineNarrative === "string" ? baselineNarrative : baselineNarrative?.text;
    const retestSummary = typeof retestNarrative === "string" ? retestNarrative : retestNarrative?.text;
    if (!baselineSummary || !retestSummary) return null;
    return {
      baseline: { summary: baselineSummary, artifactHash: baseline.bundleHash, artifactKind: "sealed-cycle-baseline" },
      retest: { summary: retestSummary, artifactHash: retest.bundleHash, artifactKind: "sealed-same-case-retest" }
    };
  }

  async nextCandidateRetestReview(cycleId, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const now = this.clock().toISOString();
    for (const [assignmentId, pending] of Object.entries(this.state.pendingCandidateRetestReviews)) {
      if (Date.parse(pending.expiresAt) < Date.parse(now)) delete this.state.pendingCandidateRetestReviews[assignmentId];
    }
    const cycle = this.candidateRetestCycle(cycleId);
    if (!cycle) fail("Candidate retest cycle not found.", 404);
    const studio = await this.candidateRetestStatus(actor, cycleId);
    if (!studio.packetIssuanceEnabled) {
      const missing = studio.gates.filter(gate => !gate.satisfied && gate.id !== "independent-overlap").map(gate => gate.label).join(", ");
      fail(`Candidate retest re-review intake remains closed${missing ? `: ${missing}` : " for this reviewer code"}.`, 409);
    }
    const evidence = candidateRetestReviewEvidence({
      cycle,
      refinementChain: this.verifyCandidateRefinementCycleChain(),
      returnChain: this.verifyCandidateRetestReturnChain(),
      retestEvents: this.state.candidateRetestReturnEvents
    });
    const existing = Object.values(this.state.pendingCandidateRetestReviews).find(item => item.actor === actor);
    if (existing) {
      if (existing.cycleId !== cycleId || candidateRetestReviewDigest(existing.evidence) !== candidateRetestReviewDigest(evidence)) delete this.state.pendingCandidateRetestReviews[existing.assignmentId];
      else return { assignment: publicCandidateRetestReviewAssignment(existing), candidateRetest: studio, resumed: true };
    }
    const reviewerCodeHash = candidateRetestReviewDigest(actor);
    const completedForActor = new Set(this.state.candidateRetestReviewEvents.filter(event => event.cycleId === cycleId && event.reviewerCodeHash === reviewerCodeHash).map(event => event.caseId));
    const caseIds = cycle.retestEnvelopes.map(envelope => envelope.caseId);
    const eligible = caseIds.filter(caseId => !completedForActor.has(caseId) && this.candidateRetestArtifacts(cycle, caseId));
    if (!eligible.length) fail("This reviewer code has completed every available same-case packet for the selected cycle.", 409);
    const counts = new Map(eligible.map(caseId => [caseId, this.state.candidateRetestReviewEvents.filter(event => event.cycleId === cycleId && event.caseId === caseId).length]));
    eligible.sort((left, right) => counts.get(left) - counts.get(right) || left.localeCompare(right));
    const caseId = eligible[0];
    const artifacts = this.candidateRetestArtifacts(cycle, caseId);
    const assessment = this.state.assessments[this.assessmentIndex(caseId)];
    const reviewerProgress = { completed: completedForActor.size, available: caseIds.length };
    const mappingOrientation = counts.get(caseId) % 2 === 0 ? "baseline-first" : "retest-first";
    const { pending, packet } = createCandidateRetestReviewAssignment({
      cycle,
      caseId,
      sourceProfile: workflowSourceProfile(assessment),
      baselineArtifact: artifacts.baseline,
      retestArtifact: artifacts.retest,
      evidence,
      actor,
      reviewerProgress,
      mappingOrientation,
      createdAt: now
    });
    this.state.pendingCandidateRetestReviews[pending.assignmentId] = pending;
    await this.persist();
    return { assignment: packet, candidateRetest: await this.candidateRetestStatus(actor, cycleId), resumed: false };
  }

  async submitCandidateRetestReview(input, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const pending = this.state.pendingCandidateRetestReviews[input?.assignmentId];
    if (!pending) fail("Candidate retest re-review assignment is missing, expired, or already submitted.", 409);
    const submittedAt = this.clock().toISOString();
    const inputErrors = validateCandidateRetestReviewSubmission(input, pending, actor, submittedAt);
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    const cycle = this.candidateRetestCycle(pending.cycleId);
    if (!cycle) fail("Candidate retest cycle no longer resolves.", 409);
    const evidence = candidateRetestReviewEvidence({
      cycle,
      refinementChain: this.verifyCandidateRefinementCycleChain(),
      returnChain: this.verifyCandidateRetestReturnChain(),
      retestEvents: this.state.candidateRetestReturnEvents
    });
    if (candidateRetestReviewDigest(pending.evidence) !== candidateRetestReviewDigest(evidence)) fail("Candidate retest evidence changed after assignment. Discard this packet and request a current one.", 409);
    const previousHash = this.state.candidateRetestReviewEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateRetestReviewEvent({
      input,
      pending,
      actor,
      sequence: this.state.candidateRetestReviewEvents.length + 1,
      previousHash,
      createdAt: submittedAt
    });
    const knownArtifactHashes = new Set([
      ...this.state.candidateReturnEvents.map(item => item.bundleHash),
      ...this.state.candidateRetestReturnEvents.map(item => item.bundleHash)
    ]);
    const eventErrors = validateCandidateRetestReviewEvent(event, {
      sequence: event.sequence,
      previousHash,
      knownArtifactHashes,
      knownCycleHashes: new Set(this.state.candidateRefinementEvents.map(item => item.hash))
    });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.candidateRetestReviewEvents.push(event);
    delete this.state.pendingCandidateRetestReviews[pending.assignmentId];
    await this.persist();
    return {
      receipt: candidateRetestReviewReceipt(event),
      candidateRetest: await this.candidateRetestStatus(actor, cycle.cycleId)
    };
  }

  verifyCandidateRetestDispositionChain() {
    const events = this.state?.candidateRetestDispositionEvents || [];
    const challenges = new Map();
    const attestations = new Map();
    const seenAttestationIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "candidate-retest-disposition-challenge-issued" ? event.challenge?.challengeId : event.attestation?.challengeId;
      const challenge = event.eventType === "candidate-retest-disposition-attestation-verified" ? challenges.get(challengeId) : null;
      const priorAttestations = attestations.get(challengeId) || new Map();
      const seenPurposes = new Set(priorAttestations.keys());
      const errors = validateCandidateRetestDispositionEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.candidateRetestDispositionRegistry,
        challenge,
        priorAttestations,
        now: event.createdAt,
        seenAttestationIds,
        seenSignatureHashes,
        seenPurposes
      });
      if (event.eventType === "candidate-retest-disposition-attestation-verified" && !challenge) errors.push("Verified candidate retest disposition attestation has no prior challenge event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "candidate-retest-disposition-challenge-issued").length,
        verifiedAttestations: events.filter(item => item.eventType === "candidate-retest-disposition-attestation-verified").length
      };
      if (event.eventType === "candidate-retest-disposition-challenge-issued") {
        challenges.set(event.challenge.challengeId, event.challenge);
        attestations.set(event.challenge.challengeId, new Map());
      } else {
        priorAttestations.set(event.attestation.purpose, event.attestation);
        seenAttestationIds.add(event.attestation.attestationId);
        seenSignatureHashes.add(candidateRetestDispositionDigest(event.attestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "candidate-retest-disposition-challenge-issued").length,
      verifiedAttestations: events.filter(item => item.eventType === "candidate-retest-disposition-attestation-verified").length
    };
  }

  candidateRetestDispositionAnalysis(cycleId) {
    return candidateRetestDispositionAnalysis({ cycleId, reviewEvents: this.state?.candidateRetestReviewEvents || [] });
  }

  async candidateRetestDispositionStatus(actor = "Demo reviewer", cycleId = null) {
    await this.init();
    const candidateRetest = await this.candidateRetestStatus(actor, cycleId);
    const selectedCycleId = cycleId || candidateRetest.selectedCycleId;
    const [admission] = await Promise.all([this.independentReviewAdmissionStatus()]);
    return buildCandidateRetestDispositionDocket({
      candidateRetest,
      cycleId: selectedCycleId,
      analysis: this.candidateRetestDispositionAnalysis(selectedCycleId),
      admission,
      registry: this.candidateRetestDispositionRegistry,
      events: this.state.candidateRetestDispositionEvents,
      chain: this.verifyCandidateRetestDispositionChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueCandidateRetestDispositionChallenge(cycleId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeCandidateRetestDispositionRegistry(this.candidateRetestDispositionRegistry, createdAt);
    const everyDutyCurrent = registrySummary.registryCurrent && Object.values(registrySummary.activePurposeCounts).every(count => count === 1);
    if (!everyDutyCurrent || registrySummary.activeKeyCount < 4) fail("Provision four current, distinct candidate retest disposition keys in an owner-only startup registry before issuing a challenge.", 409);
    const candidateRetest = await this.candidateRetestStatus(actor, cycleId);
    const selectedCycleId = cycleId || candidateRetest.selectedCycleId;
    const analysis = this.candidateRetestDispositionAnalysis(selectedCycleId);
    const admission = await this.independentReviewAdmissionStatus();
    const docket = buildCandidateRetestDispositionDocket({ candidateRetest, cycleId: selectedCycleId, analysis, admission, registry: this.candidateRetestDispositionRegistry, events: this.state.candidateRetestDispositionEvents, chain: this.verifyCandidateRetestDispositionChain(), generatedAt: createdAt });
    if (!docket.prerequisites.localPairedEvidenceCurrent) fail("Complete the exact two-reviewer, three-case Same-Case Retest evidence before issuing an independent disposition challenge.", 409);
    if (!docket.prerequisites.independentProtocolCurrent) fail("Admit the current independently signed evaluation protocol before issuing a result challenge.", 409);
    const active = this.state.candidateRetestDispositionEvents.findLast(event => event.eventType === "candidate-retest-disposition-challenge-issued" && event.challenge.dispositionPackageHash === docket.evidence.dispositionPackageHash && event.challenge.registryFingerprint === registrySummary.registryFingerprint && Date.parse(createdAt) <= Date.parse(event.challenge.expiresAt));
    if (active) return { created: false, challenge: clone(active.challenge), event: clone(active), candidateRetestDisposition: await this.candidateRetestDispositionStatus(actor, selectedCycleId) };
    const previousHash = this.state.candidateRetestDispositionEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateRetestDispositionChallenge({ candidateRetest, cycleId: selectedCycleId, analysis, admission, registry: this.candidateRetestDispositionRegistry, actor, sequence: this.state.candidateRetestDispositionEvents.length + 1, previousHash, createdAt });
    const errors = validateCandidateRetestDispositionEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.candidateRetestDispositionEvents.push(event);
    await this.persist();
    return { created: true, challenge: clone(event.challenge), event: clone(event), candidateRetestDisposition: await this.candidateRetestDispositionStatus(actor, selectedCycleId) };
  }

  async candidateRetestDispositionChallenge(challengeId) {
    await this.init();
    const event = this.state.candidateRetestDispositionEvents.find(item => item.eventType === "candidate-retest-disposition-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) fail("Candidate retest disposition challenge was not found.", 404);
    return clone(event.challenge);
  }

  async verifyCandidateRetestDispositionAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.candidateRetestDispositionEvents.find(event => event.eventType === "candidate-retest-disposition-challenge-issued" && event.challenge.challengeId === attestation?.challengeId);
    if (!challengeEvent) fail("Candidate retest disposition attestation does not reference an issued challenge.", 400);
    const candidateRetest = await this.candidateRetestStatus(actor, challengeEvent.challenge.cycleId);
    const analysis = this.candidateRetestDispositionAnalysis(challengeEvent.challenge.cycleId);
    const admission = await this.independentReviewAdmissionStatus();
    const challengeErrors = validateCandidateRetestDispositionChallenge(challengeEvent.challenge, { candidateRetest, cycleId: challengeEvent.challenge.cycleId, analysis, admission, registryFingerprint: candidateRetestDispositionRegistryFingerprint(this.candidateRetestDispositionRegistry) });
    if (Date.parse(verifiedAt) > Date.parse(challengeEvent.challenge.expiresAt)) challengeErrors.push("Candidate retest disposition challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const priorEvents = this.state.candidateRetestDispositionEvents.filter(event => event.eventType === "candidate-retest-disposition-attestation-verified" && event.attestation.challengeId === challengeEvent.challenge.challengeId);
    const priorAttestations = new Map(priorEvents.map(event => [event.attestation.purpose, event.attestation]));
    const seenAttestationIds = new Set(this.state.candidateRetestDispositionEvents.filter(event => event.eventType === "candidate-retest-disposition-attestation-verified").map(event => event.attestation.attestationId));
    const seenSignatureHashes = new Set(this.state.candidateRetestDispositionEvents.filter(event => event.eventType === "candidate-retest-disposition-attestation-verified").map(event => candidateRetestDispositionDigest(event.attestation.signature.value)));
    const seenPurposes = new Set(priorAttestations.keys());
    const attestationErrors = validateCandidateRetestDispositionAttestation(attestation, { challenge: challengeEvent.challenge, registry: this.candidateRetestDispositionRegistry, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (attestationErrors.length) fail(attestationErrors.join(" "), 400);
    const previousHash = this.state.candidateRetestDispositionEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateRetestDispositionAttestationEvent({ attestation, registry: this.candidateRetestDispositionRegistry, actor, sequence: this.state.candidateRetestDispositionEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateCandidateRetestDispositionEvent(event, { sequence: event.sequence, previousHash, registry: this.candidateRetestDispositionRegistry, challenge: challengeEvent.challenge, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.candidateRetestDispositionEvents.push(event);
    await this.persist();
    return { event: clone(event), candidateRetestDisposition: await this.candidateRetestDispositionStatus(actor, challengeEvent.challenge.cycleId) };
  }

  verifyCandidateAdvancementChain() {
    const events = this.state?.candidateAdvancementEvents || [];
    const challenges = new Map();
    const attestations = new Map();
    const seenAttestationIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeEvent = event.eventType?.endsWith("challenge-issued");
      const challengeId = challengeEvent ? event.challenge?.challengeId : event.attestation?.challengeId;
      const challenge = challengeEvent ? null : challenges.get(challengeId);
      const priorAttestations = attestations.get(challengeId) || new Map();
      const errors = validateCandidateAdvancementEvent(event, {
        sequence: index + 1,
        previousHash,
        cycleActionRegistry: this.candidateCycleActionRegistry,
        candidateAdvancementRegistry: this.candidateAdvancementRegistry,
        challenge,
        priorAttestations,
        now: event.createdAt,
        seenAttestationIds,
        seenSignatureHashes,
        seenPurposes: new Set(priorAttestations.keys())
      });
      if (!challengeEvent && !challenge) errors.push("Verified candidate advancement attestation has no prior challenge event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        cycleActionChallenges: events.filter(item => item.eventType === "candidate-cycle-action-challenge-issued").length,
        candidateAdvancementChallenges: events.filter(item => item.eventType === "candidate-advancement-challenge-issued").length,
        verifiedAttestations: events.filter(item => item.eventType?.endsWith("attestation-verified")).length
      };
      if (challengeEvent) {
        challenges.set(event.challenge.challengeId, event.challenge);
        attestations.set(event.challenge.challengeId, new Map());
      } else {
        priorAttestations.set(event.attestation.purpose, event.attestation);
        seenAttestationIds.add(event.attestation.attestationId);
        seenSignatureHashes.add(candidateAdvancementDigest(event.attestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      cycleActionChallenges: events.filter(item => item.eventType === "candidate-cycle-action-challenge-issued").length,
      candidateAdvancementChallenges: events.filter(item => item.eventType === "candidate-advancement-challenge-issued").length,
      verifiedAttestations: events.filter(item => item.eventType?.endsWith("attestation-verified")).length
    };
  }

  candidateAdvancementUpstream(cycleId) {
    const cycle = this.candidateRetestCycle(cycleId);
    if (!cycle) return null;
    const challenges = new Map((this.state?.candidateRetestDispositionEvents || [])
      .filter(event => event.eventType === "candidate-retest-disposition-challenge-issued")
      .map(event => [event.challenge.challengeId, event.challenge]));
    const resultEvent = [...(this.state?.candidateRetestDispositionEvents || [])].reverse().find(event => {
      if (event.eventType !== "candidate-retest-disposition-attestation-verified" || event.attestation?.purpose !== "independent-result-freeze") return false;
      return challenges.get(event.attestation.challengeId)?.cycleId === cycleId;
    });
    const challenge = resultEvent ? challenges.get(resultEvent.attestation.challengeId) : null;
    if (!resultEvent || !challenge) return {
      cycleId,
      cycleEventHash: cycle.hash,
      independentResultFrozen: false
    };
    return {
      cycleId,
      cycleEventHash: cycle.hash,
      dispositionPackageHash: resultEvent.attestation.decision.frozenDispositionPackageHash,
      independentResultAttestationFingerprint: resultEvent.attestationFingerprint,
      independentResultEventHash: resultEvent.hash,
      candidateRetestDispositionChainHead: this.verifyCandidateRetestDispositionChain().head,
      cycleCloseRecommendation: resultEvent.attestation.decision.cycleCloseRecommendation,
      candidateRecommendation: resultEvent.attestation.decision.candidateRecommendation,
      independentResultFrozen: true
    };
  }

  candidateAdvancementIdentity(cycleId) {
    const cycle = this.candidateRetestCycle(cycleId);
    const lane = CANDIDATE_REFINEMENT_LANES.find(item => item.id === cycle?.laneId);
    const retestEvents = (this.state?.candidateRetestReturnEvents || []).filter(event => event.cycleId === cycleId);
    if (!cycle || !lane || retestEvents.length !== cycle.retestEnvelopes.length || retestEvents.length !== 3) return null;
    const uniformFields = ["candidateFingerprint", "providerId", "modelVersion", "promptVersion", "outputContract", "policyVersion", "policyHash", "retestProtocolFingerprint"];
    if (uniformFields.some(key => new Set(retestEvents.map(event => event[key])).size !== 1 || !retestEvents[0]?.[key])) return null;
    const modelTrialEvent = this.state.modelTrialEvents.at(-1);
    const candidateIndex = ["candidate-01", "candidate-02", "candidate-03"].indexOf(lane.candidateSlot);
    const snapshot = modelTrialEvent?.candidateSnapshots?.[candidateIndex];
    const result = modelTrialEvent?.candidateResults?.[candidateIndex];
    if (!snapshot || !result?.candidateFingerprint || result.candidateFingerprint !== retestEvents[0].candidateFingerprint) return null;
    const modelTrialChain = this.verifyModelTrialPreflightChain();
    const candidateTrialChain = this.verifyCandidateTrialSnapshotChain();
    const candidateReturnChain = this.verifyCandidateReturnEventChain();
    const candidateRetestReturnChain = this.verifyCandidateRetestReturnChain();
    const candidateTrialProtocolFingerprint = cycle.evidence?.candidateTrialProtocolFingerprint || this.state.candidateTrialEvents.at(-1)?.protocolFingerprint || null;
    return {
      laneId: lane.id,
      candidateSlot: lane.candidateSlot,
      candidateFingerprint: retestEvents[0].candidateFingerprint,
      providerId: retestEvents[0].providerId,
      modelVersion: retestEvents[0].modelVersion,
      promptVersion: retestEvents[0].promptVersion,
      outputContract: retestEvents[0].outputContract,
      policyVersion: retestEvents[0].policyVersion,
      policyHash: retestEvents[0].policyHash,
      retestProtocolFingerprint: retestEvents[0].retestProtocolFingerprint,
      hostingPattern: snapshot.hostingPattern,
      region: snapshot.region,
      domainEvidenceFingerprint: candidateAdvancementDigest(snapshot.domainEvidence),
      modelTrialChainHead: modelTrialChain.head,
      candidateTrialChainHead: candidateTrialChain.head,
      candidateTrialProtocolFingerprint,
      candidateReturnChainHead: candidateReturnChain.head,
      candidateRetestReturnChainHead: candidateRetestReturnChain.head
    };
  }

  candidateAdvancementCycleFreeze(cycleId) {
    const challengeIds = new Set((this.state?.candidateAdvancementEvents || [])
      .filter(event => event.eventType === "candidate-cycle-action-challenge-issued" && event.challenge.cycleId === cycleId)
      .map(event => event.challenge.challengeId));
    const event = [...(this.state?.candidateAdvancementEvents || [])].reverse().find(item => item.eventType === "candidate-cycle-action-attestation-verified"
      && item.attestation?.purpose === "evaluation-custody-confirmation"
      && item.attestation?.decision?.cycleAction === "close-this-refinement-cycle"
      && challengeIds.has(item.attestation.challengeId));
    return event ? { attestationFingerprint: event.attestationFingerprint, eventHash: event.hash } : null;
  }

  async candidateAdvancementStatus(actor = "Demo reviewer", cycleId = null) {
    await this.init();
    const candidateRetest = await this.candidateRetestStatus(actor, cycleId);
    const selectedCycleId = cycleId || candidateRetest.selectedCycleId;
    return buildCandidateAdvancementAirlock({
      upstream: this.candidateAdvancementUpstream(selectedCycleId),
      candidateIdentity: this.candidateAdvancementIdentity(selectedCycleId),
      cycleActionRegistry: this.candidateCycleActionRegistry,
      candidateAdvancementRegistry: this.candidateAdvancementRegistry,
      events: this.state.candidateAdvancementEvents,
      chain: this.verifyCandidateAdvancementChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueCandidateCycleActionChallenge(cycleId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registry = summarizeCandidateCycleActionRegistry(this.candidateCycleActionRegistry, createdAt);
    if (!registry.registryCurrent || registry.activeKeyCount < 2 || Object.values(registry.activePurposeCounts).some(count => count !== 1)) fail("Provision two current, distinct cycle-action keys in an owner-only startup registry before issuing a challenge.", 409);
    const upstream = this.candidateAdvancementUpstream(cycleId);
    if (upstream?.independentResultFrozen !== true) fail("Freeze the independent result for this exact synthetic cycle before issuing a cycle-action challenge.", 409);
    const airlock = await this.candidateAdvancementStatus(actor, cycleId);
    if (airlock.cycleActionFrozen) fail("The exact cycle action is already frozen and cannot be replaced.", 409);
    const active = this.state.candidateAdvancementEvents.findLast(event => event.eventType === "candidate-cycle-action-challenge-issued"
      && event.challenge.cycleActionPackageHash === airlock.evidence.cycleAction.cycleActionPackageHash
      && event.challenge.registryFingerprint === registry.registryFingerprint
      && Date.parse(createdAt) <= Date.parse(event.challenge.expiresAt));
    if (active) return { created: false, challenge: clone(active.challenge), event: clone(active), candidateAdvancement: await this.candidateAdvancementStatus(actor, cycleId) };
    const previousHash = this.state.candidateAdvancementEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateCycleActionChallenge({ upstream, registry: this.candidateCycleActionRegistry, actor, sequence: this.state.candidateAdvancementEvents.length + 1, previousHash, createdAt });
    const errors = validateCandidateAdvancementEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.candidateAdvancementEvents.push(event);
    await this.persist();
    return { created: true, challenge: clone(event.challenge), event: clone(event), candidateAdvancement: await this.candidateAdvancementStatus(actor, cycleId) };
  }

  async issueCandidateAdvancementChallenge(cycleId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registry = summarizeCandidateAdvancementRegistry(this.candidateAdvancementRegistry, createdAt);
    if (!registry.registryCurrent || registry.activeKeyCount < 4 || Object.values(registry.activePurposeCounts).some(count => count !== 1)) fail("Provision four current, distinct candidate-advancement keys in an owner-only startup registry before issuing a challenge.", 409);
    const upstream = this.candidateAdvancementUpstream(cycleId);
    const candidateIdentity = this.candidateAdvancementIdentity(cycleId);
    const cycleActionFreeze = this.candidateAdvancementCycleFreeze(cycleId);
    const airlock = await this.candidateAdvancementStatus(actor, cycleId);
    if (!airlock.prerequisites.candidateEligible || !cycleActionFreeze || !candidateIdentity) fail("A separately frozen cycle close, upstream advancement recommendation, and exact current candidate identity are required before Room II can open.", 409);
    if (airlock.candidateAdvancementFrozen) fail("The exact candidate advancement decision is already frozen and cannot be replaced.", 409);
    const active = this.state.candidateAdvancementEvents.findLast(event => event.eventType === "candidate-advancement-challenge-issued"
      && event.challenge.candidatePackageHash === airlock.evidence.candidate.candidatePackageHash
      && event.challenge.registryFingerprint === registry.registryFingerprint
      && Date.parse(createdAt) <= Date.parse(event.challenge.expiresAt));
    if (active) return { created: false, challenge: clone(active.challenge), event: clone(active), candidateAdvancement: await this.candidateAdvancementStatus(actor, cycleId) };
    const previousHash = this.state.candidateAdvancementEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateAdvancementChallenge({ upstream, cycleActionFreeze, candidateIdentity, registry: this.candidateAdvancementRegistry, actor, sequence: this.state.candidateAdvancementEvents.length + 1, previousHash, createdAt });
    const errors = validateCandidateAdvancementEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.candidateAdvancementEvents.push(event);
    await this.persist();
    return { created: true, challenge: clone(event.challenge), event: clone(event), candidateAdvancement: await this.candidateAdvancementStatus(actor, cycleId) };
  }

  async candidateAdvancementChallenge(challengeId) {
    await this.init();
    const event = this.state.candidateAdvancementEvents.find(item => item.eventType?.endsWith("challenge-issued") && item.challenge.challengeId === challengeId);
    if (!event) fail("Candidate advancement airlock challenge was not found.", 404);
    return clone(event.challenge);
  }

  async verifyCandidateAdvancementAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.candidateAdvancementEvents.find(event => event.eventType?.endsWith("challenge-issued") && event.challenge.challengeId === attestation?.challengeId);
    if (!challengeEvent) fail("Candidate advancement attestation does not reference an issued challenge.", 400);
    const challenge = challengeEvent.challenge;
    const upstream = this.candidateAdvancementUpstream(challenge.cycleId);
    const cycleActionFreeze = challenge.room === "candidate-advancement" ? this.candidateAdvancementCycleFreeze(challenge.cycleId) : null;
    const candidateIdentity = challenge.room === "candidate-advancement" ? this.candidateAdvancementIdentity(challenge.cycleId) : null;
    const registry = challenge.room === "cycle-action" ? this.candidateCycleActionRegistry : this.candidateAdvancementRegistry;
    const registryFingerprint = challenge.room === "cycle-action" ? candidateCycleActionRegistryFingerprint(registry) : candidateAdvancementRegistryFingerprint(registry);
    const challengeErrors = validateCandidateAdvancementChallenge(challenge, { upstream, cycleActionFreeze, candidateIdentity, registryFingerprint });
    if (Date.parse(verifiedAt) > Date.parse(challenge.expiresAt)) challengeErrors.push("Candidate advancement challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const priorEvents = this.state.candidateAdvancementEvents.filter(event => event.eventType?.endsWith("attestation-verified") && event.attestation.challengeId === challenge.challengeId);
    const priorAttestations = new Map(priorEvents.map(event => [event.attestation.purpose, event.attestation]));
    const seenAttestationIds = new Set(this.state.candidateAdvancementEvents.filter(event => event.eventType?.endsWith("attestation-verified")).map(event => event.attestation.attestationId));
    const seenSignatureHashes = new Set(this.state.candidateAdvancementEvents.filter(event => event.eventType?.endsWith("attestation-verified")).map(event => candidateAdvancementDigest(event.attestation.signature.value)));
    const seenPurposes = new Set(priorAttestations.keys());
    const attestationErrors = validateCandidateAdvancementAttestation(attestation, { challenge, registry, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (attestationErrors.length) fail(attestationErrors.join(" "), 400);
    const previousHash = this.state.candidateAdvancementEvents.at(-1)?.hash || "GENESIS";
    const event = createCandidateAdvancementAttestationEvent({ attestation, challenge, registry, actor, sequence: this.state.candidateAdvancementEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateCandidateAdvancementEvent(event, { sequence: event.sequence, previousHash, cycleActionRegistry: this.candidateCycleActionRegistry, candidateAdvancementRegistry: this.candidateAdvancementRegistry, challenge, priorAttestations, now: verifiedAt, seenAttestationIds, seenSignatureHashes, seenPurposes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.candidateAdvancementEvents.push(event);
    await this.persist();
    return { event: clone(event), candidateAdvancement: await this.candidateAdvancementStatus(actor, challenge.cycleId) };
  }

  verifyIntendedUseEventChain() {
    const drafts = this.state?.intendedUseDrafts || [];
    const events = this.state?.intendedUseEvents || [];
    const byId = new Map(drafts.map(draft => [draft.id, draft]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const draft = byId.get(event.draftId);
      const draftErrors = draft ? validateIntendedUseDraft(draft) : ["Draft missing."];
      const eventErrors = validateIntendedUseEvent(event, { sequence: index + 1, previousHash, draft });
      const valid = draft
        && !seen.has(draft.id)
        && draft.version === index + 1
        && draftErrors.length === 0
        && eventErrors.length === 0;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, drafts: drafts.length };
      seen.add(draft.id);
      previousHash = event.hash;
    }
    const valid = seen.size === drafts.length && drafts.every((draft, index) => draft.version === index + 1);
    return { valid, count: events.length, failedAt: valid ? null : events.length + 1, head: events.at(-1)?.hash || null, drafts: drafts.length };
  }

  intendedUseEvidenceSnapshot() {
    return {
      reportContract: REPORT_CONTRACT.format,
      disclaimerVersion: REPORT_CONTRACT.disclaimerVersion,
      modelInputContract: MODEL_INPUT_CONTRACT,
      generationPolicyVersion: GENERATION_POLICY_VERSION,
      generationPolicyHash: GENERATION_POLICY_HASH,
      audienceFormatCount: 4,
      chainHeads: {
        reportArtifacts: this.verifyReportArtifactChain().head || "GENESIS",
        generationSnapshots: this.verifyGenerationEventChain().head || "GENESIS",
        pilotReadiness: this.verifyReadinessEventChain().head || "GENESIS",
        clinicalStandard: this.verifyClinicalStandardEventChain().head || "GENESIS"
      }
    };
  }

  async intendedUseStatus() {
    await this.init();
    return buildIntendedUseStatus({
      drafts: this.state.intendedUseDrafts,
      chain: this.verifyIntendedUseEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordIntendedUseDraft(input, actor = "Demo reviewer") {
    await this.init();
    const draft = createIntendedUseDraft({
      input,
      actor,
      version: this.state.intendedUseDrafts.length + 1,
      evidenceSnapshot: this.intendedUseEvidenceSnapshot(),
      createdAt: this.clock().toISOString()
    });
    const draftErrors = validateIntendedUseDraft(draft);
    if (draftErrors.length) fail(draftErrors.join(" "), 400);
    const previousHash = this.state.intendedUseEvents.at(-1)?.hash || "GENESIS";
    const event = createIntendedUseEvent({
      draft,
      sequence: this.state.intendedUseEvents.length + 1,
      previousHash,
      createdAt: draft.createdAt
    });
    const eventErrors = validateIntendedUseEvent(event, { sequence: event.sequence, previousHash, draft });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.intendedUseDrafts.push(draft);
    this.state.intendedUseEvents.push(event);
    await this.persist();
    return { event: clone(event), draft: clone(draft), intendedUse: await this.intendedUseStatus() };
  }

  verifyLanguageReviewEventChain() {
    const packets = this.state?.languageReviewPackets || [];
    const events = this.state?.languageReviewEvents || [];
    const byId = new Map(packets.map(packet => [packet.id, packet]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const packet = byId.get(event.packetId);
      const packetErrors = packet ? validateLanguageReviewPacket(packet) : ["Packet missing."];
      const eventErrors = validateLanguageReviewEvent(event, { sequence: index + 1, previousHash, packet });
      const valid = packet
        && !seen.has(packet.id)
        && packet.version === index + 1
        && packetErrors.length === 0
        && eventErrors.length === 0;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, packets: packets.length };
      seen.add(packet.id);
      previousHash = event.hash;
    }
    const valid = seen.size === packets.length && packets.every((packet, index) => packet.version === index + 1);
    return { valid, count: events.length, failedAt: valid ? null : events.length + 1, head: events.at(-1)?.hash || null, packets: packets.length };
  }

  languageReviewEvidenceSnapshot() {
    const intendedUseDraft = this.state.intendedUseDrafts.at(-1) || null;
    return {
      reportContract: REPORT_CONTRACT.format,
      disclaimerVersion: REPORT_CONTRACT.disclaimerVersion,
      audienceContract: AUDIENCE_HANDOFF_CONTRACT.format,
      intendedUseContract: INTENDED_USE_CONTRACT,
      intendedUseDraftHash: intendedUseDraft?.hash || "GENESIS",
      reportArtifactHead: this.verifyReportArtifactChain().head || "GENESIS"
    };
  }

  async languageReviewStatus() {
    await this.init();
    return buildLanguageReviewOffice({
      intendedUseDraft: this.state.intendedUseDrafts.at(-1) || null,
      packets: this.state.languageReviewPackets,
      chain: this.verifyLanguageReviewEventChain(),
      evidenceSnapshot: this.languageReviewEvidenceSnapshot(),
      generatedAt: this.clock().toISOString()
    });
  }

  async sealLanguageReviewPacket(actor = "Demo reviewer") {
    await this.init();
    const intendedUseDraft = this.state.intendedUseDrafts.at(-1);
    if (!intendedUseDraft) fail("Record an intended-use working draft before sealing the language packet.", 409);
    const packet = createLanguageReviewPacket({
      intendedUseDraft,
      evidenceSnapshot: this.languageReviewEvidenceSnapshot(),
      actor,
      version: this.state.languageReviewPackets.length + 1,
      createdAt: this.clock().toISOString()
    });
    const packetErrors = validateLanguageReviewPacket(packet);
    if (packetErrors.length) fail(packetErrors.join(" "), 500);
    const previousHash = this.state.languageReviewEvents.at(-1)?.hash || "GENESIS";
    const event = createLanguageReviewEvent({
      packet,
      sequence: this.state.languageReviewEvents.length + 1,
      previousHash,
      createdAt: packet.createdAt
    });
    const eventErrors = validateLanguageReviewEvent(event, { sequence: event.sequence, previousHash, packet });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.languageReviewPackets.push(packet);
    this.state.languageReviewEvents.push(event);
    await this.persist();
    return { packet: clone(packet), event: clone(event), languageReview: await this.languageReviewStatus() };
  }

  verifyDecisionExchangeEventChain() {
    const events = this.state?.decisionExchangeEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateDecisionReturnPreflight(event, { sequence: index + 1, previousHash });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, preflights: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, preflights: events.length };
  }

  decisionExchangeEvidenceContext() {
    const intendedUse = this.state.intendedUseDrafts.at(-1) || null;
    const language = this.state.languageReviewPackets.at(-1) || null;
    return {
      stateSchemaVersion: this.state.schemaVersion,
      reportContract: REPORT_CONTRACT.format,
      disclaimerVersion: REPORT_CONTRACT.disclaimerVersion,
      intendedUseVersion: intendedUse?.version || null,
      intendedUseHash: intendedUse?.hash || "GENESIS",
      languagePacketVersion: language?.version || null,
      languagePacketHash: language?.hash || "GENESIS",
      caseSetId: this.calibrationManifest.id,
      caseSetVersion: this.calibrationManifest.version,
      chainHeads: {
        integrationReturn: this.verifyIntegrationReturnEventChain().head || "GENESIS",
        counselorNotebook: this.verifyCounselorNotebookEntryChain().head || "GENESIS",
        clinicalStandard: this.verifyClinicalStandardEventChain().head || "GENESIS",
        independentReview: this.verifyIndependentReviewEventChain().head || "GENESIS",
        recovery: this.verifyRecoveryEventChain().head || "GENESIS",
        rollback: this.verifyRollbackEventChain().head || "GENESIS",
        monitoring: this.verifyMonitoringEventChain().head || "GENESIS",
        incidentResponse: this.verifyResponseDrillEventChain().head || "GENESIS"
      }
    };
  }

  async decisionExchangeStatus() {
    await this.init();
    return buildDecisionExchange({
      readiness: await this.pilotReadinessStatus(),
      evidenceContext: this.decisionExchangeEvidenceContext(),
      events: this.state.decisionExchangeEvents,
      chain: this.verifyDecisionExchangeEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async preflightDecisionReturn(manifest, actor = "Demo reviewer") {
    await this.init();
    const exchange = await this.decisionExchangeStatus();
    const packet = exchange.packets.find(item => item.id === manifest?.gateId);
    const manifestErrors = validateDecisionReturnManifest(manifest, packet);
    if (manifestErrors.length) fail(manifestErrors.join(" "), 400);
    const previousHash = this.state.decisionExchangeEvents.at(-1)?.hash || "GENESIS";
    const event = createDecisionReturnPreflight({
      manifest,
      packet,
      actor,
      sequence: this.state.decisionExchangeEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const eventErrors = validateDecisionReturnPreflight(event, { sequence: event.sequence, previousHash });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.decisionExchangeEvents.push(event);
    await this.persist();
    return { event: clone(event), decisionExchange: await this.decisionExchangeStatus() };
  }

  verifyPilotOperationsSnapshotChain() {
    const events = this.state?.pilotOperationsEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validatePilotOperationsSnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, snapshots: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, snapshots: events.length };
  }

  pilotOperationsEvidenceContext(readiness, decisionExchange) {
    return {
      stateSchemaVersion: this.state.schemaVersion,
      readinessStateHash: readiness?.current?.readinessStateHash || null,
      decisionExchangeFingerprint: decisionExchange?.exchangeFingerprint || null,
      reportContract: REPORT_CONTRACT.format,
      intendedUseContract: INTENDED_USE_CONTRACT,
      chainHeads: {
        intendedUse: this.verifyIntendedUseEventChain().head || "GENESIS",
        languageReview: this.verifyLanguageReviewEventChain().head || "GENESIS",
        candidateTrial: this.verifyCandidateTrialSnapshotChain().head || "GENESIS",
        clinicalStandard: this.verifyClinicalStandardEventChain().head || "GENESIS",
        independentReview: this.verifyIndependentReviewEventChain().head || "GENESIS",
        decisionExchange: this.verifyDecisionExchangeEventChain().head || "GENESIS"
      }
    };
  }

  async pilotOperationsStatus() {
    await this.init();
    const readiness = await this.pilotReadinessStatus();
    const decisionExchange = await this.decisionExchangeStatus();
    return buildPilotOperationsPlan({
      readiness,
      decisionExchange,
      evidenceContext: this.pilotOperationsEvidenceContext(readiness, decisionExchange),
      events: this.state.pilotOperationsEvents,
      chain: this.verifyPilotOperationsSnapshotChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordPilotOperationsSnapshot(actor = "Demo reviewer") {
    await this.init();
    const plan = await this.pilotOperationsStatus();
    const previousHash = this.state.pilotOperationsEvents.at(-1)?.hash || "GENESIS";
    const event = createPilotOperationsSnapshot({
      plan,
      actor,
      sequence: this.state.pilotOperationsEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const errors = validatePilotOperationsSnapshot(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.pilotOperationsEvents.push(event);
    await this.persist();
    return { event: clone(event), pilotOperations: await this.pilotOperationsStatus() };
  }

  verifyProviderActivationSnapshotChain() {
    const events = this.state?.providerActivationEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateProviderActivationSnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, snapshots: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, snapshots: events.length };
  }

  providerActivationEvidenceContext(pilotOperations, readiness) {
    return {
      stateSchemaVersion: this.state.schemaVersion,
      pilotPlanFingerprint: pilotOperations?.planFingerprint || null,
      readinessStateHash: readiness?.current?.readinessStateHash || null,
      reportContract: REPORT_CONTRACT.format,
      chainHeads: {
        pilotOperations: this.verifyPilotOperationsSnapshotChain().head || "GENESIS",
        intendedUse: this.verifyIntendedUseEventChain().head || "GENESIS",
        languageReview: this.verifyLanguageReviewEventChain().head || "GENESIS",
        reports: this.verifyReportArtifactChain().head || "GENESIS",
        generation: this.verifyGenerationEventChain().head || "GENESIS",
        monitoring: this.verifyMonitoringEventChain().head || "GENESIS",
        incidentResponse: this.verifyResponseDrillEventChain().head || "GENESIS",
        readiness: this.verifyReadinessEventChain().head || "GENESIS"
      }
    };
  }

  async providerActivationStatus() {
    await this.init();
    const pilotOperations = await this.pilotOperationsStatus();
    const readiness = await this.pilotReadinessStatus();
    return buildProviderActivationWorkbook({
      pilotOperations,
      readiness,
      evidenceContext: this.providerActivationEvidenceContext(pilotOperations, readiness),
      events: this.state.providerActivationEvents,
      chain: this.verifyProviderActivationSnapshotChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordProviderActivationSnapshot(actor = "Demo reviewer") {
    await this.init();
    const workbook = await this.providerActivationStatus();
    const previousHash = this.state.providerActivationEvents.at(-1)?.hash || "GENESIS";
    const event = createProviderActivationSnapshot({
      workbook,
      actor,
      sequence: this.state.providerActivationEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const errors = validateProviderActivationSnapshot(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.providerActivationEvents.push(event);
    await this.persist();
    return { event: clone(event), providerActivation: await this.providerActivationStatus() };
  }

  verifyCampusObservatorySnapshotChain() {
    const events = this.state?.campusObservatoryEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateCampusObservatorySnapshot(event, { sequence: index + 1, previousHash });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, snapshots: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, snapshots: events.length };
  }

  campusObservatoryEvidenceContext(pilotOperations, providerActivation) {
    return {
      stateSchemaVersion: this.state.schemaVersion,
      pilotPlanFingerprint: pilotOperations?.planFingerprint || null,
      providerActivationFingerprint: providerActivation?.workbookFingerprint || null,
      reportContract: REPORT_CONTRACT.format,
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version },
      chainHeads: {
        pilotOperations: this.verifyPilotOperationsSnapshotChain().head || "GENESIS",
        providerActivation: this.verifyProviderActivationSnapshotChain().head || "GENESIS",
        reports: this.verifyReportArtifactChain().head || "GENESIS",
        generation: this.verifyGenerationEventChain().head || "GENESIS",
        feedback: this.verifyFeedbackEventChain().head || "GENESIS",
        timing: this.verifyTimingEventChain().head || "GENESIS",
        incidents: this.verifyIncidentChain().head || "GENESIS"
      }
    };
  }

  campusObservatoryOperationalCounts() {
    const approved = this.state.assessments.filter(item => this.reviewFor(item.id).status === "approved").length;
    const criticalScreens = this.state.assessments.filter(item => riskDisposition(item).requiresReview).length;
    const correctionAssessmentIds = new Set([
      ...this.state.feedback.map(item => item.assessmentId),
      ...Object.keys(this.state.interpretations || {})
    ]);
    return {
      assessmentsEligible: this.state.assessments.length,
      summariesGenerated: Object.keys(this.state.activeGenerations || {}).length,
      reviewsDisposed: approved,
      summariesApproved: approved,
      correctionRecords: correctionAssessmentIds.size,
      criticalScreens,
      criticalRoutesRequired: criticalScreens,
      timingObservations: this.state.timingObservations.length,
      usefulnessRatings: this.state.comparisons.length,
      openIncidents: this.incidentRecords().filter(item => item.status === "open").length
    };
  }

  async campusObservatoryStatus() {
    await this.init();
    const pilotOperations = await this.pilotOperationsStatus();
    const providerActivation = await this.providerActivationStatus();
    return buildCampusObservatory({
      pilotOperations,
      providerActivation,
      operationalCounts: this.campusObservatoryOperationalCounts(),
      evidenceContext: this.campusObservatoryEvidenceContext(pilotOperations, providerActivation),
      events: this.state.campusObservatoryEvents,
      chain: this.verifyCampusObservatorySnapshotChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async recordCampusObservatorySnapshot(input, actor = "Demo reviewer") {
    await this.init();
    const observatory = await this.campusObservatoryStatus();
    const inputErrors = validateCampusObservatorySnapshotInput(input, observatory.candidates.map(item => item.id));
    if (inputErrors.length) fail(inputErrors.join(" "), 400);
    const previousHash = this.state.campusObservatoryEvents.at(-1)?.hash || "GENESIS";
    const event = createCampusObservatorySnapshot({
      observatory,
      input,
      actor,
      sequence: this.state.campusObservatoryEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const errors = validateCampusObservatorySnapshot(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.campusObservatoryEvents.push(event);
    await this.persist();
    return { event: clone(event), campusObservatory: await this.campusObservatoryStatus() };
  }

  verifySiteAdmissionEventChain() {
    const events = this.state?.siteAdmissionEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const errors = validateSiteAdmissionReturnPreflight(event, { sequence: index + 1, previousHash });
      if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, preflights: events.length };
      previousHash = event.hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null, preflights: events.length };
  }

  siteAdmissionEvidenceContext({ readiness, decisionExchange, pilotOperations, providerActivation }) {
    return {
      stateSchemaVersion: this.state.schemaVersion,
      readinessStateHash: readiness?.current?.readinessStateHash || null,
      decisionExchangeFingerprint: decisionExchange?.exchangeFingerprint || null,
      pilotPlanFingerprint: pilotOperations?.planFingerprint || null,
      providerActivationFingerprint: providerActivation?.workbookFingerprint || null,
      reportContract: REPORT_CONTRACT.format,
      chainHeads: {
        readiness: this.verifyReadinessEventChain().head || "GENESIS",
        decisionExchange: this.verifyDecisionExchangeEventChain().head || "GENESIS",
        pilotOperations: this.verifyPilotOperationsSnapshotChain().head || "GENESIS",
        providerActivation: this.verifyProviderActivationSnapshotChain().head || "GENESIS",
        intendedUse: this.verifyIntendedUseEventChain().head || "GENESIS",
        languageReview: this.verifyLanguageReviewEventChain().head || "GENESIS",
        integrationReturn: this.verifyIntegrationReturnEventChain().head || "GENESIS",
        independentReview: this.verifyIndependentReviewEventChain().head || "GENESIS"
      }
    };
  }

  async siteAdmissionStatus() {
    await this.init();
    const readiness = await this.pilotReadinessStatus();
    const decisionExchange = await this.decisionExchangeStatus();
    const pilotOperations = await this.pilotOperationsStatus();
    const providerActivation = await this.providerActivationStatus();
    return buildSiteAdmissionPortfolio({
      readiness,
      decisionExchange,
      pilotOperations,
      providerActivation,
      evidenceContext: this.siteAdmissionEvidenceContext({ readiness, decisionExchange, pilotOperations, providerActivation }),
      events: this.state.siteAdmissionEvents,
      chain: this.verifySiteAdmissionEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async preflightSiteAdmissionReturn(manifest, actor = "Demo reviewer") {
    await this.init();
    const portfolio = await this.siteAdmissionStatus();
    const dossier = portfolio.dossiers.find(item => item.candidate.id === manifest?.candidateId);
    const manifestErrors = validateSiteAdmissionReturnManifest(manifest, dossier);
    if (manifestErrors.length) fail(manifestErrors.join(" "), 400);
    const previousHash = this.state.siteAdmissionEvents.at(-1)?.hash || "GENESIS";
    const event = createSiteAdmissionReturnPreflight({
      manifest,
      dossier,
      actor,
      sequence: this.state.siteAdmissionEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const eventErrors = validateSiteAdmissionReturnPreflight(event, { sequence: event.sequence, previousHash });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.siteAdmissionEvents.push(event);
    await this.persist();
    return { event: clone(event), siteAdmission: await this.siteAdmissionStatus() };
  }

  verifyAuthorityTrustEventChain() {
    const events = this.state?.authorityTrustEvents || [];
    const challenges = new Map();
    const seenReceiptIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challenge = event.eventType === "receipt-verified" ? challenges.get(event.receipt?.challengeId) : null;
      const errors = validateAuthorityTrustEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.authorityTrustRegistry,
        challenge,
        now: event.createdAt,
        seenReceiptIds,
        seenSignatureHashes
      });
      if (event.eventType === "receipt-verified" && !challenge) errors.push("Verified authority-trust receipt has no prior challenge event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "challenge-issued").length,
        verifiedReceipts: events.filter(item => item.eventType === "receipt-verified").length
      };
      if (event.eventType === "challenge-issued") challenges.set(event.challenge.challengeId, event.challenge);
      if (event.eventType === "receipt-verified") {
        seenReceiptIds.add(event.receipt.receiptId);
        seenSignatureHashes.add(digest(event.receipt.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "challenge-issued").length,
      verifiedReceipts: events.filter(item => item.eventType === "receipt-verified").length
    };
  }

  async authorityTrustStatus() {
    await this.init();
    const siteAdmission = await this.siteAdmissionStatus();
    return buildAuthorityTrustBridge({
      siteAdmission,
      registry: this.authorityTrustRegistry,
      events: this.state.authorityTrustEvents,
      chain: this.verifyAuthorityTrustEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueAuthorityTrustChallenge(candidateId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeAuthorityTrustRegistry(this.authorityTrustRegistry, createdAt);
    if (!registrySummary.registryCurrent || registrySummary.activeKeyCount < 1) fail("Provision a current, owner-only authority trust registry at server startup before issuing a challenge.", 409);
    const eligibleKey = this.authorityTrustRegistry.keys.some(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= Date.parse(createdAt) && Date.parse(createdAt) <= Date.parse(key.notAfter));
    if (!eligibleKey) fail("No current startup trust key is granted to this candidate.", 409);
    const siteAdmission = await this.siteAdmissionStatus();
    const dossier = siteAdmission.dossiers.find(item => item.candidate.id === candidateId);
    if (!dossier) fail("Named-site candidate was not found.", 404);
    const previousHash = this.state.authorityTrustEvents.at(-1)?.hash || "GENESIS";
    const event = createAuthorityTrustChallenge({
      dossier,
      portfolioFingerprint: siteAdmission.portfolioFingerprint,
      registry: this.authorityTrustRegistry,
      actor,
      sequence: this.state.authorityTrustEvents.length + 1,
      previousHash,
      createdAt
    });
    const errors = validateAuthorityTrustEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.authorityTrustEvents.push(event);
    await this.persist();
    return { challenge: clone(event.challenge), event: clone(event), authorityTrust: await this.authorityTrustStatus() };
  }

  async verifyAuthorityTrustReceipt(receipt, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.authorityTrustEvents.find(event => event.eventType === "challenge-issued" && event.challenge.challengeId === receipt?.challengeId);
    if (!challengeEvent) fail("Governed trust receipt does not reference an issued challenge.", 400);
    const siteAdmission = await this.siteAdmissionStatus();
    const dossier = siteAdmission.dossiers.find(item => item.candidate.id === challengeEvent.challenge.candidateId);
    const challengeErrors = validateAuthorityTrustChallenge(challengeEvent.challenge, {
      dossier,
      portfolioFingerprint: siteAdmission.portfolioFingerprint,
      registryFingerprint: authorityTrustRegistryFingerprint(this.authorityTrustRegistry)
    });
    if (Date.parse(verifiedAt) > Date.parse(challengeEvent.challenge.expiresAt)) challengeErrors.push("Governed trust challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const seenReceiptIds = new Set(this.state.authorityTrustEvents.filter(event => event.eventType === "receipt-verified").map(event => event.receipt.receiptId));
    const seenSignatureHashes = new Set(this.state.authorityTrustEvents.filter(event => event.eventType === "receipt-verified").map(event => digest(event.receipt.signature.value)));
    const receiptErrors = validateAuthorityTrustReceipt(receipt, {
      challenge: challengeEvent.challenge,
      registry: this.authorityTrustRegistry,
      now: verifiedAt,
      seenReceiptIds,
      seenSignatureHashes
    });
    if (receiptErrors.length) fail(receiptErrors.join(" "), 400);
    const previousHash = this.state.authorityTrustEvents.at(-1)?.hash || "GENESIS";
    const event = createAuthorityTrustReceiptEvent({
      receipt,
      registry: this.authorityTrustRegistry,
      actor,
      sequence: this.state.authorityTrustEvents.length + 1,
      previousHash,
      verifiedAt
    });
    const eventErrors = validateAuthorityTrustEvent(event, {
      sequence: event.sequence,
      previousHash,
      registry: this.authorityTrustRegistry,
      challenge: challengeEvent.challenge,
      now: verifiedAt,
      seenReceiptIds,
      seenSignatureHashes
    });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.authorityTrustEvents.push(event);
    await this.persist();
    return { event: clone(event), authorityTrust: await this.authorityTrustStatus() };
  }

  verifyPilotStartEventChain() {
    const events = this.state?.pilotStartEvents || [];
    const challenges = new Map();
    const orders = new Map();
    const seenReceiptIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "challenge-issued" ? event.challenge?.challengeId : event.eventType === "start-order-verified" ? event.order?.challengeId : event.acknowledgement?.challengeId;
      const challenge = event.eventType === "challenge-issued" ? null : challenges.get(challengeId);
      const order = event.eventType === "deployment-start-acknowledged" ? orders.get(event.acknowledgement?.orderId) : null;
      const errors = validatePilotStartEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.pilotStartRegistry,
        challenge,
        order,
        now: event.createdAt,
        seenReceiptIds,
        seenSignatureHashes
      });
      if (event.eventType !== "challenge-issued" && !challenge) errors.push("Pilot-start receipt has no prior challenge event.");
      if (event.eventType === "deployment-start-acknowledged" && !order) errors.push("Deployment-start acknowledgement has no prior verified order event.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "challenge-issued").length,
        verifiedOrders: events.filter(item => item.eventType === "start-order-verified").length,
        verifiedAcknowledgements: events.filter(item => item.eventType === "deployment-start-acknowledged").length
      };
      if (event.eventType === "challenge-issued") challenges.set(event.challenge.challengeId, event.challenge);
      if (event.eventType === "start-order-verified") {
        orders.set(event.order.orderId, event.order);
        seenReceiptIds.add(event.order.orderId);
        seenSignatureHashes.add(digest(event.order.signature.value));
      }
      if (event.eventType === "deployment-start-acknowledged") {
        seenReceiptIds.add(event.acknowledgement.acknowledgementId);
        seenSignatureHashes.add(digest(event.acknowledgement.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "challenge-issued").length,
      verifiedOrders: events.filter(item => item.eventType === "start-order-verified").length,
      verifiedAcknowledgements: events.filter(item => item.eventType === "deployment-start-acknowledged").length
    };
  }

  pilotStartContinuityContext() {
    const prerequisites = this.responsePrerequisites();
    const byId = id => prerequisites.find(item => item.id === id) || { status: "required", evidenceHash: null };
    const responseChain = this.verifyResponseDrillEventChain();
    const responseEvent = this.state.responseDrillEvents.at(-1) || null;
    const responseCurrent = responseChain.valid
      && responseEvent?.status === "tabletop-complete"
      && responseEvent.monitoringEvidenceHash === byId("monitoring").evidenceHash
      && responseEvent.recoveryEvidenceHash === byId("recovery").evidenceHash
      && responseEvent.rollbackEvidenceHash === byId("rollback").evidenceHash;
    return buildPilotStartContinuity({
      stateSchemaVersion: this.state.schemaVersion,
      recovery: { id: "recovery", label: "Current isolated restore", current: byId("recovery").status === "ready", evidenceHash: byId("recovery").evidenceHash },
      rollback: { id: "rollback", label: "Current sealed baseline", current: byId("rollback").status === "ready", evidenceHash: byId("rollback").evidenceHash },
      monitoring: { id: "monitoring", label: "Current control probe", current: byId("monitoring").status === "ready", evidenceHash: byId("monitoring").evidenceHash },
      incidentResponse: { id: "incident-response", label: "Current response tabletop", current: responseCurrent, evidenceHash: responseEvent?.hash || null },
      studyControl: this.studyControl()
    });
  }

  async pilotStartStatus() {
    await this.init();
    const authorityTrust = await this.authorityTrustStatus();
    const continuity = this.pilotStartContinuityContext();
    return buildPilotStartControl({
      authorityTrust,
      continuity,
      registry: this.pilotStartRegistry,
      events: this.state.pilotStartEvents,
      chain: this.verifyPilotStartEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issuePilotStartChallenge(candidateId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizePilotStartRegistry(this.pilotStartRegistry, createdAt);
    if (!registrySummary.registryCurrent) fail("Provision a current, owner-only pilot-start registry at server startup before issuing a challenge.", 409);
    const activeKeys = this.pilotStartRegistry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= Date.parse(createdAt) && Date.parse(createdAt) <= Date.parse(key.notAfter));
    const orderKeys = activeKeys.filter(key => key.purpose === "pilot-start-order");
    const acknowledgementKeys = activeKeys.filter(key => key.purpose === "deployment-start-acknowledgement");
    if (!orderKeys.length || !acknowledgementKeys.length || !orderKeys.some(orderKey => acknowledgementKeys.some(acknowledgementKey => orderKey.publicKeyPem !== acknowledgementKey.publicKeyPem))) fail("This candidate requires distinct current start-order and deployment-acknowledgement keys.", 409);
    const authorityTrust = await this.authorityTrustStatus();
    const candidate = authorityTrust.candidates.find(item => item.candidate.id === candidateId);
    if (!candidate) fail("Named-site candidate was not found.", 404);
    if (!candidate.pilotAuthorizationRecorded) fail("A current 36-scope bounded authority seal is required before a pilot-start challenge can be issued.", 409);
    const continuity = this.pilotStartContinuityContext();
    if (!continuity.allCurrent) fail("Current recovery, rollback, monitoring, incident-response, and study-safety evidence is required before a pilot-start challenge can be issued.", 409);
    const previousHash = this.state.pilotStartEvents.at(-1)?.hash || "GENESIS";
    const event = createPilotStartChallenge({
      candidate,
      authorityBridgeFingerprint: authorityTrust.bridgeFingerprint,
      continuity,
      registry: this.pilotStartRegistry,
      actor,
      sequence: this.state.pilotStartEvents.length + 1,
      previousHash,
      createdAt
    });
    const errors = validatePilotStartEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.pilotStartEvents.push(event);
    await this.persist();
    return { challenge: clone(event.challenge), event: clone(event), pilotStart: await this.pilotStartStatus() };
  }

  async verifyPilotStartOrder(order, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const challengeEvent = this.state.pilotStartEvents.find(event => event.eventType === "challenge-issued" && event.challenge.challengeId === order?.challengeId);
    if (!challengeEvent) fail("Pilot-start order does not reference an issued challenge.", 400);
    const authorityTrust = await this.authorityTrustStatus();
    const candidate = authorityTrust.candidates.find(item => item.candidate.id === challengeEvent.challenge.candidateId);
    const continuity = this.pilotStartContinuityContext();
    const challengeErrors = validatePilotStartChallenge(challengeEvent.challenge, {
      candidate,
      authorityBridgeFingerprint: authorityTrust.bridgeFingerprint,
      registryFingerprint: pilotStartRegistryFingerprint(this.pilotStartRegistry),
      continuityFingerprint: continuity.continuityFingerprint
    });
    if (!candidate?.pilotAuthorizationRecorded) challengeErrors.push("The bounded authority seal is no longer current.");
    if (!continuity.allCurrent) challengeErrors.push("Pilot-start continuity evidence is no longer current.");
    if (Date.parse(verifiedAt) > Date.parse(challengeEvent.challenge.expiresAt)) challengeErrors.push("Pilot-start challenge has expired.");
    if (challengeErrors.length) fail(challengeErrors.join(" "), 409);
    const seenReceiptIds = new Set(this.state.pilotStartEvents.flatMap(event => event.eventType === "start-order-verified" ? [event.order.orderId] : event.eventType === "deployment-start-acknowledged" ? [event.acknowledgement.acknowledgementId] : []));
    const seenSignatureHashes = new Set(this.state.pilotStartEvents.flatMap(event => event.eventType === "start-order-verified" ? [digest(event.order.signature.value)] : event.eventType === "deployment-start-acknowledged" ? [digest(event.acknowledgement.signature.value)] : []));
    const orderErrors = validatePilotStartOrder(order, { challenge: challengeEvent.challenge, registry: this.pilotStartRegistry, now: verifiedAt, seenReceiptIds, seenSignatureHashes });
    if (orderErrors.length) fail(orderErrors.join(" "), 400);
    const previousHash = this.state.pilotStartEvents.at(-1)?.hash || "GENESIS";
    const event = createPilotStartOrderEvent({ order, registry: this.pilotStartRegistry, actor, sequence: this.state.pilotStartEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validatePilotStartEvent(event, { sequence: event.sequence, previousHash, registry: this.pilotStartRegistry, challenge: challengeEvent.challenge, now: verifiedAt, seenReceiptIds, seenSignatureHashes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.pilotStartEvents.push(event);
    await this.persist();
    return { event: clone(event), pilotStart: await this.pilotStartStatus() };
  }

  async verifyPilotStartAcknowledgement(acknowledgement, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const orderEvent = this.state.pilotStartEvents.find(event => event.eventType === "start-order-verified" && event.order.orderId === acknowledgement?.orderId);
    if (!orderEvent) fail("Deployment-start acknowledgement does not reference a verified start order.", 400);
    const challengeEvent = this.state.pilotStartEvents.find(event => event.eventType === "challenge-issued" && event.challenge.challengeId === orderEvent.order.challengeId);
    if (!challengeEvent) fail("Verified start order has no issued challenge.", 500);
    const authorityTrust = await this.authorityTrustStatus();
    const candidate = authorityTrust.candidates.find(item => item.candidate.id === orderEvent.order.candidateId);
    const continuity = this.pilotStartContinuityContext();
    const currentErrors = validatePilotStartChallenge(challengeEvent.challenge, {
      candidate,
      authorityBridgeFingerprint: authorityTrust.bridgeFingerprint,
      registryFingerprint: pilotStartRegistryFingerprint(this.pilotStartRegistry),
      continuityFingerprint: continuity.continuityFingerprint
    });
    if (!candidate?.pilotAuthorizationRecorded) currentErrors.push("The bounded authority seal is no longer current.");
    if (!continuity.allCurrent) currentErrors.push("Pilot-start continuity evidence is no longer current.");
    if (Date.parse(verifiedAt) > Date.parse(orderEvent.order.expiresAt)) currentErrors.push("Verified pilot-start order has expired.");
    if (currentErrors.length) fail(currentErrors.join(" "), 409);
    const seenReceiptIds = new Set(this.state.pilotStartEvents.flatMap(event => event.eventType === "start-order-verified" ? [event.order.orderId] : event.eventType === "deployment-start-acknowledged" ? [event.acknowledgement.acknowledgementId] : []));
    const seenSignatureHashes = new Set(this.state.pilotStartEvents.flatMap(event => event.eventType === "start-order-verified" ? [digest(event.order.signature.value)] : event.eventType === "deployment-start-acknowledged" ? [digest(event.acknowledgement.signature.value)] : []));
    const acknowledgementErrors = validatePilotStartAcknowledgement(acknowledgement, { challenge: challengeEvent.challenge, order: orderEvent.order, registry: this.pilotStartRegistry, now: verifiedAt, seenReceiptIds, seenSignatureHashes });
    if (acknowledgementErrors.length) fail(acknowledgementErrors.join(" "), 400);
    const previousHash = this.state.pilotStartEvents.at(-1)?.hash || "GENESIS";
    const event = createPilotStartAcknowledgementEvent({ acknowledgement, registry: this.pilotStartRegistry, actor, sequence: this.state.pilotStartEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validatePilotStartEvent(event, { sequence: event.sequence, previousHash, registry: this.pilotStartRegistry, challenge: challengeEvent.challenge, order: orderEvent.order, now: verifiedAt, seenReceiptIds, seenSignatureHashes });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.pilotStartEvents.push(event);
    await this.persist();
    return { event: clone(event), pilotStart: await this.pilotStartStatus() };
  }

  verifyClinicalReleaseEventChain() {
    const events = this.state?.clinicalReleaseEvents || [];
    const challenges = new Map();
    const clinicalAuthorizations = new Map();
    const productionAuthorizations = new Map();
    const seenReceiptIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "release-challenge-issued" ? event.challenge?.challengeId
        : event.eventType === "clinical-use-authorized" ? event.clinicalAuthorization?.challengeId
          : event.eventType === "production-release-authorized" ? event.productionAuthorization?.challengeId
            : event.deploymentAttestation?.challengeId;
      const challenge = event.eventType === "release-challenge-issued" ? null : challenges.get(challengeId);
      const clinicalAuthorization = event.eventType === "production-release-authorized"
        ? clinicalAuthorizations.get(event.productionAuthorization?.clinicalAuthorizationId)?.payload
        : event.eventType === "release-deployment-attested"
          ? [...clinicalAuthorizations.values()].find(item => event.deploymentAttestation?.clinicalAuthorizationFingerprint === item.fingerprint)?.payload
          : null;
      const productionAuthorization = event.eventType === "release-deployment-attested"
        ? [...productionAuthorizations.values()].find(item => event.deploymentAttestation?.productionAuthorizationFingerprint === item.fingerprint)?.payload
        : null;
      const errors = validateClinicalReleaseEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.clinicalReleaseRegistry,
        challenge,
        clinicalAuthorization,
        productionAuthorization,
        now: event.createdAt,
        seenReceiptIds,
        seenSignatureHashes
      });
      if (event.eventType !== "release-challenge-issued" && !challenge) errors.push("Clinical-release receipt has no prior challenge event.");
      if (event.eventType === "production-release-authorized" && !clinicalAuthorization) errors.push("Production-release authorization has no prior clinical-use authorization.");
      if (event.eventType === "release-deployment-attested" && (!clinicalAuthorization || !productionAuthorization)) errors.push("Release-deployment attestation has incomplete prior authorization evidence.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "release-challenge-issued").length,
        clinicalAuthorizations: events.filter(item => item.eventType === "clinical-use-authorized").length,
        productionAuthorizations: events.filter(item => item.eventType === "production-release-authorized").length,
        deploymentAttestations: events.filter(item => item.eventType === "release-deployment-attested").length
      };
      if (event.eventType === "release-challenge-issued") challenges.set(event.challenge.challengeId, event.challenge);
      if (event.eventType === "clinical-use-authorized") {
        clinicalAuthorizations.set(event.clinicalAuthorization.authorizationId, { payload: event.clinicalAuthorization, fingerprint: event.clinicalAuthorizationFingerprint });
        seenReceiptIds.add(event.clinicalAuthorization.authorizationId);
        seenSignatureHashes.add(digest(event.clinicalAuthorization.signature.value));
      }
      if (event.eventType === "production-release-authorized") {
        productionAuthorizations.set(event.productionAuthorization.authorizationId, { payload: event.productionAuthorization, fingerprint: event.productionAuthorizationFingerprint });
        seenReceiptIds.add(event.productionAuthorization.authorizationId);
        seenSignatureHashes.add(digest(event.productionAuthorization.signature.value));
      }
      if (event.eventType === "release-deployment-attested") {
        seenReceiptIds.add(event.deploymentAttestation.attestationId);
        seenSignatureHashes.add(digest(event.deploymentAttestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "release-challenge-issued").length,
      clinicalAuthorizations: events.filter(item => item.eventType === "clinical-use-authorized").length,
      productionAuthorizations: events.filter(item => item.eventType === "production-release-authorized").length,
      deploymentAttestations: events.filter(item => item.eventType === "release-deployment-attested").length
    };
  }

  async clinicalReleaseContext(candidateId) {
    const authorityTrust = await this.authorityTrustStatus();
    const pilotStart = await this.pilotStartStatus();
    const continuity = this.pilotStartContinuityContext();
    const candidate = authorityTrust.candidates.find(item => item.candidate.id === candidateId);
    const preparation = pilotStart.candidates.find(item => item.candidate.id === candidateId);
    const acknowledgementEvent = [...this.state.pilotStartEvents].reverse().find(event => event.eventType === "deployment-start-acknowledged" && event.acknowledgement.candidateId === candidateId) || null;
    const pilotStartProof = {
      controlFingerprint: pilotStart.controlFingerprint,
      chainHead: pilotStart.chain.head,
      acknowledgementFingerprint: acknowledgementEvent?.acknowledgementFingerprint || null
    };
    return { authorityTrust, pilotStart, continuity, candidate, preparation, acknowledgementEvent, pilotStartProof };
  }

  async clinicalReleaseStatus() {
    await this.init();
    const authorityTrust = await this.authorityTrustStatus();
    const pilotStart = await this.pilotStartStatus();
    return buildClinicalReleaseGate({
      authorityTrust,
      pilotStart,
      continuity: this.pilotStartContinuityContext(),
      registry: this.clinicalReleaseRegistry,
      events: this.state.clinicalReleaseEvents,
      chain: this.verifyClinicalReleaseEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueClinicalReleaseChallenge(candidateId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeClinicalReleaseRegistry(this.clinicalReleaseRegistry, createdAt);
    if (!registrySummary.registryCurrent) fail("Provision a current, owner-only clinical-release registry at server startup before issuing a challenge.", 409);
    const activeKeys = this.clinicalReleaseRegistry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= Date.parse(createdAt) && Date.parse(createdAt) <= Date.parse(key.notAfter));
    const purposes = new Set(activeKeys.map(key => key.purpose));
    if (!["clinical-use-authorization", "production-release-authorization", "release-deployment-attestation"].every(purpose => purposes.has(purpose)) || new Set(activeKeys.map(key => key.publicKeyPem)).size < 3) fail("This candidate requires three distinct current clinical-release duty keys.", 409);
    const context = await this.clinicalReleaseContext(candidateId);
    if (!context.candidate?.pilotAuthorizationRecorded) fail("A current 36-scope bounded authority seal is required before clinical release.", 409);
    if (!context.preparation?.providerPreparationStarted || !context.acknowledgementEvent) fail("A current, verified provider-preparation acknowledgement is required before clinical release.", 409);
    if (!context.continuity.allCurrent) fail("Current recovery, rollback, monitoring, incident-response, and study-safety evidence is required before clinical release.", 409);
    const previousHash = this.state.clinicalReleaseEvents.at(-1)?.hash || "GENESIS";
    const event = createClinicalReleaseChallenge({
      candidate: context.candidate,
      authorityBridgeFingerprint: context.authorityTrust.bridgeFingerprint,
      pilotStartProof: context.pilotStartProof,
      continuityFingerprint: context.continuity.continuityFingerprint,
      registry: this.clinicalReleaseRegistry,
      actor,
      sequence: this.state.clinicalReleaseEvents.length + 1,
      previousHash,
      createdAt
    });
    const errors = validateClinicalReleaseEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.clinicalReleaseEvents.push(event);
    await this.persist();
    return { challenge: clone(event.challenge), event: clone(event), clinicalRelease: await this.clinicalReleaseStatus() };
  }

  clinicalReleaseReplayState() {
    const events = this.state.clinicalReleaseEvents;
    return {
      seenReceiptIds: new Set(events.flatMap(event => event.eventType === "clinical-use-authorized" ? [event.clinicalAuthorization.authorizationId] : event.eventType === "production-release-authorized" ? [event.productionAuthorization.authorizationId] : event.eventType === "release-deployment-attested" ? [event.deploymentAttestation.attestationId] : [])),
      seenSignatureHashes: new Set(events.flatMap(event => event.eventType === "clinical-use-authorized" ? [digest(event.clinicalAuthorization.signature.value)] : event.eventType === "production-release-authorized" ? [digest(event.productionAuthorization.signature.value)] : event.eventType === "release-deployment-attested" ? [digest(event.deploymentAttestation.signature.value)] : []))
    };
  }

  async currentClinicalReleaseChallenge(challengeId) {
    const event = this.state.clinicalReleaseEvents.find(item => item.eventType === "release-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) fail("Clinical-release receipt does not reference an issued challenge.", 400);
    const context = await this.clinicalReleaseContext(event.challenge.candidateId);
    const errors = validateClinicalReleaseChallenge(event.challenge, {
      candidate: context.candidate,
      authorityBridgeFingerprint: context.authorityTrust.bridgeFingerprint,
      pilotStartProof: context.pilotStartProof,
      continuityFingerprint: context.continuity.continuityFingerprint,
      registryFingerprint: clinicalReleaseRegistryFingerprint(this.clinicalReleaseRegistry)
    });
    if (!context.candidate?.pilotAuthorizationRecorded) errors.push("The bounded authority seal is no longer current.");
    if (!context.continuity.allCurrent) errors.push("Clinical-release continuity evidence is no longer current.");
    if (Date.parse(this.clock().toISOString()) > Date.parse(event.challenge.expiresAt)) errors.push("Clinical-release challenge has expired.");
    if (errors.length) fail(errors.join(" "), 409);
    return { event, context };
  }

  async verifyClinicalUseAuthorization(authorization, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent } = await this.currentClinicalReleaseChallenge(authorization?.challengeId);
    const replay = this.clinicalReleaseReplayState();
    const errors = validateClinicalUseAuthorization(authorization, { challenge: challengeEvent.challenge, registry: this.clinicalReleaseRegistry, now: verifiedAt, ...replay });
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.clinicalReleaseEvents.at(-1)?.hash || "GENESIS";
    const event = createClinicalUseAuthorizationEvent({ authorization, registry: this.clinicalReleaseRegistry, actor, sequence: this.state.clinicalReleaseEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateClinicalReleaseEvent(event, { sequence: event.sequence, previousHash, registry: this.clinicalReleaseRegistry, challenge: challengeEvent.challenge, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.clinicalReleaseEvents.push(event);
    await this.persist();
    return { event: clone(event), clinicalRelease: await this.clinicalReleaseStatus() };
  }

  async verifyProductionReleaseAuthorization(authorization, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent, context } = await this.currentClinicalReleaseChallenge(authorization?.challengeId);
    const clinicalEvent = this.state.clinicalReleaseEvents.find(event => event.eventType === "clinical-use-authorized" && event.clinicalAuthorization.authorizationId === authorization?.clinicalAuthorizationId);
    if (!clinicalEvent) fail("Production-release authorization does not reference a verified clinical-use authorization.", 400);
    const replay = this.clinicalReleaseReplayState();
    const errors = validateProductionReleaseAuthorization(authorization, { challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.clinicalAuthorization, registry: this.clinicalReleaseRegistry, now: verifiedAt, ...replay });
    if (canonicalClinicalReleaseJson(authorization?.deployment) !== canonicalClinicalReleaseJson(context.acknowledgementEvent?.acknowledgement?.deployment)) errors.push("Production-release authorization deployment does not match the verified provider-preparation deployment.");
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.clinicalReleaseEvents.at(-1)?.hash || "GENESIS";
    const event = createProductionReleaseAuthorizationEvent({ authorization, registry: this.clinicalReleaseRegistry, actor, sequence: this.state.clinicalReleaseEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateClinicalReleaseEvent(event, { sequence: event.sequence, previousHash, registry: this.clinicalReleaseRegistry, challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.clinicalAuthorization, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.clinicalReleaseEvents.push(event);
    await this.persist();
    return { event: clone(event), clinicalRelease: await this.clinicalReleaseStatus() };
  }

  async verifyReleaseDeploymentAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent } = await this.currentClinicalReleaseChallenge(attestation?.challengeId);
    const clinicalEvent = this.state.clinicalReleaseEvents.find(event => event.eventType === "clinical-use-authorized" && event.clinicalAuthorizationFingerprint === attestation?.clinicalAuthorizationFingerprint);
    const productionEvent = this.state.clinicalReleaseEvents.find(event => event.eventType === "production-release-authorized" && event.productionAuthorizationFingerprint === attestation?.productionAuthorizationFingerprint);
    if (!clinicalEvent || !productionEvent) fail("Release-deployment attestation requires both verified clinical and production authorizations.", 400);
    const replay = this.clinicalReleaseReplayState();
    const errors = validateReleaseDeploymentAttestation(attestation, { challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.clinicalAuthorization, productionAuthorization: productionEvent.productionAuthorization, registry: this.clinicalReleaseRegistry, now: verifiedAt, ...replay });
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.clinicalReleaseEvents.at(-1)?.hash || "GENESIS";
    const event = createReleaseDeploymentAttestationEvent({ attestation, registry: this.clinicalReleaseRegistry, actor, sequence: this.state.clinicalReleaseEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateClinicalReleaseEvent(event, { sequence: event.sequence, previousHash, registry: this.clinicalReleaseRegistry, challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.clinicalAuthorization, productionAuthorization: productionEvent.productionAuthorization, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.clinicalReleaseEvents.push(event);
    await this.persist();
    return { event: clone(event), clinicalRelease: await this.clinicalReleaseStatus() };
  }

  verifyTrafficActivationEventChain() {
    const events = this.state?.trafficActivationEvents || [];
    const challenges = new Map();
    const clinicalAuthorizations = new Map();
    const operationsAuthorizations = new Map();
    const seenReceiptIds = new Set();
    const seenSignatureHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const challengeId = event.eventType === "traffic-activation-challenge-issued" ? event.challenge?.challengeId
        : event.eventType === "first-governed-transaction-attested" ? event.attestation?.challengeId
          : event.authorization?.challengeId;
      const challenge = event.eventType === "traffic-activation-challenge-issued" ? null : challenges.get(challengeId);
      const clinicalAuthorization = event.eventType === "traffic-activation-operations-authorized"
        ? clinicalAuthorizations.get(challengeId)?.authorization
        : event.eventType === "first-governed-transaction-attested"
          ? [...clinicalAuthorizations.values()].find(item => item.fingerprint === event.attestation?.clinicalAuthorizationFingerprint)?.authorization
          : null;
      const operationsAuthorization = event.eventType === "first-governed-transaction-attested"
        ? [...operationsAuthorizations.values()].find(item => item.fingerprint === event.attestation?.operationsAuthorizationFingerprint)?.authorization
        : null;
      const errors = validateTrafficActivationEvent(event, {
        sequence: index + 1,
        previousHash,
        registry: this.trafficActivationRegistry,
        challenge,
        clinicalAuthorization,
        operationsAuthorization,
        now: event.createdAt,
        seenReceiptIds,
        seenSignatureHashes
      });
      if (event.eventType !== "traffic-activation-challenge-issued" && !challenge) errors.push("Traffic-activation evidence has no prior challenge event.");
      if (event.eventType === "traffic-activation-clinical-authorized" && clinicalAuthorizations.has(challengeId)) errors.push("Traffic-activation challenge repeats clinical concurrence.");
      if (event.eventType === "traffic-activation-operations-authorized" && (!clinicalAuthorization || operationsAuthorizations.has(challengeId))) errors.push("Operations concurrence requires exactly one prior clinical concurrence.");
      if (event.eventType === "first-governed-transaction-attested" && (!clinicalAuthorization || !operationsAuthorization)) errors.push("First-transaction witness has incomplete dual-control evidence.");
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        challenges: events.filter(item => item.eventType === "traffic-activation-challenge-issued").length,
        clinicalConcurrences: events.filter(item => item.eventType === "traffic-activation-clinical-authorized").length,
        operationsConcurrences: events.filter(item => item.eventType === "traffic-activation-operations-authorized").length,
        firstTransactions: events.filter(item => item.eventType === "first-governed-transaction-attested").length
      };
      if (event.eventType === "traffic-activation-challenge-issued") challenges.set(event.challenge.challengeId, event.challenge);
      if (event.eventType === "traffic-activation-clinical-authorized") {
        clinicalAuthorizations.set(challengeId, { authorization: event.authorization, fingerprint: event.authorizationFingerprint });
        seenReceiptIds.add(event.authorization.authorizationId);
        seenSignatureHashes.add(digest(event.authorization.signature.value));
      }
      if (event.eventType === "traffic-activation-operations-authorized") {
        operationsAuthorizations.set(challengeId, { authorization: event.authorization, fingerprint: event.authorizationFingerprint });
        seenReceiptIds.add(event.authorization.authorizationId);
        seenSignatureHashes.add(digest(event.authorization.signature.value));
      }
      if (event.eventType === "first-governed-transaction-attested") {
        seenReceiptIds.add(event.attestation.attestationId);
        seenSignatureHashes.add(digest(event.attestation.signature.value));
      }
      previousHash = event.hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      challenges: events.filter(item => item.eventType === "traffic-activation-challenge-issued").length,
      clinicalConcurrences: events.filter(item => item.eventType === "traffic-activation-clinical-authorized").length,
      operationsConcurrences: events.filter(item => item.eventType === "traffic-activation-operations-authorized").length,
      firstTransactions: events.filter(item => item.eventType === "first-governed-transaction-attested").length
    };
  }

  async trafficActivationContext(candidateId) {
    const clinicalRelease = await this.clinicalReleaseStatus();
    const continuity = this.pilotStartContinuityContext();
    const candidate = clinicalRelease.candidates.find(item => item.candidate.id === candidateId);
    const releaseProof = candidate ? {
      gateFingerprint: clinicalRelease.gateFingerprint,
      chainHead: clinicalRelease.chain.head,
      clinicalAuthorizationFingerprint: candidate.clinicalAuthorization ? trafficActivationDigest(candidate.clinicalAuthorization) : null,
      productionAuthorizationFingerprint: candidate.productionAuthorization ? trafficActivationDigest(candidate.productionAuthorization) : null,
      deploymentAttestationFingerprint: candidate.deploymentAttestation ? trafficActivationDigest(candidate.deploymentAttestation) : null
    } : null;
    return { clinicalRelease, continuity, candidate, releaseProof };
  }

  async trafficActivationStatus() {
    await this.init();
    return buildTrafficActivationWitness({
      clinicalRelease: await this.clinicalReleaseStatus(),
      continuity: this.pilotStartContinuityContext(),
      registry: this.trafficActivationRegistry,
      events: this.state.trafficActivationEvents,
      chain: this.verifyTrafficActivationEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  async issueTrafficActivationChallenge(candidateId, actor = "Demo reviewer") {
    await this.init();
    const createdAt = this.clock().toISOString();
    const registrySummary = summarizeTrafficActivationRegistry(this.trafficActivationRegistry, createdAt);
    if (!registrySummary.registryCurrent) fail("Provision a current, owner-only traffic-activation witness registry at server startup before issuing a challenge.", 409);
    const activeKeys = this.trafficActivationRegistry.keys.filter(key => key.candidateIds.includes(candidateId) && Date.parse(key.notBefore) <= Date.parse(createdAt) && Date.parse(createdAt) <= Date.parse(key.notAfter));
    const purposes = new Set(activeKeys.map(key => key.purpose));
    if (!TRAFFIC_ACTIVATION_KEY_PURPOSES.every(purpose => purposes.has(purpose)) || new Set(activeKeys.map(key => key.publicKeyPem)).size < 3) fail("This candidate requires three distinct current traffic-witness duty keys.", 409);
    const context = await this.trafficActivationContext(candidateId);
    if (!context.candidate?.releaseReadyForTrafficActivation || !context.releaseProof?.deploymentAttestationFingerprint) fail("Current three-seal release-ready evidence is required before traffic-activation witnessing.", 409);
    if (!context.continuity.allCurrent) fail("Current recovery, rollback, monitoring, incident-response, and study-safety evidence is required before traffic-activation witnessing.", 409);
    const previousHash = this.state.trafficActivationEvents.at(-1)?.hash || "GENESIS";
    const event = createTrafficActivationChallenge({
      candidate: context.candidate,
      releaseProof: context.releaseProof,
      continuityFingerprint: context.continuity.continuityFingerprint,
      registry: this.trafficActivationRegistry,
      actor,
      sequence: this.state.trafficActivationEvents.length + 1,
      previousHash,
      createdAt
    });
    const errors = validateTrafficActivationEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.trafficActivationEvents.push(event);
    await this.persist();
    return { challenge: clone(event.challenge), event: clone(event), trafficActivation: await this.trafficActivationStatus() };
  }

  trafficActivationReplayState() {
    return {
      seenReceiptIds: new Set(this.state.trafficActivationEvents.flatMap(event => event.eventType === "first-governed-transaction-attested" ? [event.attestation.attestationId] : event.authorization ? [event.authorization.authorizationId] : [])),
      seenSignatureHashes: new Set(this.state.trafficActivationEvents.flatMap(event => event.eventType === "first-governed-transaction-attested" ? [digest(event.attestation.signature.value)] : event.authorization ? [digest(event.authorization.signature.value)] : []))
    };
  }

  async currentTrafficActivationChallenge(challengeId, { requireUnexpired = true } = {}) {
    const event = this.state.trafficActivationEvents.find(item => item.eventType === "traffic-activation-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) fail("Traffic-activation evidence does not reference an issued challenge.", 400);
    const context = await this.trafficActivationContext(event.challenge.candidateId);
    const errors = validateTrafficActivationChallenge(event.challenge, {
      candidate: context.candidate,
      releaseProof: context.releaseProof,
      continuityFingerprint: context.continuity.continuityFingerprint,
      registryFingerprint: trafficActivationRegistryFingerprint(this.trafficActivationRegistry)
    });
    if (!context.candidate?.releaseReadyForTrafficActivation) errors.push("The three-seal clinical-release evidence is no longer current.");
    if (!context.continuity.allCurrent) errors.push("Traffic-activation continuity evidence is no longer current.");
    if (requireUnexpired && Date.parse(this.clock().toISOString()) > Date.parse(event.challenge.expiresAt)) errors.push("Traffic-activation challenge has expired.");
    if (errors.length) fail(errors.join(" "), 409);
    return { event, context };
  }

  async verifyClinicalTrafficAuthorization(authorization, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent, context } = await this.currentTrafficActivationChallenge(authorization?.challengeId);
    if (this.state.trafficActivationEvents.some(event => event.eventType === "traffic-activation-clinical-authorized" && event.authorization.challengeId === authorization.challengeId)) fail("This traffic-activation challenge already has clinical concurrence.", 409);
    const replay = this.trafficActivationReplayState();
    const errors = validateTrafficActivationAuthorization(authorization, { challenge: challengeEvent.challenge, registry: this.trafficActivationRegistry, purpose: "clinical-traffic-activation-clinical", now: verifiedAt, ...replay });
    if (canonicalTrafficActivationJson(authorization?.deployment) !== canonicalTrafficActivationJson(context.candidate?.deploymentAttestation?.deployment)) errors.push("Clinical traffic concurrence deployment does not match the verified release deployment.");
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.trafficActivationEvents.at(-1)?.hash || "GENESIS";
    const event = createClinicalTrafficAuthorizationEvent({ authorization, registry: this.trafficActivationRegistry, actor, sequence: this.state.trafficActivationEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateTrafficActivationEvent(event, { sequence: event.sequence, previousHash, registry: this.trafficActivationRegistry, challenge: challengeEvent.challenge, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.trafficActivationEvents.push(event);
    await this.persist();
    return { event: clone(event), trafficActivation: await this.trafficActivationStatus() };
  }

  async verifyOperationsTrafficAuthorization(authorization, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent, context } = await this.currentTrafficActivationChallenge(authorization?.challengeId);
    const clinicalEvent = this.state.trafficActivationEvents.find(event => event.eventType === "traffic-activation-clinical-authorized" && event.authorization.challengeId === authorization?.challengeId);
    if (!clinicalEvent) fail("Operations traffic concurrence requires prior verified clinical concurrence for the same challenge.", 400);
    if (this.state.trafficActivationEvents.some(event => event.eventType === "traffic-activation-operations-authorized" && event.authorization.challengeId === authorization.challengeId)) fail("This traffic-activation challenge already has operations concurrence.", 409);
    const replay = this.trafficActivationReplayState();
    const errors = validateTrafficActivationAuthorization(authorization, { challenge: challengeEvent.challenge, registry: this.trafficActivationRegistry, purpose: "clinical-traffic-activation-operations", now: verifiedAt, ...replay });
    if (trafficActivationPlanFingerprint(authorization) !== clinicalEvent.activationPlanFingerprint) errors.push("Operations traffic concurrence does not match the clinical activation plan.");
    if (canonicalTrafficActivationJson(authorization?.deployment) !== canonicalTrafficActivationJson(context.candidate?.deploymentAttestation?.deployment)) errors.push("Operations traffic concurrence deployment does not match the verified release deployment.");
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.trafficActivationEvents.at(-1)?.hash || "GENESIS";
    const event = createOperationsTrafficAuthorizationEvent({ authorization, registry: this.trafficActivationRegistry, actor, sequence: this.state.trafficActivationEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateTrafficActivationEvent(event, { sequence: event.sequence, previousHash, registry: this.trafficActivationRegistry, challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.authorization, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.trafficActivationEvents.push(event);
    await this.persist();
    return { event: clone(event), trafficActivation: await this.trafficActivationStatus() };
  }

  async verifyFirstGovernedTransactionAttestation(attestation, actor = "Demo reviewer") {
    await this.init();
    const verifiedAt = this.clock().toISOString();
    const { event: challengeEvent } = await this.currentTrafficActivationChallenge(attestation?.challengeId, { requireUnexpired: false });
    const clinicalEvent = this.state.trafficActivationEvents.find(event => event.eventType === "traffic-activation-clinical-authorized" && event.authorizationFingerprint === attestation?.clinicalAuthorizationFingerprint);
    const operationsEvent = this.state.trafficActivationEvents.find(event => event.eventType === "traffic-activation-operations-authorized" && event.authorizationFingerprint === attestation?.operationsAuthorizationFingerprint);
    if (!clinicalEvent || !operationsEvent || clinicalEvent.authorization.challengeId !== attestation?.challengeId || operationsEvent.authorization.challengeId !== attestation?.challengeId) fail("First-transaction witness requires both verified activation concurrences for the same challenge.", 400);
    if (this.state.trafficActivationEvents.some(event => event.eventType === "first-governed-transaction-attested" && event.attestation.challengeId === attestation.challengeId)) fail("This activation challenge already has a first-transaction witness.", 409);
    const replay = this.trafficActivationReplayState();
    const errors = validateFirstGovernedTransactionAttestation(attestation, { challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.authorization, operationsAuthorization: operationsEvent.authorization, registry: this.trafficActivationRegistry, now: verifiedAt, ...replay });
    if (errors.length) fail(errors.join(" "), 400);
    const previousHash = this.state.trafficActivationEvents.at(-1)?.hash || "GENESIS";
    const event = createFirstGovernedTransactionEvent({ attestation, registry: this.trafficActivationRegistry, actor, sequence: this.state.trafficActivationEvents.length + 1, previousHash, verifiedAt });
    const eventErrors = validateTrafficActivationEvent(event, { sequence: event.sequence, previousHash, registry: this.trafficActivationRegistry, challenge: challengeEvent.challenge, clinicalAuthorization: clinicalEvent.authorization, operationsAuthorization: operationsEvent.authorization, now: verifiedAt, ...replay });
    if (eventErrors.length) fail(eventErrors.join(" "), 500);
    this.state.trafficActivationEvents.push(event);
    await this.persist();
    return { event: clone(event), trafficActivation: await this.trafficActivationStatus() };
  }

  verifyIdentityAccessEventChain() {
    const events = this.state?.identityAccessEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const errors = validateIdentityAccessEvent(events[index], { sequence: index + 1, previousHash });
      if (errors.length) return {
        valid: false,
        count: events.length,
        failedAt: index + 1,
        head: events.at(-1)?.hash || null,
        authenticatedMutations: events.length
      };
      previousHash = events[index].hash;
    }
    return {
      valid: true,
      count: events.length,
      failedAt: null,
      head: events.at(-1)?.hash || null,
      authenticatedMutations: events.length
    };
  }

  async recordIdentityAccessDecision(identity, { method, routeClass, permission } = {}) {
    await this.init();
    if (!identity?.authenticated || identity?.signatureVerified !== true || identity?.authorizationEnforced !== true) fail("Only a verified, externally issued access decision may enter the identity ledger.", 400);
    const previousHash = this.state.identityAccessEvents.at(-1)?.hash || "GENESIS";
    const event = createIdentityAccessEvent({
      identity,
      method,
      routeClass,
      permission,
      sequence: this.state.identityAccessEvents.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    const errors = validateIdentityAccessEvent(event, { sequence: event.sequence, previousHash });
    if (errors.length) fail(errors.join(" "), 500);
    this.state.identityAccessEvents.push(event);
    await this.persist();
    return clone(event);
  }

  async identityAccessStatus(gatewayStatus) {
    await this.init();
    return buildIdentityAccessStatus({
      gatewayStatus,
      events: this.state.identityAccessEvents,
      chain: this.verifyIdentityAccessEventChain(),
      generatedAt: this.clock().toISOString()
    });
  }

  assessmentIndex(id) {
    const index = this.state.assessments.findIndex(assessment => assessment.id === id);
    if (index < 0) fail("Synthetic assessment not found.", 404);
    return index;
  }

  appendRevision(entry) {
    this.state.revisions ||= [];
    const previous = this.state.revisions.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.revisions.length + 1,
      previousHash: previous?.hash || "GENESIS",
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const revision = { ...core, hash: digest(core) };
    this.state.revisions.push(revision);
    return revision;
  }

  verifyRevisionChain() {
    const revisions = this.state?.revisions || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < revisions.length; index += 1) {
      const { hash, ...core } = revisions[index];
      if (core.sequence !== index + 1 || core.previousHash !== previousHash || digest(core) !== hash) {
        return { valid: false, count: revisions.length, failedAt: index + 1, head: revisions.at(-1)?.hash || null };
      }
      previousHash = hash;
    }
    return { valid: true, count: revisions.length, failedAt: null, head: revisions.at(-1)?.hash || null };
  }

  appendFeedbackEvent(feedback, type = "recorded") {
    this.state.feedbackEvents ||= [];
    const previous = this.state.feedbackEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.feedbackEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type,
      feedbackId: feedback.id,
      feedbackHash: digest(feedback),
      createdAt: this.clock().toISOString(),
      note: type === "recorded" ? "Structured reviewer return committed at submission." : "Legacy reviewer-feedback integrity baseline."
    };
    const event = { ...core, hash: digest(core) };
    this.state.feedbackEvents.push(event);
    return event;
  }

  verifyFeedbackEventChain() {
    const events = this.state?.feedbackEvents || [];
    const feedback = this.state?.feedback || [];
    const byId = new Map(feedback.map(item => [item.id, item]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const entry = byId.get(core.feedbackId);
      const validType = core.type === "recorded" || core.type === "legacy-baseline";
      if (
        core.sequence !== index + 1
        || core.previousHash !== previousHash
        || digest(core) !== hash
        || !validType
        || !entry
        || seen.has(core.feedbackId)
        || digest(entry) !== core.feedbackHash
      ) {
        return {
          valid: false,
          count: events.length,
          failedAt: index + 1,
          head: events.at(-1)?.hash || null,
          legacyBaselines: events.filter(item => item.type === "legacy-baseline").length
        };
      }
      seen.add(core.feedbackId);
      previousHash = hash;
    }
    const valid = seen.size === feedback.length;
    return {
      valid,
      count: events.length,
      failedAt: valid ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      legacyBaselines: events.filter(item => item.type === "legacy-baseline").length
    };
  }

  appendIncidentEvent(entry) {
    this.state.incidentEvents ||= [];
    const previous = this.state.incidentEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.incidentEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const event = { ...core, hash: digest(core) };
    this.state.incidentEvents.push(event);
    return event;
  }

  verifyIncidentChain() {
    const events = this.state?.incidentEvents || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      if (core.sequence !== index + 1 || core.previousHash !== previousHash || digest(core) !== hash) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      }
      previousHash = hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null };
  }

  appendComparisonEvent(comparison, type = "recorded") {
    this.state.comparisonEvents ||= [];
    const previous = this.state.comparisonEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.comparisonEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type,
      comparisonId: comparison.id,
      comparisonHash: digest(comparison),
      createdAt: this.clock().toISOString(),
      note: type === "recorded" ? "Outcome committed at submission." : "Legacy integrity baseline."
    };
    const event = { ...core, hash: digest(core) };
    this.state.comparisonEvents.push(event);
    return event;
  }

  verifyComparisonChain() {
    const events = this.state?.comparisonEvents || [];
    const comparisons = this.state?.comparisons || [];
    const byId = new Map(comparisons.map(item => [item.id, item]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const comparison = byId.get(core.comparisonId);
      if (
        core.sequence !== index + 1
        || core.previousHash !== previousHash
        || digest(core) !== hash
        || !comparison
        || seen.has(core.comparisonId)
        || digest(comparison) !== core.comparisonHash
      ) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null, legacyBaselines: events.filter(item => item.type === "legacy-baseline").length };
      }
      seen.add(core.comparisonId);
      previousHash = hash;
    }
    const valid = seen.size === comparisons.length;
    return {
      valid,
      count: events.length,
      failedAt: valid ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      legacyBaselines: events.filter(item => item.type === "legacy-baseline").length
    };
  }

  appendTimingEvent(observation, type = "recorded") {
    this.state.timingEvents ||= [];
    const previous = this.state.timingEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.timingEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type,
      observationId: observation.id,
      observationHash: digest(observation),
      createdAt: this.clock().toISOString(),
      note: type === "recorded" ? "Workflow timing observation committed at submission." : "Legacy workflow timing integrity baseline."
    };
    const event = { ...core, hash: digest(core) };
    this.state.timingEvents.push(event);
    return event;
  }

  verifyTimingEventChain() {
    const events = this.state?.timingEvents || [];
    const observations = this.state?.timingObservations || [];
    const byId = new Map(observations.map(item => [item.id, item]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const observation = byId.get(core.observationId);
      if (
        core.sequence !== index + 1
        || core.previousHash !== previousHash
        || digest(core) !== hash
        || !observation
        || seen.has(core.observationId)
        || digest(observation) !== core.observationHash
      ) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      }
      seen.add(core.observationId);
      previousHash = hash;
    }
    const valid = seen.size === observations.length;
    return {
      valid,
      count: events.length,
      failedAt: valid ? null : events.length + 1,
      head: events.at(-1)?.hash || null
    };
  }

  providerDescriptor() {
    return this.modelProvider.describe ? this.modelProvider.describe() : {
      id: this.modelProvider.id,
      version: this.modelProvider.version,
      mode: this.modelProvider.mode,
      promptVersion: "unversioned",
      policyVersion: "unversioned",
      policyHash: "0".repeat(64),
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      approvedBy: "unrecorded",
      approvalScope: "synthetic-calibration-only",
      phiApproved: false,
      externalTransmission: false,
      failureMode: "fail-closed"
    };
  }

  generationFor(assessmentId) {
    const generationId = this.state?.activeGenerations?.[assessmentId];
    const record = (this.state?.generationRecords || []).find(item => item.id === generationId && item.assessmentId === assessmentId);
    if (!record) fail(`No materialized generation snapshot is available for ${assessmentId}.`, 500);
    return record;
  }

  async generateBundleFor(assessment) {
    const bundle = this.modelProvider.generateCase
      ? await this.modelProvider.generateCase(assessment)
      : {
          narratives: await this.modelProvider.generateBundle(assessment),
          interpretation: await this.modelProvider.interpret(assessment)
        };
    const raw = {
      narratives: Object.fromEntries(Object.entries(bundle.narratives || {}).map(([audience, narrative]) => [audience, narrative?.text])),
      interpretation: {
        hypotheses: clone(bundle.interpretation?.hypotheses || []),
        questions: clone(bundle.interpretation?.questions || [])
      }
    };
    const errors = validateGenerationBundle(raw, assessment);
    if (errors.length) fail(`Generation failed the clinical persistence gate (${errors.length} validation issue${errors.length === 1 ? "" : "s"}).`, 502);
    const descriptor = this.providerDescriptor();
    for (const narrative of Object.values(bundle.narratives || {})) {
      if (narrative.provider !== descriptor.id || narrative.version !== descriptor.version || narrative.promptVersion !== descriptor.promptVersion || narrative.policyHash !== descriptor.policyHash) {
        fail("Generation provenance does not match the loaded provider configuration.", 502);
      }
    }
    if (bundle.interpretation.provider !== descriptor.id || bundle.interpretation.version !== descriptor.version || bundle.interpretation.promptVersion !== descriptor.promptVersion || bundle.interpretation.policyHash !== descriptor.policyHash) {
      fail("Interpretation provenance does not match the loaded provider configuration.", 502);
    }
    return clone(bundle);
  }

  appendGenerationEvent(record, type) {
    this.state.generationEvents ||= [];
    const previous = this.state.generationEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.generationEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type,
      generationId: record.id,
      generationHash: record.hash,
      assessmentId: record.assessmentId,
      createdAt: this.clock().toISOString(),
      note: type === "migration-materialized"
        ? "A current deterministic snapshot was materialized during schema-v14 migration; it does not prove the identity of any pre-migration on-demand draft."
        : "Validated generation snapshot committed before clinician review."
    };
    const event = { ...core, hash: digest(core) };
    this.state.generationEvents.push(event);
    return event;
  }

  commitGeneration(assessment, bundle, { origin = "runtime-generation", actor = "PERL generation gateway" } = {}) {
    this.state.generationRecords ||= [];
    this.state.activeGenerations ||= {};
    const descriptor = this.providerDescriptor();
    const core = {
      id: randomUUID(),
      assessmentId: assessment.id,
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      inputHash: digest(projectModelInput(assessment)),
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      outputHash: digest(bundle),
      provider: clone(descriptor),
      bundle: clone(bundle),
      origin,
      actor,
      createdAt: this.clock().toISOString(),
      note: origin === "schema-v14-migration"
        ? "The first persistent snapshot was generated at migration from the then-loaded deterministic baseline."
        : "Scoring-only input and clinically validated structured output were materialized for reproducible review."
    };
    const record = { ...core, hash: digest(core) };
    this.state.generationRecords.push(record);
    this.state.activeGenerations[assessment.id] = record.id;
    this.appendGenerationEvent(record, origin === "schema-v14-migration" ? "migration-materialized" : "generated");
    return record;
  }

  async ensureGenerationSnapshots(origin, actor) {
    let changed = false;
    for (const assessment of this.state.assessments) {
      if (this.state.activeGenerations?.[assessment.id]) continue;
      const bundle = await this.generateBundleFor(assessment);
      this.commitGeneration(assessment, bundle, { origin, actor });
      changed = true;
    }
    return changed;
  }

  verifyGenerationEventChain() {
    const records = this.state?.generationRecords || [];
    const events = this.state?.generationEvents || [];
    const recordById = new Map(records.map(item => [item.id, item]));
    const assessmentById = new Map((this.state?.assessments || []).map(item => [item.id, item]));
    const seen = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const record = recordById.get(core.generationId);
      const assessment = assessmentById.get(core.assessmentId);
      const { hash: recordHash, ...recordCore } = record || {};
      const raw = record ? {
        narratives: Object.fromEntries(Object.entries(record.bundle?.narratives || {}).map(([audience, narrative]) => [audience, narrative?.text])),
        interpretation: {
          hypotheses: clone(record.bundle?.interpretation?.hypotheses || []),
          questions: clone(record.bundle?.interpretation?.questions || [])
        }
      } : null;
      const narrativeProvenanceValid = record && Object.values(record.bundle?.narratives || {}).every(narrative => (
        narrative.provider === record.provider.id
        && narrative.version === record.provider.version
        && narrative.promptVersion === record.provider.promptVersion
        && narrative.policyHash === record.provider.policyHash
        && narrative.inputSchemaVersion === record.inputSchemaVersion
        && narrative.outputSchemaVersion === record.outputSchemaVersion
      ));
      const interpretationProvenanceValid = record
        && record.bundle?.interpretation?.provider === record.provider.id
        && record.bundle?.interpretation?.version === record.provider.version
        && record.bundle?.interpretation?.promptVersion === record.provider.promptVersion
        && record.bundle?.interpretation?.policyHash === record.provider.policyHash
        && record.bundle?.interpretation?.inputSchemaVersion === record.inputSchemaVersion
        && record.bundle?.interpretation?.outputSchemaVersion === record.outputSchemaVersion;
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && ["generated", "migration-materialized"].includes(core.type)
        && record
        && assessment
        && record.assessmentId === core.assessmentId
        && record.hash === core.generationHash
        && digest(recordCore) === recordHash
        && record.inputSchemaVersion === MODEL_INPUT_CONTRACT
        && record.inputHash === digest(projectModelInput(assessment))
        && record.outputSchemaVersion === GENERATION_OUTPUT_CONTRACT
        && record.outputHash === digest(record.bundle)
        && record.provider?.phiApproved === false
        && record.provider?.approvalScope === "synthetic-calibration-only"
        && ["rules", "structured-candidate"].includes(record.provider?.mode)
        && narrativeProvenanceValid
        && interpretationProvenanceValid
        && validateGenerationBundle(raw, assessment).length === 0
        && !seen.has(record.id)
        && digest(core) === hash;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      seen.add(record.id);
      previousHash = hash;
    }
    const activeValid = Object.keys(this.state?.activeGenerations || {}).length === assessmentById.size
      && [...assessmentById.keys()].every(assessmentId => {
        const record = recordById.get(this.state.activeGenerations[assessmentId]);
        return record?.assessmentId === assessmentId && record.inputHash === digest(projectModelInput(assessmentById.get(assessmentId)));
      });
    const complete = seen.size === records.length && activeValid;
    return {
      valid: complete,
      count: events.length,
      failedAt: complete ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      active: Object.keys(this.state?.activeGenerations || {}).length,
      migrationSnapshots: events.filter(item => item.type === "migration-materialized").length
    };
  }

  async generationStatus() {
    await this.init();
    return {
      ...generationGatewayStatus(this.modelProvider),
      materialization: {
        mode: "one-active-snapshot-per-assessment",
        active: Object.keys(this.state.activeGenerations).length,
        records: this.state.generationRecords.length,
        regeneratedOnRead: false
      },
      chain: this.verifyGenerationEventChain()
    };
  }

  async currentReportContent(assessmentId) {
    const generation = this.generationFor(assessmentId);
    const generatedNarrative = generation.bundle.narratives.clinician;
    const generatedInterpretation = generation.bundle.interpretation;
    return {
      narrative: clone(this.state.narratives[assessmentId]?.clinician || generatedNarrative),
      interpretation: clone(this.state.interpretations[assessmentId] || generatedInterpretation)
    };
  }

  async appendReportArtifact(assessmentId, type = "approved", note = "Approved clinician attachment committed at approval.", content = null) {
    this.state.reportArtifacts ||= [];
    const assessment = clone(this.state.assessments[this.assessmentIndex(assessmentId)]);
    const review = clone(this.reviewFor(assessmentId));
    const { narrative, interpretation } = content || await this.currentReportContent(assessmentId);
    const clinicalBrief = buildClinicalBrief({ assessment, interpretation, narrative: narrative.text });
    const clinicalBriefErrors = validateClinicalBrief(clinicalBrief, assessment);
    if (clinicalBriefErrors.length) fail(`Clinical brief is not ready for an immutable artifact. ${clinicalBriefErrors.join(" ")}`, 409);
    const previous = this.state.reportArtifacts.at(-1);
    const sourceReceipt = this.state.sourceEvents.find(item => item.assessmentId === assessmentId) || null;
    const core = {
      id: randomUUID(),
      sequence: this.state.reportArtifacts.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type,
      reportFormat: REPORT_CONTRACT.format,
      disclaimerVersion: REPORT_CONTRACT.disclaimerVersion,
      assessmentId,
      audience: "clinician",
      sourceAssessmentHash: scoredSourceDigest(assessment),
      sourceProvenance: sourceReceipt ? {
        contractVersion: sourceReceipt.contractVersion,
        contractStatus: sourceReceipt.contractStatus,
        sourceEventReceiptHash: sourceReceipt.hash,
        sourceEventHash: sourceReceipt.sourceEventHash,
        scoringVersion: sourceReceipt.scoringVersion,
        findingsReportVersion: sourceReceipt.findingsReportVersion,
        findingsReportHash: sourceReceipt.findingsReportHash
      } : null,
      assessment,
      narrative,
      interpretation,
      clinicalBrief,
      review,
      provider: {
        id: narrative.provider,
        version: narrative.version,
        mode: this.modelProvider.mode,
        promptVersion: narrative.promptVersion,
        policyHash: narrative.policyHash,
        inputSchemaVersion: narrative.inputSchemaVersion,
        outputSchemaVersion: narrative.outputSchemaVersion
      },
      createdAt: this.clock().toISOString(),
      note
    };
    const artifact = { ...core, hash: digest(core) };
    this.state.reportArtifacts.push(artifact);
    return artifact;
  }

  verifyReportArtifactChain() {
    const artifacts = this.state?.reportArtifacts || [];
    let previousHash = "GENESIS";
    for (let index = 0; index < artifacts.length; index += 1) {
      const { hash, ...core } = artifacts[index];
      if (core.sequence !== index + 1 || core.previousHash !== previousHash || digest(core) !== hash) {
        return { valid: false, count: artifacts.length, failedAt: index + 1, head: artifacts.at(-1)?.hash || null, legacyBaselines: artifacts.filter(item => item.type === "legacy-baseline").length };
      }
      previousHash = hash;
    }
    return {
      valid: true,
      count: artifacts.length,
      failedAt: null,
      head: artifacts.at(-1)?.hash || null,
      legacyBaselines: artifacts.filter(item => item.type === "legacy-baseline").length
    };
  }

  latestReportArtifact(assessmentId) {
    return [...(this.state.reportArtifacts || [])].reverse().find(item => item.assessmentId === assessmentId) || null;
  }

  async ensureApprovedReportBaselines() {
    let changed = false;
    for (const assessment of this.state.assessments) {
      if (this.reviewFor(assessment.id).status !== "approved" || this.latestReportArtifact(assessment.id)) continue;
      await this.appendReportArtifact(
        assessment.id,
        "legacy-baseline",
        "Approval snapshot established during schema-v7 migration or synthetic seed initialization. This does not prove pre-baseline immutability."
      );
      changed = true;
    }
    return changed;
  }

  loadedRuntimeVersions() {
    return {
      model: this.modelProvider.version,
      "report-template": REPORT_CONTRACT.format,
      disclaimer: REPORT_CONTRACT.disclaimerVersion,
      "state-schema": `sandbox-state/${this.state.schemaVersion}`,
      "release-evaluator": "deterministic-offline-v2"
    };
  }

  appendChangeEvent(entry) {
    this.state.changeEvents ||= [];
    const previous = this.state.changeEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.changeEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const event = { ...core, hash: digest(core) };
    this.state.changeEvents.push(event);
    return event;
  }

  verifyChangeEventChain() {
    const events = this.state?.changeEvents || [];
    const candidates = new Map();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      let semanticallyValid = true;
      const candidate = candidates.get(core.candidateId);
      if (core.type === "proposed") {
        semanticallyValid = !candidate;
        candidates.set(core.candidateId, { decided: false, replayPassed: false });
      } else if (core.type === "replayed") {
        semanticallyValid = Boolean(candidate && !candidate.decided);
        if (candidate) candidate.replayPassed = Boolean(core.engineeringRegressionPassed);
      } else if (core.type === "disposition") {
        semanticallyValid = Boolean(candidate && !candidate.decided)
          && (core.disposition !== "advance-for-clinical-review" || candidate.replayPassed);
        if (candidate) candidate.decided = true;
      } else {
        semanticallyValid = false;
      }
      if (core.sequence !== index + 1 || core.previousHash !== previousHash || digest(core) !== hash || !semanticallyValid) {
        return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      }
      previousHash = hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null };
  }

  appendSourceEventReceipt(entry) {
    this.state.sourceEvents ||= [];
    const previous = this.state.sourceEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.sourceEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type: "synthetic-score-event-imported",
      ...clone(entry),
      receivedAt: this.clock().toISOString()
    };
    const receipt = { ...core, hash: digest(core) };
    this.state.sourceEvents.push(receipt);
    return receipt;
  }

  verifySourceEventChain() {
    const receipts = this.state?.sourceEvents || [];
    const eventIds = new Set();
    const idempotencyKeys = new Set();
    const assessmentIds = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < receipts.length; index += 1) {
      const { hash, ...core } = receipts[index];
      const unique = !eventIds.has(core.eventIdHash)
        && !idempotencyKeys.has(core.idempotencyKeyHash)
        && !assessmentIds.has(core.assessmentId);
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.type === "synthetic-score-event-imported"
        && core.contractStatus === "proposed-rfi-only"
        && core.eventType === "assessment.scored"
        && digest(core) === hash
        && unique;
      if (!valid) return { valid: false, count: receipts.length, failedAt: index + 1, head: receipts.at(-1)?.hash || null };
      eventIds.add(core.eventIdHash);
      idempotencyKeys.add(core.idempotencyKeyHash);
      assessmentIds.add(core.assessmentId);
      previousHash = hash;
    }
    return { valid: true, count: receipts.length, failedAt: null, head: receipts.at(-1)?.hash || null };
  }

  async listSourceEvents() {
    await this.init();
    return {
      status: "rfi-rehearsal",
      authoritativeContract: false,
      phiApproved: false,
      acceptedEnvironment: "calibration",
      modelProjection: "scoring-only",
      rescoreBehavior: "fail-closed-pending-authoritative-supersession-contract",
      events: clone(this.state.sourceEvents),
      chain: this.verifySourceEventChain()
    };
  }

  appendAutomationEvent(entry) {
    this.state.automationEvents ||= [];
    const previous = this.state.automationEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.automationEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: PROVIDER_WORKFLOW_CONTRACT,
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const event = { ...core, hash: digest(core) };
    this.state.automationEvents.push(event);
    return event;
  }

  queueWorkflowReview(sourceReceipt, actor, origin = "runtime-automation") {
    const existing = this.state.automationEvents.find(item => item.type === "review-queued" && item.assessmentId === sourceReceipt.assessmentId);
    if (existing) return existing;
    return this.appendAutomationEvent({
      type: "review-queued",
      status: "awaiting-review",
      assessmentId: sourceReceipt.assessmentId,
      sourceEventReceiptHash: sourceReceipt.hash,
      origin,
      trigger: origin === "schema-v13-baseline" ? "migration" : "source-event-import",
      actor,
      note: origin === "schema-v13-baseline"
        ? "Workflow baseline derived during schema-v13 migration; it does not prove pre-migration automation."
        : "Synthetic Findings event accepted and routed into the clinician review queue without an additional intake step."
    });
  }

  queueWorkflowHandoff(sourceReceipt, artifact, actor, { origin = "runtime-automation", trigger = "clinician-approval", jobId = randomUUID(), attempt = 1 } = {}) {
    return this.appendAutomationEvent({
      type: "handoff-queued",
      status: "queued",
      assessmentId: sourceReceipt.assessmentId,
      sourceEventReceiptHash: sourceReceipt.hash,
      reportArtifactId: artifact.id,
      reportArtifactHash: artifact.hash,
      jobId,
      attempt,
      origin,
      trigger,
      actor,
      note: origin === "schema-v13-baseline"
        ? "Handoff baseline derived during schema-v13 migration; it does not prove pre-migration automation."
        : "Current approved clinician artifact entered the bounded handoff-preparation queue automatically."
    });
  }

  completeWorkflowHandoff(job, attachment, actor, origin = job.origin) {
    return this.appendAutomationEvent({
      type: "handoff-prepared",
      status: "prepared-not-attached",
      assessmentId: job.assessmentId,
      sourceEventReceiptHash: job.sourceEventReceiptHash,
      reportArtifactId: job.reportArtifactId,
      reportArtifactHash: job.reportArtifactHash,
      attachmentReceiptHash: attachment.hash,
      jobId: job.jobId,
      attempt: job.attempt,
      origin,
      trigger: job.trigger,
      actor,
      note: origin === "schema-v13-baseline"
        ? "Prepared-state baseline derived during schema-v13 migration; it does not prove pre-migration automation."
        : "Hash-bound handoff manifest prepared; no file was attached and no write to e-QPASS is claimed."
    });
  }

  failWorkflowHandoff(job, error, actor) {
    return this.appendAutomationEvent({
      type: "handoff-failed",
      status: "failed",
      assessmentId: job.assessmentId,
      sourceEventReceiptHash: job.sourceEventReceiptHash,
      reportArtifactId: job.reportArtifactId,
      reportArtifactHash: job.reportArtifactHash,
      jobId: job.jobId,
      attempt: job.attempt,
      errorCode: "PREPARATION_FAILED",
      origin: job.origin,
      trigger: job.trigger,
      actor,
      note: `Handoff preparation stopped safely and may be retried; ${String(error?.message || "the internal preparation step failed").slice(0, 180)}`
    });
  }

  ensureWorkflowBaselines() {
    let changed = false;
    for (const sourceReceipt of this.state.sourceEvents || []) {
      if (!(this.state.automationEvents || []).some(item => item.type === "review-queued" && item.assessmentId === sourceReceipt.assessmentId)) {
        this.queueWorkflowReview(sourceReceipt, "schema-v13-migration", "schema-v13-baseline");
        changed = true;
      }
    }
    for (const attachment of this.state.attachmentEvents || []) {
      if ((this.state.automationEvents || []).some(item => item.type === "handoff-prepared" && item.attachmentReceiptHash === attachment.hash)) continue;
      const sourceReceipt = this.state.sourceEvents.find(item => item.hash === attachment.sourceEventReceiptHash);
      const artifact = this.state.reportArtifacts.find(item => item.id === attachment.reportArtifactId && item.hash === attachment.reportArtifactHash);
      if (!sourceReceipt || !artifact) continue;
      const job = this.queueWorkflowHandoff(sourceReceipt, artifact, "schema-v13-migration", { origin: "schema-v13-baseline", trigger: "migration" });
      this.completeWorkflowHandoff(job, attachment, "schema-v13-migration", "schema-v13-baseline");
      changed = true;
    }
    return changed;
  }

  verifyAutomationEventChain() {
    const events = this.state?.automationEvents || [];
    const jobs = new Map();
    const queuedReviews = new Set();
    const preparedReceipts = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const sourceReceipt = (this.state?.sourceEvents || []).find(item => item.hash === core.sourceEventReceiptHash);
      const commonValid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === PROVIDER_WORKFLOW_CONTRACT
        && PROVIDER_WORKFLOW_TYPES.includes(core.type)
        && sourceReceipt?.assessmentId === core.assessmentId
        && ["runtime-automation", "manual-rehearsal", "schema-v13-baseline"].includes(core.origin)
        && digest(core) === hash;
      let semanticValid = commonValid;
      if (core.type === "review-queued") {
        semanticValid &&= core.status === "awaiting-review" && !queuedReviews.has(core.assessmentId);
        queuedReviews.add(core.assessmentId);
      } else {
        const artifact = (this.state?.reportArtifacts || []).find(item => item.id === core.reportArtifactId && item.hash === core.reportArtifactHash);
        semanticValid &&= Boolean(artifact && artifact.assessmentId === core.assessmentId && /^[0-9a-f-]{36}$/i.test(core.jobId || "") && Number.isInteger(core.attempt) && core.attempt >= 1);
        const prior = jobs.get(core.jobId);
        if (core.type === "handoff-queued") {
          semanticValid &&= prior
            ? prior.type === "handoff-failed" && prior.attempt + 1 === core.attempt && prior.reportArtifactHash === core.reportArtifactHash
            : core.attempt === 1;
        } else if (core.type === "handoff-prepared") {
          const attachment = (this.state?.attachmentEvents || []).find(item => item.hash === core.attachmentReceiptHash);
          semanticValid &&= prior?.type === "handoff-queued"
            && prior.attempt === core.attempt
            && attachment?.assessmentId === core.assessmentId
            && attachment?.reportArtifactHash === core.reportArtifactHash
            && core.status === "prepared-not-attached";
          if (core.attachmentReceiptHash) preparedReceipts.add(core.attachmentReceiptHash);
        } else if (core.type === "handoff-failed") {
          semanticValid &&= prior?.type === "handoff-queued"
            && prior.attempt === core.attempt
            && core.status === "failed"
            && core.errorCode === "PREPARATION_FAILED";
        }
        jobs.set(core.jobId, core);
      }
      if (!semanticValid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      previousHash = hash;
    }
    const complete = queuedReviews.size === (this.state?.sourceEvents || []).length
      && preparedReceipts.size === (this.state?.attachmentEvents || []).length;
    return {
      valid: complete,
      count: events.length,
      failedAt: complete ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      migrationBaselines: events.filter(item => item.origin === "schema-v13-baseline").length
    };
  }

  workflowStateFor(assessmentId) {
    const sourceReceipt = (this.state?.sourceEvents || []).find(item => item.assessmentId === assessmentId) || null;
    if (!sourceReceipt) return { status: "not-source-event", eligible: false, currentJob: null, events: [] };
    const review = this.reviewFor(assessmentId);
    const artifact = review.status === "approved" ? this.latestReportArtifact(assessmentId) : null;
    const events = (this.state?.automationEvents || []).filter(item => item.assessmentId === assessmentId);
    const current = artifact ? [...events].reverse().find(item => item.reportArtifactHash === artifact.hash) : null;
    let status = "awaiting-review";
    let eligible = false;
    if (artifact && !current) {
      status = "ready-to-queue";
      eligible = true;
    } else if (current?.type === "handoff-queued") {
      status = "queued";
    } else if (current?.type === "handoff-prepared") {
      status = "prepared-not-attached";
    } else if (current?.type === "handoff-failed") {
      status = "failed";
      eligible = true;
    }
    return { status, eligible, currentJob: current ? clone(current) : null, events: clone(events.slice(-6).reverse()) };
  }

  async listProviderWorkflow() {
    await this.init();
    const states = this.state.sourceEvents.map(item => this.workflowStateFor(item.assessmentId));
    const count = status => states.filter(item => item.status === status).length;
    return {
      contractVersion: PROVIDER_WORKFLOW_CONTRACT,
      authoritativeContract: false,
      phiApproved: false,
      mode: "automatic-preparation-rehearsal",
      boundary: PROVIDER_WORKFLOW_BOUNDARY,
      counts: {
        sourceEvents: this.state.sourceEvents.length,
        awaitingReview: count("awaiting-review"),
        queued: count("queued") + count("ready-to-queue"),
        prepared: count("prepared-not-attached"),
        failed: count("failed")
      },
      events: clone(this.state.automationEvents),
      chain: this.verifyAutomationEventChain()
    };
  }

  async integrationRehearsalStatus(actor = "Demo reviewer") {
    await this.init();
    const advancement = await this.candidateAdvancementStatus(actor);
    return buildIntegrationRehearsalObservatory({
      sourceEvents: this.state.sourceEvents,
      generationRecords: this.state.generationRecords,
      activeGenerations: this.state.activeGenerations,
      reviews: this.state.reviews,
      reportArtifacts: this.state.reportArtifacts,
      attachmentEvents: this.state.attachmentEvents,
      automationEvents: this.state.automationEvents,
      deliveryJobs: this.state.deliveryJobs,
      deliveryEvents: this.state.deliveryEvents,
      activeDeliveries: this.state.activeDeliveries,
      provider: this.providerDescriptor(),
      advancement,
      connector: deliveryGatewayStatus(this.deliveryConnector).connector,
      chains: {
        sourceEvents: this.verifySourceEventChain(),
        generationSnapshots: this.verifyGenerationEventChain(),
        reportArtifacts: this.verifyReportArtifactChain(),
        providerWorkflow: this.verifyAutomationEventChain(),
        attachmentPreparation: this.verifyAttachmentEventChain(),
        deliveryOutbox: this.verifyDeliveryChain(),
        candidateAdvancement: this.verifyCandidateAdvancementChain()
      },
      generatedAt: this.clock().toISOString()
    });
  }

  appendAttachmentEvent(entry) {
    this.state.attachmentEvents ||= [];
    const previous = this.state.attachmentEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.attachmentEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      type: "synthetic-attachment-prepared",
      contractVersion: EQPASS_ATTACHMENT_RFI_CONTRACT,
      contractStatus: EQPASS_ATTACHMENT_RFI_STATUS,
      status: "prepared-not-attached",
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const event = { ...core, hash: digest(core) };
    this.state.attachmentEvents.push(event);
    return event;
  }

  verifyAttachmentEventChain() {
    const events = this.state?.attachmentEvents || [];
    const idempotencyKeys = new Set();
    const artifactHashes = new Set();
    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const sourceReceipt = (this.state?.sourceEvents || []).find(item => item.hash === core.sourceEventReceiptHash);
      const artifact = (this.state?.reportArtifacts || []).find(item => item.id === core.reportArtifactId && item.hash === core.reportArtifactHash);
      const linked = sourceReceipt?.assessmentId === core.assessmentId
        && artifact?.assessmentId === core.assessmentId
        && artifact?.sourceAssessmentHash === core.sourceAssessmentHash
        && artifact?.sourceProvenance?.sourceEventReceiptHash === core.sourceEventReceiptHash
        && sourceReceipt?.scoringVersion === core.scoringVersion
        && sourceReceipt?.findingsReportVersion === core.findingsReportVersion
        && sourceReceipt?.findingsReportHash === core.findingsReportHash;
      const unique = !idempotencyKeys.has(core.idempotencyKeyHash) && !artifactHashes.has(core.reportArtifactHash);
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.type === "synthetic-attachment-prepared"
        && core.contractVersion === EQPASS_ATTACHMENT_RFI_CONTRACT
        && core.contractStatus === EQPASS_ATTACHMENT_RFI_STATUS
        && core.status === "prepared-not-attached"
        && core.renderedMediaType === "text/html"
        && /^[a-f0-9]{64}$/.test(core.requestHash || "")
        && /^[a-f0-9]{64}$/.test(core.idempotencyKeyHash || "")
        && /^[a-f0-9]{64}$/.test(core.renderedContentHash || "")
        && digest(core) === hash
        && linked
        && unique;
      if (!valid) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      idempotencyKeys.add(core.idempotencyKeyHash);
      artifactHashes.add(core.reportArtifactHash);
      previousHash = hash;
    }
    return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null };
  }

  attachmentStateFor(assessmentId) {
    const sourceReceipt = (this.state?.sourceEvents || []).find(item => item.assessmentId === assessmentId) || null;
    const latestEvent = [...(this.state?.attachmentEvents || [])].reverse().find(item => item.assessmentId === assessmentId) || null;
    const review = this.reviewFor(assessmentId);
    const artifact = review.status === "approved" ? this.latestReportArtifact(assessmentId) : null;
    if (!sourceReceipt) return { status: "not-source-event", eligible: false, preparation: null };
    if (!artifact || artifact.type !== "approved") return { status: "awaiting-approval", eligible: false, preparation: latestEvent ? clone(latestEvent) : null };
    if (!latestEvent) return { status: "ready-to-prepare", eligible: true, preparation: null };
    if (latestEvent.reportArtifactId !== artifact.id || latestEvent.reportArtifactHash !== artifact.hash) {
      return { status: "stale", eligible: true, preparation: clone(latestEvent) };
    }
    return { status: "prepared-not-attached", eligible: false, preparation: clone(latestEvent) };
  }

  async listAttachmentEvents() {
    await this.init();
    return {
      status: "rfi-rehearsal",
      authoritativeContract: false,
      phiApproved: false,
      contractVersion: EQPASS_ATTACHMENT_RFI_CONTRACT,
      boundary: "Preparation proves lineage and idempotency; it does not write to e-QPASS or claim a PDF was attached.",
      events: clone(this.state.attachmentEvents),
      chain: this.verifyAttachmentEventChain()
    };
  }

  async prepareEqpassAttachment(request, actor = "Demo reviewer", options = {}) {
    await this.init();
    const requestProvenance = attachmentRequestProvenance(request);
    const existingKey = this.state.attachmentEvents.find(item => item.idempotencyKeyHash === requestProvenance.idempotencyKeyHash);
    if (existingKey) {
      if (existingKey.requestHash !== requestProvenance.requestHash) fail("The attachment idempotency key was reused with different content.", 409);
      return { status: "duplicate", authoritativeContract: false, attachment: clone(existingKey), workflow: this.workflowStateFor(request.assessmentId) };
    }
    const duplicateArtifact = this.state.attachmentEvents.find(item => item.reportArtifactHash === request.reportArtifactHash);
    if (duplicateArtifact) fail("This approved report artifact already has a preparation receipt under a different idempotency key.", 409);

    const assessment = this.state.assessments[this.assessmentIndex(request.assessmentId)];
    const review = this.reviewFor(request.assessmentId);
    if (review.status !== "approved") fail("Only a currently approved clinician artifact can be prepared for attachment.", 409);
    const artifact = this.latestReportArtifact(request.assessmentId);
    if (!artifact || artifact.type !== "approved") fail("A current immutable approved report artifact is required.", 409);
    if (artifact.id !== request.reportArtifactId || artifact.hash !== request.reportArtifactHash) fail("The requested artifact does not match the current approved report snapshot.", 409);
    if (artifact.sourceAssessmentHash !== scoredSourceDigest(assessment)) fail("The approved artifact no longer matches the current scored assessment.", 409);

    const sourceReceipt = this.state.sourceEvents.find(item => item.assessmentId === request.assessmentId);
    if (!sourceReceipt) fail("Attachment preparation is available only for assessments imported through the synthetic e-QPASS source-event rehearsal.", 409);
    if (!artifact.sourceProvenance || artifact.sourceProvenance.sourceEventReceiptHash !== sourceReceipt.hash) {
      fail("The approved artifact is not linked to the current source-event receipt.", 409);
    }

    this.queueWorkflowReview(sourceReceipt, actor, options.workflowOrigin || "manual-rehearsal");
    const workflowJob = options.workflowJob || this.queueWorkflowHandoff(sourceReceipt, artifact, actor, {
      origin: options.workflowOrigin || "manual-rehearsal",
      trigger: options.workflowTrigger || "manual-preparation"
    });

    const renderedContentHash = digest(renderReportPage({ mode: "approved", artifact }));
    const attachment = this.appendAttachmentEvent({
      requestHash: requestProvenance.requestHash,
      idempotencyKeyHash: requestProvenance.idempotencyKeyHash,
      assessmentId: request.assessmentId,
      sourceEventReceiptHash: sourceReceipt.hash,
      sourceEventHash: sourceReceipt.sourceEventHash,
      scoringVersion: sourceReceipt.scoringVersion,
      findingsReportVersion: sourceReceipt.findingsReportVersion,
      findingsReportHash: sourceReceipt.findingsReportHash,
      reportArtifactId: artifact.id,
      reportArtifactHash: artifact.hash,
      sourceAssessmentHash: artifact.sourceAssessmentHash,
      renderedReportFormat: artifact.reportFormat,
      renderedMediaType: "text/html",
      renderedContentHash,
      disclaimerVersion: artifact.disclaimerVersion,
      providerId: artifact.provider.id,
      providerVersion: artifact.provider.version,
      actor,
      note: "Synthetic handoff manifest prepared from the current approved artifact; no PDF was written to e-QPASS and no attachment is claimed."
    });
    this.completeWorkflowHandoff(workflowJob, attachment, actor, options.workflowOrigin || workflowJob.origin);
    this.queueDeliveryForAttachment(attachment, actor, options.workflowOrigin === "schema-v13-baseline" ? "schema-v15-baseline" : "runtime-automation");
    this.addAudit(request.assessmentId, "Synthetic attachment handoff prepared", `Approved artifact ${artifact.id} · receipt ${attachment.hash.slice(0, 12)}`, actor);
    if (options.persist !== false) await this.persist();
    return { status: "prepared", authoritativeContract: false, attachment: clone(attachment), workflow: this.workflowStateFor(request.assessmentId) };
  }

  async retryProviderWorkflow(assessmentId, actor = "Demo reviewer") {
    await this.init();
    this.assessmentIndex(assessmentId);
    const state = this.workflowStateFor(assessmentId);
    if (state.status !== "failed" || !state.currentJob) fail("Only a failed handoff-preparation job can be retried.", 409);
    const review = this.reviewFor(assessmentId);
    const artifact = review.status === "approved" ? this.latestReportArtifact(assessmentId) : null;
    if (!artifact || artifact.hash !== state.currentJob.reportArtifactHash) fail("The failed job is no longer linked to the current approved artifact.", 409);
    const sourceReceipt = this.state.sourceEvents.find(item => item.assessmentId === assessmentId);
    const job = this.queueWorkflowHandoff(sourceReceipt, artifact, actor, {
      origin: "runtime-automation",
      trigger: "operator-retry",
      jobId: state.currentJob.jobId,
      attempt: state.currentJob.attempt + 1
    });
    try {
      const result = await this.prepareEqpassAttachment(automaticAttachmentRequest(assessmentId, artifact), actor, {
        workflowJob: job,
        workflowOrigin: "runtime-automation",
        workflowTrigger: "operator-retry",
        persist: false
      });
      await this.persist();
      return result;
    } catch (error) {
      this.failWorkflowHandoff(job, error, actor);
      this.addAudit(assessmentId, "Automatic handoff retry failed safely", `Attempt ${job.attempt} remains inside the synthetic boundary`, actor);
      await this.persist();
      return { status: "failed", authoritativeContract: false, workflow: this.workflowStateFor(assessmentId) };
    }
  }

  appendDeliveryEvent(entry) {
    this.state.deliveryEvents ||= [];
    const previous = this.state.deliveryEvents.at(-1);
    const core = {
      id: randomUUID(),
      sequence: this.state.deliveryEvents.length + 1,
      previousHash: previous?.hash || "GENESIS",
      contractVersion: DELIVERY_OUTBOX_CONTRACT,
      ...clone(entry),
      createdAt: this.clock().toISOString()
    };
    const event = { ...core, hash: digest(core) };
    this.state.deliveryEvents.push(event);
    return event;
  }

  queueDeliveryForAttachment(attachment, actor = "PERL automation", origin = "runtime-automation") {
    this.state.deliveryJobs ||= [];
    this.state.activeDeliveries ||= {};
    const existing = this.state.deliveryJobs.find(item => item.attachmentReceiptHash === attachment.hash);
    if (existing) return existing;
    const artifact = this.state.reportArtifacts.find(item => item.id === attachment.reportArtifactId && item.hash === attachment.reportArtifactHash);
    const sourceReceipt = this.state.sourceEvents.find(item => item.hash === attachment.sourceEventReceiptHash);
    if (!artifact || !sourceReceipt || sourceReceipt.assessmentId !== attachment.assessmentId) {
      fail("A delivery job requires an intact prepared attachment, approved artifact, and source receipt lineage.", 500);
    }
    const connector = deliveryGatewayStatus(this.deliveryConnector).connector;
    const core = {
      id: randomUUID(),
      contractVersion: DELIVERY_OUTBOX_CONTRACT,
      assessmentId: attachment.assessmentId,
      sourceEventReceiptHash: attachment.sourceEventReceiptHash,
      reportArtifactId: attachment.reportArtifactId,
      reportArtifactHash: attachment.reportArtifactHash,
      attachmentReceiptHash: attachment.hash,
      renderedContentHash: attachment.renderedContentHash,
      idempotencyKey: `FF-TEST-DELIVERY-${attachment.reportArtifactHash.slice(0, 32).toUpperCase()}`,
      maxAttempts: DELIVERY_MAX_ATTEMPTS,
      origin,
      createdAt: this.clock().toISOString()
    };
    const job = { ...core, hash: digest(core) };
    this.state.deliveryJobs.push(job);
    this.state.activeDeliveries[job.assessmentId] = job.id;
    this.appendDeliveryEvent({
      type: "delivery-queued",
      status: connector.enabled ? "ready" : "awaiting-authorized-connector",
      jobId: job.id,
      jobHash: job.hash,
      assessmentId: job.assessmentId,
      reportArtifactHash: job.reportArtifactHash,
      attachmentReceiptHash: job.attachmentReceiptHash,
      attempt: 0,
      connectorId: connector.id,
      connectorVersion: connector.version,
      connectorMode: connector.mode,
      origin,
      actor,
      note: origin === "schema-v15-baseline"
        ? "Delivery-outbox baseline derived during schema-v15 migration; it does not prove a pre-migration delivery attempt."
        : connector.enabled
          ? "Prepared synthetic attachment committed to the delivery outbox and is ready for the explicitly authorized connector."
          : "Prepared synthetic attachment committed durably; delivery is held before any attempt because the e-QPASS connector is disabled."
    });
    return job;
  }

  ensureDeliveryBaselines() {
    let changed = false;
    for (const attachment of this.state.attachmentEvents || []) {
      if ((this.state.deliveryJobs || []).some(item => item.attachmentReceiptHash === attachment.hash)) continue;
      this.queueDeliveryForAttachment(attachment, "schema-v15-migration", "schema-v15-baseline");
      changed = true;
    }
    return changed;
  }

  deliveryStateFor(jobOrId) {
    const job = typeof jobOrId === "string"
      ? (this.state?.deliveryJobs || []).find(item => item.id === jobOrId)
      : jobOrId;
    if (!job) return null;
    const events = (this.state?.deliveryEvents || []).filter(item => item.jobId === job.id);
    const current = events.at(-1) || null;
    return {
      job: clone(job),
      status: current?.status || "unknown",
      attempt: current?.attempt || 0,
      currentEvent: current ? clone(current) : null,
      events: clone(events.slice(-6).reverse()),
      active: this.state.activeDeliveries?.[job.assessmentId] === job.id
    };
  }

  verifyDeliveryChain() {
    const jobs = this.state?.deliveryJobs || [];
    const events = this.state?.deliveryEvents || [];
    const jobIds = new Set();
    const attachmentHashes = new Set();
    const jobById = new Map();
    const latestByAssessment = new Map();
    for (let index = 0; index < jobs.length; index += 1) {
      const { hash, ...core } = jobs[index];
      const attachment = (this.state?.attachmentEvents || []).find(item => item.hash === core.attachmentReceiptHash);
      const artifact = (this.state?.reportArtifacts || []).find(item => item.id === core.reportArtifactId && item.hash === core.reportArtifactHash);
      const linked = attachment?.assessmentId === core.assessmentId
        && attachment?.reportArtifactId === core.reportArtifactId
        && attachment?.reportArtifactHash === core.reportArtifactHash
        && attachment?.renderedContentHash === core.renderedContentHash
        && artifact?.assessmentId === core.assessmentId;
      const valid = core.contractVersion === DELIVERY_OUTBOX_CONTRACT
        && /^FF-TEST-[A-Z0-9-]+$/.test(core.assessmentId || "")
        && /^FF-TEST-DELIVERY-[A-F0-9]+$/.test(core.idempotencyKey || "")
        && core.maxAttempts === DELIVERY_MAX_ATTEMPTS
        && digest(core) === hash
        && linked
        && !jobIds.has(core.id)
        && !attachmentHashes.has(core.attachmentReceiptHash);
      if (!valid) return { valid: false, jobs: jobs.length, events: events.length, failedAt: `job-${index + 1}`, head: events.at(-1)?.hash || null };
      jobIds.add(core.id);
      attachmentHashes.add(core.attachmentReceiptHash);
      jobById.set(core.id, jobs[index]);
      latestByAssessment.set(core.assessmentId, core.id);
    }

    let previousHash = "GENESIS";
    const stateByJob = new Map();
    const attemptsByJob = new Map();
    for (let index = 0; index < events.length; index += 1) {
      const { hash, ...core } = events[index];
      const job = jobById.get(core.jobId);
      const prior = stateByJob.get(core.jobId);
      const attempts = attemptsByJob.get(core.jobId) || 0;
      let transitionValid = false;
      if (core.type === "delivery-queued") {
        transitionValid = !prior && core.attempt === 0 && ["ready", "awaiting-authorized-connector"].includes(core.status);
      } else if (core.type === "delivery-attempted") {
        transitionValid = ["ready"].includes(prior?.status) && core.status === "in-flight" && core.attempt === attempts + 1 && core.attempt <= job?.maxAttempts;
      } else if (core.type === "delivery-retry-scheduled") {
        transitionValid = prior?.type === "delivery-attempted" && core.status === "retry-wait" && core.attempt === attempts;
      } else if (core.type === "delivery-dead-lettered") {
        transitionValid = prior?.type === "delivery-attempted" && core.status === "dead-lettered" && core.attempt === job?.maxAttempts;
      } else if (core.type === "delivery-rehearsed") {
        transitionValid = prior?.type === "delivery-attempted" && core.status === "rehearsed-not-attached" && core.attempt === attempts && /^[a-f0-9]{64}$/.test(core.acknowledgementHash || "");
      } else if (core.type === "delivery-requeued") {
        transitionValid = prior?.type === "delivery-retry-scheduled"
          && ["ready", "awaiting-authorized-connector"].includes(core.status)
          && core.attempt === attempts;
      }
      const valid = core.sequence === index + 1
        && core.previousHash === previousHash
        && core.contractVersion === DELIVERY_OUTBOX_CONTRACT
        && job?.hash === core.jobHash
        && job?.assessmentId === core.assessmentId
        && job?.reportArtifactHash === core.reportArtifactHash
        && job?.attachmentReceiptHash === core.attachmentReceiptHash
        && Number.isInteger(core.attempt)
        && core.attempt >= 0
        && digest(core) === hash
        && transitionValid;
      if (!valid) return { valid: false, jobs: jobs.length, events: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
      if (core.type === "delivery-attempted") attemptsByJob.set(core.jobId, core.attempt);
      stateByJob.set(core.jobId, events[index]);
      previousHash = hash;
    }

    const everyJobQueued = jobs.every(job => stateByJob.has(job.id));
    const active = this.state?.activeDeliveries || {};
    const activeValid = Object.keys(active).length === latestByAssessment.size
      && [...latestByAssessment].every(([assessmentId, jobId]) => active[assessmentId] === jobId);
    const valid = everyJobQueued && activeValid && jobs.length === attachmentHashes.size;
    return {
      valid,
      jobs: jobs.length,
      events: events.length,
      failedAt: valid ? null : events.length + 1,
      head: events.at(-1)?.hash || null,
      active: Object.keys(active).length,
      migrationBaselines: events.filter(item => item.origin === "schema-v15-baseline").length
    };
  }

  recoverInterruptedDeliveryAttempts() {
    let changed = false;
    for (const job of this.state?.deliveryJobs || []) {
      const current = this.deliveryStateFor(job)?.currentEvent;
      if (current?.type !== "delivery-attempted") continue;
      const deadLetter = current.attempt >= job.maxAttempts;
      this.appendDeliveryEvent({
        type: deadLetter ? "delivery-dead-lettered" : "delivery-retry-scheduled",
        status: deadLetter ? "dead-lettered" : "retry-wait",
        jobId: job.id,
        jobHash: job.hash,
        assessmentId: job.assessmentId,
        reportArtifactHash: job.reportArtifactHash,
        attachmentReceiptHash: job.attachmentReceiptHash,
        attempt: current.attempt,
        connectorId: current.connectorId,
        connectorVersion: current.connectorVersion,
        connectorMode: current.connectorMode,
        errorCode: "DELIVERY_INTERRUPTED",
        origin: "startup-recovery",
        actor: "startup-recovery",
        note: "An interrupted in-flight delivery attempt was recovered without assuming a remote write; idempotent operator review is required."
      });
      changed = true;
    }
    return changed;
  }

  async listDeliveryOutbox() {
    await this.init();
    const gateway = deliveryGatewayStatus(this.deliveryConnector);
    const states = (this.state.deliveryJobs || []).map(job => this.deliveryStateFor(job));
    const count = status => states.filter(item => item.status === status).length;
    return {
      ...gateway,
      counts: {
        packages: states.length,
        awaitingConnector: count("awaiting-authorized-connector"),
        ready: count("ready"),
        inFlight: count("in-flight"),
        retryWait: count("retry-wait"),
        deadLettered: count("dead-lettered"),
        receipts: count("rehearsed-not-attached")
      },
      jobs: clone(states.slice(-12).reverse()),
      chain: this.verifyDeliveryChain()
    };
  }

  async processDeliveryJob(jobId, actor = "Demo reviewer") {
    await this.init();
    const job = this.state.deliveryJobs.find(item => item.id === jobId);
    if (!job) fail("Delivery job not found.", 404);
    if (this.state.activeDeliveries[job.assessmentId] !== job.id) fail("Only the active delivery job for the current approved artifact can run.", 409);
    const connector = deliveryGatewayStatus(this.deliveryConnector).connector;
    if (!connector.enabled) fail("The delivery connector is disabled; the package remains durably held without an attempt.", 409);
    const state = this.deliveryStateFor(job);
    if (state.status !== "ready") fail("Only a ready delivery job can run. Retry-wait jobs require an explicit operator retry.", 409);
    const attempt = state.attempt + 1;
    if (attempt > job.maxAttempts) fail("Delivery attempt limit reached; the job is dead-lettered.", 409);
    const artifact = this.state.reportArtifacts.find(item => item.id === job.reportArtifactId && item.hash === job.reportArtifactHash);
    const attachment = this.state.attachmentEvents.find(item => item.hash === job.attachmentReceiptHash);
    if (!artifact || !attachment || this.latestReportArtifact(job.assessmentId)?.hash !== artifact.hash || this.reviewFor(job.assessmentId).status !== "approved") {
      fail("The delivery job no longer matches the current approved artifact and cannot run.", 409);
    }
    const renderedContent = renderReportPage({ mode: "approved", artifact });
    const request = buildDeliveryRequest({ job, artifact, attachment, renderedContent });
    this.appendDeliveryEvent({
      type: "delivery-attempted",
      status: "in-flight",
      jobId: job.id,
      jobHash: job.hash,
      assessmentId: job.assessmentId,
      reportArtifactHash: job.reportArtifactHash,
      attachmentReceiptHash: job.attachmentReceiptHash,
      attempt,
      connectorId: connector.id,
      connectorVersion: connector.version,
      connectorMode: connector.mode,
      requestHash: digest(request),
      origin: "operator-action",
      actor,
      note: "An explicitly authorized synthetic connector attempt began from the durable outbox; idempotency protects an uncertain outcome."
    });
    await this.persist();
    try {
      const acknowledgement = await this.deliveryConnector.deliver(request);
      const event = this.appendDeliveryEvent({
        type: "delivery-rehearsed",
        status: "rehearsed-not-attached",
        jobId: job.id,
        jobHash: job.hash,
        assessmentId: job.assessmentId,
        reportArtifactHash: job.reportArtifactHash,
        attachmentReceiptHash: job.attachmentReceiptHash,
        attempt,
        connectorId: connector.id,
        connectorVersion: connector.version,
        connectorMode: connector.mode,
        acknowledgementHash: digest(acknowledgement),
        receiptIdHash: digest(acknowledgement.receiptId),
        remoteWriteClaimed: false,
        origin: "operator-action",
        actor,
        note: "The authorized synthetic connector returned a valid rehearsal receipt; no production attachment or remote write is claimed."
      });
      this.addAudit(job.assessmentId, "Synthetic delivery receipt recorded", `Outbox job ${job.id.slice(0, 8)} · attempt ${attempt}`, actor);
      await this.persist();
      return { status: event.status, job: clone(job), event: clone(event), chain: this.verifyDeliveryChain(), authoritativeContract: false };
    } catch (error) {
      const deadLetter = attempt >= job.maxAttempts;
      const errorCode = ["DELIVERY_TIMEOUT", "DELIVERY_ACK_REJECTED", "DELIVERY_REQUEST_REJECTED", "DELIVERY_UNAVAILABLE"].includes(error?.code)
        ? error.code
        : "DELIVERY_UNAVAILABLE";
      const event = this.appendDeliveryEvent({
        type: deadLetter ? "delivery-dead-lettered" : "delivery-retry-scheduled",
        status: deadLetter ? "dead-lettered" : "retry-wait",
        jobId: job.id,
        jobHash: job.hash,
        assessmentId: job.assessmentId,
        reportArtifactHash: job.reportArtifactHash,
        attachmentReceiptHash: job.attachmentReceiptHash,
        attempt,
        connectorId: connector.id,
        connectorVersion: connector.version,
        connectorMode: connector.mode,
        errorCode,
        origin: "operator-action",
        actor,
        note: deadLetter
          ? "The bounded synthetic attempt limit was reached. The package entered the dead-letter queue and no remote write is claimed."
          : "The synthetic connector attempt failed safely. The package remains durable and requires an explicit idempotent operator retry."
      });
      this.addAudit(job.assessmentId, deadLetter ? "Delivery moved to dead letter" : "Delivery retry scheduled", `Outbox job ${job.id.slice(0, 8)} · ${errorCode}`, actor);
      await this.persist();
      return { status: event.status, errorCode, job: clone(job), event: clone(event), chain: this.verifyDeliveryChain(), authoritativeContract: false };
    }
  }

  async retryDeliveryJob(jobId, actor = "Demo reviewer") {
    await this.init();
    const job = this.state.deliveryJobs.find(item => item.id === jobId);
    if (!job) fail("Delivery job not found.", 404);
    const state = this.deliveryStateFor(job);
    if (state.status !== "retry-wait") fail("Only a retry-wait delivery job can be retried; dead-lettered jobs require a new governed connector decision.", 409);
    const connector = deliveryGatewayStatus(this.deliveryConnector).connector;
    this.appendDeliveryEvent({
      type: "delivery-requeued",
      status: connector.enabled ? "ready" : "awaiting-authorized-connector",
      jobId: job.id,
      jobHash: job.hash,
      assessmentId: job.assessmentId,
      reportArtifactHash: job.reportArtifactHash,
      attachmentReceiptHash: job.attachmentReceiptHash,
      attempt: state.attempt,
      connectorId: connector.id,
      connectorVersion: connector.version,
      connectorMode: connector.mode,
      origin: "operator-action",
      actor,
      note: connector.enabled
        ? "The operator requeued the durable synthetic package for the next bounded idempotent connector attempt."
        : "The operator reviewed the failed package, but it remains held because no delivery connector is authorized."
    });
    await this.persist();
    if (!connector.enabled) return { status: "awaiting-authorized-connector", job: clone(job), chain: this.verifyDeliveryChain(), authoritativeContract: false };
    return this.processDeliveryJob(job.id, actor);
  }

  async refinementBrief() {
    await this.init();
    const brief = buildRefinementBrief({
      feedback: this.state.feedback,
      revisions: this.state.revisions,
      comparisons: this.state.comparisons,
      incidents: this.incidentRecords(),
      manifest: this.calibrationManifest,
      generatedAt: this.clock().toISOString()
    });
    const integrity = {
      feedback: this.verifyFeedbackEventChain(),
      revisions: this.verifyRevisionChain(),
      blindOutcomes: this.verifyComparisonChain(),
      incidents: this.verifyIncidentChain()
    };
    const fingerprint = digest({
      contract: brief.contract,
      sourceCounts: brief.sourceCounts,
      coverage: brief.coverage,
      signals: brief.signals,
      chainHeads: Object.fromEntries(Object.entries(integrity).map(([key, chain]) => [key, chain.head || "GENESIS"]))
    });
    return {
      ...brief,
      integrity: {
        algorithm: "sha256",
        fingerprint,
        sources: integrity
      }
    };
  }

  changeRecords() {
    const records = new Map();
    for (const event of this.state.changeEvents || []) {
      if (event.type === "proposed") {
        records.set(event.candidateId, {
          id: event.candidateId,
          component: event.component,
          candidateVersion: event.candidateVersion,
          baselineVersion: event.baselineVersion,
          reason: event.reason,
          owner: event.actor,
          affectedCases: clone(event.affectedCases),
          caseSet: clone(event.caseSet),
          refinementEvidence: clone(event.refinementEvidence || null),
          proposedAt: event.createdAt,
          status: "proposed",
          latestReplay: null,
          disposition: null,
          events: [clone(event)]
        });
        continue;
      }
      const record = records.get(event.candidateId);
      if (!record) continue;
      record.events.push(clone(event));
      if (event.type === "replayed") {
        record.latestReplay = clone(event);
        record.status = event.engineeringRegressionPassed ? "replay-passed" : "replay-failed";
      }
      if (event.type === "disposition") {
        record.disposition = clone(event);
        record.status = event.disposition;
      }
    }
    return [...records.values()].sort((left, right) => right.proposedAt.localeCompare(left.proposedAt));
  }

  async listChanges() {
    await this.init();
    return {
      runtimeVersions: this.loadedRuntimeVersions(),
      candidates: clone(this.changeRecords()),
      chain: this.verifyChangeEventChain(),
      boundary: "A passed synthetic replay can advance a candidate to clinical review. It cannot authorize live clinical release."
    };
  }

  async proposeChange({ component, baselineVersion, reason, refinementSignalIds = [] } = {}, actor = "Demo reviewer") {
    await this.init();
    const versions = this.loadedRuntimeVersions();
    if (!Object.hasOwn(versions, component)) fail("Choose a supported loaded component for change control.");
    const baseline = String(baselineVersion || "").trim();
    const rationale = String(reason || "").trim();
    if (baseline.length < 2 || baseline.length > 120) fail("Baseline version must contain 2 to 120 characters.");
    if (rationale.length < 20 || rationale.length > 1000) fail("Change reason must contain 20 to 1,000 characters.");
    if (this.changeRecords().some(record => record.component === component && !record.disposition)) fail("This component already has an open change candidate.", 409);
    const requestedSignalIds = [...new Set((Array.isArray(refinementSignalIds) ? refinementSignalIds : []).map(value => String(value).trim()).filter(Boolean))];
    if (requestedSignalIds.length > 5) fail("A change candidate may pin at most five refinement signals.");
    let refinementEvidence = null;
    if (requestedSignalIds.length) {
      const brief = await this.refinementBrief();
      const byId = new Map(brief.signals.map(item => [item.id, item]));
      const selected = requestedSignalIds.map(id => byId.get(id));
      if (selected.some(item => !item)) fail("One or more refinement signals are no longer present in the current evidence brief.", 409);
      if (selected.some(item => !item.candidateEligible)) fail("Every linked refinement signal must meet the independent case and reviewer threshold before it can scope a loaded candidate.", 409);
      refinementEvidence = {
        contract: REFINEMENT_CONTRACT.id,
        briefFingerprint: brief.integrity.fingerprint,
        generatedAt: brief.generatedAt,
        signalSnapshots: selected.map(item => ({
          id: item.id,
          sourceType: item.sourceType,
          title: item.title,
          evidenceCount: item.evidenceCount,
          caseIds: clone(item.caseIds),
          reviewers: clone(item.reviewers),
          evidenceIds: clone(item.evidenceIds),
          improvementTarget: item.improvementTarget,
          regressionFocus: item.regressionFocus,
          signalHash: digest(item)
        })),
        sourceChainHeads: Object.fromEntries(Object.entries(brief.integrity.sources).map(([key, chain]) => [key, chain.head || "GENESIS"])),
        clinicalValidation: false,
        claimBoundary: REFINEMENT_CONTRACT.claimBoundary
      };
    }
    const candidateId = randomUUID();
    const affectedCases = Object.entries(this.calibrationManifest.cases)
      .filter(([, entry]) => entry.assignmentEnabled)
      .map(([id]) => id);
    this.appendChangeEvent({
      type: "proposed",
      candidateId,
      component,
      baselineVersion: baseline,
      candidateVersion: versions[component],
      reason: rationale,
      actor,
      affectedCases,
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version, manifestHash: digest(this.calibrationManifest) },
      refinementEvidence,
      clinicalReleaseAuthorized: false
    });
    await this.persist();
    return clone(this.changeRecords().find(record => record.id === candidateId));
  }

  async replayChange(candidateId, actor = "Demo reviewer") {
    await this.init();
    const record = this.changeRecords().find(item => item.id === candidateId);
    if (!record) fail("Change candidate not found.", 404);
    if (record.disposition) fail("A decided candidate cannot be replayed.", 409);
    const loadedVersion = this.loadedRuntimeVersions()[record.component];
    if (loadedVersion !== record.candidateVersion) fail("The registered candidate version is no longer loaded. Register the current version as a new candidate.", 409);
    const evidence = await evaluateReleaseEvidence({
      assessments: this.state.assessments,
      references: this.calibrationReferences,
      manifest: this.calibrationManifest,
      modelProvider: this.modelProvider,
      clock: this.clock
    });
    const event = this.appendChangeEvent({
      type: "replayed",
      candidateId,
      component: record.component,
      candidateVersion: record.candidateVersion,
      actor,
      evaluator: evidence.evaluator,
      engineeringRegressionPassed: evidence.engineeringRegressionPassed,
      clinicalValidation: false,
      evidence,
      boundary: "This replay covers the frozen synthetic engineering set only. It does not authorize a clinical pilot or production release."
    });
    await this.persist();
    return { event: clone(event), candidate: clone(this.changeRecords().find(item => item.id === candidateId)), chain: this.verifyChangeEventChain() };
  }

  async decideChange(candidateId, { disposition, note } = {}, actor = "Demo reviewer") {
    await this.init();
    const record = this.changeRecords().find(item => item.id === candidateId);
    if (!record) fail("Change candidate not found.", 404);
    if (record.disposition) fail("This change candidate already has a final sandbox disposition.", 409);
    if (!["advance-for-clinical-review", "rollback"].includes(disposition)) fail("Choose advance for clinical review or rollback.");
    const decisionNote = String(note || "").trim();
    if (decisionNote.length < 20 || decisionNote.length > 2000) fail("Disposition note must contain 20 to 2,000 characters.");
    if (disposition === "advance-for-clinical-review") {
      this.assertStudyActive();
      if (!record.latestReplay?.engineeringRegressionPassed) fail("A passing replay of the loaded candidate is required before clinical review.", 409);
    }
    const event = this.appendChangeEvent({
      type: "disposition",
      candidateId,
      component: record.component,
      candidateVersion: record.candidateVersion,
      disposition,
      note: decisionNote,
      actor,
      clinicalReleaseAuthorized: false,
      boundary: disposition === "rollback"
        ? "The candidate is closed and must not advance."
        : "The candidate may enter independent clinical review. Live clinical release remains blocked."
    });
    await this.persist();
    return { event: clone(event), candidate: clone(this.changeRecords().find(item => item.id === candidateId)), chain: this.verifyChangeEventChain() };
  }

  invalidateApproval(assessmentId, reason, actor = "Demo reviewer") {
    const review = this.reviewFor(assessmentId);
    if (review.status !== "approved") return false;
    const index = this.assessmentIndex(assessmentId);
    review.status = "ready";
    review.reviewer = "Unassigned";
    review.approvedAt = null;
    review.updatedAt = this.clock().toISOString();
    this.state.reviews[assessmentId] = review;
    this.state.assessments[index].status = "ready";
    this.state.assessments[index].reviewer = "Unassigned";
    this.addAudit(assessmentId, "Approval reopened", reason, actor);
    return true;
  }

  incidentRecords() {
    const records = new Map();
    for (const event of this.state.incidentEvents || []) {
      if (event.type === "reported") {
        records.set(event.incidentId, {
          id: event.incidentId,
          assessmentId: event.assessmentId || null,
          caseId: event.caseId || null,
          category: event.category,
          severity: event.severity,
          summary: event.summary,
          detail: event.detail,
          status: "open",
          reportedBy: event.actor,
          reportedAt: event.createdAt,
          resolution: null
        });
      } else if (event.type === "resolved" && records.has(event.incidentId)) {
        const record = records.get(event.incidentId);
        record.status = "resolved";
        record.resolution = { note: event.resolution, actor: event.actor, createdAt: event.createdAt };
      }
    }
    return [...records.values()].reverse();
  }

  studyControl() {
    const incidents = this.incidentRecords();
    const open = incidents.filter(item => item.status === "open");
    const stopping = open.filter(item => ["high", "critical"].includes(item.severity));
    return {
      state: stopping.length ? "paused" : "active",
      generationAllowed: stopping.length === 0,
      openIncidents: open.length,
      highSeverityOpen: stopping.length,
      reason: stopping.length
        ? "An unresolved high-severity safety incident has paused blind generation, submission, and summary approval."
        : "No unresolved high-severity stopping event is recorded."
    };
  }

  assertStudyActive() {
    const control = this.studyControl();
    if (!control.generationAllowed) fail(control.reason, 423);
  }

  studyPausedMilliseconds(startAt, endAt) {
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    const stopping = new Map();
    let pauseStartedAt = null;
    let paused = 0;
    for (const event of this.state.incidentEvents || []) {
      const timestamp = new Date(event.createdAt).getTime();
      if (!Number.isFinite(timestamp) || timestamp > end) break;
      const wasPaused = stopping.size > 0;
      if (event.type === "reported" && ["high", "critical"].includes(event.severity)) stopping.set(event.incidentId, event.severity);
      if (event.type === "resolved") stopping.delete(event.incidentId);
      const isPaused = stopping.size > 0;
      if (!wasPaused && isPaused) pauseStartedAt = timestamp;
      if (wasPaused && !isPaused && pauseStartedAt != null) {
        paused += Math.max(0, Math.min(end, timestamp) - Math.max(start, pauseStartedAt));
        pauseStartedAt = null;
      }
    }
    if (stopping.size && pauseStartedAt != null) paused += Math.max(0, end - Math.max(start, pauseStartedAt));
    return Math.min(end - start, paused);
  }

  reviewTimingFor(pending, submittedAt) {
    if (!pending?.createdAt) return null;
    const assignedMs = new Date(pending.createdAt).getTime();
    const submittedMs = new Date(submittedAt).getTime();
    const rawSeconds = Math.max(0, Math.round((submittedMs - assignedMs) / 1000));
    const pausedSeconds = Math.round(this.studyPausedMilliseconds(pending.createdAt, submittedAt) / 1000);
    const activeSeconds = Math.max(0, rawSeconds - pausedSeconds);
    const minimumEligibleSeconds = WORKFLOW_TIMING_CONTRACT.eligibilityWindowSeconds.minimum;
    const maximumEligibleSeconds = WORKFLOW_TIMING_CONTRACT.eligibilityWindowSeconds.maximum;
    const clockValid = Number.isFinite(assignedMs) && Number.isFinite(submittedMs) && submittedMs >= assignedMs;
    const eligible = clockValid && activeSeconds >= minimumEligibleSeconds && activeSeconds <= maximumEligibleSeconds;
    const flag = !clockValid
      ? "clock-anomaly"
      : activeSeconds < minimumEligibleSeconds
        ? "below-protocol-floor"
        : activeSeconds > maximumEligibleSeconds
          ? "above-protocol-ceiling"
          : null;
    return {
      assignedAt: pending.createdAt,
      submittedAt,
      rawSeconds,
      pausedSeconds,
      activeSeconds,
      eligible,
      flag,
      measurement: "server-wall-clock-v1"
    };
  }

  reviewFor(id) {
    return this.state.reviews[id] || {
      status: "ready",
      reviewer: "Unassigned",
      safetyAcknowledged: false,
      approvedAt: null,
      updatedAt: null
    };
  }

  addAudit(id, action, detail, actor = "Demo reviewer") {
    const createdAt = this.clock().toISOString();
    const entry = {
      id: randomUUID(),
      time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(this.clock()),
      actor,
      action,
      detail,
      createdAt
    };
    this.state.audit[id] ||= [];
    this.state.audit[id].unshift(entry);
    return entry;
  }

  async listAssessments() {
    await this.init();
    return this.state.assessments.map(assessment => ({
      ...clone(assessment),
      ...clone(this.reviewFor(assessment.id)),
      coverage: coverageScore(assessment)
    }));
  }

  async getAssessment(id) {
    await this.init();
    const assessment = clone(this.state.assessments[this.assessmentIndex(id)]);
    const generation = this.generationFor(id);
    const generated = generation.bundle.narratives;
    const generatedInterpretation = generation.bundle.interpretation;
    const interpretation = this.state.interpretations[id] || generatedInterpretation;
    const stored = this.state.narratives[id] || {};
    const approvedArtifact = this.reviewFor(id).status === "approved" ? this.latestReportArtifact(id) : null;
    const clinicianNarrative = clone(stored.clinician || generated.clinician);
    const clinicalBrief = buildClinicalBrief({ assessment, interpretation, narrative: clinicianNarrative.text });
    return {
      assessment: { ...assessment, ...clone(this.reviewFor(id)) },
      review: clone(this.reviewFor(id)),
      narratives: { ...generated, ...clone(stored) },
      interpretation,
      clinicalBrief,
      audit: clone(this.state.audit[id] || []),
      feedback: clone(this.state.feedback.filter(item => item.assessmentId === id)),
      revisions: clone(this.state.revisions.filter(item => item.assessmentId === id).slice().reverse()),
      revisionChain: this.verifyRevisionChain(),
      generation: {
        id: generation.id,
        inputHash: generation.inputHash,
        outputHash: generation.outputHash,
        provider: clone(generation.provider),
        origin: generation.origin,
        createdAt: generation.createdAt,
        hash: generation.hash
      },
      generationChain: this.verifyGenerationEventChain(),
      sourceEvent: (() => {
        const receipt = this.state.sourceEvents.find(item => item.assessmentId === id);
        return receipt ? {
          contractVersion: receipt.contractVersion,
          contractStatus: receipt.contractStatus,
          scoringVersion: receipt.scoringVersion,
          findingsReportVersion: receipt.findingsReportVersion,
          receiptHash: receipt.hash
        } : null;
      })(),
      attachment: this.attachmentStateFor(id),
      workflow: this.workflowStateFor(id),
      reportArtifact: approvedArtifact ? {
        id: approvedArtifact.id,
        reportFormat: approvedArtifact.reportFormat,
        disclaimerVersion: approvedArtifact.disclaimerVersion,
        sourceAssessmentHash: approvedArtifact.sourceAssessmentHash,
        createdAt: approvedArtifact.createdAt,
        hash: approvedArtifact.hash,
        type: approvedArtifact.type
      } : null
    };
  }

  async reportSnapshot(id) {
    await this.init();
    const assessment = clone(this.state.assessments[this.assessmentIndex(id)]);
    const review = clone(this.reviewFor(id));
    const approvedArtifact = review.status === "approved" ? this.latestReportArtifact(id) : null;
    if (approvedArtifact) return { mode: "approved", artifact: clone(approvedArtifact) };
    const content = await this.currentReportContent(id);
    const clinicalBrief = buildClinicalBrief({ assessment, interpretation: content.interpretation, narrative: content.narrative.text });
    return {
      mode: "draft",
      artifact: {
        id: null,
        type: "review-draft",
        reportFormat: REPORT_CONTRACT.format,
        disclaimerVersion: REPORT_CONTRACT.disclaimerVersion,
        assessmentId: id,
        audience: "clinician",
        sourceAssessmentHash: scoredSourceDigest(assessment),
        assessment,
        narrative: content.narrative,
        interpretation: content.interpretation,
        clinicalBrief,
        review,
        provider: {
          id: content.narrative.provider,
          version: content.narrative.version,
          mode: this.modelProvider.mode,
          promptVersion: content.narrative.promptVersion,
          policyHash: content.narrative.policyHash,
          inputSchemaVersion: content.narrative.inputSchemaVersion,
          outputSchemaVersion: content.narrative.outputSchemaVersion
        },
        createdAt: this.clock().toISOString(),
        note: "Review draft generated from current synthetic state. It is not an approved attachment.",
        hash: null
      }
    };
  }

  async audienceHandoffSnapshot(id, audience) {
    await this.init();
    validateHandoffAudience(audience);
    const assessment = clone(this.state.assessments[this.assessmentIndex(id)]);
    const generated = this.generationFor(id).bundle.narratives[audience];
    const narrative = clone(this.state.narratives[id]?.[audience] || generated);
    return {
      audience,
      assessment,
      narrative,
      review: clone(this.reviewFor(id)),
      sourceAssessmentHash: scoredSourceDigest(assessment),
      createdAt: this.clock().toISOString()
    };
  }

  async importAssessment(assessment, actor = "Demo reviewer") {
    await this.init();
    const errors = validateAssessment(assessment);
    if (errors.length) fail(errors.join(" "));
    if (this.state.assessments.some(item => item.id === assessment.id)) fail("A synthetic assessment with that ID already exists.", 409);
    const generationBundle = await this.generateBundleFor(assessment);
    this.state.assessments.unshift(clone(assessment));
    this.state.reviews[assessment.id] = {
      status: assessment.status || "ready",
      reviewer: assessment.reviewer || "Unassigned",
      safetyAcknowledged: false,
      approvedAt: null,
      updatedAt: this.clock().toISOString()
    };
    this.commitGeneration(assessment, generationBundle, { origin: "fixture-import", actor });
    this.addAudit(assessment.id, "Synthetic fixture imported", "Canonical scored payload accepted", actor);
    await this.persist();
    return this.getAssessment(assessment.id);
  }

  async importEqpassEvent(event, actor = "Demo reviewer") {
    await this.init();
    const adapted = adaptSyntheticEqpassEvent(event);
    const receiptMatch = this.state.sourceEvents.find(receipt => (
      receipt.idempotencyKeyHash === adapted.provenance.idempotencyKeyHash
      || receipt.eventIdHash === adapted.provenance.eventIdHash
    ));
    if (receiptMatch) {
      if (receiptMatch.sourceEventHash !== adapted.provenance.sourceEventHash) {
        fail("The event or idempotency key was reused with different source content.", 409);
      }
      return {
        status: "duplicate",
        authoritativeContract: false,
        receipt: clone(receiptMatch),
        assessment: await this.getAssessment(receiptMatch.assessmentId)
      };
    }
    if (event.eventType === "assessment.rescored") {
      fail("Rescored events fail closed until the e-QPASS owner supplies the authoritative supersession and report-replacement contract.", 409);
    }
    if (this.state.assessments.some(item => item.id === adapted.assessment.id)) {
      fail("The source assessment reference already exists without a matching source-event receipt.", 409);
    }

    const generationBundle = await this.generateBundleFor(adapted.assessment);

    this.state.assessments.unshift(clone(adapted.assessment));
    this.state.reviews[adapted.assessment.id] = {
      status: adapted.assessment.status,
      reviewer: adapted.assessment.reviewer,
      safetyAcknowledged: false,
      approvedAt: null,
      updatedAt: this.clock().toISOString()
    };
    this.commitGeneration(adapted.assessment, generationBundle, { origin: "source-event-import", actor });
    const receipt = this.appendSourceEventReceipt({
      contractVersion: adapted.provenance.contractVersion,
      contractStatus: adapted.provenance.contractStatus,
      eventType: adapted.provenance.eventType,
      eventIdHash: adapted.provenance.eventIdHash,
      idempotencyKeyHash: adapted.provenance.idempotencyKeyHash,
      sourceEventHash: adapted.provenance.sourceEventHash,
      modelProjectionHash: adapted.provenance.modelProjectionHash,
      assessmentId: adapted.assessment.id,
      instrumentVersion: adapted.provenance.instrumentVersion,
      scoringVersion: adapted.provenance.scoringVersion,
      responseVersion: adapted.provenance.responseVersion,
      findingsReportVersion: adapted.provenance.findingsReportVersion,
      findingsReportHash: adapted.provenance.findingsReportHash,
      actor,
      note: "Synthetic scored event accepted through the proposed RFI adapter; no routing values or source prose were stored in the receipt."
    });
    this.queueWorkflowReview(receipt, actor);
    this.addAudit(adapted.assessment.id, "Synthetic e-QPASS event imported", `Scoring ${adapted.provenance.scoringVersion}; source receipt ${receipt.hash.slice(0, 12)}`, actor);
    await this.persist();
    return {
      status: "imported",
      authoritativeContract: false,
      receipt: clone(receipt),
      assessment: await this.getAssessment(adapted.assessment.id)
    };
  }

  async saveNarrative(id, audience, text, actor = "Demo reviewer") {
    await this.init();
    this.assessmentIndex(id);
    const errors = validateNarrative(text);
    if (errors.length) fail(errors.join(" "));
    const generated = this.generationFor(id).bundle.narratives[audience];
    const previous = this.state.narratives[id]?.[audience];
    const revision = Number(previous?.revision || 0) + 1;
    this.state.narratives[id] ||= {};
    const saved = {
      ...generated,
      text: text.trim(),
      source: "reviewer",
      actor,
      revision,
      updatedAt: this.clock().toISOString()
    };
    this.appendRevision({
      kind: "narrative",
      assessmentId: id,
      audience,
      actor,
      before: {
        text: previous?.text || generated.text,
        source: previous?.source || generated.source || "generated",
        version: previous?.version || generated.version,
        revision: Number(previous?.revision || 0)
      },
      after: {
        text: saved.text,
        source: saved.source,
        version: saved.version,
        revision: saved.revision
      },
      change: {
        beforeWords: tokens(previous?.text || generated.text).length,
        afterWords: tokens(saved.text).length,
        changedTokens: changedTokenCount(previous?.text || generated.text, saved.text)
      }
    });
    this.state.narratives[id][audience] = saved;
    if (audience === "clinician") {
      this.invalidateApproval(id, "Clinician narrative changed after approval and requires a new clinical decision.", actor);
    }
    this.addAudit(id, audience === "clinician" ? "Narrative revised" : "Audience handoff revised", `${audience} revision ${revision}`, actor);
    await this.persist();
    return clone(this.state.narratives[id][audience]);
  }

  async saveInterpretation(id, input, actor = "Demo reviewer") {
    await this.init();
    const assessment = this.state.assessments[this.assessmentIndex(id)];
    const errors = validateClinicalInterpretation(input, assessment);
    if (errors.length) fail(errors.join(" "));
    const generated = this.generationFor(id).bundle.interpretation;
    const previous = this.state.interpretations[id];
    const revision = Number(previous?.revision || 0) + 1;
    const before = previous || generated;
    const changed = [];
    if (JSON.stringify(before.hypotheses) !== JSON.stringify(input.hypotheses)) changed.push("hypotheses");
    if (JSON.stringify(before.questions) !== JSON.stringify(input.questions)) changed.push("follow-up questions");
    if (!changed.length) fail("No interpretation changes were detected.", 409);
    const saved = {
      ...generated,
      hypotheses: clone(input.hypotheses),
      questions: input.questions.map(question => String(question).trim()),
      source: "reviewer",
      actor,
      revision,
      updatedAt: this.clock().toISOString(),
      changed
    };
    this.appendRevision({
      kind: "interpretation",
      assessmentId: id,
      actor,
      before: {
        hypotheses: clone(before.hypotheses),
        questions: clone(before.questions),
        source: before.source || "generated",
        version: before.version || generated.version,
        revision: Number(before.revision || 0)
      },
      after: {
        hypotheses: clone(saved.hypotheses),
        questions: clone(saved.questions),
        source: saved.source,
        version: saved.version,
        revision: saved.revision
      },
      changed
    });
    this.state.interpretations[id] = saved;
    this.invalidateApproval(id, "Clinical interpretation changed after approval and requires a new clinical decision.", actor);
    this.addAudit(id, "Interpretation revised", `${changed.join(" and ")} · revision ${revision}`, actor);
    await this.persist();
    return clone(this.state.interpretations[id]);
  }

  async acknowledgeSafety(id, acknowledged, actor = "Demo reviewer") {
    await this.init();
    const assessment = this.state.assessments[this.assessmentIndex(id)];
    const disposition = riskDisposition(assessment);
    const review = this.reviewFor(id);
    review.safetyAcknowledged = Boolean(acknowledged);
    review.updatedAt = this.clock().toISOString();
    this.state.reviews[id] = review;
    if (!acknowledged && disposition.requiresReview) this.invalidateApproval(id, "The required critical-screen acknowledgement was removed.", actor);
    this.addAudit(id, acknowledged ? "Safety hold acknowledged" : "Safety acknowledgement removed", disposition.reason, actor);
    await this.persist();
    return clone(review);
  }

  async approve(id, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const index = this.assessmentIndex(id);
    const assessment = this.state.assessments[index];
    const review = this.reviewFor(id);
    if (review.status === "approved") fail("This synthetic summary is already approved. Reopen it through a content or safety change before approving again.", 409);
    if (riskDisposition(assessment).requiresReview && !review.safetyAcknowledged) {
      fail("The critical-screen safety hold must be acknowledged before approval.", 409);
    }
    const reportContent = await this.currentReportContent(id);
    const reportErrors = validateReportContent(reportContent.narrative, reportContent.interpretation);
    if (reportErrors.length) fail(`Clinician attachment is not ready for approval. ${reportErrors.join(" ")}`, 409);
    const clinicalBrief = buildClinicalBrief({ assessment, interpretation: reportContent.interpretation, narrative: reportContent.narrative.text });
    const clinicalBriefErrors = validateClinicalBrief(clinicalBrief, assessment);
    if (clinicalBriefErrors.length) fail(`Clinical brief is not ready for approval. ${clinicalBriefErrors.join(" ")}`, 409);
    review.status = "approved";
    review.reviewer = actor;
    review.approvedAt = this.clock().toISOString();
    review.updatedAt = review.approvedAt;
    this.state.reviews[id] = review;
    this.state.assessments[index].status = "approved";
    this.state.assessments[index].reviewer = actor;
    const artifact = await this.appendReportArtifact(id, "approved", "Approved clinician attachment committed at approval.", reportContent);
    this.addAudit(id, "Draft approved", `Synthetic clinician attachment ${artifact.id} committed · ${artifact.hash.slice(0, 12)}`, actor);
    const sourceReceipt = this.state.sourceEvents.find(item => item.assessmentId === id);
    if (sourceReceipt) {
      const job = this.queueWorkflowHandoff(sourceReceipt, artifact, actor);
      try {
        await this.prepareEqpassAttachment(automaticAttachmentRequest(id, artifact), actor, {
          workflowJob: job,
          workflowOrigin: "runtime-automation",
          workflowTrigger: "clinician-approval",
          persist: false
        });
        this.addAudit(id, "Automatic handoff completed", `Prepared-not-attached · job ${job.jobId.slice(0, 8)}`, actor);
      } catch (error) {
        this.failWorkflowHandoff(job, error, actor);
        this.addAudit(id, "Automatic handoff failed safely", `Approval preserved; preparation attempt ${job.attempt} may be retried`, actor);
      }
    }
    await this.persist();
    return clone(review);
  }

  async submitFeedback(id, { reasons = [], note = "", actor = "Demo reviewer" } = {}) {
    await this.init();
    const index = this.assessmentIndex(id);
    const allowed = new Set(["factual-mismatch", "accuracy", "overreach", "tone", "evidence", "safety", "omission", "usefulness"]);
    const accepted = reasons.filter(reason => allowed.has(reason));
    if (!accepted.length && !String(note).trim()) fail("Choose a feedback reason or add a reviewer note.");
    const entry = {
      id: randomUUID(),
      assessmentId: id,
      reasons: accepted,
      note: String(note).trim().slice(0, 4000),
      actor,
      createdAt: this.clock().toISOString()
    };
    this.state.feedback.unshift(entry);
    this.appendFeedbackEvent(entry);
    this.invalidateApproval(id, "Reviewer feedback reopened the summary for correction.", actor);
    const review = this.reviewFor(id);
    review.status = "priority";
    review.reviewer = "Unassigned";
    review.approvedAt = null;
    review.updatedAt = entry.createdAt;
    this.state.reviews[id] = review;
    this.state.assessments[index].status = "priority";
    this.addAudit(id, "Draft returned", [...accepted, entry.note && "reviewer note"].filter(Boolean).join(", "), actor);
    await this.persist();
    return clone(entry);
  }

  async listIncidents() {
    await this.init();
    return {
      incidents: clone(this.incidentRecords()),
      control: this.studyControl(),
      chain: this.verifyIncidentChain()
    };
  }

  async reportIncident({ assessmentId = null, caseId = null, category, severity, summary, detail = "" } = {}, actor = "Demo reviewer") {
    await this.init();
    const categories = new Set([
      "critical-screen-omission",
      "diagnostic-overreach",
      "invented-evidence",
      "identity-disclosure",
      "cross-record-leakage",
      "blind-integrity",
      "revision-integrity",
      "other-safety"
    ]);
    const severities = new Set(["low", "moderate", "high", "critical"]);
    if (!categories.has(category)) fail("Choose a recognized safety incident category.");
    if (!severities.has(severity)) fail("Choose low, moderate, high, or critical severity.");
    const cleanSummary = String(summary || "").trim();
    const cleanDetail = String(detail || "").trim();
    if (cleanSummary.length < 10 || cleanSummary.length > 500) fail("Incident summary must contain 10–500 characters.");
    if (cleanDetail.length > 4000) fail("Incident detail must contain no more than 4,000 characters.");
    if (assessmentId) this.assessmentIndex(assessmentId);
    if (caseId) {
      const pending = this.state.pendingComparisons[caseId];
      const completed = this.state.comparisons.find(item => item.caseId === caseId);
      const linkedAssessment = pending?.assessmentId || completed?.assessmentId;
      if (!linkedAssessment) fail("The linked synthetic blind case was not found.", 404);
      if (assessmentId && linkedAssessment !== assessmentId) fail("The incident case and assessment do not match.");
      assessmentId ||= linkedAssessment;
    }
    const incidentId = randomUUID();
    this.appendIncidentEvent({
      type: "reported",
      incidentId,
      assessmentId,
      caseId,
      category,
      severity,
      summary: cleanSummary,
      detail: cleanDetail,
      actor
    });
    if (assessmentId) this.addAudit(assessmentId, "Safety incident reported", `${severity} · ${category}`, actor);
    await this.persist();
    return {
      incident: clone(this.incidentRecords().find(item => item.id === incidentId)),
      control: this.studyControl(),
      chain: this.verifyIncidentChain()
    };
  }

  async resolveIncident(incidentId, resolution, actor = "Demo reviewer") {
    await this.init();
    const incident = this.incidentRecords().find(item => item.id === incidentId);
    if (!incident) fail("Safety incident not found.", 404);
    if (incident.status === "resolved") fail("This safety incident is already resolved.", 409);
    const cleanResolution = String(resolution || "").trim();
    if (cleanResolution.length < 10 || cleanResolution.length > 4000) fail("Resolution note must contain 10–4,000 characters.");
    this.appendIncidentEvent({ type: "resolved", incidentId, resolution: cleanResolution, actor });
    if (incident.assessmentId) this.addAudit(incident.assessmentId, "Safety incident resolved", `${incident.severity} · ${incident.category}`, actor);
    await this.persist();
    return {
      incident: clone(this.incidentRecords().find(item => item.id === incidentId)),
      control: this.studyControl(),
      chain: this.verifyIncidentChain()
    };
  }

  async submitComparison(payload = {}) {
    await this.init();
    this.assertStudyActive();
    if (!["A", "B"].includes(payload.preferred)) fail("Select Summary A or Summary B.");
    let assessmentId = payload.assessmentId || null;
    let reveal = null;
    let pending = null;
    if (payload.caseId) {
      pending = this.state.pendingComparisons[payload.caseId];
      if (!pending) fail("This blind-comparison case is missing or has already been submitted.", 409);
      if (pending.actor !== (payload.actor || "Demo reviewer")) fail("This blind-comparison case belongs to a different reviewer session.", 409);
      assessmentId = pending.assessmentId;
      reveal = {
        A: pending.mapping.A,
        B: pending.mapping.B,
        preferredAuthor: pending.mapping[payload.preferred]
      };
    }
    const dimensions = ["accuracy", "restraint", "utility"];
    const pairedProtocol = pending?.protocol === "blind-v3" || Boolean(payload.ratings);
    const pairedRatings = pairedProtocol ? { A: {}, B: {} } : null;
    if (pairedProtocol) {
      for (const position of ["A", "B"]) {
        for (const key of dimensions) {
          const value = Number(payload.ratings?.[position]?.[key]);
          if (!Number.isInteger(value) || value < 1 || value > 5) fail(`Summary ${position} rating ${key} must be between 1 and 5.`);
          pairedRatings[position][key] = value;
        }
      }
    } else {
      for (const key of dimensions) {
        const value = Number(payload[key]);
        if (!Number.isInteger(value) || value < 1 || value > 5) fail(`Rating ${key} must be between 1 and 5.`);
      }
    }
    const selectedRatings = pairedRatings?.[payload.preferred] || payload;
    if (payload.caseId) delete this.state.pendingComparisons[payload.caseId];
    const submittedAt = this.clock().toISOString();
    const entry = {
      id: randomUUID(),
      caseId: payload.caseId || null,
      assessmentId,
      preferred: payload.preferred,
      accuracy: Number(selectedRatings.accuracy),
      restraint: Number(selectedRatings.restraint),
      utility: Number(selectedRatings.utility),
      caseSet: pending?.caseSet || null,
      partition: pending?.partition || null,
      strata: pending?.strata || [],
      sourceVersion: pending?.sourceVersion || null,
      referenceVersion: pending?.referenceVersion || null,
      reviewTiming: this.reviewTimingFor(pending, submittedAt),
      ratings: pairedRatings,
      comment: String(payload.comment || "").trim().slice(0, 4000),
      actor: payload.actor || "Demo reviewer",
      createdAt: submittedAt,
      protocol: pending?.protocol || (payload.caseId ? "blind-v2" : "blind-v1"),
      authorMapping: reveal ? { A: reveal.A, B: reveal.B } : null,
      preferredAuthor: reveal?.preferredAuthor || null
    };
    this.state.comparisons.unshift(entry);
    this.appendComparisonEvent(entry);
    if (entry.assessmentId && this.state.assessments.some(item => item.id === entry.assessmentId)) {
      this.addAudit(entry.assessmentId, "Blind comparison submitted", `Summary ${entry.preferred} selected`, entry.actor);
    }
    await this.persist();
    return { comparison: clone(entry), reveal };
  }

  async nextComparison(actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const calibrationCases = this.state.assessments.filter(assessment => (
      this.calibrationReferences[assessment.id]?.summary
      && this.calibrationManifest.cases[assessment.id]?.assignmentEnabled
    ));
    const progress = {
      completed: this.state.comparisons.filter(item => item.protocol === "blind-v3" && item.ratings?.A && item.ratings?.B).length,
      target: 60
    };
    const existing = Object.values(this.state.pendingComparisons).find(pending => pending.actor === actor);
    if (existing) {
      return {
        caseId: existing.caseId,
        assessmentId: existing.assessmentId,
        summaries: clone(existing.summaries),
        progress,
        reviewerProgress: clone(existing.reviewerProgress),
        caseSet: clone(existing.caseSet),
        partition: existing.partition,
        strata: clone(existing.strata || []),
        protocol: existing.protocol || "blind-v2"
      };
    }
    if (!calibrationCases.length) fail("No synthetic calibration references are configured.", 404);
    const completedForActor = new Set(this.state.comparisons
      .filter(item => item.protocol === "blind-v3" && item.actor === actor && item.ratings?.A && item.ratings?.B)
      .map(item => item.assessmentId));
    const candidates = calibrationCases.filter(assessment => !completedForActor.has(assessment.id));
    if (!candidates.length) fail("This reviewer has completed every synthetic calibration case. Switch reviewer code or expand the approved case set.", 409);
    const completedCounts = new Map(calibrationCases.map(assessment => [assessment.id, 0]));
    for (const comparison of this.state.comparisons) {
      if (comparison.protocol === "blind-v3" && comparison.ratings?.A && comparison.ratings?.B && completedCounts.has(comparison.assessmentId)) {
        completedCounts.set(comparison.assessmentId, completedCounts.get(comparison.assessmentId) + 1);
      }
    }
    candidates.sort((left, right) => completedCounts.get(left.id) - completedCounts.get(right.id) || left.id.localeCompare(right.id));
    const assessment = candidates[0];
    const manifestCase = this.calibrationManifest.cases[assessment.id];
    const generated = this.generationFor(assessment.id).bundle.narratives.clinician;
    const reference = this.calibrationReferences[assessment.id];
    const caseId = randomUUID();
    const allocated = [...this.state.comparisons, ...Object.values(this.state.pendingComparisons)];
    const perlA = allocated.filter(item => item.authorMapping?.A === "perl-generated" || item.mapping?.A === "perl-generated").length;
    const perlB = allocated.filter(item => item.authorMapping?.B === "perl-generated" || item.mapping?.B === "perl-generated").length;
    const flipped = perlA < perlB ? false : perlB < perlA ? true : Number.parseInt(caseId.at(-1), 16) % 2 === 1;
    const mapping = flipped ? { A: "human-reference", B: "perl-generated" } : { A: "perl-generated", B: "human-reference" };
    const textByAuthor = {
      "human-reference": reference.summary,
      "perl-generated": generated.text
    };
    const describe = text => ({
      text,
      wordCount: text.trim().split(/\s+/).length,
      signals: [
        /self-report/i.test(text) ? "Self-report framed" : "Profile framed",
        /diagnos/i.test(text) ? "Diagnostic restraint stated" : "Interpretation caveat",
        /(critical-screen|safety)/i.test(text) ? "Safety handling explicit" : "Routine safety context"
      ]
    });
    const summaries = {
      A: describe(textByAuthor[mapping.A]),
      B: describe(textByAuthor[mapping.B])
    };
    const reviewerProgress = { completed: completedForActor.size, available: calibrationCases.length };
    this.state.pendingComparisons[caseId] = {
      caseId,
      assessmentId: assessment.id,
      actor,
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version },
      partition: manifestCase.partition,
      strata: clone(manifestCase.strata),
      sourceVersion: manifestCase.sourceVersion,
      referenceVersion: manifestCase.referenceVersion,
      mapping,
      summaries,
      reviewerProgress,
      provider: generated.provider,
      version: generated.version,
      protocol: "blind-v3",
      createdAt: this.clock().toISOString()
    };
    await this.persist();
    return {
      caseId,
      assessmentId: assessment.id,
      summaries: clone(summaries),
      progress,
      reviewerProgress,
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version },
      partition: manifestCase.partition,
      strata: clone(manifestCase.strata),
      protocol: "blind-v3"
    };
  }

  timingTaskResponse(pending) {
    const assessment = this.state.assessments[this.assessmentIndex(pending.assessmentId)];
    return {
      taskId: pending.taskId,
      assessmentId: pending.assessmentId,
      condition: pending.condition,
      contract: WORKFLOW_TIMING_CONTRACT.id,
      protocol: WORKFLOW_TIMING_CONTRACT.protocol,
      caseSet: clone(pending.caseSet),
      partition: pending.partition,
      strata: clone(pending.strata),
      sourceProfile: workflowSourceProfile(assessment),
      initialDraft: pending.condition === "perl-assisted" ? pending.initialDraft : null,
      instructions: pending.condition === "perl-assisted"
        ? "Verify the scored source, revise the PERL draft as needed, and submit the clinician summary you would use for the next conversation."
        : "Using only the scored source profile, write the clinician summary you would use for the next conversation. No generated or counselor-reference prose is shown.",
      reviewerProgress: {
        completed: this.state.timingObservations.filter(item => item.actor === pending.actor).length,
        available: Object.values(this.calibrationManifest.cases).filter(item => item.assignmentEnabled).length
      },
      claimBoundary: WORKFLOW_TIMING_CONTRACT.claimBoundary
    };
  }

  async nextTimingTask(actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const existing = Object.values(this.state.pendingTimingTasks).find(pending => pending.actor === actor);
    if (existing) return this.timingTaskResponse(existing);

    const completedForActor = new Set(this.state.timingObservations
      .filter(item => item.actor === actor)
      .map(item => item.assessmentId));
    const assessmentsById = new Map(this.state.assessments.map(assessment => [assessment.id, assessment]));
    const eligible = Object.entries(this.calibrationManifest.cases)
      .filter(([id, entry]) => entry.assignmentEnabled && assessmentsById.has(id) && !completedForActor.has(id));
    if (!eligible.length) fail("This reviewer has completed every synthetic workflow-timing case. Switch reviewer code or expand the approved case set.", 409);

    const allocations = [
      ...this.state.timingObservations,
      ...Object.values(this.state.pendingTimingTasks)
    ];
    const globalCounts = Object.fromEntries(WORKFLOW_TIMING_CONTRACT.conditions.map(condition => [
      condition,
      allocations.filter(item => item.condition === condition).length
    ]));
    const ranked = eligible.map(([assessmentId, manifestCase]) => {
      const conditionCounts = Object.fromEntries(WORKFLOW_TIMING_CONTRACT.conditions.map(condition => [
        condition,
        allocations.filter(item => item.assessmentId === assessmentId && item.condition === condition).length
      ]));
      const [unaided, assisted] = [conditionCounts.unaided, conditionCounts["perl-assisted"]];
      let condition;
      if (unaided !== assisted) condition = unaided < assisted ? "unaided" : "perl-assisted";
      else if (globalCounts.unaided !== globalCounts["perl-assisted"]) condition = globalCounts.unaided < globalCounts["perl-assisted"] ? "unaided" : "perl-assisted";
      else condition = Number.parseInt(digest(`${actor}:${assessmentId}:${allocations.length}`).at(-1), 16) % 2 ? "unaided" : "perl-assisted";
      const matchedNeed = (unaided === 0) !== (assisted === 0) ? 0 : 1;
      return {
        assessmentId,
        manifestCase,
        condition,
        matchedNeed,
        caseTotal: unaided + assisted,
        conditionCount: conditionCounts[condition],
        tie: digest(`${actor}:${assessmentId}:${condition}`).slice(0, 12)
      };
    }).sort((left, right) => (
      left.matchedNeed - right.matchedNeed
      || left.caseTotal - right.caseTotal
      || left.conditionCount - right.conditionCount
      || left.tie.localeCompare(right.tie)
    ));

    const selected = ranked[0];
    const assessment = assessmentsById.get(selected.assessmentId);
    const generated = selected.condition === "perl-assisted" ? this.generationFor(assessment.id).bundle.narratives.clinician : null;
    const taskId = randomUUID();
    const pending = {
      taskId,
      assessmentId: selected.assessmentId,
      actor,
      condition: selected.condition,
      contract: WORKFLOW_TIMING_CONTRACT.id,
      sourceProjection: WORKFLOW_TIMING_CONTRACT.sourceProjection,
      sourceAssessmentHash: scoredSourceDigest(assessment),
      caseSet: { id: this.calibrationManifest.id, version: this.calibrationManifest.version },
      partition: selected.manifestCase.partition,
      strata: clone(selected.manifestCase.strata),
      sourceVersion: selected.manifestCase.sourceVersion,
      referenceVersion: selected.manifestCase.referenceVersion,
      initialDraft: generated?.text || null,
      provider: generated ? { id: generated.provider, version: generated.version, mode: this.modelProvider.mode } : null,
      createdAt: this.clock().toISOString()
    };
    this.state.pendingTimingTasks[taskId] = pending;
    await this.persist();
    return this.timingTaskResponse(pending);
  }

  async submitTimingTask({ taskId, finalSummary } = {}, actor = "Demo reviewer") {
    await this.init();
    this.assertStudyActive();
    const pending = this.state.pendingTimingTasks[taskId];
    if (!pending) fail("This workflow-timing task is missing, expired, or already submitted.", 409);
    if (pending.actor !== actor) fail("This workflow-timing task belongs to a different reviewer session.", 409);
    const assessment = this.state.assessments[this.assessmentIndex(pending.assessmentId)];
    if (scoredSourceDigest(assessment) !== pending.sourceAssessmentHash) fail("The scored source changed after assignment; discard this timing observation.", 409);
    const cleanSummary = String(finalSummary || "").trim();
    const errors = validateWorkflowSummary(cleanSummary);
    if (errors.length) fail(errors.join(" "));
    const submittedAt = this.clock().toISOString();
    const observation = {
      id: randomUUID(),
      taskId: pending.taskId,
      assessmentId: pending.assessmentId,
      condition: pending.condition,
      contract: pending.contract,
      sourceProjection: pending.sourceProjection,
      caseSet: clone(pending.caseSet),
      partition: pending.partition,
      strata: clone(pending.strata),
      sourceVersion: pending.sourceVersion,
      referenceVersion: pending.referenceVersion,
      sourceAssessmentHash: pending.sourceAssessmentHash,
      actor,
      reviewTiming: this.reviewTimingFor(pending, submittedAt),
      finalSummary: cleanSummary,
      initialDraftHash: pending.initialDraft ? digest(pending.initialDraft) : null,
      changedTokens: pending.initialDraft ? changedTokenCount(pending.initialDraft, cleanSummary) : null,
      provider: clone(pending.provider),
      clinicalValidation: false,
      claimBoundary: WORKFLOW_TIMING_CONTRACT.claimBoundary,
      createdAt: submittedAt
    };
    this.state.timingObservations.unshift(observation);
    this.appendTimingEvent(observation);
    delete this.state.pendingTimingTasks[taskId];
    this.addAudit(observation.assessmentId, "Workflow timing submitted", `${observation.condition} · ${observation.reviewTiming.activeSeconds}s active`, actor);
    await this.persist();
    return { observation: clone(observation), chain: this.verifyTimingEventChain() };
  }

  async calibrationAnalysis() {
    await this.init();
    const analysis = analyzeCalibration({
      comparisons: this.state.comparisons,
      feedback: this.state.feedback,
      revisions: this.state.revisions,
      assessments: this.state.assessments,
      incidents: this.incidentRecords(),
      manifest: this.calibrationManifest,
      timingObservations: this.state.timingObservations
    });
    const releaseEvidence = await evaluateReleaseEvidence({
      assessments: this.state.assessments,
      references: this.calibrationReferences,
      manifest: this.calibrationManifest,
      modelProvider: this.modelProvider,
      clock: this.clock
    });
    return {
      ...analysis,
      releaseEvidence,
      releaseDecision: buildReleaseDecision({ regression: releaseEvidence, analysis }),
      integrity: this.integritySnapshot()
    };
  }

  async caseSetManifest() {
    await this.init();
    return {
      manifest: clone(this.calibrationManifest),
      integrity: { algorithm: "sha256", manifestHash: digest(this.calibrationManifest) }
    };
  }

  async exportStudyPackage({ releaseCandidate = null, releaseAdmission = null, releasePromotion = null, runtimeEnvelope = null } = {}) {
    await this.init();
    const cases = await Promise.all(this.state.assessments.map(async assessment => {
      const detail = await this.getAssessment(assessment.id);
      return {
        assessment: detail.assessment,
        review: detail.review,
        narratives: detail.narratives,
        interpretation: detail.interpretation,
        clinicalBrief: detail.clinicalBrief,
        feedback: detail.feedback,
        generation: detail.generation,
        revisions: detail.revisions,
        audit: detail.audit
      };
    }));
    const core = {
      manifest: {
        format: "perl-synthetic-calibration-package/2.47",
        generatedAt: this.clock().toISOString(),
        environment: this.state.environment,
        schemaVersion: this.state.schemaVersion,
        population: "synthetic calibration sandbox",
        clinicalValidation: false,
        model: { id: this.modelProvider.id, version: this.modelProvider.version, mode: this.modelProvider.mode },
        modelTransport: generationGatewayStatus(this.modelProvider).transport,
        releaseCandidate: releaseCandidate ? clone(releaseCandidate) : {
          contractVersion: "perl-release-candidate/1.0",
          status: "not-connected",
          candidateCount: 0,
          productionSignatureVerified: false,
          azureDeploymentPerformed: false,
          clinicalReleaseAuthorized: false,
          patientUseAuthorized: false
        },
        releaseAdmission: releaseAdmission ? clone(releaseAdmission) : {
          contractVersion: "perl-release-admission/1.0",
          policyVersion: "perl-local-archive-qualification/1.0",
          status: "not-connected",
          localArchiveQualificationPassed: false,
          isolatedCiRun: false,
          externalVulnerabilityReviewCompleted: false,
          productionDeploymentAuthorized: false,
          clinicalReleaseAuthorized: false,
          patientUseAuthorized: false
        },
        releasePromotion: releasePromotion ? clone(releasePromotion) : {
          contractVersion: "perl-release-promotion/1.0",
          requestContractVersion: "perl-release-promotion-request/1.0",
          attestationContractVersion: "perl-release-promotion-attestation/1.0",
          status: "not-connected",
          localArchiveQualificationPassed: false,
          externalEvidenceVerified: false,
          productionArtifactPromoted: false,
          deploymentAuthorized: false,
          azureDeploymentPerformed: false,
          clinicalReleaseAuthorized: false,
          patientUseAuthorized: false
        },
        runtimeEnvelope: runtimeEnvelope ? clone(runtimeEnvelope) : {
          contractVersion: "perl-runtime-envelope/1.0",
          mode: "not-connected",
          policyConfigured: false,
          containerImageBuilt: false,
          azureDeploymentPerformed: false,
          clinicalValidation: false,
          patientUseAuthorized: false
        },
        revisionChain: this.verifyRevisionChain(),
        feedbackEventChain: this.verifyFeedbackEventChain(),
        incidentChain: this.verifyIncidentChain(),
        comparisonChain: this.verifyComparisonChain(),
        reportArtifactChain: this.verifyReportArtifactChain(),
        changeEventChain: this.verifyChangeEventChain(),
        sourceEventChain: this.verifySourceEventChain(),
        attachmentEventChain: this.verifyAttachmentEventChain(),
        providerWorkflowEventChain: this.verifyAutomationEventChain(),
        generationEventChain: this.verifyGenerationEventChain(),
        deliveryEventChain: this.verifyDeliveryChain(),
        workflowTimingEventChain: this.verifyTimingEventChain(),
        recoveryEventChain: this.verifyRecoveryEventChain(),
        rollbackEventChain: this.verifyRollbackEventChain(),
        monitoringEventChain: this.verifyMonitoringEventChain(),
        responseDrillEventChain: this.verifyResponseDrillEventChain(),
        readinessEventChain: this.verifyReadinessEventChain(),
        clinicalStandardEventChain: this.verifyClinicalStandardEventChain(),
        independentReviewEventChain: this.verifyIndependentReviewEventChain(),
        integrationReturnEventChain: this.verifyIntegrationReturnEventChain(),
        counselorNotebookEntryChain: this.verifyCounselorNotebookEntryChain(),
        counselorReferenceDraftChain: this.verifyCounselorReferenceDraftChain(),
        counselorReferenceAdjudicationEventChain: this.verifyCounselorReferenceAdjudicationChain(),
        counselorReferenceDecisionEventChain: this.verifyCounselorReferenceDecisionChain(),
        independentReviewAdmissionEventChain: this.verifyIndependentReviewAdmissionChain(),
        progressReviewEventChain: this.verifyProgressReviewObservationChain(),
        modelTrialEventChain: this.verifyModelTrialPreflightChain(),
        candidateTrialEventChain: this.verifyCandidateTrialSnapshotChain(),
        candidateReturnEventChain: this.verifyCandidateReturnEventChain(),
        candidateBlindReviewEventChain: this.verifyCandidateBlindReviewEventChain(),
        candidateRefinementEventChain: this.verifyCandidateRefinementCycleChain(),
        candidateRetestReturnEventChain: this.verifyCandidateRetestReturnChain(),
        candidateRetestReviewEventChain: this.verifyCandidateRetestReviewChain(),
        candidateRetestDispositionEventChain: this.verifyCandidateRetestDispositionChain(),
        candidateAdvancementEventChain: this.verifyCandidateAdvancementChain(),
        intendedUseEventChain: this.verifyIntendedUseEventChain(),
        languageReviewEventChain: this.verifyLanguageReviewEventChain(),
        decisionExchangeEventChain: this.verifyDecisionExchangeEventChain(),
        pilotOperationsEventChain: this.verifyPilotOperationsSnapshotChain(),
        providerActivationEventChain: this.verifyProviderActivationSnapshotChain(),
        campusObservatoryEventChain: this.verifyCampusObservatorySnapshotChain(),
        siteAdmissionEventChain: this.verifySiteAdmissionEventChain(),
        authorityTrustEventChain: this.verifyAuthorityTrustEventChain(),
        pilotStartEventChain: this.verifyPilotStartEventChain(),
        clinicalReleaseEventChain: this.verifyClinicalReleaseEventChain(),
        trafficActivationEventChain: this.verifyTrafficActivationEventChain(),
        identityAccessEventChain: this.verifyIdentityAccessEventChain(),
        studyControl: this.studyControl(),
        caseSet: {
          id: this.calibrationManifest.id,
          version: this.calibrationManifest.version,
          status: this.calibrationManifest.status,
          frozenAt: this.calibrationManifest.frozenAt,
          manifestHash: digest(this.calibrationManifest),
          clinicalValidation: false,
          holdoutValid: false
        }
      },
      caseSetManifest: clone(this.calibrationManifest),
      analysis: await this.calibrationAnalysis(),
      refinementBrief: await this.refinementBrief(),
      clinicalStandard: await this.clinicalStandardStatus(),
      independentReview: await this.independentReviewStatus(),
      integrationReturn: await this.integrationReturnStatus(),
      counselorNotebook: await this.counselorNotebookStatus(),
      counselorReferenceRoom: await this.counselorReferenceRoomStatus("PACKAGE-EXPORT"),
      counselorReferenceAdjudication: await this.counselorReferenceAdjudicationStatus("PACKAGE-EXPORT"),
      counselorReferenceDecision: await this.counselorReferenceDecisionStatus(),
      independentReviewAdmission: await this.independentReviewAdmissionStatus(),
      progressReview: await this.progressReviewStatus(),
      modelTrial: await this.modelTrialStatus(),
      candidateTrial: await this.candidateTrialStatus(),
      candidateReturns: await this.candidateReturnStatus(),
      candidateBlindReview: await this.candidateBlindReviewStatus("PACKAGE-EXPORT"),
      candidateRefinement: await this.candidateRefinementStatus(),
      candidateRetest: await this.candidateRetestStatus("PACKAGE-EXPORT"),
      candidateRetestDisposition: await this.candidateRetestDispositionStatus("PACKAGE-EXPORT"),
      candidateAdvancement: await this.candidateAdvancementStatus("PACKAGE-EXPORT"),
      integrationRehearsal: await this.integrationRehearsalStatus("PACKAGE-EXPORT"),
      intendedUse: await this.intendedUseStatus(),
      languageReview: await this.languageReviewStatus(),
      decisionExchange: await this.decisionExchangeStatus(),
      pilotOperations: await this.pilotOperationsStatus(),
      providerActivation: await this.providerActivationStatus(),
      campusObservatory: await this.campusObservatoryStatus(),
      siteAdmission: await this.siteAdmissionStatus(),
      authorityTrust: await this.authorityTrustStatus(),
      pilotStart: await this.pilotStartStatus(),
      clinicalRelease: await this.clinicalReleaseStatus(),
      trafficActivation: await this.trafficActivationStatus(),
      cases,
      feedbackEvents: clone(this.state.feedbackEvents),
      comparisons: clone(this.state.comparisons),
      comparisonEvents: clone(this.state.comparisonEvents),
      reportArtifacts: clone(this.state.reportArtifacts),
      changeEvents: clone(this.state.changeEvents),
      sourceEvents: clone(this.state.sourceEvents),
      attachmentEvents: clone(this.state.attachmentEvents),
      automationEvents: clone(this.state.automationEvents),
      generationRecords: clone(this.state.generationRecords),
      generationEvents: clone(this.state.generationEvents),
      deliveryJobs: clone(this.state.deliveryJobs),
      deliveryEvents: clone(this.state.deliveryEvents),
      recoveryEvents: clone(this.state.recoveryEvents),
      rollbackEvents: clone(this.state.rollbackEvents),
      monitoringEvents: clone(this.state.monitoringEvents),
      responseDrillEvents: clone(this.state.responseDrillEvents),
      readinessEvents: clone(this.state.readinessEvents),
      clinicalStandardDrafts: clone(this.state.clinicalStandardDrafts),
      clinicalStandardEvents: clone(this.state.clinicalStandardEvents),
      independentReviewEvents: clone(this.state.independentReviewEvents),
      integrationReturnEvents: clone(this.state.integrationReturnEvents),
      counselorNotebookEntries: clone(this.state.counselorNotebookEntries),
      counselorReferenceDrafts: clone(this.state.counselorReferenceDrafts),
      counselorReferenceAdjudicationEvents: clone(this.state.counselorReferenceAdjudicationEvents),
      counselorReferenceDecisionEvents: clone(this.state.counselorReferenceDecisionEvents),
      independentReviewAdmissionEvents: clone(this.state.independentReviewAdmissionEvents),
      progressReviewEvents: clone(this.state.progressReviewEvents),
      modelTrialEvents: clone(this.state.modelTrialEvents),
      candidateTrialEvents: clone(this.state.candidateTrialEvents),
      candidateReturnEvents: clone(this.state.candidateReturnEvents),
      candidateBlindReviewEvents: clone(this.state.candidateBlindReviewEvents),
      candidateRefinementEvents: clone(this.state.candidateRefinementEvents),
      candidateRetestReturnEvents: clone(this.state.candidateRetestReturnEvents),
      candidateRetestReviewEvents: clone(this.state.candidateRetestReviewEvents),
      candidateRetestDispositionEvents: clone(this.state.candidateRetestDispositionEvents),
      candidateAdvancementEvents: clone(this.state.candidateAdvancementEvents),
      intendedUseDrafts: clone(this.state.intendedUseDrafts),
      intendedUseEvents: clone(this.state.intendedUseEvents),
      languageReviewPackets: clone(this.state.languageReviewPackets),
      languageReviewEvents: clone(this.state.languageReviewEvents),
      decisionExchangeEvents: clone(this.state.decisionExchangeEvents),
      pilotOperationsEvents: clone(this.state.pilotOperationsEvents),
      providerActivationEvents: clone(this.state.providerActivationEvents),
      campusObservatoryEvents: clone(this.state.campusObservatoryEvents),
      siteAdmissionEvents: clone(this.state.siteAdmissionEvents),
      authorityTrustEvents: clone(this.state.authorityTrustEvents),
      pilotStartEvents: clone(this.state.pilotStartEvents),
      clinicalReleaseEvents: clone(this.state.clinicalReleaseEvents),
      trafficActivationEvents: clone(this.state.trafficActivationEvents),
      identityAccessEvents: clone(this.state.identityAccessEvents),
      timingObservations: clone(this.state.timingObservations),
      timingEvents: clone(this.state.timingEvents),
      incidents: clone(this.incidentRecords()),
      incidentEvents: clone(this.state.incidentEvents)
    };
    return { ...core, integrity: { algorithm: "sha256", packageHash: digest(core) } };
  }

  async exportComparisonsCsv() {
    await this.init();
    const headers = [
      "case_id", "synthetic_assessment_id", "preferred_position", "preferred_author",
      "summary_a_author", "summary_b_author", "selected_accuracy", "selected_restraint", "selected_utility",
      "summary_a_accuracy", "summary_a_restraint", "summary_a_utility",
      "summary_b_accuracy", "summary_b_restraint", "summary_b_utility",
      "perl_accuracy", "perl_restraint", "perl_utility",
      "counselor_accuracy", "counselor_restraint", "counselor_utility",
      "case_set_id", "case_set_version", "partition", "strata", "source_version", "reference_version",
      "assigned_at", "submitted_at", "raw_seconds", "paused_seconds", "active_seconds", "timing_eligible", "timing_flag", "timing_measurement",
      "reviewer", "comparison_created_at", "protocol", "comment"
    ];
    const rows = this.state.comparisons.map(item => {
      const perlPosition = item.authorMapping?.A === "perl-generated" ? "A" : item.authorMapping?.B === "perl-generated" ? "B" : null;
      const counselorPosition = item.authorMapping?.A === "human-reference" ? "A" : item.authorMapping?.B === "human-reference" ? "B" : null;
      return [
        item.caseId || item.id,
        item.assessmentId,
        item.preferred,
        item.preferredAuthor,
        item.authorMapping?.A,
        item.authorMapping?.B,
        item.accuracy,
        item.restraint,
        item.utility,
        item.ratings?.A?.accuracy,
        item.ratings?.A?.restraint,
        item.ratings?.A?.utility,
        item.ratings?.B?.accuracy,
        item.ratings?.B?.restraint,
        item.ratings?.B?.utility,
        perlPosition && item.ratings?.[perlPosition]?.accuracy,
        perlPosition && item.ratings?.[perlPosition]?.restraint,
        perlPosition && item.ratings?.[perlPosition]?.utility,
        counselorPosition && item.ratings?.[counselorPosition]?.accuracy,
        counselorPosition && item.ratings?.[counselorPosition]?.restraint,
        counselorPosition && item.ratings?.[counselorPosition]?.utility,
        item.caseSet?.id,
        item.caseSet?.version,
        item.partition,
        item.strata?.join("|"),
        item.sourceVersion,
        item.referenceVersion,
        item.reviewTiming?.assignedAt,
        item.reviewTiming?.submittedAt,
        item.reviewTiming?.rawSeconds,
        item.reviewTiming?.pausedSeconds,
        item.reviewTiming?.activeSeconds,
        item.reviewTiming?.eligible,
        item.reviewTiming?.flag,
        item.reviewTiming?.measurement,
        item.actor,
        item.createdAt,
        item.protocol,
        item.comment
      ];
    });
    return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n") + "\n";
  }

  async exportWorkflowTimingCsv() {
    await this.init();
    const headers = [
      "task_id", "observation_id", "synthetic_assessment_id", "condition", "contract", "source_projection",
      "case_set_id", "case_set_version", "partition", "strata", "source_version", "reference_version",
      "source_assessment_hash", "assigned_at", "submitted_at", "raw_seconds", "paused_seconds", "active_seconds",
      "timing_eligible", "timing_flag", "timing_measurement", "changed_tokens", "provider_id", "provider_version",
      "provider_mode", "reviewer", "observation_created_at", "clinical_validation", "claim_boundary", "final_summary"
    ];
    const rows = this.state.timingObservations.map(item => [
      item.taskId,
      item.id,
      item.assessmentId,
      item.condition,
      item.contract,
      item.sourceProjection,
      item.caseSet?.id,
      item.caseSet?.version,
      item.partition,
      item.strata?.join("|"),
      item.sourceVersion,
      item.referenceVersion,
      item.sourceAssessmentHash,
      item.reviewTiming?.assignedAt,
      item.reviewTiming?.submittedAt,
      item.reviewTiming?.rawSeconds,
      item.reviewTiming?.pausedSeconds,
      item.reviewTiming?.activeSeconds,
      item.reviewTiming?.eligible,
      item.reviewTiming?.flag,
      item.reviewTiming?.measurement,
      item.changedTokens,
      item.provider?.id,
      item.provider?.version,
      item.provider?.mode,
      item.actor,
      item.createdAt,
      item.clinicalValidation,
      item.claimBoundary,
      item.finalSummary
    ]);
    return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n") + "\n";
  }

  async metrics() {
    await this.init();
    const total = this.state.comparisons.length;
    const revealed = this.state.comparisons.filter(item => item.preferredAuthor);
    const mean = key => total ? Number((this.state.comparisons.reduce((sum, item) => sum + Number(item[key] || 0), 0) / total).toFixed(2)) : null;
    const correctionRecordIds = new Set([
      ...this.state.feedback.map(item => item.assessmentId),
      ...Object.keys(this.state.interpretations || {})
    ]);
    return {
      assessments: this.state.assessments.length,
      awaitingReview: this.state.assessments.filter(item => this.reviewFor(item.id).status !== "approved").length,
      safetyHolds: this.state.assessments.filter(item => riskDisposition(item).requiresReview && !this.reviewFor(item.id).safetyAcknowledged).length,
      comparisons: total,
      correctionRate: this.state.assessments.length ? Math.round((correctionRecordIds.size / this.state.assessments.length) * 100) : 0,
      interpretationRevisions: Object.values(this.state.interpretations || {}).reduce((sum, item) => sum + Number(item.revision || 0), 0),
      workflowTimingObservations: this.state.timingObservations.length,
      preferredA: total ? Math.round((this.state.comparisons.filter(item => item.preferred === "A").length / total) * 100) : null,
      preferredPerl: revealed.length ? Math.round((revealed.filter(item => item.preferredAuthor === "perl-generated").length / revealed.length) * 100) : null,
      meanAccuracy: mean("accuracy"),
      meanRestraint: mean("restraint"),
      meanUtility: mean("utility")
    };
  }
}
