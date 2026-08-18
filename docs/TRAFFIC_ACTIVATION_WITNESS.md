# Clinical Traffic Activation Witness

Introduced in state schema: `sandbox-state/37`  
Contract: `perl-clinical-traffic-activation-witness/1.0`  
Package: `perl-synthetic-calibration-package/2.24`

## Product position

> **The switch lives elsewhere. The witness stays here.**

The witness is the governed seam between a complete three-seal clinical release and observable production use. It records cryptographically verified metadata about an external activation decision and the first governed transaction. It never becomes a traffic switch, endpoint configurator, record receiver, credential store, or production audit system.

The sequence requires three distinct Ed25519 duties:

1. `clinical-traffic-activation-clinical` concurs with the exact provider-first activation plan;
2. `clinical-traffic-activation-operations` independently concurs with the identical plan; and
3. `first-governed-transaction-attestation` observes the first governed external transaction from bounded hashes and control assertions.

## Startup trust and challenge

The trusted-key registry can enter only through `PERL_TRAFFIC_ACTIVATION_REGISTRY_FILE` when the loopback server starts. The file must be regular, owner-readable only (`0600`), no larger than 256 KB, valid JSON, current, candidate-bounded, and contain three non-reused public keys. There is no browser or API route that creates, changes, or trusts a key.

A fifteen-minute challenge can be issued only when all of the following are current:

- the candidate’s schema-36 clinical-release gate and chain head;
- the clinical, production, and deployment-attestation receipt fingerprints;
- the candidate dossier fingerprint;
- recovery, rollback, monitoring, incident-response, and study-safety continuity evidence; and
- the startup registry fingerprint and fresh 256-bit nonce.

## Dual concurrence

Both authorization duties must sign the same activation-plan fingerprint. The plan fixes:

- a maximum four-hour activation window;
- the exact `eqpass-azure-pilot` tenant, release, artifact digest, and configuration digest already verified by clinical release;
- an opaque connection-profile reference;
- endpoint-identity, role-policy, and tenant-isolation fingerprints; and
- eight control references covering release evidence, clinical stop authority, monitoring, backup, incident routes, rollback, identity/access, and minimum necessary use.

PERL verifies the plan and signatures. It does not resolve, receive, or store an endpoint or credential, and it does not call a traffic-control mechanism.

## First governed transaction

The third duty may attest the first transaction after the fifteen-minute challenge expires, but only inside the activation window authorized by both prior duties. The attestation must bind both authorization fingerprints, the common plan fingerprint, and the exact deployment. It contains five SHA-256 references—source-event receipt, Findings report, summary artifact, remote acknowledgement, and authoritative audit record—plus nine true governance checks.

No patient record, Findings text, generated summary, direct identifier, human name, signature image, endpoint, credential, or PHI is accepted. The recorded state explicitly keeps `perlSandboxReceivedRecord`, `perlSandboxStoredPhi`, `perlSandboxTrafficEnabled`, and autonomous clinical decision-making false.

## Evidence and routes

The thirty-fourth integrity family is append-only, hash-linked, replay-protected, schema-validated, and reverified at startup. Package `2.24` exports the exact witness state and event history.

Read and verification routes are intentionally narrow:

- `GET /api/governance/traffic-activation`
- `GET /api/governance/traffic-activation.json`
- `GET /api/governance/traffic-activation/registry-template.json`
- `POST /api/governance/traffic-activation/challenges`
- `GET /api/governance/traffic-activation/challenges/:id.json`
- `POST /api/governance/traffic-activation/clinical-authorizations/verify`
- `POST /api/governance/traffic-activation/operations-authorizations/verify`
- `POST /api/governance/traffic-activation/first-transactions/verify`

There is no registry-write, endpoint-configuration, traffic-control, record-ingest, or patient-data route.

## Remaining production boundary

The witness proves the local verification pattern, not a live deployment. Production still requires an independently operated and authenticated dual-control switch, authoritative e-QPASS connectivity and RBAC, approved key custody, privacy/security/legal/accessibility/clinical acceptance, real backup and telemetry, incident and rollback operations, retained production audit evidence, and independent confirmation that transaction hashes refer to the intended records and artifacts. Until those controls exist and validate in the production environment, the local workspace remains synthetic and traffic-off.
