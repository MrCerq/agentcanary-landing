// agentcanary-landing/lib/og-card.mjs
// Per-brief social card generator. SVG template → PNG via @resvg/resvg-js.
// Called from tools/build-record-v1.mjs to emit /record/YYYY/MM/DD/{slot}/og.png.
// Renders at 1200x630 (standard og:image size).

import { Resvg } from '@resvg/resvg-js';
import { resolveSlot, slotMeta, extractBriefHighlights, monthName } from './render-utils.mjs';

const SLOT_COLOR = {
  radar: '#fb923c',
  signal: '#60a5fa',
  pulse: '#ffc53d',
  wrap: '#a78bfa',
};
const SLOT_GLOW = {
  radar: 'rgba(251,146,60,0.12)',
  signal: 'rgba(96,165,250,0.12)',
  pulse: 'rgba(255,197,61,0.12)',
  wrap: 'rgba(167,139,250,0.12)',
};

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Truncate a string to a max length, adding ellipsis if cut.
function trunc(s, n) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function svgForBrief(brief) {
  const slot = resolveSlot(brief);
  const meta = slotMeta(slot);
  const color = SLOT_COLOR[slot] || '#ffc53d';
  const glow = SLOT_GLOW[slot] || 'rgba(255,197,61,0.12)';
  const date = brief.date || '';
  const [y, m, d] = date.split('-');
  const dateStr = m && d ? `${monthName(parseInt(m, 10))} ${parseInt(d, 10)}, ${y}` : date;
  const headline = trunc(brief.headline || '', 56);
  const desc = trunc(brief.desc || '', 80);
  const highlights = extractBriefHighlights(brief, slot).slice(0, 4);

  // 4 chip columns evenly spaced across 1040px
  const chipW = 244;
  const chipGap = 18;
  const chipStartX = 80;

  const chips = highlights.map((h, i) => {
    const x = chipStartX + i * (chipW + chipGap);
    return `
  <g transform="translate(${x}, 400)">
    <rect width="${chipW}" height="90" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <text x="20" y="32" font-family="monospace, JetBrains Mono" font-size="11" fill="#4a5a7a" letter-spacing="2" font-weight="700">${escapeXml(String(h.label || '').toUpperCase())}</text>
    <text x="20" y="70" font-family="monospace, JetBrains Mono" font-size="26" font-weight="700" fill="#e4e9f2">${escapeXml(h.value)}</text>
  </g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04070c"/>
      <stop offset="100%" stop-color="#080d16"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#04070c" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(167,139,250,0.04)" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Top-left: slot pill -->
  <g transform="translate(80, 70)">
    <rect width="220" height="36" rx="18" fill="${glow}" stroke="${color}" stroke-opacity="0.4" stroke-width="1"/>
    <circle cx="20" cy="18" r="5" fill="${color}"/>
    <text x="38" y="24" font-family="monospace, JetBrains Mono" font-size="13" font-weight="700" fill="${color}" letter-spacing="2">${escapeXml(meta.label.toUpperCase())}</text>
  </g>

  <!-- Top-right: date + time -->
  <text x="1120" y="93" text-anchor="end" font-family="monospace, JetBrains Mono" font-size="14" fill="#8a9abc" letter-spacing="1">${escapeXml(dateStr)} · ${escapeXml(meta.fireTimeUTC)} UTC</text>

  <!-- Headline -->
  <text x="80" y="240" font-family="sans-serif, Instrument Sans" font-size="56" font-weight="700" fill="#e4e9f2" letter-spacing="-1.5">${escapeXml(headline)}</text>

  <!-- Desc -->
  <text x="80" y="290" font-family="sans-serif, Instrument Sans" font-size="22" fill="#8a9abc">${escapeXml(desc)}</text>

  ${chips}

  <!-- Brand footer-left -->
  <g transform="translate(80, 550)">
    <text font-family="monospace, JetBrains Mono" font-size="22" font-weight="700" fill="#e4e9f2" letter-spacing="-0.5">Agent<tspan fill="#ffc53d">Canary</tspan></text>
    <text x="0" y="28" font-family="monospace, JetBrains Mono" font-size="11" fill="#4a5a7a" letter-spacing="1.5">DECISION-GRADE MARKET INTELLIGENCE FOR AUTONOMOUS AI AGENTS</text>
  </g>

  <!-- Brand footer-right: domain -->
  <text x="1120" y="572" text-anchor="end" font-family="monospace, JetBrains Mono" font-size="13" fill="#8a9abc" letter-spacing="1">agentcanary.ai</text>
</svg>`;
}

export function renderOgPng(brief) {
  const svg = svgForBrief(brief);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'sans-serif',
    },
    background: '#04070c',
  });
  return resvg.render().asPng();
}

// Convenience: returns the per-brief PNG public URL (relative to site root)
export function ogPngPath(brief) {
  const slot = resolveSlot(brief);
  const date = brief.date;
  if (!date || !slot) return null;
  const [y, m, d] = date.split('-');
  return `/record/${y}/${m}/${d}/${slot}/og.png`;
}


// ─── Day-level OG card (one per /record/YYYY/MM/DD/) ─────────────────────

function _dayMeta(briefs) {
  const bySlot = {};
  for (const b of briefs || []) bySlot[resolveSlot(b)] = b;
  const wrap = bySlot.wrap || bySlot.pulse || bySlot.signal || bySlot.radar || (briefs && briefs[0]) || null;
  const radar = bySlot.radar || null;
  let regime = '';
  for (const b of (briefs || [])) { if (b.entities && b.entities.regime) { regime = b.entities.regime; break; } }
  let risk = null;
  if (radar) {
    const gp = (radar.panels || []).find(p => p.label === 'RISK GAUGE');
    if (gp && gp.gauge && gp.gauge.value != null) risk = gp.gauge.value;
  }
  let movers = [];
  for (const slot of ['wrap', 'pulse', 'signal']) {
    const b = bySlot[slot];
    if (!b) continue;
    const mp = (b.panels || []).find(p => p.label === 'TOP MOVERS');
    if (mp && mp.rows && mp.rows.length) { movers = mp.rows.slice(0, 4); break; }
  }
  return { regime, risk, movers, briefCount: (briefs || []).length };
}

function _riskColor(v) {
  const n = Number(v);
  if (isNaN(n)) return '#8a9abc';
  if (n < 30) return '#34d399';
  if (n < 60) return '#ffc53d';
  return '#f87171';
}

function svgForDay(date, briefs) {
  const [y, m, d] = date.split('-');
  const dateStr = m && d ? `${monthName(parseInt(m, 10))} ${parseInt(d, 10)}, ${y}` : date;
  const meta = _dayMeta(briefs);
  const dayDow = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const regimeLabel = meta.regime ? (meta.regime.charAt(0).toUpperCase() + meta.regime.slice(1)) : '';
  const riskColor = _riskColor(meta.risk);

  // Top movers — render up to 4 rows on the right side
  const moverRows = meta.movers.slice(0, 4).map((m, i) => {
    const color = m.c === 'red' ? '#f87171' : (m.c === 'green' ? '#34d399' : '#e4e9f2');
    return `
    <text x="0" y="${i * 38}" font-family="monospace, JetBrains Mono" font-size="20" font-weight="700" fill="#e4e9f2">${escapeXml(m.k || '')}</text>
    <text x="320" y="${i * 38}" text-anchor="end" font-family="monospace, JetBrains Mono" font-size="20" font-weight="700" fill="${color}">${escapeXml(m.v || '')}</text>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04070c"/>
      <stop offset="100%" stop-color="#080d16"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#ffc53d" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#04070c" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(167,139,250,0.04)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Top eyebrow -->
  <g transform="translate(80, 80)">
    <circle cx="6" cy="11" r="5" fill="#ffc53d"/>
    <text x="20" y="17" font-family="monospace, JetBrains Mono" font-size="13" font-weight="700" fill="#ffc53d" letter-spacing="2.5">THE RECORD · DAILY ARCHIVE</text>
  </g>

  <!-- Top right: brief count -->
  <text x="1120" y="97" text-anchor="end" font-family="monospace, JetBrains Mono" font-size="14" fill="#8a9abc" letter-spacing="1">${escapeXml(String(meta.briefCount))} brief${meta.briefCount === 1 ? '' : 's'} · ${escapeXml(dayDow)}</text>

  <!-- Big date headline -->
  <text x="80" y="230" font-family="sans-serif, Instrument Sans" font-size="76" font-weight="700" fill="#e4e9f2" letter-spacing="-2">${escapeXml(dateStr)}</text>
  <text x="80" y="280" font-family="sans-serif, Instrument Sans" font-size="24" fill="#8a9abc">The Record · all briefs published this day</text>

  <!-- Left: Risk gauge + phase -->
  <g transform="translate(80, 360)">
    <rect width="500" height="160" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <text x="32" y="38" font-family="monospace, JetBrains Mono" font-size="11" fill="#4a5a7a" letter-spacing="2.5" font-weight="700">DAY RISK GAUGE</text>
    ${meta.risk != null ? `
    <text x="32" y="106" font-family="monospace, JetBrains Mono" font-size="72" font-weight="700" fill="${riskColor}">${escapeXml(String(meta.risk))}</text>
    <text x="156" y="106" font-family="monospace, JetBrains Mono" font-size="22" fill="#8a9abc">/ 100</text>
    ` : `
    <text x="32" y="100" font-family="monospace, JetBrains Mono" font-size="36" fill="#4a5a7a">—</text>
    `}
    ${regimeLabel ? `
    <text x="32" y="140" font-family="monospace, JetBrains Mono" font-size="14" fill="#a78bfa" letter-spacing="2" font-weight="700">PHASE · ${escapeXml(regimeLabel.toUpperCase())}</text>
    ` : ''}
  </g>

  <!-- Right: Top movers -->
  ${meta.movers.length > 0 ? `
  <g transform="translate(640, 360)">
    <rect width="480" height="160" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <text x="32" y="38" font-family="monospace, JetBrains Mono" font-size="11" fill="#4a5a7a" letter-spacing="2.5" font-weight="700">TOP MOVERS · TODAY</text>
    <g transform="translate(32, 76)">${moverRows}</g>
  </g>
  ` : ''}

  <!-- Brand footer -->
  <g transform="translate(80, 555)">
    <text font-family="monospace, JetBrains Mono" font-size="22" font-weight="700" fill="#e4e9f2" letter-spacing="-0.5">Agent<tspan fill="#ffc53d">Canary</tspan></text>
    <text x="0" y="26" font-family="monospace, JetBrains Mono" font-size="11" fill="#4a5a7a" letter-spacing="1.5">DECISION-GRADE MARKET INTELLIGENCE FOR AUTONOMOUS AI AGENTS</text>
  </g>
  <text x="1120" y="577" text-anchor="end" font-family="monospace, JetBrains Mono" font-size="13" fill="#8a9abc" letter-spacing="1">agentcanary.ai</text>
</svg>`;
}

export function renderOgPngDay(date, briefs) {
  const svg = svgForDay(date, briefs);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
    background: '#04070c',
  });
  return resvg.render().asPng();
}

export function ogPngPathDay(date) {
  if (!date) return null;
  const [y, m, d] = date.split('-');
  return `/record/${y}/${m}/${d}/og.png`;
}
