import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractAssets, extractRegime, extractRegimeLabel,
  extractMovers, extractEntities,
} from './entity-extraction.mjs';

const assetMapPath = path.join(import.meta.dirname || new URL('.', import.meta.url).pathname, 'asset-map.json');
const assetMap = JSON.parse(fs.readFileSync(assetMapPath, 'utf8')).assets;

test('asset-map.json loads + has 60+ entries', () => {
  assert.ok(assetMap.length >= 60);
  assert.ok(assetMap.find(a => a.symbol === 'BTC'));
  assert.ok(assetMap.find(a => a.symbol === 'SPY'));
});

test('extractAssets finds tickers in body', () => {
  const brief = {
    body: 'BTC: $79,111 · ETH: $2,229 · SOL: $89.16',
  };
  const r = extractAssets(brief, assetMap);
  assert.ok(r.includes('BTC'));
  assert.ok(r.includes('ETH'));
  assert.ok(r.includes('SOL'));
});

test('extractAssets finds aliases (Bitcoin → BTC)', () => {
  const brief = { body: 'Bitcoin and Ethereum led the move.' };
  const r = extractAssets(brief, assetMap);
  assert.ok(r.includes('BTC'));
  assert.ok(r.includes('ETH'));
});

test('extractAssets does not match inside other tokens', () => {
  // "INTU" should not match a hypothetical "intuition" word
  const brief = { body: 'The market shows intuitive structure.' };
  const r = extractAssets(brief, assetMap);
  // INTU is in the map but should not match inside "intuitive"
  assert.equal(r.includes('INTU'), false);
});

test('extractAssets finds tickers in panel rows (TOP MOVERS)', () => {
  const brief = {
    body: '',
    panels: [
      {
        label: 'TOP MOVERS',
        rows: [
          { k: 'SLV', v: '-13.0%', c: 'red' },
          { k: 'COPX', v: '-9.6%', c: 'red' },
        ],
      },
    ],
  };
  const r = extractAssets(brief, assetMap);
  assert.ok(r.includes('SLV'));
  assert.ok(r.includes('COPX'));
});

test('extractAssets dedupes', () => {
  const brief = { body: 'BTC BTC BTC bitcoin Bitcoin' };
  const r = extractAssets(brief, assetMap);
  const btcCount = r.filter(s => s === 'BTC').length;
  assert.equal(btcCount, 1);
});

test('extractAssets strips HTML before scanning', () => {
  const brief = { body: '<b>BTC</b> moved <i>+5%</i> against <a>SPY</a>' };
  const r = extractAssets(brief, assetMap);
  assert.ok(r.includes('BTC'));
  assert.ok(r.includes('SPY'));
});

test('extractRegime reads from tags first', () => {
  const brief = {
    tags: [{ t: 'LOW', c: 'green' }, { t: 'OVERHEATING', c: 'blue' }],
    body: '',
  };
  assert.equal(extractRegime(brief), 'overheating');
});

test('extractRegime falls back to body scan', () => {
  const brief = { tags: [], body: 'Regime: STAGFLATION. Phase: stagflation.' };
  assert.equal(extractRegime(brief), 'stagflation');
});

test('extractRegime returns null on no match', () => {
  const brief = { tags: [], body: 'no regime word here' };
  assert.equal(extractRegime(brief), null);
});

test('extractMovers parses panel rows', () => {
  const brief = {
    panels: [{
      label: 'TOP MOVERS',
      rows: [
        { k: 'SLV', v: '-13.0%', c: 'red' },
        { k: 'VIX', v: '+6.8%', c: 'green' },
      ],
    }],
  };
  const r = extractMovers(brief);
  assert.equal(r.length, 2);
  assert.equal(r[0].sym, 'SLV');
  assert.equal(r[0].chg, -13.0);
  assert.equal(r[0].direction, 'down');
  assert.equal(r[1].direction, 'up');
});

test('extractMovers skips non-TOP-MOVERS panels', () => {
  const brief = {
    panels: [
      { label: 'RISK GAUGE', gauge: { value: 14 } },
      { label: 'TOP MOVERS', rows: [{ k: 'SLV', v: '-13.0%' }] },
    ],
  };
  const r = extractMovers(brief);
  assert.equal(r.length, 1);
  assert.equal(r[0].sym, 'SLV');
});

test('extractEntities combines all four', () => {
  const brief = {
    slot: 'radar',
    headline: 'MACRO RADAR — May 17',
    body: 'BTC $79,111 · ETH $2,229. Phase: OVERHEATING.',
    tags: [{ t: 'OVERHEATING', c: 'blue' }],
    panels: [{ label: 'TOP MOVERS', rows: [{ k: 'SLV', v: '-13.0%' }] }],
  };
  const r = extractEntities(brief, assetMap);
  assert.ok(r.assets.includes('BTC'));
  assert.ok(r.assets.includes('ETH'));
  assert.ok(r.assets.includes('SLV'));
  assert.equal(r.regime, 'overheating');
  assert.equal(r.movers.length, 1);
});
