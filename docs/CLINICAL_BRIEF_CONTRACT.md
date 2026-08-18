# PERL Clinical Brief Contract

Current package export: `perl-synthetic-calibration-package/2.36`  
Brief contract: `perl-clinical-brief/1.0`  
State schema: `sandbox-state/42`

## Why this exists

The July 2026 Blue Fractal proposal asks for a concise clinician-ready companion page beside the unchanged four-page e-QPASS Findings report. Dolores's August 13, 2026 email identifies counselor review and training as the provider-side path. The existing `# QPASS Clinical Summary.docx` working example adds the most concrete content architecture: overall distress, core dimensions, clinical themes, mixed signals, red flags, quality checks, and explicit limitations.

Package 2.32 turns that architecture into one deterministic, inspectable product contract without copying the working example's unsupported identifiers, raw item wording, causal claims, provisional formulas, or unvalidated quality scores.

## Fixed sections

Every clinician brief exposes the same seven sections:

1. **Overall distress** - the current GPI score and source range label beside the accountable clinician narrative.
2. **Core dimensions** - overall distress plus depression, anxiety, and anger indicators, each tied to the exact scored token.
3. **Clinical themes** - reviewer-editable hypotheses with domain, confidence, scored evidence, explicit uncertainty, and a contextual follow-up question.
4. **Mixed signals** - deterministic comparisons across primary domains and parent-domain/subscale range labels; these are clarification prompts, never resolved contradictions.
5. **Red flags** - deterministic critical-screen disposition, urgency, and count with raw response wording withheld.
6. **Quality checks** - scored-input coverage, diagnostic restraint, theme lineage, critical routing, and an explicit unscored specificity state.
7. **Confidence and limitations** - five always-visible limits covering self-report bias, provisional calibration mapping, missing temporal/contextual evidence, prohibited clinical inferences, and direct safety verification.

## No-invention boundaries

- e-QPASS scored output remains authoritative. PERL does not rescore it.
- Evidence references may use only scored domains and subscales in the current record.
- Raw response wording is not reproduced in the brief.
- PERL does not diagnose, prescribe, infer cause, determine medical necessity, eligibility, or level of care, or resolve a critical-screen response.
- Automatic generation always requires accountable clinician review.
- The current `coverageScore` is labeled **scored input coverage**, not clinical validity or claim coverage.
- Clinical specificity is `not-scored` with a null value until Dolores's clinical team supplies an approved formula and a predeclared acceptance threshold. The example document's numeric specificity score is not treated as authority.

## Runtime projection

`GET /api/assessments/:id` now returns `clinicalBrief` beside the scored assessment, narratives, structured interpretation, review state, lineage, and workflow state. The projection is derived from the current clinician narrative and interpretation and therefore reflects a persisted reviewer revision on the next read.

Newly approved immutable report artifacts snapshot the complete clinical brief. Previously approved artifacts remain readable through deterministic projection from their already-snapshotted assessment, narrative, and interpretation. Study-package export includes the brief for every synthetic case under package format 2.32.

## Review and print surfaces

The Summary Review sheet uses an editorial section map rather than adding another dashboard:

- the overall-distress headline and narrative lead the document;
- the score visualization uses source-aware range labels and piecewise threshold positioning rather than implying equal raw-score quartiles;
- mixed signals and red flags are visually paired but remain semantically distinct;
- each theme states its uncertainty beside its scored evidence;
- quality and limitations remain visible before approval.

The clinician attachment renders the same contract as one Letter page. The print layout was generated from the live approved synthetic source-event record, verified as exactly one 612 by 792 point page, rendered to PNG, and visually inspected for clipping, overlap, hierarchy, and legibility. It remains an additional page for the unchanged source Findings report, not a replacement.

## Validation evidence

Automated tests cover:

- deterministic output across repeated builds;
- all seven required sections and schema alignment;
- source-supplied range-level precedence;
- exact theme evidence preservation;
- critical-screen routing without raw response wording;
- explicit uncertainty and follow-up prompts;
- prohibited diagnostic-certainty detection;
- mandatory unscored specificity;
- matching review and print structures;
- responsive one-column rules and keyboard tab semantics;
- API and study-package projection.

Live QA covers the current API, zero browser warnings/errors, click and arrow-key tab behavior, 390-pixel reflow without horizontal overflow, 44-pixel minimum visible controls, and the one-page Letter print artifact at `qa/clinical-brief-print.pdf`.

## What must still come from outside PERL

This implementation does not establish the clinical standard described in the proposal. Before a pilot or live use, Dolores and the named clinical lead still need to provide authoritative e-QPASS scoring/range specifications, de-identified counselor-interpreted report samples, an approved tone and intended-use statement, the numeric satisfaction threshold before blind testing, named counselor and independent-review panels, accepted legal/privacy/accessibility language, authenticated e-QPASS integration, and every existing site, release, traffic, continuity, and clinical-use authorization.
