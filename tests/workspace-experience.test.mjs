import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_WORKSPACE_PROFILE,
  WORKSPACE_EXPERIENCE_BOUNDARY,
  WORKSPACE_EXPERIENCE_CONTRACT,
  WorkspaceExperienceRepository,
  buildWorkspaceExperience,
  createWorkspaceProfileEvent,
  validateWorkspaceProfile,
  verifyWorkspaceProfileEventChain
} from "../src/workspace-experience.js";

test("workspace experience defaults to a calm clinician surface with immutable safety visibility", () => {
  const workspace = buildWorkspaceExperience({ actor: "REVIEWER-01", generatedAt: "2026-08-14T12:00:00.000Z" });
  assert.equal(workspace.contractVersion, WORKSPACE_EXPERIENCE_CONTRACT);
  assert.deepEqual(workspace.profile, DEFAULT_WORKSPACE_PROFILE);
  assert.deepEqual(workspace.display.alwaysVisibleModules, ["safety", "limitations", "approval"]);
  assert.equal(workspace.display.safetyCanBeHidden, false);
  assert.equal(workspace.context.roleContextGrantsAuthorization, false);
  assert.equal(workspace.patientLevelDemographicsAvailable, false);
  assert.match(WORKSPACE_EXPERIENCE_BOUNDARY, /cannot be used for diagnosis/i);
});

test("demographic lens is aggregate, constructed, and minimum-cell protected", () => {
  const workspace = buildWorkspaceExperience({ actor: "REVIEWER-01" });
  assert.equal(workspace.demographics.totalSyntheticRecords, 42);
  assert.equal(workspace.demographics.minimumCellSize, 5);
  assert.equal(workspace.demographics.dimensions.length, 4);
  assert.ok(workspace.demographics.dimensions.every(dimension => dimension.cells.every(cell => cell.suppressed || cell.count >= 5)));
  assert.equal(workspace.demographics.personLevelRecordsAvailable, false);
  assert.equal(workspace.demographics.protectedAttributeDecisioningAllowed, false);
});

test("profile validation rejects extra fields, unknown roles, and repeated modules", () => {
  assert.deepEqual(validateWorkspaceProfile(structuredClone(DEFAULT_WORKSPACE_PROFILE)), []);
  assert.match(validateWorkspaceProfile({ ...structuredClone(DEFAULT_WORKSPACE_PROFILE), grantsApproval: true }).join(" "), /exactly/i);
  assert.match(validateWorkspaceProfile({ ...structuredClone(DEFAULT_WORKSPACE_PROFILE), clinicianRole: "super-admin" }).join(" "), /clinicianRole/i);
  assert.match(validateWorkspaceProfile({ ...structuredClone(DEFAULT_WORKSPACE_PROFILE), visibleModules: ["evidence", "evidence"] }).join(" "), /unique subset/i);
});

test("profile events form a strict tamper-evident display-only chain", () => {
  const first = createWorkspaceProfileEvent({ actor: "REVIEWER-01", profile: DEFAULT_WORKSPACE_PROFILE, sequence: 1, previousHash: "GENESIS", createdAt: "2026-08-14T12:00:00.000Z", id: "event-1" });
  const second = createWorkspaceProfileEvent({ actor: "REVIEWER-02", profile: { ...structuredClone(DEFAULT_WORKSPACE_PROFILE), density: "compact" }, sequence: 2, previousHash: first.hash, createdAt: "2026-08-14T12:01:00.000Z", id: "event-2" });
  assert.equal(verifyWorkspaceProfileEventChain([first, second]).valid, true);
  second.profile.density = "calm";
  assert.equal(verifyWorkspaceProfileEventChain([first, second]).valid, false);
});

test("repository persists actor-specific preferences and fails closed on tampering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perl-workspace-experience-"));
  const filePath = join(directory, "workspace.json");
  const repository = new WorkspaceExperienceRepository({ filePath, clock: () => new Date("2026-08-14T12:00:00.000Z") });
  const profile = { ...structuredClone(DEFAULT_WORKSPACE_PROFILE), clinicianRole: "clinical-supervisor", reviewFocus: "evidence-first", visibleModules: ["metadata", "evidence", "patterns", "quality", "lineage"] };
  const saved = await repository.save(profile, "REVIEWER-01");
  assert.equal(saved.changed, true);
  assert.equal(saved.workspace.profile.clinicianRole, "clinical-supervisor");
  assert.equal(saved.workspace.chain.valid, true);
  const unchanged = await repository.save(profile, "REVIEWER-01");
  assert.equal(unchanged.changed, false);
  const reopened = new WorkspaceExperienceRepository({ filePath });
  assert.equal((await reopened.status("REVIEWER-01")).profile.reviewFocus, "evidence-first");
  const state = JSON.parse(await readFile(filePath, "utf8"));
  state.events[0].profile.reviewFocus = "balanced";
  await writeFile(filePath, JSON.stringify(state), "utf8");
  await assert.rejects(() => new WorkspaceExperienceRepository({ filePath }).init(), /integrity check failed/i);
  await rm(directory, { recursive: true, force: true });
});

test("published workspace schema freezes aggregate and authority boundaries", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/workspace-experience.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.contractVersion.const, WORKSPACE_EXPERIENCE_CONTRACT);
  assert.equal(schema.properties.display.properties.safetyCanBeHidden.const, false);
  assert.equal(schema.properties.demographics.properties.minimumCellSize.const, 5);
  assert.equal(schema.properties.demographics.properties.personLevelRecordsAvailable.const, false);
  assert.equal(schema.properties.patientLevelDemographicsAvailable.const, false);
  assert.equal(schema.properties.phiIncluded.const, false);
});
