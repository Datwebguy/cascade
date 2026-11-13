import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/oauth";
import { saveTokens, takePkce } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, url.origin));

  const pkce = await takePkce();
  const state = url.searchParams.get("state");
  if (!pkce || !state || state !== pkce.state) return fail("invalid_state");

  const error = url.searchParams.get("error");
  if (error) return fail(error);

  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");

  try {
    await saveTokens(await exchangeCode(code, pkce.verifier));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "token_exchange_failed");
  }
  return NextResponse.redirect(new URL("/compose", url.origin));
}
