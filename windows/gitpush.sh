# gitpush: Pushes ONLY the current git repo, safely ignoring siblings.
# Uses `git rev-parse` to scope all commands to the active repo root.
#
# Windows (Git Bash) Setup:
# mv ~/gitpush.sh ~/.local/bin/gitpush
# echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
# source ~/.bashrc
# (Alternative: alias gitpush="bash ~/gitpush.sh")
#
# Usage:
# cd path/to/project
# gitpush "commit message" <branch-name>
#
# Validates repo, stages, commits, and pushes (creates remote branch if needed).

set -euo pipefail

COMMIT_MSG="${1:-}"
BRANCH="${2:-}"

# --- validate inputs ---
if [[ -z "$COMMIT_MSG" || -z "$BRANCH" ]]; then
  echo "Usage: gitpush \"commit message\" branch-name"
  exit 1
fi

# --- confirm we're inside a git repo ---
# git rev-parse --show-toplevel prints the root of the CURRENT repo only
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Error: not inside a git repo ($(pwd))"
  exit 1
}

echo "Repo : $REPO_ROOT"
echo "Branch: $BRANCH"
echo "Commit: $COMMIT_MSG"
echo ""

# --- stage only files under this repo root ---
# 'git add .' adds files relative to CWD within this repo, nothing outside
git -C "$REPO_ROOT" add .

# --- show what's being committed ---
git -C "$REPO_ROOT" status --short

# --- commit ---
git -C "$REPO_ROOT" commit -m "$COMMIT_MSG"

# --- push to the specified branch ---
# --set-upstream handles first push to a new remote branch
git -C "$REPO_ROOT" push --set-upstream origin "$BRANCH"

echo ""
echo "Done. Pushed '$BRANCH' in $REPO_ROOT"