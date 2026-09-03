"use client";

import { Check, Copy, KeyRound, Plus, Terminal, Trash2 } from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { highlightCode } from "@/lib/highlight";

type TokenSummary = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean;
  lastRequest: string | Date | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
};

type CreatedToken = TokenSummary & {
  key: string;
};

export function TokenSettings({
  initialTokens,
  baseUrl,
}: {
  initialTokens: TokenSummary[];
  baseUrl: string;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("Local agent");
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calloutRef = useRef<HTMLDivElement | null>(null);

  const connectSnippets = useMemo(() => {
    const key = createdToken?.key ?? "sieve_...";
    return {
      cliDev: `sieve --host ${baseUrl} login --dev`,
      cliEnv: `export SIEVE_TOKEN=${key}\nsieve --host ${baseUrl} status`,
      env: `export SIEVE_TOKEN=${key}`,
      claude: `claude mcp add --transport http sieve ${baseUrl}/api/mcp --header "Authorization: Bearer ${key}"`,
      codex: `[mcp_servers.sieve]\nurl = "${baseUrl}/api/mcp"\nheaders = { Authorization = "Bearer ${key}" }`,
      remote: `npx mcp-remote ${baseUrl}/api/mcp --header "Authorization: Bearer ${key}"`,
    };
  }, [baseUrl, createdToken]);

  async function mintToken() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Could not mint token");
      return;
    }
    const body = (await response.json()) as { token: CreatedToken };
    setCreatedToken(body.token);
    setTokens((current) => [body.token, ...current]);
    window.requestAnimationFrame(() => {
      calloutRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      calloutRef.current?.classList.add("flash-highlight");
      window.setTimeout(
        () => calloutRef.current?.classList.remove("flash-highlight"),
        2000,
      );
    });
  }

  async function revokeToken(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setError("Could not revoke token");
      return;
    }
    setTokens((current) => current.filter((token) => token.id !== id));
    if (createdToken?.id === id) {
      setCreatedToken(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <div className="flex items-center gap-3">
          <KeyRound className="h-7 w-7" />
          <h1 className="text-3xl font-semibold tracking-tight">
            Agent tokens
          </h1>
        </div>
        <p className="max-w-2xl text-fg-muted">
          Mint bearer tokens for the sieve CLI. Tokens are shown once and expire
          after 90 days.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-72 flex-1 flex-col gap-2 font-medium text-sm">
              Token name
              <input
                className="h-10 rounded-md border bg-canvas px-3 font-normal text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button disabled={busy} onClick={mintToken}>
              <Plus className="h-4 w-4" />
              Mint token
            </Button>
          </div>

          {error ? <p className="text-danger-fg text-sm">{error}</p> : null}

          {createdToken ? (
            <div
              ref={calloutRef}
              className="rounded-md border border-attention-border bg-attention-muted p-4"
            >
              <div className="mb-1 flex items-center gap-2 font-semibold text-attention-fg">
                <KeyRound className="h-4 w-4" />
                Copy this token now
              </div>
              <p className="mb-3 text-sm text-attention-fg">
                This is shown once. Store it in your shell environment or let
                the CLI store a localhost token with `login --dev`.
              </p>
              <CopyRow value={createdToken.key} />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border bg-canvas">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-canvas-subtle text-fg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Prefix</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr className="border-t" key={token.id}>
                    <td className="px-4 py-3">{token.name ?? "Agent token"}</td>
                    <td className="px-4 py-3">
                      <TokenStatus token={token} />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {token.prefix ?? "sieve_"}
                      {token.start ?? ""}
                    </td>
                    <td className="px-4 py-3">
                      <RelativeTime value={token.lastRequest} />
                    </td>
                    <td className="px-4 py-3">
                      <RelativeTime value={token.expiresAt} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        aria-label="Revoke token"
                        title="Revoke token"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-btn-border bg-btn text-fg-muted shadow-btn transition-colors hover:bg-btn-hover hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Revoke this token?")) {
                            void revokeToken(token.id);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-fg-muted"
                      colSpan={6}
                    >
                      No tokens yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Snippet
            icon={<Terminal className="h-4 w-4" />}
            title="CLI localhost"
            value={connectSnippets.cliDev}
          />
          <Snippet
            icon={<Terminal className="h-4 w-4" />}
            title="CLI bearer"
            value={connectSnippets.cliEnv}
          />
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-fg-muted text-sm">
              Deprecated MCP snippets are migration-only. New agent sessions
              should use `sieve`.
            </p>
            <Snippet title="Claude Code MCP" value={connectSnippets.claude} />
            <Snippet
              language="ini"
              title="Codex MCP config"
              value={connectSnippets.codex}
            />
            <Snippet
              title="mcp-remote fallback"
              value={connectSnippets.remote}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function Snippet({
  title,
  value,
  icon,
  language = "bash",
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border bg-canvas">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </h2>
        <button
          aria-label={`Copy ${title}`}
          title={`Copy ${title}`}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-control-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          type="button"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-xs leading-6">
        <code className="syntax-highlight">
          {highlightCode(value, language)}
        </code>
      </pre>
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch rounded-md border border-attention-border bg-canvas">
      <code className="min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-sm">
        {value}
      </code>
      <button
        aria-label="Copy token"
        title="Copy token"
        className="inline-flex w-11 cursor-pointer items-center justify-center border-attention-border border-l transition-colors hover:bg-attention-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        type="button"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function TokenStatus({ token }: { token: TokenSummary }) {
  if (!token.enabled) {
    return <Badge tone="red">expired</Badge>;
  }
  if (token.expiresAt) {
    const expires = new Date(token.expiresAt).getTime();
    if (expires < Date.now()) {
      return <Badge tone="red">expired</Badge>;
    }
    if (expires - Date.now() < 14 * 24 * 60 * 60 * 1000) {
      return <Badge tone="amber">expires soon</Badge>;
    }
  }
  return <Badge tone="green">active</Badge>;
}
