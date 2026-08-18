# PERL Deployment Candidate 2.47

PERL 2.47 is ready for deployment review: the clinician experience, Practice Studio, persistent API, evidence chains, release construction, health probes, security headers, source-file interlock, and container contract run through the same server-backed application path used by a deployment. A separately labeled GitHub-hosted evaluation surface adds direct synthetic scored-form entry and per-browser persistence for stakeholder testing.

This status is deliberately narrower than clinical release. The candidate accepts evaluation records only. It is not approved for PHI, authoritative e-QPASS traffic, clinical use, or patient-level decisions until the named external owners complete their duties.

## Use it like the deployed application

On the project Mac, double-click `Launch PERL.command`. It starts the persistent deployment-review runtime, waits for readiness, and opens:

```text
http://127.0.0.1:4173/
```

Equivalent terminal command:

```bash
npm run preview:deployment
```

Opening `index.html` directly is now an intentional interlock, not a fallback product. It explains that the source file cannot exercise persistence, safety mutation, audit history, server validation, release controls, or readiness and points the reviewer to the real application endpoint.

The deployment-review header reports:

- release candidate `2.47`;
- production-equivalent static and API path;
- live runtime readiness;
- persistent owner-only evaluation state; and
- the evaluation-data/no-PHI boundary.

## Verification

Run:

```bash
npm test
npm run evaluate
npm run runtime:verify
npm run verify:deployment
npm run release:build
npm run release:verify
npm run release:qualify
```

`verify:deployment` starts an isolated deployment-review instance and checks the health and readiness probes, exact presentation contract, index and JavaScript delivery, production server path, and all required browser security headers. It then removes only the temporary state directory it created.

The candidate returns all of these headers on static and API responses:

- no-store caching;
- same-origin content/resource isolation;
- a self-only Content Security Policy;
- camera, geolocation, and microphone denial;
- no referrer;
- MIME sniffing denial;
- frame denial; and
- cross-domain policy denial.

## Container path

`deploy/compose.production-review.yaml` exercises the verified `deploy/Containerfile` with:

- an approved digest-pinned Node base image supplied externally;
- non-root UID/GID `10001`;
- read-only root filesystem;
- one writable PERL data volume;
- one read-only owner-controlled runtime policy;
- all Linux capabilities dropped;
- privilege escalation denied;
- bounded process, memory, CPU, and temporary-filesystem resources;
- fixed liveness health check; and
- restart policy.

Prepare an exact current runtime policy from `deploy/runtime-policy.template.json`, make it mode `0600`, and then run:

```bash
cp deploy/production-review.env.example .env.production-review
cp deploy/runtime-policy.template.json deploy/runtime-policy.json
chmod 600 deploy/runtime-policy.json
docker compose --env-file .env.production-review -f deploy/compose.production-review.yaml up --build
```

The template values must be replaced with the approved HTTPS origin, current dates, policy identity, and approved digest-pinned base image before container startup.

## GitHub delivery

The repository contains three workflows:

- `Verify deployment candidate` runs the full regression, synthetic baseline, runtime envelope, deployment verification, and deterministic release build/verification on pull requests and `main`;
- `Publish immutable deployment candidate` is a manual workflow that accepts only a digest-pinned Node base image, reruns verification, and publishes the immutable commit-tagged image to GitHub Container Registry;
- `Publish hosted synthetic evaluation` verifies the app and deploys the public stakeholder evaluation to GitHub Pages.

The Pages experience is explicitly labeled as a self-contained synthetic evaluation. It stores entered test records only in that browser and does not claim the persistent API, production authentication, authoritative e-QPASS connectivity, PHI handling, or clinical activation. The controlled application deployment remains the server/container candidate.

## Meaning of “ready”

Ready now:

- product and responsive clinician experience;
- Practice Studio composition and constructed demographic lens;
- server persistence and tamper-evident local evidence;
- strict schemas and safety invariants;
- production-equivalent HTTP application path;
- deterministic release archive and qualification tooling;
- container startup contract, probes, shutdown, and hardening profile;
- private GitHub CI and container-publication workflow; and
- reviewable deployment-candidate language.

Still externally governed:

- Dolores’s final clinical-standard acceptance;
- authoritative e-QPASS fields, event lifecycle, PDF attachment, and acknowledgement;
- selected and approved production model/provider/transport;
- production OIDC/SSO, MFA, clinician and organization lifecycle, and record-level authorization;
- real demographic aggregation, suppression, fairness, and privacy approval;
- clinical validation and independent review;
- legal, privacy, security, accessibility, and data-retention acceptance;
- approved cloud environment, registry, signing, monitoring, backup, recovery, and incident ownership; and
- clinical release and traffic activation.

The interface may say `Deployment candidate` and `Ready for review`. It must not say PHI approved, clinically validated, released, live, or patient-use authorized until the separate signed evidence paths establish those facts.
