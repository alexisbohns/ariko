import { hasNarrative, resolveText, type Bean, type Sprout, type Text } from "./data";

// Pure (spec §4), and read by public pages, so it stays server-safe (see
// `lib/server-safe-source.test.ts`).
//
// Two readers of a bean's prose live here, one on top of the other. `articleFor`
// picks the sprout a bean page would read when the bean itself has written
// nothing; `narrativeFor` puts the bean's OWN narrative ahead of it, and is the
// function the bean page renders by and `lib/related-beans.ts` admits by.

// Given sprouts in the newest-first order the dataset already guarantees
// (stable byDateDesc), returns the first one carrying non-blank content — or
// null when none does.
//
// State is NOT re-checked here: the public page passes the filterPublic-projected
// dataset, so "published" is already enforced upstream. One projection, one place.
export function articleFor(sprouts: Sprout[]): Sprout | null {
  return sprouts.find((s) => resolveText(s.content ?? "").trim() !== "") ?? null;
}

export interface Narrative {
  content: Text;
  /** Set only when the prose came from a dated sprout; a bean's own narrative has no date. */
  date: string | undefined;
}

/**
 * What a bean page reads, and the ONE test `lib/related-beans.ts` admits a
 * candidate by. The bean's own `content` first (journal model §1.1); until slice
 * two folds the last article sprouts, the newest sprout with prose is the
 * fallback, so no bean goes blank between the two slices.
 */
export function narrativeFor(bean: Bean, sprouts: Sprout[]): Narrative | null {
  if (hasNarrative(bean.content)) return { content: bean.content as Text, date: undefined };
  const article = articleFor(sprouts);
  return article ? { content: article.content as Text, date: article.date } : null;
}
