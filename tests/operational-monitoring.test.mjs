import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LOCAL_PROBE_BUDGET_MS,
  OPERATIONAL_MONITORING_BOUNDARY,
  OPERATIONAL_MONITORING_CONTRACT,
  OPERATIONAL_SIGNALS,
  PRODUCTION_MONITORING_GAPS,
  validateOperationalSignalSet
} from "../src/operational-monitoring.js";

const schema = JSON.parse(
  await readFile(new URL("../schemas/operational-monitoring-event.schema.json", import.meta.url), "utf8")
);

test("operational monitoring contract separates local evidence from production gaps", () => {
  assert.equal(OPERATIONAL_MONITORING_CONTRACT, "perl-operational-monitoring/1.0");
  assert.equal(LOCAL_PROBE_BUDGET_MS, 250);
  assert.equal(OPERATIONAL_SIGNALS.filter(signal => signal.scope === "local").length, 8);
  assert.deepEqual(OPERATIONAL_SIGNALS.filter(signal => signal.scope === "production-gap").map(signal => signal.id), PRODUCTION_MONITORING_GAPS);
  assert.match(OPERATIONAL_MONITORING_BOUNDARY, /not continuous production telemetry/i);
  assert.match(OPERATIONAL_MONITORING_BOUNDARY, /external alert delivery/i);
});

test("monitoring schema prohibits service-level, security, backup, and notification claims", () => {
  assert.equal(schema.properties.contractVersion.const, OPERATIONAL_MONITORING_CONTRACT);
  assert.equal(schema.properties.scope.const, "local-synthetic-point-in-time");
  assert.equal(schema.properties.continuousMonitoringClaimed.const, false);
  assert.equal(schema.properties.productionAlertingConnected.const, false);
  assert.equal(schema.properties.availabilitySlaClaimed.const, false);
  assert.equal(schema.properties.latencySloClaimed.const, false);
  assert.equal(schema.properties.productionBackupMonitoring.const, false);
  assert.equal(schema.properties.securityMonitoringConnected.const, false);
  assert.equal(schema.properties.externalNotificationsSent.const, false);
  assert.equal(schema.properties.signals.minItems, 11);
});

test("signal-set validator requires the complete ordered monitoring inventory", () => {
  const signals = OPERATIONAL_SIGNALS.map(signal => ({
    ...signal,
    status: signal.scope === "local" ? "pass" : "unavailable",
    severity: signal.scope === "local" ? "info" : "critical",
    detail: "Bounded test signal detail.",
    evidenceHash: signal.scope === "local" ? "a".repeat(64) : null
  }));
  assert.equal(validateOperationalSignalSet(signals), true);
  assert.equal(validateOperationalSignalSet(signals.slice(1)), false);
  assert.equal(validateOperationalSignalSet([...signals, signals[0]]), false);
  assert.equal(validateOperationalSignalSet(signals.map(signal => signal.id === "availability" ? { ...signal, scope: "production-gap" } : signal)), false);
});
