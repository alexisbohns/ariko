"use client";

import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { NAV_ITEMS, resolveColumn, resolveNavItem } from "@/lib/admin-nav";
import { logoutAction } from "../actions";
import { CommandPalette } from "./command-palette";
import { SECTION_ICONS } from "./section-icons";
import { Chrome, ChromeItem, ChromeLink, chromeItemClass } from "@/components/chrome";
import { READING_COLUMN, RAIL_CLEARANCE, WIDE_COLUMN } from "@/components/page-column";

/**
 * The admin's chrome, rendered once by the layout rather than by each page —
 * which is why the `current` prop the old AdminBar took is gone: the active
 * item comes from the pathname (lib/admin-nav.ts).
 *
 * Chrome, not a form: every nav item is a plain <a href> and Log out is still
 * a real <form> with a real submit button, so the zero-client-JS rule in
 * CLAUDE.md is untouched here. (The seed overlay is where this slice spends
 * its exception.)
 *
 * The SHELL is `components/chrome.tsx` now, shared with the public zone — see
 * that file for why the hover labels stopped being Base UI `Tooltip`s. This
 * file keeps only what is actually the admin's: which icons, which routes,
 * which one is current, and the log-out form.
 *
 * The spacing that clears the chrome lives here too, in AdminMain, because the
 * decision is the same decision: a page with no chrome must not be padded as
 * though it had some. One route constant, two consumers.
 */

/** The one route the chrome withdraws from — and therefore the one route the
 *  content column is centred rather than offset on. */
const BARE = "/admin/login";

export function AdminChrome() {
  const pathname = usePathname();

  // The login page lives under /admin but gets no chrome. Under the old bar
  // this was expressed by the page simply not calling it; the layout owns the
  // chrome now, so it is expressed here.
  if (pathname === BARE) return null;

  const active = resolveNavItem(pathname);

  return (
    <>
      <Chrome magnet="left" orientation="vertical" label="Admin sections">
        {NAV_ITEMS.map((item) => {
          const Icon = SECTION_ICONS[item.href];
          return (
            <ChromeLink
              key={item.href}
              href={item.href}
              label={item.label}
              current={item.href === active}
            >
              <Icon className="size-4" />
            </ChromeLink>
          );
        })}
      </Chrome>

      {/* The account cluster had no plate at all — three bare icons over
          the page. It wears the same one as the rail now, which is what
          makes the two read as one chrome rather than as a furnished rail
          and some loose buttons. Ghost at rest, so the cost is nothing.

          Not a <nav>: it is a log-out form and two actions, so a landmark here
          would put a second "navigation" in the page that navigates nowhere.
          `Chrome` expresses that by taking no `label`. */}
      <Chrome magnet="top-right">
        {/* The palette rides with the chrome rather than the page: rendered
            here, it is behind the same login-page withdrawal above — one route
            constant, now three consumers — and ⌘K works on every admin route
            without a page having to opt in. It is still an island: it fetches
            nothing until it is opened. */}
        <CommandPalette />

        <ChromeLink href="/" label="Public site">
          <ExternalLink className="size-4" />
        </ChromeLink>

        <form action={logoutAction} className="flex">
          <ChromeItem label="Log out">
            <button type="submit" aria-label="Log out" className={chromeItemClass()}>
              <LogOut className="size-4" />
            </button>
          </ChromeItem>
        </form>
      </Chrome>
    </>
  );
}

/**
 * The content column. A client component only so it can read the pathname: the
 * layout is a server component and cannot, and without that the login card sat
 * centred inside an off-centre box — padded on both sides for a rail and an
 * account cluster that AdminChrome had already withdrawn.
 *
 * The measure itself is `components/page-column.tsx`, shared with the public
 * zone, and the shared-surfaces slice is what put it there. What this page used
 * to render — `max-w-5xl pl-20 pr-36` — was wider than the public column AND
 * left of centre, because the clearance was subtracted from INSIDE the
 * max-width. It is an outer wrapper now, so the box is the public zone's box:
 * same width, same place, pure WYSIWYG.
 *
 * That also retires a hazard the old comment ended on. `pr-36` was measured
 * against the top-right cluster's WIDTH, so it had to be recomputed every time
 * the cluster gained a button — and it was silently short twice. Vertical
 * clearance does not care how many buttons a cluster holds: `pt-24` clears a
 * cluster's 48px height with 32px to spare, whatever is in it. `RAIL_CLEARANCE`
 * clears the two vertically centred rails, and those are one icon wide by
 * construction.
 */
export function AdminMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const column = resolveColumn(pathname);
  if (column === "bare") {
    return <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>;
  }
  return (
    <main className={`${RAIL_CLEARANCE} pb-20 pt-24`}>
      <div className={column === "wide" ? WIDE_COLUMN : READING_COLUMN}>{children}</div>
    </main>
  );
}
