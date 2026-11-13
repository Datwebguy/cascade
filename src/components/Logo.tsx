import { useId } from "react";

/** The Cascade mark: one source that branches into many streams. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B1E3C" />
          <stop offset="1" stopColor="#0B0D1E" />
        </linearGradient>
        <linearGradient id={`st${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B7CFF" />
          <stop offset="1" stopColor="#3EE6D8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bg${id})`} />
      <g fill="none" stroke={`url(#st${id})`} strokeWidth="4.5" strokeLinecap="round">
        <path d="M32 18 C32 30 17 29 17 43" />
        <path d="M32 18 V43" />
        <path d="M32 18 C32 30 47 29 47 43" />
      </g>
      <circle cx="32" cy="14" r="5.5" fill="#8B7CFF" />
      <circle cx="17" cy="49" r="4.5" fill="#3EE6D8" />
      <circle cx="32" cy="49" r="4.5" fill="#3EE6D8" />
      <circle cx="47" cy="49" r="4.5" fill="#3EE6D8" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">cascade</span>
    </span>
  );
}
