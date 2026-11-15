import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { parseStagedBlock, type MdNode } from "./staging-parse";
import { STAGING_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES, NONCANONICAL_FIXTURES } from "./staging-fixtures";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const first = (md: string): MdNode => {
  const root = parser.parse(md) as unknown as MdNode;
  const node = (root.children ?? []).find((n) => n.type === "containerDirective");
  assert.ok(node, "fixture has a container");
  return node;
};
const parse = (md: string, strict = false) => parseStagedBlock(first(md), md, { strict });

test("every valid fixture parses, leniently and strictly", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) {
    assert.equal(parse(md).ok, true, `${name} (lenient)`);
    assert.equal(parse(md, true).ok, true, `${name} (strict)`);
  }
});

test("a phone figure: frame, default size, one image, caption source verbatim", () => {
  const r = parse(STAGING_FIXTURES.phoneFigure);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.frame, "phone");
  assert.equal(r.value.size, "m");
  assert.match(r.value.image.alt, /^Two scenes framed/);
  assert.equal(r.value.dark, null);
  assert.equal(r.value.caption?.source, "Scenes zoom in on the subject when the phone is upright.");
});

test("a dark figure takes its second image as the twin; markdown in the caption survives as source", () => {
  const r = parse(STAGING_FIXTURES.darkSvgFigure);
  assert.ok(r.ok && r.value.block === "figure");
  assert.match(r.value.dark!.src, /clock-dark\.svg$/);
  assert.equal(r.value.caption?.source, "The audio clock is the reference; *everything else* locks onto it.");
});

test("a gallery keeps each title as its image's caption, and its own caption after", () => {
  const r = parse(STAGING_FIXTURES.gallery);
  assert.ok(r.ok && r.value.block === "gallery");
  assert.deepEqual(r.value.images.map((i) => i.title), ["Classic", "Three ramps", "Four tints"]);
  assert.equal(r.value.caption?.source, "One moon, drawn four ways.");
});

test("a compare holds do then dont, each with an optional image and its text", () => {
  const r = parse(STAGING_FIXTURES.compare);
  assert.ok(r.ok && r.value.block === "compare");
  assert.ok(r.value.do.image && r.value.dont.image);
  assert.equal(r.value.do.text.source, "Show an almost still picture and drop the events.");
  const t = parse(STAGING_FIXTURES.textOnlyCompare);
  assert.ok(t.ok && t.value.block === "compare");
  assert.equal(t.value.do.image, null);
});

test("a callout's label is source and plain text; its body is the rest", () => {
  const r = parse(STAGING_FIXTURES.callout);
  assert.ok(r.ok && r.value.block === "callout");
  assert.equal(r.value.label?.source, "In two words: dithering");
  assert.equal(r.value.labelText, "In two words: dithering");
  assert.equal(r.value.body.length, 1);
  const u = parse(STAGING_FIXTURES.unlabeledCallout);
  assert.ok(u.ok && u.value.block === "callout");
  assert.equal(u.value.label, null);
});

test("a quote's by is required and its role optional", () => {
  const r = parse(STAGING_FIXTURES.quote);
  assert.ok(r.ok && r.value.block === "quote");
  assert.equal(r.value.by, "Alexis");
  assert.equal(r.value.role, "reviewing the feed explorations");
});

test("malformed blocks are refused in both modes, with the door's words", () => {
  for (const [name, { md, problem }] of Object.entries(MALFORMED_FIXTURES)) {
    for (const strict of [false, true]) {
      const r = parse(md, strict);
      assert.equal(r.ok, false, `${name} strict=${strict}`);
      if (!r.ok) assert.match(r.problem, problem, name);
    }
  }
});

test("lenient mode defaults unknown values; strict mode refuses them by name", () => {
  for (const name of ["sizeXl", "frameTablet", "unknownAttr", "classShorthand"] as const) {
    const { md, problem } = DOOR_ONLY_FIXTURES[name];
    assert.equal(parse(md).ok, true, `${name} lenient`);
    const r = parse(md, true);
    assert.equal(r.ok, false, `${name} strict`);
    if (!r.ok) assert.match(r.problem, problem);
  }
  const r = parse(NONCANONICAL_FIXTURES.unknownValues);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.frame, "none");
  assert.equal(r.value.size, "l");
});

test("a caption in its own paragraph is still the caption", () => {
  const r = parse(NONCANONICAL_FIXTURES.captionOnOwnParagraph);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.caption?.source, "A caption after a blank line.");
});

test("a name that is not a block is not this function's", () => {
  const r = parse(DOOR_ONLY_FIXTURES.unknownContainer.md);
  assert.equal(r.ok, false);
});

test("a figure's image title is not its caption: strict refuses it, lenient ignores it", () => {
  const md = `:::figure\n![a](https://e.com/a.png "A title")\n:::`;
  const r = parse(md, true);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.problem, /figure: an image title is not a caption — write the caption on its own line/);
  const l = parse(md);
  assert.ok(l.ok && l.value.block === "figure");
  assert.equal(l.value.caption, null);
});

test("a stray image between compare's sides is refused, not dropped", () => {
  const md = `::::compare\n![](https://e.com/a.png)\n:::do\nYes.\n:::\n:::dont\nNo.\n:::\n::::`;
  for (const strict of [false, true]) {
    const r = parse(md, strict);
    assert.equal(r.ok, false, `strict=${strict}`);
    if (!r.ok) assert.match(r.problem, /compare: needs one :::do and one :::dont/);
  }
});

// A misplaced label is SHAPE, not vocabulary: there is nowhere in a figure,
// gallery, quote or side to draw it, so a lenient parse that accepted the
// block dropped the author's words from the page. Refused, the block unwraps
// and the label renders as the paragraph it is.
test("a [label] anywhere but a callout is refused in both modes, by name", () => {
  const cases: Array<[string, RegExp]> = [
    [DOOR_ONLY_FIXTURES.labelOnFigure.md, DOOR_ONLY_FIXTURES.labelOnFigure.problem],
    [`:::gallery[Label]\n![a](https://e.com/a.png)\n![b](https://e.com/b.png)\n:::`, /gallery takes no \[label\]/],
    [`:::quote[Label]{by=Alexis}\nq\n:::`, /quote takes no \[label\]/],
    [`::::compare\n:::do[Yes]\nYes.\n:::\n:::dont\nNo.\n:::\n::::`, /compare: do takes no \[label\]/],
    [`::::compare\n:::do\nYes.\n:::\n:::dont[No]\nNo.\n:::\n::::`, /compare: dont takes no \[label\]/],
  ];
  for (const [md, problem] of cases) {
    for (const strict of [false, true]) {
      const r = parse(md, strict);
      assert.equal(r.ok, false, `${md} strict=${strict}`);
      if (!r.ok) assert.match(r.problem, problem, md);
    }
  }
});

test("a callout's label text keeps what remark-directive split at a colon", () => {
  for (const [label, text] of [["Rule 1:2", "Rule 1:2"], ["at 10:30 a:b", "at 10:30 a:b"], ["At 10:30, a rule", "At 10:30, a rule"]]) {
    const r = parse(`:::callout[${label}]\nBody.\n:::`);
    assert.ok(r.ok && r.value.block === "callout", label);
    assert.equal(r.value.labelText, text);
  }
});
