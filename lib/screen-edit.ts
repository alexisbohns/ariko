import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  composeText,
  textPart,
  type Relation,
  type Screen,
  type Text,
} from "./data";

/**
 * A screen's editable metadata — and nothing else.
 *
 * `slug` is absent for `PlantMetaPatch`'s reason: it is the stable id, and the
 * gallery, the covers migration and every future `screen:` ref will point at
 * it. `image` is absent because it has its own form and its own guards
 * (lib/screen-image.ts). `visibility` is absent because `writeExhibition`
 * (lib/botanical.ts) OWNS the field: exhibiting a screen publishes it and
 * withdrawing it makes it private again, one act tied to the strip. A second
 * control writing `visibility` from this form could contradict that act with
 * nothing to reconcile the two.
 */
export interface ScreenMetaPatch {
  name: Text;
  /** `null` MEANS clear — the writer turns it into an `$unset`. The field
   *  belongs to a record that already exists, so a blank has to cross the wire
   *  as an INSTRUCTION rather than as an absence, or the author's deletion is
   *  silently ignored (lib/bean-keyword.ts states the same). */
  legend: Text | null;
  /** `[]` MEANS clear, for the same reason. */
  tags: string[];
  /** Containment. `[]` is a standalone screen. */
  parents: string[];
  /** The WHOLE array, with non-`shows` kinds carried through. */
  relations: Relation[];
}

export type ScreenMetaResult =
  | { ok: false; error: string }
  | { ok: true; dirty: false }
  | { ok: true; dirty: true; patch: ScreenMetaPatch };

/** Pure. A comma-separated field → tags. De-duplicated in first-seen order, so
 *  the author's ordering survives a round trip. */
export function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

// Field-order-insensitive comparison of everything this form can write. Text
// halves are read with the STRICT textPart on BOTH sides, and the precision
// matters: resolveText falls back across languages, so a value carrying ONE
// half reads as though it carried two identical ones. Every imported screen is
// in exactly that state — the import writes a plain string — so the author
// filling in a French name that matches the English word would canonicalize
// equal to the stored en-only string, read as clean, and write nothing at all.
// The fr box is prefilled with textPart, so it would come back empty and the
// author would retype it forever. lib/screen-edit.test.ts pins both halves of
// that, and the pin is not the obvious one: an edit to `fr` with `en` present
// on BOTH sides survives the swap, because resolveText only falls back when the
// half it is asked for is blank.
function canonical(patch: ScreenMetaPatch): string {
  return JSON.stringify([
    textPart(patch.name, "en"),
    textPart(patch.name, "fr"),
    patch.legend === null ? null : [textPart(patch.legend, "en"), textPart(patch.legend, "fr")],
    patch.tags,
    patch.parents,
    patch.relations.map((r) => [r.kind, r.ref]),
  ]);
}

/** The screen as it is stored, expressed as the patch a no-op save produces —
 *  which is what lets the dirty gate compare like with like. */
function stored(screen: Screen): ScreenMetaPatch {
  return {
    name: screen.name,
    legend: screen.legend ?? null,
    tags: screen.tags ?? [],
    parents: screen.parents ?? [],
    relations: screen.relations ?? [],
  };
}

/**
 * Pure. The Meta form → the fields to write, or "nothing changed".
 *
 * Dirty-gated: opening a screen and saving it untouched must write nothing at
 * all — the author walks this library with prev/next, and a save on every stop
 * would rewrite a hundred and seventy documents for no reason.
 *
 * A blank name is REFUSED rather than defaulted. `buildPlantMetaPatch` refuses
 * one because a nameless plant is a public claim rendered wrongly; a nameless
 * screen is worse in a different way — it is a screen that cannot be found
 * again in a library of a hundred and seventy, and the image is the only thing
 * left to identify it by.
 *
 * The relations rule is the one to read twice. This form owns exactly ONE kind,
 * `shows`, and every other kind is carried through verbatim. The import wrote
 * `{ kind: "cover" }` on the eight screens the landing row already uses, and
 * that relation is the mapping the covers-become-refs slice depends on — so a
 * relations editor that replaced the array wholesale would silently delete the
 * thing a later migration needs, with nothing on the page to say so.
 */
export function buildScreenMetaPatch(current: Screen, form: FormData): ScreenMetaResult {
  const get = (key: string) => String(form.get(key) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") return { ok: false, error: "a screen needs a name in at least one language" };

  const legend = composeText(get("legend"), get("legendFr"));

  // Both cross the wire as free strings and NEITHER is checked against the
  // garden, so a crafted POST can write `plant:anything` or point `shows` at a
  // bean that does not exist. That is tolerated rather than overlooked: a
  // dangling ref is a shape this model handles everywhere — buildDataset ignores
  // one, filterPublic scrubs one — so the worst outcome is a screen that lists
  // no parent, which is already a legal screen. The surface is
  // admin-authenticated, which is the same stance lib/media-input.ts records for
  // not host-checking a stored URL.
  //
  // The contrast is the plant header's two enum fields, which DO re-validate
  // against their vocabulary (lib/plant-status.ts, lib/plant-visibility.ts):
  // those are public claims the site renders as though authored, and there is no
  // read path that quietly absorbs a wrong one.
  const plant = get("plant");
  const bean = get("bean");

  // Every kind but `shows` survives untouched, in its stored position; the
  // author's pick replaces the existing `shows` where it stood, or is appended
  // when there was none. Order is preserved because the array is an author-
  // visible sequence everywhere else in this model.
  const others = (current.relations ?? []).filter((r) => r.kind !== "shows");
  const at = (current.relations ?? []).findIndex((r) => r.kind === "shows");
  const relations: Relation[] = [...others];
  if (bean) {
    relations.splice(at === -1 ? relations.length : at, 0, {
      kind: "shows",
      ref: `${BEAN_PREFIX}${bean}`,
    });
  }

  const patch: ScreenMetaPatch = {
    name,
    legend: legend === "" ? null : legend,
    tags: parseTags(get("tags")),
    parents: plant ? [`${PLANT_PREFIX}${plant}`] : [],
    relations,
  };

  return canonical(patch) === canonical(stored(current))
    ? { ok: true, dirty: false }
    : { ok: true, dirty: true, patch };
}

export interface ScreenMetaUpdate {
  $set: Record<string, unknown>;
  $unset?: Record<string, "">;
}

/**
 * Pure. The Mongo update document — split out of the writer because getting
 * this shape wrong is SILENT.
 *
 * `plantMetaUpdate` learned that the expensive way: composing `$set` and
 * `$unset` with a spread produces an object literal with two `$set` keys, the
 * later one wins, and the write drops fields with no error anywhere. TypeScript
 * does not flag a duplicate key introduced by a spread. So the fields
 * accumulate into ONE `$set` and `$unset` is added beside it — the two
 * operators are legal together; two `$set`s are not.
 *
 * Three fields clear rather than store empty, which is `createScreen`'s
 * omission discipline continued into the edit path: an absent optional field
 * has ONE representation in the database, so the gallery's future "has a
 * caption" filter has one thing to check.
 */
export function screenMetaUpdate(patch: ScreenMetaPatch): ScreenMetaUpdate {
  const $set: Record<string, unknown> = { name: patch.name, parents: patch.parents };
  const $unset: Record<string, ""> = {};

  if (patch.legend === null) $unset.legend = "";
  else $set.legend = patch.legend;

  if (patch.tags.length === 0) $unset.tags = "";
  else $set.tags = patch.tags;

  if (patch.relations.length === 0) $unset.relations = "";
  else $set.relations = patch.relations;

  return Object.keys($unset).length > 0 ? { $set, $unset } : { $set };
}
