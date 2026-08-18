# PERL executive handoff brief

## Why this exists

Dolores repeatedly identified getting the right files to Mike, obtaining a build proposal and timeline, continuing report design in parallel, and proving security and backup as immediate marketability needs. The existing RFI, clinical protocol, launch plan, and readiness dossier contain those answers, but they previously required a reader to assemble the working session themselves.

`perl-executive-handoff/1.0` creates one read-only Decision Room and print-ready brief for that working session. It derives its current-state numbers from the live pilot-readiness dossier and Marketability Map. It does not create another approval system.

## Four handoff packets

| Packet | Decisions | Required outcome |
|---|---:|---|
| Product and clinical charter | 4 | Confirm Mike's coordination role; approve provider-first intended use and report language; name the clinical lead, counselor panel, and first bounded site |
| e-QPASS integration contract | 6 | Name the e-QPASS owner; return authoritative scored-event, codebook, safety, lifecycle, attachment, rescore, and replay contracts |
| Azure production controls | 6 | Approve the exact data path, identity, retention, continuity, monitoring, response, and accessibility evidence plan |
| Independent review and pilot | 5 | Freeze the study, commit reviewers, accept calibration, issue a signed reliability disposition, and decide only named-site authorization |

All twenty-one items map to one of the seven external authority gates. The local product therefore renders every item as `external-decision-required`; it cannot mark one accepted.

## Controlled references

The packet points to eight existing, bounded artifacts:

1. the e-QPASS production mapping RFI;
2. proposed scored-event schema;
3. synthetic scored-event example;
4. launch-readiness plan;
5. clinical-beta protocol;
6. timing-study design;
7. pilot-readiness dossier; and
8. current synthetic evidence export, labeled internal synthetic evidence.

These are evidence for questions and planning. They are not an authoritative e-QPASS payload, a production build artifact, or signed acceptance.

## Exclusion rule

The handoff explicitly excludes:

- B2C response exports or consumer-workstream files;
- private or respondent-derived report samples;
- names, birth dates, contacts, demographics, examiner details, and raw item responses;
- credentials, secrets, production endpoints, and unredacted logs; and
- any statement that the local product is clinically validated, production ready, attached to e-QPASS, approved, or pilot authorized.

This applies whether the packet is viewed in PERL, printed, saved as PDF, or exported as JSON.

## API and interface

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/governance/handoff.json` | Returns the live four-packet decision contract, requested evidence, roles, artifacts, exclusions, false claim flags, and SHA-256 packet fingerprint |
| `GET` | `/api/governance/handoff.html` | Renders the same packet as a responsive, Letter-printable executive brief |

The Governance view exposes the compact Decision Room with prepared-for roles, live proof counts, packet summaries, return manifest, exclusion boundary, fingerprint, and direct print/JSON actions.

## Claim boundary

The Decision Room organizes source-backed questions, local synthetic evidence, and requested external returns. It does not assign authority, record acceptance, commit a delivery date or budget, establish clinical validity, authorize PHI, certify production readiness, authorize a pilot, or replace counsel, security, clinical, accessibility, e-QPASS, or independent review.
