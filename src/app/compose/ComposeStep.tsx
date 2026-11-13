"use client";

import { AnimatePresence, motion } from "motion/react";
import { platformFor } from "@/lib/platforms";
import type { Channel, IdeaSummary, Organization } from "@/lib/types";
import { ChannelIdentity, Icon, MediaPreview } from "./ui";
import type { MediaState } from "./useMediaCheck";

export interface ComposeProps {
  orgs: Organization[];
  orgId: string;
  onOrgChange: (id: string) => void;
  channels: Channel[];
  refreshing: boolean;
  onRefreshChannels: () => void;
  title: string;
  setTitle: (v: string) => void;
  ideaText: string;
  setIdeaText: (v: string) => void;
  ideas: IdeaSummary[];
  hasMoreIdeas: boolean;
  loadingIdeas: boolean;
  onLoadMoreIdeas: () => void;
  existingIdeaId: string | null;
  onPickIdea: (id: string) => void;
  mediaUrl: string;
  onMediaUrl: (v: string) => void;
  mediaState: MediaState;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  draftError: string;
  onRetryDrafts: () => void;
  onWriteManually: () => void;
}

export function unavailableReason(c: Channel): string | null {
  if (!platformFor(c.service).supported) return "Not available yet";
  if (c.isDisconnected) return "Reconnect in Buffer";
  if (c.isLocked) return "Locked in Buffer";
  return null;
}

export function ComposeStep(p: ComposeProps) {
  const usable = p.channels.filter((c) => !unavailableReason(c));
  const allSelected = usable.length > 0 && usable.every((c) => p.selected.has(c.id));

  return (
    <>
      <div className="page-head">
        <h1>What&apos;s the idea?</h1>
        <p>Write it the way you&apos;d say it. Cascade shapes it for each channel.</p>
      </div>

      <div className="compose-grid">
        <div>
          <section className="card idea-card">
            <label className="sr-only" htmlFor="idea-title">Title (optional)</label>
            <input
              id="idea-title"
              className="title-input"
              value={p.title}
              onChange={(e) => p.setTitle(e.target.value)}
              placeholder="Add a title (optional)"
              maxLength={200}
            />
            <label className="sr-only" htmlFor="idea-text">Your idea</label>
            <textarea
              id="idea-text"
              className="idea-input"
              value={p.ideaText}
              maxLength={5000}
              onChange={(e) => p.setIdeaText(e.target.value)}
              placeholder="e.g. The best posts we shipped this year came from one honest observation, written fast. Consistency beats polish."
              autoFocus
            />
            <div className="idea-meta">
              <span className="hint">Links and #hashtags you include are kept.</span>
              {p.ideas.length > 0 && (
                <select
                  className="mini-select"
                  aria-label="Start from a saved idea"
                  value={p.existingIdeaId ?? ""}
                  onChange={(e) => {
                    if (e.target.value === "__more") p.onLoadMoreIdeas();
                    else p.onPickIdea(e.target.value);
                  }}
                >
                  <option value="">Use a saved idea…</option>
                  {p.ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {(i.title || i.text || "Untitled idea").slice(0, 60)}
                    </option>
                  ))}
                  {p.hasMoreIdeas && <option value="__more">{p.loadingIdeas ? "Loading…" : "Show more ideas"}</option>}
                </select>
              )}
            </div>
            {p.existingIdeaId && (
              <p className="hint" style={{ marginTop: "0.6rem" }}>
                Using a saved idea. Your posts will be linked to it. If you change the text, it&apos;s saved as a new idea.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Photo or video</h2>
              <span className="pill">Optional</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="media-url">Link to your image or video</label>
              <input
                id="media-url"
                type="url"
                inputMode="url"
                value={p.mediaUrl}
                onChange={(e) => p.onMediaUrl(e.target.value)}
                placeholder="https://…"
              />
              <span className="hint">Use a direct link that anyone can open. Links to Google Drive or Dropbox pages won&apos;t work.</span>
            </div>
            <AnimatePresence mode="wait">
              {p.mediaState.status === "checking" && (
                <motion.p key="checking" className="media-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="muted">Checking your link…</span>
                </motion.p>
              )}
              {p.mediaState.status === "error" && (
                <motion.p key="error" className="media-status error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Icon name="alert" size={16} /> {p.mediaState.message}
                </motion.p>
              )}
              {p.mediaState.status === "ok" && p.mediaState.media && (
                <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <p className="media-status ok">
                    <Icon name="check" size={16} /> {p.mediaState.media.kind === "video" ? "Video" : "Image"} ready
                  </p>
                  <MediaPreview media={p.mediaState.media} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {p.draftError && (
            <div className="notice error" role="alert" style={{ marginTop: "1rem" }}>
              <Icon name="alert" />
              <div>
                <p>{p.draftError}</p>
                <div className="actions-inline">
                  <button className="btn sm" onClick={p.onRetryDrafts}>Try again</button>
                  <button className="btn quiet sm" onClick={p.onWriteManually}>Write the posts myself</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="side">
          <section className="card">
            <div className="card-head">
              <h2>Post to</h2>
              <button className="btn quiet sm" onClick={p.onRefreshChannels} disabled={p.refreshing} aria-label="Refresh channels">
                <Icon name="refresh" size={16} /> {p.refreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>

            {p.orgs.length > 1 && (
              <div className="field" style={{ marginBottom: "0.8rem" }}>
                <label className="label" htmlFor="org">Buffer workspace</label>
                <select id="org" value={p.orgId} onChange={(e) => p.onOrgChange(e.target.value)}>
                  {p.orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}

            {p.channels.length === 0 ? (
              <div className="notice warn">
                <Icon name="alert" />
                <div>
                  <p>No channels yet. Connect a social account in Buffer, then tap Refresh.</p>
                  <div className="actions-inline">
                    <a className="btn sm" href="https://publish.buffer.com/channels" target="_blank" rel="noreferrer">
                      Open Buffer <Icon name="external" size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="channel-list" role="group" aria-label="Channels">
                  {p.channels.map((c) => {
                    const reason = unavailableReason(c);
                    const selected = p.selected.has(c.id);
                    return (
                      <label key={c.id} className="channel-row" data-selected={selected} data-disabled={!!reason}>
                        <input type="checkbox" checked={selected} disabled={!!reason} onChange={() => p.onToggle(c.id)} />
                        <ChannelIdentity channel={c} sub={reason ?? (c.isQueuePaused ? `${platformFor(c.service).label} · queue paused` : undefined)} />
                        <span className="check" aria-hidden="true">{selected && <Icon name="check" size={13} />}</span>
                      </label>
                    );
                  })}
                </div>
                {usable.length > 1 && (
                  <button className="btn quiet sm" style={{ marginTop: "0.6rem" }} onClick={() => p.onSelectAll(!allSelected)}>
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                )}
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
