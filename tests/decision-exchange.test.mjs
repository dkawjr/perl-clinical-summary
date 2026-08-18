import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DECISION_EXCHANGE_BOUNDARY,
  DECISION_EXCHANGE_CONTRACT,
  DECISION_EXCHANGE_GATES,
  DECISION_RETURN_CONTRACT,
  buildDecisionExchange,
  createDecisionReturnPreflight,
  renderDecisionRequestPage,
  validateDecisionExchangeContract,
  validateDecisionReturnManifest,
  validateDecisionReturnPreflight
} from "../src/decision-exchange.js";
import { PILOT_AUTHORITY_REGISTER, PILOT_READINESS_GATES } from "../src/pilot-readiness.js";

const readiness = {
  current: {
    readinessStateHash: "a".repeat(64),
    authorityRegister: structuredClone(PILOT_AUTHORITY_REGISTER),
    gates: PILOT_READINESS_GATES.map(gate => ({ ...gate, status: gate.category === "external-authority" ? "external-decision-required" : "local-evidence-current", productionAccepted: false }))
  }
};

const evidenceContext = {
  stateSchemaVersion: 30,
  reportContract: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  intendedUseVersion: 1,
  intendedUseHash: "b".repeat(64),
  languagePacketVersion: 1,
  languagePacketHash: "c".repeat(64),
  caseSetId: "perl-synthetic-calibration-v1",
  caseSetVersion: "1.0",
  chainHeads: { integrationReturn: "GENESIS" }
};

function exchange(events = []) {
  return buildDecisionExchange({ readiness, evidenceContext, events, chain: { valid: true, count: events.length, head: events.at(-1)?.hash || null }, generatedAt: "2026-08-14T18:00:00.000Z" });
}

function completedManifest(packet, decision = "accept") {
  const manifest = structuredClone(packet.returnTemplate);
  manifest.returnId = "FF-DECISION-TEST-001";
  manifest.decision = decision;
  manifest.decisionRecordReference = "FF-DECISION-RECORD-001";
  manifest.decidedAt = "2026-08-14T17:30:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-ROLE-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-ITEM-${index + 1}`, status: "declared-unverified" }));
  return manifest;
}

test("Decision Exchange mirrors the seven readiness decisions and denies local authority", () => {
  assert.deepEqual(validateDecisionExchangeContract(), []);
  assert.equal(DECISION_EXCHANGE_CONTRACT, "perl-external-decision-exchange/1.0");
  assert.equal(DECISION_RETURN_CONTRACT, "perl-external-decision-return/rfi-1.0");
  assert.equal(DECISION_EXCHANGE_GATES.length, 7);
  assert.deepEqual(DECISION_EXCHANGE_GATES.map(gate => gate.id), PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority").map(gate => gate.id));
  assert.match(DECISION_EXCHANGE_BOUNDARY, /does not.*record acceptance/i);
  const built = exchange();
  assert.equal(built.packets.length, 7);
  assert.equal(built.counts.requestPackets, 7);
  assert.equal(built.counts.currentPreflights, 0);
  assert.equal(built.counts.externalAccepted, 0);
  assert.equal(built.counts.gatesClosed, 0);
  assert.equal(built.identityVerified, false);
  assert.equal(built.authorityVerified, false);
  assert.equal(built.pilotAuthorized, false);
  assert.equal(built.productionReleaseAuthorized, false);
  assert.ok(built.packets.every(packet => /^[a-f0-9]{64}$/.test(packet.requestFingerprint)));
  assert.ok(built.packets.every(packet => packet.returnTemplate.contractVersion === DECISION_RETURN_CONTRACT));
});

test("complete decision metadata becomes tamper-evident but remains unverified and cannot close a gate", () => {
  const packet = exchange().packets[0];
  const manifest = completedManifest(packet);
  assert.deepEqual(validateDecisionReturnManifest(manifest, packet), []);
  const event = createDecisionReturnPreflight({
    manifest, packet, actor: "DECISION-QA", sequence: 1, previousHash: "GENESIS",
    createdAt: "2026-08-14T18:01:00.000Z", id: "11111111-1111-4111-8111-111111111111"
  });
  assert.equal(event.status, "metadata-complete-unverified");
  assert.equal(event.metadataChecklistComplete, true);
  assert.equal(event.decisionPreview, "accept");
  assert.equal(event.identityVerified, false);
  assert.equal(event.authorityVerified, false);
  assert.equal(event.evidenceVerified, false);
  assert.equal(event.externalAcceptanceRecorded, false);
  assert.equal(event.gateAccepted, false);
  assert.equal(event.gateDecision, "external-decision-remains-open");
  assert.deepEqual(validateDecisionReturnPreflight(event), []);
  const rebuilt = exchange([event]);
  assert.equal(rebuilt.counts.completeUnverified, 1);
  assert.equal(rebuilt.counts.gatesClosed, 0);
  assert.equal(rebuilt.packets[0].latestPreflight.current, true);
});

test("an untouched request template records an incomplete metadata preflight without a decision", () => {
  const packet = exchange().packets[2];
  const manifest = structuredClone(packet.returnTemplate);
  manifest.returnId = "FF-DECISION-EMPTY-001";
  assert.deepEqual(validateDecisionReturnManifest(manifest, packet), []);
  const event = createDecisionReturnPreflight({ manifest, packet, actor: "DECISION-QA", sequence: 1, createdAt: "2026-08-14T18:02:00.000Z" });
  assert.equal(event.status, "metadata-incomplete");
  assert.equal(event.decisionPreview, "not-recorded");
  assert.equal(event.metadataChecklistComplete, false);
  assert.deepEqual(validateDecisionReturnPreflight(event), []);
});

test("the strict return contract rejects stale packets, extra fields, authority claims, and malformed references", () => {
  const packet = exchange().packets[4];
  const manifest = completedManifest(packet, "revise");
  manifest.requestFingerprint = "f".repeat(64);
  manifest.unexpected = true;
  manifest.authorities[0].identityReference = "Jane Doe";
  manifest.trustBoundary.authorityVerified = true;
  const errors = validateDecisionReturnManifest(manifest, packet).join(" ");
  assert.match(errors, /outside the metadata contract/);
  assert.match(errors, /does not match the current decision packet/);
  assert.match(errors, /visibly synthetic FF-AUTH/);
  assert.match(errors, /authorityVerified must remain false/);
});

test("event validation detects semantic or hash tampering", () => {
  const packet = exchange().packets[5];
  const event = createDecisionReturnPreflight({ manifest: completedManifest(packet), packet, actor: "DECISION-QA", sequence: 1, createdAt: "2026-08-14T18:03:00.000Z" });
  const tampered = structuredClone(event);
  tampered.gateAccepted = true;
  assert.ok(validateDecisionReturnPreflight(tampered).some(error => /gateAccepted must remain false|fingerprint is invalid/.test(error)));
});

test("the escaped request renderer produces an exact two-page working packet", () => {
  const built = exchange();
  const safe = structuredClone(built);
  safe.packets[0].headline = '<img src=x onerror="boom">';
  const html = renderDecisionRequestPage(safe, safe.packets[0].id);
  assert.match(html, /Page 01 \/ 02/);
  assert.match(html, /Page 02 \/ 02/);
  assert.match(html, /This is not a signature surface/);
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /decision-exchange\.css/);
  assert.match(html, /decision-exchange-print\.js/);
});

test("Decision Exchange styles lock Letter printing, responsive behavior, focus, and target size", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../decision-exchange.css", import.meta.url), "utf8"),
    readFile(new URL("../decision-exchange-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /width:8\.5in/);
  assert.match(css, /height:11in/);
  assert.match(css, /@page \{ size:Letter/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width:620px\)/);
  assert.match(css, /print-color-adjust:exact/);
  assert.match(script, /window\.print/);
});
