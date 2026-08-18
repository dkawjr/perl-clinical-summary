# PERL identity and access perimeter

Contract: `perl-identity-access-perimeter/1.0`  
Policy: `perl-identity-access-policy/1.0`  
Access event: `perl-authenticated-access-decision/1.0`  
State schema: `sandbox-state/42`  
Package: `perl-synthetic-calibration-package/2.25`

## Decision

PERL now has an executable, fail-closed seam between an external identity service and its API permissions. When a valid startup policy is present, every protected API request requires a short-lived, externally issued Ed25519 JWT assertion. PERL verifies the signature and exact claims, maps the assertion’s fixed roles to one route permission, and rejects missing, malformed, stale, overlong, unknown-role, wrong-issuer, wrong-audience, or unauthorized assertions.

This is a production replacement seam, not production SSO. PERL does not issue tokens, collect passwords, retain bearer credentials, verify employment or licensure, provision users, create roles at runtime, authorize PHI, or replace e-QPASS RBAC. The default remains the visibly labeled synthetic reviewer-code mode so local calibration works without pretending a production identity service exists.

## Startup-only trust policy

Set `PERL_IDENTITY_ACCESS_POLICY_FILE` before starting the server. The file must be a regular owner-only file (`0600` or stricter), no larger than 256 KB, and valid JSON. The download at `/api/security/identity/policy-template.json` is a shape template only; its placeholder public key is intentionally invalid.

```bash
chmod 600 /approved/path/perl-identity-access-policy.json
PERL_IDENTITY_ACCESS_POLICY_FILE=/approved/path/perl-identity-access-policy.json npm start
```

The policy pins exactly:

- contract, policy ID, semantic version, HTTPS issuer, and audience `perl-clinical-summary`;
- issued and expiry timestamps;
- a session ceiling from 300 through 900 seconds;
- one through eight distinct Ed25519 SPKI public keys, each with an ID and validity window contained inside the policy window.

There is no policy-write API, browser import, fallback key, token-issuance API, password field, or dynamically created role.

## Assertion contract

Assertions are compact JWS tokens bounded to 16 KB. The header must contain exactly `alg`, `kid`, and `typ`, with `alg: EdDSA` and `typ: JWT`. The claims must contain exactly `iss`, `aud`, `sub`, `jti`, `iat`, `nbf`, `exp`, and `roles`.

- `sub` is a pseudonymous `FF-ID-*` actor reference, not a human name.
- `jti` is a UUIDv4 session reference.
- `roles` contains one to three entries from the fixed role book.
- `exp - iat` cannot exceed the policy ceiling or fifteen minutes.
- sixty seconds of clock tolerance is allowed for distributed-clock skew.
- the key, policy, assertion, issuer, audience, and validity windows must all agree before authorization is evaluated.

The browser client has a memory-only `setAccessToken()` seam for an approved host/SSO adapter. It never writes the token to local storage, session storage, application state, the access ledger, an export, or a response.

## Fixed role book

| Role | Permissions |
|---|---|
| Licensed clinician | workspace read, evidence export, clinical review, clinical approval, safety report |
| Clinical lead | clinician permissions plus safety management, governance verification, change management |
| Calibration reviewer | workspace read, evidence export, calibration operation, safety report |
| Integration operator | workspace read, evidence export, integration operation |
| Operations operator | workspace read, evidence export, operations operation |
| Governance owner | workspace read, evidence export, governance verification |
| Read-only auditor | workspace read, evidence export |

The route classifier is fixed and ordered. Read routes require `workspace:read`; export routes require `evidence:export`; assessment edits and comparisons require clinical review; assessment approval requires clinical approval; calibration, integration, operations, governance, safety, and change-control mutations require their matching operation permission. Unclassified mutations fail into governance verification rather than an unprivileged default.

`GET /api/health` and `GET /api/security/identity/public` are the only public API status routes. The public identity response exposes mode and boundary facts, not policy material or a credential. Static application files remain public because the frontend is not an authority surface.

## Authenticated access ledger

Successful authorization of an externally authenticated mutation creates one append-only event containing:

- pseudonymous actor, fixed roles, key ID, method, route class, and granted permission;
- SHA-256 fingerprints for the assertion, policy, and issuer;
- sequence, prior hash, event hash, and verification time;
- hard-coded true signature/authorization checks; and
- hard-coded false token, password, human-name, and PHI storage claims.

The event intentionally means “access to this route class was granted,” not “the downstream operation succeeded.” Read access is not stored in this local ledger. Startup replays all events, rechecks role-to-permission consistency and every chain link, and refuses to serve after tampering. Schema 38 adds this thirty-fifth integrity family and migrates earlier states with an empty ledger—never an invented authentication event.

## API status

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/security/identity/public` | Public mode, enforcement, key-count, and boundary summary |
| `GET` | `/api/security/identity` | Protected policy summary, fixed role book, access history, and chain status |
| `GET` | `/api/security/identity/policy-template.json` | Protected shape-only startup template download |

The server returns `401` with a Bearer challenge when authentication is missing or invalid, `403` when verified roles do not grant the required permission, and the ordinary route status only after authorization succeeds.

## Production replacement gate

Before this seam can support a real pilot, accountable security, clinical, privacy, legal, e-QPASS, and operations owners still need to provide and approve:

1. the production OIDC/OAuth identity provider, browser authorization-code/PKCE flow, logout, and secure session lifecycle;
2. workforce lifecycle, MFA, conditional access, recovery, termination, and periodic access review;
3. verified employment, licensure, clinical assignment, site/tenant membership, and role-source ownership;
4. hardware-backed signing-key custody, rotation, revocation, issuer discovery, trusted time, and emergency disablement;
5. authoritative e-QPASS RBAC and record-level/tenant-level authorization, including minimum-necessary disclosure;
6. immutable centralized audit export, security monitoring, alerting, retention, investigation, and access-report review;
7. penetration testing, threat modeling, abuse testing, privacy review, and approved PHI/data-flow controls; and
8. tested failure behavior for identity outage, key rotation, clock drift, revoked access, expired sessions, and incident containment.

The current implementation makes those dependencies concrete and testable. It does not claim they have been supplied.
