import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndex } from './page.mjs';

test('renderIndex throws without type', () => {
  assert.throws(() => renderIndex({}));
});

test('renderIndex collection has h1 + JSON-LD + canonical', () => {
  const html = renderIndex({
    type: 'collection',
    days: [{ date: '2026-05-17', briefs: [{ slot: 'radar', date: '2026-05-17', headline: 'X', body: '' }] }],
  });
  assert.match(html, /<h1[^>]*>The Record<\/h1>/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/agentcanary\.ai\/record\/">/);
});

test('renderIndex year shows months', () => {
  const html = renderIndex({
    type: 'year',
    year: 2026,
    months: [{ month: 5, briefCount: 17 }, { month: 4, briefCount: 30 }],
  });
  assert.match(html, /<h1[^>]*>2026 — The Record<\/h1>/);
  assert.match(html, /May/);
  assert.match(html, /April/);
  assert.match(html, /href="\/record\/2026\/05\/"/);
});

test('renderIndex month shows days', () => {
  const html = renderIndex({
    type: 'month',
    year: 2026,
    month: '05',
    days: [
      { date: '2026-05-17', briefCount: 1, regime: 'overheating' },
      { date: '2026-05-16', briefCount: 4, regime: 'overheating' },
    ],
  });
  assert.match(html, /May 2026 — The Record/);
  assert.match(html, /href="\/record\/2026\/05\/17\/"/);
  assert.match(html, /href="\/record\/2026\/05\/16\/"/);
  assert.match(html, /OVERHEATING/);
});

test('renderIndex day stacks brief cards in page-tier', () => {
  const briefs = [
    {
      slot: 'radar', date: '2026-05-17', headline: 'MACRO RADAR — May 17',
      desc: 'Risk 14/100', tags: [], panels: [], body: '<b>OVERVIEW</b>',
    },
    {
      slot: 'pulse', date: '2026-05-17', headline: 'MARKET PULSE — May 17',
      desc: 'Live', tags: [], panels: [], body: '<b>CRYPTO</b>',
    },
  ];
  const html = renderIndex({ type: 'day', date: '2026-05-17', briefs });
  assert.match(html, /May 17, 2026 — The Record/);
  assert.match(html, /MACRO RADAR/);
  assert.match(html, /MARKET PULSE/);
  // Sorted slot order: radar before pulse
  assert.ok(html.indexOf('MACRO RADAR') < html.indexOf('MARKET PULSE'));
});

test('renderIndex day includes prev/next links', () => {
  const html = renderIndex({
    type: 'day',
    date: '2026-05-17',
    briefs: [{ slot: 'radar', date: '2026-05-17', headline: 'x', body: '', tags: [], panels: [] }],
    prevDate: '2026-05-16',
    nextDate: '2026-05-18',
  });
  assert.match(html, /<link rel="prev" href="\/record\/2026\/05\/16\/">/);
  assert.match(html, /<link rel="next" href="\/record\/2026\/05\/18\/">/);
});

test('renderIndex day JSON-LD has ItemList with 4 child NewsArticles when 4 briefs', () => {
  const briefs = [
    { slot: 'radar', date: '2026-05-17', headline: 'r', body: '', tags: [], panels: [] },
    { slot: 'signal', date: '2026-05-17', headline: 's', body: '', tags: [], panels: [] },
    { slot: 'pulse', date: '2026-05-17', headline: 'p', body: '', tags: [], panels: [] },
    { slot: 'wrap', date: '2026-05-17', headline: 'w', body: '', tags: [], panels: [] },
  ];
  const html = renderIndex({ type: 'day', date: '2026-05-17', briefs });
  assert.match(html, /"@type":"ItemList"/);
  assert.match(html, /"numberOfItems":4/);
  // Verify 4 NewsArticle entries
  const newsArticleCount = (html.match(/"@type":"NewsArticle"/g) || []).length;
  assert.equal(newsArticleCount, 4);
});

test('renderIndex asset noindex when <3 mentions', () => {
  const html = renderIndex({
    type: 'asset',
    ticker: 'OBSCURE',
    mentions: [
      { headline: 'h', permalink: '/x/', date: '2026-05-17' },
    ],
  });
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
});

test('renderIndex asset NOT noindex when >=3 mentions', () => {
  const html = renderIndex({
    type: 'asset',
    ticker: 'BTC',
    mentions: [
      { headline: 'h1', permalink: '/x/', date: '2026-05-17' },
      { headline: 'h2', permalink: '/y/', date: '2026-05-16' },
      { headline: 'h3', permalink: '/z/', date: '2026-05-15' },
    ],
  });
  assert.equal(html.includes('noindex'), false);
});

test('renderIndex regime has CollectionPage + ItemList', () => {
  const html = renderIndex({
    type: 'regime',
    slug: 'overheating',
    mentions: [
      { headline: 'May 17', permalink: '/x/', date: '2026-05-17' },
    ],
  });
  assert.match(html, /Overheating regime — The Record/);
  assert.match(html, /"@type":"CollectionPage"/);
});

test('All page types emit valid JSON-LD parseable', () => {
  const cases = [
    { type: 'collection', days: [] },
    { type: 'year', year: 2026, months: [{ month: 5, briefCount: 1 }] },
    { type: 'month', year: 2026, month: '05', days: [{ date: '2026-05-17', briefCount: 1 }] },
    { type: 'day', date: '2026-05-17', briefs: [{ slot: 'radar', date: '2026-05-17', headline: 'x', body: '', tags: [], panels: [] }] },
    { type: 'asset', ticker: 'BTC', mentions: [{ headline: 'x', permalink: '/x/', date: '2026-05-17' }] },
    { type: 'regime', slug: 'overheating', mentions: [{ headline: 'x', permalink: '/x/', date: '2026-05-17' }] },
  ];
  for (const c of cases) {
    const html = renderIndex(c);
    const m = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    assert.ok(m, `no JSON-LD in ${c.type}`);
    assert.doesNotThrow(() => JSON.parse(m[1]), `JSON-LD not valid for ${c.type}`);
  }
});
