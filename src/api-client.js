export class ApiClient {
  constructor(base = "/api", actor = "Demo reviewer") {
    this.base = base;
    this.actor = actor;
    this.accessToken = null;
    this.available = false;
  }

  setActor(actor) {
    this.actor = actor;
  }

  setAccessToken(token = null) {
    if (token !== null && (typeof token !== "string" || token.length < 64 || new TextEncoder().encode(token).length > 16 * 1024)) {
      throw new Error("PERL access token must be a bounded compact assertion.");
    }
    this.accessToken = token;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-PERL-Demo-Actor": this.actor,
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...options.headers
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    this.available = true;
    return payload;
  }

  async health() { return this.request("/health"); }
  async identityAccessPublic() { return this.request("/security/identity/public"); }
  async identityAccess() { return this.request("/security/identity"); }
  async workspaceExperience() { return this.request("/workspace/experience"); }
  async saveWorkspaceExperience(profile) { return this.request("/workspace/experience", { method: "PUT", body: JSON.stringify({ profile }) }); }
  async modelStatus() { return this.request("/model/status"); }
  async listAssessments() { return this.request("/assessments"); }
  async getAssessment(id) { return this.request(`/assessments/${encodeURIComponent(id)}`); }
  async importAssessment(assessment) { return this.request("/assessments/import", { method: "POST", body: JSON.stringify({ assessment }) }); }
  async importSourceEvent(event) { return this.request("/integration/eqpass/events", { method: "POST", body: JSON.stringify({ event }) }); }
  async integrationRehearsal() { return this.request("/integration/rehearsal"); }
  async startIntegrationRehearsal() { return this.request("/integration/rehearsal/runs", { method: "POST", body: "{}" }); }
  async integrationReturn() { return this.request("/integration/owner-return"); }
  async preflightIntegrationReturn(manifest) { return this.request("/integration/owner-return/preflight", { method: "POST", body: JSON.stringify({ manifest }) }); }
  async attachments() { return this.request("/integration/eqpass/attachments"); }
  async prepareAttachment(attachment) { return this.request("/integration/eqpass/attachments", { method: "POST", body: JSON.stringify({ attachment }) }); }
  async providerWorkflow() { return this.request("/integration/workflow"); }
  async retryProviderWorkflow(id) { return this.request(`/integration/workflow/${encodeURIComponent(id)}/retry`, { method: "POST", body: "{}" }); }
  async deliveryOutbox() { return this.request("/integration/delivery"); }
  async processDelivery(id) { return this.request(`/integration/delivery/${encodeURIComponent(id)}/process`, { method: "POST", body: "{}" }); }
  async retryDelivery(id) { return this.request(`/integration/delivery/${encodeURIComponent(id)}/retry`, { method: "POST", body: "{}" }); }
  async recoveryStatus() { return this.request("/operations/recovery"); }
  async rehearseRecovery() { return this.request("/operations/recovery/rehearse", { method: "POST", body: "{}" }); }
  async rollbackStatus() { return this.request("/operations/rollback"); }
  async rehearseRollback() { return this.request("/operations/rollback/rehearse", { method: "POST", body: "{}" }); }
  async releaseCandidateStatus() { return this.request("/operations/release"); }
  async buildReleaseCandidate() { return this.request("/operations/release/build", { method: "POST", body: "{}" }); }
  async releaseAdmissionStatus() { return this.request("/operations/release/admission"); }
  async runReleaseAdmission(artifactId) { return this.request(`/operations/release/candidates/${encodeURIComponent(artifactId)}/admission/run`, { method: "POST", body: "{}" }); }
  async releasePromotionStatus() { return this.request("/operations/release/promotion"); }
  async prepareReleasePromotion(artifactId) { return this.request(`/operations/release/candidates/${encodeURIComponent(artifactId)}/promotion/prepare`, { method: "POST", body: "{}" }); }
  async verifyReleasePromotionAttestation(attestation) { return this.request("/operations/release/promotions/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async verifyReleaseSignature(envelope) { return this.request("/operations/release/signatures/verify", { method: "POST", body: JSON.stringify({ envelope }) }); }
  async monitoringStatus() { return this.request("/operations/monitoring"); }
  async probeMonitoring() { return this.request("/operations/monitoring/probe", { method: "POST", body: "{}" }); }
  async incidentResponseStatus() { return this.request("/operations/incidents/response"); }
  async rehearseIncidentResponse(scenarioId) { return this.request("/operations/incidents/response/rehearse", { method: "POST", body: JSON.stringify({ scenarioId }) }); }
  async intendedUse() { return this.request("/governance/intended-use"); }
  async saveIntendedUseDraft(payload) { return this.request("/governance/intended-use/drafts", { method: "POST", body: JSON.stringify(payload) }); }
  async languageReview() { return this.request("/governance/language-review"); }
  async sealLanguageReview() { return this.request("/governance/language-review/seal", { method: "POST", body: "{}" }); }
  async pilotReadinessStatus() { return this.request("/governance/readiness"); }
  async recordPilotReadinessSnapshot() { return this.request("/governance/readiness/snapshot", { method: "POST", body: "{}" }); }
  async marketabilityMap() { return this.request("/governance/marketability"); }
  async executiveHandoff() { return this.request("/governance/handoff.json"); }
  async decisionExchange() { return this.request("/governance/decision-exchange"); }
  async preflightDecisionReturn(manifest) { return this.request("/governance/decision-exchange/preflight", { method: "POST", body: JSON.stringify({ manifest }) }); }
  async pilotOperations() { return this.request("/governance/pilot-operations"); }
  async recordPilotOperationsSnapshot() { return this.request("/governance/pilot-operations/snapshot", { method: "POST", body: "{}" }); }
  async providerActivation() { return this.request("/governance/provider-activation"); }
  async recordProviderActivationSnapshot() { return this.request("/governance/provider-activation/snapshot", { method: "POST", body: "{}" }); }
  async campusObservatory() { return this.request("/operations/campus-observatory"); }
  async recordCampusObservatorySnapshot(payload) { return this.request("/operations/campus-observatory/snapshots", { method: "POST", body: JSON.stringify(payload) }); }
  async siteAdmission() { return this.request("/governance/site-admission"); }
  async preflightSiteAdmissionReturn(manifest) { return this.request("/governance/site-admission/preflight", { method: "POST", body: JSON.stringify({ manifest }) }); }
  async authorityTrust() { return this.request("/governance/authority-trust"); }
  async issueAuthorityTrustChallenge(candidateId) { return this.request("/governance/authority-trust/challenges", { method: "POST", body: JSON.stringify({ candidateId }) }); }
  async verifyAuthorityTrustReceipt(receipt) { return this.request("/governance/authority-trust/receipts/verify", { method: "POST", body: JSON.stringify({ receipt }) }); }
  async pilotStart() { return this.request("/governance/pilot-start"); }
  async issuePilotStartChallenge(candidateId) { return this.request("/governance/pilot-start/challenges", { method: "POST", body: JSON.stringify({ candidateId }) }); }
  async verifyPilotStartOrder(order) { return this.request("/governance/pilot-start/orders/verify", { method: "POST", body: JSON.stringify({ order }) }); }
  async verifyPilotStartAcknowledgement(acknowledgement) { return this.request("/governance/pilot-start/acknowledgements/verify", { method: "POST", body: JSON.stringify({ acknowledgement }) }); }
  async clinicalRelease() { return this.request("/governance/clinical-release"); }
  async issueClinicalReleaseChallenge(candidateId) { return this.request("/governance/clinical-release/challenges", { method: "POST", body: JSON.stringify({ candidateId }) }); }
  async verifyClinicalUseAuthorization(authorization) { return this.request("/governance/clinical-release/clinical-authorizations/verify", { method: "POST", body: JSON.stringify({ authorization }) }); }
  async verifyProductionReleaseAuthorization(authorization) { return this.request("/governance/clinical-release/production-authorizations/verify", { method: "POST", body: JSON.stringify({ authorization }) }); }
  async verifyReleaseDeploymentAttestation(attestation) { return this.request("/governance/clinical-release/deployment-attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async trafficActivation() { return this.request("/governance/traffic-activation"); }
  async issueTrafficActivationChallenge(candidateId) { return this.request("/governance/traffic-activation/challenges", { method: "POST", body: JSON.stringify({ candidateId }) }); }
  async verifyClinicalTrafficAuthorization(authorization) { return this.request("/governance/traffic-activation/clinical-authorizations/verify", { method: "POST", body: JSON.stringify({ authorization }) }); }
  async verifyOperationsTrafficAuthorization(authorization) { return this.request("/governance/traffic-activation/operations-authorizations/verify", { method: "POST", body: JSON.stringify({ authorization }) }); }
  async verifyFirstGovernedTransactionAttestation(attestation) { return this.request("/governance/traffic-activation/first-transactions/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async saveNarrative(id, audience, text) { return this.request(`/assessments/${encodeURIComponent(id)}/narratives/${encodeURIComponent(audience)}`, { method: "PUT", body: JSON.stringify({ text }) }); }
  async saveInterpretation(id, interpretation) { return this.request(`/assessments/${encodeURIComponent(id)}/interpretation`, { method: "PUT", body: JSON.stringify({ interpretation }) }); }
  async acknowledgeSafety(id, acknowledged) { return this.request(`/assessments/${encodeURIComponent(id)}/safety-ack`, { method: "POST", body: JSON.stringify({ acknowledged }) }); }
  async approve(id) { return this.request(`/assessments/${encodeURIComponent(id)}/approve`, { method: "POST", body: "{}" }); }
  async submitFeedback(id, reasons, note) { return this.request(`/assessments/${encodeURIComponent(id)}/feedback`, { method: "POST", body: JSON.stringify({ reasons, note }) }); }
  async submitComparison(payload) { return this.request("/comparisons", { method: "POST", body: JSON.stringify(payload) }); }
  async nextComparison() { return this.request("/calibration/next"); }
  async nextTimingTask() { return this.request("/calibration/timing/next"); }
  async submitTimingTask(taskId, finalSummary) { return this.request("/calibration/timing", { method: "POST", body: JSON.stringify({ taskId, finalSummary }) }); }
  async metrics() { return this.request("/calibration/metrics"); }
  async analysis() { return this.request("/calibration/analysis"); }
  async calibrationIntake() { return this.request("/calibration/intake.json"); }
  async modelTrial() { return this.request("/calibration/model-trial"); }
  async preflightModelTrial(manifest) { return this.request("/calibration/model-trial/preflight", { method: "POST", body: JSON.stringify({ manifest }) }); }
  async candidateTrial() { return this.request("/calibration/candidate-trial"); }
  async recordCandidateTrialSnapshot() { return this.request("/calibration/candidate-trial/snapshot", { method: "POST", body: "{}" }); }
  async candidateReturns() { return this.request("/calibration/candidate-returns"); }
  async recordCandidateReturns(payload) { return this.request("/calibration/candidate-returns/outputs", { method: "POST", body: JSON.stringify(payload) }); }
  async candidateReview() { return this.request("/calibration/candidate-review"); }
  async nextCandidateReview() { return this.request("/calibration/candidate-review/assignments", { method: "POST", body: "{}" }); }
  async submitCandidateReview(payload) { return this.request("/calibration/candidate-review/outcomes", { method: "POST", body: JSON.stringify(payload) }); }
  async candidateRefinement() { return this.request("/calibration/candidate-refinement"); }
  async createCandidateRefinementCycle(payload) { return this.request("/calibration/candidate-refinement/cycles", { method: "POST", body: JSON.stringify(payload) }); }
  async candidateRetest(cycleId = "") { return this.request(`/calibration/candidate-retest${cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ""}`); }
  async recordCandidateRetestReturns(payload) { return this.request("/calibration/candidate-retest/returns", { method: "POST", body: JSON.stringify(payload) }); }
  async nextCandidateRetestReview(cycleId) { return this.request("/calibration/candidate-retest/reviews/assignments", { method: "POST", body: JSON.stringify({ cycleId }) }); }
  async submitCandidateRetestReview(payload) { return this.request("/calibration/candidate-retest/reviews/outcomes", { method: "POST", body: JSON.stringify(payload) }); }
  async candidateRetestDisposition(cycleId = "") { return this.request(`/calibration/candidate-retest/disposition${cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ""}`); }
  async issueCandidateRetestDispositionChallenge(cycleId) { return this.request("/calibration/candidate-retest/disposition/challenges", { method: "POST", body: JSON.stringify({ cycleId }) }); }
  async verifyCandidateRetestDispositionAttestation(attestation) { return this.request("/calibration/candidate-retest/disposition/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async candidateAdvancement(cycleId = "") { return this.request(`/calibration/candidate-advancement${cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ""}`); }
  async issueCandidateCycleActionChallenge(cycleId) { return this.request("/calibration/candidate-advancement/cycle-action/challenges", { method: "POST", body: JSON.stringify({ cycleId }) }); }
  async verifyCandidateCycleActionAttestation(attestation) { return this.request("/calibration/candidate-advancement/cycle-action/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async issueCandidateAdvancementChallenge(cycleId) { return this.request("/calibration/candidate-advancement/candidate/challenges", { method: "POST", body: JSON.stringify({ cycleId }) }); }
  async verifyCandidateAdvancementAttestation(attestation) { return this.request("/calibration/candidate-advancement/candidate/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async counselorLab() { return this.request("/calibration/counselor-lab.json"); }
  async counselorNotebook() { return this.request("/calibration/counselor-notebook"); }
  async recordCounselorNotebookEntry(payload) { return this.request("/calibration/counselor-notebook/entries", { method: "POST", body: JSON.stringify(payload) }); }
  async counselorReferenceRoom() { return this.request("/calibration/reference-room"); }
  async recordCounselorReferenceDraft(payload) { return this.request("/calibration/reference-room/drafts", { method: "POST", body: JSON.stringify(payload) }); }
  async counselorReferenceAdjudication() { return this.request("/calibration/reference-adjudication"); }
  async sealCounselorReferenceAdjudication() { return this.request("/calibration/reference-adjudication/seal", { method: "POST", body: "{}" }); }
  async counselorReferenceDecision() { return this.request("/calibration/reference-decision"); }
  async issueCounselorReferenceDecisionChallenge() { return this.request("/calibration/reference-decision/challenges", { method: "POST", body: "{}" }); }
  async verifyCounselorReferenceDecisionAttestation(attestation) { return this.request("/calibration/reference-decision/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async progressReview() { return this.request("/progress"); }
  async recordProgressReviewObservation(payload) { return this.request("/progress/observations", { method: "POST", body: JSON.stringify(payload) }); }
  async clinicalStandard() { return this.request("/calibration/clinical-standard"); }
  async saveClinicalStandardDraft(payload) { return this.request("/calibration/clinical-standard/drafts", { method: "POST", body: JSON.stringify(payload) }); }
  async independentReview() { return this.request("/calibration/independent-review"); }
  async sealIndependentReview() { return this.request("/calibration/independent-review/seal", { method: "POST", body: "{}" }); }
  async independentReviewAdmission() { return this.request("/calibration/independent-review/admission"); }
  async issueIndependentReviewAdmissionChallenge() { return this.request("/calibration/independent-review/admission/challenges", { method: "POST", body: "{}" }); }
  async verifyIndependentReviewAdmissionAttestation(attestation) { return this.request("/calibration/independent-review/admission/attestations/verify", { method: "POST", body: JSON.stringify({ attestation }) }); }
  async refinement() { return this.request("/calibration/refinement"); }
  async incidents() { return this.request("/incidents"); }
  async reportIncident(payload) { return this.request("/incidents", { method: "POST", body: JSON.stringify(payload) }); }
  async resolveIncident(id, resolution) { return this.request(`/incidents/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }); }
  async sourceEvents() { return this.request("/integration/eqpass/events"); }
  async changes() { return this.request("/changes"); }
  async proposeChange(payload) { return this.request("/changes", { method: "POST", body: JSON.stringify(payload) }); }
  async replayChange(id) { return this.request(`/changes/${encodeURIComponent(id)}/replay`, { method: "POST", body: "{}" }); }
  async decideChange(id, disposition, note) { return this.request(`/changes/${encodeURIComponent(id)}/disposition`, { method: "POST", body: JSON.stringify({ disposition, note }) }); }
}
