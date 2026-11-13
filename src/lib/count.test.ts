import { test } from "node:test";
import assert from "node:assert/strict";
import { countFor } from "./count";

test("default networks count UTF-16 code units (emoji = 2)", () => {
  assert.equal(countFor("facebook", "Hello"), 5);
  assert.equal(countFor("facebook", "🚀"), 2);
  assert.equal(countFor("threads", "𝗛𝗲𝗹𝗹𝗼"), 10);
});

test("X: URLs are 23, emoji 2, ZWJ family 2", () => {
  assert.equal(countFor("twitter", "Read https://example.com/a/very/long/path/that/goes/on"), 5 + 23);
  assert.equal(countFor("twitter", "🚀"), 2);
  assert.equal(countFor("twitter", "👨‍👩‍👧"), 2);
  assert.equal(countFor("twitter", "café"), 4);
});

test("LinkedIn: every URL is 24", () => {
  assert.equal(countFor("linkedin", "x https://a.co"), 2 + 24);
});

test("Instagram: line breaks count 2", () => {
  assert.equal(countFor("instagram", "a\nb"), 4);
});

test("Bluesky: graphemes, URL = host + up to 16", () => {
  assert.equal(countFor("bluesky", "👨‍👩‍👧"), 1);
  assert.equal(countFor("bluesky", "https://example.com/abcdefghijklmnopqrstuvwxyz"), "example.com".length + 16);
  assert.equal(countFor("bluesky", "https://example.com/ab"), "example.com".length + 3);
});

test("Mastodon: URLs 23, mention server part not counted", () => {
  assert.equal(countFor("mastodon", "hi @alice@mastodon.social"), "hi @alice".length);
  assert.equal(countFor("mastodon", "https://example.com/long/long/long/path"), 23);
});
