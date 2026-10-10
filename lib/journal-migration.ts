import {
  BEAN_PREFIX,
  hasNarrative,
  parentsWithPrefix,
  resolveSproutPlants,
  type Bean,
  type Relation,
  type SproutGarden,
  type Text,
} from "./data";
import type { SproutKind } from "./sprout-kind";

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

/** A stored sprout as the migration finds it — the pre-journal shape (`type`,
 *  `parents: ["bean:…"]`) and the post-journal one (`kind`, `about`) both
 *  admitted, because the script reads documents, not the TypeScript model. */
export interface LegacySprout {
  slug: string;
  name: Text;
  date: string;
  description: Text;
  type?: string;
  kind?: SproutKind;
  parents?: string[];
  about?: string[];
  state?: string;
  content?: Text;
  media?: unknown[];
  relations?: Relation[];
}

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

export function planArticleFold(beans: Bean[], sprouts: LegacySprout[]): FoldPlan {
  const folds: ArticleFold[] = [];
  const refusals: string[] = [];

  // Grouped by bean first, because "two articles under one bean" is a refusal
  // about the GROUP, not about either sprout on its own.
  const byBean = new Map<string, LegacySprout[]>();
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

/** Spec §4's table: the old free-string `type` onto the closed vocabulary.
 *  `article` is deliberately absent — it folds (phase one) rather than moving. */
export const KIND_FOR_TYPE: Record<string, SproutKind> = {
  note: "log",
  milestone: "milestone",
  feature: "milestone",
  song: "milestone",
  episode: "milestone",
  release: "release",
  essay: "essay",
  decision: "decision",
  digest: "digest",
};

export interface Reanchor {
  slug: string;
  type: string;
  kind: SproutKind;
  about: string[];
  /** The `parents` refs the move discards — anything not `bean:`. The one
   *  thing the migration throws away, so the script lists each one; the raw
   *  value is in the backup regardless. */
  dropped: string[];
}

export interface ReanchorPlan {
  moves: Reanchor[];
  refusals: string[];
}

/**
 * Spec §4 steps 1 and 3 as a PURE plan. Step 4 (the `bla` test sprout) is an
 * operator act: it arrives here as an unknown type and is refused with the
 * remedy, rather than this module knowing one junk value by name.
 *
 * The derived plant is checked HERE, before any write, with the same
 * `resolveSproutPlants` the read side uses — so a move the plan admits is one
 * `filterPublic` and `buildDataset` will resolve afterwards, and a sprout under
 * an unrooted pod (today, krabs) is refused by name with the operator's remedy.
 */
export function planReanchor(sprouts: LegacySprout[], garden: SproutGarden): ReanchorPlan {
  const moves: Reanchor[] = [];
  const refusals: string[] = [];
  const beanSlugs = new Set((garden.beans ?? []).map((b) => b.slug));
  for (const s of sprouts) {
    if (s.type === undefined && s.kind !== undefined) continue; // already re-anchored
    // Both present is a document no write of ours produces whole: the move's
    // filter is `kind: { $exists: false }`, so planning it would throw mid-run.
    if (s.kind !== undefined && s.type !== undefined) {
      refusals.push(`${s.slug}: carries both type and kind — unset one by hand (an interrupted write; its pre-image is in the backup)`);
      continue;
    }
    const type = s.type ?? "";
    if (type === ARTICLE_TYPE) {
      refusals.push(`${s.slug}: an article folds, it does not re-anchor — run the fold first`);
      continue;
    }
    // hasOwn, not a bare lookup: a plain object answers `"constructor"` with a
    // prototype function, and that is not a kind.
    const kind = Object.hasOwn(KIND_FOR_TYPE, type) ? KIND_FOR_TYPE[type] : undefined;
    if (!kind) {
      refusals.push(`${s.slug}: type "${type}" has no kind — retype or delete it in the admin`);
      continue;
    }
    const beans = [...new Set(parentsWithPrefix(s.parents, BEAN_PREFIX))];
    if (beans.length === 0) {
      refusals.push(`${s.slug}: no bean: parent to derive a plant from — re-anchor it by hand`);
      continue;
    }
    const missing = beans.find((b) => !beanSlugs.has(b));
    if (missing) {
      refusals.push(`${s.slug}: bean ${missing} not found — re-anchor it by hand`);
      continue;
    }
    const about = beans.map((b) => `${BEAN_PREFIX}${b}`);
    const plants = resolveSproutPlants({ about }, garden).map((p) => p.slug);
    if (plants.length === 0) {
      refusals.push(
        `${s.slug}: rolls up to no plant (bean ${beans.join(", ")}) — root the pod under a plant in the admin first`,
      );
      continue;
    }
    if (plants.length > 1) {
      refusals.push(`${s.slug}: rolls up to two plants (${plants.join(", ")}) — a sprout belongs to one; split it in the admin`);
      continue;
    }
    const dropped = (s.parents ?? []).filter((ref) => !ref.startsWith(BEAN_PREFIX));
    moves.push({ slug: s.slug, type, kind, about, dropped });
  }
  return { moves, refusals };
}
