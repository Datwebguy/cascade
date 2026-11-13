"use client";

import { motion } from "motion/react";
import { NetworkIcon } from "@/components/NetworkIcon";
import { platformFor } from "@/lib/platforms";
import type { Channel, Media } from "@/lib/types";

type IconName = "check" | "spark" | "refresh" | "close" | "image" | "clock" | "queue" | "draft" | "arrow-left" | "arrow-right" | "alert" | "external";

const PATHS: Record<IconName, string> = {
  check: "M5 12.5l4.2 4.2L19 7",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5",
  refresh: "M20 11a8 8 0 0 0-14.6-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.6L20 16M20 20v-4h-4",
  close: "M6 6l12 12M18 6L6 18",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1.5 1.5 0 1 0 0-.01",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  queue: "M4 6h16M4 12h16M4 18h10",
  draft: "M5 19h4L19 9l-4-4L5 15v4zM14 6l4 4",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  alert: "M12 8v5M12 16.5v.5M10.3 4.3L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export type Step = "compose" | "review" | "done";
const STEPS: { id: Step; label: string }[] = [
  { id: "compose", label: "Your idea" },
  { id: "review", label: "Review" },
  { id: "done", label: "Sent" },
];

export function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s.id} data-state={i < current ? "done" : i === current ? "current" : "todo"} aria-current={i === current ? "step" : undefined}>
          {i > 0 && <span className="bar" aria-hidden="true" />}
          <span className="dot">{i < current ? <Icon name="check" size={14} /> : i + 1}</span>
          <span className="label-text">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ChannelIdentity({ channel, sub }: { channel: Channel; sub?: string }) {
  return (
    <>
      <span className="avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={channel.avatar} alt="" />
        <span className="net">
          <NetworkIcon service={channel.service} size={12} />
        </span>
      </span>
      <span className="who">
        <strong>{channel.displayName || channel.name}</strong>
        <span>{sub ?? platformFor(channel.service).label}</span>
      </span>
    </>
  );
}

export function MediaPreview({ media, compact }: { media: Media; compact?: boolean }) {
  return (
    <div className={`media-preview ${compact ? "compact" : ""}`}>
      {media.kind === "video" ? (
        <video src={media.url} controls={!compact} muted playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Your attached image" />
      )}
    </div>
  );
}

/** Circular character meter. */
export function Meter({ count, limit }: { count: number; limit: number }) {
  const ratio = Math.min(count / limit, 1);
  const over = count > limit;
  const r = 8;
  const c = 2 * Math.PI * r;
  const color = over ? "var(--err)" : ratio > 0.9 ? "var(--warn)" : "var(--primary)";
  return (
    <span className="meter" data-over={over} title={`${count.toLocaleString()} of ${limit.toLocaleString()} characters`}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <motion.circle
          cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
        />
      </svg>
      {over ? `${(count - limit).toLocaleString()} over` : `${(limit - count).toLocaleString()} left`}
    </span>
  );
}
