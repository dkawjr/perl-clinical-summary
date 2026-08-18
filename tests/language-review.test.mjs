import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createIntendedUseDraft } from "../src/intended-use.js";
import {
  LANGUAGE_REVIEW_ACCEPTANCES,
  LANGUAGE_REVIEW_BOUNDARY,
  LANGUAGE_REVIEW_CONTRACT,
  LANGUAGE_REVIEW_QUESTIONS,
  buildLanguageReviewOffice,
  createLanguageReviewEvent,
  createLanguageReviewPacket,
  languageReviewSurfaces,
  validateLanguageReviewContract,
  validateLanguageReviewEvent,
  validateLanguageReviewPacket
} from "../src/language-review.js";

const intendedEvidence = {
  reportContract: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  modelInputContract: "perl-scored-profile/1.0",
  generationPolicyVersion: "perl-clinical-generation-policy/1.0",
  generationPolicyHash: "a".repeat(64),
  audienceFormatCount: 4,
  chainHeads: { reportArtifacts: "GENESIS", generationSnapshots: "GENESIS", pilotReadiness: "GENESIS", clinicalStandard: "GENESIS" }
};

const intendedUseDraft = createIntendedUseDraft({
  input: {
    pilotContext: "point-of-care-review",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise evidence-linked summary for accountable review at the start of a care conversation, beside the unchanged Findings report.",
    rationale: "This provider-first scope preserves source authority, direct safety review, and accountable clinical judgment."
  },
  actor: "LANGUAGE-QA",
  version: 1,
  evidenceSnapshot: intendedEvidence,
  createdAt: "2026-08-14T12:00:00.000Z",
  id: "intended-use-1"
});

const languageEvidence = {
  reportContract: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  audienceContract: "perl-audience-handoff/1.0",
  intendedUseContract: "perl-intended-use-charter/1.0",
  intendedUseDraftHash: intendedUseDraft.hash,
  reportArtifactHead: "GENESIS"
};

function packet() {
  return createLanguageReviewPacket({
    intendedUseDraft,
    evidenceSnapshot: languageEvidence,
    actor: "LANGUAGE-QA",
    version: 1,
    createdAt: "2026-08-14T12:30:00.000Z",
    id: "language-packet-1"
  });
}

test("language office fixes nine live copy surfaces, six review questions, and five external acceptances", () => {
  assert.equal(LANGUAGE_REVIEW_CONTRACT, "perl-language-review-packet/1.0");
  assert.deepEqual(validateLanguageReviewContract(), []);
  assert.equal(languageReviewSurfaces(intendedUseDraft).length, 9);
  assert.equal(LANGUAGE_REVIEW_QUESTIONS.length, 6);
  assert.equal(LANGUAGE_REVIEW_ACCEPTANCES.length, 5);
  assert.match(LANGUAGE_REVIEW_BOUNDARY, /not clinical acceptance/i);
});

test("copy corpus is derived from the live report, audience, and intended-use contracts", () => {
  const surfaces = languageReviewSurfaces(intendedUseDraft);
  assert.equal(surfaces[0].currentText, intendedUseDraft.scopeStatement);
  assert.match(surfaces.find(item => item.id === "clinical-disclaimer").currentText, /does not diagnose/i);
  assert.match(surfaces.find(item => item.id === "payer-boundary").currentText, /does not establish diagnosis, medical necessity/i);
  assert.match(surfaces.find(item => item.id === "admin-boundary").currentText, /contains no clinical interpretation/i);
});

test("working packet pins exact copy and cannot create legal or clinical authority", () => {
  const value = packet();
  assert.deepEqual(validateLanguageReviewPacket(value), []);
  assert.equal(value.surfaces.length, 9);
  assert.equal(value.legalApproved, false);
  assert.equal(value.disclaimerApproved, false);
  assert.equal(value.languageFrozen, false);
  assert.equal(value.patientUseAuthorized, false);
  assert.match(value.corpusFingerprint, /^[a-f0-9]{64}$/);
});

test("packet validation rejects invented approval or altered copy", () => {
  const approved = structuredClone(packet());
  approved.legalApproved = true;
  assert.match(validateLanguageReviewPacket(approved).join(" "), /legalApproved must remain false/i);
  const altered = structuredClone(packet());
  altered.surfaces[0].currentText += " Approved.";
  assert.match(validateLanguageReviewPacket(altered).join(" "), /corpus fingerprint|packet fingerprint/i);
});

test("language review events remain hash-linked and non-authorizing", () => {
  const value = packet();
  const event = createLanguageReviewEvent({ packet: value, sequence: 1, previousHash: "GENESIS", id: "language-event-1" });
  assert.deepEqual(validateLanguageReviewEvent(event, { sequence: 1, previousHash: "GENESIS", packet: value }), []);
  assert.equal(event.acceptancesRecorded, 0);
  assert.equal(event.productionReleaseAuthorized, false);
  const status = buildLanguageReviewOffice({ intendedUseDraft, packets: [value], chain: { valid: true, count: 1, head: event.hash }, evidenceSnapshot: languageEvidence });
  assert.equal(status.status, "review-packet-sealed-unaccepted");
  assert.equal(status.counts.acceptancesRecorded, 0);
});

test("published language review event schema hard-codes absent authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/language-review-packet-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contractVersion.const, LANGUAGE_REVIEW_CONTRACT);
  assert.equal(schema.properties.copySurfaceCount.const, 9);
  assert.equal(schema.properties.legalApproved.const, false);
  assert.equal(schema.properties.languageFrozen.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
  assert.equal(schema.additionalProperties, false);
});
