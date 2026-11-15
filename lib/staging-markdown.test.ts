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
  // The label is SOURCE (ParsedBlock's label.source), so it is written as given.
  assert.equal(calloutOpener("a \\[b\\]"), ":::callout[a \\[b\\]]");
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

const figureWith = (caption: string) =>
  serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "a", darkSrc: "", darkAlt: "", caption });
const captionLine = (md: string) => md.split("\n").slice(-2)[0];
const plain = (nodes: MdNode[]): string => nodes.map((n) => (typeof n.value === "string" ? n.value : plain(n.children ?? []))).join("");

test("a caption line that would start or interrupt a block is escaped, and reads back as its words", () => {
  for (const line of ["===", "___", "```js", "~~~", "<div>hi</div>", "- x", "2. second", ":::", "# x", "> x", "| a |", "|---|", ":::figure", "1) one"]) {
    const md = figureWith(line);
    const v = parsed(md);
    assert.ok(v.block === "figure", line);
    assert.equal(plain(v.caption!.nodes), line, `${line} -> ${captionLine(md)}`);
    assert.equal(figureWith(v.caption!.source), md, `${line} is stable`);
  }
  assert.equal(captionLine(figureWith("2. second")), "2\\. second");
});

test("a caption's markdown is source, written verbatim", () => {
  for (const line of ["*Em* phasis", "_under_ score", "`code` first", "[a link](https://e.com)", "**bold**", "!important", "1999 was a year", "+1 for this"]) {
    assert.equal(captionLine(figureWith(line)), line);
  }
});

test("a compare side's text is escaped by the same rule, where it starts its container", () => {
  const md = serializeCompare({ do: { src: "", alt: "", text: "2. two" }, dont: { src: "", alt: "", text: "*fine*" } });
  assert.match(md, /:::do\n2\\\. two\n:::/);
  assert.match(md, /:::dont\n\*fine\*\n:::/);
  const v = parsed(md);
  assert.ok(v.block === "compare");
  assert.equal(plain(v.do.text.nodes), "2. two");
});

test("hard breaks in a caption become spaces", () => {
  assert.equal(captionLine(figureWith("one\\\ntwo")), "one two");
  assert.equal(captionLine(figureWith("one  \ntwo")), "one two");
  const v = parsed(":::figure\n![a](https://e.com/a.png)\nline one\\\nline two\n:::");
  assert.ok(v.block === "figure");
  assert.equal(captionLine(serializeFigure(figureFields(v))), "line one line two");
});

test("alt text is plain text: parse, serialize, parse is stable", () => {
  for (const src of ["![a \\*b\\* c](https://e.com/u.png)", "![a `b` c](https://e.com/u.png)", "![AT&amp;T](https://e.com/u.png)", "![x :entity[y] _z_ <b> ~~s~~](https://e.com/u.png)"]) {
    const md = `:::figure\n${src}\n:::`;
    const once = parsed(md);
    assert.ok(once.block === "figure");
    const again = serializeFigure(figureFields(once));
    const twice = parsed(again);
    assert.ok(twice.block === "figure");
    assert.equal(twice.image.alt, once.image.alt, src);
    assert.equal(serializeFigure(figureFields(twice)), again, `${src} serializes stably`);
  }
  const all = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ end";
  const v = parsed(serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: all, darkSrc: "", darkAlt: "", caption: "" }));
  assert.ok(v.block === "figure");
  assert.equal(v.image.alt, all);
});

test("a backslash in a URL is percent-encoded", () => {
  const md = serializeFigure({ frame: "none", size: "l", src: "https://e.com/a\\b.png", alt: "", darkSrc: "", darkAlt: "", caption: "" });
  assert.match(md, /\(https:\/\/e\.com\/a%5Cb\.png\)/);
});

test("a callout label round-trips as source", () => {
  for (const opener of [":::callout[a \\[b\\]]", ":::callout[*In* two]"]) {
    const v = parsed(`${opener}\nbody\n:::`);
    assert.ok(v.block === "callout");
    assert.equal(calloutOpener(v.label!.source), opener);
  }
});

test("a compare with an image but no text is still written — the popover's Save guards validity", () => {
  const md = serializeCompare({ do: { src: "https://e.com/a.png", alt: "a", text: "" }, dont: { src: "", alt: "", text: "" } });
  assert.notEqual(md, "");
  assert.match(md, /:::do\n!\[a\]\(https:\/\/e\.com\/a\.png\)\n:::/);
});

test("a colon before any non-space is escaped in alt, so no text directive eats it", () => {
  for (const alt of ["ratio 16:9", "x:1y", "caf:é", "time 10:30"]) {
    const md = serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt, darkSrc: "", darkAlt: "", caption: "" });
    const once = parsed(md);
    assert.ok(once.block === "figure");
    assert.equal(once.image.alt, alt, md);
    assert.equal(serializeFigure(figureFields(once)), md, `${alt} is stable`);
  }
});

test("a parsed callout label is written back as it came", () => {
  const v = parsed(STAGING_FIXTURES.labelWithTime);
  assert.ok(v.block === "callout");
  assert.equal(calloutOpener(v.label!.source), STAGING_FIXTURES.labelWithTime.split("\n")[0]);
});
