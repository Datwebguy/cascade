import { NextResponse } from "next/server";
import { authorizeUrl, createPkce } from "@/lib/oauth";
import { setPkce } from "@/lib/session";

export async function GET() {
  const { verifier, challenge, state } = createPkce();
  // Saved before redirecting, in an encrypted cookie, so the callback can verify state on any instance.
  await setPkce({ verifier, state });
  return NextResponse.redirect(authorizeUrl(challenge, state));
}
