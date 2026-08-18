// Human-authored synthetic references used only for calibration and regression study design.
// They are deliberately separate from the scored e-QPASS input contract.
export const calibrationReferences = {
  "FF-TEST-2407-A": {
    summary: "Self-report results show mild depression and anxiety indicators with minimal anger and global distress. The profile is concentrated in reduced reward, self-critical appraisal, apprehension, and limited physiological arousal. A non-zero critical-screen response requires direct clarification and documentation before the summary is used. These findings are interview hypotheses rather than a diagnosis.",
    hypotheses: [
      {
        title: "Reduced reward and self-evaluative strain",
        body: "Mild anhedonia with negative-cognition indicators may reflect reduced access to pleasure alongside self-critical appraisal. Clarify duration, context, and functional change.",
        confidence: "Moderate",
        evidence: ["Anhedonia · 5", "Negative cognition · 7"]
      },
      {
        title: "Cognitive tension with limited somatic load",
        body: "Apprehension is more prominent than physiological arousal, which may indicate a worry-led pattern. Confirm whether tension is generalized, situational, or episodic.",
        confidence: "Moderate",
        evidence: ["Apprehension · 9", "Physiological arousal · 3"]
      },
      {
        title: "Mixed signal: overall burden remains contained",
        body: "Domain elevations are mild while the global index remains minimal. Explore protective factors, recent stressors, and whether symptoms cluster around a specific setting.",
        confidence: "High",
        evidence: ["GPI · 55", "Depression · 22", "Anxiety · 16"]
      }
    ],
    questions: [
      "What changed around the onset of reduced interest or pleasure?",
      "How often does worry interfere with sleep, concentration, or decision-making?",
      "What does the person understand the non-zero critical-screen response to mean?",
      "Which relationships, routines, or coping strategies are currently protective?"
    ]
  },
  "FF-TEST-2411-C": {
    summary: "Self-report results show a mild anxiety signal distributed across apprehension, interpersonal concerns, and physiological arousal, while depression, anger, and global distress remain minimal. Clarify persistence, situational triggers, avoidance, and functional impact. This pattern is decision support based on self-report and does not establish a diagnosis.",
    hypotheses: [
      {
        title: "Worry-led anxiety pattern",
        body: "Anxiety indicators are mild and distributed across apprehension, interpersonal concerns, and physiological arousal. Clarify persistence and functional impact.",
        confidence: "Moderate",
        evidence: ["Anxiety · 27", "Apprehension · 10"]
      },
      {
        title: "No corresponding global elevation",
        body: "The global index remains in the minimal range, which may indicate contained or context-specific distress.",
        confidence: "High",
        evidence: ["GPI · 68"]
      }
    ],
    questions: [
      "Which situations most reliably activate worry or bodily tension?",
      "What is the current effect on work, school, sleep, or relationships?",
      "What helps the person return to baseline?"
    ]
  },
  "FF-TEST-2388-B": {
    summary: "Self-report results show moderate depression and anxiety indicators, mild anger indicators, and moderate global distress. The depression-related profile is distributed across dysphoria, effort, cognition, fatigue, and reduced reward rather than isolated to one construct. Clarify duration, impairment, medical and sleep contributors, substance or medication effects, and protective factors before drawing conclusions.",
    hypotheses: [
      {
        title: "Broad negative-affect burden",
        body: "Moderate depression and anxiety indicators co-occur with a moderate global index, suggesting a broader pattern that merits careful functional and temporal assessment.",
        confidence: "High",
        evidence: ["Depression · 51", "Anxiety · 42", "GPI · 141"]
      },
      {
        title: "Motivation, cognition, and fatigue converge",
        body: "The depression profile is distributed rather than isolated. Clarify medical, sleep, situational, and substance-related contributors before drawing conclusions.",
        confidence: "Moderate",
        evidence: ["Negative cognition · 14", "Fatigue · 8", "Anhedonia · 8"]
      }
    ],
    questions: [
      "How long has this broader pattern been present?",
      "Which aspects most disrupt daily functioning?",
      "Are there medical, sleep, medication, or substance factors that could contribute?"
    ]
  }
};
