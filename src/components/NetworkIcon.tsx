import { siBluesky, siFacebook, siGoogle, siInstagram, siMastodon, siPinterest, siSubstack, siThreads, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import type { Service } from "@/lib/types";

const ICONS: Partial<Record<Service, { path: string; hex: string }>> = {
  twitter: siX,
  threads: siThreads,
  bluesky: siBluesky,
  mastodon: siMastodon,
  instagram: siInstagram,
  facebook: siFacebook,
  tiktok: siTiktok,
  youtube: siYoutube,
  pinterest: siPinterest,
  googlebusiness: siGoogle,
  substack: siSubstack,
  whatsapp: siWhatsapp,
};

/** Small network badge. Monochrome brands adapt to the theme via currentColor. */
export function NetworkIcon({ service, size = 16 }: { service: Service; size?: number }) {
  if (service === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="5" fill="#0A66C2" />
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="13" fill="#fff">
          in
        </text>
      </svg>
    );
  }
  const icon = ICONS[service];
  if (!icon) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity=".2" />
      </svg>
    );
  }
  const mono = icon.hex === "000000";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={icon.path} fill={mono ? "currentColor" : `#${icon.hex}`} />
    </svg>
  );
}
