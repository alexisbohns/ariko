# The public plant page becomes its own object — design

**Date:** 2026-09-06
**Status:** approved
**Slice:** the exhibition learns the admin's manners — and gains its first island

---

## 1. Intention

`/admin/plant/[slug]` stopped being five stacked cards in the plant-page-pure slice: the mark sits
centred in a squircle, the name under it, and the three things a plant *is* — a role, a status, a
visibility — read as icons rather than as rows of a table. The public page for the same plant never
got the memo. It is still a small left-aligned logo, an `h1` in the mono face, and a strip of badges.

**The two zones now disagree about what a plant looks like**, and the disagreement is visible: the
author edits one shape and publishes another. This slice closes it — in the direction the admin
already went, because that is the shape that was designed.

Three other things ride along, and they are not decoration:

- **The reading column is too small.** `prose-sm` is 14px. A portfolio whose whole argument lives in
  prose should be set at 16.
- **The site header is a bar.** Every other surface in Ariko has learned to get out of the way (the
  admin rail, the vault popovers, the palette). The public header has not.
- **A long plant page has no map.** You can read it, but you cannot see where you are in it.

One intention, stated once: **the public plant page should read like the object the admin edits.**

## 2. The zone's script budget — the decision this slice actually spends

`app/(public)` has **no `"use client"` anywhere in it today**. That is not an accident; the roadmap
calls the zone's no-script promise a guiding constraint, and `lib/locale.ts` names it as the reason
the language switch is a bare `<a href="?lang=…">`.

Two things in this slice want script. They are answered differently, and the difference is the whole
design:

**The chrome does not spend it.** A visitor who cannot navigate has lost the site. So the icon rail
is server-rendered plain `<a href>`, and its tooltips are **CSS**, not a component — see §3.

**The TOC rail does, and it is the public zone's first island.** It is also the mildest exception in
the repo, in the strong sense `CLAUDE.md`'s media-picker rule uses:

> The rail renders **nothing until it mounts**. Script-off, the page is byte-for-byte what it was,
> and **its absence never costs anything** — every heading it points at is already in the prose
> beneath it, in document order, with an `id` on it. The rail adds no destination, no control and no
> information of its own. It is a *position indicator* for a document you can already read.

It also **never writes**: no form, no server action, no submit. Like the palette, it is a navigator.

### Why not a CSS-only TOC

`scroll-timeline` could in principle drive the active dash with no JS. It cannot drive **three**
states — "passed" requires knowing the index of the active heading relative to every other one — and
it is not implemented widely enough to be the only mechanism on a public page. A partly-working rail
is worse than an absent one: a "you are here" that is sometimes wrong is a lie, where a rail that is
not there is simply not there.

## 3. The chrome — `app/(public)/(chrome)/layout.tsx`

The `<header>` bar is deleted. Three fixed clusters replace it, all server-rendered, all zero JS:

```
┌────────────────────────────────────────────────────────────┐
│  ◈  ⌗ ⌥                                                FR  │  left-4 top-4 · right-4 top-4
│                                                            │
│   ▬                        ╭───╮                           │
│   ▬                        │ ◐ │   mark, 112px squircle    │
│   ━                        ╰───╯                           │
│   ▭                       Melogram          ← Profane      │
│   ▭                  A listening machine                   │
│   ▭             ♔ Lead · Head of Product                   │
│   ↑                     ⚡ Active                          │
│  TOC                  [work] [studio]                      │
│                                                            │
│                    prose, 16px, mono headings              │
└────────────────────────────────────────────────────────────┘
```

- **Top-left**: `ArikoIcon` linking to `/`, then two icon links — Directory (`/`) and Beanstalk
  (`/beanstalk`).
- The icons are **the admin rail's own**: `Sprout` for the directory of plants, `Waypoints` for the
  beanstalk. Two zones, one vocabulary; a visitor who becomes the author sees the same glyph mean
  the same thing.
- The mark and "Directory" both point at `/`. That duplication exists in the header today (the logo
  and the "Directory" link) and is kept deliberately: the mark is the brand, the icon is a nav item,
  and a nav whose first item is missing reads as broken.
- **Top-right**: `LangSwitch`, unchanged and untouched.
- `<main>` keeps `mx-auto max-w-3xl px-6` and gains top padding to clear the cluster.

### Tooltips without script — the registry deviation, stated

`CLAUDE.md` says never hand-roll a primitive the registry already has, and the registry has
`tooltip`. It is `@base-ui/react`'s, and it is `"use client"` — using it here would make the public
zone's navigation script-dependent to gain a hover label.

So `components/icon-link.tsx` does it in CSS: `group-hover` / `group-focus-visible` on an
`aria-hidden` label span, positioned beside the icon. This is a deviation worth naming rather than
hiding, and it is the *good* direction of the trade:

- The accessible name is on the `<a>`'s `aria-label`, not on the visual span — so the label a screen
  reader announces does not depend on the hover affordance existing at all.
- **It works with script off**, which the registry component does not. The hand-rolled version is
  strictly more capable *for this zone*, which is the only circumstance under which hand-rolling one
  is right.
- It is a label on hover, not a tooltip *primitive*: no portal, no positioning engine, no
  focus-management, no delay groups. Nothing the registry component earns its complexity for is
  needed by three fixed icons in a corner.

The admin keeps the real `Tooltip`. This component is public-zone only.

### No lucide in the public zone — the icons are inline SVG

`components/media.tsx` carries the rule in capitals, and it is not a style note:

> NO LUCIDE ICONS HERE, and not by oversight: lucide-react@1.33 routes every icon through an
> Icon.mjs carrying "use client", so a single `<ExternalLink />` would push a client boundary into a
> zone whose whole rule is that it has none. **The same applies to every other public server
> component.**

This slice wants five glyphs in public server components — `Sprout` and `Waypoints` in the chrome,
`Crown`, `Zap` and `ZapOff` in the plant head. Importing them from `lucide-react` would put five
client boundaries into the zone to draw five static shapes, which is the exact trade that comment
forbids.

So `components/public-icons.tsx` is a **server** module holding those five as plain inline
`<svg aria-hidden>` components, with lucide's own path data (lucide-react is ISC-licensed; the
licence and the icon names are recorded in the file's header). The glyphs are therefore *identical*
to the admin's — the shared vocabulary in §3 and §4 is preserved exactly — while the zone keeps its
promise.

The one client component in this slice, the TOC rail, needs no icon at all: it draws dashes.

This is the second registry-adjacent deviation in the slice, and it has the same shape as the first
(§3, the CSS tooltip): the zone's constraint is real, the copied artefact is inert data, and the
alternative is strictly worse for the visitor.

## 4. The plant head — `app/(public)/_components/plant-head.tsx`

A **server** component. It mirrors `app/admin/_components/plant-hero.tsx`'s composition and drops
every editor: nothing here opens, nothing here writes, nothing here is a button.

Centred stack, in order:

1. **The mark** — `size-28`, the admin's `rounded-[28%]` squircle (a percentage radius, so the same
   class is right at every size), Cloudinary-thumbed at 224px for a 2x display.
   **With an `initialsOf` fallback**, which the current page does not have. This is a real change and
   it is forced by the layout: a left-aligned logo can be absent and the title simply moves up, but a
   *centred* stack with a missing first element collapses into something that looks broken rather
   than logo-less. The fallback is the one the garden table, the palette and the admin hero already
   draw, so a plant with no mark looks the same in all four places.
2. **The name** — `<h1 class="font-display font-normal">`, the Profane face. `font-normal` is
   mandatory and not a style choice: the family ships one weight, and `app/globals.css` records that
   every user pairs it with `font-normal` so nothing asks it for a bold it does not have.
3. **The description** — `text-base text-muted-foreground`, `max-w-prose`.
4. **The role and status row** — icon + label, both always present (see §4.1). The inline
   `Crown` from `components/public-icons.tsx` (never lucide — see §3) + the
   one-line role from `lib/plant-role.ts`; the inline `Zap` / `ZapOff` + the label from
   `lib/plant-status.ts`.
   Active carries the admin hero's `text-primary` tint, so "active" is a colour in both zones.
5. **`role.detail`** — the role's one line of context, muted, when present. Plain text, never
   markdown, exactly as today.
6. **Natures** — the existing secondary badges, kept, demoted below the icon row.

**Visibility is not on this page and never will be.** A private plant `notFound()`s, so every plant
that renders here is public by construction; a globe icon would be a fact with no counterexample.

### 4.1 Overturning the "active is unmarked" rule

The current page renders a status badge **only when inactive**, and the comment explains why: active
is the unmarked default everywhere in the feature, and a badge saying "Active" on every plant page
would be noise.

That reasoning was right about a **badge**. It is not right about an **icon+label pair**, which is
the register this row is now in: `⚡ Active` beside `♔ Lead` reads as one of two facts stated about
the plant, where a lone pill in a strip of pills reads as an assertion demanding attention. The
admin hero states both unconditionally for the same reason.

The old comment is **rewritten, not deleted**. A rule that is silently dropped comes back as a bug
report six months later; a rule that records why it was overturned does not.

### 4.2 The Profane preload

The face is not bundled — it is served from Cloudinary (`app/fonts.ts`), so next/font does no
build-time work for it and nothing preloads it automatically. Today the landing page carries a
hand-written `<link rel="preload" crossOrigin="anonymous">` and is the only page wearing the face.

This slice gives the face a second wearer, so the link becomes
`components/brand/profane-preload.tsx` and both pages render it. **Only pages that wear the face ask
for it** — that rule is preserved, not widened. `crossOrigin` stays: a font fetch is always an
anonymous CORS request, and without it the browser downloads the file twice.

## 5. Prose typography — `components/markdown.tsx`

One edit, on the `Prose` wrapper:

- `prose prose-sm` → `prose` — a 16px base instead of 14.
- `prose-headings:font-heading prose-headings:font-medium` — headings move to Geist Mono at medium.

**This touches four surfaces, and one of them is in the admin**: `/admin/sprout/[slug]` renders
`<Prose>` too. That is intended rather than tolerated — the admin's is a *preview* of the public
render, and a preview set two points smaller than the thing it previews is a preview that lies. It
is still a visible admin change and is called out here so it is not discovered as a surprise.

The three public callers (plant, pod, bean) are unchanged; they pass the same props.

## 6. The reference card — `components/entity.tsx`

Two changes to `EntityCard`, the `::entity{ref=…}` preview rendered inside prose:

- **`CardContent` `py-4` → `py-8`.** The card is now embedded in 16px prose and needs the room.
- **The whole card becomes the link.** Today only the name line is an `<a>`; the cover and the
  description are dead pixels over a link-shaped object.

The anchor goes **outside** `Card`, not around the image:

```
<a class="not-prose group my-4 block"> <Card> <img/> <CardContent>…</CardContent> </Card> </a>
```

That placement is load-bearing and the existing comment says why: `components/ui/card.tsx` ships
`has-[>img:first-child]:pt-0` and `*:[img:first-child]:rounded-t-xl`, and **both selectors match a
direct-child `<img>` only**. An anchor wrapped around the image silently opts out and produces an
inset band with square corners. Wrapping the whole card keeps the image where those selectors can
see it.

Inside, the name becomes a `<span>` with `group-hover:underline`. One anchor, one destination, no
nesting, and the accessible name still comes from the name text — so nothing needs an `aria-hidden`
or a `tabIndex={-1}` to suppress a duplicate. The comment explaining the old arrangement is
rewritten; it also still cites `app/(public)/layout.tsx`, a file that no longer exists.

## 7. The TOC rail — `components/toc-rail.tsx`, the island

Rendered once by `(chrome)/layout.tsx`, so plant, pod and bean pages all get it and no page opts in.

### 7.1 Where the headings come from

**A DOM scan on mount**, not a server-side extraction:

```
document.querySelectorAll("main h2[id], main h3[id]")
```

`lib/markdown.ts` already runs `rehypeSlug`, so every heading in every prose surface already carries
an `id`. Scanning the rendered DOM reads **exactly what `rehypeSlug` emitted** — the anchors cannot
drift from the targets, because they are read from the targets.

The alternative was to re-walk the markdown server-side and pass a `headings[]` prop. That would add
a **fourth reader of the one corpus**, which is precisely the shape the tiptap slice's conformance
work found five defects in (remark renders, the marked tokenizer writes, `extractRefs` feeds the
graph). A fourth reader would owe the same conformance obligation and carry the same silent-drift
risk — a slug algorithm that disagrees with `rehypeSlug`'s in one edge case produces a rail whose
links quietly go nowhere.

The DOM scan's only weakness is that headings are unknown before hydration, which costs nothing
here: the rail is mount-gated and renders nothing before hydration anyway.

### 7.2 Shape and states

A fixed column of dashes in the left gutter — the Notion gesture:

- `fixed left-6 top-1/2 -translate-y-1/2`, `hidden xl:flex`. Below `xl` the `max-w-3xl` column leaves
  no gutter to put it in, so it is not rendered rather than overlapping the text.
- One dash per heading: `h-0.5 rounded-full`, `w-4` for an `h2`, `w-2.5` for an `h3`. The width *is*
  the depth indicator — no indentation, no second axis.
- **Three states**, derived from the row's index against the active one:

  | State | When | Treatment |
  |---|---|---|
  | **passed** | `i < active` | `bg-foreground/40` |
  | **active** | `i === active` | `bg-foreground` |
  | **default** | `i > active` | `bg-foreground/15` |

- **Hover the rail** (the whole thing, not a dash) → the dashes cross-fade out and a panel fades in:
  the full heading list, each an `<a href="#slug">`, `h3` rows indented. This is the only place the
  rail carries words.
- **Fewer than two headings → renders nothing.** A one-dash rail is a claim about structure that a
  page with no structure cannot support.

### 7.3 Active tracking

An `IntersectionObserver` over the heading elements maintains the active index. Not a scroll
listener: the observer fires only when something crosses, where a scroll handler runs on every frame
of every scroll on a page whose whole job is to be read.

The bottom of the document is the known edge case — the last heading may never become the topmost
visible one if the section under it is short. The observer's root margin is tuned so the active row
advances when a heading crosses the upper third of the viewport, which resolves it without a
special case.

### 7.4 The mount gate, and what pins it

Same shape as `CommandPalette` and the media picker: an **outer** component holds
`useState(false)` + `useEffect(() => setMounted(true), [])` and returns `null` until true, so no
browser-only hook is ever called during a server render.

`lib/toc-mount.test.ts` pins it, sibling of `lib/palette-mount.test.ts`, and pins the same two things
that file does:

- **The island server-renders to the empty string.** Not "renders a hidden div" — nothing.
- **No dead control reaches the script-off HTML.** The rail's hover panel contains anchors; a future
  change that server-rendered them "so the TOC is there on first paint" would ship a list of
  `#fragment` links pointing at headings whose ids exist, which *works*, but at a fixed position over
  the text with no way to dismiss it. The claim this slice makes is the simpler one: it is not there.

No jsdom. The server render **is** the script-off render, and needing a DOM to prove it would defeat
the point.

## 8. What is NOT in this slice

- **The pod and bean pages keep their headers.** They get the new chrome, the 16px prose and the TOC
  rail, because those are zone-level; they do not get a centred mark-and-title head. A pod has no
  logo, role or status to draw one from.
- **The landing page is untouched.** It sits outside `(chrome)` deliberately — it is the front door,
  not a destination reached from a nav, and the mark large and centred is the entire point. No rail,
  no lang switch, no TOC.

  **And specifically: the status label does NOT follow the plant onto the landing.** §4.1 overturns
  the "active is unmarked" rule *for the plant page only*. On the landing, a plant's status stays
  expressed the way it already is — by the `Inactive` divider that separates the two groups, and by
  nothing else. Each plant section keeps its `roleLine` subtitle and gains no icon, no label and no
  badge.

  The reason is the one §4.1 itself turns on. `⚡ Active` earns its place on a plant's own page
  because it is one of exactly two facts stated about a single subject, in a centred head that
  exists to state them. Repeated down a gallery of every plant, on a page that has *already* said
  the same thing structurally by putting the inactive ones under their own heading, it stops being a
  fact and becomes a refrain — and it would say "Active" loudest on precisely the plants where the
  word carries the least information.

  This is a constraint on later slices, not just a description of this one: the landing is the
  obvious place for a "consistency" change to propagate to, and propagating it there would be wrong.
- **The plant page's "Inside" index stays where it is.** The admin moved its equivalent to a floating
  right-hand panel; that is an authoring affordance, and a visitor's index is a list at the end of
  the page.
- **No graph, no playground.** Track G is still Track G.

## 9. Testing

| What | How |
|---|---|
| `lib/toc-mount.test.ts` | `renderToStaticMarkup(<TocRail/>) === ""`; no `<a` and no `<nav` in the script-off HTML. |
| `lib/toc.test.ts` | The pure index→state mapping (passed / active / default) and the fewer-than-two suppression, living in `lib/toc.ts` so it is testable without a DOM. |
| Existing suites | `lib/markdown*.test.ts` and `lib/plant-hero-mount.test.ts` must stay green — the `Prose` change touches the first, and nothing in this slice touches the admin hero. |

`npm test` is the gate. No new test runner, no jsdom added.

## 10. CLAUDE.md

The exception list grows to six, and the entry says what §2 says: the TOC rail is the **public
zone's first island**, it renders nothing script-off, its absence costs nothing because every
heading it indexes is already in the prose, and it never writes.

The chrome is documented in the *neighbours* section instead — beside the admin chrome, the vault
filter popovers and the table glyphs — because it is explicitly **not** an exception: it degrades
completely, and its CSS tooltip is a deviation from the registry rule with its own stated reason
(§3).
