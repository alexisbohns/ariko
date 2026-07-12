import { notFound } from "next/navigation";
import { getDataset } from "@/lib/data";

export function generateStaticParams() {
  const data = getDataset();
  const slugs = new Set<string>();
  for (const molecule of data.getMolecules()) {
    for (const atom of data.atomsForMolecule(molecule.slug)) slugs.add(atom.slug);
  }
  for (const atom of data.standaloneAtoms()) slugs.add(atom.slug);
  return [...slugs].map((id) => ({ id }));
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getDataset();
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
