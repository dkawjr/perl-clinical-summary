# Source-Only Counselor Reference Drafting Room

Contract: `perl-counselor-reference-draft/1.0`  
Current package: `perl-synthetic-calibration-package/2.36` (Room introduced in `2.33`)  
State schema: `sandbox-state/42`

## Decision

PERL now gives counselors a protected place to author a human reference candidate before any generated interpretation is shown. This closes a methodological gap in the July 2026 proposal: a human-versus-AI comparison is not independent if the human reference begins by reading the AI draft.

The room deliberately exposes only scored synthetic evidence from the development partition. It withholds the PERL summary, generated themes and questions, author mapping, and the frozen holdout. The interface is an authoring surface, not an adjudication or acceptance surface.

## Source-only evidence contract

For each visible development case, the server returns:

- the visibly synthetic assessment ID;
- overall and core-scale scores with source-supplied range labels;
- scored subscales with their source labels and domains;
- the deterministic direct-review requirement and instruction;
- a SHA-256 fingerprint of the exact source profile;
- `generatedContentIncluded: false` and `counselorReferenceIncluded: false`.

The room never returns a generated summary, generated theme, generated follow-up question, accepted counselor reference, raw response, Findings content, subject identity, or holdout case. The server derives the eligible cases from the frozen manifest's `development` partition; client-side filtering is not trusted.

## Draft contract

A draft contains one concise summary, one to four themes, two to six direct-interview questions, three to five fixed tone markers, and the exact critical-review disposition. Every theme requires:

- a title and bounded explanation;
- one to six evidence tokens that exactly match the selected scored source profile;
- a bounded Low, Moderate, or High confidence label;
- an explicit uncertainty statement.

The server rejects unexpected fields, invented evidence, stale source hashes, wrong critical routing, questions that are not questions, identifier-like content, diagnostic or treatment certainty, and unsupported claims. One reviewer code can record one immutable draft per development case. A second submission for the same reviewer and case fails closed.

## Integrity and privacy

`counselorReferenceDrafts` is the thirty-sixth append-only integrity family. Each event binds the contract, sequence, prior hash, assessment and manifest lineage, exact source snapshot and hash, authoring mode, narrative payload, tone markers, critical disposition, reviewer code, timestamp, and all false authority claims. Startup verifies the complete chain and refuses altered evidence or inflated authority.

The interactive history is reviewer-local: the current sandbox reviewer sees only drafts recorded under that code. The aggregate study export may include the immutable synthetic events and chain head for reproducibility, but its Reference Drafting Room projection does not expose another reviewer's authoring history.

Reviewer codes are local synthetic attribution, not identity, credentials, licensure, roster membership, independence proof, or clinical authority. The room accepts no file, participant name, credential, attendance, transcript, raw response, Findings content, or PHI.

## Authority ceiling

Every draft hard-codes these claims to false:

- counselor identity verified;
- independent authorship verified;
- counselor reference accepted;
- adjudication completed;
- protocol frozen;
- clinical validation established;
- clinical release authorized;
- patient use authorized.

No route or control can accept, revise, promote, freeze, or insert a draft into the blind comparison set. Those actions require an externally governed panel, authenticated separation of duties, approved source material, documented adjudication, and independent protocol authority.

## API

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/calibration/reference-room` | Returns the two development source profiles, fixed tone markers, current reviewer-local history, metrics, chain status, and boundary |
| `POST` | `/api/calibration/reference-room/drafts` | Validates and records one immutable source-only candidate for the current reviewer and development case |
| `GET` | `/api/calibration/reference-room.json` | Downloads the bounded local room projection; it is not an accepted reference set |

## Design and accessibility

The room uses a three-part editorial worktable: a scored source book, a warm paper drafting desk, and a dark reviewer-local ledger. Burgundy, forest, parchment, and restrained brass separate it visually from generic AI chat or dashboard patterns. The `SOURCE ∅ AI` folio makes the contamination boundary visible without implying that authorship independence has been verified.

Native form controls, explicit labels, grouped evidence and tone choices, polite status updates, visible focus treatment, reduced-motion handling, and 44-pixel-or-larger targets support keyboard and touch use. The desktop three-column worktable becomes two columns at tablet width and one source-ordered column at phone width.

## Still required

- authoritative e-QPASS score/range and Findings provenance;
- approved de-identified development samples and a separately protected holdout;
- authenticated counselor identity, qualifications, conflicts, and panel roster;
- accepted language, tone, uncertainty, critical-route, and evidence-citation rules;
- governed independent authorship controls and blinded adjudication;
- accepted reference versions, dissent, supersession, and freeze provenance;
- independent statistical/clinical evaluation and every legal, privacy, security, accessibility, integration, release, and patient-use gate.

Package 2.33 established the working source-only methodology and product surface. Package 2.34 carries its immutable candidates into the separate [Counselor Reference Adjudication Antechamber](./COUNSELOR_REFERENCE_ADJUDICATION.md) without weakening the authoring boundary. Package 2.35 adds the authenticated [Counselor Reference Decision Docket](./COUNSELOR_REFERENCE_DECISION_DOCKET.md) after that local comparison. Authoring and comparison still make no panel, identity, or clinical-acceptance claim; only the ordered outside returns can establish the bounded reference freeze.
