/**
 * The filter bar's arithmetic — one copy, two pages.
 *
 * `/admin/sprouts` (the vault, before the rename) has filtered sprouts by
 * state, plant and tag since it existed, with the href builder living inside
 * the page. `/admin/screens` needs exactly the same thing over different
 * dimensions, so the builder moved here rather than being copied: two pages
 * that draw the same control draw it from one file, and what differs is a
 * parameter.
 *
 * `filterQuery` carries a second job the sprouts section never needed. The
 * library's write forms round-trip the author's active filters through a
 * hidden field so a save does not drop them out of the set they were working
 * through — and a hidden field is client-controlled. Rebuilding the query from a NAMED key list
 * is what makes that safe: whatever arrives, only these keys survive, so the
 * string handed to `redirect()` can never carry anything but the dimensions
 * this page knows about.
 */

export type FilterValues = Record<string, string | undefined>;

/** How every filter control in the admin spells "no filter". A word rather
 *  than an empty value because these reach a URL through a plain `<a href>`,
 *  and `?plant=` is a key a reader cannot see the meaning of. */
const NO_FILTER = "all";

/**
 * One filter value, as every reader of one must read it: trimmed, with blank
 * and `NO_FILTER` both resolving to absence.
 *
 * **Exported because the sentinel has to be read the same way by everything
 * that reads it**, and for one slice it was not: `filterQuery` dropped "all"
 * while `filterSproutEntries` and `filterScreens` compared it raw, as though a
 * plant could be slugged "all" — so `/admin/sprouts?plant=all` rendered zero
 * rows under a filter trigger, and later a scope switcher, both reading "All".
 * `filterHref` never emits that URL, which is why it went unnoticed; a control
 * that writes a scope into every URL makes hand-edited ones ordinary.
 *
 * The consequence, stated rather than discovered: a plant, bean or tag
 * literally named "all" cannot be filtered on. It already could not — no href
 * this module builds can carry it — so this is the existing rule reaching the
 * readers, not a new restriction.
 *
 * `String(...)` rather than a plain read because a REPEATED query key
 * (`?plant=a&plant=b`) reaches a Next page as a `string[]`, which `FilterValues`
 * does not admit but a URL can always produce. Coercing degrades that to a
 * value that matches nothing; reading `.trim()` off the array would throw and
 * 500 the page around the filter bar.
 */
export function filterValue(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  return value && value !== NO_FILTER ? value : undefined;
}

/** Canonical `k=v&k=v` for the named keys, in the order given. Blank,
 *  whitespace-only and "all" values are dropped — see `filterValue`, which is
 *  the one place that decides so. Returns "" when nothing is active. */
export function filterQuery(active: FilterValues, keys: readonly string[]): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = filterValue(active[key]);
    if (value) params.set(key, value);
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
