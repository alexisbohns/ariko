# Screen Library Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/screens` — a contact sheet of every stored screen, filtered server-side, edited in a right-hand side sheet that pushes the page left and is itself an intercepted route.

**Architecture:** Pure modules first (`lib/screens.ts`, `lib/screen-edit.ts`, `lib/screen-image.ts`, `lib/screen-create.ts`), then the Mongo writers, then the server actions, then the routes. The side sheet is Next's parallel + intercepting routes: `app/admin/@sheet/(.)screens/[slug]` renders **the same route component** the standalone page does, wrapped in a fixed panel, so nothing in the sheet exists that is not also a page.

**Tech Stack:** Next 15.5 (App Router, server actions, parallel/intercepting routes), React 19, TypeScript, Tailwind v4, shadcn on Base UI, MongoDB, `node:test`.

**Spec:** [`docs/superpowers/specs/2026-09-08-screen-library-admin-design.md`](../specs/2026-09-08-screen-library-admin-design.md)

**Branch:** `screen-library-admin` (already created; the spec is committed on it).

---

## Conventions this codebase expects

Read these once before Task 1. Violating them passes `tsc` and fails review.

- **Tests are `node:test`** — `import { test } from "node:test"; import assert from "node:assert/strict";`. Run with `npm test` (globs `lib/**/*.test.ts`). DB-backed tests live behind `{ skip: !hasDb }` and run with `npm run test:db`.
- **`textPart(value, "en" | "fr")` is STRICT** (no fallback); `resolveText(value)` falls back. Form prefills and dirty comparisons use `textPart`. Display uses `resolveText`. Using `resolveText` to prefill an `en` input copies the `fr` half and saves it back as `en`.
- **`composeText(en, fr)`** trims both halves and returns `""` when both are blank.
- **Omission discipline:** an optional field left blank is ABSENT (`$unset`), never `""` and never `[]`.
- **Comments carry the reason, not the mechanism.** Every non-obvious decision in this codebase is written down where it lives. Match that.
- **Admin metadata forms are zero-client-JS** — native controls from `components/ui/native-controls.tsx`, real submit buttons.
- **A form that is only the `MediaPicker` hands the picker its submit button** (`submitLabel`) and its patch builder enforces the `__ready` marker.

---

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/admin-filters.ts` | Pure: canonical filter query strings and filter hrefs, shared by the vault and the library. |
| `lib/admin-filters.test.ts` | Its tests. |
| `lib/screens.ts` | Pure: the index's arithmetic — rows, filters, distincts, neighbours, hrefs. |
| `lib/screens.test.ts` | Its tests. |
| `lib/screen-edit.ts` | Pure: the Meta form → a patch, and the patch → a Mongo update document. |
| `lib/screen-edit.test.ts` | Its tests. |
| `lib/screen-image.ts` | Pure: the picker's payload → a screen's image, with the family's three guards plus the no-clear rule. |
| `lib/screen-image.test.ts` | Its tests. |
| `lib/screen-create.ts` | Pure: the create form → a `NewScreen`. |
| `lib/screen-create.test.ts` | Its tests. |
| `lib/screen-sheet-source.test.ts` | Pins that the slot renders the page's own module and that tiles navigate by `href`. |
| `app/admin/_components/admin-filters.tsx` | The filter popovers (renamed from `vault-filters.tsx`, `bean` dimension added). |
| `app/admin/_components/side-sheet.tsx` | The fixed right-hand panel. Shell only — no form, no action. |
| `app/admin/_components/screen-nav.tsx` | The panel header: prev / next / close, as real links, plus the hotkeys island. |
| `app/admin/_components/sheet-keys.tsx` | Client: binds Escape and ←/→ over hrefs it is given. Renders nothing. |
| `app/admin/_components/filter-fields.tsx` | The three hidden fields every write form round-trips the active filters through. |
| `app/admin/_components/screen-meta-form.tsx` | Zero-client-JS metadata form. |
| `app/admin/_components/screen-image-form.tsx` | Picker-only form. |
| `app/admin/_components/screen-delete-form.tsx` | Confirm-checkbox delete form. |
| `app/admin/_components/screen-create-form.tsx` | The create form (picker + two text inputs + plant select). |
| `app/admin/screens/page.tsx` | The library: filters + contact sheet. |
| `app/admin/screens/[slug]/page.tsx` | One screen's editors. **Also the sheet's body.** |
| `app/admin/screens/new/page.tsx` | The create page. **Also a sheet body.** |
| `app/admin/@sheet/default.tsx` | `null` on every non-screen admin route. |
| `app/admin/@sheet/(.)screens/[slug]/page.tsx` | The screen page, in the panel. |
| `app/admin/@sheet/(.)screens/new/page.tsx` | The create page, in the panel. |

**Modified:**

| File | Change |
|---|---|
| `lib/image-url.ts` | Add `cloudinaryFit`. |
| `lib/image-url.test.ts` | Its tests. |
| `lib/admin-nav.ts` | Fifth `NAV_ITEMS` entry + `SECTIONS` entry. |
| `lib/admin-nav.test.ts` | Fifth-section tests. |
| `lib/botanical.ts` | `listScreens`, `getScreen`, `updateScreenMeta`, `updateScreenImage`, `deleteScreen`. |
| `lib/botanical.test.ts` | DB-gated round trips. |
| `app/admin/actions.ts` | Four screen actions. |
| `app/admin/_components/admin-chrome.tsx` | `ICONS` entry for `/admin/screens`. |
| `app/admin/layout.tsx` | The `@sheet` slot and the push wrapper. |
| `app/admin/vault/page.tsx` | Use `AdminFilters` + `filterHref`. |
| `CLAUDE.md` | The library, and why the panel is not a seventh exception. |

**Deleted:** `app/admin/_components/vault-filters.tsx` (renamed).

---

## Task 1: `lib/admin-filters.ts` — the shared filter arithmetic

**Files:**
- Create: `lib/admin-filters.ts`
- Create: `lib/admin-filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin-filters.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterQuery, filterHref } from "./admin-filters";

const KEYS = ["state", "plant", "tag"] as const;

test("filterQuery keeps only the named keys, in the order given", () => {
  assert.equal(filterQuery({ tag: "release", plant: "music", rogue: "x" }, KEYS), "plant=music&tag=release");
});

test("filterQuery drops blank, whitespace and 'all' values", () => {
  assert.equal(filterQuery({ state: "all", plant: "  ", tag: "" }, KEYS), "");
});

test("filterQuery encodes values", () => {
  assert.equal(filterQuery({ plant: "a b&c" }, KEYS), "plant=a+b%26c");
});

test("filterQuery ignores a key that is not in the list", () => {
  assert.equal(filterQuery({ error: "boom" }, KEYS), "");
});

test("filterHref sets one dimension and preserves the others", () => {
  const href = filterHref("/admin/vault", { state: "draft", tag: "wip" }, KEYS, "plant", "music");
  assert.equal(href, "/admin/vault?state=draft&plant=music&tag=wip");
});

test("filterHref clears a dimension when the value is 'all'", () => {
  const href = filterHref("/admin/vault", { state: "draft", plant: "music" }, KEYS, "plant", "all");
  assert.equal(href, "/admin/vault?state=draft");
});

test("filterHref returns the bare base when nothing is active", () => {
  assert.equal(filterHref("/admin/vault", { state: "draft" }, KEYS, "state", "all"), "/admin/vault");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "admin-filters"`
Expected: FAIL — `Cannot find module './admin-filters'`.

- [ ] **Step 3: Write `lib/admin-filters.ts`**

```ts
/**
 * The filter bar's arithmetic — one copy, two pages.
 *
 * `/admin/vault` has filtered sprouts by state, plant and tag since it existed,
 * with the href builder living inside the page. `/admin/screens` needs exactly
 * the same thing over different dimensions, so the builder moved here rather
 * than being copied: two pages that draw the same control draw it from one
 * file, and what differs is a parameter.
 *
 * `filterQuery` carries a second job the vault never needed. The library's
 * write forms round-trip the author's active filters through a hidden field so
 * a save does not drop them out of the set they were working through — and a
 * hidden field is client-controlled. Rebuilding the query from a NAMED key list
 * is what makes that safe: whatever arrives, only these keys survive, so the
 * string handed to `redirect()` can never carry anything but the dimensions
 * this page knows about.
 */

export type FilterValues = Record<string, string | undefined>;

/** Canonical `k=v&k=v` for the named keys, in the order given. Blank,
 *  whitespace-only and "all" values are dropped — "all" is how both pages
 *  spell "no filter". Returns "" when nothing is active. */
export function filterQuery(active: FilterValues, keys: readonly string[]): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = (active[key] ?? "").trim();
    if (value && value !== "all") params.set(key, value);
  }
  return params.toString();
}

/** A link that sets one dimension while preserving the others. Zero-JS — the
 *  filter popovers render these as plain <a href>, so a filtered view stays
 *  shareable and filtering stays server-side. */
export function filterHref(
  base: string,
  active: FilterValues,
  keys: readonly string[],
  key: string,
  value: string,
): string {
  const query = filterQuery({ ...active, [key]: value }, keys);
  return query ? `${base}?${query}` : base;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "admin-filters|^# (pass|fail)"`
Expected: the seven tests pass; `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-filters.ts lib/admin-filters.test.ts
git commit -m "The filter bar's arithmetic, in one file for two pages"
```

---

## Task 2: `lib/screens.ts` — the index's arithmetic

**Files:**
- Create: `lib/screens.ts`
- Create: `lib/screens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/screens.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Screen } from "./data";
import {
  screenRows,
  filterScreens,
  distinctScreenPlants,
  distinctScreenBeans,
  distinctScreenTags,
  neighbours,
  screensQuery,
  screensHref,
} from "./screens";

function screen(slug: string, over: Partial<Screen> = {}): Screen {
  return {
    slug,
    name: slug,
    image: { kind: "image", storageKey: `k/${slug}`, url: `https://res.cloudinary.com/x/image/upload/v1/${slug}.png` },
    parents: ["plant:paulopus"],
    ...over,
  };
}

const SCREENS: Screen[] = [
  screen("karma-top", {
    name: { en: "Karma top", fr: "Karma haut" },
    relations: [{ kind: "cover", ref: "bean:karma-accountability" }],
    capturedAt: "2026-09-01",
    tags: ["hero"],
  }),
  screen("home-teams", { relations: [{ kind: "shows", ref: "bean:brand-voice" }], capturedAt: "2026-09-02" }),
  screen("orphan", { parents: [], capturedAt: "2026-09-02", tags: ["hero", "wip"] }),
  screen("match-hero", { parents: ["plant:melogram"], capturedAt: "2026-08-30" }),
];

test("rows resolve the name and lift the plant out of parents[]", () => {
  const rows = screenRows(SCREENS);
  const karma = rows.find((r) => r.slug === "karma-top");
  assert.equal(karma?.name, "Karma top");
  assert.equal(karma?.plant, "paulopus");
  assert.equal(rows.find((r) => r.slug === "orphan")?.plant, null);
});

test("the related bean comes from a shows relation", () => {
  const rows = screenRows(SCREENS);
  assert.equal(rows.find((r) => r.slug === "home-teams")?.bean, "brand-voice");
  assert.equal(rows.find((r) => r.slug === "home-teams")?.isCover, false);
});

test("a cover relation also names the bean, and marks the row", () => {
  const row = screenRows(SCREENS).find((r) => r.slug === "karma-top");
  assert.equal(row?.bean, "karma-accountability");
  assert.equal(row?.isCover, true);
});

test("a shows relation wins over a cover relation for the bean", () => {
  const rows = screenRows([
    screen("both", {
      relations: [
        { kind: "cover", ref: "bean:one" },
        { kind: "shows", ref: "bean:two" },
      ],
    }),
  ]);
  assert.equal(rows[0].bean, "two");
  assert.equal(rows[0].isCover, true);
});

test("rows sort by capturedAt descending, then slug", () => {
  assert.deepEqual(
    screenRows(SCREENS).map((r) => r.slug),
    ["home-teams", "orphan", "karma-top", "match-hero"],
  );
});

test("a screen with no capturedAt sorts last, not first", () => {
  const rows = screenRows([screen("undated"), screen("dated", { capturedAt: "2020-01-01" })]);
  assert.deepEqual(rows.map((r) => r.slug), ["dated", "undated"]);
});

test("filters by plant, bean and tag; blanks are ignored", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(filterScreens(rows, { plant: "paulopus" }).map((r) => r.slug), [
    "home-teams",
    "karma-top",
  ]);
  assert.deepEqual(filterScreens(rows, { bean: "brand-voice" }).map((r) => r.slug), ["home-teams"]);
  assert.deepEqual(filterScreens(rows, { tag: "wip" }).map((r) => r.slug), ["orphan"]);
  assert.equal(filterScreens(rows, { plant: "  " }).length, 4);
});

test("filters intersect", () => {
  const rows = screenRows(SCREENS);
  assert.equal(filterScreens(rows, { plant: "paulopus", tag: "hero" }).length, 1);
});

test("distincts are sorted and de-duplicated", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(distinctScreenPlants(rows), ["melogram", "paulopus"]);
  assert.deepEqual(distinctScreenBeans(rows), ["brand-voice", "karma-accountability"]);
  assert.deepEqual(distinctScreenTags(rows), ["hero", "wip"]);
});

test("neighbours walk the list as ordered, and stop at both ends", () => {
  const rows = screenRows(SCREENS); // home-teams, orphan, karma-top, match-hero
  assert.deepEqual(neighbours(rows, "orphan"), { prev: "home-teams", next: "karma-top" });
  assert.deepEqual(neighbours(rows, "home-teams"), { prev: null, next: "orphan" });
  assert.deepEqual(neighbours(rows, "match-hero"), { prev: "karma-top", next: null });
});

test("neighbours of an unknown slug are both null", () => {
  assert.deepEqual(neighbours(screenRows(SCREENS), "ghost"), { prev: null, next: null });
});

test("neighbours respect a FILTERED list", () => {
  const rows = filterScreens(screenRows(SCREENS), { plant: "paulopus" });
  assert.deepEqual(neighbours(rows, "home-teams"), { prev: null, next: "karma-top" });
});

test("screensQuery keeps the three dimensions and drops everything else", () => {
  assert.equal(screensQuery({ plant: "paulopus", error: "boom" }), "plant=paulopus");
  assert.equal(screensQuery({}), "");
});

test("screensHref builds the library, a screen, and an error redirect", () => {
  assert.equal(screensHref(null, ""), "/admin/screens");
  assert.equal(screensHref(null, "plant=paulopus"), "/admin/screens?plant=paulopus");
  assert.equal(screensHref("karma-top", "plant=paulopus"), "/admin/screens/karma-top?plant=paulopus");
  assert.equal(screensHref("karma-top", "", "no image"), "/admin/screens/karma-top?error=no+image");
  assert.equal(
    screensHref("karma-top", "plant=paulopus", "no image"),
    "/admin/screens/karma-top?plant=paulopus&error=no+image",
  );
});

test("screensHref encodes a slug", () => {
  assert.equal(screensHref("a b", ""), "/admin/screens/a%20b");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "screens.test"`
Expected: FAIL — `Cannot find module './screens'`.

- [ ] **Step 3: Write `lib/screens.ts`**

```ts
import { BEAN_PREFIX, PLANT_PREFIX, parentsWithPrefix, resolveText, type Screen } from "./data";
import { filterQuery, type FilterValues } from "./admin-filters";

/**
 * The library's arithmetic — everything `/admin/screens` decides that is not a
 * render.
 *
 * It reads the RAW screens rather than a Dataset: `buildDataset` is the read
 * model, it has no screens accessor, and it does not grow one here — nothing
 * public reads screens until the gallery slice, and every screen in the
 * collection is private at birth, so the admin's `loadRawGarden()` is the only
 * path that can see them at all.
 */

/** The three dimensions the library filters on. Named once, here, because both
 *  the filter bar and the hidden field the write forms round-trip read it. */
export const SCREEN_FILTER_KEYS = ["plant", "bean", "tag"] as const;

export interface ScreenRow {
  slug: string;
  /** Resolved for display — a tile shows words, not a Text. */
  name: string;
  url: string;
  alt: string;
  /** The containing plant's slug, from parents[]. Null when standalone. */
  plant: string | null;
  /** The related bean's slug, from relations[]. Null when there is none. */
  bean: string | null;
  /** Carries a `{ kind: "cover" }` relation — the image is in service on the
   *  landing row, which is worth saying on the tile and in the delete card. */
  isCover: boolean;
  tags: string[];
  capturedAt: string;
}

export interface ScreenFilters {
  plant?: string;
  bean?: string;
  tag?: string;
}

/**
 * Rows, ordered.
 *
 * `shows` wins over `cover` for the bean, and the reason is the import: it
 * wrote `{ kind: "cover" }` on the eight screens the landing row already uses,
 * which records a fact about an ASSET. A `shows` relation is the author saying
 * what the screen is OF. When a screen has both, the author's word is the one
 * the library files it under — while `isCover` keeps the other fact visible.
 */
export function screenRows(screens: Screen[]): ScreenRow[] {
  const rows = screens.map((screen) => {
    const relations = screen.relations ?? [];
    const beanRef = (kind: string): string | null => {
      const hit = relations.find((r) => r.kind === kind && r.ref.startsWith(BEAN_PREFIX));
      return hit ? hit.ref.slice(BEAN_PREFIX.length) : null;
    };
    const cover = beanRef("cover");
    return {
      slug: screen.slug,
      name: resolveText(screen.name),
      url: screen.image.url,
      alt: screen.image.alt ?? "",
      plant: parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null,
      bean: beanRef("shows") ?? cover,
      isCover: cover !== null,
      tags: screen.tags ?? [],
      capturedAt: screen.capturedAt ?? "",
    };
  });

  // Newest capture run first, slug as the tie-break — a whole run shares one
  // date, so without the second key the order inside a run is Mongo's and would
  // shuffle under the author between visits. An undated screen sorts LAST
  // (its "" compares below every real date), which is right: dated screens came
  // from a run somebody remembers.
  return rows.sort((a, b) =>
    a.capturedAt === b.capturedAt
      ? a.slug.localeCompare(b.slug)
      : a.capturedAt < b.capturedAt
        ? 1
        : -1,
  );
}

/** Pure. Membership on all three dimensions; a blank value is ignored, a
 *  non-blank unknown one matches nothing — `filterVaultEntries`' stance, and
 *  for its reason: there is no enum here to validate against. */
export function filterScreens(rows: ScreenRow[], filters: ScreenFilters): ScreenRow[] {
  const value = (raw?: string) => (raw && raw.trim() ? raw.trim() : undefined);
  const plant = value(filters.plant);
  const bean = value(filters.bean);
  const tag = value(filters.tag);

  return rows.filter((row) => {
    if (plant && row.plant !== plant) return false;
    if (bean && row.bean !== bean) return false;
    if (tag && !row.tags.includes(tag)) return false;
    return true;
  });
}

function distinct(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort();
}

export function distinctScreenPlants(rows: ScreenRow[]): string[] {
  return distinct(rows.map((r) => r.plant));
}

export function distinctScreenBeans(rows: ScreenRow[]): string[] {
  return distinct(rows.map((r) => r.bean));
}

export function distinctScreenTags(rows: ScreenRow[]): string[] {
  return distinct(rows.flatMap((r) => r.tags));
}

/**
 * The screens either side of one, IN THE LIST THE AUTHOR IS LOOKING AT.
 *
 * Rows are passed in already filtered, which is the whole point: prev/next that
 * walked the entire collection would jump out of the filtered set on the first
 * press. An unknown slug yields two nulls rather than throwing — the panel can
 * be open on a screen the filters exclude (a save that changed its plant does
 * exactly that), and losing the arrows is the right cost.
 */
export function neighbours(rows: ScreenRow[], slug: string): { prev: string | null; next: string | null } {
  const at = rows.findIndex((row) => row.slug === slug);
  if (at === -1) return { prev: null, next: null };
  return {
    prev: at > 0 ? rows[at - 1].slug : null,
    next: at < rows.length - 1 ? rows[at + 1].slug : null,
  };
}

/** The library's canonical query string. The one place that knows which keys
 *  the library filters on reach a URL — which is what makes the hidden field
 *  the write forms round-trip harmless. */
export function screensQuery(active: FilterValues): string {
  return filterQuery(active, SCREEN_FILTER_KEYS);
}

/**
 * Every URL this slice redirects to or links to.
 *
 * `error` is appended LAST and by URLSearchParams, so a message containing an
 * ampersand cannot smuggle a filter, and `query` has already been through
 * `screensQuery` — so the only thing that ever reaches a `redirect()` is a
 * known path with known keys.
 */
export function screensHref(slug: string | null, query: string, error?: string): string {
  const path = slug ? `/admin/screens/${encodeURIComponent(slug)}` : "/admin/screens";
  const params = new URLSearchParams(query);
  if (error) params.set("error", error);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "screens|^# (pass|fail)"`
Expected: every `screens.test.ts` test passes; `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/screens.ts lib/screens.test.ts
git commit -m "The screen library's arithmetic: rows, filters, neighbours, hrefs"
```

---

## Task 3: `lib/screen-image.ts` — the picker's fourth sibling

**Files:**
- Create: `lib/screen-image.ts`
- Create: `lib/screen-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/screen-image.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildScreenImagePatch, readImageField } from "./screen-image";

const STORED: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/abc",
  url: "https://res.cloudinary.com/x/image/upload/v1/abc.png",
  width: 1179,
  height: 2556,
};

const NEXT: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/def",
  url: "https://res.cloudinary.com/x/image/upload/v1/def.png",
  width: 1179,
  height: 2556,
};

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

function ready(images: MediaImage[]): FormData {
  return form([
    ["image__ready", "1"],
    ...images.map((m) => ["image", JSON.stringify(m)] as [string, string]),
  ]);
}

test("a picker that never mounted writes nothing", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, form([])), { dirty: false });
});

test("an unchanged save writes nothing", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([STORED])), { dirty: false });
});

test("a replaced image is dirty", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([NEXT])), {
    dirty: true,
    image: NEXT,
  });
});

test("a changed dimension alone is dirty — bean-cover.ts reads them", () => {
  const rotated = { ...STORED, width: 2556, height: 1179 };
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([rotated])), {
    dirty: true,
    image: rotated,
  });
});

test("an emptied list is NOT a clear — a screen with no image is not a screen", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([])), { dirty: false });
});

test("entries that yield no image are a failed save, not a clear", () => {
  const fd = form([
    ["image__ready", "1"],
    ["image", "{not json"],
  ]);
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, fd), { dirty: false });
});

test("an embed is not a candidate", () => {
  const fd = ready([]);
  fd.append("image", JSON.stringify({ kind: "embed", provider: "", url: "https://x.test/a" }));
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, fd), { dirty: false });
});

test("readImageField reports the marker, the count and the first image", () => {
  assert.deepEqual(readImageField(form([])), { ready: false, submitted: 0, image: null });
  assert.deepEqual(readImageField(ready([NEXT])), { ready: true, submitted: 1, image: NEXT });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "screen-image"`
Expected: FAIL — `Cannot find module './screen-image'`.

- [ ] **Step 3: Write `lib/screen-image.ts`**

```ts
import type { MediaImage } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Screen this module cares about. `image` is REQUIRED on the
 *  stored type; it is optional here only so the create path can ask the same
 *  question of a record that does not exist yet. */
export interface ImageOwner {
  image?: MediaImage;
}

export type ScreenImagePatchResult = { dirty: false } | { dirty: true; image: MediaImage };

/** What the picker's `image` field actually carried. Shared with
 *  lib/screen-create.ts so the create path and the replace path read the wire
 *  in exactly one place — the two must agree about the marker or a create could
 *  succeed where a replace refuses. */
export function readImageField(form: FormData): {
  ready: boolean;
  submitted: number;
  image: MediaImage | null;
} {
  const raw = form.getAll("image").map((v) => String(v));
  return {
    ready: form.has("image__ready"),
    submitted: raw.length,
    // A screen is an image. An embed is not a candidate, and `links` is off on
    // the picker — but that is the UI saying so, not the contract.
    image: parseMediaField(raw).find((m): m is MediaImage => m.kind === "image") ?? null,
  };
}

// Field-order-sensitive, for lib/plant-logo.ts's reason: a stored entry comes
// back from Mongo and a submitted one is rebuilt by the browser, so key order
// differs and JSON.stringify of the object itself would call an untouched image
// dirty. width/height are IN the tuple and that is load-bearing rather than
// complete: lib/bean-cover.ts decides the phone treatment from `height > width`,
// so a re-upload that changed only the dimensions is a real edit.
function canonical(image: MediaImage | null): string {
  return image === null
    ? "null"
    : JSON.stringify([
        image.storageKey,
        image.url,
        image.alt ?? "",
        image.width ?? null,
        image.height ?? null,
      ]);
}

/**
 * Pure, aside from one diagnostic warning. The FOURTH sibling of
 * lib/media-edit.ts (buildMediaPatch), lib/plant-logo.ts (buildPlantLogoPatch)
 * and lib/bean-cover-edit.ts (buildBeanCoverPatch) — the same `__ready` guard,
 * the same dirty gate, the same failed-save discriminator over a different
 * field. Fix one of those three here and check whether it applies there too.
 *
 * It adds one rule none of them has, and the difference is in the TYPE rather
 * than in taste:
 *
 *   A CLEAR IS NOT EXPRESSIBLE. `Screen.image` is required — a screen with no
 *   image is not a screen, it is a caption with a slug. So where
 *   buildBeanCoverPatch reads "the marker arrived and zero entries came with
 *   it" as a deliberate clear-all, this reads it as nothing to do.
 *
 * That collapses two of the sibling's branches into one: whether the payload
 * was emptied on purpose or mangled on the way, the answer here is the same and
 * the stored image survives.
 */
export function buildScreenImagePatch(current: ImageOwner, form: FormData): ScreenImagePatchResult {
  const { ready, submitted, image } = readImageField(form);
  const stored = current.image ?? null;

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what the screen holds. Defence in depth rather than
  // the sole protection: the card's submit button lives INSIDE the island
  // (MediaPicker's `submitLabel`), so an unmounted picker leaves no button to
  // press. This covers what a missing button cannot — a replayed POST.
  if (!ready) return { dirty: false };

  if (image === null) {
    // The one diagnostic in this otherwise pure module, for buildMediaPatch's
    // reason: without it, a client bug here is indistinguishable from an
    // ordinary no-op save — no exception, no log, the redirect proceeds — and
    // the author just sees "my edit didn't take" with no trail.
    if (submitted > 0) {
      console.warn(
        `[media] buildScreenImagePatch: ${submitted} submitted field(s) yielded no image — write skipped, stored image unchanged`,
      );
    }
    return { dirty: false };
  }

  return canonical(stored) === canonical(image) ? { dirty: false } : { dirty: true, image };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "screen-image|^# (pass|fail)"`
Expected: eight passes, `# fail 0`. (The "failed save" test prints one `[media]` warning — that is the diagnostic working.)

- [ ] **Step 5: Cross-reference the three siblings**

Add `lib/screen-image.ts (buildScreenImagePatch)` to the `siblings:` line in the doc comments of `lib/media-edit.ts`, `lib/plant-logo.ts` and `lib/bean-cover-edit.ts`. Each already lists the other two; the list is now three long in each file.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test 2>&1 | tail -5`
Expected: `# fail 0`.

```bash
git add lib/screen-image.ts lib/screen-image.test.ts lib/media-edit.ts lib/plant-logo.ts lib/bean-cover-edit.ts
git commit -m "A screen's image: the picker family's fourth member, which cannot clear"
```

---

## Task 4: `lib/screen-edit.ts` — the Meta form's patch

**Files:**
- Create: `lib/screen-edit.ts`
- Create: `lib/screen-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/screen-edit.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Screen } from "./data";
import { buildScreenMetaPatch, screenMetaUpdate, parseTags } from "./screen-edit";

const SCREEN: Screen = {
  slug: "karma-top",
  name: { en: "Karma top", fr: "Karma haut" },
  legend: "The leaderboard",
  image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
  parents: ["plant:paulopus"],
  relations: [{ kind: "cover", ref: "bean:karma-accountability" }],
  tags: ["hero"],
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** The form as the page renders it for SCREEN — every field at its stored value. */
function unchanged(over: Record<string, string> = {}): FormData {
  return form({
    name: "Karma top",
    nameFr: "Karma haut",
    legend: "The leaderboard",
    legendFr: "",
    tags: "hero",
    plant: "paulopus",
    bean: "",
    ...over,
  });
}

test("parseTags splits, trims, drops blanks and de-duplicates in order", () => {
  assert.deepEqual(parseTags(" hero , wip,, hero "), ["hero", "wip"]);
  assert.deepEqual(parseTags("   "), []);
});

test("an untouched save writes nothing", () => {
  assert.deepEqual(buildScreenMetaPatch(SCREEN, unchanged()), { ok: true, dirty: false });
});

test("a blank name in both halves is refused", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ name: "", nameFr: "  " }));
  assert.deepEqual(result, {
    ok: false,
    error: "a screen needs a name in at least one language",
  });
});

test("an fr-only name is valid", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ name: "", nameFr: "Karma haut" }));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.dirty && result.patch.name, "Karma haut");
});

test("a blank legend MEANS clear", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ legend: "" }));
  assert.equal(result.ok && result.dirty && result.patch.legend, null);
});

test("emptying the tags field clears them", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ tags: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.tags, []);
});

test("choosing a plant rewrites parents[]", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ plant: "melogram" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.parents, ["plant:melogram"]);
});

test("choosing no plant empties parents[]", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ plant: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.parents, []);
});

test("a shows relation is added WITHOUT losing the cover relation", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ bean: "brand-voice" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "cover", ref: "bean:karma-accountability" },
    { kind: "shows", ref: "bean:brand-voice" },
  ]);
});

test("a shows relation is REPLACED in place, not appended twice", () => {
  const withShows: Screen = {
    ...SCREEN,
    relations: [
      { kind: "shows", ref: "bean:one" },
      { kind: "cover", ref: "bean:karma-accountability" },
    ],
  };
  const result = buildScreenMetaPatch(withShows, unchanged({ bean: "two" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "shows", ref: "bean:two" },
    { kind: "cover", ref: "bean:karma-accountability" },
  ]);
});

test("clearing the bean drops only the shows relation", () => {
  const withShows: Screen = {
    ...SCREEN,
    relations: [
      { kind: "shows", ref: "bean:one" },
      { kind: "cover", ref: "bean:karma-accountability" },
    ],
  };
  const result = buildScreenMetaPatch(withShows, unchanged({ bean: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "cover", ref: "bean:karma-accountability" },
  ]);
});

test("screenMetaUpdate puts every present field in ONE $set", () => {
  const update = screenMetaUpdate({
    name: "A",
    legend: "L",
    tags: ["x"],
    parents: ["plant:p"],
    relations: [{ kind: "shows", ref: "bean:b" }],
  });
  assert.deepEqual(update, {
    $set: {
      name: "A",
      parents: ["plant:p"],
      legend: "L",
      tags: ["x"],
      relations: [{ kind: "shows", ref: "bean:b" }],
    },
  });
});

test("screenMetaUpdate $unsets the three optional fields when they are empty", () => {
  const update = screenMetaUpdate({ name: "A", legend: null, tags: [], parents: [], relations: [] });
  assert.deepEqual(update, {
    $set: { name: "A", parents: [] },
    $unset: { legend: "", tags: "", relations: "" },
  });
});

test("screenMetaUpdate never emits two $set keys", () => {
  const update = screenMetaUpdate({ name: "A", legend: "L", tags: [], parents: [], relations: [] });
  assert.deepEqual(Object.keys(update), ["$set", "$unset"]);
  assert.deepEqual(update.$set, { name: "A", parents: [], legend: "L" });
  assert.deepEqual(update.$unset, { tags: "", relations: "" });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "screen-edit"`
Expected: FAIL — `Cannot find module './screen-edit'`.

- [ ] **Step 3: Write `lib/screen-edit.ts`**

```ts
import { BEAN_PREFIX, composeText, textPart, type Relation, type Screen, type Text } from "./data";

/**
 * A screen's editable metadata — and nothing else.
 *
 * `slug` is absent for `PlantMetaPatch`'s reason: it is the stable id, and the
 * gallery, the covers migration and every future `screen:` ref will point at
 * it. `image` is absent because it has its own form and its own guards
 * (lib/screen-image.ts). `visibility` is absent because nothing public reads
 * screens yet, so a control for it would write a field with no reader.
 */
export interface ScreenMetaPatch {
  name: Text;
  /** `null` MEANS clear — the writer turns it into an `$unset`. The field
   *  belongs to a record that already exists, so a blank has to cross the wire
   *  as an INSTRUCTION rather than as an absence, or the author's deletion is
   *  silently ignored (lib/bean-keyword.ts states the same). */
  legend: Text | null;
  /** `[]` MEANS clear, for the same reason. */
  tags: string[];
  /** Containment. `[]` is a standalone screen. */
  parents: string[];
  /** The WHOLE array, with non-`shows` kinds carried through. */
  relations: Relation[];
}

export type ScreenMetaResult =
  | { ok: false; error: string }
  | { ok: true; dirty: false }
  | { ok: true; dirty: true; patch: ScreenMetaPatch };

/** Pure. A comma-separated field → tags. De-duplicated in first-seen order, so
 *  the author's ordering survives a round trip. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))];
}

// Field-order-insensitive comparison of everything this form can write. Text
// halves are read with the STRICT textPart on BOTH sides — resolveText's
// fallback would make an fr-only edit look unchanged.
function canonical(patch: ScreenMetaPatch): string {
  return JSON.stringify([
    textPart(patch.name, "en"),
    textPart(patch.name, "fr"),
    patch.legend === null ? null : [textPart(patch.legend, "en"), textPart(patch.legend, "fr")],
    patch.tags,
    patch.parents,
    patch.relations.map((r) => [r.kind, r.ref]),
  ]);
}

/** The screen as it is stored, expressed as the patch a no-op save produces —
 *  which is what lets the dirty gate compare like with like. */
function stored(screen: Screen): ScreenMetaPatch {
  return {
    name: screen.name,
    legend: screen.legend ?? null,
    tags: screen.tags ?? [],
    parents: screen.parents ?? [],
    relations: screen.relations ?? [],
  };
}

/**
 * Pure. The Meta form → the fields to write, or "nothing changed".
 *
 * Dirty-gated: opening a screen and saving it untouched must write nothing at
 * all — the author walks this library with prev/next, and a save on every stop
 * would rewrite a hundred and seventy documents for no reason.
 *
 * A blank name is REFUSED rather than defaulted. `buildPlantMetaPatch` refuses
 * one because a nameless plant is a public claim rendered wrongly; a nameless
 * screen is worse in a different way — it is a screen that cannot be found
 * again in a library of a hundred and seventy, and the image is the only thing
 * left to identify it by.
 *
 * The relations rule is the one to read twice. This form owns exactly ONE kind,
 * `shows`, and every other kind is carried through verbatim. The import wrote
 * `{ kind: "cover" }` on the eight screens the landing row already uses, and
 * that relation is the mapping the covers-become-refs slice depends on — so a
 * relations editor that replaced the array wholesale would silently delete the
 * thing a later migration needs, with nothing on the page to say so.
 */
export function buildScreenMetaPatch(current: Screen, form: FormData): ScreenMetaResult {
  const get = (key: string) => String(form.get(key) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") return { ok: false, error: "a screen needs a name in at least one language" };

  const legend = composeText(get("legend"), get("legendFr"));
  const plant = get("plant");
  const bean = get("bean");

  // Every kind but `shows` survives untouched, in its stored position; the
  // author's pick replaces the existing `shows` where it stood, or is appended
  // when there was none. Order is preserved because the array is an author-
  // visible sequence everywhere else in this model.
  const others = (current.relations ?? []).filter((r) => r.kind !== "shows");
  const at = (current.relations ?? []).findIndex((r) => r.kind === "shows");
  const relations: Relation[] = [...others];
  if (bean) relations.splice(at === -1 ? relations.length : at, 0, { kind: "shows", ref: `${BEAN_PREFIX}${bean}` });

  const patch: ScreenMetaPatch = {
    name,
    legend: legend === "" ? null : legend,
    tags: parseTags(get("tags")),
    parents: plant ? [`plant:${plant}`] : [],
    relations,
  };

  return canonical(patch) === canonical(stored(current))
    ? { ok: true, dirty: false }
    : { ok: true, dirty: true, patch };
}

export interface ScreenMetaUpdate {
  $set: Record<string, unknown>;
  $unset?: Record<string, "">;
}

/**
 * Pure. The Mongo update document — split out of the writer because getting
 * this shape wrong is SILENT.
 *
 * `plantMetaUpdate` learned that the expensive way: composing `$set` and
 * `$unset` with a spread produces an object literal with two `$set` keys, the
 * later one wins, and the write drops fields with no error anywhere. TypeScript
 * does not flag a duplicate key introduced by a spread. So the fields
 * accumulate into ONE `$set` and `$unset` is added beside it — the two
 * operators are legal together; two `$set`s are not.
 *
 * Three fields clear rather than store empty, which is `createScreen`'s
 * omission discipline continued into the edit path: an absent optional field
 * has ONE representation in the database, so the gallery's future "has a
 * caption" filter has one thing to check.
 */
export function screenMetaUpdate(patch: ScreenMetaPatch): ScreenMetaUpdate {
  const $set: Record<string, unknown> = { name: patch.name, parents: patch.parents };
  const $unset: Record<string, ""> = {};

  if (patch.legend === null) $unset.legend = "";
  else $set.legend = patch.legend;

  if (patch.tags.length === 0) $unset.tags = "";
  else $set.tags = patch.tags;

  if (patch.relations.length === 0) $unset.relations = "";
  else $set.relations = patch.relations;

  return Object.keys($unset).length > 0 ? { $set, $unset } : { $set };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "screen-edit|^# (pass|fail)"`
Expected: all fifteen pass; `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/screen-edit.ts lib/screen-edit.test.ts
git commit -m "A screen's metadata patch, and the update document that carries it"
```

---

## Task 5: `lib/screen-create.ts` — the create form's input

**Files:**
- Create: `lib/screen-create.ts`
- Create: `lib/screen-create.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/screen-create.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildNewScreenInput } from "./screen-create";

const IMAGE: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/abc",
  url: "https://res.cloudinary.com/x/image/upload/v1/abc.png",
  width: 1179,
  height: 2556,
};

function form(fields: Record<string, string>, withImage = true): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (withImage) {
    fd.set("image__ready", "1");
    fd.append("image", JSON.stringify(IMAGE));
  }
  return fd;
}

test("a complete form yields the input createScreen wants", () => {
  const result = buildNewScreenInput(form({ slug: "karma-top", name: "Karma top", plant: "paulopus" }));
  assert.deepEqual(result, {
    ok: true,
    input: { slug: "karma-top", name: "Karma top", image: IMAGE, plantSlug: "paulopus" },
  });
});

test("a blank name falls back to the slug, derived the import's way", () => {
  const result = buildNewScreenInput(form({ slug: "match-hero-m104", name: "", plant: "" }));
  assert.equal(result.ok && result.input.name, "Match hero m104");
  assert.equal(result.ok && result.input.plantSlug, null);
});

test("a missing slug is refused", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "", name: "x" })), {
    ok: false,
    error: "a screen needs a slug",
  });
});

test("a slug that is not kebab-case is refused, and the message says what is allowed", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "Karma Top" })), {
    ok: false,
    error: "a slug is lowercase letters, digits and hyphens: Karma Top",
  });
});

test("a form the picker never mounted in is refused", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "karma-top" }, false)), {
    ok: false,
    error: "add an image — the picker needs script to run",
  });
});

test("a mounted picker with no image is refused with its own message", () => {
  const fd = form({ slug: "karma-top" }, false);
  fd.set("image__ready", "1");
  assert.deepEqual(buildNewScreenInput(fd), { ok: false, error: "add an image" });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "screen-create"`
Expected: FAIL — `Cannot find module './screen-create'`.

- [ ] **Step 3: Write `lib/screen-create.ts`**

```ts
import type { NewScreen } from "./botanical";
import { readImageField } from "./screen-image";
import { screenNameFromStem } from "./screen-name";

export type NewScreenResult = { ok: false; error: string } | { ok: true; input: NewScreen };

// The pattern lib/articles.ts, lib/federation.ts and lib/pollen.ts each already
// carry. Copied rather than shared for the reason those three are: a slug rule
// belongs to the door that admits the slug, and one of these doors changing its
// mind must not silently change the others.
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Pure. The create form → the record `createScreen` inserts.
 *
 * This is the one form in the admin that holds the media picker AND text
 * inputs, and it is a decision rather than an oversight. The picker's two rules
 * — inert rather than destructive, and no edit ever depending on the island —
 * are about forms that change a record that already exists. Script-off this
 * form renders its fields, renders no button (the button is inside the island),
 * and creates nothing. Nothing is lost, because nothing existed.
 *
 * The two text inputs are load-bearing, incidentally: a LONE text input in a
 * button-less form submits on Enter, which is the trap the bean Keyword form
 * documents. With two there is no implicit submission at all — and the marker
 * check below refuses the payload regardless.
 *
 * `capturedAt` is deliberately not here. It is the current date, which is not a
 * pure function of the form, so the action supplies it — this module stays
 * testable without a clock.
 *
 * The name falls back to `screenNameFromStem`, the SAME function the import
 * derives its hundred and seventy names with, so a screen added by hand and a
 * screen added by the script are named by one rule.
 */
export function buildNewScreenInput(form: FormData): NewScreenResult {
  const get = (key: string) => String(form.get(key) ?? "").trim();

  const slug = get("slug");
  if (!slug) return { ok: false, error: "a screen needs a slug" };
  if (!SLUG.test(slug)) {
    return { ok: false, error: `a slug is lowercase letters, digits and hyphens: ${slug}` };
  }

  const { ready, image } = readImageField(form);
  // Two messages, not one. "The picker never mounted" and "you did not pick a
  // file" are different events with different fixes, and an author who has
  // script disabled deserves to be told that rather than left staring at a
  // field they did fill in.
  if (!ready) return { ok: false, error: "add an image — the picker needs script to run" };
  if (image === null) return { ok: false, error: "add an image" };

  const plant = get("plant");
  const name = get("name");

  return {
    ok: true,
    input: {
      slug,
      name: name || screenNameFromStem(slug),
      image,
      plantSlug: plant || null,
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "screen-create|^# (pass|fail)"`
Expected: six passes, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/screen-create.ts lib/screen-create.test.ts
git commit -m "The create form's input, named the import's way when left blank"
```

---

## Task 6: `cloudinaryFit` — shrink to a width, no crop

**Files:**
- Modify: `lib/image-url.ts`
- Modify: `lib/image-url.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/image-url.test.ts`:

```ts
test("cloudinaryFit scales to a width without cropping", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v1/a.png";
  assert.equal(
    cloudinaryFit(url, { width: 480 }),
    "https://res.cloudinary.com/demo/image/upload/w_480,c_limit,q_auto,f_auto/v1/a.png",
  );
});

test("cloudinaryFit leaves a non-Cloudinary URL untouched", () => {
  assert.equal(cloudinaryFit("https://example.test/a.png", { width: 480 }), "https://example.test/a.png");
});

test("cloudinaryFit is idempotent — no stacked transform", () => {
  const once = cloudinaryFit("https://res.cloudinary.com/demo/image/upload/v1/a.png", { width: 480 });
  assert.equal(cloudinaryFit(once, { width: 240 }), once);
});

test("cloudinaryFit leaves a malformed value alone rather than throwing", () => {
  assert.equal(cloudinaryFit("not a url", { width: 480 }), "not a url");
});
```

Add `cloudinaryFit` to the file's existing import from `./image-url`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "cloudinaryFit"`
Expected: FAIL — `cloudinaryFit is not a function`.

- [ ] **Step 3: Refactor `lib/image-url.ts` around a shared helper**

Replace the body of `cloudinaryThumb` so that the host, marker and idempotency
guards live in one internal function, and add `cloudinaryFit` beside it. Keep
every existing comment where it is — they explain guards that have not changed.

```ts
/**
 * Insert a transformation segment into a Cloudinary delivery URL, or return the
 * URL untouched.
 *
 * Extracted when a second caller needed the same four guards with a different
 * transform. The guards are the whole of the risk here — host, delivery marker,
 * version segment, idempotency — so they are written once and both public
 * functions below are one string each.
 */
function withTransform(url: string, transform: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // not a URL at all — never throw on a malformed stored value
  }

  if (parsed.hostname !== "res.cloudinary.com") return url;

  const marker = "/image/upload/";
  const markerIndex = parsed.pathname.indexOf(marker);
  if (markerIndex === -1) return url;

  const head = parsed.pathname.slice(0, markerIndex + marker.length);
  const tail = parsed.pathname.slice(markerIndex + marker.length);
  const firstSegment = tail.split("/", 1)[0] ?? "";

  if (!isVersionSegment(firstSegment) && looksLikeTransform(firstSegment)) return url;

  parsed.pathname = `${head}${transform}/${tail}`;
  return parsed.toString();
}

export function cloudinaryThumb(url: string, opts: { width: number; height: number }): string {
  return withTransform(url, `w_${opts.width},h_${opts.height},c_fill,q_auto,f_auto`);
}

/**
 * Shrink to a WIDTH, preserving the aspect ratio — `c_limit`, which also never
 * enlarges an image that is already smaller.
 *
 * A separate export rather than an options union on `cloudinaryThumb`, because
 * the two intents genuinely differ: that one crops an image INTO a box (a
 * square avatar, a phone-shaped cover), and a caller who wants a box wants the
 * crop. This one is for the screen library's contact sheet, where cropping is
 * the one thing that must not happen — a 9:19.5 phone capture squeezed into a
 * square by `c_fill` is a picture of somebody's middle third, and the entire
 * point of a contact sheet is finding a screen by looking at it.
 */
export function cloudinaryFit(url: string, opts: { width: number }): string {
  return withTransform(url, `w_${opts.width},c_limit,q_auto,f_auto`);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "cloudinary|^# (pass|fail)"`
Expected: the new four pass and every existing `cloudinaryThumb` test still passes; `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/image-url.ts lib/image-url.test.ts
git commit -m "cloudinaryFit: shrink to a width, because a contact sheet must not crop"
```

---

## Task 7: The Mongo writers

**Files:**
- Modify: `lib/botanical.ts`
- Modify: `lib/botanical.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/botanical.test.ts`, matching the file's existing `{ skip: !hasDb }`
gate and its `__test__` slug convention (read the neighbouring `createScreen`
test first and copy its setup and cleanup exactly).

```ts
test("updateScreenMeta writes the named fields and clears the empty ones", { skip: !hasDb }, async () => {
  const slug = "__test__screen-meta";
  await cleanupScreen(slug);
  await createScreen({
    slug,
    name: "Before",
    image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
    plantSlug: "__test__plant",
    legend: "gone soon",
    tags: ["a"],
  });

  await updateScreenMeta(slug, {
    name: { en: "After", fr: "Après" },
    legend: null,
    tags: [],
    parents: [],
    relations: [{ kind: "shows", ref: "bean:b" }],
  });

  const stored = await getScreen(slug);
  assert.deepEqual(stored?.name, { en: "After", fr: "Après" });
  assert.equal("legend" in (stored ?? {}), false);
  assert.equal("tags" in (stored ?? {}), false);
  assert.deepEqual(stored?.parents, []);
  assert.deepEqual(stored?.relations, [{ kind: "shows", ref: "bean:b" }]);
  // Untouched by this writer, and that is the promise it makes.
  assert.equal(stored?.image.storageKey, "k");
  assert.equal(stored?.visibility, "private");

  await cleanupScreen(slug);
});

test("updateScreenImage replaces only the image", { skip: !hasDb }, async () => {
  const slug = "__test__screen-image";
  await cleanupScreen(slug);
  await createScreen({
    slug,
    name: "Shot",
    image: { kind: "image", storageKey: "old", url: "https://x.test/old.png" },
    plantSlug: null,
  });

  await updateScreenImage(slug, {
    kind: "image",
    storageKey: "new",
    url: "https://x.test/new.png",
    width: 10,
    height: 20,
  });

  const stored = await getScreen(slug);
  assert.equal(stored?.image.storageKey, "new");
  assert.equal(stored?.image.height, 20);
  assert.equal(resolveText(stored?.name ?? ""), "Shot");

  await cleanupScreen(slug);
});

test("deleteScreen removes the document and is idempotent", { skip: !hasDb }, async () => {
  const slug = "__test__screen-delete";
  await cleanupScreen(slug);
  await createScreen({
    slug,
    name: "Doomed",
    image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
    plantSlug: null,
  });

  await deleteScreen(slug);
  assert.equal(await getScreen(slug), null);
  await deleteScreen(slug); // a second delete is a no-op, not an error
});

test("listScreens returns the collection with no _id", { skip: !hasDb }, async () => {
  const slug = "__test__screen-list";
  await cleanupScreen(slug);
  await createScreen({
    slug,
    name: "Listed",
    image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
    plantSlug: null,
  });

  const all = await listScreens();
  const mine = all.find((s) => s.slug === slug);
  assert.ok(mine);
  assert.equal("_id" in mine, false);

  await cleanupScreen(slug);
});
```

Add a `cleanupScreen` helper beside the file's existing cleanup helpers:

```ts
async function cleanupScreen(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection("screens").deleteMany({ slug });
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:db 2>&1 | grep -E "screen|^# (pass|fail)"`
Expected: FAIL — `updateScreenMeta is not exported`. (If `hasDb` is false the
tests skip; ask the user for `.env.local` before continuing, since this task
cannot be verified without it.)

- [ ] **Step 3: Add the writers to `lib/botanical.ts`**

Place them directly after `createScreen`, and import `ScreenMetaPatch` and
`screenMetaUpdate` at the top of the file.

```ts
/** Every screen, slug-ordered. The admin's list read — `/admin/screens` is the
 *  only surface that sees them, since every screen is private at birth. */
export async function listScreens(): Promise<Screen[]> {
  const db = await getDb();
  return db.collection<Screen>("screens").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

/** Single read for the edit page's prefill (projection drops _id) —
 *  `getSprout`'s shape, one species over. */
export async function getScreen(slug: string): Promise<Screen | null> {
  const db = await getDb();
  return db.collection<Screen>("screens").findOne({ slug }, { projection: { _id: 0 } });
}

/**
 * Writes a screen's name, legend, tags, parents and relations — and nothing
 * else.
 *
 * A SIBLING of updatePlantMeta, down to the reason its update document is built
 * elsewhere: `screenMetaUpdate` is pure and tested because composing `$set` and
 * `$unset` inline with a spread silently drops fields (see `plantMetaUpdate`'s
 * comment, which is that bug's headstone).
 *
 * `image` is NOT among the fields, and that is the whole safety of the arrangement:
 * the Meta form and the picker form are separate forms on the same page, so a
 * metadata save can never blank an image and an image save can never blank a name.
 */
export async function updateScreenMeta(slug: string, patch: ScreenMetaPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection<Screen>("screens")
    .updateOne({ slug }, screenMetaUpdate(patch) as UpdateFilter<Screen>);
}

/**
 * Writes a screen's image — and nothing else.
 *
 * A plain `$set` with no `$unset` twin, unlike `updateBeanCover` and
 * `updatePlantLogo`: `Screen.image` is required, so there is no clear to
 * express. That is also why this is not the fourth copy of the `$set`/`$unset`
 * shape `updateBeanCover`'s comment warns about — it is half of it.
 */
export async function updateScreenImage(slug: string, image: MediaImage): Promise<void> {
  const db = await getDb();
  await db.collection<Screen>("screens").updateOne({ slug }, { $set: { image } });
}

/**
 * Hard delete. Idempotent — deleting a missing slug matches 0 and is a no-op.
 *
 * The DOCUMENT only. The Cloudinary asset stays, deliberately: until covers
 * become screen references, a bean's `cover` holds its own inline copy of the
 * same asset, so deleting the bytes here would break the landing row. An asset
 * nothing points at any more is `npm run check:orphans`'s to sweep, and
 * lib/orphan-assets.ts already counts `screens.image` among the four homes a
 * storageKey can have — so an asset a bean still uses is correctly reported as
 * referenced and left alone.
 */
export async function deleteScreen(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<Screen>("screens").deleteOne({ slug });
}
```

- [ ] **Step 4: Run the DB tests**

Run: `npm run test:db 2>&1 | tail -8`
Expected: `# fail 0`, with the four new screen tests passing.

- [ ] **Step 5: Run the unit suite and typecheck**

Run: `npm test 2>&1 | tail -3 && npx tsc --noEmit`
Expected: `# fail 0`, and no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/botanical.ts lib/botanical.test.ts
git commit -m "Screen writers: read, meta, image, delete — each naming its fields"
```

---

## Task 8: The server actions

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add the imports**

At the top of `app/admin/actions.ts`, extend the existing `@/lib/botanical`
import with `createScreen`, `getScreen`, `updateScreenMeta`, `updateScreenImage`,
`deleteScreen`, and add:

```ts
import { buildScreenMetaPatch } from "@/lib/screen-edit";
import { buildScreenImagePatch } from "@/lib/screen-image";
import { buildNewScreenInput } from "@/lib/screen-create";
import { screensHref, screensQuery } from "@/lib/screens";
```

- [ ] **Step 2: Add the four actions at the end of the file, before `uploadImageAction`**

```ts
/**
 * The library's write paths.
 *
 * All four share one arrangement worth naming once. Each form carries the
 * index's active filters in a hidden `q` field and each action redirects back
 * through it, so a save does not drop the author out of the filtered set they
 * were working through — they are walking a hundred and seventy screens with
 * prev/next, and losing the filter on the first save would send them back to
 * the top of the whole collection.
 *
 * That field is client-controlled, so it is re-canonicalized by `screensQuery`
 * rather than concatenated: whatever arrives, only `plant`, `bean` and `tag`
 * survive, and `screensHref` is the only thing that builds the URL. A hidden
 * field reaching `redirect()` intact would be an open redirect; one that can
 * only ever produce three known keys on a known path is not.
 */
async function screenBack(formData: FormData): Promise<string> {
  return screensQuery({
    plant: String(formData.get("q_plant") ?? ""),
    bean: String(formData.get("q_bean") ?? ""),
    tag: String(formData.get("q_tag") ?? ""),
  });
}

export async function createScreenAction(formData: FormData): Promise<void> {
  await requireSession();
  const query = await screenBack(formData);

  const result = buildNewScreenInput(formData);
  if (!result.ok) redirect(`/admin/screens/new${query ? `?${query}&` : "?"}error=${encodeURIComponent(result.error)}`);

  try {
    await createScreen({
      ...result.input,
      // Not in the pure builder: it is a clock, and the builder is tested
      // without one. The list sorts on this, so a new screen lands at the top
      // of the library rather than at the bottom under an empty date.
      capturedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    if (err instanceof SlugExistsError) {
      redirect(
        `/admin/screens/new${query ? `?${query}&` : "?"}error=${encodeURIComponent(`that slug is taken: ${result.input.slug}`)}`,
      );
    }
    throw err;
  }

  revalidatePath("/admin/screens");
  redirect(screensHref(result.input.slug, query));
}

export async function editScreenMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = await screenBack(formData);

  // Existence first, so every redirect below targets a real page and only ever
  // interpolates a known-good stored slug.
  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  const result = buildScreenMetaPatch(existing, formData);
  if (!result.ok) redirect(screensHref(slug, query, result.error));
  if (result.dirty) await updateScreenMeta(slug, result.patch);

  revalidatePath("/admin/screens");
  redirect(screensHref(slug, query));
}

/**
 * The screen's image — the one client-island write in this slice. Its form is
 * nothing BUT the picker, so the picker renders the submit button and
 * script-off there is no button at all: inert rather than destructive, which is
 * the rule CLAUDE.md states. buildScreenImagePatch enforces the same thing
 * server-side for a POST that never rendered one.
 */
export async function editScreenImageAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = await screenBack(formData);

  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  const result = buildScreenImagePatch(existing, formData);
  if (result.dirty) await updateScreenImage(slug, result.image);

  revalidatePath("/admin/screens");
  redirect(screensHref(slug, query));
}

/**
 * Hard delete, behind a confirm checkbox re-checked here — `deleteVersionAction`'s
 * shape, because the browser's `required` is only UX and this is the one
 * irreversible act in the library.
 */
export async function deleteScreenAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = await screenBack(formData);

  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect(screensHref(slug, query, "could not delete: confirm the permanent deletion first"));
  }

  await deleteScreen(slug);

  revalidatePath("/admin/screens");
  redirect(screensHref(null, query));
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `SlugExistsError` is not yet imported in this file, add
it to the `@/lib/botanical` import.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts
git commit -m "The library's four write paths, each redirecting through the author's filters"
```

---

## Task 9: The fifth section

**Files:**
- Modify: `lib/admin-nav.ts`
- Modify: `lib/admin-nav.test.ts`
- Modify: `app/admin/_components/admin-chrome.tsx`

- [ ] **Step 1: Write the failing test**

Append to `lib/admin-nav.test.ts`:

```ts
test("Screens is a section, and its children light it", () => {
  assert.equal(resolveNavItem("/admin/screens"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/karma-top"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/new"), "/admin/screens");
});

test("the library is a wide column and a screen is a reading one", () => {
  assert.equal(resolveColumn("/admin/screens"), "wide");
  assert.equal(resolveColumn("/admin/screens/karma-top"), "reading");
  assert.equal(resolveColumn("/admin/screens/new"), "reading");
});

// The SECTIONS comment says no prefix is a prefix of another, and a singular
// /admin/screen route — the shape every other species uses — would make that
// false. The boundary check is what actually protects it, so pin the behaviour
// rather than the comment.
test("a would-be /admin/screen route does not light Screens", () => {
  assert.equal(resolveNavItem("/admin/screenshots"), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "Screens is a section"`
Expected: FAIL — `resolveNavItem("/admin/screens")` returns `null`.

- [ ] **Step 3: Extend `lib/admin-nav.ts`**

Add to `NAV_ITEMS`, after Beanstalk:

```ts
  { href: "/admin/screens", label: "Screens" },
```

Add to `SECTIONS`:

```ts
  // One entry covers the index and both children (/[slug] and /new) — the
  // boundary check below is what makes that safe, and it is also what would
  // keep a future singular "/admin/screen" out of this section despite being a
  // string prefix of it. The comment above ("no prefix here is a prefix of
  // another") is now one route away from being false; this is the line that
  // does not care.
  ["/admin/screens", "/admin/screens"],
```

- [ ] **Step 4: Add the rail icon**

In `app/admin/_components/admin-chrome.tsx`, add `Images` to the `lucide-react`
import and add to `ICONS`:

```ts
  "/admin/screens": Images,
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npm test 2>&1 | tail -3 && npx tsc --noEmit`
Expected: `# fail 0`, no type errors. If any existing test asserts
`NAV_ITEMS.length === 4` or counts palette sections, update it to 5 — the fifth
section is the change, and a count assertion is what should notice it.

- [ ] **Step 6: Commit**

```bash
git add lib/admin-nav.ts lib/admin-nav.test.ts app/admin/_components/admin-chrome.tsx
git commit -m "Screens becomes the fifth section: rail icon, wide column, palette row"
```

---

## Task 10: `AdminFilters` — one filter bar, two pages

**Files:**
- Create: `app/admin/_components/admin-filters.tsx` (from `vault-filters.tsx`)
- Delete: `app/admin/_components/vault-filters.tsx`
- Modify: `app/admin/vault/page.tsx`

- [ ] **Step 1: Move the file**

```bash
git mv app/admin/_components/vault-filters.tsx app/admin/_components/admin-filters.tsx
```

- [ ] **Step 2: Rename the component and add the `bean` dimension**

In `app/admin/_components/admin-filters.tsx`:

1. Rename `export function VaultFilters` → `export function AdminFilters`.
2. Extend the `FilterGroup["key"]` union: `"state" | "plant" | "bean" | "tag"`.
3. Add `Bean` to the `lucide-react` import and add the dimension:

```ts
const DIMENSIONS = {
  state: { icon: CircleDot, hotkey: "S" },
  plant: { icon: Sprout, hotkey: "P" },
  bean: { icon: Bean, hotkey: "B" },
  tag: { icon: Tag, hotkey: "T" },
} as const satisfies Record<
  FilterGroup["key"],
  { icon: ComponentType<{ className?: string }>; hotkey: string }
>;
```

4. Update the doc comment's first line to say what it is now:

```
/**
 * The admin's filter dimensions, collapsed into popovers — the vault's three
 * and the screen library's three, from one file.
 *
 * A container and nothing more: every option inside is the same <a href> the
 * page used to render inline, built by lib/admin-filters.ts's filterHref, so
 * filtering stays server-side and a filter URL stays shareable. ...
```

(Keep the rest of the existing comment verbatim — the hotkey and `trap-focus`
reasoning is unchanged.)

- [ ] **Step 3: Point the vault page at it**

In `app/admin/vault/page.tsx`:

1. Replace the import with
   `import { AdminFilters, type FilterGroup } from "../_components/admin-filters";`
   and add `import { filterHref } from "@/lib/admin-filters";`
2. Delete the local `vaultHref` function and the `Active` type.
3. Build the groups with the shared helper:

```tsx
const VAULT_KEYS = ["state", "plant", "tag"] as const;

// ...inside the component:
const groups: FilterGroup[] = (
  [
    ["state", STATE_OPTIONS],
    ["plant", plantOptions],
    ["tag", tagOptions],
  ] as const
).map(([key, options]) => ({
  key,
  options,
  current: active[key] ?? "all",
  hrefs: options.map((opt) => filterHref("/admin/vault", active, VAULT_KEYS, key, opt)),
}));
```

4. Rename the JSX usage: `<VaultFilters groups={groups} />` → `<AdminFilters groups={groups} />`.

- [ ] **Step 4: Verify the vault still filters**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: no type errors, `# fail 0`.

Run: `npm run dev` and open `http://localhost:3333/admin/vault`. Check that the
three filter buttons open, that choosing a plant narrows the table, that the URL
carries `?plant=…`, and that `s`/`p`/`t` still open the popovers. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A app/admin/_components app/admin/vault/page.tsx
git commit -m "One filter bar for two pages, with a bean dimension for the library"
```

---

## Task 11: The library index

**Files:**
- Create: `app/admin/screens/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { loadRawGarden } from "@/lib/store";
import { cloudinaryFit } from "@/lib/image-url";
import { filterHref } from "@/lib/admin-filters";
import { resolveText } from "@/lib/data";
import {
  SCREEN_FILTER_KEYS,
  distinctScreenBeans,
  distinctScreenPlants,
  distinctScreenTags,
  filterScreens,
  screenRows,
  screensQuery,
  type ScreenRow,
} from "@/lib/screens";
import { EntityAvatarGlyph, type EntityMark } from "@/components/admin/glyphs";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * The screen library — a CONTACT SHEET rather than a table.
 *
 * A hundred and seventy rows of `match-hero-m104-final-spain-argentina-aet` are
 * not scannable by eye, and those names are honest filename stems precisely
 * because nobody was ever going to write a hundred and seventy titles. So the
 * page shows the screens themselves, and the name is the caption.
 *
 * Every tile is a `next/link`, which is the first one in this repo — every
 * other navigation in both zones is a plain <a href>. It renders the same real
 * anchor, so the no-script path is byte-identical; what it adds is the
 * client-side navigation that lets `app/admin/@sheet/(.)screens/[slug]`
 * intercept the click and open the editors in the side sheet WITHOUT
 * re-rendering this page. That is what keeps the grid, and the author's scroll
 * position, exactly where they were.
 */
export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: ScreenRow[] | null = null;
  let plantMarks = new Map<string, EntityMark>();
  try {
    const raw = await loadRawGarden();
    all = screenRows(raw.screens ?? []);
    plantMarks = new Map(
      (raw.plants ?? []).map((plant) => [
        plant.slug,
        {
          name: resolveText(plant.name),
          hint: plant.slug,
          ...(plant.logo ? { logoUrl: plant.logo.url } : {}),
        },
      ]),
    );
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Screens</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the screens.</AlertDescription>
        </Alert>
      </article>
    );
  }

  const rows = filterScreens(all, active);
  const query = screensQuery(active);

  const groups: FilterGroup[] = (
    [
      ["plant", ["all", ...distinctScreenPlants(all)]],
      ["bean", ["all", ...distinctScreenBeans(all)]],
      ["tag", ["all", ...distinctScreenTags(all)]],
    ] as const
  ).map(([key, options]) => ({
    key,
    options,
    current: active[key] ?? "all",
    hrefs: options.map((opt) => filterHref("/admin/screens", active, SCREEN_FILTER_KEYS, key, opt)),
  }));

  return (
    <article className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Screens</h1>
        {/* A link, not a button that opens something: the create form is a page
            (`/admin/screens/new`) that the sheet merely presents. */}
        <Link
          href={query ? `/admin/screens/new?${query}` : "/admin/screens/new"}
          aria-label="New screen"
          className="rounded-lg px-2 py-0.5 text-xl leading-none text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          +
        </Link>
      </div>

      <AdminFilters groups={groups} />

      <p className="text-sm text-muted-foreground">
        showing {rows.length} of {all.length}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {all.length === 0
            ? "No screens yet — run npm run import:screens, or add one."
            : "No screens match these filters."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                href={query ? `/admin/screens/${row.slug}?${query}` : `/admin/screens/${row.slug}`}
                /* The hook the open panel marks itself with — see
                   app/admin/@sheet/(.)screens/[slug]/page.tsx. This page is
                   never re-rendered while the panel navigates (that is what
                   interception buys), so it cannot know which tile is open and
                   the panel says so instead. */
                data-screen-tile={row.slug}
                className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {/* object-contain, not cover: a 9:19.5 phone capture cropped
                    into a box is a picture of its middle third, and finding a
                    screen by looking at it is the entire point of this page. */}
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border bg-muted/40 transition-colors group-hover:border-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cloudinaryFit(row.url, { width: 480 })}
                    alt={row.alt}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm">{row.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.plant ? (
                      <EntityAvatarGlyph
                        mark={plantMarks.get(row.plant) ?? { name: row.plant, hint: row.plant }}
                      />
                    ) : null}
                    {row.bean ? (
                      <Badge variant="secondary" className="max-w-full truncate">
                        {row.bean}
                      </Badge>
                    ) : null}
                    {row.isCover ? <Badge variant="outline">cover</Badge> : null}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Run `npm run dev`, open `http://localhost:3333/admin/screens`. Expected: the
grid of imported screens, the `Screens` rail icon lit, the three filter buttons
opening on click and on `p`/`b`/`t`, the count line correct, and a filter click
narrowing the grid with the filter in the URL. Tile clicks 404 for now (Task 12
adds the route). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/admin/screens/page.tsx
git commit -m "The library: a contact sheet, filtered server-side"
```

---

## Task 12: A screen's page and its three forms

**Files:**
- Create: `app/admin/_components/screen-meta-form.tsx`
- Create: `app/admin/_components/screen-image-form.tsx`
- Create: `app/admin/_components/screen-delete-form.tsx`
- Create: `app/admin/_components/screen-nav.tsx`
- Create: `app/admin/_components/sheet-keys.tsx`
- Create: `app/admin/screens/[slug]/page.tsx`

- [ ] **Step 1: The hidden filter fields, once**

Create `app/admin/_components/screen-nav.tsx`:

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { screensHref } from "@/lib/screens";
import { SheetKeys } from "./sheet-keys";
import { Button } from "@/components/ui/button";

/**
 * The panel's header: previous, next, close — all three real links.
 *
 * They are `next/link` so the panel swaps in place (interception), and they are
 * `<a href>` underneath so the standalone page navigates perfectly without
 * script. Nothing here is a click handler and nothing here is `router.back()`:
 * "back" would leave the library when the author arrived by URL, and a handler
 * would make the whole navigation script-dependent to save nothing.
 *
 * prev/next walk the FILTERED list — the hrefs are computed by the page from
 * the same rows the grid drew, so the arrows stay inside the set the author is
 * working through. A screen with no neighbour renders a disabled span rather
 * than a dead link.
 */
export function ScreenNav({
  prev,
  next,
  query,
}: {
  prev: string | null;
  next: string | null;
  query: string;
}) {
  const prevHref = prev ? screensHref(prev, query) : null;
  const nextHref = next ? screensHref(next, query) : null;
  const closeHref = screensHref(null, query);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Arrow href={prevHref} label="Previous screen">
          <ChevronLeft className="size-4" />
        </Arrow>
        <Arrow href={nextHref} label="Next screen">
          <ChevronRight className="size-4" />
        </Arrow>
      </div>

      <Button
        render={
          <Link href={closeHref} aria-label="Close">
            <X className="size-4" />
          </Link>
        }
        size="icon"
        variant="ghost"
      />

      <SheetKeys prev={prevHref} next={nextHref} close={closeHref} />
    </div>
  );
}

function Arrow({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-hidden className="flex size-8 items-center justify-center text-muted-foreground/40">
        {children}
      </span>
    );
  }
  return (
    <Button render={<Link href={href} aria-label={label}>{children}</Link>} size="icon" variant="ghost" />
  );
}
```

Create `app/admin/_components/sheet-keys.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";

/**
 * Escape closes, ← and → walk the list. Renders NOTHING.
 *
 * The vault filters' category of affordance, not an exception: every key here
 * is bound over an href that is already on the page as a link, so script-off
 * costs the KEYS and never a destination. It is given the hrefs rather than
 * computing them, so this file never learns the library's URL grammar.
 *
 * A bare single key defaults to `ignoreInputs: true` in @tanstack/react-hotkeys,
 * so none of these fire while the author is typing in the legend field.
 */
export function SheetKeys({
  prev,
  next,
  close,
}: {
  prev: string | null;
  next: string | null;
  close: string;
}) {
  const router = useRouter();

  useHotkey("Escape", () => router.push(close));
  useHotkey("ArrowLeft", () => { if (prev) router.push(prev); }, { enabled: prev !== null });
  useHotkey("ArrowRight", () => { if (next) router.push(next); }, { enabled: next !== null });

  return null;
}
```

- [ ] **Step 2: The three forms**

Create `app/admin/_components/screen-meta-form.tsx`:

```tsx
import { textPart, type Plant, type Bean, type Screen } from "@/lib/data";
import { editScreenMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";
import { resolveText } from "@/lib/data";
import { FilterFields } from "./filter-fields";

/**
 * A screen's identity: what it is called, what it says, where it sits, and what
 * it shows.
 *
 * An ORDINARY admin metadata form — zero client JS, native controls, a real
 * submit button, works with no script. That is still what every admin form but
 * the six documented exceptions is, and this one has no reason to join them.
 *
 * Separate from the Image card next door, and separate for the reason the bean
 * Keyword form documents: put a text input inside the picker's form and
 * script-off that form renders no button (the button is inside the island) but
 * DOES render the input — and a lone text input in a button-less form submits
 * on Enter, posting a payload with no `image__ready`. Two forms make that
 * impossible rather than survivable.
 *
 * Prefills use the STRICT `textPart`, never `resolveText`: the fallback would
 * copy the fr half into the en box and save it back as en, which is the trap
 * `plant-meta-form.tsx` documents. No `required` on the en inputs — an fr-only
 * name is valid, and the pair is validated as a whole server-side.
 */
export function ScreenMetaForm({
  screen,
  plants,
  beans,
  query,
}: {
  screen: Screen;
  plants: Plant[];
  beans: Bean[];
  query: string;
}) {
  const plant = (screen.parents ?? []).find((p) => p.startsWith("plant:"))?.slice("plant:".length) ?? "";
  const bean =
    (screen.relations ?? []).find((r) => r.kind === "shows" && r.ref.startsWith("bean:"))?.ref.slice("bean:".length) ??
    "";

  return (
    <form action={editScreenMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(screen.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(screen.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="legend">Legend</Label>
          <Input
            id="legend"
            type="text"
            name="legend"
            placeholder="the caption, when this screen earns one"
            defaultValue={textPart(screen.legend, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="legendFr">Legend (fr)</Label>
          <Input id="legendFr" type="text" name="legendFr" defaultValue={textPart(screen.legend, "fr")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          type="text"
          name="tags"
          placeholder="comma separated"
          defaultValue={(screen.tags ?? []).join(", ")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {/* Containment. The import set it and nothing else could change it,
              so a mis-parented screen had no way back — which is why this
              select exists even though the issue's field list did not name it. */}
          <Label htmlFor="plant">Plant</Label>
          <NativeSelect id="plant" name="plant" defaultValue={plant}>
            <option value="">— none —</option>
            {plants.map((p) => (
              <option key={p.slug} value={p.slug}>
                {resolveText(p.name)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          {/* Writes at most ONE `shows` relation. Every other kind the screen
              carries is passed through untouched by buildScreenMetaPatch —
              including the `{ kind: "cover" }` the import wrote on the eight
              screens the landing row uses, which is the mapping the
              covers-become-refs slice depends on. */}
          <Label htmlFor="bean">Shows</Label>
          <NativeSelect id="bean" name="bean" defaultValue={bean}>
            <option value="">— none —</option>
            {beans.map((b) => (
              <option key={b.slug} value={b.slug}>
                {resolveText(b.name)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
```

Create `app/admin/_components/filter-fields.tsx` (used by all four forms):

```tsx
/**
 * The author's active filters, round-tripped through a write.
 *
 * Three hidden fields rather than one, so nothing has to parse a query string
 * on the way back in; the action reads them by name and hands them to
 * `screensQuery`, which is what re-canonicalizes them into a URL. They are
 * client-controlled — that is why the action rebuilds the query from a known
 * key list rather than concatenating this back onto a path.
 *
 * Without them, the first save drops the author out of the filtered set they
 * were walking with prev/next and back to the top of all hundred and seventy.
 */
export function FilterFields({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  return (
    <>
      <input type="hidden" name="q_plant" value={params.get("plant") ?? ""} />
      <input type="hidden" name="q_bean" value={params.get("bean") ?? ""} />
      <input type="hidden" name="q_tag" value={params.get("tag") ?? ""} />
    </>
  );
}
```

Create `app/admin/_components/screen-image-form.tsx`:

```tsx
import type { Screen } from "@/lib/data";
import { editScreenImageAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { FilterFields } from "./filter-fields";

/**
 * The screen itself.
 *
 * The sprout media card's case, the plant Logo card's and the bean Cover
 * card's, a fourth time and not a new one: the form is nothing BUT the picker,
 * so the picker renders the submit button (`submitLabel`) and a script-off
 * browser sees no button at all — inert rather than destructive, which is
 * CLAUDE.md's rule verbatim. buildScreenImagePatch enforces the same thing
 * server-side for a POST that never rendered a button.
 *
 * What differs from those three: this one cannot CLEAR. `Screen.image` is
 * required, so an emptied picker writes nothing rather than unsetting the
 * field — see lib/screen-image.ts.
 */
export function ScreenImageForm({ screen, query }: { screen: Screen; query: string }) {
  return (
    <form action={editScreenImageAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />
      {/* The key re-seeds the island after a save, for plant-logo-form.tsx's
          reason: MediaPicker reads `initial` ONCE, in its useState initializer,
          so without this React reconciles the same instance after the action
          redirects and the picker keeps showing its own local state rather than
          what the database now holds. `links` is omitted — a screen is an
          image, never an embed. */}
      <MediaPicker
        key={JSON.stringify(screen.image)}
        name="image"
        initial={[screen.image]}
        max={1}
        submitLabel="Save image"
      />
    </form>
  );
}
```

Create `app/admin/_components/screen-delete-form.tsx`:

```tsx
import type { Screen } from "@/lib/data";
import { deleteScreenAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";
import { FilterFields } from "./filter-fields";

/**
 * The one irreversible act in the library — `deleteVersionAction`'s shape, down
 * to the confirm checkbox the action re-checks server-side because the
 * browser's `required` is only UX.
 *
 * The DOCUMENT goes; the Cloudinary asset stays. That is stated on the card
 * rather than left to be reasoned about, because until covers become screen
 * references a bean's cover holds its own inline copy of the same asset — so
 * deleting the bytes here would break the landing row, and an unreferenced
 * asset is `npm run check:orphans`'s to sweep.
 */
export function ScreenDeleteForm({
  screen,
  isCover,
  query,
}: {
  screen: Screen;
  isCover: boolean;
  query: string;
}) {
  return (
    <form action={deleteScreenAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      {isCover ? (
        <p className="text-sm text-muted-foreground">
          This screen is a bean&rsquo;s cover. The cover holds its own copy of the image, so it
          keeps working — but the library loses the record of which image that is.
        </p>
      ) : null}

      <ChoiceLabel htmlFor="confirm" className="items-start gap-2.5">
        <NativeCheckbox id="confirm" name="confirm" required className="mt-0.5" />
        <span className="text-sm">
          Yes, permanently delete this screen. The stored image is not deleted.
        </span>
      </ChoiceLabel>

      <div>
        <Button type="submit" variant="destructive">
          Delete screen
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: The page**

Create `app/admin/screens/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { loadRawGarden } from "@/lib/store";
import { resolveText } from "@/lib/data";
import { cloudinaryFit } from "@/lib/image-url";
import { filterScreens, neighbours, screenRows, screensQuery } from "@/lib/screens";
import { ScreenNav } from "@/app/admin/_components/screen-nav";
import { ScreenMetaForm } from "@/app/admin/_components/screen-meta-form";
import { ScreenImageForm } from "@/app/admin/_components/screen-image-form";
import { ScreenDeleteForm } from "@/app/admin/_components/screen-delete-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * One screen, with everything that edits it.
 *
 * THIS COMPONENT IS ALSO THE SIDE SHEET'S BODY — `app/admin/@sheet/(.)screens/[slug]/page.tsx`
 * renders this very module inside the panel. That is the whole reason the panel
 * costs no exception in CLAUDE.md's list: there is nothing in the sheet that is
 * not a page, so script-off the same click is an ordinary navigation here and
 * every field still works. Keep the two identical; a divergence is a no-script
 * hole.
 *
 * prev/next are computed from the FILTERED rows, so the arrows walk the set the
 * author is looking at rather than the whole collection.
 */
export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  const { slug } = await params;
  const active = await searchParams;

  const raw = await loadRawGarden();
  const screen = (raw.screens ?? []).find((s) => s.slug === slug);
  if (!screen) notFound();

  const query = screensQuery(active);
  const rows = filterScreens(screenRows(raw.screens ?? []), active);
  const { prev, next } = neighbours(rows, slug);
  const isCover = (screen.relations ?? []).some((r) => r.kind === "cover");

  return (
    <div className="flex flex-col gap-6">
      <ScreenNav prev={prev} next={next} query={query} />

      {active.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{active.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-medium tracking-tight">
          {resolveText(screen.name)}
        </h1>
        <p className="font-heading text-xs text-muted-foreground">{screen.slug}</p>
      </div>

      <div className="flex justify-center rounded-lg border bg-muted/40 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cloudinaryFit(screen.image.url, { width: 720 })}
          alt={screen.image.alt ?? ""}
          className="max-h-[50vh] w-auto object-contain"
        />
      </div>

      <Card>
        <CardContent>
          <ScreenMetaForm
            screen={screen}
            plants={raw.plants ?? []}
            beans={raw.beans ?? []}
            query={query}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ScreenImageForm screen={screen} query={query} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ScreenDeleteForm screen={screen} isCover={isCover} query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify end to end**

Run: `npx tsc --noEmit && npm run dev`

In the browser at `http://localhost:3333/admin/screens`:
1. Click a tile → the screen's page, with the image, three cards and the nav.
2. Edit the name, Save → back on the same screen, name changed, filters kept in the URL.
3. Save again untouched → no write (the dirty gate); the page simply reloads.
4. Clear the legend, Save → the field is gone (verify with
   `npx tsx -e "…"` or just re-open the page and see it blank).
5. Press → and ← → the neighbouring screens, in the grid's order.
6. Apply a plant filter on the index first, then open a screen: → stays inside
   that plant, and Save keeps `?plant=…`.
7. Replace the image with a file → the tile's thumbnail changes.
8. Tick confirm and Delete → back at the library, the tile is gone.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/admin/screens/\[slug\]/page.tsx app/admin/_components/screen-*.tsx app/admin/_components/sheet-keys.tsx app/admin/_components/filter-fields.tsx
git commit -m "A screen's page: the image, the metadata, the delete — and the nav that walks the filtered list"
```

---

## Task 13: The create page

**Files:**
- Create: `app/admin/_components/screen-create-form.tsx`
- Create: `app/admin/screens/new/page.tsx`

- [ ] **Step 1: The form**

Create `app/admin/_components/screen-create-form.tsx`:

```tsx
import { resolveText, type Plant } from "@/lib/data";
import { createScreenAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";
import { FilterFields } from "./filter-fields";

/**
 * A new screen: a slug, a name, a plant and an image.
 *
 * The ONE form in the admin that holds the media picker alongside text inputs,
 * and that is a decision rather than a slip. The picker's two rules — inert
 * rather than destructive, and no edit ever depending on the island — are about
 * forms that change a record that already exists. Script-off this form renders
 * its fields, renders no button (the button is inside the island), and creates
 * nothing. Nothing is lost, because nothing existed.
 *
 * TWO text inputs rather than one is load-bearing: a lone text input in a
 * button-less form submits on Enter, which is the trap the bean Keyword form
 * documents. With two there is no implicit submission at all — and
 * buildNewScreenInput refuses a payload with no `image__ready` regardless.
 *
 * The name may be left blank: it falls back to the slug through
 * `screenNameFromStem`, the same derivation the import's hundred and seventy
 * names came from, so a screen added by hand is named by the same rule.
 */
export function ScreenCreateForm({ plants, query }: { plants: Plant[]; query: string }) {
  return (
    <form action={createScreenAction} className="flex flex-col gap-5">
      <FilterFields query={query} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            type="text"
            name="slug"
            placeholder="match-hero-m104"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" placeholder="from the slug when blank" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="plant">Plant</Label>
        <NativeSelect id="plant" name="plant" defaultValue="">
          <option value="">— none —</option>
          {plants.map((p) => (
            <option key={p.slug} value={p.slug}>
              {resolveText(p.name)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <MediaPicker name="image" max={1} submitLabel="Create screen" />
    </form>
  );
}
```

- [ ] **Step 2: The page**

Create `app/admin/screens/new/page.tsx`:

```tsx
import Link from "next/link";
import { loadRawGarden } from "@/lib/store";
import { screensHref, screensQuery } from "@/lib/screens";
import { ScreenCreateForm } from "@/app/admin/_components/screen-create-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * A new screen. Also a sheet body — `app/admin/@sheet/(.)screens/new/page.tsx`
 * renders this module inside the panel, exactly as the screen page is rendered
 * there, so the `+` beside the library's title is a link to a page rather than
 * a button that opens something.
 */
export default async function NewScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  const active = await searchParams;
  const query = screensQuery(active);
  const raw = await loadRawGarden();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-medium tracking-tight">New screen</h1>
        <Link
          href={screensHref(null, query)}
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← library
        </Link>
      </div>

      {active.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{active.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <ScreenCreateForm plants={raw.plants ?? []} query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run dev`

At `http://localhost:3333/admin/screens/new`:
1. Submit with no slug → the page comes back with "a screen needs a slug".
2. Submit with `Bad Slug` → the kebab-case message.
3. Submit a valid slug with no image → "add an image".
4. Pick an image, leave the name blank, submit → lands on the new screen's page
   with the name derived from the slug, and the screen appears in the library.
5. Re-use the same slug → "that slug is taken: …".

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/admin/screens/new/page.tsx app/admin/_components/screen-create-form.tsx
git commit -m "Adding a screen by hand, named the way the import names them"
```

---

## Task 14: The side sheet

**Files:**
- Create: `app/admin/_components/side-sheet.tsx`
- Create: `app/admin/@sheet/default.tsx`
- Create: `app/admin/@sheet/(.)screens/[slug]/page.tsx`
- Create: `app/admin/@sheet/(.)screens/new/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: The panel**

Create `app/admin/_components/side-sheet.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The admin's right-hand side sheet: a fixed panel that the page slides out
 * from under, rather than an overlay that covers it.
 *
 * `PlantInside`'s move, promoted from a popover to a real panel, and the reason
 * for the shape is the whole design of the screen library: the contact sheet
 * stays VISIBLE and stays CLICKABLE while a screen is open, so the author edits
 * one, sees the next one they meant, clicks it, and the panel swaps. An overlay
 * would make that two gestures and a lost place.
 *
 * It is the SHELL and nothing else — no form, no action, no fields — which is
 * the line `overlay-sheet.tsx` already draws. Every consumer is a route, so
 * this file can never become the place a save goes wrong.
 *
 * `data-screen-sheet` is the hook the layout's push reads. It is on the panel
 * rather than on a wrapper because the layout's CSS asks "is there a sheet
 * beside me", and the answer has to be an element that exists only when there
 * is one — which is exactly what a parallel route's `default.tsx` returning null
 * gives.
 */
export function SideSheet({ children }: { children: ReactNode }) {
  return (
    <aside
      data-screen-sheet
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l bg-card/95 p-6 shadow-xl backdrop-blur-xl duration-200 animate-in slide-in-from-right lg:w-[28rem]"
    >
      {children}
    </aside>
  );
}
```

- [ ] **Step 2: The slot**

Create `app/admin/@sheet/default.tsx`:

```tsx
/**
 * The sheet slot, closed.
 *
 * A parallel route needs a `default.tsx` for every route that does not fill it,
 * and returning null is what makes the layout's `:has(~ [data-screen-sheet])`
 * push honest: on every admin route but a screen's, there is no element beside
 * the page at all, so nothing to match and nothing to slide.
 */
export default function NoSheet() {
  return null;
}
```

Create `app/admin/@sheet/(.)screens/[slug]/page.tsx`:

```tsx
import ScreenPage from "@/app/admin/screens/[slug]/page";
import { SideSheet } from "@/app/admin/_components/side-sheet";

export const dynamic = "force-dynamic";

/**
 * A screen's page, in the side sheet.
 *
 * It renders THE SAME MODULE the standalone route does — imported, not
 * reimplemented — and that is the claim the whole design rests on: there is
 * nothing in this panel that is not a page, so a script-off click on a tile is
 * an ordinary navigation to the same editors. `lib/screen-sheet-source.test.ts`
 * pins the import, because reimplementing the body here would pass `tsc`,
 * `npm test` and `npm run build` while quietly making the library
 * script-dependent.
 */
export default async function ScreenSheet(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  const { slug } = await props.params;

  return (
    <SideSheet>
      <ActiveTile slug={slug} />
      <ScreenPage {...props} />
    </SideSheet>
  );
}

/**
 * Which tile is open, said in CSS by the panel.
 *
 * The index page cannot say it: interception is precisely what keeps it from
 * re-rendering while the panel navigates, so it never learns the slug. One
 * attribute-selector rule against the `data-screen-tile` every tile carries
 * does the whole job with no client code and no state to get stale.
 *
 * The slug is guarded rather than trusted even though it comes from a stored
 * document — a stored slug came from a FILENAME, and a quote in one would
 * escape the rule. A slug that fails the guard simply gets no ring.
 */
function ActiveTile({ slug }: { slug: string }) {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  return (
    <style>{`[data-screen-tile="${slug}"] > div:first-child{outline:2px solid var(--color-ring);outline-offset:2px}`}</style>
  );
}
```

Create `app/admin/@sheet/(.)screens/new/page.tsx`:

```tsx
import NewScreenPage from "@/app/admin/screens/new/page";
import { SideSheet } from "@/app/admin/_components/side-sheet";

export const dynamic = "force-dynamic";

/** The create page, in the side sheet. The same module the standalone route
 *  renders — see the sibling slot for why that is not a convenience. */
export default async function NewScreenSheet(props: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  return (
    <SideSheet>
      <NewScreenPage {...props} />
    </SideSheet>
  );
}
```

- [ ] **Step 3: The layout and the push**

Replace the body of `app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { AdminChrome, AdminMain } from "./_components/admin-chrome";

/**
 * The admin/tooling zone. It shares the design system with the public zone but
 * not its chrome: the floating rail and the top-right actions are rendered
 * here, once, and withdraw themselves on the login page.
 *
 * The column's padding clears those two fixed clusters — the rail on the left,
 * the account actions top-right — while keeping the centred max-width column.
 * It lives in AdminMain rather than here because it is route-dependent (the
 * login page has no chrome to clear) and a server component cannot read the
 * pathname.
 *
 * THE `sheet` SLOT is the screen library's side panel (a parallel route filled
 * by `@sheet/(.)screens/…`, and `@sheet/default.tsx` — null — everywhere else).
 * The page slides left when one is open, and the whole of that is the CSS
 * below: `:has(~ [data-screen-sheet])` asks whether a panel exists beside this
 * wrapper, which needs no open flag, no client state and no knowledge of the
 * route. It is the idiom `plant-inside.tsx` already uses to hold its plate open
 * under a portaled popover.
 *
 * `transition-transform` and nothing else, for that file's reason: a transform
 * does not re-flow the document, so the contact sheet keeps its columns and its
 * scroll position while the panel arrives. Below `lg` the panel covers instead
 * — sliding a narrow column that far would only push it under the chrome's own
 * rail.
 */
export default function AdminLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      <AdminChrome />
      <div className="transition-transform duration-200 ease-out lg:[&:has(~[data-screen-sheet])]:-translate-x-56">
        <AdminMain>{children}</AdminMain>
      </div>
      {sheet}
    </>
  );
}
```

- [ ] **Step 4: Verify the interception**

Run: `npx tsc --noEmit && npm run dev`

At `http://localhost:3333/admin/screens`:
1. Click a tile → **the grid stays**, the panel slides in from the right, the
   page slides left, and the open tile has a ring. The URL is
   `/admin/screens/<slug>`.
2. Click a different tile **in the still-visible grid** → the panel's contents
   swap without closing.
3. Press → and ← → the panel walks the grid's order.
4. Press Escape → the panel closes, the page slides back.
5. Reload the page while the panel is open → the standalone screen page renders
   (no grid, no panel), with the same fields and the same nav. This is the
   no-script path, and it must work.
6. Save the meta form from inside the panel → the values persist and the panel
   is still showing the screen.
7. Narrow the window below `lg` → the panel covers instead of pushing.
8. Visit `/admin/vault` and `/admin` → no panel, no layout shift.

If the push does not apply, check the generated CSS for the `:has(~…)` rule
before changing the approach — the panel and the navigation do not depend on it,
so a failure here is a degradation, not a blocker. Report it rather than
silently dropping the transition.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/@sheet app/admin/_components/side-sheet.tsx
git commit -m "The side sheet: a route in a panel, with the page sliding out from under it"
```

---

## Task 15: The source test

**Files:**
- Create: `lib/screen-sheet-source.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim the screen library rests on, enforced rather than written down.
 *
 * The side sheet costs no entry on CLAUDE.md's exception list for exactly one
 * reason: **nothing in it exists that is not also a page.** The slot imports
 * the route's own module and wraps it; the tiles are links with real hrefs. So
 * script-off, a click on a tile is an ordinary navigation to the same editors,
 * and the panel's absence costs nothing.
 *
 * Both ways of breaking that are silent. Reimplement the panel's body in the
 * slot "just to tweak the spacing" and the two drift until the no-script page
 * is missing a form nobody noticed. Turn a tile into a <button onClick> to get
 * a nicer transition and the library becomes script-only outright. Neither is a
 * type error, neither fails a render test, and `npm run build` is happy with
 * both — the admin has script, so nobody would see it.
 *
 * Source text rather than a render, for `lib/server-safe-source.test.ts`'s
 * reason: "renders the same module" is a fact about the import graph, and
 * `renderToStaticMarkup` cannot see it.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const SLOT = "app/admin/@sheet/(.)screens/[slug]/page.tsx";
const NEW_SLOT = "app/admin/@sheet/(.)screens/new/page.tsx";
const INDEX = "app/admin/screens/page.tsx";

test("the sheet renders the screen page's own module", () => {
  const text = source(SLOT);
  assert.match(text, /from "@\/app\/admin\/screens\/\[slug\]\/page"/);
  assert.match(text, /<ScreenPage /);
});

test("the sheet renders the create page's own module", () => {
  const text = source(NEW_SLOT);
  assert.match(text, /from "@\/app\/admin\/screens\/new\/page"/);
  assert.match(text, /<NewScreenPage /);
});

test("neither slot rebuilds a form of its own", () => {
  for (const path of [SLOT, NEW_SLOT]) {
    assert.equal(source(path).includes("<form"), false, `${path} renders its own form`);
    assert.equal(source(path).includes("Action"), false, `${path} reaches a server action`);
  }
});

test("the library's tiles navigate by href, not by a click handler", () => {
  const text = source(INDEX);
  assert.match(text, /data-screen-tile=/);
  assert.equal(text.includes("onClick"), false, "a tile that is a button is a script-only library");
});

test("the tiles are links, and the page is not a client component", () => {
  const text = source(INDEX);
  assert.match(text, /from "next\/link"/);
  assert.equal(text.includes('"use client"'), false);
});
```

- [ ] **Step 2: Run it**

Run: `npm test 2>&1 | grep -E "screen-sheet|^# (pass|fail)"`
Expected: five passes, `# fail 0`.

- [ ] **Step 3: Prove the test bites**

Temporarily add `onClick={() => {}}` to the tile `Link` in
`app/admin/screens/page.tsx`, run `npm test`, and confirm the fourth test fails.
Revert the change and confirm it passes again.

- [ ] **Step 4: Commit**

```bash
git add lib/screen-sheet-source.test.ts
git commit -m "Pin the sheet's whole claim: the panel renders the page's own module"
```

---

## Task 16: Documentation, and the full check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Record the library in `CLAUDE.md`**

After the sixth exception (the public TOC rail) and before "Those six are the
whole list", the sentence stays true — this slice adds none. Add a paragraph to
the list of neighbours that are NOT exceptions, after the vault filter popovers
entry:

```markdown
- The screen library's side sheet (`app/admin/_components/side-sheet.tsx`, the
  screen-library slice). `/admin/screens` is a contact sheet of every stored
  screen; clicking a tile opens its editors in a panel on the right that the
  page slides out from under, rather than an overlay — so the grid stays visible
  and clickable and the author can swap screens without closing anything. It
  looks like a seventh exception and is not, because **the panel renders nothing
  that is not already a page**: it is a Next parallel + intercepting route
  (`app/admin/@sheet/(.)screens/[slug]`) that imports and wraps
  `app/admin/screens/[slug]/page.tsx` itself. Script-off, the same tile click is
  an ordinary navigation to that page, where every form still works — prev,
  next and close included, since all three are real `<a href>`. It is also this
  repo's first and only `next/link`: interception needs a client-side
  navigation, and `Link` renders the same anchor a plain `<a>` would.
  `lib/screen-sheet-source.test.ts` pins both halves — the slot importing the
  page's own module, and the tiles navigating by `href` — because reimplementing
  the body in the slot or turning a tile into a button passes `tsc`, `npm test`
  AND `npm run build` while quietly making the library script-only.

  The push itself is CSS, not state: the layout asks
  `:has(~ [data-screen-sheet])`, which is `plant-inside.tsx`'s idiom. The one
  thing the library does spend is the picker exception it already had — the
  image card and the create form are the picker, so neither works without
  script, and `buildScreenImagePatch` enforces the `__ready` marker. It adds one
  rule its three siblings lack: **a screen's image cannot be cleared**, because
  `Screen.image` is required.
```

- [ ] **Step 2: Run everything**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run test:db 2>&1 | tail -5
npm run build 2>&1 | tail -20
npx eslint . 2>&1 | tail -20
```

Expected: no type errors, `# fail 0` from both suites, a successful build with
`/admin/screens`, `/admin/screens/[slug]` and `/admin/screens/new` in the route
list, and no new lint errors.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: the screen library, and why its sheet is not a seventh exception"
```

- [ ] **Step 4: Open the PR**

The library is a surface the author uses, not a change a visitor or listener
would notice — so per `CLAUDE.md`'s gate this PR carries **no Lab Note**, and
gets the `no-lab-note` label if the advisory reminder comments.

```bash
git push -u origin screen-library-admin
gh pr create --label no-lab-note --title "The screen library: /admin/screens, and a sheet that is a route (#70)" --body "$(cat <<'EOF'
Closes #70.

`/admin/screens` — the hundred and seventy imported screens as a contact sheet,
filtered by plant, bean and tag with shareable URLs, and edited in a side sheet
on the right that the page slides out from under.

The sheet is a **route**, not a client editor: `app/admin/@sheet/(.)screens/[slug]`
imports and wraps `app/admin/screens/[slug]/page.tsx` itself. So the grid stays
visible and clickable while a screen is open (click another tile and the panel
swaps), and script-off the same click is an ordinary navigation to a page where
every form still works. **No seventh exception on CLAUDE.md's list.**

Spec: `docs/superpowers/specs/2026-09-08-screen-library-admin-design.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

**Spec coverage:** §1 → Tasks 11, 14; §1.1 → Task 11; §1.2 → Task 14; §1.3 →
Task 12; §1.4 → Task 14; §2.1 → Tasks 3, 12; §2.2 → Tasks 4, 7, 12; §2.3 →
Tasks 7, 12; §3 → Task 11; §3.1 → Task 10; §3.2 → Tasks 2, 8, 12; §4 → Task 9;
§5 → Tasks 1–7; §5.1 → Tasks 5, 13; §6 → every task's tests plus Task 15; §7 →
nothing to build, by definition.

**Known risks, in order:**

1. **The interception itself** (Task 14). If `@sheet/(.)screens/[slug]` does not
   intercept, the click navigates to the standalone page — the library still
   works completely, minus the panel. Report it; do not paper over it with a
   client-side modal.
2. **The `:has(~…)` push** (Task 14, Step 3). Degrades to "the panel floats over
   the right of the grid". Not a blocker.
3. **`Bean` may not exist in this `lucide-react`** (Task 10). If the import
   fails, use `Bean` → `CircleDashed` and say so in the commit.
