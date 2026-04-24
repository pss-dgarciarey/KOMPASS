const { retry } = require('../lib/retry');
const { calculateKgpi } = require('./marketMood');
const {
  buildResourceProfile,
  parseGasStorageData,
  parseOilInventoryData
} = require('./resourcePressure');

const SYMBOLS = {
  vix: '^VIX',
  vxn: '^VXN',
  ovx: '^OVX',
  move: '^MOVE',
  sp500: '^GSPC',
  btc: 'BTC-USD',
  gold: 'GC=F',
  oil: 'CL=F',
  naturalGas: 'NG=F',
  silver: 'SI=F',
  wheat: 'ZW=F'
};
const INSTRUMENT_LABELS = {
  vix: 'VIX',
  vxn: 'VXN',
  ovx: 'OVX',
  move: 'MOVE',
  sp500: 'S&P 500',
  btc: 'BTC',
  gold: 'Gold',
  oil: 'Oil',
  naturalGas: 'Natural Gas',
  silver: 'Silver',
  wheat: 'Wheat'
};
const ASSET_ALIASES = {
  mood: 'kgpi',
  marketMood: 'kgpi'
};

function normalizeAssetKey(asset) {
  const normalized = String(asset || 'kgpi').trim();
  return ASSET_ALIASES[normalized] || normalized;
}

function defaultIntervalMs(rangeMs) {
  if (rangeMs <= 24 * 3_600_000) {
    return 5 * 60_000;
  }
  if (rangeMs <= 7 * 24 * 3_600_000) {
    return 30 * 60_000;
  }
  if (rangeMs <= 30 * 24 * 3_600_000) {
    return 2 * 3_600_000;
  }
  return 24 * 3_600_000;
}

function parseChartIntervalMs(value) {
  const match = String(value || '').match(/^(\d+)(m|h|d)$/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMs = {
    m: 60_000,
    h: 3_600_000,
    d: 24 * 3_600_000
  };

  return Number.isFinite(amount) && unitMs[unit]
    ? amount * unitMs[unit]
    : null;
}

function resolveYahooHistoryProfile(rangeMs) {
  // Just enough granularity to make the charts readable without hauling way too many bars around.
  if (rangeMs <= 24 * 3_600_000) {
    return { range: '1d', interval: '5m' };
  }
  if (rangeMs <= 7 * 24 * 3_600_000) {
    return { range: '7d', interval: '30m' };
  }
  if (rangeMs <= 30 * 24 * 3_600_000) {
    return { range: '1mo', interval: '60m' };
  }
  if (rangeMs <= 90 * 24 * 3_600_000) {
    return { range: '3mo', interval: '1d' };
  }
  return { range: '6mo', interval: '1d' };
}

function formatDateParam(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYahooChartSeries(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjustedClose = result?.indicators?.adjclose?.[0]?.adjclose || [];

  const points = [];
  const candles = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const tsSeconds = Number(timestamps[index]);
    if (!Number.isFinite(tsSeconds)) {
      continue;
    }

    const closeCandidate = Number.isFinite(Number(adjustedClose[index]))
      ? Number(adjustedClose[index])
      : Number(quote.close?.[index]);
    const openCandidate = Number(quote.open?.[index]);
    const highCandidate = Number(quote.high?.[index]);
    const lowCandidate = Number(quote.low?.[index]);

    if (!Number.isFinite(closeCandidate)) {
      continue;
    }

    const timestamp = new Date(tsSeconds * 1000).toISOString();
    const open = Number.isFinite(openCandidate) ? openCandidate : closeCandidate;
    const high = Number.isFinite(highCandidate) ? highCandidate : Math.max(open, closeCandidate);
    const low = Number.isFinite(lowCandidate) ? lowCandidate : Math.min(open, closeCandidate);

    points.push({
      timestamp,
      value: closeCandidate
    });
    candles.push({
      timestamp,
      open,
      high,
      low,
      close: closeCandidate,
      samples: 1
    });
  }

  return {
    meta: result?.meta || {},
    points,
    candles
  };
}

function pickAssetValue(payload, asset) {
  const normalizedAsset = normalizeAssetKey(asset);
  if (normalizedAsset === 'kgpi') {
    return Number(payload?.kgpi?.score ?? payload?.marketMood?.score ?? Number.NaN);
  }
  return Number(payload?.[normalizedAsset]?.value ?? Number.NaN);
}

function pickAssetCurrency(payload, asset) {
  const normalizedAsset = normalizeAssetKey(asset);
  if (normalizedAsset === 'kgpi') {
    return 'INDEX';
  }
  return payload?.[normalizedAsset]?.currency || 'USD';
}

function buildCandles(points, intervalMs) {
  if (!points.length || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    return [];
  }

  const buckets = new Map();
  for (const point of points) {
    const timestamp = Date.parse(point.timestamp);
    if (!Number.isFinite(timestamp)) {
      continue;
    }
    const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
    const bucket = buckets.get(bucketKey) || [];
    bucket.push(point);
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([bucketKey, bucket]) => {
      const values = bucket.map((point) => point.value);
      return {
        timestamp: new Date(bucketKey).toISOString(),
        open: bucket[0].value,
        high: Math.max(...values),
        low: Math.min(...values),
        close: bucket[bucket.length - 1].value,
        samples: bucket.length
      };
    });
}

function sampleSeries(points, maxPoints = 160) {
  if (points.length <= maxPoints) {
    return points;
  }

  const stride = Math.ceil(points.length / maxPoints);
  const sampled = [];
  for (let index = 0; index < points.length; index += stride) {
    sampled.push(points[index]);
  }

  const lastPoint = points.at(-1);
  if (lastPoint && sampled.at(-1)?.timestamp !== lastPoint.timestamp) {
    sampled.push(lastPoint);
  }

  return sampled;
}

function parseMoexChartSeries(payload) {
  const columns = Array.isArray(payload?.candles?.columns) ? payload.candles.columns : [];
  const rows = Array.isArray(payload?.candles?.data) ? payload.candles.data : [];
  if (!columns.length || !rows.length) {
    return {
      points: [],
      candles: []
    };
  }

  const columnIndex = Object.fromEntries(columns.map((column, index) => [column, index]));
  const points = [];
  const candles = [];

  for (const row of rows) {
    const open = Number(row[columnIndex.open]);
    const close = Number(row[columnIndex.close]);
    const high = Number(row[columnIndex.high]);
    const low = Number(row[columnIndex.low]);
    const begin = row[columnIndex.begin];
    const timestamp = begin ? new Date(String(begin).replace(' ', 'T')).toISOString() : null;

    if (!timestamp || !Number.isFinite(close)) {
      continue;
    }

    points.push({
      timestamp,
      value: close
    });
    candles.push({
      timestamp,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close,
      samples: 1
    });
  }

  return {
    points,
    candles
  };
}

class FinanceService {
  constructor({ config, cache, db, logger, metrics, state, fetchImpl }) {
    this.config = config;
    this.cache = cache;
    this.db = db;
    this.logger = logger;
    this.metrics = metrics;
    this.state = state;
    this.fetchImpl = fetchImpl;
    this.intervalHandle = null;
    this.lastProviderCallAt = 0;
    this.refreshPromise = null;
    this.batchQuoteInfoLogged = false;
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = this.config.financeFetchTimeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutHandle = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      return await this.fetchImpl(url, {
        ...options,
        signal: controller?.signal
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  holdPreviousSnapshot(reason, candidateSource = 'stale') {
    if (!this.state.marketSnapshot) {
      return null;
    }

    // Do not trash a good market snapshot because one upstream feed had a rough minute.
    const staleSnapshot = {
      ...this.state.marketSnapshot,
      source: 'stale',
      staleReason: candidateSource,
      staleMessage: reason ? String(reason) : null
    };

    this.state.marketSnapshot = staleSnapshot;
    this.state.lastFinanceSource = 'stale';
    return staleSnapshot;
  }

  getHistoryCacheTtlMs() {
    // The dashboard pings this constantly. Short cache is enough, but no point rebuilding on every hit.
    return Math.min(Math.max(Math.floor(this.config.pollIntervalFinanceMs / 2), 10_000), 30_000);
  }

  getMarketSnapshotCacheTtlMs() {
    return Math.min(Math.max(Math.floor(this.getHistoryCacheTtlMs() / 2), 4_000), 12_000);
  }

  buildInstrument(label, quote) {
    return {
      label,
      value: Number(quote.regularMarketPrice),
      changePercent: Number.isFinite(Number(quote.regularMarketChangePercent))
        ? Number(quote.regularMarketChangePercent)
        : 0,
      currency: quote.currency || 'USD',
      timestamp: quote.regularMarketTime
        ? new Date(quote.regularMarketTime * 1000).toISOString()
        : new Date().toISOString()
    };
  }

  async fetchChartQuote(symbol) {
    return retry(
      async () => {
        const response = await this.fetchWithTimeout(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=false`
        );

        if (!response.ok) {
          throw new Error(`Yahoo Finance chart request failed with ${response.status}`);
        }

        const payload = await response.json();
        const result = payload?.chart?.result?.[0];
        const meta = result?.meta;
        if (!result || !meta) {
          throw new Error('Yahoo Finance returned no chart result');
        }

        const currentPrice = meta.regularMarketPrice ?? meta.previousClose ?? meta.chartPreviousClose;
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
        const changePercent = previousClose
          ? ((currentPrice - previousClose) / previousClose) * 100
          : 0;

        return {
          regularMarketPrice: Number(currentPrice),
          regularMarketChangePercent: Number.isFinite(changePercent) ? changePercent : 0,
          currency: meta.currency || 'USD',
          regularMarketTime: meta.regularMarketTime || Math.floor(Date.now() / 1000)
        };
      },
      {
        attempts: 2,
        baseDelayMs: 250
      }
    );
  }

  async fetchRemoteAssetHistory(asset, rangeMs) {
    const symbol = SYMBOLS[asset];
    if (!symbol) {
      return null;
    }

    const profile = resolveYahooHistoryProfile(rangeMs);
    return retry(
      async () => {
        const response = await this.fetchWithTimeout(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(profile.range)}&interval=${encodeURIComponent(profile.interval)}&includePrePost=false&events=div%2Csplits`
        );

        if (!response.ok) {
          throw new Error(`Yahoo Finance history request failed with ${response.status}`);
        }

        const payload = await response.json();
        const { meta, points, candles } = parseYahooChartSeries(payload);
        if (points.length < 3) {
          throw new Error('Yahoo Finance history returned too few points');
        }

        const latest = points.at(-1)?.value ?? null;
        const baseline = points[0]?.value ?? latest;
        const changePercent = Number.isFinite(latest) && Number.isFinite(baseline) && baseline
          ? Number((((latest - baseline) / baseline) * 100).toFixed(3))
          : 0;

        return {
          asset,
          label: INSTRUMENT_LABELS[asset] || asset,
          currency: meta.currency || 'USD',
          rangeMs,
          intervalMs: parseChartIntervalMs(profile.interval) || defaultIntervalMs(rangeMs),
          latest,
          changePercent,
          historySource: 'yahoo',
          points: sampleSeries(points, 240),
          candles: sampleSeries(candles, 120)
        };
      },
      {
        attempts: 2,
        baseDelayMs: 250
      }
    );
  }

  async fetchCustomSymbolHistory({ symbol, label, rangeMs = 30 * 24 * 3_600_000, currency }) {
    return this.fetchBenchmarkHistory({
      symbol,
      label,
      rangeMs,
      currency
    });
  }

  async fetchYahooCustomHistory({
    symbol,
    label,
    rangeMs = 30 * 24 * 3_600_000,
    currency,
    fallbackSymbols = []
  }) {
    const symbolCandidates = [symbol, ...fallbackSymbols].filter(Boolean);
    if (!symbolCandidates.length) {
      return null;
    }

    const profile = resolveYahooHistoryProfile(rangeMs);
    let lastError = null;

    for (const symbolCandidate of symbolCandidates) {
      try {
        return await retry(
          async () => {
            const response = await this.fetchWithTimeout(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbolCandidate)}?range=${encodeURIComponent(profile.range)}&interval=${encodeURIComponent(profile.interval)}&includePrePost=false&events=div%2Csplits`
            );

            if (!response.ok) {
              throw new Error(`Yahoo Finance custom history request failed with ${response.status}`);
            }

            const payload = await response.json();
            const { meta, points, candles } = parseYahooChartSeries(payload);
            if (points.length < 3) {
              throw new Error('Yahoo Finance custom history returned too few points');
            }

            const latest = points.at(-1)?.value ?? null;
            const baseline = points[0]?.value ?? latest;
            const changePercent = Number.isFinite(latest) && Number.isFinite(baseline) && baseline
              ? Number((((latest - baseline) / baseline) * 100).toFixed(3))
              : 0;

            return {
              asset: symbolCandidate,
              symbol: symbolCandidate,
              requestedSymbol: symbol,
              label: label || symbolCandidate,
              currency: currency || meta.currency || 'USD',
              rangeMs,
              intervalMs: parseChartIntervalMs(profile.interval) || defaultIntervalMs(rangeMs),
              latest,
              changePercent,
              historySource: 'yahoo',
              points: sampleSeries(points, 240),
              candles: sampleSeries(candles, 120)
            };
          },
          {
            attempts: 2,
            baseDelayMs: 250
          }
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Yahoo benchmark history request failed');
  }

  async fetchMoexIndexHistory({
    symbol,
    label,
    rangeMs = 30 * 24 * 3_600_000,
    currency = 'RUB'
  }) {
    if (!symbol) {
      return null;
    }

    const till = new Date();
    const from = new Date(Date.now() - rangeMs);
    return retry(
      async () => {
        const response = await this.fetchWithTimeout(
          `https://iss.moex.com/iss/engines/stock/markets/index/securities/${encodeURIComponent(symbol)}/candles.json?from=${encodeURIComponent(formatDateParam(from))}&till=${encodeURIComponent(formatDateParam(till))}&interval=24`
        );

        if (!response.ok) {
          throw new Error(`MOEX ISS history request failed with ${response.status}`);
        }

        const payload = await response.json();
        const { points, candles } = parseMoexChartSeries(payload);
        if (points.length < 3) {
          throw new Error('MOEX ISS history returned too few points');
        }

        const latest = points.at(-1)?.value ?? null;
        const baseline = points[0]?.value ?? latest;
        const changePercent = Number.isFinite(latest) && Number.isFinite(baseline) && baseline
          ? Number((((latest - baseline) / baseline) * 100).toFixed(3))
          : 0;

        return {
          asset: symbol,
          symbol,
          label: label || symbol,
          currency,
          rangeMs,
          intervalMs: 24 * 3_600_000,
          latest,
          changePercent,
          historySource: 'moex-iss',
          points: sampleSeries(points, 240),
          candles: sampleSeries(candles, 120)
        };
      },
      {
        attempts: 2,
        baseDelayMs: 250
      }
    );
  }

  async fetchBenchmarkHistory({
    provider = 'yahoo',
    symbol,
    label,
    rangeMs = 30 * 24 * 3_600_000,
    currency,
    fallbackSymbols = []
  }) {
    if (!symbol) {
      return null;
    }

    return this.cache.wrap(
      `finance:benchmark:${provider}:${symbol}:${rangeMs}:${currency || 'USD'}:${fallbackSymbols.join(',')}`,
      async () => {
        if (provider === 'moex-iss') {
          return this.fetchMoexIndexHistory({
            symbol,
            label,
            rangeMs,
            currency
          });
        }

        return this.fetchYahooCustomHistory({
          symbol,
          label,
          rangeMs,
          currency,
          fallbackSymbols
        });
      },
      10 * 60_000
    );
  }

  getMockSnapshot() {
    const snapshot = {
      source: 'mock',
      timestamp: new Date().toISOString(),
      vix: { label: 'VIX', value: 22.4, changePercent: 1.2, currency: 'USD' },
      vxn: { label: 'VXN', value: 28.7, changePercent: 1.9, currency: 'USD' },
      ovx: { label: 'OVX', value: 36.2, changePercent: -0.6, currency: 'USD' },
      move: { label: 'MOVE', value: 112.5, changePercent: 0.4, currency: 'USD' },
      sp500: { label: 'S&P 500', value: 5210.5, changePercent: -0.8, currency: 'USD' },
      btc: { label: 'BTC', value: 67890, changePercent: 2.1, currency: 'USD' },
      gold: { label: 'Gold', value: 2318.2, changePercent: 0.5, currency: 'USD' },
      oil: { label: 'Oil', value: 79.4, changePercent: -1.1, currency: 'USD' },
      naturalGas: { label: 'Natural Gas', value: 2.74, changePercent: 2.8, currency: 'USD' },
      silver: { label: 'Silver', value: 28.2, changePercent: 0.9, currency: 'USD' },
      wheat: { label: 'Wheat', value: 563.5, changePercent: 1.7, currency: 'USD' },
      fearGreedCrypto: {
        value: 22,
        classification: 'Fear',
        timestamp: new Date().toISOString()
      }
    };
    const resourceProfile = buildResourceProfile({
      snapshot,
      oilInventory: {
        source: 'mock',
        updatedAt: snapshot.timestamp,
        currentStocksMb: 432.5,
        previousStocksMb: 435.1,
        yearAgoStocksMb: 452.8,
        twoYearsAgoStocksMb: 448.3,
        sprStocksMb: 368.4,
        totalStocksExSprMb: 1208.3,
        stockDeltaVsYearAgoPct: -4.5,
        stockDeltaVsTwoYearsAgoPct: -3.5,
        daysCover: 26.8,
        yearAgoDaysCover: 28.7,
        daysCoverDeltaPct: -6.6,
        refineryInputKbd: 16120,
        yearAgoRefineryInputKbd: 15770,
        domesticProductionKbd: 13210,
        netImportsKbd: 2480,
        commercialStockChangeKbd: -340,
        reportDates: {
          current: 'mock',
          previous: 'mock',
          yearAgo: 'mock',
          twoYearsAgo: 'mock'
        }
      },
      gasStorage: {
        source: 'mock',
        updatedAt: snapshot.timestamp,
        reportDate: 'mock',
        releasedAt: 'mock',
        currentBcf: 1745,
        previousBcf: 1708,
        netChangeBcf: 37,
        yearAgoBcf: 1862,
        fiveYearAvgBcf: 1924,
        yearAgoDiffBcf: -117,
        fiveYearDiffBcf: -179,
        vsYearAgoPct: -6.3,
        vsFiveYearPct: -9.3,
        withinFiveYearRange: false
      },
      recentEvents: []
    });

    return {
      ...snapshot,
      resourceProfile: {
        ...resourceProfile,
        source: 'mock'
      },
      providerStats: {
        availableInstruments: Object.keys(SYMBOLS),
        missingInstruments: [],
        instrumentCount: Object.keys(SYMBOLS).length + 2,
        fearGreedLive: false,
        resourceProfileLive: false
      }
    };
  }

  async fetchBatchQuotes() {
    const symbols = Object.values(SYMBOLS).join(',');
    return retry(
      async () => {
        const response = await this.fetchWithTimeout(
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
        );

        if (!response.ok) {
          throw new Error(`Yahoo Finance quote request failed with ${response.status}`);
        }

        const payload = await response.json();
        const result = payload?.quoteResponse?.result || [];
        if (!result.length) {
          throw new Error('Yahoo Finance returned no quote results');
        }

        return new Map(result.map((item) => [item.symbol, item]));
      },
      {
        attempts: 2,
        baseDelayMs: 250
      }
    );
  }

  async fetchQuoteMap() {
    if (this.config.enableYahooBatchQuotes) {
      try {
        return await this.fetchBatchQuotes();
      } catch (error) {
        this.logger.warn('finance', 'Batch quote endpoint failed, falling back to chart pulls', {
          error: error.message
        });
      }
    }

    if (!this.batchQuoteInfoLogged) {
      this.logger.info('finance', 'Using Yahoo chart pulls for live quotes', {
        batchQuotesEnabled: false
      });
      this.batchQuoteInfoLogged = true;
    }

    const entries = await Promise.all(
      Object.entries(SYMBOLS).map(async ([key, symbol]) => {
        try {
          const quote = await this.fetchChartQuote(symbol);
          return [symbol, quote];
        } catch (innerError) {
          this.logger.warn('finance', 'Chart quote fetch failed', {
            instrument: key,
            symbol,
            error: innerError.message
          });
          return null;
        }
      })
    );

    return new Map(entries.filter(Boolean));
  }

  async fetchFearGreed() {
    return this.cache.wrap(
      'finance:fear-greed',
      async () => {
        const response = await this.fetchWithTimeout('https://api.alternative.me/fng/?limit=1&format=json');
        if (!response.ok) {
          throw new Error(`Alternative.me failed with ${response.status}`);
        }
        const payload = await response.json();
        const entry = payload?.data?.[0];
        if (!entry) {
          throw new Error('Alternative.me returned no data');
        }
        return {
          value: Number(entry.value),
          classification: entry.value_classification,
          timestamp: new Date(Number(entry.timestamp) * 1000).toISOString()
        };
      },
      15 * 60_000
    );
  }

  async fetchText(url, acceptHeader = 'text/plain, text/csv, text/html, application/xhtml+xml') {
    return retry(
      async () => {
        const response = await this.fetchWithTimeout(url, {
          headers: {
            accept: acceptHeader,
            'user-agent': 'Kompass/0.4'
          }
        });
        if (!response.ok) {
          throw new Error(`Resource request failed with ${response.status}`);
        }
        return response.text();
      },
      {
        attempts: 2,
        baseDelayMs: 250
      }
    );
  }

  async fetchOilInventoryData() {
    return this.cache.wrap(
      'finance:eia-oil-structure',
      async () => {
        const [table1Csv, table4Csv] = await Promise.all([
          this.fetchText('https://ir.eia.gov/wpsr/table1.csv'),
          this.fetchText('https://ir.eia.gov/wpsr/table4.csv')
        ]);
        const parsed = parseOilInventoryData(table1Csv, table4Csv);
        if (!parsed?.currentStocksMb) {
          throw new Error('EIA oil inventory payload was missing core stock data');
        }
        return parsed;
      },
      12 * 60 * 60_000
    );
  }

  async fetchGasStorageData() {
    return this.cache.wrap(
      'finance:eia-gas-structure',
      async () => {
        const html = await this.fetchText('https://ir.eia.gov/ngs/ngs.html?src=Natural-f3');
        const parsed = parseGasStorageData(html);
        if (!parsed?.currentBcf) {
          throw new Error('EIA natural gas payload was missing current storage data');
        }
        return parsed;
      },
      12 * 60 * 60_000
    );
  }

  fillInstrument(key, quoteMap, previousSnapshot, mockSnapshot) {
    const quote = quoteMap.get(SYMBOLS[key]);
    if (quote && Number.isFinite(Number(quote.regularMarketPrice))) {
      return this.buildInstrument(INSTRUMENT_LABELS[key], quote);
    }
    return previousSnapshot?.[key] || mockSnapshot[key];
  }

  async pullLiveSnapshot() {
    if (
      Date.now() - this.lastProviderCallAt < this.config.financeMinRequestGapMs &&
      this.state.marketSnapshot
    ) {
      return {
        ...this.state.marketSnapshot,
        source: this.state.lastFinanceSource || 'cache'
      };
    }

    const mockSnapshot = this.getMockSnapshot();
    const previousSnapshot = this.state.marketSnapshot;
    const quoteMap = await this.fetchQuoteMap();
    const availableInstruments = Object.entries(SYMBOLS)
      .filter(([, symbol]) => {
        const quote = quoteMap.get(symbol);
        return quote && Number.isFinite(Number(quote.regularMarketPrice));
      })
      .map(([key]) => key);
    const missingInstruments = Object.keys(SYMBOLS).filter(
      (key) => !availableInstruments.includes(key)
    );

    let fearGreedCrypto;
    let fearGreedLive = false;
    try {
      fearGreedCrypto = await this.fetchFearGreed();
      fearGreedLive = true;
    } catch (error) {
      this.logger.warn('finance', 'Fear & Greed fetch failed', {
        error: error.message
      });
      fearGreedCrypto = previousSnapshot?.fearGreedCrypto || mockSnapshot.fearGreedCrypto;
    }

    let oilInventory;
    let gasStorage;
    let resourceProfileLive = false;
    try {
      [oilInventory, gasStorage] = await Promise.all([
        this.fetchOilInventoryData(),
        this.fetchGasStorageData()
      ]);
      resourceProfileLive = true;
    } catch (error) {
      this.logger.warn('finance', 'Resource profile fetch failed', {
        error: error.message
      });
      oilInventory = previousSnapshot?.resourceProfile?.oilInventory || mockSnapshot.resourceProfile.oilInventory;
      gasStorage = previousSnapshot?.resourceProfile?.gasStorage || mockSnapshot.resourceProfile.gasStorage;
    }

    const coreLive = ['vix', 'sp500', 'btc'].filter((key) => availableInstruments.includes(key)).length;
    if (coreLive < 2 && !fearGreedLive) {
      // If the core tape is mostly missing, better to hold the last good snapshot than pretend.
      throw new Error('Not enough live finance inputs to build a trustworthy snapshot');
    }

    this.lastProviderCallAt = Date.now();
    const source =
      availableInstruments.length === Object.keys(SYMBOLS).length && fearGreedLive
        ? 'live'
        : 'live-partial';

    const baseSnapshot = {
      source,
      timestamp: new Date().toISOString(),
      vix: this.fillInstrument('vix', quoteMap, previousSnapshot, mockSnapshot),
      vxn: this.fillInstrument('vxn', quoteMap, previousSnapshot, mockSnapshot),
      ovx: this.fillInstrument('ovx', quoteMap, previousSnapshot, mockSnapshot),
      move: this.fillInstrument('move', quoteMap, previousSnapshot, mockSnapshot),
      sp500: this.fillInstrument('sp500', quoteMap, previousSnapshot, mockSnapshot),
      btc: this.fillInstrument('btc', quoteMap, previousSnapshot, mockSnapshot),
      gold: this.fillInstrument('gold', quoteMap, previousSnapshot, mockSnapshot),
      oil: this.fillInstrument('oil', quoteMap, previousSnapshot, mockSnapshot),
      naturalGas: this.fillInstrument('naturalGas', quoteMap, previousSnapshot, mockSnapshot),
      silver: this.fillInstrument('silver', quoteMap, previousSnapshot, mockSnapshot),
      wheat: this.fillInstrument('wheat', quoteMap, previousSnapshot, mockSnapshot),
      fearGreedCrypto
    };

    const resourceProfile = buildResourceProfile({
      snapshot: baseSnapshot,
      oilInventory,
      gasStorage,
      recentEvents: this.state.lastLiveEvents || this.state.recentEvents || []
    });

    return {
      ...baseSnapshot,
      resourceProfile: {
        ...resourceProfile,
        source: resourceProfileLive ? resourceProfile.source : 'partial'
      },
      providerStats: {
        availableInstruments,
        missingInstruments,
        instrumentCount: Object.keys(SYMBOLS).length + 2,
        fearGreedLive,
        resourceProfileLive
      }
    };
  }

  async persistSnapshot(snapshot) {
    const historyRows = await this.db.all(
      `
        SELECT ts, mood, payload
        FROM market_snapshots
        ORDER BY ts DESC
        LIMIT ?
      `,
      [this.config.kgpiBaselinePoints || 2_000]
    );
    const sentimentRows = await this.db.all(
      `
        SELECT ts, avg_tone, goldstein
        FROM global_snapshots
        ORDER BY ts DESC
        LIMIT ?
      `,
      [Math.min(this.config.kgpiBaselinePoints || 2_000, 500)]
    );
    const latestSentiment = sentimentRows[0]
      ? {
          avgTone: sentimentRows[0].avg_tone,
          goldstein: sentimentRows[0].goldstein,
          conflictScore: Number(this.state.latestGlobalMetadata?.conflictScore || 0),
          sourceCount: Number(this.state.latestGlobalMetadata?.sourceCount || 0),
          topConflictTags: Array.isArray(this.state.latestGlobalMetadata?.topConflictTags)
            ? this.state.latestGlobalMetadata.topConflictTags
            : [],
          history: sentimentRows.map((row) => ({
            timestamp: new Date(row.ts).toISOString(),
            avgTone: row.avg_tone,
            goldstein: row.goldstein
          }))
        }
      : {};

    const kgpi = calculateKgpi(snapshot, historyRows, latestSentiment);
    const payload = {
      ...snapshot,
      sentimentContext: latestSentiment.avgTone !== undefined
        ? {
            avgTone: latestSentiment.avgTone,
            goldstein: latestSentiment.goldstein
          }
        : null,
      kgpi,
      marketMood: kgpi
    };

    await this.db.run(
      `
        INSERT OR REPLACE INTO market_snapshots
          (ts, mood, payload)
        VALUES (?, ?, ?)
      `,
      [Date.now(), kgpi.score, JSON.stringify(payload)]
    );

    this.state.marketSnapshot = payload;
    this.state.lastFinanceFetchAt = new Date().toISOString();
    this.state.lastFinanceSource = snapshot.source;
    if (snapshot.source === 'live' || snapshot.source === 'live-partial') {
      this.state.lastLiveFinanceFetchAt = this.state.lastFinanceFetchAt;
    }

    return payload;
  }

  async refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
    try {
      const snapshot = await this.cache.wrap(
        'finance:live-snapshot',
        async () => this.pullLiveSnapshot(),
        Math.min(this.config.pollIntervalFinanceMs, 45_000)
      );
      if (snapshot.source !== 'live' && this.state.lastLiveFinanceFetchAt && this.state.marketSnapshot) {
        this.logger.warn('finance', 'Holding previous market snapshot until a full live refresh succeeds', {
          candidateSource: snapshot.source,
          lastLiveAt: this.state.lastLiveFinanceFetchAt
        });
        return this.holdPreviousSnapshot('Awaiting a full live finance refresh', snapshot.source);
      }
      const persisted = await this.persistSnapshot(snapshot);
      this.logger.info('finance', 'Market snapshot refreshed', {
        source: snapshot.source
      });
      return persisted;
    } catch (error) {
      if (this.state.lastLiveFinanceFetchAt && this.state.marketSnapshot) {
        this.logger.warn('finance', 'Retaining previous market snapshot after refresh failure', {
          error: error.message,
          lastLiveAt: this.state.lastLiveFinanceFetchAt
        });
        return this.holdPreviousSnapshot(error.message);
      }
      this.logger.warn('finance', 'Falling back to mocked market data', {
        error: error.message
      });
      return this.persistSnapshot(this.getMockSnapshot());
    }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async loadHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 3_600_000);
    const rows = await this.db.all(
      `
        SELECT ts, mood, payload
        FROM market_snapshots
        WHERE ts >= ?
        ORDER BY ts ASC
      `,
      [cutoff]
    );

    const parsed = rows.map((row) => {
      const payload = JSON.parse(row.payload);
      return {
        timestamp: new Date(row.ts).toISOString(),
        mood: row.mood,
        kgpi: payload.kgpi?.score ?? row.mood,
        vix: payload.vix?.value ?? 0,
        vxn: payload.vxn?.value ?? 0,
        ovx: payload.ovx?.value ?? 0,
        move: payload.move?.value ?? 0,
        sp500: payload.sp500?.value ?? 0,
        btc: payload.btc?.value ?? 0,
        gold: payload.gold?.value ?? 0,
        oil: payload.oil?.value ?? 0,
        naturalGas: payload.naturalGas?.value ?? 0,
        silver: payload.silver?.value ?? 0,
        wheat: payload.wheat?.value ?? 0
      };
    });

    const sampled = sampleSeries(parsed, 180);

    return {
      points: sampled,
      series: {
        mood: sampled.map((item) => item.kgpi),
        kgpi: sampled.map((item) => item.kgpi),
        vix: sampled.map((item) => item.vix),
        vxn: sampled.map((item) => item.vxn),
        ovx: sampled.map((item) => item.ovx),
        move: sampled.map((item) => item.move),
        sp500: sampled.map((item) => item.sp500),
        btc: sampled.map((item) => item.btc),
        gold: sampled.map((item) => item.gold),
        oil: sampled.map((item) => item.oil),
        naturalGas: sampled.map((item) => item.naturalGas),
        silver: sampled.map((item) => item.silver),
        wheat: sampled.map((item) => item.wheat)
      }
    };
  }

  async getHistory(hours = 24) {
    const revision = this.state.lastFinanceFetchAt || this.state.lastLiveFinanceFetchAt || 'boot';
    return this.cache.wrap(
      `finance:history:${hours}:${revision}`,
      async () => this.loadHistory(hours),
      this.getHistoryCacheTtlMs()
    );
  }

  async getAssetHistory({ asset = 'kgpi', rangeMs = 24 * 3_600_000, intervalMs }) {
    const normalizedAsset = normalizeAssetKey(asset);

    if (normalizedAsset !== 'kgpi') {
      try {
        const remoteHistory = await this.cache.wrap(
          `finance:asset-history:${normalizedAsset}:${rangeMs}`,
          async () => this.fetchRemoteAssetHistory(normalizedAsset, rangeMs),
          5 * 60_000
        );
        if (remoteHistory) {
          return remoteHistory;
        }
      } catch (error) {
        this.logger.warn('finance', 'Remote asset history fetch failed, falling back to local snapshots', {
          asset: normalizedAsset,
          error: error.message
        });
      }
    }

    const cutoff = Date.now() - rangeMs;
    const rows = await this.db.all(
      `
        SELECT ts, payload
        FROM market_snapshots
        WHERE ts >= ?
        ORDER BY ts ASC
      `,
      [cutoff]
    );

    const points = rows
      .map((row) => {
        const payload = JSON.parse(row.payload);
        const isLiveFinanceSnapshot = ['live', 'live-partial'].includes(payload?.source);
        if (normalizedAsset !== 'kgpi' && !isLiveFinanceSnapshot) {
          return null;
        }
        const value = pickAssetValue(payload, normalizedAsset);
        if (!Number.isFinite(value)) {
          return null;
        }
        return {
          timestamp: new Date(row.ts).toISOString(),
          value
        };
      })
      .filter(Boolean);

    const seriesPoints = points.length >= 3 ? points : rows
      .map((row) => {
        const payload = JSON.parse(row.payload);
        const value = pickAssetValue(payload, normalizedAsset);
        if (!Number.isFinite(value)) {
          return null;
        }
        return {
          timestamp: new Date(row.ts).toISOString(),
          value
        };
      })
      .filter(Boolean);

    const effectiveIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0
      ? intervalMs
      : defaultIntervalMs(rangeMs);
    const candles = sampleSeries(buildCandles(seriesPoints, effectiveIntervalMs), 120);
    const linePoints = sampleSeries(seriesPoints, 240);
    const latest = seriesPoints.at(-1)?.value ?? null;
    const previous = seriesPoints.at(-2)?.value ?? latest;
    const changePercent = Number.isFinite(latest) && Number.isFinite(previous) && previous
      ? Number((((latest - previous) / previous) * 100).toFixed(3))
      : 0;

    return {
      asset: normalizedAsset,
      label: normalizedAsset === 'kgpi' ? 'KGPI' : (INSTRUMENT_LABELS[normalizedAsset] || normalizedAsset),
      currency: this.state.marketSnapshot
        ? pickAssetCurrency(this.state.marketSnapshot, normalizedAsset)
        : 'USD',
      rangeMs,
      intervalMs: effectiveIntervalMs,
      latest,
      changePercent,
      historySource: 'local',
      points: linePoints,
      candles
    };
  }

  async getMarketSnapshot() {
    if (!this.state.marketSnapshot) {
      await this.refresh();
    }
    const revision = `${this.state.lastFinanceFetchAt || 'boot'}:${this.state.lastFinanceSource || 'boot'}`;
    return this.cache.wrap(
      `finance:market-snapshot:${revision}`,
      async () => {
        const history = await this.getHistory(24);
        return {
          snapshot: this.state.marketSnapshot,
          history,
          lastFetchAt: this.state.lastFinanceFetchAt
        };
      },
      this.getMarketSnapshotCacheTtlMs()
    );
  }

  start() {
    this.stop();
    this.intervalHandle = setInterval(() => {
      this.refresh().catch((error) => {
        this.metrics.inc('errors_total');
        this.logger.error('finance', 'Scheduled finance refresh failed', {
          error: error.message
        });
      });
    }, this.config.pollIntervalFinanceMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

module.exports = {
  FinanceService
};
