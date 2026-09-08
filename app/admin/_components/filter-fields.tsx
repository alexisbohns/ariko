import { SCREEN_FILTER_KEYS, filterFieldName } from "@/lib/screens";

/**
 * The author's active filters, round-tripped through a write.
 *
 * One hidden field per dimension rather than one carrying a query string, so
 * nothing has to parse on the way back in; the action reads them by name and
 * hands them to `screensQuery`, which is what re-canonicalizes them into a URL.
 * They are client-controlled — that is why the action rebuilds the query from a
 * known key list rather than concatenating this back onto a path.
 *
 * Without them, the first save drops the author out of the filtered set they
 * were walking with prev/next and back to the top of all hundred and seventy.
 *
 * The fields are DERIVED from `SCREEN_FILTER_KEYS`, through the same
 * `filterFieldName` the action reads them back with. Spelled out here and
 * spelled out again there — which they were — a fourth dimension would
 * type-check, build, and silently drop out of every save's round trip, which is
 * the exact failure this slice guards against everywhere else.
 *
 * Importing `lib/screens.ts` is safe HERE and nowhere with `"use client"` on
 * it: that module reaches `lib/data.ts`, which opens with `node:fs`. This is a
 * server component, and every form that renders it is one too.
 */
export function FilterFields({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  return (
    <>
      {SCREEN_FILTER_KEYS.map((key) => (
        <input key={key} type="hidden" name={filterFieldName(key)} value={params.get(key) ?? ""} />
      ))}
    </>
  );
}
