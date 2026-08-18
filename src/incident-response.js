export const INCIDENT_RESPONSE_CONTRACT = "perl-incident-response-rehearsal/1.0";

export const INCIDENT_RESPONSE_BOUNDARY = "This rehearses a fixed incident-response playbook against local synthetic evidence. It does not declare or contain a production incident, stop a production service, send a notification, assign production authority, approve restart, or authorize clinical release.";

export const RESPONSE_PHASES = Object.freeze([
  Object.freeze({ id: "classify", label: "Detect & classify" }),
  Object.freeze({ id: "contain", label: "Stop & contain" }),
  Object.freeze({ id: "preserve", label: "Preserve & reconcile" }),
  Object.freeze({ id: "restart", label: "Decide restart" })
]);

export const INCIDENT_OWNER_TREE = Object.freeze([
  Object.freeze({ id: "clinical-lead", label: "Clinical lead" }),
  Object.freeze({ id: "engineering-owner", label: "Engineering owner" }),
  Object.freeze({ id: "security-privacy-owner", label: "Security & privacy" }),
  Object.freeze({ id: "legal-owner", label: "Legal owner" }),
  Object.freeze({ id: "eqpass-owner", label: "e-QPASS owner" })
]);

export const INCIDENT_SEVERITY_MODEL = Object.freeze([
  Object.freeze({ id: "SEV1", label: "Critical", responseTarget: "Immediate", stopRequired: true, criteria: "Potential clinical harm, material privacy or integrity loss, or broad service loss." }),
  Object.freeze({ id: "SEV2", label: "Major", responseTarget: "Within 15 minutes", stopRequired: true, criteria: "A major workflow is degraded, delivery is uncertain, or multiple users may be affected." }),
  Object.freeze({ id: "SEV3", label: "Moderate", responseTarget: "Within 1 hour", stopRequired: false, criteria: "A bounded function is impaired without evidence of clinical harm or data loss." }),
  Object.freeze({ id: "SEV4", label: "Low", responseTarget: "Next business day", stopRequired: false, criteria: "Cosmetic or low-impact behavior with no clinical, privacy, integrity, or availability consequence." })
]);

export const INCIDENT_RESPONSE_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "critical-safety-routing",
    title: "Critical safety routing failure",
    severity: "SEV1",
    signal: "A critical screen is omitted, softened, or allowed past the study stopping rule.",
    stopAuthorityRole: "clinical-lead",
    stopAction: "Pause generation, review, approval, and attachment preparation for the affected workflow.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner", "legal-owner"]),
    evidenceSources: Object.freeze(["incident-ledger", "generation-lineage", "monitoring-snapshot", "approved-artifact"]),
    restartCriteria: Object.freeze(["Failure reproduced and bounded", "Corrective change passes the frozen safety set", "Clinical lead and independent evaluator accept the evidence", "Affected artifacts and workflow states are reconciled"])
  }),
  Object.freeze({
    id: "artifact-integrity-failure",
    title: "Artifact integrity failure",
    severity: "SEV1",
    signal: "A report, event, or lineage fingerprint does not match its committed evidence.",
    stopAuthorityRole: "engineering-owner",
    stopAction: "Fail closed, hold affected artifacts, and prevent approval or delivery until exact provenance is restored.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner", "legal-owner", "eqpass-owner"]),
    evidenceSources: Object.freeze(["integrity-snapshot", "recovery-evidence", "rollback-evidence", "approved-artifact"]),
    restartCriteria: Object.freeze(["Integrity failure source identified", "Current-schema restore reopens with exact counts", "Sealed baseline passes compatibility and safety replay", "Clinical and engineering owners accept reconciliation"])
  }),
  Object.freeze({
    id: "unauthorized-access-suspected",
    title: "Suspected unauthorized access",
    severity: "SEV1",
    signal: "Identity or access evidence indicates possible unauthorized use of PERL or its clinical artifacts.",
    stopAuthorityRole: "security-privacy-owner",
    stopAction: "Deny affected access, preserve security evidence, and suspend the impacted production workflow.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner", "legal-owner"]),
    evidenceSources: Object.freeze(["identity-telemetry", "access-logs", "audit-ledger", "affected-artifacts"]),
    restartCriteria: Object.freeze(["Affected identities and scope confirmed", "Credentials and access paths remediated", "Privacy and legal obligations evaluated", "Security and clinical owners authorize controlled restoration"])
  }),
  Object.freeze({
    id: "backup-restoration-failure",
    title: "Backup or restoration failure",
    severity: "SEV2",
    signal: "A backup job fails or a required restore cannot meet the approved recovery objective.",
    stopAuthorityRole: "engineering-owner",
    stopAction: "Hold new production dependence and preserve the last verified state until recovery evidence is accepted.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner"]),
    evidenceSources: Object.freeze(["backup-job-log", "recovery-evidence", "record-reconciliation", "retention-policy"]),
    restartCriteria: Object.freeze(["Backup source and failure window identified", "Isolated restore passes exact reconciliation", "Approved RPO and RTO are met or exception is accepted", "Engineering and clinical owners approve resumption"])
  }),
  Object.freeze({
    id: "generation-provider-failure",
    title: "Generation provider failure",
    severity: "SEV2",
    signal: "The model gateway times out, returns invalid output, or loses input/output lineage.",
    stopAuthorityRole: "engineering-owner",
    stopAction: "Fail closed without silent fallback and hold new summaries until a governed provider path is verified.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner"]),
    evidenceSources: Object.freeze(["generation-lineage", "provider-receipt", "input-output-hashes", "monitoring-snapshot"]),
    restartCriteria: Object.freeze(["Provider failure mode is bounded", "No cross-record or PHI exposure is found", "Structured output and frozen safety tests pass", "Engineering and clinical owners accept the provider path"])
  }),
  Object.freeze({
    id: "delivery-dead-letter",
    title: "Delivery dead letter or uncertain outcome",
    severity: "SEV2",
    signal: "An approved artifact cannot be delivered or its remote write outcome cannot be reconciled.",
    stopAuthorityRole: "eqpass-owner",
    stopAction: "Hold the package, prohibit duplicate attachment, and reconcile the remote outcome before retry.",
    notificationRoles: Object.freeze(["clinical-lead", "engineering-owner", "eqpass-owner"]),
    evidenceSources: Object.freeze(["delivery-outbox", "connector-receipt", "approved-artifact", "eqpass-audit"]),
    restartCriteria: Object.freeze(["Remote outcome is known", "Idempotency and artifact identity are intact", "Affected e-QPASS record is reconciled", "e-QPASS and clinical owners approve retry or closure"])
  })
]);

export function incidentResponseScenario(id) {
  return INCIDENT_RESPONSE_SCENARIOS.find(scenario => scenario.id === id) || null;
}

export function incidentSeverity(id) {
  return INCIDENT_SEVERITY_MODEL.find(level => level.id === id) || null;
}

export function validateIncidentResponseContract() {
  const ownerIds = new Set(INCIDENT_OWNER_TREE.map(owner => owner.id));
  const severityIds = new Set(INCIDENT_SEVERITY_MODEL.map(level => level.id));
  const scenarioIds = new Set();
  const errors = [];
  if (INCIDENT_RESPONSE_SCENARIOS.length !== 6) errors.push("The response contract must define six frozen scenarios.");
  for (const scenario of INCIDENT_RESPONSE_SCENARIOS) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(scenario.id) || scenarioIds.has(scenario.id)) errors.push(`Invalid or repeated scenario ID: ${scenario.id}.`);
    scenarioIds.add(scenario.id);
    if (!severityIds.has(scenario.severity)) errors.push(`Unknown severity for ${scenario.id}.`);
    if (!ownerIds.has(scenario.stopAuthorityRole)) errors.push(`Unknown stop authority for ${scenario.id}.`);
    if (!Array.isArray(scenario.notificationRoles) || scenario.notificationRoles.some(role => !ownerIds.has(role))) errors.push(`Invalid notification tree for ${scenario.id}.`);
    if (!Array.isArray(scenario.evidenceSources) || scenario.evidenceSources.length < 4) errors.push(`Evidence plan is incomplete for ${scenario.id}.`);
    if (!Array.isArray(scenario.restartCriteria) || scenario.restartCriteria.length < 4) errors.push(`Restart criteria are incomplete for ${scenario.id}.`);
  }
  return errors;
}
