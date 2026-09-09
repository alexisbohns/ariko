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
  and `app/admin/layout.tsx` + `app/admin/_components/admin-chrome.tsx` (a
  floating icon rail on the left edge, plus the public-site and log-out icon
  buttons top-right, which withdraws itself on the login page). The root layout
  owns only the document shell and the fonts.
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
    magnet** rather than passed. `lib/chrome-source.test.ts` enforces the two
    rules above, because a violation passes `tsc`, `npm test` *and*
    `npm run build`.
  - `components/page-column.tsx` — `READING_COLUMN` is the same string in both
    zones, which is what makes the author's column the visitor's column.
    `resolveColumn()` in `lib/admin-nav.ts` picks it: a section index is
    `WIDE_COLUMN`, everything else reads, login is bare. Chrome clearance goes
    **outside** the measure, never inside it.
  - `components/plant-header.tsx` and `components/entity-card.tsx` — the plant
    head and the entity card. Each takes slots or one extra prop where the admin
    genuinely shows more (`refText` on a card in the editor), and nothing else.

  The rule these four share: **if the admin and the public site draw the same
  thing, they draw it from the same file, and what differs is a parameter.**
  Anything new that floats at an edge, sets a measure, or renders an entity
  belongs here too — grep for the name rather than copying the classes.
- **The admin's *metadata* forms stay zero-client-JS**: they post to server
  actions and must work without script. Use the styled *native* controls in
  `components/ui/native-controls.tsx` (`NativeSelect`, `NativeRadio`,
  `NativeCheckbox`) rather than the Base UI Select/RadioGroup/Checkbox
  composites, which submit through a script-populated hidden input.
- **The prose editor is the first deliberate exception** (`components/editor/`,
  slice 5). The content forms on `/admin/sprout/[slug]`, `/admin/plant/[slug]`
  and `/admin/pod/[slug]` are client components and do not work without script.
  They still invoke the same server actions, and they are *separate forms* from
  the metadata ones on the same page — which is what keeps the exception
  contained.
- **The media picker is the second** (`components/admin/media-picker.tsx`, the
  media slice). It carries its own rule, which is what makes it an island
  rather than a slope:

  > The picker renders **nothing until it mounts**. Without script, the form
  > around it is byte-for-byte what it was, and **its absence never costs
  > anything** — a form it merely adds to still submits; a form that is *only*
  > the picker goes inert rather than destructive; and a form of its own fields
  > *plus* the picker, which script-off cannot be submitted at all, is
  > admissible only where it **creates** — a record that never came into
  > existence loses nothing and mis-saves nothing.

  All three halves are load-bearing. The capture bar still submits without script,
  minus the images — and a submit is never blocked by an upload either: an
  in-flight or failed image simply is not in the payload. The sprout media card
  is the other case: it is nothing *but* the picker, so the picker renders its
  submit button too (`submitLabel`). Script-off, that form is a lone hidden
  input — no button, and no field that permits implicit submission — because a
  server-rendered button there would submit a form carrying nothing, and an
  empty media list is indistinguishable from a deliberate clear-all. It would
  have silently deleted every stored image. `buildMediaPatch` also refuses to
  write without the picker's `__ready` marker, as defence in depth against a
  POST that never rendered a button at all.

  The plant **Logo card** (`app/admin/_components/logo-card.tsx`, the plant
  status/logo slice) is the sprout media card's case again, not a new one: it is
  nothing but the picker, it hands the picker its submit button, and
  `buildPlantLogoPatch` enforces the same `__ready` rule. It caps the list at
  one with the picker's `max` prop — a plant has one mark. The Meta card beside
  it stays zero-client-JS, which is *why* the logo needs a card of its own.

  The bean **Cover card** (`app/admin/_components/bean-cover-form.tsx`, the
  phone-covers slice) is the third of these and still not a new case: nothing
  but the picker, `submitLabel` on the picker, `buildBeanCoverPatch` enforcing
  the same `__ready` rule, `max={1}` because a bean has one cover. What it adds
  to the pattern is the **Keyword form beside it** — an ordinary zero-client-JS
  metadata form, and separate from the Cover card for a reason worth stating
  once. Put the keyword's text input *inside* the picker's form and script-off
  that form renders no button (the button is inside the island) but **does**
  render the input — and a lone text input in a button-less form submits on
  Enter. The author types a word, presses Return, and posts a payload carrying
  no `cover__ready`: `buildBeanCoverPatch` refuses to write, so the cover
  survives, and the keyword is silently lost with nothing on the page to say
  so. Two forms make that impossible rather than survivable, which is the
  plant's Meta-beside-Logo arrangement again.

  The screen **Create form** (`app/admin/_components/screen-create-form.tsx`,
  the screen-library slice) is the **third case** the rule above names, and the
  only one in the admin: three fields of its own — `slug`, `name`, `plant` —
  *and* the picker owning the submit button. Script-off it renders those three
  fields, renders no button, and cannot be submitted at all, so the first half
  of the rule ("a form it merely adds to still submits") is simply untrue of
  it. It is admissible anyway because it **creates**: there is no record yet, so
  nothing is lost and nothing is silently mis-saved — the author is told
  nothing, and nothing happens, which is the honest end of an inert form.
  `lib/screen-create.ts`'s docblock argues the same thing at the write path.
  Two of its details are load-bearing: TWO text inputs rather than one, because
  a lone text input in a button-less form submits on Enter (the bean Keyword
  trap), and `buildNewScreenInput` refusing a payload with no `image__ready`
  regardless. Widening this shape to a form that EDITS would be a different
  decision, and a worse one.

  That slice added **no seventh exception**: the cover itself
  (`components/bean-cover.tsx`) is a server component pinned in
  `lib/server-safe-source.test.ts`, its motion is CSS `group-hover`, and
  `app/(public)` still has exactly one island.

  Images upload through `uploadImageAction`, never from the browser to a third
  party, and a pasted link's `provider` is always derived server-side.

  Widening this to any *further* form is a decision, not a convenience.

- **Seed capture is the third**, and unlike the first two it is a real loss
  rather than a contained one (`app/admin/_components/seed-overlay.tsx`, the
  fluid-admin slice). The capture form left the inbox page: it is now a
  full-screen overlay opened by the `+` beside the page title or by the `k`
  key, with an autofocused title and no labels. **Without script there is no
  way to capture a seed** — the `+` and `k` both do nothing, and `/admin` is
  the inbox list alone.

  That was taken deliberately. An overlay that opens on a keystroke,
  autofocuses and blurs the page behind it cannot exist without script, and the
  only alternative — a second server-rendered form at its own route, writing
  the same seed — would be maintained by nobody and exercised by no one.
  Nothing is destroyed and nothing is silently mis-saved: the overlay simply is
  not there.

  The exception is the **shell**, never the write path. The overlay posts to
  the same `createSeedAction` with the same field names `lib/seed-form.ts`
  already reads, and the media picker inside it is the same island under its
  `compact` presentation — same `__ready` marker, same settled-rows-only
  serialization, minus the alt-text field and the reorder controls (a seed is
  on its way to triage, and the sprout media card downstream carries the full
  picker).

- **The ⌘K command palette is the fourth, and the mildest of them**
  (`app/admin/_components/command-palette.tsx`, the palette slice). ⌘K (Ctrl+K
  off macOS) anywhere in the admin but the login page opens the seed overlay's
  blurred sheet, one octave up: a bare centred input over a filtered list of
  every section, plant, pod, bean, sprout and inbox seed. Script-off it renders
  **nothing** — no ⌘K, and no search button either, because the island is gated
  behind a mount flag exactly like the media picker's.

  What makes it mild is that **its absence costs nothing**, in the strong sense
  the media picker's rule uses: the palette adds no destination of its own. Every
  row is a faster route to a page that still has its slow route — the
  sections from the rail, everything else from the list page that already links
  to it. And it **never writes**: no form, no server action, no submit. It is a
  navigator, not a command runner, which is what keeps it small enough to trust.

  Its index comes from `GET /admin/palette`, fetched on each open. That route
  lives under `/admin` rather than `/api` on purpose: `middleware.ts` already
  matches `/admin/:path*`, so the index inherits the session gate with **zero
  new auth code**. Nothing is loaded until ⌘K is pressed, so no admin page's
  render cost changes.

  One split is load-bearing and easy to undo by accident: `lib/palette.ts`
  imports `lib/data.ts`, which opens with `node:fs`, so it is **server-only**.
  The client half — the row type, the group order, the sections, the
  grouping — lives in `lib/palette-items.ts`. Importing the wrong one from the
  palette component does not merely bloat the bundle; it fails the build.

- **The plant page's header is the fifth**, and the largest single bite so far
  (`app/admin/_components/plant-hero.tsx`, `plant-inside.tsx`, the
  plant-page-pure slice). `/admin/plant/[slug]` stopped being five stacked
  cards: the mark sits centred in a squircle with the name under it, and each
  editor is now one click behind the thing it edits — the logo behind the logo
  (a popover), name and description behind the page title (a sheet), the role
  behind a crown (a popover that summarizes, then a sheet), and status and
  visibility behind two icons that open their own vocabulary. The sheets are the
  seed overlay's, extracted to `overlay-sheet.tsx` and now shared by three
  callers; the shell is all that file carries, never a write path. The pods and
  beans index left the page for a floating panel on a right-hand rail, the
  mirror of the chrome's, which slides the page left rather than covering it.

  Script-off, **nothing on the header can be edited** — no popover, no sheet, no
  fields, five inert icons. That is a real loss, in the seed overlay's sense
  rather than the media picker's, and it was taken deliberately: a header whose
  editors open on the element they edit cannot exist without script, and the
  alternative was the five cards this slice replaced. The header still READS
  correctly — every trigger names its stored value in its accessible name, so
  the mark, the name and all five values are there.

  `lib/plant-hero-mount.test.ts` pins that absence, and it pins the *shape* of
  it rather than the fact: the failure mode here is not a missing form but a
  half-rendered one. Server-render a popover's fields "so they are there on
  first paint" and the page grows a metadata form with no way to submit it —
  and for the two enum fields, a `status` input beside a submit button is a
  plant's visibility one stray press away from changing.

  Which is the other rule this header carries: **neither enum field writes on
  the click that opens it.** The icon opens the vocabulary as a list of native
  radios, the author picks a member, and a Save button commits it — disabled
  until the pick actually differs from what is stored, so the second click is a
  confirmation rather than a formality. A one-click flip was the first shape
  tried and the wrong one: a stray click on the globe unpublishes a project,
  and the undo is another stray click on the same pixel.

  Two things keep the write paths honest. The three big forms are
  **server-rendered by the page and handed down as props** (`metaForm`,
  `roleForm`, `logoForm`), so the client island never composes their payload and
  never learns a field name. And the two it does render itself post **a named
  member of a vocabulary** (`lib/plant-status.ts`, `lib/plant-visibility.ts`),
  which the action re-validates rather than trusting — so a stale page can only
  ever name a value the vocabulary already has. The Meta sheet still carries
  `status` as a hidden input for a related reason: `buildPlantMetaPatch` reads
  an absent status as `active`, so dropping the field outright would silently
  reactivate an inactive plant on every name edit.

- **The public TOC rail is the sixth, and the first one outside the admin**
  (`components/toc-rail.tsx`, the public-plant-page slice). `app/(public)` had
  no client JS at all; it now has exactly one island. On plant, pod and bean
  pages a column of dashes in the left gutter shows the reading position, in
  three states — passed, active, default — and reveals the headings as links on
  hover.

  It is the mildest exception on this list. It **renders nothing until it
  mounts**, so script-off the page is byte-for-byte what it was, and **its
  absence costs nothing** in the media picker's strong sense: every heading it
  indexes is already in the prose beneath it, in document order, with an `id` on
  it. The rail adds no destination, no control and no information of its own —
  it is a position indicator for a document you can already read. And it
  **never writes**: no form, no server action, no submit.

  Its headings come from a **DOM scan on mount** (`main h2[id], main h3[id]`),
  not from a server-side extraction, and that is deliberate: `lib/markdown.ts`
  already runs `rehypeSlug`, so scanning reads exactly what was emitted and the
  anchors cannot drift from their targets. A server-side extractor would be a
  *fourth reader of the one corpus* — the shape the tiptap slice's conformance
  work found five defects in. Only the arithmetic is pure and tested
  (`lib/toc.ts`, `lib/toc.test.ts`); `lib/toc-mount.test.ts` pins the absence.

Those six are the whole list. Every *other* admin metadata form is unchanged
and still zero-client-JS. Five neighbours are worth naming so they are not
mistaken for further exceptions:

- The chrome (`app/admin/_components/admin-chrome.tsx`) is a client component so
  it can read the pathname, but it is chrome, not a form: its nav items are
  plain `<a href>` and Log out is still a real `<form>` with a real submit
  button. It renders the palette, which is the one thing inside it that is an
  island rather than chrome.
- The admin's filter popovers (`app/admin/_components/admin-filters.tsx`) are a
  container only — every option inside is the same `<a href>` the page rendered
  inline before, built by `filterHref()` in `lib/admin-filters.ts`; filtering
  stays server-side (`lib/vault.ts` for the vault, `lib/screens.ts` for the
  screen library), and filter URLs stay shareable. It was the vault's alone
  until the screen library needed the same bar, so it carries four dimensions
  now — `s`tate, `p`lant, `b`ean, `t`ag — and each page hands it the three it
  has. Those four letters are also the hotkeys that open the popovers: the same
  kind of shell affordance as the seed overlay's `k`. The popovers open in the
  primitive's `trap-focus` mode so Tab and Shift+Tab cycle the options rather
  than walking off into the table behind. What script-off *does* cost there is
  **discovery**: the triggers no longer open and the keys do nothing, so the
  filters cannot be found from the page, only typed as a query string.
- The screen library's side sheet (`app/admin/_components/side-sheet.tsx`, the
  screen-library slice). `/admin/screens` is a contact sheet of every stored
  screen; clicking a tile opens its editors in a panel on the right that the
  page slides out from under, rather than an overlay — so the grid stays visible
  and clickable and the author can swap screens without closing anything. It
  looks like a seventh exception and is not, because **the panel renders nothing
  that is not already a page**: it is a Next parallel + intercepting route
  (`app/admin/@sheet/(.)screens/[slug]`) that imports and wraps
  `app/admin/screens/[slug]/page.tsx` itself. Script-off, the same tile click is
  an ordinary navigation to that page, where the metadata and delete forms
  still work — prev, next and close included, since all three are real
  `<a href>` (`screen-nav.tsx`), never `router.back()`. (The image card and the
  create form are the picker's exception, below.) `sheet-keys.tsx` binds Escape
  and the arrows over those same hrefs and renders nothing, which is the filter
  popovers' category of affordance rather than a destination of its own. The
  library is also this repo's first use of `next/link` — every other LINK in
  both zones is a plain `<a href>`, the palette and `sheet-keys.tsx` being the
  two places that navigate by `router.push` instead — and it is still confined
  to this slice's four files:
  interception needs a client-side navigation, and `Link` renders the same
  anchor a plain `<a>` would. `lib/screen-sheet-source.test.ts` pins both halves
  — the slot importing the page's own module, and the tiles navigating by `href`
  — because reimplementing the body in the slot or turning a tile into a button
  passes `tsc`, `npm test` AND `npm run build` while quietly making the library
  script-only.

  The push itself is CSS, not state: the layout asks
  `:has(~ [data-screen-sheet])`, which is `plant-inside.tsx`'s idiom, and
  `@sheet/default.tsx` returning null is what makes the question honest —
  everywhere but a screen there is no element beside the page to match. The two
  places the panel does render something the standalone route does not are
  `@sheet/(.)screens/[slug]/not-found.tsx` — a boundary, not a form: a stale
  tile would otherwise replace the whole page, grid included, to say a screen is
  gone — and the one `<style>` rule that rings the open tile (`activeTileCss` in
  `lib/screens.ts`, called by the slot). Interception is exactly what keeps the
  index from re-rendering while the panel navigates, so the grid cannot know
  which tile is open and the panel says so in CSS; the slug is guarded rather
  than trusted there, because a stored slug came from a filename and a quote in
  one would escape the selector. Neither is a form, neither writes, and both
  vanish with the panel. The one thing the library genuinely spends is the picker
  exception it already had — the image card and the create form are the picker,
  so neither works without script, and `buildScreenImagePatch` enforces the
  `__ready` marker. It adds one rule its three siblings lack: **a screen's image
  cannot be cleared**, because `Screen.image` is required.
- The three admin tables' glyphs (`components/admin/glyphs.tsx`). The inbox's
  source column, the vault's plant column and the garden's name/tier/visibility
  columns *draw* their values — a lucide icon for the capture route, a
  shadcn-on-Base-UI `Avatar` for the plant (its logo, or its initials when it
  has none), a tooltip carrying the word. That is one client island for all
  three tables and not nine: lucide, Avatar and Tooltip are each already
  `"use client"` modules, so the choice was never "none" but "one boundary or
  many". Nothing there is a form control and nothing writes — the tables around
  it are the same server-rendered links and cells they were. Script-off costs
  the *hover* label only: every glyph also carries its word in an `sr-only` span
  (from `lib/glyphs.ts`, the one place a display form is decided, exactly as
  `lib/plant-status.ts` is for its enum), so no value is icon-only in the
  accessibility tree. **The palette draws plant rows with the same
  `EntityAvatar`, and the screen library's contact sheet draws each tile's plant
  mark with the same `EntityAvatarGlyph`** — four consumers of one island, which
  is why it is imported rather than reproduced.
- The public chrome (`app/(public)/_components/public-chrome.tsx`) and the plant
  head (`app/(public)/_components/plant-head.tsx`). Both are **server**
  components, both are now thin compositions over the shared files above, and
  both had to work at it. Two rules keep the public zone's no-script promise
  while it grows a floating rail and an icon-and-label header:

  > **No lucide in a public server component.** `lucide-react` routes every icon
  > through an `Icon.mjs` carrying `"use client"`, so one `<Crown />` is one
  > client boundary. `components/media.tsx` states the rule; this slice obeys it
  > with `components/public-icons.tsx` — five inline `<svg aria-hidden>` glyphs
  > carrying lucide's own path data (ISC), so the two zones still draw the same
  > vocabulary.
  >
  > **No registry Tooltip in a chrome cluster.** It is `"use client"` too, and
  > using it in the public chrome would make *navigation* script-dependent to
  > gain a hover label. `components/chrome.tsx` does the label in CSS instead,
  > with the accessible name on the control's `aria-label` rather than on the
  > visual span.

  That second one is a deviation from "never hand-roll what the registry has",
  and it is the good direction of the trade. It now applies to the **admin's**
  clusters too, which is not a concession: a cluster magnetized to a viewport
  corner has nothing to collide with, so the positioning engine the registry
  brings has no work to do there. What it costs is the shared delay group — a
  pointer crossing a rail flashes each label in turn. Every popover, sheet and
  the palette keep the real primitives, and so does everything anchored to an
  in-flow trigger.

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
