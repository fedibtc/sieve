import { diffWordsWithSpace } from "diff";

export type IntralineRanges = {
  before: Array<[number, number]>;
  after: Array<[number, number]>;
};

// Character ranges that changed between the two sides of a modified line
// pair, used for two-tone diff emphasis. Returns null when the sides share
// too little text for word-level highlighting to aid scanning (near-total
// rewrites read better with plain whole-line tones).
export function intralineRanges(
  before: string,
  after: string,
): IntralineRanges | null {
  const ranges: IntralineRanges = { before: [], after: [] };
  let beforeOffset = 0;
  let afterOffset = 0;
  let commonLength = 0;
  for (const part of diffWordsWithSpace(before, after)) {
    const length = part.value.length;
    if (part.added) {
      ranges.after.push([afterOffset, afterOffset + length]);
      afterOffset += length;
    } else if (part.removed) {
      ranges.before.push([beforeOffset, beforeOffset + length]);
      beforeOffset += length;
    } else {
      // Whitespace-only common parts (e.g. shared indentation) do not make
      // two lines similar.
      if (part.value.trim().length > 0) {
        commonLength += length;
      }
      beforeOffset += length;
      afterOffset += length;
    }
  }
  if (ranges.before.length === 0 && ranges.after.length === 0) {
    return null;
  }
  const longest = Math.max(before.length, after.length);
  if (longest === 0 || commonLength / longest < 0.3) {
    return null;
  }
  return ranges;
}

// Splits tokens at range boundaries and flags the pieces inside a range, so
// syntax-highlighted spans can carry an extra emphasis background.
export function emphasizeRanges<T extends { text: string }>(
  tokens: T[],
  ranges: Array<[number, number]>,
): Array<T & { emphasized?: boolean }> {
  const output: Array<T & { emphasized?: boolean }> = [];
  let offset = 0;
  for (const token of tokens) {
    const start = offset;
    const end = offset + token.text.length;
    const cuts = new Set([start, end]);
    for (const [from, to] of ranges) {
      if (from > start && from < end) {
        cuts.add(from);
      }
      if (to > start && to < end) {
        cuts.add(to);
      }
    }
    const sorted = [...cuts].sort((a, b) => a - b);
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const from = sorted[index] ?? start;
      const to = sorted[index + 1] ?? end;
      const text = token.text.slice(from - start, to - start);
      if (!text) {
        continue;
      }
      const emphasized = ranges.some(([rs, re]) => from >= rs && to <= re);
      output.push({ ...token, text, emphasized });
    }
    offset = end;
  }
  return output;
}
