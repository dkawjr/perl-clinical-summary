import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPerlServer } from "../server.mjs";
import { DEPLOYMENT_CANDIDATE_VERSION, DEPLOYMENT_PRESENTATION_CONTRACT } from "../src/deployment-presentation.js";

const directory = await mkdtemp(join(tmpdir(), "perl-deployment-candidate-"));
let runtime;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  runtime = await createPerlServer({
    storePath: join(directory, "state.json"),
    workspaceExperiencePath: join(directory, "workspace.json"),
    presentationMode: "deployment-review"
  });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = runtime.server.address();
  const base = `http://127.0.0.1:${port}`;
  const [healthResponse, readyResponse, pageResponse, scriptResponse] = await Promise.all([
    fetch(`${base}/api/health`),
    fetch(`${base}/api/ready`),
    fetch(`${base}/`),
    fetch(`${base}/app.js`)
  ]);
  const [health, ready, page, script] = await Promise.all([
    healthResponse.json(), readyResponse.json(), pageResponse.text(), scriptResponse.text()
  ]);
  check(healthResponse.status === 200 && readyResponse.status === 200, "Health or readiness probe failed.");
  check(pageResponse.status === 200 && scriptResponse.status === 200, "Production static path failed.");
  check(health.deploymentPresentation?.contractVersion === DEPLOYMENT_PRESENTATION_CONTRACT, "Deployment presentation contract is missing.");
  check(health.deploymentPresentation?.candidateVersion === DEPLOYMENT_CANDIDATE_VERSION, "Deployment candidate version is incorrect.");
  check(health.deploymentPresentation?.deploymentReviewReady === true, "Deployment-review presentation did not become ready.");
  check(health.deploymentPresentation?.phiAccepted === false && health.deploymentPresentation?.clinicalUseAuthorized === false, "Deployment presentation inflated clinical authority.");
  check(ready.status === "ready" && ready.ok === true, "Runtime readiness is not green.");
  check(page.includes("deployment-candidate-bar") && page.includes("server-required"), "Deployment candidate interface is incomplete.");
  check(script.includes("deploymentReviewReady"), "Deployment candidate hydration is incomplete.");
  for (const header of ["cache-control", "content-security-policy", "cross-origin-opener-policy", "cross-origin-resource-policy", "permissions-policy", "referrer-policy", "x-content-type-options", "x-frame-options", "x-permitted-cross-domain-policies"]) check(pageResponse.headers.has(header), `Security header ${header} is missing.`);
  console.log(`PASS PERL ${DEPLOYMENT_CANDIDATE_VERSION} deployment-review runtime`);
  console.log("PASS persistent server/API path, readiness, static delivery, security headers, and source-file interlock");
  console.log("BOUNDARY evaluation records only · PHI and clinical activation require external authorization");
} finally {
  if (runtime?.server?.listening) await new Promise(resolve => runtime.server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
