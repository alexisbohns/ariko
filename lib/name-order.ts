/**
 * The order every admin list of entities is drawn in.
 *
 * By resolved NAME, with the slug as the tie-break. The tie-break is the part
 * worth keeping: two plants, pods or beans can resolve to the same English
 * name, and without a second key the order between them is whatever the
 * garden's own array order happened to be — which is Mongo's, and would
 * shuffle under the author between visits. `lib/screens.ts`'s capture-run sort
 * names the same hazard.
 *
 * `localeCompare` rather than the plain `<` this repo reaches for on slugs
 * (`lib/screens.ts`, `lib/exhibition.ts`) because these are PEOPLE-facing
 * names, not ASCII kebab-case. The name has already been through
 * `resolveText` by the time a row reaches here, so this is deliberately an
 * English-name order regardless of the reader's language.
 *
 * One comparator, four callers — the plant switcher's list
 * (`app/admin/layout.tsx`), the welcome page's two tables, `/admin/pods` and
 * `/admin/beans` — so the chrome's first plant and the table's first plant are
 * the same plant by construction, which is the only reason the property is
 * worth having in a file of its own.
 *
 * `lib/plant-hub.ts`'s `byName` is this rule over garden DOCUMENTS, whose
 * `name` is a `Text` it resolves itself; this one is the same rule over
 * composed table rows, whose `name` is already a string. Two signatures, one
 * order — if the hub's ever needs touching, the move is to have it call this.
 */
export function byResolvedName(
  a: { name: string; slug: string },
  b: { name: string; slug: string },
): number {
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}
