import type { NewScreen } from "./botanical";
import { readImageField } from "./screen-image";
import { screenNameFromStem } from "./screen-name";

export type NewScreenResult = { ok: false; error: string } | { ok: true; input: NewScreen };

// The pattern lib/articles.ts, lib/federation.ts and lib/pollen.ts each already
// carry. Copied rather than shared for the reason those three are: a slug rule
// belongs to the door that admits the slug, and one of these doors changing its
// mind must not silently change the others.
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Pure. The create form → the record `createScreen` inserts.
 *
 * This is the one form in the admin that holds the media picker AND text
 * inputs, and it is a decision rather than an oversight. The picker's two rules
 * — inert rather than destructive, and no edit ever depending on the island —
 * are about forms that change a record that already exists. Script-off this
 * form renders its fields, renders no button (the button is inside the island),
 * and creates nothing. Nothing is lost, because nothing existed.
 *
 * The two text inputs are load-bearing, incidentally: a LONE text input in a
 * button-less form submits on Enter, which is the trap the bean Keyword form
 * documents. With two there is no implicit submission at all — and the marker
 * check below refuses the payload regardless.
 *
 * `capturedAt` is deliberately not here. It is the current date, which is not a
 * pure function of the form, so the action supplies it — this module stays
 * testable without a clock.
 *
 * The name falls back to `screenNameFromStem`, the SAME function the import
 * derives its hundred and seventy names with, so a screen added by hand and a
 * screen added by the script are named by one rule.
 */
export function buildNewScreenInput(form: FormData): NewScreenResult {
  const get = (key: string) => String(form.get(key) ?? "").trim();

  const slug = get("slug");
  if (!slug) return { ok: false, error: "a screen needs a slug" };
  if (!SLUG.test(slug)) {
    return { ok: false, error: `a slug is lowercase letters, digits and hyphens: ${slug}` };
  }

  const { ready, image } = readImageField(form);
  // Two messages, not one. "The picker never mounted" and "you did not pick a
  // file" are different events with different fixes, and an author who has
  // script disabled deserves to be told that rather than left staring at a
  // field they did fill in.
  if (!ready) return { ok: false, error: "add an image — the picker needs script to run" };
  if (image === null) return { ok: false, error: "add an image" };

  const plant = get("plant");
  const name = get("name");

  return {
    ok: true,
    input: {
      slug,
      name: name || screenNameFromStem(slug),
      image,
      plantSlug: plant || null,
    },
  };
}
