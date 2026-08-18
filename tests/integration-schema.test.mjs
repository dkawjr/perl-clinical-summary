import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = JSON.parse(
  await readFile(new URL("../schemas/eqpass-scored-event.proposed.schema.json", import.meta.url), "utf8")
);
const recoverySchema = JSON.parse(
  await readFile(new URL("../schemas/recovery-rehearsal-event.schema.json", import.meta.url), "utf8")
);
const monitoringSchema = JSON.parse(
  await readFile(new URL("../schemas/operational-monitoring-event.schema.json", import.meta.url), "utf8")
);
const responseSchema = JSON.parse(
  await readFile(new URL("../schemas/incident-response-rehearsal-event.schema.json", import.meta.url), "utf8")
);
const readinessSchema = JSON.parse(
  await readFile(new URL("../schemas/pilot-readiness-snapshot-event.schema.json", import.meta.url), "utf8")
);
const independentReviewSchema = JSON.parse(
  await readFile(new URL("../schemas/independent-review-dossier-event.schema.json", import.meta.url), "utf8")
);
const independentReviewAdmissionSchema = JSON.parse(
  await readFile(new URL("../schemas/independent-review-admission-event.schema.json", import.meta.url), "utf8")
);
const integrationReturnSchema = JSON.parse(
  await readFile(new URL("../schemas/eqpass-owner-return-preflight-event.schema.json", import.meta.url), "utf8")
);
const pilotOperationsSchema = JSON.parse(
  await readFile(new URL("../schemas/pilot-operations-snapshot-event.schema.json", import.meta.url), "utf8")
);
const providerActivationSchema = JSON.parse(
  await readFile(new URL("../schemas/provider-activation-workbook-snapshot-event.schema.json", import.meta.url), "utf8")
);
const siteAdmissionSchema = JSON.parse(
  await readFile(new URL("../schemas/site-admission-return-preflight-event.schema.json", import.meta.url), "utf8")
);
const authorityTrustSchema = JSON.parse(
  await readFile(new URL("../schemas/authority-trust-event.schema.json", import.meta.url), "utf8")
);

test("proposed e-QPASS transport stays explicitly non-authoritative and privacy-minimized", () => {
  assert.equal(schema["x-status"], "proposed-rfi-only");
  assert.equal(schema["x-model-projection"], "scoring only");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.sourceAssessment.additionalProperties, false);
  assert.equal(schema.properties.sourceAssessment.required.includes("subjectRef"), false);
  assert.equal(schema.properties.scoring.additionalProperties, false);
  assert.equal(schema.properties.scoring.properties.subscales.minItems, 14);
  assert.equal(schema.properties.scoring.properties.subscales.maxItems, 14);
  assert.deepEqual(
    schema.properties.scoring.properties.scales.required.sort(),
    [
      "anger",
      "anxiety",
      "depression",
      "gpi",
      "obsessiveCompulsive",
      "phobicAvoidance",
      "psychoticism",
      "suicideRisk",
      "violenceRisk"
    ]
  );

  const serialized = JSON.stringify(schema.properties);
  for (const forbidden of ["dateOfBirth", "email", "phone", "address", "rawItemResponses"]) {
    assert.equal(serialized.includes(`\"${forbidden}\"`), false);
  }
});

test("authority-trust events require Ed25519 metadata and deny pilot-start and release claims", () => {
  assert.equal(authorityTrustSchema.oneOf.length, 2);
  assert.equal(authorityTrustSchema.$defs.scope.enum.length, 36);
  assert.equal(authorityTrustSchema.$defs.challenge.properties.requiredScopes.minItems, 36);
  assert.equal(authorityTrustSchema.$defs.challenge.properties.nonce.pattern, "^[A-Za-z0-9_-]{43}$");
  assert.equal(authorityTrustSchema.$defs.receipt.properties.signature.properties.algorithm.const, "Ed25519");
  assert.equal(authorityTrustSchema.$defs.receipt.properties.signature.properties.value.pattern, "^[A-Za-z0-9_-]{86}$");
  assert.equal(authorityTrustSchema.$defs.assertion.oneOf.length, 2);
  assert.equal(authorityTrustSchema.$defs.contentBoundary.properties.evidenceFilesIncluded.const, false);
  assert.equal(authorityTrustSchema.$defs.contentBoundary.properties.humanNamesIncluded.const, false);
  assert.equal(authorityTrustSchema.$defs.contentBoundary.properties.phiIncluded.const, false);
  assert.equal(authorityTrustSchema.$defs.common.properties.pilotStarted.const, false);
  assert.equal(authorityTrustSchema.$defs.common.properties.productionReleaseAuthorized.const, false);
  assert.equal(authorityTrustSchema.$defs.common.properties.patientUseAuthorized.const, false);
});

test("recovery rehearsal evidence cannot imply production backup or configured recovery targets", () => {
  assert.equal(recoverySchema.properties.contractVersion.const, "perl-recovery-rehearsal/1.0");
  assert.equal(recoverySchema.properties.mode.const, "ephemeral-isolated-copy");
  assert.equal(recoverySchema.properties.productionRecoveryClaimed.const, false);
  assert.equal(recoverySchema.properties.rpoConfigured.const, false);
  assert.equal(recoverySchema.properties.rtoConfigured.const, false);
  assert.ok(recoverySchema.properties.verification.required.includes("recordCountsMatch"));
  assert.ok(recoverySchema.properties.verification.required.includes("allLedgersValid"));
  assert.ok(recoverySchema.properties.verification.required.includes("isolatedCopyRemoved"));
});

test("operational evidence cannot imply continuous telemetry or delivered production alerts", () => {
  assert.equal(monitoringSchema.properties.contractVersion.const, "perl-operational-monitoring/1.0");
  assert.equal(monitoringSchema.properties.scope.const, "local-synthetic-point-in-time");
  assert.equal(monitoringSchema.properties.continuousMonitoringClaimed.const, false);
  assert.equal(monitoringSchema.properties.productionAlertingConnected.const, false);
  assert.equal(monitoringSchema.properties.availabilitySlaClaimed.const, false);
  assert.equal(monitoringSchema.properties.latencySloClaimed.const, false);
  assert.equal(monitoringSchema.properties.productionBackupMonitoring.const, false);
  assert.equal(monitoringSchema.properties.securityMonitoringConnected.const, false);
  assert.equal(monitoringSchema.properties.externalNotificationsSent.const, false);
});

test("response rehearsal evidence cannot imply a production incident, notification, or restart", () => {
  assert.equal(responseSchema.properties.contractVersion.const, "perl-incident-response-rehearsal/1.0");
  assert.equal(responseSchema.properties.productionIncidentDeclared.const, false);
  assert.equal(responseSchema.properties.productionServiceStopped.const, false);
  assert.equal(responseSchema.properties.notificationTreeConnected.const, false);
  assert.equal(responseSchema.properties.externalNotificationsSent.const, false);
  assert.equal(responseSchema.properties.clinicalRestartAuthorized.const, false);
  assert.equal(responseSchema.properties.clinicalReleaseAuthorized.const, false);
});

test("readiness evidence cannot grant permission or invent external acceptance", () => {
  assert.equal(readinessSchema.properties.contractVersion.const, "perl-pilot-readiness-snapshot/1.0");
  assert.equal(readinessSchema.properties.status.const, "pilot-authorization-blocked");
  assert.equal(readinessSchema.properties.scope.const, "local-synthetic-readiness-dossier");
  assert.equal(readinessSchema.properties.gates.minItems, 14);
  assert.equal(readinessSchema.properties.authorityRegister.minItems, 10);
  assert.equal(readinessSchema.properties.gateCounts.properties.externalDecisionRequired.const, 7);
  assert.equal(readinessSchema.properties.productionReadinessClaimed.const, false);
  assert.equal(readinessSchema.properties.externalApprovalsRecorded.const, false);
  assert.equal(readinessSchema.properties.productionOwnersAssigned.const, false);
  assert.equal(readinessSchema.properties.pilotAuthorizationRecorded.const, false);
  assert.equal(readinessSchema.properties.clinicalReleaseAuthorized.const, false);
});

test("pilot-operations evidence cannot verify a site, launch a pilot, or approve expansion", () => {
  assert.equal(pilotOperationsSchema.properties.contractVersion.const, "perl-provider-pilot-operations-plan/1.0");
  assert.equal(pilotOperationsSchema.properties.status.const, "source-plan-assembled-external-authorization-required");
  assert.equal(pilotOperationsSchema.properties.counts.properties.candidatePathways.const, 2);
  assert.equal(pilotOperationsSchema.properties.counts.properties.workingMonths.const, 10);
  assert.equal(pilotOperationsSchema.properties.counts.properties.quarterlyReviews.const, 4);
  assert.equal(pilotOperationsSchema.properties.counts.properties.admissionGates.const, 7);
  assert.equal(pilotOperationsSchema.properties.siteIdentityVerified.const, false);
  assert.equal(pilotOperationsSchema.properties.authorityVerified.const, false);
  assert.equal(pilotOperationsSchema.properties.trainingCompleted.const, false);
  assert.equal(pilotOperationsSchema.properties.pilotAuthorized.const, false);
  assert.equal(pilotOperationsSchema.properties.pilotStarted.const, false);
  assert.equal(pilotOperationsSchema.properties.outcomeEstablished.const, false);
  assert.equal(pilotOperationsSchema.properties.renewalApproved.const, false);
  assert.equal(pilotOperationsSchema.properties.expansionApproved.const, false);
  assert.equal(pilotOperationsSchema.properties.patientUseAuthorized.const, false);
});

test("provider-activation evidence cannot invent attendance, completion, or site readiness", () => {
  assert.equal(providerActivationSchema.properties.contractVersion.const, "perl-provider-activation-workbook/1.0");
  assert.equal(providerActivationSchema.properties.status.const, "working-activation-plan-external-training-acceptance-required");
  assert.equal(providerActivationSchema.properties.counts.properties.workingMinutes.const, 100);
  assert.equal(providerActivationSchema.properties.counts.properties.modules.const, 4);
  assert.equal(providerActivationSchema.properties.counts.properties.objectives.const, 8);
  assert.equal(providerActivationSchema.properties.counts.properties.drills.const, 4);
  assert.equal(providerActivationSchema.properties.counts.properties.criticalDrills.const, 2);
  assert.equal(providerActivationSchema.properties.counts.properties.requiredReturns.const, 10);
  assert.equal(providerActivationSchema.properties.trainingScheduled.const, false);
  assert.equal(providerActivationSchema.properties.sessionHeld.const, false);
  assert.equal(providerActivationSchema.properties.attendanceVerified.const, false);
  assert.equal(providerActivationSchema.properties.drillsPassed.const, false);
  assert.equal(providerActivationSchema.properties.completionAccepted.const, false);
  assert.equal(providerActivationSchema.properties.activationAuthorized.const, false);
  assert.equal(providerActivationSchema.properties.pilotAuthorized.const, false);
  assert.equal(providerActivationSchema.properties.patientUseAuthorized.const, false);
});

test("site-admission evidence cannot verify a site, signature, authority, or pilot start", () => {
  assert.equal(siteAdmissionSchema.properties.contractVersion.const, "perl-named-site-admission-dossier/1.0");
  assert.equal(siteAdmissionSchema.properties.returnContractVersion.const, "perl-named-site-admission-return/rfi-1.0");
  assert.equal(siteAdmissionSchema.properties.authorityResults.minItems, 5);
  assert.equal(siteAdmissionSchema.properties.authorityResults.maxItems, 5);
  assert.equal(siteAdmissionSchema.properties.evidenceResults.minItems, 12);
  assert.equal(siteAdmissionSchema.properties.evidenceResults.maxItems, 12);
  assert.equal(siteAdmissionSchema.properties.counts.properties.authorityRequired.const, 5);
  assert.equal(siteAdmissionSchema.properties.counts.properties.evidenceRequired.const, 12);
  assert.equal(siteAdmissionSchema.properties.evidenceFilesReceived.const, false);
  assert.equal(siteAdmissionSchema.properties.namesOrSignaturesReceived.const, false);
  assert.equal(siteAdmissionSchema.properties.siteIdentityVerified.const, false);
  assert.equal(siteAdmissionSchema.properties.authorityVerified.const, false);
  assert.equal(siteAdmissionSchema.properties.authorizationRecorded.const, false);
  assert.equal(siteAdmissionSchema.properties.pilotAuthorized.const, false);
  assert.equal(siteAdmissionSchema.properties.pilotStarted.const, false);
  assert.equal(siteAdmissionSchema.properties.patientUseAuthorized.const, false);
});

test("independent-review evidence cannot impersonate an evaluator or establish clinical performance", () => {
  assert.equal(independentReviewSchema.properties.contractVersion.const, "perl-independent-review-dossier/1.0");
  assert.deepEqual(independentReviewSchema.properties.gateCounts.properties.externalAccepted.enum, [0, 1]);
  assert.deepEqual(independentReviewSchema.properties.gateCounts.properties.externalDecisionRequired.enum, [5, 6]);
  assert.equal(independentReviewSchema.properties.externalApprovalsRecorded.const, false);
  assert.equal(independentReviewSchema.properties.independentEvaluatorNamed.const, false);
  assert.equal(independentReviewSchema.properties.independentReviewComplete.const, false);
  assert.equal(independentReviewSchema.properties.accuracyEstablished.const, false);
  assert.equal(independentReviewSchema.properties.reliabilityEstablished.const, false);
  assert.equal(independentReviewSchema.properties.clinicalValidation.const, false);
  assert.equal(independentReviewSchema.properties.productionReleaseAuthorized.const, false);
});

test("independent-review admission can authorize protocol execution but cannot invent an evaluation result", () => {
  const challenge = independentReviewAdmissionSchema.$defs.challengeEvent.properties;
  const attestation = independentReviewAdmissionSchema.$defs.attestationEvent.properties;
  assert.equal(challenge.contractVersion.const, "perl-independent-review-admission-docket/1.0");
  assert.equal(challenge.sourceContractsAccepted.const, false);
  assert.equal(challenge.independentReviewExecutionReady.const, false);
  assert.equal(attestation.independentReviewExecutionReady.type, "boolean");
  assert.equal(attestation.independentReviewComplete.const, false);
  assert.equal(attestation.accuracyEstablished.const, false);
  assert.equal(attestation.reliabilityEstablished.const, false);
  assert.equal(attestation.clinicalValidation.const, false);
  assert.equal(attestation.productionReleaseAuthorized.const, false);
  assert.equal(attestation.patientUseAuthorized.const, false);
});

test("owner-return evidence cannot claim file receipt, source authority, or production integration", () => {
  assert.equal(integrationReturnSchema.properties.contractVersion.const, "perl-eqpass-owner-return-preflight/1.0");
  assert.equal(integrationReturnSchema.properties.decision.const, "rfi-remains-open");
  assert.equal(integrationReturnSchema.properties.fileBytesReceived.const, false);
  assert.equal(integrationReturnSchema.properties.recordLevelDataReceived.const, false);
  assert.equal(integrationReturnSchema.properties.patientIdentifiersReceived.const, false);
  assert.equal(integrationReturnSchema.properties.rawResponsesReceived.const, false);
  assert.equal(integrationReturnSchema.properties.externalTransferPerformed.const, false);
  assert.equal(integrationReturnSchema.properties.phiApproved.const, false);
  assert.equal(integrationReturnSchema.properties.ownerIdentityVerified.const, false);
  assert.equal(integrationReturnSchema.properties.authoritativeContractAccepted.const, false);
  assert.equal(integrationReturnSchema.properties.scoringLogicAccepted.const, false);
  assert.equal(integrationReturnSchema.properties.productionIntegrationAuthorized.const, false);
  assert.equal(integrationReturnSchema.properties.clinicalUseAuthorized.const, false);
});
