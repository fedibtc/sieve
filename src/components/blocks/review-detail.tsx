"use client";

import { diffLines } from "diff";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  Folder,
  GitBranch,
  GitCompareArrows,
  Image as ImageIcon,
  MessageSquare,
  Radio,
  RotateCcw,
  Send,
  TableProperties,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useColorScheme } from "@/components/color-mode";
import { RelativeTime } from "@/components/relative-time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  type HighlightLine,
  highlightCode,
  highlightCodeLines,
  inferLanguageFromFilename,
  renderHighlightLine,
} from "@/lib/highlight";
import { emphasizeRanges, intralineRanges } from "@/lib/intraline";
import type { ReviewAnchor } from "@/shared/anchors";
import type {
  BlockSeverity,
  ReviewBlock,
  ReviewDocument,
  ReviewRecommendation,
} from "@/shared/blocks";
import { Button } from "../ui/button";

const DIFF_VIEW_MODE_STORAGE_KEY = "sieve:diff-view-mode";
const SPLIT_DIFF_MIN_WIDTH = 760;

type Review = {
  id: string;
  title: string;
  summary: string | null;
  origin: "authored" | "derived";
  repo: string;
  branch: string;
  baseRef: string | null;
  headSha: string | null;
  prNumber: number | null;
  prUrl: string | null;
  status: "open" | "approved" | "changes_requested" | "archived";
  content: ReviewDocument;
  contentVersion: number;
  updatedAt: string;
  agentName: string | null;
};

export type ThreadComment = {
  id: string;
  message: string;
  anchor: ReviewAnchor | null;
  resolutionTarget: "agent" | "human";
  status: "open" | "resolved";
  consumedAt: string | null;
  authorName: string | null;
  authorEmail: string | null;
  anchorLabel: string;
  detached: boolean;
  createdAt: string;
  createdBy: "human" | "agent";
};

export type Thread = {
  root: ThreadComment;
  replies: ThreadComment[];
};

export function ReviewDetail({
  initialReview,
  initialThreads,
}: {
  initialReview: Review;
  initialThreads: Thread[];
}) {
  const [review, setReview] = useState(initialReview);
  const [threads, setThreads] = useState(initialThreads);
  const [activeAnchor, setActiveAnchor] = useState<ReviewAnchor | null>(null);
  const [message, setMessage] = useState("");
  const [resolutionTarget, setResolutionTarget] = useState<"agent" | "human">(
    "agent",
  );
  const [pending, setPending] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [lastPostedThreadId, setLastPostedThreadId] = useState<string | null>(
    null,
  );
  const [justSynced, setJustSynced] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const textSelection = useTextSelectionAnchor();

  const threadsByBlock = useMemo(() => {
    const map = new Map<string, Thread[]>();
    for (const thread of threads) {
      const blockId = thread.root.anchor?.blockId;
      if (!blockId) {
        continue;
      }
      map.set(blockId, [...(map.get(blockId) ?? []), thread]);
    }
    return map;
  }, [threads]);

  async function refreshThreads() {
    const response = await fetch(`/api/reviews/${review.id}/comments`);
    if (!response.ok) {
      throw new Error("Could not refresh comments");
    }
    const data = (await response.json()) as { threads: Thread[] };
    setThreads(data.threads);
  }

  useEffect(() => {
    const reviewId = review.id;
    let failures = 0;
    const interval = window.setInterval(() => {
      void Promise.all([
        fetch(`/api/reviews/${reviewId}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Could not refresh review");
            }
            return response.json();
          })
          .then((data: { review: Review }) => {
            setReview((current) =>
              stableJson(current) === stableJson(data.review)
                ? current
                : data.review,
            );
          }),
        fetch(`/api/reviews/${reviewId}/comments`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Could not refresh comments");
            }
            return response.json();
          })
          .then((data: { threads: Thread[] }) => {
            setThreads((current) =>
              stableJson(current) === stableJson(data.threads)
                ? current
                : data.threads,
            );
          }),
      ])
        .then(() => {
          failures = 0;
          setReconnecting(false);
          setJustSynced(true);
          window.setTimeout(() => setJustSynced(false), 1600);
        })
        .catch(() => {
          failures += 1;
          if (failures >= 2) {
            setReconnecting(true);
          }
        });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [review.id]);

  useEffect(() => {
    flashAnchor(activeAnchor);
  }, [activeAnchor]);

  async function submitComment() {
    if (!message.trim()) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          anchor: activeAnchor,
          resolutionTarget,
        }),
      });
      const data = (await response.json()) as { comment?: { id: string } };
      setMessage("");
      await refreshThreads();
      if (data.comment?.id) {
        setLastPostedThreadId(data.comment.id);
        window.setTimeout(() => scrollToThread(data.comment?.id), 0);
      }
    } finally {
      setPending(false);
    }
  }

  async function setCommentStatus(
    commentId: string,
    status: "open" | "resolved",
  ) {
    await fetch(`/api/reviews/${review.id}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refreshThreads();
  }

  async function setReviewStatus(
    status: "open" | "approved" | "changes_requested" | "archived",
  ) {
    const response = await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json()) as { review: Review };
    setReview(data.review);
    setConfirmApprove(false);
  }

  async function submitQuestionAnswer(anchor: ReviewAnchor, answer: string) {
    if (!answer.trim() || pending) {
      return;
    }
    setActiveAnchor(anchor);
    setPending(true);
    try {
      const response = await fetch(`/api/reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: answer,
          anchor,
          resolutionTarget: "agent",
        }),
      });
      if (!response.ok) {
        throw new Error("Could not post answer");
      }
      const data = (await response.json()) as { comment?: { id: string } };
      await refreshThreads();
      if (data.comment?.id) {
        setLastPostedThreadId(data.comment.id);
        window.setTimeout(() => scrollToThread(data.comment?.id), 0);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <header className="border-b bg-canvas">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-8 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <Link
              className="text-sm text-fg-muted transition-colors hover:text-fg"
              href="/reviews"
            >
              Reviews /
            </Link>
            <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">
              {review.title}
            </h1>
            {review.summary ? (
              <p className="mt-2 max-w-3xl text-base text-fg-muted">
                {review.summary}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1 rounded-full border bg-canvas px-2 py-0.5 font-mono text-xs">
                {review.repo}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-canvas px-2 py-0.5 font-mono text-xs">
                <GitBranch className="h-3 w-3" />
                {review.branch}
              </span>
              <StatusBadge status={review.status} />
              <span className="inline-flex items-center rounded-full border bg-canvas px-2 py-0.5 font-mono text-xs">
                v{review.contentVersion}
              </span>
              {review.origin === "derived" ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-canvas px-2 py-0.5 text-xs">
                  <GitCompareArrows className="h-3 w-3" />
                  derived from the diff
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border bg-canvas px-2 py-0.5 text-xs">
                  <Bot className="h-3 w-3" />
                  {review.agentName ?? "authored"}
                </span>
              )}
              <RelativeTime prefix="updated" value={review.updatedAt} />
              {review.prUrl ? (
                <a
                  className="inline-flex items-center gap-1 rounded-md border bg-canvas px-2 py-1 text-xs font-medium transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={review.prUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  PR #{review.prNumber ?? "?"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {review.status === "approved" ||
            review.status === "changes_requested" ? (
              <Button variant="outline" onClick={() => setReviewStatus("open")}>
                <RotateCcw className="h-4 w-4" />
                Reopen
              </Button>
            ) : confirmApprove ? (
              <div className="flex items-center gap-2 rounded-md border bg-canvas p-1">
                <span className="px-2 text-sm text-fg-muted">
                  Approve review?
                </span>
                <Button size="sm" onClick={() => setReviewStatus("approved")}>
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmApprove(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Button
                  className="border-attention-border text-attention-fg hover:bg-attention-muted"
                  variant="outline"
                  onClick={() => setReviewStatus("changes_requested")}
                >
                  <X className="h-4 w-4" />
                  Request changes
                </Button>
                <Button onClick={() => setConfirmApprove(true)}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <TextSelectionToolbar
          selection={textSelection}
          onComment={(anchor) => setActiveAnchor(anchor)}
        />
        <section className="min-w-0 space-y-8">
          <BlocksList
            blocks={review.content.blocks}
            threadsByBlock={threadsByBlock}
            onAnchor={setActiveAnchor}
            onAnswer={(anchor, answer) => {
              void submitQuestionAnswer(anchor, answer);
            }}
          />
        </section>
        <aside className="max-h-[calc(100vh-5rem)] space-y-4 overflow-y-auto lg:sticky lg:top-20">
          <Composer
            anchor={activeAnchor}
            message={message}
            resolutionTarget={resolutionTarget}
            pending={pending}
            onAnchor={setActiveAnchor}
            onMessage={setMessage}
            onResolutionTarget={setResolutionTarget}
            onSubmit={submitComment}
          />
          <ThreadsSidebar
            justSynced={justSynced}
            reconnecting={reconnecting}
            lastPostedThreadId={lastPostedThreadId}
            reviewId={review.id}
            threads={threads}
            onRefresh={refreshThreads}
            onStatus={setCommentStatus}
          />
        </aside>
      </div>
    </main>
  );
}

type TextSelectionAnchor = {
  anchor: ReviewAnchor;
  rect: { left: number; top: number };
};

function TextSelectionToolbar({
  selection,
  onComment,
}: {
  selection: TextSelectionAnchor | null;
  onComment: (anchor: ReviewAnchor) => void;
}) {
  if (!selection) {
    return null;
  }

  return (
    <button
      className="fixed z-50 inline-flex items-center gap-1 rounded-full border bg-canvas px-3 py-1.5 text-sm font-medium shadow-resting transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        left: selection.rect.left,
        top: selection.rect.top,
        transform: "translate(-50%, -100%)",
      }}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onComment(selection.anchor);
        window.getSelection()?.removeAllRanges();
      }}
    >
      <MessageSquare className="h-4 w-4" />
      Comment
    </button>
  );
}

function useTextSelectionAnchor() {
  const [selectionAnchor, setSelectionAnchor] =
    useState<TextSelectionAnchor | null>(null);

  useEffect(() => {
    function updateSelection(fallbackNode?: Node | null) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectionAnchor(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const container =
        textAnchorContainer(range.commonAncestorContainer) ??
        textAnchorContainer(selection.anchorNode) ??
        textAnchorContainer(selection.focusNode) ??
        textAnchorContainer(fallbackNode ?? null);
      if (!container) {
        setSelectionAnchor(null);
        return;
      }
      const fullText = container.textContent ?? "";
      const rawSelection = selection.toString();
      const rawAnchorText = fullText.includes(rawSelection)
        ? rawSelection
        : fullText;
      const selectedText = normalizeComparableText(rawAnchorText);
      if (!selectedText) {
        setSelectionAnchor(null);
        return;
      }
      const blockId = container.dataset.blockId;
      if (!blockId) {
        setSelectionAnchor(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelectionAnchor(null);
        return;
      }
      const index = fullText.indexOf(rawAnchorText);
      const contextBefore =
        index >= 0 ? fullText.slice(Math.max(0, index - 80), index) : "";
      const contextAfter =
        index >= 0
          ? fullText.slice(
              index + rawAnchorText.length,
              index + rawAnchorText.length + 80,
            )
          : "";
      setSelectionAnchor({
        anchor: {
          blockId,
          kind: "text",
          textQuote: {
            quote: selectedText.slice(0, 220),
            contextBefore: contextBefore || undefined,
            contextAfter: contextAfter || undefined,
          },
        },
        rect: {
          left: rect.left + rect.width / 2,
          top: Math.max(8, rect.top - 8),
        },
      });
    }

    function scheduleSelectionUpdate(event: MouseEvent | KeyboardEvent) {
      const fallbackNode =
        "clientX" in event
          ? document.elementFromPoint(event.clientX, event.clientY)
          : null;
      window.setTimeout(() => updateSelection(fallbackNode), 0);
    }

    const handleSelectionChange = () => updateSelection();

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", scheduleSelectionUpdate);
    document.addEventListener("dblclick", scheduleSelectionUpdate);
    document.addEventListener("keyup", scheduleSelectionUpdate);
    window.addEventListener("resize", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", scheduleSelectionUpdate);
      document.removeEventListener("dblclick", scheduleSelectionUpdate);
      document.removeEventListener("keyup", scheduleSelectionUpdate);
      window.removeEventListener("resize", handleSelectionChange);
    };
  }, []);

  return selectionAnchor;
}

function textAnchorContainer(node: Node | null) {
  if (!node) {
    return null;
  }
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return element?.closest<HTMLElement>("[data-text-anchorable][data-block-id]");
}

type EvidenceLinks = {
  targets: Map<string, string>;
  onJump: (blockId: string) => void;
};

const EvidenceLinkContext = createContext<EvidenceLinks | null>(null);

// Older reviews name their evidence by block id and newer ones by filename, so
// dropping either key breaks the links on everything already published.
function buildEvidenceTargets(blocks: ReviewBlock[]) {
  const targets = new Map<string, string>();
  for (const block of blocks) {
    if (block.type !== "diff" && block.type !== "annotated-code") {
      continue;
    }
    if (!targets.has(block.id)) {
      targets.set(block.id, block.id);
    }
    const filename = block.data.filename;
    if (filename && !targets.has(filename)) {
      targets.set(filename, block.id);
    }
  }
  return targets;
}

function markdownText(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(markdownText).join("");
  }
  return "";
}

const PreContext = createContext(false);

function MarkdownPre({ children }: { children?: ReactNode }) {
  return (
    <PreContext.Provider value={true}>
      <pre>{children}</pre>
    </PreContext.Provider>
  );
}

function EvidenceCode({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: ReactNode;
}) {
  const links = useContext(EvidenceLinkContext);
  const inPre = useContext(PreContext);
  const text = markdownText(children);
  if (inPre) {
    const language = /language-([\w+#-]+)/.exec(className ?? "")?.[1];
    return (
      <code
        className={[className, "syntax-highlight"].filter(Boolean).join(" ")}
        {...props}
      >
        {highlightCode(text.replace(/\n$/, ""), language)}
      </code>
    );
  }
  const label = text.trim();
  const blockId = links?.targets.get(label);

  if (!links || !blockId) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <button
      className="cursor-pointer rounded bg-canvas-subtle px-1 py-0.5 font-mono text-[0.85em] text-fg underline decoration-dotted underline-offset-2 transition-colors hover:bg-accent-muted hover:text-accent-fg hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
      title={evidenceLinkTitle(label)}
      onClick={() => links.onJump(blockId)}
    >
      {children}
    </button>
  );
}

const markdownComponents = { code: EvidenceCode, pre: MarkdownPre };

function evidenceLinkTitle(label: string) {
  return `Jump to the evidence in ${label}`;
}

type DiffViewMode = "split" | "unified";

const DiffViewContext = createContext<{
  mode: DiffViewMode;
  setMode: (mode: DiffViewMode) => void;
}>({ mode: "unified", setMode: () => {} });

// One diff view preference for the whole page: unified unless the reader has
// chosen split, and switching anywhere applies to every diff at once.
function DiffViewProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DiffViewMode>("unified");
  useEffect(() => {
    const stored = window.localStorage.getItem(DIFF_VIEW_MODE_STORAGE_KEY);
    if (stored === "split" || stored === "unified") {
      setModeState(stored);
    }
    function syncMode(event: StorageEvent) {
      if (
        event.key === DIFF_VIEW_MODE_STORAGE_KEY &&
        (event.newValue === "split" || event.newValue === "unified")
      ) {
        setModeState(event.newValue);
      }
    }
    window.addEventListener("storage", syncMode);
    return () => window.removeEventListener("storage", syncMode);
  }, []);
  const setMode = useCallback((next: DiffViewMode) => {
    setModeState(next);
    window.localStorage.setItem(DIFF_VIEW_MODE_STORAGE_KEY, next);
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <DiffViewContext.Provider value={value}>
      {children}
    </DiffViewContext.Provider>
  );
}

function revealEvidence(blockId: string, targetId?: string) {
  activateBlockTab(blockId);
  // The card body mounts on expansion, so the scroll target may not exist
  // until after a render pass.
  window.setTimeout(() => {
    const wanted =
      targetId && document.getElementById(targetId) ? targetId : blockId;
    scrollToElement(wanted, targetId ? "center" : "start");
  }, 50);
}

// Finding links and thread anchors push a #block hash, so the browser back
// button retraces every jump and restores the reader's scroll position.
function useHashNavigation(blocks: ReviewBlock[]) {
  useEffect(() => {
    function resolveHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) {
        return;
      }
      const block = blocks.find(
        (candidate) => id === candidate.id || id.startsWith(`${candidate.id}-`),
      );
      if (!block) {
        return;
      }
      revealEvidence(block.id, id === block.id ? undefined : id);
    }
    window.addEventListener("popstate", resolveHash);
    if (window.location.hash) {
      resolveHash();
    }
    return () => window.removeEventListener("popstate", resolveHash);
  }, [blocks]);
}

export function BlocksList({
  blocks,
  threadsByBlock,
  onAnchor,
  onAnswer,
}: {
  blocks: ReviewBlock[];
  threadsByBlock: Map<string, Thread[]>;
  onAnchor: (anchor: ReviewAnchor) => void;
  onAnswer: (anchor: ReviewAnchor, answer: string) => void;
}) {
  const targets = useMemo(() => buildEvidenceTargets(blocks), [blocks]);
  const onJump = useCallback((blockId: string) => {
    window.history.pushState(null, "", `#${encodeURIComponent(blockId)}`);
    revealEvidence(blockId);
  }, []);
  const evidenceLinks = useMemo(() => ({ targets, onJump }), [targets, onJump]);
  useHashNavigation(blocks);
  const reviewMeta = useMemo(() => {
    for (const block of blocks) {
      if (block.type === "callout" && block.data.recommendation) {
        return { recommendation: block.data.recommendation };
      }
    }
    return { recommendation: null };
  }, [blocks]);

  const items: ReactNode[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }
    const next = blocks[index + 1];
    if (
      isEvidenceBlock(block) ||
      (block.type === "section" && next && isEvidenceBlock(next))
    ) {
      const heading = block.type === "section" ? block : null;
      const run: EvidenceBlockData[] = [];
      let cursor = heading ? index + 1 : index;
      while (cursor < blocks.length) {
        const candidate = blocks[cursor];
        if (!isEvidenceBlock(candidate)) {
          break;
        }
        run.push(candidate);
        cursor += 1;
      }
      // Asides split out of the run into their own folded group so minor
      // findings never sit at the same altitude as the load-bearing evidence.
      const mainBlocks = run.filter((candidate) => !isAside(candidate));
      const asideBlocks = run.filter((candidate) => isAside(candidate));
      const groupKey = heading?.id ?? run[0]?.id ?? `evidence-${index}`;
      if (mainBlocks.length > 0) {
        items.push(
          <EvidenceGroup
            key={groupKey}
            heading={heading}
            blocks={mainBlocks}
            threadsByBlock={threadsByBlock}
            onAnchor={onAnchor}
          />,
        );
      }
      if (asideBlocks.length > 0) {
        items.push(
          <EvidenceGroup
            key={`${groupKey}-aside`}
            aside
            heading={mainBlocks.length === 0 ? heading : null}
            blocks={asideBlocks}
            threadsByBlock={threadsByBlock}
            onAnchor={onAnchor}
          />,
        );
      }
      index = cursor;
      continue;
    }

    items.push(
      <CommentableBlock
        key={block.id}
        block={block}
        compactWithPrevious={
          block.type === "api-endpoint" &&
          blocks[index - 1]?.type === "api-endpoint"
        }
        threads={threadsByBlock.get(block.id) ?? []}
        onAnchor={onAnchor}
        onAnswer={onAnswer}
      />,
    );
    index += 1;
  }

  return (
    <DiffViewProvider>
      <ReviewMetaContext.Provider value={reviewMeta}>
        <EvidenceLinkContext.Provider value={evidenceLinks}>
          {items}
        </EvidenceLinkContext.Provider>
      </ReviewMetaContext.Provider>
    </DiffViewProvider>
  );
}

type EvidenceBlockData = Extract<
  ReviewBlock,
  { type: "diff" | "annotated-code" }
>;

function isEvidenceBlock(
  block: ReviewBlock | undefined,
): block is EvidenceBlockData {
  return block?.type === "diff" || block?.type === "annotated-code";
}

const ReviewMetaContext = createContext<{
  recommendation: ReviewRecommendation | null;
}>({ recommendation: null });

// Asides fold to their one-line claims in the renderer.
function isAside(block: ReviewBlock) {
  return (
    "severity" in block &&
    (block.severity === "minor" || block.severity === "fyi")
  );
}

// On a merge recommendation nothing below the verdict is load-bearing, so
// every card starts as a claim line; without one, a lone card is the proof
// itself and starts open.
function startsOpen(
  block: EvidenceBlockData,
  runLength: number,
  recommendation: ReviewRecommendation | null,
) {
  if (block.severity === "blocking") {
    return true;
  }
  if (isAside(block)) {
    return false;
  }
  if (recommendation === "merge" || recommendation === "merge-with-nits") {
    return false;
  }
  return runLength === 1;
}

function EvidenceGroup({
  aside = false,
  heading,
  blocks,
  threadsByBlock,
  onAnchor,
}: {
  aside?: boolean;
  heading: Extract<ReviewBlock, { type: "section" }> | null;
  blocks: EvidenceBlockData[];
  threadsByBlock: Map<string, Thread[]>;
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const { recommendation } = useContext(ReviewMetaContext);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () =>
      new Set(
        blocks
          .filter((block) => startsOpen(block, blocks.length, recommendation))
          .map((block) => block.id),
      ),
  );
  useEffect(() => {
    function activate(event: Event) {
      const blockId = (event as CustomEvent<{ blockId?: string }>).detail
        ?.blockId;
      if (blockId && blocks.some((block) => block.id === blockId)) {
        setOpenIds((current) =>
          current.has(blockId) ? current : new Set([...current, blockId]),
        );
      }
    }
    window.addEventListener("sieve:activate-block", activate);
    return () => window.removeEventListener("sieve:activate-block", activate);
  }, [blocks]);
  const allOpen = blocks.every((block) => openIds.has(block.id));

  return (
    <section
      className="space-y-3"
      data-evidence-aside={aside ? "true" : undefined}
    >
      {heading || aside || blocks.length > 1 ? (
        <div className="flex items-center justify-between gap-3">
          {aside ? (
            <h2
              className="text-sm font-semibold text-fg-muted"
              data-block-id={heading?.id}
              data-text-anchorable={heading ? "true" : undefined}
              id={heading?.id}
            >
              {`${heading?.data.title ?? "Minor findings"} (${blocks.length})`}
            </h2>
          ) : heading ? (
            <h2
              className="text-xl font-semibold"
              data-block-id={heading.id}
              data-text-anchorable="true"
              id={heading.id}
            >
              {heading.data.title}
            </h2>
          ) : (
            <span />
          )}
          {blocks.length > 1 ? (
            <Button
              className="shrink-0"
              size="sm"
              variant="outline"
              onClick={() =>
                setOpenIds(
                  allOpen
                    ? new Set()
                    : new Set(blocks.map((block) => block.id)),
                )
              }
            >
              {allOpen ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {blocks.map((block) => (
        <EvidenceCard
          key={block.id}
          block={block}
          open={openIds.has(block.id)}
          threads={threadsByBlock.get(block.id) ?? []}
          onAnchor={onAnchor}
          onToggle={() =>
            setOpenIds((current) => {
              const nextIds = new Set(current);
              if (nextIds.has(block.id)) {
                nextIds.delete(block.id);
              } else {
                nextIds.add(block.id);
              }
              return nextIds;
            })
          }
        />
      ))}
    </section>
  );
}

// A "Diff: path" placeholder would just echo the filename line below it.
function isPlaceholderSummary(summary: string) {
  return /^(Diff|New file): /.test(summary);
}

function evidenceFindingLabels(block: EvidenceBlockData) {
  const labels = block.data.annotations
    .map((annotation) => annotation.label)
    .filter((label): label is string => Boolean(label));
  return [...new Set(labels)].slice(0, 3);
}

function severityChipClass(severity: BlockSeverity) {
  const classes = {
    blocking: "bg-danger-muted text-danger-fg",
    minor: "bg-neutral-muted text-fg-muted",
    fyi: "bg-neutral-muted text-fg-muted",
  };
  return classes[severity];
}

function EvidenceCard({
  block,
  open,
  threads,
  onAnchor,
  onToggle,
}: {
  block: EvidenceBlockData;
  open: boolean;
  threads: Thread[];
  onAnchor: (anchor: ReviewAnchor) => void;
  onToggle: () => void;
}) {
  const view = useContext(DiffViewContext);
  const stats = keyChangeStats(block);
  const lineCount =
    block.type === "annotated-code" ? block.data.code.split("\n").length : null;
  const findings = evidenceFindingLabels(block);
  const isOneSided =
    block.type === "diff" &&
    (block.data.before.trim().length === 0 ||
      block.data.after.trim().length === 0);
  const claim =
    block.summary && !isPlaceholderSummary(block.summary)
      ? block.summary
      : null;

  return (
    <article
      id={block.id}
      className="group scroll-mt-16 overflow-clip rounded-md border bg-canvas"
      data-severity={block.severity}
    >
      <div
        className={`sticky top-12 z-[5] flex items-center gap-3 rounded-t-lg bg-canvas-subtle px-3 py-2 ${
          open ? "border-b" : ""
        }`}
        data-diff-header
      >
        <button
          aria-expanded={open}
          className="group/toggle -m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md p-1 text-left transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={open ? "Collapse evidence" : "Expand evidence"}
          type="button"
          onClick={onToggle}
        >
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-fg-muted transition-all group-hover/toggle:translate-y-0.5 group-hover/toggle:text-fg ${
              open
                ? ""
                : "-rotate-90 group-hover/toggle:translate-y-0 group-hover/toggle:translate-x-0.5"
            }`}
          />
          <span className="min-w-0">
            {claim ? (
              <span
                className={`block text-sm font-medium leading-5 ${
                  open ? "" : "line-clamp-2"
                }`}
                data-block-id={block.id}
                data-text-anchorable="true"
              >
                {claim}
              </span>
            ) : null}
            <span
              className={`flex items-center gap-2 font-mono text-xs text-fg-muted ${
                claim ? "mt-1" : ""
              }`}
            >
              {block.type === "diff" ? (
                <FileCode2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Code2 className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{block.data.filename}</span>
              {block.severity ? (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 font-sans text-[10px] font-semibold ${severityChipClass(
                    block.severity,
                  )}`}
                >
                  {block.severity}
                </span>
              ) : null}
              {findings.map((label) => (
                <span
                  key={label}
                  className="shrink-0 rounded-full bg-done-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-done-fg"
                >
                  {label}
                </span>
              ))}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {threads.length > 0 ? (
            <button
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-canvas px-2 py-0.5 text-xs font-medium text-attention-fg transition-colors hover:bg-attention-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={`${threads.length} anchored thread${threads.length === 1 ? "" : "s"}`}
              type="button"
              onClick={() => scrollToThread(threads[0]?.root.id)}
            >
              <MessageSquare className="h-3 w-3" />
              {threads.length}
            </button>
          ) : null}
          {stats ? (
            <span className="font-mono text-xs">
              <span className="text-success-fg">+{stats.additions}</span>{" "}
              <span className="text-danger-fg">-{stats.deletions}</span>
            </span>
          ) : lineCount !== null ? (
            <span className="font-mono text-xs text-fg-muted">
              {lineCount} lines
            </span>
          ) : null}
          {open && block.type === "diff" && !isOneSided ? (
            <div className="hidden rounded-md border bg-canvas p-0.5 sm:flex">
              {(["split", "unified"] as const).map((item) => (
                <button
                  key={item}
                  aria-pressed={view.mode === item}
                  className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    view.mode === item
                      ? "bg-neutral-muted font-medium text-fg"
                      : "text-fg-muted hover:bg-control-hover hover:text-fg"
                  }`}
                  type="button"
                  onClick={() => view.setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <button
            aria-label="Comment on block"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border bg-canvas text-fg-muted opacity-0 transition-opacity hover:bg-control-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            title="Comment on block"
            type="button"
            onClick={() => onAnchor({ blockId: block.id, kind: "block" })}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {open ? (
        block.type === "diff" ? (
          <DiffBlockBody block={block} threads={threads} onAnchor={onAnchor} />
        ) : (
          <AnnotatedCodeBody
            block={block}
            threads={threads}
            onAnchor={onAnchor}
          />
        )
      ) : null}
    </article>
  );
}

function keyChangeStats(
  block: Extract<ReviewBlock, { type: "diff" | "annotated-code" }>,
) {
  if (block.type !== "diff") {
    return null;
  }
  const rows = alignDiffRows(
    block.data.before,
    block.data.after,
    block.data.beforeStartLine ?? 1,
    block.data.afterStartLine ?? 1,
  );
  return {
    additions: rows.filter((row) => row.afterLine && row.kind !== "context")
      .length,
    deletions: rows.filter((row) => row.beforeLine && row.kind !== "context")
      .length,
  };
}

function CommentableBlock({
  block,
  compactWithPrevious,
  threads,
  onAnchor,
  onAnswer,
}: {
  block: ReviewBlock;
  compactWithPrevious: boolean;
  threads: Thread[];
  onAnchor: (anchor: ReviewAnchor) => void;
  onAnswer: (anchor: ReviewAnchor, answer: string) => void;
}) {
  return (
    <article
      id={block.id}
      className={`group relative scroll-mt-48 rounded-md px-1 py-1 ${
        compactWithPrevious ? "!mt-0 pt-0" : ""
      }`}
    >
      {block.summary &&
      block.type !== "image-diff" &&
      !(block.type === "rich-text" && isAside(block)) ? (
        <p
          className="mb-2 text-sm font-medium leading-6"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          {block.summary}
        </p>
      ) : null}
      <div className="absolute right-1 top-1 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {threads.length > 0 ? (
          <button
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-canvas px-2 text-xs font-medium text-attention-fg transition-colors hover:bg-attention-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${threads.length} anchored thread${threads.length === 1 ? "" : "s"}`}
            type="button"
            onClick={() => scrollToThread(threads[0]?.root.id)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {threads.length}
          </button>
        ) : null}
        <button
          aria-label="Comment on block"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-canvas text-fg-muted transition-colors hover:bg-control-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Comment on block"
          type="button"
          onClick={() => onAnchor({ blockId: block.id, kind: "block" })}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>
      <BlockRenderer
        block={block}
        compactWithPrevious={compactWithPrevious}
        threads={threads}
        onAnchor={onAnchor}
        onAnswer={onAnswer}
      />
    </article>
  );
}

function BlockRenderer({
  block,
  compactWithPrevious,
  threads,
  onAnchor,
  onAnswer,
}: {
  block: ReviewBlock;
  compactWithPrevious: boolean;
  threads: Thread[];
  onAnchor: (anchor: ReviewAnchor) => void;
  onAnswer: (anchor: ReviewAnchor, answer: string) => void;
}) {
  switch (block.type) {
    case "rich-text":
      if (isAside(block)) {
        return <FoldedProse block={block} />;
      }
      return (
        <div
          className="recap-prose max-w-[58rem]"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {block.data.markdown}
          </ReactMarkdown>
        </div>
      );
    case "section":
      return (
        <h2
          className="text-xl font-semibold"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          {block.data.title}
        </h2>
      );
    case "callout":
      return <CalloutBlock block={block} />;
    case "file-tree":
      return <FileTreeBlock block={block} onAnchor={onAnchor} />;
    // Evidence blocks normally render as cards via EvidenceGroup; these
    // cases only cover a stray block outside any evidence run.
    case "diff":
      return (
        <div className="overflow-clip rounded-md border bg-canvas">
          <DiffBlockBody block={block} threads={threads} onAnchor={onAnchor} />
        </div>
      );
    case "annotated-code":
      return (
        <div className="overflow-clip rounded-md border bg-canvas">
          <AnnotatedCodeBody
            block={block}
            threads={threads}
            onAnchor={onAnchor}
          />
        </div>
      );
    case "data-model":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {block.data.entities.map((entity) => (
            <div
              key={entity.name}
              className="overflow-hidden rounded-md border bg-canvas"
            >
              <div className="flex items-center justify-between gap-3 border-b bg-canvas-subtle px-3 py-2">
                <h3 className="flex items-center gap-2 font-mono text-sm font-semibold">
                  <Database className="h-4 w-4 text-fg-muted" />
                  {entity.name}
                </h3>
                <div className="flex items-center gap-2">
                  {entity.change ? (
                    <ChangeBadge change={entity.change} />
                  ) : null}
                  <Badge>{entity.fields.length} fields</Badge>
                </div>
              </div>
              <div className="divide-y text-sm">
                {entity.fields.map((field) => (
                  <div
                    key={field.name}
                    className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-2 ${fieldToneClass(field.change)}`}
                  >
                    <span className="font-mono">{field.name}</span>
                    <span className="min-w-0 text-right font-mono text-fg-muted">
                      {field.was ? (
                        <>
                          <span className="line-through">{field.was}</span>{" "}
                          <span>→</span>{" "}
                        </>
                      ) : null}
                      {field.type ?? "-"}
                    </span>
                    {field.note ? (
                      <span
                        className="col-span-2 text-xs text-fg-muted"
                        data-block-id={block.id}
                        data-text-anchorable="true"
                      >
                        {field.note}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {block.data.relations?.length ? (
            <div className="rounded-md border bg-canvas p-3 text-sm md:col-span-2">
              <h3 className="mb-2 flex items-center gap-2 font-medium">
                <TableProperties className="h-4 w-4 text-fg-muted" />
                Relations
              </h3>
              <ul className="space-y-1 text-fg-muted">
                {block.data.relations.map((relation) => (
                  <li key={relation}>→ {relation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    case "api-endpoint":
      return (
        <ApiEndpointBlock
          block={block}
          compactWithPrevious={compactWithPrevious}
        />
      );
    case "change-shape":
      return <ChangeShapeBlock block={block} />;
    case "mermaid":
      return (
        <MermaidBlock source={block.data.source} caption={block.data.caption} />
      );
    case "question-form":
      return (
        <div className="space-y-3">
          {block.data.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              blockId={block.id}
              index={index}
              onAnchor={onAnchor}
              onAnswer={onAnswer}
              question={question}
              threads={threads.filter(
                (thread) =>
                  thread.root.anchor?.kind === "question" &&
                  thread.root.anchor.questionId === question.id,
              )}
            />
          ))}
        </div>
      );
    case "image-diff":
      return <ImageDiffBlock block={block} />;
    case "screen-recording":
      return <ScreenRecordingBlock block={block} />;
  }
}

function CalloutBlock({
  block,
}: {
  block: Extract<ReviewBlock, { type: "callout" }>;
}) {
  const recommendation = block.data.recommendation;
  return (
    <div
      className={`rounded-md border border-l-4 px-4 py-3 ${calloutToneClass(
        block.data.tone,
      )}`}
      data-block-id={block.id}
      data-text-anchorable="true"
    >
      {recommendation ? (
        <span
          className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            recommendationBadge(recommendation).className
          }`}
          data-recommendation={recommendation}
        >
          {recommendationBadge(recommendation).label}
        </span>
      ) : null}
      <div className="recap-prose max-w-[58rem]">
        <ReactMarkdown
          components={markdownComponents}
          remarkPlugins={[remarkGfm]}
        >
          {block.data.markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// The appendix slot: prose graded minor or fyi folds to its summary line.
function FoldedProse({
  block,
}: {
  block: Extract<ReviewBlock, { type: "rich-text" }>;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function activate(event: Event) {
      const blockId = (event as CustomEvent<{ blockId?: string }>).detail
        ?.blockId;
      if (blockId === block.id) {
        setOpen(true);
      }
    }
    window.addEventListener("sieve:activate-block", activate);
    return () => window.removeEventListener("sieve:activate-block", activate);
  }, [block.id]);

  return (
    <section
      className="overflow-clip rounded-md border bg-canvas"
      data-folded-prose
      data-severity={block.severity}
    >
      <button
        aria-expanded={open}
        className={`group/prose flex w-full cursor-pointer items-center gap-2 bg-canvas-subtle px-3 py-2 text-left transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "border-b" : ""
        }`}
        title={open ? "Collapse the notes" : "Expand the notes"}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover/prose:text-fg ${
            open ? "" : "-rotate-90"
          }`}
        />
        <span
          className="min-w-0 flex-1 text-sm font-medium leading-5"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          {block.summary ?? "Notes"}
        </span>
        {block.severity ? (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${severityChipClass(
              block.severity,
            )}`}
          >
            {block.severity}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="recap-prose max-w-[58rem] px-4 py-3"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {block.data.markdown}
          </ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}

function recommendationBadge(recommendation: ReviewRecommendation) {
  const badges = {
    merge: { label: "Merge", className: "bg-success-muted text-success-fg" },
    "merge-with-nits": {
      label: "Merge with nits",
      className: "bg-success-muted text-success-fg",
    },
    "needs-changes": {
      label: "Needs changes",
      className: "bg-attention-muted text-attention-fg",
    },
    "cannot-judge-alone": {
      label: "Can't judge alone",
      className: "bg-neutral-muted text-fg-muted",
    },
  };
  return badges[recommendation];
}

function calloutToneClass(
  tone: "info" | "decision" | "risk" | "warning" | "success",
) {
  const classes = {
    info: "border-accent-border bg-accent-muted",
    decision: "border-done-border bg-done-muted",
    risk: "border-danger-border bg-diff-del-line",
    warning: "border-attention-border bg-attention-muted",
    success: "border-success-border bg-diff-add-line",
  };
  return classes[tone];
}

function ApiEndpointBlock({
  block,
  compactWithPrevious,
}: {
  block: Extract<ReviewBlock, { type: "api-endpoint" }>;
  compactWithPrevious: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`overflow-hidden border bg-canvas ${
        compactWithPrevious ? "rounded-t-none border-t-0" : "rounded-md"
      }`}
    >
      <button
        className="grid w-full grid-cols-[24px_auto_minmax(0,1fr)_auto] items-center gap-2 bg-canvas-subtle px-3 py-2 text-left transition-colors hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDown
          className={`h-4 w-4 text-fg-muted transition-transform ${
            expanded ? "rotate-180" : "-rotate-90"
          }`}
        />
        {block.data.method ? <MethodBadge method={block.data.method} /> : null}
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm font-semibold">
            {block.data.path}
          </span>
          {block.summary ? (
            <span className="block truncate text-xs text-fg-muted">
              {block.summary}
            </span>
          ) : null}
        </span>
        {block.data.change ? <ChangeBadge change={block.data.change} /> : null}
      </button>
      {expanded ? (
        <>
          {block.data.params.length > 0 ? (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-fg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Param</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {block.data.params.map((param) => (
                    <tr
                      key={param.name}
                      className={fieldToneClass(param.change)}
                    >
                      <td className="px-3 py-2 font-mono">{param.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                        {param.was ? (
                          <>
                            <span className="line-through">{param.was}</span>{" "}
                            <span>→</span>{" "}
                          </>
                        ) : null}
                        <span className="rounded border bg-canvas-subtle px-1.5 py-0.5">
                          {param.type ?? "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-fg-muted">{param.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {block.data.request !== undefined ? (
            <JsonExample title="request" value={block.data.request} />
          ) : null}
          {block.data.responses?.map((response, index) => (
            <JsonExample
              // biome-ignore lint/suspicious/noArrayIndexKey: duplicate response examples need an ordinal in their key.
              key={`response-${index}-${stableJson(response)}`}
              title={`response ${index + 1}`}
              value={response}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "open" | "approved" | "changes_requested" | "archived";
}) {
  return (
    <Badge
      className="capitalize"
      tone={
        status === "open"
          ? "blue"
          : status === "approved"
            ? "green"
            : status === "changes_requested"
              ? "amber"
              : "neutral"
      }
    >
      {status.replace("_", " ")}
    </Badge>
  );
}

function ChangeShapeBlock({
  block,
}: {
  block: Extract<ReviewBlock, { type: "change-shape" }>;
}) {
  const areas = block.data.areas;
  const maxChurn = Math.max(
    ...areas.map((area) => area.additions + area.deletions),
    1,
  );
  return (
    <div className="overflow-hidden rounded-md border bg-canvas">
      {areas.map((area) => {
        const churn = area.additions + area.deletions;
        // Bars are proportional to each area's churn share, with a floor so
        // a tiny area still renders a visible sliver.
        const width = Math.max((churn / maxChurn) * 100, 2);
        const addedShare = churn > 0 ? (area.additions / churn) * 100 : 100;
        return (
          <div
            key={area.area}
            className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <span className="w-44 shrink-0 truncate font-mono sm:w-56">
              {area.area}
            </span>
            <ChangeBadge change={area.change} />
            <span className="w-14 shrink-0 text-xs text-fg-muted">
              {area.files} {area.files === 1 ? "file" : "files"}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-subtle">
              <div
                className="flex h-full overflow-hidden rounded-full"
                style={{ width: `${width}%` }}
              >
                <div
                  className="h-full bg-success-emphasis"
                  style={{ width: `${addedShare}%` }}
                />
                <div className="h-full flex-1 bg-danger-emphasis" />
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs">
              <span className="text-success-fg">+{area.additions}</span>{" "}
              <span className="text-danger-fg">-{area.deletions}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChangeBadge({
  change,
}: {
  change: "added" | "modified" | "removed" | "renamed";
}) {
  const map: Record<typeof change, { label: string; tone: BadgeTone }> = {
    added: { label: "A", tone: "green" },
    modified: { label: "M", tone: "blue" },
    removed: { label: "D", tone: "red" },
    renamed: { label: "R", tone: "violet" },
  };
  const item = map[change];
  return (
    <Badge
      className="h-5 w-6 justify-center px-0 text-[10px] font-semibold"
      tone={item.tone}
    >
      {item.label}
    </Badge>
  );
}

function MethodBadge({ method }: { method: string }) {
  const normalized = method.toUpperCase();
  const tone: BadgeTone =
    normalized === "GET"
      ? "green"
      : normalized === "POST"
        ? "blue"
        : normalized === "PUT"
          ? "amber"
          : normalized === "DELETE"
            ? "red"
            : normalized === "PATCH"
              ? "violet"
              : "neutral";
  return (
    <Badge className="font-mono uppercase" tone={tone}>
      {normalized}
    </Badge>
  );
}

function PathLabel({ path }: { path: string }) {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return <span className="truncate font-mono">{path}</span>;
  }
  return (
    <span className="truncate font-mono">
      <span className="text-fg-muted">{path.slice(0, index + 1)}</span>
      <span>{path.slice(index + 1)}</span>
    </span>
  );
}

function FileTreeBlock({
  block,
  onAnchor,
}: {
  block: Extract<ReviewBlock, { type: "file-tree" }>;
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const entries = block.data.entries;
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(entries.map((entry) => topLevelDirectory(entry.path))),
  );

  if (entries.length <= 15) {
    return (
      <div className="overflow-hidden rounded-md border bg-canvas">
        {entries.map((entry) => (
          <FileTreeRow
            key={entry.path}
            blockId={block.id}
            entry={entry}
            onAnchor={onAnchor}
          />
        ))}
      </div>
    );
  }

  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = topLevelDirectory(entry.path);
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  return (
    <div className="overflow-hidden rounded-md border bg-canvas">
      {Array.from(groups.entries()).map(([group, groupEntries]) => {
        const open = openGroups.has(group);
        return (
          <section key={group} className="border-b last:border-b-0">
            <button
              className="flex w-full items-center justify-between gap-3 bg-canvas-subtle px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              onClick={() =>
                setOpenGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group)) {
                    next.delete(group);
                  } else {
                    next.add(group);
                  }
                  return next;
                })
              }
            >
              <span className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-fg-muted" />
                <span className="font-mono">{group}</span>
              </span>
              <Badge>{groupEntries.length}</Badge>
            </button>
            {open
              ? groupEntries.map((entry) => (
                  <FileTreeRow
                    key={entry.path}
                    blockId={block.id}
                    entry={entry}
                    onAnchor={onAnchor}
                  />
                ))
              : null}
          </section>
        );
      })}
    </div>
  );
}

function FileTreeRow({
  blockId,
  entry,
  onAnchor,
}: {
  blockId: string;
  entry: Extract<ReviewBlock, { type: "file-tree" }>["data"]["entries"][number];
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const row = (
    <>
      <ChangeBadge change={entry.change} />
      <span className="min-w-0">
        <PathLabel path={entry.path} />
        {entry.note ? (
          <span className="block truncate text-xs text-fg-muted">
            {entry.note}
          </span>
        ) : null}
      </span>
      <span className="text-right font-mono text-xs">
        <span className="text-success-fg">+{entry.additions ?? 0}</span>{" "}
        <span className="text-danger-fg">-{entry.deletions ?? 0}</span>
      </span>
    </>
  );
  return (
    <div className="group/file border-b last:border-b-0">
      <div className="flex items-stretch">
        {entry.patch ? (
          <button
            aria-expanded={expanded}
            className="grid min-w-0 flex-1 cursor-pointer grid-cols-[36px_minmax(0,1fr)_110px] items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={expanded ? "Hide the full patch" : "Show the full patch"}
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {row}
          </button>
        ) : (
          <div className="grid min-w-0 flex-1 grid-cols-[36px_minmax(0,1fr)_110px] items-center gap-3 px-3 py-2 text-sm">
            {row}
          </div>
        )}
        <button
          aria-label={`Comment on ${entry.path}`}
          className="shrink-0 cursor-pointer px-2 text-fg-muted opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/file:opacity-100"
          title={`Comment on ${entry.path}`}
          type="button"
          onClick={() =>
            onAnchor({
              blockId,
              kind: "file",
              filePath: entry.path,
            })
          }
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {entry.patch ? (
          <button
            className="flex shrink-0 cursor-pointer items-center gap-1 px-3 text-xs text-fg-muted transition-colors hover:bg-canvas-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <span className="font-mono">{entry.patch.lines} lines</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>
      {expanded && entry.patch ? (
        <PatchPanel attachmentId={entry.patch.attachmentId} path={entry.path} />
      ) : null}
    </div>
  );
}

function PatchPanel({
  attachmentId,
  path,
}: {
  attachmentId: string;
  path: string;
}) {
  const [patch, setPatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attachments/${attachmentId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`attachment fetch failed (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setPatch(text);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "fetch failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  const rows = useMemo(
    () =>
      patch === null
        ? []
        : highlightPatchRows(
            parsePatch(patch),
            inferLanguageFromFilename(path),
          ),
    [patch, path],
  );

  if (error) {
    return (
      <div className="border-t bg-canvas-subtle px-3 py-2 text-xs text-danger-fg">
        Could not load the full patch: {error}
      </div>
    );
  }
  if (patch === null) {
    return (
      <div className="border-t bg-canvas-subtle px-3 py-2 text-xs text-fg-muted">
        Loading patch…
      </div>
    );
  }
  return (
    <div className="max-h-96 overflow-auto border-t font-mono text-xs leading-5">
      {rows.map((row) => {
        if (row.kind === "hunk") {
          return (
            <div
              key={row.id}
              className="grid min-w-[560px] grid-cols-[64px_minmax(0,1fr)]"
            >
              <span className="bg-diff-hunk-num" />
              <span className="bg-diff-hunk-line px-3 py-1 text-fg-muted">
                {row.text}
              </span>
            </div>
          );
        }
        if (row.kind === "meta") {
          return (
            <div key={row.id} className="px-3 text-fg-muted">
              {row.text || " "}
            </div>
          );
        }
        return (
          <div
            key={row.id}
            className="grid min-w-[560px] grid-cols-[64px_minmax(0,1fr)]"
          >
            <span
              className={`px-2 text-right tabular-nums ${
                row.kind === "add"
                  ? "bg-diff-add-num text-fg"
                  : row.kind === "remove"
                    ? "bg-diff-del-num text-fg"
                    : "text-fg-muted"
              }`}
            >
              {row.line}
            </span>
            <CodeCell
              tokens={row.tokens}
              tone={row.kind}
              sign={
                row.kind === "add" ? "+" : row.kind === "remove" ? "-" : " "
              }
              value={row.text}
            />
          </div>
        );
      })}
    </div>
  );
}

type PatchRow = { id: number } & (
  | { kind: "hunk"; text: string }
  | { kind: "meta"; text: string }
  | {
      kind: "context" | "add" | "remove";
      text: string;
      line: number;
      tokens?: HighlightLine;
    }
);

function parsePatch(patch: string): PatchRow[] {
  const rows: PatchRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  for (const [id, raw] of patch.split("\n").entries()) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      rows.push({ id, kind: "hunk", text: raw });
      continue;
    }
    if (raw.startsWith("diff --git")) {
      inHunk = false;
    }
    if (inHunk && raw.startsWith("+")) {
      rows.push({ id, kind: "add", text: raw.slice(1), line: newLine });
      newLine += 1;
      continue;
    }
    if (inHunk && raw.startsWith("-")) {
      rows.push({ id, kind: "remove", text: raw.slice(1), line: oldLine });
      oldLine += 1;
      continue;
    }
    if (inHunk && (raw.startsWith(" ") || raw === "")) {
      rows.push({ id, kind: "context", text: raw.slice(1), line: newLine });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    rows.push({ id, kind: "meta", text: raw });
  }
  // the trailing newline of the file is not a context line
  const last = rows[rows.length - 1];
  if (last?.kind === "context" && last.text === "") {
    rows.pop();
  }
  return rows;
}

// each side is highlighted as one document so tokens keep their context
function highlightPatchRows(rows: PatchRow[], language?: string): PatchRow[] {
  const newSide = rows.filter(
    (row) => row.kind === "context" || row.kind === "add",
  );
  const oldSide = rows.filter((row) => row.kind === "remove");
  const newLines = highlightCodeLines(
    newSide.map((row) => row.text).join("\n"),
    language,
  );
  const oldLines = highlightCodeLines(
    oldSide.map((row) => row.text).join("\n"),
    language,
  );
  let newIndex = 0;
  let oldIndex = 0;
  return rows.map((row) => {
    if (row.kind === "context" || row.kind === "add") {
      const tokens = newLines[newIndex];
      newIndex += 1;
      return { ...row, tokens };
    }
    if (row.kind === "remove") {
      const tokens = oldLines[oldIndex];
      oldIndex += 1;
      return { ...row, tokens };
    }
    return row;
  });
}

function topLevelDirectory(path: string) {
  return path.split("/")[0] ?? path;
}

function fieldToneClass(change?: "added" | "modified" | "removed") {
  if (change === "added") {
    return "border-l-2 border-l-success-emphasis bg-success-muted";
  }
  if (change === "removed") {
    return "border-l-2 border-l-danger-emphasis bg-danger-muted text-fg-muted line-through";
  }
  if (change === "modified") {
    return "border-l-2 border-l-accent-emphasis bg-accent-muted";
  }
  return "";
}

function JsonExample({ title, value }: { title: string; value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="border-t">
      <div className="bg-canvas-subtle px-3 py-1.5 font-mono text-xs text-fg-muted">
        {title}
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-5">
        <code className="syntax-highlight">{highlightCode(json, "json")}</code>
      </pre>
    </div>
  );
}

function QuestionCard({
  blockId,
  question,
  index,
  onAnchor,
  onAnswer,
  threads,
}: {
  blockId: string;
  question: Extract<
    ReviewBlock,
    { type: "question-form" }
  >["data"]["questions"][number];
  index: number;
  onAnchor: (anchor: ReviewAnchor) => void;
  onAnswer: (anchor: ReviewAnchor, answer: string) => void;
  threads: Thread[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [freeform, setFreeform] = useState("");
  const isMulti = question.mode === "multi";
  const answer =
    question.mode === "freeform" ? freeform.trim() : selected.join(", ");
  const answerAnchor: ReviewAnchor = {
    blockId,
    kind: "question",
    questionId: question.id,
    answer,
  };
  const answeredMessages = threads.map((thread) => thread.root.message);

  function toggle(option: string) {
    if (isMulti) {
      setSelected((current) =>
        current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option],
      );
      return;
    }
    setSelected([option]);
  }

  return (
    <div className="rounded-md border bg-canvas p-4">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-canvas-subtle text-sm font-medium">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{question.prompt}</h3>
          {question.mode === "freeform" ? (
            <textarea
              aria-label={question.prompt}
              className="mt-3 min-h-24 w-full resize-y rounded-md border bg-canvas p-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              value={freeform}
              onChange={(event) => setFreeform(event.target.value)}
            />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {question.options?.map((option) => {
                const active = selected.includes(option);
                return (
                  <button
                    key={option}
                    className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-accent-emphasis bg-accent-muted"
                        : "bg-canvas"
                    }`}
                    type="button"
                    onClick={() => toggle(option)}
                  >
                    <Radio
                      className={`h-4 w-4 ${active ? "fill-accent-fg text-accent-fg" : "text-fg-muted"}`}
                    />
                    {option}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            className="mt-3"
            disabled={!answer}
            size="sm"
            onClick={() => {
              onAnswer(answerAnchor, answer);
              onAnchor(answerAnchor);
            }}
          >
            <Send className="h-4 w-4" />
            Post answer
          </Button>
          {answeredMessages.length > 0 ? (
            <div className="mt-3 space-y-2">
              {answeredMessages.map((answered, answeredIndex) => (
                <p
                  // biome-ignore lint/suspicious/noArrayIndexKey: repeated identical answers are display-only history.
                  key={`${answeredIndex}:${answered}`}
                  className="rounded-md bg-canvas-subtle px-3 py-2 text-sm text-fg-muted"
                >
                  Answered: {answered}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ImageDiffBlock({
  block,
}: {
  block: Extract<ReviewBlock, { type: "image-diff" }>;
}) {
  // Pixels are usually the decisive artifact, so the comparison stays open
  // unless the author explicitly filed it as an aside.
  const [open, setOpen] = useState(!isAside(block));
  useEffect(() => {
    function activate(event: Event) {
      const blockId = (event as CustomEvent<{ blockId?: string }>).detail
        ?.blockId;
      if (blockId === block.id) {
        setOpen(true);
      }
    }
    window.addEventListener("sieve:activate-block", activate);
    return () => window.removeEventListener("sieve:activate-block", activate);
  }, [block.id]);
  const [expanded, setExpanded] = useState<{
    label: string;
    attachmentId: string;
    width: number;
    height: number;
  } | null>(null);
  const images: Array<{
    label: string;
    ref: { attachmentId: string; width: number; height: number };
    tone: "neutral" | "diff";
  }> = [];
  if (block.data.before) {
    images.push({ label: "before", ref: block.data.before, tone: "neutral" });
  }
  if (block.data.after) {
    images.push({ label: "after", ref: block.data.after, tone: "neutral" });
  }
  if (block.data.diff) {
    images.push({ label: "diff", ref: block.data.diff, tone: "diff" });
  }

  function renderFigure(image: (typeof images)[number]) {
    return (
      <figure
        key={image.label}
        className={`min-w-0 overflow-hidden rounded-md border bg-canvas ${
          image.tone === "diff"
            ? "border-attention-border bg-attention-muted"
            : ""
        }`}
        data-visual-panel={image.label}
      >
        <button
          className="block w-full cursor-zoom-in bg-canvas-subtle transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={() =>
            setExpanded({
              label: image.label,
              attachmentId: image.ref.attachmentId,
              width: image.ref.width,
              height: image.ref.height,
            })
          }
        >
          <Image
            alt={`${block.data.name} ${image.label}`}
            className="h-auto max-h-[640px] w-full object-contain"
            height={image.ref.height}
            loading="lazy"
            unoptimized
            src={`/api/attachments/${image.ref.attachmentId}`}
            width={image.ref.width}
          />
        </button>
        <figcaption
          className={`border-t px-3 py-1.5 text-center text-sm font-medium ${
            image.tone === "diff" ? "text-attention-fg" : "text-fg-muted"
          }`}
        >
          {image.label}
        </figcaption>
      </figure>
    );
  }

  return (
    <section
      className="overflow-clip rounded-md border bg-canvas"
      data-severity={block.severity}
      data-visual-comparison
    >
      <button
        aria-expanded={open}
        className={`group/visual flex w-full cursor-pointer items-center gap-3 bg-canvas-subtle px-3 py-2 text-left transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "border-b" : ""
        }`}
        title={open ? "Collapse the comparison" : "Expand the comparison"}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover/visual:text-fg ${
            open ? "" : "-rotate-90"
          }`}
        />
        <ImageIcon className="h-4 w-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1">
          {block.summary ? (
            <span className="block text-sm font-medium leading-5">
              {block.summary}
            </span>
          ) : null}
          <span
            className={`block truncate text-xs text-fg-muted ${
              block.summary ? "mt-0.5" : "text-sm font-medium text-fg"
            }`}
            title={
              block.data.baseline
                ? `${block.data.baseline.ref} - ${block.data.baseline.platform}`
                : undefined
            }
          >
            {block.data.name}
          </span>
        </span>
        <Badge tone={imageDiffStatusTone(block.data.status)}>
          {block.data.status}
        </Badge>
      </button>
      {open ? (
        <div
          className={`grid gap-3 p-3 ${
            images.length === 3
              ? "sm:grid-cols-3"
              : images.length === 2
                ? "sm:grid-cols-2"
                : ""
          }`}
          data-visual-primary
        >
          {images.map((image) => renderFigure(image))}
        </div>
      ) : null}
      {expanded ? (
        <button
          aria-label="Close image"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
          type="button"
          onClick={() => setExpanded(null)}
        >
          <span className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-fg">
            <X className="h-5 w-5" />
          </span>
          <Image
            alt={`${block.data.name} ${expanded.label}`}
            className="max-h-full max-w-full object-contain"
            height={expanded.height}
            unoptimized
            src={`/api/attachments/${expanded.attachmentId}`}
            width={expanded.width}
          />
        </button>
      ) : null}
    </section>
  );
}

function ScreenRecordingBlock({
  block,
}: {
  block: Extract<ReviewBlock, { type: "screen-recording" }>;
}) {
  return (
    <section
      className="overflow-hidden rounded-md border bg-canvas"
      data-screen-recording
    >
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-emphasis text-fg-on-emphasis">
          <Video className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-fg-muted">
            Screen recording
          </p>
          <h3 className="truncate text-lg font-semibold">{block.data.title}</h3>
        </div>
      </div>
      <video
        aria-label={block.data.title}
        className="max-h-[720px] w-full bg-black"
        controls
        playsInline
        preload="metadata"
        src={`/api/attachments/${block.data.attachmentId}`}
      >
        <track kind="captions" />
      </video>
      {block.data.caption ? (
        <p
          className="border-t px-4 py-3 text-sm text-fg-muted"
          data-block-id={block.id}
          data-text-anchorable="true"
        >
          {block.data.caption}
        </p>
      ) : null}
    </section>
  );
}

function imageDiffStatusTone(
  status: "changed" | "added" | "removed",
): BadgeTone {
  if (status === "added") {
    return "green";
  }
  if (status === "removed") {
    return "red";
  }
  return "amber";
}

function useContainerWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function DiffBlockBody({
  block,
  threads,
  onAnchor,
}: {
  block: Extract<ReviewBlock, { type: "diff" }>;
  threads: Thread[];
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const codeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const codeSurfaceWidth = useContainerWidth(codeSurfaceRef);
  const { mode } = useContext(DiffViewContext);
  const language = inferLanguageFromFilename(
    block.data.filename,
    block.data.language,
  );
  const rows = useMemo(
    () =>
      alignDiffRows(
        block.data.before,
        block.data.after,
        block.data.beforeStartLine ?? 1,
        block.data.afterStartLine ?? 1,
      ),
    [
      block.data.after,
      block.data.afterStartLine,
      block.data.before,
      block.data.beforeStartLine,
    ],
  );
  const highlightedBefore = useMemo(
    () => highlightCodeLines(block.data.before, language),
    [block.data.before, language],
  );
  const highlightedAfter = useMemo(
    () => highlightCodeLines(block.data.after, language),
    [block.data.after, language],
  );
  const isOneSided =
    block.data.before.trim().length === 0 ||
    block.data.after.trim().length === 0;
  const effectiveMode =
    isOneSided ||
    (codeSurfaceWidth !== null && codeSurfaceWidth < SPLIT_DIFF_MIN_WIDTH)
      ? "unified"
      : mode;
  const unified = effectiveMode === "unified";
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const annotations = block.data.annotations.map((annotation, index) => ({
    ...annotation,
    marker: index + 1,
  }));
  const displayRows = useMemo(
    () => buildDiffDisplayRows(rows, annotations, threads, expandedGroups),
    [rows, annotations, threads, expandedGroups],
  );
  function toggleGroup(id: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  return (
    <div ref={codeSurfaceRef} className="min-w-0" data-diff-code>
      <div className="overflow-x-auto font-mono text-[0.75rem] leading-5">
        {displayRows.map((item) =>
          item.type === "collapse" ? (
            <CollapsedDiffRow
              key={item.id}
              count={item.count}
              startLine={item.startLine}
              endLine={item.endLine}
              unified={unified}
              onExpand={() => toggleGroup(item.id)}
            />
          ) : item.type === "annotation" ? (
            <AnnotationCard
              key={`annotation:${item.annotation.marker}`}
              annotation={item.annotation}
              blockId={block.id}
              unified={unified}
            />
          ) : unified ? (
            <UnifiedDiffRow
              key={item.row.id}
              block={block}
              row={item.row}
              highlightedAfter={highlightedAfter}
              highlightedBefore={highlightedBefore}
              threads={threads}
              annotations={annotations}
              onAnchor={onAnchor}
            />
          ) : (
            <SplitDiffRow
              key={item.row.id}
              block={block}
              row={item.row}
              highlightedAfter={highlightedAfter}
              highlightedBefore={highlightedBefore}
              threads={threads}
              annotations={annotations}
              onAnchor={onAnchor}
            />
          ),
        )}
      </div>
    </div>
  );
}

function SplitDiffRow({
  block,
  row,
  highlightedAfter,
  highlightedBefore,
  threads,
  annotations,
  onAnchor,
}: {
  block: Extract<ReviewBlock, { type: "diff" }>;
  row: DiffRow;
  highlightedAfter: HighlightLine[];
  highlightedBefore: HighlightLine[];
  threads: Thread[];
  annotations: NumberedAnnotation[];
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const emphasis =
    row.kind === "modify" ? intralineRanges(row.before, row.after) : null;
  const beforeTone: CellTone =
    row.kind === "remove" || row.kind === "modify"
      ? "remove"
      : row.kind === "add"
        ? "empty"
        : "context";
  const afterTone: CellTone =
    row.kind === "add" || row.kind === "modify"
      ? "add"
      : row.kind === "remove"
        ? "empty"
        : "context";
  return (
    <div className="grid min-w-[760px] grid-cols-[64px_minmax(0,1fr)_64px_minmax(0,1fr)]">
      <LineButton
        id={lineTargetId(block.id, "before", row.beforeLine)}
        line={row.beforeLine}
        side="before"
        tone={beforeTone}
        threadIds={lineThreadIds(threads, "before", row.beforeLine)}
        marker={annotationMarkerStartingAt(
          annotations,
          "before",
          row.beforeLine,
        )}
        annotated={lineHasAnnotation(annotations, "before", row.beforeLine)}
        onClick={() =>
          row.beforeLine
            ? onAnchor({
                blockId: block.id,
                kind: "line",
                filePath: block.data.filename,
                line: { side: "before", start: row.beforeLine },
              })
            : undefined
        }
      />
      <CodeCell
        tokens={
          row.beforeIndex === undefined
            ? []
            : highlightedBefore[row.beforeIndex]
        }
        tone={beforeTone}
        value={row.before}
        sign={beforeTone === "remove" ? "-" : " "}
        emphasis={emphasis?.before}
      />
      <LineButton
        id={lineTargetId(block.id, "after", row.afterLine)}
        line={row.afterLine}
        side="after"
        tone={afterTone}
        threadIds={lineThreadIds(threads, "after", row.afterLine)}
        marker={annotationMarkerStartingAt(annotations, "after", row.afterLine)}
        annotated={lineHasAnnotation(annotations, "after", row.afterLine)}
        onClick={() =>
          row.afterLine
            ? onAnchor({
                blockId: block.id,
                kind: "line",
                filePath: block.data.filename,
                line: { side: "after", start: row.afterLine },
              })
            : undefined
        }
      />
      <CodeCell
        tokens={
          row.afterIndex === undefined ? [] : highlightedAfter[row.afterIndex]
        }
        tone={afterTone}
        value={row.after}
        sign={afterTone === "add" ? "+" : " "}
        emphasis={emphasis?.after}
      />
    </div>
  );
}

function UnifiedDiffRow({
  block,
  row,
  highlightedAfter,
  highlightedBefore,
  threads,
  annotations,
  onAnchor,
}: {
  block: Extract<ReviewBlock, { type: "diff" }>;
  row: DiffRow;
  highlightedAfter: HighlightLine[];
  highlightedBefore: HighlightLine[];
  threads: Thread[];
  annotations: NumberedAnnotation[];
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  if (row.kind === "modify") {
    const emphasis = intralineRanges(row.before, row.after);
    return (
      <>
        <UnifiedDiffLine
          block={block}
          row={row}
          side="before"
          value={row.before}
          tokens={
            row.beforeIndex === undefined
              ? []
              : highlightedBefore[row.beforeIndex]
          }
          tone="remove"
          sign="-"
          threads={threads}
          annotations={annotations}
          onAnchor={onAnchor}
          emphasis={emphasis?.before}
        />
        <UnifiedDiffLine
          block={block}
          row={row}
          side="after"
          value={row.after}
          tokens={
            row.afterIndex === undefined ? [] : highlightedAfter[row.afterIndex]
          }
          tone="add"
          sign="+"
          threads={threads}
          annotations={annotations}
          onAnchor={onAnchor}
          emphasis={emphasis?.after}
        />
      </>
    );
  }
  const side = row.kind === "remove" ? "before" : "after";
  const value = row.kind === "remove" ? row.before : row.after;
  const tokens =
    row.kind === "remove"
      ? row.beforeIndex === undefined
        ? []
        : highlightedBefore[row.beforeIndex]
      : row.afterIndex === undefined
        ? []
        : highlightedAfter[row.afterIndex];
  const tone = row.kind === "add" ? "add" : row.kind;
  const sign = row.kind === "add" ? "+" : row.kind === "remove" ? "-" : " ";
  return (
    <UnifiedDiffLine
      block={block}
      row={row}
      side={side}
      value={value}
      tokens={tokens}
      tone={tone}
      sign={sign}
      threads={threads}
      annotations={annotations}
      onAnchor={onAnchor}
    />
  );
}

function UnifiedDiffLine({
  block,
  row,
  side,
  value,
  tokens,
  tone,
  sign,
  threads,
  annotations,
  onAnchor,
  emphasis,
}: {
  block: Extract<ReviewBlock, { type: "diff" }>;
  row: DiffRow;
  side: "before" | "after";
  value: string;
  tokens?: HighlightLine;
  tone: "context" | "add" | "remove";
  sign: string;
  threads: Thread[];
  annotations: NumberedAnnotation[];
  onAnchor: (anchor: ReviewAnchor) => void;
  emphasis?: Array<[number, number]>;
}) {
  const line = side === "before" ? row.beforeLine : row.afterLine;
  return (
    <div className="grid min-w-[560px] grid-cols-[64px_minmax(0,1fr)]">
      <LineButton
        id={lineTargetId(block.id, side, line)}
        line={line}
        tone={tone}
        threadIds={lineThreadIds(threads, side, line)}
        marker={annotationMarkerStartingAt(annotations, side, line)}
        annotated={lineHasAnnotation(annotations, side, line)}
        side={side}
        onClick={() =>
          line
            ? onAnchor({
                blockId: block.id,
                kind: "line",
                filePath: block.data.filename,
                line: { side, start: line },
              })
            : undefined
        }
      />
      <CodeCell
        tokens={tokens}
        tone={tone}
        sign={sign}
        value={value}
        emphasis={emphasis}
      />
    </div>
  );
}

function AnnotatedCodeBody({
  block,
  threads,
  onAnchor,
}: {
  block: Extract<ReviewBlock, { type: "annotated-code" }>;
  threads: Thread[];
  onAnchor: (anchor: ReviewAnchor) => void;
}) {
  const startLine = block.data.startLine;
  const [expanded, setExpanded] = useState(false);
  const lines = block.data.code.split("\n");
  const language = inferLanguageFromFilename(
    block.data.filename,
    block.data.language,
  );
  const highlightedLines = useMemo(
    () => highlightCodeLines(block.data.code, language),
    [block.data.code, language],
  );
  const annotations = block.data.annotations.map((annotation, index) => ({
    ...annotation,
    marker: index + 1,
  }));
  // Keep every annotated line visible; the expander only hides unannotated
  // tails.
  const previewCount = Math.max(
    30,
    ...annotations.map(
      (annotation) => annotationRange(annotation)[1] - startLine + 1,
    ),
  );
  const visibleLines = expanded ? lines : lines.slice(0, previewCount);
  return (
    <div className="min-w-0">
      <div className="overflow-x-auto font-mono text-[0.75rem] leading-5">
        {visibleLines.map((line, index) => {
          const lineNumber = startLine + index;
          const endingAnnotations = annotations.filter(
            (annotation) => annotationRange(annotation)[1] === lineNumber,
          );
          return (
            <Fragment key={`${lineNumber}:${line}`}>
              <div className="grid min-w-[560px] grid-cols-[64px_minmax(0,1fr)]">
                <LineButton
                  id={lineTargetId(block.id, "after", lineNumber)}
                  line={lineNumber}
                  threadIds={lineThreadIds(threads, "after", lineNumber)}
                  marker={annotationMarkerStartingAt(
                    annotations,
                    "after",
                    lineNumber,
                  )}
                  annotated={lineHasAnnotation(
                    annotations,
                    "after",
                    lineNumber,
                  )}
                  side="after"
                  onClick={() =>
                    onAnchor({
                      blockId: block.id,
                      kind: "line",
                      filePath: block.data.filename,
                      line: { side: "after", start: lineNumber },
                    })
                  }
                />
                <CodeCell
                  tokens={highlightedLines[index]}
                  tone="context"
                  value={line}
                />
              </div>
              {endingAnnotations.map((annotation) => (
                <AnnotationCard
                  key={`annotation:${annotation.marker}`}
                  annotation={annotation}
                  blockId={block.id}
                  unified
                />
              ))}
            </Fragment>
          );
        })}
      </div>
      {!expanded && lines.length > visibleLines.length ? (
        <button
          className="w-full border-t bg-canvas-subtle px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-control-hover"
          type="button"
          onClick={() => setExpanded(true)}
        >
          Show all {lines.length} lines
        </button>
      ) : null}
    </div>
  );
}

type DiffDisplayRow =
  | { type: "row"; row: DiffRow }
  | {
      type: "collapse";
      id: string;
      count: number;
      startLine?: number;
      endLine?: number;
    }
  | { type: "annotation"; annotation: NumberedAnnotation };

type DiffRow = {
  id: string;
  beforeLine?: number;
  afterLine?: number;
  beforeIndex?: number;
  afterIndex?: number;
  before: string;
  after: string;
  kind: "context" | "add" | "remove" | "modify";
};

function alignDiffRows(
  beforeText: string,
  afterText: string,
  beforeStartLine: number,
  afterStartLine: number,
) {
  const rows: DiffRow[] = [];
  let beforeLine = beforeStartLine;
  let afterLine = afterStartLine;
  let beforeIndex = 0;
  let afterIndex = 0;
  const pendingRemoved: Array<{
    before: string;
    beforeLine: number;
    beforeIndex: number;
  }> = [];

  function flushRemoved() {
    while (pendingRemoved.length > 0) {
      const removed = pendingRemoved.shift();
      if (!removed) {
        continue;
      }
      rows.push({
        id: `r:${removed.beforeLine}:${removed.before}`,
        beforeLine: removed.beforeLine,
        beforeIndex: removed.beforeIndex,
        before: removed.before,
        after: "",
        kind: "remove",
      });
    }
  }

  for (const part of diffLines(beforeText, afterText)) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (part.added) {
        const removed = pendingRemoved.shift();
        if (removed) {
          rows.push({
            id: `m:${removed.beforeLine}:${afterLine}:${removed.before}:${line}`,
            beforeLine: removed.beforeLine,
            afterLine,
            beforeIndex: removed.beforeIndex,
            afterIndex,
            before: removed.before,
            after: line,
            kind: "modify",
          });
        } else {
          rows.push({
            id: `a:${afterLine}:${line}`,
            afterLine,
            afterIndex,
            before: "",
            after: line,
            kind: "add",
          });
        }
        afterLine += 1;
        afterIndex += 1;
      } else if (part.removed) {
        pendingRemoved.push({
          beforeLine,
          before: line,
          beforeIndex,
        });
        beforeLine += 1;
        beforeIndex += 1;
      } else {
        flushRemoved();
        rows.push({
          id: `c:${beforeLine}:${afterLine}:${line}`,
          beforeLine,
          afterLine,
          beforeIndex,
          afterIndex,
          before: line,
          after: line,
          kind: "context",
        });
        beforeLine += 1;
        afterLine += 1;
        beforeIndex += 1;
        afterIndex += 1;
      }
    }
  }
  flushRemoved();
  return rows;
}

function buildDiffDisplayRows(
  rows: DiffRow[],
  annotations: NumberedAnnotation[],
  threads: Thread[],
  expandedGroups: Set<string>,
): DiffDisplayRow[] {
  const contextRunThreshold = 8;
  const contextEdge = 3;
  const output: DiffDisplayRow[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    if (row?.kind !== "context") {
      output.push({ type: "row", row });
      index += 1;
      continue;
    }

    const start = index;
    while (index < rows.length && rows[index]?.kind === "context") {
      index += 1;
    }
    const run = rows.slice(start, index);
    const hasProtectedRow = run.some((runRow) =>
      isProtectedDiffRow(runRow, annotations, threads),
    );
    const collapseId = `collapse:${start}:${index}`;

    if (
      run.length <= contextRunThreshold ||
      hasProtectedRow ||
      expandedGroups.has(collapseId)
    ) {
      output.push(
        ...run.map((runRow) => ({ type: "row" as const, row: runRow })),
      );
      continue;
    }

    const head = run.slice(0, contextEdge);
    const tail = run.slice(-contextEdge);
    const hidden = run.slice(contextEdge, run.length - contextEdge);
    const firstHidden = hidden[0];
    const lastHidden = hidden[hidden.length - 1];
    output.push(
      ...head.map((runRow) => ({ type: "row" as const, row: runRow })),
    );
    output.push({
      type: "collapse",
      id: collapseId,
      count: hidden.length,
      startLine: firstHidden?.afterLine ?? firstHidden?.beforeLine,
      endLine: lastHidden?.afterLine ?? lastHidden?.beforeLine,
    });
    output.push(
      ...tail.map((runRow) => ({ type: "row" as const, row: runRow })),
    );
  }

  return interleaveAnnotations(output, annotations);
}

// Inserts each annotation card directly after the last row of its line
// range, so notes sit next to the code they describe.
function interleaveAnnotations(
  items: DiffDisplayRow[],
  annotations: NumberedAnnotation[],
): DiffDisplayRow[] {
  if (annotations.length === 0) {
    return items;
  }
  const remaining = [...annotations];
  const output: DiffDisplayRow[] = [];
  for (const item of items) {
    output.push(item);
    if (item.type !== "row") {
      continue;
    }
    for (const annotation of remaining.filter((candidate) =>
      annotationEndsAtRow(candidate, item.row),
    )) {
      output.push({ type: "annotation", annotation });
      remaining.splice(remaining.indexOf(annotation), 1);
    }
  }
  // Annotations whose lines no longer match any row still render at the end.
  for (const annotation of remaining) {
    output.push({ type: "annotation", annotation });
  }
  return output;
}

function annotationEndsAtRow(annotation: NumberedAnnotation, row: DiffRow) {
  const line = annotation.side === "before" ? row.beforeLine : row.afterLine;
  return line !== undefined && annotationRange(annotation)[1] === line;
}

function isProtectedDiffRow(
  row: DiffRow,
  annotations: NumberedAnnotation[],
  threads: Thread[],
) {
  return (
    lineHasAnnotation(annotations, "before", row.beforeLine) ||
    lineHasAnnotation(annotations, "after", row.afterLine) ||
    lineThreadIds(threads, "before", row.beforeLine).length > 0 ||
    lineThreadIds(threads, "after", row.afterLine).length > 0
  );
}

function CollapsedDiffRow({
  count,
  startLine,
  endLine,
  unified,
  onExpand,
}: {
  count: number;
  startLine?: number;
  endLine?: number;
  unified: boolean;
  onExpand: () => void;
}) {
  const range =
    startLine !== undefined && endLine !== undefined
      ? ` (${startLine}–${endLine})`
      : "";
  return (
    <button
      className={`grid w-full min-w-[560px] border-y bg-canvas-subtle text-center text-xs font-medium text-fg-muted transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unified
          ? "grid-cols-[64px_minmax(0,1fr)]"
          : "grid-cols-[64px_minmax(0,1fr)_64px_minmax(0,1fr)]"
      }`}
      type="button"
      onClick={onExpand}
    >
      <span />
      <span className={unified ? "px-3 py-1" : "col-span-3 px-3 py-1"}>
        · {count} unchanged lines{range} ·
      </span>
    </button>
  );
}

type CellTone = "context" | "add" | "remove" | "empty";

function LineButton({
  id,
  line,
  side,
  tone = "context",
  threadIds,
  marker,
  annotated,
  onClick,
}: {
  id?: string;
  line?: number;
  side: "before" | "after";
  tone?: CellTone;
  threadIds: string[];
  marker?: number;
  annotated?: boolean;
  onClick: () => void;
}) {
  const count = threadIds.length;
  const toneClass =
    tone === "add"
      ? "bg-diff-add-num text-fg"
      : tone === "remove"
        ? "bg-diff-del-num text-fg"
        : tone === "empty"
          ? "bg-diff-empty text-fg-muted"
          : "bg-canvas text-fg-muted";
  return (
    <button
      id={id}
      className={`group/gutter relative flex min-h-5 cursor-pointer items-center justify-end gap-1 px-2 text-right tabular-nums transition-colors hover:text-fg disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${toneClass}`}
      disabled={!line}
      title={`Comment on ${side} line ${line}`}
      type="button"
      onClick={() => {
        if (count > 0) {
          scrollToThread(threadIds[0]);
          return;
        }
        onClick();
      }}
    >
      {marker ? (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-done-muted text-[10px] font-semibold text-done-fg">
          {marker}
        </span>
      ) : null}
      {count ? (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-attention-muted px-1 text-[10px] font-semibold text-attention-fg">
          <MessageSquare className="h-3 w-3" />
          {count}
        </span>
      ) : null}
      <span>{line ?? ""}</span>
      {line ? (
        <span className="ml-1 hidden text-accent-fg group-hover/gutter:inline">
          +
        </span>
      ) : null}
      {annotated ? (
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-[3px] bg-done-emphasis"
          data-annotation-bracket
        />
      ) : null}
    </button>
  );
}

function CodeCell({
  value,
  tone,
  sign,
  tokens,
  emphasis,
}: {
  value: string;
  tone: CellTone;
  sign?: string;
  tokens?: HighlightLine;
  emphasis?: Array<[number, number]>;
}) {
  const toneClass =
    tone === "add"
      ? "bg-diff-add-line text-fg"
      : tone === "remove"
        ? "bg-diff-del-line text-fg"
        : tone === "empty"
          ? "bg-diff-empty"
          : "bg-canvas";
  const baseTokens = tokens && tokens.length > 0 ? tokens : [{ text: value }];
  const displayTokens = emphasis?.length
    ? emphasizeRanges(baseTokens, emphasis)
    : baseTokens;
  const emphasisClass =
    tone === "add"
      ? "rounded-sm bg-diff-add-word"
      : tone === "remove"
        ? "rounded-sm bg-diff-del-word"
        : "";
  return (
    <code
      className={`flex min-w-0 overflow-hidden whitespace-pre-wrap px-3 ${toneClass}`}
      data-diff-code-cell
    >
      <span
        className={`mr-2 w-3 shrink-0 ${
          sign === "+"
            ? "text-success-fg"
            : sign === "-"
              ? "text-danger-fg"
              : "text-fg-muted"
        }`}
      >
        {sign ?? " "}
      </span>
      <span className="syntax-highlight min-w-0 break-words">
        {renderHighlightLine(displayTokens, emphasisClass)}
      </span>
    </code>
  );
}

type NumberedAnnotation = Extract<
  ReviewBlock,
  { type: "diff" | "annotated-code" }
>["data"]["annotations"][number] & { marker: number };

function annotationRange(annotation: { lines: string }): [number, number] {
  const [start = 0, end] = annotation.lines.split("-").map(Number);
  return [start, end ?? start];
}

function annotationMarkerStartingAt(
  annotations: NumberedAnnotation[],
  side: "before" | "after",
  line?: number,
) {
  if (!line) {
    return undefined;
  }
  return annotations.find(
    (annotation) =>
      annotation.side === side && annotationRange(annotation)[0] === line,
  )?.marker;
}

function lineHasAnnotation(
  annotations: NumberedAnnotation[],
  side: "before" | "after",
  line?: number,
) {
  if (!line) {
    return false;
  }
  return annotations.some(
    (annotation) =>
      annotation.side === side && lineInRange(line, annotation.lines),
  );
}

function annotationRangeLabel(annotation: {
  side: "before" | "after";
  lines: string;
}) {
  const [start, end] = annotationRange(annotation);
  const range = end !== start ? `lines ${start}–${end}` : `line ${start}`;
  return annotation.side === "before" ? `old ${range}` : range;
}

function AnnotationCard({
  annotation,
  blockId,
  unified,
}: {
  annotation: NumberedAnnotation;
  blockId: string;
  unified: boolean;
}) {
  return (
    <div
      className={`grid border-y ${
        unified
          ? "min-w-[560px] grid-cols-[64px_minmax(0,1fr)]"
          : "min-w-[760px] grid-cols-[64px_minmax(0,1fr)_64px_minmax(0,1fr)]"
      }`}
      data-diff-annotation={annotation.marker}
    >
      <span className="bg-canvas-subtle" />
      <div
        className={`border-l-[3px] border-l-done-emphasis bg-done-muted px-3 py-2 font-sans ${
          unified ? "" : "col-span-3"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-done-muted font-semibold text-done-fg">
            {annotation.marker}
          </span>
          {annotation.label ? (
            <span className="font-semibold text-done-fg">
              {annotation.label}
            </span>
          ) : null}
          <span className="text-done-fg">
            {annotationRangeLabel(annotation)}
          </span>
        </div>
        <p
          className="mt-1 max-w-[58rem] text-sm leading-6"
          data-block-id={blockId}
          data-text-anchorable="true"
        >
          {annotation.note}
        </p>
      </div>
    </div>
  );
}

function lineInRange(line: number, range: string) {
  const [start, end] = range.split("-").map(Number);
  return line >= start && line <= (end ?? start);
}

function lineThreadIds(
  threads: Thread[],
  side: "before" | "after",
  line?: number,
) {
  if (!line) {
    return [];
  }
  return threads
    .filter((thread) => {
      const anchor = thread.root.anchor;
      if (anchor?.kind !== "line" || !anchor.line) {
        return false;
      }
      return (
        anchor.line.side === side &&
        line >= anchor.line.start &&
        line <= (anchor.line.end ?? anchor.line.start)
      );
    })
    .map((thread) => thread.root.id);
}

function MermaidBlock({
  source,
  caption,
}: {
  source: string;
  caption?: string;
}) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const scheme = useColorScheme();
  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(null);
    import("mermaid").then(async ({ default: mermaid }) => {
      try {
        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          theme: scheme === "dark" ? "dark" : "neutral",
          // sanitizeSvg strips foreignObject, which is where html labels
          // live, so diagrams must label with svg text.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        const rendered = await mermaid.render(
          `diagram-${hash(source)}`,
          source,
        );
        if (!cancelled) {
          setSvg(sanitizeSvg(rendered.svg));
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Could not render diagram",
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, scheme]);

  return (
    <figure className="group relative rounded-md border bg-canvas p-4">
      {svg ? (
        <>
          <button
            aria-label="Expand diagram"
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-canvas/90 text-fg-muted opacity-0 transition-opacity hover:bg-control-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            title="Expand diagram"
            type="button"
            onClick={() => setExpanded(true)}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <div
            aria-label={caption ?? "Mermaid diagram"}
            role="img"
            className="mx-auto max-w-full overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            // SVG diagrams must be injected inline so viewBox sizing works.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG diagrams must be injected inline so viewBox sizing works.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </>
      ) : error ? (
        <div className="rounded-md border border-danger-border bg-danger-muted p-3 text-sm text-danger-fg">
          <div className="font-medium">Diagram could not be rendered</div>
          <p className="mt-1">{error}</p>
          <details className="mt-2">
            <summary className="cursor-pointer">Source</summary>
            <pre className="mt-2 overflow-x-auto font-mono text-xs">
              {source}
            </pre>
          </details>
        </div>
      ) : (
        <div className="h-56 animate-pulse rounded-md bg-canvas-subtle" />
      )}
      {caption ? (
        <figcaption className="mt-3 text-center text-sm text-fg-muted">
          {caption}
        </figcaption>
      ) : null}
      {expanded ? (
        <button
          aria-label="Close diagram"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
          type="button"
          onClick={() => setExpanded(false)}
        >
          <span className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-fg">
            <X className="h-5 w-5" />
          </span>
          <span
            aria-label={caption ?? "Mermaid diagram"}
            className="max-h-full max-w-full overflow-auto rounded-md bg-canvas p-6 [&_svg]:h-auto [&_svg]:max-h-[calc(100vh-6rem)] [&_svg]:max-w-[calc(100vw-6rem)]"
            role="img"
            // SVG diagrams must be injected inline so viewBox sizing works.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG diagrams must be injected inline so viewBox sizing works.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </button>
      ) : null}
    </figure>
  );
}

function sanitizeSvg(svg: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svg, "image/svg+xml");
  for (const element of Array.from(
    document.querySelectorAll("script, foreignObject"),
  )) {
    element.remove();
  }
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name.endsWith(":href")) &&
          value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}

function Composer({
  anchor,
  message,
  resolutionTarget,
  pending,
  onAnchor,
  onMessage,
  onResolutionTarget,
  onSubmit,
}: {
  anchor: ReviewAnchor | null;
  message: string;
  resolutionTarget: "agent" | "human";
  pending: boolean;
  onAnchor: (anchor: ReviewAnchor | null) => void;
  onMessage: (message: string) => void;
  onResolutionTarget: (target: "agent" | "human") => void;
  onSubmit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = anchorLabel(anchor);
  useEffect(() => {
    if (message || anchor) {
      setExpanded(true);
    }
  }, [message, anchor]);

  return (
    <div className="rounded-md border bg-canvas p-4">
      {!expanded ? (
        <button
          className="w-full rounded-md border bg-canvas px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={() => setExpanded(true)}
        >
          Add a comment...
        </button>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">New comment</span>
            <button
              className="inline-flex min-w-0 items-center gap-1 rounded-full border bg-canvas-subtle px-2 py-0.5 font-mono text-xs text-fg-muted transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Clear anchor"
              type="button"
              onClick={() => onAnchor(null)}
            >
              <span className="truncate">{label}</span>
              {anchor ? <X className="h-3 w-3" /> : null}
            </button>
          </div>
          <textarea
            aria-label="Comment text"
            className="min-h-28 w-full resize-y rounded-md border bg-canvas p-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            value={message}
            onChange={(event) => onMessage(event.target.value)}
          />
          <div className="mt-3 rounded-md border bg-canvas-subtle p-1">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <button
                className={`rounded-md px-3 py-2 transition-colors ${
                  resolutionTarget === "agent"
                    ? "bg-canvas text-fg"
                    : "text-fg-muted hover:bg-control-hover"
                }`}
                type="button"
                onClick={() => onResolutionTarget("agent")}
              >
                <Bot className="mr-1 inline h-4 w-4" />
                Agent should fix
              </button>
              <button
                className={`rounded-md px-3 py-2 transition-colors ${
                  resolutionTarget === "human"
                    ? "bg-canvas text-fg"
                    : "text-fg-muted hover:bg-control-hover"
                }`}
                type="button"
                onClick={() => onResolutionTarget("human")}
              >
                <MessageSquare className="mr-1 inline h-4 w-4" />
                FYI for humans
              </button>
            </div>
            <p className="px-2 py-1 text-xs text-fg-muted">
              {resolutionTarget === "agent"
                ? "The agent will pull this and act on it."
                : "Visible context for humans; the agent will not act."}
            </p>
          </div>
          <Button className="mt-3 w-full" disabled={pending} onClick={onSubmit}>
            {pending ? "Posting..." : "Post comment"}
          </Button>
        </>
      )}
    </div>
  );
}

function ThreadsSidebar({
  justSynced,
  reconnecting,
  lastPostedThreadId,
  reviewId,
  threads,
  onRefresh,
  onStatus,
}: {
  justSynced: boolean;
  reconnecting: boolean;
  lastPostedThreadId: string | null;
  reviewId: string;
  threads: Thread[];
  onRefresh: () => Promise<void>;
  onStatus: (commentId: string, status: "open" | "resolved") => void;
}) {
  const [replyByThread, setReplyByThread] = useState<Record<string, string>>(
    {},
  );
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  useEffect(() => {
    if (lastPostedThreadId) {
      scrollToThread(lastPostedThreadId);
    }
  }, [lastPostedThreadId]);

  async function submitReply(thread: Thread) {
    const threadId = thread.root.id;
    const message = replyByThread[threadId]?.trim();
    if (!message) {
      return;
    }
    setPendingReply(threadId);
    try {
      await fetch(`/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          parentCommentId: threadId,
          resolutionTarget: thread.root.resolutionTarget,
        }),
      });
      setReplyByThread((current) => ({ ...current, [threadId]: "" }));
      setOpenReply(null);
      await onRefresh();
    } finally {
      setPendingReply(null);
    }
  }
  const groups = [
    {
      label: "Needs agent",
      threads: threads.filter(
        (thread) =>
          thread.root.status === "open" &&
          thread.root.resolutionTarget === "agent",
      ),
    },
    {
      label: "FYI for humans",
      threads: threads.filter(
        (thread) =>
          thread.root.status === "open" &&
          thread.root.resolutionTarget === "human",
      ),
    },
    {
      label: "Resolved",
      threads: threads.filter((thread) => thread.root.status === "resolved"),
      collapsed: !showResolved,
    },
  ];

  return (
    <div className="rounded-md border bg-canvas">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Threads</span>
        <span
          className={`text-xs text-fg-muted transition-opacity ${
            justSynced || reconnecting ? "opacity-100" : "opacity-0"
          }`}
        >
          {reconnecting ? "reconnecting..." : "updated just now"}
        </span>
      </div>
      <div className="divide-y">
        {groups.map((group) => (
          <section key={group.label} className="p-4">
            <button
              className="mb-3 flex w-full items-center justify-between text-left text-sm font-semibold"
              type="button"
              onClick={() =>
                group.label === "Resolved"
                  ? setShowResolved((value) => !value)
                  : undefined
              }
            >
              <span className="flex items-center gap-2">
                {group.label}
                <Badge>{group.threads.length}</Badge>
              </span>
              {group.label === "Resolved" ? (
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showResolved ? "rotate-180" : ""}`}
                />
              ) : null}
            </button>
            {group.collapsed ? null : (
              <div className="space-y-3">
                {group.threads.length === 0 ? (
                  <p className="text-sm text-fg-muted">Nothing here.</p>
                ) : (
                  group.threads.map((thread) => (
                    <ThreadCard
                      key={thread.root.id}
                      thread={thread}
                      openReply={openReply === thread.root.id}
                      pendingReply={pendingReply === thread.root.id}
                      reply={replyByThread[thread.root.id] ?? ""}
                      onOpenReply={() => setOpenReply(thread.root.id)}
                      onReply={(value) =>
                        setReplyByThread((current) => ({
                          ...current,
                          [thread.root.id]: value,
                        }))
                      }
                      onSubmitReply={() => submitReply(thread)}
                      onStatus={onStatus}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  openReply,
  pendingReply,
  reply,
  onOpenReply,
  onReply,
  onSubmitReply,
  onStatus,
}: {
  thread: Thread;
  openReply: boolean;
  pendingReply: boolean;
  reply: string;
  onOpenReply: () => void;
  onReply: (value: string) => void;
  onSubmitReply: () => void;
  onStatus: (commentId: string, status: "open" | "resolved") => void;
}) {
  const author = thread.root.authorName ?? thread.root.authorEmail ?? "Agent";
  const targetId = anchorTargetId(thread.root.anchor);
  return (
    <div
      id={`thread-${thread.root.id}`}
      className={`rounded-md border p-3 ${thread.root.status === "resolved" ? "bg-canvas-subtle opacity-75" : "bg-canvas"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={author} agent={thread.root.createdBy === "agent"} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{author}</div>
            <div className="text-xs text-fg-muted">
              <RelativeTime value={thread.root.createdAt} />
            </div>
          </div>
        </div>
        {!thread.root.consumedAt ? (
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-attention-emphasis"
            title="Agent has not pulled this yet"
          />
        ) : null}
      </div>
      <a
        className="mt-3 inline-flex max-w-full items-center gap-1 rounded-full border bg-canvas-subtle px-2 py-0.5 font-mono text-xs text-fg-muted transition-colors hover:bg-control-hover hover:text-fg"
        href={targetId ? `#${targetId}` : "#"}
        onClick={(event) => {
          if (!thread.root.anchor) {
            return;
          }
          event.preventDefault();
          // Push the jump into history so the back button returns here.
          if (targetId) {
            window.history.pushState(
              null,
              "",
              `#${encodeURIComponent(targetId)}`,
            );
          }
          scrollToAnchor(thread.root.anchor);
        }}
      >
        {thread.root.detached ? <Badge tone="amber">detached</Badge> : null}
        <span className="truncate">{thread.root.anchorLabel}</span>
      </a>
      <p className="mt-2 text-sm leading-6">{thread.root.message}</p>
      {thread.replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-l pl-3">
          {thread.replies.map((item) => (
            <div key={item.id} className="text-sm">
              <div className="text-xs text-fg-muted">
                {item.authorName ?? item.authorEmail ?? "Agent"} ·{" "}
                <RelativeTime value={item.createdAt} />
              </div>
              <p>{item.message}</p>
            </div>
          ))}
        </div>
      ) : null}
      {openReply ? (
        <div className="mt-3 space-y-2">
          <textarea
            aria-label="Reply in thread"
            className="min-h-16 w-full resize-y rounded-md border bg-canvas p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Reply in thread"
            value={reply}
            onChange={(event) => onReply(event.target.value)}
          />
          <Button disabled={pendingReply} size="sm" onClick={onSubmitReply}>
            Post reply
          </Button>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={onOpenReply}>
          Reply
        </Button>
        {thread.root.status === "open" ? (
          <Button
            aria-label="Resolve thread"
            size="icon"
            title="Resolve"
            variant="ghost"
            onClick={() => onStatus(thread.root.id, "resolved")}
          >
            <Check className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            aria-label="Reopen thread"
            size="icon"
            title="Reopen"
            variant="ghost"
            onClick={() => onStatus(thread.root.id, "open")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, agent }: { name: string; agent?: boolean }) {
  if (agent) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-emphasis text-fg-on-emphasis">
        <Bot className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent-fg">
      {initials(name)}
    </span>
  );
}

function anchorLabel(anchor: ReviewAnchor | null) {
  if (!anchor) {
    return "review-level";
  }
  if (anchor.kind === "line" && anchor.line) {
    return `${anchor.filePath ?? anchor.blockId} · ${anchor.line.side}:${anchor.line.start}`;
  }
  if (anchor.kind === "question" && anchor.questionId) {
    return `question ${anchor.questionId}`;
  }
  if (anchor.kind === "file" && anchor.filePath) {
    return anchor.filePath;
  }
  if (anchor.textQuote?.quote) {
    return `"${anchor.textQuote.quote.slice(0, 80)}"`;
  }
  return anchor.blockId;
}

function anchorTargetId(anchor: ReviewAnchor | null) {
  if (!anchor) {
    return undefined;
  }
  if (anchor.kind === "line" && anchor.line) {
    return lineTargetId(anchor.blockId, anchor.line.side, anchor.line.start);
  }
  return anchor.blockId;
}

function lineTargetId(
  blockId: string,
  side: "before" | "after",
  line?: number,
) {
  return line ? `${blockId}-${side}-${line}` : undefined;
}

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function scrollToThread(threadId?: string) {
  if (!threadId) {
    return;
  }
  scrollToElement(`thread-${threadId}`, "center");
}

function scrollToAnchor(anchor: ReviewAnchor) {
  activateBlockTab(anchor.blockId);
  // The owning evidence card may need a render pass to expand before the
  // anchored element exists.
  window.setTimeout(() => {
    const target = findTextAnchorTarget(anchor);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      flashDomElement(target);
      return;
    }
    scrollToElement(
      anchorTargetId(anchor),
      anchor.kind === "line" ? "center" : "start",
    );
  }, 50);
}

function flashAnchor(anchor: ReviewAnchor | null) {
  if (!anchor) {
    return;
  }
  const target = findTextAnchorTarget(anchor);
  if (target) {
    flashDomElement(target);
    return;
  }
  flashElement(anchorTargetId(anchor));
}

function findTextAnchorTarget(anchor: ReviewAnchor | null) {
  const quote = anchor?.textQuote?.quote;
  if (!anchor || !quote) {
    return null;
  }
  const block = document.getElementById(anchor.blockId);
  if (!block) {
    return null;
  }
  const normalizedQuote = normalizeComparableText(quote);
  const candidates = Array.from(
    block.querySelectorAll<HTMLElement>(
      "[data-text-anchorable], p, li, td, th, span, h1, h2, h3, h4, h5, h6",
    ),
  );
  return (
    candidates.find((candidate) =>
      normalizeComparableText(candidate.textContent ?? "").includes(
        normalizedQuote,
      ),
    ) ?? null
  );
}

function scrollToElement(id?: string, block: ScrollLogicalPosition = "start") {
  if (!id) {
    return;
  }
  const element = document.getElementById(id);
  element?.scrollIntoView({ block, behavior: "smooth" });
  flashElement(id);
}

function flashElement(id?: string) {
  if (!id) {
    return;
  }
  window.setTimeout(() => {
    const element = document.getElementById(id);
    if (element) {
      flashDomElement(element);
    }
  }, 0);
}

function flashDomElement(element: Element) {
  element.classList.add("flash-highlight");
  window.setTimeout(() => element.classList.remove("flash-highlight"), 2000);
}

function hash(value: string) {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output << 5) - output + value.charCodeAt(index);
    output |= 0;
  }
  return Math.abs(output).toString(36);
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function activateBlockTab(blockId?: string) {
  if (!blockId) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("sieve:activate-block", { detail: { blockId } }),
  );
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
