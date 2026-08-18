import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPerlServer } from "../server.mjs";
import { assessments } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { projectModelInput } from "../src/model-input.js";
import { createModelProvider } from "../src/model-provider.js";
import { MODEL_TRANSPORT_CONTRACT, MODEL_TRANSPORT_POLICY_CONTRACT } from "../src/model-transport.js";
import { RELEASE_CANDIDATE_CONTRACT, RELEASE_SIGNATURE_CONTRACT, RELEASE_TRUST_POLICY_CONTRACT } from "../src/release-candidate.js";
import { RELEASE_ADMISSION_CONTRACT, RELEASE_ADMISSION_POLICY } from "../src/release-admission.js";
import { RELEASE_PROMOTION_ATTESTATION_CONTRACT, RELEASE_PROMOTION_CONTRACT, RELEASE_PROMOTION_REQUEST_CONTRACT, RELEASE_PROMOTION_TRUST_POLICY_CONTRACT } from "../src/release-promotion.js";
import { createDeliveryConnector, DELIVERY_ACK_CONTRACT } from "../src/delivery-gateway.js";
import { INTEGRATION_RETURN_ARTIFACTS, integrationReturnManifestTemplate } from "../src/integration-return.js";
import { modelTrialManifestTemplate } from "../src/model-trial.js";

const pairedRatings = {
  A: { accuracy: 5, restraint: 5, utility: 4 },
  B: { accuracy: 4, restraint: 5, utility: 4 }
};

function successfulAdmissionRun() {
  return {
    checks: ["archive-integrity", "fixture-completeness", "dependency-boundary", "full-archive-tests", "clinical-calibration", "ephemeral-cleanup"].map((id, index) => ({
      id,
      label: `Check ${index + 1}`,
      status: "passed",
      evidence: id === "full-archive-tests" ? { testFileCount: 45, testCount: 371, passCount: 371, failCount: 0 } : { verified: true }
    })),
    environment: {
      executionMode: "local-ephemeral-owner-only-copy",
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      shellUsed: false,
      credentialEnvironmentInherited: false,
      networkIsolationEnforced: false
    }
  };
}

function completeModelTrialManifest() {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-API-QA";
  manifest.candidates = manifest.candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    status: "metadata-declared-unverified",
    providerId: `provider-${candidateIndex + 1}`,
    modelVersion: `model-${candidateIndex + 1}.0`,
    hostingPattern: candidateIndex === 0 ? "azure-managed" : "vendor-managed",
    region: "US East",
    domainEvidence: candidate.domainEvidence.map((item, domainIndex) => ({
      ...item,
      status: "metadata-declared-unverified",
      evidenceRef: `FF-EVIDENCE-C${candidateIndex + 1}-D${domainIndex + 1}`
    }))
  }));
  return manifest;
}

async function withServer(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "perl-api-test-"));
  const runtime = await createPerlServer({ storePath: join(directory, "state.json"), ...options });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise(resolve => runtime.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const address = runtime.server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("an explicitly authorized structured candidate materializes once through the full API stack", async t => {
  let calls = 0;
  let lastRequest;
  const modelProvider = createModelProvider({
    provider: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      providerId: "api-candidate-test",
      modelVersion: "candidate-fixed-v1",
      promptVersion: "candidate-prompt/1.0",
      approvedBy: "MODEL-GOVERNANCE-QA"
    },
    transport: async request => {
      calls += 1;
      lastRequest = request;
      return {
        narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(request.payload, audience)])),
        interpretation: generateClinicalInterpretation(request.payload)
      };
    }
  });
  const base = await withServer(t, { modelProvider });
  assert.equal(calls, 3);
  const status = await fetch(`${base}/api/model/status`).then(response => response.json());
  assert.equal(status.activeProvider.id, "api-candidate-test");
  assert.equal(status.activeProvider.externalTransmission, true);
  assert.equal(status.activeProvider.approvalScope, "synthetic-calibration-only");
  assert.equal(status.activeProvider.phiApproved, false);
  assert.equal(status.materialization.active, 3);
  const detail = await fetch(`${base}/api/assessments/FF-TEST-2407-A`).then(response => response.json());
  assert.equal(detail.generation.provider.id, "api-candidate-test");
  assert.equal(detail.narratives.clinician.promptVersion, "candidate-prompt/1.0");
  assert.equal(calls, 3);
  assert.equal(Object.hasOwn(lastRequest.payload, "assessmentId"), false);
});

async function json(response) {
  const body = await response.json();
  return { response, body };
}

test("health and assessment endpoints expose the synthetic boundary", async t => {
  const base = await withServer(t);
  const health = await fetch(`${base}/api/health`);
  const payload = await health.json();
  assert.equal(health.status, 200);
  assert.equal(payload.environment, "engineering");
  assert.equal(payload.persistence, "owner-only-json");
  assert.equal(payload.phiApproved, false);
  assert.equal(payload.model.mode, "rules");
  assert.equal(payload.integration.modelTransportContract, MODEL_TRANSPORT_CONTRACT);
  assert.equal(payload.integration.modelTransportPolicyContract, MODEL_TRANSPORT_POLICY_CONTRACT);
  assert.equal(payload.integration.releaseCandidateContract, RELEASE_CANDIDATE_CONTRACT);
  assert.equal(payload.integration.releaseAdmissionContract, RELEASE_ADMISSION_CONTRACT);
  assert.equal(payload.integration.releaseAdmissionPolicy, RELEASE_ADMISSION_POLICY);
  assert.equal(payload.integration.releasePromotionContract, RELEASE_PROMOTION_CONTRACT);
  assert.equal(payload.integration.releasePromotionRequestContract, RELEASE_PROMOTION_REQUEST_CONTRACT);
  assert.equal(payload.integration.releasePromotionAttestationContract, RELEASE_PROMOTION_ATTESTATION_CONTRACT);
  assert.equal(payload.integration.releasePromotionTrustPolicyContract, RELEASE_PROMOTION_TRUST_POLICY_CONTRACT);
  assert.equal(payload.integration.releaseTrustPolicyContract, RELEASE_TRUST_POLICY_CONTRACT);
  assert.equal(payload.integration.releaseSignatureContract, RELEASE_SIGNATURE_CONTRACT);
  assert.equal(payload.releaseCandidate.status, "not-built");
  assert.equal(payload.releaseCandidate.productionSignatureVerified, false);
  assert.equal(payload.releaseCandidate.azureDeploymentPerformed, false);
  assert.equal(payload.releaseAdmission.status, "candidate-required");
  assert.equal(payload.releaseAdmission.localArchiveQualificationPassed, false);
  assert.equal(payload.releaseAdmission.isolatedCiRun, false);
  assert.equal(payload.releasePromotion.status, "candidate-required");
  assert.equal(payload.releasePromotion.externalEvidenceVerified, false);
  assert.equal(payload.releasePromotion.deploymentAuthorized, false);
  assert.equal(payload.integration.recoveryRehearsalContract, "perl-recovery-rehearsal/1.0");
  assert.equal(payload.integration.rollbackRehearsalContract, "perl-application-rollback-rehearsal/1.0");
  assert.equal(payload.integration.operationalMonitoringContract, "perl-operational-monitoring/1.0");
  assert.equal(payload.integration.incidentResponseContract, "perl-incident-response-rehearsal/1.0");
  assert.equal(payload.integration.pilotReadinessContract, "perl-pilot-readiness-snapshot/1.0");
  assert.equal(payload.integration.marketabilityMapContract, "perl-marketability-map/1.0");
  assert.equal(payload.integration.executiveHandoffContract, "perl-executive-handoff/1.0");
  assert.equal(payload.integration.calibrationIntakeContract, "perl-calibration-intake/1.0");
  assert.equal(payload.integration.counselorLabContract, "perl-counselor-lab/1.0");
  assert.equal(payload.integration.counselorNotebookContract, "perl-counselor-session-notebook/1.0");
  assert.equal(payload.integration.counselorReferenceContract, "perl-counselor-reference-draft/1.0");
  assert.equal(payload.integration.counselorReferenceAdjudicationContract, "perl-counselor-reference-adjudication-dossier/1.0");
  assert.equal(payload.integration.counselorReferenceDecisionContract, "perl-counselor-reference-decision-docket/1.0");
  assert.equal(payload.integration.counselorReferenceDecisionRegistryContract, "perl-counselor-reference-decision-registry/1.0");
  assert.equal(payload.integration.counselorReferenceDecisionChallengeContract, "perl-counselor-reference-decision-challenge/1.0");
  assert.equal(payload.integration.counselorReferenceDecisionAttestationContract, "perl-counselor-reference-decision-attestation/1.0");
  assert.equal(payload.integration.progressReviewContract, "perl-synthetic-progress-review/1.0");
  assert.equal(payload.integration.progressBriefContract, "perl-synthetic-progress-conversation-brief/1.0");
  assert.equal(payload.integration.progressReportContract, "perl-synthetic-progress-addendum/1.0");
  assert.equal(payload.integration.clinicalStandardContract, "perl-clinical-standard-draft/1.0");
  assert.equal(payload.integration.independentReviewContract, "perl-independent-review-dossier/1.0");
  assert.equal(payload.integration.integrationReturnContract, "perl-eqpass-owner-return-preflight/1.0");
  assert.equal(payload.integration.modelTrialContract, "perl-model-trial-preflight/1.0");
  assert.equal(payload.integration.candidateTrialContract, "perl-candidate-trial-protocol/1.0");
  assert.equal(payload.integration.candidateReturnContract, "perl-manual-candidate-return/1.0");
  assert.equal(payload.integration.candidateBlindReviewContract, "perl-candidate-blind-review/1.0");
  assert.equal(payload.integration.candidateRefinementRetestContract, "perl-candidate-refinement-retest/1.0");
  assert.equal(payload.integration.candidateRetestReturnContract, "perl-candidate-retest-return/1.0");
  assert.equal(payload.integration.candidateRetestRereviewContract, "perl-candidate-retest-rereview/1.0");
  assert.equal(payload.integration.candidateRetestDispositionContract, "perl-candidate-retest-independent-disposition/1.0");
  assert.equal(payload.integration.candidateRetestDispositionRegistryContract, "perl-candidate-retest-disposition-registry/1.0");
  assert.equal(payload.integration.candidateRetestDispositionChallengeContract, "perl-candidate-retest-disposition-challenge/1.0");
  assert.equal(payload.integration.candidateRetestDispositionAttestationContract, "perl-candidate-retest-disposition-attestation/1.0");
  assert.equal(payload.integration.candidateAdvancementContract, "perl-exact-candidate-advancement-airlock/1.0");
  assert.equal(payload.integration.candidateCycleActionRegistryContract, "perl-candidate-cycle-action-registry/1.0");
  assert.equal(payload.integration.candidateCycleActionChallengeContract, "perl-candidate-cycle-action-challenge/1.0");
  assert.equal(payload.integration.candidateCycleActionAttestationContract, "perl-candidate-cycle-action-attestation/1.0");
  assert.equal(payload.integration.candidateAdvancementRegistryContract, "perl-candidate-advancement-registry/1.0");
  assert.equal(payload.integration.candidateAdvancementChallengeContract, "perl-candidate-advancement-challenge/1.0");
  assert.equal(payload.integration.candidateAdvancementAttestationContract, "perl-candidate-advancement-attestation/1.0");
  assert.equal(payload.integration.workspaceExperienceContract, "perl-workspace-experience/1.0");
  assert.equal(payload.integration.deploymentPresentationContract, "perl-deployment-presentation/1.0");
  assert.equal(payload.deploymentPresentation.mode, "engineering");
  assert.equal(payload.deploymentPresentation.serverBacked, true);
  assert.equal(payload.deploymentPresentation.productionApiPathExercised, true);
  assert.equal(payload.deploymentPresentation.deploymentReviewReady, false);
  assert.equal(payload.deploymentPresentation.phiAccepted, false);
  assert.equal(payload.deploymentPresentation.patientUseAuthorized, false);
  assert.equal(payload.workspaceExperience.clinicalSafetyAlwaysVisible, true);
  assert.equal(payload.workspaceExperience.patientLevelDemographicsAvailable, false);
  assert.equal(payload.workspaceExperience.phiIncluded, false);
  assert.equal(payload.candidateRetestDisposition.requiredExternalDuties, 4);
  assert.equal(payload.candidateRetestDisposition.independentResultFrozen, false);
  assert.equal(payload.candidateRetestDisposition.generalizedAccuracyEstablished, false);
  assert.equal(payload.candidateRetestDisposition.clinicalValidation, false);
  assert.equal(payload.candidateRetestDisposition.patientUseAuthorized, false);
  assert.equal(payload.candidateAdvancement.cycleActionDutiesRequired, 2);
  assert.equal(payload.candidateAdvancement.candidateAdvancementDutiesRequired, 4);
  assert.equal(payload.candidateAdvancement.candidateIdentityDisclosedBeforeSignedClose, false);
  assert.equal(payload.candidateAdvancement.cycleClosed, false);
  assert.equal(payload.candidateAdvancement.exactCandidateAdvancedToIntegrationReadiness, false);
  assert.equal(payload.candidateAdvancement.productionReleaseAuthorized, false);
  assert.equal(payload.candidateAdvancement.trafficActivationAuthorized, false);
  assert.equal(payload.candidateAdvancement.patientUseAuthorized, false);
  assert.equal(payload.integration.intendedUseContract, "perl-intended-use-charter/1.0");
  assert.equal(payload.integration.languageReviewContract, "perl-language-review-packet/1.0");
  assert.equal(payload.integration.languageReviewPageContract, "perl-language-review-print/1.0");
  assert.equal(payload.integration.reportAssemblyContract, "perl-report-assembly-proof/1.0");
  assert.equal(payload.integration.decisionExchangeContract, "perl-external-decision-exchange/1.0");
  assert.equal(payload.integration.decisionReturnContract, "perl-external-decision-return/rfi-1.0");
  assert.equal(payload.integration.pilotOperationsContract, "perl-provider-pilot-operations-plan/1.0");
  assert.equal(payload.integration.providerActivationContract, "perl-provider-activation-workbook/1.0");
  assert.equal(payload.integration.siteAdmissionContract, "perl-named-site-admission-dossier/1.0");
  assert.equal(payload.integration.siteAdmissionReturnContract, "perl-named-site-admission-return/rfi-1.0");
  assert.equal(payload.integration.authorityTrustContract, "perl-governed-authority-trust/1.0");
  assert.equal(payload.integration.authorityTrustRegistryContract, "perl-authority-trust-registry/1.0");
  assert.equal(payload.integration.authorityTrustChallengeContract, "perl-governed-authority-challenge/1.0");
  assert.equal(payload.integration.authorityTrustReceiptContract, "perl-governed-authority-receipt/1.0");
  assert.equal(payload.integration.pilotStartContract, "perl-governed-pilot-start/1.0");
  assert.equal(payload.integration.pilotStartRegistryContract, "perl-pilot-start-registry/1.0");
  assert.equal(payload.integration.pilotStartChallengeContract, "perl-pilot-start-challenge/1.0");
  assert.equal(payload.integration.pilotStartOrderContract, "perl-pilot-start-order/1.0");
  assert.equal(payload.integration.pilotStartAcknowledgementContract, "perl-pilot-start-acknowledgement/1.0");
  assert.equal(payload.integration.clinicalReleaseContract, "perl-governed-clinical-release/1.0");
  assert.equal(payload.integration.clinicalReleaseRegistryContract, "perl-clinical-release-registry/1.0");
  assert.equal(payload.integration.clinicalReleaseChallengeContract, "perl-clinical-release-challenge/1.0");
  assert.equal(payload.recovery.productionRecoveryClaimed, false);
  assert.equal(payload.recovery.rpoConfigured, false);
  assert.equal(payload.recovery.rtoConfigured, false);
  assert.equal(payload.rollback.deployableArtifactRestored, false);
  assert.equal(payload.rollback.productionRollbackPerformed, false);
  assert.equal(payload.rollback.clinicalReleaseAuthorized, false);
  assert.equal(payload.pilotOperations.siteIdentityVerified, false);
  assert.equal(payload.pilotOperations.pilotAuthorizationRecorded, false);
  assert.equal(payload.pilotOperations.pilotStarted, false);
  assert.equal(payload.pilotOperations.outcomeEstablished, false);
  assert.equal(payload.pilotOperations.expansionApproved, false);
  assert.equal(payload.providerActivation.sessionHeld, false);
  assert.equal(payload.providerActivation.completionAccepted, false);
  assert.equal(payload.providerActivation.activationAuthorized, false);
  assert.equal(payload.providerActivation.patientUseAuthorized, false);
  assert.equal(payload.siteAdmission.siteContacted, false);
  assert.equal(payload.siteAdmission.siteIdentityVerified, false);
  assert.equal(payload.siteAdmission.authorizationRecorded, false);
  assert.equal(payload.siteAdmission.pilotStarted, false);
  assert.equal(payload.authorityTrust.registryWriteApiAvailable, false);
  assert.equal(payload.authorityTrust.trustRootsProvisioned, false);
  assert.equal(payload.authorityTrust.humanNamesStored, false);
  assert.equal(payload.authorityTrust.evidenceFilesStored, false);
  assert.equal(payload.authorityTrust.phiIncluded, false);
  assert.equal(payload.authorityTrust.pilotStarted, false);
  assert.equal(payload.authorityTrust.productionReleaseAuthorized, false);
  assert.equal(payload.authorityTrust.patientUseAuthorized, false);
  assert.equal(payload.pilotStart.registryWriteApiAvailable, false);
  assert.equal(payload.pilotStart.trustRootsProvisioned, false);
  assert.equal(payload.pilotStart.startOrderVerified, false);
  assert.equal(payload.pilotStart.deploymentStartAcknowledged, false);
  assert.equal(payload.pilotStart.providerPreparationStarted, false);
  assert.equal(payload.pilotStart.pilotStarted, false);
  assert.equal(payload.pilotStart.clinicalTrafficEnabled, false);
  assert.equal(payload.pilotStart.productionReleaseAuthorized, false);
  assert.equal(payload.pilotStart.patientUseAuthorized, false);
  assert.equal(payload.pilotStart.phiIncluded, false);
  assert.equal(payload.clinicalRelease.registryWriteApiAvailable, false);
  assert.equal(payload.clinicalRelease.trustRootsProvisioned, false);
  assert.equal(payload.clinicalRelease.clinicalUseAuthorized, false);
  assert.equal(payload.clinicalRelease.patientUseAuthorized, false);
  assert.equal(payload.clinicalRelease.productionReleaseAuthorized, false);
  assert.equal(payload.clinicalRelease.deploymentVerified, false);
  assert.equal(payload.clinicalRelease.releaseReadyForTrafficActivation, false);
  assert.equal(payload.clinicalRelease.clinicalTrafficEnabled, false);
  assert.equal(payload.clinicalRelease.pilotStarted, false);
  assert.equal(payload.clinicalRelease.patientRecordsProcessed, false);
  assert.equal(payload.clinicalRelease.phiIncluded, false);
  assert.equal(payload.monitoring.continuousMonitoringClaimed, false);
  assert.equal(payload.monitoring.productionAlertingConnected, false);
  assert.equal(payload.monitoring.availabilitySlaClaimed, false);
  assert.equal(payload.monitoring.latencySloClaimed, false);
  assert.equal(payload.monitoring.productionBackupMonitoring, false);
  assert.equal(payload.monitoring.securityMonitoringConnected, false);
  assert.equal(payload.monitoring.externalNotificationsSent, false);
  assert.equal(payload.intendedUse.providerFirst, true);
  assert.equal(payload.intendedUse.humanReviewRequired, true);
  assert.equal(payload.intendedUse.automatedClinicalDecisionAllowed, false);
  assert.equal(payload.intendedUse.legalApproved, false);
  assert.equal(payload.intendedUse.intendedUseFrozen, false);
  assert.equal(payload.intendedUse.patientUseAuthorized, false);
  assert.equal(payload.languageReview.copySurfaceCount, 9);
  assert.equal(payload.languageReview.reviewQuestionCount, 6);
  assert.equal(payload.languageReview.acceptancesRecorded, 0);
  assert.equal(payload.languageReview.legalApproved, false);
  assert.equal(payload.languageReview.languageFrozen, false);
  assert.equal(payload.languageReview.patientUseAuthorized, false);
  assert.equal(payload.incidentResponse.productionIncidentDeclared, false);
  assert.equal(payload.incidentResponse.productionServiceStopped, false);
  assert.equal(payload.incidentResponse.notificationTreeConnected, false);
  assert.equal(payload.marketability.calendarCommitment, false);
  assert.equal(payload.marketability.marketabilityReady, false);
  assert.equal(payload.marketability.productionReadinessClaimed, false);
  assert.equal(payload.marketability.pilotAuthorizationRecorded, false);
  assert.equal(payload.executiveHandoff.externalApprovalsRecorded, false);
  assert.equal(payload.executiveHandoff.productionOwnersAssigned, false);
  assert.equal(payload.executiveHandoff.calendarCommitment, false);
  assert.equal(payload.executiveHandoff.productionReadinessClaimed, false);
  assert.equal(payload.executiveHandoff.pilotAuthorizationRecorded, false);
  assert.equal(payload.executiveHandoff.phiIncluded, false);
  assert.equal(payload.decisionExchange.requestPackets, 7);
  assert.equal(payload.decisionExchange.packetsTransmitted, false);
  assert.equal(payload.decisionExchange.evidenceFilesReceived, false);
  assert.equal(payload.decisionExchange.cryptographicSignaturesVerified, false);
  assert.equal(payload.decisionExchange.identitiesVerified, false);
  assert.equal(payload.decisionExchange.authoritiesVerified, false);
  assert.equal(payload.decisionExchange.externalAcceptancesRecorded, false);
  assert.equal(payload.decisionExchange.gatesClosed, false);
  assert.equal(payload.decisionExchange.pilotAuthorizationRecorded, false);
  assert.equal(payload.decisionExchange.productionReleaseAuthorized, false);
  assert.equal(payload.decisionExchange.patientUseAuthorized, false);
  assert.equal(payload.clinicalStandard.counselorPanelAccepted, false);
  assert.equal(payload.clinicalStandard.protocolFrozen, false);
  assert.equal(payload.clinicalStandard.clinicalValidation, false);
  assert.equal(payload.clinicalStandard.patientUseAuthorized, false);
  assert.equal(payload.independentReview.sourceWorkbooksConnected, false);
  assert.equal(payload.independentReview.independentEvaluatorNamed, false);
  assert.equal(payload.independentReview.independentReviewComplete, false);
  assert.equal(payload.independentReview.accuracyEstablished, false);
  assert.equal(payload.independentReview.reliabilityEstablished, false);
  assert.equal(payload.independentReview.clinicalValidation, false);
  assert.equal(payload.independentReview.patientUseAuthorized, false);
  assert.equal(payload.integrationReturn.fileBytesReceived, false);
  assert.equal(payload.integrationReturn.recordLevelDataReceived, false);
  assert.equal(payload.integrationReturn.patientIdentifiersReceived, false);
  assert.equal(payload.integrationReturn.ownerIdentityVerified, false);
  assert.equal(payload.integrationReturn.authoritativeContractAccepted, false);
  assert.equal(payload.integrationReturn.productionIntegrationAuthorized, false);
  assert.equal(payload.integrationReturn.clinicalUseAuthorized, false);
  assert.equal(payload.calibrationIntake.recordsReceived, false);
  assert.equal(payload.calibrationIntake.recordLevelIntakeEnabled, false);
  assert.equal(payload.calibrationIntake.phiApproved, false);
  assert.equal(payload.calibrationIntake.deidentificationAccepted, false);
  assert.equal(payload.calibrationIntake.holdoutValid, false);
  assert.equal(payload.calibrationIntake.clinicalValidation, false);
  assert.equal(payload.calibrationIntake.trainingDatasetCreated, false);
  assert.equal(payload.calibrationIntake.productionDataConnected, false);
  assert.equal(payload.calibrationIntake.pilotAuthorizationRecorded, false);
  assert.equal(payload.counselorLab.rosterAccepted, false);
  assert.equal(payload.counselorLab.attendanceRecorded, false);
  assert.equal(payload.counselorLab.trainingCompleted, false);
  assert.equal(payload.counselorLab.counselorReferencesAccepted, false);
  assert.equal(payload.counselorLab.protocolFrozen, false);
  assert.equal(payload.counselorLab.independentReviewComplete, false);
  assert.equal(payload.counselorLab.accuracyEstablished, false);
  assert.equal(payload.counselorLab.reliabilityEstablished, false);
  assert.equal(payload.counselorLab.clinicalValidation, false);
  assert.equal(payload.counselorLab.pilotAuthorizationRecorded, false);
  assert.equal(payload.counselorLab.productionReleaseAuthorized, false);
  assert.equal(payload.counselorLab.patientUseAuthorized, false);
  assert.equal(payload.counselorNotebook.counselorIdentityVerified, false);
  assert.equal(payload.counselorNotebook.attendanceRecorded, false);
  assert.equal(payload.counselorNotebook.trainingCompleted, false);
  assert.equal(payload.counselorNotebook.clinicalDecisionAccepted, false);
  assert.equal(payload.counselorNotebook.counselorReferenceAccepted, false);
  assert.equal(payload.counselorNotebook.protocolFrozen, false);
  assert.equal(payload.counselorNotebook.independentReviewCompleted, false);
  assert.equal(payload.counselorNotebook.accuracyEstablished, false);
  assert.equal(payload.counselorNotebook.reliabilityEstablished, false);
  assert.equal(payload.counselorNotebook.clinicalValidation, false);
  assert.equal(payload.counselorNotebook.pilotAuthorized, false);
  assert.equal(payload.counselorNotebook.productionReleaseAuthorized, false);
  assert.equal(payload.counselorNotebook.patientUseAuthorized, false);
  assert.equal(payload.progressReview.authoritativeSubjectLinkage, false);
  assert.equal(payload.progressReview.clinicalProgressEstablished, false);
  assert.equal(payload.progressReview.improvementEstablished, false);
  assert.equal(payload.progressReview.treatmentResponseEstablished, false);
  assert.equal(payload.progressReview.clinicalValidation, false);
  assert.equal(payload.progressReview.patientUseAuthorized, false);
  assert.equal(payload.modelTrial.credentialsReceived, false);
  assert.equal(payload.modelTrial.endpointReceived, false);
  assert.equal(payload.modelTrial.modelOutputReceived, false);
  assert.equal(payload.modelTrial.recordLevelDataReceived, false);
  assert.equal(payload.modelTrial.phiReceived, false);
  assert.equal(payload.modelTrial.externalTransferPerformed, false);
  assert.equal(payload.modelTrial.vendorClaimsVerified, false);
  assert.equal(payload.modelTrial.securityApproved, false);
  assert.equal(payload.modelTrial.privacyApproved, false);
  assert.equal(payload.modelTrial.clinicalPerformanceEstablished, false);
  assert.equal(payload.modelTrial.independentReviewComplete, false);
  assert.equal(payload.modelTrial.engineSelected, false);
  assert.equal(payload.modelTrial.productionReleaseAuthorized, false);
  assert.equal(payload.modelTrial.patientUseAuthorized, false);
  assert.equal(payload.candidateTrial.candidateRunsPlanned, 9);
  assert.equal(payload.candidateTrial.blindCellsPlanned, 12);
  assert.equal(payload.candidateTrial.transportConfigured, false);
  assert.equal(payload.candidateTrial.assessmentPayloadIncluded, false);
  assert.equal(payload.candidateTrial.modelOutputReceived, false);
  assert.equal(payload.candidateTrial.reviewerIdentityReceived, false);
  assert.equal(payload.candidateTrial.providerCallPerformed, false);
  assert.equal(payload.candidateTrial.candidateTransportAuthorized, false);
  assert.equal(payload.candidateTrial.counselorPanelAccepted, false);
  assert.equal(payload.candidateTrial.trialExecutionAuthorized, false);
  assert.equal(payload.candidateTrial.engineSelected, false);
  assert.equal(payload.candidateTrial.patientUseAuthorized, false);
  assert.equal(payload.incidentResponse.ownerAssignmentsComplete, false);
  assert.equal(payload.incidentResponse.clinicalRestartAuthorized, false);
  assert.equal(payload.pilotReadiness.productionReadinessClaimed, false);
  assert.equal(payload.pilotReadiness.externalApprovalsRecorded, false);
  assert.equal(payload.pilotReadiness.productionOwnersAssigned, false);
  assert.equal(payload.pilotReadiness.pilotAuthorizationRecorded, false);
  assert.equal(payload.pilotReadiness.clinicalReleaseAuthorized, false);
  assert.equal(health.headers.get("x-frame-options"), "DENY");

  const listing = await fetch(`${base}/api/assessments`).then(response => response.json());
  assert.equal(listing.assessments.length, 3);
  assert.ok(listing.assessments.every(item => item.id.startsWith("FF-TEST-")));
  assert.ok(listing.assessments.every(item => !("hypotheses" in item) && !("questions" in item)));

  const detail = await fetch(`${base}/api/assessments/FF-TEST-2407-A`).then(response => response.json());
  assert.ok(detail.interpretation.hypotheses.length > 0);
  assert.equal(detail.interpretation.provider, "deterministic-calibration");
  assert.equal(detail.generation.provider.externalTransmission, false);
  assert.equal(detail.generation.inputHash.length, 64);
  assert.equal(detail.generation.outputHash.length, 64);
  assert.equal(detail.generationChain.valid, true);

  const model = await fetch(`${base}/api/model/status`).then(response => response.json());
  assert.equal(model.activeProvider.mode, "rules");
  assert.equal(model.activeProvider.externalTransmission, false);
  assert.equal(model.activeProvider.phiApproved, false);
  assert.equal(model.materialization.regeneratedOnRead, false);
  assert.equal(model.materialization.active, 3);
  assert.equal(model.chain.valid, true);
});

test("deployment-review API reports a ready software candidate without clinical authority", async t => {
  const base = await withServer(t, { presentationMode: "deployment-review" });
  const response = await fetch(`${base}/api/health`);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.environment, "deployment-review");
  assert.equal(payload.deploymentPresentation.candidateVersion, "2.49");
  assert.equal(payload.deploymentPresentation.label, "Deployment candidate");
  assert.equal(payload.deploymentPresentation.deploymentReviewReady, true);
  assert.equal(payload.deploymentPresentation.persistent, true);
  assert.equal(payload.deploymentPresentation.productionStaticPathExercised, true);
  assert.equal(payload.deploymentPresentation.authenticatedIdentityConfigured, false);
  assert.equal(payload.deploymentPresentation.authoritativeEqpassConnected, false);
  assert.equal(payload.deploymentPresentation.productionModelAuthorized, false);
  assert.equal(payload.deploymentPresentation.clinicalValidationComplete, false);
  assert.equal(payload.deploymentPresentation.clinicalUseAuthorized, false);
});

test("recovery operations API records a verified isolated rehearsal without a production claim", async t => {
  const base = await withServer(t);
  let status = await fetch(`${base}/api/operations/recovery`).then(response => response.json());
  assert.equal(status.status, "not-run");
  assert.equal(status.chain.count, 0);
  assert.equal(status.productionRecoveryClaimed, false);

  const response = await fetch(`${base}/api/operations/recovery/rehearse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RECOVERY-API" },
    body: "{}"
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "verified");
  assert.equal(result.event.actor, "RECOVERY-API");
  assert.equal(result.event.verification.recordCountsMatch, true);
  assert.equal(result.event.verification.allLedgersValid, true);
  assert.equal(result.event.verification.isolatedCopyRemoved, true);
  assert.equal(result.event.productionRecoveryClaimed, false);

  status = await fetch(`${base}/api/operations/recovery`).then(response => response.json());
  assert.equal(status.chain.valid, true);
  assert.equal(status.chain.verified, 1);
  assert.equal(status.lastEvent.hash, result.event.hash);
});

test("rollback operations API verifies local compatibility without performing a deployment", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ROLLBACK-API" };
  let status = await fetch(`${base}/api/operations/rollback`).then(response => response.json());
  assert.equal(status.status, "not-run");
  assert.equal(status.baseline.sourceFileCount, 154);
  assert.equal(status.baseline.deployableArtifactAvailable, false);

  await fetch(`${base}/api/operations/recovery/rehearse`, { method: "POST", headers, body: "{}" });
  const response = await fetch(`${base}/api/operations/rollback/rehearse`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "verified-local-compatibility");
  assert.equal(result.event.actor, "ROLLBACK-API");
  assert.equal(result.event.verification.sourceFilesMatch, true);
  assert.equal(result.event.verification.syntheticRegressionPassed, true);
  assert.equal(result.event.verification.recoveryPrerequisiteVerified, true);
  assert.equal(result.event.productionRollbackPerformed, false);
  assert.equal(result.event.deployableArtifactRestored, false);
  assert.equal(result.event.clinicalReleaseAuthorized, false);

  status = await fetch(`${base}/api/operations/rollback`).then(response => response.json());
  assert.equal(status.chain.valid, true);
  assert.equal(status.chain.verified, 1);
  assert.equal(status.lastEvent.hash, result.event.hash);
});

test("release operations API builds, locally qualifies, and serves one exact PHI-excluding candidate without granting deployment authority", async t => {
  const base = await withServer(t, { releaseAdmissionQualifier: async () => successfulAdmissionRun() });
  let status = await fetch(`${base}/api/operations/release`).then(response => response.json());
  assert.equal(status.contractVersion, RELEASE_CANDIDATE_CONTRACT);
  assert.equal(status.status, "not-built");
  assert.equal(status.candidateCount, 0);
  assert.equal(status.trust.mode, "disabled");
  assert.equal(status.runtimeStateIncluded, false);
  assert.equal(status.phiIncluded, false);
  assert.equal(status.credentialsIncluded, false);
  assert.equal(status.productionSignatureVerified, false);
  assert.equal(status.azureDeploymentPerformed, false);
  assert.equal(status.clinicalReleaseAuthorized, false);

  const buildResponse = await fetch(`${base}/api/operations/release/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RELEASE-API-QA" },
    body: "{}"
  });
  const built = await buildResponse.json();
  assert.equal(buildResponse.status, 201);
  assert.equal(built.candidate.status, "verified-release-candidate");
  assert.match(built.candidate.artifactId, /^perl-rc-[a-f0-9]{20}$/);
  assert.match(built.candidate.archiveSha256, /^[a-f0-9]{64}$/);
  assert.ok(built.candidate.sourceFileCount > 200);
  assert.equal(built.candidate.productionSignatureVerified, false);
  assert.equal(built.candidate.azureDeploymentPerformed, false);
  assert.equal(built.candidate.clinicalReleaseAuthorized, false);
  assert.equal(built.candidate.patientUseAuthorized, false);

  const archiveResponse = await fetch(`${base}${built.candidate.downloads.archive}`);
  assert.equal(archiveResponse.status, 200);
  assert.match(archiveResponse.headers.get("content-type"), /application\/gzip/);
  assert.match(archiveResponse.headers.get("content-disposition"), /PERL-perl-rc-/);
  assert.ok((await archiveResponse.arrayBuffer()).byteLength > 1_000_000);

  const manifestResponse = await fetch(`${base}${built.candidate.downloads.manifest}`);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.contractVersion, "perl-release-candidate-manifest/1.0");
  assert.equal(manifest.artifactId, built.candidate.artifactId);
  assert.equal(manifest.claims.runtimeStateIncluded, false);
  assert.equal(manifest.claims.phiIncluded, false);
  assert.equal(manifest.claims.credentialsIncluded, false);
  assert.equal(manifest.claims.productionSignatureVerified, false);
  assert.equal(manifest.claims.clinicalReleaseAuthorized, false);

  const policyTemplateResponse = await fetch(`${base}/api/operations/release/trust-policy-template.json`);
  const policyTemplate = await policyTemplateResponse.json();
  assert.equal(policyTemplate.contractVersion, RELEASE_TRUST_POLICY_CONTRACT);
  assert.equal(policyTemplate.algorithm, "Ed25519");
  assert.equal(Object.hasOwn(policyTemplate, "privateKeyPem"), false);

  const signatureResponse = await fetch(`${base}/api/operations/release/signatures/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope: {} })
  });
  assert.equal(signatureResponse.status, 409);
  assert.match((await signatureResponse.json()).error, /disabled/i);

  status = await fetch(`${base}/api/operations/release`).then(response => response.json());
  assert.equal(status.status, "verified-release-candidate");
  assert.equal(status.candidateCount, 1);
  assert.equal(status.latest.artifactId, built.candidate.artifactId);
  assert.equal(status.latest.productionSignatureVerified, false);

  let admission = await fetch(`${base}/api/operations/release/admission`).then(response => response.json());
  assert.equal(admission.contractVersion, RELEASE_ADMISSION_CONTRACT);
  assert.equal(admission.policyVersion, RELEASE_ADMISSION_POLICY);
  assert.equal(admission.status, "not-run");
  assert.equal(admission.candidateId, built.candidate.artifactId);

  const admissionResponse = await fetch(`${base}/api/operations/release/candidates/${built.candidate.artifactId}/admission/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RELEASE-API-QA" },
    body: "{}"
  });
  admission = await admissionResponse.json();
  assert.equal(admissionResponse.status, 201);
  assert.equal(admission.status, "qualified-local");
  assert.equal(admission.latest.artifact.artifactId, built.candidate.artifactId);
  assert.equal(admission.latest.summary.passed, 6);
  assert.equal(admission.latest.authority.localArchiveQualificationPassed, true);
  assert.equal(admission.latest.authority.isolatedCiRun, false);
  assert.equal(admission.latest.authority.externalVulnerabilityReviewCompleted, false);
  assert.equal(admission.latest.authority.azureDeploymentPerformed, false);
  assert.equal(admission.latest.authority.clinicalReleaseAuthorized, false);

  const reportResponse = await fetch(`${base}/api/operations/release/admissions/${admission.latest.admissionId}/report.json`);
  const report = await reportResponse.json();
  assert.equal(reportResponse.status, 200);
  assert.match(reportResponse.headers.get("content-disposition"), /PERL-perl-adm-/);
  assert.equal(report.evidenceHash, admission.latest.evidenceHash);
  assert.equal(report.artifact.archiveSha256, built.candidate.archiveSha256);

  let promotion = await fetch(`${base}/api/operations/release/promotion`).then(response => response.json());
  assert.equal(promotion.contractVersion, RELEASE_PROMOTION_CONTRACT);
  assert.equal(promotion.status, "request-required");
  assert.equal(promotion.localArchiveQualificationPassed, true);
  assert.equal(promotion.externalEvidenceVerified, false);
  assert.equal(promotion.trust.mode, "disabled");

  const promotionResponse = await fetch(`${base}/api/operations/release/candidates/${built.candidate.artifactId}/promotion/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  promotion = await promotionResponse.json();
  assert.equal(promotionResponse.status, 201);
  assert.equal(promotion.status, "external-evidence-required");
  assert.equal(promotion.latest.artifactId, built.candidate.artifactId);
  assert.equal(promotion.latest.gateCount, 10);
  assert.equal(promotion.productionArtifactPromoted, false);
  assert.equal(promotion.deploymentAuthorized, false);
  assert.equal(promotion.azureDeploymentPerformed, false);
  assert.equal(promotion.clinicalReleaseAuthorized, false);

  const promotionRequestResponse = await fetch(`${base}${promotion.latest.downloads.request}`);
  const promotionRequest = await promotionRequestResponse.json();
  assert.match(promotionRequestResponse.headers.get("content-disposition"), /PERL-perl-prm-/);
  assert.equal(promotionRequest.contractVersion, RELEASE_PROMOTION_REQUEST_CONTRACT);
  assert.equal(promotionRequest.gates.length, 10);
  assert.equal(promotionRequest.authority.productionArtifactPromoted, false);

  const attestationTemplate = await fetch(`${base}${promotion.latest.downloads.attestationTemplate}`).then(response => response.json());
  assert.equal(attestationTemplate.contractVersion, RELEASE_PROMOTION_ATTESTATION_CONTRACT);
  assert.equal(attestationTemplate.authority.productionArtifactPromoted, true);
  assert.equal(attestationTemplate.authority.deploymentAuthorized, false);

  const promotionPolicyTemplate = await fetch(`${base}/api/operations/release/promotion-trust-policy-template.json`).then(response => response.json());
  assert.equal(promotionPolicyTemplate.contractVersion, RELEASE_PROMOTION_TRUST_POLICY_CONTRACT);
  assert.equal(Object.hasOwn(promotionPolicyTemplate, "privateKeyPem"), false);

  const promotionVerifyResponse = await fetch(`${base}/api/operations/release/promotions/attestations/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attestation: {} })
  });
  assert.equal(promotionVerifyResponse.status, 409);
  assert.match((await promotionVerifyResponse.json()).error, /disabled/i);
});

test("monitoring operations API records local evidence while leaving production gaps open", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "MONITORING-API" };
  let status = await fetch(`${base}/api/operations/monitoring`).then(response => response.json());
  assert.equal(status.status, "local-attention-required");
  assert.equal(status.chain.count, 0);
  assert.equal(status.current.productionGaps.length, 3);

  await fetch(`${base}/api/operations/recovery/rehearse`, { method: "POST", headers, body: "{}" });
  await fetch(`${base}/api/operations/rollback/rehearse`, { method: "POST", headers, body: "{}" });
  const response = await fetch(`${base}/api/operations/monitoring/probe`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "local-controls-clear");
  assert.equal(result.event.actor, "MONITORING-API");
  assert.equal(result.event.signalCounts.pass, 8);
  assert.equal(result.event.signalCounts.unavailable, 3);
  assert.equal(result.event.productionAlertingConnected, false);
  assert.equal(result.event.externalNotificationsSent, false);
  assert.deepEqual(result.event.localAlerts, []);

  status = await fetch(`${base}/api/operations/monitoring`).then(response => response.json());
  assert.equal(status.chain.valid, true);
  assert.equal(status.chain.clear, 1);
  assert.equal(status.lastEvent.hash, result.event.hash);
});

test("incident-response API rehearses a fixed scenario only after current continuity evidence", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RESPONSE-API" };
  let status = await fetch(`${base}/api/operations/incidents/response`).then(response => response.json());
  assert.equal(status.status, "not-run");
  assert.equal(status.readyToRehearse, false);
  assert.equal(status.scenarios.length, 6);
  assert.ok(status.ownerTree.every(owner => owner.status === "unassigned-production-owner"));

  let response = await fetch(`${base}/api/operations/incidents/response/rehearse`, { method: "POST", headers, body: JSON.stringify({ scenarioId: "critical-safety-routing" }) });
  assert.equal(response.status, 409);

  await fetch(`${base}/api/operations/recovery/rehearse`, { method: "POST", headers, body: "{}" });
  await fetch(`${base}/api/operations/rollback/rehearse`, { method: "POST", headers, body: "{}" });
  await fetch(`${base}/api/operations/monitoring/probe`, { method: "POST", headers, body: "{}" });
  response = await fetch(`${base}/api/operations/incidents/response/rehearse`, { method: "POST", headers, body: JSON.stringify({ scenarioId: "critical-safety-routing" }) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, "tabletop-complete");
  assert.equal(result.event.actor, "RESPONSE-API");
  assert.equal(result.event.severity, "SEV1");
  assert.equal(result.event.phases.length, 4);
  assert.equal(result.event.productionIncidentDeclared, false);
  assert.equal(result.event.productionServiceStopped, false);
  assert.equal(result.event.externalNotificationsSent, false);
  assert.equal(result.event.clinicalRestartAuthorized, false);
  assert.ok(result.event.notificationTree.every(owner => owner.ownerState === "unassigned-production-owner"));
  assert.ok(result.event.restartCriteria.every(item => item.productionEvidencePresent === false));
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.completed, 1);

  status = await fetch(`${base}/api/operations/incidents/response`).then(response => response.json());
  assert.equal(status.lastEvent.hash, result.event.hash);
});

test("pilot-readiness API names the missing permissions and records only a blocked snapshot", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "READINESS-API" };
  let status = await fetch(`${base}/api/governance/readiness`).then(response => response.json());
  assert.equal(status.status, "pilot-authorization-blocked");
  assert.deepEqual(status.current.gateCounts, { localCurrent: 2, localRequired: 5, externalDecisionRequired: 7, total: 14 });
  assert.deepEqual(status.current.authorityCounts, { confirmed: 1, provisional: 1, unassigned: 8, total: 10 });
  assert.equal(status.current.authorityRegister.find(role => role.id === "executive-sponsor").name, "Dolores");
  assert.equal(status.current.authorityRegister.find(role => role.id === "clinical-lead").name, null);

  const marketability = await fetch(`${base}/api/governance/marketability`).then(response => response.json());
  assert.equal(marketability.contractVersion, "perl-marketability-map/1.0");
  assert.equal(marketability.status, "evidence-building");
  assert.deepEqual(marketability.evidenceSnapshot, {
    localCurrent: 2,
    localRequired: 5,
    externalAccepted: 0,
    externalDecisionRequired: 7,
    authorityConfirmed: 1,
    authorityProvisional: 1,
    authorityUnassigned: 8
  });
  assert.equal(marketability.phases.length, 4);
  assert.equal(marketability.phases.at(-1).status, "pilot-blocked");
  assert.equal(marketability.planningWindow.calendarCommitment, false);
  assert.equal(marketability.marketabilityReady, false);

  const handoffResponse = await fetch(`${base}/api/governance/handoff.json`);
  const handoff = await handoffResponse.json();
  assert.equal(handoffResponse.status, 200);
  assert.equal(handoff.contractVersion, "perl-executive-handoff/1.0");
  assert.equal(handoff.status, "decision-room-open");
  assert.equal(handoff.preparedFor[0].name, "Dolores");
  assert.equal(handoff.preparedFor[1].name, "Mike");
  assert.equal(handoff.evidenceSnapshot.localCurrent, 2);
  assert.equal(handoff.evidenceSnapshot.externalAccepted, 0);
  assert.equal(handoff.packets.length, 4);
  assert.equal(handoff.packets.flatMap(packet => packet.decisions).length, 21);
  assert.equal(handoff.artifacts.length, 8);
  assert.equal(handoff.externalApprovalsRecorded, false);
  assert.equal(handoff.productionReadinessClaimed, false);
  assert.equal(handoff.pilotAuthorizationRecorded, false);
  assert.equal(handoff.phiIncluded, false);
  assert.match(handoff.packetFingerprint, /^[a-f0-9]{64}$/);

  const handoffHtmlResponse = await fetch(`${base}/api/governance/handoff.html`);
  const handoffHtml = await handoffHtmlResponse.text();
  assert.equal(handoffHtmlResponse.status, 200);
  assert.match(handoffHtmlResponse.headers.get("content-type"), /text\/html/);
  assert.match(handoffHtml, /Build &amp; integration decision brief\./);
  assert.match(handoffHtml, /Product \+ clinical charter/);
  assert.match(handoffHtml, /Keep the boundary clean\./);
  assert.match(handoffHtml, /does not assign authority/i);

  const response = await fetch(`${base}/api/governance/readiness/snapshot`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.event.actor, "READINESS-API");
  assert.equal(result.event.decision, "pilot-authorization-blocked");
  assert.equal(result.event.externalApprovalsRecorded, false);
  assert.equal(result.event.pilotAuthorizationRecorded, false);
  assert.equal(result.event.clinicalReleaseAuthorized, false);
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.blocked, 1);

  status = await fetch(`${base}/api/governance/readiness`).then(response => response.json());
  assert.equal(status.lastEvent.hash, result.event.hash);
});

test("Decision Exchange issues seven exact requests and preflights returns without accepting authority", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "DECISION-API-QA" };
  let response = await fetch(`${base}/api/governance/decision-exchange`);
  let { decisionExchange } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(decisionExchange.contractVersion, "perl-external-decision-exchange/1.0");
  assert.equal(decisionExchange.returnContractVersion, "perl-external-decision-return/rfi-1.0");
  assert.equal(decisionExchange.packets.length, 7);
  assert.equal(decisionExchange.counts.currentPreflights, 0);
  assert.equal(decisionExchange.counts.gatesClosed, 0);
  assert.equal(decisionExchange.externalAcceptanceRecorded, false);
  assert.equal(decisionExchange.authorityVerified, false);

  const gateId = decisionExchange.packets[0].id;
  const jsonResponse = await fetch(`${base}/api/governance/decision-exchange/${gateId}/request.json`);
  const manifest = await jsonResponse.json();
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers.get("content-disposition"), /decision-return\.json/);
  assert.equal(manifest.contractVersion, "perl-external-decision-return/rfi-1.0");
  assert.equal(manifest.gateId, gateId);
  assert.equal(manifest.trustBoundary.identityVerified, false);
  assert.equal(manifest.trustBoundary.gateAccepted, false);

  const htmlResponse = await fetch(`${base}/api/governance/decision-exchange/${gateId}/request.html`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(html, /Page 01 \/ 02/);
  assert.match(html, /Page 02 \/ 02/);
  assert.match(html, /This is not a signature surface/);
  assert.match(html, /no acceptance/i);

  manifest.returnId = "FF-DECISION-API-001";
  manifest.decision = "accept";
  manifest.decisionRecordReference = "FF-DECISION-RECORD-API-001";
  manifest.decidedAt = "2026-08-14T18:30:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-API-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-API-${index + 1}`, status: "declared-unverified" }));
  response = await fetch(`${base}/api/governance/decision-exchange/preflight`, { method: "POST", headers, body: JSON.stringify({ manifest }) });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.decisionPreview, "accept");
  assert.equal(result.event.identityVerified, false);
  assert.equal(result.event.authorityVerified, false);
  assert.equal(result.event.externalAcceptanceRecorded, false);
  assert.equal(result.event.gateAccepted, false);
  assert.equal(result.decisionExchange.counts.completeUnverified, 1);
  assert.equal(result.decisionExchange.counts.gatesClosed, 0);

  const exportResponse = await fetch(`${base}/api/governance/decision-exchange.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-external-decision-exchange\.json/);
  assert.equal(exported.chain.valid, true);
  assert.equal(exported.history.length, 1);

  await fetch(`${base}/api/governance/readiness/snapshot`, { method: "POST", headers, body: "{}" });
  decisionExchange = (await fetch(`${base}/api/governance/decision-exchange`).then(item => item.json())).decisionExchange;
  assert.equal(decisionExchange.packets[0].status, "preflight-stale");
  assert.equal(decisionExchange.counts.currentPreflights, 0);
  assert.equal(decisionExchange.counts.stalePreflights, 1);
  response = await fetch(`${base}/api/governance/decision-exchange/preflight`, { method: "POST", headers, body: JSON.stringify({ manifest }) });
  assert.equal(response.status, 400);
});

test("pilot-operations API exports and seals a source-backed plan without creating site authority", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "PILOT-API-QA" };
  let response = await fetch(`${base}/api/governance/pilot-operations`);
  let { pilotOperations } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(pilotOperations.contractVersion, "perl-provider-pilot-operations-plan/1.0");
  assert.equal(pilotOperations.candidates.length, 2);
  assert.equal(pilotOperations.counts.sourceReportedCaseload, 50);
  assert.equal(pilotOperations.counts.workingMonths, 10);
  assert.equal(pilotOperations.counts.quarterlyReviews, 4);
  assert.equal(pilotOperations.counts.admissionGates, 7);
  assert.equal(pilotOperations.siteVerified, false);
  assert.equal(pilotOperations.pilotAuthorized, false);

  const htmlResponse = await fetch(`${base}/api/governance/pilot-operations.html`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get("content-disposition"), /PERL-provider-pilot-operating-brief\.html/);
  assert.match(html, /Page 01 \/ 03/);
  assert.match(html, /Page 02 \/ 03/);
  assert.match(html, /Page 03 \/ 03/);
  assert.match(html, /Provider pilot first/);

  const jsonResponse = await fetch(`${base}/api/governance/pilot-operations.json`);
  const exported = await jsonResponse.json();
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers.get("content-disposition"), /perl-provider-pilot-operations-plan\.json/);
  assert.equal(exported.planFingerprint, pilotOperations.planFingerprint);

  response = await fetch(`${base}/api/governance/pilot-operations/snapshot`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.actor, "PILOT-API-QA");
  assert.equal(result.event.decision, "site-specific-pilot-authorization-remains-external");
  assert.equal(result.event.siteIdentityVerified, false);
  assert.equal(result.event.agreementExecuted, false);
  assert.equal(result.event.trainingCompleted, false);
  assert.equal(result.event.pilotAuthorized, false);
  assert.equal(result.event.pilotStarted, false);
  assert.equal(result.event.outcomeEstablished, false);
  assert.equal(result.event.renewalApproved, false);
  assert.equal(result.event.expansionApproved, false);
  assert.equal(result.pilotOperations.chain.valid, true);
  assert.equal(result.pilotOperations.latestSnapshot.current, true);

  pilotOperations = (await fetch(`${base}/api/governance/pilot-operations`).then(item => item.json())).pilotOperations;
  assert.equal(pilotOperations.history.length, 1);
  assert.equal(pilotOperations.chain.count, 1);
});

test("provider-activation API exports and seals a rehearsal workbook without creating completion", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ACTIVATION-API-QA" };
  let response = await fetch(`${base}/api/governance/provider-activation`);
  let { providerActivation } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(providerActivation.contractVersion, "perl-provider-activation-workbook/1.0");
  assert.equal(providerActivation.modules.length, 4);
  assert.equal(providerActivation.objectives.length, 8);
  assert.equal(providerActivation.drills.length, 4);
  assert.equal(providerActivation.requiredReturns.length, 10);
  assert.equal(providerActivation.counts.workingMinutes, 100);
  assert.equal(providerActivation.counts.registeredParticipants, 0);
  assert.equal(providerActivation.trainingScheduled, false);
  assert.equal(providerActivation.completionAccepted, false);
  assert.equal(providerActivation.activationAuthorized, false);

  const htmlResponse = await fetch(`${base}/api/governance/provider-activation.html`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get("content-disposition"), /PERL-provider-activation-workbook\.html/);
  assert.equal((html.match(/class="activation-sheet/g) || []).length, 4);
  assert.match(html, /Page 01 \/ 04/);
  assert.match(html, /Page 04 \/ 04/);

  const jsonResponse = await fetch(`${base}/api/governance/provider-activation.json`);
  const exported = await jsonResponse.json();
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers.get("content-disposition"), /perl-provider-activation-workbook\.json/);
  assert.equal(exported.workbookFingerprint, providerActivation.workbookFingerprint);

  response = await fetch(`${base}/api/governance/provider-activation/snapshot`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.actor, "ACTIVATION-API-QA");
  assert.equal(result.event.decision, "training-completion-and-site-activation-remain-external");
  assert.equal(result.event.sessionHeld, false);
  assert.equal(result.event.attendanceVerified, false);
  assert.equal(result.event.drillsPassed, false);
  assert.equal(result.event.completionAccepted, false);
  assert.equal(result.event.activationAuthorized, false);
  assert.equal(result.event.pilotAuthorized, false);
  assert.equal(result.event.patientUseAuthorized, false);
  assert.equal(result.providerActivation.chain.valid, true);
  assert.equal(result.providerActivation.latestSnapshot.current, true);

  providerActivation = (await fetch(`${base}/api/governance/provider-activation`).then(item => item.json())).providerActivation;
  assert.equal(providerActivation.history.length, 1);
  assert.equal(providerActivation.chain.count, 1);
});

test("site-admission API issues candidate dossiers and preflights metadata without recording authority", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "SITE-API-QA" };
  let response = await fetch(`${base}/api/governance/site-admission`);
  let { siteAdmission } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(siteAdmission.contractVersion, "perl-named-site-admission-dossier/1.0");
  assert.equal(siteAdmission.returnContractVersion, "perl-named-site-admission-return/rfi-1.0");
  assert.equal(siteAdmission.dossiers.length, 2);
  assert.equal(siteAdmission.counts.admissionBooks, 6);
  assert.equal(siteAdmission.counts.admissionQuestions, 12);
  assert.equal(siteAdmission.counts.requiredAuthorities, 5);
  assert.equal(siteAdmission.counts.sitesVerified, 0);
  assert.equal(siteAdmission.authorizationRecorded, false);
  assert.equal(siteAdmission.pilotStarted, false);

  const dossier = siteAdmission.dossiers[0];
  const htmlResponse = await fetch(`${base}/api/governance/site-admission/${dossier.candidate.id}/dossier.html`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get("content-disposition"), /admission-dossier\.html/);
  assert.equal((html.match(/class="admission-sheet/g) || []).length, 4);
  assert.match(html, /Page 01 \/ 04/);
  assert.match(html, /Page 04 \/ 04/);
  assert.match(html, /This is not a signature surface/);

  const portfolioExport = await fetch(`${base}/api/governance/site-admission.json`);
  const exported = await portfolioExport.json();
  assert.equal(portfolioExport.status, 200);
  assert.match(portfolioExport.headers.get("content-disposition"), /perl-named-site-admission-portfolio\.json/);
  assert.equal(exported.portfolioFingerprint, siteAdmission.portfolioFingerprint);

  const returnResponse = await fetch(`${base}/api/governance/site-admission/${dossier.candidate.id}/return.json`);
  const manifest = await returnResponse.json();
  assert.equal(returnResponse.status, 200);
  assert.match(returnResponse.headers.get("content-disposition"), /admission-return\.json/);
  manifest.returnId = "FF-DECISION-SITE-API-RETURN-001";
  manifest.decision = "do-not-authorize";
  manifest.decisionRecordReference = "FF-DECISION-SITE-API-DECLINE-001";
  manifest.decidedAt = "2026-08-14T22:30:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-SITE-API-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-SITE-API-${index + 1}`, status: "declared-unverified" }));

  response = await fetch(`${base}/api/governance/site-admission/preflight`, { method: "POST", headers, body: JSON.stringify({ manifest }) });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.actor, "SITE-API-QA");
  assert.equal(result.event.metadataChecklistComplete, true);
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.disposition, "site-authorization-remains-external");
  assert.equal(result.event.siteIdentityVerified, false);
  assert.equal(result.event.authorityVerified, false);
  assert.equal(result.event.authorizationRecorded, false);
  assert.equal(result.event.pilotAuthorized, false);
  assert.equal(result.event.pilotStarted, false);
  assert.equal(result.siteAdmission.chain.valid, true);
  assert.equal(result.siteAdmission.dossiers[0].latestPreflight.current, true);
  assert.equal(result.siteAdmission.counts.completeUnverified, 1);

  siteAdmission = (await fetch(`${base}/api/governance/site-admission`).then(item => item.json())).siteAdmission;
  assert.equal(siteAdmission.history.length, 1);
  assert.equal(siteAdmission.chain.count, 1);
});

test("independent-review API exports and seals only a local non-authorizing dossier", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/calibration/independent-review`);
  const { independentReview } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(independentReview.contractVersion, "perl-independent-review-dossier/1.0");
  assert.equal(independentReview.gateCounts.externalAccepted, 0);
  assert.equal(independentReview.gateCounts.externalDecisionRequired, 6);
  assert.equal(independentReview.controlledInputs.find(item => item.filename === "meta_thresholds_responses_cs.xlsx").status, "named-in-correspondence-not-connected");
  assert.equal(independentReview.controlledInputs.find(item => item.filename === "question_categories_capitalized.xlsx").status, "named-in-correspondence-not-connected");
  assert.equal(independentReview.independentEvaluatorNamed, false);
  assert.equal(independentReview.independentReviewComplete, false);

  const sealResponse = await fetch(`${base}/api/calibration/independent-review/seal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "INDEPENDENT-API-QA" },
    body: "{}"
  });
  const sealed = await sealResponse.json();
  assert.equal(sealResponse.status, 201);
  assert.equal(sealed.event.decision, "independent-review-not-authorized");
  assert.equal(sealed.event.externalApprovalsRecorded, false);
  assert.equal(sealed.event.accuracyEstablished, false);
  assert.equal(sealed.event.reliabilityEstablished, false);
  assert.equal(sealed.independentReview.chain.valid, true);
  assert.equal(sealed.independentReview.chain.count, 1);

  const exportResponse = await fetch(`${base}/api/calibration/independent-review.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-independent-review-dossier\.json/);
  assert.equal(exported.latestSeal.hash, sealed.event.hash);
  assert.equal(exported.clinicalValidation, false);
  assert.equal(exported.productionReleaseAuthorized, false);
});

test("independent-review admission API defaults closed and exposes only governed external-return seams", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/calibration/independent-review/admission`);
  const { independentReviewAdmission } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(independentReviewAdmission.contractVersion, "perl-independent-review-admission-docket/1.0");
  assert.equal(independentReviewAdmission.registry.externallyProvisioned, false);
  assert.equal(independentReviewAdmission.counts.requiredExternalDuties, 7);
  assert.equal(independentReviewAdmission.counts.verifiedExternalDuties, 0);
  assert.equal(independentReviewAdmission.independentReviewExecutionReady, false);
  assert.equal(independentReviewAdmission.independentReviewComplete, false);
  assert.equal(independentReviewAdmission.accuracyEstablished, false);
  assert.equal(independentReviewAdmission.reliabilityEstablished, false);
  assert.equal(independentReviewAdmission.clinicalValidation, false);
  assert.equal(independentReviewAdmission.signingApiAvailable, false);
  assert.equal(independentReviewAdmission.resultSubmissionApiAvailable, false);

  const templateResponse = await fetch(`${base}/api/calibration/independent-review/admission/registry-template.json`);
  const template = await templateResponse.json();
  assert.equal(templateResponse.status, 200);
  assert.match(templateResponse.headers.get("content-disposition"), /independent-review-admission-registry-template\.json/);
  assert.equal(template.keys.length, 7);

  const challengeResponse = await fetch(`${base}/api/calibration/independent-review/admission/challenges`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(challengeResponse.status, 409);

  const exportResponse = await fetch(`${base}/api/calibration/independent-review/admission.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /independent-review-admission-docket\.json/);
  assert.equal(exported.productionReleaseAuthorized, false);
  assert.equal(exported.patientUseAuthorized, false);
});

test("e-QPASS owner-return API preflights metadata only and keeps authority external", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/integration/owner-return`);
  const { integrationReturn } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(integrationReturn.contractVersion, "perl-eqpass-owner-return-preflight/1.0");
  assert.equal(integrationReturn.status, "return-package-not-received");
  assert.equal(integrationReturn.artifacts.length, 8);
  assert.equal(integrationReturn.artifacts[0].expectedFilename, "meta_thresholds_responses_cs.xlsx");
  assert.equal(integrationReturn.artifacts[1].expectedFilename, "question_categories_capitalized.xlsx");
  assert.equal(integrationReturn.fileBytesReceived, false);
  assert.equal(integrationReturn.authoritativeContractAccepted, false);

  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-API-001";
  manifest.artifacts = manifest.artifacts.map((artifact, index) => ({
    ...artifact,
    status: "metadata-declared-unverified",
    version: `candidate-${index + 1}`,
    sha256: "d".repeat(64),
    mediaType: INTEGRATION_RETURN_ARTIFACTS[index].expectedMediaType,
    dataClass: INTEGRATION_RETURN_ARTIFACTS[index].expectedDataClass
  }));
  const preflightResponse = await fetch(`${base}/api/integration/owner-return/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RETURN-API-QA" },
    body: JSON.stringify({ manifest })
  });
  const result = await preflightResponse.json();
  assert.equal(preflightResponse.status, 201);
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.counts.metadataComplete, 8);
  assert.equal(result.event.decision, "rfi-remains-open");
  assert.equal(result.event.ownerIdentityVerified, false);
  assert.equal(result.event.authoritativeContractAccepted, false);
  assert.equal(result.event.productionIntegrationAuthorized, false);
  assert.equal(result.integrationReturn.chain.valid, true);
  assert.equal(result.integrationReturn.chain.count, 1);

  const requestResponse = await fetch(`${base}/api/integration/owner-return/request.json`);
  const requestPacket = await requestResponse.json();
  assert.equal(requestResponse.status, 200);
  assert.match(requestResponse.headers.get("content-disposition"), /perl-eqpass-owner-return-request\.json/);
  assert.equal(requestPacket.latestPreflight.hash, result.event.hash);
  assert.equal(requestPacket.manifestTemplate.privacyBoundary.fileBytesIncluded, false);
  assert.equal(requestPacket.authoritativeContractAccepted, false);
});

test("Model Trial API preflights three metadata-only candidates and keeps selection authority blocked", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/calibration/model-trial`);
  const { modelTrial } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(modelTrial.contractVersion, "perl-model-trial-preflight/1.0");
  assert.equal(modelTrial.candidates.length, 3);
  assert.equal(modelTrial.domains.length, 6);
  assert.equal(modelTrial.counts.domainEvidenceRequired, 18);
  assert.equal(modelTrial.counts.candidatesDeclared, 0);
  assert.equal(modelTrial.engineSelected, false);
  assert.equal(modelTrial.externalTransferPerformed, false);

  const requestResponse = await fetch(`${base}/api/calibration/model-trial/request.json`);
  const template = await requestResponse.json();
  assert.equal(requestResponse.status, 200);
  assert.match(requestResponse.headers.get("content-disposition"), /perl-model-trial-candidate-request\.json/);
  assert.equal(template.candidates.length, 3);
  assert.equal(template.candidates[0].domainEvidence.length, 6);
  assert.equal(template.privacyBoundary.credentialsReceived, false);
  assert.equal(template.privacyBoundary.engineSelected, false);

  const invalid = completeModelTrialManifest();
  invalid.privacyBoundary.engineSelected = true;
  const invalidResponse = await fetch(`${base}/api/calibration/model-trial/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest: invalid })
  });
  assert.equal(invalidResponse.status, 400);

  const response = await fetch(`${base}/api/calibration/model-trial/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "MODEL-TRIAL-API-QA" },
    body: JSON.stringify({ manifest: completeModelTrialManifest() })
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.counts.metadataComplete, 3);
  assert.equal(result.event.counts.domainEvidenceDeclared, 18);
  assert.equal(result.event.decision, "engine-selection-not-authorized");
  assert.equal(result.event.engineSelected, false);
  assert.equal(result.event.vendorClaimsVerified, false);
  assert.equal(result.event.clinicalPerformanceEstablished, false);
  assert.equal(result.modelTrial.status, "metadata-complete-external-review-required");
  assert.equal(result.modelTrial.chain.valid, true);

  const exportResponse = await fetch(`${base}/api/calibration/model-trial.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-model-trial-bench\.json/);
  assert.equal(exported.latestPreflight.hash, result.event.hash);
  assert.equal(exported.history.length, 1);
  assert.equal(exported.engineSelected, false);
  assert.equal(exported.productionReleaseAuthorized, false);
});

test("Candidate Trial API exports and seals the nine-run, twelve-blind plan without executing it", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/calibration/candidate-trial`);
  const { candidateTrial } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(candidateTrial.contractVersion, "perl-candidate-trial-protocol/1.0");
  assert.equal(candidateTrial.status, "awaiting-candidate-metadata");
  assert.equal(candidateTrial.runEnvelopes.length, 9);
  assert.equal(candidateTrial.blindCells.length, 12);
  assert.equal(candidateTrial.measures.length, 6);
  assert.equal(candidateTrial.gates.length, 7);
  assert.equal(candidateTrial.counts.candidateOutputsReceived, 0);
  assert.equal(candidateTrial.providerCallPerformed, false);
  assert.equal(candidateTrial.trialExecutionAuthorized, false);
  assert.equal(candidateTrial.engineSelected, false);

  const response = await fetch(`${base}/api/calibration/candidate-trial/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "TRIAL-API-QA" },
    body: "{}"
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.type, "candidate-trial-planning-snapshot-recorded");
  assert.equal(result.event.counts.candidateRunsPlanned, 9);
  assert.equal(result.event.counts.blindCellsPlanned, 12);
  assert.equal(result.event.providerCallPerformed, false);
  assert.equal(result.event.trialExecutionAuthorized, false);
  assert.equal(result.candidateTrial.chain.valid, true);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-trial.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-candidate-trial-protocol\.json/);
  assert.equal(exported.latestSnapshot.hash, result.event.hash);
  assert.equal(exported.history.length, 1);
  assert.equal(exported.runEnvelopes.every(run => run.assessmentPayloadIncluded === false && run.modelOutputIncluded === false), true);
  assert.equal(exported.patientUseAuthorized, false);
});

test("Candidate Return API seals manual structured synthetic output without rendering it or selecting an engine", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RETURN-API-QA" };
  await fetch(`${base}/api/calibration/model-trial/preflight`, {
    method: "POST",
    headers,
    body: JSON.stringify({ manifest: completeModelTrialManifest() })
  });

  let response = await fetch(`${base}/api/calibration/candidate-returns`);
  let { candidateReturns } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(candidateReturns.contractVersion, "perl-manual-candidate-return/1.0");
  assert.equal(candidateReturns.status, "ready-for-manual-synthetic-returns");
  assert.equal(candidateReturns.runs.length, 9);
  assert.equal(candidateReturns.counts.currentReturnsReceived, 0);
  assert.equal(candidateReturns.outputContentRendered, false);
  assert.equal(candidateReturns.engineSelected, false);

  const kitResponse = await fetch(`${base}/api/calibration/candidate-returns/request.json`);
  const manifest = await kitResponse.json();
  assert.equal(kitResponse.status, 200);
  assert.match(kitResponse.headers.get("content-disposition"), /perl-candidate-return-kit\.json/);
  assert.equal(manifest.returns.length, 9);
  const returnItem = manifest.returns[0];
  const assessment = assessments.find(item => item.id === returnItem.caseId);
  const input = projectModelInput(assessment);
  manifest.returns = [{
    ...returnItem,
    promptVersion: "manual-api-prompt/1.0",
    bundle: {
      narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(input, audience)])),
      interpretation: generateClinicalInterpretation(input)
    }
  }];

  response = await fetch(`${base}/api/calibration/candidate-returns/outputs`, { method: "POST", headers, body: JSON.stringify(manifest) });
  const accepted = await response.json();
  assert.equal(response.status, 201);
  assert.equal(accepted.idempotent, false);
  assert.equal(accepted.events.length, 1);
  assert.equal(accepted.events[0].outputGateCount, 10);
  assert.equal(accepted.events[0].providerCallPerformedByPerl, false);
  assert.equal(accepted.events[0].candidateRunExternallyVerified, false);
  assert.equal(accepted.events[0].engineSelected, false);
  assert.equal(accepted.candidateReturns.counts.currentReturnsReceived, 1);
  assert.equal(accepted.candidateReturns.runs[0].currentReturn.bundleHash, accepted.events[0].bundleHash);
  assert.equal("bundle" in accepted.candidateReturns.runs[0].currentReturn, false);
  assert.equal("bundle" in accepted.candidateReturns.history[0], false);

  response = await fetch(`${base}/api/calibration/candidate-returns/outputs`, { method: "POST", headers, body: JSON.stringify(manifest) });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).idempotent, true);

  const unsafe = structuredClone(manifest);
  unsafe.privacyBoundary.phiIncluded = true;
  response = await fetch(`${base}/api/calibration/candidate-returns/outputs`, { method: "POST", headers, body: JSON.stringify(unsafe) });
  assert.equal(response.status, 400);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-returns.json`);
  candidateReturns = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-candidate-return-desk\.json/);
  assert.equal(candidateReturns.chain.valid, true);
  assert.equal(candidateReturns.chain.count, 1);
  assert.equal(candidateReturns.outputContentRendered, false);
  assert.equal(candidateReturns.blindReviewAuthorized, false);
  assert.equal(candidateReturns.patientUseAuthorized, false);
});

test("Candidate Review API fails closed, exports aggregate evidence, and withholds the answer key", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "BLIND-REVIEW-API-QA" };
  let response = await fetch(`${base}/api/calibration/candidate-review`, { headers });
  let { candidateReview } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(candidateReview.contractVersion, "perl-candidate-blind-review/1.0");
  assert.equal(candidateReview.status, "blocked-awaiting-governed-evidence");
  assert.equal(candidateReview.counts.readinessGatesSatisfied, 1);
  assert.equal(candidateReview.counts.readinessGatesRequired, 6);
  assert.equal(candidateReview.counts.engineRankingsPublished, 0);
  assert.equal(candidateReview.packetIssuanceEnabled, false);
  assert.equal(candidateReview.candidateIdentityVisibleToReviewer, false);
  assert.equal(candidateReview.authorMappingRevealedAfterSubmission, false);
  assert.equal("authorMapping" in candidateReview, false);

  response = await fetch(`${base}/api/calibration/candidate-review/assignments`, { method: "POST", headers, body: "{}" });
  const blocked = await response.json();
  assert.equal(response.status, 409);
  assert.match(blocked.error, /intake remains closed/i);

  response = await fetch(`${base}/api/calibration/candidate-review/outcomes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ assignmentId: "FF-CANDIDATE-REVIEW-ABCDEF0123456789ABCD", packetFingerprint: "a".repeat(64), cells: [] })
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /missing, expired, or already submitted/i);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-review.json`, { headers });
  candidateReview = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-candidate-blind-review-evidence\.json/);
  assert.equal(candidateReview.history.length, 0);
  assert.equal(candidateReview.chain.valid, true);
  assert.equal(candidateReview.engineRanked, false);
  assert.equal(candidateReview.engineSelected, false);
  assert.equal(candidateReview.patientUseAuthorized, false);
});

test("Candidate Refinement API stays closed without overlap and exports no identity or ranking", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "REFINEMENT-API-QA" };
  let response = await fetch(`${base}/api/calibration/candidate-refinement`, { headers });
  let { candidateRefinement } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(candidateRefinement.contractVersion, "perl-candidate-refinement-retest/1.0");
  assert.equal(candidateRefinement.status, "blocked-awaiting-independent-overlap");
  assert.equal(candidateRefinement.counts.readinessGatesSatisfied, 2);
  assert.equal(candidateRefinement.counts.currentReviewPackets, 0);
  assert.equal(candidateRefinement.counts.engineRankingsPublished, 0);
  assert.equal(candidateRefinement.cycleIssuanceEnabled, false);
  assert.equal(candidateRefinement.candidateScoresPublished, false);
  assert.equal(candidateRefinement.candidateOrderingPublished, false);

  response = await fetch(`${base}/api/calibration/candidate-refinement/cycles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ laneId: "lane-i" })
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /intake remains closed/i);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-refinement.json`, { headers });
  candidateRefinement = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-candidate-refinement-retest-desk\.json/);
  assert.deepEqual(candidateRefinement.cycles, []);
  assert.equal(candidateRefinement.chain.valid, true);
  assert.equal(JSON.stringify(candidateRefinement).includes("candidate-01"), false);

  response = await fetch(`${base}/api/calibration/candidate-refinement/cycles/FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD/retest-kit.json`, { headers });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /cycle not found/i);
});

test("Same-Case Retest API defaults closed and exposes exact return and X/Y review seams", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "RETEST-API-QA" };
  let response = await fetch(`${base}/api/calibration/candidate-retest`, { headers });
  let { candidateRetest } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(candidateRetest.contractVersion, "perl-candidate-retest-rereview/1.0");
  assert.equal(candidateRetest.returnContractVersion, "perl-candidate-retest-return/1.0");
  assert.equal(candidateRetest.status, "blocked-awaiting-scoped-cycle");
  assert.equal(candidateRetest.counts.selectedReturnsReceived, 0);
  assert.equal(candidateRetest.counts.selectedReviewPackets, 0);
  assert.equal(candidateRetest.counts.improvementClaimsPublished, 0);
  assert.equal(candidateRetest.packetIssuanceEnabled, false);
  assert.equal(candidateRetest.baselineRetestMappingVisibleToReviewer, false);
  assert.equal(candidateRetest.improvementEstablished, false);
  assert.equal(candidateRetest.engineSelected, false);

  response = await fetch(`${base}/api/calibration/candidate-retest/returns`, {
    method: "POST",
    headers,
    body: JSON.stringify({ contractVersion: "perl-candidate-retest-return/1.0", cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD" })
  });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /cycle not found/i);

  response = await fetch(`${base}/api/calibration/candidate-retest/reviews/assignments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD" })
  });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /cycle not found/i);

  response = await fetch(`${base}/api/calibration/candidate-retest/reviews/outcomes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ assignmentId: "FF-CANDIDATE-RETEST-REVIEW-ABCDEF0123456789ABCD" })
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /missing, expired, or already submitted/i);

  response = await fetch(`${base}/api/calibration/candidate-retest/cycles/FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD/return-kit.json`, { headers });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /cycle not found/i);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-retest.json`, { headers });
  candidateRetest = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-candidate-same-case-retest-rereview\.json/);
  assert.equal(candidateRetest.chains.retestReturns.valid, true);
  assert.equal(candidateRetest.chains.pairedReviews.valid, true);
  assert.equal(candidateRetest.independentDispositionRequired, true);
  assert.equal(candidateRetest.patientUseAuthorized, false);
});

test("candidate retest disposition API defaults closed and exposes only signed outside-return seams", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "DISPOSITION-API-QA" };
  const statusResponse = await fetch(`${base}/api/calibration/candidate-retest/disposition`, { headers });
  const { candidateRetestDisposition } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(candidateRetestDisposition.contractVersion, "perl-candidate-retest-independent-disposition/1.0");
  assert.equal(candidateRetestDisposition.status, "local-paired-evidence-required");
  assert.equal(candidateRetestDisposition.registry.externallyProvisioned, false);
  assert.equal(candidateRetestDisposition.counts.requiredExternalDuties, 4);
  assert.equal(candidateRetestDisposition.counts.verifiedExternalDuties, 0);
  assert.equal(candidateRetestDisposition.independentResultFrozen, false);
  assert.equal(candidateRetestDisposition.generalizedAccuracyEstablished, false);
  assert.equal(candidateRetestDisposition.generalizedReliabilityEstablished, false);
  assert.equal(candidateRetestDisposition.comparativeImprovementEstablished, false);
  assert.equal(candidateRetestDisposition.clinicalValidation, false);
  assert.equal(candidateRetestDisposition.cycleClosed, false);
  assert.equal(candidateRetestDisposition.signingApiAvailable, false);
  assert.equal(candidateRetestDisposition.registryWriteApiAvailable, false);

  const templateResponse = await fetch(`${base}/api/calibration/candidate-retest/disposition/registry-template.json`, { headers });
  const template = await templateResponse.json();
  assert.equal(templateResponse.status, 200);
  assert.match(templateResponse.headers.get("content-disposition"), /candidate-retest-disposition-registry-template\.json/);
  assert.equal(template.keys.length, 4);

  const challengeResponse = await fetch(`${base}/api/calibration/candidate-retest/disposition/challenges`, { method: "POST", headers, body: JSON.stringify({ cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD" }) });
  assert.equal(challengeResponse.status, 409);
  assert.match((await challengeResponse.json()).error, /four current, distinct/i);

  const verifyResponse = await fetch(`${base}/api/calibration/candidate-retest/disposition/attestations/verify`, { method: "POST", headers, body: JSON.stringify({ attestation: {} }) });
  assert.equal(verifyResponse.status, 400);
  assert.match((await verifyResponse.json()).error, /does not reference an issued challenge/i);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-retest/disposition.json`, { headers });
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /candidate-retest-independent-disposition-docket\.json/);
  assert.equal(exported.productionReleaseAuthorized, false);
  assert.equal(exported.patientUseAuthorized, false);
});

test("candidate advancement API defaults to a sealed two-room airlock with no key-write or local decision seam", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "AIRLOCK-API-QA" };
  const statusResponse = await fetch(`${base}/api/calibration/candidate-advancement`, { headers });
  const { candidateAdvancement } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(candidateAdvancement.contractVersion, "perl-exact-candidate-advancement-airlock/1.0");
  assert.equal(candidateAdvancement.status, "independent-result-required");
  assert.equal(candidateAdvancement.registries.cycleAction.externallyProvisioned, false);
  assert.equal(candidateAdvancement.registries.candidateAdvancement.externallyProvisioned, false);
  assert.equal(candidateAdvancement.counts.cycleActionDutiesRequired, 2);
  assert.equal(candidateAdvancement.counts.candidateAdvancementDutiesRequired, 4);
  assert.equal(candidateAdvancement.candidateIdentity.disclosed, false);
  assert.equal(candidateAdvancement.cycleClosed, false);
  assert.equal(candidateAdvancement.candidateAdvancementFrozen, false);
  assert.equal(candidateAdvancement.productionEngineSelected, false);
  assert.equal(candidateAdvancement.productionReleaseAuthorized, false);
  assert.equal(candidateAdvancement.patientUseAuthorized, false);
  assert.equal(candidateAdvancement.registryWriteApiAvailable, false);
  assert.equal(candidateAdvancement.signingApiAvailable, false);

  const cycleRegistryResponse = await fetch(`${base}/api/calibration/candidate-advancement/registries/cycle-action-template.json`, { headers });
  const cycleRegistry = await cycleRegistryResponse.json();
  assert.equal(cycleRegistryResponse.status, 200);
  assert.match(cycleRegistryResponse.headers.get("content-disposition"), /cycle-action-registry-template\.json/);
  assert.equal(cycleRegistry.keys.length, 2);

  const advancementRegistryResponse = await fetch(`${base}/api/calibration/candidate-advancement/registries/candidate-advancement-template.json`, { headers });
  const advancementRegistry = await advancementRegistryResponse.json();
  assert.equal(advancementRegistryResponse.status, 200);
  assert.match(advancementRegistryResponse.headers.get("content-disposition"), /candidate-advancement-registry-template\.json/);
  assert.equal(advancementRegistry.keys.length, 4);

  let response = await fetch(`${base}/api/calibration/candidate-advancement/cycle-action/challenges`, { method: "POST", headers, body: JSON.stringify({ cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD" }) });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /two current, distinct/i);

  response = await fetch(`${base}/api/calibration/candidate-advancement/candidate/challenges`, { method: "POST", headers, body: JSON.stringify({ cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD" }) });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /four current, distinct/i);

  response = await fetch(`${base}/api/calibration/candidate-advancement/cycle-action/attestations/verify`, { method: "POST", headers, body: JSON.stringify({ attestation: {} }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /does not reference an issued challenge/i);

  const exportResponse = await fetch(`${base}/api/calibration/candidate-advancement.json`, { headers });
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /exact-candidate-advancement-airlock\.json/);
  assert.equal(exported.candidateIdentity.disclosed, false);
  assert.equal(exported.candidateTransportAuthorized, false);
  assert.equal(exported.trafficActivationAuthorized, false);
});

test("Intended Use API versions a provider-first working charter without recording approval", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/governance/intended-use`);
  const { intendedUse } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(intendedUse.contractVersion, "perl-intended-use-charter/1.0");
  assert.equal(intendedUse.status, "definition-required-before-legal-review");
  assert.equal(intendedUse.audiences.length, 4);
  assert.equal(intendedUse.prohibitedUses.length, 8);
  assert.equal(intendedUse.requiredAcceptances.length, 5);
  assert.equal(intendedUse.counts.acceptancesRecorded, 0);
  assert.equal(intendedUse.legalApproved, false);
  assert.equal(intendedUse.pilotAuthorized, false);

  const response = await fetch(`${base}/api/governance/intended-use/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "INTENDED-USE-API-QA" },
    body: JSON.stringify({
      pilotContext: "point-of-care-review",
      scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review at the start of a care conversation. The summary remains an additional page beside the unchanged Findings report.",
      rationale: "This provider-first scope addresses the proposal's interpretation step while preserving e-QPASS score authority, accountable human review, and role-specific disclosure boundaries."
    })
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.type, "intended-use-draft-recorded");
  assert.equal(result.event.acceptancesRecorded, 0);
  assert.equal(result.event.legalApproved, false);
  assert.equal(result.event.intendedUseFrozen, false);
  assert.equal(result.draft.providerFirst, true);
  assert.equal(result.draft.humanReviewRequired, true);
  assert.equal(result.draft.patientUseAuthorized, false);
  assert.equal(result.intendedUse.status, "working-charter-recorded");
  assert.equal(result.intendedUse.chain.valid, true);

  const unsafe = await fetch(`${base}/api/governance/intended-use/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "INTENDED-USE-API-QA" },
    body: JSON.stringify({
      pilotContext: "point-of-care-review",
      scopeStatement: "PERL will diagnose and prescribe without human review. This deliberately unsafe statement is extended past the minimum input length and must still be rejected by the server contract.",
      rationale: "This deliberately unsafe rationale exists only to verify that the service fails closed before persistence."
    })
  });
  assert.equal(unsafe.status, 400);
  assert.match((await unsafe.json()).error, /cannot assert diagnosis/i);

  const exportResponse = await fetch(`${base}/api/governance/intended-use.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-intended-use-charter\.json/);
  assert.equal(exported.latestDraft.hash, result.draft.hash);
  assert.equal(exported.history.length, 1);
  assert.equal(exported.disclaimerApproved, false);
  assert.equal(exported.productionReleaseAuthorized, false);
});

test("Language Review API seals exact live copy while all acceptance authority stays external", async t => {
  const base = await withServer(t);
  let response = await fetch(`${base}/api/governance/language-review`);
  let { languageReview } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(languageReview.contractVersion, "perl-language-review-packet/1.0");
  assert.equal(languageReview.status, "intended-use-required");
  assert.equal(languageReview.surfaces.length, 9);
  assert.equal(languageReview.reviewQuestions.length, 6);
  assert.equal(languageReview.requiredAcceptances.length, 5);
  assert.equal(languageReview.counts.acceptancesRecorded, 0);

  response = await fetch(`${base}/api/governance/language-review/seal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "LANGUAGE-API-QA" },
    body: "{}"
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /record an intended-use working draft/i);

  await fetch(`${base}/api/governance/intended-use/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "LANGUAGE-API-QA" },
    body: JSON.stringify({
      pilotContext: "point-of-care-review",
      scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for accountable review at the start of a care conversation. The summary remains an additional page beside the unchanged Findings report.",
      rationale: "This provider-first scope preserves authoritative scores, accountable human judgment, deterministic safety routing, and audience-specific disclosure boundaries."
    })
  });

  response = await fetch(`${base}/api/governance/language-review/seal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "LANGUAGE-API-QA" },
    body: "{}"
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.type, "language-review-packet-sealed");
  assert.equal(result.event.copySurfaceCount, 9);
  assert.equal(result.event.acceptancesRecorded, 0);
  assert.equal(result.event.legalApproved, false);
  assert.equal(result.packet.surfaces.find(item => item.id === "clinical-disclaimer").currentText.includes("does not diagnose"), true);
  assert.equal(result.packet.languageFrozen, false);
  assert.equal(result.languageReview.status, "review-packet-sealed-unaccepted");
  assert.equal(result.languageReview.chain.valid, true);

  response = await fetch(`${base}/api/governance/language-review.json`);
  languageReview = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /perl-language-review-packet\.json/);
  assert.equal(languageReview.latestPacket.hash, result.packet.hash);
  assert.equal(languageReview.counts.acceptancesRecorded, 0);
  assert.equal(languageReview.productionReleaseAuthorized, false);
  assert.equal(languageReview.patientUseAuthorized, false);

  response = await fetch(`${base}/api/governance/language-review.html`);
  const reviewBook = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /PERL-clinical-counsel-language-review\.html/);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(reviewBook, /<h1 id="packet-title">The words<br>before they travel\.<\/h1>/);
  assert.equal((reviewBook.match(/class="copy-clause"/g) || []).length, 9);
  assert.equal((reviewBook.match(/class="review-question"/g) || []).length, 6);
  assert.equal((reviewBook.match(/class="acceptance-row"/g) || []).length, 5);
  assert.match(reviewBook, /Sealed working packet · unaccepted/);
  assert.match(reviewBook, /language-review\.css/);
  assert.match(reviewBook, /language-review-print\.js/);
});

test("counselor notebook API records enum-only rehearsal notes without session or clinical authority", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/calibration/counselor-notebook`);
  const { counselorNotebook } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(counselorNotebook.contractVersion, "perl-counselor-session-notebook/1.0");
  assert.equal(counselorNotebook.sessions.length, 3);
  assert.equal(counselorNotebook.sessions.flatMap(session => session.decisions).length, 15);
  assert.equal(counselorNotebook.metrics.notesRecorded, 0);
  assert.equal(counselorNotebook.attendanceRecorded, false);

  const response = await fetch(`${base}/api/calibration/counselor-notebook/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "NOTEBOOK-API-QA" },
    body: JSON.stringify({
      sessionId: "usefulness-workflow",
      decisionId: "next-conversation-utility",
      disposition: "defer-awaiting-evidence",
      finding: "needs-more-evidence",
      evidenceSource: "blind-outcome-ledger",
      assessmentId: "FF-TEST-2411-C"
    })
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.entry.type, "counselor-session-rehearsal-note-recorded");
  assert.equal(result.entry.counselorIdentityVerified, false);
  assert.equal(result.entry.clinicalDecisionAccepted, false);
  assert.equal(result.entry.protocolFrozen, false);
  assert.equal(result.counselorNotebook.metrics.notesRecorded, 1);
  assert.equal(result.counselorNotebook.chain.valid, true);

  const invalidResponse = await fetch(`${base}/api/calibration/counselor-notebook/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "usefulness-workflow",
      decisionId: "indicator-language",
      disposition: "carry-forward-for-rehearsal",
      finding: "source-supported",
      evidenceSource: "synthetic-regression",
      assessmentId: null
    })
  });
  assert.equal(invalidResponse.status, 400);

  const exportResponse = await fetch(`${base}/api/calibration/counselor-notebook.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-counselor-session-notebook\.json/);
  assert.equal(exported.history[0].hash, result.entry.hash);
  assert.equal(exported.trainingCompleted, false);
  assert.equal(exported.clinicalValidation, false);
});

test("source-only reference API withholds the holdout and records one immutable unaccepted draft", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "REFERENCE-API-QA" };
  const statusResponse = await fetch(`${base}/api/calibration/reference-room`, { headers });
  const { referenceRoom } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(referenceRoom.contractVersion, "perl-counselor-reference-draft/1.0");
  assert.equal(referenceRoom.cases.length, 2);
  assert.equal(referenceRoom.cases.some(item => item.partition === "holdout"), false);
  assert.ok(referenceRoom.cases.every(item => item.sourceProfile.generatedContentIncluded === false));
  assert.equal(referenceRoom.metrics.acceptedReferences, 0);

  const selected = referenceRoom.cases.find(item => item.assessmentId === "FF-TEST-2407-A");
  const payload = {
    assessmentId: selected.assessmentId,
    sourceProfileHash: selected.sourceProfileHash,
    authoringMode: "source-only",
    summary: "Self-report scores show mild depression and anxiety indicators with minimal global distress. Clarify timing, function, context, and the non-zero critical screen directly before care-planning use.",
    themes: [{
      title: "Cognitive tension with contained overall burden",
      body: "Apprehension and negative cognition are more prominent than the other scored constructs, while the global index remains minimal. Clarify whether the pattern is situational or persistent.",
      confidence: "Moderate",
      evidence: ["Apprehension · 9", "Negative cognition · 7", "Global index · 55"],
      uncertainty: "The scored profile does not establish duration, cause, functional impact, or persistence outside this assessment context."
    }],
    questions: [
      "Which situations most reliably activate worry or self-critical thinking?",
      "What does the person understand the non-zero critical-screen response to mean?"
    ],
    toneMarkers: ["indicator-language", "explicit-uncertainty", "plain-clinical-language", "critical-route-visible"],
    criticalReviewDisposition: "requires-direct-review"
  };
  const response = await fetch(`${base}/api/calibration/reference-room/drafts`, { method: "POST", headers, body: JSON.stringify(payload) });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.draft.sourceSurfaceIncludesGeneratedContent, false);
  assert.equal(result.draft.authorshipIndependenceEstablished, false);
  assert.equal(result.draft.referenceAccepted, false);
  assert.equal(result.draft.protocolFrozen, false);
  assert.equal(result.referenceRoom.metrics.localDrafts, 1);
  assert.equal(result.referenceRoom.currentReviewerHistory.length, 1);
  assert.equal(result.referenceRoom.chain.valid, true);

  const duplicate = await fetch(`${base}/api/calibration/reference-room/drafts`, { method: "POST", headers, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 409);
  const holdout = await fetch(`${base}/api/calibration/reference-room/drafts`, { method: "POST", headers, body: JSON.stringify({ ...payload, assessmentId: "FF-TEST-2411-C", sourceProfileHash: "a".repeat(64) }) });
  assert.equal(holdout.status, 409);
  assert.match((await holdout.json()).error, /holdout remains unopened/i);

  const exportResponse = await fetch(`${base}/api/calibration/reference-room.json`, { headers });
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-source-only-reference-room\.json/);
  assert.equal(exported.currentReviewerHistory.length, 1);
  assert.equal(exported.referencesAccepted, false);
  assert.equal(exported.clinicalValidation, false);
});

test("reference adjudication API compares only post-authoring candidates and seals no decision", async t => {
  const base = await withServer(t);
  const reviewerOne = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ADJUDICATION-API-01" };
  const reviewerTwo = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ADJUDICATION-API-02" };
  const outsider = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ADJUDICATION-API-03" };
  const { referenceRoom } = await fetch(`${base}/api/calibration/reference-room`, { headers: reviewerOne }).then(response => response.json());
  const selected = referenceRoom.cases.find(item => item.assessmentId === "FF-TEST-2407-A");
  const draft = variant => ({
    assessmentId: selected.assessmentId,
    sourceProfileHash: selected.sourceProfileHash,
    authoringMode: "source-only",
    summary: variant === 1
      ? "Self-report scores show mild depression and anxiety indicators with minimal global distress. Clarify timing, function, context, and the non-zero critical screen directly before care-planning use."
      : "The scored pattern suggests contained overall distress with stronger apprehension and negative cognition indicators. Direct review should clarify the critical response, duration, context, and impact.",
    themes: [{
      title: variant === 1 ? "Cognitive tension with contained burden" : "Apprehension warrants context",
      body: "Apprehension and negative cognition are more prominent than the other scored constructs, while the global index remains minimal. Clarify whether the pattern is situational or persistent.",
      confidence: variant === 1 ? "Moderate" : "Low",
      evidence: variant === 1 ? ["Apprehension · 9", "Negative cognition · 7", "Global index · 55"] : ["Apprehension · 9", "Global index · 55"],
      uncertainty: "The scored profile does not establish duration, cause, functional impact, or persistence outside this assessment context."
    }],
    questions: variant === 1
      ? ["Which situations most reliably activate worry or self-critical thinking?", "What does the person understand the non-zero critical-screen response to mean?"]
      : ["When is apprehension most noticeable?", "How does the person explain the critical-screen response in their own words?"],
    toneMarkers: ["indicator-language", "explicit-uncertainty", "plain-clinical-language", "critical-route-visible"],
    criticalReviewDisposition: "requires-direct-review"
  });
  assert.equal((await fetch(`${base}/api/calibration/reference-room/drafts`, { method: "POST", headers: reviewerOne, body: JSON.stringify(draft(1)) })).status, 201);
  assert.equal((await fetch(`${base}/api/calibration/reference-room/drafts`, { method: "POST", headers: reviewerTwo, body: JSON.stringify(draft(2)) })).status, 201);

  const outsiderResponse = await fetch(`${base}/api/calibration/reference-adjudication`, { headers: outsider });
  const outsiderDossier = (await outsiderResponse.json()).adjudication;
  const outsiderCase = outsiderDossier.cases.find(item => item.assessmentId === selected.assessmentId);
  assert.equal(outsiderCase.locallyComparable, true);
  assert.equal(outsiderCase.candidateContentVisible, false);
  assert.ok(outsiderCase.candidates.every(candidate => candidate.summary === null && !Object.hasOwn(candidate, "actor")));

  const eligibleResponse = await fetch(`${base}/api/calibration/reference-adjudication`, { headers: reviewerOne });
  const eligible = (await eligibleResponse.json()).adjudication;
  const eligibleCase = eligible.cases.find(item => item.assessmentId === selected.assessmentId);
  assert.equal(eligibleCase.candidateContentVisible, true);
  assert.equal(eligibleCase.structuralSynthesis.majorityDecisionCreated, false);
  assert.equal(eligible.referenceAccepted, false);
  assert.equal(eligible.adjudicationCompleted, false);

  const sealedResponse = await fetch(`${base}/api/calibration/reference-adjudication/seal`, { method: "POST", headers: reviewerOne, body: "{}" });
  const sealed = await sealedResponse.json();
  assert.equal(sealedResponse.status, 201);
  assert.equal(sealed.created, true);
  assert.equal(sealed.snapshot.referenceAccepted, false);
  assert.equal(sealed.snapshot.adjudicationCompleted, false);
  const repeated = await fetch(`${base}/api/calibration/reference-adjudication/seal`, { method: "POST", headers: reviewerOne, body: "{}" });
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).created, false);

  const exportedResponse = await fetch(`${base}/api/calibration/reference-adjudication.json`, { headers: reviewerOne });
  const exported = await exportedResponse.json();
  assert.equal(exportedResponse.status, 200);
  assert.match(exportedResponse.headers.get("content-disposition"), /perl-counselor-reference-adjudication-dossier\.json/);
  assert.equal(exported.history.length, 1);
  assert.equal(exported.patientUseAuthorized, false);
});

test("reference decision API defaults closed and exposes only governed external-return seams", async t => {
  const base = await withServer(t);
  const response = await fetch(`${base}/api/calibration/reference-decision`);
  const { referenceDecision } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(referenceDecision.contractVersion, "perl-counselor-reference-decision-docket/1.0");
  assert.equal(referenceDecision.status, "sealed-adjudication-required");
  assert.equal(referenceDecision.registry.externallyProvisioned, false);
  assert.equal(referenceDecision.registryWriteApiAvailable, false);
  assert.equal(referenceDecision.signingApiAvailable, false);
  assert.equal(referenceDecision.referenceSetAccepted, false);
  assert.equal(referenceDecision.protocolFrozen, false);
  assert.equal(referenceDecision.clinicalValidation, false);
  assert.equal(referenceDecision.patientUseAuthorized, false);

  const challenge = await fetch(`${base}/api/calibration/reference-decision/challenges`, { method: "POST", headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "REFERENCE-API-QA" }, body: "{}" });
  assert.equal(challenge.status, 409);
  assert.match((await challenge.json()).error, /four current, distinct/i);

  const registryResponse = await fetch(`${base}/api/calibration/reference-decision/registry-template.json`);
  const registry = await registryResponse.json();
  assert.equal(registryResponse.status, 200);
  assert.match(registryResponse.headers.get("content-disposition"), /counselor-reference-decision-registry-template\.json/i);
  assert.equal(registry.keys.length, 4);
  assert.equal(new Set(registry.keys.map(key => key.purpose)).size, 4);

  const exportResponse = await fetch(`${base}/api/calibration/reference-decision.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /counselor-reference-decision-docket\.json/i);
  assert.equal(exported.counts.verifiedExternalDuties, 0);
});

test("Progress Review API serves exact raw deltas and records only structured non-authorizing observations", async t => {
  const base = await withServer(t);
  const statusResponse = await fetch(`${base}/api/progress`);
  const { progressReview } = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(progressReview.contractVersion, "perl-synthetic-progress-review/1.0");
  assert.equal(progressReview.series.id, "FF-TEST-SERIES-01");
  assert.deepEqual(progressReview.scales.map(scale => scale.delta), [-39, -15, -12, -73]);
  assert.equal(progressReview.metrics.observationsRecorded, 0);
  assert.equal(progressReview.authoritativeSubjectLinkage, false);
  assert.equal(progressReview.improvementEstablished, false);
  assert.equal(progressReview.brief.contractVersion, "perl-synthetic-progress-conversation-brief/1.0");
  assert.match(progressReview.brief.summary, /not evidence of improvement, deterioration, or treatment response/i);
  assert.equal(progressReview.brief.conversationPriorities.length, 4);
  assert.equal(progressReview.brief.generator.externalTransmission, false);
  assert.equal(progressReview.brief.clinicalRecommendationCreated, false);

  const response = await fetch(`${base}/api/progress/observations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "PROGRESS-API-QA" },
    body: JSON.stringify({
      seriesId: "FF-TEST-SERIES-01",
      focus: "global-distress",
      finding: "raw-score-lower",
      disposition: "clarify-context-before-interpretation"
    })
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.event.type, "synthetic-progress-rehearsal-observation-recorded");
  assert.equal(result.event.clinicalProgressEstablished, false);
  assert.equal(result.event.improvementEstablished, false);
  assert.equal(result.event.treatmentResponseEstablished, false);
  assert.equal(result.progressReview.metrics.observationsRecorded, 1);
  assert.equal(result.progressReview.chain.valid, true);

  const invalid = await fetch(`${base}/api/progress/observations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesId: "FF-TEST-SERIES-01",
      focus: "global-distress",
      finding: "clinically-improved",
      disposition: "clarify-context-before-interpretation",
      narrative: "The patient improved."
    })
  });
  assert.equal(invalid.status, 400);

  const exportResponse = await fetch(`${base}/api/progress.json`);
  const exported = await exportResponse.json();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /perl-synthetic-progress-review\.json/);
  assert.equal(exported.history[0].hash, result.event.hash);
  assert.equal(exported.meaningfulChangeEstablished, false);
  assert.equal(exported.patientUseAuthorized, false);

  const reportResponse = await fetch(`${base}/api/progress/report.html`);
  const reportHtml = await reportResponse.text();
  assert.equal(reportResponse.status, 200);
  assert.match(reportResponse.headers.get("content-disposition"), /PERL-synthetic-progress-conversation-brief\.html/);
  assert.match(reportHtml, /Let the person’s account explain the line/);
  assert.match(reportHtml, /Lower does not mean better/);
  assert.equal((reportHtml.match(/class="movement-row"/g) || []).length, 4);
  assert.equal((reportHtml.match(/class="priority"/g) || []).length, 4);
  assert.match(reportHtml, /not a progress note · not for live clinical use/i);
});

test("API refuses unsafe approval, then persists the acknowledged decision", async t => {
  const base = await withServer(t);
  let result = await json(await fetch(`${base}/api/assessments/FF-TEST-2407-A/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /safety hold/i);

  result = await json(await fetch(`${base}/api/assessments/FF-TEST-2407-A/safety-ack`, { method: "POST", headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "API tester" }, body: JSON.stringify({ acknowledged: true }) }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.review.safetyAcknowledged, true);

  result = await json(await fetch(`${base}/api/assessments/FF-TEST-2407-A/approve`, { method: "POST", headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "API tester" }, body: "{}" }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.review.status, "approved");

  const detail = await fetch(`${base}/api/assessments/FF-TEST-2407-A`).then(response => response.json());
  assert.equal(detail.review.status, "approved");
  assert.ok(detail.audit.some(entry => entry.action === "Draft approved"));
});

test("API rejects a fixture that could contain a production identifier", async t => {
  const base = await withServer(t);
  const example = await fetch(`${base}/examples/synthetic-assessment.json`).then(response => response.json());
  example.id = "000076";
  const result = await json(await fetch(`${base}/api/assessments/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessment: example }) }));
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /non-identifying record ID/);
});

test("automation atelier starts a unique synthetic Findings-to-summary run and pauses for clinician review", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "AUTOMATION-QA" };
  let observatory = await fetch(`${base}/api/integration/rehearsal`).then(response => response.json());
  assert.equal(observatory.contractVersion, "perl-findings-summary-integration-rehearsal/1.0");
  assert.equal(observatory.counts.runs, 0);
  assert.equal(observatory.providerPreflight.status, "deterministic-baseline");

  const started = await json(await fetch(`${base}/api/integration/rehearsal/runs`, { method: "POST", headers, body: "{}" }));
  assert.equal(started.response.status, 201);
  assert.equal(started.body.started, true);
  assert.match(started.body.assessmentId, /^FF-TEST-AUTOMATION-[A-F0-9]{16}$/);
  assert.equal(started.body.rehearsal.counts.runs, 1);
  assert.equal(started.body.rehearsal.counts.awaitingClinician, 1);
  assert.equal(started.body.rehearsal.runs[0].status, "awaiting-clinician-review");
  assert.ok(Number.isFinite(Date.parse(started.body.rehearsal.runs[0].startedAt)));
  assert.ok(Number.isFinite(Date.parse(started.body.rehearsal.runs[0].stages[0].at)));
  assert.deepEqual(started.body.rehearsal.runs[0].stages.slice(0, 3).map(item => item.status), ["verified", "verified", "waiting"]);
  assert.equal(started.body.rehearsal.runs[0].candidateBinding.status, "deterministic-baseline");
  assert.equal(started.body.rehearsal.remoteWriteClaimed, false);

  const second = await json(await fetch(`${base}/api/integration/rehearsal/runs`, { method: "POST", headers, body: "{}" }));
  assert.equal(second.response.status, 201);
  assert.notEqual(second.body.assessmentId, started.body.assessmentId);
  observatory = await fetch(`${base}/api/integration/rehearsal`).then(response => response.json());
  assert.equal(observatory.counts.runs, 2);
  assert.equal(observatory.integrity.valid, true);
});

test("practice studio persists display-only clinician context and returns aggregate demographic lenses", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "STUDIO-QA" };
  let result = await json(await fetch(`${base}/api/workspace/experience`, { headers }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.workspace.profile.clinicianRole, "licensed-clinician");
  assert.equal(result.body.workspace.display.safetyCanBeHidden, false);
  assert.equal(result.body.workspace.demographics.totalSyntheticRecords, 42);
  assert.equal(result.body.workspace.demographics.personLevelRecordsAvailable, false);

  const profile = {
    ...result.body.workspace.profile,
    defaultMode: "studio",
    clinicianRole: "clinical-supervisor",
    careSetting: "community-behavioral-health",
    reviewFocus: "evidence-first",
    density: "compact",
    visibleModules: ["metadata", "evidence", "patterns", "quality", "lineage"],
    demographicDimension: "first-generation"
  };
  result = await json(await fetch(`${base}/api/workspace/experience`, { method: "PUT", headers, body: JSON.stringify({ profile }) }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(result.body.workspace.profile.clinicianRole, "clinical-supervisor");
  assert.equal(result.body.workspace.profile.demographicDimension, "first-generation");
  assert.equal(result.body.workspace.context.roleContextGrantsAuthorization, false);
  assert.equal(result.body.workspace.chain.valid, true);

  const isolated = await fetch(`${base}/api/workspace/experience`, { headers: { "X-PERL-Demo-Actor": "OTHER-QA" } }).then(response => response.json());
  assert.equal(isolated.profile?.clinicianRole, undefined);
  assert.equal(isolated.workspace.profile.clinicianRole, "licensed-clinician");
  assert.equal(isolated.workspace.saved, false);

  result = await json(await fetch(`${base}/api/workspace/experience`, { method: "PUT", headers, body: JSON.stringify({ profile: { ...profile, grantsApproval: true } }) }));
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /contain exactly/i);
});

test("synthetic e-QPASS event rehearsal is idempotent, private, and fail-closed", async t => {
  const base = await withServer(t);
  const event = await fetch(`${base}/examples/synthetic-eqpass-scored-event.json`).then(response => response.json());
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "INTEGRATION-QA" };

  let result = await json(await fetch(`${base}/api/integration/eqpass/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event })
  }));
  assert.equal(result.response.status, 201);
  assert.equal(result.body.status, "imported");
  assert.equal(result.body.authoritativeContract, false);
  assert.equal(result.body.receipt.contractStatus, "proposed-rfi-only");
  assert.equal(result.body.receipt.scoringVersion, event.sourceAssessment.scoringVersion);
  assert.equal(result.body.assessment.assessment.scaleLevels.gpi, "mild");
  assert.equal(result.body.assessment.review.status, "priority");
  assert.equal(result.body.assessment.reportArtifact, null);

  const receiptText = JSON.stringify(result.body.receipt);
  for (const privateValue of [
    event.eventId,
    event.trace.idempotencyKey,
    event.sourceAssessment.subjectRef,
    event.findingsReport.reportRef
  ]) assert.equal(receiptText.includes(privateValue), false);

  result = await json(await fetch(`${base}/api/integration/eqpass/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event })
  }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.status, "duplicate");

  const events = await fetch(`${base}/api/integration/eqpass/events`).then(response => response.json());
  assert.equal(events.authoritativeContract, false);
  assert.equal(events.modelProjection, "scoring-only");
  assert.equal(events.events.length, 1);
  assert.equal(events.chain.valid, true);

  const conflict = structuredClone(event);
  conflict.scoring.scales.gpi.score += 1;
  result = await json(await fetch(`${base}/api/integration/eqpass/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: conflict })
  }));
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /reused with different source content/i);

  const rescore = structuredClone(event);
  rescore.eventType = "assessment.rescored";
  rescore.eventId = "FF-TEST-EVENT-EQ-002";
  rescore.trace.idempotencyKey = "FF-TEST-IDEMPOTENCY-EQ-002";
  result = await json(await fetch(`${base}/api/integration/eqpass/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: rescore })
  }));
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /supersession/i);
});

test("approved source-event report automatically prepares one private idempotent attachment handoff", async t => {
  const base = await withServer(t);
  const event = await fetch(`${base}/examples/synthetic-eqpass-scored-event.json`).then(response => response.json());
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ATTACHMENT-QA" };
  await fetch(`${base}/api/integration/eqpass/events`, { method: "POST", headers, body: JSON.stringify({ event }) });
  const assessmentId = event.sourceAssessment.assessmentRef;
  await fetch(`${base}/api/assessments/${assessmentId}/safety-ack`, { method: "POST", headers, body: JSON.stringify({ acknowledged: true }) });
  await fetch(`${base}/api/assessments/${assessmentId}/approve`, { method: "POST", headers, body: "{}" });
  let detail = await fetch(`${base}/api/assessments/${assessmentId}`).then(response => response.json());
  assert.equal(detail.attachment.status, "prepared-not-attached");
  assert.equal(detail.workflow.status, "prepared-not-attached");
  assert.equal(detail.sourceEvent.scoringVersion, event.sourceAssessment.scoringVersion);

  const attachment = {
    contractVersion: "eqpass-perl-attachment/rfi-0.1",
    environment: "calibration",
    assessmentId,
    reportArtifactId: detail.reportArtifact.id,
    reportArtifactHash: detail.reportArtifact.hash,
    idempotencyKey: `FF-TEST-AUTO-HANDOFF-${detail.reportArtifact.hash.slice(0, 32).toUpperCase()}`
  };
  let result = await json(await fetch(`${base}/api/integration/eqpass/attachments`, { method: "POST", headers, body: JSON.stringify({ attachment }) }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.status, "duplicate");
  assert.equal(result.body.authoritativeContract, false);
  assert.equal(result.body.attachment.status, "prepared-not-attached");
  assert.equal(result.body.attachment.renderedMediaType, "text/html");
  assert.equal(result.body.attachment.renderedContentHash.length, 64);
  const serialized = JSON.stringify(result.body.attachment);
  for (const privateValue of [event.eventId, event.trace.idempotencyKey, event.sourceAssessment.subjectRef, event.findingsReport.reportRef]) {
    assert.equal(serialized.includes(privateValue), false);
  }

  result = await json(await fetch(`${base}/api/integration/eqpass/attachments`, { method: "POST", headers, body: JSON.stringify({ attachment }) }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.status, "duplicate");

  const conflict = { ...attachment, reportArtifactHash: "f".repeat(64) };
  result = await json(await fetch(`${base}/api/integration/eqpass/attachments`, { method: "POST", headers, body: JSON.stringify({ attachment: conflict }) }));
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /reused with different content/i);

  const listing = await fetch(`${base}/api/integration/eqpass/attachments`).then(response => response.json());
  assert.equal(listing.events.length, 1);
  assert.equal(listing.chain.valid, true);
  assert.match(listing.boundary, /does not write to e-QPASS/i);
  const workflow = await fetch(`${base}/api/integration/workflow`).then(response => response.json());
  assert.equal(workflow.mode, "automatic-preparation-rehearsal");
  assert.equal(workflow.counts.sourceEvents, 1);
  assert.equal(workflow.counts.prepared, 1);
  assert.equal(workflow.counts.failed, 0);
  assert.equal(workflow.chain.valid, true);
  assert.match(workflow.boundary, /does not attach a file/i);
  const outbox = await fetch(`${base}/api/integration/delivery`).then(response => response.json());
  assert.equal(outbox.connector.enabled, false);
  assert.equal(outbox.connector.externalTransmission, false);
  assert.equal(outbox.counts.packages, 1);
  assert.equal(outbox.counts.awaitingConnector, 1);
  assert.equal(outbox.counts.receipts, 0);
  assert.equal(outbox.chain.valid, true);
  const blocked = await json(await fetch(`${base}/api/integration/delivery/${outbox.jobs[0].job.id}/process`, { method: "POST", headers, body: "{}" }));
  assert.equal(blocked.response.status, 409);
  assert.match(blocked.body.error, /connector is disabled/i);
  detail = await fetch(`${base}/api/assessments/${assessmentId}`).then(response => response.json());
  assert.equal(detail.attachment.status, "prepared-not-attached");

  const assemblyJsonResponse = await fetch(`${base}/api/assessments/${assessmentId}/report-package.json`);
  const assembly = await assemblyJsonResponse.json();
  assert.equal(assemblyJsonResponse.status, 200);
  assert.match(assemblyJsonResponse.headers.get("content-disposition"), /PERL-report-assembly-proof\.json/);
  assert.equal(assembly.contractVersion, "perl-report-assembly-proof/1.0");
  assert.equal(assembly.pageCount, 5);
  assert.equal(assembly.sourcePageCount, 4);
  assert.equal(assembly.perlPageCount, 1);
  assert.equal(assembly.source.findingsReportHash, event.findingsReport.sha256);
  assert.equal(assembly.perl.reportArtifactHash, detail.reportArtifact.hash);
  assert.equal(assembly.pdfMergePerformed, false);
  assert.equal(assembly.remoteAttachmentPerformed, false);
  assert.equal(assembly.patientUseAuthorized, false);

  const assemblyHtmlResponse = await fetch(`${base}/api/assessments/${assessmentId}/report-package.html`);
  const assemblyHtml = await assemblyHtmlResponse.text();
  assert.equal(assemblyHtmlResponse.status, 200);
  assert.match(assemblyHtmlResponse.headers.get("content-disposition"), /PERL-report-assembly-proof\.html/);
  assert.equal((assemblyHtml.match(/class="packet-page/g) || []).length, 5);
  assert.match(assemblyHtml, /Four source pages/);
  assert.match(assemblyHtml, /Page 05 \/ 05/);
  assert.match(assemblyHtml, /no PDF merge or e-QPASS attachment/i);
});

test("authorized delivery connector rehearses one durable outbox job through the API", async t => {
  let calls = 0;
  let seen;
  const deliveryConnector = createDeliveryConnector({
    connector: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-synthetic-api-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async request => {
      calls += 1;
      seen = request;
      return {
        contractVersion: DELIVERY_ACK_CONTRACT,
        requestId: request.requestId,
        jobId: request.jobId,
        idempotencyKey: request.idempotencyKey,
        environment: "calibration",
        status: "rehearsed-not-attached",
        remoteWriteClaimed: false,
        receiptId: "FF-TEST-ACK-API-001",
        receivedAt: "2026-08-13T20:00:00.000Z"
      };
    }
  });
  const base = await withServer(t, { deliveryConnector });
  const event = await fetch(`${base}/examples/synthetic-eqpass-scored-event.json`).then(response => response.json());
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "DELIVERY-API" };
  await fetch(`${base}/api/integration/eqpass/events`, { method: "POST", headers, body: JSON.stringify({ event }) });
  const assessmentId = event.sourceAssessment.assessmentRef;
  await fetch(`${base}/api/assessments/${assessmentId}/safety-ack`, { method: "POST", headers, body: JSON.stringify({ acknowledged: true }) });
  await fetch(`${base}/api/assessments/${assessmentId}/approve`, { method: "POST", headers, body: "{}" });
  let outbox = await fetch(`${base}/api/integration/delivery`).then(response => response.json());
  assert.equal(outbox.counts.ready, 1);
  assert.equal(outbox.connector.approvalScope, "synthetic-calibration-only");
  const jobId = outbox.jobs[0].job.id;
  const processed = await json(await fetch(`${base}/api/integration/delivery/${jobId}/process`, { method: "POST", headers, body: "{}" }));
  assert.equal(processed.response.status, 200);
  assert.equal(processed.body.status, "rehearsed-not-attached");
  assert.equal(processed.body.event.remoteWriteClaimed, false);
  assert.equal(calls, 1);
  assert.equal(seen.environment, "calibration");
  assert.equal(seen.content.includes("PERL clinician summary"), true);
  assert.equal(JSON.stringify(seen).includes(event.sourceAssessment.subjectRef), false);
  outbox = await fetch(`${base}/api/integration/delivery`).then(response => response.json());
  assert.equal(outbox.counts.receipts, 1);
  assert.equal(outbox.chain.valid, true);
});

test("blind calibration endpoint withholds authors and reveals them after submission", async t => {
  const base = await withServer(t);
  const issued = await fetch(`${base}/api/calibration/next`).then(response => response.json());
  const comparisonCase = issued.comparisonCase;
  assert.equal(comparisonCase.protocol, "blind-v3");
  assert.match(comparisonCase.caseSet.id, /^perl-synthetic-rehearsal-/);
  assert.ok(["development", "holdout"].includes(comparisonCase.partition));
  assert.ok(comparisonCase.strata.length > 0);
  assert.equal("mapping" in comparisonCase, false);
  assert.ok(comparisonCase.summaries.A.signals.length > 0);

  const result = await json(await fetch(`${base}/api/comparisons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, reviewTiming: { activeSeconds: 999, eligible: true } })
  }));
  assert.equal(result.response.status, 201);
  assert.ok(["human-reference", "perl-generated"].includes(result.body.reveal.preferredAuthor));
  assert.equal(result.body.comparison.protocol, "blind-v3");
  assert.deepEqual(result.body.comparison.ratings, pairedRatings);
  assert.equal(result.body.comparison.reviewTiming.measurement, "server-wall-clock-v1");
  assert.equal(typeof result.body.comparison.reviewTiming.activeSeconds, "number");
  assert.equal(result.body.comparison.reviewTiming.eligible, false);
  assert.equal(result.body.comparison.reviewTiming.flag, "below-protocol-floor");
  assert.notEqual(result.body.comparison.reviewTiming.activeSeconds, 999);
});

test("workflow timing API keeps unaided tasks draft-free and commits server-timed condition evidence", async t => {
  const base = await withServer(t);
  const headersA = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "TIMING-A" };
  const headersB = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "TIMING-B" };
  const taskA = (await fetch(`${base}/api/calibration/timing/next`, { headers: headersA }).then(response => response.json())).timingTask;
  const resumedA = (await fetch(`${base}/api/calibration/timing/next`, { headers: headersA }).then(response => response.json())).timingTask;
  const taskB = (await fetch(`${base}/api/calibration/timing/next`, { headers: headersB }).then(response => response.json())).timingTask;
  assert.equal(resumedA.taskId, taskA.taskId);
  assert.equal(taskA.assessmentId, taskB.assessmentId);
  assert.notEqual(taskA.condition, taskB.condition);
  assert.equal(taskA.sourceProfile.scales.length, 9);
  assert.ok(taskA.sourceProfile.subscales.length >= 8);
  assert.equal(taskA.condition === "unaided", taskA.initialDraft === null);
  assert.equal(taskB.condition === "unaided", taskB.initialDraft === null);
  assert.equal(JSON.stringify(taskA).includes("counselor-reference"), false);

  let result = await json(await fetch(`${base}/api/calibration/timing`, {
    method: "POST",
    headers: headersB,
    body: JSON.stringify({ taskId: taskA.taskId, finalSummary: taskA.initialDraft || "Self-report scores may indicate a pattern that requires direct clarification of duration, context, function, protective factors, and safety; this does not establish a diagnosis." })
  }));
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /different reviewer/i);

  const summaryFor = task => task.initialDraft || "Self-report scores may indicate a contained pattern that should be clarified through direct interview, history, functional impact, contextual stressors, protective factors, and routine safety verification; these indicators do not establish a diagnosis.";
  for (const [task, headers] of [[taskA, headersA], [taskB, headersB]]) {
    result = await json(await fetch(`${base}/api/calibration/timing`, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId: task.taskId, finalSummary: summaryFor(task), reviewTiming: { activeSeconds: 999, eligible: true } })
    }));
    assert.equal(result.response.status, 201);
    assert.equal(result.body.observation.reviewTiming.measurement, "server-wall-clock-v1");
    assert.equal(result.body.observation.reviewTiming.eligible, false);
    assert.notEqual(result.body.observation.reviewTiming.activeSeconds, 999);
    assert.equal(result.body.chain.valid, true);
  }

  const analysis = await fetch(`${base}/api/calibration/analysis`).then(response => response.json());
  assert.equal(analysis.analysis.workflowTiming.captured, 2);
  assert.equal(analysis.analysis.workflowTiming.ready, false);
  assert.equal(analysis.analysis.integrity.workflowTiming.count, 2);
  const exportResponse = await fetch(`${base}/api/calibration/timing/export.csv`);
  const csv = await exportResponse.text();
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /workflow-timing/);
  assert.match(csv, /"source_assessment_hash"/);
  assert.equal(csv.includes("pendingTimingTasks"), false);
});

test("API persists structured interpretation edits but rejects invented evidence", async t => {
  const base = await withServer(t);
  const detail = await fetch(`${base}/api/assessments/FF-TEST-2411-C`).then(response => response.json());
  const revised = structuredClone(detail.interpretation);
  revised.hypotheses[0].body = "The anxiety-related pattern may be distributed across worry, interpersonal concerns, and physiological arousal. Clarify duration, context, avoidance, and functional impact in interview.";
  let result = await json(await fetch(`${base}/api/assessments/FF-TEST-2411-C/interpretation`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "API clinician" },
    body: JSON.stringify({ interpretation: revised })
  }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.interpretation.source, "reviewer");

  revised.hypotheses[0].evidence = ["Invented · 99"];
  result = await json(await fetch(`${base}/api/assessments/FF-TEST-2411-C/interpretation`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interpretation: revised })
  }));
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /evidence not present/i);
});

test("calibration analysis and exports preserve the synthetic study boundary", async t => {
  const base = await withServer(t);
  const analysisResponse = await fetch(`${base}/api/calibration/analysis`);
  const { analysis } = await analysisResponse.json();
  assert.equal(analysisResponse.status, 200);
  assert.equal(analysis.status, "exploratory");
  assert.equal(analysis.clinicalValidation, false);
  assert.equal(analysis.thresholds.minimumComparisons, 60);
  assert.equal(analysis.thresholds.minimumTimedComparisons, 30);
  assert.equal(analysis.caseSet.holdoutValid, false);
  assert.equal(analysis.caseSet.cases, 3);
  assert.equal(analysis.releaseEvidence.engineeringRegressionPassed, true);
  assert.equal(analysis.releaseEvidence.outcomes.criticalScreenHandling.denominator, 1);
  assert.equal(analysis.releaseDecision.clinicalReleaseEligible, false);
  assert.equal(analysis.releaseDecision.status, "clinical-release-blocked");
  assert.equal(analysis.safety.exposure.eventsPer100CompletedComparisons, null);
  assert.equal(analysis.integrity.blindOutcomes.valid, true);
  assert.equal(analysis.integrity.feedback.valid, true);

  const intakeResponse = await fetch(`${base}/api/calibration/intake.json`);
  const intake = await intakeResponse.json();
  assert.equal(intakeResponse.status, 200);
  assert.match(intakeResponse.headers.get("content-disposition"), /perl-calibration-intake-map\.json/);
  assert.equal(intake.contractVersion, "perl-calibration-intake/1.0");
  assert.equal(intake.status, "source-data-not-received");
  assert.equal(intake.sourceReport.reportedAssessmentCount, 600);
  assert.equal(intake.currentSandbox.cases, 3);
  assert.equal(intake.currentSandbox.presentStrata, 3);
  assert.equal(intake.currentSandbox.targetStrata, 4);
  assert.equal(intake.currentSandbox.holdoutValid, false);
  assert.equal(intake.lanes.length, 5);
  assert.equal(intake.requiredReturns.length, 9);
  assert.equal(intake.recordsReceived, false);
  assert.equal(intake.phiApproved, false);
  assert.equal(intake.trainingDatasetCreated, false);
  assert.match(intake.packetFingerprint, /^[a-f0-9]{64}$/);

  const labResponse = await fetch(`${base}/api/calibration/counselor-lab.json`);
  const lab = await labResponse.json();
  assert.equal(labResponse.status, 200);
  assert.match(labResponse.headers.get("content-disposition"), /perl-counselor-lab-session-plan\.json/);
  assert.equal(lab.contractVersion, "perl-counselor-lab/1.0");
  assert.equal(lab.status, "awaiting-named-counselor-panel");
  assert.equal(lab.strategy.selectedSessionCount, 3);
  assert.equal(lab.sessions.length, 3);
  assert.equal(lab.preflightReturns.length, 8);
  assert.equal(lab.currentEvidence.sourceReportedCounselorsAvailable, true);
  assert.equal(lab.currentEvidence.namedCounselorsRegistered, 0);
  assert.equal(lab.currentEvidence.sessionsScheduled, 0);
  assert.equal(lab.currentEvidence.sessionsCompleted, 0);
  assert.equal(lab.currentEvidence.syntheticCases, 3);
  assert.equal(lab.currentEvidence.holdoutValid, false);
  assert.equal(lab.rosterAccepted, false);
  assert.equal(lab.trainingCompleted, false);
  assert.equal(lab.independentReviewComplete, false);
  assert.equal(lab.clinicalValidation, false);
  assert.equal(lab.patientUseAuthorized, false);
  assert.match(lab.packetFingerprint, /^[a-f0-9]{64}$/);

  const standardBefore = await fetch(`${base}/api/calibration/clinical-standard`).then(response => response.json());
  assert.equal(standardBefore.clinicalStandard.contractVersion, "perl-clinical-standard-draft/1.0");
  assert.equal(standardBefore.clinicalStandard.status, "definition-required-before-testing");
  assert.equal(standardBefore.clinicalStandard.history.length, 0);
  const standardResponse = await fetch(`${base}/api/calibration/clinical-standard/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "STANDARD-API-QA" },
    body: JSON.stringify({
      thresholds: { minimumBlindPreferenceRate: 65, minimumMedianAccuracy: 4.2, minimumMedianRestraint: 4.4, minimumMedianUtility: 4, maximumMaterialCorrectionsPer100: 8, minimumPreferenceAgreementAc1: 0.7, maximumMedianAssistedMinutes: 9.5 },
      rationale: "These working thresholds keep preference separate from fidelity, restraint, correction burden, agreement, workflow time, and zero-tolerance safety failures."
    })
  });
  const standardResult = await standardResponse.json();
  assert.equal(standardResponse.status, 201);
  assert.equal(standardResult.draft.preOutcomeCandidate, true);
  assert.equal(standardResult.clinicalStandard.latestDraft.version, 1);
  assert.equal(standardResult.clinicalStandard.chain.valid, true);
  assert.equal(standardResult.clinicalStandard.clinicalLeadApproved, false);
  assert.equal(standardResult.clinicalStandard.protocolFrozen, false);
  assert.equal(standardResult.clinicalStandard.patientUseAuthorized, false);
  const standardExportResponse = await fetch(`${base}/api/calibration/clinical-standard.json`);
  const standardExport = await standardExportResponse.json();
  assert.match(standardExportResponse.headers.get("content-disposition"), /perl-clinical-standard-drafts\.json/);
  assert.equal(standardExport.history.length, 1);
  assert.equal(standardExport.latestDraft.hash, standardResult.draft.hash);

  const refinementResponse = await fetch(`${base}/api/calibration/refinement`);
  const { refinement } = await refinementResponse.json();
  assert.equal(refinementResponse.status, 200);
  assert.equal(refinement.contract, "perl-refinement-brief/1.0");
  assert.equal(refinement.status, "awaiting-reviewer-evidence");
  assert.equal(refinement.integrity.sources.feedback.valid, true);
  assert.equal(refinement.clinicalValidation, false);

  const refinementExport = await fetch(`${base}/api/calibration/refinement.json`);
  assert.match(refinementExport.headers.get("content-disposition"), /perl-synthetic-refinement-brief\.json/);

  const packageResponse = await fetch(`${base}/api/calibration/export.json`);
  const studyPackage = await packageResponse.json();
  assert.match(packageResponse.headers.get("content-disposition"), /attachment/);
  assert.equal(studyPackage.manifest.population, "synthetic calibration sandbox");
  assert.equal(studyPackage.manifest.clinicalValidation, false);
  assert.equal(studyPackage.manifest.format, "perl-synthetic-calibration-package/2.49");
  assert.equal(studyPackage.manifest.candidateBlindReviewEventChain.valid, true);
  assert.equal(studyPackage.candidateBlindReview.counts.engineRankingsPublished, 0);
  assert.ok(Array.isArray(studyPackage.candidateBlindReviewEvents));
  assert.equal(studyPackage.manifest.candidateRefinementEventChain.valid, true);
  assert.equal(studyPackage.candidateRefinement.counts.engineRankingsPublished, 0);
  assert.equal(studyPackage.candidateRefinement.candidateOrderingPublished, false);
  assert.ok(Array.isArray(studyPackage.candidateRefinementEvents));
  assert.equal(studyPackage.manifest.candidateRetestReturnEventChain.valid, true);
  assert.equal(studyPackage.manifest.candidateRetestReviewEventChain.valid, true);
  assert.equal(studyPackage.candidateRetest.counts.improvementClaimsPublished, 0);
  assert.equal(studyPackage.candidateRetest.improvementEstablished, false);
  assert.ok(Array.isArray(studyPackage.candidateRetestReturnEvents));
  assert.ok(Array.isArray(studyPackage.candidateRetestReviewEvents));
  assert.equal(studyPackage.manifest.candidateRetestDispositionEventChain.valid, true);
  assert.equal(studyPackage.candidateRetestDisposition.independentResultFrozen, false);
  assert.equal(studyPackage.candidateRetestDisposition.generalizedAccuracyEstablished, false);
  assert.equal(studyPackage.candidateRetestDisposition.clinicalValidation, false);
  assert.ok(Array.isArray(studyPackage.candidateRetestDispositionEvents));
  assert.equal(studyPackage.manifest.candidateAdvancementEventChain.valid, true);
  assert.equal(studyPackage.candidateAdvancement.status, "independent-result-required");
  assert.equal(studyPackage.candidateAdvancement.candidateIdentity.disclosed, false);
  assert.equal(studyPackage.candidateAdvancement.productionReleaseAuthorized, false);
  assert.equal(studyPackage.candidateAdvancement.patientUseAuthorized, false);
  assert.ok(Array.isArray(studyPackage.candidateAdvancementEvents));
  assert.equal(studyPackage.manifest.counselorReferenceAdjudicationEventChain.valid, true);
  assert.equal(studyPackage.counselorReferenceAdjudication.referenceAccepted, false);
  assert.equal(studyPackage.manifest.counselorReferenceDecisionEventChain.valid, true);
  assert.equal(studyPackage.counselorReferenceDecision.protocolFrozen, false);
  assert.ok(Array.isArray(studyPackage.counselorReferenceDecisionEvents));
  assert.equal(studyPackage.manifest.counselorReferenceDraftChain.valid, true);
  assert.ok(Array.isArray(studyPackage.counselorReferenceDrafts));
  assert.equal(studyPackage.cases[0].clinicalBrief.format, "perl-clinical-brief/1.0");
  assert.equal(studyPackage.manifest.runtimeEnvelope.contractVersion, "perl-runtime-envelope/1.0");
  assert.equal(studyPackage.manifest.runtimeEnvelope.containerImageBuilt, false);
  assert.equal(studyPackage.manifest.runtimeEnvelope.patientUseAuthorized, false);
  assert.equal(studyPackage.manifest.modelTransport.credentialPersisted, false);
  assert.equal(studyPackage.manifest.modelTransport.credentialExposedByApi, false);
  assert.equal(studyPackage.manifest.releaseCandidate.contractVersion, RELEASE_CANDIDATE_CONTRACT);
  assert.equal(studyPackage.manifest.releaseCandidate.status, "not-built");
  assert.equal(studyPackage.manifest.releaseCandidate.productionSignatureVerified, false);
  assert.equal(studyPackage.manifest.releaseCandidate.azureDeploymentPerformed, false);
  assert.equal(studyPackage.manifest.releaseAdmission.contractVersion, RELEASE_ADMISSION_CONTRACT);
  assert.equal(studyPackage.manifest.releaseAdmission.status, "candidate-required");
  assert.equal(studyPackage.manifest.releaseAdmission.isolatedCiRun, false);
  assert.equal(studyPackage.manifest.releasePromotion.contractVersion, RELEASE_PROMOTION_CONTRACT);
  assert.equal(studyPackage.manifest.releasePromotion.status, "candidate-required");
  assert.equal(studyPackage.manifest.releasePromotion.externalEvidenceVerified, false);
  assert.equal(studyPackage.manifest.releasePromotion.deploymentAuthorized, false);
  assert.equal(studyPackage.manifest.generationEventChain.valid, true);
  assert.equal(studyPackage.generationRecords.length, 3);
  assert.equal(studyPackage.generationEvents.length, 3);
  assert.equal(studyPackage.manifest.deliveryEventChain.valid, true);
  assert.equal(studyPackage.manifest.recoveryEventChain.valid, true);
  assert.equal(studyPackage.manifest.rollbackEventChain.valid, true);
  assert.equal(studyPackage.manifest.monitoringEventChain.valid, true);
  assert.equal(studyPackage.manifest.progressReviewEventChain.valid, true);
  assert.equal(studyPackage.manifest.modelTrialEventChain.valid, true);
  assert.equal(studyPackage.manifest.candidateTrialEventChain.valid, true);
  assert.equal(studyPackage.manifest.pilotOperationsEventChain.valid, true);
  assert.equal(studyPackage.manifest.providerActivationEventChain.valid, true);
  assert.equal(studyPackage.manifest.siteAdmissionEventChain.valid, true);
  assert.equal(studyPackage.manifest.authorityTrustEventChain.valid, true);
  assert.equal(studyPackage.manifest.pilotStartEventChain.valid, true);
  assert.equal(studyPackage.manifest.clinicalReleaseEventChain.valid, true);
  assert.equal(studyPackage.modelTrial.engineSelected, false);
  assert.deepEqual(studyPackage.modelTrialEvents, []);
  assert.deepEqual(studyPackage.clinicalReleaseEvents, []);
  assert.equal(studyPackage.candidateTrial.runEnvelopes.length, 9);
  assert.equal(studyPackage.candidateTrial.trialExecutionAuthorized, false);
  assert.deepEqual(studyPackage.candidateTrialEvents, []);
  assert.equal(studyPackage.pilotStart.pilotStarted, false);
  assert.deepEqual(studyPackage.pilotStartEvents, []);
  assert.equal(studyPackage.pilotOperations.contractVersion, "perl-provider-pilot-operations-plan/1.0");
  assert.equal(studyPackage.pilotOperations.pilotAuthorized, false);
  assert.deepEqual(studyPackage.pilotOperationsEvents, []);
  assert.equal(studyPackage.providerActivation.contractVersion, "perl-provider-activation-workbook/1.0");
  assert.equal(studyPackage.providerActivation.activationAuthorized, false);
  assert.deepEqual(studyPackage.providerActivationEvents, []);
  assert.deepEqual(studyPackage.authorityTrustEvents, []);
  assert.equal(studyPackage.siteAdmission.contractVersion, "perl-named-site-admission-dossier/1.0");
  assert.equal(studyPackage.siteAdmission.authorizationRecorded, false);
  assert.deepEqual(studyPackage.siteAdmissionEvents, []);
  assert.equal(studyPackage.progressReview.authoritativeSubjectLinkage, false);
  assert.deepEqual(studyPackage.progressReviewEvents, []);
  assert.deepEqual(studyPackage.deliveryJobs, []);
  assert.deepEqual(studyPackage.deliveryEvents, []);
  assert.deepEqual(studyPackage.recoveryEvents, []);
  assert.deepEqual(studyPackage.rollbackEvents, []);
  assert.deepEqual(studyPackage.monitoringEvents, []);
  assert.deepEqual(studyPackage.responseDrillEvents, []);
  assert.equal(studyPackage.manifest.responseDrillEventChain.valid, true);
  assert.deepEqual(studyPackage.readinessEvents, []);
  assert.equal(studyPackage.manifest.readinessEventChain.valid, true);
  assert.equal(studyPackage.manifest.clinicalStandardEventChain.valid, true);
  assert.equal(studyPackage.manifest.independentReviewEventChain.valid, true);
  assert.equal(studyPackage.manifest.integrationReturnEventChain.valid, true);
  assert.equal(studyPackage.clinicalStandardDrafts.length, 1);
  assert.equal(studyPackage.clinicalStandardEvents.length, 1);
  assert.equal(studyPackage.clinicalStandard.latestDraft.version, 1);
  assert.deepEqual(studyPackage.independentReviewEvents, []);
  assert.deepEqual(studyPackage.integrationReturnEvents, []);
  assert.equal(studyPackage.integrationReturn.authoritativeContractAccepted, false);
  assert.equal(studyPackage.independentReview.independentReviewComplete, false);
  assert.equal(studyPackage.manifest.caseSet.holdoutValid, false);
  assert.equal(studyPackage.caseSetManifest.status, "frozen-engineering-rehearsal");
  assert.equal(studyPackage.integrity.packageHash.length, 64);
  assert.equal(studyPackage.manifest.comparisonChain.valid, true);
  assert.equal(studyPackage.manifest.reportArtifactChain.valid, true);
  assert.equal(studyPackage.manifest.changeEventChain.valid, true);
  assert.equal(studyPackage.manifest.feedbackEventChain.valid, true);
  assert.equal(studyPackage.manifest.sourceEventChain.valid, true);
  assert.equal(studyPackage.manifest.workflowTimingEventChain.valid, true);
  assert.ok(studyPackage.reportArtifacts.length >= 1);
  assert.equal(studyPackage.refinementBrief.contract, "perl-refinement-brief/1.0");
  assert.equal("pendingComparisons" in studyPackage, false);
  assert.equal("pendingTimingTasks" in studyPackage, false);

  const manifestResponse = await fetch(`${base}/api/calibration/manifest`);
  const caseSet = await manifestResponse.json();
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-disposition"), /case-set-manifest/);
  assert.equal(caseSet.manifest.holdoutValid, false);
  assert.equal(caseSet.integrity.manifestHash.length, 64);

  const csvResponse = await fetch(`${base}/api/calibration/export.csv`);
  const csv = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get("content-type"), /text\/csv/);
  assert.match(csvResponse.headers.get("content-disposition"), /perl-synthetic-blind-comparisons\.csv/);
  assert.match(csv, /"case_id"/);
});

test("dedicated clinician report route distinguishes review drafts from approved artifacts", async t => {
  const base = await withServer(t);
  const draft = await fetch(`${base}/api/assessments/FF-TEST-2407-A/report.html`);
  const draftHtml = await draft.text();
  assert.equal(draft.status, 200);
  assert.match(draft.headers.get("content-type"), /text\/html/);
  assert.match(draft.headers.get("content-disposition"), /FF-TEST-2407-A-PERL-clinician-summary/);
  assert.match(draftHtml, /Review draft/);
  assert.match(draftHtml, /Clinical review required/);
  assert.match(draftHtml, /not for live clinical use/i);
  assert.match(draftHtml, /ff-clinical-disclaimer\/draft-2026-08/);
  assert.match(draftHtml, /Prompt deterministic-rules\/cal-0\.9\.3/);
  assert.match(draftHtml, /Policy [a-f0-9]{12}/);

  const escapedNarrative = "Self-report results may indicate worry &amp; strain that should be clarified in interview. A literal <strong> tag must remain text, and this does not establish a diagnosis.";
  const revised = await fetch(`${base}/api/assessments/FF-TEST-2411-C/narratives/clinician`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "REPORT-QA" },
    body: JSON.stringify({ text: escapedNarrative })
  });
  assert.equal(revised.status, 200);
  const escapedHtml = await fetch(`${base}/api/assessments/FF-TEST-2411-C/report.html`).then(response => response.text());
  assert.match(escapedHtml, /worry &amp;amp; strain/);
  assert.match(escapedHtml, /literal &lt;strong&gt; tag/);
  assert.doesNotMatch(escapedHtml, /literal <strong> tag/);

  const approved = await fetch(`${base}/api/assessments/FF-TEST-2388-B/report.html`);
  const approvedHtml = await approved.text();
  assert.equal(approved.status, 200);
  assert.match(approvedHtml, /Approved synthetic clinician attachment/);
  assert.doesNotMatch(approvedHtml, /class="draft-watermark"/);
  assert.match(approvedHtml, /Source [a-f0-9]{12}/);
  assert.equal(approved.headers.get("x-frame-options"), "DENY");
});

test("role-specific handoff routes minimize administrative content and preserve clinician approval", async t => {
  const base = await withServer(t);
  const approvedBefore = await fetch(`${base}/api/assessments/FF-TEST-2388-B`).then(response => response.json());
  assert.equal(approvedBefore.review.status, "approved");
  const artifactId = approvedBefore.reportArtifact.id;

  const admin = await fetch(`${base}/api/assessments/FF-TEST-2388-B/handoff/admin.html`);
  const adminHtml = await admin.text();
  assert.equal(admin.status, 200);
  assert.match(admin.headers.get("content-disposition"), /PERL-admin-handoff/);
  assert.match(adminHtml, /Administrative routing note/);
  assert.match(adminHtml, /Minimum necessary context/);
  assert.match(adminHtml, /Not an approved clinician artifact/);
  assert.doesNotMatch(adminHtml, /Depression|Anxiety|Anger|Evidence-linked hypotheses/);

  const careHtml = await fetch(`${base}/api/assessments/FF-TEST-2388-B/handoff/care.html`).then(response => response.text());
  assert.match(careHtml, /Care coordination handoff/);
  assert.match(careHtml, /Prepare the next team conversation/);

  const payerHtml = await fetch(`${base}/api/assessments/FF-TEST-2388-B/handoff/payer.html`).then(response => response.text());
  assert.match(payerHtml, /Utilization context/);
  assert.match(payerHtml, /does not establish diagnosis, medical necessity, authorization/i);

  const invalid = await fetch(`${base}/api/assessments/FF-TEST-2388-B/handoff/clinician.html`);
  assert.equal(invalid.status, 400);

  const adminText = "The self-report assessment is complete with all 105 required responses recorded. No deterministic critical-screen hold is present; routine clinician review is still required before release. A literal <strong> tag must remain text, and this administrative routing note does not establish a diagnosis.";
  const revised = await fetch(`${base}/api/assessments/FF-TEST-2388-B/narratives/admin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "ADMIN-QA" },
    body: JSON.stringify({ text: adminText })
  });
  assert.equal(revised.status, 200);
  const revisedHtml = await fetch(`${base}/api/assessments/FF-TEST-2388-B/handoff/admin.html`).then(response => response.text());
  assert.match(revisedHtml, /literal &lt;strong&gt; tag/);
  assert.doesNotMatch(revisedHtml, /literal <strong> tag/);

  const approvedAfter = await fetch(`${base}/api/assessments/FF-TEST-2388-B`).then(response => response.json());
  assert.equal(approvedAfter.review.status, "approved");
  assert.equal(approvedAfter.reportArtifact.id, artifactId);
});

test("change-control API records proposal, replay, and bounded disposition", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "GOVERNANCE-API" };
  const proposed = await json(await fetch(`${base}/api/changes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      component: "report-template",
      baselineVersion: "workspace-print/0.1",
      reason: "Exercise the dedicated clinician attachment through the frozen synthetic regression set."
    })
  }));
  assert.equal(proposed.response.status, 201);
  assert.equal(proposed.body.status, "proposed");
  assert.equal(proposed.body.candidateVersion, "perl-clinician-report/1.0");

  const replayed = await json(await fetch(`${base}/api/changes/${proposed.body.id}/replay`, { method: "POST", headers, body: "{}" }));
  assert.equal(replayed.response.status, 200);
  assert.equal(replayed.body.event.engineeringRegressionPassed, true);
  assert.equal(replayed.body.event.clinicalValidation, false);
  assert.equal(replayed.body.chain.valid, true);

  const decided = await json(await fetch(`${base}/api/changes/${proposed.body.id}/disposition`, {
    method: "POST",
    headers,
    body: JSON.stringify({ disposition: "advance-for-clinical-review", note: "Replay passed. Route this candidate to independent counselor and legal review." })
  }));
  assert.equal(decided.response.status, 200);
  assert.equal(decided.body.candidate.status, "advance-for-clinical-review");
  assert.equal(decided.body.event.clinicalReleaseAuthorized, false);

  const listing = await fetch(`${base}/api/changes`, { headers }).then(response => response.json());
  assert.equal(listing.candidates.length, 1);
  assert.equal(listing.chain.count, 3);
  assert.match(listing.boundary, /cannot authorize live clinical release/i);
});

test("API attributes study actions to a bounded reviewer code", async t => {
  const base = await withServer(t);
  const reviewerHeaders = { "X-PERL-Demo-Actor": "COUNSELOR-02" };
  const issued = await fetch(`${base}/api/calibration/next`, { headers: reviewerHeaders }).then(response => response.json());
  const resumed = await fetch(`${base}/api/calibration/next`, { headers: reviewerHeaders }).then(response => response.json());
  assert.equal(resumed.comparisonCase.caseId, issued.comparisonCase.caseId);
  const result = await json(await fetch(`${base}/api/comparisons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "COUNSELOR-02" },
    body: JSON.stringify({ caseId: issued.comparisonCase.caseId, preferred: "B", ratings: pairedRatings })
  }));
  assert.equal(result.response.status, 201);
  assert.equal(result.body.comparison.actor, "COUNSELOR-02");

  const analysis = await fetch(`${base}/api/calibration/analysis`).then(response => response.json());
  assert.equal(analysis.analysis.sample.reviewers, 1);

  const rejected = await json(await fetch(`${base}/api/assessments/FF-TEST-2411-C/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "<script>" },
    body: JSON.stringify({ reasons: ["tone"] })
  }));
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.body.error, /reviewer code/i);
});

test("API safety incidents enforce and release the study stopping rule", async t => {
  const base = await withServer(t);
  const headers = { "Content-Type": "application/json", "X-PERL-Demo-Actor": "SAFETY-01" };
  const issued = await fetch(`${base}/api/calibration/next`, { headers }).then(response => response.json());
  const reported = await json(await fetch(`${base}/api/incidents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assessmentId: issued.comparisonCase.assessmentId,
      caseId: issued.comparisonCase.caseId,
      category: "invented-evidence",
      severity: "critical",
      summary: "The synthetic output contained evidence not present in the scored payload."
    })
  }));
  assert.equal(reported.response.status, 201);
  assert.equal(reported.body.control.state, "paused");

  const blocked = await json(await fetch(`${base}/api/comparisons`, {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: issued.comparisonCase.caseId, preferred: "A", ratings: pairedRatings })
  }));
  assert.equal(blocked.response.status, 423);
  assert.match(blocked.body.error, /paused/i);

  const listing = await fetch(`${base}/api/incidents`).then(response => response.json());
  assert.equal(listing.incidents.length, 1);
  assert.equal(listing.chain.valid, true);
  const resolved = await json(await fetch(`${base}/api/incidents/${reported.body.incident.id}/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ resolution: "The rule was corrected and the frozen synthetic regression set passed." })
  }));
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.body.control.state, "active");

  const accepted = await json(await fetch(`${base}/api/comparisons`, {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: issued.comparisonCase.caseId, preferred: "A", ratings: pairedRatings })
  }));
  assert.equal(accepted.response.status, 201);
});
