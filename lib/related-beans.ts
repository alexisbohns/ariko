import {
  POD_PREFIX,
  parentsWithPrefix,
  resolveText,
  type Bean,
  type Dataset,
} from "./data";
import { beansForPlantDeep } from "./plant-hub";
import { articleFor } from "./article";

/**
 * What to read next, at the end of a bean — pod siblings first, topped up from
 * the plant.
 *
 * Pure and JSX-free, beside `lib/lineage.ts` and `lib/admin-nav.ts`, for the
 * same reason: the component is rendered, this is arithmetic, and arithmetic is
 * what `npm test` can reach without a database.
 *
 * THE GARDEN IS A PARAMETER, never loaded here — `lib/lineage.ts`'s rule,
 * verbatim. The page decides which dataset it hands over, so privacy stays a
 * page's decision rather than this file's: the public bean page passes
 * `getPublicDataset()`, `filterPublic` has already dropped every private bean,
 * pod and plant upstream, and there is NO second check here. One projection,
 * one place — and nothing a future admin caller would have to remember to
 * switch off.
 */

/**
 * A candidate, carrying the date it sorts by so `articleFor` is called once per
 * bean rather than once per comparison.
 */
interface Candidate {
  bean: Bean;
  date: string;
  /** Resolved once, here, rather than per comparison — which is the whole
   *  reason this interface exists rather than sorting `Bean`s directly. */
  name: string;
}

/**
 * Newest article first; ties by English name, then by slug.
 *
 * The tie-break is TWO keys deep rather than one, and that is not belt and
 * braces: two beans can carry articles dated the same day, and `Dataset`'s
 * arrays are in garden order — which is Mongo's. Without the tail the rail
 * reshuffles itself between two visits with nothing in the garden having
 * changed, the hazard `lib/plant-hub.ts`'s `byName` and `lib/screens.ts`'s
 * capture-run sort both already name.
 *
 * `resolveText` with no `lang` resolves to English, exactly as `byName` does,
 * so the ORDER is English-name order for every reader while the CONTENTS are
 * resolved per-reader by the page. That asymmetry is deliberate: a per-language
 * sort would let the `slice(0, limit)` below keep a different six beans for a
 * French reader than for an English one.
 */
function byNewestThenName(a: Candidate, b: Candidate): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.name.localeCompare(b.name) || a.bean.slug.localeCompare(b.bean.slug);
}

export function relatedBeans(dataset: Dataset, bean: Bean, limit = 6): Bean[] {
  // Tier 1: every pod this bean names, unioned. The union is not defensive — a
  // bean may name two pods, and both sets of siblings are genuinely related.
  const podTier = new Map<string, Bean>();
  for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
    for (const sibling of dataset.beansForPod(podSlug)) {
      podTier.set(sibling.slug, sibling);
    }
  }

  // Tier 2: everything under the plant. `plantForBean` climbs THROUGH the pod,
  // so the common case — a bean parented only to a pod — still finds its plant.
  // `beansForPlantDeep` is called rather than composed: that is what inherits
  // its dedupe of a bean parented to both a pod and that pod's plant.
  //
  // Tier 2 is deliberately the ONE plant `plantForBean` names, not a union to
  // match tier 1's: a bean may name two plants, and unioning them would make a
  // rail that spans two plants under a heading that names neither. The pod
  // union is right because pods are collections within one practice; the plant
  // union would not be.
  const plantTier = new Map<string, Bean>();
  const plant = dataset.plantForBean(bean.slug);
  if (plant) {
    for (const candidate of beansForPlantDeep(dataset, plant.slug)) {
      if (!podTier.has(candidate.slug)) plantTier.set(candidate.slug, candidate);
    }
  }

  // A candidate survives only if it has something to read — and the test is the
  // SAME function the bean page renders by (`lib/article.ts`), not a second one
  // that happens to agree. The rail therefore cannot promise a read the
  // destination will not give.
  const readable = (beans: Iterable<Bean>): Candidate[] => {
    const out: Candidate[] = [];
    for (const candidate of beans) {
      if (candidate.slug === bean.slug) continue;
      const article = articleFor(dataset.sproutsForBean(candidate.slug));
      if (article) {
        out.push({ bean: candidate, date: article.date, name: resolveText(candidate.name) });
      }
    }
    return out.sort(byNewestThenName);
  };

  // Pod tier ahead of plant tier, ALWAYS — a pod sibling outranks every plant
  // bean however old. Sorting the concatenation by date instead (one key rather
  // than two tiers) reads as a simplification and passes any test that only
  // counts the rail's length, while quietly making a pod's own siblings
  // invisible inside a twenty-bean plant.
  return [...readable(podTier.values()), ...readable(plantTier.values())]
    .slice(0, limit)
    .map((c) => c.bean);
}
