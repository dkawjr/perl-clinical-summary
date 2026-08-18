# Governed Clinical Release Gate

Introduced in state schema: `sandbox-state/36`  
Integrity family: 33  
Package: `perl-synthetic-calibration-package/2.23`

## What this milestone does

The Governed Clinical Release Gate turns the boundary after provider preparation into three separate, inspectable claims:

1. a licensed clinical authority signs a bounded provider-first clinical- and patient-use authorization;
2. a production authority signs the exact e-QPASS Azure pilot release that may be presented for deployment verification; and
3. an independent deployment-attestation duty verifies the exact artifact, configuration, environment, and eight operational controls.

When all three claims verify, PERL may report **release ready · traffic off**. The gate never enables clinical traffic, starts the live pilot, processes a patient record, or records the first governed transaction.

## Trust and separation

`PERL_CLINICAL_RELEASE_REGISTRY_FILE` points at an externally provisioned, owner-only JSON registry supplied only when the server starts. The file must be regular, no larger than 256 KB, and mode `0600` or stricter. No browser or API route can create, replace, or trust a key.

The registry requires three distinct Ed25519 public keys, each limited to one duty:

- `clinical-use-authorization`
- `production-release-authorization`
- `release-deployment-attestation`

Keys are candidate-bound and time-bounded. Reusing the same key material across duties fails validation.

## Twenty-minute release challenge

A release challenge can be issued only when the selected candidate has:

- a current 36-scope authority seal;
- a verified provider-preparation acknowledgement;
- current isolated-restore, rollback, monitoring, incident-response, and study-safety continuity evidence; and
- three current, separated release duties.

The challenge binds the candidate dossier, authority bridge, pilot-start control and chain head, exact provider-preparation acknowledgement, continuity evidence, registry fingerprint, a 256-bit nonce, and the fixed duty order. Its lifetime is exactly twenty minutes.

## Receipt contracts

### Clinical-use authorization

`perl-clinical-use-authorization/1.0` fixes:

- one named setting and population;
- a maximum record count from 1 through 1,000;
- a use window no longer than 400 days;
- `provider-reviewed-quality-improvement` as the only purpose;
- `licensed-clinical-provider` as the allowed audience;
- explicit clinical- and patient-use authority;
- seven SHA-256 evidence references; and
- false autonomous-decision, diagnostic-use, PERL-scoring, and Findings-modification claims.

### Production-release authorization

`perl-production-release-authorization/1.0` binds the verified clinical authorization and the exact provider-preparation deployment: `eqpass-azure-pilot`, tenant reference, release ID, artifact digest, and configuration digest. Six control references must be SHA-256 fingerprints. Production release may be authorized while clinical traffic and pilot start remain false.

### Deployment attestation

`perl-release-deployment-attestation/1.0` binds both earlier authorizations and the same deployment. Eight checks must be true: artifact, configuration, identity/access, continuous monitoring, encrypted backup, incident routes, audit retention, and rollback. It may establish release readiness only while clinical traffic, patient-record processing, and pilot start remain false.

Every receipt is strict metadata capped at 64 KB, challenge-bound, registry-bound, signed, time-checked, replay-resistant, and content-bounded. Evidence files, human identity material, credentials, Findings content, records, and PHI are prohibited.

## Append-only evidence and API

`clinicalReleaseEvents` is the thirty-third SHA-256-linked integrity family. It records:

- `release-challenge-issued`
- `clinical-use-authorized`
- `production-release-authorized`
- `release-deployment-attested`

Startup replays signatures, references, sequence, prior hashes, state claims, and event hashes. Altering a stored authorization or changing a false traffic claim prevents the store from opening.

Read and verification routes are under `/api/governance/clinical-release`. The registry template and exact gate are downloadable. There is deliberately no registry-write endpoint, traffic endpoint, clinical-record endpoint, or patient-use execution endpoint.

## Remaining production boundary

Release readiness is not traffic activation. Schema 37 adds a metadata-only [Clinical Traffic Activation Witness](./TRAFFIC_ACTIVATION_WITNESS.md) that can verify dual external concurrence and a separately attested first governed transaction without becoming the switch. Production still requires the independently operated authenticated switch; live e-QPASS connectivity; real identity and role enforcement; approved privacy, security, legal, accessibility, backup, monitoring, incident, and rollback operations; and authoritative record/audit reconciliation. Until those controls exist and validate in the production environment, the local workspace remains synthetic, traffic-off, and unable to receive a patient record.
