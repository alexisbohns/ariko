import { test } from "node:test";
import assert from "node:assert/strict";
import { exhibitedPollen, mergeBeanstalk, plantSlugOf } from "./beanstalk";
import type { PollenDoc } from "./pollen-sync";
import type { TimelineEntry } from "./data";

function doc(over: Partial<PollenDoc>): PollenDoc {
  return {
    v: 1,
    id: "arkaik:e1",
    at: "2026-08-10T10:00:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Shipped a thing",
    anchors: { plant: "plant:pbbls" },
    feedId: "arkaik-pbbls",
    syncedAt: "2026-08-17T00:00:00Z",
    ...over,
  };
}

function sproutEntry(slug: string, date: string, plantSlug: string | null = "pbbls"): TimelineEntry {
  return {
    sprout: { slug, name: slug, type: "feature", date, description: "", parents: [] },
    bean: null,
    plant: plantSlug ? { slug: plantSlug, name: plantSlug, natures: ["work"], description: "" } : null,
  };
}

const PUBLIC_PLANTS = new Set(["pbbls", "arkaik"]);

test("exhibition: private visibility always loses, fail-closed first", () => {
  const r = exhibitedPollen([doc({ visibility: "private" })], ["plant:pbbls"], PUBLIC_PLANTS);
  assert.deepEqual(r, []);
});

test("exhibition: a non-exhibited plant loses", () => {
  assert.deepEqual(exhibitedPollen([doc({})], [], PUBLIC_PLANTS), []);
});

test("exhibition: a filterPublic-hidden plant loses even when exhibited", () => {
  assert.deepEqual(exhibitedPollen([doc({})], ["plant:pbbls"], new Set()), []);
});

test("exhibition: exhibited + public plant passes", () => {
  assert.equal(exhibitedPollen([doc({})], ["plant:pbbls"], PUBLIC_PLANTS).length, 1);
});

test("merge sorts newest first by date part, sprout before pollen on ties", () => {
  const entries = mergeBeanstalk(
    [sproutEntry("s-old", "2026-08-01"), sproutEntry("s-tie", "2026-08-10")],
    [doc({ id: "arkaik:tie", at: "2026-08-10T23:59:59Z" }), doc({ id: "arkaik:new", at: "2026-08-12T01:00:00Z" })],
    new Set(),
  );
  assert.deepEqual(
    entries.map((e) => (e.type === "sprout" ? e.entry.sprout.slug : e.pollen.id)),
    ["arkaik:new", "s-tie", "arkaik:tie", "s-old"],
  );
});

test("pollen entries pick the first url ref and a kept bean anchor", () => {
  const [e] = mergeBeanstalk(
    [],
    [
      doc({
        anchors: { plant: "plant:pbbls", bean: "bean:rom-win" },
        refs: [
          { label: "deliverable", ref: "pr-12" },
          { label: "pull request", url: "https://github.com/x/pbbls/pull/12" },
        ],
      }),
    ],
    new Set(["rom-win"]),
  );
  assert.equal(e.type, "pollen");
  if (e.type !== "pollen") return;
  assert.equal(e.url, "https://github.com/x/pbbls/pull/12");
  assert.equal(e.beanSlug, "rom-win");
});

test("a bean anchor outside the kept set yields no bean link", () => {
  const [e] = mergeBeanstalk([], [doc({ anchors: { plant: "plant:pbbls", bean: "bean:hidden" } })], new Set());
  if (e.type !== "pollen") return assert.fail("expected pollen entry");
  assert.equal(e.beanSlug, undefined);
});

test("plantSlugOf reads both entry types", () => {
  const entries = mergeBeanstalk([sproutEntry("s1", "2026-08-01")], [doc({})], new Set());
  assert.deepEqual(entries.map(plantSlugOf), ["pbbls", "pbbls"]);
});
