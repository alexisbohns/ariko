import { Bean, Flower2, Inbox, Package, Sprout, Unlink } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import type { MapGap, MapNode, MapNodeKind } from "@/lib/garden-map";
import { cn } from "@/lib/utils";

/**
 * One node of the garden map, as a card. Presentational: no React Flow in here,
 * so it renders under `renderToStaticMarkup` and `garden-map.tsx` adds the
 * handles around it.
 *
 * `import type` from `lib/garden-map` only — the module opens with `node:fs`
 * four hops down, and a runtime import from a client island fails the build
 * (see `lib/garden-map-source.test.ts`).
 *
 * The card is sized by `lib/garden-map-layout.ts` (`KIND_SIZE`), not by its
 * content: it fills the box the layout reserved for it.
 */

const KIND_ICON: Record<MapNodeKind, ComponentType<{ className?: string }>> = {
  plant: Flower2,
  pod: Package,
  bean: Bean,
  sprout: Sprout,
  seed: Inbox,
  bucket: Unlink,
};

/** The word for a gap. `no-children` depends on what the node is. */
export function gapWord(kind: MapNodeKind, gap: MapGap): string {
  if (gap === "no-narrative") return "No narrative";
  if (gap === "no-fr") return "No French";
  if (kind === "bean") return "No journal";
  if (kind === "pod") return "No beans";
  return "Empty";
}

export function MapNodeCard({
  node,
}: {
  node: Pick<MapNode, "kind" | "label" | "href" | "waiting" | "gaps" | "dim">;
}) {
  const Icon = KIND_ICON[node.kind];
  return (
    <div
      data-kind={node.kind}
      data-waiting={node.waiting || undefined}
      data-dim={node.dim || undefined}
      className={cn(
        "flex size-full flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-card px-3 py-1.5 text-sm text-card-foreground shadow-xs transition-opacity",
        node.waiting && "ring-2 ring-amber-500",
        node.kind === "bucket" && "border-dashed",
        node.dim && "opacity-30",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {node.href ? (
          <Link
            href={node.href}
            prefetch={false}
            className="pointer-events-auto truncate font-medium underline-offset-4 hover:underline"
          >
            {node.label}
          </Link>
        ) : (
          <span className="truncate font-medium">{node.label}</span>
        )}
      </div>
      {node.waiting || node.gaps.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {node.waiting ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
              Waiting
            </Badge>
          ) : null}
          {node.gaps.map((gap) => (
            <Badge key={gap} variant="secondary">
              {gapWord(node.kind, gap)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
