# Brief Card v1 — Canonical Spec

**Status:** locked 2026-05-17 (initial draft, no implementation yet)
**Scope:** governs the on-page card rendering for AgentCanary briefs across all surfaces (landing live-preview, `/record/` archive index, `/record/{YYYY/MM/DD}/` per-day pages). Out of scope: `og-image.png` (static, separate concern), Telegram message body, X copy.
**Consumers:** `ac-compute` (write path: `intelligence-compiled.js` + `publishCompiledBrief`) and `agentcanary-landing` (render path: `build-record.js` + landing inline JS).

---

## 1. Purpose

The card system has 2 separate render paths (`build-record.js` server-side, landing inline JS client-side), each with their own humanize / cleanHeadline / cleanDesc / regime-label / session-theme logic. Drift is built in: today the landing card falls back to default orange on 3 of 4 brief windows because its THEMES keys don't match the backend session names.

This spec defines:
- ONE canonical data shape that the brief-write path emits.
- ONE canonical render function that all surfaces import.
- ONE canonical enum for everything internal: brief slot, session storage, theme key, file name.

When v1 is shipped, every visible card on every surface renders from the same module. Drift becomes a CI-detectable schema break, not a silent visual bug.

---

## 2. Canonical slot enum

**Decision:** four slots, named exactly:

| Internal slot | UTC fire time | User-facing display label |
|---|---|---|
| `radar` | 03:15 | `MACRO RADAR` |
| `signal` | 09:15 | `SIGNAL SCAN` |
| `pulse` | 15:15 | `MARKET PULSE` |
| `wrap` | 21:15 | `MARKET WRAP` |

This enum is the ONLY name space used in code, storage, file paths, theme keys, cron config, and JSON-LD. The legacy `morning / midday / intelligence / evening` storage tokens are deprecated and will be migrated (§9).

Adding a fifth slot is a v2 spec change, not a v1 patch.

---

## 3. Card data shape (`Brief` record)

A `Brief` record — the unit written by `publishCompiledBrief` to `briefs-archive.json` + MongoDB + the API — has this shape:

```ts
type Brief = {
  // Identity
  slot: 'radar' | 'signal' | 'pulse' | 'wrap';   // canonical, required
  date: string;                                   // YYYY-MM-DD, UTC, required
  publishedAt: string;                            // ISO8601 UTC, required (replaces `time`)

  // Card content
  headline: string;                               // e.g. "MACRO RADAR — May 17"
  desc: string;                                   // 1-line summary, plain text after humanize
  tags: Tag[];                                    // 0–4 entries (typically 2)
  panels: Panel[];                                // 0–3 entries; render order = array order

  // Body
  body: string;                                   // Telegram-flavored HTML; canonical body source

  // External refs
  telegramMessageId?: number;                     // optional, present when posted to Telegram

  // Provenance + audit (not rendered)
  cycleId: string;                                // YYYY-MM-DD-slot
  schemaVersion: 1;
  generatedAt: string;                            // ISO8601 UTC
  validatorStatus: 'pass' | 'retry-pass' | 'fail';
};

type Tag = {
  t: string;          // display text, e.g. "LOW", "OVERHEATING"
  c: TagColor;        // semantic color, see §6
};

type TagColor = 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple';

type Panel = GaugePanel | RowsPanel;

type GaugePanel = {
  type: 'gauge';
  label: string;       // "RISK GAUGE"
  value: number;       // 0–100
};

type RowsPanel = {
  type: 'rows';
  label: string;       // "TOP MOVERS"
  rows: Row[];         // 1–6 entries
};

type Row = {
  k: string;           // ticker / label, e.g. "SLV"
  v: string;           // display value, e.g. "-13.0%"
  c: TagColor;
};
```

**Notes on shape:**
- `headlineColor` is removed. Color is derived from `slot` via the theme map (§7). No per-record color overrides — the brand stays consistent.
- `time` is removed. UTC fire time is derived from `slot` (radar=03:15, etc.). Use `publishedAt` for the actual write timestamp.
- `panels[].type` is an explicit discriminator. Today's records have `panels[].rows` or `panels[].gauge` without a tag — the migration adds `type: 'gauge' | 'rows'` so renderers don't have to sniff.
- `body` replaces the legacy `telegramText` field (renamed for clarity — this content renders on web pages too, not just Telegram).

---

## 4. Render tiers

The same `Brief` renders three ways, picked by the surface:

### Tier 1 — Tile (smallest)
Used on: `/record/` archive listing (one tile per brief published per day).
Shows: slot label badge · headline (truncated to 60 chars) · regime tag (first tag where applicable).
Excludes: panels, body, desc.
Footprint: ~80px tall.

### Tier 2 — Card (medium)
Used on: landing live-preview at `agentcanary.ai#briefs` (one card showing the latest brief).
Shows: Tier 1 + desc + all tags + all panels (right column).
Excludes: body.
Footprint: ~280px tall, two-column.

### Tier 3 — Page (full)
Used on: `/record/{YYYY/MM/DD}/` per-day pages (one card per slot fired that day).
Shows: Tier 2 + full `body` (HTML-rendered, Telegram-flavored tags preserved as inline `<b>`/`<i>`).
Footprint: variable, ~600–1200px depending on body length.

The renderer takes `(brief, tier)` and returns the HTML fragment. Each tier composes the previous + new sections — no copy-paste of partial logic across tiers.

---

## 5. Canonical renderer

**Location:** `agentcanary-landing/lib/card.js` (new module, ESM-friendly so both `build-record.js` and landing inline `<script type="module">` can import).

**Signature:**
```js
import { renderCard } from './lib/card.js';

const html = renderCard(brief, tier);   // tier ∈ 'tile' | 'card' | 'page'
```

**Module exports:**
- `renderCard(brief, tier) → string`
- `THEME[slot] → { color, accentRgb, label, icon }` — theme lookup table
- `humanize(text) → string` — regime token + 1d/4h → Daily/4h translation, single source of truth
- `validate(brief) → { ok: boolean, errors: string[] }` — schema check

**Server-side use** (`build-record.js`): import via Node ESM, call `renderCard(brief, 'tile' | 'page')` and emit the string into the static HTML.

**Client-side use** (landing): fetch `/api/briefs/latest`, then call `renderCard(brief, 'card')` and inject the returned string via `innerHTML` (no per-element DOM building like today's code does).

No second implementation of `humanize` / `cleanHeadline` / `cleanDesc` anywhere. Everything lives in `card.js`.

---

## 6. Tag color tokens

Six semantic colors only. Display values are owned by the renderer, not the data:

| Token | Semantic | Hex |
|---|---|---|
| `green` | positive / risk-on / low-risk | `#34d399` |
| `yellow` | caution / neutral-warning | `#ffc53d` |
| `red` | negative / high-risk | `#f87171` |
| `orange` | radar slot / pre-market | `#fb923c` |
| `blue` | signal slot / structured-state | `#60a5fa` |
| `purple` | wrap slot / synthesis | `#a78bfa` |

Hex values centralized in `THEME` constants in `card.js`. CSS variables on the landing page reference the same hex (so a future palette swap is one place).

---

## 7. Theme map (slot → visual)

```js
const THEME = {
  radar:  { color: 'orange', accentRgb: '251,146,60',  label: 'MACRO RADAR' },
  signal: { color: 'blue',   accentRgb: '96,165,250',  label: 'SIGNAL SCAN' },
  pulse:  { color: 'yellow', accentRgb: '255,197,61',  label: 'MARKET PULSE' },
  wrap:   { color: 'purple', accentRgb: '167,139,250', label: 'MARKET WRAP' },
};
```

No fallback. If `brief.slot` is not one of the four, `validate()` rejects the brief at write time and `renderCard()` throws. There is no orange-default-when-unknown failure mode.

---

## 8. Validation

`validate(brief)` runs at three points:
1. **Write path**, before persisting to `briefs-archive.json` or MongoDB. Invalid briefs throw, surface in scheduler logs.
2. **Render path**, before producing HTML. Invalid briefs render a fallback "Schema error" tile with the validation errors visible in DOM (not silent).
3. **CI**, on `npm test` against `briefs-archive.json` — every entry must validate. A schema break is a red CI run, not a silent drift.

---

## 9. Migration plan (one-shot)

Forward-only is not enough because consumers read historical data (`/record/` lists 86+ days). All historical entries get rewritten:

1. **Add `slot` field** to every entry in `briefs-archive.json` based on `session`:
   - `morning` → `radar`
   - `midday` → `pulse`
   - `intelligence` or `signal` → `signal`
   - `evening` → `wrap`
   - `cycle` → drop entry (cycle was deprecated months ago)
2. **Rename `telegramText` → `body`**.
3. **Rename `time` → `publishedAt`** (parse `HH:MM UTC` against `date` to construct ISO timestamp; if no precise time exists, use `date + 'T' + slot-time-mapping + 'Z'`).
4. **Drop `headlineColor`** (now derived from `slot`).
5. **Add `panels[].type`** discriminator (`gauge` if `.gauge` exists, `rows` if `.rows` exists).
6. **MongoDB**: same field renames, plus rename collection-level `type` field to `slot` for consistency.
7. **Code**: rip out `SESSION_TO_TYPE`, `SESSION_META["morning"]`, every alias table.

Migration script lives at `ac-compute/scripts/migrate-briefs-to-card-v1.js`. Dry-run mode by default; `--commit` flag to actually write. Idempotent — re-running on already-migrated data is a no-op.

---

## 10. Versioning

`schemaVersion: 1` baked into every Brief record. A v2 change requires:
- new spec doc revision
- migration script
- renderer accepts both v1 and v2 for the bake window
- archive entries can be mixed during migration

`renderCard()` ignores unknown future fields, so adding optional fields is forward-compatible (won't bump version).

---

## 11. Out of scope (this rewrite)

- `og-image.png` — kept as-is, separate refresh cadence
- Telegram message body — same `body` field is used, but Telegram-side formatting (X-copy strip, hybrid CTA) is owned by `tools/x-copy.js` and `intelligence-compiled.js` publish path, unchanged
- X / Twitter card content — out of scope, separate primitives
- Scoring / prediction surfaces — pipeline #4, will consume the same `card-v1` shape when it arrives
- Routes / page layout — pages keep their current URLs and outer chrome; only the brief-card render changes

---

## 12. Ship order

1. **Spec doc lands** (this file) — committed before any code.
2. **`lib/card.js` module** — written + unit tested in isolation against synthetic Brief fixtures.
3. **Migration script** — written + dry-run verified against current `briefs-archive.json`.
4. **Run migration in dry-run**, diff output, commit when clean.
5. **Migrate live data** with `--commit` flag, single transaction.
6. **Switch `build-record.js`** to `renderCard()`. Rebuild all `/record/` pages.
7. **Switch landing inline JS** to `renderCard()`. Replace per-element DOM-building with single `innerHTML`.
8. **Rip out the legacy mapping tables** (SESSION_TO_TYPE, etc.).
9. **CI test** validates every existing brief entry against the schema. Green required.

Each step is its own commit with rollback safe.
