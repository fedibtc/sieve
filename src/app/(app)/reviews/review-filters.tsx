"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

const controlClass =
  "h-8 rounded-md border bg-canvas text-sm text-fg shadow-input outline-none transition-colors placeholder:text-fg-muted focus-visible:border-focus focus-visible:ring-1 focus-visible:ring-focus";

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
      className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]"
    >
      <label className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          className={`${controlClass} w-full pl-8 pr-3`}
          defaultValue={repo ?? ""}
          name="repo"
          placeholder="Filter repo"
        />
      </label>
      <select
        aria-label="Status"
        className={`${controlClass} cursor-pointer px-3`}
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
        className="h-8 cursor-pointer rounded-md border border-btn-border bg-btn px-4 text-sm font-medium text-btn-fg shadow-btn transition-colors hover:bg-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="submit"
      >
        Filter
      </button>
    </form>
  );
}
