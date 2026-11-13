"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Service } from "@/lib/types";
import { NetworkIcon } from "./NetworkIcon";

const POSTS: { service: Service; name: string; text: string }[] = [
  { service: "twitter", name: "X", text: "Consistency beats polish. Our best posts this year were one honest thought, written fast." },
  { service: "linkedin", name: "LinkedIn", text: "Most teams overthink the content calendar. Here's what actually worked for us this year…" },
  { service: "instagram", name: "Instagram", text: "One honest observation > one perfect post. Save this for your next blank-page day." },
  { service: "threads", name: "Threads", text: "Hot take: your content calendar is too complicated. Post the honest thing today." },
];

// Paths from the idea card down to each of the four post cards.
const STREAMS = ["M200 0 C200 45 55 40 55 90", "M200 0 C200 45 150 45 150 90", "M200 0 C200 45 250 45 250 90", "M200 0 C200 45 345 40 345 90"];

export function HeroDemo() {
  const reduce = useReducedMotion();
  return (
    <div className="demo" aria-hidden="true">
      <motion.div
        className="demo-stage"
        initial={reduce ? false : { rotateX: 14, rotateY: -12, y: 20, opacity: 0 }}
        animate={{ rotateX: 8, rotateY: -8, y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <motion.div
          className="demo-idea"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="tag">Your idea</span>
          <p>Consistency beats polish when you post every day.</p>
        </motion.div>

        <svg className="demo-streams" viewBox="0 0 400 90" preserveAspectRatio="none">
          <defs>
            <linearGradient id="demo-stream" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8B7CFF" />
              <stop offset="1" stopColor="#3EE6D8" />
            </linearGradient>
          </defs>
          {STREAMS.map((d, i) => (
            <g key={d}>
              <path d={d} fill="none" stroke="var(--line)" strokeWidth="2" />
              <motion.path
                d={d}
                fill="none"
                stroke="url(#demo-stream)"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15, duration: 0.9, ease: "easeInOut" }}
              />
            </g>
          ))}
        </svg>

        <div className="demo-posts">
          {POSTS.map((p, i) => (
            <motion.div
              key={p.service}
              className="demo-post"
              initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.2 + i * 0.15, type: "spring", stiffness: 180, damping: 18 }}
            >
              <header>
                <NetworkIcon service={p.service} size={14} />
                {p.name}
              </header>
              <p>{p.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
