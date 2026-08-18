# PERL independent accuracy and reliability review dossier

## Purpose

Dolores’s January 2026 product direction requires a third-party accuracy and reliability review before release. The July 2026 proposal also requires counselor comparison, predeclared client-satisfaction criteria, and validation evidence. `perl-independent-review-dossier/1.0` turns that requirement into an executable handoff without pretending the sandbox can perform or approve its own independent review.

The dossier asks one bounded question:

> On an approved representative case set, does the frozen PERL candidate produce evidence-faithful, appropriately restrained, safe, useful, and reproducible counselor summaries with acceptable independent-reviewer agreement?

## Six review domains

1. **Source fidelity** — trace every statement to authoritative scored Findings evidence, including the question/category and threshold/response logic.
2. **Clinical restraint** — evaluate usefulness, evidence fidelity, uncertainty, diagnostic restraint, and material correction burden separately.
3. **Safety performance** — require zero critical-screen omissions, unsupported diagnostic certainty, invented or mismatched evidence, and unresolved high/critical incidents.
4. **Reliability** — inspect repeated-case allocation, preference agreement, rating differences, denominators, and the frozen analysis method.
5. **Workflow utility** — compare matched unaided and PERL-assisted work without converting incomplete timing evidence into a time-saved claim.
6. **Reproducibility** — bind the case manifest, runtime versions, model/prompt/policy/schema provenance, export hash, and evidence-chain heads.

## Ten gates, separated by authority

The dossier contains four reproducible local evidence patterns:

- synthetic package integrity;
- engineering safety regression;
- version and provenance inventory; and
- safety-stop evidence.

It also contains six externally owned decisions:

- authoritative source contracts;
- representative case set and unseen holdout;
- counselor-reference freeze;
- accepted clinical standard;
- named independent evaluator and frozen protocol; and
- legal and privacy permission.

The local product can show `local-evidence-current` or `local-evidence-required` for the first four. Five outside gates always remain `external-decision-required`. The counselor-reference gate can show `externally-verified-dependency` only when the separate Reference Decision Docket has a valid chain, an accepted reference set, a frozen protocol, an independent-review handoff, and exact matching docket, chain-head, and freeze-attestation fingerprints. The dossier never infers that state from drafts, counts, interface activity, or a local seal.

The resulting outside count is therefore either zero verified and six required, or one verified upstream dependency and five required. This does not accept the remaining source, case-set, clinical-standard, evaluator, legal, or privacy decisions.

## Controlled inputs and the Mike workbooks

The eight-input register keeps the two exact workbooks named in Dolores’s October 2025 correspondence visible:

- `meta_thresholds_responses_cs.xlsx`; and
- `question_categories_capitalized.xlsx`.

Neither file was present in the two Focused Future workspaces, anywhere under the searched user profile, or as an attachment in the forwarded Gmail messages. Their status is therefore `named-in-correspondence-not-connected`. PERL does not infer their category, threshold, or fixed-response logic from respondent exports or legacy report examples.

The remaining inputs are the authoritative scored-event contract, approved de-identified case inventory, counselor-reference freeze, accepted analysis plan, evaluator charter, and legal/privacy permission. The dossier never asks an operator to upload patient files through this surface.

## Local evidence seal

`POST /api/calibration/independent-review/seal` records a local evidence-package snapshot. Each event binds:

- the dossier and review-package fingerprints;
- the ten gate counts;
- seven current evidence counts;
- every current evidence-chain head;
- actor code and timestamp; and
- the verified counselor-reference docket, chain head, freeze-attestation fingerprint, and exact bounded duties when that upstream dependency is current; and
- false values for external approval, evaluator identity, independent-review completion, accuracy, reliability, clinical validity, pilot, release, and patient-use claims.

The events form a separate SHA-256-linked ledger. Startup fails closed if sequence, prior hash, counts, evidence heads, upstream reference bindings, non-authorizing fields, note, or event hash changes. Schema 22 introduced `independentReviewEvents`; package `2.36` preserves legacy seals and exports the current exact events and chain summary.

Once the exact current dossier is sealed and the counselor-reference freeze plus Clinical Standard draft are current, the separate [Independent Review Admission Docket](./INDEPENDENT_REVIEW_ADMISSION_DOCKET.md) can request seven purpose-bound outside signatures. Even its complete chain authorizes only execution of the exact evaluation protocol—not an evaluation result.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calibration/independent-review` | Live dossier, gates, inputs, evidence state, history, and chain |
| `POST` | `/api/calibration/independent-review/seal` | Seal only the current local synthetic evidence state |
| `GET` | `/api/calibration/independent-review.json` | Download the dossier for an outside working session |

## Claim boundary

This mechanism packages evidence and may consume one separately authenticated counselor-reference dependency. It does not identify or authenticate an evaluator, accept the missing workbooks, approve a clinical standard or case set, establish accuracy, reliability, or clinical validity, approve data use, authorize a named-site pilot, release PERL, or permit patient use. Production must replace reviewer codes and local timestamps with authenticated identities, governed access, trusted-time evidence, signed decisions, the admitted external protocol, and a separately governed evaluator-result contract.
