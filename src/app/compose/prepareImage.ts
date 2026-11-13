"use client";

import { MAX_SERVER_UPLOAD_BYTES } from "@/lib/upload";

const MAX_EDGE = 2560;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

/**
 * Makes an image small enough to upload reliably while keeping it sharp for social posts:
 * at most 2560px on the long edge and under 4 MB. GIFs are kept as-is to preserve animation.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file; // let the server decide; it will reject it if it's too big
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.size <= MAX_SERVER_UPLOAD_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const keepPng = file.type === "image/png" && file.size <= MAX_SERVER_UPLOAD_BYTES * 2;
  for (const quality of [0.9, 0.82, 0.72, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, keepPng ? "image/png" : "image/jpeg", quality));
    if (blob && blob.size <= MAX_SERVER_UPLOAD_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + (keepPng ? ".png" : ".jpg");
      return new File([blob], name, { type: blob.type });
    }
    if (keepPng) break;
  }
  // Last resort: JPEG at lower quality.
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.5));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

/** Plain same-origin upload with real progress events (works on every browser and network). */
export function sendImage(file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/file");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { url?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && json.url) resolve(json.url);
      else reject(new Error(json.error ?? "The upload didn't finish. Please try again."));
    };
    xhr.onerror = () => reject(new Error("The upload didn't finish. Check your connection and try again."));
    xhr.timeout = 120000;
    xhr.ontimeout = () => reject(new Error("The upload is taking too long. Check your connection and try again."));
    signal.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Instagram only auto-publishes images with an aspect ratio between 4:5 and 1.91:1. */
export const IG_MIN_RATIO = 4 / 5;
export const IG_MAX_RATIO = 1.91;

/** Returns a centre-cropped JPEG that Instagram accepts, or null if the image already fits. */
export async function instagramVariant(file: File): Promise<File | null> {
  if (file.type === "image/gif") return null;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ratio = w / h;
  if (ratio >= IG_MIN_RATIO && ratio <= IG_MAX_RATIO) return null;
  const target = ratio < IG_MIN_RATIO ? IG_MIN_RATIO : IG_MAX_RATIO;
  const cw = ratio < IG_MIN_RATIO ? w : Math.round(h * target);
  const ch = ratio < IG_MIN_RATIO ? Math.round(w / target) : h;
  const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.8, 0.65]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_SERVER_UPLOAD_BYTES) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-instagram.jpg", { type: "image/jpeg" });
    }
  }
  return null;
}
