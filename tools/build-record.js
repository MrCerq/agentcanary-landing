#!/usr/bin/env node
/**
 * AgentCanary — The Record: Static Site Generator
 *
 * Fetches briefs from the AC API and generates static HTML pages:
 *   record/YYYY/MM/DD/index.html  — daily pages
 *   record/index.html             — archive listing (also written to record/archive/)
 *   record/feed.json              — JSON Feed 1.1
 *   sitemap.xml                   — updated with /record/ pages
 *
 * Usage:
 *   node tools/build-record.js          # full build
 *   node tools/build-record.js --dry    # preview without writing
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_URL = 'https://api.agentcanary.ai/api/briefs/archive?limit=500';
const SITE_URL = 'https://agentcanary.ai';
const DRY = process.argv.includes('--dry');

// ─── Colors & Config ─────────────────────────────────────────────

const COLORS = {
  bg: '#04070c', bgCard: '#080d16', bgCardHover: '#0c1220',
  y: '#ffc53d', g: '#34d399', r: '#f87171', o: '#fb923c', p: '#a78bfa',
  t1: '#e4e9f2', t2: '#8a9abc', t3: '#4a5a7a',
  border: 'rgba(255,255,255,0.06)', borderLight: 'rgba(255,255,255,0.10)',
};

const SESSION_META = {
  morning:      { label: 'MORNING BRIEF',  icon: '&#10035;', color: COLORS.o, rgb: '251,146,60',  order: 0 },
  midday:       { label: 'MARKET PULSE',   icon: '&#9680;',  color: COLORS.y, rgb: '255,197,61',  order: 1 },
  intelligence: { label: 'SIGNAL SCAN',    icon: '&#9680;',  color: COLORS.g, rgb: '52,211,153',  order: 2 },
  signal:       { label: 'SIGNAL SCAN',    icon: '&#9680;',  color: COLORS.g, rgb: '52,211,153',  order: 2 },
  evening:      { label: 'EVENING WRAP',   icon: '&#9681;',  color: COLORS.p, rgb: '167,139,250', order: 3 },
  cycle:        { label: 'CYCLE CHECK',    icon: '&#9881;',  color: COLORS.y, rgb: '255,197,61',  order: 4 },
};

const TAG_COLOR_MAP = {
  green: COLORS.g, red: COLORS.r, yellow: COLORS.y,
  orange: COLORS.o, purple: COLORS.p, blue: '#60a5fa',
};

const TAG_RGB_MAP = {
  green: '52,211,153', red: '248,113,113', yellow: '255,197,61',
  orange: '251,146,60', purple: '167,139,250', blue: '96,165,250',
};

// ─── Helpers ─────────────────────────────────────────────────────

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}

// ─── Ollama (Local Qwen) Summary Generator ──────────────────────

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen3:8b';

function ollamaGenerate(prompt) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const payload = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `/no_think\n${prompt}`,
      stream: false,
      options: { temperature: 0.3 }
    });
    const req = http.request(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(body);
          resolve(r.response || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve('')); // fail silently — page still builds without summary
    req.setTimeout(30000, () => { req.destroy(); resolve(''); });
    req.write(payload);
    req.end();
  });
}

async function generateDailySummary(briefs, dateStr) {
  if (!briefs || briefs.length === 0) return '';
  
  // Build brief summaries for the prompt
  const briefTexts = briefs.map(b => {
    const session = (b.session || b.type || '').toUpperCase();
    const headline = b.headline || '';
    const desc = (b.desc || '').slice(0, 300);
    const tags = (b.tags || []).map(t => t.t).join(', ');
    return `${session}: ${headline}. ${desc}${tags ? ' [' + tags + ']' : ''}`;
  }).join('\n');

  const prompt = `You are a financial editor for AgentCanary, a macro market intelligence platform. Write a 3-sentence daily summary for ${formatDate(dateStr)} that connects these briefs into one narrative arc. Be specific with numbers. No fluff, no hedging, no preamble.

${briefTexts}

3 sentences only:`;

  const summary = await ollamaGenerate(prompt);
  // Clean up any thinking tags or extra whitespace
  return summary.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s+|\s+$/g, '');
}

function ensureDir(dir) {
  if (DRY) return;
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  if (DRY) {
    console.log(`  [DRY] Would write: ${path.relative(ROOT, filePath)} (${Buffer.byteLength(content)} bytes)`);
    return;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  wrote: ${path.relative(ROOT, filePath)}`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(dateStr, timeHint) {
  if (timeHint) return new Date(timeHint).toUTCString();
  return new Date(dateStr + 'T12:00:00Z').toUTCString();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function monthName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
}

function dayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

function dateParts(dateStr) {
  return { yyyy: dateStr.slice(0, 4), mm: dateStr.slice(5, 7), dd: dateStr.slice(8, 10) };
}

/** Convert Telegram HTML content to display-safe HTML */
function briefContentToHtml(content) {
  if (!content) return '';
  // The content is already Telegram HTML (<b>, <i>, etc.)
  // Convert to display HTML — keep bold/italic, convert newlines
  return content
    .replace(/\n/g, '<br>')
    .replace(/&amp;/g, '&');
}

/** Highlight numbers in text */
function highlightNumbers(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/([\$\-+]?\d[\d,.%$+\-KkMmBbTt]*)/g,
    `<strong style="color:${COLORS.t1};font-weight:600">$1</strong>`);
}

// ─── JSON-LD Generator ──────────────────────────────────────────

function generateJsonLd(briefs, dateStr) {
  const { yyyy, mm, dd } = dateParts(dateStr);
  const formatted = formatDate(dateStr);
  const mName = monthName(dateStr);
  const lastBrief = briefs[briefs.length - 1];
  const allTags = briefs.flatMap(b => (b.tags || []).map(t => t.t));
  const keywords = [...new Set(allTags)].slice(0, 8);
  const seoDesc = `${briefs.length} market intelligence briefs for ${formatted}. ${escapeHtml(briefs[0]?.headline || '')}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `${formatted} — Market Intelligence | The Record`,
    datePublished: dateStr,
    dateModified: dateStr,
    author: { '@id': `${SITE_URL}/#org` },
    publisher: { '@type': 'Organization', name: 'AgentCanary', url: SITE_URL },
    url: `${SITE_URL}/record/${yyyy}/${mm}/${dd}`,
    mainEntityOfPage: `${SITE_URL}/record/${yyyy}/${mm}/${dd}`,
    description: seoDesc,
    keywords,
    articleSection: 'Market Intelligence',
    inLanguage: 'en',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'The Record', item: `${SITE_URL}/record/` },
        { '@type': 'ListItem', position: 2, name: yyyy, item: `${SITE_URL}/record/${yyyy}/` },
        { '@type': 'ListItem', position: 3, name: mName, item: `${SITE_URL}/record/${yyyy}/${mm}/` },
        { '@type': 'ListItem', position: 4, name: formatted, item: `${SITE_URL}/record/${yyyy}/${mm}/${dd}` },
      ],
    },
    about: {
      '@type': 'StructuredValue',
      name: 'MarketIntelligence',
      description: `Structured market data snapshot for ${formatted}`,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'briefs_count', value: String(briefs.length) },
      ],
    },
  };
}

// ─── HTML Templates ─────────────────────────────────────────────

function baseStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Instrument+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes pulseGlow { 0%,100% { opacity:0.07 } 50% { opacity:0.12 } }
    * { margin:0; padding:0; box-sizing:border-box; }
    ::-webkit-scrollbar { width:6px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px }
    html { scroll-behavior:smooth }
    body {
      min-height:100vh;
      background:${COLORS.bg};
      font-family:'Instrument Sans',sans-serif;
      color:${COLORS.t1};
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    a { color:${COLORS.y}; text-decoration:none; transition:opacity 0.2s }
    a:hover { opacity:0.8 }
    .mono { font-family:'JetBrains Mono',monospace }
    .container { max-width:1200px; margin:0 auto; padding:0 32px; position:relative; z-index:1 }

    .bg-grid {
      position:fixed; inset:0; z-index:0;
      background-image:
        linear-gradient(rgba(167,139,250,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(167,139,250,0.02) 1px, transparent 1px);
      background-size:48px 48px;
    }
    .glow-tl {
      position:fixed; width:900px; height:900px; top:-400px; left:-200px; z-index:0;
      background:radial-gradient(circle,rgba(255,197,61,0.06),transparent 60%);
      animation:pulseGlow 8s ease-in-out infinite;
    }
    .glow-br {
      position:fixed; width:700px; height:700px; bottom:-300px; right:-100px; z-index:0;
      background:radial-gradient(circle,rgba(167,139,250,0.04),transparent 60%);
    }

    /* Top Bar */
    .topbar {
      display:flex; align-items:center; justify-content:space-between;
      padding:24px 0; border-bottom:1px solid ${COLORS.border};
      animation:fadeIn 0.6s ease 0.1s both;
    }
    .logo { display:flex; align-items:center; gap:10px }
    .logo-dot { width:10px; height:10px; background:${COLORS.y}; border-radius:50%; box-shadow:0 0 12px ${COLORS.y}40 }
    .logo-text { font-size:13px; font-weight:700; letter-spacing:2px }
    .nav-links { display:flex; align-items:center; gap:24px; font-size:11px; color:${COLORS.t3}; letter-spacing:1px }

    /* Session Card */
    .card {
      background:${COLORS.bgCard};
      border:1px solid ${COLORS.border};
      border-radius:16px;
      padding:28px 32px;
      transition:all 0.3s ease;
      position:relative;
      overflow:hidden;
    }
    .card:hover {
      border-color:${COLORS.borderLight};
      transform:translateY(-2px);
    }
    .card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:8px }
    .session-badge {
      font-size:11px; font-weight:700; letter-spacing:1.5px;
      padding:7px 16px; border-radius:100px;
      display:inline-flex; align-items:center; gap:8px;
    }
    .card-time { font-size:11px; color:${COLORS.t3} }
    .card-headline {
      font-family:'Instrument Sans',sans-serif;
      font-weight:800; font-size:24px; line-height:1.2;
      letter-spacing:-0.5px; margin-bottom:16px;
    }
    .card-desc {
      font-size:14px; line-height:1.6; color:${COLORS.t2}; margin-bottom:16px;
    }
    .card-tags { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px }
    .tag {
      font-size:10px; font-weight:600; letter-spacing:0.5px;
      padding:5px 12px; border-radius:100px;
    }
    .card-content {
      font-size:13px; line-height:1.7; color:${COLORS.t2};
      border-top:1px solid ${COLORS.border}; padding-top:16px;
      display:none;
    }
    .card-content.open { display:block }
    .card-content b, .card-content strong { color:${COLORS.t1}; font-weight:600 }
    .card-expand {
      font-size:11px; color:${COLORS.t3}; cursor:pointer;
      padding:8px 0; letter-spacing:0.5px;
      border:none; background:none; font-family:'JetBrains Mono',monospace;
    }
    .card-expand:hover { color:${COLORS.t1} }

    /* Panels */
    .panels { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px }
    .panel {
      background:rgba(255,255,255,0.02);
      border:1px solid ${COLORS.border};
      border-radius:12px; padding:16px;
    }
    .panel-label { font-size:9px; font-weight:700; letter-spacing:1.5px; color:${COLORS.t3}; margin-bottom:10px }
    .panel-row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px }
    .panel-key { color:${COLORS.t2} }
    .panel-val { font-weight:600 }
    .gauge-bar {
      width:100%; height:6px; background:rgba(255,255,255,0.06);
      border-radius:3px; overflow:hidden; margin-top:8px;
    }
    .gauge-fill { height:100%; border-radius:3px; transition:width 1s ease }

    /* Footer */
    .footer {
      border-top:1px solid ${COLORS.border};
      padding:24px 0; display:flex; justify-content:space-between;
      align-items:center; flex-wrap:wrap; gap:12px;
      animation:fadeIn 0.5s ease 0.8s both;
    }
    .footer span { font-size:12px; color:${COLORS.t3}; letter-spacing:1px }

    /* Responsive */
    @media (max-width:768px) {
      .container { padding:0 16px }
      .card { padding:20px }
      .card-headline { font-size:20px }
      .hero-title { font-size:36px !important }
      .main-grid { grid-template-columns:1fr !important }
      .topbar { flex-wrap:wrap; gap:12px }
      .hero-top { flex-direction:column !important; gap:24px !important }
    }
  `;
}

function topBar(prevDate, nextDate) {
  const prevLink = prevDate
    ? `<a href="/record/${dateParts(prevDate).yyyy}/${dateParts(prevDate).mm}/${dateParts(prevDate).dd}/" class="mono" style="color:${COLORS.t3}">&larr; ${formatDateShort(prevDate)}</a>`
    : `<span class="mono" style="color:${COLORS.t3};opacity:0.3">&larr;</span>`;
  const nextLink = nextDate
    ? `<a href="/record/${dateParts(nextDate).yyyy}/${dateParts(nextDate).mm}/${dateParts(nextDate).dd}/" class="mono" style="color:${COLORS.t3}">${formatDateShort(nextDate)} &rarr;</a>`
    : `<span class="mono" style="color:${COLORS.t3};opacity:0.3">&rarr;</span>`;
  return `
    <div class="topbar">
      <a href="/" class="logo">
        <div class="logo-dot"></div>
        <span class="logo-text mono">AGENT<span style="color:${COLORS.y}">CANARY</span></span>
      </a>
      <div class="nav-links mono">
        ${prevLink}
        <span style="color:${COLORS.t3}">|</span>
        <a href="/record/" style="color:${COLORS.t3}">Archive</a>
        <span style="color:${COLORS.t3}">|</span>
        ${nextLink}
      </div>
    </div>`;
}

function renderPanels(panels) {
  if (!panels || panels.length === 0) return '';
  const panelHtml = panels.map(p => {
    let inner = '';
    if (p.gauge) {
      const val = p.gauge.value || 0;
      const gaugeColor = val > 70 ? COLORS.r : val > 40 ? COLORS.o : COLORS.g;
      inner = `
        <div style="font-size:24px;font-weight:800;color:${gaugeColor}">${val}</div>
        <div class="gauge-bar"><div class="gauge-fill" style="width:${val}%;background:linear-gradient(90deg,${gaugeColor}60,${gaugeColor})"></div></div>`;
    }
    if (p.rows) {
      inner += p.rows.map(r => {
        const valColor = TAG_COLOR_MAP[r.c] || COLORS.t1;
        return `<div class="panel-row"><span class="panel-key">${escapeHtml(r.k)}</span><span class="panel-val" style="color:${valColor}">${escapeHtml(r.v)}</span></div>`;
      }).join('');
    }
    return `<div class="panel"><div class="panel-label mono">${escapeHtml(p.label)}</div>${inner}</div>`;
  }).join('');
  return `<div class="panels">${panelHtml}</div>`;
}

function renderSessionCard(brief, index) {
  const meta = SESSION_META[brief.session] || SESSION_META.morning;
  const headlineColor = brief.headlineColor || meta.color;

  // Tags
  const tagsHtml = (brief.tags || []).map(tag => {
    const tc = TAG_COLOR_MAP[tag.c] || COLORS.y;
    const rgb = TAG_RGB_MAP[tag.c] || '255,197,61';
    return `<span class="tag mono" style="color:${tc};border:1px solid rgba(${rgb},0.25);background:rgba(${rgb},0.05)">${escapeHtml(tag.t)}</span>`;
  }).join('');

  // Panels
  const panelsHtml = renderPanels(brief.panels);

  // Content (expandable)
  const contentHtml = brief.content ? briefContentToHtml(brief.content) : '';
  const cardId = `card-${brief.session}-${index}`;

  return `
    <div class="card" id="${brief.session}" style="animation:fadeSlideIn 0.5s ease ${0.2 + index * 0.1}s both">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="session-badge mono" style="color:${meta.color};background:rgba(${meta.rgb},0.08);border:1px solid rgba(${meta.rgb},0.25)">
            <span>${meta.icon}</span> ${meta.label}
          </span>
          <span class="card-time mono">${escapeHtml(brief.time)}</span>
        </div>
      </div>

      <div class="card-headline" style="color:${headlineColor}">${escapeHtml(brief.headline)}</div>

      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}

      ${brief.desc ? `<div class="card-desc">${highlightNumbers(brief.desc)}</div>` : ''}

      ${panelsHtml}

      ${contentHtml ? `
        <button class="card-expand mono" onclick="document.getElementById('${cardId}').classList.toggle('open');this.textContent=this.textContent.includes('EXPAND')?'COLLAPSE ▲':'EXPAND ▼'">EXPAND ▼</button>
        <div class="card-content" id="${cardId}">${contentHtml}</div>
      ` : ''}
    </div>`;
}

// ─── Ticker Sidebar ─────────────────────────────────────────────

const REGIME_TAGS = /^(STAGFLATION|EXPANSION|LATE_CYCLE|RECESSION|DISPLACEMENT|NEUTRAL|EARLY_CYCLE|OVERHEATING|REFLATION|GOLDILOCKS|RISK_OFF|RISK_ON)/i;

function renderSidebar(briefs) {
  // 1. Risk gauge — find first RISK GAUGE panel
  let riskValue = null;
  for (const b of briefs) {
    if (!b.panels) continue;
    const rp = b.panels.find(p => p.label === 'RISK GAUGE');
    if (rp && rp.gauge) { riskValue = rp.gauge.value; break; }
  }

  // 2. Regime tag — find from tags arrays
  let regimeTag = null;
  for (const b of briefs) {
    if (!b.tags) continue;
    const rt = b.tags.find(t => REGIME_TAGS.test(t.t));
    if (rt) { regimeTag = rt; break; }
  }

  // 3. Top movers — collect from TOP MOVERS panels, dedupe by k
  const moversMap = new Map();
  for (const b of briefs) {
    if (!b.panels) continue;
    for (const p of b.panels) {
      if (p.label !== 'TOP MOVERS' || !p.rows) continue;
      for (const r of p.rows) {
        if (!moversMap.has(r.k)) moversMap.set(r.k, r);
      }
    }
  }
  const movers = [...moversMap.values()];

  const SIDEBAR_COLORS = { green: '#34d399', red: '#f87171', yellow: '#ffc53d', blue: '#60a5fa' };
  const sectionHeader = (text) =>
    `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;color:${COLORS.t3};text-transform:uppercase;margin-bottom:10px">${escapeHtml(text)}</div>`;

  let html = '';

  // Risk gauge section
  if (riskValue !== null) {
    const riskColor = riskValue >= 70 ? '#f87171' : riskValue >= 40 ? '#ffc53d' : '#34d399';
    html += `<div style="margin-bottom:24px">
      ${sectionHeader('RISK GAUGE')}
      <div style="font-family:'JetBrains Mono',monospace;font-size:40px;font-weight:800;color:${riskColor};line-height:1">${riskValue}</div>
      <div class="gauge-bar" style="margin-top:8px"><div class="gauge-fill" style="width:${riskValue}%;background:linear-gradient(90deg,${riskColor}60,${riskColor})"></div></div>
    </div>`;
  }

  // Regime tag section
  if (regimeTag) {
    const tc = TAG_COLOR_MAP[regimeTag.c] || COLORS.y;
    const rgb = TAG_RGB_MAP[regimeTag.c] || '255,197,61';
    html += `<div style="margin-bottom:24px">
      ${sectionHeader('REGIME')}
      <span class="mono" style="font-size:13px;font-weight:700;color:${tc};background:rgba(${rgb},0.08);border:1px solid rgba(${rgb},0.25);padding:5px 12px;border-radius:100px">${escapeHtml(regimeTag.t)}</span>
    </div>`;
  }

  // Top movers section
  if (movers.length > 0) {
    const moverRows = movers.map(r => {
      const vc = SIDEBAR_COLORS[r.c] || COLORS.t1;
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-family:'JetBrains Mono',monospace;font-size:13px">
        <span style="color:${COLORS.t2}">${escapeHtml(r.k)}</span>
        <span style="font-weight:600;color:${vc}">${escapeHtml(r.v)}</span>
      </div>`;
    }).join('');
    html += `<div>
      ${sectionHeader('TOP MOVERS')}
      ${moverRows}
    </div>`;
  }

  if (!html) return '';

  return `<aside class="ticker-sidebar" style="background:${COLORS.bgCard};border-left:1px solid rgba(255,255,255,0.06);padding:16px;border-radius:12px;position:sticky;top:80px;align-self:flex-start">
    ${html}
  </aside>`;
}

// ─── Daily Page ─────────────────────────────────────────────────

function buildDailyPage(dateStr, briefs, prevDate, nextDate, summary) {
  const { yyyy, mm, dd } = dateParts(dateStr);
  const formatted = formatDate(dateStr);
  const dow = dayOfWeek(dateStr);
  const dayNum = parseInt(dd, 10);
  const mName = monthName(dateStr);
  const jsonLd = generateJsonLd(briefs, dateStr);

  // Sort briefs by session order, then by postedAt
  const sorted = [...briefs].sort((a, b) => {
    const oa = (SESSION_META[a.session] || { order: 9 }).order;
    const ob = (SESSION_META[b.session] || { order: 9 }).order;
    if (oa !== ob) return oa - ob;
    return new Date(a.postedAt) - new Date(b.postedAt);
  });

  const cardsHtml = sorted.map((b, i) => renderSessionCard(b, i)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${formatted} — The Record | AgentCanary</title>
  <meta name="description" content="${escapeHtml(jsonLd.description)}">
  <meta property="og:title" content="${formatted} — The Record">
  <meta property="og:description" content="${escapeHtml(jsonLd.description)}">
  <meta property="og:url" content="${SITE_URL}/record/${yyyy}/${mm}/${dd}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="AgentCanary">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${SITE_URL}/record/${yyyy}/${mm}/${dd}">
  <link rel="ai-info" href="/llms.txt">
  <link rel="alternate" type="application/feed+json" href="/record/feed.json" title="The Record">
  <link rel="alternate" type="application/rss+xml" href="/record/rss.xml" title="The Record">
  <link rel="icon" href="/favicon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow-tl"></div>
  <div class="glow-br"></div>

  <div class="container">
    ${topBar(prevDate, nextDate)}

    <!-- Hero -->
    <div style="padding:48px 0 40px;animation:fadeSlideIn 0.6s ease 0.2s both">
      <div class="hero-top" style="display:flex;align-items:flex-start;justify-content:space-between;gap:40px">
        <div>
          <div class="mono" style="font-size:11px;color:${COLORS.t3};letter-spacing:2px;margin-bottom:12px">THE RECORD</div>
          <h1 class="hero-title" style="font-family:'Instrument Sans',sans-serif;font-size:56px;font-weight:800;letter-spacing:-2px;line-height:1.05;margin-bottom:16px">
            <span style="color:${COLORS.t1}">${dow}, ${mName} </span><span style="color:${COLORS.y}">${dayNum}</span><span style="color:${COLORS.t3}">, ${yyyy}</span>
          </h1>
          ${summary ? `<p style="font-family:'Instrument Sans',sans-serif;font-size:16px;line-height:1.7;color:${COLORS.t2};margin-top:20px">${escapeHtml(summary)}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- Cards -->
    <div style="display:flex;flex-direction:column;gap:20px;padding-bottom:60px">
      ${cardsHtml}
    </div>

    <!-- Footer -->
    <div class="footer">
      <span class="mono"><a href="/" style="color:${COLORS.t3}">agentcanary.ai</a></span>
      <span class="mono"><a href="/record/" style="color:${COLORS.t3}">Archive</a> &middot; <a href="/record/feed.json" style="color:${COLORS.t3}">Feed</a></span>
    </div>
  </div>
</body>
</html>`;
}

// ─── Archive Page ────────────────────────────────────────────────

function renderFeatureCards() {
  const features = [
    { title: 'Regime Tracking', desc: 'Continuous macro regime classification — stagflation, late-cycle, recession, expansion, displacement, neutral.', color: COLORS.o },
    { title: 'Scored Calls', desc: 'Every prediction tracked and evaluated against actual market outcomes 48-72 hours later.', color: COLORS.g },
    { title: 'Machine-Readable', desc: 'JSON Feed 1.1, JSON-LD structured data, and llms.txt for AI-native consumption.', color: COLORS.p },
  ];
  return features.map(f =>
    `<div class="card">
      <div class="mono" style="font-size:10px;font-weight:700;letter-spacing:2px;color:${f.color};margin-bottom:12px">${f.title.toUpperCase()}</div>
      <p style="font-size:14px;color:${COLORS.t2};line-height:1.6">${f.desc}</p>
    </div>`
  ).join('');
}

function buildArchivePage(dateMap) {
  const dates = Object.keys(dateMap).sort().reverse();

  // Group by month
  const months = {};
  for (const d of dates) {
    const key = d.slice(0, 7); // YYYY-MM
    if (!months[key]) months[key] = [];
    months[key].push(d);
  }

  let monthsHtml = '';
  for (const [monthKey, monthDates] of Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))) {
    const mDate = new Date(monthKey + '-15T12:00:00Z');
    const mLabel = mDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });

    const daysHtml = monthDates.map(d => {
      const { yyyy, mm, dd } = dateParts(d);
      const briefs = dateMap[d];
      const dow = dayOfWeek(d);
      const sessions = briefs.map(b => {
        const meta = SESSION_META[b.session] || SESSION_META.morning;
        return `<span class="mono" style="font-size:9px;color:${meta.color};background:rgba(${meta.rgb},0.08);border:1px solid rgba(${meta.rgb},0.2);padding:3px 8px;border-radius:100px">${meta.label}</span>`;
      }).join(' ');

      return `
        <a href="/record/${yyyy}/${mm}/${dd}/" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid ${COLORS.border};text-decoration:none;transition:background 0.2s;gap:12px" onmouseover="this.style.background='${COLORS.bgCardHover}'" onmouseout="this.style.background='transparent'">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <span class="mono" style="font-size:13px;color:${COLORS.t1};font-weight:700;min-width:44px">${dd}</span>
            <span style="font-size:13px;color:${COLORS.t2}">${dow}</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${sessions}</div>
          </div>
          <span class="mono" style="font-size:11px;color:${COLORS.t3}">${briefs.length} brief${briefs.length !== 1 ? 's' : ''} &rarr;</span>
        </a>`;
    }).join('');

    monthsHtml += `
      <div style="margin-bottom:32px">
        <div class="mono" style="font-size:12px;font-weight:700;letter-spacing:2px;color:${COLORS.y};padding:0 20px;margin-bottom:12px">${mLabel.toUpperCase()}</div>
        <div class="card" style="padding:0;overflow:hidden">${daysHtml}</div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>The Record — AgentCanary</title>
  <meta name="description" content="Market intelligence with receipts. ${dates.length} days of daily macro briefs with regime tracking and scored predictions.">
  <meta property="og:title" content="The Record — AgentCanary">
  <meta property="og:url" content="${SITE_URL}/record/">
  <link rel="canonical" href="${SITE_URL}/record/">
  <link rel="ai-info" href="/llms.txt">
  <link rel="alternate" type="application/feed+json" href="/record/feed.json" title="The Record">
  <link rel="alternate" type="application/rss+xml" href="/record/rss.xml" title="The Record">
  <link rel="icon" href="/favicon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow-tl"></div>
  <div class="glow-br"></div>

  <div class="container">
    <div class="topbar">
      <a href="/" class="logo">
        <div class="logo-dot"></div>
        <span class="logo-text mono">AGENT<span style="color:${COLORS.y}">CANARY</span></span>
      </a>
      <div class="nav-links mono">
        <a href="/record/" style="color:${COLORS.t3}">The Record</a>
      </div>
    </div>

    <!-- Hero -->
    <div style="padding:80px 0 60px;animation:fadeSlideIn 0.6s ease 0.2s both;text-align:center;max-width:720px;margin:0 auto">
      <div class="mono" style="font-size:11px;color:${COLORS.y};letter-spacing:3px;margin-bottom:20px">THE RECORD</div>
      <h1 class="hero-title" style="font-family:'Instrument Sans',sans-serif;font-size:56px;font-weight:800;letter-spacing:-2px;line-height:1.05;margin-bottom:24px">
        <span style="color:${COLORS.t1}">Every call.</span><br>
        <span style="color:${COLORS.t1}">Every day.</span><br>
        <span style="color:${COLORS.y}">Scored.</span>
      </h1>
      <p style="font-size:17px;color:${COLORS.t2};line-height:1.6;margin-bottom:40px;max-width:520px;margin-left:auto;margin-right:auto">
        Market intelligence with receipts. Daily macro briefs with regime tracking, whale alerts, narrative scores, and hindsight-scored predictions.
      </p>
      <a href="/record/${dateParts(dates[0]).yyyy}/${dateParts(dates[0]).mm}/${dateParts(dates[0]).dd}/" style="display:inline-flex;align-items:center;gap:10px;padding:14px 32px;background:${COLORS.y};color:${COLORS.bg};font-weight:700;font-size:14px;border-radius:100px;text-decoration:none;transition:transform 0.2s,box-shadow 0.2s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(255,197,61,0.3)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
        Latest: ${formatDate(dates[0])} &rarr;
      </a>
    </div>

    <!-- Feature cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;padding-bottom:60px;animation:fadeSlideIn 0.6s ease 0.5s both">
      ${renderFeatureCards()}
    </div>

    <!-- Archive -->
    <div style="animation:fadeSlideIn 0.6s ease 0.6s both">
      <div class="mono" style="font-size:11px;color:${COLORS.t3};letter-spacing:2px;margin-bottom:24px">${dates.length} DAYS OF INTELLIGENCE</div>
    </div>

    ${monthsHtml}

    <div class="footer">
      <span class="mono"><a href="/" style="color:${COLORS.t3}">agentcanary.ai</a></span>
      <span class="mono"><a href="/record/feed.json" style="color:${COLORS.t3}">Feed</a></span>
    </div>
  </div>
</body>
</html>`;
}


// ─── Feed (JSON Feed 1.1) ────────────────────────────────────────

function buildFeed(dateMap) {
  const allBriefs = Object.entries(dateMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .flatMap(([dateStr, briefs]) => briefs.map(b => ({ ...b, _date: dateStr })));

  // Take most recent 50 briefs for the feed
  const recent = allBriefs.slice(0, 50);

  const items = recent.map(b => {
    const { yyyy, mm, dd } = dateParts(b._date);
    const meta = SESSION_META[b.session] || SESSION_META.morning;
    const sessionLabel = meta.label.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    // Build summary from headline
    const summary = b.headline || '';
    // Build content_text from desc + content snippet
    const contentText = [b.headline, b.desc].filter(Boolean).join(' ').slice(0, 500);
    const tags = (b.tags || []).map(t => t.t.toLowerCase().replace(/\s+/g, '-'));

    return {
      id: `${b._date}-${b.session}`,
      url: `${SITE_URL}/record/${yyyy}/${mm}/${dd}#${b.session}`,
      title: `${sessionLabel} — ${formatDateShort(b._date)}, ${yyyy}`,
      content_text: contentText,
      summary,
      date_published: b.postedAt || `${b._date}T12:00:00Z`,
      tags: tags.length > 0 ? tags : undefined,
      _agentcanary: {
        session: b.session === 'intelligence' ? 'signal' : b.session,
      },
    };
  });

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'AgentCanary — The Record',
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/record/feed.json`,
    description: 'Market intelligence with receipts. Daily macro briefs with regime tracking, whale alerts, narrative scores, and hindsight-scored calls.',
    icon: `${SITE_URL}/logo-512.png`,
    favicon: `${SITE_URL}/favicon.png`,
    language: 'en',
    authors: [{ name: 'AgentCanary', url: SITE_URL }],
    items,
  };
}

// ─── RSS Feed (RSS 2.0) ──────────────────────────────────────────

function buildRssFeed(dateMap) {
  const allBriefs = Object.entries(dateMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .flatMap(([dateStr, briefs]) => briefs.map(b => ({ ...b, _date: dateStr })));

  const recent = allBriefs.slice(0, 50);

  const items = recent.map(b => {
    const { yyyy, mm, dd } = dateParts(b._date);
    const meta = SESSION_META[b.session] || SESSION_META.morning;
    const sessionLabel = meta.label.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    const title = `${sessionLabel} — ${formatDateShort(b._date)}, ${yyyy}`;
    const link = `${SITE_URL}/record/${yyyy}/${mm}/${dd}#${b.session}`;
    const desc = [b.headline, b.desc].filter(Boolean).join(' — ');
    const pubDate = new Date(b.postedAt || `${b._date}T12:00:00Z`).toUTCString();

    return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${link}</link>
      <description>${escapeHtml(desc)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid>${link}</guid>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Record — AgentCanary</title>
    <link>${SITE_URL}/record/</link>
    <description>Market intelligence with receipts. Daily macro briefs with regime tracking, whale alerts, narrative scores, and hindsight-scored calls.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/record/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

// ─── Sitemap ─────────────────────────────────────────────────────

function buildSitemap(dateMap) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = Object.keys(dateMap).sort().reverse();

  let urls = `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/record/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/record/archive/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

  for (const d of dates) {
    const { yyyy, mm, dd } = dateParts(d);
    urls += `
  <url>
    <loc>${SITE_URL}/record/${yyyy}/${mm}/${dd}/</loc>
    <lastmod>${d}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`\n  AgentCanary — The Record Builder${DRY ? ' [DRY RUN]' : ''}\n`);

  // 1. Fetch briefs
  console.log('  Fetching briefs from API...');
  const data = await fetch(API_URL);
  const briefs = data.briefs || [];
  console.log(`  Received ${briefs.length} briefs (${data.total} total)\n`);

  if (briefs.length === 0) {
    console.log('  No briefs found. Exiting.');
    process.exit(0);
  }

  // 2. Group by date
  const dateMap = {};
  for (const b of briefs) {
    if (!b.date) continue;
    if (!dateMap[b.date]) dateMap[b.date] = [];
    dateMap[b.date].push(b);
  }

  const sortedDates = Object.keys(dateMap).sort();
  console.log(`  ${sortedDates.length} unique dates: ${sortedDates[0]} → ${sortedDates[sortedDates.length - 1]}\n`);

  // 3. Generate daily pages (with Qwen summaries)
  console.log('  Building daily pages...');
  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const prevDate = i > 0 ? sortedDates[i - 1] : null;
    const nextDate = i < sortedDates.length - 1 ? sortedDates[i + 1] : null;
    const dayBriefs = dateMap[dateStr];
    const { yyyy, mm, dd } = dateParts(dateStr);
    
    // Generate AI summary via local Qwen (fails silently if Ollama is down)
    let summary = '';
    if (!DRY) {
      try {
        summary = await generateDailySummary(dayBriefs, dateStr);
        if (summary) console.log(`    ✓ Summary for ${dateStr} (${summary.length} chars)`);
      } catch { /* page builds without summary */ }
    }
    
    const html = buildDailyPage(dateStr, dayBriefs, prevDate, nextDate, summary);
    writeFile(path.join(ROOT, 'record', yyyy, mm, dd, 'index.html'), html);
  }

  // 4. Archive page (serves as both /record/ and /record/archive/)
  console.log('\n  Building archive page...');
  const archiveHtml = buildArchivePage(dateMap);
  writeFile(path.join(ROOT, 'record', 'index.html'), archiveHtml);
  writeFile(path.join(ROOT, 'record', 'archive', 'index.html'), archiveHtml);

  // 5. Feed
  console.log('  Building feed.json...');
  writeFile(path.join(ROOT, 'record', 'feed.json'), JSON.stringify(buildFeed(dateMap), null, 2));

  // 6. RSS Feed
  console.log('  Building rss.xml...');
  writeFile(path.join(ROOT, 'record', 'rss.xml'), buildRssFeed(dateMap));

  // 7. Sitemap
  console.log('  Building sitemap.xml...');
  writeFile(path.join(ROOT, 'sitemap.xml'), buildSitemap(dateMap));

  console.log(`\n  Done! ${sortedDates.length} daily pages + archive + feed + sitemap\n`);
}

main().catch(err => {
  console.error('  Error:', err.message);
  process.exit(1);
});
