import { countFor } from "./count";
import { countingNote, limitFor, platformFor, TITLE_LIMIT } from "./platforms";
import type { AdaptedDraft, Channel, Media } from "./types";

const OPENAI_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const TIMEOUT_MS = 45_000;

export class AiError extends Error {}

const SYSTEM_PROMPT = `You are Cascade's social media editor. The author writes ONE idea; you turn it into a native post for each of their channels.

Adapting means rewriting, not copying. For every channel, change the opening hook, structure, length, rhythm and formatting so it reads like it was written for that network by someone who posts there daily. Two channels must never receive the same text.

Stay true to the author:
- Keep their meaning, point of view and language. You may sharpen, reorder, condense, or expand on reasoning and implications already present in the idea.
- Never invent facts, numbers, results, quotes, names, offers, dates, or links.
- Keep the author's links exactly as written and don't add new ones. On Instagram, where links aren't clickable, keep the URL only if the post depends on it.
- No generic filler or stock calls-to-action ("What do you think?", "Follow for more", "Link in bio", "Let me know in the comments") unless the author asked for engagement. If a closing line is natural for the network, make it specific to this idea.
- Hashtags and emoji: never add any. Use only the hashtags and emoji the author wrote, exactly as written, and only where they fit the channel. If the author wrote none, the post has none.
- If media is attached, write so the text works alongside it; never describe what you can't see.

Format:
- Plain text only: no Markdown, no bold, no surrounding quotes.
- Respect each channel's character limit and counting rule; stay within the channel's target length.
- For channels with a title field, write a concise, specific title of at most ${TITLE_LIMIT} characters; otherwise return null for title.
- YouTube text and titles must not contain "<" or ">".
- Return exactly one draft per channel, using the given channelId.`;

interface ChannelBrief {
  channelId: string;
  network: string;
  account: string;
  limit: number;
  counting: string;
  style: string;
  targetLength: string;
  title: "required" | "optional" | "none";
}

function brief(channel: Channel, media: Media | null): ChannelBrief {
  const p = platformFor(channel.service);
  return {
    channelId: channel.id,
    network: p.label,
    account: channel.displayName || channel.name,
    limit: limitFor(channel, media?.kind ?? null),
    counting: countingNote(channel.service),
    style: p.style,
    targetLength: p.targetLength,
    title: p.title ?? "none",
  };
}

const SCHEMA = {
  name: "cascade_drafts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["channelId", "text", "title"],
          properties: {
            channelId: { type: "string" },
            text: { type: "string" },
            title: { type: ["string", "null"] },
          },
        },
      },
    },
  },
};

async function complete(messages: { role: "system" | "user"; content: string }[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("OPENAI_API_KEY is not set");
    throw new AiError("Writing posts isn't available right now. You can write them yourself instead.");
  }
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_schema", json_schema: SCHEMA } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("OpenAI request failed", e);
    throw new AiError("That took too long. Please try again.");
  }
  const json = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    console.error("OpenAI error", res.status, json.error?.message);
    throw new AiError(res.status === 429 ? "Lots of people are writing posts right now. Please try again in a moment." : "We couldn't write your posts this time. Please try again.");
  }
  const msg = json.choices?.[0]?.message;
  if (msg?.refusal) throw new AiError("We couldn't write posts for this idea. Try rephrasing it.");
  try {
    return (JSON.parse(msg?.content ?? "") as { drafts: { channelId: string; text: string; title: string | null }[] }).drafts;
  } catch {
    throw new AiError("We couldn't write your posts this time. Please try again.");
  }
}

function userPrompt(idea: string, title: string | undefined, media: Media | null, briefs: ChannelBrief[]) {
  return JSON.stringify(
    {
      idea,
      ideaTitle: title || null,
      media: media ? { kind: media.kind } : null,
      channels: briefs,
    },
    null,
    2,
  );
}

/** Adapts one idea for each channel. Validates every draft against Buffer's counting rules. */
export async function adaptIdea(args: {
  idea: string;
  title?: string;
  media: Media | null;
  channels: Channel[];
}): Promise<AdaptedDraft[]> {
  const { idea, title, media, channels } = args;
  const briefs = channels.map((c) => brief(c, media));
  const raw = await complete([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(idea, title, media, briefs) },
  ]);

  const byId = new Map(raw.map((d) => [d.channelId, { ...d, text: keepAuthorsTagsAndEmoji(d.text ?? "", idea) }]));
  const results: AdaptedDraft[] = channels.map((c) => {
    const d = byId.get(c.id);
    return { channelId: c.id, text: (d?.text ?? "").trim(), title: d?.title?.trim() || null };
  });

  // One targeted retry for anything empty, over its limit, or missing the author's links.
  const authorLinks = idea.match(/https?:\/\/[^\s]+/g) ?? [];
  const problem = (d: AdaptedDraft): string | null => {
    const c = channels.find((x) => x.id === d.channelId)!;
    const limit = limitFor(c, media?.kind ?? null);
    if (!d.text) return "the draft was empty";
    const count = countFor(c.service, d.text);
    if (count > limit) return `your draft was ${count} characters; the limit is ${limit}. Make it shorter`;
    const missing = c.service === "instagram" ? [] : authorLinks.filter((l) => !d.text.includes(l));
    if (missing.length) return `it dropped the author's link(s): ${missing.join(" ")}. Include them exactly`;
    return null;
  };
  const needsFix = (d: AdaptedDraft) => problem(d) !== null;
  const broken = results.filter(needsFix);
  if (broken.length) {
    const fixBriefs = briefs.filter((b) => broken.some((d) => d.channelId === b.channelId));
    const notes = broken.map((d) => `${d.channelId}: ${problem(d)}.`).join("\n");
    const fixed = await complete([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(idea, title, media, fixBriefs) },
      { role: "user", content: `Rewrite only these drafts and fix the problem noted for each:\n${notes}` },
    ]).catch(() => [] as typeof raw);
    for (const f of fixed) {
      const i = results.findIndex((r) => r.channelId === f.channelId);
      const text = keepAuthorsTagsAndEmoji(f.text ?? "", idea);
      if (i >= 0 && text) results[i] = { channelId: f.channelId, text, title: f.title?.trim() || results[i].title };
    }
  }

  return results.map((d) => {
    const c = channels.find((x) => x.id === d.channelId)!;
    return { ...d, overLimit: !d.text || countFor(c.service, d.text) > limitFor(c, media?.kind ?? null) || undefined };
  });
}

const HASHTAG_RE = /(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]+)/gu;
const EMOJI_RE = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic})|\p{Emoji_Modifier}|\p{Regional_Indicator}|\uFE0F)*/gu;

/**
 * Removes any hashtag or emoji the author didn't write. Cascade adapts the author's words; it
 * doesn't decorate them.
 */
export function keepAuthorsTagsAndEmoji(text: string, idea: string): string {
  const allowedTags = new Set([...idea.matchAll(HASHTAG_RE)].map((m) => m[2].toLowerCase()));
  const allowedEmoji = new Set(idea.match(EMOJI_RE) ?? []);
  const out = text
    .replace(HASHTAG_RE, (m, lead: string, tag: string) => (allowedTags.has(tag.toLowerCase()) ? m : lead))
    .replace(EMOJI_RE, (e) => (allowedEmoji.has(e) ? e : ""))
    // tidy what removal leaves behind
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,!?;:])/g, "$1").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
