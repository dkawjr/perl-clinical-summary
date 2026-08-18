import { createHash, randomUUID } from "node:crypto";

export const CAMPUS_OBSERVATORY_CONTRACT = "perl-campus-operations-observatory/1.0";

export const CAMPUS_OBSERVATORY_BOUNDARY = "This observatory is an aggregate-only operating surface for source-backed provider-pilot planning and synthetic rehearsal. It does not display or accept assessment rows, student identities, counselor identities, raw answers, Findings content, narrative summaries, notes, credentials, files, or PHI; verify a site, population, caseload, roster, licensure, authority, agreement, training, schedule, quarter, source denominator, clinical review, safety response, usefulness result, workflow-time result, outcome, renewal, customization, implementation, production release, or patient use; compare campuses; rank clinicians; infer diagnoses, treatment effects, or student outcomes; contact a site; start a pilot; or authorize access. Every displayed count is labeled synthetic rehearsal or unavailable. A sealed quarterly-review snapshot preserves only bounded aggregate counts, a source-backed candidate and review-moment identifier, an enum-only working customization position, current evidence fingerprints, and false authority claims. The snapshot is not a site report, clinical record, approval, completed review, or evidence that a pilot occurred.";

const freeze = value => Object.freeze(value);
const clone = value => structuredClone(value);

export const CAMPUS_REVIEW_MOMENTS = freeze([
  freeze({ id: "admission", index: "00", label: "Admission", timing: "Before bounded use", question: "Are scope, owners, denominators, training, support, stop rules, and exact dates accepted?" }),
  freeze({ id: "quarter-one", index: "01", label: "Quarter one", timing: "First authorized quarter", question: "Is the workflow being reviewed completely and safely, with correction and timing evidence captured?" }),
  freeze({ id: "midyear", index: "02", label: "Midyear", timing: "Second authorized quarter", question: "Should the bounded workflow continue, pause, or return for a controlled revision?" }),
  freeze({ id: "closeout", index: "03", label: "Closeout", timing: "End of bounded term", question: "Should access stop, be revised, renew under a new agreement, or enter a separate expansion decision?" })
]);

export const CAMPUS_CUSTOMIZATION_POSITIONS = freeze([
  freeze({ id: "no-position-recorded", label: "Decision open", detail: "Keep the source-proposed page or survey question unresolved until the named site and product owners review it." }),
  freeze({ id: "keep-standard-page", label: "Keep standard", detail: "Use the standard PERL page with no site-specific question in the bounded pilot proposal." }),
  freeze({ id: "evaluate-one-survey-question", label: "Evaluate one question", detail: "Carry one minimum-necessary, non-clinical survey question into a separate privacy, clinical, and site review." }),
  freeze({ id: "defer-customization", label: "Defer", detail: "Hold customization until an authorized pilot produces a documented operating need." })
]);

export const CAMPUS_MEASURE_BOOK = freeze([
  freeze({ id: "eligible-activity", index: "01", label: "Workflow coverage", numerator: "summariesGenerated", denominator: "assessmentsEligible", guardrail: "Synthetic rehearsal only; production requires the authoritative site denominator." }),
  freeze({ id: "review-completion", index: "02", label: "Review completion", numerator: "reviewsDisposed", denominator: "summariesGenerated", guardrail: "A generated or opened summary is not a completed clinician review." }),
  freeze({ id: "correction-burden", index: "03", label: "Correction burden", numerator: "correctionRecords", denominator: "reviewsDisposed", guardrail: "Unavailable until structured corrections exist; low editing cannot establish accuracy." }),
  freeze({ id: "critical-routing", index: "04", label: "Critical routing", numerator: "criticalRoutesRequired", denominator: "criticalScreens", guardrail: "This reflects deterministic route evaluation, not proof that a clinician responded." }),
  freeze({ id: "workflow-time", index: "05", label: "Workflow timing", numerator: "timingObservations", denominator: null, guardrail: "No time-savings claim without an accepted comparator and protocol." }),
  freeze({ id: "counselor-usefulness", index: "06", label: "Counselor usefulness", numerator: "usefulnessRatings", denominator: null, guardrail: "Preference is not diagnostic accuracy, reliability, or patient benefit." })
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function boundedCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function percentage(numerator, denominator) {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function measureReading(definition, counts) {
  const numerator = boundedCount(counts[definition.numerator]);
  const denominator = definition.denominator ? boundedCount(counts[definition.denominator]) : null;
  const observable = definition.denominator ? denominator > 0 : numerator > 0;
  return {
    ...clone(definition),
    numerator,
    denominator,
    percentage: observable && definition.denominator ? percentage(numerator, denominator) : null,
    state: observable ? "synthetic-observation" : "awaiting-evidence",
    availability: observable ? "Observed in the frozen synthetic rehearsal." : "No eligible observation is available."
  };
}

export function validateCampusObservatoryContract() {
  const errors = [];
  if (CAMPUS_REVIEW_MOMENTS.length !== 4 || new Set(CAMPUS_REVIEW_MOMENTS.map(item => item.id)).size !== 4) errors.push("The observatory must fix four unique review moments.");
  if (CAMPUS_CUSTOMIZATION_POSITIONS.length !== 4 || CAMPUS_CUSTOMIZATION_POSITIONS[0]?.id !== "no-position-recorded") errors.push("The observatory customization register is invalid.");
  if (CAMPUS_MEASURE_BOOK.length !== 6 || new Set(CAMPUS_MEASURE_BOOK.map(item => item.id)).size !== 6) errors.push("The observatory must fix six unique denominator-first measures.");
  if (CAMPUS_OBSERVATORY_BOUNDARY.length < 850 || !/aggregate-only/i.test(CAMPUS_OBSERVATORY_BOUNDARY) || !/not a site report/i.test(CAMPUS_OBSERVATORY_BOUNDARY)) errors.push("The observatory claim boundary is incomplete.");
  return [...new Set(errors)];
}

export function validateCampusObservatorySnapshotInput(input, candidateIds = []) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["A quarterly-review snapshot request is required."];
  const allowed = new Set(["candidateId", "reviewMomentId", "customizationPositionId"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push(`Unexpected snapshot field: ${key}.`);
  if (!candidateIds.includes(input.candidateId)) errors.push("Choose a source-backed provider candidate.");
  if (!CAMPUS_REVIEW_MOMENTS.some(item => item.id === input.reviewMomentId)) errors.push("Choose one fixed review moment.");
  if (!CAMPUS_CUSTOMIZATION_POSITIONS.some(item => item.id === input.customizationPositionId)) errors.push("Choose one bounded customization position.");
  return [...new Set(errors)];
}

function observatoryCore({ pilotOperations, providerActivation, operationalCounts, evidenceContext }) {
  const candidates = (pilotOperations?.candidates || []).map(candidate => ({
    id: candidate.id,
    index: candidate.index,
    label: candidate.label,
    setting: candidate.setting,
    status: candidate.status,
    scope: candidate.scope,
    workingWindow: candidate.workingWindow,
    customization: candidate.customization,
    siteVerified: false,
    pilotAuthorized: false
  }));
  const counts = {
    assessmentsEligible: boundedCount(operationalCounts?.assessmentsEligible),
    summariesGenerated: boundedCount(operationalCounts?.summariesGenerated),
    reviewsDisposed: boundedCount(operationalCounts?.reviewsDisposed),
    summariesApproved: boundedCount(operationalCounts?.summariesApproved),
    correctionRecords: boundedCount(operationalCounts?.correctionRecords),
    criticalScreens: boundedCount(operationalCounts?.criticalScreens),
    criticalRoutesRequired: boundedCount(operationalCounts?.criticalRoutesRequired),
    timingObservations: boundedCount(operationalCounts?.timingObservations),
    usefulnessRatings: boundedCount(operationalCounts?.usefulnessRatings),
    openIncidents: boundedCount(operationalCounts?.openIncidents)
  };
  return {
    contractVersion: CAMPUS_OBSERVATORY_CONTRACT,
    sourceRegister: {
      direction: "Dolores correspondence · 2026-03-30 and 2026-03-31",
      groupDashboardSourceProposed: true,
      quarterlyReviewsSourceProposed: true,
      trainingObjectivesBeforeUseSourceProposed: true,
      pageCustomizationDecisionSourceProposed: true,
      sourceClaimsVerifiedExternally: false
    },
    candidates,
    reviewMoments: clone(CAMPUS_REVIEW_MOMENTS),
    customizationPositions: clone(CAMPUS_CUSTOMIZATION_POSITIONS),
    operatingCounts: counts,
    measures: CAMPUS_MEASURE_BOOK.map(definition => measureReading(definition, counts)),
    training: {
      modulesDesigned: boundedCount(providerActivation?.counts?.modules),
      objectivesDesigned: boundedCount(providerActivation?.counts?.objectives),
      acceptedCompletions: boundedCount(providerActivation?.counts?.acceptedCompletions),
      activatedSites: boundedCount(providerActivation?.counts?.activatedSites),
      workbookFingerprint: providerActivation?.workbookFingerprint || null,
      trainingVerified: false
    },
    evidenceContext: clone(evidenceContext || {}),
    aggregateOnly: true,
    syntheticOnly: true,
    recordRowsIncluded: false,
    phiIncluded: false,
    siteVerified: false,
    quarterVerified: false,
    pilotAuthorized: false,
    pilotStarted: false,
    clinicalOutcomeEstablished: false,
    patientUseAuthorized: false,
    boundary: CAMPUS_OBSERVATORY_BOUNDARY
  };
}

export function buildCampusObservatory({ pilotOperations, providerActivation, operationalCounts = {}, evidenceContext = {}, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const errors = validateCampusObservatoryContract();
  if (errors.length) throw new Error(errors.join(" "));
  const core = observatoryCore({ pilotOperations, providerActivation, operationalCounts, evidenceContext });
  const observatoryFingerprint = digest(core);
  const latest = events.at(-1) || null;
  const selectedCandidate = core.candidates[0] || null;
  return {
    ...core,
    status: "synthetic-observatory-site-data-unavailable",
    headline: "See the work without seeing the student.",
    subhead: "A quiet operating view for activity, review quality, safety routing, training, and the next quarterly decision.",
    selectedCandidateId: selectedCandidate?.id || null,
    selectedReviewMomentId: "admission",
    selectedCustomizationPositionId: "no-position-recorded",
    observatoryFingerprint,
    latestSnapshot: latest ? {
      sequence: latest.sequence,
      createdAt: latest.createdAt,
      actor: latest.actor,
      candidateId: latest.candidateId,
      reviewMomentId: latest.reviewMomentId,
      customizationPositionId: latest.customizationPositionId,
      hash: latest.hash,
      current: latest.observatoryFingerprint === observatoryFingerprint
    } : null,
    history: clone(events),
    chain: clone(chain),
    generatedAt
  };
}

export function createCampusObservatorySnapshot({ observatory, input, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const candidateIds = (observatory?.candidates || []).map(item => item.id);
  const inputErrors = validateCampusObservatorySnapshotInput(input, candidateIds);
  if (inputErrors.length) throw new Error(inputErrors.join(" "));
  const cleanActor = String(actor || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(cleanActor)) throw new Error("Actor must be 2–48 safe characters.");
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: CAMPUS_OBSERVATORY_CONTRACT,
    type: "aggregate-quarterly-review-posture-recorded",
    status: "synthetic-review-posture-only",
    observatoryFingerprint: observatory.observatoryFingerprint,
    candidateId: input.candidateId,
    reviewMomentId: input.reviewMomentId,
    customizationPositionId: input.customizationPositionId,
    operatingCounts: clone(observatory.operatingCounts),
    measureStates: observatory.measures.map(item => ({ id: item.id, numerator: item.numerator, denominator: item.denominator, percentage: item.percentage, state: item.state })),
    evidenceContext: clone(observatory.evidenceContext),
    decision: "working-review-posture-recorded-authority-remains-external",
    aggregateOnly: true,
    syntheticOnly: true,
    sourceClaimsVerifiedExternally: false,
    recordRowsIncluded: false,
    sourceDenominatorVerified: false,
    siteIdentityVerified: false,
    counselorIdentityVerified: false,
    trainingVerified: false,
    quarterOccurred: false,
    customizationApproved: false,
    reviewCompleted: false,
    clinicalOutcomeEstablished: false,
    pilotAuthorized: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    phiIncluded: false,
    actor: cleanActor,
    createdAt,
    note: "Aggregate synthetic operating snapshot only. It records a working review posture and enum-only customization position without verifying a site, denominator, counselor, training, quarter, customization, completed review, clinical outcome, pilot, production release, or patient use."
  };
  return { ...core, hash: digest(core) };
}

export function validateCampusObservatorySnapshot(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Campus-observatory snapshot is required."];
  if (event.contractVersion !== CAMPUS_OBSERVATORY_CONTRACT || event.type !== "aggregate-quarterly-review-posture-recorded") errors.push("Campus-observatory snapshot contract is invalid.");
  if (event.sequence !== sequence || event.previousHash !== previousHash || !Number.isInteger(event.sequence) || event.sequence < 1) errors.push("Campus-observatory chain position is invalid.");
  if (!/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Campus-observatory previous hash is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(event.observatoryFingerprint || ""))) errors.push("Campus-observatory fingerprint is invalid.");
  if (event.status !== "synthetic-review-posture-only" || event.decision !== "working-review-posture-recorded-authority-remains-external") errors.push("Campus-observatory snapshot overstates its disposition.");
  if (!CAMPUS_REVIEW_MOMENTS.some(item => item.id === event.reviewMomentId)) errors.push("Campus-observatory review moment is invalid.");
  if (!CAMPUS_CUSTOMIZATION_POSITIONS.some(item => item.id === event.customizationPositionId)) errors.push("Campus-observatory customization position is invalid.");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(event.candidateId || ""))) errors.push("Campus-observatory candidate is invalid.");
  if (event.aggregateOnly !== true || event.syntheticOnly !== true) errors.push("Campus-observatory snapshot must remain aggregate-only and synthetic.");
  const falseFields = ["sourceClaimsVerifiedExternally", "recordRowsIncluded", "sourceDenominatorVerified", "siteIdentityVerified", "counselorIdentityVerified", "trainingVerified", "quarterOccurred", "customizationApproved", "reviewCompleted", "clinicalOutcomeEstablished", "pilotAuthorized", "pilotStarted", "productionReleaseAuthorized", "patientUseAuthorized", "phiIncluded"];
  for (const field of falseFields) if (event[field] !== false) errors.push(`${field} must remain false.`);
  const countKeys = ["assessmentsEligible", "summariesGenerated", "reviewsDisposed", "summariesApproved", "correctionRecords", "criticalScreens", "criticalRoutesRequired", "timingObservations", "usefulnessRatings", "openIncidents"];
  if (!event.operatingCounts || countKeys.some(key => !Number.isInteger(event.operatingCounts[key]) || event.operatingCounts[key] < 0)) errors.push("Campus-observatory aggregate counts are invalid.");
  if (!Array.isArray(event.measureStates) || event.measureStates.length !== 6) errors.push("Campus-observatory measure states are invalid.");
  if (!event.evidenceContext || typeof event.evidenceContext !== "object" || Array.isArray(event.evidenceContext)) errors.push("Campus-observatory evidence context is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || ""))) errors.push("Campus-observatory actor is invalid.");
  if (!Number.isFinite(Date.parse(event.createdAt))) errors.push("Campus-observatory timestamp is invalid.");
  if (String(event.note || "").length < 220) errors.push("Campus-observatory non-authority note is incomplete.");
  const { hash, ...core } = event;
  if (hash !== digest(core)) errors.push("Campus-observatory snapshot hash is invalid.");
  return [...new Set(errors)];
}

