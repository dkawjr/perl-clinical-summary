import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INTENDED_USE_ACCEPTANCES,
  INTENDED_USE_AUDIENCES,
  INTENDED_USE_BOUNDARY,
  INTENDED_USE_CONTEXTS,
  INTENDED_USE_CONTRACT,
  INTENDED_USE_PROHIBITIONS,
  createIntendedUseDraft,
  createIntendedUseEvent,
  intendedUseStatus,
  normalizeIntendedUseInput,
  validateIntendedUseContract,
  validateIntendedUseDraft,
  validateIntendedUseEvent
} from "../src/intended-use.js";

const input = {
  pilotContext: "point-of-care-review",
  scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise, evidence-linked summary for review at the start of a care conversation. The summary remains an additional page beside the unchanged Findings report.",
  rationale: "This provider-first scope addresses the interpretation step described in the proposal while preserving the e-QPASS score authority, human review, and audience-specific disclosure boundaries."
};

const evidenceSnapshot = {
  reportContract: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  modelInputContract: "perl-scored-profile/1.0",
  generationPolicyVersion: "perl-clinical-generation-policy/1.0",
  generationPolicyHash: "a".repeat(64),
  audienceFormatCount: 4,
  chainHeads: {
    reportArtifacts: "GENESIS",
    generationSnapshots: "b".repeat(64),
    pilotReadiness: "c".repeat(64),
    clinicalStandard: "GENESIS"
  }
};

test("intended-use charter fixes the provider-first purpose, four audiences, eight prohibitions, and five external acceptances", () => {
  assert.equal(INTENDED_USE_CONTRACT, "perl-intended-use-charter/1.0");
  assert.deepEqual(validateIntendedUseContract(), []);
  assert.equal(INTENDED_USE_CONTEXTS.length, 3);
  assert.equal(INTENDED_USE_AUDIENCES.length, 4);
  assert.equal(INTENDED_USE_AUDIENCES[0].id, "clinician");
  assert.equal(INTENDED_USE_PROHIBITIONS.length, 8);
  assert.equal(INTENDED_USE_ACCEPTANCES.length, 5);
  assert.match(INTENDED_USE_BOUNDARY, /not executive acceptance/i);
  assert.match(INTENDED_USE_BOUNDARY, /not professional credentials or signatures/i);
});

test("intended-use input is bounded and rejects autonomous or clinical-authority assertions", () => {
  assert.deepEqual(normalizeIntendedUseInput(input), input);
  assert.throws(() => normalizeIntendedUseInput({ ...input, pilotContext: "consumer-self-service" }), /provider-first pilot context/i);
  assert.throws(() => normalizeIntendedUseInput({ ...input, scopeStatement: "PERL will diagnose and prescribe for every patient without human review. This text is deliberately extended to pass the minimum length boundary while preserving the unsafe assertion." }), /cannot assert diagnosis/i);
  assert.throws(() => normalizeIntendedUseInput({ ...input, rationale: "Too short." }), /40–1200/i);
});

test("working drafts pin report, generation, audience, prohibition, and authority boundaries", () => {
  const draft = createIntendedUseDraft({ input, actor: "GOVERNANCE-QA", version: 1, evidenceSnapshot, createdAt: "2026-08-14T12:00:00.000Z", id: "a3a7d54a-5c7c-4c0d-83c2-1c7d3ad95304" });
  assert.deepEqual(validateIntendedUseDraft(draft), []);
  assert.equal(draft.providerFirst, true);
  assert.equal(draft.humanReviewRequired, true);
  assert.equal(draft.automatedClinicalDecisionAllowed, false);
  assert.equal(draft.requiredAcceptances.length, 5);
  assert.equal(draft.legalApproved, false);
  assert.equal(draft.patientUseAuthorized, false);

  assert.ok(validateIntendedUseDraft({ ...draft, legalApproved: true }).some(error => /legalApproved/i.test(error)));
  const altered = structuredClone(draft);
  altered.prohibitedUses.pop();
  assert.ok(validateIntendedUseDraft(altered).some(error => /Prohibited-use contract|fingerprint/i.test(error)));
});

test("intended-use events remain hash-linked and non-authorizing", () => {
  const draft = createIntendedUseDraft({ input, actor: "GOVERNANCE-QA", version: 1, evidenceSnapshot, createdAt: "2026-08-14T12:00:00.000Z" });
  const first = createIntendedUseEvent({ draft, sequence: 1, previousHash: "GENESIS" });
  assert.deepEqual(validateIntendedUseEvent(first, { sequence: 1, previousHash: "GENESIS", draft }), []);
  assert.equal(first.acceptancesRequired, 5);
  assert.equal(first.acceptancesRecorded, 0);
  assert.equal(first.intendedUseFrozen, false);
  assert.ok(validateIntendedUseEvent({ ...first, clinicalLeadApproved: true }, { sequence: 1, previousHash: "GENESIS", draft }).some(error => /clinicalLeadApproved/i.test(error)));
});

test("status exposes working history without turning a draft into acceptance", () => {
  const empty = intendedUseStatus({ chain: { valid: true, count: 0, head: null } });
  assert.equal(empty.status, "definition-required-before-legal-review");
  assert.equal(empty.counts.acceptancesRecorded, 0);
  const draft = createIntendedUseDraft({ input, actor: "GOVERNANCE-QA", version: 1, evidenceSnapshot });
  const current = intendedUseStatus({ drafts: [draft], chain: { valid: true, count: 1, head: "d".repeat(64) } });
  assert.equal(current.status, "working-charter-recorded");
  assert.equal(current.latestDraft.version, 1);
  assert.equal(current.intendedUseFrozen, false);
  assert.equal(current.pilotAuthorized, false);
});

test("published intended-use event schema hard-codes absent approval and release authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/intended-use-draft-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, INTENDED_USE_CONTRACT);
  assert.equal(schema.properties.providerFirst.const, true);
  assert.equal(schema.properties.acceptancesRequired.const, 5);
  assert.equal(schema.properties.acceptancesRecorded.const, 0);
  assert.equal(schema.properties.legalApproved.const, false);
  assert.equal(schema.properties.intendedUseFrozen.const, false);
  assert.equal(schema.properties.pilotAuthorized.const, false);
  assert.equal(schema.properties.productionReleaseAuthorized.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});
