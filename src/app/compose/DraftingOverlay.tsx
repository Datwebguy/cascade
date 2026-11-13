"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { NetworkIcon } from "@/components/NetworkIcon";
import { platformFor } from "@/lib/platforms";
import type { Channel } from "@/lib/types";

export function DraftingOverlay({ channels }: { channels: Channel[] }) {
  const shown = channels.slice(0, 5);
  const messages = ["Reading your idea…", ...shown.map((c) => `Writing for ${platformFor(c.service).label}…`), "Checking every post fits…"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 1100);
    return () => clearInterval(t);
  }, [messages.length]);

  const w = 280;
  const xs = shown.map((_, k) => (shown.length === 1 ? w / 2 : 24 + (k * (w - 48)) / (shown.length - 1)));

  return (
    <motion.div className="overlay" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="overlay-card" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}>
        <motion.div animate={{ rotate: [0, 4, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity }} style={{ display: "inline-block" }}>
          <LogoMark size={46} />
        </motion.div>
        <svg className="flow" width={w} height="70" viewBox={`0 0 ${w} 70`} aria-hidden="true">
          <defs>
            <linearGradient id="flow-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8B7CFF" />
              <stop offset="1" stopColor="#3EE6D8" />
            </linearGradient>
          </defs>
          {xs.map((x) => {
            const d = `M${w / 2} 0 C${w / 2} 35 ${x} 30 ${x} 70`;
            return (
              <g key={x}>
                <path d={d} fill="none" stroke="var(--line)" strokeWidth="2" />
                <motion.path
                  d={d} fill="none" stroke="url(#flow-g)" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="10 120"
                  animate={{ strokeDashoffset: [130, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "linear", delay: (x / w) * 0.6 }}
                />
              </g>
            );
          })}
        </svg>
        <div className="flow-icons" style={{ gap: shown.length > 1 ? `${(w - 48) / (shown.length - 1) - 37}px` : 0 }}>
          {shown.map((c) => (
            <span key={c.id}>
              <NetworkIcon service={c.service} size={18} />
            </span>
          ))}
        </div>
        <h2>Shaping your posts</h2>
        <AnimatePresence mode="wait">
          <motion.p key={i} className="muted small" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} style={{ marginTop: "0.4rem" }}>
            {messages[i]}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
