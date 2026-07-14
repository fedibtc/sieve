#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const host = process.env.SIEVE_TEST_SERVER ?? "http://localhost:7919";
const credentialAppPath = process.env.CREDENTIAL_APP_PATH;

main();

function main() {
  checkServer();
  run("nix", [
    "develop",
    "--command",
    "cargo",
    "test",
    "--manifest-path",
    "cli/Cargo.toml",
  ]);
  run("nix", [
    "develop",
    "--command",
    "cargo",
    "clippy",
    "--manifest-path",
    "cli/Cargo.toml",
    "--",
    "-D",
    "warnings",
  ]);
  run("pnpm", ["check"]);
  run("nix", ["build", ".#sieve"]);
  run("nix", ["run", ".#sieve", "--", "--host", host, "status"]);
  run(
    "nix",
    [
      "develop",
      "--command",
      "cargo",
      "test",
      "--manifest-path",
      "cli/Cargo.toml",
      "--test",
      "agent_loop",
      "--",
      "--nocapture",
    ],
    {
      SIEVE_TEST_SERVER: host,
    },
  );

  if (credentialAppPath) {
    publishCredentialAppSmoke();
  } else {
    console.log(
      "Skipping credential-app smoke recap: set CREDENTIAL_APP_PATH to enable it.",
    );
  }
}

function checkServer() {
  const result = spawnSync("curl", ["-fsS", `${host}/api/agent/v1/whoami`], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`Sieve server is not reachable at ${host}`);
  }
}

function publishCredentialAppSmoke() {
  const temp = mkdtempSync(join(tmpdir(), "credential-app-cli-plan."));
  const branch = `codex/sieve-cli-plan-${Date.now()}`;
  try {
    run("git", [
      "-C",
      credentialAppPath,
      "worktree",
      "add",
      "-b",
      branch,
      temp,
      "master",
    ]);
    writeFileSync(
      join(temp, "README.md"),
      `${readFileSync(join(temp, "README.md"), "utf8")}\n## Sieve CLI smoke test\n\nThis temporary branch verifies sieve scaffold and publish from a credential-app worktree.\n`,
    );
    run("git", ["-C", temp, "add", "README.md"]);
    run("git", [
      "-C",
      temp,
      "-c",
      "user.email=test@localhost",
      "-c",
      "user.name=Sieve Test",
      "commit",
      "-m",
      "test: sieve cli smoke recap",
    ]);

    const flake = `${root}#sieve`;
    const manifest = join(temp, "recap.json");
    run(
      "nix",
      [
        "run",
        flake,
        "--",
        "--host",
        host,
        "scaffold",
        "--base",
        "master",
        "--head",
        "HEAD",
        "-o",
        manifest,
      ],
      undefined,
      temp,
    );
    const recap = JSON.parse(readFileSync(manifest, "utf8"));
    recap.title = "credential-app CLI smoke recap";
    recap.idempotencyKey = `${recap.idempotencyKey}#${Date.now()}`;
    recap.content.blocks[0].data.markdown =
      "## Outcome\nPublished from a temporary credential-app worktree to verify the sieve CLI scaffold/publish flow.\n\nValidation: scripts/validate-cli-plan.mjs.";
    writeFileSync(manifest, `${JSON.stringify(recap, null, 2)}\n`);

    const publish = runJson(
      "nix",
      ["run", flake, "--", "--host", host, "publish", "--manifest", manifest],
      temp,
    );
    const reviewId = publish.review?.id;
    if (!reviewId) {
      throw new Error("publish response did not include review.id");
    }
    run("curl", [
      "-fsSL",
      `${host}/reviews/${reviewId}`,
      "-o",
      join(temp, "review.html"),
    ]);
    console.log(
      `Credential-app smoke recap rendered: ${host}/reviews/${reviewId}`,
    );
  } finally {
    run(
      "git",
      ["-C", credentialAppPath, "worktree", "remove", temp, "--force"],
      {},
      root,
      false,
    );
    run(
      "git",
      ["-C", credentialAppPath, "branch", "-D", branch],
      {},
      root,
      false,
    );
    rmSync(temp, { recursive: true, force: true });
  }
}

function run(command, args, extraEnv, cwd = root, required = true) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (required && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}

function runJson(command, args, cwd = root) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const output = execFileSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
  });
  process.stdout.write(output);
  return JSON.parse(output);
}
