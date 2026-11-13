"use client";

import { useEffect, useMemo, useState } from "react";
import { adapt, guessMediaKind } from "@/lib/adapt";
import { profileFor } from "@/lib/platforms";
import { draftWarnings } from "@/lib/post-input";
import type {
  Channel,
  Draft,
  IdeaSummary,
  Media,
  MediaKind,
  Organization,
  PublishRequest,
  PublishResponse,
  SchedulingMode,
} from "@/lib/types";

type Step = "compose" | "review" | "done";

const MODE_LABELS: Record<SchedulingMode, string> = {
  addToQueue: "Add to queue",
  customScheduled: "Schedule for…",
  saveToDraft: "Save as draft",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/?error=" + encodeURIComponent("Your Buffer session expired. Please reconnect.");
    throw new Error("Not connected");
  }
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

function defaultDueAt(): string {
  // Tomorrow 09:00 local, formatted for <input type="datetime-local">.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Cascade() {
  const [step, setStep] = useState<Step>("compose");
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [loadError, setLoadError] = useState("");

  // Compose
  const [title, setTitle] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [existingIdeaId, setExistingIdeaId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeaSummary[] | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState<MediaKind>("image");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Review
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // Done
  const [result, setResult] = useState<PublishResponse | null>(null);

  useEffect(() => {
    api<{ organizations: Organization[] }>("/api/channels")
      .then(({ organizations }) => {
        setOrgs(organizations);
        const first = organizations.find((o) => o.channels.length) ?? organizations[0];
        if (first) setOrgId(first.id);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setIdeas(null);
    api<{ ideas: IdeaSummary[] }>(`/api/ideas?organizationId=${encodeURIComponent(orgId)}`)
      .then(({ ideas }) => setIdeas(ideas))
      .catch(() => setIdeas([]));
  }, [orgId]);

  const org = orgs?.find((o) => o.id === orgId);
  const channels = org?.channels ?? [];
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const media: Media | null = mediaUrl.trim() ? { url: mediaUrl.trim(), kind: mediaKind } : null;
  const mediaUrlInvalid = !!mediaUrl.trim() && !/^https?:\/\/\S+$/i.test(mediaUrl.trim());

  function onMediaUrl(value: string) {
    setMediaUrl(value);
    if (value.trim()) setMediaKind(guessMediaKind(value.trim()));
  }

  function pickIdea(id: string) {
    const idea = ideas?.find((i) => i.id === id);
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

  function generate() {
    const list = channels.filter((c) => selected.has(c.id));
    setDrafts(
      list.map((c) => ({
        channelId: c.id,
        text: adapt(ideaText, c.service),
        includeMedia: !!media,
        mode: "addToQueue",
      })),
    );
    setSendError("");
    setStep("review");
  }

  function updateDraft(channelId: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.channelId === channelId ? { ...d, ...patch } : d)));
  }

  function applyModeToAll(mode: SchedulingMode) {
    setDrafts((prev) =>
      prev.map((d) => ({ ...d, mode, dueAt: mode === "customScheduled" ? d.dueAt ?? defaultDueAt() : d.dueAt })),
    );
  }

  const warnings = useMemo(
    () =>
      new Map(
        drafts.map((d) => {
          const ch = channelById.get(d.channelId);
          return [d.channelId, ch ? draftWarnings(d, ch.service, media) : []];
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, channelById, mediaUrl, mediaKind],
  );
  const blocked = drafts.length === 0 || [...warnings.values()].some((w) => w.length > 0);

  async function send(subset: Draft[], ideaId: string | null) {
    setSending(true);
    setSendError("");
    try {
      const payload: PublishRequest = {
        organizationId: orgId,
        idea: { title, text: ideaText, existingIdeaId: ideaId ?? existingIdeaId ?? undefined },
        media,
        // Convert local datetime to an absolute instant here, in the user's timezone.
        drafts: subset.map((d) => ({
          ...d,
          dueAt: d.mode === "customScheduled" && d.dueAt ? new Date(d.dueAt).toISOString() : undefined,
        })),
      };
      const res = await api<PublishResponse>("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Merge retry results into the previous result.
      setResult((prev) => {
        if (!prev || !ideaId) return res;
        const updated = new Map(prev.posts.map((p) => [p.channelId, p]));
        res.posts.forEach((p) => updated.set(p.channelId, p));
        return { ...prev, posts: [...updated.values()] };
      });
      setStep("done");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("compose");
    setTitle("");
    setIdeaText("");
    setExistingIdeaId(null);
    setMediaUrl("");
    setSelected(new Set());
    setDrafts([]);
    setResult(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◢
          </span>
          Cascade
        </div>
        <nav className="progress" aria-label="Progress">
          {(["compose", "review", "done"] as Step[]).map((s, i) => (
            <span key={s} className={step === s ? "active" : ""}>
              {i + 1}. {s[0].toUpperCase() + s.slice(1)}
            </span>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post">
          <button className="btn ghost small" type="submit">
            Disconnect
          </button>
        </form>
      </header>

      {loadError && <p className="alert error">Couldn’t load your Buffer channels: {loadError}</p>}
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
            {ideas && ideas.length > 0 && (
              <label className="field">
                <span>Start from a saved Buffer Idea (optional)</span>
                <select value={existingIdeaId ?? ""} onChange={(e) => pickIdea(e.target.value)}>
                  <option value="">— Write a new idea —</option>
                  {ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {(i.title || i.text || "Untitled").slice(0, 80)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Title (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A short name for this idea"
              />
            </label>
            <label className="field">
              <span>Idea</span>
              <textarea
                rows={6}
                value={ideaText}
                onChange={(e) => {
                  setIdeaText(e.target.value);
                  if (existingIdeaId) setExistingIdeaId(null);
                }}
                placeholder="Say it once, in your own words. Include links and #hashtags if you like."
              />
            </label>
            {existingIdeaId && (
              <p className="muted small">
                Using a saved Idea. Posts will link to it and no duplicate Idea will be created. Editing the
                text saves it as a new Idea instead.
              </p>
            )}
          </section>

          <section>
            <h2>Media (optional)</h2>
            <div className="media-row">
              <label className="field grow">
                <span>Public image or video URL</span>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => onMediaUrl(e.target.value)}
                  placeholder="https://…/photo.jpg"
                />
              </label>
              <div className="segmented" role="radiogroup" aria-label="Media type">
                {(["image", "video"] as MediaKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={mediaKind === k}
                    className={mediaKind === k ? "on" : ""}
                    onClick={() => setMediaKind(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {mediaUrlInvalid && <p className="alert error">Enter a full http(s) URL.</p>}
            {media && !mediaUrlInvalid && <MediaPreview media={media} />}
            <p className="muted small">Buffer downloads the file from this URL, so it must be publicly reachable.</p>
          </section>

          <section>
            <h2>Channels</h2>
            {channels.length === 0 && (
              <p className="muted">No channels in this organization. Connect one in Buffer first.</p>
            )}
            <div className="channel-grid">
              {channels.map((c) => {
                const unavailable = c.isDisconnected || c.isLocked;
                return (
                  <label
                    key={c.id}
                    className={`channel ${selected.has(c.id) ? "selected" : ""} ${unavailable ? "disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={unavailable}
                      onChange={() => toggle(c.id)}
                    />
                    <ChannelBadge channel={c} />
                    {unavailable && (
                      <span className="tag warn">{c.isDisconnected ? "Disconnected" : "Locked"}</span>
                    )}
                    {!unavailable && c.isQueuePaused && <span className="tag">Queue paused</span>}
                  </label>
                );
              })}
            </div>
            {channels.length > 1 && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() =>
                  setSelected(
                    selected.size
                      ? new Set()
                      : new Set(channels.filter((c) => !c.isDisconnected && !c.isLocked).map((c) => c.id)),
                  )
                }
              >
                {selected.size ? "Clear selection" : "Select all"}
              </button>
            )}
          </section>

          <div className="actions">
            <button
              className="btn primary"
              disabled={!ideaText.trim() || selected.size === 0 || mediaUrlInvalid}
              onClick={generate}
            >
              Create {selected.size || ""} draft{selected.size === 1 ? "" : "s"} →
            </button>
          </div>
        </main>
      )}

      {step === "review" && (
        <main className="panel wide">
          <div className="review-head">
            <div>
              <h2>Review drafts</h2>
              <p className="muted small">Edit anything. Each post is sent to its channel exactly as shown.</p>
            </div>
            <div className="bulk">
              <span className="muted small">Set all to:</span>
              {(Object.keys(MODE_LABELS) as SchedulingMode[]).map((m) => (
                <button key={m} className="btn ghost small" onClick={() => applyModeToAll(m)}>
                  {MODE_LABELS[m].replace("…", "")}
                </button>
              ))}
            </div>
          </div>

          <div className="drafts">
            {drafts.map((d) => {
              const ch = channelById.get(d.channelId);
              if (!ch) return null;
              const p = profileFor(ch.service);
              const w = warnings.get(d.channelId) ?? [];
              return (
                <article key={d.channelId} className="draft">
                  <div className="draft-head">
                    <ChannelBadge channel={ch} />
                    <button
                      className="btn ghost small"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.channelId !== d.channelId))}
                      aria-label={`Remove ${ch.name}`}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={Math.min(16, Math.max(5, d.text.split("\n").length + Math.ceil(d.text.length / 48)))}
                    value={d.text}
                    onChange={(e) => updateDraft(d.channelId, { text: e.target.value })}
                  />
                  <div className="draft-meta">
                    <span className={d.text.length > p.limit ? "over" : "muted"}>
                      {d.text.length}/{p.limit}
                    </span>
                    <button
                      className="link"
                      onClick={() => updateDraft(d.channelId, { text: adapt(ideaText, ch.service) })}
                    >
                      Reset to suggestion
                    </button>
                  </div>

                  {media && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={d.includeMedia}
                        onChange={(e) => updateDraft(d.channelId, { includeMedia: e.target.checked })}
                      />
                      Attach {media.kind}
                      {d.includeMedia && <MediaPreview media={media} compact />}
                    </label>
                  )}

                  <div className="schedule">
                    <select
                      value={d.mode}
                      onChange={(e) => {
                        const mode = e.target.value as SchedulingMode;
                        updateDraft(d.channelId, {
                          mode,
                          dueAt: mode === "customScheduled" ? d.dueAt ?? defaultDueAt() : d.dueAt,
                        });
                      }}
                    >
                      {(Object.keys(MODE_LABELS) as SchedulingMode[]).map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    {d.mode === "customScheduled" && (
                      <input
                        type="datetime-local"
                        value={d.dueAt ?? ""}
                        onChange={(e) => updateDraft(d.channelId, { dueAt: e.target.value })}
                      />
                    )}
                  </div>
                  {d.mode === "customScheduled" && (
                    <p className="muted small">Your local time. Channel timezone: {ch.timezone}</p>
                  )}

                  {w.length > 0 && (
                    <ul className="warnings">
                      {w.map((x) => (
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
              {sending ? "Sending…" : `Save idea & send ${drafts.length} post${drafts.length === 1 ? "" : "s"} to Buffer`}
            </button>
          </div>
          {blocked && drafts.length > 0 && (
            <p className="muted small right">Fix the highlighted drafts (or remove them) to continue.</p>
          )}
        </main>
      )}

      {step === "done" && result && (
        <main className="panel">
          <DoneView
            result={result}
            channelById={channelById}
            sending={sending}
            onRetry={() => {
              const failed = new Set(result.posts.filter((p) => !p.ok).map((p) => p.channelId));
              send(
                drafts.filter((d) => failed.has(d.channelId)),
                result.ideaId,
              );
            }}
            onEdit={() => {
              // Only failed posts go back to review, so successful ones are never duplicated.
              const failed = new Set(result.posts.filter((p) => !p.ok).map((p) => p.channelId));
              setDrafts((prev) => prev.filter((d) => failed.has(d.channelId)));
              setStep("review");
            }}
            onNew={reset}
          />
          {sendError && <p className="alert error">{sendError}</p>}
        </main>
      )}
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
        <span className="muted small">{profileFor(channel.service).label}</span>
      </span>
    </span>
  );
}

function MediaPreview({ media, compact }: { media: Media; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [media.url, media.kind]);
  if (failed) {
    return (
      <p className="alert warn small">
        Couldn’t preview this {media.kind}. Make sure the URL is public and points directly to the file.
      </p>
    );
  }
  return (
    <div className={`preview ${compact ? "compact" : ""}`}>
      {media.kind === "video" ? (
        <video src={media.url} controls={!compact} muted onError={() => setFailed(true)} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Media preview" onError={() => setFailed(true)} />
      )}
    </div>
  );
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
  const ok = result.posts.filter((p) => p.ok).length;
  const failed = result.posts.length - ok;
  return (
    <>
      <h2>{failed === 0 ? "All set 🎉" : ok === 0 ? "Nothing was sent" : "Partly sent"}</h2>
      <p className="lede">
        {ok} of {result.posts.length} post{result.posts.length === 1 ? "" : "s"} created in Buffer.
      </p>
      <p className={result.ideaId ? "alert ok" : "alert warn"}>
        {result.ideaId
          ? "Your original idea is saved in Buffer Ideas and every post is linked to it."
          : `The idea couldn’t be saved${result.ideaError ? `: ${result.ideaError}` : "."} Posts were still sent.`}
      </p>
      <ul className="results">
        {result.posts.map((p) => {
          const ch = channelById.get(p.channelId);
          return (
            <li key={p.channelId} className={p.ok ? "ok" : "fail"}>
              {ch ? <ChannelBadge channel={ch} /> : p.channelId}
              <span>
                {p.ok
                  ? `${p.status ?? "created"}${p.dueAt && p.status !== "draft" ? ` · ${new Date(p.dueAt).toLocaleString()}` : ""}`
                  : p.error}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        {failed > 0 && (
          <>
            <button className="btn ghost" onClick={onEdit} disabled={sending}>
              Edit drafts
            </button>
            <button className="btn ghost" onClick={onRetry} disabled={sending}>
              {sending ? "Retrying…" : `Retry ${failed} failed`}
            </button>
          </>
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
