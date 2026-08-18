# Candidate Retest Independent Disposition Chamber

Package `perl-synthetic-calibration-package/2.42` adds `perl-candidate-retest-independent-disposition/1.0`, state schema 48, and the forty-sixth integrity family. It implements the result-return seam Dolores described on January 12, 2026: after live review, modification, and more testing, an independent third party can return bounded accuracy and reliability decisions before release. This chamber is downstream of the seven-duty Independent Review Admission Docket. Admission freezes who may evaluate, what evidence and standard apply, and how the evaluation runs; this chamber records the independently signed result for one exact Same-Case Retest cycle.

It does not execute an independent evaluation, identify or credential an evaluator, create signing keys, send evidence outside PERL, establish generalized performance, close the refinement cycle, select an engine, or authorize release or patient use.

## Exact evidence package

One 24-hour challenge binds:

- refinement-cycle ID and event hash;
- exact three-return set and retest-protocol fingerprints;
- public Same-Case Retest Studio fingerprint;
- refinement, retest-return, and paired-review chain heads;
- content-free X/Y analysis hash;
- independently admitted protocol fingerprint and chain head;
- Clinical Standard draft hash; and
- startup registry fingerprint plus the four required purposes in order.

The analysis decoder uses the sealed `pairMapping` only inside the store. New reviewers record `x-stronger`, `y-stronger`, `materially-equivalent`, or `uncertain`; no reviewer is asked which page is baseline or retest. The result package exposes only counts, event hashes, and one analysis hash—not summary prose, mappings, ratings by reviewer, names, records, Findings, raw responses, or PHI.

## Four ordered duties

Each duty requires a distinct, externally provisioned Ed25519 key whose registry purpose matches exactly:

1. `independent-accuracy-disposition` records the frozen analysis-plan hash, four bounded domain dispositions, correction burden, exact-cycle comparison, and an exact-cycle outcome.
2. `independent-reliability-disposition` records the agreement-analysis hash, reviewer-overlap and case-coverage acceptance, reliability estimate, and exact-cycle outcome.
3. `clinical-standard-satisfaction-disposition` binds the current Clinical Standard plus the fingerprints of the prior accuracy and reliability attestations and records the client-threshold confirmation reference.
4. `independent-result-freeze` binds the three prior attestations in order and freezes the disposition-package hash, cycle recommendation, and separate candidate recommendation.

A close or advancement recommendation is permitted only when accuracy and reliability are supported for the frozen cycle and the Clinical Standard threshold is met. Even then, `cycleClosed`, `engineSelected`, `clinicalValidation`, `productionReleaseAuthorized`, and `patientUseAuthorized` remain false. The recommendation must enter a separate governed action path before it changes any state or product authority.

## Trust and signing boundary

The default registry is deliberately disabled. Production-like startup may supply an owner-only regular JSON file no larger than 256 KB through:

```text
PERL_CANDIDATE_RETEST_DISPOSITION_REGISTRY_FILE=/owner-only/path/registry.json
```

The registry must have mode `0600` or stricter and contain four current, distinct public keys. PERL exposes a downloadable shape-only template but no registry-write or signing API. Private keys and signatures are created outside PERL. The return file control remains disabled until an active eligible challenge exists. Signed metadata returns are capped at 64 KB, verified locally against the exact nonce/evidence/registry binding, and rejected on expiry, skipped order, wrong purpose, wrong key, duplicate purpose, replayed attestation ID, replayed signature, altered decision, stale evidence, or invalid Ed25519 signature.

## Routes

- `GET /api/calibration/candidate-retest/disposition?cycleId=:cycleId` — current bounded docket.
- `GET /api/calibration/candidate-retest/disposition.json?cycleId=:cycleId` — downloadable docket.
- `GET /api/calibration/candidate-retest/disposition/registry-template.json` — shape-only four-key startup registry template.
- `POST /api/calibration/candidate-retest/disposition/challenges` — issue or idempotently reuse the exact 24-hour challenge.
- `GET /api/calibration/candidate-retest/disposition/challenges/:challengeId.json` — download the active challenge.
- `POST /api/calibration/candidate-retest/disposition/attestations/verify` — verify and append the next ordered external duty.

## Interface

`Let the outside decision arrive with its own key.` is an editorial verdict folio set apart from the retest studio. The oxblood, forest, ivory, and brass system presents five evidence measures, two prerequisites, four purpose leaves, a native cycle selector, native docket/registry/challenge downloads, one labeled JSON file control, the five bounded result cells, custody history, and the complete authority ceiling. There is no local accept, approve, close, select, sign, or authorize control. The layout reflows at 1,080, 760, and 430 pixels; native controls preserve 47–48 pixel targets, visible focus, reduced-motion behavior, and source order without a gradient dependency.

## Persistence, export, and recovery

Schema 47 migrates to 48 by adding an empty `candidateRetestDispositionEvents` ledger. Migration never invents a challenge, external signature, result, or recommendation. Startup verifies the full result chain. Package 2.42 recovery reconciled 46 integrity families and exported the docket, exact ledger, and `candidateRetestDispositionEventChain` under format `2.42`. Package 2.43 preserves the chamber unchanged and adds the separate exact-candidate advancement chain. Package 2.44 keeps schema 49 and all 47 integrity families, exports format `2.44`, and seals rollback baseline `2026.08.14.45` with 148 source files including the Automation Atelier projection.

## Remaining production work

The present live sandbox has no eligible completed retest cycle, admitted protocol, production disposition registry, named independent evaluator, executed analysis, or signed result. Package 2.43 now supplies the separately governed [Exact Candidate Advancement Airlock](./CANDIDATE_ADVANCEMENT_AIRLOCK.md) for cycle action and exact candidate advance/retain/hold after a result exists. Before any returned decision can support release, Focused Future still needs the authoritative Mike workbooks and scored-event contract; approved representative de-identified case and holdout policy; accepted Clinical Standard and analysis plan; qualified independent evaluator, legal/privacy permission, hardware-backed key custody and rotation; authenticated append-only result transport; operated cycle-action and candidate-decision registries; and the separate integration, release, deployment, traffic, and patient-use controls already represented elsewhere in PERL.
