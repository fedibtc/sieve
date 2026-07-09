import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db/client";
import {
  createPngAttachment,
  getAttachmentById,
  MAX_ATTACHMENT_BYTES,
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
});

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
