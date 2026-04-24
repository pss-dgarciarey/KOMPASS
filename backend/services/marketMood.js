function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 1;
  }
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

function zScore(value, sample) {
  const deviation = standardDeviation(sample);
  return (value - mean(sample)) / deviation;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function positivePart(value) {
  return value > 0 ? value : 0;
}

function negativePart(value) {
  return value < 0 ? Math.abs(value) : 0;
}

function cappedPositive(value, cap = 3) {
  return clamp(positivePart(value), 0, cap);
}

function cappedNegative(value, cap = 3) {
  return clamp(negativePart(value), 0, cap);
}

function parseHistory(historyRows = []) {
  return historyRows
    .map((row) => {
      if (row && row.payload) {
        try {
          return JSON.parse(row.payload);
        } catch {
          return null;
        }
      }
      return row;
    })
    .filter(Boolean);
}

function numericSeries(items, selector) {
  return items.map(selector).filter(Number.isFinite);
}

function meanAbsoluteChange(snapshot, keys) {
  const sample = keys
    .map((key) => Math.abs(snapshot?.[key]?.changePercent ?? Number.NaN))
    .filter(Number.isFinite);
  return sample.length ? mean(sample) : 0;
}

function buildComponent({ key, label, value, sample, fallback, weight }) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const baseline = sample.length >= 10 ? sample : fallback;
  const z = zScore(value, baseline);
  return {
    key,
    label,
    value,
    weight,
    baselineSize: sample.length,
    z
  };
}

function normalizeSentimentScore(avgTone, goldstein) {
  const toneScore = clamp((((Number(avgTone) || 0) + 10) / 20) * 100, 0, 100);
  const goldsteinScore = clamp((((Number(goldstein) || 0) + 10) / 20) * 100, 0, 100);
  return (toneScore * 0.65) + (goldsteinScore * 0.35);
}

function safeNumeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function resourcePressure(resourceProfile = {}) {
  const supplyShockScore = safeNumeric(resourceProfile?.cards?.supplyShock?.score);
  const oilPressureScore = safeNumeric(resourceProfile?.cards?.oilPressure?.score);
  const gasPressureScore = safeNumeric(resourceProfile?.cards?.gasPressure?.score);

  if (
    supplyShockScore !== null ||
    oilPressureScore !== null ||
    gasPressureScore !== null
  ) {
    // If the richer resource model is available, trust it instead of rebuilding a weaker proxy here.
    const weighted =
      ((supplyShockScore ?? 0) * 0.5) +
      ((oilPressureScore ?? 0) * 0.3) +
      ((gasPressureScore ?? 0) * 0.2);
    return clamp(weighted / 6.7, 0, 15);
  }

  const totalRents = safeNumeric(resourceProfile.totalNaturalResourceRentsPct) ?? 0;
  const oilRents = safeNumeric(resourceProfile.oilRentsPct) ?? 0;
  const gasRents = safeNumeric(resourceProfile.gasRentsPct) ?? 0;
  return clamp((totalRents * 0.5) + (oilRents * 0.3) + (gasRents * 0.2), 0, 15);
}

function countConflictSignals(sentimentContext = {}) {
  return Array.isArray(sentimentContext.topConflictTags)
    ? sentimentContext.topConflictTags.length
    : 0;
}

function deriveRegimeCaps({ score, sentimentContext, snapshot }) {
  let capped = score;
  const avgTone = Number(sentimentContext.avgTone || 0);
  const conflictScore = Number(sentimentContext.conflictScore || 0);
  const conflictSignals = countConflictSignals(sentimentContext);
  const fearGreed = Number(snapshot?.fearGreedCrypto?.value || 50);
  const vix = Number(snapshot?.vix?.value || 0);
  const ovx = Number(snapshot?.ovx?.value || 0);
  const move = Number(snapshot?.move?.value || 0);

  // Hard cap greed when the world is obviously tense. Better to look conservative than delusional.
  if (avgTone <= -1.5) {
    capped = Math.min(capped, 60);
  }
  if (avgTone <= -3.2) {
    capped = Math.min(capped, 52);
  }
  if (conflictScore >= 6) {
    capped = Math.min(capped, 58);
  }
  if (conflictScore >= 8.5 || conflictSignals >= 3) {
    capped = Math.min(capped, 52);
  }
  if (fearGreed <= 20) {
    capped = Math.min(capped, 48);
  }
  if (vix >= 24 || ovx >= 44 || move >= 115) {
    capped = Math.min(capped, 56);
  }
  if (vix >= 30 || ovx >= 52 || move >= 130) {
    capped = Math.min(capped, 48);
  }

  return capped;
}

function calculateKgpi(snapshot, historyRows = [], sentimentContext = {}) {
  const parsedHistory = parseHistory(historyRows);
  // These quick derived stress measures are cheap to compute and good enough for an always-on public dashboard.
  const realizedStressValue = meanAbsoluteChange(snapshot, ['sp500', 'btc', 'oil', 'naturalGas']);
  const btcVolatilityValue = Math.abs(snapshot?.btc?.changePercent ?? Number.NaN);
  const energyStressValue = meanAbsoluteChange(snapshot, ['oil', 'naturalGas']);
  const commodityStressValue = meanAbsoluteChange(snapshot, ['gold', 'silver', 'wheat']);
  const safeHavenFlowValue = mean(
    [snapshot?.gold?.changePercent, snapshot?.silver?.changePercent]
      .map((value) => Math.abs(Number(value)))
      .filter(Number.isFinite)
  );
  const resourcePressureValue = resourcePressure(snapshot?.resourceProfile);
  const sentimentHistory = Array.isArray(sentimentContext.history) ? sentimentContext.history : [];

  const componentDefinitions = [
    {
      key: 'vix',
      label: 'VIX',
      value: snapshot?.vix?.value,
      sample: numericSeries(parsedHistory, (item) => item.vix?.value),
      fallback: [15, 18, 21, 24, 30],
      weight: 0.19
    },
    {
      key: 'vxn',
      label: 'VXN',
      value: snapshot?.vxn?.value,
      sample: numericSeries(parsedHistory, (item) => item.vxn?.value),
      fallback: [18, 22, 26, 31, 38],
      weight: 0.1
    },
    {
      key: 'ovx',
      label: 'OVX',
      value: snapshot?.ovx?.value,
      sample: numericSeries(parsedHistory, (item) => item.ovx?.value),
      fallback: [24, 30, 38, 47, 58],
      weight: 0.11
    },
    {
      key: 'move',
      label: 'MOVE',
      value: snapshot?.move?.value,
      sample: numericSeries(parsedHistory, (item) => item.move?.value),
      fallback: [85, 100, 115, 130, 150],
      weight: 0.11
    },
    {
      key: 'fearGreedCrypto',
      label: 'Crypto Fear & Greed',
      value: snapshot?.fearGreedCrypto?.value,
      sample: numericSeries(parsedHistory, (item) => item.fearGreedCrypto?.value),
      fallback: [18, 32, 48, 63, 80],
      weight: 0.12
    },
    {
      key: 'realizedStress',
      label: 'Cross-asset stress',
      value: realizedStressValue,
      sample: numericSeries(parsedHistory, (item) => meanAbsoluteChange(item, ['sp500', 'btc', 'oil', 'naturalGas'])),
      fallback: [0.3, 0.7, 1.2, 1.8],
      weight: 0.1
    },
    {
      key: 'btcVolatility',
      label: 'BTC short volatility',
      value: btcVolatilityValue,
      sample: numericSeries(parsedHistory, (item) => Math.abs(item?.btc?.changePercent ?? Number.NaN)),
      fallback: [0.8, 1.6, 3.2, 5.5],
      weight: 0.06
    },
    {
      key: 'energyStress',
      label: 'Energy stress',
      value: energyStressValue,
      sample: numericSeries(parsedHistory, (item) => meanAbsoluteChange(item, ['oil', 'naturalGas'])),
      fallback: [0.5, 1.1, 2.0, 3.2],
      weight: 0.11
    },
    {
      key: 'commodityStress',
      label: 'Commodity stress',
      value: commodityStressValue,
      sample: numericSeries(parsedHistory, (item) => meanAbsoluteChange(item, ['gold', 'silver', 'wheat'])),
      fallback: [0.4, 0.8, 1.5, 2.4],
      weight: 0.08
    },
    {
      key: 'safeHavenFlow',
      label: 'Safe-haven flow',
      value: safeHavenFlowValue,
      sample: numericSeries(parsedHistory, (item) =>
        mean(
          [item?.gold?.changePercent, item?.silver?.changePercent]
            .map((value) => Math.abs(Number(value)))
            .filter(Number.isFinite)
        )
      ),
      fallback: [0.2, 0.5, 0.9, 1.5],
      weight: 0.05
    },
    {
      key: 'resourcePressure',
      label: 'Supply shock baseline',
      value: resourcePressureValue,
      sample: numericSeries(parsedHistory, (item) => resourcePressure(item?.resourceProfile)),
      fallback: [2.5, 4, 6.5, 9.5],
      weight: 0.04
    },
    {
      key: 'newsTone',
      label: 'Global AvgTone',
      value: sentimentContext.avgTone,
      sample: numericSeries(sentimentHistory, (item) => item.avgTone),
      fallback: [-8, -4, 0, 4, 8],
      weight: 0.12
    },
    {
      key: 'newsGoldstein',
      label: 'Global Goldstein',
      value: sentimentContext.goldstein,
      sample: numericSeries(sentimentHistory, (item) => item.goldstein),
      fallback: [-8, -4, 0, 4, 8],
      weight: 0.06
    }
  ];

  const components = componentDefinitions
    .map((definition) => buildComponent(definition))
    .filter(Boolean);
  const componentsByKey = Object.fromEntries(components.map((component) => [component.key, component]));

  const volatilityPenalty =
    (cappedPositive(componentsByKey.vix?.z || 0) * 0.19) +
    (cappedPositive(componentsByKey.vxn?.z || 0) * 0.1) +
    (cappedPositive(componentsByKey.ovx?.z || 0) * 0.11) +
    (cappedPositive(componentsByKey.move?.z || 0) * 0.11) +
    (cappedPositive(componentsByKey.realizedStress?.z || 0) * 0.1) +
    (cappedPositive(componentsByKey.btcVolatility?.z || 0) * 0.06);

  const macroPenalty =
    (cappedPositive(componentsByKey.energyStress?.z || 0) * 0.11) +
    (cappedPositive(componentsByKey.commodityStress?.z || 0) * 0.08) +
    (cappedPositive(componentsByKey.safeHavenFlow?.z || 0) * 0.05) +
    (cappedPositive(componentsByKey.resourcePressure?.z || 0) * 0.04);

  const appetiteBoost = cappedPositive(componentsByKey.fearGreedCrypto?.z || 0) * 0.12;
  const sentimentSupport =
    (cappedPositive(componentsByKey.newsTone?.z || 0) * 0.08) +
    (cappedPositive(componentsByKey.newsGoldstein?.z || 0) * 0.04);
  const sentimentPenalty =
    (cappedNegative(componentsByKey.newsTone?.z || 0) * 0.16) +
    (cappedNegative(componentsByKey.newsGoldstein?.z || 0) * 0.09);

  const conflictPressure = clamp(Number(sentimentContext.conflictScore || 0) / 4.5, 0, 3.2);
  const conflictBreadthPenalty = clamp(countConflictSignals(sentimentContext) * 0.18, 0, 0.72);
  const sourceBreadthBoost = clamp(Math.log10((Number(sentimentContext.sourceCount) || 0) + 1) * 0.035, 0, 0.11);

  const weighted =
    -0.35 +
    appetiteBoost +
    sentimentSupport +
    sourceBreadthBoost -
    volatilityPenalty -
    macroPenalty -
    sentimentPenalty -
    conflictPressure * 0.18 -
    conflictBreadthPenalty;

  const rawScore = clamp(Math.round(sigmoid(weighted) * 100), 0, 100);
  const normalized = deriveRegimeCaps({
    score: rawScore,
    sentimentContext,
    snapshot
  });
  const sentimentScore = Number.isFinite(Number(sentimentContext.avgTone))
    ? Math.round(normalizeSentimentScore(sentimentContext.avgTone, sentimentContext.goldstein))
    : null;
  const label =
    normalized < 20
      ? 'panic'
      : normalized < 35
        ? 'fear'
        : normalized > 72
          ? 'overheated'
          : normalized > 58
            ? 'fragile-risk-on'
            : 'balanced';

  return {
    score: normalized,
    label,
    baselineReady: components.every((component) => component.baselineSize >= 10),
    components: Object.fromEntries(
      components.map((component) => [
        component.key,
        {
          label: component.label,
          value: Number(component.value.toFixed(3)),
          z: Number(component.z.toFixed(3)),
          weight: component.weight,
          contribution: Number(
            (
              (component.key === 'fearGreedCrypto'
                ? cappedPositive(component.z) * component.weight
                : component.key === 'newsTone' || component.key === 'newsGoldstein'
                  ? (cappedPositive(component.z) * (component.weight * 0.66)) - (cappedNegative(component.z) * (component.weight * 1.3))
                  : -cappedPositive(component.z) * component.weight
              )
            ).toFixed(3)
          )
        }
      ])
    ),
    metadata: {
      activeInputs: components.map((component) => component.key),
      sampleSize: parsedHistory.length,
      sentimentScore,
      conflictScore: Number(Number(sentimentContext.conflictScore || 0).toFixed(2)),
      resourcePressure: Number(resourcePressureValue.toFixed(2)),
      rawScore,
      regimeCapsApplied: rawScore !== normalized
    }
  };
}

function calculateMarketMood(snapshot, historyRows = []) {
  const parsedHistory = parseHistory(historyRows);
  const vixSample = numericSeries(parsedHistory, (item) => item.vix?.value);
  const fearGreedSample = numericSeries(parsedHistory, (item) => item.fearGreedCrypto?.value);
  const shortVolSample = numericSeries(
    parsedHistory,
    (item) => Math.abs(item?.sp500?.changePercent || 0)
  );
  const energyStressSample = numericSeries(
    parsedHistory,
    (item) => meanAbsoluteChange(item, ['oil', 'naturalGas'])
  );

  const baselineReady = vixSample.length >= 10 && fearGreedSample.length >= 10 && shortVolSample.length >= 10;

  const vixZ = zScore(snapshot.vix.value, baselineReady ? vixSample : [18, 21, 24, 27, 30]);
  const fearGreedZ = zScore(snapshot.fearGreedCrypto.value, baselineReady ? fearGreedSample : [20, 35, 50, 65, 80]);
  const shortVolZ = zScore(Math.abs(snapshot.sp500.changePercent || 0), baselineReady ? shortVolSample : [0.25, 0.8, 1.4, 2.2]);
  const energyStressZ = zScore(
    meanAbsoluteChange(snapshot, ['oil', 'naturalGas']),
    energyStressSample.length >= 10 ? energyStressSample : [0.5, 1.0, 1.6, 2.5]
  );

  const weighted = (-cappedPositive(vixZ) * 0.45) + (cappedPositive(fearGreedZ) * 0.22) - (cappedPositive(shortVolZ) * 0.18) - (cappedPositive(energyStressZ) * 0.15) - 0.2;
  const normalized = clamp(Math.round(sigmoid(weighted) * 100), 0, 100);
  const label = normalized < 35 ? 'fear' : normalized > 65 ? 'greed' : 'balanced';

  return {
    score: normalized,
    label,
    baselineReady,
    components: {
      vixZ,
      fearGreedZ,
      shortVolZ,
      energyStressZ
    }
  };
}

module.exports = {
  calculateKgpi,
  calculateMarketMood
};
