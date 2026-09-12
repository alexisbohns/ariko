# The narrative gets a page, and the hub stops reading in two columns

*2026-09-12*

> Class names are written as prose in this file on purpose. Tailwind v4 scans
> source files as TEXT, and `docs/` is source: a utility spelled inside a code
> fence here is minted into the stylesheet. `app/admin/layout.tsx`'s docblock
> is where that was learned.

## 0. The observation

The hub slice (`2026-09-12-admin-hub-scope-design.md`) gave the plant page a
body: a header, the narrative, and four previews of what the plant contains. It
shipped as one scroll, and the scroll has two problems.

The first is that the narrative is an **editor**, sitting in the middle of a
page that is otherwise a **directory**. Everything above it and everything below
it is something to look at and click through; the middle of it is a caret. A
page that is mostly an index of four sets has the plant's longest-lived writing
wedged into it, and the writing is the thing least likely to be what you came
for — you open a plant hub to find a sprout far more often than to rewrite the
project's story. The editor is also the heaviest thing on the page, and it
mounts on every visit to a page whose other four sections are static tables.

The second is that the four previews were laid out as a two-column grid on
large screens, inside the **reading** measure. Two columns of the reading
measure is roughly 300px each: a table of a name, a visibility glyph and two
counts, rendered into a width that was chosen for a paragraph of prose. The
grid was saving vertical space the page did not need to save.

**One decision, twice: the plant hub is a directory, and a directory's sections
run the full width of its column.** The narrative leaves for a page of its own,
and the four previews become five stacked sections.

## 1. The map

### 1.1 Routes

| today | after |
|---|---|
| `/admin/plant/[slug]` — header, narrative editor, four previews in a 2-col grid | the hub: header, five full-width sections, first of them a narrative *excerpt* |
| — | `/admin/plant/[slug]/narrative` — the editor, alone |

This is the admin's **first hub child route**, which is worth saying out loud:
`lib/plant-path.ts` was written for it. `plantSlugFromPath` already truncates
`/admin/plant/ariko/anything` to `ariko`, so the rail keeps lighting Overview
and the plant switcher keeps naming the right plant, with no change to
`resolveNavItem` or `resolveScope`. That module's docblock describes the exact
bug this route would have caused before it existed — the rail confidently
lighting Overview for a plant the switcher disagreed about. Nothing to fix; a
claim to pin.

`resolveColumn` is likewise untouched. The narrative page is prose and reads in
the **reading** measure by the existing fall-through rule; the hub stays in it
too, because its sections are now full-width *within* that measure, which is
already twice what the grid gave them. Making the hub wide would cost a new
clause keyed on a plant path, a test for it, and a hub whose measure disagrees
with its own narrative page's.

### 1.2 The URL, spelled once

`lib/plant-path.ts` gains one export:

    narrativeHref(slug) === `${hubHref(slug)}/narrative`

Three callers need that string — the hub's `edit →` link, the narrative page's
own back link (via `hubHref`), and `editContainerContentAction`'s redirect. The
repo's rule is that the plant address is spelled in one file, and a second
builder here is the drift `plant-path.ts` exists to prevent.

## 2. The narrative page

`app/admin/(chrome)/plant/[slug]/narrative/page.tsx`, a server component with
`dynamic = "force-dynamic"`, like every other admin page.

It reads **`loadRawGarden`**, not `loadCachedGarden` — the admin rule, and here
for the sharpest version of the reason: this page loads the markdown into an
editor and posts it back, so a cached read could load a stale body and save it
over a newer one.

It renders three things:

1. A back link to `hubHref(slug)`, reading `← <plant name>`, in the same muted
   style as the hub's `← plants`.
2. One heading: an uppercase, letter-spaced eyebrow reading *Narrative* over an
   h1 carrying the plant's name.
3. The `ProseEditor`, moved from the hub **verbatim** — `bare`, the same
   `entityOptions(raw, "plant:<slug>")`, the same `editContainerContentAction`,
   the same hidden ref, and the same STRICT `textPart(plant.content, "en")`
   (`resolveText` would load the fr half into the editor and save it back as
   en).

Plus the destructive alert for a rejected content save, which the hub used to
catch and which now arrives here with the redirect.

**It does not render `PlantHeader`/`PlantHero`.** The hero's five editors belong
to the hub; drawing them here would give the plant two places to rename itself,
two logo popovers and two visibility toggles to keep in agreement. The eyebrow
and the name are enough to say where you are, and the back link is one click
from everything else.

**It does not render `PlantRail`.** The rail's single panel reorders the
exhibition strip, which has nothing to do with prose.

### 2.1 Where a save lands

`editContainerContentAction` computes its own `back` from the ref it was given:
`/admin/plant/<slug>` for a plant, `/admin/pod/<slug>` for a pod. For a plant
the editor no longer lives there, so the plant branch becomes
`narrativeHref(slug)` and the pod branch stays as it is. The rule the action
follows is unchanged and now says something slightly stronger: **it redirects to
wherever that ref's editor actually is.** Both the error redirect and the
success redirect move together — they are the same `back`.

The alternative, a `back` field in the form, is rejected: it is a
client-supplied redirect target on an authenticated write path, and validating
it would be more code than the two-branch expression it replaced.

## 3. The hub, restacked

`ProseEditor`, `entityOptions`, `editContainerContentAction` and `textPart`'s
editor use leave the page. The grid wrapper becomes a vertical flex column with
the same gap the article already uses between its other blocks.

Five sections, in this order:

| section | set | way out |
|---|---|---|
| **Narrative** | the plant's own words | `edit →` → `narrativeHref(slug)` |
| Pods | `podsForPlantSorted` | `all n →` → `/admin/pods?plant=` |
| Beans | `beansForPlantDeep` | `all n →` → `/admin/beans?plant=` |
| Sprouts | `filterSproutEntries` | `all n →` → `/admin/sprouts?plant=` |
| Screens | the plant's screens | `all n →` → `/admin/screens?plant=` |

Narrative goes **first**: it is the plant's own words before it is a container
of anything, and it is what the page used to open with under the header.

`ScreenThumbs` keeps its four-column grid and `PREVIEW_SCREENS` stays at 4.
Full width does not mean more thumbnails; it means the four are bigger.

### 3.1 One shell, two meanings

Five sections have to look like one thing, and two of them mean different
things. So `app/admin/_components/preview-panel.tsx` splits in two:

- **`PreviewSection`** — the shell, and the only place the shape is decided: a
  heading row (title, an optional muted suffix, an optional trailing link) and
  then either the children or one muted line of empty-state text.
- **`PreviewPanel`** — a thin wrapper over it, unchanged from the outside. It
  still decides `(count)`, `all n →` and *nothing yet*, and its docblock's
  warning about `count` being the FULL count survives intact. **All four
  existing call sites stay exactly as they are.**

The new second wrapper, `NarrativePreview`
(`app/admin/_components/narrative-preview.tsx`), decides the link's words
(`edit →` over a written narrative, `write one →` over an empty one) and
*nothing written yet*, and draws the excerpt as two clamped lines of muted
text. It takes
the excerpt as a prop — it derives nothing and reads no field name, the same
posture `ExhibitionPanel` has.

A single component with a union of props was the alternative, and it would have
made `count`, `allHref`, `linkLabel` and `empty` mutually-conditional on each
other. Two wrappers over one shell is fewer branches and one place to change the
shape.

### 3.2 The excerpt

New pure module, `lib/narrative-excerpt.ts`: markdown in, one line of plain text
out. It strips fenced code blocks, heading markers, list and quote markers, link
and image syntax (keeping the link text), and inline emphasis and code ticks;
collapses all whitespace to single spaces; and cuts to a character budget on a
word boundary with an ellipsis. Empty in, empty out.

Plain text rather than rendered-then-clamped markdown, for a concrete reason: a
two-line clamp over real rendered markdown is one leading heading, image or code
fence away from being a picture of nothing. It is also a pure function, which
means it is testable without a renderer — the property most of this repo's
`lib/` is organised around.

The hub passes it `textPart(plant.content, "en")`, the **same** strict read the
editor loads. `resolveText` here would show an fr excerpt over an editor holding
the empty en half.

## 4. What the tests pin

- **`lib/narrative-excerpt.test.ts`** — the new pure function: a fenced block
  does not leak backticks or code into the line; a document that opens with a
  heading yields the heading's words, not a hash; an entity link yields its
  text; emphasis markers do not survive; an empty or whitespace-only document
  yields the empty string; the budget cuts on a word boundary.
- **`lib/admin-nav.test.ts`** — `resolveNavItem("/admin/plant/x/narrative")`
  returns `hubHref("x")` and `resolveColumn` of the same path is `reading`.
  Both pass today. The point is that the first hub child route to actually
  exist is now the thing pinning the claim `lib/plant-path.ts`'s docblock
  makes, rather than a hypothetical in a comment.
- **`lib/admin-section-source.test.ts`** — a third case, in the file that
  exists for facts about a page that nothing else can see: the narrative route
  hands `ProseEditor` the ref `plant:<slug>` and the STRICT en `textPart`, and
  the hub hands `NarrativePreview` an excerpt derived from that same strict
  read. The two reading different halves of a bilingual field is the failure
  this file's docblock describes — plausible-looking, and green under `tsc`,
  `npm test` and `npm run build`.

`lib/plant-hero-a11y.test.ts` and `lib/exhibition-panel-source.test.ts` are
untouched: the hero and the rail stay on the hub, unchanged.

## 5. What does not change

- No public-zone file. This is entirely `/admin`.
- No middleware matcher and no auth code: `/admin/plant/[slug]/narrative` is
  under `/admin/:path*` like everything else, and the route group's name never
  reaches the URL.
- No server-safe-source obligation: nothing here is rendered by
  `app/(public)`.
- No schema change. The narrative is still `plant.content`, written by the same
  action through the same builder.
- No change to the four existing `PreviewPanel` call sites.

## 6. Lab Note

Admin changes carry notes in this repo — #92 and #93 both did, because Alexis is
the user of the admin and the changelog is where that work becomes visible. The
PR body carries one, drafted from the benefit rather than the mechanism: the
project's story gets a room of its own, and the plant's page reads as a
directory.
