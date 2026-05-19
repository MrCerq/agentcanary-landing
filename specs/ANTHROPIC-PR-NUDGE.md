# Anthropic Skills PR #1141 — status + nudge draft

**State as of 2026-05-19:**
- PR: github.com/anthropics/skills/pull/1141
- Title: "add agentcanary skill: cross-asset market intelligence"
- Opened: 2026-05-15 (4 days ago)
- Comments: 0
- Reviewer: unassigned (REVIEW_REQUIRED)
- Last activity: never updated since open

This is a queue problem, not a content problem. No maintainer has looked at it. Two ways to bump it: a polite ping, or a material update.

## Option A — Polite ping comment (easiest, post as you)

Paste this as a comment on the PR:

```
Quick check-in — wanted to flag that this PR may have slipped past the review queue.

Happy to make any changes if there's feedback from maintainers, or to refresh the skill content if it's stale. The agentcanary skill itself is live on ClawHub at v1.0.5 and the MCP server (referenced in the skill metadata) is now at v1.4.0 on npm with structured tier-aware errors and a new diagnose tool, in case that affects the review.

No rush — just wanted to make sure this hadn't fallen through the cracks. Thanks for the bandwidth.
```

## Option B — Material update (commits to PR branch, signals freshness)

Bumps PR back to top of maintainer queue automatically. Push to the PR branch:

1. Update SKILL.md to the v1.3.1 honest-scoping version (already in landing repo at releases/SKILL-1.3.1.md)
2. Add a note in the PR description mentioning the v1.4.0 MCP release with tier-aware errors

I can prepare the diff and push to your branch if you give me the branch name on your fork.

## Recommendation

Option A first. If no response within 7 days, Option B.

If still no response by week 2: ping in Anthropic's dev discord (https://discord.gg/anthropic — invite link if you don't have one). Reference the PR number directly.
