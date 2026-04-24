const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { TTLCache } = require('../lib/cache');
const { createMetricsRegistry } = require('../lib/metrics');
const { createLogger } = require('../lib/logger');
const { initDb } = require('../lib/db');
const { GdeltService } = require('../services/gdeltService');

async function createTestContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompass-gdelt-'));
  const db = await initDb(path.join(tempDir, 'test.sqlite'), createLogger('error'));
  return {
    tempDir,
    db,
    cache: new TTLCache({
      defaultTtlMs: 1000,
      metrics: createMetricsRegistry()
    })
  };
}

test('GdeltService refresh normalizes and stores country aggregates', async (t) => {
  const context = await createTestContext();
  const state = {};
  const service = new GdeltService({
    config: {
      gdeltApiUrl: 'https://example.test/gdelt',
      pollIntervalGdeltMs: 1000,
      metricsLookbackMs: 86_400_000,
      topCountriesLimit: 10
    },
    cache: context.cache,
    db: context.db,
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          articles: [
            {
              sourcecountry: 'US',
              tone: -5,
              goldsteinscale: -3,
              title: 'Stress in US markets',
              themes: 'ECONOMY;MARKETS',
              domain: 'example.com'
            },
            {
              sourcecountry: 'DE',
              tone: 2,
              goldsteinscale: 1,
              title: 'German trade optimism',
              themes: 'TRADE;INDUSTRY',
              domain: 'example.org'
            }
          ]
        };
      }
    })
  });

  await service.refresh();
  const metrics = await service.getMetrics({ region: null, sinceMs: Date.now() - 86_400_000 });

  assert.equal(metrics.regions.length, 2);
  assert.equal(metrics.regions[0].region.length, 3);
  assert.equal(state.lastGdeltSource, 'live');
  assert.equal(metrics.regions[0].sourceCount, 1);
  assert.ok(Array.isArray(metrics.regions[0].topSources));

  await context.db.close();
  t.after(() => fs.rmSync(context.tempDir, { recursive: true, force: true }));
});

test('GdeltService conflict watch filters out local public-safety noise', async (t) => {
  const context = await createTestContext();
  const state = {};
  const service = new GdeltService({
    config: {
      gdeltApiUrl: 'https://example.test/gdelt',
      pollIntervalGdeltMs: 1000,
      metricsLookbackMs: 86_400_000,
      topCountriesLimit: 10
    },
    cache: context.cache,
    db: context.db,
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          articles: [
            {
              sourcecountry: 'US',
              tone: -6,
              goldsteinscale: -4,
              title: 'Teen arrested after stabbing, police say',
              themes: 'SECURITY',
              domain: 'localnews.example'
            },
            {
              sourcecountry: 'UA',
              tone: -8,
              goldsteinscale: -7,
              title: 'Missile strike hits frontline area in Ukraine',
              themes: 'SECURITY;WAR',
              domain: 'war.example'
            }
          ]
        };
      }
    })
  });

  await service.refresh();
  const items = service.getTopEvents({
    limit: 5,
    windowMs: 24 * 3_600_000,
    conflictOnly: true
  });

  assert.equal(items.length, 1);
  assert.match(items[0].headline, /missile strike/i);

  await context.db.close();
  t.after(() => fs.rmSync(context.tempDir, { recursive: true, force: true }));
});

test('GdeltService clusters repeated variants into one top event card', async () => {
  const service = new GdeltService({
    config: {
      gdeltApiUrl: 'https://example.test/gdelt',
      pollIntervalGdeltMs: 1000,
      metricsLookbackMs: 86_400_000,
      topCountriesLimit: 10
    },
    cache: new TTLCache({
      defaultTtlMs: 1000,
      metrics: createMetricsRegistry()
    }),
    db: {
      all: async () => [],
      run: async () => {}
    },
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state: {
      recentEvents: [
        {
          id: 'a',
          timestamp: new Date().toISOString(),
          countryIso3: 'UKR',
          avgTone: -7,
          goldstein: -6,
          themes: ['SECURITY', 'ENERGY'],
          conflictTags: ['MISSILE'],
          headline: 'Missile strike disrupts tanker traffic in Black Sea port',
          summary: 'Shipping disruption reported after missile strike near Odesa port terminal.',
          snippet: 'Missile strike disrupts tanker traffic in Black Sea port',
          source: 'Source A',
          sourceKind: 'shipping-lane',
          volatility: 6,
          relevanceScore: 6.4,
          conflictSeverity: 4.2,
          eventClass: 'kinetic-strike',
          isConflictRelevant: true,
          isViolent: true
        },
        {
          id: 'b',
          timestamp: new Date().toISOString(),
          countryIso3: 'UKR',
          avgTone: -6.8,
          goldstein: -5.7,
          themes: ['SECURITY', 'ENERGY'],
          conflictTags: ['MISSILE'],
          headline: 'Black Sea port tanker traffic hit after missile attack near Odesa',
          summary: 'Odesa shipping activity disrupted after attack near port facilities.',
          snippet: 'Black Sea port tanker traffic hit after missile attack near Odesa',
          source: 'Source B',
          sourceKind: 'country-outlet',
          volatility: 5.8,
          relevanceScore: 6.1,
          conflictSeverity: 4.1,
          eventClass: 'kinetic-strike',
          isConflictRelevant: true,
          isViolent: true
        }
      ]
    },
    fetchImpl: async () => ({ ok: true, async json() { return { articles: [] }; } })
  });

  const items = service.getTopEvents({
    limit: 5,
    windowMs: 24 * 3_600_000,
    conflictOnly: true
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceCount, 2);
  assert.equal(items[0].clusterSize, 2);
});

test('GdeltService reserves feed slots for conflict-specific outlet desks', () => {
  const service = new GdeltService({
    config: {
      gdeltApiUrl: 'https://example.test/gdelt',
      gdeltCountryOutletBatchSize: 0,
      gdeltConflictOutletBatchSize: 5,
      gdeltCountryPulseBatchSize: 0,
      gdeltShippingFeedBatchSize: 0,
      gdeltSocialFeedBatchSize: 0,
      enableConflictOutletFeeds: true,
      enableCountryPulseFeeds: false,
      enableShippingFeeds: false,
      enableSocialFeeds: false,
      pollIntervalGdeltMs: 1000,
      metricsLookbackMs: 86_400_000,
      topCountriesLimit: 10
    },
    cache: new TTLCache({
      defaultTtlMs: 1000,
      metrics: createMetricsRegistry()
    }),
    db: {
      all: async () => [],
      run: async () => {},
      exec: async () => {}
    },
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state: {},
    fetchImpl: async () => ({ ok: true, async json() { return { articles: [] }; } })
  });

  const plan = service.buildFeedPlan();

  assert.equal(plan.conflictOutletFeeds.length, 5);
  assert.equal(new Set(plan.conflictOutletFeeds.map((feed) => feed.key)).size, 5);
  assert.ok(plan.conflictOutletFeeds.some((feed) => feed.conflictKey === 'myanmar'));
  assert.ok(plan.conflictOutletFeeds.some((feed) => feed.conflictKey === 'sudan'));
  assert.ok(plan.conflictOutletFeeds.some((feed) => feed.conflictKey === 'drc'));
  assert.ok(plan.configuredConflictOutletCount >= 20);
});

test('GdeltService demotes body-only foreign references out of the country signal', () => {
  const service = new GdeltService({
    config: {
      gdeltApiUrl: 'https://example.test/gdelt',
      pollIntervalGdeltMs: 1000,
      metricsLookbackMs: 86_400_000,
      topCountriesLimit: 10
    },
    cache: new TTLCache({
      defaultTtlMs: 1000,
      metrics: createMetricsRegistry()
    }),
    db: {
      all: async () => [],
      run: async () => {},
      exec: async () => {}
    },
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state: {},
    fetchImpl: async () => ({ ok: true, async json() { return { articles: [] }; } })
  });

  const signal = service.classifyCountrySignal({
    countryIso3: 'ESP',
    configuredCountryIso3: 'ESP',
    sourceKind: 'gdelt-export',
    headline: 'Israel Points to Hamas Endorsement of Gaza Protest Ships',
    summary: 'Spain is mentioned only in background body copy while the article focuses on Gaza and Israel.',
    snippet: 'Israel Points to Hamas Endorsement of Gaza Protest Ships',
    url: 'https://example.test/spain-israel-story',
    eventClass: 'general',
    isConflictRelevant: true,
    relevanceScore: 4.2
  });

  assert.equal(signal.qualifiesForCountrySignal, false);
  assert.equal(signal.countrySignalClass, 'background');
  assert.equal(signal.countrySignalScore, 0);
});
