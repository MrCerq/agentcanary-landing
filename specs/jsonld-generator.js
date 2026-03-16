/**
 * AgentCanary — JSON-LD Generator
 * 
 * Generates structured JSON-LD for daily Record pages from Mongo brief data.
 * Import and call generateDailyJsonLd(briefs, assets) in your page builder.
 * 
 * Usage:
 *   const { generateDailyJsonLd, generateHomepageJsonLd } = require('./jsonld-generator');
 *   const jsonLd = generateDailyJsonLd(briefsForDay, assetSnapshot);
 *   // Insert into <script type="application/ld+json"> in page <head>
 */

function generateDailyJsonLd(briefs, assets, scorecard = null) {
  if (!briefs || briefs.length === 0) return null;

  const date = briefs[0].date; // ISO date string: "2026-03-14"
  const dateObj = new Date(date + 'T12:00:00Z');
  const dateFormatted = dateObj.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  });
  const yyyy = date.slice(0, 4);
  const mm = date.slice(5, 7);
  const dd = date.slice(8, 10);
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

  // Get regime from latest brief of the day
  const latestBrief = briefs[briefs.length - 1];
  const regime = latestBrief.regime || {};

  // Get top signal and narrative across all briefs
  const allSignals = briefs.flatMap(b => b.signals || []);
  const allNarratives = briefs.flatMap(b => b.narratives || []);
  const topNarrative = allNarratives.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const topSignal = allSignals[0];

  // Build keywords from regime, signals, narratives
  const keywords = [
    regime.state,
    ...allSignals.slice(0, 3).map(s => `${s.asset} ${s.direction}`),
    ...allNarratives.slice(0, 3).map(n => n.name.replace(/-/g, ' ')),
  ].filter(Boolean);

  // Build asset move descriptions for SEO
  const assetMoves = Object.entries(assets || {})
    .filter(([_, v]) => v.change_pct)
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v.change_pct}`)
    .join(', ');

  const seoDescription = `Regime: ${regime.state || 'unknown'} (${regime.score || '?'}). ${assetMoves}. ${briefs.length} briefs with ${scorecard ? 'scored' : 'pending'} calls.`;

  const properties = [
    { name: 'regime_state', value: regime.state || null, description: 'Current macro regime classification' },
    { name: 'regime_score', value: String(regime.score || ''), unitText: 'gauge (0-100)' },
    { name: 'regime_previous', value: regime.previous || null },
    { name: 'regime_shift_date', value: regime.shift_date || null },
    { name: 'briefs_count', value: String(briefs.length) },
  ];

  // Add asset properties
  if (assets) {
    for (const [symbol, data] of Object.entries(assets)) {
      properties.push({ name: `${symbol.toLowerCase()}_price`, value: String(data.price), unitText: 'USD' });
      if (data.change_pct) {
        properties.push({ name: `${symbol.toLowerCase()}_change_pct`, value: data.change_pct });
      }
    }
  }

  // Add top signal/narrative
  if (topSignal) {
    properties.push({ name: 'top_signal', value: `${topSignal.type}_${topSignal.asset}`.toLowerCase() });
  }
  if (topNarrative) {
    properties.push({ name: 'top_narrative', value: topNarrative.name });
    properties.push({ name: 'top_narrative_score', value: String(topNarrative.score), unitText: '0.0-1.0' });
  }

  // Add scorecard if available
  if (scorecard) {
    properties.push({ name: 'scorecard_accuracy', value: String(scorecard.accuracy), unitText: '0.0-1.0' });
    properties.push({ name: 'scorecard_calls_correct', value: String(scorecard.calls_correct) });
    properties.push({ name: 'scorecard_calls_total', value: String(scorecard.calls_total) });
    properties.push({ name: 'scorecard_scored_at', value: scorecard.scored_at });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${dateFormatted} — Market Intelligence | The Record`,
    datePublished: date,
    dateModified: scorecard ? scorecard.scored_at : `${date}T23:59:59Z`,
    author: { '@id': 'https://agentcanary.ai/#org' },
    publisher: { '@id': 'https://agentcanary.ai/#org' },
    url: `https://agentcanary.ai/record/${yyyy}/${mm}/${dd}`,
    mainEntityOfPage: `https://agentcanary.ai/record/${yyyy}/${mm}/${dd}`,
    image: `https://agentcanary.ai/record/${yyyy}/${mm}/${dd}/og-card.png`,
    description: seoDescription,
    keywords,
    articleSection: 'Market Intelligence',
    inLanguage: 'en',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'The Record', item: 'https://agentcanary.ai/record/archive' },
        { '@type': 'ListItem', position: 2, name: yyyy, item: `https://agentcanary.ai/record/${yyyy}/` },
        { '@type': 'ListItem', position: 3, name: monthName, item: `https://agentcanary.ai/record/${yyyy}/${mm}/` },
        { '@type': 'ListItem', position: 4, name: dateFormatted, item: `https://agentcanary.ai/record/${yyyy}/${mm}/${dd}` },
      ],
    },
    about: {
      '@type': 'StructuredValue',
      name: 'MarketIntelligence',
      description: `Structured market data snapshot for ${dateFormatted}`,
      additionalProperty: properties
        .filter(p => p.value !== null && p.value !== '' && p.value !== 'undefined')
        .map(p => {
          const prop = { '@type': 'PropertyValue', name: p.name, value: p.value };
          if (p.unitText) prop.unitText = p.unitText;
          if (p.description) prop.description = p.description;
          return prop;
        }),
    },
  };
}

function generateHomepageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://agentcanary.ai/#org',
        name: 'AgentCanary',
        url: 'https://agentcanary.ai',
        logo: 'https://agentcanary.ai/logo.png',
        description: 'Macro market intelligence with receipts. 4 daily briefs, regime tracking, and scored calls.',
        sameAs: ['https://t.me/agentcanary', 'https://x.com/agentcanary'],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://agentcanary.ai/#website',
        name: 'AgentCanary — The Record',
        alternateName: 'The Record',
        url: 'https://agentcanary.ai',
        description: 'Market intelligence with receipts. Every call. Every day. Scored.',
        publisher: { '@id': 'https://agentcanary.ai/#org' },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: 'https://agentcanary.ai/record/search?q={query}' },
          'query-input': 'required name=query',
        },
        inLanguage: 'en',
      },
      {
        '@type': 'DataCatalog',
        '@id': 'https://agentcanary.ai/#datacatalog',
        name: 'The Record — Market Intelligence Archive',
        description: 'Daily scored market intelligence. Regime states, whale alerts, narrative scores, macro signals.',
        url: 'https://agentcanary.ai/record/archive',
        provider: { '@id': 'https://agentcanary.ai/#org' },
        temporalCoverage: '2026-02-23/..',
        dataset: [
          { '@type': 'Dataset', name: 'Daily Briefs', description: '4 macro briefs per day with signals and calls' },
          { '@type': 'Dataset', name: 'Regime History', description: 'Continuous regime state and gauge score' },
          { '@type': 'Dataset', name: 'Scorecard', description: 'Hindsight accuracy scoring of all calls' },
          { '@type': 'Dataset', name: 'Whale Alerts', description: 'On-chain large transaction signals' },
          { '@type': 'Dataset', name: 'Narrative Scores', description: 'Market narrative lifecycle tracking' },
        ],
      },
      {
        '@type': 'WebAPI',
        '@id': 'https://agentcanary.ai/#api',
        name: 'AgentCanary API',
        description: 'Programmatic access to The Record.',
        url: 'https://agentcanary.ai/api/docs',
        documentation: 'https://agentcanary.ai/api/openapi.json',
        provider: { '@id': 'https://agentcanary.ai/#org' },
      },
    ],
  };
}

module.exports = { generateDailyJsonLd, generateHomepageJsonLd };
