import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createPerlServer } from "../server.mjs";
import {
  CAMPUS_CUSTOMIZATION_POSITIONS,
  CAMPUS_MEASURE_BOOK,
  CAMPUS_OBSERVATORY_BOUNDARY,
  CAMPUS_OBSERVATORY_CONTRACT,
  CAMPUS_REVIEW_MOMENTS,
  buildCampusObservatory,
  createCampusObservatorySnapshot,
  validateCampusObservatoryContract,
  validateCampusObservatorySnapshot,
  validateCampusObservatorySnapshotInput
} from "../src/campus-observatory.js";

const pilotOperations = {
  planFingerprint: "a".repeat(64),
  candidates: [
    { id: "north-central-counseling-center", index: "01", label: "North Central University", setting: "Counseling-center candidate", status: "source-reported-working-plan", scope: "Counseling-center use only; group/dashboard access was source-proposed.", workingWindow: "Ten-month working term, August–May; no start date is recorded.", customization: "One survey-question decision remains open." },
    { id: "cooper-psych-clinic-qi", index: "02", label: "Cooper University", setting: "Psychiatric-clinic QI candidate", status: "source-reported-interest", scope: "Diagnostic-agnostic provider-side QI exploration only.", workingWindow: "No verified window.", customization: "No customization assumed." }
  ]
};

const providerActivation = {
  workbookFingerprint: "b".repeat(64),
  counts: { modules: 4, objectives: 8, acceptedCompletions: 0, activatedSites: 0 }
};

const operationalCounts = {
  assessmentsEligible: 4,
  summariesGenerated: 4,
  reviewsDisposed: 2,
  summariesApproved: 2,
  correctionRecords: 1,
  criticalScreens: 2,
  criticalRoutesRequired: 2,
  timingObservations: 0,
  usefulnessRatings: 0,
  openIncidents: 0
};

const evidenceContext = {
  stateSchemaVersion: 43,
  pilotPlanFingerprint: "a".repeat(64),
  providerActivationFingerprint: "b".repeat(64),
  reportContract: "perl-clinician-report/1.0",
  caseSet: { id: "FF-QA", version: "1.0" },
  chainHeads: { pilotOperations: "GENESIS", providerActivation: "GENESIS", reports: "GENESIS", generation: "GENESIS", feedback: "GENESIS", timing: "GENESIS", incidents: "GENESIS" }
};

function observatory(events = []) {
  return buildCampusObservatory({ pilotOperations, providerActivation, operationalCounts, evidenceContext, events, chain: { valid: true, count: events.length, head: events.at(-1)?.hash || null }, generatedAt: "2026-08-14T22:00:00.000Z" });
}

test("campus observatory fixes four review moments, four customization positions, and six denominator-first measures", () => {
  assert.deepEqual(validateCampusObservatoryContract(), []);
  assert.equal(CAMPUS_OBSERVATORY_CONTRACT, "perl-campus-operations-observatory/1.0");
  assert.equal(CAMPUS_REVIEW_MOMENTS.length, 4);
  assert.equal(CAMPUS_CUSTOMIZATION_POSITIONS.length, 4);
  assert.equal(CAMPUS_MEASURE_BOOK.length, 6);
  assert.match(CAMPUS_OBSERVATORY_BOUNDARY, /aggregate-only operating surface/i);
  assert.match(CAMPUS_OBSERVATORY_BOUNDARY, /not a site report/i);
});

test("aggregate readings keep synthetic activity distinct from missing pilot evidence", () => {
  const built = observatory();
  assert.equal(built.operatingCounts.assessmentsEligible, 4);
  assert.equal(built.operatingCounts.summariesGenerated, 4);
  assert.equal(built.measures.find(item => item.id === "eligible-activity").percentage, 100);
  assert.equal(built.measures.find(item => item.id === "review-completion").percentage, 50);
  assert.equal(built.measures.find(item => item.id === "critical-routing").percentage, 100);
  assert.equal(built.measures.find(item => item.id === "workflow-time").state, "awaiting-evidence");
  assert.equal(built.measures.find(item => item.id === "counselor-usefulness").state, "awaiting-evidence");
  assert.equal(built.recordRowsIncluded, false);
  assert.equal(built.phiIncluded, false);
  assert.equal(built.siteVerified, false);
  assert.equal(built.pilotAuthorized, false);
  assert.equal(built.clinicalOutcomeEstablished, false);
  assert.ok(/^[a-f0-9]{64}$/.test(built.observatoryFingerprint));
});

test("quarterly-review input rejects extra fields and unknown choices", () => {
  const candidates = pilotOperations.candidates.map(item => item.id);
  assert.deepEqual(validateCampusObservatorySnapshotInput({ candidateId: candidates[0], reviewMomentId: "quarter-one", customizationPositionId: "defer-customization" }, candidates), []);
  const errors = validateCampusObservatorySnapshotInput({ candidateId: "invented-site", reviewMomentId: "quarter-five", customizationPositionId: "custom-prose", studentName: "No" }, candidates);
  assert.ok(errors.some(error => /Unexpected snapshot field/.test(error)));
  assert.ok(errors.some(error => /source-backed provider candidate/.test(error)));
  assert.ok(errors.some(error => /fixed review moment/.test(error)));
  assert.ok(errors.some(error => /bounded customization position/.test(error)));
});

test("snapshot is tamper-evident and cannot become site, quarter, outcome, or pilot evidence", () => {
  const built = observatory();
  const event = createCampusObservatorySnapshot({
    observatory: built,
    input: { candidateId: "north-central-counseling-center", reviewMomentId: "quarter-one", customizationPositionId: "evaluate-one-survey-question" },
    actor: "CAMPUS-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T22:01:00.000Z",
    id: "33333333-3333-4333-8333-333333333333"
  });
  assert.deepEqual(validateCampusObservatorySnapshot(event), []);
  assert.equal(event.aggregateOnly, true);
  assert.equal(event.quarterOccurred, false);
  assert.equal(event.customizationApproved, false);
  assert.equal(event.reviewCompleted, false);
  assert.equal(event.pilotStarted, false);
  assert.equal(observatory([event]).latestSnapshot.current, true);
  const tampered = structuredClone(event);
  tampered.pilotAuthorized = true;
  assert.ok(validateCampusObservatorySnapshot(tampered).some(error => /pilotAuthorized must remain false|snapshot hash is invalid/.test(error)));
});

async function withServer(t) {
  const directory = await mkdtemp(join(tmpdir(), "perl-campus-observatory-test-"));
  const storePath = join(directory, "state.json");
  const runtime = await createPerlServer({ storePath });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise(resolve => runtime.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const address = runtime.server.address();
  return { base: `http://127.0.0.1:${address.port}`, runtime, storePath };
}

test("API exposes aggregate JSON, records a bounded posture, persists schema 45, and fails closed on tampering", async t => {
  const { base, runtime, storePath } = await withServer(t);
  const response = await fetch(`${base}/api/operations/campus-observatory`);
  assert.equal(response.status, 200);
  const { campusObservatory } = await response.json();
  assert.equal(campusObservatory.operatingCounts.assessmentsEligible, 3);
  assert.equal(campusObservatory.recordRowsIncluded, false);
  assert.equal("assessments" in campusObservatory, false);

  const created = await fetch(`${base}/api/operations/campus-observatory/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PERL-Demo-Actor": "CAMPUS-API-QA" },
    body: JSON.stringify({ candidateId: "north-central-counseling-center", reviewMomentId: "admission", customizationPositionId: "no-position-recorded" })
  });
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.equal(payload.event.sequence, 1);
  assert.equal(payload.event.siteIdentityVerified, false);
  assert.equal(payload.campusObservatory.chain.count, 1);

  const rejected = await fetch(`${base}/api/operations/campus-observatory/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId: "north-central-counseling-center", reviewMomentId: "admission", customizationPositionId: "no-position-recorded", notes: "free prose" })
  });
  assert.equal(rejected.status, 400);

  const exported = await fetch(`${base}/api/operations/campus-observatory.json`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition"), /perl-campus-operations-observatory\.json/);

  assert.equal(runtime.store.state.schemaVersion, 49);
  assert.equal(runtime.store.integritySnapshot().campusObservatory.valid, true);
  const stored = JSON.parse(await readFile(storePath, "utf8"));
  stored.campusObservatoryEvents[0].quarterOccurred = true;
  await writeFile(storePath, JSON.stringify(stored, null, 2));
  runtime.store.state = null;
  await assert.rejects(() => runtime.store.init(), /Campus-observatory history integrity check failed/);
});

test("dashboard markup and styles preserve semantics, 48px actions, focus, reduced motion, and mobile reflow", async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../campus-observatory.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="view-campus"[\s\S]*aria-labelledby="campus-title"/);
  assert.match(html, /id="campus-observatory"[\s\S]*See the work without seeing the student\./);
  assert.match(html, /id="campus-snapshot-form"[\s\S]*<fieldset>/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(script, /recordCampusObservatorySnapshot/);
  assert.match(script, /window\.print\(\)/);
});
