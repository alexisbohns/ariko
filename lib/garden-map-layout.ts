import type { GardenMap, MapEdge, MapNode, MapNodeKind } from "./garden-map";

/**
 * Positions for the garden map. Pure, and run on the SERVER: the island ships
 * no layout code, only the finished coordinates.
 *
 * Plants run side by side across the top. Under each plant its pods sit in a
 * row, and under each pod its beans stack in an indented column, like a file
 * tree with a trunk line down the left; a bean's own draft sprouts and seed
 * count sit one indent further in, right under it. What hangs directly off a
 * plant (its own beans and sprouts) is a first, head-less column to the left
 * of its pods. The Unrooted and Inbox buckets are roots too and come last.
 *
 * A node is placed ONCE, under its PRIMARY parent: the source of the first
 * edge in `map.edges` that targets it. Its other edges are kept and drawn but
 * do not move anything, so a bean shared by two pods stands under the first
 * and a line reaches it from the second.
 *
 * Deterministic and dependency-free: it is arithmetic over `map.nodes` order.
 * A node no root reaches (a cycle, a missing parent) goes into a final block
 * rather than being dropped, so the map can never silently lose a node.
 *
 * Sizes are FIXED per kind, which is what makes this layout possible without
 * measuring anything: `garden-map-node.tsx` draws each card to exactly these
 * dimensions. Change one side and the other has to follow — the card's chips
 * wrap inside `overflow-hidden`, so a size that is too small clips rather than
 * overlaps, and the overlap test in `garden-map-layout.test.ts` would not
 * notice a clipped chip. Look at it.
 */
export const KIND_SIZE: Readonly<Record<MapNodeKind, { width: number; height: number }>> = {
  plant: { width: 260, height: 76 },
  pod: { width: 260, height: 76 },
  bean: { width: 260, height: 76 },
  sprout: { width: 200, height: 60 },
  seed: { width: 200, height: 60 },
  bucket: { width: 150, height: 44 },
};

/**
 * Spacing, in flow units. `INDENT / 2` is also where an edge's trunk handle
 * sits on a card (`garden-map.tsx` repeats it as 14) — change one, change both.
 */
const INDENT = 28;
export const LAYOUT = {
  INDENT,
  COLUMN_GAP: 24,
  BLOCK_GAP: 64,
  ROW_GAP: 56,
  ITEM_GAP: 12,
  /** A depth-1 card (260 wide) still fits after one indent. */
  COLUMN_WIDTH: INDENT + KIND_SIZE.bean.width,
} as const;

export interface PositionedNode extends MapNode {
  /** Top-left, as React Flow wants it. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where an edge leaves its source and enters its target. A plant-to-pod edge
 *  drops from the bottom of the plant into the top of the pod; every other edge
 *  leaves the trunk (a point near the left of the parent's bottom) and enters
 *  the child's left side: down, then right — the file-tree elbow. */
export interface PositionedEdge extends MapEdge {
  sourceHandle: "bottom" | "trunk";
  targetHandle: "top" | "left";
}

export interface PositionedMap {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  stats: GardenMap["stats"];
}

export function layoutGardenMap(map: GardenMap): PositionedMap {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));

  // Primary parent: the source of the first edge into a node. An edge from a
  // node that is not on the map is still an incoming edge — its target is no
  // root — and ends up in the stray block, never dropped.
  const primary = new Map<string, string>();
  for (const edge of map.edges) if (!primary.has(edge.target)) primary.set(edge.target, edge.source);
  const children = new Map<string, MapNode[]>();
  for (const node of map.nodes) {
    const parent = primary.get(node.id);
    if (parent === undefined || !byId.has(parent)) continue;
    const list = children.get(parent);
    if (list) list.push(node);
    else children.set(parent, [node]);
  }

  const roots = map.nodes.filter((node) => !primary.has(node.id));
  const rootHeight = roots.reduce((tallest, root) => Math.max(tallest, KIND_SIZE[root.kind].height), 0);
  const rowY = rootHeight + LAYOUT.ROW_GAP;

  const placed = new Map<string, PositionedNode>();
  const place = (node: MapNode, x: number, y: number): number => {
    const { width, height } = KIND_SIZE[node.kind];
    placed.set(node.id, { ...node, x, y, width, height });
    return y + height + LAYOUT.ITEM_GAP;
  };

  /** Depth-first under `parent`, each child one indent deeper. Returns the y
   *  of the next free slot. */
  const stack = (parent: MapNode, left: number, depth: number, y: number): number => {
    for (const child of children.get(parent.id) ?? []) {
      if (placed.has(child.id)) continue;
      y = place(child, left + depth * LAYOUT.INDENT, y);
      y = stack(child, left, depth + 1, y);
    }
    return y;
  };

  let cursor = 0;
  for (const root of roots) {
    const kids = (children.get(root.id) ?? []).filter((child) => !placed.has(child.id));
    const pods = kids.filter((child) => child.kind === "pod");
    // The loose column: everything attached to the root that is not a pod.
    const loose = kids.filter((child) => child.kind !== "pod");
    const columns = (loose.length > 0 ? 1 : 0) + pods.length;

    place(root, cursor, 0);
    let left = cursor;
    if (loose.length > 0) {
      let y = rowY;
      for (const item of loose) {
        y = place(item, left + LAYOUT.INDENT, y);
        y = stack(item, left, 2, y);
      }
      left += LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP;
    }
    for (const pod of pods) {
      stack(pod, left, 1, place(pod, left, rowY));
      left += LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP;
    }

    const columnsWidth = columns * LAYOUT.COLUMN_WIDTH + Math.max(0, columns - 1) * LAYOUT.COLUMN_GAP;
    cursor += Math.max(KIND_SIZE[root.kind].width, columnsWidth) + LAYOUT.BLOCK_GAP;
  }

  // Safety: anything no root reached, in input order, as one flat column.
  let strayY = rowY;
  for (const node of map.nodes) {
    if (placed.has(node.id)) continue;
    strayY = place(node, cursor, strayY);
  }

  const nodes = map.nodes.map((node) => placed.get(node.id) as PositionedNode);
  const edges = map.edges.map((edge): PositionedEdge => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const drop = target?.kind === "pod" && (source?.kind === "plant" || source?.kind === "bucket");
    return { ...edge, sourceHandle: drop ? "bottom" : "trunk", targetHandle: drop ? "top" : "left" };
  });
  return { nodes, edges, stats: map.stats };
}
