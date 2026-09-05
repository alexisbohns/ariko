import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plant } from "./data";

/**
 * What the plant page's header renders with NO script — the sibling of
 * lib/palette-mount.test.ts, and the file that keeps this slice's entry in
 * CLAUDE.md honest.
 *
 * The header spends a real exception: all five editors — the logo popover, the
 * meta sheet, the role sheet, and the status and visibility option popovers —
 * are script-only, and script-off they are simply not there. What this file
 * pins is that they are not there in the RIGHT way. The failure mode is not a
 * missing form; it is a HALF-rendered one.
 *
 * Server-render a popover's fields "so they are there on first paint" and the
 * page grows a metadata form with no way to submit it. Worse for the two enum
 * fields specifically: a `status` input reaching the script-off HTML alongside
 * a submit is a plant's visibility one stray press away from changing, which is
 * exactly what the confirm-then-save shape was introduced to prevent.
 *
 * The mark and the name DO survive — the header is readable without script,
 * just not editable.
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
    // The three big forms are server-rendered by the page and handed down.
    // Given recognisable markers here: if any of them ever reaches the
    // script-off HTML, the assertions below say so by name.
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

test("no editor's fields reach the script-off HTML", async () => {
  const html = await renderScriptOff(await hero());
  for (const field of ['name="nameFr"', 'name="kind"', 'name="logo"']) {
    assert.ok(!html.includes(field), `${field} leaked into the script-off render:\n${html}`);
  }
});

test("neither enum field can be written from the script-off page", async () => {
  for (const subject of [{}, { status: "inactive" as const, visibility: "private" as const }]) {
    const html = await renderScriptOff(await hero(subject));
    // No radio, no hidden input, no slug to aim a write at — and therefore no
    // form at all on a page whose every trigger is inert.
    assert.ok(!html.includes('name="status"'), html);
    assert.ok(!html.includes('name="visibility"'), html);
    assert.ok(!html.includes('name="slug"'), html);
    assert.ok(!html.includes("<form"), html);
  }
});

test("the triggers still NAME the stored values, so the header reads correctly", async () => {
  const active = await renderScriptOff(await hero());
  assert.ok(active.includes("Status: Active"), active);
  assert.ok(active.includes("Visibility: Public"), active);

  const hidden = await renderScriptOff(
    await hero({ status: "inactive", visibility: "private" }),
  );
  assert.ok(hidden.includes("Status: Inactive"), hidden);
  assert.ok(hidden.includes("Visibility: Private"), hidden);
});
