import { del, put } from "@vercel/blob";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Operator self-test for media storage: writes and deletes a tiny file with the configured
 * credentials and reports the outcome. Guarded by a key derived from SESSION_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.SESSION_SECRET ?? "";
  const expected = Buffer.from(createHash("sha256").update(`upload-check:${secret}`).digest("hex"));
  const given = Buffer.from(req.headers.get("x-check-key") ?? "");
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const env = {
    readWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    storeId: !!process.env.BLOB_STORE_ID,
    webhookKey: !!process.env.BLOB_WEBHOOK_PUBLIC_KEY,
    oidc: !!process.env.VERCEL_OIDC_TOKEN,
  };
  try {
    const blob = await put(`selftest/ping-${Date.now()}.txt`, "ok", { access: "public", addRandomSuffix: true });
    await del(blob.url).catch(() => {});
    return NextResponse.json({ ok: true, env, host: new URL(blob.url).host });
  } catch (e) {
    return NextResponse.json({ ok: false, env, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
  }
}
