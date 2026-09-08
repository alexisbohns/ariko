import { composeText, type Text } from "./data";

/**
 * Pure. The Keyword form → the stored field.
 *
 * `null` MEANS clear, and that is the whole reason this is a function rather
 * than a `composeText` call at the call site. The field belongs to a record
 * that already exists, so a blank has to cross the wire as an INSTRUCTION
 * rather than as an absence: omitting the key would silently leave the old
 * keyword in place and the author would see their deletion ignored. It is the
 * stance PlantMetaPatch.description takes, one field over.
 *
 * Nothing here throws. A blank name is a public claim the site would render
 * wrongly, which is why buildPlantMetaPatch throws on one — a blank keyword is
 * a cover with no word on it, which is a valid cover.
 */
export function buildBeanKeywordPatch(form: FormData): Text | null {
  const en = String(form.get("keyword") ?? "");
  const fr = String(form.get("keywordFr") ?? "");
  const composed = composeText(en, fr); // trims both parts
  return composed === "" ? null : composed;
}
