export const calibrationManifest = {
  id: "perl-synthetic-rehearsal-2026-08-v1",
  version: "1.0.0",
  status: "frozen-engineering-rehearsal",
  frozenAt: "2026-08-13T16:00:00.000Z",
  population: "synthetic e-QPASS scored fixtures",
  clinicalValidation: false,
  holdoutValid: false,
  claimBoundary: "The development/holdout split rehearses study controls only. These bundled synthetic cases were visible during product development and are not a valid unseen clinical holdout.",
  targetStrata: ["low-signal", "contained-domain", "broad-burden", "critical-screen"],
  cases: {
    "FF-TEST-2407-A": {
      partition: "development",
      strata: ["contained-domain", "critical-screen"],
      sourceVersion: "e-qpass-synthetic-fixture/1.0",
      referenceVersion: "counselor-reference/1.0",
      assignmentEnabled: true
    },
    "FF-TEST-2388-B": {
      partition: "development",
      strata: ["broad-burden"],
      sourceVersion: "e-qpass-synthetic-fixture/1.0",
      referenceVersion: "counselor-reference/1.0",
      assignmentEnabled: true
    },
    "FF-TEST-2411-C": {
      partition: "holdout",
      strata: ["contained-domain"],
      sourceVersion: "e-qpass-synthetic-fixture/1.0",
      referenceVersion: "counselor-reference/1.0",
      assignmentEnabled: true
    }
  }
};

export function validateCalibrationManifest(manifest, assessments = [], references = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return ["Calibration case-set manifest is required."];
  if (!/^[a-z0-9][a-z0-9-]{4,79}$/.test(String(manifest.id || ""))) errors.push("Case-set ID must be a stable lowercase identifier.");
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || ""))) errors.push("Case-set version must use semantic versioning.");
  if (manifest.status !== "frozen-engineering-rehearsal") errors.push("The sandbox accepts only a frozen engineering-rehearsal manifest.");
  if (!manifest.frozenAt || Number.isNaN(new Date(manifest.frozenAt).getTime())) errors.push("Case-set freeze time must be an ISO date-time.");
  if (manifest.clinicalValidation !== false || manifest.holdoutValid !== false) errors.push("The synthetic manifest must explicitly deny clinical validation and valid unseen-holdout status.");
  if (String(manifest.claimBoundary || "").length < 80) errors.push("Case-set claim boundary must state the synthetic holdout limitation.");
  if (!Array.isArray(manifest.targetStrata) || new Set(manifest.targetStrata).size !== manifest.targetStrata?.length) errors.push("Target strata must be a unique array.");
  const allowedPartitions = new Set(["development", "holdout"]);
  const targetStrata = new Set(manifest.targetStrata || []);
  const assessmentIds = new Set(assessments.map(item => item.id));
  const caseIds = Object.keys(manifest.cases || {});
  if (!caseIds.length) errors.push("At least one manifested calibration case is required.");
  for (const id of caseIds) {
    const entry = manifest.cases[id];
    if (!assessmentIds.has(id)) errors.push(`Manifest case ${id} is missing from scored fixtures.`);
    if (!references[id]?.summary) errors.push(`Manifest case ${id} is missing its counselor reference.`);
    if (!allowedPartitions.has(entry?.partition)) errors.push(`Manifest case ${id} has an unsupported partition.`);
    if (!Array.isArray(entry?.strata) || !entry.strata.length || entry.strata.some(stratum => !targetStrata.has(stratum))) errors.push(`Manifest case ${id} must use declared target strata.`);
    if (!entry?.sourceVersion || !entry?.referenceVersion) errors.push(`Manifest case ${id} requires source and reference versions.`);
    if (entry?.assignmentEnabled !== true) errors.push(`Manifest case ${id} must explicitly declare assignment eligibility.`);
  }
  for (const assessment of assessments) {
    if (references[assessment.id]?.summary && !manifest.cases?.[assessment.id]) errors.push(`Referenced fixture ${assessment.id} is missing from the case-set manifest.`);
  }
  if (!caseIds.some(id => manifest.cases[id]?.partition === "development")) errors.push("The manifest requires a development partition.");
  if (!caseIds.some(id => manifest.cases[id]?.partition === "holdout")) errors.push("The manifest requires a holdout partition.");
  return errors;
}
