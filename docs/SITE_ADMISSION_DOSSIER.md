# Named-Site Admission Dossier

Contract: `perl-named-site-admission-dossier/1.0`  
Return contract: `perl-named-site-admission-return/rfi-1.0`  
State schema: `sandbox-state/34`  
Integrity family: 30  
Package: `perl-synthetic-calibration-package/2.21`

## Purpose

The dossier is the controlled seam between provider-pilot preparation and a real named-site decision. It converts the North Central counseling-center and Cooper psychiatric-clinic QI source contexts into two candidate-specific working packets without treating correspondence, a plan, a training workbook, or local engineering evidence as site authority.

Each dossier joins four current sources:

1. the Provider Pilot Operations candidate and operating-plan fingerprint;
2. all seven External Decision Exchange requests and their current metadata-preflight state;
3. the Provider Activation Workbook and its ten governed completion returns;
4. the Pilot Readiness state and current local evidence heads.

Every resulting fingerprint changes when one of those inputs changes. An older metadata return then becomes visibly stale.

## Six admission books

The admission book is deliberately exact: two questions per book, twelve questions total.

1. **Site & setting** — authenticated institution and bounded provider workflow.
2. **Scope & window** — accepted population denominator, dates, pause, renewal, and expansion lock.
3. **Data & control** — authoritative e-QPASS path, field-level data flow, privacy, security, continuity, and failure authority.
4. **People & access** — roster, role, qualification, supervision, training, accessibility, minimum access, and revocation.
5. **Measure & support** — frozen denominators, review cadence, support, incident, stop, restart, and closeout evidence.
6. **Terms & authority** — executed agreement and the authenticated, bounded decision record.

The five required decision roles are executive sponsor, clinical lead, legal owner, security/privacy owner, and independent evaluator. Their names and authority are never inferred locally.

## Metadata return

The downloadable return is strict JSON. It permits only:

- the current dossier fingerprint, candidate ID, and visibly synthetic return ID;
- one of `not-recorded`, `authorize`, `authorize-with-conditions`, or `do-not-authorize`;
- a governed decision-record reference and declared decision time;
- five `FF-AUTH-*` identity references;
- twelve `FF-EVIDENCE-*` evidence references;
- bounded site, setting, scope, start, end, condition, and revocation references when an authorization is declared;
- an exact trust-boundary object whose eighteen fields all remain `false`.

The server rejects unknown fields, mismatched candidates, stale fingerprints, missing or reordered roles/questions, malformed references, unbounded or reversed dates, non-false trust claims, and payloads above 96 KB. It hashes references rather than preserving their raw values in the event ledger.

`metadata-complete-unverified` means only that the declared envelope is structurally complete. The local preflight still records all of the following as false: evidence receipt, name/signature receipt, identity verification, site verification, authority verification, evidence verification, acceptance, authorization, pilot start, production release, and patient-use permission.

## Integrity and export

`siteAdmissionEvents` is the thirtieth SHA-256-linked integrity family. Startup validates sequence, prior hash, dossier fingerprint, decision metadata, bounded-term state, five authority results, twelve evidence results, counts, every denied claim, actor, timestamp, note, and event hash. Any change fails startup closed.

Schema 33 migrates existing local state by adding an empty `siteAdmissionEvents` collection. Package `2.21` exports the current portfolio, exact events, and chain summary. Readiness excludes the downstream Decision Exchange, Pilot Operations, Provider Activation, and Site Admission chains from its own integrity digest so the evidence graph remains acyclic.

Schema 34 leaves this preflight contract deliberately non-authorizing and adds the downstream [Governed Authority Trust Bridge](./AUTHORITY_TRUST_BRIDGE.md). Only that bridge can project a site, role, evidence, gate, activation, or bounded-authorization assertion as satisfied, and only from a current externally signed receipt. The dossier itself remains a question-and-envelope surface.

## Working document

Each candidate has a four-page Letter dossier:

1. source context versus governed site facts;
2. the seven external decision returns and ten activation returns;
3. six books and twelve exact admission questions;
4. five authority references, twelve evidence references, bounded-term fields, and the visible warning: **This is not a signature surface.**

The renderer escapes candidate-controlled content, keeps exact 816 × 1056 CSS-pixel page geometry for print, supplies a responsive single-column path, preserves keyboard focus, and uses native links, buttons, file input, headings, lists, tables, and landmarks.

## Claim boundary

The local product does not contact a site, receive evidence files or protected content, verify a site or person, authenticate a signature, execute an agreement, start a date window, close a readiness gate, activate a provider, authorize or start a pilot, release production, establish outcomes, or permit patient use. Those acts require governed production trust and separately authenticated authority.
