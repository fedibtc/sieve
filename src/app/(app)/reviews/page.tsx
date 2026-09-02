import {
  Archive,
  Check,
  ExternalLink,
  FileDiff,
  GitPullRequestArrow,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/auth-middleware";
import { listReviews } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";
import { ReviewFilters } from "./review-filters";

export const dynamic = "force-dynamic";

type ReviewStatus = "open" | "approved" | "changes_requested" | "archived";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string; status?: string }>;
}) {
  const session = await requireSession();
  await ensureUser(session.user);
  const filters = await searchParams;
  const status =
    filters.status === "open" ||
    filters.status === "approved" ||
    filters.status === "changes_requested" ||
    filters.status === "archived"
      ? filters.status
      : null;
  const reviews = await listReviews({ repo: filters.repo, status });
  const openCount = reviews.filter((review) => review.status === "open").length;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-8 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reviews</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Review recaps published by agents for human approval.
          </p>
        </div>
      </header>

      {reviews.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed p-10 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-md border bg-canvas-subtle">
            <MessageSquare className="h-5 w-5 text-fg-muted" />
          </div>
          <h2 className="text-base font-semibold">No reviews yet</h2>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            Run <code>pnpm seed</code> to load the fixture, or publish a recap
            through the sieve skill.
          </p>
          <Link
            className="mt-4 text-sm text-accent-fg hover:underline"
            href="/settings/tokens"
          >
            Open settings to mint an agent token
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          <ReviewFilters repo={filters.repo} status={status ?? ""} />
          <div className="overflow-hidden rounded-md border bg-canvas">
            <div className="flex items-center gap-4 border-b bg-canvas-subtle px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <GitPullRequestArrow className="h-4 w-4" />
                {openCount} Open
              </span>
              <span className="inline-flex items-center gap-1.5 text-fg-muted">
                <Check className="h-4 w-4" />
                {reviews.length - openCount} Closed
              </span>
            </div>
            {reviews.map((review) => (
              <Link
                key={review.id}
                className="grid grid-cols-[16px_minmax(0,1fr)_auto] gap-3 border-b px-4 py-2 transition-colors last:border-b-0 hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                href={`/reviews/${review.id}`}
              >
                <StateIcon status={review.status} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base leading-6">
                      {review.title}
                    </span>
                    <Badge tone="neutral">
                      {review.origin === "derived"
                        ? "derived"
                        : (review.agentName ?? "authored")}
                    </Badge>
                    {review.prUrl ? (
                      <Badge title={review.prUrl} tone="neutral">
                        PR #{review.prNumber ?? "?"}
                        <ExternalLink className="h-3 w-3" />
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-fg-muted">
                    <span className="font-mono">{review.repo}</span>
                    {" · "}
                    <span className="font-mono">{review.branch}</span>
                    {" · updated "}
                    <RelativeTime value={review.updatedAt} />
                  </span>
                </span>
                <span className="flex items-start justify-end pt-1 text-xs text-fg-muted">
                  {review.openComments > 0 ? (
                    <span
                      className="inline-flex items-center gap-1"
                      title={`${review.openComments} open agent thread${review.openComments === 1 ? "" : "s"}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {review.openComments}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// the sr-only status word stays: the list spec matches rows by it
function StateIcon({ status }: { status: ReviewStatus }) {
  const states = {
    open: {
      label: "open",
      Icon: GitPullRequestArrow,
      className: "text-success-fg",
    },
    approved: { label: "approved", Icon: Check, className: "text-done-fg" },
    changes_requested: {
      label: "changes requested",
      Icon: FileDiff,
      className: "text-danger-fg",
    },
    archived: { label: "archived", Icon: Archive, className: "text-fg-muted" },
  };
  const state = states[status];
  const Icon = state.Icon;
  return (
    <span className={`pt-1 ${state.className}`}>
      <Icon className="h-4 w-4" />
      <span className="sr-only">{state.label}</span>
    </span>
  );
}
