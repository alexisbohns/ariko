import type { Seed, Media, Source, Text, SproutState } from "./data";
import { composeText, resolveText } from "./data";

export type ParentResolution =
  | { mode: "create"; slug: string }
  | { mode: "existing"; slug: string }
  | { mode: "none" };

// New wins: a non-blank new slug means "create a new parent". Else a non-blank
// selected slug means "use existing". Else none. (Both fields are always rendered
// because there is no client JS to toggle them.)
export function resolveParentChoice(newSlug: string, selectedSlug: string): ParentResolution {
  const created = newSlug.trim();
  if (created) return { mode: "create", slug: created };
  const selected = selectedSlug.trim();
  if (selected) return { mode: "existing", slug: selected };
  return { mode: "none" };
}

// The fields written to a new Version. Structurally the createSprout input.
export interface SproutInput {
  slug: string;
  name: Text;
  type: string;
  date: string;
  description: Text;
  state: SproutState;
  parents: string[];
  media: Media[];
  source: Source;
}

// Pure. The new-bean half of the triage form: name and description compose from
// their paired en/fr boxes exactly like the sprout's do (WYSIWYG — what the
// boxes submit is what is stored). A blank name falls back to the slug, which is
// what the action did inline before this existed; a blank description composes
// to "" and createBean omits the field rather than storing an empty string.
export function buildNewBean(
  form: FormData,
  slug: string,
): { slug: string; name: Text; description: Text } {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = composeText(get("newBeanName"), get("newBeanNameFr"));
  return {
    slug,
    name: resolveText(name).trim() ? name : slug,
    description: composeText(get("newBeanDescription"), get("newBeanDescriptionFr")),
  };
}

// Pure. Maps the triage form + the source seed into a SproutInput. name and
// description compose from paired en/fr fields (B1), WYSIWYG: the triage page
// prefills the boxes per-language (name from seed.title, descriptions from
// seed.body via textPart), and what the boxes submit is exactly what is
// stored — clearing a box clears that language, and a fully cleared name fails
// validation instead of being silently resurrected. Carries the seed's media
// and provenance. `beanParentSlug` (resolved by the action) wires the bean
// parent ref.
export function buildSproutInput(
  form: FormData,
  seed: Seed,
  beanParentSlug: string | null,
): SproutInput {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: SproutState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";

  return {
    slug: get("sproutSlug"),
    name: composeText(get("sproutName"), get("sproutNameFr")),
    type: get("type"),
    date: get("date"),
    description: composeText(get("description"), get("descriptionFr")),
    state,
    parents: beanParentSlug ? [`bean:${beanParentSlug}`] : [],
    media: seed.media,
    source: seed.source,
  };
}

// Pure guard for the required Version fields (spec §7). "name required" means at
// least one language is present (resolveText non-empty) — an fr-only name is valid.
// Media/source are carried, not user-entered, so they are not validated here.
export function validateSproutInput(
  v: SproutInput,
): { ok: true } | { ok: false; error: string } {
  if (!v.slug) return { ok: false, error: "version slug is required" };
  if (!resolveText(v.name)) return { ok: false, error: "sprout name is required" };
  if (!v.type) return { ok: false, error: "sprout type is required" };
  if (!v.date) return { ok: false, error: "sprout date is required" };
  return { ok: true };
}
