import { NextResponse, type NextRequest } from "next/server";
import { fetchIdeas } from "@/lib/buffer";
import { withToken } from "../handler";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("organizationId");
  if (!orgId) return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  return withToken(async (token) => ({ ideas: await fetchIdeas(token, orgId) }));
}
