import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import {
  CANDIDATE_RETEST_RETURN_BOUNDARY,
  CANDIDATE_RETEST_RETURN_CONTRACT,
  buildCandidateRetestReturnTemplate,
  candidateRetestReturnDigest,
  candidateRetestReturnReceipt,
  createCandidateRetestReturnEvent,
  validateCandidateRetestReturnContract,
  validateCandidateRetestReturnEvent,
  validateCandidateRetestReturnManifest
} from "../src/candidate-retest-return.js";
import {
  CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS,
  CANDIDATE_RETEST_REREVIEW_BOUNDARY,
  CANDIDATE_RETEST_REREVIEW_CONTRACT,
  CANDIDATE_RETEST_REREVIEW_MEASURES,
  buildCandidateRetestStudio,
  candidateRetestReviewEvidence,
  candidateRetestReviewReceipt,
  createCandidateRetestReviewAssignment,
  createCandidateRetestReviewEvent,
  publicCandidateRetestReviewAssignment,
  validateCandidateRetestReviewContract,
  validateCandidateRetestReviewEvent,
  validateCandidateRetestReviewSubmission
} from "../src/candidate-retest-rereview.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { generateClinicalInterpretation, generateSummary } from "../src/engine.js";
import { projectModelInput } from "../src/model-input.js";
import { createModelProvider } from "../src/model-provider.js";
import { buildCandidateRefinementDesk, createCandidateRefinementCycle } from "../src/candidate-refinement-retest.js";
import { SandboxStore } from "../src/sandbox-store.js";

const NOW = "2026-08-14T12:00:00.000Z";
const CASES = assessments.map(assessment => assessment.id);

function bundleFor(assessment) {
  const input = projectModelInput(assessment);
  return {
    narratives: Object.fromEntries(["clinician", "care", "payer", "admin"].map(audience => [audience, generateSummary(input, audience)])),
    interpretation: generateClinicalInterpretation(input)
  };
}

function fixture() {
  const bundles = Object.fromEntries(assessments.map(assessment => [assessment.id, bundleFor(assessment)]));
  const baselines = CASES.map((caseId, index) => ({
    caseId,
    bundle: bundles[caseId],
    bundleHash: candidateRetestReturnDigest(bundles[caseId]),
    candidateFingerprint: String(index + 1).repeat(64),
    providerId: "provider-one",
    modelVersion: "model-one.0",
    promptVersion: "baseline-prompt/1.0"
  }));
  const cycle = {
    contractVersion: "perl-candidate-refinement-retest/1.0",
    cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD",
    cycleNumber: 1,
    hash: "a".repeat(64),
    laneId: "lane-i",
    laneLabel: "Lane I",
    signalSnapshot: { label: "Factual mismatch recurred" },
    intervention: {
      type: "prompt-constraint-tightening",
      targetMeasure: "evidence-fidelity",
      iterationGoal: "Reduce unsupported factual expansion while preserving useful source-grounded language."
    },
    evidence: {
      clinicalStandardHash: "b".repeat(64),
      candidateTrialProtocolFingerprint: "c".repeat(64)
    },
    retestPolicy: { retestProtocolFingerprint: "d".repeat(64) },
    retestEnvelopes: CASES.map((caseId, index) => ({
      envelopeId: `FF-CANDIDATE-RETEST-${String(index + 1).padStart(2, "0")}-ABCDEF0123456789ABCD`,
      caseId,
      caseFingerprint: String(index + 4).repeat(64),
      baselineArtifactHash: baselines[index].bundleHash,
      retestProtocolFingerprint: "d".repeat(64)
    }))
  };
  const baselineByArtifactHash = Object.fromEntries(baselines.map(baseline => [baseline.bundleHash, baseline]));
  const assessmentsById = Object.fromEntries(assessments.map(assessment => [assessment.id, assessment]));
  const manifest = buildCandidateRetestReturnTemplate({ cycle, baselineByArtifactHash });
  manifest.returns = manifest.returns.map((item, index) => ({
    ...item,
    promptVersion: "retest-prompt/1.1",
    executionReference: `synthetic-retest-${index + 1}`,
    bundle: bundles[item.caseId]
  }));
  let previousHash = "GENESIS";
  const returnEvents = manifest.returns.map((returnItem, index) => {
    const event = createCandidateRetestReturnEvent({
      returnItem,
      cycle,
      baseline: baselineByArtifactHash[returnItem.baselineArtifactHash],
      actor: "RETEST-OPERATOR-01",
      sequence: index + 1,
      previousHash,
      createdAt: new Date(Date.parse(NOW) + index * 1000).toISOString(),
      id: `123e4567-e89b-42d3-a456-42661417400${index}`
    });
    previousHash = event.hash;
    return event;
  });
  return { cycle, baselines, baselineByArtifactHash, assessmentsById, manifest, returnEvents };
}

function reviewEvidence(context) {
  return candidateRetestReviewEvidence({
    cycle: context.cycle,
    refinementChain: { valid: true, count: 1, failedAt: null, head: context.cycle.hash },
    returnChain: { valid: true, count: 3, failedAt: null, head: context.returnEvents.at(-1).hash },
    retestEvents: context.returnEvents
  });
}

function reviewSubmission(packet, differenceDisposition = "materially-equivalent") {
  return {
    assignmentId: packet.assignmentId,
    packetFingerprint: packet.packetFingerprint,
    cells: ["X", "Y"].map((blindPosition, index) => ({
      blindPosition,
      ratings: {
        evidenceFidelity: index === 0 ? 4 : 5,
        criticalSafetyHandling: 5,
        clinicalRestraint: 4,
        conversationUsefulness: 4
      },
      correctionBurden: index === 0 ? "minor" : "none",
      correctionFlags: index === 0 ? ["tone-or-clarity"] : [],
      dissentFlags: index === 1 ? ["clinical-utility"] : [],
      useDisposition: index === 0 ? "usable-after-revision" : "usable-as-is"
    })),
    differenceDisposition
  };
}

function assignmentFor(context, caseId = CASES[0], actor = "REVIEWER-01", orientation = "baseline-first", index = 0) {
  const envelope = context.cycle.retestEnvelopes.find(item => item.caseId === caseId);
  const baseline = context.baselineByArtifactHash[envelope.baselineArtifactHash];
  const retest = context.returnEvents.find(item => item.caseId === caseId);
  return createCandidateRetestReviewAssignment({
    cycle: context.cycle,
    caseId,
    sourceProfile: { projection: "scored-profile-v1", assessmentId: caseId, scales: [], subscales: [], safety: { directReviewRequired: true } },
    baselineArtifact: { summary: baseline.bundle.narratives.clinician, artifactHash: baseline.bundleHash },
    retestArtifact: { summary: retest.bundle.narratives.clinician, artifactHash: retest.bundleHash },
    evidence: reviewEvidence(context),
    actor,
    reviewerProgress: { completed: 0, available: 3 },
    mappingOrientation: orientation,
    createdAt: new Date(Date.parse(NOW) + index * 60_000).toISOString(),
    assignmentId: `FF-CANDIDATE-RETEST-REVIEW-${String(index + 1).padStart(2, "0")}-ABCDEF0123456789ABCD`
  });
}

function governedCycleForStore(context) {
  const evidence = {
    candidateReturnChainHead: "6".repeat(64),
    referenceDecisionChainHead: "7".repeat(64),
    clinicalStandardHash: "8".repeat(64),
    candidateTrialProtocolFingerprint: "9".repeat(64)
  };
  let sequence = 0;
  const reviewerEvents = ["e".repeat(64), "f".repeat(64)].flatMap(reviewerCodeHash => CASES.map(caseId => {
    sequence += 1;
    return {
      sequence,
      caseId,
      reviewerCodeHash,
      authorMapping: { A: "candidate-01", B: "candidate-02", C: "candidate-03", D: "counselor-reference" },
      cells: [
        { blindPosition: "A", correctionBurden: "material", correctionFlags: ["factual-mismatch"], dissentFlags: [], useDisposition: "usable-after-revision" },
        { blindPosition: "B", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" },
        { blindPosition: "C", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" },
        { blindPosition: "D", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" }
      ],
      evidence: structuredClone(evidence),
      hash: String((sequence % 9) + 1).repeat(64)
    };
  }));
  const candidateReview = {
    gates: ["candidate-returns", "accepted-reference-set", "reference-protocol-freeze", "reference-content-resolution", "pre-outcome-standard", "study-control"].map((id, index) => ({ id, index: String(index + 1), satisfied: true })),
    counts: { casesWithIndependentOverlap: 3 },
    chain: { valid: true, count: reviewerEvents.length, failedAt: null, head: reviewerEvents.at(-1).hash }
  };
  const desk = buildCandidateRefinementDesk({
    candidateReview,
    reviewEvents: reviewerEvents,
    cycles: [],
    evidence,
    caseIds: CASES,
    studyActive: true,
    chain: { valid: true, count: 0, failedAt: null, head: null },
    generatedAt: NOW
  });
  const signal = desk.lanes[0].signals.find(item => item.eligible);
  const baselineByCase = Object.fromEntries(context.baselines.map((baseline, index) => [baseline.caseId, {
    caseId: baseline.caseId,
    caseFingerprint: String(index + 4).repeat(64),
    baselineArtifactHash: baseline.bundleHash
  }]));
  const cycle = createCandidateRefinementCycle({
    input: {
      laneId: "lane-i",
      signalId: signal.id,
      interventionType: signal.interventionType,
      targetMeasure: signal.targetMeasure,
      iterationGoal: signal.iterationGoal
    },
    desk,
    baselineByCase,
    evidence: {
      candidateReviewChainHead: candidateReview.chain.head,
      candidateReviewDeskFingerprint: desk.deskFingerprint,
      candidateReturnChainHead: evidence.candidateReturnChainHead,
      clinicalStandardHash: evidence.clinicalStandardHash,
      candidateTrialProtocolFingerprint: evidence.candidateTrialProtocolFingerprint
    },
    actor: "REFINEMENT-OWNER-01",
    sequence: 1,
    previousHash: "GENESIS",
    cycleNumber: 1,
    createdAt: NOW,
    id: "123e4567-e89b-42d3-a456-426614174040",
    cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCDEF01"
  });
  return { cycle, reviewerEvents };
}

test("retest contracts preserve exact same-case evidence and the no-improvement boundary", () => {
  assert.equal(CANDIDATE_RETEST_RETURN_CONTRACT, "perl-candidate-retest-return/1.0");
  assert.equal(CANDIDATE_RETEST_REREVIEW_CONTRACT, "perl-candidate-retest-rereview/1.0");
  assert.equal(CANDIDATE_RETEST_REREVIEW_MEASURES.length, 7);
  assert.equal(CANDIDATE_RETEST_REREVIEW_MEASURES.filter(measure => measure.mode.startsWith("paired-direct")).length, 6);
  assert.equal(CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS.length, 4);
  assert.deepEqual(CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS, ["x-stronger", "y-stronger", "materially-equivalent", "uncertain"]);
  assert.equal(CANDIDATE_RETEST_DIFFERENCE_DISPOSITIONS.includes("retest-stronger"), false);
  assert.deepEqual(validateCandidateRetestReturnContract(), []);
  assert.deepEqual(validateCandidateRetestReviewContract(), []);
  assert.match(CANDIDATE_RETEST_RETURN_BOUNDARY, /does not establish improvement/i);
  assert.match(CANDIDATE_RETEST_REREVIEW_BOUNDARY, /separately signed external decision/i);
});

test("return intake accepts current envelopes and rejects rebinding, baseline prompts, extras, and PHI", () => {
  const context = fixture();
  assert.deepEqual(validateCandidateRetestReturnManifest(context.manifest, context), []);

  const rebound = structuredClone(context.manifest);
  rebound.returns[0].baselineArtifactHash = "f".repeat(64);
  assert.ok(validateCandidateRetestReturnManifest(rebound, context).some(error => /baselineArtifactHash|baseline return/i.test(error)));

  const oldPrompt = structuredClone(context.manifest);
  oldPrompt.returns[0].promptVersion = "baseline-prompt/1.0";
  assert.ok(validateCandidateRetestReturnManifest(oldPrompt, context).some(error => /promptVersion must identify the new/i.test(error)));

  const extra = structuredClone(context.manifest);
  extra.apiKey = "forbidden";
  assert.ok(validateCandidateRetestReturnManifest(extra, context).some(error => /outside the contract/i.test(error)));

  const phi = structuredClone(context.manifest);
  phi.privacyBoundary.phiIncluded = true;
  assert.ok(validateCandidateRetestReturnManifest(phi, context).some(error => /phiIncluded must remain false/i.test(error)));
});

test("retest returns become strict immutable non-authorizing receipts", () => {
  const context = fixture();
  let previousHash = "GENESIS";
  context.returnEvents.forEach((event, index) => {
    assert.deepEqual(validateCandidateRetestReturnEvent(event, {
      sequence: index + 1,
      previousHash,
      knownEnvelopeById: new Map(context.cycle.retestEnvelopes.map(envelope => [envelope.envelopeId, {
        cycle: context.cycle,
        envelope,
        baseline: context.baselineByArtifactHash[envelope.baselineArtifactHash]
      }])),
      assessment: context.assessmentsById[event.caseId]
    }), []);
    previousHash = event.hash;
  });
  const event = context.returnEvents[0];
  assert.equal(event.candidateRetestReturnReceived, true);
  assert.equal(event.candidateRetestExecutionVerified, false);
  assert.equal(event.improvementEstablished, false);
  assert.equal(event.engineSelected, false);
  assert.equal(candidateRetestReturnReceipt(event).comparativeOutcomePublished, false);

  const tampered = structuredClone(event);
  tampered.bundle.narratives.clinician += " Altered.";
  assert.ok(validateCandidateRetestReturnEvent(tampered, { assessment: context.assessmentsById[event.caseId] }).some(error => /bundle fingerprint|event hash/i.test(error)));
});

test("studio opens only with intact cycle and three current returns", () => {
  const context = fixture();
  const common = {
    cycles: [context.cycle],
    retestEvents: context.returnEvents,
    reviewEvents: [],
    actor: "REVIEWER-01",
    studyActive: true,
    refinementChain: { valid: true, count: 1, failedAt: null, head: context.cycle.hash },
    returnChain: { valid: true, count: 3, failedAt: null, head: context.returnEvents.at(-1).hash },
    reviewChain: { valid: true, count: 0, failedAt: null, head: null },
    generatedAt: NOW
  };
  const ready = buildCandidateRetestStudio(common);
  assert.equal(ready.status, "blind-rereview-intake-ready");
  assert.equal(ready.packetIssuanceEnabled, true);
  assert.equal(ready.counts.selectedReturnsReceived, 3);
  assert.equal(ready.improvementClaimPublished, false);
  assert.equal(ready.engineRanked, false);

  const brokenCycle = buildCandidateRetestStudio({ ...common, refinementChain: { ...common.refinementChain, valid: false } });
  assert.equal(brokenCycle.packetIssuanceEnabled, false);
  assert.equal(brokenCycle.gates[0].satisfied, false);
  const partial = buildCandidateRetestStudio({ ...common, retestEvents: context.returnEvents.slice(0, 2), returnChain: { valid: true, count: 2, failedAt: null, head: context.returnEvents[1].hash } });
  assert.equal(partial.status, "accepting-manual-retest-returns");
  assert.equal(partial.packetIssuanceEnabled, false);
});

test("public X/Y packet includes the scored source and summaries but conceals the mapping and actor", () => {
  const context = fixture();
  const { pending, packet } = assignmentFor(context);
  assert.deepEqual(packet.cells.map(cell => cell.blindPosition), ["X", "Y"]);
  assert.equal(packet.sourceProfile.assessmentId, CASES[0]);
  assert.equal("pairMapping" in packet, false);
  assert.equal("actor" in packet, false);
  assert.deepEqual(publicCandidateRetestReviewAssignment(pending), packet);
  assert.equal(JSON.stringify(packet).includes("baseline-prompt"), false);
  assert.equal(JSON.stringify(packet).includes("provider-one"), false);
});

test("submission requires exact X/Y judgments and consistent correction evidence", () => {
  const context = fixture();
  const { pending, packet } = assignmentFor(context);
  const input = reviewSubmission(packet);
  assert.deepEqual(validateCandidateRetestReviewSubmission(input, pending, "REVIEWER-01", "2026-08-14T12:10:00.000Z"), []);
  const repeated = structuredClone(input);
  repeated.cells[1].blindPosition = "X";
  assert.ok(validateCandidateRetestReviewSubmission(repeated, pending, "REVIEWER-01", "2026-08-14T12:10:00.000Z").some(error => /X and Y exactly once/i.test(error)));
  const inconsistent = structuredClone(input);
  inconsistent.cells[0].correctionBurden = "none";
  assert.ok(validateCandidateRetestReviewSubmission(inconsistent, pending, "REVIEWER-01", "2026-08-14T12:10:00.000Z").some(error => /inconsistent/i.test(error)));
  const mappingLeak = structuredClone(input);
  mappingLeak.differenceDisposition = "retest-stronger";
  assert.ok(validateCandidateRetestReviewSubmission(mappingLeak, pending, "REVIEWER-01", "2026-08-14T12:10:00.000Z").some(error => /paired-difference disposition is invalid/i.test(error)));
});

test("paired outcomes retain hidden mapping, dissent, disposition, and false authority claims", () => {
  const context = fixture();
  const { pending, packet } = assignmentFor(context);
  const event = createCandidateRetestReviewEvent({
    input: reviewSubmission(packet, "uncertain"),
    pending,
    actor: "REVIEWER-01",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T12:10:00.000Z",
    id: "123e4567-e89b-42d3-a456-426614174010"
  });
  const knownArtifacts = new Set([...context.baselines.map(item => item.bundleHash), ...context.returnEvents.map(item => item.bundleHash)]);
  assert.deepEqual(validateCandidateRetestReviewEvent(event, { knownArtifactHashes: knownArtifacts, knownCycleHashes: new Set([context.cycle.hash]) }), []);
  assert.equal(event.differenceDisposition, "uncertain");
  assert.equal(event.pairMapping.X, "baseline");
  assert.equal(event.mappingRevealedAfterSubmission, false);
  assert.equal(event.cells[1].dissentFlags[0], "clinical-utility");
  assert.equal(event.improvementEstablished, false);
  assert.equal(event.accuracyEstablished, false);
  assert.equal(candidateRetestReviewReceipt(event).baselineRetestMappingRevealed, false);

  const tampered = { ...event, improvementEstablished: true };
  assert.ok(validateCandidateRetestReviewEvent(tampered, { knownArtifactHashes: knownArtifacts, knownCycleHashes: new Set([context.cycle.hash]) }).some(error => /improvementEstablished/i.test(error)));
});

test("two distinct reviewers across all three cases complete only local paired evidence", () => {
  const context = fixture();
  const events = [];
  let previousHash = "GENESIS";
  for (const [reviewerIndex, actor] of ["REVIEWER-01", "REVIEWER-02"].entries()) {
    for (const [caseIndex, caseId] of CASES.entries()) {
      const index = reviewerIndex * CASES.length + caseIndex;
      const { pending, packet } = assignmentFor(context, caseId, actor, index % 2 === 0 ? "baseline-first" : "retest-first", index);
      const event = createCandidateRetestReviewEvent({
        input: reviewSubmission(packet, index % 2 === 0 ? "materially-equivalent" : "uncertain"),
        pending,
        actor,
        sequence: index + 1,
        previousHash,
        createdAt: new Date(Date.parse(pending.createdAt) + 10 * 60_000).toISOString(),
        id: `123e4567-e89b-42d3-a456-42661417402${index}`
      });
      previousHash = event.hash;
      events.push(event);
    }
  }
  const studio = buildCandidateRetestStudio({
    cycles: [context.cycle],
    retestEvents: context.returnEvents,
    reviewEvents: events,
    actor: "REVIEWER-03",
    studyActive: true,
    refinementChain: { valid: true, count: 1, failedAt: null, head: context.cycle.hash },
    returnChain: { valid: true, count: 3, failedAt: null, head: context.returnEvents.at(-1).hash },
    reviewChain: { valid: true, count: 6, failedAt: null, head: events.at(-1).hash },
    generatedAt: "2026-08-14T13:00:00.000Z"
  });
  assert.equal(studio.status, "local-paired-evidence-complete-awaiting-independent-disposition");
  assert.equal(studio.localPairedEvidenceComplete, true);
  assert.equal(studio.counts.selectedReviewPackets, 6);
  assert.equal(studio.counts.selectedCasesWithIndependentOverlap, 3);
  assert.equal(studio.independentDispositionRequired, true);
  assert.equal(studio.improvementEstablished, false);
  assert.equal(studio.clinicalStandardMet, false);
  assert.equal(studio.engineSelected, false);
});

test("store seals idempotent returns, issues a concealed pair, and records one immutable reading", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-retest-store-"));
  const filePath = join(directory, "sandbox-state.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new SandboxStore({
    filePath,
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider(),
    clock: () => new Date(NOW)
  });
  await store.init();
  const context = fixture();
  const governed = governedCycleForStore(context);
  store.state.candidateReturnEvents = context.baselines;
  store.state.candidateBlindReviewEvents = governed.reviewerEvents;
  store.state.candidateRefinementEvents = [governed.cycle];
  assert.equal(store.verifyCandidateRefinementCycleChain().valid, true);

  const template = buildCandidateRetestReturnTemplate({ cycle: governed.cycle, baselineByArtifactHash: context.baselineByArtifactHash });
  template.returns = template.returns.map((item, index) => ({
    ...item,
    promptVersion: "store-retest-prompt/1.1",
    executionReference: `store-synthetic-retest-${index + 1}`,
    bundle: bundleFor(assessments.find(assessment => assessment.id === item.caseId))
  }));
  const accepted = await store.recordCandidateRetestReturns(template, "RETEST-OPERATOR-01");
  assert.equal(accepted.idempotent, false);
  assert.equal(accepted.receipts.length, 3);
  assert.equal(accepted.candidateRetest.status, "blind-rereview-intake-ready");
  assert.equal(store.verifyCandidateRetestReturnChain().valid, true);
  const repeated = await store.recordCandidateRetestReturns(template, "RETEST-OPERATOR-01");
  assert.equal(repeated.idempotent, true);
  assert.equal(store.state.candidateRetestReturnEvents.length, 3);

  const issued = await store.nextCandidateRetestReview(governed.cycle.cycleId, "REVIEWER-01");
  assert.deepEqual(issued.assignment.cells.map(cell => cell.blindPosition), ["X", "Y"]);
  assert.equal("pairMapping" in issued.assignment, false);
  assert.equal("actor" in issued.assignment, false);
  assert.equal(JSON.stringify(issued.assignment).includes("provider-one"), false);
  const sealed = await store.submitCandidateRetestReview(reviewSubmission(issued.assignment), "REVIEWER-01");
  assert.equal(sealed.receipt.blindCellsRecorded, 2);
  assert.equal(sealed.receipt.baselineRetestMappingRevealed, false);
  assert.equal(sealed.receipt.improvementEstablished, false);
  assert.equal(store.verifyCandidateRetestReviewChain().valid, true);
  assert.equal(store.state.candidateRetestReviewEvents.length, 1);
});

test("strict schemas lock return and re-review authority claims", async () => {
  const [returnSchema, reviewSchema] = await Promise.all([
    readFile(new URL("../schemas/candidate-retest-return-event.schema.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../schemas/candidate-retest-rereview-event.schema.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.equal(returnSchema.additionalProperties, false);
  assert.equal(returnSchema.properties.contractVersion.const, CANDIDATE_RETEST_RETURN_CONTRACT);
  assert.equal(returnSchema.properties.improvementEstablished.const, false);
  assert.equal(returnSchema.properties.engineSelected.const, false);
  assert.equal(reviewSchema.additionalProperties, false);
  assert.equal(reviewSchema.properties.contractVersion.const, CANDIDATE_RETEST_REREVIEW_CONTRACT);
  assert.equal(reviewSchema.properties.mappingRevealedAfterSubmission.const, false);
  assert.equal(reviewSchema.properties.improvementEstablished.const, false);
  assert.equal(reviewSchema.properties.patientUseAuthorized.const, false);
});

test("same-case studio presents a responsive editorial X/Y instrument without a winner surface", async () => {
  const [html, css, app, apiClient] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../candidate-retest-rereview.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/api-client.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="candidate-retest-studio"/);
  assert.match(html, /Return to the same case\. Read it with fresh eyes\./);
  assert.match(html, /id="candidate-retest-file"[^>]*accept="application\/json,.json"/);
  assert.match(html, /id="candidate-retest-return-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="candidate-retest-review-form"[^>]*hidden/);
  assert.match(html, /Improvement claims[\s\S]*ZERO/);
  assert.doesNotMatch(html, /candidate-retest[^\n]{0,80}(winner|leaderboard)/i);
  assert.match(css, /@media \(max-width:1080px\)/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(app, /function renderCandidateRetest\(/);
  assert.match(app, /function renderCandidateRetestAssignment\(/);
  assert.match(app, /function candidateRetestReviewPayload\(/);
  assert.match(apiClient, /async candidateRetest\(cycleId = ""\)/);
  assert.match(apiClient, /async recordCandidateRetestReturns\(payload\)/);
  assert.match(apiClient, /async nextCandidateRetestReview\(cycleId\)/);
  assert.match(apiClient, /async submitCandidateRetestReview\(payload\)/);
});

test("schema 46 migrates through 48 with empty retest and disposition ledgers", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-retest-migration-"));
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
  const legacy = JSON.parse(await readFile(filePath, "utf8"));
  legacy.schemaVersion = 46;
  delete legacy.candidateRetestReturnEvents;
  delete legacy.candidateRetestReviewEvents;
  delete legacy.pendingCandidateRetestReviews;
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateRetestReturnEvents, []);
  assert.deepEqual(migrated.state.candidateRetestReviewEvents, []);
  assert.deepEqual(migrated.state.candidateRetestDispositionEvents, []);
  assert.deepEqual(migrated.state.pendingCandidateRetestReviews, {});
  assert.equal(migrated.integritySnapshot().candidateRetestReturns.valid, true);
  assert.equal(migrated.integritySnapshot().candidateRetestReviews.valid, true);
  assert.equal(migrated.integritySnapshot().candidateRetestDisposition.valid, true);
});
