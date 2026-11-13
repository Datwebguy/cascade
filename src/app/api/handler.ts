import { NextResponse } from "next/server";
import { BufferAuthError } from "@/lib/buffer";
import { clearSession, getAccessToken } from "@/lib/session";

/** Wraps a route so it gets a fresh access token and consistent JSON errors. */
export async function withToken(fn: (token: string) => Promise<unknown>) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not connected to Buffer." }, { status: 401 });
  try {
    return NextResponse.json(await fn(token));
  } catch (e) {
    if (e instanceof BufferAuthError) {
      await clearSession();
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
