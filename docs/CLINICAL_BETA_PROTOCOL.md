# PERL clinical-beta measurement protocol

## Status and boundary

This document predeclares the analysis PERL should use before a limited clinical beta. The current interface rehearses the mechanics with synthetic cases only. No result produced by the sandbox establishes clinical validity, reliability, safety, or effectiveness.

The protocol must be reviewed and frozen by Dolores, the clinical lead, the independent evaluator, and legal/privacy owners before approved de-identified cases are collected.

## Decisions the study must support

1. Does PERL preserve the scored evidence and critical-screen routing counselors need?
2. Is a PERL summary at least as clinically useful as the agreed counselor reference for the next conversation?
3. What corrections do reviewers make, and are any failures severe enough to stop the pilot?
4. Does review save time without shifting responsibility away from the clinician?

## Case set

- Use a versioned, approved, de-identified case set derived from the authoritative e-QPASS scored export—not copied report prose.
- Stratify cases across low, mixed, elevated, and critical-screen profiles, including conflicting/mixed constructs and sparse signals.
- Freeze a development set and a separate holdout set before final calibration.
- Record one immutable case-set ID/version, freeze time, eligibility flag, partition, clinical-pattern strata, source-schema version, and counselor-reference version for every case.
- Store the human reference, PERL output, model/rule/schema versions, and case stratum separately from author-blinded review records.
- Commit each revealed blind outcome and its timing/provenance to a linked integrity event before returning success to the reviewer.
- Do not reuse a case for the same reviewer in a way that makes authorship recognizable. The sandbox enforces one completed review per reviewer/case pair and clearly stops when that reviewer has exhausted the approved set.

## Review design

- Randomize and record whether PERL appears as Summary A or B. The sandbox scheduler assigns the least-reviewed unseen case and places PERL in the currently underrepresented A/B position; ties are randomized.
- Require an independent accuracy, restraint, and utility rating for both Summary A and Summary B before preference is submitted or authorship is revealed.
- Keep author identity server-side until all six ratings and the preference are submitted.
- Use at least two independent qualified reviewers; add more reviewers where feasible to reduce individual-style dependence.
- Require at least 60 completed paired blind comparisons and at least 30 PERL assignments in each A/B position before interpreting the preference proportion or author-specific quality ratings.
- Measure review time on the server from blind assignment to submission, subtract intervals governed by an enforced study pause, and retain raw, paused, and active duration on every outcome.
- Predeclare a timing eligibility window of 30 seconds through 45 minutes. Preserve shorter/longer observations as flagged data; do not silently delete them. Require at least 30 eligible timings before interpreting duration.
- Assign overlapping cases to reviewers so inter-rater agreement can be estimated. The scheduler prevents within-reviewer repeats while deliberately balancing coverage across reviewers, allowing independent reviewer pairs to form on the same case.

The time-benefit question uses a separate task contract. One condition asks a reviewer to create the final clinician summary from the scored source without generated prose. The second condition asks a reviewer to verify and revise a PERL draft against the same scored source. The output instructions, summary bounds, source presentation, server timing, eligibility window, and safety rules remain the same. A reviewer sees a given timing-study case once; case-level condition overlap is created across independent reviewers to reduce direct within-reviewer carryover. The sandbox balances live allocations by case and condition. The independent evaluator must replace that heuristic with a frozen allocation schedule and predeclare how reviewer and case effects will be handled.

## Counselor Lab session sequence

The source material calls for two to three guided sessions and says counselors are available for review and training. PERL uses three sessions so distinct decisions cannot borrow authority from one another:

1. **Language and safety:** qualified reviewers align indicator language, uncertainty, evidence citation, prohibited claims, direct critical-screen review, and disagreement adjudication.
2. **Evidence and workflow:** reviewers complete blinded paired comparisons and matched unaided-versus-assisted tasks; fidelity, restraint, usefulness, correction burden, timing, and safety remain separate outcomes.
3. **Freeze and independent handoff:** the decision group adjudicates patterns, freezes accepted counselor references and the analysis plan, records unresolved limitations, and prepares the independent-review packet.

Before Session 01 is clinical rather than synthetic, the clinical lead must return the qualified panel roster, approved samples, versioned counselor interpretations, language/tone/disclaimer guidance, critical-screen route, frozen development allocation, session decision rights and stopping rules, and the named independent evaluator. Each session needs an attendance record and signed outputs. The local `perl-counselor-lab/1.0` packet exposes the sequence and current counts but cannot record any of those external acceptances. See [COUNSELOR_LAB_PROTOCOL.md](./COUNSELOR_LAB_PROTOCOL.md).

## Clinical-standard drafting rule

The proposal requires the client-satisfaction threshold to be defined together before testing begins. Before any approved outcome is opened, Dolores, the clinical lead, the named counselor panel, and the independent evaluator must define the minimum blind preference, median accuracy, median restraint, median usefulness, maximum material-correction burden, minimum repeated-review agreement, and maximum assisted workflow time. Critical-screen omissions, unsupported diagnostic certainty, invented/mismatched evidence, and unresolved high/critical incidents remain fixed at zero; satisfaction cannot compensate for a safety failure.

The local `perl-clinical-standard-draft/1.0` workflow records immutable working versions, a rationale, outcome counts, and the feedback/revision/blind-outcome/incident/timing chain heads present at creation. It marks a version `preOutcomeCandidate` only when all outcome counts are zero. Any later draft is permanently labeled post-outcome. This provides timing provenance but no acceptance: the app has no action that can approve the standard or freeze the clinical protocol. See [CLINICAL_STANDARD_DRAFT_PROTOCOL.md](./CLINICAL_STANDARD_DRAFT_PROTOCOL.md).

## Outcomes

Primary safety outcomes:

- critical-screen omission rate;
- unsupported diagnostic-certainty rate;
- invented or mismatched evidence rate;
- high-severity reviewer escalation count.

Every safety result must publish its numerator and eligible denominator, not only a percentage. Eligibility rules belong in the frozen analysis plan: critical-screen handling is limited to cases with a non-zero source screen; diagnostic restraint is evaluated across generated clinician narratives; evidence lineage is evaluated across generated hypotheses. Reported incidents use completed blind comparisons as an exposure denominator only when the incident’s blind-case ID resolves to a completed comparison; other events remain separately counted. Event rates must be labeled as counts—not unique affected-case rates or estimates of clinical risk.

Primary utility outcome:

- blind PERL preference proportion with a two-sided Wilson 95% confidence interval.

Secondary outcomes:

- accuracy, restraint, and utility ratings for PERL and the counselor reference, each reported with sample size, mean, median, and interquartile range;
- within-case paired differences for each rating dimension, defined in advance as PERL minus counselor reference;
- correction burden, separated into accuracy, tone, evidence, safety, and omission categories;
- narrative changed-token count and interpretation-section revision rate;
- all-observed and protocol-eligible blind-comparison rating duration, each with sample size, mean, median, interquartile range, minimum, and maximum, plus flagged count and total recorded pause time;
- unaided-synthesis and PERL-assisted-review duration distributions under the separate workflow task, with captured/eligible/flagged counts, reviewer counts, and pause time for each condition;
- case-level matched unaided-minus-assisted differences in minutes and percentage, calculated only when a case has eligible observations under both conditions;
- changed-token count for the PERL-assisted condition as a descriptive correction-burden signal;
- position balance and results stratified by case severity/critical-screen status;
- pairwise preference agreement and exploratory binary Gwet’s AC1 on independently repeated cases;
- author-normalized absolute reviewer differences for accuracy, restraint, and utility, reported with sample size, mean, median, and interquartile range.

Gwet’s AC1 is used here because raw agreement alone can be misleading when one preference category is common. It is still descriptive in the sandbox: the interface will not interpret agreement until at least 30 cases have independent repeated review and at least 30 reviewer pairs exist. With more than two reviewers on a case, every unique reviewer pair contributes, so a production analysis plan must predeclare whether pair weighting or a multi-rater estimator is preferred.

No p-value or model-comparison claim should be reported from a small convenience sample. Any confirmatory hypothesis, power calculation, exclusion rule, or multiplicity adjustment must be documented before results are inspected.

Role-specific formats are evaluated separately from the clinician attachment. Care coordinators, payer/utilization reviewers, and operations users review only the format intended for their role. The administrative preview must remain free of scored-domain detail, clinical hypotheses, and counselor-reference prose. Favorable audience-format feedback cannot satisfy the clinician reliability or safety gate, and no audience preview inherits clinician approval.

The blind-comparison timer cannot establish time saved because it measures rating two finished summaries. The separate workflow-timing lane rehearses the correct two-condition task, but its synthetic results still cannot establish benefit. Production analysis requires the authoritative Findings interface, representative approved cases, independent allocation, the same task boundary and output requirements, balanced reviewer exposure, and a predeclared treatment of reviewer effects, case effects, interruptions, and learning.

## Stopping and escalation rules

Pause generation and clinical review immediately for:

- any omitted or softened critical-screen routing;
- any definitive diagnosis or treatment instruction not authorized by the product’s intended use;
- invented evidence, identity disclosure, or cross-record leakage;
- a broken blind mapping, duplicate one-time submission, or failed revision-integrity check;
- a failed blind-outcome or safety-incident integrity check.

The clinical lead classifies severity and determines remediation. A corrected build must replay the frozen regression set and affected holdout cases before review resumes.

The sandbox change register makes this operational for versions currently loaded by the server. It binds a candidate to the frozen manifest, stores the exact denominator-first replay result, and records advancement to independent clinical review or rollback in a separate linked event history. It does not deploy code, approve a clinical pilot, or authorize live release.

The controlled refinement brief supplies the step before that register. It deterministically groups structured feedback categories, narrative/interpretation revision burden, paired dimensions where PERL trails the counselor reference, and safety incidents. It does not analyze free-text notes. A sandbox signal must cover at least three independent cases and two reviewer codes before it can scope a loaded candidate, and any unresolved high/critical incident blocks eligibility. Those numbers are conservative workflow controls for this three-case rehearsal—not clinical acceptance thresholds. The independent evaluator must freeze production clustering, weighting, severity, recurrence, and change-eligibility rules before approved results are inspected.

The sandbox operationalizes this rule: reporting a `high` or `critical` incident immediately blocks blind-case issuance, blind submission, and summary approval with a locked response. Resolution appends a new event rather than changing the report, and the entire incident event sequence is hash-linked and verified at startup. Session reviewer codes are sufficient only for rehearsal; a production restart requires authenticated clinical-lead authority and any independent verification specified by the frozen protocol.

## Interpretation gate

The interface marks results “protocol threshold met” only when comparison volume, reviewer count, A/B position balance, independent overlap, timing volume, case-set coverage, and safety status satisfy the mechanical minimum: 60 paired comparisons, at least two reviewers, at least 30 PERL assignments in each position, at least 30 repeated cases, at least 30 reviewer pairs, at least 30 protocol-eligible timings, complete declared strata, and no unresolved high/critical incident. That label means the descriptive package is ready for protocol-based review. It never means “clinically validated.”

Workflow timing has a separate mechanical gate: at least 30 eligible observations in each condition, at least 20 cases represented by both conditions across independent reviewers, complete declared strata, and no unresolved high/critical incident. Passing that gate means only that the timing package is ready for the frozen independent analysis. It does not establish that PERL saves time.

The bundled three-case synthetic set can verify the workflow but cannot satisfy the repeated-case threshold. Reaching the gate requires a larger, frozen, approved case manifest and enough independent reviewers; reviewer codes must not be recycled to manufacture independence. The proposal’s approximately 600 assessments are source-reported availability, not a study denominator. Before any record-level transfer, the aggregate-only [calibration intake map](./CALIBRATION_INTAKE_MAP.md) requires named authority, inventory/quarantine, minimum-necessary, quality/exclusion, counselor-reference, strata, and holdout evidence; PERL currently records zero files received or inspected.

The current manifest labels one synthetic case `holdout` only to exercise partition-aware workflows. It also sets `holdoutValid: false` because the fixture was visible during development. No performance result from that partition may be described as out-of-sample validation. The clinical beta requires a new manifest frozen before model/rule tuning, with access controls that preserve the holdout until the predeclared evaluation point.

The rehearsal manifest also declares a `low-signal` target stratum without assigning a current fixture. This is intentional negative evidence: the product surfaces the missing stratum and keeps the case-set readiness gate closed. The gap must be filled with an approved case in a new manifest version; it must not be hidden by relabeling a materially different profile.

Pilot authorization still requires:

- zero unresolved high-severity safety failures;
- clinical sign-off on output and correction patterns;
- independent reliability review;
- legal approval of intended use and disclaimer;
- privacy/security approval of data flow and environment;
- production identity, immutable audit, monitoring, incident response, and rollback controls.

## Export and reproducibility

`GET /api/calibration/export.json` produces a synthetic package containing manifest, provider/schema provenance, materialized input/output-hashed generation snapshots and their exact linked events, denominator-first regression evidence, the explicit blocked-release decision, descriptive analysis, the current refinement brief, current case outputs, reviews, exact approval-time clinician report artifacts, feedback, exact hash-linked feedback events, audit records, blind comparisons, exact hash-linked blind-outcome events, completed workflow-timing observations, exact hash-linked timing events, derived safety incidents, exact hash-linked incident events, exact governed-change events, and the hash-linked revision, report-artifact, and change-control sequences. The package includes chain summaries plus its own SHA-256 integrity hash.

`GET /api/calibration/refinement.json` exports the smaller reviewer-learning artifact: deterministic signal definitions, case and reviewer coverage, candidate-scoping state, source-chain summaries, a SHA-256 evidence fingerprint, and the explicit non-automation/non-validation boundary.

`GET /api/calibration/export.csv` produces a comparison-level table with A/B ratings, post-reveal author-normalized PERL and counselor rating columns, complete case-set provenance, and raw/paused/active timing fields, and prefixes spreadsheet-formula-leading text to reduce CSV injection risk. Pending author mappings are never exported. Production exports require authenticated authorization, retention rules, and de-identification review.

`GET /api/calibration/timing/export.csv` produces a separate completed-observation table for the workflow timing study. It includes condition, frozen-case provenance, scored-source hash, server timing, flags, assisted provider version, changed-token count, reviewer code, non-validation boundary, and final synthetic summary. Pending tasks and assisted drafts are never exported.
