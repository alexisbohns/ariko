"use client";

import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { EntityCard, EntityMention } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { EntityCardBody, UnresolvedRef } from "@/components/entity-card";

type Lookup = (ref: string) => EntityOption | null;

function lookupOf(props: NodeViewProps): Lookup {
  return (props.extension.options as { lookup: Lookup }).lookup;
}

/**
 * A block card, as seen while writing.
 *
 * The card is `components/entity-card.tsx` — the same one the published page
 * draws. It used to be a second, slightly different card here, and the drift was
 * silent: an extra `py-4`, and no cover. What is genuinely the editor's is the
 * `refText`, which is how an author checks that a card points where they meant.
 *
 * Unresolved refs stay VISIBLE here — in the authoring zone a dangling reference
 * is information, not a leak, which is the same rule components/entity.tsx
 * applies with `showUnresolved`.
 *
 * The cover is absent rather than shared, and that is honest rather than
 * deliberate: `EntityOption` carries none. A bean's cover is derived from its
 * newest sprout with an image (`lib/cover.ts`) and `entityOptions()` reads the
 * raw garden rather than a Dataset, so plumbing it is its own slice. Until then
 * an editor card is the published card minus a picture, not a different card.
 *
 * `interactive` is false: a card in the editor is not a link, so it must not
 * offer a link's affordance.
 */
function EntityCardView(props: NodeViewProps): React.ReactElement {
  const ref = String(props.node.attrs.ref ?? "");
  const entity = lookupOf(props)(ref);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      {entity ? (
        <EntityCardBody
          name={entity.name}
          description={entity.description}
          refText={entity.ref}
        />
      ) : (
        <UnresolvedRef refValue={ref} />
      )}
    </NodeViewWrapper>
  );
}

/** An inline mention: the author's label, chipped. */
function EntityMentionView(props: NodeViewProps): React.ReactElement {
  const ref = String(props.node.attrs.ref ?? "");
  const label = String(props.node.attrs.label ?? "");
  const entity = lookupOf(props)(ref);
  return (
    <NodeViewWrapper as="span">
      <span
        className={
          entity
            ? "rounded bg-accent px-1 py-0.5 text-accent-foreground"
            : "rounded border border-dashed px-1 py-0.5 text-muted-foreground"
        }
        title={entity ? entity.ref : `unresolved reference: ${ref || "(no ref)"}`}
      >
        {label || entity?.name || ref}
      </span>
    </NodeViewWrapper>
  );
}

/**
 * The editor's entity extensions: the pure nodes from lib/, plus views bound to
 * this page's entity list. Built per editor because the lookup closes over the
 * options the server passed down.
 */
export function entityExtensions(options: EntityOption[]) {
  const byRef = new Map(options.map((o) => [o.ref, o]));
  const lookup: Lookup = (ref) => byRef.get(ref) ?? null;

  return [
    EntityCard.extend({
      addOptions() {
        return { ...this.parent?.(), lookup };
      },
      addNodeView() {
        return ReactNodeViewRenderer(EntityCardView);
      },
    }),
    EntityMention.extend({
      addOptions() {
        return { ...this.parent?.(), lookup };
      },
      addNodeView() {
        return ReactNodeViewRenderer(EntityMentionView);
      },
    }),
  ];
}
