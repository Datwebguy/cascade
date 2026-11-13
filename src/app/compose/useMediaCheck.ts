"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { checkFile, IMAGE_TYPES } from "@/lib/upload";
import type { Media } from "@/lib/types";
import { api } from "./api";

export interface MediaState {
  status: "idle" | "checking" | "uploading" | "ok" | "error";
  media?: Media;
  message?: string;
  /** 0–100 while uploading. */
  progress?: number;
  /** Local preview while uploading. */
  previewUrl?: string;
  fileName?: string;
}

/** Media for the idea: upload from the device, or paste a public link. */
export function useMediaCheck() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j: { enabled: boolean; folder?: string }) => setUploadFolder(j.enabled ? j.folder ?? null : null))
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
    const previewUrl = URL.createObjectURL(file);
    setState({ status: "uploading", progress: 0, previewUrl, fileName: file.name, media: { url: previewUrl, kind } });
    try {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || `media.${kind === "image" ? "jpg" : "mp4"}`;
      const blob = await upload(`${uploadFolder}${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type,
        multipart: file.size > 8 * 1024 * 1024,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => setState((s) => (s.status === "uploading" ? { ...s, progress: Math.round(percentage) } : s)),
      });
      setState({ status: "ok", media: { url: blob.url, kind }, previewUrl, fileName: file.name });
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error(e);
      setState({ status: "error", message: "The upload didn't finish. Check your connection and try again." });
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
