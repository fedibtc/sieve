import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireBearerUser } from "@/server/auth-middleware";
import { createReviewMcpServer } from "@/server/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const maxBodyBytes = 2_500_000;

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }

  const auth = await requireBearerUser(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const server = createReviewMcpServer({
    userId: auth.user.id,
    baseUrl: `${url.protocol}//${url.host}`,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
