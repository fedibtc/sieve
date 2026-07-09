"use client";

import { useEffect, useState } from "react";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";

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

  return (
    <span title={formatAbsoluteTime(value)}>
      {prefix ? `${prefix} ${label}` : label}
    </span>
  );
}
