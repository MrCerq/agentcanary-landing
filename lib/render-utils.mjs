// agentcanary-landing/lib/render-utils.mjs
// Shared primitives for the time machine v1 render path.
// One source of truth for: theme map, color tokens, regime labels,
// humanize, escapeHtml, entityLink, validate, slot metadata.
//
// Imported by:
//   - tools/build-record.js (server static gen, via dynamic await import())
//   - landing index.html (client live-preview, via <script type="module">)
//
// Per TIME-MACHINE-V1-SPEC.md §7.

// ─── Constants ────────────────────────────────────────────────────

export const SLOTS = ['radar', 'signal', 'pulse', 'wrap'];

// Canonical slot → display + theme.
// Per spec §3. No fallback: unknown slot throws.
export const THEME = Object.freeze({
  radar: {
    label: 'MACRO RADAR',
    color: 'orange',
    accentRgb: '251,146,60',
    fireTimeUTC: '03:15',
  },
  signal: {
    label: 'SIGNAL SCAN',
    color: 'blue',
    accentRgb: '96,165,250',
    fireTimeUTC: '09:15',
  },
  pulse: {
    label: 'MARKET PULSE',
    color: 'yellow',
    accentRgb: '255,197,61',
    fireTimeUTC: '15:15',
  },
  wrap: {
    label: 'MARKET WRAP',
    color: 'purple',
    accentRgb: '167,139,250',
    fireTimeUTC: '21:15',
  },
});

// Six semantic colors only. Per spec §6.
export const TAG_COLORS = Object.freeze({
  green: '#34d399',
  yellow: '#ffc53d',
  red: '#f87171',
  orange: '#fb923c',
  blue: '#60a5fa',
  purple: '#a78bfa',
});

// Regime token → human-readable. Used by humanize().
export const REGIME_LABELS = Object.freeze({
  BULL_REGIME: 'Bullish',
  BEAR_REGIME: 'Bearish',
  DISTRIBUTION: 'Distribution',
  ACCUMULATION: 'Accumulation',
  IGNITION: 'Ignition',
  RISK_OFF: 'Risk-Off',
  RISK_ON: 'Risk-On',
  CAPITULATION: 'Capitulation',
  BULLISH_SHIPPING: 'Bullish Shipping',
  SUPPLY_TIGHTENING: 'Supply Tightening',
  BUBBLE_TERRITORY: 'Bubble Territory',
  TBILL_FAVORED: 'T-Bill Favored',
});

// Legacy session token → canonical slot. Used during migration bake.
// Once migration completes, this map can be deleted; the render layer
// reads only `brief.slot`.
const LEGACY_SESSION_TO_SLOT = Object.freeze({
  morning: 'radar',
  midday: 'pulse',
  intelligence: 'signal',
  signal: 'signal',
  evening: 'wrap',
  // 'cycle' was deprecated months ago; entries get filtered out at
  // migration time, not silently translated here.
});

// Regime phase tokens that anchor /regimes/{slug}/ pages.
export const CANONICAL_REGIMES = Object.freeze([
  'overheating',
  'expansion',
  'stagflation',
  'contraction',
  'recession',
  'displacement',
]);

// ─── Helpers ──────────────────────────────────────────────────────

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Replace regime tokens + collapse 1d:/4h: prefixes. Idempotent.
// Operates on plain text; callers handle HTML separately.
export function humanize(text) {
  if (!text) return text;
  let out = String(text);
  for (const [token, label] of Object.entries(REGIME_LABELS)) {
    out = out.replace(new RegExp('\\b' + token + '\\b', 'g'), label);
  }
  out = out.replace(/\bfrom unk\b/gi, 'from unknown');
  out = out.replace(/\bto unk\b/gi, 'to unknown');
  // 1d: stays as-is per current convention; 4h: stays. The legacy
  // landing-JS rewrote 1d:→Daily: but build-record.js did not — that
  // drift is now resolved by leaving the canonical form intact in both
  // surfaces. Cards render the token as-is; agents consume the raw form.
  return out;
}

// Resolve a brief's slot, falling back to legacy `session` token during
// the migration bake window. After §10.8 (live migration) lands, every
// record has `slot` directly and this fallback is a no-op.
export function resolveSlot(brief) {
  if (brief && SLOTS.includes(brief.slot)) return brief.slot;
  if (brief && typeof brief.session === 'string') {
    const mapped = LEGACY_SESSION_TO_SLOT[brief.session];
    if (mapped) return mapped;
  }
  return null;
}

export function slotMeta(slot) {
  const m = THEME[slot];
  if (!m) throw new Error('slotMeta: unknown slot "' + slot + '"');
  return m;
}

// Build an entity link (asset or regime). Per spec §6.4.
export function entityLink(entity, kind) {
  if (!entity || !kind) throw new Error('entityLink: entity + kind required');
  if (kind === 'asset') {
    const symbol = String(entity).toUpperCase();
    return `<a href="/assets/${escapeHtml(symbol)}/" class="entity-link entity-asset">${escapeHtml(symbol)}</a>`;
  }
  if (kind === 'regime') {
    const slug = String(entity).toLowerCase();
    return `<a href="/regimes/${escapeHtml(slug)}/" class="entity-link entity-regime">${escapeHtml(entity)}</a>`;
  }
  throw new Error('entityLink: unknown kind "' + kind + '"');
}

// Format a UTC date string YYYY-MM-DD into "Month D, YYYY".
export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function monthName(monthNum) {
  const d = new Date(Date.UTC(2000, monthNum - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
}

// ─── Validation ───────────────────────────────────────────────────

// Validate a Brief record against spec §4 shape. Returns {ok, errors}.
// During migration bake, accepts records missing `slot` if `session`
// is present and maps to a known slot.
export function validate(brief) {
  const errors = [];
  if (!brief || typeof brief !== 'object') {
    return { ok: false, errors: ['brief is not an object'] };
  }
  const slot = resolveSlot(brief);
  if (!slot) errors.push('slot missing or unknown (also no legacy session)');
  if (!brief.date || !/^\d{4}-\d{2}-\d{2}$/.test(brief.date)) {
    errors.push('date missing or not YYYY-MM-DD');
  }
  if (typeof brief.headline !== 'string' || brief.headline.length === 0) {
    errors.push('headline missing or empty');
  }
  // Body field accepted as `body` (v1) or `telegramText` (legacy bake).
  const body = brief.body ?? brief.telegramText;
  if (typeof body !== 'string') errors.push('body (or telegramText) missing');

  if (Array.isArray(brief.tags)) {
    for (const [i, tag] of brief.tags.entries()) {
      if (!tag || typeof tag.t !== 'string' || typeof tag.c !== 'string') {
        errors.push(`tags[${i}] missing t or c`);
      } else if (!TAG_COLORS[tag.c]) {
        errors.push(`tags[${i}].c "${tag.c}" not in TAG_COLORS`);
      }
    }
  }

  if (Array.isArray(brief.panels)) {
    for (const [i, p] of brief.panels.entries()) {
      if (!p || typeof p.label !== 'string') {
        errors.push(`panels[${i}] missing label`);
        continue;
      }
      // panels[].type discriminator: 'gauge' | 'rows' (v1) — or legacy shape
      // with .gauge.value or .rows[] without explicit type
      const isGauge = p.type === 'gauge' || (p.gauge && Number.isFinite(p.gauge.value));
      const isRows = p.type === 'rows' || Array.isArray(p.rows);
      if (!isGauge && !isRows) {
        errors.push(`panels[${i}] not gauge or rows`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Asset alias resolver (used by entity extraction + body link rewriting) ──

// Given a canonical asset map (loaded separately from lib/asset-map.json),
// resolve a free-text mention to its canonical ticker. Returns null on miss.
// Map shape: [{ symbol, aliases:[], kind:'crypto'|'equity'|'commodity'|'fx' }]
export function resolveAsset(text, assetMap) {
  if (!text || !Array.isArray(assetMap)) return null;
  const t = String(text).trim();
  // Direct symbol match (case-insensitive)
  for (const entry of assetMap) {
    if (entry.symbol && entry.symbol.toUpperCase() === t.toUpperCase()) return entry.symbol;
  }
  // Alias match (case-sensitive for things like "Gold" vs "GOLD" if needed)
  for (const entry of assetMap) {
    if (Array.isArray(entry.aliases)) {
      for (const alias of entry.aliases) {
        if (alias === t) return entry.symbol;
      }
    }
  }
  return null;
}
