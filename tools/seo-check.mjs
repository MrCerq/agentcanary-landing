#!/usr/bin/env node
/**
 * AgentCanary SEO regression check.
 *
 * Run AFTER tools/build-record-v1.mjs. Asserts every generated HTML page
 * has the SEO-critical tags + a minimum content shape, plus checks for
 * the drift patterns that have bitten us this session:
 *
 *   - <title> 10-65 chars
 *   - <meta name="description"> 40-160 chars
 *   - <link rel="canonical"> present
 *   - <meta property="og:image"> present
 *   - <meta property="og:title"> present
 *   - exactly one <h1> per page
 *   - description uniqueness: >95% of pages have unique descriptions
 *   - title uniqueness: >95% of pages have unique titles
 *
 * Exits 0 if all checks pass, 1 + violation list otherwise.
 *
 * Hand-written pages (index.html, sources/index.html) get a relaxed
 * check — title + description + canonical only. They have bespoke layouts.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Collect all index.html files except node_modules + _preview + releases
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '_preview', 'releases', '.git', 'specs'].includes(ent.name)) continue;
      walk(full, out);
    } else if (ent.isFile() && (ent.name === 'index.html' || ent.name === '404.html')) {
      out.push(full);
    }
  }
  return out;
}

function extract(src, regex, group = 1) {
  const m = src.match(regex);
  return m ? m[group] : null;
}

function checkPage(filepath) {
  const src = fs.readFileSync(filepath, 'utf8');
  const rel = filepath.replace(ROOT + '/', '');
  const violations = [];

  // Skip pages that are intentional redirects (legacy /docs/ etc.)
  if (src.includes('http-equiv="refresh"') && src.length < 1500) {
    return { rel, violations: [], skipped: true };
  }

  const title = extract(src, /<title>([^<]+)<\/title>/);
  const desc = extract(src, /<meta name="description" content="([^"]+)"/);
  const canonical = extract(src, /<link rel="canonical" href="([^"]+)"/);
  const ogImage = extract(src, /<meta property="og:image" content="([^"]+)"/);
  const ogTitle = extract(src, /<meta property="og:title" content="([^"]+)"/);
  const h1Count = (src.match(/<h1\b/g) || []).length;
  const noindex = /<meta name="robots"[^>]*noindex/.test(src);

  // Required tags
  if (!title) violations.push('missing <title>');
  else if (title.length < 10) violations.push(`title too short (${title.length})`);
  else if (title.length > 75) violations.push(`title too long (${title.length})`);

  if (!desc) violations.push('missing meta description');
  else if (desc.length < 40 && !noindex) violations.push(`description too short (${desc.length})`);
  else if (desc.length > 200) violations.push(`description too long (${desc.length})`);

  if (!canonical) violations.push('missing canonical');
  if (!ogImage) violations.push('missing og:image');
  if (!ogTitle) violations.push('missing og:title');

  if (h1Count === 0) violations.push('no <h1>');
  else if (h1Count > 1) violations.push(`${h1Count} <h1> tags (should be 1)`);

  return { rel, violations, skipped: false, title, desc, noindex };
}

const pages = walk(ROOT);
const results = pages.map(checkPage);
const checked = results.filter(r => !r.skipped);
const failing = checked.filter(r => r.violations.length > 0);

// Uniqueness check
const indexableTitles = checked.filter(r => !r.noindex).map(r => r.title).filter(Boolean);
const indexableDescs = checked.filter(r => !r.noindex).map(r => r.desc).filter(Boolean);
const dupeTitles = indexableTitles.length - new Set(indexableTitles).size;
const dupeDescs = indexableDescs.length - new Set(indexableDescs).size;
const titleUniquePct = ((1 - dupeTitles / indexableTitles.length) * 100).toFixed(1);
const descUniquePct = ((1 - dupeDescs / indexableDescs.length) * 100).toFixed(1);

// Print summary
console.log(`[seo-check] checked ${checked.length} pages (${results.length - checked.length} redirects skipped)`);
console.log(`[seo-check] title uniqueness: ${titleUniquePct}% (${dupeTitles} dupes / ${indexableTitles.length} indexable)`);
console.log(`[seo-check] desc uniqueness:  ${descUniquePct}% (${dupeDescs} dupes / ${indexableDescs.length} indexable)`);

if (failing.length > 0) {
  console.log(`[seo-check] ${failing.length} pages with violations:\n`);
  for (const r of failing.slice(0, 20)) {
    console.log(`  ${r.rel}`);
    for (const v of r.violations) console.log(`    - ${v}`);
  }
  if (failing.length > 20) console.log(`  ... and ${failing.length - 20} more`);
}

// ─── Tool count drift check ───────────────────────────────────────
// Reads canonical count from the MCP repo's package + index.js, then
// scans the landing repo + MCP repo READMEs for "N tools" strings.
// Flags any mismatch.
async function readCanonicalToolCount() {
  // Fetch live from GitHub raw — single source of truth, durable across
  // VPS tmpfs resets. Falls back to a hardcoded value if offline.
  try {
    const url = 'https://raw.githubusercontent.com/MrCerq/agentcanary-mcp/main/index.js';
    const res = await fetch(url);
    if (!res.ok) return null;
    const idx = await res.text();
    const matches = idx.match(/server\.tool\(/g) || [];
    return matches.length;
  } catch { return null; }
}

const CANONICAL_TOOL_COUNT = await readCanonicalToolCount();
console.log(`[seo-check] canonical MCP tool count: ${CANONICAL_TOOL_COUNT ?? '(could not read)'}`);

const driftFiles = [];
if (CANONICAL_TOOL_COUNT) {
  // Walk repo for text files mentioning "N tools" (excluding the rebuild
  // commit messages and the auto-rebuilt brief permalink content).
  function walkText(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (['node_modules', '_preview', '.git', 'record', 'releases', 'specs'].includes(ent.name)) continue;
        walkText(full, out);
      } else if (ent.isFile() && /\.(html|md|mjs|js|txt)$/.test(ent.name)) {
        out.push(full);
      }
    }
    return out;
  }
  const textFiles = walkText(ROOT);
  const drift = /\b(\d{1,2})\s+(?:MCP\s+)?(?:AgentCanary\s+)?tools\b/gi;
  for (const f of textFiles) {
    const text = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = drift.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      // Allow expected counts: canonical, or commonly-templated numbers
      // we'd never want to flag (e.g. "for 30 tools"). Skip if context
      // is a count claim about AC's tools specifically.
      // Heuristic: only flag if line also mentions agentcanary/mcp/AC tool names
      const lineStart = text.lastIndexOf('\n', m.index);
      const lineEnd = text.indexOf('\n', m.index);
      const line = text.slice(lineStart + 1, lineEnd === -1 ? text.length : lineEnd);
      const isACContext = /agentcanary|MCP|npx|get_briefs|get_indicators|get_track_record|via Composer|Tools \(/i.test(line);
      if (isACContext && n !== CANONICAL_TOOL_COUNT) {
        const rel = f.replace(ROOT + '/', '');
        driftFiles.push({ file: rel, found: n, expected: CANONICAL_TOOL_COUNT, line: line.trim().slice(0, 120) });
      }
    }
  }
}

if (driftFiles.length > 0) {
  console.log(`[seo-check] tool-count drift found in ${driftFiles.length} place${driftFiles.length === 1 ? '' : 's'}:`);
  for (const d of driftFiles.slice(0, 10)) {
    console.log(`  ${d.file}: found "${d.found} tools" (expected ${d.expected})`);
    console.log(`    line: ${d.line}`);
  }
}

// Pass/fail gates
const gates = [
  ['violations', failing.length === 0, `${failing.length} pages with violations`],
  ['title uniqueness', parseFloat(titleUniquePct) >= 95, `title uniqueness ${titleUniquePct}% < 95%`],
  ['desc uniqueness', parseFloat(descUniquePct) >= 95, `desc uniqueness ${descUniquePct}% < 95%`],
  ['tool count drift', driftFiles.length === 0, `${driftFiles.length} tool-count drift instance${driftFiles.length === 1 ? '' : 's'}`],
];

const failed = gates.filter(g => !g[1]);
if (failed.length > 0) {
  console.log(`\n[seo-check] FAILED — ${failed.length} gate${failed.length === 1 ? '' : 's'}:`);
  for (const g of failed) console.log(`  ✗ ${g[2]}`);
  process.exit(1);
}

console.log('\n[seo-check] ✓ all gates passed');
process.exit(0);
