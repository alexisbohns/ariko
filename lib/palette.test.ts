import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS } from "./admin-nav";
import { buildPaletteIndex, groupPaletteItems, sectionItems, type PaletteItem } from "./palette";
import type { RawGarden, Seed } from "./data";

const GARDEN: RawGarden = {
  plants: [
    // Bilingual name — the palette must resolve it, not ship the object.
    {
      slug: "pebbles",
      name: { en: "Pebbles", fr: "Cailloux" },
      natures: ["work"],
      role: { kind: "owner" },
      description: "",
      logo: {
        kind: "image",
        url: "https://res.cloudinary.com/demo/image/upload/v1/p.png",
        storageKey: "p",
      },
    },
  ],
  pods: [
    {
      slug: "case-study",
      name: "Pebbles case study",
      parents: ["plant:pebbles"],
      description: "",
    },
  ],
  beans: [{ slug: "digest", name: "Digest", parents: ["pod:case-study"] }],
  sprouts: [
    {
      slug: "digest-4",
      name: "Digest #4",
      type: "note",
      date: "2026-01-01",
      description: "",
      parents: ["bean:digest"],
    },
  ],
};

function seed(over: Partial<Seed> = {}): Seed {
  return {
    id: "s1",
    title: "A thought",
    media: [],
    source: { kind: "manual" },
    status: "inbox",
    promotedTo: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  } as Seed;
}

function byId(items: PaletteItem[], id: string): PaletteItem {
  const found = items.find((i) => i.id === id);
  assert.ok(found, `no item ${id}`);
  return found;
}

test("every kind gets the href the admin already links to", () => {
  const items = buildPaletteIndex({ garden: GARDEN, seeds: [seed()] });

  assert.equal(byId(items, "plant:pebbles").href, "/admin/plant/pebbles");
  assert.equal(byId(items, "pod:case-study").href, "/admin/pod/case-study");
  assert.equal(byId(items, "bean:digest").href, "/admin/bean/digest");
  assert.equal(byId(items, "sprout:digest-4").href, "/admin/sprout/digest-4");
  assert.equal(byId(items, "seed:s1").href, "/admin/triage/s1");
});

test("bilingual names are resolved to plain strings before they cross the wire", () => {
  const items = buildPaletteIndex({ garden: GARDEN, seeds: [] });
  const plant = byId(items, "plant:pebbles");
  assert.equal(plant.label, "Pebbles");
  assert.equal(typeof plant.label, "string");
});

test("a plant carries its logo url, and only the url", () => {
  const plant = byId(buildPaletteIndex({ garden: GARDEN, seeds: [] }), "plant:pebbles");
  assert.equal(plant.logoUrl, "https://res.cloudinary.com/demo/image/upload/v1/p.png");
});

test("a plant with no logo carries no url — EntityAvatar makes a mark from the name", () => {
  const items = buildPaletteIndex({
    garden: {
      plants: [
        { slug: "bare", name: "New Wave", natures: ["work"], role: { kind: "owner" }, description: "" },
      ],
    },
    seeds: [],
  });
  assert.equal(byId(items, "plant:bare").logoUrl, undefined);
});

test("no other kind carries a logo — only plants are drawn as marks", () => {
  const items = buildPaletteIndex({ garden: GARDEN, seeds: [seed()] });
  for (const item of items) {
    if (item.kind !== "plant") {
      assert.equal(item.logoUrl, undefined, `${item.id} carries a logo it cannot draw`);
    }
  }
});

test("the sublabel names the containing thing, across tiers", () => {
  const items = buildPaletteIndex({ garden: GARDEN, seeds: [] });
  assert.equal(byId(items, "pod:case-study").sublabel, "Pebbles");
  assert.equal(byId(items, "bean:digest").sublabel, "Pebbles case study");
  assert.equal(byId(items, "sprout:digest-4").sublabel, "Digest");
  // A plant contains nothing above it, so it carries no sublabel at all.
  assert.equal(byId(items, "plant:pebbles").sublabel, undefined);
});

test("an unresolvable parent ref yields no sublabel rather than a raw ref", () => {
  const items = buildPaletteIndex({
    garden: { beans: [{ slug: "orphan", name: "Orphan", parents: ["pod:gone"] }] },
    seeds: [],
  });
  assert.equal(byId(items, "bean:orphan").sublabel, undefined);
});

test("the Go to group is sourced from NAV_ITEMS, never re-typed", () => {
  const sections = buildPaletteIndex({ garden: GARDEN, seeds: [] }).filter(
    (i) => i.kind === "section",
  );
  assert.deepEqual(
    sections.map((s) => [s.label, s.href]),
    NAV_ITEMS.map((n) => [n.label, n.href]),
  );
});

test("an empty garden yields the sections and nothing else", () => {
  const items = buildPaletteIndex({ garden: {}, seeds: [] });
  assert.equal(items.length, NAV_ITEMS.length);
  assert.ok(items.every((i) => i.kind === "section"));
  assert.deepEqual(sectionItems(), items);
});

test("only inbox seeds appear, in the order they were given", () => {
  const items = buildPaletteIndex({
    garden: {},
    seeds: [
      seed({ id: "new", title: "Newest" }),
      seed({ id: "gone", status: "discarded" }),
      seed({ id: "done", status: "promoted" }),
      seed({ id: "old", title: "Older" }),
    ],
  });
  const inbox = items.filter((i) => i.kind === "seed");
  assert.deepEqual(
    inbox.map((i) => i.id),
    ["seed:new", "seed:old"],
  );
});

test("a seed's note becomes a snippet, capped and whitespace-collapsed", () => {
  const long = "word ".repeat(40);
  const items = buildPaletteIndex({ garden: {}, seeds: [seed({ body: { en: long } })] });
  const row = byId(items, "seed:s1");
  assert.ok(row.sublabel);
  assert.ok(row.sublabel.length <= 61, row.sublabel);
  assert.ok(row.sublabel.endsWith("…"));
  assert.ok(!row.sublabel.includes("  "));
});

test("a seed with no note carries no sublabel", () => {
  const items = buildPaletteIndex({ garden: {}, seeds: [seed({ body: { en: "   " } })] });
  assert.equal(byId(items, "seed:s1").sublabel, undefined);
});

test("groups render in GROUPS order and empty ones are dropped", () => {
  const grouped = groupPaletteItems(buildPaletteIndex({ garden: GARDEN, seeds: [seed()] }));
  assert.deepEqual(
    grouped.map((g) => g.value),
    ["Go to", "Garden", "Vault", "Inbox"],
  );
  // Garden is plants then pods; Vault is beans then sprouts.
  assert.deepEqual(
    grouped[1].items.map((i) => i.kind),
    ["plant", "pod"],
  );
  assert.deepEqual(
    grouped[2].items.map((i) => i.kind),
    ["bean", "sprout"],
  );

  const bare = groupPaletteItems(buildPaletteIndex({ garden: {}, seeds: [] }));
  assert.deepEqual(
    bare.map((g) => g.value),
    ["Go to"],
  );
});

test("ids stay unique when a slug is reused across tiers", () => {
  const items = buildPaletteIndex({
    garden: {
      plants: [
        { slug: "same", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
      ],
      pods: [{ slug: "same", name: "Q", description: "" }],
      beans: [{ slug: "same", name: "R", parents: [] }],
      sprouts: [{ slug: "same", name: "S", type: "note", date: "2026-01-01", description: "", parents: [] }],
    },
    seeds: [],
  });
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("slugs are percent-encoded into the href", () => {
  const items = buildPaletteIndex({
    garden: { beans: [{ slug: "a b/c", name: "Odd", parents: [] }] },
    seeds: [],
  });
  assert.equal(byId(items, "bean:a b/c").href, "/admin/bean/a%20b%2Fc");
});
