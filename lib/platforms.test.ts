import { test } from "node:test";
import assert from "node:assert/strict";

import { detectPlatform, normalizeLinkUrl, normalizeLinks, platformLabel } from "./platforms";

/**
 * The one place a platform is decided, pinned at both ends.
 *
 * `detectPlatform` matters for the same reason `lib/embeds.ts`'s host matching
 * does: `platform` is what indexes PLATFORM_LABEL and what a renderer trusts,
 * so a substring match would let "instagram.com.evil.test" wear Instagram's
 * name on a public page.
 *
 * `normalizeLinkUrl` is not hygiene. The real Instagram URL this slice was
 * built from carried `stkn=…`, Instagram's PRIVATE-SHARE token; storing it puts
 * a credential-ish value in the database and then serves it to the world.
 */

test("detectPlatform reads the host, exactly", () => {
  assert.equal(detectPlatform("https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI"), "spotify");
  assert.equal(detectPlatform("https://podcasts.apple.com/fr/podcast/casa-podcast/id1878359919"), "apple-podcasts");
  assert.equal(detectPlatform("https://www.deezer.com/fr/show/1002670521"), "deezer");
  assert.equal(detectPlatform("https://podcast.ausha.co/casa-podcast"), "ausha");
  assert.equal(detectPlatform("https://www.instagram.com/casa.lepodcast"), "instagram");
  assert.equal(detectPlatform("https://linktr.ee/casa.lepodcast"), "linktree");
});

test("detectPlatform matches a host or its subdomain, never a substring", () => {
  // The whole point. Each of these contains a known host as a substring.
  assert.equal(detectPlatform("https://instagram.com.evil.test/p/ABCDE/"), "link");
  assert.equal(detectPlatform("https://spotify.com.attacker.test/show/x"), "link");
  assert.equal(detectPlatform("https://notlinktr.ee/casa"), "link");
  // A real subdomain still matches.
  assert.equal(detectPlatform("https://podcast.ausha.co/x"), "ausha");
});

test("detectPlatform never throws, and an unknown host is `link`", () => {
  assert.equal(detectPlatform("not a url at all"), "link");
  assert.equal(detectPlatform(""), "link");
  assert.equal(detectPlatform("https://example.test/thing"), "link");
});

test("normalizeLinkUrl strips the share tokens and nothing else", () => {
  assert.equal(
    normalizeLinkUrl("https://www.instagram.com/p/DVAxzXvDNkZ/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA=="),
    "https://www.instagram.com/p/DVAxzXvDNkZ/",
  );
  assert.equal(
    normalizeLinkUrl("https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT?nd=1&dlsi=cbd39d46b8ec47a2"),
    "https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT",
  );
  assert.equal(
    normalizeLinkUrl("https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI?si=3a3ee7415b6941ad"),
    "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI",
  );
  // Apple's `i` is the EPISODE ID — load-bearing, must survive.
  assert.equal(
    normalizeLinkUrl("https://podcasts.apple.com/fr/podcast/x/id1878359919?i=1000750486031&uo=4"),
    "https://podcasts.apple.com/fr/podcast/x/id1878359919?i=1000750486031&uo=4",
  );
  assert.equal(normalizeLinkUrl("https://example.test/a#frag"), "https://example.test/a");
  // Unparseable input comes back trimmed rather than throwing.
  assert.equal(normalizeLinkUrl("  nonsense  "), "nonsense");
});

test("normalizeLinks derives platform and cleans the url", () => {
  const out = normalizeLinks([
    { url: "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI?si=abc" },
    // A caller's declared platform is DISCARDED, never trusted.
    { url: "https://linktr.ee/casa.lepodcast", platform: "spotify" },
  ]);
  assert.deepEqual(out, [
    { url: "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI", platform: "spotify" },
    { url: "https://linktr.ee/casa.lepodcast", platform: "linktree" },
  ]);
});

test("normalizeLinks preserves a label and passes undefined through", () => {
  assert.equal(normalizeLinks(undefined), undefined);
  assert.deepEqual(normalizeLinks([{ url: "https://linktr.ee/x", label: { fr: "Tous les liens" } }]), [
    { url: "https://linktr.ee/x", label: { fr: "Tous les liens" }, platform: "linktree" },
  ]);
});

test("platformLabel is looked up, never derived", () => {
  assert.equal(platformLabel("apple-podcasts"), "Apple Podcasts");
  assert.equal(platformLabel("soundcloud"), "SoundCloud");
  // An unknown platform falls back to its raw slug rather than to a guess —
  // the same stance PROVIDER_LABEL takes in components/media.tsx.
  assert.equal(platformLabel("bandcamp"), "bandcamp");
});
