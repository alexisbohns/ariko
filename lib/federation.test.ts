import { test } from "node:test";
import assert from "node:assert/strict";
import { getFederation, parseFederation } from "./federation";

// The committed config deploys on merge — a typo must fail HERE, not at sync
// time in production.
test("the committed data/federation.yml parses", () => {
  const cfg = getFederation();
  assert.ok(cfg.feeds.length >= 1);
});

const FEED = {
  id: "arkaik-pbbls",
  source: "arkaik",
  transport: "http",
  url: "https://arkaik.app/api/graph/projects/prj_x/pollen",
  tokenEnv: "ARKAIK_API_TOKEN",
};

test("parses a valid config", () => {
  const cfg = parseFederation({ feeds: [FEED], exhibit: ["plant:pbbls"] });
  assert.equal(cfg.feeds.length, 1);
  assert.equal(cfg.feeds[0].id, "arkaik-pbbls");
  assert.deepEqual(cfg.exhibit, ["plant:pbbls"]);
});

test("feeds and exhibit default to empty", () => {
  assert.deepEqual(parseFederation({}), { feeds: [], exhibit: [] });
});

test("file transport needs no tokenEnv", () => {
  const cfg = parseFederation({
    feeds: [{ id: "paulopus", source: "paulopus", transport: "file", url: "https://x/feed.ndjson" }],
  });
  assert.equal(cfg.feeds[0].tokenEnv, undefined);
});

test("http feed without tokenEnv is a loud config error", () => {
  assert.throws(
    () => parseFederation({ feeds: [{ ...FEED, tokenEnv: undefined }] }),
    /tokenEnv is required/,
  );
});

test("unknown transport is rejected", () => {
  assert.throws(() => parseFederation({ feeds: [{ ...FEED, transport: "ftp" }] }), /transport/);
});

test("duplicate feed ids are rejected", () => {
  assert.throws(() => parseFederation({ feeds: [FEED, FEED] }), /duplicate feed id/);
});

test("exhibit entries must be plant refs", () => {
  assert.throws(() => parseFederation({ exhibit: ["bean:x"] }), /plant:<slug>/);
  assert.throws(() => parseFederation({ exhibit: ["plant:Bad_Slug"] }), /plant:<slug>/);
});
