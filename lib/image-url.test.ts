import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryThumb } from "./image-url";

// The canonical shape lib/storage.test.ts already treats as real: a Cloudinary
// upload's secure_url, versioned, inside this app's "beanstalk" folder.
const REAL_URL = "https://res.cloudinary.com/demo/image/upload/v1234567890/beanstalk/abc123.jpg";

test("a real Cloudinary URL gets the segment inserted right after upload/, path after intact", () => {
  const out = cloudinaryThumb(REAL_URL, { width: 80, height: 80 });
  assert.equal(
    out,
    "https://res.cloudinary.com/demo/image/upload/w_80,h_80,c_fill,q_auto,f_auto/v1234567890/beanstalk/abc123.jpg",
  );
});

test("the canonical no-version shape from lib/storage.test.ts also gets the segment in place", () => {
  // lib/storage.test.ts's own fixture: a secure_url with no version segment.
  const out = cloudinaryThumb("https://res.cloudinary.com/x/image/upload/abc123.jpg", {
    width: 80,
    height: 80,
  });
  assert.equal(out, "https://res.cloudinary.com/x/image/upload/w_80,h_80,c_fill,q_auto,f_auto/abc123.jpg");
});

test("a non-Cloudinary URL is returned byte-identical", () => {
  const url = "https://images.unsplash.com/photo-12345?w=2000&q=80";
  assert.equal(cloudinaryThumb(url, { width: 80, height: 80 }), url);
});

test("a malformed / non-URL string is returned byte-identical and does not throw", () => {
  const junk = "not a url at all";
  assert.doesNotThrow(() => cloudinaryThumb(junk, { width: 80, height: 80 }));
  assert.equal(cloudinaryThumb(junk, { width: 80, height: 80 }), junk);
});

test("transforming an already-transformed URL does not stack a second segment", () => {
  const once = cloudinaryThumb(REAL_URL, { width: 80, height: 80 });
  const twice = cloudinaryThumb(once, { width: 800, height: 256 });
  assert.equal(twice, once, "a second call must not prepend a second transformation segment");
});

test("a res.cloudinary.com URL that is NOT an /image/upload/ delivery URL is left alone", () => {
  const video = "https://res.cloudinary.com/demo/video/upload/v1234567890/beanstalk/clip.mp4";
  assert.equal(cloudinaryThumb(video, { width: 80, height: 80 }), video);

  const fetchUrl = "https://res.cloudinary.com/demo/image/fetch/https://example.com/pic.jpg";
  assert.equal(cloudinaryThumb(fetchUrl, { width: 80, height: 80 }), fetchUrl);
});

test("a lookalike host is not mistaken for res.cloudinary.com", () => {
  const url = "https://res.cloudinary.com.attacker.example/image/upload/v1/beanstalk/abc.jpg";
  assert.equal(cloudinaryThumb(url, { width: 80, height: 80 }), url);
});
