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
`syncPollenAction` calls the same `runSync`.

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
boundaries where `revalidateTag` is legal and where `node --test` never runs:

1. `app/admin/actions.ts` — in place of the `revalidatePath` calls, which
   already sit at the right moments.
2. `app/api/articles/route.ts`
3. `app/api/synthesis/route.ts`
4. `app/api/pollen/sync/route.ts`

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

### 3.3 `lib/db.ts`

`serverSelectionTimeoutMS: 5000` and `connectTimeoutMS: 5000` on the
`MongoClient` (audit B5 — both currently default to 30 s).

Worth stating what this now *means*, because the cache changes it: with a warm
cache an Atlas outage is invisible to the public site, which renders stale from
the Data Cache and never reaches Mongo at all. The 5 s applies only to a cold
cache, where it turns a 30 s hang into a fast error page. The two halves of this
slice compose: the cache removes the common failure, the timeout bounds the rare
one.

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

Render tests for the two `not-found.tsx` files and for `error.tsx` — the latter
asserting the reset control exists and is a `<button>`, since an error page
whose only affordance is broken is worse than Next's default.

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
- First-load JS for every public route recorded before and after; the delta is
  the `error.tsx` boundary and is expected to be ≲ 1 kB. A larger number is
  reported, not absorbed.
- Manually: publish a sprout in the admin, confirm it appears on the public page
  on the next request rather than in five minutes. That is the one behaviour a
  test in this repo cannot assert, because it needs both a Next runtime and a
  database.

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
