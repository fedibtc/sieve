import { ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/auth-middleware";
import { listReviews } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";
import { ReviewFilters } from "./review-filters";

export const dynamic = "force-dynamic";

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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review recaps published by agents for human approval.
        </p>
      </header>

      {reviews.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-base font-medium">No reviews yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Run <code>pnpm seed</code> to load the fixture, or publish a recap
            through the sieve skill.
          </p>
          <Link
            className="mt-4 text-sm font-medium underline underline-offset-2"
            href="/settings/tokens"
          >
            Open settings to mint an agent token
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          <ReviewFilters repo={filters.repo} status={status ?? ""} />
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_180px_120px_130px_150px] border-b bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
              <span>Review</span>
              <span>Branch</span>
              <span>Status</span>
              <span>Open agent</span>
              <span>Updated</span>
            </div>
            {reviews.map((review) => (
              <Link
                key={review.id}
                className="grid grid-cols-[minmax(0,1fr)_180px_120px_130px_150px] border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/reviews/${review.id}`}
              >
                <span>
                  <span className="block font-medium">{review.title}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {review.repo}
                  </span>
                  <Badge className="ml-2" tone="neutral">
                    {review.origin === "derived"
                      ? "derived"
                      : (review.agentName ?? "authored")}
                  </Badge>
                  {review.prUrl ? (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                      title={review.prUrl}
                    >
                      PR #{review.prNumber ?? "?"}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  ) : null}
                </span>
                <span className="truncate font-mono text-sm text-muted-foreground">
                  {review.branch}
                </span>
                <span>
                  <StatusBadge status={review.status} />
                </span>
                <span>
                  {review.openComments > 0 ? (
                    <Badge tone="amber">
                      <MessageSquare className="h-3 w-3" />
                      {review.openComments}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  <RelativeTime value={review.updatedAt} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: "open" | "approved" | "changes_requested" | "archived";
}) {
  const tone =
    status === "open"
      ? "blue"
      : status === "approved"
        ? "green"
        : status === "changes_requested"
          ? "amber"
          : "neutral";
  return (
    <Badge className="capitalize" tone={tone}>
      {status.replace("_", " ")}
    </Badge>
  );
}
