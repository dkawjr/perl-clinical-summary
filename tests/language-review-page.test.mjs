import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createIntendedUseDraft } from "../src/intended-use.js";
import { buildLanguageReviewOffice, createLanguageReviewPacket } from "../src/language-review.js";
import {
  LANGUAGE_REVIEW_PAGE_BOUNDARY,
  LANGUAGE_REVIEW_PAGE_CONTRACT,
  renderLanguageReviewPage,
  validateLanguageReviewPageInput
} from "../src/language-review-page.js";

const intendedUseDraft = createIntendedUseDraft({
  input: {
    pilotContext: "point-of-care-review",
    scopeStatement: "PERL supports qualified counselors and clinicians by translating authoritative scored e-QPASS output into a concise evidence-linked summary for accountable review at the start of a care conversation, beside the unchanged Findings report.",
    rationale: "This provider-first scope preserves source authority, direct safety review, and accountable clinical judgment."
  },
  actor: "PRINT-QA",
  version: 1,
  evidenceSnapshot: {
    reportContract: "perl-clinician-report/1.0",
    disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
    modelInputContract: "perl-scored-profile/1.0",
    generationPolicyVersion: "perl-clinical-generation-policy/1.0",
    generationPolicyHash: "a".repeat(64),
    audienceFormatCount: 4,
    chainHeads: { reportArtifacts: "GENESIS", generationSnapshots: "GENESIS", pilotReadiness: "GENESIS", clinicalStandard: "GENESIS" }
  },
  createdAt: "2026-08-14T12:00:00.000Z",
  id: "print-intended-use-1"
});

const evidenceSnapshot = {
  reportContract: "perl-clinician-report/1.0",
  disclaimerVersion: "ff-clinical-disclaimer/draft-2026-08",
  audienceContract: "perl-audience-handoff/1.0",
  intendedUseContract: "perl-intended-use-charter/1.0",
  intendedUseDraftHash: intendedUseDraft.hash,
  reportArtifactHead: "GENESIS"
};

function office() {
  const packet = createLanguageReviewPacket({
    intendedUseDraft,
    evidenceSnapshot,
    actor: "PRINT-QA",
    version: 1,
    createdAt: "2026-08-14T12:30:00.000Z",
    id: "print-language-packet-1"
  });
  return buildLanguageReviewOffice({
    intendedUseDraft,
    packets: [packet],
    chain: { valid: true, count: 1, failedAt: null, head: "b".repeat(64), packets: 1 },
    evidenceSnapshot,
    generatedAt: "2026-08-14T12:45:00.000Z"
  });
}

test("print review contract remains a non-authorizing annotation artifact", () => {
  assert.equal(LANGUAGE_REVIEW_PAGE_CONTRACT, "perl-language-review-print/1.0");
  assert.match(LANGUAGE_REVIEW_PAGE_BOUNDARY, /does not create clinical acceptance/i);
  assert.match(LANGUAGE_REVIEW_PAGE_BOUNDARY, /empty worksheet marks and signature lines are not product controls/i);
  assert.deepEqual(validateLanguageReviewPageInput(office()), []);
});

test("print review book renders all exact copy, questions, and outside acceptances", () => {
  const html = renderLanguageReviewPage(office());
  assert.match(html, /<h1 id="packet-title">The words<br>before they travel\.<\/h1>/);
  assert.equal((html.match(/class="copy-clause"/g) || []).length, 9);
  assert.equal((html.match(/class="review-question"/g) || []).length, 6);
  assert.equal((html.match(/class="acceptance-row"/g) || []).length, 5);
  assert.equal((html.match(/<section class="sheet/g) || []).length, 5);
  assert.match(html, /Book 01A \/ Live proof/);
  assert.match(html, /Book 01B \/ Live proof continued/);
  assert.match(html, /This structured decision-support summary is derived from self-report scores/);
  assert.match(html, /00 \/ 05/);
  assert.match(html, /Sealed working packet · unaccepted/);
  assert.match(html, /Change the source, then seal again/);
  assert.match(html, /Print \/ Save PDF/);
  assert.doesNotMatch(html, /<button[^>]*>\s*(?:Approve|Accept|Freeze)\b/i);
});

test("print review book escapes every source-controlled text surface", () => {
  const value = office();
  value.surfaces[0].currentText = '<script>alert("copy")</script>';
  value.surfaces[0].decisionQuestion = '<img src=x onerror="alert(1)">';
  value.currentCorpusFingerprint = "c".repeat(64);
  const html = renderLanguageReviewPage(value);
  assert.match(html, /&lt;script&gt;alert\(&quot;copy&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
});

test("print stylesheet declares Letter geometry, page breaks, mobile reflow, and exact color output", async () => {
  const [css, script] = await Promise.all([
    readFile(new URL("../language-review.css", import.meta.url), "utf8"),
    readFile(new URL("../language-review-print.js", import.meta.url), "utf8")
  ]);
  assert.match(css, /@page \{ size: Letter; margin: 0; \}/);
  assert.match(css, /\.sheet \{ width: 8\.5in; min-height: 11in;/);
  assert.match(css, /\.proof\.continuation \.copy-clause:first-child/);
  assert.match(css, /break-after: page/);
  assert.match(css, /print-color-adjust: exact/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /\.copy-ledger, \.question-ledger \{ grid-template-columns: 1fr; \}/);
  assert.match(script, /#print-language-review/);
  assert.match(script, /window\.print\(\)/);
});

test("print review rejects missing corpus or asserted authority", () => {
  const missing = office();
  missing.surfaces = missing.surfaces.slice(0, 8);
  assert.match(validateLanguageReviewPageInput(missing).join(" "), /nine copy surfaces/i);
  const approved = office();
  approved.legalApproved = true;
  assert.match(validateLanguageReviewPageInput(approved).join(" "), /cannot render asserted authority/i);
});

test("print review can expose an honestly incomplete corpus before intended use exists", () => {
  const value = office();
  value.intendedUse = null;
  value.latestPacket = null;
  value.status = "intended-use-required";
  value.surfaces[0].currentText = "No intended-use working draft has been recorded.";
  value.currentCorpusFingerprint = "d".repeat(64);
  assert.deepEqual(validateLanguageReviewPageInput(value), []);
  const html = renderLanguageReviewPage(value);
  assert.match(html, /Incomplete corpus · intended use required/);
  assert.match(html, /<dd>Not recorded<\/dd>/);
});
