import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { roleLine } from "@/lib/plant-role";
import { getPublicDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
import { Prose } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PlantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {resolveText(plant.name)}
        </h1>
        {/* The role leads: it is the claim a visitor most needs, and it wears
            the strong `default` badge so it reads ahead of the natures rather
            than as one more tag among them. */}
        <div className="flex flex-wrap gap-1.5">
          <Badge>{roleLine(plant.role)}</Badge>
          {plant.natures.map((nature) => (
            <Badge key={nature} variant="secondary">
              {nature}
            </Badge>
          ))}
        </div>
        {resolveText(plant.description ?? "").trim() ? (
          <p className="text-base text-muted-foreground">{resolveText(plant.description)}</p>
        ) : null}
        {roleDetail ? <p className="text-sm text-muted-foreground">{roleDetail}</p> : null}
      </header>

      {/* The narrative — where the argument lives. Its entity refs resolve
          against the public dataset, so anything hidden renders as nothing. */}
      <Prose content={plant.content} resolve={(ref) => resolveEntity(data, ref)} />

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
                  {resolveText(pod.name)}
                </a>
              </li>
            ))}
            {beans.map((bean) => (
              <li key={bean.slug}>
                <a
                  href={`/bean/${bean.slug}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {resolveText(bean.name)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
