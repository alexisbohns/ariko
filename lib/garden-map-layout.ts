import dagre from "@dagrejs/dagre";
import type { GardenMap, MapEdge, MapNode, MapNodeKind } from "./garden-map";

/**
 * Positions for the garden map. Pure, and run on the SERVER: the island ships
 * no layout code, only the finished coordinates.
 *
 * Left to right, because the tree is read as a sentence — plant, then its pods,
 * then their beans, then what waits on them. dagre handles the forest (several
 * disconnected trees) and a node with two parents (a DAG) without help.
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

export interface PositionedNode extends MapNode {
  /** Top-left, as React Flow wants it (dagre answers with centres). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedMap {
  nodes: PositionedNode[];
  edges: MapEdge[];
  stats: GardenMap["stats"];
}

export function layoutGardenMap(map: GardenMap): PositionedMap {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  // A COPY per node: dagre writes x/y onto the label it is handed, so passing
  // the shared KIND_SIZE entry stacked every node of one kind on one point.
  for (const node of map.nodes) graph.setNode(node.id, { ...KIND_SIZE[node.kind] });
  for (const edge of map.edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);

  const nodes = map.nodes.map((node): PositionedNode => {
    const { width, height } = KIND_SIZE[node.kind];
    const placed = graph.node(node.id);
    return { ...node, width, height, x: placed.x - width / 2, y: placed.y - height / 2 };
  });
  return { nodes, edges: map.edges, stats: map.stats };
}
