import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("../qa/report-render-evidence.json", import.meta.url), "utf8")
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pngDimensions(bytes) {
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("report render evidence pins the inspected screenshots and Letter PDF", async () => {
  assert.equal(manifest.evidenceFormat, "perl-report-render-evidence/1.0");
  assert.equal(manifest.environment, "synthetic-sandbox");
  assert.equal(manifest.phiApproved, false);
  assert.equal(manifest.clinicalValidation, false);
  assert.equal(manifest.clinicalReleaseAuthorized, false);
  assert.equal(manifest.report.reportFormat, "perl-clinician-report/1.0");

  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(new URL(artifact.path, root));
    assert.equal(sha256(bytes), artifact.sha256, `${artifact.path} hash drifted`);
    if (artifact.mediaType === "image/png") {
      assert.deepEqual(
        pngDimensions(bytes),
        { width: artifact.pixelWidth, height: artifact.pixelHeight },
        `${artifact.path} dimensions drifted`
      );
    }
    if (artifact.mediaType === "application/pdf") {
      assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
      assert.equal(bytes.length, artifact.bytes);
      assert.equal(artifact.pages, 1);
      assert.deepEqual(artifact.pageSizePoints, { width: 612, height: 792 });
    }
  }
});
