import { describe, expect, it } from "vitest";
import { agentSessions, attachments, comments, reviews } from "./schema";

describe("M1 schema", () => {
  it("contains review routing and agent session tables", () => {
    expect(reviews.repo.name).toBe("repo");
    expect(reviews.branch.name).toBe("branch");
    expect(comments.resolutionTarget.name).toBe("resolution_target");
    expect(comments.consumedAt.name).toBe("consumed_at");
    expect(agentSessions.workspacePath.name).toBe("workspace_path");
    expect(attachments.sha256.name).toBe("sha256");
    expect(attachments.data.name).toBe("data");
  });
});
