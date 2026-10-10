import { BEAN_PREFIX, hasNarrative, parentsWithPrefix, type Bean, type Relation, type Sprout, type Text } from "./data";

/**
 * The article fold (spec 2026-10-10-journal-model §4 step 2), as a PURE plan.
 *
 * Seventeen `type:"article"` sprouts are each the sole child of a bean created
 * for them by /api/articles — a bean's narrative wearing a sprout costume. Each
 * folds into its bean's `content` and is deleted. The script
 * (scripts/migrate-journal.ts) applies this plan; this module only decides it,
 * so every refusal is a unit test and the script carries no rule of its own.
 *
 * Refusals are per sprout and never partial: a fold that cannot be made whole
 * is listed and skipped, and the script refuses to write while any remain.
 */
export const ARTICLE_TYPE = "article";

export interface ArticleFold {
  beanSlug: string;
  sproutSlug: string;
  content: Text;
  relations: Relation[] | undefined;
}

export interface FoldPlan {
  folds: ArticleFold[];
  refusals: string[];
}

export function planArticleFold(beans: Bean[], sprouts: Sprout[]): FoldPlan {
  // Grouped by bean first, because "two articles under one bean" is a refusal
  // about the GROUP, not about either sprout on its own.
  const byBean = new Map<string, Sprout[]>();
  for (const s of sprouts) {
    if (s.type !== ARTICLE_TYPE) continue;
    const beanSlug = parentsWithPrefix(s.parents, BEAN_PREFIX)[0];
    const key = beanSlug ?? `(no bean) ${s.slug}`;
    byBean.set(key, [...(byBean.get(key) ?? []), s]);
  }
  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));

  const folds: ArticleFold[] = [];
  const refusals: string[] = [];
  for (const [beanSlug, group] of byBean) {
    if (group.length > 1) {
      refusals.push(`${beanSlug}: two article sprouts (${group.map((s) => s.slug).join(", ")}) — the fold cannot pick`);
      continue;
    }
    const s = group[0];
    const bean = beanBySlug.get(beanSlug);
    if (!bean) {
      refusals.push(`${s.slug}: bean ${beanSlug} not found`);
      continue;
    }
    const own = s.content;
    if (own === undefined || !hasNarrative(own)) {
      refusals.push(`${s.slug}: no content to fold`);
      continue;
    }
    if (hasNarrative(bean.content)) {
      refusals.push(`${s.slug}: bean ${beanSlug} already has content`);
      continue;
    }
    // lib/cover.ts derives a bean's cover from its sprouts' media, so folding
    // an article that carries any would change the bean's cover by deletion.
    if ((s.media ?? []).length > 0) {
      refusals.push(`${s.slug}: carries media — the bean's derived cover would change`);
      continue;
    }
    folds.push({ beanSlug, sproutSlug: s.slug, content: own, relations: s.relations });
  }
  return { folds, refusals };
}
