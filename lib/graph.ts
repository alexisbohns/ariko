import {
  BEAN_PREFIX, BEE_PREFIX, PLANT_PREFIX, POD_PREFIX, SPROUT_PREFIX,
  parentsWithPrefix, resolveText, type PlantNature, type RawGarden, type Text,
} from "./data";

// Graph projection of a RawGarden (roadmap G1) — the graph playground's data
// contract. Projection-agnostic: serializes whatever seed it is given, so the
// public route feeds it filterPublic's output and a future admin vault-graph
// can feed it the full dataset. Node ids reuse the prefixed-ref grammar
// ("plant:slug" / "pod:slug" / "bean:slug" / "sprout:slug" / "bee:slug");
// slugs are immutable, so ids are stable across publishes.

export interface GraphNode {
  id: string; // "plant:slug" | "pod:slug" | "bean:slug" | "sprout:slug" | "bee:slug"
  kind: "plant" | "pod" | "bean" | "sprout" | "bee";
  name: string; // resolved at serialization time (B1)
  description?: string; // resolved (B1); emitted only when non-blank (slice 2)
  natures?: PlantNature[]; // plants only
  type?: string; // sprouts (sprout.type) and bees (bee.kind)
  date?: string; // sprouts only
  status?: string; // bees only
  tags?: string[]; // content kinds (never bees), only when non-empty
}

export interface GraphEdge {
  source: string; // containment: container node id; relation: the declaring plant's or sprout's node id; serves: the bee's node id
  target: string; // containment: contained node id; relation: rel.ref; serves: the served plant ref (all prefixed node ids)
  kind: string; // "contains" for containment; relation kinds are free strings (G2); "serves" for bee edges
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Node payload stays minimal apart from description (slice 2 — the route
// composes filterPublic, so a serialized node is already public HTML): no
// content/media/source/levers/serves. tags and description only when non-empty. Edges: containment derived from parents[] (plant→pod,
// plant→bean, pod→bean, bean→sprout), then relation edges — plant relations,
// sprout relations (G2) with their kinds passed through, then bee serves —
// every edge emitted only when BOTH ends exist as nodes in the given seed
// (prune, don't cascade — dangling refs silently drop, matching every existing
// read path; for projected seeds this is belt-and-braces on top of
// filterPublic's scrub). Duplicate (source, target, kind) triples dedupe — the
// same pair may carry several kinds. Deterministic: nodes in input order
// (plants, pods, beans, sprouts, bees); containment edges in child input
// order, then relation edges in declarer-then-declaration order.
export function toGraph(raw: RawGarden): Graph {
  const plants = raw.plants ?? [];
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];
  const bees = raw.bees ?? [];

  const nodes: GraphNode[] = [
    ...plants.map((p) =>
      decorate({ id: PLANT_PREFIX + p.slug, kind: "plant" as const, name: resolveText(p.name), natures: p.natures }, p),
    ),
    ...pods.map((m) => decorate({ id: POD_PREFIX + m.slug, kind: "pod" as const, name: resolveText(m.name) }, m)),
    ...beans.map((a) => decorate({ id: BEAN_PREFIX + a.slug, kind: "bean" as const, name: resolveText(a.name) }, a)),
    ...sprouts.map((v) =>
      decorate(
        { id: SPROUT_PREFIX + v.slug, kind: "sprout" as const, name: resolveText(v.name), type: v.type, date: v.date },
        v,
      ),
    ),
    // Bee has no tags field, so it passes an explicit object rather than the doc.
    ...bees.map((b) =>
      decorate(
        { id: BEE_PREFIX + b.slug, kind: "bee" as const, name: resolveText(b.name), type: b.kind, status: b.status },
        { description: b.description },
      ),
    ),
  ];

  const plantSlugSet = new Set(plants.map((p) => p.slug));
  const podSlugs = new Set(pods.map((m) => m.slug));
  const beanSlugs = new Set(beans.map((a) => a.slug));

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  function addEdge(source: string, target: string, kind: string): void {
    // Tuple key: slugs and kinds are unrestricted free text, so no flat
    // separator is collision-proof.
    const key = JSON.stringify([source, target, kind]);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  }

  for (const pod of pods) {
    for (const slug of parentsWithPrefix(pod.parents, PLANT_PREFIX)) {
      if (plantSlugSet.has(slug)) addEdge(PLANT_PREFIX + slug, POD_PREFIX + pod.slug, "contains");
    }
  }
  for (const bean of beans) {
    for (const slug of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
      if (plantSlugSet.has(slug)) addEdge(PLANT_PREFIX + slug, BEAN_PREFIX + bean.slug, "contains");
    }
  }
  for (const bean of beans) {
    for (const slug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      if (podSlugs.has(slug)) addEdge(POD_PREFIX + slug, BEAN_PREFIX + bean.slug, "contains");
    }
  }
  for (const sprout of sprouts) {
    for (const slug of parentsWithPrefix(sprout.parents, BEAN_PREFIX)) {
      if (beanSlugs.has(slug)) addEdge(BEAN_PREFIX + slug, SPROUT_PREFIX + sprout.slug, "contains");
    }
  }

  // Relation edges after all containment: source is the declaring plant/sprout
  // (or the serving bee), target is the relation's ref verbatim — both must be
  // node ids here.
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const plant of plants) {
    const source = PLANT_PREFIX + plant.slug;
    for (const rel of plant.relations ?? []) {
      if (nodeIds.has(source) && nodeIds.has(rel.ref)) addEdge(source, rel.ref, rel.kind);
    }
  }
  for (const sprout of sprouts) {
    const source = SPROUT_PREFIX + sprout.slug;
    for (const rel of sprout.relations ?? []) {
      if (nodeIds.has(source) && nodeIds.has(rel.ref)) addEdge(source, rel.ref, rel.kind);
    }
  }
  for (const bee of bees) {
    const source = BEE_PREFIX + bee.slug;
    for (const ref of bee.serves ?? []) {
      if (nodeIds.has(source) && nodeIds.has(ref)) addEdge(source, ref, "serves");
    }
  }

  return { nodes, edges };
}

// Optional payload fields ride along only when they carry something: a
// description when it resolves non-blank, tags when the array is non-empty.
function decorate(node: GraphNode, extra: { description?: Text; tags?: string[] }): GraphNode {
  const description = resolveText(extra.description ?? "").trim();
  return {
    ...node,
    ...(description ? { description } : {}),
    ...(extra.tags && extra.tags.length > 0 ? { tags: extra.tags } : {}),
  };
}
