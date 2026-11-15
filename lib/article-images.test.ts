import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryCloudName, imageProblems, markdownImages } from "./article-images";

test("markdownImages lists inline image URLs, in order", () => {
  const md = "Intro\n\n![a](https://x.test/1.png)\n\nText ![b](https://x.test/2.png \"t\")";
  assert.deepEqual(markdownImages(md), { urls: ["https://x.test/1.png", "https://x.test/2.png"], references: 0, svgOutsideFigure: [] });
});

test("markdownImages counts reference-style images instead of resolving them", () => {
  const md = "![a][one]\n\n[one]: https://x.test/1.png";
  assert.deepEqual(markdownImages(md), { urls: [], references: 1, svgOutsideFigure: [] });
});

test("markdownImages ignores links and code", () => {
  const md = "[not an image](https://x.test/a.png)\n\n`![x](https://x.test/b.png)`\n\n```\n![x](https://x.test/c.png)\n```";
  assert.deepEqual(markdownImages(md), { urls: [], references: 0, svgOutsideFigure: [] });
});

const HOST = { cloud: "ariko", folder: "beanstalk" };
const OK = "https://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png";

test("imageProblems accepts Ariko's Cloudinary upload folder only", () => {
  assert.deepEqual(imageProblems(`![a](${OK})`, HOST), []);
  assert.deepEqual(
    imageProblems("![a](https://res.cloudinary.com/ariko/image/upload/beanstalk/x.png)", HOST),
    [],
  );
  const other = "![a](https://res.cloudinary.com/someone-else/image/upload/v1/beanstalk/x.png)";
  assert.equal(imageProblems(other, HOST).length, 1);
  const elsewhere = "![a](https://res.cloudinary.com/ariko/image/upload/v1/other/x.png)";
  assert.equal(imageProblems(elsewhere, HOST).length, 1);
  const hotlink = "![a](https://example.com/x.png)";
  assert.match(imageProblems(hotlink, HOST)[0], /https:\/\/example\.com\/x\.png is not hosted by Ariko/);
  const data = "![a](data:image/png;base64,AAAA)";
  assert.equal(imageProblems(data, HOST).length, 1);
  const local = "![a](./shots/a.png)";
  assert.match(imageProblems(local, HOST)[0], /upload it to \/api\/articles\/assets/);
});

for (const url of [
  "https://res.cloudinary.com/ariko/../other/image/upload/x.png",
  "https://res.cloudinary.com/ariko/%2e%2e/other/x.png",
  "https://res.cloudinary.com/ariko/image/fetch/https://evil.com/x.png",
  "https://user:pw@res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png",
  "http://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png",
  "https://res.cloudinary.com.evil.test/ariko/image/upload/v1/beanstalk/x.png",
]) {
  test(`imageProblems refuses ${url}`, () => {
    assert.equal(imageProblems(`![a](${url})`, HOST).length, 1);
  });
}

test("imageProblems reports every bad image of one content part", () => {
  const md = "![a](https://a.test/1.png)\n\n![b](https://b.test/2.png)";
  assert.equal(imageProblems(md, HOST).length, 2);
});

test("imageProblems refuses reference-style images by name", () => {
  assert.match(imageProblems("![a][one]\n\n[one]: https://x.test/1.png", HOST)[0], /reference-style/);
});

test("imageProblems with no configured host refuses every image", () => {
  assert.equal(imageProblems(`![a](${OK})`, undefined).length, 1);
  assert.deepEqual(imageProblems("no images here", undefined), []);
});

test("cloudinaryCloudName reads the host of CLOUDINARY_URL", () => {
  assert.equal(cloudinaryCloudName("cloudinary://123:abc@ariko"), "ariko");
  assert.equal(cloudinaryCloudName(undefined), undefined);
  assert.equal(cloudinaryCloudName("not a url"), undefined);
});

const SVG_HOST = { cloud: "t5gexxs5", folder: "beanstalk" };
const svgUrl = "https://res.cloudinary.com/t5gexxs5/image/upload/v1/beanstalk/clock.svg";

test("an SVG is accepted inside a figure", () => {
  assert.deepEqual(imageProblems(`:::figure\n![clock](${svgUrl})\n:::`, SVG_HOST), []);
  assert.deepEqual(imageProblems(`:::figure{dark}\n![a](${svgUrl})\n![b](${svgUrl})\n:::`, SVG_HOST), []);
});

test("an SVG anywhere else is refused by name", () => {
  for (const md of [
    `![clock](${svgUrl})`,
    `:::gallery\n![a](${svgUrl})\n![b](${svgUrl})\n:::`,
    `::::compare\n:::do\n![a](${svgUrl})\nYes.\n:::\n:::dont\nNo.\n:::\n::::`,
    `:::callout\n![a](${svgUrl})\n:::`,
  ]) {
    assert.ok(imageProblems(md, SVG_HOST).some((p) => /clock\.svg: SVG is accepted only inside :::figure/.test(p)), md);
  }
});

test("markdownImages names each SVG outside a figure, and only SVGs", () => {
  const png = "https://x.test/a.png?f=.svg";
  assert.deepEqual(markdownImages(`![a](${png})\n\n![b](${svgUrl})\n\n:::figure\n![c](${svgUrl})\n:::`), {
    urls: [png, svgUrl, svgUrl],
    references: 0,
    svgOutsideFigure: [svgUrl],
  });
});
