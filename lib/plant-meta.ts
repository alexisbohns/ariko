import { composeText, type PlantStatus, type Text } from "./data";
import { isPlantStatus } from "./plant-status";

/**
 * A plant's identity fields — and nothing else. `slug` is absent on purpose:
 * it is what every `parents[]` ref points at, so renaming it from a metadata
 * form would orphan every pod and bean beneath the plant with no cascade to
 * catch it. A slug change stays a manual, deliberate act.
 */
export interface PlantMetaPatch {
  name: Text;
  // `null` MEANS clear. Unlike buildPlantRolePatch, which simply omits a blank
  // `title`, this field belongs to a record that already exists: omitting the
  // key would silently leave the old description in place, so a blank has to
  // cross the wire as an instruction rather than as an absence.
  description: Text | null;
  status: PlantStatus;
}

export class BlankPlantNameError extends Error {
  constructor() {
    super("a plant needs a name in at least one language");
    this.name = "BlankPlantNameError";
  }
}

export class InvalidPlantStatusError extends Error {
  constructor(public received: string) {
    super(`unknown status: ${received}`);
    this.name = "InvalidPlantStatusError";
  }
}

/**
 * Pure. Maps the Meta card's form → the stored fields.
 *
 * Both failure modes throw rather than falling back, the stance
 * buildPlantRolePatch takes and for the same reason: a nameless plant and a
 * mis-stated status are both public claims the site would then render as
 * though they were authored. The action turns each throw into an ?error
 * redirect.
 */
export function buildPlantMetaPatch(form: FormData): PlantMetaPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") throw new BlankPlantNameError();

  const description = composeText(get("description"), get("descriptionFr"));

  // Absent reads as "active" — the same tolerant default the type declares —
  // while a PRESENT but unrecognized value throws. The two are different
  // events: a form that omits the field never expressed an intent, and a form
  // that submits "archived" expressed one this vocabulary cannot honour.
  const raw = get("status") || "active";
  if (!isPlantStatus(raw)) throw new InvalidPlantStatusError(raw);

  return { name, description: description === "" ? null : description, status: raw };
}

/** The Mongo update document for a meta patch. Pure, so it can be pinned. */
export interface PlantMetaUpdate {
  $set: Record<string, unknown>;
  $unset?: Record<string, "">;
}

/**
 * Pure. Builds the update document — split out of the writer because getting
 * this shape wrong is silent.
 *
 * The first version composed it with a spread:
 *
 *   { $set: { name, status }, ...(description === null ? { $unset } : { $set: { description } }) }
 *
 * which produces an object literal with TWO `$set` keys whenever a description
 * is present. The later one wins, so the write carried the description alone
 * and dropped the name and the status. Mongo reported nothing, the action
 * redirected as though it had worked, and the symptom was "the status will not
 * change" on every plant that has a description — which is every real one.
 * TypeScript does not flag a duplicate key introduced by a spread.
 *
 * So the fields are accumulated into ONE `$set`, and `$unset` is added beside
 * it (the two operators are legal together; two `$set`s are not).
 */
export function plantMetaUpdate(patch: PlantMetaPatch): PlantMetaUpdate {
  const $set: Record<string, unknown> = { name: patch.name, status: patch.status };
  if (patch.description !== null) {
    $set.description = patch.description;
    return { $set };
  }
  return { $set, $unset: { description: "" } };
}
