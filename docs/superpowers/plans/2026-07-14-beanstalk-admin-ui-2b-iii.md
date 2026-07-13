# Beanstalk Admin UI — Plan 2b-iii: Public Revalidation + Vault Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make published content appear on the live public site immediately (`force-dynamic`), and add a read-only `/admin/vault` browser to navigate/filter the whole archive.

**Architecture:** The three public pages become `force-dynamic` so each request re-reads published-only from Mongo (no cache to invalidate). The vault browser is a server component over `getFullDataset()` whose only logic is a pure, unit-tested `filterVaultEntries` (state/domain/tag) driven by zero-JS query-param links.

**Tech Stack:** Next.js 15 (server components, route segment config), TypeScript, MongoDB (via existing `lib/store`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-admin-ui-2b-iii-design.md`

**Conventions carried from prior slices:**
- Tests live under `lib/` and run via `npm test` = `node --import tsx --test "lib/**/*.test.ts"`; pure tests need no DB; test files import by relative path.
- App code imports lib via the `@/*` alias; admin pages are bare functional HTML (no CSS, no client JS) and rely on the existing `/admin/*` middleware for auth.
- `searchParams` in Next 15 pages is a `Promise` and must be awaited.

---

## File Structure

- `lib/vault.ts` — **create.** Pure `filterVaultEntries(entries, filters)` + `distinctTags(entries)` + `VaultFilters` type.
- `lib/vault.test.ts` — **create.** Pure unit tests.
- `app/page.tsx` — **modify.** Add `export const dynamic = "force-dynamic"`.
- `app/timeline/page.tsx` — **modify.** Add `export const dynamic = "force-dynamic"`.
- `app/atom/[id]/page.tsx` — **modify.** Add `export const dynamic = "force-dynamic"`.
- `app/admin/vault/page.tsx` — **create.** The read-only browser page.
- `app/admin/page.tsx` — **modify.** Add a nav link to `/admin/vault`.
- `README.md` — **modify.** Document the vault browser + the force-dynamic public behavior.

**Untouched:** the promote/publish action, `lib/atomic.ts`, `lib/promote.ts`, `filterPublic`/`buildDataset`, `lib/store.ts`, and all of 2b-i/2b-ii.

---

## Task 1: Pure vault filter — `lib/vault.ts` (TDD)

**Files:**
- Create: `lib/vault.ts`
- Test: `lib/vault.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/vault.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVaultEntries, distinctTags } from "./vault";
import type { TimelineEntry } from "./data";

function entry(slug: string, state: string | undefined, domain: string | null, tags?: string[]): TimelineEntry {
  return {
    version: { slug, name: slug, type: "t", date: "2025-01-01", description: "", parents: [], ...(state ? { state: state as never } : {}), ...(tags ? { tags } : {}) },
    atom: domain ? { slug: `atom-${slug}`, name: "a", parents: [] } : null,
    domain: domain as never,
  };
}

const ENTRIES: TimelineEntry[] = [
  entry("v1", "draft", "music", ["demo", "wip"]),
  entry("v2", "published", "music", ["release"]),
  entry("v3", "private", "design"),
  entry("v4", "published", "podcast", ["release"]),
];

test("no filters returns all entries", () => {
  assert.equal(filterVaultEntries(ENTRIES, {}).length, 4);
});

test("filters by state", () => {
  const r = filterVaultEntries(ENTRIES, { state: "published" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v2", "v4"]);
});

test("filters by domain", () => {
  const r = filterVaultEntries(ENTRIES, { domain: "music" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v1", "v2"]);
});

test("filters by tag (membership)", () => {
  const r = filterVaultEntries(ENTRIES, { tag: "release" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v2", "v4"]);
});

test("combined filters intersect", () => {
  const r = filterVaultEntries(ENTRIES, { state: "published", domain: "music" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v2"]);
});

test("an unknown state value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { state: "bogus" }).length, 4);
});

test("an unknown domain value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { domain: "nope" }).length, 4);
});

test("a blank tag falls back to all; an unmatched tag yields none", () => {
  assert.equal(filterVaultEntries(ENTRIES, { tag: "  " }).length, 4);
  assert.equal(filterVaultEntries(ENTRIES, { tag: "ghost" }).length, 0);
});

test("empty input returns empty", () => {
  assert.deepEqual(filterVaultEntries([], { state: "draft" }), []);
});

test("distinctTags returns sorted unique tags across entries", () => {
  assert.deepEqual(distinctTags(ENTRIES), ["demo", "release", "wip"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./vault` cannot be found.

- [ ] **Step 3: Implement `lib/vault.ts`**

Create `lib/vault.ts`:
```ts
import type { Domain, TimelineEntry, VersionState } from "./data";

const STATES: VersionState[] = ["draft", "private", "published"];
const DOMAINS: Domain[] = ["music", "design", "podcast"];

export interface VaultFilters {
  state?: string;
  domain?: string;
  tag?: string;
}

// Pure. Applies the active filters to timeline entries. An unrecognized state or
// domain value is ignored (that dimension falls back to "all"); a blank tag is
// ignored, while a non-blank tag filters by membership (an unmatched tag → none).
export function filterVaultEntries(entries: TimelineEntry[], filters: VaultFilters): TimelineEntry[] {
  const state = STATES.includes(filters.state as VersionState) ? (filters.state as VersionState) : undefined;
  const domain = DOMAINS.includes(filters.domain as Domain) ? (filters.domain as Domain) : undefined;
  const tag = filters.tag && filters.tag.trim() ? filters.tag.trim() : undefined;

  return entries.filter((e) => {
    if (state && e.version.state !== state) return false;
    if (domain && e.domain !== domain) return false;
    if (tag && !(e.version.tags ?? []).includes(tag)) return false;
    return true;
  });
}

// Distinct tags across all entries, sorted — for the tag filter row.
export function distinctTags(entries: TimelineEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const t of e.version.tags ?? []) set.add(t);
  return [...set].sort();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all `vault` tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/vault.ts lib/vault.test.ts
git commit -m "feat: pure vault entry filter (state/domain/tag)"
```

---

## Task 2: `force-dynamic` on the public pages

**Files:**
- Modify: `app/page.tsx`, `app/timeline/page.tsx`, `app/atom/[id]/page.tsx`

- [ ] **Step 1: Add the route segment config to each public page**

In EACH of the three files, add this line immediately after the imports (before the default export). Do NOT change anything else in the files.
```ts
export const dynamic = "force-dynamic";
```
So each file gains, e.g.:
```tsx
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
```
(`app/page.tsx` imports `getPublicDataset`; `app/timeline/page.tsx` imports `Domain`/`getPublicDataset`; `app/atom/[id]/page.tsx` imports `notFound`/`getPublicDataset` — leave those imports and all logic as-is, just insert the `export const dynamic` line.)

- [ ] **Step 2: Verify typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass/skip as before (this is a config-only change).

- [ ] **Step 3: Verify the pages still render dynamically**

Start the dev server (`npm run dev`) and load `http://localhost:3000/`, `/timeline`, and an existing `/atom/<slug>`. Each should render normally (200). (Freshness is exercised end-to-end in Task 4's smoke test.)

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/timeline/page.tsx app/atom/[id]/page.tsx
git commit -m "feat: force-dynamic public pages so publishes appear immediately"
```

---

## Task 3: The vault browser — `app/admin/vault/page.tsx` + inbox link

**Files:**
- Create: `app/admin/vault/page.tsx`
- Modify: `app/admin/page.tsx` (add a nav link to the vault)

- [ ] **Step 1: Implement the vault page**

Create `app/admin/vault/page.tsx`. Bare semantic HTML, no CSS:
```tsx
import { getFullDataset } from "@/lib/store";
import type { TimelineEntry } from "@/lib/data";
import { filterVaultEntries, distinctTags } from "@/lib/vault";

export const dynamic = "force-dynamic";

const STATE_OPTIONS = ["all", "draft", "private", "published"];
const DOMAIN_OPTIONS = ["all", "music", "design", "podcast"];

type Active = { state?: string; domain?: string; tag?: string };

// Build a filter link that sets one dimension to `value` (or clears it when "all")
// while preserving the other active filters. Zero-JS — plain hrefs.
function vaultHref(active: Active, key: keyof Active, value: string): string {
  const merged: Active = { ...active, [key]: value };
  const params = new URLSearchParams();
  for (const k of ["state", "domain", "tag"] as const) {
    const v = merged[k];
    if (v && v !== "all") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/vault?${qs}` : "/admin/vault";
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; domain?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: TimelineEntry[] | null = null;
  try {
    all = (await getFullDataset()).timelineVersions();
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <p>
          <a href="/admin">← inbox</a>
        </p>
        <h1>Vault</h1>
        <p role="alert">Couldn&apos;t load the vault.</p>
      </article>
    );
  }

  const entries = filterVaultEntries(all, active);
  const tagOptions = ["all", ...distinctTags(all)];

  const filterRow = (label: string, key: keyof Active, options: string[]) => {
    const current = active[key] ?? "all";
    return (
      <p>
        {label}:{" "}
        {options.map((opt) => (
          <span key={opt}>
            {opt === current ? <strong>{opt}</strong> : <a href={vaultHref(active, key, opt)}>{opt}</a>}{" "}
          </span>
        ))}
      </p>
    );
  };

  return (
    <article>
      <p>
        <a href="/admin">← inbox</a>
      </p>
      <h1>Vault</h1>

      {filterRow("state", "state", STATE_OPTIONS)}
      {filterRow("domain", "domain", DOMAIN_OPTIONS)}
      {filterRow("tag", "tag", tagOptions)}

      <p>
        showing {entries.length} of {all.length}
      </p>

      {entries.length === 0 ? (
        <p>No matching versions.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>version</th>
              <th>state</th>
              <th>domain</th>
              <th>atom</th>
              <th>date</th>
              <th>tags</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.version.slug}>
                <td>
                  {e.atom ? <a href={`/atom/${e.atom.slug}`}>{e.version.name}</a> : e.version.name}
                </td>
                <td>{e.version.state ?? "—"}</td>
                <td>{e.domain ?? "—"}</td>
                <td>{e.atom?.slug ?? "—"}</td>
                <td>{e.version.date}</td>
                <td>{(e.version.tags ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Add a nav link from the inbox to the vault**

In `app/admin/page.tsx`, find the logout form near the top:
```tsx
      <form action={logoutAction}>
        <button type="submit">Log out</button>
      </form>
```
and add a vault link immediately after it:
```tsx
      <p>
        <a href="/admin/vault">vault →</a>
      </p>
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests green.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/vault/page.tsx" app/admin/page.tsx
git commit -m "feat: read-only /admin/vault browser with state/domain/tag filters"
```

---

## Task 4: Smoke test end-to-end + README note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full test suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pure tests pass (incl. new `vault` suite); DB-guarded tests skip; no type errors.

- [ ] **Step 2: Smoke — public freshness (force-dynamic)**

Start the dev server (`npm run dev`) and, logged in as admin, triage + **publish** a capture into a new molecule/atom (as in the 2b-ii smoke). Then load the public `http://localhost:3000/` and `/timeline` (in a normal/anonymous view) and confirm the newly published version and its atom appear **without a rebuild**. Confirm a version left as **draft** does NOT appear publicly.

- [ ] **Step 3: Smoke — vault browser**

Visit `http://localhost:3000/admin/vault`:
- All items appear, including `draft`/`private` ones (unlike the public site).
- `?state=draft` narrows to drafts; `?domain=music` to music; combining both intersects; `?tag=<tag>` filters by tag.
- The "showing N of M" count and the active-filter `<strong>` highlight are correct.
- A version's name links to its `/atom/<slug>` page when it has an atom.
Clean up any test molecules/atoms/versions/captures you created.

- [ ] **Step 4: Document in the README**

In `README.md`:
- Update the "Database & development" note: the public pages are now `force-dynamic` (read Mongo per request), so `npm run build` no longer needs DB reachability for them, and a publish appears on the public site immediately.
- Add a `/admin/vault` bullet under the Admin zone: a read-only browser of the whole archive (all states/visibilities), filterable by `state`/`domain`/`tag` via query params; linked from the inbox.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document force-dynamic public pages and the vault browser"
```

---

## Done — what Plan 2b-iii delivers

- Public pages re-read published-only from Mongo per request (`force-dynamic`), so a triaged/published Version (and its cascaded-public lineage) appears on the live site immediately — closing the publish loop. Also removes the build-needs-DB fragility for these pages.
- A read-only `/admin/vault` browser over the full dataset, filterable by state/domain/tag with a pure, unit-tested `filterVaultEntries`, linked from the inbox.
- With this, Plan 2b (capture → triage → publish → browse) is complete. The promote/publish action, atomic write layer, and `filterPublic` are untouched.

## Deferred to later specs

- Editing / re-publishing / un-publishing an existing Version from the admin.
- Tag-based caching of the public zone (perf optimization) if traffic ever warrants.
- `name`/`description` `string→Text` widening; capture-bar image attach; connectors; AI-assisted classification.

## Notes / small risks to watch during execution

- **`filterVaultEntries` never consults visibility** — it filters `version.state`, and the vault intentionally shows everything (`getFullDataset`, not `filterPublic`). The public/private split is enforced only on the public read path, which is untouched.
- **`force-dynamic` is per-page route segment config** — it must be a top-level `export const dynamic` in each page module, not inside the component. A version with no `state` shows as `—` in the vault and is excluded by any specific state filter (only "all" shows it).
- **`TimelineEntry` fixtures in the test** use `state as never`/`domain as never` casts only to keep the fixture terse; the real `timelineVersions()` returns properly typed entries.

## Execution notes (added during subagent-driven execution)

All 4 tasks implemented and passed review (T1/T3 two-stage spec + code-quality; T2 a single scaled review for the config-only change), plus a final whole-slice review (**ready to merge**, no Critical/Important). Gates green: `npm test` 96 pass / 16 pre-existing DB skips, `npx tsc --noEmit` clean.

- **Live smoke** (Chrome extension unavailable): seeded a published lineage + a draft version via the write layer + `setPublic`, minted a session cookie, and `curl`ed. Confirmed: the public `/timeline` shows the published version and **hides the draft** with no rebuild (force-dynamic works, `filterPublic` still applies); `/` shows the now-public atom; `/admin/vault` shows **both** states; `?state=draft` and `?domain=design` filter correctly; `/admin/vault` redirects 307 without a cookie.

## Deferred follow-ups (surfaced during review)

Non-blocking; none blocks 2b-iii:

- **Vault atom-name link targets the public `/atom/[id]` page** (T3 code-review, Important): for a `draft`/`private` version whose atom isn't public, clicking the name 404s; for a public atom, the target page won't list the draft/private version clicked. The real fix is an **admin-side atom detail view** (shows all states) — a later "edit/view Version" slice. Until then the link is only fully useful for published items.
- **`"all"` sentinel vs a real tag named `"all"`** (T3, minor/theoretical): a tag literally `"all"` would be indistinguishable from clearing the tag filter in `vaultHref`.
- **Tag filter is exact membership** (final, minor): fine for a closed option list from `distinctTags`; revisit if tags ever become free-text search.
- **No unit test for the vault `getFullDataset()` failure branch** (final, minor): the fallback JSX is only reachable via a real DB failure; consistent with the project's no-DB-in-`npm test` pattern.
