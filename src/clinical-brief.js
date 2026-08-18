import {
  allowedEvidenceTokens,
  coverageScore,
  hasRestrictedClinicalLanguage,
  resolveScaleLevel,
  riskDisposition
} from "./engine.js";

export const CLINICAL_BRIEF_CONTRACT = Object.freeze({
  format: "perl-clinical-brief/1.0",
  intendedUse: "A concise, evidence-linked companion to the unchanged e-QPASS Findings report for qualified clinician review.",
  sourceAuthority: "e-QPASS scored output remains authoritative; PERL organizes, but does not rescore, source findings.",
  clinicalBoundary: "The brief presents self-report indicators and interview hypotheses. It does not diagnose, prescribe, infer cause, determine level of care, or resolve a critical-screen response.",
  evidenceBoundary: "Evidence references are limited to scored domains and subscales present in the current record; raw response wording is not reproduced.",
  reviewBoundary: "Automatic generation always requires accountable clinician review before release or use in care planning.",
  specificityMetric: Object.freeze({
    status: "not-scored",
    value: null,
    reason: "No clinically approved specificity formula or acceptance threshold has been supplied."
  })
});

const LEVEL_RANK = Object.freeze({ minimal: 0, mild: 1, moderate: 2, severe: 3 });
const LEVEL_LABEL = Object.freeze({ minimal: "Minimal", mild: "Mild", moderate: "Moderate", severe: "Severe" });
const DIMENSIONS = Object.freeze([
  Object.freeze({ key: "gpi", label: "Overall distress", evidenceLabel: "GPI" }),
  Object.freeze({ key: "depression", label: "Depression indicators", evidenceLabel: "Depression" }),
  Object.freeze({ key: "anxiety", label: "Anxiety indicators", evidenceLabel: "Anxiety" }),
  Object.freeze({ key: "anger", label: "Anger indicators", evidenceLabel: "Anger" })
]);
const DOMAIN_TOKENS = Object.freeze([
  Object.freeze({ pattern: /depress|dysphor|anhedon|fatigue|negative cognition|unsustained effort/i, label: "Depression" }),
  Object.freeze({ pattern: /anxiet|apprehension|physiological arousal|phobic/i, label: "Anxiety" }),
  Object.freeze({ pattern: /anger|angry/i, label: "Anger" })
]);

function titleCase(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function sentenceList(parts) {
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function themeDomain(theme) {
  const source = `${theme?.title || ""} ${(theme?.evidence || []).join(" ")}`;
  const domains = DOMAIN_TOKENS.filter(item => item.pattern.test(source)).map(item => item.label);
  if (domains.length > 1) return "Cross-domain";
  if (domains.length === 1) return domains[0];
  return /\bGPI\b|global/i.test(source) ? "Overall profile" : "Scored profile";
}

function uncertaintyFor(domain) {
  const context = domain === "Cross-domain" ? "the relationship among these signals" : "this signal";
  return `The scored profile does not establish duration, cause, functional impact, or whether ${context} persists outside the assessment context.`;
}

function followUpFor(domain, questions, used) {
  const patterns = {
    Depression: /interest|energy|motivation|self-evaluative|depress/i,
    Anxiety: /worry|avoidance|tension|arousal|anxiet/i,
    Anger: /anger|triggers|expressed|contained/i,
    "Cross-domain": /broader pattern|daily functioning|sleep|concentration|relationships/i,
    "Overall profile": /broader pattern|daily functioning|sleep|concentration|relationships/i,
    "Scored profile": /current effect|protective factors|currently helping/i
  };
  const pattern = patterns[domain] || patterns["Scored profile"];
  const match = questions.find((question, index) => !used.has(index) && pattern.test(question));
  const fallback = match || questions.find((_, index) => !used.has(index)) || "What context would confirm, refine, or contradict this hypothesis?";
  const index = questions.indexOf(fallback);
  if (index >= 0) used.add(index);
  return fallback;
}

function buildMixedSignals(assessment, dimensions) {
  const signals = [];
  const primary = dimensions.filter(item => item.key !== "gpi");
  const ranks = primary.map(item => LEVEL_RANK[item.level]);
  const minimum = Math.min(...ranks);
  const maximum = Math.max(...ranks);
  if (maximum > minimum) {
    const low = LEVEL_LABEL[Object.keys(LEVEL_RANK).find(key => LEVEL_RANK[key] === minimum)];
    const high = LEVEL_LABEL[Object.keys(LEVEL_RANK).find(key => LEVEL_RANK[key] === maximum)];
    signals.push({
      id: "uneven-primary-profile",
      label: "Uneven primary-domain profile",
      statement: `Primary domain range labels span ${low.toLowerCase()} to ${high.toLowerCase()}; the result should not be read as one uniform level of burden.`,
      evidence: primary.map(item => item.evidence)
    });
  }

  for (const dimension of primary) {
    const elevatedChildren = (assessment.subscales || [])
      .filter(item => String(item.domain || "").toLowerCase() === dimension.key && LEVEL_RANK[item.level] > LEVEL_RANK[dimension.level])
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.score - a.score);
    if (elevatedChildren.length) {
      const strongest = elevatedChildren[0];
      signals.push({
        id: `${dimension.key}-subscale-concentration`,
        label: `Contained ${dimension.key} signal`,
        statement: `${strongest.label} is ${strongest.level}-range while the parent ${dimension.key} domain is ${dimension.level}-range. Clarify whether the narrower signal is situational or functionally meaningful.`,
        evidence: [dimension.evidence, `${strongest.label} · ${strongest.score}`]
      });
    }
  }
  return signals.slice(0, 3);
}

function buildQualityChecks(assessment, interpretation, narrative, disposition) {
  const allowed = allowedEvidenceTokens(assessment);
  const themes = Array.isArray(interpretation?.hypotheses) ? interpretation.hypotheses : [];
  const questions = Array.isArray(interpretation?.questions) ? interpretation.questions : [];
  const allEvidenceLinked = themes.length > 0 && themes.every(theme => (
    Array.isArray(theme.evidence) && theme.evidence.length > 0 && theme.evidence.every(token => allowed.has(token))
  ));
  const language = [
    narrative,
    ...themes.flatMap(theme => [theme.title, theme.body]),
    ...questions
  ];
  return [
    {
      id: "input-coverage",
      label: "Scored input coverage",
      status: coverageScore(assessment) === 100 ? "pass" : "review",
      value: `${coverageScore(assessment)}%`,
      detail: "Required scored fields and the supported subscale set are present. This is not a clinical-validity score."
    },
    {
      id: "diagnostic-restraint",
      label: "Diagnostic restraint",
      status: hasRestrictedClinicalLanguage(...language) ? "fail" : "pass",
      value: hasRestrictedClinicalLanguage(...language) ? "Needs revision" : "Pass",
      detail: "Generated and reviewer-edited language is checked for prohibited diagnostic certainty."
    },
    {
      id: "evidence-lineage",
      label: "Theme evidence lineage",
      status: allEvidenceLinked ? "pass" : "fail",
      value: allEvidenceLinked ? "Pass" : "Needs revision",
      detail: `${themes.length} clinical theme${themes.length === 1 ? " is" : "s are"} linked only to scored evidence in this record.`
    },
    {
      id: "critical-screen-route",
      label: "Critical-screen route",
      status: disposition.requiresReview ? "review" : "pass",
      value: disposition.requiresReview ? "Direct review" : "Pass",
      detail: disposition.requiresReview
        ? "The deterministic hold remains visible; generated prose cannot resolve it."
        : "No non-zero critical-screen response is present; routine source verification still applies."
    },
    {
      id: "specificity",
      label: "Clinical specificity",
      status: CLINICAL_BRIEF_CONTRACT.specificityMetric.status,
      value: "Not scored",
      detail: CLINICAL_BRIEF_CONTRACT.specificityMetric.reason
    }
  ];
}

export function buildClinicalBrief({ assessment, interpretation, narrative = "" }) {
  if (!assessment || typeof assessment !== "object") throw new TypeError("Clinical brief requires an assessment.");
  const resolvedInterpretation = interpretation || { hypotheses: [], questions: [] };
  const disposition = riskDisposition(assessment);
  const dimensions = DIMENSIONS.map(dimension => {
    const level = resolveScaleLevel(assessment, dimension.key);
    const score = assessment.scales[dimension.key];
    return {
      key: dimension.key,
      label: dimension.label,
      score,
      level,
      evidence: `${dimension.evidenceLabel} · ${score}`,
      statement: `${titleCase(level)}-range self-report signal in the current scored profile.`
    };
  });
  const overall = dimensions.find(item => item.key === "gpi");
  const questions = Array.isArray(resolvedInterpretation.questions) ? resolvedInterpretation.questions : [];
  const usedQuestions = new Set();
  const themes = (resolvedInterpretation.hypotheses || []).map((theme, index) => {
    const domain = themeDomain(theme);
    return {
      id: `theme-${String(index + 1).padStart(2, "0")}`,
      domain,
      title: theme.title,
      hypothesis: theme.body,
      confidence: theme.confidence,
      uncertainty: uncertaintyFor(domain),
      evidence: [...theme.evidence],
      followUp: followUpFor(domain, questions, usedQuestions)
    };
  });
  const highlighted = Number(assessment.criticalResponses?.length || 0);
  const redFlags = {
    status: disposition.requiresReview ? "direct-review-required" : "no-automated-hold",
    urgency: disposition.urgency,
    highlightedResponses: highlighted,
    headline: disposition.requiresReview ? "Direct critical-screen review required" : "No non-zero critical-screen response present",
    statement: disposition.requiresReview
      ? "A qualified clinician must verify the authoritative source response and complete direct safety assessment before approval or care-planning use."
      : "No automated safety hold is present in this record. This does not replace routine direct clinical verification.",
    sourceDisclosure: highlighted
      ? `${highlighted} highlighted source response${highlighted === 1 ? "" : "s"}; raw response wording is intentionally not reproduced.`
      : "No raw response wording is reproduced."
  };
  const mixedSignals = buildMixedSignals(assessment, dimensions);
  const qualityChecks = buildQualityChecks(assessment, resolvedInterpretation, narrative, disposition);
  return {
    format: CLINICAL_BRIEF_CONTRACT.format,
    recordId: assessment.id,
    overallDistress: {
      headline: `${titleCase(overall.level)}-range overall distress`,
      score: overall.score,
      level: overall.level,
      statement: String(narrative || "").trim() || `${overall.statement} Interpret only alongside the full scored profile and direct clinical context.`,
      evidence: overall.evidence
    },
    coreDimensions: dimensions,
    clinicalThemes: themes,
    mixedSignals: {
      status: mixedSignals.length ? "observed" : "none-observed",
      headline: mixedSignals.length ? `${mixedSignals.length} pattern${mixedSignals.length === 1 ? "" : "s"} to clarify` : "No specific score mismatch identified",
      items: mixedSignals,
      statement: mixedSignals.length
        ? "These are comparison prompts, not contradictions resolved by the software."
        : "Range labels are internally aligned in this record; interview context may still reveal complexity not captured by scores."
    },
    redFlags,
    qualityChecks,
    limitations: [
      "This is a single-timepoint self-report profile and may be affected by response style, context, comprehension, and willingness to disclose.",
      "Range labels follow the configured e-QPASS score mapping and should be verified against the authoritative source report.",
      "The scored record does not establish duration, onset, trajectory, functional impairment, protective factors, or collateral context.",
      "PERL does not infer diagnosis, causation, treatment, medical necessity, eligibility, or level of care.",
      "Critical-screen status must be verified in the authoritative source record and addressed through direct clinical assessment."
    ],
    boundaries: {
      sourceAuthority: CLINICAL_BRIEF_CONTRACT.sourceAuthority,
      clinical: CLINICAL_BRIEF_CONTRACT.clinicalBoundary,
      evidence: CLINICAL_BRIEF_CONTRACT.evidenceBoundary,
      review: CLINICAL_BRIEF_CONTRACT.reviewBoundary
    }
  };
}

export function validateClinicalBrief(brief, assessment) {
  const errors = [];
  if (!brief || typeof brief !== "object") return ["Clinical brief must be an object."];
  if (brief.format !== CLINICAL_BRIEF_CONTRACT.format) errors.push("Clinical brief format is not supported.");
  if (brief.recordId !== assessment?.id) errors.push("Clinical brief record does not match the assessment.");
  if (!brief.overallDistress || !Array.isArray(brief.coreDimensions) || brief.coreDimensions.length !== 4) errors.push("Clinical brief core profile is incomplete.");
  if (!Array.isArray(brief.clinicalThemes) || brief.clinicalThemes.length < 1) errors.push("Clinical brief requires at least one evidence-linked theme.");
  if (!brief.mixedSignals || !brief.redFlags || !Array.isArray(brief.qualityChecks) || !Array.isArray(brief.limitations)) errors.push("Clinical brief required sections are incomplete.");
  const allowed = allowedEvidenceTokens(assessment || {});
  for (const theme of brief.clinicalThemes || []) {
    if (!Array.isArray(theme.evidence) || theme.evidence.some(token => !allowed.has(token))) errors.push(`Clinical theme ${theme.id || "unknown"} contains unlinked evidence.`);
  }
  const language = [
    brief.overallDistress?.statement,
    ...(brief.clinicalThemes || []).flatMap(theme => [theme.title, theme.hypothesis, theme.uncertainty, theme.followUp])
  ];
  if (hasRestrictedClinicalLanguage(...language)) errors.push("Clinical brief contains diagnostic or overly certain wording.");
  if (brief.qualityChecks?.find(item => item.id === "specificity")?.status !== "not-scored") errors.push("Clinical specificity must remain unscored until an approved metric is supplied.");
  return [...new Set(errors)];
}
