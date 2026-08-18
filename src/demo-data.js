export const assessments = [
  {
    id: "FF-TEST-2407-A",
    completedAt: "Today · 9:42 AM",
    duration: "09:42",
    status: "priority",
    reviewer: "Unassigned",
    source: "e-QPASS scored report",
    itemsAnswered: 105,
    scales: {
      depression: 22,
      anxiety: 16,
      anger: 9,
      gpi: 55,
      phobicAvoidance: 3,
      obsessiveCompulsive: 3,
      psychoticism: 2,
      suicideRisk: 1,
      violenceRisk: 0
    },
    subscales: [
      { label: "Dysphoria", domain: "Depression", score: 2, level: "minimal", evidence: "Items 1, 3, 4, 7, 8" },
      { label: "Unsustained effort", domain: "Depression", score: 2, level: "minimal", evidence: "Items 12, 15, 20, 23" },
      { label: "Negative cognition", domain: "Depression", score: 7, level: "mild", evidence: "Items 5, 6, 9, 10, 11, 25" },
      { label: "Fatigue", domain: "Depression", score: 2, level: "minimal", evidence: "Items 13–14" },
      { label: "Anhedonia", domain: "Depression", score: 5, level: "mild", evidence: "Items 16–18" },
      { label: "Apprehension", domain: "Anxiety", score: 9, level: "mild", evidence: "Items 27–32, 44" },
      { label: "Interpersonal anxiety", domain: "Anxiety", score: 2, level: "minimal", evidence: "Items 47–52" },
      { label: "Physiological arousal", domain: "Anxiety", score: 3, level: "mild", evidence: "Items 33–43" },
      { label: "Anger-out verbal", domain: "Anger", score: 2, level: "mild", evidence: "Items 75–79" }
    ],
    criticalResponses: [
      { item: "Critical screen S-1", score: 1, note: "Non-zero self-report; source wording is not reproduced in PERL." }
    ]
  },
  {
    id: "FF-TEST-2411-C",
    completedAt: "Today · 9:18 AM",
    duration: "08:57",
    status: "ready",
    reviewer: "M. Chen, LCSW",
    source: "e-QPASS scored report",
    itemsAnswered: 105,
    scales: {
      depression: 12,
      anxiety: 27,
      anger: 17,
      gpi: 68,
      phobicAvoidance: 1,
      obsessiveCompulsive: 2,
      psychoticism: 1,
      suicideRisk: 0,
      violenceRisk: 0
    },
    subscales: [
      { label: "Dysphoria", domain: "Depression", score: 1, level: "minimal", evidence: "Scored source construct" },
      { label: "Negative cognition", domain: "Depression", score: 2, level: "minimal", evidence: "Scored source construct" },
      { label: "Apprehension", domain: "Anxiety", score: 10, level: "mild", evidence: "Scored source construct" },
      { label: "Interpersonal anxiety", domain: "Anxiety", score: 4, level: "mild", evidence: "Scored source construct" },
      { label: "Physiological arousal", domain: "Anxiety", score: 4, level: "mild", evidence: "Scored source construct" },
      { label: "Angry mood", domain: "Anger", score: 3, level: "minimal", evidence: "Scored source construct" },
      { label: "Anger-in", domain: "Anger", score: 2, level: "minimal", evidence: "Scored source construct" },
      { label: "Anger-out verbal", domain: "Anger", score: 0, level: "minimal", evidence: "Scored source construct" }
    ],
    criticalResponses: []
  },
  {
    id: "FF-TEST-2388-B",
    completedAt: "Yesterday · 4:06 PM",
    duration: "11:16",
    status: "approved",
    reviewer: "J. Alvarez, PsyD",
    source: "e-QPASS scored report",
    itemsAnswered: 105,
    scales: {
      depression: 51,
      anxiety: 42,
      anger: 29,
      gpi: 141,
      phobicAvoidance: 5,
      obsessiveCompulsive: 4,
      psychoticism: 3,
      suicideRisk: 0,
      violenceRisk: 0
    },
    subscales: [
      { label: "Dysphoria", domain: "Depression", score: 9, level: "moderate", evidence: "Scored source construct" },
      { label: "Unsustained effort", domain: "Depression", score: 8, level: "moderate", evidence: "Scored source construct" },
      { label: "Negative cognition", domain: "Depression", score: 14, level: "moderate", evidence: "Scored source construct" },
      { label: "Fatigue", domain: "Depression", score: 8, level: "moderate", evidence: "Scored source construct" },
      { label: "Anhedonia", domain: "Depression", score: 8, level: "moderate", evidence: "Scored source construct" },
      { label: "Apprehension", domain: "Anxiety", score: 13, level: "moderate", evidence: "Scored source construct" },
      { label: "Interpersonal anxiety", domain: "Anxiety", score: 8, level: "moderate", evidence: "Scored source construct" },
      { label: "Physiological arousal", domain: "Anxiety", score: 8, level: "moderate", evidence: "Scored source construct" }
    ],
    criticalResponses: []
  }
];

export const auditSeed = [
  { time: "9:43 AM", actor: "PERL engine", action: "Draft generated", detail: "PERL clinical rules" },
  { time: "9:43 AM", actor: "Safety rules", action: "Approval held", detail: "Critical screen requires clinician review" },
  { time: "9:44 AM", actor: "System", action: "Evidence linked", detail: "105/105 source responses present" }
];
