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
  // which is what keeps the chrome's second cluster from popping in late. If
  // this ever returns "", something has made the trigger mount-gated the way
  // components/toc-rail.tsx deliberately is — and unlike the rail, this cluster
  // is chrome and its absence reads as broken.
  const html = await render("en", false);
  assert.ok(html.length > 0, "the preferences trigger must be in the server HTML");
  assert.ok(html.includes("<button"), html);
});
