import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
import { PlantHead } from "@/app/(public)/_components/plant-head";
import { ProfanePreload } from "@/components/brand/profane-preload";
import { Prose } from "@/components/markdown";

export const dynamic = "force-dynamic";

export default async function PlantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const plant = data.getPlant(slug);
  // A private container 404s rather than existing as an empty public shell.
  if (!plant) notFound();

  // The role's one line of context. Never markdown — plants already have
  // `content` for prose, so this renders as plain text (fr falls back to en,
  // like every other read surface).
  const roleDetail = (
    textPart(plant.role.detail, "en") || textPart(plant.role.detail, "fr")
  ).trim();

  const pods = data.podsForPlant(slug);
  const beans = data.beansForPlant(slug);

  return (
    <article className="flex flex-col gap-8">
      {/* Only pages that wear the face ask for it: the plant page is the
          display face's second wearer, after the landing. */}
      <ProfanePreload />
      <PlantHead
        plant={plant}
        name={resolveText(plant.name, lang)}
        description={resolveText(plant.description ?? "", lang).trim()}
        roleDetail={roleDetail}
      />

      {/* The narrative — where the argument lives. Its entity refs resolve
          against the public dataset, so anything hidden renders as nothing. */}
      <Prose
          lang={lang}
          content={plant.content}
          resolve={(ref) => resolveEntity(data, ref, lang)} />

      {/* Mechanical index — an aggregation with no argument to make (spec §5). */}
      {pods.length > 0 || beans.length > 0 ? (
        <nav className="flex flex-col gap-2">
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Inside
          </h2>
          <ul className="flex flex-col gap-1">
            {pods.map((pod) => (
              <li key={pod.slug}>
                <a href={`/pod/${pod.slug}`} className="text-sm underline-offset-4 hover:underline">
                  {resolveText(pod.name, lang)}
                </a>
              </li>
            ))}
            {beans.map((bean) => (
              <li key={bean.slug}>
                <a
                  href={`/bean/${bean.slug}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {resolveText(bean.name, lang)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
