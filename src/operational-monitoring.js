export const OPERATIONAL_MONITORING_CONTRACT = "perl-operational-monitoring/1.0";

export const OPERATIONAL_MONITORING_BOUNDARY = "This verifies a point-in-time local synthetic control matrix. It is not continuous production telemetry, an availability or latency service-level claim, security-event monitoring, backup-job monitoring, external alert delivery, or authorization for clinical release.";

export const LOCAL_PROBE_BUDGET_MS = 250;

export const OPERATIONAL_SIGNALS = Object.freeze([
  Object.freeze({ id: "availability", label: "Availability", scope: "local", requiredByLaunchPlan: true }),
  Object.freeze({ id: "latency", label: "Latency", scope: "local", requiredByLaunchPlan: true }),
  Object.freeze({ id: "generation-failure", label: "Generation", scope: "local", requiredByLaunchPlan: true }),
  Object.freeze({ id: "safety-routing", label: "Safety routing", scope: "local", requiredByLaunchPlan: true }),
  Object.freeze({ id: "delivery-queue", label: "Delivery queue", scope: "local", requiredByLaunchPlan: false }),
  Object.freeze({ id: "artifact-integrity", label: "Artifact integrity", scope: "local", requiredByLaunchPlan: true }),
  Object.freeze({ id: "restore-readiness", label: "Restore evidence", scope: "local", requiredByLaunchPlan: false }),
  Object.freeze({ id: "rollback-readiness", label: "Rollback evidence", scope: "local", requiredByLaunchPlan: false }),
  Object.freeze({ id: "unauthorized-access", label: "Access alerts", scope: "production-gap", requiredByLaunchPlan: true }),
  Object.freeze({ id: "backup-job", label: "Backup jobs", scope: "production-gap", requiredByLaunchPlan: true }),
  Object.freeze({ id: "external-notification-delivery", label: "Notifications", scope: "production-gap", requiredByLaunchPlan: false })
]);

export const PRODUCTION_MONITORING_GAPS = Object.freeze([
  "unauthorized-access",
  "backup-job",
  "external-notification-delivery"
]);

export function validateOperationalSignalSet(signals) {
  if (!Array.isArray(signals) || signals.length !== OPERATIONAL_SIGNALS.length) return false;
  const expected = new Map(OPERATIONAL_SIGNALS.map(signal => [signal.id, signal]));
  const seen = new Set();
  return signals.every(signal => {
    const definition = expected.get(signal?.id);
    const localSemantics = definition?.scope === "local"
      && ["pass", "attention", "fail"].includes(signal?.status)
      && /^[a-f0-9]{64}$/.test(signal?.evidenceHash || "")
      && (signal.status === "pass" ? signal.severity === "info" : signal.status === "fail" ? signal.severity === "critical" : ["warning", "high", "critical"].includes(signal.severity));
    const productionGapSemantics = definition?.scope === "production-gap"
      && signal?.status === "unavailable"
      && ["high", "critical"].includes(signal?.severity)
      && signal?.evidenceHash === null;
    const valid = definition?.scope === signal?.scope
      && definition?.label === signal?.label
      && definition?.requiredByLaunchPlan === signal?.requiredByLaunchPlan
      && ["pass", "attention", "unavailable", "fail"].includes(signal?.status)
      && ["info", "warning", "high", "critical"].includes(signal?.severity)
      && typeof signal?.detail === "string"
      && signal.detail.length >= 4
      && signal.detail.length <= 180
      && (localSemantics || productionGapSemantics)
      && !seen.has(signal.id);
    seen.add(signal?.id);
    return valid;
  }) && seen.size === expected.size;
}
