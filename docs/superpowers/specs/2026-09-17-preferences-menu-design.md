# The public zone's preferences menu

**Date:** 2026-09-17
**Status:** designed, not yet implemented

## What this replaces

Today the public chrome's top-right cluster is a `content` `Chrome` holding
`components/lang-switch.tsx`: a single anchor to `?lang=<other>`, drawn as the
two-letter code of the language you are *not* reading. The middleware turns that
query string into a cookie and redirects to the clean URL.

It works, and it costs nothing — but it is not a standard chrome control. Every
other cluster in Ariko is a plated box of size-9 ghost icon-buttons with CSS
hover labels; this one is a text pill, and it is the only one. It also has room
for exactly one idea, which is why the two other things a visitor might want
from that corner — the theme, and the way back into the admin — have nowhere to
live.

This slice replaces the pill with an ordinary chrome icon-button that opens a
menu holding three groups: **language**, **theme**, and **Admin** (only when the
visitor is the author).

## The decision that shapes everything else: this is an island

A menu is client JavaScript. The public zone's standing rule is that islands
*add* and never *replace*, and today the language pill is the zone's only route
to switching language — so folding it into a menu narrows the no-script promise.

Three shapes were considered:

1. **Degrade the trigger to the existing language link** script-off.
2. **A pure-CSS disclosure** (`<details>`, or a hidden checkbox) so the menu
   itself is never an island; only the theme rows would need script.
3. **Accept a second island.**

**Chosen: (3).** There is no religious JS interdiction in this repo — CLAUDE.md's
"Script, by zone" section says the public zone is *progressively enhanced*, not
script-free, and the admin zone is a JavaScript application. Ariko builds on
shadcn over Base UI, and both ship a Menu that is a client component by
construction. Hand-rolling a CSS disclosure to dodge one island would break the
older and more load-bearing rule — *never hand-roll a primitive the registry
already has* — in order to satisfy a rule that was never absolute.

**The cost, stated plainly rather than buried:** a visitor with scripting off
loses the language switch. That is a real narrowing of the zone's promise, and
it is the sentence to re-read if it ever bites. Everything else the zone
promises is untouched: every page still reads, every link still navigates, every
media item is still reachable.

The public zone therefore has **two** islands after this slice —
`components/toc-rail.tsx` and the preferences menu — and CLAUDE.md's "exactly
one island" sentence is updated to say so, with this reasoning attached.

## Components

### `lib/theme.ts` — new, server-safe

The fourth module in the family `lib/locale.ts`, `lib/plant-status.ts`,
`lib/plant-visibility.ts` and `lib/sprout-state.ts` belong to: a named
vocabulary, declared once, so nothing downstream compares against a bare
literal.

```ts
export type Theme = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "ariko_theme";
export const DEFAULT_THEME: Theme = "system";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];
export const THEME_LABEL: Record<Theme, string>;
export function isTheme(value: unknown): value is Theme;
export function parseTheme(value: unknown): Theme;   // tolerant; falls back to DEFAULT_THEME
export const THEME_SCRIPT: string;
```

`THEME_LABEL` is a `Record`, not a lookup with a fallback, for the same reason
`PLANT_ROLE_ICONS` is: a fourth theme must fail `tsc` rather than quietly draw
as nothing.

No `"use client"` and no `lucide-react`: the root layout imports it, and the
root layout is in both zones. It is added to `lib/server-safe-source.test.ts`'s
list on the day it is written, per that file's own instruction.

### `THEME_SCRIPT` and the root layout

`app/layout.tsx` renders `THEME_SCRIPT` in `<head>`, beside `REGISTER_SW` —
the same shape and for the same reason. It is deliberately a **script tag and
not a component**: no directive, no boundary, no hydration, no chunk, so the
island count above is unaffected by it.

It must run **before first paint**, which is why it is inline and in `<head>`
rather than in the menu island: a theme applied after hydration is a flash of
the wrong theme on every cold load, in both zones.

```
(()=>{try{
  const t = localStorage.getItem("ariko_theme") || "system";
  const dark = t === "dark" ||
    (t === "system" && matchMedia("(prefers-color-scheme:dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}catch{}})()
```

The `try/catch` is required, not defensive habit: `localStorage` **throws** on
access in Safari private browsing, and an uncaught throw in a blocking head
script stops the parser.

No nonce is needed — `next.config.ts`'s CSP is one directive plus `object-src`
and carries no `script-src`, which is the same reason `REGISTER_SW` needs none.

### `components/ui/menu.tsx` — from the registry

`npx shadcn@latest add menu`. `components.json` already carries `menuColor:
"inverted-translucent"` and `menuAccent: "subtle"`, so the primitive lands
themed. It is a client component and stays one; it is **not** added to
`SERVER_SAFE`.

### `app/(public)/_components/preferences-menu.tsx` — new island

`"use client"`. Props: `{ lang: Lang; authed: boolean }`.

**Trigger.** A `Menu.Trigger` rendered with `chromeItemClass()` and wrapped in a
`ChromeItem`, so it is geometrically identical to every other chrome control:
size-9 ghost box, CSS hover label, the same focus ring. The glyph is
`lucide-react`'s `Settings`.

lucide is imported **directly** here, and that is not a violation of the public
zone's lucide rule — it is the rule working as intended. That rule exists
because one lucide import in a *server-safe* file drags a client boundary under
every public page. This file *is* the boundary, declared, in one place, holding
one cluster. `components/public-icons.tsx` gains no tenth glyph.

Base UI's `render` prop clones the element it is handed and forwards its props
and ref, which is exactly why `chromeItemClass()` is exported as a string rather
than hidden inside a component — the plant rail's `PopoverTrigger` already
composes this way.

**Language group.** A `Menu.RadioGroup` of two items, each rendered as a real
`<a href="?lang=en">` / `?lang=fr`. The mechanism is completely unchanged: still
a link, still the middleware, still a cookie, still a redirect to the clean URL.
Checked state comes from the server-supplied `lang` prop, so it is correct in
the server HTML and needs no effect.

The hrefs stay **bare query strings**, resolved by the browser against the
current URL, exactly as `lang-switch.tsx` argued: this component never has to
know the path it sits on, and never interpolates one.

**Theme group.** A `Menu.RadioGroup` of three, from `THEMES`. State is seeded in
a mount effect from `localStorage` (it cannot be known server-side); picking a
member writes `THEME_STORAGE_KEY` and toggles `.dark` on
`document.documentElement`. No navigation, no reload, no server round-trip.

Base UI portals the popup only while it is open, so the unknown-at-SSR theme
never renders into the server HTML and there is no hydration mismatch to
manage.

`"system"` is resolved by the same `matchMedia` expression the head script
uses. A visitor sitting on `system` while their OS flips does not get a live
update in this slice; that would need a `change` listener and is not worth an
extra subscription for a case the next navigation fixes.

**Admin entry.** A `next/link` to `/admin`, rendered only when `authed`. It is
`next/link` rather than `<a>` because this file is already a client component
and `/admin` is the zone that navigates client-side.

### Server side

`app/(public)/(chrome)/layout.tsx` already calls `cookies()`, so it is already
dynamic and reading one more cookie costs nothing new. It gains a single
`await isAuthenticated()` (reused from `app/admin/session.ts`) and passes
`authed` to the chrome.

The session cookie is `httpOnly`, which is why this must be a **server** read:
client JavaScript cannot see it, and a client guess would be wrong.

`app/(public)/_components/public-chrome.tsx` swaps its `content` cluster for a
plain icon cluster holding the island. It is not in `SERVER_SAFE`, so importing
a client component from it is legal and unwatched — correct, because a server
component importing a client component is the ordinary arrangement, and the
list exists to catch a server-safe file becoming a client one.

`components/lang-switch.tsx` is **deleted**. Its whole job moves into the menu,
and a module left behind with no importer is the kind of thing a later slice
reaches for by accident.

The public home page (`app/(public)/page.tsx`) sits outside the chrome group and
has no chrome at all. It had no language switch before this slice and has no
menu after it. Unchanged.

## Accessibility, and the one rule this bends

CLAUDE.md: *an icon trigger names its stored value.* The trigger's accessible
name is the only place a reader learns what the control currently holds.

The theme is **not knowable server-side** — it lives in `localStorage`, which the
server cannot read. So the trigger renders:

```
aria-label="Preferences — English"
```

Language only: the value it inherits from the pill it replaces, and the one
value the server does know. The theme states itself on its own radio rows inside
the menu, where a radio group's checked state is the accessible statement.

This is an exception, and `lib/preferences-a11y.test.ts` pins it so it reads as
a recorded decision rather than as drift: the trigger names its language, the
theme rows name theirs, and the admin entry is absent unless `authed`.

## Tests

- **`lib/theme-script.test.ts`** — the important one. `THEME_SCRIPT` is a
  *string*, so renaming `THEME_STORAGE_KEY`, dropping a member of `THEMES`, or
  changing the class from `dark` leaves `tsc`, `npm test` and `npm run build`
  all passing while the theme silently stops persisting or stops applying. The
  test asserts the script contains `THEME_STORAGE_KEY`, the literal class
  `dark`, every member of `THEMES`, and a `try`/`catch`.
- **`lib/preferences-a11y.test.ts`** — renders the island and asserts the
  trigger's accessible name carries the current language, that both language
  rows are anchors to `?lang=…` with the current one checked, that all three
  theme rows are present and labelled from `THEME_LABEL`, and that the Admin
  entry renders only when `authed`.
- **`lib/server-safe-source.test.ts`** — `lib/theme.ts` added to the list.
- No mount test is needed. Nothing here is destructive, so an unmounted island
  is simply absent — unlike `MediaPicker`, whose absence would post an empty
  media list.

## Rulebook changes

CLAUDE.md's "Script, by zone" section:

- "Today the public zone has exactly one island, `components/toc-rail.tsx`"
  becomes two, naming the preferences menu, with the reasoning above and the
  stated cost (script-off loses the language switch).
- A note that the menu island imports `lucide-react` **deliberately**, and that
  this is the public zone's lucide rule working rather than being broken: the
  rule forbids lucide in *server-safe* files, and this file is a declared client
  boundary.

## Out of scope

- **A theme control in the admin chrome.** The `.dark` class is on `<html>` from
  the root layout, so the admin honours whatever the visitor chose — but the
  author cannot change it from inside the admin in this slice. Follow-up.
- **`THEME_COLOR` in `viewport`.** It stays one value; a dark-aware installed
  window colour is a separate question.
- **`public/offline.html`.** Static, precached, inlines its own mark; it will not
  pick up the class, and the service worker's no-runtime-write rule means it
  cannot be taught to.
- **Live `system` updates** when the OS theme flips mid-session.
