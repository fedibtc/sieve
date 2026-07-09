import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  commentInput,
  consumeFeedbackInput,
  endSessionInput,
  publishReviewInput,
  replyInput,
  resolveInput,
  reviewIdInput,
  sessionInput,
  statusInput,
} from "@/server/agent/schemas";
import {
  endAgentSession,
  registerAgentSession,
} from "@/server/services/agent-sessions";
import {
  consumeFeedback,
  createComment,
  getFeedbackPartition,
  resolveComment,
} from "@/server/services/comments";
import {
  getReview,
  listReviews,
  updateReviewStatus,
  upsertReview,
} from "@/server/services/reviews";
import { blockSchema } from "@/shared/blocks";

type McpContext = {
  userId: string;
  baseUrl: string;
};

export function createReviewMcpServer(context: McpContext) {
  const server = new McpServer({
    name: "sieve",
    version: "0.1.0",
  });

  server.registerTool(
    "publish_review",
    {
      description:
        "Create or update an agent-authored structured review recap. Reuse the same idempotencyKey to publish v2+.",
      inputSchema: publishReviewInput,
    },
    async (input) => {
      const review = await upsertReview({
        ...input,
        createdByUserId: context.userId,
      });
      return jsonResult({
        review,
        url: `${context.baseUrl}/reviews/${review.id}`,
      });
    },
  );

  server.registerTool(
    "list_reviews",
    {
      description: "List review recaps visible in the helper.",
      inputSchema: z.object({}),
    },
    async () => jsonResult({ reviews: await listReviews() }),
  );

  server.registerTool(
    "get_block_schema",
    {
      description:
        "Return the current Sieve block JSON schema for grounded review authoring.",
      inputSchema: z.object({}),
    },
    async () =>
      jsonResult({
        schema: z.toJSONSchema(blockSchema),
      }),
  );

  server.registerTool(
    "get_review",
    {
      description: "Fetch a review recap and its current structured document.",
      inputSchema: reviewIdInput,
    },
    async ({ reviewId }) => {
      const review = await getReview(reviewId);
      if (!review) {
        throw new Error("Review not found");
      }
      return jsonResult({
        review,
        url: `${context.baseUrl}/reviews/${review.id}`,
      });
    },
  );

  server.registerTool(
    "get_review_feedback",
    {
      description:
        "Return unconsumed feedback partitioned by routing target, detached state, and resolution state.",
      inputSchema: reviewIdInput,
    },
    async ({ reviewId }) => jsonResult(await getFeedbackPartition(reviewId)),
  );

  server.registerTool(
    "add_review_comment",
    {
      description: "Create an agent-authored review comment or reply.",
      inputSchema: commentInput,
    },
    async (input) =>
      jsonResult({
        comment: await createComment({
          reviewId: input.reviewId,
          authorUserId: context.userId,
          createdBy: "agent",
          message: input.message,
          anchor: input.anchor ?? null,
          resolutionTarget: input.resolutionTarget,
        }),
      }),
  );

  server.registerTool(
    "reply_to_comment",
    {
      description: "Reply to an existing review comment thread as the agent.",
      inputSchema: replyInput,
    },
    async (input) =>
      jsonResult({
        comment: await createComment({
          reviewId: input.reviewId,
          authorUserId: context.userId,
          createdBy: "agent",
          message: input.message,
          parentCommentId: input.commentId,
          resolutionTarget: "agent",
        }),
      }),
  );

  server.registerTool(
    "resolve_comment",
    {
      description:
        "Reply optionally and mark a thread resolved after the fix is validated.",
      inputSchema: resolveInput,
    },
    async (input) =>
      jsonResult({
        comment: await resolveComment({
          reviewId: input.reviewId,
          commentId: input.commentId,
          actorUserId: context.userId,
          actor: "agent",
          resolved: true,
          replyMessage: input.message,
        }),
      }),
  );

  server.registerTool(
    "consume_feedback",
    {
      description:
        "Mark specific surfaced human feedback comments as read by the agent. If commentIds is omitted, marks currently unconsumed human feedback.",
      inputSchema: consumeFeedbackInput,
    },
    async ({ reviewId, commentIds }) =>
      jsonResult({
        consumed: await consumeFeedback(reviewId, context.userId, commentIds),
      }),
  );

  server.registerTool(
    "update_review_status",
    {
      description:
        "Update review status as the agent. Agents may reopen or archive but cannot approve.",
      inputSchema: statusInput,
    },
    async (input) =>
      jsonResult({
        review: await updateReviewStatus({
          reviewId: input.reviewId,
          status: input.status,
          actorUserId: context.userId,
          actor: "agent",
        }),
      }),
  );

  server.registerTool(
    "register_agent_session",
    {
      description:
        "Register or refresh the current local agent workspace session.",
      inputSchema: sessionInput,
    },
    async (input) =>
      jsonResult({
        session: await registerAgentSession({
          ...input,
          userId: context.userId,
        }),
      }),
  );

  server.registerTool(
    "end_agent_session",
    {
      description: "Mark an agent workspace session ended.",
      inputSchema: endSessionInput,
    },
    async ({ sessionId }) =>
      jsonResult({
        session: await endAgentSession({ sessionId, userId: context.userId }),
      }),
  );

  return server;
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
