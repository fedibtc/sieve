import type * as React from "react";
import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "border-border bg-card text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
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
