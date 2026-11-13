import type { NextRequest } from "next/server";
import { adaptIdea, AiError } from "@/lib/ai";
import { platformFor } from "@/lib/platforms";
import { incrWindow } from "@/lib/store";
import type { AdaptRequest } from "@/lib/types";
import { organizations, RouteError, withSession } from "../handler";

const MAX_IDEA_CHARS = 5000;
const MAX_ADAPTS_PER_HOUR = 40;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as AdaptRequest | null;
  return withSession(async (ctx) => {
    if (!body?.idea?.trim()) throw new RouteError("Write an idea first.");
    if (body.idea.length > MAX_IDEA_CHARS) throw new RouteError(`Keep your idea under ${MAX_IDEA_CHARS.toLocaleString()} characters.`);
    if (!body.channelIds?.length) throw new RouteError("Select at least one channel.");
    if ((await incrWindow(`cascade:adapt-count:${ctx.sid}`, 3600)) > MAX_ADAPTS_PER_HOUR) {
      throw new RouteError("You've created a lot of posts this hour. Take a short break and try again soon.", 429);
    }

    const org = (await organizations(ctx)).find((o) => o.id === body.organizationId);
    if (!org) throw new RouteError("We couldn't find that Buffer workspace. Refresh and try again.");
    const channels = body.channelIds.map((id) => org.channels.find((c) => c.id === id));
    if (channels.some((c) => !c || !platformFor(c.service).supported)) throw new RouteError("One of the channels you chose isn't available. Refresh and try again.");

    try {
      const drafts = await adaptIdea({ idea: body.idea, title: body.title, media: body.media, channels: channels as NonNullable<(typeof channels)[number]>[] });
      return { drafts };
    } catch (e) {
      if (e instanceof AiError) throw new RouteError(e.message, 502);
      throw e;
    }
  });
}
