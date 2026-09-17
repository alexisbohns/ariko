import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { inclusiveSans } from "./fonts";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * The design system's display face (shadcn preset `b3vqDobYF1`, `fontHeading:
 * geist-mono`). The body face stays Inclusive Sans — see `app/fonts.ts`.
 */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

/**
 * Typed, and `metadata` above with it, because Next IGNORES a key it does not
 * recognise rather than rejecting it: `themecolor` for `themeColor` drops the
 * <meta> tag with no complaint from `tsc`, `npm test` or `npm run build`, and
 * the first symptom is an installed window painted the wrong colour. The
 * annotation is the only thing that turns that typo into an error.
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
};

/**
 * Registers `public/sw.js`, which exists to give an offline visitor Ariko's
 * page instead of the browser's dino — nothing else. It is deliberately a
 * SCRIPT TAG and not a component: no `"use client"`, no boundary, no
 * hydration, no chunk, so the public zone still has exactly one island
 * (`components/toc-rail.tsx`) and `lib/toc-mount.test.ts`'s claim is untouched.
 *
 * It is in the ROOT layout, so it runs in BOTH zones, and the worker's scope is
 * the manifest's scope — `/`, which includes `/admin`. That is deliberate on
 * both sides: one app rather than one per zone, and `public/sw.js` is written
 * knowing the authenticated zone is inside its scope. Anything that worker
 * learns to cache has to be correct for a logged-in page too.
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
 * The root layout owns the document shell, the type/theme foundation, and the
 * one piece of behaviour that is genuinely app-wide — the service-worker
 * registration above, which reaches both zones because it is here. Chrome
 * belongs to the zones: `app/(public)/layout.tsx` for the exhibition,
 * `app/admin/(chrome)/layout.tsx` for the tooling. Both zones keep one page
 * outside their chrome group — the public home page, and the admin's login
 * page — so THIS layout is the only one either of those two enters. In the
 * admin's case that is load-bearing rather than cosmetic: see
 * `lib/admin-login-layout-source.test.ts`.
 *
 * The theme script beside it is the second bare <script> in this head, and it
 * is here for the same reason: it must reach BOTH zones, and it must run
 * before first paint. Neither is a component, so neither is a boundary and
 * neither shows up in the zone's island count.
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
        {/* Applies the stored theme before first paint. MUST come first and
            MUST be blocking: anything later is a flash of the wrong theme on
            every cold load, in both zones. See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">{children}</body>
    </html>
  );
}
