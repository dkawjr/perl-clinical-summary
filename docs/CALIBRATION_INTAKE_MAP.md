# PERL calibration intake map

## Purpose

`perl-calibration-intake/1.0` is the aggregate-only bridge between the July 2026 proposal’s source-reported assessment library and an approved clinical-beta case set. It makes the intake sequence inspectable before any record-level data moves.

The proposal reports approximately 600 existing assessments and describes an estimated 80 percent clinical-quality / 20 percent marketing-panel split. PERL has not received, opened, counted, classified, or verified those files. The Intake Studio therefore displays `~600 source-reported`, `0 received or inspected`, and the current three-case synthetic manifest separately.

## Five intake lanes

1. **Authority and permitted use** — name the system-of-record, clinical, legal, privacy/security, and independent-evaluation authorities; approve intended use and the transfer path.
2. **Inventory and quarantine** — return an aggregate inventory first; quarantine only approved de-identified candidates while duplicates, marketing-panel records, rescoring, corruption, and versions are reconciled.
3. **Minimum-necessary contract** — freeze allowed scored-event and counselor-reference fields, prohibited identifiers, retention, deletion, access logging, and critical-screen handling.
4. **Eligibility and cohort design** — apply predeclared quality, eligibility, missingness, strata, partition, duplicate, and supersession rules; preserve a governed unseen holdout.
5. **Counselor references and freeze** — bind qualified references, provenance, conflicts, adjudication, reviewer allocation, and a signed analysis plan to the frozen manifest before tuning.

## Current evidence

The local sandbox contributes only a reproducible engineering pattern:

- three clearly synthetic manifested cases;
- two development cases and one holdout rehearsal case;
- three of four declared strata represented;
- the `low-signal` stratum deliberately absent;
- a manifest fingerprint and explicit `holdoutValid: false` / `clinicalValidation: false` boundary.

This pattern can test intake logic. It cannot establish that the reported library exists as described, that a record is eligible or de-identified, or that any holdout is unseen.

## Required return

The live JSON contract requests nine items:

1. named data, clinical, legal, privacy/security, and evaluation authority;
2. an aggregate inventory by source, report/scoring version, range, and quality class;
3. documented authority and an approved transfer/quarantine path;
4. a field-level minimum-necessary map and re-identification-risk review;
5. deterministic handling for marketing-panel records, duplicates, rescoring, supersession, missingness, corruption, and critical screens;
6. frozen eligibility, exclusion, strata, partition, and denominator rules;
7. counselor-reference provenance, qualifications, conflicts, adjudication, and use restrictions;
8. governed holdout access, freeze, versioning, retention, deletion, audit, and incident procedures;
9. signed clinical, legal, privacy/security, and independent-evaluation acceptance before record-level analysis.

## Interfaces

- The Calibration view renders the live Intake Studio from current case-set evidence.
- `GET /api/calibration/intake.json` exports the aggregate-only packet, five lanes, nine returns, prohibited-content list, current synthetic coverage, claim-denial fields, and SHA-256 packet fingerprint.

The route is read-only. There is intentionally no browser upload or record-level intake endpoint for the reported library.

## Boundary

The intake map does not confirm receipt, authorize PHI, approve de-identification, establish a valid holdout, accept counselor references, create a training dataset, establish clinical validity, connect production data, or authorize a pilot. Those states remain false until named external authorities return and accept the required evidence in an approved environment.
