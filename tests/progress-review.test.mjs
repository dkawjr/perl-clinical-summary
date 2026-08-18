import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessments } from "../src/demo-data.js";
import {
  PROGRESS_BRIEF_BOUNDARY,
  PROGRESS_BRIEF_CONTRACT,
  PROGRESS_REVIEW_BOUNDARY,
  PROGRESS_REVIEW_CONTRACT,
  PROGRESS_REVIEW_SERIES,
  buildProgressReview,
  createProgressReviewObservation,
  progressReviewEvidenceSnapshot,
  validateProgressConversationBrief,
  validateProgressReviewContract,
  validateProgressReviewInput,
  validateProgressReviewObservation
} from "../src/progress-review.js";

const input = {
  seriesId: "FF-TEST-SERIES-01",
  focus: "cross-domain-pattern",
  finding: "raw-score-lower",
  disposition: "clarify-context-before-interpretation"
};

test("Progress Review freezes a transparent synthetic pairing and never claims subject linkage", () => {
  assert.equal(PROGRESS_REVIEW_CONTRACT, "perl-synthetic-progress-review/1.0");
  assert.deepEqual(validateProgressReviewContract(), []);
  assert.deepEqual(PROGRESS_REVIEW_SERIES.points.map(point => point.assessmentId), ["FF-TEST-2388-B", "FF-TEST-2411-C"]);
  assert.match(PROGRESS_REVIEW_BOUNDARY, /not an authoritative subject/i);
  assert.match(PROGRESS_REVIEW_BOUNDARY, /does not establish improvement/i);
});

test("Progress Review exposes exact raw deltas without converting them into an outcome claim", () => {
  const review = buildProgressReview({ assessments, generatedAt: "2026-08-14T12:00:00.000Z" });
  assert.equal(review.status, "ready-for-synthetic-rehearsal");
  assert.deepEqual(review.scales.map(scale => [scale.id, scale.earlier, scale.later, scale.delta]), [
    ["depression", 51, 12, -39],
    ["anxiety", 42, 27, -15],
    ["anger", 29, 17, -12],
    ["gpi", 141, 68, -73]
  ]);
  assert.equal(review.sharedSubscales.length, 5);
  assert.equal(review.metrics.directReviewPoints, 0);
  assert.equal(review.authoritativeSubjectLinkage, false);
  assert.equal(review.clinicalProgressEstablished, false);
  assert.equal(review.improvementEstablished, false);
  assert.equal(review.treatmentResponseEstablished, false);
  assert.match(review.descriptor, /meaning still belongs to context/i);
  assert.match(review.seriesFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(review.brief.contractVersion, PROGRESS_BRIEF_CONTRACT);
  assert.deepEqual(validateProgressConversationBrief(review.brief), []);
  assert.match(review.brief.summary, /all four core raw scores are lower/i);
  assert.match(review.brief.summary, /not evidence of improvement, deterioration, or treatment response/i);
  assert.match(review.brief.affirmingOpening, /what feels different, what has helped, and what remains hard/i);
  assert.equal(review.brief.conversationPriorities.length, 4);
  assert.equal(review.brief.generator.externalTransmission, false);
  assert.equal(review.brief.clinicalRecommendationCreated, false);
  assert.equal(review.brief.progressNoteCreated, false);
  assert.match(PROGRESS_BRIEF_BOUNDARY, /not a clinical recommendation/i);
});

test("generated Progress Conversation Brief is stable, evidence-linked, and fails closed on authority tampering", () => {
  const first = buildProgressReview({ assessments, generatedAt: "2026-08-14T12:00:00.000Z" });
  const second = buildProgressReview({ assessments, generatedAt: "2026-08-14T13:00:00.000Z" });
  assert.equal(first.brief.fingerprint, second.brief.fingerprint);
  assert.deepEqual(first.brief.evidence.map(item => [item.scale, item.earlier, item.later, item.delta]), [
    ["depression", 51, 12, -39],
    ["anxiety", 42, 27, -15],
    ["anger", 29, 17, -12],
    ["gpi", 141, 68, -73]
  ]);
  const tampered = structuredClone(first.brief);
  tampered.improvementEstablished = true;
  assert.match(validateProgressConversationBrief(tampered).join(" "), /improvementEstablished must remain false|fingerprint is invalid/i);
});

test("Progress Review fails closed when either frozen source fixture is absent", () => {
  assert.throws(
    () => buildProgressReview({ assessments: assessments.filter(item => item.id !== "FF-TEST-2411-C") }),
    /source is incomplete.*FF-TEST-2411-C/i
  );
});

test("Progress Review input is enum-only and rejects narrative or alternate series", () => {
  assert.deepEqual(validateProgressReviewInput(input), []);
  assert.match(validateProgressReviewInput({ ...input, note: "possible improvement" }).join(" "), /unsupported fields/i);
  assert.match(validateProgressReviewInput({ ...input, seriesId: "FF-TEST-OTHER" }).join(" "), /frozen synthetic/i);
  assert.match(validateProgressReviewInput({ ...input, finding: "clinically-improved" }).join(" "), /outside the fixed descriptive/i);
});

test("Progress Review observations pin evidence and form a tamper-evident chain", () => {
  const review = buildProgressReview({ assessments });
  const evidenceSnapshot = progressReviewEvidenceSnapshot(review);
  const first = createProgressReviewObservation({
    input,
    actor: "REVIEWER-01",
    sequence: 1,
    evidenceSnapshot,
    createdAt: "2026-08-14T12:00:00.000Z",
    id: "12345678-1234-4234-8234-123456789012"
  });
  const second = createProgressReviewObservation({
    input: { ...input, focus: "anxiety", disposition: "carry-to-next-conversation" },
    actor: "REVIEWER-01",
    sequence: 2,
    previousHash: first.hash,
    evidenceSnapshot,
    createdAt: "2026-08-14T12:01:00.000Z",
    id: "22345678-1234-4234-8234-123456789012"
  });
  assert.deepEqual(validateProgressReviewObservation(first, { sequence: 1, previousHash: "GENESIS" }), []);
  assert.deepEqual(validateProgressReviewObservation(second, { sequence: 2, previousHash: first.hash }), []);
  assert.equal(first.improvementEstablished, false);
  const tampered = { ...second, finding: "raw-score-higher" };
  assert.match(validateProgressReviewObservation(tampered, { sequence: 2, previousHash: first.hash }).join(" "), /hash is invalid/i);
});

test("Progress Review JSON schema is strict and pins all denied authority claims", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/progress-review-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, PROGRESS_REVIEW_CONTRACT);
  assert.equal(schema.properties.seriesId.const, PROGRESS_REVIEW_SERIES.id);
  for (const key of [
    "authoritativeSubjectLinkage", "clinicalProgressEstablished", "improvementEstablished",
    "deteriorationEstablished", "treatmentResponseEstablished", "reliableChangeEstablished",
    "meaningfulChangeEstablished", "clinicalValidation", "pilotAuthorized",
    "productionReleaseAuthorized", "patientUseAuthorized"
  ]) assert.equal(schema.properties[key].const, false);
});
