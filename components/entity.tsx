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
    <Card className="not-prose my-4">
      {entity.cover ? (
        // A direct child of Card, deliberately: components/ui/card.tsx ships
        // `has-[>img:first-child]:pt-0` and `*:[img:first-child]:rounded-t-xl`
        // for exactly this, and both selectors match a direct-child <img> only
        // — wrapping it in an anchor silently opted out of the treatment and
        // produced an inset band with square corners instead of a flush one.
        //
        // Not a link, and that is the point. The card's name below is the
        // link; making the image a second anchor to the same href meant one
        // aria-hidden, one tabIndex={-1}, and a duplicate destination to
        // suppress. Not rendering it as a link removes the problem rather than
        // managing it. Decorative alt for the same reason: the name carries
        // the accessible name.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // The card renders at the reading column's full width
          // (app/(public)/layout.tsx: `max-w-3xl px-6` -> 768px - 2*24px =
          // 720px at its widest) and h-32 (128px) tall, so 1440x256 is that
          // box doubled for a 2x display. Matching the box's own aspect ratio
          // (~5.6:1), rather than picking a rounder but narrower number, keeps
          // Cloudinary's c_fill crop aligned with what object-cover shows
          // instead of cropping a differently-shaped box.
          src={cloudinaryThumb(entity.cover.url, { width: 1440, height: 256 })}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-32 w-full object-cover"
        />
      ) : null}
      <CardContent className="flex flex-col gap-1 py-4">
        <a href={entity.href} className="text-sm font-medium underline-offset-4 hover:underline">
          {entity.name}
        </a>
        {entity.description ? (
          <p className="text-xs text-muted-foreground">{entity.description}</p>
        ) : null}
      </CardContent>
    </Card>
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
