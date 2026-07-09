import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviewDocumentSchema } from "@/shared/blocks";

describe("visual-diff-to-blocks", () => {
  it("emits ordered image-diff blocks with truncation notes", () => {
    const root = mkdtempSync(join(tmpdir(), "visual-diff-to-blocks-"));
    const actual = join(root, "actual");
    const expected = join(root, "expected");
    const overlays = join(root, "diff");
    mkdirSync(actual);
    mkdirSync(expected);
    mkdirSync(overlays);

    for (const name of ["changed-a", "changed-b", "added-a", "removed-a"]) {
      writeFileSync(join(actual, `showcase-${name}.png`), tinyPng());
      writeFileSync(join(expected, `showcase-${name}.png`), tinyPng());
      writeFileSync(join(overlays, `showcase-${name}.png`), tinyPng());
    }

    const regJson = join(root, "reg.json");
    writeFileSync(
      regJson,
      JSON.stringify({
        failedItems: [
          {
            actual: join(actual, "showcase-changed-a.png"),
            expected: join(expected, "showcase-changed-a.png"),
            diff: join(overlays, "showcase-changed-a.png"),
          },
          {
            actual: join(actual, "showcase-changed-b.png"),
            expected: join(expected, "showcase-changed-b.png"),
            diff: join(overlays, "showcase-changed-b.png"),
          },
        ],
        newItems: [{ actual: join(actual, "showcase-added-a.png") }],
        deletedItems: [{ expected: join(expected, "showcase-removed-a.png") }],
        passedItems: [{ actual: join(actual, "showcase-unchanged-a.png") }],
      }),
    );

    const output = execFileSync(
      "node",
      [
        join(process.cwd(), "scripts/visual-diff-to-blocks.mjs"),
        "--merge-base",
        "HEAD",
        "--actual-dir",
        actual,
        "--baseline-dir",
        expected,
        "--overlay-dir",
        overlays,
        "--reg-json",
        regJson,
        "--max-blocks",
        "3",
        "--manifest-only",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const manifest = JSON.parse(output);
    const imageBlocks = manifest.blocks.filter(
      (block: { type: string }) => block.type === "image-diff",
    );

    expect(manifest.summary).toMatchObject({
      changed: 2,
      added: 1,
      removed: 1,
      unchanged: 1,
      omitted: ["removed-a"],
    });
    expect(
      imageBlocks.map(
        (block: { data: { status: string } }) => block.data.status,
      ),
    ).toEqual(["changed", "changed", "added"]);
    expect(
      manifest.blocks.some(
        (block: { type: string }) => block.type === "rich-text",
      ),
    ).toBe(false);
    expect(manifest.blocks.at(-1).data.markdown).toContain(
      "Additional changed screens",
    );
    expect(manifest.blocks.at(-1).data.markdown).not.toContain("merge-base");
    expect(imageBlocks[0].data.before.attachmentId).toMatch(/^sha256:/);
    expect(() =>
      reviewDocumentSchema.parse({ version: 1, blocks: manifest.blocks }),
    ).not.toThrow();
  });
});

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
