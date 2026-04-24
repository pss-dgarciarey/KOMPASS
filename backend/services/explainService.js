const STOPWORDS = new Set([
  'about',
  'activity',
  'after',
  'and',
  'before',
  'been',
  'city',
  'company',
  'could',
  'current',
  'fight',
  'from',
  'global',
  'has',
  'have',
  'headline',
  'headlines',
  'incident',
  'into',
  'keywords',
  'local',
  'near',
  'news',
  'notable',
  'pointing',
  'pressure',
  'reported',
  'reporting',
  'reports',
  'remains',
  'said',
  'say',
  'says',
  'signalprofile',
  'signals',
  'source',
  'sources',
  'should',
  'signal',
  'stable',
  'still',
  'such',
  'summary',
  'that',
  'the',
  'their',
  'there',
  'this',
  'tied',
  'tone',
  'transition',
  'while',
  'which',
  'will',
  'with',
  'would',
  'world',
  'window',
  'involving',
  'alongside',
  'reported',
  'security',
  'tension'
]);

function average(values) {
  const sample = values.filter(Number.isFinite);
  if (!sample.length) {
    return 0;
  }
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function normalizeInput(input = {}) {
  if (Array.isArray(input)) {
    return { events: input };
  }
  if (input.events) {
    return input;
  }
  if (input.items) {
    return { ...input, events: input.items };
  }
  return { events: [] };
}

function extractTopThemes(events) {
  const counts = new Map();
  for (const event of events) {
    for (const theme of event.themes || []) {
      const normalized = String(theme).trim();
      if (!normalized || normalized === 'HEADLINES') {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

function normalizeSignalToken(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

function contextTokens(contextLabel = '') {
  return new Set(
    String(contextLabel || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
  );
}

function extractKeywords(events, contextLabel = '', blockedTerms = []) {
  const counts = new Map();
  const contextualStopwords = contextTokens(contextLabel);
  const blocked = new Set(blockedTerms.map(normalizeSignalToken));

  for (const event of events) {
    const sourceText = [event.headline, event.summary, event.snippet, ...(event.themes || []), ...(event.conflictTags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const rawToken of sourceText.split(/[^a-z0-9]+/i)) {
      const token = rawToken.trim();
      if (
        token.length < 4 ||
        STOPWORDS.has(token) ||
        contextualStopwords.has(token) ||
        blocked.has(token)
      ) {
        continue;
      }
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([token]) => token);
}

function extractTopConflictTags(events) {
  const counts = new Map();
  for (const event of events) {
    for (const tag of event.conflictTags || []) {
      const normalized = String(tag).trim();
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag.replace(/_/g, ' ').toLowerCase());
}

function readableList(items = []) {
  const normalized = items
    .map((item) => normalizeSignalToken(item))
    .filter(Boolean);

  if (!normalized.length) {
    return '';
  }
  if (normalized.length === 1) {
    return normalized[0];
  }
  if (normalized.length === 2) {
    return `${normalized[0]} and ${normalized[1]}`;
  }
  return `${normalized.slice(0, -1).join(', ')}, and ${normalized.at(-1)}`;
}

function buildTemplate({ toneChange, currentAvgTone, goldstein, topThemes, keywords, topConflictTags, scope = 'global' }) {
  const themeText = topThemes.length ? readableList(topThemes) : 'mixed coverage';
  const conflictText = topConflictTags.length ? readableList(topConflictTags) : '';
  const keywordClause = keywords.length >= 2 ? ` Notable keywords: ${keywords.join(', ')}.` : '';
  const magnitude = Math.abs(toneChange);
  const regionScope = scope === 'region';

  if (toneChange <= -3 || goldstein < -4) {
    if (regionScope) {
      return conflictText
        ? `Regional pressure is rising. Tone fell by ${magnitude.toFixed(1)} points, and local coverage is concentrating around ${conflictText}.${keywordClause}`
        : `Regional pressure is rising. Tone fell by ${magnitude.toFixed(1)} points, with coverage clustering around ${themeText}.${keywordClause}`;
    }
    return conflictText
      ? `Pressure is intensifying. Tone fell by ${magnitude.toFixed(1)} points, with ${conflictText} increasingly dominating the feed.${keywordClause}`
      : `Pressure is intensifying. Tone fell by ${magnitude.toFixed(1)} points, with coverage rotating toward ${themeText}.${keywordClause}`;
  }

  if (toneChange >= 3 && goldstein > 2) {
    if (regionScope) {
      return `Regional conditions are easing. Tone climbed by ${magnitude.toFixed(1)} points, and the local mix now looks less stress-heavy.${keywordClause}`;
    }
    return `Conditions are easing. Tone climbed by ${magnitude.toFixed(1)} points, and the coverage mix looks less stress-heavy.${keywordClause}`;
  }

  if (Math.abs(toneChange) < 1.25) {
    if (regionScope) {
      return conflictText
        ? `The country signal is relatively steady. AvgTone sits near ${currentAvgTone.toFixed(1)}. Coverage still leans toward ${conflictText}, but without a fresh break in direction.${keywordClause}`
        : `The country signal is relatively steady. AvgTone sits near ${currentAvgTone.toFixed(1)}, with coverage still clustering around ${themeText}.${keywordClause}`;
    }
    return conflictText
      ? `The signal is comparatively steady. AvgTone is holding near ${currentAvgTone.toFixed(1)}, while ${conflictText} remains active in the mix.${keywordClause}`
      : `The signal is comparatively steady. AvgTone is holding near ${currentAvgTone.toFixed(1)}, with ${themeText} still setting the agenda.${keywordClause}`;
  }

  if (regionScope) {
    return `Regional conditions are shifting but not yet decisive. Tone moved by ${magnitude.toFixed(1)} points, and the local mix suggests a transition rather than a clean break.${keywordClause}`;
  }
  return `The backdrop is shifting but not yet decisive. Tone moved by ${magnitude.toFixed(1)} points, and coverage suggests a transition rather than a clean break.${keywordClause}`;
}

function computeConfidence({ events, topThemes, keywords, hasPrevious }) {
  const eventWeight = Math.min(0.45, events.length / 30);
  const themeWeight = Math.min(0.25, topThemes.length / 6);
  const keywordWeight = Math.min(0.2, keywords.length / 10);
  const historyWeight = hasPrevious ? 0.1 : 0;
  return Number((0.25 + eventWeight + themeWeight + keywordWeight + historyWeight).toFixed(2));
}

function createExplainService({ logger, metrics }) {
  return {
    buildExplanation(input = {}) {
      const normalized = normalizeInput(input);
      const events = normalized.events || [];
      const currentAvgTone =
        normalized.currentAvgTone ?? average(events.map((event) => event.avgTone));
      const previousAvgTone = normalized.previousAvgTone ?? currentAvgTone;
      const goldstein =
        normalized.goldstein ?? average(events.map((event) => event.goldstein));
      const toneChange = currentAvgTone - previousAvgTone;
      const topThemes = extractTopThemes(events);
      const topConflictTags = extractTopConflictTags(events);
      const keywords = extractKeywords(events, normalized.contextLabel, [...topThemes, ...topConflictTags]);
      const confidence = computeConfidence({
        events,
        topThemes,
        keywords,
        hasPrevious: Number.isFinite(normalized.previousAvgTone)
      });

      metrics.inc('explain_calls_total');
      logger.debug('explain', 'Generated deterministic explanation', {
        eventCount: events.length,
        toneChange
      });

      return {
        explanation: buildTemplate({
          toneChange,
          currentAvgTone,
          goldstein,
          topThemes,
          keywords,
          topConflictTags,
          scope: normalized.scope
        }),
        topThemes,
        keywords,
        topConflictTags,
        confidence
      };
    }
  };
}

module.exports = {
  createExplainService,
  extractKeywords,
  extractTopThemes
};
