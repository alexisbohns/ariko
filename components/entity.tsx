import type { ReactNode } from "react";
import type { EntityResolver } from "@/lib/entity-resolve";
import { EntityCardBody, UnresolvedRef } from "@/components/entity-card";

// Fail-closed (spec §2.3): an unresolved ref renders NOTHING on a public page —
// no stub, no name, no gap to infer from. The admin passes `showUnresolved` so a
// dangling ref stays visible where it is information rather than a leak.
//
// The card itself is components/entity-card.tsx, shared with the editor's node
// view. What this file owns is the resolution and the anchor: which dataset the
// ref is looked up in decides what a visitor can see, and that is not a
// presentational concern.
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
      <div className="not-prose my-4">
        <UnresolvedRef refValue={refValue} />
      </div>
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
    // The whole card is the link, where only the name line used to be — the
    // cover and the description were dead pixels over a link-shaped object. One
    // anchor, one destination, no nesting: the name below is a <span>, so
    // nothing needs an aria-hidden or a tabIndex={-1} to suppress a duplicate,
    // and the accessible name is still the entity's name.
    //
    // `group` is what `interactive` reaches for — the hover affordance lives on
    // the card, the hover itself on the anchor.
    <a href={entity.href} className="not-prose group my-4 block no-underline">
      <EntityCardBody
        name={entity.name}
        description={entity.description}
        cover={entity.cover}
        // No `refText` here, in either zone. The ref belongs to the WRITING
        // surface — it is how an author checks that a card points where they
        // meant — and a rendered page is a rendered page whoever is looking at
        // it. The admin's one concession to being the admin is showUnresolved.
        interactive
      />
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
