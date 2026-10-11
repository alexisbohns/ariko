import { BEAN_PREFIX, hasNarrative, parentsWithPrefix, type Bean, type Relation, type Sprout, type Text } from "./data";

/**
 * The article fold (spec 2026-10-10-journal-model §4 step 2), as a PURE plan.
 *
 * Each `type:"article"` sprout is the sole child of a bean created for it by
 * /api/articles — a bean's narrative wearing a sprout costume. Each folds into
 * its bean's `content` and is deleted. The script (scripts/migrate-journal.ts)
 * applies this plan; this module only decides it, so every refusal is a unit
 * test and the script carries no rule of its own.
 *
 * Refusals are per sprout and never partial: a fold that cannot be made whole
 * is listed and skipped, and the script refuses to write while any remain.
 * Each message ends in the remedy, because the operator reading it is the one
 * who has to perform it.
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
  const folds: ArticleFold[] = [];
  const refusals: string[] = [];

  // Grouped by bean first, because "two articles under one bean" is a refusal
  // about the GROUP, not about either sprout on its own.
  const byBean = new Map<string, Sprout[]>();
  for (const s of sprouts) {
    if (s.type !== ARTICLE_TYPE) continue;
    const beanSlug = parentsWithPrefix(s.parents, BEAN_PREFIX)[0];
    if (beanSlug === undefined) {
      refusals.push(`${s.slug}: no bean: parent`);
      continue;
    }
    byBean.set(beanSlug, [...(byBean.get(beanSlug) ?? []), s]);
  }
  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));

  for (const [beanSlug, group] of byBean) {
    if (group.length > 1) {
      refusals.push(
        `${beanSlug}: two article sprouts (${group.map((s) => s.slug).join(", ")}) — the fold cannot pick; retype one in the admin`,
      );
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
    // PRESENT, not merely non-blank: the script's write filter is
    // `content: { $exists: false }`, and the plan must agree with it exactly, or
    // a blank-but-present field would plan a fold the write then cannot match.
    if (bean.content !== undefined) {
      refusals.push(
        `${s.slug}: bean ${beanSlug} already carries a content field — clear it first, or if it equals the sprout's body this is an interrupted fold: delete the sprout by slug (its pre-image is in the backup) and re-run`,
      );
      continue;
    }
    // lib/cover.ts derives a bean's cover from its sprouts' media, so folding
    // an article that carries any would change the bean's cover by deletion.
    if ((s.media ?? []).length > 0) {
      refusals.push(
        `${s.slug}: carries media — the bean's derived cover would change; move the image to the bean's cover first, or retype the sprout`,
      );
      continue;
    }
    folds.push({ beanSlug, sproutSlug: s.slug, content: own, relations: s.relations });
  }
  return { folds, refusals };
}
