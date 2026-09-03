// The public zone's reading language (#53).
//
// One source of truth, deliberately narrow: `Lang` is the same two-value union
// `resolveText` already takes, so a locale read here can be handed to any
// render surface without translation.
//
// The switch is a plain link to `?lang=…`; the middleware turns that into a
// cookie and redirects to the clean URL. Nothing about it needs client JS,
// which is what keeps the public zone's no-script promise intact.
//
// A missing or unrecognized value is English, never an error. This value comes
// from a query string and a cookie — both user-controlled — so it is validated
// on the way in and is never interpolated anywhere; the union is the guard.

export type Lang = "en" | "fr";

export const LANG_COOKIE = "ariko_lang";
export const LANG_PARAM = "lang";
export const DEFAULT_LANG: Lang = "en";

// A year: the choice is a reading preference, not a session fact.
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LANGS: readonly Lang[] = ["en", "fr"];

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "fr";
}

// Case- and whitespace-tolerant, and tolerant of a region subtag ("fr-CA"),
// because this reads a value people can type into a URL bar.
export function parseLang(value: unknown): Lang | null {
  if (typeof value !== "string") return null;
  const base = value.trim().toLowerCase().split("-")[0];
  return isLang(base) ? base : null;
}

// The resolution order the whole public zone uses: an explicit `?lang=` wins
// (it is the click that just happened), then the stored preference, then
// English.
export function resolveLang(param: unknown, cookie: unknown): Lang {
  return parseLang(param) ?? parseLang(cookie) ?? DEFAULT_LANG;
}

export function otherLang(lang: Lang): Lang {
  return lang === "en" ? "fr" : "en";
}

export const LANG_LABEL: Record<Lang, string> = { en: "English", fr: "Français" };
export const LANG_SHORT: Record<Lang, string> = { en: "EN", fr: "FR" };
