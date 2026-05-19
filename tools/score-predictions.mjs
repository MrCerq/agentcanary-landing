#!/usr/bin/env node
/**
 * AgentCanary — Prediction Scorer
 *
 * Ported from Mini's build-record.js (last touched April 12, abandoned).
 * Now lives on the AC VPS, runs as part of sync-record.sh / build chain.
 *
 * Responsibilities:
 *   1. Extract new predictions from signal briefs into predictions.json
 *   2. Score pending predictions whose 72h evaluation window has elapsed
 *   3. Cache Yahoo Finance responses to price-cache.json
 *   4. Update lastScored timestamp
 *
 * Usage:
 *   node tools/score-predictions.mjs           # full run
 *   node tools/score-predictions.mjs --dry     # dry-run: no file writes
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DRY = process.argv.includes('--dry');
const PREDICTIONS_PATH = path.join(ROOT, 'record', 'data', 'predictions.json');
const PRICE_CACHE_PATH = path.join(ROOT, 'record', 'data', 'price-cache.json');
const ARCHIVE_PATH = process.env.AC_BRIEFS_ARCHIVE
  || '/root/agentcanary-landing-data/briefs-archive.json';

const SCORE_WINDOW_H = 72;

const TICKER_YAHOO = {
  'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD',
  'OIL': 'CL=F', 'GOLD': 'GC=F', 'GLD': 'GLD',
  'DXY': 'DX-Y.NYB', 'SPY': 'SPY', 'QQQ': 'QQQ',
  'VIX': '^VIX', 'TLT': 'TLT', 'XLU': 'XLU', 'SMH': 'SMH',
  'XBI': 'XBI', 'XLRE': 'XLRE', 'XLF': 'XLF', 'URA': 'URA',
  'IGV': 'IGV', 'XLE': 'XLE', 'COPX': 'COPX', 'USDT': 'USDT-USD',
};

// ─── helpers ────────────────────────────────────────────────────

function normalizeTicker(raw, rangeMin, rangeMax) {
  const upper = (raw || '').toUpperCase().trim();
  if (upper === 'GOLD' && rangeMax < 1000) return 'GLD';
  if (upper === 'GLD' && rangeMin > 1000) return 'GOLD';
  return upper;
}

function parsePrice(s, peerPrice) {
  if (!s) return null;
  let v = String(s).replace(/[$,]/g, '');
  const kMatch = v.match(/^([\d.]+)\s*[Kk]$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const mMatch = v.match(/^([\d.]+)\s*[Mm]$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1000000;
  const num = parseFloat(v);
  if (isNaN(num)) return null;
  if (peerPrice != null && peerPrice > num * 50) return num * 1000;
  if (peerPrice != null && peerPrice > num * 500) return num * 1000;
  return num;
}

function scoreDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

// ─── extraction ─────────────────────────────────────────────────


// ─── Brier / calibration helpers (added 2026-05-19) ─────────────
// Heuristic scenario probabilities — ported from ac-compute's
// forward-scenarios atom (scenarioTilt). Bases off radar regime + risk
// gauge. NOT a calibrated forecast — that's exactly what the Brier score
// below measures.
function scenarioTilt(phase, riskGauge) {
  let a = 33, b = 33, c = 34;
  const ph = String(phase || '').toUpperCase();
  if (ph === 'EXPANSION' || ph === 'OVERHEATING') { a += 15; c -= 5; }
  else if (ph === 'STAGFLATION' || ph === 'CONTRACTION' || ph === 'RECESSION') { c += 15; a -= 5; }
  if (Number.isFinite(riskGauge)) {
    if (riskGauge < 25) { a += 10; c -= 10; }
    else if (riskGauge > 60) { c += 10; a -= 10; }
  }
  const clamp = (x) => Math.max(10, Math.min(70, x));
  a = clamp(a); b = clamp(b); c = clamp(c);
  const total = a + b + c;
  const aN = Math.round((a / total) * 100);
  const bN = Math.round((b / total) * 100);
  return { A: aN, B: bN, C: 100 - aN - bN };
}

// outcome: 'hit'=1, 'partial'=0.5, 'miss'=0. Other states return null (skip).
function outcomeValue(result) {
  if (result === 'hit') return 1;
  if (result === 'partial') return 0.5;
  if (result === 'miss') return 0;
  return null;
}

// Brier for one prediction: (probability - actual)^2. probability in [0,1].
function brierScore(probability, outcome) {
  return (probability - outcome) ** 2;
}

// Build date → {phase, riskGauge} map from radar brief grades.
function buildDateToMacro(briefScoresMap) {
  const out = new Map();
  for (const [date, day] of Object.entries(briefScoresMap)) {
    const radar = day && day.radar;
    if (!radar || typeof radar !== 'object') continue;
    const m = (radar.details && radar.details.morning) || {};
    if (m.phase) {
      out.set(date, { phase: m.phase, riskGauge: m.riskGauge });
    }
  }
  return out;
}

// Enrich predictions with probability + brier_score (mutates in place).
// Returns counts for logging.
function enrichWithBrier(predictionsArr, dateToMacro) {
  let enriched = 0, skipped = 0;
  for (const p of predictionsArr) {
    const outcome = outcomeValue(p.result);
    if (outcome === null) { skipped++; continue; }
    const macro = dateToMacro.get(p.date);
    const tilt = scenarioTilt(macro?.phase, macro?.riskGauge);
    const pctRaw = tilt[p.scenario];
    if (!Number.isFinite(pctRaw)) { skipped++; continue; }
    const probability = pctRaw / 100;
    p.probability = +probability.toFixed(4);
    p.brier_score = +brierScore(probability, outcome).toFixed(4);
    enriched++;
  }
  return { enriched, skipped };
}

// Reliability bucketing: 5 ranges. Returns array of { range, predicted_mean, observed_rate, n }.
function reliabilityBuckets(predictionsArr) {
  const buckets = [
    { lo: 0,   hi: 0.20, label: '0-20%',  probs: [], outcomes: [] },
    { lo: 0.20, hi: 0.40, label: '20-40%', probs: [], outcomes: [] },
    { lo: 0.40, hi: 0.60, label: '40-60%', probs: [], outcomes: [] },
    { lo: 0.60, hi: 0.80, label: '60-80%', probs: [], outcomes: [] },
    { lo: 0.80, hi: 1.001, label: '80-100%', probs: [], outcomes: [] },
  ];
  for (const p of predictionsArr) {
    if (!Number.isFinite(p.probability)) continue;
    const o = outcomeValue(p.result);
    if (o === null) continue;
    const b = buckets.find(x => p.probability >= x.lo && p.probability < x.hi);
    if (!b) continue;
    b.probs.push(p.probability);
    b.outcomes.push(o);
  }
  return buckets.map(b => ({
    range: b.label,
    n: b.probs.length,
    predicted_mean: b.probs.length ? +(b.probs.reduce((s, x) => s + x, 0) / b.probs.length * 100).toFixed(1) : null,
    observed_rate:  b.outcomes.length ? +(b.outcomes.reduce((s, x) => s + x, 0) / b.outcomes.length * 100).toFixed(1) : null,
  }));
}

function extractPredictions(briefs) {
  const predictions = [];
  for (const b of briefs) {
    if (canonicalSlot(b) !== 'signal') continue;
    const content = b.body || b.content || b.telegramText || '';
    const blocks = content.split(/<b>SCENARIO/i);
    if (blocks.length <= 1) continue;

    for (const block of blocks.slice(1)) {
      const lines = block.split('\n').map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const headerMatch = lines[0].match(/^([A-Z])\s*[—–-]\s*(.+)/);
      if (!headerMatch) continue;
      const [, letter, scenarioName] = headerMatch;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const targetMatch = line.match(/^(\w+):\s*\$?([\d,.]+[KkMm]?)\s*[-–]\s*\$?([\d,.]+[KkMm]?)\s*\(([^)]+)\)/);
        if (!targetMatch) continue;

        const [, rawTicker, minStr, maxStr, moveStr] = targetMatch;
        const rawMax = parsePrice(maxStr, null);
        const rawMin = parsePrice(minStr, rawMax);
        if (rawMin === null || rawMax === null) continue;
        const rangeMin = Math.min(rawMin, rawMax);
        const rangeMax = Math.max(rawMin, rawMax);

        const ticker = normalizeTicker(rawTicker, rangeMin, rangeMax);
        const id = `${b.date}-${letter}-${ticker}`;
        predictions.push({
          id,
          date: b.date,
          session: b.session,
          scenario: letter,
          scenarioName: scenarioName.trim(),
          ticker,
          type: 'scenario_target',
          rangeMin: Math.min(rangeMin, rangeMax),
          rangeMax: Math.max(rangeMin, rangeMax),
          impliedMove: moveStr.trim(),
          scoreDate: scoreDate(b.date),
          result: 'pending',
          actualHigh: null,
          actualLow: null,
          actualClose: null,
        });
      }
    }
  }
  return predictions;
}

// ─── scoring ────────────────────────────────────────────────────

function fetchYahooPrices(ticker, startDate, endDate) {
  const yahooTicker = TICKER_YAHOO[ticker.toUpperCase()] || ticker;
  const start = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
  const end = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?period1=${start}&period2=${end}&interval=1d`;

  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const result = data.chart?.result?.[0];
          if (!result) return resolve(null);
          const quotes = result.indicators?.quote?.[0];
          if (!quotes) return resolve(null);
          resolve({
            opens: quotes.open || [],
            highs: quotes.high || [],
            lows: quotes.low || [],
            closes: quotes.close || [],
            timestamps: result.timestamp || [],
          });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function scorePredictions(predictions, priceCache) {
  const today = new Date().toISOString().slice(0, 10);
  let scoredCount = 0;
  let noDataCount = 0;

  for (const pred of predictions) {
    if (pred.result && pred.result !== 'pending') continue;
    if (pred.scoreDate > today) {
      pred.result = 'pending';
      continue;
    }

    const cacheKey = `${pred.ticker}:${pred.date}:${pred.scoreDate}`;
    let prices = priceCache[cacheKey];

    if (!prices) {
      prices = await fetchYahooPrices(pred.ticker, pred.date, pred.scoreDate);
      if (prices) {
        priceCache[cacheKey] = prices;
      } else {
        pred.result = 'no_data';
        noDataCount++;
        continue;
      }
    }

    const validHighs = prices.highs.filter(v => v != null);
    const validLows = prices.lows.filter(v => v != null);
    const validCloses = prices.closes.filter(v => v != null);

    if (validHighs.length === 0 || validLows.length === 0) {
      pred.result = 'no_data';
      noDataCount++;
      continue;
    }

    const windowHigh = Math.max(...validHighs);
    const windowLow = Math.min(...validLows);
    const lastClose = validCloses[validCloses.length - 1];

    pred.actualHigh = Math.round(windowHigh * 100) / 100;
    pred.actualLow = Math.round(windowLow * 100) / 100;
    pred.actualClose = lastClose ? Math.round(lastClose * 100) / 100 : null;

    if (windowHigh >= pred.rangeMin && windowLow <= pred.rangeMax) {
      pred.result = 'hit';
    } else {
      const midRange = (pred.rangeMin + pred.rangeMax) / 2;
      const basePrice = prices.closes.find(v => v != null);
      if (basePrice != null) {
        const predictedDirection = midRange > basePrice ? 1 : -1;
        const actualDirection = (lastClose || basePrice) > basePrice ? 1 : -1;
        pred.result = predictedDirection === actualDirection ? 'partial' : 'miss';
      } else {
        pred.result = 'miss';
      }
    }
    scoredCount++;
  }
  return { scoredCount, noDataCount };
}


// ─── radar regime grading ───────────────────────────────────────

const BRIEF_SCORES_PATH = path.join(ROOT, 'record', 'data', 'brief-scores.json');
const SCORE_AGGREGATES_PATH = path.join(ROOT, 'record', 'data', 'score-aggregates.json');

function extractRadarCall(brief) {
  const body = brief.body || brief.content || brief.telegramText || '';
  // Two formats live in the archive:
  //   New (post v1): "Phase: OVERHEATING" or "Regime: OVERHEATING"
  //   Old:           inline ". . . Risk-On · Neutral · EXPANSION · Gauge: 39.5/100"
  let phase = body.match(/(?:Phase|Regime):\s*([A-Z_]+)/);
  if (!phase) {
    phase = body.match(/([A-Z]{4,})\s*·\s*Gauge:/);
  }
  let gauge = body.match(/Risk Gauge:\s*([\d.]+)\/100\s*\(([\w-]+)\)/);
  if (!gauge) {
    gauge = body.match(/Gauge:\s*([\d.]+)\/100/);  // old format, no label
  }
  if (!phase) return null;
  return {
    phase: phase[1],
    riskGauge: gauge ? parseFloat(gauge[1]) : null,
    riskLabel: gauge && gauge[2] ? gauge[2] : null,
  };
}

function extractWrapRegimeCheck(brief) {
  const body = brief.body || brief.content || brief.telegramText || '';
  // Newer wraps have explicit "<b>REGIME CHECK</b>" section. Older ones have
  // inline regime in the header area like radar.
  const section = body.match(/<b>REGIME CHECK<\/b>\s*([\s\S]{0,400}?)(?=<b>|$)/i);
  const target = section ? section[1] : body;
  let phase = target.match(/(?:Phase|Regime):\s*([A-Z_]+)/);
  if (!phase) {
    phase = target.match(/([A-Z]{4,})\s*·\s*Gauge:/);
  }
  let gauge = target.match(/Risk Gauge:\s*([\d.]+)\/100\s*\(([\w-]+)\)/);
  if (!gauge) {
    gauge = target.match(/Gauge:\s*([\d.]+)\/100/);
  }
  if (!phase) return null;
  return {
    phase: phase[1],
    riskGauge: gauge ? parseFloat(gauge[1]) : null,
    riskLabel: gauge && gauge[2] ? gauge[2] : null,
  };
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Canonicalize brief's slot identifier. Accepts both:
//   - v1 slot names (radar/signal/pulse/wrap) — set directly on brief.slot
//   - legacy session names (morning/intelligence/midday/evening) — on brief.session
// Returns the canonical v1 slot or null. Future-proofs against ac-compute
// writer migration (when SLOT_PUBLISH_META switches from legacy to v1).
const LEGACY_SESSION_TO_SLOT = {
  morning: 'radar',
  intelligence: 'signal',
  midday: 'pulse',
  evening: 'wrap',
};
const V1_SLOTS = new Set(['radar', 'signal', 'pulse', 'wrap']);

function canonicalSlot(b) {
  if (b.slot && V1_SLOTS.has(b.slot)) return b.slot;
  if (V1_SLOTS.has(b.session)) return b.session;
  return LEGACY_SESSION_TO_SLOT[b.session] || null;
}


function scoreRadar(date, briefs, briefsByDate) {
  const radar = briefs.find(b => canonicalSlot(b) === 'radar');
  if (!radar) return null;
  const radarCall = extractRadarCall(radar);
  if (!radarCall) {
    return { status: 'no_data', summary: 'Could not parse radar regime call' };
  }

  // Preferred: same-day wrap REGIME CHECK (newer briefs have it, older don't).
  const wrap = briefs.find(b => canonicalSlot(b) === 'wrap');
  if (wrap) {
    const wrapCheck = extractWrapRegimeCheck(wrap);
    if (wrapCheck) {
      const dGauge = (wrapCheck.riskGauge != null && radarCall.riskGauge != null)
        ? Math.round((wrapCheck.riskGauge - radarCall.riskGauge) * 10) / 10
        : null;
      if (radarCall.phase === wrapCheck.phase) {
        return {
          status: 'hit',
          summary: `Regime ${radarCall.phase} held all day`,
          details: { morning: radarCall, wrap: wrapCheck, gaugeDelta: dGauge, source: 'same-day-wrap' },
        };
      }
      return {
        status: 'miss',
        summary: `Regime flipped: ${radarCall.phase} \u2192 ${wrapCheck.phase}`,
        details: { morning: radarCall, wrap: wrapCheck, source: 'same-day-wrap' },
      };
    }
  }

  // Fallback: compare to next-day radar (handles all old briefs).
  const nextDate = addDays(date, 1);
  const nextDayBriefs = briefsByDate ? briefsByDate[nextDate] : null;
  const nextRadar = nextDayBriefs ? nextDayBriefs.find(b => canonicalSlot(b) === 'radar') : null;
  if (!nextRadar) {
    return {
      status: 'pending',
      summary: `Regime ${radarCall.phase} called \u2014 awaiting next radar`,
      details: { morning: radarCall, source: 'next-day-radar' },
    };
  }
  const nextCall = extractRadarCall(nextRadar);
  if (!nextCall) {
    return {
      status: 'no_data',
      summary: 'Next-day radar unparseable',
      details: { morning: radarCall, source: 'next-day-radar' },
    };
  }
  if (radarCall.phase === nextCall.phase) {
    return {
      status: 'hit',
      summary: `Regime ${radarCall.phase} held into next day`,
      details: { morning: radarCall, nextDay: nextCall, source: 'next-day-radar' },
    };
  }
  return {
    status: 'miss',
    summary: `Regime flipped: ${radarCall.phase} \u2192 ${nextCall.phase}`,
    details: { morning: radarCall, nextDay: nextCall, source: 'next-day-radar' },
  };
}


// ─── pulse directional grading ──────────────────────────────────

function extractPulseCalls(brief) {
  const body = brief.body || brief.content || brief.telegramText || '';
  // Tolerate <b>, $, commas, anything between TICKER: and — 1d:DIRECTION
  const calls = [];
  const re1 = /(BTC|ETH|SOL):[^\u2014\n]{0,120}\u2014\s*1d:?\s*([A-Z_]+)/gi;
  let m;
  while ((m = re1.exec(body)) !== null) {
    const t = m[1].toUpperCase();
    if (!calls.some(c => c.ticker === t)) {
      calls.push({ ticker: t, direction1d: m[2].toUpperCase() });
    }
  }
  // Catch "(same)" cases — TICKER: ... · (same)
  const re2 = /(BTC|ETH|SOL):[^\u00b7\n]{0,120}\u00b7\s*\(same\)/gi;
  while ((m = re2.exec(body)) !== null) {
    const t = m[1].toUpperCase();
    if (!calls.some(c => c.ticker === t)) {
      calls.push({ ticker: t, direction1d: 'SAME' });
    }
  }
  return calls;
}

// Map raw direction tags to canonical {up, down, flat}.
function normalizePulseDirection(d) {
  // Enumerated against actual pulse archive (2026-02 -> 2026-05): tags used
  // are DISTRIBUTION (50), BULL_REGIME (49), ACCUMULATION (38), RISK_OFF (31),
  // IGNITION (26), BEAR_REGIME (23). Theoretical synonyms kept for safety.
  const up = ['RISK_ON', 'IGNITION', 'ACCUMULATION', 'BREAKOUT', 'BULLISH', 'BULL_REGIME'];
  const down = ['RISK_OFF', 'DISTRIBUTION', 'EXHAUSTION', 'BREAKDOWN', 'BEARISH', 'BEAR_REGIME'];
  if (up.includes(d)) return 'up';
  if (down.includes(d)) return 'down';
  if (d === 'SAME' || d === 'NEUTRAL') return 'flat';
  return null;  // unknown tag
}

async function scorePulse(date, briefs, briefsByDate, priceCache) {
  const pulse = briefs.find(b => canonicalSlot(b) === 'pulse');
  if (!pulse) return null;
  const calls = extractPulseCalls(pulse);
  if (calls.length === 0) {
    return { status: 'no_data', summary: 'Could not parse pulse directional calls' };
  }

  // Score each per-asset against same-day Yahoo open→close.
  const results = [];
  for (const call of calls) {
    const dir = normalizePulseDirection(call.direction1d);
    if (!dir) {
      results.push({ ...call, dir, result: 'no_data' });
      continue;
    }
    // Widen fetch window ±1 day — Yahoo's chart API often returns empty for
    // exact same-day windows. Cache by widened window, find the candle that
    // matches `date` by timestamp.
    const wStart = (() => { const d = new Date(date + 'T00:00:00Z'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    const wEnd   = (() => { const d = new Date(date + 'T00:00:00Z'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const cacheKey = `${call.ticker}:${wStart}:${wEnd}`;
    let prices = priceCache[cacheKey];
    if (prices && (!prices.opens || prices.opens.length === 0)) {
      prices = null;
    }
    if (!prices) {
      prices = await fetchYahooPrices(call.ticker, wStart, wEnd);
      if (prices) priceCache[cacheKey] = prices;
    }
    if (!prices) {
      results.push({ ...call, dir, result: 'no_data' });
      continue;
    }
    // Find the candle whose timestamp falls within `date`'s UTC day.
    const dayStart = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 1000);
    const dayEnd   = dayStart + 86400;
    let idx = -1;
    for (let i = 0; i < (prices.timestamps || []).length; i++) {
      const ts = prices.timestamps[i];
      if (ts >= dayStart && ts < dayEnd) { idx = i; break; }
    }
    if (idx === -1) {
      // No exact match — fall back to closest available candle within window.
      const validOpens = (prices.opens || []).filter(v => v != null);
      const validCloses = prices.closes.filter(v => v != null);
      if (validOpens.length === 0 || validCloses.length === 0) {
        results.push({ ...call, dir, result: 'no_data' });
        continue;
      }
      idx = (prices.opens || []).findIndex(v => v != null);
    }
    const open = prices.opens[idx];
    const close = prices.closes[idx];
    if (open == null || close == null) {
      results.push({ ...call, dir, result: 'no_data' });
      continue;
    }
    const pctChange = (close - open) / open;
    const actualDir = pctChange > 0.005 ? 'up' : pctChange < -0.005 ? 'down' : 'flat';
    let result;
    if (dir === actualDir) result = 'hit';
    else if (dir === 'flat' || actualDir === 'flat') result = 'partial';
    else result = 'miss';  // opposite directions
    results.push({ ticker: call.ticker, direction1d: call.direction1d, dir, actualDir, open, close, pctChange: Math.round(pctChange * 10000) / 100, result });
  }

  // Aggregate per-asset results into pulse-level grade
  const hits = results.filter(r => r.result === 'hit').length;
  const partials = results.filter(r => r.result === 'partial').length;
  const misses = results.filter(r => r.result === 'miss').length;
  const noData = results.filter(r => r.result === 'no_data').length;

  if (hits + partials + misses === 0) {
    return { status: 'no_data', summary: 'Could not score any pulse asset', details: { results } };
  }

  let status;
  let summary;
  if (hits >= 2) {
    status = 'hit';
    summary = `${hits}/${results.length} crypto directional calls hit`;
  } else if (hits === 1 || partials >= 2) {
    status = 'partial';
    summary = `${hits} hit, ${partials} partial of ${results.length}`;
  } else {
    status = 'miss';
    summary = `${hits}/${results.length} directional calls hit`;
  }
  return { status, summary, details: { hits, partials, misses, noData, results } };
}

// ─── wrap next-day-setup grading ────────────────────────────────

function extractWrapRegimeOrSynthesis(brief) {
  // Try REGIME CHECK first (newer). Fallback: scan synthesis prose for regime keywords.
  const explicit = extractWrapRegimeCheck(brief);
  if (explicit) return explicit;
  const body = brief.body || brief.content || brief.telegramText || '';
  // Look for uppercase regime token in body or "regime" mention
  const REGIMES = ['EXPANSION', 'OVERHEATING', 'STAGFLATION', 'CONTRACTION', 'RECESSION', 'DISPLACEMENT'];
  // Prefer first uppercase occurrence
  const upperMatch = body.match(/\b(EXPANSION|OVERHEATING|STAGFLATION|CONTRACTION|RECESSION|DISPLACEMENT)\b/);
  if (upperMatch) return { phase: upperMatch[1], riskGauge: null, riskLabel: null };
  // Lower-case mention in prose (synthesis)
  const lowerMatch = body.toLowerCase().match(/\b(expansion|overheating|stagflation|contraction|recession|displacement)\b/);
  if (lowerMatch) return { phase: lowerMatch[1].toUpperCase(), riskGauge: null, riskLabel: null };
  return null;
}

function regimeRiskBias(phase) {
  // Map regime → risk-on/risk-off bias. Used for wrap's directional axis.
  const riskOn = ['EXPANSION', 'OVERHEATING'];
  const riskOff = ['STAGFLATION', 'RECESSION', 'CONTRACTION', 'DISPLACEMENT'];
  if (riskOn.includes(phase)) return 'risk_on';
  if (riskOff.includes(phase)) return 'risk_off';
  return null;
}

async function checkWrapDirection(date, wrapPhase, priceCache) {
  // Fetch SPY for wrap day + next day, compute overnight gap, compare to bias.
  const bias = regimeRiskBias(wrapPhase);
  if (!bias) return null;
  const nextDate = addDays(date, 1);
  const wStart = (() => { const d = new Date(date + 'T00:00:00Z'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const wEnd   = (() => { const d = new Date(date + 'T00:00:00Z'); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); })();
  const cacheKey = `SPY:${wStart}:${wEnd}`;
  let prices = priceCache[cacheKey];
  if (prices && (!prices.opens || prices.opens.length === 0)) prices = null;
  if (!prices) {
    prices = await fetchYahooPrices('SPY', wStart, wEnd);
    if (prices) priceCache[cacheKey] = prices;
  }
  if (!prices) return null;
  const wrapDayStart = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 1000);
  const nextDayStart = Math.floor(new Date(nextDate + 'T00:00:00Z').getTime() / 1000);
  let wrapIdx = -1, nextIdx = -1;
  for (let i = 0; i < (prices.timestamps || []).length; i++) {
    const ts = prices.timestamps[i];
    if (ts >= wrapDayStart && ts < wrapDayStart + 86400) wrapIdx = i;
    if (ts >= nextDayStart && ts < nextDayStart + 86400) nextIdx = i;
  }
  if (wrapIdx === -1 || nextIdx === -1) return null;
  const wrapClose = prices.closes[wrapIdx];
  const nextOpen = prices.opens[nextIdx];
  if (wrapClose == null || nextOpen == null) return null;
  const gap = (nextOpen - wrapClose) / wrapClose;
  const gapPct = Math.round(gap * 10000) / 100;
  const actual = gap > 0.003 ? 'risk_on' : gap < -0.003 ? 'risk_off' : 'flat';
  return { bias, actual, gapPct, wrapClose, nextOpen };
}

async function scoreWrap(date, briefs, briefsByDate, priceCache) {
  const wrap = briefs.find(b => canonicalSlot(b) === 'wrap');
  if (!wrap) return null;
  const wrapCall = extractWrapRegimeOrSynthesis(wrap);
  if (!wrapCall) {
    return { status: 'no_data', summary: 'Could not extract wrap regime framing' };
  }
  const nextDate = addDays(date, 1);
  const nextDayBriefs = briefsByDate ? briefsByDate[nextDate] : null;
  const nextRadar = nextDayBriefs ? nextDayBriefs.find(b => canonicalSlot(b) === 'radar') : null;
  if (!nextRadar) {
    return {
      status: 'pending',
      summary: `Wrap framed ${wrapCall.phase} \u2014 awaiting next-day open`,
      details: { wrap: wrapCall },
    };
  }
  const nextCall = extractRadarCall(nextRadar);
  if (!nextCall) {
    return {
      status: 'no_data',
      summary: 'Next-day radar unparseable',
      details: { wrap: wrapCall },
    };
  }
  const regimeMatched = wrapCall.phase === nextCall.phase;
  // Directional axis: compare wrap's regime bias to SPY overnight gap
  const direction = await checkWrapDirection(date, wrapCall.phase, priceCache);
  const directionMatched = direction
    ? (direction.bias === direction.actual || direction.actual === 'flat')
    : null;

  // Combine: HIT if both pass (or direction unavailable + regime held).
  // PARTIAL if exactly one passes. MISS if both fail.
  let status, summary;
  if (directionMatched === null) {
    // No price data — fall back to regime-only
    if (regimeMatched) {
      status = 'hit';
      summary = `Regime ${wrapCall.phase} held overnight (no SPY data for direction check)`;
    } else {
      status = 'miss';
      summary = `Regime flipped overnight: ${wrapCall.phase} \u2192 ${nextCall.phase}`;
    }
  } else if (regimeMatched && directionMatched) {
    status = 'hit';
    summary = `Regime ${wrapCall.phase} held + SPY overnight ${direction.gapPct >= 0 ? '+' : ''}${direction.gapPct}% consistent with ${direction.bias}`;
  } else if (regimeMatched && !directionMatched) {
    status = 'partial';
    summary = `Regime held but SPY overnight ${direction.gapPct >= 0 ? '+' : ''}${direction.gapPct}% \u2014 contradicts ${direction.bias} bias`;
  } else if (!regimeMatched && directionMatched) {
    status = 'partial';
    summary = `Regime flipped ${wrapCall.phase}\u2192${nextCall.phase} but price direction ${direction.actual} held`;
  } else {
    status = 'miss';
    summary = `Regime flipped + price direction off (${wrapCall.phase}\u2192${nextCall.phase}, SPY ${direction.gapPct >= 0 ? '+' : ''}${direction.gapPct}%)`;
  }
  return {
    status,
    summary,
    details: { wrap: wrapCall, nextRadar: nextCall, direction, regimeMatched, directionMatched },
  };
}

async function scoreAllBriefs(briefs, priceCache) {
  // Group by date
  const byDate = {};
  for (const b of briefs) {
    const d = b.date;
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(b);
  }
  const scores = {};
  for (const [date, dayBriefs] of Object.entries(byDate)) {
    scores[date] = {
      radar: scoreRadar(date, dayBriefs, byDate),
      pulse: await scorePulse(date, dayBriefs, byDate, priceCache),
      wrap: await scoreWrap(date, dayBriefs, byDate, priceCache),
    };
  }
  return scores;
}

// ─── aggregate accuracy stats ───────────────────────────────────

function computeAggregates(briefScoresMap, predictionsArr) {
  // Per-slot stats from brief-scores: hit / partial / miss / pending / no_data
  const slots = ['radar', 'signal', 'pulse', 'wrap'];
  const out = { perSlot: {}, signalPredictions: null, overall: null, computedAt: new Date().toISOString() };

  // Brief-scores per slot
  for (const slot of slots) {
    const counts = { hit: 0, partial: 0, miss: 0, pending: 0, no_data: 0, absent: 0 };
    for (const day of Object.values(briefScoresMap)) {
      const s = day[slot];
      if (!s) { counts.absent++; continue; }
      counts[s.status] = (counts[s.status] || 0) + 1;
    }
    const scored = counts.hit + counts.partial + counts.miss;
    out.perSlot[slot] = {
      ...counts,
      scored,
      hitRate: scored ? Math.round((counts.hit / scored) * 1000) / 10 : null,
      weightedAccuracy: scored ? Math.round(((counts.hit + 0.5 * counts.partial) / scored) * 1000) / 10 : null,
    };
  }

  // Signal predictions (per-target, finer-grained than per-brief)
  const sp = { hit: 0, partial: 0, miss: 0, pending: 0, no_data: 0 };
  for (const p of (predictionsArr || [])) {
    if (sp[p.result] !== undefined) sp[p.result]++;
  }
  const spScored = sp.hit + sp.partial + sp.miss;
  out.signalPredictions = {
    ...sp,
    scored: spScored,
    hitRate: spScored ? Math.round((sp.hit / spScored) * 1000) / 10 : null,
    weightedAccuracy: spScored ? Math.round(((sp.hit + 0.5 * sp.partial) / spScored) * 1000) / 10 : null,
  };

  // Overall: sum of all 4 slot scores + signal predictions
  let oH = 0, oP = 0, oM = 0;
  for (const slot of slots) {
    oH += out.perSlot[slot].hit;
    oP += out.perSlot[slot].partial;
    oM += out.perSlot[slot].miss;
  }
  oH += sp.hit; oP += sp.partial; oM += sp.miss;
  const oScored = oH + oP + oM;
  out.overall = {
    hit: oH, partial: oP, miss: oM, scored: oScored,
    hitRate: oScored ? Math.round((oH / oScored) * 1000) / 10 : null,
    weightedAccuracy: oScored ? Math.round(((oH + 0.5 * oP) / oScored) * 1000) / 10 : null,
  };

  // ─── Brier + calibration stats ───
  const scoredWithBrier = (predictionsArr || []).filter(p => Number.isFinite(p.brier_score));
  if (scoredWithBrier.length > 0) {
    const sum = scoredWithBrier.reduce((s, p) => s + p.brier_score, 0);
    const meanBrier = sum / scoredWithBrier.length;

    // Per-scenario
    const perScenario = {};
    for (const letter of ['A', 'B', 'C']) {
      const subset = scoredWithBrier.filter(p => p.scenario === letter);
      perScenario[letter] = {
        n: subset.length,
        meanBrier: subset.length ? +(subset.reduce((s, p) => s + p.brier_score, 0) / subset.length).toFixed(4) : null,
      };
    }

    out.brierStats = {
      n: scoredWithBrier.length,
      meanBrier: +meanBrier.toFixed(4),
      // Baseline: random 50-50 guess on every prediction gives meanBrier = 0.25
      // Naive uniform-prior (33/33/34) baseline ≈ varies but ~0.39 for our mix
      baselineRandom: 0.25,
      perScenario,
      reliability: reliabilityBuckets(predictionsArr || []),
      note: 'Lower is better. probability derived from scenarioTilt(regime, riskGauge) at prediction date.',
    };
  }

  return out;
}

// ─── main ───────────────────────────────────────────────────────

async function main() {
  console.log(`[score] mode: ${DRY ? 'DRY-RUN' : 'WRITE'}`);

  // Load
  if (!fs.existsSync(ARCHIVE_PATH)) {
    console.error(`[score] briefs archive not found at ${ARCHIVE_PATH}`);
    process.exit(1);
  }
  const archiveRaw = JSON.parse(fs.readFileSync(ARCHIVE_PATH));
  const briefs = Array.isArray(archiveRaw)
    ? archiveRaw
    : (archiveRaw.briefs || Object.values(archiveRaw));
  console.log(`[score] loaded ${briefs.length} briefs from archive`);

  const predictionsData = fs.existsSync(PREDICTIONS_PATH)
    ? JSON.parse(fs.readFileSync(PREDICTIONS_PATH))
    : { predictions: [], lastScored: null };
  const priceCache = fs.existsSync(PRICE_CACHE_PATH)
    ? JSON.parse(fs.readFileSync(PRICE_CACHE_PATH))
    : {};
  console.log(`[score] loaded ${predictionsData.predictions.length} existing predictions, ${Object.keys(priceCache).length} cached price ranges`);

  // Extract new
  const allExtracted = extractPredictions(briefs);
  const existingIds = new Set(predictionsData.predictions.map(p => p.id));
  const newPreds = allExtracted.filter(p => !existingIds.has(p.id));
  console.log(`[score] extracted ${allExtracted.length} predictions from briefs, ${newPreds.length} are new`);
  predictionsData.predictions.push(...newPreds);

  // Score
  const { scoredCount, noDataCount } = await scorePredictions(predictionsData.predictions, priceCache);
  console.log(`[score] scored ${scoredCount} predictions, ${noDataCount} no-data`);

  // Summary
  const all = predictionsData.predictions;
  const hits = all.filter(p => p.result === 'hit').length;
  const partials = all.filter(p => p.result === 'partial').length;
  const misses = all.filter(p => p.result === 'miss').length;
  const pending = all.filter(p => p.result === 'pending').length;
  const noData = all.filter(p => p.result === 'no_data').length;
  console.log(`[score] totals — hit:${hits} partial:${partials} miss:${misses} pending:${pending} no_data:${noData}`);

  // Score all briefs (radar regime + pulse direction + wrap next-day setup)
  console.log('[score] grading briefs (radar + pulse + wrap)...');
  const briefScores = await scoreAllBriefs(briefs, priceCache);
  const briefScoresEnvelope = {
    scores: briefScores,
    lastScored: new Date().toISOString(),
  };
  for (const slot of ['radar', 'pulse', 'wrap']) {
    const sts = Object.values(briefScores).map(s => s[slot]?.status).filter(Boolean);
    const h = sts.filter(s => s === 'hit').length;
    const p = sts.filter(s => s === 'partial').length;
    const m = sts.filter(s => s === 'miss').length;
    const pe = sts.filter(s => s === 'pending').length;
    const nd = sts.filter(s => s === 'no_data').length;
    console.log(`[score] ${slot} — hit:${h} partial:${p} miss:${m} pending:${pe} no_data:${nd}`);
  }

  // ─── Brier enrichment — compute probability + brier_score per prediction ───
  const dateToMacro = buildDateToMacro(briefScores);
  const brierCounts = enrichWithBrier(predictionsData.predictions, dateToMacro);
  console.log(`[score] brier — enriched:${brierCounts.enriched} skipped:${brierCounts.skipped}`);

  // Update lastScored
  predictionsData.lastScored = new Date().toISOString();

  // Write
  if (DRY) {
    console.log(`[score] DRY-RUN — no files written`);
    return;
  }
  fs.writeFileSync(PREDICTIONS_PATH, JSON.stringify(predictionsData, null, 2));
  fs.writeFileSync(PRICE_CACHE_PATH, JSON.stringify(priceCache, null, 2));
  fs.writeFileSync(BRIEF_SCORES_PATH, JSON.stringify(briefScoresEnvelope, null, 2));
  const aggregates = computeAggregates(briefScores, predictionsData.predictions);
  fs.writeFileSync(SCORE_AGGREGATES_PATH, JSON.stringify(aggregates, null, 2));
  console.log(`[score] aggregates: overall ${aggregates.overall.weightedAccuracy}% weighted (${aggregates.overall.hit}H/${aggregates.overall.partial}P/${aggregates.overall.miss}M scored)`);
  if (aggregates.brierStats) {
    const bs = aggregates.brierStats;
    console.log(`[score] brier: meanBrier=${bs.meanBrier} (n=${bs.n}, baseline-random=${bs.baselineRandom}) per-scenario A=${bs.perScenario.A.meanBrier} B=${bs.perScenario.B.meanBrier} C=${bs.perScenario.C.meanBrier}`);
  }
  console.log(`[score] wrote ${PREDICTIONS_PATH} + ${PRICE_CACHE_PATH} + ${BRIEF_SCORES_PATH} + ${SCORE_AGGREGATES_PATH}`);
}

main().catch((e) => {
  console.error('[score] FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
