import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL("../scripts/publish-change.sh", import.meta.url));

function sh(cmd, cwd, env = {}) {
  return execFileSync("bash", ["-lc", cmd], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8"
  }).trim();
}

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

test("publish script creates branch, commit, push, and PR from detached HEAD", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "publish-change-"));
  const remoteDir = path.join(tempRoot, "remote.git");
  const repoDir = path.join(tempRoot, "repo");
  const binDir = path.join(tempRoot, "bin");
  fs.mkdirSync(binDir);

  sh(`git init --bare "${remoteDir}"`, tempRoot);
  sh(`git init "${repoDir}"`, tempRoot);
  sh(`git -C "${repoDir}" config user.name "Codex Test"`, tempRoot);
  sh(`git -C "${repoDir}" config user.email "codex@example.com"`, tempRoot);
  fs.writeFileSync(path.join(repoDir, "demo.txt"), "base\n");
  sh('git add demo.txt && git commit -m "Initial commit"', repoDir);
  sh('git branch -M main', repoDir);
  sh(`git remote add origin "${remoteDir}"`, repoDir);
  sh('git push -u origin main', repoDir);
  sh('git checkout --detach', repoDir);

  const ghLog = path.join(tempRoot, "gh.log");
  const ghStub = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${ghLog}"
if [[ "$1" == "--version" ]]; then
  echo "gh version test"
  exit 0
fi
if [[ "$1" == "auth" && "\${2:-}" == "status" ]]; then
  exit 0
fi
if [[ "$1" == "repo" && "\${2:-}" == "view" ]]; then
  echo "main"
  exit 0
fi
if [[ "$1" == "pr" && "\${2:-}" == "list" ]]; then
  echo ""
  exit 0
fi
if [[ "$1" == "pr" && "\${2:-}" == "create" ]]; then
  echo "https://example.test/pr/1"
  exit 0
fi
if [[ "$1" == "pr" && "\${2:-}" == "edit" ]]; then
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 1
`;
  writeExecutable(path.join(binDir, "gh"), ghStub);

  fs.writeFileSync(path.join(repoDir, "demo.txt"), "updated\n");

  execFileSync(String(SCRIPT_PATH), [
    "--slug", "demo-publish",
    "--title", "Automate publish flow",
    "--check", "test -f demo.txt",
    "--",
    "demo.txt"
  ], {
    cwd: repoDir,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
    encoding: "utf8"
  });

  assert.equal(sh("git branch --show-current", repoDir), "codex/demo-publish");
  assert.match(sh("git log -1 --pretty=%s", repoDir), /Automate publish flow/);
  assert.match(sh(`git --git-dir "${remoteDir}" branch --list`, repoDir), /codex\/demo-publish/);

  const ghCalls = fs.readFileSync(ghLog, "utf8");
  assert.match(ghCalls, /auth status/);
  assert.match(ghCalls, /repo view --json defaultBranchRef -q \.defaultBranchRef.name/);
  assert.match(ghCalls, /pr list --head codex\/demo-publish --json url --jq \.\[0\]\.url/);
  assert.match(ghCalls, /pr create --base main --head codex\/demo-publish --title \[codex\] Automate publish flow/);
});

test("publish script passes shell syntax validation", () => {
  execFileSync("bash", ["-n", String(SCRIPT_PATH)], {
    cwd: REPO_ROOT,
    stdio: "pipe"
  });
});
