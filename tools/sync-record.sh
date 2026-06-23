#!/bin/bash
# Sync Record to GitHub Pages — runs on VPS after each brief cycle
# No rsync needed — data is local on VPS

set -euo pipefail

# Make node available under cron (nvm doesn't populate PATH for non-interactive shells)
export NVM_DIR="/root/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

REPO="/root/agentcanary-landing"
LOCKFILE="/tmp/record-build.lock"
LOG="/tmp/record-sync.log"

exec >> "$LOG" 2>&1
echo "=== $(date -u) ==="

# Lock
if [ -f "$LOCKFILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 600 ]; then
    echo "⚠️ Build running (lock age: ${LOCK_AGE}s). Skipping."
    exit 0
  fi
  echo "⚠️ Stale lock (${LOCK_AGE}s). Removing."
  rm -f "$LOCKFILE"
fi
trap 'rm -f "$LOCKFILE"' EXIT
touch "$LOCKFILE"

cd "$REPO"

# Never hide or discard operator edits. This job is allowed to create and
# commit generated Record output only from a clean tree.
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "❌ Working tree dirty before record sync; refusing to stash/drop changes."
  git status --short
  exit 1
fi

# Pull latest (in case of manual pushes from Mac)
git pull --rebase 2>&1 || git pull 2>&1 || { echo "❌ Git pull failed"; exit 1; }

# Copy fresh data from landing-data (where AC scheduler writes)
cp /root/agentcanary-landing-data/briefs-archive.json data/briefs-archive.json 2>/dev/null || true
cp /root/agentcanary-landing-data/briefs-feed.json data/briefs-feed.json 2>/dev/null || true
cp /root/agentcanary-landing-data/latest-brief.json data/latest-brief.json 2>/dev/null || true

# Build
echo "📄 Building Record..."
node tools/build-record-v1.mjs 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "❌ Build failed (exit $BUILD_EXIT)"
  exit 1
fi

# Commit + push
if git diff --quiet && git diff --cached --quiet; then
  echo "✅ No changes"
  exit 0
fi

git add \
  data/briefs-archive.json \
  data/briefs-feed.json \
  data/latest-brief.json \
  record \
  assets \
  regimes \
  sitemap.xml \
  index.html 2>/dev/null || true

if ! git diff --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "❌ Unexpected unstaged/untracked changes after record build; refusing to sweep them into the auto-commit."
  git status --short
  exit 1
fi

git commit -m "Auto-rebuild Record + briefs: $(date -u +%Y-%m-%d\ %H:%M)" 2>&1
git push 2>&1 || { echo "❌ Push failed"; exit 1; }

echo "✅ Pushed to GitHub Pages"
