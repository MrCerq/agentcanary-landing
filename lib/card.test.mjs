import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard, briefPermalink } from './card.mjs';

const FIXTURE_BRIEF = {
  slot: 'radar',
  date: '2026-05-17',
  publishedAt: '2026-05-17T03:15:00Z',
  headline: 'MACRO RADAR — May 17',
  desc: 'Risk 14/100 · 6 movers',
  tags: [
    { t: 'LOW', c: 'green' },
    { t: 'OVERHEATING', c: 'blue' },
  ],
  panels: [
    { type: 'gauge', label: 'RISK GAUGE', value: 14 },
    {
      type: 'rows',
      label: 'TOP MOVERS',
      rows: [
        { k: 'SLV', v: '-13.0%', c: 'red' },
        { k: 'VIX', v: '+6.8%', c: 'green' },
      ],
    },
  ],
  body: '<b>MACRO OVERVIEW</b>\nRisk Gauge: 13.8/100 (Calm). Phase: OVERHEATING.\n\n<b>CRYPTO</b>\nBTC: $79,111',
};

test('renderCard tile contains slot label + headline', () => {
  const html = renderCard(FIXTURE_BRIEF, 'tile');
  assert.match(html, /MACRO RADAR/);
  assert.match(html, /MACRO RADAR — May 17/);
});

test('renderCard tile is a link to the brief permalink', () => {
  const html = renderCard(FIXTURE_BRIEF, 'tile');
  assert.match(html, /href="\/record\/2026\/05\/17\/radar\/"/);
});

test('renderCard card tier has card padding + headline size', () => {
  const html = renderCard(FIXTURE_BRIEF, 'card');
  assert.match(html, /padding:32px 36px/);
  assert.match(html, /font-size:clamp\(22px, 3vw, 32px\)/);
});

test('renderCard card tier shows all tags + all panels', () => {
  const html = renderCard(FIXTURE_BRIEF, 'card');
  assert.match(html, /LOW/);
  assert.match(html, /OVERHEATING/);
  assert.match(html, /RISK GAUGE/);
  assert.match(html, /TOP MOVERS/);
});

test('renderCard page tier shows body content + entity links not required without assetMap', () => {
  const html = renderCard(FIXTURE_BRIEF, 'page');
  assert.match(html, /MACRO OVERVIEW/);
  assert.match(html, /BTC: \$79,111/);
});

test('renderCard page tier shows body expanded (not collapsed)', () => {
  const html = renderCard(FIXTURE_BRIEF, 'page');
  // No EXPAND button anywhere
  assert.equal(html.includes('EXPAND'), false);
  // ac-page-body div exists and is not display:none
  assert.match(html, /class="ac-page-body"/);
  assert.equal(html.includes('display:none'), false);
});

test('renderCard page tier visual parity: padding + headline match card', () => {
  const html = renderCard(FIXTURE_BRIEF, 'page');
  assert.match(html, /padding:32px 36px/);
  assert.match(html, /font-size:clamp\(22px, 3vw, 32px\)/);
});

test('renderCard throws on unknown tier', () => {
  assert.throws(() => renderCard(FIXTURE_BRIEF, 'mystery'));
});

test('renderCard throws on brief with no resolvable slot', () => {
  assert.throws(() => renderCard({ date: '2026-05-17', headline: 'x', body: 'y' }, 'card'));
});

test('renderCard accepts legacy session field (bake)', () => {
  const legacy = { ...FIXTURE_BRIEF };
  delete legacy.slot;
  legacy.session = 'morning';
  const html = renderCard(legacy, 'card');
  assert.match(html, /MACRO RADAR/);
});

test('briefPermalink builds canonical URL', () => {
  assert.equal(briefPermalink(FIXTURE_BRIEF), '/record/2026/05/17/radar/');
  assert.equal(briefPermalink({ slot: 'wrap', date: '2026-05-16' }), '/record/2026/05/16/wrap/');
});

test('renderCard inserts entity links when assetMap provided', () => {
  const brief = {
    ...FIXTURE_BRIEF,
    entities: { assets: ['BTC'], regime: 'overheating' },
  };
  const assetMap = [{ symbol: 'BTC', aliases: ['BTC'] }];
  const html = renderCard(brief, 'page', { assetMap });
  assert.match(html, /href="\/assets\/BTC\/"/);
  assert.match(html, /href="\/regimes\/overheating\/"/);
});
