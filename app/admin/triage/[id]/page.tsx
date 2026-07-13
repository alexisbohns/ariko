import { notFound } from "next/navigation";
import { getCapture } from "@/lib/captures";
import { listMolecules, listAtoms } from "@/lib/atomic";
import { resolveText } from "@/lib/data";
import { promoteCaptureAction, discardCaptureAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const capture = await getCapture(id);
  if (!capture || capture.status !== "inbox") notFound();

  const [molecules, atoms] = await Promise.all([listMolecules(), listAtoms()]);
  const note = resolveText(capture.body);

  return (
    <article>
      <p>
        <a href="/admin">← inbox</a>
      </p>
      <h1>Triage</h1>
      {error ? <p role="alert">Could not promote: {error}</p> : null}

      <section>
        <h2>{capture.title}</h2>
        {note ? <p>{note}</p> : null}
        <p>source: {capture.source.kind}</p>
        {capture.media.length > 0 ? (
          <ul>
            {capture.media.map((m, i) => (
              <li key={i}>
                {m.kind}: {m.url}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form action={promoteCaptureAction}>
        <input type="hidden" name="captureId" value={capture.id} />

        <fieldset>
          <legend>Molecule</legend>
          <p>
            <label>
              Existing{" "}
              <select name="moleculeSlug" defaultValue="">
                <option value="">— none —</option>
                {molecules.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newMoleculeSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newMoleculeName" />
            </label>
          </p>
          <p>
            <label>
              New domain{" "}
              <select name="newMoleculeDomain" defaultValue="music">
                <option value="music">music</option>
                <option value="design">design</option>
                <option value="podcast">podcast</option>
              </select>
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Atom</legend>
          <p>
            <label>
              Existing{" "}
              <select name="atomSlug" defaultValue="">
                <option value="">— none —</option>
                {atoms.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newAtomSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newAtomName" />
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Version</legend>
          <p>
            <label>
              Slug <input type="text" name="versionSlug" required />
            </label>
          </p>
          <p>
            <label>
              Name <input type="text" name="versionName" defaultValue={capture.title} required />
            </label>
          </p>
          <p>
            <label>
              Type <input type="text" name="type" required />
            </label>
          </p>
          <p>
            <label>
              Date <input type="date" name="date" required />
            </label>
          </p>
          <p>
            <label>
              Description <textarea name="description" defaultValue={note} />
            </label>
          </p>
          <fieldset>
            <legend>State</legend>
            <label>
              <input type="radio" name="state" value="draft" defaultChecked /> draft
            </label>
            <label>
              <input type="radio" name="state" value="private" /> private
            </label>
            <label>
              <input type="radio" name="state" value="published" /> published
            </label>
          </fieldset>
        </fieldset>

        <p>
          <button type="submit">Promote</button>
        </p>
      </form>

      <form action={discardCaptureAction}>
        <input type="hidden" name="captureId" value={capture.id} />
        <button type="submit">Discard</button>
      </form>
    </article>
  );
}
