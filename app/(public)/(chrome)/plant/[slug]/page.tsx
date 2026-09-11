import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { resolveEntity } from "@/lib/entity-resolve";
import { PlantHead } from "@/app/(public)/_components/plant-head";
import { ProfanePreload } from "@/components/brand/profane-preload";
import { Prose } from "@/components/markdown";
import { LinkRow } from "@/components/link-row";
import { ScreenStrip } from "@/components/screen-strip";
import type { ExhibitionRow } from "@/lib/exhibition";

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

  // The exhibition, with both Texts resolved HERE rather than in the strip —
  // which is what keeps components/screen-strip.tsx isomorphic instead of
  // server-only, and what will let the lightbox slice hand the same rows to a
  // client island.
  const screens: ExhibitionRow[] = data.exhibitionForPlant(slug).map((screen) => ({
    slug: screen.slug,
    name: resolveText(screen.name, lang),
    legend: resolveText(screen.legend ?? "", lang).trim(),
    image: screen.image,
  }));

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

      {/* Where the plant can be found off-site. Under the head, above the
          narrative: it is a fact about the plant, not part of its argument.

          GUARDED, like the two blocks below it, and for a reason that is easy
          to miss: LinkRow returns null for a plant with no links, but a
          centring wrapper around nothing is still a flex ITEM, and this
          article's `gap-8` puts 32px on both sides of it. Rendered
          unconditionally it doubled the space between the head and the prose on
          every plant but casa — the one page state nobody looks at while
          building the feature that fills it. */}
      {plant.links && plant.links.length > 0 ? (
        <div className="flex justify-center">
          <LinkRow links={plant.links} lang={lang} label={`Find ${resolveText(plant.name, lang)} elsewhere`} />
        </div>
      ) : null}

      {/* The exhibition, ABOVE the narrative: show first, explain after. It
          renders nothing at all for a plant with no exhibited screens, so this
          needs no guard of its own — ScreenStrip returns null and React drops
          the flex item, which is the shape the links block above could not
          take (a centring wrapper around null is still an item). */}
      <ScreenStrip rows={screens} plantName={resolveText(plant.name, lang)} />

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
