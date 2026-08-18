import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import {
  CANDIDATE_RETURN_BOUNDARY,
  CANDIDATE_RETURN_CONTRACT,
  buildCandidateReturnDesk,
  candidateReturnBundleHash,
  createCandidateReturnEvent,
  validateCandidateReturnContract,
  validateCandidateReturnEvent,
  validateCandidateReturnManifest
} from "../src/candidate-return.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { GENERATION_OUTPUT_CONTRACT, GENERATION_POLICY_HASH, GENERATION_POLICY_VERSION } from "../src/model-gateway.js";
import { projectModelInput } from "../src/model-input.js";
import { createModelProvider } from "../src/model-provider.js";
import { modelTrialManifestTemplate } from "../src/model-trial.js";
import { SandboxStore } from "../src/sandbox-store.js";

function bundleFor(assessment) {
  const input = projectModelInput(assessment);
  return {
    narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(input, audience)])),
    interpretation: generateClinicalInterpretation(input)
  };
}

function fixture() {
  const protocolFingerprint = "a".repeat(64);
  const candidates = [0, 1, 2].map(index => ({
    id: `candidate-0${index + 1}`,
    status: "candidate-metadata-complete-unverified",
    fingerprint: String(index + 1).repeat(64),
    providerId: `provider-${index + 1}`,
    modelVersion: `model-${index + 1}.0`
  }));
  const runEnvelopes = candidates.flatMap((candidate, candidateIndex) => assessments.map((assessment, caseIndex) => ({
    runId: `FF-CANDIDATE-RUN-${String(candidateIndex * 3 + caseIndex + 1).padStart(2, "0")}`,
    candidateSlot: candidate.id,
    caseId: assessment.id,
    caseFingerprint: String(candidateIndex * 3 + caseIndex + 4).repeat(64)
  })));
  const modelTrial = { candidates, counts: { metadataComplete: 3 } };
  const candidateTrial = { protocolFingerprint, runEnvelopes };
  const desk = buildCandidateReturnDesk({ candidateTrial, modelTrial, generatedAt: "2026-08-14T12:00:00.000Z" });
  return { desk, modelTrial, candidateTrial };
}

function completedManifest(desk, indexes = [0]) {
  const manifest = structuredClone(desk.requestTemplate);
  manifest.returns = indexes.map(index => ({
    ...manifest.returns[index],
    promptVersion: "manual-test-prompt/1.0",
    bundle: bundleFor(assessments.find(item => item.id === manifest.returns[index].caseId))
  }));
  return manifest;
}

function completeModelTrialManifest() {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-RETURN-QA";
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
      evidenceRef: `FF-EVIDENCE-RETURN-C${candidateIndex + 1}-D${domainIndex + 1}`
    }))
  }));
  return manifest;
}

test("candidate-return contract fixes the manual synthetic boundary", () => {
  assert.equal(CANDIDATE_RETURN_CONTRACT, "perl-manual-candidate-return/1.0");
  assert.deepEqual(validateCandidateReturnContract(), []);
  assert.match(CANDIDATE_RETURN_BOUNDARY, /does not send the scored case/i);
  assert.match(CANDIDATE_RETURN_BOUNDARY, /stored without being rendered/i);
  assert.match(CANDIDATE_RETURN_BOUNDARY, /does not .*select an engine/i);
});

test("return desk exposes nine current envelopes without output content or authority", () => {
  const { desk } = fixture();
  assert.equal(desk.status, "ready-for-manual-synthetic-returns");
  assert.equal(desk.runs.length, 9);
  assert.equal(desk.counts.candidateMetadataComplete, 3);
  assert.equal(desk.counts.currentReturnsReceived, 0);
  assert.equal(desk.counts.outputGatesRequired, 10);
  assert.equal(desk.counts.providerCallsPerformedByPerl, 0);
  assert.equal(desk.runs.every(run => run.outputContentRendered === false && !("bundle" in run)), true);
  assert.equal(desk.outputContentRendered, false);
  assert.equal(desk.blindReviewAuthorized, false);
  assert.equal(desk.trialExecutionAuthorized, false);
  assert.equal(desk.engineSelected, false);
});

test("one through nine exact structured returns pass while rebinding, extras, or PHI fail closed", () => {
  const { desk } = fixture();
  const assessmentsById = Object.fromEntries(assessments.map(item => [item.id, item]));
  const manifest = completedManifest(desk, [0, 1, 2]);
  assert.deepEqual(validateCandidateReturnManifest(manifest, { desk, assessmentsById }), []);

  const rebound = structuredClone(manifest);
  rebound.returns[0].candidateFingerprint = "f".repeat(64);
  assert.ok(validateCandidateReturnManifest(rebound, { desk, assessmentsById }).some(error => /candidateFingerprint does not match/i.test(error)));

  const secret = structuredClone(manifest);
  secret.apiKey = "forbidden";
  assert.ok(validateCandidateReturnManifest(secret, { desk, assessmentsById }).some(error => /outside the return contract/i.test(error)));

  const phi = structuredClone(manifest);
  phi.privacyBoundary.phiIncluded = true;
  assert.ok(validateCandidateReturnManifest(phi, { desk, assessmentsById }).some(error => /phiIncluded must remain false/i.test(error)));

  const malformed = structuredClone(manifest);
  malformed.returns[0].bundle.narratives.clinician = "too short";
  assert.ok(validateCandidateReturnManifest(malformed, { desk, assessmentsById }).some(error => /clinician/i.test(error)));
});

test("accepted returns become hash-linked, non-authorizing immutable events", () => {
  const { desk } = fixture();
  const item = completedManifest(desk).returns[0];
  const event = createCandidateReturnEvent({
    returnItem: item,
    actor: "MODEL-TRIAL-QA",
    sequence: 1,
    createdAt: "2026-08-14T12:30:00.000Z"
  });
  const assessment = assessments.find(value => value.id === item.caseId);
  assert.deepEqual(validateCandidateReturnEvent(event, { assessment }), []);
  assert.equal(event.bundleHash, candidateReturnBundleHash(item.bundle));
  assert.equal(event.outputGatePassed, true);
  assert.equal(event.outputGateCount, 10);
  assert.equal(event.candidateRunExternallyVerified, false);
  assert.equal(event.accuracyEstablished, false);
  assert.equal(event.engineSelected, false);
  assert.equal(event.patientUseAuthorized, false);

  const tampered = structuredClone(event);
  tampered.bundle.narratives.care += " Altered after receipt.";
  assert.ok(validateCandidateReturnEvent(tampered, { assessment }).some(error => /bundle fingerprint|event hash/i.test(error)));
  assert.ok(validateCandidateReturnEvent({ ...event, engineSelected: true }, { assessment }).some(error => /engineSelected/i.test(error)));
});

test("desk records only receipt evidence after an event and never returns bundle content", () => {
  const { desk, modelTrial, candidateTrial } = fixture();
  const item = completedManifest(desk).returns[0];
  const event = createCandidateReturnEvent({ returnItem: item, actor: "MODEL-TRIAL-QA", sequence: 1 });
  const current = buildCandidateReturnDesk({ candidateTrial, modelTrial, events: [event], chain: { valid: true, count: 1, failedAt: null, head: event.hash, returns: 1 } });
  assert.equal(current.counts.currentReturnsReceived, 1);
  assert.equal(current.runs[0].status, "structured-return-held-unverified");
  assert.equal(current.runs[0].currentReturn.bundleHash, event.bundleHash);
  assert.equal("bundle" in current.runs[0].currentReturn, false);
  assert.equal("bundle" in current.history[0], false);
  assert.equal(current.returnSetStructurallyComplete, false);
  assert.equal(current.engineSelected, false);
});

test("candidate-return schema and UI preserve the closed-content boundary", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/candidate-return-event.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../candidate-return.css", import.meta.url), "utf8");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, CANDIDATE_RETURN_CONTRACT);
  assert.equal(schema.properties.outputGateCount.const, 10);
  assert.equal(schema.properties.providerCallPerformedByPerl.const, false);
  assert.equal(schema.properties.candidateRunExternallyVerified.const, false);
  assert.equal(schema.properties.engineSelected.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
  assert.match(html, /id="candidate-return-desk"/);
  assert.match(html, /The model comes back through a narrow door/);
  assert.match(html, /No candidate prose is rendered here/);
  assert.match(html, /id="candidate-return-file"[^>]*accept="application\/json,.json"/);
  assert.match(html, /id="candidate-return-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test("schema 47 store persists idempotent candidate returns and fails closed on ledger tampering", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-return-"));
  const filePath = join(directory, "sandbox-state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = () => new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider()
  });
  const store = make();
  await store.init();
  assert.equal(store.state.schemaVersion, 49);
  await store.preflightModelTrialManifest(completeModelTrialManifest(), "MODEL-TRIAL-QA");
  const template = await store.candidateReturnRequest();
  template.returns = [{
    ...template.returns[0],
    promptVersion: "manual-test-prompt/1.0",
    bundle: bundleFor(assessments.find(item => item.id === template.returns[0].caseId))
  }];
  const accepted = await store.recordCandidateReturns(template, "MODEL-TRIAL-QA");
  assert.equal(accepted.idempotent, false);
  assert.equal(accepted.events.length, 1);
  assert.equal(accepted.candidateReturns.counts.currentReturnsReceived, 1);
  assert.equal(accepted.candidateReturns.outputContentRendered, false);
  const repeated = await store.recordCandidateReturns(template, "MODEL-TRIAL-QA");
  assert.equal(repeated.idempotent, true);
  assert.equal(store.state.candidateReturnEvents.length, 1);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.equal((await reopened.candidateReturnStatus()).chain.valid, true);
  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  persisted.candidateReturnEvents[0].engineSelected = true;
  await writeFile(filePath, `${JSON.stringify(persisted, null, 2)}\n`);
  await assert.rejects(() => make().init(), error => /Candidate-return history integrity check failed/i.test(error.message));
});
