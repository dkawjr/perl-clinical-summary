import assert from "node:assert/strict";
import test from "node:test";
import {
  EXECUTIVE_HANDOFF_ARTIFACTS,
  EXECUTIVE_HANDOFF_BOUNDARY,
  EXECUTIVE_HANDOFF_CONTRACT,
  EXECUTIVE_HANDOFF_EXCLUSIONS,
  EXECUTIVE_HANDOFF_PACKETS,
  buildExecutiveHandoff,
  renderExecutiveHandoffPage,
  validateExecutiveHandoffContract
} from "../src/executive-handoff.js";
import { PILOT_AUTHORITY_REGISTER, PILOT_READINESS_GATES } from "../src/pilot-readiness.js";

function currentReadiness() {
  return {
    current: {
      gates: PILOT_READINESS_GATES.map(gate => ({
        ...gate,
        status: gate.category === "local-pattern" ? "local-evidence-current" : "external-decision-required",
        productionAccepted: false
      })),
      gateCounts: { localCurrent: 7, localRequired: 0, externalDecisionRequired: 7, total: 14 },
      authorityRegister: PILOT_AUTHORITY_REGISTER,
      authorityCounts: { confirmed: 1, provisional: 1, unassigned: 8, total: 10 },
      readinessStateHash: "a".repeat(64)
    }
  };
}

test("executive handoff fixes four source-backed packets and twenty-one external decisions", () => {
  assert.equal(EXECUTIVE_HANDOFF_CONTRACT, "perl-executive-handoff/1.0");
  assert.match(EXECUTIVE_HANDOFF_BOUNDARY, /does not assign authority/i);
  assert.deepEqual(validateExecutiveHandoffContract(), []);
  assert.equal(EXECUTIVE_HANDOFF_PACKETS.length, 4);
  assert.equal(EXECUTIVE_HANDOFF_PACKETS.flatMap(packet => packet.decisions).length, 21);
  assert.equal(new Set(EXECUTIVE_HANDOFF_PACKETS.flatMap(packet => packet.decisions.map(item => item.id))).size, 21);
  assert.ok(EXECUTIVE_HANDOFF_PACKETS.flatMap(packet => packet.decisions).every(item => item.gateId));
  assert.equal(EXECUTIVE_HANDOFF_ARTIFACTS.length, 8);
  assert.ok(EXECUTIVE_HANDOFF_EXCLUSIONS.some(item => /respondent/i.test(item)));
  assert.ok(EXECUTIVE_HANDOFF_EXCLUSIONS.some(item => /B2C/i.test(item)));
});

test("executive handoff derives live proof while preserving every external and authority gap", () => {
  const packet = buildExecutiveHandoff(currentReadiness(), {
    planningWindow: { label: "14-week evidence-gated window", startsWhen: "Owners are named.", calendarCommitment: false }
  }, "2026-08-13T22:00:00.000Z");
  assert.equal(packet.status, "decision-room-open");
  assert.equal(packet.preparedFor[0].name, "Dolores");
  assert.equal(packet.preparedFor[0].status, "confirmed-source-owner");
  assert.equal(packet.preparedFor[1].name, "Mike");
  assert.equal(packet.preparedFor[1].status, "provisional-source-owner");
  assert.equal(packet.evidenceSnapshot.localCurrent, 7);
  assert.equal(packet.evidenceSnapshot.externalAccepted, 0);
  assert.equal(packet.evidenceSnapshot.authorityUnassigned, 8);
  assert.equal(packet.planningWindow.calendarCommitment, false);
  assert.equal(packet.packets.length, 4);
  assert.ok(packet.packets.every(section => section.status === "decision-required"));
  assert.ok(packet.packets.flatMap(section => section.decisions).every(item => item.accepted === false));
  assert.equal(packet.externalApprovalsRecorded, false);
  assert.equal(packet.productionOwnersAssigned, false);
  assert.equal(packet.productionReadinessClaimed, false);
  assert.equal(packet.pilotAuthorizationRecorded, false);
  assert.equal(packet.clinicalReleaseAuthorized, false);
  assert.equal(packet.phiIncluded, false);
  assert.match(packet.packetFingerprint, /^[a-f0-9]{64}$/);
});

test("print brief is semantic, responsive, and escapes packet content", () => {
  const packet = buildExecutiveHandoff(currentReadiness(), {}, "2026-08-13T22:00:00.000Z");
  packet.meetingObjective = "Decide <script>alert(1)</script> safely.";
  const html = renderExecutiveHandoffPage(packet);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<main>/);
  assert.match(html, /Build &amp; integration decision brief\./);
  assert.match(html, /Product \+ clinical charter/);
  assert.match(html, /e-QPASS integration contract/);
  assert.match(html, /Azure production controls/);
  assert.match(html, /Independent review \+ pilot/);
  assert.match(html, /@page\{size:Letter/);
  assert.match(html, /@media\(max-width:700px\)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /PACKET [a-f0-9]{64}/);
  assert.match(html, /does not assign authority/i);
});
