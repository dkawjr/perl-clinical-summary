# PERL integration contract

## Purpose

This contract defines the seam between validated e-QPASS scoring and PERL’s clinical-summary workflow. It allows Focused Future to calibrate the product now without pretending the current local sandbox is production infrastructure.

The production principle is simple: **e-QPASS scores; PERL interprets scored output for human review.** A generative model must never calculate validated scale scores, override critical-screen logic, or authorize release.

## Current runtime boundary

`npm start` launches one local process containing:

- the static clinical-review interface;
- a loopback-only JSON API;
- a file-backed synthetic sandbox store;
- deterministic score classification and safety rules;
- a strict calibration-only adapter for the proposed e-QPASS scored event, with an idempotent hash-linked receipt chain;
- a bounded provider-workflow orchestrator with automatic review routing, post-approval preparation, retry state, and its own hash-linked event chain;
- a durable delivery outbox with a disabled-by-default connector, explicit synthetic authorization, strict acknowledgements, bounded retries, dead-letter state, interrupted-attempt recovery, and its own hash-linked event chain;
- a schema-16 isolated synthetic restore rehearsal with exact file/state fingerprints, complete collection-count reconciliation, all-ledger verification, owner-only copy controls, verified cleanup, and a separate hash-linked evidence chain;
- a schema-17-introduced local application-compatibility rehearsal with a current 154-file schema-49 engineering manifest, five pinned runtime versions, state/report/generation checks, frozen safety replay, current-schema restore prerequisite, and a separate non-deployment evidence chain;
- a schema-18 local operational matrix with eight inspectable controls, three explicit production gaps, local unsent alert evidence, and a separate point-in-time monitoring chain;
- a schema-19 local incident-response tabletop with four severity levels, six frozen scenarios, a four-stage response arc, current continuity prerequisites, an unassigned five-role owner tree, and a separate hash-linked rehearsal chain;
- a schema-20 pilot-readiness dossier with seven local evidence patterns, seven external decision gates, a fixed ten-role authority register, and a separate hash-linked blocked-snapshot chain;
- a schema-21 clinical-standard register with seven bounded measures, four fixed zero-tolerance safety limits, immutable pre/post-outcome working drafts, and a separate hash-linked draft chain;
- a schema-22 independent-review dossier with six fixed review domains, four local evidence patterns, six externally owned decisions, eight controlled inputs, one exact verified counselor-reference dependency when current, and a separate hash-linked local-evidence seal;
- a schema-23 e-QPASS Owner Return Desk with eight fixed artifact classes, a strict metadata-only manifest, no-content/no-authority claim flags, and a separate hash-linked preflight ledger whose only decision keeps the RFI open;
- a schema-24 Counselor Session Notebook with three fixed sessions, fifteen fixed decision questions, enum-only observations, point-in-time evidence pinning, no free-text intake, and a separate non-authorizing linked history;
- a schema-25 synthetic Progress Review with a frozen two-fixture series, exact raw deltas, shared-subscale detail, deterministic per-point safety routing, a rules-only affirming Conversation Brief, four evidence-linked provider priorities, a printable rehearsal addendum, enum-only next-question observations, and a separate non-authorizing linked history;
- a schema-26 Model Trial Bench with exactly three candidate slots, six shared evidence domains, strict 64 KB metadata-only preflight, no provider call or external transfer, false selection/authority claims, and a separate hash-linked event chain;
- a schema-27 Candidate Trial Foundry with nine held candidate runs, twelve balanced blind cells, six ordered measures, seven permission gates, no provider payload/output/call, false execution/selection/authority claims, and a separate hash-linked planning chain;
- a schema-28 Intended Use Charter with three provider contexts, four ordered audiences, eight prohibited uses, five external acceptances, evidence-pinned immutable working drafts, and false approval/validation/release claims in a separate hash-linked chain;
- a schema-29 Language Review Office with nine exact live clauses, six clinical/counsel questions, five outside acceptance roles, evidence-pinned immutable working packets, and false acceptance/approval/freeze/validation/release claims in a separate hash-linked chain;
- a schema-30 External Decision Exchange with seven one-to-one readiness requests, strict 64 KB metadata returns, stable evidence-bound request fingerprints, stale-return detection, false identity/authority/acceptance claims, and a separate hash-linked preflight chain;
- a schema-31 Provider Pilot Operations Studio with two source-reported provider pathways, four review moments, six denominator-first measures, seven admission decisions, provisional commercial terms, and a separate non-authorizing planning chain;
- a schema-32 Provider Activation Workbook with eight observable objectives, four synthetic drills, ten governed returns, and a separate chain that cannot record attendance, competency, completion, activation, or use;
- a schema-33 Named-Site Admission Dossier with two candidate-specific packets, six admission books, twelve evidence questions, five authority roles, strict 96 KB metadata preflight, and a separate non-authorizing chain;
- a schema-34 Governed Authority Trust Bridge with an owner-only startup Ed25519 registry, 36 candidate- and scope-bound assertions, exact 24-hour challenges, strict 64 KB signed metadata receipts, replay protection, and a thirty-first chain whose complete authority state still cannot start or release a pilot;
- a schema-35 Governed Pilot-Start Interlock with a separate owner-only startup registry, distinct Ed25519 start-order and deployment-acknowledgement duties, exact fifteen-minute evidence-bound challenges, maximum four-hour deployment windows, and a thirty-second chain that can record only a provider-preparation environment start while live clinical traffic, production release, patient use, and care decisions remain false;
- a schema-36 Governed Clinical Release Gate with a third owner-only startup registry, three distinct Ed25519 duties, exact twenty-minute authority/preparation/continuity-bound challenges, provider-first bounded clinical/patient-use scope, exact preparation-matched production release, eight-control deployment attestation, and a thirty-third chain that can record release readiness only while clinical traffic, pilot start, patient records, and first-transaction authority remain false;
- a schema-37 Clinical Traffic Activation Witness with a fourth owner-only startup registry, three distinct Ed25519 duties, exact fifteen-minute release/continuity-bound challenges, identical clinical/operations activation plans, bounded deployment and endpoint-policy fingerprints, a separately observed first governed transaction, and a thirty-fourth metadata-only chain with no registry-write, endpoint, traffic, record, credential, or PHI control;
- a schema-38 Identity & Access Perimeter with an owner-only startup policy, exact short-lived Ed25519 JWT verification, seven fixed least-privilege roles, route-class RBAC, 401/403 enforcement, memory-only client token injection, and a thirty-fifth sanitized mutation-grant chain with no token, password, name, or PHI storage;
- a model-agnostic structured generation gateway, currently bound to the deterministic calibration provider, with materialized input/output-hashed snapshots;
- a package-2.26 startup-only HTTPS model transport bridge that can connect one synthetic candidate through an owner-only policy, environment-held credential, idempotency key, bounded JSON exchange, abort propagation, and zero retry or fallback while exposing no endpoint or secret through product status;
- a package-2.27 state-independent Release Candidate Foundry that creates a byte-reproducible runnable archive, exact manifest, CycloneDX 1.6 SBOM, in-toto/SLSA provenance, startup configuration contract, external Ed25519 signing request, and owner-only content-addressed repository while excluding runtime state, credentials, private keys, PHI, and unpinned workspace output.
- a package-2.28 Release Admission Laboratory that exercises the exact archive through six fixed local gates in an owner-only ephemeral copy and preserves content-bound immutable evidence while keeping isolated CI, network enforcement, external vulnerability/license approval, production signing, deployment, clinical validation, release, traffic, and patient use external.
- a package-2.29 Production Promotion Airlock that binds that exact locally qualified archive to ten external CI, scan, license, OCI, registry, signature, compatibility, rollback/reconciliation, and telemetry/runbook gates; verifies only a complete request-bound external Ed25519 return under an owner-only startup policy; and preserves deployment, clinical release, traffic, and patient-use authority as separate external controls.
- a package-2.30 Production Runtime Envelope that permits all-interface binding only under a current owner-only exact policy, fixes internal port `4173`, requires a known non-root process plus upstream TLS and immutable-root/writable-state/read-only-secret semantics, separates public liveness and readiness, and drains on termination while every build, deployment, PHI, clinical, traffic, and patient-use authority remains false.
- a package-2.31 Counselor Fieldwork Room that composes the existing summary-review, blind-comparison, Counselor Lab, Session Notebook, safety, Intended Use, Language Review, and Provider Activation contracts into a responsive provider-side runway without adding identity, roster, attendance, transcript, narrative-note, PHI, completion, acceptance, or release fields.
- a package-2.32 `perl-clinical-brief/1.0` projection that exposes overall distress, four core dimensions, evidence-linked themes, deterministic mixed-signal prompts, critical-screen red flags, five draft-quality states, and five explicit limitations on assessment detail, immutable approval artifacts, study-package export, the responsive review document, and the one-page Letter clinician attachment; it never adds raw response wording, a diagnostic conclusion, a treatment decision, or an invented specificity metric.
- a package-2.33 `perl-counselor-reference-draft/1.0` source-only authoring contract that exposes only scored synthetic development evidence, omits generated content and the frozen holdout, requires evidence-bound themes, explicit uncertainty, direct questions, tone markers, and the exact safety disposition, stores one immutable candidate per reviewer code and case, and keeps identity verification, acceptance, adjudication, protocol freeze, validation, clinical release, and patient use outside the API.
- a package-2.34 `perl-counselor-reference-adjudication-dossier/1.0` actor-aware comparison contract that reveals anonymous candidate content only after the current reviewer has independently drafted that case, exposes no candidate author code, treats citation overlap as structure rather than semantic agreement, preserves dissent, seals hash-linked evidence idempotently, and keeps identity, independence, adjudicator assignment, reference decision, protocol freeze, validation, trial, release, and patient-use authority outside the API.
- a package-2.35 `perl-counselor-reference-decision-docket/1.0` return contract that loads four purpose-bound public keys only from an owner-only startup registry, issues exact 24-hour dossier/source/registry challenges, verifies four ordered Ed25519 metadata attestations, preserves case dissent and no-vote adjudication, and records the thirty-eighth integrity chain while key provisioning, signing, transmission, validation, trial, release, traffic, and patient use stay outside PERL.
- a package-2.36 `perl-independent-review-admission-docket/1.0` return contract and schema-42 thirty-ninth integrity chain that load seven distinct purpose-bound public keys only from an owner-only startup registry, bind an exact current independent-review seal to the verified counselor-reference freeze and Clinical Standard draft, issue exact 24-hour challenges, verify seven ordered Ed25519 metadata attestations, and establish only execution readiness while result submission, performance claims, validation, pilot, release, and patient use stay outside PERL.
- a package-2.37 `perl-campus-operations-observatory/1.0` projection and schema-43 fortieth integrity chain that expose aggregate synthetic workflow counts, six denominator-first measures, four operating-review moments, provider-training readiness, zero student record rows, and enum-only customization postures while every site, source-denominator, identity, training, quarter, outcome, pilot, production, patient-use, and PHI claim remains false.
- a package-2.38 `perl-manual-candidate-return/1.0` seam and schema-44 forty-first integrity chain that accept one through nine structured outputs only for the exact current synthetic Candidate Trial envelopes after three candidate metadata declarations are complete; validate exact run/case/protocol/candidate/provider/model/prompt/policy provenance plus all ten generation gates; expose no output prose in the desk; perform no provider call; reject raw responses, files, identities, credentials, endpoints, Findings content, records, and PHI; and keep execution, review, performance, selection, care, pilot, production, and patient-use claims false.
- a package-2.39 `perl-candidate-blind-review/1.0` seam and schema-45 forty-second integrity chain that open only after all nine current returns, an accepted/frozen/content-resolved three-case counselor reference set, a pre-outcome standard, and active study control; expose one scored synthetic source beside four summaries labeled only A–D; accept fixed ratings, correction burden, correction/dissent flags, and use disposition; derive agreement only across distinct reviewer overlap; preserve the hidden mapping only in the immutable event; and expose no candidate/provider/model/prompt/counselor authorship, scorecard, ranking, winner, selection, modification authority, clinical validity, pilot, production, patient-use, raw response, Findings content, file, credential, identity, or PHI claim.
- a package-2.40 `perl-candidate-refinement-retest/1.0` seam and schema-46 forty-third integrity chain that require six current packets with independent overlap on all three frozen cases; decode the concealed mapping only inside the store; expose three fixed anonymous lanes without scores or ordering; hold unsafe lanes for triage; and let one correction signal recurring across every case and at least two reviewer codes scope one declared intervention and three content-free same-case envelopes while modification, execution, return, improvement, performance, ranking, selection, clinical, pilot, production, patient-use, identity, content, credential, and PHI claims remain false.
- a package-2.41 `perl-candidate-retest-return/1.0` seam and schema-47 forty-fourth integrity chain that accept one through three structured synthetic outputs only when the exact cycle, lane, case, baseline artifact, retest protocol, candidate fingerprint, provider/model, new prompt version, one intervention, generation contract/policy, and ten output gates remain current; duplicate identical returns are idempotent, changed returns conflict, returned prose remains absent from the public desk, and external execution, improvement, performance, selection, clinical, pilot, production, and patient-use claims remain false.
- a package-2.41 `perl-candidate-retest-rereview/1.0` seam and schema-47 forty-fifth integrity chain that issue 24-hour same-source X/Y packets, conceal baseline/retest mapping before and after submission, preserve four ratings per cell, correction burden, correction/dissent flags, use disposition, and one bounded paired-difference disposition, and require two distinct reviewer codes across all three cases before reporting local paired-evidence completion; independent accuracy/reliability disposition remains separately signed and external.
- a package-2.42 `perl-candidate-retest-independent-disposition/1.0` seam and schema-48 forty-sixth integrity chain that bind one completed same-case cycle, three upstream heads, decoded content-free X/Y analysis, admitted independent-review protocol, Clinical Standard, and a startup-only four-key registry into one exact 24-hour challenge; verify ordered independent accuracy, independent reliability, Clinical Standard satisfaction, and result-freeze Ed25519 returns; and expose only exact-cycle outcomes/recommendations while cycle close, generalized performance, clinical validation, engine selection, release, traffic, and patient-use claims remain false.
- a package-2.43 `perl-exact-candidate-advancement-airlock/1.0` seam and schema-49 forty-seventh integrity chain that first freezes close, continue, or hold for the exact cycle through two ordered duties, reveals exact candidate provenance only after a signed close plus upstream advancement recommendation, and then verifies four ordered clinical-suitability, privacy/security transport-fit, e-QPASS integration-fit, and product-sponsor freeze duties; it may advance only that exact candidate to integration-readiness work while provider/model-wide approval, production selection, transport, pilot, deployment, release, traffic, records, patient use, and care claims remain false.

The server binds to `127.0.0.1`, writes `data/sandbox-state.json` with owner-only permissions, emits explicit non-PHI environment metadata, limits JSON bodies to 512 KB, and sends CSP, frame, referrer, MIME, and permissions-policy headers.

This improves workflow fidelity and testability; it is not a HIPAA or SOC 2 control claim.

## Sandbox input and production transport

The current synthetic sandbox shape is [assessment.schema.json](../schemas/assessment.schema.json). It is an application record for workflow rehearsal, not a production wire contract. Its `FF-TEST-` identifier, synthetic source rule, reviewer, and workflow status intentionally prevent it from being mistaken for a live e-QPASS event. The runtime also applies semantic checks that JSON Schema alone cannot communicate clearly to a reviewer:

- IDs must begin with `FF-TEST-`;
- the source label must explicitly say the fixture is synthetic;
- all nine required scale values must be non-negative integers in supported ranges;
- the record must declare 105 answered items;
- subscale and critical-response arrays must be present;
- common direct-identifier field names are rejected recursively.

The sandbox payload is intentionally downstream of scoring. It does not contain name, email, phone, date of birth, address, medical-record number, or free-form respondent identity.

It also does **not** contain clinical hypotheses, follow-up questions, narrative prose, or the derived clinical brief. Those are PERL outputs defined by [clinical-interpretation.schema.json](../schemas/clinical-interpretation.schema.json), [clinical-summary.schema.json](../schemas/clinical-summary.schema.json), and [clinical-brief.schema.json](../schemas/clinical-brief.schema.json). Human-authored synthetic examples live in `src/calibration-references.js`; they are calibration references, not e-QPASS input.

The production transport must be separate. [eqpass-scored-event.proposed.schema.json](../schemas/eqpass-scored-event.proposed.schema.json) defines an `rfi-0.1` envelope so the e-QPASS owner can return authoritative names, code sets, versioning, lifecycle, and report references. It is explicitly marked `proposed-rfi-only` and does not authorize PHI processing. The [Owner Return Desk](./EQPASS_OWNER_RETURN_DESK.md) makes the requested source package executable as eight metadata classes—including the two exact Mike workbook names—without accepting their bytes or contents. Even an eight-of-eight result remains `metadata-complete-unverified` and cannot replace the RFI.

The proposed envelope separates routing, scoring, and source-report zones. The model projection is scoring only. Tenant, subject, assessment, report, correlation, and idempotency references stay in the approved application boundary; name, date of birth, contact details, demographics, examiner details, raw item responses, and free-text notes are omitted by default.

The repository now rehearses that proposal in executable code. [eqpass-adapter.js](../src/eqpass-adapter.js) accepts only `calibration` events whose references are visibly synthetic, requires a finalized hashed Findings PDF, requires the exact local fourteen-subscale RFI codebook, preserves source-supplied severity levels, and fails closed on rescoring until an authoritative supersession contract exists. [model-input.js](../src/model-input.js) constructs the only provider payload: answered-item count, scored scales, source levels, fourteen scored subscales, and bounded critical flags. Application routing and report references never enter that projection.

Each accepted source event creates a [source-event-receipt.schema.json](../schemas/source-event-receipt.schema.json) receipt containing hashes and version provenance rather than raw routing references. Duplicate event/key pairs with the same source digest return the existing result; changed content conflicts. These are engineering controls for synthetic rehearsal, not proof of an e-QPASS connection, production identity, PHI authorization, or an immutable external event service.

Each accepted source event now records `review-queued` immediately; this rehearses the “no extra intake step” requirement without automating clinical judgment. After a clinician approves the source-linked artifact, PERL automatically records a handoff job and prepares the outbound manifest. The deterministic idempotency key is derived from the immutable artifact hash. PERL verifies that the artifact is still approved, matches the current scored assessment, and is linked to the same source-event receipt, scoring version, and Findings version/hash. It then records an [attachment-preparation-event.schema.json](../schemas/attachment-preparation-event.schema.json) event containing only hashes and version provenance and a linked [provider-workflow-event.schema.json](../schemas/provider-workflow-event.schema.json) completion. The state is deliberately `prepared-not-attached`: the sandbox hashes its exact approved HTML rendition but does not generate a production PDF, call e-QPASS, or claim an attachment occurred. A preparation failure preserves approval, records a bounded failure, and permits an idempotent operator retry. A later clinical edit makes the prior preparation historical and requires a new approved artifact.

Package 2.44 makes this line directly operable in the [Findings-to-Summary Automation Atelier](./INTEGRATION_AUTOMATION_ATELIER.md). Its derived observatory projects all six existing evidence stages and compares the materialized generation provider with the exact candidate advancement freeze across provider ID, model version, prompt version, output contract, policy version, and policy hash. It does not create a parallel source of truth or a new ledger; a mismatch becomes an attention state, and the clinician decision remains a deliberate pause.

Package 2.45 adds the [Practice Studio](./PRACTICE_STUDIO.md) as a separate presentation contract around this evidence line. The Studio may tailor hierarchy, density, clinician context, and optional modules, but it cannot change source, generation, review, delivery, safety, authorization, or release state. Its actor-specific preferences and constructed demographic lens live outside the clinical state/package; the demographic fixture has no person rows or decisioning authority, and every displayed cell meets the explicit minimum of five.

Preparation now commits a separate immutable job to the [delivery outbox](./DELIVERY_OUTBOX_CONTRACT.md). With the default connector, the job remains `awaiting-authorized-connector` and no attempt or network call occurs. A connector can be injected only with explicit synthetic-calibration authorization. PERL persists an attempt before transport, requires an exact request-bound acknowledgement whose terminal state is `rehearsed-not-attached` and whose `remoteWriteClaimed` value is false, schedules explicit retries after attempts one and two, and dead-letters attempt three. Startup converts an interrupted in-flight attempt into a reviewable retry state without assuming a remote outcome. These controls rehearse delivery reliability; they do not supply the authoritative e-QPASS endpoint, PDF merge, service identity, PHI authorization, or attachment acknowledgement.

Production e-QPASS must supply both the score and source severity level for every scale and subscale, plus the scoring version. PERL must not calculate GPI, reconstruct score bands, or infer critical-screen routing from raw responses. The full field-level request, lifecycle, error semantics, security questions, and adapter acceptance tests are in [EQPASS_PRODUCTION_MAPPING_RFI.md](./EQPASS_PRODUCTION_MAPPING_RFI.md).

## API surface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Environment, persistence, model, and PHI-approval status |
| `GET` | `/api/security/identity/public` | Public identity mode, enforcement, trusted-key count, and explicit no-SSO/no-token/no-PHI boundary |
| `GET` | `/api/security/identity` | Protected sanitized startup-policy summary, fixed role book, authenticated mutation-grant history, and chain integrity |
| `GET` | `/api/security/identity/policy-template.json` | Protected shape-only startup-policy template; placeholder key is invalid and no policy-write route exists |
| `GET` | `/api/integration/eqpass/events` | Return the RFI-rehearsal boundary, source-receipt chain, and non-authoritative status |
| `POST` | `/api/integration/eqpass/events` | Strictly validate and idempotently import one synthetic proposed e-QPASS scored event |
| `GET` | `/api/integration/owner-return` | Return the fixed eight-artifact register, latest metadata-only preflight, counts, fingerprint, chain, and no-authority boundary |
| `GET` | `/api/integration/owner-return/request.json` | Download the strict metadata-only candidate-return template |
| `POST` | `/api/integration/owner-return/preflight` | Record completeness metadata without receiving source files, records, PHI, verified identity, source authority, or integration approval |
| `GET` | `/api/integration/eqpass/attachments` | Return the synthetic attachment-preparation boundary, events, and chain integrity |
| `POST` | `/api/integration/eqpass/attachments` | Prepare an idempotent hash-bound handoff for the current approved source-linked artifact; never claims attachment |
| `GET` | `/api/integration/rehearsal` | Inspect the privacy-minimized six-stage Findings-to-summary observatory and exact-candidate binding verdict |
| `POST` | `/api/integration/rehearsal/runs` | Create one unique canonical synthetic source event, materialize its summary, and pause at clinician review |
| `GET` | `/api/integration/workflow` | Return provider-workflow counts, exact events, linked integrity, and the disabled production-write boundary |
| `POST` | `/api/integration/workflow/:assessmentId/retry` | Retry only the failed preparation job for the current approved artifact without creating a duplicate attachment receipt |
| `GET` | `/api/integration/delivery` | Return connector authorization state, outbox counts, bounded job state, and linked integrity without attachment content |
| `POST` | `/api/integration/delivery/:jobId/process` | Run only a ready job through an explicitly injected synthetic connector; disabled by default |
| `POST` | `/api/integration/delivery/:jobId/retry` | Explicitly requeue and process a retry-wait job; a dead-lettered job cannot silently reset its attempt budget |
| `GET` | `/api/operations/campus-observatory` | Return the aggregate-only provider-operations view, two source-backed candidate pathways, six denominator-first measures, training readiness, snapshot history, and fortieth chain state |
| `GET` | `/api/operations/campus-observatory.json` | Download the current aggregate-only observatory evidence package |
| `POST` | `/api/operations/campus-observatory/snapshots` | Append one candidate/review-moment/customization posture with no record, narrative, identity, file, or authority field |
| `GET` | `/api/operations/release` | Return sanitized Release Candidate Foundry status, the latest verified candidate, content totals, trust state, and false deployment/clinical authority claims |
| `GET` | `/api/operations/release/admission` | Return current-candidate local admission status, exact latest evidence, bounded history, and false outside-authority claims |
| `POST` | `/api/operations/release/candidates/:id/admission/run` | Run the six fixed archive-resident local gates and store a content-bound report |
| `GET` | `/api/operations/release/admissions/:id/report.json` | Download the revalidated immutable local admission report |
| `POST` | `/api/operations/release/build` | Build or idempotently resolve the exact current PHI-excluding content-addressed release candidate |
| `GET` | `/api/operations/release/candidates/:artifactId/archive` | Download the verified byte-reproducible runnable tar/gzip artifact |
| `GET` | `/api/operations/release/candidates/:artifactId/manifest.json` | Download the exact internal content manifest |
| `GET` | `/api/operations/release/candidates/:artifactId/configuration.json` | Download the startup configuration contract |
| `GET` | `/api/operations/release/candidates/:artifactId/sbom.cdx.json` | Download the CycloneDX 1.6 SBOM |
| `GET` | `/api/operations/release/candidates/:artifactId/provenance.json` | Download the in-toto/SLSA provenance statement |
| `GET` | `/api/operations/release/candidates/:artifactId/signing-request.json` | Download the external Ed25519 artifact-integrity signing request |
| `GET` | `/api/operations/release/trust-policy-template.json` | Download the disabled-by-default owner provisioning template; no trust-policy write route or private-key input exists |
| `POST` | `/api/operations/release/signatures/verify` | Verify and pin an external exact-artifact signature only when a current startup trust policy authorizes its key |
| `GET` | `/api/assessments` | Queue plus durable review state |
| `GET` | `/api/assessments/:id` | Assessment, narratives, interpretation, review state, feedback, audit, and linked revision lineage |
| `GET` | `/api/assessments/:id/report.html` | Render the current review draft or the exact approved clinician attachment for printing or PDF export |
| `GET` | `/api/assessments/:id/report-package.html` | Render the five-page Letter assembly proof only after a source-linked approved artifact is prepared; pages one through four remain explicit source-owned placeholders and no merge or attachment is claimed |
| `GET` | `/api/assessments/:id/report-package.json` | Download the metadata-only page order, source/artifact lineage, false-claim fields, and assembly-proof fingerprint |
| `GET` | `/api/assessments/:id/handoff/:audience.html` | Render a care, payer, or minimum-necessary administrative preview; rejects clinician and unknown audiences because only the dedicated clinician route can represent approval |
| `POST` | `/api/assessments/import` | Validate and persist one synthetic canonical fixture |
| `PUT` | `/api/assessments/:id/narratives/:audience` | Save a reviewer revision after the server language guard passes |
| `PUT` | `/api/assessments/:id/interpretation` | Save evidence-locked hypothesis/question revisions with version and changed-section provenance |
| `POST` | `/api/assessments/:id/safety-ack` | Persist explicit critical-screen acknowledgement |
| `POST` | `/api/assessments/:id/approve` | Approve only when deterministic safety rules allow it |
| `POST` | `/api/assessments/:id/feedback` | Persist structured error categories and reviewer notes |
| `GET` | `/api/calibration/next` | Issue or resume the active reviewer’s blinded human-reference versus PERL case without author mapping; return reviewer case-set progress |
| `POST` | `/api/comparisons` | Persist paired A/B quality ratings, blind preference, and comments |
| `GET` | `/api/calibration/timing/next` | Issue or resume one balanced unaided-synthesis or PERL-assisted-review workflow task with the same scored-source projection |
| `POST` | `/api/calibration/timing` | Validate the final timed summary, calculate server duration, and commit one linked workflow observation |
| `GET` | `/api/calibration/metrics` | Derive queue/hold/correction counts plus blinded PERL preference and mean quality ratings |
| `GET` | `/api/calibration/analysis` | Descriptive blind-study results, denominator-first release evidence, reported-event exposure, Wilson interval, median/IQR ratings, repeated-case agreement, and explicit readiness limits |
| `GET` | `/api/calibration/intake.json` | Download the aggregate-only source-library intake map, five pre-transfer gates, nine required returns, prohibited-content boundary, live synthetic case coverage, and stable fingerprint |
| `GET` | `/api/calibration/model-trial` | Return exactly three candidate lanes, six evidence domains, completeness counts, current deterministic comparator provenance, immutable preflight history, chain state, and false selection/authority claims |
| `GET` | `/api/calibration/model-trial/request.json` | Download the strict metadata-only three-candidate request template |
| `POST` | `/api/calibration/model-trial/preflight` | Validate and append one candidate metadata preflight without receiving evidence files, calling a provider, or selecting an engine |
| `GET` | `/api/calibration/model-trial.json` | Download the current non-authorizing Model Trial Bench |
| `GET` | `/api/calibration/candidate-trial` | Return the nine held candidate runs, twelve balanced blind cells, six measures, seven permission gates, current evidence, history, chain, and no-execution boundary |
| `POST` | `/api/calibration/candidate-trial/snapshot` | Seal the current planning evidence without executing a run, calling a provider, receiving output, or authorizing review |
| `GET` | `/api/calibration/candidate-trial.json` | Download the current non-authorizing Candidate Trial protocol |
| `GET` | `/api/calibration/candidate-returns` | Return the content-closed nine-envelope desk, structural receipt counts/history, fingerprints, chain, and false performance/selection/authority claims |
| `GET` | `/api/calibration/candidate-returns/request.json` | Download nine current fingerprinted empty return envelopes; no case payload is included |
| `POST` | `/api/calibration/candidate-returns/outputs` | Validate and immutably seal one through nine exact structured synthetic returns without calling or verifying a provider or rendering candidate content |
| `GET` | `/api/calibration/candidate-returns.json` | Download the content-free Candidate Return Desk evidence package |
| `GET` | `/api/calibration/candidate-review` | Return the actor-aware six-gate Candidate Review desk, aggregate cells/overlap/correction counts, content-free history, chain, and zero-ranking boundary |
| `POST` | `/api/calibration/candidate-review/assignments` | Issue or resume one 24-hour scored-source packet containing four summaries labeled only A–D; never return the concealed author mapping or reviewer code |
| `POST` | `/api/calibration/candidate-review/outcomes` | Validate and immutably seal one complete four-cell structured review while withholding authorship in the public receipt |
| `GET` | `/api/calibration/candidate-review.json` | Download aggregate Candidate Blind Review evidence without pending summaries, mappings, candidate scores, rankings, or selection |
| `GET` | `/api/calibration/candidate-refinement` | Return six-gate readiness, three fixed anonymous lane portraits, eligible recurrence signals, content-free cycle history, and zero-score/zero-ranking boundaries |
| `POST` | `/api/calibration/candidate-refinement/cycles` | Scope one exact eligible correction signal into one declared intervention and three baseline-bound same-case envelopes; perform no modification or provider call |
| `GET` | `/api/calibration/candidate-refinement.json` | Download the content-free Candidate Refinement desk and forty-third-chain state |
| `GET` | `/api/calibration/candidate-refinement/cycles/:cycleId/retest-kit.json` | Download one actor-free, identity-free, content-free retest kit for separate manual execution |
| `GET` | `/api/calibration/candidate-retest?cycleId=:cycleId` | Return the actor-aware selected-cycle studio, six gates, content-free cycle/receipt history, two new chain states, and zero-improvement/zero-ranking boundaries |
| `GET` | `/api/calibration/candidate-retest/cycles/:cycleId/return-kit.json` | Download three exact baseline-bound structured-return envelopes for the selected cycle; no source or baseline prose is included |
| `POST` | `/api/calibration/candidate-retest/returns` | Validate and immutably seal one through three exact structured same-case retest outputs without performing or verifying the external model change or provider run |
| `POST` | `/api/calibration/candidate-retest/reviews/assignments` | Issue or resume one 24-hour same-source packet containing two summaries labeled only X and Y; never return the baseline/retest mapping or reviewer code |
| `POST` | `/api/calibration/candidate-retest/reviews/outcomes` | Validate and immutably seal one complete paired reading with ratings, correction/dissent, use, difference, and concealed mapping while publishing no comparative result |
| `GET` | `/api/calibration/candidate-retest.json` | Download aggregate Same-Case Retest & Re-Review evidence without pending summaries, mappings, comparative outcomes, improvement, ranking, or selection |
| `GET` | `/api/calibration/candidate-retest/disposition?cycleId=:cycleId` | Return the selected exact-cycle result docket, two prerequisites, four purpose duties, bounded outcomes, history, and authority ceiling |
| `GET` | `/api/calibration/candidate-retest/disposition.json?cycleId=:cycleId` | Download the content-free exact-cycle result docket |
| `GET` | `/api/calibration/candidate-retest/disposition/registry-template.json` | Download a shape-only four-key startup registry template; no private key or registry write occurs |
| `POST` | `/api/calibration/candidate-retest/disposition/challenges` | Issue or idempotently reuse one 24-hour exact-evidence result challenge after both prerequisites and four current purpose keys exist |
| `GET` | `/api/calibration/candidate-retest/disposition/challenges/:challengeId.json` | Download the active exact-evidence challenge for external signing |
| `POST` | `/api/calibration/candidate-retest/disposition/attestations/verify` | Verify and append the next ordered 64 KB metadata-only Ed25519 result duty; perform no external transmission or local signing |
| `GET` | `/api/calibration/counselor-lab.json` | Download the fixed three-session language/safety, usefulness/workflow, and freeze/handoff plan, eight preflight returns, live synthetic evidence counts, false clinical claims, and stable fingerprint |
| `GET` | `/api/calibration/counselor-notebook` | Return the fixed fifteen-decision notebook, current local coverage, append-only history, integrity chain, catalog fingerprint, and false session/clinical/authority claims |
| `POST` | `/api/calibration/counselor-notebook/entries` | Validate and append one enum-only local rehearsal observation with a pinned synthetic evidence snapshot and optional `FF-TEST-*` case reference |
| `GET` | `/api/calibration/counselor-notebook.json` | Download the current non-authorizing Counselor Session Notebook |
| `GET` | `/api/calibration/clinical-standard` | Return the seven-measure drafting contract, fixed safety limits, live outcome-evidence state, latest immutable working version, history, chain, and false authority claims |
| `POST` | `/api/calibration/clinical-standard/drafts` | Validate and commit a new immutable working draft with evidence-time counts and chain heads; never accepts or freezes the standard |
| `GET` | `/api/calibration/clinical-standard.json` | Download the clinical-standard draft register and integrity summary |
| `GET` | `/api/calibration/refinement` | Return the current deterministic reviewer-evidence brief, safety override, candidate-scoping eligibility, source-chain summaries, and SHA-256 evidence fingerprint |
| `GET` | `/api/calibration/refinement.json` | Download the current synthetic refinement brief; no free-text note interpretation or automatic model change is included |
| `GET` | `/api/calibration/manifest` | Return the frozen synthetic case-set manifest and its SHA-256 integrity hash |
| `GET` | `/api/incidents` | List derived safety incidents, current study-control state, and incident-chain integrity |
| `POST` | `/api/incidents` | Append a categorized, severity-rated synthetic study incident |
| `POST` | `/api/incidents/:id/resolve` | Append a resolution note and re-evaluate the stopping rule |
| `GET` | `/api/changes` | List loaded component versions, governed candidates, event-chain integrity, and the release boundary |
| `POST` | `/api/changes` | Register a loaded component version against the complete eligible frozen case set and optionally pin up to five currently eligible refinement signals |
| `POST` | `/api/changes/:id/replay` | Replay the candidate through the denominator-first synthetic release evaluator |
| `POST` | `/api/changes/:id/disposition` | Record advancement to independent clinical review or rollback |
| `GET` | `/api/governance/readiness` | Calculate the fourteen readiness gates, fixed authority register, blocked decision, last event, chain, and claim boundary |
| `POST` | `/api/governance/readiness/snapshot` | Seal the current blocked readiness evidence without accepting an approval or authorizing release |
| `GET` | `/api/governance/intended-use` | Return the provider-first charter, bounded contexts, audience and prohibition books, required external acceptances, immutable draft history, evidence chain, and false authority claims |
| `POST` | `/api/governance/intended-use/drafts` | Append one bounded evidence-pinned working draft; cannot accept or approve the statement |
| `GET` | `/api/governance/intended-use.json` | Download the current read-only Intended Use Charter register |
| `GET` | `/api/governance/language-review` | Return the exact nine-clause live corpus, six-question clinical/counsel brief, five outside acceptances, working packet history, evidence, chain, and false authority claims |
| `POST` | `/api/governance/language-review/seal` | Seal the exact current copy corpus after intended use exists; cannot accept, approve, or freeze language |
| `GET` | `/api/governance/language-review.json` | Download the current read-only Language Review packet |
| `GET` | `/api/governance/language-review.html` | Open the escaped responsive and Letter-ready review book; print/PDF annotations remain outside the product and cannot create acceptance |
| `GET` | `/api/governance/decision-exchange` | Build all seven external-decision packets from the current readiness and evidence state |
| `GET` | `/api/governance/decision-exchange.json` | Download the complete read-only Decision Exchange |
| `GET` | `/api/governance/decision-exchange/:gateId/request.json` | Download one strict metadata-return template |
| `GET` | `/api/governance/decision-exchange/:gateId/request.html` | Open one escaped two-page Letter working packet and return worksheet |
| `POST` | `/api/governance/decision-exchange/preflight` | Seal metadata completeness only; verify no identity, authority, evidence, signature, acceptance, or gate closure |
| `GET` | `/api/governance/authority-trust` | Return the sanitized startup-registry state, two candidate scope matrices, current challenges, verified receipt history, chain, and false launch/release claims |
| `GET` | `/api/governance/authority-trust/registry-template.json` | Download a non-operative owner-only registry provisioning template; no registry-write route exists |
| `POST` | `/api/governance/authority-trust/challenges` | Issue one exact 24-hour challenge bound to the current candidate dossier, portfolio, registry, nonce, and 36 scopes |
| `GET` | `/api/governance/authority-trust/challenges/:challengeId.json` | Download an issued metadata-only challenge |
| `POST` | `/api/governance/authority-trust/receipts/verify` | Verify Ed25519 signature, candidate/scope grants, windows, hashes, content boundary, and replay before appending a receipt event |
| `GET` | `/api/governance/pilot-start` | Return the sanitized two-duty provider-preparation interlock, continuity prerequisites, exact history, chain, and false clinical-start claims |
| `GET` | `/api/governance/pilot-start/registry-template.json` | Download the non-operative two-key startup-registry template; no registry-write route exists |
| `POST` | `/api/governance/pilot-start/challenges` | Issue one exact fifteen-minute challenge bound to current authority, dossier, continuity, registry, and nonce |
| `POST` | `/api/governance/pilot-start/orders/verify` | Verify the start-order duty, exact deployment, operating conditions, and maximum four-hour window |
| `POST` | `/api/governance/pilot-start/acknowledgements/verify` | Verify the distinct acknowledgement duty and exact ordered deployment; records provider preparation only |
| `GET` | `/api/governance/clinical-release` | Return the sanitized three-duty release gate, current preparation/continuity binding, exact history, chain, and traffic-off state |
| `GET` | `/api/governance/clinical-release/registry-template.json` | Download the non-operative three-key startup-registry template; no registry-write route exists |
| `POST` | `/api/governance/clinical-release/challenges` | Issue one exact twenty-minute challenge bound to current authority, provider preparation, continuity, registry, and nonce |
| `POST` | `/api/governance/clinical-release/clinical-authorizations/verify` | Verify bounded provider-first clinical/patient-use authority while autonomous, diagnostic, scoring, and Findings-modification uses remain false |
| `POST` | `/api/governance/clinical-release/production-authorizations/verify` | Verify production authority against the clinical authorization and exact acknowledged e-QPASS Azure deployment while traffic remains off |
| `POST` | `/api/governance/clinical-release/deployment-attestations/verify` | Verify the exact deployment and eight controls; may establish release readiness but cannot activate traffic or process a record |
| `GET` | `/api/governance/traffic-activation` | Return the sanitized external-switch witness, current release/continuity binding, exact history, chain, and local traffic-off state |
| `GET` | `/api/governance/traffic-activation/registry-template.json` | Download the non-operative three-duty startup-registry template; no registry-write route exists |
| `POST` | `/api/governance/traffic-activation/challenges` | Issue one exact fifteen-minute challenge bound to current release receipts, dossier, continuity, registry, and nonce |
| `POST` | `/api/governance/traffic-activation/clinical-authorizations/verify` | Verify clinical concurrence for the exact bounded external activation plan without touching a switch |
| `POST` | `/api/governance/traffic-activation/operations-authorizations/verify` | Verify independent operations concurrence only when its activation-plan fingerprint exactly matches the clinical plan |
| `POST` | `/api/governance/traffic-activation/first-transactions/verify` | Verify a third-duty first-transaction attestation from bounded hashes and control checks; accepts no record content, identifier, endpoint, credential, or PHI |
| `GET` | `/api/calibration/independent-review` | Build the live outside-review dossier from current local evidence, source gaps, and external decisions |
| `POST` | `/api/calibration/independent-review/seal` | Seal only the current local evidence package; record no evaluator or review decision |
| `GET` | `/api/calibration/independent-review.json` | Export the current non-authorizing outside-review dossier |
| `GET` | `/api/calibration/independent-review/admission` | Return the exact current three-prerequisite, seven-duty admission state and strict authority ceiling |
| `GET` | `/api/calibration/independent-review/admission.json` | Export the current bounded admission docket |
| `GET` | `/api/calibration/independent-review/admission/registry-template.json` | Export the placeholder-only seven-key owner provisioning contract |
| `POST` | `/api/calibration/independent-review/admission/challenges` | Issue an exact 24-hour dossier/reference/standard/registry-bound challenge after all prerequisites are current |
| `GET` | `/api/calibration/independent-review/admission/challenges/:challengeId.json` | Download an existing admission challenge |
| `POST` | `/api/calibration/independent-review/admission/attestations/verify` | Verify and immutably commit only the next valid purpose-bound external duty |
| `GET` | `/api/calibration/export.json` | Download a hashed synthetic study package with cases, outputs, reviews, revisions, approved report artifacts, feedback, comparisons, and provenance |
| `GET` | `/api/calibration/export.csv` | Download spreadsheet-safe blinded comparison records for independent analysis |
| `GET` | `/api/calibration/timing/export.csv` | Download spreadsheet-safe completed workflow-timing observations; pending assignments are excluded |

Every state-changing workflow is tested through both the domain store and HTTP interface.

Structured interpretation editing does not permit free-form evidence invention. Evidence tokens must exactly match a scale or subscale present in the canonical scored payload. The client keeps those tokens locked, while the server independently revalidates them and rejects diagnostic certainty. Hypothesis/question revisions are versioned separately from audience-narrative revisions so the calibration team can distinguish wording edits from changes in clinical interpretation.

Narrative and interpretation edits also enter one append-only linked revision sequence. Each entry includes exact before/after content, actor, time, assessment, revision type, previous hash, and its own SHA-256 hash. Startup rejects a state file whose sequence, link, or content hash has been altered. This is a useful local tamper-evidence mechanism; it is not a production immutable ledger, signature, timestamping authority, or access-control system.

Delivery jobs and delivery transitions form another independent linked sequence. The verifier binds every job to the approved artifact, preparation receipt, rendered-content hash, synthetic idempotency key, current active mapping, attempt number, connector provenance, and permitted state transition. The study package exports both jobs and events plus the chain head. It never exports pending connector content outside the already synthetic approved artifact package.

Structured reviewer returns also enter a separate append-only integrity sequence. Each event binds the feedback ID to a SHA-256 hash of its assessment, categories, bounded note, reviewer code, and submission time. The refinement brief consumes the current feedback, revision, blind-outcome, and incident ledgers and fingerprints their chain heads. It exposes only deterministic clusters and counts; it does not semantically interpret notes. A linked signal is accepted for candidate scoping only when it covers at least three cases and two reviewers and no unresolved high-severity safety event exists. Production must replace these rehearsal thresholds and reviewer codes with a predeclared clinical protocol, authenticated identities, and independent change authority.

The separate `perl-clinical-standard-draft/1.0` register operationalizes the proposal's instruction to define client satisfaction before testing. It requires preference, accuracy, restraint, usefulness, material-correction, agreement, and assisted-workflow thresholds plus a rationale, while four safety limits remain fixed at zero. Each version snapshots current outcome counts and the feedback, revision, blind-outcome, incident, and timing chain heads. A version is marked pre-outcome only when every count is zero. Draft/event one-to-one coverage, consecutive versions, fingerprints, safety limits, timing classification, and false clinical/release claims are verified at startup. There is intentionally no acceptance or protocol-freeze endpoint.

The separate `perl-counselor-session-notebook/1.0` ledger operationalizes the working observations between the Counselor Lab plan and governed decisions. It accepts only a session-bound decision, fixed disposition, fixed finding, fixed evidence source, and null or visibly synthetic case ID. Each entry pins five current evidence counts, five chain heads, and the case-set/source-contract version. Startup verifies exact event keys, decision/session binding, the linked hash chain, and thirteen false session/clinical/authority claims. There is intentionally no counselor identity, attendance, training, transcript, clinical-acceptance, reference-acceptance, protocol-freeze, validation, or release endpoint.

Approval commits a separate clinician report artifact. The snapshot contains the scored record, approved clinician narrative, evidence-linked interpretation, safety acknowledgement, reviewer and approval time, provider version, report-format version, disclaimer version, and a stable hash of the scored source fields. Artifacts form their own append-only SHA-256 chain. A clinician-narrative edit, interpretation edit, required safety-acknowledgement removal, or returned feedback reopens approval while preserving every earlier artifact. Startup rejects changed artifact content or chain links. Schema-v7 migration establishes an explicit legacy baseline for an existing approved synthetic record and does not claim earlier immutability. Production must add the authoritative source scoring version, Findings report reference/version/hash, attachment state, and source-level severity values to this artifact lineage.

Role-specific handoffs use the separate `perl-audience-handoff/1.0` preview contract. Care-coordination and payer narratives retain bounded scored context; the administrative narrative exposes completion and workflow routing without scored domains, clinical hypotheses, or counselor-reference prose. These previews are printable but never approved artifacts. Editing them enters revision history without reopening or replacing the approved clinician artifact. The workspace disables clinician approval and return controls whenever a non-clinician preview is selected. Production must map all four audiences to authenticated RBAC roles and an approved minimum-necessary disclosure policy.

The current attachment format is `perl-clinician-report/1.0`. New approvals must satisfy its concise page-fit limits. Print CSS allows overflow to continue instead of hiding content if a migrated legacy artifact is longer than the current contract. The legal disclaimer is still a versioned draft and must not be represented as counsel-approved.

Completed blind outcomes enter a separate linked integrity ledger. Each event contains the completed comparison ID, a SHA-256 hash covering the full stored outcome, a link to the previous event, sequence, time, and its own hash. Startup verifies event ordering, links, one-to-one outcome coverage, and the current outcome payload hash; changing a rating, author mapping, case-set field, comment, reviewer, or timing value fails startup. Schema-v5 outcomes are baselined during migration with `type: legacy-baseline` and an explicit statement that the event does not prove pre-migration immutability. Newly submitted outcomes use `type: recorded`.

Blind calibration cases are issued with opaque one-time IDs. The A/B author mapping stays server-side until the paired ratings and preference are submitted, is then persisted with the study record, and cannot be submitted twice. Each reviewer resumes one active case across reloads; cases expire after four hours and cannot be submitted under a different reviewer code. A reviewer cannot receive a case they already completed. Among unseen cases, the scheduler selects the case with the least completed coverage and places PERL in the currently underrepresented A/B position, randomizing ties. Once a reviewer exhausts the approved synthetic set, the API returns a bounded conflict instead of silently repeating a case. The interface reveals the mapping only after both summaries are independently rated and the preference is locked.

The scheduler draws only from [calibration-manifest.js](../src/calibration-manifest.js). Startup validates that every referenced case has an eligible scored fixture, counselor reference, declared partition/strata, and source/reference version. Every pending and completed `blind-v3` record inherits the manifest ID/version and case provenance; older resumable pending records are upgraded on load. The JSON package embeds the full manifest and its SHA-256 hash, while the CSV repeats case-set, partition, strata, and version fields on each outcome.

A resumable blind assignment remains available for 24 hours so a reviewer can survive a browser or process restart during the same working day without losing the blinded case. It then expires to avoid indefinitely locking case allocation. Active workflow-timing tasks retain a four-hour expiry because their server duration is meaningful only within one bounded work session. Neither kind of pending assignment is included in study exports.

The bundled `development`/`holdout` split is an engineering rehearsal. Because all three synthetic fixtures were available during product development, `holdoutValid` is permanently false in this manifest and the interface repeats that claim boundary. A real beta requires a newly approved, frozen, representative, de-identified set whose holdout was inaccessible during model/rule development.

Completed `blind-v3` records follow [calibration-comparison.schema.json](../schemas/calibration-comparison.schema.json). The redundant top-level accuracy/restraint/utility values represent the preferred summary for backward-compatible queue metrics; the authoritative paired values are `ratings.A` and `ratings.B`.

The server—not the browser—measures blind review duration from case assignment to comparison submission. Each completed record stores assignment and submission timestamps, raw seconds, seconds spent under a recorded study pause, active seconds, eligibility, any protocol-window flag, and the measurement version. Client-supplied timing fields are ignored. Active duration subtracts intervals during which one or more unresolved high/critical incidents locked the study.

All captured durations remain in the export and the all-observed descriptive summary. A separate protocol-eligible summary includes active durations from 30 seconds through 45 minutes, reports sample size, mean, median, IQR, and range, and counts every flagged observation. At least 30 eligible timings are required for the mechanical evidence gate. This does not demonstrate time savings: that claim requires an independently timed counselor comparison under the same task definition and a predeclared analysis.

The browser asks each tester to choose a bounded calibration reviewer code and sends it with subsequent state-changing requests. This makes reviewer separation operable in the synthetic study log, but it is deliberately labeled as session identity—not authentication, licensure verification, authorization, or a clinical signature. Production replaces it with e-QPASS SSO/RBAC identity.

Workflow timing is deliberately separate from blind comparison. `workflow-timing-v1` asks for the same final clinician-summary output under unaided-synthesis or PERL-assisted-review conditions. Both conditions receive the same `scored-profile-v1` source projection. The unaided response contains no generated draft or counselor reference. The scheduler prevents the same reviewer from receiving one timing case twice and balances the missing condition across independent reviewers. Completed observations and their exact server timing enter a separate linked integrity ledger; pending tasks are never exported. See [TIMING_STUDY_DESIGN.md](./TIMING_STUDY_DESIGN.md).

The analysis endpoint treats all current results as synthetic and exploratory. It reports counts, PERL preference with a Wilson 95% interval, author-specific mean plus median/IQR for paired quality ratings, within-case PERL-minus-counselor differences, position balance, correction categories, revision volume, and review-duration distributions. It also groups completed `blind-v3` records by assessment and distinct reviewer, then reports overlapping-case count, reviewer-pair count, raw preference agreement, exploratory binary Gwet’s AC1, and author-normalized absolute rating differences.

The same response embeds a versioned synthetic release-evidence report defined by [release-evidence.schema.json](../schemas/release-evidence.schema.json). Each invariant exposes its numerator, eligible denominator, rate, threshold, status, unit, and operational definition. The current gate evaluates the frozen input contract, critical-screen handling, diagnostic restraint, and scored-evidence lineage. Token overlap and exact hypothesis-title coverage remain descriptive diagnostics. Even a fully passing regression report produces `clinicalReleaseEligible: false`; a representative unseen clinical holdout and production controls remain blocked gates.

Safety-event exposure separately reports event counts per 100 completed blind comparisons, including per-category counts. Only events whose blind-case ID resolves to a completed comparison enter that rate; assessment-review, unlinked, and not-yet-completed case incidents are counted outside the exposure window. This is an exposure-normalized operational signal, not a unique affected-case proportion or an estimate of clinical risk; multiple events may refer to one case, and the rate is null until a completed-comparison denominator exists.

The mechanical protocol gate requires 60 completed paired comparisons, at least two reviewers, at least 30 paired PERL assignments in each A/B position, at least 30 cases independently repeated, at least 30 reviewer pairs, at least 30 protocol-eligible timed comparisons, complete declared-stratum coverage, and zero unresolved stopping events. Meeting that threshold still does not establish clinical validity. The three bundled synthetic cases intentionally cannot meet it; they rehearse the process and surface the need for a frozen, approved calibration manifest.

Safety incidents are stored as a separate append-only SHA-256 linked event sequence. A reported event records category, severity, reviewer code, time, optional synthetic assessment/blind-case linkage, summary, and detail. A resolution is a new event; it never overwrites the report. Startup rejects altered event content or chain links. Any unresolved `high` or `critical` event returns HTTP 423 for blind-case issuance, comparison submission, and summary approval. The JSON study package includes derived incident records, exact incident events, completed blind outcomes, exact outcome-integrity events, approved report artifacts, governed change events, and the corresponding integrity summaries.

Governed changes use a fifth linked sequence. A proposal cannot invent a future version: the server resolves and pins the version currently loaded for the model, report template, disclaimer, state schema, or release evaluator. It also attaches the complete eligible frozen manifest and its hash. Replay re-evaluates the loaded candidate against that set and stores the exact denominator-first evidence inside the linked event. Advancement requires the latest replay to pass and the study to have no active stopping event. The only final dispositions are `advance-for-clinical-review` and `rollback`. Both store `clinicalReleaseAuthorized: false`, and a decided candidate cannot be replayed or decided again.

This local mechanism provides workflow fidelity and tamper evidence—not authenticated authority, a digital signature, an external timestamp, or an incident-management system. Production must restrict resolution and restart authority to the designated clinical lead, require independent verification where the protocol calls for it, and retain the complete governed event history.

## Model-provider contract

`src/model-gateway.js` and `src/model-provider.js` are the only approved seam for interpretation generation. The gateway constructs a scoring-only projection through `src/model-input.js`, sends the static versioned clinical policy, and requires the exact four-audience plus interpretation bundle in [model-generation-response.schema.json](../schemas/model-generation-response.schema.json). It then independently applies the narrative and evidence-linked interpretation contracts.

A candidate provider may receive only the approved, versioned scored payload. Provider-reported provenance is ignored; configured provider, model, prompt, policy, and schema versions are stamped only after the response passes deterministic language, safety, evidence-token, audience-minimization, and size validation. Timeout, transport failure, malformed JSON, extra fields, invented evidence, safety omission, diagnostic certainty, or administrative clinical leakage all fail closed without fallback prose.

Generation is materialized at assessment intake, not repeated when a reviewer opens or reloads the page. Each immutable [generation snapshot](../schemas/generation-snapshot.schema.json) binds the scoring-only input hash, normalized output hash, full provider policy provenance, and validated bundle. A separate [linked event](../schemas/generation-snapshot-event.schema.json) makes record deletion or alteration fail startup. Reviewer edits and approval artifacts remain separate histories.

The current runtime refuses unknown provider names. A candidate also requires an injected transport and explicit `approved-for-synthetic-calibration` authorization; an endpoint or API-key environment variable cannot activate it accidentally. The separate [Model Trial Bench](./MODEL_TRIAL_BENCH.md) can preflight exactly three bounded candidate descriptions, while the [Candidate Trial Foundry](./CANDIDATE_TRIAL_FOUNDRY.md) fixes the ensuing nine-run/twelve-blind coordinator plan. Neither can inject a transport, send a payload, receive output, call a provider, verify evidence, authorize a trial, or activate/select an engine. See [MODEL_GATEWAY_CONTRACT.md](./MODEL_GATEWAY_CONTRACT.md).

Before adding a production adapter, Focused Future must decide and document:

- approved hosting and data-retention terms;
- whether any submitted data is used for model training;
- region and network boundary;
- prompt, model, rule, and schema versioning;
- retry, timeout, fallback, and replay semantics;
- observable failure categories;
- protected-health-information authorization;
- clinical regression thresholds.

## Production replacement map

| Sandbox component | Production replacement |
|---|---|
| Local JSON store plus ephemeral restore rehearsal | Approved Azure database/object/report/queue stores with encryption, automated monitored backups, retention, approved RPO/RTO, isolated restore, full reconciliation, and named acceptance |
| Working-tree last-known-good manifest and compatibility replay | Signed immutable build/container repository, SBOM/provenance, environment and schema compatibility policy, authorized staged Azure rollback, monitoring, and reconciliation |
| Point-in-time local operational matrix and unsent alert evidence | Continuous Azure/application/provider/identity/backup telemetry, impact-derived objectives, authenticated notification delivery, acknowledgment/escalation, retained investigation evidence, and tested runbook |
| Demo reviewer label | e-QPASS SSO/RBAC identity and licensed-role authorization |
| Loopback server | Private Azure application/API deployment in the existing e-QPASS trust boundary |
| Deterministic baseline, metadata-only three-candidate bench, plus disabled candidate gateway | Governed three-candidate evidence review, signed engine decision, and clinically calibrated, privacy-approved private model transport with frozen provider/model/prompt/policy versions and authenticated activation authority |
| Dedicated local HTML report page | Governed PDF service that attaches the versioned PERL page alongside the unchanged Findings report |
| Aggregate synthetic Campus Operations Observatory | Authenticated site-scoped aggregate service with authoritative denominators, tenant/RBAC isolation, small-cell suppression, governed cohort and time-window semantics, freshness/reconciliation monitoring, accepted measure definitions, and externally controlled quarterly-review/customization decisions |
| Local audit array plus forty-seven hash-linked integrity families, including revision, report, incident, outcome, change, source-receipt, attachment-preparation, provider-workflow, generation, delivery, timing, recovery, rollback, operational-monitoring, response-rehearsal, readiness, clinical-standard, independent-review admission, owner-return, counselor notebook/reference/adjudication/decision, Progress Review, model/candidate trial, manual candidate returns, anonymous candidate review, refinement cycles, same-case returns/reviews, independent result dispositions, and exact candidate advancement | Authenticated append-only event store/outbox with signatures, trusted time, actor identity, provider-run attestation, provenance, retention, access controls, dead-letter monitoring, and governed exports |
| Synthetic RFI event adapter | Versioned internal scored event or private service-to-service call, resolved from the `rfi-0.1` proposal into an e-QPASS-owned contract |

## Non-negotiable invariants

1. Raw item responses and critical-screen details remain available to the qualified reviewer through the secure source system.
2. Critical-screen routing is deterministic and cannot be softened or removed by generated prose.
3. Approval requires an authenticated, authorized human actor.
4. The source Findings report remains unchanged and traceable.
5. Every summary carries input-schema, rule, provider/model, prompt, and reviewer revision versions.
6. No model or prompt change reaches a pilot without holdout regression testing.
7. No audience transformation introduces a diagnosis, treatment prescription, or unsupported functional claim.
8. Production displays e-QPASS-supplied severity levels and records the scoring version; it does not reconstruct source scoring.
9. The model projection excludes routing identifiers, raw responses, demographics, examiner details, and the Findings PDF by default.

## Offline calibration baseline

`npm run evaluate` creates `qa/calibration-baseline.md` from the three synthetic scored fixtures and their separately stored human-authored references. The current harness reports exact passed/eligible denominators for the input contract, critical-screen handling, diagnostic restraint, and evidence lineage. It also tracks narrative token overlap and exact reference-title coverage as descriptive diagnostics.

Only the last three are enforced engineering invariants in the synthetic suite. Overlap and title coverage are descriptive signals; they must not be optimized blindly or represented as clinical validity. Clinical beta thresholds require a predeclared protocol, approved de-identified cases, independent reviewers, and Dolores’s sign-off.

The working measurement protocol is recorded in [CLINICAL_BETA_PROTOCOL.md](./CLINICAL_BETA_PROTOCOL.md).
