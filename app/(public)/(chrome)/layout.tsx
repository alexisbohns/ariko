import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { ArikoLogo } from "@/components/brand/ariko-logo";
import { LangSwitch } from "@/components/lang-switch";
import { LANG_COOKIE, resolveLang } from "@/lib/locale";

/**
 * The inner exhibition pages: site header + a reading-width column.
 *
 * The home page deliberately sits OUTSIDE this group (`app/(public)/page.tsx`).
 * It is the landing, not a destination reached from a nav, so it wears the mark
 * large and centred instead of a header bar — which is why the header lives in
 * this nested layout rather than in the zone root.
 */
export default async function ChromeLayout({ children }: { children: ReactNode }) {
  // The layout renders the switch; each PAGE resolves the language again for its
  // own prose. Both read the same cookie, so they cannot disagree.
  const lang = resolveLang(undefined, (await cookies()).get(LANG_COOKIE)?.value);
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
          <div className="ml-auto">
            <LangSwitch lang={lang} />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </>
  );
}
