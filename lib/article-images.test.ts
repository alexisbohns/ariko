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
