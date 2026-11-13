import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cascade",
  description: "One idea becomes adapted, media-ready posts across every Buffer channel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
