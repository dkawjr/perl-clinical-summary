# PERL model gateway contract

## Decision

PERL now has a model-agnostic structured generation gateway. The active application remains on the deterministic engineering baseline. No external provider is configured, no data is transmitted, and no provider is approved for PHI.

Package `2.26` also adds the startup-controlled [HTTPS Model Transport Bridge](./MODEL_TRANSPORT_BRIDGE.md). It turns the earlier injected-function seam into one executable, authenticated HTTPS candidate path while retaining synthetic-only authorization, strict byte/time bounds, zero retry or fallback, endpoint and credential exclusion, and the existing clinical output gate.

The gateway exists so Focused Future can evaluate a real candidate without changing the clinical, privacy, evidence, or audit contract. It is not a shortcut around provider selection, legal review, security approval, counselor calibration, or independent validation.

## Runtime contracts

| Layer | Version | Purpose |
|---|---|---|
| Provider request | `perl-structured-generation-request/0.1` | Sends the static policy plus a scoring-only profile |
| Model input | `perl-scored-profile/1.0` | Contains 105-item completion, scored scales, source levels, subscales, and bounded critical flags |
| Model output | `perl-generation-bundle/1.0` | Requires four audience narratives plus evidence-linked hypotheses and questions |
| Clinical policy | `perl-clinical-generation-policy/1.0` | Pins restraint, safety, evidence, audience, and schema instructions |
| HTTPS bridge | `perl-https-model-transport/1.0` | Carries one bounded request to a startup-approved candidate endpoint |
| Transport policy | `perl-model-transport-policy/1.0` | Pins endpoint fingerprint, synthetic scope, candidate versions, timeout, request limit, and secret source |
| Snapshot ledger | introduced in state schema 14; retained in current schema 42 | Materializes one active generation per assessment and links every record to its input/output hashes |

The request schema is [model-generation-request.schema.json](../schemas/model-generation-request.schema.json). It has no tenant, subject, assessment, report, correlation, reviewer, demographic, examiner, raw-response, Findings-PDF, or contact field. `requestId` is a new ephemeral invocation UUID; it is not derived from a person or source record.

The raw provider response is [model-generation-response.schema.json](../schemas/model-generation-response.schema.json). Provider-supplied identity, model version, and prompt version are not trusted. The gateway stamps the configured values after validation.

## Output gates

Before a candidate response can become reviewable, PERL independently requires:

1. exactly four narratives: clinician, care coordination, payer, and administrative;
2. no undeclared fields or direct-identifier field names;
3. bounded length and no diagnostic-certainty language;
4. an explicit self-report and non-diagnostic frame in every applicable narrative;
5. direct review language and a follow-up question when the deterministic critical-screen rule is active;
6. one to six structured hypotheses and one to eight questions;
7. exact evidence-token resolution against the scored profile;
8. an administrative note without scored domains or subscales and with an explicit authorization boundary;
9. a maximum 64 KB structured response;
10. configured provider, model, prompt, policy, input-schema, and output-schema provenance.

Any failure returns `MODEL_OUTPUT_REJECTED`, `MODEL_TIMEOUT`, or `MODEL_UNAVAILABLE`. PERL does not replace the failed candidate with deterministic prose. This keeps failure visible and prevents a reviewer from unknowingly approving output from a different engine.

## Materialized review snapshots

Opening a record no longer regenerates its draft. At intake, PERL:

1. creates the scoring-only projection;
2. generates and validates one complete bundle;
3. hashes the input and normalized output;
4. records provider, model, prompt, policy, and schema versions;
5. stores the immutable generation record;
6. appends a hash-linked generation event; and
7. marks that record active for the assessment.

Reviewer edits remain separate revisions layered over the generated snapshot. Approval captures the exact current content in the existing immutable report-artifact ledger. This separates model output, human modification, and approved attachment evidence.

Schema-v14 migration materializes a fresh deterministic snapshot for each existing synthetic assessment and labels it `migration-materialized`. The event explicitly does not claim to recover the identity of any draft displayed before migration.

## Candidate activation

The normal server path constructs only `DeterministicSummaryProvider`. A candidate cannot be enabled by an endpoint URL or API-key environment variable alone. A test harness may still inject a transport directly. The executable bridge requires an owner-only `PERL_MODEL_TRANSPORT_POLICY_FILE`, a current strict policy, and the opaque credential named by that policy in a dedicated startup environment variable. Application bootstrap then constructs the same structured candidate provider with:

- a transport function;
- `status: approved-for-synthetic-calibration`;
- a bounded provider ID;
- an exact model version;
- an exact prompt version;
- an approving governance identifier; and
- a timeout between 500 and 30,000 milliseconds.

Even then, the runtime reports `approvalScope: synthetic-calibration-only`, `phiApproved: false`, and `clinicalValidation: false`.

## Provider-selection evidence still required

The Calibration view now exposes this same standard through `perl-model-trial-preflight/1.0`. It fixes exactly three candidate lanes and turns the six rows below into ordered evidence-reference domains. The request contains descriptions only: no credentials, endpoints, evidence files, model output, assessment content, raw responses, Findings content, identifiers, or PHI. A complete request remains unverified, performs no provider call, and cannot select or activate a candidate. See [MODEL_TRIAL_BENCH.md](./MODEL_TRIAL_BENCH.md).

`perl-candidate-trial-protocol/1.0` consumes only that shortlist state and current local fingerprints to build the next coordinator artifact: nine held candidate run envelopes, twelve balanced blind cells, six ordered measures, and seven permission gates. It does not call this gateway and cannot pass a payload to it. A future authorized synthetic runner must resolve each envelope through a separately injected `approved-for-synthetic-calibration` transport, preserve the fixed contracts below, and commit output to a new immutable candidate-outcome ledger. See [CANDIDATE_TRIAL_FOUNDRY.md](./CANDIDATE_TRIAL_FOUNDRY.md).

| Evidence | Minimum decision record |
|---|---|
| Privacy and use terms | Data retention, training use, subprocessors, region, deletion, incident notice, and BAA position |
| Security architecture | Private networking, service identity, secrets, encryption, logs, monitoring, and access review |
| Technical behavior | Exact structured-output support, timeouts, rate limits, idempotency, version pinning, and deprecation policy |
| Clinical performance | Frozen representative cases, independent paired review, error taxonomy, safety outcomes, and correction burden |
| Operational behavior | Latency, availability, cost per completed report, retry policy, fallback prohibition, and rollback plan |
| Governance | Named owner, approved prompt, model-change notification, regression gate, and signed disposition |

No vendor should be selected on prose preference alone. A candidate advances only through the existing frozen replay and independent clinical-review path.
