import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EditLangSwitch } from "@/components/editor/edit-lang-switch";

/**
 * The switch is its own component for a reason that is about testing, not
 * reuse: ProseEditor's float commit renders NOTHING until the editor mounts
 * (`immediatelyRender: false`), so the editor has no server HTML in which to
 * find it.
 */

const HREFS = { en: "/admin/sprout/a", fr: "/admin/sprout/a?lang=fr" };

test("enabled: two real links, the active one marked current", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="fr" hrefs={HREFS} disabled={false} />);
  assert.match(html, /href="\/admin\/sprout\/a"/);
  assert.match(html, /href="\/admin\/sprout\/a\?lang=fr"/);
  assert.match(html, /aria-current="page"[^>]*>FR</);
  assert.doesNotMatch(html, /aria-current="page"[^>]*>EN</);
  // The accessible name says what the control does, not just the code.
  assert.match(html, /aria-label="Edit English"/);
  assert.match(html, /aria-label="Edit French"/);
});

test("disabled while dirty: no href anywhere, so no click can navigate away from unsaved text", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="en" hrefs={HREFS} disabled />);
  assert.doesNotMatch(html, /href=/);
  assert.equal(html.match(/aria-disabled="true"/g)?.length, 2);
  assert.match(html, /Save first/);
});
