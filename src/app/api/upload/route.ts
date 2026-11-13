import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sessionId } from "@/lib/session";
import { MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";

/**
 * Issues short-lived tokens so the browser can upload a photo or video straight to Vercel Blob.
 * Buffer has no upload endpoint; it needs a public, stable HTTPS link, which Blob provides.
 */
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploading isn't available right now. Paste a link instead." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const sid = await sessionId();
        if (!sid) throw new Error("not-signed-in");
        const owner = createHash("sha256").update(sid).digest("hex").slice(0, 16);
        if (!pathname.startsWith(`uploads/${owner}/`)) throw new Error("bad-path");
        return {
          allowedContentTypes: MEDIA_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("Upload token error", msg);
    if (msg === "not-signed-in") return NextResponse.json({ error: "Please connect your Buffer account first." }, { status: 401 });
    return NextResponse.json({ error: "That upload couldn't start. Please try again." }, { status: 400 });
  }
}

/** Where the browser should put its uploads (a per-session folder). */
export async function GET() {
  const sid = await sessionId();
  if (!sid || !process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, folder: `uploads/${createHash("sha256").update(sid).digest("hex").slice(0, 16)}/` });
}
