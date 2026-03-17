# Prediction Scoring System — The Record

## Overview
Extract scoreable predictions from Signal Scan briefs, evaluate them against actual prices 48-72h later, and display results on daily Record pages.

## What Gets Scored

### 1. Scenario Price Targets (primary)
Each Signal Scan has 2-3 forward scenarios with specific ticker/price ranges:
```
SCENARIO A — Geopolitical Escalation
OIL: $105-115 (+10-20%)
SPY: $635-655 (-5-10%)
BTC: $66-70K (-10-5%)
```
**Scoring**: Did the ticker enter the predicted range within 72h? Binary hit/miss per target line.

### 2. Directional Calls (secondary)
IMPLICATION section contains directional language:
```
"Tactical long crypto vs energy beta if geopolitical premium fades"
```
**Scoring**: Extract ticker + direction (long/short/overweight/underweight), check 72h return. Hit = correct direction by >1%.

### 3. Regime Calls (tertiary)
Morning briefs declare regime (STAGFLATION, EXPANSION, etc.) and risk level.
**Scoring**: Did the regime persist or shift within 7 days? Compare consecutive regime tags.

## Architecture

### Build-Time Only (no backend changes)
Everything runs inside `build-record.js`:

1. **Extract**: Parse each Signal Scan for SCENARIO blocks + IMPLICATION
2. **Store**: Write `record/data/predictions.json` — accumulated predictions file
3. **Score**: For each prediction older than 72h, fetch actual prices and evaluate
4. **Render**: Add scored predictions section to daily pages

### Price Data for Scoring
Use Yahoo Finance API (already available via `tools/fetch-yahoo.js` pattern):
- Fetch historical close prices for scoring window
- Cache in `record/data/price-cache.json` to avoid re-fetching
- Tickers needed: SPY, QQQ, VIX, TLT, DXY, OIL (CL=F), GLD, BTC-USD, ETH-USD, SOL-USD + any sector ETFs

### predictions.json Schema
```json
{
  "predictions": [
    {
      "id": "2026-03-16-A-OIL",
      "date": "2026-03-16",
      "session": "intelligence",
      "scenario": "A",
      "scenarioName": "Iran Escalation Premium",
      "ticker": "OIL",
      "type": "scenario_target",
      "rangeMin": 105,
      "rangeMax": 115,
      "impliedMove": "+6% to +16%",
      "basePrice": 99.0,
      "scoreDate": "2026-03-19",
      "actualPrice": null,
      "result": null,
      "resultDetail": null
    }
  ],
  "lastScored": "2026-03-17T00:00:00Z"
}
```

### Result Values
- `"hit"` — price entered predicted range within 72h
- `"miss"` — price never entered range
- `"partial"` — price moved in predicted direction but didn't reach range
- `"pending"` — less than 72h since prediction
- `"no_data"` — couldn't fetch price

### Scoring Logic
```
For each scenario target:
  1. Get base price (price at time of prediction, from brief content)
  2. Get high/low over next 72h
  3. If intraday range overlapped [rangeMin, rangeMax] → HIT
  4. If direction correct but didn't reach range → PARTIAL  
  5. Otherwise → MISS

For directional calls:
  1. Extract direction from IMPLICATION text
  2. Get 72h return
  3. If return matches direction by >1% → HIT
  4. If flat (<1% either way) → PARTIAL
  5. If wrong direction by >1% → MISS
```

## Display on Record Pages

### Scorecard Section (below summary, above brief cards)
Only shown on days with scored predictions (72h+ old):

```
┌──────────────────────────────────────────────┐
│ SCORECARD                                     │
│                                               │
│ 3 predictions scored · 2 hit · 0 partial · 1 miss │
│                                               │
│ ✓ OIL $105-115 (Scenario A)    → Hit $108.20 │
│ ✓ BTC $68-71K (Scenario A)     → Hit $69,400 │
│ ✗ SPY $630-650 (Scenario A)    → Miss $672   │
│                                               │
│ ○ ETH $2500-2700 (Scenario B)  → Pending     │
│ ○ QQQ $630-660 (Scenario B)    → Pending     │
└──────────────────────────────────────────────┘
```

Colors:
- Hit: green (#34d399)
- Partial: yellow (#ffc53d)  
- Miss: red (#f87171)
- Pending: grey (#4a5a7a)

### Aggregate Stats (archive page header)
Below "Every call. Every day. Scored." add:
```
142 predictions · 58% hit rate · 22% partial · 20% miss
```

### Per-Day Mini Badge (archive listing)
Next to brief count: `4 briefs · 67% hit`

## Extraction Regex Patterns

### Scenario Targets
```js
// Split on <b>SCENARIO blocks
const blocks = content.split(/<b>SCENARIO/);
// Each block: first line = "A — Name"
// Following lines: "TICKER: $MIN-MAX (MOVE%)"
const targetLine = /^(\w+):\s*\$?([\d,.]+[KkMm]?)\s*[-–]\s*\$?([\d,.]+[KkMm]?)\s*\(([^)]+)\)/;
```

### Directional Calls  
```js
// From IMPLICATION section
const directions = {
  long: /\b(long|overweight|accumulate|buy)\s+(\w+)/gi,
  short: /\b(short|underweight|reduce|sell)\s+(\w+)/gi,
};
```

### Base Prices
```js
// From MACRO RISK DASHBOARD in same brief
// "Key prices: SPY +0.4% | QQQ +0.5%"
// Or from morning brief same day: "SPY: $669.03"
```

## Ticker Normalization
```js
const TICKER_MAP = {
  'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD',
  'OIL': 'CL=F', 'GOLD': 'GC=F', 'GLD': 'GLD',
  'DXY': 'DX-Y.NYB',
};
// K suffix: 70K → 70000, 2.5K → 2500
```

## Build Phases

### Phase 1: Extract + Display (no scoring yet)
- Parse all Signal Scan briefs for scenario targets
- Write `predictions.json` with `result: "pending"` for all
- Show predictions section on daily pages with pending badges
- ~4h work

### Phase 2: Price Fetching + Scoring  
- Add Yahoo historical price fetcher
- Score predictions older than 72h
- Update predictions.json with results
- Show hit/miss/partial badges
- ~4h work

### Phase 3: Aggregate Stats + Archive
- Compute running hit rate
- Add stats to archive page hero
- Add per-day accuracy to archive listing
- ~2h work

## Constraints
- Build-time only. No backend API changes.
- Price cache persists across builds (don't re-fetch scored predictions)
- Graceful degradation: if Yahoo is down, predictions stay "pending"
- Never delete predictions once written (append-only log)
- Round prices to 2 decimal places for display
- Scenario targets from Signal Scan only (most structured, most scoreable)

## Output Files
- `record/data/predictions.json` — all predictions + scores
- `record/data/price-cache.json` — Yahoo price history cache
- Daily pages: scorecard section added
- Archive page: aggregate stats added
