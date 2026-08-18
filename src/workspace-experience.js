import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const WORKSPACE_EXPERIENCE_CONTRACT = "perl-workspace-experience/1.0";
export const WORKSPACE_PROFILE_EVENT_CONTRACT = "perl-workspace-profile-event/1.0";
export const WORKSPACE_EXPERIENCE_STATE_CONTRACT = "perl-workspace-experience-state/1.0";
export const WORKSPACE_EXPERIENCE_BOUNDARY = "Display preferences change emphasis and navigation only. They do not change source evidence, generated content, safety routing, clinical permissions, approval authority, model behavior, or release status. The demographic lens contains constructed aggregate demonstration data, suppresses cells below five, exposes no person-level records, includes no PHI, and cannot be used for diagnosis, eligibility, prioritization, coverage, or care decisions.";

const ACTOR = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,47}$/;
const HEX = /^[a-f0-9]{64}$/;
const MINIMUM_CELL_SIZE = 5;
const PROFILE_KEYS = ["defaultMode", "clinicianRole", "careSetting", "reviewFocus", "density", "visibleModules", "demographicDimension"];

export const WORKSPACE_OPTIONS = Object.freeze({
  modes: Object.freeze([
    Object.freeze({ id: "clinical", label: "Clinical", note: "One record, one accountable review decision." }),
    Object.freeze({ id: "studio", label: "Practice studio", note: "Configure the workspace and inspect aggregate patterns." })
  ]),
  clinicianRoles: Object.freeze([
    Object.freeze({ id: "licensed-clinician", label: "Licensed clinician", note: "Prioritizes evidence review, clinical questions, and the approval boundary." }),
    Object.freeze({ id: "clinical-supervisor", label: "Clinical supervisor", note: "Adds quality, lineage, and coaching context around the review." }),
    Object.freeze({ id: "care-coordinator", label: "Care coordinator", note: "Emphasizes handoff context while keeping clinical approval separate." }),
    Object.freeze({ id: "operations-lead", label: "Operations lead", note: "Emphasizes aggregate workflow and hides patient-level clinical decision controls in Studio." })
  ]),
  careSettings: Object.freeze([
    Object.freeze({ id: "university-counseling", label: "University counseling" }),
    Object.freeze({ id: "community-behavioral-health", label: "Community behavioral health" }),
    Object.freeze({ id: "private-practice", label: "Private practice" }),
    Object.freeze({ id: "utilization-review", label: "Utilization review" })
  ]),
  reviewFocuses: Object.freeze([
    Object.freeze({ id: "balanced", label: "Balanced review", note: "Evidence, context, safety, and follow-up share the page." }),
    Object.freeze({ id: "safety-first", label: "Safety first", note: "Keeps the safety gate and pattern checks closest to the decision." }),
    Object.freeze({ id: "evidence-first", label: "Evidence first", note: "Brings score lineage and quality controls forward." }),
    Object.freeze({ id: "conversation-first", label: "Conversation first", note: "Brings clinical themes and follow-up questions forward." })
  ]),
  densities: Object.freeze([
    Object.freeze({ id: "calm", label: "Calm", note: "Generous spacing for deliberate review." }),
    Object.freeze({ id: "compact", label: "Compact", note: "More context in view without changing content." })
  ]),
  modules: Object.freeze([
    Object.freeze({ id: "metadata", label: "Record metadata" }),
    Object.freeze({ id: "evidence", label: "Score evidence" }),
    Object.freeze({ id: "patterns", label: "Pattern checks" }),
    Object.freeze({ id: "questions", label: "Follow-up questions" }),
    Object.freeze({ id: "quality", label: "Draft quality" }),
    Object.freeze({ id: "handoff", label: "e-QPASS handoff" }),
    Object.freeze({ id: "lineage", label: "Revision lineage" }),
    Object.freeze({ id: "audit", label: "Audit trail" })
  ]),
  demographicDimensions: Object.freeze([
    Object.freeze({ id: "age-band", label: "Age band" }),
    Object.freeze({ id: "gender", label: "Gender" }),
    Object.freeze({ id: "first-generation", label: "First-generation status" }),
    Object.freeze({ id: "service-language", label: "Service language" })
  ])
});

const DEFAULT_VISIBLE_MODULES = WORKSPACE_OPTIONS.modules.map(item => item.id);

export const DEFAULT_WORKSPACE_PROFILE = Object.freeze({
  defaultMode: "clinical",
  clinicianRole: "licensed-clinician",
  careSetting: "university-counseling",
  reviewFocus: "balanced",
  density: "calm",
  visibleModules: Object.freeze(DEFAULT_VISIBLE_MODULES),
  demographicDimension: "age-band"
});

const DEMOGRAPHIC_DIMENSIONS = Object.freeze([
  Object.freeze({
    id: "age-band",
    label: "Age band",
    question: "Does review access or routing look meaningfully different across age bands?",
    cells: Object.freeze([
      Object.freeze({ label: "18–20", count: 13, reviewCompletion: 85, directReviewRouting: 15, averageGpi: 76 }),
      Object.freeze({ label: "21–24", count: 18, reviewCompletion: 89, directReviewRouting: 11, averageGpi: 82 }),
      Object.freeze({ label: "25+", count: 11, reviewCompletion: 82, directReviewRouting: 18, averageGpi: 71 })
    ])
  }),
  Object.freeze({
    id: "gender",
    label: "Gender",
    question: "Are completion and direct-review routing patterns visible without identifying a person?",
    cells: Object.freeze([
      Object.freeze({ label: "Woman", count: 20, reviewCompletion: 90, directReviewRouting: 15, averageGpi: 81 }),
      Object.freeze({ label: "Man", count: 15, reviewCompletion: 80, directReviewRouting: 13, averageGpi: 73 }),
      Object.freeze({ label: "Nonbinary / self-described", count: 7, reviewCompletion: 86, directReviewRouting: 14, averageGpi: 79 })
    ])
  }),
  Object.freeze({
    id: "first-generation",
    label: "First-generation status",
    question: "Does the constructed cohort suggest an access or review-completion question worth investigating?",
    cells: Object.freeze([
      Object.freeze({ label: "First-generation", count: 18, reviewCompletion: 83, directReviewRouting: 17, averageGpi: 84 }),
      Object.freeze({ label: "Not first-generation", count: 19, reviewCompletion: 89, directReviewRouting: 11, averageGpi: 72 }),
      Object.freeze({ label: "Not recorded", count: 5, reviewCompletion: 80, directReviewRouting: 20, averageGpi: 78 })
    ])
  }),
  Object.freeze({
    id: "service-language",
    label: "Service language",
    question: "Where might language access deserve operational follow-up before a real pilot?",
    cells: Object.freeze([
      Object.freeze({ label: "English", count: 30, reviewCompletion: 90, directReviewRouting: 13, averageGpi: 76 }),
      Object.freeze({ label: "Spanish / bilingual", count: 7, reviewCompletion: 71, directReviewRouting: 14, averageGpi: 87 }),
      Object.freeze({ label: "Other / not recorded", count: 5, reviewCompletion: 80, directReviewRouting: 20, averageGpi: 74 })
    ])
  })
]);

const clone = value => structuredClone(value);

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function workspaceExperienceDigest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) errors.push(`${label} must contain exactly: ${keys.join(", ")}.`);
  return true;
}

function optionIds(key) {
  return new Set(WORKSPACE_OPTIONS[key].map(item => item.id));
}

export function normalizeWorkspaceProfile(input = {}) {
  const candidate = { ...clone(DEFAULT_WORKSPACE_PROFILE), ...(input && typeof input === "object" && !Array.isArray(input) ? clone(input) : {}) };
  const modules = new Set(Array.isArray(candidate.visibleModules) ? candidate.visibleModules : []);
  candidate.visibleModules = DEFAULT_VISIBLE_MODULES.filter(id => modules.has(id));
  return candidate;
}

export function validateWorkspaceProfile(input) {
  const errors = [];
  if (!exactKeys(input, PROFILE_KEYS, "Workspace profile", errors)) return errors;
  if (!optionIds("modes").has(input.defaultMode)) errors.push("Workspace profile defaultMode is invalid.");
  if (!optionIds("clinicianRoles").has(input.clinicianRole)) errors.push("Workspace profile clinicianRole is invalid.");
  if (!optionIds("careSettings").has(input.careSetting)) errors.push("Workspace profile careSetting is invalid.");
  if (!optionIds("reviewFocuses").has(input.reviewFocus)) errors.push("Workspace profile reviewFocus is invalid.");
  if (!optionIds("densities").has(input.density)) errors.push("Workspace profile density is invalid.");
  if (!optionIds("demographicDimensions").has(input.demographicDimension)) errors.push("Workspace profile demographicDimension is invalid.");
  const moduleIds = optionIds("modules");
  if (!Array.isArray(input.visibleModules) || new Set(input.visibleModules).size !== input.visibleModules.length || input.visibleModules.some(id => !moduleIds.has(id))) errors.push("Workspace profile visibleModules must be a unique subset of the fixed module catalog.");
  return [...new Set(errors)];
}

export function createWorkspaceProfileEvent({ actor, profile, sequence, previousHash, createdAt, id = randomUUID() }) {
  const normalized = normalizeWorkspaceProfile(profile);
  const profileErrors = validateWorkspaceProfile(normalized);
  if (!ACTOR.test(String(actor || "")) || profileErrors.length || !Number.isInteger(sequence) || sequence < 1 || (previousHash !== "GENESIS" && !HEX.test(String(previousHash || ""))) || !Number.isFinite(Date.parse(createdAt))) throw new Error(["Workspace profile event input is invalid.", ...profileErrors].join(" "));
  const core = {
    id,
    sequence,
    previousHash,
    contractVersion: WORKSPACE_PROFILE_EVENT_CONTRACT,
    eventType: "workspace-profile-saved",
    actor,
    profile: normalized,
    createdAt,
    displayOnly: true,
    clinicalAuthorityChanged: false,
    phiIncluded: false
  };
  return { ...core, hash: workspaceExperienceDigest(core) };
}

export function validateWorkspaceProfileEvent(event, { sequence, previousHash } = {}) {
  const errors = [];
  const keys = ["id", "sequence", "previousHash", "contractVersion", "eventType", "actor", "profile", "createdAt", "displayOnly", "clinicalAuthorityChanged", "phiIncluded", "hash"];
  if (!exactKeys(event, keys, "Workspace profile event", errors)) return errors;
  if (event.contractVersion !== WORKSPACE_PROFILE_EVENT_CONTRACT || event.eventType !== "workspace-profile-saved") errors.push("Workspace profile event contract or type is invalid.");
  if (!ACTOR.test(String(event.actor || "")) || !Number.isFinite(Date.parse(event.createdAt))) errors.push("Workspace profile event actor or timestamp is invalid.");
  if (event.sequence !== sequence || event.previousHash !== previousHash) errors.push("Workspace profile event sequence or previousHash is invalid.");
  if (event.displayOnly !== true || event.clinicalAuthorityChanged !== false || event.phiIncluded !== false) errors.push("Workspace profile event denied-authority claims are invalid.");
  errors.push(...validateWorkspaceProfile(event.profile));
  const { hash, ...core } = event;
  if (!HEX.test(String(hash || "")) || workspaceExperienceDigest(core) !== hash) errors.push("Workspace profile event hash is invalid.");
  return [...new Set(errors)];
}

export function verifyWorkspaceProfileEventChain(events = []) {
  let previousHash = "GENESIS";
  for (let index = 0; index < events.length; index += 1) {
    const errors = validateWorkspaceProfileEvent(events[index], { sequence: index + 1, previousHash });
    if (errors.length) return { valid: false, count: events.length, failedAt: index + 1, head: events.at(-1)?.hash || null };
    previousHash = events[index].hash;
  }
  return { valid: true, count: events.length, failedAt: null, head: events.at(-1)?.hash || null };
}

function demographicLens(selectedDimension) {
  return {
    mode: "constructed-aggregate-demonstration",
    selectedDimension,
    totalSyntheticRecords: 42,
    minimumCellSize: MINIMUM_CELL_SIZE,
    smallCellSuppressionEnforced: true,
    dimensions: DEMOGRAPHIC_DIMENSIONS.map(dimension => ({
      id: dimension.id,
      label: dimension.label,
      question: dimension.question,
      cells: dimension.cells.map(cell => cell.count < MINIMUM_CELL_SIZE
        ? { label: "Suppressed", count: null, reviewCompletion: null, directReviewRouting: null, averageGpi: null, suppressed: true }
        : { ...clone(cell), suppressed: false })
    })),
    personLevelRecordsAvailable: false,
    protectedAttributeDecisioningAllowed: false,
    clinicalOutcomeEstablished: false,
    phiIncluded: false
  };
}

export function buildWorkspaceExperience({ actor = "Demo reviewer", events = [], generatedAt = new Date().toISOString() } = {}) {
  const latest = [...events].reverse().find(event => event.actor === actor) || null;
  const profile = latest ? clone(latest.profile) : clone(DEFAULT_WORKSPACE_PROFILE);
  const role = WORKSPACE_OPTIONS.clinicianRoles.find(item => item.id === profile.clinicianRole);
  const setting = WORKSPACE_OPTIONS.careSettings.find(item => item.id === profile.careSetting);
  const focus = WORKSPACE_OPTIONS.reviewFocuses.find(item => item.id === profile.reviewFocus);
  return {
    contractVersion: WORKSPACE_EXPERIENCE_CONTRACT,
    actor,
    generatedAt,
    profile,
    context: {
      role: clone(role),
      setting: clone(setting),
      focus: clone(focus),
      statement: `${role.label} · ${setting.label} · ${focus.label}`,
      roleContextGrantsAuthorization: false,
      licensureVerified: false
    },
    display: {
      alwaysVisibleModules: ["safety", "limitations", "approval"],
      configurableModules: clone(WORKSPACE_OPTIONS.modules),
      visibleModules: clone(profile.visibleModules),
      safetyCanBeHidden: false,
      clinicalContentChanged: false
    },
    options: clone(WORKSPACE_OPTIONS),
    demographics: demographicLens(profile.demographicDimension),
    saved: Boolean(latest),
    savedAt: latest?.createdAt || null,
    displayOnly: true,
    clinicalAuthorityChanged: false,
    patientLevelDemographicsAvailable: false,
    phiIncluded: false,
    boundary: WORKSPACE_EXPERIENCE_BOUNDARY
  };
}

export class WorkspaceExperienceRepository {
  constructor({ filePath, clock = () => new Date() }) {
    this.filePath = filePath;
    this.clock = clock;
    this.state = null;
    this.writeChain = Promise.resolve();
  }

  async init() {
    if (this.state) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      if (parsed?.contractVersion !== WORKSPACE_EXPERIENCE_STATE_CONTRACT || !Array.isArray(parsed.events)) throw new Error("Unsupported workspace experience state.");
      const chain = verifyWorkspaceProfileEventChain(parsed.events);
      if (!chain.valid) throw new Error(`Workspace profile history integrity check failed at sequence ${chain.failedAt}.`);
      this.state = parsed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = { contractVersion: WORKSPACE_EXPERIENCE_STATE_CONTRACT, environment: "synthetic-sandbox", events: [] };
      await this.persist();
    }
  }

  async persist() {
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    });
    await this.writeChain;
  }

  async status(actor) {
    await this.init();
    return {
      ...buildWorkspaceExperience({ actor, events: this.state.events, generatedAt: this.clock().toISOString() }),
      chain: verifyWorkspaceProfileEventChain(this.state.events)
    };
  }

  async save(profile, actor) {
    await this.init();
    const normalized = normalizeWorkspaceProfile(profile);
    const errors = validateWorkspaceProfile(normalized);
    if (errors.length) throw Object.assign(new Error(errors.join(" ")), { status: 400 });
    const current = [...this.state.events].reverse().find(event => event.actor === actor);
    if (current && canonicalJson(current.profile) === canonicalJson(normalized)) return { changed: false, event: clone(current), workspace: await this.status(actor) };
    const previousHash = this.state.events.at(-1)?.hash || "GENESIS";
    const event = createWorkspaceProfileEvent({
      actor,
      profile: normalized,
      sequence: this.state.events.length + 1,
      previousHash,
      createdAt: this.clock().toISOString()
    });
    this.state.events.push(event);
    await this.persist();
    return { changed: true, event: clone(event), workspace: await this.status(actor) };
  }
}
