import { resolveText, buildDataset } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { getFederation } from "@/lib/federation";
import { listCursors, listPollen, listRefusals } from "@/lib/pollen-store";
import { mergeBeanstalk } from "@/lib/beanstalk";
import { syncNowAction } from "../actions";

export const dynamic = "force-dynamic";

// Admin beanstalk (spec §6): EVERYTHING — every sprout state, every cached
// envelope (private and non-exhibited included), each line with provenance —
// plus the sync operations surface (cursors, refusals, Sync now).
export default async function AdminBeanstalkPage() {
  const [raw, pollen, cursors, refusals] = await Promise.all([
    loadRawGarden(),
    listPollen(),
    listCursors(),
    listRefusals(),
  ]);
  const data = buildDataset(raw);
  const allBeanSlugs = new Set((raw.beans ?? []).map((b) => b.slug));
  const entries = mergeBeanstalk(data.timelineSprouts(), pollen, allBeanSlugs);
  const { feeds } = getFederation();

  return (
    <article>
      <h1>Beanstalk (admin)</h1>
      <p>
        <a href="/admin">← admin</a> · <a href="/beanstalk">public view →</a>
      </p>

      <h2>Feeds</h2>
      <form action={syncNowAction}>
        <button type="submit">Sync now</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>feed</th>
            <th>cursor</th>
            <th>last sync</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {feeds.map((f) => {
            const c = cursors.find((x) => x.feedId === f.id);
            return (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{c?.cursor ?? "—"}</td>
                <td>{c?.lastSyncAt ?? "never"}</td>
                <td>
                  {c?.lastStatus ?? "—"}
                  {c?.lastError ? ` (${c.lastError})` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {refusals.length > 0 ? (
        <>
          <h2>Refusals</h2>
          <ul>
            {refusals.map((r) => (
              <li key={`${r.feedId}:${r.rawHash}`}>
                <code>{r.feedId}</code> — {r.reason} — <time dateTime={r.at}>{r.at.slice(0, 10)}</time>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Entries</h2>
      <ul>
        {entries.map((e) =>
          e.type === "sprout" ? (
            <li key={`sprout:${e.entry.sprout.slug}`}>
              [{e.entry.sprout.state ?? "draft"}] {resolveText(e.entry.sprout.name)}
              {" — "}
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              {" — "}
              {e.entry.sprout.type} — authored
            </li>
          ) : (
            <li key={`pollen:${e.pollen.id}`}>
              [{e.pollen.visibility ?? "unset"}] {resolveText(e.pollen.title)}
              {" — "}
              <time dateTime={e.pollen.at}>{e.date}</time>
              {" — "}
              {e.pollen.kind} — feed:{e.pollen.feedId}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
