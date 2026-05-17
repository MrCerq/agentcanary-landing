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
