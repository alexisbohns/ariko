import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { LinkRow } from "./link-row";
import type { PlatformLink } from "@/lib/data";

/**
 * renderToStaticMarkup, no jsdom — the same route components/media.test.tsx
 * takes, and for the same reason: this component is server-only by design and
 * the static markup IS its output.
 */

const html = (links?: PlatformLink[], lang: "en" | "fr" = "en") =>
  renderToStaticMarkup(<LinkRow links={links} lang={lang} />);

const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("no links renders nothing at all", () => {
  assert.equal(html(undefined), "");
  assert.equal(html([]), "");
});

test("each link is an anchor carrying its platform's name", () => {
  const markup = html([
    { platform: "spotify", url: "https://open.spotify.com/show/abc" },
    { platform: "apple-podcasts", url: "https://podcasts.apple.com/fr/podcast/x/id1" },
  ]);
  assert.match(markup, /href="https:\/\/open\.spotify\.com\/show\/abc"/);
  assert.match(markup, /href="https:\/\/podcasts\.apple\.com\/fr\/podcast\/x\/id1"/);
  assert.match(text(markup), /Spotify/);
  assert.match(text(markup), /Apple Podcasts/);
});

test("every anchor opens safely, and says so", () => {
  const markup = html([{ platform: "deezer", url: "https://www.deezer.com/fr/show/1" }]);
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  // The announcement components/media.tsx established as this zone's
  // convention when it opened the repo's first new tab.
  assert.match(text(markup), /\(opens in a new tab\)/);
});

test("a label overrides the platform name, in the reading language", () => {
  const links: PlatformLink[] = [
    { platform: "linktree", url: "https://linktr.ee/x", label: { en: "All the links", fr: "Tous les liens" } },
  ];
  assert.match(text(html(links, "fr")), /Tous les liens/);
  assert.match(text(html(links, "en")), /All the links/);
});

test("a non-http url renders as inert text, never as an anchor", () => {
  // lib/url.ts's rule: still visible, still copyable, simply not clickable.
  const markup = html([{ platform: "link", url: "javascript:alert(1)" }]);
  assert.doesNotMatch(markup, /<a\b/);
  assert.match(text(markup), /link/);
});

test("an unknown platform shows its slug rather than a guess", () => {
  assert.match(text(html([{ platform: "bandcamp", url: "https://bandcamp.test/x" }])), /bandcamp/);
});
