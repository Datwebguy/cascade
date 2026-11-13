import type { NextRequest } from "next/server";
import { checkMediaUrl } from "@/lib/media";
import { RouteError, withSession } from "../handler";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  return withSession(async () => {
    if (!body?.url) throw new RouteError("Paste a link first.");
    return checkMediaUrl(body.url);
  });
}
