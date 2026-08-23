import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_BYTES, checkUploadFile } from "./upload-input";

test("accepts an ordinary image under the ceiling", () => {
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/png" }), { ok: true });
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/jpeg" }), { ok: true });
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/webp" }), { ok: true });
});

test("accepts a file exactly at the ceiling and rejects one byte over", () => {
  assert.equal(checkUploadFile({ size: MAX_UPLOAD_BYTES, type: "image/png" }).ok, true);
  const over = checkUploadFile({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.error, /too large/);
});

test("rejects an empty file", () => {
  const empty = checkUploadFile({ size: 0, type: "image/png" });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /empty/);
});

test("rejects a non-image type", () => {
  const pdf = checkUploadFile({ size: 10, type: "application/pdf" });
  assert.equal(pdf.ok, false);
  if (!pdf.ok) assert.match(pdf.error, /not a supported image/);
});

// SVG is an image the browser will execute script from. Cloudinary serves it
// cross-origin so it cannot script into ariko.app, but there is no reason to
// accept an active format when every real capture is a raster.
test("rejects svg specifically", () => {
  assert.equal(checkUploadFile({ size: 10, type: "image/svg+xml" }).ok, false);
});

test("a missing type is rejected rather than assumed", () => {
  assert.equal(checkUploadFile({ size: 10, type: "" }).ok, false);
});
