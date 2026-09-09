/**
 * The sheet slot, closed.
 *
 * A parallel route needs a `default.tsx` for every route that does not fill it,
 * and returning null is what makes the layout's `:has(~ [data-screen-sheet])`
 * push honest: on every admin route but a screen's, there is no element beside
 * the page at all, so nothing to match and nothing to slide.
 */
export default function NoSheet() {
  return null;
}
