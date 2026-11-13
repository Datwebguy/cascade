import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFile } from "./upload";

test("accepts common images and videos", () => {
  assert.equal(checkFile({ type: "image/jpeg", size: 2e6 }), null);
  assert.equal(checkFile({ type: "video/mp4", size: 200e6 }), null);
  assert.equal(checkFile({ type: "video/quicktime", size: 50e6 }), null);
});

test("rejects other types and oversize files with plain messages", () => {
  assert.match(checkFile({ type: "application/pdf", size: 1e5 })!, /JPG, PNG/);
  assert.match(checkFile({ type: "image/png", size: 25 * 1024 * 1024 })!, /over 20 MB/);
  assert.match(checkFile({ type: "video/mp4", size: 600 * 1024 * 1024 })!, /over 500 MB/);
});
