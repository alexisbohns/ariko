"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { navHref, navItems, resolveColumn, resolveNavItem } from "@/lib/admin-nav";
import { resolveScope } from "@/lib/admin-scope";
import { logoutAction } from "../actions";
import { ArikoIcon } from "@/components/brand/ariko-icon";
import { CommandPalette } from "./command-palette";
import { PlantSwitcher, type PlantMark } from "./plant-switcher";
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
 *
 * THE CHROME NOW CARRIES THE ADMIN'S SUBJECT. The rail's shape depends on it —
 * scoped it gains Overview and loses Beanstalk (lib/admin-nav.ts says why) —
 * and the top-left cluster is where the subject is read and changed. Both read
 * ONE scope, resolved here from the URL and passed down, so the rail and the
 * switcher cannot disagree about what the page is showing.
 *
 * `useSearchParams` is why the layout wraps this in `<Suspense>`: Next requires
 * a boundary around it, and the missing one fails `npm run build` rather than
 * anything earlier. `AdminMain` reads only the pathname and needs neither.
 *
 * The `plants` prop is the ExhibitionPanel arrangement: the layout is a server
 * component, it does the garden read, and this island receives a finished
 * array. It must stay that way — this file is `"use client"`, so an import of
 * `lib/store.ts` or `lib/data.ts` here would not bloat the bundle, it would
 * fail the build (`lib/section-keys.ts` has the account of the last time that
 * happened).
 */

export function AdminChrome({ plants }: { plants: PlantMark[] }) {
  const pathname = usePathname();
  const params = useSearchParams();

  // There used to be a `if (pathname === "/admin/login") return null` here, and
  // deleting it was the point of the route-group slice rather than a tidy-up.
  // It suppressed the chrome's MARKUP on the login page while the layout above
  // still read the garden and handed `plants` across the client boundary — and
  // props cross that boundary as serialized flight data inlined in the HTML,
  // which happens before this function is ever called. So the withdrawal was
  // visual and the leak was total: an anonymous GET of the login page returned
  // every plant, its logo URL and its visibility. The login page now sits
  // outside `app/admin/(chrome)/`, so this component is not rendered there at
  // all and the guard had nothing left to guard.

  // Read once, passed down twice. `Object.fromEntries` is the shape
  // `lib/admin-filters.ts` works in, and it degrades a repeated `?plant=` to a
  // single value, which `resolveScope` then refuses outright.
  const active = Object.fromEntries(params.entries());
  const scope = resolveScope(pathname, active);
  const activeHref = resolveNavItem(pathname);
  const items = navItems(scope);

  return (
    <>
      {/* The mark and the subject. The mark goes home to the welcome page —
          the all-plants overview — which is why the rail no longer carries a
          root item of its own. */}
      <Chrome magnet="top-left">
        <ChromeLink href="/admin" label="Ariko">
          <ArikoIcon className="size-4" />
        </ChromeLink>
        <PlantSwitcher plants={plants} scope={scope} pathname={pathname} active={active} />
      </Chrome>

      <Chrome magnet="left" orientation="vertical" label="Admin sections">
        {items.map((item) => {
          const Icon = SECTION_ICONS[item.id];
          return (
            <ChromeLink
              key={item.id}
              href={navHref(item, scope)}
              label={item.label}
              // The item's OWN href, not the scoped one: `resolveNavItem`
              // answers with a path, and the scoped href carries a query the
              // pathname never will.
              current={item.href === activeHref}
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
 * layout is a server component and cannot, and the measure is route-dependent —
 * a section index is wide, a document reads.
 *
 * It used to have a third measure, `"bare"`, for the login page: no clearance,
 * because AdminChrome had withdrawn and there was nothing to clear. The login
 * page is outside `app/admin/(chrome)/` now and this layout does not wrap it,
 * so that branch — and `resolveColumn`'s `"bare"` with it — was unreachable
 * code claiming a route this component never sees. The login page draws its own
 * `<main>`; the two surviving measures are the two the chrome actually offsets.
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
  return (
    <main className={`${RAIL_CLEARANCE} pb-20 pt-24`}>
      <div className={column === "wide" ? WIDE_COLUMN : READING_COLUMN}>{children}</div>
    </main>
  );
}
