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
      <body className="min-h-svh bg-background text-foreground">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
            <a href="/" className="font-heading text-sm font-medium tracking-tight">
              ariko
            </a>
            <ul className="flex items-center gap-4 text-sm text-muted-foreground">
              <li>
                <a href="/" className="transition-colors hover:text-foreground">
                  Directory
                </a>
              </li>
              <li>
                <a href="/beanstalk" className="transition-colors hover:text-foreground">
                  Beanstalk
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
