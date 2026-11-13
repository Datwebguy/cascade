import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sessionId } from "@/lib/session";
import { IMAGE_TYPES, MAX_SERVER_UPLOAD_BYTES } from "@/lib/upload";

/**
 * Same-origin image upload: the browser sends the (already resized) image here with a plain
 * request, and the server stores it in Vercel Blob. Works on every browser and network.
 */
export async function POST(req: NextRequest) {
  const sid = await sessionId();
  if (!sid) return NextResponse.json({ error: "Please connect your Buffer account first." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return NextResponse.json({ error: "Uploading isn't available right now. Paste a link instead." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Choose a JPG, PNG, GIF or WebP image." }, { status: 400 });
  if (file.size > MAX_SERVER_UPLOAD_BYTES) return NextResponse.json({ error: "That image is too large. Choose a smaller one." }, { status: 413 });

  const folder = `uploads/${createHash("sha256").update(sid).digest("hex").slice(0, 16)}/`;
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image.jpg";
  try {
    const blob = await put(`${folder}${safe}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("Image upload failed", e);
    return NextResponse.json({ error: "The upload didn't finish. Please try again." }, { status: 502 });
  }
}
