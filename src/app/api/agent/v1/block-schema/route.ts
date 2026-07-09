import { z } from "zod";
import { withAgentAuth } from "@/server/agent/http";
import { blockSchema } from "@/shared/blocks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAgentAuth(request, async () => ({
    schema: z.toJSONSchema(blockSchema),
  }));
}
