/**
 * button.tsx — every button and button-shaped link in Vouch.
 *
 * Plain English: there are two things worth knowing about this file.
 *
 * 1. THE PRESS FEELS DIFFERENT FROM THE RELEASE, on purpose.
 *
 *    Press down: the button drops and shrinks slightly, fast (90ms) with a
 *    plain curve. It obeys your finger immediately.
 *
 *    Let go: it returns on a *spring* — it travels slightly past where it
 *    started and settles back. That overshoot lasts a fraction of a second
 *    and you will never consciously notice it, but it is the entire reason
 *    a button feels satisfying rather than merely animated. Symmetric
 *    animation feels like software; asymmetric feels like a physical object.
 *
 *    In the code below that is the `transition-*` / `ease-spring` classes on
 *    the base, overridden by the faster `active:duration-*` / `active:ease-enter`
 *    on press.
 *
 * 2. EVERY BUTTON IS AT LEAST 44px TALL by default.
 *
 *    They used to be 32px. 44px is the size a fingertip can reliably hit,
 *    and it is the published minimum for touch. On a tablet, 32px means
 *    missed taps. The smaller sizes still exist for dense rows, but the
 *    default is now the one that works with a thumb.
 */

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center",
    "rounded-lg border border-transparent bg-clip-padding whitespace-nowrap select-none",
    "font-medium tracking-[-0.01em]",
    // Motion. The base transition is what plays on RELEASE, so it carries the
    // spring; `active:` below overrides it with something faster for the press.
    //
    // Note `translate` and `scale`, NOT `transform`. Tailwind v4 moves things
    // with the separate CSS `translate:` and `scale:` properties, so naming
    // `transform` here transitions a property nothing is changing — the button
    // would jump instantly with no spring, and look fine in a screenshot.
    "transition-[translate,scale,box-shadow,background-color,border-color,color,opacity]",
    "duration-[160ms] ease-spring",
    "active:duration-[90ms] active:ease-enter",
    // The focus ring, stated explicitly and never with `outline-none`.
    //
    // This was wrong until it was measured. The class here used to be
    // `outline-none`, on the assumption that the global :focus-visible rule in
    // globals.css would still draw the ring. It does not: that rule lives in
    // Tailwind's `base` layer and every utility class outranks it, so
    // `outline-none` silently won and EVERY button in the product was
    // invisible to anyone navigating by keyboard. It looked completely fine
    // in a screenshot, because a screenshot never presses Tab.
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    // Disabled: no pointer, no lift, no shadow. A dead button should look dead.
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:translate-y-0",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // The loud one. Bright orange with near-black text (7.0:1), a white
        // top edge and an orange-tinted glow beneath, so it reads as lit.
        default: [
          "bg-primary text-primary-foreground shadow-brand",
          "hover:-translate-y-px hover:bg-brand-400 hover:shadow-brand-lg",
          "active:translate-y-px active:scale-[0.97] active:bg-brand-600 active:shadow-brand",
        ],
        // A raised white surface. Same physics, quieter voice.
        outline: [
          "border-border bg-card text-foreground shadow-raised",
          "hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 hover:shadow-raised-md",
          "active:translate-y-px active:scale-[0.97] active:bg-brand-100 active:shadow-raised",
        ],
        secondary: [
          "bg-secondary text-secondary-foreground shadow-raised",
          "hover:-translate-y-px hover:bg-brand-100 hover:text-brand-900 hover:shadow-raised-md",
          "active:translate-y-px active:scale-[0.97] active:bg-brand-200 active:shadow-raised",
        ],
        // Flat until touched. No shadow to lose, so it presses without lifting.
        ghost: [
          "text-foreground",
          "hover:bg-brand-50 hover:text-brand-800",
          "active:scale-[0.97] active:bg-brand-100",
        ],
        destructive: [
          "bg-destructive/10 text-destructive shadow-raised",
          "hover:-translate-y-px hover:bg-destructive/15 hover:shadow-raised-md",
          "active:translate-y-px active:scale-[0.97] active:bg-destructive/20 active:shadow-raised",
        ],
        // A real link: reads as text, underlines on hover, never lifts.
        link: [
          "text-brand-700 underline-offset-[0.2em] hover:underline",
          "active:text-brand-900",
        ],
      },
      size: {
        // 44px — the default, and the only one to reach for unless a row is
        // genuinely too dense for it.
        default: "h-11 gap-2 px-5 text-sm",
        xs: "h-8 gap-1 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-md px-3.5 text-[0.8125rem]",
        lg: "h-12 gap-2 px-7 text-base",
        // Extra loud, for the one call to action on a page.
        xl: "h-14 gap-2.5 rounded-xl px-9 text-base",
        icon: "size-11",
        "icon-xs": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * Shows a spinner and blocks clicks while a form is submitting.
     *
     * The label stays put rather than being swapped for "Saving…", so you can
     * still read which action is running. Most submit buttons here are
     * full-width, so the spinner appearing shifts nothing at all.
     */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      disabled={disabled || loading}
      // Tells a screen reader the button is busy, since the spinner alone
      // says nothing to someone who cannot see it.
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* Spinner AND label. A button showing only a spinner reads as empty,
          and leaves you guessing which action is actually in flight. */}
      {loading ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
