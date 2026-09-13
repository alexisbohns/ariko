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

/** The Mongo update document for a meta patch. Pure, so it can be pinned. */
export interface BeanMetaUpdate {
  $set: Record<string, unknown>;
  $unset?: Record<string, "">;
}

/**
 * Pure. Builds the update document — `lib/plant-meta.ts`'s `plantMetaUpdate`,
 * for the bean, and it lives HERE beside its patch rather than in
 * `lib/botanical.ts` for the reason that file's writers give from the other
 * side: `lib/botanical.ts` holds writes, and a pure shape parked among them is
 * a pure shape the garden-cache test then has to classify as a "reader" to
 * explain.
 *
 * Split out of the writer because getting this shape wrong is SILENT, which
 * `plantMetaUpdate`'s docblock records from experience: composing it inline as
 * `{ $set: { name }, ...(description === null ? { $unset } : { $set: { description } }) }`
 * produces an object literal with TWO `$set` keys whenever a description is
 * present. The later one wins, so the write carries the description alone and
 * drops the name. Mongo reports nothing, the action redirects as though it had
 * worked, and TypeScript does not flag a duplicate key introduced by a spread.
 *
 * So the fields are accumulated into ONE `$set`, and `$unset` is added beside it
 * (the two operators are legal together; two `$set`s are not).
 */
export function beanMetaUpdate(patch: BeanMetaPatch): BeanMetaUpdate {
  const $set: Record<string, unknown> = { name: patch.name };
  if (patch.description !== null) {
    $set.description = patch.description;
    return { $set };
  }
  return { $set, $unset: { description: "" } };
}
