"use client";

import { motion } from "motion/react";
import type { Channel, PostResult, PublishResponse, SchedulingMode } from "@/lib/types";
import { ChannelIdentity, Icon } from "./ui";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** What happened to this post, and what happens next in Buffer. */
function describe(p: PostResult, mode: SchedulingMode | undefined): { status: string; next?: string } {
  if (p.outcome !== "created") return { status: p.message ?? "Not sent." };
  if (p.status === "draft" || mode === "saveToDraft") {
    return { status: "Saved as a draft in Buffer", next: "Nothing is published until you schedule or publish it in Buffer." };
  }
  const when = p.dueAt ? fmt(p.dueAt) : null;
  if (mode === "customScheduled") {
    return { status: when ? `Scheduled for ${when}` : "Scheduled", next: "Buffer publishes it automatically at that time." };
  }
  return {
    status: when ? `In your Buffer queue · ${when}` : "In your Buffer queue",
    next: "Buffer publishes it automatically at that slot.",
  };
}

const bufferChannelUrl = (channelId: string) => `https://publish.buffer.com/channels/${encodeURIComponent(channelId)}`;

export function DoneStep({
  result, modes, channelById, sending, onRetry, onEdit, onNew,
}: {
  result: PublishResponse;
  modes: Map<string, SchedulingMode>;
  channelById: Map<string, Channel>;
  sending: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onNew: () => void;
}) {
  const created = result.posts.filter((p) => p.outcome === "created").length;
  const failed = result.posts.filter((p) => p.outcome === "failed").length;
  const unsure = result.posts.filter((p) => p.outcome === "unknown").length;
  const total = result.posts.length;
  const allGood = created === total;

  return (
    <>
      <div className="done-hero">
        <motion.span className="badge" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
          <Icon name={allGood ? "check" : "alert"} size={30} />
        </motion.span>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          {allGood ? "Your posts are in Buffer" : created === 0 ? "Nothing was sent yet" : "Almost there"}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          {created} of {total} {total === 1 ? "post" : "posts"} sent.{" "}
          {result.ideaId ? "Your original idea is saved in Buffer Ideas." : result.ideaMessage ?? ""}
        </motion.p>
      </div>

      <ul className="results">
        {result.posts.map((p, i) => {
          const ch = channelById.get(p.channelId);
          const d = describe(p, modes.get(p.channelId));
          return (
            <motion.li
              key={p.channelId}
              className="card result"
              data-outcome={p.outcome}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              {ch && <ChannelIdentity channel={ch} />}
              <span className="status">
                <span className="status-main">{d.status}</span>
                {d.next && <span className="status-next">{d.next}</span>}
                {p.outcome === "created" && (
                  <a className="status-link" href={bufferChannelUrl(p.channelId)} target="_blank" rel="noreferrer">
                    View in Buffer <Icon name="external" size={13} />
                  </a>
                )}
              </span>
            </motion.li>
          );
        })}
      </ul>

      {created > 0 && <WhatNext result={result} modes={modes} />}

      {unsure > 0 && (
        <p className="notice warn" style={{ maxWidth: "40rem", margin: "1rem auto 0" }}>
          <Icon name="alert" /> Buffer was slow to answer for {unsure === 1 ? "one channel" : `${unsure} channels`}. Check it in Buffer before trying again so nothing is posted twice.
        </p>
      )}

      <div className="done-actions">
        {failed > 0 && (
          <button className="btn primary" onClick={onRetry} disabled={sending}>
            {sending ? "Trying again…" : `Try ${failed === 1 ? "it" : `${failed}`} again`}
          </button>
        )}
        {(failed > 0 || unsure > 0) && (
          <button className="btn" onClick={onEdit} disabled={sending}>
            Edit and resend
          </button>
        )}
        <a className="btn" href="https://publish.buffer.com" target="_blank" rel="noreferrer">
          Open Buffer <Icon name="external" size={15} />
        </a>
        <button className={`btn ${failed ? "ghost" : "primary"}`} onClick={onNew}>
          Start a new idea
        </button>
      </div>
    </>
  );
}

/** Plain summary of what Buffer will do with everything that was sent. */
function WhatNext({ result, modes }: { result: PublishResponse; modes: Map<string, SchedulingMode> }) {
  const sent = result.posts.filter((p) => p.outcome === "created");
  const drafts = sent.filter((p) => p.status === "draft" || modes.get(p.channelId) === "saveToDraft").length;
  const automatic = sent.length - drafts;
  return (
    <div className="card what-next">
      <h2>What happens next</h2>
      <ul>
        {automatic > 0 && (
          <li>
            <strong>{automatic === 1 ? "1 post publishes" : `${automatic} posts publish`} automatically.</strong> Buffer sends{" "}
            {automatic === 1 ? "it" : "them"} at the time shown, even if you close Cascade.
          </li>
        )}
        {drafts > 0 && (
          <li>
            <strong>{drafts === 1 ? "1 draft is" : `${drafts} drafts are`} waiting in Buffer.</strong> Open Buffer to give{" "}
            {drafts === 1 ? "it" : "them"} a final look, then schedule or publish.
          </li>
        )}
        <li>You can still edit, reschedule or delete any post in Buffer.</li>
        {result.ideaId && <li>Your original idea is saved in Buffer Ideas, ready to reuse.</li>}
      </ul>
    </div>
  );
}
