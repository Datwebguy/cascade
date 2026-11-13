import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptIdea, AiError } from "./ai";
import type { Channel } from "./types";

const ch = (id: string, service: Channel["service"]): Channel => ({
  id, name: id, displayName: null, service, avatar: "", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "UTC",
});

function mockOpenAI(responses: object[]) {
  const calls: { messages: { content: string }[] }[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    const drafts = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ drafts }) } }] }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

test("over-limit and missing-link drafts get one targeted rewrite", async () => {
  process.env.OPENAI_API_KEY = "test";
  const idea = "Ship daily. https://example.com/x";
  const calls = mockOpenAI([
    [
      { channelId: "x", text: "y".repeat(400), title: null },
      { channelId: "li", text: "A LinkedIn post without the link.", title: null },
    ],
    [
      { channelId: "x", text: "Ship daily. https://example.com/x", title: null },
      { channelId: "li", text: "A LinkedIn post. https://example.com/x", title: null },
    ],
  ]);
  const out = await adaptIdea({ idea, media: null, channels: [ch("x", "twitter"), ch("li", "linkedin")] });
  assert.equal(calls.length, 2);
  assert.match(calls[1].messages.at(-1)!.content, /x: your draft was 400 characters; the limit is 280/);
  assert.match(calls[1].messages.at(-1)!.content, /li: it dropped the author's link/);
  assert.equal(out[0].text, "Ship daily. https://example.com/x");
  assert.equal(out[0].overLimit, undefined);
});

test("still over the limit after the retry is flagged, not silently cut", async () => {
  process.env.OPENAI_API_KEY = "test";
  mockOpenAI([[{ channelId: "x", text: "y".repeat(400), title: null }]]);
  const [d] = await adaptIdea({ idea: "Idea.", media: null, channels: [ch("x", "twitter")] });
  assert.equal(d.text.length, 400);
  assert.equal(d.overLimit, true);
});

test("missing API key is a clear error", async () => {
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(adaptIdea({ idea: "Idea.", media: null, channels: [ch("x", "twitter")] }), AiError);
});
