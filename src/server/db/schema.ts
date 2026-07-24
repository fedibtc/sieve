import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

const id = () => nanoid(12);
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const reviewStatus = pgEnum("review_status", [
  "open",
  "approved",
  "changes_requested",
  "archived",
]);
export const createdBy = pgEnum("created_by", ["human", "agent", "system"]);
export const resolutionTarget = pgEnum("resolution_target", ["agent", "human"]);
export const commentStatus = pgEnum("comment_status", ["open", "resolved"]);
export const eventType = pgEnum("event_type", [
  "review.published",
  "review.updated",
  "review.status_changed",
  "comment.created",
  "comment.resolved",
  "feedback.consumed",
  "session.registered",
]);
export const agentKind = pgEnum("agent_kind", [
  "claude-code",
  "codex",
  "other",
]);
export const agentSessionStatus = pgEnum("agent_session_status", [
  "active",
  "ended",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_reference_id_idx").on(table.referenceId),
    uniqueIndex("apikey_key_idx").on(table.key),
  ],
);

export const deviceCode = pgTable(
  "device_code",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull(),
    userCode: text("user_code").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    pollingInterval: integer("polling_interval"),
    clientId: text("client_id"),
    scope: text("scope"),
  },
  (table) => [
    uniqueIndex("device_code_device_code_idx").on(table.deviceCode),
    uniqueIndex("device_code_user_code_idx").on(table.userCode),
    index("device_code_user_id_idx").on(table.userId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey().$defaultFn(id),
    title: text("title").notNull(),
    summary: text("summary"),
    repo: text("repo").notNull(),
    branch: text("branch").notNull(),
    baseRef: text("base_ref"),
    headSha: text("head_sha"),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    status: reviewStatus("status").notNull().default("open"),
    content: jsonb("content").notNull(),
    contentVersion: integer("content_version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    agentName: text("agent_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reviews_idempotency_key_idx").on(table.idempotencyKey),
    index("reviews_repo_branch_idx").on(table.repo, table.branch),
    index("reviews_repo_pr_number_idx").on(table.repo, table.prNumber),
  ],
);

export const reviewVersions = pgTable(
  "review_versions",
  {
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").notNull(),
    changeNote: text("change_note"),
    createdBy: createdBy("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.reviewId, table.version] })],
);

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey().$defaultFn(id),
    sha256: text("sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("attachments_sha256_idx").on(table.sha256),
    index("attachments_created_by_user_idx").on(table.createdByUserId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey().$defaultFn(id),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    parentCommentId: text("parent_comment_id"),
    message: text("message").notNull(),
    anchor: jsonb("anchor"),
    createdBy: createdBy("created_by").notNull(),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id),
    resolutionTarget: resolutionTarget("resolution_target")
      .notNull()
      .default("agent"),
    status: commentStatus("status").notNull().default("open"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    mentions: jsonb("mentions").notNull().default(sql`'[]'::jsonb`),
    contentVersionAtCreate: integer("content_version_at_create").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comments_review_status_idx").on(table.reviewId, table.status),
    index("comments_review_consumed_idx").on(table.reviewId, table.consumedAt),
  ],
);

export const events = pgTable("events", {
  id: text("id").primaryKey().$defaultFn(id),
  reviewId: text("review_id").references(() => reviews.id, {
    onDelete: "cascade",
  }),
  type: eventType("type").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdBy: createdBy("created_by").notNull(),
  actorUserId: text("actor_user_id").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewId: text("review_id").references(() => reviews.id, {
      onDelete: "cascade",
    }),
    repo: text("repo").notNull(),
    branch: text("branch").notNull(),
    agentKind: agentKind("agent_kind").notNull(),
    hostname: text("hostname").notNull(),
    workspacePath: text("workspace_path").notNull(),
    status: agentSessionStatus("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_sessions_user_idx").on(table.userId),
    index("agent_sessions_review_idx").on(table.reviewId),
    index("agent_sessions_repo_branch_idx").on(table.repo, table.branch),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  apiKeys: many(apikey),
  reviews: many(reviews),
}));

export const reviewRelations = relations(reviews, ({ one, many }) => ({
  createdByUser: one(user, {
    fields: [reviews.createdByUserId],
    references: [user.id],
  }),
  versions: many(reviewVersions),
  comments: many(comments),
  events: many(events),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  createdByUser: one(user, {
    fields: [attachments.createdByUserId],
    references: [user.id],
  }),
}));

export type User = typeof user.$inferSelect;
