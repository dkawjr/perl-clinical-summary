import { createHash } from "node:crypto";

export const CALIBRATION_INTAKE_CONTRACT = "perl-calibration-intake/1.0";

export const CALIBRATION_INTAKE_BOUNDARY = "This read-only intake map translates source-reported proposal facts and the current synthetic case-set rehearsal into an evidence request. It does not confirm that any assessment files were received, inspect or accept patient data, authorize PHI, approve de-identification, establish a valid holdout, record counselor or clinical acceptance, create a training dataset, establish clinical validity, or authorize production or pilot use.";

const SOURCE_REPORT = Object.freeze({
  source: "Focused Future — AI Clinical Summary Tool Proposal · July 2026",
  reportedAssessmentCount: 600,
  reportedClinicalQualityPercent: 80,
  reportedMarketingNoisePercent: 20,
  status: "source-reported-not-received",
  note: "The proposal describes approximately 600 existing assessments and an estimated 80/20 quality split. PERL has not received or inspected that library."
});

const INTAKE_LANES = Object.freeze([
  Object.freeze({
    id: "authority",
    index: "01",
    label: "Authority + permitted use",
    title: "Name who may release what.",
    purpose: "Confirm the system-of-record owner, clinical lead, privacy/security authority, legal basis, intended use, and an approved transfer path before any file moves.",
    status: "decision-required"
  }),
  Object.freeze({
    id: "inventory",
    index: "02",
    label: "Inventory + quarantine",
    title: "Count first. Open later.",
    purpose: "Receive only an aggregate inventory, then quarantine approved de-identified candidates while duplicates, marketing-panel records, rescoring, corruption, and source versions are reconciled.",
    status: "not-started"
  }),
  Object.freeze({
    id: "minimum-necessary",
    index: "03",
    label: "Minimum-necessary contract",
    title: "Keep identity outside the study.",
    purpose: "Freeze the scored-event fields, counselor-reference fields, prohibited identifiers, retention, deletion, access logging, and direct critical-screen handling before record-level intake.",
    status: "rfi-open"
  }),
  Object.freeze({
    id: "cohort",
    index: "04",
    label: "Eligibility + cohort design",
    title: "Build the denominator before the result.",
    purpose: "Apply predeclared eligibility, quality, strata, partition, duplicate, supersession, and missingness rules; preserve an unseen holdout under governed access.",
    status: "rehearsal-only"
  }),
  Object.freeze({
    id: "reference-freeze",
    index: "05",
    label: "Counselor references + freeze",
    title: "Lock the comparison before tuning.",
    purpose: "Bind qualified counselor interpretations, provenance, conflicts, adjudication, reviewer allocation, and the signed analysis plan to the frozen case manifest before model or rule refinement begins.",
    status: "not-started"
  })
]);

const REQUIRED_RETURNS = Object.freeze([
  "Named system-of-record owner, clinical lead, privacy/security owner, legal owner, and independent evaluator.",
  "Approved aggregate inventory by source type, report version, scoring version, date range, and known quality class.",
  "Documented authority and an encrypted, access-controlled transfer and quarantine path.",
  "Field-level minimum-necessary map, prohibited-field list, de-identification method, and re-identification-risk review.",
  "Rules for marketing-panel exclusion, duplicates, rescoring, supersession, missingness, corruption, and critical-screen cases.",
  "Predeclared eligibility, exclusion, strata, development/holdout allocation, and denominator rules.",
  "Counselor-reference provenance, qualifications, conflicts, adjudication method, and intended-use restrictions.",
  "Holdout access control, freeze timestamp, versioning, audit, retention, deletion, and incident procedure.",
  "Signed clinical, legal, privacy/security, and independent-evaluation acceptance before record-level analysis."
]);

const PROHIBITED_CONTENT = Object.freeze([
  "Names, contact details, dates of birth, addresses, examiner identifiers, or free-text demographics",
  "Raw item responses or exact critical-screen wording unless explicitly approved as minimum necessary",
  "Production credentials, endpoints, tokens, unredacted logs, or uncontrolled shared-drive links",
  "Unversioned counselor notes or report files whose source, author, and assessment linkage cannot be proven",
  "Any dataset labeled clinical-quality, de-identified, representative, unseen, or validation-ready without signed evidence"
]);

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function validateCalibrationIntakeContract() {
  const errors = [];
  if (INTAKE_LANES.length !== 5) errors.push("Calibration intake requires exactly five ordered lanes.");
  if (new Set(INTAKE_LANES.map(item => item.id)).size !== INTAKE_LANES.length) errors.push("Calibration intake lane IDs must be unique.");
  if (REQUIRED_RETURNS.length !== 9) errors.push("Calibration intake requires exactly nine source returns.");
  if (PROHIBITED_CONTENT.length !== 5) errors.push("Calibration intake requires exactly five prohibited-content classes.");
  if (SOURCE_REPORT.reportedClinicalQualityPercent + SOURCE_REPORT.reportedMarketingNoisePercent !== 100) errors.push("Source-reported quality percentages must total 100.");
  if (CALIBRATION_INTAKE_BOUNDARY.length < 220) errors.push("Calibration intake claim boundary is incomplete.");
  return errors;
}

export function buildCalibrationIntake({ analysis, manifestPackage, generatedAt = new Date().toISOString() }) {
  const contractErrors = validateCalibrationIntakeContract();
  if (contractErrors.length) throw new Error(contractErrors.join(" "));
  const caseSet = analysis?.caseSet || {};
  const strata = Object.entries(caseSet.stratumCoverage || {}).map(([id, coverage]) => ({
    id,
    cases: Number(coverage?.cases || 0),
    reviewedCases: Number(coverage?.reviewedCases || 0),
    present: Number(coverage?.cases || 0) > 0
  }));
  const presentStrata = strata.filter(item => item.present).length;
  const integrity = manifestPackage?.integrity || {};
  const manifest = manifestPackage?.manifest || {};
  const currentSandbox = {
    manifestId: caseSet.id || manifest.id || null,
    manifestVersion: caseSet.version || manifest.version || null,
    manifestHash: integrity.manifestHash || null,
    cases: Number(caseSet.cases || 0),
    developmentCases: Number(caseSet.partitionCoverage?.development?.cases || 0),
    holdoutRehearsalCases: Number(caseSet.partitionCoverage?.holdout?.cases || 0),
    reviewedCases: Number(caseSet.partitionCoverage?.development?.reviewedCases || 0) + Number(caseSet.partitionCoverage?.holdout?.reviewedCases || 0),
    strata,
    presentStrata,
    targetStrata: strata.length,
    missingStrata: clone(caseSet.missingStrata || []),
    holdoutValid: false,
    clinicalValidation: false,
    status: "synthetic-engineering-rehearsal"
  };
  const packetCore = {
    contractVersion: CALIBRATION_INTAKE_CONTRACT,
    sourceReport: SOURCE_REPORT,
    currentSandbox,
    lanes: INTAKE_LANES,
    requiredReturns: REQUIRED_RETURNS,
    prohibitedContent: PROHIBITED_CONTENT,
    recordsReceived: false,
    recordsInspected: 0,
    recordLevelIntakeEnabled: false,
    phiApproved: false,
    deidentificationAccepted: false,
    sourceAuthorityAccepted: false,
    holdoutValid: false,
    counselorReferencesAccepted: false,
    clinicalValidation: false,
    trainingDatasetCreated: false,
    productionDataConnected: false,
    pilotAuthorizationRecorded: false,
    boundary: CALIBRATION_INTAKE_BOUNDARY
  };
  return {
    ...clone(packetCore),
    status: "source-data-not-received",
    generatedAt,
    headline: "The library is reported. The cohort is not yet evidence.",
    nextDecision: "Approve the aggregate inventory, named authorities, minimum-necessary contract, and quarantine path before any record-level transfer.",
    packetFingerprint: digest(packetCore)
  };
}
