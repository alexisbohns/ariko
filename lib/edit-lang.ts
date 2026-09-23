import { textPart, type Text } from "./data";
import { isLang, parseLang, type Lang } from "./locale";

/**
 * Which half of an article the admin is editing — `?lang=fr` on the editing
 * page, and nothing else.
 *
 * In the URL, per page, and never a cookie: the admin's subject lives in the
 * URL (lib/admin-scope.ts), and a cookie would make one URL mean two different
 * editors — an author typing French into what they believe is the English body
 * is the confusion this exists to prevent.
 *
 * SERVER-SIDE: it reads `Text` through `textPart`, and lib/data.ts opens with
 * `node:fs`. The editor island never imports this file.
 */

const LANG_PARAM = "lang";

/** The URL's answer. Anything that is not a language is English, never an error — it came from a URL bar. */
export function editLang(param: unknown): Lang {
  return parseLang(param) ?? "en";
}

/**
 * What an editor opens on. STRICT `textPart`, so an empty French half opens as
 * an empty editor and never as the English body wearing a French label. When
 * the French half is blank and the English is not, the English comes along as
 * `seed` — the "Start from English" action's material, which writes nothing
 * until the author saves.
 */
export function editorHalves(content: Text | undefined, lang: Lang): { initialMarkdown: string; seed?: string } {
  const initialMarkdown = textPart(content, lang);
  if (lang === "en" || initialMarkdown.trim() !== "") return { initialMarkdown };
  const en = textPart(content, "en");
  return en.trim() !== "" ? { initialMarkdown, seed: en } : { initialMarkdown };
}

// A switch is a fresh view. `error` and `form` describe a rejected save, which
// belongs to the half that received it.
const DROPPED = new Set([LANG_PARAM, "error", "form"]);

/** The switch's two links. Every other parameter (the `?plant=` scope among them) is kept. */
export function editLangHrefs(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): Record<Lang, string> {
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (DROPPED.has(key) || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) kept.append(key, v);
  }
  const build = (lang: Lang): string => {
    const params = new URLSearchParams(kept);
    if (lang === "fr") params.set(LANG_PARAM, "fr");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  return { en: build("en"), fr: build("fr") };
}

export type EditLangField = { ok: true; lang: Lang } | { ok: false; error: string };

/**
 * The posted half, as the content actions read it. ABSENT is English: every
 * editor before this slice posted no `lang`, and a tab left open across the
 * deploy must keep saving where it always did. PRESENT is strict — the editor
 * posts exactly "en" or "fr", so anything else was not posted by it.
 */
export function parseEditLangField(value: FormDataEntryValue | null): EditLangField {
  if (value === null) return { ok: true, lang: "en" };
  return isLang(value) ? { ok: true, lang: value } : { ok: false, error: "unknown language" };
}

/** A redirect target that lands back on the half that was saved. */
export function withEditLang(href: string, lang: Lang): string {
  if (lang === "en") return href;
  return `${href}${href.includes("?") ? "&" : "?"}${LANG_PARAM}=fr`;
}
