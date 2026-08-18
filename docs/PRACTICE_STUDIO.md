# PERL Practice Studio

Package `perl-synthetic-calibration-package/2.45` adds a deliberate second experience to PERL without changing schema 49 or the forty-seven clinical-evidence integrity families.

## Two modes, one evidence truth

`Clinical / Front` is the clinician-facing working surface. It keeps the assessment queue, review, progress, and fieldwork flows close to the work of reading and deciding.

`Practice / Studio` is a display-composition surface. It lets an operator choose a clinician context, care setting, reading emphasis, information density, default experience, and optional modules. The saved profile affects presentation only. It cannot change scored source data, generated content, safety routing, permissions, approval state, model behavior, release state, or any evidence fingerprint.

Safety, limitations, and clinician approval are locked visible in every composition. Role labels are contextual language—not authentication, licensure, scope, or authorization.

## Clinician context

The first package includes four explicit working contexts:

- licensed clinician;
- clinical supervisor;
- care coordinator;
- operations lead.

It also includes four settings—university counseling, community behavioral health, private practice, and utilization review—and four reading emphases: balanced, safety first, evidence first, and conversation first. These choices adjust hierarchy and microcopy only. They do not create a different clinical record.

Optional modules are metadata, evidence, patterns, questions, quality, handoff, lineage, and audit. A user may remove them from their composition. The three locked surfaces remain visible regardless of profile.

## Demographic lens

The first demographic lens is deliberately constructed aggregate data: 42 synthetic encounters across age band, gender, first-generation status, and service language. Every rendered cell has at least five observations. The interface exposes the total and the minimum-cell rule beside the visualization.

The lens contains no person rows, identifiers, PHI, diagnosis, eligibility, prioritization, coverage, or care recommendation. It cannot be used for person-level decisions. A production cohort view requires an approved measure definition, authoritative denominators, suppression policy, fairness review, access control, privacy review, and governed provenance before any real data can replace the constructed fixture.

## Persistence and integrity

Display profiles persist in `data/workspace-experience.json`, separate from `data/sandbox-state.json`. Each actor code has its own latest profile. Saves are atomic and append an immutable hash-linked `perl-workspace-profile-event/1.0` receipt; replay and tampering fail closed.

This separate ledger is intentional. Workspace preference history is useful engineering evidence, but it is not assessment evidence and is excluded from the clinical calibration package.

API:

- `GET /api/workspace/experience` returns the current actor's normalized profile, available options, aggregate demographic fixture, chain status, and full boundary;
- `PUT /api/workspace/experience` accepts `{ "profile": ... }`, validates the closed contract, and saves an idempotent display-profile event.

## Visual direction

The product uses a restrained editorial and industrial-design language: forest, paper, brass, and rust; generous breathing room; typographic hierarchy; crisp dividers; and physical-feeling controls. The Studio introduces no decorative gradients, chatbot chrome, glowing AI motifs, generic metric tiles, or speculative automation language. Motion is minimal and respects reduced-motion preferences.

The design aim is calm concentration: the interface recedes, evidence remains legible, and the boundary between display preference and clinical authority stays visible.

## Production replacement gate

Before real provider deployment, the display repository needs authenticated tenant and user ownership, policy-governed organization defaults, profile migration, centralized audit retention, and role lifecycle integration. The demographic lens additionally needs approved aggregation jobs, row-level access controls, small-cell and intersectional suppression, bias and fairness review, source freshness, error recovery, and named privacy and clinical owners.

Until those controls are accepted, the Studio remains a synthetic local prototype and cannot process PHI or establish clinical validity, pilot readiness, production release, or patient use.
