import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assessments } from "../src/demo-data.js";
import { auditSeed } from "../src/demo-data.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import {
  COUNSELOR_REFERENCE_BOUNDARY,
  COUNSELOR_REFERENCE_CONTRACT,
  COUNSELOR_REFERENCE_TONE_MARKERS,
  buildCounselorReferenceRoom,
  buildCounselorReferenceSource,
  counselorReferenceSourceHash,
  createCounselorReferenceDraft,
  validateCounselorReferenceContract,
  validateCounselorReferenceDraft,
  validateCounselorReferenceInput
} from "../src/counselor-reference.js";

const assessment = assessments[0];
const sourceProfile = buildCounselorReferenceSource(assessment);
const input = {
  assessmentId: assessment.id,
  sourceProfileHash: counselorReferenceSourceHash(sourceProfile),
  authoringMode: "source-only",
  summary: "Self-report scores show mild depression and anxiety indicators with minimal global distress. Clarify timing, context, functioning, and the non-zero critical screen directly before using the pattern in care planning.",
  themes: [{
    title: "Cognitive tension with contained overall burden",
    body: "Apprehension and negative cognition are more prominent than the other scored constructs, while the global index remains minimal. Clarify whether this pattern is situational or persistent.",
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

const caseSet = {
  id: calibrationManifest.id,
  version: calibrationManifest.version,
  partition: calibrationManifest.cases[assessment.id].partition,
  referenceVersion: calibrationManifest.cases[assessment.id].referenceVersion
};

test("reference room fixes a source-only, non-authorizing contract", () => {
  assert.equal(COUNSELOR_REFERENCE_CONTRACT, "perl-counselor-reference-draft/1.0");
  assert.deepEqual(validateCounselorReferenceContract(), []);
  assert.equal(COUNSELOR_REFERENCE_TONE_MARKERS.length, 5);
  assert.equal(sourceProfile.generatedContentIncluded, false);
  assert.equal(sourceProfile.counselorReferenceIncluded, false);
  assert.equal(Object.hasOwn(sourceProfile, "summary"), false);
  assert.equal(Object.hasOwn(sourceProfile, "hypotheses"), false);
  assert.match(COUNSELOR_REFERENCE_BOUNDARY, /not an accepted reference/i);
});

test("reference input is evidence-bound and follows the exact critical route", () => {
  assert.deepEqual(validateCounselorReferenceInput(input, sourceProfile), []);
  assert.match(validateCounselorReferenceInput({ ...input, criticalReviewDisposition: "routine-verification" }, sourceProfile).join(" "), /requires-direct-review/i);
  const invented = structuredClone(input);
  invented.themes[0].evidence = ["Invented scale · 99"];
  assert.match(validateCounselorReferenceInput(invented, sourceProfile).join(" "), /outside the scored source profile/i);
  assert.match(validateCounselorReferenceInput({ ...input, summary: `${input.summary} Patient name: Jane Doe.` }, sourceProfile).join(" "), /direct identifier/i);
  assert.match(validateCounselorReferenceInput({ ...input, summary: "The patient definitely has anxiety and this proves the diagnosis beyond doubt for this assessment." }, sourceProfile).join(" "), /diagnostic|certain/i);
});

test("an immutable reference draft preserves source lineage while all authority stays false", () => {
  const draft = createCounselorReferenceDraft({
    input,
    sourceProfile,
    caseSet,
    actor: "REVIEWER-01",
    sequence: 1,
    createdAt: "2026-08-14T18:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111"
  });
  assert.deepEqual(validateCounselorReferenceDraft(draft), []);
  for (const key of [
    "sourceSurfaceIncludesGeneratedContent", "authorshipIndependenceEstablished", "counselorIdentityVerified",
    "referenceAccepted", "adjudicationCompleted", "protocolFrozen", "accuracyEstablished", "reliabilityEstablished",
    "clinicalValidation", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
  ]) assert.equal(draft[key], false);
  const altered = structuredClone(draft);
  altered.referenceAccepted = true;
  assert.match(validateCounselorReferenceDraft(altered).join(" "), /referenceAccepted must remain false|hash is invalid/i);
});

test("room exposes scored cases and only the current reviewer draft history", () => {
  const first = createCounselorReferenceDraft({ input, sourceProfile, caseSet, actor: "REVIEWER-01", sequence: 1, createdAt: "2026-08-14T18:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" });
  const secondInput = { ...input, assessmentId: assessments[1].id };
  const secondSource = buildCounselorReferenceSource(assessments[1]);
  secondInput.sourceProfileHash = counselorReferenceSourceHash(secondSource);
  secondInput.criticalReviewDisposition = "routine-verification";
  secondInput.themes = [{ ...input.themes[0], evidence: ["Apprehension · 10", "Global index · 68"] }];
  const second = createCounselorReferenceDraft({
    input: secondInput,
    sourceProfile: secondSource,
    caseSet: { id: calibrationManifest.id, version: calibrationManifest.version, partition: calibrationManifest.cases[assessments[1].id].partition, referenceVersion: calibrationManifest.cases[assessments[1].id].referenceVersion },
    actor: "REVIEWER-02",
    sequence: 2,
    previousHash: first.hash,
    createdAt: "2026-08-14T18:05:00.000Z",
    id: "22222222-2222-4222-8222-222222222222"
  });
  const unmanifested = { ...assessments[0], id: "FF-TEST-UNLISTED" };
  const room = buildCounselorReferenceRoom({ assessments: [...assessments, unmanifested], drafts: [first, second], chain: { valid: true, count: 2, head: second.hash }, manifest: calibrationManifest, actor: "REVIEWER-01" });
  assert.equal(room.metrics.localDrafts, 2);
  assert.equal(room.metrics.currentReviewerDrafts, 1);
  assert.equal(room.metrics.sandboxReviewerCodesObserved, 2);
  assert.equal(room.currentReviewerHistory.length, 1);
  assert.equal(room.currentReviewerHistory[0].actor, "REVIEWER-01");
  assert.equal(room.cases.length, 2);
  assert.equal(room.cases.some(item => item.assessmentId === unmanifested.id), false);
  assert.ok(room.cases.every(item => item.partition === "development"));
  assert.ok(room.cases.every(item => item.sourceProfile.generatedContentIncluded === false));
  assert.equal(room.referencesAccepted, false);
});

test("published reference schema prohibits generated content and acceptance", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/counselor-reference-draft-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, COUNSELOR_REFERENCE_CONTRACT);
  assert.equal(schema.properties.type.const, "counselor-reference-draft-recorded");
  assert.equal(schema.properties.authoringMode.const, "source-only");
  assert.equal(schema.properties.sourceSurfaceIncludesGeneratedContent.const, false);
  assert.equal(schema.properties.authorshipIndependenceEstablished.const, false);
  assert.equal(schema.properties.referenceAccepted.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});

test("store persists one immutable development draft per reviewer and keeps holdout closed", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-reference-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "state.json");
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const store = make();
  await store.init();
  const result = await store.recordCounselorReferenceDraft(input, "REVIEWER-01");
  assert.equal(result.draft.sequence, 1);
  assert.equal(result.referenceRoom.metrics.localDrafts, 1);
  assert.equal(result.referenceRoom.currentReviewerHistory.length, 1);
  assert.equal(result.referenceRoom.cases.some(item => item.partition === "holdout"), false);
  await assert.rejects(() => store.recordCounselorReferenceDraft(input, "REVIEWER-01"), error => error.status === 409 && /already submitted/i.test(error.message));
  const holdoutSource = buildCounselorReferenceSource(assessments[1]);
  await assert.rejects(() => store.recordCounselorReferenceDraft({ ...input, assessmentId: assessments[1].id, sourceProfileHash: counselorReferenceSourceHash(holdoutSource) }, "REVIEWER-01"), error => error.status === 409 && /holdout remains unopened/i.test(error.message));
  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyCounselorReferenceDraftChain().valid, true);
  assert.equal((await reopened.counselorReferenceRoomStatus("REVIEWER-02")).currentReviewerHistory.length, 0);
});

test("store fails closed after counselor reference evidence is altered", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-reference-tamper-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "state.json");
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const store = make();
  await store.init();
  await store.recordCounselorReferenceDraft(input, "REVIEWER-01");
  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  persisted.counselorReferenceDrafts[0].themes[0].evidence = ["Invented scale · 99"];
  await writeFile(filePath, JSON.stringify(persisted, null, 2) + "\n", "utf8");
  await assert.rejects(() => make().init(), /Counselor reference draft history integrity check failed/i);
});
