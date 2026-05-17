// agentcanary-landing/lib/entity-extraction.mjs
// Brief-level entity extraction.
// Per TIME-MACHINE-V1-SPEC.md §6.
//
// Given a brief record, scan body + panels + headline + desc and emit
// the entities[] block that anchors /assets/{TICKER}/ + /regimes/{slug}/
// pages.

import { CANONICAL_REGIMES, resolveSlot, resolveAsset } from './render-utils.mjs';

// Strip HTML tags from a string, leaving raw text. Used to scan body
// content for ticker mentions without false-matching inside HTML.
function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Extract canonical regime slug from a brief. Reads atoms.macro.regime
// (or atoms.macro.payload.regime under envelope) and lowercases it,
// then matches against CANONICAL_REGIMES.
export function extractRegime(brief) {
  // 1. Try the brief-level cached regime tag (briefs-archive.json carries
  // it in tags[] with c:'blue' typically — e.g., { t: 'OVERHEATING', c: 'blue' }).
  if (Array.isArray(brief.tags)) {
    for (const tag of brief.tags) {
      if (tag && typeof tag.t === 'string') {
        const slug = tag.t.toLowerCase();
        if (CANONICAL_REGIMES.includes(slug)) return slug;
      }
    }
  }
  // 2. Fall back to scanning body for known regime phase words.
  const body = stripHtml(brief.body ?? brief.telegramText ?? '');
  for (const slug of CANONICAL_REGIMES) {
    const re = new RegExp('\\b' + slug + '\\b', 'i');
    if (re.test(body)) return slug;
  }
  return null;
}

// Extract human-readable regime label (e.g., "Risk-On · Neutral"). Best-
// effort: not always present in briefs-archive.json; returns null on miss.
export function extractRegimeLabel(brief) {
  // Some briefs have it on a tags entry as a non-canonical-regime token;
  // some don't. v1 leaves this null when missing — entity page falls back
  // to displaying just the canonical regime slug.
  return brief.regimeLabel ?? null;
}

// Extract asset symbol mentions from a brief.
// Returns deduped array of canonical symbols, sorted by first-appearance
// order (head of body searched first, then panels, then headline/desc).
export function extractAssets(brief, assetMap) {
  if (!brief || !Array.isArray(assetMap)) return [];
  const found = new Set();
  const ordered = [];

  function add(sym) {
    if (!sym) return;
    const norm = String(sym).toUpperCase();
    if (!found.has(norm)) {
      found.add(norm);
      ordered.push(norm);
    }
  }

  // 1. Headline + desc
  const head = (brief.headline || '') + ' ' + (brief.desc || '');
  scanText(head, assetMap, add);

  // 2. Panels (panel rows have .k = ticker symbol)
  if (Array.isArray(brief.panels)) {
    for (const p of brief.panels) {
      if (Array.isArray(p.rows)) {
        for (const r of p.rows) {
          if (r && r.k) add(resolveAsset(r.k, assetMap) || r.k);
        }
      }
    }
  }

  // 3. Body (HTML-stripped)
  const body = stripHtml(brief.body ?? brief.telegramText ?? '');
  scanText(body, assetMap, add);

  return ordered;
}

// Scan free-text for any alias in the asset map. Matches must be
// word-bounded so "BTC" doesn't match inside "BTCETHSOL" but does match
// inside "BTC:". Aliases are tried longest-first so "S&P 500" wins over
// "S&P".
function scanText(text, assetMap, addFn) {
  if (!text) return;
  // Build a flat (alias, symbol) list, sorted by alias length desc.
  const aliasList = [];
  for (const entry of assetMap) {
    if (!entry || !entry.symbol) continue;
    if (Array.isArray(entry.aliases)) {
      for (const a of entry.aliases) {
        aliasList.push({ alias: a, symbol: entry.symbol });
      }
    }
  }
  aliasList.sort((a, b) => b.alias.length - a.alias.length);

  // Mark consumed character ranges so a shorter alias doesn't double-count
  // inside a longer one already matched (e.g., "Gold" inside "Goldilocks").
  const consumed = new Array(text.length).fill(false);

  for (const { alias, symbol } of aliasList) {
    // Escape regex special chars in alias
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary if alias is alphanumeric only; else loose match
    const isAlphaNum = /^[A-Za-z0-9&. ]+$/.test(alias);
    const re = isAlphaNum
      ? new RegExp('(?:^|[^A-Za-z0-9])' + esc + '(?:[^A-Za-z0-9]|$)', 'g')
      : new RegExp(esc, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index + (m[0].startsWith(alias) ? 0 : m[0].indexOf(alias));
      const end = start + alias.length;
      let alreadyConsumed = false;
      for (let i = start; i < end; i++) {
        if (consumed[i]) { alreadyConsumed = true; break; }
      }
      if (!alreadyConsumed) {
        for (let i = start; i < end; i++) consumed[i] = true;
        addFn(symbol);
      }
    }
  }
}

// Extract movers (from any panel with label 'TOP MOVERS').
export function extractMovers(brief) {
  if (!Array.isArray(brief.panels)) return [];
  const out = [];
  for (const p of brief.panels) {
    if (p && p.label === 'TOP MOVERS' && Array.isArray(p.rows)) {
      for (const r of p.rows) {
        if (!r || !r.k || !r.v) continue;
        const m = String(r.v).match(/^([+-]?)(\d+\.?\d*)/);
        if (!m) continue;
        const chg = parseFloat((m[1] || '+') + m[2]);
        if (!Number.isFinite(chg)) continue;
        out.push({ sym: r.k, chg, direction: chg > 0 ? 'up' : 'down' });
      }
    }
  }
  return out;
}

// Full entity extraction: assets + regime + regimeLabel + movers.
// This is the function called at brief-publish time.
export function extractEntities(brief, assetMap) {
  return {
    assets: extractAssets(brief, assetMap),
    regime: extractRegime(brief),
    regimeLabel: extractRegimeLabel(brief),
    movers: extractMovers(brief),
  };
}
