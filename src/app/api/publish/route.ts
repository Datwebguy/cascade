import { NextResponse, type NextRequest } from "next/server";
import {
  CREATE_IDEA,
  CREATE_POST,
  fetchOrganizations,
  gql,
  type CreateIdeaResult,
  type CreatePostResult,
} from "@/lib/buffer";
import { buildPostInput } from "@/lib/post-input";
import type { PostResult, PublishRequest, PublishResponse } from "@/lib/types";
import { withToken } from "../handler";

function ideaIdFrom(result: CreateIdeaResult): string | null {
  if ("id" in result) return result.id;
  if ("idea" in result) return result.idea?.id ?? null;
  return null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PublishRequest | null;
  if (!body?.organizationId || !body.idea?.text?.trim() || !body.drafts?.length) {
    return NextResponse.json({ error: "Idea text and at least one channel are required." }, { status: 400 });
  }
  if (body.media && !/^https:\/\//i.test(body.media.url) && !/^http:\/\//i.test(body.media.url)) {
    return NextResponse.json({ error: "Media must be a public http(s) URL." }, { status: 400 });
  }

  return withToken(async (token): Promise<PublishResponse> => {
    // Resolve services server-side so the client can't mislabel a channel.
    const orgs = await fetchOrganizations(token);
    const org = orgs.find((o) => o.id === body.organizationId);
    if (!org) throw new Error("Organization not found.");
    const services = new Map(org.channels.map((c) => [c.id, c.service]));

    // 1. Save the idea (or reuse the one the user picked).
    let ideaId: string | null = body.idea.existingIdeaId ?? null;
    let ideaError: string | undefined;
    if (!ideaId) {
      const media = body.media
        ? [{ url: body.media.url, type: body.media.kind }]
        : undefined;
      const { createIdea } = await gql<{ createIdea: CreateIdeaResult }>(token, CREATE_IDEA, {
        input: {
          organizationId: org.id,
          content: {
            title: body.idea.title?.trim() || undefined,
            text: body.idea.text,
            media,
            services: [...new Set(body.drafts.map((d) => services.get(d.channelId)).filter(Boolean))],
          },
        },
      });
      ideaId = ideaIdFrom(createIdea);
      if (!ideaId) ideaError = "message" in createIdea ? createIdea.message : "Idea was not saved.";
    }

    // 2. One createPost per channel, linked to the idea.
    const posts: PostResult[] = [];
    for (const draft of body.drafts) {
      const service = services.get(draft.channelId);
      if (!service) {
        posts.push({ channelId: draft.channelId, ok: false, error: "Channel not found." });
        continue;
      }
      try {
        const input = buildPostInput({ draft, service, media: body.media, ideaId });
        const { createPost } = await gql<{ createPost: CreatePostResult }>(token, CREATE_POST, { input });
        if ("post" in createPost) {
          posts.push({
            channelId: draft.channelId,
            ok: true,
            postId: createPost.post.id,
            status: createPost.post.status,
            dueAt: createPost.post.dueAt,
          });
        } else {
          posts.push({ channelId: draft.channelId, ok: false, error: createPost.message });
        }
      } catch (e) {
        posts.push({
          channelId: draft.channelId,
          ok: false,
          error: e instanceof Error ? e.message : "Unexpected error.",
        });
      }
    }
    return { ideaId, ideaError, posts };
  });
}
