import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { calibrationManifest } from "../src/calibration-manifest.js";
import { calibrationReferences } from "../src/calibration-references.js";
import { assessments, auditSeed } from "../src/demo-data.js";
import { createModelProvider } from "../src/model-provider.js";
import { SandboxStore } from "../src/sandbox-store.js";
import {
  CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT,
  CANDIDATE_ADVANCEMENT_BOUNDARY,
  CANDIDATE_ADVANCEMENT_CONTRACT,
  CANDIDATE_ADVANCEMENT_PURPOSES,
  CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT,
  CANDIDATE_CYCLE_ACTION_PURPOSES,
  buildCandidateAdvancementAirlock,
  candidateAdvancementDigest,
  canonicalCandidateAdvancementJson,
  createCandidateAdvancementAttestationEvent,
  createCandidateAdvancementChallenge,
  createCandidateCycleActionChallenge,
  disabledCandidateAdvancementRegistry,
  disabledCandidateCycleActionRegistry,
  summarizeCandidateAdvancementRegistry,
  summarizeCandidateCycleActionRegistry,
  validateCandidateAdvancementAttestation,
  validateCandidateAdvancementChallenge,
  validateCandidateAdvancementEvent,
  validateCandidateAdvancementRegistry,
  validateCandidateCycleActionRegistry
} from "../src/candidate-advancement.js";

const NOW = "2026-08-14T12:00:00.000Z";
const HEX = value => String(value).repeat(64).slice(0, 64);
const CYCLE_ID = "FF-REFINEMENT-CYCLE-ABCDEF0123456789ABCD";

const upstream = {
  cycleId: CYCLE_ID,
  cycleEventHash: HEX("a"),
  dispositionPackageHash: HEX("b"),
  independentResultAttestationFingerprint: HEX("c"),
  independentResultEventHash: HEX("d"),
  candidateRetestDispositionChainHead: HEX("e"),
  cycleCloseRecommendation: "close-this-refinement-cycle",
  candidateRecommendation: "advance-to-separate-provider-model-decision",
  independentResultFrozen: true
};

const candidateIdentity = {
  laneId: "lane-ii",
  candidateSlot: "candidate-02",
  candidateFingerprint: HEX("f"),
  providerId: "provider-two",
  modelVersion: "model-v2.7",
  promptVersion: "prompt-r4",
  outputContract: "perl-generation-bundle/1.0",
  policyVersion: "perl-generation-policy/1.0",
  policyHash: HEX("1"),
  retestProtocolFingerprint: HEX("2"),
  hostingPattern: "azure-managed",
  region: "east-us-2",
  domainEvidenceFingerprint: HEX("3"),
  modelTrialChainHead: HEX("4"),
  candidateTrialChainHead: HEX("5"),
  candidateTrialProtocolFingerprint: HEX("6"),
  candidateReturnChainHead: HEX("7"),
  candidateRetestReturnChainHead: HEX("8")
};

const contentBoundary = () => ({
  evaluatorNamesIncluded: false,
  humanSignaturesIncluded: false,
  credentialsOrSecretsIncluded: false,
  endpointsIncluded: false,
  sourceWorkbookBytesIncluded: false,
  summaryProseIncluded: false,
  findingsContentIncluded: false,
  rawResponsesIncluded: false,
  caseFilesIncluded: false,
  patientIdentifiersIncluded: false,
  patientRecordsIncluded: false,
  phiIncluded: false,
  perlExternalTransmissionPerformed: false
});

function registryFixture(room) {
  const cycle = room === "cycle-action";
  const purposes = cycle ? CANDIDATE_CYCLE_ACTION_PURPOSES : CANDIDATE_ADVANCEMENT_PURPOSES;
  const privateKeys = new Map();
  const keys = purposes.map((purpose, index) => {
    const pair = generateKeyPairSync("ed25519");
    const keyId = cycle ? `FF-CYCLE-ACTION-KEY-TEST-${index + 1}` : `FF-CANDIDATE-ADVANCEMENT-KEY-TEST-${index + 1}`;
    privateKeys.set(purpose, pair.privateKey);
    return {
      keyId,
      algorithm: "Ed25519",
      purpose,
      publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }),
      notBefore: "2026-08-13T00:00:00.000Z",
      notAfter: "2026-08-16T00:00:00.000Z"
    };
  });
  return {
    registry: {
      contractVersion: cycle ? "perl-candidate-cycle-action-registry/1.0" : "perl-candidate-advancement-registry/1.0",
      registryId: cycle ? "FF-CYCLE-ACTION-REGISTRY-TEST-001" : "FF-CANDIDATE-ADVANCEMENT-REGISTRY-TEST-001",
      version: "1.0.0",
      issuedAt: "2026-08-13T00:00:00.000Z",
      expiresAt: "2026-08-16T00:00:00.000Z",
      keys
    },
    privateKeys
  };
}

function decisionFor(purpose, challenge, prior, { positive = true } = {}) {
  if (purpose === "clinical-cycle-action") return {
    independentResultAttestationFingerprint: challenge.independentResultAttestationFingerprint,
    clinicalActionReferenceHash: HEX("9"),
    cycleAction: positive ? "close-this-refinement-cycle" : "continue-refinement",
    outcome: "clinical-cycle-action-recorded"
  };
  if (purpose === "evaluation-custody-confirmation") return {
    clinicalCycleActionAttestationFingerprint: candidateAdvancementDigest(prior.get("clinical-cycle-action")),
    custodyReferenceHash: HEX("a"),
    cycleAction: prior.get("clinical-cycle-action").decision.cycleAction,
    outcome: "cycle-action-frozen"
  };
  if (purpose === "clinical-suitability-advancement") return {
    candidatePackageHash: challenge.candidatePackageHash,
    cycleActionAttestationFingerprint: challenge.cycleActionAttestationFingerprint,
    clinicalEvidenceReferenceHash: HEX("b"),
    clinicalSuitability: positive ? "fit-for-integration-readiness" : "retain-and-refine",
    outcome: "clinical-suitability-recorded"
  };
  if (purpose === "privacy-security-transport-fit") return {
    clinicalSuitabilityAttestationFingerprint: candidateAdvancementDigest(prior.get("clinical-suitability-advancement")),
    securityEvidenceReferenceHash: HEX("c"),
    transportFit: positive ? "fit-for-controlled-integration" : "not-fit",
    outcome: "privacy-security-fit-recorded"
  };
  if (purpose === "eqpass-integration-fit") return {
    priorAttestationFingerprints: CANDIDATE_ADVANCEMENT_PURPOSES.slice(0, 2).map(item => candidateAdvancementDigest(prior.get(item))),
    ownerEvidenceReferenceHash: HEX("d"),
    integrationFit: positive ? "fit-for-eqpass-integration-readiness" : "not-fit",
    outcome: "eqpass-integration-fit-recorded"
  };
  return {
    priorAttestationFingerprints: CANDIDATE_ADVANCEMENT_PURPOSES.slice(0, 3).map(item => candidateAdvancementDigest(prior.get(item))),
    candidatePackageHash: challenge.candidatePackageHash,
    sponsorDecisionReferenceHash: HEX("e"),
    advancementDecision: positive ? "advance-exact-candidate-to-integration-readiness" : "retain-baseline-and-refine",
    outcome: "candidate-advancement-frozen"
  };
}

function signedAttestation({ room, purpose, challenge, registry, privateKey, prior, index, positive = true }) {
  const cycle = room === "cycle-action";
  const core = {
    contractVersion: cycle ? CANDIDATE_CYCLE_ACTION_ATTESTATION_CONTRACT : CANDIDATE_ADVANCEMENT_ATTESTATION_CONTRACT,
    attestationId: cycle ? `FF-CYCLE-ACTION-ATTEST-TEST-${index + 1}` : `FF-CANDIDATE-ADVANCEMENT-ATTEST-TEST-${index + 1}`,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    registryFingerprint: challenge.registryFingerprint,
    packageHash: cycle ? challenge.cycleActionPackageHash : challenge.candidatePackageHash,
    purpose,
    keyId: registry.keys.find(key => key.purpose === purpose).keyId,
    issuedAt: NOW,
    decision: decisionFor(purpose, challenge, prior, { positive }),
    contentBoundary: contentBoundary()
  };
  return {
    ...core,
    signature: {
      algorithm: "Ed25519",
      keyId: core.keyId,
      value: sign(null, Buffer.from(canonicalCandidateAdvancementJson(core)), privateKey).toString("base64url")
    }
  };
}

function appendRoom({ room, challengeEvent, registry, privateKeys, events, positive = true }) {
  const purposes = room === "cycle-action" ? CANDIDATE_CYCLE_ACTION_PURPOSES : CANDIDATE_ADVANCEMENT_PURPOSES;
  const prior = new Map();
  let previousHash = challengeEvent.hash;
  for (const [index, purpose] of purposes.entries()) {
    const attestation = signedAttestation({ room, purpose, challenge: challengeEvent.challenge, registry, privateKey: privateKeys.get(purpose), prior, index, positive });
    assert.deepEqual(validateCandidateAdvancementAttestation(attestation, { challenge: challengeEvent.challenge, registry, priorAttestations: prior, now: NOW, seenPurposes: new Set(prior.keys()) }), []);
    const event = createCandidateAdvancementAttestationEvent({ attestation, challenge: challengeEvent.challenge, registry, actor: "AIRLOCK-QA", sequence: events.length + 1, previousHash, verifiedAt: NOW });
    assert.deepEqual(validateCandidateAdvancementEvent(event, {
      sequence: events.length + 1,
      previousHash,
      cycleActionRegistry: room === "cycle-action" ? registry : undefined,
      candidateAdvancementRegistry: room === "candidate-advancement" ? registry : undefined,
      challenge: challengeEvent.challenge,
      priorAttestations: prior,
      now: NOW,
      seenPurposes: new Set(prior.keys())
    }), []);
    events.push(event);
    prior.set(purpose, attestation);
    previousHash = event.hash;
  }
  return { prior, freezeEvent: events.at(-1) };
}

function completeAirlock({ positive = true } = {}) {
  const cycleKeys = registryFixture("cycle-action");
  const advancementKeys = registryFixture("candidate-advancement");
  const cycleChallenge = createCandidateCycleActionChallenge({ upstream, registry: cycleKeys.registry, actor: "AIRLOCK-QA", sequence: 1, createdAt: NOW });
  const events = [cycleChallenge];
  const cycleRoom = appendRoom({ room: "cycle-action", challengeEvent: cycleChallenge, registry: cycleKeys.registry, privateKeys: cycleKeys.privateKeys, events, positive });
  const cycleActionFreeze = { attestationFingerprint: cycleRoom.freezeEvent.attestationFingerprint, eventHash: cycleRoom.freezeEvent.hash };
  if (!positive) return { events, cycleKeys, advancementKeys, cycleChallenge, cycleActionFreeze };
  const candidateChallenge = createCandidateAdvancementChallenge({ upstream, cycleActionFreeze, candidateIdentity, registry: advancementKeys.registry, actor: "AIRLOCK-QA", sequence: events.length + 1, previousHash: events.at(-1).hash, createdAt: NOW });
  events.push(candidateChallenge);
  const candidateRoom = appendRoom({ room: "candidate-advancement", challengeEvent: candidateChallenge, registry: advancementKeys.registry, privateKeys: advancementKeys.privateKeys, events, positive });
  return { events, cycleKeys, advancementKeys, cycleChallenge, cycleActionFreeze, candidateChallenge, candidateRoom };
}

test("the two rooms require separate registries with six distinct purpose-bound keys", () => {
  assert.match(CANDIDATE_ADVANCEMENT_BOUNDARY, /Only a signed close/i);
  assert.deepEqual(validateCandidateCycleActionRegistry(disabledCandidateCycleActionRegistry()), []);
  assert.deepEqual(validateCandidateAdvancementRegistry(disabledCandidateAdvancementRegistry()), []);
  const cycle = registryFixture("cycle-action");
  const advancement = registryFixture("candidate-advancement");
  assert.deepEqual(validateCandidateCycleActionRegistry(cycle.registry), []);
  assert.deepEqual(validateCandidateAdvancementRegistry(advancement.registry), []);
  assert.equal(summarizeCandidateCycleActionRegistry(cycle.registry, NOW).activeKeyCount, 2);
  assert.equal(summarizeCandidateAdvancementRegistry(advancement.registry, NOW).activeKeyCount, 4);
  const repeated = structuredClone(advancement.registry);
  repeated.keys[1].publicKeyPem = repeated.keys[0].publicKeyPem;
  assert.ok(validateCandidateAdvancementRegistry(repeated).some(error => /distinct bounded/i.test(error)));
});

test("Room I binds an independent frozen result and closes only the exact recommended cycle", () => {
  const { registry, privateKeys } = registryFixture("cycle-action");
  const challengeEvent = createCandidateCycleActionChallenge({ upstream, registry, actor: "AIRLOCK-QA", sequence: 1, createdAt: NOW });
  assert.deepEqual(validateCandidateAdvancementChallenge(challengeEvent.challenge, { upstream, registryFingerprint: challengeEvent.challenge.registryFingerprint }), []);
  assert.deepEqual(validateCandidateAdvancementEvent(challengeEvent), []);
  assert.equal(Date.parse(challengeEvent.challenge.expiresAt) - Date.parse(challengeEvent.challenge.issuedAt), 86_400_000);
  const unsupportedUpstream = { ...upstream, cycleCloseRecommendation: "continue-refinement" };
  const unsupported = createCandidateCycleActionChallenge({ upstream: unsupportedUpstream, registry, actor: "AIRLOCK-QA", sequence: 1, createdAt: NOW });
  const close = signedAttestation({ room: "cycle-action", purpose: "clinical-cycle-action", challenge: unsupported.challenge, registry, privateKey: privateKeys.get("clinical-cycle-action"), prior: new Map(), index: 0 });
  assert.ok(validateCandidateAdvancementAttestation(close, { challenge: unsupported.challenge, registry, now: NOW }).some(error => /cannot close/i.test(error)));
});

test("Room II stays blind until a separately signed close, then binds the exact provider, model, prompt, policy, and protocol", () => {
  const cycleKeys = registryFixture("cycle-action");
  const advancementKeys = registryFixture("candidate-advancement");
  let airlock = buildCandidateAdvancementAirlock({ upstream, candidateIdentity, cycleActionRegistry: cycleKeys.registry, candidateAdvancementRegistry: advancementKeys.registry, events: [], generatedAt: NOW });
  assert.equal(airlock.status, "cycle-action-challenge-required");
  assert.equal(airlock.candidateIdentity.disclosed, false);
  assert.equal(airlock.candidateIdentity.providerId, null);

  const completed = completeAirlock();
  airlock = buildCandidateAdvancementAirlock({
    upstream,
    candidateIdentity,
    cycleActionRegistry: completed.cycleKeys.registry,
    candidateAdvancementRegistry: completed.advancementKeys.registry,
    events: completed.events,
    chain: { valid: true, count: completed.events.length, head: completed.events.at(-1).hash },
    generatedAt: NOW
  });
  assert.equal(airlock.status, "candidate-advancement-frozen");
  assert.equal(airlock.cycleClosed, true);
  assert.equal(airlock.candidateIdentity.disclosed, true);
  assert.equal(airlock.candidateIdentity.providerId, candidateIdentity.providerId);
  assert.equal(airlock.candidateIdentity.modelVersion, candidateIdentity.modelVersion);
  assert.equal(airlock.candidateAdvancementFrozen, true);
  assert.equal(airlock.exactCandidateAdvancedToIntegrationReadiness, true);
  assert.equal(airlock.productionEngineSelected, false);
  assert.equal(airlock.candidateTransportAuthorized, false);
  assert.equal(airlock.pilotAuthorized, false);
  assert.equal(airlock.patientUseAuthorized, false);
});

test("a continue action freezes Room I but never unlocks candidate identity or advancement", () => {
  const completed = completeAirlock({ positive: false });
  const airlock = buildCandidateAdvancementAirlock({
    upstream,
    candidateIdentity,
    cycleActionRegistry: completed.cycleKeys.registry,
    candidateAdvancementRegistry: completed.advancementKeys.registry,
    events: completed.events,
    chain: { valid: true, count: completed.events.length, head: completed.events.at(-1).hash },
    generatedAt: NOW
  });
  assert.equal(airlock.status, "cycle-action-frozen-no-advancement");
  assert.equal(airlock.cycleAction.decision, "continue-refinement");
  assert.equal(airlock.cycleClosed, false);
  assert.equal(airlock.candidateIdentity.disclosed, false);
  assert.equal(airlock.candidateAdvancementFrozen, false);
});

test("the airlock fails closed on skipped duties, signature replay, stale evidence, and inconsistent advancement", () => {
  const cycleKeys = registryFixture("cycle-action");
  const challenge = createCandidateCycleActionChallenge({ upstream, registry: cycleKeys.registry, actor: "AIRLOCK-QA", sequence: 1, createdAt: NOW });
  const signingPrior = new Map([["clinical-cycle-action", { decision: { cycleAction: "close-this-refinement-cycle" } }]]);
  const skipped = signedAttestation({ room: "cycle-action", purpose: "evaluation-custody-confirmation", challenge: challenge.challenge, registry: cycleKeys.registry, privateKey: cycleKeys.privateKeys.get("evaluation-custody-confirmation"), prior: signingPrior, index: 1 });
  assert.ok(validateCandidateAdvancementAttestation(skipped, { challenge: challenge.challenge, registry: cycleKeys.registry, now: NOW }).some(error => /verified in order/i.test(error)));
  assert.ok(validateCandidateAdvancementChallenge(challenge.challenge, { upstream: { ...upstream, candidateRetestDispositionChainHead: HEX("0") } }).some(error => /stale/i.test(error)));

  const completed = completeAirlock();
  const candidatePrior = new Map(CANDIDATE_ADVANCEMENT_PURPOSES.slice(0, 3).map((purpose, index) => [purpose, completed.candidateRoom ? completed.events[4 + index]?.attestation : null]));
  const finalEvent = completed.events.at(-1);
  const replayErrors = validateCandidateAdvancementAttestation(finalEvent.attestation, {
    challenge: completed.candidateChallenge.challenge,
    registry: completed.advancementKeys.registry,
    priorAttestations: candidatePrior,
    now: NOW,
    seenAttestationIds: new Set([finalEvent.attestation.attestationId]),
    seenSignatureHashes: new Set([candidateAdvancementDigest(finalEvent.attestation.signature.value)]),
    seenPurposes: new Set(candidatePrior.keys())
  });
  assert.ok(replayErrors.some(error => /already been recorded|already been used/i.test(error)));
  assert.ok(validateCandidateAdvancementEvent({ ...finalEvent, patientUseAuthorized: true }, { sequence: finalEvent.sequence, previousHash: finalEvent.previousHash }).some(error => /patientUseAuthorized/i.test(error)));
});

test("published schemas are strict and preserve the no-release claim boundary", async () => {
  const names = ["registry", "challenge", "attestation", "event"];
  const schemas = await Promise.all(names.map(name => readFile(new URL(`../schemas/candidate-advancement-${name}.schema.json`, import.meta.url), "utf8").then(JSON.parse)));
  assert.equal(schemas[0].additionalProperties, false);
  assert.equal(schemas[1].oneOf.length, 2);
  assert.equal(schemas[2].additionalProperties, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.patientUseAuthorized.const, false);
  assert.equal(schemas[3].$defs.attestationEvent.properties.productionReleaseAuthorized.const, false);
  assert.equal(CANDIDATE_ADVANCEMENT_CONTRACT, "perl-exact-candidate-advancement-airlock/1.0");
});

test("schema 48 migrates to 49 with an empty airlock ledger and startup verifies later events", async t => {
  const directory = await mkdtemp(join(tmpdir(), "perl-candidate-advancement-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "state.json");
  const store = new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  await store.init();
  const legacy = structuredClone(store.state);
  legacy.schemaVersion = 48;
  delete legacy.candidateAdvancementEvents;
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`, { mode: 0o600 });
  const reopened = new SandboxStore({ filePath, seedAssessments: assessments, auditSeed, calibrationReferences, calibrationManifest, modelProvider: createModelProvider() });
  await reopened.init();
  assert.equal(reopened.state.schemaVersion, 49);
  assert.deepEqual(reopened.state.candidateAdvancementEvents, []);
  assert.equal(reopened.verifyCandidateAdvancementChain().valid, true);

  const completed = completeAirlock();
  const signedStore = new SandboxStore({
    filePath: join(directory, "signed-state.json"),
    seedAssessments: assessments,
    auditSeed,
    calibrationReferences,
    calibrationManifest,
    modelProvider: createModelProvider(),
    candidateCycleActionRegistry: completed.cycleKeys.registry,
    candidateAdvancementRegistry: completed.advancementKeys.registry
  });
  await signedStore.init();
  signedStore.state.candidateAdvancementEvents = structuredClone(completed.events);
  assert.equal(signedStore.verifyCandidateAdvancementChain().valid, true);
  signedStore.state.candidateAdvancementEvents.at(-1).patientUseAuthorized = true;
  assert.equal(signedStore.verifyCandidateAdvancementChain().valid, false);
});

test("the interface is a responsive two-room instrument with no local approve or selection control", async () => {
  const [html, css, app, apiClient] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../candidate-advancement.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/api-client.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="candidate-advancement-airlock"/);
  assert.match(html, /Close the cycle\. Then name the exact candidate\./);
  assert.match(html, /Room I[\s\S]*Room II/);
  assert.match(html, /id="candidate-cycle-action-file"[^>]*accept="application\/json,.json"[^>]*disabled/);
  assert.match(html, /id="candidate-advancement-file"[^>]*accept="application\/json,.json"[^>]*disabled/);
  assert.doesNotMatch(html, /id="candidate-(cycle-action|advancement)-(approve|select|release)"/i);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /@media \(max-width:1080px\)/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /candidateCycleActionAttestation/);
  assert.match(app, /candidateAdvancementAttestation/);
  assert.match(app, /file\.size > 64 \* 1024/);
  assert.match(apiClient, /issueCandidateCycleActionChallenge/);
  assert.match(apiClient, /issueCandidateAdvancementChallenge/);
});
