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
import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import type { PositionedMap, PositionedNode } from "@/lib/garden-map-layout";
import { MAP_SHEET_ATTR, confirmDiscard, isInPlaceNavigation } from "@/lib/map-sheet";
import { MapNodeCard } from "./garden-map-node";

/**
 * The garden map's canvas: draws a finished, positioned map and nothing else.
 *
 * It composes no data and holds no state. The page reads the garden, the
 * builder decides every flag, `lib/garden-map-layout.ts` decides every
 * coordinate — this file hands them to React Flow. `import type` from `lib/` only: `lib/garden-map.ts`
 * reaches `lib/data.ts`, which opens with `node:fs`, and a runtime import from
 * here fails `npm run build` rather than anything earlier
 * (`lib/garden-map-source.test.ts`).
 *
 * The layout is a bloom, not a left-to-right graph: plants in a row, each over
 * its own pods and beans, which hang below it on soft curves. Every edge runs
 * from the bottom-centre of its source to the top-centre of its target, so a
 * card needs exactly one hidden handle on each of those sides and no edge names
 * one. Edges draw UNDER the opaque cards, so a stem that passes behind the
 * beans above its target shows only in the gaps — which is the look, not a bug.
 *
 * Read-only on purpose: nodes cannot be dragged, connected or selected, so
 * there is no layout state to lose and no write path to mis-fire. Each card's
 * name is a real `next/link`; panning and zooming are the only gestures.
 * `nodesFocusable` is off so Tab walks the links, not the node wrappers.
 */

type GardenNodeData = { node: PositionedNode };

const HANDLE = "pointer-events-none opacity-0";

function GardenNode({ data }: NodeProps<Node<GardenNodeData>>) {
  // Handles exist because React Flow cannot draw an edge to a node without
  // them; they are invisible and inert.
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className={HANDLE} />
      <MapNodeCard node={data.node} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className={HANDLE} />
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

/**
 * A node click while the entity sheet holds an unsaved edit asks first.
 *
 * CAPTURE phase, on the canvas's wrapper: `next/link` handles the click on the
 * anchor itself, so only something earlier in the event's path can stop it. The
 * sheet leaves the canvas live beside an open editor on purpose, which makes a
 * stray click the likeliest way to lose a draft.
 */
function guardDirtySheet(event: MouseEvent<HTMLDivElement>) {
  if (!isInPlaceNavigation(event, (event.target as Element).closest("a[href]"))) return;
  if (!confirmDiscard(document.querySelector(`[${MAP_SHEET_ATTR}]`))) {
    event.preventDefault();
    event.stopPropagation();
  }
}

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
        type: "default",
        selectable: false,
        focusable: false,
        style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5, opacity: 0.55 },
      })),
    [map.edges],
  );

  return (
    <div className="size-full" onClickCapture={guardDirtySheet}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={dark ? "dark" : "light"}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.05}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        aria-label="Garden map"
      >
        <Background gap={24} />
        {/* Bottom-left is clear of the left rail (vertically centred) and the
            top clusters. Below `md` the controls are dropped (the toolbar needs
            the width, and touch pans and pinches); the `!` is load-bearing —
            xyflow's stylesheet is unlayered and sets `display`, so a plain
            `hidden` loses to it. The minimap goes bottom-right and appears from
            `lg`: at 768px it nearly touches the toolbar. */}
        <Controls showInteractive={false} position="bottom-left" className="max-md:hidden!" />
        <MiniMap pannable zoomable position="bottom-right" className="hidden lg:block" />
      </ReactFlow>
    </div>
  );
}
