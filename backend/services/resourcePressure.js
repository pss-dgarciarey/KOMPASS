function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mean(values) {
  const sample = values.filter(Number.isFinite);
  if (!sample.length) {
    return 0;
  }
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value)
    .replace(/"/g, '')
    .replace(/,/g, '')
    .replace(/[^\d.+-]/g, '')
    .trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(digits));
}

function resolveLatestTimestamp(values = []) {
  const timestamps = values
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite);

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function formatSigned(value, digits = 1, suffix = '') {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`;
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsvRows(csvText) {
  return String(csvText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
}

function normalizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function pctDelta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) {
    return null;
  }
  return ((current - baseline) / baseline) * 100;
}

function buildRiskLevel(score) {
  const numeric = Number(score);
  if (numeric >= 80) {
    return { label: 'critical', tone: 'text-rose-200' };
  }
  if (numeric >= 62) {
    return { label: 'stressed', tone: 'text-amber-200' };
  }
  if (numeric >= 42) {
    return { label: 'elevated', tone: 'text-cyan-100' };
  }
  return { label: 'calm', tone: 'text-emerald-200' };
}

function parseOilInventoryData(table1Csv, table4Csv) {
  const table4Rows = parseCsvRows(table4Csv);
  const table1Rows = parseCsvRows(table1Csv);

  const storageRows = table4Rows
    .filter((row) => row.length >= 7 && normalizeLabel(row[0]) !== 'stub_1');
  const flowRows = table1Rows
    .filter((row) => row.length >= 8 && normalizeLabel(row[0]) !== 'stub_1');

  const findStorageRow = (label) => storageRows.find((row) => normalizeLabel(row[0]) === normalizeLabel(label));
  const findFlowRow = (label) => flowRows.find((row) => normalizeLabel(row[1]).includes(normalizeLabel(label)));

  const commercialRow = findStorageRow('Commercial (Excluding SPR)');
  const sprRow = findStorageRow('SPR');
  const totalExSprRow = findStorageRow('Total Stocks (Excluding SPR)');
  const refineryInputRow = findFlowRow('Crude Oil Input to Refineries');
  const domesticProductionRow = findFlowRow('Domestic Production');
  const netImportsRow = findFlowRow('Net Imports (Including SPR)');
  const commercialStockChangeRow = findFlowRow('Commercial Stock Change');

  const currentStocksMb = safeNumber(commercialRow?.[1]);
  const previousStocksMb = safeNumber(commercialRow?.[2]);
  const yearAgoStocksMb = safeNumber(commercialRow?.[4]);
  const twoYearsAgoStocksMb = safeNumber(commercialRow?.[6]);
  const refineryInputKbd = safeNumber(refineryInputRow?.[2]);
  const yearAgoRefineryInputKbd = safeNumber(refineryInputRow?.[5]);
  const daysCover = Number.isFinite(currentStocksMb) && Number.isFinite(refineryInputKbd) && refineryInputKbd > 0
    ? currentStocksMb / (refineryInputKbd / 1000)
    : null;
  const yearAgoDaysCover = Number.isFinite(yearAgoStocksMb) && Number.isFinite(yearAgoRefineryInputKbd) && yearAgoRefineryInputKbd > 0
    ? yearAgoStocksMb / (yearAgoRefineryInputKbd / 1000)
    : null;

  return {
    source: 'eia-wpsr',
    updatedAt: new Date().toISOString(),
    currentStocksMb: round(currentStocksMb, 3),
    previousStocksMb: round(previousStocksMb, 3),
    yearAgoStocksMb: round(yearAgoStocksMb, 3),
    twoYearsAgoStocksMb: round(twoYearsAgoStocksMb, 3),
    sprStocksMb: round(safeNumber(sprRow?.[1]), 3),
    totalStocksExSprMb: round(safeNumber(totalExSprRow?.[1]), 3),
    stockDeltaVsYearAgoPct: round(pctDelta(currentStocksMb, yearAgoStocksMb), 2),
    stockDeltaVsTwoYearsAgoPct: round(pctDelta(currentStocksMb, twoYearsAgoStocksMb), 2),
    daysCover: round(daysCover, 2),
    yearAgoDaysCover: round(yearAgoDaysCover, 2),
    daysCoverDeltaPct: round(pctDelta(daysCover, yearAgoDaysCover), 2),
    refineryInputKbd: round(refineryInputKbd, 0),
    yearAgoRefineryInputKbd: round(yearAgoRefineryInputKbd, 0),
    domesticProductionKbd: round(safeNumber(domesticProductionRow?.[2]), 0),
    netImportsKbd: round(safeNumber(netImportsRow?.[2]), 0),
    commercialStockChangeKbd: round(safeNumber(commercialStockChangeRow?.[2]), 0),
    reportDates: {
      current: storageRows[0]?.[1] || '',
      previous: storageRows[0]?.[2] || '',
      yearAgo: storageRows[0]?.[4] || '',
      twoYearsAgo: storageRows[0]?.[6] || ''
    }
  };
}

function parseGasStorageData(html) {
  const content = String(html || '');
  const reportDate = content.match(/for week ending\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1] || '';
  const releasedAt = content.match(/Released:\s*&nbsp;([^<]+)/i)?.[1]?.replace(/&nbsp;/g, ' ').trim() || '';
  const summaryMatch = content.match(
    /Working gas in storage was ([\d,]+) Bcf[\s\S]*?net (increase|decrease) of ([\d,]+) Bcf[\s\S]*?Stocks were ([\d,]+) Bcf (higher|lower) than last year[\s\S]*?and ([\d,]+) Bcf (above|below) the five-year average of ([\d,]+) Bcf/i
  );

  if (!summaryMatch) {
    return null;
  }

  const currentBcf = safeNumber(summaryMatch[1]);
  const movementBcf = safeNumber(summaryMatch[3]);
  const yearAgoDiffBcf = safeNumber(summaryMatch[4]);
  const fiveYearDiffBcf = safeNumber(summaryMatch[6]);
  const fiveYearAvgBcf = safeNumber(summaryMatch[8]);
  const previousBcf = summaryMatch[2].toLowerCase() === 'increase'
    ? currentBcf - movementBcf
    : currentBcf + movementBcf;
  const yearAgoBcf = summaryMatch[5].toLowerCase() === 'higher'
    ? currentBcf - yearAgoDiffBcf
    : currentBcf + yearAgoDiffBcf;

  return {
    source: 'eia-ngs',
    updatedAt: new Date().toISOString(),
    reportDate,
    releasedAt,
    currentBcf: round(currentBcf, 0),
    previousBcf: round(previousBcf, 0),
    netChangeBcf: round(summaryMatch[2].toLowerCase() === 'increase' ? movementBcf : -movementBcf, 0),
    yearAgoBcf: round(yearAgoBcf, 0),
    fiveYearAvgBcf: round(fiveYearAvgBcf, 0),
    yearAgoDiffBcf: round(summaryMatch[5].toLowerCase() === 'higher' ? yearAgoDiffBcf : -yearAgoDiffBcf, 0),
    fiveYearDiffBcf: round(summaryMatch[7].toLowerCase() === 'above' ? fiveYearDiffBcf : -fiveYearDiffBcf, 0),
    vsYearAgoPct: round(pctDelta(currentBcf, yearAgoBcf), 2),
    vsFiveYearPct: round(pctDelta(currentBcf, fiveYearAvgBcf), 2),
    withinFiveYearRange: /within the five-year historical range/i.test(content)
  };
}

const CORRIDOR_DEFS = [
  {
    key: 'hormuz',
    label: 'Strait of Hormuz',
    countries: ['IRN', 'OMN', 'ARE', 'SAU', 'IRQ', 'KWT'],
    keywords: ['hormuz', 'strait of hormuz', 'gulf tanker', 'oil tanker', 'lng tanker', 'crude cargo'],
    oilImportance: 1,
    gasImportance: 1
  },
  {
    key: 'red-sea',
    label: 'Red Sea / Bab el-Mandeb',
    countries: ['YEM', 'EGY', 'DJI', 'ERI', 'SAU', 'SOM'],
    keywords: ['red sea', 'bab el mandeb', 'aden', 'merchant vessel', 'shipping lane', 'container ship', 'houthi'],
    oilImportance: 0.42,
    gasImportance: 0.14
  },
  {
    key: 'black-sea',
    label: 'Black Sea',
    countries: ['UKR', 'RUS', 'TUR', 'ROU', 'BGR', 'GEO'],
    keywords: ['black sea', 'crimea', 'odessa', 'odesa', 'novorossiysk', 'grain corridor', 'port terminal'],
    oilImportance: 0.34,
    gasImportance: 0.12
  }
];

const TRANSIT_TERMS = ['tanker', 'shipping', 'lng', 'pipeline', 'terminal', 'port', 'refinery', 'cargo', 'vessel'];

function scoreTransitEvent(event) {
  const text = `${event?.headline || ''} ${event?.summary || ''} ${event?.snippet || ''} ${event?.url || ''}`.toLowerCase();
  const shippingHit = TRANSIT_TERMS.some((term) => text.includes(term));
  const energyHit = (event?.themes || []).some((theme) => String(theme).toUpperCase() === 'ENERGY');
  const shippingLaneHit = String(event?.sourceKind || '') === 'shipping-lane';
  return (
    0.7 +
    (event?.isViolent ? 1.2 : 0) +
    Math.max(0, Number(event?.conflictSeverity || 0) * 0.45) +
    Math.max(0, Number(event?.relevanceScore || 0) * 0.18) +
    (shippingHit ? 1.2 : 0) +
    (energyHit ? 0.7 : 0) +
    (shippingLaneHit ? 1.1 : 0)
  );
}

function deriveTransitRisk(events = []) {
  const recentEvents = (events || [])
    .filter(Boolean)
    .filter((event) => {
      const timestamp = Date.parse(event.timestamp || '');
      return Number.isFinite(timestamp) && (Date.now() - timestamp) <= (72 * 3_600_000);
    });

  const corridors = CORRIDOR_DEFS.map((corridor) => {
    const matches = recentEvents.filter((event) => {
      const text = `${event?.headline || ''} ${event?.summary || ''} ${event?.snippet || ''} ${event?.url || ''}`.toLowerCase();
      const countryHit = corridor.countries.includes(event?.countryIso3);
      const corridorKeywordHit = corridor.keywords.some((keyword) => text.includes(keyword));
      const shippingHit = TRANSIT_TERMS.some((term) => text.includes(term));
      const energyHit = (event?.themes || []).some((theme) => String(theme).toUpperCase() === 'ENERGY');
      const shippingLaneHit = String(event?.sourceKind || '') === 'shipping-lane';
      return corridorKeywordHit || (countryHit && (shippingHit || energyHit || shippingLaneHit));
    });

    const scoredMatches = matches
      .map((event) => scoreTransitEvent(event))
      .sort((left, right) => right - left);
    const peakSeverity = mean(scoredMatches.slice(0, 8));
    const densitySignal = Math.sqrt(matches.length) * 3.4;
    const violentBonus = matches.some((event) => event?.isViolent) ? 5 : 0;
    const liveLaneBonus = matches.some((event) => String(event?.sourceKind || '') === 'shipping-lane') ? 4 : 0;
    const score = clamp(
      (peakSeverity * 4.8) +
        densitySignal +
        violentBonus +
        liveLaneBonus,
      0,
      100
    );

    return {
      key: corridor.key,
      label: corridor.label,
      score: round(score, 1),
      oilImportance: corridor.oilImportance || 0,
      gasImportance: corridor.gasImportance || 0,
      eventCount: matches.length,
      highlights: matches
        .sort((left, right) => scoreTransitEvent(right) - scoreTransitEvent(left))
        .slice(0, 3)
        .map((event) => ({
          headline: event.headline || event.snippet || 'Transit signal',
          source: event.source || 'Kompass',
          countryIso3: event.countryIso3,
          url: event.url || ''
        }))
    };
  });

  const overallScore = clamp(
    (Math.max(...corridors.map((item) => item.score), 0) * 0.58) +
      (mean(corridors.map((item) => item.score)) * 0.42),
    0,
    100
  );

  return {
    score: round(overallScore, 1),
    level: buildRiskLevel(overallScore).label,
    corridors,
    shippingEventCount: corridors.reduce((sum, item) => sum + item.eventCount, 0)
  };
}

function weightedCorridorStress(corridors, importanceKey) {
  const weighted = (corridors || [])
    .map((corridor) => {
      const importance = Number(corridor?.[importanceKey] || 0);
      if (!importance) {
        return null;
      }
      return {
        weightedScore: Number(corridor.score || 0) * importance,
        importance
      };
    })
    .filter(Boolean);

  if (!weighted.length) {
    return 0;
  }

  const weightedScore = weighted.reduce((sum, item) => sum + item.weightedScore, 0);
  const totalImportance = weighted.reduce((sum, item) => sum + item.importance, 0);
  return totalImportance ? weightedScore / totalImportance : 0;
}

function buildDrivers(definitions) {
  return definitions
    .filter((item) => Number.isFinite(Number(item.score)))
    .map((item) => ({
      label: item.label,
      score: round(item.score, 1),
      detail: item.detail
    }));
}

function buildStats(definitions) {
  return definitions
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
    .map((item) => ({
      label: item.label,
      value: item.value,
      detail: item.detail || ''
    }));
}

function buildCard({ key, title, score, summary, explanation, methodology, stats, drivers, updatedAt }) {
  const level = buildRiskLevel(score);
  return {
    key,
    title,
    score: round(score, 1),
    level: level.label,
    updatedAt,
    summary,
    explanation,
    methodology,
    stats,
    drivers
  };
}

function buildResourceProfile({ snapshot, oilInventory, gasStorage, recentEvents = [] }) {
  const snapshotTimestamp = snapshot?.timestamp || new Date().toISOString();
  const oilChange = Number(snapshot?.oil?.changePercent || 0);
  const oilValue = Number(snapshot?.oil?.value || 0);
  const gasChange = Number(snapshot?.naturalGas?.changePercent || 0);
  const gasValue = Number(snapshot?.naturalGas?.value || 0);
  const ovxValue = Number(snapshot?.ovx?.value || 0);
  const supplyCommodityStress = clamp(
    42 +
      Math.max(0, oilChange * 9) +
      Math.max(0, gasChange * 10) +
      Math.max(0, Number(snapshot?.gold?.changePercent || 0) * 5.5) +
      Math.max(0, Number(snapshot?.silver?.changePercent || 0) * 4.5) +
      Math.max(0, Number(snapshot?.wheat?.changePercent || 0) * 4),
    0,
    100
  );

  const transitRisk = deriveTransitRisk(recentEvents);
  const corridorLookup = Object.fromEntries(
    (transitRisk.corridors || []).map((corridor) => [corridor.key, corridor])
  );
  const hormuzCorridor = corridorLookup.hormuz || { score: 0 };
  const oilTransitStressBase = weightedCorridorStress(transitRisk.corridors, 'oilImportance');
  const gasTransitStressBase = weightedCorridorStress(transitRisk.corridors, 'gasImportance');

  const oilInventoryTightness = clamp(
    48 -
      ((Number(oilInventory?.stockDeltaVsYearAgoPct) || 0) * 1.7) -
      ((Number(oilInventory?.daysCoverDeltaPct) || 0) * 1.5) +
      Math.max(0, (30 - Number(oilInventory?.daysCover || 0)) * 2.2),
    5,
    95
  );
  const oilPriceStress = clamp(
    38 +
      Math.max(0, oilChange * 11) +
      Math.max(0, (ovxValue - 34) * 1.2),
    0,
    100
  );
  const oilLevelStress = clamp(Math.max(0, oilValue - 78) * 1.15, 0, 100);
  const oilClosurePremium =
    Number(hormuzCorridor.score || 0) >= 60
      ? clamp(
          ((Number(hormuzCorridor.score || 0) - 60) * 1.25) +
            Math.max(0, oilValue - 90) * 0.55,
          0,
          24
        )
      : 0;
  const oilTransitStress = clamp(
    (oilTransitStressBase * 0.74) +
      (Number(transitRisk.score || 0) * 0.26) +
      oilClosurePremium,
    0,
    100
  );
  const oilPressureScore = clamp(
    Math.max(
      (oilInventoryTightness * 0.24) +
        (oilPriceStress * 0.18) +
        (oilLevelStress * 0.1) +
        (oilTransitStress * 0.48),
      (oilTransitStress * 0.65) +
        (oilPriceStress * 0.18) +
        (oilLevelStress * 0.14)
    ),
    0,
    100
  );

  const gasStorageTightness = clamp(
    50 -
      ((Number(gasStorage?.vsFiveYearPct) || 0) * 2.1) -
      ((Number(gasStorage?.vsYearAgoPct) || 0) * 1.1) -
      (Math.max(0, Number(gasStorage?.netChangeBcf || 0)) * 0.06) +
      Math.max(0, -Number(gasStorage?.fiveYearDiffBcf || 0) * 0.025),
    5,
    95
  );
  const gasPriceStress = clamp(
    42 +
      Math.max(0, gasChange * 15) +
      Math.max(0, (Number(snapshot?.vix?.value || 0) - 18) * 1.4),
    0,
    100
  );
  const gasGlobalDislocationStress = clamp(
    Math.max(0, gasValue - 2.2) * 28 +
      Math.max(0, oilValue - 95) * 1.1,
    0,
    100
  );
  const gasDislocationPremium =
    Number(hormuzCorridor.score || 0) >= 70
      ? clamp(
          ((Number(hormuzCorridor.score || 0) - 70) * 0.55) +
            Math.max(0, gasValue - 2.5) * 7,
          0,
          14
        )
      : 0;
  const gasTransitStress = clamp(
    (gasTransitStressBase * 0.74) +
      (Number(transitRisk.score || 0) * 0.26) +
      gasDislocationPremium,
    0,
    100
  );
  const gasPressureScore = clamp(
    Math.max(
      (gasStorageTightness * 0.31) +
        (gasPriceStress * 0.16) +
        (gasGlobalDislocationStress * 0.1) +
        (gasTransitStress * 0.43),
      (gasTransitStress * 0.58) +
        (gasPriceStress * 0.2) +
        (gasGlobalDislocationStress * 0.22)
    ),
    0,
    100
  );

  const supplyShockScore = clamp(
    Math.max(
      (oilPressureScore * 0.4) +
        (gasPressureScore * 0.26) +
        (supplyCommodityStress * 0.14) +
        (Number(transitRisk.score || 0) * 0.2),
      (Number(transitRisk.score || 0) * 0.32) +
        (Math.max(oilPressureScore, gasPressureScore) * 0.42) +
        (supplyCommodityStress * 0.18)
    ),
    0,
    100
  );

  const topTransitLane = transitRisk.corridors
    .slice()
    .sort((left, right) => right.score - left.score)[0];

  return {
    source: oilInventory?.source && gasStorage?.source ? 'live' : 'partial',
    updatedAt: new Date().toISOString(),
    oilInventory,
    gasStorage,
    transitRisk,
    cards: {
      supplyShock: buildCard({
        key: 'supplyShock',
        title: 'Supply shock baseline',
        score: supplyShockScore,
        updatedAt: resolveLatestTimestamp([
          snapshotTimestamp,
          oilInventory?.updatedAt,
          gasStorage?.updatedAt
        ]),
        summary:
          `Broad supply pressure is ${buildRiskLevel(supplyShockScore).label}. The model blends crude inventory cover, gas storage tightness, corridor disruption risk, and hard-asset stress.`,
        explanation:
          `${topTransitLane?.label || 'Energy corridors'} currently carries the heaviest transit pressure, while oil pressure sits at ${round(oilPressureScore, 1)} and gas pressure at ${round(gasPressureScore, 1)}. This is a live supply-shock proxy, not a literal count of every tanker or reserve tank on earth.`,
        methodology:
          'Weighted blend: oil pressure 45%, gas pressure 35%, broader commodity/safe-haven stress 20%. The card is meant to answer whether energy logistics and reserve buffers look increasingly fragile right now.',
        stats: buildStats([
          { label: 'Oil pressure', value: `${round(oilPressureScore, 1)} / 100` },
          { label: 'Gas pressure', value: `${round(gasPressureScore, 1)} / 100` },
          { label: 'Transit risk', value: `${round(transitRisk.score, 1)} / 100`, detail: `${transitRisk.shippingEventCount} recent shipping-linked conflict signals` },
          { label: 'Commodity stress', value: `${round(supplyCommodityStress, 1)} / 100` }
        ]),
        drivers: buildDrivers([
          { label: 'Oil inventory and cover', score: oilPressureScore, detail: `Commercial crude ${formatSigned(oilInventory?.stockDeltaVsYearAgoPct, 1, '%')} vs year ago; ${round(oilInventory?.daysCover, 1) ?? '--'} days refinery cover.` },
          { label: 'Gas storage tightness', score: gasStorageTightness, detail: `Storage ${formatSigned(gasStorage?.vsFiveYearPct, 1, '%')} versus five-year average.` },
          { label: 'Transit chokepoint pressure', score: transitRisk.score, detail: `${topTransitLane?.label || 'Corridor watch'} leads the current corridor risk stack.` },
          { label: 'Commodity spillover', score: supplyCommodityStress, detail: 'Oil, gas, metals, and wheat are used as a fast market proxy for supply-chain stress.' }
        ])
      }),
      oilPressure: buildCard({
        key: 'oilPressure',
        title: 'Oil pressure baseline',
        score: oilPressureScore,
        updatedAt: resolveLatestTimestamp([
          snapshotTimestamp,
          oilInventory?.updatedAt
        ]),
        summary:
          `Oil pressure is ${buildRiskLevel(oilPressureScore).label}. Commercial crude stocks and refinery cover are the anchor, but severe Hormuz and Red Sea stress can now keep the score elevated before inventories visibly drain.`,
        explanation:
          `Commercial crude stands at ${round(oilInventory?.currentStocksMb, 1) ?? '--'} million barrels, ${formatSigned(oilInventory?.stockDeltaVsYearAgoPct, 1, '%')} versus last year, with roughly ${round(oilInventory?.daysCover, 1) ?? '--'} days of refinery cover. The model now leans harder on corridor-specific oil exposure because official EIA outlooks have treated Strait of Hormuz disruptions as globally material long before inventories hit outright shortage territory.`,
        methodology:
          'Oil pressure is a proxy for how uncomfortable the crude system looks, not a perfect world reserve count. Inputs: U.S. commercial stocks, refinery input, days-cover delta, absolute oil level, OVX/oil move, and corridor-weighted risk from Hormuz, Red Sea, and Black Sea reporting, with Hormuz carrying the largest oil weight.',
        stats: buildStats([
          { label: 'Commercial crude', value: `${round(oilInventory?.currentStocksMb, 1) ?? '--'} mb` },
          { label: 'Days cover', value: `${round(oilInventory?.daysCover, 1) ?? '--'} days`, detail: `vs ${round(oilInventory?.yearAgoDaysCover, 1) ?? '--'} year-ago days` },
          { label: 'Refinery input', value: `${round(oilInventory?.refineryInputKbd, 0) ?? '--'} kb/d` },
          { label: 'Net imports', value: `${round(oilInventory?.netImportsKbd, 0) ?? '--'} kb/d` },
          { label: 'Transit-adjusted risk', value: `${round(oilTransitStress, 1)} / 100`, detail: `${topTransitLane?.label || 'Corridor watch'} is leading the oil corridor stack` }
        ]),
        drivers: buildDrivers([
          { label: 'Inventory tightness', score: oilInventoryTightness, detail: `Commercial stocks ${formatSigned(oilInventory?.stockDeltaVsYearAgoPct, 1, '%')} vs last year.` },
          { label: 'Days-cover stress', score: clamp(50 - (Number(oilInventory?.daysCoverDeltaPct || 0) * 1.8), 0, 100), detail: `Refinery cover ${formatSigned(oilInventory?.daysCoverDeltaPct, 1, '%')} against year-ago cover.` },
          { label: 'Oil/OVX shock', score: oilPriceStress, detail: `WTI ${formatSigned(oilChange, 2, '%')} today with OVX at ${round(ovxValue, 1) ?? '--'}.` },
          { label: 'Absolute price stress', score: oilLevelStress, detail: `WTI spot is ${round(oilValue, 2) ?? '--'} right now.` },
          { label: 'Transit risk', score: oilTransitStress, detail: `${topTransitLane?.label || 'Corridor'} is the current top choke-point risk lane.` }
        ])
      }),
      gasPressure: buildCard({
        key: 'gasPressure',
        title: 'Gas pressure baseline',
        score: gasPressureScore,
        updatedAt: resolveLatestTimestamp([
          snapshotTimestamp,
          gasStorage?.updatedAt
        ]),
        summary:
          `Gas pressure is ${buildRiskLevel(gasPressureScore).label}. Underground storage versus the five-year norm still matters, but LNG corridor stress and cross-basin dislocation now have more influence when Hormuz is unstable.`,
        explanation:
          `Working gas in storage is ${round(gasStorage?.currentBcf, 0) ?? '--'} Bcf, ${formatSigned(gasStorage?.vsFiveYearPct, 1, '%')} versus the five-year average and ${formatSigned(gasStorage?.vsYearAgoPct, 1, '%')} versus last year. Large storage buffers still calm the score, but the model now gives more weight to LNG-route stress because official EIA outlooks have flagged Hormuz disruption as globally relevant for gas pricing and spread dislocation too.`,
        methodology:
          'Gas pressure uses weekly EIA storage data as the structural anchor. It is then adjusted by live natural-gas price moves, absolute gas/oil stress, and corridor-weighted LNG anxiety, with Hormuz receiving the heaviest gas weight and Red Sea/Black Sea acting as spillover lanes.',
        stats: buildStats([
          { label: 'Working gas', value: `${round(gasStorage?.currentBcf, 0) ?? '--'} Bcf` },
          { label: '5Y average', value: `${round(gasStorage?.fiveYearAvgBcf, 0) ?? '--'} Bcf` },
          { label: 'Weekly flow', value: `${formatSigned(gasStorage?.netChangeBcf, 0, ' Bcf')}` },
          { label: 'Natural gas', value: `${formatSigned(gasChange, 2, '%')}`, detail: 'Front-month daily move' },
          { label: 'LNG corridor stress', value: `${round(gasTransitStress, 1)} / 100`, detail: `${topTransitLane?.label || 'Corridor watch'} is leading the LNG spillover stack` }
        ]),
        drivers: buildDrivers([
          { label: 'Storage tightness', score: gasStorageTightness, detail: `Storage ${formatSigned(gasStorage?.vsFiveYearPct, 1, '%')} versus the five-year average.` },
          { label: 'Year-on-year buffer', score: clamp(50 - (Number(gasStorage?.vsYearAgoPct || 0) * 1.4), 0, 100), detail: `Storage ${formatSigned(gasStorage?.vsYearAgoPct, 1, '%')} against last year.` },
          { label: 'Gas price shock', score: gasPriceStress, detail: `Natural gas moved ${formatSigned(gasChange, 2, '%')} in the latest session.` },
          { label: 'Global dislocation', score: gasGlobalDislocationStress, detail: `Spot gas at ${round(gasValue, 2) ?? '--'} with crude at ${round(oilValue, 2) ?? '--'} keeps LNG anxiety active.` },
          { label: 'Transit spillover', score: gasTransitStress, detail: 'Shipping-lane disruption can tighten LNG expectations before storage visibly changes.' }
        ])
      })
    }
  };
}

module.exports = {
  buildResourceProfile,
  buildRiskLevel,
  deriveTransitRisk,
  parseGasStorageData,
  parseOilInventoryData
};
