import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INTEGRATION_RETURN_ARTIFACTS,
  INTEGRATION_RETURN_BOUNDARY,
  INTEGRATION_RETURN_CONTRACT,
  buildIntegrationReturnDesk,
  createIntegrationReturnPreflight,
  integrationReturnManifestTemplate,
  validateIntegrationReturnContract,
  validateIntegrationReturnManifest,
  validateIntegrationReturnPreflight
} from "../src/integration-return.js";

function completeManifest() {
  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-QA-001";
  manifest.artifacts = manifest.artifacts.map((artifact, index) => ({
    ...artifact,
    status: "metadata-declared-unverified",
    version: `candidate-${index + 1}`,
    sha256: "a".repeat(64),
    mediaType: INTEGRATION_RETURN_ARTIFACTS[index].expectedMediaType,
    dataClass: INTEGRATION_RETURN_ARTIFACTS[index].expectedDataClass
  }));
  return manifest;
}

test("owner-return contract fixes the eight source-backed metadata artifacts", () => {
  assert.equal(INTEGRATION_RETURN_CONTRACT, "perl-eqpass-owner-return-preflight/1.0");
  assert.deepEqual(validateIntegrationReturnContract(), []);
  assert.equal(INTEGRATION_RETURN_ARTIFACTS.length, 8);
  assert.deepEqual(
    INTEGRATION_RETURN_ARTIFACTS.slice(0, 2).map(item => item.expectedFilename),
    ["meta_thresholds_responses_cs.xlsx", "question_categories_capitalized.xlsx"]
  );
  assert.match(INTEGRATION_RETURN_BOUNDARY, /never receives workbook bytes/i);
  assert.match(INTEGRATION_RETURN_BOUNDARY, /RFI remains open/i);
});

test("manifest template is metadata-only and rejects authority or patient-content claims", () => {
  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-QA-002";
  assert.deepEqual(validateIntegrationReturnManifest(manifest), []);
  for (const value of Object.values(manifest.privacyBoundary)) assert.equal(value, false);
  const altered = structuredClone(manifest);
  altered.privacyBoundary.patientIdentifiersIncluded = true;
  assert.ok(validateIntegrationReturnManifest(altered).some(error => /patientIdentifiersIncluded must remain false/i.test(error)));
  const extra = structuredClone(manifest);
  extra.records = [{ name: "blocked" }];
  assert.ok(validateIntegrationReturnManifest(extra).some(error => /outside the metadata contract/i.test(error)));
});

test("complete candidate metadata remains unverified and keeps the RFI open", () => {
  const manifest = completeManifest();
  assert.deepEqual(validateIntegrationReturnManifest(manifest), []);
  const desk = buildIntegrationReturnDesk({ generatedAt: "2026-08-14T00:00:00.000Z" });
  const event = createIntegrationReturnPreflight({
    manifest,
    actor: "RETURN-QA",
    sequence: 1,
    requestFingerprint: desk.requestFingerprint,
    createdAt: "2026-08-14T00:01:00.000Z"
  });
  assert.deepEqual(validateIntegrationReturnPreflight(event), []);
  assert.equal(event.status, "metadata-complete-unverified");
  assert.equal(event.counts.metadataComplete, 8);
  assert.equal(event.counts.exactWorkbookFilenameMatches, 2);
  assert.equal(event.decision, "rfi-remains-open");
  assert.equal(event.fileBytesReceived, false);
  assert.equal(event.ownerIdentityVerified, false);
  assert.equal(event.authoritativeContractAccepted, false);
  assert.equal(event.productionIntegrationAuthorized, false);

  const current = buildIntegrationReturnDesk({ events: [event], chain: { valid: true, count: 1, head: event.hash } });
  assert.equal(current.status, "metadata-complete-unverified");
  assert.equal(current.artifacts.every(artifact => artifact.status === "candidate-metadata-complete-unverified"), true);
  assert.equal(current.authoritativeContractAccepted, false);
});

test("partial metadata is recorded as incomplete without accepting source logic", () => {
  const manifest = integrationReturnManifestTemplate();
  manifest.returnId = "FF-RETURN-QA-003";
  manifest.artifacts[0] = {
    ...manifest.artifacts[0],
    status: "metadata-declared-unverified",
    version: "candidate-1",
    sha256: "b".repeat(64),
    mediaType: INTEGRATION_RETURN_ARTIFACTS[0].expectedMediaType,
    dataClass: INTEGRATION_RETURN_ARTIFACTS[0].expectedDataClass
  };
  const desk = buildIntegrationReturnDesk();
  const event = createIntegrationReturnPreflight({ manifest, actor: "RETURN-QA", sequence: 1, requestFingerprint: desk.requestFingerprint });
  assert.equal(event.status, "metadata-incomplete");
  assert.equal(event.counts.metadataComplete, 1);
  assert.equal(event.counts.missing, 7);
  assert.equal(event.scoringLogicAccepted, false);
});

test("preflight validation detects authority, result, and fingerprint tampering", () => {
  const desk = buildIntegrationReturnDesk();
  const event = createIntegrationReturnPreflight({ manifest: completeManifest(), actor: "RETURN-QA", sequence: 1, requestFingerprint: desk.requestFingerprint });
  assert.ok(validateIntegrationReturnPreflight({ ...event, authoritativeContractAccepted: true }).some(error => /authoritativeContractAccepted/i.test(error)));
  const alteredResults = structuredClone(event);
  alteredResults.artifactResults[0].metadataComplete = false;
  assert.ok(validateIntegrationReturnPreflight(alteredResults).some(error => /metadata state|counts|fingerprint/i.test(error)));
  assert.ok(validateIntegrationReturnPreflight({ ...event, note: `${event.note} altered` }).some(error => /fingerprint/i.test(error)));
});

test("owner-return event schema is strict and cannot claim data receipt or authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/eqpass-owner-return-preflight-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, INTEGRATION_RETURN_CONTRACT);
  assert.equal(schema.properties.decision.const, "rfi-remains-open");
  assert.equal(schema.properties.fileBytesReceived.const, false);
  assert.equal(schema.properties.recordLevelDataReceived.const, false);
  assert.equal(schema.properties.patientIdentifiersReceived.const, false);
  assert.equal(schema.properties.ownerIdentityVerified.const, false);
  assert.equal(schema.properties.authoritativeContractAccepted.const, false);
  assert.equal(schema.properties.productionIntegrationAuthorized.const, false);
  assert.equal(schema.properties.clinicalUseAuthorized.const, false);
});

