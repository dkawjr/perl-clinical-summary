# PERL marketability map

## Purpose

Dolores's correspondence asks for more than a working prototype. She needs a credible path from MVP to a marketable provider product, an ownership model Mike can coordinate, and evidence she can discuss with builders, investors, and university partners without overstating readiness.

`perl-marketability-map/1.0` turns the launch-readiness plan and the live Permission Ledger into one executive planning view. It does not create a parallel source of truth. Every current-state number is derived from the same fourteen readiness gates and ten-role authority register used by the pilot-readiness dossier.

## Four-phase runway

| Phase | Working window | Outcome | Exit authority |
|---|---|---|---|
| Product proof | Working now | Counselor-facing Findings summary, human review/editing, safety gate, governed report, and disabled handoff rehearsal | Local evidence only; no clinical acceptance |
| Contract and calibration | Weeks 0–8 | Named team, intended use, authoritative e-QPASS contract, counselor calibration, and independent reliability review | Clinical and independent stop/revise/prepare recommendation |
| Production foundation | Weeks 7–12 | Authenticated Azure/e-QPASS integration, security, recovery, rollback, monitoring, incident response, and accessible delivery | Named production owners accept end-to-end evidence |
| Named-site pilot | Weeks 12–14 | Accepted release package, training, support, legal terms, and bounded site scope | Named decision group authorizes identified sites only |

The fourteen-week window begins only after named owners, an approved data path, and the counselor panel are available. It is directional, overlaps where the launch plan permits, and stops when required evidence or authority is missing. The vendor's shorter build estimate remains a product-build estimate, not a clinical, security, or pilot-readiness claim.

## API

`GET /api/governance/marketability` returns:

- the fixed four-phase contract;
- the current seven-local/seven-external evidence snapshot;
- owner gaps resolved against the fixed authority register;
- the immediate decisions that open the planning clock;
- explicit false values for marketability, production-readiness, and pilot-authorization claims; and
- the provider-first boundary that defers consumer PERL.

The endpoint is read-only. It cannot ingest approval, assign an owner, start a calendar commitment, or authorize a pilot.

## Claim boundary

The marketability map is an evidence-gated planning view derived from local synthetic evidence and source correspondence. It is not a delivery-date commitment, funding representation, external approval, production-readiness claim, clinical-validity claim, pilot authorization, or authorization to use PHI.
