# Code quality audit — 2026-09-10

**Scope.** The whole repo at `0a3e040` (main, after #81): `app/`, `components/`,
`lib/`, `scripts/`, the four `.github/workflows`, `CLAUDE.md`, `README.md`,
`docs/superpowers/ROADMAP.md`. Five lenses, as asked: factorization, back-end,
front-end componentization, asset rendering, and the agentic guidelines — with
the zero-client-JavaScript rule examined on its own.

**Method.** Every file in scope was read. Claims that could be measured were:
`tsc`, `npm test`, `npm run build` were run on a clean install, the built
`<head>` and route manifest were inspected, and the two brand SVGs were
rendered with `react-dom/server` to weigh them. Every finding carries a
`file:line` so it can be checked; line numbers are from this commit.

**Nothing in this document was changed in the code.** It is an audit, and the
proposed guideline rewrite (Appendix A) is a draft for a decision, not a
decision.

---

## 0. Baseline

| Measure | Value |
|---|---|
| Source files (ts/tsx/css/md/json/mjs, excl. deps) | 468 |
| Lines in `app/` + `components/` + `lib/` + `scripts/` | ~35,900 |
| Test files / tests | 93 / 1,140 (1,092 pass, 48 DB-gated skips) |
| `tsc --noEmit` | clean |
| `npm run build` | clean, 29 routes, all `ƒ` (dynamic) but `/_not-found` |
| Comment density, `lib/` non-test | 3,148 of 8,485 lines (37 %) |
| Comment density, `app/` | 1,666 of 7,422 lines (22 %) |
| ESLint / Prettier / Biome | none — CI is `tsc`, `npm test`, `npm run build` |
| Contributors / commits | 1 / 50 |
| `CLAUDE.md` | 458 lines, 4,483 words |

Client JS shipped per route (gzip, from the build manifest):

| Route | First Load JS | Note |
|---|---|---|
| `/` (public, zero islands) | 102 kB | React DOM 54 kB + Next runtime 46 kB |
| `/plant/[slug]`, `/pod/[slug]`, `/bean/[id]` | 111 kB | +8.5 kB is `clsx`+`tailwind-merge`, pulled by the stock `"use client"` on `table.tsx` |
| `/beanstalk` | 113 kB | + Base UI `Separator` |
| `/admin/plant/[slug]` | 356 kB | |
| `/admin/sprout/[slug]` | 310 kB | |
| Middleware | 34.5 kB | runs on every public request |

The public zone's one deliberate island, `TocRail`, is **1.2 kB** of that.

The codebase is in unusually good shape on the axes that are hard to retrofit:
strict TypeScript, a single security boundary for public reads (`filterPublic`),
pure write-path builders with unit tests, validated env-free CI, design tokens
with no hex literals outside `globals.css`, and consistent server-action forms.
The findings below are mostly about **cost that has accumulated in service of
a rule that no longer earns it**, and about a data layer that has not yet been
asked to scale.

---

## 1. Agentic guidelines and rules

### 1.1 The zero-client-JavaScript rule should be retired, not extended

**Where the rule comes from.** `README.md:57-62` still says the project's
constraints are *"Zero CSS. No styling whatsoever. No UI library. Plain semantic
HTML only."* and `docs/superpowers/ROADMAP.md:30-33` says the admin is *"bare
functional HTML (no CSS, no client JS, no UI framework) **until an artistic
direction is set**"*. That condition was met months ago: Tailwind v4, shadcn on
Base UI, two typefaces, a floating chrome, popovers, sheets, a command palette.
The README's constraint list is now simply false, and the rule it justified
has outlived its premise.

**What the rule has become.** `CLAUDE.md` is 458 lines. Roughly 300 of them
narrate **six numbered exceptions** to the no-JS rule (editor, media picker,
seed overlay, palette, plant hero, TOC rail), then **five "neighbours that are
not exceptions"**, each with its own argument for why it does not count. The
rule is no longer a rule; it is a ledger of exemptions, and every slice adds a
paragraph. An agent reading it must hold the whole ledger to know whether the
seventh island is admissible, which is the opposite of what a guideline is for.

**What it measurably buys.** The public pages ship 102–113 kB of JavaScript
with zero or one island, because React and the Next runtime are there
regardless. The "no lucide in a public server component" rule saves roughly
1.5–2 kB gzip for all five icons (`Icon.mjs` + `createLucideIcon` + ~700 B per
glyph). Meanwhile the *stock* `"use client"` directive on
`components/ui/table.tsx:1`, imported by the server component
`components/markdown.tsx:8-15`, costs **8.5 kB** on every prose page — and
nobody noticed, because the rule is enforced by a grep over a hand-maintained
list (`lib/server-safe-source.test.ts:43-51`) that does not include `ui/`.
The rule's enforcement caught the cheap thing and missed the expensive one.

**What it measurably costs.**

| Cost | Evidence |
|---|---|
| A parallel icon set, hand-copied from lucide and re-copied on every bump | `components/public-icons.tsx` (119 lines) + geometry test (108 lines) |
| Hand-rolled form controls instead of the registry's | `components/ui/native-controls.tsx` — precisely what CLAUDE.md says never to do, justified by script-off submission |
| ~1,160 lines of tests that assert directives and "renders nothing", not behaviour | `lib/*-mount.test.ts`, `lib/*-source.test.ts` (list in Appendix B) |
| Twenty files carrying the `__ready` marker protocol | `grep -c __ready` → 20 files |
| Form designs contorted around implicit submission | Meta-beside-Logo (`CLAUDE.md`, plant), Keyword-beside-Cover (bean), "TWO text inputs so Enter does not submit" (screen create) |
| Three mount-gate implementations of the same idea | `media-picker.tsx:126,144`, `command-palette.tsx:123-124`, `toc-rail.tsx:25-26` |
| A 356 kB admin page that is also required to be readable script-off by five inert icons | `plant-hero.tsx`, `lib/plant-hero-mount.test.ts` |
| Guidance that fails loudly for the wrong reason | `lib/toc-mount.test.ts:31-38` explains that React's rules-of-hooks are unenforced because *the repo has no ESLint* — a 40-line test comment where a 10-line lint config belongs |

**Who the rule protects.** The admin has exactly one user, behind a password,
who authors with a Tiptap editor. There is no script-off admin session and
there never will be. The public site is different: a portfolio *should* be
readable and navigable without script (crawlers, reader modes, link
previews, 2G), and it is — but that property is **progressive enhancement**,
a well-understood discipline with a two-sentence rule, not a prohibition with
six exceptions.

**Recommendation.** Replace the rule and its ledger with three invariants
(draft in Appendix A):

1. **Public zone: progressively enhanced.** Content, navigation and every
   link work with script off; islands only add. Keep
   `lib/server-safe-source.test.ts` (it is cheap and honest) and *extend* it to
   `components/ui/*` that the public zone imports.
2. **Admin zone: a JavaScript application.** Server actions remain the write
   path and server-rendered forms remain the default because they are less
   code, not because of script-off. Client state is allowed wherever it makes
   the UI better; no exception paragraph is needed.
3. **Write paths never mis-save from a partial form.** This is the one
   genuinely load-bearing thing the `__ready` protocol found: a form whose
   controls live in an island must not be submittable without them. Keep the
   marker, name it once (`lib/form-intent.ts`), and drop the per-island
   essays.

What can then be retired: the five `*-mount.test.ts` files that only assert
emptiness for admin islands (keep `media-picker-mount.test.ts`'s data-loss
assertion, reframed under invariant 3); `native-controls.tsx` in favour of the
registry `Select`/`RadioGroup`/`Checkbox` where a client form is already
warranted; the "no lucide in public" rule downgraded to "prefer inline
glyphs in the chrome" (keep `public-icons.tsx`, stop treating it as a law);
the six numbered paragraphs in `CLAUDE.md`.

### 1.2 Documentation drift

| Finding | Location | Severity |
|---|---|---|
| Constraints section asserts zero CSS / no UI library | `README.md:57-62` | high |
| Roadmap "last updated 2026-07-18", uses Molecule/Atom/Version throughout, describes the admin as bare HTML | `docs/superpowers/ROADMAP.md:3,15-33` | high |
| README's `/admin/vault`, `/admin/atom/[id]`, `/admin/version/[slug]` sections describe pages that were renamed or replaced | `README.md:263-305` | medium |
| `CLAUDE.md` references `lib/chrome-source.test.ts`, which was renamed to `server-safe-source.test.ts` | `CLAUDE.md:30` | low |
| The Lab Note contract exists in four copies (CLAUDE.md, README, PR template, plugin SKILL.md) | — | low |
| No `.env.example`; the eleven env vars are documented only in README prose | — | medium |

The ROADMAP's own preamble says it "aggregates" the plans' deferred sections
and should be pruned as slices ship. It has not been touched through twenty
slices. Either maintain it or replace it with a one-screen "where we are" and
let the specs directory be the history.

### 1.3 Comments as specification

37 % of `lib/` is comment. The docblocks are excellent as *history* — they say
why, they name the bug that motivated the guard, they cite the test. But a
number of them are load-bearing in a way a reader cannot tell from the outside:
`lib/screen-sheet-source.test.ts:29-47` strips comments before grepping *because
the comments describe the very thing the test forbids*. When a test must
pre-process the source to avoid tripping on its own documentation, the
documentation has become part of the runtime surface.

Recommendation: keep the why, move the *procedural* half ("change in both",
"if a fourth copy appears, extract") into code — a shared constant, a helper —
so the instruction cannot be ignored. Three concrete cases:

- `components/editor/prose-editor.tsx:132-138` says the prose class must be
  changed in two places. Export `PROSE_CLASS` from one file.
- `lib/botanical.ts:516-518` says to extract when a fourth `canonical()` copy
  appears. It has (§2.2). Extract.
- `app/admin/layout.tsx:77` and `side-sheet.tsx:34` must agree on `28rem`;
  a comment says so. Make it `SHEET_WIDTH`.

### 1.4 Tooling gaps

- **No linter.** `lib/toc-mount.test.ts:31-38` documents the consequence.
  `eslint-config-next` with `react-hooks` and `@next/next` rules is a
  one-file addition and would also flag the unused exports in §2.5.
- **No formatter.** Style is consistent by discipline; it will not stay so
  with a second contributor or a second agent.
- **`test` and `test:db` glob lists are hand-maintained** in `package.json`.
  A test file outside the four globbed directories silently never runs (the
  workflow comment in `.github/workflows/test.yml:1-5` records that this
  already happened once).
- **`.claude/` is absent**: no project settings, no allowlist, no
  `steward`/`babysit` skill despite CLAUDE.md addressing agents directly.

---

## 2. Back-end

**Data flow.** `lib/db.ts` caches one `MongoClient` on `globalThis`.
`lib/store.ts:15-26` `loadRawGarden()` runs six `find({})` in parallel with
only `_id` projected out — the whole garden, every field, on every call.
`getPublicDataset()` = `buildDataset(filterPublic(raw))`; `buildDataset`
(`lib/data.ts:359-493`) builds in-memory indexes. Every page and route is
`force-dynamic` and calls a loader directly; there is no `React.cache`, no
`unstable_cache`, no tag. Writes go through `app/admin/actions.ts` (964 lines,
27 exports): `requireSession` → read → pure `build*Patch` → narrow writer in
`lib/botanical.ts` → `revalidatePath` → `redirect`.

### 2.1 Query and cache

| # | Finding | Evidence | Sev |
|---|---|---|---|
| B1 | Every public and admin request loads all six collections, all fields, including every sprout's `content` (≤64 KiB) and `media[]`. A bean page loads every sprout to show one. `bees` is loaded everywhere and read only by `/api/graph`. | `lib/store.ts:17-24`; callers `app/(public)/page.tsx:39`, `plant/[slug]/page.tsx:18`, `pod/[slug]/page.tsx:13`, `bean/[id]/page.tsx:66`, `app/admin/page.tsx:78`, `app/admin/screens/new/page.tsx:31`, `app/api/graph/route.ts:12` | high |
| B2 | Eight actions load the whole garden to `find()` one document by slug. Four cascade actions load six collections when the cascade reads four fields of four collections. | `app/admin/actions.ts:361-364, 398-399, 438-439, 474-475, 518-519, 571-572, 607-608`; cascades `:201, 245, 248, 292` | high |
| B3 | 29 `revalidatePath` calls invalidate nothing — every page is `force-dynamic`. Three comments in the file already say so. They are boilerplate that hides the real question (see B4). | `app/admin/actions.ts` passim; `:416-417, 454-457, 585-586` | medium |
| B4 | No caching layer at all, so TTFB on the public site is one Mongo round trip plus dataset construction, per visitor, per page. | grep `unstable_cache\|React.cache\|revalidateTag` → none | high |
| B5 | Mongo client has default options: `serverSelectionTimeoutMS` 30 s, so an outage holds every public request 30 s before a 500. | `lib/db.ts:12-27` | medium |
| B6 | `seeds` has no index for its two real queries (`{id}`, `{status}` sorted by `createdAt`). `pollen` has an index (`anchors.plant`) that no query uses and lacks one (`feedId`) that `deleteMany` uses. `beans.slug` unique index is created twice. | `lib/seeds.ts:10-16,108-132`; `lib/pollen-store.ts:27-37,158-161`; `lib/botanical.ts:47` | medium |
| B7 | `listPollen()` has no limit and grows with every sync; both beanstalk pages render all of it. | `lib/pollen-store.ts:121-126`; `beanstalk/page.tsx:22`, `admin/beanstalk/page.tsx:32` | medium |
| B8 | `projectBeans` loads every bean slug per synced page to check existence; a `$in` over the envelope's candidates would do. | `lib/pollen-store.ts:102-106` | medium |
| B9 | Sequential awaits that could be parallel or a `bulkWrite`: index creation, `setVisibility` (three `updateMany`), `deleteFeedData` (four deletes). | `lib/botanical.ts:46-55, 405-413`; `lib/pollen-store.ts:29-36, 158-161` | low |
| B10 | Middleware runs on every public request to look for `?lang=`; a `has: [{type:"query", key:"lang"}]` matcher would skip the 34.5 kB edge function on the common path. | `middleware.ts:49` | low |

**Recommendation, in order.**

1. `unstable_cache(loadRawGarden, ["garden"], { tags: ["garden"] })` and one
   `revalidateTag("garden")` in a shared action guard, replacing the 29
   `revalidatePath` calls. This is the single highest-leverage change in the
   repo: TTFB stops depending on Mongo, `/api/graph` stops being a free DoS
   vector against the database, and the outage failure mode becomes stale
   rather than 500.
2. Targeted readers: `getPlant(slug)`, `getPod(slug)`, `getBean(slug)` next to
   the existing `getSprout` (`lib/botanical.ts:374-377`), and a
   `loadCascadeGarden()` projected to `{slug, parents, visibility, state}`.
3. Split `loadRawGarden` per collection with projections; keep `bees` out of
   the default load; add `{content: 0, media: 0}` variants for index pages.
4. Indexes and client options as in B5/B6.

### 2.2 Factorization

| # | Duplicate | Copies | Sev |
|---|---|---|---|
| F1 | The action boilerplate: session → slug → load garden → find → redirect-if-missing → back URL → write → revalidate → redirect | `actions.ts:392-459, 470-484, 507-536, 567-623` and more | high |
| F2 | `canonical(MediaImage)` for change detection, plus the whole `build*Patch` body around it (`__ready` check → parse → "yielded no image" warn → compare) | `lib/plant-logo.ts:18-22,38-78`, `lib/bean-cover-edit.ts:21-31,49-84`, `lib/screen-image.ts:44-54,83-108`, `lib/media-edit.ts:35-39` | medium |
| F3 | Ref-prefix parsing by hand (`"bean:"`, `ref.slice(ref.indexOf(":")+1)`) while `BEAN_PREFIX`/`parentsWithPrefix` exist | `actions.ts:253-255, 283-285, 356-360`; `lib/articles-store.ts:20-23`; `lib/entity-resolve.ts:44-50`; `lib/data.ts:601-608`; `lib/bean-detail.ts:19`; `app/admin/sprout/[slug]/page.tsx:20` | medium |
| F4 | Slug regex `/^[a-z0-9][a-z0-9-]*$/` | `lib/pollen.ts:31`, `lib/federation.ts:23`, `lib/articles.ts:28`, `lib/screen-create.ts:11` — and **absent** from promote (§2.3) | medium |
| F5 | `String(formData.get("slug") ?? "")` ×14; `const get = (k) => String(form.get(k) ?? "").trim()` ×7; `state` coercion ×2; `validateSproutPatch` vs `validateSproutInput` differ by one line | `actions.ts` passim; `lib/plant-meta.ts:44`, `plant-role.ts:72`, `screen-edit.ts:112`, `screen-create.ts:37`, `sprout-edit.ts:18-21,35-42`, `promote.ts:45,67-71,97-105` | low |
| F6 | `isDuplicateKey` / `isDuplicateKeyError` | `lib/botanical.ts:38-40`, `lib/seeds.ts:23-25` | low |
| F7 | API door shape: token check → JSON parse → E11000-to-409, with relative `../../../lib` imports | `app/api/articles/route.ts:13-49`, `app/api/synthesis/route.ts:20-56`, `app/api/synthesis/week/route.ts:11-14` | low |
| F8 | Filter/distinct helpers with identical rules | `lib/vault.ts:16-43` vs `lib/screens.ts:133-166` | low |

**Proposed split of `app/admin/actions.ts`** (all still `"use server"`):
`_actions/auth.ts` (login, logout), `_actions/seeds.ts` (create, discard,
promote), `_actions/sprout.ts` (meta, delete, content, media),
`_actions/plant.ts` (content, role, meta, logo, status, visibility),
`_actions/bean.ts` (cover, keyword), `_actions/screens.ts` (create, meta,
image, delete, exhibition ×2), `_actions/upload.ts`, `_actions/pollen.ts`, and
a `_actions/_guard.ts` exporting `withEntity(kind, formData, fallbackHref, fn)`
that does session + targeted read + not-found redirect + back URL, so each
action is the five lines that differ. Add `lib/form-data.ts` with `str`,
`slugOf`, `confirmed`, and `lib/media-input.ts` with `canonicalImage` and
`buildSingleImagePatch(field, current, form, { clearable })` to close F2.

### 2.3 Correctness and safety

| # | Finding | Evidence | Sev |
|---|---|---|---|
| S1 | No public page wraps its loader; no `error.tsx` anywhere in `app/`; no `loading.tsx`. Any DB failure is a bare 500 on the public site after the 30 s timeout in B5. Admin list pages *do* catch. | grep `try {` in `app/(public)` → none; `find app -name error.tsx` → none | high |
| S2 | Promote accepts `newPodSlug`, `newBeanSlug`, `sproutSlug` unvalidated; a `:` or `/` in one breaks the prefixed-ref grammar and produces unroutable links (two of them interpolated without `encodeURIComponent`). | `actions.ts:151-198, 256, 299`; `lib/promote.ts:13-19,74`; `triage/[id]/page.tsx:141,169,193` | medium |
| S3 | Promote is non-atomic: pod → bean → sprout → cascade → mark seed. A `SlugExistsError` on the sprout leaves the new pod and bean behind and the seed in the inbox; the retry then fails on the pod slug. | `actions.ts:171-209` | medium |
| S4 | `writeArticles` pre-checks bean visibility but the bean upsert carries no `visibility` qualifier in its filter, unlike the sprout and narrative writes beside it. A bean published in the gap is overwritten. | `lib/articles-store.ts:78-94, 149-156` vs `123-131, 166-181` | medium |
| S5 | Sessions cannot be revoked: cookie = `issuedAt.hmac`, logout only clears the cookie, a leaked cookie is good for 30 days. | `lib/session.ts:40-63`; `actions.ts:105-109` | low |
| S6 | No rate limit on login. | `actions.ts:94-103` | low |
| S7 | `createOrUpdateSeed` casts a nullable `res.value` to `Seed`; the inbox route then reads `.id`. | `lib/seeds.ts:83`; `app/api/inbox/route.ts:52` | low |
| S8 | `/api/graph` is unauthenticated, uncached, and does the full load on every hit. | `app/api/graph/route.ts:11-13` | low (fixed by B4) |
| S9 | CSP lacks `frame-ancestors`; admin included is framable. | `next.config.ts:37-52` | low |

### 2.4 Types

- `Sprout` carries `[key: string]: unknown` (`lib/data.ts:276`), which makes
  every property access type-check and exists only for two `Object.entries`
  dumps (`app/(public)/(chrome)/bean/[id]/page.tsx:41`,
  `app/admin/bean/[id]/page.tsx:165`). Drop it; cast at the dump.
- `validateArticlesPayload` / `validateDigestBatch` return `{ ok }` and the
  routes cast the body (`app/api/articles/route.ts:28`,
  `app/api/synthesis/route.ts:41`). Return the parsed value, as
  `validateInboxPayload` does (`lib/inbox.ts:116-160`).
- `plantMetaUpdate` / `screenMetaUpdate` return `Record<string, unknown>` and
  force `as UpdateFilter<…>` at the write (`lib/botanical.ts:329, 487, 503`,
  whose own comment at `:520-524` says why the cast is dangerous). Type them as
  `UpdateFilter<Plant>` / `UpdateFilter<Screen>`.
- `Seed.title: Text` but `Seed.body` / `content` are `LocalizedText`
  (`lib/data.ts:301-303`); `lib/palette.ts:132` has to special-case it.
- Three spellings of the sync status union (`lib/pollen-sync.ts:110,126`,
  `lib/pollen-store.ts:15`).

### 2.5 Dead code and legacy naming

- **`getDataset()` and the `node:fs` / `js-yaml` imports in `lib/data.ts:1-3,
  835-848` are dead** — zero non-test callers. They are the sole reason
  `lib/data.ts` is server-only, which CLAUDE.md names four times as the trap
  behind `lib/palette-items.ts`, `lib/exhibition.ts`'s type-only import rule
  and its test, and `screen-strip.tsx`'s resolve-in-page workaround. Deleting
  fourteen lines removes the trap at the root and retires a test.
- `Dataset.getPods()` (`lib/data.ts:328, 484`) has no callers.
- Twenty-odd exports used only in-file or by tests (`MAGNETS`,
  `headlessExtensions`, `POLLEN_VERSION`, `hmacHex`, `cloudinaryStorage`,
  `isAuthenticated`, …). Un-export; a linter would list them.
- `lib/retier.ts` and `lib/pbbls-legacy.ts` are imported only by migration
  scripts — move under `scripts/lib/`.
- Legacy names still in the write path: `updateVersion` / `deleteVersion`
  (`lib/botanical.ts:382, 392`), `editVersionAction` / `deleteVersionAction`
  (`actions.ts:218, 265`), the user-facing error *"version slug is required"*
  (`lib/promote.ts:100`), `ATOM_PREFIX = "bean:"`
  (`app/admin/sprout/[slug]/page.tsx:20`), `RawGardenBody` naming a seed
  payload (`lib/seed-form.ts:9, 25`), and the "Edit version" heading on the
  sprout page.

---

## 3. Front-end componentization (admin)

Thirty-two files match `"use client"` but **ten are comment-only** (the string
appears in a docblock saying the file has no directive). The 22 real islands
are listed in Appendix B; 2,733 of their 5,073 lines sit in six files.

### 3.1 Repeated JSX that should be one component

| # | Pattern | Copies | Proposed | Sev |
|---|---|---|---|---|
| C1 | `<div class="flex flex-col gap-2"><Label/><Input/></div>` — the registry ships `field` (`Field`, `FieldLabel`, `FieldError`) and `components/ui/` does not have it, which is the one thing CLAUDE.md says never to do | 54 hits of the wrapper; 8 forms | `npx shadcn add field`; `TextField` in `_components/fields.tsx` | high |
| C2 | The en/fr paired inputs with the strict-`textPart` comment repeated | 6 forms (`sprout:171-214`, `triage:175-250`, `plant-meta-form:39-65`, `plant-role-form:43-79`, `screen-meta-form:68-89`, `bean-keyword-form:24-42`) | `BilingualField({ name, label, value })` | high |
| C3 | The sprout page inlines its media, meta and delete forms; every other entity keeps them in `_components/*-form.tsx` | `app/admin/sprout/[slug]/page.tsx:101-275` | `sprout-media-form`, `sprout-meta-form`, `sprout-delete-form` | high |
| C4 | State radio group, hand-enumerated, once with `fieldset/legend` and once with a bare `span` (no group semantics) | `sprout:216-244`, `triage:252-265` | `StateRadios` over an exported `SPROUT_STATES` (today `lib/vault.ts:3`) | medium |
| C5 | Danger-zone delete form in two shapes | `sprout:252-275`, `screens/[slug]:140-147` + `screen-delete-form.tsx` | `ConfirmDeleteForm` | medium |
| C6 | Key/value dump list with three label widths | `bean/[id]:19-26` (w-24), `triage:72-98` (w-20), `sprout:60-69` (w-16) | `PropertyList` | medium |
| C7 | "Couldn't load" alert + `let x=null; try{}catch{}` | 6 pages | `LoadFailure`, `lib/attempt.ts` | medium |
| C8 | `?error=` banner with a redundant `role="alert"` (`alert.tsx:30` already sets it) | 13 pages, 16 occurrences | `ActionError` reading `searchParams` | medium |
| C9 | Back link class | 8 pages | `BackLink` | medium |
| C10 | `<h1>` class ×12, `<h2>` class ×9, `CardTitle` overridden with a class it already has ×7 | see agent table | `PageTitle`, `SectionTitle`; add `tracking-tight` to the primitive | medium |
| C11 | Eyebrow label at three letter-spacings (`0.15em`, `widest`=0.1em, `wider`) | `plant-hero:304`, `plant-inside:129,178`, `admin-filters:162`, `triage:20`, `command-palette:334` | `Eyebrow` | medium |
| C12 | Ghost buttons hand-rolled where `buttonVariants` exists (and is server-safe) | `exhibition-panel:154-163`, `screens/page:111-123`, `plant-hero:174-181` | use `buttonVariants` | low |
| C13 | Visibility icon + tone decided in two files | `plant-hero:360-375`, `glyphs.tsx:223-231` | `enum-icons.ts` | low |
| C14 | Submit-button row in two alignments | 8 forms | `FormActions` | low |

### 3.2 Client/server boundary

- **`AdminChrome` / `AdminMain` are client only to read the pathname**
  (`admin-chrome.tsx:37-43, 118-128`), which ships `lib/admin-nav.ts` to the
  browser. The public zone solves the same problem with a route group
  (`app/(public)/(chrome)/layout.tsx`). Do the same: `app/admin/(chrome)/`
  with `(wide)/` and `(reading)/` sub-groups, login outside; `resolveColumn`
  disappears.
- **Stock `"use client"` on `table.tsx`, `label.tsx`, `separator.tsx`** — none
  uses a hook. `Table` is imported by the public `markdown.tsx`. Remove the
  directives and add the three files to `server-safe-source.test.ts`. This is
  the 8.5 kB in §0.
- **`plant-hero.tsx` (497 lines)** has ~80 lines of pure static content
  (`roleLine`, `SheetHeading`, the option tables) inside the island; and
  `roleLine` is a second copy of `lib/plant-role.ts`'s export already used by
  `garden/page.tsx`.
- `entities: EntityOption[]` is serialized to every content page's editor
  with full descriptions used only as a suggestion hint
  (`content-card.tsx:44`, `suggestion-menu.tsx:55`). Fine today; trim when
  the garden grows.

### 3.3 Hooks and state

- **Mount gate three ways.** `useState`+`useEffect` in `media-picker`,
  `command-palette`, `toc-rail`; `useSyncExternalStore` is used nowhere. One
  `useMounted()` built on `useSyncExternalStore(() => () => {}, () => true,
  () => false)` keeps the server-snapshot-false guarantee with one render.
- **"Close on save, reopen on error" twice**, each a `setState` inside a
  `useEffect` plus the same `history.replaceState` URL scrub
  (`plant-hero.tsx:95-132`, `seed-overlay.tsx:49-115`). One
  `useServerSignal` hook, or the adjust-during-render idiom.
- **Overlay shell duplicated** by the palette (`command-palette.tsx:238-258`
  vs `overlay-sheet.tsx:55-69`). Give `OverlaySheet` an `anchor` prop.
- **Hotkeys are uniform**: six `useHotkey` sites, zero hand-rolled global
  listeners. Good; keep.

### 3.4 Styling

- Three focus-ring recipes (`outline-2/offset-2/outline-ring`,
  `ring-2 ring-ring/50`, the primitives' `ring-3`) — one `FOCUS_RING` const.
- Five "menu row" hover recipes — `menuRowClass()` beside `chromeItemClass()`.
- Coupled magic numbers with nothing enforcing the coupling: `28rem`
  (`admin/layout.tsx:77`, `side-sheet.tsx:34`), `sideOffset={16}` twice with
  the same paragraph, popover widths chosen per call.
- `globals.css` carries 26 unused tokens (`--chart-*`, `--sidebar-*`) and
  their `@theme` mappings; `html{@apply font-sans}` / `body{@apply
  bg-background text-foreground}` duplicate the classes on `layout.tsx:27,46`.

### 3.5 Split proposals for the six hotspots

- **`media-picker.tsx` (550)** → `useMediaRows` hook (state + upload, lines
  134-259), `ReadyMarker` (the hidden input, duplicated at `:270` and `:372`),
  `CompactPicker` (261-359), `MediaRow` (424-531) with `MoveButtons` /
  `RowBody` / `RemoveButton`, `FileField` + `LinkAdder` (376-419).
  `MediaPicker` becomes ~60 lines.
- **`plant-hero.tsx` (497)** → `enum-icons.ts` (server-safe option tables,
  shared with `glyphs.tsx`), `EnumPopover` + `EnumForm` (377-497),
  `RolePopover` (193-236), `LogoPopover` (145-166), `plant-hero-sheets.tsx`
  (267-316), `useServerSignal`. `PlantHero` keeps ~120 lines.
- **`command-palette.tsx` (352)** → `PaletteRow` (57-109, 311-338),
  `usePaletteIndex(open)` (111, 136-184), shell via `OverlaySheet
  anchor="top"`. ~90 lines remain.
- **`prose-editor.tsx` (334)** → `components/prose-class.ts` (`PROSE_CLASS`,
  shared with `markdown.tsx:88`), `useEditorSave`, `useImageInsert`,
  `FormatBubbleMenu` (248-266), `SaveBar` (298-311). ~100 lines remain.
- **`triage/[id]/page.tsx` (282)** → `SeedSummaryCard` (64-101),
  `PromoteForm` (103-271) itself over `ParentPicker` (three copies of one
  select block at `:109-165`; `EntitySelect` already exists for screens),
  `DiscardForm` (273-278). ~60 lines remain.
- **`sprout/[slug]/page.tsx` (279)** → the three forms in C3 plus
  `ProsePreviewCard` (78-91, 144-160). ~70 lines remain.

---

## 4. Asset rendering (public zone)

### 4.1 Images

| Site | Source | Dimensions | Lazy | Transform | Issue |
|---|---|---|---|---|---|
| `app/(public)/page.tsx:140` plant logo | Cloudinary 96×96 | CSS box | lazy, above the fold | yes | should be eager on the first row |
| `components/plant-header.tsx:63` mark | Cloudinary 224 | CSS box | eager | yes | no `fetchPriority="high"` on the LCP candidate |
| `components/bean-cover.tsx:77` | Cloudinary 448×336 | `aspect-[4/3]` | lazy | yes | first row should be eager |
| `components/phone-frame.tsx:96` | Cloudinary | **none** — strip reflows as each lands | lazy | yes | stored `width`/`height` on `MediaImage` unused |
| `components/media.tsx:156` sprout media / gallery | **raw upload URL** | stored | lazy | **none** | a 3–4 Mpx original into a ≤352 px slide |
| `components/markdown.tsx` `![]()` | whatever was authored | none | **no** | none | react-markdown default `<img>` |
| `public/icon-*.png` favicons | static | 520×520 | — | — | 191 kB and 195 kB each; `apple-touch-icon` points at the 195 kB file |

No `srcset` / `sizes` anywhere; every derivative is fixed 2×
(`lib/image-url.ts:71-72`). `next/image` is unused and `next.config.ts` has no
`images` block, consistent with the Cloudinary-does-resizing decision; the gap
is `srcset` and priority, not the optimizer.

### 4.2 Brand SVGs

`components/brand/ariko-logo.tsx` renders to **102,774 bytes** of HTML on `/`
(44.7 kB gzip); `ariko-icon.tsx` renders to **90,787 bytes** on every chrome
page, for a 20 px glyph (`public-chrome.tsx:38`). That is thirty times the TOC
rail and a third of the framework JS, in HTML that cannot be cached separately
from the page. Paths carry three-decimal coordinates in a 1035×549 box; one
`d` attribute is 39 kB (`ariko-logo.tsx:158`); both files carry the same 21
`id`s. `svgo --precision 1` and id removal typically save 50–70 %; a
simplified silhouette for the icon size is the other half.

### 4.3 Fonts

The built `<head>` preloads three font files on every route: two **TTF**
(112 kB upright, 114 kB italic) and one woff2 (23 kB). `next/font/local`
neither converts nor subsets, and preloads every `src` entry. Converting
Inclusive Sans to subsetted woff2 is roughly −180 kB per first visit; whether
italic needs preloading at all is a separate question. Profane, declared by
hand for licence reasons (`globals.css:17-30`), has no fallback metrics, so
every heading jumps on swap (acknowledged at `app/fonts.ts:39-42`); a
`size-adjust`/`ascent-override` fallback face fixes that. There is no
`preconnect` to `res.cloudinary.com`, which serves every image and Profane.

### 4.4 Rendering strategy

- Every public page is `force-dynamic` and calls `cookies()`; no
  `generateMetadata` on any route (every page is `<title>Ariko</title>`); no
  `Suspense`, no `loading.tsx`, no `app/not-found.tsx` (the three `notFound()`
  calls land on Next's unstyled default with no chrome).
- **`<html lang="en">` is hardcoded** (`app/layout.tsx:26`) while pages render
  French when the cookie says so. The root layout can read the cookie.
- **French is invisible to crawlers**: language lives in a cookie, so there
  is no `hreflang` and cannot be. Moving language to the URL (`/fr/…`) is what
  would unlock both `hreflang` and static/ISR rendering with tag
  revalidation.
- Dark mode is declared (`@custom-variant dark`, a `.dark {}` block, 21
  `dark:` utilities, `dark:prose-invert`) but nothing ever adds `.dark`;
  meanwhile the favicon *does* follow `prefers-color-scheme`. Either map the
  media query to the tokens or delete the block.
- `prefers-reduced-motion` is honoured on the cover only; chrome plate
  transitions, label fades and the TOC rail's `transition-all` are unguarded.

### 4.5 Accessibility

- Home page has no `<h1>` (the wordmark is `role="img"` in a `<header>`;
  plants are `h2`).
- `aria-current` is never set on the public nav though `ChromeLink` supports
  it (`chrome.tsx:181-186`).
- `screen-strip.tsx:89` and `media.tsx:158` fall back to `alt=""` when no alt
  is stored, silently making content images decorative.
- `lib/markdown.ts:173` admits authored `h1`, so prose can carry a second
  `h1`; a rehype step demoting it keeps the outline.
- Iframes are good: `title`, `loading="lazy"`, `referrerPolicy`, explicit
  `allow`, reserved box. CSP is generated from the same allowlist and
  test-pinned.

---

## 5. Factorization index (cross-cutting)

The same idea implemented more than once, across zones:

| Idea | Copies | Where it should live |
|---|---|---|
| Prose class | 2 (`markdown.tsx:88`, `prose-editor.tsx:142-143`) | `components/prose-class.ts` |
| Cover frame `aspect-[4/3] … bg-muted` | 2 verbatim + geometry derived from it (`page.tsx:96`, `entity-card.tsx:111`, `bean-cover.tsx:40-63`) | `COVER_FRAME` |
| Eyebrow label | 5 public + 6 admin, three letter-spacings | `Eyebrow` |
| "Inside" nav | `plant/[slug]:87-112` ≡ `pod/[slug]:35-53` | `InsideNav` |
| Page title + muted description | 3 public + 12 admin | `PageTitle` |
| Mount gate | 3 | `useMounted` |
| Visibility icon+tone | 2 | `enum-icons.ts` |
| `canonical(MediaImage)` + single-image patch | 4 | `lib/media-input.ts` |
| Ref parsing | 7 | `parseRef` in `lib/data.ts` |
| Slug grammar | 4 (+1 missing) | `SLUG` in `lib/data.ts` |
| FormData readers | 7 + 14 | `lib/form-data.ts` |
| Action guard | ~12 | `_actions/_guard.ts` |
| Measures: `28rem`, `sideOffset 16`, `GUTTER` vs `READING_COLUMN` | 2 each | `page-column.tsx`, `rail.ts` |

---

## 6. Prioritised plan

Sequenced so each slice is small, testable, and leaves the repo better if the
next never happens.

1. **Cache the garden.** `unstable_cache` + `revalidateTag("garden")`; delete
   the 29 `revalidatePath`s; set `serverSelectionTimeoutMS`; add
   `app/(public)/error.tsx` and `app/not-found.tsx`. (§2.1 B1–B5, S1)
2. **Fix the expensive island nobody noticed.** Drop `"use client"` from
   `table.tsx`, `label.tsx`, `separator.tsx`; extend
   `server-safe-source.test.ts` to them; `<hr>` on the beanstalk. −8.5 kB per
   prose page. (§3.2)
3. **Assets.** svgo the brand marks; subset Inclusive Sans to woff2; Profane
   fallback metrics; `preconnect`; transform gallery and markdown images;
   eager + `fetchPriority` on the first row; SVG favicon. (§4)
4. **Delete the trap.** Remove `getDataset` and the `node:fs` import from
   `lib/data.ts`; retire `exhibition-source.test.ts` and the palette split's
   justification. (§2.5)
5. **Rewrite the guidelines.** Adopt Appendix A; fix `README.md` §Constraints;
   refresh or replace the ROADMAP; add `.env.example`; add ESLint with
   `react-hooks` and `@next/next`. (§1)
6. **Form kit.** `field` from the registry; `TextField`, `BilingualField`,
   `StateRadios`, `ConfirmDeleteForm`, `ActionError`, `LoadFailure`; move the
   sprout page's forms to `_components/`. (§3.1)
7. **Action split** and the `lib/` helpers (`form-data`, `media-input`,
   `parseRef`, `SLUG`); validate promote's slugs; make promote pre-check or
   compensate. (§2.2, §2.3)
8. **Hotspot splits** in the order `plant-hero` → `media-picker` →
   `prose-editor` → `command-palette` → triage → sprout, each with its
   `useMounted` / `useServerSignal` adoption. (§3.5)
9. **Route-group the admin chrome**; `SHEET_WIDTH`, `FOCUS_RING`,
   `menuRowClass`, `Eyebrow`; prune `globals.css`. (§3.2, §3.4)
10. **Language in the URL**, then `generateMetadata`, `hreflang`,
    `lang` from the route, and ISR for the public zone. (§4.4)

---

## Appendix A — Draft replacement for the client-JS section of `CLAUDE.md`

> ### Script, by zone
>
> **The public zone is progressively enhanced.** Every page reads, every link
> navigates and every media item is reachable with script off. Islands add —
> a reading position, a lightbox, a filter that narrows without a reload — and
> never replace. A component the public zone renders must not carry
> `"use client"` unless it renders nothing until it mounts, and must not be
> the only route to anything. `lib/server-safe-source.test.ts` pins the list;
> add to it the day you add a public component. Prefer the inline glyphs in
> `components/public-icons.tsx` in the chrome so the navigation never crosses
> a client boundary, and prefer server components everywhere else because
> they are less code, not because script is forbidden.
>
> **The admin zone is a JavaScript application.** Server actions are the write
> path and server-rendered `<form action>` is the default form, because both
> are less code and are testable without a browser. Client state, hotkeys,
> popovers, sheets, editors and pickers are ordinary tools here and need no
> justification paragraph. Use the registry's primitives, including the
> client ones.
>
> **A write never mis-saves from a partial form.** When a form's controls live
> inside an island, the island also owns the submit, and the action refuses a
> payload that lacks the island's intent marker (`lib/form-intent.ts`). This
> is what makes an un-mounted island *inert* rather than *destructive* — the
> media picker's `__ready` rule, stated once. A form with its own fields plus
> an island's submit is admissible only where it *creates*.

Three paragraphs replace roughly three hundred lines. The six slice histories
they replace belong in the specs that already carry them.

## Appendix B — Client-directive inventory (real first-line directives)

| File | Lines | Why client |
|---|---|---|
| `components/admin/media-picker.tsx` | 550 | upload state, mount gate, lucide |
| `app/admin/_components/plant-hero.tsx` | 497 | popover/sheet state, save signal, lucide, Tooltip |
| `app/admin/_components/command-palette.tsx` | 352 | hotkey, fetch, router, Dialog/Autocomplete, mount gate |
| `components/editor/prose-editor.tsx` | 334 | Tiptap |
| `components/admin/glyphs.tsx` | 242 | lucide + Tooltip + Avatar, no state |
| `app/admin/_components/seed-overlay.tsx` | 228 | hotkey, dialog state |
| `app/admin/_components/plant-inside.tsx` | 188 | two popover states |
| `app/admin/_components/admin-filters.tsx` | 184 | hotkeys, popover state |
| `components/ui/dialog.tsx` | 170 | Base UI |
| `components/ui/autocomplete.tsx` | 156 | Base UI |
| `components/toc-rail.tsx` | 148 | DOM scan, scroll — the public island |
| `app/admin/_components/admin-chrome.tsx` | 129 | `usePathname` only |
| `components/ui/table.tsx` | 116 | **none** — stock directive, imported by public `markdown.tsx` |
| `components/ui/avatar.tsx` | 108 | Base UI |
| `components/editor/entity-views.tsx` | 105 | Tiptap node views |
| `components/ui/popover.tsx` | 94 | Base UI |
| `app/admin/_components/overlay-sheet.tsx` | 90 | Dialog shell |
| `components/ui/tooltip.tsx` | 65 | Base UI |
| `components/editor/suggestion-menu.tsx` | 61 | caret positioning |
| `app/admin/_components/sheet-keys.tsx` | 58 | hotkeys, router; renders null |
| `components/ui/separator.tsx` | 25 | **none** — stock directive |
| `components/ui/label.tsx` | 20 | **none** — stock directive |

Script-off enforcement footprint today: `editor-mount` 291, `media-picker-mount`
210, `screen-sheet-source` 196, `exhibition-panel-source` 110,
`plant-hero-mount` 106, `server-safe-source` 77, `toc-mount` 64,
`exhibition-source` 57, `palette-mount` 51, `public-icons` 119 + test 108,
`native-controls` 49 — **1,438 lines**. Under Appendix A, `server-safe-source`,
`screen-sheet-source` and the data-loss half of `media-picker-mount` survive;
`editor-mount` stays for its own reason (it is the only test that constructs a
real editor); the rest retire with the paragraphs they pin.
