"use client";

import { AnimatePresence, motion } from "motion/react";
import { platformFor } from "@/lib/platforms";
import type { DraftCheck } from "@/lib/post-input";
import type { Channel, Draft, FeedPostType, Media, SchedulingMode, YoutubePrivacy } from "@/lib/types";
import { ChannelIdentity, Icon, MediaPreview, Meter } from "./ui";

const MODES: { id: SchedulingMode; label: string; icon: "queue" | "clock" | "draft" }[] = [
  { id: "addToQueue", label: "Queue", icon: "queue" },
  { id: "customScheduled", label: "Pick a time", icon: "clock" },
  { id: "saveToDraft", label: "Draft", icon: "draft" },
];

const MODE_HINT: Record<SchedulingMode, string> = {
  addToQueue: "Goes out at the next open time in this channel's Buffer schedule.",
  customScheduled: "",
  saveToDraft: "Saved as a draft in Buffer. Nothing is published.",
};

export interface ReviewProps {
  drafts: Draft[];
  channelById: Map<string, Channel>;
  checks: Map<string, DraftCheck>;
  media: Media | null;
  struggling: Set<string>;
  regenerating: string | null;
  onUpdate: (channelId: string, patch: Partial<Draft>) => void;
  onMode: (draft: Draft, mode: SchedulingMode) => void;
  onAllModes: (mode: SchedulingMode) => void;
  onRegenerate: (channelId: string) => void;
  onRemove: (channelId: string) => void;
  sendError: string;
}

export function ReviewStep(p: ReviewProps) {
  return (
    <>
      <div className="review-head">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>Your posts</h1>
          <p>Each one is written for its channel. Edit anything before sending.</p>
        </div>
        <div className="row">
          <span className="hint">Set all to</span>
          <div className="segmented" role="radiogroup" aria-label="Set all posts to">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={p.drafts.length > 0 && p.drafts.every((d) => d.mode === m.id)} onClick={() => p.onAllModes(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {p.sendError && (
        <p className="notice error" role="alert" style={{ marginBottom: "1rem" }}>
          <Icon name="alert" /> {p.sendError}
        </p>
      )}

      <motion.div className="posts" layout>
        <AnimatePresence>
          {p.drafts.map((d, i) => {
            const ch = p.channelById.get(d.channelId);
            if (!ch) return null;
            return (
              <motion.div
                key={d.channelId}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 220, damping: 24 }}
              >
                <PostCard {...p} draft={d} channel={ch} check={p.checks.get(d.channelId)!} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

function PostCard(props: ReviewProps & { draft: Draft; channel: Channel; check: DraftCheck }) {
  const { draft: d, channel: ch, check, media, onUpdate } = props;
  const pf = platformFor(ch.service);
  const busy = props.regenerating === d.channelId;
  const setOption = (patch: Partial<Draft["options"]>) => onUpdate(d.channelId, { options: { ...d.options, ...patch } });

  return (
    <article className="card post" data-issues={check.errors.length > 0}>
      <div className="post-head">
        <ChannelIdentity channel={ch} />
        <span className="spacer" />
        <button className="btn quiet sm" onClick={() => props.onRegenerate(d.channelId)} disabled={busy} title="Write a new version">
          <motion.span animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { repeat: Infinity, duration: 0.9, ease: "linear" } : {}} style={{ display: "inline-flex" }}>
            <Icon name="refresh" size={16} />
          </motion.span>
          <span className="sr-only">Rewrite</span>
        </button>
        <button className="btn quiet sm" onClick={() => props.onRemove(d.channelId)} title={`Don't post to ${ch.displayName || ch.name}`}>
          <Icon name="close" size={16} />
          <span className="sr-only">Remove</span>
        </button>
      </div>

      {pf.title && (
        <input
          className="post-title"
          value={d.title ?? ""}
          maxLength={150}
          onChange={(e) => onUpdate(d.channelId, { title: e.target.value })}
          placeholder={pf.title === "required" ? "Title" : "Title (optional)"}
          aria-label="Title"
        />
      )}

      <textarea
        className="post-body"
        aria-label={`Post for ${ch.displayName || ch.name}`}
        rows={Math.min(14, Math.max(4, d.text.split("\n").length + Math.ceil(d.text.length / 52)))}
        value={d.text}
        onChange={(e) => onUpdate(d.channelId, { text: e.target.value })}
      />

      {media && d.includeMedia && <MediaPreview media={media} />}

      <div className="post-foot">
        <Meter count={check.count} limit={check.limit} />
        {props.struggling.has(d.channelId) && <span className="hint">Please shorten this one</span>}
      </div>

      <div className="post-section">
        {media && (
          <label className="toggle">
            <input type="checkbox" checked={d.includeMedia} onChange={(e) => onUpdate(d.channelId, { includeMedia: e.target.checked })} />
            Include {media.kind === "video" ? "video" : "image"}
          </label>
        )}

        {(ch.service === "instagram" || ch.service === "facebook") && media && d.includeMedia && (
          <div className="row between">
            <span className="hint">Share as</span>
            <div className="segmented" role="radiogroup" aria-label="Share as">
              {(["post", "reel", "story"] as FeedPostType[]).map((t) => {
                const value = ch.service === "instagram" ? d.options.instagramType : d.options.facebookType;
                return (
                  <button key={t} role="radio" aria-checked={(value ?? "post") === t} onClick={() => setOption(ch.service === "instagram" ? { instagramType: t } : { facebookType: t })}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {ch.service === "pinterest" && (
          <select aria-label="Pinterest board" value={d.options.pinterestBoardId ?? ""} onChange={(e) => setOption({ pinterestBoardId: e.target.value || undefined })}>
            <option value="">Choose a board…</option>
            {(ch.pinterestBoards ?? []).map((b) => (
              <option key={b.serviceId} value={b.serviceId}>{b.name}</option>
            ))}
          </select>
        )}

        {ch.service === "youtube" && (
          <select aria-label="Who can watch" value={d.options.youtubePrivacy ?? ""} onChange={(e) => setOption({ youtubePrivacy: (e.target.value || undefined) as YoutubePrivacy | undefined })}>
            <option value="">Visibility: channel default</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        )}

        <div className="segmented" role="radiogroup" aria-label="When to post" style={{ alignSelf: "flex-start" }}>
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={d.mode === m.id} onClick={() => props.onMode(d, m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {d.mode === "customScheduled" ? (
          <div className="field">
            <input type="datetime-local" aria-label="Date and time" value={d.dueLocal ?? ""} onChange={(e) => onUpdate(d.channelId, { dueLocal: e.target.value })} />
            <span className="hint">In this channel&apos;s time zone ({ch.timezone.replace(/_/g, " ")}).</span>
          </div>
        ) : (
          <span className="hint">{MODE_HINT[d.mode]}</span>
        )}

        {check.errors.length > 0 && (
          <ul className="issues">
            {check.errors.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
