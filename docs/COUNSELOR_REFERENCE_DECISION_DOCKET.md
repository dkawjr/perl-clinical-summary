# Counselor Reference Decision Docket

Contract: `perl-counselor-reference-decision-docket/1.0`  
Current package: `perl-synthetic-calibration-package/2.36` (docket introduced in `2.35`)  
State schema: `sandbox-state/42`

## Product decision

The Reference Drafting Room creates uncontaminated source-only candidates. The Adjudication Antechamber makes same-case disagreement inspectable without exposing authorship or creating a vote. The Reference Decision Docket is the authenticated return path that follows those two local steps.

The docket can verify a bounded counselor-reference decision only when four outside duties arrive in order under four distinct, externally provisioned Ed25519 public keys. PERL can issue the exact challenge and verify the returns. It cannot provision those keys, sign a return, transmit the challenge, identify a signer, or approve its own evidence.

## Four separated duties

| Order | Signed purpose | Exact decision established |
|---|---|---|
| 1 | `reference-authorship-attestation` | Every challenged draft hash was produced by a qualified, independent author after conflicts review |
| 2 | `reference-language-safety-acceptance` | The fingerprinted language-and-safety standard accepts direct-review routing, indicator language, diagnostic restraint, and explicit uncertainty |
| 3 | `reference-adjudication-decision` | Every development case receives an accepted candidate, accepted synthesis, or no-reference disposition; rationale and dissent are fingerprinted; dissent is preserved; majority voting is false |
| 4 | `reference-protocol-freeze` | The first three attestations, accepted reference set, frozen protocol, and independent-evaluator handoff are fingerprinted together |

Order is part of the contract. A later duty cannot be verified before the preceding one. No key may serve two purposes, and an attestation cannot be replayed.

## Exact challenge binding

A challenge lasts exactly 24 hours and binds:

- the current sealed adjudication-dossier fingerprint;
- the Counselor Reference Adjudication chain head;
- the source-only Reference Draft chain head;
- frozen case-set identity and version;
- each development case, its current source-profile hash, and all candidate draft hashes;
- the startup registry fingerprint;
- the four required purposes in their fixed order; and
- a server-generated 256-bit nonce.

If another draft or adjudication snapshot changes that record, an older challenge cannot authorize the new record. If the registry changes, an old return is stale. The server revalidates all of this before committing an event.

## Startup trust ceremony

The default registry is disabled. Production owners must create an owner-only JSON file outside PERL and pass its path through `PERL_COUNSELOR_REFERENCE_DECISION_REGISTRY_FILE` at startup. The file must:

- use `perl-counselor-reference-decision-registry/1.0`;
- contain four distinct Ed25519 SPKI public keys;
- bind at least one active key to each exact purpose;
- place every key-validity window inside the registry-validity window; and
- remain at or below 256 KB.

The server fails closed when the startup file is not regular, not owner-only, too large, malformed, expired, missing a duty, or repeats key material. The downloadable registry specification contains placeholders only. No registry-write or private-key route exists.

## Returned attestation boundary

Each returned JSON attestation is capped at 64 KB. It carries identifiers, fingerprints, bounded decision metadata, governed evidence references, validity timestamps, and one Ed25519 signature. It cannot carry evidence files, counselor names, human signature images, credentials, candidate prose, Findings content, raw responses, patient records, PHI, or a claim that PERL transmitted anything externally.

Signature verification covers the canonical JSON payload with the `signature` field removed. The committed event records the attestation, its fingerprint, the trusted public-key fingerprint, the immutable chain link, and the exact bounded claim created by that duty.

## Persistence and tamper behavior

`counselorReferenceDecisionEvents` is the thirty-eighth integrity family. Schema 41 adds challenge and verified-attestation events to the state ledger. Startup reconstructs the sequence, verifies every event hash, revalidates every challenge and signature, rejects missing parent challenges, enforces one attestation per purpose, and rejects reused attestation IDs or signature material.

The current docket is a projection over the exact current adjudication dossier, startup registry, decision events, and current time. A successful protocol freeze makes only these fields true:

- `referenceSetAccepted`;
- `protocolFrozen`; and
- `independentReviewHandoffReady`.

Accuracy, reliability, clinical validation, trial execution, pilot authority, production release, traffic activation, patient use, diagnosis, and care decisions remain false.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calibration/reference-decision` | Return the current docket, registry summary, four duties, history, chain, and authority boundary |
| `GET` | `/api/calibration/reference-decision.json` | Download the current bounded docket |
| `GET` | `/api/calibration/reference-decision/registry-template.json` | Download the placeholder-only owner provisioning shape |
| `POST` | `/api/calibration/reference-decision/challenges` | Issue or idempotently return the exact current 24-hour challenge when local evidence and all four active keys are present |
| `GET` | `/api/calibration/reference-decision/challenges/:challengeId.json` | Download one existing challenge |
| `POST` | `/api/calibration/reference-decision/attestations/verify` | Verify and immutably commit only the next valid signed duty |

## Interface and accessibility

The Fieldwork surface presents a formal editorial docket rather than a generic AI dashboard: an external-duty seal, four-part evidence register, ordered casebook, dark return desk, immutable history, and complete authority boundary. Warm paper, forest, oxblood, and restrained gold distinguish source judgment from product machinery.

All controls are native links, buttons, and a labeled file input. Status, file-validation, and docket-history changes use polite live regions. Actions provide at least 46–48 CSS pixels of target height and visible focus. The two-column casebook becomes one column on phones, dense identifiers truncate without changing their accessible text, and reduced-motion behavior is inherited from the Fieldwork room.

## What still happens outside PERL

An accountable organization must still establish signer identity, qualifications, conflicts, delegated authority, key custody, the approved language/safety standard, adjudication governance, independent evaluator identity, and evidence retention. It must transport challenges and returns through an approved channel and retain the human-readable decision record.

After a verified freeze, independent evaluation still has to establish the denominator, accuracy, inter-rater reliability, limitations, correction burden, and safe-use conditions before stronger clinical claims are possible. Nothing in this docket launches a trial, pilot, deployment, or patient workflow.

Package `2.36` makes the verified freeze consumable by the exact current Independent Review Dossier. Only a valid chain with matching docket, chain-head, and freeze-attestation fingerprints can change that one upstream gate from `external-decision-required` to `externally-verified-dependency`. The freeze must then remain current inside the separate [Independent Review Admission Docket](./INDEPENDENT_REVIEW_ADMISSION_DOCKET.md), where seven additional distinct duties can authorize only execution of the exact outside evaluation protocol. No result or performance claim flows backward from either surface.
