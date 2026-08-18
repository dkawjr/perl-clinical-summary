# PERL incident-response rehearsal contract

## Purpose and boundary

Dolores's launch-readiness requirements call for a severity model, stop authority, notification tree, evidence preservation, and restart criteria. State schema 19 turns those requirements into an executable local tabletop contract without pretending that the synthetic workspace is a production incident-management system.

The contract identifier is `perl-incident-response-rehearsal/1.0`. Its boundary is:

> This rehearses a fixed incident-response playbook against local synthetic evidence. It does not declare or contain a production incident, stop a production service, send a notification, assign production authority, approve restart, or authorize clinical release.

## Fixed severity model

| Level | Criteria | Response target | Stop required by playbook |
|---|---|---|---|
| SEV1 — Critical | Potential clinical harm, material privacy or integrity loss, or broad service loss | Immediate | Yes |
| SEV2 — Major | Major workflow degradation, uncertain delivery, or multiple affected users | Within 15 minutes | Yes |
| SEV3 — Moderate | Bounded impairment without evidence of clinical harm or data loss | Within 1 hour | No |
| SEV4 — Low | Cosmetic or low-impact behavior without clinical, privacy, integrity, or availability consequence | Next business day | No |

These are the default response targets in the rehearsal contract. The named clinical, security, legal, and operations owners must accept or replace them from real impact analysis before production.

## Frozen tabletop scenarios

The local contract contains six bounded scenarios:

1. critical safety routing failure;
2. artifact-integrity failure;
3. suspected unauthorized access;
4. backup or restoration failure;
5. generation-provider failure;
6. delivery dead letter or uncertain remote outcome.

Each scenario pins a severity, detection signal, stop-authority role, fail-closed action, notification roles, four evidence sources, and four restart criteria. The browser cannot submit an arbitrary scenario or alter the response definition.

## Ordered response arc

Every successful rehearsal verifies four stages in order:

1. **Detect and classify:** bind the scenario to the frozen severity and response target.
2. **Stop and contain:** name the required authority and fail-closed action without performing a production stop.
3. **Preserve and reconcile:** link the scenario's evidence plan to the current monitoring, restore, rollback, integrity, and safety-event evidence.
4. **Decide restart:** evaluate the fixed restart criteria while recording that production evidence and authorization are absent.

The five production roles are clinical lead, engineering owner, security and privacy owner, legal owner, and e-QPASS owner. Every one remains `unassigned-production-owner` in this workspace. The scenario-specific notification tree is therefore inspectable but unconnected, and every notification record carries `externalNotificationSent: false`.

## Evidence prerequisites

`POST /api/operations/incidents/response/rehearse` fails with conflict status unless all three prerequisites are current:

- the latest operational snapshot is `local-controls-clear`;
- the latest isolated restore is verified against the current state schema;
- the latest sealed-baseline rehearsal is verified against the current state schema and manifest.

An open high or critical study-safety event also prevents rehearsal of restart governance. This keeps a tabletop from covering a real local stopping condition with a green badge.

## Durable event and integrity

Every successful run appends one `tabletop-response-rehearsed` event to `responseDrillEvents`. The event records:

- scenario, severity, response target, stop authority, and exact stop action;
- four response-stage results with evidence fingerprints;
- the unassigned scenario-specific notification tree;
- the bounded evidence inventory and restart criteria;
- monitoring, recovery, rollback, full-integrity, and safety-incident chain links;
- actor and server timestamps;
- explicit false values for production incident declaration, production service stop, production containment, notification delivery, assigned authority, clinical restart, and clinical release.

Events are hash-linked and checked semantically at startup. A changed scenario, phase, owner state, criterion, claim flag, timestamp, or hash causes startup to fail closed. The schema is published at `schemas/incident-response-rehearsal-event.schema.json`, and the chain plus exact events are included in `perl-synthetic-calibration-package/2.21`.

## API and interface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/operations/incidents/response` | Returns the severity model, six scenarios, response phases, owner seams, evidence prerequisites, last event, chain, and boundary |
| `POST` | `/api/operations/incidents/response/rehearse` | Rehearses one fixed scenario and commits the evidence event when all prerequisites pass |

The Governance view exposes the same contract as the Response Desk: scenario selection, severity target, four-stage arc, current evidence prerequisites, unassigned notification tree, last evidence fingerprint, and the exact non-production boundary.

## Production replacement gate

Before a pilot depends on PERL, the named owners still must provide and test:

1. authenticated incident commander, stop, containment, communication, and restart roles;
2. continuous Azure, application, provider, identity, backup, artifact, queue, and e-QPASS detection;
3. delivered and acknowledged paging, ticket, email, and escalation routes with timeout and fallback behavior;
4. immutable trusted-time evidence preservation, approved access, retention, privacy classification, and legal hold behavior;
5. tenant, site, user, record, artifact, report, and queue impact assessment without unsafe PHI disclosure;
6. tested service disablement, workflow holds, credential response, connector isolation, recovery, rollback, and reconciliation;
7. production restart criteria requiring current recovery evidence, corrective validation, affected-record reconciliation, and named clinical/security/engineering acceptance;
8. status-update cadence and counsel-approved customer/site communication templates;
9. blameless postmortem, five-whys analysis, and action items with accountable owners and dates;
10. representative failure injection observed end to end by the production notification tree.

A completed local tabletop is engineering evidence for the playbook shape. It is not evidence that production responders, telemetry, notifications, containment mechanisms, or restart authority exist.
