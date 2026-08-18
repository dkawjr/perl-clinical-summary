import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACTIVATION_DRILLS,
  ACTIVATION_MODULES,
  ACTIVATION_OBJECTIVES,
  ACTIVATION_OBSERVATION_STANDARD,
  ACTIVATION_REQUIRED_RETURNS,
  PROVIDER_ACTIVATION_BOUNDARY,
  PROVIDER_ACTIVATION_CONTRACT,
  buildProviderActivationWorkbook,
  createProviderActivationSnapshot,
  renderProviderActivationWorkbook,
  validateProviderActivationContract,
  validateProviderActivationSnapshot
} from "../src/provider-activation.js";

const pilotOperations = {
  contractVersion: "perl-provider-pilot-operations-plan/1.0",
  planFingerprint: "a".repeat(64),
  counts: { candidatePathways: 2, sitesVerified: 0, pilotsAuthorized: 0 }
};
const readiness = { current: { readinessStateHash: "b".repeat(64), gateCounts: { localCurrent: 7, externalAccepted: 0 } } };
const evidenceContext = {
  stateSchemaVersion: 32,
  pilotPlanFingerprint: "a".repeat(64),
  readinessStateHash: "b".repeat(64),
  reportContract: "perl-clinician-report/1.0",
  chainHeads: { pilotOperations: "GENESIS", intendedUse: "GENESIS", languageReview: "GENESIS", reports: "GENESIS", generation: "GENESIS", monitoring: "GENESIS", incidentResponse: "GENESIS", readiness: "GENESIS" }
};

function workbook(events = []) {
  return buildProviderActivationWorkbook({ pilotOperations, readiness, evidenceContext, events, chain: { valid: true, count: events.length, head: events.at(-1)?.hash || null }, generatedAt: "2026-08-14T21:00:00.000Z" });
}

test("provider activation fixes a bounded training rehearsal without inventing attendance", () => {
  assert.deepEqual(validateProviderActivationContract(), []);
  assert.equal(PROVIDER_ACTIVATION_CONTRACT, "perl-provider-activation-workbook/1.0");
  assert.equal(ACTIVATION_MODULES.length, 4);
  assert.equal(ACTIVATION_MODULES.reduce((sum, module) => sum + module.workingMinutes, 0), 100);
  assert.equal(ACTIVATION_OBJECTIVES.length, 8);
  assert.equal(ACTIVATION_DRILLS.length, 4);
  assert.equal(ACTIVATION_DRILLS.filter(drill => drill.critical).length, 2);
  assert.equal(ACTIVATION_OBSERVATION_STANDARD.length, 4);
  assert.equal(ACTIVATION_REQUIRED_RETURNS.length, 10);
  assert.match(PROVIDER_ACTIVATION_BOUNDARY, /working design controls/i);
});

test("workbook uses frozen synthetic exercises and exposes zero live completion", () => {
  const built = workbook();
  assert.equal(built.counts.workingMinutes, 100);
  assert.equal(built.counts.registeredParticipants, 0);
  assert.equal(built.counts.acceptedCompletions, 0);
  assert.equal(built.counts.activatedSites, 0);
  assert.equal(built.sourceRegister.sourceReportedWindowVerified, false);
  assert.equal(built.trainingScheduled, false);
  assert.equal(built.sessionHeld, false);
  assert.equal(built.completionAccepted, false);
  assert.equal(built.activationAuthorized, false);
  assert.equal(built.patientUseAuthorized, false);
  assert.ok(built.drills.every(drill => drill.syntheticOnly));
  assert.ok(/^[a-f0-9]{64}$/.test(built.workbookFingerprint));
});

test("activation snapshot is tamper-evident and cannot become completion evidence", () => {
  const built = workbook();
  const event = createProviderActivationSnapshot({
    workbook: built,
    actor: "ACTIVATION-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T21:01:00.000Z",
    id: "22222222-2222-4222-8222-222222222222"
  });
  assert.deepEqual(validateProviderActivationSnapshot(event), []);
  assert.equal(event.decision, "training-completion-and-site-activation-remain-external");
  assert.equal(event.attendanceVerified, false);
  assert.equal(event.drillsPassed, false);
  assert.equal(event.activationAuthorized, false);
  assert.equal(workbook([event]).latestSnapshot.current, true);
  const tampered = structuredClone(event);
  tampered.completionAccepted = true;
  assert.ok(validateProviderActivationSnapshot(tampered).some(error => /completionAccepted must remain false|snapshot hash is invalid/.test(error)));
});

test("workbook renderer escapes content and emits exactly four Letter sheets", () => {
  const built = workbook();
  const safe = structuredClone(built);
  safe.modules[0].label = '<img src=x onerror="boom">';
  const html = renderProviderActivationWorkbook(safe);
  assert.equal((html.match(/class="activation-sheet/g) || []).length, 4);
  assert.match(html, /Page 01 \/ 04/);
  assert.match(html, /Page 04 \/ 04/);
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /provider-activation\.css/);
  assert.match(html, /provider-activation-print\.js/);
});

test("activation print styles lock Letter geometry, focus, touch, and narrow reflow", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../provider-activation.css", import.meta.url), "utf8"),
    readFile(new URL("../provider-activation-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /width:816px/);
  assert.match(css, /height:1056px/);
  assert.match(css, /@page\{size:Letter;margin:0\}/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:540px\)/);
  assert.match(css, /print-color-adjust:exact/);
  assert.match(script, /window\.print/);
});
