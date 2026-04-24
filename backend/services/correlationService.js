const { parseDurationMs } = require('../config');

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearsonCoefficient(left, right) {
  if (left.length !== right.length || left.length < 3) {
    return 0;
  }

  const leftMean = average(left);
  const rightMean = average(right);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;

  for (let index = 0; index < left.length; index += 1) {
    const x = left[index] - leftMean;
    const y = right[index] - rightMean;
    numerator += x * y;
    leftSquares += x * x;
    rightSquares += y * y;
  }

  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator ? numerator / denominator : 0;
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function approximatePValue(r, n) {
  if (n < 3 || Math.abs(r) >= 1) {
    return 1;
  }
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - (r * r)));
  return Number((2 * (1 - normalCdf(t))).toFixed(4));
}

function labelSignificance(r, pValue) {
  if (pValue < 0.05 && Math.abs(r) >= 0.6) {
    return 'strong';
  }
  if (pValue < 0.1 && Math.abs(r) >= 0.35) {
    return 'moderate';
  }
  return 'weak';
}

class CorrelationService {
  constructor({ config, db, logger }) {
    this.config = config;
    this.db = db;
    this.logger = logger;
  }

  alignSeries(globalRows, marketRows) {
    const marketByBucket = new Map();
    for (const row of marketRows) {
      const bucket = Math.floor(row.ts / 300_000) * 300_000;
      marketByBucket.set(bucket, JSON.parse(row.payload));
    }

    const aligned = {
      avgTone: [],
      vix: [],
      vxn: [],
      ovx: [],
      move: [],
      sp500: [],
      btc: [],
      gold: [],
      oil: [],
      kgpi: []
    };

    for (const row of globalRows) {
      const bucket = Math.floor(row.ts / 300_000) * 300_000;
      const market = marketByBucket.get(bucket);
      if (!market) {
        continue;
      }

      aligned.avgTone.push(row.avg_tone);
      aligned.vix.push(market.vix?.value ?? 0);
      aligned.vxn.push(market.vxn?.value ?? 0);
      aligned.ovx.push(market.ovx?.value ?? 0);
      aligned.move.push(market.move?.value ?? 0);
      aligned.sp500.push(market.sp500?.changePercent ?? 0);
      aligned.btc.push(market.btc?.changePercent ?? 0);
      aligned.gold.push(market.gold?.changePercent ?? 0);
      aligned.oil.push(market.oil?.changePercent ?? 0);
      aligned.kgpi.push(market.kgpi?.score ?? market.marketMood?.score ?? 50);
    }

    return aligned;
  }

  buildInsight(results) {
    const strongest = Object.entries(results.indicators)
      .sort((left, right) => Math.abs(right[1].coefficient) - Math.abs(left[1].coefficient))
      .at(0);

    if (!strongest) {
      return 'Not enough aligned samples to infer a meaningful relationship yet.';
    }

    const [name, entry] = strongest;
    const direction = entry.coefficient >= 0 ? 'moves with' : 'moves against';
    return `Global AvgTone currently ${direction} ${name.toUpperCase()} over the selected window, with ${entry.significance} significance.`;
  }

  async getCorrelations(window = '6h') {
    const since = Date.now() - parseDurationMs(window, 6 * 3_600_000);
    const [globalRows, marketRows] = await Promise.all([
      this.db.all(
        `
          SELECT ts, avg_tone
          FROM global_snapshots
          WHERE ts >= ?
          ORDER BY ts ASC
        `,
        [since]
      ),
      this.db.all(
        `
          SELECT ts, mood, payload
          FROM market_snapshots
          WHERE ts >= ?
          ORDER BY ts ASC
        `,
        [since]
      )
    ]);

    const aligned = this.alignSeries(globalRows, marketRows);
    const indicators = {};
    for (const key of ['kgpi', 'vix', 'vxn', 'ovx', 'move', 'sp500', 'btc', 'gold', 'oil']) {
      const coefficient = Number(pearsonCoefficient(aligned.avgTone, aligned[key]).toFixed(3));
      const pValue = approximatePValue(coefficient, aligned.avgTone.length);
      indicators[key] = {
        coefficient,
        pValue,
        significance: labelSignificance(coefficient, pValue)
      };
    }

    const payload = {
      window,
      sampleSize: aligned.avgTone.length,
      indicators,
      insight: this.buildInsight({ indicators })
    };

    this.logger.debug('correlation', 'Computed rolling correlations', payload);
    return payload;
  }
}

module.exports = {
  CorrelationService
};
