# PERL clinical-standard working-draft protocol

## Decision

The July 2026 proposal says Focused Future and the build team should define the client-satisfaction threshold together before testing begins. PERL now makes that requirement operational through `perl-clinical-standard-draft/1.0`.

The sandbox can record and preserve working intent. It cannot accept that intent on behalf of Dolores, a clinical lead, a counselor panel, an independent evaluator, a pilot site, or a production authority.

## Standard register

Every working draft must define seven separate thresholds:

1. minimum eligible blind-comparison preference for PERL;
2. minimum median counselor accuracy rating;
3. minimum median counselor restraint rating;
4. minimum median counselor usefulness rating;
5. maximum adjudicated material corrections per 100 eligible outputs;
6. minimum Gwet AC1 for independently repeated preference judgments;
7. maximum median protocol-eligible PERL-assisted workflow time.

The measures remain separate because preference is not accuracy, accuracy is not safety, usefulness is not reliability, and speed is not clinical quality. A rationale of 40–1,200 characters is required so a threshold set cannot be stored without its intended interpretation.

Four safety limits are fixed at zero and cannot be edited: critical-screen omissions, unsupported diagnostic certainty, invented or mismatched evidence, and unresolved high- or critical-severity incidents. Satisfaction evidence cannot offset one of these failures.

## Before-versus-after evidence rule

At creation, the server snapshots counts for paired blind comparisons, structured feedback, revisions, workflow-timing observations, and reported safety incidents. It also pins the current feedback, revision, blind-outcome, incident, and workflow-timing chain heads.

If every count is zero, the draft receives `preOutcomeCandidate: true`. If any count is nonzero, it receives `preOutcomeCandidate: false` and remains permanently labeled post-outcome. Later evidence cannot change an earlier snapshot, and a later edit cannot overwrite a prior draft.

This label establishes timing provenance only. A pre-results working draft is still unaccepted.

## Integrity and state

Schema 21 adds `clinicalStandardDrafts` and `clinicalStandardEvents`. Each draft contains the complete thresholds, fixed safety limits, rationale, evidence snapshot, chain heads, actor code, timestamp, all false authority fields, and a SHA-256 content fingerprint. Each event binds one draft ID, hash, version, timing label, actor, and timestamp into a separate linked sequence.

Startup requires one event per draft, consecutive versions, intact content fingerprints, correct evidence-time classification, unchanged safety limits, and false clinical/release claims. Any mismatch prevents the store from opening.

Reviewer codes are authorship labels for the synthetic sandbox. They are not clinical credentials or signatures.

## API and interface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/calibration/clinical-standard` | Current drafting contract, live evidence state, latest immutable version, history, chain, and claim boundary |
| `POST` | `/api/calibration/clinical-standard/drafts` | Validate and record a new immutable working-draft version |
| `GET` | `/api/calibration/clinical-standard.json` | Download the current draft register and integrity summary |

The Calibration view presents the editable seven-measure table beside the fixed safety rulebook, latest-draft card, version history, current evidence state, and integrity line. There is no accept, approve, freeze, pilot, production, or patient-use action.

## Production replacement gate

Before testing on approved clinical material, Dolores, the named clinical lead, the qualified counselor panel, the statistician or independent evaluator, and legal/privacy owners must jointly approve:

- intended use and eligible population;
- measure definitions and denominators;
- material-correction adjudication rules;
- missing-data and repeated-review handling;
- safety stopping rules and escalation authority;
- multiplicity, confidence-interval, and analysis methods;
- protocol version, change authority, and freeze time;
- authenticated signatures and immutable trusted timestamps.

Only that external process can transform a working draft into an accepted clinical protocol. A sandbox draft never establishes accuracy, reliability, clinical validity, pilot readiness, production release, or permission for patient use.
