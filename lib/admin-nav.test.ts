import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navHref, navItems, resolveColumn, resolveNavItem } from "./admin-nav";

test("the six sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.id),
    ["inbox", "pods", "beans", "sprouts", "screens", "beanstalk"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    [
      "/admin/inbox",
      "/admin/pods",
      "/admin/beans",
      "/admin/sprouts",
      "/admin/screens",
      "/admin/beanstalk",
    ],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Pods", "Beans", "Sprouts", "Screens", "Beanstalk"],
  );
});

test("the root is not a section — it lights nothing", () => {
  assert.equal(resolveNavItem("/admin"), null);
  assert.equal(resolveNavItem("/admin/"), null);
});

test("section roots resolve to themselves", () => {
  assert.equal(resolveNavItem("/admin/inbox"), "/admin/inbox");
  assert.equal(resolveNavItem("/admin/pods"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/beans"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/sprouts"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/screens"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/beanstalk"), "/admin/beanstalk");
});

test("Screens is a section, and its children light it", () => {
  assert.equal(resolveNavItem("/admin/screens"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/karma-top"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/new"), "/admin/screens");
});

test("detail routes resolve to the section they belong to", () => {
  assert.equal(resolveNavItem("/admin/sprout/my-sprout"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/bean/abc123"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/pod/some-pod"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/triage/abc123"), "/admin/inbox");
});

test("a plant page belongs to Overview, which only exists when scoped", () => {
  assert.equal(resolveNavItem("/admin/plant/ariko"), "/admin/plant/ariko");
});

test("a plant route tolerates depth — a hub child still lights Overview", () => {
  assert.equal(resolveNavItem("/admin/plant/ariko/screens"), "/admin/plant/ariko");
  assert.equal(resolveNavItem("/admin/plant/ariko/screens/karma-top"), "/admin/plant/ariko");
});

test("login belongs to no section", () => {
  assert.equal(resolveNavItem("/admin/login"), null);
});

test("an unknown admin route highlights nothing", () => {
  assert.equal(resolveNavItem("/admin/nowhere"), null);
  assert.equal(resolveNavItem("/"), null);
});

test("a prefix must end at a segment boundary", () => {
  assert.equal(resolveNavItem("/admin/podsy"), null);
  assert.equal(resolveNavItem("/admin/beanstalked"), null);
  // Screens has no singular "/admin/screen" entry the way pod/bean/sprout do.
  // "screen" would be a STRING prefix of "screens" without being a PATH
  // prefix of it, and both directions have to stay out: /admin/screenshots is
  // a route "screens" is not a path-prefix of, and /admin/screen/karma-top is
  // a route a hypothetical "screen" entry would wrongly claim were one ever
  // added without the same boundary check.
  assert.equal(resolveNavItem("/admin/screenshots"), null);
  assert.equal(resolveNavItem("/admin/screen/karma-top"), null);
});

test("unscoped, the rail is NAV_ITEMS in order", () => {
  // Not `deepEqual` against NAV_ITEMS itself: `navItems` adds the shortcut
  // digit, which is a position rather than a property of the section and is
  // deliberately absent from the stored list.
  assert.deepEqual(
    navItems(null).map((i) => i.id),
    NAV_ITEMS.map((i) => i.id),
  );
  assert.deepEqual(
    navItems(null).map((i) => i.href),
    NAV_ITEMS.map((i) => i.href),
  );
});

test("the shortcut digit is the item's position in the rail as drawn", () => {
  assert.deepEqual(
    navItems(null).map((i) => i.hotkey),
    ["1", "2", "3", "4", "5", "6"],
  );
});

test("scoped, the digits follow the rail's new shape rather than the old one", () => {
  // Overview takes the 1 and everything below it shifts down. A shortcut that
  // disagreed with the position it is drawn beside would be worse than none:
  // Beanstalk is gone from this rail, so nothing may still answer to its digit.
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => `${i.id}:${i.hotkey}`),
    ["overview:1", "inbox:2", "pods:3", "beans:4", "sprouts:5", "screens:6"],
  );
});

test("no rail item is numbered past nine", () => {
  // The ceiling is real rather than theoretical: Alt+0 is the key that would
  // have to mean ten, and the digits run out before a rail could need it.
  for (const item of [...navItems(null), ...navItems("ariko")]) {
    if (item.hotkey) assert.match(item.hotkey, /^[1-9]$/, item.id);
  }
});

test("scoped, Overview leads and Beanstalk steps aside", () => {
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => i.id),
    ["overview", "inbox", "pods", "beans", "sprouts", "screens"],
  );
  assert.equal(items[0].href, "/admin/plant/ariko");
  assert.equal(items[0].label, "Overview");
});

test("a scoped slug is encoded into Overview's href", () => {
  assert.equal(navItems("a b/c")[0].href, "/admin/plant/a%20b%2Fc");
});

test("navHref carries the scope to a section and leaves Overview alone", () => {
  assert.equal(navHref(NAV_ITEMS[1], "ariko"), "/admin/pods?plant=ariko");
  assert.equal(navHref(NAV_ITEMS[1], null), "/admin/pods");
  const overview = navItems("ariko")[0];
  assert.equal(navHref(overview, "ariko"), "/admin/plant/ariko");
});

test("navHref encodes the scope through the shared filter builder, not its own", () => {
  // Pins the spelling to filterHref's (URLSearchParams: "+"), not a stray
  // encodeURIComponent ("%20") that would make this a second encoder for the
  // same query key.
  assert.equal(navHref(NAV_ITEMS[1], "a b"), "/admin/pods?plant=a+b");
});

test("Beanstalk never carries a scope — the docblock's reason it isn't in a scoped rail", () => {
  const beanstalk = NAV_ITEMS.find((item) => item.id === "beanstalk")!;
  assert.equal(navHref(beanstalk, "ariko"), "/admin/beanstalk");
});

test("every section index reads in the wide column", () => {
  for (const item of NAV_ITEMS) assert.equal(resolveColumn(item.href), "wide", item.href);
});

test("the welcome page is wide too — it holds two tables", () => {
  assert.equal(resolveColumn("/admin"), "wide");
  assert.equal(resolveColumn("/admin/"), "wide");
});

test("detail pages read in the same column the public site does", () => {
  assert.equal(resolveColumn("/admin/plant/ariko"), "reading");
  assert.equal(resolveColumn("/admin/pod/some-pod"), "reading");
  assert.equal(resolveColumn("/admin/bean/abc123"), "reading");
  assert.equal(resolveColumn("/admin/sprout/my-sprout"), "reading");
  assert.equal(resolveColumn("/admin/triage/abc123"), "reading");
  assert.equal(resolveColumn("/admin/screens/karma-top"), "reading");
});

// There used to be a "login is bare" test here, asserting a third Column
// member for the one route with no chrome to clear. The login page moved
// outside `app/admin/(chrome)/` — so that it never enters a layout that reads
// the garden — and `resolveColumn`'s only caller lives inside that group, which
// left the case unreachable, and a special case for a path the caller cannot
// receive reads like a live rule. `resolveNavItem("/admin/login")` above is a
// different kind of assertion and stays: it is one of several paths standing in
// for "a route that belongs to no section", and it answers null by the same
// fallthrough any unknown path does. See `lib/admin-login-layout-source.test.ts`.

test("an unknown route reads rather than sprawls", () => {
  assert.equal(resolveColumn("/admin/nowhere"), "reading");
});
