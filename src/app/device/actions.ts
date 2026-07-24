"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth-middleware";
import {
  type DeviceDecision,
  decideDeviceAuthorization,
  normalizeUserCode,
} from "@/server/device-authorization";
import { ensureUser } from "@/server/services/users";

export async function selectDeviceCode(formData: FormData) {
  const userCode = normalizeUserCode(String(formData.get("userCode") ?? ""));
  redirect(
    userCode ? `/device?user_code=${encodeURIComponent(userCode)}` : "/device",
  );
}

export async function submitDeviceDecision(formData: FormData) {
  const userCode = normalizeUserCode(String(formData.get("userCode") ?? ""));
  const decision = String(formData.get("decision") ?? "") as DeviceDecision;
  if (!userCode || !["approved", "denied"].includes(decision)) {
    redirect("/device?error=Invalid%20device%20authorization%20request.");
  }

  const session = await requireSession();
  const user = await ensureUser(session.user);
  let error: string | undefined;
  try {
    await decideDeviceAuthorization({
      userCode,
      userId: user.id,
      decision,
    });
  } catch (cause) {
    error =
      cause instanceof Error ? cause.message : "Device authorization failed.";
  }

  const params = new URLSearchParams({ user_code: userCode });
  if (error) {
    params.set("error", error);
  } else {
    params.set("decision", decision);
  }
  redirect(`/device?${params.toString()}`);
}
