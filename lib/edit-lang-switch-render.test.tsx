import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EditLangSwitch } from "@/components/editor/edit-lang-switch";

/**
 * The switch is its own component for a reason that is about testing, not
 * reuse: ProseEditor's float commit renders NOTHING until the editor mounts
 * (`immediatelyRender: false`), so the editor has no server HTML in which to
 * find it.
 *
 * The disabled state's tooltip popup renders nothing in static markup (Base
 * UI opens it on hover/focus), so what's asserted there is the always-present
 * half: the anchor's own attributes and the shared `aria-describedby` target.
 */

const HREFS = { en: "/admin/sprout/a", fr: "/admin/sprout/a?lang=fr" };

test("enabled: two real links, the active one marked current", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="fr" hrefs={HREFS} disabled={false} />);
  assert.match(html, /role="group"/);
  assert.match(html, /href="\/admin\/sprout\/a"/);
  assert.match(html, /href="\/admin\/sprout\/a\?lang=fr"/);

  // Split per <a>...</a> rather than trusting attribute order.
  const items = html.split(/(?=<a )/).filter((chunk) => chunk.startsWith("<a "));
  const frItem = items.find((item) => item.includes('href="/admin/sprout/a?lang=fr"'));
  const enItem = items.find((item) => item.includes('href="/admin/sprout/a"') && !item.includes("lang=fr"));
  assert.ok(frItem, "expected an FR link");
  assert.ok(enItem, "expected an EN link");
  assert.match(frItem!, /aria-current="page"/);
  assert.doesNotMatch(enItem!, /aria-current="page"/);

  // The accessible name leads with the visible code (WCAG 2.5.3): "EN"/"FR"
  // on screen, an sr-only suffix spelling out what it does.
  assert.match(html, /EN<span[^>]*> — edit English<\/span>/);
  assert.match(html, /FR<span[^>]*> — edit French<\/span>/);
});

test("disabled while dirty: no href anywhere, so no click can navigate away from unsaved text", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="en" hrefs={HREFS} disabled />);
  assert.doesNotMatch(html, /href=/);
  assert.equal(html.match(/aria-disabled="true"/g)?.length, 2);
  assert.equal(html.match(/role="link"/g)?.length, 2);
  assert.equal(html.match(/tabindex="0"/g)?.length, 2);
  // Still says which one is current, even disabled.
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);

  // Both items describe themselves via the SAME sr-only "Save first" span,
  // which is itself hidden from the tree (aria-describedby still resolves to
  // a hidden target — a screen reader's browse mode just won't hit it twice).
  const hintTag = html.match(/<span[^>]*>Save first<\/span>/);
  assert.ok(hintTag, "expected an sr-only 'Save first' span");
  assert.match(hintTag![0], /aria-hidden="true"/);
  const hintId = hintTag![0].match(/id="([^"]+)"/)?.[1];
  assert.ok(hintId, "expected the hint span to carry an id");
  const describedBy = html.match(new RegExp(`aria-describedby="${hintId}"`, "g"));
  assert.equal(describedBy?.length, 2);

  // Dead items no longer react like live ones: the ghost hover and the base
  // press nudge are both overridden, and twMerge keeps the overrides rather
  // than dropping them alongside what they replace.
  const items = html.split(/(?=<a )/).filter((chunk) => chunk.startsWith("<a "));
  for (const item of items) {
    assert.match(item, /hover:bg-transparent/);
    assert.doesNotMatch(item, /hover:bg-muted/);
    assert.match(item, /active:not-aria-\[haspopup\]:translate-y-0/);
    assert.doesNotMatch(item, /translate-y-px/);
  }
});
