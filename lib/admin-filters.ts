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

/** Canonical `k=v&k=v` for the named keys, in the order given. Blank,
 *  whitespace-only and "all" values are dropped — "all" is how both pages
 *  spell "no filter". Returns "" when nothing is active.
 *
 *  `String(...)` rather than a plain read because a REPEATED query key
 *  (`?plant=a&plant=b`) reaches a Next page as a `string[]`, which the type
 *  here does not admit but a URL can always produce. Coercing degrades that to
 *  a value that matches nothing; reading `.trim()` off the array would throw
 *  and 500 the page around the filter bar. */
export function filterQuery(active: FilterValues, keys: readonly string[]): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = String(active[key] ?? "").trim();
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
