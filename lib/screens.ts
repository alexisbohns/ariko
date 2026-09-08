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
