export const LANGUAGE_REVIEW_PAGE_CONTRACT = "perl-language-review-print/1.0";

export const LANGUAGE_REVIEW_PAGE_BOUNDARY = "This printable working packet preserves the exact local copy corpus for annotation and accountable outside review. Empty worksheet marks and signature lines are not product controls. Printing, saving, annotating, or circulating this file does not create clinical acceptance, legal advice or approval, privacy or security approval, e-QPASS owner acceptance, disclaimer approval, language freeze, clinical validation, pilot authorization, production release, or permission for patient use.";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not sealed";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
}

function label(value) {
  return String(value || "").replaceAll("-", " ");
}

export function validateLanguageReviewPageInput(office) {
  const errors = [];
  if (!office || typeof office !== "object" || Array.isArray(office)) return ["Language review office is required."];
  if (office.contractVersion !== "perl-language-review-packet/1.0") errors.push("Language review page requires the packet contract.");
  if (!Array.isArray(office.surfaces) || office.surfaces.length !== 9) errors.push("Language review page requires nine copy surfaces.");
  if (!Array.isArray(office.reviewQuestions) || office.reviewQuestions.length !== 6) errors.push("Language review page requires six review questions.");
  if (!Array.isArray(office.requiredAcceptances) || office.requiredAcceptances.length !== 5) errors.push("Language review page requires five outside acceptances.");
  if (office.counts?.acceptancesRecorded !== 0 || office.legalApproved !== false || office.languageFrozen !== false || office.patientUseAuthorized !== false) errors.push("Language review page cannot render asserted authority.");
  if (!/^[a-f0-9]{64}$/.test(String(office.currentCorpusFingerprint || ""))) errors.push("Language review page requires a corpus fingerprint.");
  if (office.intendedUse && (!office.intendedUse.hash || !office.intendedUse.version)) errors.push("Language review page contains an invalid intended-use reference.");
  if (office.surfaces?.some((item, index) => item.index !== String(index + 1).padStart(2, "0") || !item.currentText || !item.decisionQuestion)) errors.push("Language review page copy ordering is invalid.");
  return [...new Set(errors)];
}

export function renderLanguageReviewPage(office) {
  const errors = validateLanguageReviewPageInput(office);
  if (errors.length) throw new Error(errors.join(" "));
  const packet = office.latestPacket || null;
  const packetVersion = packet ? `v${String(packet.version).padStart(2, "0")}` : "v—";
  const packetState = packet ? "Sealed working packet · unaccepted" : office.intendedUse ? "Working corpus · seal required" : "Incomplete corpus · intended use required";
  const clauses = office.surfaces.map(item => `<article class="copy-clause">
    <header><span>${escapeHtml(item.index)}</span><div><small>${escapeHtml(item.placement)} · ${escapeHtml(item.audience)}</small><h3>${escapeHtml(item.label)}</h3></div><b>Exact live copy</b></header>
    <blockquote>${escapeHtml(item.currentText)}</blockquote>
    <footer><div><span>Source</span><strong>${escapeHtml(item.sourceVersion)}</strong></div><div><span>Decision question</span><strong>${escapeHtml(item.decisionQuestion)}</strong></div></footer>
  </article>`);
  const proofSheets = [
    {
      className: "proof",
      eyebrow: "Book 01A / Live proof",
      title: "Nine clauses. No paraphrase.",
      description: "The wording below is rendered from the current product contracts. Review the line people will actually read—not a summary of it.",
      id: "proof-title",
      clauses: clauses.slice(0, 5)
    },
    {
      className: "proof continuation",
      eyebrow: "Book 01B / Live proof continued",
      title: "The exact corpus, continued.",
      description: "The remaining four clauses continue the same sealed corpus and fingerprint. No wording is condensed between pages.",
      id: "proof-continuation-title",
      clauses: clauses.slice(5)
    }
  ].map(item => `<section class="sheet ${item.className}" aria-labelledby="${item.id}">
      <header class="section-head"><div><span>${item.eyebrow}</span><h2 id="${item.id}">${item.title}</h2><p>${item.description}</p></div><strong>Exact corpus<br>${escapeHtml(office.currentCorpusFingerprint.slice(0, 16))}…</strong></header>
      <div class="copy-ledger">${item.clauses.join("")}</div>
      <footer class="page-foot"><span>PERL language review · ${escapeHtml(packetVersion)}</span><span>Working packet · external review required</span></footer>
    </section>`).join("\n\n    ");
  const questions = office.reviewQuestions.map(item => `<article class="review-question">
    <header><span>${escapeHtml(item.index)}</span><div><small>${escapeHtml(item.ownerRoles.map(label).join(" · "))}</small><h3>${escapeHtml(item.label)}</h3></div></header>
    <p>${escapeHtml(item.prompt)}</p>
    <div class="paper-disposition" aria-label="Paper or PDF annotation choices"><span><i aria-hidden="true"></i> Clear</span><span><i aria-hidden="true"></i> Revise</span><span><i aria-hidden="true"></i> Escalate</span></div>
    <div class="note-lines" aria-hidden="true"><i></i><i></i><i></i></div>
  </article>`).join("");
  const acceptances = office.requiredAcceptances.map(item => `<article class="acceptance-row">
    <span>${escapeHtml(item.index)}</span><div><small>Outside authority</small><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(label(item.state))}</p></div>
    <dl><div><dt>Name / role</dt><dd></dd></div><div><dt>Decision</dt><dd></dd></div><div><dt>Date + reference</dt><dd></dd></div></dl>
  </article>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Exact-copy PERL clinical and counsel language review packet. Working evidence only; no approval or clinical authority.">
  <title>PERL · Clinical + counsel language review · ${escapeHtml(packetVersion)}</title>
  <link rel="stylesheet" href="/language-review.css">
  <script src="/language-review-print.js" defer></script>
</head>
<body>
  <nav class="review-toolbar" aria-label="Language review packet actions"><a href="/#language-review-office">Return to Governance</a><span>Working evidence · no PHI</span><button id="print-language-review" type="button">Print / Save PDF</button></nav>
  <main>
    <section class="sheet cover" aria-labelledby="packet-title">
      <header class="cover-head"><div class="brand"><span>PERL</span><small>Clinical intelligence</small></div><div class="document-code"><span>${escapeHtml(LANGUAGE_REVIEW_PAGE_CONTRACT)}</span><strong>${escapeHtml(packetState)}</strong></div></header>
      <div class="cover-body">
        <div class="folio" aria-hidden="true"><span>LR</span><i></i></div>
        <p class="eyebrow">Clinical + counsel review book · exact working copy</p>
        <h1 id="packet-title">The words<br>before they travel.</h1>
        <p class="deck">A decision-ready proof of the exact language currently exposed by PERL—organized for accountable clinical, counsel, privacy, product, and e-QPASS review.</p>
        <div class="status-band"><span>Packet</span><strong>${escapeHtml(packetVersion)}</strong><span>Live clauses</span><strong>09</strong><span>Review questions</span><strong>06</strong><span>Acceptance</span><strong>00 / 05</strong></div>
      </div>
      <div class="cover-meta">
        <dl>
          <div><dt>Prepared state</dt><dd>${escapeHtml(packetState)}</dd></div>
          <div><dt>Recorded</dt><dd>${escapeHtml(displayDate(packet?.createdAt))}</dd></div>
          <div><dt>Local author code</dt><dd>${escapeHtml(packet?.actor || "Not sealed")}</dd></div>
          <div><dt>Intended-use draft</dt><dd>${office.intendedUse ? `v${escapeHtml(String(office.intendedUse.version).padStart(2, "0"))} · ${escapeHtml(label(office.intendedUse.pilotContext))}` : "Not recorded"}</dd></div>
          <div><dt>Corpus fingerprint</dt><dd><code>${escapeHtml(office.currentCorpusFingerprint)}</code></dd></div>
          <div><dt>Packet fingerprint</dt><dd><code>${escapeHtml(packet?.hash || "Not sealed")}</code></dd></div>
        </dl>
        <aside><span>Authority check</span><strong>Unaccepted by design.</strong><p>No outside signature or professional credential is captured by the local packet. Reviewers decide outside PERL.</p></aside>
      </div>
      <footer class="cover-foot"><p>${escapeHtml(LANGUAGE_REVIEW_PAGE_BOUNDARY)}</p><span>Focused Future · synthetic sandbox</span></footer>
    </section>

    ${proofSheets}

    <section class="sheet worksheet" aria-labelledby="worksheet-title">
      <header class="section-head dark"><div><span>Book 02 / Red pencil</span><h2 id="worksheet-title">Six questions for accountable review.</h2><p>This worksheet may be annotated on paper or in a saved PDF. Marks are reviewer notes—not acceptance recorded by the product.</p></div><strong>Clinical + counsel<br>decision brief</strong></header>
      <div class="question-ledger">${questions}</div>
      <footer class="page-foot"><span>PERL language review · ${escapeHtml(packetVersion)}</span><span>Annotation does not create approval</span></footer>
    </section>

    <section class="sheet authority" aria-labelledby="authority-title">
      <header class="section-head oxblood"><div><span>Book 03 / Outside authority</span><h2 id="authority-title">Five decisions remain outside the glass.</h2><p>Use these lines to reference an authenticated decision made in the accountable owner’s system. Do not treat the blank worksheet as a signature mechanism.</p></div><strong>Acceptance<br>00 / 05</strong></header>
      <div class="acceptance-ledger">${acceptances}</div>
      <section class="resolution-note" aria-labelledby="resolution-title"><span>Return instruction</span><h2 id="resolution-title">Change the source, then seal again.</h2><p>If any reviewer requires revision, update the governing intended-use, clinician-report, or audience-handoff source. The next packet must generate a new corpus fingerprint and immutable version. Never overwrite this proof.</p></section>
      <section class="final-boundary"><span>Claim boundary</span><p>${escapeHtml(LANGUAGE_REVIEW_PAGE_BOUNDARY)}</p></section>
      <footer class="page-foot"><span>${escapeHtml(LANGUAGE_REVIEW_PAGE_CONTRACT)}</span><span>${escapeHtml(office.contractVersion)} · chain ${escapeHtml(office.chain?.count || 0)}</span></footer>
    </section>
  </main>
</body>
</html>`;
}
