import { generateClinicalInterpretation, generateSummary } from "./engine.js";
import { projectModelInput } from "./model-input.js";
import {
  GENERATION_OUTPUT_CONTRACT,
  GENERATION_POLICY_HASH,
  GENERATION_POLICY_VERSION,
  normalizeGenerationBundle,
  StructuredCandidateProvider,
  validateGenerationBundle
} from "./model-gateway.js";
import { createHttpsModelTransport } from "./model-transport.js";

export const SUPPORTED_AUDIENCES = ["clinician", "care", "payer", "admin"];

export class DeterministicSummaryProvider {
  constructor({ version = "cal-0.9.3" } = {}) {
    this.id = "deterministic-calibration";
    this.version = version;
    this.mode = "rules";
    this.promptVersion = `deterministic-rules/${version}`;
    this.policyHash = GENERATION_POLICY_HASH;
    this.phiApproved = false;
    this.externalTransmission = false;
  }

  describe() {
    return {
      id: this.id,
      version: this.version,
      mode: this.mode,
      promptVersion: this.promptVersion,
      policyVersion: GENERATION_POLICY_VERSION,
      policyHash: this.policyHash,
      inputSchemaVersion: "perl-scored-profile/1.0",
      outputSchemaVersion: GENERATION_OUTPUT_CONTRACT,
      approvedBy: "local-engineering-baseline",
      approvalScope: "synthetic-calibration-only",
      phiApproved: false,
      externalTransmission: false,
      failureMode: "deterministic-fail-closed"
    };
  }

  async generateCase(assessment) {
    const modelInput = projectModelInput(assessment);
    const raw = {
      narratives: Object.fromEntries(SUPPORTED_AUDIENCES.map(audience => [audience, generateSummary(modelInput, audience)])),
      interpretation: generateClinicalInterpretation(modelInput)
    };
    const errors = validateGenerationBundle(raw, assessment);
    if (errors.length) throw Object.assign(new Error(`Deterministic generation failed the clinical contract. ${errors.join(" ")}`), { status: 500 });
    return normalizeGenerationBundle(raw, this.describe());
  }

  async generate(assessment, audience = "clinician") {
    if (!SUPPORTED_AUDIENCES.includes(audience)) {
      throw Object.assign(new Error(`Unsupported audience: ${audience}`), { status: 400 });
    }
    return (await this.generateCase(assessment)).narratives[audience];
  }

  async generateBundle(assessment) {
    return (await this.generateCase(assessment)).narratives;
  }

  async interpret(assessment) {
    return (await this.generateCase(assessment)).interpretation;
  }
}

export function createModelProvider(options = {}) {
  const requested = options.provider || process.env.PERL_MODEL_PROVIDER || "deterministic";
  if (requested === "deterministic") return new DeterministicSummaryProvider(options);
  if (requested === "structured-candidate") return new StructuredCandidateProvider(options);
  if (requested === "structured-candidate-https") {
    const policy = options.policy;
    const credential = options.credential ?? process.env[policy?.credential?.environmentVariable || ""];
    const transport = createHttpsModelTransport({
      policy,
      credential,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.clock ? { clock: options.clock } : {})
    });
    return new StructuredCandidateProvider({
      transport,
      timeoutMs: policy.timeoutMs,
      clock: options.clock,
      authorization: {
        status: policy.status,
        ...policy.candidate
      }
    });
  }
  throw new Error(`Model provider “${requested}” is not configured. Use deterministic, inject an explicitly authorized structured-candidate transport, or provision a startup-approved structured-candidate-https policy.`);
}
