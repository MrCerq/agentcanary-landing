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
| C6 | **OG card reframe** | deferred (design rule) | gen-og-homepage.mjs + gen-asset-og.mjs chips still say "PREDICTIONS SCORED / PUBLIC HIT RATE / graded in the open." Fixed-width SVG boxes (font-44 values) — text changes risk overflow. Needs visual sign-off on rendered PNG. Do NOT auto-rewrite. |
| C7 | **MCP republish — new positioning** | pending | /tmp/agentcanary-mcp: server.json:5 desc, README:3 (+ stale "18 tools"→19), index.js:494 get_track_record desc still say "decision-grade…scored signals." Version bump + npm + registry republish. |
| C8 | **LAUNCH-POSTS.md reframe** | pending (before Tue HN) | HN/Reddit drafts still built on "public hit/miss receipts / 603 predictions / SPY 9%" — old pitch, STALE numbers, leads with the weak hit rates the reframe removes. Tue 06-09 reminder points here. Reframe to market-context-layer before launch. |
| C9 | **Off-repo positioning** | operator | Custom GPT description/instructions, ClawHub SKILL doc, Smithery — all still say "decision-grade predictions." Operator-edited surfaces. |


| # | Task | Status | Notes |
|---|---|---|---|
| C1 | **CDP-based X reposter for briefs** | 🚫 suspended | Operator decision 2026-05-23: "need a more trusted doing it." Lane handed off. Do not resume. |
| C3 | **Legacy yahoo-quotes filename + Mongo type removal** | ⏸ deferred | Producer still dual-writes (market-quotes.json canonical + yahoo-quotes.json transition alias). After consumer verification window (~1 week), remove dual-write from yahoo-snapshot.js + drop yahoo-quotes from registries. |
| C4 | **Test files referencing yahoo-quotes.json** | ⏸ deferred | tests/sector.test.js, forward-scenarios.test.js, key-prices.test.js, overnight-movers.test.js, movers.test.js have old filename in fixtures. Update when running test suite next. |

| C5 | **ac-compute file ownership cleanup** | ⏳ pending | 105 files owned by `501:staff` (macOS uid/gid from original rsync). Mixed with 92 root:root. Not blocking but grimy. `chown -R root:root /root/ac-compute` after backup. Concentrated in `_legacy/`, `landing/`, root docs. Do in dedicated session — don't mix with code commits. |

## P3 — blocked / deferred / skipped

| # | Task | Status | Reason |
|---|---|---|---|
| 10 | Case-study outreach | ❌ blocked | Need first 3 happy paying users to write up. (4 paying customers exist as of 2026-05-23 telemetry pull — case study UNBLOCKED in principle, but need to identify who's willing to be quoted.) |
| 11 | Reseller / attribution spec implementation | ⏸ deferred | Revisit at 20-50 actively-using paid keys |
| 12 | 36 per-indicator pages | ⏸ deferred | Revisit when GSC shows indicator-name query traffic |
| 13 | OpenAI plugin store submission | ⏸ skipped | Plugin store sunset 2024-04. Replaced by Custom GPT (✅ shipped 2026-05-21). |
| 14 | Cursor MCP marketplace | ⏸ skipped | cursor.directory is paid + third-party. Cursor proper has no public submission. Audience too small for ROI. |
| 15 | AI search visibility re-check (Perplexity/Claude/ChatGPT) | ⏸ skipped | Tested 2026-05-24 → 0/6 across engines. AI search engines surface what's cited elsewhere; AC has ~0 inbound links. Stop testing until distribution lands inbound mentions. Not a content/SEO problem at this scale — re-test naturally once HN/Reddit threads exist. |
| 16 | GSC Request Indexing | ⏸ skipped | Single submission is enough — re-requesting doesn't accelerate Google's crawl queue. If pages don't index after one request, the issue is inbound-link authority (upstream), not request count. Don't re-add. |

## ✅ Done recently

### 2026-06-02
- macro-atom-null incident FIXED. Root cause: 5/29 private-channel disable was overscoped — regime-change-alert.js also writes regime-state.json (consumed by macro atom). Cron disable starved the file → macro null → every brief in deterministic fallback ~3 days while /api/health stayed GREEN.
  - `fb7ba3a` regime cron re-enabled with --no-telegram (data refreshes, Telegram silent)
  - `2f025f1` fixed my own ReferenceError (patch added schedule ref but not the function def; caught on operator "are you sure")
  - `0abedc2` composite-risk-score walks paths for valid score+label (g2 producer emitting {score:null})
- Two permanent guardrails added to reference_known_expected_behaviors.md: (1) check validator_status every sweep; (2) check what a cron writes before disabling it
- C5 logged: ac-compute file ownership cleanup (105 files 501:staff) — dedicated session

### 2026-05-30
- Whale atoms cadence aligned with producer reality (whale-alerts + stablecoin-whale-alerts intraday→daily, `4bc4994`) — was false-RED every morning before 04:00 UTC producer write
- Forward-scenarios cadence intraday→daily (`e10b29a`) — last config-vs-producer mismatch in atom-cadence.js; zero `intraday` atoms remain
- 5 private-channel Telegram senders disabled (`8647f8e` + crontab edit) — regime/narrative/earnings/health-check.js wrapper/health-monitor.sh. Public @agentcanary brief channel kept. Reversible (single-line uncomments).
- `reference_known_expected_behaviors.md` added to memory — anti-ghost-chase catalog (weekend cadence, dedup filenames, inactive atom patterns, hysteresis windows, etc.) so future sessions stop investigating known-expected behavior
- g2-schema-check overnight caught + my morning fix shipped (market-quotes envelope shape change, `518cb9a` previous day)
- Memo drafted for g2/g2-core re: cadence-mismatch audit pattern (in chat, operator can forward)

### 2026-05-25
- Predictions extractor regex fix: SCENARIO header format changed around 2026-05-17 (added `(NN%)` between letter and dash) — extractor regex `/^([A-Z])\s*[—–-]/` silently rejected it. Backfilled 9 days of missed predictions. `/api/track-record` now shows 657 scored (was 603), mean Brier 0.156 (was 0.162), 37.5% better than baseline (was 35.2%).
- OI atom cadence aligned with producer reality (intraday→daily, MAX_AGE 12→30) — fixes recurring morning health-RED
- gzip compression middleware on backend — /api/data/canonical-facts-l1-assets 4.6MB → 230KB (95% reduction). Bandwidth ceiling per Signal-tier customer dropped 96GB→4.5GB/day max.
- Custom GPT verified working clean (operator confirmation)
- Monday weekend-aware verification: full Sat+Sun cycle ran 100% as designed
- Investigation closures (not-bugs after max-depth):
  - UsageLog telemetry: working correctly; yesterday's "0 in 7d" was real customer slowdown (institutional whale dropped 344/day → 2/day on 5/21), captured perfectly
  - operatorStatus hysteresis: working as designed (RECOVER_TO_GREEN_CYCLES=2 = 60min transition window; observed before 2 cycles completed)
  - Custom-logic atoms (btc-price, forward-scenarios, icsa, key-prices, movers, sector, vs-morning, whale, news) skipped latest-pointer fallback fix because they use multi-day walk-back helpers (loadMostRecentSnapshot, loadMostRecentYahoo, etc.) — different design, not broken
- Custom GPT verified working clean (operator confirmed all 4 conversation starters return live data, no "I can't" prefaces)
- OI atom cadence aligned with producer reality (intraday → daily, MAX_AGE 12→30) — fixes recurring morning health-RED
- Monday weekend-aware verification: full Sat+Sun cycle ran 100% as designed (signal+wrap SEND with banner, radar+pulse SKIP; weekday Mon radar back to normal publish)

### 2026-05-24
- 17 intelligence-substrate datasets exposed via /api/data/* (canonical facts l1-l5 + bundle, evidence atoms l1-l5 + bundle, AC compiled atoms radar/signal/pulse/wrap, macro-regime). briefing-input-packet HELD from public per portfolio-leak risk.
- 11 atoms latest-pointer fallback (systemic fix for date-dir-only stale bug)
- deterministicOnly slot-aware header (wrap/radar/pulse no longer mislabelled as SIGNAL SCAN on validator fallback)
- JSON Feed + RSS regenerated by build (was silently frozen 6 days)
- Weekend banner emoji removed per operator feedback

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
