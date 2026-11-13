import { NextResponse } from "next/server";
import { authorizeUrl, createPkce } from "@/lib/oauth";
import { setPkce } from "@/lib/session";

export async function GET() {
  const { verifier, challenge, state } = createPkce();
  await setPkce({ verifier, state });
  return NextResponse.redirect(authorizeUrl(challenge, state));
}
