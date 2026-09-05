import type { ReactNode } from "react";
import type { EntityResolver } from "@/lib/entity-resolve";
import { cloudinaryThumb } from "@/lib/image-url";
import { Card, CardContent } from "@/components/ui/card";

// Fail-closed (spec §2.3): an unresolved ref renders NOTHING on a public page —
// no stub, no name, no gap to infer from. The admin passes `showUnresolved` so a
// dangling ref stays visible where it is information rather than a leak.
export function EntityCard({
  refValue,
  resolve,
  showUnresolved,
}: {
  refValue?: string;
  resolve?: EntityResolver;
  showUnresolved?: boolean;
}) {
  const entity = refValue && resolve ? resolve(refValue) : null;
  if (!entity) {
    return showUnresolved ? (
      <p className="text-xs text-muted-foreground">
        unresolved reference: {refValue ?? "(no ref)"}
      </p>
    ) : null;
  }
  return (
    // The anchor wraps the CARD, not the image — and that placement is
    // load-bearing. components/ui/card.tsx ships `has-[>img:first-child]:pt-0`
    // and `*:[img:first-child]:rounded-t-xl`, and BOTH selectors match a
    // direct-child <img> only: an anchor around the image silently opts out and
    // produces an inset band with square corners instead of a flush one.
    // Wrapping the whole card keeps the image where those selectors can see it.
    //
    // The whole card is the link now, where only the name line used to be — the
    // cover and the description were dead pixels over a link-shaped object. One
    // anchor, one destination, no nesting: the name below is a <span>, so
    // nothing needs an aria-hidden or a tabIndex={-1} to suppress a duplicate,
    // and the accessible name is still the entity's name.
    <a href={entity.href} className="not-prose group my-4 block no-underline">
      <Card className="transition-shadow group-hover:shadow-md">
        {entity.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // The card renders at the reading column's full width
            // (app/(public)/(chrome)/layout.tsx: `max-w-3xl px-6` -> 768px -
            // 2*24px = 720px at its widest) and h-32 (128px) tall, so 1440x256
            // is that box doubled for a 2x display. Matching the box's own
            // aspect ratio (~5.6:1), rather than picking a rounder but narrower
            // number, keeps Cloudinary's c_fill crop aligned with what
            // object-cover shows instead of cropping a differently-shaped box.
            //
            // Decorative: the name below carries the accessible name.
            src={cloudinaryThumb(entity.cover.url, { width: 1440, height: 256 })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-32 w-full object-cover"
          />
        ) : null}
        {/* py-8: the card sits in 16px prose now and needs the room. */}
        <CardContent className="flex flex-col gap-1 py-8">
          <span className="text-sm font-medium underline-offset-4 group-hover:underline">
            {entity.name}
          </span>
          {entity.description ? (
            <p className="text-xs text-muted-foreground">{entity.description}</p>
          ) : null}
        </CardContent>
      </Card>
    </a>
  );
}

// Inline: the label the author wrote, or the entity's own name when they wrote
// none. An unresolved inline ref degrades to its label as plain text — the
// sentence must still read.
export function EntityLink({
  refValue,
  resolve,
  children,
}: {
  refValue?: string;
  resolve?: EntityResolver;
  children?: ReactNode;
}) {
  const entity = refValue && resolve ? resolve(refValue) : null;
  if (!entity) return <>{children}</>;
  return (
    <a href={entity.href} className="underline-offset-4 hover:underline">
      {children ?? entity.name}
    </a>
  );
}
