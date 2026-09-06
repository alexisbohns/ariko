# Shared surfaces — one vocabulary, two zones

*2026-09-06*

## 0. The observation

`components/chrome-plate.ts` already proves the pattern this slice wants: one
decision, every consumer, and a header explaining why a floating cluster that
disagrees with itself about its own grey reads as several unrelated things stuck
to the edges of one page.

It stopped at the paint. The **geometry** never followed, and neither did
anything else the two zones draw twice:

| | public | admin |
|---|---|---|
| chrome plate | `CHROME_PLATE` | `CHROME_PLATE` |
| chrome *shell* | hand-rolled `<nav>` + `IconLink` (CSS label) | hand-rolled `<nav>` + Base UI `Tooltip` |
| plant title | `font-display text-4xl font-normal` | `font-heading text-3xl font-medium` |
| plant mark | `SQUIRCLE`, `size-28`, `initialsOf` fallback | `SQUIRCLE`, `size-28`, `initialsOf` fallback |
| reading column | `max-w-3xl px-6` → 720px, centred | `max-w-5xl pl-20 pr-36` → 800px, **off-centre** |
| entity card | `CardContent` default, cover, no ref | `py-4` override, no cover, `entity.ref` |

`SQUIRCLE = "rounded-[28%]"` is declared verbatim in two files. So is the mark
that uses it. `plant-head.tsx`'s own header says the two heads "share a SHAPE,
not an implementation" — which is an accurate description of the problem rather
than a justification of it.

This spec closes all four gaps. It is one design because it is one decision
applied four times, and four slices because it merges as four commits.

## 1. Slice one — `components/chrome.tsx`

### 1.1 What it is

Every floating cluster in Ariko is the same object: a plated container,
magnetized to a viewport edge, holding ghost icon-buttons that say their name on
hover. There are five of them and five implementations.

Three exports replace all five, and all three are **server-safe** — no
`"use client"`, no `lucide-react` import. That is what lets the *same file* serve
`app/(public)` and a client island in `app/admin`.

```tsx
<Chrome magnet="left" orientation="vertical" label="Admin sections">
  <ChromeLink href="/admin" label="Inbox" current><Inbox className="size-4" /></ChromeLink>
</Chrome>
```

- **`Chrome`** — `CHROME_PLATE`, `rounded-2xl p-1.5`, the flex axis, the magnet,
  and `<nav aria-label>` when `label` is given (a bare `<div>` otherwise: the
  account cluster is not a nav and never was).
- **`ChromeLink`** — the common case, an anchor. Eight of eleven call sites.
- **`ChromeItem`** — the box and the label only, for the three call sites whose
  control is not an anchor (log out's submit, the palette's trigger, the Inside
  rail's `PopoverTrigger`). Those build their own control with
  **`chromeItemClass(current?)`**.

`ChromeItem` deliberately does not own the control. Base UI's `render` prop
clones the element it is given and forwards props to it, so a component that
wrapped the control in a `<span>` would receive `PopoverTrigger`'s props on the
wrapper instead of on the button. Handing out the class string is the composition
that cannot break.

### 1.2 The label, and why it is CSS

`icon-link.tsx` argues this already: `Tooltip` is `"use client"`, and using it in
the public chrome would make **navigation** script-dependent to gain a hover
label. That is the one trade the public zone cannot make.

The admin does not need Base UI here either, and the reason is specific rather
than a concession: **a cluster magnetized to a viewport corner cannot collide
with anything.** Base UI's positioning earns its keep for floating elements
anchored to arbitrary in-flow triggers — every popover, sheet and the palette
keep it. A label on a fixed corner cluster has exactly one correct side, and it
is derivable from the magnet.

So the label is a sibling `<span aria-hidden>` inside a `group/icon` wrapper, and
its side is chosen by CSS from a `data-side` attribute the `Chrome` container
sets. No prop threading, no context, no client boundary.

The accessible name stays on the control's own `aria-label`, never on the visual
span — `icon-link.tsx`'s rule, kept.

**What is lost:** the shared delay group. A pointer sweeping the admin rail now
flashes each label in turn rather than opening one and keeping it open. Named
here so it is not rediscovered as a bug.

### 1.3 `lib/chrome-magnet.ts`

The pure half, and the piece that makes this one decision instead of five: eight
magnets → position classes, and eight magnets → label side.

| magnet | position | label side |
|---|---|---|
| `top-left` | `left-4 top-4` | `bottom` |
| `top-center` | `left-1/2 top-4 -translate-x-1/2` | `bottom` |
| `top-right` | `right-4 top-4` | `bottom` |
| `left` | `left-4 top-1/2 -translate-y-1/2` | `right` |
| `right` | `right-4 top-1/2 -translate-y-1/2` | `left` |
| `bottom-left` | `left-4 bottom-4` | `top` |
| `bottom-center` | `left-1/2 bottom-4 -translate-x-1/2` | `top` |
| `bottom-right` | `right-4 bottom-4` | `top` |

There is no centre-centre magnet. A cluster there would cover the page it floats
over.

The derivation **reproduces today's behaviour exactly** — the admin rail's
`side="right"`, the account cluster's `side="bottom"`, the Inside rail's
`side="left"`, `IconLink`'s `top-full`. Nothing moves.

### 1.4 Consumers

| cluster | magnet | orientation |
|---|---|---|
| admin rail | `left` | vertical |
| admin account cluster | `top-right` | horizontal |
| plant Inside rail | `right` | vertical |
| public nav | `top-left` | horizontal |
| public language | `top-right` | horizontal |

The language cluster is a *content* cluster rather than an icon cluster — it
holds text — so it passes `className` for its own radius and padding. That is the
one escape hatch, and it exists because `LangSwitch` is not an icon.

`icon-link.tsx` is deleted: `ChromeLink` is that component, generalised.

### 1.5 Consequences

- The account cluster's buttons go `size-8` → `size-9`, matching the rail. A
  "ghost set of icon-buttons" is one size.
- `TooltipProvider`, `Tooltip` and `Button` leave `admin-chrome.tsx` entirely.
- The admin rail's `<ul>/<li>` goes. `<nav>` holding anchors is what the public
  nav already does and is what `Chrome` renders.
- `plant-inside.tsx` keeps `PLATE_WHILE_OPEN` — the portaled popover moves focus
  out of the `<nav>`, so `focus-within` cannot hold the plate open. It passes it
  through `Chrome`'s `className`.

## 2. Slice two — `components/page-column.tsx`

### 2.1 The measure

```
READING_COLUMN = "mx-auto w-full max-w-3xl px-6"   →  720px content, centred
WIDE_COLUMN    = "mx-auto w-full max-w-5xl px-6"   →  tables only
```

Both zones render the same string, so on any screen wide enough for it the
content box is byte-for-byte the same width in the same place. That is the
whole of "pure WYSIWYG".

### 2.2 Clearance is outside the measure

The admin's clearance is currently *inside* its max-width — `max-w-5xl pl-20
pr-36` — which is why its column is both wider and left of centre. It moves to an
outer wrapper:

```
admin:  <main className="px-20 pb-20 pt-24">   <div className={READING_COLUMN | WIDE_COLUMN}>
public: <main className="pb-20 pt-24">         <div className={READING_COLUMN}>
```

The arithmetic, recorded the way `AdminMain`'s current comment records its own:

- **`pt-24` clears a top cluster.** A cluster is one `size-9` row inside `p-1.5`
  at `top-4`: it occupies y ∈ [16, 64]. 96px clears it with 32 to spare. This is
  what replaces `pr-36`, and it is why the "recompute if a fourth button is
  added" hazard disappears — vertical clearance does not depend on how many
  buttons the cluster holds.
- **`px-20` clears a side rail.** A rail is `size-9` inside `p-1.5` plus a 1px
  border — 50px — offset `left-4`, so it ends at x = 66. 80px clears it with 14
  to spare. Symmetric, so the column stays centred.

The public zone takes no horizontal clearance because it has no vertically
centred rail: its clusters are both at the top (cleared by `pt-24`), and
`TocRail` is `xl:block` only and lives in the gutter a centred 768px column
leaves. The two zones' clearances differ because their chromes differ; what is
identical is the measure, which is the thing that was wrong.

### 2.3 Which admin pages are wide

The wide routes are exactly the four `NAV_ITEMS` hrefs — `/admin`,
`/admin/vault`, `/admin/garden`, `/admin/beanstalk` — and those are exactly the
four pages that render a `Table`. So the rule needs no new list:

> **A section index is wide. Everything else under `/admin` is a reading column.
> The login page is bare.**

`resolveColumn(pathname)` joins `resolveNavItem` in `lib/admin-nav.ts`, derived
from `NAV_ITEMS` rather than from a parallel array that could drift from it.

### 2.4 Consequences

Admin reading pages go from a 800px box left of centre to a 720px box centred,
and gain 64px of top rhythm (`py-8` → `pt-24`) — which is what puts them under
the same sky as the public page.

## 3. Slice three — `components/plant-header.tsx`

### 3.1 What is shared

A server-safe file owning the layout and the tokens, filled by slots:

```tsx
<PlantHeader mark={…} title={…} description={…} facts={…}>{extra}</PlantHeader>
```

It renders the `<header className="flex flex-col items-center gap-5 text-center">`,
the `<h1>`, and the description paragraph. It also exports the mark:

```
PLANT_MARK  = "size-28 overflow-hidden bg-muted text-muted-foreground rounded-[28%]"
PlantMarkContent({ logoUrl, name })   // the <img>, or initialsOf(name)
```

The squircle radius is a **percentage** so the same class is right at every size
it is rendered at — the reason both files already chose it, now stated once.

### 3.2 The tokens

```
title:       font-display text-4xl font-normal tracking-tight sm:text-5xl
description: max-w-prose text-base text-muted-foreground
```

`font-normal` is mandatory rather than stylistic: Profane ships one weight, and
`app/globals.css` records that every user pairs it with `font-normal` so nothing
asks the family for a bold it does not have. An admin title in `font-medium`
was asking for exactly that.

The `<h1>` is rendered by the shared file in both zones. The admin's sheet
trigger goes *inside* it as the `title` slot, so the admin page still has exactly
one document title — the property `plant-hero.tsx` already protects.

### 3.3 What stays per-zone

The **facts row**. Public states words (`♔ Lead`, `⚡ Active`) in
`font-heading text-xs uppercase`; the admin draws three ghost icon triggers.
Those are different registers on purpose — a word is a fact, an icon is a
control — so `facts` is a slot and each zone fills it. The *vocabulary* behind
both is already shared (`lib/plant-role.ts`, `lib/plant-status.ts`,
`lib/glyphs.ts`), which is the part that must not drift.

Visibility stays absent from the public head. A private plant `notFound()`s, so
every plant that renders there is public by construction and a globe would be a
fact with no counterexample.

## 4. Slice four — `components/entity-card.tsx`

Two renderers exist: `components/entity.tsx` (public pages and admin read pages,
through `Prose`) and `components/editor/entity-views.tsx` (the tiptap node view).

```tsx
export function EntityCardBody({ name, description, cover, refText, interactive })
export function UnresolvedRef({ refValue })
```

The public wraps the body in `<a href>`; the editor wraps it in
`<NodeViewWrapper>`. `refText` is the single extra parameter the authoring space
passes — the same relationship the whole spec is about: one component, and one
space displays more of it.

- The `py-4` override dies. `CardContent`'s default padding governs both.
- `interactive` carries the link affordance (`group-hover:shadow-md`,
  `group-hover:underline`); the editor passes it false, because a card inside the
  editor is not going anywhere.
- The cover `<img>` stays a **direct child of `Card`** —
  `components/ui/card.tsx` ships `has-[>img:first-child]:pt-0` and
  `*:[img:first-child]:rounded-t-xl`, and both selectors match a direct child
  only. Nesting it produces an inset band with square corners.
- The editor leaves the cover slot empty. `EntityOption` carries no cover — it is
  derived from a bean's sprouts through `coverFor`, and `entityOptions()` reads
  the raw garden rather than a `Dataset`. Plumbing it is a separate slice, and
  the honest state until then is absence.
- `UnresolvedRef` is shared, and the editor's dashed box wins over the public's
  bare `<p>`: a placeholder should read as a placeholder. Admin read pages gain
  the frame. Public pages never see it — `showUnresolved` is admin-only, because
  on a public page an unresolved ref must render *nothing* (fail-closed).

## 5. Testing

- **`lib/chrome-magnet.test.ts`** — all eight magnets, both derivations. Pure,
  no DOM.
- **`lib/chrome-source.test.ts`** — asserts `components/chrome.tsx` contains no
  `"use client"` and imports nothing from `lucide-react`. This is the important
  one. Sharing the chrome puts a *new file on the public zone's critical path*,
  and both rules currently live only in `CLAUDE.md` prose. A `"use client"` added
  there for convenience would make the public site unnavigable without script,
  and `tsc`, `npm test` and `npm run build` would all pass. It follows the
  precedent of `lib/toc-mount.test.ts` and `components/public-icons.test.tsx`:
  the claim is enforced rather than aspirational.
- **`lib/admin-nav.test.ts`** gains `resolveColumn` cases, including that every
  `NAV_ITEMS` href is wide (so the two cannot drift) and that an unknown route
  gets the reading column rather than throwing.
- `lib/plant-hero-mount.test.ts` and `lib/toc-mount.test.ts` must pass
  **untouched**. If either needs editing, the refactor went wrong: the first pins
  that the plant header server-renders no half-built form, the second that the
  public zone's island renders nothing at all. Neither claim is changed by any of
  this.

## 6. What visibly changes

This slice is mostly factorization, but it is not *only* factorization, and the
list is short enough to state:

1. Admin plant title: Geist Mono 3xl medium → Profane 4xl/5xl normal.
2. Admin reading pages: 800px off-centre → 720px centred, `py-8` → `pt-24`.
3. Admin account-cluster buttons: `size-8` → `size-9`.
4. Admin hover labels: Base UI `Tooltip` → CSS. Same position, no delay group.
5. Editor entity cards lose their extra `py-4`.
6. Unresolved refs in the admin gain a dashed placeholder frame.

Everything else — every route, every server action, every form payload, every
accessible name — is unchanged.

## 7. Sequencing

Four commits, in order: **chrome → column → plant header → entity card.** Chrome
first because it is the only one that can regress navigation, so it wants the
most room to be looked at.

## 8. Deferred

- **Covers in the editor.** `EntityOption` → cover plumbing (§4). True WYSIWYG
  for entity cards; costs a change to `entityOptions()` and every caller.
- **A delay group for the CSS labels.** Doable with a `group`-scoped transition
  delay on the container, and not attempted here — three to four icons in a
  corner is exactly the case `icon-link.tsx` already judged acceptable.
- **`pod`/`bean`/`sprout` heads.** `PlantHeader` generalises to them, but they
  are not in front of us; generalise from a working thing rather than a guessed
  one.
