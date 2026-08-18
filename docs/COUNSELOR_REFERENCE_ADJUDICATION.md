# Counselor Reference Adjudication Antechamber

Contract: `perl-counselor-reference-adjudication-dossier/1.0`  
Current package: `perl-synthetic-calibration-package/2.36` (antechamber introduced in `2.34`)  
State schema: `sandbox-state/42`

## Why this exists

The July 2026 proposal and the Counselor Lab protocol require more than reference drafting. They require visible disagreement, a named adjudicator, an accepted counselor-reference standard, and a signed protocol freeze. Package 2.33 created the uncontaminated source-only authoring step. Package 2.34 adds the missing local handoff between authoring and accountable outside adjudication.

The antechamber does not decide which counselor is right. It assembles immutable candidates, protects authors from premature attribution, makes structural overlap inspectable, preserves dissent, and creates a content-bound evidence packet for a future governed adjudicator.

## Anti-contamination rule

Candidate content is visible only when all of the following are true:

1. the case belongs to the frozen development partition;
2. at least two immutable drafts exist for the same case;
3. the drafts use at least two distinct reviewer codes;
4. every draft still matches the current scored source-profile hash; and
5. the current reviewer code already authored a source-only draft for that case.

Before those conditions are met, candidate summaries, themes, questions, tone markers, and evidence-overlap counts are withheld. Once visible, candidates are labeled `Draft A`, `Draft B`, and so on. Candidate author codes never enter the comparison view or dossier fingerprint.

This controls local content exposure; it does not verify identity, credentials, employment, panel membership, or independent authorship.

## What the local comparison computes

For each frozen development case, the dossier records:

- source-profile lineage and immutable candidate hashes;
- draft and distinct-reviewer-code counts;
- whether the current reviewer is eligible to view the candidates;
- exact evidence citations carried by each visible candidate;
- shared and candidate-only evidence-citation counts;
- tone-marker coverage and theme-confidence distribution;
- alignment with the deterministic direct-review route; and
- an explicit statement that disagreement remains preserved.

The structural synthesis always fixes `semanticAgreementAssessed: false` and `majorityDecisionCreated: false`. Citation overlap is not clinical agreement. A two-to-one or larger majority would still not constitute acceptance.

## Eight-gate decision rail

| Gate | Local state available | Outside return still required |
|---|---|---|
| Frozen development manifest | Exact case-set ID/version | No |
| Current source lineage | Source-profile and draft-chain hashes | No |
| Candidate overlap | Two distinct-code drafts per case | Local evidence only; independence remains unverified |
| Qualified independent authorship | None | Credentialed, conflict-aware verification |
| Named adjudicator + decision rights | None | Named accountable adjudicator and scope |
| Accepted language + safety standard | None | Signed clinical/language acceptance |
| Signed reference decision + dissent | None | Case-level decision, rationale, and retained dissent |
| Protocol freeze + independent handoff | None | Signed freeze and evaluator handoff |

The first three gates can report local structure or local evidence. The final five always remain `external-decision-required` in this product.

## Immutable evidence event

`counselorReferenceAdjudicationEvents` is the thirty-seventh integrity family. Each `counselor-reference-adjudication-dossier-sealed` event pins:

- the dossier fingerprint;
- frozen case-set identity;
- source-only reference-draft chain count and head;
- per-case source and draft hashes;
- exact local counts;
- all eight ordered gate states;
- actor code and timestamp; and
- the previous adjudication-event hash.

Sealing is idempotent while the dossier fingerprint is unchanged. A new source-only draft changes the fingerprint and permits a new evidence snapshot. The event stores no accepted reference and no generated clinical prose.

## Explicitly absent authority

The dossier, event schema, API, export, and interface hard-code all of the following false:

- counselor identity verified;
- authorship independence established;
- adjudicator assigned or adjudication completed;
- reference accepted or protocol frozen;
- accuracy, reliability, or clinical validity established;
- trial execution or pilot authorized;
- production release authorized; and
- patient use authorized.

There is no accept, approve, rank, promote, freeze, or majority-vote control in the antechamber.

## API and interface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calibration/reference-adjudication` | Actor-aware local dossier; candidate content may be withheld |
| `POST` | `/api/calibration/reference-adjudication/seal` | Idempotently seal the current non-authorizing evidence state |
| `GET` | `/api/calibration/reference-adjudication.json` | Download the actor-aware evidence dossier |

The Counselor Fieldwork surface presents the antechamber as an editorial casebook: paired anonymous folios, a visible `A ≠ B / NO VOTE` sigil, exact gate rail, sealed-history ledger, and the complete authority boundary. Desktop and phone layouts retain native links and buttons, visible focus, polite live regions, and reduced-motion behavior.

## What closes this seam

Product work in the antechamber ends at reproducible local evidence. Package 2.35 adds the separate [Counselor Reference Decision Docket](./COUNSELOR_REFERENCE_DECISION_DOCKET.md): a default-closed, four-key Ed25519 return path for verified independent authorship, accepted safety/language, signed case decisions with preserved dissent, and protocol freeze with the independent-evaluator handoff. Those decisions are never inferred from local draft counts or interface activity. Signer identity, qualifications, delegation, key custody, approved transport, and the independent evaluation itself remain accountable outside work.
