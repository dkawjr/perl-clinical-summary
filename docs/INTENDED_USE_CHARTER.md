# PERL Intended Use Charter

Status: working charter, not accepted  
Contract: `perl-intended-use-charter/1.0`  
State schema: `sandbox-state/28`  
Package: `perl-synthetic-calibration-package/2.21`

## Decision this register supports

PERL needs a fixed job before its disclaimer, legal language, clinical evaluation, or pilot context can be approved. The July 2026 proposal describes a concise clinician-ready page derived from existing e-QPASS scored facts, placed beside the unchanged Findings report, and reviewed by qualified people. The register turns that proposal boundary into a versioned decision surface without pretending the necessary authorities have accepted it.

## Proposed provider-first use

PERL is proposed as a provider-first, post-scoring decision-support layer. It formats authoritative e-QPASS scored output into an evidence-linked additional page for accountable human review. Its primary audience is the clinician or counselor. Care coordination, payer/utilization, and operations/administration receive separate minimum-necessary formats from the same reviewed record when separately authorized.

The generated page supports preparation for and review of a care conversation. It may surface scored indicators, uncertainty, deterministic critical-screen routing, and questions a qualified clinician may consider. It does not score e-QPASS, replace Findings, diagnose, prescribe, determine level of care, resolve a crisis screen, or release itself into care.

## Bounded pilot contexts

Each working draft must choose exactly one proposed context:

1. Before the care conversation — a qualified clinician reviews the summary while preparing for the next conversation.
2. At the start of the session — a qualified clinician reviews scored signals and follow-up questions at the point of care.
3. After scoring, before clinical use — a completed scored assessment enters a held review queue before any summary can be used.

Choosing a context creates a draft only. It does not select a pilot site, recruit a provider, authorize a session, or permit patient use.

## Audience contract

| Order | Audience | Allowed purpose | Boundary |
|---|---|---|---|
| 01 | Clinician / counselor | Review evidence-linked indicators, uncertainty, critical-screen routing, and questions for the next conversation | Licensed judgment remains required; the summary does not diagnose or prescribe |
| 02 | Care coordination | See minimum-necessary coordination signals and follow-up status from the same reviewed record | No independent clinical interpretation or treatment direction |
| 03 | Payer / utilization | See a bounded utilization view of approved facts when separately authorized | No automated coverage, eligibility, or level-of-care decision |
| 04 | Operations / admin | See routing, completion, and workflow state | No scored-domain detail, clinical hypotheses, counselor-reference prose, or safety interpretation |

## Prohibited uses

The contract fixes eight prohibitions:

1. Diagnosis.
2. Prescription or treatment instruction.
3. Level-of-care determination, including placement, acuity, admission, discharge, or service level.
4. Emergency or crisis triage; deterministic critical screens route directly to human review.
5. Autonomous clinical release.
6. Replacement of the unchanged authoritative Findings report.
7. Automated adverse decisions about coverage, eligibility, access, or services.
8. Direct-to-consumer self-interpretation in the current scope.

## Fixed technical rails

- Source authority: authoritative e-QPASS scored output.
- Model projection: scoring-only; no identifiers, raw item responses, or Findings prose.
- Artifact relationship: one additional page beside unchanged Findings.
- Review: accountable human review is mandatory.
- Safety: critical screens use deterministic direct-review routing, never generated prose.
- Clinical action: no automated clinical decision is allowed.
- Current market: provider-first, not consumer-facing.

Every immutable draft pins the clinician-report contract, disclaimer draft, model-input contract, generation-policy version and hash, four audience formats, and current report-artifact, generation, readiness, and clinical-standard ledger heads.

## Required acceptances

Five decisions remain external to this repository:

1. Executive and product sponsor acceptance.
2. Licensed clinical lead approval.
3. Legal-owner approval, including the final intended-use and disclaimer language.
4. Privacy and security-owner approval.
5. e-QPASS owner acceptance of the source and attachment boundary.

The runtime deliberately has no control that can record any of these decisions. It can record only immutable working drafts with reviewer-code authorship.

## Integrity and API

`intendedUseDrafts` and `intendedUseEvents` form the twenty-fifth integrity family. Startup revalidates the fixed context, audience, prohibition, acceptance, evidence, false-authority, sequence, previous-hash, and event-hash contract. Altering a recorded draft, inventing approval, or changing a fixed rail prevents the store from opening.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/intended-use` | Current charter, contexts, audience and prohibition books, required acceptances, draft history, chain state, and false authority claims |
| `POST` | `/api/governance/intended-use/drafts` | Append one bounded working draft; cannot record an acceptance or approval |
| `GET` | `/api/governance/intended-use.json` | Download the current read-only charter register |

## Claim boundary

A local draft is not executive acceptance, clinical approval, legal advice or approval, privacy or security approval, e-QPASS owner acceptance, disclaimer approval, a frozen intended-use statement, clinical validation, pilot authorization, production release, or permission for patient use. Reviewer codes are local authorship labels, not credentials or signatures.
