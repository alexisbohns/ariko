# Preferences Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public chrome's EN/FR text pill with a standard chrome icon-button that opens a menu holding language, theme (system/light/dark) and — when logged in — a link to the admin.

**Architecture:** A new server-safe vocabulary module `lib/theme.ts` owns the three-member theme union, the `localStorage` key, and an inline blocking `<head>` script that applies `.dark` before first paint. A new client island, `app/(public)/_components/preferences-menu.tsx`, renders a Base UI menu from the registry; language rows stay real `?lang=` anchors so the existing middleware/cookie path is untouched, theme rows write `localStorage` and toggle the class with no navigation, and the admin row renders only when the chrome layout's server-side session read says so.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, shadcn on Base UI (`@base-ui/react`), `node --test` with `renderToStaticMarkup` (no jsdom).

**Spec:** `docs/superpowers/specs/2026-09-17-preferences-menu-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/theme.ts` (create) | The theme vocabulary, the storage key, and `THEME_SCRIPT`. Server-safe: no `"use client"`, no `lucide-react`, no `next/link`. |
| `lib/theme-script.test.ts` (create) | Pins that `THEME_SCRIPT` — a *string*, invisible to `tsc` — still agrees with the vocabulary beside it. |
| `app/layout.tsx` (modify) | Renders `THEME_SCRIPT` in `<head>` beside `REGISTER_SW`. |
| `lib/server-safe-source.test.ts` (modify) | Adds `lib/theme.ts` to `SERVER_SAFE`. |
| `components/ui/menu.tsx` (create, via registry) | The Base UI menu primitive. A client component; **not** server-safe. |
| `app/(public)/_components/preferences-menu.tsx` (create) | The island: trigger + language group + theme group + admin row. |
| `lib/preferences-a11y.test.ts` (create) | Pins the closed trigger's accessible name. |
| `app/(public)/_components/public-chrome.tsx` (modify) | Swaps the `content` cluster for an icon cluster holding the island; takes `authed`. |
| `app/(public)/(chrome)/layout.tsx` (modify) | Reads the session server-side and passes `authed` down. |
| `components/lang-switch.tsx` (delete) | Its whole job moves into the menu. One importer, no test. |
| `CLAUDE.md` (modify) | "exactly one island" becomes two, with the cost stated. |

---

### Task 1: The theme vocabulary and its blocking script

**Files:**
- Create: `lib/theme.ts`
- Test: `lib/theme-script.test.ts`

Read `lib/locale.ts` first — this file is its sibling and should read like it.

- [ ] **Step 1: Write the failing test**

Create `lib/theme-script.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, THEME_SCRIPT, THEME_STORAGE_KEY, DEFAULT_THEME } from "@/lib/theme";

/**
 * THEME_SCRIPT is a STRING. That is not an implementation detail — it is the
 * whole reason this file exists.
 *
 * It has to be a string because it runs in <head> before first paint, before
 * any bundle, in both zones; a component would be a boundary and would run too
 * late, which is a flash of the wrong theme on every cold load. But a string is
 * invisible to the compiler: rename THEME_STORAGE_KEY, drop a member of THEMES,
 * or change the class from `dark`, and `tsc`, `npm test` and `npm run build`
 * all pass while the theme silently stops persisting or stops applying. The
 * first person to notice is a visitor whose choice did not stick.
 *
 * So the agreement between the script and the vocabulary beside it is asserted
 * rather than assumed. This is the same class of check as
 * `lib/pwa-source.test.ts`'s count of the cache-write family, and for the same
 * reason.
 */

test("the script reads the key the module exports", () => {
  assert.ok(
    THEME_SCRIPT.includes(THEME_STORAGE_KEY),
    `THEME_SCRIPT must read ${THEME_STORAGE_KEY} — a renamed key strands every stored choice`,
  );
});

test("the script applies the class globals.css actually defines", () => {
  // app/globals.css:6 — `@custom-variant dark (&:is(.dark *))`. Any other
  // class name toggles nothing at all.
  assert.ok(/["']dark["']/.test(THEME_SCRIPT), THEME_SCRIPT);
});

test("every member of the vocabulary appears in the script", () => {
  // A fourth theme added to THEMES that the script cannot resolve would draw
  // as a menu row that silently does nothing.
  for (const theme of THEMES) {
    assert.ok(THEME_SCRIPT.includes(theme), `${theme} is unreachable from THEME_SCRIPT`);
  }
});

test("the script cannot throw — localStorage throws in Safari private mode", () => {
  // An uncaught throw in a blocking <head> script stops the parser. This is not
  // defensive habit; it is the documented behaviour of the API being called.
  assert.ok(/\btry\b/.test(THEME_SCRIPT) && /\bcatch\b/.test(THEME_SCRIPT), THEME_SCRIPT);
});

test("the default is a member of the union", () => {
  assert.ok(THEMES.includes(DEFAULT_THEME));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="script|vocabulary|default is a member"`

Expected: FAIL — `Cannot find module '@/lib/theme'`.

- [ ] **Step 3: Write the implementation**

Create `lib/theme.ts`:

```ts
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
 *  Pure, so the island and this module's script agree by construction. */
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
```

Two details in that last string are deliberate rather than stylistic.

`t!=="light"` rather than `t==="system"`: the three members are equivalent under
both spellings, but this one names all three (the test asserts every member of
`THEMES` is reachable from the script) and is the safer reading of a corrupted
stored value — an unrecognised string follows the OS, which is what
`DEFAULT_THEME` says it should do. It agrees with `parseTheme` by construction.

`var` and `catch(e){}` rather than `const` and bare `catch`: this string is not
transpiled by anything. It is shipped to the browser exactly as written, so it
is written in the syntax with the widest reach.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --test-name-pattern="script|vocabulary|default is a member"`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts lib/theme-script.test.ts
git commit -m "Name the theme, and apply it before first paint

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the script into the root layout, and guard the module

**Files:**
- Modify: `app/layout.tsx`
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Add `lib/theme.ts` to the server-safe list (the failing guard first)**

In `lib/server-safe-source.test.ts`, inside the `SERVER_SAFE` array, after the
`"components/brand/ariko-logo.tsx"` entry, add:

```ts
  // The theme vocabulary and its blocking <head> script. `app/layout.tsx`
  // imports it, and the root layout is the ONE layout both zones enter — so a
  // "use client" here would put a client boundary above every public page,
  // which is the widest blast radius on this list.
  "lib/theme.ts",
```

- [ ] **Step 2: Run the guard to confirm it passes against the file just written**

Run: `npm test -- --test-name-pattern="lib/theme.ts"`

Expected: PASS, 3 tests (`is not a client component`, `imports no lucide icon`,
`imports no next/link`). If any fail, `lib/theme.ts` from Task 1 is wrong — fix
it there, not here.

- [ ] **Step 3: Render the script in `<head>`**

In `app/layout.tsx`, add to the imports beside the existing `@/lib/site` import:

```ts
import { THEME_SCRIPT } from "@/lib/theme";
```

Then, in the `<head>` block, add the theme script **before** the service-worker
one — order matters, because the theme must be applied as early as possible and
the worker registration is deferred to `load` anyway:

```tsx
      <head>
        {/* Applies the stored theme before first paint. MUST come first and
            MUST be blocking: anything later is a flash of the wrong theme on
            every cold load, in both zones. See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
      </head>
```

- [ ] **Step 4: Extend the layout's docblock**

The docblock above `REGISTER_SW` claims the public zone has "exactly one island
(`components/toc-rail.tsx`)". Leave that sentence for Task 6 — it is the
rulebook's claim and is changed there, in one place, with the reasoning. Here,
add a sentence to the `RootLayout` docblock after the paragraph about the
service worker:

```
 * The theme script beside it is the second bare <script> in this head, and it
 * is here for the same reason: it must reach BOTH zones, and it must run
 * before first paint. Neither is a component, so neither is a boundary and
 * neither shows up in the zone's island count.
```

- [ ] **Step 5: Verify the build and the suite**

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: lint clean, no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx lib/server-safe-source.test.ts
git commit -m "Apply the theme in the document head, in both zones

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Add the registry's menu primitive

**Files:**
- Create: `components/ui/menu.tsx` (generated)

Do **not** hand-roll this. CLAUDE.md's rule is explicit, and `components.json`
already carries `menuColor: "inverted-translucent"` and `menuAccent: "subtle"`,
so the primitive lands themed.

- [ ] **Step 1: Add it**

Run: `npx shadcn@latest add menu`

Expected: writes `components/ui/menu.tsx`. If the registry rejects the name,
run `npx shadcn@latest view menu` to confirm the slug before trying anything
else; do not substitute `dropdown-menu` without checking that it is the Base UI
one for the `base-nova` style.

- [ ] **Step 2: Read what it actually exported**

Run: `grep -n "^export" components/ui/menu.tsx`

Write the list down. **Task 4's code is written against the conventional
shadcn/Base UI names** (`Menu`, `MenuTrigger`, `MenuPopup`, `MenuRadioGroup`,
`MenuRadioItem`, `MenuItem`, `MenuSeparator`, `MenuGroupLabel`). If the
generated file names them differently, adjust Task 4's imports and JSX to match
the file — the file is the source of truth, not this plan.

- [ ] **Step 3: Confirm it is a client component and stays off the server-safe list**

Run: `head -1 components/ui/menu.tsx`

Expected: `"use client"`. That is correct and wanted here. Do **not** add it to
`SERVER_SAFE`, and do **not** strip the directive — unlike `separator.tsx`,
this wrapper has real interactive state.

- [ ] **Step 4: Commit**

```bash
git add components/ui/menu.tsx
git commit -m "Add the registry's menu primitive

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The preferences island

**Files:**
- Create: `app/(public)/_components/preferences-menu.tsx`
- Test: `lib/preferences-a11y.test.ts`

**Read first:** `lib/plant-switcher-a11y.test.ts`. It establishes the pattern
this test follows and, importantly, the pattern's *limit*: Base UI mounts a
popup's contents on open, so only the CLOSED trigger is in
`renderToStaticMarkup`'s output. Threading an `open` prop through the component
purely so a test could see the rows would be the test changing the component,
and that file rejects it by name. The rows' language destinations are
`lib/locale.ts`'s and the theme rows' labels are `lib/theme.ts`'s; both are
covered by their own modules' tests.

- [ ] **Step 1: Write the failing test**

Create `lib/preferences-a11y.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lang } from "@/lib/locale";

/**
 * The preferences trigger is an ICON. So the only place a reader — a screen
 * reader, or anyone hovering, since the visible label is CSS
 * (components/chrome.tsx) — learns what it currently holds is its accessible
 * name. CLAUDE.md's rule: an icon trigger names its stored value.
 *
 * It names the LANGUAGE, and only the language. That is the documented
 * exception, and this file is where it is recorded rather than looking like
 * drift: the theme lives in localStorage, so the SERVER CANNOT KNOW IT, and a
 * name that guessed would be wrong on every first paint. The theme states
 * itself on its own radio rows inside the menu, where a radio group's checked
 * state is the accessible statement.
 *
 * Replace `Preferences — English` with a bare `Preferences` and the page looks
 * identical and stops saying what it is set to. Nothing else in the suite
 * would notice.
 *
 * CLOSED state only — see lib/plant-switcher-a11y.test.ts for why, and why
 * that is not a gap worth closing with an `open` prop.
 */

async function render(lang: Lang, authed: boolean): Promise<string> {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { PreferencesMenu } = await import("@/app/(public)/_components/preferences-menu");
  return renderToStaticMarkup(React.createElement(PreferencesMenu, { lang, authed }) as never);
}

test("the trigger names the language being read, not merely the field", async () => {
  const html = await render("en", false);
  assert.ok(html.includes("English"), html);
  assert.ok(!/aria-label="Preferences"/.test(html), html);
});

test("reading in French, it says French", async () => {
  const html = await render("fr", false);
  assert.ok(html.includes("Français"), html);
  assert.ok(!html.includes("English"), html);
});

test("the closed menu posts nothing — every choice is a link or a local write", async () => {
  const html = await render("en", true);
  assert.ok(!html.includes("<form"), html);
});

test("the trigger renders in the server HTML, so the corner is never empty", async () => {
  // "use client" means hydrated, not client-only: the island IS server-rendered,
  // which is what keeps the chrome's fourth cluster from popping in late. If
  // this ever returns "", something has made the trigger mount-gated the way
  // components/toc-rail.tsx deliberately is — and unlike the rail, this cluster
  // is chrome and its absence reads as broken.
  const html = await render("en", false);
  assert.ok(html.length > 0, "the preferences trigger must be in the server HTML");
  assert.ok(html.includes("<button"), html);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="trigger names the language|says French|closed menu posts nothing|never empty"`

Expected: FAIL — `Cannot find module '@/app/(public)/_components/preferences-menu'`.

- [ ] **Step 3: Write the island**

Create `app/(public)/_components/preferences-menu.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { ChromeItem, chromeItemClass } from "@/components/chrome";
import {
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { LANG_LABEL, LANG_PARAM, LANGS, type Lang } from "@/lib/locale";
import {
  DARK_CLASS,
  DEFAULT_THEME,
  MEDIA_DARK,
  THEMES,
  THEME_LABEL,
  THEME_STORAGE_KEY,
  parseTheme,
  resolvesDark,
  type Theme,
} from "@/lib/theme";

/**
 * The public zone's preferences menu — and the zone's SECOND client island.
 *
 * It replaces `components/lang-switch.tsx`, which was a text pill: the one
 * cluster in the app that was not a plated box of ghost icon-buttons, and the
 * one with room for exactly one idea. Three things belong in that corner —
 * the language, the theme, and the author's way back into the admin — and a
 * menu is how a chrome control holds three.
 *
 * **Being an island is the deliberate part.** CLAUDE.md's rule is that the
 * public zone is progressively enhanced, not script-free, and that the
 * registry's primitives are taken rather than hand-rolled. A menu is a client
 * component by construction in Base UI; hand-rolling a CSS disclosure to dodge
 * one island would break the older rule to satisfy a softer one. The cost is
 * real and is stated in CLAUDE.md rather than hidden: a visitor with scripting
 * off loses the language switch. Everything else the zone promises — every
 * page reads, every link navigates, every media item is reachable — is
 * untouched.
 *
 * **lucide is imported directly here, and that is the rule working rather than
 * being broken.** The public zone's lucide ban exists because one import in a
 * SERVER-SAFE file drags a client boundary under every public page. This file
 * IS the boundary, declared, holding one cluster.
 * `components/public-icons.tsx` gains no tenth glyph.
 *
 * `"use client"` means hydrated, not client-only — the trigger IS in the server
 * HTML, so the corner is never empty on a cold load. That is the opposite of
 * `components/toc-rail.tsx`, which gates itself on mount on purpose; chrome
 * that arrives late reads as broken, where a missing reading-position rail does
 * not.
 */
export function PreferencesMenu({ lang, authed }: { lang: Lang; authed: boolean }) {
  return (
    <Menu>
      <ChromeItem label="Preferences">
        <MenuTrigger
          aria-label={`Preferences — ${LANG_LABEL[lang]}`}
          className={chromeItemClass()}
        >
          <Settings className="size-4" aria-hidden="true" />
        </MenuTrigger>
      </ChromeItem>
      <MenuPopup className="min-w-48">
        <MenuGroupLabel>Language</MenuGroupLabel>
        {/*
          Real anchors to `?lang=…`, so the mechanism is UNCHANGED: still a
          link, still `middleware.ts`, still a cookie, still a redirect to the
          clean URL. The href stays a bare query string, resolved by the browser
          against the current URL, exactly as lang-switch.tsx argued — this
          component never has to know the path it sits on, and never
          interpolates one.

          A MenuRadioGroup rather than plain items because the current language
          is a STATE, not just a destination, and a radio group is how that
          state reaches the accessibility tree.
        */}
        <MenuRadioGroup value={lang}>
          {LANGS.map((value) => (
            <MenuRadioItem
              key={value}
              value={value}
              render={
                <a href={`?${LANG_PARAM}=${value}`} hrefLang={value} lang={value} />
              }
            >
              {LANG_LABEL[value]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>

        <MenuSeparator />

        <MenuGroupLabel>Theme</MenuGroupLabel>
        <ThemeRadioGroup />

        {authed ? (
          <>
            <MenuSeparator />
            {/*
              next/link, not <a>: this file is already a client component, and
              /admin is the zone that navigates client-side. It renders only
              when the server said there is a session — the cookie is httpOnly,
              so a client guess would be wrong.
            */}
            <MenuItem render={<Link href="/admin" />}>Admin</MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}

/**
 * The theme rows.
 *
 * Split out because the language half is a pure function of a server prop and
 * this half is not: the theme lives in localStorage, which the server cannot
 * read, so the checked row is only knowable after mount. Keeping the hook in
 * its own component means the rest of the menu stays a plain render.
 *
 * There is no hydration mismatch to manage — Base UI portals the popup only
 * while it is open, so none of this reaches the server HTML.
 *
 * No `matchMedia` change listener: a visitor sitting on `system` while their OS
 * flips does not get a live update, and the next navigation fixes it. An extra
 * subscription is not worth that case.
 */
function ThemeRadioGroup() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    try {
      setTheme(parseTheme(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      // Safari private mode throws on access. The default already stands.
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The class still flips below — the choice simply will not outlive the tab.
    }
    const prefersDark = window.matchMedia(MEDIA_DARK).matches;
    document.documentElement.classList.toggle(DARK_CLASS, resolvesDark(next, prefersDark));
  }

  return (
    <MenuRadioGroup value={theme} onValueChange={(value) => choose(parseTheme(value))}>
      {THEMES.map((value) => (
        <MenuRadioItem key={value} value={value}>
          {THEME_LABEL[value]}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}
```

- [ ] **Step 4: Reconcile with the generated primitive**

The imports above use the conventional names. Compare against the list you took
in Task 3 Step 2 and rename to match `components/ui/menu.tsx`. Two API details
to check against the generated file rather than assume:

1. Whether the popup needs an explicit positioner wrapper (Base UI's
   `Menu.Positioner` / `Menu.Portal`) or whether the shadcn wrapper already
   composes them inside `MenuPopup`. If it does not, wrap `MenuPopup` as the
   generated file's own usage example shows.
2. Whether `MenuRadioItem` forwards a `render` prop. If it does not, use
   `MenuItem render={<a … />}` for the two language rows and set
   `aria-checked` plus `role="menuitemradio"` yourself — the checked state is
   the part that must not be lost.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- --test-name-pattern="trigger names the language|says French|closed menu posts nothing|never empty"`

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/_components/preferences-menu.tsx" lib/preferences-a11y.test.ts
git commit -m "Give the public chrome a preferences menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire it into the chrome, and retire the pill

**Files:**
- Modify: `app/(public)/_components/public-chrome.tsx`
- Modify: `app/(public)/(chrome)/layout.tsx`
- Delete: `components/lang-switch.tsx`

- [ ] **Step 1: Read the session in the chrome layout**

In `app/(public)/(chrome)/layout.tsx`, add to the imports:

```ts
import { isAuthenticated } from "@/app/admin/session";
```

and replace the body of `ChromeLayout` down to the `<PublicChrome …>` line with:

```tsx
export default async function ChromeLayout({ children }: { children: ReactNode }) {
  // The layout renders the switch; each PAGE resolves the language again for its
  // own prose. Both read the same cookie, so they cannot disagree.
  const lang = resolveLang(undefined, (await cookies()).get(LANG_COOKIE)?.value);
  // The session read is here and not in the island because the session cookie is
  // httpOnly: client JavaScript cannot see it, so a client guess would be wrong.
  // It costs nothing new — this layout already calls cookies() and is already
  // dynamic — and it decides ONE thing: whether the menu shows a link to /admin.
  // Nothing about the page's content varies on it.
  const authed = await isAuthenticated();
  return (
    <>
      <PublicChrome lang={lang} authed={authed} />
```

Leave the rest of the function as it is.

- [ ] **Step 2: Swap the cluster in the public chrome**

In `app/(public)/_components/public-chrome.tsx`, replace the
`import { LangSwitch } …` line with:

```ts
import { PreferencesMenu } from "@/app/(public)/_components/preferences-menu";
```

Change the signature and the second cluster:

```tsx
export function PublicChrome({ lang, authed }: { lang: Lang; authed: boolean }) {
```

```tsx
      {/* The preferences cluster: language, theme, and — for the author — the
          way back into the admin. It is an ORDINARY icon cluster now, not the
          `content` text variant the EN/FR pill needed, so the two clusters in
          this zone finally have the same geometry as every cluster in the
          admin. The island inside is server-rendered, so this corner is never
          empty on a cold load. */}
      <Chrome magnet="top-right">
        <PreferencesMenu lang={lang} authed={authed} />
      </Chrome>
```

- [ ] **Step 3: Update this file's docblock**

The docblock says "A SERVER component, and every part of it stays one". That is
no longer true and must not be left standing — it is exactly the kind of prose
that quietly becomes false. Replace that paragraph with:

```
 * A SERVER component, and its NAVIGATION half stays entirely one — the mark and
 * the two nav glyphs are inline SVG (components/public-icons.tsx), their hover
 * labels are CSS (components/chrome.tsx), and a visitor with script off can
 * still go everywhere.
 *
 * The preferences cluster is the exception, and it is declared rather than
 * incidental: `preferences-menu.tsx` is a client island, because a menu is a
 * client component in the registry and hand-rolling one to avoid that would
 * break the rule that matters more. What it costs — the language switch,
 * script-off — is written down in CLAUDE.md.
```

Also delete the paragraph beginning "The language switch keeps its own anchors"
and the sentence naming `LangSwitch` in the paragraph above it, if present.

- [ ] **Step 4: Delete the pill**

```bash
git rm components/lang-switch.tsx
```

It had exactly one importer and no test. Verify nothing else reaches it:

Run: `grep -rn "lang-switch\|LangSwitch" --include="*.ts" --include="*.tsx" . | grep -v node_modules`

Expected: no matches outside `docs/`.

- [ ] **Step 5: Verify**

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: lint clean, no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A "app/(public)" components/lang-switch.tsx
git commit -m "Retire the language pill for the preferences cluster

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The rulebook, and end-to-end verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Correct the island count**

In CLAUDE.md's "Script, by zone" section, replace:

```
Today the public zone has exactly one island, `components/toc-rail.tsx`
(1.2 kB), and `lib/toc-mount.test.ts` pins that it renders nothing until it
mounts.
```

with:

```
Today the public zone has TWO islands. `components/toc-rail.tsx` (1.2 kB) is
the mild one — `lib/toc-mount.test.ts` pins that it renders nothing until it
mounts, so script-off the page is byte-for-byte what it was.

`app/(public)/_components/preferences-menu.tsx` is the other, and it is the
one that COSTS something: it replaced the language pill, so **a visitor with
scripting off no longer has a language switch**. That is a real narrowing of
this zone's promise and is written here rather than discovered. It was taken
deliberately — a menu is a client component by construction in Base UI, and
hand-rolling a CSS disclosure to keep the island count at one would break the
older and more load-bearing rule (never hand-roll a primitive the registry
has) to satisfy a rule that was never absolute. Everything else the zone
promises is untouched: every page reads, every link navigates, every media
item is reachable. Unlike the rail it is NOT mount-gated — chrome that arrives
late reads as broken — so its trigger is in the server HTML.

That island imports `lucide-react` directly, and that is the lucide rule
working rather than being broken: the ban is on lucide in a SERVER-SAFE file,
where one import is one boundary under every public page. A declared client
boundary holding one cluster is where an icon is allowed to come from.

The theme those two zones share is `lib/theme.ts` — a named vocabulary like
`lib/plant-status.ts`, plus `THEME_SCRIPT`, a bare blocking `<script>` in the
root layout's head. It is a STRING and not a component on purpose (it must run
before first paint, in both zones), which means the compiler cannot see inside
it: rename the storage key or change the `dark` class and `tsc`, `npm test`
and `npm run build` all pass while the theme silently stops working.
`lib/theme-script.test.ts` is the only thing that reports it.
```

- [ ] **Step 2: Add the a11y exception to the icon-trigger rule**

In the bullet beginning "**An icon trigger names its stored value.**", append:

```
The public zone's preferences trigger is the one DOCUMENTED EXCEPTION: it names
its language and not its theme, because the theme lives in `localStorage` and
the server cannot read it — a name that guessed would be wrong on every first
paint. The theme states itself on its own radio rows, where a radio group's
checked state is the accessible statement. `lib/preferences-a11y.test.ts` pins
the half that is knowable.
```

- [ ] **Step 3: Full verification**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`

Expected: all four clean. `npm run build` matters here specifically — it is the
only step that exercises the root layout's new import in a real bundle.

- [ ] **Step 4: Verify the behaviour in a browser**

Run: `npm run dev` and open `http://localhost:3333/beanstalk`.

Check, in order:
1. The top-right cluster is a gear icon in the same plate as the top-left nav,
   and hovering it shows the CSS label "Preferences".
2. Opening it shows Language (English / Français, current one checked), Theme
   (System / Light / Dark), and NO Admin row when logged out.
3. Picking Français navigates once and lands on `/beanstalk` with no `?lang=`
   in the URL, in French.
4. Picking Dark flips the page instantly with **no navigation**.
5. Reload. The page is dark on first paint, with **no flash of light**. This is
   the whole reason the script is blocking and in `<head>`; if you see a flash,
   the script is in the wrong place.
6. Log in at `/admin/login`, return to `/beanstalk`, reopen the menu: the Admin
   row is now there and navigates to `/admin`.
7. `/admin` honours the dark choice too.

- [ ] **Step 5: Commit and open the PR**

```bash
git add CLAUDE.md
git commit -m "Record the public zone's second island, and what it cost

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin preferences-menu
```

Then open the PR. This ships something a visitor would notice, so the body
**MUST** carry a Lab Note:

```yaml
en:
  title: Pick your language, and your light
  summary: The little EN/FR button in the corner grew up. It is now a proper menu where you can switch language, and choose whether Ariko shows up light, dark, or however your device likes it.
fr:
  title: Choisis ta langue, et ta lumière
  summary: Le petit bouton EN/FR dans le coin a grandi. C'est maintenant un vrai menu où tu peux changer de langue, et décider si Ariko s'affiche en clair, en sombre, ou comme ton appareil préfère.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

End the PR description with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Notes for the implementer

- **Do not** add `components/ui/menu.tsx` or `preferences-menu.tsx` to
  `SERVER_SAFE`. They are client components on purpose. The list is for files
  the public zone renders that must *not* become client components.
- **Do not** reach for `next-themes`. The blocking script is nine lines and the
  dependency would put a client provider above both zones' roots.
- If `npm run build` reports the root layout became dynamic, that is not caused
  by this change — `app/(public)/(chrome)/layout.tsx` already called `cookies()`
  before it.
