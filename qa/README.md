# PERL visual QA evidence

The screenshots and PDF in this folder are synthetic product evidence. They are not clinical records, validation evidence, or approval for live use.

`clinical-summary-print.pdf` is the August 13 workspace-print baseline created before the dedicated `perl-clinician-report/1.0` attachment was added. It remains here as design history and must not be described as the current approved attachment format.

The current report is served from `GET /api/assessments/:id/report.html`. The August 13 current-format browser inspection confirmed an exact Letter-size sheet at 816 by 1056 CSS pixels, no horizontal overflow, loaded local typography, four score cards, three evidence-linked hypotheses, five or fewer follow-up questions, and visible clinical and synthetic-use boundaries.

Current visual evidence:

- `clinician-report-draft-desktop.png` shows the review watermark, direct critical-screen routing, and unapproved boundary.
- `clinician-report-approved-desktop.png` shows the immutable approved state, reviewer, report version, provider version, source hash, and artifact hash without a draft watermark.
- `clinician-report-approved-mobile.png` is the approved attachment at an exact 390 CSS-pixel report viewport. The header, source metadata, four score cards, safety disposition, three hypotheses, questions, approval, provenance, and synthetic-use boundary remain readable in one column with no clipped clinical content.
- `change-control-desktop.png` shows the governed learning-loop register and explicit live-release boundary.
- `change-control-dialog-desktop.png` shows the loaded-version proposal contract and frozen-case evidence scope.

The current-format PDF is `output/pdf/PERL-clinician-summary-approved-synthetic.pdf`. It was generated from the approved report route on August 13, 2026 and visually inspected after rendering. It is one tagged Letter page with no clipping, overlap, broken glyphs, or missing sections. Text extraction confirms the title, all four follow-up questions, clinical boundary, version provenance, and synthetic-use boundary. It is synthetic product evidence, not a production attachment or clinical approval.

`report-render-evidence.json` pins the screenshot and PDF hashes, dimensions, report/provider versions, artifact lineage, observed render checks, and the exact limits of this evidence.
