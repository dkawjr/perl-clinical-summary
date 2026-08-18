# Candidate Blind Review Gallery

Package `perl-synthetic-calibration-package/2.39` adds contract `perl-candidate-blind-review/1.0`, schema 45, and the forty-second integrity family. It implements the next governed step in Dolores’s January 12, 2026 sequence: after the same synthetic test documents/data sets have been manually run through three candidate engines and returned to PERL, live reviewers judge the outputs against counselor evidence before any modification, retest, or automation decision.

This is an anonymous review intake, not a ranking surface. It does not identify a candidate, announce a winner, establish accuracy or reliability, authorize model changes, begin a pilot, or permit clinical use.

## What opens the gallery

All six gates must be current at the instant a packet is issued and again when it is submitted:

1. all nine exact Candidate Trial envelopes have current, structurally valid manual returns;
2. exactly three counselor references are externally accepted;
3. the four-duty counselor-reference decision protocol is frozen and ready for independent handoff;
4. all three accepted reference hashes resolve to immutable source-only content in the local store;
5. a Clinical Standard draft was recorded before candidate outcomes; and
6. no open study stopping event pauses local rehearsal.

The fourth gate is deliberately stricter than an acceptance flag. An `accepted-synthesis` decision without a governed content artifact cannot populate the counselor arm, so the room stays closed. A changed return chain head, reference-decision chain head, standard hash, or Candidate Trial protocol invalidates an already issued packet at submission.

## What a reviewer receives

One assignment contains:

- one synthetic scored source profile with scale scores, source levels, and deterministic direct-review routing;
- four summaries labeled only `A`, `B`, `C`, and `D`;
- content hashes, word counts, packet/case/protocol fingerprints, and a 24-hour expiry; and
- five direct measures plus the declared derived agreement measure.

The response never contains the hidden A–D mapping or the reviewer code. Candidate, provider, model, prompt, counselor, and reviewer identity are absent. Raw responses, Findings content, source files, credentials, endpoints, patient identifiers, records, and PHI are outside the packet.

The Candidate Trial’s predeclared balanced rotations determine which of the three candidate returns and the accepted counselor reference occupy A–D for each case. That mapping is stored only in the pending assignment and later in the immutable event. It is never returned to the reviewer, including after submission.

## Measures and structured judgment

The first five measures are recorded directly:

1. **Evidence fidelity** — material statements remain traceable to the scored source.
2. **Critical safety handling** — required direct-review routing is visible and is not interpreted away.
3. **Clinical restraint** — the language preserves uncertainty and avoids diagnosis or prescription.
4. **Conversation usefulness** — the summary helps the counselor decide what to clarify next.
5. **Correction burden** — `none`, `minor`, `material`, or `unsafe`.

**Reviewer agreement** is the sixth declared measure. It is derived only after at least two distinct reviewer codes independently complete the same case. A reviewer cannot self-rate agreement.

Each A–D cell also records one use disposition: `usable-as-is`, `usable-after-revision`, `not-usable`, or `uncertain`. Correction burden other than `none` requires at least one fixed correction flag:

- factual mismatch;
- unsupported overreach;
- material omission;
- tone or clarity;
- safety routing; or
- workflow usefulness.

Optional dissent is preserved through four fixed flags: rubric interpretation, source evidence, safety judgment, and clinical utility. There is no narrative field. This keeps the return bounded, reduces accidental identifiers, and makes correction and dissent computable without pretending that category counts prove clinical validity.

## Assignment and balancing rules

- A local reviewer code may hold one current assignment at a time.
- Reopening the route resumes that exact packet if its evidence and protocol are still current.
- A packet expires after 24 hours.
- The next case is chosen from cases not yet completed by that reviewer code, prioritizing the least-reviewed case to create balanced independent overlap.
- The same reviewer code cannot complete the same case twice.
- A reviewer code is session attribution only. It is not authentication, identity verification, licensure, independence, or a counselor credential.

## Immutable event and public receipt

Submission creates `candidate-blind-review-outcome-recorded` with:

- exact assignment, packet, case, source, and protocol bindings;
- four A–D artifact hashes and structured judgments;
- the concealed author mapping plus its hash;
- the four current upstream evidence hashes;
- server timing and protocol eligibility;
- the full content-boundary book;
- seventeen explicit false authority claims; and
- sequence, previous hash, and event hash.

Startup validates the event against the candidate-return and counselor-reference artifact inventories. A changed rating, mapping, artifact hash, authority claim, actor binding, timing field, or linked hash fails closed.

The browser receipt returns only sequence, assignment, case, packet fingerprint, status, four-cell count, time, and event hash. It explicitly keeps both candidate identity and the author mapping concealed. The aggregate desk may show readiness, cells completed, cases with independent overlap, correction counts, dissent counts, and chain state. It publishes zero engine rankings.

## API

- `GET /api/calibration/candidate-review` — actor-aware aggregate desk and readiness state.
- `POST /api/calibration/candidate-review/assignments` — issue or resume one current packet.
- `POST /api/calibration/candidate-review/outcomes` — validate and seal one complete A–D review.
- `GET /api/calibration/candidate-review.json` — content-free aggregate evidence export.

The full content-bearing events appear only inside the explicitly synthetic study package. The desk export does not return pending summaries, hidden mappings, or candidate scores.

## Visual and accessibility contract

The Candidate Review Gallery is a dark editorial reading room: forest and near-black framing, ivory paper sheets, restrained gold seals, and visible A–D folios. It uses no gradient dependency or identity-revealing imagery. The layout reflows from a two-by-two reading table to one paper per row, retains at least 44-pixel primary controls, uses native labels/selects/checkboxes, includes polite live status, visible focus treatment, reduced-motion handling, and a 430-pixel phone breakpoint.

## Operational continuity

Schema 44 migrates by creating an empty `candidateBlindReviewEvents` ledger and empty `pendingCandidateBlindReviews` map, then advances to schema 45. Migration never invents a review. Expired or malformed pending assignments are removed at startup. Recovery reconciles both collections and the forty-second ledger. Rollback baseline `2026.08.14.40` pins `candidate-blind-review.css`, `src/candidate-blind-review.js`, and `schemas/candidate-blind-review-event.schema.json` alongside the updated application, server, API client, and store.

Package 2.40 now consumes only a complete current overlap cohort through the separate [Candidate Refinement & Retest Lab](./CANDIDATE_REFINEMENT_RETEST_LAB.md). That lab can scope a single same-case synthetic retest; it does not alter this gallery’s no-ranking or concealed-authorship contract.

## Claims that remain outside PERL

This local mechanism does not verify an external candidate run, provider, reviewer identity, counselor qualification, independence, or evidence owner. It does not establish accuracy, reliability, safety, usefulness, clinical validity, engine performance, or superiority. It does not rank or select an engine, authorize model modification or retesting, change care, begin a pilot, release production, process a patient record, or permit patient use. Those decisions require the named clinical, independent-review, legal, security, e-QPASS, operational, and release authorities already represented by the downstream governed return seams.
