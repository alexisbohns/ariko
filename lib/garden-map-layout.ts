import type { GardenMap, MapEdge, MapNode, MapNodeKind } from "./garden-map";

/**
 * Positions for the garden map. Pure, and run on the SERVER: the island ships
 * no layout code, only the finished coordinates.
 *
 * Roots (the plants, then the Unrooted and Inbox buckets) stand side by side
 * across the top, each over a BLOCK. Under a root there are two kinds of
 * column, both `COLUMN_WIDTH` wide, with every card centred in its column:
 *
 *  - a POD COLUMN: the pod card, then its beans stacked straight down beneath
 *    it, each bean's own draft sprouts and seed count right under that bean;
 *  - a LOOSE CELL: any other child of the root (a bean planted directly on a
 *    plant, a plant-level draft sprout, a seed count) stacked the same way,
 *    with its own descendants under it. Cells are laid out as a grid, row-major
 *    in input order — four across when they are alone, two across when the
 *    root also has pods, in which case the grid is the leftmost thing in the
 *    block and the pods follow to its right.
 *
 * The root card is centred over its block. All root cards share y = 0 and every
 * block's columns start on one row, `ROW_Y`, so rows align across plants.
 *
 * A node is placed ONCE, under its PRIMARY parent: the source of the first
 * edge in `map.edges` that targets it. Its other edges are kept and drawn but
 * do not move anything, so a bean shared by two pods stands under the first and
 * a curve reaches it from the second.
 *
 * Deterministic and dependency-free: it is arithmetic over `map.nodes` order.
 * A node no root reaches (a cycle, a missing parent) goes into a final block
 * rather than being dropped, so the map can never silently lose a node.
 *
 * Sizes are FIXED per kind, which is what makes this layout possible without
 * measuring anything: `garden-map-node.tsx` draws each card to exactly these
 * dimensions. Change one side and the other has to follow — a card's chips are
 * `overflow-hidden`, so a size that is too small clips rather than overlaps,
 * and the overlap test in `garden-map-layout.test.ts` would not notice a
 * clipped chip. Look at it.
 */
export const KIND_SIZE: Readonly<Record<MapNodeKind, { width: number; height: number }>> = {
  plant: { width: 300, height: 88 },
  pod: { width: 220, height: 124 },
  bean: { width: 220, height: 60 },
  sprout: { width: 180, height: 44 },
  seed: { width: 180, height: 44 },
  bucket: { width: 150, height: 44 },
};

/** Spacing, in flow units. */
export const LAYOUT = {
  /** Every non-root card is centred in a column this wide: the widest of them
   *  (a pod or a bean) fills it. */
  COLUMN_WIDTH: 220,
  COLUMN_GAP: 28,
  BLOCK_GAP: 96,
  ROW_GAP: 72,
  ITEM_GAP: 28,
  /** How many loose cells stand across when the root also has pods... */
  LOOSE_COLS_WITH_PODS: 2,
  /** ...and when it has none. */
  LOOSE_COLS_ALONE: 4,
} as const;

export interface PositionedNode extends MapNode {
  /** Top-left, as React Flow wants it. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedMap {
  nodes: PositionedNode[];
  /** Exactly the builder's edges: every one runs from the bottom-centre of its
   *  source to the top-centre of its target, so none needs a handle named. */
  edges: MapEdge[];
  stats: GardenMap["stats"];
}

/** A card and what stands under it, as offsets from the cell's top-left. */
interface Cell {
  items: Array<{ node: MapNode; dy: number }>;
  height: number;
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
  const place = (node: MapNode, x: number, y: number): void => {
    const { width, height } = KIND_SIZE[node.kind];
    placed.set(node.id, { ...node, x, y, width, height });
  };
  /** Centres a card of `node`'s width in the column whose left edge is `left`. */
  const centred = (node: MapNode, left: number): number => left + (LAYOUT.COLUMN_WIDTH - KIND_SIZE[node.kind].width) / 2;

  /** `head` and everything under it, depth-first: the card, then each child
   *  followed by that child's own children. */
  const cellOf = (head: MapNode): Cell => {
    const items: Cell["items"] = [];
    let y = 0;
    const walk = (node: MapNode): void => {
      if (placed.has(node.id) || items.some((item) => item.node.id === node.id)) return;
      items.push({ node, dy: y });
      y += KIND_SIZE[node.kind].height + LAYOUT.ITEM_GAP;
      for (const child of children.get(node.id) ?? []) walk(child);
    };
    walk(head);
    return { items, height: y - LAYOUT.ITEM_GAP };
  };
  const placeCell = (cell: Cell, left: number, top: number): void => {
    for (const { node, dy } of cell.items) place(node, centred(node, left), top + dy);
  };
  const columnsWidth = (count: number): number =>
    count === 0 ? 0 : count * LAYOUT.COLUMN_WIDTH + (count - 1) * LAYOUT.COLUMN_GAP;

  let cursor = 0;
  for (const root of roots) {
    const kids = children.get(root.id) ?? [];
    const podCells = kids.filter((child) => child.kind === "pod").map(cellOf);
    const looseCells = kids.filter((child) => child.kind !== "pod").map(cellOf);

    const looseColumns = Math.min(
      podCells.length > 0 ? LAYOUT.LOOSE_COLS_WITH_PODS : LAYOUT.LOOSE_COLS_ALONE,
      looseCells.length,
    );
    const looseWidth = columnsWidth(looseColumns);
    const podsWidth = columnsWidth(podCells.length);
    const contentWidth = looseWidth + (looseWidth > 0 && podsWidth > 0 ? LAYOUT.COLUMN_GAP : 0) + podsWidth;
    const rootWidth = KIND_SIZE[root.kind].width;
    const blockWidth = Math.max(rootWidth, contentWidth);

    place(root, cursor + (blockWidth - rootWidth) / 2, 0);
    let left = cursor + (blockWidth - contentWidth) / 2;

    // The loose grid first, leftmost; rows are as tall as their tallest cell.
    let top = rowY;
    for (let start = 0; start < looseCells.length; start += looseColumns) {
      const row = looseCells.slice(start, start + looseColumns);
      row.forEach((cell, column) => placeCell(cell, left + column * (LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP), top));
      top += Math.max(...row.map((cell) => cell.height)) + LAYOUT.ITEM_GAP * 2;
    }
    left += looseWidth > 0 ? looseWidth + LAYOUT.COLUMN_GAP : 0;
    for (const cell of podCells) {
      placeCell(cell, left, rowY);
      left += LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP;
    }

    cursor += blockWidth + LAYOUT.BLOCK_GAP;
  }

  // Safety: anything no root reached, in input order, as one flat column.
  let strayY = rowY;
  for (const node of map.nodes) {
    if (placed.has(node.id)) continue;
    place(node, centred(node, cursor), strayY);
    strayY += KIND_SIZE[node.kind].height + LAYOUT.ITEM_GAP;
  }

  const nodes = map.nodes.map((node) => placed.get(node.id) as PositionedNode);
  return { nodes, edges: map.edges.map((edge) => ({ ...edge })), stats: map.stats };
}
