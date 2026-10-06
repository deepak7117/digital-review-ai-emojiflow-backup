import type { Metadata } from "next";
import "./globals.css";
import { branding } from "@/lib/config/branding";

// Fonts are loaded via a <link> tag rather than next/font/google so that the
// production build does not depend on network access to Google's font CDN
// (some sandboxed/offline build environments block it). Runtime performance
// is close to equivalent since Next.js still ships font-display: swap via
// the stylesheet, and the CSS variables below give the same font stack used
// throughout the app.
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: `${branding.productName} | ${branding.parentBrand}`,
  description: branding.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
