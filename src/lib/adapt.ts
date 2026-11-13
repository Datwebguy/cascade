import { profileFor } from "./platforms";
import type { Service } from "./types";

/**
 * Rule-based v1 adaptation. Deterministic and offline:
 *  - X / Threads / Bluesky / Mastodon: short, conversational
 *  - LinkedIn: longer, professional, spaced paragraphs, closing question
 *  - Instagram / Facebook / TikTok: mid-length caption with CTA
 *  - Everything else: cleaned-up idea within the platform limit
 */

const URL_RE = /https?:\/\/[^\s]+/g;
const TAG_RE = /(^|\s)#([\p{L}\p{N}_]+)/gu;

export interface ParsedIdea {
  sentences: string[];
  hashtags: string[];
  links: string[];
}

export function parseIdea(raw: string): ParsedIdea {
  const links = raw.match(URL_RE) ?? [];
  const hashtags: string[] = [];
  let text = raw.replace(URL_RE, " ");
  text = text.replace(TAG_RE, (_m, lead: string, tag: string) => {
    if (!hashtags.some((h) => h.toLowerCase() === tag.toLowerCase())) hashtags.push(tag);
    return lead;
  });
  text = text.replace(/\s+/g, " ").trim();
  const sentences = (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    // A trailing ":" or dash usually introduced a link we moved; end the sentence cleanly.
    .map((s) => s.replace(/\s*[:;,\u2013\u2014-]+$/, ""))
    .filter(Boolean)
    .map((s) => (/[.!?]["')\]]*$/.test(s) ? s : `${s}.`));
  return { sentences, hashtags, links };
}

function tagLine(tags: string[], max: number): string {
  return tags.slice(0, max).map((t) => `#${t}`).join(" ");
}

/** Joins as many sentences as fit within `budget`, hard-truncating only as a last resort. */
function fitSentences(sentences: string[], budget: number, sep = " "): string {
  let out = "";
  for (const s of sentences) {
    const next = out ? `${out}${sep}${s}` : s;
    if (next.length > budget) break;
    out = next;
  }
  if (!out && sentences[0]) {
    out = sentences[0].slice(0, Math.max(0, budget - 1)).trimEnd() + "…";
  }
  return out;
}

function assemble(parts: (string | undefined)[], sep: string): string {
  return parts.filter((p) => p && p.trim()).join(sep);
}

/** Lowercases a leading "I think"/"We believe" style opener for a more casual feel. */
function conversational(sentence: string): string {
  return sentence.replace(/^(In conclusion|Furthermore|Moreover|Additionally),\s*/i, "");
}

function short(p: ParsedIdea, limit: number, maxTags: number): string {
  const link = p.links[0];
  const tags = tagLine(p.hashtags, maxTags);
  const reserved = (link ? link.length + 1 : 0) + (tags ? tags.length + 2 : 0);
  const sentences = p.sentences.map(conversational);
  const body = fitSentences(sentences, limit - reserved);
  return assemble([assemble([body, link], " "), tags], "\n\n");
}

function professional(p: ParsedIdea, limit: number, maxTags: number): string {
  const [hook, ...rest] = p.sentences;
  const paragraphs: string[] = [];
  for (let i = 0; i < rest.length; i += 2) paragraphs.push(rest.slice(i, i + 2).join(" "));
  const closing = "What's your take? I'd love to hear how you approach this.";
  const link = p.links.length ? `Read more: ${p.links[0]}` : undefined;
  const tags = tagLine(p.hashtags, maxTags);
  const full = assemble([hook, ...paragraphs, link, closing, tags], "\n\n");
  if (full.length <= limit) return full;
  const reserved = [link, closing, tags].filter(Boolean).join("\n\n").length + 2;
  return assemble([fitSentences(p.sentences, limit - reserved, "\n\n"), link, closing, tags], "\n\n");
}

function caption(p: ParsedIdea, service: Service, limit: number, maxTags: number): string {
  const [hook, ...rest] = p.sentences;
  const body = rest.join(" ");
  const cta =
    service === "instagram"
      ? "Save this for later and share it with someone who needs it."
      : service === "tiktok"
        ? "Follow for more."
        : "What do you think? Let me know in the comments.";
  // Instagram captions don't make links clickable, so point people to the bio instead.
  const link =
    p.links.length && service === "instagram" ? "Link in bio." : p.links[0] ?? undefined;
  const tags = tagLine(p.hashtags, maxTags);
  const full = assemble([hook, body, link, cta, tags], "\n\n");
  if (full.length <= limit) return full;
  const reserved = [link, cta, tags].filter(Boolean).join("\n\n").length + 2;
  return assemble([fitSentences(p.sentences, limit - reserved), link, cta, tags], "\n\n");
}

function plain(p: ParsedIdea, limit: number, maxTags: number): string {
  const link = p.links[0];
  const tags = tagLine(p.hashtags, maxTags);
  const reserved = (link ? link.length + 2 : 0) + (tags ? tags.length + 2 : 0);
  return assemble([fitSentences(p.sentences, limit - reserved), link, tags], "\n\n");
}

export function adapt(idea: string, service: Service): string {
  const parsed = parseIdea(idea);
  if (!parsed.sentences.length) return idea.trim();
  const { style, limit, maxHashtags } = profileFor(service);
  switch (style) {
    case "short":
      return short(parsed, limit, maxHashtags);
    case "professional":
      return professional(parsed, limit, maxHashtags);
    case "caption":
      return caption(parsed, service, limit, maxHashtags);
    default:
      return plain(parsed, limit, maxHashtags);
  }
}

export function guessMediaKind(url: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|#|$)/i.test(url) ? "video" : "image";
}
