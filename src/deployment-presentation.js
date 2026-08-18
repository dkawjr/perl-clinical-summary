export const DEPLOYMENT_PRESENTATION_CONTRACT = "perl-deployment-presentation/1.0";
export const DEPLOYMENT_CANDIDATE_VERSION = "2.49";

const MODES = new Set(["engineering", "deployment-review"]);

export function normalizeDeploymentPresentationMode(value = "engineering") {
  const mode = String(value || "engineering").trim().toLowerCase();
  if (!MODES.has(mode)) throw Object.assign(new Error("PERL presentation mode must be engineering or deployment-review."), { code: "PRESENTATION_MODE_INVALID", status: 500 });
  return mode;
}

export function buildDeploymentPresentation({ requestedMode = "engineering", runtimeStatus = {} } = {}) {
  const mode = normalizeDeploymentPresentationMode(requestedMode);
  const deploymentReview = mode === "deployment-review";
  const serverReady = runtimeStatus.status === "ready";
  const policyControlled = runtimeStatus.mode === "policy-controlled-synthetic-container";
  return {
    contractVersion: DEPLOYMENT_PRESENTATION_CONTRACT,
    candidateVersion: DEPLOYMENT_CANDIDATE_VERSION,
    mode,
    label: deploymentReview ? "Deployment candidate" : "Engineering workspace",
    environmentLabel: deploymentReview ? "Protected deployment review" : "Persistent synthetic workspace",
    dataLabel: "Evaluation records · no PHI",
    serverBacked: true,
    persistent: true,
    productionApiPathExercised: true,
    productionStaticPathExercised: true,
    deploymentReviewReady: deploymentReview && serverReady,
    policyControlledContainer: policyControlled,
    upstreamTlsRequiredForDeployment: true,
    authenticatedIdentityConfigured: false,
    authoritativeEqpassConnected: false,
    productionModelAuthorized: false,
    phiAccepted: false,
    clinicalValidationComplete: false,
    clinicalUseAuthorized: false,
    patientUseAuthorized: false,
    boundary: deploymentReview
      ? "This is the release-candidate experience on the production server and API path with persistent evaluation state. Deployment review is ready when the runtime is ready; PHI, authoritative e-QPASS connectivity, production identity, clinical validation, clinical release, traffic activation, and patient use still require their named external approvals."
      : "This engineering presentation uses the same server and API path but does not claim deployment review, PHI approval, clinical validation, release, traffic, or patient-use authority."
  };
}

export function validateDeploymentPresentation(presentation) {
  const errors = [];
  const keys = ["authenticatedIdentityConfigured", "authoritativeEqpassConnected", "boundary", "candidateVersion", "clinicalUseAuthorized", "clinicalValidationComplete", "contractVersion", "dataLabel", "deploymentReviewReady", "environmentLabel", "label", "mode", "patientUseAuthorized", "persistent", "phiAccepted", "policyControlledContainer", "productionApiPathExercised", "productionModelAuthorized", "productionStaticPathExercised", "serverBacked", "upstreamTlsRequiredForDeployment"];
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation) || JSON.stringify(Object.keys(presentation).sort()) !== JSON.stringify(keys.sort())) return ["Deployment presentation must contain the exact contract fields."];
  if (presentation.contractVersion !== DEPLOYMENT_PRESENTATION_CONTRACT || presentation.candidateVersion !== DEPLOYMENT_CANDIDATE_VERSION || !MODES.has(presentation.mode)) errors.push("Deployment presentation identity is invalid.");
  for (const key of ["serverBacked", "persistent", "productionApiPathExercised", "productionStaticPathExercised", "deploymentReviewReady", "policyControlledContainer", "upstreamTlsRequiredForDeployment", "authenticatedIdentityConfigured", "authoritativeEqpassConnected", "productionModelAuthorized", "phiAccepted", "clinicalValidationComplete", "clinicalUseAuthorized", "patientUseAuthorized"]) if (typeof presentation[key] !== "boolean") errors.push(`Deployment presentation ${key} must be boolean.`);
  if (!presentation.serverBacked || !presentation.persistent || !presentation.productionApiPathExercised || !presentation.productionStaticPathExercised || !presentation.upstreamTlsRequiredForDeployment) errors.push("Deployment presentation must preserve the server-backed production-path contract.");
  if ([presentation.authenticatedIdentityConfigured, presentation.authoritativeEqpassConnected, presentation.productionModelAuthorized, presentation.phiAccepted, presentation.clinicalValidationComplete, presentation.clinicalUseAuthorized, presentation.patientUseAuthorized].some(Boolean)) errors.push("Deployment presentation cannot manufacture production or clinical authority.");
  if (presentation.deploymentReviewReady && presentation.mode !== "deployment-review") errors.push("Only deployment-review mode may report deployment-review readiness.");
  if (typeof presentation.label !== "string" || typeof presentation.environmentLabel !== "string" || typeof presentation.dataLabel !== "string" || typeof presentation.boundary !== "string" || presentation.boundary.length < 160) errors.push("Deployment presentation copy is incomplete.");
  return [...new Set(errors)];
}
