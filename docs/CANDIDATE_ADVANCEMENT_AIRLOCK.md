# Exact Candidate Advancement Airlock

Package `perl-synthetic-calibration-package/2.43` adds `perl-exact-candidate-advancement-airlock/1.0`, state schema 49, and the forty-seventh integrity family. It supplies the action boundary intentionally left outside the Candidate Retest Independent Disposition Chamber: one authority set first freezes what happens to the exact refinement cycle; only a signed close with a current upstream advancement recommendation may reveal the exact candidate to a second, separately governed authority set.

The airlock is grounded in Dolores’s January 12, 2026 direction to test three AI engines manually, review results with counselors, apply a feedback loop, retest, and obtain independent accuracy and reliability evidence before release. It preserves that sequence without converting a favorable exact-cycle result into broad validation, engine selection, deployment, or patient-use authority.

## Two rooms, one interlock

### Room I — exact cycle action

Two distinct Ed25519 duties sign the same 24-hour challenge in order:

1. `clinical-cycle-action` chooses `close-this-refinement-cycle`, `continue-refinement`, or `hold-study`.
2. `evaluation-custody-confirmation` confirms the identical action and exact frozen evidence package.

The challenge binds the cycle event, independently frozen result, disposition package, upstream result event and ledger head, upstream cycle recommendation, candidate recommendation, registry fingerprint, nonce, issuance time, expiry, purpose order, and content boundary.

A complete `close-this-refinement-cycle` return freezes only that exact synthetic refinement cycle. `continue-refinement` or `hold-study` also freezes the chosen action but keeps Room II sealed. No action authorizes model work, release, traffic, or care.

### Interlock

Room II opens only when all of the following remain current and mutually consistent:

- the independently signed result is frozen;
- its exact cycle recommendation supports close;
- its candidate recommendation supports a separate advancement decision;
- Room I has two valid, distinct, ordered signatures for `close-this-refinement-cycle`;
- the current candidate can be reconstructed from the refinement lane, Candidate Trial snapshot, Model Trial declaration, three current same-case retest returns, exact protocol, and linked ledger heads; and
- the Room II registry has four current, purpose-bound, distinct keys.

If any upstream hash, result, recommendation, registry, candidate declaration, return set, protocol, or current chain changes, the interlock fails closed.

### Room II — exact candidate decision

Only after the interlock opens does the product disclose the exact non-secret candidate package. Four distinct Ed25519 duties sign one shared 24-hour challenge in order:

1. `clinical-suitability-advancement` records exact-cycle clinical suitability.
2. `privacy-security-transport-fit` records controlled-integration transport fit.
3. `eqpass-integration-fit` records e-QPASS integration-readiness fit.
4. `product-sponsor-advancement-freeze` freezes `advance-exact-candidate-to-integration-readiness`, `retain-baseline-and-refine`, or `hold-candidate-decision` consistently with the prior three duties.

An advancement decision is bound to the exact lane, candidate slot and fingerprint, provider ID, model version, prompt version, output contract, policy version and hash, retest protocol, hosting pattern, region, domain-evidence fingerprint, Model Trial chain head, Candidate Trial chain head and protocol fingerprint, Candidate Return chain head, Retest Return chain head, Room I freeze, and independent result.

`advance-exact-candidate-to-integration-readiness` means only that this exact frozen candidate package may proceed to separately governed integration-readiness work. It does not approve the provider or model generally and does not select a production engine.

## Trust and signing model

Both registries are disabled by default. PERL loads public trust material only from owner-permissioned startup files:

- `PERL_CANDIDATE_CYCLE_ACTION_REGISTRY_FILE`
- `PERL_CANDIDATE_ADVANCEMENT_REGISTRY_FILE`

The browser and API expose templates, status, challenge issuance, challenge download, and signed-return verification. They expose no registry-write endpoint and no signing endpoint. Private keys, credentials, endpoints, evaluator names, and human signatures never enter the contract.

Each registry requires exactly one current Ed25519 public key for each purpose, with distinct key IDs, fingerprints, and validity windows contained inside the registry window. Verification rejects malformed or oversized envelopes, unknown or skipped purposes, key reuse, stale/future returns, expired challenges, mismatched evidence, mismatched decisions, repeated attestation IDs, signature replay, invalid signatures, and authority-inflating claims.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/calibration/candidate-advancement` | Current two-room status; optional `cycleId` query |
| `GET` | `/api/calibration/candidate-advancement.json` | Content-bounded airlock export |
| `GET` | `/api/calibration/candidate-advancement/registries/cycle-action-template.json` | Two-duty startup registry template |
| `GET` | `/api/calibration/candidate-advancement/registries/candidate-advancement-template.json` | Four-duty startup registry template |
| `POST` | `/api/calibration/candidate-advancement/cycle-action/challenges` | Issue or reuse a current Room I challenge |
| `POST` | `/api/calibration/candidate-advancement/candidate/challenges` | Issue or reuse a current Room II challenge after the interlock |
| `GET` | `/api/calibration/candidate-advancement/challenges/:id.json` | Download one exact challenge |
| `POST` | `/api/calibration/candidate-advancement/cycle-action/attestations/verify` | Verify one Room I signed envelope |
| `POST` | `/api/calibration/candidate-advancement/candidate/attestations/verify` | Verify one Room II signed envelope |

Signed envelopes are strict metadata-only JSON and are limited to 64 KB. Startup registry files are limited to 256 KB.

## Persistence, recovery, and export

Schema 48 migrates to 49 by adding an empty `candidateAdvancementEvents` ledger. Migration never invents a challenge, signature, cycle action, candidate identity, or advancement decision. Startup validates the contract and both configured registries, then verifies the exact event chain, evidence bindings, decision consistency, purpose order, signature uniqueness, and all denied claims.

Isolated recovery reconciles 47 integrity families. Package `2.43` includes:

- the current `candidateAdvancement` projection;
- all exact `candidateAdvancementEvents`; and
- `candidateAdvancementEventChain` in the export manifest.

Package 2.44 leaves the airlock and forty-seven integrity families unchanged, then projects its exact-candidate identity into the separate Findings-to-Summary Automation Atelier. The local rollback baseline `2026.08.14.45` pins state schema 49 and 148 exact source files, including the airlock, automation observatory, editorial interface, and strict schemas.

## Interface and accessibility

The surface is an editorial decision airlock, not a generic AI dashboard. Near-black, deep forest, plum, ivory, brass, and hairline rules distinguish the two rooms and the interlock without gradients, model logos, glowing effects, leaderboards, or faux intelligence imagery.

The interface provides a named H2 region, ordered H3 rooms, native labeled controls, keyboard operation, visible focus, 48-pixel controls, polite live announcements, reduced-motion handling, and explicit 1080-, 760-, and 430-pixel reflow. The exact candidate vault stays masked until the signed Room I close and upstream recommendation make disclosure necessary.

## Claim boundary

The airlock stores bounded metadata, hashes, enums, public-key fingerprints, and exact non-secret candidate provenance. It excludes source workbooks, summary prose, Findings content, raw responses, case files, records, patient identifiers, and PHI.

Even after all six duties are valid, all of the following remain false:

- external model execution verified;
- generalized accuracy or reliability established;
- comparative improvement, clinical performance, safety, clinical validity, or patient benefit established;
- provider or model approved generally;
- production engine selected;
- candidate transport authorized;
- pilot, deployment, production release, or traffic activation authorized;
- patient-record processing or patient use authorized; and
- any care plan changed.

## Production replacement gate

Before operating this contract outside the synthetic workspace, Focused Future needs authenticated named authorities and delegation rules; qualified clinical/evaluation identity; hardware-backed purpose keys; approved rotation, revocation, and trusted-time services; governed result and candidate evidence access; immutable retention and audit export; e-QPASS, security/privacy, legal, clinical, and product acceptance; explicit conflict rules; and separately authorized integration, release, traffic, and patient-use controls.

The production service should preserve the two registries, six distinct duties, exact evidence binding, purpose order, interlock, disclosure minimization, replay defense, and decision ceiling. It must not let a successful exact candidate freeze silently become a provider-wide approval, production selection, or clinical release.
