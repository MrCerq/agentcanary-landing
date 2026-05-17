import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOTS, THEME, TAG_COLORS, REGIME_LABELS, CANONICAL_REGIMES,
  escapeHtml, humanize, resolveSlot, slotMeta, entityLink,
  formatDate, monthName, validate, resolveAsset,
} from './render-utils.mjs';

test('SLOTS enum is exactly the four canonical slots', () => {
  assert.deepEqual(SLOTS, ['radar', 'signal', 'pulse', 'wrap']);
});

test('THEME has all 4 slots with required fields', () => {
  for (const slot of SLOTS) {
    const t = THEME[slot];
    assert.ok(t.label);
    assert.ok(t.color);
    assert.ok(t.accentRgb);
    assert.match(t.fireTimeUTC, /^\d{2}:\d{2}$/);
  }
});

test('TAG_COLORS has 6 semantic tokens', () => {
  assert.deepEqual(
    Object.keys(TAG_COLORS).sort(),
    ['blue', 'green', 'orange', 'purple', 'red', 'yellow']
  );
});

test('CANONICAL_REGIMES has 6 phases', () => {
  assert.equal(CANONICAL_REGIMES.length, 6);
  assert.ok(CANONICAL_REGIMES.includes('overheating'));
  assert.ok(CANONICAL_REGIMES.includes('stagflation'));
});

test('escapeHtml handles <>&"\'\'', () => {
  assert.equal(escapeHtml('<a href="x">o\'k</a>'), '&lt;a href=&quot;x&quot;&gt;o&#39;k&lt;/a&gt;');
  assert.equal(escapeHtml('A & B'), 'A &amp; B');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('humanize replaces regime tokens', () => {
  assert.equal(humanize('BTC: 1d:BULL_REGIME · 4h:ACCUMULATION'), 'BTC: 1d:Bullish · 4h:Accumulation');
  assert.equal(humanize('transferred from unk to #Coinbase'), 'transferred from unknown to #Coinbase');
});

test('humanize is idempotent', () => {
  const once = humanize('BTC: 1d:BULL_REGIME');
  const twice = humanize(once);
  assert.equal(once, twice);
});

test('resolveSlot returns canonical slot from new field', () => {
  assert.equal(resolveSlot({ slot: 'radar' }), 'radar');
  assert.equal(resolveSlot({ slot: 'wrap' }), 'wrap');
});

test('resolveSlot bridges legacy session field during bake', () => {
  assert.equal(resolveSlot({ session: 'morning' }), 'radar');
  assert.equal(resolveSlot({ session: 'midday' }), 'pulse');
  assert.equal(resolveSlot({ session: 'intelligence' }), 'signal');
  assert.equal(resolveSlot({ session: 'signal' }), 'signal');
  assert.equal(resolveSlot({ session: 'evening' }), 'wrap');
});

test('resolveSlot returns null for unknown / cycle / missing', () => {
  assert.equal(resolveSlot({}), null);
  assert.equal(resolveSlot({ session: 'cycle' }), null);
  assert.equal(resolveSlot(null), null);
});

test('slotMeta throws on unknown slot', () => {
  assert.throws(() => slotMeta('garbage'));
});

test('entityLink produces canonical asset href', () => {
  const html = entityLink('BTC', 'asset');
  assert.match(html, /href="\/assets\/BTC\/"/);
  assert.match(html, />BTC</);
});

test('entityLink produces canonical regime href', () => {
  const html = entityLink('overheating', 'regime');
  assert.match(html, /href="\/regimes\/overheating\/"/);
});

test('entityLink throws on bad kind', () => {
  assert.throws(() => entityLink('BTC', 'mystery'));
});

test('formatDate produces human-readable', () => {
  assert.equal(formatDate('2026-05-17'), 'May 17, 2026');
});

test('monthName returns full month', () => {
  assert.equal(monthName(5), 'May');
  assert.equal(monthName(12), 'December');
});

test('validate accepts a complete brief', () => {
  const brief = {
    slot: 'radar',
    date: '2026-05-17',
    headline: 'MACRO RADAR — May 17',
    body: '<b>MACRO OVERVIEW</b>\nRisk Gauge: 13.8/100 (Calm). Phase: OVERHEATING.',
    tags: [{ t: 'LOW', c: 'green' }, { t: 'OVERHEATING', c: 'blue' }],
    panels: [{ type: 'gauge', label: 'RISK GAUGE', value: 14 }],
  };
  const r = validate(brief);
  assert.ok(r.ok, JSON.stringify(r.errors));
});

test('validate accepts legacy session + telegramText (bake window)', () => {
  const brief = {
    session: 'morning',
    date: '2026-05-17',
    headline: 'MACRO RADAR — May 17',
    telegramText: 'body content',
  };
  const r = validate(brief);
  assert.ok(r.ok, JSON.stringify(r.errors));
});

test('validate rejects missing date', () => {
  const r = validate({ slot: 'radar', headline: 'x', body: 'y' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('date')));
});

test('validate rejects bad tag color', () => {
  const r = validate({
    slot: 'radar', date: '2026-05-17', headline: 'x', body: 'y',
    tags: [{ t: 'LOW', c: 'magenta' }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('magenta')));
});

test('resolveAsset matches by symbol case-insensitively', () => {
  const map = [
    { symbol: 'BTC', aliases: ['BTC', 'Bitcoin'] },
    { symbol: 'SPY', aliases: ['SPY', 'S&P 500'] },
  ];
  assert.equal(resolveAsset('BTC', map), 'BTC');
  assert.equal(resolveAsset('btc', map), 'BTC');
  assert.equal(resolveAsset('Bitcoin', map), 'BTC');
  assert.equal(resolveAsset('S&P 500', map), 'SPY');
  assert.equal(resolveAsset('UNKNOWN', map), null);
});
