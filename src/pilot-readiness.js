export const PILOT_READINESS_CONTRACT = "perl-pilot-readiness-snapshot/1.0";

export const MARKETABILITY_MAP_CONTRACT = "perl-marketability-map/1.0";

export const MARKETABILITY_MAP_BOUNDARY = "This is an evidence-gated planning view derived from the local synthetic readiness dossier and source correspondence. It is not a delivery-date commitment, funding representation, external approval, production-readiness claim, clinical-validity claim, pilot authorization, or authorization to use PHI.";

export const PILOT_READINESS_BOUNDARY = "This consolidates local synthetic evidence and unresolved launch authority. It does not record an external approval, assign a production owner, establish clinical validity, authorize a pilot, authorize clinical release, or certify an Azure or e-QPASS production environment.";

export const PILOT_AUTHORITY_REGISTER = Object.freeze([
  Object.freeze({ id: "executive-sponsor", label: "Executive & product sponsor", name: "Dolores", status: "confirmed-source-owner" }),
  Object.freeze({ id: "program-integration-lead", label: "Program & integration lead", name: "Mike", status: "provisional-source-owner" }),
  Object.freeze({ id: "clinical-lead", label: "Clinical lead", name: null, status: "unassigned" }),
  Object.freeze({ id: "engineering-owner", label: "Engineering owner", name: null, status: "unassigned" }),
  Object.freeze({ id: "eqpass-owner", label: "e-QPASS technical owner", name: null, status: "unassigned" }),
  Object.freeze({ id: "security-privacy-owner", label: "Security & privacy owner", name: null, status: "unassigned" }),
  Object.freeze({ id: "accessibility-owner", label: "Accessibility owner", name: null, status: "unassigned" }),
  Object.freeze({ id: "legal-owner", label: "Legal owner", name: null, status: "unassigned" }),
  Object.freeze({ id: "independent-evaluator", label: "Independent evaluator", name: null, status: "unassigned" }),
  Object.freeze({ id: "counselor-panel", label: "Counselor panel", name: null, status: "unassigned" })
]);

export const PILOT_READINESS_GATES = Object.freeze([
  Object.freeze({ id: "engineering-safety", label: "Engineering safety regression", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "clinical-lead"]) }),
  Object.freeze({ id: "report-governance", label: "Versioned report governance", category: "local-pattern", ownerRoles: Object.freeze(["clinical-lead", "legal-owner"]) }),
  Object.freeze({ id: "delivery-rehearsal", label: "Findings-to-handoff rehearsal", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "eqpass-owner"]) }),
  Object.freeze({ id: "recovery-evidence", label: "Current-schema restore evidence", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "security-privacy-owner"]) }),
  Object.freeze({ id: "rollback-evidence", label: "Sealed application baseline", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "clinical-lead"]) }),
  Object.freeze({ id: "monitoring-evidence", label: "Operational control evidence", category: "local-pattern", ownerRoles: Object.freeze(["engineering-owner", "security-privacy-owner"]) }),
  Object.freeze({ id: "response-evidence", label: "Incident-response rehearsal", category: "local-pattern", ownerRoles: Object.freeze(["clinical-lead", "engineering-owner", "security-privacy-owner", "legal-owner"]) }),
  Object.freeze({ id: "intended-use-approval", label: "Intended use & legal language", category: "external-authority", ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "legal-owner"]) }),
  Object.freeze({ id: "authoritative-eqpass", label: "Authoritative e-QPASS contract", category: "external-authority", ownerRoles: Object.freeze(["eqpass-owner", "clinical-lead"]) }),
  Object.freeze({ id: "clinical-beta", label: "Counselor calibration acceptance", category: "external-authority", ownerRoles: Object.freeze(["clinical-lead", "counselor-panel"]) }),
  Object.freeze({ id: "independent-reliability", label: "Independent reliability decision", category: "external-authority", ownerRoles: Object.freeze(["independent-evaluator", "clinical-lead"]) }),
  Object.freeze({ id: "security-production", label: "Azure security & privacy acceptance", category: "external-authority", ownerRoles: Object.freeze(["security-privacy-owner", "engineering-owner", "eqpass-owner"]) }),
  Object.freeze({ id: "accessibility-acceptance", label: "Independent accessibility acceptance", category: "external-authority", ownerRoles: Object.freeze(["accessibility-owner"]) }),
  Object.freeze({ id: "pilot-authorization", label: "Named-site pilot authorization", category: "external-authority", ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"]) })
]);

export const MARKETABILITY_PHASES = Object.freeze([
  Object.freeze({
    id: "product-proof",
    index: "01",
    window: "Working now",
    label: "Product proof",
    title: "Counselor summary workflow",
    outcome: "A source-linked Findings summary can be reviewed, edited, safety-checked, approved, and prepared for a disabled handoff.",
    gateIds: Object.freeze(["engineering-safety", "report-governance", "delivery-rehearsal"]),
    ownerRoles: Object.freeze(["program-integration-lead", "clinical-lead", "engineering-owner"]),
    exitDecision: "Local workflow evidence is current; this does not establish clinical acceptance."
  }),
  Object.freeze({
    id: "contract-calibration",
    index: "02",
    window: "Weeks 0–8",
    label: "Contract + calibration",
    title: "Freeze what PERL means",
    outcome: "Name the team, sign the e-QPASS score and report contract, approve intended-use language, and run counselor plus independent review.",
    gateIds: Object.freeze(["intended-use-approval", "authoritative-eqpass", "clinical-beta", "independent-reliability"]),
    ownerRoles: Object.freeze(["executive-sponsor", "program-integration-lead", "clinical-lead", "eqpass-owner", "legal-owner", "independent-evaluator", "counselor-panel"]),
    exitDecision: "The clinical lead and independent evaluator recommend stop, revise, or prepare the pilot."
  }),
  Object.freeze({
    id: "production-foundation",
    index: "03",
    window: "Weeks 7–12",
    label: "Production foundation",
    title: "Move inside the Azure boundary",
    outcome: "Replace local rehearsals with authenticated e-QPASS integration, production controls, recovery, rollback, monitoring, incident response, and accessible report delivery.",
    gateIds: Object.freeze(["recovery-evidence", "rollback-evidence", "monitoring-evidence", "response-evidence", "security-production", "accessibility-acceptance"]),
    ownerRoles: Object.freeze(["engineering-owner", "eqpass-owner", "security-privacy-owner", "accessibility-owner", "clinical-lead"]),
    exitDecision: "Security, engineering, e-QPASS, accessibility, and clinical owners accept the end-to-end environment."
  }),
  Object.freeze({
    id: "named-site-pilot",
    index: "04",
    window: "Weeks 12–14",
    label: "Named-site pilot",
    title: "Authorize bounded real-world use",
    outcome: "Package the accepted evidence, training, support, legal terms, and site scope for a named decision group.",
    gateIds: Object.freeze(["pilot-authorization"]),
    ownerRoles: Object.freeze(["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"]),
    exitDecision: "Only the named decision group can authorize identified pilot sites."
  })
]);

export function pilotReadinessGate(id) {
  return PILOT_READINESS_GATES.find(gate => gate.id === id) || null;
}

export function buildMarketabilityMap(current = {}) {
  const gates = Array.isArray(current.gates) ? current.gates : [];
  const authorities = Array.isArray(current.authorityRegister) ? current.authorityRegister : [];
  const gateById = new Map(gates.map(gate => [gate.id, gate]));
  const authorityById = new Map(authorities.map(role => [role.id, role]));
  const phases = MARKETABILITY_PHASES.map(definition => {
    const phaseGates = definition.gateIds.map(id => gateById.get(id)).filter(Boolean);
    const local = phaseGates.filter(gate => gate.category === "local-pattern");
    const external = phaseGates.filter(gate => gate.category === "external-authority");
    const localCurrent = local.filter(gate => gate.status === "local-evidence-current").length;
    const externalAccepted = external.filter(gate => gate.productionAccepted === true).length;
    const owners = definition.ownerRoles.map(id => authorityById.get(id) || { id, label: id, name: null, status: "unassigned" });
    const unassignedOwners = owners.filter(role => role.status === "unassigned").length;
    let status = "decision-required";
    if (definition.id === "product-proof") status = local.length > 0 && localCurrent === local.length ? "local-proof-current" : "local-proof-open";
    if (definition.id === "named-site-pilot") status = "pilot-blocked";
    return {
      ...definition,
      status,
      localEvidence: { current: localCurrent, total: local.length },
      externalDecisions: { accepted: externalAccepted, required: external.length },
      owners: owners.map(role => ({ id: role.id, label: role.label, name: role.name, status: role.status })),
      unassignedOwners,
      readyToExit: localCurrent === local.length && external.length > 0 && externalAccepted === external.length && unassignedOwners === 0
    };
  });
  const gateCounts = current.gateCounts || { localCurrent: 0, localRequired: 7, externalDecisionRequired: 7, total: 14 };
  const authorityCounts = current.authorityCounts || { confirmed: 1, provisional: 1, unassigned: 8, total: 10 };
  return {
    contractVersion: MARKETABILITY_MAP_CONTRACT,
    status: "evidence-building",
    planningWindow: {
      label: "14-week evidence-gated window",
      startsWhen: "Named owners, an approved data path, and the counselor panel are available.",
      calendarCommitment: false
    },
    providerFirst: true,
    consumerExpansionDeferred: true,
    marketabilityReady: false,
    productionReadinessClaimed: false,
    pilotAuthorizationRecorded: false,
    evidenceSnapshot: {
      localCurrent: gateCounts.localCurrent,
      localRequired: gateCounts.localRequired,
      externalAccepted: 0,
      externalDecisionRequired: gateCounts.externalDecisionRequired,
      authorityConfirmed: authorityCounts.confirmed,
      authorityProvisional: authorityCounts.provisional,
      authorityUnassigned: authorityCounts.unassigned
    },
    headline: `${gateCounts.localCurrent} of 7 local evidence patterns are current; ${gateCounts.externalDecisionRequired} external decisions and ${authorityCounts.unassigned} unassigned authority roles remain.`,
    immediateDecisions: [
      "Dolores and Mike confirm the program-and-integration leadership path.",
      "Name the licensed clinical lead and authoritative e-QPASS technical owner.",
      "Nominate two to three counselor reviewers and identify the first bounded provider site.",
      "Assign legal, security/privacy, accessibility, engineering, and independent-evaluation authority.",
      "Approve the intended use, source contract, report language, and decision calendar before the working window begins."
    ],
    phases,
    boundary: MARKETABILITY_MAP_BOUNDARY
  };
}

export function validateMarketabilityContract() {
  const errors = [];
  const ids = new Set();
  for (const phase of MARKETABILITY_PHASES) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(phase.id) || ids.has(phase.id)) errors.push(`Invalid or repeated marketability phase: ${phase.id}.`);
    ids.add(phase.id);
    if (!/^\d{2}$/.test(phase.index) || !phase.window || !phase.title || !phase.outcome || !phase.exitDecision) errors.push(`Marketability phase ${phase.id} is incomplete.`);
    if (!Array.isArray(phase.gateIds) || phase.gateIds.length < 1 || phase.gateIds.some(id => !pilotReadinessGate(id))) errors.push(`Marketability phase ${phase.id} has an invalid readiness gate.`);
    if (!Array.isArray(phase.ownerRoles) || phase.ownerRoles.length < 1 || phase.ownerRoles.some(id => !PILOT_AUTHORITY_REGISTER.some(role => role.id === id))) errors.push(`Marketability phase ${phase.id} has an invalid authority role.`);
  }
  if (MARKETABILITY_PHASES.length !== 4) errors.push("The marketability map must contain four fixed phases.");
  if (!/not a delivery-date commitment/i.test(MARKETABILITY_MAP_BOUNDARY) || !/not.*pilot authorization/i.test(MARKETABILITY_MAP_BOUNDARY)) errors.push("The marketability boundary is incomplete.");
  return [...new Set(errors)];
}

export function validatePilotReadinessContract() {
  const errors = [];
  const roleIds = new Set();
  for (const role of PILOT_AUTHORITY_REGISTER) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(role.id) || roleIds.has(role.id)) errors.push(`Invalid or repeated authority role: ${role.id}.`);
    roleIds.add(role.id);
    if (!["confirmed-source-owner", "provisional-source-owner", "unassigned"].includes(role.status)) errors.push(`Invalid authority status for ${role.id}.`);
    if (role.status === "unassigned" ? role.name !== null : typeof role.name !== "string" || role.name.length < 2) errors.push(`Invalid authority name for ${role.id}.`);
  }
  if (PILOT_AUTHORITY_REGISTER.length !== 10) errors.push("The authority register must contain ten fixed roles.");
  const gateIds = new Set();
  for (const gate of PILOT_READINESS_GATES) {
    if (!/^[a-z][a-z0-9-]{3,63}$/.test(gate.id) || gateIds.has(gate.id)) errors.push(`Invalid or repeated readiness gate: ${gate.id}.`);
    gateIds.add(gate.id);
    if (!["local-pattern", "external-authority"].includes(gate.category)) errors.push(`Invalid gate category for ${gate.id}.`);
    if (!Array.isArray(gate.ownerRoles) || gate.ownerRoles.length < 1 || gate.ownerRoles.some(role => !roleIds.has(role))) errors.push(`Invalid owner roles for ${gate.id}.`);
  }
  if (PILOT_READINESS_GATES.filter(gate => gate.category === "local-pattern").length !== 7) errors.push("The readiness contract must contain seven local evidence gates.");
  if (PILOT_READINESS_GATES.filter(gate => gate.category === "external-authority").length !== 7) errors.push("The readiness contract must contain seven external authority gates.");
  return errors;
}
