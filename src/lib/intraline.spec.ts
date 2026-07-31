import { describe, expect, it } from "vitest";
import { emphasizeRanges, intralineRanges } from "./intraline";

describe("intralineRanges", () => {
  it("marks the changed words on both sides", () => {
    const ranges = intralineRanges(
      "  const seconds = totalSeconds % 60;",
      "  const seconds = Math.floor(totalSeconds % 60);",
    );
    expect(ranges).not.toBeNull();
    const afterText = ranges?.after.map(([from, to]) =>
      "  const seconds = Math.floor(totalSeconds % 60);".slice(from, to),
    );
    expect(afterText).toEqual(["Math.floor(", ")"]);
    expect(ranges?.before).toEqual([]);
  });

  it("marks replaced words on both sides", () => {
    const before = 'const flag = "off";';
    const after = 'const flag = "on";';
    const ranges = intralineRanges(before, after);
    expect(ranges?.before.map(([from, to]) => before.slice(from, to))).toEqual([
      "off",
    ]);
    expect(ranges?.after.map(([from, to]) => after.slice(from, to))).toEqual([
      "on",
    ]);
  });

  it("returns null for identical lines", () => {
    expect(intralineRanges("const a = 1;", "const a = 1;")).toBeNull();
  });

  it("returns null for near-total rewrites", () => {
    expect(
      intralineRanges("return legacyLabel(value);", "throw new Error(reason);"),
    ).toBeNull();
  });

  it("returns null when only indentation is shared", () => {
    expect(intralineRanges("    foo();", "    barbaz();")).toBeNull();
  });

  it("returns null when one side is empty", () => {
    expect(intralineRanges("", "const added = true;")).toBeNull();
  });
});

describe("emphasizeRanges", () => {
  it("splits tokens at range boundaries and flags emphasized pieces", () => {
    const tokens = [{ text: "const label = " }, { text: "format(value);" }];
    const result = emphasizeRanges(tokens, [[14, 21]]);
    expect(
      result.map((token) => [token.text, token.emphasized ?? false]),
    ).toEqual([
      ["const label = ", false],
      ["format(", true],
      ["value);", false],
    ]);
  });

  it("keeps token metadata on split pieces", () => {
    const tokens = [{ text: "abcdef", className: "hljs-keyword" }];
    const result = emphasizeRanges(tokens, [[2, 4]]);
    expect(result).toEqual([
      { text: "ab", className: "hljs-keyword", emphasized: false },
      { text: "cd", className: "hljs-keyword", emphasized: true },
      { text: "ef", className: "hljs-keyword", emphasized: false },
    ]);
  });
});
