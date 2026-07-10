"use client";

import { useEffect, useState } from "react";
import {
  formatAbsoluteTime,
  formatLocalAbsoluteTime,
  formatRelativeTime,
} from "@/lib/time";

export function RelativeTime({
  prefix,
  value,
}: {
  prefix?: string;
  value: string | Date | null | undefined;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label = mounted ? formatRelativeTime(value) : formatAbsoluteTime(value);
  const title = mounted
    ? formatLocalAbsoluteTime(value)
    : formatAbsoluteTime(value);
  const dateTime = value
    ? (value instanceof Date ? value : new Date(value)).toISOString()
    : undefined;

  return (
    <time dateTime={dateTime} title={title}>
      {prefix ? `${prefix} ${label}` : label}
    </time>
  );
}
