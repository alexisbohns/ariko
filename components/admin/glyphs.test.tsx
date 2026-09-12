import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { PLANT_ROLE_KINDS } from "@/lib/plant-role";
import { PLANT_STATUSES, statusLabel } from "@/lib/plant-status";
import { SPROUT_STATES } from "@/lib/sprout-state";
import { NARRATIVE_LABEL, sproutStateLabel } from "@/lib/glyphs";
import {
  NarrativeGlyph,
  RoleGlyph,
  SPROUT_STATE_ICONS,
  SproutStateGlyph,
  StatusGlyph,
  TierGlyph,
  VisibilityGlyph,
} from "./glyphs";

/**
 * CLAUDE.md's rule for this island, enforced: **every glyph carries its word.**
 *
 * The admin tables draw values instead of spelling them out, and the whole
 * licence for doing that is the `sr-only` span inside `IconGlyph` — no value is
 * ever icon-only in the accessibility tree. Nothing else checks it, and the way
 * it gets lost is not by someone deleting the span: it is by a new glyph being
 * written NEXT to `IconGlyph` instead of through it, because a bare
 * `<Check className="size-4" />` in a cell renders and looks right.
 *
 * That failure passes `tsc`, passes the rest of `npm test` and passes
 * `npm run build`. The column simply stops saying anything, to exactly the
 * readers who cannot see it — which is the same shape as every other invariant
 * this repo pins in source rather than in prose.
 *
 * The garden's three newest columns are the reason this file exists now: role,
 * status and narrative were words until this slice, so they could not have been
 * silently mute. They can be from here on.
 *
 * renderToStaticMarkup, no jsdom — the label is in the markup either way, and
 * an unopened tooltip is precisely the state this test wants to read: the
 * sr-only text is what makes the cell legible WITHOUT hovering, so asserting on
 * the closed form is asserting the thing that matters.
 */

const markup = (element: ReactElement): string => renderToStaticMarkup(element);

/** The word, in the accessibility tree rather than merely somewhere on screen. */
function assertNames(element: ReactElement, word: string): void {
  const html = markup(element);
  assert.ok(
    new RegExp(`<span class="sr-only">${word}</span>`).test(html),
    `this glyph does not carry "${word}" in an sr-only span — it renders as ${html}`,
  );
}

for (const kind of PLANT_ROLE_KINDS) {
  test(`the ${kind} glyph names the role`, () => {
    // The composed line, not the bare enum label: a role's custom title is the
    // one thing no icon can draw, so the garden hands it down and the glyph has
    // to carry it through. `Lead · Head of Product`, not `Lead`.
    assertNames(
      <RoleGlyph kind={kind} label={`${kind} · Head of Product`} />,
      `${kind} · Head of Product`,
    );
  });
}

for (const status of PLANT_STATUSES) {
  test(`the ${status} glyph names the status`, () => {
    assertNames(<StatusGlyph status={status} />, statusLabel(status));
  });
}

test("the narrative glyph names itself", () => {
  assertNames(<NarrativeGlyph />, NARRATIVE_LABEL);
});

// The two that were already drawn. Here so that the rule is pinned for the
// island rather than for this slice's three additions.
test("the glyphs that predate this file still name themselves", () => {
  assertNames(<VisibilityGlyph visibility="private" />, "Private");
  assertNames(<TierGlyph tier="pod" />, "Pod");
});

for (const state of SPROUT_STATES) {
  test(`the ${state} glyph names the state`, () => {
    assertNames(<SproutStateGlyph state={state} />, sproutStateLabel(state));
  });
}

test("SPROUT_STATE_ICONS covers the vocabulary and nothing else", () => {
  assert.deepEqual(Object.keys(SPROUT_STATE_ICONS).sort(), [...SPROUT_STATES].sort());
});

test("a role glyph is not the same drawing for every kind", () => {
  // Non-vacuous: the assertions above would all pass if every kind rendered one
  // crown. Owner and co-owner deliberately share theirs; the other three
  // silhouettes are the reason the column is scannable at all.
  const drawn = new Set(
    PLANT_ROLE_KINDS.map((kind) =>
      markup(<RoleGlyph kind={kind} label="x" />).replace(
        /<span class="sr-only">.*?<\/span>/,
        "",
      ),
    ),
  );
  assert.equal(
    drawn.size,
    3,
    "owner and co-owner share a crown; lead and contributor do not",
  );
});
