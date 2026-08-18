import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import {
  CANDIDATE_BLIND_REVIEW_CONTRACT,
  CANDIDATE_BLIND_REVIEW_MEASURES,
  buildCandidateBlindReviewDesk,
  candidateBlindReviewDigest,
  candidateBlindReviewReceipt,
  createCandidateBlindReviewAssignment,
  createCandidateBlindReviewEvent,
  publicCandidateBlindReviewAssignment,
  validateCandidateBlindReviewContract,
  validateCandidateBlindReviewEvent,
  validateCandidateBlindReviewSubmission
} from "../src/candidate-blind-review.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";

const NOW = "2026-08-14T12:00:00.000Z";
const CASES = ["FF-TEST-2407-A", "FF-TEST-2388-B", "FF-TEST-2411-C"];

function candidateTrial() {
  const rotations = [
    ["candidate-01", "candidate-02", "candidate-03", "counselor-reference"],
    ["candidate-02", "candidate-03", "counselor-reference", "candidate-01"],
    ["candidate-03", "counselor-reference", "candidate-01", "candidate-02"]
  ];
  return {
    protocolFingerprint: "a".repeat(64),
    counts: { syntheticCases: 3, blindCellsPlanned: 12 },
    runEnvelopes: CASES.map((caseId, index) => ({ caseId, caseFingerprint: String(index + 1).repeat(64) })),
    blindCells: CASES.flatMap((caseId, caseIndex) => rotations[caseIndex].map((armId, index) => ({
      cellId: `FF-BLIND-${caseIndex + 1}-${"ABCD"[index]}`,
      caseId,
      blindPosition: "ABCD"[index],
      armId
    })))
  };
}

function readyInputs(overrides = {}) {
  return {
    candidateTrial: candidateTrial(),
    candidateReturns: {
      returnSetStructurallyComplete: true,
      counts: { currentReturnsReceived: 9 },
      chain: { head: "b".repeat(64) }
    },
    referenceDecision: {
      referenceSetAccepted: true,
      protocolFrozen: true,
      independentReviewHandoffReady: true,
      counts: { acceptedReferences: 3 },
      chain: { head: "c".repeat(64) }
    },
    referenceAssets: Object.fromEntries(CASES.map((caseId, index) => [caseId, { summary: `Accepted source-only counselor reference ${index + 1}.`, artifactHash: String(index + 4).repeat(64) }])),
    clinicalStandard: { latestDraft: { version: 1, preOutcomeCandidate: true, hash: "d".repeat(64) } },
    events: [],
    pendingAssignments: {},
    actor: "COUNSELOR-01",
    studyActive: true,
    chain: { valid: true, count: 0, failedAt: null, head: null, outcomes: 0 },
    generatedAt: NOW,
    ...overrides
  };
}

function assignment() {
  const trial = candidateTrial();
  const artifactsByArm = {
    "candidate-01": { summary: "Anonymous synthetic candidate summary one with appropriately bounded clinical language.", artifactHash: "e".repeat(64) },
    "candidate-02": { summary: "Anonymous synthetic candidate summary two with appropriately bounded clinical language.", artifactHash: "f".repeat(64) },
    "candidate-03": { summary: "Anonymous synthetic candidate summary three with appropriately bounded clinical language.", artifactHash: "0".repeat(64) },
    "counselor-reference": { summary: "Accepted source-only counselor reference with appropriately bounded clinical language.", artifactHash: "4".repeat(64) }
  };
  return createCandidateBlindReviewAssignment({
    candidateTrial: trial,
    caseId: CASES[0],
    sourceProfile: { projection: "scored-profile-v1", assessmentId: CASES[0], scales: [], subscales: [], safety: { directReviewRequired: true } },
    artifactsByArm,
    evidence: {
      candidateReturnChainHead: "b".repeat(64),
      referenceDecisionChainHead: "c".repeat(64),
      clinicalStandardHash: "d".repeat(64),
      candidateTrialProtocolFingerprint: "a".repeat(64)
    },
    actor: "COUNSELOR-01",
    reviewerProgress: { completed: 0, available: 3 },
    createdAt: NOW,
    assignmentId: "FF-CANDIDATE-REVIEW-ABCDEF0123456789ABCD"
  });
}

function submission(packet) {
  return {
    assignmentId: packet.assignmentId,
    packetFingerprint: packet.packetFingerprint,
    cells: ["A", "B", "C", "D"].map((blindPosition, index) => ({
      blindPosition,
      ratings: {
        evidenceFidelity: 5 - (index % 2),
        criticalSafetyHandling: 5,
        clinicalRestraint: 4,
        conversationUsefulness: 4
      },
      correctionBurden: index === 1 ? "minor" : "none",
      correctionFlags: index === 1 ? ["tone-or-clarity"] : [],
      dissentFlags: index === 2 ? ["clinical-utility"] : [],
      useDisposition: index === 1 ? "usable-after-revision" : "usable-as-is"
    }))
  };
}

test("candidate blind-review contract fixes six measures and the concealment boundary", () => {
  assert.equal(CANDIDATE_BLIND_REVIEW_CONTRACT, "perl-candidate-blind-review/1.0");
  assert.equal(CANDIDATE_BLIND_REVIEW_MEASURES.length, 6);
  assert.equal(CANDIDATE_BLIND_REVIEW_MEASURES.filter(item => item.mode.startsWith("direct")).length, 5);
  assert.deepEqual(validateCandidateBlindReviewContract(), []);
});

test("desk stays blocked until every governed prerequisite is present", () => {
  const blocked = buildCandidateBlindReviewDesk(readyInputs({ candidateReturns: { returnSetStructurallyComplete: false, counts: { currentReturnsReceived: 8 }, chain: { head: "b".repeat(64) } } }));
  assert.equal(blocked.status, "blocked-awaiting-governed-evidence");
  assert.equal(blocked.packetIssuanceEnabled, false);
  assert.equal(blocked.counts.readinessGatesSatisfied, 5);
  assert.equal(blocked.engineSelected, false);
  assert.equal(blocked.candidateIdentityVisibleToReviewer, false);
});

test("ready desk exposes only aggregate evidence and no ranking", () => {
  const desk = buildCandidateBlindReviewDesk(readyInputs());
  assert.equal(desk.status, "local-rehearsal-intake-ready");
  assert.equal(desk.counts.readinessGatesSatisfied, 6);
  assert.equal(desk.counts.engineRankingsPublished, 0);
  assert.equal(desk.reviewerAgreementDerivedOnly, true);
  assert.equal("candidateScores" in desk, false);
  assert.equal("authorMapping" in desk, false);
});

test("assignment returns four anonymous cells and never returns the hidden mapping or actor", () => {
  const { pending, packet } = assignment();
  assert.deepEqual(packet.cells.map(cell => cell.blindPosition), ["A", "B", "C", "D"]);
  assert.equal(packet.cells.every(cell => cell.summary && /^[a-f0-9]{64}$/.test(cell.artifactHash)), true);
  assert.equal("authorMapping" in packet, false);
  assert.equal("actor" in packet, false);
  assert.equal(candidateBlindReviewDigest(pending.authorMapping), packet.authorMappingHash);
  assert.deepEqual(publicCandidateBlindReviewAssignment(pending), packet);
  assert.equal(JSON.stringify(packet).includes("candidate-01"), false);
});

test("submission requires exact A-D coverage and consistent structured corrections", () => {
  const { pending, packet } = assignment();
  assert.deepEqual(validateCandidateBlindReviewSubmission(submission(packet), pending, "COUNSELOR-01", "2026-08-14T12:10:00.000Z"), []);
  const bad = submission(packet);
  bad.cells[0].correctionBurden = "material";
  assert.match(validateCandidateBlindReviewSubmission(bad, pending, "COUNSELOR-01", "2026-08-14T12:10:00.000Z").join(" "), /identify at least one structured correction/i);
  assert.match(validateCandidateBlindReviewSubmission(submission(packet), pending, "COUNSELOR-02", "2026-08-14T12:10:00.000Z").join(" "), /different reviewer code/i);
});

test("outcome event seals ratings, mapping, timing, false claims, and a linked hash", () => {
  const { pending, packet } = assignment();
  const event = createCandidateBlindReviewEvent({
    input: submission(packet),
    pending,
    actor: "COUNSELOR-01",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T12:10:00.000Z",
    id: "123e4567-e89b-12d3-a456-426614174000"
  });
  const known = new Set(event.cells.map(cell => cell.artifactHash));
  assert.deepEqual(validateCandidateBlindReviewEvent(event, { sequence: 1, previousHash: "GENESIS", knownArtifactHashes: known }), []);
  assert.equal(event.reviewTiming.durationSeconds, 600);
  assert.equal(event.authorMappingRevealedAfterSubmission, false);
  assert.equal(event.engineRanked, false);
  assert.equal(candidateBlindReviewReceipt(event).candidateIdentityRevealed, false);
});

test("event validation fails closed on altered ratings, authorship, claims, or artifacts", () => {
  const { pending, packet } = assignment();
  const event = createCandidateBlindReviewEvent({ input: submission(packet), pending, actor: "COUNSELOR-01", sequence: 1, createdAt: "2026-08-14T12:10:00.000Z" });
  const known = new Set(event.cells.map(cell => cell.artifactHash));
  for (const mutate of [
    candidate => { candidate.cells[0].ratings.evidenceFidelity = 1; },
    candidate => { candidate.authorMapping.A = "candidate-02"; },
    candidate => { candidate.engineSelected = true; },
    candidate => { candidate.cells[0].artifactHash = "9".repeat(64); }
  ]) {
    const altered = structuredClone(event);
    mutate(altered);
    assert.notEqual(validateCandidateBlindReviewEvent(altered, { sequence: 1, previousHash: "GENESIS", knownArtifactHashes: known }).length, 0);
  }
});

test("candidate blind-review schema and gallery preserve anonymous, structured review", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/candidate-blind-review-event.schema.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../candidate-blind-review.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, CANDIDATE_BLIND_REVIEW_CONTRACT);
  assert.equal(schema.properties.authorMappingRevealedAfterSubmission.const, false);
  assert.equal(schema.properties.engineRanked.const, false);
  assert.equal(schema.properties.engineSelected.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
  assert.match(html, /id="candidate-review-gallery"/);
  assert.match(html, /Four unlabeled voices\. One disciplined read/);
  assert.match(html, /id="candidate-review-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="candidate-review-form"[^>]*hidden/);
  assert.match(app, /correctionBurden/);
  assert.match(app, /author identity, scores, ranking, and selection remain unverified|Candidate identity, reviewer identity, scores, ranking, and selection remain unverified/i);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test("schema 44 migrates to schema 45 with an empty blind-review ledger and blocked intake", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-review-"));
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
  legacy.schemaVersion = 44;
  delete legacy.candidateBlindReviewEvents;
  delete legacy.pendingCandidateBlindReviews;
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

  const migrated = make();
  await migrated.init();
  assert.equal(migrated.state.schemaVersion, 49);
  assert.deepEqual(migrated.state.candidateBlindReviewEvents, []);
  assert.deepEqual(migrated.state.pendingCandidateBlindReviews, {});
  assert.equal(migrated.integritySnapshot().candidateBlindReviews.valid, true);
  const desk = await migrated.candidateBlindReviewStatus("REVIEWER-01");
  assert.equal(desk.locallyReady, false);
  assert.equal(desk.counts.engineRankingsPublished, 0);
  await assert.rejects(() => migrated.nextCandidateBlindReview("REVIEWER-01"), error => error.status === 409 && /intake remains closed/i.test(error.message));
});

test("store issues, resumes, and seals one four-arm packet without returning authorship", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-review-ready-"));
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
  const candidateHashes = ["e".repeat(64), "f".repeat(64), "0".repeat(64)];
  const referenceHashes = ["4".repeat(64), "5".repeat(64), "6".repeat(64)];
  store.state.candidateReturnEvents = candidateHashes.map(bundleHash => ({ bundleHash }));
  store.state.counselorReferenceDrafts = referenceHashes.map(hash => ({ hash }));
  const artifacts = Object.fromEntries(CASES.map((caseId, caseIndex) => [caseId, {
    "candidate-01": { summary: `Anonymous bounded candidate one for ${caseId}.`, artifactHash: candidateHashes[0] },
    "candidate-02": { summary: `Anonymous bounded candidate two for ${caseId}.`, artifactHash: candidateHashes[1] },
    "candidate-03": { summary: `Anonymous bounded candidate three for ${caseId}.`, artifactHash: candidateHashes[2] },
    "counselor-reference": { summary: `Accepted source-only counselor reference for ${caseId}.`, artifactHash: referenceHashes[caseIndex] }
  }]));
  store.candidateBlindReviewContext = async actor => ({
    candidateTrial: candidateTrial(),
    candidateReturns: { returnSetStructurallyComplete: true, counts: { currentReturnsReceived: 9 }, chain: { head: "b".repeat(64) } },
    referenceDecision: { referenceSetAccepted: true, protocolFrozen: true, independentReviewHandoffReady: true, counts: { acceptedReferences: 3 }, chain: { head: "c".repeat(64) } },
    referenceAssets: Object.fromEntries(CASES.map((caseId, index) => [caseId, { summary: `Reference ${index + 1}`, artifactHash: referenceHashes[index] }])),
    clinicalStandard: { latestDraft: { version: 1, preOutcomeCandidate: true, hash: "d".repeat(64) } },
    artifacts,
    evidence: {
      candidateReturnChainHead: "b".repeat(64),
      referenceDecisionChainHead: "c".repeat(64),
      clinicalStandardHash: "d".repeat(64),
      candidateTrialProtocolFingerprint: "a".repeat(64)
    },
    actor
  });

  const issued = await store.nextCandidateBlindReview("COUNSELOR-01");
  assert.equal(issued.assignment.cells.length, 4);
  assert.equal("authorMapping" in issued.assignment, false);
  assert.equal("actor" in issued.assignment, false);
  const resumed = await store.nextCandidateBlindReview("COUNSELOR-01");
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.assignment.assignmentId, issued.assignment.assignmentId);
  const result = await store.submitCandidateBlindReview(submission(issued.assignment), "COUNSELOR-01");
  assert.equal(result.receipt.blindCellsRecorded, 4);
  assert.equal(result.receipt.authorMappingRevealed, false);
  assert.equal("authorMapping" in result.receipt, false);
  assert.equal(store.state.candidateBlindReviewEvents.length, 1);
  assert.equal(Object.keys(store.state.pendingCandidateBlindReviews).length, 0);
  assert.equal(store.verifyCandidateBlindReviewEventChain().valid, true);
  assert.equal(result.candidateReview.counts.engineRankingsPublished, 0);
});
