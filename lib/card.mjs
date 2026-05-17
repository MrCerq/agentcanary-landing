// agentcanary-landing/lib/card.mjs — TIMELINE design (v2)
// Per TIME-MACHINE-V1-SPEC §7 with the timeline visual passed in 2026-05-17.

import {
  THEME,
  SLOTS,
  resolveSlot,
  slotMeta,
  escapeHtml,
  humanize,
  formatDate,
  resolveAsset,
  extractBriefHighlights,
} from './render-utils.mjs';

// ─── Public API ───────────────────────────────────────────────────

export function renderCard(brief, tier = 'card', opts = {}) {
  if (!brief) throw new Error('renderCard: brief required');
  const slot = resolveSlot(brief);
  if (!slot) throw new Error('renderCard: brief has no resolvable slot');
  const meta = slotMeta(slot);

  switch (tier) {
    case 'tile':  return renderTile(brief, slot, meta, opts);
    case 'card':  return renderCardTier(brief, slot, meta, opts);
    case 'page':  return renderTimelineRow(brief, slot, meta, opts);
    default: throw new Error('renderCard: unknown tier "' + tier + '"');
  }
}

// ─── Tile (archive listings, no chrome) ──────────────────────────

function renderTile(brief, slot, meta, opts) {
  const href = opts.href || briefPermalink(brief, slot);
  const firstRegime = (brief.tags || []).find(t => t && (t.c === 'blue' || t.c === 'purple'));
  const tagHtml = firstRegime ? renderTag(firstRegime) : '';
  const slotPill = renderSlotPill(slot, meta);
  return `<a class="ac-tile" href="${escapeHtml(href)}">
  <div class="ac-tile-header">
    ${slotPill}
    <span class="ac-card-time">${escapeHtml(meta.fireTimeUTC)} UTC</span>
  </div>
  <div class="ac-tile-headline">${escapeHtml(cleanHeadline(brief))}</div>
  ${tagHtml}
</a>`;
}

// ─── Card (landing live-preview) ─────────────────────────────────

function renderCardTier(brief, slot, meta, opts) {
  // Reuse the "ac-card" shape used inside the timeline row, just unwrapped
  // from the timeline rail so the landing-page mount renders cleanly.
  return renderBriefCardInner(brief, slot, meta, opts);
}

// ─── Page tier = Timeline row (one row per brief on day page) ────

function renderTimelineRow(brief, slot, meta, opts) {
  // Returns a fragment: tl-time + tl-rail + tl-rail's card.
  // wrap with grid container at the caller (renderIndex 'day').
  // Returned as a 2-tuple via array, joined by caller — but for now we
  // just return the full row as a single block including the time column.
  const inner = renderBriefCardInner(brief, slot, meta, opts);
  const colorVar = slotColorVar(meta.color);
  const rgb = meta.accentRgb;
  return `<div class="ac-tl-time"><div class="clock">${escapeHtml(meta.fireTimeUTC)}</div><div class="slot">${escapeHtml(slot.toUpperCase())}</div></div>
<div class="ac-tl-rail${opts.isLast ? ' last' : ''}" style="border-left-color: ${colorVar};">
  <div class="ac-tl-dot" style="border-color: ${colorVar}; box-shadow: 0 0 10px ${colorVar};"></div>
  ${inner}
</div>`;
}

// ─── Inner card body (shared by Card + Timeline page tiers) ──────

function renderBriefCardInner(brief, slot, meta, opts) {
  const colorVar = slotColorVar(meta.color);
  const rgb = meta.accentRgb;
  const tagsHtml = (brief.tags || []).map(renderTag).join('');
  const bodyHtml = renderBody(brief, opts);
  const highlights = extractBriefHighlights(brief, slot);
  const highlightsHtml = highlights.length === 0 ? '' : (
    `<aside class="ac-side"><div class="ac-side-label">${escapeHtml(slot.toUpperCase())} · KEY NUMBERS</div>` +
    highlights.map(h => `<div class="ac-mrow"><span class="sym">${escapeHtml(h.label)}</span><span class="val ${escapeHtml(h.color || '')}">${escapeHtml(h.value)}</span></div>`).join('') +
    `</aside>`
  );
  const briefId = `brief-${slot}-${(brief.date || '').replace(/-/g, '')}`;
  const permalink = briefPermalink(brief, slot);
  const slotPillStyle = `color: ${colorVar}; background: rgba(${rgb},0.08); border-color: rgba(${rgb},0.2);`;
  const slotDotStyle = `background: ${colorVar}; box-shadow: 0 0 8px ${colorVar};`;
  return `<article class="ac-card" id="${escapeHtml(briefId)}">
    <div class="ac-card-head">
      <span class="ac-slot-pill" style="${slotPillStyle}"><span class="dot" style="${slotDotStyle}"></span>${escapeHtml(meta.label)}</span>
      <span class="ac-card-time">${escapeHtml(meta.fireTimeUTC)} UTC</span>
      <a class="ac-card-perma" href="${escapeHtml(permalink)}" title="Per-brief permalink">#</a>
    </div>
    <h2 class="ac-card-headline">${escapeHtml(cleanHeadline(brief))}</h2>
    <p class="ac-card-desc">${escapeHtml(cleanDesc(brief))}</p>
    ${tagsHtml ? `<div class="ac-card-pills">${tagsHtml}</div>` : ''}
    <div class="ac-card-body">
      <div>
        <details class="ac-toggle">
          <summary><span class="ac-chev">▾</span>EXPAND BRIEF CONTENT</summary>
          <div class="ac-body-text">${bodyHtml}</div>
        </details>
      </div>
      ${highlightsHtml}
    </div>
  </article>`;
}

// ─── Component bits ──────────────────────────────────────────────

function renderSlotPill(slot, meta) {
  const colorVar = slotColorVar(meta.color);
  const rgb = meta.accentRgb;
  return `<span class="ac-slot-pill" style="color: ${colorVar}; background: rgba(${rgb},0.08); border-color: rgba(${rgb},0.2);"><span class="dot" style="background: ${colorVar}; box-shadow: 0 0 8px ${colorVar};"></span>${escapeHtml(meta.label)}</span>`;
}

function renderTag(tag) {
  if (!tag || !tag.t) return '';
  const c = tag.c || 'yellow';
  return `<span class="ac-pill ac-pill-${c}"><span class="dot"></span>${escapeHtml(tag.t)}</span>`;
}

function renderSideMovers(brief) {
  // Find a TOP MOVERS panel
  const panel = (brief.panels || []).find(p => p && p.label === 'TOP MOVERS' && Array.isArray(p.rows));
  if (!panel) return '';
  const rows = panel.rows.slice(0, 6).map(r => {
    const colorClass = r.c === 'red' ? 'red' : r.c === 'green' ? 'green' : r.c === 'yellow' ? 'yellow-c' : '';
    const v = humanize(r.v).replace('-', '−');  // Use unicode minus
    return `<a class="ac-mrow" href="/assets/${escapeHtml(r.k)}/"><span class="sym">${escapeHtml(r.k)}</span><span class="val ${colorClass}">${escapeHtml(v)}</span></a>`;
  }).join('');
  return `<div class="ac-side-label">TOP MOVERS</div>${rows}`;
}

// ─── Body rendering with entity links ────────────────────────────

function renderBody(brief, opts) {
  const raw = brief.body ?? brief.telegramText ?? '';
  if (!raw) return '<i style="color:#8a9abc">No body content.</i>';
  // The .ac-body-text container uses white-space: pre-wrap so we want
  // actual newlines, not <br>. Convert <br> to \n, keep <b>/<i>.
  let out = String(raw)
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?>/gi, '\n');
  // Entity link rewrite
  if (opts && opts.assetMap && brief.entities && Array.isArray(brief.entities.assets)) {
    out = insertAssetLinks(out, brief.entities.assets, opts.assetMap);
  }
  if (brief.entities && brief.entities.regime) {
    out = insertRegimeLinks(out, brief.entities.regime);
  }
  return out;
}

function insertAssetLinks(html, assets, assetMap) {
  let out = html;
  for (const sym of assets) {
    const entry = assetMap.find(e => e.symbol === sym);
    if (!entry) continue;
    const aliases = (entry.aliases || [sym]).slice().sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^A-Za-z0-9])(' + esc + ')(?=[^A-Za-z0-9]|$)');
      const m = out.match(re);
      if (m) {
        out = out.replace(re, '$1<a class="lt" href="/assets/' + sym + '/">$2</a>');
        break;
      }
    }
  }
  return out;
}

function insertRegimeLinks(html, regimeSlug) {
  const re = new RegExp('(^|[^A-Za-z])(' + regimeSlug + ')(?=[^A-Za-z]|$)', 'i');
  const m = html.match(re);
  if (m) {
    return html.replace(re, '$1<a class="lr" href="/regimes/' + regimeSlug + '/">$2</a>');
  }
  return html;
}

// ─── Helpers ─────────────────────────────────────────────────────

function slotColorVar(color) {
  return `var(--${color})`;
}

function cleanHeadline(brief) {
  return brief.headline || '';
}

function cleanDesc(brief) {
  return humanize(brief.desc || '');
}

export function briefPermalink(brief, slot) {
  const s = slot || resolveSlot(brief);
  if (!s || !brief.date) return '/record/';
  const [y, m, d] = brief.date.split('-');
  return `/record/${y}/${m}/${d}/${s}/`;
}
