# PERL Production Runtime Envelope

Contract: `perl-runtime-envelope/1.0`  
Policy: `perl-runtime-envelope-policy/1.0`  
Current package export: `perl-synthetic-calibration-package/2.48` (runtime envelope introduced in `2.30`)
State schema: `49`

## Purpose

The Production Runtime Envelope makes the exact PERL release candidate container-ready without pretending that a container has been built or deployed. It converts implicit local-server assumptions into a fail-closed startup policy, distinct liveness and readiness probes, a non-root execution contract, a read-only-root expectation, a single owner-only writable state mount, and bounded graceful shutdown.

Local development remains loopback-only. A non-loopback bind is available only when a current, owner-only policy explicitly approves the synthetic container rehearsal.

## Runtime modes

| Property | Local synthetic mode | Policy-controlled container rehearsal |
|---|---|---|
| Bind | `127.0.0.1` by default | exactly `0.0.0.0` or `::` |
| Port | `4173` by default | exactly `4173` |
| Public origin | none | one HTTPS origin, terminated upstream |
| Process identity | observed and reported | known non-root UID required |
| State | project-local JSON | `/var/lib/perl` by default, owner-only and write-probed |
| Root filesystem | local workstation | declared read-only requirement; external runtime must enforce and attest it |
| Policy | absent | regular non-symlink file, mode `0600` or stricter, current and exact |
| Authority | synthetic only | synthetic only |

Set `PERL_REQUIRE_RUNTIME_POLICY=true` in any production-style launch. Startup fails if `PERL_RUNTIME_POLICY_FILE` is absent, unreadable, broadly permissioned, a symbolic link, stale, malformed, or outside the exact contract. The policy cannot be created or changed through the API.

## Probe semantics

- `GET /api/live` answers whether the Node process and HTTP handler are alive. It does not inspect repositories and remains a liveness signal while shutdown is draining.
- `GET /api/ready` checks policy mode, non-root identity when required, the writable owner-only state mount, application initialization, release/admission/promotion repository readability, and shutdown state. It returns `503` whenever the process is not ready or is draining.
- `GET /api/health` remains the richer synthetic operator view and now includes sanitized runtime-envelope state.

The probes are public status routes so an orchestrator does not need an application bearer assertion. Responses contain no policy body, path, public hostname, credential, record, PHI, or human identity; sensitive values are absent or fingerprinted.

## Graceful termination

`SIGTERM` and `SIGINT` atomically change readiness to draining, stop new HTTP acceptance, allow in-flight work to close, and apply the policy’s 5–60 second ceiling before force-closing remaining connections. Repeated signals do not create parallel shutdown flows. Runtime state continues to deny clinical, deployment, traffic, and patient-use authority.

## Container build assets

`deploy/Containerfile` is deliberately small:

- it has no default base image and requires `PERL_NODE_IMAGE` to be supplied as an approved digest-pinned Linux Node image;
- it runs no downloader or package installer;
- it copies only the already verified release archive context;
- it runs as numeric UID/GID `10001:10001`;
- it requires the runtime policy at `/run/perl/runtime-policy.json`;
- it exposes only internal port `4173`; and
- its bounded health check calls liveness, never readiness.

Run the local static rehearsal with:

```bash
npm run runtime:verify
```

An independently controlled pipeline must then build the exact verified archive using an approved reference of the form `registry/repository@sha256:<digest>`, enforce `--read-only`, mount exactly one read/write data volume at `/var/lib/perl`, mount the owner-only policy read-only at `/run/perl/runtime-policy.json`, drop Linux capabilities, prevent privilege escalation, apply CPU/memory/process limits, and retain the resulting evidence. The policy template is available at `deploy/runtime-policy.template.json` and through authenticated operations route `GET /api/operations/runtime/policy-template.json`.

## Failure modes

| Failure | Behavior |
|---|---|
| Missing required policy | startup fails closed |
| Root UID in controlled mode | startup fails closed |
| Stale or broadened policy | startup fails closed |
| Unsafe or unwritable state path | startup fails closed and removes its probe file |
| Corrupt release repository | readiness returns `503` |
| Shutdown requested | readiness returns `503`; runtime reports draining |
| Liveness timeout or malformed result | container health check exits non-zero |
| Mutable base reference or package-install step | static rehearsal fails |

## Evidence and authority boundary

The local rehearsal proves that the policy parser, startup gate, filesystem preparation, process-identity rule, probes, drain state, release packaging, and static Containerfile constraints behave as tested. It does **not** prove that a Linux image was built, that its root filesystem was actually mounted read-only, or that the image was scanned, license-approved, signed, published, deployed, monitored, connected to e-QPASS, approved for PHI, clinically validated, released for clinical use, activated for traffic, or permitted to process patient records.

Those external returns remain blocking evidence in the [Production Promotion Airlock](./RELEASE_PROMOTION_AIRLOCK.md) and the separate deployment, clinical-release, and traffic-activation controls.
