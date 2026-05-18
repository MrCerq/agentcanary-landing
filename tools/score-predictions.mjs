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

function extractPredictions(briefs) {
  const predictions = [];
  for (const b of briefs) {
    if (b.session !== 'intelligence' && b.session !== 'signal') continue;
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

  // Update lastScored
  predictionsData.lastScored = new Date().toISOString();

  // Write
  if (DRY) {
    console.log(`[score] DRY-RUN — no files written`);
    return;
  }
  fs.writeFileSync(PREDICTIONS_PATH, JSON.stringify(predictionsData, null, 2));
  fs.writeFileSync(PRICE_CACHE_PATH, JSON.stringify(priceCache, null, 2));
  console.log(`[score] wrote ${PREDICTIONS_PATH} + ${PRICE_CACHE_PATH}`);
}

main().catch((e) => {
  console.error('[score] FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
