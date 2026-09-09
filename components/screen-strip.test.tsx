import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenStrip } from "./screen-strip";
import type { ExhibitionRow } from "@/lib/exhibition";

/**
 * renderToStaticMarkup, no jsdom — components/bean-cover.test.tsx's route, and
 * for its reason: the strip is a server component and the static markup IS its
 * output. It is also exactly what PR 2's island must add nothing to.
 */
const row = (slug: string, legend = ""): ExhibitionRow => ({
  slug,
  name: `${slug} name`,
  legend,
  image: {
    kind: "image",
    storageKey: `k/${slug}`,
    url: `https://res.cloudinary.com/demo/image/upload/v1/${slug}.png`,
    width: 1179,
    height: 2556,
  },
});

const html = (rows: ExhibitionRow[]) =>
  renderToStaticMarkup(<ScreenStrip rows={rows} plantName="Paulopus" />);

test("an empty exhibition renders nothing at all", () => {
  // Not an empty <section>: the plant page's `gap-8` would put 32px on both
  // sides of it, which is the bug the platform-links guard on that page
  // already documents.
  assert.equal(html([]), "");
});

test("every screen is a REAL anchor to the full image", () => {
  // The whole of PR 2's admissibility: the island intercepts a link that
  // already works, so its absence costs nothing. If this ever becomes a
  // <button>, the lightbox stops being an enhancement.
  const markup = html([row("one"), row("two")]);
  assert.match(markup, /<a[^>]+href="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v1\/one\.png"/);
  assert.match(markup, /<a[^>]+href="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v1\/two\.png"/);
});

test("the href is the FULL image, never a derivative", () => {
  const markup = html([row("one")]);
  assert.doesNotMatch(markup, /href="[^"]*w_\d+/);
});

test("the legend is always in the markup, never hover-only", () => {
  const markup = html([row("one", "The match hero, at full time")]);
  assert.match(markup, /The match hero, at full time/);
});

test("a screen with no legend falls back to its name, never to a blank caption", () => {
  // A legend is optional and most screens have none — lib/data.ts: "a hundred
  // and seventy captions nobody asked for would be worse than none". An empty
  // caption box under every phone would be the visible cost of that decision.
  const markup = html([row("one")]);
  assert.match(markup, /one name/);
  assert.doesNotMatch(markup, /<figcaption[^>]*><\/figcaption>/);
});

test("the strip is keyboard-reachable and names itself", () => {
  // tabIndex is what makes the arrow keys true: a scroll container is not
  // focusable by default, so without it every slide past the first is
  // unreachable to anyone not using a pointer. components/media.tsx's Gallery
  // carries the same pair for the same reason.
  const markup = html([row("one"), row("two")]);
  assert.match(markup, /tabindex="0"/i);
  assert.match(markup, /aria-label="[^"]*Paulopus[^"]*"/);
});

test("the phones ask Cloudinary for a derivative that is NOT cropped", () => {
  // `c_limit` and no `h_`: the shot keeps its own ratio. A `c_fill` here —
  // which is what this strip did while its phones sat in a 3:4 window — imposes
  // one device's proportions on every capture in the exhibition, and the part
  // it cuts is gone from the page rather than merely hidden.
  const markup = html([row("one")]);
  assert.match(markup, /w_400,c_limit,q_auto,f_auto/);
  assert.doesNotMatch(markup, /c_fill/);
});

test("the bezel is a BLOCK — an inline one collapses to a tick", () => {
  // PhoneFrame's wrapper is a <span> so it can live inside an anchor. Inline,
  // it shrink-wraps to the line rather than to the image it pads, and the phone
  // loses its bezel entirely — which is exactly what happened the moment this
  // strip stopped pinning the phone with `absolute`.
  const markup = html([row("one")]);
  assert.match(markup, /class="block rounded-2xl bg-neutral-900/);
});

test("the track breaks out of the reading column, gutter re-applied inside", () => {
  // The landing row's rule: a scroller clipped at the text margin reads as a
  // broken layout. The plant page renders inside READING_COLUMN, so the track
  // spans the viewport and puts the column's own gutter back on its content.
  const markup = html([row("one"), row("two")]);
  assert.match(markup, /w-screen/);
  assert.match(markup, /-translate-x-1\/2/);
  assert.match(markup, /px-6/);
});

test("a screen's stored alt text is rendered — the strip's opposite answer to the cover's", () => {
  // components/bean-cover.tsx passes alt="" because its phone is decorative;
  // here the screen IS the content, so PhoneFrame's `alt` prop carries the
  // image's own stored description instead. Pinned in both files so the two
  // opposite answers can't silently collapse to one again.
  const withAlt: ExhibitionRow = {
    ...row("one"),
    image: { ...row("one").image, alt: "A dashboard showing quarterly revenue" },
  };
  const markup = html([withAlt]);
  assert.match(markup, /alt="A dashboard showing quarterly revenue"/);
});
