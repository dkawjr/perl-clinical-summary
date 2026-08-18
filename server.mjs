import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assessments, auditSeed } from "./src/demo-data.js";
import { calibrationReferences } from "./src/calibration-references.js";
import { calibrationManifest } from "./src/calibration-manifest.js";
import { createModelProvider } from "./src/model-provider.js";
import { generationGatewayStatus } from "./src/model-gateway.js";
import {
  INTEGRATION_REHEARSAL_CONTRACT,
  buildSyntheticIntegrationRehearsalEvent
} from "./src/integration-rehearsal.js";
import {
  WORKSPACE_EXPERIENCE_CONTRACT,
  WorkspaceExperienceRepository
} from "./src/workspace-experience.js";
import { MODEL_TRANSPORT_CONTRACT, MODEL_TRANSPORT_POLICY_CONTRACT, validateModelTransportPolicy } from "./src/model-transport.js";
import {
  RELEASE_CANDIDATE_CONTRACT,
  RELEASE_SIGNATURE_CONTRACT,
  RELEASE_TRUST_POLICY_CONTRACT,
  ReleaseCandidateRepository,
  releaseTrustPolicyTemplate,
  validateReleaseTrustPolicy
} from "./src/release-candidate.js";
import {
  RELEASE_ADMISSION_CONTRACT,
  RELEASE_ADMISSION_POLICY,
  ReleaseAdmissionRepository
} from "./src/release-admission.js";
import {
  RELEASE_PROMOTION_ATTESTATION_CONTRACT,
  RELEASE_PROMOTION_CONTRACT,
  RELEASE_PROMOTION_REQUEST_CONTRACT,
  RELEASE_PROMOTION_TRUST_POLICY_CONTRACT,
  ReleasePromotionRepository,
  releasePromotionTrustPolicyTemplate,
  validateReleasePromotionTrustPolicy
} from "./src/release-promotion.js";
import { createDeliveryConnector, deliveryGatewayStatus } from "./src/delivery-gateway.js";
import { RECOVERY_REHEARSAL_CONTRACT, SandboxStore } from "./src/sandbox-store.js";
import { ROLLBACK_REHEARSAL_CONTRACT } from "./src/rollback-rehearsal.js";
import { OPERATIONAL_MONITORING_CONTRACT } from "./src/operational-monitoring.js";
import { INCIDENT_RESPONSE_CONTRACT } from "./src/incident-response.js";
import { MARKETABILITY_MAP_CONTRACT, PILOT_READINESS_CONTRACT, buildMarketabilityMap } from "./src/pilot-readiness.js";
import { EXECUTIVE_HANDOFF_CONTRACT, buildExecutiveHandoff, renderExecutiveHandoffPage } from "./src/executive-handoff.js";
import { CALIBRATION_INTAKE_CONTRACT, buildCalibrationIntake } from "./src/calibration-intake.js";
import { COUNSELOR_LAB_CONTRACT, buildCounselorLab } from "./src/counselor-lab.js";
import { COUNSELOR_NOTEBOOK_CONTRACT } from "./src/counselor-notebook.js";
import { COUNSELOR_REFERENCE_CONTRACT } from "./src/counselor-reference.js";
import { COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT } from "./src/counselor-reference-adjudication.js";
import {
  COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT,
  COUNSELOR_REFERENCE_DECISION_CHALLENGE_CONTRACT,
  COUNSELOR_REFERENCE_DECISION_CONTRACT,
  COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT,
  counselorReferenceDecisionRegistryTemplate
} from "./src/counselor-reference-decision.js";
import { PROGRESS_BRIEF_CONTRACT, PROGRESS_REVIEW_CONTRACT } from "./src/progress-review.js";
import { PROGRESS_REPORT_CONTRACT, renderProgressReportPage } from "./src/progress-report-page.js";
import { CLINICAL_STANDARD_CONTRACT } from "./src/clinical-standard.js";
import { INDEPENDENT_REVIEW_CONTRACT } from "./src/independent-review.js";
import {
  INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT,
  INDEPENDENT_REVIEW_ADMISSION_CHALLENGE_CONTRACT,
  INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
  INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT,
  independentReviewAdmissionRegistryTemplate
} from "./src/independent-review-admission.js";
import { INTEGRATION_RETURN_CONTRACT } from "./src/integration-return.js";
import { MODEL_TRIAL_CONTRACT } from "./src/model-trial.js";
import { CANDIDATE_TRIAL_CONTRACT } from "./src/candidate-trial.js";
import { CANDIDATE_RETURN_CONTRACT } from "./src/candidate-return.js";
import { CANDIDATE_BLIND_REVIEW_CONTRACT } from "./src/candidate-blind-review.js";
import { CANDIDATE_REFINEMENT_RETEST_CONTRACT } from "./src/candidate-refinement-retest.js";
import { CANDIDATE_RETEST_RETURN_CONTRACT } from "./src/candidate-retest-return.js";
import { CANDIDATE_RETEST_REREVIEW_CONTRACT } from "./src/candidate-retest-rereview.js";
import {
  CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT,
  CANDIDATE_RETEST_DISPOSITION_CHALLENGE_CONTRACT,
  CANDIDATE_RETEST_DISPOSITION_CONTRACT,
  CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT,
  candidateRetestDispositionRegistryTemplate
} from "./src/candidate-retest-disposition.js";
import {
  CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT,
  CANDIDATE_ADVANCEMENT_CHALLENGE_CONTRACT,
  CANDIDATE_ADVANCEMENT_CONTRACT,
  CANDIDATE_ADVANCEMENT_REGISTRY_CONTRACT,
  CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT,
  CANDIDATE_CYCLE_ACTION_CHALLENGE_CONTRACT,
  CANDIDATE_CYCLE_ACTION_REGISTRY_CONTRACT,
  candidateAdvancementRegistryTemplate,
  candidateCycleActionRegistryTemplate
} from "./src/candidate-advancement.js";
import { INTENDED_USE_CONTRACT } from "./src/intended-use.js";
import { LANGUAGE_REVIEW_CONTRACT } from "./src/language-review.js";
import { LANGUAGE_REVIEW_PAGE_CONTRACT, renderLanguageReviewPage } from "./src/language-review-page.js";
import { renderReportPage } from "./src/report-page.js";
import { REPORT_ASSEMBLY_CONTRACT, buildReportAssemblyProof, renderReportAssemblyPage } from "./src/report-assembly.js";
import { DECISION_EXCHANGE_CONTRACT, DECISION_RETURN_CONTRACT, renderDecisionRequestPage } from "./src/decision-exchange.js";
import { PILOT_OPERATIONS_CONTRACT, renderPilotOperationsBrief } from "./src/pilot-operations.js";
import { PROVIDER_ACTIVATION_CONTRACT, renderProviderActivationWorkbook } from "./src/provider-activation.js";
import { SITE_ADMISSION_CONTRACT, SITE_ADMISSION_RETURN_CONTRACT, renderSiteAdmissionDossier } from "./src/site-admission.js";
import {
  AUTHORITY_TRUST_CHALLENGE_CONTRACT,
  AUTHORITY_TRUST_CONTRACT,
  AUTHORITY_TRUST_RECEIPT_CONTRACT,
  AUTHORITY_TRUST_REGISTRY_CONTRACT,
  authorityTrustRegistryTemplate
} from "./src/authority-trust.js";
import {
  PILOT_START_ACK_CONTRACT,
  PILOT_START_CHALLENGE_CONTRACT,
  PILOT_START_CONTRACT,
  PILOT_START_ORDER_CONTRACT,
  PILOT_START_REGISTRY_CONTRACT,
  pilotStartRegistryTemplate
} from "./src/pilot-start.js";
import {
  CLINICAL_RELEASE_CHALLENGE_CONTRACT,
  CLINICAL_RELEASE_CONTRACT,
  CLINICAL_RELEASE_REGISTRY_CONTRACT,
  CLINICAL_USE_AUTHORIZATION_CONTRACT,
  PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT,
  RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT,
  clinicalReleaseRegistryTemplate
} from "./src/clinical-release.js";
import {
  FIRST_GOVERNED_TRANSACTION_CONTRACT,
  TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
  TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT,
  TRAFFIC_ACTIVATION_CONTRACT,
  TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
  trafficActivationRegistryTemplate
} from "./src/traffic-activation.js";
import {
  IDENTITY_ACCESS_CONTRACT,
  IDENTITY_ACCESS_EVENT_CONTRACT,
  IDENTITY_ACCESS_POLICY_CONTRACT,
  createIdentityAccessGateway,
  identityAccessPolicyTemplate
} from "./src/identity-access.js";
import { renderAudienceHandoffPage } from "./src/audience-handoff-page.js";
import {
  RUNTIME_ENVELOPE_CONTRACT,
  createRuntimeEnvelope,
  loadRuntimeEnvelopePolicyFile,
  runtimeEnvelopePolicyTemplate
} from "./src/runtime-envelope.js";
import {
  DEPLOYMENT_PRESENTATION_CONTRACT,
  buildDeploymentPresentation,
  normalizeDeploymentPresentationMode
} from "./src/deployment-presentation.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const defaultStorePath = join(root, "data", "sandbox-state.json");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pdf": "application/pdf"
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none"
};

function send(response, status, body, contentType = "application/json; charset=utf-8", method = "GET", extraHeaders = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  response.writeHead(status, {
    ...securityHeaders,
    ...extraHeaders,
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(payload)
  });
  response.end(method === "HEAD" ? undefined : payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 512 * 1024) throw Object.assign(new Error("Request body exceeds the 512 KB sandbox limit."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function actorFrom(request) {
  if (request.perlIdentity?.actorRef && request.perlIdentity.actorRef !== "PUBLIC") return request.perlIdentity.actorRef;
  const actor = String(request.headers["x-perl-demo-actor"] || "Demo reviewer").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(actor)) {
    throw Object.assign(new Error("Calibration reviewer code must use 2–48 letters, numbers, spaces, periods, underscores, or hyphens."), { status: 400 });
  }
  return actor;
}

function publicIdentityAccessStatus(identityGateway) {
  const status = identityGateway.status();
  return {
    contractVersion: IDENTITY_ACCESS_CONTRACT,
    mode: status.mode,
    authenticationRequired: status.authenticationRequired,
    authorizationEnforced: status.authorizationEnforced,
    policyCurrent: status.policyCurrent,
    trustedKeyCount: status.trustedKeyCount,
    activeKeyCount: status.activeKeyCount,
    roleCount: status.roleCount,
    bearerTokensStored: false,
    passwordsAccepted: false,
    productionSsoConnected: false,
    phiAuthorized: false,
    boundary: status.boundary
  };
}

async function apiResponse(request, response, pathname, store, workspaceExperienceRepository, modelProvider, deliveryConnector, identityGateway, releaseRepository, releaseAdmissionRepository, releasePromotionRepository, runtimeEnvelope, presentationMode) {
  const method = request.method || "GET";

  if (pathname === "/api/live" && method === "GET") {
    return send(response, 200, runtimeEnvelope.liveness());
  }

  if (pathname === "/api/ready" && method === "GET") {
    let repositoryIntegrity = true;
    try {
      await Promise.all([releaseRepository.status(), releaseAdmissionRepository.status(), releasePromotionRepository.status()]);
    } catch {
      repositoryIntegrity = false;
    }
    const readiness = runtimeEnvelope.readiness({ repositoryIntegrity });
    return send(response, readiness.ok ? 200 : 503, readiness);
  }

  if (pathname === "/api/health" && method === "GET") {
    const deploymentPresentation = buildDeploymentPresentation({
      requestedMode: presentationMode,
      runtimeStatus: runtimeEnvelope.publicStatus()
    });
    return send(response, 200, {
      ok: true,
      environment: deploymentPresentation.mode,
      persistence: "owner-only-json",
      model: generationGatewayStatus(modelProvider).activeProvider,
      integration: {
        contract: "eqpass-perl-score-event/rfi-0.1",
        attachmentContract: "eqpass-perl-attachment/rfi-0.1",
        workflowContract: "perl-provider-workflow/0.1",
        deliveryOutboxContract: "perl-delivery-outbox/1.0",
        integrationRehearsalContract: INTEGRATION_REHEARSAL_CONTRACT,
        workspaceExperienceContract: WORKSPACE_EXPERIENCE_CONTRACT,
        deploymentPresentationContract: DEPLOYMENT_PRESENTATION_CONTRACT,
        recoveryRehearsalContract: RECOVERY_REHEARSAL_CONTRACT,
        rollbackRehearsalContract: ROLLBACK_REHEARSAL_CONTRACT,
        operationalMonitoringContract: OPERATIONAL_MONITORING_CONTRACT,
        incidentResponseContract: INCIDENT_RESPONSE_CONTRACT,
        pilotReadinessContract: PILOT_READINESS_CONTRACT,
        marketabilityMapContract: MARKETABILITY_MAP_CONTRACT,
        executiveHandoffContract: EXECUTIVE_HANDOFF_CONTRACT,
        calibrationIntakeContract: CALIBRATION_INTAKE_CONTRACT,
        counselorLabContract: COUNSELOR_LAB_CONTRACT,
        counselorNotebookContract: COUNSELOR_NOTEBOOK_CONTRACT,
        counselorReferenceContract: COUNSELOR_REFERENCE_CONTRACT,
        counselorReferenceAdjudicationContract: COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
        counselorReferenceDecisionContract: COUNSELOR_REFERENCE_DECISION_CONTRACT,
        counselorReferenceDecisionRegistryContract: COUNSELOR_REFERENCE_DECISION_REGISTRY_CONTRACT,
        counselorReferenceDecisionChallengeContract: COUNSELOR_REFERENCE_DECISION_CHALLENGE_CONTRACT,
        counselorReferenceDecisionAttestationContract: COUNSELOR_REFERENCE_DECISION_ATTESTATION_CONTRACT,
        progressReviewContract: PROGRESS_REVIEW_CONTRACT,
        progressBriefContract: PROGRESS_BRIEF_CONTRACT,
        progressReportContract: PROGRESS_REPORT_CONTRACT.format,
        clinicalStandardContract: CLINICAL_STANDARD_CONTRACT,
        independentReviewContract: INDEPENDENT_REVIEW_CONTRACT,
        independentReviewAdmissionContract: INDEPENDENT_REVIEW_ADMISSION_CONTRACT,
        independentReviewAdmissionRegistryContract: INDEPENDENT_REVIEW_ADMISSION_REGISTRY_CONTRACT,
        independentReviewAdmissionChallengeContract: INDEPENDENT_REVIEW_ADMISSION_CHALLENGE_CONTRACT,
        independentReviewAdmissionAttestationContract: INDEPENDENT_REVIEW_ADMISSION_ATTESTATION_CONTRACT,
        integrationReturnContract: INTEGRATION_RETURN_CONTRACT,
        modelTrialContract: MODEL_TRIAL_CONTRACT,
        candidateTrialContract: CANDIDATE_TRIAL_CONTRACT,
        candidateReturnContract: CANDIDATE_RETURN_CONTRACT,
        candidateBlindReviewContract: CANDIDATE_BLIND_REVIEW_CONTRACT,
        candidateRefinementRetestContract: CANDIDATE_REFINEMENT_RETEST_CONTRACT,
        candidateRetestReturnContract: CANDIDATE_RETEST_RETURN_CONTRACT,
        candidateRetestRereviewContract: CANDIDATE_RETEST_REREVIEW_CONTRACT,
        candidateRetestDispositionContract: CANDIDATE_RETEST_DISPOSITION_CONTRACT,
        candidateRetestDispositionRegistryContract: CANDIDATE_RETEST_DISPOSITION_REGISTRY_CONTRACT,
        candidateRetestDispositionChallengeContract: CANDIDATE_RETEST_DISPOSITION_CHALLENGE_CONTRACT,
        candidateRetestDispositionAttestationContract: CANDIDATE_RETEST_DISPOSITION_ATTESTATION_CONTRACT,
        candidateAdvancementContract: CANDIDATE_ADVANCEMENT_CONTRACT,
        candidateCycleActionRegistryContract: CANDIDATE_CYCLE_ACTION_REGISTRY_CONTRACT,
        candidateCycleActionChallengeContract: CANDIDATE_CYCLE_ACTION_CHALLENGE_CONTRACT,
        candidateCycleActionAttestationContract: CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT,
        candidateAdvancementRegistryContract: CANDIDATE_ADVANCEMENT_REGISTRY_CONTRACT,
        candidateAdvancementChallengeContract: CANDIDATE_ADVANCEMENT_CHALLENGE_CONTRACT,
        candidateAdvancementAttestationContract: CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT,
        intendedUseContract: INTENDED_USE_CONTRACT,
        languageReviewContract: LANGUAGE_REVIEW_CONTRACT,
        languageReviewPageContract: LANGUAGE_REVIEW_PAGE_CONTRACT,
        reportAssemblyContract: REPORT_ASSEMBLY_CONTRACT,
        decisionExchangeContract: DECISION_EXCHANGE_CONTRACT,
        decisionReturnContract: DECISION_RETURN_CONTRACT,
        pilotOperationsContract: PILOT_OPERATIONS_CONTRACT,
        providerActivationContract: PROVIDER_ACTIVATION_CONTRACT,
        siteAdmissionContract: SITE_ADMISSION_CONTRACT,
        siteAdmissionReturnContract: SITE_ADMISSION_RETURN_CONTRACT,
        authorityTrustContract: AUTHORITY_TRUST_CONTRACT,
        authorityTrustRegistryContract: AUTHORITY_TRUST_REGISTRY_CONTRACT,
        authorityTrustChallengeContract: AUTHORITY_TRUST_CHALLENGE_CONTRACT,
        authorityTrustReceiptContract: AUTHORITY_TRUST_RECEIPT_CONTRACT,
        pilotStartContract: PILOT_START_CONTRACT,
        pilotStartRegistryContract: PILOT_START_REGISTRY_CONTRACT,
        pilotStartChallengeContract: PILOT_START_CHALLENGE_CONTRACT,
        pilotStartOrderContract: PILOT_START_ORDER_CONTRACT,
        pilotStartAcknowledgementContract: PILOT_START_ACK_CONTRACT,
        clinicalReleaseContract: CLINICAL_RELEASE_CONTRACT,
        clinicalReleaseRegistryContract: CLINICAL_RELEASE_REGISTRY_CONTRACT,
        clinicalReleaseChallengeContract: CLINICAL_RELEASE_CHALLENGE_CONTRACT,
        clinicalUseAuthorizationContract: CLINICAL_USE_AUTHORIZATION_CONTRACT,
        productionReleaseAuthorizationContract: PRODUCTION_RELEASE_AUTHORIZATION_CONTRACT,
        releaseDeploymentAttestationContract: RELEASE_DEPLOYMENT_ATTESTATION_CONTRACT,
        trafficActivationContract: TRAFFIC_ACTIVATION_CONTRACT,
        trafficActivationRegistryContract: TRAFFIC_ACTIVATION_REGISTRY_CONTRACT,
        trafficActivationChallengeContract: TRAFFIC_ACTIVATION_CHALLENGE_CONTRACT,
        trafficActivationAuthorizationContract: TRAFFIC_ACTIVATION_AUTHORIZATION_CONTRACT,
        firstGovernedTransactionContract: FIRST_GOVERNED_TRANSACTION_CONTRACT,
        identityAccessContract: IDENTITY_ACCESS_CONTRACT,
        identityAccessPolicyContract: IDENTITY_ACCESS_POLICY_CONTRACT,
        identityAccessEventContract: IDENTITY_ACCESS_EVENT_CONTRACT,
        modelTransportContract: MODEL_TRANSPORT_CONTRACT,
        modelTransportPolicyContract: MODEL_TRANSPORT_POLICY_CONTRACT,
        releaseCandidateContract: RELEASE_CANDIDATE_CONTRACT,
        releaseAdmissionContract: RELEASE_ADMISSION_CONTRACT,
        releaseAdmissionPolicy: RELEASE_ADMISSION_POLICY,
        releasePromotionContract: RELEASE_PROMOTION_CONTRACT,
        releasePromotionRequestContract: RELEASE_PROMOTION_REQUEST_CONTRACT,
        releasePromotionAttestationContract: RELEASE_PROMOTION_ATTESTATION_CONTRACT,
        releasePromotionTrustPolicyContract: RELEASE_PROMOTION_TRUST_POLICY_CONTRACT,
        releaseTrustPolicyContract: RELEASE_TRUST_POLICY_CONTRACT,
        releaseSignatureContract: RELEASE_SIGNATURE_CONTRACT,
        runtimeEnvelopeContract: RUNTIME_ENVELOPE_CONTRACT,
        status: "rfi-rehearsal",
        authoritative: false,
        modelProjection: "scoring-only",
        attachmentState: "prepared-outbox-held",
        workflowMode: "automatic-preparation-and-durable-outbox-rehearsal",
        deliveryConnector: deliveryGatewayStatus(deliveryConnector).connector
      },
      recovery: {
        mode: "ephemeral-isolated-copy",
        productionRecoveryClaimed: false,
        rpoConfigured: false,
        rtoConfigured: false
      },
      rollback: {
        mode: "local-lkg-compatibility-only",
        deployableArtifactRestored: false,
        productionRollbackPerformed: false,
        clinicalReleaseAuthorized: false
      },
      releaseCandidate: await releaseRepository.status(),
      releaseAdmission: await releaseAdmissionRepository.status(),
      releasePromotion: await releasePromotionRepository.status(),
      runtime: runtimeEnvelope.publicStatus(),
      deploymentPresentation,
      monitoring: {
        mode: "local-synthetic-point-in-time",
        continuousMonitoringClaimed: false,
        productionAlertingConnected: false,
        availabilitySlaClaimed: false,
        latencySloClaimed: false,
        productionBackupMonitoring: false,
        securityMonitoringConnected: false,
        externalNotificationsSent: false
      },
      incidentResponse: {
        mode: "local-synthetic-tabletop",
        productionIncidentDeclared: false,
        productionServiceStopped: false,
        notificationTreeConnected: false,
        ownerAssignmentsComplete: false,
        clinicalRestartAuthorized: false,
        clinicalReleaseAuthorized: false
      },
      pilotReadiness: {
        mode: "local-synthetic-readiness-dossier",
        productionReadinessClaimed: false,
        externalApprovalsRecorded: false,
        productionOwnersAssigned: false,
        pilotAuthorizationRecorded: false,
        clinicalReleaseAuthorized: false
      },
      marketability: {
        mode: "evidence-gated-executive-planning",
        calendarCommitment: false,
        marketabilityReady: false,
        productionReadinessClaimed: false,
        pilotAuthorizationRecorded: false
      },
      executiveHandoff: {
        mode: "read-only-decision-packet",
        externalApprovalsRecorded: false,
        productionOwnersAssigned: false,
        calendarCommitment: false,
        productionReadinessClaimed: false,
        pilotAuthorizationRecorded: false,
        phiIncluded: false
      },
      decisionExchange: {
        mode: "metadata-only-external-decision-return-preflight",
        requestPackets: 7,
        packetsTransmitted: false,
        evidenceFilesReceived: false,
        cryptographicSignaturesVerified: false,
        identitiesVerified: false,
        authoritiesVerified: false,
        externalAcceptancesRecorded: false,
        gatesClosed: false,
        pilotAuthorizationRecorded: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      pilotOperations: {
        mode: "source-backed-provider-pilot-planning",
        sourceClaimsVerifiedExternally: false,
        siteIdentityVerified: false,
        authorityVerified: false,
        agreementExecuted: false,
        trainingCompleted: false,
        pilotAuthorizationRecorded: false,
        pilotStarted: false,
        outcomeEstablished: false,
        renewalApproved: false,
        expansionApproved: false,
        phiIncluded: false
      },
      providerActivation: {
        mode: "source-backed-provider-training-rehearsal",
        sourceReportedWindowVerified: false,
        siteIdentityVerified: false,
        facilitatorAssigned: false,
        participantsRegistered: false,
        trainingScheduled: false,
        sessionHeld: false,
        attendanceVerified: false,
        completionAccepted: false,
        activationAuthorized: false,
        pilotAuthorizationRecorded: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false,
        phiIncluded: false
      },
      siteAdmission: {
        mode: "candidate-specific-metadata-only-admission-preflight",
        candidateDossiers: 2,
        siteContacted: false,
        siteIdentityVerified: false,
        evidenceFilesReceived: false,
        identitiesVerified: false,
        authoritiesVerified: false,
        externalAcceptanceRecorded: false,
        authorizationRecorded: false,
        pilotAuthorizationRecorded: false,
        pilotStarted: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false,
        phiIncluded: false
      },
      authorityTrust: {
        mode: "startup-provisioned-ed25519-metadata-receipts",
        registryWriteApiAvailable: false,
        trustRootsProvisioned: store.authorityTrustRegistry.keys.length > 0,
        humanNamesStored: false,
        evidenceFilesStored: false,
        phiIncluded: false,
        pilotStarted: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      pilotStart: {
        mode: "dual-key-provider-preparation-interlock",
        registryWriteApiAvailable: false,
        trustRootsProvisioned: store.pilotStartRegistry.keys.length > 0,
        startOrderVerified: false,
        deploymentStartAcknowledged: false,
        providerPreparationStarted: false,
        pilotStarted: false,
        clinicalTrafficEnabled: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false,
        phiIncluded: false
      },
      clinicalRelease: {
        mode: "three-duty-release-authority-traffic-off",
        registryWriteApiAvailable: false,
        trustRootsProvisioned: store.clinicalReleaseRegistry.keys.length > 0,
        clinicalUseAuthorized: false,
        patientUseAuthorized: false,
        productionReleaseAuthorized: false,
        deploymentVerified: false,
        releaseReadyForTrafficActivation: false,
        clinicalTrafficEnabled: false,
        pilotStarted: false,
        patientRecordsProcessed: false,
        phiIncluded: false
      },
      trafficActivation: {
        mode: "external-dual-control-first-transaction-witness",
        registryWriteApiAvailable: false,
        trafficControlApiAvailable: false,
        endpointConfigurationApiAvailable: false,
        patientRecordApiAvailable: false,
        trustRootsProvisioned: store.trafficActivationRegistry.keys.length > 0,
        externalTrafficActivationAuthorized: false,
        externalClinicalTrafficObserved: false,
        firstGovernedTransactionVerified: false,
        perlSandboxTrafficEnabled: false,
        perlSandboxPatientRecordsProcessed: false,
        phiStored: false
      },
      identityAccess: publicIdentityAccessStatus(identityGateway),
      workspaceExperience: {
        mode: "clinician-surface-and-practice-studio",
        profilePersistence: "local-owner-only-json",
        demographicLens: "constructed-aggregate-demonstration",
        minimumDemographicCellSize: 5,
        clinicalSafetyAlwaysVisible: true,
        roleContextGrantsAuthorization: false,
        patientLevelDemographicsAvailable: false,
        protectedAttributeDecisioningAllowed: false,
        phiIncluded: false
      },
      calibrationIntake: {
        mode: "aggregate-readiness-map",
        recordsReceived: false,
        recordLevelIntakeEnabled: false,
        phiApproved: false,
        deidentificationAccepted: false,
        holdoutValid: false,
        clinicalValidation: false,
        trainingDatasetCreated: false,
        productionDataConnected: false,
        pilotAuthorizationRecorded: false
      },
      counselorLab: {
        mode: "read-only-guided-session-plan",
        rosterAccepted: false,
        attendanceRecorded: false,
        trainingCompleted: false,
        counselorReferencesAccepted: false,
        protocolFrozen: false,
        independentReviewComplete: false,
        accuracyEstablished: false,
        reliabilityEstablished: false,
        clinicalValidation: false,
        pilotAuthorizationRecorded: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      clinicalStandard: {
        mode: "immutable-working-drafts",
        counselorPanelAccepted: false,
        clinicalLeadApproved: false,
        protocolFrozen: false,
        independentReviewComplete: false,
        clinicalValidation: false,
        pilotAuthorizationRecorded: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      independentReview: {
        mode: "sealed-local-evidence-package",
        sourceWorkbooksConnected: false,
        externalApprovalsRecorded: false,
        independentEvaluatorNamed: false,
        independentReviewComplete: false,
        accuracyEstablished: false,
        reliabilityEstablished: false,
        clinicalValidation: false,
        pilotAuthorizationRecorded: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      integrationReturn: {
        mode: "metadata-only-owner-return-preflight",
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
        clinicalUseAuthorized: false
      },
      counselorNotebook: {
        mode: "structured-local-rehearsal-notes",
        counselorIdentityVerified: false,
        attendanceRecorded: false,
        trainingCompleted: false,
        clinicalDecisionAccepted: false,
        counselorReferenceAccepted: false,
        protocolFrozen: false,
        independentReviewCompleted: false,
        accuracyEstablished: false,
        reliabilityEstablished: false,
        clinicalValidation: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      progressReview: {
        mode: "constructed-synthetic-pair-rehearsal",
        generatedBriefMode: "deterministic-rules-no-external-transmission",
        printableAddendumState: "rehearsal-draft",
        authoritativeSubjectLinkage: false,
        patientIdentityResolved: false,
        clinicianIdentityVerified: false,
        clinicalProgressEstablished: false,
        improvementEstablished: false,
        deteriorationEstablished: false,
        treatmentResponseEstablished: false,
        reliableChangeEstablished: false,
        meaningfulChangeEstablished: false,
        carePlanChanged: false,
        clinicalDecisionAccepted: false,
        clinicalValidation: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      modelTrial: {
        mode: "three-candidate-metadata-preflight",
        credentialsReceived: false,
        endpointReceived: false,
        modelOutputReceived: false,
        recordLevelDataReceived: false,
        phiReceived: false,
        externalTransferPerformed: false,
        vendorClaimsVerified: false,
        securityApproved: false,
        privacyApproved: false,
        clinicalPerformanceEstablished: false,
        independentReviewComplete: false,
        engineSelected: false,
        phiApproved: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateTrial: {
        mode: "predeclared-three-candidate-synthetic-plan",
        candidateRunsPlanned: 9,
        blindCellsPlanned: 12,
        credentialsReceived: false,
        endpointReceived: false,
        transportConfigured: false,
        assessmentPayloadIncluded: false,
        modelOutputReceived: false,
        reviewerIdentityReceived: false,
        phiReceived: false,
        externalTransferPerformed: false,
        providerCallPerformed: false,
        candidateTransportAuthorized: false,
        counselorPanelAccepted: false,
        clinicalStandardAccepted: false,
        trialExecutionAuthorized: false,
        accuracyEstablished: false,
        reliabilityEstablished: false,
        clinicalValidation: false,
        engineSelected: false,
        carePlanChanged: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateReturn: {
        mode: "manual-structured-synthetic-return",
        candidateRunsPossible: 9,
        credentialsReceived: false,
        endpointReceived: false,
        transportConfigured: false,
        assessmentPayloadIncluded: false,
        rawProviderResponseReceived: false,
        reviewerIdentityReceived: false,
        filesReceived: false,
        phiReceived: false,
        externalTransferPerformed: false,
        providerCallPerformed: false,
        candidateTransportAuthorized: false,
        blindReviewComplete: false,
        clinicalPerformanceEstablished: false,
        engineSelected: false,
        carePlanChanged: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateBlindReview: {
        mode: "four-arm-anonymous-synthetic-review",
        casesPossible: 3,
        blindCellsPossible: 12,
        directMeasuresPerCell: 5,
        reviewerAgreementDerived: true,
        candidateIdentityVisibleToReviewer: false,
        authorMappingRevealedAfterSubmission: false,
        reviewerIdentityVerified: false,
        counselorQualificationVerified: false,
        candidateRunExternallyVerified: false,
        trialExecutionAuthorized: false,
        accuracyEstablished: false,
        reliabilityEstablished: false,
        safetyEstablished: false,
        usefulnessEstablished: false,
        clinicalValidation: false,
        engineRanked: false,
        engineSelected: false,
        modelModificationAuthorized: false,
        carePlanChanged: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateRefinement: {
        mode: "one-change-same-case-synthetic-retest",
        anonymousLanes: 3,
        recurringCasesRequired: 3,
        distinctReviewersPerCaseRequired: 2,
        providerIdentityDisclosed: false,
        modelIdentityDisclosed: false,
        reviewerIdentityDisclosed: false,
        counselorIdentityDisclosed: false,
        candidateScoresProduced: false,
        candidateRankingProduced: false,
        providerCallPerformed: false,
        modelChangePerformed: false,
        retestReturnReceived: false,
        safetyRoutingOptimized: false,
        clinicalPerformanceEstablished: false,
        engineSelected: false,
        carePlanChanged: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateRetestDisposition: {
        mode: "four-duty-independent-same-case-disposition",
        requiredExternalDuties: 4,
        registryWriteApiAvailable: false,
        signingApiAvailable: false,
        evaluatorIdentityStored: false,
        summaryProseStoredInDispositionLedger: false,
        independentAccuracyDispositionRecorded: false,
        independentReliabilityDispositionRecorded: false,
        clinicalStandardSatisfactionRecorded: false,
        independentResultFrozen: false,
        generalizedAccuracyEstablished: false,
        generalizedReliabilityEstablished: false,
        comparativeImprovementEstablished: false,
        clinicalValidation: false,
        engineSelected: false,
        cycleClosed: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      candidateAdvancement: {
        mode: "two-room-exact-cycle-and-candidate-airlock",
        cycleActionDutiesRequired: 2,
        candidateAdvancementDutiesRequired: 4,
        registryWriteApiAvailable: false,
        signingApiAvailable: false,
        candidateIdentityDisclosedBeforeSignedClose: false,
        cycleActionFrozen: false,
        cycleClosed: false,
        candidateAdvancementFrozen: false,
        exactCandidateAdvancedToIntegrationReadiness: false,
        externalModelExecutionVerified: false,
        generalizedAccuracyEstablished: false,
        generalizedReliabilityEstablished: false,
        clinicalValidation: false,
        productionEngineSelected: false,
        candidateTransportAuthorized: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        trafficActivationAuthorized: false,
        patientUseAuthorized: false
      },
      intendedUse: {
        mode: "immutable-provider-first-working-charter",
        providerFirst: true,
        primaryAudience: "clinician",
        sourceAuthority: "authoritative-eqpass-scored-output",
        artifactRelationship: "additional-page-beside-unchanged-findings",
        humanReviewRequired: true,
        automatedClinicalDecisionAllowed: false,
        consumerUseInCurrentScope: false,
        executiveSponsorAccepted: false,
        clinicalLeadApproved: false,
        legalApproved: false,
        privacySecurityApproved: false,
        eqpassOwnerAccepted: false,
        disclaimerApproved: false,
        intendedUseFrozen: false,
        clinicalValidation: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      languageReview: {
        mode: "immutable-exact-copy-review-packet",
        copySurfaceCount: 9,
        reviewQuestionCount: 6,
        acceptancesRequired: 5,
        acceptancesRecorded: 0,
        executiveSponsorAccepted: false,
        clinicalLeadAccepted: false,
        legalApproved: false,
        privacySecurityAccepted: false,
        eqpassOwnerAccepted: false,
        disclaimerApproved: false,
        languageFrozen: false,
        clinicalValidation: false,
        pilotAuthorized: false,
        productionReleaseAuthorized: false,
        patientUseAuthorized: false
      },
      phiApproved: false
    });
  }

  if (pathname === "/api/security/identity/public" && method === "GET") {
    return send(response, 200, { identityAccess: publicIdentityAccessStatus(identityGateway) });
  }

  if (pathname === "/api/security/identity" && method === "GET") {
    return send(response, 200, { identityAccess: await store.identityAccessStatus(identityGateway.status()) });
  }

  if (pathname === "/api/workspace/experience" && method === "GET") {
    return send(response, 200, { workspace: await workspaceExperienceRepository.status(actorFrom(request)) });
  }

  if (pathname === "/api/workspace/experience" && method === "PUT") {
    const body = await readJson(request);
    return send(response, 200, await workspaceExperienceRepository.save(body.profile, actorFrom(request)));
  }

  if (pathname === "/api/security/identity/policy-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(identityAccessPolicyTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-identity-access-policy-template.json"' }
    );
  }

  if (pathname === "/api/progress" && method === "GET") {
    return send(response, 200, { progressReview: await store.progressReviewStatus() });
  }

  if (pathname === "/api/progress/observations" && method === "POST") {
    return send(response, 201, await store.recordProgressReviewObservation(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/progress.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.progressReviewStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-progress-review.json"' }
    );
  }

  if (pathname === "/api/progress/report.html" && method === "GET") {
    return send(
      response,
      200,
      renderProgressReportPage(await store.progressReviewStatus()),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": 'inline; filename="PERL-synthetic-progress-conversation-brief.html"' }
    );
  }

  if (pathname === "/api/assessments" && method === "GET") {
    return send(response, 200, { assessments: await store.listAssessments() });
  }

  if (pathname === "/api/model/status" && method === "GET") {
    return send(response, 200, await store.generationStatus());
  }

  if (pathname === "/api/assessments/import" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.importAssessment(body.assessment, actorFrom(request)));
  }

  if (pathname === "/api/integration/rehearsal" && method === "GET") {
    return send(response, 200, await store.integrationRehearsalStatus(actorFrom(request)));
  }

  if (pathname === "/api/integration/rehearsal/runs" && method === "POST") {
    await readJson(request);
    const template = JSON.parse(await readFile(join(root, "examples", "synthetic-eqpass-scored-event.json"), "utf8"));
    const token = randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
    const event = buildSyntheticIntegrationRehearsalEvent(template, {
      token,
      occurredAt: new Date().toISOString()
    });
    const imported = await store.importEqpassEvent(event, actorFrom(request));
    return send(response, 201, {
      started: true,
      assessmentId: imported.assessment.assessment.id,
      runId: `FF-RUN-${imported.receipt.hash.slice(0, 20).toUpperCase()}`,
      assessment: imported.assessment,
      rehearsal: await store.integrationRehearsalStatus(actorFrom(request))
    });
  }

  if (pathname === "/api/integration/eqpass/events" && method === "GET") {
    return send(response, 200, await store.listSourceEvents());
  }

  if (pathname === "/api/integration/eqpass/events" && method === "POST") {
    const body = await readJson(request);
    const result = await store.importEqpassEvent(body.event, actorFrom(request));
    return send(response, result.status === "imported" ? 201 : 200, result);
  }

  if (pathname === "/api/integration/owner-return" && method === "GET") {
    return send(response, 200, { integrationReturn: await store.integrationReturnStatus() });
  }

  if (pathname === "/api/integration/owner-return/preflight" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.preflightIntegrationReturnManifest(body.manifest, actorFrom(request)));
  }

  if (pathname === "/api/integration/owner-return/request.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.integrationReturnStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-eqpass-owner-return-request.json"' }
    );
  }

  if (pathname === "/api/integration/eqpass/attachments" && method === "GET") {
    return send(response, 200, await store.listAttachmentEvents());
  }

  if (pathname === "/api/integration/eqpass/attachments" && method === "POST") {
    const body = await readJson(request);
    const result = await store.prepareEqpassAttachment(body.attachment, actorFrom(request));
    return send(response, result.status === "prepared" ? 201 : 200, result);
  }

  if (pathname === "/api/integration/workflow" && method === "GET") {
    return send(response, 200, await store.listProviderWorkflow());
  }

  if (pathname === "/api/integration/delivery" && method === "GET") {
    return send(response, 200, await store.listDeliveryOutbox());
  }

  if (pathname === "/api/operations/recovery" && method === "GET") {
    return send(response, 200, await store.recoveryStatus());
  }

  if (pathname === "/api/operations/recovery/rehearse" && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.rehearseRecovery(actorFrom(request)));
  }

  if (pathname === "/api/operations/rollback" && method === "GET") {
    return send(response, 200, await store.rollbackStatus());
  }

  if (pathname === "/api/operations/rollback/rehearse" && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.rehearseRollbackCompatibility(actorFrom(request)));
  }

  if (pathname === "/api/operations/release" && method === "GET") {
    return send(response, 200, await releaseRepository.status());
  }

  if (pathname === "/api/operations/runtime/policy-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(runtimeEnvelopePolicyTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-runtime-envelope-policy-template.json"' }
    );
  }

  if (pathname === "/api/operations/release/build" && method === "POST") {
    await readJson(request);
    return send(response, 201, await releaseRepository.build(actorFrom(request)));
  }

  if (pathname === "/api/operations/release/admission" && method === "GET") {
    return send(response, 200, await releaseAdmissionRepository.status());
  }

  if (pathname === "/api/operations/release/promotion" && method === "GET") {
    return send(response, 200, await releasePromotionRepository.status());
  }

  const releaseAdmissionRun = pathname.match(/^\/api\/operations\/release\/candidates\/(perl-rc-[a-f0-9]{20})\/admission\/run$/);
  if (releaseAdmissionRun && method === "POST") {
    await readJson(request);
    return send(response, 201, await releaseAdmissionRepository.qualify(releaseAdmissionRun[1], actorFrom(request)));
  }

  const releaseAdmissionDownload = pathname.match(/^\/api\/operations\/release\/admissions\/(perl-adm-[a-f0-9]{20})\/report\.json$/);
  if (releaseAdmissionDownload && method === "GET") {
    const artifact = await releaseAdmissionRepository.download(releaseAdmissionDownload[1]);
    return send(
      response,
      200,
      artifact.bytes,
      artifact.mediaType,
      method,
      { "Content-Disposition": `attachment; filename="${artifact.filename}"` }
    );
  }

  const releasePromotionPrepare = pathname.match(/^\/api\/operations\/release\/candidates\/(perl-rc-[a-f0-9]{20})\/promotion\/prepare$/);
  if (releasePromotionPrepare && method === "POST") {
    await readJson(request);
    return send(response, 201, await releasePromotionRepository.prepare(releasePromotionPrepare[1]));
  }

  if (pathname === "/api/operations/release/promotions/attestations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await releasePromotionRepository.verifyAndStoreAttestation(body.attestation));
  }

  if (pathname === "/api/operations/release/promotion-trust-policy-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(releasePromotionTrustPolicyTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-release-promotion-trust-policy-template.json"' }
    );
  }

  const releasePromotionDownload = pathname.match(/^\/api\/operations\/release\/promotions\/(perl-prm-[a-f0-9]{20})\/(request\.json|attestation-template\.json)$/);
  if (releasePromotionDownload && method === "GET") {
    const kind = releasePromotionDownload[2] === "request.json" ? "request" : "attestationTemplate";
    const artifact = await releasePromotionRepository.download(releasePromotionDownload[1], kind);
    return send(response, 200, artifact.bytes, artifact.mediaType, method, { "Content-Disposition": `attachment; filename="${artifact.filename}"` });
  }

  if (pathname === "/api/operations/release/signatures/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await releaseRepository.verifyAndStoreSignature(body.envelope));
  }

  if (pathname === "/api/operations/release/trust-policy-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(releaseTrustPolicyTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-release-trust-policy-template.json"' }
    );
  }

  const releaseDownload = pathname.match(/^\/api\/operations\/release\/candidates\/(perl-rc-[a-f0-9]{20})\/(archive|manifest\.json|configuration\.json|sbom\.cdx\.json|provenance\.json|signing-request\.json)$/);
  if (releaseDownload && method === "GET") {
    const kind = ({
      archive: "archive",
      "manifest.json": "manifest",
      "configuration.json": "configuration",
      "sbom.cdx.json": "sbom",
      "provenance.json": "provenance",
      "signing-request.json": "signingRequest"
    })[releaseDownload[2]];
    const artifact = await releaseRepository.download(releaseDownload[1], kind);
    return send(
      response,
      200,
      artifact.bytes,
      artifact.mediaType,
      method,
      { "Content-Disposition": `attachment; filename="${artifact.filename}"` }
    );
  }

  if (pathname === "/api/operations/monitoring" && method === "GET") {
    return send(response, 200, await store.operationalMonitoringStatus());
  }

  if (pathname === "/api/operations/monitoring/probe" && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.recordOperationalMonitoringSnapshot(actorFrom(request)));
  }

  if (pathname === "/api/operations/incidents/response" && method === "GET") {
    return send(response, 200, await store.incidentResponseStatus());
  }

  if (pathname === "/api/operations/incidents/response/rehearse" && method === "POST") {
    const body = await readJson(request);
    return send(response, 200, await store.rehearseIncidentResponse(body.scenarioId, actorFrom(request)));
  }

  if (pathname === "/api/governance/intended-use" && method === "GET") {
    return send(response, 200, { intendedUse: await store.intendedUseStatus() });
  }

  if (pathname === "/api/governance/intended-use/drafts" && method === "POST") {
    return send(response, 201, await store.recordIntendedUseDraft(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/governance/intended-use.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.intendedUseStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-intended-use-charter.json"' }
    );
  }

  if (pathname === "/api/governance/language-review" && method === "GET") {
    return send(response, 200, { languageReview: await store.languageReviewStatus() });
  }

  if (pathname === "/api/governance/language-review/seal" && method === "POST") {
    await readJson(request);
    return send(response, 201, await store.sealLanguageReviewPacket(actorFrom(request)));
  }

  if (pathname === "/api/governance/language-review.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.languageReviewStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-language-review-packet.json"' }
    );
  }

  if (pathname === "/api/governance/language-review.html" && method === "GET") {
    return send(
      response,
      200,
      renderLanguageReviewPage(await store.languageReviewStatus()),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": 'inline; filename="PERL-clinical-counsel-language-review.html"' }
    );
  }

  if (pathname === "/api/governance/readiness" && method === "GET") {
    return send(response, 200, await store.pilotReadinessStatus());
  }

  if (pathname === "/api/governance/marketability" && method === "GET") {
    const readiness = await store.pilotReadinessStatus();
    return send(response, 200, buildMarketabilityMap(readiness.current));
  }

  if ((pathname === "/api/governance/handoff.json" || pathname === "/api/governance/handoff.html") && method === "GET") {
    const readiness = await store.pilotReadinessStatus();
    const marketability = buildMarketabilityMap(readiness.current);
    const handoff = buildExecutiveHandoff(readiness, marketability);
    if (pathname.endsWith(".html")) return send(response, 200, renderExecutiveHandoffPage(handoff), "text/html; charset=utf-8", method);
    return send(response, 200, handoff);
  }

  if (pathname === "/api/governance/decision-exchange" && method === "GET") {
    return send(response, 200, { decisionExchange: await store.decisionExchangeStatus() });
  }

  if (pathname === "/api/governance/decision-exchange.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.decisionExchangeStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-external-decision-exchange.json"' }
    );
  }

  if (pathname === "/api/governance/decision-exchange/preflight" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.preflightDecisionReturn(body.manifest, actorFrom(request)));
  }

  if (pathname === "/api/governance/pilot-operations" && method === "GET") {
    return send(response, 200, { pilotOperations: await store.pilotOperationsStatus() });
  }

  if (pathname === "/api/governance/pilot-operations.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.pilotOperationsStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-provider-pilot-operations-plan.json"' }
    );
  }

  if (pathname === "/api/governance/pilot-operations.html" && method === "GET") {
    return send(
      response,
      200,
      renderPilotOperationsBrief(await store.pilotOperationsStatus()),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": 'inline; filename="PERL-provider-pilot-operating-brief.html"' }
    );
  }

  if (pathname === "/api/governance/pilot-operations/snapshot" && method === "POST") {
    await readJson(request);
    return send(response, 201, await store.recordPilotOperationsSnapshot(actorFrom(request)));
  }

  if (pathname === "/api/governance/provider-activation" && method === "GET") {
    return send(response, 200, { providerActivation: await store.providerActivationStatus() });
  }

  if (pathname === "/api/governance/provider-activation.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.providerActivationStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-provider-activation-workbook.json"' }
    );
  }

  if (pathname === "/api/governance/provider-activation.html" && method === "GET") {
    return send(
      response,
      200,
      renderProviderActivationWorkbook(await store.providerActivationStatus()),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": 'inline; filename="PERL-provider-activation-workbook.html"' }
    );
  }

  if (pathname === "/api/governance/provider-activation/snapshot" && method === "POST") {
    await readJson(request);
    return send(response, 201, await store.recordProviderActivationSnapshot(actorFrom(request)));
  }

  if (pathname === "/api/operations/campus-observatory" && method === "GET") {
    return send(response, 200, { campusObservatory: await store.campusObservatoryStatus() });
  }

  if (pathname === "/api/operations/campus-observatory.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.campusObservatoryStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-campus-operations-observatory.json"' }
    );
  }

  if (pathname === "/api/operations/campus-observatory/snapshots" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.recordCampusObservatorySnapshot(body, actorFrom(request)));
  }

  if (pathname === "/api/governance/site-admission" && method === "GET") {
    return send(response, 200, { siteAdmission: await store.siteAdmissionStatus() });
  }

  if (pathname === "/api/governance/site-admission.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.siteAdmissionStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-named-site-admission-portfolio.json"' }
    );
  }

  if (pathname === "/api/governance/site-admission/preflight" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.preflightSiteAdmissionReturn(body.manifest, actorFrom(request)));
  }

  const siteAdmissionDossier = pathname.match(/^\/api\/governance\/site-admission\/([^/]+)\/(dossier\.html|return\.json)$/);
  if (siteAdmissionDossier && method === "GET") {
    const candidateId = decodeURIComponent(siteAdmissionDossier[1]);
    const portfolio = await store.siteAdmissionStatus();
    const dossier = portfolio.dossiers.find(item => item.candidate.id === candidateId);
    if (!dossier) throw Object.assign(new Error("Named-site admission dossier was not found."), { status: 404 });
    if (siteAdmissionDossier[2] === "dossier.html") return send(
      response,
      200,
      renderSiteAdmissionDossier(portfolio, candidateId),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": `inline; filename="PERL-${candidateId}-admission-dossier.html"` }
    );
    return send(
      response,
      200,
      JSON.stringify(dossier.returnTemplate, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${candidateId}-admission-return.json"` }
    );
  }

  if (pathname === "/api/governance/authority-trust" && method === "GET") {
    return send(response, 200, { authorityTrust: await store.authorityTrustStatus() });
  }

  if (pathname === "/api/governance/authority-trust.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.authorityTrustStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-governed-authority-trust.json"' }
    );
  }

  if (pathname === "/api/governance/authority-trust/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(authorityTrustRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-authority-trust-registry-template.json"' }
    );
  }

  if (pathname === "/api/governance/authority-trust/challenges" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.issueAuthorityTrustChallenge(body.candidateId, actorFrom(request)));
  }

  const authorityChallenge = pathname.match(/^\/api\/governance\/authority-trust\/challenges\/([^/]+)\.json$/);
  if (authorityChallenge && method === "GET") {
    const challengeId = decodeURIComponent(authorityChallenge[1]);
    const trust = await store.authorityTrustStatus();
    const event = trust.history.find(item => item.eventType === "challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) throw Object.assign(new Error("Authority-trust challenge was not found."), { status: 404 });
    return send(
      response,
      200,
      JSON.stringify(event.challenge, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${event.challenge.candidateId}-authority-challenge.json"` }
    );
  }

  if (pathname === "/api/governance/authority-trust/receipts/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyAuthorityTrustReceipt(body.receipt, actorFrom(request)));
  }

  if (pathname === "/api/governance/pilot-start" && method === "GET") {
    return send(response, 200, { pilotStart: await store.pilotStartStatus() });
  }

  if (pathname === "/api/governance/pilot-start.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.pilotStartStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-governed-pilot-start.json"' }
    );
  }

  if (pathname === "/api/governance/pilot-start/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(pilotStartRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-pilot-start-registry-template.json"' }
    );
  }

  if (pathname === "/api/governance/pilot-start/challenges" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.issuePilotStartChallenge(body.candidateId, actorFrom(request)));
  }

  const pilotStartChallenge = pathname.match(/^\/api\/governance\/pilot-start\/challenges\/([^/]+)\.json$/);
  if (pilotStartChallenge && method === "GET") {
    const challengeId = decodeURIComponent(pilotStartChallenge[1]);
    const control = await store.pilotStartStatus();
    const event = control.history.find(item => item.eventType === "challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) throw Object.assign(new Error("Pilot-start challenge was not found."), { status: 404 });
    return send(
      response,
      200,
      JSON.stringify(event.challenge, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${event.challenge.candidateId}-pilot-start-challenge.json"` }
    );
  }

  if (pathname === "/api/governance/pilot-start/orders/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyPilotStartOrder(body.order, actorFrom(request)));
  }

  if (pathname === "/api/governance/pilot-start/acknowledgements/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyPilotStartAcknowledgement(body.acknowledgement, actorFrom(request)));
  }

  if (pathname === "/api/governance/clinical-release" && method === "GET") {
    return send(response, 200, { clinicalRelease: await store.clinicalReleaseStatus() });
  }

  if (pathname === "/api/governance/clinical-release.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.clinicalReleaseStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-governed-clinical-release.json"' }
    );
  }

  if (pathname === "/api/governance/clinical-release/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(clinicalReleaseRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-clinical-release-registry-template.json"' }
    );
  }

  if (pathname === "/api/governance/clinical-release/challenges" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.issueClinicalReleaseChallenge(body.candidateId, actorFrom(request)));
  }

  const clinicalReleaseChallenge = pathname.match(/^\/api\/governance\/clinical-release\/challenges\/([^/]+)\.json$/);
  if (clinicalReleaseChallenge && method === "GET") {
    const challengeId = decodeURIComponent(clinicalReleaseChallenge[1]);
    const gate = await store.clinicalReleaseStatus();
    const event = gate.history.find(item => item.eventType === "release-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) throw Object.assign(new Error("Clinical-release challenge was not found."), { status: 404 });
    return send(
      response,
      200,
      JSON.stringify(event.challenge, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${event.challenge.candidateId}-clinical-release-challenge.json"` }
    );
  }

  if (pathname === "/api/governance/clinical-release/clinical-authorizations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyClinicalUseAuthorization(body.authorization, actorFrom(request)));
  }

  if (pathname === "/api/governance/clinical-release/production-authorizations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyProductionReleaseAuthorization(body.authorization, actorFrom(request)));
  }

  if (pathname === "/api/governance/clinical-release/deployment-attestations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyReleaseDeploymentAttestation(body.attestation, actorFrom(request)));
  }

  if (pathname === "/api/governance/traffic-activation" && method === "GET") {
    return send(response, 200, { trafficActivation: await store.trafficActivationStatus() });
  }

  if (pathname === "/api/governance/traffic-activation.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.trafficActivationStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-clinical-traffic-activation-witness.json"' }
    );
  }

  if (pathname === "/api/governance/traffic-activation/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(trafficActivationRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-traffic-activation-registry-template.json"' }
    );
  }

  if (pathname === "/api/governance/traffic-activation/challenges" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.issueTrafficActivationChallenge(body.candidateId, actorFrom(request)));
  }

  const trafficActivationChallenge = pathname.match(/^\/api\/governance\/traffic-activation\/challenges\/([^/]+)\.json$/);
  if (trafficActivationChallenge && method === "GET") {
    const challengeId = decodeURIComponent(trafficActivationChallenge[1]);
    const witness = await store.trafficActivationStatus();
    const event = witness.history.find(item => item.eventType === "traffic-activation-challenge-issued" && item.challenge.challengeId === challengeId);
    if (!event) throw Object.assign(new Error("Traffic-activation challenge was not found."), { status: 404 });
    return send(
      response,
      200,
      JSON.stringify(event.challenge, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${event.challenge.candidateId}-traffic-activation-challenge.json"` }
    );
  }

  if (pathname === "/api/governance/traffic-activation/clinical-authorizations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyClinicalTrafficAuthorization(body.authorization, actorFrom(request)));
  }

  if (pathname === "/api/governance/traffic-activation/operations-authorizations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyOperationsTrafficAuthorization(body.authorization, actorFrom(request)));
  }

  if (pathname === "/api/governance/traffic-activation/first-transactions/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyFirstGovernedTransactionAttestation(body.attestation, actorFrom(request)));
  }

  const decisionRequest = pathname.match(/^\/api\/governance\/decision-exchange\/([^/]+)\/request\.(json|html)$/);
  if (decisionRequest && method === "GET") {
    const gateId = decodeURIComponent(decisionRequest[1]);
    const exchange = await store.decisionExchangeStatus();
    const packet = exchange.packets.find(item => item.id === gateId);
    if (!packet) throw Object.assign(new Error("External decision request was not found."), { status: 404 });
    if (decisionRequest[2] === "html") return send(
      response,
      200,
      renderDecisionRequestPage(exchange, gateId),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": `inline; filename="PERL-${gateId}-decision-request.html"` }
    );
    return send(
      response,
      200,
      JSON.stringify(packet.returnTemplate, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${gateId}-decision-return.json"` }
    );
  }

  if (pathname === "/api/governance/readiness/snapshot" && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.recordPilotReadinessSnapshot(actorFrom(request)));
  }

  const deliveryProcess = pathname.match(/^\/api\/integration\/delivery\/([^/]+)\/process$/);
  if (deliveryProcess && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.processDeliveryJob(decodeURIComponent(deliveryProcess[1]), actorFrom(request)));
  }

  const deliveryRetry = pathname.match(/^\/api\/integration\/delivery\/([^/]+)\/retry$/);
  if (deliveryRetry && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.retryDeliveryJob(decodeURIComponent(deliveryRetry[1]), actorFrom(request)));
  }

  const workflowRetry = pathname.match(/^\/api\/integration\/workflow\/([^/]+)\/retry$/);
  if (workflowRetry && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.retryProviderWorkflow(decodeURIComponent(workflowRetry[1]), actorFrom(request)));
  }

  if (pathname === "/api/comparisons" && method === "POST") {
    return send(response, 201, await store.submitComparison({ ...(await readJson(request)), actor: actorFrom(request) }));
  }

  if (pathname === "/api/calibration/timing" && method === "POST") {
    return send(response, 201, await store.submitTimingTask(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/timing/next" && method === "GET") {
    return send(response, 200, { timingTask: await store.nextTimingTask(actorFrom(request)) });
  }

  if (pathname === "/api/calibration/next" && method === "GET") {
    return send(response, 200, { comparisonCase: await store.nextComparison(actorFrom(request)) });
  }

  if (pathname === "/api/calibration/metrics" && method === "GET") {
    return send(response, 200, { metrics: await store.metrics() });
  }

  if (pathname === "/api/calibration/analysis" && method === "GET") {
    return send(response, 200, { analysis: await store.calibrationAnalysis() });
  }

  if (pathname === "/api/calibration/intake.json" && method === "GET") {
    const [analysis, manifestPackage] = await Promise.all([store.calibrationAnalysis(), store.caseSetManifest()]);
    return send(
      response,
      200,
      JSON.stringify(buildCalibrationIntake({ analysis, manifestPackage }), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-calibration-intake-map.json"' }
    );
  }

  if (pathname === "/api/calibration/model-trial" && method === "GET") {
    return send(response, 200, { modelTrial: await store.modelTrialStatus() });
  }

  if (pathname === "/api/calibration/model-trial/preflight" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.preflightModelTrialManifest(body.manifest, actorFrom(request)));
  }

  if (pathname === "/api/calibration/model-trial/request.json" && method === "GET") {
    const modelTrial = await store.modelTrialStatus();
    return send(
      response,
      200,
      JSON.stringify(modelTrial.requestTemplate, null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-model-trial-candidate-request.json"' }
    );
  }

  if (pathname === "/api/calibration/model-trial.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.modelTrialStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-model-trial-bench.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-trial" && method === "GET") {
    return send(response, 200, { candidateTrial: await store.candidateTrialStatus() });
  }

  if (pathname === "/api/calibration/candidate-trial/snapshot" && method === "POST") {
    return send(response, 201, await store.recordCandidateTrialSnapshot(actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-trial.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateTrialStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-trial-protocol.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-returns" && method === "GET") {
    return send(response, 200, { candidateReturns: await store.candidateReturnStatus() });
  }

  if (pathname === "/api/calibration/candidate-returns/request.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateReturnRequest(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-return-kit.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-returns.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateReturnStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-return-desk.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-returns/outputs" && method === "POST") {
    return send(response, 201, await store.recordCandidateReturns(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-review" && method === "GET") {
    return send(response, 200, { candidateReview: await store.candidateBlindReviewStatus(actorFrom(request)) });
  }

  if (pathname === "/api/calibration/candidate-review/assignments" && method === "POST") {
    await readJson(request);
    return send(response, 201, await store.nextCandidateBlindReview(actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-review/outcomes" && method === "POST") {
    return send(response, 201, await store.submitCandidateBlindReview(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-review.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateBlindReviewStatus(actorFrom(request)), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-blind-review-evidence.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-refinement" && method === "GET") {
    return send(response, 200, { candidateRefinement: await store.candidateRefinementStatus() });
  }

  if (pathname === "/api/calibration/candidate-refinement/cycles" && method === "POST") {
    return send(response, 201, await store.createCandidateRefinementCycle(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-refinement.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRefinementStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-refinement-retest-desk.json"' }
    );
  }

  const candidateRefinementKitMatch = pathname.match(/^\/api\/calibration\/candidate-refinement\/cycles\/(FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80})\/retest-kit\.json$/);
  if (candidateRefinementKitMatch && method === "GET") {
    const cycleId = candidateRefinementKitMatch[1];
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRefinementRetestKit(cycleId), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="perl-${cycleId.toLowerCase()}-retest-kit.json"` }
    );
  }

  if (pathname === "/api/calibration/candidate-retest" && method === "GET") {
    const selectedCycleId = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("cycleId");
    return send(response, 200, { candidateRetest: await store.candidateRetestStatus(actorFrom(request), selectedCycleId) });
  }

  if (pathname === "/api/calibration/candidate-retest/returns" && method === "POST") {
    return send(response, 201, await store.recordCandidateRetestReturns(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-retest/reviews/assignments" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.nextCandidateRetestReview(body.cycleId, actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-retest/reviews/outcomes" && method === "POST") {
    return send(response, 201, await store.submitCandidateRetestReview(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-retest.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRetestStatus(actorFrom(request)), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-same-case-retest-rereview.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-retest/disposition" && method === "GET") {
    const selectedCycleId = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("cycleId");
    return send(response, 200, { candidateRetestDisposition: await store.candidateRetestDispositionStatus(actorFrom(request), selectedCycleId) });
  }

  if (pathname === "/api/calibration/candidate-retest/disposition.json" && method === "GET") {
    const selectedCycleId = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("cycleId");
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRetestDispositionStatus(actorFrom(request), selectedCycleId), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-candidate-retest-independent-disposition-docket.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-retest/disposition/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(candidateRetestDispositionRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-candidate-retest-disposition-registry-template.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-retest/disposition/challenges" && method === "POST") {
    const body = await readJson(request);
    const result = await store.issueCandidateRetestDispositionChallenge(body.cycleId, actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  const candidateRetestDispositionChallenge = pathname.match(/^\/api\/calibration\/candidate-retest\/disposition\/challenges\/(FF-RETEST-DISPOSITION-CHALLENGE-[A-F0-9-]{20,80})\.json$/);
  if (candidateRetestDispositionChallenge && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRetestDispositionChallenge(candidateRetestDispositionChallenge[1]), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${candidateRetestDispositionChallenge[1]}-candidate-retest-disposition-challenge.json"` }
    );
  }

  if (pathname === "/api/calibration/candidate-retest/disposition/attestations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyCandidateRetestDispositionAttestation(body.attestation, actorFrom(request)));
  }

  if (pathname === "/api/calibration/candidate-advancement" && method === "GET") {
    const selectedCycleId = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("cycleId");
    return send(response, 200, { candidateAdvancement: await store.candidateAdvancementStatus(actorFrom(request), selectedCycleId) });
  }

  if (pathname === "/api/calibration/candidate-advancement.json" && method === "GET") {
    const selectedCycleId = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).searchParams.get("cycleId");
    return send(
      response,
      200,
      JSON.stringify(await store.candidateAdvancementStatus(actorFrom(request), selectedCycleId), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-exact-candidate-advancement-airlock.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-advancement/registries/cycle-action-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(candidateCycleActionRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-candidate-cycle-action-registry-template.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-advancement/registries/candidate-advancement-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(candidateAdvancementRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-candidate-advancement-registry-template.json"' }
    );
  }

  if (pathname === "/api/calibration/candidate-advancement/cycle-action/challenges" && method === "POST") {
    const body = await readJson(request);
    const result = await store.issueCandidateCycleActionChallenge(body.cycleId, actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  if (pathname === "/api/calibration/candidate-advancement/candidate/challenges" && method === "POST") {
    const body = await readJson(request);
    const result = await store.issueCandidateAdvancementChallenge(body.cycleId, actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  const candidateAdvancementChallenge = pathname.match(/^\/api\/calibration\/candidate-advancement\/challenges\/(FF-(?:CYCLE-ACTION|CANDIDATE-ADVANCEMENT)-CHALLENGE-[A-F0-9-]{20,80})\.json$/);
  if (candidateAdvancementChallenge && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.candidateAdvancementChallenge(candidateAdvancementChallenge[1]), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${candidateAdvancementChallenge[1]}-challenge.json"` }
    );
  }

  if (["/api/calibration/candidate-advancement/cycle-action/attestations/verify", "/api/calibration/candidate-advancement/candidate/attestations/verify"].includes(pathname) && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyCandidateAdvancementAttestation(body.attestation, actorFrom(request)));
  }

  const candidateRetestReturnKitMatch = pathname.match(/^\/api\/calibration\/candidate-retest\/cycles\/(FF-REFINEMENT-CYCLE-[A-F0-9-]{20,80})\/return-kit\.json$/);
  if (candidateRetestReturnKitMatch && method === "GET") {
    const cycleId = candidateRetestReturnKitMatch[1];
    return send(
      response,
      200,
      JSON.stringify(await store.candidateRetestReturnRequest(cycleId), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="perl-${cycleId.toLowerCase()}-return-kit.json"` }
    );
  }

  if (pathname === "/api/calibration/counselor-lab.json" && method === "GET") {
    const [analysis, refinement, manifestPackage] = await Promise.all([
      store.calibrationAnalysis(),
      store.refinementBrief(),
      store.caseSetManifest()
    ]);
    return send(
      response,
      200,
      JSON.stringify(buildCounselorLab({ analysis, refinement, manifestPackage }), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-counselor-lab-session-plan.json"' }
    );
  }

  if (pathname === "/api/calibration/counselor-notebook" && method === "GET") {
    return send(response, 200, { counselorNotebook: await store.counselorNotebookStatus() });
  }

  if (pathname === "/api/calibration/counselor-notebook/entries" && method === "POST") {
    return send(response, 201, await store.recordCounselorNotebookEntry(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/counselor-notebook.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.counselorNotebookStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-counselor-session-notebook.json"' }
    );
  }

  if (pathname === "/api/calibration/reference-room" && method === "GET") {
    return send(response, 200, { referenceRoom: await store.counselorReferenceRoomStatus(actorFrom(request)) });
  }

  if (pathname === "/api/calibration/reference-room/drafts" && method === "POST") {
    return send(response, 201, await store.recordCounselorReferenceDraft(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/reference-room.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.counselorReferenceRoomStatus(actorFrom(request)), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-source-only-reference-room.json"' }
    );
  }

  if (pathname === "/api/calibration/reference-adjudication" && method === "GET") {
    return send(response, 200, { adjudication: await store.counselorReferenceAdjudicationStatus(actorFrom(request)) });
  }

  if (pathname === "/api/calibration/reference-adjudication/seal" && method === "POST") {
    await readJson(request);
    const result = await store.sealCounselorReferenceAdjudication(actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  if (pathname === "/api/calibration/reference-adjudication.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.counselorReferenceAdjudicationStatus(actorFrom(request)), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-counselor-reference-adjudication-dossier.json"' }
    );
  }

  if (pathname === "/api/calibration/reference-decision" && method === "GET") {
    return send(response, 200, { referenceDecision: await store.counselorReferenceDecisionStatus() });
  }

  if (pathname === "/api/calibration/reference-decision.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.counselorReferenceDecisionStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-counselor-reference-decision-docket.json"' }
    );
  }

  if (pathname === "/api/calibration/reference-decision/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(counselorReferenceDecisionRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-counselor-reference-decision-registry-template.json"' }
    );
  }

  if (pathname === "/api/calibration/reference-decision/challenges" && method === "POST") {
    await readJson(request);
    const result = await store.issueCounselorReferenceDecisionChallenge(actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  const referenceDecisionChallenge = pathname.match(/^\/api\/calibration\/reference-decision\/challenges\/(FF-REFERENCE-CHALLENGE-[A-F0-9-]{20,80})\.json$/);
  if (referenceDecisionChallenge && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.counselorReferenceDecisionChallenge(referenceDecisionChallenge[1]), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${referenceDecisionChallenge[1]}-reference-decision-challenge.json"` }
    );
  }

  if (pathname === "/api/calibration/reference-decision/attestations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyCounselorReferenceDecisionAttestation(body.attestation, actorFrom(request)));
  }

  if (pathname === "/api/calibration/clinical-standard" && method === "GET") {
    return send(response, 200, { clinicalStandard: await store.clinicalStandardStatus() });
  }

  if (pathname === "/api/calibration/clinical-standard/drafts" && method === "POST") {
    return send(response, 201, await store.recordClinicalStandardDraft(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/calibration/clinical-standard.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.clinicalStandardStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-clinical-standard-drafts.json"' }
    );
  }

  if (pathname === "/api/calibration/independent-review" && method === "GET") {
    return send(response, 200, { independentReview: await store.independentReviewStatus() });
  }

  if (pathname === "/api/calibration/independent-review/seal" && method === "POST") {
    await readJson(request);
    return send(response, 201, await store.sealIndependentReviewDossier(actorFrom(request)));
  }

  if (pathname === "/api/calibration/independent-review.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.independentReviewStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-independent-review-dossier.json"' }
    );
  }

  if (pathname === "/api/calibration/independent-review/admission" && method === "GET") {
    return send(response, 200, { independentReviewAdmission: await store.independentReviewAdmissionStatus() });
  }

  if (pathname === "/api/calibration/independent-review/admission.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.independentReviewAdmissionStatus(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-independent-review-admission-docket.json"' }
    );
  }

  if (pathname === "/api/calibration/independent-review/admission/registry-template.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(independentReviewAdmissionRegistryTemplate(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="PERL-independent-review-admission-registry-template.json"' }
    );
  }

  if (pathname === "/api/calibration/independent-review/admission/challenges" && method === "POST") {
    await readJson(request);
    const result = await store.issueIndependentReviewAdmissionChallenge(actorFrom(request));
    return send(response, result.created ? 201 : 200, result);
  }

  const independentReviewAdmissionChallenge = pathname.match(/^\/api\/calibration\/independent-review\/admission\/challenges\/(FF-REVIEW-ADMISSION-CHALLENGE-[A-F0-9-]{20,80})\.json$/);
  if (independentReviewAdmissionChallenge && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.independentReviewAdmissionChallenge(independentReviewAdmissionChallenge[1]), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": `attachment; filename="PERL-${independentReviewAdmissionChallenge[1]}-independent-review-admission-challenge.json"` }
    );
  }

  if (pathname === "/api/calibration/independent-review/admission/attestations/verify" && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, await store.verifyIndependentReviewAdmissionAttestation(body.attestation, actorFrom(request)));
  }

  if (pathname === "/api/calibration/refinement" && method === "GET") {
    return send(response, 200, { refinement: await store.refinementBrief() });
  }

  if (pathname === "/api/calibration/refinement.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.refinementBrief(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-refinement-brief.json"' }
    );
  }

  if (pathname === "/api/calibration/manifest" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.caseSetManifest(), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-case-set-manifest.json"' }
    );
  }

  if (pathname === "/api/incidents" && method === "GET") {
    return send(response, 200, await store.listIncidents());
  }

  if (pathname === "/api/incidents" && method === "POST") {
    return send(response, 201, await store.reportIncident(await readJson(request), actorFrom(request)));
  }

  if (pathname === "/api/changes" && method === "GET") {
    return send(response, 200, await store.listChanges());
  }

  if (pathname === "/api/changes" && method === "POST") {
    return send(response, 201, await store.proposeChange(await readJson(request), actorFrom(request)));
  }

  const changeReplay = pathname.match(/^\/api\/changes\/([^/]+)\/replay$/);
  if (changeReplay && method === "POST") {
    await readJson(request);
    return send(response, 200, await store.replayChange(decodeURIComponent(changeReplay[1]), actorFrom(request)));
  }

  const changeDisposition = pathname.match(/^\/api\/changes\/([^/]+)\/disposition$/);
  if (changeDisposition && method === "POST") {
    return send(response, 200, await store.decideChange(decodeURIComponent(changeDisposition[1]), await readJson(request), actorFrom(request)));
  }

  const incidentResolution = pathname.match(/^\/api\/incidents\/([^/]+)\/resolve$/);
  if (incidentResolution && method === "POST") {
    const body = await readJson(request);
    return send(response, 200, await store.resolveIncident(decodeURIComponent(incidentResolution[1]), body.resolution, actorFrom(request)));
  }

  if (pathname === "/api/calibration/export.json" && method === "GET") {
    return send(
      response,
      200,
      JSON.stringify(await store.exportStudyPackage({ releaseCandidate: await releaseRepository.status(), releaseAdmission: await releaseAdmissionRepository.status(), releasePromotion: await releasePromotionRepository.status(), runtimeEnvelope: runtimeEnvelope.publicStatus() }), null, 2) + "\n",
      "application/json; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-calibration-package.json"' }
    );
  }

  if (pathname === "/api/calibration/export.csv" && method === "GET") {
    return send(
      response,
      200,
      await store.exportComparisonsCsv(),
      "text/csv; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-blind-comparisons.csv"' }
    );
  }

  if (pathname === "/api/calibration/timing/export.csv" && method === "GET") {
    return send(
      response,
      200,
      await store.exportWorkflowTimingCsv(),
      "text/csv; charset=utf-8",
      method,
      { "Content-Disposition": 'attachment; filename="perl-synthetic-workflow-timing.csv"' }
    );
  }

  const reportAssembly = pathname.match(/^\/api\/assessments\/([^/]+)\/report-package\.(html|json)$/);
  if (reportAssembly && method === "GET") {
    const id = decodeURIComponent(reportAssembly[1]);
    const [detail, snapshot] = await Promise.all([store.getAssessment(id), store.reportSnapshot(id)]);
    const proof = buildReportAssemblyProof(detail, snapshot);
    if (reportAssembly[2] === "json") {
      return send(
        response,
        200,
        JSON.stringify(proof, null, 2) + "\n",
        "application/json; charset=utf-8",
        method,
        { "Content-Disposition": `attachment; filename="${id}-PERL-report-assembly-proof.json"` }
      );
    }
    return send(
      response,
      200,
      renderReportAssemblyPage(proof, snapshot.artifact),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": `inline; filename="${id}-PERL-report-assembly-proof.html"` }
    );
  }

  const reportPage = pathname.match(/^\/api\/assessments\/([^/]+)\/report\.html$/);
  if (reportPage && method === "GET") {
    const id = decodeURIComponent(reportPage[1]);
    const snapshot = await store.reportSnapshot(id);
    return send(
      response,
      200,
      renderReportPage(snapshot),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": `inline; filename="${id}-PERL-clinician-summary.html"` }
    );
  }

  const audienceHandoff = pathname.match(/^\/api\/assessments\/([^/]+)\/handoff\/([^/]+)\.html$/);
  if (audienceHandoff && method === "GET") {
    const id = decodeURIComponent(audienceHandoff[1]);
    const audience = decodeURIComponent(audienceHandoff[2]);
    const snapshot = await store.audienceHandoffSnapshot(id, audience);
    return send(
      response,
      200,
      renderAudienceHandoffPage(snapshot),
      "text/html; charset=utf-8",
      method,
      { "Content-Disposition": `inline; filename="${id}-PERL-${audience}-handoff.html"` }
    );
  }

  const detail = pathname.match(/^\/api\/assessments\/([^/]+)$/);
  if (detail && method === "GET") {
    return send(response, 200, await store.getAssessment(decodeURIComponent(detail[1])));
  }

  const narrative = pathname.match(/^\/api\/assessments\/([^/]+)\/narratives\/([^/]+)$/);
  if (narrative && method === "PUT") {
    const body = await readJson(request);
    const saved = await store.saveNarrative(decodeURIComponent(narrative[1]), decodeURIComponent(narrative[2]), body.text, actorFrom(request));
    return send(response, 200, { narrative: saved });
  }

  const interpretation = pathname.match(/^\/api\/assessments\/([^/]+)\/interpretation$/);
  if (interpretation && method === "PUT") {
    const body = await readJson(request);
    const saved = await store.saveInterpretation(decodeURIComponent(interpretation[1]), body.interpretation, actorFrom(request));
    return send(response, 200, { interpretation: saved });
  }

  const safety = pathname.match(/^\/api\/assessments\/([^/]+)\/safety-ack$/);
  if (safety && method === "POST") {
    const body = await readJson(request);
    return send(response, 200, { review: await store.acknowledgeSafety(decodeURIComponent(safety[1]), body.acknowledged, actorFrom(request)) });
  }

  const approve = pathname.match(/^\/api\/assessments\/([^/]+)\/approve$/);
  if (approve && method === "POST") {
    await readJson(request);
    return send(response, 200, { review: await store.approve(decodeURIComponent(approve[1]), actorFrom(request)) });
  }

  const feedback = pathname.match(/^\/api\/assessments\/([^/]+)\/feedback$/);
  if (feedback && method === "POST") {
    const body = await readJson(request);
    return send(response, 201, { feedback: await store.submitFeedback(decodeURIComponent(feedback[1]), { ...body, actor: actorFrom(request) }) });
  }

  return send(response, 404, { error: "API route not found." });
}

async function staticResponse(request, response, pathname) {
  const method = request.method || "GET";
  if (!["GET", "HEAD"].includes(method)) return send(response, 405, { error: "Method not allowed." });

  const vendorFiles = {
    "/vendor/pdf.min.mjs": resolve(root, "node_modules", "pdfjs-dist", "build", "pdf.min.mjs"),
    "/vendor/pdf.worker.min.mjs": resolve(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
    "/vendor/PDFJS-LICENSE.txt": resolve(root, "node_modules", "pdfjs-dist", "LICENSE")
  };
  const pdfAsset = pathname.match(/^\/vendor\/(cmaps|standard_fonts)\/([A-Za-z0-9_.-]+)$/);
  const candidate = vendorFiles[pathname]
    || (pdfAsset ? resolve(root, "node_modules", "pdfjs-dist", pdfAsset[1], pdfAsset[2]) : null)
    || resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
  const traversal = relative(root, candidate);
  if (traversal.startsWith("..") || traversal.includes("../")) return send(response, 404, "Not found", "text/plain; charset=utf-8", method);

  let target = candidate;
  try {
    if ((await stat(target)).isDirectory()) target = join(target, "index.html");
  } catch {
    target = join(root, "index.html");
  }
  const body = await readFile(target);
  return send(response, 200, body, mime[extname(target)] || "application/octet-stream", method);
}

async function loadAuthorityTrustRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL authority trust registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL authority trust registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL authority trust registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL authority trust registry must be valid JSON.");
  }
}

async function loadCounselorReferenceDecisionRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL counselor-reference decision registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL counselor-reference decision registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL counselor-reference decision registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL counselor-reference decision registry must be valid JSON.");
  }
}

async function loadIndependentReviewAdmissionRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL independent-review admission registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL independent-review admission registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL independent-review admission registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL independent-review admission registry must be valid JSON.");
  }
}

async function loadCandidateRetestDispositionRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL candidate retest disposition registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL candidate retest disposition registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL candidate retest disposition registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL candidate retest disposition registry must be valid JSON.");
  }
}

async function loadCandidateCycleActionRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL candidate cycle-action registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL candidate cycle-action registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL candidate cycle-action registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL candidate cycle-action registry must be valid JSON.");
  }
}

async function loadCandidateAdvancementRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL candidate advancement registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL candidate advancement registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL candidate advancement registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL candidate advancement registry must be valid JSON.");
  }
}

async function loadPilotStartRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL pilot-start registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL pilot-start registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL pilot-start registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL pilot-start registry must be valid JSON.");
  }
}

async function loadClinicalReleaseRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL clinical-release registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL clinical-release registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL clinical-release registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL clinical-release registry must be valid JSON.");
  }
}

async function loadTrafficActivationRegistryFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL traffic-activation registry must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL traffic-activation registry must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL traffic-activation registry must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL traffic-activation registry must be valid JSON.");
  }
}

async function loadIdentityAccessPolicyFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL identity-access policy must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL identity-access policy must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL identity-access policy must not exceed 256 KB.");
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL identity-access policy must be valid JSON.");
  }
}

export async function loadModelTransportPolicyFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL model-transport policy must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL model-transport policy must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL model-transport policy must not exceed 256 KB.");
  let policy;
  try {
    policy = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL model-transport policy must be valid JSON.");
  }
  const errors = validateModelTransportPolicy(policy);
  if (errors.length) throw new Error(errors.join(" "));
  return policy;
}

export async function loadReleaseTrustPolicyFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL release-trust policy must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL release-trust policy must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL release-trust policy must not exceed 256 KB.");
  let policy;
  try {
    policy = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL release-trust policy must be valid JSON.");
  }
  const errors = validateReleaseTrustPolicy(policy);
  if (errors.length) throw new Error(errors.join(" "));
  return policy;
}

export async function loadReleasePromotionTrustPolicyFile(filePath) {
  if (!filePath) return undefined;
  const resolved = resolve(filePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error("PERL release-promotion trust policy must be a regular file.");
  if ((metadata.mode & 0o077) !== 0) throw new Error("PERL release-promotion trust policy must be owner-only (mode 0600 or stricter).");
  if (metadata.size > 256 * 1024) throw new Error("PERL release-promotion trust policy must not exceed 256 KB.");
  let policy;
  try {
    policy = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("PERL release-promotion trust policy must be valid JSON.");
  }
  const errors = validateReleasePromotionTrustPolicy(policy);
  if (errors.length) throw new Error(errors.join(" "));
  return policy;
}

export async function createPerlServer({ storePath = defaultStorePath, workspaceExperienceRepository, workspaceExperiencePath, modelProvider = createModelProvider(), deliveryConnector = createDeliveryConnector(), counselorReferenceDecisionRegistry, independentReviewAdmissionRegistry, candidateRetestDispositionRegistry, candidateCycleActionRegistry, candidateAdvancementRegistry, authorityTrustRegistry, pilotStartRegistry, clinicalReleaseRegistry, trafficActivationRegistry, identityAccessPolicy, releaseTrustPolicy, releasePromotionTrustPolicy, releaseRepository, releaseRepositoryRoot, releaseAdmissionRepository, releaseAdmissionRepositoryRoot, releaseAdmissionQualifier, releasePromotionRepository, releasePromotionRepositoryRoot, runtimeEnvelope, presentationMode = "engineering", clock } = {}) {
  const activePresentationMode = normalizeDeploymentPresentationMode(presentationMode);
  const activeRuntimeEnvelope = runtimeEnvelope || await createRuntimeEnvelope({ dataDirectory: dirname(storePath), ...(clock ? { clock } : {}) });
  const store = new SandboxStore({ filePath: storePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider, deliveryConnector, ...(counselorReferenceDecisionRegistry ? { counselorReferenceDecisionRegistry } : {}), ...(independentReviewAdmissionRegistry ? { independentReviewAdmissionRegistry } : {}), ...(candidateRetestDispositionRegistry ? { candidateRetestDispositionRegistry } : {}), ...(candidateCycleActionRegistry ? { candidateCycleActionRegistry } : {}), ...(candidateAdvancementRegistry ? { candidateAdvancementRegistry } : {}), ...(authorityTrustRegistry ? { authorityTrustRegistry } : {}), ...(pilotStartRegistry ? { pilotStartRegistry } : {}), ...(clinicalReleaseRegistry ? { clinicalReleaseRegistry } : {}), ...(trafficActivationRegistry ? { trafficActivationRegistry } : {}), clock });
  await store.init();
  const activeWorkspaceExperienceRepository = workspaceExperienceRepository || new WorkspaceExperienceRepository({
    filePath: workspaceExperiencePath || join(dirname(storePath), "workspace-experience.json"),
    ...(clock ? { clock } : {})
  });
  await activeWorkspaceExperienceRepository.init();
  activeRuntimeEnvelope.markInitialized();
  const identityGateway = createIdentityAccessGateway({ ...(identityAccessPolicy ? { policy: identityAccessPolicy } : {}), ...(clock ? { clock } : {}) });
  const activeReleaseRepository = releaseRepository || new ReleaseCandidateRepository({
    sourceRoot: root,
    repositoryRoot: releaseRepositoryRoot || join(dirname(storePath), "releases"),
    ...(releaseTrustPolicy ? { trustPolicy: releaseTrustPolicy } : {}),
    ...(clock ? { clock } : {})
  });
  const activeReleaseAdmissionRepository = releaseAdmissionRepository || new ReleaseAdmissionRepository({
    releaseRepository: activeReleaseRepository,
    repositoryRoot: releaseAdmissionRepositoryRoot || join(dirname(storePath), "release-admissions"),
    ...(releaseAdmissionQualifier ? { qualifier: releaseAdmissionQualifier } : {}),
    ...(clock ? { clock } : {})
  });
  const activeReleasePromotionRepository = releasePromotionRepository || new ReleasePromotionRepository({
    releaseRepository: activeReleaseRepository,
    admissionRepository: activeReleaseAdmissionRepository,
    repositoryRoot: releasePromotionRepositoryRoot || join(dirname(storePath), "release-promotions"),
    ...(releasePromotionTrustPolicy ? { trustPolicy: releasePromotionTrustPolicy } : {}),
    ...(clock ? { clock } : {})
  });

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).pathname);
      if (pathname.startsWith("/api/")) {
        const identity = identityGateway.authorize(request.headers, pathname, request.method || "GET");
        request.perlIdentity = identity;
        if (identity.authenticated && identity.auditRequired) {
          await store.recordIdentityAccessDecision(identity, {
            method: request.method || "GET",
            routeClass: identity.routeClass,
            permission: identity.permission
          });
        }
        await apiResponse(request, response, pathname, store, activeWorkspaceExperienceRepository, modelProvider, deliveryConnector, identityGateway, activeReleaseRepository, activeReleaseAdmissionRepository, activeReleasePromotionRepository, activeRuntimeEnvelope, activePresentationMode);
      } else await staticResponse(request, response, pathname);
    } catch (error) {
      const status = Number(error.status) || 500;
      send(
        response,
        status,
        { error: status >= 500 ? "The local sandbox could not complete the request." : error.message },
        "application/json; charset=utf-8",
        request.method || "GET",
        status === 401 ? { "WWW-Authenticate": 'Bearer realm="PERL", error="invalid_token"' } : {}
      );
      if (status >= 500) console.error(error);
    }
  });
  server.on("listening", () => activeRuntimeEnvelope.markListening());

  return { server, store, workspaceExperienceRepository: activeWorkspaceExperienceRepository, modelProvider, deliveryConnector, identityGateway, releaseRepository: activeReleaseRepository, releaseAdmissionRepository: activeReleaseAdmissionRepository, releasePromotionRepository: activeReleasePromotionRepository, runtimeEnvelope: activeRuntimeEnvelope, presentationMode: activePresentationMode };
}

export async function startPerlServer({ port = Number(process.env.PORT || 4173), host = "127.0.0.1", storePath, presentationMode = process.env.PERL_PRESENTATION_MODE || "engineering" } = {}) {
  const runtimePolicy = await loadRuntimeEnvelopePolicyFile(process.env.PERL_RUNTIME_POLICY_FILE);
  if (process.env.PERL_REQUIRE_RUNTIME_POLICY === "true" && !runtimePolicy) throw new Error("PERL_REQUIRE_RUNTIME_POLICY=true requires an owner-only PERL_RUNTIME_POLICY_FILE.");
  const runtimeEnvelope = await createRuntimeEnvelope(runtimePolicy
    ? { policy: runtimePolicy }
    : { dataDirectory: dirname(storePath || defaultStorePath), port, host });
  const effectiveStorePath = runtimePolicy ? runtimeEnvelope.storePath : storePath;
  const counselorReferenceDecisionRegistry = await loadCounselorReferenceDecisionRegistryFile(process.env.PERL_COUNSELOR_REFERENCE_DECISION_REGISTRY_FILE);
  const independentReviewAdmissionRegistry = await loadIndependentReviewAdmissionRegistryFile(process.env.PERL_INDEPENDENT_REVIEW_ADMISSION_REGISTRY_FILE);
  const candidateRetestDispositionRegistry = await loadCandidateRetestDispositionRegistryFile(process.env.PERL_CANDIDATE_RETEST_DISPOSITION_REGISTRY_FILE);
  const candidateCycleActionRegistry = await loadCandidateCycleActionRegistryFile(process.env.PERL_CANDIDATE_CYCLE_ACTION_REGISTRY_FILE);
  const candidateAdvancementRegistry = await loadCandidateAdvancementRegistryFile(process.env.PERL_CANDIDATE_ADVANCEMENT_REGISTRY_FILE);
  const authorityTrustRegistry = await loadAuthorityTrustRegistryFile(process.env.PERL_AUTHORITY_TRUST_REGISTRY_FILE);
  const pilotStartRegistry = await loadPilotStartRegistryFile(process.env.PERL_PILOT_START_REGISTRY_FILE);
  const clinicalReleaseRegistry = await loadClinicalReleaseRegistryFile(process.env.PERL_CLINICAL_RELEASE_REGISTRY_FILE);
  const trafficActivationRegistry = await loadTrafficActivationRegistryFile(process.env.PERL_TRAFFIC_ACTIVATION_REGISTRY_FILE);
  const identityAccessPolicy = await loadIdentityAccessPolicyFile(process.env.PERL_IDENTITY_ACCESS_POLICY_FILE);
  const modelTransportPolicy = await loadModelTransportPolicyFile(process.env.PERL_MODEL_TRANSPORT_POLICY_FILE);
  const releaseTrustPolicy = await loadReleaseTrustPolicyFile(process.env.PERL_RELEASE_TRUST_POLICY_FILE);
  const releasePromotionTrustPolicy = await loadReleasePromotionTrustPolicyFile(process.env.PERL_RELEASE_PROMOTION_TRUST_POLICY_FILE);
  const modelProvider = modelTransportPolicy
    ? createModelProvider({ provider: "structured-candidate-https", policy: modelTransportPolicy })
    : createModelProvider();
  const runtime = await createPerlServer({
    storePath: effectiveStorePath,
    modelProvider,
    releaseRepositoryRoot: runtimePolicy ? runtimeEnvelope.releaseRepositoryRoot : process.env.PERL_RELEASE_REPOSITORY_DIR || join(root, "data", "releases"),
    releaseAdmissionRepositoryRoot: runtimePolicy ? runtimeEnvelope.admissionRepositoryRoot : process.env.PERL_RELEASE_ADMISSION_REPOSITORY_DIR || join(root, "data", "release-admissions"),
    releasePromotionRepositoryRoot: runtimePolicy ? runtimeEnvelope.promotionRepositoryRoot : process.env.PERL_RELEASE_PROMOTION_REPOSITORY_DIR || join(root, "data", "release-promotions"),
    runtimeEnvelope,
    presentationMode,
    ...(releaseTrustPolicy ? { releaseTrustPolicy } : {}),
    ...(releasePromotionTrustPolicy ? { releasePromotionTrustPolicy } : {}),
    ...(counselorReferenceDecisionRegistry ? { counselorReferenceDecisionRegistry } : {}),
    ...(independentReviewAdmissionRegistry ? { independentReviewAdmissionRegistry } : {}),
    ...(candidateRetestDispositionRegistry ? { candidateRetestDispositionRegistry } : {}),
    ...(candidateCycleActionRegistry ? { candidateCycleActionRegistry } : {}),
    ...(candidateAdvancementRegistry ? { candidateAdvancementRegistry } : {}),
    ...(authorityTrustRegistry ? { authorityTrustRegistry } : {}),
    ...(pilotStartRegistry ? { pilotStartRegistry } : {}),
    ...(clinicalReleaseRegistry ? { clinicalReleaseRegistry } : {}),
    ...(trafficActivationRegistry ? { trafficActivationRegistry } : {}),
    ...(identityAccessPolicy ? { identityAccessPolicy } : {})
  });
  await new Promise((resolvePromise, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(runtimeEnvelope.port, runtimeEnvelope.host, resolvePromise);
  });
  let shutdownPromise;
  runtime.shutdown = signal => {
    if (shutdownPromise) return shutdownPromise;
    runtimeEnvelope.beginShutdown(signal);
    shutdownPromise = new Promise(resolvePromise => {
      const timeout = setTimeout(() => {
        runtime.server.closeAllConnections?.();
        resolvePromise({ graceful: false, signal });
      }, runtimeEnvelope.descriptor.gracefulShutdownSeconds * 1000);
      timeout.unref?.();
      runtime.server.close(() => {
        clearTimeout(timeout);
        resolvePromise({ graceful: true, signal });
      });
    });
    return shutdownPromise;
  };
  const presentation = buildDeploymentPresentation({ requestedMode: runtime.presentationMode, runtimeStatus: runtimeEnvelope.publicStatus() });
  console.log(`PERL workspace: http://${runtimeEnvelope.host}:${runtimeEnvelope.port}`);
  console.log(`Environment: ${presentation.environmentLabel} · ${presentation.dataLabel}`);
  return runtime;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startPerlServer().then(runtime => {
    for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
      runtime.shutdown(signal).then(() => { process.exitCode = 0; });
    });
  }).catch(error => {
    console.error(`PERL startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
