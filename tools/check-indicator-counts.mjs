#!/usr/bin/env node
/**
 * check-indicator-counts.mjs — drift check across deployed agent surfaces.
 *
 * Compares the authoritative count from agentcanary-backend/routes/indicators.js
 * (INDICATORS object literal) against the number stated in:
 *   - /root/agentcanary-landing/llms.txt (2 mentions)
 *   - /root/agentcanary-landing/.well-known/mcp.json (get_indicators description)
 *   - /root/agentcanary-landing/.well-known/ai-plugin.json (description_for_model)
 *
 * Exits 0 on consistent; prints WARN lines if any drift. Designed to be cheap
 * (~50ms) so it runs on every sync-record.sh build cycle (3-hourly cron).
 *
 * Non-blocking: warnings only, never exits non-zero — avoids breaking the
 * landing rebuild when the catalog grows but the manifests haven't been
 * touched yet (operator-side updates).
 */
import fs from 'node:fs';

const BACKEND_INDICATORS = '/root/agentcanary-backend/routes/indicators.js';
const LLMS_TXT = '/root/agentcanary-landing/llms.txt';
const MCP_JSON = '/root/agentcanary-landing/.well-known/mcp.json';
const AI_PLUGIN_JSON = '/root/agentcanary-landing/.well-known/ai-plugin.json';

function countCatalog() {
  const src = fs.readFileSync(BACKEND_INDICATORS, 'utf8');
  const m = src.match(/const INDICATORS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return null;
  const entries = m[1].match(/^\s*['"][a-zA-Z][a-zA-Z0-9_-]*['"]\s*:/gm);
  return entries ? entries.length : 0;
}

function extractCountsFrom(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  // Pattern: "N+ proprietary indicators" or "N proprietary indicators" or "N market indicators" or "N indicators:"
  const matches = [...src.matchAll(/(\d+)\+?\s*(?:proprietary\s+)?(?:market\s+)?indicators?(?:[:\s]|\b)/gi)];
  return matches.map(m => ({ stated: parseInt(m[1], 10), context: m[0] }));
}

const actual = countCatalog();
if (actual === null) {
  console.log('[check-indicators] WARN: could not parse INDICATORS object from backend');
  process.exit(0);
}

console.log(`[check-indicators] authoritative catalog: ${actual} indicators`);

const surfaces = [
  ['llms.txt', LLMS_TXT],
  ['.well-known/mcp.json', MCP_JSON],
  ['.well-known/ai-plugin.json', AI_PLUGIN_JSON],
];

let drift = 0;
for (const [name, path] of surfaces) {
  const counts = extractCountsFrom(path);
  for (const c of counts) {
    // Skip the "+44 more" / "+N more" hedge suffix matches — those describe
    // remaining-after-named-examples, not the total.
    if (/\+\s*\d+\s+more/i.test(c.context)) continue;
    if (c.stated !== actual) {
      console.log(`[check-indicators] WARN ${name}: states ${c.stated} indicators, actual catalog has ${actual} ("${c.context.trim()}")`);
      drift++;
    }
  }
}

if (drift === 0) {
  console.log('[check-indicators] all surfaces consistent ✓');
}
process.exit(0);
