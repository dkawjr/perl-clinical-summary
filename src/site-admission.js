import { createHash, randomUUID } from "node:crypto";
import { PILOT_AUTHORITY_REGISTER } from "./pilot-readiness.js";

export const SITE_ADMISSION_CONTRACT = "perl-named-site-admission-dossier/1.0";
export const SITE_ADMISSION_RETURN_CONTRACT = "perl-named-site-admission-return/rfi-1.0";

export const SITE_ADMISSION_BOUNDARY = "This dossier assembles a source-backed, candidate-specific admission question set and accepts only a metadata envelope for local structural preflight. It does not contact a site; verify a site name, setting, population, roster, licensure, training, accessibility, agreement, budget, authority, signature, evidence, e-QPASS contract, data path, privacy or security control, independent finding, support route, measure, date, revocation term, or trusted time; receive evidence files, identities, signatures, credentials, records, Findings content, secrets, or PHI; record an acceptance or authorization; open or close a readiness gate; start a pilot clock; activate a provider; release production; authorize patient use; establish clinical validity, reliability, performance, outcome, renewal, or expansion; or permit a care decision. Source-reported candidate details remain planning context, and complete local metadata remains unverified. A named decision group must authenticate every accountable authority, verify every governed reference and prerequisite, execute the site agreement, and issue a separately trusted, bounded authorization before any pilot use.";

const freeze = value => Object.freeze(value);
const question = (id, index, bookId, label, prompt) => freeze({ id, index, bookId, label, prompt });

export const SITE_ADMISSION_BOOKS = freeze([
  freeze({ id: "site-setting", index: "01", label: "Site & setting", thesis: "Name the institution, operating unit, accountable local lead, and exact provider workflow being considered." }),
  freeze({ id: "scope-window", index: "02", label: "Scope & window", thesis: "Bound the population, record denominator, inclusion and exclusion rules, start, end, and prohibited expansion." }),
  freeze({ id: "data-control", index: "03", label: "Data & control", thesis: "Bind authoritative e-QPASS behavior, field-level data flow, privacy, security, retention, and downtime controls." }),
  freeze({ id: "people-access", index: "04", label: "People & access", thesis: "Verify the minimum roster, qualifications, training completion, supervision, accessibility, and revocation path." }),
  freeze({ id: "measure-support", index: "05", label: "Measure & support", thesis: "Fix denominators, review cadence, support coverage, incidents, stopping rules, restart authority, and closeout evidence." }),
  freeze({ id: "terms-authority", index: "06", label: "Terms & authority", thesis: "Execute the commercial and legal boundary, then capture the exact named decision group and scoped authorization." })
]);

export const SITE_ADMISSION_QUESTIONS = freeze([
  question("authenticated-site", "01", "site-setting", "Authenticated site identity", "Which governed record proves the legal institution, operating unit, address or tenant boundary, and accountable local executive for this exact candidate?"),
  question("bounded-setting", "02", "site-setting", "Bounded provider setting", "Which provider workflow, care setting, local clinical owner, and excluded settings define the smallest permissible operating boundary?"),
  question("population-denominator", "03", "scope-window", "Population & denominator", "Which accepted register fixes eligible people or records, inclusion and exclusion rules, maximum volume, and the denominator used for every activity claim?"),
  question("window-expansion", "04", "scope-window", "Date window & expansion lock", "What exact start, end, pause, renewal, and prohibited-expansion terms prevent the source-proposed window from becoming an automatic launch or rollover?"),
  question("eqpass-data-path", "05", "data-control", "Authoritative e-QPASS path", "Which signed source contract and field-level data-flow decision govern scoring, critical screens, Findings preservation, report lifecycle, attachment, rescore, and failure behavior?"),
  question("privacy-security", "06", "data-control", "Privacy, security & continuity", "Which accepted controls cover identity, least privilege, encryption, retention, vendors, monitoring, recovery, incident response, clinical stop, and restart?"),
  question("roster-qualification", "07", "people-access", "Roster, role & qualification", "Which governed roster proves every reviewer’s role, qualification or licensure where required, supervisor, minimum access, and removal authority?"),
  question("training-accessibility", "08", "people-access", "Training & accessible use", "Which evidence proves all eight objectives and both critical drills were observed, accommodations were met, and interactive plus report delivery was accepted?"),
  question("measures-support", "09", "measure-support", "Measures, cadence & support", "Which frozen plan fixes six denominator-first measures, four review decisions, named clinical and technical support, hours, escalation, and evidence ownership?"),
  question("stop-restart-closeout", "10", "measure-support", "Stop, restart & closeout", "Who may stop use immediately, who may authorize restart, what evidence resolves an incident, and how are access, data, duties, and unresolved findings closed?"),
  question("agreement-commercial", "11", "terms-authority", "Agreement & commercial boundary", "Which executed agreement fixes the bounded service, responsibilities, term, price, support, privacy and security exhibits, termination, and no-automatic-renewal rule?"),
  question("named-authorization", "12", "terms-authority", "Named bounded authorization", "After every prerequisite is verified, which authenticated decision record names the site, scope, dates, conditions, dissent, revocation authority, and accountable authorizers?" )
]);

const AUTHORITY_ROLE_IDS = freeze(["executive-sponsor", "clinical-lead", "legal-owner", "security-privacy-owner", "independent-evaluator"]);
const CANDIDATE_IDS = new Set(["north-central-counseling-center", "cooper-psych-clinic-qi"]);
const DECISIONS = new Set(["not-recorded", "authorize", "authorize-with-conditions", "do-not-authorize"]);
const REFERENCE = /^FF-(?:AUTH|EVIDENCE|DECISION)-[A-Z0-9-]{3,80}$/;
const HEX_64 = /^[a-f0-9]{64}$/;

const clone = value => structuredClone(value);
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function digest(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${label} must be an object.`); return false; }
  const actual = Object.keys(value);
  const missing = keys.filter(key => !Object.hasOwn(value, key));
  const unknown = actual.filter(key => !keys.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`${label} contains fields outside the metadata contract: ${unknown.join(", ")}.`);
  return !missing.length && !unknown.length;
}

export function validateSiteAdmissionContract() {
  const errors = [];
  if (SITE_ADMISSION_BOOKS.length !== 6 || new Set(SITE_ADMISSION_BOOKS.map(item => item.id)).size !== 6) errors.push("Site admission must contain six unique books.");
  if (SITE_ADMISSION_QUESTIONS.length !== 12 || new Set(SITE_ADMISSION_QUESTIONS.map(item => item.id)).size !== 12) errors.push("Site admission must contain twelve unique questions.");
  const bookIds = new Set(SITE_ADMISSION_BOOKS.map(item => item.id));
  if (SITE_ADMISSION_QUESTIONS.some(item => !bookIds.has(item.bookId)) || SITE_ADMISSION_BOOKS.some(book => SITE_ADMISSION_QUESTIONS.filter(item => item.bookId === book.id).length !== 2)) errors.push("Every admission book must contain exactly two questions.");
  if (AUTHORITY_ROLE_IDS.length !== 5 || AUTHORITY_ROLE_IDS.some(id => !PILOT_AUTHORITY_REGISTER.some(role => role.id === id))) errors.push("The named-site authority register is invalid.");
  if (SITE_ADMISSION_BOUNDARY.length < 1050 || !/complete local metadata remains unverified/i.test(SITE_ADMISSION_BOUNDARY) || !/does not contact a site/i.test(SITE_ADMISSION_BOUNDARY)) errors.push("The site-admission claim boundary is incomplete.");
  return [...new Set(errors)];
}

function authorityRegister(readiness) {
  const roles = new Map((readiness?.current?.authorityRegister || PILOT_AUTHORITY_REGISTER).map(role => [role.id, role]));
  return AUTHORITY_ROLE_IDS.map(id => {
    const role = roles.get(id) || {};
    return { id, label: role.label || id, name: role.name || null, status: role.status || "unassigned", identityVerified: false, authorityVerified: false };
  });
}

function admissionCore(candidate, { readiness, decisionExchange, pilotOperations, providerActivation, evidenceContext }) {
  const externalGates = (pilotOperations?.admissionGates || []).map(gate => ({
    id: gate.id,
    index: gate.index,
    label: gate.label,
    status: decisionExchange?.packets?.find(packet => packet.id === gate.id)?.status || gate.state || "external-decision-required",
    requestFingerprint: gate.requestFingerprint || decisionExchange?.packets?.find(packet => packet.id === gate.id)?.requestFingerprint || null,
    accepted: false,
    authorityVerified: false
  }));
  return {
    contractVersion: SITE_ADMISSION_CONTRACT,
    returnContractVersion: SITE_ADMISSION_RETURN_CONTRACT,
    candidate: clone(candidate),
    sourceRegister: {
      direction: "Dolores correspondence · 2026-01-12 and 2026-03-30",
      sourceReportedCandidate: true,
      sourceClaimsVerifiedExternally: false,
      siteContacted: false,
      sourceRecordsIncluded: false,
      phiIncluded: false
    },
    books: clone(SITE_ADMISSION_BOOKS),
    questions: clone(SITE_ADMISSION_QUESTIONS),
    authorities: authorityRegister(readiness),
    externalGates,
    activationEvidence: {
      workbookFingerprint: providerActivation?.workbookFingerprint || null,
      requiredReturns: Number(providerActivation?.counts?.requiredReturns || 10),
      acceptedCompletions: Number(providerActivation?.counts?.acceptedCompletions || 0),
      activatedSites: Number(providerActivation?.counts?.activatedSites || 0),
      objectivesAccepted: false,
      completionAccepted: false
    },
    operatingEvidence: {
      planFingerprint: pilotOperations?.planFingerprint || null,
      localReadinessCurrent: Number(readiness?.current?.gateCounts?.localCurrent || 0),
      externalAccepted: Number(readiness?.current?.gateCounts?.externalAccepted || 0),
      sitesVerified: Number(pilotOperations?.counts?.sitesVerified || 0),
      pilotsAuthorized: Number(pilotOperations?.counts?.pilotsAuthorized || 0)
    },
    evidenceContext: clone(evidenceContext || {}),
    sourceContextOnly: true,
    siteIdentityVerified: false,
    authorityVerified: false,
    evidenceVerified: false,
    externalAcceptanceRecorded: false,
    authorizationRecorded: false,
    pilotAuthorized: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: SITE_ADMISSION_BOUNDARY
  };
}

export function siteAdmissionReturnTemplate(dossier) {
  return {
    contractVersion: SITE_ADMISSION_RETURN_CONTRACT,
    dossierFingerprint: dossier.dossierFingerprint,
    returnId: "FF-DECISION-REPLACE-ME",
    candidateId: dossier.candidate.id,
    decision: "not-recorded",
    decisionRecordReference: null,
    decidedAt: null,
    authorizationTerms: {
      siteReference: null,
      settingReference: null,
      scopeReference: null,
      startAt: null,
      endAt: null,
      conditionsReference: null,
      revocationReference: null
    },
    authorities: dossier.authorities.map(role => ({ roleId: role.id, identityReference: null, attestation: "not-declared" })),
    evidence: dossier.questions.map(item => ({ questionId: item.id, evidenceReference: null, status: "not-declared" })),
    trustBoundary: {
      evidenceFilesIncluded: false,
      namesOrSignaturesIncluded: false,
      patientRecordsIncluded: false,
      findingsContentIncluded: false,
      credentialsOrSecretsIncluded: false,
      phiIncluded: false,
      externalTransmissionPerformed: false,
      cryptographicSignatureVerified: false,
      siteIdentityVerified: false,
      identityVerified: false,
      authorityVerified: false,
      evidenceVerified: false,
      externalAcceptanceRecorded: false,
      authorizationRecorded: false,
      pilotAuthorized: false,
      pilotStarted: false,
      productionReleaseAuthorized: false,
      patientUseAuthorized: false
    }
  };
}

export function buildSiteAdmissionPortfolio({ readiness, decisionExchange, pilotOperations, providerActivation, evidenceContext = {}, events = [], chain = { valid: true, count: 0, head: null }, generatedAt = new Date().toISOString() } = {}) {
  const errors = validateSiteAdmissionContract();
  if (errors.length) throw new Error(errors.join(" "));
  const candidates = pilotOperations?.candidates || [];
  if (candidates.length !== 2) throw new Error("Site admission requires the two source-backed pilot candidates.");
  const latestByCandidate = new Map();
  for (const event of events) latestByCandidate.set(event.candidateId, event);
  const dossiers = candidates.map(candidate => {
    const core = admissionCore(candidate, { readiness, decisionExchange, pilotOperations, providerActivation, evidenceContext });
    const dossierFingerprint = digest(core);
    const latest = latestByCandidate.get(candidate.id) || null;
    const dossier = {
      ...core,
      dossierFingerprint,
      status: latest ? (latest.dossierFingerprint === dossierFingerprint ? latest.status : "preflight-stale") : "admission-return-not-received",
      latestPreflight: latest ? {
        sequence: latest.sequence,
        status: latest.status,
        decisionPreview: latest.decisionPreview,
        metadataChecklistComplete: latest.metadataChecklistComplete,
        current: latest.dossierFingerprint === dossierFingerprint,
        createdAt: latest.createdAt,
        hash: latest.hash
      } : null
    };
    return { ...dossier, returnTemplate: siteAdmissionReturnTemplate(dossier) };
  });
  const currentPreflights = dossiers.filter(item => item.latestPreflight?.current);
  const counts = {
    candidateDossiers: 2,
    admissionBooks: 6,
    admissionQuestions: 12,
    requiredAuthorities: 5,
    externalGates: 7,
    externalReturnsCurrent: Number(decisionExchange?.counts?.currentPreflights || 0),
    externalGatesAccepted: 0,
    activationReturnsRequired: Number(providerActivation?.counts?.requiredReturns || 10),
    activationCompletionsAccepted: 0,
    currentPreflights: currentPreflights.length,
    completeUnverified: currentPreflights.filter(item => item.latestPreflight.metadataChecklistComplete).length,
    sitesVerified: 0,
    pilotsAuthorized: 0
  };
  const portfolioFingerprint = digest({
    contractVersion: SITE_ADMISSION_CONTRACT,
    dossierFingerprints: dossiers.map(item => item.dossierFingerprint),
    evidenceContext: clone(evidenceContext),
    chainHead: chain.head || "GENESIS"
  });
  return {
    contractVersion: SITE_ADMISSION_CONTRACT,
    returnContractVersion: SITE_ADMISSION_RETURN_CONTRACT,
    status: currentPreflights.length ? "admission-returns-preflighted-unverified" : "candidate-dossiers-assembled-external-authorization-required",
    headline: "Name the boundary. Then earn the signature.",
    subhead: "Two source-backed candidates. Twelve exact admission questions. No site, date, or authority claim without governed proof.",
    dossiers,
    counts,
    history: clone(events),
    chain: clone(chain),
    portfolioFingerprint,
    generatedAt,
    siteContacted: false,
    siteIdentityVerified: false,
    evidenceFilesReceived: false,
    identityVerified: false,
    authorityVerified: false,
    evidenceVerified: false,
    externalAcceptanceRecorded: false,
    authorizationRecorded: false,
    pilotAuthorized: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    boundary: SITE_ADMISSION_BOUNDARY
  };
}

export function validateSiteAdmissionReturnManifest(manifest, dossier) {
  const errors = [];
  if (JSON.stringify(manifest ?? null).length > 96 * 1024) errors.push("Site-admission return exceeds the 96 KB metadata limit.");
  const rootKeys = ["contractVersion", "dossierFingerprint", "returnId", "candidateId", "decision", "decisionRecordReference", "decidedAt", "authorizationTerms", "authorities", "evidence", "trustBoundary"];
  const rootObject = Boolean(manifest && typeof manifest === "object" && !Array.isArray(manifest));
  exactKeys(manifest, rootKeys, "Manifest", errors);
  if (!rootObject) return errors;
  if (!dossier) errors.push("The named-site dossier is unavailable.");
  if (manifest.contractVersion !== SITE_ADMISSION_RETURN_CONTRACT) errors.push(`contractVersion must be ${SITE_ADMISSION_RETURN_CONTRACT}.`);
  if (manifest.dossierFingerprint !== dossier?.dossierFingerprint) errors.push("dossierFingerprint does not match the current named-site dossier.");
  if (manifest.candidateId !== dossier?.candidate?.id) errors.push("candidateId does not match the current named-site dossier.");
  if (!/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(manifest.returnId || ""))) errors.push("returnId must be a visibly synthetic FF-DECISION reference.");
  if (!DECISIONS.has(manifest.decision)) errors.push("decision must be not-recorded, authorize, authorize-with-conditions, or do-not-authorize.");
  const decisionDeclared = DECISIONS.has(manifest.decision) && manifest.decision !== "not-recorded";
  if (!decisionDeclared) {
    if (manifest.decisionRecordReference !== null || manifest.decidedAt !== null) errors.push("Decision reference and time must remain null while no decision is recorded.");
  } else {
    if (!/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(manifest.decisionRecordReference || ""))) errors.push("decisionRecordReference must be a visibly synthetic FF-DECISION reference.");
    if (!Number.isFinite(Date.parse(manifest.decidedAt))) errors.push("decidedAt must be an ISO timestamp when a decision is declared.");
  }
  const termKeys = ["siteReference", "settingReference", "scopeReference", "startAt", "endAt", "conditionsReference", "revocationReference"];
  if (exactKeys(manifest.authorizationTerms, termKeys, "authorizationTerms", errors)) {
    const terms = manifest.authorizationTerms;
    const authorizing = ["authorize", "authorize-with-conditions"].includes(manifest.decision);
    if (!authorizing) {
      for (const key of termKeys) if (terms[key] !== null) errors.push(`authorizationTerms.${key} must remain null unless an authorization decision is declared.`);
    } else {
      for (const key of ["siteReference", "settingReference", "scopeReference"]) if (!/^FF-EVIDENCE-[A-Z0-9-]{3,80}$/.test(String(terms[key] || ""))) errors.push(`authorizationTerms.${key} must be a visibly synthetic FF-EVIDENCE reference.`);
      if (!Number.isFinite(Date.parse(terms.startAt)) || !Number.isFinite(Date.parse(terms.endAt)) || Date.parse(terms.endAt) <= Date.parse(terms.startAt)) errors.push("authorizationTerms must contain a valid bounded startAt/endAt window.");
      if (!/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(terms.revocationReference || ""))) errors.push("authorizationTerms.revocationReference must be a visibly synthetic FF-DECISION reference.");
      if (manifest.decision === "authorize-with-conditions" && !/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(terms.conditionsReference || ""))) errors.push("authorizationTerms.conditionsReference is required for an authorization with conditions.");
      if (manifest.decision === "authorize" && terms.conditionsReference !== null && !/^FF-DECISION-[A-Z0-9-]{3,80}$/.test(String(terms.conditionsReference))) errors.push("authorizationTerms.conditionsReference must be null or a visibly synthetic FF-DECISION reference.");
    }
  }
  if (!Array.isArray(manifest.authorities) || manifest.authorities.length !== dossier?.authorities?.length) errors.push("authorities must contain the exact five-role register.");
  else manifest.authorities.forEach((item, index) => {
    const label = `authorities[${index}]`;
    if (!exactKeys(item, ["roleId", "identityReference", "attestation"], label, errors)) return;
    if (item.roleId !== dossier.authorities[index].id) errors.push(`${label}.roleId must be ${dossier.authorities[index].id}.`);
    if (!["not-declared", "declared-unverified"].includes(item.attestation)) errors.push(`${label}.attestation is invalid.`);
    if (item.attestation === "not-declared" && item.identityReference !== null) errors.push(`${label}.identityReference must be null while not declared.`);
    if (item.attestation === "declared-unverified" && !/^FF-AUTH-[A-Z0-9-]{3,80}$/.test(String(item.identityReference || ""))) errors.push(`${label}.identityReference must be a visibly synthetic FF-AUTH reference.`);
  });
  if (!Array.isArray(manifest.evidence) || manifest.evidence.length !== dossier?.questions?.length) errors.push("evidence must contain the exact twelve-question register.");
  else manifest.evidence.forEach((item, index) => {
    const label = `evidence[${index}]`;
    if (!exactKeys(item, ["questionId", "evidenceReference", "status"], label, errors)) return;
    if (item.questionId !== dossier.questions[index].id) errors.push(`${label}.questionId must be ${dossier.questions[index].id}.`);
    if (!["not-declared", "declared-unverified"].includes(item.status)) errors.push(`${label}.status is invalid.`);
    if (item.status === "not-declared" && item.evidenceReference !== null) errors.push(`${label}.evidenceReference must be null while not declared.`);
    if (item.status === "declared-unverified" && !/^FF-EVIDENCE-[A-Z0-9-]{3,80}$/.test(String(item.evidenceReference || ""))) errors.push(`${label}.evidenceReference must be a visibly synthetic FF-EVIDENCE reference.`);
  });
  const boundaryKeys = ["evidenceFilesIncluded", "namesOrSignaturesIncluded", "patientRecordsIncluded", "findingsContentIncluded", "credentialsOrSecretsIncluded", "phiIncluded", "externalTransmissionPerformed", "cryptographicSignatureVerified", "siteIdentityVerified", "identityVerified", "authorityVerified", "evidenceVerified", "externalAcceptanceRecorded", "authorizationRecorded", "pilotAuthorized", "pilotStarted", "productionReleaseAuthorized", "patientUseAuthorized"];
  if (exactKeys(manifest.trustBoundary, boundaryKeys, "trustBoundary", errors)) for (const key of boundaryKeys) if (manifest.trustBoundary[key] !== false) errors.push(`trustBoundary.${key} must remain false in the local preflight.`);
  return [...new Set(errors)];
}

function manifestCompleteness(manifest, dossier) {
  const authorityResults = dossier.authorities.map((role, index) => ({
    roleId: role.id,
    metadataDeclared: manifest.authorities[index].attestation === "declared-unverified",
    identityReferenceHash: manifest.authorities[index].identityReference ? digest(manifest.authorities[index].identityReference) : null,
    identityVerified: false,
    authorityVerified: false
  }));
  const evidenceResults = dossier.questions.map((item, index) => ({
    questionId: item.id,
    metadataDeclared: manifest.evidence[index].status === "declared-unverified",
    evidenceReferenceHash: manifest.evidence[index].evidenceReference ? digest(manifest.evidence[index].evidenceReference) : null,
    evidenceReceived: false,
    evidenceVerified: false
  }));
  const authorizing = ["authorize", "authorize-with-conditions"].includes(manifest.decision);
  const terms = manifest.authorizationTerms;
  const authorizationTermsComplete = !authorizing || Boolean(
    terms.siteReference && terms.settingReference && terms.scopeReference && terms.startAt && terms.endAt && terms.revocationReference
    && (manifest.decision !== "authorize-with-conditions" || terms.conditionsReference)
  );
  return { authorityResults, evidenceResults, authorizationTermsComplete };
}

export function createSiteAdmissionReturnPreflight({ manifest, dossier, actor, sequence, previousHash = "GENESIS", createdAt = new Date().toISOString(), id = randomUUID() } = {}) {
  const errors = validateSiteAdmissionReturnManifest(manifest, dossier);
  if (errors.length) throw new Error(errors.join(" "));
  const cleanActor = String(actor || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(cleanActor)) throw new Error("Actor must be 2–48 safe characters.");
  const { authorityResults, evidenceResults, authorizationTermsComplete } = manifestCompleteness(manifest, dossier);
  const counts = {
    authorityRequired: 5,
    authorityDeclared: authorityResults.filter(item => item.metadataDeclared).length,
    evidenceRequired: 12,
    evidenceDeclared: evidenceResults.filter(item => item.metadataDeclared).length
  };
  const decisionMetadataComplete = manifest.decision !== "not-recorded";
  const metadataChecklistComplete = decisionMetadataComplete && authorizationTermsComplete && counts.authorityDeclared === 5 && counts.evidenceDeclared === 12;
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: SITE_ADMISSION_CONTRACT,
    returnContractVersion: SITE_ADMISSION_RETURN_CONTRACT,
    type: "named-site-admission-return-metadata-preflight-recorded",
    status: metadataChecklistComplete ? "metadata-complete-unverified" : "metadata-incomplete",
    candidateId: dossier.candidate.id,
    dossierFingerprint: dossier.dossierFingerprint,
    manifestHash: digest(manifest),
    returnIdHash: digest(manifest.returnId),
    decisionPreview: manifest.decision,
    decisionRecordReferenceHash: manifest.decisionRecordReference ? digest(manifest.decisionRecordReference) : null,
    decisionTimeDeclared: manifest.decidedAt !== null,
    authorizationTermsHash: ["authorize", "authorize-with-conditions"].includes(manifest.decision) ? digest(manifest.authorizationTerms) : null,
    authorizationTermsComplete,
    authorityResults,
    evidenceResults,
    counts,
    decisionMetadataComplete,
    metadataChecklistComplete,
    disposition: "site-authorization-remains-external",
    evidenceFilesReceived: false,
    namesOrSignaturesReceived: false,
    patientRecordsReceived: false,
    findingsContentReceived: false,
    credentialsOrSecretsReceived: false,
    phiReceived: false,
    externalTransmissionPerformed: false,
    cryptographicSignatureVerified: false,
    siteIdentityVerified: false,
    identityVerified: false,
    authorityVerified: false,
    evidenceVerified: false,
    externalAcceptanceRecorded: false,
    authorizationRecorded: false,
    pilotAuthorized: false,
    pilotStarted: false,
    productionReleaseAuthorized: false,
    patientUseAuthorized: false,
    actor: cleanActor,
    createdAt,
    note: "Metadata-only named-site admission return preflight recorded. No site contact, evidence file, identity, signature, authority, accepted prerequisite, executed agreement, date window, provider activation, pilot authorization, pilot start, production release, or patient-use permission was created."
  };
  return { ...core, hash: digest(core) };
}

export function validateSiteAdmissionReturnPreflight(event, { sequence = event?.sequence, previousHash = event?.previousHash } = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["Site-admission preflight event is required."];
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence || event.sequence < 1 || event.previousHash !== previousHash || !/^(?:GENESIS|[a-f0-9]{64})$/.test(String(event.previousHash || ""))) errors.push("Site-admission chain position is invalid.");
  if (event.contractVersion !== SITE_ADMISSION_CONTRACT || event.returnContractVersion !== SITE_ADMISSION_RETURN_CONTRACT || event.type !== "named-site-admission-return-metadata-preflight-recorded") errors.push("Site-admission preflight contract is invalid.");
  if (!CANDIDATE_IDS.has(event.candidateId)) errors.push("Site-admission candidate is invalid.");
  if (!HEX_64.test(String(event.dossierFingerprint || "")) || !HEX_64.test(String(event.manifestHash || "")) || !HEX_64.test(String(event.returnIdHash || ""))) errors.push("Site-admission fingerprints are invalid.");
  if (!DECISIONS.has(event.decisionPreview)) errors.push("Site-admission decision preview is invalid.");
  if (event.decisionRecordReferenceHash !== null && !HEX_64.test(String(event.decisionRecordReferenceHash))) errors.push("Site-admission decision reference hash is invalid.");
  const authorizing = ["authorize", "authorize-with-conditions"].includes(event.decisionPreview);
  if (authorizing !== Boolean(event.authorizationTermsHash) || (event.authorizationTermsHash !== null && !HEX_64.test(String(event.authorizationTermsHash)))) errors.push("Site-admission authorization-terms hash is invalid.");
  if (typeof event.authorizationTermsComplete !== "boolean" || (authorizing && !event.authorizationTermsComplete) || (!authorizing && event.authorizationTermsComplete !== true)) errors.push("Site-admission authorization-terms state is invalid.");
  if (!Array.isArray(event.authorityResults) || event.authorityResults.length !== 5) errors.push("Site-admission authority results are incomplete.");
  else event.authorityResults.forEach((item, index) => {
    if (item.roleId !== AUTHORITY_ROLE_IDS[index] || typeof item.metadataDeclared !== "boolean" || item.identityVerified !== false || item.authorityVerified !== false || item.metadataDeclared !== Boolean(item.identityReferenceHash) || (item.identityReferenceHash !== null && !HEX_64.test(String(item.identityReferenceHash)))) errors.push(`Site-admission authority result ${index + 1} is invalid.`);
  });
  if (!Array.isArray(event.evidenceResults) || event.evidenceResults.length !== 12) errors.push("Site-admission evidence results are incomplete.");
  else event.evidenceResults.forEach((item, index) => {
    if (item.questionId !== SITE_ADMISSION_QUESTIONS[index].id || typeof item.metadataDeclared !== "boolean" || item.evidenceReceived !== false || item.evidenceVerified !== false || item.metadataDeclared !== Boolean(item.evidenceReferenceHash) || (item.evidenceReferenceHash !== null && !HEX_64.test(String(item.evidenceReferenceHash)))) errors.push(`Site-admission evidence result ${index + 1} is invalid.`);
  });
  const counts = { authorityRequired: 5, authorityDeclared: event.authorityResults?.filter(item => item.metadataDeclared).length || 0, evidenceRequired: 12, evidenceDeclared: event.evidenceResults?.filter(item => item.metadataDeclared).length || 0 };
  if (JSON.stringify(event.counts) !== JSON.stringify(counts)) errors.push("Site-admission preflight counts are invalid.");
  const decisionComplete = event.decisionPreview !== "not-recorded";
  const complete = decisionComplete && event.authorizationTermsComplete && counts.authorityDeclared === 5 && counts.evidenceDeclared === 12;
  if (event.decisionTimeDeclared !== decisionComplete || event.decisionMetadataComplete !== decisionComplete || event.metadataChecklistComplete !== complete || event.status !== (complete ? "metadata-complete-unverified" : "metadata-incomplete") || event.disposition !== "site-authorization-remains-external") errors.push("Site-admission preflight disposition is invalid.");
  const falseFields = ["evidenceFilesReceived", "namesOrSignaturesReceived", "patientRecordsReceived", "findingsContentReceived", "credentialsOrSecretsReceived", "phiReceived", "externalTransmissionPerformed", "cryptographicSignatureVerified", "siteIdentityVerified", "identityVerified", "authorityVerified", "evidenceVerified", "externalAcceptanceRecorded", "authorizationRecorded", "pilotAuthorized", "pilotStarted", "productionReleaseAuthorized", "patientUseAuthorized"];
  for (const field of falseFields) if (event[field] !== false) errors.push(`${field} must remain false.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/.test(String(event.actor || "")) || !Number.isFinite(Date.parse(event.createdAt))) errors.push("Site-admission actor or timestamp is invalid.");
  if (String(event.note || "").length < 230) errors.push("Site-admission non-authorization note is incomplete.");
  const { hash, ...core } = event;
  if (!HEX_64.test(String(hash || "")) || digest(core) !== hash) errors.push("Site-admission preflight hash is invalid.");
  return [...new Set(errors)];
}

const list = (items, render) => items.map(render).join("");

export function renderSiteAdmissionDossier(portfolio, candidateId) {
  if (portfolio?.contractVersion !== SITE_ADMISSION_CONTRACT || portfolio.authorizationRecorded !== false) throw new Error("A current non-authorizing site-admission portfolio is required.");
  const dossier = portfolio.dossiers.find(item => item.candidate.id === candidateId);
  if (!dossier) throw new Error("Named-site admission dossier was not found.");
  const candidate = dossier.candidate;
  const gates = list(dossier.externalGates, gate => `<li><span>${escapeHtml(gate.index)}</span><div><strong>${escapeHtml(gate.label)}</strong><small>${escapeHtml(gate.status.replaceAll("-", " "))}</small></div><i>OPEN</i></li>`);
  const returns = list(Array.from({ length: dossier.activationEvidence.requiredReturns }, (_, index) => index + 1), index => `<li><span>${String(index).padStart(2, "0")}</span><div><strong>${index === 1 ? "Accepted objectives" : index === 2 ? "Named facilitator" : index === 3 ? "Counselor roster" : index === 4 ? "License and role check" : index === 5 ? "Session record" : index === 6 ? "Attendance evidence" : index === 7 ? "Objective observations" : index === 8 ? "Critical drill evidence" : index === 9 ? "Accessibility check" : "Support and escalation"}</strong><small>Governed return required</small></div><i>OPEN</i></li>`);
  const books = list(dossier.books, book => {
    const questions = dossier.questions.filter(item => item.bookId === book.id);
    return `<article><header><span>${escapeHtml(book.index)}</span><div><h3>${escapeHtml(book.label)}</h3><p>${escapeHtml(book.thesis)}</p></div></header><ol>${questions.map(item => `<li><span>${escapeHtml(item.index)}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.prompt)}</p><code>${escapeHtml(item.id)}</code></div></li>`).join("")}</ol></article>`;
  });
  const authorityRows = list(dossier.authorities, role => `<tr><th scope="row">${escapeHtml(role.label)}</th><td>FF-AUTH-________________</td><td>□ declared · unverified</td></tr>`);
  const evidenceRows = list(dossier.questions, item => `<tr><th scope="row">${escapeHtml(item.index)} · ${escapeHtml(item.label)}</th><td>FF-EVIDENCE-________________</td></tr>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Metadata-only PERL named-site admission dossier"><title>${escapeHtml(candidate.label)} · PERL Site Admission</title><link rel="stylesheet" href="/site-admission.css"></head><body>
  <nav class="admission-toolbar" aria-label="Site-admission dossier actions"><a href="/">Return to PERL</a><span>Named-site admission dossier · no PHI</span><div><a href="/api/governance/site-admission/${encodeURIComponent(candidate.id)}/return.json">Export return</a><button id="print-site-admission" type="button">Print dossier</button></div></nav>
  <main aria-label="Named-site admission dossier">
    <section class="admission-sheet admission-cover" aria-label="Page 1 of 4"><header><span>Focused Future® · PERL</span><small>Page 01 / 04</small></header><div class="cover-hero"><div><p class="kicker">Candidate dossier · external authorization required</p><h1>Name the boundary. Then earn the signature.</h1><p class="standfirst">${escapeHtml(candidate.label)} · ${escapeHtml(candidate.setting)}. Source-backed context only; no verified site, date, signature, or pilot authority.</p></div><div class="admission-seal"><span>SITE</span><strong>00</strong><small>AUTHORIZED</small></div></div><div class="candidate-register"><article><span>Source proposition</span><strong>${escapeHtml(candidate.proposition)}</strong></article><article><span>Population context</span><strong>${escapeHtml(candidate.population)}</strong></article><article><span>Working window</span><strong>${escapeHtml(candidate.workingWindow)}</strong></article><article><span>Decision path</span><strong>${escapeHtml(candidate.decisionPath)}</strong></article></div><div class="cover-rule"><span>THE ADMISSION RULE</span><blockquote>A complete packet is inspectable. Only authenticated authority can make it operative.</blockquote></div><footer><code>${escapeHtml(dossier.dossierFingerprint.slice(0, 24))}…</code><p>${escapeHtml(candidate.status.replaceAll("-", " "))}</p></footer></section>
    <section class="admission-sheet admission-evidence" aria-label="Page 2 of 4"><header><span>PERL · Prerequisite register</span><small>Page 02 / 04</small></header><div class="sheet-title"><span>01 / PROVE</span><h2>Bring every prerequisite to the same table.</h2><p>Seven decision gates and ten activation returns stay externally owned. Local currency is not acceptance.</p></div><div class="evidence-columns"><section><h3>Seven external decision returns</h3><ol class="gate-ledger">${gates}</ol></section><section><h3>Ten provider-activation returns</h3><ol class="activation-ledger">${returns}</ol></section></div><div class="evidence-state"><div><span>Local readiness</span><strong>${escapeHtml(String(dossier.operatingEvidence.localReadinessCurrent))} / 7 current</strong></div><div><span>External gates</span><strong>0 / 7 accepted</strong></div><div><span>Training completion</span><strong>0 accepted</strong></div><div><span>Site authority</span><strong>Not recorded</strong></div></div><footer><p>Evidence references are requested; evidence files, identities, and signatures do not enter this sandbox.</p></footer></section>
    <section class="admission-sheet admission-questions" aria-label="Page 3 of 4"><header><span>PERL · Admission books</span><small>Page 03 / 04</small></header><div class="sheet-title"><span>02 / ASK</span><h2>Twelve questions before one bounded yes.</h2><p>Each book contains exactly two questions. An unanswered question remains open—it is never inferred from interest or preparation.</p></div><div class="book-grid">${books}</div><footer><p>Six books · twelve governed evidence references · five authenticated authority roles.</p></footer></section>
    <section class="admission-sheet admission-return" aria-label="Page 4 of 4"><header><span>PERL · Metadata return worksheet</span><small>Page 04 / 04</small></header><div class="return-title"><span>03 / RETURN</span><h2>Make the bounded decision inspectable.</h2><p>This worksheet supports governed discussion outside PERL. Only matching JSON metadata can be preflighted locally; it cannot verify this page or create authority.</p></div><div class="decision-strip"><span>Decision</span><b>□ Authorize</b><b>□ With conditions</b><b>□ Do not authorize</b><b>FF-DECISION-________________</b></div><div class="return-columns"><section><h3>Five authority references</h3><table><thead><tr><th>Required role</th><th>Identity reference</th><th>Local state</th></tr></thead><tbody>${authorityRows}</tbody></table><div class="term-box"><span>Bounded terms</span><p>Site · setting · scope · start · end · conditions · revocation</p><strong>Governed decision record only</strong></div></section><section><h3>Twelve evidence references</h3><table><thead><tr><th>Question</th><th>Governed reference</th></tr></thead><tbody>${evidenceRows}</tbody></table></section></div><div class="signature-warning"><strong>This is not a signature surface.</strong><p>${escapeHtml(dossier.boundary)}</p></div><footer><code>CHAIN ${escapeHtml(String(portfolio.chain?.count || 0))} · ${escapeHtml(portfolio.contractVersion)}</code><p>Site authorization remains external.</p></footer></section>
  </main><script src="/site-admission-print.js"></script></body></html>`;
}
