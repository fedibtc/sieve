import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth";
import { resetDbForTests } from "@/server/db/client";
import { MAX_ATTACHMENT_BYTES } from "@/server/services/attachments";
import { GET as getAttachment } from "./[id]/route";
import { GET as getByHash } from "./by-hash/[sha256]/route";
import { POST } from "./route";

describe("attachment routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://attachment-routes-${crypto.randomUUID()}`;
    resetDbForTests();
    resetAuthForTests();
  });

  it("uploads, dedupes, probes by hash, and streams PNG bytes", async () => {
    const data = tinyPng();
    const first = await POST(
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

    const second = await POST(
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

  it("uploads text patches and streams them back with a charset", async () => {
    const patch = "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n";
    const uploaded = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-type": "text/x-patch", host: "localhost" },
        body: patch,
      }),
    );
    const payload = await uploaded.json();
    expect(uploaded.status).toBe(201);
    expect(payload).toMatchObject({
      mimeType: "text/x-patch",
      width: null,
      height: null,
      existing: false,
    });

    const streamed = await getAttachment(
      new Request(`http://localhost/api/attachments/${payload.id}`, {
        headers: { host: "localhost" },
      }),
      { params: Promise.resolve({ id: payload.id }) },
    );
    expect(streamed.status).toBe(200);
    expect(streamed.headers.get("content-type")).toBe(
      "text/x-patch; charset=utf-8",
    );
    expect(await streamed.text()).toBe(patch);
  });

  it("rejects unauthenticated, non-PNG, and oversized requests", async () => {
    const unauthenticated = await POST(
      new Request("https://example.com/api/attachments", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: tinyPng(),
      }),
    );
    expect(unauthenticated.status).toBe(401);

    const nonPng = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-type": "image/svg+xml", host: "localhost" },
        body: "<svg></svg>",
      }),
    );
    expect(nonPng.status).toBe(415);

    const oversized = await POST(
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
});

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
