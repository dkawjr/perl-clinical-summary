import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assessments, auditSeed } from "../src/demo-data.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import {
  buildCounselorReferenceSource,
  counselorReferenceSourceHash,
  createCounselorReferenceDraft
} from "../src/counselor-reference.js";
import {
  COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY,
  COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT,
  COUNSELOR_REFERENCE_ADJUDICATION_GATES,
  buildCounselorReferenceAdjudicationDossier,
  createCounselorReferenceAdjudicationSnapshot,
  validateCounselorReferenceAdjudicationContract,
  validateCounselorReferenceAdjudicationSnapshot
} from "../src/counselor-reference-adjudication.js";

const assessment = assessments.find(item => calibrationManifest.cases[item.id]?.partition === "development");
const sourceProfile = buildCounselorReferenceSource(assessment);
const sourceProfileHash = counselorReferenceSourceHash(sourceProfile);
const caseSet = {
  id: calibrationManifest.id,
  version: calibrationManifest.version,
  partition: "development",
  referenceVersion: calibrationManifest.cases[assessment.id].referenceVersion
};

function inputFor(variant = 1) {
  return {
    assessmentId: assessment.id,
    sourceProfileHash,
    authoringMode: "source-only",
    summary: variant === 1
      ? "Self-report scores show mild depression and anxiety indicators with minimal global distress. Clarify timing, context, functioning, and the non-zero critical screen directly before using the pattern in care planning."
      : "The scored pattern suggests contained overall distress with comparatively stronger apprehension and negative cognition indicators. Direct review should clarify the critical response, duration, context, and functional impact.",
    themes: [{
      title: variant === 1 ? "Cognitive tension with contained burden" : "Apprehension warrants contextual review",
      body: variant === 1
        ? "Apprehension and negative cognition are more prominent than the other scored constructs, while the global index remains minimal. Clarify whether this pattern is situational or persistent."
        : "Apprehension is elevated relative to the global index, but the scored profile does not explain cause, duration, or impairment. Clarify the pattern in direct conversation.",
      confidence: variant === 1 ? "Moderate" : "Low",
      evidence: variant === 1
        ? ["Apprehension · 9", "Negative cognition · 7", "Global index · 55"]
        : ["Apprehension · 9", "Global index · 55"],
      uncertainty: "The scored profile does not establish duration, cause, functional impact, or persistence outside this assessment context."
    }],
    questions: variant === 1
      ? ["Which situations most reliably activate worry or self-critical thinking?", "What does the person understand the non-zero critical-screen response to mean?"]
      : ["When is apprehension most noticeable?", "How does the person explain the critical-screen response in their own words?"],
    toneMarkers: variant === 1
      ? ["indicator-language", "explicit-uncertainty", "plain-clinical-language", "critical-route-visible"]
      : ["indicator-language", "explicit-uncertainty", "critical-route-visible"],
    criticalReviewDisposition: "requires-direct-review"
  };
}

function twoDrafts() {
  const first = createCounselorReferenceDraft({
    input: inputFor(1), sourceProfile, caseSet, actor: "REVIEWER-01", sequence: 1,
    createdAt: "2026-08-14T18:00:00.000Z", id: "11111111-1111-4111-8111-111111111111"
  });
  const second = createCounselorReferenceDraft({
    input: inputFor(2), sourceProfile, caseSet, actor: "REVIEWER-02", sequence: 2, previousHash: first.hash,
    createdAt: "2026-08-14T18:05:00.000Z", id: "22222222-2222-4222-8222-222222222222"
  });
  return [first, second];
}

function dossierFor(actor) {
  const drafts = twoDrafts();
  return buildCounselorReferenceAdjudicationDossier({
    assessments,
    drafts,
    referenceChain: { valid: true, count: 2, head: drafts[1].hash },
    manifest: calibrationManifest,
    actor,
    generatedAt: "2026-08-14T18:10:00.000Z"
  });
}

test("adjudication contract fixes eight gates and denies majority-vote authority", () => {
  assert.equal(COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT, "perl-counselor-reference-adjudication-dossier/1.0");
  assert.deepEqual(validateCounselorReferenceAdjudicationContract(), []);
  assert.equal(COUNSELOR_REFERENCE_ADJUDICATION_GATES.length, 8);
  assert.equal(COUNSELOR_REFERENCE_ADJUDICATION_GATES.filter(gate => gate.category === "external-authority").length, 5);
  assert.match(COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY, /majority vote is not clinical acceptance/i);
  assert.match(COUNSELOR_REFERENCE_ADJUDICATION_BOUNDARY, /author codes remain hidden/i);
});

test("a contributing reviewer sees anonymized candidates while an outsider remains contamination-blind", () => {
  const eligible = dossierFor("REVIEWER-01");
  const firstCase = eligible.cases.find(item => item.assessmentId === assessment.id);
  assert.equal(firstCase.locallyComparable, true);
  assert.equal(firstCase.candidateContentVisible, true);
  assert.deepEqual(firstCase.candidates.map(item => item.candidateLabel), ["Draft A", "Draft B"]);
  assert.ok(firstCase.candidates.every(item => item.authorCodeIncluded === false && !Object.hasOwn(item, "actor")));
  assert.equal(firstCase.structuralSynthesis.semanticAgreementAssessed, false);
  assert.equal(firstCase.structuralSynthesis.majorityDecisionCreated, false);
  assert.equal(firstCase.structuralSynthesis.disagreementsPreserved, true);
  assert.ok(firstCase.structuralSynthesis.sharedEvidenceCitationCount > 0);
  assert.equal(firstCase.referenceAccepted, false);

  const withheld = dossierFor("REVIEWER-03").cases.find(item => item.assessmentId === assessment.id);
  assert.equal(withheld.locallyComparable, true);
  assert.equal(withheld.candidateContentVisible, false);
  assert.ok(withheld.candidates.every(item => item.summary === null && item.themes.length === 0 && item.questions.length === 0));
  assert.equal(withheld.structuralSynthesis.uniqueEvidenceCitationCount, 0);
  assert.equal(withheld.structuralSynthesis.evidenceConcordance.length, 0);
});

test("a sealed dossier records evidence state while every authority claim remains false", () => {
  const dossier = dossierFor("REVIEWER-01");
  const snapshot = createCounselorReferenceAdjudicationSnapshot({
    dossier,
    actor: "REVIEWER-01",
    sequence: 1,
    createdAt: "2026-08-14T18:12:00.000Z",
    id: "33333333-3333-4333-8333-333333333333"
  });
  assert.deepEqual(validateCounselorReferenceAdjudicationSnapshot(snapshot), []);
  for (const key of [
    "counselorIdentityVerified", "authorshipIndependenceEstablished", "adjudicatorAssigned", "adjudicationCompleted",
    "referenceAccepted", "protocolFrozen", "accuracyEstablished", "reliabilityEstablished", "clinicalValidation",
    "trialExecutionAuthorized", "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
  ]) assert.equal(snapshot[key], false);
  const altered = structuredClone(snapshot);
  altered.referenceAccepted = true;
  assert.match(validateCounselorReferenceAdjudicationSnapshot(altered).join(" "), /referenceAccepted must remain false|hash is invalid/i);
});

test("published adjudication schema is strict and hard-codes absent authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/counselor-reference-adjudication-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, COUNSELOR_REFERENCE_ADJUDICATION_CONTRACT);
  assert.equal(schema.properties.type.const, "counselor-reference-adjudication-dossier-sealed");
  assert.equal(schema.properties.referenceAccepted.const, false);
  assert.equal(schema.properties.adjudicationCompleted.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
  assert.equal(schema.properties.gateStates.minItems, 8);
});

test("store persists one idempotent adjudication snapshot and fails closed after tampering", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-reference-adjudication-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "state.json");
  const make = () => new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  const store = make();
  await store.init();
  await store.recordCounselorReferenceDraft(inputFor(1), "REVIEWER-01");
  await store.recordCounselorReferenceDraft(inputFor(2), "REVIEWER-02");
  const first = await store.sealCounselorReferenceAdjudication("REVIEWER-01");
  assert.equal(first.created, true);
  assert.equal(first.adjudication.cases.find(item => item.assessmentId === assessment.id).candidateContentVisible, true);
  const repeated = await store.sealCounselorReferenceAdjudication("REVIEWER-01");
  assert.equal(repeated.created, false);
  assert.equal(store.verifyCounselorReferenceAdjudicationChain().count, 1);

  const reopened = make();
  await reopened.init();
  assert.equal(reopened.verifyCounselorReferenceAdjudicationChain().valid, true);
  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  persisted.counselorReferenceAdjudicationEvents[0].referenceAccepted = true;
  await writeFile(filePath, JSON.stringify(persisted, null, 2) + "\n", "utf8");
  await assert.rejects(() => make().init(), /Counselor reference adjudication history integrity check failed/i);
});
