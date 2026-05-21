# Operator queue — AgentCanary

Living queue of tasks that require operator (not Claude) action. Updated alongside chat sessions; this is the canonical pointer when context resets.

**Status legend:** ⏳ pending · ▶ in flight · ✅ done · ❌ blocked · ⏸ deferred

---

## P0 — time-sensitive, highest leverage

| # | Task | Owner | Notes / files |
|---|---|---|---|
| 1 | **HN Show HN launch** ⏳ | operator | Draft: `specs/LAUNCH-POSTS.md` §1. Best window: Tue/Wed 8-10am PT. Post + stay in thread for 24h. Single biggest distribution lever. |

## P1 — quick, high-leverage

| # | Task | Owner | Notes |
|---|---|---|---|
| 2 | **AI search visibility re-check** ⏳ | operator | 3 manual queries (Perplexity / Claude / ChatGPT). 10 min. Was 0/2 last week — re-run to validate SEO work. |
| 3 | **GSC Request Indexing on 6 priority URLs** ⏳ | operator | 3 min, 6 paste-and-clicks. URLs in earlier message. Refreshes snippets in 3-5 days vs 1-3 weeks organic. |
| 4 | **Test the updated Custom GPT works clean** ⏳ | operator | Open `chatgpt.com/g/g-6a0f2b6ab07c819188983b3fb43ac62b-agentcanary`, click each conversation starter, confirm real data (no "I can't" prefaces). 2 min. |

## P2 — sequential cadence

| # | Task | Owner | Notes |
|---|---|---|---|
| 5 | **Reddit r/LocalLLaMA post** ⏳ | operator | Draft: `LAUNCH-POSTS.md` §2. Lead with Brier reliability table. |
| 6 | **LinkedIn post #1 — Brier story** ⏳ | operator | Draft: §4. Tue 9am ET. |
| 7 | **Reddit r/algotrading post** ⏳ | operator | Draft: §3. Post 1 week after r/LocalLLaMA. |
| 8 | **LinkedIn post #2 — wallet billing** ⏳ | operator | Draft: §5. 1 week after post #1. |
| 9 | **ProductHunt launch** ⏳ | operator | Concept drafted. Stack with HN same day for compound coverage. |

## P3 — blocked / deferred

| # | Task | Status | Reason |
|---|---|---|---|
| 10 | Case-study outreach | ❌ blocked | Need first 3 happy paying users to write up |
| 11 | Reseller / attribution spec implementation | ⏸ deferred | Revisit at 20-50 actively-using paid keys |
| 12 | 36 per-indicator pages | ⏸ deferred | Revisit when GSC shows indicator-name query traffic |
| 13 | OpenAI plugin store submission | ⏸ skipped | Plugin store sunset 2024-04. Replaced by Custom GPT (✅ shipped 2026-05-21). |
| 14 | Cursor MCP marketplace | ⏸ skipped | cursor.directory is paid + third-party. Cursor proper has no public submission. Audience too small for ROI. |

## ✅ Done recently

- **2026-05-21:** Custom GPT shipped + wired in 3 surfaces
- **2026-05-21:** Anthropic Skills PR #1141 nudge posted
- **2026-05-21:** GitHub repo social preview image uploaded
- **2026-05-21:** ClawHub SKILL-1.3.1.md re-uploaded
- **2026-05-21:** NPM_TOKEN secret deleted (Trusted Publishing replaced it)
- **2026-05-21:** Backend `/api/openapi.yaml` `/api/signals/*` description fix
- **2026-05-21:** Backend `enforceTier` path-resolution fix (`/api/indicators` now correctly Explorer-tier)
- **2026-05-21:** Full SEO audit + 6-step fix batch + JSON-LD validator
- **2026-05-21:** Bulletproofing trio: safeBuild wrapper + catch-up logic + atom-error visibility
- **2026-05-21:** Brief editorial redesign (331 pages)
- **2026-05-21:** Per-asset OG cards (75 tickers)
- **2026-05-21:** /sources/ + brief permalinks pass Rich Results Test

## Reference

- Draft posts: `specs/LAUNCH-POSTS.md`
- Custom GPT setup recipe: `specs/CUSTOM-GPT-SETUP.md`
- GSC verification guide: `specs/GSC-VERIFICATION.md`
- Anthropic PR nudge draft: `specs/ANTHROPIC-PR-NUDGE.md`
- Most recent SEO audit: `specs/SEO-AUDIT-2026-05-20.md`
- Repo HEAD: keep tracker updated. Current backends:
  - `agentcanary-backend` HEAD: `1e47b54`
  - `agentcanary-landing` HEAD: see `4d69d85c` auto-rebuild
  - `ac-compute` HEAD: `bf4ff3f`
  - `agentcanary-mcp` HEAD: `08991cc` (published v1.4.1 on npm + MCP Registry)
