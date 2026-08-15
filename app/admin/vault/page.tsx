import { getFullDataset } from "@/lib/store";
import { resolveText, type TimelineEntry } from "@/lib/data";
import { filterVaultEntries, distinctPlants, distinctTags } from "@/lib/vault";

export const dynamic = "force-dynamic";

const STATE_OPTIONS = ["all", "draft", "private", "published"];

type Active = { state?: string; plant?: string; tag?: string };

// Build a filter link that sets one dimension to `value` (or clears it when "all")
// while preserving the other active filters. Zero-JS — plain hrefs.
function vaultHref(active: Active, key: keyof Active, value: string): string {
  const merged: Active = { ...active, [key]: value };
  const params = new URLSearchParams();
  for (const k of ["state", "plant", "tag"] as const) {
    const v = merged[k];
    if (v && v !== "all") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/vault?${qs}` : "/admin/vault";
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; plant?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: TimelineEntry[] | null = null;
  try {
    all = (await getFullDataset()).timelineSprouts();
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
  const plantOptions = ["all", ...distinctPlants(all)];
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
      {filterRow("plant", "plant", plantOptions)}
      {filterRow("tag", "tag", tagOptions)}

      <p>
        showing {entries.length} of {all.length}
      </p>

      {entries.length === 0 ? (
        <p>No matching sprouts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>sprout</th>
              <th>state</th>
              <th>plant</th>
              <th>bean</th>
              <th>date</th>
              <th>tags</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.sprout.slug}>
                <td>
                  {e.bean ? (
                    <a href={`/admin/bean/${e.bean.slug}`}>{resolveText(e.sprout.name)}</a>
                  ) : (
                    resolveText(e.sprout.name)
                  )}
                </td>
                <td>{e.sprout.state ?? "—"}</td>
                <td>{e.plant?.slug ?? "—"}</td>
                <td>{e.bean?.slug ?? "—"}</td>
                <td>{e.sprout.date}</td>
                <td>{(e.sprout.tags ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
