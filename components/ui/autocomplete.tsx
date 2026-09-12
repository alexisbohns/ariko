"use client"

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
import { cn } from "@/lib/utils"

/**
 * Base UI's Autocomplete — an input with a filtered list, and unlike Combobox
 * no selected-value semantics at all, which is exactly the command-palette
 * shape. Its own documentation names "filterable command pickers" as an
 * intended use.
 *
 * Why this file exists at all, given the rule in CLAUDE.md against hand-rolling
 * what the registry has: the registry (style `base-nova`) ships no
 * `autocomplete`. Its two neighbours are both the wrong thing here —
 * `combobox` is this same primitive styled as a BOUNDED FIELD WITH A POPUP,
 * and `command` is the cmdk palette, which would add a dependency and a second
 * dialog convention beside components/ui/dialog.tsx.
 *
 * So the behaviour is the installed primitive's, and the part classnames below
 * are lifted verbatim from the registry's own `combobox.tsx`. That is exact
 * rather than approximate: Base UI's Autocomplete RE-EXPORTS Combobox's List,
 * Item, Group, GroupLabel, Empty and Status types, so the two share one part
 * vocabulary. Same tokens, same look, no new dependency.
 *
 * Dropped from that file, because no consumer needs them: the Trigger, Icon,
 * Clear, Chips and Value parts.
 *
 * KEPT, because there are now two consumers wanting two different surfaces:
 * the Portal / Positioner / Popup trio, as `AutocompleteContent`. The ⌘K
 * palette renders its list inline (`<Autocomplete inline open>`) because the
 * dialog IS the surface; the welcome page's search is an ordinary field, so its
 * list has to be a popup anchored under it. One primitive, two shells — which
 * is only possible because the parts below are shared by both.
 */

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput({ ...props }: AutocompletePrimitive.Input.Props) {
  return <AutocompletePrimitive.Input data-slot="autocomplete-input" {...props} />
}

function AutocompleteList({
  className,
  ...props
}: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn(
        "no-scrollbar scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * The popup surface, for the consumer whose list is NOT inline. Portal,
 * Positioner and Popup in one part, exactly as `popover.tsx` folds the same
 * three together — same tokens, same entry animation, so a list under a field
 * and a panel under a button read as one system.
 *
 * Two measurements come from the positioner rather than from a guess.
 * `--anchor-width` makes the popup exactly as wide as the input it belongs to,
 * which is what stops it reading as a floating object that happens to be
 * nearby. `--available-height` caps it at the room actually left below the
 * field, so a long index scrolls instead of running off the viewport — the cap
 * is a minimum against a fixed ceiling, because on a tall screen a popup the
 * height of the window is worse than one you scroll.
 */
function AutocompleteContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 6,
  ...props
}: AutocompletePrimitive.Popup.Props &
  Pick<
    AutocompletePrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50 w-(--anchor-width)"
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(
            "z-50 flex max-h-[min(24rem,var(--available-height))] w-full origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

function AutocompleteItem({
  className,
  ...props
}: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        // The registry's combobox-item, minus the `pr-8` that reserved room for
        // an ItemIndicator: an autocomplete selects nothing, so there is no
        // check to leave a gutter for.
        "relative flex w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function AutocompleteGroup({ ...props }: AutocompletePrimitive.Group.Props) {
  return <AutocompletePrimitive.Group data-slot="autocomplete-group" {...props} />
}

function AutocompleteLabel({
  className,
  ...props
}: AutocompletePrimitive.GroupLabel.Props) {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function AutocompleteCollection({
  ...props
}: AutocompletePrimitive.Collection.Props) {
  return (
    <AutocompletePrimitive.Collection
      data-slot="autocomplete-collection"
      {...props}
    />
  )
}

/**
 * Renders its CHILDREN only when the list is empty — the element itself stays
 * mounted always, so screen readers can announce the change. `empty:hidden` is
 * therefore load-bearing, not decoration: without it this is an ever-present
 * 48px of blank space wedged between the input and the first row. (The
 * registry's combobox.tsx solves the same problem with a
 * `group-data-empty/combobox-content:flex` rule, which needs the popup wrapper
 * this file does not have.)
 */
function AutocompleteEmpty({
  className,
  ...props
}: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(
        "w-full shrink-0 py-6 text-center text-sm text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
  )
}

/**
 * A politely-announced status line. Same always-mounted rule as Empty above,
 * and the same `empty:hidden` for the same reason: conditionally render its
 * CHILDREN, never the component, and give it no box when it has nothing to say.
 */
function AutocompleteStatus({
  className,
  ...props
}: AutocompletePrimitive.Status.Props) {
  return (
    <AutocompletePrimitive.Status
      data-slot="autocomplete-status"
      className={cn(
        "w-full shrink-0 py-6 text-center text-sm text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteStatus,
}
