const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const absoluteTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
  timeZoneName: "short",
});

const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "never";
  }
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  for (const [unit, unitSeconds] of units) {
    if (absolute >= unitSeconds || unit === "second") {
      return relativeTime.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return "just now";
}

export function formatAbsoluteTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Never";
  }
  return absoluteTime.format(value instanceof Date ? value : new Date(value));
}

export function formatLocalAbsoluteTime(
  value: string | Date | null | undefined,
  locale?: Intl.LocalesArgument,
  timeZone?: string,
) {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value instanceof Date ? value : new Date(value));
}
