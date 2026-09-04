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
 * Dropped from that file, because nothing here is anchored to a field: the
 * Portal, Positioner, Popup, Trigger, Icon, Clear, Chips and Value parts. The
 * consumer renders the list inline (`<Autocomplete inline open>`) inside its
 * own surface.
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

function AutocompleteEmpty({
  className,
  ...props
}: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(
        "w-full shrink-0 py-6 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * A politely-announced status line. Its element must stay mounted for screen
 * readers to announce changes consistently — conditionally render its
 * CHILDREN, never the component.
 */
function AutocompleteStatus({
  className,
  ...props
}: AutocompletePrimitive.Status.Props) {
  return (
    <AutocompletePrimitive.Status
      data-slot="autocomplete-status"
      className={cn(
        "empty:hidden w-full shrink-0 py-6 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteStatus,
}
