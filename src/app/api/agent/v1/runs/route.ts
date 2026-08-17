import {
  baseUrlFromRequest,
  parseJson,
  parseSearch,
  withAgentAuth,
} from "@/server/agent/http";
import { listRunsInput, recordRunInput } from "@/server/agent/schemas";
import { listReviewRuns, recordReviewRun } from "@/server/services/review-runs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAgentAuth(request, async () => ({
    runs: await listReviewRuns(parseSearch(request, listRunsInput)),
  }));
}

export async function POST(request: Request) {
  return withAgentAuth(request, async ({ user }) => {
    const input = await parseJson(request, recordRunInput);
    const run = await recordReviewRun({
      ...input,
      createdByUserId: user.id,
    });
    return {
      run,
      url: `${baseUrlFromRequest(request)}/api/agent/v1/runs/${run.id}`,
    };
  });
}
