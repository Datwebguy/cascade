import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, createPkce, redirectUriFor } from "@/lib/oauth";
import { setPkce } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { verifier, challenge, state } = createPkce();
  const redirectUri = redirectUriFor(req.nextUrl.origin);
  // Saved before redirecting, in an encrypted cookie, so the callback can verify state on any instance.
  await setPkce({ verifier, state, redirectUri });
  return NextResponse.redirect(authorizeUrl(challenge, state, redirectUri));
}
