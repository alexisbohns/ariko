import type { ReactNode } from "react";
import { Geist_Mono } from "next/font/google";
import { inclusiveSans } from "./fonts";
import { cn } from "@/lib/utils";
import "./globals.css";

/**
 * The design system's display face (shadcn preset `b3vqDobYF1`, `fontHeading:
 * geist-mono`). The body face stays Inclusive Sans — see `app/fonts.ts`.
 */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Ariko",
  description: "An atomic portfolio of creative and professional work.",
};

/**
 * The root layout owns only the document shell and the type/theme foundation.
 * Chrome belongs to the zones: `app/(public)/layout.tsx` for the exhibition,
 * `app/admin/layout.tsx` for the tooling.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("font-sans antialiased", inclusiveSans.variable, geistMono.variable)}
    >
      <head>
        {/* Two-tone favicon: the dark-ink mark on light UI, the light-ink mark
            on dark UI. Browsers that ignore `media` fall back to the first. */}
        <link
          rel="icon"
          type="image/png"
          href="/icon-light.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/png"
          href="/icon-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <link rel="apple-touch-icon" href="/icon-light.png" />
      </head>
      <body className="min-h-svh bg-background text-foreground">{children}</body>
    </html>
  );
}
