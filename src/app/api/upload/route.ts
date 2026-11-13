import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sessionId } from "@/lib/session";
import { MEDIA_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload";

/**
 * Lets the browser upload a photo or video straight to Vercel Blob. Buffer has no upload
 * endpoint; it needs a public, stable HTTPS link, which Blob provides.
 *
 * Two setups are supported:
 *  - "token":     BLOB_READ_WRITE_TOKEN is set (classic connection)
 *  - "presigned": BLOB_STORE_ID with Vercel's built-in OIDC sign-in (newer connections)
 */
type Mode = "token" | "presigned" | null;
function mode(): Mode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID) return "presigned";
  return null;
}

const folderFor = (sid: string) => `uploads/${createHash("sha256").update(sid).digest("hex").slice(0, 16)}/`;
const limits = () => ({
  allowedContentTypes: MEDIA_TYPES,
  maximumSizeInBytes: MAX_UPLOAD_BYTES,
  validUntil: Date.now() + 10 * 60 * 1000,
});

async function authorize(pathname: string) {
  const sid = await sessionId();
  if (!sid) throw new Error("not-signed-in");
  if (!pathname.startsWith(folderFor(sid))) throw new Error("bad-path");
}

export async function POST(req: NextRequest) {
  const m = mode();
  if (!m) return NextResponse.json({ error: "Uploading isn't available right now. Paste a link instead." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as (HandleUploadBody | HandleUploadPresignedBody) | null;
  if (!body) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });

  try {
    if (m === "token") {
      const result = await handleUpload({
        body: body as HandleUploadBody,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          await authorize(pathname);
          return { ...limits(), addRandomSuffix: true };
        },
      });
      return NextResponse.json(result);
    }
    const result = await handleUploadPresigned({
      body: body as HandleUploadPresignedBody,
      request: req,
      // Only used to verify upload-completed callbacks, which Cascade doesn't register.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || "not-used",
      getSignedToken: async (pathname) => {
        await authorize(pathname);
        const l = limits();
        const token = await issueSignedToken({ pathname, operations: ["put"], ...l });
        return { token, urlOptions: { ...l, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Upload authorization error", msg);
    if (msg === "not-signed-in") return NextResponse.json({ error: "Please connect your Buffer account first." }, { status: 401 });
    // A short, non-secret reason helps diagnose setup problems without exposing details.
    const reason = /oidc|credential/i.test(msg) ? "auth" : /store/i.test(msg) ? "store" : msg === "bad-path" ? "path" : "other";
    return NextResponse.json({ error: "That upload couldn't start. Please try again.", reason }, { status: 400 });
  }
}

/** Tells the browser whether uploads are on, which method to use, and its folder. */
export async function GET() {
  const sid = await sessionId();
  const m = mode();
  if (!sid || !m) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, mode: m, folder: folderFor(sid) });
}
