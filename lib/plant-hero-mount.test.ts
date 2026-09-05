import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plant } from "./data";

/**
 * What the plant page's header renders with NO script — the sibling of
 * lib/palette-mount.test.ts, and the file that keeps this slice's entry in
 * CLAUDE.md honest.
 *
 * The header spends a real exception: the logo popover, the meta sheet and the
 * role sheet are all script-only, and script-off they are simply not there.
 * What must NOT be lost with them is the pair of one-click writes — status and
 * visibility are plain <form>s posting a named value to a one-field server
 * action, so they keep working. Both halves are asserted here, because both are
 * easy to break by accident in opposite directions:
 *
 *  - Wire the toggles as onClick buttons "since the header is a client island
 *    anyway" and the script-off page grows two dead controls — the failure
 *    mode the media picker's rule exists to forbid.
 *  - Server-render a sheet's fields "so the form is there on first paint" and
 *    the script-off page grows a metadata form with no way to submit it.
 *
 * No jsdom: the server render IS the script-off render (useEffect never runs),
 * and needing a DOM to check that would defeat the point.
 */

async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

const plant: Plant = {
  slug: "melogram",
  name: "Melogram",
  natures: ["work"],
  role: { kind: "lead", title: "Head of Product" },
  description: "A listening machine",
};

// Dynamic, and inside the tests: the header pulls in the Base UI dialog and
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
    role: { label, title, detail: "" },
    // The three editors are server-rendered by the page and handed down. Given
    // recognisable markers here: if any of them ever reaches the script-off
    // HTML, the assertions below say so by name.
    metaForm: React.createElement("input", { name: "nameFr" }),
    roleForm: React.createElement("input", { name: "kind" }),
    logoForm: React.createElement("input", { name: "logo" }),
    saved: "x",
  });
}

test("the name and the mark survive without script", async () => {
  const html = await renderScriptOff(await hero());
  assert.ok(html.includes("Melogram"), html);
  assert.ok(html.includes("A listening machine"), html);
});

test("both one-click writes survive without script, posting the value they want", async () => {
  const html = await renderScriptOff(await hero());
  assert.ok(html.includes('name="status" value="inactive"'), html);
  assert.ok(html.includes('name="visibility" value="private"'), html);
  assert.ok(html.includes('name="slug" value="melogram"'), html);
});

test("each toggle posts the OTHER value — an inactive, private plant offers the way back", async () => {
  const html = await renderScriptOff(
    await hero({ status: "inactive", visibility: "private" }),
  );
  assert.ok(html.includes('name="status" value="active"'), html);
  assert.ok(html.includes('name="visibility" value="public"'), html);
});

test("none of the three editors reaches the script-off HTML", async () => {
  const html = await renderScriptOff(await hero());
  for (const field of ['name="nameFr"', 'name="kind"', 'name="logo"']) {
    assert.ok(!html.includes(field), `${field} leaked into the script-off render:\n${html}`);
  }
});
