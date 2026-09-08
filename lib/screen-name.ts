/**
 * Pure. The readable name a screen gets from its filename stem.
 *
 * It lives here rather than inside scripts/import-paulopus-screens.ts for two
 * reasons. It is the only logic in that import worth pinning — everything else
 * there is I/O — and `npm test` globs lib/ and components/, so a derivation
 * that stayed in scripts/ would be a table test nobody runs.
 *
 * The rule is deliberately weak: separators to spaces, first letter up. A
 * hundred and seventy names have to be good enough to FIND a screen by, and the
 * author sharpens the handful that end up on a page. Anything cleverer —
 * title case, a stop-word list, an acronym table — would be a hundred and
 * seventy guesses instead of a hundred and seventy honest stems.
 *
 * Only the first letter is touched. Nothing is lowercased, because a stem that
 * carries a deliberate capital or a run of digits (`m104`, `AET`) means it, and
 * a derivation that flattened those would be destroying the one piece of
 * information the capture run actually recorded.
 */
export function screenNameFromStem(stem: string): string {
  // Whitespace joins the separator class so a stem that already contains spaces
  // ("home upcoming-mock") does not come back with a double one.
  const words = stem.replace(/[-_\s]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}
