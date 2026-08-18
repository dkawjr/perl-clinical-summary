# PERL Counselor Session Notebook

## Decision

The Counselor Lab already defines the three working rooms Dolores described. The Session Notebook adds the missing evidence surface between the meeting plan and the clinical-standard or independent-review handoff: a reviewer can record what a fixed decision question revealed, which local evidence informed it, and whether the question should be carried, revised, deferred, or stopped.

The notebook is deliberately not a meeting record. It stores no counselor name, credential, attendance, training completion, transcript, patient narrative, raw response, Findings content, or PHI. It cannot accept a clinical decision or counselor reference, freeze the study protocol, complete independent review, establish accuracy, reliability, or clinical validity, authorize a pilot or production release, or permit patient use.

## Fixed working structure

`perl-counselor-session-notebook/1.0` contains three sessions with five decisions each:

1. **Language + safety** — indicator language, uncertainty, evidence citation, critical-screen routing, and prohibited claims.
2. **Evidence + workflow** — source fidelity, clinical restraint, next-conversation utility, correction burden, and workflow time.
3. **Freeze + handoff** — reference readiness, change register, analysis-plan readiness, unresolved risk, and independent handoff.

Each entry selects exactly one value from the fixed disposition, finding, and evidence-source registers. The optional case reference accepts only a visible `FF-TEST-*` synthetic identifier. Unknown fields and a decision from the wrong session are rejected. There is no free-text field.

## Evidence pinned at save time

Every entry snapshots:

- paired blind-comparison, structured-feedback, revision, workflow-timing, and open-safety-incident counts;
- the current feedback, revision, blind-outcome, incident, and workflow-timing chain heads;
- the frozen synthetic case-set ID and version;
- `sourceContractStatus: proposed-rfi-only`.

The resulting event is append-only and SHA-256 linked. A later observation may become the current state for the same decision, but the earlier entry remains in history. Startup fails closed if sequence, linkage, evidence snapshot, actor, time, content, any of thirteen false authority/clinical claims, or the event hash changes.

## API and interface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/calibration/counselor-notebook` | Return the fixed registers, current fifteen-decision coverage, history, integrity chain, fingerprint, and false claims |
| `POST` | `/api/calibration/counselor-notebook/entries` | Validate and append one enum-only local rehearsal observation with a pinned evidence snapshot |
| `GET` | `/api/calibration/counselor-notebook.json` | Download the current non-authorizing notebook |

The Calibration view renders the same contract as an editorial field notebook: a session selector, five-question decision atlas, native structured-entry form, current coverage register, immutable margin history, chain status, catalog fingerprint, and the full claim boundary. Its visual completion state represents local rehearsal coverage only.

## What production must replace

A governed counselor-session record still requires:

1. authenticated qualified counselor and facilitator identity;
2. approved meeting purpose, roster, and decision rights;
3. privacy-approved note and retention policy;
4. authoritative source artifacts and governed case access;
5. attendance and training evidence kept in their proper systems;
6. signed decisions with scope, dissent, conditions, expiry, and revocation;
7. accepted reference and protocol version authority;
8. independent evaluation, legal/privacy review, and named release authority.

The local notebook is a rehearsal instrument and integrity pattern for that future system. It is not evidence that the sessions occurred.
