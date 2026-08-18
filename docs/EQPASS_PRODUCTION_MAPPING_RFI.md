# e-QPASS to PERL production mapping RFI

## Decision this document protects

PERL should receive a versioned scored assessment event after e-QPASS finishes scoring. The model should receive only the scored projection of that event. e-QPASS remains authoritative for item responses, score calculation, severity bands, GPI, safety flags, respondent linkage, and the original Findings report.

This is a request for authoritative field names and lifecycle rules. It is not a reverse-engineered production contract. No matching production API, database schema, event schema, or report-service specification was found in the supplied workspace.

The proposed machine-readable envelope is [eqpass-scored-event.proposed.schema.json](../schemas/eqpass-scored-event.proposed.schema.json). Its status is `proposed-rfi-only`.

## Evidence register

| Local source | Structural evidence used | Authority decision |
|---|---|---|
| `B2C Data Export.xlsx` | `Sheet1!A1:G1` contains `ClientID`, `AssessmentID`, `DateOfBirth`, `Gender`, `Ethnicity`, `QuestionID`, and `ResponseID`. The used range is `A1:G27337`; question identifiers have 105 distinct values and response identifiers have five. | Raw, long-form, consumer-labeled response data. It is not the provider scored event and must not be sent to a model. No respondent values were copied into PERL. |
| `ScoreReportPackage-121 AW[96380].pdf` | Four-page Letter report: item responses; Emotional Temperature; scale and crisis analysis; fourteen subscales. The report contains respondent and examiner metadata plus a HIPAA handling notice. | Evidence of report shape and scored constructs, not a machine contract. The file must remain private and unchanged. |
| `eQPASS Spec Sheet 2022 AW.docx` | Azure platform, 105 items, immediate autoscoring, EHR integration, GPI, three negative-affect scales, five clinical/crisis scales, and fourteen subscales. | Product intent and construct inventory. Production field names and scoring rules still require the e-QPASS owner. |
| `eQPASS Features and Benefits.docx` | Secure coded reports, PDF download to the practice EHR, immediate Findings, repeat assessments, and third-party integration are described. | Workflow intent only. Security and integration claims require current control evidence. |
| `# QPASS Clinical Summary.docx` | Exploratory sections include overall distress, core dimensions, crisis scales, clinical themes, mixed signals, red flags, follow-up questions, quality checks, and limitations. The artifact itself states that its GPI formula and thresholds are unconfirmed. | Useful content exploration, not scoring or clinical authority. Its identifiers, item-level detail, raw model label, and unconfirmed calculations must not enter the production report contract. |
| July 2026 AI Clinical Summary Tool proposal | Structured e-QPASS output becomes a concise summary page, with human review, testing, and attachment to the standard report. | Directional product scope. Clinical, legal, security, and integration proof remain gated. |

Source hashes were recorded during review so the evidence set can be rechecked without circulating copies:

- B2C export: `f314a92f39b6979c75ee775b651ca8c789f5721f15827df633de8bf92f2ad1d8`
- exploratory clinical summary: `c6c3cc067ad5fa20f5d56452d3ca757d4f6864dea52efb3bba8881113b7ca7c8`
- sample report package: `d033b71acc2bb01477fa8a570ab3df9ebc2e9574335de884fc2e0f0d6f71f727`
- 2022 spec sheet: `6c913e993bf289e94c6331cc2d3838914c59a9dab15b22715f605e12a5b85eee`
- features and benefits: `dcc62537197b5cd2a2e03f8a2ca7bc16f92c643343e778e1e484e5fbb7f71ba5`
- July 2026 proposal: `daf6aa45d75c6155bf5fc1082bc9db8d9b112730c33ca8f548ecf42a2252181e`

## The production boundary

The event envelope has three data zones.

1. **Routing zone:** tenant, assessment, subject, report, correlation, and idempotency references. These fields stay inside the approved e-QPASS application boundary. They are necessary to retrieve, attach, and audit the result, but they are not model inputs.
2. **Scoring zone:** e-QPASS-supplied scale scores and severity levels, fourteen subscales, and bounded critical flags. This is the only default model projection.
3. **Report zone:** the unchanged Findings report reference, version, status, and hash. PERL links to this source artifact and returns an additional page; it never overwrites or regenerates Findings.

The event intentionally omits name, date of birth, email, phone, address, raw item responses, examiner contact details, and free-text clinical notes. Age, sex, gender, ethnicity, diagnosis, history, medications, and prior assessments remain excluded unless the clinical and privacy owners document a specific validated purpose, necessity, source, retention rule, and model authorization.

The routing envelope can still be PHI because pseudonymous references are linkable inside e-QPASS. The model projection is narrower than the application event, but that does not remove the need for an approved HIPAA, Azure, retention, and vendor boundary.

## Field mapping to confirm

### Event and source record

| Proposed PERL field | Required source meaning | Current evidence | Owner question |
|---|---|---|---|
| `contractVersion` | Version of the e-QPASS to PERL transport contract | New proposed field | Who versions and publishes the source contract? |
| `eventId` | Unique immutable scoring or rescoring event | Not found | Is there an event ID today, or must one be created? |
| `eventType` | `assessment.scored` or `assessment.rescored` | Report can be generated after completion; rescoring behavior not found | What actions create a new score version? |
| `occurredAt` | UTC time the source event was committed | Sample report exposes test and print times | Which source timestamp is authoritative? |
| `environment` | Calibration, named pilot, or production | Not found | How are test and production records separated? |
| `tenantRef` | Organization/site routing reference | Aggregate and organization use are described | What is the non-display tenant key? |
| `sourceAssessment.assessmentRef` | Stable assessment reference | Raw export has `AssessmentID`; reports use a numeric respondent/report identity | Is `AssessmentID` stable across score/report regeneration? |
| `sourceAssessment.subjectRef` | Pseudonymous subject link used only for attachment | Raw export has `ClientID` | Can PERL operate on the assessment reference alone? If not, what token replaces the raw client ID? |
| `sourceAssessment.instrument.version` | Exact questionnaire/content version | 105-item instrument documented | Where is the deployed instrument version stored? |
| `sourceAssessment.completedAt` | Completed assessment time in UTC | Sample report exposes test-start time and duration | Is completion time stored directly or derived? |
| `sourceAssessment.durationSeconds` | Source-measured completion duration | Sample report exposes duration | Is this clinically useful to PERL or audit-only? |
| `sourceAssessment.scoringVersion` | Exact scoring and threshold rules used | No machine version found | What version covers formulas, bands, and item-to-construct mapping? |
| `trace.correlationId` | End-to-end request and event trace | Not found | Which Azure tracing standard is already used? |
| `trace.idempotencyKey` | Stable duplicate-prevention key | Not found | Can e-QPASS emit a deterministic key for assessment plus scoring version? |

### Scored constructs

| Proposed PERL field | Source construct | Production rule |
|---|---|---|
| `scoring.scales.depression` | Depression Scan | e-QPASS supplies both score and source severity level. |
| `scoring.scales.anxiety` | Anxiety Scan | e-QPASS supplies both score and source severity level. |
| `scoring.scales.anger` | Anger Scan | e-QPASS supplies both score and source severity level. |
| `scoring.scales.gpi` | Global Psychopathology Index | PERL never calculates or reconstructs GPI. |
| `scoring.scales.phobicAvoidance` | Phobic Avoidance | Preserve source label, code, score, and level. |
| `scoring.scales.obsessiveCompulsive` | Obsessive Compulsivity | Confirm canonical spelling and code. |
| `scoring.scales.psychoticism` | Psychoticism | Preserve source score and level without diagnostic conversion. |
| `scoring.scales.suicideRisk` | Suicide Risk | Deterministic direct-review routing. Never softened by narrative. |
| `scoring.scales.violenceRisk` | Violence Risk | Deterministic direct-review routing. Never softened by narrative. |
| `scoring.redFlagSectionScore` | Red Flag Section aggregate shown in the report | Optional RFI field only. Confirm formula, range, meaning, and whether it is authoritative before adoption. |
| `scoring.subscales[]` | Fourteen depression, anxiety, and anger subscales | e-QPASS supplies code, label, domain, score, and source level for all fourteen. |
| `scoring.criticalFlags[]` | Highlighted suicide, violence, and other red-flag responses | Send bounded source codes, category, score, and direct-review requirement. Keep exact item wording and the full raw response set in e-QPASS unless separately approved. |

The local reports show this fourteen-subscale inventory, which the owner must confirm against current production:

- Depression: Dysphoria, Unsustained Effort, Negative Cognition, Fatigue, Anhedonia.
- Anxiety: Apprehension, Interpersonal Anxiety, Physiological Arousal.
- Anger: Angry Mood, Resentment, Indignation, Anger In, Anger Out Verbal, Anger Out Physical.

The sandbox currently replays published score bands for engineering tests. The production adapter must render e-QPASS-supplied levels and record the scoring version. It must not use the exploratory clinical summary's unconfirmed calculations.

## Implemented synthetic rehearsal

The proposed seam is now executable for synthetic engineering tests:

- `examples/synthetic-eqpass-scored-event.json` supplies a complete, visibly synthetic event with nine scales, source severity levels, all fourteen proposed subscales, bounded critical flags, scoring provenance, and a finalized hashed Findings reference;
- `src/eqpass-adapter.js` enforces exact envelope keys, calibration-only environment, `FF-TEST-` routing references, the local fourteen-subscale RFI codebook, a finalized PDF source report, and bounded critical codes;
- `src/model-input.js` projects only scored constructs and bounded safety flags; tests prove that event, tenant, subject, assessment, report, correlation, and idempotency values do not reach the provider;
- `src/model-gateway.js` now packages that projection under a versioned static clinical policy, rejects malformed or unsafe candidate output, and materializes one input/output-hashed generation snapshot instead of regenerating on record read;
- the source API returns the existing result for an identical event, rejects a reused event/key with different content, and rejects rescoring until the authoritative supersession lifecycle is supplied;
- accepted imports append a hash-linked, privacy-minimized receipt with source/scoring/report digests and versions; startup and export integrity checks detect receipt tampering;
- source-supplied severity levels are displayed and used by the narrative rules rather than reconstructed when they are present.
- an approved source-linked clinician artifact can produce an idempotent attachment-preparation receipt that binds the source-event receipt, Findings hash/version, scoring version, approved artifact, report format, disclaimer, provider version, and exact HTML rendition hash;
- each preparation commits one immutable schema-15 delivery job; the default connector makes no network attempt, while an explicitly authorized synthetic connector must return a request-bound `rehearsed-not-attached` acknowledgement with `remoteWriteClaimed: false`;
- delivery attempts persist before transport, attempts one and two require explicit retry after failure, attempt three enters a dead-letter state, interrupted attempts recover without assuming a remote write, and every transition is independently hash-linked;
- clinical edits reopen approval and make any earlier preparation historical; a new current artifact needs a new preparation receipt.

This rehearsal does not establish that the proposed field names, codebook, levels, or lifecycle match production. Its outbound state remains connector-held or `rehearsed-not-attached`: it does not connect to e-QPASS by default, create the production PDF, merge or attach a report, process PHI, authenticate a production service, prove Azure controls, or solve authoritative rescore/supersession behavior. Those remain owner decisions and acceptance evidence below. The exact local lifecycle and replacement requirements are in [DELIVERY_OUTBOX_CONTRACT.md](./DELIVERY_OUTBOX_CONTRACT.md).

### Findings report

| Proposed PERL field | Required source meaning | Owner question |
|---|---|---|
| `findingsReport.reportRef` | Stable private reference to the exact Findings PDF | Is the report stored as a blob, generated on demand, or both? |
| `findingsReport.reportVersion` | Version of content and presentation | What changes when a report is reprinted without rescoring? |
| `findingsReport.status` | Finalized or superseded | What state transition invalidates a prior PERL attachment? |
| `findingsReport.sha256` | Source integrity hash | Is a content hash available now? |
| `findingsReport.mimeType` | PDF content type | Are other report formats authoritative? |

## Proposed event sequence

1. e-QPASS completes scoring and commits a versioned scored event.
2. The integration service validates the envelope, confirms the source Findings status, and applies the idempotency key.
3. A privacy projection removes routing and report references before the scoring object reaches the model adapter.
4. Deterministic rules establish severity display, critical-screen hold, and prohibited-use constraints from e-QPASS-supplied values.
5. PERL creates a review draft with source, schema, scoring, model, prompt, rule, and report-format provenance.
6. An authenticated qualified reviewer edits or returns the draft. Any material edit or safety-state change invalidates approval.
7. Approval commits an immutable report artifact and renders the additional PERL page.
8. e-QPASS attaches that page beside the unchanged Findings report and records the attachment result.
9. A later rescore supersedes the old draft and attachment, starts a new lineage, and preserves the historical artifact.

No generation, retry, timeout, or service recovery may create an approved attachment automatically.

## Proposed lifecycle states

| State | Authority | Required behavior |
|---|---|---|
| `source-finalized` | e-QPASS | Scores and Findings version are stable for this source version. |
| `generation-pending` | PERL | Idempotent request accepted; no clinician artifact exists. |
| `review-draft` | PERL | Draft visible only to authorized reviewers. |
| `safety-held` | PERL deterministic control | Direct review and acknowledgement required; approval blocked. |
| `returned` | Reviewer | Structured correction and rationale recorded; approval blocked. |
| `approved` | Authorized reviewer | Immutable artifact committed with actor and trusted time. |
| `attachment-pending` | Integration service | Approved page ready; not yet present beside Findings. |
| `attached` | e-QPASS report service | Exact artifact reference and source Findings version recorded. |
| `superseded` | e-QPASS rescore or governed rollback | Historical artifact retained but excluded from current use. |
| `failed` | Owning service | Classified failure recorded with retry disposition. |

## Attachment response to e-QPASS

The attachment callback or response should carry:

- source assessment reference and source scoring version;
- source Findings reference, version, and hash;
- PERL artifact ID, version, hash, and immutable storage reference;
- report format and disclaimer versions;
- model, prompt, deterministic-rule, and input-schema versions;
- reviewer identity reference, licensed-role authorization result, and approval time;
- safety acknowledgement state;
- attachment status, attached time, and e-QPASS report-package reference;
- correlation and idempotency keys;
- superseded artifact reference when applicable.

The callback should not copy model prose into logs, queue metadata, or error messages.

## Failure and retry contract

| Condition | Retry | Required behavior |
|---|---|---|
| Schema or semantic validation failure | No automatic retry | Quarantine the event, record field-level errors without respondent content, and notify the integration owner. |
| Unknown scoring or instrument version | No automatic retry | Block generation until the version is registered and regression-tested. |
| Source Findings not finalized | Bounded delayed retry | Do not generate against a draft or mismatched report version. |
| Duplicate idempotency key with identical source hash | Return existing result | Never create a second lineage. |
| Duplicate key with different source hash | No automatic retry | Treat as a version conflict and require investigation. |
| Model timeout or transient provider error | Bounded retry | Reuse the same idempotency key and frozen input. Never approve automatically. |
| Output guard or safety validation failure | No blind retry | Hold the draft, retain diagnostic evidence, and require governed candidate correction. |
| Attachment-service timeout | Bounded retry | Reuse the exact approved artifact; never regenerate content. |
| Source rescored during review | No attachment | Mark the draft superseded and start from the new source version. |
| High or critical study incident | No new generation or approval | Apply the stopping rule until the authorized restart decision is recorded. |

Production needs explicit timeout budgets, maximum attempts, exponential backoff, dead-letter handling, alert ownership, and replay authorization for each service boundary.

## Security and privacy questions

1. Which Azure subscription, region, network, application identity, and key vault own the integration?
2. Which fields are PHI in each event, prompt, report, log, metric, backup, and export?
3. Can the model endpoint be deployed without data retention or training use, inside the approved region and private network path?
4. Which e-QPASS roles may generate, review, approve, attach, supersede, export, or replay?
5. How are clinician licensure and site authorization represented?
6. What are the retention and deletion rules for draft prose, approved artifacts, revisions, prompts, model outputs, events, and backups?
7. What redaction prevents respondent content from entering logs, telemetry, support tickets, and dead-letter queues?
8. What recovery point, recovery time, restore test, and model/report rollback evidence does the pilot require?
9. What current evidence supports Azure, HIPAA, and SOC 2 claims for the exact production path?

## Decisions requested from Dolores, Mike, and the e-QPASS owner

| Decision | Accountable role | Evidence to return |
|---|---|---|
| Confirm provider-first intended use and unchanged Findings attachment | Dolores and clinical lead | Signed intended-use statement and annotated report sample |
| Confirm Mike as program and integration lead | Dolores and Mike | Named decision log owner and weekly dependency cadence |
| Name the e-QPASS technical owner | Mike | Owner, system inventory, and interface access path |
| Supply the authoritative source contract | e-QPASS owner | Versioned sample event, field dictionary, code sets, lifecycle, and scoring version |
| Confirm all fourteen subscale codes and labels | e-QPASS and clinical owners | Machine codebook and current production screenshot/report |
| Define the Red Flag Section aggregate | e-QPASS and clinical owners | Formula, range, meaning, thresholds, and item membership |
| Define critical-response disclosure to PERL | Clinical, privacy, and e-QPASS owners | Minimum-necessary field decision and safety workflow |
| Define report merge and supersession | e-QPASS owner | PDF service API, source/version/hash semantics, and rescore behavior |
| Approve the model data projection | Security, privacy, and clinical owners | Data-flow diagram and field-level classification |
| Approve failure and replay authority | Engineering, clinical, and security owners | Runbook, retry matrix, stopping rule, and rollback procedure |

## Acceptance tests for the authoritative adapter

The integration cannot be marked ready until it proves all of the following with de-identified fixtures:

1. Every supported score, severity level, subscale, and critical flag matches the authoritative e-QPASS object exactly.
2. The GPI and safety disposition are never recalculated by a generative model.
3. Names, birth dates, contacts, demographics, examiner details, and raw item responses are absent from the default model projection.
4. A critical flag always creates the deterministic hold and cannot be removed by generated prose.
5. The source Findings reference, version, status, and hash remain attached to every draft and approved artifact.
6. Identical events are idempotent; conflicting hashes fail closed.
7. A rescore supersedes an in-flight draft and prevents attachment of the older source version.
8. A model or attachment timeout cannot create duplicate artifacts or approvals.
9. The exact approved page attaches beside an unchanged Findings report.
10. Restore and rollback preserve source links, approval artifacts, audit order, and current-versus-superseded status.
11. Authenticated role checks prevent unauthorized review, approval, export, replay, and restart.
12. Logs, alerts, support traces, and dead-letter records contain identifiers and clinical content only when explicitly approved and protected.

## Immediate next handoff

Send this RFI and the proposed schema to Mike and the named e-QPASS technical owner. Ask them to return a de-identified authoritative scored event, current field dictionary, report lifecycle, and PDF attachment interface. Do not send the B2C export or the private report sample with the request. The current local files are evidence for questions, not integration payloads.

The live Decision Room at `GET /api/governance/handoff.html` now packages this RFI beside the product/clinical, Azure-control, and independent-evaluation decisions. `GET /api/governance/handoff.json` exposes the same read-only return contract and exclusions with a packet fingerprint. Neither route sends anything, accepts a decision, or changes the RFI-only status.
