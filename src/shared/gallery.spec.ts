import { describe, expect, it } from "vitest";
import { blockSchema, reviewDocumentSchema } from "./blocks";
import { galleryEntries } from "./gallery";

describe("gallery entries", () => {
  it("uses unique slugs and block ids", () => {
    const slugs = galleryEntries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const blockIds = galleryEntries.flatMap((entry) =>
      entry.blocks.map((block) => block.id),
    );
    expect(new Set(blockIds).size).toBe(blockIds.length);
  });

  it("covers every block type", () => {
    const covered = new Set(
      galleryEntries.flatMap((entry) =>
        entry.blocks.map((block) => block.type),
      ),
    );
    const allTypes = blockSchema.options.map(
      (option) => option.shape.type.value,
    );
    expect([...covered].sort()).toEqual([...new Set(allTypes)].sort());
  });

  for (const entry of galleryEntries) {
    it(`validates as review content: ${entry.slug}`, () => {
      const parsed = reviewDocumentSchema.safeParse({
        version: 1,
        blocks: entry.blocks,
      });
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.success).toBe(true);
    });
  }
});
