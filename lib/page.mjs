// agentcanary-landing/lib/page.mjs — TIMELINE design (v2)
// Per TIME-MACHINE-V1-SPEC §5.

import { escapeHtml, formatDate, monthName, SLOTS, resolveSlot, slotMeta, humanize, TAG_COLORS, extractBriefHighlights } from './render-utils.mjs';
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
    case 'brief':      return renderBrief(opts);
    default: throw new Error('renderIndex: unknown type "' + opts.type + '"');
  }
}

// ─── Page chrome (nav + footer) ──────────────────────────────────

function renderTopNav() {
  return `<nav class="ac-top">
  <div class="ac-nav-inner">
    <a href="/" class="ac-brand" aria-label="AgentCanary home">Agent<span class="ac-brand-accent">Canary</span></a>
    <div class="ac-nav-links">
      <a href="/record/">The Record</a>
      <a href="/#pricing">Pricing</a>
      <a href="https://api.agentcanary.ai/api/docs">Docs</a>
      <a href="https://github.com/MrCerq">GitHub</a>
    </div>
  </div>
</nav>`;
}

function renderFooter() {
  return `<footer class="ac-footer">
  <div class="ac-footer-inner">
    <div>© 2026 AgentCanary · Decision-grade market intelligence for autonomous AI agents · Not financial advice</div>
    <div class="ac-footer-links">
      <a href="/record/feed.json">JSON Feed</a>
      <a href="/record/rss.xml">RSS</a>
      <a href="https://api.agentcanary.ai/api/docs">API Docs</a>
      <a href="https://clawhub.ai/MrCerq/agentcanary" target="_blank" rel="noopener">ClawHub</a>
      <a href="https://github.com/MrCerq" target="_blank" rel="noopener">GitHub</a>
      <a href="https://t.me/AgentCanary" target="_blank" rel="noopener">Telegram</a>
      <a href="https://x.com/agentcanaryHQ" target="_blank" rel="noopener">X</a>
    </div>
  </div>
</footer>`;
}

function renderBreadcrumb(crumbs) {
  const parts = crumbs.map(c => {
    if (c.href) return `<a href="${escapeHtml(c.href)}">${escapeHtml(c.name)}</a>`;
    return `<span class="cur">${escapeHtml(c.name)}</span>`;
  });
  return `<div class="ac-crumb">${parts.join('<span class="slash">/</span>')}</div>`;
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

// ─── Day-summary card (single risk gauge for the day) ────────────

function renderDaySummaryCard(briefs) {
  if (!briefs.length) return '';
  const first = briefs[0];
  // Risk gauge: from first brief's RISK GAUGE panel
  const gaugePanel = (first.panels || []).find(p => p && (p.type === 'gauge' || p.label === 'RISK GAUGE'));
  const gaugeValue = gaugePanel ? (gaugePanel.value ?? gaugePanel.gauge?.value) : null;
  if (!Number.isFinite(gaugeValue)) return '';
  // Phase: from first brief's tags with c='blue'
  const phaseTag = (first.tags || []).find(t => t && t.c === 'blue');
  // Risk status pill: from first brief's tags with c='green'/'yellow'/'red'
  const statusTag = (first.tags || []).find(t => t && (t.c === 'green' || t.c === 'yellow' || t.c === 'red'));
  // Day-level top movers: aggregate from all briefs
  const dayMovers = aggregateDayMovers(briefs);

  // Compute needle angle for gauge
  const { tipX, tipY, labelText, labelColor } = gaugeMath(gaugeValue);

  const pills = [];
  if (statusTag) pills.push(`<span class="ac-pill ac-pill-${statusTag.c}"><span class="dot"></span>${escapeHtml(statusTag.t)}</span>`);
  if (phaseTag) pills.push(`<span class="ac-pill ac-pill-blue"><span class="dot"></span>${escapeHtml(phaseTag.t)}</span>`);

  return `<div class="ac-day-card">
  <div>
    <div class="ac-section-label">DAY RISK GAUGE</div>
    <div class="ac-gauge-center">
      <svg class="ac-gauge-svg" width="200" height="115" viewBox="0 0 200 115">
        <path d="M 30 95 A 70 70 0 0 1 170 95" fill="none" stroke="#1f2937" stroke-width="14" stroke-linecap="round" />
        <path d="M 30 95 A 70 70 0 0 1 70 31.9" fill="none" stroke="#34d399" stroke-width="10" stroke-linecap="round" />
        <path d="M 70 31.9 A 70 70 0 0 1 130.6 28.7" fill="none" stroke="#ffc53d" stroke-width="10" stroke-linecap="round" />
        <path d="M 130.6 28.7 A 70 70 0 0 1 170 95" fill="none" stroke="#f87171" stroke-width="10" stroke-linecap="round" />
        <line x1="100" y1="95" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="#e4e9f2" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="100" cy="95" r="7" fill="#04070c" stroke="#e4e9f2" stroke-width="2.5" />
        <text x="22" y="108" fill="#4a5a7a" font-size="11" font-family="monospace" text-anchor="middle">0</text>
        <text x="100" y="32" fill="#4a5a7a" font-size="11" font-family="monospace" text-anchor="middle">50</text>
        <text x="178" y="108" fill="#4a5a7a" font-size="11" font-family="monospace" text-anchor="middle">100</text>
      </svg>
      <div class="ac-gauge-value">${Math.round(gaugeValue)}</div>
      <div class="ac-gauge-denom">/ 100</div>
      <div class="ac-gauge-label" style="color:${labelColor};">${escapeHtml(labelText)}</div>
    </div>
  </div>
  <div>
    ${pills.length ? `<div class="ac-context-pills">${pills.join('')}</div>` : ''}
    <div class="ac-context-headline">${escapeHtml(first.desc || first.headline || '')}</div>
    ${first.entities && first.entities.regime ? `<p class="ac-context-desc">Phase tagged <a class="lr" href="/regimes/${first.entities.regime}/">${escapeHtml(first.entities.regime)}</a> · ${briefs.length} brief${briefs.length === 1 ? '' : 's'} published this day.</p>` : ''}
  </div>
  <div class="ac-day-movers">
    <div class="ac-section-label">TOP MOVERS · TODAY</div>
    <div class="ac-day-movers-list">
      ${dayMovers.map(m => {
        const colorClass = m.chg > 0 ? 'green' : m.chg < 0 ? 'red' : 'yellow-c';
        const valTxt = (m.chg > 0 ? '+' : '') + m.chg.toFixed(1) + '%';
        return `<a class="ac-mover-row" href="/assets/${escapeHtml(m.sym)}/"><span class="sym">${escapeHtml(m.sym)}</span><span class="val ${colorClass}">${escapeHtml(valTxt.replace('-', '−'))}</span></a>`;
      }).join('')}
    </div>
  </div>
</div>`;
}

function gaugeMath(value) {
  const clamped = Math.max(0, Math.min(100, value));
  const angleDeg = 180 - clamped * 1.8;
  const rad = angleDeg * Math.PI / 180;
  const tipX = 100 + 65 * Math.cos(rad);
  const tipY = 95 - 65 * Math.sin(rad);
  let labelText, labelColor;
  if (clamped < 20)      { labelText = 'CALM';     labelColor = '#34d399'; }
  else if (clamped < 40) { labelText = 'LOW';      labelColor = '#34d399'; }
  else if (clamped < 60) { labelText = 'ELEVATED'; labelColor = '#ffc53d'; }
  else if (clamped < 80) { labelText = 'HIGH';     labelColor = '#fb923c'; }
  else                   { labelText = 'CRITICAL'; labelColor = '#f87171'; }
  return { tipX, tipY, labelText, labelColor };
}

function aggregateDayMovers(briefs) {
  const seen = new Map();
  for (const brief of briefs) {
    for (const panel of (brief.panels || [])) {
      if (!panel || panel.label !== 'TOP MOVERS' || !Array.isArray(panel.rows)) continue;
      for (const row of panel.rows) {
        if (!row || !row.k || !row.v) continue;
        if (seen.has(row.k)) continue;
        const m = String(row.v).match(/^([+-]?)(\d+\.?\d*)/);
        if (!m) continue;
        const chg = parseFloat((m[1] || '+') + m[2]);
        if (!Number.isFinite(chg)) continue;
        seen.set(row.k, { sym: row.k, chg });
      }
    }
  }
  // Sort by absolute change desc, take 6
  return [...seen.values()].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 6);
}

// ─── Page-type renderers ─────────────────────────────────────────

// ─── Helpers for collection page day-meta extraction ────────────────

// Summary paragraph header varies by slot:
//   signal: SNAPSHOT · radar: MACRO OVERVIEW · wrap: DAILY SYNTHESIS
//   pulse: no editorial intro (data-only — skip with fallback)
function _summaryParagraph(brief) {
  const body = String(brief.body || brief.telegramText || brief.content || '');
  // 1. Try named summary headers (newer briefs after T1.1 rename pass)
  for (const header of ['SNAPSHOT', 'DAILY SYNTHESIS', 'MACRO OVERVIEW']) {
    const re = new RegExp('<b>' + header + '<\\/b>\\s*([\\s\\S]*?)(?=<b>|$)', 'i');
    const m = body.match(re);
    if (m) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
  }
  // 2. Fallback for older briefs: prose between title line and first section header.
  // Strip italic boilerplate ("Built for autonomous systems...") in passing.
  const m = body.match(/<b>[^<]+<\/b>[^\n]*\n+([\s\S]*?)(?=<b>|$)/);
  if (m) {
    const text = m[1].replace(/<i>[^<]*<\/i>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function _extractSnapshot(brief) {
  // Kept for back-compat with brief-card preview script if it imports.
  const para = _summaryParagraph(brief);
  return (para || brief.desc || '').slice(0, 180);
}

function _firstSentence(brief) {
  const para = _summaryParagraph(brief);
  if (!para) return brief.headline || brief.desc || '';
  const first = para.split(/\.\s+/)[0].trim();
  if (!first) return brief.headline || '';
  return first.length > 140 ? first.slice(0, 137) + '…' : first;
}

function _restOfSummary(brief) {
  // Continuation after the first sentence — used as p so it doesn't repeat h3.
  const para = _summaryParagraph(brief);
  if (!para) return brief.desc || '';
  const parts = para.split(/\.\s+/);
  if (parts.length < 2) return brief.desc || '';
  const rest = parts.slice(1).join('. ').trim();
  if (!rest) return brief.desc || '';
  return rest.length > 200 ? rest.slice(0, 197) + '…' : rest;
}

function _briefFoot(brief, slot) {
  const highlights = extractBriefHighlights(brief, slot);
  return highlights.slice(0, 2).map(h => `${escapeHtml(h.label)} ${escapeHtml(h.value)}`).join(' · ');
}

function _dayMeta(day) {
  const briefs = day.briefs || [];
  const bySlot = {};
  for (const b of briefs) bySlot[resolveSlot(b)] = b;
  const wrap = bySlot.wrap || bySlot.pulse || bySlot.signal || bySlot.radar || briefs[0] || null;
  const radar = bySlot.radar || null;
  const headline = wrap ? _firstSentence(wrap) : '';
  let regime = '';
  for (const b of briefs) { if (b.entities && b.entities.regime) { regime = b.entities.regime; break; } }
  let risk = null;
  if (radar) {
    const gp = (radar.panels || []).find(p => p.label === 'RISK GAUGE');
    if (gp && gp.gauge && gp.gauge.value != null) risk = gp.gauge.value;
  }
  let topMover = null;
  for (const slot of ['wrap', 'pulse', 'signal']) {
    const b = bySlot[slot];
    if (!b) continue;
    const mp = (b.panels || []).find(p => p.label === 'TOP MOVERS');
    if (mp && mp.rows && mp.rows.length) { topMover = mp.rows[0]; break; }
  }
  return { headline, regime, risk, topMover };
}

function _dowLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

function _shortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${monthName(d.getUTCMonth() + 1).slice(0, 3)} ${d.getUTCDate()}`;
}

function _longDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  return `${monthName(d.getUTCMonth() + 1)} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${dow}`;
}

// ─── Page-type renderer: /record/ collection ────────────────────────

function renderCollection(opts) {
  const days = opts.days || [];
  const today = days[0] || null;
  const archive = days.slice(1, 8);
  const months = opts.months || [];
  const breadcrumb = [{ name: 'AgentCanary', href: '/' }, { name: 'The Record' }];

  // Latest 4 briefs flattened across days (DESC: most recent first).
  // Each day's briefs are sorted ASC by slot (radar→signal→pulse→wrap),
  // so reverse-iterate to get DESC within a day.
  const latestFlat = [];
  for (const d of days) {
    for (let i = d.briefs.length - 1; i >= 0; i--) {
      latestFlat.push({ brief: d.briefs[i], date: d.date });
      if (latestFlat.length >= 4) break;
    }
    if (latestFlat.length >= 4) break;
  }
  let todayCardsHtml = '';
  let todayDateLong = '';
  let latestPublished = '';
  if (latestFlat.length) {
    todayCardsHtml = latestFlat.map(({ brief, date }) => {
      const slot = resolveSlot(brief);
      const meta = slotMeta(slot);
      const permalink = briefPermalink(brief, slot);
      const excerpt = _restOfSummary(brief);
      const foot = _briefFoot(brief, slot);
      return `      <a href="${permalink}" class="rc-brief-card rc-slot-${escapeHtml(slot)}">
        <div class="rc-brief-head">
          <span>${escapeHtml(meta.label)}</span>
          <span class="rc-brief-time">${escapeHtml(_shortDate(date))} · ${escapeHtml(meta.fireTimeUTC)}</span>
        </div>
        <h3>${escapeHtml(_firstSentence(brief))}</h3>
        <p>${escapeHtml(excerpt)}</p>
        <div class="rc-brief-foot">${foot} →</div>
      </a>`;
    }).join('\n');
    // Latest published — use the most-recent brief in the flattened list
    const lastBrief = latestFlat[0].brief;
    const lastDate = latestFlat[0].date;
    todayDateLong = _longDate(lastDate);
    if (lastBrief) {
      const slot = resolveSlot(lastBrief);
      const meta = slotMeta(slot);
      latestPublished = `${_shortDate(lastDate)}, ${lastDate.slice(0, 4)} · ${meta.fireTimeUTC} UTC`;
    }
  }

  // Archive day rows
  const archiveRowsHtml = archive.map(d => {
    const meta = _dayMeta(d);
    const dayUrl = `/record/${d.date.replace(/-/g, '/')}/`;
    const tags = [];
    if (meta.regime) {
      const regimeLabel = meta.regime.charAt(0).toUpperCase() + meta.regime.slice(1);
      tags.push(`<span class="rc-tag rc-tag-regime">${escapeHtml(regimeLabel)}</span>`);
    }
    if (meta.risk != null) {
      tags.push(`<span class="rc-tag">Risk ${escapeHtml(String(meta.risk))}</span>`);
    }
    if (meta.topMover) {
      const cls = meta.topMover.c === 'red' ? 'rc-tag-bear' : (meta.topMover.c === 'green' ? 'rc-tag-bull' : '');
      tags.push(`<span class="rc-tag ${cls}">${escapeHtml(meta.topMover.k)} ${escapeHtml(meta.topMover.v)}</span>`);
    }
    const headline = meta.headline || `Briefs for ${_shortDate(d.date)}`;
    return `      <li class="rc-day-row">
        <span class="rc-day-date">${escapeHtml(_shortDate(d.date))} <span class="rc-dow">${escapeHtml(_dowLabel(d.date))}</span></span>
        <div class="rc-day-main">
          <a href="${dayUrl}" class="rc-day-headline">${escapeHtml(headline)}</a>
          <div class="rc-day-tags">${tags.join('')}</div>
        </div>
        <span class="rc-day-count"><a href="${dayUrl}">${(d.briefs || []).length} briefs →</a></span>
      </li>`;
  }).join('\n');

  // Month grid
  const monthsHtml = months.slice(0, 12).map(m => {
    const isCurrent = today && today.date.slice(0, 7) === `${m.year}-${m.month}`;
    return `      <li><a href="/record/${m.year}/${m.month}/">
        <div class="rc-month-name">${escapeHtml(monthName(parseInt(m.month, 10)))} ${escapeHtml(m.year)}</div>
        <div class="rc-month-meta">${isCurrent ? 'Current' : `${m.briefCount} brief${m.briefCount === 1 ? '' : 's'}`}</div>
      </a></li>`;
  }).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Record — AgentCanary',
    url: 'https://agentcanary.ai/record/',
    description: 'Decision-grade market intelligence layer for autonomous AI agents. Daily macro briefs with regime tracking and public track-record-verified predictions.',
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
  };

  return wrapPage({
    title: 'The Record — AgentCanary',
    metaDescription: opts.metaDescription || 'Decision-grade market intelligence for autonomous AI agents. Daily macro briefs with regime tracking, narrative momentum, and scored predictions.',
    canonical: 'https://agentcanary.ai/record/',
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    bodyHtml: `
<section class="rc-masthead">
  <div class="rc-container">
    <div class="rc-eyebrow">The Record · Live Archive</div>
    <h1 class="rc-h1">Market intelligence <em>on the record.</em></h1>
    <p class="rc-masthead-sub">Decision-grade market intelligence for autonomous AI agents. Regime classifications, risk scores, narrative momentum, and public track-record-verified predictions — 4× daily, permanently archived.</p>
  </div>
</section>

${todayCardsHtml ? `<section class="rc-section">
  <div class="rc-container">
    <div class="rc-section-head">
      <div class="rc-section-head-left">
        <div class="rc-section-eyebrow">Latest · ${escapeHtml(todayDateLong)}</div>
        <h2 class="rc-h2">Latest briefs.</h2>
      </div>
      <a href="/record/${today.date.replace(/-/g, '/')}/" class="rc-section-cta">Full day →</a>
    </div>
    <div class="rc-briefs-grid">
${todayCardsHtml}
    </div>
  </div>
</section>` : ''}

${archiveRowsHtml ? `<section class="rc-section">
  <div class="rc-container">
    <div class="rc-section-head">
      <div class="rc-section-head-left">
        <div class="rc-section-eyebrow">Archive</div>
        <h2 class="rc-h2">Every day, <em>on the record.</em></h2>
      </div>
    </div>
    <ul class="rc-days">
${archiveRowsHtml}
    </ul>
  </div>
</section>` : ''}

${monthsHtml ? `<section class="rc-section">
  <div class="rc-container">
    <div class="rc-section-head">
      <div class="rc-section-head-left">
        <div class="rc-section-eyebrow">Months</div>
        <h2 class="rc-h2">Browse by month.</h2>
      </div>
    </div>
    <ul class="rc-months">
${monthsHtml}
    </ul>
  </div>
</section>` : ''}
    `,
  });
}

function renderYear(opts) {
  const year = opts.year;
  if (!year) throw new Error('renderYear: { year } required');
  const months = opts.months || [];
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: String(year) },
  ];
  const monthsHtml = months.map(m => `
    <a class="ac-tile" href="/record/${year}/${String(m.month).padStart(2, '0')}/">
      <h2 class="ac-tile-headline">${escapeHtml(monthName(m.month))}</h2>
      <div class="mono" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-2)">${m.briefCount || 0} brief${m.briefCount === 1 ? '' : 's'}</div>
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
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · YEAR ARCHIVE</div>
        <h1>${escapeHtml(String(year))}</h1>
        <p class="ac-hero-sub">${months.length} month${months.length === 1 ? '' : 's'} of AgentCanary briefs in ${escapeHtml(String(year))}. ${months.reduce((s, m) => s + (m.briefCount || 0), 0)} briefs total. Each month links to its daily archive.</p>
      </div>
      <div class="ac-page-container">
        <div class="ac-year-grid">${monthsHtml}</div>
      </div>
    `,
  });
}

function renderMonth(opts) {
  const { year, month } = opts;
  if (!year || !month) throw new Error('renderMonth: { year, month } required');
  const days = opts.days || [];
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: String(year), href: `/record/${year}/` },
    { name: monthName(parseInt(month, 10)) },
  ];
  const daysHtml = days.map(d => {
    const dn = parseInt(d.date.slice(8), 10);
    return `<a class="ac-tile" href="/record/${d.date.replace(/-/g, '/')}/">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 class="ac-tile-headline" style="font-size:16px">${dn}</h2>
        ${d.regime ? `<span class="mono" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--blue)">${escapeHtml(d.regime.toUpperCase())}</span>` : ''}
      </div>
      <div class="mono" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-2)">${d.briefCount || 0} brief${d.briefCount === 1 ? '' : 's'}</div>
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
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · MONTH ARCHIVE</div>
        <h1>${escapeHtml(monthName(parseInt(month, 10)))} ${escapeHtml(String(year))}</h1>
        <p class="ac-hero-sub">${days.length} day${days.length === 1 ? '' : 's'} of AgentCanary briefs in ${escapeHtml(monthName(parseInt(month, 10)))} ${escapeHtml(String(year))}. ${days.reduce((s, d) => s + (d.briefCount || 0), 0)} briefs total.</p>
      </div>
      <div class="ac-page-container">
        <div class="ac-month-grid">${daysHtml}</div>
      </div>
    `,
  });
}

function renderDay(opts) {
  const { date, briefs } = opts;
  if (!date || !Array.isArray(briefs)) throw new Error('renderDay: { date, briefs[] } required');
  const [year, month, day] = date.split('-');
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: year, href: `/record/${year}/` },
    { name: monthName(parseInt(month, 10)), href: `/record/${year}/${month}/` },
    { name: `${monthName(parseInt(month, 10))} ${parseInt(day, 10)}, ${year}` },
  ];
  const sortedBriefs = briefs.slice().sort((a, b) => {
    return SLOTS.indexOf(resolveSlot(a)) - SLOTS.indexOf(resolveSlot(b));
  });

  // Risk + phase summary for hero
  const first = sortedBriefs[0];
  const gaugePanel = first ? (first.panels || []).find(p => p && (p.type === 'gauge' || p.label === 'RISK GAUGE')) : null;
  const gaugeValue = gaugePanel ? Math.round(gaugePanel.value ?? gaugePanel.gauge?.value ?? 0) : null;
  const phaseTag = first ? (first.tags || []).find(t => t && t.c === 'blue') : null;
  const dayMovers = aggregateDayMovers(sortedBriefs);

  const dayLabel = formatDate(date);
  const heroSubParts = [];
  if (gaugeValue != null) heroSubParts.push(`Risk Gauge: <span class="mono">${gaugeValue}/100</span>`);
  if (phaseTag) heroSubParts.push(`Phase: <span class="mono">${escapeHtml(phaseTag.t)}</span>`);
  heroSubParts.push(`${sortedBriefs.length} brief${sortedBriefs.length === 1 ? '' : 's'}`);
  if (dayMovers.length) heroSubParts.push(`${dayMovers.length} top mover${dayMovers.length === 1 ? '' : 's'}`);

  // Timeline body
  const timelineRows = sortedBriefs.map((brief, i) => {
    return renderCard(brief, 'page', { assetMap: opts.assetMap, isLast: i === sortedBriefs.length - 1, omitPills: true });
  }).join('\n');

  // Day-nav arrows
  const dayNavParts = [];
  if (opts.prevDate) {
    dayNavParts.push(`<a class="ac-day-btn" href="/record/${opts.prevDate.replace(/-/g, '/')}/" rel="prev">← ${escapeHtml(formatDate(opts.prevDate).split(',')[0])}</a>`);
  } else {
    dayNavParts.push(`<span class="ac-day-btn disabled">← Prev</span>`);
  }
  if (opts.nextDate) {
    dayNavParts.push(`<a class="ac-day-btn" href="/record/${opts.nextDate.replace(/-/g, '/')}/" rel="next">${escapeHtml(formatDate(opts.nextDate).split(',')[0])} →</a>`);
  } else {
    dayNavParts.push(`<span class="ac-day-btn disabled">Next →</span>`);
  }

  const weekdayShort = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${dayLabel} — The Record`,
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
            additionalProperty: extractBriefHighlights(b, slot).map(h => ({
              '@type': 'PropertyValue',
              name: h.label,
              value: h.value,
            })),
          },
        };
      }),
    },
  };

  return wrapPage({
    title: `${dayLabel} — The Record | AgentCanary`,
    metaDescription: `${sortedBriefs.length} market intelligence brief${sortedBriefs.length === 1 ? '' : 's'} for ${dayLabel}. ${sortedBriefs[0]?.headline || ''}`,
    canonical: `https://agentcanary.ai/record/${year}/${month}/${day}/`,
    ogImage: `https://agentcanary.ai/record/${year}/${month}/${day}/og.png`,
    prev: opts.prevDate ? `/record/${opts.prevDate.replace(/-/g, '/')}/` : null,
    next: opts.nextDate ? `/record/${opts.nextDate.replace(/-/g, '/')}/` : null,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    topRightHtml: `<div class="ac-day-nav">${dayNavParts.join('')}</div>`,
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · DAILY ARCHIVE</div>
        <h1>${escapeHtml(dayLabel)} — The Record</h1>
        <p class="ac-hero-sub">${heroSubParts.join(' · ')}</p>
      </div>
      <section class="ac-briefs-wrap">
        <div class="ac-day-card-row">
          <div class="ac-day-card-gutter"></div>
          ${renderDaySummaryCard(sortedBriefs)}
        </div>
        <div class="ac-briefs-header">
          <span>${sortedBriefs.length} BRIEF${sortedBriefs.length === 1 ? '' : 'S'} · CHRONOLOGICAL · ALL TIMES UTC</span>
          <span class="line"></span>
          <span>${escapeHtml(weekdayShort)} ${escapeHtml(date.slice(8))} ${escapeHtml(monthName(parseInt(month, 10)).slice(0, 3).toUpperCase())} ${escapeHtml(year)}</span>
        </div>
        <div class="ac-timeline">
          ${timelineRows}
        </div>
      </section>
    `,
  });
}

function renderAsset(opts) {
  const { ticker, mentions } = opts;
  if (!ticker || !Array.isArray(mentions)) throw new Error('renderAsset: { ticker, mentions[] } required');
  const noindex = mentions.length < 3;
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: `Asset: ${ticker}` },
  ];
  const mentionsHtml = mentions.map(m => `
    <article class="ac-tile" style="margin-bottom:12px">
      <div class="ac-tile-header">
        <span class="mono" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-2)">${escapeHtml(m.date)} · ${escapeHtml(m.slotLabel || '')}</span>
      </div>
      <h2 class="ac-tile-headline" style="font-size:16px;margin:0"><a href="${escapeHtml(m.permalink)}" style="color:inherit;text-decoration:none">${escapeHtml(m.headline)}</a></h2>
    </article>
  `).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${ticker} mentions — The Record`,
    url: `https://agentcanary.ai/assets/${ticker}/`,
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
  };
  return wrapPage({
    title: `${ticker} — Mentions across The Record | AgentCanary`,
    metaDescription: `Every AgentCanary brief that mentioned ${ticker}. ${mentions.length} mention${mentions.length === 1 ? '' : 's'}, time-sorted desc.`,
    canonical: `https://agentcanary.ai/assets/${ticker}/`,
    noindex,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · ASSET</div>
        <h1>${escapeHtml(ticker)}</h1>
        <p class="ac-hero-sub">${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} mention ${escapeHtml(ticker)}${mentions.length > 0 ? `, ranging from ${escapeHtml(mentions[mentions.length-1].date)} to ${escapeHtml(mentions[0].date)}` : ''}. Most recent first.</p>
      </div>
      <div class="ac-page-container">${mentionsHtml}</div>
    `,
  });
}

function renderRegime(opts) {
  const { slug, mentions } = opts;
  if (!slug || !Array.isArray(mentions)) throw new Error('renderRegime: { slug, mentions[] } required');
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: `Regime: ${slug.charAt(0).toUpperCase() + slug.slice(1)}` },
  ];
  const mentionsHtml = mentions.map(m => `
    <article class="ac-tile" style="margin-bottom:12px">
      <div class="ac-tile-header">
        <span class="mono" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-2)">${escapeHtml(m.date)} · ${escapeHtml(m.slotLabel || '')}</span>
      </div>
      <h2 class="ac-tile-headline" style="font-size:16px;margin:0"><a href="${escapeHtml(m.permalink)}" style="color:inherit;text-decoration:none">${escapeHtml(m.headline)}</a></h2>
    </article>
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
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · REGIME</div>
        <h1>${escapeHtml(slug.charAt(0).toUpperCase() + slug.slice(1))} regime</h1>
        <p class="ac-hero-sub">${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} published while macro state was classified as <strong>${escapeHtml(slug)}</strong>${mentions.length > 0 ? `, ranging from ${escapeHtml(mentions[mentions.length-1].date)} to ${escapeHtml(mentions[0].date)}` : ''}. Most recent first.</p>
      </div>
      <div class="ac-page-container">${mentionsHtml}</div>
    `,
  });
}

function renderDayTile(day) {
  const briefBadges = (day.briefs || []).map(b => {
    const slot = resolveSlot(b);
    if (!slot) return '';
    const meta = slotMeta(slot);
    const rgb = meta.accentRgb;
    return `<span class="mono" style="font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid rgba(${rgb},0.30);color:var(--${meta.color})">${escapeHtml(meta.label)}</span>`;
  }).join('');
  const [y, m, d] = day.date.split('-');
  return `<a class="ac-tile" href="/record/${y}/${m}/${d}/">
    <div class="ac-tile-headline">${escapeHtml(formatDate(day.date))}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${briefBadges}</div>
  </a>`;
}


function renderBrief(opts) {
  const { brief, prev, next } = opts;
  if (!brief) throw new Error('renderBrief: { brief } required');
  const slot = resolveSlot(brief);
  if (!slot) throw new Error('renderBrief: brief has no resolvable slot');
  const meta = slotMeta(slot);
  const [year, month, day] = brief.date.split('-');
  const dayUrl = `/record/${year}/${month}/${day}/`;
  const dayLabel = formatDate(brief.date);
  const breadcrumb = [
    { name: 'AgentCanary', href: '/' },
    { name: 'The Record', href: '/record/' },
    { name: year, href: `/record/${year}/` },
    { name: monthName(parseInt(month, 10)), href: `/record/${year}/${month}/` },
    { name: dayLabel.split(',')[0], href: dayUrl },
    { name: meta.label },
  ];
  // Back to day + same-slot prev/next
  const navParts = [];
  navParts.push(`<a class="ac-day-btn" href="${dayUrl}">← Back to ${escapeHtml(dayLabel.split(',')[0])}</a>`);
  if (prev) navParts.push(`<a class="ac-day-btn" href="${briefPermalink(prev, slot)}" rel="prev" title="Previous ${escapeHtml(meta.label)}">← prev ${escapeHtml(meta.label)}</a>`);
  if (next) navParts.push(`<a class="ac-day-btn" href="${briefPermalink(next, slot)}" rel="next" title="Next ${escapeHtml(meta.label)}">next ${escapeHtml(meta.label)} →</a>`);
  // Share button — Web Share API with clipboard fallback
  navParts.push(`<button type="button" class="ac-day-btn ac-share-btn" data-share-title="${escapeHtml(brief.headline || '')}" data-share-url="https://agentcanary.ai${briefPermalink(brief, slot)}" aria-label="Share this brief" onclick="(async()=>{const u=this.dataset.shareUrl,t=this.dataset.shareTitle;if(navigator.share){try{await navigator.share({title:t,url:u})}catch(e){}}else{try{await navigator.clipboard.writeText(u);const o=this.textContent;this.textContent='Copied!';setTimeout(()=>{this.textContent=o},1500)}catch(e){this.textContent='Copy failed'}}})()">Share</button>`);
  const cardHtml = renderCard(brief, 'card', { assetMap: opts.assetMap });
  const briefUrl = `https://agentcanary.ai${briefPermalink(brief, slot)}`;
  const briefOgUrl = `${briefUrl}og.png`;
  // articleBody: strip HTML from body, collapse whitespace, take first 600 chars.
  // Was hard-coded to <b>SNAPSHOT</b> which no current brief uses — radar/signal/
  // pulse/wrap each have their own section taxonomy. Universal stripping is
  // robust to schema changes.
  const bodyRaw = String(brief.body || brief.telegramText || brief.content || '');
  let articleBody = brief.desc || '';
  const stripped = bodyRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length > 50) {
    articleBody = stripped.slice(0, 600);
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: brief.headline,
    description: brief.desc,
    articleBody,
    image: briefOgUrl,
    datePublished: brief.publishedAt || `${brief.date}T${meta.fireTimeUTC}:00Z`,
    dateModified: brief.publishedAt || `${brief.date}T${meta.fireTimeUTC}:00Z`,
    url: briefUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': briefUrl },
    author: { '@id': 'https://agentcanary.ai/#org' },
    publisher: {
      '@type': 'Organization',
      name: 'AgentCanary',
      url: 'https://agentcanary.ai',
      logo: { '@type': 'ImageObject', url: 'https://agentcanary.ai/og-image.png' },
    },
    keywords: (brief.tags || []).map(t => t.t).join(', '),
    articleSection: 'Market Intelligence',
    breadcrumb: jsonLdBreadcrumb(breadcrumb),
    additionalProperty: extractBriefHighlights(brief, slot).map(h => ({
      '@type': 'PropertyValue',
      name: h.label,
      value: h.value,
    })),
  };
  return wrapPage({
    title: `${meta.label} — ${dayLabel} | The Record | AgentCanary`,
    metaDescription: `${meta.label} brief for ${dayLabel}. ${brief.desc || ''}`,
    canonical: `https://agentcanary.ai${briefPermalink(brief, slot)}`,
    ogImage: briefOgUrl,
    prev: prev ? briefPermalink(prev, slot) : null,
    next: next ? briefPermalink(next, slot) : null,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    topRightHtml: `<div class="ac-day-nav">${navParts.join('')}</div>`,
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · ${escapeHtml(meta.label)}</div>
        <h1>${escapeHtml(meta.label)} — ${escapeHtml(dayLabel)}</h1>
        <p class="ac-hero-sub">Brief published ${escapeHtml(meta.fireTimeUTC)} UTC · <a href="${dayUrl}" style="color:var(--yellow);text-decoration:underline">← back to full day</a></p>
      </div>
      <section class="ac-briefs-wrap">
        <div class="ac-timeline">
          ${renderCard(brief, 'page', { assetMap: opts.assetMap, isLast: true })}
        </div>
      </section>
    `,
  });
}

// ─── Page chrome wrapper ─────────────────────────────────────────

const SEO_FOOTER = `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About AgentCanary</h2>
  <p>AgentCanary is the decision-grade market intelligence layer for autonomous AI agents. It delivers regime classifications, risk scores, narrative momentum, scenario probabilities, and public track-record-verified signals via simple API + MCP. No KYC, wallet-billed in stablecoins, schema-stable, fail-soft.</p>
  <p>Stop building your own 80-source data pipeline. AgentCanary gives you 50+ pre-curated, second-order signals with provenance, freshness, and public accuracy scores. Free tier available. MCP-native.</p>
  <p class="ac-seo-footer-access"><a href="https://api.agentcanary.ai/api/docs">REST API</a> · <a href="https://www.npmjs.com/package/agentcanary-mcp">MCP server</a> (<code>npx agentcanary-mcp</code>) · <a href="/record/feed.json">JSON Feed</a> · <a href="/record/rss.xml">RSS</a> · <a href="https://clawhub.ai/MrCerq/agentcanary">ClawHub skill</a> · AI crawlers allowlisted via <a href="/llms.txt">llms.txt</a></p>
</div></section>`;

function wrapPage(opts) {
  const { title, metaDescription, canonical, prev, next, jsonLd, jsonLdExtra, breadcrumbHtml, bodyHtml, noindex, topRightHtml, leadHtml, ogImage } = opts;
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
<meta property="og:image" content="${escapeHtml(ogImage || 'https://agentcanary.ai/og-image.png')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(ogImage || 'https://agentcanary.ai/og-image.png')}">
<link rel="alternate" type="application/feed+json" href="/record/feed.json" title="The Record (JSON Feed)">
<link rel="alternate" type="application/rss+xml" href="/record/rss.xml" title="The Record (RSS)">
<link rel="ai-info" href="/llms.txt">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/card.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${jsonLdExtra ? jsonLdExtra.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('') : ''}
</head>
<body>
<div class="grid-bg"></div>
<div class="glow-tl"></div>
<div class="glow-br"></div>
${renderTopNav()}
<div class="ac-breadcrumb-row">
  ${breadcrumbHtml || ''}
  ${topRightHtml || ''}
</div>
${bodyHtml || ''}
${SEO_FOOTER}
${renderFooter()}
</body>
</html>`;
}
