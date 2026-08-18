const LEVELS = ["minimal", "mild", "moderate", "severe"];

export const SCALE_THRESHOLDS = {
  depression: [21, 46, 64],
  anxiety: [15, 37, 55],
  anger: [23, 34, 51],
  gpi: [72, 134, 186],
  phobicAvoidance: [1, 4, 7],
  obsessiveCompulsive: [3, 7, 10],
  psychoticism: [3, 7, 12],
  suicideRisk: [0, 0, 1],
  violenceRisk: [0, 0, 1]
};

const SCALE_MAXIMUMS = {
  depression: 104,
  anxiety: 116,
  anger: 112,
  gpi: 420,
  phobicAvoidance: 40,
  obsessiveCompulsive: 40,
  psychoticism: 40,
  suicideRisk: 8,
  violenceRisk: 8
};

export function classifyScale(scale, score) {
  const limits = SCALE_THRESHOLDS[scale];
  if (!limits || !Number.isFinite(score)) throw new TypeError(`Invalid ${scale} score`);
  const index = score <= limits[0] ? 0 : score <= limits[1] ? 1 : score <= limits[2] ? 2 : 3;
  return LEVELS[index];
}

export function resolveScaleLevel(assessment, scale) {
  const supplied = assessment.scaleLevels?.[scale];
  if (LEVELS.includes(supplied)) return supplied;
  return classifyScale(scale, assessment.scales?.[scale]);
}

export function riskDisposition(assessment) {
  const suicide = Number(assessment.scales?.suicideRisk || 0);
  const violence = Number(assessment.scales?.violenceRisk || 0);
  const critical = assessment.criticalResponses || [];
  const requiresReview = suicide > 0 || violence > 0 || critical.some(item => item.directReviewRequired === true || item.score > 0);

  return {
    requiresReview,
    urgency: suicide >= 2 || violence >= 2 ? "immediate" : requiresReview ? "priority" : "routine",
    reason: requiresReview
      ? "One or more self-reported critical-screen responses requires direct clinician review."
      : "No non-zero critical-screen responses are present in this synthetic record."
  };
}

const LABELS = {
  depression: "depression indicators",
  anxiety: "anxiety indicators",
  anger: "anger indicators"
};

function sentenceList(parts) {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

const LEVEL_RANK = { minimal: 0, mild: 1, moderate: 2, severe: 3 };
const RESTRICTED_LANGUAGE = /\b(?:diagnosed with|meets criteria for|definitely|proves)\b|\bhas\s+(?:(?:a|an|the)\s+)?(?:depression|anxiety|psychosis|a?dhd|ptsd|bipolar(?:\s+disorder)?|[a-z-]+\s+disorder|diagnosis)\b/i;

export function hasRestrictedClinicalLanguage(...values) {
  return RESTRICTED_LANGUAGE.test(values.flat(Infinity).map(value => String(value ?? "")).join(" "));
}

function evidenceToken(item) {
  return `${item.label} · ${item.score}`;
}

function normalizedLabel(value) {
  return String(value || "").toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

export function generateClinicalInterpretation(assessment) {
  const subscales = Array.isArray(assessment.subscales) ? assessment.subscales : [];
  const byLabel = new Map(subscales.map(item => [normalizedLabel(item.label), item]));
  const elevated = subscales.filter(item => LEVEL_RANK[item.level] > 0);
  const depressionSubscales = elevated.filter(item => item.domain.toLowerCase() === "depression");
  const anxietySubscales = elevated.filter(item => item.domain.toLowerCase() === "anxiety");
  const angerSubscales = elevated.filter(item => item.domain.toLowerCase() === "anger");
  const depressionLevel = resolveScaleLevel(assessment, "depression");
  const anxietyLevel = resolveScaleLevel(assessment, "anxiety");
  const angerLevel = resolveScaleLevel(assessment, "anger");
  const gpiLevel = resolveScaleLevel(assessment, "gpi");
  const highestDomainRank = Math.max(LEVEL_RANK[depressionLevel], LEVEL_RANK[anxietyLevel], LEVEL_RANK[angerLevel]);
  const hypotheses = [];
  const titles = new Set();
  const addHypothesis = hypothesis => {
    if (!titles.has(hypothesis.title) && hypotheses.length < 3) {
      hypotheses.push(hypothesis);
      titles.add(hypothesis.title);
    }
  };

  if (LEVEL_RANK[depressionLevel] >= 2 && LEVEL_RANK[anxietyLevel] >= 2 && LEVEL_RANK[gpiLevel] >= 2) {
    addHypothesis({
      title: "Broad negative-affect burden",
      body: `${depressionLevel[0].toUpperCase() + depressionLevel.slice(1)} depression and ${anxietyLevel} anxiety indicators co-occur with a ${gpiLevel} global index. This convergence may reflect a broader pattern, but duration, functional impact, and context still require direct assessment.`,
      confidence: "High",
      evidence: [`Depression · ${assessment.scales.depression}`, `Anxiety · ${assessment.scales.anxiety}`, `GPI · ${assessment.scales.gpi}`]
    });
  }

  if (depressionSubscales.length >= 3 && LEVEL_RANK[depressionLevel] >= 2) {
    const selected = depressionSubscales.slice().sort((a, b) => b.score - a.score).slice(0, 3);
    addHypothesis({
      title: "Motivation, cognition, and fatigue may converge",
      body: "The depression-related profile is distributed across several constructs rather than isolated to one signal. Clarify medical, sleep, medication, substance, situational, and temporal contributors before drawing conclusions.",
      confidence: "Moderate",
      evidence: selected.map(evidenceToken)
    });
  }

  const anhedonia = byLabel.get("anhedonia");
  const negativeCognition = byLabel.get("negativecognition");
  if (LEVEL_RANK[anhedonia?.level] > 0 && LEVEL_RANK[negativeCognition?.level] > 0 && depressionSubscales.length < 3) {
    addHypothesis({
      title: "Reduced reward and self-evaluative strain",
      body: `${anhedonia.level[0].toUpperCase() + anhedonia.level.slice(1)} anhedonia with ${negativeCognition.level} negative-cognition indicators may reflect reduced access to pleasure alongside self-critical appraisal. Clarify duration, context, and functional change.`,
      confidence: "Moderate",
      evidence: [evidenceToken(anhedonia), evidenceToken(negativeCognition)]
    });
  }

  const apprehension = byLabel.get("apprehension");
  const physiologicalArousal = byLabel.get("physiologicalarousal");
  if (LEVEL_RANK[apprehension?.level] > 0 && anxietySubscales.length >= 3) {
    addHypothesis({
      title: "Worry-led anxiety pattern",
      body: `${anxietyLevel[0].toUpperCase() + anxietyLevel.slice(1)} anxiety indicators are distributed across apprehension, interpersonal concerns, and physiological arousal. Clarify persistence, triggers, avoidance, and functional impact.`,
      confidence: "Moderate",
      evidence: [`Anxiety · ${assessment.scales.anxiety}`, evidenceToken(apprehension)]
    });
  } else if (LEVEL_RANK[apprehension?.level] > 0 && LEVEL_RANK[physiologicalArousal?.level] > 0) {
    addHypothesis({
      title: "Cognitive tension with limited somatic load",
      body: "Apprehension is more prominent than physiological arousal, which may indicate a worry-led pattern. Confirm whether tension is generalized, situational, or episodic.",
      confidence: "Moderate",
      evidence: [evidenceToken(apprehension), evidenceToken(physiologicalArousal)]
    });
  }

  if (highestDomainRank > LEVEL_RANK[gpiLevel]) {
    const elevatedDomains = [
      ["Depression", assessment.scales.depression, depressionLevel],
      ["Anxiety", assessment.scales.anxiety, anxietyLevel],
      ["Anger", assessment.scales.anger, angerLevel]
    ].filter(([, , level]) => LEVEL_RANK[level] > LEVEL_RANK[gpiLevel]);
    addHypothesis({
      title: gpiLevel === "minimal" ? "Domain signal without corresponding global elevation" : "Domain and global scores are not fully aligned",
      body: `One or more domain indicators exceed the ${gpiLevel} global index. This mixed signal may reflect contained, context-specific, or uneven distress; explore protective factors, recent stressors, and functional impact.`,
      confidence: "High",
      evidence: [`GPI · ${assessment.scales.gpi}`, ...elevatedDomains.slice(0, 2).map(([label, score]) => `${label} · ${score}`)]
    });
  }

  if (angerSubscales.length && hypotheses.length < 3) {
    const selected = angerSubscales.slice().sort((a, b) => b.score - a.score).slice(0, 2);
    addHypothesis({
      title: "Anger expression warrants contextual clarification",
      body: "The anger-related signal is concentrated in specific expression constructs rather than sufficient on its own to establish a broader conclusion. Clarify triggers, frequency, consequences, and regulation strategies.",
      confidence: "Moderate",
      evidence: selected.map(evidenceToken)
    });
  }

  if (!hypotheses.length) {
    const top = subscales.slice().sort((a, b) => b.score - a.score).slice(0, 2);
    addHypothesis({
      title: "No concentrated elevation in the scored profile",
      body: "The scored domains do not show a concentrated elevated pattern in this self-report. Clinical interview remains necessary to assess timing, context, functioning, and concerns not captured by the instrument.",
      confidence: "High",
      evidence: [`GPI · ${assessment.scales.gpi}`, ...top.map(evidenceToken)]
    });
  } else if (hypotheses.length < 3 && elevated.length) {
    const selected = elevated.slice().sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.score - a.score).slice(0, 3);
    addHypothesis({
      title: "Profile concentration should be tested in context",
      body: `The strongest subscale signals cluster in ${sentenceList(selected.map(item => item.label.toLowerCase()))}. Determine whether this pattern is persistent, situational, recent, or already changing before using it in care planning.`,
      confidence: "Moderate",
      evidence: selected.map(evidenceToken)
    });
  }

  const questions = [];
  const addQuestion = question => { if (!questions.includes(question) && questions.length < 5) questions.push(question); };
  const risk = riskDisposition(assessment);
  if (risk.requiresReview) addQuestion("What does the person understand the non-zero critical-screen response to mean, and what direct safety assessment is indicated now?");
  if (depressionSubscales.length) addQuestion("What changed around the onset of reduced interest, energy, motivation, or self-evaluative strain?");
  if (anxietySubscales.length) addQuestion("Which situations most reliably activate worry, avoidance, interpersonal tension, or physiological arousal?");
  if (angerSubscales.length) addQuestion("What tends to precede anger-related experiences, and how are they expressed, contained, or resolved?");
  if (highestDomainRank >= 2) addQuestion("How long has this broader pattern been present, and which aspects most disrupt daily functioning?");
  else addQuestion("What is the current effect, if any, on sleep, concentration, work, school, relationships, or daily decisions?");
  addQuestion("Which relationships, routines, coping strategies, and other protective factors are currently helping?");

  return { hypotheses, questions };
}

export function allowedEvidenceTokens(assessment) {
  const scaleLabels = {
    depression: "Depression",
    anxiety: "Anxiety",
    anger: "Anger",
    gpi: "GPI",
    phobicAvoidance: "Phobic avoidance",
    obsessiveCompulsive: "Obsessive-compulsive",
    psychoticism: "Psychoticism",
    suicideRisk: "Suicide risk",
    violenceRisk: "Violence risk"
  };
  return new Set([
    ...Object.entries(assessment.scales || {}).map(([key, score]) => `${scaleLabels[key] || key} · ${score}`),
    ...(assessment.subscales || []).map(evidenceToken)
  ]);
}

export function validateClinicalInterpretation(input, assessment) {
  const errors = [];
  if (!input || typeof input !== "object") return ["Interpretation must be an object."];
  if (!Array.isArray(input.hypotheses) || input.hypotheses.length < 1 || input.hypotheses.length > 6) {
    errors.push("Interpretation must contain between 1 and 6 hypotheses.");
  }
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 8) {
    errors.push("Interpretation must contain between 1 and 8 follow-up questions.");
  }
  const allowedEvidence = allowedEvidenceTokens(assessment);
  for (const [index, hypothesis] of (input.hypotheses || []).entries()) {
    const prefix = `Hypothesis ${index + 1}`;
    const title = String(hypothesis?.title || "").trim();
    const body = String(hypothesis?.body || "").trim();
    if (title.length < 3 || title.length > 180) errors.push(`${prefix} title must contain 3–180 characters.`);
    if (body.length < 40 || body.length > 1400) errors.push(`${prefix} explanation must contain 40–1,400 characters.`);
    if (RESTRICTED_LANGUAGE.test(`${title} ${body}`)) errors.push(`${prefix} uses diagnostic or overly certain wording.`);
    if (!["Low", "Moderate", "High"].includes(hypothesis?.confidence)) errors.push(`${prefix} must use Low, Moderate, or High confidence.`);
    if (!Array.isArray(hypothesis?.evidence) || hypothesis.evidence.length < 1 || hypothesis.evidence.length > 12) {
      errors.push(`${prefix} must retain at least one scored evidence link.`);
    } else {
      const unknown = hypothesis.evidence.filter(token => !allowedEvidence.has(token));
      if (unknown.length) errors.push(`${prefix} contains evidence not present in the scored assessment: ${unknown.join(", ")}.`);
    }
  }
  for (const [index, question] of (input.questions || []).entries()) {
    const value = String(question || "").trim();
    if (value.length < 8 || value.length > 500) errors.push(`Follow-up question ${index + 1} must contain 8–500 characters.`);
    if (RESTRICTED_LANGUAGE.test(value)) errors.push(`Follow-up question ${index + 1} uses diagnostic or overly certain wording.`);
  }
  return errors;
}

export function generateSummary(assessment, audience = "clinician") {
  const scores = assessment.scales;
  const domainLevels = ["depression", "anxiety", "anger"].map(key => ({
    key,
    score: scores[key],
    level: resolveScaleLevel(assessment, key)
  }));
  const gpi = resolveScaleLevel(assessment, "gpi");
  const elevated = domainLevels.filter(item => item.level !== "minimal");
  const concentration = assessment.subscales
    .filter(item => ["mild", "moderate", "severe"].includes(item.level))
    .slice(0, 4)
    .map(item => item.label.toLowerCase());
  const risk = riskDisposition(assessment);

  if (audience === "admin") {
    const completion = assessment.itemsAnswered === 105
      ? "The self-report assessment is complete with all 105 required responses recorded."
      : `The self-report assessment currently contains ${assessment.itemsAnswered} of 105 required responses.`;
    const routing = risk.requiresReview
      ? "A deterministic critical-screen hold requires qualified clinician review before the companion summary can move forward."
      : "No deterministic critical-screen hold is present in this record; routine clinician review is still required before release.";
    return `${completion} ${routing} This administrative routing note supports completion and workflow tracking only; it contains no clinical interpretation, does not establish a diagnosis, and does not authorize a care or coverage decision.`;
  }

  const opening = elevated.length
    ? `Self-report results show ${sentenceList(elevated.map(item => `${item.level}-range ${LABELS[item.key]}`))}, with ${gpi}-range global distress.`
    : `Self-report results fall in the minimal range across depression, anxiety, anger, and global distress indices.`;
  const pattern = concentration.length
    ? `The pattern is concentrated in ${sentenceList(concentration)} rather than evenly distributed across domains.`
    : "No elevated subscale concentration is present in this record.";
  const safety = risk.requiresReview
    ? "A non-zero critical-screen response must be reviewed directly with the person before this summary is approved or used in care planning."
    : "Critical-screen responses do not show a non-zero item in this record; routine clinical verification remains appropriate.";

  if (audience === "care") {
    return `${opening} ${pattern} Coordinate timely follow-up around the highlighted domains and confirm the critical-screen review status. This is decision support based on self-report, not a diagnosis.`;
  }
  if (audience === "payer") {
    return `${opening} The profile supports clinician follow-up and documented review of functional impact and safety. No diagnosis or level-of-care determination is made by this summary.`;
  }
  return `${opening} ${pattern} ${safety} These findings are hypotheses for a licensed clinician to test against interview data, history, context, and observed functioning; they do not establish a diagnosis.`;
}

export function coverageScore(assessment) {
  const required = ["depression", "anxiety", "anger", "gpi", "suicideRisk", "violenceRisk"];
  const supplied = required.filter(key => Number.isFinite(assessment.scales?.[key])).length;
  const subscaleCoverage = Math.min(assessment.subscales?.length || 0, 8) / 8;
  return Math.round(((supplied / required.length) * 0.7 + subscaleCoverage * 0.3) * 100);
}

export function validateAssessment(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["Assessment must be a JSON object."];
  if (!/^FF-TEST-[A-Z0-9-]+$/.test(input.id || "")) errors.push("Use a synthetic ID beginning with FF-TEST-.");
  if (!input.scales || typeof input.scales !== "object") errors.push("Missing scales object.");
  for (const key of Object.keys(SCALE_THRESHOLDS)) {
    const value = input.scales?.[key];
    if (!Number.isFinite(value)) errors.push(`Missing numeric scale: ${key}.`);
    else if (!Number.isInteger(value) || value < 0 || value > SCALE_MAXIMUMS[key]) errors.push(`Scale ${key} must be a non-negative integer within the supported range.`);
  }
  if (Object.hasOwn(input, "scaleLevels")) {
    if (!input.scaleLevels || typeof input.scaleLevels !== "object" || Array.isArray(input.scaleLevels)) {
      errors.push("scaleLevels must be an object when supplied.");
    } else {
      const expected = Object.keys(SCALE_THRESHOLDS);
      const unknown = Object.keys(input.scaleLevels).filter(key => !expected.includes(key));
      const missing = expected.filter(key => !Object.hasOwn(input.scaleLevels, key));
      if (unknown.length) errors.push(`Unknown source scale levels: ${unknown.join(", ")}.`);
      if (missing.length) errors.push(`Missing source scale levels: ${missing.join(", ")}.`);
      for (const key of expected) {
        if (Object.hasOwn(input.scaleLevels, key) && !LEVELS.includes(input.scaleLevels[key])) errors.push(`Scale level ${key} must be minimal, mild, moderate, or severe.`);
      }
    }
  }
  if (!Array.isArray(input.subscales)) errors.push("Missing subscales array.");
  if (!Array.isArray(input.criticalResponses)) errors.push("Missing criticalResponses array.");
  if (input.itemsAnswered !== 105) errors.push("Synthetic e-QPASS fixtures must declare 105 answered items.");
  if (!/synthetic/i.test(String(input.source || ""))) errors.push("The source label must explicitly identify the fixture as synthetic.");

  const prohibitedKeys = new Set([
    "address", "birthdate", "clientid", "dateofbirth", "dob", "email", "firstname", "fullname",
    "lastname", "medicalrecordnumber", "mrn", "name", "patientid", "phone", "respondentid", "ssn"
  ]);
  const suspiciousKeys = [];
  const walk = value => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (prohibitedKeys.has(key.toLowerCase().replaceAll(/[^a-z0-9]/g, ""))) suspiciousKeys.push(key);
      if (child && typeof child === "object") walk(child);
    }
  };
  walk(input);
  if (suspiciousKeys.length) errors.push(`Potential direct-identifier fields are not permitted: ${[...new Set(suspiciousKeys)].join(", ")}.`);
  return errors;
}

export function validateNarrative(text) {
  const value = String(text || "").trim();
  const errors = [];
  if (value.length < 40) errors.push("The clinical narrative is too short to preserve context.");
  if (value.length > 6000) errors.push("The clinical narrative exceeds the 6,000-character review limit.");
  if (RESTRICTED_LANGUAGE.test(value)) {
    errors.push("Replace diagnostic or overly certain wording with indicator language.");
  }
  return errors;
}
