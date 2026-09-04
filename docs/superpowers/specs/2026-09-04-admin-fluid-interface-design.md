# Admin fluid interface — design

**Date:** 2026-09-04
**Status:** approved, ready to implement
**Slice:** the admin stops looking like a form and starts looking like a tool

---

## 1. Intention

The admin works. It is also a wall of stacked cards under a text bar, and every page opens with the
same eight-field Seed form whether or not the visit is about capturing a seed.

Three changes, one intention — **put the chrome out of the way and the content in the middle**:

- **The header dissolves.** Navigation becomes a floating icon rail on the left edge, vertically
  centred, labels on hover. The two account actions — public site, log out — float top-right as icon
  buttons. Nothing spans the top any more.
- **Seed capture becomes a gesture.** The form leaves the inbox page. A `+` beside the page title
  opens it, and so does the `k` key. It arrives as a full-screen blurred overlay with a centred,
  autofocused title and no labels at all — the shape of a thought being written down, not a record
  being filled in.
- **Vault filters collapse.** Three rows of badges become three icon popovers that only open when
  asked.

The common thread: the interface should be *quiet until used*. This is a personal capture tool, and
the fastest path to a seed should be a keystroke.

## 2. The zero-client-JS rule, and this slice's exception

`CLAUDE.md` holds the admin's metadata forms to zero client JavaScript: they render as plain HTML,
the browser posts them, no bundle is involved. Two exceptions are already named and contained — the
prose editor and the media picker.

**The seed overlay is the third, and it is a genuine loss, taken deliberately.** An overlay that
opens on a keystroke, autofocuses, and blurs the page behind it cannot exist without script. There
is no meaningful half-measure: a fallback `/admin/seed` page would be a second form writing the same
seed, maintained by nobody and exercised by no one.

So, plainly: **without script, `/admin` shows the inbox list and offers no way to capture a seed.**
The `+` does nothing, `k` does nothing. Nothing is destroyed and nothing is silently mis-saved — the
overlay simply is not there — but capture is gone. That is the trade, and `CLAUDE.md` is amended to
say so rather than to let the rule quietly rot.

What does *not* change: the overlay posts to `createSeedAction`, the same server action, with the
same field names. The exception is the shell, never the write path.

The two other pieces of this slice cost nothing under the rule. The chrome is chrome, not a form —
its links are `<a href>` and log out is still a real `<form>` with a real submit button. The vault
popovers are client shells around links that already work.

## 3. Chrome moves into the layout

Today `admin-bar.tsx` is rendered by each page with a hand-passed `current` prop — eleven call sites
across nine files, and the login page opts out by simply not calling it.

The floating chrome inverts that. `app/admin/layout.tsx` renders one client component,
`app/admin/_components/admin-chrome.tsx`, which derives its active item from `usePathname()`. The
`current` prop disappears, all eleven call sites are deleted, and `admin-bar.tsx` with them.

The login page stays bare because the chrome returns `null` when the pathname is `/admin/login`.
This is the one behaviour the old opt-out gave for free, so it is worth naming: a route group would
express it more structurally, but moving every admin directory to earn that is disproportionate to
one `if`.

**Left rail.** `fixed left-4 top-1/2 -translate-y-1/2`, a rounded vertical pill —
`bg-card/80 backdrop-blur border shadow-lg` — holding four icon links:

| Item      | Href               | Icon (lucide) |
| --------- | ------------------ | ------------- |
| Inbox     | `/admin`           | `Inbox`       |
| Vault     | `/admin/vault`     | `Archive`     |
| Garden    | `/admin/garden`    | `Sprout`      |
| Beanstalk | `/admin/beanstalk` | `Waypoints`   |

The active item takes a filled `bg-accent` treatment. Each icon carries its label in a Base UI
tooltip anchored to its right, shown on hover and on focus. Every item is a plain `<a href>`; the
rail navigates the way the text bar did.

Pages that are conceptually under a section keep pointing at it — the sprout, bean and vault pages
all light Vault; pod and plant light Garden; triage lights Inbox. `usePathname()` resolves this with
a prefix match rather than an equality check, with `/admin` handled exactly (it is a prefix of
everything).

**Top-right.** `fixed right-4 top-4`, two ghost icon buttons: public site (`ExternalLink` → `/`) and
log out (`LogOut`, wrapping the existing `<form action={logoutAction}>`). Both tooltipped the same
way. Log out remains a submit button inside a real form — an icon button is still a button.

**Content.** The layout's `mx-auto max-w-5xl px-6 py-8` becomes `pl-20 pr-16` so content clears the
fixed rail and the top-right cluster, keeping the centred max-width column.

## 4. Seed capture becomes an overlay

`app/admin/page.tsx` loses the entire `Seed` card. What remains is a title line and the table:

```
Inbox (7)                                                    [+]
```

The `+` is an icon button on the right of that line. It and the overlay both live in
`app/admin/_components/seed-overlay.tsx`, a client component — one island, one file, so the page
itself stays a server component that only reads and renders the inbox.

**Hotkeys.** `useHotkey('k', open)` and `useHotkey('Escape', close, { enabled: open })`, from
`@tanstack/react-hotkeys`. The library's defaults are the right ones here and are relied on
deliberately: bare single keys default `ignoreInputs: true`, so `k` does not fire while typing into
a field — including the overlay's own fields — and `Escape` defaults `ignoreInputs: false`, so it
closes the overlay from inside the title input.

**The overlay.** `fixed inset-0 z-50 bg-background/70 backdrop-blur-xl`, contents in a centred
column. It is one `<form action={createSeedAction}>`:

- **Title** — borderless, transparent, centred, large display type, placeholder only, no label,
  `autoFocus`. `name="title"`, still `required`.
- **Note** — transparent auto-growing textarea beneath it, placeholder only. `name="note"`.
- **Control row**, compact, beneath the note:
  - **Language toggle** — a button cycling 🇬🇧 / 🇫🇷, writing to a hidden `name="lang"` input
    (`en` / `fr`). Replaces the radio fieldset.
  - **Link** — a transparent URL field, `name="link"`; a second appears once the first has content.
    Both submit under the same name, which is what the action already expects.
  - **Media** — `<MediaPicker name="image" />`, presenting as a small image icon.
  - **Send** — a circular icon submit button, right-aligned.

Dismissal: `Escape`, a click on the backdrop, or a close control. The `?error=` banner renders
*inside* the overlay when present, and the overlay opens on mount when the param is set — otherwise
a failed save would redirect to a page showing nothing about the failure.

Native inputs throughout, styled to look like bare text — not `contenteditable`. The rendered result
is identical, and native fields keep IME and accented input, undo, `required` validation, autofocus,
and browser autofill for free, with no text-to-hidden-input sync layer.

The overlay uses `bg-background/70`, not literal white, so it reads correctly in both themes.

## 5. Vault filters become popovers

`app/admin/vault/page.tsx` replaces its three `filterRow` calls with a single row of three icon
popover triggers:

| Dimension | Icon         |
| --------- | ------------ |
| state     | `CircleDot`  |
| plant     | `Sprout`     |
| tag       | `Tag`        |

A trigger whose dimension is filtered shows the active value as a small badge beside its icon; an
unfiltered trigger is a bare icon. Inside each popover the options are stacked
`<a href={vaultHref(active, key, opt)}>` links — exactly the links rendered inline today.

`filterVaultEntries`, `vaultHref`, `distinctPlants` and `distinctTags` are untouched. Filtering
stays server-side and filter URLs stay shareable and bookmarkable; the popover is a container and
nothing more. The trigger row itself is a small client component
(`app/admin/_components/vault-filters.tsx`) taking the options and the active state as props, so the
page stays a server component.

## 6. Dependencies

- `@tanstack/react-hotkeys` (and its `@tanstack/hotkeys` core) — hotkey registration.
- `npx shadcn@latest add tooltip popover` — the two Base UI primitives the design needs, per
  `CLAUDE.md`'s rule against hand-rolling what the registry has.

## 7. Testing

The repo tests pure functions under `node --test`, not rendered React, and this slice adds almost no
pure logic — it is chrome, an overlay, and three popovers around existing links.

What *is* pure and worth a test: the rail's active-item resolution. It is extracted as
`resolveNavItem(pathname)` in `admin-chrome.tsx`'s module (or a small sibling), and tested for the
cases the prefix match makes non-obvious — `/admin` matching Inbox exactly rather than everything,
`/admin/sprout/x` and `/admin/bean/x` resolving to Vault, `/admin/plant/x` and `/admin/pod/x` to
Garden, `/admin/triage/x` to Inbox, and `/admin/login` to none.

Everything else is verified by running the admin: the rail navigates and tooltips on hover, `k` and
`+` both open the overlay, `Escape` and a backdrop click close it, a seed round-trips through
`createSeedAction` and lands in the table, a failed save reopens the overlay with its banner, and
each vault popover's links still filter the table and survive a reload.

## 8. Out of scope

- Any change to the public zone. This is the admin only.
- Any change to `createSeedAction`, `filterVaultEntries`, or any other server logic.
- A hotkey beyond `k` and `Escape`. The provider arrives with this slice; more shortcuts are a later
  decision, not a free extension of this one.
- Mobile-specific chrome. The rail is narrow and fixed; it stays where it is at every width.
