import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assessments, auditSeed } from "../src/demo-data.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { createModelProvider } from "../src/model-provider.js";
import { createDeliveryConnector, DELIVERY_ACK_CONTRACT } from "../src/delivery-gateway.js";
import { INTEGRATION_RETURN_ARTIFACTS, integrationReturnManifestTemplate } from "../src/integration-return.js";
import { modelTrialManifestTemplate } from "../src/model-trial.js";
import { SandboxStore } from "../src/sandbox-store.js";

const pairedRatings = {
  A: { accuracy: 5, restraint: 5, utility: 4 },
  B: { accuracy: 4, restraint: 5, utility: 4 }
};

const syntheticEqpassEvent = JSON.parse(
  await readFile(new URL("../examples/synthetic-eqpass-scored-event.json", import.meta.url), "utf8")
);

function completeModelTrialManifest() {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-STORE-QA";
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

async function fixture({ clock, modelProvider, deliveryConnector } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "perl-store-test-"));
  const filePath = join(directory, "sandbox-state.json");
  const make = () => new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: modelProvider || createModelProvider(),
    ...(deliveryConnector ? { deliveryConnector } : {}),
    ...(clock ? { clock } : {})
  });
  return { directory, filePath, make };
}

test("critical-screen approval is enforced and durable", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  await assert.rejects(() => store.approve("FF-TEST-2407-A"), error => error.status === 409);
  await store.acknowledgeSafety("FF-TEST-2407-A", true, "Test clinician");
  await store.approve("FF-TEST-2407-A", "Test clinician");

  const reopened = make();
  await reopened.init();
  const detail = await reopened.getAssessment("FF-TEST-2407-A");
  assert.equal(detail.review.status, "approved");
  assert.equal(detail.review.safetyAcknowledged, true);
  assert.equal(detail.review.reviewer, "Test clinician");
  assert.ok(detail.audit.some(entry => entry.action === "Draft approved"));
  assert.equal("hypotheses" in detail.assessment, false);
  assert.ok(detail.interpretation.hypotheses.length > 0);
  assert.equal(detail.interpretation.evidenceMode, "scored-constructs");
});

test("approval commits a stable report snapshot and later edits reopen review", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  assert.equal(store.verifyReportArtifactChain().count, 1);

  const beforeApproval = await store.reportSnapshot("FF-TEST-2407-A");
  await store.acknowledgeSafety("FF-TEST-2407-A", true, "Test clinician");
  await store.approve("FF-TEST-2407-A", "Test clinician");
  const approved = await store.reportSnapshot("FF-TEST-2407-A");
  assert.equal(approved.mode, "approved");
  assert.equal(approved.artifact.review.reviewer, "Test clinician");
  assert.equal(approved.artifact.sourceAssessmentHash, beforeApproval.artifact.sourceAssessmentHash);
  assert.equal(store.verifyReportArtifactChain().count, 2);

  const replacement = "Self-report results may indicate a mild pattern that should be clarified through interview, history, functional impact, and protective factors. This does not establish a diagnosis.";
  await store.saveNarrative("FF-TEST-2407-A", "clinician", replacement, "Test clinician");
  const reopened = await store.getAssessment("FF-TEST-2407-A");
  assert.equal(reopened.review.status, "ready");
  assert.equal(reopened.reportArtifact, null);
  assert.equal((await store.reportSnapshot("FF-TEST-2407-A")).mode, "draft");
  assert.equal(store.verifyReportArtifactChain().count, 2);
  assert.notEqual(store.state.reportArtifacts[1].narrative.text, replacement);
});

test("audience handoff edits never reopen the approved clinician artifact", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.approve("FF-TEST-2411-C", "CLINICIAN-APPROVER");
  const approved = await store.getAssessment("FF-TEST-2411-C");
  const artifactId = approved.reportArtifact.id;

  const adminText = "The self-report assessment is complete with all 105 required responses recorded. No deterministic critical-screen hold is present; routine clinician review is still required before release. This administrative routing note contains no clinical interpretation and does not establish a diagnosis.";
  await store.saveNarrative("FF-TEST-2411-C", "admin", adminText, "OPERATIONS-REVIEWER");

  const detail = await store.getAssessment("FF-TEST-2411-C");
  assert.equal(detail.review.status, "approved");
  assert.equal(detail.reportArtifact.id, artifactId);
  assert.equal(detail.narratives.admin.text, adminText);
  assert.ok(detail.audit.some(entry => entry.action === "Audience handoff revised"));

  const handoff = await store.audienceHandoffSnapshot("FF-TEST-2411-C", "admin");
  assert.equal(handoff.audience, "admin");
  assert.equal(handoff.review.status, "approved");
  assert.equal(handoff.sourceAssessmentHash.length, 64);
  await assert.rejects(() => store.audienceHandoffSnapshot("FF-TEST-2411-C", "clinician"), /care, payer, or admin/i);
});

test("report artifact history detects snapshot tampering", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.acknowledgeSafety("FF-TEST-2407-A", true, "Test clinician");
  await store.approve("FF-TEST-2407-A", "Test clinician");

  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.reportArtifacts.at(-1).narrative.text = "Undisclosed altered clinician attachment";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /report artifact integrity/i.test(error.message));
});

test("generated drafts are materialized once and remain stable across reads and restart", async t => {
  const base = createModelProvider();
  let calls = 0;
  const modelProvider = {
    id: base.id,
    version: base.version,
    mode: base.mode,
    describe: () => base.describe(),
    generateCase: async assessment => {
      calls += 1;
      return base.generateCase(assessment);
    }
  };
  const { directory, make } = await fixture({ modelProvider });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  assert.equal(calls, assessments.length);
  const first = await store.getAssessment("FF-TEST-2407-A");
  const second = await store.getAssessment("FF-TEST-2407-A");
  assert.equal(calls, assessments.length);
  assert.equal(first.generation.id, second.generation.id);
  assert.equal(first.generation.outputHash, second.generation.outputHash);
  assert.equal(first.narratives.clinician.generatedAt, second.narratives.clinician.generatedAt);
  assert.equal(first.generationChain.valid, true);
  assert.equal(first.generationChain.active, assessments.length);

  const reopened = make();
  await reopened.init();
  const afterRestart = await reopened.getAssessment("FF-TEST-2407-A");
  assert.equal(calls, assessments.length);
  assert.equal(afterRestart.generation.id, first.generation.id);
  assert.equal(afterRestart.narratives.clinician.generatedAt, first.narratives.clinician.generatedAt);
});

test("generation snapshot content and active mapping are tamper evident", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.generationRecords[0].bundle.narratives.clinician.text = "Undisclosed altered model output";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /generation-snapshot history integrity/i.test(error.message));
});

test("loaded changes require frozen replay before advancing to clinical review", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const proposed = await store.proposeChange({
    component: "report-template",
    baselineVersion: "workspace-print/0.1",
    reason: "Replace the workspace printout with the dedicated versioned clinician attachment."
  }, "GOVERNANCE-01");
  assert.equal(proposed.candidateVersion, "perl-clinician-report/1.0");
  assert.equal(proposed.affectedCases.length, 3);
  await assert.rejects(
    () => store.decideChange(proposed.id, { disposition: "advance-for-clinical-review", note: "Advance the candidate after its safety evidence is complete." }, "GOVERNANCE-01"),
    error => error.status === 409 && /passing replay/i.test(error.message)
  );

  const replayed = await store.replayChange(proposed.id, "GOVERNANCE-01");
  assert.equal(replayed.event.engineeringRegressionPassed, true);
  assert.equal(replayed.event.clinicalValidation, false);
  assert.equal(replayed.event.evidence.outcomes.criticalScreenHandling.denominator, 1);
  const decided = await store.decideChange(proposed.id, {
    disposition: "advance-for-clinical-review",
    note: "Synthetic replay passed. Send the candidate to independent counselor and legal review."
  }, "GOVERNANCE-01");
  assert.equal(decided.candidate.status, "advance-for-clinical-review");
  assert.equal(decided.event.clinicalReleaseAuthorized, false);
  assert.equal(store.verifyChangeEventChain().count, 3);
  await assert.rejects(
    () => store.decideChange(proposed.id, { disposition: "rollback", note: "Do not advance this already decided candidate." }, "GOVERNANCE-01"),
    error => error.status === 409 && /already has a final/i.test(error.message)
  );
});

test("change-control history detects replay evidence tampering", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const proposed = await store.proposeChange({
    component: "model",
    baselineVersion: "cal-0.9.2",
    reason: "Exercise a governed model candidate against the frozen synthetic regression set."
  }, "GOVERNANCE-02");
  await store.replayChange(proposed.id, "GOVERNANCE-02");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.changeEvents.at(-1).evidence.outcomes.evidenceLineage.numerator = 0;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /change-control history integrity/i.test(error.message));
});

test("narrative revisions, feedback, and blind comparisons persist", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const text = "Self-report results may indicate a contained worry-led pattern. Clarify duration, functional impact, context, and protective factors; this does not establish a diagnosis.";
  await store.saveNarrative("FF-TEST-2411-C", "clinician", text, "Clinical tester");
  await store.submitFeedback("FF-TEST-2411-C", { reasons: ["tone"], note: "Keep the uncertainty explicit.", actor: "Clinical tester" });
  await store.submitComparison({ assessmentId: "FF-TEST-2411-C", preferred: "A", accuracy: 5, restraint: 5, utility: 4, actor: "Clinical tester" });

  const reopened = make();
  await reopened.init();
  const detail = await reopened.getAssessment("FF-TEST-2411-C");
  const metrics = await reopened.metrics();
  assert.equal(detail.narratives.clinician.text, text);
  assert.equal(detail.narratives.clinician.source, "reviewer");
  assert.equal(detail.feedback.length, 1);
  assert.equal(metrics.comparisons, 1);
  assert.equal(metrics.preferredA, 100);
});

test("only canonical synthetic fixtures can be imported", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const unsafe = structuredClone(assessments[1]);
  unsafe.id = "real-client-23";
  await assert.rejects(() => store.importAssessment(unsafe), error => error.status === 400 && /synthetic ID/.test(error.message));
});

test("synthetic source-event receipts are durable, hash-linked, and tamper evident", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const imported = await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  assert.equal(imported.status, "imported");
  assert.equal(store.verifySourceEventChain().valid, true);
  assert.equal(store.verifySourceEventChain().count, 1);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifySourceEventChain().valid, true);
  assert.equal((await reopened.listSourceEvents()).events.length, 1);

  const tampered = JSON.parse(await readFile(filePath, "utf8"));
  tampered.sourceEvents[0].scoringVersion = "undisclosed-replacement";
  await writeFile(filePath, JSON.stringify(tampered), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /source-event receipt integrity/i.test(error.message));
});

test("approval automatically prepares one idempotent handoff from source Findings provenance", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "ATTACHMENT-QA");
  await store.approve(assessmentId, "ATTACHMENT-QA");
  let detail = await store.getAssessment(assessmentId);
  assert.equal(detail.attachment.status, "prepared-not-attached");
  assert.equal(detail.workflow.status, "prepared-not-attached");
  assert.equal(detail.workflow.events[0].type, "handoff-prepared");
  assert.equal(detail.workflow.events[1].type, "handoff-queued");
  assert.equal(detail.workflow.events[2].type, "review-queued");
  assert.equal(store.latestReportArtifact(assessmentId).sourceProvenance.findingsReportHash, syntheticEqpassEvent.findingsReport.sha256);

  const request = {
    contractVersion: "eqpass-perl-attachment/rfi-0.1",
    environment: "calibration",
    assessmentId,
    reportArtifactId: detail.reportArtifact.id,
    reportArtifactHash: detail.reportArtifact.hash,
    idempotencyKey: `FF-TEST-AUTO-HANDOFF-${detail.reportArtifact.hash.slice(0, 32).toUpperCase()}`
  };
  const prepared = await store.prepareEqpassAttachment(request, "ATTACHMENT-QA");
  assert.equal(prepared.status, "duplicate");
  assert.equal(prepared.attachment.findingsReportHash, syntheticEqpassEvent.findingsReport.sha256);
  assert.equal(store.verifyAttachmentEventChain().valid, true);
  assert.equal(store.verifyAutomationEventChain().valid, true);
  const outbox = await store.listDeliveryOutbox();
  assert.equal(outbox.connector.enabled, false);
  assert.equal(outbox.connector.externalTransmission, false);
  assert.equal(outbox.counts.packages, 1);
  assert.equal(outbox.counts.awaitingConnector, 1);
  assert.equal(outbox.counts.receipts, 0);
  assert.equal(outbox.chain.valid, true);
  assert.equal(outbox.jobs[0].status, "awaiting-authorized-connector");
  await assert.rejects(() => store.processDeliveryJob(outbox.jobs[0].job.id, "ATTACHMENT-QA"), error => error.status === 409 && /connector is disabled/i.test(error.message));
  assert.equal((await store.prepareEqpassAttachment(request, "ATTACHMENT-QA")).status, "duplicate");

  await store.saveNarrative(
    assessmentId,
    "clinician",
    "Self-report results may indicate a mild pattern that should be clarified through interview, history, functional impact, and protective factors. This does not establish a diagnosis.",
    "ATTACHMENT-QA"
  );
  detail = await store.getAssessment(assessmentId);
  assert.equal(detail.attachment.status, "awaiting-approval");
  assert.equal(detail.attachment.preparation.hash, prepared.attachment.hash);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyAttachmentEventChain().valid, true);
  assert.equal(reopened.verifyAutomationEventChain().valid, true);
  assert.equal(reopened.verifyDeliveryChain().valid, true);
  const tampered = JSON.parse(await readFile(filePath, "utf8"));
  tampered.attachmentEvents[0].findingsReportVersion = "undisclosed-replacement";
  await writeFile(filePath, JSON.stringify(tampered), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /attachment-preparation history integrity/i.test(error.message));
});

test("failed automatic preparation is explicit, retryable, and never duplicates the artifact", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "RETRY-QA");

  const originalPrepare = store.prepareEqpassAttachment.bind(store);
  store.prepareEqpassAttachment = async () => { throw new Error("Injected preparation failure"); };
  await store.approve(assessmentId, "RETRY-QA");
  let detail = await store.getAssessment(assessmentId);
  assert.equal(detail.review.status, "approved");
  assert.equal(detail.workflow.status, "failed");
  assert.equal(detail.attachment.status, "ready-to-prepare");
  assert.equal(store.state.attachmentEvents.length, 0);

  store.prepareEqpassAttachment = originalPrepare;
  const retried = await store.retryProviderWorkflow(assessmentId, "RETRY-QA");
  assert.equal(retried.status, "prepared");
  detail = await store.getAssessment(assessmentId);
  assert.equal(detail.workflow.status, "prepared-not-attached");
  assert.equal(detail.workflow.currentJob.attempt, 2);
  assert.equal(store.state.attachmentEvents.length, 1);
  assert.equal(store.verifyAutomationEventChain().valid, true);
});

test("an explicitly authorized connector records one hash-bound synthetic receipt", async t => {
  let calls = 0;
  let lastRequest;
  const deliveryConnector = createDeliveryConnector({
    connector: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-synthetic-store-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async request => {
      calls += 1;
      lastRequest = request;
      return {
        contractVersion: DELIVERY_ACK_CONTRACT,
        requestId: request.requestId,
        jobId: request.jobId,
        idempotencyKey: request.idempotencyKey,
        environment: "calibration",
        status: "rehearsed-not-attached",
        remoteWriteClaimed: false,
        receiptId: `FF-TEST-ACK-${calls}`,
        receivedAt: "2026-08-13T20:00:00.000Z"
      };
    }
  });
  const { directory, make } = await fixture({ deliveryConnector });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "DELIVERY-QA");
  await store.approve(assessmentId, "DELIVERY-QA");

  let outbox = await store.listDeliveryOutbox();
  assert.equal(outbox.counts.ready, 1);
  assert.equal(outbox.connector.approvalScope, "synthetic-calibration-only");
  const result = await store.processDeliveryJob(outbox.jobs[0].job.id, "DELIVERY-QA");
  assert.equal(result.status, "rehearsed-not-attached");
  assert.equal(result.event.remoteWriteClaimed, false);
  assert.equal(calls, 1);
  assert.equal(lastRequest.environment, "calibration");
  assert.equal(lastRequest.assessmentId.startsWith("FF-TEST-"), true);
  assert.equal(lastRequest.provenance.findingsReportHash, syntheticEqpassEvent.findingsReport.sha256);
  assert.equal(JSON.stringify(lastRequest).includes(syntheticEqpassEvent.sourceAssessment.subjectRef), false);

  outbox = await store.listDeliveryOutbox();
  assert.equal(outbox.counts.receipts, 1);
  assert.equal(outbox.counts.ready, 0);
  assert.equal(outbox.chain.valid, true);
  await assert.rejects(() => store.processDeliveryJob(outbox.jobs[0].job.id, "DELIVERY-QA"), error => error.status === 409 && /ready delivery job/i.test(error.message));
});

test("delivery failures retry explicitly and enter a bounded dead-letter state", async t => {
  const deliveryConnector = createDeliveryConnector({
    connector: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-failure-store-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async () => { throw new Error("secret transport topology"); }
  });
  const { directory, make } = await fixture({ deliveryConnector });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "DELIVERY-QA");
  await store.approve(assessmentId, "DELIVERY-QA");
  const jobId = (await store.listDeliveryOutbox()).jobs[0].job.id;

  assert.equal((await store.processDeliveryJob(jobId, "DELIVERY-QA")).status, "retry-wait");
  assert.equal((await store.retryDeliveryJob(jobId, "DELIVERY-QA")).status, "retry-wait");
  assert.equal((await store.retryDeliveryJob(jobId, "DELIVERY-QA")).status, "dead-lettered");
  const outbox = await store.listDeliveryOutbox();
  assert.equal(outbox.counts.deadLettered, 1);
  assert.equal(outbox.jobs[0].attempt, 3);
  assert.equal(outbox.chain.valid, true);
  assert.equal(JSON.stringify(outbox).includes("secret transport topology"), false);
  await assert.rejects(() => store.retryDeliveryJob(jobId, "DELIVERY-QA"), error => error.status === 409 && /dead-lettered jobs require a new governed connector decision/i.test(error.message));
});

test("startup recovers an interrupted delivery attempt without assuming a remote write", async t => {
  const deliveryConnector = createDeliveryConnector({
    connector: "structured-candidate",
    authorization: {
      status: "approved-for-synthetic-calibration",
      connectorId: "eqpass-recovery-store-test",
      connectorVersion: "rfi-fixed-v1",
      approvedBy: "INTEGRATION-QA"
    },
    transport: async () => { throw new Error("The simulated process ended before transport completed."); }
  });
  const { directory, make } = await fixture({ deliveryConnector });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "RECOVERY-QA");
  await store.approve(assessmentId, "RECOVERY-QA");
  const job = store.state.deliveryJobs[0];
  const connector = deliveryConnector.describe();
  store.appendDeliveryEvent({
    type: "delivery-attempted",
    status: "in-flight",
    jobId: job.id,
    jobHash: job.hash,
    assessmentId: job.assessmentId,
    reportArtifactHash: job.reportArtifactHash,
    attachmentReceiptHash: job.attachmentReceiptHash,
    attempt: 1,
    connectorId: connector.id,
    connectorVersion: connector.version,
    connectorMode: connector.mode,
    requestHash: "a".repeat(64),
    origin: "operator-action",
    actor: "RECOVERY-QA",
    note: "Simulated persisted attempt immediately before an unexpected process interruption for recovery verification."
  });
  await store.persist();

  const reopened = make();
  await reopened.init();
  const recovered = (await reopened.listDeliveryOutbox()).jobs[0];
  assert.equal(recovered.status, "retry-wait");
  assert.equal(recovered.attempt, 1);
  assert.equal(recovered.currentEvent.errorCode, "DELIVERY_INTERRUPTED");
  assert.equal(recovered.currentEvent.origin, "startup-recovery");
  assert.equal(reopened.verifyDeliveryChain().valid, true);
});

test("delivery outbox history fails closed when a job or event is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "DELIVERY-QA");
  await store.approve(assessmentId, "DELIVERY-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.deliveryJobs[0].renderedContentHash = "0".repeat(64);
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /delivery-outbox history integrity/i.test(error.message));
});

test("isolated recovery rehearsal reconciles the full synthetic state and removes its copy", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const before = store.recordCounts();

  const result = await store.rehearseRecovery("RECOVERY-QA");
  assert.equal(result.status, "verified");
  assert.equal(result.productionRecoveryClaimed, false);
  assert.equal(result.rpo.status, "decision-required");
  assert.equal(result.rto.status, "decision-required");
  assert.equal(result.event.sourceFileHash, result.event.restoredFileHash);
  assert.equal(result.event.sourceStateDigest, result.event.restoredStateDigest);
  assert.deepEqual(result.event.recordCounts, before);
  assert.equal(result.event.reconciledRecords, before.total);
  assert.equal(result.event.ledgerCount, 47);
  assert.ok(Object.values(result.event.verification).every(Boolean));
  assert.equal(result.event.verification.isolatedCopyRemoved, true);
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.verified, 1);

  const reopened = make();
  await reopened.init();
  assert.equal((await reopened.recoveryStatus()).status, "verified");
  assert.equal(reopened.verifyRecoveryEventChain().valid, true);
});

test("failed restore rehearsals are sanitized, durable, and do not become recovery claims", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  store.createRecoveryStore = () => ({
    init: async () => { throw new Error("integrity check failed: secret internal path /private/client.json"); }
  });

  const result = await store.rehearseRecovery("RECOVERY-QA");
  assert.equal(result.status, "failed");
  assert.equal(result.productionRecoveryClaimed, false);
  assert.equal(result.event.errorCode, "RESTORE_INTEGRITY_REJECTED");
  assert.equal(result.event.verification.isolatedCopyRemoved, true);
  assert.equal(JSON.stringify(result.event).includes("secret internal path"), false);
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.failed, 1);
  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyRecoveryEventChain().valid, true);
});

test("recovery evidence fails closed when reconciliation counts are altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.rehearseRecovery("RECOVERY-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.recoveryEvents[0].recordCounts.assessments = 999;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /recovery-rehearsal history integrity/i.test(error.message));
});

test("local rollback rehearsal verifies the sealed baseline without changing the application", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.rehearseRecovery("RECOVERY-QA");

  const result = await store.rehearseRollbackCompatibility("ROLLBACK-QA");
  assert.equal(result.status, "verified-local-compatibility");
  assert.equal(result.productionRollbackPerformed, false);
  assert.equal(result.deployableArtifactRestored, false);
  assert.equal(result.clinicalReleaseAuthorized, false);
  assert.equal(result.baseline.artifactRepository, "working-tree-only");
  assert.equal(result.baseline.deployableArtifactAvailable, false);
  assert.equal(result.event.sourceFileCount, 153);
  assert.ok(result.event.sourceFiles.every(file => file.match));
  assert.ok(Object.values(result.event.verification).every(Boolean));
  assert.equal(result.event.productionRollbackPerformed, false);
  assert.equal(result.event.deployableArtifactRestored, false);
  assert.equal(result.event.clinicalReleaseAuthorized, false);
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.verified, 1);

  const reopened = make();
  await reopened.init();
  assert.equal((await reopened.rollbackStatus()).status, "verified-local-compatibility");
  assert.equal(reopened.verifyRollbackEventChain().valid, true);
});

test("rollback source drift fails closed with bounded evidence", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.rehearseRecovery("RECOVERY-QA");
  const realReader = store.readRollbackFile.bind(store);
  store.readRollbackFile = async path => {
    if (path === "src/engine.js") throw new Error("secret build path /private/deployment/client-A");
    return realReader(path);
  };

  const result = await store.rehearseRollbackCompatibility("ROLLBACK-QA");
  assert.equal(result.status, "failed");
  assert.equal(result.event.errorCode, "ROLLBACK_COMPATIBILITY_FAILED");
  assert.equal(result.event.verification.sourceFilesMatch, false);
  assert.equal(result.event.sourceFiles.find(file => file.path === "src/engine.js").actualHash, null);
  assert.equal(JSON.stringify(result.event).includes("secret build path"), false);
  assert.equal(result.event.productionRollbackPerformed, false);
  assert.equal(result.chain.valid, true);
});

test("rollback evidence fails startup when a pinned source result is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.rehearseRecovery("RECOVERY-QA");
  await store.rehearseRollbackCompatibility("ROLLBACK-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.rollbackEvents[0].sourceFiles[0].match = false;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /application-rollback history integrity/i.test(error.message));
});

test("operational probe records a durable point-in-time control matrix without production claims", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let status = await store.operationalMonitoringStatus();
  assert.equal(status.status, "local-attention-required");
  assert.equal(status.current.productionGaps.length, 3);
  assert.equal(status.current.signals.filter(signal => signal.scope === "local").length, 8);

  await store.rehearseRecovery("MONITORING-QA");
  await store.rehearseRollbackCompatibility("MONITORING-QA");
  const result = await store.recordOperationalMonitoringSnapshot("MONITORING-QA");
  assert.equal(result.status, "local-controls-clear");
  assert.equal(result.event.actor, "MONITORING-QA");
  assert.equal(result.event.continuousMonitoringClaimed, false);
  assert.equal(result.event.productionAlertingConnected, false);
  assert.equal(result.event.availabilitySlaClaimed, false);
  assert.equal(result.event.latencySloClaimed, false);
  assert.equal(result.event.productionBackupMonitoring, false);
  assert.equal(result.event.securityMonitoringConnected, false);
  assert.equal(result.event.externalNotificationsSent, false);
  assert.equal(result.event.signalCounts.pass, 8);
  assert.equal(result.event.signalCounts.unavailable, 3);
  assert.deepEqual(result.event.localAlerts, []);
  assert.ok(result.event.signals.filter(signal => signal.scope === "local").every(signal => signal.status === "pass"));
  assert.ok(result.event.signals.filter(signal => signal.scope === "production-gap").every(signal => signal.status === "unavailable"));
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.clear, 1);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyMonitoringEventChain().valid, true);
  assert.equal((await reopened.operationalMonitoringStatus()).lastEvent.hash, result.event.hash);
});

test("operational probe turns a stopping safety event into local alert evidence without sending it", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.reportIncident({
    category: "diagnostic-overreach",
    severity: "high",
    summary: "Synthetic stopping event for monitoring verification."
  }, "MONITORING-QA");
  const result = await store.recordOperationalMonitoringSnapshot("MONITORING-QA");
  const signal = result.event.signals.find(item => item.id === "safety-routing");
  assert.equal(result.status, "local-attention-required");
  assert.equal(signal.status, "attention");
  assert.equal(signal.severity, "critical");
  assert.deepEqual(result.event.localAlerts.find(alert => alert.signalId === "safety-routing"), {
    signalId: "safety-routing",
    severity: "critical",
    state: "open-local-evidence",
    externalNotificationSent: false
  });
  assert.equal(result.event.externalNotificationsSent, false);
  assert.equal(result.chain.valid, true);
});

test("operational monitoring history fails closed when a recorded signal is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordOperationalMonitoringSnapshot("MONITORING-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.monitoringEvents[0].signals[0].detail = "Undisclosed operational evidence change";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /operational-monitoring history integrity/i.test(error.message));
});

test("incident-response rehearsal links current continuity evidence without performing production actions", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let status = await store.incidentResponseStatus();
  assert.equal(status.readyToRehearse, false);
  await assert.rejects(() => store.rehearseIncidentResponse("critical-safety-routing", "RESPONSE-QA"), error => error.status === 409);

  await store.rehearseRecovery("RESPONSE-QA");
  await store.rehearseRollbackCompatibility("RESPONSE-QA");
  await store.recordOperationalMonitoringSnapshot("RESPONSE-QA");
  store.state.schemaVersion = 32;
  assert.equal(store.responsePrerequisites().find(item => item.id === "monitoring").status, "required");
  store.state.schemaVersion = 49;
  const result = await store.rehearseIncidentResponse("critical-safety-routing", "RESPONSE-QA");
  assert.equal(result.status, "tabletop-complete");
  assert.equal(result.event.scenarioId, "critical-safety-routing");
  assert.equal(result.event.severity, "SEV1");
  assert.equal(result.event.phases.length, 4);
  assert.ok(Object.values(result.event.verification).every(Boolean));
  assert.equal(result.event.stopAuthorityAssigned, false);
  assert.equal(result.event.notificationTreeConnected, false);
  assert.equal(result.event.externalNotificationsSent, false);
  assert.equal(result.event.productionIncidentDeclared, false);
  assert.equal(result.event.productionServiceStopped, false);
  assert.equal(result.event.clinicalRestartAuthorized, false);
  assert.equal(result.chain.valid, true);
  assert.equal(result.chain.completed, 1);

  const reopened = make();
  await reopened.init();
  status = await reopened.incidentResponseStatus();
  assert.equal(status.lastEvent.hash, result.event.hash);
  assert.equal(reopened.verifyResponseDrillEventChain().valid, true);
});

test("incident-response rehearsal rejects unknown scenarios and fails closed after evidence tampering", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await assert.rejects(() => store.rehearseIncidentResponse("invented-response", "RESPONSE-QA"), error => error.status === 400);
  await store.rehearseRecovery("RESPONSE-QA");
  await store.rehearseRollbackCompatibility("RESPONSE-QA");
  await store.recordOperationalMonitoringSnapshot("RESPONSE-QA");
  await store.rehearseIncidentResponse("artifact-integrity-failure", "RESPONSE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.responseDrillEvents[0].productionServiceStopped = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /incident-response rehearsal history integrity/i.test(error.message));
});

test("pilot-readiness dossier consolidates local evidence while every external permission remains open", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  let status = await store.pilotReadinessStatus();
  assert.equal(status.status, "pilot-authorization-blocked");
  assert.deepEqual(status.current.gateCounts, { localCurrent: 2, localRequired: 5, externalDecisionRequired: 7, total: 14 });
  assert.deepEqual(status.current.authorityCounts, { confirmed: 1, provisional: 1, unassigned: 8, total: 10 });
  assert.ok(status.current.gates.filter(gate => gate.category === "external-authority").every(gate => gate.evidenceHash === null && gate.productionAccepted === false));

  await store.importEqpassEvent(syntheticEqpassEvent, "READINESS-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "READINESS-QA");
  await store.approve(assessmentId, "READINESS-QA");
  await store.rehearseRecovery("READINESS-QA");
  await store.rehearseRollbackCompatibility("READINESS-QA");
  await store.recordOperationalMonitoringSnapshot("READINESS-QA");
  await store.rehearseIncidentResponse("artifact-integrity-failure", "READINESS-QA");

  status = await store.recordPilotReadinessSnapshot("READINESS-QA");
  assert.deepEqual(status.current.gateCounts, { localCurrent: 7, localRequired: 0, externalDecisionRequired: 7, total: 14 });
  assert.equal(status.event.decision, "pilot-authorization-blocked");
  assert.equal(status.event.productionReadinessClaimed, false);
  assert.equal(status.event.externalApprovalsRecorded, false);
  assert.equal(status.event.productionOwnersAssigned, false);
  assert.equal(status.event.pilotAuthorizationRecorded, false);
  assert.equal(status.event.clinicalReleaseAuthorized, false);
  assert.equal(status.chain.valid, true);
  assert.equal(status.chain.blocked, 1);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyReadinessEventChain().valid, true);
  assert.equal((await reopened.pilotReadinessStatus()).lastEvent.hash, status.event.hash);
});

test("pilot-readiness history fails closed when permission claims are altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordPilotReadinessSnapshot("READINESS-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.readinessEvents[0].pilotAuthorizationRecorded = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /pilot-readiness snapshot history integrity/i.test(error.message));
});

test("provider-workflow history fails closed when a committed event is removed", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.automationEvents = [];
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /provider-workflow history integrity/i.test(error.message));
});

test("schema-v12 source and attachment history migrates into explicit workflow baselines", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.importEqpassEvent(syntheticEqpassEvent, "INTEGRATION-QA");
  const assessmentId = syntheticEqpassEvent.sourceAssessment.assessmentRef;
  await store.acknowledgeSafety(assessmentId, true, "MIGRATION-QA");
  await store.approve(assessmentId, "MIGRATION-QA");
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 12;
  delete legacy.automationEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.equal(reopened.verifyAutomationEventChain().valid, true);
  assert.equal(reopened.verifyAutomationEventChain().migrationBaselines, 3);
  assert.ok(reopened.state.automationEvents.every(item => item.origin === "schema-v13-baseline"));
  assert.match(reopened.state.automationEvents[0].note, /does not prove pre-migration automation/i);
  assert.equal(reopened.verifyGenerationEventChain().valid, true);
  assert.equal(reopened.verifyGenerationEventChain().migrationSnapshots, 4);
  assert.equal(reopened.verifyDeliveryChain().valid, true);
  assert.equal(reopened.verifyDeliveryChain().migrationBaselines, 1);
  assert.equal(reopened.state.deliveryJobs.length, 1);
});

test("version-one state migrates interpretation out of stored assessments", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const legacy = {
    schemaVersion: 1,
    environment: "synthetic-sandbox",
    assessments: [{ ...structuredClone(assessments[0]), hypotheses: [{ title: "legacy" }], questions: ["legacy"] }],
    reviews: {},
    narratives: {},
    feedback: [],
    comparisons: [],
    audit: {}
  };
  await writeFile(filePath, JSON.stringify(legacy), "utf8");
  const store = make();
  await store.init();
  assert.equal(store.state.schemaVersion, 49);
  assert.equal("hypotheses" in store.state.assessments[0], false);
  assert.equal("questions" in store.state.assessments[0], false);
  assert.deepEqual(store.state.revisions, []);
  assert.deepEqual(store.state.feedbackEvents, []);
  assert.deepEqual(store.state.incidentEvents, []);
  assert.deepEqual(store.state.comparisonEvents, []);
  assert.deepEqual(store.state.reportArtifacts, []);
  assert.deepEqual(store.state.changeEvents, []);
  assert.deepEqual(store.state.sourceEvents, []);
  assert.deepEqual(store.state.attachmentEvents, []);
  assert.deepEqual(store.state.automationEvents, []);
  assert.equal(store.state.generationRecords.length, 1);
  assert.equal(store.state.generationEvents.length, 1);
  assert.equal(store.verifyGenerationEventChain().migrationSnapshots, 1);
  assert.deepEqual(store.state.deliveryJobs, []);
  assert.deepEqual(store.state.deliveryEvents, []);
  assert.deepEqual(store.state.recoveryEvents, []);
  assert.deepEqual(store.state.rollbackEvents, []);
  assert.deepEqual(store.state.monitoringEvents, []);
  assert.deepEqual(store.state.responseDrillEvents, []);
  assert.deepEqual(store.state.readinessEvents, []);
  assert.deepEqual(store.state.clinicalStandardDrafts, []);
  assert.deepEqual(store.state.clinicalStandardEvents, []);
  assert.deepEqual(store.state.independentReviewEvents, []);
  assert.deepEqual(store.state.integrationReturnEvents, []);
  assert.deepEqual(store.state.activeDeliveries, {});
  assert.deepEqual(store.state.pendingTimingTasks, {});
  assert.deepEqual(store.state.timingObservations, []);
  assert.deepEqual(store.state.timingEvents, []);
});

test("reviewer edits form a durable tamper-evident revision chain", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const narrative = "Self-report suggests a mild worry-led pattern that may warrant clarification of duration, context, functional impact, and protective factors; this does not establish a diagnosis.";
  await store.saveNarrative("FF-TEST-2411-C", "clinician", narrative, "Clinical tester");
  const detail = await store.getAssessment("FF-TEST-2411-C");
  const interpretation = structuredClone(detail.interpretation);
  interpretation.questions.push("Which contexts make the reported worry feel more or less manageable?");
  await store.saveInterpretation("FF-TEST-2411-C", interpretation, "Clinical tester");

  const reopened = make();
  await reopened.init();
  const after = await reopened.getAssessment("FF-TEST-2411-C");
  assert.equal(after.revisionChain.valid, true);
  assert.equal(after.revisionChain.count, 2);
  assert.equal(after.revisions.length, 2);
  assert.equal(after.revisions[0].previousHash, after.revisions[1].hash);
  assert.equal(after.revisions[0].kind, "interpretation");
  assert.ok(after.revisions[1].change.changedTokens > 0);

  const tampered = JSON.parse(await readFile(filePath, "utf8"));
  tampered.revisions[0].after.text = "Undisclosed altered text";
  await writeFile(filePath, JSON.stringify(tampered), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /integrity check failed/i.test(error.message));
});

test("clinical-standard drafts persist as immutable linked versions without creating approval", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const input = {
    thresholds: {
      minimumBlindPreferenceRate: 65,
      minimumMedianAccuracy: 4.2,
      minimumMedianRestraint: 4.4,
      minimumMedianUtility: 4,
      maximumMaterialCorrectionsPer100: 8,
      minimumPreferenceAgreementAc1: 0.7,
      maximumMedianAssistedMinutes: 9.5
    },
    rationale: "These working thresholds keep preference separate from evidence fidelity, restraint, correction burden, agreement, workflow time, and zero-tolerance safety failures."
  };
  const first = await store.recordClinicalStandardDraft(input, "STANDARD-QA");
  assert.equal(first.draft.version, 1);
  assert.equal(first.draft.preOutcomeCandidate, true);
  assert.equal(first.clinicalStandard.clinicalLeadApproved, false);
  assert.equal(first.clinicalStandard.protocolFrozen, false);
  assert.equal(first.clinicalStandard.patientUseAuthorized, false);

  const second = await store.recordClinicalStandardDraft({ ...input, thresholds: { ...input.thresholds, minimumMedianUtility: 4.3 }, rationale: `${input.rationale} Version two raises the usefulness floor for discussion.` }, "STANDARD-QA");
  assert.equal(second.draft.version, 2);
  assert.notEqual(second.draft.hash, first.draft.hash);
  assert.equal(second.event.previousHash, first.event.hash);

  const reopened = make();
  await reopened.init();
  const status = await reopened.clinicalStandardStatus();
  assert.equal(status.latestDraft.version, 2);
  assert.equal(status.history.length, 2);
  assert.equal(status.chain.valid, true);
  assert.equal(status.chain.count, 2);
  assert.equal(reopened.recordCounts().clinicalStandardDrafts, 2);
  assert.equal(reopened.integritySnapshot().clinicalStandard.valid, true);
});

test("clinical-standard drafts are permanently labeled post-outcome when reviewer evidence already exists", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.submitFeedback("FF-TEST-2411-C", { reasons: ["tone"], note: "Structured evidence exists before the standard draft.", actor: "STANDARD-QA" });
  const result = await store.recordClinicalStandardDraft({
    thresholds: { minimumBlindPreferenceRate: 60, minimumMedianAccuracy: 4, minimumMedianRestraint: 4, minimumMedianUtility: 4, maximumMaterialCorrectionsPer100: 10, minimumPreferenceAgreementAc1: 0.65, maximumMedianAssistedMinutes: 10 },
    rationale: "This standard was drafted after structured reviewer evidence existed, so it must remain labeled post-outcome regardless of the thresholds selected."
  }, "STANDARD-QA");
  assert.equal(result.draft.preOutcomeCandidate, false);
  assert.equal(result.draft.evidenceAtDraft.counts.structuredFeedbackEntries, 1);
  assert.match(result.event.note, /permanently labeled post-outcome/i);
});

test("clinical-standard startup integrity rejects a modified immutable draft", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordClinicalStandardDraft({
    thresholds: { minimumBlindPreferenceRate: 60, minimumMedianAccuracy: 4, minimumMedianRestraint: 4, minimumMedianUtility: 4, maximumMaterialCorrectionsPer100: 10, minimumPreferenceAgreementAc1: 0.65, maximumMedianAssistedMinutes: 10 },
    rationale: "This is a sufficient working rationale for the immutable clinical-standard integrity tamper test and no approval claim."
  }, "STANDARD-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.clinicalStandardDrafts[0].rationale += " altered";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /clinical-standard draft history integrity/i.test(error.message));
});

test("independent-review dossier seals reproducible local evidence without recording outside authority", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const before = await store.independentReviewStatus();
  assert.equal(before.gateCounts.externalAccepted, 0);
  assert.equal(before.gateCounts.externalDecisionRequired, 6);
  assert.equal(before.sourceWorkbooksConnected, false);
  assert.equal(before.independentEvaluatorNamed, false);
  assert.equal(before.independentReviewComplete, false);

  const result = await store.sealIndependentReviewDossier("INDEPENDENT-QA");
  assert.equal(result.event.sequence, 1);
  assert.equal(result.event.decision, "independent-review-not-authorized");
  assert.equal(result.event.accuracyEstablished, false);
  assert.equal(result.event.reliabilityEstablished, false);
  assert.equal(result.event.clinicalValidation, false);
  assert.equal(result.independentReview.chain.valid, true);
  assert.equal(result.independentReview.chain.count, 1);

  const reopened = make();
  await reopened.init();
  const after = await reopened.independentReviewStatus();
  assert.equal(after.latestSeal.hash, result.event.hash);
  assert.equal(after.sealHistory.length, 1);
  assert.equal(reopened.recordCounts().independentReviewEvents, 1);
  assert.equal(reopened.integritySnapshot().independentReview.valid, true);
});

test("independent-review dossier history fails closed when a permission claim is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.sealIndependentReviewDossier("INDEPENDENT-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.independentReviewEvents[0].independentReviewComplete = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /independent-review dossier history integrity/i.test(error.message));
});

test("independent-review admission stays closed until its sealed dossier, reference freeze, standard, and seven-key registry are current", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const admission = await store.independentReviewAdmissionStatus();
  assert.equal(store.state.schemaVersion, 49);
  assert.equal(admission.status, "sealed-independent-review-dossier-required");
  assert.equal(admission.counts.verifiedExternalDuties, 0);
  assert.equal(admission.independentReviewExecutionReady, false);
  assert.equal(admission.independentReviewComplete, false);
  assert.equal(admission.accuracyEstablished, false);
  assert.equal(admission.clinicalValidation, false);
  assert.equal(store.recordCounts().independentReviewAdmissionEvents, 0);
  assert.equal(store.integritySnapshot().independentReviewAdmission.valid, true);
  await assert.rejects(() => store.issueIndependentReviewAdmissionChallenge("ADMISSION-QA"), error => error.status === 409 && /seven current, distinct/i.test(error.message));
});

test("e-QPASS owner-return preflight persists metadata without receiving source files or authority", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-STORE-001";
  manifest.artifacts = manifest.artifacts.map((artifact, index) => ({
    ...artifact,
    status: "metadata-declared-unverified",
    version: `candidate-${index + 1}`,
    sha256: "c".repeat(64),
    mediaType: INTEGRATION_RETURN_ARTIFACTS[index].expectedMediaType,
    dataClass: INTEGRATION_RETURN_ARTIFACTS[index].expectedDataClass
  }));

  const result = await store.preflightIntegrationReturnManifest(manifest, "RETURN-QA");
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.counts.metadataComplete, 8);
  assert.equal(result.event.decision, "rfi-remains-open");
  assert.equal(result.event.fileBytesReceived, false);
  assert.equal(result.event.ownerIdentityVerified, false);
  assert.equal(result.event.authoritativeContractAccepted, false);
  assert.equal(result.integrationReturn.chain.valid, true);

  const reopened = make();
  await reopened.init();
  const status = await reopened.integrationReturnStatus();
  assert.equal(status.latestPreflight.hash, result.event.hash);
  assert.equal(status.authoritativeContractAccepted, false);
  assert.equal(reopened.recordCounts().integrationReturnEvents, 1);
  assert.equal(reopened.integritySnapshot().integrationReturn.valid, true);
});

test("e-QPASS owner-return preflight history fails closed when authority is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-STORE-002";
  await store.preflightIntegrationReturnManifest(manifest, "RETURN-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.integrationReturnEvents[0].authoritativeContractAccepted = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /owner-return preflight history integrity/i.test(error.message));
});

test("counselor notebook persists structured rehearsal evidence without inventing a session or clinical decision", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const result = await store.recordCounselorNotebookEntry({
    sessionId: "language-safety",
    decisionId: "indicator-language",
    disposition: "revise-before-next-rehearsal",
    finding: "overreach-risk",
    evidenceSource: "synthetic-regression",
    assessmentId: "FF-TEST-2407-A"
  }, "NOTEBOOK-QA");
  assert.equal(result.entry.sequence, 1);
  assert.equal(result.entry.evidenceSnapshot.sourceContractStatus, "proposed-rfi-only");
  assert.equal(result.entry.counselorIdentityVerified, false);
  assert.equal(result.entry.attendanceRecorded, false);
  assert.equal(result.entry.trainingCompleted, false);
  assert.equal(result.entry.clinicalDecisionAccepted, false);
  assert.equal(result.entry.protocolFrozen, false);
  assert.equal(result.counselorNotebook.metrics.notesRecorded, 1);
  assert.equal(result.counselorNotebook.metrics.decisionsCovered, 1);
  assert.equal(result.counselorNotebook.chain.valid, true);

  const reopened = make();
  await reopened.init();
  const status = await reopened.counselorNotebookStatus();
  assert.equal(status.history[0].hash, result.entry.hash);
  assert.equal(status.sessions[0].decisions[0].status, "revise-before-next-rehearsal");
  assert.equal(reopened.recordCounts().counselorNotebookEntries, 1);
  assert.equal(reopened.integritySnapshot().counselorNotebook.valid, true);
});

test("counselor notebook history fails closed when session authority is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordCounselorNotebookEntry({
    sessionId: "usefulness-workflow",
    decisionId: "next-conversation-utility",
    disposition: "defer-awaiting-evidence",
    finding: "needs-more-evidence",
    evidenceSource: "blind-outcome-ledger",
    assessmentId: null
  }, "NOTEBOOK-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.counselorNotebookEntries[0].clinicalDecisionAccepted = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /counselor session notebook history integrity/i.test(error.message));
});

test("Progress Review persists a structured raw-score observation without creating a progress claim", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const before = await store.progressReviewStatus();
  assert.deepEqual(before.scales.map(scale => scale.delta), [-39, -15, -12, -73]);
  assert.equal(before.authoritativeSubjectLinkage, false);
  assert.equal(before.improvementEstablished, false);
  const result = await store.recordProgressReviewObservation({
    seriesId: "FF-TEST-SERIES-01",
    focus: "cross-domain-pattern",
    finding: "raw-score-lower",
    disposition: "clarify-context-before-interpretation"
  }, "PROGRESS-QA");
  assert.equal(result.event.sequence, 1);
  assert.equal(result.event.type, "synthetic-progress-rehearsal-observation-recorded");
  assert.equal(result.event.authoritativeSubjectLinkage, false);
  assert.equal(result.event.clinicalProgressEstablished, false);
  assert.equal(result.event.improvementEstablished, false);
  assert.equal(result.event.treatmentResponseEstablished, false);
  assert.equal(result.progressReview.metrics.observationsRecorded, 1);
  assert.equal(result.progressReview.chain.valid, true);

  const reopened = make();
  await reopened.init();
  const status = await reopened.progressReviewStatus();
  assert.equal(status.history[0].hash, result.event.hash);
  assert.equal(reopened.recordCounts().progressReviewEvents, 1);
  assert.equal(reopened.integritySnapshot().progressReview.valid, true);
});

test("Progress Review history fails closed when a denied clinical claim is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordProgressReviewObservation({
    seriesId: "FF-TEST-SERIES-01",
    focus: "anxiety",
    finding: "raw-score-lower",
    disposition: "carry-to-next-conversation"
  }, "PROGRESS-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.progressReviewEvents[0].improvementEstablished = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /Progress Review history integrity/i.test(error.message));
});

test("reviewer returns form a durable refinement brief and pin eligible evidence to change control", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.submitFeedback("FF-TEST-2407-A", { reasons: ["overreach"], note: "Keep the narrative qualified.", actor: "COUNSELOR-01" });
  await store.submitFeedback("FF-TEST-2388-B", { reasons: ["overreach"], note: "Avoid conclusions beyond the score.", actor: "COUNSELOR-01" });
  await store.submitFeedback("FF-TEST-2411-C", { reasons: ["overreach"], note: "Preserve diagnostic restraint.", actor: "COUNSELOR-02" });

  const brief = await store.refinementBrief();
  const signal = brief.signals.find(item => item.id === "feedback:overreach");
  assert.equal(brief.integrity.sources.feedback.valid, true);
  assert.equal(brief.integrity.sources.feedback.count, 3);
  assert.equal(signal.candidateEligible, true);
  assert.equal(signal.caseIds.length, 3);
  assert.equal(signal.reviewers.length, 2);

  const proposed = await store.proposeChange({
    component: "model",
    baselineVersion: "cal-0.9.2",
    reason: "Strengthen qualified language and replay diagnostic-restraint invariants.",
    refinementSignalIds: [signal.id]
  }, "GOVERNANCE-01");
  assert.equal(proposed.refinementEvidence.contract, "perl-refinement-brief/1.0");
  assert.equal(proposed.refinementEvidence.signalSnapshots[0].id, signal.id);
  assert.equal(proposed.refinementEvidence.signalSnapshots[0].signalHash.length, 64);
  assert.equal(proposed.refinementEvidence.clinicalValidation, false);
});

test("reviewer-feedback evidence tampering fails closed", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.submitFeedback("FF-TEST-2411-C", { reasons: ["tone"], note: "Use a more neutral clinical register.", actor: "COUNSELOR-01" });
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.feedback[0].note = "Undisclosed altered reviewer evidence";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /feedback history integrity/i.test(error.message));
});

test("schema-v11 reviewer feedback migrates into an explicit integrity baseline", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.submitFeedback("FF-TEST-2411-C", { reasons: ["usefulness"], note: "Clarify what the counselor should verify next.", actor: "COUNSELOR-01" });
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 11;
  delete legacy.feedbackEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.equal(reopened.verifyFeedbackEventChain().valid, true);
  assert.equal(reopened.verifyFeedbackEventChain().legacyBaselines, 1);
  assert.equal(reopened.state.feedbackEvents[0].type, "legacy-baseline");
  assert.match(reopened.state.feedbackEvents[0].note, /does not prove pre-migration immutability/i);
});

test("study exports are synthetic, provenance-rich, and spreadsheet-safe", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison("Clinical tester");
  await store.submitComparison({
    caseId: comparisonCase.caseId,
    preferred: "A",
    ratings: pairedRatings,
    actor: "Clinical tester",
    comment: '=HYPERLINK("https://example.test","unsafe")'
  });
  const studyPackage = await store.exportStudyPackage();
  assert.equal(studyPackage.manifest.clinicalValidation, false);
  assert.equal(studyPackage.manifest.revisionChain.valid, true);
  assert.equal(studyPackage.manifest.feedbackEventChain.valid, true);
  assert.equal(studyPackage.manifest.comparisonChain.valid, true);
  assert.equal(studyPackage.manifest.comparisonChain.count, 1);
  assert.equal(studyPackage.manifest.reportArtifactChain.valid, true);
  assert.equal(studyPackage.manifest.reportArtifactChain.count, 1);
  assert.equal(studyPackage.reportArtifacts.length, 1);
  assert.equal(studyPackage.manifest.changeEventChain.valid, true);
  assert.deepEqual(studyPackage.changeEvents, []);
  assert.equal(studyPackage.manifest.sourceEventChain.valid, true);
  assert.equal(studyPackage.manifest.attachmentEventChain.valid, true);
  assert.equal(studyPackage.manifest.providerWorkflowEventChain.valid, true);
  assert.equal(studyPackage.manifest.generationEventChain.valid, true);
  assert.deepEqual(studyPackage.attachmentEvents, []);
  assert.deepEqual(studyPackage.automationEvents, []);
  assert.equal(studyPackage.generationRecords.length, assessments.length);
  assert.equal(studyPackage.generationEvents.length, assessments.length);
  assert.equal(studyPackage.manifest.caseSet.id, calibrationManifest.id);
  assert.equal(studyPackage.manifest.caseSet.manifestHash.length, 64);
  assert.equal(studyPackage.caseSetManifest.holdoutValid, false);
  assert.equal(studyPackage.comparisonEvents.length, 1);
  assert.equal(studyPackage.cases.length, assessments.length);
  assert.equal(studyPackage.refinementBrief.contract, "perl-refinement-brief/1.0");
  assert.deepEqual(studyPackage.feedbackEvents, []);
  assert.equal(studyPackage.integrity.algorithm, "sha256");
  assert.equal(studyPackage.integrity.packageHash.length, 64);
  assert.equal("pendingComparisons" in studyPackage, false);

  const csv = await store.exportComparisonsCsv();
  assert.match(csv, /"preferred_author"/);
  assert.match(csv, /"perl_accuracy"/);
  assert.match(csv, /"counselor_accuracy"/);
  assert.match(csv, /"case_set_id"/);
  assert.match(csv, new RegExp(calibrationManifest.id));
  assert.match(csv, /"'=HYPERLINK/);
});

test("structured interpretation revisions persist with provenance and change tracking", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const before = await store.getAssessment("FF-TEST-2411-C");
  const revised = structuredClone(before.interpretation);
  revised.hypotheses[0].body = "The mild anxiety pattern may be led by apprehension and distributed across interpersonal and physiological constructs. Clarify persistence, triggers, avoidance, context, and functional impact in interview.";
  revised.questions.push("What would meaningful improvement look like to the person over the next few weeks?");
  const saved = await store.saveInterpretation("FF-TEST-2411-C", revised, "Clinical tester");
  assert.equal(saved.source, "reviewer");
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.changed, ["hypotheses", "follow-up questions"]);

  const reopened = make();
  await reopened.init();
  const after = await reopened.getAssessment("FF-TEST-2411-C");
  assert.equal(after.interpretation.actor, "Clinical tester");
  assert.equal(after.interpretation.questions.at(-1), revised.questions.at(-1));
  assert.ok(after.audit.some(entry => entry.action === "Interpretation revised"));
  assert.equal((await after).interpretation.evidenceMode, "scored-constructs");
});

test("blind calibration hides author mapping until a one-time case is submitted", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison();
  assert.equal(comparisonCase.protocol, "blind-v3");
  assert.equal(comparisonCase.caseSet.id, calibrationManifest.id);
  assert.ok(["development", "holdout"].includes(comparisonCase.partition));
  assert.ok(comparisonCase.strata.length > 0);
  assert.equal("mapping" in comparisonCase, false);
  assert.ok(comparisonCase.summaries.A.text.length > 40);
  assert.ok(comparisonCase.summaries.B.text.length > 40);

  await assert.rejects(
    () => store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: { A: pairedRatings.A } }),
    error => error.status === 400 && /Summary B rating/i.test(error.message)
  );
  assert.equal((await store.nextComparison()).caseId, comparisonCase.caseId);

  const result = await store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings });
  assert.ok(["human-reference", "perl-generated"].includes(result.reveal.A));
  assert.equal(result.reveal.preferredAuthor, result.reveal.A);
  const metrics = await store.metrics();
  assert.equal(metrics.preferredPerl, result.reveal.preferredAuthor === "perl-generated" ? 100 : 0);
  assert.equal(metrics.meanAccuracy, 5);
  await assert.rejects(
    () => store.submitComparison({ caseId: comparisonCase.caseId, preferred: "B", accuracy: 4, restraint: 4, utility: 4 }),
    error => error.status === 409
  );
});

test("a reviewer resumes one pending blind case and cannot submit another reviewer's case", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const reviewerA = await store.nextComparison("REVIEWER-A");
  const resumed = await store.nextComparison("REVIEWER-A");
  const reviewerB = await store.nextComparison("REVIEWER-B");
  assert.equal(resumed.caseId, reviewerA.caseId);
  assert.notEqual(reviewerB.caseId, reviewerA.caseId);
  assert.equal(Object.keys(store.state.pendingComparisons).length, 2);

  await assert.rejects(
    () => store.submitComparison({ caseId: reviewerA.caseId, preferred: "A", accuracy: 4, restraint: 4, utility: 4, actor: "REVIEWER-B" }),
    error => error.status === 409 && /different reviewer/i.test(error.message)
  );
  const submitted = await store.submitComparison({ caseId: reviewerA.caseId, preferred: "A", ratings: pairedRatings, actor: "REVIEWER-A" });
  assert.equal(submitted.comparison.actor, "REVIEWER-A");
});

test("blind assignments survive a workday restart while active timing tasks retain a short expiry", async t => {
  let now = new Date("2026-08-13T12:00:00.000Z");
  const clock = () => new Date(now);
  const { directory, make } = await fixture({ clock });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparison = await store.nextComparison("REVIEWER-DAY");
  await store.nextTimingTask("TIMING-DAY");
  assert.equal(Object.keys(store.state.pendingComparisons).length, 1);
  assert.equal(Object.keys(store.state.pendingTimingTasks).length, 1);

  now = new Date("2026-08-13T17:00:00.000Z");
  const sameDay = make();
  await sameDay.init();
  assert.equal(Object.keys(sameDay.state.pendingComparisons).length, 1);
  assert.equal(Object.keys(sameDay.state.pendingTimingTasks).length, 0);
  assert.equal((await sameDay.nextComparison("REVIEWER-DAY")).caseId, comparison.caseId);

  now = new Date("2026-08-14T13:00:01.000Z");
  const nextDay = make();
  await nextDay.init();
  assert.equal(Object.keys(nextDay.state.pendingComparisons).length, 0);
});

test("assignment balances case coverage, prevents reviewer repeats, and creates overlap", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  for (const actor of ["REVIEWER-A", "REVIEWER-B"]) {
    const assigned = [];
    for (let index = 0; index < assessments.length; index += 1) {
      const comparisonCase = await store.nextComparison(actor);
      assigned.push(comparisonCase.assessmentId);
      assert.equal(comparisonCase.reviewerProgress.completed, index);
      assert.equal(comparisonCase.reviewerProgress.available, assessments.length);
      await store.submitComparison({ caseId: comparisonCase.caseId, preferred: index % 2 ? "B" : "A", ratings: pairedRatings, actor });
    }
    assert.equal(new Set(assigned).size, assessments.length);
    await assert.rejects(
      () => store.nextComparison(actor),
      error => error.status === 409 && /completed every synthetic calibration case/i.test(error.message)
    );
  }

  const perlA = store.state.comparisons.filter(item => item.authorMapping.A === "perl-generated").length;
  const perlB = store.state.comparisons.filter(item => item.authorMapping.B === "perl-generated").length;
  assert.ok(Math.abs(perlA - perlB) <= 1);
  const analysis = await store.calibrationAnalysis();
  assert.equal(analysis.sample.overlappedCases, assessments.length);
  assert.equal(analysis.sample.reviewerPairs, assessments.length);
  assert.equal(analysis.agreement.ready, false);
  assert.equal(analysis.caseSet.cases, assessments.length);
  assert.equal(analysis.caseSet.ready, false);
  assert.deepEqual(analysis.caseSet.missingStrata, ["low-signal"]);
  assert.equal(analysis.caseSet.partitionCoverage.development.reviewedCases, 2);
  assert.equal(analysis.caseSet.partitionCoverage.holdout.reviewedCases, 1);
  assert.equal(analysis.caseSet.stratumCoverage["critical-screen"].reviewedCases, 1);
});

test("high-severity incidents pause the study until a documented resolution", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison("SAFETY-LEAD");
  const reported = await store.reportIncident({
    assessmentId: comparisonCase.assessmentId,
    caseId: comparisonCase.caseId,
    category: "critical-screen-omission",
    severity: "high",
    summary: "Critical-screen routing was absent from the displayed summary.",
    detail: "Synthetic rehearsal event used to verify the stopping rule."
  }, "SAFETY-LEAD");
  assert.equal(reported.control.state, "paused");
  assert.equal(reported.chain.valid, true);
  assert.equal(reported.incident.status, "open");
  await assert.rejects(() => store.nextComparison("REVIEWER-B"), error => error.status === 423 && /paused/i.test(error.message));
  await assert.rejects(
    () => store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, actor: "SAFETY-LEAD" }),
    error => error.status === 423 && /paused/i.test(error.message)
  );

  const resolved = await store.resolveIncident(reported.incident.id, "Routing was restored and the frozen synthetic regression set passed.", "CLINICAL-LEAD");
  assert.equal(resolved.incident.status, "resolved");
  assert.equal(resolved.control.state, "active");
  const submitted = await store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, actor: "SAFETY-LEAD" });
  assert.equal(submitted.comparison.protocol, "blind-v3");
  const analysis = await store.calibrationAnalysis();
  assert.equal(analysis.safety.highSeverityReported, 1);
  assert.equal(analysis.safety.unresolvedHighSeverity, 0);
});

test("safety incident events form a tamper-evident linked chain", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.reportIncident({
    category: "blind-integrity",
    severity: "moderate",
    summary: "Blind mapping required a documented integrity review."
  }, "STUDY-LEAD");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.incidentEvents[0].summary = "Undisclosed altered incident";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /incident history integrity/i.test(error.message));
});

test("server timing discounts recorded study pauses and preserves timing provenance", async t => {
  let now = new Date("2026-08-13T16:00:00.000Z");
  const clock = () => new Date(now);
  const { directory, make } = await fixture({ clock });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison("TIMING-01");
  now = new Date("2026-08-13T16:02:00.000Z");
  const incident = await store.reportIncident({
    assessmentId: comparisonCase.assessmentId,
    category: "blind-integrity",
    severity: "high",
    summary: "Blind mapping required a timed integrity pause during review."
  }, "TIMING-01");
  now = new Date("2026-08-13T16:07:00.000Z");
  await store.resolveIncident(incident.incident.id, "Mapping integrity was verified and the synthetic review could resume.", "TIMING-01");
  now = new Date("2026-08-13T16:15:00.000Z");
  const result = await store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, actor: "TIMING-01" });
  assert.deepEqual(result.comparison.reviewTiming, {
    assignedAt: "2026-08-13T16:00:00.000Z",
    submittedAt: "2026-08-13T16:15:00.000Z",
    rawSeconds: 900,
    pausedSeconds: 300,
    activeSeconds: 600,
    eligible: true,
    flag: null,
    measurement: "server-wall-clock-v1"
  });
  const analysis = await store.calibrationAnalysis();
  assert.equal(analysis.timing.captured, 1);
  assert.equal(analysis.timing.protocolEligibleMinutes.median, 10);
  assert.equal(analysis.timing.pausedSeconds, 300);
  const csv = await store.exportComparisonsCsv();
  assert.match(csv, /"active_seconds"/);
  assert.match(csv, /"server-wall-clock-v1"/);
});

test("workflow timing balances conditions, prevents reviewer carryover, and commits matched evidence", async t => {
  let now = new Date("2026-08-13T16:00:00.000Z");
  const clock = () => new Date(now);
  const { directory, filePath, make } = await fixture({ clock });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  const reviewerA = await store.nextTimingTask("TIMING-A");
  const resumedA = await store.nextTimingTask("TIMING-A");
  const reviewerB = await store.nextTimingTask("TIMING-B");
  assert.equal(resumedA.taskId, reviewerA.taskId);
  assert.equal(reviewerB.assessmentId, reviewerA.assessmentId);
  assert.notEqual(reviewerB.condition, reviewerA.condition);
  assert.equal(reviewerA.sourceProfile.projection, "scored-profile-v1");
  assert.equal(reviewerA.sourceProfile.scales.length, 9);
  assert.ok(reviewerA.sourceProfile.subscales.length >= 8);
  assert.equal(reviewerA.condition === "unaided", reviewerA.initialDraft === null);
  assert.equal(reviewerB.condition === "unaided", reviewerB.initialDraft === null);
  await assert.rejects(
    () => store.submitTimingTask({ taskId: reviewerA.taskId, finalSummary: reviewerA.initialDraft || "Self-report scores may indicate a pattern that requires clarification of context, duration, functioning, and safety; this does not establish a diagnosis." }, "TIMING-B"),
    error => error.status === 409 && /different reviewer/i.test(error.message)
  );

  const summaryFor = task => task.initialDraft || "Self-report scores may indicate a contained pattern that should be clarified through direct interview, history, functional impact, contextual stressors, protective factors, and routine safety verification; these indicators do not establish a diagnosis.";
  now = new Date("2026-08-13T16:10:00.000Z");
  const submittedA = await store.submitTimingTask({ taskId: reviewerA.taskId, finalSummary: summaryFor(reviewerA) }, "TIMING-A");
  now = new Date("2026-08-13T16:18:00.000Z");
  const submittedB = await store.submitTimingTask({ taskId: reviewerB.taskId, finalSummary: summaryFor(reviewerB) }, "TIMING-B");
  assert.equal(submittedA.observation.reviewTiming.eligible, true);
  assert.equal(submittedB.observation.reviewTiming.eligible, true);
  assert.equal(submittedA.observation.condition === "unaided", submittedA.observation.provider === null);
  assert.equal(submittedB.observation.condition === "unaided", submittedB.observation.provider === null);
  assert.equal(store.verifyTimingEventChain().valid, true);
  assert.equal(store.verifyTimingEventChain().count, 2);

  const analysis = await store.calibrationAnalysis();
  assert.equal(analysis.workflowTiming.conditions.unaided.eligible, 1);
  assert.equal(analysis.workflowTiming.conditions["perl-assisted"].eligible, 1);
  assert.equal(analysis.workflowTiming.matchedCases, 1);
  assert.equal(Math.abs(analysis.workflowTiming.matchedDifferenceMinutes.median), 8);
  assert.equal(analysis.workflowTiming.ready, false);
  assert.match(analysis.workflowTiming.interpretation, /No time-saving claim/i);
  const csv = await store.exportWorkflowTimingCsv();
  assert.match(csv, /"condition"/);
  assert.match(csv, /"server-wall-clock-v1"/);
  assert.equal(csv.includes("pendingTimingTasks"), false);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyTimingEventChain().valid, true);
  const tampered = JSON.parse(await readFile(filePath, "utf8"));
  tampered.timingObservations[0].finalSummary = "Undisclosed altered timing output";
  await writeFile(filePath, JSON.stringify(tampered), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /workflow-timing history integrity/i.test(error.message));
});

test("blind outcomes form a linked ledger that detects rating or timing tampering", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison("INTEGRITY-01");
  await store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, actor: "INTEGRITY-01" });
  assert.deepEqual(store.verifyComparisonChain(), {
    valid: true,
    count: 1,
    failedAt: null,
    head: store.state.comparisonEvents[0].hash,
    legacyBaselines: 0
  });

  const tampered = JSON.parse(await readFile(filePath, "utf8"));
  tampered.comparisons[0].reviewTiming.activeSeconds = 999;
  await writeFile(filePath, JSON.stringify(tampered), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /blind outcome history integrity/i.test(error.message));
});

test("schema-v5 comparisons migrate into explicit outcome, report, change-control, source-event, attachment, and timing baselines", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const comparisonCase = await store.nextComparison("MIGRATION-01");
  await store.submitComparison({ caseId: comparisonCase.caseId, preferred: "A", ratings: pairedRatings, actor: "MIGRATION-01" });
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 5;
  delete legacy.comparisonEvents;
  await writeFile(filePath, JSON.stringify(legacy), "utf8");

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.equal(reopened.verifyComparisonChain().valid, true);
  assert.equal(reopened.verifyComparisonChain().legacyBaselines, 1);
  assert.equal(reopened.state.comparisonEvents[0].type, "legacy-baseline");
  assert.match(reopened.state.comparisonEvents[0].note, /does not prove pre-migration immutability/i);
  assert.equal(reopened.verifyReportArtifactChain().valid, true);
  assert.equal(reopened.verifyReportArtifactChain().legacyBaselines, 1);
  assert.equal(reopened.state.reportArtifacts[0].type, "legacy-baseline");
  assert.match(reopened.state.reportArtifacts[0].note, /does not prove pre-baseline immutability/i);
  assert.deepEqual(reopened.state.changeEvents, []);
  assert.deepEqual(reopened.state.sourceEvents, []);
  assert.deepEqual(reopened.state.attachmentEvents, []);
  assert.deepEqual(reopened.state.automationEvents, []);
  assert.equal(reopened.state.generationRecords.length, assessments.length);
  assert.equal(reopened.verifyGenerationEventChain().migrationSnapshots, assessments.length);
  assert.deepEqual(reopened.state.pendingTimingTasks, {});
  assert.deepEqual(reopened.state.timingObservations, []);
  assert.deepEqual(reopened.state.timingEvents, []);
  assert.deepEqual(reopened.state.feedbackEvents, []);
});

test("model trial preflights exactly three metadata candidates without selecting or contacting an engine", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  let status = await store.modelTrialStatus();
  assert.equal(status.status, "awaiting-candidate-metadata");
  assert.deepEqual(status.counts, {
    slotsRequired: 3,
    candidatesDeclared: 0,
    metadataComplete: 0,
    missing: 3,
    domainEvidenceRequired: 18,
    domainEvidenceDeclared: 0
  });
  assert.equal(status.baselineRole, "engineering comparator-not-shortlist-candidate");
  assert.equal(status.engineSelected, false);
  assert.equal(status.externalTransferPerformed, false);

  const result = await store.preflightModelTrialManifest(completeModelTrialManifest(), "MODEL-TRIAL-STORE-QA");
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.counts.metadataComplete, 3);
  assert.equal(result.event.counts.domainEvidenceDeclared, 18);
  assert.equal(result.event.decision, "engine-selection-not-authorized");
  assert.equal(result.event.vendorClaimsVerified, false);
  assert.equal(result.event.securityApproved, false);
  assert.equal(result.event.clinicalPerformanceEstablished, false);
  assert.equal(result.event.engineSelected, false);
  assert.equal(result.event.externalTransferPerformed, false);
  assert.equal(result.modelTrial.status, "metadata-complete-external-review-required");
  assert.equal(result.modelTrial.chain.valid, true);

  const reopened = make();
  await reopened.init();
  status = await reopened.modelTrialStatus();
  assert.equal(status.history.length, 1);
  assert.equal(status.latestPreflight.hash, result.event.hash);
  assert.equal(reopened.verifyModelTrialPreflightChain().valid, true);
  assert.equal(reopened.integritySnapshot().modelTrial.head, result.event.hash);
});

test("model trial history fails closed when an authority claim is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.preflightModelTrialManifest(completeModelTrialManifest(), "MODEL-TRIAL-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.modelTrialEvents[0].engineSelected = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /model-trial preflight history integrity/i.test(error.message));
});

test("candidate trial foundry predeclares nine held runs and records a non-authorizing planning snapshot", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  let status = await store.candidateTrialStatus();
  assert.equal(status.status, "awaiting-candidate-metadata");
  assert.equal(status.runEnvelopes.length, 9);
  assert.equal(status.blindCells.length, 12);
  assert.equal(status.measures.length, 6);
  assert.equal(status.gates.length, 7);
  assert.equal(status.counts.gatesLocallySatisfied, 2);
  assert.equal(status.providerCallPerformed, false);
  assert.equal(status.trialExecutionAuthorized, false);
  assert.equal(status.engineSelected, false);

  const result = await store.recordCandidateTrialSnapshot("TRIAL-STORE-QA");
  assert.equal(result.event.type, "candidate-trial-planning-snapshot-recorded");
  assert.equal(result.event.counts.candidateRunsPlanned, 9);
  assert.equal(result.event.counts.blindCellsPlanned, 12);
  assert.equal(result.event.counts.candidateOutputsReceived, 0);
  assert.equal(result.event.providerCallPerformed, false);
  assert.equal(result.event.trialExecutionAuthorized, false);
  assert.equal(result.candidateTrial.chain.valid, true);

  const reopened = make();
  await reopened.init();
  status = await reopened.candidateTrialStatus();
  assert.equal(status.history.length, 1);
  assert.equal(status.latestSnapshot.hash, result.event.hash);
  assert.equal(reopened.verifyCandidateTrialSnapshotChain().valid, true);
  assert.equal(reopened.integritySnapshot().candidateTrial.head, result.event.hash);
});

test("candidate trial planning history fails closed when execution authority is altered", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordCandidateTrialSnapshot("TRIAL-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.candidateTrialEvents[0].trialExecutionAuthorized = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /candidate-trial planning history integrity/i.test(error.message));
});

test("intended-use registry records immutable provider-first drafts without external acceptance", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  let status = await store.intendedUseStatus();
  assert.equal(status.status, "definition-required-before-legal-review");
  assert.equal(status.counts.audiences, 4);
  assert.equal(status.counts.prohibitedUses, 8);
  assert.equal(status.counts.acceptancesRequired, 5);
  assert.equal(status.counts.acceptancesRecorded, 0);

  const result = await store.recordIntendedUseDraft({
    pilotContext: "point-of-care-review",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review at the start of a care conversation. The summary remains an additional page beside the unchanged Findings report.",
    rationale: "This provider-first scope addresses the proposal's interpretation step while preserving e-QPASS score authority, accountable human review, and role-specific disclosure boundaries."
  }, "INTENDED-USE-QA");
  assert.equal(result.event.type, "intended-use-draft-recorded");
  assert.equal(result.event.acceptancesRequired, 5);
  assert.equal(result.event.acceptancesRecorded, 0);
  assert.equal(result.event.legalApproved, false);
  assert.equal(result.event.intendedUseFrozen, false);
  assert.equal(result.draft.evidenceSnapshot.reportContract, "perl-clinician-report/1.0");
  assert.equal(result.draft.evidenceSnapshot.modelInputContract, "perl-scored-profile/1.0");
  assert.equal(result.intendedUse.chain.valid, true);

  const reopened = make();
  await reopened.init();
  status = await reopened.intendedUseStatus();
  assert.equal(status.history.length, 1);
  assert.equal(status.latestDraft.hash, result.draft.hash);
  assert.equal(reopened.verifyIntendedUseEventChain().valid, true);
  assert.equal(reopened.integritySnapshot().intendedUse.head, result.event.hash);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("intended-use history fails closed when legal approval is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordIntendedUseDraft({
    pilotContext: "session-preparation",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review before a care conversation. The summary remains an additional page beside the unchanged Findings report.",
    rationale: "This is a bounded provider workflow proposal that preserves scored-source authority, deterministic safety routing, accountable human review, and role-specific disclosure."
  }, "INTENDED-USE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.intendedUseEvents[0].legalApproved = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /intended-use draft history integrity/i.test(error.message));
});

test("language review office seals exact live copy without recording external acceptance", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();

  let status = await store.languageReviewStatus();
  assert.equal(status.status, "intended-use-required");
  assert.equal(status.counts.copySurfaces, 9);
  await assert.rejects(() => store.sealLanguageReviewPacket("LANGUAGE-STORE-QA"), error => error.status === 409);

  await store.recordIntendedUseDraft({
    pilotContext: "point-of-care-review",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review at the start of a care conversation. The summary remains an additional page beside the unchanged Findings report.",
    rationale: "This provider-first scope preserves e-QPASS score authority, accountable human review, deterministic critical-screen routing, and role-specific disclosure boundaries."
  }, "LANGUAGE-STORE-QA");
  status = await store.languageReviewStatus();
  assert.equal(status.status, "review-packet-ready-unaccepted");

  const result = await store.sealLanguageReviewPacket("LANGUAGE-STORE-QA");
  assert.equal(result.event.type, "language-review-packet-sealed");
  assert.equal(result.packet.surfaces.length, 9);
  assert.equal(result.packet.reviewQuestions.length, 6);
  assert.equal(result.packet.requiredAcceptances.length, 5);
  assert.equal(result.packet.legalApproved, false);
  assert.equal(result.packet.languageFrozen, false);
  assert.equal(result.packet.patientUseAuthorized, false);
  assert.equal(result.languageReview.status, "review-packet-sealed-unaccepted");

  const reopened = make();
  await reopened.init();
  status = await reopened.languageReviewStatus();
  assert.equal(status.history.length, 1);
  assert.equal(status.latestPacket.hash, result.packet.hash);
  assert.equal(reopened.verifyLanguageReviewEventChain().valid, true);
  assert.equal(reopened.integritySnapshot().languageReview.head, result.event.hash);
  assert.equal(reopened.recordCounts().languageReviewPackets, 1);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("language review history fails closed when legal approval is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordIntendedUseDraft({
    pilotContext: "session-preparation",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review before a care conversation. The summary remains an additional page beside the unchanged Findings report.",
    rationale: "This bounded provider workflow preserves authoritative scores, human judgment, deterministic safety routing, and audience-specific disclosure boundaries."
  }, "LANGUAGE-STORE-QA");
  await store.sealLanguageReviewPacket("LANGUAGE-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.languageReviewEvents[0].legalApproved = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /language-review packet history integrity/i.test(error.message));
});

test("Decision Exchange persists complete metadata without accepting an external decision", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let exchange = await store.decisionExchangeStatus();
  assert.equal(exchange.packets.length, 7);
  assert.equal(exchange.counts.currentPreflights, 0);
  assert.equal(exchange.counts.gatesClosed, 0);
  const packet = exchange.packets[0];
  const manifest = structuredClone(packet.returnTemplate);
  manifest.returnId = "FF-DECISION-STORE-001";
  manifest.decision = "accept";
  manifest.decisionRecordReference = "FF-DECISION-RECORD-STORE-001";
  manifest.decidedAt = "2026-08-14T18:20:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-STORE-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-STORE-${index + 1}`, status: "declared-unverified" }));
  const result = await store.preflightDecisionReturn(manifest, "DECISION-STORE-QA");
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.decisionPreview, "accept");
  assert.equal(result.event.identityVerified, false);
  assert.equal(result.event.authorityVerified, false);
  assert.equal(result.event.externalAcceptanceRecorded, false);
  assert.equal(result.event.gateAccepted, false);
  assert.equal(result.decisionExchange.counts.completeUnverified, 1);
  assert.equal(result.decisionExchange.counts.gatesClosed, 0);

  const reopened = make();
  await reopened.init();
  exchange = await reopened.decisionExchangeStatus();
  assert.equal(exchange.history.length, 1);
  assert.equal(exchange.chain.valid, true);
  assert.equal(reopened.verifyDecisionExchangeEventChain().head, result.event.hash);
  assert.equal(reopened.integritySnapshot().decisionExchange.head, result.event.hash);
  assert.equal(reopened.recordCounts().decisionExchangeEvents, 1);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("Decision Exchange history fails closed when gate acceptance is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const exchange = await store.decisionExchangeStatus();
  const manifest = structuredClone(exchange.packets[1].returnTemplate);
  manifest.returnId = "FF-DECISION-STORE-EMPTY-001";
  await store.preflightDecisionReturn(manifest, "DECISION-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.decisionExchangeEvents[0].gateAccepted = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /Decision Exchange preflight history integrity/i.test(error.message));
});

test("pilot operations persists Dolores's provider-first working plan without authorizing a site", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let plan = await store.pilotOperationsStatus();
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.counts.sourceReportedCaseload, 50);
  assert.equal(plan.counts.workingMonths, 10);
  assert.equal(plan.counts.admissionGates, 7);
  assert.equal(plan.siteVerified, false);
  assert.equal(plan.pilotAuthorized, false);
  const result = await store.recordPilotOperationsSnapshot("PILOT-STORE-QA");
  assert.equal(result.event.status, "source-plan-assembled-external-authorization-required");
  assert.equal(result.event.authorityVerified, false);
  assert.equal(result.event.agreementExecuted, false);
  assert.equal(result.event.trainingCompleted, false);
  assert.equal(result.event.pilotAuthorized, false);
  assert.equal(result.event.outcomeEstablished, false);
  assert.equal(result.pilotOperations.latestSnapshot.current, true);

  const reopened = make();
  await reopened.init();
  plan = await reopened.pilotOperationsStatus();
  assert.equal(plan.history.length, 1);
  assert.equal(plan.chain.valid, true);
  assert.equal(reopened.verifyPilotOperationsSnapshotChain().head, result.event.hash);
  assert.equal(reopened.integritySnapshot().pilotOperations.head, result.event.hash);
  assert.equal(reopened.recordCounts().pilotOperationsEvents, 1);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("pilot-operations history fails closed when a launch claim is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordPilotOperationsSnapshot("PILOT-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.pilotOperationsEvents[0].pilotStarted = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /pilot-operations planning history integrity/i.test(error.message));
});

test("provider activation persists a rehearsal workbook without inventing training completion", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let workbook = await store.providerActivationStatus();
  assert.equal(workbook.modules.length, 4);
  assert.equal(workbook.objectives.length, 8);
  assert.equal(workbook.drills.length, 4);
  assert.equal(workbook.counts.workingMinutes, 100);
  assert.equal(workbook.counts.registeredParticipants, 0);
  assert.equal(workbook.counts.acceptedCompletions, 0);
  assert.equal(workbook.trainingScheduled, false);
  assert.equal(workbook.sessionHeld, false);
  assert.equal(workbook.activationAuthorized, false);
  const result = await store.recordProviderActivationSnapshot("ACTIVATION-STORE-QA");
  assert.equal(result.event.status, "working-activation-plan-external-training-acceptance-required");
  assert.equal(result.event.attendanceVerified, false);
  assert.equal(result.event.drillsPassed, false);
  assert.equal(result.event.completionAccepted, false);
  assert.equal(result.event.activationAuthorized, false);
  assert.equal(result.providerActivation.latestSnapshot.current, true);

  const reopened = make();
  await reopened.init();
  workbook = await reopened.providerActivationStatus();
  assert.equal(workbook.history.length, 1);
  assert.equal(workbook.chain.valid, true);
  assert.equal(reopened.verifyProviderActivationSnapshotChain().head, result.event.hash);
  assert.equal(reopened.integritySnapshot().providerActivation.head, result.event.hash);
  assert.equal(reopened.recordCounts().providerActivationEvents, 1);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("provider-activation history fails closed when completion is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  await store.recordProviderActivationSnapshot("ACTIVATION-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.providerActivationEvents[0].completionAccepted = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /provider-activation workbook history integrity/i.test(error.message));
});

test("site admission persists complete metadata without verifying or authorizing a site", async t => {
  const { directory, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  let portfolio = await store.siteAdmissionStatus();
  assert.equal(portfolio.dossiers.length, 2);
  assert.equal(portfolio.counts.admissionBooks, 6);
  assert.equal(portfolio.counts.admissionQuestions, 12);
  assert.equal(portfolio.counts.requiredAuthorities, 5);
  assert.equal(portfolio.counts.sitesVerified, 0);
  assert.equal(portfolio.authorizationRecorded, false);
  const dossier = portfolio.dossiers[0];
  const manifest = structuredClone(dossier.returnTemplate);
  manifest.returnId = "FF-DECISION-SITE-STORE-RETURN-001";
  manifest.decision = "do-not-authorize";
  manifest.decisionRecordReference = "FF-DECISION-SITE-STORE-DECLINE-001";
  manifest.decidedAt = "2026-08-14T22:40:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-SITE-STORE-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-SITE-STORE-${index + 1}`, status: "declared-unverified" }));
  const result = await store.preflightSiteAdmissionReturn(manifest, "SITE-STORE-QA");
  assert.equal(result.event.status, "metadata-complete-unverified");
  assert.equal(result.event.metadataChecklistComplete, true);
  assert.equal(result.event.siteIdentityVerified, false);
  assert.equal(result.event.authorityVerified, false);
  assert.equal(result.event.authorizationRecorded, false);
  assert.equal(result.event.pilotAuthorized, false);
  assert.equal(result.event.pilotStarted, false);
  assert.equal(result.siteAdmission.dossiers[0].latestPreflight.current, true);

  const reopened = make();
  await reopened.init();
  portfolio = await reopened.siteAdmissionStatus();
  assert.equal(portfolio.history.length, 1);
  assert.equal(portfolio.chain.valid, true);
  assert.equal(reopened.verifySiteAdmissionEventChain().head, result.event.hash);
  assert.equal(reopened.integritySnapshot().siteAdmission.head, result.event.hash);
  assert.equal(reopened.recordCounts().siteAdmissionEvents, 1);
  assert.equal(reopened.state.schemaVersion, 49);
});

test("site-admission history fails closed when pilot authority is invented", async t => {
  const { directory, filePath, make } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = make();
  await store.init();
  const portfolio = await store.siteAdmissionStatus();
  const manifest = structuredClone(portfolio.dossiers[0].returnTemplate);
  manifest.returnId = "FF-DECISION-SITE-TAMPER-RETURN-001";
  await store.preflightSiteAdmissionReturn(manifest, "SITE-STORE-QA");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.siteAdmissionEvents[0].pilotAuthorized = true;
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => make().init(), error => error.status === 500 && /site-admission return history integrity/i.test(error.message));
});
