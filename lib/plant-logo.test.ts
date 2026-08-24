import test from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildPlantLogoPatch } from "./plant-logo";

const img = (storageKey: string): MediaImage => ({
  kind: "image",
  storageKey,
  url: `https://res.cloudinary.com/x/${storageKey}.png`,
});

/** The picker's wire format: a ready marker plus one hidden field per entry. */
const form = (entries: unknown[], { ready = true } = {}): FormData => {
  const f = new FormData();
  if (ready) f.set("logo__ready", "1");
  for (const e of entries) f.append("logo", JSON.stringify(e));
  return f;
};

test("opening the card and saving it untouched writes nothing", () => {
  const logo = img("mark");
  assert.deepEqual(buildPlantLogoPatch({ logo }, form([logo])), { dirty: false });
});

test("a submit with no ready marker never writes, even over a stored logo", () => {
  // Script off, or a POST that never rendered a picker: the form does not know
  // what the plant holds, so its empty payload is not a clear-all.
  assert.deepEqual(buildPlantLogoPatch({ logo: img("mark") }, form([], { ready: false })), {
    dirty: false,
  });
});

test("a new logo on a plant that had none is a write", () => {
  const result = buildPlantLogoPatch({}, form([img("mark")]));
  assert.deepEqual(result, { dirty: true, logo: img("mark") });
});

test("removing the row and saving clears the logo", () => {
  assert.deepEqual(buildPlantLogoPatch({ logo: img("mark") }, form([])), {
    dirty: true,
    logo: null,
  });
});

test("an empty payload on a plant with no logo is not a write", () => {
  assert.deepEqual(buildPlantLogoPatch({}, form([])), { dirty: false });
});

test("an embed is dropped — a logo is a square image by definition", () => {
  const embed = { kind: "embed", provider: "", url: "https://soundcloud.com/x" };
  const result = buildPlantLogoPatch({}, form([embed, img("mark")]));
  assert.deepEqual(result, { dirty: true, logo: img("mark") });
});

test("a payload of nothing BUT embeds is a failed save, not a clear-all", () => {
  const embed = { kind: "embed", provider: "", url: "https://soundcloud.com/x" };
  assert.deepEqual(buildPlantLogoPatch({ logo: img("mark") }, form([embed])), { dirty: false });
});

test("two images submitted — the first wins", () => {
  const result = buildPlantLogoPatch({}, form([img("first"), img("second")]));
  assert.deepEqual(result, { dirty: true, logo: img("first") });
});

test("editing only the alt text is still a change", () => {
  const stored = img("mark");
  const result = buildPlantLogoPatch({ logo: stored }, form([{ ...stored, alt: "Enerfip" }]));
  assert.deepEqual(result, { dirty: true, logo: { ...stored, alt: "Enerfip" } });
});
