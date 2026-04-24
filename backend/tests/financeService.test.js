const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { TTLCache } = require('../lib/cache');
const { createMetricsRegistry } = require('../lib/metrics');
const { createLogger } = require('../lib/logger');
const { initDb } = require('../lib/db');
const { FinanceService } = require('../services/financeService');

async function createTestContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompass-finance-'));
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

test('FinanceService persists mocked snapshot and market mood', async (t) => {
  const context = await createTestContext();
  const state = {};
  const service = new FinanceService({
    config: {
      pollIntervalFinanceMs: 60_000
    },
    cache: context.cache,
    db: context.db,
    logger: createLogger('error'),
    metrics: createMetricsRegistry(),
    state,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { data: [{ value: '50', value_classification: 'Neutral', timestamp: '1710000000' }] };
      }
    })
  });

  service.pullLiveSnapshot = async () => service.getMockSnapshot();
  const payload = await service.refresh();

  assert.ok(payload.marketMood);
  assert.equal(typeof payload.marketMood.score, 'number');
  assert.ok(state.lastFinanceFetchAt);

  const history = await service.getAssetHistory({
    asset: 'kgpi',
    rangeMs: 24 * 3_600_000,
    intervalMs: 30 * 60_000
  });
  assert.equal(history.asset, 'kgpi');
  assert.ok(Array.isArray(history.points));
  assert.ok(Array.isArray(history.candles));

  await context.db.close();
  t.after(() => fs.rmSync(context.tempDir, { recursive: true, force: true }));
});

test('FinanceService fetches MOEX benchmark history through ISS', async (t) => {
  const context = await createTestContext();
  const state = {};
  const service = new FinanceService({
    config: {
      pollIntervalFinanceMs: 60_000
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
          candles: {
            columns: ['open', 'close', 'high', 'low', 'value', 'volume', 'begin', 'end'],
            data: [
              [2800, 2810, 2820, 2790, 1000, 0, '2026-04-01 00:00:00', '2026-04-01 23:59:59'],
              [2810, 2795, 2830, 2788, 1100, 0, '2026-04-02 00:00:00', '2026-04-02 23:59:59'],
              [2795, 2825, 2840, 2792, 1200, 0, '2026-04-03 00:00:00', '2026-04-03 23:59:59']
            ]
          }
        };
      }
    })
  });

  const history = await service.fetchBenchmarkHistory({
    provider: 'moex-iss',
    symbol: 'IMOEX',
    label: 'MOEX Russia Index',
    rangeMs: 30 * 24 * 3_600_000,
    currency: 'RUB'
  });

  assert.equal(history.historySource, 'moex-iss');
  assert.equal(history.symbol, 'IMOEX');
  assert.equal(history.points.length, 3);
  assert.equal(history.candles.length, 3);
  assert.equal(history.latest, 2825);

  await context.db.close();
  t.after(() => fs.rmSync(context.tempDir, { recursive: true, force: true }));
});
