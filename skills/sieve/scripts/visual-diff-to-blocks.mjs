#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { copyFile, mkdtemp, readFile } from "node:fs/promises";
import { arch, homedir, platform, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoPath = resolve(args.repo ?? process.cwd());
const serverUrl = (args.serverUrl ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const token = process.env.SIEVE_TOKEN;
const maxBlocks = Number(args.maxBlocks ?? 10);
const currentPlatform = `${platform()}-${arch()}`;

const branchDir = args.actualDir ? resolve(args.actualDir) : null;
const baselineDir = args.baselineDir ? resolve(args.baselineDir) : null;
const diffDir = resolve(
  args.diffDir ?? join(repoPath, "test-results", "visual-diff"),
);

if (args.help) {
  usage();
  process.exit(0);
}

const manifest = await main();
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

async function main() {
  mkdirSync(diffDir, { recursive: true });
  const mergeBase = args.mergeBase
    ? git(["rev-parse", args.mergeBase], repoPath).trim()
    : git(
        ["merge-base", args.head ?? "HEAD", args.base ?? "origin/master"],
        repoPath,
      ).trim();
  const baselineRef = `merge-base@${mergeBase.slice(0, 12)}`;

  const baseline = baselineDir
    ? { dir: baselineDir, cached: true, note: null }
    : await ensureBaseline({ mergeBase });
  const actualDir = branchDir ?? (await captureBranchScreens());
  const actual = harvestShowcasePngs(actualDir);

  if (!baseline.dir) {
    return manifestForAddedOnly({
      actual,
      baselineRef,
      baselineCached: false,
      note:
        baseline.note ??
        "Baseline capture failed; every branch showcase screen is reported as added.",
    });
  }

  const expected = harvestShowcasePngs(baseline.dir);
  const regJsonPath = args.regJson
    ? resolve(args.regJson)
    : join(diffDir, "reg.json");
  const overlayDir = resolve(args.overlayDir ?? join(diffDir, "diff"));

  if (!args.regJson) {
    rmSync(overlayDir, { recursive: true, force: true });
    mkdirSync(overlayDir, { recursive: true });
    run(
      [
        "npx",
        "--yes",
        "reg-cli@0.18.16",
        actualDir,
        baseline.dir,
        overlayDir,
        "-J",
        regJsonPath,
        "-M",
        "0.05",
        "-A",
        "-I",
      ],
      repoPath,
      { optional: true },
    );
  }

  const reg = JSON.parse(await readFile(regJsonPath, "utf8"));
  const changed = changedItemsFromReg(
    reg.failedItems,
    actual,
    expected,
    overlayDir,
  );
  const added = addedItemsFromReg(reg.newItems, actual);
  const removed = removedItemsFromReg(reg.deletedItems, expected);
  const unchanged = Array.isArray(reg.passedItems) ? reg.passedItems.length : 0;

  return manifestForItems({
    changed,
    added,
    removed,
    unchanged,
    baselineRef,
    baselineCached: baseline.cached,
    note: null,
  });
}

async function ensureBaseline({ mergeBase }) {
  const cacheRoot = resolve(
    args.cacheDir ?? join(homedir(), ".cache", "sieve", "showcase"),
  );
  const cacheDir = join(cacheRoot, `${mergeBase}-${currentPlatform}`);
  if (
    existsSync(cacheDir) &&
    readdirSync(cacheDir).some((name) => name.endsWith(".png"))
  ) {
    return { dir: cacheDir, cached: true, note: null };
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "fedi-visual-baseline-"));
  const worktree = join(tempRoot, "worktree");
  try {
    git(["worktree", "add", "--detach", worktree, mergeBase], repoPath);
    run(["pnpm", "install", "--frozen-lockfile"], worktree);
    await runShowcase(worktree);
    const screenshots = harvestShowcasePngs(join(worktree, "test-results"));
    rmSync(cacheDir, { recursive: true, force: true });
    mkdirSync(cacheDir, { recursive: true });
    await copyScreens(screenshots, cacheDir);
    return { dir: cacheDir, cached: false, note: null };
  } catch (error) {
    return {
      dir: null,
      cached: false,
      note: error instanceof Error ? error.message : "Baseline capture failed",
    };
  } finally {
    run(["git", "worktree", "remove", "--force", worktree], repoPath, {
      optional: true,
    });
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function captureBranchScreens() {
  await runShowcase(repoPath);
  return join(repoPath, "test-results");
}

async function runShowcase(cwd) {
  const command = args.showcaseCommand ?? "pnpm test:e2e:showcase";
  run(command.split(/\s+/), cwd);
}

function changedItemsFromReg(items, actual, expected, overlayDir) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const name = itemName(item);
    return {
      name,
      actual: actual.get(name) ?? pathFromReg(item.actual),
      expected: expected.get(name) ?? pathFromReg(item.expected),
      diff: pathFromReg(item.diff) ?? findOverlay(overlayDir, name),
    };
  });
}

function addedItemsFromReg(items, actual) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const name = itemName(item);
    return {
      name,
      actual: actual.get(name) ?? pathFromReg(item.actual),
      expected: null,
      diff: null,
    };
  });
}

function removedItemsFromReg(items, expected) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const name = itemName(item);
    return {
      name,
      actual: null,
      expected: expected.get(name) ?? pathFromReg(item.expected),
      diff: null,
    };
  });
}

async function manifestForAddedOnly({
  actual,
  baselineRef,
  baselineCached,
  note,
}) {
  const added = [...actual.entries()].map(([name, actualPath]) => ({
    name,
    actual: actualPath,
    expected: null,
    diff: null,
  }));
  return manifestForItems({
    changed: [],
    added,
    removed: [],
    unchanged: 0,
    baselineRef,
    baselineCached,
    note,
  });
}

async function manifestForItems({
  changed,
  added,
  removed,
  unchanged,
  baselineRef,
  baselineCached,
  note,
}) {
  const ordered = [
    ...changed.map((item) => ({ ...item, status: "changed" })),
    ...added.map((item) => ({ ...item, status: "added" })),
    ...removed.map((item) => ({ ...item, status: "removed" })),
  ];
  const selected = ordered.slice(0, maxBlocks);
  const omitted = ordered.slice(maxBlocks).map((item) => item.name);
  const blocks = [];

  for (const item of selected) {
    const before = item.expected
      ? await uploadImage(item.expected, { manifestOnly: args.manifestOnly })
      : null;
    const after = item.actual
      ? await uploadImage(item.actual, { manifestOnly: args.manifestOnly })
      : null;
    const diff = item.diff
      ? await uploadImage(item.diff, { manifestOnly: args.manifestOnly })
      : null;
    blocks.push({
      id: `visual-${slug(item.name)}`,
      type: "image-diff",
      data: {
        name: item.name,
        status: item.status,
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        ...(diff && item.status === "changed" ? { diff } : {}),
        baseline: { ref: baselineRef, platform: currentPlatform },
      },
    });
  }

  if (note || omitted.length) {
    blocks.push({
      id: "visual-capture-note",
      type: "callout",
      data: {
        tone: note ? "warning" : "info",
        markdown: [
          note ? `**Visual comparison limitation:** ${note}` : "",
          omitted.length
            ? `**Additional changed screens:** ${omitted.join(", ")} (${omitted.length} omitted after the ${maxBlocks}-comparison cap).`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
  }

  return {
    summary: {
      changed: changed.length,
      added: added.length,
      removed: removed.length,
      unchanged,
      baseline: {
        ref: baselineRef,
        platform: currentPlatform,
        cached: baselineCached,
      },
      omitted,
      note,
    },
    blocks,
  };
}

async function uploadImage(filePath, { manifestOnly }) {
  const data = await readFile(filePath);
  const sha256 = createHash("sha256").update(data).digest("hex");
  const { width, height } = parsePng(data);
  if (manifestOnly) {
    return { attachmentId: `sha256:${sha256}`, width, height };
  }
  const authHeaders = attachmentAuthHeaders();
  if (!token && !isLocalServerUrl(serverUrl)) {
    throw new Error(
      "SIEVE_TOKEN is required to upload images to non-local Sieve hosts",
    );
  }

  const existing = await fetch(
    `${serverUrl}/api/attachments/by-hash/${sha256}`,
    {
      headers: authHeaders,
    },
  );
  if (existing.status === 200) {
    const payload = await existing.json();
    return {
      attachmentId: payload.id,
      width: payload.width,
      height: payload.height,
    };
  }

  const uploaded = await fetch(`${serverUrl}/api/attachments`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "image/png",
      "content-length": String(data.byteLength),
    },
    body: data,
  });
  if (!uploaded.ok) {
    throw new Error(
      `Attachment upload failed for ${filePath}: ${uploaded.status} ${await uploaded.text()}`,
    );
  }
  const payload = await uploaded.json();
  return {
    attachmentId: payload.id,
    width: payload.width,
    height: payload.height,
  };
}

function attachmentAuthHeaders() {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function isLocalServerUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function harvestShowcasePngs(root) {
  const files = walk(root).filter((file) => {
    const name = basename(file);
    return (
      name.startsWith("showcase-") &&
      name.endsWith(".png") &&
      !file.split(/[\\/]/).includes("attachments")
    );
  });
  const byName = new Map();
  for (const file of files) {
    const name = basename(file, ".png").replace(/^showcase-/, "");
    if (byName.has(name)) {
      throw new Error(`Duplicate showcase screenshot name: ${name}`);
    }
    byName.set(name, file);
  }
  return byName;
}

async function copyScreens(screens, destination) {
  for (const [name, file] of screens) {
    await copyFile(file, join(destination, `showcase-${name}.png`));
  }
}

function walk(root) {
  if (!existsSync(root)) {
    return [];
  }
  const entries = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      entries.push(...walk(path));
    } else if (stats.isFile()) {
      entries.push(path);
    }
  }
  return entries;
}

function itemName(item) {
  const raw =
    item?.name ?? item?.path ?? item?.actual ?? item?.expected ?? item?.diff;
  const file = basename(String(raw ?? ""), ".png");
  return file.replace(/^showcase-/, "");
}

function pathFromReg(value) {
  if (!value) {
    return null;
  }
  return resolve(String(value));
}

function findOverlay(overlayDir, name) {
  const direct = join(overlayDir, `showcase-${name}.png`);
  if (existsSync(direct)) {
    return direct;
  }
  return (
    walk(overlayDir).find(
      (file) => basename(file) === `showcase-${name}.png`,
    ) ?? null
  );
}

function parsePng(data) {
  if (
    data.byteLength < 33 ||
    !data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new Error("Only PNG screenshots can be uploaded");
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function git(args, cwd) {
  return run(["git", ...args], cwd).stdout;
}

function run(command, cwd, options = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && !options.optional) {
    throw new Error(
      `${command.join(" ")} failed in ${cwd}\n${result.stderr || result.stdout}`,
    );
  }
  return result;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg
      .slice(2)
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "manifestOnly" || key === "help") {
      parsed[key] = true;
    } else {
      parsed[key] = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function usage() {
  process.stdout.write(`Usage: visual-diff-to-blocks.mjs [options]

Options:
  --base <ref>                 Base ref for merge-base resolution (default: origin/master)
  --head <ref>                 Head ref for merge-base resolution (default: HEAD)
  --showcase-command <cmd>     Command that captures showcase-*.png files
  --server-url <url>           Sieve URL (default: http://localhost:3000)
  --cache-dir <dir>            Baseline cache root
  --max-blocks <n>             Maximum image-diff blocks (default: 10)
  --manifest-only              Do not upload; use sha256 pseudo attachment ids

Test/fixture options:
  --merge-base <sha> --actual-dir <dir> --baseline-dir <dir> --reg-json <file> --overlay-dir <dir>
`);
}
