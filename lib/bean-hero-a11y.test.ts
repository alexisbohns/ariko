import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";

/**
 * The bean head's four editors are icon triggers — a title, a globe, a quote, a
 * tag. An icon is not a label, so the only place a reader (a screen reader, or
 * anyone hovering) learns what `visibility`, `keyword` and `tags` currently ARE
 * is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the
 * accessible name is set on the control, not on a visible span (the hover label
 * is CSS — components/chrome.tsx), so nothing on screen changes if someone
 * replaces `Visibility: Public` with a bare `Visibility`. The page would look
 * identical and would stop saying what it is.
 *
 * `lib/plant-hero-a11y.test.ts` and `lib/sprout-hero-a11y.test.ts` are the same
 * file for the other two entities; this is the third, which is the point of the
 * head being shared.
 *
 * No jsdom: renderToStaticMarkup is enough to read an accessible name out of the
 * markup, and the head's values are server-rendered.
 *
 * The last test is a SOURCE check rather than a render, for
 * `lib/exhibition-panel-source.test.ts`'s reason: the meta form arrives as a
 * prop and is rendered inside `OverlaySheet`, whose Base UI dialog is PORTALLED,
 * and a portal has no container to render into on the server — so a marker
 * handed in through `metaForm` reaches this output in NO state, open or closed.
 * "This file imports X" is a fact about the file as written, which is exactly
 * what a render cannot see.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function hero(overrides: Record<string, unknown> = {}): Promise<string> {
  const { BeanHero } = await import("@/app/admin/_components/bean-hero");
  return render(
    React.createElement(BeanHero, {
      slug: "a-bean",
      name: "A bean",
      description: "one line about it",
      visibility: "public",
      keywordEn: "Timeline",
      keywordFr: "Chronologie",
      tags: ["ariko", "design"],
      keywordDrawn: true,
      metaForm: React.createElement("div", null, "META FORM"),
      saved: "x",
      ...overrides,
    } as any),
  );
}

test("the visibility trigger names the stored visibility", async () => {
  assert.match(await hero({ visibility: "public" }), /aria-label="Visibility: Public"/);
  assert.match(await hero({ visibility: "private" }), /aria-label="Visibility: Private"/);
});

test("the keyword and tags triggers name their stored values", async () => {
  const html = await hero();
  assert.match(html, /aria-label="Keyword: Timeline"/);
  assert.match(html, /aria-label="Tags: ariko, design"/);
});

test("an empty keyword or tag list says so rather than naming nothing", async () => {
  // "Keyword:" with nothing after it reads as a broken label rather than as an
  // empty field. "none" is the stored value stated, which is what a fact is for.
  const html = await hero({ keywordEn: "", keywordFr: "", tags: [] });
  assert.match(html, /aria-label="Keyword: none"/);
  assert.match(html, /aria-label="Tags: none"/);
});

test("a projected bean renders no trigger at all, but still states its facts", async () => {
  // Source-owned and rebuilt from its feed: every edit offered here is an edit
  // the next sync discards, and lib/pollen-store.ts's deleteFeedData takes the
  // whole document on a full rebuild. The three actions re-check this
  // server-side, because a rendered gate is not a guarantee — this pins the
  // rendered half.
  const html = await hero({ readOnly: true });
  assert.ok(!/aria-label="(Visibility|Keyword|Tags):/.test(html), "no field trigger");
  assert.ok(html.includes("Visibility: Public"), "but it still STATES its visibility");
  assert.ok(html.includes("Tags: ariko, design"), "and its tags");
});

test("the name and the description are genuinely server-rendered", async () => {
  // Not a script-off claim — the admin is a JavaScript application. It is a
  // check that BeanHero never grows a "renders nothing until it mounts" guard
  // around content that has nowhere else to live: the name is the page's only
  // h1 and the description is the only place the one-line summary appears.
  const html = await hero();
  assert.ok(html.includes("A bean"), "the name must be in the markup");
  assert.ok(html.includes("one line about it"), "the description must be in the markup");
  assert.match(html, /<h1/, "the name must be inside the page's h1");
});

const HERO = "app/admin/_components/bean-hero.tsx";

test("the meta form is rendered from the prop, never composed here", () => {
  // The corollary of the arrangement: the sheet's contents are server-rendered
  // by the page and handed down, so the island knows no field name on the bean.
  // Breaking it is silent — importing BeanMetaForm, or buildBeanMetaPatch to
  // compose a payload here, passes tsc, npm test and npm run build, and the
  // sheet keeps working. What is gone is WHERE the payload is built.
  const text = readFileSync(join(process.cwd(), HERO), "utf8");

  for (const spec of [
    "./bean-meta-form",
    "@/app/admin/_components/bean-meta-form",
    "@/lib/bean-meta",
  ]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${HERO} must not import from "${spec}" — the meta form is a prop, and ` +
        `importing it (or the patch builder behind it) would put the bean's ` +
        `field names inside the island`,
    );
  }

  // `@/lib/data` reaches this file for the Visibility TYPE and nothing else. A
  // value import from there is both a field-name door and a build failure
  // waiting to happen (lib/data.ts opens with node:fs — CLAUDE.md's
  // lib/palette.ts trap), which is why lib/plant-visibility.ts exists at all.
  for (const line of text.split("\n").filter((l) => /from ["']@\/lib\/data["']/.test(l))) {
    assert.match(
      line.trim(),
      /^import type /,
      `${HERO} may import from "@/lib/data" only as a type: ${line.trim()}`,
    );
  }
});

const PAGE = "app/admin/(chrome)/bean/[id]/page.tsx";

test("the keyword survives as two fields, prefilled STRICTLY", () => {
  // The replacement for a test that lived in lib/media-picker-mount.test.ts
  // until `bean-keyword-form.tsx` was deleted and the keyword moved into this
  // head. The property it pinned has not moved: an fr-only bean must leave the
  // EN box empty, because resolveText's fallback would copy "Karma" into it and
  // save it back as the en value — the exact corruption plant-meta-form.tsx
  // warns against and textPart avoids.
  //
  // A SOURCE check rather than a render, and not by preference: the keyword
  // fields live inside a Base UI popover, which is PORTALLED, so they
  // contribute zero bytes to renderToStaticMarkup in either state. The wiring
  // is a fact about the two files as written, which is what a render cannot
  // see — lib/exhibition-panel-source.test.ts makes the same move for the same
  // reason.
  const hero = readFileSync(join(process.cwd(), HERO), "utf8");
  assert.match(hero, /name="keyword"/, "the en keyword field must be present");
  assert.match(hero, /name="keywordFr"/, "the fr keyword field must be present");

  // And the page must fill them from textPart, never resolveText.
  const page = readFileSync(join(process.cwd(), PAGE), "utf8");
  assert.match(
    page,
    /keywordEn=\{textPart\(bean\.keyword, "en"\)\}/,
    "the en half must be prefilled with STRICT textPart",
  );
  assert.match(
    page,
    /keywordFr=\{textPart\(bean\.keyword, "fr"\)\}/,
    "the fr half must be prefilled with STRICT textPart",
  );
  assert.ok(
    !/keyword(En|Fr)=\{resolveText\(/.test(page),
    "resolveText on a keyword half would copy fr into the en box and save it back as en",
  );
});
