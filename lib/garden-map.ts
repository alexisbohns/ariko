import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  aboutRefs,
  hasNarrative,
  parentsWithPrefix,
  resolveSproutPlant,
  resolveText,
  textPart,
  type RawGarden,
  type Seed,
  type Text,
} from "./data";
import { hubHref } from "./plant-path";
import { visibilityOf } from "./plant-visibility";
import { stateOf } from "./sprout-state";

/**
 * The garden map's model — what is drawn, what waits, what is missing.
 *
 * (spec: docs/superpowers/specs/2026-11-15-garden-map-design.md)
 *
 * PURE, and server-only by reach: it imports `lib/data.ts`, which opens with
 * `node:fs`. The client island therefore imports TYPES from here and nothing
 * else (`lib/garden-map-source.test.ts` pins it) — the `lib/palette.ts` /
 * `lib/palette-items.ts` trap, a fourth time.
 *
 * Nothing here re-derives what the garden already decides. A sprout's plant is
 * `resolveSproutPlant`'s answer; visibility is `visibilityOf`'s; a sprout's
 * state is `stateOf`'s; "has a narrative" is `hasNarrative`'s. The map adds
 * the drawing and the flags, not a second opinion about the data.
 */

export type MapNodeKind = "plant" | "pod" | "bean" | "sprout" | "seed" | "bucket";

/**
 * What can be missing on a node.
 *
 *  - `no-narrative` — plant, pod or bean with nothing in `content`.
 *  - `no-fr` — has an English narrative and an empty French half. Never raised
 *    beside `no-narrative`, and never for a French-only narrative.
 *  - `no-children` — a plant with no pods and no beans, a pod with no beans, a
 *    bean with no journal entry of ANY state.
 */
export type MapGap = "no-narrative" | "no-fr" | "no-children";

/** `all` is also `lib/admin-filters.ts`'s `NO_FILTER`, so an `all` view is the
 *  absent query rather than `?view=all`. */
export type MapView = "all" | "review" | "gaps";
export const MAP_VIEWS: readonly MapView[] = ["all", "review", "gaps"];

export function mapViewOf(raw: unknown): MapView {
  return typeof raw === "string" && (MAP_VIEWS as readonly string[]).includes(raw)
    ? (raw as MapView)
    : "all";
}

export interface MapNode {
  /** `plant:slug` · `pod:slug` · `bean:slug` · `sprout:slug` · `seed:id` ·
   *  `bucket:unrooted` · `bucket:inbox`. The first three are the garden's own
   *  prefixed refs, which is what lets a sprout's `about` name a node directly. */
  id: string;
  kind: MapNodeKind;
  label: string;
  /** The admin page this node opens. Absent on a bucket. */
  href?: string;
  /** Waits for the maintainer's review. */
  waiting: boolean;
  gaps: MapGap[];
  /** The active view does not match this node. Dimmed, never hidden. */
  dim: boolean;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
}

export interface GardenMap {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Over the whole (scoped) map, whatever the view. */
  stats: { waiting: number; gaps: number };
}

export interface MapOptions {
  /** A plant slug, or null for the whole garden. */
  scope?: string | null;
  view?: MapView;
}

const UNROOTED = "bucket:unrooted";
const INBOX = "bucket:inbox";
const enc = encodeURIComponent;

function narrativeGaps(content: Text | undefined): MapGap[] {
  if (!hasNarrative(content)) return ["no-narrative"];
  const en = textPart(content, "en").trim() !== "";
  const fr = textPart(content, "fr").trim() !== "";
  return en && !fr ? ["no-fr"] : [];
}

export function buildGardenMap(
  raw: RawGarden,
  seeds: Seed[],
  opts: MapOptions = {},
): GardenMap {
  const scope = opts.scope ?? null;
  const view = opts.view ?? "all";

  const plants = raw.plants ?? [];
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const plantSlugs = new Set(plants.map((p) => p.slug));
  const podSlugs = new Set(pods.map((p) => p.slug));

  // Containment parents that RESOLVE. A dangling ref is not a parent.
  const podPlants = (pod: { parents?: string[] }) =>
    parentsWithPrefix(pod.parents, PLANT_PREFIX).filter((s) => plantSlugs.has(s));
  const beanPods = (bean: { parents?: string[] }) =>
    parentsWithPrefix(bean.parents, POD_PREFIX).filter((s) => podSlugs.has(s));
  const beanPlants = (bean: { parents?: string[] }) =>
    parentsWithPrefix(bean.parents, PLANT_PREFIX).filter((s) => plantSlugs.has(s));

  // Beans with a journal entry of ANY state — published ones are not drawn, but
  // they are why a bean is not "empty".
  const beansWithJournal = new Set<string>();
  for (const sprout of sprouts) {
    for (const ref of aboutRefs(sprout)) {
      if (ref.startsWith(BEAN_PREFIX)) beansWithJournal.add(ref.slice(BEAN_PREFIX.length));
    }
  }

  const nodes = new Map<string, MapNode>();
  const edges: MapEdge[] = [];
  const edgeIds = new Set<string>();
  const connect = (source: string, target: string): void => {
    const id = `${source}>${target}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, source, target });
  };
  const bucket = (id: string, label: string): string => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind: "bucket", label, waiting: false, gaps: [], dim: false });
    }
    return id;
  };
  const labelOf = (text: Text | undefined, fallback: string): string =>
    resolveText(text) || fallback;

  // ---- plants ----
  const keptPlants = plants.filter((p) => scope === null || p.slug === scope);
  for (const plant of keptPlants) {
    const hasChildren =
      pods.some((p) => podPlants(p).includes(plant.slug)) ||
      beans.some((b) => beanPlants(b).includes(plant.slug));
    nodes.set(`plant:${plant.slug}`, {
      id: `plant:${plant.slug}`,
      kind: "plant",
      label: labelOf(plant.name, plant.slug),
      href: hubHref(plant.slug),
      waiting: visibilityOf(plant) !== "public",
      gaps: [...narrativeGaps(plant.content), ...(hasChildren ? [] : (["no-children"] as const))],
      dim: false,
    });
  }

  // ---- pods ----
  const keptPods = pods.filter((p) => scope === null || podPlants(p).includes(scope));
  for (const pod of keptPods) {
    const id = `pod:${pod.slug}`;
    const hasBeans = beans.some((b) => beanPods(b).includes(pod.slug));
    nodes.set(id, {
      id,
      kind: "pod",
      label: labelOf(pod.name, pod.slug),
      href: `/admin/pod/${enc(pod.slug)}`,
      waiting: visibilityOf(pod) !== "public",
      gaps: [...narrativeGaps(pod.content), ...(hasBeans ? [] : (["no-children"] as const))],
      dim: false,
    });
  }
  for (const pod of keptPods) {
    const parents = podPlants(pod).filter((s) => nodes.has(`plant:${s}`));
    if (parents.length === 0) connect(bucket(UNROOTED, "Unrooted"), `pod:${pod.slug}`);
    for (const s of parents) connect(`plant:${s}`, `pod:${pod.slug}`);
  }

  // ---- beans ----
  const keptPodSlugs = new Set(keptPods.map((p) => p.slug));
  const keptBeans = beans.filter(
    (b) =>
      scope === null ||
      beanPlants(b).includes(scope) ||
      beanPods(b).some((s) => keptPodSlugs.has(s)),
  );
  for (const bean of keptBeans) {
    const id = `bean:${bean.slug}`;
    // Machine-projected beans are source-owned and journal-less by
    // construction: every one would flag, which is noise rather than signal.
    const gaps: MapGap[] =
      bean.projected !== undefined
        ? []
        : [
            ...narrativeGaps(bean.content),
            ...(beansWithJournal.has(bean.slug) ? [] : (["no-children"] as const)),
          ];
    nodes.set(id, {
      id,
      kind: "bean",
      label: labelOf(bean.name, bean.slug),
      href: `/admin/bean/${enc(bean.slug)}`,
      waiting: visibilityOf(bean) !== "public",
      gaps,
      dim: false,
    });
  }
  for (const bean of keptBeans) {
    const parents = [
      ...beanPods(bean).map((s) => `pod:${s}`),
      ...beanPlants(bean).map((s) => `plant:${s}`),
    ].filter((id) => nodes.has(id));
    if (parents.length === 0) connect(bucket(UNROOTED, "Unrooted"), `bean:${bean.slug}`);
    for (const parent of parents) connect(parent, `bean:${bean.slug}`);
  }

  // ---- draft sprouts ----
  for (const sprout of sprouts) {
    if (stateOf(sprout) !== "draft") continue;
    const plant = resolveSproutPlant(sprout, raw);
    if (scope !== null && plant?.slug !== scope) continue;

    const id = `sprout:${sprout.slug}`;
    nodes.set(id, {
      id,
      kind: "sprout",
      label: labelOf(sprout.name, sprout.slug),
      href: `/admin/sprout/${enc(sprout.slug)}`,
      waiting: true,
      gaps: [],
      dim: false,
    });

    // What the entry is ABOUT: only pod: and bean: refs name a node a sprout
    // hangs off (a malformed `about` holding `sprout:`, `plant:` or a bucket id
    // must never become an edge), and only the ones that exist here.
    const aboutTargets = aboutRefs(sprout).filter(
      (ref) => (ref.startsWith(POD_PREFIX) || ref.startsWith(BEAN_PREFIX)) && nodes.has(ref),
    );
    // A resolved sprout hangs off what it is about, else its plant. An
    // UNRESOLVED one (ambiguous or dangling) still links to every existing node
    // it is about, so the map keeps what it concerns, and falls to Unrooted
    // only when there is none. Scoped, an unresolved sprout was skipped above.
    let targets: string[] = aboutTargets;
    if (plant !== null && targets.length === 0 && nodes.has(`plant:${plant.slug}`)) {
      targets = [`plant:${plant.slug}`];
    }
    if (targets.length === 0) targets = [bucket(UNROOTED, "Unrooted")];
    for (const target of targets) connect(target, id);
  }

  // ---- inbox seeds ----
  const gardenRefs = new Set<string>([
    ...plants.map((p) => `plant:${p.slug}`),
    ...pods.map((p) => `pod:${p.slug}`),
    ...beans.map((b) => `bean:${b.slug}`),
  ]);
  for (const seed of seeds) {
    if (seed.status !== "inbox") continue;
    const s = seed.suggested;
    const candidates = [
      s?.beanSlug ? `bean:${s.beanSlug}` : null,
      s?.podSlug ? `pod:${s.podSlug}` : null,
      s?.plantSlug ? `plant:${s.plantSlug}` : null,
    ];
    // Resolved against the whole garden first, so the most specific suggestion
    // wins the same way in every scope; scope then decides whether it is drawn.
    const target = candidates.find((c): c is string => c !== null && gardenRefs.has(c));
    if (scope !== null && (target === undefined || !nodes.has(target))) continue;
    const id = `seed:${seed.id}`;
    nodes.set(id, {
      id,
      kind: "seed",
      label: labelOf(seed.title, "Untitled seed"),
      href: `/admin/triage/${enc(seed.id)}`,
      waiting: true,
      gaps: [],
      dim: false,
    });
    connect(target ?? bucket(INBOX, "Inbox"), id);
  }

  // ---- view + stats ----
  const matches = (n: MapNode): boolean =>
    view === "review" ? n.waiting : view === "gaps" ? n.gaps.length > 0 : true;
  // A bucket carries no flags, so dimming it would only grey the parent of lit children.
  const list = [...nodes.values()].map((n) => ({ ...n, dim: n.kind !== "bucket" && !matches(n) }));
  return {
    nodes: list,
    edges,
    stats: {
      waiting: list.filter((n) => n.waiting).length,
      gaps: list.filter((n) => n.gaps.length > 0).length,
    },
  };
}
