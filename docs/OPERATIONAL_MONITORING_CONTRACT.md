# PERL operational monitoring contract

## Purpose and source

The July 2026 proposal includes ongoing “monitoring” in the licensed product obligation. Dolores’s launch-readiness requirements make that concrete: availability, latency, generation failure, safety routing, unauthorized access, backup failure, and artifact-integrity alerts must have evidence before production dependence.

State schema 18 turns the locally verifiable part of that obligation into an executable control matrix. It does **not** turn the local sandbox into a monitoring service.

The contract identifier is `perl-operational-monitoring/1.0`. Its boundary is:

> This verifies a point-in-time local synthetic control matrix. It is not continuous production telemetry, an availability or latency service-level claim, security-event monitoring, backup-job monitoring, external alert delivery, or authorization for clinical release.

## Control matrix

| Signal | Local evidence | Local state meaning | Production replacement |
|---|---|---|---|
| Availability | Ordinary store initialization, environment, schema, and startup integrity checks | The local synthetic store opened successfully at probe time | Azure service health, regional dependency health, synthetic transactions, availability objective, and retained telemetry |
| Latency | Elapsed time for one local point-in-time control probe against a 250 ms engineering budget | The bounded local probe completed; no request or generation SLO is inferred | Trusted request, queue, provider, report, and attachment spans with predeclared percentiles and objectives |
| Generation failure | Active materialized-generation count and generation-event chain | Every synthetic assessment has an intact active generation snapshot | Provider request/result/error metrics, timeout and invalid-output alerts, correlation IDs, and authorized retry behavior |
| Safety routing | Current stopping-rule state and safety-incident lineage | No unresolved high/critical study incident, or an explicit local critical alert | Authenticated clinical escalation, paging, evidence preservation, stop authority, acknowledgment, and restart workflow |
| Delivery queue | Durable outbox integrity and current retry/dead-letter states | No failed local package, or explicit operator-attention evidence | Transactional worker metrics, governed retries, dead-letter notification, remote-outcome reconciliation, and owner runbook |
| Artifact integrity | All current evidence families pass startup verification | Local report, workflow, study, recovery, rollback, and monitoring evidence is internally intact | Immutable signed event storage, report-object integrity checks, security correlation, and external owner notification |
| Restore readiness | Latest recovery event is verified for the **current** state schema | Current-schema isolated local restore evidence exists | Encrypted backup-job monitoring, isolated Azure restore, approved retention/RPO/RTO, and named acceptance |
| Rollback readiness | Latest compatibility event matches the **current** state schema and sealed manifest | Current local baseline remains compatible | Signed immutable build artifact, staged deployment rollback, production telemetry, reconciliation, and owner authority |
| Unauthorized access | Unavailable locally | Production gap remains open | Identity-provider and application access events, anomaly rules, security operations route, and retained investigation evidence |
| Backup jobs | Unavailable locally | Production gap remains open | Azure backup success/failure/freshness/retention metrics and escalation |
| External notifications | Unavailable locally | No page, email, ticket, or escalation is claimed | Authenticated notification channels, routing policy, delivery acknowledgment, deduplication, escalation, and testing |

## Event semantics

`POST /api/operations/monitoring/probe` records one hash-linked `point-in-time-control-probe` event. Every event contains:

- all eleven signals in the fixed inventory;
- status and severity for each signal;
- a bounded, non-sensitive detail string and evidence hash where local evidence exists;
- exact pass, attention, unavailable, and fail counts;
- local alert records for every local non-pass signal;
- the three open production gaps;
- hashes of the operational state and the complete integrity snapshot;
- actor, timestamps, elapsed time, and linked-event hash;
- explicit false values for continuous monitoring, production alerting, SLA/SLO claims, production backup monitoring, security monitoring, external notification delivery, and clinical release.

The overall local status is derived only from local signals:

- `local-controls-clear`: all eight local controls pass;
- `local-attention-required`: at least one local control needs attention and none fails;
- `local-control-failure`: at least one local control fails.

Production gaps remain open even when local controls are clear. “Clear” never means production-ready.

`GET /api/operations/monitoring` returns a fresh, unrecorded view of the current matrix plus the latest recorded event and monitoring-chain verification.

## Alert behavior

A local non-pass signal produces an immutable `open-local-evidence` alert entry. The entry deliberately records `externalNotificationSent: false`. A later probe may show that the underlying control is clear, but it never mutates or erases the earlier event.

The sandbox does not pretend to page a person. Production must define owners, severity mapping, routing, acknowledgment time, deduplication, escalation, evidence retention, and restart authority before alert delivery can be represented as connected.

## Freshness rule

Recovery and rollback evidence count as ready only when they match the current state schema. A migration therefore makes those controls require attention until the restore and compatibility rehearsals are run again. This prevents a valid rehearsal of an older persistence contract from silently appearing current.

## Integrity and export

`monitoringEvents` is a separate tamper-evident ledger. Startup fails closed when an event, signal, count, alert, claim boundary, timestamp, or hash is altered. The monitoring chain and exact events are included in `perl-synthetic-calibration-package/2.21`.

The published event schema is `schemas/operational-monitoring-event.schema.json`.

## Production acceptance gate

The local matrix is a minimum design and evidence pattern. Production monitoring remains incomplete until named engineering, security, clinical, privacy, and Azure-operations owners accept evidence for:

1. the authoritative signal and log data classification, including prohibited fields;
2. service, queue, model, report, attachment, identity, backup, and dependency telemetry;
3. predeclared availability, latency, freshness, and error objectives derived from business and clinical impact;
4. alert rules, severity, notification tree, acknowledgment, deduplication, escalation, and after-hours ownership;
5. synthetic transactions and representative failure injection for generation, safety routing, attachment, backup, and identity paths;
6. immutable evidence retention, correlation, dashboards, and investigation access;
7. tested stop/restart authority and incident-response integration;
8. staged Azure rollback and restore observability with full e-QPASS/report/queue reconciliation;
9. explicit evidence that monitoring payloads exclude PHI unless the approved data classification and trust boundary authorize it;
10. a signed pilot-readiness disposition. 

No local probe, green matrix, or hash-linked event substitutes for those production controls.
