import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed } from "./embeds";
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

// The CSP allowlist and this table must never drift — that is the whole reason
// EMBED_FRAME_HOSTS is exported from here rather than typed into next.config.ts.
test("every host embedSrc can emit is in EMBED_FRAME_HOSTS", () => {
  const urls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/123",
    "https://soundcloud.com/a/b",
    "https://open.spotify.com/track/abc",
    "https://www.deezer.com/en/track/123",
  ];
  for (const url of urls) {
    const frame = embedSrc(detectEmbed(url));
    assert.ok(frame, url);
    const origin = new URL(frame!.src).origin;
    assert.ok(
      (EMBED_FRAME_HOSTS as readonly string[]).includes(origin),
      `${origin} is framed but missing from EMBED_FRAME_HOSTS`,
    );
  }
});

test("every allowlisted host is actually reachable by some provider", () => {
  // The mirror of the test above: an entry nothing can emit is an allowlist
  // that grew stale, which is a CSP that permits more than it needs to.
  const emitted = new Set(
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://vimeo.com/123",
      "https://soundcloud.com/a/b",
      "https://open.spotify.com/track/abc",
      "https://www.deezer.com/en/track/123",
    ].map((u) => new URL(embedSrc(detectEmbed(u))!.src).origin),
  );
  for (const host of EMBED_FRAME_HOSTS) {
    assert.ok(emitted.has(host), `${host} is allowlisted but nothing emits it`);
  }
});
