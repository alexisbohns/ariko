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

/**
 * A DISCRIMINATED UNION, not one flat interface with a `tier` beside a widened
 * `entry`. The flat shape typechecked and told the compiler nothing: `tier` and
 * `entry` were independent, so `switch (action.tier)` narrowed neither, and the
 * applier had to reach for `action.entry as ManifestBean` — an assertion `tsc`
 * cannot check, which would keep compiling on the day a builder emitted
 * `tier: "bean"` beside a sprout entry and would hand `createBean` a sprout's
 * fields at the write.
 *
 * `parentSlug` gets the same treatment: REQUIRED on a bean and a sprout,
 * ABSENT on the pod. Optional-everywhere is what forced `parentSlug ?? null`
 * into `createBean`'s call, and that fallback is a nullable parentage written
 * into the database — a bean silently hanging from no pod, which the read path
 * tolerates by simply never listing it (see this file's ORDER note).
 */
export type PlanAction =
  | { action: Verb; tier: "pod"; slug: string; entry: ManifestPod; narrativeKept?: true }
  | { action: Verb; tier: "bean"; slug: string; entry: ManifestBean; parentSlug: string; narrativeKept?: true }
  | { action: Verb; tier: "sprout"; slug: string; entry: ManifestSprout; parentSlug: string };

/**
 * `narrativeKept` is set on an `update` of a pod or bean whose stored
 * `visibility` is `"public"` and whose manifest entry carries `content`: the
 * applier will NOT write that content. A published narrative is a decision
 * made in the admin — the same rule the cover and media already obey — and a
 * routine re-plant must not undo it; it is also what keeps the cached public
 * dataset untouched by a CLI that cannot invalidate it (CLAUDE.md, "Planting
 * a project from another repo"). It is decided HERE, on the plan a human
 * reads, rather than silently inside the applier, so the dry-run tree says
 * which narratives the manifest's text will not reach. Strictly `=== "public"`,
 * like `/api/articles`'s own refusal: an absent visibility is not a publish.
 */
export function keepsPublishedNarrative(
  verb: Verb,
  entry: { content?: unknown },
  stored: { visibility?: string } | undefined,
): boolean {
  return verb === "update" && entry.content !== undefined && stored?.visibility === "public";
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

  const podVerb = verbFor(podSlugs.has(manifest.pod.slug), opts.update);
  const storedPod = garden.pods.find((p) => p.slug === manifest.pod.slug);
  actions.push({
    action: podVerb,
    tier: "pod",
    slug: manifest.pod.slug,
    entry: manifest.pod,
    ...(keepsPublishedNarrative(podVerb, manifest.pod, storedPod) ? { narrativeKept: true } : {}),
  });

  for (const bean of manifest.beans) {
    const beanVerb = verbFor(beanSlugs.has(bean.slug), opts.update);
    const storedBean = garden.beans.find((b) => b.slug === bean.slug);
    actions.push({
      action: beanVerb,
      tier: "bean",
      slug: bean.slug,
      entry: bean,
      parentSlug: manifest.pod.slug,
      ...(keepsPublishedNarrative(beanVerb, bean, storedBean) ? { narrativeKept: true } : {}),
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
  // The verb is padded to a fixed width so the tier and slug form COLUMNS. A
  // human reads this output to decide whether to authorise a write to the real
  // garden, and `create`/`skip`/`update` differ in width — unpadded, every
  // line's tier starts at a different offset and a stray `update` in a wall of
  // `skip`s has nothing to stand out against. Legibility is the safety property
  // a plan exists for.
  // The note is a SUFFIX so the columns above stay aligned; it names the one
  // thing an `update` line otherwise implies and will not do.
  const lines = actions.map(
    (a) =>
      `${INDENT[a.tier]}${a.action.padEnd(6)} ${a.tier} ${a.slug}${
        "narrativeKept" in a && a.narrativeKept ? " (narrative kept: published)" : ""
      }`,
  );

  const creates = actions.filter((a) => a.action === "create").length;
  const updates = actions.filter((a) => a.action === "update").length;
  const skips = actions.filter((a) => a.action === "skip").length;

  const summary = `${creates} create${creates === 1 ? "" : "s"}, ${updates} update${
    updates === 1 ? "" : "s"
  }, ${skips} skip${skips === 1 ? "" : "s"}`;

  return `${lines.join("\n")}\n\n${summary}`;
}
