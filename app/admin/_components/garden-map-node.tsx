import { Inbox, Sprout, Unlink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
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
 * content: it fills the box the layout reserved for it, and the numbers in the
 * classes below (72, 44, 70) are the ones that box is built from. Three shapes:
 *
 *  - a PLANT is a pill: a round medallion (its logo) and a large name;
 *  - a POD has a wide cover across its top;
 *  - a BEAN is a compact tile with a square thumbnail on the left.
 *
 * A sprout, a seed count and a bucket are a single line.
 *
 * The WHOLE card is the click target: the name is a `next/link` whose `::after`
 * covers the card (a stretched link), so the name stays the accessible text and
 * the one tab stop, and an image never needs a link of its own. The images are
 * plain `<img>`, decorative (`alt=""`): the builder hands over a thumbnail
 * Cloudinary has already cut to size, so `next/image` would add a proxy hop to
 * redo that — and a node with no image draws an initial instead of a broken
 * picture. `AvatarMark` (`components/admin/glyphs.tsx`) is not reused for the
 * medallion: it is private to a client file, fixed at 24px and a squircle, and
 * it re-derives a thumbnail the builder has already made.
 */

/** The word for a gap. `no-children` depends on what the node is. */
export function gapWord(kind: MapNodeKind, gap: MapGap): string {
  if (gap === "no-narrative") return "No narrative";
  if (gap === "no-fr") return "No French";
  if (kind === "bean") return "No journal";
  if (kind === "pod") return "No beans";
  return "Empty";
}

type CardNode = Pick<MapNode, "kind" | "label" | "href" | "waiting" | "gaps" | "dim" | "image">;

/** The first non-space character, upper-cased. `Array.from` walks code points,
 *  so a leading emoji is one letter rather than half a surrogate pair. */
function initialOf(label: string): string {
  return Array.from(label.trim())[0]?.toUpperCase() ?? "?";
}

/** A node's picture: its thumbnail, or — with none — its initial on a quiet
 *  square. Always the same box either way, so a missing image moves nothing. */
function Picture({
  node,
  width,
  height,
  className,
}: {
  node: CardNode;
  width: number;
  height: number;
  className: string;
}) {
  return node.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={node.image}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("shrink-0 object-cover", className)}
    />
  ) : (
    <span
      data-slot="map-initial"
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-muted font-heading text-muted-foreground",
        className,
      )}
    >
      {initialOf(node.label)}
    </span>
  );
}

function Name({ node, className }: { node: CardNode; className: string }) {
  return node.href ? (
    <Link
      href={node.href}
      prefetch={false}
      draggable={false}
      // `pointer-events-auto`: React Flow gives a non-interactive node wrapper
      // an inline `pointer-events: none`, which inherits; only the link can
      // opt back in. `after:inset-0` stretches it over the card.
      className={cn(
        "pointer-events-auto truncate outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] hover:underline focus-visible:underline",
        className,
      )}
    >
      {node.label}
    </Link>
  ) : (
    <span className={cn("truncate", className)}>{node.label}</span>
  );
}

function Chips({ node, className }: { node: CardNode; className?: string }) {
  if (!node.waiting && node.gaps.length === 0) return null;
  return (
    <div className={cn("flex min-w-0 shrink-0 flex-nowrap gap-1 overflow-hidden", className)}>
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
  );
}

function Shell({ node, className, children }: { node: CardNode; className?: string; children: ReactNode }) {
  return (
    <div
      data-kind={node.kind}
      data-waiting={node.waiting || undefined}
      data-dim={node.dim || undefined}
      className={cn(
        "relative size-full overflow-hidden rounded-xl border bg-card text-sm text-card-foreground shadow-xs transition-opacity",
        node.waiting && "ring-2 ring-amber-500",
        node.kind === "bucket" && "border-dashed",
        node.dim && "opacity-30",
        className,
      )}
    >
      {children}
    </div>
  );
}

const LINE_ICON = { sprout: Sprout, seed: Inbox, bucket: Unlink } as const;

export function MapNodeCard({ node }: { node: CardNode }) {
  if (node.kind === "plant") {
    return (
      <Shell node={node} className="flex items-center gap-3 p-2">
        <Picture node={node} width={72} height={72} className="size-[72px] rounded-full text-3xl ring-1 ring-border" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <Name node={node} className="font-heading text-2xl leading-tight font-medium" />
          <Chips node={node} />
        </div>
      </Shell>
    );
  }
  if (node.kind === "pod") {
    return (
      <Shell node={node} className="flex flex-col">
        <Picture node={node} width={220} height={70} className="h-[70px] w-full rounded-t-xl text-2xl" />
        <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-1.5">
          <Name node={node} className="font-medium" />
          <Chips node={node} />
        </div>
      </Shell>
    );
  }
  if (node.kind === "bean") {
    return (
      <Shell node={node} className="flex items-center gap-2 p-2">
        <Picture node={node} width={44} height={44} className="size-11 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <Name node={node} className="font-medium" />
          <Chips node={node} />
        </div>
      </Shell>
    );
  }
  const Icon = LINE_ICON[node.kind];
  return (
    <Shell node={node} className="flex items-center gap-2 px-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Name node={node} className="min-w-0 flex-1 font-medium" />
      <Chips node={node} />
    </Shell>
  );
}
