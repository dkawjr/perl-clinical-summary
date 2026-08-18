import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PILOT_CANDIDATE_PATHWAYS,
  PILOT_COMMERCIAL_ASSUMPTIONS,
  PILOT_MEASURES,
  PILOT_OPERATIONS_BOUNDARY,
  PILOT_OPERATIONS_CONTRACT,
  PILOT_REVIEW_CADENCE,
  PILOT_TRAINING_MODULES,
  buildPilotOperationsPlan,
  createPilotOperationsSnapshot,
  pilotCandidatePathway,
  renderPilotOperationsBrief,
  validatePilotOperationsContract,
  validatePilotOperationsSnapshot
} from "../src/pilot-operations.js";
import { PILOT_AUTHORITY_REGISTER, PILOT_READINESS_GATES } from "../src/pilot-readiness.js";

const readiness = {
  current: {
    readinessStateHash: "a".repeat(64),
    counts: { localCurrent: 7, externalAccepted: 0 },
    authorityRegister: structuredClone(PILOT_AUTHORITY_REGISTER),
    gates: PILOT_READINESS_GATES.map(gate => ({ ...gate, status: gate.category === "external-authority" ? "external-decision-required" : "local-evidence-current" }))
  }
};

const decisionExchange = {
  exchangeFingerprint: "b".repeat(64),
  packets: PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority").map((gate, index) => ({ id: gate.id, label: gate.label, status: "return-not-received", requestFingerprint: String(index + 1).repeat(64).slice(0, 64) }))
};

const evidenceContext = {
  stateSchemaVersion: 31,
  readinessStateHash: "a".repeat(64),
  decisionExchangeFingerprint: "b".repeat(64),
  chainHeads: { intendedUse: "GENESIS", languageReview: "GENESIS" }
};

function plan(events = []) {
  return buildPilotOperationsPlan({ readiness, decisionExchange, evidenceContext, events, chain: { valid: true, count: events.length, head: events.at(-1)?.hash || null }, generatedAt: "2026-08-14T20:00:00.000Z" });
}

test("pilot operations fixes Dolores's two provider pathways without inventing site authority", () => {
  assert.deepEqual(validatePilotOperationsContract(), []);
  assert.equal(PILOT_OPERATIONS_CONTRACT, "perl-provider-pilot-operations-plan/1.0");
  assert.equal(PILOT_CANDIDATE_PATHWAYS.length, 2);
  assert.equal(PILOT_TRAINING_MODULES.length, 4);
  assert.equal(PILOT_REVIEW_CADENCE.length, 4);
  assert.equal(PILOT_MEASURES.length, 6);
  assert.equal(PILOT_COMMERCIAL_ASSUMPTIONS.length, 3);
  assert.equal(pilotCandidatePathway("north-central-counseling-center").workingWindow.includes("August–May"), true);
  assert.equal(pilotCandidatePathway("cooper-psych-clinic-qi").proposition.includes("diagnostic-agnostic"), true);
  assert.equal(pilotCandidatePathway("invented-site"), null);
  assert.match(PILOT_OPERATIONS_BOUNDARY, /does not verify a site/i);
});

test("assembled plan preserves source-reported numbers and all non-authorization rails", () => {
  const built = plan();
  assert.equal(built.counts.candidatePathways, 2);
  assert.equal(built.counts.sourceReportedCaseload, 50);
  assert.equal(built.counts.workingMonths, 10);
  assert.equal(built.counts.quarterlyReviews, 4);
  assert.equal(built.counts.admissionGates, 7);
  assert.equal(built.counts.externalAccepted, 0);
  assert.equal(built.providerPilotFirst, true);
  assert.equal(built.consumerExpansionDeferred, true);
  assert.equal(built.siteVerified, false);
  assert.equal(built.pilotAuthorized, false);
  assert.equal(built.pilotStarted, false);
  assert.equal(built.outcomeEstablished, false);
  assert.ok(/^[a-f0-9]{64}$/.test(built.planFingerprint));
  assert.ok(built.admissionGates.every(gate => gate.authorityVerified === false && gate.accepted === false));
});

test("snapshot is tamper-evident and remains a local planning record", () => {
  const built = plan();
  const event = createPilotOperationsSnapshot({
    plan: built,
    actor: "PILOT-QA",
    sequence: 1,
    previousHash: "GENESIS",
    createdAt: "2026-08-14T20:01:00.000Z",
    id: "11111111-1111-4111-8111-111111111111"
  });
  assert.deepEqual(validatePilotOperationsSnapshot(event), []);
  assert.equal(event.decision, "site-specific-pilot-authorization-remains-external");
  assert.equal(event.siteIdentityVerified, false);
  assert.equal(event.agreementExecuted, false);
  assert.equal(event.trainingCompleted, false);
  assert.equal(event.pilotAuthorized, false);
  const rebuilt = plan([event]);
  assert.equal(rebuilt.latestSnapshot.current, true);
  const tampered = structuredClone(event);
  tampered.pilotStarted = true;
  assert.ok(validatePilotOperationsSnapshot(tampered).some(error => /pilotStarted must remain false|fingerprint is invalid/.test(error)));
});

test("print renderer produces an escaped exact three-page operating brief", () => {
  const built = plan();
  const safe = structuredClone(built);
  safe.candidates[0].label = '<img src=x onerror="boom">';
  const html = renderPilotOperationsBrief(safe);
  assert.match(html, /Page 01 \/ 03/);
  assert.match(html, /Page 02 \/ 03/);
  assert.match(html, /Page 03 \/ 03/);
  assert.match(html, /Provider pilot first/);
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /pilot-operations\.css/);
  assert.match(html, /pilot-operations-print\.js/);
});

test("pilot brief styles lock Letter printing, focus, and responsive behavior", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../pilot-operations.css", import.meta.url), "utf8"),
    readFile(new URL("../pilot-operations-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /width:\s*8\.5in/);
  assert.match(css, /height:\s*11in/);
  assert.match(css, /@page\s*\{\s*size:\s*Letter/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width:\s*620px\)/);
  assert.match(css, /print-color-adjust:\s*exact/);
  assert.match(script, /window\.print/);
});
