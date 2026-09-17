/**
 * input.tsx — every text field in Vouch.
 *
 * Plain English: buttons come toward you, inputs go away from you.
 *
 * A button has a lit top edge and a shadow underneath, so it reads as sitting
 * on top of the page. An input has the shadow cast *inwards* from its top
 * edge, so it reads as a well cut into the page — somewhere you put things.
 * That opposition is most of what makes a form feel physical rather than
 * drawn, and it costs one CSS variable.
 *
 * Also 44px tall, like the buttons, because a text field you have to aim at
 * on a tablet is just as annoying as a button you have to aim at.
 */

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-2",
        // 16px on phones. Anything smaller and iOS Safari zooms the page in
        // when the field is tapped, which is jarring and hard to undo.
        "text-base md:text-sm",
        "shadow-inset transition-[border-color,box-shadow,background-color] duration-[160ms] ease-out",
        "placeholder:text-muted-foreground/70",
        "hover:border-brand-300",
        // On focus the well fills with a faint orange and the border warms up.
        // The ring itself is drawn by the one global :focus-visible rule, so
        // it matches every other focusable thing in the product.
        "focus-visible:border-brand-500 focus-visible:bg-brand-50/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55",
        "aria-invalid:border-destructive aria-invalid:bg-destructive/5",
        // The "Choose file" button inside a file input, which browsers style
        // themselves and otherwise looks nothing like the rest of the page.
        "file:mr-3 file:inline-flex file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-200",
        className
      )}
      {...props}
    />
  )
}

export { Input }
