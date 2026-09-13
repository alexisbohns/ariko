/**
 * A bean's tags as a SHAPE — the sibling of `lib/sprout-type.ts`, which does the
 * same job for the other free-form field a head can write.
 *
 * **Client-safe, and it imports nothing at all**, for `lib/sprout-type.ts`'s
 * reason: the tags editor lives in the bean's head, which is a client island,
 * and a value import from `lib/data.ts` (which opens with `node:fs`) fails
 * `npm run build` four modules downstream.
 *
 * THIS FILE IS WHERE THE TAG ARGUMENT LIVES. `editBeanTagsAction` applies it and
 * `updateBeanTags` is protected by it; neither restates it.
 *
 * There is no vocabulary — nothing validates a tag against a list, because a tag
 * is authored free. What there IS, is a shape: `lib/sprouts.ts`'s tag filter
 * compares tags with `===` and does not trim, so a stored `" ariko"` draws
 * identically to `"ariko"` in every badge that renders it and matches NOTHING.
 * The tag would exist, look right, and filter to an empty list. That is the same
 * class of silent bad output `isSproutType` rejects whitespace to avoid.
 *
 * Dedupe is CASE-SENSITIVE on purpose. Nothing in the garden lowercases a tag on
 * read, so `Ariko` and `ariko` are two live filter keys today; folding them here
 * would silently drop one of a pair the rest of the system distinguishes, and a
 * write path is the wrong place to invent a normalisation the read paths do not
 * share.
 */
export function parseBeanTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
