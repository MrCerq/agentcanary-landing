#!/bin/bash
# AgentCanary — Daily Record Rebuild
# Rebuilds The Record static pages and pushes to GitHub Pages if changed.
# Designed for cron/LaunchAgent execution.

set -euo pipefail

# Configurable repo path
LANDING_REPO="${LANDING_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"

# Ensure node/git are in PATH (for LaunchAgent)
export PATH="/Users/g2/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"; }

cd "$LANDING_REPO"
log "Starting Record rebuild in $LANDING_REPO"

# Pull latest
git pull --ff-only origin main 2>/dev/null || log "Warning: git pull failed, building from current state"

# Build
log "Running build-record.js..."
if ! node tools/build-record.js; then
  log "ERROR: build-record.js failed"
  exit 1
fi

# Check for changes
if git diff --quiet && git diff --cached --quiet; then
  log "No changes detected — skipping push"
  exit 0
fi

# Commit and push
DATE=$(date -u '+%Y-%m-%d')
git add -A
git commit -m "chore: daily record rebuild ${DATE}"
git push origin main

log "Pushed rebuild for ${DATE}"
