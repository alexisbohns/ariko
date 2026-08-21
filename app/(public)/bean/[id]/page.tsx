import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { resolveText, type Relation, type Text } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

// The property dump's display value: Text-typed model fields (name/description
// since B1) render resolved instead of dropping when localized; anything else
// renders only when scalar (null = omit the row). relations[] is handled
// separately (one row per edge), not here.
function displayValue(key: string, value: unknown): string | number | boolean | null {
  if (key === "name" || key === "description") {
    // An empty resolution (blank string or degenerate {}) omits the row instead
    // of rendering a dangling "description:" line.
    return resolveText(value as Text) || null;
  }
  return isScalar(value) ? value : null;
}

// One dump row per property — plus, for relations (G2), one row PER edge:
// "relation: kind → ref". The dataset is post-scrub (filterPublic), so every
// ref rendered here points at something public.
function dumpRows(sprout: Record<string, unknown>): ReactNode[] {
  return Object.entries(sprout).flatMap(([key, value]) => {
    if (key === "relations" && Array.isArray(value)) {
      return (value as Relation[]).map((rel, i) => (
        <li key={`relation-${i}`} className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">relation</span>
          <span>
            {rel.kind} → {rel.ref}
          </span>
        </li>
      ));
    }
    const display = displayValue(key, value);
    if (display === null) return [];
    return [
      <li key={key} className="flex gap-2">
        <span className="shrink-0 text-muted-foreground">{key}</span>
        <span>{String(display)}</span>
      </li>,
    ];
  });
}

export default async function BeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicDataset();
  const bean = data.getBean(id);
  if (!bean) notFound();

  const sprouts = data.sproutsForBean(bean.slug);

  return (
    <article className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-medium tracking-tight">{resolveText(bean.name)}</h1>

      {sprouts.map((sprout) => (
        <Card key={sprout.slug}>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">
              {resolveText(sprout.name)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 font-heading text-xs">{dumpRows(sprout)}</ul>
          </CardContent>
        </Card>
      ))}
    </article>
  );
}
