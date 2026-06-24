#!/bin/bash
# AgentCanary — Daily Record Rebuild
# Rebuilds The Record static pages and pushes to GitHub Pages if changed.
# Designed for cron/LaunchAgent execution.

set -euo pipefail

# Configurable repo path
LANDING_REPO="${LANDING_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"

# Ensure node/git are in PATH for cron/LaunchAgent without baking in a host path.
export PATH="${NODE_BIN_DIR:-/root/.nvm/versions/node/v22.18.0/bin}:/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"; }

cd "$LANDING_REPO"
log "Starting Record rebuild in $LANDING_REPO"

# Never hide or discard operator edits. This job can only commit generated
# Record output from a clean tree.
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  log "ERROR: working tree dirty before rebuild; refusing to continue"
  git status --short
  exit 1
fi

# Pull latest
git pull --ff-only origin main 2>/dev/null || log "Warning: git pull failed, building from current state"

# Build
log "Running build-record-v1.mjs..."
if ! node tools/build-record-v1.mjs; then
  log "ERROR: build-record-v1.mjs failed"
  exit 1
fi

# Check for changes
if git diff --quiet && git diff --cached --quiet; then
  log "No changes detected — skipping push"
  exit 0
fi

# Commit and push
DATE=$(date -u '+%Y-%m-%d')
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
  log "ERROR: unexpected unstaged/untracked changes after rebuild; refusing to sweep them into the auto-commit"
  git status --short
  exit 1
fi

git commit -m "chore: daily record rebuild ${DATE}"
git push origin main

log "Pushed rebuild for ${DATE}"
