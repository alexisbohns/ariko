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
 *  - `--update` TOUCHES `name`, `description` AND `content` ONLY. That is why
 *    the update branches call the narrow writers (`updateBeanMeta`,
 *    `updateSproutMeta`, the two content writers) rather than re-running a
 *    creator: a creator would re-assert every field, parentage included.
 */
import { createPod, createBean, createSprout, updatePodContent, updateBeanMeta, updateSproutMeta, updateSproutContent } from "./botanical";
import { extractRefs, mergeMirrored } from "./entity-refs";
import type { Text } from "./data";
import type { ContentPatch } from "./content-edit";
import type { PlanAction } from "./garden-plan";
import type { ManifestPod, ManifestBean, ManifestSprout } from "./garden-manifest";

/**
 * A content write, composed the way the OTHER non-editor door composes one
 * (`lib/articles-store.ts`: `mergeMirrored(undefined, extractRefs(...))`).
 *
 * DELIBERATELY NOT `buildContentPatch` (`lib/content-edit.ts`), which is the
 * EDITOR's door and is `en`-only by design: it takes one markdown string, and
 * carries a stored `fr` half back verbatim because the editor can only ever
 * have been editing the English one. It cannot SET an `fr` half at all. A
 * manifest is bilingual at birth — `readText` composes `{ en, fr }` for every
 * narrative in the file — so routing planting through the editor's door would
 * silently drop every French narrative the author wrote: the plant would
 * succeed, the plan would print the same lines, the English would be perfect,
 * and the French would simply never exist, with nothing anywhere reporting it.
 *
 * `undefined` for the existing relations is correct rather than lazy: mirrored
 * kinds are derived state that every write recomputes from the body, and a
 * manifest may not author `relations` at all (`FORBIDDEN_KEYS`). On an update
 * this drops any hand-authored non-mirrored kinds the entity had — the
 * accepted trade the articles door already makes, and the reason `--update` is
 * opt-in.
 */
function contentPatch(content: Text): ContentPatch {
  return { content, relations: mergeMirrored(undefined, extractRefs(content)) };
}

export async function applyPlan(plan: PlanAction[]): Promise<void> {
  for (const action of plan) {
    if (action.action === "skip") continue;

    if (action.tier === "pod") {
      const pod = action.entry as ManifestPod;
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
        await updatePodContent(pod.slug, contentPatch(pod.content));
      }
      continue;
    }

    if (action.tier === "bean") {
      const bean = action.entry as ManifestBean;
      if (action.action === "create") {
        await createBean({
          slug: bean.slug,
          name: bean.name,
          description: bean.description,
          // The pod the manifest nested it under. `plantSlug` is null because
          // the pod carries the plant — see `createBean`'s own comment.
          podSlug: action.parentSlug ?? null,
          plantSlug: null,
        });
      } else {
        await updateBeanMeta(bean.slug, { name: bean.name, description: bean.description });
      }
      continue;
    }

    const sprout = action.entry as ManifestSprout;
    if (action.action === "create") {
      await createSprout({
        slug: sprout.slug,
        name: sprout.name,
        type: sprout.type,
        date: sprout.date,
        description: sprout.description,
        state: "draft",
        parents: [`bean:${action.parentSlug}`],
        media: [],
        source: { kind: "manifest" },
        ...(sprout.content
          ? { content: sprout.content, relations: mergeMirrored(undefined, extractRefs(sprout.content)) }
          : {}),
      });
    } else {
      await updateSproutMeta(sprout.slug, { name: sprout.name, description: sprout.description });
      if (sprout.content !== undefined) {
        await updateSproutContent(sprout.slug, contentPatch(sprout.content));
      }
    }
  }
}
