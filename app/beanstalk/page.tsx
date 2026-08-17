import { buildDataset, filterPublic, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { getFederation } from "@/lib/federation";
import { listPollen } from "@/lib/pollen-store";
import { exhibitedPollen, mergeBeanstalk, plantSlugOf } from "@/lib/beanstalk";

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
  const [raw, allPollen] = await Promise.all([loadRawGarden(), listPollen()]);
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
    <article>
      <h1>Beanstalk</h1>

      <nav>
        <ul>
          {["all", ...plantSlugs].map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <strong>{filter}</strong>
              ) : (
                <a href={filter === "all" ? "/beanstalk" : `/beanstalk?plant=${encodeURIComponent(filter)}`}>
                  {filter}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <ul>
        {entries.map((e) =>
          e.type === "sprout" ? (
            <li key={`sprout:${e.entry.sprout.slug}`}>
              {e.entry.bean ? (
                <a href={`/bean/${e.entry.bean.slug}`}>{resolveText(e.entry.sprout.name)}</a>
              ) : (
                resolveText(e.entry.sprout.name)
              )}
              {" — "}
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              {" — "}
              {e.entry.sprout.type}
            </li>
          ) : (
            <li key={`pollen:${e.pollen.id}`}>
              {e.url ? <a href={e.url}>{resolveText(e.pollen.title)}</a> : resolveText(e.pollen.title)}
              {" — "}
              <time dateTime={e.pollen.at}>{e.date}</time>
              {" — "}
              {e.pollen.kind}
              {" — "}
              {e.pollen.source}
              {e.beanSlug ? (
                <>
                  {" — "}
                  <a href={`/bean/${e.beanSlug}`}>{e.beanSlug}</a>
                </>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
