# Article door, slice 2 — the staging grammar

*2026-11-15*

## 0. The observation

Slice 1 (`2026-11-14-article-door-v2-design.md`, PRs #124–#126) lets a sibling
repo post essays and narratives with inline images. The first real posts show
what is missing — the writing already reaches for staging it cannot express:

- **kosymoz-no-slop-workshop** uses `> **In two words: …**` five times as a
  definition aside, frames a phone screenshot in prose ("framed for a phone"),
  and shows "three ramps" and "four tints" as composites that are galleries in
  disguise.
- **pbbls-feed-redesign** has twelve `>` quotes, every one of them the
  maintainer's own words, with nothing saying whose.
- The krabs and pbbls narratives have no images at all, so a krabs entry is the
  "short text with an aside" case.

The maintainer wants the same staging in the admin editor. This slice adds five
blocks — **figure, gallery, compare, callout, quote** — as **one grammar**:
written by the door, round-tripped by the admin's Tiptap editor without loss,
rendered on the public site.

## 1. Decisions

| # | Decision | Rejected |
|---|---|---|
| 1 | **Container directives with ordinary markdown inside** (`:::gallery` … `:::`). | Leaf directives with URLs in attributes (escapes the image check, fails to nothing); fenced YAML (renders as code elsewhere, invisible to the image check). |
| 2 | The admin edits a staged block as a **preview + popover form**; text blocks keep editable prose inside. | Full in-place editing (a bespoke interactive node per block); preserve-only (no authoring in the admin). |
| 3 | **SVG is a hosted file, refused-not-stripped by an allowlist check, rendered only as `<img>`**, with an optional dark twin. | Inline SVG in the body (a sanitizer becomes the security boundary on `ariko.app`); raster only (not vector figures). |
| 4 | Frames are the **quiet outline** (corner radius + hairline; desktop: a faint three-dot strip). | Literal device bezel; screen on a plate. |
| 5 | **`PhoneFrame` goes quiet everywhere** — bean cover, screen strip, lightbox, articles. | Keeping the bezel for articles; a `quiet` parameter (two phone looks on one site). |
| 6 | `size` is one scale: `s` / `m` / `l` / `wide`. No `full`. | Full-bleed figures — the screen strip owns full-bleed. |
| 7 | Gallery: natural ratios, shared row height, **rows centred** (pure CSS, no stored dimensions); phone galleries are even. | An even cropped grid (cropping evidence); a scrolling strip (means "the exhibition"); flush justified rows (needs width×height in the grammar). |
| 8 | Compare: a coloured mark and word above each side, image untouched. | A coloured rule under each frame; one split card. |
| 9 | Callout on a muted plate with a mono label; quote set larger with a hanging mark and attribution beneath. | A left rule for both (collides with plain `>`); margin note / centred pull quote (heavy for ten-line quotes). |
| 10 | Stored content **degrades** (unknown values → defaults, malformed blocks unwrap); posted content is **refused by name**. | Refusing at render (a typo breaks a page); silently accepting at the door (agents never learn). |

## 2. The grammar

### 2.1 The five blocks

````md
:::figure{frame=phone size=s}
![The lake with its two moons, framed for an upright phone](https://res.cloudinary.com/…)
Scenes zoom in on the subject when the phone is upright.
:::

:::figure{frame=none size=wide dark}
![The conductor's clock driving picture, sound and haptics](https://…/clock.svg)
![](https://…/clock-dark.svg)
The audio clock is the reference; everything else locks onto it.
:::

:::gallery{frame=phone}
![The lake scene](https://… "Lake")
![The abbey scene](https://… "Abbey")
Three scenes on a phone held upright.
:::

::::compare
:::do
![An almost still cromlech](https://…)
Show an almost still picture and drop the events.
:::
:::dont
![The cromlech with shooting stars](https://…)
Keep every event running and ignore the system setting.
:::
::::

:::callout[In two words: dithering]
When you only have a few shades of grey, you mix them in a fine pattern…
:::

:::quote{by="Alexis" role="reviewing the feed explorations"}
The Spine is truly a masterclass.
:::
````

| Block | Content | Attributes |
|---|---|---|
| `figure` | One image, then optional caption (inline markdown). With `dark`, exactly two images: light, then dark. | `frame` = `phone` \| `desktop` \| `none` (default `none`); `size` = `s` \| `m` \| `l` \| `wide` (default by frame: `phone`→`m`, `desktop`→`l`, `none`→`l`); `dark` (flag). |
| `gallery` | Two or more images; each image's title is its caption; text after the last image is the gallery's caption. | `frame` as above (default `none`). |
| `compare` | Exactly one `:::do` and one `:::dont`, in that order. Each holds an optional image and one line of text (inline markdown). | none |
| `callout` | Any block prose. Optional `[label]`. | none |
| `quote` | Any block prose. | `by` (required, free text); `role` (optional, free text). |

### 2.2 Rules

- **Closed vocabularies.** `frame` and `size` take only the listed members.
  Stored content with an unknown value renders with the default; the door
  refuses it (§6.1).
- **A malformed block unwraps to its children** — a figure with no image, a
  compare missing a side, a quote with no `by`, a gallery of one. It is exactly
  what every foreign container does today
  (`remarkRestoreForeignDirectives`), so the reader keeps every image and every
  sentence.
- **No nesting**, except `compare` → `do` / `dont`. A staged block inside any
  staged block unwraps (the inner one). `do` / `dont` outside a `compare` are
  foreign and unwrap. `::entity` cards and `:entity` mentions are allowed inside
  callouts and quotes, and `extractRefs` keeps mirroring them into `relations`.
- **Bilingual by halves.** Captions, labels and `role` are translated by writing
  them in the French half. No per-attribute `{ en, fr }`.
- **Canonical form.** `renderMarkdown` writes attributes in a fixed order
  (`frame`, `size`, `dark`; `by`, `role`), omits a value equal to its default,
  writes a value bare when it is `[A-Za-z0-9_-]+` and quoted (with `&` and `"`
  as character references) otherwise, and always uses `:::` for the five blocks
  and `::::` for `compare`. A caption or a side's text is markdown source and
  is written verbatim, except that a line which would start or interrupt a
  block (`- x`, `2. x`, `===`, a fence, `:::`, a table row, HTML) is
  backslash-escaped — decided by parsing the line, not by a list of
  characters. Alt text is escaped as plain text. A callout label is written as
  its source. Hard breaks in a caption become spaces. A gallery
  left with one image serializes as a figure rather than losing the image. The door does not require canonical form on input;
  the editor writes it on save.

### 2.3 How the fences close (remark's behaviour, which the editor mirrors)

Verified against `remark-directive` before planning:

- A container **interrupts a paragraph** — no blank line is needed before
  `:::figure`.
- A closing fence of length *L* closes **every open container whose opening
  fence is no longer than *L***, innermost first. So `::::compare` survives the
  `:::` that closes `:::do`, and a `::::` line inside `:::do` closes both. Two
  containers opened with the same length cannot be closed separately — a
  `:::gallery` inside a `:::callout` closes the callout at its own `:::` —
  which is one more reason nesting is refused at the door.
- An **unclosed** container runs to the end of the document and is still a
  valid block. The editor claims it the same way and writes the closing fence
  on save; the door refuses it (§6.1), because an agent that forgot a fence
  almost certainly did not mean "the rest of the article".

### 2.4 The vocabulary file

`lib/staging.ts` — pure, client-safe, the one place the blocks are named, as
`lib/plant-status.ts` is for its enum: block names, attribute names, member
lists, defaults (including size-by-frame), and `normalizeStagingAttrs()`. Every
other part of this slice reads it: the remark pass, the marked tokenizers, the
sanitize schema's value lists, the popovers' radios and the door's validator.
Nothing re-lists a member.

## 3. The public render

### 3.1 Pipeline (`lib/markdown.ts`)

`remarkStaging` runs **after `remarkEntity` and before
`remarkRestoreForeignDirectives`**. For each `containerDirective` named after a
block, it checks shape (§2.2); valid → sets `hName` to `staged-figure`,
`staged-gallery`, `staged-compare`, `staged-callout` or `staged-quote`, with
normalized attributes as `data-*` properties, and the `do` / `dont` children to
`staged-do` / `staged-dont`; invalid → unwraps. Anything it does not claim
falls through to `remarkRestoreForeignDirectives` unchanged.

`sanitizeSchema` admits those seven tags and, for the enum attributes, **only
their members** (hast-util-sanitize's `["data-frame", "phone", "desktop",
"none"]` form) — a second, independent enforcement of the vocabulary.
`data-by`, `data-role` and `data-label` are free text and arrive as attribute
strings, never markup. Sanitization stays last.

### 3.2 Components (`components/staging/`)

All **server-safe** — no `"use client"`, no `lucide-react`, no `next/link`,
no `node:` — and added to `lib/server-safe-source.test.ts` the day they are
written. `components/markdown.tsx` maps the seven tags to them, exactly as it
maps `entity-card`.

- **Figure** — `<figure>` + `<figcaption>`. The image in `PhoneFrame`, the new
  `DesktopFrame`, or bare. Size is a class; `wide` breaks out of
  `READING_COLUMN` to ~960px at `lg` with a relative offset, never a transform
  (CLAUDE.md, the entity-rail rule). Below `sm` every size above `s` is the
  full column. Caption in `--muted-foreground`, centred to the figure's width.
- **Gallery** — a `<figure>` of `<figure>`s. Default: every image at a shared
  row height, natural width, rows wrapping and centred. `frame=phone`: even
  columns (phone screens are equal-ratio). Per-image caption under each; the
  gallery's caption is the outer `<figcaption>`.
- **Compare** — a `<figure>` of two `<figure>`s. Above each, a mark from
  `components/public-icons.tsx` (✓ in `--primary`, ✕ in `--destructive`, both
  copied from lucide under the file's existing drift test) and the word as
  real text, **in the page's language**: `Do` / `Don't`, `À faire` /
  `À éviter`, from `COMPARE_LABELS` in `lib/staging.ts`. Side by side from `sm`, stacked
  below, do first. Images untouched.
- **Callout** — `<aside>` on the muted plate (`--muted`, `--radius`), its label
  in the mono face as its accessible name (`aria-labelledby`); unlabeled, it is
  an `<aside>` with no name.
- **Quote** — `<figure><blockquote>…</blockquote><figcaption>— by, role</figcaption></figure>`,
  set a step larger than body with a hanging opening mark.

### 3.3 Frames

- **`components/phone-frame.tsx` changes for every caller** (decision 5): the
  `bg-neutral-900` bezel becomes the quiet outline — the screen's corner radius
  and a hairline in `--border`, on theme tokens in both themes. Its two shapes
  survive: `height` given → `c_fill` and **bottomless** (the outline on three
  sides, open at the bottom), `height` omitted → `c_limit`, closed on four.
  `alt` stays required. Its docblock's three load-bearing details are rewritten
  to match; `components/phone-frame.test.tsx` is updated with them.
- **`components/desktop-frame.tsx`** (new, server-safe): hairline edge,
  `--radius`, and an 18px top strip with three dots in `--muted-foreground`.
- **Surfaces to verify visually in both themes**, because decision 5 changes
  them: the bean cover (`components/bean-cover.tsx`), the plant page's screen
  strip and its lightbox, and an article figure.

### 3.4 Images

- Every staged image is wrapped in a real `<a href>` to the original, so with
  script off every media item is reachable at full size.
- Raster images get a sized Cloudinary derivative through `lib/image-url.ts`
  (width from the size class, ×2 for density). **SVGs are never transformed**
  and are drawn only as `<img>`.
- A `dark` figure renders two `<img>`, `dark:hidden` and `hidden dark:block`,
  both `loading="lazy"` — the hidden one is not fetched. It follows the `.dark`
  class, so it agrees with the preferences menu, not with the OS.
- No new island. The lightbox stays on the plant page; adopting
  `SCREEN_ANCHOR_ATTR` for article figures later needs no grammar change.

### 3.5 Excerpts

`lib/narrative-excerpt.ts` drops the fence lines (`:::name{…}`, `:::`,
`::::compare`) and image lines and keeps the text inside, so a document that
opens with a figure previews its first sentence of prose. A callout's label is
dropped with its fence line.

## 4. The editor

### 4.1 Nodes (`lib/entity-markdown.ts`)

Five nodes join `headlessExtensions`, so `lib/markdown-conformance.test.ts`
drives exactly the schema the editor drives.

- **Text blocks** — `stagedCallout` (`attrs: { label }`) and `stagedQuote`
  (`attrs: { by, role }`), `content: "block+"`. Parsed with
  `lexer.blockTokens` on the body and `helpers.parseChildren`; serialized with
  `helpers.renderChildren`.
- **Media blocks** — atoms holding their fields as attributes:
  - `stagedFigure`: `{ frame, size, image: { src, alt }, dark?: { src, alt }, caption }`
  - `stagedGallery`: `{ frame, images: [{ src, alt, title }], caption }`
  - `stagedCompare`: `{ do: { src?, alt?, text }, dont: { … } }`

  Captions and compare text are inline-markdown strings that the atom never
  parses, so they come back byte for byte.

Each tokenizer matches the opening fence through its **matching** closing fence
— counting fence length, and treating fenced code as remark does: an opener
inside code is code, but a closer inside code still closes the container — and
claims a block only when it
is valid by §2.2. An invalid block is not claimed: it stays plain text in the
editor and remark unwraps it the same way, so the two parsers agree on
malformed input too. Each `renderMarkdown` writes the canonical form (§2.2) and
returns `""` for a media block with no image — the `EntityCard` rule, "no ref,
no markdown".

### 4.2 Node views (`components/editor/staging-views.tsx`)

The preview is drawn **from `components/staging/`** — the public components,
server-safe and so renderable in a client node view — which is the
shared-surfaces rule: the author sees what the visitor sees. The node views
are client components in the admin zone; the public components stay
server-safe.

- **Media blocks**: clicking opens a Base UI Popover (`npx shadcn@latest add
  popover` if not present): frame and size as native radios from
  `lib/staging.ts`, one image slot per image (upload or paste, via the existing
  `uploadImageAction`), alt text and captions, add / remove / reorder for
  gallery images, and **Save**, which calls `updateAttributes`. Escape or a
  click outside discards. Nothing is stored before the article's own commit.
- **Text blocks**: the callout's label and the quote's `by` / `role` open the
  same kind of popover from their label and attribution lines; the body is
  typed into directly.
- **Insertion**: the `/` menu gains Figure, Gallery, Compare, Callout and Quote.
  A media block opens its popover on insertion; cancelled with no image, it
  serializes to nothing (§4.1).

### 4.3 Inherited rules

- The EN/FR switch is dead while an upload is in flight; uploads started from a
  staging popover count.
- A popover cancelled after an upload leaves an orphan asset — the same trade
  the `/image` command makes; `npm run check:orphans` sweeps it.
- SVG is accepted only in a figure's image slots (§5); gallery and compare
  slots stay raster.

## 5. SVG

### 5.1 The check (`lib/svg-check.ts`)

Parses the upload as XML and **refuses** anything outside the allowlist. It
never strips: a stripped drawing is not the drawing that was approved.

- **Elements**: `svg g path rect circle ellipse line polyline polygon text tspan
  defs symbol use marker clipPath mask linearGradient radialGradient stop
  pattern title desc style`.
- **Attributes**: geometry, presentation attributes, `transform`, `viewBox`,
  `preserveAspectRatio`, `id`, `class`, `xmlns*`.
- **Refused**: `script`, `foreignObject`, `image`, `animate*` / `set`, any
  `on*` attribute, any `href` / `xlink:href` that is not `#fragment`, any
  `url(…)` that is not `url(#…)` (in attributes and in `<style>`), `@import`,
  a DOCTYPE or entity declaration.
- **Required**: a `viewBox`; at most 1 MB.

Each refusal names what it found (`svg refused: <foreignObject> is not
allowed`). After the check passes, svgo minifies the file with `viewBox`
preserved. svgo moves from devDependencies to dependencies (`brand:build`
already uses it).

Font-embedding exports (Excalidraw's default) are refused by the `url()` rule;
the skill says to export with "embed fonts" off.

### 5.2 Upload doors

- **`uploadSvg` in `lib/storage.ts`**, with its own options whose
  `allowed_formats` is `["svg"]`. The raster `uploadOptions` and its
  `allowed_formats` are unchanged, so a cover, a screen or a media item still
  cannot be an SVG.
- **Article door**: `POST /api/articles/assets` accepts `image/svg+xml`, runs
  the check, calls `uploadSvg`. Raster files take the existing path unchanged.
- **Admin**: `uploadImageAction` takes a `purpose: "figure-svg"`; only the
  figure popover's slot passes it. `checkUploadFile` keeps refusing SVG for
  every other caller (`lib/upload-input.test.ts`'s "rejects svg specifically"
  stays true for the default purpose).
- **To verify before implementation depends on it**: whether the Cloudinary
  account's security settings allow SVG delivery. If not, it is a setting.

### 5.3 Rendering

Always `<img>`, never inlined, never transformed. A source test pins that no
file in `components/staging/` uses `dangerouslySetInnerHTML` or fetches an
image's bytes.

## 6. The article door

### 6.1 Validation (`lib/staging-check.ts`)

`stagingProblems(markdown)` runs beside `imageProblems` on every posted half
and reports by name, as a 400:

- `figure: size=xl is not one of s, m, l, wide`
- `figure: unknown attribute colour`
- `compare: needs one :::do and one :::dont`
- `quote: by is required`
- `gallery: a staged block cannot sit inside callout`
- `gallery: needs at least two images`
- `figure: unclosed — no matching :::`
- `:::warning is not a staging block (figure, gallery, compare, callout, quote)`
  — an unknown container name is refused, because an agent that wrote one
  expected it to mean something
- `::figure must be a container — write :::figure … :::` — the leaf form of a
  staging name, the commonest slip

### 6.2 SVG placement

`markdownImages` (`lib/article-images.ts`) parses with remark-parse + gfm +
directive — the renderer's parse — and reports each image's enclosing block.
`imageProblems` refuses an `.svg` image outside a `:::figure`:
`…/clock.svg: SVG is accepted only inside :::figure`. The Ariko-hosting check
is unchanged and applies to SVG URLs too (`uploadSvg` uploads to the same
folder).

## 7. The skill

`plugins/ariko-article/skills/ariko-article/SKILL.md` gains a **Staging**
section after "Draft":

- The five blocks, one canonical example each, from real material (kosymoz's
  lake in a phone, its "In two words" callout, the Spine quote).
- When to reach for each: one screen → `figure`; screens meant to be compared →
  `gallery`; a rule shown by its opposite → `compare`; a definition or aside →
  `callout`; someone's own words → `quote`. When not to: a plain image needs no
  figure; an unattributed `>` stays a `>`.
- The upload step allows SVG for figures, states the check's rules (no scripts,
  no external refs, a `viewBox`, embed fonts off, 1 MB), and quotes the refusal
  text.
- The 400s of §6 and how to fix each.

After merge, `npm run skill:zip` must be re-uploaded to the claude.ai account
(the PR body says so; it is the maintainer's step).

## 8. Testing

- **`lib/staging-fixtures.ts`** — real excerpts: kosymoz's phone figure, the
  ramps + tints as one gallery, its five callouts, the reduce-motion compare;
  three pbbls-feed-redesign quotes as `quote{by=Alexis}`, including the
  ten-line one with hard breaks (`\` and two-space endings); a krabs entry with
  a callout. Plus malformed variants: no image, missing `do`, `size=xl`, a
  gallery in a callout, an unclosed fence, a fence inside a code block, `do`
  outside a compare.
- **Conformance** (`lib/markdown-conformance.test.ts`) over every fixture:
  parse → serialize is stable after one pass, and remark's render of the saved
  markdown equals its render of the original.
- **Render** (`lib/markdown.test.ts`): each block's HTML, the sanitize schema
  stripping a non-member value, malformed blocks unwrapping with their text
  intact.
- **Door**: `stagingProblems` messages; SVG placement; route tests for the
  asset door's SVG branch.
- **SVG check**: hostile files (`<script>`, `onload`, `<foreignObject>`,
  external `xlink:href`, `url(https://…)`, `@import`, `<image>` with a data
  URI, a DOCTYPE entity, no `viewBox`, >1 MB) are refused by name; clean Figma
  and Excalidraw (embed fonts off) exports pass.
- **Source tests**: `components/staging/*` and `components/desktop-frame.tsx`
  on the server-safe list; no `dangerouslySetInnerHTML`; `PhoneFrame` carries
  no `bg-neutral-900`.
- **Acceptance, after merge** (code first, content after deploy — the
  workflow rule): re-stage the kosymoz essay through the door from
  `../sparkaik` (it is a door-written draft, so a re-post replaces it); then
  open it in the admin, edit one caption and one quote's `role`, save, and diff
  the stored markdown — only those two lines may change.

## 9. Order of work

One PR, each step green before the next:

1. `lib/staging.ts` and the fixtures.
2. The remark pass, the components and the public render, with `PhoneFrame`
   going quiet and `DesktopFrame`.
3. The editor nodes and the conformance suite, then the node views and
   popovers.
4. SVG: the check, the upload doors, the placement rule.
5. The door validator and the skill.

If review finds it too large, split after step 3: render + editor, then SVG +
door + skill.

## 10. Out of scope

- The lightbox for article figures (§3.4).
- Inline SVG and token-themed diagrams (decision 3).
- Flush justified gallery rows (decision 7).
- Migrating the twelve pbbls quotes or any published content to the new
  blocks — that is an editorial act in the admin, after deploy.
