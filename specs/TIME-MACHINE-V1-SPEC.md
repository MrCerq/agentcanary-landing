# The Record — Time Machine v1 Spec

**Status:** locked 2026-05-17 (no implementation yet)
**Supersedes:** `CARD-V1-SPEC.md` (superseded — was too narrow; only addressed in-page card render. Real v1 also defines URL hierarchy, entity axes, SEO substrate, and write-time entity extraction.)
**Consumers:** `ac-compute` (write path: `intelligence-compiled.js` + `publishCompiledBrief`) and `agentcanary-landing` (static site generator + landing live-preview).

---

## 1. Product framing

The Record is a **time machine** — a permanently indexable, SEO-clean, agent-discoverable record of market state over time. Every brief is a timestamped artifact. Every entity mention becomes a discoverable axis. Value compounds with each new brief.

The cards, the visual design, and the scoring are all built **around** the time machine. They are surfaces, not the substrate. v1 builds the substrate. v2 layers receipts (scoring redesign, living-claim resolution chips) on top.

What makes a time machine compound:
- Every brief has a permanent, SEO-clean URL that Google + LLM crawlers can find.
- Every entity mentioned gets its own permanent index URL that grows with each new mention.
- URL hierarchy is dense enough that crawlers can reach every brief from multiple paths.
- Body content is indexed-as-published, not hidden behind expand buttons.
- Schema.org structured data on every page matches the visible content.

---

## 2. URL hierarchy

### 2.1 Time axis (the spine)

| URL | Page type | New / existing |
|---|---|---|
| `/record/` | Collection index, latest 7 days + scorecard | exists, gets SEO upgrades |
| `/record/{YYYY}/` | Year index, lists all months that year | **NEW** (currently 404) |
| `/record/{YYYY/MM}/` | Month index, lists all days that month | **NEW** (currently 404) |
| `/record/{YYYY/MM/DD}/` | Day page, 4 brief cards stacked | exists, gets SEO + visual upgrades |
| `/record/{YYYY/MM/DD}/{slot}/` | Per-brief permalink | **NEW** (currently briefs are anchors only) |

`{slot}` enum: `radar / signal / pulse / wrap` (per the canonical slot decision, see §3).

### 2.2 Entity axis (the moat)

| URL | Page type | Indexed by |
|---|---|---|
| `/assets/{TICKER}/` | All briefs mentioning this asset, time-sorted desc | canonical ticker symbol |
| `/regimes/{slug}/` | All briefs published during this regime | canonical phase slug |

`{TICKER}` enum: open — every ticker mentioned in any brief becomes a candidate page (see §6).
`{slug}` enum: `overheating / expansion / stagflation / contraction / recession / displacement` (lowercase, derived from `phase` field).

### 2.3 Thin-content protection

Auto-generated asset + regime pages with fewer than 3 historical brief mentions get `<meta name="robots" content="noindex">`. Once a page hits 3+ mentions, the noindex drops automatically on next rebuild.

### 2.4 Deletions / redirects

- `/record/archive/` — DELETED. Pure duplicate of `/record/`. No redirect (low-volume URL).
- All other existing `/record/...` URLs are preserved byte-for-byte. v1 is additive over the existing URL graph.

---

## 3. Canonical slot enum (carries over from CARD-V1-SPEC)

Four slots, named exactly:

| Internal slot | UTC fire time | User-facing display label |
|---|---|---|
| `radar` | 03:15 | `MACRO RADAR` |
| `signal` | 09:15 | `SIGNAL SCAN` |
| `pulse` | 15:15 | `MARKET PULSE` |
| `wrap` | 21:15 | `MARKET WRAP` |

The legacy `morning / midday / intelligence / evening` storage tokens are deprecated and migrated (§10).

---

## 4. Brief record shape (extended for time machine)

```ts
type Brief = {
  // Identity
  slot: 'radar' | 'signal' | 'pulse' | 'wrap';
  date: string;            // YYYY-MM-DD, UTC
  publishedAt: string;     // ISO8601 UTC
  permalink: string;       // /record/YYYY/MM/DD/{slot}/ — canonical URL

  // Card content
  headline: string;
  desc: string;
  tags: Tag[];
  panels: Panel[];

  // Body (immutable across v1 migration)
  body: string;            // Telegram-flavored HTML; preserved byte-for-byte from telegramText

  // ✦ NEW IN V1: entity extraction (auto-derived at write time)
  entities: {
    assets: string[];      // canonical ticker symbols mentioned (e.g., ['BTC', 'SPY', 'GLD'])
    regime: string;        // canonical phase slug (lowercase, e.g., 'overheating')
    regimeLabel: string;   // human-readable regime label (e.g., 'Risk-On · Neutral')
    movers: Mover[];       // top movers from panels (extracted for cross-link)
  };

  // External refs
  telegramMessageId?: number;

  // Provenance + audit (not rendered)
  cycleId: string;
  schemaVersion: 1;
  generatedAt: string;
  validatorStatus: 'pass' | 'retry-pass' | 'fail';
};

type Mover = { sym: string; chg: number; direction: 'up' | 'down' };

// Tag + Panel shapes carry over from CARD-V1-SPEC §3 (unchanged).
```

**Entity extraction rules (§6):**
- `assets[]` is computed from regex-scanning `body` + `panels[].rows[].k` against a canonical asset map.
- `regime` is derived from `phase` field on the macro atom (lowercased).
- `regimeLabel` carries through `regimeLabel` field from regime-state.json.
- `movers[]` extracts from any panel with `label: 'TOP MOVERS'`.

---

## 5. Per-page-type requirements

### 5.1 Common (every page in `/record/` namespace)

- `<h1>` per page, content = page subject
- Visible breadcrumb matching JSON-LD breadcrumb claim
- `<link rel="canonical">` pointing to self
- `<link rel="prev">/"next">` between adjacent entities on the same axis (where applicable)
- og: + twitter: meta with page-specific values
- `<link rel="alternate" type="application/feed+json" href="...">` for any page that has a feed counterpart
- Schema.org JSON-LD (page-type-specific, see below)
- Shared CSS at `/assets/card.css` — no inlined `<style>` per page
- `<link rel="preconnect" href="https://fonts.googleapis.com">` for the webfont
- `font-display: swap` on the font face

### 5.2 `/record/` (collection index)

- `<h1>The Record</h1>`
- `<h2>` per latest brief tile (most-recent 7 days)
- Scorecard block (existing 607-predictions display, gets a "scoring rules updating in v2" footer note)
- JSON-LD: `CollectionPage` containing `ItemList` of latest day pages
- Sitemap entry priority: 1.0

### 5.3 `/record/{YYYY}/` (year index)

- `<h1>{YYYY} — The Record</h1>`
- `<h2>` per month (with brief count + scorecard mini-summary)
- JSON-LD: `CollectionPage` + `BreadcrumbList`
- Sitemap entry priority: 0.7

### 5.4 `/record/{YYYY/MM}/` (month index)

- `<h1>{Month} {YYYY} — The Record</h1>`
- `<h2>` per day (e.g., "May 17, 2026") with brief count + regime tag + scorecard mini-summary for that day
- JSON-LD: `CollectionPage` + `BreadcrumbList`
- Sitemap entry priority: 0.6

### 5.5 `/record/{YYYY/MM/DD}/` (day page)

- `<h1>{Month Day}, {YYYY} — The Record</h1>` (e.g., "May 17, 2026 — The Record")
- `<h2>` per brief headline (4 max per day)
- Each brief = a hero-sized card (landing-card visual parity: `padding: 32px 36px`, `font-size: clamp(22px, 3vw, 32px)` headline) with **body expanded by default**
- Body sections rendered as `<h3>` (MACRO OVERVIEW, CRYPTO, LIQUIDITY & CREDIT, etc.) so they appear in the document outline
- Entity links inline in body: ticker mentions → `<a href="/assets/{TICKER}/">`, regime tag → `<a href="/regimes/{slug}/">`
- JSON-LD: `CollectionPage` containing `ItemList` of 4 child `NewsArticle` entries (one per brief)
- `<link rel="prev/next">` to adjacent day pages
- Sitemap entry priority: 0.8

### 5.6 `/record/{YYYY/MM/DD}/{slot}/` (per-brief permalink)

- `<h1>{Display Label} — {Month Day}, {YYYY}</h1>` (e.g., "MACRO RADAR — May 17, 2026")
- Single hero card (no surrounding day-page chrome)
- Body section `<h2>`s for each brief section
- Entity links inline
- JSON-LD: standalone `NewsArticle` + `BreadcrumbList`
- `<link rel="prev/next">` to same-slot brief of adjacent days (e.g., yesterday's radar, tomorrow's radar)
- Sitemap entry priority: 0.7

### 5.7 `/assets/{TICKER}/` (asset entity page)

- `<h1>{TICKER} — Briefs mentioning this asset</h1>`
- Brief-count summary + most-recent regime context for this asset
- `<h2>` per brief, time-sorted descending
- Each entry shows the brief's relevant snippet (the sentence/section where the ticker appeared) + link to per-brief permalink
- JSON-LD: `CollectionPage` + `BreadcrumbList`
- Thin-content guard: if <3 mentions, `<meta name="robots" content="noindex">`
- Sitemap entry priority: 0.5 (rises to 0.7 with 10+ mentions)

### 5.8 `/regimes/{slug}/` (regime entity page)

- `<h1>{Regime} — Briefs published in this regime</h1>`
- Date-range summary (first → last appearance)
- `<h2>` per brief, time-sorted descending
- JSON-LD: `CollectionPage` + `BreadcrumbList`
- Sitemap entry priority: 0.5

---

## 6. Entity extraction rules

Run at brief-publish time inside `publishCompiledBrief`, before write to `briefs-archive.json`. Idempotent — re-running on already-extracted data produces identical output.

### 6.1 Asset mentions

- Maintain a canonical asset map: `lib/asset-map.json` shipping ~200 tickers with their canonical symbols + display names + aliases.
  - Example entry: `{ "symbol": "BTC", "aliases": ["BTC", "Bitcoin", "bitcoin"], "kind": "crypto" }`
- Scan `body` (HTML-stripped) + `panels[].rows[].k` + `headline` + `desc` against the alias list.
- For each matched alias, emit the canonical symbol into `entities.assets[]` (deduped).
- Aliases like "Bitcoin" do NOT get their own page — they redirect to canonical (`/assets/BTC/`).

### 6.2 Regime

- `entities.regime` = lowercase of `phase` field from macro atom (e.g., `"OVERHEATING"` → `"overheating"`).
- `entities.regimeLabel` = `regimeLabel` field from regime-state.json (e.g., `"Risk-On · Neutral"`).
- Only `phase` anchors the page URL; `regimeLabel` displays on the page for context.

### 6.3 Movers

- Extract from any panel with `label: 'TOP MOVERS'`. For each row: `{ sym, chg: parseFloat, direction: chg > 0 ? 'up' : 'down' }`.
- Used to cross-link asset pages (the movers contribute to `/assets/{sym}/` mentions).

### 6.4 Body link rewriting

After entity extraction, post-process `body` for rendering only (NOT mutating the stored body):
- Each occurrence of a canonical ticker or alias wraps to `<a href="/assets/{TICKER}/">{matched-text}</a>`.
- Each regime tag in the brief wraps to `<a href="/regimes/{slug}/">{matched-text}</a>`.
- Stored body remains immutable; link rewriting is a render-time transform owned by the canonical render module.

---

## 7. Canonical render module

**Location:** `agentcanary-landing/lib/` — three modules:

```js
import { renderCard } from './lib/card.js';
import { renderIndex } from './lib/page.js';
import { entityLink, humanize, validate } from './lib/render-utils.js';
```

**Module exports:**

- `renderCard(brief, tier) → string` where `tier ∈ 'tile' | 'card' | 'page'`
- `renderIndex(opts) → string` where `opts = { type: 'collection' | 'year' | 'month' | 'asset' | 'regime', items: [...], title, breadcrumb, ...}`
- `entityLink(entity, kind) → string` for inline link rewriting (`kind ∈ 'asset' | 'regime'`)
- `humanize(text) → string` — regime token + `1d:/4h:` → `Daily:/4h:` translation
- `validate(brief) → { ok, errors }` — schema check

Module is ESM. Server-side use (`build-record.js` in Node): import via dynamic `import()`. Client-side use (landing inline JS): import via `<script type="module">`.

**One source of truth** for `humanize`, theme map, color tokens, session labels, body link rewriting. No second implementation anywhere.

---

## 8. Card render tiers (carried over from CARD-V1-SPEC §4, with visual parity rule)

### Tier 1 — Tile (smallest)
Used on: `/record/`, `/record/{YYYY}/`, `/record/{YYYY/MM}/` index pages, archive list rows.
Shows: slot label badge · headline · regime tag.

### Tier 2 — Card (medium)
Used on: landing live-preview at `agentcanary.ai#briefs`.
Shows: Tile + desc + all tags + all panels.

### Tier 3 — Page (full, hero-sized)
Used on: `/record/{YYYY/MM/DD}/` per-day pages + `/record/{YYYY/MM/DD}/{slot}/` per-brief permalink.
Shows: Card + full body (HTML-rendered, expanded by default, entity links inline).
**Visual parity rule:** Page tier uses the SAME padding/headline-size/max-width as Card tier (`padding: 32px 36px`, headline `clamp(22px, 3vw, 32px)`). Page tier is never visually smaller than Card tier — `/record/` cards scroll, they don't pack.

---

## 9. Validation (carries over from CARD-V1-SPEC §8)

Three-point: write-time (in `publishCompiledBrief`), render-time (in `renderCard`/`renderIndex`), CI (in `npm test` against the archive). Invalid records throw at write, render with a visible "Schema error" fallback at render, and fail CI.

---

## 10. Migration plan (one-shot)

84+ historical days get backfilled with the new shape. Body content is preserved byte-for-byte (no telegramText rewriting). All existing URLs stay valid.

Step-by-step:

1. **Spec lands** (this doc) — committed before any code.
2. **`lib/asset-map.json`** drafted (200 tickers + aliases).
3. **Entity extraction module** written + unit tested against synthetic + historical briefs.
4. **Render modules** (`lib/card.js`, `lib/page.js`, `lib/render-utils.js`) written + unit tested.
5. **Shared CSS** (`/assets/card.css`) extracted from current inline styles.
6. **Migration script** (`ac-compute/scripts/migrate-record-v1.js`):
   - Add `slot` field to every brief in `briefs-archive.json` (from `session`).
   - Rename `telegramText` → `body`.
   - Rename `time` → `publishedAt`.
   - Add `permalink` field.
   - Run entity extraction on every brief, write `entities.{assets, regime, regimeLabel, movers}`.
   - Add `panels[].type` discriminator.
   - Drop `headlineColor`.
   - MongoDB: same migrations.
7. **Dry-run migration** + diff output. Commit when clean.
8. **Live migration** with `--commit` flag.
9. **build-record.js rewrite** to use canonical render modules + generate full URL hierarchy:
   - `/record/`
   - `/record/{YYYY}/` (NEW)
   - `/record/{YYYY/MM}/` (NEW)
   - `/record/{YYYY/MM/DD}/` (regenerated)
   - `/record/{YYYY/MM/DD}/{slot}/` (NEW)
   - `/assets/{TICKER}/` (NEW)
   - `/regimes/{slug}/` (NEW)
10. **Landing inline JS rewrite** to use `renderCard()` from the shared module.
11. **Sitemap update** to include all entity URLs.
12. **Rip out legacy mapping tables** (SESSION_TO_TYPE, SESSION_META["morning"], all aliases).
13. **Delete** `/record/archive/`.
14. **Run incremental rebuild on next sync** — sanity check.
15. **CI test** validates every existing brief entry. Green required.

Each step is its own commit, rollback-safe.

---

## 11. Out of scope (v1)

- Scoring redesign / calibration plots — v2 (will use existing predictions.json untouched).
- Living-claim resolution chips inline in body — v2 (depends on scoring redesign).
- Time × entity cross-cuts (`/assets/BTC/2026/05/`) — v3.
- Calendar / event entities — v3.
- Week / quarter aggregations — v3.
- Per-asset RSS / Atom subscriptions — v3.
- `og-image.png` dynamic regeneration — kept static per operator decision.

---

## 12. Versioning

`schemaVersion: 1` baked into every Brief record. v2 changes require: new spec doc, migration script, dual-version render acceptance, mixed-version archive tolerance during bake window.

Render modules ignore unknown future fields — adding optional fields stays forward-compatible without version bump.

---

## 13. Success criteria

v1 is shipped when:

1. Every URL in §2 exists and is served (no 404s in any axis).
2. Every page has h1/h2/h3 hierarchy + visible breadcrumb + matching JSON-LD.
3. Every brief permalink resolves to a hero-sized card with body expanded.
4. Entity link rewriting works inline in every brief body.
5. `/assets/{TICKER}/` for at least 5 high-mention tickers (BTC, SPY, QQQ, GLD, SLV) exists with `>= 3` brief entries.
6. `/regimes/{slug}/` for every phase observed in the data exists.
7. Sitemap covers every entity URL.
8. Single canonical render module is the only humanize / theme / link-rewrite implementation across `build-record.js` AND landing inline JS.
9. CI test validates every existing brief.
10. Visual parity: `/record/` brief cards have landing-card prominence.
