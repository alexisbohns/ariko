import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The sprout page's five OTHER writes — media, meta, state, date, type — never
 * touch the prose, so none of them chooses which half of an article to save.
 * But every one of them redirects back to `/admin/sprout/<slug>` through
 * `sproutHref` (app/admin/actions.ts), and that redirect has to land the
 * author on the half they were editing: an author on `?lang=fr` who renames a
 * sprout, republishes it, or swaps its cover image and gets bounced to the
 * English editor sees this as the French text having vanished (spec §5),
 * exactly the failure `lib/content-actions-lang-source.test.ts` pins for the
 * two prose actions.
 *
 * The read is TOLERANT here (`editLang`, English default) rather than the
 * STRICT `parseEditLangField` those two actions use — `lang` in this file
 * only ever picks a redirect target, never which half of anything gets
 * written, so an old tab or a form that somehow dropped the field should not
 * be treated as a rejected save.
 *
 * Reverting any of the five redirects back to a bare `sproutHref(...)` passes
 * `tsc`, `npm test` and `npm run build`: the form still posts, the redirect
 * still lands on a real page, and nothing throws — the author is simply on
 * the wrong half of it. This file is what reports it.
 *
 * Source text, and the same per-function slicing `lib/content-actions-lang-
 * source.test.ts` and `lib/garden-cache-source.test.ts` both use: each
 * function is sliced from its own `export async function <name>` to the next
 * top-level `\nexport `, so a regression in one of the five cannot hide behind
 * the other four still doing it right. One of these slices
 * (`editSproutMediaAction`, which the non-exported `sproutHref` helper sits
 * right after in source order) swallows that helper's own declaration on its
 * way to the next export — harmless, since that helper's body contains
 * neither `redirect(sproutHref(` nor a second `async function` for
 * `sliceFunction`'s own boundary check to trip over.
 */

const ACTIONS_PATH = "app/admin/actions.ts";
const FUNCTION_NAMES = [
  "editSproutMediaAction",
  "editSproutMetaAction",
  "setSproutStateAction",
  "setSproutDateAction",
  "setSproutTypeAction",
];

const source = readFileSync(join(process.cwd(), ACTIONS_PATH), "utf8");

/** See lib/content-actions-lang-source.test.ts's own copy for the full
 *  reasoning on the boundary this checks. */
function sliceFunction(name: string): string {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `could not find ${marker} in ${ACTIONS_PATH}`);
  const nextExport = source.indexOf("\nexport ", start + marker.length);
  const end = nextExport === -1 ? source.length : nextExport;
  const body = source.slice(start, end);
  assert.equal(
    body.match(/\basync function /g)?.length,
    1,
    `the slice for ${name} contains more than one function declaration — the ` +
      "boundary swallowed a neighbour, and the checks below would be reading " +
      "the wrong function's body",
  );
  return body;
}

for (const name of FUNCTION_NAMES) {
  test(`${name} reads the posted lang tolerantly`, () => {
    const body = sliceFunction(name);
    assert.ok(
      body.includes(`editLang(formData.get("lang"))`),
      `${name} must read its lang via editLang(formData.get("lang")) — TOLERANT ` +
        "(English default), because here lang only picks a redirect target, " +
        "never which half of anything gets written",
    );
  });

  test(`${name} wraps every sproutHref redirect in withEditLang`, () => {
    const body = sliceFunction(name);
    // `redirect(...)`, not a bare `sproutHref(` count: editSproutMediaAction's
    // slice swallows the non-exported `sproutHref` helper's own `function
    // sproutHref(...)` declaration on its way to the next export (the helper
    // sits right after it in source order), and that declaration also
    // contains the substring `sproutHref(` without being a redirect at all.
    const totalRedirects =
      body.match(/redirect\(\s*(?:withEditLang\(\s*)?sproutHref\(/g)?.length ?? 0;
    const wrappedRedirects = body.match(/redirect\(\s*withEditLang\(\s*sproutHref\(/g)?.length ?? 0;
    assert.ok(totalRedirects > 0, `${name} must redirect through sproutHref`);
    assert.equal(
      wrappedRedirects,
      totalRedirects,
      `${name} must wrap every sproutHref(...) redirect target in ` +
        "withEditLang(...) — a bare one sends an author on ?lang=fr back to " +
        "the English editor",
    );
    assert.doesNotMatch(
      body,
      /redirect\(sproutHref\(/,
      `${name} redirects straight to sproutHref(...) without withEditLang — ` +
        "the half the author was editing is lost on the way back",
    );
  });
}
