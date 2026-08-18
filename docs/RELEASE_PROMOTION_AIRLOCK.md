# PERL Production Promotion Airlock

Contract: `perl-release-promotion/1.0`  
Request: `perl-release-promotion-request/1.0`  
External return: `perl-release-promotion-attestation/1.0`  
Trust policy: `perl-release-promotion-trust-policy/1.0`  
Package export: `perl-synthetic-calibration-package/2.36` (Airlock introduced in `2.29`)  
Schema version: `40`

## Purpose

The Production Promotion Airlock closes the ambiguous handoff between PERL's exact locally qualified archive and an independently controlled production-artifact pipeline. It creates one deterministic, content-addressed request only after the same candidate has a valid `qualified-local` Release Admission report. The request binds every candidate sidecar, the local admission evidence, the Azure/OCI target class, ten blocking external controls, and the exact signed-return contract.

It does not run CI, scan a dependency, build a container, access Azure, sign an artifact, deploy an application, or accept clinical authority. Those actions remain outside PERL.

## The ten blocking returns

1. isolated CI execution with deny-by-default networking, workload identity, and credential isolation;
2. exact archive retest, including the complete archived suite and frozen clinical invariants;
3. externally governed vulnerability review with scanner and database provenance;
4. SBOM-bound license review and accountable disposition;
5. a locked, non-root, digest-addressed OCI image with base/runtime provenance;
6. immutable publication to an approved Azure registry through workload identity;
7. hardware-backed artifact signing with rotation, revocation, and transparency evidence;
8. version-bound environment, schema, migration, and secret-reference compatibility;
9. authorized last-known-good selection, staged rollback, and full reconciliation evidence; and
10. release telemetry, alert ownership, escalation, and an accepted operator runbook.

Every gate must return `passed`, a resolvable `https:` or `urn:` evidence reference, and a SHA-256 digest. Missing, reordered, duplicated, failed, or malformed gates fail closed.

## Deterministic handoff

`npm run release:promote` reads the latest verified candidate and its latest qualified admission report from the configured repositories. It writes two owner-only immutable files under `dist/release-promotions/<request-id>/`:

- `request.json` is the exact content-addressed handoff;
- `attestation-template.json` is the strict external return shape.

The request identity is derived from canonical JSON. Repeating the operation for unchanged candidate and admission evidence is idempotent. A changed archive or admission report produces a different request identity.

Runtime repository paths may be configured with `PERL_RELEASE_PROMOTION_REPOSITORY_DIR`. Moving the repository does not create a registry or production control.

## External trust

The default trust mode is disabled. A production owner may provide one current, owner-only `PERL_RELEASE_PROMOTION_TRUST_POLICY_FILE` at startup. The policy pins:

- one Ed25519 public key;
- the exact `production-promotion-attestation-authority` signer role;
- policy and key identities;
- an issued/expiry window; and
- a maximum attestation age.

PERL never accepts a private key. The browser and API cannot create, rotate, approve, or replace the trust policy. Policy files must be regular, at most 256 KB, and mode `0600` or stricter.

The returned signature covers the canonical attestation without its `signature` field. Verification also binds the candidate's archive, manifest, configuration, provenance, SBOM, source digest, local admission ID and evidence hash, external execution window, OCI digest, Azure registry resource ID, all ten evidence digests, the request identity, and the authority ceiling.

## Authority ceiling

A valid return may establish only:

- `externalEvidenceVerified: true`; and
- `productionArtifactPromoted: true` for the exact OCI digest named by the trusted attestation.

It must keep all of the following false:

- `deploymentAuthorized`;
- `azureDeploymentPerformed`;
- `clinicalValidation`;
- `clinicalReleaseAuthorized`;
- `trafficActivationAuthorized`; and
- `patientUseAuthorized`.

Any attempt to inflate those claims invalidates the attestation before signature acceptance. Artifact promotion evidence remains separate from the existing provider-preparation, clinical-release, and traffic-activation duties.

## API

- `GET /api/operations/release/promotion`
- `POST /api/operations/release/candidates/:artifactId/promotion/prepare`
- `GET /api/operations/release/promotions/:requestId/request.json`
- `GET /api/operations/release/promotions/:requestId/attestation-template.json`
- `POST /api/operations/release/promotions/attestations/verify`
- `GET /api/operations/release/promotion-trust-policy-template.json`

Stored requests and accepted attestations are re-read and structurally verified on repository status. Corrupt evidence fails the repository closed. The current export includes only the bounded promotion status and evidence metadata; runtime credentials and private keys are never exported.

## Production continuation

The next external implementation step is to make a named engineering/security/e-QPASS team operate the request from an independently controlled CI system, connect an approved immutable Azure Container Registry, provision hardware-backed signing, retain governed scan and transparency evidence, and return the signed attestation. A verified attestation must then remain only an input to the separate deployment and clinical-release controls; it is not a shortcut around them.
