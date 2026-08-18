# Candidate Trial Foundry

Contract: `perl-candidate-trial-protocol/1.0`  
State schema: 27  
Current package: `perl-synthetic-calibration-package/2.21`

## Why it exists

Dolores’s January 12, 2026 direction describes a sequence, not merely a shortlist:

1. identify three AI engines;
2. test them on common documents;
3. engage live reviewers for accuracy and feedback;
4. modify and retest;
5. automate only after the evidence supports the choice.

The Model Trial Bench implements the first step as a strict metadata preflight. The Candidate Trial Foundry implements the missing bridge between that shortlist and a governed reviewer study. It creates an executable control artifact without pretending that a provider, counselor panel, or trial has already been authorized.

## Fixed design

The protocol fixes:

- exactly three candidate arms;
- exactly three fingerprinted synthetic cases from the frozen engineering-rehearsal set;
- nine held candidate run envelopes;
- one held counselor-reference arm for each case;
- four balanced blind positions per case, producing twelve blinded review cells;
- six ordered measures: evidence fidelity, critical-screen handling, clinical restraint, conversation usefulness, correction burden, and reviewer agreement;
- seven readiness gates that remain separate from outcome evidence.

The run envelopes contain case fingerprints, candidate-slot IDs, input/output contract versions, and policy provenance. They contain no scored payload, report, Findings content, raw response, output, reviewer identity, file, or PHI. Every run remains `held-awaiting-authorized-candidate-transport`.

The blinding schedule rotates all four arms across positions A–D. The coordinator export contains the structural mapping needed to build future packets, but no artifact content and no reviewer packet. A production trial must separate coordinator allocation from reviewer presentation and enforce concealment outside this local sandbox.

## Seven gates

| Gate | Local representation | What must happen outside PERL |
|---|---|---|
| Three-candidate shortlist | Reads complete-unverified Model Trial metadata count | Product and engineering inspect governed candidate evidence |
| Frozen synthetic case set | Pins three local fixture/reference/manifest fingerprints | Evaluation owner accepts a representative scoped set |
| Fixed input + output contract | Pins scoring-only input, generation contract, policy hash, and ten gates | Engineering signs the candidate adapter and replay plan |
| Pre-outcome clinical standard | Detects an immutable local working draft | Named clinical lead accepts the rubric before outcomes |
| Authorized candidate transports | Always zero here | Security, privacy, and engineering approve and inject three synthetic transports |
| Named counselor panel | Always zero here | Clinical lead returns roster, qualifications, role, and controlled identities |
| Trial execution authority | Always false here | Named product, clinical, security/privacy, and engineering owners authorize the exact scoped run |

Local structural readiness never collapses these external permissions. Three complete candidate descriptions can move the surface to `pre-execution-authority-required`; they cannot make a run executable.

## Planning ledger

`candidateTrialEvents` is the twenty-fourth integrity family. `POST /api/calibration/candidate-trial/snapshot` records:

- protocol fingerprint;
- exact 9/12/6/7 counts;
- the current state and explanation of every gate;
- Model Trial, case-set, generation, clinical-standard, and transport/panel evidence state;
- every denied content, authority, clinical, selection, pilot, production, and patient-use claim;
- actor, timestamp, previous hash, and event hash.

Startup recomputes gate semantics and counts, validates every denied claim, and fails closed on sequence, prior hash, evidence, or event-hash tampering. A planning snapshot preserves what is incomplete; it does not freeze or authorize a clinical protocol.

## API

- `GET /api/calibration/candidate-trial` — live foundry state
- `POST /api/calibration/candidate-trial/snapshot` — append a non-authorizing planning snapshot
- `GET /api/calibration/candidate-trial.json` — download the coordinator protocol artifact
- `GET /api/health` — exposes the contract and explicit false execution/content claims
- `GET /api/calibration/export.json` — includes the foundry, exact events, and chain summary

## Required production replacement

Before an actual candidate request, the external owner group must provide governed vendor evidence, approved data-flow and retention terms, three injected transports restricted to the approved synthetic set, service identities and secrets management, timeout/rate-limit/idempotency behavior, version pinning, logging and cost controls, a signed clinical standard, a credentialed panel roster, reviewer assignment and concealment controls, statistical analysis and stopping rules, incident ownership, and a signed scoped execution authorization.

Candidate outputs must enter a new immutable outcome ledger and pass the existing structured-output and safety gates. They must not be inferred from this plan, placed in the planning event, or used to claim accuracy, reliability, clinical validity, engine selection, pilot readiness, production readiness, or patient use.

## Claim boundary

This is a synthetic planning and evidence-control surface. It performs no provider call or external transfer and receives no credentials, endpoints, transport configuration, assessment payloads, raw responses, Findings content, model output, reviewer identities, records, files, identifiers, or PHI. It does not verify vendors, authorize transports or a trial, credential or convene counselors, establish performance or safety, select an engine, change care, approve privacy/security, or authorize pilot, production, or patient use.
