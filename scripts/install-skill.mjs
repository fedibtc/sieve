#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = join(root, "skills", "sieve");
const claudeTarget = join(homedir(), ".claude", "skills", "sieve");
const codexTarget = join(homedir(), ".codex", "skills", "sieve");
const legacySkillName = ["fedi", "review"].join("-");
const legacyClaudeTarget = join(
  homedir(),
  ".claude",
  "skills",
  legacySkillName,
);
const legacyCodexTarget = join(homedir(), ".codex", "skills", legacySkillName);

mkdirSync(dirname(claudeTarget), { recursive: true });
rmSync(legacyClaudeTarget, { force: true, recursive: true });
rmSync(claudeTarget, { force: true, recursive: true });
symlinkSync(skillSource, claudeTarget, "dir");

mkdirSync(codexTarget, { recursive: true });
rmSync(legacyCodexTarget, { force: true, recursive: true });
rmSync(codexTarget, { force: true, recursive: true });
cpSync(skillSource, codexTarget, { recursive: true });

console.log(`Installed Claude Code skill: ${claudeTarget}`);
console.log(`Installed Codex skill: ${codexTarget}`);
