import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { getFullDataset } from "@/lib/store";
import { beanDetail, type BeanDetailView } from "@/lib/bean-detail";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AdminAtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: BeanDetailView | null = null;
  let failed = false;
  try {
    view = beanDetail(await getFullDataset(), id);
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

  const { bean, plant, podParents, sprouts } = view;

  return (
    <article>
      <p>
        <a href="/admin/vault">← vault</a>
      </p>
      <h1>{resolveText(bean.name)}</h1>
      <ul>
        <li>atom: {bean.slug}</li>
        <li>visibility: {bean.visibility ?? "public (default)"}</li>
        <li>plant: {plant ?? "—"}</li>
        <li>molecule: {podParents.join(", ") || "—"}</li>
        <li>tags: {(bean.tags ?? []).join(", ") || "—"}</li>
      </ul>

      <h2>Versions ({sprouts.length})</h2>
      {sprouts.length === 0 ? (
        <p>No versions.</p>
      ) : (
        sprouts.map((version) => (
          <section key={version.slug}>
            <h3>{resolveText(version.name)}</h3>
            <p>
              <a href={`/admin/sprout/${version.slug}`}>edit</a>
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
