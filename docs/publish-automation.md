# Publish Automation

## Problem Analysis

The enhancement automation asked for branch, commit, push, and pull-request creation, but the implementation was not deterministic:

- Codex worktrees often start on a detached `HEAD`, so naive `git commit` flows fail or create ambiguous state.
- Manual staging is error-prone when the worktree contains only part of the intended enhancement.
- Pull request creation depended on one-off terminal steps instead of a repo-local interface the automation could call every time.
- There was no repeatable test coverage around the publish workflow.

## Requirements

1. The repo must provide a non-interactive publish entry point that automation can call directly.
2. The publish flow must require an explicit file list so it never stages the entire worktree by accident.
3. The publish flow must handle detached `HEAD` by creating or switching to `codex/<slug>`.
4. The publish flow must verify `gh` authentication before attempting PR creation.
5. The publish flow must support running validation commands before stage/commit/push.
6. The publish flow must open draft PRs by default.
7. The recurring enhancement automation must instruct future runs to use the repo-local publish script instead of ad hoc git commands.

## Test Design

### Automated checks

- Shell syntax validation for the publish script.
- Integration test in a temporary git repo with a stubbed `gh` binary:
  - starts from detached `HEAD`
  - runs the publish script with explicit file paths
  - verifies branch creation, commit, push, and PR invocation

### Manual checks

- Run the publish script in the real repo with explicit file paths and confirm:
  - the branch name is `codex/<slug>`
  - only the requested files are committed
  - the PR is created as draft
  - the PR body contains the validation commands
