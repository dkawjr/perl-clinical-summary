# PERL Language Review Office

Contract: `perl-language-review-packet/1.0`  
Introduced in state schema: `sandbox-state/29`  
Current state schema: `sandbox-state/37`  
Package: `perl-synthetic-calibration-package/2.21`

## Purpose

The Language Review Office turns Dolores’s January 2026 sequence—report design and legal disclaimer after the provider-side counselor-summary scope—into a reviewable product control. It assembles the exact working language already exposed by PERL, organizes the questions that clinical and counsel must decide, and seals an immutable packet for outside review.

The office does not approve its own words. A seal establishes what was presented for review; it does not establish that any accountable owner accepted it.

## Exact live copy corpus

Each packet pins nine surfaces from the current product contracts:

1. proposed provider-first intended use;
2. relationship to the unchanged Findings report;
3. upstream e-QPASS scoring authority;
4. generated-interpretation boundary;
5. clinician disclaimer;
6. deterministic critical-screen review boundary;
7. care-coordination disclosure and decision boundary;
8. payer/utilization disclosure and decision boundary;
9. administrative minimum-necessary boundary.

The corpus is generated from `src/intended-use.js`, `src/report-page.js`, and `src/audience-handoff-page.js`. It is not retyped into the interface. A SHA-256 corpus fingerprint covers the nine surfaces, six review questions, and five acceptance roles.

## Review brief

The fixed brief asks reviewers to decide:

1. whether diagnostic restraint is complete;
2. whether treatment authority remains human and external;
3. whether source and Findings authority are unmistakable;
4. whether critical-screen copy routes directly to accountable human review;
5. whether secondary-audience language remains minimum necessary;
6. whether purpose, limitations, review state, and responsibility are conspicuous and understandable.

## Outside acceptance register

Five decisions remain outside the local product:

1. executive and product sponsor acceptance;
2. licensed clinical-lead acceptance;
3. legal-owner approval;
4. privacy and security acceptance;
5. e-QPASS owner acceptance.

The local packet always records `acceptancesRecorded: 0`. Executive, clinical, legal, privacy/security, e-QPASS, disclaimer, freeze, validation, pilot, production, and patient-use fields are all hard-coded `false` in both the packet validator and published event schema.

## Integrity and persistence

`languageReviewPackets` stores the exact copy, review brief, acceptance register, intended-use reference, evidence snapshot, corpus fingerprint, author code, timestamp, and packet hash. `languageReviewEvents` forms the twenty-sixth SHA-256-linked integrity family. Startup rejects missing packets, reused packet IDs, changed source text, altered questions, invented authority, version gaps, event mismatches, or broken prior hashes.

Schema 29 migrates existing local state by adding empty language-review packet and event collections. Current package `2.21` exports the office, all packets, all events, and the chain summary.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/language-review` | Return current exact copy, review questions, outside acceptance register, packet history, evidence, chain state, and false authority claims |
| `POST` | `/api/governance/language-review/seal` | Seal the current corpus after an intended-use draft exists; cannot accept or approve language |
| `GET` | `/api/governance/language-review.json` | Download the current read-only review packet |
| `GET` | `/api/governance/language-review.html` | Open the responsive, Letter-ready clinical/counsel review book with exact copy, annotation worksheet, outside-acceptance record, and print/PDF action |

## Print review book

`perl-language-review-print/1.0` is an escaped HTML presentation of the current office. Its four-part, five-page structure contains a cover and evidence identity, a deliberately two-page nine-clause exact-copy proof, a six-question red-pencil worksheet, and a five-row outside-authority record. Dedicated Letter print CSS preserves color, page breaks, copy blocks, and annotation lines; the responsive path reflows the same content for smaller screens. Paper marks and PDF annotations remain outside PERL and do not create an acceptance.

## Claim boundary

A working seal is not clinical acceptance, legal advice or approval, privacy or security approval, e-QPASS owner acceptance, disclaimer approval, a language freeze, clinical validation, pilot authorization, production release, or permission for patient use. Reviewer codes are local authorship labels, not professional credentials or signatures.

## Production replacement

Before a pilot, replace the local false-only acceptance register with authenticated, named, role-bound decisions. Preserve exact accepted wording, document and contract versions, reviewer scope, conditions, expiry and revocation, trusted time, and the relationship between intended use and final disclaimer. Clinical and counsel changes must create a new packet version rather than altering a prior seal.
