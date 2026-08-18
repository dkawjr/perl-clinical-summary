import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LOCAL_LAST_KNOWN_GOOD,
  ROLLBACK_REHEARSAL_BOUNDARY,
  ROLLBACK_REHEARSAL_CONTRACT,
  rollbackManifestHash,
  validateRollbackManifest
} from "../src/rollback-rehearsal.js";

const schema = JSON.parse(
  await readFile(new URL("../schemas/rollback-rehearsal-event.schema.json", import.meta.url), "utf8")
);

test("local last-known-good manifest is sealed, bounded, and explicitly non-deployable", () => {
  assert.deepEqual(validateRollbackManifest(LOCAL_LAST_KNOWN_GOOD), []);
  assert.equal(LOCAL_LAST_KNOWN_GOOD.artifactRepository, "working-tree-only");
  assert.equal(LOCAL_LAST_KNOWN_GOOD.deployableArtifactAvailable, false);
  assert.equal(LOCAL_LAST_KNOWN_GOOD.clinicalValidation, false);
  assert.equal(LOCAL_LAST_KNOWN_GOOD.clinicalReleaseAuthorized, false);
  assert.equal(LOCAL_LAST_KNOWN_GOOD.sourceFiles.length, 152);
  assert.equal(new Set(LOCAL_LAST_KNOWN_GOOD.sourceFiles.map(file => file.path)).size, 152);
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/deployment-presentation.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/deployment-presentation.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/workspace-experience.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/workspace-experience.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/clinical-brief.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/clinical-brief.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/release-candidate.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/release-candidate-manifest.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/release-admission.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/release-admission-report.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/release-promotion.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/release-promotion-attestation.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/runtime-envelope.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/runtime-envelope-policy.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/model-transport.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/model-transport-policy.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-trial.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-trial-planning-snapshot-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-return.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-return-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "candidate-return.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-blind-review.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-blind-review-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "candidate-blind-review.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-retest-return.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-retest-rereview.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-return-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-rereview-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "candidate-retest-rereview.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-retest-disposition.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-disposition-registry.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-disposition-challenge.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-disposition-attestation.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-retest-disposition-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "candidate-retest-disposition.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/candidate-advancement.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-advancement-registry.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-advancement-challenge.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-advancement-attestation.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/candidate-advancement-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "candidate-advancement.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/counselor-reference-adjudication.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/counselor-reference-adjudication-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/intended-use.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/intended-use-draft-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/language-review.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/audience-handoff-page.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/language-review-packet-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/language-review-page.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "language-review.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "language-review-print.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/decision-exchange.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "decision-exchange.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "decision-exchange-print.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/pilot-operations.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/pilot-operations-snapshot-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "pilot-operations.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "pilot-operations-print.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/site-admission.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/site-admission-return-preflight-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "site-admission.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "site-admission-print.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/authority-trust.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/authority-trust-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "authority-trust.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/pilot-start.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/pilot-start-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "pilot-start.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/clinical-release.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/clinical-release-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "clinical-release.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/traffic-activation.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/traffic-activation-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "traffic-activation.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/identity-access.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/identity-access-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "identity-access.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/campus-observatory.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/campus-observatory-snapshot-event.schema.json"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "campus-observatory.css"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "src/integration-rehearsal.js"));
  assert.ok(LOCAL_LAST_KNOWN_GOOD.sourceFiles.some(file => file.path === "schemas/integration-rehearsal-observatory.schema.json"));
  assert.match(rollbackManifestHash(), /^[a-f0-9]{64}$/);
  assert.match(ROLLBACK_REHEARSAL_BOUNDARY, /does not restore a deployable artifact/i);
});

test("every pinned local baseline source fingerprint matches the current working tree", async () => {
  for (const file of LOCAL_LAST_KNOWN_GOOD.sourceFiles) {
    const bytes = await readFile(new URL(`../${file.path}`, import.meta.url));
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, file.expectedHash, `${file.path} drifted from the sealed local baseline`);
  }
});

test("rollback event schema prohibits deployment and clinical-release claims", () => {
  assert.equal(ROLLBACK_REHEARSAL_CONTRACT, "perl-application-rollback-rehearsal/1.0");
  assert.equal(schema.properties.contractVersion.const, ROLLBACK_REHEARSAL_CONTRACT);
  assert.equal(schema.properties.artifactRepository.const, "working-tree-only");
  assert.equal(schema.properties.deployableArtifactRestored.const, false);
  assert.equal(schema.properties.productionRollbackPerformed.const, false);
  assert.equal(schema.properties.clinicalValidation.const, false);
  assert.equal(schema.properties.clinicalReleaseAuthorized.const, false);
  assert.ok(schema.properties.verification.required.includes("sourceFilesMatch"));
  assert.ok(schema.properties.verification.required.includes("syntheticRegressionPassed"));
  assert.ok(schema.properties.verification.required.includes("recoveryPrerequisiteVerified"));
});
