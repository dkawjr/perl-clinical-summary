# Same-Case Retest & Re-Review Studio

Package `perl-synthetic-calibration-package/2.41` adds contracts `perl-candidate-retest-return/1.0` and `perl-candidate-retest-rereview/1.0`, schema 47, and the forty-fourth and forty-fifth integrity families. It carries a governed Candidate Refinement cycle through exact structured return and fresh blinded re-review on the same three synthetic scored cases.

This is the next bounded step in the sequence Dolores described on January 12, 2026: use live review, make one controlled modification, test again on the same manual datasets, and preserve the evidence needed for a separately governed independent accuracy and reliability review before release. It also implements the proposal’s instruction to incorporate counselor feedback and comparative results iteratively until Dolores confirms that the Clinical Standard is met. Local completion is therefore evidence for the next decision—not confirmation, selection, validation, or release.

## What this package does

For one immutable refinement cycle, PERL can:

1. prepare three exact baseline-bound return envelopes;
2. accept one through three structured synthetic retest outputs;
3. verify the case, lane, baseline, protocol, candidate fingerprint, provider, model version, new prompt version, one declared intervention, generation contract, policy, and ten output gates;
4. store each exact output in a separate immutable return ledger without rendering its prose on the public desk;
5. issue one 24-hour packet containing the same scored source and two summaries labeled only `X` and `Y`;
6. collect four direct ratings per cell, correction burden, structured correction flags, dissent flags, use disposition, and one bounded paired-difference disposition;
7. preserve the concealed baseline/retest map inside the immutable outcome event without revealing it before or after submission; and
8. derive local paired-evidence completion only after two distinct reviewer codes cover all three cases.

PERL never asks a blinded reviewer to identify the retest. The reviewer may record only `x-stronger`, `y-stronger`, `materially-equivalent`, or `uncertain`; the sealed mapping is interpreted only inside the later independent-disposition evidence package. The studio publishes no winner, comparative score, rank, selected engine, or cycle-close decision.

## Return contract

The operator downloads a return kit from the selected cycle. The template contains three exact envelopes and no source content, baseline prose, candidate identity label, reviewer identity, endpoint, credential, or PHI.

Each completed return must retain:

- cycle, anonymous lane, envelope, case, case fingerprint, and baseline artifact hash;
- retest-protocol fingerprint;
- the baseline candidate fingerprint, provider ID, and model version;
- a prompt version different from the baseline prompt version;
- one bounded external execution reference;
- the exact declared intervention, target measure, and iteration goal;
- `perl-generation-bundle/1.0`, current generation-policy version and hash;
- all three explicit declarations: manual external execution, same provider/model, and intervention applied;
- synthetic-only and unverified authority status; and
- one complete generation bundle that passes all ten local gates against the bound synthetic case.

The root manifest and every return item use exact-key validation. Unknown fields fail closed. The total manifest is limited to 256 KB. Privacy flags must all remain `false`, including raw responses, Findings content, file bytes, identifiers, credentials, endpoints, and PHI.

The declaration records what an operator says occurred; it does not verify an external model change or provider execution. The immutable receipt explicitly retains that distinction.

## Return ledger

`manual-synthetic-candidate-retest-return-recorded` binds:

- sequence, previous hash, event hash, and actor-code hash;
- cycle and envelope identities;
- exact baseline and retest-protocol fingerprints;
- candidate, provider, model, prompt, and policy provenance;
- a hash of the bounded external execution reference;
- the complete structured output and its bundle hash;
- ten passed output gates;
- the declared one-change/manual-execution posture; and
- a complete false-claim book.

The public receipt exposes only status, case/envelope identifiers, bundle hash, gate count, time, and ledger hash. It never exposes returned prose or a comparative outcome. A byte-equivalent retry with the same prompt and execution reference is idempotent; a changed retry conflicts with the immutable receipt.

## Fresh X/Y re-review

The review packet includes the exact scored synthetic source projection and two summary cells. It excludes:

- the baseline/retest mapping;
- anonymous lane and candidate identity;
- provider, model, and prompt identity;
- prior ratings and correction outcomes;
- counselor or reviewer identity;
- raw responses, Findings content, files, identifiers, credentials, and PHI.

The seven predeclared measures are:

| Measure | Mode |
|---|---|
| Evidence fidelity | direct rating for X and Y, 1–5 |
| Critical safety handling | direct rating for X and Y, 1–5 |
| Clinical restraint | direct rating for X and Y, 1–5 |
| Conversation usefulness | direct rating for X and Y, 1–5 |
| Correction burden | direct ordinal judgment for X and Y |
| Paired difference | one direct bounded disposition |
| Independent overlap | derived across immutable packets |

The paired-difference taxonomy is fixed to `x-stronger`, `y-stronger`, `materially-equivalent`, or `uncertain`. These values are review evidence, not effect estimates or decisions. Legacy schema-47 events that used arm-relative values remain verifiable, but new intake accepts only the truly blinded X/Y taxonomy.

Correction burden and correction flags must agree: `none` requires zero flags, while any non-`none` burden requires at least one fixed correction flag. Dissent and use disposition remain attached to each blind cell. The event stores the hidden mapping and its hash for governed later analysis, but both the browser receipt and evidence desk continue to conceal it.

## Readiness and completion

Six gates control the studio:

1. the selected refinement cycle exists in an intact hash-linked ledger;
2. the retest-return ledger is intact;
3. all three exact current returns are present;
4. the paired-review ledger is intact;
5. all three cases have at least two distinct reviewer codes; and
6. local study control is active with no stopping event.

Return intake additionally requires current cycle-ledger integrity. Packet issuance requires the first four operational prerequisites and active study control; the overlap gate is completed through review. A reviewer code may review each case only once. Case assignment favors the least-covered eligible case and alternates which hidden arm appears first. Once two distinct reviewer codes cover all three cases, the studio stops issuing packets and reports only:

`local-paired-evidence-complete-awaiting-independent-disposition`

That state does not close the refinement cycle or establish improvement, accuracy, reliability, safety, usefulness, clinical validity, or satisfaction with the Clinical Standard.

## API

- `GET /api/calibration/candidate-retest?cycleId=:cycleId` — current aggregate studio state for the reviewer code and selected cycle.
- `GET /api/calibration/candidate-retest.json` — downloadable content-free desk evidence.
- `GET /api/calibration/candidate-retest/cycles/:cycleId/return-kit.json` — exact operator return template.
- `POST /api/calibration/candidate-retest/returns` — strict same-case return intake.
- `POST /api/calibration/candidate-retest/reviews/assignments` — issue or resume one concealed X/Y packet.
- `POST /api/calibration/candidate-retest/reviews/outcomes` — validate and seal one complete paired reading.

No endpoint changes a model, calls a provider, creates a comparative result, reveals the mapping, closes a cycle, selects an engine, or records independent disposition.

## Visual and accessibility contract

The studio is an editorial evidence folio rather than an AI control panel. Deep forest and near-black framing, ivory working paper, aged brass, copper stop marks, hairline rules, and the `X ↔ Y` motif make the same-source comparison legible without generic gradients, glowing model imagery, or leaderboard patterns.

The surface uses:

- a named H2-led region and ordered H3 subsections;
- native labeled file, select, checkbox, form, button, and download controls;
- polite live announcements for return and review state;
- visible focus treatment and 44/48-pixel interactive targets;
- a fully concealed review form until an active packet exists;
- reduced-motion handling; and
- explicit 1080-, 760-, and 430-pixel reflow rules.

The public register and history remain content-free. Summary prose appears only in the active X/Y packet.

## Schema and recovery

Schema 46 migrates to schema 47 by adding empty `candidateRetestReturnEvents`, `candidateRetestReviewEvents`, and `pendingCandidateRetestReviews` structures. Migration never invents a return, review, outcome, or pending assignment. Startup validates both new chains against the immutable refinement cycles, baseline artifacts, retest artifacts, case set, and linked hashes.

Package 2.41 recovery reconciled forty-five integrity families and exported both retest ledgers under format `2.41`. Package 2.42 preserves those ledgers unchanged, adds the separate forty-sixth independent-disposition chain, migrates schema 47 to 48 with an empty result ledger, and exports all three retest families under format `2.42`. Package 2.43 adds the forty-seventh exact candidate advancement chain, schema 49, and export format `2.43`. See [CANDIDATE_RETEST_DISPOSITION_CHAMBER.md](./CANDIDATE_RETEST_DISPOSITION_CHAMBER.md) and [CANDIDATE_ADVANCEMENT_AIRLOCK.md](./CANDIDATE_ADVANCEMENT_AIRLOCK.md).

## Evidence ceiling and next governed step

Even after six valid paired readings, all of the following remain false:

- external execution verified;
- reviewer identity or counselor qualification verified;
- improvement, accuracy, reliability, safety, or usefulness established;
- Clinical Standard met or clinical validation complete;
- engine ranked or selected;
- refinement cycle closed;
- care plan changed;
- pilot, production release, traffic, or patient use authorized.

Package 2.42 supplies the separately signed [Candidate Retest Independent Disposition Chamber](./CANDIDATE_RETEST_DISPOSITION_CHAMBER.md) against the frozen source, Clinical Standard, admitted analysis protocol, return set, and complete X/Y outcome ledger. Package 2.43 supplies that later boundary as the separately governed [Exact Candidate Advancement Airlock](./CANDIDATE_ADVANCEMENT_AIRLOCK.md): two duties freeze the exact cycle action, then four different duties may freeze the exact candidate advance/retain/hold decision. The next real-world work is still to provision external keys, execute the admitted evaluation, and operate both rooms; integration, release, traffic, and patient use remain separate.
