import { describe, expect, it } from "vitest";
import { formatAbsoluteTime, formatLocalAbsoluteTime } from "./time";

describe("formatAbsoluteTime", () => {
  it("formats timestamps deterministically for server rendering", () => {
    expect(formatAbsoluteTime("2026-07-10T14:38:00.000Z")).toBe(
      "10 Jul 2026, 14:38 UTC",
    );
  });

  it("formats missing timestamps", () => {
    expect(formatAbsoluteTime(null)).toBe("Never");
  });

  it("formats timestamps for the browser locale and time zone", () => {
    expect(
      formatLocalAbsoluteTime(
        "2026-07-10T14:38:00.000Z",
        "en-US",
        "America/New_York",
      ),
    ).toBe("Jul 10, 2026, 10:38 AM");
  });
});
