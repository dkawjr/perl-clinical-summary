# PERL Release Admission Laboratory

Contract: `perl-release-admission/1.0`

Policy: `perl-local-archive-qualification/1.0`

Current package export: `perl-synthetic-calibration-package/2.36` (Laboratory introduced in `2.28`)

## Decision

PERL now qualifies the exact content-addressed release candidate from inside its archive. The laboratory verifies the candidate, materializes it into a new owner-only ephemeral directory, inventories every archived test file, runs the complete archived test suite and the clinical calibration evaluator through fixed no-shell Node commands, records the dependency and synthetic-fixture boundaries, removes the copy, and stores a content-bound immutable report.

This is durable local admission evidence. It is not isolated CI, an external vulnerability or license review, a production signature, an Azure deployment, clinical validation, clinical-release authority, traffic activation, or permission for patient use.

## Fixed gates

| Gate | Pass condition | Evidence retained |
|---|---|---|
| Exact archive integrity | Archive digest, internal manifest, configuration, SBOM, every declared file, aggregate digest, and candidate identity all verify | Artifact, archive, manifest, source, and SBOM bindings |
| Synthetic fixture completeness | Both required JSON fixtures exist, are regular bounded files, and parse | Exact path, bytes, and SHA-256 |
| Dependency boundary | All six package dependency fields, including both bundled-dependency spellings, remain empty | Package identity and zero counts; external database/license review explicitly false |
| Full archive tests | Every sorted `tests/*.test.mjs` file is passed to Node’s test runner; exit is zero, output is bounded, no timeout occurs, and reported failures are zero | Test-file, test, pass, and fail counts plus process result |
| Clinical calibration | At least three frozen synthetic cases run; critical-screen handling, diagnostic restraint, and evidence lineage each equal `1.0`; engineering regression passes | Denominator-first invariant metrics and process result |
| Ephemeral cleanup | The exact temporary directory is removed and verified absent | Removal result only; the path is never retained |

Any failed gate produces `failed-local` evidence and keeps `localArchiveQualificationPassed` false.

## Execution boundary

The runner uses `process.execPath` directly with argument arrays and `shell: false`. It inherits no environment variables or credentials; only bounded locale, timezone, test-mode, and color settings are supplied. Standard output and error are capped at 1 MB each, commands time out after three minutes, and retained failure messages are whitespace-normalized, path-redacted, and limited to 240 characters.

The materialized files are mode `0600`; the root and created directories are owner-only. The archive verifier runs before any write. The target must be empty, every path must stay under it, every write uses `wx`, and archive parsing permits canonical regular files only. Network isolation is not enforced by this local process and is therefore recorded as false.

## Evidence identity and storage

The report binds:

- candidate artifact ID;
- archive, manifest, provenance, SBOM, and source digests;
- exact policy and contract versions;
- all six checks and their bounded evidence;
- sanitized runtime/platform execution facts;
- actor and qualification time;
- every false production and clinical authority claim.

SHA-256 over canonical report content creates the evidence hash and `perl-adm-<20 hex>` identity. The API repository defaults to `data/release-admissions`; the CLI repository defaults to `dist/release-admissions`. Directories are `0700`, reports are `0400`, writes are temporary-plus-atomic, and every read recomputes and validates the report hash.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/operations/release/admission` | Current-candidate admission status, exact latest report, bounded history, and false outside-authority claims |
| `POST` | `/api/operations/release/candidates/:id/admission/run` | Qualify the exact verified candidate and immutably store the result |
| `GET` | `/api/operations/release/admissions/:id/report.json` | Download and revalidate the exact content-bound report |

All routes remain under the existing operations permission boundary.

## Operator commands

```bash
npm run release:build
npm run release:verify
npm run release:qualify
```

`release:qualify` accepts optional release-repository, admission-repository, and artifact-ID arguments. It exits nonzero when the stored result is not `qualified-local`.

The API repository may be moved with `PERL_RELEASE_ADMISSION_REPOSITORY_DIR`. That setting changes local storage only; it does not create an approved registry.

## Production promotion

Use the six gates as a minimum admission policy in an isolated, network-controlled CI worker. Add a locked dependency graph, external vulnerability/license policy, container and operating-system SBOM, signed CI provenance, workload identity, immutable Azure artifact storage, transparency/audit evidence, environment-specific configuration validation, staged deployment and rollback, telemetry, and independently named clinical and operational authorities. The local evidence report may be an input to that workflow, never a substitute for it.
