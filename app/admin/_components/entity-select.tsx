import { resolveText, type Text } from "@/lib/data";
import { NativeSelect } from "@/components/ui/native-controls";

/**
 * The library's one way to offer a plant or a bean, drawn by all three of its
 * selects — the Meta form's two and the create form's one.
 *
 * It exists for the ORPHAN option rather than for the tidiness. `defaultValue`
 * matches an option by value, so a stored slug that is no longer in the list —
 * a deleted plant, a bean a pollen rebuild removed, a ref written by hand —
 * silently selects the FIRST option, `— none —`, and the next Save posts an
 * empty string. `buildScreenMetaPatch` then writes `parents: []` and drops the
 * `shows` relation, and the dirty gate does not catch it because the patch
 * genuinely differs. That is silent, unrecoverable, and invisible until someone
 * notices a screen lost its plant — so the unknown slug is rendered as a real
 * option, marked missing, and the round trip stays lossless.
 *
 * Labels carry the slug the way the admin tables and the palette do (`hint` in
 * components/admin/glyphs.tsx): two beans under different plants can share a
 * display name, and a select has no second line to tell them apart. Sorting on
 * that whole label rather than the raw collection order is what makes seventy-
 * three beans findable; `localeCompare` because these are human names, matching
 * `entityOptions` in lib/entity-options.ts.
 */
export function EntitySelect({
  id,
  name,
  current,
  entities,
}: {
  id: string;
  name: string;
  /** The stored slug, or "" — used as the `defaultValue` verbatim. */
  current: string;
  entities: Array<{ slug: string; name: Text }>;
}) {
  const options = entities
    .map((entity) => ({ value: entity.slug, label: `${resolveText(entity.name)} — ${entity.slug}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const orphan = current !== "" && !options.some((option) => option.value === current);

  return (
    <NativeSelect id={id} name={name} defaultValue={current}>
      <option value="">— none —</option>
      {orphan ? <option value={current}>{current} — missing</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
