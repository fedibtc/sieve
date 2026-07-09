import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { authenticateRequest } from "@/server/auth-middleware";

export type AgentContext = Awaited<ReturnType<typeof authenticateRequest>> & {};

export async function withAgentAuth<T>(
  request: Request,
  handler: (context: NonNullable<AgentContext>) => Promise<T>,
) {
  const context = await authenticateRequest(request);
  if (!context) {
    return agentError("auth", "Authentication required", 401);
  }

  try {
    return NextResponse.json(await handler(context));
  } catch (error) {
    return handleAgentError(error);
  }
}

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function parseSearch<T extends z.ZodType>(
  request: Request,
  schema: T,
): z.infer<T> {
  const url = new URL(request.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

export function agentError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleAgentError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation",
          message: "Request validation failed",
          issues: error.issues,
        },
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const status =
    message.includes("not found") || message.includes("Not found") ? 404 : 400;
  return agentError("request", message, status);
}

export function baseUrlFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
