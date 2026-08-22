import type { ReactNode } from "react";
import type { EntityResolver } from "@/lib/entity-resolve";
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
