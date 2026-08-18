import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CLINICAL_STANDARD_BOUNDARY,
  CLINICAL_STANDARD_CONTRACT,
  CLINICAL_STANDARD_FIELDS,
  NON_NEGOTIABLE_SAFETY_LIMITS,
  clinicalStandardStatus,
  createClinicalStandardDraft,
  normalizeClinicalStandardInput,
  validateClinicalStandardDraft
} from "../src/clinical-standard.js";

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

const evidenceHeads = Object.fromEntries(["feedback", "revisions", "blindOutcomes", "incidents", "workflowTiming"].map(key => [key, "GENESIS"]));
const emptyAnalysis = { sample: {}, safety: { exposure: {} } };

test("clinical-standard contract fixes seven bounded measures and zero-tolerance safety limits", () => {
  assert.equal(CLINICAL_STANDARD_CONTRACT, "perl-clinical-standard-draft/1.0");
  assert.equal(CLINICAL_STANDARD_FIELDS.length, 7);
  assert.deepEqual(NON_NEGOTIABLE_SAFETY_LIMITS, {
    criticalScreenOmissions: 0,
    unsupportedDiagnosticCertainty: 0,
    inventedOrMismatchedEvidence: 0,
    unresolvedHighOrCriticalIncidents: 0
  });
  const normalized = normalizeClinicalStandardInput(input);
  assert.equal(normalized.thresholds.minimumBlindPreferenceRate, 0.65);
  assert.equal(normalized.thresholds.minimumPreferenceAgreementAc1, 0.7);
  assert.throws(() => normalizeClinicalStandardInput({ ...input, thresholds: { ...input.thresholds, minimumBlindPreferenceRate: 49 } }), /between 50 and 100/i);
});

test("a draft truthfully records whether outcome evidence existed at creation", () => {
  const before = createClinicalStandardDraft({ input, actor: "REVIEWER-01", version: 1, analysis: emptyAnalysis, evidenceHeads, createdAt: "2026-08-14T00:00:00.000Z", id: "4c5ec929-2944-4c65-8e2a-b80ebad45d3a" });
  assert.equal(before.preOutcomeCandidate, true);
  assert.equal(before.evidenceAtDraft.outcomeEvidenceObserved, false);
  assert.deepEqual(validateClinicalStandardDraft(before), []);

  const after = createClinicalStandardDraft({ input, actor: "REVIEWER-01", version: 2, analysis: { sample: { pairedComparisons: 1 }, safety: { exposure: {} } }, evidenceHeads, createdAt: "2026-08-14T01:00:00.000Z", id: "df6e84ab-6d7c-49f9-9025-14746cf52de2" });
  assert.equal(after.preOutcomeCandidate, false);
  assert.equal(after.evidenceAtDraft.counts.pairedBlindComparisons, 1);
  assert.deepEqual(validateClinicalStandardDraft(after), []);
});

test("draft validation rejects altered claims, safety limits, and fingerprints", () => {
  const draft = createClinicalStandardDraft({ input, actor: "REVIEWER-01", version: 1, analysis: emptyAnalysis, evidenceHeads });
  assert.ok(validateClinicalStandardDraft({ ...draft, clinicalValidation: true }).some(error => /clinicalValidation/i.test(error)));
  assert.ok(validateClinicalStandardDraft({ ...draft, nonNegotiableSafetyLimits: { ...draft.nonNegotiableSafetyLimits, criticalScreenOmissions: 1 } }).some(error => /safety limits/i.test(error)));
  assert.ok(validateClinicalStandardDraft({ ...draft, rationale: `${draft.rationale} altered` }).some(error => /fingerprint/i.test(error)));
});

test("status exposes working drafts without adding acceptance or release authority", () => {
  const draft = createClinicalStandardDraft({ input, actor: "REVIEWER-01", version: 1, analysis: emptyAnalysis, evidenceHeads });
  const status = clinicalStandardStatus({ drafts: [draft], chain: { valid: true, count: 1, head: "a".repeat(64) }, analysis: emptyAnalysis });
  assert.equal(status.status, "working-draft-recorded");
  assert.equal(status.latestDraft.hash, draft.hash);
  assert.equal(status.counselorPanelAccepted, false);
  assert.equal(status.protocolFrozen, false);
  assert.equal(status.clinicalValidation, false);
  assert.equal(status.patientUseAuthorized, false);
  assert.equal(status.boundary, CLINICAL_STANDARD_BOUNDARY);
});

test("clinical-standard event schema is strict and non-authorizing", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/clinical-standard-draft-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, CLINICAL_STANDARD_CONTRACT);
  assert.equal(schema.properties.type.const, "clinical-standard-draft-recorded");
  assert.match(schema.description, /cannot freeze a protocol or authorize clinical use/i);
});
