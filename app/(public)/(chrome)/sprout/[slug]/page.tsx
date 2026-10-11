import { notFound } from "next/navigation";
import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, aboutRefs, parentsWithPrefix, resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { resolveEntity } from "@/lib/entity-resolve";
import { resolveLineage, PUBLIC_HREFS } from "@/lib/lineage";
import { sproutKindLabel } from "@/lib/glyphs";
import { LineageChrome } from "@/components/lineage-chrome";
import { Prose } from "@/components/markdown";
import { MediaList } from "@/components/media";
import { LinkRow } from "@/components/link-row";
import { Badge } from "@/components/ui/badge";
import { seq } from "@/components/reveal";

export const dynamic = "force-dynamic";

/**
 * One journal entry, as a visitor reads it (journal model §3 Public): what
 * kind of entry it is, when, its name, its description, its body with entity
 * refs resolved against the public dataset, its media, its links, and the
 * doors to what it is ABOUT.
 *
 * It reads `getPublicDataset()` and runs no privacy check of its own. A
 * private sprout, or one whose derived plant is private, was dropped by
 * `filterPublic` upstream, so `entryForSprout` answers undefined and the page
 * 404s — the same shape as a private pod or bean. An entry ABOUT a private
 * bean is a different case: the entry itself is public, `filterPublic`
 * scrubbed the ref out of `about`, and the doors below simply do not include
 * it. Nothing here could name it if it tried.
 *
 * `components/media.tsx` returns to a public page here — the bean page retired
 * it with the per-sprout cards and kept the file for exactly this day (its
 * docblock says so). The sprout's `links[]` come back the same way, through
 * `LinkRow`, with the row's label naming the entry rather than a plant.
 *
 * In `lib/server-safe-source.test.ts`, the first page on that list, per the
 * spec. Progressively enhanced like every public page: every door is an `<a>`.
 */
export default async function SproutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const entry = data.entryForSprout(slug);
  if (!entry) notFound();
  const { sprout, plant } = entry;

  // The trail: the DERIVED plant first, then whatever `about` names. `about`
  // refs are pod:/bean: and the climb fills the tiers between them. Beans are
  // looked up one by one because `Dataset` has no `getBeans()` — and needs
  // none here: the trail can only name beans the entry is about.
  const about = aboutRefs(sprout);
  const beans = parentsWithPrefix(about, BEAN_PREFIX)
    .map((s) => data.getBean(s))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);
  const lineage = resolveLineage(
    [...(plant ? [`${PLANT_PREFIX}${plant.slug}`] : []), ...about],
    { plants: data.getPlants(), pods: data.getPods(), beans },
    { lang, hrefs: PUBLIC_HREFS },
  );

  // The doors: each pod and bean the entry is about, as it survives the
  // projection. A plant-level entry (about empty) has one door, its plant.
  const doors: { href: string; name: string }[] = [
    ...parentsWithPrefix(about, POD_PREFIX).flatMap((s) => {
      const pod = data.getPod(s);
      return pod ? [{ href: PUBLIC_HREFS.pod(s), name: resolveText(pod.name, lang) }] : [];
    }),
    ...beans.map((b) => ({ href: PUBLIC_HREFS.bean(b.slug), name: resolveText(b.name, lang) })),
  ];
  if (doors.length === 0 && plant) {
    doors.push({ href: PUBLIC_HREFS.plant(plant.slug), name: resolveText(plant.name, lang) });
  }

  const description = resolveText(sprout.description ?? "", lang).trim();

  return (
    <>
      <LineageChrome lineage={lineage} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          {/* Kind and date BEFORE the name: a journal entry is read as "a
              release, on this day, called X", the order the beanstalk line
              already uses. The kind is the word from lib/glyphs.ts, the one
              place its display form is decided. */}
          <p {...seq(0, "flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground")}>
            <Badge variant="secondary">{sproutKindLabel(sprout.kind)}</Badge>
            <time dateTime={sprout.date}>{sprout.date.slice(0, 10)}</time>
          </p>
          <h1 {...seq(1, "font-heading text-2xl font-medium tracking-tight")}>
            {resolveText(sprout.name, lang)}
          </h1>
          {description ? <p {...seq(2, "text-base text-muted-foreground")}>{description}</p> : null}
        </header>

        {/* The body — entity refs resolve against the public dataset, so
            anything hidden renders as nothing. `Prose` renders nothing for an
            absent or blank content, the same contract MediaList has. */}
        <Prose reveal lang={lang} content={sprout.content} resolve={(ref) => resolveEntity(data, ref, lang)} />

        {/* Media and links return to a public page here — see the docblock. */}
        <MediaList media={sprout.media} />

        {sprout.links && sprout.links.length > 0 ? (
          <div {...seq(6, "flex justify-center")}>
            <LinkRow links={sprout.links} lang={lang} label={`Find ${resolveText(sprout.name, lang)} elsewhere`} />
          </div>
        ) : null}

        {/* The doors — what this entry is about. The pod page's "Inside"
            shape, with its own word. */}
        {doors.length > 0 ? (
          <nav aria-label="About" className="reveal flex flex-col gap-2">
            <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">About</h2>
            <ul className="flex flex-col gap-1">
              {doors.map((d) => (
                <li key={d.href}>
                  <a href={d.href} className="text-sm underline-offset-4 hover:underline">
                    {d.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </>
  );
}
