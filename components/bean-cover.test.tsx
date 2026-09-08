import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { BeanCover } from "./bean-cover";
import type { BeanCover as BeanCoverValue } from "@/lib/bean-cover";
import type { Lang } from "@/lib/locale";
import type { MediaImage } from "@/lib/data";

/**
 * renderToStaticMarkup, no jsdom — the route components/media.test.tsx and
 * components/link-row.test.tsx already take, and for the same reason: this
 * component is server-only by design and the static markup IS its output.
 */
const img = (key: string, size?: { width: number; height: number }): MediaImage => ({
  kind: "image",
  storageKey: key,
  url: `https://res.cloudinary.com/demo/image/upload/v1/${key}.png`,
  ...(size ?? {}),
});

const html = (cover: BeanCoverValue | null, lang: Lang = "en") =>
  renderToStaticMarkup(<BeanCover cover={cover} lang={lang} />);

const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("no cover renders nothing at all", () => {
  assert.equal(html(null), "");
});

test("a fill cover is one image at the 448x336 derivative", () => {
  const markup = html({ kind: "fill", image: img("wide") });
  assert.match(markup, /w_448,h_336,c_fill,q_auto,f_auto/);
  // A class-string assertion, and a deliberate exception to "don't assert
  // Tailwind class strings": object-cover is what makes this a FILL cover
  // rather than a letterboxed one — dropping it changes what the visitor
  // sees, so it is behaviour, not styling. It is not blanket permission to
  // assert the hover/transition classes alongside it.
  assert.match(markup, /object-cover/);
  assert.equal(text(markup), "");
});

test("a phone cover asks for the TALL derivative, not the square one", () => {
  // The phone box is 112x242 CSS px; 224x484 is that doubled for a retina
  // display. Asking for the 448x336 fill derivative here would deliver a
  // landscape crop of a portrait screenshot.
  const markup = html({ kind: "phone", image: img("shot", { width: 390, height: 844 }) });
  assert.match(markup, /w_224,h_484,c_fill,q_auto,f_auto/);
  assert.doesNotMatch(markup, /w_448/);
  // Attributes, not class strings, so the "don't assert Tailwind classes"
  // rule doesn't cover them — and the landing page renders a whole row of
  // these, so an un-pinned loading/decoding pair is real payload weight, not
  // styling.
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /decoding="async"/);
});

test("the keyword is rendered, and hidden from the accessibility tree", () => {
  const markup = html({
    kind: "phone",
    image: img("shot", { width: 390, height: 844 }),
    keyword: "Timeline",
  });
  assert.match(markup, /aria-hidden="true"/);
  assert.equal(text(markup), "Timeline");
});

test("the keyword resolves per language", () => {
  const cover: BeanCoverValue = {
    kind: "phone",
    image: img("shot", { width: 390, height: 844 }),
    keyword: { en: "Accuracy", fr: "Justesse" },
  };
  assert.equal(text(html(cover, "fr")), "Justesse");
  assert.equal(text(html(cover, "en")), "Accuracy");
});

test("a wordless phone renders the bezel and no empty word box", () => {
  const markup = html({ kind: "phone", image: img("shot", { width: 390, height: 844 }) });
  assert.doesNotMatch(markup, /aria-hidden/);
  assert.match(markup, /w_224,h_484/);
});

test("a keyword that resolves to whitespace is the WORDLESS phone", () => {
  // The resolver is lang-agnostic by design (lib/bean-cover.ts's BeanCover doc
  // says so): it hands over whatever Text the bean stores, so "has a word" is a
  // question only this component can answer, and only after resolving. A French
  // keyword with a blank English half must render the bezel alone rather than
  // an empty 34px box holding up the top of the frame.
  const markup = html(
    {
      kind: "phone",
      image: img("shot", { width: 390, height: 844 }),
      keyword: { en: "   ", fr: "Karma" },
    },
    "en",
  );
  assert.doesNotMatch(markup, /aria-hidden/);
  assert.equal(text(markup), "");
  assert.match(markup, /w_224,h_484/);
});

test("every image is decorative — the bean's name carries the accessible name", () => {
  for (const cover of [
    { kind: "fill", image: img("wide") } as const,
    { kind: "phone", image: img("shot", { width: 390, height: 844 }), keyword: "Timeline" } as const,
  ]) {
    assert.match(html(cover), /alt=""/);
  }
});
