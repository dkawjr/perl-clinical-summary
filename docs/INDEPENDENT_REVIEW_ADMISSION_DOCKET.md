# PERL Independent Review Admission Docket

Contract: `perl-independent-review-admission-docket/1.0`  
Package: `perl-synthetic-calibration-package/2.36`  
State schema: `sandbox-state/42`

## Product decision

Dolores asked for a third-party accuracy and reliability review before release. The Independent Review Dossier packages the evidence an evaluator must inspect; the Counselor Reference Decision Docket can establish one accepted upstream reference freeze. Neither mechanism can admit the study itself.

The Independent Review Admission Docket closes that execution gap without letting PERL grade its own work. It verifies seven exact outside duties against one locally sealed dossier, one current counselor-reference freeze, and one current clinical-standard draft. A complete chain means only that the named independent evaluation protocol is ready to execute. There is deliberately no result-submission route in this surface.

## Three prerequisites

A challenge cannot be issued until all three current prerequisites are true:

1. the Independent Review Dossier has a valid chain, an exact current seal, and all four required local evidence patterns;
2. the Counselor Reference Decision Docket has a valid chain, a verified `reference-protocol-freeze`, and an independent-review handoff that is bound into that exact dossier; and
3. the Clinical Standard register has a current, valid working-draft hash.

Changing a dossier seal, counselor-reference decision, clinical-standard draft, or startup registry makes an older challenge stale.

## Seven separated duties

| Order | Signed purpose | Exact decision established |
|---|---|---|
| 1 | `authoritative-source-contract-acceptance` | The two authoritative workbook hashes, scored-event contract, scoring version, and Findings lifecycle are accepted |
| 2 | `representative-case-set-freeze` | The eligible inventory, strata, development partition, unseen holdout, and holdout-access policy are frozen |
| 3 | `clinical-standard-acceptance` | The exact clinical-standard draft, analysis plan, measure definitions, pre-outcome status, and zero-tolerance safety rules are accepted |
| 4 | `evaluator-charter-attestation` | Evaluator authority, qualifications, conflicts, independence, and the exact charter are attested |
| 5 | `legal-permission-attestation` | The exact study protocol and evidence-use boundary have legal permission |
| 6 | `privacy-permission-attestation` | Data minimization, access, retention, deletion, and privacy scope are permitted |
| 7 | `independent-review-protocol-freeze` | The six prior attestation fingerprints, evaluator handoff, case set, analysis plan, and final protocol are frozen together |

The order is part of the contract. Each purpose requires its own distinct Ed25519 key. Skipped duties, reused key material, repeated attestation IDs, repeated signatures, mismatched purposes, stale evidence, and out-of-window returns fail closed.

## Exact 24-hour challenge

Every challenge binds:

- the Independent Review Dossier fingerprint, review-package hash, and dossier-chain head;
- the Counselor Reference Decision Docket fingerprint and chain head;
- the exact `reference-protocol-freeze` attestation fingerprint;
- the current Clinical Standard draft hash;
- the startup registry fingerprint;
- all seven duties in fixed order;
- the decision mode `admit-exact-independent-evaluation-protocol-no-results`; and
- a server-generated 256-bit nonce.

The challenge expires exactly 24 hours after issuance. The server revalidates every binding before committing each returned duty.

## Startup trust ceremony

The default registry is disabled. Accountable owners must provision an owner-only JSON file outside PERL and pass its path only at startup through `PERL_INDEPENDENT_REVIEW_ADMISSION_REGISTRY_FILE`.

The registry must:

- use `perl-independent-review-admission-registry/1.0`;
- contain seven distinct Ed25519 SPKI public keys, exactly one for each purpose;
- keep every key-validity window inside the registry-validity window;
- remain at or below 256 KB; and
- be a regular owner-only file with mode `0600`.

Startup fails closed for a malformed, stale, oversized, incorrectly permissioned, non-regular, incomplete, or key-reusing registry. PERL publishes a placeholder registry template, but exposes no registry-write, private-key, or signing API.

## Returned metadata boundary

Each attestation is capped at 64 KB and contains identifiers, hashes, bounded decisions, validity timestamps, and one Ed25519 signature. It cannot contain:

- evidence files or workbook bytes;
- human names or signature images;
- credentials, secrets, case records, Findings content, or raw responses;
- patient records or PHI; or
- a claim that PERL transmitted the evidence externally.

Signature verification covers canonical JSON with the `signature` field removed. The durable event stores the bounded attestation, its fingerprint, the trusted public-key fingerprint, the exact claims enabled by that duty, and the immutable chain link.

## Authority ceiling

After all seven valid returns, only these fields may become true:

- `sourceContractsAccepted`;
- `caseSetFrozen`;
- `clinicalStandardAccepted`;
- `evaluatorCharterVerified`;
- `legalPermissionVerified`;
- `privacyPermissionVerified`;
- `independentReviewProtocolFrozen`; and
- `independentReviewExecutionReady`.

These fields remain structurally false:

- `independentReviewComplete`;
- `accuracyEstablished`;
- `reliabilityEstablished`;
- `clinicalValidation`;
- `pilotAuthorized`;
- `productionReleaseAuthorized`; and
- `patientUseAuthorized`.

The absence of a result-submission API is intentional. The independent evaluator’s results, limitations, denominator, agreement, correction burden, and signed disposition must enter through a separately governed result contract after the study has actually run.

## Persistence and tamper behavior

`independentReviewAdmissionEvents` is the thirty-ninth integrity family. Schema 42 stores challenge and verified-attestation events. Startup reconstructs the chain, revalidates exact keys, challenges, signatures, sequence, prior attestations, claims, content boundaries, and hashes, and fails closed on tampering.

Package `2.36` exports the current docket, exact events, chain summary, and evidence bindings. It excludes private keys, source files, case content, results, patient records, and PHI.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calibration/independent-review/admission` | Return the current docket, prerequisite state, registry summary, duties, history, chain, and authority ceiling |
| `GET` | `/api/calibration/independent-review/admission.json` | Download the current bounded docket |
| `GET` | `/api/calibration/independent-review/admission/registry-template.json` | Download the placeholder-only owner provisioning shape |
| `POST` | `/api/calibration/independent-review/admission/challenges` | Issue or idempotently return the exact current challenge after all prerequisites and seven active keys exist |
| `GET` | `/api/calibration/independent-review/admission/challenges/:challengeId.json` | Download an existing challenge |
| `POST` | `/api/calibration/independent-review/admission/attestations/verify` | Verify and immutably commit only the next valid signed duty |

## Evaluation Chamber interface

The Calibration view now treats independent review as an editorial evidence chamber rather than another operational dashboard. Its six-cell proof register separates local evidence, upstream decisions, admission duties, synthetic cases, blind comparisons, and the still-unrun evaluation result. Six review questions, controlled inputs, the three-prerequisite admission rail, seven-key duty register, signed-return desk, immutable chain identifiers, and an oxblood authority ceiling remain visible together.

The design uses Focused Future’s forest, paper, restrained gold, and oxblood palette with serif editorial hierarchy, compact monospaced evidence labels, subtle rules, and no ornamental “AI” gradients. Native links, buttons, and file input controls retain visible focus and 48-pixel targets. At 390 by 844 CSS pixels the chamber has no horizontal overflow, the proof register resolves to two columns, admission content follows one source-ordered column, and no visible chamber text falls below 9 pixels. Browser diagnostics report no warnings or errors. Evidence is pinned in `qa/evaluation-chamber-*.png`.

## External work still required

Accountable owners must still establish signer identity, qualifications, delegation, conflicts, hardware-backed key custody, rotation and revocation, trusted time, approved evidence access, and an authorized return channel. The independent evaluator must then execute the frozen protocol, preserve the holdout boundary, analyze the predeclared measures, document limitations and dissent, and return a governed result. Nothing in this docket starts a trial, sends data, establishes performance, deploys PERL, opens clinical traffic, or permits patient use.
