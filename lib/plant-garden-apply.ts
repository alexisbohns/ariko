/**
 * The only thing in the planting flow that WRITES. It takes a plan
 * (`lib/garden-plan.ts`) and walks it, parent first.
 *
 * It lives in `lib/` rather than inside `scripts/plant-garden.ts` for one
 * reason: a write path only a CLI can reach is a write path no test exercises,
 * and this one creates three tiers, two of which carry a privacy cascade. The
 * script above it is argv, a file read and printing — nothing that can be
 * wrong in a way a test would want to catch.
 *
 * THE RULES THIS MODULE OBEYS, each of which passes `tsc` while quietly
 * becoming false:
 *
 *  - NOTHING IS PUBLISHED. `visibility` is never written, `exhibited` and
 *    `order` are never written, and the only sprout `state` ever written is
 *    `"draft"`. `createPod` and `createBean` are already private at birth and
 *    this module does not override them. Publishing in Ariko is a deliberate
 *    act performed in the admin behind a vocabulary and a Save button (see
 *    CLAUDE.md, "no enum writes on the click that opens it"); a text file in a
 *    sibling repo must not be able to perform it, and a sprout's `state` is the
 *    field that cascades UPWARD through its bean, pod and plant — planting a
 *    manifest that published would make a whole private project live with one
 *    command and no confirmation anywhere.
 *  - NEVER `parents` ON AN UPDATE. Re-homing an entity is the same
 *    privacy-cascade decision, and it belongs to the admin. Parentage is
 *    written once, at creation, from the manifest's own nesting.
 *  - AN IMAGE IS WRITTEN ONLY WHERE THERE IS NONE. A bean's `cover` and a
 *    sprout's `media` come from the manifest at creation, and on `--update`
 *    only when the stored entity carries no image — a cover the maintainer
 *    picked in the admin is a decision a routine re-plant must not undo. The
 *    `assets` map holds exactly what `assetsNeeded` (`lib/garden-assets.ts`)
 *    said would be needed; the applier asks it the same question, so a miss
 *    is a bug in the flow and throws rather than writing nothing quietly.
 *  - `--update` TOUCHES `name`, `description` AND `content` ONLY. That is why
 *    the update branches call the narrow writers (`updateBeanMeta`,
 *    `updateSproutMeta`, the two content writers) rather than re-running a
 *    creator: a creator would re-assert every field, parentage included.
 */
import { createPod, createBean, createSprout, updatePodContent, updateBeanMeta, updateBeanCover, updateSproutMeta, updateSproutContent, updateSproutMedia } from "./botanical";
import { uploadedFor, type UploadedAssets } from "./garden-assets";
import { extractRefs, mergeMirrored } from "./entity-refs";
import type { Relation, Text } from "./data";
import type { ContentPatch } from "./content-edit";
import type { GardenSlugs, PlanAction } from "./garden-plan";

/**
 * A content write, composed the way every content door in the repo composes
 * one: `mergeMirrored(<what is stored now>, extractRefs(<the new body>))`.
 *
 * THE EXISTING RELATIONS ARE A REQUIRED ARGUMENT, never an optional one that
 * defaults to `undefined`, because getting it wrong is silent and destructive.
 * `mergeMirrored` (`lib/entity-refs.ts`) keeps the NON-mirrored kinds of what
 * it is given and appends the freshly mirrored ones — so passing `undefined`
 * for an entity that already exists deletes every hand-authored relation on it,
 * with nothing failing anywhere. `lib/content-edit.ts`'s §2.10 note states the
 * rule from the other side: `lib/articles-store.ts` passes `undefined` and is
 * right to, because that door only ever writes unreviewed sprouts — and it is
 * "wrong for an edit path". `--update` IS an edit path.
 *
 * So: `undefined` on a `create`, where nothing exists yet and there is nothing
 * to preserve; the stored entity's `relations` on an `update`. A default
 * parameter would let the wrong one back in by omission, which is exactly how
 * this bug arrives.
 *
 * DELIBERATELY NOT `buildContentPatch` (`lib/content-edit.ts`), which is the
 * EDITOR's door: it writes ONE NAMED half per call, named by a required `lang`,
 * and carries the OTHER half back verbatim — because the editor is always
 * looking at a single language's view and saving it. A manifest is bilingual
 * at birth — `readText` composes `{ en, fr }` for every narrative in the file
 * — so routing planting through the editor's door would take two calls per
 * entity, one per half, where a manifest wants one write of both; and because
 * each call independently re-derives relations from `extractRefs`, the second
 * call would re-mirror against content the first had just written, doing the
 * mirroring work twice for what should be a single write. `contentPatch`
 * below composes both halves directly instead.
 */
function contentPatch(content: Text, existing: Relation[] | undefined): ContentPatch {
  return { content, relations: mergeMirrored(existing, extractRefs(content)) };
}

/**
 * The plan was computed against ONE snapshot of the garden, so the applier
 * merges relations against that same snapshot rather than re-reading: a second
 * read could answer with a garden that changed in between, and an update would
 * then merge against relations the plan never saw.
 */
export async function applyPlan(
  plan: PlanAction[],
  garden: GardenSlugs,
  assets: UploadedAssets = new Map(),
): Promise<void> {
  for (const action of plan) {
    if (action.action === "skip") continue;

    if (action.tier === "pod") {
      const pod = action.entry;
      if (action.action === "create") {
        await createPod({
          slug: pod.slug,
          name: pod.name,
          plantSlug: pod.plant,
          description: pod.description,
        });
      }
      // Whether just created or already there: a pod's narrative is the one
      // field the creator has no slot for, so it is always a second write.
      if (pod.content !== undefined) {
        const existing =
          action.action === "create"
            ? undefined
            : garden.pods.find((p) => p.slug === pod.slug)?.relations;
        await updatePodContent(pod.slug, contentPatch(pod.content, existing));
      }
      continue;
    }

    if (action.tier === "bean") {
      const bean = action.entry;
      if (action.action === "create") {
        await createBean({
          slug: bean.slug,
          name: bean.name,
          description: bean.description,
          // The pod the manifest nested it under. `plantSlug` is null because
          // the pod carries the plant — see `createBean`'s own comment.
          podSlug: action.parentSlug,
          plantSlug: null,
        });
        if (bean.cover) await updateBeanCover(bean.slug, uploadedFor(assets, bean.cover));
      } else {
        await updateBeanMeta(bean.slug, { name: bean.name, description: bean.description });
        const existing = garden.beans.find((b) => b.slug === bean.slug);
        if (bean.cover && !existing?.cover) {
          await updateBeanCover(bean.slug, uploadedFor(assets, bean.cover));
        }
      }
      continue;
    }

    const sprout = action.entry;
    if (action.action === "create") {
      await createSprout({
        slug: sprout.slug,
        name: sprout.name,
        type: sprout.type,
        date: sprout.date,
        description: sprout.description,
        state: "draft",
        parents: [`bean:${action.parentSlug}`],
        media: (sprout.media ?? []).map((image) => uploadedFor(assets, image)),
        source: { kind: "manifest" },
        ...(sprout.content
          ? { content: sprout.content, relations: mergeMirrored(undefined, extractRefs(sprout.content)) }
          : {}),
      });
    } else {
      await updateSproutMeta(sprout.slug, { name: sprout.name, description: sprout.description });
      const stored = garden.sprouts.find((s) => s.slug === sprout.slug);
      if (sprout.content !== undefined) {
        await updateSproutContent(sprout.slug, contentPatch(sprout.content, stored?.relations));
      }
      if (sprout.media?.length && !stored?.media?.length) {
        await updateSproutMedia(sprout.slug, sprout.media.map((image) => uploadedFor(assets, image)));
      }
    }
  }
}
