import { notFound } from "next/navigation";
import { resolveText, type Text } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

// The property dump's display value: Text-typed model fields (name/description
// since B1) render resolved instead of dropping when localized; anything else
// renders only when scalar (null = omit the row).
function displayValue(key: string, value: unknown): string | number | boolean | null {
  if (key === "name" || key === "description") {
    // An empty resolution (blank string or degenerate {}) omits the row instead
    // of rendering a dangling "description:" line.
    return resolveText(value as Text) || null;
  }
  return isScalar(value) ? value : null;
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
          <ul>
            {Object.entries(version)
              .map(([key, value]) => [key, displayValue(key, value)] as const)
              .filter(([, value]) => value !== null)
              .map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
