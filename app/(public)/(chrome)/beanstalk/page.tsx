import { buildDataset, filterPublic, resolveText } from "@/lib/data";
import { loadCachedGarden } from "@/lib/garden-cache";
import { getFederation } from "@/lib/federation";
import { listPollen } from "@/lib/pollen-store";
import { exhibitedPollen, mergeBeanstalk, plantSlugOf } from "@/lib/beanstalk";
import { Badge } from "@/components/ui/badge";
import { seq } from "@/components/reveal";
import { Separator } from "@/components/ui/separator";
import { currentLang } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

// The beanstalk (spec §6): the union of authored sprouts and exhibited feed
// events, newest first — growth over time is the page's meaning. Reads the
// Mongo cache only, never upstream feeds.
export default async function BeanstalkPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const { plant } = await searchParams;
  const lang = await currentLang();
  const [raw, allPollen] = await Promise.all([loadCachedGarden(), listPollen()]);
  const pub = filterPublic(raw);
  const data = buildDataset(pub);
  const plantSlugs = data.getPlants().map((p) => p.slug);
  const active = plant && plantSlugs.includes(plant) ? plant : "all";

  const pollen = exhibitedPollen(allPollen, getFederation().exhibit, new Set(plantSlugs));
  const keptBeanSlugs = new Set((pub.beans ?? []).map((b) => b.slug));
  const entries = mergeBeanstalk(data.timelineSprouts(), pollen, keptBeanSlugs).filter(
    (e) => active === "all" || plantSlugOf(e) === active,
  );

  return (
    <article className="flex flex-col gap-8">
      <h1 {...seq(0, "font-heading text-2xl font-medium tracking-tight")}>Beanstalk</h1>

      <nav {...seq(1)}>
        <ul className="flex flex-wrap items-center gap-2">
          {["all", ...plantSlugs].map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <Badge>{filter}</Badge>
              ) : (
                <a
                  href={
                    filter === "all"
                      ? "/beanstalk"
                      : `/beanstalk?plant=${encodeURIComponent(filter)}`
                  }
                >
                  <Badge variant="outline" className="transition-colors hover:bg-accent">
                    {filter}
                  </Badge>
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <Separator {...seq(2)} />

      {/* Each entry arrives as it reaches the fold — the timeline is the one
          surface here long enough for that to be the whole point. */}
      <ul className="reveal-each flex flex-col gap-4">
        {entries.map((e) =>
          e.type === "sprout" ? (
            <li key={`sprout:${e.entry.sprout.slug}`} className="flex flex-col gap-1">
              <span className="text-base">
                {e.entry.bean ? (
                  <a
                    href={`/bean/${e.entry.bean.slug}`}
                    className="underline-offset-4 transition-colors hover:underline"
                  >
                    {resolveText(e.entry.sprout.name, lang)}
                  </a>
                ) : (
                  resolveText(e.entry.sprout.name, lang)
                )}
              </span>
              <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
                <time dateTime={e.entry.sprout.date}>{e.date}</time>
                <Badge variant="secondary">{e.entry.sprout.type}</Badge>
              </span>
            </li>
          ) : (
            <li key={`pollen:${e.pollen.id}`} className="flex flex-col gap-1">
              <span className="text-base">
                {e.url ? (
                  <a href={e.url} className="underline-offset-4 transition-colors hover:underline">
                    {resolveText(e.pollen.title, lang)}
                  </a>
                ) : (
                  resolveText(e.pollen.title, lang)
                )}
              </span>
              <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
                <time dateTime={e.pollen.at}>{e.date}</time>
                <Badge variant="secondary">{e.pollen.kind}</Badge>
                <span>{e.pollen.source}</span>
                {e.beanSlug ? (
                  <a
                    href={`/bean/${e.beanSlug}`}
                    className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {e.beanSlug}
                  </a>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
