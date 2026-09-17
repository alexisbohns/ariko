"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { ChromeItem, chromeItemClass } from "@/components/chrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * not. `lib/preferences-a11y.test.ts` pins it.
 */
export function PreferencesMenu({ lang, authed }: { lang: Lang; authed: boolean }) {
  return (
    <DropdownMenu>
      <ChromeItem label="Preferences">
        <DropdownMenuTrigger
          aria-label={`Preferences — ${LANG_LABEL[lang]}`}
          className={chromeItemClass()}
        >
          <Settings className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
      </ChromeItem>
      {/* `align="end"` because this cluster is magnetised to the top-right:
          the default `start` would open the popup off the side of the
          viewport. The explicit min-width is needed because the registry's
          content is `w-(--anchor-width)` — sized to its trigger, which here is
          a 36px icon button. */}
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        {/*
          Real anchors to `?lang=…`, so the mechanism is UNCHANGED: still a
          link, still `middleware.ts`, still a cookie, still a redirect to the
          clean URL. The href stays a bare query string, resolved by the browser
          against the current URL, exactly as lang-switch.tsx argued — this
          component never has to know the path it sits on, and never
          interpolates one.

          A radio group rather than plain items because the current language is
          a STATE, not just a destination, and a radio group is how that state
          reaches the accessibility tree.
        */}
        <DropdownMenuRadioGroup value={lang}>
          {LANGS.map((value) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              render={<a href={`?${LANG_PARAM}=${value}`} hrefLang={value} lang={value} />}
            >
              {LANG_LABEL[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <ThemeRadioGroup />

        {authed ? (
          <>
            <DropdownMenuSeparator />
            {/*
              next/link, not <a>: this file is already a client component, and
              /admin is the zone that navigates client-side. It renders only
              when the server said there is a session — the cookie is httpOnly,
              so a client guess would be wrong.
            */}
            <DropdownMenuItem render={<Link href="/admin" />}>Admin</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(value) => choose(parseTheme(value))}
    >
      {THEMES.map((value) => (
        <DropdownMenuRadioItem key={value} value={value}>
          {THEME_LABEL[value]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
