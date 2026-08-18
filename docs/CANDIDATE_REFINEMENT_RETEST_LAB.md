# Candidate Refinement & Retest Lab

Package `perl-synthetic-calibration-package/2.40` adds contract `perl-candidate-refinement-retest/1.0`, schema 46, and the forty-third integrity family. It implements the next explicit step in Dolores’s January 12, 2026 sequence: use live-reviewer correction evidence to declare a bounded modification method, then retest the same synthetic cases before independent accuracy and reliability review.

This package scopes a retest. It does not change a model, execute a provider call, receive a retest output, prove improvement, rank a candidate, or select an engine.

## Why this is separate from the review gallery

Candidate Blind Review records evidence without publishing candidate identity or a winner. Refinement needs the concealed A–D mapping to determine whether the same structured correction recurs for the same candidate arm. The mapping is therefore decoded only inside the store. The public desk exposes three fixed anonymous lanes—`Lane I`, `Lane II`, and `Lane III`—in declaration order.

The desk never publishes:

- a candidate, provider, model, or prompt identity;
- a reviewer or counselor identity;
- ratings, averages, candidate scores, ordering, or a winner;
- summary prose or the concealed author map; or
- an inference that correction counts establish accuracy, reliability, safety, usefulness, or clinical validity.

## What opens the cycle desk

All six gates must point to the same current evidence:

1. current candidate returns and the content-resolved accepted counselor-reference set;
2. a valid Candidate Blind Review event chain;
3. at least six current review packets;
4. all three frozen cases independently reviewed by at least two distinct reviewer codes;
5. a Clinical Standard draft recorded before candidate outcomes; and
6. active local study control with no open stopping event.

A changed candidate-return chain head, reference-decision chain head, Clinical Standard hash, or Candidate Trial protocol removes prior review packets from the current cohort. The cycle desk cannot reuse stale outcomes.

## Recurrence and safety rules

The fixed correction taxonomy maps to six declared rules:

| Correction signal | Declared intervention | Target |
|---|---|---|
| Factual mismatch | Evidence-grounding constraint | Evidence fidelity |
| Unsupported overreach | Diagnostic-restraint constraint | Clinical restraint |
| Material omission | Material-signal coverage | Evidence fidelity |
| Tone or clarity | Tone-and-clarity structure | Conversation usefulness |
| Workflow usefulness | Workflow-usefulness structure | Conversation usefulness |
| Safety routing | Safety escalation only | Governed triage—not optimization |

A non-safety signal is eligible only when it recurs across all three frozen cases and at least two distinct reviewer codes. One unsafe correction holds the entire anonymous lane for independent safety triage. Safety routing can never become a tuning target.

This threshold identifies a repeatable correction pattern. It does not establish causality or performance.

## One-change cycle

One open cycle pins:

- one anonymous lane;
- one eligible signal snapshot and its exact evidence-event hashes;
- one predeclared intervention, target measure, and iteration goal;
- the current review, return, Clinical Standard, and Candidate Trial fingerprints; and
- three exact baseline artifact hashes from the original frozen cases.

The event then issues three content-free retest envelopes. Each envelope contains identifiers and hashes only. Source content, baseline or revised summary prose, provider/model/prompt identity, endpoint, credential, Findings content, record data, and PHI are absent.

The intervention is declared but `changesPerformed` remains false. The envelope set is ready for separately authorized manual execution; PERL neither performs nor verifies that work in this package. One lane may have one open cycle until a future governed return-and-disposition contract can close it. That future contract—not this desk—can decide whether another iteration is warranted.

## Immutable event and receipt

`candidate-refinement-cycle-scoped` stores:

- sequence, previous hash, event hash, and actor-code hash;
- anonymous lane and cycle identity;
- recurrence counts and the exact blind-review event hashes;
- one immutable intervention declaration;
- current upstream evidence bindings;
- same-case, one-change, blind-re-review, independent-review, and manual-execution policy;
- three exact retest envelopes;
- the complete content-boundary book; and
- explicit false values for performance, modification, execution, return, review, ranking, selection, clinical, pilot, release, and patient-use claims.

Startup validates every evidence binding against the blind-review and candidate-return inventories. Any changed signal count, source hash, baseline artifact, policy, content boundary, authority claim, or linked hash fails closed.

The browser receipt contains only the anonymous lane, correction label, intervention label, target, envelope count, time, and hash. The downloadable retest kit excludes the actor code and all identity, score, mapping, or summary content.

## API

- `GET /api/calibration/candidate-refinement` — aggregate readiness, anonymous lane portraits, and content-free cycle history.
- `POST /api/calibration/candidate-refinement/cycles` — issue one bounded cycle from one exact eligible signal.
- `GET /api/calibration/candidate-refinement.json` — download the content-free desk evidence.
- `GET /api/calibration/candidate-refinement/cycles/:cycleId/retest-kit.json` — download one exact content-free retest kit.

No endpoint accepts a retest return or model modification.

## Visual and accessibility contract

The lab uses Focused Future’s restrained editorial character: near-black and deep-forest framing, ivory working papers, hairline rules, and sparing gold. It avoids gradients, generic AI imagery, model logos, and leaderboard language. The sequence is legible as one signal → one change → three retests.

The surface uses a named region, ordered headings, native labeled selects, a polite live status, visible focus treatment, 44/48-pixel controls, reduced-motion handling, and responsive 1080-, 760-, and 430-pixel rules. Anonymous lanes remain in fixed I–III source order and collapse to one column on small screens.

## Operational continuity

Schema 45 migrates by creating an empty `candidateRefinementEvents` ledger and advancing to schema 46. Migration never invents a signal, cycle, intervention, or retest. Recovery reconciles the forty-third chain. Rollback baseline `2026.08.14.41` pins 129 exact source files, including `candidate-refinement-retest.css`, `src/candidate-refinement-retest.js`, and `schemas/candidate-refinement-retest-event.schema.json` alongside the updated application, server, API client, and store.

## Downstream package

Package 2.41 implements exact manual retest-return intake and same-case X/Y re-review in the separate [Same-Case Retest & Re-Review Studio](./CANDIDATE_RETEST_REREVIEW_STUDIO.md). Package 2.42 adds the [Candidate Retest Independent Disposition Chamber](./CANDIDATE_RETEST_DISPOSITION_CHAMBER.md), which can verify four externally signed exact-cycle accuracy, reliability, Clinical Standard, and result-freeze duties without interpreting them as generalized performance. Package 2.43 adds the [Exact Candidate Advancement Airlock](./CANDIDATE_ADVANCEMENT_AIRLOCK.md), which separately freezes the cycle action before revealing and freezing an exact advance/retain/hold candidate package; integration, release, and use remain outside it.
