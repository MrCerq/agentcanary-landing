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
      <a href="/sources/">Sources</a>
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
  // 2. Pulse fallback: use CRYPTO section content (pulse is data-only — no
  //    editorial intro). Join lines with '. ' so _firstSentence picks the
  //    BTC line as the lead and _restOfSummary continues with ETH/SOL/sentiment.
  const cm = body.match(/<b>CRYPTO<\/b>\s*([\s\S]*?)(?=<b>|$)/i);
  if (cm) {
    const lines = cm[1].split('\n').map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    if (lines.length > 0) {
      return lines.join('. ');
    }
  }
  // 3. Generic fallback for older briefs: prose between title line and first section header.
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


function _perAssetStats(predictionsArr, limit = 10) {
  if (!predictionsArr || predictionsArr.length === 0) return null;
  const by = new Map();
  for (const p of predictionsArr) {
    const t = p.ticker || '?';
    const cur = by.get(t) || { ticker: t, total: 0, hit: 0, partial: 0, miss: 0, pending: 0, no_data: 0 };
    cur.total++;
    const r = p.result || 'pending';
    if (cur[r] !== undefined) cur[r]++;
    by.set(t, cur);
  }
  const rows = [...by.values()]
    .filter(r => r.total >= 2)  // skip one-offs
    .map(r => ({ ...r, scored: r.hit + r.partial + r.miss, hitPct: 0 }));
  for (const r of rows) {
    r.hitPct = r.scored > 0 ? Math.round((r.hit / r.scored) * 100) : 0;
  }
  rows.sort((a, b) => b.total - a.total);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  const totalScored = rows.reduce((s, r) => s + r.scored, 0);
  return { rows: rows.slice(0, limit), totalPredictions: totalAll, totalScored, totalTickers: rows.length };
}


function _renderCalibration(brierStats) {
  if (!brierStats || !Number.isFinite(brierStats.meanBrier)) return '';
  const bs = brierStats;
  const baseline = bs.baselineRandom || 0.25;
  const beatsBaseline = bs.meanBrier < baseline;
  const lift = ((baseline - bs.meanBrier) / baseline * 100).toFixed(1);

  // Reliability table — only show buckets with >=5 predictions
  const populated = (bs.reliability || []).filter(r => r.n >= 5);
  if (populated.length === 0) return '';

  const reliabilityRows = populated.map(r => {
    const drift = r.observed_rate - r.predicted_mean;
    const driftClass = Math.abs(drift) < 5 ? 'good' : Math.abs(drift) < 15 ? 'mid' : 'low';
    const driftStr = drift >= 0 ? `+${drift.toFixed(1)}` : drift.toFixed(1);
    return `<tr>
      <td><strong>${r.range}</strong></td>
      <td class="num">${r.n}</td>
      <td class="num">${r.predicted_mean.toFixed(1)}%</td>
      <td class="num">${r.observed_rate.toFixed(1)}%</td>
      <td class="num ${driftClass}">${driftStr}pp</td>
    </tr>`;
  }).join('');

  const scenarioPills = ['A', 'B', 'C'].map(letter => {
    const sc = bs.perScenario[letter];
    if (!sc || !sc.n) return '';
    return `<div class="rc-cal-pill">
      <div class="rc-cal-pill-letter">${letter}</div>
      <div class="rc-cal-pill-value">${sc.meanBrier.toFixed(3)}</div>
      <div class="rc-cal-pill-meta">n=${sc.n}</div>
    </div>`;
  }).join('');

  const verdictLine = beatsBaseline
    ? `Beats random-guess baseline (${baseline}) by ${lift}%.`
    : `Worse than random-guess baseline (${baseline}) — calibration broken.`;

  return `<section class="rc-section">
  <div class="rc-container">
    <div class="rc-section-head">
      <div class="rc-section-head-left">
        <div class="rc-section-eyebrow">Track Record · Calibration</div>
        <h2 class="rc-h2">How well do <em>probabilities match outcomes</em>?</h2>
      </div>
    </div>
    <p class="rc-section-sub">Brier score: mean of <code style="font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.04);padding:1px 5px;border-radius:3px">(predicted probability − actual outcome)²</code> across ${bs.n} scored scenario predictions. Lower is better. ${verdictLine}</p>
    <div class="rc-cal-headline">
      <div class="rc-cal-headline-num">${bs.meanBrier.toFixed(3)}</div>
      <div class="rc-cal-headline-label">Mean Brier · ${bs.n} predictions</div>
    </div>
    <div class="rc-cal-scenario-row">${scenarioPills}</div>
    <h3 class="rc-cal-h3">Reliability — predicted vs observed</h3>
    <p class="rc-section-sub" style="margin-top:-8px">Each row: where we predicted N% probability, how often did the scenario actually hit? Drift = observed − predicted (closer to 0 = better calibrated).</p>
    <div class="rc-asset-table-wrap">
      <table class="rc-asset-table">
        <thead><tr>
          <th>Predicted probability</th>
          <th class="num">n</th>
          <th class="num">Predicted (mean)</th>
          <th class="num">Observed</th>
          <th class="num">Drift</th>
        </tr></thead>
        <tbody>${reliabilityRows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

function _renderPerAssetTable(predictionsArr) {
  const stats = _perAssetStats(predictionsArr);
  if (!stats || stats.rows.length === 0) return '';
  const trs = stats.rows.map(r => {
    const hitPctClass = r.hitPct >= 30 ? 'good' : r.hitPct >= 15 ? 'mid' : 'low';
    return `<tr>
      <td><a class="rc-asset-link" href="/assets/${escapeHtml(r.ticker)}/">${escapeHtml(r.ticker)}</a></td>
      <td class="num">${r.total}</td>
      <td class="num good">${r.hit}</td>
      <td class="num mid">${r.partial}</td>
      <td class="num low">${r.miss}</td>
      <td class="num ${hitPctClass}"><strong>${r.hitPct}%</strong></td>
    </tr>`;
  }).join('');

  return `<section class="rc-section">
  <div class="rc-container">
    <div class="rc-section-head">
      <div class="rc-section-head-left">
        <div class="rc-section-eyebrow">Track Record · 72h evaluation</div>
        <h2 class="rc-h2">Per-asset <em>hit rate.</em></h2>
      </div>
    </div>
    <p class="rc-section-sub">${stats.totalScored} of ${stats.totalPredictions} predictions scored against actual prices across ${stats.totalTickers} tracked tickers. Top by volume:</p>
    <div class="rc-asset-table-wrap">
      <table class="rc-asset-table">
        <thead><tr>
          <th>Ticker</th>
          <th class="num">Tracked</th>
          <th class="num">Hit</th>
          <th class="num">Partial</th>
          <th class="num">Miss</th>
          <th class="num">Hit rate</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

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

${_renderPerAssetTable(opts.predictions || [])}

${_renderCalibration(opts.brierStats || null)}

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


// ─── 72H TRACK RECORD scorecard ───────────────────────────────────
// Per-brief HIT/PARTIAL/MISS scoring with per-type rubrics. Signal brief
// scored from predictions.json; radar/pulse/wrap show PENDING until
// brief-grading pipeline ships.

function computeBriefScores(date, briefs, predictionsArr, briefScores) {
  const slotLabels = {
    radar: 'MACRO RADAR',
    signal: 'SIGNAL SCAN',
    pulse: 'MARKET PULSE',
    wrap: 'MARKET WRAP',
  };
  const SLOT_ORDER = ['radar', 'signal', 'pulse', 'wrap'];

  return SLOT_ORDER.map(slot => {
    const brief = briefs.find(b => resolveSlot(b) === slot);
    const label = slotLabels[slot];

    if (!brief) {
      return { slot, label, status: 'absent', summary: 'No brief published' };
    }

    if (slot === 'signal') {
      const dayPreds = (predictionsArr || []).filter(p => p.date === date);
      if (dayPreds.length === 0) {
        return { slot, label, status: 'pending', summary: 'No prediction targets' };
      }
      const allPending = dayPreds.every(p => p.result === 'pending');
      if (allPending) {
        const scoreDate = dayPreds[0].scoreDate || '';
        return { slot, label, status: 'pending', summary: `Targets score ${scoreDate}` };
      }
      const byScen = {};
      dayPreds.forEach(p => {
        const k = p.scenario;
        if (!byScen[k]) byScen[k] = { name: p.scenarioName || '', targets: [] };
        byScen[k].targets.push(p);
      });
      let best = null;
      let bestHits = -1, bestPartials = -1;
      for (const [scen, data] of Object.entries(byScen)) {
        const h = data.targets.filter(t => t.result === 'hit').length;
        const pa = data.targets.filter(t => t.result === 'partial').length;
        if (h > bestHits || (h === bestHits && pa > bestPartials)) {
          bestHits = h; bestPartials = pa;
          best = { scen, name: data.name, hits: h, partials: pa, total: data.targets.length };
        }
      }
      let status;
      if (best.hits >= 2) status = 'hit';
      else if (best.hits >= 1 || best.partials >= 2) status = 'partial';
      else status = 'miss';
      const nameSuffix = best.name ? ` \u201c${best.name}\u201d` : '';
      const summary = `Scenario ${best.scen}${nameSuffix} landed ${best.hits}/${best.total}`;
      return { slot, label, status, summary };
    }

    // radar/pulse/wrap: look up scored result from brief-scores.json
    const dayScores = (briefScores || {})[date] || {};
    const score = dayScores[slot];
    if (score && score.status) {
      return { slot, label, status: score.status, summary: score.summary || '' };
    }
    return { slot, label, status: 'pending', summary: 'Brief-grading pipeline pending' };
  });
}

function renderDayScorecard(date, briefs, predictionsArr, briefScores) {
  const scores = computeBriefScores(date, briefs, predictionsArr, briefScores);
  const present = scores.filter(s => s.status !== 'absent');
  if (present.length === 0) return '';

  const h = scores.filter(s => s.status === 'hit').length;
  const p = scores.filter(s => s.status === 'partial').length;
  const m = scores.filter(s => s.status === 'miss').length;
  const pending = scores.filter(s => s.status === 'pending').length;
  const scored = h + p + m;

  // meta line
  let metaLine;
  if (scored === 0) {
    metaLine = `${present.length} brief${present.length === 1 ? '' : 's'} \u00b7 72h evaluation pending`;
  } else {
    const dayPreds = (predictionsArr || []).filter(pp => pp.date === date);
    const scoreDate = dayPreds.find(p => p.scoreDate)?.scoreDate || '';
    metaLine = `${scored} of ${present.length} scored${scoreDate ? ` \u00b7 ` + scoreDate : ''}${pending > 0 ? ` \u00b7 ${pending} pending` : ''}`;
  }

  const COLORS = {
    hit:     '#34d399',
    partial: '#ffc53d',
    miss:    '#f87171',
    pending: 'var(--text-3)',
    absent:  'var(--text-3)',
  };
  const LABELS = { hit: 'HIT', partial: 'PARTIAL', miss: 'MISS', pending: 'PENDING', absent: '\u2014' };

  const pill = (label, count, color) => `
    <div class="ac-agg-pill" style="border-color:${color}55;color:${color}">
      <div class="ac-agg-pill-label">${label}</div>
      <div class="ac-agg-pill-count">${count}</div>
    </div>`;

  const chip = (status) => `<span class="ac-score-chip" style="color:${COLORS[status]}">${LABELS[status]}</span>`;

  const rows = scores.map(s => `
    <div class="ac-score-row" data-status="${s.status}">
      <div class="ac-score-slot">${s.label}</div>
      <div class="ac-score-summary">${escapeHtml(s.summary)}</div>
      ${chip(s.status)}
    </div>`).join('');

  return `
    <section class="ac-scorecard" aria-label="72-hour track record">
      <div class="ac-scorecard-head">
        <div>
          <h2 class="ac-scorecard-title">72H TRACK RECORD</h2>
          <p class="ac-scorecard-meta">${escapeHtml(metaLine)}</p>
        </div>
        <div class="ac-scorecard-aggs">
          ${pill('HIT', h, '#34d399')}
          ${pill('PARTIAL', p, '#ffc53d')}
          ${pill('MISS', m, '#f87171')}
        </div>
      </div>
      <div class="ac-scorecard-rows">
        ${rows}
      </div>
    </section>`;
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
            author: { '@type': 'Organization', '@id': 'https://agentcanary.ai/#org', name: 'AgentCanary', url: 'https://agentcanary.ai/' },
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
      ${renderDayScorecard(date, sortedBriefs, opts.predictions || [], opts.briefScores || {})}
    `,
  });
}


// SEO content paragraph for /assets/{TICKER}/. Concatenates ticker-mention
// sentences from the 2-3 most recent briefs into a ~500-char block. Goal:
// give Google distinctive, ticker-keyword-rich content to index per asset.
function _assetContentBlurb(ticker, mentions) {
  const contexts = (mentions || [])
    .map(m => ({ date: m.date, slot: m.slotLabel, context: m.context }))
    .filter(x => x.context && x.context.length >= 30);
  if (contexts.length === 0) return '';
  // Take top 3 by recency (mentions already sorted desc), build paragraph
  const picks = contexts.slice(0, 3);
  let parts = [];
  let totalLen = 0;
  for (const p of picks) {
    const sentence = p.context.endsWith('.') ? p.context : p.context + '.';
    const prefix = `(${p.date}, ${p.slot})`;
    const full = `${prefix} ${sentence}`;
    if (totalLen + full.length > 500) break;
    parts.push(full);
    totalLen += full.length + 1;
  }
  if (parts.length === 0) return '';
  return `<p class="ac-asset-context" style="font-size:14px;line-height:1.65;color:var(--text-2);max-width:760px;margin:18px 0 28px;">${parts.map(p => escapeHtml(p)).join(' ')}</p>`;
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
    metaDescription: (() => {
      const stats = (opts.perAsset && opts.perAsset[ticker]) || null;
      const dateRange = mentions.length > 0
        ? `(${mentions[mentions.length-1].date} → ${mentions[0].date})`
        : '';
      if (stats && Number.isFinite(stats.hit_rate_pct)) {
        return `${ticker} tracked across ${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} ${dateRange}. Public hit rate ${stats.hit_rate_pct}% on scenario targets, weighted accuracy ${stats.weighted_pct}%. Most-recent-first archive with per-brief permalinks.`;
      }
      return `${ticker} mentioned in ${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} ${dateRange}. Macro radar, signal scan, market pulse, and wrap coverage. Most-recent-first archive with per-brief permalinks.`;
    })(),
    canonical: `https://agentcanary.ai/assets/${ticker}/`,
    ogImage: `https://agentcanary.ai/assets/${ticker}/og.png`,
    noindex,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    bodyHtml: `
      <div class="ac-hero">
        <div class="ac-eyebrow">THE RECORD · ASSET</div>
        <h1>${escapeHtml(ticker)}</h1>
        <p class="ac-hero-sub">${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} mention ${escapeHtml(ticker)}${mentions.length > 0 ? `, ranging from ${escapeHtml(mentions[mentions.length-1].date)} to ${escapeHtml(mentions[0].date)}` : ''}. Most recent first.</p>
      </div>
      <div class="ac-page-container">${_assetContentBlurb(ticker, mentions)}${mentionsHtml}</div>
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
    metaDescription: (() => {
      const dateRange = mentions.length > 0
        ? `(${mentions[mentions.length-1].date} → ${mentions[0].date})`
        : '';
      return `${mentions.length} AgentCanary brief${mentions.length === 1 ? '' : 's'} published while macro regime was ${slug.toUpperCase()} ${dateRange}. Full archive with per-brief permalinks, scenario targets, and scored predictions.`;
    })(),
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



// Extract a content-distinct meta description snippet from a brief's body.
// Solves the "Google sees the same description across 344 brief pages" issue —
// brief.headline + brief.desc are auto-derived templates ("MACRO RADAR — May 19" /
// "Risk 14/100 · 6 movers"). The first prose paragraph of the body is unique per
// brief. Returns ~100-150 chars suitable for <meta name="description">.
function _briefMetaSnippet(brief, target = 145) {
  const tg = brief.telegramText || brief.body || brief.content || '';
  if (!tg) return '';
  // Strip HTML
  let plain = tg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Remove boilerplate strap line
  plain = plain.replace(/Built for autonomous systems\. Useful for humans\./g, '');
  // Drop the "TITLE — Mon DD, YYYY" prefix
  plain = plain.replace(/^[A-Z][A-Z\s]+— [A-Z][a-z]+ \d+,? \d{4}\s*/, '').trim();
  // Skip the first section header so we land in actual content
  const SECTIONS = [
    'MACRO OVERVIEW', 'SNAPSHOT', 'MARKET OVERVIEW', 'DAILY SYNTHESIS',
    'CRYPTO LIVE', 'MARKET PULSE', 'OVERNIGHT', 'CRYPTO', 'EQUITY',
    'LIQUIDITY & CREDIT', 'MACRO', 'FORWARD SCENARIOS', 'SECTOR STRENGTH',
    'BIG MOVES + DRIVERS', 'NARRATIVES', 'RATES + CYCLE',
    'MACRO RISK DASHBOARD', 'DERIVATIVES SNAPSHOT', 'OPEN INTEREST',
  ];
  for (const hdr of SECTIONS) {
    if (plain.startsWith(hdr)) {
      plain = plain.slice(hdr.length).trim();
      break;
    }
  }
  if (plain.length <= target) return plain;
  const snippet = plain.slice(0, target);
  const lastPeriod = snippet.lastIndexOf('. ');
  if (lastPeriod > 80) return snippet.slice(0, lastPeriod + 1);
  return snippet.replace(/\s+$/, '') + '...';
}


// Parse telegramText into structured sections: [{name, body}]. Skips the
// header line ("MACRO RADAR — May 19, 2026") and the boilerplate strapline.
function _parseBriefSections(tg) {
  if (!tg) return [];
  const out = [];
  // Match <b>SECTION</b> headers + their bodies until next <b> or end.
  const re = /<b>([^<]+)<\/b>\s*([\s\S]*?)(?=<b>[^<]+<\/b>|$)/g;
  let m;
  while ((m = re.exec(tg)) !== null) {
    const name = m[1].trim();
    let body = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Skip the header line ("MACRO RADAR — May 19, 2026") — it has a — but no further content sections
    if (/^—\s*[A-Z][a-z]+\s+\d/.test(body)) continue;
    // Skip section if body is empty
    if (!body) continue;
    // Skip if the "section name" is actually a date-like header
    if (/^[A-Z][A-Z\s]+— [A-Z][a-z]+ \d+/.test(name)) continue;
    out.push({ name, body });
  }
  return out;
}

// Editorial H1 — pull the first interesting prose sentence from the first
// non-strapline section. For signal/wrap briefs this is editorial ("Risk-off
// rotation underway..."). For radar/pulse it's a data sentence ("Risk Gauge:
// 13.8/100 (Calm). Phase: OVERHEATING."). Truncate at sentence boundary, ~90 chars.
function _briefEditorialH1(sections, slotLabel, dayLabel) {
  // Look for the first PROSE sentence — skip key:value data lines
  // (e.g. "Risk Gauge: 13.8/100 (Calm)." or "BTC: $76,553") and skip
  // sentences that are mostly comma-separated values.
  for (const s of sections) {
    if (!s.body) continue;
    const sentences = s.body.split(/(?<=[.!?])\s+/).filter(x => x.trim().length >= 20);
    for (const sent of sentences) {
      const clean = sent.trim();
      // Skip data patterns
      if (/^[A-Z][\w &]+:\s*[\d$]/.test(clean)) continue;  // "Risk Gauge: 13.8" / "BTC: $76,553"
      if (/^Phase:|^Top:|^Composite Risk:|^Geopolitical risk:|^Global CB|^US M2|^HY Credit/.test(clean)) continue;
      // Skip if it's mostly numbers/percentages (>40% of chars are digits/symbols)
      const numChars = (clean.match(/[\d$%.,+\-]/g) || []).length;
      if (numChars / clean.length > 0.40) continue;
      // Truncate at ~90 chars on word boundary
      if (clean.length <= 90) return clean;
      const cut = clean.slice(0, 90);
      const lastSpace = cut.lastIndexOf(' ');
      return (lastSpace > 50 ? cut.slice(0, lastSpace) : cut) + '…';
    }
  }
  // Fallback: use first sentence regardless (might be data-heavy for radar)
  for (const s of sections) {
    if (!s.body) continue;
    const first = s.body.split(/(?<=[.!?])\s+/)[0] || s.body;
    const clean = first.trim();
    if (clean.length >= 20) {
      if (clean.length <= 90) return clean;
      const cut = clean.slice(0, 90);
      const lastSpace = cut.lastIndexOf(' ');
      return (lastSpace > 50 ? cut.slice(0, lastSpace) : cut) + '…';
    }
  }
  return `${slotLabel} — ${dayLabel}`;
}

// Compact key-data subline: regime + risk gauge + maybe top mover.
// Extracted from MACRO OVERVIEW or first section's data.
function _briefSubline(sections, slotLabel, dayLabel, fireTime) {
  const bits = [`${slotLabel} · ${dayLabel}, ${fireTime} UTC`];
  // Look across sections for regime + risk gauge
  const combined = sections.map(s => s.body).join(' ');
  const regime = combined.match(/Phase:\s*([A-Z_]+)/);
  const risk = combined.match(/Risk Gauge:\s*([\d.]+)\/100/);
  const composite = combined.match(/Composite Risk:\s*([\d.]+)\/100/);
  if (regime) bits.push(`Regime ${regime[1]}`);
  if (risk) bits.push(`Risk ${risk[1]}/100`);
  if (composite) bits.push(`Composite ${composite[1]}`);
  return bits.join(' · ');
}

// Lead paragraph: first 1-2 prose sentences from the first substantive section.
function _briefLead(sections, target = 220) {
  for (const s of sections) {
    if (!s.body || s.body.length < 40) continue;
    if (s.body.length <= target) return s.body;
    // Cut at sentence boundary
    const cut = s.body.slice(0, target);
    const lastPeriod = cut.lastIndexOf('. ');
    if (lastPeriod > 100) return cut.slice(0, lastPeriod + 1);
    return cut.trim() + '…';
  }
  return '';
}

// Extract key indicator pairs for the data section <dl>.
function _briefKeyIndicators(sections) {
  const combined = sections.map(s => s.body).join(' ');
  const pairs = [];
  const patterns = [
    [/Risk Gauge:\s*([\d.]+)\/100\s*\(([^)]+)\)/, (m) => ['Risk Gauge', `${m[1]}/100 (${m[2]})`]],
    [/Phase:\s*([A-Z_]+)/, (m) => ['Regime Phase', m[1]]],
    [/Composite Risk:\s*([\d.]+)\/100\s*\(([^)]+)\)/, (m) => ['Composite Risk', `${m[1]}/100 (${m[2]})`]],
    [/Geopolitical risk:\s*([\d.]+)\/100\s*\(([^)]+)\)/, (m) => ['Geopolitical Risk', `${m[1]}/100 (${m[2]})`]],
    [/Global CB Liquidity:\s*\$([\d.]+T)\s*\(YoY\s*([+\-\d.%]+)\)/, (m) => ['Global CB Liquidity', `$${m[1]} (YoY ${m[2]})`]],
    [/US M2:\s*\$([\d.]+T)\s*\(YoY\s*([+\-\d.%]+)\)/, (m) => ['US M2', `$${m[1]} (YoY ${m[2]})`]],
    [/HY Credit Spreads:\s*([\d]+bps)\s+([A-Z]+)/, (m) => ['HY Credit Spreads', `${m[1]} (${m[2]})`]],
    [/Crypto sentiment:\s*(\d+)\s*\(([^)]+)\)/, (m) => ['Crypto Sentiment', `${m[1]} (${m[2]})`]],
    [/Equity sentiment \(CNN F&G\):\s*([\d.]+)\s*\(([^)]+)\)/, (m) => ['Equity Sentiment (CNN F&G)', `${m[1]} (${m[2]})`]],
    [/BTC:\s*\$([\d,.]+)/, (m) => ['BTC', `$${m[1]}`]],
    [/ETH:\s*\$([\d,.]+)/, (m) => ['ETH', `$${m[1]}`]],
  ];
  for (const [re, fn] of patterns) {
    const m = combined.match(re);
    if (m) pairs.push(fn(m));
  }
  return pairs;
}

// Render sections as h2 + prose blocks. Skips the data already shown in
// the data section header (MACRO OVERVIEW becomes covered by Key Indicators).
function _renderBriefSections(sections) {
  // Skip sections already covered by Key Indicators block
  const SKIP_OVERLAP = new Set(['MACRO OVERVIEW', 'MARKET OVERVIEW', 'SNAPSHOT']);
  // Skip non-editorial / utility sections (JSON peek, structured exports, footer notes)
  const SKIP_ENTIRELY = new Set(['JSON', 'JSON PEEK', 'RAW DATA', 'FOOTER', 'AGENT JSON']);
  // Acronyms that should stay uppercase after title-casing
  const ACRONYMS = new Set(['US','UK','EU','EUR','UAE','OI','FX','CB','M2','M1','HY','IG','BTC','ETH','SOL','XRP','LP','ETF','SEC','CPI','PPI','PCE','GDP','FOMC','ECB','BOJ','PBOC','RBI','CFTC','TIC','VIX','DXY','SPX','SPY','QQQ','TLT','GLD','SLV','BPS','YOY','YTD','MOM','ATH','BB','SMA','EMA','RSI','MACD','API','MCP','ICSA','LEI','PMI','ISM']);
  return sections.map(s => {
    const upperName = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
    if (SKIP_ENTIRELY.has(upperName)) return '';
    // Title-case with acronym preservation
    const title = s.name.toLowerCase().split(/\s+/).map(w => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Lowercase connectors stay lowercase if not first word
      if (['vs','and','or','of','the','for','to','in','on','with'].includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
    // Body: replace · with line breaks for line-y data, keep prose flowing
    let bodyHtml;
    if (SKIP_OVERLAP.has(s.name.toUpperCase())) {
      // Already extracted to Key Indicators — render as compact summary
      const sentences = s.body.split(/(?<=[.!?])\s+/).filter(x => x.trim().length > 10);
      // Skip the data-heavy first sentence (Risk Gauge etc.), keep contextual ones
      const contextual = sentences.filter(x => !/^Risk Gauge|^Phase:|^Composite|^Geopolitical/.test(x));
      if (contextual.length === 0) return ''; // no extra prose beyond data
      bodyHtml = `<p>${escapeHtml(contextual.join(' '))}</p>`;
    } else {
      // Render as paragraphs, splitting on multiple periods or line breaks (·, |)
      const escapedBody = escapeHtml(s.body);
      bodyHtml = `<p>${escapedBody}</p>`;
    }
    if (!bodyHtml || bodyHtml === '<p></p>') return '';
    return `<section class="ac-brief-section">
      <h2 class="ac-brief-h2">${escapeHtml(title)}</h2>
      <div class="ac-brief-section-body">${bodyHtml}</div>
    </section>`;
  }).filter(Boolean).join('\n');
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
    // Full body (no 600-char clip) — gives Google + AI-search the full
    // editorial content for indexing. Empty-body briefs keep brief.desc.
    articleBody = stripped;
  }
  // Editorial headline for JSON-LD (overrides templated brief.headline)
  const _sectionsForLd = _parseBriefSections(brief.telegramText || '');
  const editorialHeadline = _sectionsForLd.length > 0
    ? _briefEditorialH1(_sectionsForLd, meta.label, dayLabel)
    : brief.headline;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: editorialHeadline,
    description: `${meta.label} · ${dayLabel}: ${_briefMetaSnippet(brief)}`,
    articleBody,
    image: briefOgUrl,
    datePublished: brief.publishedAt || `${brief.date}T${meta.fireTimeUTC}:00Z`,
    dateModified: brief.publishedAt || `${brief.date}T${meta.fireTimeUTC}:00Z`,
    url: briefUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': briefUrl },
    author: { '@type': 'Organization', '@id': 'https://agentcanary.ai/#org', name: 'AgentCanary', url: 'https://agentcanary.ai/' },
    publisher: {
      '@type': 'Organization',
      name: 'AgentCanary',
      url: 'https://agentcanary.ai',
      logo: { '@type': 'ImageObject', url: 'https://agentcanary.ai/logo.png' },
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
  // F1: noindex briefs with empty telegramText (thin content — Feb/early-Mar archive gaps)
  const _hasContent = (brief.telegramText || brief.body || brief.content || '').length > 100;
  return wrapPage({
    title: `${meta.label} — ${dayLabel} | The Record | AgentCanary`,
    metaDescription: `${meta.label} · ${dayLabel}: ${_briefMetaSnippet(brief)}`,
    canonical: `https://agentcanary.ai${briefPermalink(brief, slot)}`,
    noindex: !_hasContent,
    ogImage: briefOgUrl,
    prev: prev ? briefPermalink(prev, slot) : null,
    next: next ? briefPermalink(next, slot) : null,
    jsonLd,
    breadcrumbHtml: renderBreadcrumb(breadcrumb),
    topRightHtml: `<div class="ac-day-nav">${navParts.join('')}</div>`,
    bodyHtml: (() => {
      const sections = _parseBriefSections(brief.telegramText || brief.body || '');
      // Weekend banner shared between fallback + main render paths.
      const _weekendBannerHtml = (brief && brief.isWeekend && brief.weekendBanner)
        ? `<div class="ac-weekend-banner">${escapeHtml(brief.weekendBanner)}</div>\n`
        : '';
      if (sections.length === 0) {
        // Empty-body brief (~32 Feb/early-Mar): minimal page, will be noindexed
        return _weekendBannerHtml + `<article class="ac-brief-article">
  <header class="ac-brief-header">
    <div class="ac-eyebrow">${escapeHtml(meta.label)} · ${escapeHtml(dayLabel)} · ${escapeHtml(meta.fireTimeUTC)} UTC</div>
    <h1 class="ac-brief-h1">${escapeHtml(meta.label)} — ${escapeHtml(dayLabel)}</h1>
    <p class="ac-brief-lead" style="color:var(--text-3);font-style:italic">Brief content unavailable for this date in the archive. Browse the rest of <a href="/record/">The Record</a> for available briefs.</p>
  </header>
</article>`;
      }
      const editorialH1 = _briefEditorialH1(sections, meta.label, dayLabel);
      const subline = _briefSubline(sections, meta.label, dayLabel, meta.fireTimeUTC);
      const lead = _briefLead(sections);
      const indicators = _briefKeyIndicators(sections);
      const sectionsHtml = _renderBriefSections(sections);
      const dlHtml = indicators.length > 0
        ? `<section class="ac-brief-data">
    <h2 class="ac-brief-h2">Key indicators</h2>
    <dl class="ac-brief-dl">
      ${indicators.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('\n      ')}
    </dl>
  </section>`
        : '';
      // Weekend banner (computed above, shared between fallback + main paths).
      return _weekendBannerHtml + `<article class="ac-brief-article">
  <header class="ac-brief-header">
    <div class="ac-eyebrow">${escapeHtml(meta.label)} · ${escapeHtml(dayLabel)} · ${escapeHtml(meta.fireTimeUTC)} UTC</div>
    <h1 class="ac-brief-h1">${escapeHtml(editorialH1)}</h1>
    <p class="ac-brief-subline">${escapeHtml(subline)}</p>
    ${lead ? `<p class="ac-brief-lead">${escapeHtml(lead)}</p>` : ''}
  </header>
  ${dlHtml}
  ${sectionsHtml}
</article>`;
    })(),
  });
}

// ─── Page chrome wrapper ─────────────────────────────────────────

const _ACCESS_LINE = `<p class="ac-seo-footer-access"><a href="https://api.agentcanary.ai/api/docs">REST API</a> · <a href="https://www.npmjs.com/package/agentcanary-mcp">MCP server</a> (<code>npx agentcanary-mcp</code>) · <a href="/record/feed.json">JSON Feed</a> · <a href="/record/rss.xml">RSS</a> · <a href="https://clawhub.ai/MrCerq/agentcanary">ClawHub skill</a> · AI crawlers allowlisted via <a href="/llms.txt">llms.txt</a></p>`;

// Generic footer (homepage + /record/ + /sources/ + anything we don't know how to
// specialize). Same prose as before so the canonical landing surfaces don't lose it.
const _GENERIC_FOOTER = `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About AgentCanary</h2>
  <p>AgentCanary is the decision-grade market intelligence layer for autonomous AI agents. It delivers regime classifications, risk scores, narrative momentum, scenario probabilities, and public track-record-verified signals via simple API + MCP. No KYC, wallet-billed in stablecoins, schema-stable, fail-soft.</p>
  <p>Stop building your own 80-source data pipeline. AgentCanary gives you 50+ pre-curated, second-order signals with provenance, freshness, and public accuracy scores. Free tier available. MCP-native.</p>
  ${_ACCESS_LINE}
</div></section>`;

// Page-aware SEO footer. Inspects the canonical URL to determine page type and
// returns distinct prose so Google doesn't see the same About-AgentCanary block
// across 500+ pages and pick it as the snippet for every URL.
function _seoFooter(canonical) {
  const url = canonical || '';

  // /assets/{TICKER}/
  const mAsset = url.match(/\/assets\/([A-Z0-9-]+)\/?$/);
  if (mAsset) {
    const t = mAsset[1];
    return `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About AgentCanary's ${t} coverage</h2>
  <p>Every AgentCanary brief mentioning <strong>${t}</strong> is permalinked here with date, slot (radar / signal / pulse / wrap), and a direct link to the source brief. Mentions are time-sorted, most-recent first. Scenario targets that include ${t} are scored 72 hours after publication against actual market outcomes.</p>
  <p>Per-asset hit rate, Brier score, and reliability bucketing are published openly at <a href="/record/">/record/</a>. AgentCanary tracks ${t} as part of a broader macro + crypto coverage surface designed for autonomous agent consumption — schema-stable JSON via REST + MCP, freshness envelopes on every response, no KYC.</p>
  ${_ACCESS_LINE}
</div></section>`;
  }

  // /regimes/{slug}/
  const mRegime = url.match(/\/regimes\/([a-z-]+)\/?$/);
  if (mRegime) {
    const slug = mRegime[1];
    const label = slug.charAt(0).toUpperCase() + slug.slice(1);
    return `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About the ${label} regime page</h2>
  <p>AgentCanary classifies macro state into six canonical regimes: overheating, expansion, stagflation, contraction, recession, and displacement. This page lists every brief published while the regime was <strong>${slug}</strong>, ordered most-recent first.</p>
  <p>Regime classifications are derived from 30+ FRED series plus risk gauge composites. Every brief includes the regime stamp at publication time so historical regime context is preserved across the 86-day archive.</p>
  ${_ACCESS_LINE}
</div></section>`;
  }

  // /record/YYYY/MM/DD/{slot}/ — per-brief permalink
  const mBrief = url.match(/\/record\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z]+)\/?$/);
  if (mBrief) {
    const [, y, m, d, slot] = mBrief;
    const SLOT_LABEL = { radar: 'Macro Radar', signal: 'Signal Scan', pulse: 'Market Pulse', wrap: 'Market Wrap' }[slot] || slot;
    const SLOT_TIME = { radar: '03:15', signal: '09:15', pulse: '15:15', wrap: '21:15' }[slot] || '?';
    return `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About this ${SLOT_LABEL} brief</h2>
  <p>This ${SLOT_LABEL} brief was published ${y}-${m}-${d} at ${SLOT_TIME} UTC. AgentCanary publishes four briefs per day on a fixed cadence — Macro Radar (03:15Z), Signal Scan (09:15Z), Market Pulse (15:15Z), Market Wrap (21:15Z). Each brief is auto-generated from live data and stamped with the macro regime at publication time.</p>
  <p>Scenario targets in this brief are scored 72 hours after publication against actual market outcomes. See <a href="/record/">/record/</a> for the full hit/miss track record, per-asset accuracy, and Brier-based reliability table.</p>
  ${_ACCESS_LINE}
</div></section>`;
  }

  // /record/YYYY/MM/DD/ — day page (no slot)
  const mDay = url.match(/\/record\/(\d{4})\/(\d{2})\/(\d{2})\/?$/);
  if (mDay) {
    const [, y, m, d] = mDay;
    return `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About this day in The Record</h2>
  <p>All AgentCanary briefs published on ${y}-${m}-${d}, in fire order. Each brief has its own permalink; aggregate scoring (radar regime classification, signal scenario targets, pulse direction, wrap next-day setup) is reflected in the day's track-record card above when the 72h scoring window has elapsed.</p>
  <p>Browse other days via the breadcrumb above or the <a href="/record/">main Record</a> for archive + per-asset hit rates.</p>
  ${_ACCESS_LINE}
</div></section>`;
  }

  // /sources/
  if (url.endsWith('/sources/') || url.endsWith('/sources')) {
    return `<section class="ac-seo-footer"><div class="ac-seo-footer-inner">
  <h2 class="ac-seo-footer-title">About AgentCanary's source contracts</h2>
  <p>AgentCanary publishes a freshness SLA per dataset so agents can gate on data quality before consuming. Every /api/data response carries a <code>provenance</code> envelope with <code>observed_at</code>, <code>age_seconds</code>, <code>sla_seconds</code>, and <code>freshness_status</code> (fresh, degraded, or stale). Agents should skip stale data rather than silently use it.</p>
  ${_ACCESS_LINE}
</div></section>`;
  }

  // Fallback — homepage, /record/, /briefs/, anything else
  return _GENERIC_FOOTER;
}


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
${_seoFooter(canonical)}
${renderFooter()}
</body>
</html>`;
}
