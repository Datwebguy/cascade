import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPostInput, draftWarnings } from "./post-input";
import type { Draft } from "./types";

const base: Draft = { channelId: "ch1", text: "Hello", includeMedia: true, mode: "addToQueue" };
const image = { url: "https://cdn.example.com/a.jpg", kind: "image" as const };

test("addToQueue with image asset and ideaId", () => {
  const input = buildPostInput({ draft: base, service: "twitter", media: image, ideaId: "idea1" });
  assert.equal(input.mode, "addToQueue");
  assert.equal(input.schedulingType, "automatic");
  assert.equal(input.ideaId, "idea1");
  assert.deepEqual(input.assets, [{ image: { url: image.url } }]);
  assert.equal(input.saveToDraft, undefined);
  assert.equal(input.metadata, undefined);
});

test("saveToDraft maps to addToQueue + saveToDraft", () => {
  const input = buildPostInput({ draft: { ...base, mode: "saveToDraft" }, service: "linkedin", media: null, ideaId: null });
  assert.equal(input.mode, "addToQueue");
  assert.equal(input.saveToDraft, true);
  assert.deepEqual(input.assets, []);
  assert.equal(input.ideaId, undefined);
});

test("customScheduled requires dueAt and sends ISO", () => {
  assert.throws(() =>
    buildPostInput({ draft: { ...base, mode: "customScheduled" }, service: "twitter", media: null, ideaId: null }),
  );
  const input = buildPostInput({
    draft: { ...base, mode: "customScheduled", dueAt: "2030-01-02T03:04:00.000Z" },
    service: "twitter",
    media: null,
    ideaId: null,
  });
  assert.equal(input.mode, "customScheduled");
  assert.equal(input.dueAt, "2030-01-02T03:04:00.000Z");
});

test("includeMedia=false drops the asset", () => {
  const input = buildPostInput({ draft: { ...base, includeMedia: false }, service: "twitter", media: image, ideaId: null });
  assert.deepEqual(input.assets, []);
});

test("Instagram metadata: reel for video, post for image", () => {
  const video = { url: "https://cdn.example.com/a.mp4", kind: "video" as const };
  const reel = buildPostInput({ draft: base, service: "instagram", media: video, ideaId: null });
  assert.deepEqual(reel.metadata, { instagram: { type: "reel", shouldShareToFeed: true } });
  assert.deepEqual(reel.assets, [{ video: { url: video.url } }]);
  const post = buildPostInput({ draft: base, service: "instagram", media: image, ideaId: null });
  assert.deepEqual(post.metadata, { instagram: { type: "post", shouldShareToFeed: true } });
});

test("warnings: limits, required media, past schedule", () => {
  assert.deepEqual(draftWarnings(base, "twitter", null), []);
  assert.equal(draftWarnings({ ...base, text: "x".repeat(281) }, "twitter", null).length, 1);
  assert.match(draftWarnings(base, "instagram", null)[0], /requires an image or video/);
  assert.match(draftWarnings(base, "youtube", image)[0], /requires a video/);
  assert.match(
    draftWarnings({ ...base, mode: "customScheduled", dueAt: "2000-01-01T00:00" }, "twitter", null)[0],
    /past/,
  );
});
