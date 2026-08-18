import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INDEPENDENT_REVIEW_BOUNDARY,
  INDEPENDENT_REVIEW_CONTRACT,
  INDEPENDENT_REVIEW_DOMAINS,
  INDEPENDENT_REVIEW_GATES,
  INDEPENDENT_REVIEW_INPUTS,
  buildIndependentReviewDossier,
  createIndependentReviewSnapshot,
  validateIndependentReviewContract,
  validateIndependentReviewSnapshot
} from "../src/independent-review.js";

const integrity = Object.fromEntries(["feedback", "revisions", "blindOutcomes", "incidents", "workflowTiming"].map(key => [key, { valid: true, count: 0, head: null }]));
const analysis = {
  sample: { pairedComparisons: 2, reviewers: 2, workflowTimingObservations: 1, feedbackEntries: 1 },
  caseSet: { id: "perl-synthetic-rehearsal-2026-08-v1", version: "1.0.0", cases: 3 },
  safety: { unresolvedHighSeverity: 0 },
  releaseEvidence: { engineeringRegressionPassed: true, outcomes: { criticalScreenHandling: { status: "pass" } } },
  integrity
};
const manifestPackage = { manifest: { id: "perl-synthetic-rehearsal-2026-08-v1", version: "1.0.0" }, integrity: { manifestHash: "a".repeat(64) } };
const runtimeVersions = { model: "cal-0.9.3", "report-template": "perl-clinician-report/1.0", disclaimer: "draft", "state-schema": "sandbox-state/24", "release-evaluator": "deterministic-offline-v2" };

test("independent review contract fixes domains, inputs, and non-authorizing gates", () => {
  assert.equal(INDEPENDENT_REVIEW_CONTRACT, "perl-independent-review-dossier/1.0");
  assert.match(INDEPENDENT_REVIEW_BOUNDARY, /can never substitute/i);
  assert.deepEqual(validateIndependentReviewContract(), []);
  assert.equal(INDEPENDENT_REVIEW_DOMAINS.length, 6);
  assert.equal(INDEPENDENT_REVIEW_INPUTS.length, 8);
  assert.equal(INDEPENDENT_REVIEW_GATES.filter(gate => gate.category === "local-pattern").length, 4);
  assert.equal(INDEPENDENT_REVIEW_GATES.filter(gate => gate.category === "external-authority").length, 6);
  assert.deepEqual(INDEPENDENT_REVIEW_INPUTS.filter(item => item.filename).map(item => item.filename), ["meta_thresholds_responses_cs.xlsx", "question_categories_capitalized.xlsx"]);
});

test("dossier derives reproducible local evidence while every external decision stays open", () => {
  const dossier = buildIndependentReviewDossier({ analysis, clinicalStandard: { history: [] }, manifestPackage, runtimeVersions, generatedAt: "2026-08-14T00:00:00.000Z" });
  assert.equal(dossier.gateCounts.localCurrent, 4);
  assert.equal(dossier.gateCounts.externalAccepted, 0);
  assert.equal(dossier.gateCounts.externalDecisionRequired, 6);
  assert.equal(dossier.independentEvaluatorNamed, false);
  assert.equal(dossier.independentReviewComplete, false);
  assert.equal(dossier.accuracyEstablished, false);
  assert.equal(dossier.reliabilityEstablished, false);
  assert.equal(dossier.clinicalValidation, false);
  assert.equal(dossier.sourceWorkbooksConnected, false);
  assert.match(dossier.reviewPackageHash, /^[a-f0-9]{64}$/);
  assert.match(dossier.dossierFingerprint, /^[a-f0-9]{64}$/);
});

test("dossier binds a verified counselor-reference freeze as one upstream dependency without recording approval", () => {
  const referenceDecision = {
    docketFingerprint: "b".repeat(64),
    referenceSetAccepted: true,
    protocolFrozen: true,
    independentReviewHandoffReady: true,
    counts: { verifiedExternalDuties: 4 },
    purposes: [{ purpose: "reference-protocol-freeze", attestationFingerprint: "c".repeat(64) }],
    chain: { valid: true, count: 5, head: "d".repeat(64) }
  };
  const dossier = buildIndependentReviewDossier({ analysis, clinicalStandard: { history: [] }, manifestPackage, runtimeVersions, referenceDecision, generatedAt: "2026-08-14T00:00:00.000Z" });
  assert.equal(dossier.gateCounts.externalAccepted, 1);
  assert.equal(dossier.gateCounts.externalDecisionRequired, 5);
  assert.equal(dossier.controlledInputs.find(item => item.id === "counselor-reference-freeze").status, "externally-verified-dependency");
  assert.equal(dossier.evidenceSnapshot.referenceDecisionDocketFingerprint, referenceDecision.docketFingerprint);
  assert.equal(dossier.externalApprovalsRecorded, false);
  const event = createIndependentReviewSnapshot({ dossier, actor: "REVIEW-QA", sequence: 1 });
  assert.deepEqual(validateIndependentReviewSnapshot(event), []);
  assert.equal(event.referenceDependency.verifiedDuties, 4);
  assert.equal(event.externalApprovalsRecorded, false);
});

test("local seal captures exact evidence state without recording an evaluator decision", () => {
  const dossier = buildIndependentReviewDossier({ analysis, clinicalStandard: { history: [] }, manifestPackage, runtimeVersions });
  const event = createIndependentReviewSnapshot({ dossier, actor: "REVIEW-QA", sequence: 1, createdAt: "2026-08-14T00:00:00.000Z" });
  assert.deepEqual(validateIndependentReviewSnapshot(event), []);
  assert.equal(event.decision, "independent-review-not-authorized");
  assert.equal(event.externalApprovalsRecorded, false);
  assert.equal(event.independentReviewComplete, false);
  assert.equal(event.accuracyEstablished, false);
  assert.equal(event.reliabilityEstablished, false);
});

test("local seal validation rejects altered authority, counts, and fingerprints", () => {
  const dossier = buildIndependentReviewDossier({ analysis, clinicalStandard: { history: [] }, manifestPackage, runtimeVersions });
  const event = createIndependentReviewSnapshot({ dossier, actor: "REVIEW-QA", sequence: 1 });
  assert.ok(validateIndependentReviewSnapshot({ ...event, independentReviewComplete: true }).some(error => /independentReviewComplete/i.test(error)));
  assert.ok(validateIndependentReviewSnapshot({ ...event, gateCounts: { ...event.gateCounts, externalDecisionRequired: 5 } }).some(error => /gate counts/i.test(error)));
  assert.ok(validateIndependentReviewSnapshot({ ...event, note: `${event.note} altered` }).some(error => /fingerprint/i.test(error)));
});

test("independent-review event schema is strict and cannot assert validation", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/independent-review-dossier-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, INDEPENDENT_REVIEW_CONTRACT);
  assert.equal(schema.properties.externalApprovalsRecorded.const, false);
  assert.equal(schema.properties.independentReviewComplete.const, false);
  assert.equal(schema.properties.accuracyEstablished.const, false);
  assert.equal(schema.properties.reliabilityEstablished.const, false);
  assert.equal(schema.properties.clinicalValidation.const, false);
  assert.match(schema.description, /cannot name an evaluator/i);
});
