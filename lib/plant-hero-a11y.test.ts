import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plant } from "./data";

/**
 * The plant header's five editors are icon triggers — a logo, a chess piece, a
 * status bolt, a globe. An icon is not a label, so the only place a reader
 * (screen reader, or anyone hovering) learns what `status` and `visibility`
 * currently ARE is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the
 * accessible name is set on the control, not on a visible span (the hover
 * label is CSS — components/chrome.tsx), so nothing on screen changes if
 * someone replaces `Status: Active` with a bare `Status`. The page would look
 * identical and would stop saying what it is.
 *
 * This file also keeps the sibling property the old file pinned alongside it:
 * the name and the description are genuinely server-rendered, not gated
 * behind a client-only mount check the way the media picker and the palette
 * are. That is not a script-off claim — the assertion holds however script
 * ends up behaving — it is a check that PlantHero never grows a "renders
 * nothing until it mounts" guard around content that has nowhere else to live.
 *
 * This is the surviving half of the former lib/plant-hero-mount.test.ts. The
 * other two tests asserted the header renders no form fields without script.
 * They pinned an entry in CLAUDE.md's exception ledger, which the rulebook
 * slice replaced with three invariants; the admin is a JavaScript application
 * and an admin island rendering nothing script-off no longer needs a test to
 * say so. No write path is affected — the three big forms are still
 * server-rendered by app/admin/plant/[slug]/page.tsx and handed down as
 * props, which lib/exhibition-panel-source.test.ts pins for its sibling.
 *
 * No jsdom: renderToStaticMarkup is enough to read an accessible name out of
 * the markup, and the header's values are server-rendered.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

const plant: Plant = {
  slug: "melogram",
  name: "Melogram",
  natures: ["work"],
  role: { kind: "lead", title: "Head of Product" },
  description: "A listening machine",
};

// Dynamic, and inside the test: the header pulls in the Base UI dialog and
// popover trees, plus the admin's server actions, at module-evaluation time.
async function hero(overrides: Partial<Plant> = {}): Promise<unknown> {
  const React = await import("react");
  const { PlantHero } = await import("@/app/admin/_components/plant-hero");
  const { statusOf } = await import("./plant-status");
  const { visibilityOf } = await import("./plant-visibility");
  const { roleParts } = await import("./plant-role");
  const subject = { ...plant, ...overrides };
  const { label, title } = roleParts(subject.role);
  return React.createElement(PlantHero, {
    slug: subject.slug,
    name: "Melogram",
    description: "A listening machine",
    logoUrl: subject.logo?.url,
    status: statusOf(subject),
    visibility: visibilityOf(subject),
    role: { kind: subject.role.kind, label, title, detail: "" },
    metaForm: React.createElement("input", { name: "nameFr" }),
    roleForm: React.createElement("input", { name: "kind" }),
    logoForm: React.createElement("input", { name: "logo" }),
    saved: "x",
  });
}

test("the name and the mark are server-rendered, not behind a trigger", async () => {
  const html = await render(await hero());
  assert.ok(html.includes("Melogram"), html);
  assert.ok(html.includes("A listening machine"), html);
});

test("each enum trigger names its stored value in its accessible name", async () => {
  const active = await render(await hero());
  assert.ok(active.includes("Status: Active"), active);
  assert.ok(active.includes("Visibility: Public"), active);

  const hidden = await render(
    await hero({ status: "inactive", visibility: "private" }),
  );
  assert.ok(hidden.includes("Status: Inactive"), hidden);
  assert.ok(hidden.includes("Visibility: Private"), hidden);
});
