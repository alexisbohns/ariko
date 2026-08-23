import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed, HOST_PROVIDERS } from "./embeds";
import { EMBED_FRAME_HOSTS, embedSrc } from "./embed-src";

const frameFor = (url: string) => embedSrc(detectEmbed(url));

test("youtube frames on the no-cookie host, by id", () => {
  const f = frameFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.ok(f);
  assert.equal(f!.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(f!.aspect, "video");
});

test("vimeo frames on the player host, by id", () => {
  const f = frameFor("https://vimeo.com/123456789");
  assert.equal(f!.src, "https://player.vimeo.com/video/123456789");
  assert.equal(f!.aspect, "video");
});

test("soundcloud frames by handing the widget the share url", () => {
  const f = frameFor("https://soundcloud.com/artist/track");
  assert.equal(
    f!.src,
    "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack",
  );
  assert.equal(f!.aspect, "audio");
});

test("spotify frames from its validated path", () => {
  assert.equal(
    frameFor("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")!.src,
    "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
  );
  assert.equal(
    frameFor("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3")!.src,
    "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3",
  );
});

test("deezer frames from its validated path", () => {
  assert.equal(
    frameFor("https://www.deezer.com/en/track/3135556")!.src,
    "https://widget.deezer.com/widget/dark/track/3135556",
  );
});

test("a spotify url whose path is not a known type does not frame", () => {
  assert.equal(frameFor("https://open.spotify.com/user/someone"), null);
  assert.equal(frameFor("https://open.spotify.com/"), null);
});

test("a deezer url with a non-numeric id does not frame", () => {
  assert.equal(frameFor("https://www.deezer.com/en/track/abc"), null);
});

// Spec §5.2 — link cards on stated evidence, not oversight.
test("ausha and figma render as link cards for now", () => {
  assert.equal(frameFor("https://podcast.ausha.co/show/episode"), null);
  assert.equal(frameFor("https://www.figma.com/file/abc/Design"), null);
});

test("a link-provider embed never frames", () => {
  assert.equal(frameFor("https://example.com/whatever"), null);
  assert.equal(frameFor("not a url"), null);
});

test("a decoy host never frames — the whole point of the hardening", () => {
  assert.equal(frameFor("https://vimeo.com.evil.test/123"), null);
  assert.equal(frameFor("https://youtu.be.evil.test/HIJACK"), null);
});

test("a provider with no extractable id does not frame", () => {
  assert.equal(frameFor("https://www.youtube.com/results?search_query=x"), null);
});

// SoundCloud is the only provider whose URL is passed to a third party
// verbatim, so it re-checks the host itself rather than trusting `provider`
// alone. This is unreachable while lib/embeds.ts and lib/inbox.ts hold, which
// is precisely why it should not silently rot.
test("a soundcloud-labelled embed with a foreign url does not frame", () => {
  assert.equal(
    embedSrc({ kind: "embed", provider: "soundcloud", url: "https://evil.test/x" }),
    null,
  );
  assert.equal(
    embedSrc({ kind: "embed", provider: "soundcloud", url: "not a url" }),
    null,
  );
  // A real one still frames, including a subdomain.
  assert.ok(
    embedSrc({ kind: "embed", provider: "soundcloud", url: "https://m.soundcloud.com/a/b" }),
  );
});

// D — the frame box follows the provider's own widget, so the type has to
// survive the derivation rather than being thrown away after building the src.
test("spotify and deezer size the box by type, not by being audio", () => {
  assert.equal(frameFor("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")!.aspect, "audio");
  assert.equal(frameFor("https://open.spotify.com/episode/0eGsygTp906u18L0Oimnem")!.aspect, "audio");
  assert.equal(frameFor("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3")!.aspect, "audio-list");
  assert.equal(frameFor("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")!.aspect, "audio-list");
  assert.equal(frameFor("https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk")!.aspect, "audio-list");
  assert.equal(frameFor("https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF")!.aspect, "audio-list");

  assert.equal(frameFor("https://www.deezer.com/en/track/3135556")!.aspect, "audio");
  assert.equal(frameFor("https://www.deezer.com/en/episode/5678")!.aspect, "audio");
  assert.equal(frameFor("https://www.deezer.com/en/album/302127")!.aspect, "audio-list");
  assert.equal(frameFor("https://www.deezer.com/en/playlist/1479458365")!.aspect, "audio-list");
});

test("a soundcloud set gets the tracklist box, a track the single-player one", () => {
  assert.equal(frameFor("https://soundcloud.com/artist/sets/an-album")!.aspect, "audio-list");
  // A private set link keeps the /sets/ segment.
  assert.equal(frameFor("https://soundcloud.com/artist/sets/an-album/s-secret")!.aspect, "audio-list");
  assert.equal(frameFor("https://soundcloud.com/artist/a-track")!.aspect, "audio");
  // Unknowable without a network call this file will not make: short links get
  // the single-player box.
  assert.equal(frameFor("https://on.soundcloud.com/abc123")!.aspect, "audio");
});

test("video providers stay 16:9", () => {
  assert.equal(frameFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")!.aspect, "video");
  assert.equal(frameFor("https://vimeo.com/123456789")!.aspect, "video");
});

// B — an id is bounded because an unbounded one serves a 10KB iframe attribute
// and a guaranteed-404 player. Origin safety never depended on the bound.
test("an absurdly long id does not frame", () => {
  assert.equal(frameFor(`https://open.spotify.com/track/${"a".repeat(10_000)}`), null);
  assert.equal(frameFor(`https://www.deezer.com/en/track/${"1".repeat(10_000)}`), null);
  // The real shapes still frame: 22 base62 chars, and a 10-digit Deezer id.
  assert.ok(frameFor("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"));
  assert.ok(frameFor("https://www.deezer.com/en/playlist/1479458365"));
});

// One probe URL per detectable provider. `null` means "link card, by decision"
// — ausha and figma are deliberate (spec §5.2), not omissions.
//
// Driven off HOST_PROVIDERS rather than a hand-written list because the
// hand-written version was blind to the failure that matters: adding a provider
// that emits a NEW host, and never adding that host to EMBED_FRAME_HOSTS. The
// CSP would then block the frame and a public page would show a blank box —
// fail-closed, but precisely the bug these tests exist to prevent, and they
// passed 14/14 with it present.
const PROBE: Record<string, string | null> = {
  youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  vimeo: "https://vimeo.com/123",
  soundcloud: "https://soundcloud.com/a/b",
  spotify: "https://open.spotify.com/track/abc",
  deezer: "https://www.deezer.com/en/track/123",
  ausha: null,
  figma: null,
};

test("every detectable provider has a probe url", () => {
  for (const [, provider] of HOST_PROVIDERS) {
    assert.ok(provider in PROBE, `${provider} has no probe URL in this test`);
  }
});

// Every origin the probe corpus can actually reach. Providers marked null are
// link cards by decision and are covered by their own test above.
function framedOrigins(): Set<string> {
  const out = new Set<string>();
  for (const [provider, url] of Object.entries(PROBE)) {
    if (url === null) continue;
    const frame = embedSrc(detectEmbed(url));
    assert.ok(frame, `${provider}: ${url} should frame`);
    out.add(new URL(frame!.src).origin);
  }
  return out;
}

// The CSP allowlist and this table must never drift — that is the whole reason
// EMBED_FRAME_HOSTS is exported from here rather than typed into next.config.ts.
test("every host embedSrc can emit is in EMBED_FRAME_HOSTS", () => {
  for (const origin of framedOrigins()) {
    assert.ok(
      (EMBED_FRAME_HOSTS as readonly string[]).includes(origin),
      `${origin} is framed but missing from EMBED_FRAME_HOSTS`,
    );
  }
});

test("every allowlisted host is actually reachable by some provider", () => {
  // The mirror of the test above: an entry nothing can emit is an allowlist
  // that grew stale, which is a CSP that permits more than it needs to.
  const emitted = framedOrigins();
  for (const host of EMBED_FRAME_HOSTS) {
    assert.ok(emitted.has(host), `${host} is allowlisted but nothing emits it`);
  }
});
