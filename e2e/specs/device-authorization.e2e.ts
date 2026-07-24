import { whoami } from "../helpers/api";
import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("device authorization approves, exchanges, and revokes a CLI key", async ({
  page,
  request,
}) => {
  const codeResponse = await request.post("/api/auth/device/code", {
    data: {
      client_id: "sieve-cli",
      scope: "api_key",
    },
  });
  expect(codeResponse.status()).toBe(200);
  const code = await codeResponse.json();

  await page.goto("/device");
  await expect(
    page.getByRole("heading", { name: "Authorize sieve CLI" }),
  ).toBeVisible();
  await page.getByLabel("User code").fill(code.user_code);
  await expectHittable(page.getByRole("button", { name: "Continue" }));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Sieve CLI", { exact: true })).toBeVisible();
  await expect(page.getByText("api_key", { exact: true })).toBeVisible();
  await expectHittable(page.getByRole("button", { name: "Approve" }));
  await expectHittable(page.getByRole("button", { name: "Deny" }));
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Device request approved/)).toBeVisible();

  const tokenResponse = await request.post("/api/auth/device/token", {
    data: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: code.device_code,
      client_id: "sieve-cli",
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const deviceToken = await tokenResponse.json();

  const exchangeResponse = await request.post("/api/tokens", {
    headers: { authorization: `Bearer ${deviceToken.access_token}` },
    data: { name: "E2E device token" },
  });
  expect(exchangeResponse.status()).toBe(201);
  const exchange = await exchangeResponse.json();
  expect(exchange.token.key).toMatch(/^sieve_/);
  expect((await whoami(request, exchange.token.key)).status()).toBe(200);

  const consumedSession = await request.get("/api/auth/get-session", {
    headers: { authorization: `Bearer ${deviceToken.access_token}` },
  });
  expect(await consumedSession.json()).toBeNull();

  const revoke = await request.delete(`/api/tokens/${exchange.token.id}`, {
    headers: { authorization: `Bearer ${exchange.token.key}` },
  });
  expect(revoke.status()).toBe(200);
  expect((await whoami(request, exchange.token.key)).status()).toBe(401);
});
