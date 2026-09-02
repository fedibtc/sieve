import type * as React from "react";
import { cn } from "@/lib/utils";

// primer's Label: a 20px outlined pill whose border and text share one role color
const toneClass = {
  neutral: "border-border text-fg-muted",
  primary: "border-accent-emphasis text-accent-fg",
  blue: "border-accent-emphasis text-accent-fg",
  green: "border-success-emphasis text-success-fg",
  amber: "border-attention-emphasis text-attention-fg",
  red: "border-danger-emphasis text-danger-fg",
  violet: "border-done-emphasis text-done-fg",
} as const;

export type BadgeTone = keyof typeof toneClass;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full border px-[7px] text-xs font-medium leading-[18px]",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Counter({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full bg-neutral-muted px-1.5 text-xs font-medium leading-[18px] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
