import type { ReactNode } from "react";
import { Geist_Mono } from "next/font/google";
import { inclusiveSans } from "./fonts";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";
import "./globals.css";

/**
 * The design system's display face (shadcn preset `b3vqDobYF1`, `fontHeading:
 * geist-mono`). The body face stays Inclusive Sans — see `app/fonts.ts`.
 */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export const viewport = {
  themeColor: THEME_COLOR,
};

/**
 * Registers `public/sw.js`, which exists to give an offline visitor Ariko's
 * page instead of the browser's dino — nothing else. It is deliberately a
 * SCRIPT TAG and not a component: no `"use client"`, no boundary, no
 * hydration, no chunk, so the public zone still has exactly one island
 * (`components/toc-rail.tsx`) and `lib/toc-mount.test.ts`'s claim is untouched.
 *
 * No nonce: the CSP in `next.config.ts` is one directive plus `object-src` and
 * carries no `script-src`.
 *
 * Script off, no worker, and nothing else lost — which is the whole
 * progressive-enhancement contract in one line.
 */
const REGISTER_SW =
  "if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))";

/**
 * The root layout owns only the document shell and the type/theme foundation.
 * Chrome belongs to the zones: `app/(public)/layout.tsx` for the exhibition,
 * `app/admin/layout.tsx` for the tooling.
 *
 * The favicon, the Apple touch icon and the manifest link are NOT written here
 * any more. `app/icon.svg`, `app/apple-icon.png` and `app/manifest.ts` are Next
 * file conventions and Next emits the three <link>s itself — which is how the
 * two 190 kB PNGs this used to point at became one 20 kB SVG that does its own
 * `prefers-color-scheme` switch.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("font-sans antialiased", inclusiveSans.variable, geistMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">{children}</body>
    </html>
  );
}
