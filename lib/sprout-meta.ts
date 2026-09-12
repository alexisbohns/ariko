import { composeText, type Text } from "./data";

/**
 * A sprout's identity fields — and nothing else.
 *
 * The sibling of `lib/plant-meta.ts`, with two deliberate differences that are
 * both about what the stored shape allows:
 *
 *  - There is no `$unset` half and therefore no pure `sproutMetaUpdate` beside
 *    this. `Sprout.description` is REQUIRED in `lib/data.ts`, unlike
 *    `Plant.description`, so a cleared description is the empty string rather
 *    than an instruction to remove a key. `plantMetaUpdate` exists because
 *    composing `$set` and `$unset` inline with a spread silently drops fields;
 *    there is no `$unset` here to compose with, so adding the missing half for
 *    symmetry would be adding the bug's cure to a body that cannot catch it.
 *
 *    The TYPE is not the whole of that argument, because a stored document's
 *    real shape is not enforced by an interface — a sprout written before the
 *    field existed could lack the key. The write path is what closes it: every
 *    writer, `createSprout` and `updateSproutMeta` alike, always sets a
 *    definite string, so the key is backfilled the first time anything touches
 *    such a document, and `resolveText` reads an absent one as empty until then.
 *
 *  - There is no `status` field riding along. The plant's meta form carries one
 *    as a hidden input because `buildPlantMetaPatch` reads an absent status as
 *    `active` and dropping it would reactivate an inactive plant on every name
 *    edit. This patch names two fields and the writer names the same two, so
 *    there is nothing for a missing input to default.
 *
 * `slug` is absent for `lib/plant-meta.ts`'s reason: it is what every
 * `parents[]` ref points at and what a promoted seed's `promotedTo` records, so
 * renaming it from a metadata form would orphan things with no cascade to catch
 * it. A slug change stays a manual, deliberate act.
 */
export interface SproutMetaPatch {
  name: Text;
  description: Text;
}

export class BlankSproutNameError extends Error {
  constructor() {
    super("a sprout needs a name in at least one language");
    this.name = "BlankSproutNameError";
  }
}

/**
 * Pure. Maps the meta overlay's form → the stored fields.
 *
 * The blank name throws rather than falling back, the stance
 * `buildPlantMetaPatch` takes and for the same reason: a nameless sprout is a
 * claim the admin's every table and the public bean page would then render as
 * though it had been authored. The action turns the throw into an `?error`
 * redirect.
 *
 * "Blank" means blank in BOTH languages. `composeText` returns `""` only when
 * neither half survives trimming, so an fr-only name passes — which is the B1
 * rule the paired inputs exist for.
 */
export function buildSproutMetaPatch(form: FormData): SproutMetaPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") throw new BlankSproutNameError();

  return { name, description: composeText(get("description"), get("descriptionFr")) };
}
