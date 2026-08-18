# PERL Model Trial Bench

## Decision

Dolores’s January 12, 2026 direction requires the team to identify AI engines, test them with live reviewers, and leave the engine-selection meeting with three candidates. Her August 13, 2026 note repeats that the provider-side counselor summary is the important near-term add-on and that counselors are available for review and training.

PERL now implements `perl-model-trial-preflight/1.0`: a metadata-only shortlist preflight for exactly three AI-engine candidates against exactly six shared evidence domains. It makes the next decision inspectable without pretending that vendors, models, evidence, security, privacy, clinical performance, or the final engine have been approved.

## Fixed evidence standard

Every candidate must declare evidence references for the same six domains:

| Domain | Decision question | Governed evidence expected later |
|---|---|---|
| Privacy + use terms | What happens to data after the request ends? | Retention/deletion, training use, subprocessors, region, incident notice, and BAA position |
| Security architecture | Can the provider seam live inside the approved e-QPASS control boundary? | Private networking, service identity, secrets, encryption, access review, logs, monitoring, and data flow |
| Technical behavior | Can exact structured output remain versioned, bounded, and fail-closed? | Structured-output contract, timeout/rate/idempotency behavior, version pinning, deprecation, and change notice |
| Clinical evaluation | Does the candidate earn counselor trust on a frozen representative set? | Blind paired review, safety/error taxonomy, correction burden, and reviewer agreement |
| Operational fit | Can the engine support a dependable provider workflow at a defensible cost? | Latency, availability, cost per completed report, retry, no-fallback, and rollback behavior |
| Governance + change control | Who can approve the model, prompt, and every future change? | Named owner, approved prompt/policy, regression gate, and signed disposition |

There is no locally calculated winner, weighted score, ranking, or recommendation. Missing evidence remains visible as missing. A complete declaration remains `metadata-complete-unverified` and produces `engine-selection-not-authorized`.

## Metadata request

`GET /api/calibration/model-trial/request.json` downloads the strict request template. It contains:

- one visibly synthetic trial ID;
- three ordered candidate slots;
- bounded provider and model identifiers;
- one deployment pattern and region per declared candidate;
- six ordered evidence-reference records per candidate;
- nineteen claim-denial flags fixed to `false`.

Evidence references must use bounded `FF-EVIDENCE-*` identifiers. They identify material that must be inspected through an approved channel; they do not upload, verify, or accept the material.

The request rejects unknown fields, reordered or missing slots/domains, authority claims, unsafe identifiers, inconsistent declared/empty states, and payloads larger than 64 KB.

## Privacy and authority boundary

The bench accepts no credentials, API keys, endpoint URLs, files, file bytes, model output, assessment records, raw responses, patient identifiers, Findings content, or PHI. It performs no provider call and no external transfer.

Every request and durable preflight fixes these claims to `false`:

- credentials, endpoints, file bytes, model output, record-level data, patient identifiers, raw responses, and PHI received;
- external transfer performed;
- vendor claims verified;
- security or privacy approved;
- clinical performance established;
- independent review complete;
- engine selected;
- PHI approved;
- pilot, production release, or patient use authorized.

The deterministic rules provider appears only as the current engineering comparator. It is explicitly `comparator-not-shortlist-candidate` and cannot silently occupy one of the three decision slots.

## Integrity and API

State schema 26 adds `modelTrialEvents`, the twenty-third integrity family. Each event records:

- exact sequence and previous hash;
- request, manifest, trial-ID, evidence-state, and candidate fingerprints;
- the three metadata snapshots and derived results;
- exact three-candidate and eighteen-domain-reference counts;
- current synthetic case-set, generation-chain, generation-policy, output-gate, and baseline-provider provenance;
- actor and timestamp;
- all claim-denial fields and the non-authorizing decision;
- a canonical SHA-256 event hash.

Startup validates the complete chain and fails closed if a snapshot, result, count, claim, evidence reference, provenance field, or hash changes. Package `perl-synthetic-calibration-package/2.21` exports the bench, exact events, and chain state.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/calibration/model-trial` | Current bench, candidates, domains, counts, history, chain, baseline, and boundary |
| `GET` | `/api/calibration/model-trial/request.json` | Download the empty strict candidate request |
| `POST` | `/api/calibration/model-trial/preflight` | Validate and append one metadata-only preflight event |
| `GET` | `/api/calibration/model-trial.json` | Download the current bench and preflight history |

## Required external selection process

The local bench is only the front door. A real engine decision still requires:

1. Dolores and the accountable product/engineering owners name the three candidates and intended-use constraints.
2. Legal, privacy, security, and e-QPASS owners inspect the governed vendor evidence and deployment architecture.
3. Engineering runs the same frozen scored-input, structured-output, failure, regression, latency, and cost protocol for each candidate.
4. The clinical lead and qualified counselor panel complete the predeclared blind evaluation on an approved representative case set.
5. An independent evaluator reviews accuracy, reliability, restraint, safety, and reproducibility on the governed holdout.
6. Named owners record the selected provider/model/version, conditions, scope, expiry/review date, and rollback path in an authenticated decision system.
7. The provider remains blocked from PHI, a pilot, production, and patient use until the separate Permission Ledger and production controls are accepted.

This preserves Dolores’s “walk away with three” requirement as a disciplined selection process while keeping the synthetic sandbox truthful about what has—and has not—happened.
