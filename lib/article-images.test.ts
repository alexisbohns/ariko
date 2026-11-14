import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryCloudName, imageProblems, markdownImages } from "./article-images";

test("markdownImages lists inline image URLs, in order", () => {
  const md = "Intro\n\n![a](https://x.test/1.png)\n\nText ![b](https://x.test/2.png \"t\")";
  assert.deepEqual(markdownImages(md), { urls: ["https://x.test/1.png", "https://x.test/2.png"], references: 0 });
});

test("markdownImages counts reference-style images instead of resolving them", () => {
  const md = "![a][one]\n\n[one]: https://x.test/1.png";
  assert.deepEqual(markdownImages(md), { urls: [], references: 1 });
});

test("markdownImages ignores links and code", () => {
  const md = "[not an image](https://x.test/a.png)\n\n`![x](https://x.test/b.png)`\n\n```\n![x](https://x.test/c.png)\n```";
  assert.deepEqual(markdownImages(md), { urls: [], references: 0 });
});

test("imageProblems accepts Ariko's Cloudinary cloud only", () => {
  const ok = "![a](https://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png)";
  assert.deepEqual(imageProblems(ok, "ariko"), []);
  const other = "![a](https://res.cloudinary.com/someone-else/image/upload/x.png)";
  assert.equal(imageProblems(other, "ariko").length, 1);
  const hotlink = "![a](https://example.com/x.png)";
  assert.match(imageProblems(hotlink, "ariko")[0], /https:\/\/example\.com\/x\.png is not hosted by Ariko/);
  const data = "![a](data:image/png;base64,AAAA)";
  assert.equal(imageProblems(data, "ariko").length, 1);
  const local = "![a](./shots/a.png)";
  assert.match(imageProblems(local, "ariko")[0], /upload it to \/api\/articles\/assets/);
});

test("imageProblems refuses reference-style images by name", () => {
  assert.match(imageProblems("![a][one]\n\n[one]: https://x.test/1.png", "ariko")[0], /reference-style/);
});

test("imageProblems with no configured cloud refuses every image", () => {
  assert.equal(imageProblems("![a](https://res.cloudinary.com/ariko/x.png)", undefined).length, 1);
  assert.deepEqual(imageProblems("no images here", undefined), []);
});

test("cloudinaryCloudName reads the host of CLOUDINARY_URL", () => {
  assert.equal(cloudinaryCloudName("cloudinary://123:abc@ariko"), "ariko");
  assert.equal(cloudinaryCloudName(undefined), undefined);
  assert.equal(cloudinaryCloudName("not a url"), undefined);
});
