// Shared between client and server.

export type Service =
  | "bluesky"
  | "facebook"
  | "googlebusiness"
  | "instagram"
  | "linkedin"
  | "mastodon"
  | "pinterest"
  | "startPage"
  | "substack"
  | "threads"
  | "tiktok"
  | "twitter"
  | "whatsapp"
  | "youtube";

export interface Channel {
  id: string;
  name: string;
  displayName: string | null;
  service: Service;
  avatar: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
  timezone: string;
}

export interface Organization {
  id: string;
  name: string;
  channels: Channel[];
}

export interface IdeaSummary {
  id: string;
  title: string | null;
  text: string | null;
  mediaUrl: string | null;
}

export type MediaKind = "image" | "video";

export interface Media {
  url: string;
  kind: MediaKind;
}

export type SchedulingMode = "addToQueue" | "customScheduled" | "saveToDraft";

export interface Draft {
  channelId: string;
  text: string;
  /** Whether to attach the shared media to this post. */
  includeMedia: boolean;
  mode: SchedulingMode;
  /** ISO string; required when mode is customScheduled. */
  dueAt?: string;
}

export interface PublishRequest {
  organizationId: string;
  idea: { title?: string; text: string; existingIdeaId?: string };
  media: Media | null;
  drafts: Draft[];
}

export interface PostResult {
  channelId: string;
  ok: boolean;
  postId?: string;
  status?: string;
  dueAt?: string | null;
  error?: string;
}

export interface PublishResponse {
  ideaId: string | null;
  ideaError?: string;
  posts: PostResult[];
}
