# PERL isolated recovery rehearsal contract

## Decision

PERL must demonstrate that its persisted state can be restored and verified before anyone treats recovery as an operational control. The local product now implements contract `perl-recovery-rehearsal/1.0` for synthetic-state rehearsal only.

This closes a local engineering-evidence gap. It does **not** establish an encrypted backup policy, Azure recovery, production availability, or approved recovery point and recovery time objectives.

## Rehearsal sequence

`POST /api/operations/recovery/rehearse` performs one bounded sequence:

1. wait for the current atomic state write to finish;
2. read the exact persisted synthetic state and calculate its SHA-256 file and state fingerprints;
3. create an owner-only ephemeral directory outside the application data path;
4. copy the state with owner-only file permissions;
5. open the copy with a new `SandboxStore` through the ordinary startup, migration, provenance, and integrity checks;
6. compare the file hash, parsed-state digest, schema version, and counts for every persisted collection;
7. compare the evidence-ledger snapshot and require every ledger to be valid;
8. remove the isolated directory and verify that it no longer exists;
9. append one hash-linked success or failure event to the live synthetic state.

No temporary path, state content, respondent field, or internal exception text enters the recovery event.

## Reconciled state

The rehearsal counts assessments, reviews, stored audience narratives, interpretations, feedback and its event ledger, blind comparisons and their ledger, report artifacts, change events, source receipts, attachment receipts, provider-workflow events, generation records and events, active generation mappings, delivery jobs and events, active delivery mappings, recovery events, timing observations and events, pending blind/timing work, revisions, incidents, clinical-standard drafts and events, independent-review dossier events, e-QPASS owner-return preflight events, Counselor Session Notebook entries, source-only Counselor Reference drafts, Counselor Reference Adjudication snapshots, Progress Review observations, Model Trial preflight events, Candidate Trial planning snapshots, manual Candidate Return events, Candidate Blind Review outcomes and pending assignments, Candidate Refinement cycles, same-case Candidate Retest returns, paired re-review outcomes and pending assignments, independently signed Candidate Retest disposition events, Intended Use drafts, Language Review packets, Decision Exchange preflights, Provider Pilot Operations snapshots, Provider Activation snapshots, Campus Operations Observatory snapshots, Named-Site Admission preflights, governed authority/start/release/traffic events, authenticated-access decision events, and audit entries.

The pre-rehearsal count object and its own hash are stored with the event. The recovery event itself is appended only after reconciliation, so a successful event correctly reports the state that was restored rather than counting itself as part of the restored copy.

## Verified ledgers

At schema 16 the restored store accepted thirteen integrity families. Schema 17 accepted fourteen by adding application-rollback evidence. Schema 18 accepted fifteen by adding operational-monitoring evidence. Schema 19 accepted sixteen by adding incident-response evidence. Schema 20 accepted seventeen by adding pilot-readiness evidence. Schema 21 accepted eighteen by adding clinical-standard draft evidence. Schema 22 accepted nineteen by adding independent-review dossier evidence. Schema 23 accepted twenty by adding e-QPASS owner-return preflight evidence. Schema 24 accepted twenty-one by adding Counselor Session Notebook evidence. Schema 25 accepted twenty-two by adding Progress Review evidence. Schema 26 accepted twenty-three by adding Model Trial preflight evidence. Schema 27 accepted twenty-four by adding Candidate Trial planning evidence. Schema 28 accepted twenty-five by adding Intended Use Charter evidence. Schema 29 accepted twenty-six by adding Language Review evidence. Schema 30 accepted twenty-seven by adding Decision Exchange preflight evidence. Schema 31 accepted twenty-eight by adding Provider Pilot Operations evidence. Schema 32 accepted twenty-nine by adding Provider Activation evidence. Schema 33 accepted thirty by adding Named-Site Admission evidence. Schema 34 accepted thirty-one by adding Governed Authority Trust evidence. Schema 35 accepted thirty-two by adding the Governed Pilot-Start Interlock. Schema 36 accepted thirty-three by adding Governed Clinical Release. Schema 37 accepted thirty-four by adding the Clinical Traffic Activation Witness. Schema 38 accepted thirty-five by adding authenticated-access decisions. Schema 39 accepted thirty-six by adding source-only Counselor Reference drafts. Schema 40 accepted thirty-seven by adding Counselor Reference Adjudication snapshots. Schema 41 accepted thirty-eight by adding Counselor Reference Decision challenges and attestations. Schema 42 accepted thirty-nine by adding Independent Review Admission challenges and attestations. Schema 43 accepted forty by adding Campus Operations Observatory snapshots. Schema 44 accepted forty-one by adding manual Candidate Return events. Schema 45 accepted forty-two by adding Candidate Blind Review outcomes. Schema 46 accepted forty-three by adding Candidate Refinement cycle evidence. Schema 47 accepted forty-five by adding exact Candidate Retest returns and paired re-review outcomes. The current schema 48 rehearsal accepts forty-six by adding independently signed exact-cycle disposition evidence:

- narrative and interpretation revisions;
- structured reviewer feedback;
- safety incidents;
- blind outcomes;
- approved report artifacts;
- governed changes;
- source-event receipts;
- attachment preparation;
- provider workflow;
- materialized generation snapshots;
- delivery outbox;
- workflow timing;
- earlier recovery evidence;
- application rollback compatibility evidence;
- operational monitoring evidence.
- incident-response rehearsal evidence.
- pilot-readiness snapshot evidence.
- clinical-standard draft evidence.
- independent-review dossier seal evidence.
- e-QPASS owner-return metadata-preflight evidence.
- Counselor Session Notebook rehearsal evidence;
- source-only Counselor Reference draft evidence;
- Counselor Reference Adjudication dossier-snapshot evidence;
- Counselor Reference Decision challenge and signed-attestation evidence;
- Independent Review Admission challenge and signed-attestation evidence;
- Candidate Retest Independent Disposition challenge and signed-attestation evidence;
- Progress Review rehearsal observations.
- Model Trial candidate-metadata preflight evidence.
- Candidate Trial protocol-planning snapshot evidence.
- manual structured Candidate Return receipt evidence.
- anonymous Candidate Blind Review outcome evidence.
- anonymous Candidate Refinement and same-case retest-scope evidence.
- exact same-case Candidate Retest return evidence.
- anonymous paired Candidate Retest re-review outcome evidence.
- Intended Use Charter draft evidence.
- Language Review working-packet evidence.
- Decision Exchange metadata-preflight evidence.
- Provider Pilot Operations planning-snapshot evidence.
- Provider Activation rehearsal-workbook evidence.
- Named-Site Admission metadata-preflight evidence.
- Governed Authority Trust challenge and signed-receipt evidence.
- Governed Pilot-Start Interlock challenge, signed-order, and deployment-acknowledgement evidence.
- Governed Clinical Release challenge, clinical-use authorization, production-release authorization, and deployment-attestation evidence.
- Clinical Traffic Activation Witness challenge, clinical/operations concurrence, and first-governed-transaction evidence.
- externally authenticated API mutation-grant evidence.
- Campus Operations Observatory aggregate review-posture evidence.

An invalid job, artifact, transition, mapping, count, or event causes the rehearsal to fail closed.

## Evidence event

Schema 16 adds `recoveryEvents`, validated by `schemas/recovery-rehearsal-event.schema.json`. Every event records:

- sequence, previous hash, event hash, actor, timestamps, and duration;
- exact source/restored file and state fingerprints when available;
- source schema, record counts, reconciled total, ledger count, and ledger-evidence fingerprint;
- explicit booleans for file, state, schema, count, ledger, permission, and cleanup checks;
- a bounded machine-readable error code on failure;
- `productionRecoveryClaimed: false`, `rpoConfigured: false`, and `rtoConfigured: false`.

Startup verifies the recovery chain before serving requests. Altering a recorded count, check, fingerprint, or chain link prevents the store from opening.

## API and operator surface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/operations/recovery` | Current contract, last event, current counts, chain state, RPO/RTO decision state, and boundary |
| `POST` | `/api/operations/recovery/rehearse` | Runs one isolated rehearsal and returns the durable event and current status |

The Governance view exposes the same evidence as an operator control: state schema, exact reconciled record total, verified-ledger total, four verification stages, last evidence fingerprint, and the unresolved RPO/RTO decision. A failure is displayed as a failure and never converted into a recovery-readiness badge.

## Failure semantics

- A second concurrent rehearsal returns a conflict rather than creating overlapping evidence.
- Restore-integrity rejection is recorded as `RESTORE_INTEGRITY_REJECTED`.
- Reconciliation mismatch is recorded as `RECOVERY_RECONCILIATION_FAILED`.
- Cleanup failure is recorded as `ISOLATION_CLEANUP_FAILED` and prevents a verified result.
- Other internal failures are recorded only as `RECOVERY_REHEARSAL_FAILED`; raw exception text is not persisted or returned as evidence.
- A failed event remains valid audit evidence of failure and is included in the synthetic study export.

## Production replacement gate

Before a pilot record can depend on PERL, the security, Azure operations, engineering, clinical, and product owners still need to provide and accept:

1. approved data classification, retention, backup scope, and deletion behavior;
2. automated encrypted Azure backup policy and monitored job evidence;
3. immutable access and service-identity records;
4. business- and clinical-impact-derived RPO and RTO decisions;
5. restore into an approved isolated Azure environment;
6. database, object/report, queue, identity, and audit-log reconciliation;
7. e-QPASS attachment and Findings lifecycle verification after restore;
8. last-known-good application, schema, rule, model, prompt, and report rollback rehearsal;
9. alert, escalation, restart, and evidence-retention procedures;
10. named acceptance by the accountable production owners.

The local rehearsal is reusable test logic and a precise acceptance pattern for that work. It is not a substitute for it.
