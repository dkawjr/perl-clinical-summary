# e-QPASS Owner Return Desk

## Decision

PERL now turns the most important outstanding integration request into an executable, privacy-minimized handoff. Contract `perl-eqpass-owner-return-preflight/1.0` names the eight artifacts Mike and the accountable e-QPASS owners need to return before the proposed adapter can become an authoritative production interface.

The desk accepts **metadata only**. It does not upload, copy, parse, or retain either workbook, source records, raw answers, patient identifiers, Findings content, or PHI. A complete checklist is still an unverified candidate return. The RFI remains open until named owners inspect the governed source artifacts and sign the production contract.

## Fixed return set

| # | Expected artifact | Purpose | Accountable roles |
|---|---|---|---|
| 01 | `meta_thresholds_responses_cs.xlsx` | Source-owned thresholds and fixed-response behavior | Program integration, e-QPASS, clinical |
| 02 | `question_categories_capitalized.xlsx` | Authoritative question-to-construct map and production labels | Program integration, e-QPASS, clinical |
| 03 | `eqpass-authoritative-scored-event.deidentified.json` | Governed de-identified source-event candidate | e-QPASS, security/privacy |
| 04 | `eqpass-field-dictionary.json` | Scores, levels, subscales, critical flags, routing references, and null rules | e-QPASS, clinical |
| 05 | `eqpass-scoring-version-manifest.json` | Formulas, severity bands, GPI authority, item inventory, and instrument version | e-QPASS, clinical |
| 06 | `eqpass-report-lifecycle.json` | Finalized, reprinted, rescored, superseded, and failed Findings states | e-QPASS, engineering |
| 07 | `eqpass-pdf-attachment-interface.json` | Authenticated merge, acknowledgment, idempotency, and supersession | e-QPASS, engineering |
| 08 | `eqpass-security-data-flow.json` | Field classification plus Azure, identity, retention, logging, backup, and model boundaries | Security/privacy, e-QPASS |

The filenames are deliberate. The first two preserve the exact workbook names in Dolores's October 2025 correspondence rather than silently substituting similarly named local exports.

## Metadata manifest

`GET /api/integration/owner-return/request.json` downloads a strict template. Its only accepted environment is `calibration`, and its authority state is fixed to `unverified-candidate`.

For each artifact, the return may declare only:

- fixed artifact ID;
- `not-supplied` or `metadata-declared-unverified` status;
- safe filename;
- candidate version, SHA-256 digest, media type, and bounded data class.

The ten privacy and authority flags must all remain `false`, including file-byte inclusion, record-level data, patient identifiers, raw responses, Findings content, external transfer, PHI approval, verified owner identity, accepted source contract, and production-integration authorization. Unknown fields, reordered artifact classes, unsafe filenames, invalid hashes, and authority claims are rejected.

The browser also limits the manifest itself to 64 KB. That interface constraint supplements—without replacing—the server's strict contract validation.

## Preflight evidence

`POST /api/integration/owner-return/preflight` records one `eqpass-owner-return-metadata-preflight-recorded` event in a dedicated hash-linked ledger. It persists:

- manifest and candidate-return fingerprints, never source bytes;
- filename, media-type, and data-class match results for the eight fixed artifact classes;
- exact declared, complete, missing, and workbook-match counts;
- `metadata-incomplete` or `metadata-complete-unverified` status;
- `rfi-remains-open` as the only decision;
- twelve false data, authority, integration, and clinical-use claims.

Startup verifies the event sequence, hashes, fixed result set, count semantics, status, decision, and every false claim. Changing one result or authority field causes the store to fail closed.

## API and operator surface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/integration/owner-return` | Fixed artifact register, latest preflight, counts, request fingerprint, chain status, and boundary |
| `GET` | `/api/integration/owner-return/request.json` | Download the metadata-only request template |
| `POST` | `/api/integration/owner-return/preflight` | Validate one metadata manifest and append non-authorizing evidence |

The Governance view presents the return as an editorial field desk: four status measures, eight numbered artifact cards, explicit no-content rules, native JSON selection, a 46-pixel preflight action, ledger state, request fingerprint, and the complete boundary. It never presents a file uploader for the underlying workbooks or source records.

## What this closes—and what it does not

This closes ambiguity about what must come back, who owns it, what can safely enter the local rehearsal, and how completeness can be recorded without borrowing authority.

It does **not** prove that any artifact exists, authenticate Mike or an e-QPASS owner, inspect workbook formulas, accept a field map, approve de-identification, establish scoring validity, connect Azure, perform a PDF attachment, establish backup or monitoring controls, authorize a pilot, or permit clinical use.

## Production replacement gate

Before replacing the proposed adapter, named clinical, e-QPASS, engineering, security/privacy, legal, and evaluation owners must:

1. exchange the governed artifacts through an approved transfer and quarantine path;
2. verify owner identity, provenance, versions, hashes, signatures, and change-control authority;
3. inspect the workbook formulas and question/category mapping against the deployed instrument;
4. approve minimum-necessary fields, de-identification, retention, logging, and prohibited-content rules;
5. freeze the authoritative scored-event, Findings lifecycle, and PDF attachment contracts;
6. verify source-supplied severity, critical-screen, rescoring, supersession, and idempotency behavior;
7. execute the representative de-identified integration and recovery tests inside the approved Azure boundary;
8. record signed acceptance, conditions, expiry, revocation, and the still-separate clinical, independent-review, and pilot decisions.

Until then, `proposed-rfi-only` remains the truthful adapter status.
