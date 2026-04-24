const test = require('node:test');
const assert = require('node:assert/strict');
const { createExplainService } = require('../services/explainService');
const { createLogger } = require('../lib/logger');
const { createMetricsRegistry } = require('../lib/metrics');

test('ExplainService returns deterministic narrative with keywords and themes', () => {
  const service = createExplainService({
    logger: createLogger('error'),
    metrics: createMetricsRegistry()
  });

  const result = service.buildExplanation({
    currentAvgTone: -4,
    previousAvgTone: -1,
    goldstein: -5,
    events: [
      {
        avgTone: -4,
        goldstein: -5,
        themes: ['ECONOMY', 'INFLATION'],
        snippet: 'Inflation pressure sparks market anxiety'
      },
      {
        avgTone: -3,
        goldstein: -4,
        themes: ['ECONOMY', 'POLITICS'],
        snippet: 'Political gridlock intensifies fiscal pressure'
      }
    ]
  });

  assert.match(result.explanation, /intensifying/i);
  assert.ok(result.topThemes.includes('ECONOMY'));
  assert.ok(result.keywords.length > 0);
  assert.ok(Array.isArray(result.topConflictTags));
});
