import test from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildBeanCoverPatch } from "./bean-cover-edit";

const img = (storageKey: string): MediaImage => ({
  kind: "image",
  storageKey,
  url: `https://res.cloudinary.com/x/${storageKey}.png`,
  width: 390,
  height: 844,
});

/** The picker's wire format: a ready marker plus one hidden field per entry. */
const form = (entries: unknown[], { ready = true } = {}): FormData => {
  const f = new FormData();
  if (ready) f.set("cover__ready", "1");
  for (const e of entries) f.append("cover", JSON.stringify(e));
  return f;
};

test("opening the card and saving it untouched writes nothing", () => {
  const cover = img("shot");
  assert.deepEqual(buildBeanCoverPatch({ cover }, form([cover])), { dirty: false });
});

test("a submit with no ready marker never writes, even over a stored cover", () => {
  // Script off, or a POST that never rendered a picker: the form does not know
  // what the bean holds, so its empty payload is not a clear.
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([], { ready: false })), {
    dirty: false,
  });
});

test("removing the row clears the cover", () => {
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([])), {
    dirty: true,
    cover: null,
  });
});

test("a new image replaces the stored one", () => {
  const next = img("newshot");
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([next])), {
    dirty: true,
    cover: next,
  });
});

test("setting the first cover on a bean that had none", () => {
  const next = img("shot");
  assert.deepEqual(buildBeanCoverPatch({}, form([next])), { dirty: true, cover: next });
});

test("entries submitted but none of them an image is a FAILED SAVE, not a clear", () => {
  // Removing the row submits ZERO fields; a corrupted or embed-only save
  // submits N. The two are distinguishable without guessing, and writing
  // nothing is the safe failure — the stored cover survives.
  const embedOnly = [{ kind: "embed", url: "https://example.com/x" }];
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form(embedOnly)), {
    dirty: false,
  });
});

test("the same image re-submitted WITH dimensions is a real edit", () => {
  // A cover stored without width/height renders as a plain fill —
  // lib/bean-cover.ts cannot prove it is portrait. The SAME asset resubmitted
  // carrying its dimensions is exactly the edit that turns the card into a
  // phone, so the dirty gate has to see it even though storageKey, url and alt
  // are all unchanged. Cloudinary mints a fresh public_id per upload, so this
  // is the one route by which dimensions change without the key changing.
  const stored: MediaImage = {
    kind: "image",
    storageKey: "shot",
    url: "https://res.cloudinary.com/x/shot.png",
  };
  const withDims = img("shot"); // same key and url, now carrying 390x844
  assert.deepEqual(buildBeanCoverPatch({ cover: stored }, form([withDims])), {
    dirty: true,
    cover: withDims,
  });
});

test("the stored dimensions survive the round trip", () => {
  // Load-bearing: lib/bean-cover.ts reads height > width to decide the phone
  // treatment, so a builder that dropped width/height would store a cover that
  // can never be a phone.
  const result = buildBeanCoverPatch({}, form([img("shot")]));
  assert.equal(result.dirty, true);
  assert.equal(result.dirty && result.cover?.width, 390);
  assert.equal(result.dirty && result.cover?.height, 844);
});

test("an alt-only edit is a real edit — the Cover card's picker exposes alt", () => {
  // Unlike the plant logo's picker, this one runs in full (non-compact) mode
  // and renders the alt-text field, so an alt-only save is reachable through
  // the UI, not merely a fixture.
  const stored = img("shot");
  const next = { ...stored, alt: "A phone showing the plant profile" };
  assert.deepEqual(buildBeanCoverPatch({ cover: stored }, form([next])), {
    dirty: true,
    cover: next,
  });
});

test("two images submitted — the first wins", () => {
  // The picker caps a cover at one row, so this is the UI saying so — but the
  // BUILDER's contract is what actually decides which entry survives a
  // malformed or hand-crafted payload with more than one.
  const first = img("first");
  const second = img("second");
  assert.deepEqual(buildBeanCoverPatch({}, form([first, second])), {
    dirty: true,
    cover: first,
  });
});

test("a naive `|`-join would let alt collide with a shifted url — JSON keeps them apart", () => {
  // Both tuples below join to the identical string
  // "shot|https://res.cloudinary.com/x/shot.png|a|b||" under a delimiter-joined
  // canonical form: the "|" that `alt` carries and the "|" appended to `url`
  // land in the same position once concatenated. JSON.stringify keeps each
  // field quoted, so the two encode differently and this must read as a real
  // edit — the failure mode a join-based canonical form cannot see is a save
  // silently reporting itself as a no-op.
  const stored: MediaImage = {
    kind: "image",
    storageKey: "shot",
    url: "https://res.cloudinary.com/x/shot.png|a",
    alt: "b",
  };
  const submitted: MediaImage = {
    kind: "image",
    storageKey: "shot",
    url: "https://res.cloudinary.com/x/shot.png",
    alt: "a|b",
  };
  assert.deepEqual(buildBeanCoverPatch({ cover: stored }, form([submitted])), {
    dirty: true,
    cover: submitted,
  });
});
