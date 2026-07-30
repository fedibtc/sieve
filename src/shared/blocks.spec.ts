import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectAttachmentIds, reviewDocumentSchema } from "./blocks";
import { credentialAppSeedReview } from "./fixtures";

type BlockFixture = {
  expect: "valid" | "invalid";
  document: unknown;
};

describe("review block schema", () => {
  it("accepts the credential-app fixture corpus", () => {
    expect(() =>
      reviewDocumentSchema.parse(credentialAppSeedReview),
    ).not.toThrow();
  });

  it.each(loadBlockFixtures())("matches shared block fixture $name", ({
    fixture,
  }) => {
    const parse = () => reviewDocumentSchema.parse(fixture.document);
    if (fixture.expect === "valid") {
      expect(parse).not.toThrow();
    } else {
      expect(parse).toThrow();
    }
  });

  it("rejects duplicate block ids", () => {
    const invalid = {
      version: 1,
      blocks: [
        credentialAppSeedReview.blocks[0],
        {
          ...credentialAppSeedReview.blocks[1],
          id: credentialAppSeedReview.blocks[0].id,
        },
      ],
    };

    expect(() => reviewDocumentSchema.parse(invalid)).toThrow(
      /Duplicate block id/,
    );
  });

  it("rejects documents over 2 MB", () => {
    const invalid = {
      version: 1,
      blocks: [
        {
          id: "large",
          type: "rich-text",
          data: { markdown: "x".repeat(2_000_001) },
        },
      ],
    };

    expect(() => reviewDocumentSchema.parse(invalid)).toThrow(
      /exceeds the 2 MB limit/,
    );
  });

  it("rejects annotations that reference lines outside the block", () => {
    const invalid = {
      version: 1,
      blocks: [
        {
          id: "diff",
          type: "diff",
          data: {
            filename: "src/example.ts",
            before: "const a = 1;",
            after: "const a = 2;",
            annotations: [{ side: "after", lines: "12", note: "No line 12" }],
          },
        },
      ],
    };

    expect(() => reviewDocumentSchema.parse(invalid)).toThrow(
      /Annotation lines out of range/,
    );
  });

  it("accepts image-diff blocks and collects attachment ids", () => {
    const document = reviewDocumentSchema.parse({
      version: 1,
      blocks: [
        {
          id: "visual-login",
          type: "image-diff",
          data: {
            name: "login screen",
            status: "changed",
            before: { attachmentId: "before", width: 100, height: 80 },
            after: { attachmentId: "after", width: 100, height: 80 },
            diff: { attachmentId: "diff", width: 100, height: 80 },
            baseline: { ref: "merge-base@abc123", platform: "darwin-arm64" },
          },
        },
      ],
    });

    expect(collectAttachmentIds(document)).toEqual(["before", "after", "diff"]);
  });

  it("accepts screen recordings and collects their attachment ids", () => {
    const document = reviewDocumentSchema.parse({
      version: 1,
      blocks: [
        {
          id: "recording",
          type: "screen-recording",
          data: {
            attachmentId: "recording-attachment",
            title: "Reviewer journey",
          },
        },
      ],
    });

    expect(collectAttachmentIds(document)).toEqual(["recording-attachment"]);
  });

  it("rejects invalid image-diff status/ref pairings", () => {
    const invalid = {
      version: 1,
      blocks: [
        {
          id: "visual-login",
          type: "image-diff",
          data: {
            name: "login screen",
            status: "added",
            before: { attachmentId: "before", width: 100, height: 80 },
            after: { attachmentId: "after", width: 100, height: 80 },
            diff: { attachmentId: "diff", width: 100, height: 80 },
          },
        },
      ],
    };

    expect(() => reviewDocumentSchema.parse(invalid)).toThrow(
      /added image-diff blocks cannot include before/,
    );
  });
});

function loadBlockFixtures() {
  const root = join(process.cwd(), "fixtures", "blocks");
  return readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      fixture: JSON.parse(
        readFileSync(join(root, name), "utf8"),
      ) as BlockFixture,
    }));
}
