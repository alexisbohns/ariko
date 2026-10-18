"use client";

import { useState } from "react";
import { Globe, Lock } from "lucide-react";
import type { Visibility } from "@/lib/data";
import { visibilityLabel } from "@/lib/glyphs";
import { PLANT_VISIBILITIES } from "@/lib/plant-visibility";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";

/**
 * The visibility vocabulary, drawn as native radios behind a Save.
 *
 * Shared by the bean head and the pod page: the two entities draw the same
 * control, so they draw it from one file, and what differs is a parameter —
 * the action it posts to and the hints, because what each member DOES is
 * different one tier apart and invisible from either page.
 *
 * The words come from `lib/glyphs.ts` and the members from
 * `lib/plant-visibility.ts`, so a visibility reads the same on the admin tables
 * and here.
 *
 * Not the Base UI RadioGroup: that one submits through a script-populated hidden
 * input, and a real radio is what keeps this form a form.
 */
export function VisibilityForm({
  action,
  slug,
  current,
  hints,
  idPrefix,
}: {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  current: Visibility;
  hints: Record<Visibility, string>;
  /** Keeps each radio's `id` unique on the page, for its `<label htmlFor>`. */
  idPrefix: string;
}) {
  const [picked, setPicked] = useState<Visibility>(current);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-2">
        {PLANT_VISIBILITIES.map((option) => {
          const Icon = option === "public" ? Globe : Lock;
          const id = `${idPrefix}-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="visibility"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {visibilityLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{hints[option]}</span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs from what is stored. Without it the
            Save is a formality — two clicks that mean what one click meant — and
            the confirmation this popover exists to add is gone. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}
