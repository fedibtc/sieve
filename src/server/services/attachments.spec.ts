import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db/client";
import {
  createPatchAttachment,
  createPngAttachment,
  getAttachmentById,
  MAX_ATTACHMENT_BYTES,
  PATCH_MIME_TYPE,
} from "@/server/services/attachments";
import { ensureUser } from "./users";

describe("attachment service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://attachments-${crypto.randomUUID()}`;
    resetDbForTests();
  });

  it("stores PNGs once by sha256 and returns dimensions", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const first = await createPngAttachment({
      data: tinyPng(),
      createdByUserId: user.id,
    });
    const second = await createPngAttachment({
      data: tinyPng(),
      createdByUserId: user.id,
    });

    expect(first.existing).toBe(false);
    expect(second.existing).toBe(true);
    expect(second.attachment.id).toBe(first.attachment.id);
    expect(second.attachment.width).toBe(1);
    expect(second.attachment.height).toBe(1);

    const stored = await getAttachmentById(first.attachment.id);
    expect(Buffer.from(stored?.data ?? []).equals(tinyPng())).toBe(true);
  });

  it("rejects non-PNG data and oversized payloads", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      createPngAttachment({
        data: Buffer.from("<svg></svg>"),
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/Only PNG/);
    await expect(
      createPngAttachment({
        data: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1),
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/2 MB/);
  });

  it("stores text patches once by sha256 without dimensions", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const patch = Buffer.from(tinyPatch());
    const first = await createPatchAttachment({
      data: patch,
      createdByUserId: user.id,
    });
    const second = await createPatchAttachment({
      data: patch,
      createdByUserId: user.id,
    });

    expect(first.existing).toBe(false);
    expect(first.attachment.mimeType).toBe(PATCH_MIME_TYPE);
    expect(first.attachment.width).toBeNull();
    expect(first.attachment.height).toBeNull();
    expect(second.existing).toBe(true);
    expect(second.attachment.id).toBe(first.attachment.id);
  });

  it("rejects empty, non-UTF-8, and oversized patches", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      createPatchAttachment({
        data: Buffer.alloc(0),
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/empty/);
    await expect(
      createPatchAttachment({
        data: Buffer.from([0xff, 0xfe, 0xc0]),
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/UTF-8/);
    await expect(
      createPatchAttachment({
        data: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 0x61),
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/2 MB/);
  });
});

function tinyPatch() {
  return [
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,2 +1,2 @@",
    "-const a = 1;",
    "+const a = 2;",
    " export default a;",
    "",
  ].join("\n");
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
