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

export interface PinterestBoard {
  serviceId: string;
  name: string;
}

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
  /** From MastodonMetadata.maxCharacters. */
  mastodonMaxCharacters?: number;
  /** From TwitterMetadata.subscriptionType. */
  xSubscriptionType?: string | null;
  /** From PinterestMetadata.boards. */
  pinterestBoards?: PinterestBoard[];
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
  /** Centre-cropped copy for Instagram when the original is outside 4:5 to 1.91:1. */
  instagramUrl?: string;
}

export type SchedulingMode = "addToQueue" | "customScheduled" | "saveToDraft";

export type FeedPostType = "post" | "reel" | "story";
export type YoutubePrivacy = "public" | "unlisted" | "private";

export interface DraftOptions {
  instagramType?: FeedPostType;
  facebookType?: FeedPostType;
  pinterestBoardId?: string;
  youtubePrivacy?: YoutubePrivacy;
}

export interface Draft {
  channelId: string;
  text: string;
  /** YouTube / Pinterest title. */
  title?: string;
  includeMedia: boolean;
  mode: SchedulingMode;
  /** customScheduled only: "YYYY-MM-DDTHH:mm" in the channel's timezone. */
  dueLocal?: string;
  options: DraftOptions;
}

export interface AdaptRequest {
  organizationId: string;
  idea: string;
  title?: string;
  media: Media | null;
  channelIds: string[];
}

export interface AdaptedDraft {
  channelId: string;
  text: string;
  title: string | null;
  /** Set when the AI could not fit the limit even after a retry. */
  overLimit?: boolean;
}

export interface PublishRequest {
  organizationId: string;
  idea: { title?: string; text: string; existingIdeaId?: string };
  media: Media | null;
  drafts: Draft[];
}

export type PostOutcome = "created" | "failed" | "unknown";

export interface PostResult {
  channelId: string;
  outcome: PostOutcome;
  postId?: string;
  status?: string;
  dueAt?: string | null;
  /** User-facing message. */
  message?: string;
}

export interface PublishResponse {
  ideaId: string | null;
  ideaMessage?: string;
  posts: PostResult[];
}

export interface ApiError {
  error: string;
  code?: string;
  retryAfter?: number;
}
