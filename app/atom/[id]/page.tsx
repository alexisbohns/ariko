import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { resolveText, type Relation, type Text } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

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
function dumpRows(version: Record<string, unknown>): ReactNode[] {
  return Object.entries(version).flatMap(([key, value]) => {
    if (key === "relations" && Array.isArray(value)) {
      return (value as Relation[]).map((rel, i) => (
        <li key={`relation-${i}`}>
          relation: {rel.kind} → {rel.ref}
        </li>
      ));
    }
    const display = displayValue(key, value);
    if (display === null) return [];
    return [
      <li key={key}>
        {key}: {String(display)}
      </li>,
    ];
  });
}

export default async function AtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicDataset();
  const atom = data.getAtom(id);
  if (!atom) notFound();

  const versions = data.versionsForAtom(atom.slug);

  return (
    <article>
      <h1>{resolveText(atom.name)}</h1>

      {versions.map((version) => (
        <section key={version.slug}>
          <h2>{resolveText(version.name)}</h2>
          <ul>{dumpRows(version)}</ul>
        </section>
      ))}
    </article>
  );
}
