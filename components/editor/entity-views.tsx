"use client";

import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { EntityCard, EntityMention } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { Card, CardContent } from "@/components/ui/card";

type Lookup = (ref: string) => EntityOption | null;

function lookupOf(props: NodeViewProps): Lookup {
  return (props.extension.options as { lookup: Lookup }).lookup;
}

/**
 * A block card, as seen while writing. Unresolved refs stay VISIBLE here — in
 * the authoring zone a dangling reference is information, not a leak, which is
 * the same rule components/entity.tsx applies with `showUnresolved`.
 */
function EntityCardView(props: NodeViewProps): React.ReactElement {
  const ref = String(props.node.attrs.ref ?? "");
  const entity = lookupOf(props)(ref);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      {entity ? (
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-sm font-medium">{entity.name}</span>
            {entity.description ? (
              <span className="text-xs text-muted-foreground">{entity.description}</span>
            ) : null}
            <span className="font-heading text-[10px] text-muted-foreground">{entity.ref}</span>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          unresolved reference: {ref || "(no ref)"}
        </p>
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
