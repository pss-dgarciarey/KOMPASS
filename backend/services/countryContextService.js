const { getCountryProfile } = require('../data/countryProfiles');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSigned(value, digits = 2, suffix = '') {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`;
}

function pickLatestIndicatorEntry(payload) {
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
  return rows.find((row) => Number.isFinite(Number(row?.value))) || null;
}

function average(values) {
  const sample = values.filter(Number.isFinite);
  if (!sample.length) {
    return 0;
  }
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

class CountryContextService {
  constructor({ cache, logger, fetchImpl, financeService }) {
    this.cache = cache;
    this.logger = logger;
    this.fetchImpl = fetchImpl;
    this.financeService = financeService;
  }

  async fetchWorldBankIndicator(iso3, indicator, ttlMs = 12 * 60 * 60_000) {
    const cacheKey = `country-context:${iso3}:${indicator}`;
    return this.cache.wrap(
      cacheKey,
      async () => {
        const response = await this.fetchImpl(
          `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=60`
        );

        if (!response.ok) {
          throw new Error(`World Bank indicator ${indicator} failed with ${response.status}`);
        }

        const payload = await response.json();
        const latest = pickLatestIndicatorEntry(payload);
        if (!latest) {
          return null;
        }

        return {
          indicator,
          value: Number(latest.value),
          year: latest.date,
          source: 'World Bank',
          updatedAt: new Date().toISOString()
        };
      },
      ttlMs
    );
  }

  buildMacroComposite({ unemployment, inflation, benchmark }) {
    const unemploymentStress = Number.isFinite(unemployment?.value)
      ? clamp((unemployment.value - 4) * 7, 0, 100)
      : null;
    const inflationStress = Number.isFinite(inflation?.value)
      ? clamp(Math.max(0, Math.abs(inflation.value) - 2) * 10, 0, 100)
      : null;
    const marketStress = Number.isFinite(benchmark?.changePercent)
      ? clamp(Math.max(0, -benchmark.changePercent) * 12, 0, 100)
      : null;

    const score = average([
      unemploymentStress,
      inflationStress,
      marketStress
    ]);

    const label =
      score >= 65
        ? 'stressed'
        : score >= 45
          ? 'elevated'
          : score > 0
            ? 'steady'
            : 'limited-data';

    return {
      score: Number(score.toFixed(1)),
      label,
      components: {
        unemploymentStress,
        inflationStress,
        marketStress
      }
    };
  }

  buildMacroNarrative({ country, unemployment, inflation, benchmark, macroComposite }) {
    const pieces = [];

    if (Number.isFinite(unemployment?.value)) {
      pieces.push(`unemployment is ${unemployment.value.toFixed(1)}% (${unemployment.year})`);
    }
    if (Number.isFinite(inflation?.value)) {
      pieces.push(`inflation is ${inflation.value.toFixed(1)}% (${inflation.year})`);
    }
    if (benchmark?.label && Number.isFinite(benchmark?.changePercent)) {
      pieces.push(`${benchmark.label} is ${formatSigned(benchmark.changePercent, 2, '%')} over the selected market window`);
    } else if (benchmark?.marketType === 'proxy') {
      pieces.push(`${benchmark.label} proxy is configured through ${benchmark.venue}`);
    } else if (benchmark?.marketType === 'untracked') {
      pieces.push('no tracked national equity benchmark is configured yet');
    }

    if (!pieces.length) {
      return `${country.name} has limited free macro context available right now, so the panel leans more heavily on news signal quality.`;
    }

    return `${country.name} macro overlay is ${macroComposite.label}. Right now ${pieces.join(', ')}.`;
  }

  async getCountryContext(region) {
    const country = getCountryProfile(region);
    const cacheKey = `country-context:summary:${country.iso3}`;

    return this.cache.wrap(
      cacheKey,
      async () => {
        const benchmarkMeta = country.benchmark || null;
        const [unemployment, inflation, benchmark] = await Promise.all([
          this.fetchWorldBankIndicator(country.iso3, 'SL.UEM.TOTL.ZS').catch((error) => {
            this.logger.warn('country-context', 'Unemployment fetch failed', {
              region: country.iso3,
              error: error.message
            });
            return null;
          }),
          this.fetchWorldBankIndicator(country.iso3, 'FP.CPI.TOTL.ZG').catch((error) => {
            this.logger.warn('country-context', 'Inflation fetch failed', {
              region: country.iso3,
              error: error.message
            });
            return null;
          }),
          country.benchmark?.symbol
            ? this.financeService.fetchBenchmarkHistory({
                provider: country.benchmark.provider,
                symbol: country.benchmark.symbol,
                label: country.benchmark.label,
                fallbackSymbols: country.benchmark.fallbackSymbols || [],
                rangeMs: 30 * 24 * 3_600_000,
                currency: country.benchmark.currency
              }).catch((error) => {
                this.logger.warn('country-context', 'Benchmark history fetch failed', {
                  region: country.iso3,
                  symbol: country.benchmark.symbol,
                  error: error.message
                });
                return null;
              })
            : Promise.resolve(null)
        ]);

        const resolvedBenchmark = benchmark
          ? {
              ...benchmarkMeta,
              ...benchmark
            }
          : benchmarkMeta
            ? {
                ...benchmarkMeta,
                latest: null,
                changePercent: null,
                points: [],
                candles: [],
                historySource: benchmarkMeta.marketType === 'untracked'
                  ? 'untracked'
                  : benchmarkMeta.provider || null
              }
            : null;

        const macroComposite = this.buildMacroComposite({
          unemployment,
          inflation,
          benchmark: resolvedBenchmark
        });

        return {
          country,
          unemployment,
          inflation,
          benchmark: resolvedBenchmark,
          macroComposite,
          narrative: this.buildMacroNarrative({
            country,
            unemployment,
            inflation,
            benchmark: resolvedBenchmark,
            macroComposite
          }),
          updatedAt: new Date().toISOString()
        };
      },
      5 * 60_000
    );
  }
}

module.exports = {
  CountryContextService
};
