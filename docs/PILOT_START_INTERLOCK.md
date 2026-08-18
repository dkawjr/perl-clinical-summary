# Governed Pilot-Start Interlock

Contract: `perl-governed-pilot-start/1.0`  
State schema: `sandbox-state/35`  
Integrity family: 32  
Package: `perl-synthetic-calibration-package/2.22`

## Why this exists

Dolores’s March 30, 2026 operating note makes the sequence explicit for the North Central counseling-center candidate: Dr. Brown and Provost approval, August training with objectives fixed before use, an August–May working term, and quarterly review. The Governed Authority Trust Bridge can verify those bounded decisions. It intentionally cannot start anything.

The Pilot-Start Interlock creates the next control boundary. It keeps four states separate:

1. the named-site authority seal is current;
2. an external release owner orders an exact bounded start;
3. a separate deployment observer acknowledges the exact artifact and configuration inside the signed window; and
4. clinical traffic and patient use remain disabled.

This release can open only `provider-preparation-only`. It does not start a live clinical pilot.

## Two external duties

`PERL_PILOT_START_REGISTRY_FILE` points to an owner-only startup JSON file. The server refuses a non-regular file, group or world permissions, a file over 256 KB, invalid JSON, duplicate key IDs, duplicate public-key material, unsupported candidates, invalid dates, or anything other than Ed25519.

Two distinct duties are mandatory for each candidate:

- `pilot-start-order`
- `deployment-start-acknowledgement`

The same key material cannot occupy both duties. There is no browser, import, HTTP, or persisted-state route for creating, editing, or trusting a key. `/api/governance/pilot-start/registry` does not exist.

## Fifteen-minute challenge

A challenge may be issued only when all of the following are current:

- all 36 named-site authority scopes;
- the candidate dossier and authority-bridge fingerprint;
- isolated restore evidence for the current state schema;
- sealed rollback compatibility for the current manifest;
- the latest clear local control probe;
- a response tabletop linked to those exact continuity heads;
- an active study safety state with no high-severity open stop; and
- distinct, current order and acknowledgement keys granted to the candidate.

The challenge binds a 256-bit nonce, candidate, dossier, authority bridge, start registry, continuity fingerprint, exact duty order, provider-preparation-only mode, and an exact fifteen-minute lifetime.

## Signed order

The order is limited to 64 KB of strict metadata. It must use the `pilot-start-order` key and bind the current challenge. It fixes:

- `eqpass-azure-pilot` as the deployment environment;
- a non-secret tenant reference;
- release ID;
- SHA-256 artifact digest;
- SHA-256 configuration digest;
- a start window no longer than four hours and inside the signed order lifetime;
- training and objectives completed;
- quarterly review accepted;
- stop authority assigned;
- support owner assigned; and
- clinical traffic and patient use both false.

Unknown fields, stale fingerprints, invalid windows, wrong duties, replayed IDs or signatures, invalid grants, malformed signatures, and modified deployment metadata fail closed.

## Deployment acknowledgement

The acknowledgement must use the distinct `deployment-start-acknowledgement` key. It repeats the candidate, challenge, registry, order ID, order fingerprint, exact deployment tuple, and observed time. The observed time must fall inside the ordered window. The only accepted launch state is:

- provider-preparation environment started: `true`;
- clinical traffic enabled: `false`;
- patient use enabled: `false`; and
- production release authorized: `false`.

A valid acknowledgement derives `providerPreparationStarted: true` while retaining:

- `pilotStarted: false`;
- `clinicalTrafficEnabled: false`;
- `productionReleaseAuthorized: false`; and
- `patientUseAuthorized: false`.

## Content boundary

Challenges, orders, and acknowledgements reject evidence files, human names, human signatures, credentials or secrets, patient records, Findings content, PHI, and any claim that PERL transmitted material externally. Evidence remains in its governed system; PERL retains only strict references, hashes, signatures, timestamps, and the tamper-evident event chain.

## API and evidence room

Read-only:

- `GET /api/governance/pilot-start`
- `GET /api/governance/pilot-start.json`
- `GET /api/governance/pilot-start/registry-template.json`
- `GET /api/governance/pilot-start/challenges/:id.json`

Bounded verification:

- `POST /api/governance/pilot-start/challenges`
- `POST /api/governance/pilot-start/orders/verify`
- `POST /api/governance/pilot-start/acknowledgements/verify`

The evidence room presents the authority seal, continuity locks, separated duties, candidate-bound challenge, two verification desks, and immutable ledger without exposing a key-provisioning or one-click launch surface.

## Remaining release boundary

Schema 36 introduces the separate three-duty release-authority layer; see [CLINICAL_RELEASE_GATE.md](./CLINICAL_RELEASE_GATE.md). It can record bounded clinical/patient-use authority, exact production-release authority, and deployment conformance while traffic remains off. Schema 37 adds the [Clinical Traffic Activation Witness](./TRAFFIC_ACTIVATION_WITNESS.md), which verifies dual external concurrence and a third-duty first-transaction attestation without operating the switch or accepting a record. The remaining production boundary is the independently operated authenticated control plane, authoritative e-QPASS connectivity and audit, and validated production operations. Until those controls exist in the e-QPASS production environment, the local workspace cannot start the live clinical pilot.
