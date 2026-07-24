#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) {
    continue;
  }
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const port = String(args.get("--port") ?? "");
const scratch = String(args.get("--scratch") ?? "");
if (!port || !scratch) {
  console.error("Usage: e2e-server.mjs --port <port> --scratch <dir> [--seed]");
  process.exit(1);
}

const scratchPath = resolve(process.cwd(), scratch);
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: `pglite:${scratchPath}`,
  BETTER_AUTH_SECRET: "e2e-localhost-secret-at-least-32-bytes",
  GITHUB_CLIENT_ID: "e2e-github-client-id",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.VERCEL;

rmSync(scratchPath, { recursive: true, force: true });
mkdirSync(scratchPath, { recursive: true });

await run("pnpm", ["exec", "tsx", "scripts/migrate.ts"], env);
if (args.has("--seed")) {
  await run("pnpm", ["exec", "tsx", "scripts/seed.ts"], env);
}

const server = spawn("pnpm", ["exec", "next", "start", "-p", port], {
  env,
  stdio: "inherit",
});

const stop = () => server.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code, signal) => {
  process.exit(signal ? 0 : (code ?? 1));
});

function run(command, commandArgs, commandEnv) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      env: commandEnv,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(`${command} ${commandArgs.join(" ")} exited with ${code}`),
      );
    });
    child.on("error", rejectRun);
  });
}
