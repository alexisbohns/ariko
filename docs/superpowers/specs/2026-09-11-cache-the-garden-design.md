# Cache the garden — one Mongo read for everybody, and an outage that goes stale instead of 500

*2026-09-11*

## 0. Where this starts

The audit at [`docs/audits/2026-09-10-code-quality-audit.md`](../../audits/2026-09-10-code-quality-audit.md)
§6 sequences ten slices and puts this one first, calling it *"the single
highest-leverage change in the repo"*. It shipped second, behind the rulebook
rewrite ([`2026-09-10-guidelines-rewrite-design.md`](2026-09-10-guidelines-rewrite-design.md)),
for the reason that spec argues.

The audit's own summary of the work is one sentence:

> `unstable_cache(loadRawGarden, ["garden"], { tags: ["garden"] })` and one
> `revalidateTag("garden")` in a shared action guard, replacing the 29
> `revalidatePath` calls.

**That sentence, implemented literally, breaks publishing and leaves a third of
the write paths serving a permanently stale site.** §2 is why. The rest of this
document is the shape that does not.

What a visitor gets: a page that no longer waits on Mongo, and a portfolio that
survives an Atlas outage by going stale rather than returning 500. What the
author gets: nothing visibly different — which is a deliberate property, not an
omission (§3).

## 1. What is true today

`lib/store.ts:15-26` `loadRawGarden()` runs six `find({})` in parallel and
returns the whole garden. Every public page, every admin page, every action and
`/api/graph` calls it — or `getPublicDataset()`, which is
`buildDataset(filterPublic(await loadRawGarden()))` — directly. There is no
`React.cache`, no `unstable_cache`, no tag. Every page is `force-dynamic`, so
the 29 `revalidatePath` calls in `app/admin/actions.ts` invalidate nothing;
three comments in that file already say so.

**Measured against the live database, 2026-09-11**, so the size argument rests
on a number rather than a guess:

| | docs | JSON bytes |
|---|---|---|
| plants | 12 | 16.5 kB |
| pods | 14 | 101.1 kB |
| beans | 73 | 16.8 kB |
| sprouts | 55 | 215.3 kB |
| bees | 7 | 2.7 kB |
| screens | 170 | 59.0 kB |
| **full garden** | | **411.4 kB** |
| **after `filterPublic`** | | **102.2 kB** |

The largest single sprout is 31.8 kB. Vercel's Data Cache entry limit is 2 MB,
so the whole raw garden fits as one entry with roughly 5× headroom. That is what
makes "cache the garden" — rather than "cache six collections separately, with
projections" — the right first move. The per-collection split (audit B1/B3) is a
later slice and is not needed to make this one correct.

## 2. The two things the audit's sentence gets wrong

### 2.1 Actions read back *after* writing, on purpose

`editVersionAction` (`app/admin/actions.ts:245-250`) writes, then re-reads, then
computes a cascade, and says so in a comment already in the file:

> Both branches load the dataset AFTER `updateVersion`, so the cascade evaluates
> the just-saved state.

`promoteSeedAction:201` is the same shape: `createSprout(input)` then
`publishCascade(await loadRawGarden(), input.slug)`.

If `loadRawGarden` *itself* becomes the cached function, both cascades compute
against the pre-write garden. The observable result is not a crash — it is
`setPublic` being handed the wrong set of parent slugs. An author publishes a
sprout and its bean stays private; or, worse, an unpublish leaves a parent
public that should have been re-privatised. **That is a privacy regression
produced by a caching change, and it passes `tsc`, `npm test` and
`npm run build`.**

So: the cached reader is a *separately named function in a different module*,
and the write path never imports it. §4.3 pins that with a test, because the
comment quoted above is exactly the kind of thing a later edit moves without
reading.

### 2.2 Three write paths never touch `app/admin/actions.ts`

The audit's "one `revalidateTag` in a shared action guard" assumes every write
is an action. Three are not:

| Door | Module | Writes |
|---|---|---|
| `/api/articles` | `lib/articles-store.ts:81,98,149,166` | beans, sprouts |
| `/api/synthesis` | `lib/synthesis-store.ts:66,80` | sprouts |
| `/api/pollen/sync` | `lib/pollen-store.ts:110,161` (via `runSync`) | beans |

An action-guard-only invalidation leaves all three writing to Mongo while the
public site serves the pre-write garden. With a tag and no TTL that is stale
**until the next deployment**. This is the failure the TTL backstop in §3.1
exists to bound and the source test in §4.3 exists to prevent.

There is also a fourth door that writes the garden and *is* an action:
`syncNowAction` calls the same `runSync`.

## 3. The design

### 3.1 Two named readers, in two modules

`lib/store.ts` does not change and stays free of any `next/*` import.
`loadRawGarden()` and `getFullDataset()` remain the live path.

A new `lib/garden-cache.ts` holds everything that knows about Next's cache:

```ts
export const GARDEN_TAG = "garden";
export const GARDEN_TTL = 300; // seconds — backstop, not the mechanism

export const loadCachedGarden = unstable_cache(loadRawGarden, ["garden"], {
  tags: [GARDEN_TAG],
  revalidate: GARDEN_TTL,
});

export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadCachedGarden()));
}

export function revalidateGarden(): void {
  revalidateTag(GARDEN_TAG);
}
```

**`getPublicDataset` moves out of `lib/store.ts`.** Not for tidiness: calling an
`unstable_cache`-wrapped function outside a Next request context throws, and
`lib/store.test.ts:48` calls `getPublicDataset()` under plain `node --test`.
Leaving it in `store.ts` would either break `npm run test:db` or force `store.ts`
to import `next/cache`, which would put the throw one import away from every DB
test in the repo. Its test moves to asserting
`filterPublic(await loadRawGarden())` directly — the same claim about the same
pure function, with no Next runtime in the way.

**The TTL is a backstop, not the mechanism.** `revalidateGarden()` is what makes
a publish appear immediately. `GARDEN_TTL` exists so that a write path someone
adds and forgets to wire (§2.2's failure, in the future) degrades to "stale for
five minutes" rather than "stale until the next deploy". Five minutes is chosen
to be short enough to be embarrassing and long enough that the cache is still
doing its job on a low-traffic site.

**Callers that switch to the cached reader**, and the complete list of them:

- `app/(public)/page.tsx`, `plant/[slug]`, `pod/[slug]`, `bean/[id]` — via
  `getPublicDataset`, so the change is the import path only.
- `app/(public)/(chrome)/beanstalk/page.tsx:22` — calls `loadRawGarden()`
  directly; becomes `loadCachedGarden()`.
- `app/api/graph/route.ts:12` — same.

**Nothing under `app/admin` changes reader.** That is the answer to "who reads
the cache", and it is the reason this slice cannot corrupt a write or show the
author a stale editor. The admin is one user behind a password; its TTFB is not
the problem being solved, and making it a correctness surface for cache
invalidation would buy a saving nobody asked for at the price of "I saved the
plant name and the page still shows the old one" — which in an editor reads as
data loss.

### 3.2 The four doors

`revalidateGarden()` is called at exactly four places, all of them request
boundaries where `revalidateTag` is legal:

1. `app/admin/actions.ts` — in place of the `revalidatePath` calls, which
   already sit at the right moments.
2. `app/api/articles/route.ts`
3. `app/api/synthesis/route.ts`
4. `app/api/pollen/sync/route.ts`

> **Correction, written during implementation.** This section originally added
> "and where `node --test` never runs", and used that to argue the doors needed
> no tolerance for a missing request context — unlike the writer layer, which
> the rejected alternative would have had to guard. **The claim was false.**
> `lib/articles-route.test.ts` imports `POST` from `app/api/articles/route.ts`
> and calls it against a real database, and `lib/synthesis-route.test.ts` and
> `lib/pollen-sync-route.test.ts` do the same for the other two doors. Those are
> good tests — a write door exercised end to end — and they are not Next
> requests, so `revalidateTag` finds no store and throws. `npm run test:db` went
> red the moment the first door was wired.
>
> So `revalidateGarden` carries a catch, narrow enough to keep the property the
> door exists for: it tolerates exactly "no request store" and rethrows
> everything else. Both failure modes stay loud — in production a route handler
> always HAS a store, so the catch never runs and an invalidation is never
> quietly skipped; and if Next changes that message, the rethrow takes
> `test:db` red rather than letting the public site go silently stale.
> `lib/garden-cache.test.ts` pins both halves, with the predicate exported so
> the rethrow is testable at all.
>
> This does not reopen the writer-layer option §2.2 rejected. That would have
> been roughly twenty-five blind catches across four modules; this is one
> asserted case at one function.

**The 29 `revalidatePath` calls are deleted, not mechanically renamed.** Each
action gets **one** `revalidateGarden()` where it previously had one or two
`revalidatePath`s (`editPlantMetaAction:453,457` and its siblings pass two paths
for one write; one tag replaces both), and the actions that touch no garden
collection get **none**. That last case is two of them: `createSeedAction:120`
and `discardSeedAction:128` write only `seeds`, which nothing reads through a
cache. Keeping a
`revalidateGarden()` there would reintroduce, on day one, the exact thing this
slice is deleting: an invalidation call that invalidates nothing, standing where
a reader will later assume it means something.

`/api/inbox` (seeds), `/api/synthesis/week` (read), `/api/upload` (Cloudinary)
and `/api/graph` (read) write nothing to the garden and get nothing.

**A fifth kind of write exists and deliberately gets no door: `scripts/`.**
`scripts/migrate-garden.ts`, `scripts/migrate-retier.ts`,
`scripts/import-casa-media.ts`, `scripts/import-paulopus-screens.ts`,
`scripts/backfill-plant-roles.ts` and `scripts/pollen-rebuild.ts` write garden
collections directly, under `node --import tsx` with no Next runtime anywhere —
so `revalidateTag` has nothing to talk to and a door there could not work even
if one were added.

This is what `GARDEN_TTL` is for, and it is the clearest case of it: after a
migration the public site serves the pre-script garden for **up to five
minutes**, then corrects itself with no intervention. On a hand-run one-shot,
on a single-author site, that is the right trade against making every script
carry Next's runtime. If five minutes is too long after a particular migration,
the two ways to force it are a redeploy or any single write through a real
door — saving a plant's name and saving it back, say.

### 3.3 `lib/db.ts`

`serverSelectionTimeoutMS: 5000` and `connectTimeoutMS: 5000` on the
`MongoClient` (audit B5 — both currently default to 30 s).

Worth stating what this now *means*, because the cache changes it: with a warm
cache an Atlas outage is invisible to the public site, which renders stale from
the Data Cache and never reaches Mongo at all. The 5 s applies only to a cold
cache, where it turns a 30 s hang into a fast error page. The two halves of this
slice compose: the cache removes the common failure, the timeout bounds the rare
one.

> **Correction, written during implementation.** What shipped is
> `serverSelectionTimeoutMS: 5_000`, `connectTimeoutMS: 10_000` and
> `socketTimeoutMS: 10_000` — not the symmetric 5 s pair above.
>
> Two reasons, both found in review. First, this section's claim to bound the
> outage was incomplete: `serverSelectionTimeoutMS` bounds *choosing* a server,
> but `getDb()` caches its connection on `globalThis` for the life of the
> container, so an operation on an already-selected server that blackholes
> mid-query was bounded by `socketTimeoutMS` — which defaults to infinite.
> Setting only the two named here would have left the commit's own headline
> ("fails in 5 s instead of 30") untrue for the case most likely to happen to a
> warm serverless container.
>
> Second, 5 s is at the tight end for *connecting* from a cold Vercel container
> to Atlas — SRV lookup, TLS, SCRAM — and on a shared tier that can auto-pause,
> a resume would blow through it and turn a recoverable delay into a hard 500.
> Selection stays aggressive at 5 s; connect and socket get 10 s.
>
> One caveat this section should not leave implied: `mongodb+srv://` DNS
> resolution happens *before* server selection begins and is not fully bounded
> by any of the three, so "never more than 5 s" is not airtight.

### 3.4 The three pages

- **`app/not-found.tsx`** — server component. Unmatched URLs. Next renders this
  one inside `app/layout.tsx` only, with no zone chrome; that is a documented
  constraint of the root boundary, not a choice.
- **`app/(public)/(chrome)/not-found.tsx`** — server component. The three public
  `notFound()` calls (`plant/[slug]:21`, `pod/[slug]:16`, `bean/[id]:68`)
  resolve to the nearest boundary, which is this one, and it renders inside
  `(chrome)/layout.tsx`. So a mistyped slug keeps the mark, the nav and the
  language switch, and the visitor can leave without the back button.
- **`app/(public)/error.tsx`** — **must** carry `"use client"`; Next requires it
  of every error boundary, and Next puts the component in the client bundle of
  every route the boundary covers.

That last one deserves its paragraph, because it adds a client boundary to the
public zone in the slice immediately after
[`2026-09-10-guidelines-rewrite-design.md`](2026-09-10-guidelines-rewrite-design.md)
removed one. It is written to pull in nothing: no `lucide-react`, no `cn` (and
so no `clsx`, no `tailwind-merge`), no registry primitive — literal Tailwind
class strings and a plain `<button onClick={reset}>`. It does **not** go in
`lib/server-safe-source.test.ts`'s `SERVER_SAFE` list, which would be false: it
is a client component by requirement. The `npm run build` first-load-JS delta is
recorded in §5 and is part of the acceptance criteria: if the boundary costs
more than about a kilobyte, that is a finding to surface rather than absorb.

> **Correction, written during implementation.** Four pages shipped, not three:
> there is a **second** error boundary at `app/(public)/(chrome)/error.tsx`.
>
> The reason is the argument this section already makes for the 404, applied to
> the case it forgot. `(chrome)/layout.tsx` is a *child* of the `(public)`
> segment, so a boundary at `app/(public)/error.tsx` replaces the chrome layout
> along with the page: a Mongo failure on `/plant/x` would have taken the mark,
> the nav and the language switch with it — on exactly the three pages that read
> Mongo, and in a slice that argues a visitor should be able to leave without
> the back button. A boundary *inside* the group keeps the furniture standing.
>
> The outer one stays and is not redundant: a segment's `error.tsx` cannot catch
> a throw from that same segment's own layout, so only the outer boundary can
> catch a failure inside `(chrome)/layout.tsx` itself — and it is also the one
> covering `app/(public)/page.tsx`, the landing, which sits outside the group.
>
> Two further deviations from the paragraph above. The headings use
> `font-heading`, not the `font-mono` the plan specified: this design system
> defines `--font-sans`, `--font-heading` and `--font-display` and **no
> `--font-mono`**, so `font-mono` would have fallen through to the visitor's OS
> mono font on the only three pages in the repo using it. And the outer boundary
> imports `READING_COLUMN` rather than hand-copying its class string, per
> `CLAUDE.md`'s "grep for the name rather than copying the classes" — so the
> claim is now "imports the measure and nothing else", which `lib/error-pages.test.tsx`
> pins as an import **allowlist** rather than the blocklist first written.

### 3.5 A size guard on the cached entry

§1's 411 kB sits under Vercel's 2 MB Data Cache entry limit with room, but the
limit is a **cliff, not a slope**: above it `unstable_cache` silently declines to
cache and every public request goes back to Mongo, with nothing in the app
saying so. The failure is a performance regression that looks exactly like
success.

So `loadCachedGarden` wraps `loadRawGarden` with a byte count and
`console.warn`s above 1.5 MB, naming the limit and this section. One
`JSON.stringify` on a cache *miss* only — never on a hit, which is the path that
matters.

## 4. What the tests pin

### 4.1 Unchanged tests that must stay green

`npm test` and `npm run test:db` both pass unmodified, with the single exception
of `lib/store.test.ts`'s `getPublicDataset` case (§3.1), which changes what it
imports and not what it asserts.

### 4.2 The pages

Render tests for the two `not-found.tsx` files and for **both** error
boundaries (§3.4's correction) — asserting the reset control exists and is a
`<button>`, since an error page whose only affordance is broken is worse than
Next's default.

`lib/error-pages.test.tsx` ended up pinning three things this section did not
ask for, each closing a way the pages could become quietly wrong:

- **An import allowlist, not a blocklist.** "Imports nothing that costs bytes"
  was first written as a scan for three specific strings, which `next/link` or
  anything future walks straight past. The test now parses every `import` and
  asserts the module list exactly — `["@/components/page-column"]` for the
  outer boundary, `[]` for the inner one.
- **The chrome pages render no `<main>` and no `max-w-3xl`.** Their layout owns
  both. The plausible regression is someone "fixing" one by wrapping it in
  `<main className={READING_COLUMN}>`, which nests landmarks and double-pads the
  column while passing `tsc`, `npm test` and `npm run build`.
- **The French branch actually renders French.** `COPY` and a synchronous
  `NotFoundCopy` are exported so both can be tested against an explicit `lang`
  without going through `currentLang()`, which reads real request cookies and
  throws outside a request.

### 4.3 `lib/garden-cache-source.test.ts`

Same species as `lib/server-safe-source.test.ts`, and for the same stated
reason: **every violation below passes `tsc`, `npm test` and `npm run build`**
while quietly making the public site stale, or the cascade wrong.

1. **Every file under `app/` that imports a garden writer also calls
   `revalidateGarden(`.** Writers are a named list per module — `lib/botanical.ts`'s
   write exports, `writeArticles`, `upsertDigestDrafts`, `runSync` — because
   `lib/botanical.ts` also exports readers (`getSprout`, `getScreen`,
   `listPlants`) that pages legitimately import. This is the assertion that
   catches the *next* write door, which is §2.2's failure repeating.
2. **`app/admin/actions.ts` imports `loadRawGarden` and never
   `loadCachedGarden`.** This is §2.1's cascade guard, and it is the most
   important line in the file.
3. **No file under `app/(public)` or `app/api/graph` imports `loadRawGarden`.**
   The "did the cache actually get used" guard — without it, a later edit can
   restore the live read on a public page and nothing observable changes in
   development, where Mongo is fast and local.
4. **No `revalidatePath` remains in the repo.** It is dead here by construction
   and its reappearance would mean someone reasoned about invalidation from the
   old model.

## 5. Acceptance

- `npm run lint`, `npm test`, `npm run test:db`, `npm run build` all green.
- **First-load JS, measured** (`npm run build` on `main` at `8d72c3b` against
  the branch). The budget was "the `error.tsx` boundary, ≲ 1 kB". It came in
  under that and the public routes ended up *smaller* than before:

  | Route | main | branch |
  |---|---|---|
  | `/` | 103 kB | 102 kB |
  | `/plant/[slug]` | 103 kB | 102 kB |
  | `/pod/[slug]` | 103 kB | 102 kB |
  | `/bean/[id]` | 103 kB | 102 kB |
  | `/beanstalk` | 105 kB | 105 kB |
  | `/_not-found` | 104 kB (1 kB route) | 102 kB (172 B route) |

  `/beanstalk` is the row that did not move, and honestly so: it is
  `Promise.all([loadCachedGarden(), listPollen()])`, and §6 declines to cache
  `pollen`. So four of the five public pages stopped waiting on Mongo and that
  one still does, on its pollen half.

  The error boundary's own chunk is **890 bytes raw, ~400 B gzipped**, and adds
  no measurable per-route first load: React's error-boundary machinery is
  already in the shared runtime, and the component itself imports nothing. The
  `/_not-found` row is the real saving and the one with a clear cause —
  `app/not-found.tsx` replaces Next's heavier built-in default. The ~0.5 kB off
  the shared chunk is left unattributed rather than claimed; it is below the
  granularity at which this build reports honestly.

- Manually: publish a sprout in the admin, confirm it appears on the public page
  on the next request rather than in five minutes. That is the one behaviour a
  test in this repo cannot assert, because it needs both a Next runtime and a
  database.
- Manually: create a seed and discard one, and confirm the inbox updates
  immediately. Those two actions are the only ones in the slice that lost their
  invalidation call outright (§3.2), so they are the only place a regression
  would not show up as a stale *public* page.

## 6. Not in this slice

Audit **B1/B3** — targeted `getPlant(slug)` / `getPod(slug)` / `getBean(slug)`
readers, per-collection projections, a `loadCascadeGarden()` projected to four
fields, and keeping `bees` out of the default load. The cache removes most of
their urgency: the eight actions that load the whole garden to find one document
by slug are still wasteful, but they now waste it on the author's write path
rather than on every visitor's read path, which is a different and much smaller
problem.

Audit **B6–B10** — the `seeds` and `pollen` indexes, the unbounded `listPollen`,
`projectBeans`'s N+1, the sequential awaits, and the middleware's `has:` matcher.

Also not here: caching `seeds` or `pollen`. They have their own loaders, their
own write doors, and no public page's TTFB depends on them the way four pages
depend on the garden. A second tag is a second invariant to maintain and this
slice does not need it.

---

Roadmap item 2 of [`../ROADMAP.md`](../ROADMAP.md).
