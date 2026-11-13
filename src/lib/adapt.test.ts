import { test } from "node:test";
import assert from "node:assert/strict";
import { adapt, guessMediaKind, parseIdea } from "./adapt";
import { PLATFORMS } from "./platforms";
import type { Service } from "./types";

const IDEA =
  "Most teams overthink their content calendar. The best-performing posts we shipped this year " +
  "came from a single honest observation, written fast. Consistency beats polish when you post daily. " +
  "Start with one idea, then adapt it for each channel. Here is how we do it: https://example.com/guide " +
  "#contentstrategy #socialmedia #buildinpublic";

test("parseIdea pulls out links, hashtags and sentences", () => {
  const p = parseIdea(IDEA);
  assert.deepEqual(p.links, ["https://example.com/guide"]);
  assert.deepEqual(p.hashtags, ["contentstrategy", "socialmedia", "buildinpublic"]);
  assert.equal(p.sentences[0], "Most teams overthink their content calendar.");
});

test("every platform's draft fits its character limit", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} adds detail.`).join(" ");
  for (const service of Object.keys(PLATFORMS) as Service[]) {
    for (const idea of [IDEA, long]) {
      const out = adapt(idea, service);
      assert.ok(out.length > 0, `${service} empty`);
      assert.ok(out.length <= PLATFORMS[service].limit, `${service} ${out.length} > ${PLATFORMS[service].limit}`);
    }
  }
});

test("short platforms are shorter than LinkedIn", () => {
  assert.ok(adapt(IDEA, "twitter").length < adapt(IDEA, "linkedin").length);
});

test("LinkedIn is professional with a closing question and paragraphs", () => {
  const out = adapt(IDEA, "linkedin");
  assert.match(out, /What's your take\?/);
  assert.ok(out.split("\n\n").length >= 4);
});

test("Instagram caption uses link in bio and a CTA", () => {
  const out = adapt(IDEA, "instagram");
  assert.match(out, /Link in bio\./);
  assert.doesNotMatch(out, /https:\/\//);
  assert.match(out, /#contentstrategy/);
});

test("hashtag counts respect platform caps", () => {
  const count = (s: string) => (s.match(/#\w+/g) ?? []).length;
  assert.ok(count(adapt(IDEA, "threads")) <= 1);
  assert.equal(count(adapt(IDEA, "googlebusiness")), 0);
});

test("a single overlong sentence is truncated with an ellipsis", () => {
  const out = adapt("word ".repeat(200).trim(), "twitter");
  assert.ok(out.length <= 280);
  assert.ok(out.endsWith("…"));
});

test("guessMediaKind", () => {
  assert.equal(guessMediaKind("https://x.com/a.mp4"), "video");
  assert.equal(guessMediaKind("https://x.com/a.MOV?x=1"), "video");
  assert.equal(guessMediaKind("https://x.com/a.jpg"), "image");
});

test("a sentence that introduced a link ends cleanly", () => {
  const out = adapt("Here is how we do it: https://example.com", "linkedin");
  assert.match(out, /^Here is how we do it\.\n/);
});
