// agentcanary-landing/lib/page.mjs
// Canonical index-page renderer for The Record time machine.
// Per TIME-MACHINE-V1-SPEC.md §5 (per-page-type requirements) + §7.
//
// renderIndex({ type, title, ...opts }) → string
//   type ∈ 'collection' | 'year' | 'month' | 'day' | 'asset' | 'regime'
//
// The 'day' type is handled here because day pages are MORE than a
// container of cards — they have their own h1 / breadcrumb / JSON-LD.
// The cards within a day-page are rendered via card.mjs at 'page' tier.

import { escapeHtml, formatDate, monthName, SLOTS, resolveSlot, slotMeta } from './render-utils.mjs';
import { renderCard, briefPermalink } from './card.mjs';

// ─── Public API ───────────────────────────────────────────────────

export function renderIndex(opts) {
  if (!opts || !opts.type) throw new Error('renderIndex: { type } required');
  switch (opts.type) {
    case 'collection': return renderCollection(opts);
    case 'year':       return renderYear(opts);
    case 'month':      return renderMonth(opts);
    case 'day':        return renderDay(opts);
    case 'asset':      return renderAsset(opts);
    case 'regime':     return renderRegime(opts);
    default: throw new Error('renderIndex: unknown type "' + opts.type + '"');
  }
}

// ─── Breadcrumb ───────────────────────────────────────────────────

function renderBreadcrumb(crumbs) {
  // crumbs: [{ name, href? }] — last entry has no href (current page).
  const parts = crumbs.map((c, i) => {
    if (c.href) return `<a href="${escapeHtml(c.href)}" style="color:#8a9abc">${escapeHtml(c.name)}</a>`;
    return `<span style="color:#e4e9f2">${escapeHtml(c.name)}</span>`;
  });
  return `<nav class="ac-breadcrumb" aria-label="Breadcrumb" style="display:flex;gap:8px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;margin-bottom:0">${parts.join('<span style="color:#4a5a7a">/</span>')}</nav>`;
}

function jsonLdBreadcrumb(crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: `https://agentcanary.ai${c.href}` } : {}),
    })),
  };
}

// ─── Collection (/record/) ────────────────────────────────────────

function renderCollection(opts) {
  const days = opts.days || []; // [{ date, briefs: [...] }]
  const recentDays = days.slice(0, 7);
  const breadcrumb = [{ name: 'The Record' }];
  const tilesHtml = recentDays.map(day => renderDayTile(day)).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Record — AgentCanary',
    url: 'https://agentcanary.ai/record/',
    description: 'Daily macro intelligence briefs. Time-stamped record of market state with scored predictions.',
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: recentDays.length,
      itemListElement: recentDays.map((day, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://agentcanary.ai/record/${day.date.replace(/-/g, '/')}/`,
        name: formatDate(day.date),
      })),
    },
  };
  return wrapPage({
    title: 'The Record — AgentCanary',
    metaDescription: opts.metaDescription || 'Market intelligence with receipts. Daily macro briefs with regime tracking and scored predictions.',
    canonical: 'https://agentcanary.ai/record/',
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    h1: 'The Record',
    bodyHtml: `
      <p class="ac-collection-desc" style="font-size:16px;color:#8a9abc;line-height:1.7;margin-bottom:32px;max-width:720px">Every call. Every day. Scored. A time-stamped record of market intelligence — macro regime, risk gauge, signals, scenarios.</p>
      ${opts.scorecardHtml || ''}
      <h2 style="font-size:18px;font-weight:700;margin:32px 0 16px;color:#e4e9f2">Latest briefs</h2>
      <div class="ac-collection-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px">${tilesHtml}</div>
      ${opts.archiveLinkHtml || `<p style="margin-top:32px"><a href="/record/2026/" style="color:#ffc53d;text-decoration:underline">Browse full archive →</a></p>`}
    `,
  });
}

// ─── Year (/record/{YYYY}/) ──────────────────────────────────────

function renderYear(opts) {
  const year = opts.year;
  if (!year) throw new Error('renderYear: { year } required');
  const months = opts.months || []; // [{ month: 1-12, briefCount }]
  const breadcrumb = [
    { name: 'The Record', href: '/record/' },
    { name: String(year) },
  ];
  const monthsHtml = months.map(m => `
    <a href="/record/${year}/${String(m.month).padStart(2, '0')}/" style="display:block;padding:20px;border:1px solid rgba(255,255,255,0.06);border-radius:12px;background:rgba(255,255,255,0.02);text-decoration:none;color:inherit;transition:border-color 0.2s">
      <div style="font-size:18px;font-weight:700;color:#e4e9f2;margin-bottom:6px">${escapeHtml(monthName(m.month))}</div>
      <div class="mono" style="font-size:12px;color:#8a9abc">${m.briefCount || 0} brief${m.briefCount === 1 ? '' : 's'}</div>
    </a>
  `).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${year} — The Record`,
    url: `https://agentcanary.ai/record/${year}/`,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
  };
  return wrapPage({
    title: `${year} — The Record | AgentCanary`,
    metaDescription: `Daily macro briefs published in ${year}. ${months.reduce((s, m) => s + (m.briefCount || 0), 0)} briefs across ${months.length} months.`,
    canonical: `https://agentcanary.ai/record/${year}/`,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    h1: `${year} — The Record`,
    bodyHtml: `<div class="ac-year-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px">${monthsHtml}</div>`,
  });
}

// ─── Month (/record/{YYYY/MM}/) ──────────────────────────────────

function renderMonth(opts) {
  const { year, month } = opts;
  if (!year || !month) throw new Error('renderMonth: { year, month } required');
  const days = opts.days || []; // [{ date, briefCount, regime }]
  const breadcrumb = [
    { name: 'The Record', href: '/record/' },
    { name: String(year), href: `/record/${year}/` },
    { name: monthName(parseInt(month, 10)) },
  ];
  const daysHtml = days.map(d => {
    const dn = parseInt(d.date.slice(8), 10);
    return `<a href="/record/${d.date.replace(/-/g, '/')}/" style="display:block;padding:16px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;background:rgba(255,255,255,0.02);text-decoration:none;color:inherit">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:16px;font-weight:700;color:#e4e9f2">${dn}</div>
        ${d.regime ? `<span class="mono" style="font-size:10px;color:#60a5fa">${escapeHtml(d.regime.toUpperCase())}</span>` : ''}
      </div>
      <div class="mono" style="font-size:11px;color:#8a9abc">${d.briefCount || 0} brief${d.briefCount === 1 ? '' : 's'}</div>
    </a>`;
  }).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${monthName(parseInt(month, 10))} ${year} — The Record`,
    url: `https://agentcanary.ai/record/${year}/${month}/`,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
  };
  return wrapPage({
    title: `${monthName(parseInt(month, 10))} ${year} — The Record | AgentCanary`,
    metaDescription: `Daily macro briefs published in ${monthName(parseInt(month, 10))} ${year}. ${days.length} days, ${days.reduce((s, d) => s + (d.briefCount || 0), 0)} briefs.`,
    canonical: `https://agentcanary.ai/record/${year}/${month}/`,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    h1: `${monthName(parseInt(month, 10))} ${year} — The Record`,
    bodyHtml: `<div class="ac-month-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px">${daysHtml}</div>`,
  });
}

// ─── Day (/record/{YYYY/MM/DD}/) ─────────────────────────────────

function renderDay(opts) {
  const { date, briefs } = opts;
  if (!date || !Array.isArray(briefs)) throw new Error('renderDay: { date, briefs[] } required');
  const [year, month, day] = date.split('-');
  const breadcrumb = [
    { name: 'The Record', href: '/record/' },
    { name: year, href: `/record/${year}/` },
    { name: monthName(parseInt(month, 10)), href: `/record/${year}/${month}/` },
    { name: `${monthName(parseInt(month, 10))} ${parseInt(day, 10)}, ${year}` },
  ];
  // Sort briefs by slot order (radar, signal, pulse, wrap).
  const sortedBriefs = briefs.slice().sort((a, b) => {
    return SLOTS.indexOf(resolveSlot(a)) - SLOTS.indexOf(resolveSlot(b));
  });
  const cardsHtml = sortedBriefs.map(b => renderCard(b, 'page', { assetMap: opts.assetMap })).join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${formatDate(date)} — The Record`,
    url: `https://agentcanary.ai/record/${year}/${month}/${day}/`,
    datePublished: date,
    dateModified: date,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: sortedBriefs.length,
      itemListElement: sortedBriefs.map((b, i) => {
        const slot = resolveSlot(b);
        const meta = slotMeta(slot);
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'NewsArticle',
            headline: b.headline,
            description: b.desc,
            datePublished: b.publishedAt || `${date}T${meta.fireTimeUTC}:00Z`,
            url: `https://agentcanary.ai${briefPermalink(b, slot)}`,
            author: { '@id': 'https://agentcanary.ai/#org' },
            publisher: { '@type': 'Organization', name: 'AgentCanary', url: 'https://agentcanary.ai' },
            keywords: (b.tags || []).map(t => t.t).join(', '),
          },
        };
      }),
    },
  };
  // Visible day-nav arrows (top-right of page header). Mirrors rel=prev/next.
  const navParts = [];
  if (opts.prevDate) {
    navParts.push(`<a class="ac-day-nav-prev" href="/record/${opts.prevDate.replace(/-/g, '/')}/" rel="prev" title="${escapeHtml(formatDate(opts.prevDate))}">← ${escapeHtml(opts.prevDate.slice(5).replace('-', '/'))}</a>`);
  }
  if (opts.nextDate) {
    navParts.push(`<a class="ac-day-nav-next" href="/record/${opts.nextDate.replace(/-/g, '/')}/" rel="next" title="${escapeHtml(formatDate(opts.nextDate))}">${escapeHtml(opts.nextDate.slice(5).replace('-', '/'))} →</a>`);
  }
  const topRightHtml = navParts.length > 0 ? `<nav class="ac-day-nav" aria-label="Day navigation" style="display:flex;gap:12px;font-family:'JetBrains Mono',monospace;font-size:12px">${navParts.join('')}</nav>` : '';

  return wrapPage({
    title: `${formatDate(date)} — The Record | AgentCanary`,
    metaDescription: `${sortedBriefs.length} market intelligence brief${sortedBriefs.length === 1 ? '' : 's'} for ${formatDate(date)}. ${sortedBriefs[0]?.headline || ''}`,
    canonical: `https://agentcanary.ai/record/${year}/${month}/${day}/`,
    prev: opts.prevDate ? `/record/${opts.prevDate.replace(/-/g, '/')}/` : null,
    next: opts.nextDate ? `/record/${opts.nextDate.replace(/-/g, '/')}/` : null,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    topRightHtml,
    h1: `${formatDate(date)} — The Record`,
    bodyHtml: cardsHtml,
  });
}

// ─── Asset (/assets/{TICKER}/) ───────────────────────────────────

function renderAsset(opts) {
  const { ticker, mentions } = opts;
  if (!ticker || !Array.isArray(mentions)) throw new Error('renderAsset: { ticker, mentions[] } required');
  const noindex = mentions.length < 3;
  const breadcrumb = [
    { name: 'Assets', href: '/assets/' },
    { name: ticker },
  ];
  const mentionsHtml = mentions.map(m => `
    <h2 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#e4e9f2"><a href="${escapeHtml(m.permalink)}" style="color:inherit;text-decoration:none;border-bottom:1px solid #4a5a7a">${escapeHtml(m.headline)}</a></h2>
    <p class="mono" style="font-size:11px;color:#8a9abc;margin-bottom:8px">${escapeHtml(m.date)} · ${escapeHtml(m.slotLabel || '')}</p>
    ${m.snippetHtml ? `<blockquote style="margin:0 0 16px;padding-left:16px;border-left:2px solid #4a5a7a;color:#c3cee0;font-size:13px;line-height:1.6">${m.snippetHtml}</blockquote>` : ''}
  `).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${ticker} mentions — The Record`,
    url: `https://agentcanary.ai/assets/${ticker}/`,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: mentions.length,
    },
  };
  return wrapPage({
    title: `${ticker} — Mentions across The Record | AgentCanary`,
    metaDescription: `Every AgentCanary brief that mentioned ${ticker}. ${mentions.length} mention${mentions.length === 1 ? '' : 's'}, time-sorted desc.`,
    canonical: `https://agentcanary.ai/assets/${ticker}/`,
    noindex,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    h1: `${ticker} — Mentions across The Record`,
    bodyHtml: `
      <p style="font-size:14px;color:#8a9abc;line-height:1.7;margin-bottom:24px">${mentions.length} brief${mentions.length === 1 ? '' : 's'} mentioning ${ticker}. Most recent first.</p>
      ${mentionsHtml}
    `,
  });
}

// ─── Regime (/regimes/{slug}/) ───────────────────────────────────

function renderRegime(opts) {
  const { slug, mentions } = opts;
  if (!slug || !Array.isArray(mentions)) throw new Error('renderRegime: { slug, mentions[] } required');
  const breadcrumb = [
    { name: 'Regimes', href: '/regimes/' },
    { name: slug.charAt(0).toUpperCase() + slug.slice(1) },
  ];
  const mentionsHtml = mentions.map(m => `
    <h2 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:#e4e9f2"><a href="${escapeHtml(m.permalink)}" style="color:inherit;text-decoration:none;border-bottom:1px solid #4a5a7a">${escapeHtml(m.headline)}</a></h2>
    <p class="mono" style="font-size:11px;color:#8a9abc;margin-bottom:16px">${escapeHtml(m.date)} · ${escapeHtml(m.slotLabel || '')}</p>
  `).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${slug} regime — The Record`,
    url: `https://agentcanary.ai/regimes/${slug}/`,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
  };
  return wrapPage({
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)} regime — The Record | AgentCanary`,
    metaDescription: `Every AgentCanary brief published during the ${slug} regime. ${mentions.length} brief${mentions.length === 1 ? '' : 's'}, time-sorted desc.`,
    canonical: `https://agentcanary.ai/regimes/${slug}/`,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    h1: `${slug.charAt(0).toUpperCase() + slug.slice(1)} regime — The Record`,
    bodyHtml: `
      <p style="font-size:14px;color:#8a9abc;line-height:1.7;margin-bottom:24px">${mentions.length} brief${mentions.length === 1 ? '' : 's'} published during this regime. Most recent first.</p>
      ${mentionsHtml}
    `,
  });
}

// ─── Day tile (used by collection page) ────────────────────────

function renderDayTile(day) {
  const briefBadges = (day.briefs || []).map(b => {
    const slot = resolveSlot(b);
    if (!slot) return '';
    const meta = slotMeta(slot);
    return `<span class="mono" style="font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid ${meta.color === 'orange' ? '#fb923c40' : meta.color === 'blue' ? '#60a5fa40' : meta.color === 'yellow' ? '#ffc53d40' : '#a78bfa40'};color:${meta.color === 'orange' ? '#fb923c' : meta.color === 'blue' ? '#60a5fa' : meta.color === 'yellow' ? '#ffc53d' : '#a78bfa'}">${escapeHtml(meta.label)}</span>`;
  }).join('');
  const [y, m, d] = day.date.split('-');
  return `<a href="/record/${y}/${m}/${d}/" style="display:block;padding:16px 20px;border:1px solid rgba(255,255,255,0.06);border-radius:12px;background:rgba(255,255,255,0.02);text-decoration:none;color:inherit;transition:border-color 0.2s">
    <div style="font-size:14px;font-weight:600;color:#e4e9f2;margin-bottom:8px">${escapeHtml(formatDate(day.date))}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${briefBadges}</div>
  </a>`;
}

// ─── Page chrome wrapper ──────────────────────────────────────────

function wrapPage(opts) {
  const { title, metaDescription, canonical, prev, next, jsonLd, breadcrumbHtml, h1, bodyHtml, noindex, topRightHtml } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(metaDescription || '')}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<link rel="canonical" href="${escapeHtml(canonical || '')}">
${prev ? `<link rel="prev" href="${escapeHtml(prev)}">` : ''}
${next ? `<link rel="next" href="${escapeHtml(next)}">` : ''}
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(metaDescription || '')}">
<meta property="og:url" content="${escapeHtml(canonical || '')}">
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
<body style="background:#04070c;color:#e4e9f2;font-family:'Instrument Sans',sans-serif;margin:0;padding:0;-webkit-font-smoothing:antialiased">
<div class="ac-page-container" style="max-width:1200px;margin:0 auto;padding:32px">
  <div class="ac-page-top" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
    <div class="ac-page-top-left">${breadcrumbHtml || ''}</div>
    ${topRightHtml ? `<div class="ac-page-top-right">${topRightHtml}</div>` : ''}
  </div>
  <h1 style="font-size:clamp(28px, 4vw, 44px);font-weight:800;letter-spacing:-1.5px;line-height:1.05;margin-bottom:24px">${escapeHtml(h1 || '')}</h1>
  ${bodyHtml}
</div>
</body>
</html>`;
}
