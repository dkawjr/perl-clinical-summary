import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETABILITY_MAP_BOUNDARY,
  MARKETABILITY_MAP_CONTRACT,
  MARKETABILITY_PHASES,
  PILOT_AUTHORITY_REGISTER,
  PILOT_READINESS_BOUNDARY,
  PILOT_READINESS_CONTRACT,
  PILOT_READINESS_GATES,
  buildMarketabilityMap,
  pilotReadinessGate,
  validateMarketabilityContract,
  validatePilotReadinessContract
} from "../src/pilot-readiness.js";

test("pilot-readiness contract fixes the permission surface without inventing owners", () => {
  assert.equal(PILOT_READINESS_CONTRACT, "perl-pilot-readiness-snapshot/1.0");
  assert.match(PILOT_READINESS_BOUNDARY, /does not record an external approval/i);
  assert.deepEqual(validatePilotReadinessContract(), []);
  assert.equal(PILOT_AUTHORITY_REGISTER.length, 10);
  assert.equal(PILOT_AUTHORITY_REGISTER.filter(role => role.status === "confirmed-source-owner").length, 1);
  assert.equal(PILOT_AUTHORITY_REGISTER.filter(role => role.status === "provisional-source-owner").length, 1);
  assert.equal(PILOT_AUTHORITY_REGISTER.filter(role => role.status === "unassigned").length, 8);
  assert.equal(PILOT_AUTHORITY_REGISTER.find(role => role.id === "executive-sponsor").name, "Dolores");
  assert.equal(PILOT_AUTHORITY_REGISTER.find(role => role.id === "program-integration-lead").name, "Mike");
});

test("pilot-readiness contract separates local evidence from external authority", () => {
  assert.equal(PILOT_READINESS_GATES.length, 14);
  assert.equal(PILOT_READINESS_GATES.filter(gate => gate.category === "local-pattern").length, 7);
  assert.equal(PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority").length, 7);
  assert.deepEqual(pilotReadinessGate("pilot-authorization").ownerRoles, [
    "executive-sponsor",
    "clinical-lead",
    "legal-owner",
    "security-privacy-owner",
    "independent-evaluator"
  ]);
  assert.equal(pilotReadinessGate("invented-gate"), null);
});

test("marketability map turns the readiness ledger into a bounded executive runway", () => {
  assert.equal(MARKETABILITY_MAP_CONTRACT, "perl-marketability-map/1.0");
  assert.match(MARKETABILITY_MAP_BOUNDARY, /not a delivery-date commitment/i);
  assert.deepEqual(validateMarketabilityContract(), []);
  assert.equal(MARKETABILITY_PHASES.length, 4);
  const gates = PILOT_READINESS_GATES.map(gate => ({
    ...gate,
    status: gate.category === "local-pattern" && gate.id !== "delivery-rehearsal"
      ? "local-evidence-current"
      : gate.category === "local-pattern" ? "local-evidence-required" : "external-decision-required",
    productionAccepted: false
  }));
  const map = buildMarketabilityMap({
    gates,
    authorityRegister: PILOT_AUTHORITY_REGISTER,
    gateCounts: { localCurrent: 6, localRequired: 1, externalDecisionRequired: 7, total: 14 },
    authorityCounts: { confirmed: 1, provisional: 1, unassigned: 8, total: 10 }
  });
  assert.equal(map.status, "evidence-building");
  assert.equal(map.planningWindow.calendarCommitment, false);
  assert.equal(map.marketabilityReady, false);
  assert.equal(map.productionReadinessClaimed, false);
  assert.equal(map.pilotAuthorizationRecorded, false);
  assert.equal(map.evidenceSnapshot.localCurrent, 6);
  assert.equal(map.evidenceSnapshot.authorityUnassigned, 8);
  assert.equal(map.phases.find(phase => phase.id === "product-proof").status, "local-proof-open");
  assert.equal(map.phases.find(phase => phase.id === "named-site-pilot").status, "pilot-blocked");
  assert.equal(map.providerFirst, true);
  assert.equal(map.consumerExpansionDeferred, true);
});
