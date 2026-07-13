import { getFullDataset } from "@/lib/store";
import type { TimelineEntry } from "@/lib/data";
import { filterVaultEntries, distinctTags } from "@/lib/vault";

export const dynamic = "force-dynamic";

const STATE_OPTIONS = ["all", "draft", "private", "published"];
const DOMAIN_OPTIONS = ["all", "music", "design", "podcast"];

type Active = { state?: string; domain?: string; tag?: string };

// Build a filter link that sets one dimension to `value` (or clears it when "all")
// while preserving the other active filters. Zero-JS — plain hrefs.
function vaultHref(active: Active, key: keyof Active, value: string): string {
  const merged: Active = { ...active, [key]: value };
  const params = new URLSearchParams();
  for (const k of ["state", "domain", "tag"] as const) {
    const v = merged[k];
    if (v && v !== "all") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/vault?${qs}` : "/admin/vault";
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; domain?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: TimelineEntry[] | null = null;
  try {
    all = (await getFullDataset()).timelineVersions();
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <p>
          <a href="/admin">← inbox</a>
        </p>
        <h1>Vault</h1>
        <p role="alert">Couldn&apos;t load the vault.</p>
      </article>
    );
  }

  const entries = filterVaultEntries(all, active);
  const tagOptions = ["all", ...distinctTags(all)];

  const filterRow = (label: string, key: keyof Active, options: string[]) => {
    const current = active[key] ?? "all";
    return (
      <p>
        {label}:{" "}
        {options.map((opt) => (
          <span key={opt}>
            {opt === current ? <strong>{opt}</strong> : <a href={vaultHref(active, key, opt)}>{opt}</a>}{" "}
          </span>
        ))}
      </p>
    );
  };

  return (
    <article>
      <p>
        <a href="/admin">← inbox</a>
      </p>
      <h1>Vault</h1>

      {filterRow("state", "state", STATE_OPTIONS)}
      {filterRow("domain", "domain", DOMAIN_OPTIONS)}
      {filterRow("tag", "tag", tagOptions)}

      <p>
        showing {entries.length} of {all.length}
      </p>

      {entries.length === 0 ? (
        <p>No matching versions.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>version</th>
              <th>state</th>
              <th>domain</th>
              <th>atom</th>
              <th>date</th>
              <th>tags</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.version.slug}>
                <td>
                  {e.atom ? <a href={`/atom/${e.atom.slug}`}>{e.version.name}</a> : e.version.name}
                </td>
                <td>{e.version.state ?? "—"}</td>
                <td>{e.domain ?? "—"}</td>
                <td>{e.atom?.slug ?? "—"}</td>
                <td>{e.version.date}</td>
                <td>{(e.version.tags ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
