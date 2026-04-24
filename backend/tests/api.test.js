const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const request = require('supertest');
const { createApp } = require('../app');

test('GET /api/metrics returns aggregated payload', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompass-api-'));
  const databasePath = path.join(tempDir, 'test.sqlite');
  const { app, services, stopBackgroundJobs } = await createApp({
    env: {
      NODE_ENV: 'test',
      SQLITE_PATH: databasePath,
      POLL_INTERVAL_GDELT: '5m',
      POLL_INTERVAL_FINANCE: '1m',
      CACHE_TTL: '1m'
    }
  });

  services.gdeltService.fetchRawEvents = async () => services.gdeltService.getMockEvents();
  services.financeService.pullLiveSnapshot = async () => services.financeService.getMockSnapshot();
  await services.gdeltService.refresh();
  await services.financeService.refresh();

  const response = await request(app).get('/api/metrics');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.regions));
  assert.ok(Array.isArray(response.body.globalSeries));

  await stopBackgroundJobs();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
});

test('GET /api/conflicts returns curated conflict registry payload', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompass-conflicts-'));
  const databasePath = path.join(tempDir, 'test.sqlite');
  const { app, services, stopBackgroundJobs } = await createApp({
    env: {
      NODE_ENV: 'test',
      SQLITE_PATH: databasePath
    }
  });

  services.conflictService.listConflicts = async () => ({
    featured: 'iran-israel-us',
    conflicts: [
      {
        slug: 'iran-israel-us',
        title: 'Iran / Israel / U.S.',
        summary: 'Regional strike cycle.',
        countries: ['IRN', 'ISR', 'USA'],
        overview: {
          incidentCount: 3,
          sourceCount: 2,
          pressure: 4.2
        }
      }
    ]
  });

  const response = await request(app).get('/api/conflicts');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.featured, 'iran-israel-us');
  assert.equal(response.body.conflicts[0].title, 'Iran / Israel / U.S.');

  await stopBackgroundJobs();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
});

test('GET /api/regions/:region returns enriched country inspection payload', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompass-region-'));
  const databasePath = path.join(tempDir, 'test.sqlite');
  const { app, services, stopBackgroundJobs } = await createApp({
    env: {
      NODE_ENV: 'test',
      SQLITE_PATH: databasePath
    }
  });

  services.gdeltService.getMetrics = async () => ({
    regionSnapshot: {
      region: 'ESP',
      avgTone: -1.4,
      goldstein: -0.8,
      eventCount: 5,
      topThemes: ['POLITICS'],
      topConflictTags: ['SECURITY'],
      sourceCount: 4,
      rawSourceCount: 8,
      configuredOutletCount: 5,
      topSources: [],
      sourceBreakdown: [],
      sourceLens: {
        liveWindow: { eventCount: 3, uniqueSources: 2, configuredOutlets: 5, breakdown: [], feedMix: [] },
        memory24h: { eventCount: 6, uniqueSources: 4, configuredOutlets: 5, breakdown: [], feedMix: [] }
      },
      feedMix: [],
      conflictScore: 4.2,
      rawEventCount: 9,
      signalShare: 0.56,
      dataSource: 'live'
    },
    regionSeries: [
      {
        timestamp: new Date(Date.now() - 3_600_000).toISOString(),
        region: 'ESP',
        avgTone: -0.8,
        goldstein: -0.4,
        eventCount: 4,
        topThemes: ['POLITICS'],
        volatility: 1.2
      },
      {
        timestamp: new Date().toISOString(),
        region: 'ESP',
        avgTone: -1.4,
        goldstein: -0.8,
        eventCount: 5,
        topThemes: ['POLITICS'],
        volatility: 1.6
      }
    ]
  });
  services.gdeltService.getRegionInspection = async () => ({
    region: 'ESP',
    rawEventCount: 9,
    qualifiedEventCount: 5,
    backgroundEventCount: 4,
    signalShare: 0.56,
    qualifiedEvents: [
      {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        source: 'elpais.com',
        sourceKind: 'country-outlet',
        headline: 'Spain domestic reporting signal',
        displayHeadline: 'Spain domestic reporting signal',
        inspectionSummary: 'Spain signal qualified through domestic outlets.',
        conflictTags: ['SECURITY'],
        avgTone: -1.4,
        goldstein: -0.8
      }
    ],
    backgroundEvents: [],
    sourceLens: {
      qualified: { eventCount: 5, uniqueSources: 4, configuredOutlets: 5, breakdown: [], feedMix: [] },
      background: { eventCount: 4, uniqueSources: 3, configuredOutlets: 5, breakdown: [], feedMix: [] },
      raw: { eventCount: 9, uniqueSources: 7, configuredOutlets: 5, breakdown: [], feedMix: [] }
    },
    focusedFeeds: {
      configured: [
        {
          key: 'esp-elpais',
          outletLabel: 'El Pais',
          sourceKind: 'country-outlet',
          url: 'https://elpais.com/'
        }
      ],
      responding: [
        {
          key: 'esp-elpais',
          outletLabel: 'El Pais',
          sourceKind: 'country-outlet',
          url: 'https://elpais.com/'
        }
      ],
      failures: []
    }
  });
  services.countryContextService.getCountryContext = async () => ({
    country: {
      iso3: 'ESP',
      alpha2: 'ES',
      name: 'Spain'
    },
    unemployment: {
      value: 11.2,
      year: '2025'
    },
    inflation: {
      value: 2.8,
      year: '2025'
    },
    benchmark: {
      label: 'IBEX 35',
      latest: 12450,
      changePercent: -1.8,
      currency: 'EUR',
      historySource: 'yahoo',
      points: [
        {
          timestamp: new Date().toISOString(),
          value: 12450
        }
      ]
    },
    macroComposite: {
      score: 37.4,
      label: 'steady',
      components: {}
    },
    narrative: 'Spain macro overlay is steady.'
  });

  const response = await request(app).get('/api/regions/ESP');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.region, 'ESP');
  assert.equal(response.body.context.country.name, 'Spain');
  assert.equal(response.body.inspection.qualifiedEventCount, 5);
  assert.equal(response.body.series.benchmark.label, 'IBEX 35');
  assert.equal(typeof response.body.narratives.combined, 'string');

  await stopBackgroundJobs();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
});
