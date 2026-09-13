import { composeText, type Text } from "./data";

/**
 * A bean's identity fields — and nothing else.
 *
 * `lib/plant-meta.ts`'s sibling, minus its third field. `slug` is absent for the
 * reason that file gives: it is what every `parents[]` ref points at, so
 * renaming it from a metadata form would orphan every sprout beneath the bean
 * with no cascade to catch it. A slug change stays a manual, deliberate act.
 *
 * There is no hidden-field trap to inherit either. `buildPlantMetaPatch` has to
 * carry `status` because it reads an absent one as `active`, so a form dropping
 * the input silently reactivates an inactive plant; a bean has no status, and
 * its `visibility` travels through its own one-field action rather than riding
 * this patch — a name edit must not be able to publish anything.
 */
export interface BeanMetaPatch {
  name: Text;
  /** `null` MEANS clear, exactly as `PlantMetaPatch.description` does. */
  description: Text | null;
}

export class BlankBeanNameError extends Error {
  constructor() {
    super("a bean needs a name in at least one language");
    this.name = "BlankBeanNameError";
  }
}

/**
 * Pure. Maps the bean's meta form to the stored fields.
 *
 * A blank name THROWS rather than falling back, `buildPlantMetaPatch`'s stance:
 * a nameless bean is a public claim the site would render as though it had been
 * authored. The action turns the throw into an `?error=` redirect.
 */
export function buildBeanMetaPatch(form: FormData): BeanMetaPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") throw new BlankBeanNameError();

  const description = composeText(get("description"), get("descriptionFr"));

  return { name, description: description === "" ? null : description };
}
