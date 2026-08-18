# PERL pilot-readiness dossier

## Purpose

The July 2026 proposal and Dolores's correspondence describe a provider-first clinical-summary product, but the path to a pilot depends on more than a working interface. It depends on named authority, accepted source contracts, clinical evidence, independent review, production controls, accessibility, and a site-specific go/no-go decision.

State schema 20 turns that distinction into an executable Permission Ledger. The ledger answers three questions without blurring them:

1. What can this local synthetic workspace reproduce now?
2. Which accountable person must accept the next evidence?
3. Why does the named-site pilot remain blocked?

The contract identifier is `perl-pilot-readiness-snapshot/1.0`. Its boundary is:

> This consolidates local synthetic evidence and unresolved launch authority. It does not record an external approval, assign a production owner, establish clinical validity, authorize a pilot, authorize clinical release, or certify an Azure or e-QPASS production environment.

## Authority register

The register is deliberately fixed. Engineering cannot silently absorb missing clinical, legal, security, accessibility, or evaluation authority.

| Role | Name represented locally | State | Meaning |
|---|---|---|---|
| Executive and product sponsor | Dolores | Source-confirmed | The source correspondence identifies product sponsorship; this is not pilot authorization |
| Program and integration lead | Mike | Provisional from source | The correspondence suggests coordination responsibility; Mike must confirm it |
| Clinical lead | — | Unassigned | A licensed accountable clinical owner is required |
| Engineering owner | — | Unassigned | Production application and release accountability is required |
| e-QPASS technical owner | — | Unassigned | The authoritative scored-event and attachment contracts require acceptance |
| Security and privacy owner | — | Unassigned | The production data flow and controls require acceptance |
| Accessibility owner | — | Unassigned | Manual, assistive-technology, PDF, and exception evidence require acceptance |
| Legal owner | — | Unassigned | Intended use, language, retention, contracts, and pilot terms require acceptance |
| Independent evaluator | — | Unassigned | The frozen analysis and reliability decision require independence |
| Counselor panel | — | Unassigned | Guided calibration and usability evidence require named participants |

The current fixed counts are one confirmed source owner, one provisional source owner, and eight unassigned authority roles. A source-mentioned person is not automatically a production approver.

## Fourteen gates

### Local evidence patterns

| Gate | Counts as current only when | What it does not prove |
|---|---|---|
| Engineering safety regression | Frozen synthetic safety outcomes pass, study controls are active, and generation lineage is intact | Clinical validity or real-world error rate |
| Versioned report governance | At least one content-valid clinician artifact has intact lineage | Legal or clinical acceptance of the template |
| Findings-to-handoff rehearsal | A synthetic scored event completes approval, automatic preparation, and durable outbox creation | An e-QPASS write or production connector |
| Current-schema restore evidence | The latest isolated restore is verified against the current state schema | Production backup, retention, RPO, or RTO |
| Sealed application baseline | The latest compatibility event matches the current schema and exact sealed source manifest | A deployable artifact or production rollback |
| Operational control evidence | The latest current-schema local control matrix is clear | Continuous telemetry, SLA/SLO, or external alert delivery |
| Incident-response rehearsal | The latest tabletop links the latest monitoring, restore, and rollback evidence | A production incident, containment action, notification, or restart authority |

These gates may move between `local-evidence-current` and `local-evidence-required` as the state schema, sealed source, or continuity evidence changes.

### External authority decisions

The following seven gates are always `external-decision-required` in this local product:

1. intended use and legal language;
2. authoritative e-QPASS scored-event and attachment contract;
3. counselor calibration acceptance;
4. independent reliability decision;
5. Azure security and privacy acceptance;
6. independent accessibility acceptance;
7. named-site pilot authorization.

No local route accepts an external approval. That is intentional: production identity, evidence signature, decision scope, expiry, conditions, and revocation semantics must be designed and accepted before external decisions can become software records.

## Decision rule

The overall state is always `pilot-authorization-blocked` inside this synthetic workspace. Even when all seven local patterns are current, all seven external decisions remain open.

Every current view and persisted event sets these fields to `false`:

- `productionReadinessClaimed`;
- `externalApprovalsRecorded`;
- `productionOwnersAssigned`;
- `pilotAuthorizationRecorded`;
- `clinicalReleaseAuthorized`.

Changing any of those fields in a recorded event makes startup fail closed.

## Integrity and export

`readinessEvents` is a separate hash-linked ledger. Each event contains the ordered fourteen-gate result, the fixed ten-role register, exact counts, current evidence-chain heads, a readiness-state hash, actor, timestamps, duration, and a plain-language blocked note.

Startup verifies gate order and semantics, authority identity and status, counts, evidence-head shapes, false claim flags, timestamps, state hash, previous hash, and event hash. The chain and exact events are included in `perl-synthetic-calibration-package/2.21`.

The published event schema is `schemas/pilot-readiness-snapshot-event.schema.json`.

## API and interface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/readiness` | Calculates the current fourteen gates, authority register, last snapshot, chain verification, and boundary |
| `POST` | `/api/governance/readiness/snapshot` | Seals the current blocked state; it cannot accept or create an approval |

The Governance view exposes the same contract as the Permission Ledger: local evidence book, external decision book, authority register, current counts, last evidence fingerprint, and the exact no-authorization boundary.

## Production replacement gate

Before a pilot-decision system can record external acceptance, the named product, clinical, legal, security/privacy, accessibility, engineering, e-QPASS, and independent-evaluation owners must approve:

1. authenticated decision-maker identity and delegation rules;
2. exact evidence package and evidence freshness required by every decision;
3. decision scope by tenant, site, workflow, model/rule/report version, and time window;
4. signed accept, reject, conditional, expired, superseded, and revoked states;
5. separation of duties and conflict-of-interest rules;
6. immutable trusted timestamps, signatures, reason, conditions, and linked evidence;
7. production access control, audit, privacy, retention, and legal-hold behavior;
8. notification, acknowledgment, exception, escalation, and stop/restart behavior;
9. a final pilot record that authorizes only identified sites and never general clinical release;
10. post-authorization monitoring, review cadence, renewal, and termination rules.

A green local evidence book can make the external decision package easier to inspect. It cannot make the decision.
