import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { MediaKind } from "./types";

/**
 * Checks a media URL the way Buffer will fetch it: public, direct, HTTPS.
 * Detects image vs video from the Content-Type the server returns.
 */

export interface MediaCheck {
  ok: boolean;
  kind?: MediaKind;
  contentType?: string;
  message?: string;
}

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::" || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublicHost(hostname: string) {
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("private");
  }
}

export async function checkMediaUrl(raw: string): Promise<MediaCheck> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "That isn't a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, message: "Buffer requires an HTTPS (https://) media URL." };
  if (/(drive\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms)$/i.test(url.hostname)) {
    return { ok: false, message: "Share links from Drive/Dropbox/OneDrive open a preview page, not the file. Use a direct file URL." };
  }

  try {
    await assertPublicHost(url.hostname);
  } catch {
    return { ok: false, message: "That address isn't publicly reachable." };
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "manual", signal: AbortSignal.timeout(8000) });
    }
  } catch {
    return { ok: false, message: "Couldn't reach that URL. Check it opens in a private browser window." };
  }

  if (res.status >= 300 && res.status < 400) {
    return { ok: false, message: "That URL redirects. Buffer needs the direct file URL." };
  }
  if (!res.ok && res.status !== 206) {
    return { ok: false, message: `The URL returned HTTP ${res.status}. It must load without logging in.` };
  }
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType.startsWith("image/")) return { ok: true, kind: "image", contentType };
  if (contentType.startsWith("video/")) return { ok: true, kind: "video", contentType };
  return {
    ok: false,
    contentType,
    message: contentType.startsWith("text/html")
      ? "That URL is a web page, not an image or video file."
      : `Unsupported file type (${contentType || "unknown"}). Use an image or video.`,
  };
}
