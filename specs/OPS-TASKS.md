# Operator queue — AgentCanary

Living queue of tasks that require operator (not Claude) action. Updated alongside chat sessions; this is the canonical pointer when context resets.

**Status legend:** ⏳ pending · ▶ in flight · ✅ done · ❌ blocked · ⏸ deferred · 🚫 suspended

---

## P0 — time-sensitive, highest leverage

| # | Task | Owner | Notes / files |
|---|---|---|---|
| 1 | **HN Show HN launch** ⏳ | operator | Draft: `specs/LAUNCH-POSTS.md` §1. Best window: Tue/Wed 8-10am PT. Post + stay in thread for 24h. Single biggest distribution lever. |
| 1b | **Monday-morning verification of weekend-aware briefs** ⏳ | operator | After Sunday's full cycle (radar 03:15 / signal 09:15 / pulse 15:15 / wrap 21:15 UTC), verify Telegram channel + @agentcanary X show: signal+wrap with banner, no radar+pulse externally. 5 min check. If wrong → roll back: `git revert 6c2a826 88b0ac7` in ac-compute + `git revert 3da8971` in backend + `pm2 restart ac-scheduler server`. |

## P1 — quick, high-leverage

| # | Task | Owner | Notes |
|---|---|---|---|
| 2 | **AI search visibility re-check** ⏳ | operator | 3 manual queries (Perplexity / Claude / ChatGPT). 10 min. Was 0/2 last week — re-run to validate SEO work. |
| 3 | **GSC Request Indexing on 6 priority URLs** ⏳ | operator | 3 min, 6 paste-and-clicks. URLs in earlier message. Refreshes snippets in 3-5 days vs 1-3 weeks organic. |
| 4 | **Test the updated Custom GPT works clean** ⏳ | operator | Open `chatgpt.com/g/g-6a0f2b6ab07c819188983b3fb43ac62b-agentcanary`, click each conversation starter, confirm real data. 2 min. |

## P2 — sequential cadence

| # | Task | Owner | Notes |
|---|---|---|---|
| 5 | **Reddit r/LocalLLaMA post** ⏳ | operator | Draft: `LAUNCH-POSTS.md` §2. Lead with Brier reliability table. |
| 6 | **LinkedIn post #1 — Brier story** ⏳ | operator | Draft: §4. Tue 9am ET. |
| 7 | **Reddit r/algotrading post** ⏳ | operator | Draft: §3. Post 1 week after r/LocalLLaMA. |
| 8 | **LinkedIn post #2 — wallet billing** ⏳ | operator | Draft: §5. 1 week after post #1. |
| 9 | **ProductHunt launch** ⏳ | operator | Concept drafted. Stack with HN same day for compound coverage. |

## Claude build queue

| # | Task | Status | Notes |
|---|---|---|---|
| C1 | **CDP-based X reposter for briefs** | 🚫 suspended | Operator decision 2026-05-23: "need a more trusted doing it." Lane handed off. Do not resume. |
| C2 | **UsageLog telemetry bug** | ⏳ pending | Some endpoint paths (e.g. `/api/data/realtime-prices`, `/api/macro/regime` hit by institutional whale 0x69cd) don't appear in UsageLog despite nginx showing ~100 calls/day. Affects every customer-usage conclusion. Likely middleware ordering issue. Small fix once located. |
| C3 | **Legacy yahoo-quotes filename + Mongo type removal** | ⏸ deferred | Producer still dual-writes (market-quotes.json canonical + yahoo-quotes.json transition alias). After consumer verification window (~1 week), remove dual-write from yahoo-snapshot.js + drop yahoo-quotes from registries. |
| C4 | **Test files referencing yahoo-quotes.json** | ⏸ deferred | tests/sector.test.js, forward-scenarios.test.js, key-prices.test.js, overnight-movers.test.js, movers.test.js have old filename in fixtures. Update when running test suite next. |

## P3 — blocked / deferred / skipped

| # | Task | Status | Reason |
|---|---|---|---|
| 10 | Case-study outreach | ❌ blocked | Need first 3 happy paying users to write up. (4 paying customers exist as of 2026-05-23 telemetry pull — case study UNBLOCKED in principle, but need to identify who's willing to be quoted.) |
| 11 | Reseller / attribution spec implementation | ⏸ deferred | Revisit at 20-50 actively-using paid keys |
| 12 | 36 per-indicator pages | ⏸ deferred | Revisit when GSC shows indicator-name query traffic |
| 13 | OpenAI plugin store submission | ⏸ skipped | Plugin store sunset 2024-04. Replaced by Custom GPT (✅ shipped 2026-05-21). |
| 14 | Cursor MCP marketplace | ⏸ skipped | cursor.directory is paid + third-party. Cursor proper has no public submission. Audience too small for ROI. |

## ✅ Done recently

### 2026-05-23
- yahoo-quotes → market-quotes rename across 40 files / 3 repos (file + key + Mongo type + API route, legacy aliases preserved for transition)
- Backend `/api/signals/{vix,dxy,oil}` shape bug + oil-symbol mismatch — was silently FRED-fallback for months, now returns real data
- New top-level route `/api/market-quotes` (legacy `/api/yahoo-quotes` aliased)
- Weekend-aware briefs (publish-gate, not new slot names): radar+pulse on Sat/Sun skip Telegram + X; signal+wrap publish with banner above editorial H1 + at top of telegramText + in API response + in feeds; banner-aware CSS in landing
- Backend formatBrief exposes isWeekend/weekendBanner/tradFiAsOf
- feed.js archiveEntry now carries weekend fields
- JSON Feed 1.1 + RSS 2.0 regenerated on every landing build (was silently frozen at 2026-05-17 for 6 days — `build-record-v1.mjs` header comment claimed to generate them but actual writeFileSync was missing)
- Production verified: agentcanary.ai pulse permalink HAS banner; feed.json fresh with today's items

### 2026-05-21
- Custom GPT shipped + wired in 3 surfaces
- Anthropic Skills PR #1141 nudge posted
- GitHub repo social preview image uploaded
- ClawHub SKILL-1.3.1.md re-uploaded
- NPM_TOKEN secret deleted (Trusted Publishing replaced it)
- Backend `/api/openapi.yaml` `/api/signals/*` description fix
- Backend `enforceTier` path-resolution fix (`/api/indicators` now correctly Explorer-tier)
- Full SEO audit + 6-step fix batch + JSON-LD validator
- Bulletproofing trio: safeBuild wrapper + catch-up logic + atom-error visibility
- Brief editorial redesign (331 pages)
- Per-asset OG cards (75 tickers)
- /sources/ + brief permalinks pass Rich Results Test

## Tonight's pending validations (NOT yet observed)

| Fire | When | Expected behavior |
|---|---|---|
| Wrap | Sat 21:15 UTC | Telegram with banner-prefixed text + X tweet with banner-aware Sonnet output. No `[weekend-gate]` log. |
| Radar | Sun 03:15 UTC | Mongo + landing archive update. NO Telegram. NO X. Logs: `Telegram → SKIPPED (radar on weekend; landing+Mongo proceed)` + `[weekend-gate] X chain skipped for radar`. |
| Signal | Sun 09:15 UTC | Same as wrap above (normal publish with banner). |
| Pulse | Sun 15:15 UTC | Same as Sun radar (weekend-quiet). |
| Wrap | Sun 21:15 UTC | Same as Sat wrap. |

Manual verification path Monday morning: check Telegram channel + @agentcanary X timeline + curl `/api/briefs/radar` (Sat/Sun should both have weekend banner) + `pm2 logs ac-scheduler` grep for `[weekend-gate]` (should appear on Sun radar+pulse only).

## Reference

- Draft posts: `specs/LAUNCH-POSTS.md`
- Custom GPT setup recipe: `specs/CUSTOM-GPT-SETUP.md`
- GSC verification guide: `specs/GSC-VERIFICATION.md`
- Anthropic PR nudge draft: `specs/ANTHROPIC-PR-NUDGE.md`
- Most recent SEO audit: `specs/SEO-AUDIT-2026-05-20.md`
- Repo HEAD trackers (canonical at session close 2026-05-23):
  - `agentcanary-backend` HEAD: `3da8971`
  - `agentcanary-landing` HEAD: `c29c5f7f` (auto-rebuild after `688c9223` feed restoration)
  - `ac-compute` HEAD: `129ac61` (last operator commit; weekend work landed at `6c2a826`)
  - `agentcanary-mcp` HEAD: `08991cc` (v1.4.1 on npm + MCP Registry; unchanged today)
