# PERL External Decision Exchange

State schema: `sandbox-state/34`  
Exchange contract: `perl-external-decision-exchange/1.0`  
Return contract: `perl-external-decision-return/rfi-1.0`  
Package: `perl-synthetic-calibration-package/2.21`

## Decision

The Permission Ledger identifies seven external gates, but a gate label alone is not an executable request. The Decision Exchange turns each gate into an exact working packet with a decision question, accountable roles, governed evidence references, a downloadable metadata-return template, and a two-page Letter-ready worksheet.

The exchange is intentionally an RFI and metadata-preflight surface. It does not transmit a request, receive evidence files, authenticate a person, verify identity or licensure, validate evidence, verify a signature or trusted time, accept a decision, close a readiness gate, or authorize clinical use.

## Seven packets

The packet order is locked one-to-one to the seven external readiness gates:

1. intended use and legal language;
2. authoritative e-QPASS contract;
3. counselor calibration acceptance;
4. independent reliability decision;
5. Azure security and privacy acceptance;
6. independent accessibility acceptance;
7. named-site pilot authorization.

Each request fingerprint binds the full packet definition, current readiness-state hash, schema/report/disclaimer versions, current intended-use and language-review evidence, frozen case-set identity, and the relevant integration, counselor, clinical-standard, independent-review, recovery, rollback, monitoring, and incident-response chain heads.

The fingerprint excludes generation time and the Decision Exchange ledger itself. That prevents a timestamp from making an otherwise unchanged request stale and prevents a newly recorded preflight from invalidating its own request.

## Metadata return

The strict JSON return is limited to 64 KB and accepts only:

- its contract, request fingerprint, gate, and visibly synthetic return reference;
- `not-recorded`, `accept`, `revise`, or `decline` as the outside decision preview;
- a visibly synthetic reference to the governed decision record and its declared time;
- the exact ordered authority-role register with synthetic identity references;
- the exact ordered evidence-requirement register with synthetic evidence references;
- fifteen trust-boundary flags, all fixed to `false`.

Unknown fields, stale request fingerprints, missing or reordered roles/evidence, malformed references, oversized input, and any affirmative trust claim fail closed. Identity and evidence references are hashed into the event; the local event does not retain names, credentials, files, records, Findings content, or PHI.

An untouched template records `metadata-incomplete`. A structurally complete declaration records `metadata-complete-unverified`. Neither state means the outside decision was accepted.

## Integrity and migration

Schema 30 adds `decisionExchangeEvents` as the twenty-seventh linked integrity family. Each event records sequence, prior hash, request fingerprint, gate, completeness, decision preview, reference fingerprints, timestamp, actor code, and the complete false-only authority boundary. Startup fails closed if sequence, link, semantics, claim flags, or event hash changes.

Schema 29 state migrates by adding an empty event collection. Package `2.21` exports the current exchange, every preflight event, and the chain summary. A later readiness or evidence change makes earlier returns visibly stale rather than silently carrying them forward.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/decision-exchange` | Return the current seven packets, counts, history, and chain |
| `GET` | `/api/governance/decision-exchange.json` | Download the complete read-only exchange |
| `GET` | `/api/governance/decision-exchange/:gateId/request.json` | Download the exact metadata-return template |
| `GET` | `/api/governance/decision-exchange/:gateId/request.html` | Open the escaped two-page working packet |
| `POST` | `/api/governance/decision-exchange/preflight` | Validate and seal metadata only; keep every authority and readiness decision external |

## Production replacement gate

A governed decision service must replace local preflight before any external gate can close. It requires authenticated role-bound identity, licensure/authority verification where applicable, governed evidence access and validation, cryptographic signatures, trusted timestamps, scope and conditions, dissent, expiry and revocation, separation of duties, immutable decision provenance, readiness-state binding, and named-site enforcement.

Until that trust layer exists, the Decision Exchange can make the ask precise and tamper-evident. It cannot make the answer authoritative.
