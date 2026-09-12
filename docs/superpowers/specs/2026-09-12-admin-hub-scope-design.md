# The admin gets a subject — plants at the root, a scope in the chrome

*2026-09-12*

> Class names are written as prose in this file on purpose. Tailwind v4 scans
> source files as TEXT, and `docs/` is source: a utility spelled inside a code
> fence here is minted into the stylesheet. `app/admin/layout.tsx`'s docblock
> is where that was learned.

## 0. The observation

The admin has five sections and no subject. `/admin/garden` lists plants and
pods in one table because they are "the two tiers that hold narrative" — a
sentence about the *schema*, not about anything an author does. A tier column
exists only to say which of the two kinds each row is. A visibility column
exists only to say which of two states each row is in. Both columns are the
table apologising for mixing things that were never one list.

Meanwhile the thing an author actually works on — a plant, with its pods, its
beans, its sprouts, its screens — has no surface that gathers it. The plant page
is a narrative editor with a floating panel of links stuck to its right edge.
To see a plant's sprouts you go to the Vault and filter. To see its screens you
go to the library and filter. The filter is already there, on both pages, spelled
`?plant=` — the admin has had the right idea in two places for a while, and has
never once said it out loud.

Vercel says it out loud. The dashboard *is* the project list; a project is a
scope you pick once and carry; the sections that can be scoped narrow, the ones
that can't step aside, and the ones that only exist inside a project appear.
That is the shape this slice brings to Ariko, with the botanical model supplying
the nouns.

**One decision applied everywhere: the admin's subject is a plant, and the URL
always says which one.**

## 1. The map

### 1.1 Routes

| today | after |
|---|---|
| `/admin` — the inbox table | `/admin` — greeting, search, the two plant tables |
| — | `/admin/inbox` — the seed table, moved verbatim |
| `/admin/garden` — plants and pods, tier + visibility columns | gone; redirects to `/admin` |
| — | `/admin/pods` — the pod index |
| — | `/admin/beans` — the bean index (beans have never had one) |
| `/admin/vault` — sprouts | `/admin/sprouts`; `/admin/vault` redirects |
| `/admin/screens` | unchanged |
| `/admin/beanstalk` | unchanged |
| `/admin/plant/[slug]` — editor + Inside panel | the hub: header, narrative, four previews |
| `/admin/pod/[slug]`, `/admin/bean/[id]`, `/admin/sprout/[slug]`, `/admin/triage/[id]` | unchanged |

The two redirects live in `next.config.ts`, permanent `false`: they are for
bookmarks and for the eight `/admin/vault` and six `/admin/garden`
`redirect()` calls in `app/admin/actions.ts`, which move with the routes rather
than leaning on the rewrite.

### 1.2 Why "Vault" stopped being a word

The content model is Pod → Bean → Sprout. "Vault" names none of those tiers; it
named a page that happened to list the last one. With pods and beans getting
indexes of their own, the three sections are one per tier and each is named for
its tier. Nothing is left to explain, which is the test a name passes or fails.

`Beanstalk` keeps its name: it is the federation, not a tier.

The rename reaches the module too: `lib/vault.ts` becomes `lib/sprouts.ts`,
`filterVaultEntries` becomes `filterSproutEntries`, `VaultFilters` becomes
`SproutFilters`, and `VAULT_KEYS` becomes `SPROUT_KEYS`. A file called
`vault.ts` behind a page called Sprouts is the drift this slice exists to stop,
and the test file moves with it.

### 1.3 The rail

`NAV_ITEMS` becomes six, and the root leaves it:

    Inbox · Pods · Beans · Sprouts · Screens · Beanstalk

`/admin` is reached by the Ariko mark in the top-left cluster, not by a section
icon. Three consequences in `lib/admin-nav.ts`:

- `resolveNavItem`'s special case — "`/admin` is a prefix of every admin URL, so
  it can only ever match EXACTLY" — **disappears**. The welcome page is in no
  section and lights nothing. `/admin/inbox` is an ordinary prefix like the
  rest.
- `SECTIONS` gains `/admin/pods` → Pods, `/admin/beans` → Beans, and
  `/admin/bean` moves from the Vault to Beans; `/admin/sprout` and
  `/admin/vault`'s entry become `/admin/sprouts`; `/admin/plant` and
  `/admin/pod` no longer point at a Garden that does not exist —
  `/admin/pod` lights Pods, and `/admin/plant` lights **Overview** (§2.3).
  `/admin/triage` still lights the Inbox, whose href is now `/admin/inbox`.
- `resolveColumn` keeps its rule — *a section index is wide, everything else
  reads, login is bare* — and gains exactly one clause: `/admin` is wide,
  because it holds two tables. It is spelled as its own line rather than by
  putting the root back into `NAV_ITEMS`, because the root is not a section.

`NavItem` gains an `id` (`inbox`, `pods`, `beans`, `sprouts`, `screens`,
`beanstalk`, `overview`) and `SECTION_ICONS` is re-keyed by it. This is not
tidiness: Overview's href is per-plant, so an href-keyed map cannot hold an icon
for it, and `lib/section-icons.test.ts` — which exists because the map already
drifted once — would have to be weakened to let it through. Re-keying keeps the
test exactly as strict. `sectionItems()` in `lib/palette-items.ts` builds its
`section:` ids off the same field.

### 1.4 The two plant tables

Published and Private, each with its count in the heading, each the *same*
component rendered twice so they cannot drift. Columns: name · role · status ·
narrative.

- **tier** goes: only plants are listed.
- **visibility** goes: the two tables *are* the visibility, and a column
  repeating the heading of the table it is in is a column saying nothing.

Membership is `visibilityOf(plant)` — the vocabulary module, never a raw field
read, for the reason `lib/plant-visibility.ts` exists. The glyph columns are the
ones that survive the split, drawn by the same `components/admin/glyphs.tsx`
island the old garden table used, each still carrying its word in an `sr-only`
span.

Pods are not on this page at all. A pod without its plant is a row that has to
tell you which plant it belongs to before it can tell you anything else, which
is precisely the column the old table needed and the new one doesn't.

## 2. The scope

### 2.1 The carrier

`?plant=<slug>`, in the URL, on every section that can narrow. Not a cookie and
not a path prefix:

- A cookie makes a URL stop describing what it shows. `lib/admin-filters.ts`
  was written to keep that property ("a filtered view stays shareable and
  filtering stays server-side"); the scope is a filter with a better control,
  not a different kind of thing.
- A path prefix (`/admin/p/[slug]/sprouts`) is truer to Vercel and costs a
  duplicate page module per section for the scoped and unscoped forms. The
  parameter reaches the same behaviour with the machinery two pages already
  use.

### 2.2 `lib/admin-scope.ts`

One pure, JSX-free module — the rule lives in `npm test`, not in a component:

```
resolveScope(pathname, active): string | null
```

The slug from `/admin/plant/<slug>` when that is the pathname, else
`active.plant` when non-blank, else `null`. **The hub's own slug is the scope**,
so the switcher never reads "All" while the page under it is a plant. Nothing
else in the admin has a plant in its path — a pod, bean or sprout detail page
carries `?plant=` forward or carries nothing.

```
scopeHref(pathname, active, keys, slug | null): string
```

Where a switcher row points:

- on a filtering section — `filterHref(pathname, active, keys, "plant", slug)`,
  the existing builder, so the other active dimensions survive the switch;
- on the root, the hub, or anything unrecognised — `/admin/plant/<slug>`;
- for **All** — the same call with `"all"`, which `filterQuery` already drops;
  from the hub, `/admin`.

```
navHref(item, scope): string
```

Appends `?plant=` to a rail item when a scope is active, so Sprouts → Screens
keeps the plant. Overview's href is built from the scope itself.

`keys` is the section's own filter-key list (`VAULT_KEYS`, `SCREEN_FILTER_KEYS`,
and the two new ones), resolved from the pathname by a small map in this module.
Handing `filterHref` a named key list is what keeps a hand-typed query string
from surviving a click, which is the same reason `filterQuery` takes one.

### 2.3 The rail changes shape

- **scoped** → **Overview** is prepended, pointing at the hub. It is the item
  that cannot aggregate: there is no all-plants overview, because that page is
  the root.
- **scoped** → **Beanstalk** drops out. It merges sprouts with pollen envelopes
  from sibling repos, and an envelope has no plant. A Beanstalk filtered to one
  plant would answer half its own question and silently hide the other half;
  stepping aside is honest and is what Vercel does with team-level surfaces
  under a project scope.
- Everything else stays put and narrows.

`navItems(scope)` in `lib/admin-nav.ts` returns the rail for a given scope —
one function, tested, rather than two conditionals in the client component.

### 2.4 The control

A new cluster: `Chrome` with the `top-left` magnet, an orientation of
horizontal. `lib/chrome-magnet.ts` already has all eight edges and derives the
hover-label side from the magnet, so the cluster costs no new geometry and the
labels open the right way without being told.

It holds the Ariko mark (a link to `/admin`) and one trigger: the scoped plant's
`EntityAvatar` and name, or "All". The trigger opens the registry's popover onto
the plant list, where **every row is a plain anchor**. Selecting a plant is a
navigation — no server action, no cookie, no write — which is what makes the
resulting URL a description of the view and makes the whole control inert rather
than destructive with script off (it simply does not open; every destination it
offers is reachable from the root's tables).

The list is grouped Published then Private, mirroring the root.

### 2.5 Where the trigger's plant comes from

The trigger must draw the scoped plant's name and mark **before** the popover
opens, so it cannot use the palette's fetch-on-open trick. `app/admin/layout.tsx`
reads `loadRawGarden()` and hands `AdminChrome` a small array of
`{ slug, name, logoUrl?, visibility }`.

Two things about that read:

- It is the **live** reader, never `loadCachedGarden`. CLAUDE.md's rule is that
  the admin reads live, and the chrome is the surface most likely to be looked
  at immediately after a rename.
- It is a second garden read on pages that already load one. The alternative —
  fetching `/admin/palette` on mount — costs a flicker of "All" on every admin
  page load, which is worse: the chrome would routinely misstate the scope for
  as long as a round trip takes.

The layout is a server component and the chrome is a client one, so this is the
`ExhibitionPanel` pattern: the server composes, the island receives a prop and
learns nothing about the garden.

### 2.6 What each section does with it

| section | narrows by |
|---|---|
| Inbox | `seed.suggested.plantSlug` — exact match |
| Pods | `parents` containing the plant ref |
| Beans | the rollup of §3.3 |
| Sprouts | `filterVaultEntries`, which has had a `plant` dimension since it existed |
| Screens | `filterScreens`, likewise |
| Beanstalk | nothing — it is not in the rail when scoped |

A seed whose `suggested.plantSlug` names nothing the garden holds appears only
under **All**. That is the existing rule of `plantMark` in the inbox — a
suggestion arrives over the wire from a sibling repo and can name a plant that
was renamed or never existed, and an unresolvable suggestion draws nothing
rather than something wrong. Filtering treats it the same way: it is not
evidence of membership.

**An unresolvable `?plant=`** — a slug no plant has — makes the switcher read
"All" and hides Overview, while the section below renders its ordinary empty
state. The chrome never asserts a plant the garden cannot produce; the section
never pretends the filter was not asked for.

## 3. The hub

`/admin/plant/[slug]` keeps `PlantHero` exactly as it is — the five icon
editors, the two enums that commit on a separate Save, and the accessible names
`lib/plant-hero-a11y.test.ts` pins — and keeps the unboxed `ProseEditor`. The
back-link changes from `← garden` to `← plants`, pointing at `/admin`.

### 3.1 Four previews

Below the prose, a two-column grid on wide screens: **Pods · Beans · Sprouts ·
Screens**. Each preview is a heading with a count, at most five rows, and an
`all <n> →` link into its section carrying `?plant=`.

Each renders the **section's own** table component with a row limit. `PodTable`,
`BeanTable` and `SproutTable` each live in one file with two callers — the
section index and the hub — which is the shared-surfaces rule applied inside one
zone: *if two surfaces draw the same thing, they draw it from the same file, and
what differs is a parameter.* `SproutTable` is an extraction of the table
`/admin/vault` renders today, not a new one.

### 3.2 The screens preview is not the library's tiles

It is plain anchors around thumbnails. The library's tiles are this repo's only
`next/link`, deliberately confined to the four files of the interception slice
so that clicking a tile in the library opens the side sheet; importing them here
would spread that library outside its boundary, and
`lib/screen-sheet-source.test.ts` exists to notice. A click from the hub is an
ordinary navigation into the library, which is what it should be: the hub is not
a place to edit screens.

### 3.3 The bean rollup

`Dataset.beansForPlant` is beans parented **directly** to the plant. A plant's
real bean set is that plus the beans of each of its pods. `lib/plant-hub.ts`
composes it — direct beans, then `beansForPod` over `podsForPlant`, deduped by
slug, sorted by name — with its own test.

Composing it inline in the page would be a fourth way to miss a bean.
`lib/palette.ts`'s docblock already names the trap: there is no whole-bean
accessor on `Dataset`, and faking one out of `beansForPlant` + `beansForPod` +
`standaloneBeans` is three chances to drop one. `/admin/beans` scoped to a plant
uses this same function, so the hub's count and the section's count are the same
number by construction.

### 3.4 `plant-inside.tsx` loses half its job

The Inside panel listed a plant's pods and beans on a floating right-hand rail
because the page had nowhere else to put them. The hub lists them in the page
now, so the panel and its `items` prop go.

What stays is the **Exhibition** rail, unchanged, because re-sequencing the
strip is the one thing a preview cannot do — membership survives script-off
through `screen-exhibit-form.tsx`, ordering needs the panel. The component
becomes `PlantRail`, keeping the page-nudge wrapper and the exhibition trigger;
the docblock's argument for the Inside panel goes with the panel, and
`lib/exhibition-panel-source.test.ts` — which pins that this island composes no
payload — is untouched by the change and must stay passing.

## 4. The root's search

The greeting is `lib/greeting.ts`: one pure function from a `Date` to "Good
morning" / "Good afternoon" / "Good evening", with a test. It has no other job.

The search is the ⌘K autocomplete, inline and auto-focused. It is **not** a
second implementation. `command-palette.tsx` splits:

- `PaletteAutocomplete` — the input, the `/admin/palette` fetch, the grouped
  rows, the icons, the row marks. Everything that decides what a result looks
  like.
- `CommandPalette` — the chrome's dialog shell around it, with the hotkey and
  the trigger. Unchanged in behaviour.
- `PaletteSearch` — the root's bare shell around it, auto-focused on mount.

One index, one row definition, two shells. The palette's guarantees carry over
unchanged: it fetches nothing until it is used, it writes nothing, it is a
navigator and not a command runner, and it imports `lib/palette-items.ts` and
never `lib/palette.ts` — the latter reaches `lib/data.ts`, which opens with
`node:fs`, and importing it from the browser fails the build rather than merely
bloating it.

The palette's groups follow the rename: **Go to · Plants · Pods · Beans ·
Sprouts · Inbox**, and `buildPaletteIndex` puts each kind in its own group
instead of folding pods into "Garden" and beans into "Vault". Every `href` it
emits for a bean stays `/admin/bean/<slug>` — the detail routes do not move.

Script-off, the root is the greeting and the two tables. The input is simply not
there, and it adds no destination of its own: every plant it can reach is a row
in a table below it.

## 5. What the tests pin

New:

- `lib/admin-scope.test.ts` — `resolveScope` on the hub path, on `?plant=`, on
  neither, and on both (path wins); `scopeHref` preserving a co-active filter,
  dropping the key for All, and leaving the section for the hub from the root;
  `navHref`.
- `lib/plant-hub.test.ts` — the rollup includes pods' beans, dedupes a bean
  parented to both a pod and its plant, and is empty for a plant with neither.
- `lib/greeting.test.ts` — the three boundaries.

Changed:

- `lib/admin-nav.test.ts` — the six items, `navItems(scope)` prepending Overview
  and dropping Beanstalk, `resolveNavItem` for the new prefixes (including that
  `/admin` now lights nothing and `/admin/beanstalked` still lights nothing),
  and `resolveColumn` on the root.
- `lib/section-icons.test.ts` — re-keyed by id, still exhaustive over every item
  `navItems` can produce, Overview included.
- `lib/admin-filters.test.ts`, `lib/palette-render.test.ts`, `lib/palette.test.ts`
  — renamed routes and regrouped rows.

Unchanged and must stay green — this slice touches their neighbourhoods:
`lib/plant-hero-a11y.test.ts`, `lib/exhibition-panel-source.test.ts`,
`lib/screen-sheet-source.test.ts`, `lib/server-safe-source.test.ts`,
`lib/garden-cache-source.test.ts` (the layout's new read is `loadRawGarden`, and
a `loadCachedGarden` there would be a privacy-shaped mistake in the one place
every admin page renders).

## 6. What this slice does not do

- No create-plant form. The admin has never had one and this is not the slice
  that adds it.
- No counts on the rail icons. A scoped rail that also reported sizes would need
  every section's data on every page render.
- No scope on Beanstalk. §2.3.
- No change to any detail page's editors, to any server action's payload, or to
  the public zone. The only public-facing consequence of this slice is none.

## 7. Delivery

One PR, because the rail, the routes and the scope are one decision and an
intermediate state where the rail says Pods and the hub still floats its Inside
panel is worse than a larger diff. It ships with a Lab Note: an author-facing
change, and the author is a user.
