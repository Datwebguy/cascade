"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { checkFile, IMAGE_TYPES } from "@/lib/upload";
import type { Media } from "@/lib/types";
import { api } from "./api";
import { instagramVariant, prepareImage, sendImage } from "./prepareImage";

export interface MediaState {
  status: "idle" | "checking" | "uploading" | "ok" | "error";
  media?: Media;
  message?: string;
  /** 0–100 while uploading. */
  progress?: number;
  /** Local preview while uploading. */
  previewUrl?: string;
  fileName?: string;
  fileSize?: number;
  /** Upload is taking a while (no progress for a bit). */
  slow?: boolean;
}

/** Reads an image as a data URL: the most reliable preview across mobile browsers. */
function readAsDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : undefined);
    r.onerror = () => resolve(undefined);
    r.readAsDataURL(file);
  });
}

/** Media for the idea: upload from the device, or paste a public link. */
export function useMediaCheck() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"token" | "presigned">("token");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j: { enabled: boolean; folder?: string; mode?: "token" | "presigned" }) => {
        setUploadFolder(j.enabled ? j.folder ?? null : null);
        if (j.mode) setUploadMode(j.mode);
      })
      .catch(() => setUploadFolder(null));
  }, []);

  function clear() {
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    latest.current = "";
    setUrl("");
    setState({ status: "idle" });
  }

  function change(value: string) {
    abort.current?.abort();
    setUrl(value);
    latest.current = value.trim();
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "checking" });
    timer.current = setTimeout(async () => {
      const checking = value.trim();
      try {
        const res = await api<{ ok: boolean; kind?: "image" | "video"; message?: string }>("/api/media", { url: checking });
        if (latest.current !== checking) return;
        setState(res.ok ? { status: "ok", media: { url: checking, kind: res.kind! } } : { status: "error", message: res.message });
      } catch (e) {
        if (latest.current === checking) setState({ status: "error", message: (e as Error).message });
      }
    }, 600);
  }

  async function uploadFile(file: File) {
    const problem = checkFile(file);
    if (problem) {
      setState({ status: "error", message: problem });
      return;
    }
    if (!uploadFolder) {
      setState({ status: "error", message: "Uploading isn't available right now. Paste a link instead." });
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setUrl("");
    latest.current = "";
    const kind = IMAGE_TYPES.includes(file.type) ? "image" : "video";
    const previewUrl = kind === "image" ? await readAsDataUrl(file) : URL.createObjectURL(file);
    const base = { previewUrl, fileName: file.name, fileSize: file.size };
    setState({ status: "uploading", progress: 0, ...base, media: { url: previewUrl ?? "", kind } });
    let lastProgress = Date.now();
    const watchdog = setInterval(() => {
      if (kind === "image" && Date.now() - lastProgress > 15000) setState((s) => (s.status === "uploading" ? { ...s, slow: true } : s));
    }, 3000);
    try {
      let url: string;
      if (kind === "image") {
        const ready = await prepareImage(file);
        const igFile = await instagramVariant(ready);
        url = await sendImage(ready, (pct) => {
          lastProgress = Date.now();
          // Leave a little room for the Instagram copy, when there is one.
          const shown = igFile ? Math.round(pct * 0.85) : pct;
          setState((s) => (s.status === "uploading" ? { ...s, progress: shown, slow: false } : s));
        }, controller.signal);
        if (igFile) {
          const instagramUrl = await sendImage(igFile, (pct) => {
            lastProgress = Date.now();
            setState((s) => (s.status === "uploading" ? { ...s, progress: 85 + Math.round(pct * 0.15) } : s));
          }, controller.signal).catch(() => undefined);
          if (instagramUrl) {
            setState({ status: "ok", media: { url, kind, instagramUrl }, ...base });
            return;
          }
        }
      } else {
        // Videos go straight to storage. No progress callback: that path relies on streaming
        // uploads, which fail on some mobile networks and browsers.
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "video.mp4";
        const send = uploadMode === "presigned" ? uploadPresigned : upload;
        const blob = await send(`${uploadFolder}${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: file.type,
          multipart: file.size > 50 * 1024 * 1024,
          abortSignal: controller.signal,
        });
        url = blob.url;
      }
      setState({ status: "ok", media: { url, kind }, ...base });
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error(e);
      const msg = e instanceof Error ? e.message : "";
      setState({
        status: "error",
        message: /connect your Buffer/i.test(msg)
          ? "You've been signed out. Refresh the page and connect again."
          : /^(The upload|That image|Choose|Uploading isn)/.test(msg)
            ? msg
            : "The upload didn't finish. Check your connection and try again.",
      });
    } finally {
      clearInterval(watchdog);
    }
  }

  return {
    url,
    state,
    change,
    uploadFile,
    clear,
    canUpload: !!uploadFolder,
    media: state.status === "ok" ? state.media! : null,
  };
}
