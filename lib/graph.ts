import { ATOM_PREFIX, MOLECULE_PREFIX, VERSION_PREFIX, parentsWithPrefix, resolveText, type Domain, type RawSeed } from "./data";

// Graph projection of a RawSeed (roadmap G1) — the graph playground's data
// contract. Projection-agnostic: serializes whatever seed it is given, so the
// public route feeds it filterPublic's output and a future admin vault-graph
// can feed it the full dataset. Node ids reuse the prefixed-ref grammar
// ("molecule:slug" / "atom:slug", plus "version:slug"); slugs are immutable,
// so ids are stable across publishes.

export interface GraphNode {
  id: string; // "molecule:slug" | "atom:slug" | "version:slug"
  kind: "molecule" | "atom" | "version";
  name: string; // resolved at serialization time (B1) — the contract's shape never widens; a ?lang= param is a later slice
  domain?: Domain; // molecules only
  type?: string; // versions only
  date?: string; // versions only
  tags?: string[]; // any kind, only when non-empty
}

export interface GraphEdge {
  source: string; // containment: container node id; relation: the declaring version's node id
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
// version relation (G2) with its kind passed through; every edge is emitted
// only when BOTH ends exist as nodes in the given seed (prune, don't cascade —
// dangling refs silently drop, matching every existing read path; for
// projected seeds this is belt-and-braces on top of filterPublic's scrub).
// Duplicate (source, target, kind) triples dedupe — the same pair may carry
// several kinds. Deterministic: nodes in input order (molecules, atoms,
// versions); containment edges in child input order, then relation edges in
// version-then-declaration order.
export function toGraph(raw: RawSeed): Graph {
  const molecules = raw.molecules ?? [];
  const atoms = raw.atoms ?? [];
  const versions = raw.versions ?? [];

  const nodes: GraphNode[] = [
    ...molecules.map((m) =>
      withTags({ id: MOLECULE_PREFIX + m.slug, kind: "molecule" as const, name: resolveText(m.name), domain: m.domain }, m.tags),
    ),
    ...atoms.map((a) => withTags({ id: ATOM_PREFIX + a.slug, kind: "atom" as const, name: resolveText(a.name) }, a.tags)),
    ...versions.map((v) =>
      withTags(
        { id: VERSION_PREFIX + v.slug, kind: "version" as const, name: resolveText(v.name), type: v.type, date: v.date },
        v.tags,
      ),
    ),
  ];

  const moleculeSlugs = new Set(molecules.map((m) => m.slug));
  const atomSlugs = new Set(atoms.map((a) => a.slug));

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

  for (const atom of atoms) {
    for (const slug of parentsWithPrefix(atom.parents, MOLECULE_PREFIX)) {
      if (moleculeSlugs.has(slug)) addEdge(MOLECULE_PREFIX + slug, ATOM_PREFIX + atom.slug, "contains");
    }
  }
  for (const version of versions) {
    for (const slug of parentsWithPrefix(version.parents, ATOM_PREFIX)) {
      if (atomSlugs.has(slug)) addEdge(ATOM_PREFIX + slug, VERSION_PREFIX + version.slug, "contains");
    }
  }

  // Relation edges after all containment: source is the declaring version,
  // target is the relation's ref verbatim — both must be node ids here.
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const version of versions) {
    const source = VERSION_PREFIX + version.slug;
    for (const rel of version.relations ?? []) {
      if (nodeIds.has(source) && nodeIds.has(rel.ref)) addEdge(source, rel.ref, rel.kind);
    }
  }

  return { nodes, edges };
}

function withTags(node: GraphNode, tags: string[] | undefined): GraphNode {
  return tags && tags.length > 0 ? { ...node, tags } : node;
}
