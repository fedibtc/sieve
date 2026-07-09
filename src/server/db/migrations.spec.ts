import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const destructivePatterns = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i,
];

describe("database migrations", () => {
  it("do not contain destructive DDL without an allowlist entry", () => {
    const root = join(process.cwd(), "drizzle");
    const allowlist = readAllowlist(root);
    const findings = readdirSync(root)
      .filter((name) => name.endsWith(".sql"))
      .flatMap((name) => {
        const sql = readFileSync(join(root, name), "utf8");
        return sql
          .split(/;|-->\s*statement-breakpoint/g)
          .map((statement) => statement.trim())
          .filter(Boolean)
          .filter((statement) =>
            destructivePatterns.some((pattern) => pattern.test(statement)),
          )
          .map((statement) => `${name}: ${statement}`);
      })
      .filter((finding) => !allowlist.has(finding));

    expect(findings).toEqual([]);
  });
});

function readAllowlist(root: string) {
  const path = join(root, "destructive-migrations.allowlist");
  if (!existsSync(path)) {
    return new Set<string>();
  }
  return new Set(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#")),
  );
}
