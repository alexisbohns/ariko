import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two rules that make the floating commit honest, pinned rather than
 * written down.
 *
 * `components/editor/prose-editor.tsx` draws the commit in two shapes. In the
 * INLINE one a failed save is a separate red span sitting beside a button that
 * is still live, so neither rule below has anything to protect: the button
 * stays clickable because nothing ever disabled it, and the error cannot be
 * mistaken for success because it is not where the success would be. In the
 * FLOAT one the button IS the whole signal — one control whose text, variant
 * and enabled-ness are the only things the author has to read — and both rules
 * become load-bearing:
 *
 *  - **`!error` in the `disabled` expression.** The float commit is disabled
 *    when the document is clean, which is right; the `&& !error` is what keeps
 *    a save that FAILED out of that state. Delete those two tokens and a
 *    network error leaves the author with a red button they cannot press and no
 *    way to retry but a reload — with unsaved work in the editor.
 *
 *  - **`error` tested before `dirty` in the button's content chain.** The chain
 *    is `pending → error → dirty → clean`. Move `dirty` ahead of `error` and a
 *    failed save renders as "Save" — which is what a document with unsaved
 *    changes and NO error also renders as. Move `error` behind `clean` and it
 *    renders as "Up to date", which is the same claim as a successful save.
 *    Either way the author is told the opposite of what happened.
 *
 * Both are one-token edits away from being false, and both stay silent when
 * they are: `tsc` types every branch identically, `npm run build` has no
 * opinion about ternary order, and nothing renders this component under test —
 * `lib/editor.test.ts` drives the Editor, not the React tree. So this is source
 * text, on `lib/exhibition-panel-source.test.ts`'s reasoning: a property of the
 * file AS WRITTEN, which no render can observe.
 *
 * Scoped to the float branch on purpose. The slice helpers below cut from
 * `magnet="bottom-center"` to `</Chrome>`, so the inline row's own
 * `disabled={pending || imageBusy || !editor}` — which must NOT grow an
 * `!error` — is outside everything asserted here.
 */

const PROSE_EDITOR = "components/editor/prose-editor.tsx";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** The float branch alone: the `<Chrome>` cluster and everything inside it. */
function floatCommit(): string {
  const text = source(PROSE_EDITOR);
  const start = text.indexOf('magnet="bottom-center"');
  assert.notEqual(start, -1, `${PROSE_EDITOR} must still draw the float commit in a bottom-centre Chrome`);
  const end = text.indexOf("</Chrome>", start);
  assert.notEqual(end, -1, `${PROSE_EDITOR}'s float commit must still close its Chrome cluster`);
  return text.slice(start, end);
}

test("the float commit stays clickable after a save that failed", () => {
  const region = floatCommit();
  const match = /disabled=\{([^}]*)\}/.exec(region);
  assert.ok(match, `${PROSE_EDITOR}'s float commit must still have a \`disabled\` expression`);
  assert.ok(
    match![1].includes("!error"),
    `the float commit's \`disabled\` must carry \`!error\` — it is the ONLY ` +
      `thing keeping a failed save retryable, and without it the author is ` +
      `left with unsaved work behind a dead control (found: ${match![1]})`,
  );
});

test("a failed save cannot render as a saved one", () => {
  const region = floatCommit();
  const open = region.indexOf("<Button");
  const children = region.slice(region.indexOf(">", open) + 1, region.indexOf("</Button>", open));
  // The identifiers the chain branches on, in the order it branches on them.
  const chain = [...children.matchAll(/\b(pending|error|dirty)\s*\?/g)].map((m) => m[1]);
  assert.deepEqual(
    chain,
    ["pending", "error", "dirty"],
    `the float commit's content must test pending, then error, then dirty. ` +
      `\`error\` after \`dirty\` draws a failed save as "Save", and after the ` +
      `clean branch it draws one as "Up to date" — a save that failed must ` +
      `never read as saved`,
  );
});
