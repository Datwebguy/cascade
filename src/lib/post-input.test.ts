import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPostInput, checkDraft } from "./post-input";
import type { Channel, Draft } from "./types";

const ch = (service: Channel["service"], extra: Partial<Channel> = {}): Channel => ({
  id: `ch_${service}`,
  name: service,
  displayName: null,
  service,
  avatar: "",
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
  timezone: "America/New_York",
  ...extra,
});
const base: Draft = { channelId: "ch_twitter", text: "Hello", includeMedia: true, mode: "addToQueue", options: {} };
const image = { url: "https://cdn.example.com/a.jpg", kind: "image" as const };
const video = { url: "https://cdn.example.com/a.mp4", kind: "video" as const };
const now = new Date("2026-11-13T12:00:00Z");

test("addToQueue: image asset and ideaId, no forced extras", () => {
  const input = buildPostInput({ draft: base, channel: ch("twitter"), media: image, ideaId: "idea1" });
  assert.deepEqual(input, {
    channelId: "ch_twitter",
    text: "Hello",
    schedulingType: "automatic",
    mode: "addToQueue",
    assets: [{ image: { url: image.url } }],
    ideaId: "idea1",
  });
});

test("saveToDraft maps to addToQueue + saveToDraft; no assets when none", () => {
  const input = buildPostInput({ draft: { ...base, mode: "saveToDraft" }, channel: ch("linkedin"), media: null, ideaId: null });
  assert.equal(input.mode, "addToQueue");
  assert.equal(input.saveToDraft, true);
  assert.equal(input.assets, undefined);
});

test("customScheduled converts the channel's wall-clock time to UTC", () => {
  const input = buildPostInput({
    draft: { ...base, mode: "customScheduled", dueLocal: "2026-11-20T09:00" },
    channel: ch("twitter"),
    media: null,
    ideaId: null,
  });
  assert.equal(input.dueAt, "2026-11-20T14:00:00.000Z");
});

test("Instagram uses the chosen type; defaults reel for video", () => {
  const reel = buildPostInput({ draft: base, channel: ch("instagram"), media: video, ideaId: null });
  assert.deepEqual(reel.metadata, { instagram: { type: "reel", shouldShareToFeed: true } });
  const story = buildPostInput({ draft: { ...base, options: { instagramType: "story" } }, channel: ch("instagram"), media: image, ideaId: null });
  assert.deepEqual(story.metadata, { instagram: { type: "story", shouldShareToFeed: true } });
});

test("Pinterest and YouTube metadata come from the draft", () => {
  const pin = buildPostInput({ draft: { ...base, title: "T", options: { pinterestBoardId: "b1" } }, channel: ch("pinterest"), media: image, ideaId: null });
  assert.deepEqual(pin.metadata, { pinterest: { boardServiceId: "b1", title: "T" } });
  const yt = buildPostInput({ draft: { ...base, title: "Vid" }, channel: ch("youtube"), media: video, ideaId: null });
  assert.deepEqual(yt.metadata, { youtube: { title: "Vid" } });
});

test("checks: official limits and per-channel metadata", () => {
  assert.deepEqual(checkDraft(base, ch("twitter"), null, now).errors, []);
  assert.equal(checkDraft({ ...base, text: "x".repeat(281) }, ch("twitter"), null, now).errors.length, 1);
  assert.deepEqual(checkDraft({ ...base, text: "x".repeat(281) }, ch("twitter", { xSubscriptionType: "premium" }), null, now).errors, []);
  assert.equal(checkDraft({ ...base, text: "x".repeat(600) }, ch("mastodon", { mastodonMaxCharacters: 1000 }), null, now).limit, 1000);
  assert.equal(checkDraft(base, ch("instagram"), image, now).limit, 2196);
  assert.equal(checkDraft(base, ch("tiktok"), video, now).limit, 2200);
  assert.equal(checkDraft(base, ch("tiktok"), image, now).limit, 4000);
});

test("checks: media, titles, YouTube characters, boards, past times", () => {
  assert.match(checkDraft(base, ch("instagram"), null, now).errors[0], /image or video/);
  assert.ok(checkDraft({ ...base, title: "ok" }, ch("youtube"), image, now).errors.some((e) => /video/.test(e)));
  assert.ok(checkDraft(base, ch("youtube"), video, now).errors.some((e) => /title/i.test(e)));
  assert.ok(checkDraft({ ...base, text: "a <b>", title: "t" }, ch("youtube"), video, now).errors.some((e) => /"<" or ">"/.test(e)));
  assert.ok(checkDraft(base, ch("pinterest"), image, now).errors.some((e) => /board/.test(e)));
  assert.ok(
    checkDraft({ ...base, mode: "customScheduled", dueLocal: "2026-11-13T06:00" }, ch("twitter"), null, now).errors.some((e) => /passed/.test(e)),
  );
});
