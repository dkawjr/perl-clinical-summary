# PERL report assembly proof

## Decision this artifact makes visible

The July 2026 proposal defines PERL as an additional clinician-ready page beside the existing four-page e-QPASS Findings report. The local product already renders the approved PERL page and commits a hash-bound preparation receipt, but those two facts did not make the promised five-page order visually inspectable.

`perl-report-assembly-proof/1.0` closes that presentation gap without crossing the production boundary. It renders a five-page Letter proof in the required order:

1. source-owned questionnaire-response leaf;
2. source-owned Emotional Temperature leaf;
3. source-owned scale and crisis-analysis leaf;
4. source-owned subscale-analysis leaf;
5. the approved synthetic PERL clinician-summary leaf.

Pages one through four are sealed placeholders. They reserve the exact page positions and display the source package version and digest, but they do not reproduce the private sample report or invent source content. Page five is derived from the same approved synthetic artifact referenced by the existing preparation receipt.

## Entry gate

The proof fails closed unless all of the following are true:

- the assessment has a visible `FF-TEST-*` synthetic identifier;
- a valid proposed e-QPASS source-event receipt exists;
- the clinician artifact is approved;
- the approved artifact hash matches the preparation receipt and report snapshot;
- a source Findings package digest and exact rendered PERL content digest exist;
- the handoff state is exactly `prepared-not-attached`; and
- the source contract remains `proposed-rfi-only`.

A draft, non-source record, mismatched artifact, missing digest, attached-state claim, or authoritative-contract claim is rejected.

## Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/assessments/:id/report-package.html` | Open the responsive five-page Letter assembly proof |
| `GET` | `/api/assessments/:id/report-package.json` | Download the metadata-only page order, exact lineage, false-claim fields, and proof fingerprint |

The Summary Review handoff card exposes the HTML proof only after the local workflow reaches `prepared-not-attached`.

## Claim boundary

The proof records all of these as false:

- source Findings content included;
- source pages modified by PERL;
- PDF merge performed;
- e-QPASS write performed;
- remote attachment performed;
- production validation complete;
- pilot authorization recorded;
- clinical release authorized; and
- patient use authorized.

Printing the QA proof prints four explicit placeholders and one approved synthetic PERL page. It does not create a clinical packet. Production still requires the authoritative e-QPASS PDF service, exact source-page bytes, authenticated reviewer identity, approved merge and supersession rules, remote acknowledgement, Azure controls, and accountable clinical, legal, privacy/security, product, and e-QPASS acceptance.
