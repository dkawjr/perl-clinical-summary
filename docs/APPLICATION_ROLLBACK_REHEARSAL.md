# PERL local application rollback compatibility contract

## Decision

PERL now separates three ideas that must not be conflated:

1. **change disposition** can close a proposed component change as `rollback`;
2. **data recovery** can prove that synthetic persisted state reopens intact;
3. **application rollback compatibility** can prove that a named local engineering baseline is still identifiable, exact, compatible, and safety-replayable.

Only the third is covered by `perl-application-rollback-rehearsal/1.0`. Even a verified result is not an application deployment, a restored binary/container, an Azure rollback, or clinical release authority.

## Sealed local baseline

`src/rollback-rehearsal.js` defines `perl-local-lkg-2026-08-14` version `2026.08.14.37`. It pins:

- the deterministic model, report template, disclaimer, state schema, and release-evaluator versions;
- the static clinical-policy SHA-256 fingerprint;
- the frozen synthetic case-set ID and version;
- SHA-256 fingerprints for one hundred five bounded application, Clinical Brief, Counselor Fieldwork, Source-Only Counselor Reference Drafting, report, report-assembly, audience-handoff, Decision Exchange, server, clinical-engine, model-gateway, HTTPS model transport, Release Candidate Foundry, Release Admission Laboratory, Production Promotion Airlock, Production Runtime Envelope, Model Trial, Candidate Trial, Intended Use, Language Review, printable language-review book, monitoring, response, readiness, executive-handoff, calibration-intake, Counselor Lab, Counselor Session Notebook, Progress Review, printable progress-addendum, Clinical Standard, independent-review, e-QPASS owner-return, Governed Authority Trust, Governed Pilot-Start Interlock, Governed Clinical Release, Clinical Traffic Activation Witness, calibration, and schema files;
- `artifactRepository: working-tree-only` and `deployableArtifactAvailable: false`;
- `clinicalValidation: false` and `clinicalReleaseAuthorized: false`.

This is an engineering baseline manifest, not an immutable deployment package. Any pinned-file change intentionally breaks the rehearsal until engineering reviews the change, reruns the complete evidence suite, and deliberately seals a new baseline version.

## Rehearsal checks

`POST /api/operations/rollback/rehearse` requires all eleven checks:

1. the manifest satisfies its bounded non-claiming contract;
2. all five observed runtime versions exactly match the manifest;
3. the observed clinical-policy hash matches;
4. the frozen case-set identity matches;
5. all one hundred five source fingerprints match;
6. the running state schema is exactly compatible;
7. the materialized generation-snapshot chain is valid;
8. the report-artifact chain is valid and every artifact still satisfies the current report/disclaimer/content contract;
9. the frozen synthetic regression passes all predeclared safety invariants;
10. the latest isolated restore evidence is verified and its chain is valid;
11. no unresolved high-severity study stop is active.

A pass records `verified-local-compatibility`. Any other result records `failed` with a bounded error code.

## Evidence model

State schema 17 introduced `rollbackEvents`, validated by `schemas/rollback-rehearsal-event.schema.json`. The current schema-49 baseline pins an exact bounded source inventory and includes the source-only Counselor Reference workflow, Independent Review Admission, Campus Operations Observatory, Candidate Return, Candidate Blind Review, Candidate Refinement & Retest, Same-Case Retest & Re-Review, Candidate Retest Independent Disposition, and Exact Candidate Advancement contracts and schemas alongside monitoring, response, readiness, Clinical Standard, Progress Review, Model and Candidate Trial, language and decision exchange, provider operations, governed authority/start/release/traffic, Identity & Access, HTTPS Model Transport, release construction/admission/promotion, runtime, and audience-handoff contracts. Each hash-linked event contains:

- baseline and manifest identity;
- expected and observed runtime versions and policy hashes;
- case-set provenance;
- per-file expected hash, observed hash or null, and match result;
- frozen-regression and recovery-evidence fingerprints;
- all eleven explicit verification booleans;
- actor, timestamps, duration, sanitized error code, and event hash;
- `artifactRepository: working-tree-only`;
- `deployableArtifactRestored: false`;
- `productionRollbackPerformed: false`;
- `clinicalValidation: false`;
- `clinicalReleaseAuthorized: false`.

Startup verifies the sequence, hashes, bounded fields, source-result semantics, status semantics, and claim-denial fields. Altering one pinned result or event link prevents the store from opening.

## API and operator surface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/operations/rollback` | Baseline identity, manifest fingerprint, current versions, last event, chain, and boundary |
| `POST` | `/api/operations/rollback/rehearse` | Runs the non-mutating local compatibility/safety rehearsal and commits its evidence event |

The Governance dossier shows the manifest fingerprint, five-version result, 148-file result, safety replay, rollback-restoration boundary, four primary proof steps, evidence fingerprint, and full no-deployment boundary. The adjacent Release Candidate Foundry produces a real verified software archive, the Release Admission Laboratory exercises that exact archive, and the Production Runtime Envelope verifies the container contract, but none makes the rollback rehearsal restore or deploy it.

## Failure semantics

- Missing or changed source is recorded as a mismatch without persisting filesystem paths outside the bounded manifest or raw read errors.
- Invalid manifest, version drift, policy drift, state incompatibility, report/generation failure, failed regression, missing recovery evidence, or active safety stop yields `ROLLBACK_COMPATIBILITY_FAILED`.
- Unexpected internal failure yields `ROLLBACK_REHEARSAL_FAILED`; raw exception text is not persisted.
- Concurrent rehearsals return a conflict.
- A failed event remains valid audit evidence of failure and is included in the synthetic evidence package.
- The rehearsal never changes a version, rewrites state, swaps a provider, reverts code, or invokes a deployment system.

## Production replacement gate

A real application rollback still requires:

1. move the current deterministic local candidate into an isolated CI builder and approved immutable artifact/container registry;
2. SBOM, provenance, vulnerability, and dependency evidence;
3. deployment identities, environment configuration, secrets, and infrastructure versions;
4. backward/forward database and event-schema compatibility policy;
5. report, queue, attachment, and e-QPASS lifecycle compatibility;
6. last-known-good selection authority and clinical stop/restart authority;
7. staged rollback in an isolated Azure environment, then the named pilot environment;
8. telemetry, alert, audit, and post-rollback reconciliation;
9. tested forward-fix and rollback decision criteria;
10. named engineering, security, e-QPASS, clinical, and product acceptance.

The local contract is the minimum evidence pattern for that production procedure. It does not replace the procedure or its accountable owners.
