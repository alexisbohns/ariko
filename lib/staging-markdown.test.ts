import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { parseStagedBlock, type MdNode, type ParsedBlock } from "./staging-parse";
import {
  serializeFigure, serializeGallery, serializeCompare, calloutOpener, quoteOpener,
  figureFields, galleryFields, compareFields,
} from "./staging-markdown";
import { STAGING_FIXTURES } from "./staging-fixtures";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const parsed = (md: string): ParsedBlock => {
  const node = ((parser.parse(md) as unknown as MdNode).children ?? [])[0];
  const r = parseStagedBlock(node, md, { strict: false });
  assert.ok(r.ok, md);
  return r.value;
};

test("media fixtures are canonical: serialize(fields(parse(x))) === x", () => {
  for (const name of ["phoneFigure", "desktopFigureSmall", "darkSvgFigure"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "figure");
    assert.equal(serializeFigure(figureFields(v)), STAGING_FIXTURES[name], name);
  }
  for (const name of ["gallery", "phoneGallery"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "gallery");
    assert.equal(serializeGallery(galleryFields(v)), STAGING_FIXTURES[name], name);
  }
  for (const name of ["compare", "textOnlyCompare"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "compare");
    assert.equal(serializeCompare(compareFields(v)), STAGING_FIXTURES[name], name);
  }
});

test("no image, no markdown — the EntityCard rule", () => {
  assert.equal(serializeFigure({ frame: "none", size: "l", src: "", alt: "", darkSrc: "", darkAlt: "", caption: "x" }), "");
  assert.equal(serializeGallery({ frame: "none", images: [], caption: "" }), "");
  assert.equal(serializeCompare({ do: { src: "", alt: "", text: "" }, dont: { src: "", alt: "", text: "" } }), "");
});

test("a gallery left with one image becomes a figure rather than losing it", () => {
  const md = serializeGallery({ frame: "phone", images: [{ src: "https://e.com/a.png", alt: "A", title: "Lake" }], caption: "Night" });
  assert.equal(md, ":::figure{frame=phone}\n![A](https://e.com/a.png)\nLake — Night\n:::");
});

test("escaping: alt brackets, title quotes, URL spaces and parens, block-starting captions", () => {
  const md = serializeFigure({
    frame: "none", size: "l", src: "https://e.com/a b(1).png", alt: "a [b] c", darkSrc: "", darkAlt: "", caption: "- not a list",
  });
  assert.equal(md, ":::figure\n![a \\[b\\] c](https://e.com/a%20b%281%29.png)\n\\- not a list\n:::");
  const g = serializeGallery({ frame: "none", images: [
    { src: "https://e.com/a.png", alt: "a", title: 'say "hi"' },
    { src: "https://e.com/b.png", alt: "b", title: "" },
  ], caption: "" });
  assert.match(g, /!\[a\]\(https:\/\/e\.com\/a\.png "say \\"hi\\""\)/);
  assert.equal(serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "", darkSrc: "", darkAlt: "", caption: ":::" }),
    ":::figure\n![](https://e.com/a.png)\n\\:::\n:::");
  assert.match(serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "", darkSrc: "", darkAlt: "", caption: "2. second" }), /\n2\\\. second\n/);
});

test("captions are one line", () => {
  const md = serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "x", darkSrc: "", darkAlt: "", caption: "one\n two " });
  assert.match(md, /\none two\n:::$/);
});

test("openers: label escaping, bare and quoted attribute values", () => {
  assert.equal(calloutOpener(null), ":::callout");
  assert.equal(calloutOpener("In two words: dithering"), ":::callout[In two words: dithering]");
  assert.equal(calloutOpener("a [b]"), ":::callout[a \\[b\\]]");
  assert.equal(quoteOpener("Alexis", null), ":::quote{by=Alexis}");
  assert.equal(quoteOpener("Alexis B", 'said "so" & left'), ':::quote{by="Alexis B" role="said &quot;so&quot; &amp; left"}');
});

test("an escaped value parses back to itself", () => {
  const md = `${quoteOpener("Alexis B", 'said "so" & left')}\nq\n:::`;
  const v = parsed(md);
  assert.ok(v.block === "quote");
  assert.equal(v.by, "Alexis B");
  assert.equal(v.role, 'said "so" & left');
});
