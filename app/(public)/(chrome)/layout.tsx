import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { PublicChrome } from "@/app/(public)/_components/public-chrome";
import { READING_COLUMN } from "@/components/page-column";
import { TocRail } from "@/components/toc-rail";
import { LANG_COOKIE, resolveLang } from "@/lib/locale";
import { isAuthenticated } from "@/app/admin/session";

/**
 * The inner exhibition pages: floating chrome + a reading-width column.
 *
 * The header BAR is gone (the public-plant-page slice). Every other surface in
 * Ariko has learned to get out of the way — the admin rail, the vault
 * popovers, the palette — and this is that move for the public zone: a mark and
 * two nav icons top-left, the language top-right, nothing across the top.
 *
 * The home page deliberately sits OUTSIDE this group (`app/(public)/page.tsx`).
 * It is the landing, not a destination reached from a nav, so it wears the mark
 * large and centred and gets no chrome at all.
 *
 * The column is `READING_COLUMN` (components/page-column.tsx), which the ADMIN
 * now renders too. It is the same string in both zones rather than two that
 * happen to agree, which is what makes the author's editor and the visitor's
 * page the same box — the shared-surfaces slice.
 *
 * <TocRail /> is the zone's ONE client island, and it is rendered here rather
 * than by each page so plant, pod and bean all get it without opting in. It
 * reads the rendered document, so it needs no props, and it withdraws on its
 * own when a page has fewer than two headings. Script-off it is not there —
 * which costs nothing, because every heading it indexes is already in the prose
 * beneath it. `pt-24` clears the chrome whether or not the rail renders.
 */
export default async function ChromeLayout({ children }: { children: ReactNode }) {
  // The layout renders the switch; each PAGE resolves the language again for its
  // own prose. Both read the same cookie, so they cannot disagree.
  const lang = resolveLang(undefined, (await cookies()).get(LANG_COOKIE)?.value);
  // The session read is here and not in the island because the session cookie is
  // httpOnly: client JavaScript cannot see it, so a client guess would be wrong.
  // It costs nothing new — this layout already calls cookies() and is already
  // dynamic — and it decides ONE thing: whether the menu shows a link to /admin.
  // Nothing about the page's content varies on it.
  const authed = await isAuthenticated();
  return (
    <>
      <PublicChrome lang={lang} authed={authed} />
      <TocRail />
      <main className="pb-20 pt-24">
        <div className={READING_COLUMN}>{children}</div>
      </main>
    </>
  );
}
