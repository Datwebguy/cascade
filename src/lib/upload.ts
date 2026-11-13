/** Media types accepted for upload: the common formats every network Buffer supports can take. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function checkFile(file: { type: string; size: number }): string | null {
  if (!MEDIA_TYPES.includes(file.type)) return "Choose a JPG, PNG, GIF or WebP image, or an MP4 or MOV video.";
  if (IMAGE_TYPES.includes(file.type) && file.size > MAX_IMAGE_BYTES) return "That image is over 20 MB. Choose a smaller one.";
  if (file.size > MAX_UPLOAD_BYTES) return "That video is over 500 MB. Choose a shorter or smaller one.";
  return null;
}

/** Vercel functions accept request bodies up to 4.5 MB; stay safely under it. */
export const MAX_SERVER_UPLOAD_BYTES = 4 * 1024 * 1024;
