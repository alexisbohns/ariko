"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useMemo, useSyncExternalStore } from "react";
import type { PositionedMap, PositionedNode } from "@/lib/garden-map-layout";
import { MapNodeCard } from "./garden-map-node";

/**
 * The garden map's canvas: draws a finished, positioned map and nothing else.
 *
 * It composes no data and holds no state. The page reads the garden, the
 * builder decides every flag, dagre decides every coordinate — this file hands
 * them to React Flow. `import type` from `lib/` only: `lib/garden-map.ts`
 * reaches `lib/data.ts`, which opens with `node:fs`, and a runtime import from
 * here fails `npm run build` rather than anything earlier
 * (`lib/garden-map-source.test.ts`).
 *
 * Read-only on purpose: nodes cannot be dragged, connected or selected, so
 * there is no layout state to lose and no write path to mis-fire. Each card's
 * name is a real `next/link`; panning and zooming are the only gestures.
 * `nodesFocusable` is off so Tab walks the links, not the node wrappers.
 */

type GardenNodeData = { node: PositionedNode };

function GardenNode({ data }: NodeProps<Node<GardenNodeData>>) {
  // Handles exist because React Flow cannot draw an edge to a node without
  // them; they are invisible and inert.
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="pointer-events-none opacity-0" />
      <MapNodeCard node={data.node} />
      <Handle type="source" position={Position.Right} isConnectable={false} className="pointer-events-none opacity-0" />
    </>
  );
}

const NODE_TYPES = { garden: GardenNode };

/**
 * The theme is `localStorage` plus a `dark` class on <html> (`lib/theme.ts`),
 * which the server cannot read, so this follows the class rather than taking a
 * prop. `useSyncExternalStore` is the honest shape for "a value that lives
 * outside React": the server snapshot is light, and a dark visitor corrects on
 * hydration with no effect-driven second render.
 */
function subscribeDark(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const readDark = () => document.documentElement.classList.contains("dark");
const readDarkOnServer = () => false;

export function GardenMap({ map }: { map: PositionedMap }) {
  const dark = useSyncExternalStore(subscribeDark, readDark, readDarkOnServer);

  const nodes = useMemo<Node<GardenNodeData>[]>(
    () =>
      map.nodes.map((node) => ({
        id: node.id,
        type: "garden",
        position: { x: node.x, y: node.y },
        data: { node },
        // Known up front, so the first paint and `fitView` do not wait on a
        // measurement the fixed-size cards make unnecessary.
        initialWidth: node.width,
        initialHeight: node.height,
        style: { width: node.width, height: node.height },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      })),
    [map.nodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        selectable: false,
        focusable: false,
        style: { stroke: "var(--muted-foreground)", opacity: 0.5 },
      })),
    [map.edges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      colorMode={dark ? "dark" : "light"}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.1}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      aria-label="Garden map"
    >
      <Background gap={24} />
      {/* Bottom-left is clear of the left rail (vertically centred) and the
          top clusters; the minimap goes bottom-right and is dropped below `md`,
          where it would sit under the toolbar. */}
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" className="hidden md:block" />
    </ReactFlow>
  );
}
