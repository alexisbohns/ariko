/**
 * What planting a manifest would actually DO to THIS garden, decided before
 * anything is written.
 *
 * Separate from `lib/garden-manifest.ts` on purpose: the manifest fails
 * because the AUTHOR made a mistake (a bad slug, a missing field) and can be
 * reported with no database in the loop; a plan is surprising because the
 * GARDEN already has something in it, which can only be known by looking.
 * Keeping them apart is what lets the diff logic here be tested with two
 * arrays and no YAML, and the validator be tested with no garden at all.
 *
 * Pure — no `getDb`, no `node:fs`, no argv. It takes already-loaded slugs and
 * hands back a plan; the applier (a later task) is the only thing that writes.
 *
 * ORDER IS THE OUTPUT, not an implementation detail: a bean's `parents` names
 * its pod and a sprout's names its bean, so `planGarden` emits pod, then each
 * bean immediately followed by its own sprouts, in manifest order — the exact
 * order a parent-first applier needs to walk. The read path
 * (`lib/store.ts`/`lib/data.ts`) TOLERATES a dangling parent ref by ignoring
 * it, which is precisely why getting this order wrong is dangerous rather
 * than loud: creating a bean before its pod exists would not fail, the
 * `parents: ["pod:krabs"]` write would simply resolve to nothing yet, and the
 * bean would sit in Mongo, valid and permanently unreachable from the pod
 * page that is supposed to list it, with no error anywhere to notice.
 */
import type { Pod, Bean, Sprout } from "./data";
import type { GardenManifest, ManifestPod, ManifestBean, ManifestSprout } from "./garden-manifest";

export type Tier = "pod" | "bean" | "sprout";
export type Verb = "create" | "skip" | "update";

export interface PlanAction {
  action: Verb;
  tier: Tier;
  slug: string;
  /** The manifest entry this action is for; the applier reads it. */
  entry: ManifestPod | ManifestBean | ManifestSprout;
  /** The bean a sprout hangs from / the pod a bean hangs from. Absent on the pod. */
  parentSlug?: string;
}

export interface GardenSlugs {
  pods: Pod[];
  beans: Bean[];
  sprouts: Sprout[];
}

export interface PlanOptions {
  update: boolean;
}

function verbFor(exists: boolean, update: boolean): Verb {
  if (!exists) return "create";
  return update ? "update" : "skip";
}

export function planGarden(manifest: GardenManifest, garden: GardenSlugs, opts: PlanOptions): PlanAction[] {
  const podSlugs = new Set(garden.pods.map((p) => p.slug));
  const beanSlugs = new Set(garden.beans.map((b) => b.slug));
  const sproutSlugs = new Set(garden.sprouts.map((s) => s.slug));

  const actions: PlanAction[] = [];

  actions.push({
    action: verbFor(podSlugs.has(manifest.pod.slug), opts.update),
    tier: "pod",
    slug: manifest.pod.slug,
    entry: manifest.pod,
  });

  for (const bean of manifest.beans) {
    actions.push({
      action: verbFor(beanSlugs.has(bean.slug), opts.update),
      tier: "bean",
      slug: bean.slug,
      entry: bean,
      parentSlug: manifest.pod.slug,
    });
    for (const sprout of bean.sprouts) {
      actions.push({
        action: verbFor(sproutSlugs.has(sprout.slug), opts.update),
        tier: "sprout",
        slug: sprout.slug,
        entry: sprout,
        parentSlug: bean.slug,
      });
    }
  }

  return actions;
}

const INDENT: Record<Tier, string> = { pod: "", bean: "  ", sprout: "    " };

export function renderPlan(actions: PlanAction[]): string {
  const lines = actions.map((a) => `${INDENT[a.tier]}${a.action} ${a.tier} ${a.slug}`);

  const creates = actions.filter((a) => a.action === "create").length;
  const updates = actions.filter((a) => a.action === "update").length;
  const skips = actions.filter((a) => a.action === "skip").length;

  const summary = `${creates} create${creates === 1 ? "" : "s"}, ${updates} update${
    updates === 1 ? "" : "s"
  }, ${skips} skip${skips === 1 ? "" : "s"}`;

  return `${lines.join("\n")}\n\n${summary}`;
}
