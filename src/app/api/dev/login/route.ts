import { NextResponse, type NextRequest } from "next/server";
import { startSession } from "@/lib/session";

/**
 * Local-only shortcut for recording demos against a real Buffer account: signs in with a
 * personal API key instead of the OAuth screen. Disabled unless CASCADE_DEV_TOKEN is set
 * (never set in deployments) and the request is to localhost.
 */
export async function GET(req: NextRequest) {
  const token = process.env.CASCADE_DEV_TOKEN;
  const host = req.headers.get("host") ?? "";
  if (!token || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await startSession({ accessToken: token, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 });
  return NextResponse.redirect(new URL("/compose", req.nextUrl.origin));
}
