import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed } from "./embeds";

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
