/**
 * The sheet slot at the library itself — deliberately nothing.
 *
 * THIS FILE IS WHY THE PANEL CLOSES. Deleting it as dead code re-opens the bug
 * it fixes, and `lib/screen-sheet-source.test.ts` pins its existence for that
 * reason.
 *
 * `@sheet/default.tsx` is not enough, and the difference is the whole of it.
 * A parallel route's `default.tsx` is the fallback for a slot the router cannot
 * resolve — an initial load or a hard refresh. On a SOFT navigation Next keeps
 * the slot's previously active state instead, which is exactly the property the
 * modal patterns exploit and exactly the one that bit here: clicking Close
 * navigated `children` from `/admin/screens/[slug]` to `/admin/screens` while
 * the `@sheet` slot went on rendering the panel it already had. The URL
 * changed, the grid came back, and the sheet stayed open over it.
 *
 * The usual answer is `router.back()`, popping the history entry the
 * interception created. This file is the answer that keeps Close a real
 * `<a href>`: give the slot a route that MATCHES `/admin/screens`, and there is
 * no unresolved slot to retain state for — the router renders this, which is
 * nothing, and the panel goes.
 *
 * That is worth the file. `router.back()` would have made dismissal
 * script-dependent, and it is wrong twice over here: on the standalone page
 * (arrived at by URL, or with no script) "back" is wherever the author came
 * from, which is not the library; and because every tile click pushes an entry,
 * back from the third screen you looked at returns to the second rather than
 * closing. A declarative match has neither problem and costs no client JS.
 */
export default function NoSheetOnLibrary() {
  return null;
}
