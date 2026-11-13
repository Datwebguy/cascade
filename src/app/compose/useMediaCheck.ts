"use client";

import { useRef, useState } from "react";
import type { Media } from "@/lib/types";
import { api } from "./api";

export interface MediaState {
  status: "idle" | "checking" | "ok" | "error";
  media?: Media;
  message?: string;
}

/** Checks a pasted link the way Buffer will fetch it, after the user stops typing. */
export function useMediaCheck() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  function change(value: string) {
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
        if (latest.current !== checking) return; // user kept typing
        setState(res.ok ? { status: "ok", media: { url: checking, kind: res.kind! } } : { status: "error", message: res.message });
      } catch (e) {
        if (latest.current === checking) setState({ status: "error", message: (e as Error).message });
      }
    }, 600);
  }

  return { url, state, change, media: state.status === "ok" ? state.media! : null };
}
