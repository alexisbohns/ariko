import { test } from "node:test";
import assert from "node:assert/strict";
import { orphanAssets, referencedStorageKeys, type AssetHolders, type StoredAsset } from "./orphan-assets";

function img(storageKey: string) {
  return { kind: "image" as const, storageKey, url: `https://res.cloudinary.com/${storageKey}` };
}

const EMPTY: AssetHolders = { screens: [], beans: [], plants: [], sprouts: [] };

test("a key in any of the four homes counts as referenced", () => {
  const keys = referencedStorageKeys({
    screens: [{ image: img("beanstalk/screen") }],
    beans: [{ cover: img("beanstalk/cover") }],
    plants: [{ logo: img("beanstalk/logo") }],
    sprouts: [{ media: [img("beanstalk/media")] }],
  });
  assert.deepEqual([...keys].sort(), [
    "beanstalk/cover",
    "beanstalk/logo",
    "beanstalk/media",
    "beanstalk/screen",
  ]);
});

test("absent, null and blank keys are not references", () => {
  const keys = referencedStorageKeys({
    screens: [{}, { image: null }],
    beans: [{ cover: undefined }, { cover: { ...img(""), storageKey: "   " } }],
    plants: [{ logo: null }],
    sprouts: [{}, { media: null }, { media: [] }],
  });
  assert.equal(keys.size, 0);
});

// An embed has no storageKey at all; reading one as a reference would be
// harmless, but reading `undefined` INTO the set would make every asset look
// referenced by a single podcast episode.
test("a sprout's embeds contribute nothing", () => {
  const keys = referencedStorageKeys({
    ...EMPTY,
    sprouts: [
      {
        media: [
          { kind: "embed", provider: "spotify", url: "https://open.spotify.com/x" },
          img("beanstalk/kept"),
        ],
      },
    ],
  });
  assert.deepEqual([...keys], ["beanstalk/kept"]);
});

test("orphans are the assets no key names, in listing order", () => {
  const assets: StoredAsset[] = [
    { publicId: "beanstalk/a" },
    { publicId: "beanstalk/orphan", originalFilename: "karma-verdict-drawer.png" },
    { publicId: "beanstalk/b" },
  ];
  const referenced = referencedStorageKeys({
    ...EMPTY,
    beans: [{ cover: img("beanstalk/a") }],
    plants: [{ logo: img("beanstalk/b") }],
  });
  assert.deepEqual(orphanAssets(assets, referenced), [
    { publicId: "beanstalk/orphan", originalFilename: "karma-verdict-drawer.png" },
  ]);
});

// The filename is report context only. Two uploads of the same file get two
// public_ids, so matching on the name would spare a genuine orphan whenever a
// namesake is still in use — and this is the exact case that produced #76.
test("a shared filename never spares an orphan", () => {
  const referenced = referencedStorageKeys({
    ...EMPTY,
    beans: [{ cover: img("beanstalk/kept") }],
  });
  const orphans = orphanAssets(
    [
      { publicId: "beanstalk/kept", originalFilename: "karma.png" },
      { publicId: "beanstalk/superseded", originalFilename: "karma.png" },
    ],
    referenced,
  );
  assert.deepEqual(orphans.map((o) => o.publicId), ["beanstalk/superseded"]);
});

test("no assets and no references is not an error", () => {
  assert.deepEqual(orphanAssets([], referencedStorageKeys(EMPTY)), []);
});
