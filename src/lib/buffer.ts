import type { Channel, IdeaSummary, Organization, PinterestBoard, Service } from "./types";

export const BUFFER_API = process.env.BUFFER_API_URL || "https://api.buffer.com";
const REQUEST_TIMEOUT_MS = 20_000;
/** Wait out short rate-limit resets; surface long ones (Buffer's guidance for serverless). */
const MAX_INLINE_RETRY_AFTER_S = 5;

// ---------- Errors ----------

export class BufferError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/** The request may or may not have reached Buffer (timeout / network / 5xx). */
export class BufferUncertainError extends Error {}

const FRIENDLY: Record<string, string> = {
  UNAUTHORIZED: "You've been signed out of Buffer. Please connect again.",
  FORBIDDEN: "Cascade doesn't have permission to do that. Sign out, connect again, and approve every permission.",
  NOT_FOUND: "That no longer exists in Buffer. Refresh your channels and try again.",
  UNEXPECTED: "Buffer had a hiccup. Please try again in a moment.",
  RATE_LIMIT_EXCEEDED: "Buffer needs a short break.",
};

export function friendlyMessage(e: unknown): string {
  if (e instanceof BufferError) {
    if (e.code === "RATE_LIMIT_EXCEEDED" && e.retryAfter) {
      const mins = Math.ceil(e.retryAfter / 60);
      return `${FRIENDLY.RATE_LIMIT_EXCEEDED} Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`;
    }
    return FRIENDLY[e.code] ?? e.message;
  }
  if (e instanceof BufferUncertainError) return "Buffer took too long to answer.";
  return "Something went wrong talking to Buffer. Please try again.";
}

// ---------- Rate limit headers ----------

export interface RateLimitStatus {
  /** Lowest remaining fraction across the 15-min / 24-h / 30-day windows. */
  lowestRemainingRatio: number;
  low: boolean;
}

/** Parses `RateLimit: "100-in-15min"; r=98; t=897, ...` with `RateLimit-Policy: ...; q=100; w=900`. */
export function parseRateLimit(rateLimit: string | null, policy: string | null): RateLimitStatus | null {
  if (!rateLimit || !policy) return null;
  const split = (h: string) => h.split(/,\s*(?=")/);
  const quotas = new Map<string, number>();
  for (const p of split(policy)) {
    const name = /"([^"]+)"/.exec(p)?.[1];
    const q = Number(/q=(\d+)/.exec(p)?.[1]);
    if (name && q) quotas.set(name, q);
  }
  let lowest = 1;
  for (const p of split(rateLimit)) {
    const name = /"([^"]+)"/.exec(p)?.[1];
    const r = Number(/r=(\d+)/.exec(p)?.[1]);
    const q = name ? quotas.get(name) : undefined;
    if (q && Number.isFinite(r)) lowest = Math.min(lowest, r / q);
  }
  return { lowestRemainingRatio: lowest, low: lowest < 0.1 };
}

let lastRateLimit: RateLimitStatus | null = null;
export const latestRateLimit = () => lastRateLimit;

// ---------- Transport ----------

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string; window?: string } }[];
}

/**
 * Executes one GraphQL operation with variables (never string interpolation).
 * Typed mutation errors come back inside `data` and are left to the caller.
 */
export async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  attempt = 1,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BUFFER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.error("Buffer request failed before a response", e);
    throw new BufferUncertainError("No response from Buffer.");
  }

  lastRateLimit = parseRateLimit(res.headers.get("ratelimit"), res.headers.get("ratelimit-policy")) ?? lastRateLimit;

  if (res.status === 429) {
    // A 429 is not executed and does not consume quota, so a retry is safe even for writes.
    const retryAfter = Number(res.headers.get("retry-after")) || 60;
    if (attempt === 1 && retryAfter <= MAX_INLINE_RETRY_AFTER_S) {
      await new Promise((r) => setTimeout(r, (retryAfter + Math.random()) * 1000));
      return gql<T>(token, query, variables, attempt + 1);
    }
    throw new BufferError("Rate limited", "RATE_LIMIT_EXCEEDED", retryAfter);
  }
  if (res.status === 401) throw new BufferError("Unauthorized", "UNAUTHORIZED");
  if (res.status >= 500) {
    console.error("Buffer server error", res.status);
    throw new BufferUncertainError(`Buffer returned ${res.status}.`);
  }

  const json = (await res.json().catch(() => ({}))) as GraphQLResponse<T>;
  if (json.errors?.length) {
    console.error("Buffer GraphQL errors", JSON.stringify(json.errors));
    const code = json.errors[0].extensions?.code ?? "UNEXPECTED";
    throw new BufferError(json.errors[0].message, code);
  }
  if (!json.data) throw new BufferError("Empty response", "UNEXPECTED");
  return json.data;
}

// ---------- Organizations & channels (one request per org, cached by the caller) ----------

const ORGANIZATIONS = /* GraphQL */ `
  query Organizations {
    account {
      organizations { id name }
    }
  }
`;

const CHANNELS = /* GraphQL */ `
  query Channels($input: ChannelsInput!) {
    channels(input: $input) {
      id
      name
      displayName
      service
      avatar
      isDisconnected
      isLocked
      isQueuePaused
      timezone
      metadata {
        ... on MastodonMetadata { maxCharacters }
        ... on TwitterMetadata { subscriptionType }
        ... on PinterestMetadata { boards { serviceId name } }
      }
    }
  }
`;

interface RawChannel extends Omit<Channel, "mastodonMaxCharacters" | "xSubscriptionType" | "pinterestBoards"> {
  metadata: { maxCharacters?: number; subscriptionType?: string | null; boards?: PinterestBoard[] } | null;
}

export function normalizeChannel(c: RawChannel): Channel {
  const { metadata, ...rest } = c;
  return {
    ...rest,
    service: rest.service as Service,
    mastodonMaxCharacters: metadata?.maxCharacters,
    xSubscriptionType: metadata?.subscriptionType ?? null,
    pinterestBoards: metadata?.boards,
  };
}

export async function fetchOrganizations(token: string): Promise<Organization[]> {
  const { account } = await gql<{ account: { organizations: { id: string; name: string }[] } }>(token, ORGANIZATIONS);
  const orgs: Organization[] = [];
  for (const org of account.organizations) {
    const { channels } = await gql<{ channels: RawChannel[] }>(token, CHANNELS, {
      input: { organizationId: org.id },
    });
    orgs.push({ ...org, channels: channels.map(normalizeChannel) });
  }
  return orgs;
}

// ---------- Ideas (paginated) ----------

const IDEAS = /* GraphQL */ `
  query Ideas($input: IdeasInput!, $first: Int, $after: String) {
    ideas(input: $input, first: $first, after: $after) {
      edges {
        node {
          id
          content {
            title
            text
            media { url type }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface IdeaNode {
  id: string;
  content: { title: string | null; text: string | null; media: { url: string; type: string }[] | null };
}

export async function fetchIdeas(
  token: string,
  organizationId: string,
  after?: string,
): Promise<{ ideas: IdeaSummary[]; nextCursor: string | null }> {
  const { ideas } = await gql<{
    ideas: { edges: { node: IdeaNode }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
  }>(token, IDEAS, { input: { organizationId }, first: 20, after: after ?? null });
  return {
    ideas: ideas.edges.map(({ node }) => ({
      id: node.id,
      title: node.content.title,
      text: node.content.text,
      mediaUrl: node.content.media?.find((m) => m.type === "image" || m.type === "video")?.url ?? null,
    })),
    nextCursor: ideas.pageInfo.hasNextPage ? ideas.pageInfo.endCursor : null,
  };
}

// ---------- Mutations: always select success types and the MutationError interface ----------

export const CREATE_IDEA = /* GraphQL */ `
  mutation CreateIdea($input: CreateIdeaInput!) {
    createIdea(input: $input) {
      __typename
      ... on Idea { id }
      ... on IdeaResponse { idea { id } }
      ... on MutationError { message }
    }
  }
`;

export type CreateIdeaResult =
  | { __typename: "Idea"; id: string }
  | { __typename: "IdeaResponse"; idea: { id: string } | null }
  | { __typename: string; message: string };

export function ideaIdFrom(result: CreateIdeaResult): string | null {
  if ("id" in result) return result.id;
  if ("idea" in result) return result.idea?.id ?? null;
  return null;
}

export const CREATE_POST = /* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post { id status dueAt }
      }
      ... on MutationError { message }
    }
  }
`;

export type CreatePostResult =
  | { __typename: "PostActionSuccess"; post: { id: string; status: string; dueAt: string | null } }
  | { __typename: string; message: string };

// ---------- Post lookup, used only when a createPost outcome is unknown ----------

const RECENT_POSTS = /* GraphQL */ `
  query RecentPosts($input: PostsInput!) {
    posts(first: 20, input: $input) {
      edges { node { id status dueAt ideaId text } }
    }
  }
`;

/**
 * createPost has no idempotency key. After a timeout, check whether the post landed before
 * telling the user it is safe to retry.
 */
export async function findCreatedPost(
  token: string,
  args: { organizationId: string; channelId: string; since: Date; ideaId: string | null; text: string },
): Promise<{ id: string; status: string; dueAt: string | null } | null> {
  const { posts } = await gql<{
    posts: { edges: { node: { id: string; status: string; dueAt: string | null; ideaId: string | null; text: string } }[] };
  }>(token, RECENT_POSTS, {
    input: {
      organizationId: args.organizationId,
      filter: { channelIds: [args.channelId], createdAt: { start: args.since.toISOString() } },
    },
  });
  const match = posts.edges
    .map((e) => e.node)
    .find((p) => (args.ideaId && p.ideaId === args.ideaId) || p.text === args.text);
  return match ? { id: match.id, status: match.status, dueAt: match.dueAt } : null;
}

/** Friendly wording for typed createPost/createIdea errors; the raw message is logged server-side. */
export function friendlyMutationMessage(typename: string, raw: string): string {
  if (/fetch (image|video)|media|dimensions/i.test(raw)) {
    return "Buffer couldn't open your image or video. Make sure the link is public and won't expire.";
  }
  if (/cannot exceed|too long|characters/i.test(raw)) return raw; // Buffer's limit messages are already clear
  if (/channel not found/i.test(raw) || typename === "NotFoundError") {
    return "We couldn't find this channel in Buffer. Refresh your channels and try again.";
  }
  if (typename === "LimitReachedError" || /limit/i.test(raw)) {
    return "This channel's Buffer queue is full. Free up a slot in Buffer or pick another time.";
  }
  if (typename === "UnauthorizedError") return "Buffer didn't allow posting to this channel.";
  return `Buffer couldn't accept this post: ${raw.replace(/^Failed to create post:\s*/i, "")}`;
}
