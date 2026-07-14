import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { getFullDataset } from "@/lib/store";
import { atomDetail, type AtomDetailView } from "@/lib/atom-detail";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AdminAtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: AtomDetailView | null = null;
  let failed = false;
  try {
    view = atomDetail(await getFullDataset(), id);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <article>
        <p>
          <a href="/admin/vault">← vault</a>
        </p>
        <h1>Atom</h1>
        <p role="alert">Couldn&apos;t load the atom.</p>
      </article>
    );
  }

  if (!view) notFound();

  const { atom, domain, moleculeParents, versions } = view;

  return (
    <article>
      <p>
        <a href="/admin/vault">← vault</a>
      </p>
      <h1>{resolveText(atom.name)}</h1>
      <ul>
        <li>atom: {atom.slug}</li>
        <li>visibility: {atom.visibility ?? "public (default)"}</li>
        <li>domain: {domain ?? "—"}</li>
        <li>molecule: {moleculeParents.join(", ") || "—"}</li>
        <li>tags: {(atom.tags ?? []).join(", ") || "—"}</li>
      </ul>

      <h2>Versions ({versions.length})</h2>
      {versions.length === 0 ? (
        <p>No versions.</p>
      ) : (
        versions.map((version) => (
          <section key={version.slug}>
            <h3>{resolveText(version.name)}</h3>
            <p>
              <a href={`/admin/version/${version.slug}`}>edit</a>
            </p>
            <p>state: {version.state ?? "—"}</p>
            <ul>
              {Object.entries(version)
                .filter(([, value]) => isScalar(value))
                .map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
            </ul>
            <p>tags: {(version.tags ?? []).join(", ") || "—"}</p>
          </section>
        ))
      )}
    </article>
  );
}
