import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import {
  CANDIDATE_REFINEMENT_RETEST_CONTRACT,
  buildCandidateRefinementDesk,
  candidateRefinementRetestKit,
  createCandidateRefinementCycle,
  validateCandidateRefinementContract,
  validateCandidateRefinementCycleEvent
} from "../src/candidate-refinement-retest.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";

const NOW = "2026-08-14T12:00:00.000Z";
const CASES = ["FF-TEST-2407-A", "FF-TEST-2388-B", "FF-TEST-2411-C"];
const EVIDENCE = {
  candidateReturnChainHead: "a".repeat(64),
  referenceDecisionChainHead: "b".repeat(64),
  clinicalStandardHash: "c".repeat(64),
  candidateTrialProtocolFingerprint: "d".repeat(64)
};

function reviewEvents({ unsafe = false } = {}) {
  const reviewers = ["e".repeat(64), "f".repeat(64)];
  let sequence = 0;
  return reviewers.flatMap((reviewerCodeHash, reviewerIndex) => CASES.map((caseId, caseIndex) => {
    sequence += 1;
    return {
      sequence,
      caseId,
      reviewerCodeHash,
      authorMapping: {
        A: "candidate-01",
        B: "candidate-02",
        C: "candidate-03",
        D: "counselor-reference"
      },
      cells: [
        {
          blindPosition: "A",
          correctionBurden: unsafe && reviewerIndex === 0 && caseIndex === 0 ? "unsafe" : "material",
          correctionFlags: ["factual-mismatch"],
          dissentFlags: reviewerIndex === 1 ? ["source-evidence"] : [],
          useDisposition: "usable-after-revision"
        },
        { blindPosition: "B", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" },
        { blindPosition: "C", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" },
        { blindPosition: "D", correctionBurden: "none", correctionFlags: [], dissentFlags: [], useDisposition: "usable-as-is" }
      ],
      evidence: structuredClone(EVIDENCE),
      hash: String((sequence % 9) + 1).repeat(64)
    };
  }));
}

function candidateReview(events = reviewEvents()) {
  return {
    gates: [
      "candidate-returns",
      "accepted-reference-set",
      "reference-protocol-freeze",
      "reference-content-resolution",
      "pre-outcome-standard",
      "study-control"
    ].map((id, index) => ({ id, index: String(index + 1), satisfied: true })),
    counts: { casesWithIndependentOverlap: 3 },
    chain: { valid: true, count: events.length, failedAt: null, head: events.at(-1).hash }
  };
}

function desk(overrides = {}) {
  const events = overrides.reviewEvents || reviewEvents();
  return buildCandidateRefinementDesk({
    candidateReview: candidateReview(events),
    reviewEvents: events,
    cycles: [],
    evidence: EVIDENCE,
    caseIds: CASES,
    studyActive: true,
    chain: { valid: true, count: 0, failedAt: null, head: null },
    generatedAt: NOW,
    ...overrides
  });
}

function cycleContext(overrides = {}) {
  const currentDesk = overrides.desk || desk();
  const signal = currentDesk.lanes[0].signals.find(item => item.correctionFlag === "factual-mismatch");
  const baselineByCase = Object.fromEntries(CASES.map((caseId, index) => [caseId, {
    caseId,
    caseFingerprint: String(index + 1).repeat(64),
    baselineArtifactHash: String(index + 7).repeat(64)
  }]));
  const evidence = {
    candidateReviewChainHead: "6".repeat(64),
    candidateReviewDeskFingerprint: currentDesk.deskFingerprint,
    candidateReturnChainHead: EVIDENCE.candidateReturnChainHead,
    clinicalStandardHash: EVIDENCE.clinicalStandardHash,
    candidateTrialProtocolFingerprint: EVIDENCE.candidateTrialProtocolFingerprint
  };
  return {
    input: {
      laneId: "lane-i",
      signalId: signal.id,
      interventionType: signal.interventionType,
      targetMeasure: signal.targetMeasure,
      iterationGoal: signal.iterationGoal
    },
    desk: currentDesk,
    baselineByCase,
    evidence,
    actor: "REFINEMENT-OWNER-01",
    sequence: 1,
    previousHash: "GENESIS",
    cycleNumber: 1,
    createdAt: NOW,
    id: "123e4567-e89b-42d3-a456-426614174000",
    cycleId: "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD"
  };
}

test("candidate refinement contract fixes anonymous lanes, recurrence, and authority boundary", () => {
  assert.equal(CANDIDATE_REFINEMENT_RETEST_CONTRACT, "perl-candidate-refinement-retest/1.0");
  assert.deepEqual(validateCandidateRefinementContract(), []);
});

test("desk opens only after current independent overlap and publishes no score or ordering", () => {
  const ready = desk();
  assert.equal(ready.status, "refinement-scope-ready");
  assert.equal(ready.locallyReady, true);
  assert.equal(ready.counts.currentReviewPackets, 6);
  assert.equal(ready.counts.eligibleSignals, 1);
  assert.deepEqual(ready.lanes.map(lane => lane.label), ["Lane I", "Lane II", "Lane III"]);
  assert.equal(ready.candidateScoresPublished, false);
  assert.equal(ready.candidateOrderingPublished, false);
  assert.equal("ratings" in ready.lanes[0], false);

  const blocked = desk({ reviewEvents: reviewEvents().slice(0, 3), candidateReview: candidateReview(reviewEvents().slice(0, 3)) });
  assert.equal(blocked.status, "blocked-awaiting-independent-overlap");
  assert.equal(blocked.cycleIssuanceEnabled, false);
});

test("unsafe correction holds its lane and safety routing never becomes an optimization target", () => {
  const held = desk({ reviewEvents: reviewEvents({ unsafe: true }), candidateReview: candidateReview(reviewEvents({ unsafe: true })) });
  assert.equal(held.lanes[0].unsafeCorrectionObserved, true);
  assert.equal(held.lanes[0].eligibleSignalCount, 0);
  assert.equal(held.lanes[0].signals.find(item => item.correctionFlag === "safety-routing").eligible, false);
});

test("cycle pins one eligible signal and issues three content-free same-case envelopes", () => {
  const context = cycleContext();
  const event = createCandidateRefinementCycle(context);
  const errors = validateCandidateRefinementCycleEvent(event, {
    sequence: 1,
    previousHash: "GENESIS",
    knownReviewEventHashes: new Set(context.desk.lanes[0].signals.find(item => item.eligible).evidenceEventHashes),
    knownBaselineArtifactHashes: new Set(Object.values(context.baselineByCase).map(item => item.baselineArtifactHash))
  });
  assert.deepEqual(errors, []);
  assert.equal(event.retestEnvelopes.length, 3);
  assert.equal(event.intervention.changesPerformed, false);
  assert.equal(event.modelModificationPerformed, false);
  assert.equal(event.candidateRetestExecuted, false);
  assert.equal(event.engineRanked, false);
  assert.equal(event.engineSelected, false);
  assert.equal(event.retestEnvelopes.every(item => !item.sourceContentIncluded && !item.providerIdentityIncluded && !item.phiIncluded), true);
});

test("retest kit excludes actor, provider, model, summaries, scores, and mapping", () => {
  const event = createCandidateRefinementCycle(cycleContext());
  const kit = candidateRefinementRetestKit(event);
  const serialized = JSON.stringify(kit);
  assert.equal(serialized.includes("actorCodeHash"), false);
  assert.equal(serialized.includes("candidate-01"), false);
  assert.equal(serialized.includes("authorMapping"), false);
  assert.equal(serialized.includes("ratings"), false);
  assert.equal(kit.retestExecuted, false);
});

test("cycle validation fails closed on altered signal, baseline, or authority claim", () => {
  const context = cycleContext();
  const event = createCandidateRefinementCycle(context);
  const knownReviews = new Set(context.desk.lanes[0].signals.find(item => item.eligible).evidenceEventHashes);
  const knownArtifacts = new Set(Object.values(context.baselineByCase).map(item => item.baselineArtifactHash));
  for (const mutate of [
    candidate => { candidate.signalSnapshot.caseCount = 2; },
    candidate => { candidate.retestEnvelopes[0].baselineArtifactHash = "0".repeat(64); },
    candidate => { candidate.modelModificationPerformed = true; },
    candidate => { candidate.engineSelected = true; }
  ]) {
    const altered = structuredClone(event);
    mutate(altered);
    assert.notEqual(validateCandidateRefinementCycleEvent(altered, { sequence: 1, previousHash: "GENESIS", knownReviewEventHashes: knownReviews, knownBaselineArtifactHashes: knownArtifacts }).length, 0);
  }
});

test("schema is strict and locks false authority claims", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/candidate-refinement-retest-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, CANDIDATE_REFINEMENT_RETEST_CONTRACT);
  assert.equal(schema.properties.modelModificationPerformed.const, false);
  assert.equal(schema.properties.candidateRetestExecuted.const, false);
  assert.equal(schema.properties.engineRanked.const, false);
  assert.equal(schema.properties.engineSelected.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});

test("refinement lab presents fixed anonymous lanes with responsive, non-generic design", async () => {
  const [html, css, app, apiClient] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../candidate-refinement-retest.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/api-client.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="candidate-refinement-lab"/);
  assert.match(html, /Change one thing\. Test the same truth again\./);
  assert.match(html, /id="candidate-refinement-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.ok(html.indexOf("Lane I") < html.indexOf("Lane II") && html.indexOf("Lane II") < html.indexOf("Lane III"));
  assert.match(html, /id="candidate-refinement-create"[^>]*type="submit"/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(app, /function renderCandidateRefinement\(/);
  assert.match(app, /three content-free same-case envelopes/i);
  assert.match(apiClient, /async candidateRefinement\(\)/);
  assert.match(apiClient, /async createCandidateRefinementCycle\(payload\)/);
});

test("schema 45 migrates through 47 with empty candidate refinement and retest ledgers", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-refinement-migration-"));
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
  legacy.schemaVersion = 45;
  delete legacy.candidateRefinementEvents;
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateRefinementEvents, []);
  assert.equal(migrated.integritySnapshot().candidateRefinementCycles.valid, true);
});

test("store scopes one open anonymous cycle and exports a private retest kit", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-refinement-store-"));
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
  const events = reviewEvents();
  const baselineHashes = ["7".repeat(64), "8".repeat(64), "9".repeat(64)];
  store.state.candidateBlindReviewEvents = events;
  store.state.candidateReturnEvents = baselineHashes.map(bundleHash => ({ bundleHash }));
  store.candidateRefinementContext = async () => ({
    candidateReview: { ...candidateReview(events), deskFingerprint: "6".repeat(64) },
    candidateReturns: {
      runs: baselineHashes.flatMap((bundleHash, laneIndex) => CASES.map((caseId, caseIndex) => ({
        candidateSlot: `candidate-0${laneIndex + 1}`,
        caseId,
        caseFingerprint: String(caseIndex + 1).repeat(64),
        currentReturn: { bundleHash }
      })))
    },
    evidence: structuredClone(EVIDENCE),
    caseIds: CASES,
    studyActive: true,
    generatedAt: NOW
  });

  const status = await store.candidateRefinementStatus();
  const signal = status.lanes[0].signals.find(item => item.eligible);
  const accepted = await store.createCandidateRefinementCycle({
    laneId: "lane-i",
    signalId: signal.id,
    interventionType: signal.interventionType,
    targetMeasure: signal.targetMeasure,
    iterationGoal: signal.iterationGoal
  }, "REFINEMENT-OWNER-01");
  assert.equal(accepted.cycle.laneLabel, "Lane I");
  assert.equal(store.state.candidateRefinementEvents.length, 1);
  assert.equal(store.verifyCandidateRefinementCycleChain().valid, true);
  assert.equal(accepted.candidateRefinement.status, "retest-kits-issued-awaiting-manual-return");

  const kit = await store.candidateRefinementRetestKit(accepted.cycle.cycleId);
  assert.equal(kit.retestEnvelopes.length, 3);
  assert.equal(JSON.stringify(kit).includes("candidate-01"), false);
  assert.equal(JSON.stringify(kit).includes("REFINEMENT-OWNER-01"), false);
  await assert.rejects(
    () => store.createCandidateRefinementCycle({ laneId: "lane-i" }, "REFINEMENT-OWNER-01"),
    error => error.status === 409 && /open refinement/i.test(error.message)
  );

  store.state.candidateRefinementEvents[0].engineSelected = true;
  assert.equal(store.verifyCandidateRefinementCycleChain().valid, false);
});
