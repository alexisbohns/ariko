// The reading THEME, for both zones.
//
// A named vocabulary, declared once, exactly as `lib/locale.ts`,
// `lib/plant-status.ts` and `lib/sprout-state.ts` are — so that nothing
// downstream compares a stored value against a bare literal. CLAUDE.md's
// argument for `lib/sprout-type.ts` applies here even though there is no write
// path: a stored `"Dark"` draws identically to nothing at all.
//
// SERVER-SAFE, and that is load-bearing: `app/layout.tsx` imports it, and the
// root layout is the one layout BOTH zones enter. No `"use client"`, no
// `lucide-react`, no `next/link`. `lib/server-safe-source.test.ts` holds it to
// that.
//
// Unlike the language, the theme is NOT a cookie and never reaches the server.
// It lives in localStorage and is applied by THEME_SCRIPT below, which is why
// a theme choice costs no navigation and why the server can never name it.

export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "ariko_theme";
export const DEFAULT_THEME: Theme = "system";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The class `app/globals.css` actually defines — `@custom-variant dark
 *  (&:is(.dark *))` on line 6, and the `.dark { … }` token block below it.
 *  Exported so THEME_SCRIPT and the island cannot spell it differently. */
export const DARK_CLASS = "dark";

export const MEDIA_DARK = "(prefers-color-scheme: dark)";

/**
 * A `Record`, not a lookup with a fallback: a fourth theme must fail `tsc`
 * here rather than quietly draw as a blank menu row. `PLANT_ROLE_ICONS` in
 * `components/public-icons.tsx` is typed this way for the same reason.
 */
export const THEME_LABEL: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

/** Tolerant on the way in — this reads a value out of localStorage, which a
 *  visitor can edit — and never throws. An unrecognised value is the default,
 *  never an error. `parseLang` in `lib/locale.ts` makes the same promise. */
export function parseTheme(value: unknown): Theme {
  if (typeof value !== "string") return DEFAULT_THEME;
  const base = value.trim().toLowerCase();
  return isTheme(base) ? base : DEFAULT_THEME;
}

/** Whether a chosen theme resolves to dark, given what the OS reports.
 *  Pure, so the island and THEME_SCRIPT agree by construction. */
export function resolvesDark(theme: Theme, prefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && prefersDark);
}

/**
 * The inline blocking script, rendered in `<head>` by `app/layout.tsx`.
 *
 * A STRING and a bare <script>, not a component — the same call
 * `app/layout.tsx` already makes for REGISTER_SW, and for a sharper reason: it
 * must run BEFORE FIRST PAINT. A component would be a client boundary and
 * would run after hydration, which is a flash of the wrong theme on every cold
 * load in both zones.
 *
 * The try/catch is required rather than cautious: `localStorage` THROWS on
 * access in Safari private browsing, and an uncaught throw in a blocking head
 * script stops the parser.
 *
 * Two details in the string are deliberate rather than stylistic.
 *
 * `t!=="light"` rather than `t==="system"`: the three members are equivalent
 * under both spellings, but this one NAMES all three, and it is the safer
 * reading of a corrupted stored value — an unrecognised string follows the OS,
 * which is what DEFAULT_THEME says it should do. It agrees with `parseTheme`
 * by construction.
 *
 * `var` and `catch(e){}` rather than `const` and a bare `catch`: this string is
 * not transpiled by anything. It ships to the browser exactly as written, so it
 * is written in the syntax with the widest reach.
 *
 * No nonce — `next.config.ts`'s CSP is one directive plus `object-src` and
 * carries no `script-src`, which is why REGISTER_SW needs none either.
 *
 * `lib/theme-script.test.ts` is what keeps this string honest, because nothing
 * else can: the compiler cannot see inside it.
 */
export const THEME_SCRIPT =
  `(()=>{try{` +
  `var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"${DEFAULT_THEME}";` +
  `var d=t==="dark"||(t!=="light"&&matchMedia("${MEDIA_DARK}").matches);` +
  `document.documentElement.classList.toggle("${DARK_CLASS}",d);` +
  `}catch(e){}})()`;
