import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INCIDENT_OWNER_TREE,
  INCIDENT_RESPONSE_BOUNDARY,
  INCIDENT_RESPONSE_CONTRACT,
  INCIDENT_RESPONSE_SCENARIOS,
  INCIDENT_SEVERITY_MODEL,
  RESPONSE_PHASES,
  incidentResponseScenario,
  validateIncidentResponseContract
} from "../src/incident-response.js";

const schema = JSON.parse(
  await readFile(new URL("../schemas/incident-response-rehearsal-event.schema.json", import.meta.url), "utf8")
);

test("incident-response contract fixes severity, scenarios, phases, and owner seams", () => {
  assert.equal(INCIDENT_RESPONSE_CONTRACT, "perl-incident-response-rehearsal/1.0");
  assert.deepEqual(validateIncidentResponseContract(), []);
  assert.equal(INCIDENT_SEVERITY_MODEL.length, 4);
  assert.equal(INCIDENT_RESPONSE_SCENARIOS.length, 6);
  assert.equal(RESPONSE_PHASES.length, 4);
  assert.equal(INCIDENT_OWNER_TREE.length, 5);
  assert.equal(incidentResponseScenario("critical-safety-routing").severity, "SEV1");
  assert.match(INCIDENT_RESPONSE_BOUNDARY, /does not declare or contain a production incident/i);
  assert.match(INCIDENT_RESPONSE_BOUNDARY, /approve restart/i);
});

test("incident-response event schema prohibits production response and authority claims", () => {
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.contractVersion.const, INCIDENT_RESPONSE_CONTRACT);
  assert.equal(schema.properties.scope.const, "local-synthetic-tabletop");
  assert.equal(schema.properties.productionIncidentDeclared.const, false);
  assert.equal(schema.properties.productionServiceStopped.const, false);
  assert.equal(schema.properties.productionContainmentClaimed.const, false);
  assert.equal(schema.properties.notificationTreeConnected.const, false);
  assert.equal(schema.properties.externalNotificationsSent.const, false);
  assert.equal(schema.properties.stopAuthorityAssigned.const, false);
  assert.equal(schema.properties.ownerAssignmentsComplete.const, false);
  assert.equal(schema.properties.clinicalRestartAuthorized.const, false);
  assert.equal(schema.properties.clinicalReleaseAuthorized.const, false);
  assert.equal(schema.properties.phases.minItems, 4);
  assert.equal(schema.properties.restartCriteria.minItems, 4);
});
