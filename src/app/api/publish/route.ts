import type { NextRequest } from "next/server";
import {
  BufferError,
  BufferUncertainError,
  CREATE_IDEA,
  CREATE_POST,
  findCreatedPost,
  friendlyMessage,
  friendlyMutationMessage,
  gql,
  ideaIdFrom,
  type CreateIdeaResult,
  type CreatePostResult,
} from "@/lib/buffer";
import { checkMediaUrl } from "@/lib/media";
import { platformFor } from "@/lib/platforms";
import { buildPostInput, checkDraft } from "@/lib/post-input";
import type { PostResult, PublishRequest, PublishResponse } from "@/lib/types";
import { organizations, RouteError, withSession, type Ctx } from "../handler";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PublishRequest | null;
  return withSession((ctx) => publish(ctx, body));
}

async function publish(ctx: Ctx, body: PublishRequest | null): Promise<PublishResponse> {
  if (!body?.organizationId || !body.idea?.text?.trim() || !body.drafts?.length) {
    throw new RouteError("Idea text and at least one channel are required.");
  }
  const org = (await organizations(ctx)).find((o) => o.id === body.organizationId);
  if (!org) throw new RouteError("Unknown organization.");

  if (body.media) {
    const check = await checkMediaUrl(body.media.url);
    if (!check.ok) throw new RouteError(check.message ?? "The media URL can't be used.");
    body.media.kind = check.kind!;
  }

  // Validate everything first so obviously invalid posts never spend API quota.
  const prepared = body.drafts.map((draft) => {
    const channel = org.channels.find((c) => c.id === draft.channelId);
    if (!channel || !platformFor(channel.service).supported) return { draft, channel: null, errors: ["Channel not available."] };
    return { draft, channel, errors: checkDraft(draft, channel, body.media).errors };
  });
  const invalid = prepared.filter((p) => p.errors.length);
  if (invalid.length) {
    throw new RouteError(`Fix ${invalid.length} draft${invalid.length === 1 ? "" : "s"} before sending.`);
  }

  // 1. Save the original idea (or reuse the saved Idea the user started from).
  let ideaId: string | null = body.idea.existingIdeaId ?? null;
  let ideaMessage: string | undefined;
  if (!ideaId) {
    try {
      const { createIdea } = await gql<{ createIdea: CreateIdeaResult }>(ctx.token, CREATE_IDEA, {
        input: {
          organizationId: org.id,
          content: {
            ...(body.idea.title?.trim() ? { title: body.idea.title.trim() } : {}),
            text: body.idea.text,
            ...(body.media ? { media: [{ url: body.media.url, type: body.media.kind }] } : {}),
          },
        },
      });
      ideaId = ideaIdFrom(createIdea);
      if (!ideaId) {
        console.error("createIdea typed error", createIdea);
        ideaMessage = "message" in createIdea ? friendlyMutationMessage(createIdea.__typename, createIdea.message) : "The idea wasn't saved.";
      }
    } catch (e) {
      if (e instanceof BufferError && (e.code === "UNAUTHORIZED" || e.code === "RATE_LIMIT_EXCEEDED")) throw e;
      console.error("createIdea failed", e);
      ideaMessage = "The idea couldn't be saved to Buffer Ideas.";
    }
  }

  // 2. One createPost per channel, each linked to the idea.
  const posts: PostResult[] = [];
  let stopReason: string | null = null;
  for (const { draft, channel } of prepared) {
    if (stopReason) {
      posts.push({ channelId: draft.channelId, outcome: "failed", message: stopReason });
      continue;
    }
    const startedAt = new Date(Date.now() - 60_000);
    const input = buildPostInput({ draft, channel: channel!, media: body.media, ideaId });
    try {
      const { createPost } = await gql<{ createPost: CreatePostResult }>(ctx.token, CREATE_POST, { input });
      if ("post" in createPost) {
        posts.push({ channelId: draft.channelId, outcome: "created", postId: createPost.post.id, status: createPost.post.status, dueAt: createPost.post.dueAt });
      } else {
        console.error("createPost typed error", draft.channelId, createPost);
        posts.push({ channelId: draft.channelId, outcome: "failed", message: friendlyMutationMessage(createPost.__typename, createPost.message) });
      }
    } catch (e) {
      if (e instanceof BufferUncertainError) {
        // createPost has no idempotency key: check whether it landed before suggesting a retry.
        posts.push(await verify(ctx, org.id, draft.channelId, startedAt, ideaId, draft.text));
        continue;
      }
      if (e instanceof BufferError && e.code === "UNAUTHORIZED") throw e;
      if (e instanceof BufferError && e.code === "RATE_LIMIT_EXCEEDED") stopReason = friendlyMessage(e);
      posts.push({ channelId: draft.channelId, outcome: "failed", message: friendlyMessage(e) });
    }
  }
  return { ideaId, ideaMessage, posts };
}

async function verify(ctx: Ctx, organizationId: string, channelId: string, since: Date, ideaId: string | null, text: string): Promise<PostResult> {
  try {
    const found = await findCreatedPost(ctx.token, { organizationId, channelId, since, ideaId, text });
    if (found) return { channelId, outcome: "created", postId: found.id, status: found.status, dueAt: found.dueAt };
    return { channelId, outcome: "failed", message: "Buffer didn't respond in time and the post wasn't created. It's safe to retry." };
  } catch {
    return { channelId, outcome: "unknown", message: "Buffer didn't respond in time. Check this channel's queue in Buffer before retrying, so it isn't posted twice." };
  }
}
