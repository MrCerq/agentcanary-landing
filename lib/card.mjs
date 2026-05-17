// agentcanary-landing/lib/card.mjs
// Canonical card renderer for The Record time machine.
// Per TIME-MACHINE-V1-SPEC.md §7 + §8.
//
// renderCard(brief, tier) → string
//   tier ∈ 'tile' | 'card' | 'page'
//
// Each tier composes the previous + new sections. Single source of truth
// for visual presentation across server (build-record.js) AND client
// (landing inline JS).

import {
  THEME,
  TAG_COLORS,
  resolveSlot,
  slotMeta,
  escapeHtml,
  humanize,
  entityLink,
  formatDate,
  resolveAsset,
} from './render-utils.mjs';

const TIER_PAGE_PADDING = '32px 36px';
const TIER_PAGE_HEADLINE = 'clamp(22px, 3vw, 32px)';
const TIER_CARD_PADDING = '32px 36px';
const TIER_CARD_HEADLINE = 'clamp(22px, 3vw, 32px)';
const TIER_TILE_PADDING = '16px 20px';
const TIER_TILE_HEADLINE = '15px';

// ─── Public API ───────────────────────────────────────────────────

export function renderCard(brief, tier = 'card', opts = {}) {
  if (!brief) throw new Error('renderCard: brief required');
  const slot = resolveSlot(brief);
  if (!slot) throw new Error('renderCard: brief has no resolvable slot');
  const meta = slotMeta(slot);

  switch (tier) {
    case 'tile':  return renderTile(brief, slot, meta, opts);
    case 'card':  return renderCardTier(brief, slot, meta, opts);
    case 'page':  return renderPageTier(brief, slot, meta, opts);
    default: throw new Error('renderCard: unknown tier "' + tier + '"');
  }
}

// ─── Tier 1: Tile ─────────────────────────────────────────────────

function renderTile(brief, slot, meta, opts) {
  const href = opts.href || briefPermalink(brief, slot);
  const firstRegime = (brief.tags || []).find(t => t && (t.c === 'blue' || t.c === 'purple'));
  const tagHtml = firstRegime ? renderTag(firstRegime) : '';
  return `<a class="ac-tile" href="${escapeHtml(href)}" style="display:block;padding:${TIER_TILE_PADDING};border:1px solid rgba(255,255,255,0.06);border-radius:12px;background:rgba(255,255,255,0.02);text-decoration:none;color:inherit;transition:border-color 0.2s">
  <div class="ac-tile-header" style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    ${renderSlotBadge(slot, meta)}
    <span class="mono" style="font-size:11px;color:#4a5a7a">${escapeHtml(meta.fireTimeUTC)} UTC</span>
  </div>
  <div class="ac-tile-headline" style="font-size:${TIER_TILE_HEADLINE};font-weight:600;line-height:1.3;margin-bottom:6px">${escapeHtml(cleanHeadline(brief))}</div>
  ${tagHtml}
</a>`;
}

// ─── Tier 2: Card ─────────────────────────────────────────────────

function renderCardTier(brief, slot, meta, opts) {
  const tagsHtml = (brief.tags || []).map(renderTag).join('');
  const panelsHtml = renderPanels(brief.panels || []);
  return `<div class="ac-card" style="padding:${TIER_CARD_PADDING};border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:linear-gradient(135deg,rgba(8,13,22,1) 0%,rgba(4,7,12,1) 100%);max-width:1000px;position:relative;overflow:hidden">
  <div class="ac-card-header" style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    ${renderSlotBadge(slot, meta)}
    <span class="mono" style="font-size:11px;color:#4a5a7a">${escapeHtml(meta.fireTimeUTC)} UTC</span>
  </div>
  <div class="ac-card-body" style="display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap">
    <div style="flex:1;min-width:280px">
      <h2 class="ac-card-headline" style="font-size:${TIER_CARD_HEADLINE};font-weight:700;line-height:1.2;letter-spacing:-1px;margin-bottom:12px;color:${TAG_COLORS[meta.color]}">${escapeHtml(cleanHeadline(brief))}</h2>
      <p class="ac-card-desc" style="font-size:13px;color:#8a9abc;line-height:1.7;margin-bottom:16px">${escapeHtml(cleanDesc(brief))}</p>
      <div class="ac-card-tags" style="display:flex;gap:8px;flex-wrap:wrap">${tagsHtml}</div>
    </div>
    <div class="ac-card-panels" style="display:flex;flex-direction:column;gap:8px;min-width:240px">${panelsHtml}</div>
  </div>
</div>`;
}

// ─── Tier 3: Page ─────────────────────────────────────────────────

function renderPageTier(brief, slot, meta, opts) {
  const cardHtml = renderCardTier(brief, slot, meta, opts);
  const bodyHtml = renderBody(brief, opts);
  // Page tier = Card visual + body section expanded below.
  // Visual parity rule (spec §8): no smaller padding, no smaller headline,
  // body NOT collapsed by default.
  return `<article class="ac-page" id="brief-${slot}-${brief.date || ''}" style="margin-bottom:32px">
  ${cardHtml}
  <div class="ac-page-body" style="margin-top:20px;padding:32px 36px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:rgba(255,255,255,0.01);font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.7;color:#c3cee0">${bodyHtml}</div>
</article>`;
}

// ─── Component bits ──────────────────────────────────────────────

function renderSlotBadge(slot, meta) {
  const c = TAG_COLORS[meta.color] || '#ffc53d';
  return `<span class="ac-slot-badge mono" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;padding:5px 12px;border-radius:100px;border:1px solid ${c}40;color:${c};background:${c}10">${escapeHtml(meta.label)}</span>`;
}

function renderTag(tag) {
  if (!tag || !tag.t) return '';
  const c = TAG_COLORS[tag.c] || '#ffc53d';
  return `<span class="ac-tag mono" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid ${c}40;background:${c}10;color:${c}">${escapeHtml(tag.t)}</span>`;
}

function renderPanels(panels) {
  return panels.map(renderPanel).join('');
}

function renderPanel(panel) {
  if (!panel) return '';
  // Gauge panel — has either explicit type='gauge' OR legacy .gauge.value
  if (panel.type === 'gauge' || (panel.gauge && Number.isFinite(panel.gauge.value))) {
    const value = panel.value ?? panel.gauge?.value;
    const color = value >= 70 ? '#f87171' : value >= 40 ? '#ffc53d' : '#34d399';
    return `<div class="ac-panel ac-panel-gauge" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px">
      <div class="ac-panel-label mono" style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;color:#4a5a7a;margin-bottom:8px">${escapeHtml(panel.label || 'GAUGE')}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:800;color:${color};line-height:1">${escapeHtml(String(value))}</div>
    </div>`;
  }
  // Rows panel — has either explicit type='rows' OR legacy .rows[]
  if (panel.type === 'rows' || Array.isArray(panel.rows)) {
    const rowsHtml = (panel.rows || []).map(r => {
      const c = TAG_COLORS[r.c] || '#8a9abc';
      return `<div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:12px"><span style="color:#8a9abc">${escapeHtml(r.k)}</span><span style="color:${c}">${escapeHtml(humanize(r.v))}</span></div>`;
    }).join('');
    return `<div class="ac-panel ac-panel-rows" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px">
      <div class="ac-panel-label mono" style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;color:#4a5a7a;margin-bottom:8px">${escapeHtml(panel.label || 'ROWS')}</div>
      <div style="display:flex;flex-direction:column;gap:4px">${rowsHtml}</div>
    </div>`;
  }
  return '';
}

// ─── Body rendering with entity links ──────────────────────────────

function renderBody(brief, opts) {
  const raw = brief.body ?? brief.telegramText ?? '';
  if (!raw) return '<i style="color:#8a9abc">No body content.</i>';
  // Preserve Telegram-flavored HTML (b/i tags), convert \n→<br>, add entity links.
  let out = String(raw)
    .replace(/&amp;/g, '&')
    .replace(/\n/g, '<br>');
  // Entity link rewrite — only attempts inserts on assets and regimes if
  // the brief carries an entities block (post-migration).
  if (opts && opts.assetMap && brief.entities && Array.isArray(brief.entities.assets)) {
    out = insertAssetLinks(out, brief.entities.assets, opts.assetMap);
  }
  if (brief.entities && brief.entities.regime) {
    out = insertRegimeLinks(out, brief.entities.regime);
  }
  return out;
}

function insertAssetLinks(html, assets, assetMap) {
  // For each canonical asset, wrap the FIRST occurrence in body with a link.
  // (Wrapping every occurrence would link-spam; first occurrence per brief
  // is the index-signal Google needs.)
  let out = html;
  for (const sym of assets) {
    const entry = assetMap.find(e => e.symbol === sym);
    if (!entry) continue;
    // Try each alias longest-first, replacing first occurrence
    const aliases = (entry.aliases || [sym]).slice().sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^A-Za-z0-9])(' + esc + ')(?=[^A-Za-z0-9]|$)');
      const m = out.match(re);
      if (m) {
        out = out.replace(re, '$1' + entityLink(sym, 'asset'));
        break; // moved to next symbol
      }
    }
  }
  return out;
}

function insertRegimeLinks(html, regimeSlug) {
  // Wrap first occurrence of the regime word (case-insensitive) in body.
  const re = new RegExp('(^|[^A-Za-z])(' + regimeSlug + ')(?=[^A-Za-z]|$)', 'i');
  const m = html.match(re);
  if (m) {
    return html.replace(re, '$1' + entityLink(regimeSlug, 'regime'));
  }
  return html;
}

// ─── Headline + desc cleanup (legacy salvage) ─────────────────────

function cleanHeadline(brief) {
  return brief.headline || '';
}

function cleanDesc(brief) {
  let d = brief.desc || '';
  return humanize(d);
}

// ─── Permalink helper ─────────────────────────────────────────────

export function briefPermalink(brief, slot) {
  const s = slot || resolveSlot(brief);
  if (!s || !brief.date) return '/record/';
  const [y, m, d] = brief.date.split('-');
  return `/record/${y}/${m}/${d}/${s}/`;
}
