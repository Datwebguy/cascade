import type { Service } from "./types";

/**
 * Character counting per Buffer's Character Limits guide
 * (developers.buffer.com/guides/character-limits.html).
 */

const URL_RE = /https?:\/\/[^\s]+/g;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** X weights code points outside these ranges as 2 (twitter-text v3 config). */
const X_LIGHT_RANGES: [number, number][] = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

function xWeight(text: string): number {
  let total = 0;
  for (const g of graphemes(text)) {
    if (PICTOGRAPHIC.test(g)) {
      total += 2; // an emoji (even a ZWJ sequence) counts as 2
      continue;
    }
    for (const ch of g) {
      const cp = ch.codePointAt(0)!;
      total += X_LIGHT_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
    }
  }
  return total;
}

function withUrlsAs(text: string, urlWeight: (url: string) => number, rest: (t: string) => number) {
  const urls = text.match(URL_RE) ?? [];
  return urls.reduce((n, u) => n + urlWeight(u), 0) + rest(text.replace(URL_RE, ""));
}

const utf16 = (t: string) => t.length;

function blueskyUrl(url: string): number {
  // "URLs count as the host plus up to 16 more characters."
  const noScheme = url.replace(/^https?:\/\//, "");
  const slash = noScheme.indexOf("/");
  const host = slash === -1 ? noScheme : noScheme.slice(0, slash);
  const rest = slash === -1 ? "" : noScheme.slice(slash);
  return graphemes(host).length + Math.min(16, graphemes(rest).length);
}

export function countFor(service: Service, text: string): number {
  switch (service) {
    case "twitter":
      return withUrlsAs(text, () => 23, xWeight);
    case "linkedin":
      return withUrlsAs(text, () => 24, utf16);
    case "instagram":
      // Every line break counts as 2.
      return text.length + (text.match(/\n/g)?.length ?? 0);
    case "mastodon":
      // URLs count as 23; the server part of @user@server is not counted.
      return withUrlsAs(text, () => 23, (t) => t.replace(/(@[\w.]+)@[\w.-]+\.\w+/g, "$1").length);
    case "bluesky":
      return withUrlsAs(text, blueskyUrl, (t) => graphemes(t).length);
    default:
      return utf16(text);
  }
}
