#!/usr/bin/env node
// tools/build-record-v1.mjs — TIME-MACHINE-V1-SPEC implementation
//
// Generates the full URL hierarchy:
//   /record/index.html
//   /record/{YYYY}/index.html         (NEW)
//   /record/{YYYY/MM}/index.html      (NEW)
//   /record/{YYYY/MM/DD}/index.html
//   /record/{YYYY/MM/DD}/{slot}/index.html  (NEW)
//   /assets/{TICKER}/index.html       (NEW)
//   /regimes/{slug}/index.html        (NEW)
//   /record/feed.json
//   /record/rss.xml
//   /sitemap.xml
//
// Per spec §5 + §10.9.
//
// Reads briefs from /root/agentcanary-landing-data/briefs-archive.json
// (canonical, post-migration shape).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve('/root/agentcanary-landing-data');

const DRY = process.argv.includes('--dry');
const LIB = path.resolve(ROOT, 'lib');

// ─── Module imports (ESM dynamic so script stays a single file) ────

const renderUtils = await import(path.join(LIB, 'render-utils.mjs'));
const { renderCard, briefPermalink } = await import(path.join(LIB, 'card.mjs'));
const { renderIndex } = await import(path.join(LIB, 'page.mjs'));
const assetMapData = JSON.parse(fs.readFileSync(path.join(LIB, 'asset-map.json'), 'utf8'));
const assetMap = assetMapData.assets;
const { SLOTS, formatDate, monthName, resolveSlot, slotMeta } = renderUtils;

// ─── Data load ─────────────────────────────────────────────────────

console.log('[build-v1] Loading briefs-archive.json...');
const archive = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'briefs-archive.json'), 'utf8'));
if (!Array.isArray(archive)) {
  console.error('briefs-archive.json is not an array');
  process.exit(1);
}
console.log(`[build-v1] ${archive.length} briefs loaded`);

// Predictions (for scorecard)
let predictions = { predictions: [] };
const predictionsPath = path.join(ROOT, 'record', 'data', 'predictions.json');
if (fs.existsSync(predictionsPath)) {
  try {
    predictions = JSON.parse(fs.readFileSync(predictionsPath, 'utf8'));
  } catch (e) { console.error('predictions.json parse failed:', e.message); }
}

// ─── Index briefs ──────────────────────────────────────────────────

// Group briefs by date for day pages
const byDate = new Map();
for (const brief of archive) {
  if (!brief.date) continue;
  if (!byDate.has(brief.date)) byDate.set(brief.date, []);
  byDate.get(brief.date).push(brief);
}

// Sort dates desc
const allDates = [...byDate.keys()].sort().reverse();

// Group dates by year and month
const byYear = new Map();   // year → Set<month>
const byMonth = new Map();  // year-month → Set<date>
for (const d of allDates) {
  const [y, m] = d.split('-');
  if (!byYear.has(y)) byYear.set(y, new Set());
  byYear.get(y).add(m);
  const ym = `${y}-${m}`;
  if (!byMonth.has(ym)) byMonth.set(ym, new Set());
  byMonth.get(ym).add(d);
}

// Group briefs by asset + regime entity
const byAsset = new Map();   // TICKER → [brief...]
const byRegime = new Map();  // slug → [brief...]
for (const brief of archive) {
  if (!brief.entities) continue;
  for (const sym of (brief.entities.assets || [])) {
    if (!byAsset.has(sym)) byAsset.set(sym, []);
    byAsset.get(sym).push(brief);
  }
  if (brief.entities.regime) {
    if (!byRegime.has(brief.entities.regime)) byRegime.set(brief.entities.regime, []);
    byRegime.get(brief.entities.regime).push(brief);
  }
}

console.log(`[build-v1] Indexed: ${allDates.length} days · ${byYear.size} years · ${byMonth.size} months · ${byAsset.size} assets · ${byRegime.size} regimes`);

// ─── Writer ─────────────────────────────────────────────────────────

const writtenPaths = [];
function writeFile(relPath, content) {
  const fullPath = path.join(ROOT, relPath);
  if (DRY) {
    console.log(`  [DRY] would write ${relPath} (${content.length} bytes)`);
    writtenPaths.push(relPath);
    return;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  writtenPaths.push(relPath);
}

// ─── Scorecard (preserved from existing build-record.js, simplified) ───

function renderScorecard() {
  const all = predictions.predictions || [];
  if (all.length === 0) return '';
  const scored = all.filter(p => p.result && p.result !== 'pending' && p.result !== 'no_data');
  const hits = scored.filter(p => p.result === 'hit').length;
  const partials = scored.filter(p => p.result === 'partial').length;
  const misses = scored.filter(p => p.result === 'miss').length;
  const pending = all.filter(p => p.result === 'pending').length;
  const hitRate = scored.length > 0 ? Math.round((hits / scored.length) * 100) : 0;
  return `<div class="ac-scorecard mono" style="font-size:13px;color:#8a9abc;margin-bottom:24px;padding:16px 20px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;background:rgba(255,255,255,0.02)">
    <span style="color:#e4e9f2;font-weight:700">${all.length}</span> conditional predictions ·
    <span style="color:${hitRate >= 50 ? '#34d399' : '#ffc53d'};font-weight:700">${hitRate}%</span> best-scenario hit rate ·
    <span style="color:#ffc53d">${partials}</span> partial ·
    <span style="color:#f87171">${misses}</span> miss
    ${pending > 0 ? `· <span style="color:#4a5a7a">${pending} pending</span>` : ''}
    <div style="margin-top:8px;font-size:10px;color:#4a5a7a">Scoring rules being upgraded in v2 — interpret current numbers as coverage, not skill.</div>
  </div>`;
}

// ─── Build pages ────────────────────────────────────────────────────

// 1. /record/ (collection)
console.log('[build-v1] /record/ (collection)');
{
  const days = allDates.slice(0, 7).map(date => ({
    date,
    briefs: byDate.get(date).slice().sort((a, b) =>
      SLOTS.indexOf(resolveSlot(a)) - SLOTS.indexOf(resolveSlot(b))),
  }));
  const html = renderIndex({
    type: 'collection',
    days,
    scorecardHtml: renderScorecard(),
  });
  writeFile('record/index.html', html);
}

// 2. /record/{YYYY}/
for (const [year, monthSet] of byYear) {
  const months = [...monthSet].sort().reverse().map(m => ({
    month: parseInt(m, 10),
    briefCount: byMonth.get(`${year}-${m}`)
      ? [...byMonth.get(`${year}-${m}`)].reduce((acc, d) => acc + byDate.get(d).length, 0)
      : 0,
  }));
  const html = renderIndex({ type: 'year', year: parseInt(year, 10), months });
  writeFile(`record/${year}/index.html`, html);
}

// 3. /record/{YYYY/MM}/
for (const [ym, dateSet] of byMonth) {
  const [year, month] = ym.split('-');
  const days = [...dateSet].sort().reverse().map(d => {
    const briefs = byDate.get(d);
    const regime = briefs.find(b => b.entities && b.entities.regime)?.entities.regime;
    return { date: d, briefCount: briefs.length, regime };
  });
  const html = renderIndex({ type: 'month', year: parseInt(year, 10), month, days });
  writeFile(`record/${year}/${month}/index.html`, html);
}

// 4. /record/{YYYY/MM/DD}/ + 5. /record/{YYYY/MM/DD}/{slot}/
const allDatesSorted = allDates.slice().sort();  // asc for prev/next
for (let i = 0; i < allDatesSorted.length; i++) {
  const date = allDatesSorted[i];
  const briefs = byDate.get(date);
  const [year, month, day] = date.split('-');
  const prevDate = i > 0 ? allDatesSorted[i - 1] : null;
  const nextDate = i < allDatesSorted.length - 1 ? allDatesSorted[i + 1] : null;

  // Day page
  const dayHtml = renderIndex({
    type: 'day', date, briefs, prevDate, nextDate, assetMap,
  });
  writeFile(`record/${year}/${month}/${day}/index.html`, dayHtml);

  // Per-brief permalinks
  for (const brief of briefs) {
    const slot = resolveSlot(brief);
    if (!slot) continue;
    const meta = slotMeta(slot);
    // Find prev/next same-slot briefs in chronological order
    const sameSlot = archive
      .filter(b => resolveSlot(b) === slot)
      .sort((a, b) => a.date.localeCompare(b.date));
    const idx = sameSlot.findIndex(b => b.date === date);
    const prev = idx > 0 ? sameSlot[idx - 1] : null;
    const next = idx < sameSlot.length - 1 ? sameSlot[idx + 1] : null;
    const cardHtml = renderCard(brief, 'page', { assetMap });
    const breadcrumb = [
      { name: 'The Record', href: '/record/' },
      { name: year, href: `/record/${year}/` },
      { name: monthName(parseInt(month, 10)), href: `/record/${year}/${month}/` },
      { name: `${monthName(parseInt(month, 10))} ${parseInt(day, 10)}, ${year}`, href: `/record/${year}/${month}/${day}/` },
      { name: meta.label },
    ];
    const html = wrapBriefPage({
      brief, slot, meta,
      breadcrumb,
      prev, next,
      cardHtml,
    });
    writeFile(`record/${year}/${month}/${day}/${slot}/index.html`, html);
  }
}

// 6. /assets/{TICKER}/
let assetPagesWritten = 0;
for (const [ticker, briefs] of byAsset) {
  briefs.sort((a, b) => b.date.localeCompare(a.date));
  const mentions = briefs.map(b => {
    const slot = resolveSlot(b);
    const meta = slot ? slotMeta(slot) : null;
    return {
      headline: b.headline,
      date: b.date,
      slotLabel: meta?.label || '',
      permalink: briefPermalink(b, slot),
    };
  });
  const html = renderIndex({ type: 'asset', ticker, mentions });
  writeFile(`assets/${ticker}/index.html`, html);
  assetPagesWritten++;
}

// 7. /regimes/{slug}/
let regimePagesWritten = 0;
for (const [slug, briefs] of byRegime) {
  briefs.sort((a, b) => b.date.localeCompare(a.date));
  const mentions = briefs.map(b => {
    const slot = resolveSlot(b);
    const meta = slot ? slotMeta(slot) : null;
    return {
      headline: b.headline,
      date: b.date,
      slotLabel: meta?.label || '',
      permalink: briefPermalink(b, slot),
    };
  });
  const html = renderIndex({ type: 'regime', slug, mentions });
  writeFile(`regimes/${slug}/index.html`, html);
  regimePagesWritten++;
}

// 8. sitemap.xml
console.log('[build-v1] sitemap.xml');
{
  const urls = [
    { loc: 'https://agentcanary.ai/', priority: '1.0' },
    { loc: 'https://agentcanary.ai/record/', priority: '1.0' },
  ];
  for (const year of byYear.keys()) urls.push({ loc: `https://agentcanary.ai/record/${year}/`, priority: '0.7' });
  for (const ym of byMonth.keys()) {
    const [y, m] = ym.split('-');
    urls.push({ loc: `https://agentcanary.ai/record/${y}/${m}/`, priority: '0.6' });
  }
  for (const date of allDates) {
    const [y, m, d] = date.split('-');
    urls.push({ loc: `https://agentcanary.ai/record/${y}/${m}/${d}/`, priority: '0.8' });
    for (const brief of byDate.get(date)) {
      const slot = resolveSlot(brief);
      if (slot) urls.push({ loc: `https://agentcanary.ai/record/${y}/${m}/${d}/${slot}/`, priority: '0.7' });
    }
  }
  for (const [ticker, briefs] of byAsset) {
    if (briefs.length >= 3) urls.push({ loc: `https://agentcanary.ai/assets/${ticker}/`, priority: briefs.length >= 10 ? '0.7' : '0.5' });
  }
  for (const slug of byRegime.keys()) {
    urls.push({ loc: `https://agentcanary.ai/regimes/${slug}/`, priority: '0.5' });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  writeFile('sitemap.xml', xml);
}

// ─── Report ────────────────────────────────────────────────────────

console.log(`\n[build-v1] ${DRY ? 'DRY-RUN' : 'COMMIT'} complete.`);
console.log(`  ${writtenPaths.length} files written`);
console.log(`  - ${allDates.length} day pages`);
console.log(`  - ${[...byYear.keys()].length} year pages`);
console.log(`  - ${[...byMonth.keys()].length} month pages`);
console.log(`  - ${archive.length} per-brief permalinks`);
console.log(`  - ${assetPagesWritten} asset pages`);
console.log(`  - ${regimePagesWritten} regime pages`);
console.log(`  - 1 sitemap`);

// ─── Helpers ────────────────────────────────────────────────────────

function wrapBriefPage(opts) {
  const { brief, slot, meta, breadcrumb, prev, next, cardHtml } = opts;
  const url = `https://agentcanary.ai${briefPermalink(brief, slot)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: brief.headline,
    description: brief.desc,
    datePublished: brief.publishedAt,
    dateModified: brief.publishedAt,
    url,
    author: { '@id': 'https://agentcanary.ai/#org' },
    publisher: { '@type': 'Organization', name: 'AgentCanary', url: 'https://agentcanary.ai' },
    keywords: (brief.tags || []).map(t => t.t).join(', '),
    articleSection: 'Market Intelligence',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name,
        ...(c.href ? { item: `https://agentcanary.ai${c.href}` } : {}),
      })),
    },
  };
  const breadcrumbHtml = `<nav class="ac-breadcrumb" aria-label="Breadcrumb">${
    breadcrumb.map((c, i) => c.href
      ? `<a href="${c.href}">${c.name}</a>`
      : `<span style="color:#e4e9f2">${c.name}</span>`
    ).join(' <span style="color:#4a5a7a">/</span> ')
  }</nav>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.label} — ${formatDate(brief.date)} | The Record | AgentCanary</title>
<meta name="description" content="${(brief.desc || '').replace(/"/g, '&quot;')}">
<link rel="canonical" href="${url}">
${prev ? `<link rel="prev" href="${briefPermalink(prev, slot)}">` : ''}
${next ? `<link rel="next" href="${briefPermalink(next, slot)}">` : ''}
<meta property="og:title" content="${meta.label} — ${formatDate(brief.date)}">
<meta property="og:description" content="${(brief.desc || '').replace(/"/g, '&quot;')}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="AgentCanary">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/feed+json" href="/record/feed.json" title="The Record (JSON Feed)">
<link rel="alternate" type="application/rss+xml" href="/record/rss.xml" title="The Record (RSS)">
<link rel="ai-info" href="/llms.txt">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/card.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<div class="ac-page-container">
  ${breadcrumbHtml}
  <h1>${meta.label} — ${formatDate(brief.date)}</h1>
  ${cardHtml}
</div>
</body>
</html>`;
}
