# Campus Operations Observatory

## Decision

Package `perl-synthetic-calibration-package/2.37` adds `perl-campus-operations-observatory/1.0`: a top-level provider-operations view that turns Dolores’s source-reported group-dashboard, quarterly-review, training-before-use, and page-customization direction into an inspectable operating surface. It shows aggregate synthetic workflow evidence only. It is not a site dashboard, a clinical record system, or proof that a campus, quarter, review, or pilot exists.

The product rule is visible in the interface: **see the work without seeing the student.** No assessment row, student or counselor identity, raw answer, Findings content, narrative, note, credential, file, or PHI enters the observatory contract or snapshot request.

## Source-backed operating frame

The observatory preserves two candidate pathways already represented in the Provider Pilot Operations Studio:

- North Central University: source-reported counseling-center working context, August–May term, August training, objectives before use, quarterly review rhythm, and group/dashboard proposal;
- Cooper University: source-reported psychiatric-clinic quality-improvement interest, with site, scope, schedule, and operating authority still unresolved.

These are planning candidates, not verified customers or activated sites. The interface keeps North Central’s proposed context and Cooper’s unresolved context distinct and never compares or ranks them.

Four fixed operating moments make the decision cadence explicit:

1. Admission — scope, owners, denominator, training, support, stop rules, and dates.
2. Quarter one — review completeness, safety routing, correction evidence, and timing evidence.
3. Midyear — continue, pause, or return for controlled revision.
4. Closeout — stop, revise, renew under a new agreement, or open a separate expansion decision.

## Denominator-first signal book

The view derives six guarded measures from the frozen local sandbox:

| Measure | Numerator | Denominator | Claim boundary |
|---|---:|---:|---|
| Workflow coverage | summaries generated | eligible synthetic profiles | Requires an authoritative site denominator in production |
| Review completion | explicit review dispositions | summaries generated | Opening or generating is not completion |
| Correction burden | structured correction records | disposed reviews | Editing burden is not accuracy |
| Critical routing | required direct-review routes | critical screens | Route evaluation is not proof of clinician response |
| Workflow timing | eligible timing observations | unavailable until evidence exists | No time-savings claim without an accepted protocol and comparator |
| Counselor usefulness | eligible usefulness ratings | unavailable until evidence exists | Preference is not diagnostic accuracy, reliability, or benefit |

Unavailable measures remain unavailable. Counts are labeled synthetic, and zero never substitutes for missing source evidence.

## One bounded decision

The only recorded choice is an enum-only working position for Dolores’s page/survey-question note:

- decision open;
- keep the standard page;
- evaluate one minimum-necessary, non-clinical question through separate site, clinical, and privacy review;
- defer customization until an authorized pilot produces a documented need.

The request accepts only `candidateId`, `reviewMomentId`, and `customizationPositionId`. It cannot accept comments, identities, source records, files, answers, or PHI.

## Persistence and integrity

Schema 43 adds `campusObservatoryEvents`, validated by `schemas/campus-observatory-snapshot-event.schema.json`. Each event is append-only and hash-linked through the fortieth integrity family. The event pins:

- the current observatory fingerprint;
- candidate and review-moment identifiers;
- the enum-only customization position;
- aggregate synthetic counts and six measure states;
- current upstream evidence fingerprints;
- the actor code and timestamp;
- explicit false claims for source verification, record rows, source denominator, site/counselor identity, training, quarter occurrence, customization approval, completed review, clinical outcome, pilot authorization/start, production release, patient use, and PHI.

Changing a stored event, chain position, evidence fingerprint, count, measure state, or denied claim fails integrity validation at startup.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/operations/campus-observatory` | Return the live aggregate synthetic observatory, candidates, review moments, measures, training readiness, event history, and chain state |
| `GET` | `/api/operations/campus-observatory.json` | Download the same aggregate-only evidence package |
| `POST` | `/api/operations/campus-observatory/snapshots` | Validate and append one bounded review-posture snapshot |

An example request is:

```json
{
  "candidateId": "cooper-university",
  "reviewMomentId": "quarter-one",
  "customizationPositionId": "defer-customization"
}
```

The response does not establish that Cooper is verified, that quarter one occurred, or that anyone approved deferral.

## Production replacement gate

Before this surface can display real provider operations, replace the local projection with an authenticated, site-scoped aggregate service that has:

- an authoritative eligibility denominator and explicit cohort/window semantics;
- tenant isolation, role-based access, record-level authorization, and minimum-necessary aggregation;
- small-cell suppression and reviewed re-identification risk rules;
- source-owned definitions for generated, disposed, corrected, routed, timed, and rated events;
- current roster, licensure, training, support, and site-authority evidence outside this event store;
- monitored ETL freshness, reconciliation, late-event handling, and immutable audit export;
- externally governed quarterly-review and customization decisions;
- clinical, privacy, legal, accessibility, security, e-QPASS, site, and independent-review acceptance.

Keep the observatory aggregate-only even after those controls exist. Student-level review belongs in the existing clinician workflow under production identity and authorization—not in the campus operating view.
