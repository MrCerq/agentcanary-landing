#!/usr/bin/env node
// One-off: generate a new homepage og-image.png leading with proof.
// Mirrors site dark theme (grid bg + glow). Reads canonical counts so
// market-context-layer positioning.

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '/root/agentcanary-landing/node_modules/@resvg/resvg-js/index.js';

const ROOT = '/root/agentcanary-landing';
// Static coverage counts (market-context-layer positioning, 2026-06-08).
const toolCount = '19';
const indicatorCount = '36';

const W = 1200, H = 630;

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// SVG: dark background, subtle grid, two corner glows, brand top-left,
// hero in center-upper, 3 proof chips in lower half, url bottom-right.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
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

  <!-- background -->
  <rect width="${W}" height="${H}" fill="#0a0e1a"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glowTL)"/>
  <rect width="${W}" height="${H}" fill="url(#glowBR)"/>

  <!-- brand -->
  <g transform="translate(80, 90)">
    <text x="0" y="0" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#e4e9f2">
      Agent<tspan fill="#ffc53d">Canary</tspan>
    </text>
  </g>

  <!-- eyebrow -->
  <text x="80" y="200" font-family="monospace, JetBrains Mono" font-size="14" letter-spacing="3" font-weight="700" fill="#ffc53d">
    MARKET CONTEXT LAYER · REST + MCP
  </text>

  <!-- hero headline -->
  <text x="80" y="270" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">
    Market context state
  </text>
  <text x="80" y="335" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">
    for AI agents, <tspan fill="#ffc53d" font-style="italic">fresh on every call.</tspan>
  </text>

  <!-- proof row: 3 chips -->
  <g transform="translate(80, 410)">
    <!-- chip 1: predictions scored -->
    <rect x="0" y="0" width="320" height="120" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="24" y="38" font-family="monospace, JetBrains Mono" font-size="11" letter-spacing="2.5" font-weight="700" fill="#7a8aa0">MCP TOOLS</text>
    <text x="24" y="92" font-family="monospace, JetBrains Mono" font-size="44" font-weight="700" fill="#ffffff">${escapeXml(toolCount)}</text>

    <!-- chip 2: brier vs baseline -->
    <rect x="345" y="0" width="320" height="120" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="369" y="38" font-family="monospace, JetBrains Mono" font-size="11" letter-spacing="2.5" font-weight="700" fill="#7a8aa0">INDICATORS</text>
    <text x="369" y="92" font-family="monospace, JetBrains Mono" font-size="44" font-weight="700" fill="#ffffff">${escapeXml(indicatorCount)}</text>

    <!-- chip 3: MCP tools -->
    <rect x="690" y="0" width="320" height="120" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="714" y="38" font-family="monospace, JetBrains Mono" font-size="11" letter-spacing="2.5" font-weight="700" fill="#7a8aa0">DATASETS</text>
    <text x="714" y="92" font-family="monospace, JetBrains Mono" font-size="44" font-weight="700" fill="#ffffff">44</text>
  </g>

  <!-- url + tagline -->
  <text x="80" y="585" font-family="monospace, JetBrains Mono" font-size="14" font-weight="500" fill="#7a8aa0">
    agentcanary.ai · npx agentcanary-mcp · REST + MCP, wallet-billed, no KYC
  </text>
</svg>`;

const resvg = new Resvg(svg, {
  background: '#0a0e1a',
  fitTo: { mode: 'width', value: W },
});
const png = resvg.render().asPng();

const outPath = '/tmp/og-image-preview.png';
fs.writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
console.log(`stats: tools=${toolCount}  indicators=${indicatorCount}  datasets=44`);
