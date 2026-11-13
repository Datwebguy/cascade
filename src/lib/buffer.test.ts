import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyMutationMessage, normalizeChannel, parseRateLimit } from "./buffer";

test("parseRateLimit finds the lowest remaining window", () => {
  const rl = parseRateLimit(
    '"100-in-15min"; r=98; t=897, "500-in-1day"; r=40; t=86397, "15000-in-30days"; r=14000; t=696980',
    '"100-in-15min"; q=100; w=900; pk=:x:, "500-in-1day"; q=500; w=86400; pk=:x:, "15000-in-30days"; q=15000; w=2592000; pk=:x:',
  );
  assert.equal(rl?.lowestRemainingRatio, 0.08);
  assert.equal(rl?.low, true);
  assert.equal(parseRateLimit(null, null), null);
});

test("normalizeChannel lifts metadata fields", () => {
  const c = normalizeChannel({
    id: "1", name: "n", displayName: null, service: "mastodon", avatar: "", isDisconnected: false, isLocked: false,
    isQueuePaused: false, timezone: "UTC", metadata: { maxCharacters: 1000 },
  });
  assert.equal(c.mastodonMaxCharacters, 1000);
  assert.equal("metadata" in c, false);
});

test("friendly mutation messages", () => {
  assert.match(friendlyMutationMessage("InvalidInputError", "Failed to create post: Failed to fetch image dimensions: Not Found"), /couldn't download the media/);
  assert.equal(friendlyMutationMessage("InvalidInputError", "LinkedIn posts cannot exceed 3000 characters."), "LinkedIn posts cannot exceed 3000 characters.");
  assert.match(friendlyMutationMessage("NotFoundError", "Channel not found"), /Refresh your channels/);
});
