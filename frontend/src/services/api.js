const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const SESSION_PREFIX = 'kompass:';

function buildUrl(path, params = {}) {
  const base = API_BASE.replace(/\/$/, '');
  const href = base.startsWith('http')
    ? `${base}${path}`
    : `${window.location.origin}${base}${path}`;
  const url = new URL(href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function readCached(key) {
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${key}`);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCached(key, payload, ttlMs) {
  try {
    sessionStorage.setItem(
      `${SESSION_PREFIX}${key}`,
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        payload
      })
    );
  } catch {
    // Safari private mode and friends can be weird here. Not worth blocking the app over it.
  }
}

async function request(path, { method = 'GET', body, cacheKey, ttlMs = 45_000 } = {}) {
  if (method === 'GET' && cacheKey) {
    const cached = readCached(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const payload = await response.json();
    if (method === 'GET' && cacheKey) {
      writeCached(cacheKey, payload, ttlMs);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function getFallbackDashboard() {
  const fallbackNow = new Date().toISOString();
  return {
    health: {
      ok: true,
      ready: true,
      sources: {
        gdelt: 'mock',
        finance: 'mock'
      },
      lastFetches: {
        gdelt: null,
        finance: null
      },
      lastLiveFetches: {
        gdelt: null,
        finance: null
      },
      coverage: {
        gdelt: {
          countryCount: 2,
          sourceCount: 2,
          configuredGlobalCount: 15,
          configuredOutletCount: 12,
          configuredConflictOutletCount: 10,
          configuredPulseCount: 48,
          configuredFeedChannelCount: 91,
          requestCount: 4,
          successCount: 0,
          failureCount: 4,
          respondingOutletCount: 0,
          selectedConflictOutletCount: 5,
          respondingConflictOutletCount: 0,
          configuredShippingCount: 4,
          respondingShippingCount: 0,
          configuredSocialCount: 2,
          respondingSocialCount: 0,
          slices: ['US', 'DE', 'JP', 'BR']
        },
        finance: {
          sourceCount: 0,
          missingCount: 8,
          activeKgpiInputs: ['vix', 'fearGreedCrypto']
        }
      }
    },
    metrics: {
      ok: true,
      // This fallback payload is intentionally small. It is only here so the shell still renders
      // if the live API is having a bad minute.
      currentGlobal: {
        avgTone: -1.8,
        goldstein: -0.9,
        eventCount: 12,
        topThemes: ['ECONOMY', 'TRADE', 'POLITICS'],
        sourceCount: 1,
        configuredOutletCount: 12,
        topSources: [{ source: 'MockWire', eventCount: 12 }],
        countryCount: 2,
        dataSource: 'mock'
      },
      globalSeries: [],
      regions: [
        {
          region: 'USA',
          avgTone: -4.2,
          goldstein: -3.6,
          eventCount: 7,
          topThemes: ['ECONOMY'],
          sourceCount: 1,
          configuredOutletCount: 5,
          topSources: [{ source: 'MockWire', eventCount: 7 }],
          dataSource: 'mock',
          conflictScore: 6.4,
          heatScore: 5.9
        },
        {
          region: 'DEU',
          avgTone: 2.3,
          goldstein: 1.8,
          eventCount: 4,
          topThemes: ['ENERGY'],
          sourceCount: 1,
          configuredOutletCount: 5,
          topSources: [{ source: 'MockWire', eventCount: 4 }],
          dataSource: 'mock',
          conflictScore: 1.9,
          heatScore: 2.1
        }
      ],
      trailing24hRegions: [
        {
          region: 'USA',
          avgTone: -3.4,
          goldstein: -2.9,
          eventCount: 15,
          topThemes: ['ECONOMY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 15 }],
          dataSource: 'mock',
          conflictScore: 7.1,
          heatScore: 6.5,
          snapshotCount: 4
        },
        {
          region: 'DEU',
          avgTone: 1.8,
          goldstein: 1.1,
          eventCount: 9,
          topThemes: ['ENERGY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 9 }],
          dataSource: 'mock',
          conflictScore: 1.5,
          heatScore: 2.6,
          snapshotCount: 4
        }
      ],
      trailing7dRegions: [
        {
          region: 'USA',
          avgTone: -2.8,
          goldstein: -2.1,
          eventCount: 42,
          topThemes: ['ECONOMY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 42 }],
          dataSource: 'mock',
          conflictScore: 6.8,
          heatScore: 6.1,
          snapshotCount: 18
        },
        {
          region: 'DEU',
          avgTone: 1.4,
          goldstein: 0.8,
          eventCount: 27,
          topThemes: ['ENERGY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 27 }],
          dataSource: 'mock',
          conflictScore: 1.3,
          heatScore: 2.1,
          snapshotCount: 18
        }
      ],
      trailingRegions: [
        {
          region: 'USA',
          avgTone: -3.4,
          goldstein: -2.9,
          eventCount: 15,
          topThemes: ['ECONOMY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 15 }],
          dataSource: 'mock',
          conflictScore: 7.1,
          heatScore: 6.5,
          snapshotCount: 4
        },
        {
          region: 'DEU',
          avgTone: 1.8,
          goldstein: 1.1,
          eventCount: 9,
          topThemes: ['ENERGY'],
          sourceCount: 1,
          topSources: [{ source: 'MockWire', eventCount: 9 }],
          dataSource: 'mock',
          conflictScore: 1.5,
          heatScore: 2.6,
          snapshotCount: 4
        }
      ],
      marketMoodSeries: [],
      kgpiSeries: [],
      regionSnapshot: null
    },
    events: {
      ok: true,
      items: []
    },
    finance: {
      ok: true,
      snapshot: {
        source: 'mock',
        kgpi: { score: 52, label: 'balanced', components: {} },
        marketMood: { score: 52, label: 'balanced', components: {} },
        fearGreedCrypto: { value: 58, classification: 'Neutral' },
        resourceProfile: {
          cards: {
            supplyShock: {
              key: 'supplyShock',
              title: 'Supply shock baseline',
              score: 47,
              level: 'elevated',
              updatedAt: fallbackNow,
              summary: 'Fallback supply-shock proxy built from mock inventory and corridor stress.',
              explanation: 'This is a local fallback payload used when the live finance stack is unavailable.',
              methodology: 'Oil pressure, gas pressure, and commodity spillover are blended into a single supply-shock proxy.',
              stats: [
                { label: 'Oil pressure', value: '49 / 100' },
                { label: 'Gas pressure', value: '45 / 100' }
              ],
              drivers: [
                { label: 'Oil inventory and cover', score: 49, detail: 'Mock commercial-crude cover.' },
                { label: 'Gas storage tightness', score: 45, detail: 'Mock gas-storage comparison.' }
              ]
            },
            oilPressure: {
              key: 'oilPressure',
              title: 'Oil pressure baseline',
              score: 49,
              level: 'elevated',
              updatedAt: fallbackNow,
              summary: 'Fallback oil-pressure card.',
              explanation: 'Fallback oil inventory explanation.',
              methodology: 'Mock oil inventory and OVX inputs.',
              stats: [],
              drivers: []
            },
            gasPressure: {
              key: 'gasPressure',
              title: 'Gas pressure baseline',
              score: 45,
              level: 'elevated',
              updatedAt: fallbackNow,
              summary: 'Fallback gas-pressure card.',
              explanation: 'Fallback gas storage explanation.',
              methodology: 'Mock gas storage and price inputs.',
              stats: [],
              drivers: []
            }
          }
        }
      },
      history: { points: [], series: { mood: [] } }
    },
    correlations: {
      ok: true,
      indicators: {},
      insight: 'No recent data. Try refreshing or check your network.'
    },
    conflictsIndex: {
      featured: 'iran-israel-us',
      conflicts: [
        {
          slug: 'iran-israel-us',
          title: 'Iran / Israel / U.S.',
          summary: 'Regional strike cycle and spillover risk.',
          description: 'Regional strike cycle with direct battlefield states on the map and intervention states included only when explicitly tied to the theater.',
          countries: ['IRN', 'ISR', 'USA'],
          mapCountries: ['IRN', 'ISR'],
          overview: {
            incidentCount: 5,
            sourceCount: 3,
            countryCount: 3,
            pressure: 4.8
          }
        },
        {
          slug: 'russia-ukraine',
          title: 'Russia / Ukraine',
          summary: 'Frontline and deep-strike pressure.',
          description: 'Core battlefield around Ukraine and Russia, with nearby states treated as explicit spillover or logistics context only.',
          countries: ['RUS', 'UKR'],
          mapCountries: ['RUS', 'UKR'],
          overview: {
            incidentCount: 4,
            sourceCount: 2,
            countryCount: 2,
            pressure: 4.2
          }
        }
      ]
    },
    conflictDetails: {
      'iran-israel-us': {
        conflict: {
          slug: 'iran-israel-us',
          title: 'Iran / Israel / U.S.',
          summary: 'Regional strike cycle and spillover risk.',
          description: 'Regional strike cycle with direct battlefield states on the map and intervention states included only when explicitly tied to the theater.',
          countries: ['IRN', 'ISR', 'USA'],
          mapCountries: ['IRN', 'ISR'],
          overview: {
            incidentCount: 5,
            sourceCount: 3,
            countryCount: 3,
            pressure: 4.8
          },
          history: {
            updatedAt: 'April 14, 2026',
            summary: 'Fallback history while live conflict metadata is unavailable.',
            scopeNote: 'Core battlefield countries stay on the map; spillover states require explicit conflict linkage.',
            sections: [],
            timeline: [],
            sources: []
          },
          sourceDeck: [
            {
              key: 'iranstrike',
              label: 'IranStrike',
              kindLabel: 'Structured live',
              kind: 'structured-live',
              status: 'linked',
              summary: 'Reference placeholder until live feed loads.',
              detail: 'Manual source',
              url: 'https://iranstrike.com/',
              checkedAt: new Date().toISOString()
            }
          ],
          incidents: [
            {
              id: 'mock-conflict-1',
              headline: 'Rocket and missile alerts continue along the northern confrontation line',
              summary: 'Fallback incident card used when the live external conflict stack is unavailable.',
              timestamp: new Date().toISOString(),
              location: 'Israel',
              source: 'MockWire',
              sourceCount: 2,
              confidence: 0.72,
              tags: ['MISSILE', 'AIR DEFENSE'],
              sourceKind: 'structured-live'
            }
          ]
        }
      },
      'russia-ukraine': {
        conflict: {
          slug: 'russia-ukraine',
          title: 'Russia / Ukraine',
          summary: 'Frontline and deep-strike pressure.',
          description: 'Core battlefield around Ukraine and Russia, with nearby states treated as explicit spillover or logistics context only.',
          countries: ['RUS', 'UKR'],
          mapCountries: ['RUS', 'UKR'],
          overview: {
            incidentCount: 4,
            sourceCount: 2,
            countryCount: 2,
            pressure: 4.2
          },
          history: {
            updatedAt: 'April 14, 2026',
            summary: 'Fallback history while live conflict metadata is unavailable.',
            scopeNote: 'Core battlefield countries stay on the map; spillover states require explicit conflict linkage.',
            sections: [],
            timeline: [],
            sources: []
          },
          sourceDeck: [],
          incidents: []
        }
      }
    }
  };
}

export const api = {
  async getHealth() {
    return request(buildUrl('/health'), {
      cacheKey: 'health',
      ttlMs: 4_000
    });
  },
  async getMetrics(params = {}) {
    return request(buildUrl('/metrics', params), {
      cacheKey: `metrics:${params.region || 'global'}:${params.since || '24h'}`
    });
  },
  async getRegionDetail(region, params = {}) {
    return request(buildUrl(`/regions/${encodeURIComponent(region)}`, params), {
      cacheKey: `region-detail:${region}:${params.since || '7d'}:${params.inspectionWindow || '72h'}`,
      ttlMs: 20_000
    });
  },
  async getTopEvents(params = {}) {
    return request(buildUrl('/top-events', params), {
      cacheKey: `events:${params.region || 'global'}:${params.window || '60m'}:${params.limit || 5}:${params.conflictOnly || '0'}`,
      ttlMs: 20_000
    });
  },
  async getFinance() {
    return request(buildUrl('/finance'), {
      cacheKey: 'finance',
      ttlMs: 4_000
    });
  },
  async getFinanceHistory(params = {}) {
    return request(buildUrl('/finance/history', params), {
      cacheKey: `finance-history:v2:${params.asset || 'kgpi'}:${params.range || '24h'}:${params.interval || 'auto'}`,
      ttlMs: 20_000
    });
  },
  async getCorrelations(params = {}) {
    return request(buildUrl('/correlations', params), {
      cacheKey: `correlations:${params.window || '6h'}`,
      ttlMs: 5_000
    });
  },
  async getAlerts() {
    return request(buildUrl('/alerts'), {
      cacheKey: 'alerts',
      ttlMs: 30_000
    });
  },
  async getConflicts() {
    return request(buildUrl('/conflicts'), {
      cacheKey: 'conflicts:index',
      ttlMs: 45_000
    });
  },
  async getConflict(slug) {
    return request(buildUrl(`/conflicts/${slug}`), {
      cacheKey: `conflicts:${slug}`,
      ttlMs: 45_000
    });
  },
  async explain(body) {
    return request(`${API_BASE}/explain`, {
      method: 'POST',
      body
    });
  }
};
