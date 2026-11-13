import type { NextRequest } from "next/server";
import { organizations, withSession } from "../handler";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  return withSession(async (ctx) => ({ organizations: await organizations(ctx, refresh) }));
}
