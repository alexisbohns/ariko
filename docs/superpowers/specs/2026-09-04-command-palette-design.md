# Command palette — design

**Date:** 2026-09-04
**Status:** approved, ready to implement
**Slice:** ⌘K — the admin gets a way to go anywhere without looking for it

---

## 1. Intention

The fluid-admin slice put the chrome out of the way and made seed capture a keystroke. It left one
thing untouched: **getting to a specific thing still means navigating to a list and reading it.** To
open a plant you go to the Garden and scan; to open a sprout you go to the Vault, maybe filter, and
scan. The rail is four destinations, and everything past those four is a search performed by eye.

The palette is the other half of that gesture. `k` writes something down; **⌘K goes somewhere**.

One intention, stated once: **the fastest path to any page in the admin should be its name.**

This is deliberately a *navigator*, not a command runner. It does not publish, delete, promote, or
sync. Every row does exactly one thing — it goes to a page — and that is what keeps it small enough
to trust and cheap enough to keep correct. Verbs are a later decision, not a deferred obligation.

## 2. Shape and behaviour

**⌘K on macOS, Ctrl+K elsewhere**, anywhere in the admin except `/admin/login`, opens a
full-viewport blurred sheet: the seed overlay's shell, one octave up. A single bare centred input in
`font-heading`, no border, no magnifier icon, no label. Rows rise underneath it, grouped, each with
its kind on the right.

- **Empty query → the four sections only** — Inbox, Vault, Garden, Beanstalk. A calm opening frame,
  and (see §6) the one thing that never depends on the network.
- **Any query → filters across everything**: sections, plants, pods, beans, sprouts, and inbox
  seeds, in that group order. Capped at 20 rows in total (not per group) through the primitive's own `limit`.
- ↑↓ moves the highlight, Enter navigates, Escape closes and restores focus, a click navigates.
  Navigation is `router.push` — a soft navigation, like every other link in the admin.
- **Nothing in the palette writes.** There is no submit, no server action, no form.

A small **search icon button joins the top-right cluster**, beside "Public site". It is the visible
handle that gives ⌘K a discoverable twin, exactly as the `+` beside the inbox title does for `k`.
Its tooltip names the shortcut.

### Why Base UI's `Autocomplete`, and the registry deviation

`CLAUDE.md` says never hand-roll a primitive the registry already has. The registry, at style
`base-nova`, has no `autocomplete`. It has two neighbours, and neither is this:

- **`combobox`** — the same Base UI family, but styled as a *bounded field with a popup*, which is
  the wrong shape for a sheet that is already full-bleed.
- **`command`** — the familiar cmdk palette, which would add a `cmdk` dependency and a second,
  divergent dialog convention alongside `components/ui/dialog.tsx`.

So `components/ui/autocomplete.tsx` is local — but it is **not a hand-rolled primitive**. The
behaviour is `@base-ui/react`'s `Autocomplete`, already installed, whose own documentation names
"filterable command pickers" as an intended use. The part classnames are lifted verbatim from the
registry's `combobox.tsx`, which is legitimate rather than merely convenient: Base UI's Autocomplete
*re-exports Combobox's own* `List` / `Item` / `Empty` / `Group` / `GroupLabel` / `Status` types, so
the two share a part vocabulary. Same tokens, same look, no new dependency.

What is dropped from that file: the Positioner, Popup, Portal, Trigger, Clear, Chips and Value
parts. The sheet is the popup; nothing here is anchored to a field.

## 3. Modules

| File | Responsibility |
|---|---|
| `lib/palette.ts` | **Pure and JSX-free**, so `npm test` reaches it. Owns `PaletteItem` and `buildPaletteIndex`. |
| `app/admin/palette/route.ts` | `GET` returning the index as JSON. |
| `components/ui/autocomplete.tsx` | The registry-shaped wrapper over Base UI `Autocomplete` (§2). |
| `app/admin/_components/command-palette.tsx` | The client component: hotkey, dialog, fetch, render. |

### `lib/palette.ts`

```ts
export type PaletteKind = "section" | "plant" | "pod" | "bean" | "sprout" | "seed";

export interface PaletteItem {
  id: string;        // stable and unique across kinds, e.g. "plant:pebbles"
  kind: PaletteKind;
  label: string;     // already resolved out of Text — the client never sees a bilingual object
  sublabel?: string; // the parent's name where there is one; the note snippet for a seed
  href: string;
  group: string;     // the group heading: "Go to" | "Garden" | "Vault" | "Inbox"
}

export function buildPaletteIndex(input: {
  dataset: Dataset;
  seeds: Seed[];
}): PaletteItem[];
```

Three things this function owns, and each is why it is a module rather than a line in the route:

- **Bilingual resolution.** Every `name`/`title` goes through `resolveText` here. The wire format is
  plain strings, so the client component holds no opinion about language.
- **Sections come from `NAV_ITEMS`** in `lib/admin-nav.ts` — imported, not re-typed. One source of
  truth for the rail and the palette; a fifth section appears in both or in neither.
- **Href construction**, matching the links the admin already renders:
  `/admin/plant/:slug`, `/admin/pod/:slug`, `/admin/bean/:slug`, `/admin/sprout/:slug`,
  `/admin/triage/:id`. (The bean detail route's param is spelled `[id]` but carries a slug — this is
  what `app/admin/vault/page.tsx` already links to.)

Group order is fixed by the function, not by the client: `Go to`, `Garden` (plants then pods),
`Vault` (beans then sprouts), `Inbox` (seeds, newest first).

### `app/admin/palette/route.ts`

`GET`, `export const dynamic = "force-dynamic"`, responding with `Cache-Control: no-store`. It loads
`getFullDataset()` and `listSeeds({ status: "inbox" })`, hands both to `buildPaletteIndex`, and
returns `{ items }`.

**It lives under `/admin`, not under `/api`, and that is the whole point.** `middleware.ts` matches
`/admin/:path*` and already redirects an unauthenticated request to the login page. Putting the
route there means the index inherits the session gate with **zero new auth code** — no token
parsing, no second cookie check, no new surface to get wrong. A sibling under `/api/admin/…` would
fall outside that matcher and would have to re-implement the gate.

### `app/admin/_components/command-palette.tsx`

Rendered by `AdminChrome`, placed **after** its `pathname === "/admin/login"` early return — so the
palette withdraws on the login page along with the rail and the account cluster, for free, with no
second route constant.

`useHotkey("Mod+K", …)` from `@tanstack/react-hotkeys`, already a dependency. Two of the library's
defaults are relied on deliberately and should not be overridden:

- **`ignoreInputs` defaults to `false` for Ctrl/Meta combinations** (it is `true` only for bare
  single keys and Shift/Alt combos). So ⌘K opens from inside the TipTap editor and from inside the
  seed overlay's fields — which is what a palette must do.
- **`preventDefault` defaults to `true`**, which is what takes ⌘K back from the browser's own
  address-bar search.

The shell is `components/ui/dialog.tsx` with the seed overlay's exact treatment — a
`bg-background/70 backdrop-blur-xl` overlay under a transparent full-bleed popup, `initialFocus` on
the input, `finalFocus` on the search button, and the same hand-rolled outside-press dismissal on
the empty surround (the popup covers the viewport, so nothing is ever "outside" it for the
primitive to catch).

## 4. Data flow

```
⌘K  →  open
       ├─ cache present → render it immediately, refetch in the background,
       │                  swap when the new index lands
       └─ no cache      → render the four sections + a quiet Status line,
                          then fetch

       GET /admin/palette      (session-gated by the existing middleware)
       → cache in component state for the session

Enter / click  →  router.push(item.href)  →  close
```

The palette is **an island that costs nothing until it is used**: no admin page's render cost
changes, because nothing is loaded for it until ⌘K is pressed. That is the same shape the media
picker's rule already takes, and it is why the route-handler approach was chosen over
server-rendering the index into `app/admin/layout.tsx` — which would have made every admin page,
including the inbox and every detail page, pay a full dataset load whether or not the palette was
ever opened.

Refetching on **every** open, rather than once, is what keeps it honest: an author who has just
created a sprout finds it in the palette on the next press, without a reload.

## 5. The four sections are never fetched

The `Go to` group is built **client-side from `NAV_ITEMS`**, the same import `lib/palette.ts` uses
on the server. The route returns them too — the index is complete on its own terms — but the client
does not wait for them.

This is one line of code and it carries §6 entirely: the palette always has something in it, and it
is never a box that opens onto nothing.

## 6. Error handling

| Case | Behaviour |
|---|---|
| First fetch fails | The sheet stays open on the four sections, with a single line — "Could not load the index" — in the Status slot. Not a dialog, not a retry button. |
| A later refetch fails | The previous cache stays. A stale index beats an empty one, and the author is told nothing, because nothing they can act on has changed. |
| The route throws (dataset or Mongo unavailable) | `500` with `{ error }`; the client treats it as a failed fetch, above. |
| Query matches nothing | The primitive's `Empty` part: "Nothing matches." |

## 7. The zero-client-JS rule — the fourth exception, and the mildest

`CLAUDE.md` names three exceptions today: the prose editor and the media picker (both contained),
and seed capture (a real loss, taken deliberately).

**The palette is the fourth, and it is the mildest of the four.** Without script it renders nothing,
⌘K does nothing, and the search button is not there — and **its absence costs nothing**, because
every destination it offers is still reachable exactly as it was: the four sections from the rail,
and every plant, pod, bean, sprout and seed from the list page that already links to it. The palette
adds no destination of its own. It is a faster route to pages that all still have their slow route.

Nothing is destroyed, nothing is silently mis-saved, and nothing becomes unreachable — because the
palette **never writes**. That is what separates it from the seed overlay: the overlay's exception
had to be argued for, because capture genuinely disappears with it. This one is closer to the media
picker's contained loss than to the seed overlay's real one.

`CLAUDE.md` gets a short paragraph saying exactly this, so the rule is amended rather than quietly
eroded.

Two neighbours worth naming so they are not mistaken for a widening:

- The **search icon button** is chrome, not a form. It is a `<button>` inside the palette island, so
  script-off it is simply absent — not a dead control.
- **Every admin metadata form is untouched.** The palette adds no field to any of them and posts to
  no server action.

## 8. Testing

Three files, following conventions the repo already has.

- **`lib/palette.test.ts`** — the pure module. Index shape per kind; bilingual `Text` resolved to a
  plain string; hrefs for all five detail kinds; the `Go to` group sourced from `NAV_ITEMS` (a test
  that fails if the sections are ever re-typed by hand); an empty dataset yields the sections and
  nothing else; only inbox-status seeds appear; group ordering.
- **`lib/palette-route.test.ts`** — following `lib/inbox-route.test.ts`: import `GET` directly,
  assert status, JSON shape and the `no-store` header.
- **`lib/palette-mount.test.ts`** — following `lib/media-picker-mount.test.ts`, and for the same
  reason. `renderToStaticMarkup` proves the palette emits **nothing** server-side, pinning the §7
  claim against a future change that server-renders rows "for a faster first paint".

## 9. Accepted edges

- **Stacking with the seed overlay.** ⌘K from inside the seed overlay opens the palette on top of
  it; Escape closes the palette and returns focus to the seed form. Navigating away from there
  discards an unsaved seed — but so does clicking any nav item today, so it is not a new hazard, and
  coupling the two components to prevent it would cost more than it protects. The reverse direction
  is already safe: the seed overlay's bare `k` cannot fire from the palette's input, because
  single-key hotkeys default to `ignoreInputs: true`.
- **No recents, no ranking, no fuzzy matching.** Substring matching on the label, which is the
  primitive's default. A personal garden is small enough that ranking would be decoration.
- **No public-zone palette.** ⌘K is an authoring tool. The public site is a different audience and
  would be a different feature.

## 10. Out of scope

Verbs (New seed, Sync now, Log out), sprout/bean creation from the palette, a `>` command mode,
recent-destination memory, and any public-site palette. Each is a decision to take later on its own
merits, not a phase of this one.
