import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import { stagingComponents } from "./markdown-components";
import { STAGING_FIXTURES } from "@/lib/staging-fixtures";

const render = (md: string, lang: "en" | "fr" = "en") =>
  renderToStaticMarkup(<Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={stagingComponents(lang)}>{md}</Markdown>);

test("a figure is a <figure> with a linked image and a figcaption", () => {
  const html = render(STAGING_FIXTURES.phoneFigure);
  assert.match(html, /^<figure class="[^"]*not-prose/);
  assert.match(html, /<a href="https:\/\/res\.cloudinary\.com\/[^"]+cactnyq3vvr5c3qiygp9\.png"/);
  assert.match(html, /<figcaption[^>]*>Scenes zoom in/);
  assert.doesNotMatch(html, /staged-/);
});

test("every staged image links to its original, so it is reachable script-off", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) {
    const html = render(md);
    const imgs = (html.match(/<img /g) ?? []).length;
    const links = (html.match(/<a href="https:\/\/res\.cloudinary\.com/g) ?? []).length;
    assert.equal(links, imgs, name);
  }
});

test("an SVG is drawn as <img>, untransformed; its dark twin is hidden by class", () => {
  const html = render(STAGING_FIXTURES.darkSvgFigure);
  assert.match(html, /<img src="https:\/\/res\.cloudinary\.com\/t5gexxs5\/image\/upload\/v1794700000\/beanstalk\/clock\.svg"/);
  assert.match(html, /class="dark:hidden"/);
  assert.match(html, /class="hidden dark:block"/);
  assert.doesNotMatch(html, /<svg/);
});

test("raster derivatives are sized from the size class", () => {
  assert.match(render(STAGING_FIXTURES.desktopFigureSmall), /w_480/); // s = 240 × 2
});

test("compare says its verdict in words, in the page's language", () => {
  assert.match(render(STAGING_FIXTURES.compare), />Do<\/p>[\s\S]*>Don&#x27;t<\/p>/);
  assert.match(render(STAGING_FIXTURES.compare, "fr"), />À faire<\/p>[\s\S]*>À éviter<\/p>/);
});

test("a callout is an aside named by its label", () => {
  const html = render(STAGING_FIXTURES.callout);
  assert.match(html, /^<aside aria-label="In two words: dithering"/);
  assert.match(render(STAGING_FIXTURES.unlabeledCallout), /^<aside class=/);
});

test("a quote is a figure: blockquote, then — by, role", () => {
  const html = render(STAGING_FIXTURES.quote);
  assert.match(html, /<figure[^>]*><span aria-hidden="true"[^>]*>“<\/span><blockquote[^>]*><p>The Spine/);
  assert.match(html, /<figcaption[^>]*>— Alexis, reviewing the feed explorations<\/figcaption>/);
});

test("a phone gallery uses PhoneFrame; a plain one shares a row height", () => {
  assert.match(render(STAGING_FIXTURES.phoneGallery), /rounded-\[1\.75rem\]/);
  assert.match(render(STAGING_FIXTURES.gallery), /max-h-56/);
});
