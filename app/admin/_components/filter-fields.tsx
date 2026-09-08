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
