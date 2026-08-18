import { createHash, randomUUID } from "node:crypto";
import { riskDisposition, validateClinicalInterpretation, validateNarrative } from "./engine.js";
import { MODEL_INPUT_CONTRACT, projectModelInput } from "./model-input.js";

export const GENERATION_REQUEST_CONTRACT = "perl-structured-generation-request/0.1";
export const GENERATION_OUTPUT_CONTRACT = "perl-generation-bundle/1.0";
export const GENERATION_POLICY_VERSION = "perl-clinical-generation-policy/1.0";

export const GENERATION_POLICY = Object.freeze([
  "Interpret only the supplied scored self-report constructs; never calculate or change scores or source severity levels.",
  "Use cautious indicator language and never diagnose, prescribe treatment, determine coverage, or authorize care.",
  "Every hypothesis must cite one or more exact evidence tokens supplied by the scored profile.",
  "When a bounded critical flag is present, require direct qualified review in the clinician narrative and a follow-up question.",
  "Return only the declared structured bundle. Do not include identifiers, source-report references, raw responses, or prose outside the schema."
]);

export const GENERATION_POLICY_HASH = createHash("sha256").update(JSON.stringify({
  version: GENERATION_POLICY_VERSION,
  instructions: GENERATION_POLICY
})).digest("hex");

const AUDIENCES = Object.freeze(["clinician", "care", "payer", "admin"]);
const IDENTIFIER_KEYS = /^(address|birthdate|clientid|dateofbirth|dob|email|firstname|fullname|lastname|medicalrecordnumber|mrn|name|patientid|phone|respondentid|ssn)$/i;

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [`${label} must be an object.`];
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.hasOwn(value, key));
  return [
    ...(unknown.length ? [`${label} contains undeclared fields: ${unknown.join(", ")}.`] : []),
    ...(missing.length ? [`${label} is missing: ${missing.join(", ")}.`] : [])
  ];
}

function containsIdentifierKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => IDENTIFIER_KEYS.test(key.replaceAll(/[^a-z0-9]/gi, "")) || containsIdentifierKey(child));
}

function explicitRestraint(text) {
  return /(?:do(?:es)? not establish a diagnosis|not a diagnosis|no diagnosis)/i.test(text);
}

export function validateGenerationBundle(bundle, assessment) {
  const errors = exactKeys(bundle, ["narratives", "interpretation"], "Generation bundle");
  if (errors.length) return errors;
  errors.push(...exactKeys(bundle.narratives, AUDIENCES, "Narratives"));
  if (containsIdentifierKey(bundle)) errors.push("Generation output contains a prohibited direct-identifier field name.");
  const risk = riskDisposition(assessment);

  for (const audience of AUDIENCES) {
    const text = bundle.narratives?.[audience];
    if (typeof text !== "string") {
      errors.push(`${audience} narrative must be a string.`);
      continue;
    }
    errors.push(...validateNarrative(text).map(error => `${audience} narrative: ${error}`));
    if (audience !== "admin" && !/self-report/i.test(text)) errors.push(`${audience} narrative must preserve the self-report frame.`);
    if (!explicitRestraint(text)) errors.push(`${audience} narrative must state the non-diagnostic boundary.`);
  }

  const clinician = String(bundle.narratives?.clinician || "");
  if (risk.requiresReview && !/(?:critical[- ]screen|direct safety|safety).{0,100}(?:review|assess)|(?:review|assess).{0,100}(?:critical[- ]screen|direct safety|safety)/i.test(clinician)) {
    errors.push("Clinician narrative must preserve direct review of the bounded critical-screen signal.");
  }
  const admin = String(bundle.narratives?.admin || "");
  const clinicalLabels = ["depression", "anxiety", "anger", "gpi", ...(assessment.subscales || []).map(item => item.label)]
    .filter(Boolean)
    .map(value => String(value).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (clinicalLabels.length && new RegExp(`\\b(?:${clinicalLabels.join("|")})\\b`, "i").test(admin)) {
    errors.push("Administrative narrative must not disclose scored clinical domains or subscales.");
  }
  if (!/(?:administrative|workflow|routing|completion)/i.test(admin) || !/(?:authorize|authorization|coverage|care decision)/i.test(admin)) {
    errors.push("Administrative narrative must remain a minimum-necessary routing note with an authorization boundary.");
  }

  errors.push(...exactKeys(bundle.interpretation, ["hypotheses", "questions"], "Interpretation"));
  if (bundle.interpretation && typeof bundle.interpretation === "object") {
    errors.push(...validateClinicalInterpretation(bundle.interpretation, assessment));
    if (risk.requiresReview && !(bundle.interpretation.questions || []).some(question => /(?:critical[- ]screen|direct safety|safety assessment)/i.test(question))) {
      errors.push("Interpretation must include direct follow-up for the bounded critical-screen signal.");
    }
  }
  return [...new Set(errors)];
}

export function normalizeGenerationBundle(bundle, provider, generatedAt = new Date().toISOString()) {
  return {
    narratives: Object.fromEntries(AUDIENCES.map(audience => [audience, {
      text: bundle.narratives[audience].trim(),
      audience,
      provider: provider.id,
      version: provider.version,
      promptVersion: provider.promptVersion,
      policyHash: provider.policyHash,
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      generatedAt,
      source: "generated"
    }])),
    interpretation: {
      hypotheses: structuredClone(bundle.interpretation.hypotheses),
      questions: bundle.interpretation.questions.map(question => String(question).trim()),
      provider: provider.id,
      version: provider.version,
      promptVersion: provider.promptVersion,
      policyHash: provider.policyHash,
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      generatedAt,
      source: "generated",
      evidenceMode: "scored-constructs"
    }
  };
}

export class StructuredCandidateProvider {
  constructor({ transport, authorization, timeoutMs = 15000, clock = () => new Date() } = {}) {
    if (typeof transport !== "function") throw new Error("Structured candidate provider requires an injected transport function.");
    if (!authorization || authorization.status !== "approved-for-synthetic-calibration") {
      throw new Error("Structured candidate provider requires explicit synthetic-calibration authorization.");
    }
    for (const key of ["providerId", "modelVersion", "promptVersion", "approvedBy"]) {
      if (!/^[A-Za-z0-9][A-Za-z0-9 ._:/-]{1,119}$/.test(String(authorization[key] || ""))) throw new Error(`Structured candidate authorization requires a bounded ${key}.`);
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) throw new Error("Candidate timeout must be 500–30,000 milliseconds.");
    this.transport = transport;
    this.clock = clock;
    this.id = authorization.providerId;
    this.version = authorization.modelVersion;
    this.promptVersion = authorization.promptVersion;
    this.approvedBy = authorization.approvedBy;
    this.policyHash = GENERATION_POLICY_HASH;
    this.mode = "structured-candidate";
    this.timeoutMs = timeoutMs;
    this.phiApproved = false;
    this.externalTransmission = true;
    this.transportStatus = typeof transport.describe === "function" ? transport.describe : null;
  }

  describe() {
    return {
      id: this.id,
      version: this.version,
      mode: this.mode,
      promptVersion: this.promptVersion,
      policyVersion: GENERATION_POLICY_VERSION,
      policyHash: this.policyHash,
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      approvedBy: this.approvedBy,
      approvalScope: "synthetic-calibration-only",
      phiApproved: false,
      externalTransmission: true,
      failureMode: "fail-closed-no-fallback"
    };
  }

  async generateCase(assessment) {
    const projected = projectModelInput(assessment);
    const request = {
      contractVersion: GENERATION_REQUEST_CONTRACT,
      requestId: randomUUID(),
      inputSchemaVersion: MODEL_INPUT_CONTRACT,
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      policyVersion: GENERATION_POLICY_VERSION,
      policyHash: GENERATION_POLICY_HASH,
      instructions: [...GENERATION_POLICY],
      payload: projected
    };
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error("Candidate generation timed out and was stopped safely."), { status: 504, code: "MODEL_TIMEOUT" }));
        }, this.timeoutMs);
      });
      const response = await Promise.race([this.transport(structuredClone(request), { signal: controller.signal }), timeout]);
      const serialized = typeof response === "string" ? response : JSON.stringify(response);
      if (Buffer.byteLength(serialized, "utf8") > 65536) throw Object.assign(new Error("Candidate output exceeded the 64 KB contract limit."), { status: 502, code: "MODEL_OUTPUT_REJECTED" });
      let bundle;
      try {
        bundle = typeof response === "string" ? JSON.parse(response) : structuredClone(response);
      } catch {
        throw Object.assign(new Error("Candidate output was not valid structured JSON."), { status: 502, code: "MODEL_OUTPUT_REJECTED" });
      }
      const errors = validateGenerationBundle(bundle, assessment);
      if (errors.length) throw Object.assign(new Error(`Candidate output failed the clinical contract (${errors.length} validation issue${errors.length === 1 ? "" : "s"}).`), { status: 502, code: "MODEL_OUTPUT_REJECTED" });
      return normalizeGenerationBundle(bundle, this.describe(), this.clock().toISOString());
    } catch (error) {
      if (error?.code === "MODEL_TIMEOUT" || error?.code === "MODEL_OUTPUT_REJECTED") throw error;
      throw Object.assign(new Error("Candidate generation was unavailable and no fallback output was created."), { status: 502, code: "MODEL_UNAVAILABLE", cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  async generateBundle(assessment) {
    return (await this.generateCase(assessment)).narratives;
  }

  async generate(assessment, audience = "clinician") {
    if (!AUDIENCES.includes(audience)) throw Object.assign(new Error(`Unsupported audience: ${audience}`), { status: 400 });
    return (await this.generateCase(assessment)).narratives[audience];
  }

  async interpret(assessment) {
    return (await this.generateCase(assessment)).interpretation;
  }
}

export function generationGatewayStatus(provider) {
  const configured = provider?.describe ? provider.describe() : {};
  const transport = provider?.transportStatus ? provider.transportStatus() : {
    contractVersion: null,
    mode: "disabled",
    authorizationScope: "none",
    policyCurrent: false,
    credentialAvailable: false,
    credentialSource: "none",
    credentialPersisted: false,
    credentialExposedByApi: false,
    retryCount: 0,
    fallbackEnabled: false,
    phiApproved: false,
    externalTransmission: false,
    productionProviderApproved: false,
    clinicalValidation: false,
    boundary: "No external model transport is configured."
  };
  return {
    contractVersion: GENERATION_REQUEST_CONTRACT,
    policyVersion: GENERATION_POLICY_VERSION,
    policyHash: GENERATION_POLICY_HASH,
    inputSchemaVersion: MODEL_INPUT_CONTRACT,
    outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
    activeProvider: configured,
    transport,
    payloadBoundary: "Only scored constructs, source-supplied levels, and bounded critical flags may cross the provider seam.",
    outputGate: "Exact structured bundle, evidence-token resolution, diagnostic restraint, critical-screen routing, and audience minimization are enforced before persistence.",
    clinicalValidation: false
  };
}
