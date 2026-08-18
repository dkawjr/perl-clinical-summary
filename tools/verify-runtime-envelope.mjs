import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  runtimeEnvelopePolicyTemplate,
  validateContainerBuildAssets,
  validateRuntimeEnvelopePolicy
} from "../src/runtime-envelope.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const [containerfile, healthcheck, policyFile] = await Promise.all([
  readFile(`${root}deploy/Containerfile`, "utf8"),
  readFile(`${root}tools/runtime-healthcheck.mjs`, "utf8"),
  readFile(`${root}deploy/runtime-policy.template.json`, "utf8").then(JSON.parse)
]);
const now = () => new Date("2026-08-14T12:00:00.000Z");
const errors = [
  ...validateContainerBuildAssets({ containerfile, healthcheck }),
  ...validateRuntimeEnvelopePolicy(policyFile, now)
];
if (JSON.stringify(policyFile) !== JSON.stringify(runtimeEnvelopePolicyTemplate())) errors.push("Runtime policy file and generated template differ.");
if (errors.length) {
  for (const error of [...new Set(errors)]) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log("PASS perl-runtime-envelope/1.0 static rehearsal");
  console.log("PASS policy, non-root identity, fixed probes, immutable-root contract, and bounded state mount");
  console.log("BOUNDARY no Linux image build, scan, signature, publication, deployment, PHI approval, or clinical authority claimed");
}
