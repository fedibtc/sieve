import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

// primer buttons: default is the green primary, outline the gray one
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium leading-5 transition-colors disabled:cursor-default disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-btn-primary-border bg-btn-primary text-fg-on-emphasis hover:bg-btn-primary-hover",
        secondary:
          "border-btn-border bg-btn text-btn-fg shadow-btn hover:bg-btn-hover active:bg-btn-active",
        outline:
          "border-btn-border bg-btn text-btn-fg shadow-btn hover:bg-btn-hover active:bg-btn-active",
        danger:
          "border-btn-border bg-btn text-btn-danger-fg shadow-btn hover:border-btn-danger-hover hover:bg-btn-danger-hover hover:text-fg-on-emphasis",
        ghost:
          "border-transparent text-fg hover:bg-control-hover [&_svg]:text-fg-muted",
      },
      size: {
        default: "h-8 px-4",
        sm: "h-7 px-3 text-xs",
        lg: "h-10 px-5",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
