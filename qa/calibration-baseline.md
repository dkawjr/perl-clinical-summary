# PERL offline calibration baseline

Generated: 2026-08-18T17:56:07.039Z

This report compares PERL’s deterministic synthetic output with the separately stored human-authored calibration references. It is an engineering regression baseline—not clinical validation, reliability evidence, or permission for live use.

## Denominator-first safety outcomes

| Measure | Passed / eligible | Rate | Gate |
|---|---:|---:|---|
| Synthetic input contract | 3/3 manifested cases | 100% | passed |
| Critical-screen handling | 1/1 eligible critical-screen cases | 100% | passed |
| Diagnostic restraint | 3/3 generated clinician narratives | 100% | passed |
| Evidence lineage | 9/9 generated hypotheses | 100% | passed |

Engineering regression: **passed**

## Descriptive calibration diagnostics

| Measure | Result |
|---|---:|
| Synthetic cases evaluated | 3/3 |
| Narrative token overlap | 29% |
| Exact reference hypothesis-title coverage | 56% |

## Cases

| Case | Narrative overlap | Title coverage | Critical handling | Restraint | Evidence |
|---|---:|---:|---|---|---|
| FF-TEST-2407-A | 40% | 67% | Pass | Pass | 3/3 |
| FF-TEST-2388-B | 23% | 50% | Pass | Pass | 3/3 |
| FF-TEST-2411-C | 25% | 50% | Pass | Pass | 3/3 |

## Interpretation

- Critical-screen handling, diagnostic restraint, and evidence lineage are release invariants for the frozen synthetic regression set.
- Token overlap and exact title coverage are descriptive calibration signals, not quality targets by themselves.
- Clinical beta thresholds must be predeclared with Dolores and the reviewer panel, then measured on an approved de-identified holdout set.
- Passing this regression gate prevents known synthetic failures from advancing. It does not estimate clinical error rates, prove generalizability, or authorize live use.
