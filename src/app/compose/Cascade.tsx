"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { platformFor } from "@/lib/platforms";
import { checkDraft } from "@/lib/post-input";
import { defaultLocalSlot } from "@/lib/schedule";
import type {
  AdaptedDraft,
  Channel,
  Draft,
  FeedPostType,
  IdeaSummary,
  Media,
  Organization,
  PostResult,
  PublishRequest,
  PublishResponse,
  SchedulingMode,
  YoutubePrivacy,
} from "@/lib/types";

type Step = "compose" | "review" | "done";

const MODE_LABELS: Record<SchedulingMode, string> = {
  addToQueue: "Add to queue",
  customScheduled: "Pick a time",
  saveToDraft: "Save as draft",
};

interface MediaState {
  status: "idle" | "checking" | "ok" | "error";
  media?: Media;
  message?: string;
}

class ApiCallError extends Error {}

async function api<T>(url: string, init: RequestInit | undefined, onRateLimitLow: () => void): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/?error=session_expired";
    throw new ApiCallError("Your Buffer connection expired.");
  }
  if (!res.ok) throw new ApiCallError(json.error ?? `Request failed (${res.status}).`);
  if (json.rateLimitLow) onRateLimitLow();
  return json as T;
}

function draftFrom(a: AdaptedDraft, channel: Channel, media: Media | null): Draft {
  const boards = channel.pinterestBoards ?? [];
  return {
    channelId: a.channelId,
    text: a.text,
    title: a.title ?? undefined,
    includeMedia: !!media,
    mode: "addToQueue",
    options: {
      instagramType: channel.service === "instagram" ? (media?.kind === "video" ? "reel" : "post") : undefined,
      facebookType: channel.service === "facebook" ? "post" : undefined,
      // Only preselect a board when there's exactly one; otherwise the user chooses.
      pinterestBoardId: boards.length === 1 ? boards[0].serviceId : undefined,
    },
  };
}

export default function Cascade() {
  const [step, setStep] = useState<Step>("compose");
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [rateLimitLow, setRateLimitLow] = useState(false);
  const flagLow = () => setRateLimitLow(true);

  // Compose
  const [title, setTitle] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [existingIdeaId, setExistingIdeaId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [ideasCursor, setIdeasCursor] = useState<string | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaState, setMediaState] = useState<MediaState>({ status: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Review
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [overLimit, setOverLimit] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // Done
  const [result, setResult] = useState<PublishResponse | null>(null);

  async function loadChannels(refresh = false) {
    setRefreshing(true);
    try {
      const { organizations } = await api<{ organizations: Organization[] }>(
        `/api/channels${refresh ? "?refresh=1" : ""}`,
        undefined,
        flagLow,
      );
      setOrgs(organizations);
      setLoadError("");
      setOrgId((current) =>
        organizations.some((o) => o.id === current) ? current : (organizations.find((o) => o.channels.length) ?? organizations[0])?.id ?? "",
      );
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadIdeas(reset: boolean) {
    if (!orgId) return;
    setIdeasLoading(true);
    try {
      const after = reset ? "" : ideasCursor ? `&after=${encodeURIComponent(ideasCursor)}` : "";
      const res = await api<{ ideas: IdeaSummary[]; nextCursor: string | null }>(
        `/api/ideas?organizationId=${encodeURIComponent(orgId)}${after}`,
        undefined,
        flagLow,
      );
      setIdeas((prev) => (reset ? res.ideas : [...prev, ...res.ideas]));
      setIdeasCursor(res.nextCursor);
    } catch {
      if (reset) setIdeas([]);
    } finally {
      setIdeasLoading(false);
    }
  }

  useEffect(() => {
    setIdeas([]);
    setIdeasCursor(null);
    loadIdeas(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const org = orgs?.find((o) => o.id === orgId);
  const channels = useMemo(() => org?.channels ?? [], [org]);
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const media = mediaState.status === "ok" ? mediaState.media! : null;

  // ---- Media check (server verifies public, direct, HTTPS and detects the type) ----
  const mediaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onMediaUrl(value: string) {
    setMediaUrl(value);
    if (mediaTimer.current) clearTimeout(mediaTimer.current);
    if (!value.trim()) {
      setMediaState({ status: "idle" });
      return;
    }
    setMediaState({ status: "checking" });
    mediaTimer.current = setTimeout(async () => {
      try {
        const res = await api<{ ok: boolean; kind?: "image" | "video"; message?: string }>(
          "/api/media",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value.trim() }) },
          flagLow,
        );
        setMediaState(
          res.ok ? { status: "ok", media: { url: value.trim(), kind: res.kind! } } : { status: "error", message: res.message },
        );
      } catch (e) {
        setMediaState({ status: "error", message: (e as Error).message });
      }
    }, 600);
  }

  function pickIdea(id: string) {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) {
      setExistingIdeaId(null);
      return;
    }
    setExistingIdeaId(idea.id);
    setTitle(idea.title ?? "");
    setIdeaText(idea.text ?? "");
    if (idea.mediaUrl) onMediaUrl(idea.mediaUrl);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const usable = (c: Channel) => !c.isDisconnected && !c.isLocked && platformFor(c.service).supported;

  async function adapt(channelIds: string[]): Promise<AdaptedDraft[]> {
    const { drafts } = await api<{ drafts: AdaptedDraft[] }>(
      "/api/adapt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, idea: ideaText, title, media, channelIds }),
      },
      flagLow,
    );
    return drafts;
  }

  async function generate() {
    const ids = channels.filter((c) => selected.has(c.id) && usable(c)).map((c) => c.id);
    setDrafting(true);
    setDraftError("");
    try {
      const adapted = await adapt(ids);
      setDrafts(adapted.map((a) => draftFrom(a, channelById.get(a.channelId)!, media)));
      setOverLimit(new Set(adapted.filter((a) => a.overLimit).map((a) => a.channelId)));
      setSendError("");
      setStep("review");
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  function writeManually() {
    const ids = channels.filter((c) => selected.has(c.id) && usable(c)).map((c) => c.id);
    setDrafts(ids.map((id) => draftFrom({ channelId: id, text: ideaText, title: title || null }, channelById.get(id)!, media)));
    setOverLimit(new Set());
    setStep("review");
  }

  async function regenerate(channelId: string) {
    setRegenerating(channelId);
    try {
      const [a] = await adapt([channelId]);
      updateDraft(channelId, { text: a.text, title: a.title ?? undefined });
      setOverLimit((prev) => {
        const next = new Set(prev);
        if (a.overLimit) next.add(channelId);
        else next.delete(channelId);
        return next;
      });
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setRegenerating(null);
    }
  }

  function updateDraft(channelId: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.channelId === channelId ? { ...d, ...patch } : d)));
  }

  function setMode(d: Draft, mode: SchedulingMode) {
    const ch = channelById.get(d.channelId)!;
    updateDraft(d.channelId, { mode, dueLocal: mode === "customScheduled" ? d.dueLocal ?? defaultLocalSlot(ch.timezone) : d.dueLocal });
  }

  const checks = useMemo(
    () =>
      new Map(
        drafts.map((d) => {
          const ch = channelById.get(d.channelId);
          return [d.channelId, ch ? checkDraft(d, ch, media) : { count: 0, limit: 0, errors: ["Channel not found."] }];
        }),
      ),
    [drafts, channelById, media],
  );
  const blocked = drafts.length === 0 || [...checks.values()].some((c) => c.errors.length > 0);

  async function send(subset: Draft[], ideaId: string | null) {
    setSending(true);
    setSendError("");
    try {
      const payload: PublishRequest = {
        organizationId: orgId,
        idea: { title, text: ideaText, existingIdeaId: ideaId ?? existingIdeaId ?? undefined },
        media,
        drafts: subset,
      };
      const res = await api<PublishResponse>(
        "/api/publish",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        flagLow,
      );
      setResult((prev) => {
        if (!prev || !ideaId) return res;
        const merged = new Map(prev.posts.map((p) => [p.channelId, p]));
        res.posts.forEach((p) => merged.set(p.channelId, p));
        return { ...prev, posts: [...merged.values()] };
      });
      setStep("done");
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("compose");
    setTitle("");
    setIdeaText("");
    setExistingIdeaId(null);
    onMediaUrl("");
    setSelected(new Set());
    setDrafts([]);
    setResult(null);
    setDraftError("");
    setSendError("");
  }

  const selectedUsable = channels.filter((c) => selected.has(c.id) && usable(c));
  const canGenerate = ideaText.trim() && selectedUsable.length > 0 && mediaState.status !== "checking" && mediaState.status !== "error";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ≋
          </span>
          Cascade
        </div>
        <nav className="progress" aria-label="Progress">
          {(["compose", "review", "done"] as Step[]).map((s, i) => (
            <span key={s} className={step === s ? "active" : ""} aria-current={step === s ? "step" : undefined}>
              {i + 1}. {s === "compose" ? "Idea" : s === "review" ? "Review" : "Done"}
            </span>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post">
          <button className="btn ghost small" type="submit">
            Disconnect
          </button>
        </form>
      </header>

      {rateLimitLow && (
        <p className="alert warn">Cascade is close to its Buffer request limit. Sending may be paused briefly.</p>
      )}
      {loadError && (
        <p className="alert error">
          {loadError}{" "}
          <button className="link" onClick={() => loadChannels(true)}>
            Try again
          </button>
        </p>
      )}
      {!orgs && !loadError && <p className="muted center">Loading your Buffer channels…</p>}

      {orgs && step === "compose" && (
        <main className="panel">
          {orgs.length > 1 && (
            <label className="field">
              <span>Organization</span>
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setSelected(new Set());
                  setExistingIdeaId(null);
                }}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <section>
            <h2>Your idea</h2>
            {ideas.length > 0 && (
              <div className="field">
                <label htmlFor="saved-idea">Start from a saved Buffer Idea (optional)</label>
                <select id="saved-idea" value={existingIdeaId ?? ""} onChange={(e) => pickIdea(e.target.value)}>
                  <option value="">Write a new idea</option>
                  {ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {(i.title || i.text || "Untitled").slice(0, 80)}
                    </option>
                  ))}
                </select>
                {ideasCursor && (
                  <button className="link left" onClick={() => loadIdeas(false)} disabled={ideasLoading}>
                    {ideasLoading ? "Loading…" : "Load more Ideas"}
                  </button>
                )}
              </div>
            )}
            <label className="field">
              <span>Title (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short name for this idea" maxLength={200} />
            </label>
            <label className="field">
              <span>Idea</span>
              <textarea
                rows={6}
                value={ideaText}
                maxLength={5000}
                onChange={(e) => {
                  setIdeaText(e.target.value);
                  if (existingIdeaId) setExistingIdeaId(null);
                }}
                placeholder="Say it once, in your own words. Include any links and #hashtags you want kept."
              />
            </label>
            {existingIdeaId && (
              <p className="muted small">
                Using a saved Idea: posts will link to it and no duplicate Idea is created. Editing the text saves it as a new Idea.
              </p>
            )}
          </section>

          <section>
            <h2>Media (optional)</h2>
            <label className="field">
              <span>Public image or video URL</span>
              <input type="url" inputMode="url" value={mediaUrl} onChange={(e) => onMediaUrl(e.target.value)} placeholder="https://…" />
            </label>
            {mediaState.status === "checking" && <p className="muted small">Checking that Buffer can fetch this file…</p>}
            {mediaState.status === "error" && <p className="alert error">{mediaState.message}</p>}
            {media && (
              <>
                <p className="alert ok small">Looks good: a public {media.kind} Buffer can fetch.</p>
                <MediaPreview media={media} />
              </>
            )}
            <p className="muted small">
              Buffer downloads the file when the post goes out, so the link must be public, direct (not a share page), HTTPS, and must not expire.
            </p>
          </section>

          <section>
            <div className="section-head">
              <h2>Channels</h2>
              <button className="link" onClick={() => loadChannels(true)} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "Refresh channels"}
              </button>
            </div>
            {channels.length === 0 && <p className="muted">No channels in this organization yet. Connect one in Buffer, then refresh.</p>}
            <div className="channel-grid">
              {channels.map((c) => {
                const p = platformFor(c.service);
                const reason = !p.supported ? "Not supported" : c.isDisconnected ? "Disconnected" : c.isLocked ? "Locked" : null;
                return (
                  <label key={c.id} className={`channel ${selected.has(c.id) ? "selected" : ""} ${reason ? "disabled" : ""}`}>
                    <input type="checkbox" checked={selected.has(c.id)} disabled={!!reason} onChange={() => toggle(c.id)} />
                    <ChannelBadge channel={c} />
                    {reason && <span className="tag warn">{reason}</span>}
                    {!reason && c.isQueuePaused && <span className="tag">Queue paused</span>}
                  </label>
                );
              })}
            </div>
            {channels.filter(usable).length > 1 && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setSelected(selected.size ? new Set() : new Set(channels.filter(usable).map((c) => c.id)))}
              >
                {selected.size ? "Clear selection" : "Select all"}
              </button>
            )}
          </section>

          {draftError && (
            <div className="alert error">
              <p>{draftError}</p>
              <div className="inline-actions">
                <button className="btn small" onClick={generate} disabled={drafting}>
                  Try again
                </button>
                <button className="btn ghost small" onClick={writeManually}>
                  Write the drafts myself
                </button>
              </div>
            </div>
          )}

          <div className="actions">
            <button className="btn primary" disabled={!canGenerate || drafting} onClick={generate}>
              {drafting
                ? `Adapting for ${selectedUsable.length} channel${selectedUsable.length === 1 ? "" : "s"}…`
                : `Adapt for ${selectedUsable.length || ""} channel${selectedUsable.length === 1 ? "" : "s"} →`}
            </button>
          </div>
        </main>
      )}

      {step === "review" && (
        <main className="panel wide">
          <div className="review-head">
            <div>
              <h2>Review drafts</h2>
              <p className="muted small">Each post goes to its channel exactly as shown. Edit anything.</p>
            </div>
            <div className="bulk">
              <span className="muted small">Set all to:</span>
              {(Object.keys(MODE_LABELS) as SchedulingMode[]).map((m) => (
                <button key={m} className="btn ghost small" onClick={() => drafts.forEach((d) => setMode(d, m))}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="drafts">
            {drafts.map((d) => {
              const ch = channelById.get(d.channelId);
              if (!ch) return null;
              const p = platformFor(ch.service);
              const check = checks.get(d.channelId)!;
              const busy = regenerating === d.channelId;
              return (
                <article key={d.channelId} className={`draft ${check.errors.length ? "has-errors" : ""}`}>
                  <div className="draft-head">
                    <ChannelBadge channel={ch} />
                    <button
                      className="btn ghost small"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.channelId !== d.channelId))}
                      aria-label={`Remove ${ch.displayName || ch.name}`}
                    >
                      Remove
                    </button>
                  </div>

                  {p.title && (
                    <label className="field compact">
                      <span>Title{p.title === "optional" ? " (optional)" : ""}</span>
                      <input value={d.title ?? ""} maxLength={150} onChange={(e) => updateDraft(d.channelId, { title: e.target.value })} />
                    </label>
                  )}

                  <textarea
                    aria-label={`Post text for ${ch.displayName || ch.name}`}
                    rows={Math.min(16, Math.max(5, d.text.split("\n").length + Math.ceil(d.text.length / 48)))}
                    value={d.text}
                    onChange={(e) => updateDraft(d.channelId, { text: e.target.value })}
                  />
                  <div className="draft-meta">
                    <span className={check.count > check.limit ? "over" : "muted"}>
                      {check.count.toLocaleString()}/{check.limit.toLocaleString()}
                    </span>
                    <button className="link" onClick={() => regenerate(d.channelId)} disabled={busy}>
                      {busy ? "Rewriting…" : "Regenerate"}
                    </button>
                  </div>
                  {overLimit.has(d.channelId) && (
                    <p className="muted small">The AI couldn&apos;t fit this under the limit. Please shorten it.</p>
                  )}

                  {media && (
                    <label className="check">
                      <input type="checkbox" checked={d.includeMedia} onChange={(e) => updateDraft(d.channelId, { includeMedia: e.target.checked })} />
                      Attach {media.kind}
                      {d.includeMedia && <MediaPreview media={media} compact />}
                    </label>
                  )}

                  {(ch.service === "instagram" || ch.service === "facebook") && d.includeMedia && media && (
                    <label className="field compact">
                      <span>Post as</span>
                      <select
                        value={(ch.service === "instagram" ? d.options.instagramType : d.options.facebookType) ?? "post"}
                        onChange={(e) =>
                          updateDraft(d.channelId, {
                            options: {
                              ...d.options,
                              [ch.service === "instagram" ? "instagramType" : "facebookType"]: e.target.value as FeedPostType,
                            },
                          })
                        }
                      >
                        <option value="post">Post</option>
                        <option value="reel">Reel</option>
                        <option value="story">Story</option>
                      </select>
                    </label>
                  )}

                  {ch.service === "pinterest" && (
                    <label className="field compact">
                      <span>Board</span>
                      <select
                        value={d.options.pinterestBoardId ?? ""}
                        onChange={(e) => updateDraft(d.channelId, { options: { ...d.options, pinterestBoardId: e.target.value || undefined } })}
                      >
                        <option value="">Choose a board</option>
                        {(ch.pinterestBoards ?? []).map((b) => (
                          <option key={b.serviceId} value={b.serviceId}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {ch.service === "youtube" && (
                    <label className="field compact">
                      <span>Visibility</span>
                      <select
                        value={d.options.youtubePrivacy ?? ""}
                        onChange={(e) =>
                          updateDraft(d.channelId, {
                            options: { ...d.options, youtubePrivacy: (e.target.value || undefined) as YoutubePrivacy | undefined },
                          })
                        }
                      >
                        <option value="">Buffer default</option>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    </label>
                  )}

                  <div className="schedule">
                    <select aria-label="Scheduling" value={d.mode} onChange={(e) => setMode(d, e.target.value as SchedulingMode)}>
                      {(Object.keys(MODE_LABELS) as SchedulingMode[]).map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    {d.mode === "customScheduled" && (
                      <input
                        type="datetime-local"
                        aria-label="Date and time"
                        value={d.dueLocal ?? ""}
                        onChange={(e) => updateDraft(d.channelId, { dueLocal: e.target.value })}
                      />
                    )}
                  </div>
                  {d.mode === "customScheduled" && <p className="muted small">Time in this channel&apos;s timezone ({ch.timezone}).</p>}
                  {d.mode === "addToQueue" && <p className="muted small">Goes into the next open slot in this channel&apos;s Buffer schedule.</p>}
                  {d.mode === "saveToDraft" && <p className="muted small">Saved as a draft in Buffer; it won&apos;t publish.</p>}

                  {check.errors.length > 0 && (
                    <ul className="warnings">
                      {check.errors.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>

          {sendError && <p className="alert error">{sendError}</p>}
          <div className="actions">
            <button className="btn ghost" onClick={() => setStep("compose")} disabled={sending}>
              ← Back
            </button>
            <button className="btn primary" disabled={blocked || sending} onClick={() => send(drafts, result?.ideaId ?? null)}>
              {sending ? "Sending to Buffer…" : `Save idea & send ${drafts.length} post${drafts.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {blocked && drafts.length > 0 && <p className="muted small right">Fix the highlighted drafts (or remove them) to continue.</p>}
        </main>
      )}

      {step === "done" && result && (
        <main className="panel">
          <DoneView
            result={result}
            channelById={channelById}
            sending={sending}
            onRetry={() => {
              const failed = new Set(result.posts.filter((p) => p.outcome === "failed").map((p) => p.channelId));
              send(drafts.filter((d) => failed.has(d.channelId)), result.ideaId);
            }}
            onEdit={() => {
              // Only posts that weren't created go back to review, so nothing is duplicated.
              const pending = new Set(result.posts.filter((p) => p.outcome !== "created").map((p) => p.channelId));
              setDrafts((prev) => prev.filter((d) => pending.has(d.channelId)));
              setStep("review");
            }}
            onNew={reset}
          />
          {sendError && <p className="alert error">{sendError}</p>}
        </main>
      )}

      <footer className="footer muted small">
        Built on the Buffer API · <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span className="badge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={channel.avatar} alt="" width={32} height={32} />
      <span>
        <strong>{channel.displayName || channel.name}</strong>
        <span className="muted small">{platformFor(channel.service).label}</span>
      </span>
    </span>
  );
}

function MediaPreview({ media, compact }: { media: Media; compact?: boolean }) {
  return (
    <div className={`preview ${compact ? "compact" : ""}`}>
      {media.kind === "video" ? (
        <video src={media.url} controls={!compact} muted preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Media preview" />
      )}
    </div>
  );
}

function outcomeText(p: PostResult): string {
  if (p.outcome === "created") {
    const when = p.dueAt && p.status !== "draft" ? ` · ${new Date(p.dueAt).toLocaleString()}` : "";
    return `${p.status === "draft" ? "Saved as draft" : p.status === "scheduled" ? "Scheduled" : p.status ?? "Created"}${when}`;
  }
  return p.message ?? "Not created.";
}

function DoneView({
  result,
  channelById,
  sending,
  onRetry,
  onEdit,
  onNew,
}: {
  result: PublishResponse;
  channelById: Map<string, Channel>;
  sending: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onNew: () => void;
}) {
  const created = result.posts.filter((p) => p.outcome === "created").length;
  const failed = result.posts.filter((p) => p.outcome === "failed").length;
  const unknown = result.posts.filter((p) => p.outcome === "unknown").length;
  return (
    <>
      <h2>{created === result.posts.length ? "All set" : created === 0 ? "Nothing was created" : "Partly done"}</h2>
      <p className="lede">
        {created} of {result.posts.length} post{result.posts.length === 1 ? "" : "s"} created in Buffer.
      </p>
      <p className={result.ideaId ? "alert ok" : "alert warn"}>
        {result.ideaId
          ? "Your original idea is saved in Buffer Ideas and the posts are linked to it."
          : `${result.ideaMessage ?? "The idea wasn't saved."} Posts were still sent.`}
      </p>
      <ul className="results">
        {result.posts.map((p) => {
          const ch = channelById.get(p.channelId);
          return (
            <li key={p.channelId} className={p.outcome}>
              {ch ? <ChannelBadge channel={ch} /> : p.channelId}
              <span>{outcomeText(p)}</span>
            </li>
          );
        })}
      </ul>
      {unknown > 0 && (
        <p className="alert warn small">
          Check {unknown === 1 ? "that channel" : "those channels"} in Buffer before retrying, so nothing is posted twice.
        </p>
      )}
      <div className="actions">
        {(failed > 0 || unknown > 0) && (
          <button className="btn ghost" onClick={onEdit} disabled={sending}>
            Edit &amp; retry
          </button>
        )}
        {failed > 0 && (
          <button className="btn ghost" onClick={onRetry} disabled={sending}>
            {sending ? "Retrying…" : `Retry ${failed} failed`}
          </button>
        )}
        <a className="btn ghost" href="https://publish.buffer.com" target="_blank" rel="noreferrer">
          Open Buffer ↗
        </a>
        <button className="btn primary" onClick={onNew}>
          New idea
        </button>
      </div>
    </>
  );
}
