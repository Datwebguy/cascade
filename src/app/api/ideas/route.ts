import type { NextRequest } from "next/server";
import { fetchIdeas } from "@/lib/buffer";
import { organizations, RouteError, withSession } from "../handler";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("organizationId");
  const after = req.nextUrl.searchParams.get("after") ?? undefined;
  return withSession(async (ctx) => {
    if (!orgId || !(await organizations(ctx)).some((o) => o.id === orgId)) throw new RouteError("We couldn't find that Buffer workspace.");
    return fetchIdeas(ctx.token, orgId, after);
  });
}
