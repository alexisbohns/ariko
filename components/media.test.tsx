import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { MediaList } from "./media";
import { EMBED_FRAME_HOSTS } from "@/lib/embed-src";
import type { Media } from "@/lib/data";

/**
 * The last link in the media slice's security argument, and until this file the
 * only untested one. Every derivation below it is pinned — lib/embeds.ts,
 * lib/inbox.ts, lib/embed-src.ts — but components/media.tsx is what turns those
 * derivations into HTML, and package.json's test glob covered `lib/**` only, so
 * a test written here would have silently not run. The glob was widened in the
 * same change that added this file; if it is ever narrowed again, these tests
 * disappear without a single failure to announce it.
 *
 * renderToStaticMarkup, no jsdom: this component is server-only by design, and
 * the static markup IS its output. lib/editor-mount.test.ts and
 * lib/markdown-conformance.test.ts already take the same route.
 *
 * `tsconfig.test.json` exists for this file and nothing else. The repo's
 * tsconfig sets `jsx: "preserve"` — Next rewrites it back to that on every
 * build, so it cannot simply be changed — and under `preserve` tsx falls back
 * to the CLASSIC transform, which needs `React.createElement` in scope. No
 * component in this repo imports React, so every one of them would throw
 * "React is not defined" the moment a test rendered it. The test config
 * overrides only `jsx`, to `react-jsx`, which is the runtime Next itself uses.
 *
 * The forged rows below deliberately bypass normalizeMedia — they are the shape
 * a pre-normalization database row, or a bug upstream, could hand this
 * component. Origin safety must hold anyway.
 */

const html = (media?: Media[]) =>
  renderToStaticMarkup(<MediaList media={media} />);

/** Attribute values only; enough to read what the markup actually emits. */
const attrs = (markup: string, tag: string, attr: string): string[] => {
  const found: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*?\\b${attr}="([^"]*)"`, "g");
  for (const m of markup.matchAll(re)) found.push(m[1]);
  return found;
};

/** Tag-stripped text, so "is there a badge" is asked of what a reader sees. */
const textOf = (markup: string) =>
  markup.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

test("no iframe src escapes EMBED_FRAME_HOSTS, even for a forged provider", () => {
  const allowed = new Set<string>(EMBED_FRAME_HOSTS);

  const markup = html([
    // Honest rows, one per provider that can be framed.
    { kind: "embed", provider: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", embedId: "dQw4w9WgXcQ" },
    { kind: "embed", provider: "vimeo", url: "https://vimeo.com/123456", embedId: "123456" },
    { kind: "embed", provider: "soundcloud", url: "https://soundcloud.com/artist/track" },
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" },
    { kind: "embed", provider: "deezer", url: "https://www.deezer.com/en/album/12345" },
    // Providers that never frame — they must produce a link card, not a src.
    { kind: "embed", provider: "ausha", url: "https://podcast.ausha.co/show/ep" },
    { kind: "embed", provider: "figma", url: "https://www.figma.com/file/abc/Name" },
    { kind: "embed", provider: "link", url: "https://example.com/a" },
    // Forged: the provider disagrees with the URL. `soundcloud` is the one
    // provider that forwards the stored URL verbatim, so it re-verifies the
    // host itself; the others reduce the URL to a validated id, which is what
    // makes the hostile host unreachable rather than merely unlikely.
    { kind: "embed", provider: "spotify", url: "https://evil.test/track/abc" },
    { kind: "embed", provider: "soundcloud", url: "https://evil.test/artist/track" },
    { kind: "embed", provider: "deezer", url: "https://evil.test/en/album/12345" },
    // Forged ids, including one that tries to be a URL of its own.
    { kind: "embed", provider: "youtube", url: "https://youtube.com/watch?v=x", embedId: "../../evil.test/x" },
    { kind: "embed", provider: "vimeo", url: "https://vimeo.com/1", embedId: "https://evil.test/1" },
  ]);

  const srcs = attrs(markup, "iframe", "src");
  // Non-vacuous: if a refactor stopped framing anything at all, an empty list
  // would otherwise satisfy every assertion below.
  assert.ok(srcs.length >= 5, `expected several frames, got ${srcs.length}`);

  for (const src of srcs) {
    assert.equal(
      allowed.has(new URL(src).origin),
      true,
      `iframe src outside EMBED_FRAME_HOSTS: ${src}`,
    );
  }

  // What the allowlist assertion means in each forged case, spelled out so a
  // future reader sees the failure MODE and not only the pass:
  //
  // A forged embedId cannot climb out of the player's path — encodeURIComponent
  // turns a traversal, or a whole URL, into a single escaped segment.
  assert.ok(
    srcs.includes("https://www.youtube-nocookie.com/embed/..%2F..%2Fevil.test%2Fx"),
    "a traversal id must stay one escaped segment",
  );
  assert.ok(
    srcs.includes("https://player.vimeo.com/video/https%3A%2F%2Fevil.test%2F1"),
    "a URL-shaped id must stay one escaped segment",
  );
  // A forged provider/url pair still frames — on the PROVIDER's origin, with an
  // id lifted from a host that is not theirs. Wrong content on a safe origin is
  // the designed failure mode; getting the RIGHT content is what the upstream
  // derivation buys, not containment.
  assert.ok(srcs.includes("https://open.spotify.com/embed/track/abc"));
  assert.ok(srcs.includes("https://widget.deezer.com/widget/dark/album/12345"));
  // And the property is about FRAMES, never about outbound links: soundcloud
  // re-verifies its own host, so the forged row degrades to a link card that
  // links to the stored URL whatever its host — an anchor the reader chooses to
  // follow, not third-party code executing on the page.
  assert.ok(
    attrs(markup, "a", "href").includes("https://evil.test/artist/track"),
    "the forged soundcloud row should degrade to a link card, not vanish",
  );
});

test("a non-http URL renders a card with no anchor at all", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>1</script>", "not a url"]) {
    const markup = html([{ kind: "embed", provider: "link", url }]);
    assert.equal(/<a\b/.test(markup), false, `an anchor was rendered for ${url}`);
    assert.equal(markup.includes("href"), false, `an href was rendered for ${url}`);
  }

  // Non-vacuous: an http URL is still a link.
  const ok = html([{ kind: "embed", provider: "link", url: "https://example.com/a" }]);
  assert.deepEqual(attrs(ok, "a", "href"), ["https://example.com/a"]);
});

test("an image carries the author's alt, and an empty alt when there is none", () => {
  const described = html([
    { kind: "image", storageKey: "k1", url: "https://res.cloudinary.com/x/image/upload/v1/a.jpg", alt: "a hand-drawn map" },
  ]);
  assert.deepEqual(attrs(described, "img", "alt"), ["a hand-drawn map"]);

  const undescribed = html([
    { kind: "image", storageKey: "k2", url: "https://res.cloudinary.com/x/image/upload/v1/b.jpg" },
  ]);
  // alt="" is the CORRECT markup for an image nobody described — never a
  // fabricated sentence, and never a missing attribute (spec §5.4).
  assert.deepEqual(attrs(undescribed, "img", "alt"), [""]);
});

test("the link provider suppresses the badge; a named provider keeps it", () => {
  // `link` is a category name, not a destination: the hostname is the label.
  const plain = html([{ kind: "embed", provider: "link", url: "https://example.com/a" }]);
  assert.equal(textOf(plain), "example.com(opens in a new tab)");

  // figma never frames, so it reaches the same card — with its badge.
  const named = html([{ kind: "embed", provider: "figma", url: "https://www.figma.com/file/abc/Name" }]);
  assert.equal(textOf(named), "Figmafigma.com(opens in a new tab)");

  // An unknown provider falls back to its raw slug rather than to a guess.
  const unknown = html([{ kind: "embed", provider: "bandcamp", url: "https://x.bandcamp.com/album/a" }]);
  assert.equal(textOf(unknown), "bandcampx.bandcamp.com(opens in a new tab)");
});

test("an empty or absent list renders nothing at all", () => {
  assert.equal(html([]), "");
  assert.equal(html(undefined), "");
});
