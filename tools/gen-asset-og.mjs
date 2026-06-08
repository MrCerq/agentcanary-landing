#!/usr/bin/env node
/**
 * Generate per-asset OG cards (1200×630 PNG) for each /assets/{TICKER}/ page.
 *
 * Output: /assets/{TICKER}/og.png (one per ticker).
 * Each card shows: ticker, mention count, hit-rate when scored, date window,
 * AgentCanary brand. Reuses score-aggregates per_asset data when available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const W = 1200, H = 630;

const escapeXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildSvg({ ticker, mentions, dateRange, hitRate, weighted, brierStats }) {
  const hasHitRate = Number.isFinite(hitRate);
  const beatsBaseline = brierStats && brierStats.meanBrier < brierStats.baselineRandom;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glowTL" cx="0%" cy="0%" r="60%">
      <stop offset="0%" stop-color="rgba(255,197,61,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,197,61,0)"/>
    </radialGradient>
    <radialGradient id="glowBR" cx="100%" cy="100%" r="60%">
      <stop offset="0%" stop-color="rgba(96,165,250,0.14)"/>
      <stop offset="100%" stop-color="rgba(96,165,250,0)"/>
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0e1a"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glowTL)"/>
  <rect width="${W}" height="${H}" fill="url(#glowBR)"/>

  <!-- brand -->
  <g transform="translate(80, 90)">
    <text x="0" y="0" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#e4e9f2">
      Agent<tspan fill="#ffc53d">Canary</tspan>
    </text>
  </g>

  <!-- eyebrow -->
  <text x="80" y="180" font-family="monospace, JetBrains Mono" font-size="13" letter-spacing="3" font-weight="700" fill="#ffc53d">
    THE RECORD · ASSET COVERAGE
  </text>

  <!-- giant ticker -->
  <text x="80" y="320" font-family="monospace, JetBrains Mono" font-size="140" font-weight="700" fill="#ffffff" letter-spacing="-3">
    ${escapeXml(ticker)}
  </text>

  <!-- sub -->
  <text x="80" y="380" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="500" fill="#7a8aa0">
    ${escapeXml(mentions)} AgentCanary brief${mentions === 1 ? '' : 's'}${dateRange ? ' · ' + escapeXml(dateRange) : ''}
  </text>

  <!-- proof row (reframed 2026-06-08: coverage, no scoring) -->
  <g transform="translate(80, 430)">
    <rect x="0" y="0" width="665" height="110" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="24" y="36" font-family="monospace, JetBrains Mono" font-size="11" letter-spacing="2.5" font-weight="700" fill="#7a8aa0">COVERAGE</text>
    <text x="24" y="86" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="500" fill="#ffffff">Regime &#183; narrative &#183; scenario state</text>

    <rect x="690" y="0" width="320" height="110" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="714" y="36" font-family="monospace, JetBrains Mono" font-size="11" letter-spacing="2.5" font-weight="700" fill="#7a8aa0">ACCESS</text>
    <text x="714" y="86" font-family="monospace, JetBrains Mono" font-size="32" font-weight="700" fill="#ffffff">REST + MCP</text>
  </g>

  <!-- url -->
  <text x="80" y="590" font-family="monospace, JetBrains Mono" font-size="14" font-weight="500" fill="#7a8aa0">
    agentcanary.ai/assets/${escapeXml(ticker)}/ · npx agentcanary-mcp · market context layer
  </text>
</svg>`;
}

// ─── Run ───
const agg = JSON.parse(fs.readFileSync(path.join(ROOT, 'record/data/score-aggregates.json'), 'utf8'));
const perAsset = {};
for (const a of (agg.perAsset || [])) perAsset[a.ticker] = a;

const archive = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'briefs-archive.json'), 'utf8'));
const briefs = Array.isArray(archive) ? archive : (archive.briefs || Object.values(archive));

// Build ticker → mentions count + date range. Uses brief.entities.assets[]
// (canonical tickers) — matches build-record-v1.mjs:byAsset.
const byTicker = new Map();
for (const b of briefs) {
  if (!b.entities) continue;
  for (const sym of (b.entities.assets || [])) {
    if (!byTicker.has(sym)) byTicker.set(sym, { count: 0, firstDate: b.date, lastDate: b.date });
    const e = byTicker.get(sym);
    e.count++;
    if (b.date < e.firstDate) e.firstDate = b.date;
    if (b.date > e.lastDate) e.lastDate = b.date;
  }
}

console.log(`[og-asset] found ${byTicker.size} tickers in archive`);

// Only render for tickers that have an index.html (= real asset pages).
// Filters out orphan tag-text dirs like "A2Z 1698% APR".
let written = 0;
let skipped = 0;
for (const [ticker, info] of byTicker) {
  const outDir = path.join(ROOT, 'assets', ticker);
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    skipped++;
    continue;
  }
  const stat = perAsset[ticker] || null;
  const svg = buildSvg({
    ticker,
    mentions: info.count,
    dateRange: `${info.firstDate} → ${info.lastDate}`,
    hitRate: stat?.hit_rate_pct,
    weighted: stat?.weighted_pct,
    brierStats: agg.brierStats || null,
  });
  const resvg = new Resvg(svg, { background: '#0a0e1a', fitTo: { mode: 'width', value: W } });
  const png = resvg.render().asPng();
  fs.writeFileSync(path.join(outDir, 'og.png'), png);
  written++;
}
console.log(`[og-asset] wrote ${written} per-asset OG cards (${skipped} orphan tag-dirs skipped)`);
