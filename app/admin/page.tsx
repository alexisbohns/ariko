import type { Capture } from "@/lib/data";
import { listCaptures } from "@/lib/captures";
import { createCaptureAction, logoutAction } from "./actions";

export const dynamic = "force-dynamic";

function noteSnippet(body: Capture["body"]): string {
  const text = body?.en || body?.fr || "";
  if (!text) return "—";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function mediaLabel(media: Capture["media"]): string {
  if (media.length === 0) return "—";
  if (media.length === 1) return `1 ${media[0].kind}`;
  return `${media.length} items`;
}

function ageLabel(createdAt: string, now: number): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let captures: Capture[] | null = null;
  try {
    captures = await listCaptures({ status: "inbox" });
  } catch {
    captures = null; // rendered as a load-failure line below
  }

  const now = Date.now();

  return (
    <article>
      <form action={logoutAction}>
        <button type="submit">Log out</button>
      </form>

      <h1>Capture</h1>
      {error ? <p role="alert">Could not save: {error}</p> : null}
      <form action={createCaptureAction}>
        <p>
          <label>
            Title <input type="text" name="title" required />
          </label>
        </p>
        <p>
          <label>
            Note <textarea name="note" rows={2} />
          </label>
        </p>
        <fieldset>
          <legend>Note language</legend>
          <label>
            <input type="radio" name="lang" value="en" defaultChecked /> en
          </label>
          <label>
            <input type="radio" name="lang" value="fr" /> fr
          </label>
        </fieldset>
        <p>
          <label>
            Link <input type="url" name="link" placeholder="paste a URL" />
          </label>
        </p>
        <p>
          <label>
            Link <input type="url" name="link" placeholder="another URL (optional)" />
          </label>
        </p>
        <p>
          <button type="submit">Add to inbox</button>
        </p>
      </form>

      <h2>Inbox {captures ? `(${captures.length})` : ""}</h2>
      {captures === null ? (
        <p role="alert">Couldn&apos;t load the inbox.</p>
      ) : captures.length === 0 ? (
        <p>Inbox empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>source</th>
              <th>title</th>
              <th>note</th>
              <th>media</th>
              <th>age</th>
            </tr>
          </thead>
          <tbody>
            {captures.map((c) => (
              <tr key={c.id}>
                <td>{c.source.kind}</td>
                <td>{c.title}</td>
                <td>{noteSnippet(c.body)}</td>
                <td>{mediaLabel(c.media)}</td>
                <td>{ageLabel(c.createdAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
