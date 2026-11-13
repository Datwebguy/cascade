import type { Channel, MediaKind, Service } from "./types";

/**
 * Platform rules. Limits are from Buffer's Character Limits guide; per-channel values
 * (Mastodon server limit, X subscription) come from the channel's metadata at runtime.
 */

export interface PlatformInfo {
  label: string;
  /** Can Cascade create posts for this service through the API? */
  supported: boolean;
  /** Short editorial guidance passed to the AI. */
  style: string;
  /** Target length guidance for the AI (always within the hard limit). */
  targetLength: string;
  /** Media the network itself requires for a post. */
  requiresMedia?: "any" | "video" | "image";
  /** Network has a separate title field (limit 100). */
  title?: "required" | "optional";
}

export const PLATFORMS: Record<Service, PlatformInfo> = {
  twitter: { label: "X", supported: true, targetLength: "Under 240 characters: one or two punchy lines.", style: "Short and conversational. Lead with the sharpest point." },
  threads: { label: "Threads", supported: true, targetLength: "150–350 characters.", style: "Conversational, casual, like talking to followers." },
  bluesky: { label: "Bluesky", supported: true, targetLength: "Under 260 characters.", style: "Short, conversational, genuine." },
  mastodon: { label: "Mastodon", supported: true, targetLength: "150–400 characters.", style: "Conversational and plain-spoken." },
  linkedin: { label: "LinkedIn", supported: true, targetLength: "800–1,500 characters: hook line, 3–5 short paragraphs, a concrete takeaway.", style: "Longer and professional. Strong first line, short paragraphs separated by blank lines, practical takeaway." },
  instagram: { label: "Instagram", supported: true, targetLength: "300–900 characters.", requiresMedia: "any", style: "Mid-length caption that complements the visual. Strong first line, line breaks for readability. Links are not clickable in captions." },
  facebook: { label: "Facebook", supported: true, targetLength: "200–600 characters.", style: "Mid-length, friendly caption-style post. Links are fine." },
  tiktok: { label: "TikTok", supported: true, targetLength: "Under 150 characters.", requiresMedia: "any", style: "Very short, punchy caption that supports the video." },
  youtube: { label: "YouTube", supported: true, targetLength: "400–1,200 character description; title under 70 characters.", requiresMedia: "video", title: "required", style: "Video description: a clear summary of what the viewer gets, then supporting detail. Title is concise and descriptive. Never use < or >." },
  pinterest: { label: "Pinterest", supported: true, targetLength: "150–400 characters; title under 70 characters.", requiresMedia: "image", title: "optional", style: "Short, keyword-rich description of what the pin offers. Title is descriptive." },
  googlebusiness: { label: "Google Business", supported: true, targetLength: "150–600 characters.", style: "Plain, informative business update for local customers." },
  substack: { label: "Substack", supported: true, targetLength: "300–1,500 characters.", style: "A thoughtful note in the author's voice; can be longer and reflective." },
  startPage: { label: "Start Page", supported: false, targetLength: "", style: "" },
  whatsapp: { label: "WhatsApp", supported: false, targetLength: "", style: "" },
};

export function platformFor(service: Service): PlatformInfo {
  return PLATFORMS[service] ?? { label: service, supported: false, style: "" };
}

/** Buffer's post text limit for a specific channel. */
export function limitFor(channel: Pick<Channel, "service" | "mastodonMaxCharacters" | "xSubscriptionType">, media: MediaKind | null): number {
  switch (channel.service) {
    case "facebook": return 5000;
    case "instagram": return 2196;
    case "twitter":
      // X Free: 280. Basic / Premium / Premium+: 25,000.
      return /basic|premium/i.test(channel.xSubscriptionType ?? "") ? 25000 : 280;
    case "linkedin": return 3000;
    case "pinterest": return 500;
    case "tiktok": return media === "video" ? 2200 : 4000;
    case "threads": return 500;
    case "bluesky": return 300;
    case "youtube": return 5000;
    case "googlebusiness": return 4000;
    case "mastodon": return Math.min(channel.mastodonMaxCharacters ?? 500, 20000);
    case "substack": return 10000;
    default: return 5000;
  }
}

/** How the network counts characters, so the AI can budget correctly. */
export function countingNote(service: Service): string {
  switch (service) {
    case "twitter": return "Links count as 23 characters; emoji count as 2.";
    case "linkedin": return "Every link counts as 24 characters.";
    case "instagram": return "Every line break counts as 2 characters.";
    case "mastodon": return "Links count as 23 characters.";
    case "bluesky": return "Links count as their domain plus up to 16 characters.";
    default: return "Emoji count as 2 characters.";
  }
}

export const TITLE_LIMIT = 100;
