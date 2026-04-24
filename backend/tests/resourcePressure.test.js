const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildResourceProfile,
  deriveTransitRisk,
  parseGasStorageData,
  parseOilInventoryData
} = require('../services/resourcePressure');

const TABLE4_SAMPLE = `"STUB_1","4/3/26","3/27/26","Difference","4/4/25","Percent Change","4/5/24","Percent Change"
"Crude Oil","878.042","876.700","1.342","839.055","4.600","821.494","6.900"
"Commercial (Excluding SPR)","464.717","461.636","3.081","442.345","5.100","457.258","1.600"
"SPR","413.325","415.064","-1.739","396.710","4.200","364.236","13.500"
"Total Stocks (Excluding SPR)","1,274.922","1,273.599","1.323","1,210.700","5.300","1,227.499","3.900"`;

const TABLE1_SAMPLE = `"STUB_1","4/3/26","3/27/26","Difference","Percent Change","4/4/25","Difference","4/3/26","4/4/25","Percent Change","4/3/26","4/4/25","Percent Change"
"Crude Oil","878.042","876.700","1.342","0.200","839.055","38.987","4.600"
"STUB_1","STUB_2","4/3/26","3/27/26","Difference","4/4/25","Difference","4/3/26","4/4/25","Percent Change","4/3/26","4/4/25","Percent Change"
"Crude Oil Supply ","(1)     Domestic Production","13,596","13,657","-61","13,458","138","13,645","13,546","0.7","13,655","13,497","1.2"
"Crude Oil Supply ","(7)     Net Imports (Including SPR)","2,175","2,933","-758","2,945","-770","2,637","1,964","34.2","2,454","2,097","17.0"
"Crude Oil Supply ","(14)       Commercial Stock Change","440","779","-338","365","75","772","254","--","490","295","--"
"Crude Oil Supply ","(17)   Crude Oil Input to Refineries","16,250","16,379","-129","15,627","622","16,365","15,650","4.6","16,239","15,642","3.8"`;

const GAS_HTML_SAMPLE = `
<h2>Weekly Natural Gas Storage Report</h2>
<p><strong> for week ending April 3, 2026 </strong>
&nbsp;&nbsp;|&nbsp;&nbsp;
<strong>Released:</strong>&nbsp;April 9, 2026 at 10:30 a.m.
</p>
<p>Working gas in storage was 1,911 Bcf as of Friday, April 3, 2026, according to EIA estimates. This represents a net increase of 50 Bcf from the previous week. Stocks were 89 Bcf higher than last year at this time and 87 Bcf above the five-year average of 1,824 Bcf. At 1,911 Bcf, total working gas is within the five-year historical range.</p>
`;

test('parseOilInventoryData extracts inventory and days-cover fields', () => {
  const parsed = parseOilInventoryData(TABLE1_SAMPLE, TABLE4_SAMPLE);

  assert.equal(parsed.currentStocksMb, 464.717);
  assert.equal(parsed.refineryInputKbd, 16250);
  assert.equal(parsed.netImportsKbd, 2175);
  assert.ok(parsed.daysCover > 28);
  assert.ok(parsed.stockDeltaVsYearAgoPct > 5);
});

test('parseGasStorageData extracts current, deltas, and five-year comparison', () => {
  const parsed = parseGasStorageData(GAS_HTML_SAMPLE);

  assert.equal(parsed.currentBcf, 1911);
  assert.equal(parsed.netChangeBcf, 50);
  assert.equal(parsed.fiveYearAvgBcf, 1824);
  assert.equal(parsed.yearAgoBcf, 1822);
  assert.equal(parsed.withinFiveYearRange, true);
});

test('buildResourceProfile turns structural data and conflict lanes into scored cards', () => {
  const resourceProfile = buildResourceProfile({
    snapshot: {
      oil: { changePercent: 2.1 },
      naturalGas: { changePercent: 3.4 },
      ovx: { value: 48.2 },
      vix: { value: 24.1 },
      gold: { changePercent: 1.2 },
      silver: { changePercent: 0.7 },
      wheat: { changePercent: 2.4 }
    },
    oilInventory: parseOilInventoryData(TABLE1_SAMPLE, TABLE4_SAMPLE),
    gasStorage: parseGasStorageData(GAS_HTML_SAMPLE),
    recentEvents: [
      {
        countryIso3: 'YEM',
        headline: 'Drone attack forces tanker reroute in Red Sea corridor',
        summary: 'Shipping lane disruption and refinery anxiety are rising.',
        timestamp: new Date().toISOString(),
        isViolent: true,
        conflictSeverity: 4.5,
        relevanceScore: 5.1
      }
    ]
  });

  assert.ok(resourceProfile.cards.supplyShock.score > 0);
  assert.ok(resourceProfile.cards.oilPressure.score > 0);
  assert.ok(resourceProfile.cards.gasPressure.score > 0);
  assert.match(resourceProfile.cards.supplyShock.updatedAt, /T/);
  assert.match(resourceProfile.cards.oilPressure.updatedAt, /T/);
  assert.match(resourceProfile.cards.gasPressure.updatedAt, /T/);
  assert.match(resourceProfile.cards.oilPressure.explanation, /commercial crude/i);
  assert.match(resourceProfile.cards.gasPressure.explanation, /working gas/i);
});

test('deriveTransitRisk emphasizes active choke points', () => {
  const risk = deriveTransitRisk([
    {
      countryIso3: 'IRN',
      headline: 'Missile alert near Strait of Hormuz shipping lane',
      summary: 'Oil tanker insurance costs rise after strike warning.',
      timestamp: new Date().toISOString(),
      isViolent: true,
      conflictSeverity: 3.8,
      relevanceScore: 4.9
    }
  ]);

  assert.ok(risk.score > 0);
  assert.equal(risk.corridors[0].label, 'Strait of Hormuz');
});

test('buildResourceProfile keeps oil and gas elevated when Hormuz stress is extreme', () => {
  const baseEvents = [
    ['IRN', 'Missile warning pushes tanker traffic away from the Strait of Hormuz'],
    ['OMN', 'LNG tanker insurance spikes during Strait of Hormuz disruption'],
    ['ARE', 'Crude cargo traffic slows near Hormuz after new strike alerts'],
    ['KWT', 'Oil tanker queues lengthen near Hormuz after naval clash'],
    ['IRQ', 'Terminal exports disrupted as Hormuz convoy security tightens'],
    ['SAU', 'Refinery and crude cargo routing adjusted after Hormuz warning']
  ];
  const resourceProfile = buildResourceProfile({
    snapshot: {
      oil: { value: 104.4, changePercent: 5.6 },
      naturalGas: { value: 2.68, changePercent: 2.9 },
      ovx: { value: 69.3 },
      vix: { value: 21.1 },
      gold: { changePercent: 1.9 },
      silver: { changePercent: 1.1 },
      wheat: { changePercent: 0.8 }
    },
    oilInventory: parseOilInventoryData(TABLE1_SAMPLE, TABLE4_SAMPLE),
    gasStorage: parseGasStorageData(GAS_HTML_SAMPLE),
    recentEvents: Array.from({ length: 12 }, (_, index) => {
      const [countryIso3, headline] = baseEvents[index % baseEvents.length];
      return {
        countryIso3,
        headline,
        summary: 'Energy cargo operators warn of severe corridor instability for tanker and LNG traffic.',
        timestamp: new Date().toISOString(),
        isViolent: true,
        conflictSeverity: 7.2,
        relevanceScore: 8.1,
        sourceKind: 'shipping-lane',
        themes: ['ENERGY']
      };
    })
  });

  assert.ok(resourceProfile.cards.oilPressure.score >= 65);
  assert.ok(resourceProfile.cards.gasPressure.score >= 50);
});
