"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

export function ReviewFilters({
  repo,
  status,
}: {
  repo?: string;
  status: "" | "open" | "approved" | "changes_requested" | "archived";
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
    >
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-10 w-full rounded-md border bg-card pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue={repo ?? ""}
          name="repo"
          placeholder="Filter repo"
        />
      </label>
      <select
        aria-label="Status"
        className="h-10 rounded-md border bg-card px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={status}
        name="status"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="approved">Approved</option>
        <option value="changes_requested">Changes requested</option>
        <option value="archived">Archived</option>
      </select>
      <button
        className="h-10 rounded-md border border-primary bg-card px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="submit"
      >
        Filter
      </button>
    </form>
  );
}
