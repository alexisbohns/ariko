/**
 * The plate every floating chrome cluster wears — one decision, every consumer.
 *
 * Both zones put their chrome in fixed clusters at the edges of the viewport
 * rather than in a bar across the top: the admin's icon rail and account
 * cluster (`app/admin/_components/admin-chrome.tsx`), the plant page's
 * Exhibition rail (`app/admin/_components/plant-rail.tsx`), and the public
 * zone's mark/nav and language clusters
 * (`app/(public)/_components/public-chrome.tsx`).
 *
 * This is what all of them are made of. The point of the constant is not to
 * save keystrokes — it is that a floating cluster is furniture, and furniture
 * that disagrees with itself about its own grey reads as several unrelated
 * things stuck to the edges of one page. Anything new that floats at an edge
 * belongs here too; grep for the name rather than copying the string.
 *
 * **Ghost on desktop.** At `md:` and up a cluster is just its icons: no border,
 * no plate, no shadow. The container materializes on hover or focus and fades
 * back out. The icons themselves never change — what appears is the furniture
 * behind them.
 *
 * Three parts of that are load-bearing rather than cosmetic:
 *
 * - **`border-transparent`, never `border-0`.** The border keeps its place in
 *   the box model and only loses its colour. Dropping it would resize the
 *   cluster by 1px on every hover, twitching the icons out from under the
 *   pointer that was reaching for them — the one place a hover effect must not
 *   move anything.
 *
 * - **`focus-within` mirrors every `hover`.** A keyboard user tabbing into a
 *   cluster gets the same plate a pointer does. Without it, a focus ring would
 *   land on an invisible container floating over the page.
 *
 * - **`md:` and up only, and NOT as a hedge about small screens.** Touch has no
 *   hover at all, so a ghost chrome on a phone is one that can never
 *   materialize — and a phone is exactly where the plate earns its keep,
 *   because the clusters sit *over* the content rather than beside it. Below
 *   `md` the plate stays on permanently.
 *
 * A plain string, not a component: the four callers differ in radius, padding
 * and position, and wrapping them in a shared element would mean threading
 * those through as props to save one `className` each.
 */
export const CHROME_PLATE =
  "border bg-card/80 shadow-lg backdrop-blur " +
  "transition-[background-color,border-color,box-shadow] duration-200 " +
  "md:border-transparent md:bg-transparent md:shadow-none md:backdrop-blur-none " +
  "md:hover:border-border md:hover:bg-card/80 md:hover:shadow-lg md:hover:backdrop-blur " +
  "md:focus-within:border-border md:focus-within:bg-card/80 md:focus-within:shadow-lg " +
  "md:focus-within:backdrop-blur";
