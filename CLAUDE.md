# CLAUDE.md — working in the Ariko repo

Ariko is a personal "central node": a portfolio on a botanical content model
(`Pod → Bean → Sprout`, with inbox `Seed`s), Next.js 15 / React 19 / TypeScript / MongoDB.

Both zones run on the design system: Tailwind v4 + shadcn on **Base UI**
(`components.json`, preset `b3vqDobYF1` — style `base-nova`, neutral base /
green theme, large radius, lucide). Body face is Inclusive Sans, display face
Geist Mono, wired through `--font-inclusive-sans` / `--font-geist-mono` in
`app/globals.css`.

- Primitives live in `components/ui/`. Add more with
  `npx shadcn@latest add <name>` — never hand-roll one the registry already has.
- Chrome belongs to the zones, not the root layout: `app/(public)/(chrome)/layout.tsx`
  and `app/admin/(chrome)/layout.tsx` + `app/admin/_components/admin-chrome.tsx`
  (three clusters: the Ariko mark and the plant switcher top-left, a floating
  icon rail on the left edge, and the public-site and log-out icon buttons
  top-right — and the rail changes shape with the scope, per the scope rule
  below). The root layout owns only the document shell and the fonts.
  **Both zones spell "this page has no chrome" as a route group, and in
  the admin that is a privacy boundary rather than a tidiness one**: the chrome
  layout reads the garden to compose the plant switcher's marks, and it hands
  them to a client island — so they are serialized into the flight payload and
  inlined in the HTML *before* the island can decline to render. The admin
  chrome used to withdraw on `/admin/login` with an early `return null` while
  the layout above it read anyway, which published every plant, logo URL and
  visibility to an anonymous `curl` of the one route `middleware.ts` lets
  through. `login/` is now the one routeable thing left outside
  `app/admin/(chrome)/`; `lib/admin-login-layout-source.test.ts` pins it.
  A route group's name is invisible to the URL, so no admin URL and no
  middleware matcher changed.
- **Four things the two zones now DRAW FROM ONE FILE** (the shared-surfaces
  slice, [`specs/2026-09-06-shared-surfaces-design.md`](docs/superpowers/specs/2026-09-06-shared-surfaces-design.md)).
  All four are **server-safe** — no `"use client"`, no `lucide-react` — which is
  the property that lets one file serve `app/(public)` and an admin client island
  at the same time. Adding either to one of them breaks the public zone silently:

  - `components/chrome-plate.ts` — the plate every floating cluster wears.
  - `components/chrome.tsx` + `lib/chrome-magnet.ts` — the cluster itself.
    `Chrome` takes a **magnet** (eight edge positions) and an orientation;
    `ChromeLink` / `ChromeItem` / `chromeItemClass()` are the ghost icon-buttons.
    The hover label is CSS, and the side it opens toward is **derived from the
    magnet** rather than passed. `lib/server-safe-source.test.ts` enforces the two
    rules above, because a violation passes `tsc`, `npm test` *and*
    `npm run build`.
  - `components/page-column.tsx` — `READING_COLUMN` is the same string in both
    zones, which is what makes the author's column the visitor's column.
    `resolveColumn()` in `lib/admin-nav.ts` picks it: a section index is
    `WIDE_COLUMN`, the welcome page is too — it holds two tables — and
    everything else reads. There is no `bare` any more: login left the chrome
    group, so `resolveColumn`'s only caller can no longer be asked about it,
    and a special case for a path that cannot arrive is dead code reading as a
    live rule. Chrome clearance goes **outside** the measure, never inside it.
  - `components/plant-header.tsx` and `components/entity-card.tsx` — the entity
    head and the entity card. Each takes slots or one extra prop where the admin
    genuinely shows more (`refText` on a card in the editor), and nothing else.
    The head's `mark` is OPTIONAL, which is what lets a sprout — which has no
    logo and wants no monogram — draw its name, description and facts from the
    same file a plant does. Absent is a statement about the entity, never a mark
    that failed to load. It is in `lib/server-safe-source.test.ts` now, which it
    should have been from the day it was written.

  The rule these four share: **if the admin and the public site draw the same
  thing, they draw it from the same file, and what differs is a parameter.**
  Anything new that floats at an edge, sets a measure, or renders an entity
  belongs here too — grep for the name rather than copying the classes.

## Script, by zone

**The public zone is progressively enhanced.** Every page reads, every link
navigates and every media item is reachable with script off. Islands add — a
reading position, a lightbox, a filter that narrows without a reload — and
never replace. A component the public zone renders must not carry
`"use client"` unless it renders nothing until it mounts, and must never be the
only route to anything.

`lib/server-safe-source.test.ts` **is** that rule, not a restatement of it: it
pins the list of public-rendered files, it forbids `lucide-react` (one import
is one client boundary, via an `Icon.mjs` carrying the directive), and it
forbids `node:` imports. **Add a file to it the day you write it.** All three
violations pass `tsc`, `npm test` and `npm run build` while quietly costing the
public site its navigation or its media list — which is how a stock
`"use client"` on `components/ui/table.tsx` shipped 8.5 kB to every prose page
for twenty slices. `components/public-icons.tsx` is the way around lucide in
the chrome; `components/chrome.tsx` does its hover labels in CSS for the same
reason, with the accessible name on the control's `aria-label`.

Today the public zone has exactly one island, `components/toc-rail.tsx`
(1.2 kB), and `lib/toc-mount.test.ts` pins that it renders nothing until it
mounts.

**The admin zone is a JavaScript application.** Server actions are the write
path and a server-rendered `<form action>` is the default form, because both
are less code and are testable without a browser — not because script is
forbidden. That is also why `components/ui/native-controls.tsx` stays: 49 lines
that let six metadata forms keep a styled `<select>` and radio without becoming
islands. Reaching for the Base UI Select/RadioGroup/Checkbox composites there
would turn five server components into client ones and write more code, which
is the opposite of the reason the default exists.

Client state, hotkeys, popovers, sheets, editors and pickers are ordinary tools
here and need no justification paragraph. Use the registry's primitives,
including the client ones — `npx shadcn@latest add <name>` rather than
hand-rolling what the registry already has.

**A write never mis-saves from a partial form.** When a form's controls live
inside an island, the island also owns the submit, and the action refuses a
payload lacking the island's intent marker (`__ready`, checked by
`buildMediaPatch`, `buildPlantLogoPatch`, `buildBeanCoverPatch`,
`buildScreenImagePatch` and `buildNewScreenInput`). This is what makes an
unmounted island **inert** rather than **destructive**: a form that is nothing
but the picker renders no submit button script-off, because a server-rendered
button there would post an empty media list, and an empty list is
indistinguishable from a deliberate clear-all. It would silently delete every
stored image.

A form carrying its own fields *plus* an island's submit is admissible only
where it **creates** — a record that never came into existence loses nothing
and mis-saves nothing (`app/admin/_components/screen-create-form.tsx`, and
`lib/screen-create.ts`'s docblock argues it at the write path). Two details
there are load-bearing: **two** text inputs rather than one, because a lone
text input in a button-less form submits on Enter, and the `__ready` refusal
regardless. Widening this shape to a form that EDITS would be a different
decision, and a worse one.

`lib/media-picker-mount.test.ts` pins the data-loss half.

## Rules the tests pin, and why

These are not about script, and they are the easiest things in the repo to
delete by accident — each one passes `tsc`, `npm test` and `npm run build`
while quietly becoming false.

- **Exhibiting and publishing are one act.** A screen is private at birth, so
  `writeExhibition` writes `visibility: "public"` beside `exhibited: true` and
  reverses both on withdrawal. An author who had to flip visibility separately
  would produce, as the commonest mistake, a screen marked for a strip it
  cannot appear on.
- **The strip requires both facts.** `filterPublic` enforces privacy,
  `Dataset.exhibitionForPlant` enforces the editorial opt-in, and **neither
  re-checks the other's** — which is why a screen made public by some other
  route never silently appears on a plant page. The renumbering half of the
  write is filtered on `exhibited: true` for a related reason: a reorder
  computed against a stale strip would republish a screen someone had just
  withdrawn.
- **No enum writes on the click that opens it.** Three fields work this way now
  — a plant's `status` and `visibility`, and a sprout's `state`. The icon opens
  the vocabulary as a list of native radios, the author picks a member, and a
  Save button commits it — disabled until the pick differs from what is stored,
  so the second click is a confirmation rather than a formality. A one-click
  flip was the first shape tried and the wrong one: a stray click on the globe
  unpublishes a project, and the undo is another stray click on the same pixel.
  The sprout's `state` earns the rule hardest — publishing cascades upward
  through its bean, pod and plant. All three post **a named member of a
  vocabulary** (`lib/plant-status.ts`, `lib/plant-visibility.ts`,
  `lib/sprout-state.ts`) which the action re-validates rather than trusting.
  The Meta sheet still carries `status` as a hidden input because
  `buildPlantMetaPatch` reads an absent status as `active`, so dropping the
  field would silently reactivate an inactive plant on every name edit. A
  sprout's `date` and `type` open the same way but are **not** enums and do not
  inherit the guard: there is no vocabulary to draw as radios, so each popover
  holds one field and a plain Save — what the author typed is on screen, which
  is the confirmation the radios otherwise have to manufacture. Each still
  posts through a **shape** module the action applies rather than a vocabulary
  it picks from: `lib/sprout-date.ts` rejects a date that is not `YYYY-MM-DD`,
  because one that is merely non-empty sorts the sprout to the bottom of every
  timeline the garden builds; `lib/sprout-type.ts` rejects surrounding
  whitespace as well as blankness, because three places compare `type` against
  a bare literal and none of them trims — `lib/sprout-edit.ts`'s
  digest exemption, `lib/synthesis.ts`'s digest skip and
  `lib/pbbls-legacy.ts`'s milestone match. A stored `"digest "` draws
  identically to `"digest"` everywhere and is exempt from none of the three, so
  publishing it flips the curated private bean and plant public — the exact act
  the exemption exists to prevent, with nothing looking wrong anywhere. That is
  the argument for a module for a field with no vocabulary: the shape is
  load-bearing even when the value is free-form.
- **A screen's image cannot be cleared**, because `Screen.image` is required —
  the one rule `buildScreenImagePatch` has that its three siblings lack.
- **The Exhibition panel composes no payload.** Its contents are
  server-rendered by `app/admin/(chrome)/plant/[slug]/page.tsx` and handed down
  as a prop, exactly as `metaForm` / `roleForm` / `logoForm` are, so
  `plant-rail.tsx` learns no field name.
  `lib/exhibition-panel-source.test.ts` pins it.
- **An entity rail composes no payload, and its panels stay mounted.**
  `app/admin/_components/entity-rail.tsx` takes ids, labels, icons and
  `ReactNode`s; every panel is server-rendered by the page and handed down,
  exactly as `metaForm` and the Exhibition panel are.
  `lib/entity-rail-source.test.ts` pins the shell *and* each panel, and it
  matters more than its sibling because one of these panels is a delete. The
  panels do **not** unmount on close — they go `inert` and translate off-screen
  — which is the one place the popovers' rule that an abandoned pick is not a
  pending write is deliberately inverted: `MediaPicker` uploads to Cloudinary
  before Save, so unmounting on a mis-click would strand assets
  `npm run check:orphans` then has to sweep. Hand-rolling a dismissible surface
  instead of taking `Dialog.Root` — correctly, since the page behind it stays
  live — means re-supplying the two halves that are not about modality: Escape
  dismisses, and closing puts focus back on the trigger, without which `inert`
  swallows the Close button, focus falls to `document.body`, and the next Tab
  restarts at the top of the document. The page makes room with a **relative
  offset**, never a transform: `transform` makes the wrapper a containing block
  for its `position: fixed` descendants, and the wrapper holds the whole page
  body — so a panel opening dropped the editor's floating commit to the end of
  the article and threw its `@` / `/` menu 224px from the caret — both gated on
  a panel being open and on the viewport, so every check passed. `right-56` moves
  the same 224px in the same direction, is applied after layout so nothing
  re-flows under the caret, and establishes no containing block. Padding is not an option at all, since the page renders inside
  `READING_COLUMN` and a right padding there squeezes the editor to ~320px. The
  offset is gated at 1216px because below that width no offset both clears a
  448px panel and keeps a 768px column on screen.
- **An icon crossing from a server component to a client one needs a declared
  boundary.** `RailItem.icon` is a `ComponentType` and an entity page is a
  server component, so importing `FileCode2` straight from `lucide-react` there
  puts a bare function in the flight payload, React refuses to serialize it, and
  the page 500s on every request. No per-icon module in the package carries the
  directive, so `app/admin/_components/rail-icons.ts` does: re-exporting from a
  file that is a client boundary is what registers each icon as a client
  reference. `RAIL_PAGES` in `lib/entity-rail-source.test.ts` is the only thing
  in the repo that reports the mistake — every page using the rail is
  `force-dynamic`, so `next build` never renders one and `tsc`, `eslint`,
  `npm test` **and** `npm run build` all pass. This is not the public zone's
  lucide rule turned around: there the client boundary is the thing to avoid
  entirely, here it is wanted and merely has to be spelled where the icon is
  named. `app/admin/_components/section-icons.ts` needs none of this only
  because both of its importers are already client components.
- **The screen sheet's slot imports the page's own module.**
  `app/admin/(chrome)/@sheet/(.)screens/[slug]` wraps
  `app/admin/(chrome)/screens/[slug]/page.tsx` rather than reimplementing it,
  and every tile, prev, next and close is a real `href` — never
  `router.back()` — so the same click is an ordinary navigation when
  interception does not happen.
  `lib/screen-sheet-source.test.ts` pins both halves. The library is this
  repo's only use of `next/link`, and it stays confined to that slice's four
  files: interception needs a client-side navigation.
- **`lib/palette.ts` is server-only; `lib/palette-items.ts` is the client
  half.** `lib/palette.ts` imports `lib/data.ts`, which opens with `node:fs`.
  Importing the wrong one from the palette component does not merely bloat the
  bundle — it fails the build. (The same trap is why `lib/exhibition.ts` may
  import `MediaImage` only as a type, pinned by
  `lib/exhibition-source.test.ts`.)
- **The service worker writes to no cache at runtime.** `public/sw.js`'s
  fetch handler returns — without calling `respondWith` — for anything that
  is not a GET navigation; navigations always go to the network, and the
  cache is consulted only when that fetch rejects, so it holds exactly what
  `install` precached, forever. It matters because the worker's scope is
  `/`, which includes `/admin` — a runtime cache there could store an
  authenticated response, or serve a page composed against a pre-write
  garden, the same staleness `loadCachedGarden` is careful about, arriving
  by a second door. `lib/pwa-source.test.ts` counts the write family against
  **comment-stripped** source — `caches.open` exactly once (in `install`),
  `.put(` and `.add(` never, `.addAll(` exactly once — because the only
  `caches.open(` the original regex matched was a sentence inside a docblock
  while the real, line-wrapped call went unmatched; `.add(` is counted on
  its own because it fetches *and* stores, so hoisting the cache handle out
  of `install` would defeat every other assertion at once. A digest of the
  precached bytes is embedded in `VERSION`, so editing `public/offline.html`
  without bumping it fails rather than shipping a change no
  already-installed browser ever sees — and a fifth test pins the offline
  page's inlined mark against `app/icon.svg`, since an `<img>` there cannot
  read the Cache API and would fail offline, the one situation the page
  exists for.
- `components/brand/ariko-icon.tsx` and `ariko-logo.tsx` are **generated**,
  not hand-drawn: `npm run brand:build` derives both, in one batch, from
  `assets/brand/*.svg`. Edit the source SVGs and re-run — never hand-patch
  a component, since the next regeneration overwrites the patch without
  warning, and nothing else would catch the drift: hand-patch a component,
  or paste a fresh export's paths in by hand, and `tsc`, `npm test` and
  `npm run build` all pass while the marks silently lose their tokens
  (rendering black on a ground `.dark` will one day make black too) or lose
  their `viewBox` (sizing from a `className` they no longer have — svgo's
  `preset-default` deletes it outright once width/height are present).
  `lib/brand-source.test.ts` pins that both paint their letterforms from
  `currentColor` and their leaves from `--ariko-leaf-dark` /
  `--ariko-leaf-light` rather than the artwork's literal colours, and that
  each keeps its `viewBox` — which is what turns both silent losses into a
  failure.
- **Every glyph carries its word.** `components/admin/glyphs.tsx` draws the
  admin tables' values as icons, and each also renders its word in an
  `sr-only` span from `lib/glyphs.ts` — the one place a display form is
  decided, exactly as `lib/plant-status.ts` is for its enum. No value is ever
  icon-only in the accessibility tree. Everything that draws an admin row
  shares that one island: the four tier tables and their shared cells, the
  inbox, the screen library's tiles, the palette's plant rows and the plant
  switcher's.
- **An icon trigger names its stored value.** The plant header's five editors
  and the sprout header's four are icons; the only place a reader learns what
  `status`, `visibility`, `state`, `date` and `type` currently ARE is each
  trigger's accessible name, set on the control rather than on a visible span
  (the hover label is CSS). Replace `Status: Active` or `State: Draft` with a
  bare word and the page looks identical and stops saying what it is.
  `lib/plant-hero-a11y.test.ts` and `lib/sprout-hero-a11y.test.ts` pin it.
- **The admin's subject lives in the URL, and picking one is a navigation.**
  `lib/admin-scope.ts` is the only reader of the scope — the slug on
  `/admin/plant/[slug]` first, `?plant=` second — and the only builder of the
  hrefs that change it; `lib/plant-path.ts` spells the plant address once, so
  `resolveNavItem` and `resolveScope` cannot disagree about which plant
  `/admin/plant/ariko/anything` names. Every row of the switcher is a plain
  `<a href>`: no cookie, no server action, nothing written — which is what
  keeps the URL a description of the view, and makes the island inert rather
  than destructive script-off, since every plant it offers is a row in a table
  on the root. Scoped, the rail gains **Overview** — the one item that cannot
  aggregate, because the all-plants overview IS the root — and loses
  **Beanstalk**, which merges sprouts with pollen envelopes that have no plant
  and would answer half its own question narrowed. A cookie, a `router.push`,
  or a second page re-reading `?plant=` its own way would each pass `tsc`,
  `npm test` and `npm run build` while leaving the chrome naming one plant and
  the rows beneath it showing another. `lib/admin-scope.test.ts`,
  `lib/admin-nav.test.ts` and `lib/plant-switcher-a11y.test.ts` pin the rule,
  the rail's two shapes, and a closed trigger that names its plant and posts
  nothing. (`lib/admin-scope.ts` is imported by that island, so it must stay
  client-safe — which is why the per-section filter keys live in
  `lib/section-keys.ts` rather than in `lib/sprouts.ts` and `lib/screens.ts`,
  four hops from `node:fs`.)
- **Images upload through `uploadImageAction`, never from the browser to a
  third party**, and a pasted link's `provider` is derived server-side rather
  than read from the payload. The credential never leaves the server, and a
  stored provider cannot be set by whoever posted the form.
- **A new admin data route goes under `/admin`, not `/api`.** `middleware.ts`
  matches `/admin/:path*`, so `app/admin/(chrome)/palette/route.ts` inherits
  the session gate with zero new auth code — a route group's name never reaches the
  URL, so the matcher does not know it exists. A sibling under `/api/admin/…`
  falls outside that matcher and is public unless it writes its own check.
- **The garden has two readers, and which one you import is a privacy
  decision.** `loadRawGarden` (`lib/store.ts`) is live; `loadCachedGarden`
  (`lib/garden-cache.ts`) is behind Next's Data Cache under the `garden` tag.
  The public zone reads the cached one, the admin and **every server action**
  read the live one — because `setSproutStateAction` and `promoteSeedAction`
  re-read *after* writing so `publishCascade` sees the just-saved state, and a
  cached read there computes the cascade against the pre-write garden: a
  published sprout whose bean silently stays private, or an unpublish that
  leaves a parent public. In the other direction, a public page that imports
  anything from `lib/store.ts` bypasses the cache — and `getFullDataset` skips
  `filterPublic` on the way, which is a leak rather than a slow page.
  `app/admin/(chrome)/layout.tsx` is a reader too, on every admin page: it
  composes the plant switcher's marks, and it reads live because the chrome is
  the surface most likely to be looked at immediately after a rename. Writes
  invalidate at four doors, three of which are not actions:
  `app/admin/actions.ts` plus `/api/articles`, `/api/synthesis` and
  `/api/pollen/sync`. `lib/garden-cache-source.test.ts` pins all of it,
  per-function for `actions.ts` because a whole-file check there would pass on
  one call out of twenty-five.

The slice histories that used to be narrated here — the prose editor, the media
picker, the seed overlay, the ⌘K palette, the plant hero, the TOC rail, the
screen library — live in `docs/superpowers/specs/`, which is where history
belongs. `docs/audits/2026-09-10-code-quality-audit.md` §1 explains why this
section is three invariants rather than a ledger of six exceptions.

Orientation lives in
[`README.md`](README.md); the sequenced plan lives in
[`docs/superpowers/ROADMAP.md`](docs/superpowers/ROADMAP.md).

## Lab Note requirement — read before opening a PR

Ariko is wired to several repos' CIs (`ariko`, `pbbls`, `femfolk`, `arkaik`,
`melogram`). **When you open a PR that ships something a user, visitor, or
listener would notice, you MUST include a Lab Note in the PR body.** Merging the
PR posts it to the Ariko inbox automatically — no copy-paste.

This section is the always-loaded summary and is **self-sufficient**: you can
author a valid note from it alone, with no plugin installed. The `lab-note`
skill (installable via `/plugin install lab-note@ariko`) is the source of truth
for full tone guidance and the per-repo pod table.

**The gate.** User/visitor/listener-facing change → write a note. Chore,
refactor, infra, or docs-only change → **no note** (leave the section out; if the
advisory reminder comments on your PR, add the **`no-lab-note`** label to silence
it).

**The contract.** One section whose heading **starts with** `## Lab Note`,
containing exactly one ` ```yaml ` fence. `en.title` and `en.summary` are
**required**; `fr.*` is recommended (a real adaptation, not a literal
translation, using the informal "Tu"); `suggested` is optional. Unknown
top-level keys are ignored. Skeleton:

```yaml
en:
  title: Short, benefit-first title             # required
  summary: One or two sentences, user-facing.   # required
fr:                                             # recommended — adaptation, informal "Tu"
  title: Titre court, orienté bénéfice
  summary: Une ou deux phrases, adaptées, pas traduites littéralement.
suggested:                                      # optional — prefills triage in the Ariko admin
  molecule: ariko        # THIS repo's pod slug (YAML key stays `molecule`)
  type: feature          # feature | improvement | fix | announcement
  tags: [changelog]
  # atom: <slug>         # ONLY when you know the slug exists — never guess
```

**Tone.** Lead with the benefit, not the mechanism; keep it short; warm and a
little playful, never corporate; no engineering jargon, ticket numbers, or
internal names.

**This repo's pod slug is `ariko`** (sent as `molecule:` in the YAML — the wire contract is unchanged). A malformed note fails the post-on-merge
job loudly (e.g. `en.title is required`); the advisory reminder surfaces the same
problems at PR-open time. Fix by editing the PR body — posting is idempotent.

Full pipeline docs: [`README.md` §Lab Note pipeline](README.md).
