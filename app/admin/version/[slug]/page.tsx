import { notFound } from "next/navigation";
import { getVersion } from "@/lib/atomic";
import { editVersionAction, deleteVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

const ATOM_PREFIX = "atom:";

export default async function EditVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const version = await getVersion(slug);
  if (!version) notFound();

  const atomSlug = (version.parents ?? [])
    .filter((p) => p.startsWith(ATOM_PREFIX))
    .map((p) => p.slice(ATOM_PREFIX.length))[0];
  const backHref = atomSlug ? `/admin/atom/${atomSlug}` : "/admin/vault";

  return (
    <article>
      <p>
        <a href={backHref}>← back</a>
      </p>
      <h1>Edit version</h1>
      {error ? <p role="alert">{error}</p> : null}

      <ul>
        <li>slug: {version.slug}</li>
        <li>atom: {atomSlug ?? "—"}</li>
      </ul>

      <form action={editVersionAction}>
        <input type="hidden" name="slug" value={version.slug} />
        <p>
          <label>
            Name <input type="text" name="name" defaultValue={version.name} required />
          </label>
        </p>
        <p>
          <label>
            Type <input type="text" name="type" defaultValue={version.type} required />
          </label>
        </p>
        <p>
          <label>
            Date <input type="date" name="date" defaultValue={version.date} required />
          </label>
        </p>
        <p>
          <label>
            Description <textarea name="description" defaultValue={version.description} />
          </label>
        </p>
        <fieldset>
          <legend>State</legend>
          <label>
            <input
              type="radio"
              name="state"
              value="draft"
              defaultChecked={version.state === "draft" || version.state == null}
            />{" "}
            draft
          </label>
          <label>
            <input type="radio" name="state" value="private" defaultChecked={version.state === "private"} />{" "}
            private
          </label>
          <label>
            <input type="radio" name="state" value="published" defaultChecked={version.state === "published"} />{" "}
            published
          </label>
        </fieldset>
        <p>
          <button type="submit">Save</button>
        </p>
      </form>

      <hr />
      <section>
        <h2>Danger zone</h2>
        <form action={deleteVersionAction}>
          <input type="hidden" name="slug" value={version.slug} />
          <p>
            <label>
              <input type="checkbox" name="confirm" required /> Yes, permanently delete the version
              “{version.name}” — this cannot be undone.
            </label>
          </p>
          <p>
            <button type="submit">Delete version</button>
          </p>
        </form>
      </section>
    </article>
  );
}
