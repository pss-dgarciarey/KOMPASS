const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger } = require('../lib/logger');
const { ConflictService } = require('../services/conflictService');

function createService(state = {}) {
  let fetchCalls = 0;
  const service = new ConflictService({
    cache: {
      async wrap(_key, fn) {
        return fn();
      }
    },
    logger: createLogger('error'),
    state,
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async text() {
          return '';
        },
        async json() {
          return {};
        }
      };
    },
    services: {}
  });

  return {
    service,
    getFetchCalls: () => fetchCalls
  };
}

test('ConflictService keeps Myanmar context countries explicit-only', () => {
  const { service } = createService();
  const conflict = service.getRegistry().find((entry) => entry.slug === 'myanmar');

  const genericIndiaEvent = {
    id: 'generic-ind',
    timestamp: new Date().toISOString(),
    countryIso3: 'IND',
    headline: 'Security talks continue in New Delhi',
    summary: 'Domestic political meeting in India with no cross-border war linkage.',
    themes: ['SECURITY'],
    geopoliticalBias: 5,
    conflictSeverity: 3
  };

  const linkedIndiaEvent = {
    id: 'linked-ind',
    timestamp: new Date().toISOString(),
    countryIso3: 'IND',
    headline: 'India reviews Myanmar refugee pressure after junta airstrikes',
    summary: 'Officials discuss the Myanmar war and cross-border flows.',
    themes: ['SECURITY'],
    geopoliticalBias: 6,
    conflictSeverity: 3.5
  };

  const myanmarCoreEvent = {
    id: 'core-mmr',
    timestamp: new Date().toISOString(),
    countryIso3: 'MMR',
    headline: 'Airstrike hits resistance-held area in Sagaing',
    summary: 'Myanmar junta attack reported in the current war zone.',
    themes: ['SECURITY'],
    isConflictRelevant: true,
    conflictSeverity: 4.2
  };

  const genericChinaEvent = {
    id: 'generic-chn',
    timestamp: new Date().toISOString(),
    countryIso3: 'CHN',
    headline: 'China manufacturing data beats expectations',
    summary: 'Domestic China economy story with no conflict linkage.',
    themes: ['ECONOMY'],
    geopoliticalBias: 5,
    conflictSeverity: 3
  };

  assert.equal(service.matchConflict(genericIndiaEvent, conflict), false);
  assert.equal(service.matchConflict(genericChinaEvent, conflict), false);
  assert.equal(service.matchConflict(linkedIndiaEvent, conflict), true);
  assert.equal(service.matchConflict(myanmarCoreEvent, conflict), true);
});

test('ConflictService avoids ambiguous Myanmar alias matches from unrelated names or file terms', () => {
  const { service } = createService();
  const conflict = service.getRegistry().find((entry) => entry.slug === 'myanmar');

  const karenNameEvent = {
    id: 'karen-name',
    timestamp: new Date().toISOString(),
    countryIso3: 'ISR',
    headline: 'Lt. Col. Karen Smith discusses Hormuz blockade risk',
    summary: 'Middle East interview with no Southeast Asia war linkage.',
    themes: ['SECURITY'],
    geopoliticalBias: 6,
    conflictSeverity: 3.8
  };

  const pdfEvent = {
    id: 'pdf-doc',
    timestamp: new Date().toISOString(),
    countryIso3: 'USA',
    headline: 'Agency publishes PDF handbook for customs officers',
    summary: 'Administrative document release with no civil-war content.',
    themes: ['POLITICS'],
    geopoliticalBias: 4,
    conflictSeverity: 3
  };

  assert.equal(service.matchConflict(karenNameEvent, conflict), false);
  assert.equal(service.matchConflict(pdfEvent, conflict), false);
});

test('ConflictService uses curated source deck metadata without fetching remote pages', async () => {
  const { service, getFetchCalls } = createService();
  const conflict = service.getRegistry().find((entry) => entry.slug === 'myanmar');

  const sourceDeck = await service.buildSourceDeck(conflict);

  assert.equal(getFetchCalls(), 0);
  assert.equal(sourceDeck[0].label, 'Myanmar LiveUAMap');
  assert.match(sourceDeck[0].summary, /Myanmar fighting/i);
});

test('ConflictService returns conflict history and map scope in detail payload', async () => {
  const { service } = createService({
    eventArchive: [],
    recentEvents: []
  });

  const payload = await service.getConflict('myanmar');

  assert.deepEqual(payload.conflict.mapCountries, ['MMR']);
  assert.equal(payload.conflict.history.updatedAt, 'April 14, 2026');
  assert.ok(Array.isArray(payload.conflict.history.timeline));
});
