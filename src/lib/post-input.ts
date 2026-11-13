import { countFor } from "./count";
import { limitFor, platformFor, TITLE_LIMIT } from "./platforms";
import { zonedLocalToUtcIso } from "./schedule";
import type { Channel, Draft, Media } from "./types";

/** Builds a CreatePostInput for exactly one channel (one createPost call per channel). */
export function buildPostInput(args: { draft: Draft; channel: Channel; media: Media | null; ideaId: string | null }) {
  const { draft, channel, media, ideaId } = args;
  const attach = draft.includeMedia && media ? media : null;

  const input: Record<string, unknown> = {
    channelId: channel.id,
    text: draft.text,
    schedulingType: "automatic",
    // Buffer has no "draft" mode: drafts are addToQueue + saveToDraft.
    mode: draft.mode === "saveToDraft" ? "addToQueue" : draft.mode,
  };
  if (attach) input.assets = [attach.kind === "video" ? { video: { url: attach.url } } : { image: { url: attach.url } }];
  if (draft.mode === "saveToDraft") input.saveToDraft = true;
  if (draft.mode === "customScheduled") {
    if (!draft.dueLocal) throw new Error("A date and time is required for custom scheduling.");
    input.dueAt = zonedLocalToUtcIso(draft.dueLocal, channel.timezone);
  }
  if (ideaId) input.ideaId = ideaId;

  const metadata = serviceMetadata(draft, channel, attach);
  if (metadata) input.metadata = metadata;
  return input;
}

function serviceMetadata(draft: Draft, channel: Channel, media: Media | null) {
  const o = draft.options;
  switch (channel.service) {
    case "instagram":
      // type and shouldShareToFeed are required by InstagramPostMetadataInput.
      return {
        instagram: {
          type: o.instagramType ?? (media?.kind === "video" ? "reel" : "post"),
          shouldShareToFeed: true,
        },
      };
    case "facebook":
      // type is required by FacebookPostMetadataInput.
      return { facebook: { type: o.facebookType ?? "post" } };
    case "youtube":
      return { youtube: { title: draft.title?.trim(), ...(o.youtubePrivacy ? { privacy: o.youtubePrivacy } : {}) } };
    case "pinterest":
      return {
        pinterest: {
          boardServiceId: o.pinterestBoardId,
          ...(draft.title?.trim() ? { title: draft.title.trim() } : {}),
        },
      };
    case "googlebusiness":
      // type is required; event/offer need extra details Cascade doesn't collect, so it posts an update.
      return { google: { type: "whats_new" } };
    default:
      return null;
  }
}

export interface DraftCheck {
  count: number;
  limit: number;
  /** Problems that will make Buffer reject the post. */
  errors: string[];
}

/** Validates a draft against Buffer's documented rules before sending. */
export function checkDraft(draft: Draft, channel: Channel, media: Media | null, now = new Date()): DraftCheck {
  const p = platformFor(channel.service);
  const attached = draft.includeMedia ? media : null;
  const limit = limitFor(channel, attached?.kind ?? null);
  const count = countFor(channel.service, draft.text);
  const errors: string[] = [];

  if (!draft.text.trim()) errors.push("Write something for this post.");
  if (count > limit) errors.push(`Too long for ${p.label}. Trim ${(count - limit).toLocaleString()} characters.`);
  if (p.requiresMedia === "any" && !attached) errors.push(`${p.label} needs an image or video.`);
  if (p.requiresMedia === "video" && attached?.kind !== "video") errors.push(`${p.label} needs a video.`);
  if (p.requiresMedia === "image" && attached?.kind !== "image") errors.push(`${p.label} needs an image.`);
  if (p.title === "required" && !draft.title?.trim()) errors.push(`${p.label} needs a title.`);
  if (draft.title && draft.title.length > TITLE_LIMIT) errors.push(`Keep the title under ${TITLE_LIMIT} characters.`);
  if (channel.service === "youtube" && /[<>]/.test(draft.text + (draft.title ?? ""))) {
    errors.push('YouTube doesn\'t allow "<" or ">" in titles or descriptions.');
  }
  if (channel.service === "pinterest" && !draft.options.pinterestBoardId) errors.push("Choose a board for this pin.");
  if (draft.mode === "customScheduled") {
    if (!draft.dueLocal) errors.push("Pick a date and time.");
    else {
      try {
        if (new Date(zonedLocalToUtcIso(draft.dueLocal, channel.timezone)).getTime() <= now.getTime()) {
          errors.push("That time has already passed. Pick a time in the future.");
        }
      } catch {
        errors.push("Pick a valid date and time.");
      }
    }
  }
  return { count, limit, errors };
}
