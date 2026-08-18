# PERL Findings-to-Summary Automation Atelier

Package `perl-synthetic-calibration-package/2.44` adds `perl-findings-summary-integration-rehearsal/1.0` without changing state schema 49 or adding a new evidence ledger. The observatory is a privacy-minimized, point-in-time projection across PERL’s existing source, generation, report, workflow, attachment, delivery, and candidate-advancement chains.

It closes a practical product gap in Dolores’s January 12, 2026 direction: “Build automation to send current Findings report to AI and have AI send back the summary report.” The implementation rehearses the structured-data version of that workflow while preserving the proposal’s additional-page design and required clinician decision.

## What an operator can do

From Governance → e-QPASS seam, **Start synthetic run** creates a unique canonical 105-item calibration event. The strict adapter accepts the scored event, projects only source-supplied constructs to the loaded generation engine, validates and materializes the structured output, and queues the resulting draft for clinical review.

The Automation Atelier then shows one six-stage evidence line:

1. **Findings scored** — proposed source receipt verified; no PDF bytes enter PERL.
2. **Summary generated** — immutable generation provenance and structured-output gate verified.
3. **Clinician decision** — deliberately waiting until a human approves the exact draft.
4. **Extra page committed** — the approved clinician artifact is versioned and source-bound.
5. **Handoff prepared** — the idempotent additional-page manifest is committed automatically.
6. **Write boundary** — the package is held locally by default, or receives only a strict synthetic no-write acknowledgement from an explicitly injected connector.

The recent-run ledger opens the exact synthetic clinical record so a reviewer can complete the required decision. Approval remains governed by the existing safety acknowledgement, language, clinical-brief, report-content, and active-study gates.

## Exact candidate binding

Every run compares its materialized generation descriptor with the candidate disclosed by the Exact Candidate Advancement Airlock. The comparison is exact across:

- provider ID;
- model version;
- prompt version;
- output contract;
- policy version; and
- policy hash.

The visible binding verdict is one of:

- `deterministic-baseline` — local workflow proof only;
- `candidate-not-advanced` — no exact external advancement freeze exists;
- `candidate-unbound` — a structured candidate ran without that freeze;
- `exact-candidate-match` — all six fields match the exact advanced candidate; or
- `exact-candidate-mismatch` — the run is placed in attention and cannot masquerade as the advanced candidate.

Even an exact match does not authorize candidate transport, provider-wide approval, a pilot, deployment, production release, patient records, or patient use.

## API and schema

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/integration/rehearsal` | Return the privacy-minimized cross-ledger observatory and recent runs |
| `POST` | `/api/integration/rehearsal/runs` | Create and import one unique canonical synthetic scored event, materialize its summary, and return the new waiting-for-review run |

The published response contract is [integration-rehearsal-observatory.schema.json](../schemas/integration-rehearsal-observatory.schema.json). It fixes all six stages, exact binding fields, allowed run states, evidence fingerprints, and the denied authority claims.

## Privacy and authority ceiling

The observatory returns synthetic assessment references, stage state, bounded provider/version metadata, hashes, and timestamps. It does not return a Findings PDF, raw answers, routing references, subject references, report references, generated prose, credentials, endpoints, patient identifiers, or PHI.

`clinicalDecisionAutomated`, `findingsPdfIngested`, `remoteWriteClaimed`, and `candidateTransportAuthorized` are contractually false. The scored-event contract remains `proposed-rfi-only`. Production still requires the authoritative e-QPASS event and supersession contract, private authenticated transport, approved provider/model policy, production PDF merge and attachment acknowledgement, identity/RBAC, telemetry, recovery, incident response, and named clinical, product, legal, privacy/security, accessibility, and e-QPASS authority.

## Verification

The package adds unit and API coverage for unique strict event construction, six-stage projection, exact-match and mismatch behavior, deterministic-baseline labeling, prose exclusion, default no-write behavior, schema invariants, and the clinician-review pause. The interface is separately checked for keyboard-native controls, focus treatment, minimum 44-pixel actions, accessible live regions, and responsive reflow at phone, tablet, and desktop widths.
