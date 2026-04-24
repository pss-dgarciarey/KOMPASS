import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../src/components/MapComponent', () => ({
  default: function MockMapComponent(props) {
    return (
      <div data-testid="mock-map-component">
        {props.title || 'Mock map'}
      </div>
    );
  }
}));

import App from '../src/App';

function buildResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    }
  };
}

test('renders dashboard title and loads fallback-safe widgets', async () => {
  global.fetch = async (url, options = {}) => {
    if (options.method === 'POST' && String(url).includes('/api/explain')) {
      return buildResponse({
        ok: true,
        explanation: 'Sentiment looks comparatively stable.',
        topThemes: ['ECONOMY'],
        keywords: ['inflation'],
        confidence: 0.7
      });
    }

    if (String(url).includes('/api/metrics')) {
      return buildResponse({
        ok: true,
        currentGlobal: { avgTone: -2.2, goldstein: -1.1, eventCount: 8, topThemes: ['ECONOMY'] },
        globalSeries: [{ timestamp: new Date().toISOString(), avgTone: -2.2 }],
        regions: [{ region: 'USA', avgTone: -4.2, goldstein: -3.6, eventCount: 7, topThemes: ['ECONOMY'], sourceCount: 3, conflictScore: 5.2 }],
        trailing24hRegions: [{ region: 'USA', avgTone: -3.8, goldstein: -2.4, eventCount: 11, topThemes: ['ECONOMY'], sourceCount: 4, conflictScore: 5.9 }],
        trailing7dRegions: [{ region: 'USA', avgTone: -2.6, goldstein: -1.7, eventCount: 21, topThemes: ['ECONOMY'], sourceCount: 5, conflictScore: 4.4 }],
        marketMoodSeries: [{ timestamp: new Date().toISOString(), mood: 54 }],
        kgpiSeries: [{ timestamp: new Date().toISOString(), score: 54 }]
      });
    }

    if (String(url).includes('/api/top-events')) {
      return buildResponse({
        ok: true,
        items: [
          {
            id: 'evt-1',
            countryIso3: 'USA',
            avgTone: -4.2,
            goldstein: -3.1,
            toneDelta: -1.8,
            snippet: 'US stress test headline',
            source: 'MockWire',
            timestamp: new Date().toISOString(),
            themes: ['ECONOMY']
          }
        ]
      });
    }

    if (String(url).includes('/api/finance')) {
      return buildResponse({
        ok: true,
        snapshot: {
          source: 'live',
          marketMood: { score: 54, label: 'balanced' },
          fearGreedCrypto: { value: 58, classification: 'Neutral' }
        },
        history: {
          points: [],
          series: { mood: [54], vix: [20], sp500: [5200], btc: [67000], gold: [2300], oil: [78] }
        }
      });
    }

    if (String(url).includes('/api/correlations')) {
      return buildResponse({
        ok: true,
        indicators: { mood: { coefficient: 0.4, significance: 'moderate' } },
        insight: 'Global AvgTone currently moves with MOOD over the selected window.'
      });
    }

    if (String(url).includes('/api/alerts')) {
      return buildResponse({
        ok: true,
        recentTriggers: []
      });
    }

    if (String(url).includes('/api/conflicts/iran-israel-us')) {
      return buildResponse({
        ok: true,
        conflict: {
          slug: 'iran-israel-us',
          title: 'Iran / Israel / U.S.',
          summary: 'Regional strike cycle.',
          countries: ['IRN', 'ISR', 'USA'],
          overview: {
            incidentCount: 5,
            sourceCount: 3,
            countryCount: 3,
            pressure: 4.8
          },
          sourceDeck: [],
          incidents: []
        }
      });
    }

    if (String(url).includes('/api/conflicts')) {
      return buildResponse({
        ok: true,
        featured: 'iran-israel-us',
        conflicts: [
          {
            slug: 'iran-israel-us',
            title: 'Iran / Israel / U.S.',
            summary: 'Regional strike cycle.',
            countries: ['IRN', 'ISR', 'USA'],
            overview: {
              incidentCount: 5,
              sourceCount: 3,
              countryCount: 3,
              pressure: 4.8
            }
          }
        ]
      });
    }

    return buildResponse({ ok: true });
  };

  render(<App />);

  expect(screen.getByText('Kompass \u2014 Global Pulse Monitor')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText('One map, three temporal lenses')).toBeInTheDocument();
  });
});
