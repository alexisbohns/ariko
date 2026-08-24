import type { ReactNode } from "react";

import { ArikoLogo } from "@/components/brand/ariko-logo";

/**
 * The inner exhibition pages: site header + a reading-width column.
 *
 * The home page deliberately sits OUTSIDE this group (`app/(public)/page.tsx`).
 * It is the landing, not a destination reached from a nav, so it wears the mark
 * large and centred instead of a header bar — which is why the header lives in
 * this nested layout rather than in the zone root.
 */
export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
          <a
            href="/"
            className="text-foreground transition-opacity hover:opacity-80"
          >
            <ArikoLogo title="Ariko" className="h-6 w-auto" />
          </a>
          <ul className="flex items-center gap-4 text-sm text-muted-foreground">
            <li>
              <a href="/" className="transition-colors hover:text-foreground">
                Directory
              </a>
            </li>
            <li>
              <a
                href="/beanstalk"
                className="transition-colors hover:text-foreground"
              >
                Beanstalk
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </>
  );
}
