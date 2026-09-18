import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-xs font-semibold tracking-[-0.005em] whitespace-nowrap transition-[background-color,color,border-color] duration-[160ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-brand-400",
        // The quiet orange chip. Pale ground, deep orange text: 7.5:1, so a
        // status label stays readable instead of being decorative.
        soft: "bg-brand-100 text-brand-800 [a]:hover:bg-brand-200",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-brand-100 [a]:hover:text-brand-900",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/20",
        success: "bg-success/12 text-success [a]:hover:bg-success/20",
        outline:
          "border-border bg-card text-foreground shadow-raised [a]:hover:border-brand-300 [a]:hover:bg-brand-50 [a]:hover:text-brand-800",
        ghost: "hover:bg-brand-50 hover:text-brand-800",
        link: "text-brand-700 underline-offset-[0.2em] hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
