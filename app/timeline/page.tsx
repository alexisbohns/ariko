import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const { plant } = await searchParams;
  const data = await getPublicDataset();
  const plantSlugs = data.getPlants().map((p) => p.slug);
  const active = plant && plantSlugs.includes(plant) ? plant : "all";

  const entries = data
    .timelineSprouts()
    .filter((entry) => active === "all" || entry.plant?.slug === active);

  return (
    <article>
      <h1>Timeline</h1>

      <nav>
        <ul>
          {["all", ...plantSlugs].map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <strong>{filter}</strong>
              ) : (
                <a href={filter === "all" ? "/timeline" : `/timeline?plant=${encodeURIComponent(filter)}`}>{filter}</a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <ul>
        {entries.map((entry) => (
          <li key={entry.sprout.slug}>
            {entry.bean ? (
              <a href={`/bean/${entry.bean.slug}`}>{resolveText(entry.sprout.name)}</a>
            ) : (
              resolveText(entry.sprout.name)
            )}
            {" — "}
            <time dateTime={entry.sprout.date}>{entry.sprout.date}</time>
            {" — "}
            {entry.sprout.type}
          </li>
        ))}
      </ul>
    </article>
  );
}
