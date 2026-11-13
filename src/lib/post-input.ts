import { profileFor } from "./platforms";
import type { Draft, Media, Service } from "./types";

/** Builds a CreatePostInput for exactly one channel. */
export function buildPostInput(args: {
  draft: Draft;
  service: Service;
  media: Media | null;
  ideaId: string | null;
}) {
  const { draft, service, media, ideaId } = args;
  const attach = draft.includeMedia && media ? media : null;
  const assets = attach
    ? [attach.kind === "video" ? { video: { url: attach.url } } : { image: { url: attach.url } }]
    : [];

  const input: Record<string, unknown> = {
    channelId: draft.channelId,
    text: draft.text,
    assets,
    schedulingType: "automatic",
    // Buffer has no "draft" ShareMode: drafts are addToQueue + saveToDraft.
    mode: draft.mode === "saveToDraft" ? "addToQueue" : draft.mode,
    needsApproval: false,
    source: "cascade",
  };
  if (draft.mode === "saveToDraft") input.saveToDraft = true;
  if (draft.mode === "customScheduled") {
    if (!draft.dueAt) throw new Error("A date and time is required for custom scheduling.");
    input.dueAt = new Date(draft.dueAt).toISOString();
  }
  if (ideaId) input.ideaId = ideaId;

  const metadata = serviceMetadata(service, draft.text, attach);
  if (metadata) input.metadata = metadata;
  return input;
}

function serviceMetadata(service: Service, text: string, media: Media | null) {
  const title = text.split("\n")[0].slice(0, 100);
  switch (service) {
    case "instagram":
      return { instagram: { type: media?.kind === "video" ? "reel" : "post", shouldShareToFeed: true } };
    case "facebook":
      return { facebook: { type: "post" } };
    case "youtube":
      return { youtube: { title, privacy: "public" } };
    case "tiktok":
      return { tiktok: { title } };
    case "googlebusiness":
      return { google: { type: "whats_new" } };
    default:
      return null;
  }
}

/** Client-side validation so obvious failures never reach Buffer. */
export function draftWarnings(draft: Draft, service: Service, media: Media | null): string[] {
  const p = profileFor(service);
  const out: string[] = [];
  if (!draft.text.trim()) out.push("Post text is empty.");
  if (draft.text.length > p.limit) out.push(`${draft.text.length}/${p.limit} characters — over the ${p.label} limit.`);
  const attached = draft.includeMedia ? media : null;
  if (p.requiresMedia === "any" && !attached) out.push(`${p.label} requires an image or video.`);
  if (p.requiresMedia === "video" && attached?.kind !== "video") out.push(`${p.label} requires a video.`);
  if (draft.mode === "customScheduled") {
    if (!draft.dueAt) out.push("Pick a date and time.");
    else if (new Date(draft.dueAt).getTime() < Date.now()) out.push("Scheduled time is in the past.");
  }
  return out;
}
