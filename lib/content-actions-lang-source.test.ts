import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `editContentAction` and `editContainerContentAction` (app/admin/actions.ts)
 * save ONE HALF of a sprout, plant or pod's prose, named by the posted `lang`
 * (lib/edit-lang.ts) — never a hard-coded `"en"`. Reverting either call site
 * back to a literal `"en"` passes `tsc`, `npm test` and `npm run build`: the
 * form still posts, the redirect still lands, and nothing throws — a French
 * save simply overwrites the English half instead, silently, on every save.
 * This file is what reports it.
 *
 * Source text, exactly as lib/garden-cache-source.test.ts checks its own
 * per-function invariant on this same file: each function is sliced out on
 * its own name, from `export async function <name>` to the next top-level
 * `\nexport `, so a regression in one of the two functions cannot hide behind
 * the other one still doing it right.
 */

const ACTIONS_PATH = "app/admin/actions.ts";
const FUNCTION_NAMES = ["editContentAction", "editContainerContentAction"];

const source = readFileSync(join(process.cwd(), ACTIONS_PATH), "utf8");

/**
 * Slices a single named function's body out of `source`, from its own
 * `export async function <name>` to the next top-level `export `. The two
 * functions this file checks are both followed, in source order, by another
 * exported action (`editSproutMediaAction`, `editPlantRoleAction`), so this
 * boundary is exact for both — see the name list checked against
 * FUNCTION_NAMES below, which would fail loudly if that ever stopped being true.
 */
function sliceFunction(name: string): string {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `could not find ${marker} in ${ACTIONS_PATH}`);
  const nextExport = source.indexOf("\nexport ", start + marker.length);
  const end = nextExport === -1 ? source.length : nextExport;
  return source.slice(start, end);
}

for (const name of FUNCTION_NAMES) {
  test(`${name} reads the posted lang rather than assuming English`, () => {
    const body = sliceFunction(name);

    assert.ok(
      body.includes(`parseEditLangField(formData.get("lang"))`),
      `${name} must read its lang from the posted form field via parseEditLangField`,
    );

    assert.ok(
      body.includes("buildContentPatch(existing, markdown, field.lang)"),
      `${name} must pass the POSTED lang into buildContentPatch, not a hard-coded one`,
    );

    assert.equal(
      /buildContentPatch\([^)]*"en"[^)]*\)/.test(body),
      false,
      `${name} calls buildContentPatch with a literal "en" — a French save ` +
        "would silently overwrite the English half instead of its own",
    );
  });

  test(`${name}'s final redirect lands on the saved half`, () => {
    const body = sliceFunction(name);
    const lastRedirect = body.lastIndexOf("redirect(");
    assert.ok(lastRedirect !== -1, `${name} must redirect somewhere`);
    const tail = body.slice(lastRedirect, lastRedirect + 40);
    assert.ok(
      tail.includes("withEditLang("),
      `${name}'s final redirect must go through withEditLang(), or a saved ` +
        "French half sends the author back to the English editor",
    );
  });
}
