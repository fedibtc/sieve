"use client";

import { useEffect, useMemo, useState } from "react";
import { ColorModeSelect } from "@/components/color-mode";
import type { ReviewAnchor } from "@/shared/anchors";
import { galleryEntries } from "@/shared/gallery";
import { BlocksList, type Thread } from "./review-detail";

type GalleryEvent = {
  id: number;
  kind: "anchor" | "answer";
  payload: unknown;
};

// Canned threads let the gallery demo line-level thread pills without a server.
const demoThreads: Record<string, Thread[]> = {
  "gallery-diff-annotated": [
    {
      root: {
        id: "gallery-thread-1",
        message: "Should RangeError include the received unit as well?",
        anchor: {
          blockId: "gallery-diff-annotated",
          kind: "line",
          filePath: "src/lib/duration/format.ts",
          line: { side: "after", start: 3 },
        },
        resolutionTarget: "agent",
        status: "open",
        consumedAt: null,
        authorName: "Demo Reviewer",
        authorEmail: "demo@example.com",
        anchorLabel: "src/lib/duration/format.ts · after:3",
        detached: false,
        createdAt: "2026-07-01T12:00:00.000Z",
        createdBy: "human",
      },
      replies: [],
    },
  ],
};

export function BlockGallery() {
  const [selectedSlug, setSelectedSlug] = useState(
    galleryEntries[0]?.slug ?? "",
  );
  const [events, setEvents] = useState<GalleryEvent[]>([]);

  useEffect(() => {
    function applyHash() {
      const slug = window.location.hash.slice(1);
      if (slug && galleryEntries.some((entry) => entry.slug === slug)) {
        setSelectedSlug(slug);
      }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const entry =
    galleryEntries.find((item) => item.slug === selectedSlug) ??
    galleryEntries[0];

  const threadsByBlock = useMemo(() => {
    const map = new Map<string, Thread[]>();
    for (const block of entry?.blocks ?? []) {
      const threads = demoThreads[block.id];
      if (threads) {
        map.set(block.id, threads);
      }
    }
    return map;
  }, [entry]);

  function selectEntry(slug: string) {
    setSelectedSlug(slug);
    setEvents([]);
    window.history.replaceState(null, "", `#${slug}`);
  }

  function recordEvent(kind: GalleryEvent["kind"], payload: unknown) {
    setEvents((current) =>
      [{ id: (current[0]?.id ?? 0) + 1, kind, payload }, ...current].slice(
        0,
        5,
      ),
    );
  }

  if (!entry) {
    return null;
  }

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-40 h-12 border-b bg-page-header">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-3 px-6">
          <h1 className="text-sm font-semibold">Block gallery</h1>
          <p className="text-sm text-fg-muted">
            Local demo of review blocks, no review or database required.
          </p>
          <span className="flex-1" />
          <ColorModeSelect />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-8 px-8 py-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <nav
          aria-label="Gallery entries"
          className="self-start lg:sticky lg:top-20"
        >
          <ul className="space-y-1">
            {galleryEntries.map((item) => (
              <li key={item.slug}>
                <button
                  aria-current={item.slug === entry.slug ? "page" : undefined}
                  className={`relative w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    item.slug === entry.slug
                      ? "bg-control-selected font-semibold text-fg before:absolute before:-left-2 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-accent-emphasis"
                      : "text-fg hover:bg-control-hover"
                  }`}
                  type="button"
                  onClick={() => selectEntry(item.slug)}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-label={entry.title} className="min-w-0 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">{entry.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{entry.description}</p>
          </div>
          <div className="space-y-8" data-gallery-canvas>
            <BlocksList
              blocks={entry.blocks}
              threadsByBlock={threadsByBlock}
              onAnchor={(anchor: ReviewAnchor) => recordEvent("anchor", anchor)}
              onAnswer={(anchor: ReviewAnchor, answer: string) =>
                recordEvent("answer", { anchor, answer })
              }
            />
          </div>
        </section>
        <aside
          aria-label="Emitted events"
          className="self-start lg:sticky lg:top-20"
        >
          <div className="rounded-md border bg-canvas">
            <div className="rounded-t-md border-b bg-canvas-subtle px-3 py-2 text-sm font-semibold">
              Emitted events
            </div>
            <div
              className="max-h-[70vh] space-y-3 overflow-y-auto p-4"
              data-gallery-events
            >
              {events.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  Interact with the block: line numbers, file rows, and answer
                  buttons emit the anchors a review would post.
                </p>
              ) : (
                events.map((event) => (
                  <pre
                    key={event.id}
                    className="overflow-x-auto rounded-md bg-canvas-subtle p-2 font-mono text-xs leading-5"
                  >
                    {`${event.kind}\n${JSON.stringify(event.payload, null, 2)}`}
                  </pre>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
