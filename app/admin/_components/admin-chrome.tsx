"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useHeldKeys, useHotkeys } from "@tanstack/react-hotkeys";
import { ExternalLink, LogOut } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { navHref, navItems, resolveColumn, resolveNavItem, type NavItem } from "@/lib/admin-nav";
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
 * EVERY NAV ITEM IS A `next/link`, AND THAT IS THE WHOLE PERFORMANCE STORY of
 * this chrome. It used to be a plain `<a href>`, justified by a zero-client-JS
 * rule that belonged to the POC and outlived it — so every click in the admin
 * tore the document down and built it again. A screen recording of five
 * navigations timed the cost at 284–358 ms of visibly broken chrome EACH TIME,
 * and all of it downstream of the reload rather than of any work worth doing:
 *
 *   - a white frame, because the old document is gone and the new one has not
 *     painted;
 *   - the plant switcher's logo flashing its `OX` monogram, because Base UI's
 *     `Avatar.Image` starts at `idle` and only calls `new Image()` from a
 *     layout effect — the `<img>` is never in the server HTML, so the request
 *     cannot start until the bundle has downloaded and hydrated;
 *   - the search icon missing entirely and arriving last, for the same reason
 *     one layer up (see `command-palette.tsx`).
 *
 * A soft navigation does not fix those three; it makes them unreachable. The
 * layout and every island in it STAY MOUNTED across a click, so there is no
 * frame in which the chrome is half-built, and nothing to re-hydrate. The
 * server cost fell with it: the layout's garden read is no longer repeated per
 * navigation, because the layout is no longer re-rendered per navigation.
 *
 * The anchor comes in as `ChromeLink`'s `as` — that file says why it is a
 * parameter rather than an import, and the short version is that
 * `components/chrome.tsx` is server-safe and the public zone renders it.
 *
 * Log out is still a real `<form>` with a real submit button. That was never
 * about script; it is a write, and a write belongs in a form.
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

/**
 * The rail's keyboard shortcuts: `Alt+1` … `Alt+9`, in the order the rail is
 * drawn, plus the held-modifier reveal.
 *
 * WHY THE NUMBERS COME FROM `navItems` RATHER THAN FROM A TABLE HERE: the rail
 * changes shape with the scope — Overview appears, Beanstalk steps aside — and
 * a shortcut that disagreed with the position it is drawn beside would be worse
 * than no shortcut at all. `lib/admin-nav.ts` assigns the digit as a position,
 * this reads it back, and `lib/admin-nav.test.ts` pins that they are the same
 * list.
 *
 * `Alt+<digit>` IS SAFE TO TAKE on a Mac, where it would otherwise type `¡™£`.
 * The matcher falls back to `event.code`, so `Alt+1` is the physical Digit1 key
 * whatever character the layout produces — which is also why these work on an
 * AZERTY keyboard, where the unshifted digits are punctuation.
 *
 * The reveal is `useHeldKeys`, not a keydown listener of our own: the library
 * already tracks what is down, and a second tracker would be a second answer to
 * the same question — one that would miss a key released while the window was
 * blurred, which is the bug every hand-rolled version of this has.
 */
/**
 * The modifier as the key is engraved. A constant rather than a platform
 * sniff: this admin has one author, on a Mac. If that changes, this is the one
 * line to make conditional — and this file, unlike `components/chrome.tsx`,
 * is already a client component and free to ask.
 */
const ALT_SYMBOL = "⌥";

/**
 * The two chrome shortcuts that are not rail positions.
 *
 * `0` for the switcher is the digit the rail's numbering will never reach — the
 * rail runs 1…9 and stops, so the key that would have meant ten is free, and it
 * sits at the end of the same row of digits the sections use. `Q` for log out is
 * the letter the platform already spends on quitting.
 *
 * Both are safe to take for the same reason the digits are: the matcher falls
 * back to `event.code`, so ⌥Q is the physical Q key and not the `œ` macOS would
 * otherwise type.
 */
const SWITCHER_KEY = "0";
const LOGOUT_KEY = "Q";

function useRailHotkeys(items: readonly NavItem[], scope: string | null): boolean {
  const router = useRouter();

  useHotkeys(
    // `flatMap` rather than filter-then-map: a filter does not narrow
    // `hotkey` out of `undefined`, and the library's hotkey type is a template
    // literal over real key names — so the narrowing has to be real, not
    // asserted.
    items.flatMap((item) =>
      item.hotkey
        ? [
            {
              hotkey: `Alt+${item.hotkey}` as const,
              // `navHref`, so a shortcut carries the scope exactly as clicking
              // the icon would. The two must not differ; they are the same
              // navigation.
              callback: () => router.push(navHref(item, scope)),
            },
          ]
        : [],
    ),
    // The browser has no Alt+digit binding worth keeping, and macOS would
    // otherwise insert `¡™£` into whatever field has focus.
    { preventDefault: true },
  );

  // `Alt` while a field has focus is still `Alt` — the reveal is a legend, not
  // an action, so there is nothing to suppress and nothing to get wrong.
  return useHeldKeys().includes("Alt");
}

export function AdminChrome({ plants }: { plants: PlantMark[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const logoutRef = useRef<HTMLFormElement>(null);

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
  const altHeld = useRailHotkeys(items, scope);

  useHotkeys(
    [
      { hotkey: `Alt+${SWITCHER_KEY}`, callback: () => setSwitcherOpen((wasOpen) => !wasOpen) },
      // `requestSubmit`, never `submit`: it runs the form's own submit path —
      // the server action, and any validation — where `.submit()` would bypass
      // it. The button stays the real control; this only presses it.
      { hotkey: `Alt+${LOGOUT_KEY}`, callback: () => logoutRef.current?.requestSubmit() },
    ],
    { preventDefault: true },
  );

  return (
    <>
      {/* The mark and the subject. The mark goes home to the welcome page —
          the all-plants overview — which is why the rail no longer carries a
          root item of its own. */}
      {/* All three clusters reveal together, not just the rail. Holding the
          modifier asks "what can I reach from here", and answering for one
          cluster while the other two stay dark would make the chrome look
          half-lit rather than annotated — the mark and the switcher have no
          shortcut, so they simply show their names. */}
      <Chrome magnet="top-left" hotkeysVisible={altHeld}>
        <ChromeLink href="/admin" label="Ariko" as={Link}>
          <ArikoIcon className="size-4" />
        </ChromeLink>
        <PlantSwitcher
          plants={plants}
          scope={scope}
          pathname={pathname}
          active={active}
          hotkey={`${ALT_SYMBOL}${SWITCHER_KEY}`}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      </Chrome>

      <Chrome magnet="left" orientation="vertical" label="Admin sections" hotkeysVisible={altHeld}>
        {items.map((item) => {
          const Icon = SECTION_ICONS[item.id];
          return (
            <ChromeLink
              key={item.id}
              href={navHref(item, scope)}
              label={item.label}
              as={Link}
              hotkey={item.hotkey ? `${ALT_SYMBOL}${item.hotkey}` : undefined}
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
      <Chrome magnet="top-right" hotkeysVisible={altHeld}>
        {/* The palette rides with the chrome rather than the page: rendered
            here, it is behind the same login-page withdrawal above — one route
            constant, now three consumers — and ⌘K works on every admin route
            without a page having to opt in. It is still an island: it fetches
            nothing until it is opened. */}
        <CommandPalette />

        <ChromeLink href="/" label="Public site">
          <ExternalLink className="size-4" />
        </ChromeLink>

        <form ref={logoutRef} action={logoutAction} className="flex">
          <ChromeItem label="Log out" hotkey={`${ALT_SYMBOL}${LOGOUT_KEY}`}>
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
