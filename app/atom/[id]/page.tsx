import { notFound } from "next/navigation";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicDataset();
  const atom = data.getAtom(id);
  if (!atom) notFound();

  const versions = data.versionsForAtom(atom.slug);

  return (
    <article>
      <h1>{atom.name}</h1>

      {versions.map((version) => (
        <section key={version.slug}>
          <h2>{version.name}</h2>
          <ul>
            {Object.entries(version)
              .filter(([, value]) => isScalar(value))
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
