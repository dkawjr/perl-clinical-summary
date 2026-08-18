# PERL Candidate Return Desk

## Decision

Package `perl-synthetic-calibration-package/2.38` adds contract `perl-manual-candidate-return/1.0` and schema 44. It implements the missing manual boundary in Dolores’s January 12, 2026 direction: choose exactly three AI engines, send the same test documents/data sets manually, receive their results, let live reviewers judge accuracy and usefulness, revise and retest, and automate into e-QPASS only later.

The desk completes only the **receive their results** step. It does not run a model or perform review.

## What the desk accepts

A return manifest may contain one through nine outputs. Every output must bind exactly to one current Candidate Trial envelope:

- run ID, candidate slot, synthetic case ID, and case fingerprint;
- current Candidate Trial protocol fingerprint;
- current complete-unverified candidate fingerprint, provider ID, and model version;
- exact prompt version;
- current generation output contract, policy version, and policy hash;
- `syntheticOnly: true` and the fixed unverified-manual-return status;
- four bounded audience narratives and the bounded interpretation structure.

The existing ten generation-output gates then validate schema exactness, audience shape, evidence fidelity, critical-screen handling, diagnostic restraint, and prohibited claims against the current synthetic assessment. The returned bundle is SHA-256 fingerprinted and written to an append-only, hash-linked ledger.

## Narrow boundary

PERL does not send the scored case through this route, call a candidate, configure a provider endpoint, or receive credentials. The return contract rejects raw provider responses, Findings content, source-file bytes, patient identifiers, counselor identities, endpoints, credentials, and PHI.

The desk deliberately does not render candidate prose. Its browser surface exposes only run state, receipt time, bundle hash, event hash, and chain state. Candidate authorship, answer keys, ratings, reviewer identities, and output comparison belong to a separately governed blind-review workflow.

A successful receipt means only: **this structured output matched a current synthetic envelope and passed the local output contract**. It does not verify that the named provider performed the run, establish accuracy, reliability, safety, usefulness, or clinical validity, authorize trial execution or blind review, select an engine, change care, start a pilot, release production, or permit patient use.

## Operator sequence

1. Complete the three-candidate metadata preflight in the Model Trial Bench.
2. Download `/api/calibration/candidate-returns/request.json`.
3. Run the frozen synthetic tests in the separately governed external environment.
4. Replace the prompt-version placeholder and `bundle: null` for one through nine envelopes. Do not add fields.
5. Select the completed JSON in the Candidate Return Desk and choose **Verify + seal return**.
6. Confirm that each accepted cell is shown as a sealed structural receipt. Do not infer model quality from receipt state.
7. Export the content-free desk evidence from `/api/calibration/candidate-returns.json`.

An identical replay is idempotent. A different bundle, provider/model binding, or prompt version for a current already-sealed envelope conflicts rather than overwriting history.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calibration/candidate-returns` | Return the content-free desk, nine envelope states, counts, history, fingerprints, chain, and authority boundary |
| `GET` | `/api/calibration/candidate-returns/request.json` | Download the current nine-envelope manual return kit |
| `POST` | `/api/calibration/candidate-returns/outputs` | Validate and immutably seal one through nine exact structured synthetic outputs |
| `GET` | `/api/calibration/candidate-returns.json` | Download the content-free desk evidence package |

The general HTTP JSON ceiling is 512 KB; this contract applies the stricter 256 KB manifest ceiling.

## Persistence and continuity

Schema 44 adds `candidateReturnEvents` as the forty-first integrity family. Startup revalidates the complete event shape, current assessment output contract, bundle hash, chain position, all false privacy/authority claims, and the event hash. Any persisted alteration fails startup closed.

Recovery reconciles the ledger and its count. Rollback baseline `2026.08.14.39` pins `candidate-return.css`, `src/candidate-return.js`, and `schemas/candidate-return-event.schema.json` alongside the updated application, server, API client, and store. Package export `2.38` includes the content-bearing candidate-return events only inside the explicitly synthetic study package; the browser desk and desk export remain content-free.

## Next governed build

Package 2.39 implements the separately governed [Candidate Blind Review Gallery](./CANDIDATE_BLIND_REVIEW_GALLERY.md). It consumes sealed current returns only after the accepted counselor-reference set, frozen protocol, content resolution, pre-outcome standard, and active study control are all current; generates balanced anonymous A–D packets; records fixed independent judgments, disagreement, and correction burden; and still withholds engine selection until evidence-led modification/retesting and the independent accuracy/reliability review are complete.
