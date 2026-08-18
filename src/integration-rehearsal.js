import { createHash } from "node:crypto";
import { validateSyntheticEqpassEvent } from "./eqpass-adapter.js";

export const INTEGRATION_REHEARSAL_CONTRACT = "perl-findings-summary-integration-rehearsal/1.0";
export const INTEGRATION_REHEARSAL_BOUNDARY = "This observatory traces synthetic calibration evidence from a proposed e-QPASS scored event through generation, clinician review, report materialization, handoff preparation, and an optional authorized delivery rehearsal. It does not ingest a Findings PDF, authorize PHI, replace clinician judgment, prove an authoritative e-QPASS contract, approve a candidate generally, authorize transport or a pilot, attach a file, write a patient record, or establish clinical validity or patient benefit.";

const HEX = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-F0-9]{12,32}$/;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

export function integrationRehearsalDigest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function latest(items, predicate) {
  return [...(items || [])].reverse().find(predicate) || null;
}

function candidateBinding(provider = {}, advancement = null) {
  const candidate = advancement?.candidateIdentity || {};
  const exactAdvanced = advancement?.exactCandidateAdvancedToIntegrationReadiness === true;
  const fields = [
    ["providerId", provider.id],
    ["modelVersion", provider.version],
    ["promptVersion", provider.promptVersion],
    ["outputContract", provider.outputSchemaVersion],
    ["policyVersion", provider.policyVersion],
    ["policyHash", provider.policyHash]
  ];
  const matchedFields = fields.filter(([key, value]) => candidate[key] && candidate[key] === value).map(([key]) => key);
  const mismatchedFields = exactAdvanced
    ? fields.filter(([key, value]) => !candidate[key] || candidate[key] !== value).map(([key]) => key)
    : [];
  let status = "candidate-not-advanced";
  let statement = "No exact candidate has completed the externally signed advancement airlock.";
  if (provider.mode === "rules") {
    status = "deterministic-baseline";
    statement = "This run uses the local deterministic calibration baseline, not an externally advanced model candidate.";
  } else if (exactAdvanced && mismatchedFields.length === 0) {
    status = "exact-candidate-match";
    statement = "The materialized generation provenance matches all six disclosed fields of the exact candidate advanced for integration-readiness work.";
  } else if (exactAdvanced) {
    status = "exact-candidate-mismatch";
    statement = "The loaded generation provider does not match the exact candidate frozen by the advancement airlock; this run is held as non-conforming.";
  } else if (provider.externalTransmission) {
    status = "candidate-unbound";
    statement = "A structured candidate generated this snapshot, but no exact candidate advancement freeze binds it to integration-readiness work.";
  }
  return {
    status,
    exactCandidateAdvanced: exactAdvanced,
    exactMatch: status === "exact-candidate-match",
    providerMode: provider.mode || null,
    providerId: provider.id || null,
    modelVersion: provider.version || null,
    promptVersion: provider.promptVersion || null,
    outputContract: provider.outputSchemaVersion || null,
    policyVersion: provider.policyVersion || null,
    policyHash: HEX.test(String(provider.policyHash || "")) ? provider.policyHash : null,
    candidateFingerprint: candidate.disclosed && HEX.test(String(candidate.candidateFingerprint || "")) ? candidate.candidateFingerprint : null,
    advancementFreezeFingerprint: advancement?.candidateAdvancement?.freezeFingerprint || null,
    airlockFingerprint: advancement?.airlockFingerprint || null,
    matchedFields,
    mismatchedFields,
    candidateTransportAuthorized: false,
    statement
  };
}

function stage(id, label, status, detail, evidenceHash = null, at = null) {
  return { id, label, status, detail, evidenceHash: HEX.test(String(evidenceHash || "")) ? evidenceHash : null, at: at || null };
}

function runStatus({ integrityValid, binding, workflowEvent, deliveryEvent, attachment, artifact, approved, connectorEnabled }) {
  if (!integrityValid) return "integrity-attention";
  if (binding?.status === "exact-candidate-mismatch") return "attention";
  if (workflowEvent?.type === "handoff-failed" || ["delivery-retry-scheduled", "delivery-dead-lettered"].includes(deliveryEvent?.type)) return "attention";
  if (deliveryEvent?.type === "delivery-rehearsed") return "rehearsed-not-attached";
  if (attachment) return connectorEnabled ? "ready-for-authorized-connector" : "prepared-and-held";
  if (artifact || approved) return "preparing-handoff";
  return "awaiting-clinician-review";
}

function runLabel(status) {
  return ({
    "integrity-attention": "Evidence integrity needs attention",
    attention: "Stopped safely for operator review",
    "rehearsed-not-attached": "Synthetic receipt verified",
    "ready-for-authorized-connector": "Prepared for authorized rehearsal",
    "prepared-and-held": "Prepared and held at the write boundary",
    "preparing-handoff": "Clinical decision recorded; handoff preparing",
    "awaiting-clinician-review": "Generated and awaiting clinician review"
  })[status] || "Run state unavailable";
}

export function buildIntegrationRehearsalObservatory({
  sourceEvents = [],
  generationRecords = [],
  activeGenerations = {},
  reviews = {},
  reportArtifacts = [],
  attachmentEvents = [],
  automationEvents = [],
  deliveryJobs = [],
  deliveryEvents = [],
  activeDeliveries = {},
  provider = {},
  advancement = null,
  connector = {},
  chains = {},
  generatedAt = new Date().toISOString()
} = {}) {
  const chainEntries = Object.entries(chains);
  const integrityValid = chainEntries.every(([, chain]) => chain?.valid !== false);
  const runs = [...sourceEvents].reverse().map(source => {
    const assessmentId = source.assessmentId;
    const generationId = activeGenerations[assessmentId];
    const generation = generationRecords.find(item => item.id === generationId && item.assessmentId === assessmentId) || null;
    const review = reviews[assessmentId] || {};
    const approved = review.status === "approved";
    const artifact = latest(reportArtifacts, item => item.assessmentId === assessmentId && (!approved || item.type === "approved"));
    const attachment = latest(attachmentEvents, item => item.assessmentId === assessmentId && (!artifact || item.reportArtifactHash === artifact.hash));
    const workflowEvent = latest(automationEvents, item => item.assessmentId === assessmentId);
    const activeJobId = activeDeliveries[assessmentId];
    const deliveryJob = deliveryJobs.find(item => item.id === activeJobId) || latest(deliveryJobs, item => item.assessmentId === assessmentId);
    const deliveryEvent = deliveryJob ? latest(deliveryEvents, item => item.jobId === deliveryJob.id) : null;
    const binding = candidateBinding(generation?.provider || provider, advancement);
    const startedAt = source.createdAt || source.receivedAt || generation?.createdAt || generatedAt;
    const deliveryStageStatus = deliveryEvent?.type === "delivery-rehearsed"
      ? "verified"
      : ["delivery-retry-scheduled", "delivery-dead-lettered"].includes(deliveryEvent?.type)
        ? "attention"
        : attachment
          ? "held"
          : "waiting";
    const stages = [
      stage("findings", "Findings scored", "verified", "Proposed scored-event receipt verified; the Findings PDF remained outside PERL.", source.hash, startedAt),
      stage("generation", "Summary generated", generation ? (binding.status === "exact-candidate-mismatch" ? "attention" : "verified") : "attention", generation ? `${generation.provider?.id || "Loaded provider"} · ${generation.provider?.version || "version unavailable"}` : "No materialized generation snapshot was found.", generation?.hash, generation?.createdAt),
      stage("clinical-review", "Clinician decision", approved ? "verified" : "waiting", approved ? "A clinician approved the exact reviewable artifact." : "Human review is required before any handoff can be prepared.", artifact?.hash, review.approvedAt || review.updatedAt),
      stage("report", "Extra page committed", artifact ? "verified" : "waiting", artifact ? "A versioned clinician report artifact is bound to the source receipt." : "The additional PERL page is created only after clinical approval.", artifact?.hash, artifact?.createdAt),
      stage("handoff", "Handoff prepared", workflowEvent?.type === "handoff-failed" ? "attention" : attachment ? "verified" : "waiting", attachment ? "The idempotent attachment manifest is prepared; no source PDF was modified." : workflowEvent?.type === "handoff-failed" ? "Preparation stopped safely and is eligible for explicit retry." : "Waiting for an approved source-linked report artifact.", attachment?.hash || workflowEvent?.hash, attachment?.createdAt || workflowEvent?.createdAt),
      stage("delivery", "Write boundary", deliveryStageStatus, deliveryEvent?.type === "delivery-rehearsed" ? "An authorized synthetic connector returned a no-write receipt." : deliveryStageStatus === "attention" ? "The bounded connector attempt stopped for operator review; no remote write is claimed." : attachment ? (connector.enabled ? "The package is ready for an explicitly authorized synthetic connector attempt." : "The durable package is held locally because the connector is disabled.") : "No delivery package exists yet.", deliveryEvent?.hash || deliveryJob?.hash, deliveryEvent?.createdAt || deliveryJob?.createdAt)
    ];
    const status = runStatus({ integrityValid, binding, workflowEvent, deliveryEvent, attachment, artifact, approved, connectorEnabled: connector.enabled });
    const core = {
      runId: `FF-RUN-${String(source.hash || "").slice(0, 20).toUpperCase()}`,
      assessmentId,
      status,
      label: runLabel(status),
      startedAt,
      lastActivityAt: stages.map(item => item.at).filter(Boolean).sort().at(-1) || startedAt,
      completedStages: stages.filter(item => item.status === "verified").length,
      totalStages: stages.length,
      candidateBinding: binding,
      stages,
      noPhi: true,
      remoteWriteClaimed: false
    };
    return { ...core, evidenceFingerprint: integrationRehearsalDigest(core) };
  });
  const preflight = candidateBinding(provider, advancement);
  const core = {
    contractVersion: INTEGRATION_REHEARSAL_CONTRACT,
    mode: "synthetic-findings-to-summary-automation",
    authoritativeEqpassContract: false,
    phiApproved: false,
    providerPreflight: preflight,
    counts: {
      runs: runs.length,
      awaitingClinician: runs.filter(run => run.status === "awaiting-clinician-review").length,
      preparedAndHeld: runs.filter(run => ["prepared-and-held", "ready-for-authorized-connector"].includes(run.status)).length,
      receipts: runs.filter(run => run.status === "rehearsed-not-attached").length,
      attention: runs.filter(run => ["attention", "integrity-attention"].includes(run.status)).length,
      exactCandidateMatches: runs.filter(run => run.candidateBinding.exactMatch).length
    },
    integrity: {
      valid: integrityValid,
      chainHeads: Object.fromEntries(chainEntries.map(([key, chain]) => [key, chain?.head || "GENESIS"]))
    },
    runs,
    clinicalDecisionAutomated: false,
    findingsPdfIngested: false,
    remoteWriteClaimed: false,
    boundary: INTEGRATION_REHEARSAL_BOUNDARY,
    generatedAt
  };
  return { ...core, observatoryFingerprint: integrationRehearsalDigest(core) };
}

export function buildSyntheticIntegrationRehearsalEvent(template, { token, occurredAt = new Date().toISOString() } = {}) {
  if (!TOKEN.test(String(token || ""))) throw new Error("Synthetic rehearsal token must contain 12–32 uppercase hexadecimal characters.");
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("Synthetic rehearsal occurredAt must be an ISO date-time.");
  const event = structuredClone(template);
  const completedAt = new Date(Date.parse(occurredAt) - 11 * 60 * 1000).toISOString();
  event.eventId = `FF-TEST-AUTOMATION-EVENT-${token}`;
  event.occurredAt = occurredAt;
  event.sourceAssessment.assessmentRef = `FF-TEST-AUTOMATION-${token}`;
  event.sourceAssessment.subjectRef = `FF-TEST-SUBJECT-${token}`;
  event.sourceAssessment.completedAt = completedAt;
  event.findingsReport.reportRef = `FF-TEST-FINDINGS-${token}`;
  event.findingsReport.sha256 = integrationRehearsalDigest({ token, templateHash: template.findingsReport?.sha256, kind: "synthetic-findings-placeholder" });
  event.trace.correlationId = `FF-TEST-CORRELATION-${token}`;
  event.trace.idempotencyKey = `FF-TEST-IDEMPOTENCY-${token}`;
  const errors = validateSyntheticEqpassEvent(event);
  if (errors.length) throw new Error(errors.join(" "));
  return event;
}
