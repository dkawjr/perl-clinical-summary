import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  DEPLOYMENT_CANDIDATE_VERSION,
  DEPLOYMENT_PRESENTATION_CONTRACT,
  buildDeploymentPresentation,
  normalizeDeploymentPresentationMode,
  validateDeploymentPresentation
} from "../src/deployment-presentation.js";

test("deployment review uses the production server path without manufacturing authority", () => {
  const presentation = buildDeploymentPresentation({ requestedMode: "deployment-review", runtimeStatus: { status: "ready", mode: "local-synthetic-loopback" } });
  assert.deepEqual(validateDeploymentPresentation(presentation), []);
  assert.equal(presentation.contractVersion, DEPLOYMENT_PRESENTATION_CONTRACT);
  assert.equal(presentation.candidateVersion, DEPLOYMENT_CANDIDATE_VERSION);
  assert.equal(presentation.deploymentReviewReady, true);
  assert.equal(presentation.serverBacked, true);
  assert.equal(presentation.persistent, true);
  assert.equal(presentation.productionApiPathExercised, true);
  assert.equal(presentation.phiAccepted, false);
  assert.equal(presentation.clinicalUseAuthorized, false);
});

test("engineering mode cannot claim deployment-review readiness", () => {
  const presentation = buildDeploymentPresentation({ requestedMode: "engineering", runtimeStatus: { status: "ready", mode: "local-synthetic-loopback" } });
  assert.deepEqual(validateDeploymentPresentation(presentation), []);
  assert.equal(presentation.deploymentReviewReady, false);
  assert.equal(presentation.label, "Engineering workspace");
});

test("presentation mode fails closed and schema freezes denied claims", async () => {
  assert.throws(() => normalizeDeploymentPresentationMode("production"), /engineering or deployment-review/);
  const schema = JSON.parse(await readFile(new URL("../schemas/deployment-presentation.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, DEPLOYMENT_PRESENTATION_CONTRACT);
  assert.equal(schema.properties.phiAccepted.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});

test("launcher, container profile, and GitHub workflows preserve the server-backed boundary", async () => {
  const [launcher, launcherStat, compose, verification, publication, packageFile] = await Promise.all([
    readFile(new URL("../Launch PERL.command", import.meta.url), "utf8"),
    stat(new URL("../Launch PERL.command", import.meta.url)),
    readFile(new URL("../deploy/compose.production-review.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/verify-candidate.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/publish-container.yml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.ok((launcherStat.mode & 0o111) !== 0);
  assert.match(launcher, /npm run preview:deployment/);
  assert.match(launcher, /api\/ready/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\n\s+- ALL/);
  assert.match(compose, /runtime-policy\.json:\/run\/perl\/runtime-policy\.json:ro/);
  assert.match(verification, /npm run verify:deployment/);
  assert.match(verification, /npm run release:verify/);
  assert.match(publication, /@sha256:/);
  assert.match(publication, /ghcr\.io/);
  assert.equal(packageFile.version, "2.49.0");
  assert.equal(packageFile.scripts["preview:deployment"], "node tools/start-deployment-review.mjs");
  assert.equal(packageFile.scripts["verify:deployment"], "node tools/verify-deployment-candidate.mjs");
});
