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

/** The three dimensions the library filters on, in the order they reach a URL.
 *
 *  Both readers are SERVER side, which is why the constant can live in this
 *  file at all: this module imports `lib/data.ts`, which opens with `node:fs`.
 *  The page builds the filter hrefs and hands the popovers finished strings,
 *  and the page renders the hidden field the write forms round-trip — neither
 *  the `"use client"` filter bar nor any other island imports this. Doing so
 *  would not merely bloat the bundle, it would fail the build, which is the
 *  `lib/palette.ts` / `lib/palette-items.ts` trap CLAUDE.md documents. */
export const SCREEN_FILTER_KEYS = ["plant", "bean", "tag"] as const;

/**
 * The hidden field one dimension round-trips through, on a write.
 *
 * Derived rather than spelled, and that is the point: the field names live in
 * `filter-fields.tsx` (which renders them) and in `actions.ts` (which reads
 * them back), and until this existed both hard-coded the same three strings
 * with nothing tying either to `SCREEN_FILTER_KEYS`. A FOURTH dimension would
 * have type-checked, built, and silently dropped out of every save's round
 * trip — the author saves once and loses the filter they were walking. Now
 * both sides map the constant through this, so a dimension added in one place
 * arrives in all three.
 *
 * The `q_` prefix keeps these clear of the form's own fields: a screen's meta
 * form already posts a `plant`, and a filter named `plant` beside it would be
 * the same name meaning two things.
 */
export function filterFieldName(key: string): string {
  return `q_${key}`;
}

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
  /** Carries a `{ kind: "cover" }` relation TO A BEAN — the image is in service
   *  on the landing row, which is worth saying on the tile and in the delete
   *  card. */
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
      // The one field read without a fallback, and deliberately: `image` is
      // required on `Screen` and `createScreen` never writes one without a
      // url, so a guard here would be dead code pretending the tile can render
      // without an asset. The optional fields around it all get one.
      url: screen.image.url,
      alt: screen.image.alt ?? "",
      plant: parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null,
      bean: beanRef("shows") ?? cover,
      isCover: cover !== null,
      // Copied, not handed out: a row is a view of a loaded garden document,
      // and a caller that sorts or pushes onto `tags` would edit the document
      // underneath every other reader of it.
      tags: [...(screen.tags ?? [])],
      capturedAt: screen.capturedAt ?? "",
    };
  });

  // Newest capture run first, slug as the tie-break — a whole run shares one
  // date, so without the second key the order inside a run is Mongo's and would
  // shuffle under the author between visits. An undated screen sorts LAST
  // (its "" compares below every real date), which is right: dated screens came
  // from a run somebody remembers.
  //
  // Plain `<` rather than `localeCompare`, matching `byDateDesc` in lib/data.ts
  // and the `.sort()` in the distincts below: slugs are ASCII kebab-case, and
  // one collation across the file is what makes the contact sheet's order and
  // the filter dropdowns' order the same rule.
  return rows.sort((a, b) =>
    a.capturedAt === b.capturedAt
      ? a.slug < b.slug
        ? -1
        : a.slug > b.slug
          ? 1
          : 0
      : a.capturedAt < b.capturedAt
        ? 1
        : -1,
  );
}

/** Pure. Membership on all three dimensions; a blank value is ignored, a
 *  non-blank unknown one matches nothing — `filterSproutEntries`' stance, and
 *  for its reason: there is no enum here to validate against. */
export function filterScreens(rows: ScreenRow[], filters: ScreenFilters): ScreenRow[] {
  // `String(...)` for `filterQuery`'s reason: a repeated query key arrives as a
  // `string[]`, and reading `.trim()` off one would 500 the page.
  const value = (raw?: string) => {
    const trimmed = String(raw ?? "").trim();
    return trimmed ? trimmed : undefined;
  };
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

/** The library's canonical query string — the one place that decides which
 *  keys the library filters on reach a URL. Callers hand it whatever arrived;
 *  only the three dimensions survive. */
export function screensQuery(active: FilterValues): string {
  return filterQuery(active, SCREEN_FILTER_KEYS);
}

/**
 * Every URL this slice redirects to or links to.
 *
 * The `query` it is handed is RE-CANONICALIZED here rather than trusted, and
 * that is the whole guarantee: `query` is a bare `string`, so a caller passing
 * a client-controlled hidden field straight in type-checks perfectly, and the
 * write forms round-trip exactly such a field. Parsing it and running it back
 * through `filterQuery` means whatever arrives, only the three known keys reach
 * a `redirect()` — the guard is in this function rather than in a rule its
 * callers must remember. `screensQuery` upstream is then defence in depth, the
 * stance `buildScreenImagePatch`'s `__ready` check takes.
 *
 * `error` is set LAST and through URLSearchParams, so a message containing an
 * ampersand cannot smuggle a filter past the canonicalization above.
 */
export function screensHref(slug: string | null, query: string, error?: string): string {
  return libraryHref(slug ? `/admin/screens/${encodeURIComponent(slug)}` : "/admin/screens", query, error);
}

/**
 * `/admin/screens/new` — the create page, with the author's filters carried
 * onto it and back off it.
 *
 * It lives here rather than beside its caller so the docblock above stays true:
 * "every URL this slice redirects to or links to". `actions.ts` had a private
 * copy of this, which made it the second place the canonicalization rule was
 * written down — and a rule written twice is a rule one copy can forget. Same
 * body as `screensHref`, so the guard is the same guard rather than the same
 * idea typed again.
 */
export function newScreenHref(query: string, error?: string): string {
  return libraryHref("/admin/screens/new", query, error);
}

/** The shared body of the two above: re-canonicalize, then set `error` LAST and
 *  through URLSearchParams. Private, because a caller that could pass its own
 *  path would be a caller that could pass a path from a form field. */
function libraryHref(path: string, query: string, error?: string): string {
  const params = new URLSearchParams(
    filterQuery(Object.fromEntries(new URLSearchParams(query)), SCREEN_FILTER_KEYS),
  );
  if (error) params.set("error", error);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The one CSS rule that rings the open tile — or null for a slug that cannot be
 * trusted inside a selector.
 *
 * `app/admin/@sheet/(.)screens/[slug]/page.tsx` emits this in a `<style>`,
 * because the index page cannot say which tile is open: interception is
 * precisely what keeps it from re-rendering while the panel navigates, so it
 * never learns the slug. One attribute-selector rule against the
 * `data-screen-tile` every tile carries does the whole job with no client code
 * and no state to get stale.
 *
 * The guard is the slice's ONLY injection guard, which is why it lives here
 * rather than inline in a page component where no test can reach it. A stored
 * slug came from a FILENAME — the same threat model `screensHref`'s
 * `encodeURIComponent` takes seriously — and a quote in one would close the
 * attribute and let the rest of the name write arbitrary CSS. A slug that fails
 * simply gets no ring, which costs a visual cue and nothing else.
 */
export function activeTileCss(slug: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  return `[data-screen-tile="${slug}"] > div:first-child{outline:2px solid var(--color-ring);outline-offset:2px}`;
}
