const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
const Parser = require('rss-parser');
const { retry } = require('../lib/retry');
const { CONFLICT_PROFILES } = require('../data/conflictProfiles');

countries.registerLocale(enLocale);

const HTML_ENTITIES = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' '
};


function cleanWhitespace(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] || ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return cleanWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatCountry(iso3) {
  return countries.getName(iso3, 'en') || iso3;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  const sample = values.filter(Number.isFinite);
  if (!sample.length) {
    return 0;
  }
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function deduplicateBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortByRecent(left, right) {
  return Date.parse(right.timestamp || 0) - Date.parse(left.timestamp || 0);
}

function extractHtmlMetadata(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descriptionMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

  return {
    url,
    title: cleanWhitespace(titleMatch?.[1] || ''),
    description: cleanWhitespace(descriptionMatch?.[1] || ''),
    checkedAt: new Date().toISOString()
  };
}

function severityToScore(severity) {
  const map = {
    low: 1.8,
    medium: 2.8,
    high: 4,
    critical: 5
  };
  return map[String(severity || '').toLowerCase()] || 2;
}

function confidenceFromSourceCount(sourceCount, severityScore) {
  const score = clamp(((sourceCount || 1) * 0.16) + (severityScore * 0.08) + 0.32, 0.2, 0.96);
  return Number(score.toFixed(2));
}

function sourceKindLabel(kind) {
  const labels = {
    'structured-live': 'Structured live',
    'analysis-feed': 'Analysis feed',
    'reference-map': 'Reference map',
    'registry-source': 'Registry source',
    'field-reporting': 'Field reporting',
    'conflict-outlet': 'Conflict desk',
    'shipping-lane': 'Shipping lane',
    gdelt: 'News wire',
    rss: 'RSS feed'
  };
  return labels[kind] || kind;
}

function signalLabelFromEvent(event) {
  if (event.eventClass === 'territory-shift') {
    return 'Territory shift';
  }
  if (event.eventClass === 'kinetic-strike') {
    return 'Kinetic strike';
  }
  if (event.eventClass === 'ground-clash') {
    return 'Ground clash';
  }
  if ((event.conflictTags || []).length) {
    return event.conflictTags[0].replace(/_/g, ' ');
  }
  return 'Geopolitical signal';
}

function buildWhereLabel(event) {
  const pieces = [];
  if (event.countryIso3) {
    pieces.push(formatCountry(event.countryIso3));
  }
  if (event.origin && event.origin !== event.countryIso3) {
    pieces.push(`origin ${formatCountry(event.origin)}`);
  }
  return pieces.join(' | ') || 'Global';
}

function buildConflictHaystack(event) {
  return normalizeText(
    [
      event.headline,
      event.summary,
      event.snippet,
      event.source,
      event.url,
      event.eventClass,
      event.countryIso3,
      event.origin,
      ...(event.themes || []),
      ...(event.conflictTags || [])
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesAliasPhrase(haystack, alias) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedAlias)}([^a-z0-9]|$)`, 'i');
  return pattern.test(haystack);
}

function hasConflictSignal(event) {
  return Boolean(
    event.isConflictRelevant ||
      event.isViolent ||
      (event.geopoliticalBias || 0) >= 4 ||
      (event.conflictTags || []).length ||
      (event.conflictSeverity || 0) >= 2.4
  );
}

class ConflictService {
  constructor({ cache, logger, state, fetchImpl, services }) {
    this.cache = cache;
    this.logger = logger;
    this.state = state;
    this.fetchImpl = fetchImpl;
    this.services = services;
    this.rssParser = new Parser();
  }

  async fetchWithTimeout(url, options, timeoutMs = 4_500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchJson(url, cacheKey, ttlMs) {
    return this.cache.wrap(
      cacheKey,
      async () =>
        retry(
          async () => {
            const response = await this.fetchWithTimeout(url, {
              headers: {
                accept: 'application/json',
                'user-agent': 'Kompass/0.3'
              }
            }, 4_500);
            if (!response.ok) {
              throw new Error(`Fetch failed with ${response.status}`);
            }
            return response.json();
          },
          {
            attempts: 2,
            baseDelayMs: 300
          }
        ),
      ttlMs
    );
  }

  async fetchText(url, cacheKey, ttlMs) {
    return this.cache.wrap(
      cacheKey,
      async () =>
        retry(
          async () => {
            const response = await this.fetchWithTimeout(url, {
              headers: {
                accept: 'text/html,application/xml,text/xml,*/*',
                'user-agent': 'Kompass/0.3'
              }
            }, 4_000);
            if (!response.ok) {
              throw new Error(`Fetch failed with ${response.status}`);
            }
            return response.text();
          },
          {
            attempts: 2,
            baseDelayMs: 300
          }
        ),
      ttlMs
    );
  }

  getRegistry() {
    return CONFLICT_PROFILES;
  }

  matchConflict(event, conflict) {
    if (!hasConflictSignal(event)) {
      return false;
    }

    const haystack = buildConflictHaystack(event);
    const eventCountries = [event.countryIso3].filter(Boolean);
    const matchesAlias = (conflict.aliases || []).some((alias) => matchesAliasPhrase(haystack, alias));
    const matchesCoreCountry = eventCountries.some((iso3) => (conflict.coreCountries || []).includes(iso3));
    const matchesContextCountry = eventCountries.some((iso3) => (conflict.contextCountries || []).includes(iso3));

    if (matchesCoreCountry) {
      return true;
    }

    if (matchesContextCountry) {
      const contextMinSeverity = conflict.contextMinSeverity || conflict.aliasOnlyMinSeverity || 3;
      return matchesAlias && (
        event.isViolent ||
        (event.conflictTags || []).length > 0 ||
        (event.conflictSeverity || 0) >= contextMinSeverity
      );
    }

    if (conflict.allowAliasOnlyMatch && matchesAlias) {
      return event.isViolent || event.isConflictRelevant || (event.conflictSeverity || 0) >= (conflict.aliasOnlyMinSeverity || 3);
    }

    return false;
  }

  getConflictEvents(conflict, windowMs = 24 * 60 * 60_000) {
    const cutoff = Date.now() - windowMs;
    return (this.state.eventArchive || this.state.recentEvents || [])
      .filter((event) => Date.parse(event.timestamp) >= cutoff)
      .filter((event) => this.matchConflict(event, conflict))
      .sort(sortByRecent);
  }

  buildInternalIncident(event, conflict) {
    const severityScore = severityToScore(event.conflictSeverity);
    const sourceCount = event.sourceCount || 1;
    const clusteredSources = (event.corroboratingSources || []).length
      ? event.corroboratingSources
      : [event.source];
    return {
      id: `internal:${event.id}`,
      conflictSlug: conflict.slug,
      headline: cleanWhitespace(event.headline || event.snippet),
      summary: cleanWhitespace(
        event.summary ||
          `${signalLabelFromEvent(event)} reported in ${buildWhereLabel(event)}. ${
            event.clusterSize > 1
              ? `Clustered from ${event.clusterSize} matching reports across ${sourceCount} sources.`
              : (event.conflictTags || []).length
              ? `Tagged ${event.conflictTags.map((tag) => tag.replace(/_/g, ' ')).join(', ')}.`
              : 'Tracked from the current live conflict window.'
          }`
      ),
      timestamp: event.timestamp,
      location: buildWhereLabel(event),
      countryIso3: event.countryIso3,
      source: event.source,
      sourceUrl: event.url || '',
      sourceKind: event.sourceKind || 'gdelt',
      sourceCount,
      confidence: confidenceFromSourceCount(sourceCount, severityScore),
      severity: event.conflictSeverity || severityScore,
      tags: deduplicateBy(
        [
          ...(event.conflictTags || []),
          signalLabelFromEvent(event).toUpperCase().replace(/\s+/g, '_'),
          ...((event.themes || []).slice(0, 2))
        ],
        (tag) => tag
      ).slice(0, 5),
      actors: [],
      corroboratingSources: clusteredSources,
      mode: 'live'
    };
  }

  async getIranStrikeFeed() {
    return this.fetchJson('https://iranstrike.com/api/feed', 'conflict:iranstrike:feed', 45_000);
  }

  async getMissileStrikesFeed() {
    const xml = await this.fetchText(
      'https://missilestrikes.com/blog/feed.xml',
      'conflict:missilestrikes:rss',
      4 * 60_000
    );
    return this.rssParser.parseString(xml);
  }

  async getReferenceMetadata(url) {
    const html = await this.fetchText(url, `conflict:meta:${url}`, 45 * 60_000);
    return extractHtmlMetadata(html, url);
  }

  buildIranStrikeIncidents(feed, conflict) {
    const developmentIncidents = (feed.developments || []).map((item) => {
      const severityScore = severityToScore(item.severity);
      const entityIds = item.entityIds || [];
      const firstCountry = entityIds.find((value) => value.length === 3) || conflict.countries[0];
      return {
        id: `iranstrike:development:${item.id}`,
        conflictSlug: conflict.slug,
        headline: cleanWhitespace(item.text),
        summary: `Structured OSINT development from IranStrike with ${item.sourceCount || 1} corroborating source${item.sourceCount === 1 ? '' : 's'}.`,
        timestamp: item.timestamp,
        location: entityIds.map(formatCountry).join(' | ') || formatCountry(firstCountry),
        countryIso3: firstCountry,
        source: 'IranStrike',
        sourceUrl: 'https://iranstrike.com/',
        sourceKind: 'structured-live',
        sourceCount: item.sourceCount || 1,
        confidence: confidenceFromSourceCount(item.sourceCount || 1, severityScore + 1),
        severity: severityScore + 0.6,
        tags: ['IRANSTRIKE', String(item.severity || 'medium').toUpperCase()],
        actors: entityIds,
        corroboratingSources: ['IranStrike'],
        mode: 'live'
      };
    });

    const eventIncidents = (feed.events || []).slice(0, 20).map((item) => {
      const severityScore = severityToScore(item.severity);
      return {
        id: `iranstrike:event:${item.id}`,
        conflictSlug: conflict.slug,
        headline: cleanWhitespace(item.description),
        summary: `${String(item.type || 'incident').replace(/-/g, ' ')} from IranStrike. Source: ${item.source}.`,
        timestamp: item.timestamp,
        location: formatCountry(item.location || conflict.countries[0]),
        countryIso3: item.location || conflict.countries[0],
        source: item.source || 'IranStrike',
        sourceUrl: item.sourceUrl || 'https://iranstrike.com/',
        sourceKind: 'structured-live',
        sourceCount: 1,
        confidence: confidenceFromSourceCount(1, severityScore),
        severity: severityScore,
        tags: deduplicateBy(
          [String(item.type || 'incident').toUpperCase(), String(item.severity || 'medium').toUpperCase(), 'IRANSTRIKE'],
          (tag) => tag
        ),
        actors: item.origin ? [item.origin, item.location].filter(Boolean) : [item.location].filter(Boolean),
        corroboratingSources: [item.source || 'IranStrike'],
        mode: 'live'
      };
    });

    return deduplicateBy([...developmentIncidents, ...eventIncidents], (item) => item.id)
      .sort((left, right) => {
        if (right.severity !== left.severity) {
          return right.severity - left.severity;
        }
        return sortByRecent(left, right);
      })
      .slice(0, 24);
  }

  buildMissileStrikesIncidents(feed, conflict) {
    return (feed.items || []).slice(0, 8).map((item) => ({
      id: `missilestrikes:${item.guid || item.link}`,
      conflictSlug: conflict.slug,
      headline: cleanWhitespace(item.title),
      summary: cleanWhitespace(item.contentSnippet || item.content || item.summary || '').slice(0, 240),
      timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
      location: conflict.title,
      countryIso3: conflict.countries[0],
      source: 'MissileStrikes',
      sourceUrl: item.link || 'https://missilestrikes.com/',
      sourceKind: 'analysis-feed',
      sourceCount: 1,
      confidence: 0.61,
      severity: 2.4,
      tags: ['ANALYSIS', 'MISSILESTRIKES'],
      actors: [],
      corroboratingSources: ['MissileStrikes'],
      mode: 'analysis'
    }));
  }

  async buildSourceDeck(conflict) {
    return Promise.all(
      conflict.sources.map(async (source) => {
        try {
          if (source.summaryOverride || source.detailOverride || source.latestHeadlineOverride) {
            return {
              key: source.key,
              label: source.label,
              kind: source.kind,
              kindLabel: sourceKindLabel(source.kind),
              url: source.url,
              status: source.statusOverride || 'linked',
              checkedAt: new Date().toISOString(),
              summary: cleanWhitespace(source.summaryOverride || `Reference source for ${conflict.title}.`),
              detail: cleanWhitespace(source.detailOverride || source.label),
              latestHeadline: cleanWhitespace(source.latestHeadlineOverride || ''),
              itemCount: source.itemCountOverride || 1
            };
          }

          if (source.adapter === 'iranstrike') {
            const feed = await this.getIranStrikeFeed();
            return {
              key: source.key,
              label: source.label,
              kind: source.kind,
              kindLabel: sourceKindLabel(source.kind),
              url: source.url,
              status: feed.stale ? 'stale' : 'live',
              checkedAt: feed.lastUpdated || new Date().toISOString(),
              summary: cleanWhitespace(feed.spotlight?.summary || 'Near-real-time conflict feed for the Iran / Israel / U.S. theater.'),
              detail: `${feed.totalCount || (feed.events || []).length || 0} tracked events`,
              latestHeadline: cleanWhitespace(feed.spotlight?.headline || feed.events?.[0]?.description || ''),
              itemCount: feed.totalCount || (feed.events || []).length || 0
            };
          }

          if (source.adapter === 'missilestrikes') {
            const feed = await this.getMissileStrikesFeed();
            return {
              key: source.key,
              label: source.label,
              kind: source.kind,
              kindLabel: sourceKindLabel(source.kind),
              url: source.url,
              status: 'live',
              checkedAt: feed.items?.[0]?.isoDate || new Date().toISOString(),
              summary: cleanWhitespace(feed.description || 'Missile and strike-focused analysis feed for the regional theater.'),
              detail: `${feed.items?.length || 0} recent analysis posts`,
              latestHeadline: cleanWhitespace(feed.items?.[0]?.title || ''),
              itemCount: feed.items?.length || 0
            };
          }

          const page = await this.getReferenceMetadata(source.url);
          return {
            key: source.key,
            label: source.label,
            kind: source.kind,
            kindLabel: sourceKindLabel(source.kind),
            url: source.url,
            status: 'linked',
            checkedAt: page.checkedAt,
            summary: page.description || `Reference source for ${conflict.title}.`,
            detail: page.title || source.label,
            latestHeadline: page.title || '',
            itemCount: 1
          };
        } catch (error) {
          this.logger.warn('conflicts', 'Conflict source deck fetch failed', {
            conflict: conflict.slug,
            source: source.label,
            error: error.message
          });
          return {
            key: source.key,
            label: source.label,
            kind: source.kind,
            kindLabel: sourceKindLabel(source.kind),
            url: source.url,
            status: 'degraded',
            checkedAt: new Date().toISOString(),
            summary: 'Source currently unreachable from the Kompass worker. Link is still available for manual follow-up.',
            detail: source.url,
            latestHeadline: '',
            itemCount: 0
          };
        }
      })
    );
  }

  async buildConflictIncidents(conflict) {
    const internalEvents = this.getConflictEvents(conflict, 24 * 60 * 60_000);
    const clusteredInternalEvents = this.services?.gdeltService?.clusterEvents
      ? this.services.gdeltService.clusterEvents(internalEvents, { limit: 18 })
      : internalEvents.slice(0, 18);
    const internalIncidents = clusteredInternalEvents.map((event) => this.buildInternalIncident(event, conflict));
    const incidents = [...internalIncidents];

    if (conflict.slug === 'iran-israel-us') {
      try {
        const iranStrikeFeed = await this.getIranStrikeFeed();
        incidents.push(...this.buildIranStrikeIncidents(iranStrikeFeed, conflict));
      } catch (error) {
        this.logger.warn('conflicts', 'IranStrike ingest failed', {
          error: error.message
        });
      }

      try {
        const missileFeed = await this.getMissileStrikesFeed();
        incidents.push(...this.buildMissileStrikesIncidents(missileFeed, conflict));
      } catch (error) {
        this.logger.warn('conflicts', 'MissileStrikes ingest failed', {
          error: error.message
        });
      }
    }

    return deduplicateBy(incidents, (item) => `${item.headline}|${item.timestamp}|${item.source}`)
      .sort((left, right) => {
        if (right.severity !== left.severity) {
          return right.severity - left.severity;
        }
        if (right.sourceCount !== left.sourceCount) {
          return right.sourceCount - left.sourceCount;
        }
        return sortByRecent(left, right);
      })
      .slice(0, 30);
  }

  buildOverview(conflict, incidents, sourceDeck) {
    const matchedEvents = this.getConflictEvents(conflict, 24 * 60 * 60_000);
    const liveIncidentCount = incidents.filter((item) => item.mode === 'live').length;
    const sourceCount = new Set(
      incidents.flatMap((item) => (item.corroboratingSources || []).length ? item.corroboratingSources : [item.source])
    ).size;

    return {
      incidentCount: incidents.length,
      liveIncidentCount,
      sourceCount,
      countryCount: new Set(matchedEvents.map((event) => event.countryIso3)).size,
      avgTone: Number(average(matchedEvents.map((event) => event.avgTone)).toFixed(2)),
      avgGoldstein: Number(average(matchedEvents.map((event) => event.goldstein)).toFixed(2)),
      pressure: Number(average(matchedEvents.map((event) => event.conflictSeverity || 0)).toFixed(2)),
      topTags: deduplicateBy(incidents.flatMap((item) => item.tags || []), (tag) => tag).slice(0, 6),
      sourceKinds: deduplicateBy(sourceDeck.map((item) => item.kind), (item) => item),
      lastUpdated: incidents[0]?.timestamp || new Date().toISOString()
    };
  }

  buildSummaryOverview(conflict) {
    const matchedEvents = this.getConflictEvents(conflict, 24 * 60 * 60_000);
    return {
      incidentCount: matchedEvents.length,
      liveIncidentCount: matchedEvents.length,
      sourceCount: new Set(matchedEvents.map((event) => event.source)).size,
      countryCount: new Set(matchedEvents.map((event) => event.countryIso3)).size,
      avgTone: Number(average(matchedEvents.map((event) => event.avgTone)).toFixed(2)),
      avgGoldstein: Number(average(matchedEvents.map((event) => event.goldstein)).toFixed(2)),
      pressure: Number(average(matchedEvents.map((event) => event.conflictSeverity || 0)).toFixed(2)),
      topTags: deduplicateBy(matchedEvents.flatMap((event) => event.conflictTags || []), (tag) => tag).slice(0, 6),
      sourceKinds: deduplicateBy(matchedEvents.map((event) => event.sourceKind || 'gdelt'), (item) => item),
      lastUpdated: matchedEvents[0]?.timestamp || new Date().toISOString()
    };
  }

  async listConflicts() {
    const summaries = this.getRegistry().map((conflict) => ({
      slug: conflict.slug,
      title: conflict.title,
      summary: conflict.summary,
      description: conflict.description,
      countries: conflict.countries,
      mapCountries: conflict.mapCountries || conflict.countries,
      overview: this.buildSummaryOverview(conflict)
    }));

    return {
      featured: 'iran-israel-us',
      conflicts: summaries.sort((left, right) => right.overview.pressure - left.overview.pressure)
    };
  }

  async getConflict(slug) {
    const conflict = this.getRegistry().find((entry) => entry.slug === slug);
    if (!conflict) {
      const error = new Error('Conflict not found');
      error.statusCode = 404;
      throw error;
    }

    const [incidents, sourceDeck] = await Promise.all([
      this.buildConflictIncidents(conflict),
      this.buildSourceDeck(conflict)
    ]);
    const overview = this.buildOverview(conflict, incidents, sourceDeck);

    return {
      conflict: {
        slug: conflict.slug,
        title: conflict.title,
        summary: conflict.summary,
        description: conflict.description,
        countries: conflict.countries,
        mapCountries: conflict.mapCountries || conflict.countries,
        overview,
        history: conflict.history,
        sourceDeck,
        incidents
      }
    };
  }
}

module.exports = {
  ConflictService
};
