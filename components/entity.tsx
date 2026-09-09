import type { ReactNode } from "react";
import type { EntityResolver } from "@/lib/entity-resolve";
import { DEFAULT_LANG, type Lang } from "@/lib/locale";
import { BeanCover } from "@/components/bean-cover";
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
  lang = DEFAULT_LANG,
}: {
  refValue?: string;
  resolve?: EntityResolver;
  showUnresolved?: boolean;
  /**
   * The reader's language, for the cover's KEYWORD alone — every other string
   * on the card was already resolved by `resolveEntity`, which closes over the
   * same lang. It travels separately because the resolver's payload is
   * deliberately lang-agnostic where a `Text` survives in it: `BeanCover`
   * carries the keyword unresolved (lib/bean-cover.ts says why), so the
   * component that draws it is the one that has to answer.
   */
  lang?: Lang;
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
    // The anchor wraps the CARD, not the art — and that placement is
    // load-bearing twice over. The card's own `overflow-hidden rounded-xl` is
    // what rounds the flush cover's left corners, so anything wrapped around
    // the art instead would paint a square-cornered band inside a rounded card.
    // And `group` has to sit OUTSIDE the frame: the cover's whole choreography
    // is `group-hover` (components/bean-cover.tsx), so a hover scoped to the
    // picture would leave the word and the phone still while the visitor is
    // reading the description beside them.
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
        coverArt={
          entity.cover ? <BeanCover cover={entity.cover} lang={lang} /> : undefined
        }
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
