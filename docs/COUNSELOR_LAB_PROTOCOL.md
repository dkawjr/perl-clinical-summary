# PERL Counselor Lab protocol

## Purpose

The Counselor Lab turns Dolores's requested live-review and training loop into three governed working sessions. It is the bridge between a functional synthetic product and a protocol that qualified counselors and an independent evaluator can inspect. It is not a meeting calendar, credential register, clinical acceptance record, or validation claim.

The three-session choice is deliberate. The July 2026 proposal allows two to three sessions. Three keeps language and safety decisions, blinded workflow evidence, and protocol freeze under separate gates so a useful rehearsal cannot be mistaken for accepted clinical evidence.

## Source basis

- The July 2026 proposal calls for two to three sessions with Dolores and counselors, report samples, counselor interpretation notes, and language and tone guidance.
- Dolores's January 12, 2026 product update calls for live reviewers to assess general accuracy, return feedback, support modifications and more testing, and precede independent accuracy and reliability review.
- Dolores's August 13, 2026 update says counselors are available for review and training. No roster, qualifications, conflicts, schedule, attendance, or acceptance record is connected to this sandbox.

These are source-reported facts. A counselor's name in correspondence does not register an authenticated clinical reviewer in PERL.

## Preflight returns

Before Session 01 is represented as a clinical working session, return:

1. named clinical lead and counselor-panel roster with qualifications, roles, conflicts, and permitted-use attestations;
2. approved de-identified Findings-report samples linked to authoritative scoring and report versions;
3. versioned counselor interpretation notes with authorship, case linkage, and intended-use restrictions;
4. accepted indicator-language, tone, uncertainty, disclaimer, and prohibited-claim guidance;
5. direct critical-screen review and escalation route, including the accountable clinical owner;
6. frozen development-case manifest, reviewer allocation, blind protocol, and adjudication method;
7. predeclared session objectives, attendance record, decision rights, stopping rules, and completion criteria; and
8. named independent evaluator and approved handoff format for accuracy and reliability review.

## Session 01 — language and safety

Objective: set the clinical voice before judging the model.

The panel reads the same approved Findings evidence, identifies supported, ambiguous, missing, overreaching, and unsafe language, and agrees how uncertainty, evidence citation, and direct critical-screen review appear. Disagreement remains visible and routes to the named adjudicator.

Required outputs:

- versioned language and tone rules;
- prohibited-phrase and omission register;
- critical-screen escalation rule; and
- open disagreements with a named adjudicator.

The current blind-comparison surface can rehearse the mechanics, but its reviewer codes are not counselor credentials and its bundled examples are synthetic.

## Session 02 — evidence and workflow

Objective: test whether the page changes the next conversation without combining distinct outcomes.

The panel completes blinded counselor-reference versus PERL comparisons and matched unaided-versus-assisted workflow tasks. Fidelity, restraint, usefulness, correction burden, review time, and safety events remain separate. An unresolved high-severity or critical event stops the session workflow.

Required outputs:

- paired blind ratings and preferences;
- hash-linked correction taxonomy;
- matched workflow observations; and
- incident, pause, and exposure record.

The sandbox thresholds are workflow controls, not clinical acceptance criteria. Production thresholds and allocation must be frozen by the clinical lead and independent evaluator before approved results are inspected.

## Session 03 — freeze and independent handoff

Objective: close decisions before an independent reviewer opens the package.

The decision group reviews denominator-first evidence and repeated-review agreement, accepts, rejects, or defers material patterns, freezes counselor-reference, prompt, rule, case-set, and analysis-plan versions, records unresolved limitations, and issues a continue, revise, or pause disposition.

Required outputs:

- signed counselor-reference freeze;
- accepted and deferred change register;
- locked protocol and analysis plan;
- unresolved-risk and limitation register; and
- independent-review handoff fingerprint.

Session completion does not itself establish accuracy, reliability, validity, safety, effectiveness, pilot readiness, or production authorization. Those decisions require the named external authorities and evidence defined in the clinical-beta and launch-readiness plans.

## Executable packet

`GET /api/calibration/counselor-lab.json` returns `perl-counselor-lab/1.0`, including the fixed source basis, three sessions, eight preflight returns, live synthetic evidence counts, claim booleans, boundary, next decision, and a stable SHA-256 packet fingerprint. `generatedAt` is excluded from the fingerprint.

The packet always leaves roster acceptance, attendance, training, counselor-reference acceptance, protocol freeze, independent review, accuracy, reliability, clinical validity, pilot authorization, production release, and patient use false. A future authenticated clinical system must record those decisions; the local sandbox cannot.

## Structured rehearsal notes

The companion [Counselor Session Notebook](./COUNSELOR_SESSION_NOTEBOOK.md) turns each session's five fixed decision questions into enum-only local observations with pinned evidence counts and ledger heads. It is useful for preparing and replaying the governed sessions, but it has no free-text field and records no participant identity, attendance, transcript, clinical acceptance, or protocol freeze. Notebook coverage must never be presented as proof that a session occurred.
