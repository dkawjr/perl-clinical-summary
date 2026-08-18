# Governed Authority Trust Bridge

Contract: `perl-governed-authority-trust/1.0`  
Registry contract: `perl-authority-trust-registry/1.0`  
Challenge contract: `perl-governed-authority-challenge/1.0`  
Receipt contract: `perl-governed-authority-receipt/1.0`  
State schema: `sandbox-state/34`  
Integrity family: 31  
Package: `perl-synthetic-calibration-package/2.21`

## Decision

PERL may display an external admission fact as verified or accepted only after it validates a role- and candidate-scoped Ed25519 receipt against a trust registry supplied when the server starts. The browser, HTTP API, imported receipts, and persisted sandbox state have no path for creating, adding, editing, approving, or trusting a public key.

This is the first authenticated seam between the Named-Site Admission Dossier and a future decision service. It turns an externally signed decision into inspectable, replay-resistant metadata. It does not turn PERL into the identity provider, evidence repository, signature ceremony, agreement system, deployment authority, or clinical decision maker.

The design follows Dolores’s direction across the source record:

- the July 2025 production instruction requires defensible security and backup evidence, with live PERL ultimately inside the e-QPASS Azure/SOC 2 boundary;
- the October 2025 Mike handoff requires production, report, ecommerce, price, and timeline work to move in parallel rather than allowing presentation readiness to imply technical readiness;
- the March–April 2026 North Central path requires Dr. Brown and Provost approval, training and accepted objectives before use, a bounded August–May term, and quarterly review.

## Trust ceremony

1. An operator provisions an owner-only JSON registry outside PERL and starts the server with `PERL_AUTHORITY_TRUST_REGISTRY_FILE=/absolute/path/registry.json`.
2. Startup rejects a non-file, group- or world-readable mode, a file above 256 KB, malformed JSON, unknown fields, non-Ed25519 keys, duplicate IDs or key material, invalid windows, unknown candidates, or unknown scope grants.
3. PERL binds a fresh 256-bit nonce to one current candidate dossier, the complete site-admission portfolio, the exact registry fingerprint, all 36 ordered trust scopes, and an exact 24-hour window.
4. An external authority service returns a metadata-only receipt signed by a registry key granted to that candidate and every asserted scope.
5. PERL verifies the challenge, dossier and registry bindings; receipt and key windows; candidate and scope grants; strict content boundary; receipt-ID and signature replay; and the Ed25519 signature over canonical JSON.
6. A passing receipt enters the thirty-first hash-linked ledger. A failed receipt is not stored as verified evidence and advances nothing.

## The 36 scopes

The contract is complete and closed:

| Group | Count | Required outcome |
|---|---:|---|
| Authenticated site identity | 1 | `verified` |
| Executive, clinical, legal, security/privacy, and independent-evaluator authority | 5 | `verified` |
| Twelve Named-Site Admission evidence questions | 12 | `verified` |
| Seven external Permission Ledger gates | 7 | `accepted` |
| Ten Provider Activation returns | 10 | `accepted` |
| Bounded named-site pilot authorization | 1 | `accepted` |

An unknown scope fails. A scope outside the signing key’s grant fails. `rejected`, `declined`, or `revoked` remains visible as a blocking decision. Current assertions are derived only from non-expired receipts matching the current dossier and registry.

All 36 successful outcomes may derive `pilotAuthorizationRecorded: true` for the exact candidate. The same state still fixes `pilotStarted`, `productionReleaseAuthorized`, and `patientUseAuthorized` to `false`. Pilot start remains a later, separately controlled operation.

## Metadata boundary

The receipt contains governed reference hashes, not the underlying evidence. Eight exact flags must remain false:

- evidence files;
- human names;
- human or handwritten signatures;
- credentials or secrets;
- patient records;
- Findings content;
- PHI;
- transmission by PERL.

The bridge does not contact a site, inspect the underlying governed record, verify facts beyond the signed assertion, execute an agreement, conduct training, activate a provider, start a pilot, establish performance or outcomes, renew or expand a program, release production, authorize patient use, or make a care decision.

## Rotation and retention rule

The registry fingerprint is part of every challenge and receipt. A changed registry deliberately makes an outstanding challenge stale. Because startup re-verifies the complete receipt history, a production rotation procedure must preserve the exact historical registry material needed by the active sandbox history or perform a governed archive/migration before replacing it. Silent trust-root substitution is not supported.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/authority-trust` | Sanitized registry summary, candidate scope state, counts, history, and boundary |
| `GET` | `/api/governance/authority-trust.json` | Download the current metadata-only bridge state |
| `GET` | `/api/governance/authority-trust/registry-template.json` | Download a non-operative provisioning template |
| `POST` | `/api/governance/authority-trust/challenges` | Issue a current candidate-bound 24-hour challenge |
| `GET` | `/api/governance/authority-trust/challenges/:id.json` | Download an issued challenge |
| `POST` | `/api/governance/authority-trust/receipts/verify` | Verify and append one signed receipt |

There is intentionally no registry-write endpoint.

## Production replacement gate

Before this seam can support a real pilot, Focused Future still needs an approved identity and signature authority, hardware-backed key custody and rotation, revocation/status service, trusted time, separation of duties, evidence-retention policy, authenticated site and role lifecycle, immutable audit export, security monitoring, disaster recovery, named incident and stop/restart authority, deployment control, e-QPASS integration acceptance, and clinical/legal/accessibility approval. The local Ed25519 bridge is executable contract evidence for that system; it is not the system’s certification.
