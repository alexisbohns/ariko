import { resolveText, type Domain } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

const DOMAINS: Domain[] = ["music", "design", "podcast"];
const FILTERS: (Domain | "all")[] = ["all", ...DOMAINS];

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  const active: Domain | "all" =
    domain && (DOMAINS as string[]).includes(domain) ? (domain as Domain) : "all";

  const entries = (await getPublicDataset())
    .timelineVersions()
    .filter((entry) => active === "all" || entry.domain === active);

  return (
    <article>
      <h1>Timeline</h1>

      <nav>
        <ul>
          {FILTERS.map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <strong>{filter}</strong>
              ) : (
                <a href={filter === "all" ? "/timeline" : `/timeline?domain=${filter}`}>{filter}</a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <ul>
        {entries.map((entry) => (
          <li key={entry.version.slug}>
            {entry.atom ? (
              <a href={`/atom/${entry.atom.slug}`}>{resolveText(entry.version.name)}</a>
            ) : (
              resolveText(entry.version.name)
            )}
            {" — "}
            <time dateTime={entry.version.date}>{entry.version.date}</time>
            {" — "}
            {entry.version.type}
          </li>
        ))}
      </ul>
    </article>
  );
}
