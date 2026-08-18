import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MODEL_TRIAL_BOUNDARY,
  MODEL_TRIAL_CONTRACT,
  MODEL_TRIAL_DOMAINS,
  MODEL_TRIAL_SLOTS,
  buildModelTrialBench,
  createModelTrialPreflight,
  modelTrialManifestTemplate,
  validateModelTrialContract,
  validateModelTrialManifest,
  validateModelTrialPreflight
} from "../src/model-trial.js";

const evidenceSnapshot = {
  caseSet: {
    id: "perl-synthetic-rehearsal-2026-08-v1",
    version: "1.0.0",
    manifestHash: "a".repeat(64)
  },
  syntheticCases: 3,
  generationRecords: 4,
  generationChainHead: "b".repeat(64),
  policyVersion: "perl-clinical-generation-policy/1.0",
  policyHash: "c".repeat(64),
  outputGateCount: 10,
  activeProvider: {
    id: "deterministic-calibration",
    version: "cal-0.9.3",
    mode: "rules",
    externalTransmission: false,
    phiApproved: false
  }
};

function completeManifest() {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-QA-001";
  manifest.candidates = manifest.candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    status: "metadata-declared-unverified",
    providerId: `provider-${candidateIndex + 1}`,
    modelVersion: `model-${candidateIndex + 1}.0`,
    hostingPattern: candidateIndex === 0 ? "azure-managed" : "vendor-managed",
    region: "US East",
    domainEvidence: candidate.domainEvidence.map((item, domainIndex) => ({
      ...item,
      status: "metadata-declared-unverified",
      evidenceRef: `FF-EVIDENCE-C${candidateIndex + 1}-D${domainIndex + 1}`
    }))
  }));
  return manifest;
}

test("model trial fixes exactly three candidates and six evidence domains", () => {
  assert.equal(MODEL_TRIAL_CONTRACT, "perl-model-trial-preflight/1.0");
  assert.deepEqual(validateModelTrialContract(), []);
  assert.equal(MODEL_TRIAL_SLOTS.length, 3);
  assert.equal(MODEL_TRIAL_DOMAINS.length, 6);
  assert.deepEqual(MODEL_TRIAL_DOMAINS.map(item => item.id), [
    "privacy-use", "security-architecture", "technical-behavior", "clinical-evaluation", "operational-fit", "governance-change"
  ]);
  assert.match(MODEL_TRIAL_BOUNDARY, /no credentials/i);
  assert.match(MODEL_TRIAL_BOUNDARY, /does not .*select an engine/i);
});

test("manifest template accepts metadata only and rejects secrets, records, or authority claims", () => {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-QA-002";
  assert.deepEqual(validateModelTrialManifest(manifest), []);
  for (const value of Object.values(manifest.privacyBoundary)) assert.equal(value, false);

  const authority = structuredClone(manifest);
  authority.privacyBoundary.engineSelected = true;
  assert.ok(validateModelTrialManifest(authority).some(error => /engineSelected must remain false/i.test(error)));

  const secret = structuredClone(manifest);
  secret.apiKey = "blocked";
  assert.ok(validateModelTrialManifest(secret).some(error => /outside the metadata contract/i.test(error)));

  const strayEvidence = structuredClone(manifest);
  strayEvidence.candidates[0].domainEvidence[0].evidenceRef = "https://vendor.example/private";
  assert.ok(validateModelTrialManifest(strayEvidence).some(error => /must be null/i.test(error)));
});

test("three complete candidate declarations remain unverified and cannot select an engine", () => {
  const manifest = completeManifest();
  assert.deepEqual(validateModelTrialManifest(manifest), []);
  const bench = buildModelTrialBench({ evidenceSnapshot, generatedAt: "2026-08-14T00:00:00.000Z" });
  const event = createModelTrialPreflight({
    manifest,
    evidenceSnapshot,
    actor: "MODEL-TRIAL-QA",
    sequence: 1,
    requestFingerprint: bench.requestFingerprint,
    createdAt: "2026-08-14T00:01:00.000Z"
  });
  assert.deepEqual(validateModelTrialPreflight(event), []);
  assert.equal(event.status, "metadata-complete-unverified");
  assert.equal(event.counts.metadataComplete, 3);
  assert.equal(event.counts.domainEvidenceDeclared, 18);
  assert.equal(event.decision, "engine-selection-not-authorized");
  assert.equal(event.engineSelected, false);
  assert.equal(event.securityApproved, false);
  assert.equal(event.clinicalPerformanceEstablished, false);

  const current = buildModelTrialBench({ events: [event], chain: { valid: true, count: 1, head: event.hash }, evidenceSnapshot });
  assert.equal(current.status, "metadata-complete-external-review-required");
  assert.equal(current.candidates.every(candidate => candidate.status === "candidate-metadata-complete-unverified"), true);
  assert.equal(current.engineSelected, false);
  assert.equal(current.productionReleaseAuthorized, false);
});

test("partial candidate metadata stays visibly incomplete", () => {
  const manifest = modelTrialManifestTemplate();
  manifest.trialId = "FF-MODEL-TRIAL-QA-003";
  manifest.candidates[0] = {
    ...manifest.candidates[0],
    status: "metadata-declared-unverified",
    providerId: "provider-one",
    modelVersion: "model-one.0",
    hostingPattern: "private-cloud",
    region: "US East",
    domainEvidence: manifest.candidates[0].domainEvidence.map((item, index) => index === 0 ? {
      ...item,
      status: "metadata-declared-unverified",
      evidenceRef: "FF-EVIDENCE-C1-PRIVACY"
    } : item)
  };
  const bench = buildModelTrialBench({ evidenceSnapshot });
  const event = createModelTrialPreflight({ manifest, evidenceSnapshot, actor: "MODEL-TRIAL-QA", sequence: 1, requestFingerprint: bench.requestFingerprint });
  assert.equal(event.status, "metadata-incomplete");
  assert.equal(event.counts.candidatesDeclared, 1);
  assert.equal(event.counts.metadataComplete, 0);
  assert.equal(event.counts.domainEvidenceDeclared, 1);
  assert.equal(event.engineSelected, false);
});

test("model-trial validation fails closed on evidence or authority tampering", () => {
  const bench = buildModelTrialBench({ evidenceSnapshot });
  const event = createModelTrialPreflight({ manifest: completeManifest(), evidenceSnapshot, actor: "MODEL-TRIAL-QA", sequence: 1, requestFingerprint: bench.requestFingerprint });
  assert.ok(validateModelTrialPreflight({ ...event, engineSelected: true }).some(error => /engineSelected/i.test(error)));
  const altered = structuredClone(event);
  altered.candidateResults[0].metadataComplete = false;
  assert.ok(validateModelTrialPreflight(altered).some(error => /result metadata|fingerprint/i.test(error)));
  const evidenceChanged = structuredClone(event);
  evidenceChanged.evidenceSnapshot.policyHash = "d".repeat(64);
  assert.ok(validateModelTrialPreflight(evidenceChanged).some(error => /fingerprint/i.test(error)));
});

test("model-trial event schema is strict and denies provider selection or clinical authority", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/model-trial-preflight-event.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, MODEL_TRIAL_CONTRACT);
  assert.equal(schema.properties.candidateSnapshots.minItems, 3);
  assert.equal(schema.properties.candidateSnapshots.maxItems, 3);
  assert.equal(schema.properties.decision.const, "engine-selection-not-authorized");
  assert.equal(schema.properties.credentialsReceived.const, false);
  assert.equal(schema.properties.endpointReceived.const, false);
  assert.equal(schema.properties.phiReceived.const, false);
  assert.equal(schema.properties.externalTransferPerformed.const, false);
  assert.equal(schema.properties.engineSelected.const, false);
  assert.equal(schema.properties.clinicalPerformanceEstablished.const, false);
  assert.equal(schema.properties.productionReleaseAuthorized.const, false);
  assert.equal(schema.properties.patientUseAuthorized.const, false);
});

