import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";

/**
 * The sprout head's four editors are icon triggers — a title, a pencil, a
 * calendar, a tag. An icon is not a label, so the only place a reader (a screen
 * reader, or anyone hovering) learns what `state`, `date` and `type` currently
 * ARE is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the
 * accessible name is set on the control, not on a visible span (the hover label
 * is CSS — components/chrome.tsx), so nothing on screen changes if someone
 * replaces `State: Draft` with a bare `State`. The page would look identical
 * and would stop saying what it is.
 *
 * lib/plant-hero-a11y.test.ts is the same file for the plant; this is the
 * second entity to need it, which is the point of the head being shared.
 *
 * No jsdom: renderToStaticMarkup is enough to read an accessible name out of
 * the markup, and the head's values are server-rendered.
 *
 * The last test is the exception, and it is a source check for a reason worth
 * stating: the meta form arrives as a prop and is rendered inside
 * `OverlaySheet`, whose Base UI dialog is PORTALLED, and a portal has no
 * container to render into on the server — so a marker handed in through
 * `metaForm` reaches `renderToStaticMarkup`'s output in NO state, open or
 * closed. `lib/exhibition-panel-source.test.ts` made the same discovery for
 * `plant-rail.tsx` (its docblock records the render-based test that was deleted
 * over it) and reaches the property the same way: "this file imports X" is a
 * fact about the file as written, which is exactly what a render cannot see.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function hero(overrides: Record<string, unknown> = {}): Promise<string> {
  const { SproutHero } = await import("@/app/admin/_components/sprout-hero");
  return render(
    React.createElement(SproutHero, {
      slug: "a-sprout",
      name: "A sprout",
      description: "one line about it",
      state: "draft",
      date: "2026-09-12",
      type: "article",
      metaForm: React.createElement("div", null, "META FORM"),
      saved: "x",
      ...overrides,
    } as any),
  );
}

test("the state trigger names the stored state", async () => {
  assert.match(await hero({ state: "draft" }), /aria-label="State: Draft"/);
  assert.match(await hero({ state: "private" }), /aria-label="State: Private"/);
  assert.match(await hero({ state: "published" }), /aria-label="State: Published"/);
});

test("the date and type triggers name their stored values", async () => {
  const html = await hero({ date: "2026-09-12", type: "article" });
  assert.match(html, /aria-label="Date: 2026-09-12"/);
  assert.match(html, /aria-label="Type: article"/);
});

test("the name and the description are genuinely server-rendered", async () => {
  // Not a script-off claim — the admin is a JavaScript application. It is a
  // check that SproutHero never grows a "renders nothing until it mounts" guard
  // around content that has nowhere else to live: the name is the page's only
  // h1 and the description is the only place the one-line summary appears.
  const html = await hero();
  assert.ok(html.includes("A sprout"), "the name must be in the markup");
  assert.ok(html.includes("one line about it"), "the description must be in the markup");
  assert.match(html, /<h1/, "the name must be inside the page's h1");
});

const HERO = "app/admin/_components/sprout-hero.tsx";

test("the meta form is rendered from the prop, never composed here", () => {
  // The corollary of the arrangement: the overlay's contents are server-rendered
  // by the page and handed down, so the island knows no field name on the
  // sprout. Breaking it is silent in the shape lib/server-safe-source.test.ts
  // describes — importing SproutMetaForm, or `buildSproutMetaPatch` to compose
  // a payload here, passes tsc, npm test and npm run build, and the overlay
  // keeps working. What is gone is WHERE the payload is built.
  const text = readFileSync(join(process.cwd(), HERO), "utf8");

  for (const spec of [
    "./sprout-meta-form",
    "@/app/admin/_components/sprout-meta-form",
    "@/lib/sprouts",
  ]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${HERO} must not import from "${spec}" — the meta form is a prop, and ` +
        `importing it (or the patch builder behind it) would put the sprout's ` +
        `field names inside the island`,
    );
  }

  // `@/lib/data` reaches this file for the SproutState TYPE and nothing else.
  // A value import from there is both a field-name door and a build failure
  // waiting to happen (lib/data.ts opens with node:fs — CLAUDE.md's
  // lib/palette.ts trap), which is why lib/sprout-state.ts exists at all.
  for (const line of text.split("\n").filter((l) => /from ["']@\/lib\/data["']/.test(l))) {
    assert.match(
      line.trim(),
      /^import type /,
      `${HERO} may import from "@/lib/data" only as a type: ${line.trim()}`,
    );
  }
});

test("every fact popover is handed the message a rejection from it would carry", async () => {
  // The whole point of routing `?form=` back to a surface. The page suppresses
  // its own banner exactly when `?form=` names one, so a popover that reopens
  // without rendering the message shows it NOWHERE — the author learns only
  // that their click did nothing. That is the shape this head shipped with for
  // one commit.
  //
  // Read from SOURCE, not from a render, for `lib/exhibition-panel-source.test.ts`'s
  // reason: Base UI portals both the popover and the sheet, so an OPEN one
  // still contributes zero bytes to renderToStaticMarkup — there is nothing
  // for a rendered assertion to look at. Whether each trigger is WIRED to the
  // message is a property of the file as written, and that is the property
  // that was missing.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("app/admin/_components/sprout-hero.tsx", "utf8");

  // Each trigger's OPENING TAG — from `<FactPopover` up to the line that closes
  // it. Lazy, and anchored on a line that is only whitespace and `>`, because a
  // prop value here contains `>` itself (`onOpenChange={(next) => …}`) and
  // splitting on the first one lands in the middle of an arrow function.
  const openingTags = [...source.matchAll(/<FactPopover\b([\s\S]*?)^\s*>/gm)].map((m) => m[1]);
  assert.equal(openingTags.length, 3, "the head draws three fact triggers");

  for (const [i, props] of openingTags.entries()) {
    assert.match(
      props,
      /\berror=/,
      `fact popover ${i + 1} must be handed an error prop, or a rejection from it reopens onto silence`,
    );
  }

  // And the component must actually draw what it is handed.
  assert.match(
    source,
    /error \? \(\s*<Alert/,
    "FactPopover must render the error it receives",
  );
});
