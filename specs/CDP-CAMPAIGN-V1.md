# CDP Campaign V1 — 5 posts / 2 weeks

**Goal:** validate that CDP-driven web posts from @agentcanary reach views (vs API source-cap) AND that the "free API for content creators" hook converts to signups.

**Audience:** crypto/macro/markets bloggers + newsletter writers + Twitter content creators who need data fuel for their posts.

**Cadence:** 5 posts across 14 days. Roughly one every 3 days. Avoid Mon/Fri.

**Posting window:** 4-6pm CET (= morning US East, dual-audience prime time).

**Pre-launch dependency:** signup-source capture in `POST /keys` (otherwise we can't measure attribution).

**Pass criteria after 14 days:**
- >=1 signup attributable to campaign UTM
- >=3x view lift vs prior API-posted average on @agentcanary
- >=1 organic reply/quote from a creator account (qualitative trust signal)

---

## Post 1 — Track record lead (proof)

**Copy (240 chars):**
```
Most market "AI" won't show you their misses.

We score every prediction. Public ledger.

603 scored · 0.162 mean Brier · 35% better than random baseline.

Free API for bloggers + creators. Endpoint in reply ↓
```

**First reply (240 chars):**
```
GET agentcanary.ai/api/track-record

JSON, no key, CORS-open. Per-scenario reliability, per-asset hit rates, raw prediction stream. Cite the numbers in your next post — methodology is open at /sources.
```

**Image spec (1200×675):**
- Header: "603 PREDICTIONS · PUBLICLY SCORED"
- Big number: **0.162** with label "MEAN BRIER (lower = better)"
- Subhead: "35% better than random baseline (0.250)"
- Reliability bars below (the 3 populated bands)
- Bottom: AC logo + agentcanary.ai/record

---

## Post 2 — Live regime (utility)

**Copy (240 chars):**
```
Today's macro regime:

RECESSION 27% · LATE CYCLE 22% · STAGFLATION 18% · AI BOOM 14%

Risk gauge: 100/100 — HIGH

Live classification, updates every 6h. Free endpoint, embed anywhere.

Reply ↓
```

**First reply (200 chars):**
```
GET agentcanary.ai/api/regime

JSON: current regime, all 6 scenario probabilities, risk gauge, favored/unfavored asset matrix. Open, no key. Drop into your newsletter / dashboard / post.
```

**Image spec (1200×675):**
- Header: "TODAY'S MACRO REGIME · 2026-05-22"
- 6 horizontal bars showing scenario probabilities (RECESSION highlighted)
- Risk gauge visual: 100/100, color red
- Favored: TLT / Gold / Cash · Unfavored: Leveraged equities
- Bottom: AC logo + endpoint URL

---

## Post 3 — Breadth (catalog)

**Copy (240 chars):**
```
Free at agentcanary.ai for content creators:

· 36 macro + crypto indicators (live JSON)
· 19 MCP tools (Claude / Cursor / any agent)
· 4 daily intel briefs (radar / signal / pulse / wrap)
· 603-prediction scored track record

Endpoints in reply ↓
```

**First reply (220 chars):**
```
Docs: agentcanary.ai/docs

Key endpoints (no key required):
/api/regime · /api/track-record · /api/briefs/latest · /api/macro-radar

MCP install: `npx agentcanary-mcp`
```

**Image spec (1200×675):**
- 4-quadrant grid:
  - "36 INDICATORS" + chart icon
  - "19 MCP TOOLS" + plug icon
  - "4 DAILY BRIEFS" + clock icon
  - "603 SCORED" + ledger icon
- AC logo center bottom + agentcanary.ai

---

## Post 4 — BTC-specific data hook (timely)

**Copy (240 chars):**
```
Bitcoin's macro context right now:

Regime: RECESSION (27% lead)
Risk gauge: HIGH — 100/100
Favored in this regime: TLT · Gold · Cash
Unfavored: Leveraged equities

Bloggers — cite this in your next post. Free endpoint.

Reply ↓
```

**First reply (200 chars):**
```
GET agentcanary.ai/api/regime

Full JSON: regime probabilities, risk gauge, favored/unfavored matrix per scenario. Live, free, CORS-open. Pair with your own price chart for instant context.
```

**Image spec (1200×675):**
- "BITCOIN MACRO CONTEXT" header
- Regime stamp: RECESSION (with confidence %)
- Risk gauge meter at 100/100, color red
- Favored assets row · unfavored row
- Subtle BTC logo background
- Bottom: AC logo + endpoint URL

---

## Post 5 — Brand / "why this exists"

**Copy (240 chars):**
```
Most market AI:
× hides bad calls
× wants your card upfront
× black-box scoring

AgentCanary:
✓ scores every prediction publicly
✓ free tier, no card
✓ open methodology

Built for content creators + agent builders.

Reply ↓ for the API
```

**First reply (220 chars):**
```
agentcanary.ai/api — docs
/api/track-record — every scored prediction
/api/regime — live macro classification
/sources — full methodology + data sources

No key, no card, no gates on the read endpoints.
```

**Image spec (1200×675):**
- Split layout: "MOST AI" left (gray) vs "AGENTCANARY" right (brand color)
- 3 contrast lines, x vs ✓
- Bottom: AC logo + agentcanary.ai

---

## Build checklist

- [ ] Signup-source capture in `POST /keys` (backend) — **BLOCKS measurement**
- [ ] Extend `tools/gen-asset-og.mjs` → `tools/gen-campaign-og.mjs` with 5 post-card templates
- [ ] CDP poster service (headed Chrome, persistent session on AC VPS)
- [ ] Posting schedule (5 slots across 14 days, jittered 30-180s within window)
- [ ] UTM on all links for attribution: `?utm_source=x_campaign_v1&utm_content=post_N`

## Post-campaign review

After 14 days:
- View counts per post (X analytics on @agentcanary)
- Profile clicks → docs page
- Signups with `utm_source=x_campaign_v1`
- Organic engagement (replies, quotes, bookmarks from creator accounts)
- **Decision:** scale (build Shape A creator-pack URL), iterate (rewrite hooks), or stop (audience isn't there).
