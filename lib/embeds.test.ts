import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed, hostMatches, HOST_PROVIDERS } from "./embeds";

test("detects youtube watch URLs and extracts the video id", () => {
  const e = detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(e.provider, "youtube");
  assert.equal(e.embedId, "dQw4w9WgXcQ");
});

test("detects youtu.be short URLs", () => {
  const e = detectEmbed("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(e.provider, "youtube");
  assert.equal(e.embedId, "dQw4w9WgXcQ");
});

test("detects vimeo and extracts the numeric id", () => {
  const e = detectEmbed("https://vimeo.com/123456789");
  assert.equal(e.provider, "vimeo");
  assert.equal(e.embedId, "123456789");
});

test("detects the remaining known providers by host", () => {
  assert.equal(detectEmbed("https://soundcloud.com/artist/track").provider, "soundcloud");
  assert.equal(detectEmbed("https://open.spotify.com/track/abc").provider, "spotify");
  assert.equal(detectEmbed("https://www.deezer.com/track/123").provider, "deezer");
  assert.equal(detectEmbed("https://podcast.ausha.co/show").provider, "ausha");
  assert.equal(detectEmbed("https://www.figma.com/file/abc").provider, "figma");
});

test("unknown hosts fall back to a generic link embed, preserving the url", () => {
  const e = detectEmbed("https://example.com/whatever");
  assert.equal(e.provider, "link");
  assert.equal(e.url, "https://example.com/whatever");
  assert.equal(e.kind, "embed");
});

test("a non-URL string is a generic link embed, never throws", () => {
  const e = detectEmbed("not a url");
  assert.equal(e.provider, "link");
  assert.equal(e.url, "not a url");
});

// The reason this slice pairs hardening with rendering: substring matching
// made every one of these detect as a real provider, and a provider is what
// decides whether something gets iframed.
test("a decoy host that merely CONTAINS a provider domain is not that provider", () => {
  assert.equal(detectEmbed("https://vimeo.com.evil.test/123").provider, "link");
  assert.equal(detectEmbed("https://evilvimeo.com/123").provider, "link");
  assert.equal(detectEmbed("https://notyoutu.be/abc").provider, "link");
  assert.equal(detectEmbed("https://youtube.com.attacker.example/watch?v=x").provider, "link");
  assert.equal(detectEmbed("https://spotify.com.evil.test/track/abc").provider, "link");
});

test("a decoy host yields no embedId either", () => {
  assert.equal(detectEmbed("https://vimeo.com.evil.test/123").embedId, undefined);
  assert.equal(detectEmbed("https://notyoutu.be/abc").embedId, undefined);
});

test("real subdomains and bare apexes both still match", () => {
  assert.equal(detectEmbed("https://vimeo.com/123").provider, "vimeo");
  assert.equal(detectEmbed("https://player.vimeo.com/video/123").provider, "vimeo");
  assert.equal(detectEmbed("https://m.youtube.com/watch?v=abc").provider, "youtube");
});

// vimeoId regexed the WHOLE url, so it could lift an id out of a query string
// and picked the wrong segment on a channel URL.
test("the vimeo id comes from a path segment, not from anywhere in the string", () => {
  assert.equal(detectEmbed("https://vimeo.com/123456").embedId, "123456");
  assert.equal(detectEmbed("https://vimeo.com/channels/staffpicks/123456").embedId, "123456");
  assert.equal(detectEmbed("https://vimeo.com/notanumber").embedId, undefined);
});

// Every Vimeo share form, because they disagree about where the id sits and a
// positional rule got this wrong twice.
test("the vimeo id is found in every share form", () => {
  const id = (u: string) => detectEmbed(u).embedId;
  assert.equal(id("https://vimeo.com/123456"), "123456", "bare");
  assert.equal(id("https://vimeo.com/channels/staffpicks/123456"), "123456", "channel slug");
  assert.equal(id("https://player.vimeo.com/video/123456"), "123456", "player");
  // Collection forms: the collection's id comes FIRST, the video's last.
  assert.equal(id("https://vimeo.com/showcase/999/video/123456"), "123456", "showcase");
  assert.equal(id("https://vimeo.com/groups/123/videos/456"), "456", "group");
  assert.equal(id("https://vimeo.com/album/999/video/123456"), "123456", "album");
  // Unlisted and review forms: the video's id comes FIRST, an all-digit hash last.
  assert.equal(id("https://vimeo.com/76979871/576845123"), "76979871", "unlisted private link");
  assert.equal(id("https://vimeo.com/user123/review/76979871/12345678"), "76979871", "review page");
  assert.equal(id("https://vimeo.com/notanumber"), undefined, "no id at all");
});

test("a youtu.be lookalike does not reach the short-URL id path", () => {
  // "youtu.be.evil.test/HIJACK" would have had its path read as the video id.
  assert.equal(detectEmbed("https://youtu.be.evil.test/HIJACK").provider, "link");
  assert.equal(detectEmbed("https://youtu.be.evil.test/HIJACK").embedId, undefined);
});

// youtubeId's `v` came from URLSearchParams.get, fully decoded and unchecked —
// once a later task builds youtube-nocookie.com/embed/{id}, an id shaped like
// a path could restructure that URL on a trusted host.
test("a malformed youtube id degrades to a link card rather than embedding raw text", () => {
  const wellFormed = detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(wellFormed.provider, "youtube");
  assert.equal(wellFormed.embedId, "dQw4w9WgXcQ");

  // Exactly 11 characters, so only the character class is under test here —
  // a length check alone would let these through.
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=abcdefgh/12").embedId, undefined);
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=abcdefgh%2312").embedId, undefined);
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=tooshort").embedId, undefined);
  assert.equal(
    detectEmbed("https://www.youtube.com/watch?v=wayyyytoolongforavalidid").embedId,
    undefined,
  );
  // Still a youtube embed — just without a usable id, same as a youtube URL
  // with no v= at all.
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=abcdefgh/12").provider, "youtube");
});

// A new entry that suffix-matches an existing one would silently shadow it,
// and hostMatches would report both as matching the same host. Cheap to pin,
// impossible to notice by eye once the table grows.
test("no configured host suffix-matches a different configured host", () => {
  for (const [a] of HOST_PROVIDERS) {
    for (const [b] of HOST_PROVIDERS) {
      if (a !== b) assert.equal(hostMatches(a, b), false, `${a} vs ${b}`);
    }
  }
});

test("hostMatches rejects an empty base rather than matching everything", () => {
  assert.equal(hostMatches("vimeo.com", ""), false);
});
