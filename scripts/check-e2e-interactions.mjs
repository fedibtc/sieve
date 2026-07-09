#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let files = "";
try {
  files = execFileSync("rg", ["--files", "e2e"], { encoding: "utf8" });
} catch {
  process.exit(0);
}

const banned = [
  { pattern: /force:\s*true/, label: "force: true" },
  { pattern: /dispatchEvent\s*\(/, label: "dispatchEvent(" },
  {
    pattern: /\.evaluate\([^)]*\.click\s*\(/s,
    label: "DOM click inside evaluate",
  },
];

const failures = [];
for (const relative of files.trim().split("\n").filter(Boolean)) {
  const text = readFileSync(join(process.cwd(), relative), "utf8");
  for (const rule of banned) {
    if (rule.pattern.test(text)) {
      failures.push(`${relative}: banned user-path shortcut: ${rule.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
