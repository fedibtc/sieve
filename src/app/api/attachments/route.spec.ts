import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth";
import { resetDbForTests } from "@/server/db/client";
import { MAX_ATTACHMENT_BYTES } from "@/server/services/attachments";
import { GET as getAttachment } from "./[id]/route";
import { GET as getByHash } from "./by-hash/[sha256]/route";
import { POST as legacyPost } from "./route";
import { POST as completeUpload } from "./uploads/[id]/complete/route";
import { PUT as putUploadContent } from "./uploads/[id]/content/route";
import { POST as reserveUpload } from "./uploads/route";

describe("attachment routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://attachment-routes-${crypto.randomUUID()}`;
    process.env.SIEVE_ATTACHMENT_DIR = join(
      tmpdir(),
      `sieve-attachment-tests-${crypto.randomUUID()}`,
    );
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    resetDbForTests();
    resetAuthForTests();
  });

  it("uploads, dedupes, probes by hash, and streams PNG bytes", async () => {
    const data = tinyPng();
    const first = await legacyPost(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "content-length": String(data.byteLength),
          host: "localhost",
        },
        body: data,
      }),
    );
    const firstPayload = await first.json();
    expect(first.status).toBe(201);
    expect(firstPayload).toMatchObject({
      bytes: data.byteLength,
      width: 1,
      height: 1,
      existing: false,
    });

    const second = await legacyPost(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-type": "image/png", host: "localhost" },
        body: data,
      }),
    );
    const secondPayload = await second.json();
    expect(second.status).toBe(200);
    expect(secondPayload).toMatchObject({
      id: firstPayload.id,
      existing: true,
    });

    const sha256 = createHash("sha256").update(data).digest("hex");
    const probe = await getByHash(
      new Request(`http://localhost/api/attachments/by-hash/${sha256}`, {
        headers: { host: "localhost" },
      }),
      { params: Promise.resolve({ sha256 }) },
    );
    expect(probe.status).toBe(200);

    const image = await getAttachment(
      new Request(`http://localhost/api/attachments/${firstPayload.id}`, {
        headers: { host: "localhost" },
      }),
      { params: Promise.resolve({ id: firstPayload.id }) },
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer()).equals(data)).toBe(true);
  });

  it("rejects unauthenticated, non-PNG, and oversized requests", async () => {
    const unauthenticated = await legacyPost(
      new Request("https://example.com/api/attachments", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: tinyPng(),
      }),
    );
    expect(unauthenticated.status).toBe(401);

    const nonPng = await legacyPost(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-type": "image/svg+xml", host: "localhost" },
        body: "<svg></svg>",
      }),
    );
    expect(nonPng.status).toBe(415);

    const oversized = await legacyPost(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          "content-length": String(MAX_ATTACHMENT_BYTES + 1),
          host: "localhost",
        },
        body: tinyPng(),
      }),
    );
    expect(oversized.status).toBe(413);
  });

  it("reserves, uploads, completes, deduplicates, and serves direct uploads", async () => {
    const data = tinyPng();
    const sha256 = createHash("sha256").update(data).digest("hex");
    const reservation = await reserveUpload(
      new Request("http://localhost/api/attachments/uploads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost",
        },
        body: JSON.stringify({
          sha256,
          mimeType: "image/png",
          bytes: data.byteLength,
          originalFilename: "capture.png",
          width: 1,
          height: 1,
        }),
      }),
    );
    expect(reservation.status).toBe(201);
    const reserved = await reservation.json();
    expect(reserved).toMatchObject({
      existing: false,
      status: "pending",
      upload: {
        requiresAuth: true,
        uploadHeaders: { "content-type": "image/png" },
      },
    });

    const upload = await putUploadContent(
      new Request(reserved.upload.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "content-length": String(data.byteLength),
          host: "localhost",
        },
        body: data,
      }),
      { params: Promise.resolve({ id: reserved.id }) },
    );
    expect(upload.status).toBe(204);

    const completed = await completeUpload(
      new Request(
        `http://localhost/api/attachments/uploads/${reserved.id}/complete`,
        {
          method: "POST",
          headers: { host: "localhost" },
        },
      ),
      { params: Promise.resolve({ id: reserved.id }) },
    );
    expect(completed.status).toBe(200);
    await expect(completed.json()).resolves.toMatchObject({
      id: reserved.id,
      status: "ready",
    });

    const image = await getAttachment(
      new Request(`http://localhost/api/attachments/${reserved.id}`, {
        headers: { host: "localhost" },
      }),
      { params: Promise.resolve({ id: reserved.id }) },
    );
    expect(image.status).toBe(200);
    expect(Buffer.from(await image.arrayBuffer()).equals(data)).toBe(true);

    const duplicate = await reserveUpload(
      new Request("http://localhost/api/attachments/uploads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost",
        },
        body: JSON.stringify({
          sha256,
          mimeType: "image/png",
          bytes: data.byteLength,
          originalFilename: "capture-again.png",
        }),
      }),
    );
    await expect(duplicate.json()).resolves.toMatchObject({
      id: reserved.id,
      existing: true,
      upload: null,
    });
  });
});

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
