# Launch posts — ready to ship when you have an hour

Each post drafted to the channel's norms. Pick when you have time.
Live numbers as of 2026-05-19 — refresh if shipping >1 week later.

---

## 1. Hacker News — Show HN

**URL field:** `https://agentcanary.ai`

**Title (under 80 chars, no trailing period — HN convention):**

```
Show HN: AgentCanary – MCP server for AI agents with public hit/miss receipts
```

**First comment (post immediately after, top of thread):**

```
Hi HN — operator here. AgentCanary is an MCP server + REST API that gives autonomous AI agents decision-grade market intelligence: macro regime, narrative momentum, scenario probabilities, and 36 proprietary indicators across crypto + macro.

The angle I want to test with this audience: every prediction we publish is publicly scored after a 72h evaluation window. 603 predictions scored so far. Mean Brier score 0.162 — 35% better than a random-guess baseline (0.25). Per-asset hit rates are public: SPY 9% / BTC 25% / OIL 36% / GLD 33% / VIX 27%. We don't retroactively hide misses.

Most market data APIs are calibrated for human dashboards. We built this for agents from day one:
- MCP-native (19 tools, npx agentcanary-mcp)
- Schema-stable JSON with freshness envelopes (every response carries observed_at, age_seconds, freshness_status)
- Wallet-billed in USDC on Base. No KYC. No subscription.
- Free Explorer tier: prices + regime + indicator list + brief preview (50 calls/day)

Stack: Node + Mongo backend on a single VPS, ~250 upstream sources, daily aggregated briefs at 03:15/09:15/15:15/21:15 UTC.

Track record: https://agentcanary.ai/record/
Source contracts (per-dataset freshness SLAs): https://agentcanary.ai/sources/
GitHub: https://github.com/MrCerq/agentcanary-mcp

Happy to answer anything — especially curious what would make this useful in your agent stack.
```

**If asked "why MCP not just REST":**

```
Same key works both. MCP gives you schema-discovery for free — agents inspect tool definitions, no glue code. REST is there for non-MCP integrations and direct curl.
```

**If asked "what's the moat":**

```
Honest answer: the public track record is the moat I'm betting on. Anyone can rent a CoinGecko endpoint. Fewer people publish their misses with timestamps. If we keep scoring honestly and the numbers stay better than baseline, that compounds. If they don't, the numbers will tell you and you can fire us.
```

**If asked about reliability / freshness:**

```
Every /api/data response carries a provenance field with freshness_status (fresh/degraded/stale). Per-dataset SLAs at /sources/. Health snapshot at /api/health. Agents are expected to gate on freshness — and we publish enough info that they can.
```

---

## 2. Reddit — r/LocalLLaMA (Ring-2 builders)

**Title:**

```
[MCP] AgentCanary — 19 tools for AI agents with public hit/miss track record (0.162 Brier across 603 predictions)
```

**Post body (Markdown):**

```
Built an MCP server for autonomous AI agents that need market intelligence: macro regime, scenarios, narratives, 36 indicators, daily briefs. Open source MCP, paid API for the deep tools.

What's different vs. wrapping CoinGecko: every prediction we publish is publicly scored after 72h. Reliability table is on the public /record/ page — predicted probability buckets vs. observed hit rate. Mean Brier 0.162, beats random by 35%. We don't curate the misses out.

Setup for LocalLLaMA users:

```json
{
  "mcpServers": {
    "agentcanary": {
      "command": "npx",
      "args": ["-y", "agentcanary-mcp"],
      "env": { "AC_API_KEY": "ac_..." }
    }
  }
}
```

Free Explorer tier (prices + macro regime + indicator catalog + latest brief, 50 calls/day, no card needed). Wallet-billed in USDC on Base for upgrades.

Curious what's missing for local-model agent workflows specifically — happy to ship requested tools if there's signal.

GitHub: https://github.com/MrCerq/agentcanary-mcp
Track record: https://agentcanary.ai/record/
```

---

## 3. Reddit — r/algotrading (wait 1 week after r/LocalLLaMA)

**Title:**

```
Built an API where every macro/crypto prediction is publicly scored after 72h — open source MCP wrapper, looking for feedback from quant builders
```

**Post body:**

```
Disclosure: this is my project. Posting because this sub is exactly the audience I'd want feedback from.

Built AgentCanary as a market intelligence layer for AI agents — but the angle that may resonate here is the public scoring. Every prediction (scenario targets, regime calls, signal scans) gets a hit/partial/miss after a 72-hour evaluation window against Yahoo Finance close prices. 603 predictions scored, archive goes back ~86 days. Per-asset hit rates and Brier reliability are public.

Numbers (live as of yesterday):
- Mean Brier: 0.162 (random baseline 0.25)
- SPY 9% / QQQ 11% / BTC 25% / GLD 33% / OIL 36% / VIX 27%
- Reliability: model is slightly overconfident in the 40-60% probability band (predicted 50% mean → observed 37% hit rate)

This is meant to make calibration drift visible, not to claim alpha. We're explicitly NOT a retail trading signal service.

Audience: agent builders + quant operators who want a schema-stable data source where they can quote SLA + verify track record before deploying anything to live capital.

REST + MCP. Wallet-billed in USDC on Base. No KYC. Free Explorer tier.

What I'm actually asking: if you were going to use a third-party signal source from an autonomous trading agent, what's the bar for trusting it? Where would AC's track record + freshness envelopes fall short of that bar?

https://agentcanary.ai/record/ (track record)
https://agentcanary.ai/sources/ (per-dataset freshness SLAs)
```

---

## 4. LinkedIn — Post 1 (Tuesday 9am ET ideal)

**Body (no hashtags — they signal try-hard on LinkedIn):**

```
We just shipped a Brier score + calibration table on AgentCanary's public track record page.

What this means: every market prediction we generate is now scored against its predicted probability. 603 scored predictions. Mean Brier: 0.162 — 35% better than random.

But the more interesting line on the chart is the reliability column. The model is slightly overconfident in the 40-60% probability band — when we say "this scenario has a 50% chance," it hits 37% of the time. That's the calibration drift, and it's visible to anyone, in public, on the same surface where the predictions live.

I think this is what serious data products owe their users. Especially when those users are autonomous AI agents making decisions on the data. Hit rate alone is theater — Brier + reliability is the diagnostic.

Most API providers ship dashboards optimized for the wins. Building a market intelligence layer for AI agents forced us to take the opposite stance: surface the misses too, with timestamps, with the wrong-direction calls preserved.

agentcanary.ai/record — track record + reliability table
```

---

## 5. LinkedIn — Post 2 (1 week later)

**Body:**

```
A surprising thing about wallet-billed APIs in 2026:

Most agent-builders I talk to assume crypto rails are friction. We tested the opposite assumption with AgentCanary — deposit USDC on Base, credits land in your account in seconds, credits never expire, no recurring subscription to cancel.

The friction we removed wasn't payment friction. It was decision friction. Stripe makes you commit to a tier monthly. Wallet rails let you pay for exactly what you used.

Cumulative deposits set the tier:
- Explorer (free) — prices + regime + indicator list, 50 calls/day
- Builder ($50 USDC) — indicators, news, narratives, signals
- Signal ($150 USDC) — scenarios, full briefs, derivatives
- Institutional ($500 USDC) — unlimited + SLA

Three findings from running this for 6 months:

1. Free tier evaluation is real. Roughly 30 keys in circulation, ~4 actively using. The free tier matches actual usage — 99% of free-tier calls hit just 2 endpoints (prices + regime). So I just rewrote the marketing copy to stop overpromising what the free tier delivers — the data was telling me to be honest.

2. Crypto rails work fine for B2B. The "developers won't deposit crypto" thesis didn't survive contact with the agent-builder segment. They're already paying in crypto somewhere.

3. Wallet billing breaks free-tier-abuse calculus. We don't fight bots because there's no signup cost to game. Abuse-prevention burden shifts entirely to per-call quotas.

If you're considering wallet rails for an agent-facing product, happy to share what we learned.
```

---

## When to ship

- **HN:** Tue or Wed, 8:00-10:00 AM Pacific (16:00-18:00 UTC). Stay in thread for 24h.
- **Reddit r/LocalLLaMA:** Same week, different day. Wed 10am ET ideal.
- **Reddit r/algotrading:** 1 week after r/LocalLLaMA. Different sub norm — they hate self-promo without context. Lead with the question, not the pitch.
- **LinkedIn Post 1:** Week of HN. Tue 9am ET.
- **LinkedIn Post 2:** Following week.

Don't ship them all in one day — sequential reach is better than spike reach.
