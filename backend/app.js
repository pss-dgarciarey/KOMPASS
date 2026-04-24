const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createConfig } = require('./config');
const { createLogger } = require('./lib/logger');
const { createMetricsRegistry } = require('./lib/metrics');
const { TTLCache } = require('./lib/cache');
const { initDb, seedAlertRules } = require('./lib/db');
const { createApiRouter } = require('./routes/api');
const { GdeltService } = require('./services/gdeltService');
const { FinanceService } = require('./services/financeService');
const { createExplainService } = require('./services/explainService');
const { CorrelationService } = require('./services/correlationService');
const { AlertService } = require('./services/alertService');
const { ConflictService } = require('./services/conflictService');
const { CountryContextService } = require('./services/countryContextService');

async function createApp(options = {}) {
  const config = options.config || createConfig(options.env);
  const logger = options.logger || createLogger(config.logLevel);
  const metrics = options.metrics || createMetricsRegistry();
  const cache = options.cache || new TTLCache({
    defaultTtlMs: config.cacheTtlMs,
    metrics,
    maxEntries: config.cacheMaxEntries
  });
  const db = options.db || (await initDb(config.databasePath, logger));
  const state = {
    startedAt: new Date().toISOString(),
    lastGdeltFetchAt: null,
    lastFinanceFetchAt: null,
    recentEvents: [],
    eventArchive: [],
    lastGdeltSource: 'boot',
    lastFinanceSource: 'boot',
    lastLiveGdeltFetchAt: null,
    lastLiveFinanceFetchAt: null,
    lastGdeltRequestStats: null,
    latestCountryMetadata: {},
    latestGlobalMetadata: null,
    marketSnapshot: null
  };

  const explainService = createExplainService({ logger, metrics });
  const gdeltService = new GdeltService({
    config,
    cache,
    db,
    logger,
    metrics,
    state,
    fetchImpl: options.fetchImpl || fetch
  });
  const financeService = new FinanceService({
    config,
    cache,
    db,
    logger,
    metrics,
    state,
    fetchImpl: options.fetchImpl || fetch
  });
  const correlationService = new CorrelationService({
    config,
    db,
    logger
  });
  const alertService = new AlertService({
    config,
    db,
    logger,
    metrics,
    state,
    services: {
      gdeltService
    },
    fetchImpl: options.fetchImpl || fetch
  });
  const conflictService = new ConflictService({
    cache,
    logger,
    state,
    services: {
      gdeltService
    },
    fetchImpl: options.fetchImpl || fetch
  });
  const countryContextService = new CountryContextService({
    cache,
    logger,
    fetchImpl: options.fetchImpl || fetch,
    financeService
  });

  await seedAlertRules(db, alertService.defaultRules);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(config.corsOrigin === '*' ? {} : { origin: config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    metrics.inc('api_calls_total');
    req.requestStart = Date.now();
    next();
  });

  const services = {
    gdeltService,
    financeService,
    explainService,
    correlationService,
    alertService,
    conflictService,
    countryContextService
  };

  app.get('/metrics', (req, res) => {
    res.type('text/plain').send(metrics.renderPrometheus());
  });

  app.get('/healthz', (req, res) => {
    res.json({
      ok: true,
      ready: Boolean(state.lastGdeltFetchAt && state.lastFinanceFetchAt),
      startedAt: state.startedAt
    });
  });

  app.use('/api', createApiRouter({ config, services, db, logger, metrics, state }));

  if (config.nodeEnv === 'production') {
    app.use(express.static(config.frontendDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/metrics' || req.path === '/healthz') {
        next();
        return;
      }
      res.sendFile(path.join(config.frontendDistPath, 'index.html'));
    });
  }

  app.use((error, req, res, next) => {
    metrics.inc('errors_total');
    logger.error('api', 'Unhandled request error', {
      path: req.path,
      message: error.message
    });
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  });

  async function startBackgroundJobs() {
    gdeltService.start();
    financeService.start();
    alertService.start();
    Promise.allSettled([gdeltService.refresh(), financeService.refresh()])
      .then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            return;
          }

          logger.warn('startup', 'Initial background refresh failed', {
            service: index === 0 ? 'gdelt' : 'finance',
            error: result.reason?.message || String(result.reason)
          });
        });
      });
  }

  async function stopBackgroundJobs() {
    gdeltService.stop();
    financeService.stop();
    alertService.stop();
    await db.close();
  }

  return {
    app,
    cache,
    config,
    db,
    logger,
    metrics,
    services,
    startBackgroundJobs,
    state,
    stopBackgroundJobs
  };
}

module.exports = {
  createApp
};
