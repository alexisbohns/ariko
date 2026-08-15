import { notFound } from "next/navigation";
import { getSeed } from "@/lib/seeds";
import { listPlants, listPods, listBeans } from "@/lib/botanical";
import { resolveText, textPart } from "@/lib/data";
import { promoteSeedAction, discardSeedAction } from "../../actions";

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

  const seed = await getSeed(id);
  if (!seed || seed.status !== "inbox") notFound();

  const [plants, pods, beans] = await Promise.all([listPlants(), listPods(), listBeans()]);
  const note = resolveText(seed.body);

  return (
    <article>
      <p>
        <a href="/admin">← inbox</a>
      </p>
      <h1>Triage</h1>
      {error ? <p role="alert">Could not promote: {error}</p> : null}

      <section>
        <h2>{resolveText(seed.title)}</h2>
        {note ? <p>{note}</p> : null}
        <p>source: {seed.source.kind}</p>
        {seed.suggested ? (
          <p>
            suggested:{" "}
            {[
              seed.suggested.plantSlug && `plant ${seed.suggested.plantSlug}`,
              seed.suggested.podSlug && `pod ${seed.suggested.podSlug}`,
              seed.suggested.beanSlug && `bean ${seed.suggested.beanSlug}`,
              seed.suggested.type && `type ${seed.suggested.type}`,
              seed.suggested.tags?.length ? `tags ${seed.suggested.tags.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {seed.media.length > 0 ? (
          <ul>
            {seed.media.map((m, i) => (
              <li key={i}>
                {m.kind}: {m.url}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form action={promoteSeedAction}>
        <input type="hidden" name="seedId" value={seed.id} />

        <fieldset>
          <legend>Plant</legend>
          {/* Selecting a plant roots whichever parent is CREATED below: a new pod
              parents under it; a new bean with no pod parents directly under it. */}
          <p>
            <label>
              Existing{" "}
              <select name="plantSlug" defaultValue={seed.suggested?.plantSlug ?? ""}>
                <option value="">— none —</option>
                {plants.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Pod</legend>
          <p>
            <label>
              Existing{" "}
              <select name="podSlug" defaultValue={seed.suggested?.podSlug ?? ""}>
                <option value="">— none —</option>
                {pods.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newPodSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newPodName" />
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Bean</legend>
          <p>
            <label>
              Existing{" "}
              <select name="beanSlug" defaultValue={seed.suggested?.beanSlug ?? ""}>
                <option value="">— none —</option>
                {beans.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newBeanSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newBeanName" />
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Sprout</legend>
          <p>
            <label>
              Slug <input type="text" name="sproutSlug" required />
            </label>
          </p>
          {/* Prefills use the STRICT textPart — resolveText's fallback would copy en
              into the fr box and corrupt the data on save. The name inputs carry no
              `required`: the name is required as a whole (either language), enforced
              server-side, and the builder falls back to the seed title. Blank
              description fields carry the seed's note verbatim on promote. */}
          <p>
            <label>
              Name <input type="text" name="sproutName" defaultValue={textPart(seed.title, "en")} />
            </label>
          </p>
          <p>
            <label>
              Name (fr) <input type="text" name="sproutNameFr" defaultValue={textPart(seed.title, "fr")} />
            </label>
          </p>
          <p>
            <label>
              Type <input type="text" name="type" required defaultValue={seed.suggested?.type ?? ""} />
            </label>
          </p>
          <p>
            <label>
              Date <input type="date" name="date" required />
            </label>
          </p>
          <p>
            <label>
              Description <textarea name="description" defaultValue={textPart(seed.body, "en")} />
            </label>
          </p>
          <p>
            <label>
              Description (fr) <textarea name="descriptionFr" defaultValue={textPart(seed.body, "fr")} />
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

      <form action={discardSeedAction}>
        <input type="hidden" name="seedId" value={seed.id} />
        <button type="submit">Discard</button>
      </form>
    </article>
  );
}
