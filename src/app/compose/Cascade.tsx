"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { checkDraft } from "@/lib/post-input";
import { defaultLocalSlot } from "@/lib/schedule";
import type { AdaptedDraft, Channel, Draft, IdeaSummary, Media, Organization, PublishRequest, PublishResponse, SchedulingMode } from "@/lib/types";
import { api, setLowQuotaListener } from "./api";
import { ComposeStep, unavailableReason } from "./ComposeStep";
import { DoneStep } from "./DoneStep";
import { DraftingOverlay } from "./DraftingOverlay";
import { ReviewStep } from "./ReviewStep";
import { Icon, Stepper, type Step } from "./ui";
import { useMediaCheck } from "./useMediaCheck";

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
      pinterestBoardId: boards.length === 1 ? boards[0].serviceId : undefined,
    },
  };
}

const pageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const },
};

export default function Cascade() {
  const [step, setStep] = useState<Step>("compose");
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lowQuota, setLowQuota] = useState(false);
  useEffect(() => setLowQuotaListener(() => setLowQuota(true)), []);

  // Idea
  const [title, setTitle] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [existingIdeaId, setExistingIdeaId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [ideasCursor, setIdeasCursor] = useState<string | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const mediaCheck = useMediaCheck();
  const media = mediaCheck.media;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drafts
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [struggling, setStruggling] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [result, setResult] = useState<PublishResponse | null>(null);

  const loadChannels = useCallback(async (refresh = false) => {
    setRefreshing(true);
    try {
      const { organizations } = await api<{ organizations: Organization[] }>(`/api/channels${refresh ? "?refresh=1" : ""}`);
      setOrgs(organizations);
      setLoadError("");
      setOrgId((cur) => (organizations.some((o) => o.id === cur) ? cur : (organizations.find((o) => o.channels.length) ?? organizations[0])?.id ?? ""));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => void loadChannels(), [loadChannels]);

  const loadIdeas = useCallback(
    async (reset: boolean, cursor: string | null) => {
      if (!orgId) return;
      setLoadingIdeas(true);
      try {
        const after = !reset && cursor ? `&after=${encodeURIComponent(cursor)}` : "";
        const res = await api<{ ideas: IdeaSummary[]; nextCursor: string | null }>(`/api/ideas?organizationId=${encodeURIComponent(orgId)}${after}`);
        setIdeas((prev) => (reset ? res.ideas : [...prev, ...res.ideas]));
        setIdeasCursor(res.nextCursor);
      } catch {
        if (reset) setIdeas([]);
      } finally {
        setLoadingIdeas(false);
      }
    },
    [orgId],
  );
  useEffect(() => void loadIdeas(true, null), [loadIdeas]);

  const org = orgs?.find((o) => o.id === orgId);
  const channels = useMemo(() => org?.channels ?? [], [org]);
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const chosen = channels.filter((c) => selected.has(c.id) && !unavailableReason(c));

  function pickIdea(id: string) {
    const idea = ideas.find((i) => i.id === id);
    setExistingIdeaId(idea?.id ?? null);
    if (!idea) return;
    setTitle(idea.title ?? "");
    setIdeaText(idea.text ?? "");
    if (idea.mediaUrl) mediaCheck.change(idea.mediaUrl);
  }

  async function adapt(ids: string[]) {
    const { drafts } = await api<{ drafts: AdaptedDraft[] }>("/api/adapt", { organizationId: orgId, idea: ideaText, title, media, channelIds: ids });
    return drafts;
  }

  async function createDrafts() {
    setDrafting(true);
    setDraftError("");
    const started = Date.now();
    try {
      const adapted = await adapt(chosen.map((c) => c.id));
      // Let the animation breathe a moment so the transition doesn't feel abrupt.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      setDrafts(adapted.map((a) => draftFrom(a, channelById.get(a.channelId)!, media)));
      setStruggling(new Set(adapted.filter((a) => a.overLimit).map((a) => a.channelId)));
      setSendError("");
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  function writeManually() {
    setDrafts(chosen.map((c) => draftFrom({ channelId: c.id, text: ideaText, title: title || null }, c, media)));
    setStruggling(new Set());
    setDraftError("");
    setStep("review");
  }

  async function regenerate(channelId: string) {
    setRegenerating(channelId);
    try {
      const [a] = await adapt([channelId]);
      updateDraft(channelId, { text: a.text, title: a.title ?? undefined });
      setStruggling((prev) => {
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
    () => new Map(drafts.filter((d) => channelById.has(d.channelId)).map((d) => [d.channelId, checkDraft(d, channelById.get(d.channelId)!, media)])),
    [drafts, channelById, media],
  );
  const issues = [...checks.values()].filter((c) => c.errors.length).length;

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
      const res = await api<PublishResponse>("/api/publish", payload);
      setResult((prev) => {
        if (!prev || !ideaId) return res;
        const merged = new Map(prev.posts.map((p) => [p.channelId, p]));
        res.posts.forEach((p) => merged.set(p.channelId, p));
        return { ...prev, posts: [...merged.values()] };
      });
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    setStep("compose");
    setTitle("");
    setIdeaText("");
    setExistingIdeaId(null);
    mediaCheck.clear();
    setSelected(new Set());
    setDrafts([]);
    setResult(null);
    setDraftError("");
    setSendError("");
  }

  const modeSummary = (() => {
    const n = (m: SchedulingMode) => drafts.filter((d) => d.mode === m).length;
    return [n("addToQueue") && `${n("addToQueue")} queued`, n("customScheduled") && `${n("customScheduled")} scheduled`, n("saveToDraft") && `${n("saveToDraft")} as drafts`]
      .filter(Boolean)
      .join(" · ");
  })();

  const canCreate = ideaText.trim().length > 0 && chosen.length > 0 && !["checking", "uploading", "error"].includes(mediaCheck.state.status);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo size={28} />
          <Stepper step={step} />
          <form action="/api/auth/logout" method="post">
            <button className="btn quiet sm" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <main className="main">
        {lowQuota && (
          <p className="notice warn" style={{ marginBottom: "1rem" }}>
            <Icon name="alert" /> Lots of people are using Cascade right now. If something doesn&apos;t send, wait a few minutes and try again.
          </p>
        )}
        {loadError && (
          <div className="notice error" role="alert">
            <Icon name="alert" />
            <div>
              <p>{loadError}</p>
              <div className="actions-inline">
                <button className="btn sm" onClick={() => loadChannels(true)}>Try again</button>
              </div>
            </div>
          </div>
        )}
        {!orgs && !loadError && (
          <div className="compose-grid" aria-busy="true" aria-label="Loading your channels">
            <div className="skeleton" style={{ height: "16rem" }} />
            <div className="skeleton" style={{ height: "16rem" }} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {orgs && step === "compose" && (
            <motion.div key="compose" {...pageMotion}>
              <ComposeStep
                orgs={orgs}
                orgId={orgId}
                onOrgChange={(id) => {
                  setOrgId(id);
                  setSelected(new Set());
                  setExistingIdeaId(null);
                }}
                channels={channels}
                refreshing={refreshing}
                onRefreshChannels={() => loadChannels(true)}
                title={title}
                setTitle={setTitle}
                ideaText={ideaText}
                setIdeaText={(v) => {
                  setIdeaText(v);
                  if (existingIdeaId) setExistingIdeaId(null);
                }}
                ideas={ideas}
                hasMoreIdeas={!!ideasCursor}
                loadingIdeas={loadingIdeas}
                onLoadMoreIdeas={() => loadIdeas(false, ideasCursor)}
                existingIdeaId={existingIdeaId}
                onPickIdea={pickIdea}
                mediaUrl={mediaCheck.url}
                onMediaUrl={mediaCheck.change}
                mediaState={mediaCheck.state}
                canUpload={mediaCheck.canUpload}
                onMediaFile={mediaCheck.uploadFile}
                onMediaClear={mediaCheck.clear}
                selected={selected}
                onToggle={(id) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={(all) => setSelected(all ? new Set(channels.filter((c) => !unavailableReason(c)).map((c) => c.id)) : new Set())}
                draftError={draftError}
                onRetryDrafts={createDrafts}
                onWriteManually={writeManually}
              />
            </motion.div>
          )}

          {step === "review" && (
            <motion.div key="review" {...pageMotion}>
              <ReviewStep
                drafts={drafts}
                channelById={channelById}
                checks={checks}
                media={media}
                struggling={struggling}
                regenerating={regenerating}
                onUpdate={updateDraft}
                onMode={setMode}
                onAllModes={(m) => drafts.forEach((d) => setMode(d, m))}
                onRegenerate={regenerate}
                onRemove={(id) => setDrafts((prev) => prev.filter((d) => d.channelId !== id))}
                sendError={sendError}
              />
            </motion.div>
          )}

          {step === "done" && result && (
            <motion.div key="done" {...pageMotion}>
              <DoneStep
                result={result}
                modes={new Map(drafts.map((d) => [d.channelId, d.mode]))}
                channelById={channelById}
                sending={sending}
                onRetry={() => {
                  const failed = new Set(result.posts.filter((p) => p.outcome === "failed").map((p) => p.channelId));
                  send(drafts.filter((d) => failed.has(d.channelId)), result.ideaId);
                }}
                onEdit={() => {
                  // Only posts that weren't sent go back for editing, so nothing is duplicated.
                  const pending = new Set(result.posts.filter((p) => p.outcome !== "created").map((p) => p.channelId));
                  setDrafts((prev) => prev.filter((d) => pending.has(d.channelId)));
                  setStep("review");
                }}
                onNew={startOver}
              />
              {sendError && <p className="notice error" style={{ maxWidth: "40rem", margin: "1rem auto 0" }}>{sendError}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {orgs && step === "compose" && (
        <div className="actionbar">
          <div className="actionbar-inner">
            <span className="summary">
              {chosen.length ? `${chosen.length} ${chosen.length === 1 ? "channel" : "channels"} selected` : "Choose at least one channel"}
            </span>
            <button className="btn primary" disabled={!canCreate || drafting} onClick={createDrafts}>
              <Icon name="spark" /> Create {chosen.length > 1 ? `${chosen.length} posts` : "post"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="actionbar">
          <div className="actionbar-inner">
            <button className="btn ghost" onClick={() => setStep("compose")} disabled={sending}>
              <Icon name="arrow-left" /> Back
            </button>
            <span className="summary">{issues ? `${issues} ${issues === 1 ? "post needs" : "posts need"} attention` : modeSummary}</span>
            <button className="btn primary" disabled={!drafts.length || issues > 0 || sending} onClick={() => send(drafts, result?.ideaId ?? null)}>
              {sending ? "Sending…" : `Send ${drafts.length > 1 ? `${drafts.length} posts` : "post"} to Buffer`} <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>{drafting && <DraftingOverlay channels={chosen} />}</AnimatePresence>
    </div>
  );
}

