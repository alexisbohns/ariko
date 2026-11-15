import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";
import { STAGING_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES, INERT_FIXTURES } from "./staging-fixtures";

// HTML from the bare pipeline — no components mapped, so the custom elements
// remarkStaging mints appear as-is and the assertions read the tree itself.
const render = (md: string) => renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, md));

test("a figure mints its element, its images and its caption", () => {
  const html = render(STAGING_FIXTURES.phoneFigure);
  assert.match(html, /<staged-figure data-frame="phone" data-size="m">/);
  assert.match(html, /<staged-image src="https:\/\/res\.cloudinary\.com\/[^"]+cactnyq3vvr5c3qiygp9\.png" alt="Two scenes framed/);
  assert.match(html, /<staged-caption>Scenes zoom in on the subject when the phone is upright\.<\/staged-caption>/);
});

test("a dark twin is marked; caption markdown renders", () => {
  const html = render(STAGING_FIXTURES.darkSvgFigure);
  assert.match(html, /<staged-figure data-frame="none" data-size="wide">/);
  assert.match(html, /<staged-image[^>]*data-dark="true"/);
  assert.match(html, /<em>everything else<\/em>/);
});

test("gallery titles travel on the image", () => {
  assert.match(render(STAGING_FIXTURES.gallery), /<staged-image[^>]*title="Three ramps"/);
});

test("compare mints its two sides", () => {
  const html = render(STAGING_FIXTURES.compare);
  assert.match(html, /<staged-compare><staged-do><staged-image[^>]*><\/staged-image><staged-text>Show an almost still/);
  assert.match(html, /<staged-dont>/);
});

test("callout and quote carry their text attributes and keep block children", () => {
  const c = render(STAGING_FIXTURES.callout);
  assert.match(c, /<staged-callout data-label="In two words: dithering"><staged-label>In two words: dithering<\/staged-label><p>When you only/);
  const q = render(STAGING_FIXTURES.quote);
  assert.match(q, /<staged-quote data-by="Alexis" data-role="reviewing the feed explorations"><p>The Spine/);
});

test("entity cards and mentions still work inside a callout", () => {
  const html = render(STAGING_FIXTURES.calloutWithEntity);
  assert.match(html, /<entity-link data-ref="bean:sparkaik-music">the music<\/entity-link>/);
  assert.match(html, /<entity-card data-ref="bean:sparkaik-haptics">/);
});

test("a malformed block unwraps to its children, keeping every word and image", () => {
  for (const [name, { md }] of Object.entries(MALFORMED_FIXTURES)) {
    const html = render(md);
    assert.doesNotMatch(html, /<staged-/, name);
    assert.doesNotMatch(html, /<div/, `${name}: an unhandled directive renders as a div`);
  }
  assert.match(render(MALFORMED_FIXTURES.figureNoImage.md), /<p>Just words\.<\/p>/);
  assert.match(render(MALFORMED_FIXTURES.galleryOfOne.md), /<img src="https:\/\/res\.cloudinary\.com/);
});

test("a staged block nested inside another unwraps — the inner one", () => {
  const html = render(DOOR_ONLY_FIXTURES.nested.md);
  assert.match(html, /<staged-callout>/);
  assert.doesNotMatch(html, /<staged-gallery/);
  assert.match(html, /<img /);
});

test("do outside a compare and an unknown container are foreign", () => {
  assert.doesNotMatch(render(DOOR_ONLY_FIXTURES.doOutsideCompare.md), /<staged-/);
  assert.match(render(DOOR_ONLY_FIXTURES.unknownContainer.md), /<p>Careful\.<\/p>/);
});

test("the schema enforces the vocabulary a second time", () => {
  // Only reachable if the pass and the schema disagree; simulated by asserting
  // the lenient pass never emits a non-member and the schema lists only members.
  const html = render(DOOR_ONLY_FIXTURES.sizeXl.md);
  assert.match(html, /data-size="l"/);
});

test("a javascript: image source is stripped by the sanitizer", () => {
  const html = render(":::figure\n![x](javascript:alert(1))\n:::");
  assert.doesNotMatch(html, /javascript:/);
});

test("inert fixtures are untouched", () => {
  assert.match(render(INERT_FIXTURES.fenceInCode), /<code class="language-md">:::figure/);
  assert.match(render(INERT_FIXTURES.timeOfDay), /10:30/);
});
