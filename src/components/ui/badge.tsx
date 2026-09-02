import type * as React from "react";
import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "border-border bg-canvas text-fg-muted",
  primary: "border-accent-border bg-accent-muted text-accent-fg",
  blue: "border-accent-border bg-accent-muted text-accent-fg",
  green: "border-success-border bg-success-muted text-success-fg",
  amber: "border-attention-border bg-attention-muted text-attention-fg",
  red: "border-danger-border bg-danger-muted text-danger-fg",
  violet: "border-done-border bg-done-muted text-done-fg",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
