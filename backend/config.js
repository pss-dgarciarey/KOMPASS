const path = require('path');
const dotenv = require('dotenv');

function parseDurationMs(input, fallbackMs) {
  if (input === undefined || input === null || input === '') {
    return fallbackMs;
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  const trimmed = String(input).trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = trimmed.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    return fallbackMs;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };

  return value * multipliers[unit];
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createConfig(env = process.env) {
  const projectRoot = path.resolve(__dirname, '..');
  dotenv.config({ path: path.join(projectRoot, '.env') });
  dotenv.config({ path: path.join(__dirname, '.env'), override: false });

  return {
    appName: 'Kompass',
    appTagline: 'Global sentiment and market pulse, public and free',
    nodeEnv: env.NODE_ENV || 'development',
    port: parseInteger(env.PORT, 8080),
    logLevel: env.LOG_LEVEL || 'info',
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    gdeltApiUrl:
      env.GDELT_API_URL ||
      'https://api.gdeltproject.org/api/v2/doc/doc',
    gdeltQuery: env.GDELT_QUERY || '',
    gdeltCountrySlices: String(
      env.GDELT_COUNTRY_SLICES || ''
    )
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
    gdeltTimespan: env.GDELT_TIMESPAN || '1h',
    gdeltMaxRecords: parseInteger(env.GDELT_MAX_RECORDS, 150),
    gdeltMinRequestGapMs: parseDurationMs(env.GDELT_MIN_REQUEST_GAP, 5_500),
    gdeltKeepLastLiveMs: parseDurationMs(env.GDELT_KEEP_LAST_LIVE, 2 * 60 * 60_000),
    gdeltExportLookbackBatches: parseInteger(env.GDELT_EXPORT_LOOKBACK_BATCHES, 8),
    gdeltPriorityCountryLimit: parseInteger(env.GDELT_PRIORITY_COUNTRY_LIMIT, 32),
    gdeltCountryOutletBatchSize: parseInteger(env.GDELT_COUNTRY_OUTLET_BATCH_SIZE, 12),
    gdeltConflictOutletBatchSize: parseInteger(env.GDELT_CONFLICT_OUTLET_BATCH_SIZE, 10),
    gdeltCountryPulseBatchSize: parseInteger(env.GDELT_COUNTRY_PULSE_BATCH_SIZE, 8),
    gdeltShippingFeedBatchSize: parseInteger(env.GDELT_SHIPPING_FEED_BATCH_SIZE, 6),
    gdeltSocialFeedBatchSize: parseInteger(env.GDELT_SOCIAL_FEED_BATCH_SIZE, 4),
    enableConflictOutletFeeds: String(env.ENABLE_CONFLICT_OUTLET_FEEDS || 'true').toLowerCase() !== 'false',
    enableCountryPulseFeeds: String(env.ENABLE_COUNTRY_PULSE_FEEDS || 'true').toLowerCase() !== 'false',
    enableShippingFeeds: String(env.ENABLE_SHIPPING_FEEDS || 'true').toLowerCase() !== 'false',
    enableSocialFeeds: String(env.ENABLE_SOCIAL_FEEDS || 'true').toLowerCase() !== 'false',
    financeProvider: env.FINANCE_PROVIDER || 'yahoo',
    alternativeMeKey: env.ALTERNATIVE_ME_KEY || '',
    pollIntervalGdeltMs: parseDurationMs(env.POLL_INTERVAL_GDELT, 5 * 60_000),
    pollIntervalFinanceMs: parseDurationMs(env.POLL_INTERVAL_FINANCE, 60_000),
    financeMinRequestGapMs: parseDurationMs(env.FINANCE_MIN_REQUEST_GAP, 5_000),
    financeFetchTimeoutMs: parseDurationMs(env.FINANCE_FETCH_TIMEOUT, 12_000),
    enableYahooBatchQuotes: String(env.ENABLE_YAHOO_BATCH_QUOTES || 'false').toLowerCase() === 'true',
    alertEvaluationIntervalMs: parseDurationMs(env.ALERT_EVALUATION_INTERVAL, 60_000),
    cacheTtlMs: parseDurationMs(env.CACHE_TTL, 5 * 60_000),
    cacheMaxEntries: parseInteger(env.CACHE_MAX_ENTRIES, 1200),
    topEventLimit: parseInteger(env.TOP_EVENT_LIMIT, 5),
    databasePath: path.resolve(projectRoot, env.SQLITE_PATH || './data/kompass.sqlite'),
    frontendDistPath: path.join(projectRoot, 'frontend', 'dist'),
    dataDirectory: path.join(projectRoot, 'data'),
    metricsLookbackMs: parseDurationMs(env.METRICS_LOOKBACK, 24 * 3_600_000),
    correlationWindows: ['6h', '24h'],
    topCountriesLimit: parseInteger(env.TOP_COUNTRIES_LIMIT, 200),
    marketMoodBaselineDays: parseInteger(env.MARKET_MOOD_BASELINE_DAYS, 90),
    kgpiBaselinePoints: parseInteger(env.KGPI_BASELINE_POINTS, 2_000),
    alertWebhookSecret: env.ALERT_WEBHOOK_SECRET || ''
  };
}

module.exports = {
  createConfig,
  parseDurationMs
};
