import { createHash, randomUUID } from "node:crypto";
import { AUDIENCE_HANDOFF_CONTRACT, AUDIENCE_HANDOFF_PRESENTATION } from "./audience-handoff-page.js";
import { REPORT_CONTRACT } from "./report-page.js";

export const LANGUAGE_REVIEW_CONTRACT = "perl-language-review-packet/1.0";

export const LANGUAGE_REVIEW_BOUNDARY = "This office packages the exact working language currently exposed by PERL for clinical and counsel review. A sealed packet is not clinical acceptance, legal advice or approval, privacy or security approval, e-QPASS owner acceptance, disclaimer approval, language freeze, clinical validation, pilot authorization, production release, or permission for patient use. Reviewer codes record local packet authorship only and are not professional credentials or signatures.";

export const LANGUAGE_REVIEW_QUESTIONS = Object.freeze([
  Object.freeze({ id: "diagnostic-restraint", index: "01", label: "Diagnostic restraint", prompt: "Does every clause describe indicators and hypotheses without creating diagnostic certainty?", ownerRoles: Object.freeze(["clinical-lead", "legal-owner"]) }),
  Object.freeze({ id: "treatment-authority", index: "02", label: "Treatment authority", prompt: "Does the language avoid prescribing, selecting treatment, or determining level of care?", ownerRoles: Object.freeze(["clinical-lead", "legal-owner"]) }),
  Object.freeze({ id: "source-relationship", index: "03", label: "Source relationship", prompt: "Is e-QPASS score authority and the unchanged Findings relationship unmistakable?", ownerRoles: Object.freeze(["eqpass-owner", "clinical-lead"]) }),
  Object.freeze({ id: "safety-escalation", index: "04", label: "Safety escalation", prompt: "Does critical-screen copy route directly to accountable human review without generated resolution?", ownerRoles: Object.freeze(["clinical-lead", "legal-owner"]) }),
  Object.freeze({ id: "minimum-necessary", index: "05", label: "Minimum necessary", prompt: "Does each secondary audience receive only the context and decision rights its role requires?", ownerRoles: Object.freeze(["privacy-security-owner", "legal-owner"]) }),
  Object.freeze({ id: "conspicuousness", index: "06", label: "Conspicuousness + plain language", prompt: "Are purpose, limitations, review state, and responsibility understandable where the reader acts?", ownerRoles: Object.freeze(["executive-sponsor", "legal-owner"]) })
]);

export const LANGUAGE_REVIEW_ACCEPTANCES = Object.freeze([
  Object.freeze({ id: "executive-product", index: "01", label: "Executive + product sponsor", state: "external-acceptance-required" }),
  Object.freeze({ id: "clinical", index: "02", label: "Licensed clinical lead", state: "external-acceptance-required" }),
  Object.freeze({ id: "legal", index: "03", label: "Legal owner", state: "external-acceptance-required" }),
  Object.freeze({ id: "privacy-security", index: "04", label: "Privacy + security owner", state: "external-acceptance-required" }),
  Object.freeze({ id: "eqpass", index: "05", label: "e-QPASS owner", state: "external-acceptance-required" })
]);

const FALSE_AUTHORITY_FIELDS = Object.freeze([
  "executiveSponsorAccepted", "clinicalLeadAccepted", "legalApproved", "privacySecurityAccepted",
  "eqpassOwnerAccepted", "disclaimerApproved", "languageFrozen", "clinicalValidation",
  "pilotAuthorized", "productionReleaseAuthorized", "patientUseAuthorized"
]);

function clone(value) {
  return structuredClone(value);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function surface({ id, index, label, placement, audience, ownerRoles, currentText, sourceVersion, decisionQuestion }) {
  return Object.freeze({ id, index, label, placement, audience, ownerRoles: Object.freeze(ownerRoles), currentText, sourceVersion, decisionQuestion, state: "external-review-required" });
}

export function languageReviewSurfaces(intendedUseDraft = null) {
  return Object.freeze([
    surface({
      id: "intended-use",
      index: "01",
      label: "Proposed intended use",
      placement: "Governance charter and counsel packet",
      audience: "all-governed-readers",
      ownerRoles: ["executive-sponsor", "clinical-lead", "legal-owner"],
      currentText: intendedUseDraft?.scopeStatement || "No intended-use working draft has been recorded.",
      sourceVersion: intendedUseDraft ? `intended-use/v${intendedUseDraft.version}` : "intended-use/unset",
      decisionQuestion: "Is this the exact provider-first job PERL may support?"
    }),
    surface({
      id: "artifact-relationship",
      index: "02",
      label: "Findings relationship",
      placement: "Clinician attachment header",
      audience: "clinician",
      ownerRoles: ["clinical-lead", "eqpass-owner", "legal-owner"],
      currentText: REPORT_CONTRACT.artifactRelationship,
      sourceVersion: REPORT_CONTRACT.format,
      decisionQuestion: "Does this prevent PERL from appearing to replace the authoritative Findings report?"
    }),
    surface({
      id: "signal-authority",
      index: "03",
      label: "Scoring authority",
      placement: "Clinician signal profile",
      audience: "clinician",
      ownerRoles: ["clinical-lead", "eqpass-owner"],
      currentText: REPORT_CONTRACT.signalAuthority,
      sourceVersion: REPORT_CONTRACT.format,
      decisionQuestion: "Is upstream score authority clear to a clinician?"
    }),
    surface({
      id: "interpretation-boundary",
      index: "04",
      label: "Interpretation boundary",
      placement: "Clinician hypotheses section",
      audience: "clinician",
      ownerRoles: ["clinical-lead", "legal-owner"],
      currentText: REPORT_CONTRACT.interpretationBoundary,
      sourceVersion: REPORT_CONTRACT.format,
      decisionQuestion: "Does this label generated interpretation as testable hypotheses rather than conclusions?"
    }),
    surface({
      id: "clinical-disclaimer",
      index: "05",
      label: "Clinical disclaimer",
      placement: "Clinician attachment footer",
      audience: "clinician",
      ownerRoles: ["clinical-lead", "legal-owner"],
      currentText: REPORT_CONTRACT.disclaimer,
      sourceVersion: REPORT_CONTRACT.disclaimerVersion,
      decisionQuestion: "Is the clinical responsibility and prohibited-use boundary complete and conspicuous?"
    }),
    surface({
      id: "critical-screen",
      index: "06",
      label: "Critical-screen boundary",
      placement: "Safety route and governance packet",
      audience: "clinician",
      ownerRoles: ["clinical-lead", "legal-owner"],
      currentText: REPORT_CONTRACT.safetyReviewBoundary,
      sourceVersion: REPORT_CONTRACT.format,
      decisionQuestion: "Does this require direct human review without implying automated triage?"
    }),
    ...["care", "payer", "admin"].map((audience, offset) => surface({
      id: `${audience}-boundary`,
      index: String(offset + 7).padStart(2, "0"),
      label: AUDIENCE_HANDOFF_PRESENTATION[audience].label,
      placement: `${AUDIENCE_HANDOFF_PRESENTATION[audience].label} use boundary`,
      audience,
      ownerRoles: audience === "care" ? ["clinical-lead", "privacy-security-owner", "legal-owner"] : ["privacy-security-owner", "legal-owner"],
      currentText: AUDIENCE_HANDOFF_PRESENTATION[audience].boundary,
      sourceVersion: AUDIENCE_HANDOFF_CONTRACT.format,
      decisionQuestion: audience === "care"
        ? "Does coordination copy preserve clinical ownership and direct safety assessment?"
        : audience === "payer"
          ? "Does utilization copy prevent automated coverage, eligibility, or level-of-care authority?"
          : "Does administrative copy enforce minimum-necessary routing without clinical interpretation?"
    }))
  ]);
}

export function languageReviewCorpusFingerprint(intendedUseDraft = null) {
  return digest({ surfaces: languageReviewSurfaces(intendedUseDraft), questions: LANGUAGE_REVIEW_QUESTIONS, acceptances: LANGUAGE_REVIEW_ACCEPTANCES });
}

export function validateLanguageReviewContract() {
  const errors = [];
  const surfaces = languageReviewSurfaces(null);
  if (surfaces.length !== 9 || new Set(surfaces.map(item => item.id)).size !== 9) errors.push("Language review requires nine unique live copy surfaces.");
  if (LANGUAGE_REVIEW_QUESTIONS.length !== 6 || new Set(LANGUAGE_REVIEW_QUESTIONS.map(item => item.id)).size !== 6) errors.push("Language review requires six unique questions.");
  if (LANGUAGE_REVIEW_ACCEPTANCES.length !== 5 || LANGUAGE_REVIEW_ACCEPTANCES.some(item => item.state !== "external-acceptance-required")) errors.push("Language review requires five external acceptances.");
  if (surfaces.some(item => !item.currentText || item.currentText.length < 20 || item.state !== "external-review-required")) errors.push("Language review contains an invalid copy surface.");
  if (!/^[a-f0-9]{64}$/.test(languageReviewCorpusFingerprint())) errors.push("Language review corpus fingerprint is invalid.");
  return [...new Set(errors)];
}

export function createLanguageReviewPacket({ intendedUseDraft, evidenceSnapshot, actor, version, createdAt = new Date().toISOString(), id = randomUUID() }) {
  if (!intendedUseDraft) throw Object.assign(new Error("Record an intended-use working draft before sealing the language packet."), { status: 409 });
  const surfaces = clone(languageReviewSurfaces(intendedUseDraft));
  const core = {
    id,
    contractVersion: LANGUAGE_REVIEW_CONTRACT,
    type: "language-review-working-packet",
    version,
    status: "counsel-clinical-review-required",
    intendedUseDraftId: intendedUseDraft.id,
    intendedUseDraftHash: intendedUseDraft.hash,
    intendedUseDraftVersion: intendedUseDraft.version,
    intendedUseContext: intendedUseDraft.pilotContext,
    surfaces,
    reviewQuestions: clone(LANGUAGE_REVIEW_QUESTIONS),
    requiredAcceptances: clone(LANGUAGE_REVIEW_ACCEPTANCES),
    evidenceSnapshot: clone(evidenceSnapshot),
    corpusFingerprint: digest({ surfaces, questions: LANGUAGE_REVIEW_QUESTIONS, acceptances: LANGUAGE_REVIEW_ACCEPTANCES }),
    ...Object.fromEntries(FALSE_AUTHORITY_FIELDS.map(field => [field, false])),
    actor,
    createdAt
  };
  return { ...core, hash: digest(core) };
}

export function validateLanguageReviewPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return ["Language review packet is required."];
  const { hash, ...core } = packet;
  if (packet.contractVersion !== LANGUAGE_REVIEW_CONTRACT || packet.type !== "language-review-working-packet" || packet.status !== "counsel-clinical-review-required") errors.push("Language review packet identity is invalid.");
  if (!Number.isInteger(packet.version) || packet.version < 1) errors.push("Language review packet version is invalid.");
  if (!packet.intendedUseDraftId || !/^[a-f0-9]{64}$/.test(String(packet.intendedUseDraftHash || "")) || !Number.isInteger(packet.intendedUseDraftVersion) || packet.intendedUseDraftVersion < 1) errors.push("Intended-use evidence is invalid.");
  const surfaces = packet.surfaces || [];
  if (surfaces.length !== 9 || new Set(surfaces.map(item => item.id)).size !== 9 || surfaces.some((item, index) => item.index !== String(index + 1).padStart(2, "0") || item.state !== "external-review-required" || String(item.currentText || "").length < 20)) errors.push("Language review copy corpus is invalid.");
  if (digest(packet.reviewQuestions) !== digest(LANGUAGE_REVIEW_QUESTIONS)) errors.push("Language review question contract changed.");
  if (digest(packet.requiredAcceptances) !== digest(LANGUAGE_REVIEW_ACCEPTANCES)) errors.push("Language review acceptance contract changed.");
  if (packet.corpusFingerprint !== digest({ surfaces, questions: LANGUAGE_REVIEW_QUESTIONS, acceptances: LANGUAGE_REVIEW_ACCEPTANCES })) errors.push("Language review corpus fingerprint is invalid.");
  const evidence = packet.evidenceSnapshot || {};
  if (evidence.reportContract !== REPORT_CONTRACT.format || evidence.disclaimerVersion !== REPORT_CONTRACT.disclaimerVersion || evidence.audienceContract !== AUDIENCE_HANDOFF_CONTRACT.format || evidence.intendedUseContract !== "perl-intended-use-charter/1.0") errors.push("Language review contract evidence is incomplete.");
  if (evidence.intendedUseDraftHash !== packet.intendedUseDraftHash) errors.push("Language review intended-use evidence is inconsistent.");
  if (!/^(?:GENESIS|[a-f0-9]{64})$/.test(String(evidence.reportArtifactHead || ""))) errors.push("Language review report evidence is invalid.");
  for (const field of FALSE_AUTHORITY_FIELDS) if (packet[field] !== false) errors.push(`${field} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(packet.actor || ""))) errors.push("Language review actor is invalid.");
  if (!Number.isFinite(Date.parse(packet.createdAt))) errors.push("Language review timestamp is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Language review packet fingerprint is invalid.");
  return [...new Set(errors)];
}

export function createLanguageReviewEvent({ packet, sequence, previousHash, createdAt = packet.createdAt, id = randomUUID() }) {
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: LANGUAGE_REVIEW_CONTRACT,
    type: "language-review-packet-sealed",
    status: "counsel-clinical-review-required",
    packetId: packet.id,
    packetHash: packet.hash,
    packetVersion: packet.version,
    corpusFingerprint: packet.corpusFingerprint,
    intendedUseDraftHash: packet.intendedUseDraftHash,
    copySurfaceCount: packet.surfaces.length,
    reviewQuestionCount: packet.reviewQuestions.length,
    acceptancesRequired: packet.requiredAcceptances.length,
    acceptancesRecorded: 0,
    ...Object.fromEntries(FALSE_AUTHORITY_FIELDS.map(field => [field, false])),
    actor: packet.actor,
    createdAt,
    note: "The exact live copy corpus was sealed for external counsel and clinical review. No acceptance, approval, freeze, validation, pilot, production, or patient-use authority was created."
  };
  return { ...core, hash: digest(core) };
}

export function validateLanguageReviewEvent(event, { sequence, previousHash, packet } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Language review event is required."];
  const { hash, ...core } = event;
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Language review event chain position is invalid.");
  if (event.contractVersion !== LANGUAGE_REVIEW_CONTRACT || event.type !== "language-review-packet-sealed" || event.status !== "counsel-clinical-review-required") errors.push("Language review event identity is invalid.");
  if (!packet || event.packetId !== packet.id || event.packetHash !== packet.hash || event.packetVersion !== packet.version || event.corpusFingerprint !== packet.corpusFingerprint || event.intendedUseDraftHash !== packet.intendedUseDraftHash || event.actor !== packet.actor || event.createdAt !== packet.createdAt) errors.push("Language review event does not match its packet.");
  if (event.copySurfaceCount !== 9 || event.reviewQuestionCount !== 6 || event.acceptancesRequired !== 5 || event.acceptancesRecorded !== 0) errors.push("Language review event counts are invalid.");
  for (const field of FALSE_AUTHORITY_FIELDS) if (event[field] !== false) errors.push(`${field} must remain false.`);
  if (String(event.note || "").length < 100 || String(event.note || "").length > 420) errors.push("Language review event note is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(hash || "")) || digest(core) !== hash) errors.push("Language review event fingerprint is invalid.");
  return [...new Set(errors)];
}

export function buildLanguageReviewOffice({ intendedUseDraft = null, packets = [], chain, evidenceSnapshot, generatedAt = new Date().toISOString() }) {
  const surfaces = clone(languageReviewSurfaces(intendedUseDraft));
  const currentFingerprint = digest({ surfaces, questions: LANGUAGE_REVIEW_QUESTIONS, acceptances: LANGUAGE_REVIEW_ACCEPTANCES });
  const latestPacket = packets.at(-1) || null;
  const status = !intendedUseDraft
    ? "intended-use-required"
    : latestPacket?.corpusFingerprint === currentFingerprint && latestPacket.intendedUseDraftHash === intendedUseDraft.hash
      ? "review-packet-sealed-unaccepted"
      : "review-packet-ready-unaccepted";
  return {
    contractVersion: LANGUAGE_REVIEW_CONTRACT,
    status,
    headline: "Approve the words before they travel.",
    descriptor: "Clinical + counsel copy office · exact live language",
    surfaces,
    reviewQuestions: clone(LANGUAGE_REVIEW_QUESTIONS),
    requiredAcceptances: clone(LANGUAGE_REVIEW_ACCEPTANCES),
    intendedUse: intendedUseDraft ? { id: intendedUseDraft.id, version: intendedUseDraft.version, hash: intendedUseDraft.hash, pilotContext: intendedUseDraft.pilotContext } : null,
    evidenceSnapshot: clone(evidenceSnapshot),
    currentCorpusFingerprint: currentFingerprint,
    latestPacket: clone(latestPacket),
    history: packets.map(packet => ({ id: packet.id, version: packet.version, actor: packet.actor, createdAt: packet.createdAt, hash: packet.hash, corpusFingerprint: packet.corpusFingerprint, intendedUseDraftVersion: packet.intendedUseDraftVersion })),
    counts: { packets: packets.length, copySurfaces: surfaces.length, reviewQuestions: LANGUAGE_REVIEW_QUESTIONS.length, acceptancesRequired: LANGUAGE_REVIEW_ACCEPTANCES.length, acceptancesRecorded: 0 },
    ...Object.fromEntries(FALSE_AUTHORITY_FIELDS.map(field => [field, false])),
    chain: clone(chain),
    generatedAt,
    boundary: LANGUAGE_REVIEW_BOUNDARY
  };
}
