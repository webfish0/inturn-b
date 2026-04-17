#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/publish-change.sh --slug <slug> --title <title> [options] -- <files...>

Options:
  --slug <slug>         Branch slug used for codex/<slug>
  --title <title>       Commit title and PR summary
  --base <branch>       Base branch for the PR (defaults to repo default branch)
  --body-file <path>    Markdown file to use as the PR body
  --check <command>     Validation command to run before staging/commit (repeatable)
  --draft               Open a draft PR (default)
  --ready               Open a ready-for-review PR
  -h, --help            Show this help

Files must be passed after -- so the script stages only the intended paths.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*"
}

require_clean_index() {
  if ! git diff --cached --quiet --ignore-submodules --; then
    die "The git index already has staged changes. Unstage them first so the publish scope stays explicit."
  fi
}

ensure_dependencies() {
  command -v git >/dev/null 2>&1 || die "git is required."
  command -v gh >/dev/null 2>&1 || die "gh is required."
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated."
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "This script must run inside a git repository."
  git remote get-url origin >/dev/null 2>&1 || die "Remote 'origin' is required."
}

default_branch_name() {
  local detected=""
  detected="$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null || true)"
  if [[ -n "$detected" && "$detected" != "null" ]]; then
    printf '%s\n' "$detected"
    return
  fi
  printf 'main\n'
}

ensure_branch() {
  local slug="$1"
  local default_branch="$2"
  local current_branch=""
  current_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

  if [[ -n "$current_branch" && "$current_branch" != "$default_branch" && "$current_branch" != "main" && "$current_branch" != "master" ]]; then
    printf '%s\n' "$current_branch"
    return
  fi

  local target_branch="codex/$slug"
  if git show-ref --verify --quiet "refs/heads/$target_branch"; then
    git switch "$target_branch" >/dev/null
  else
    git switch -c "$target_branch" >/dev/null
  fi
  printf '%s\n' "$target_branch"
}

build_body_file() {
  local title="$1"
  shift
  local body_file
  local path
  local check_cmd
  body_file="$(mktemp)"
  {
    printf '## What changed\n'
    printf -- '- %s\n' "$title"
    printf '\n## Files\n'
    for path in "$@"; do
      printf -- '- `%s`\n' "$path"
    done
    printf '\n## Why\n'
    printf -- '- Automate publish steps for repeatable enhancement delivery.\n'
    printf '\n## Validation\n'
    if ((${#checks[@]})); then
      for check_cmd in "${checks[@]}"; do
        printf -- '- `%s`\n' "$check_cmd"
      done
    else
      printf -- '- No explicit checks were provided.\n'
    fi
  } >"$body_file"
  printf '%s\n' "$body_file"
}

slug=""
title=""
base=""
body_file=""
draft="true"
declare -a checks=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)
      [[ $# -ge 2 ]] || die "--slug requires a value."
      slug="$2"
      shift 2
      ;;
    --title)
      [[ $# -ge 2 ]] || die "--title requires a value."
      title="$2"
      shift 2
      ;;
    --base)
      [[ $# -ge 2 ]] || die "--base requires a value."
      base="$2"
      shift 2
      ;;
    --body-file)
      [[ $# -ge 2 ]] || die "--body-file requires a value."
      body_file="$2"
      shift 2
      ;;
    --check)
      [[ $# -ge 2 ]] || die "--check requires a value."
      checks+=("$2")
      shift 2
      ;;
    --draft)
      draft="true"
      shift
      ;;
    --ready)
      draft="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

declare -a files=("$@")

[[ -n "$slug" ]] || die "--slug is required."
[[ -n "$title" ]] || die "--title is required."
((${#files[@]})) || die "Provide one or more file paths after --."

ensure_dependencies
require_clean_index

default_branch="${base:-$(default_branch_name)}"
target_branch="$(ensure_branch "$slug" "$default_branch")"
info "Using branch: $target_branch"

if ((${#checks[@]})); then
  for check_cmd in "${checks[@]}"; do
    info "Running check: $check_cmd"
    bash -lc "$check_cmd"
  done
fi

git add -- "${files[@]}"

if git diff --cached --quiet --ignore-submodules --; then
  die "No staged changes detected for the provided files."
fi

git commit -m "$title"
git push -u origin "$target_branch"

existing_pr="$(gh pr list --head "$target_branch" --json url --jq '.[0].url' 2>/dev/null || true)"
if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
  info "PR already exists: $existing_pr"
  exit 0
fi

cleanup_body="false"
if [[ -z "$body_file" ]]; then
  body_file="$(build_body_file "$title" "${files[@]}")"
  cleanup_body="true"
fi

cleanup() {
  if [[ "$cleanup_body" == "true" && -n "${body_file:-}" && -f "$body_file" ]]; then
    rm -f "$body_file"
  fi
}
trap cleanup EXIT

declare -a pr_args=(
  pr create
  --base "$default_branch"
  --head "$target_branch"
  --title "[codex] $title"
  --body-file "$body_file"
)

if [[ "$draft" == "true" ]]; then
  pr_args+=(--draft)
fi

pr_url="$(gh "${pr_args[@]}")"
if [[ -n "$pr_url" ]]; then
  gh pr edit "$pr_url" --add-label codex --add-label codex-automation >/dev/null 2>&1 || true
fi

info "Commit created and pushed on $target_branch"
if [[ -n "$pr_url" ]]; then
  info "Draft PR: $pr_url"
fi
