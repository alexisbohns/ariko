import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { planGarden } from "./garden-plan";
import { assetsNeeded, checkAssets, collectAssets, uploadAssets, type AssetFs } from "./garden-assets";
import type { Bean, MediaImage, Sprout } from "./data";

const YAML = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: The ledger bean. }
    cover: shots/ledger.png
    sprouts:
      - slug: first-entry
        kind: log
        date: 2026-09-13
        name: { en: First entry }
        description: { en: The first entry. }
        media: [shots/ledger.png, { file: shots/two.webp, alt: Two }]
  - slug: bare
    name: { en: Bare }
    description: { en: No images. }
`;

function manifest() {
  const parsed = parseManifest(YAML);
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.error);
  if (!parsed.ok) throw new Error("unreachable");
  return parsed.manifest;
}

function fakeFs(files: Record<string, number>): AssetFs {
  return {
    size: (p) => (p in files ? files[p] : null),
    read: (p) => Buffer.from(`bytes of ${p}`),
  };
}

test("collectAssets lists each path once, in first-mention order", () => {
  assert.deepEqual(collectAssets(manifest()), [
    { file: "shots/ledger.png" },
    { file: "shots/two.webp", alt: "Two" },
  ]);
});

test("checkAssets resolves against the manifest directory and refuses a missing file", () => {
  const ok = checkAssets(manifest(), "/repo", fakeFs({ "/repo/shots/ledger.png": 10, "/repo/shots/two.webp": 10 }));
  assert.deepEqual(ok, { ok: true });

  const missing = checkAssets(manifest(), "/repo", fakeFs({ "/repo/shots/ledger.png": 10 }));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /image not found: shots\/two\.webp \(looked at \/repo\/shots\/two\.webp\)/);
});

test("checkAssets applies the upload door's size limit", () => {
  const big = checkAssets(
    manifest(),
    "/repo",
    fakeFs({ "/repo/shots/ledger.png": 5 * 1024 * 1024, "/repo/shots/two.webp": 10 }),
  );
  assert.equal(big.ok, false);
  if (!big.ok) assert.match(big.error, /image shots\/ledger\.png: the file is too large/);
});

test("assetsNeeded: everything on a fresh garden, nothing on a plain re-plant", () => {
  const m = manifest();
  const empty = { pods: [], beans: [], sprouts: [] };
  assert.deepEqual(
    assetsNeeded(planGarden(m, empty, { update: false }), empty).map((i) => i.file),
    ["shots/ledger.png", "shots/two.webp"],
  );

  const stored: MediaImage = { kind: "image", storageKey: "k", url: "https://x/k.png" };
  const existing = {
    pods: [{ slug: "krabs", name: "Krabs", parents: [], description: "x" }],
    beans: [{ slug: "ledger", name: "Ledger", parents: ["pod:krabs"], cover: stored } as Bean, { slug: "bare", name: "Bare", parents: ["pod:krabs"] } as Bean],
    sprouts: [{ slug: "first-entry", name: "x", kind: "log", date: "2026-09-13", description: "x", about: ["bean:ledger"], media: [stored] } as Sprout],
  };
  assert.deepEqual(assetsNeeded(planGarden(m, existing, { update: false }), existing), []);
});

test("assetsNeeded on --update: only where the stored entity has no image", () => {
  const m = manifest();
  const stored: MediaImage = { kind: "image", storageKey: "k", url: "https://x/k.png" };
  // The bean already has a cover chosen in the admin; the sprout has none.
  const garden = {
    pods: [{ slug: "krabs", name: "Krabs", parents: [], description: "x" }],
    beans: [{ slug: "ledger", name: "Ledger", parents: ["pod:krabs"], cover: stored } as Bean],
    sprouts: [{ slug: "first-entry", name: "x", kind: "log", date: "2026-09-13", description: "x", about: ["bean:ledger"], media: [] } as Sprout],
  };
  const needed = assetsNeeded(planGarden(m, garden, { update: true }), garden);
  // The sprout's media names ledger.png too, so it is still needed — for the
  // sprout, not the bean. The applier only writes it where assetsNeeded said.
  assert.deepEqual(needed.map((i) => i.file), ["shots/ledger.png", "shots/two.webp"]);
});

test("uploadAssets uploads each file once, keyed by the manifest path, carrying alt", async () => {
  const calls: string[] = [];
  const uploader = {
    async uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
      calls.push(`${filename}:${bytes.toString()}`);
      return { kind: "image", storageKey: `key-${filename}`, url: `https://cdn/${filename}` };
    },
  };
  const out = await uploadAssets(collectAssets(manifest()), "/repo", fakeFs({}), uploader);
  assert.deepEqual(calls, ["ledger.png:bytes of /repo/shots/ledger.png", "two.webp:bytes of /repo/shots/two.webp"]);
  assert.deepEqual(out.get("shots/ledger.png"), { kind: "image", storageKey: "key-ledger.png", url: "https://cdn/ledger.png" });
  assert.deepEqual(out.get("shots/two.webp"), { kind: "image", storageKey: "key-two.webp", url: "https://cdn/two.webp", alt: "Two" });
});
