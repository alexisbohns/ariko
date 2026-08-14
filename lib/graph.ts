import { BEAN_PREFIX, POD_PREFIX, SPROUT_PREFIX, parentsWithPrefix, resolveText, type Domain, type RawGarden } from "./data";

// Graph projection of a RawGarden (roadmap G1) — the graph playground's data
// contract. Projection-agnostic: serializes whatever seed it is given, so the
// public route feeds it filterPublic's output and a future admin vault-graph
// can feed it the full dataset. Node ids reuse the prefixed-ref grammar
// ("pod:slug" / "bean:slug", plus "sprout:slug"); slugs are immutable,
// so ids are stable across publishes.

export interface GraphNode {
  id: string; // "pod:slug" | "bean:slug" | "sprout:slug"
  kind: "pod" | "bean" | "sprout";
  name: string; // resolved at serialization time (B1) — the contract's shape never widens; a ?lang= param is a later slice
  domain?: Domain; // pods only
  type?: string; // sprouts only
  date?: string; // sprouts only
  tags?: string[]; // any kind, only when non-empty
}

export interface GraphEdge {
  source: string; // containment: container node id; relation: the declaring sprout's node id
  target: string; // containment: contained node id; relation: rel.ref (already a prefixed node id)
  kind: string; // "contains" for containment; relation kinds are free strings (G2)
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Node payload is deliberately minimal (spec: no description/content/media/
// source — what a focused node displays is B3's decision). tags only when
// non-empty. Edges: containment derived from parents[], then one edge per
// sprout relation (G2) with its kind passed through; every edge is emitted
// only when BOTH ends exist as nodes in the given seed (prune, don't cascade —
// dangling refs silently drop, matching every existing read path; for
// projected seeds this is belt-and-braces on top of filterPublic's scrub).
// Duplicate (source, target, kind) triples dedupe — the same pair may carry
// several kinds. Deterministic: nodes in input order (pods, beans,
// sprouts); containment edges in child input order, then relation edges in
// sprout-then-declaration order.
export function toGraph(raw: RawGarden): Graph {
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const nodes: GraphNode[] = [
    ...pods.map((m) =>
      withTags({ id: POD_PREFIX + m.slug, kind: "pod" as const, name: resolveText(m.name), domain: m.domain }, m.tags),
    ),
    ...beans.map((a) => withTags({ id: BEAN_PREFIX + a.slug, kind: "bean" as const, name: resolveText(a.name) }, a.tags)),
    ...sprouts.map((v) =>
      withTags(
        { id: SPROUT_PREFIX + v.slug, kind: "sprout" as const, name: resolveText(v.name), type: v.type, date: v.date },
        v.tags,
      ),
    ),
  ];

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

  for (const atom of beans) {
    for (const slug of parentsWithPrefix(atom.parents, POD_PREFIX)) {
      if (podSlugs.has(slug)) addEdge(POD_PREFIX + slug, BEAN_PREFIX + atom.slug, "contains");
    }
  }
  for (const version of sprouts) {
    for (const slug of parentsWithPrefix(version.parents, BEAN_PREFIX)) {
      if (beanSlugs.has(slug)) addEdge(BEAN_PREFIX + slug, SPROUT_PREFIX + version.slug, "contains");
    }
  }

  // Relation edges after all containment: source is the declaring version,
  // target is the relation's ref verbatim — both must be node ids here.
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const version of sprouts) {
    const source = SPROUT_PREFIX + version.slug;
    for (const rel of version.relations ?? []) {
      if (nodeIds.has(source) && nodeIds.has(rel.ref)) addEdge(source, rel.ref, rel.kind);
    }
  }

  return { nodes, edges };
}

function withTags(node: GraphNode, tags: string[] | undefined): GraphNode {
  return tags && tags.length > 0 ? { ...node, tags } : node;
}
