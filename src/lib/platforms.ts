import type { Service } from "./types";

export type Style = "short" | "professional" | "caption" | "default";

export interface PlatformProfile {
  label: string;
  style: Style;
  limit: number;
  maxHashtags: number;
  /** Media is mandatory for the post to publish. */
  requiresMedia?: "any" | "video";
}

export const PLATFORMS: Record<Service, PlatformProfile> = {
  twitter: { label: "X", style: "short", limit: 280, maxHashtags: 2 },
  threads: { label: "Threads", style: "short", limit: 500, maxHashtags: 1 },
  bluesky: { label: "Bluesky", style: "short", limit: 300, maxHashtags: 2 },
  mastodon: { label: "Mastodon", style: "short", limit: 500, maxHashtags: 3 },
  linkedin: { label: "LinkedIn", style: "professional", limit: 3000, maxHashtags: 4 },
  instagram: { label: "Instagram", style: "caption", limit: 2200, maxHashtags: 8, requiresMedia: "any" },
  facebook: { label: "Facebook", style: "caption", limit: 5000, maxHashtags: 2 },
  tiktok: { label: "TikTok", style: "caption", limit: 2200, maxHashtags: 5, requiresMedia: "video" },
  youtube: { label: "YouTube", style: "default", limit: 5000, maxHashtags: 3, requiresMedia: "video" },
  pinterest: { label: "Pinterest", style: "default", limit: 500, maxHashtags: 3, requiresMedia: "any" },
  googlebusiness: { label: "Google Business", style: "default", limit: 1500, maxHashtags: 0 },
  substack: { label: "Substack", style: "professional", limit: 5000, maxHashtags: 0 },
  startPage: { label: "Start Page", style: "default", limit: 5000, maxHashtags: 0 },
  whatsapp: { label: "WhatsApp", style: "short", limit: 1000, maxHashtags: 0 },
};

export function profileFor(service: Service): PlatformProfile {
  return PLATFORMS[service] ?? { label: service, style: "default", limit: 2000, maxHashtags: 2 };
}
