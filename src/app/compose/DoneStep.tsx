"use client";

import { motion } from "motion/react";
import type { Channel, PostResult, PublishResponse } from "@/lib/types";
import { ChannelIdentity, Icon } from "./ui";

function describe(p: PostResult): string {
  if (p.outcome !== "created") return p.message ?? "Not sent.";
  if (p.status === "draft") return "Saved as draft";
  const when = p.dueAt ? new Date(p.dueAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  return when ? `Scheduled · ${when}` : "Added to your queue";
}

export function DoneStep({
  result, channelById, sending, onRetry, onEdit, onNew,
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
              <span className="status">{describe(p)}</span>
            </motion.li>
          );
        })}
      </ul>

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
