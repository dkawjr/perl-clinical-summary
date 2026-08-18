import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PILOT_CANDIDATE_PATHWAYS } from "../src/pilot-operations.js";
import {
  SITE_ADMISSION_BOOKS,
  SITE_ADMISSION_BOUNDARY,
  SITE_ADMISSION_CONTRACT,
  SITE_ADMISSION_QUESTIONS,
  SITE_ADMISSION_RETURN_CONTRACT,
  buildSiteAdmissionPortfolio,
  createSiteAdmissionReturnPreflight,
  renderSiteAdmissionDossier,
  validateSiteAdmissionContract,
  validateSiteAdmissionReturnManifest,
  validateSiteAdmissionReturnPreflight
} from "../src/site-admission.js";

const readiness = {
  current: {
    readinessStateHash: "a".repeat(64),
    gateCounts: { localCurrent: 7, externalAccepted: 0 },
    authorityRegister: [
      { id: "executive-sponsor", label: "Executive sponsor", name: "Dolores", status: "confirmed-source-owner" },
      { id: "clinical-lead", label: "Clinical lead", name: null, status: "unassigned" },
      { id: "legal-owner", label: "Legal owner", name: null, status: "unassigned" },
      { id: "security-privacy-owner", label: "Security & privacy owner", name: null, status: "unassigned" },
      { id: "independent-evaluator", label: "Independent evaluator", name: null, status: "unassigned" }
    ]
  }
};
const gateIds = ["intended-use-approval", "authoritative-eqpass", "clinical-beta", "independent-reliability", "security-production", "accessibility-acceptance", "pilot-authorization"];
const decisionExchange = {
  exchangeFingerprint: "b".repeat(64),
  counts: { currentPreflights: 0 },
  packets: gateIds.map((id, index) => ({ id, status: "return-not-received", requestFingerprint: String(index + 1).repeat(64).slice(0, 64) }))
};
const pilotOperations = {
  planFingerprint: "c".repeat(64),
  candidates: structuredClone(PILOT_CANDIDATE_PATHWAYS),
  admissionGates: gateIds.map((id, index) => ({ id, index: String(index + 1).padStart(2, "0"), label: id.replaceAll("-", " "), state: "return-not-received", requestFingerprint: decisionExchange.packets[index].requestFingerprint })),
  counts: { sitesVerified: 0, pilotsAuthorized: 0 }
};
const providerActivation = { workbookFingerprint: "d".repeat(64), counts: { requiredReturns: 10, acceptedCompletions: 0, activatedSites: 0 } };
const evidenceContext = {
  stateSchemaVersion: 33,
  readinessStateHash: "a".repeat(64),
  decisionExchangeFingerprint: "b".repeat(64),
  pilotPlanFingerprint: "c".repeat(64),
  providerActivationFingerprint: "d".repeat(64),
  reportContract: "perl-clinician-report/1.0",
  chainHeads: { readiness: "GENESIS", decisionExchange: "GENESIS", pilotOperations: "GENESIS", providerActivation: "GENESIS", intendedUse: "GENESIS", languageReview: "GENESIS", integrationReturn: "GENESIS", independentReview: "GENESIS" }
};

function portfolio(events = []) {
  return buildSiteAdmissionPortfolio({ readiness, decisionExchange, pilotOperations, providerActivation, evidenceContext, events, chain: { valid: true, count: events.length, head: events.at(-1)?.hash || null }, generatedAt: "2026-08-14T22:00:00.000Z" });
}

function completedDeclineManifest(dossier) {
  const manifest = structuredClone(dossier.returnTemplate);
  manifest.returnId = "FF-DECISION-SITE-RETURN-001";
  manifest.decision = "do-not-authorize";
  manifest.decisionRecordReference = "FF-DECISION-SITE-DECLINE-001";
  manifest.decidedAt = "2026-08-14T22:01:00.000Z";
  manifest.authorities = manifest.authorities.map((item, index) => ({ ...item, identityReference: `FF-AUTH-SITE-ROLE-${index + 1}`, attestation: "declared-unverified" }));
  manifest.evidence = manifest.evidence.map((item, index) => ({ ...item, evidenceReference: `FF-EVIDENCE-SITE-QUESTION-${String(index + 1).padStart(2, "0")}`, status: "declared-unverified" }));
  return manifest;
}

test("site admission fixes two candidate dossiers, six books, and twelve exact questions", () => {
  assert.deepEqual(validateSiteAdmissionContract(), []);
  assert.equal(SITE_ADMISSION_CONTRACT, "perl-named-site-admission-dossier/1.0");
  assert.equal(SITE_ADMISSION_RETURN_CONTRACT, "perl-named-site-admission-return/rfi-1.0");
  assert.equal(SITE_ADMISSION_BOOKS.length, 6);
  assert.equal(SITE_ADMISSION_QUESTIONS.length, 12);
  assert.ok(SITE_ADMISSION_BOOKS.every(book => SITE_ADMISSION_QUESTIONS.filter(item => item.bookId === book.id).length === 2));
  assert.match(SITE_ADMISSION_BOUNDARY, /complete local metadata remains unverified/i);
});

test("portfolio keeps source candidates separate from verified site authority", () => {
  const built = portfolio();
  assert.equal(built.dossiers.length, 2);
  assert.equal(built.counts.candidateDossiers, 2);
  assert.equal(built.counts.admissionQuestions, 12);
  assert.equal(built.counts.requiredAuthorities, 5);
  assert.equal(built.counts.externalGates, 7);
  assert.equal(built.counts.sitesVerified, 0);
  assert.equal(built.counts.pilotsAuthorized, 0);
  assert.equal(built.siteIdentityVerified, false);
  assert.equal(built.authorizationRecorded, false);
  assert.equal(built.pilotStarted, false);
  assert.ok(built.dossiers.every(item => item.candidate.siteVerified === false && item.siteIdentityVerified === false));
  assert.ok(built.dossiers.every(item => /^[a-f0-9]{64}$/.test(item.dossierFingerprint)));
});

test("strict return rejects content outside the metadata envelope and stale dossiers", () => {
  const built = portfolio();
  const dossier = built.dossiers[0];
  assert.deepEqual(validateSiteAdmissionReturnManifest(dossier.returnTemplate, dossier), []);
  const unknown = structuredClone(dossier.returnTemplate);
  unknown.signature = "not allowed";
  assert.match(validateSiteAdmissionReturnManifest(unknown, dossier).join(" "), /outside the metadata contract/i);
  const stale = structuredClone(dossier.returnTemplate);
  stale.dossierFingerprint = "0".repeat(64);
  assert.match(validateSiteAdmissionReturnManifest(stale, dossier).join(" "), /does not match/i);
  const claimed = structuredClone(dossier.returnTemplate);
  claimed.trustBoundary.authorityVerified = true;
  assert.match(validateSiteAdmissionReturnManifest(claimed, dossier).join(" "), /must remain false/i);
});

test("complete admission metadata remains an unverified, non-authorizing event", () => {
  const built = portfolio();
  const dossier = built.dossiers[0];
  const manifest = completedDeclineManifest(dossier);
  assert.deepEqual(validateSiteAdmissionReturnManifest(manifest, dossier), []);
  const event = createSiteAdmissionReturnPreflight({ manifest, dossier, actor: "SITE-QA", sequence: 1, previousHash: "GENESIS", createdAt: "2026-08-14T22:02:00.000Z", id: "33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(validateSiteAdmissionReturnPreflight(event), []);
  assert.equal(event.metadataChecklistComplete, true);
  assert.equal(event.status, "metadata-complete-unverified");
  assert.equal(event.disposition, "site-authorization-remains-external");
  assert.equal(event.siteIdentityVerified, false);
  assert.equal(event.authorityVerified, false);
  assert.equal(event.authorizationRecorded, false);
  assert.equal(event.pilotAuthorized, false);
  assert.equal(event.pilotStarted, false);
  const rebuilt = portfolio([event]);
  assert.equal(rebuilt.dossiers[0].latestPreflight.current, true);
  assert.equal(rebuilt.counts.completeUnverified, 1);
  const tampered = structuredClone(event);
  tampered.pilotAuthorized = true;
  assert.ok(validateSiteAdmissionReturnPreflight(tampered).some(error => /pilotAuthorized must remain false|hash is invalid/.test(error)));
});

test("authorizing metadata requires exact bounded terms but never creates authority", () => {
  const built = portfolio();
  const dossier = built.dossiers[1];
  const manifest = completedDeclineManifest(dossier);
  manifest.decision = "authorize-with-conditions";
  manifest.decisionRecordReference = "FF-DECISION-SITE-CONDITIONAL-001";
  manifest.authorizationTerms = {
    siteReference: "FF-EVIDENCE-SITE-IDENTITY-001",
    settingReference: "FF-EVIDENCE-SITE-SETTING-001",
    scopeReference: "FF-EVIDENCE-SITE-SCOPE-001",
    startAt: "2026-09-01T00:00:00.000Z",
    endAt: "2027-05-31T23:59:59.000Z",
    conditionsReference: "FF-DECISION-SITE-CONDITIONS-001",
    revocationReference: "FF-DECISION-SITE-REVOCATION-001"
  };
  assert.deepEqual(validateSiteAdmissionReturnManifest(manifest, dossier), []);
  manifest.authorizationTerms.endAt = "2026-08-01T00:00:00.000Z";
  assert.match(validateSiteAdmissionReturnManifest(manifest, dossier).join(" "), /valid bounded/i);
});

test("dossier renderer escapes content and emits exactly four Letter sheets", () => {
  const built = portfolio();
  const safe = structuredClone(built);
  safe.dossiers[0].candidate.label = '<img src=x onerror="boom">';
  const html = renderSiteAdmissionDossier(safe, safe.dossiers[0].candidate.id);
  assert.equal((html.match(/class="admission-sheet/g) || []).length, 4);
  assert.match(html, /Page 01 \/ 04/);
  assert.match(html, /Page 04 \/ 04/);
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /This is not a signature surface/);
  assert.match(html, /site-admission\.css/);
  assert.match(html, /site-admission-print\.js/);
});

test("site-admission styles lock Letter geometry, focus, touch, print, and narrow reflow", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../site-admission.css", import.meta.url), "utf8"),
    readFile(new URL("../site-admission-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /width:816px/);
  assert.match(css, /height:1056px/);
  assert.match(css, /@page\{size:Letter;margin:0\}/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:540px\)/);
  assert.match(css, /print-color-adjust:exact/);
  assert.match(script, /window\.print/);
});
