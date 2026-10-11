import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { Journal } from "./journal";
import type { BeanstalkEntry } from "@/lib/beanstalk";
import type { PollenDoc } from "@/lib/pollen-sync";

// renderToStaticMarkup, no jsdom — components/screen-strip.test.tsx's route:
// a server component's static markup IS its output.

const sproutLine = (slug: string, date: string, kind: "log" | "essay" = "log"): BeanstalkEntry => ({
  type: "sprout",
  date,
  entry: {
    sprout: { slug, name: { en: `${slug} en`, fr: `${slug} fr` }, kind, date, description: "" },
    bean: null,
    plant: null,
  },
});

const pollenLine = (id: string, date: string, url?: string, beanSlug?: string): BeanstalkEntry => {
  const pollen: PollenDoc = {
    v: 1,
    id,
    at: `${date}T10:00:00Z`,
    source: "arkaik",
    kind: "shipped",
    title: `${id} title`,
    anchors: { plant: "plant:pbbls" },
    feedId: "arkaik-pbbls",
    syncedAt: "2026-08-17T00:00:00Z",
  };
  return { type: "pollen", date, pollen, ...(url ? { url } : {}), ...(beanSlug ? { beanSlug } : {}) };
};

const html = (entries: BeanstalkEntry[], heading?: string) =>
  renderToStaticMarkup(<Journal entries={entries} lang="fr" heading={heading} />);

test("no entries renders nothing at all — no heading, no empty list", () => {
  assert.equal(html([], "Journal"), "");
});

test("a sprout line links its name to /sprout/<slug> and spells its kind's word", () => {
  const out = html([sproutLine("felina-0", "2026-02-01", "essay")]);
  assert.match(out, /<a href="\/sprout\/felina-0"[^>]*>felina-0 fr<\/a>/);
  assert.match(out, /<time dateTime="2026-02-01">2026-02-01<\/time>/);
  assert.match(out, />Essay</);
});

test("a pollen line links its title to the source url and names its bean when kept", () => {
  const out = html([pollenLine("arkaik:e1", "2026-02-02", "https://x.test/e1", "pbbls-wallet")]);
  assert.match(out, /<a href="https:\/\/x\.test\/e1"[^>]*>arkaik:e1 title<\/a>/);
  assert.match(out, /<a href="\/bean\/pbbls-wallet"[^>]*>pbbls-wallet<\/a>/);
});

test("a heading, when given, is the section's h2 and the list is labelled by it", () => {
  const out = html([sproutLine("s", "2026-01-01")], "Journal");
  assert.match(out, /<h2[^>]*>Journal<\/h2>/);
  assert.match(out, /aria-label="Journal"/);
});

test("without a heading the list stands alone (the beanstalk owns its own h1)", () => {
  const out = html([sproutLine("s", "2026-01-01")]);
  assert.doesNotMatch(out, /<h2/);
  assert.doesNotMatch(out, /<section/);
});
