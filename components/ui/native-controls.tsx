import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Styled *native* form controls.
 *
 * The admin's forms post to server actions and must keep working with no
 * client JS, so selects, radios and checkboxes stay real HTML elements rather
 * than the Base UI composites (which submit through a hidden input populated
 * by script). These wrappers give them the design system's look without
 * touching their behaviour.
 */

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

const choiceClass =
  "size-4 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function NativeRadio({ className, ...props }: React.ComponentProps<"input">) {
  return <input type="radio" className={cn(choiceClass, className)} {...props} />;
}

function NativeCheckbox({ className, ...props }: React.ComponentProps<"input">) {
  return <input type="checkbox" className={cn(choiceClass, className)} {...props} />;
}

/** A radio/checkbox and its text, on one baseline. */
function ChoiceLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("flex items-center gap-2 text-sm leading-none select-none", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeRadio, NativeCheckbox, ChoiceLabel };
