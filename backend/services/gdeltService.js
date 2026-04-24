const AdmZip = require('adm-zip');
const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
const Parser = require('rss-parser');
const { retry } = require('../lib/retry');
const {
  GLOBAL_RSS_FEEDS,
  GLOBAL_SHIPPING_FEEDS,
  HOTSPOT_COUNTRIES,
  BLUESKY_SOURCE_REGISTRY,
  buildCountryOutletFeeds,
  buildCountryPulseFeeds,
  buildConflictOutletFeeds
} = require('../data/sourceRegistry');
const { COUNTRY_DEMONYMS, getCountryProfile } = require('../data/countryProfiles');

countries.registerLocale(enLocale);

const COUNTRY_OVERRIDES = {
  // Real-world feeds are messy about country names/codes, so keep the annoying aliases in one place.
  US: 'USA',
  GB: 'GBR',
  UK: 'GBR',
  EU: 'EUR',
  DE: 'DEU',
  FR: 'FRA',
  CN: 'CHN',
  JP: 'JPN',
  BR: 'BRA',
  IN: 'IND',
  ZA: 'ZAF',
  AU: 'AUS',
  CA: 'CAN',
  MX: 'MEX',
  SG: 'SGP',
  AUSTRALIA: 'AUS',
  AUSTRIA: 'AUT',
  BRAZIL: 'BRA',
  CANADA: 'CAN',
  FRANCE: 'FRA',
  GERMANY: 'DEU',
  INDIA: 'IND',
  JAPAN: 'JPN',
  MEXICO: 'MEX',
  SENEGAL: 'SEN',
  SINGAPORE: 'SGP',
  'SOUTH AFRICA': 'ZAF',
  'UNITED KINGDOM': 'GBR',
  'UNITED STATES': 'USA'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function average(values) {
  const sample = values.filter(Number.isFinite);
  if (!sample.length) {
    return 0;
  }
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function weightedAverage(values, weights) {
  const weighted = values
    .map((value, index) => ({
      value: Number(value),
      weight: Number(weights[index])
    }))
    .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0);

  if (!weighted.length) {
    return 0;
  }

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) {
    return 0;
  }

  return weighted.reduce((sum, entry) => sum + (entry.value * entry.weight), 0) / totalWeight;
}

function topThemesForEvents(events, limit = 5) {
  const counts = new Map();
  for (const event of events) {
    for (const theme of event.themes || []) {
      counts.set(theme, (counts.get(theme) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([theme]) => theme);
}

function topSourcesForEvents(events, limit = 4) {
  const counts = new Map();
  for (const event of events) {
    const source = String(event.source || '').trim();
    if (!source) {
      continue;
    }
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([source, eventCount]) => ({
      source,
      eventCount
    }));
}

function topFeedKindsForEvents(events) {
  const counts = new Map();
  for (const event of events) {
    const sourceKind = String(event.sourceKind || 'gdelt').trim() || 'gdelt';
    counts.set(sourceKind, (counts.get(sourceKind) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([sourceKind, eventCount]) => ({
      sourceKind,
      eventCount
    }));
}

function topConflictTagsForEvents(events, limit = 4) {
  const counts = new Map();
  for (const event of events) {
    for (const tag of event.conflictTags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function safePreview(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function cleanWhitespace(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeOutletFingerprint(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function hostnameFromUrl(value) {
  try {
    return new URL(String(value || '')).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeLexiconText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function countMatches(text, phrases) {
  const normalized = normalizeLexiconText(text);
  return phrases.reduce((count, phrase) => {
    const matcher = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    return count + ((normalized.match(matcher) || []).length);
  }, 0);
}

const POSITIVE_TERMS = [
  'acord',
  'aid',
  'avance',
  'avanc',
  'boost',
  'calm',
  'cresc',
  'deal',
  'expan',
  'gain',
  'garant',
  'growth',
  'improv',
  'optim',
  'pace',
  'peace',
  'progress',
  'rally',
  'recov',
  'record',
  'resilien',
  'stabil',
  'sucesso',
  'surge'
];
const NEGATIVE_TERMS = [
  'alerta',
  'ataqu',
  'attack',
  'collapse',
  'conflict',
  'crise',
  'crisis',
  'cuts',
  'fear',
  'guerra',
  'inflac',
  'layoff',
  'loss',
  'mort',
  'muerte',
  'protest',
  'queda',
  'recession',
  'sanction',
  'shortage',
  'slump',
  'strike',
  'violenc',
  'war'
];
const CONFLICT_TERMS = ['ataqu', 'attack', 'clash', 'conflict', 'crise', 'guerra', 'sanction', 'strike', 'violenc', 'war'];
const COOPERATION_TERMS = ['acord', 'aid', 'deal', 'investment', 'pace', 'peace', 'support', 'talks', 'truce'];
const LOCAL_CRIME_TERMS = [
  'arrested',
  'burglary',
  'county',
  'court',
  'deputy',
  'domestic dispute',
  'homicide',
  'juvenile',
  'manhunt',
  'police',
  'precinct',
  'prosecutor',
  'robbery',
  'sheriff',
  'stabbing',
  'suspect',
  'teen',
  'traffic stop'
];
const GEOPOLITICAL_TERMS = [
  'air defense',
  'airstrike',
  'army',
  'artillery',
  'ballistic',
  'ceasefire',
  'cross-border',
  'defense ministry',
  'destroyer',
  'drone',
  'embassy',
  'frontline',
  'hamas',
  'hezbollah',
  'houthi',
  'insurgent',
  'iran',
  'israel',
  'lebanon',
  'militant',
  'military',
  'ministry',
  'missile',
  'navy',
  'occupation',
  'prime minister',
  'rebel',
  'regional',
  'rocket',
  'russia',
  'sahel',
  'sanction',
  'state media',
  'summit',
  'sudan',
  'territory',
  'troops',
  'ukraine',
  'warship',
  'yemen'
];
const CONFLICT_SIGNAL_RULES = [
  { tag: 'MISSILE', phrases: ['ballistic missile', 'cruise missile', 'missile strike', 'rocket barrage', 'rocket fire', 'missile'], weight: 3.8 },
  { tag: 'DRONE', phrases: ['drone strike', 'uav attack', 'drone attack', 'loitering munition', 'drone'], weight: 3.5 },
  { tag: 'AIRSTRIKE', phrases: ['air strike', 'airstrike', 'air raid', 'precision strike'], weight: 3.6 },
  { tag: 'BOMBING', phrases: ['car bomb', 'bombing', 'bomb blast', 'explosion', 'blast'], weight: 3.6 },
  { tag: 'SHELLING', phrases: ['shelling', 'artillery fire', 'artillery strike', 'mortar fire', 'mortar attack'], weight: 3.4 },
  { tag: 'TERROR', phrases: ['terror attack', 'terrorist attack', 'militant attack', 'hostage', 'suicide bomber', 'suicide attack'], weight: 4.2 },
  { tag: 'RAID', phrases: ['commando raid', 'cross-border raid', 'armed raid', 'raid'], weight: 2.6 },
  { tag: 'CITY_GAIN', phrases: ['captured the city', 'captured city', 'captured town', 'seized city', 'seized town', 'took control of', 'recaptured', 'territorial gain'], weight: 4.1 },
  { tag: 'GROUND_ASSAULT', phrases: ['ground offensive', 'ground assault', 'incursion', 'offensive', 'counteroffensive'], weight: 3.0 },
  { tag: 'CASUALTIES', phrases: ['killed', 'casualties', 'civilian deaths', 'dead in attack', 'wounded'], weight: 2.2 }
];
const THEME_RULES = [
  { theme: 'ECONOMY', phrases: ['bolsa', 'econom', 'inflac', 'market', 'mercad', 'rates', 'recession', 'trade'] },
  { theme: 'POLITICS', phrases: ['camara', 'election', 'govern', 'minister', 'parlament', 'policy', 'president', 'senado'] },
  { theme: 'SECURITY', phrases: ['army', 'ataqu', 'attack', 'conflict', 'guerra', 'missile', 'security', 'violenc', 'war'] },
  { theme: 'ENERGY', phrases: ['electric', 'energia', 'energy', 'gas', 'oil', 'power'] },
  { theme: 'CLIMATE', phrases: ['climate', 'drought', 'flood', 'storm', 'wildfire'] },
  { theme: 'TECH', phrases: ['ai', 'chip', 'cyber', 'software', 'tech', 'tecnolog'] },
  { theme: 'HEALTH', phrases: ['disease', 'health', 'hospital', 'medicine', 'virus'] }
];
const GDELT_QUERY_COUNTRY_TERMS = {
  US: 'unitedstates',
  GB: 'unitedkingdom',
  DE: 'germany',
  FR: 'france',
  IN: 'india',
  JP: 'japan',
  BR: 'brazil',
  ZA: 'southafrica',
  AU: 'australia',
  CA: 'canada',
  MX: 'mexico',
  SG: 'singapore'
};
const GDELT_LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const COUNTRY_NAME_ALIASES = {
  Bolivia: 'Bolivia, Plurinational State of',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  Brunei: 'Brunei Darussalam',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'Congo, The Democratic Republic of the',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  Iran: 'Iran, Islamic Republic of',
  Laos: "Lao People's Democratic Republic",
  Moldova: 'Moldova, Republic of',
  Russia: 'Russian Federation',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'South Korea': 'Korea, Republic of',
  Syria: 'Syrian Arab Republic',
  Tanzania: 'Tanzania, United Republic of',
  'United States of America': 'United States',
  Venezuela: 'Venezuela, Bolivarian Republic of',
  Vietnam: 'Viet Nam'
};
const MANUAL_ISO3_BY_NAME = {
  Bolivia: 'BOL',
  'Dem. Rep. Congo': 'COD',
  'Falkland Is.': 'FLK',
  Iran: 'IRN',
  Macedonia: 'MKD',
  'N. Cyprus': 'CYP',
  Somaliland: 'SOM',
  Tanzania: 'TZA',
  Venezuela: 'VEN',
  Vietnam: 'VNM',
  'W. Sahara': 'ESH'
};
const MAX_STATE_RECENT_EVENTS = 2400;
const MAX_STATE_ARCHIVE_EVENTS = 6000;
const CURATED_RSS_BATCH_SIZE = 10;
const CURATED_SOCIAL_BATCH_SIZE = 2;
const TEXT_LOCATION_HINTS = {
  gaza: 'PSE',
  houthi: 'YEM',
  houthis: 'YEM',
  kyiv: 'UKR',
  lebanon: 'LBN',
  moscow: 'RUS',
  russia: 'RUS',
  sudan: 'SDN',
  tehran: 'IRN',
  ukraine: 'UKR',
  yemen: 'YEM'
};
const GENERIC_ACTOR_TOKENS = new Set([
  'ACTOR',
  'AUTHORITIES',
  'CIVILIAN',
  'CIVILIANS',
  'CITIZENS',
  'COMPANY',
  'COMPANIES',
  'INDUSTRY',
  'GOVERNMENT',
  'MILITARY',
  'OFFICIAL',
  'OFFICIALS',
  'POLICE',
  'PRESIDENT',
  'PROSECUTOR',
  'PROTESTERS',
  'REBELS',
  'TERRORIST',
  'TERRORISTS',
  'TROOPS',
  'UNIVERSITY',
  'VILLAGE',
  'CITY',
  'TOWN',
  'DISTRICT',
  'REGION',
  'MARKET'
]);
const TITLE_CASE_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
]);
const EVENT_THEME_MAP = {
  '01': ['DIPLOMACY'],
  '02': ['APPEAL'],
  '03': ['INTENT'],
  '04': ['CONSULTATION'],
  '05': ['DIPLOMACY'],
  '06': ['COOPERATION'],
  '07': ['AID'],
  '08': ['DIPLOMACY'],
  '09': ['POLITICS'],
  '10': ['POLITICS'],
  '11': ['PROTEST'],
  '12': ['REJECTION'],
  '13': ['THREAT'],
  '14': ['PROTEST'],
  '15': ['EXHIBIT_FORCE'],
  '16': ['CONFLICT'],
  '17': ['COERCION'],
  '18': ['ASSAULT'],
  '19': ['FIGHT'],
  '20': ['CONFLICT']
};
const CONFLICT_THEMES = new Set(['ASSAULT', 'CONFLICT', 'FIGHT', 'PROTEST', 'SECURITY', 'TENSION', 'THREAT']);
const VIOLENT_ROOT_CODES = new Set(['18', '19', '20']);

const COUNTRY_TEXT_MATCHES = [
  ...Object.entries(countries.getNames('en')).map(([alpha2, name]) => ({
    iso3: countries.alpha2ToAlpha3(alpha2),
    term: normalizeLexiconText(name)
  })),
  ...Object.entries(COUNTRY_DEMONYMS).flatMap(([iso3, terms]) =>
    terms.map((term) => ({
      iso3,
      term: normalizeLexiconText(term)
    }))
  ),
  ...Object.entries(COUNTRY_NAME_ALIASES).map(([name, aliased]) => ({
    iso3: resolveIso3FromCountryName(aliased),
    term: normalizeLexiconText(name)
  })),
  ...Object.entries(TEXT_LOCATION_HINTS).map(([term, iso3]) => ({
    iso3,
    term: normalizeLexiconText(term)
  }))
]
  .filter((entry) => entry.iso3 && entry.term.length >= 4)
  .sort((left, right) => right.term.length - left.term.length);

function normalizeCountryName(name) {
  const trimmed = String(name || '').trim();
  return COUNTRY_NAME_ALIASES[trimmed] || trimmed;
}

function resolveIso3FromCountryName(name) {
  const normalized = normalizeCountryName(name);
  return countries.getAlpha3Code(normalized, 'en') || MANUAL_ISO3_BY_NAME[name] || null;
}

function extractCountryName(fullName) {
  const parts = String(fullName || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || '';
}

function extractDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function extractGoogleNewsSourceLabel(item) {
  const rawContent = String(item?.content || item?.contentSnippet || '');
  const htmlMatch = rawContent.match(/<font[^>]*>([^<]+)<\/font>/i);
  if (htmlMatch?.[1]) {
    return cleanWhitespace(htmlMatch[1]);
  }

  const snippet = cleanWhitespace(item?.contentSnippet || '');
  const parts = snippet.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.at(-1);
  }

  return '';
}

function cleanRssHeadline(title, sourceLabel) {
  const trimmed = String(title || '').trim();
  if (!trimmed) {
    return '';
  }

  if (sourceLabel) {
    const suffix = new RegExp(`\\s+-\\s+${sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    return trimmed.replace(suffix, '').trim();
  }

  return trimmed;
}

function normalizeHeadlineKey(headline) {
  return String(headline || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

const CONFIGURED_FEED_KINDS = new Set(['country-outlet', 'country-wire', 'conflict-outlet', 'country-pulse', 'shipping-lane', 'social-bluesky']);

function countConfiguredOutlets(events) {
  return new Set(
    (events || [])
      .filter((event) => CONFIGURED_FEED_KINDS.has(String(event.sourceKind || '')))
      .map((event) => event.configuredOutletLabel || event.feedName || event.source)
      .filter(Boolean)
  ).size;
}

const LOW_SIGNAL_PATTERNS = [
  /\b(?:uefa|fifa|nba|wnba|nfl|mlb|ipl|serie a|premier league|champions league|tennis|golf|cricket|rugby|boxing|ufc)\b/i,
  /\b(?:celebrity|actor|actress|movie|film|music|album|singer|fashion|beauty brand|makeup|runway)\b/i,
  /\b(?:scores|fixtures|transfer window|matchday|quarterfinal|semifinal|final whistle)\b/i
];
const HIGH_SIGNAL_PATTERNS = [
  /\b(?:war|missile|strike|attack|conflict|economy|market|inflation|trade|election|government|policy|sanction|security|oil|gas|energy|climate|diplomacy|military|protest)\b/i
];
const COUNTRY_MACRO_TERMS = [
  'bond',
  'budget',
  'central bank',
  'economy',
  'election',
  'exports',
  'fiscal',
  'gdp',
  'government',
  'inflation',
  'interest rate',
  'jobs',
  'labor',
  'layoff',
  'market',
  'parliament',
  'policy',
  'president',
  'prime minister',
  'rates',
  'recession',
  'regulator',
  'strike',
  'tax',
  'trade',
  'unemployment',
  'wages'
];
const COUNTRY_INTERNAL_TERMS = [
  'cabinet',
  'coalition',
  'court',
  'election',
  'minister',
  'ministry',
  'parliament',
  'policy',
  'referendum',
  'resignation',
  'senate',
  'supreme court'
];
const HUMAN_INTEREST_TERMS = [
  'accident',
  'celebrity',
  'college',
  'holiday',
  'my son',
  'obituary',
  'school',
  'study abroad',
  'tourist',
  'travel',
  'wedding'
];
const COUNTRY_NOISE_PATTERNS = [
  /\b(?:study abroad|exchange student|holiday|travel tips|vacation|wedding|lottery|celebrity)\b/i,
  /\b(?:my son|my daughter|family tribute|obituary)\b/i,
  /\b(?:tourist|vacationer|holidaymaker)\b[\s\S]{0,40}\b(?:killed|dies|dead|death|injured|crash|hit)\b/i,
  /\b(?:tenerife|ibiza|mallorca|majorca)\b[\s\S]{0,50}\b(?:killed|dies|dead|death|injured|crash|hit)\b/i
];
const SYNTHETIC_EXPORT_HEADLINE = /^(?:diplomatic signal|public appeal|intent signal|consultation move|diplomatic move|cooperation move|aid move|political signal|political pressure|protest signal|rejection signal|threat signal|protest flare-up|force posture|conflict signal|coercive move|assault report|battle report|mass violence report)\b/i;
const CLUSTER_STOPWORDS = new Set([
  'about',
  'after',
  'amid',
  'around',
  'because',
  'company',
  'government',
  'group',
  'have',
  'into',
  'just',
  'live',
  'local',
  'more',
  'near',
  'news',
  'over',
  'reported',
  'reports',
  'says',
  'signal',
  'source',
  'sources',
  'that',
  'their',
  'there',
  'these',
  'this',
  'today',
  'update',
  'with'
]);

function isLowSignalArticle(text) {
  const value = String(text || '');
  const lowSignalHit = LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(value));
  const highSignalHit = HIGH_SIGNAL_PATTERNS.some((pattern) => pattern.test(value));
  return lowSignalHit && !highSignalHit;
}

function parseDateAdded(value) {
  const raw = String(value || '').trim();
  if (!/^\d{14}$/.test(raw)) {
    return new Date().toISOString();
  }
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(8, 10);
  const minute = raw.slice(10, 12);
  const second = raw.slice(12, 14);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

function formatExportTimestamp(value) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  const second = String(value.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function parseExportTimestampFromUrl(url) {
  const match = String(url || '').match(/\/(\d{14})\.export\.CSV\.zip$/i);
  if (!match) {
    return null;
  }

  const raw = match[1];
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const second = Number(raw.slice(12, 14));
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function normalizeActorName(name) {
  const value = String(name || '').replace(/\s+/g, ' ').trim();
  if (!value) {
    return '';
  }

  if (GENERIC_ACTOR_TOKENS.has(value.toUpperCase())) {
    return '';
  }

  return value;
}

function uniqueActors(actor1Name, actor2Name, place) {
  const placeCountry = normalizeLexiconText(extractCountryName(place));
  const actors = [actor1Name, actor2Name]
    .map((actor) => prettifyActorLabel(actor))
    .filter(Boolean)
    .filter((actor, index, list) => list.findIndex((item) => normalizeLexiconText(item) === normalizeLexiconText(actor)) === index)
    .filter((actor) => {
      if (!placeCountry) {
        return true;
      }
      return normalizeLexiconText(actor) !== placeCountry;
    });
  return actors;
}

function toHeadlineCase(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_STOPWORDS.has(lower)) {
        return lower;
      }
      if (/^[A-Z]{2,4}$/.test(word)) {
        return word.toUpperCase();
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(' ');
}

function looksUsefulHeadline(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.length < 18) {
    return false;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length >= 4;
}

function extractHeadlineFromUrl(url) {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean).reverse();
    const best = segments
      .map((segment) => {
        const cleaned = decodeURIComponent(segment)
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b(?:amp|html|php|story|stories|article|articles|news)\b/gi, ' ')
          .replace(/\b\d{4,}\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const words = cleaned.split(/\s+/).filter(Boolean);
        const alphaWords = words.filter((word) => /[a-z]/i.test(word));
        const hasHexBlob = /^[a-f0-9\s-]{18,}$/i.test(cleaned);
        return {
          cleaned,
          score: (alphaWords.length * 10) + cleaned.length - (hasHexBlob ? 40 : 0)
        };
      })
      .filter((item) => looksUsefulHeadline(item.cleaned))
      .sort((left, right) => right.score - left.score)[0];

    return best ? toHeadlineCase(best.cleaned) : '';
  } catch {
    return '';
  }
}

function prettifyPlaceLabel(place) {
  return String(place || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function prettifyActorLabel(actor) {
  const normalized = normalizeActorName(actor);
  if (!normalized) {
    return '';
  }

  return toHeadlineCase(normalized);
}

function eventLabelFromCode(eventRootCode) {
  const labels = {
    '01': 'Diplomatic signal',
    '02': 'Public appeal',
    '03': 'Intent signal',
    '04': 'Consultation move',
    '05': 'Diplomatic move',
    '06': 'Cooperation move',
    '07': 'Aid move',
    '08': 'Diplomatic signal',
    '09': 'Political signal',
    '10': 'Political pressure',
    '11': 'Protest signal',
    '12': 'Rejection signal',
    '13': 'Threat signal',
    '14': 'Protest flare-up',
    '15': 'Force posture',
    '16': 'Conflict signal',
    '17': 'Coercive move',
    '18': 'Assault report',
    '19': 'Battle report',
    '20': 'Mass violence report'
  };

  return labels[String(eventRootCode || '').padStart(2, '0')] || 'Geopolitical signal';
}

function summarizeSignalClass(conflictMeta = {}, eventRootCode = '') {
  if (conflictMeta.eventClass === 'kinetic-strike') {
    return 'Kinetic-strike reporting';
  }
  if (conflictMeta.eventClass === 'territory-shift') {
    return 'Territory-shift reporting';
  }
  if (conflictMeta.eventClass === 'ground-clash') {
    return 'Ground-clash reporting';
  }
  if (conflictMeta.eventClass === 'security-incident') {
    return 'Security-incident reporting';
  }
  if (conflictMeta.eventClass === 'public-safety') {
    return 'Public-safety reporting';
  }
  return eventLabelFromCode(eventRootCode);
}

class GdeltService {
  constructor({ config, cache, db, logger, metrics, state, fetchImpl }) {
    this.config = config;
    this.cache = cache;
    this.db = db;
    this.logger = logger;
    this.metrics = metrics;
    this.state = state;
    this.fetchImpl = fetchImpl;
    this.rssParser = new Parser();
    this.globalFeeds = GLOBAL_RSS_FEEDS;
    this.shippingFeeds = GLOBAL_SHIPPING_FEEDS;
    this.countryOutletFeeds = buildCountryOutletFeeds();
    this.conflictOutletFeeds = buildConflictOutletFeeds();
    this.countryPulseFeeds = buildCountryPulseFeeds();
    this.socialFeeds = BLUESKY_SOURCE_REGISTRY;
    this.intervalHandle = null;
    this.lastProviderCallAt = 0;
    this.refreshPromise = null;
  }

  async yieldToLoop() {
    // This file can hog the event loop pretty easily on bigger batches, so yield on purpose.
    await nextTick();
  }

  async settleInBatches(items, worker, batchSize = 8) {
    const settled = [];
    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const batchSettled = await Promise.allSettled(batch.map((item) => worker(item)));
      settled.push(...batchSettled);
      if (index + batchSize < items.length) {
        await this.yieldToLoop();
      }
    }
    return settled;
  }

  normalizeCountry(input) {
    const raw = String(input || 'GLOBAL').trim().toUpperCase();
    if (COUNTRY_OVERRIDES[raw]) {
      return COUNTRY_OVERRIDES[raw];
    }
    if (raw.length === 3) {
      return raw;
    }
    return raw.slice(0, 3) || 'GLOBAL';
  }

  normalizeThemes(raw) {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(raw)
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  deriveHeuristicSignals(text) {
    const sample = normalizeLexiconText(text);
    const positive = countMatches(sample, POSITIVE_TERMS);
    const negative = countMatches(sample, NEGATIVE_TERMS);
    const cooperation = countMatches(sample, COOPERATION_TERMS);
    const conflict = countMatches(sample, CONFLICT_TERMS);
    const tone = clamp((positive - negative) * 2.1, -10, 10);
    const goldstein = clamp(((cooperation - conflict) * 2.4) + (tone * 0.35), -10, 10);
    const themes = THEME_RULES
      .filter((rule) => countMatches(sample, rule.phrases) > 0)
      .map((rule) => rule.theme);

    return {
      avgTone: tone,
      goldstein,
      themes: themes.length ? themes : ['HEADLINES']
    };
  }

  classifyConflict({ text, themes = [], eventRootCode = '', quadClass = 0 }) {
    const normalizedText = normalizeLexiconText(text);
    const matchedSignals = [];
    let severity = 0;
    const geopoliticalBias = countMatches(normalizedText, GEOPOLITICAL_TERMS);
    const publicSafetyBias = countMatches(normalizedText, LOCAL_CRIME_TERMS);

    for (const rule of CONFLICT_SIGNAL_RULES) {
      const matched = rule.phrases.some((phrase) => normalizedText.includes(normalizeLexiconText(phrase)));
      if (matched) {
        matchedSignals.push(rule.tag);
        severity += rule.weight;
      }
    }

    const hasConflictTheme = themes.some((theme) => CONFLICT_THEMES.has(theme));
    const normalizedRootCode = String(eventRootCode || '').padStart(2, '0');
    const violentRoot = VIOLENT_ROOT_CODES.has(normalizedRootCode);

    if (hasConflictTheme) {
      severity += 1.2;
    }
    if (violentRoot) {
      severity += 2.4;
    }
    if (Number(quadClass) === 4) {
      severity += 1.1;
    }
    if (geopoliticalBias > 0) {
      severity += Math.min(2.6, geopoliticalBias * 0.28);
    }
    if (publicSafetyBias > 0 && geopoliticalBias === 0) {
      severity -= Math.min(2.8, publicSafetyBias * 0.45);
    }

    if (!matchedSignals.length && violentRoot) {
      matchedSignals.push(
        normalizedRootCode === '18'
          ? 'ASSAULT'
          : normalizedRootCode === '19'
            ? 'BATTLE'
            : 'MASS_VIOLENCE'
      );
    } else if (!matchedSignals.length && hasConflictTheme) {
      matchedSignals.push('SECURITY');
    }

    let eventClass = 'general';
    if (matchedSignals.some((tag) => ['MISSILE', 'DRONE', 'AIRSTRIKE', 'BOMBING', 'SHELLING', 'TERROR'].includes(tag))) {
      eventClass = 'kinetic-strike';
    } else if (matchedSignals.includes('CITY_GAIN')) {
      eventClass = 'territory-shift';
    } else if (matchedSignals.some((tag) => ['GROUND_ASSAULT', 'RAID', 'BATTLE', 'ASSAULT', 'MASS_VIOLENCE'].includes(tag))) {
      eventClass = 'ground-clash';
    } else if (hasConflictTheme) {
      eventClass = 'security-incident';
    }

    const localCrimeDominant =
      publicSafetyBias >= 1 &&
      geopoliticalBias === 0 &&
      !matchedSignals.some((tag) => ['MISSILE', 'DRONE', 'AIRSTRIKE', 'BOMBING', 'SHELLING', 'CITY_GAIN', 'GROUND_ASSAULT'].includes(tag));
    if (localCrimeDominant) {
      eventClass = 'public-safety';
      severity = Math.max(0.2, severity * 0.25);
    }

    const isConflictRelevant =
      !localCrimeDominant &&
      (
        geopoliticalBias > 0 ||
        violentRoot ||
        hasConflictTheme ||
        matchedSignals.some((tag) => tag !== 'PUBLIC_SAFETY')
      );
    const relevanceScore = Number(
      Math.max(
        0,
        severity + (geopoliticalBias * 0.65) - (publicSafetyBias * 0.55) + (isConflictRelevant ? 1.4 : 0)
      ).toFixed(3)
    );

    return {
      conflictTags: [...new Set(localCrimeDominant ? matchedSignals.filter((tag) => tag !== 'ASSAULT') : matchedSignals)].slice(0, 4),
      eventClass,
      conflictSeverity: Number(Math.max(0, severity).toFixed(3)),
      isViolent: !localCrimeDominant && (
        violentRoot ||
        matchedSignals.some((tag) => ['MISSILE', 'DRONE', 'AIRSTRIKE', 'BOMBING', 'SHELLING', 'TERROR', 'CITY_GAIN', 'GROUND_ASSAULT', 'RAID', 'BATTLE', 'ASSAULT', 'MASS_VIOLENCE'].includes(tag))
      ),
      isConflictRelevant,
      geopoliticalBias,
      publicSafetyBias,
      relevanceScore
    };
  }

  normalizeEvent(raw) {
    if (raw?.countryIso3 && raw?.timestamp && raw?.source) {
      const normalized = {
        ...raw,
        headline: raw.headline || raw.snippet || '',
        summary: raw.summary || raw.snippet || '',
        avgTone: Number.isFinite(Number(raw.avgTone)) ? Number(raw.avgTone) : 0,
        goldstein: Number.isFinite(Number(raw.goldstein)) ? Number(raw.goldstein) : 0,
        themes: this.normalizeThemes(raw.themes),
        sourceKind: raw.sourceKind || 'gdelt',
        feedName: raw.feedName || '',
        conflictTags: Array.isArray(raw.conflictTags) ? raw.conflictTags : [],
        eventClass: raw.eventClass || 'general',
        conflictSeverity: Number.isFinite(Number(raw.conflictSeverity)) ? Number(raw.conflictSeverity) : 0,
        isViolent: Boolean(raw.isViolent),
        isConflictRelevant: raw.isConflictRelevant !== false,
        geopoliticalBias: Number.isFinite(Number(raw.geopoliticalBias)) ? Number(raw.geopoliticalBias) : 0,
        publicSafetyBias: Number.isFinite(Number(raw.publicSafetyBias)) ? Number(raw.publicSafetyBias) : 0,
        relevanceScore: Number.isFinite(Number(raw.relevanceScore)) ? Number(raw.relevanceScore) : 0
      };
      const countrySignalMeta =
        raw.countrySignalScore !== undefined &&
        raw.countrySignalWeight !== undefined &&
        raw.qualifiesForCountrySignal !== undefined
          ? {
              mentionedCountries: Array.isArray(raw.mentionedCountries) ? raw.mentionedCountries : [],
              countrySignalScore: Number(raw.countrySignalScore),
              countrySignalWeight: Number(raw.countrySignalWeight),
              qualifiesForCountrySignal: Boolean(raw.qualifiesForCountrySignal),
              countrySignalClass: raw.countrySignalClass || 'background',
              signalDrivers: Array.isArray(raw.signalDrivers) ? raw.signalDrivers : []
            }
          : this.classifyCountrySignal(normalized);

      return {
        ...normalized,
        ...countrySignalMeta
      };
    }

    const timestamp = Date.parse(
      raw.seendate || raw.date || raw.seenDate || raw.timestamp || new Date().toISOString()
    );
    const source = String(raw.domain || raw.sourcecommonname || raw.source || 'GDELT')
      .replace(/^www\./i, '')
      .trim();
    const snippet = raw.title || raw.snippet || raw.summary || raw.content || 'Untitled event';
    const inferredSignals = this.deriveHeuristicSignals(snippet);
    const hasToneField =
      raw.tone !== undefined || raw.avgTone !== undefined || raw.avg_tone !== undefined;
    const hasGoldsteinField = raw.goldstein !== undefined || raw.goldsteinscale !== undefined;
    const avgTone = hasToneField
      ? Number(raw.tone ?? raw.avgTone ?? raw.avg_tone ?? inferredSignals.avgTone)
      : inferredSignals.avgTone;
    const goldstein = hasGoldsteinField
      ? Number(raw.goldstein ?? raw.goldsteinscale ?? inferredSignals.goldstein)
      : inferredSignals.goldstein;
    const fallbackIdSeed = `${source}|${snippet}|${
      raw.sourcecountry || raw._kompassCountrySlice || raw.country || 'GLOBAL'
    }|${timestamp}`;
    const id = String(raw.id || raw.url || raw.documentIdentifier || fallbackIdSeed);
    const normalizedThemes = this.normalizeThemes(raw.themes || raw.semantics || raw.tags);
    const conflictMeta = this.classifyConflict({
      text: `${snippet} ${raw.url || raw.shareurl || ''}`,
      themes: normalizedThemes.length ? normalizedThemes : inferredSignals.themes,
      eventRootCode: raw.eventrootcode || raw.eventRootCode || raw.eventRoot || '',
      quadClass: raw.quadclass || raw.quadClass || 0
    });

    const normalized = {
      id,
      timestamp: new Date(Number.isFinite(timestamp) ? timestamp : Date.now()).toISOString(),
      countryIso3: this.normalizeCountry(
        raw.sourcecountry ||
          raw._kompassCountrySlice ||
          raw.country ||
          raw.location?.countryCode ||
          raw.countryCode
      ),
      avgTone: Number.isFinite(avgTone) ? avgTone : 0,
      goldstein: Number.isFinite(goldstein) ? goldstein : 0,
      themes: normalizedThemes.length ? normalizedThemes : inferredSignals.themes,
      headline: raw.headline || snippet,
      summary: raw.summary || snippet,
      snippet,
      source,
      url: raw.url || raw.shareurl || '',
      sourceKind: raw.sourceKind || 'gdelt',
      feedName: raw.feedName || '',
      ...conflictMeta
    };
    return {
      ...normalized,
      ...this.classifyCountrySignal(normalized)
    };
  }

  resolveIso3FromText(text) {
    const normalized = normalizeLexiconText(text);
    const match = COUNTRY_TEXT_MATCHES.find((entry) => normalized.includes(entry.term));
    return match?.iso3 || null;
  }

  resolveIso3MatchesFromText(text, limit = 6) {
    const normalized = normalizeLexiconText(text);
    const matches = [];

    for (const entry of COUNTRY_TEXT_MATCHES) {
      if (!normalized.includes(entry.term)) {
        continue;
      }
      if (!matches.includes(entry.iso3)) {
        matches.push(entry.iso3);
      }
      if (matches.length >= limit) {
        break;
      }
    }

    return matches;
  }

  classifyCountrySignal(event) {
    const headline = String(event.headline || event.snippet || '').trim();
    const text = `${headline} ${event.summary || ''} ${event.snippet || ''} ${event.url || ''}`;
    const normalizedText = normalizeLexiconText(text);
    const normalizedHeadline = normalizeLexiconText(headline);
    const mentionedCountries = this.resolveIso3MatchesFromText(text);
    const headlineMentionedCountries = this.resolveIso3MatchesFromText(headline);
    const countryIso3 = this.normalizeCountry(event.countryIso3);
    const countryProfile = getCountryProfile(countryIso3);
    const configuredCountryIso3 = this.normalizeCountry(event.configuredCountryIso3 || event.countryIso3);
    const sourceKind = String(event.sourceKind || '');
    const isDomesticOutlet = Boolean(
      configuredCountryIso3 &&
      configuredCountryIso3 !== 'GLOBAL' &&
      configuredCountryIso3 === countryIso3 &&
      ['country-outlet', 'conflict-outlet'].includes(sourceKind)
    );
    const isCountryWireFeed = Boolean(
      configuredCountryIso3 &&
      configuredCountryIso3 !== 'GLOBAL' &&
      configuredCountryIso3 === countryIso3 &&
      sourceKind === 'country-wire'
    );
    const isCountryPulseFeed = Boolean(
      configuredCountryIso3 &&
      configuredCountryIso3 !== 'GLOBAL' &&
      configuredCountryIso3 === countryIso3 &&
      sourceKind === 'country-pulse'
    );
    const isDomesticFeed = isDomesticOutlet;
    const explicitCountryMention = mentionedCountries.includes(countryIso3);
    const headlineCountryMention = headlineMentionedCountries.includes(countryIso3);
    const macroHits = countMatches(normalizedText, COUNTRY_MACRO_TERMS);
    const governanceHits = countMatches(normalizedText, COUNTRY_INTERNAL_TERMS);
    const humanInterestHits = countMatches(normalizedText, HUMAN_INTEREST_TERMS);
    const syntheticExportHeadline = SYNTHETIC_EXPORT_HEADLINE.test(headline);
    const lowSignalPenalty = COUNTRY_NOISE_PATTERNS.some((pattern) => pattern.test(text))
      ? 2.6
      : 0;
    const domesticConflictBoost =
      event.isConflictRelevant &&
      (
        isDomesticFeed ||
        headlineCountryMention ||
        (event.sourceKind === 'gdelt-export' && headlineCountryMention && mentionedCountries.length <= 2)
      )
        ? 1.2
        : 0;
    const domesticPolicyBoost = Math.min(2.4, (macroHits * 0.55) + (governanceHits * 0.65));
    const configuredBoost =
      sourceKind === 'country-outlet'
          ? 2.1
        : sourceKind === 'country-wire'
          ? 0.95
        : sourceKind === 'country-pulse'
          ? 1.15
        : sourceKind === 'conflict-outlet'
            ? 1.6
            : 0;
    const countryWireBoost =
      isCountryWireFeed && headlineCountryMention
        ? 0.45
        : isCountryWireFeed && explicitCountryMention
          ? 0.18
          : 0;
    const countryPulseSoftBoost =
      isCountryPulseFeed &&
      (headlineCountryMention || macroHits > 0 || governanceHits > 0)
        ? 0.7
        : isCountryPulseFeed
          ? 0.15
          : 0;
    const mentionBoost = headlineCountryMention ? 1.15 : explicitCountryMention ? 0.35 : 0;
    const externalSpilloverPenalty =
      event.isConflictRelevant &&
      !isDomesticFeed &&
      headlineCountryMention &&
      mentionedCountries.length >= 2 &&
      macroHits === 0 &&
      governanceHits === 0 &&
      event.eventClass === 'general'
        ? 1.1
        : 0;
    const genericForeignMentionPenalty =
      !isDomesticFeed &&
      explicitCountryMention &&
      mentionedCountries.length >= 2 &&
      macroHits === 0 &&
      governanceHits === 0
        ? event.eventClass === 'general'
          ? 2.1
          : 1.1
        : 0;
    const bodyOnlyMentionPenalty =
      !isDomesticFeed &&
      explicitCountryMention &&
      !headlineCountryMention
        ? event.eventClass === 'general'
          ? 1.8
          : 1.15
        : 0;
    const multiCountrySpreadPenalty =
      !isDomesticFeed &&
      mentionedCountries.length >= 4
        ? 1.2
        : 0;
    const genericExportPenalty =
      event.sourceKind === 'gdelt-export' &&
      !isDomesticFeed &&
      (!event.isConflictRelevant || !headlineCountryMention) &&
      macroHits === 0 &&
      governanceHits === 0
        ? 1.6
        : 0;
    const syntheticHeadlinePenalty =
      event.sourceKind === 'gdelt-export' &&
      syntheticExportHeadline &&
      !isDomesticFeed
        ? 1.4
        : 0;
    const weakHeadlinePenalty =
      !isDomesticFeed &&
      !headlineCountryMention &&
      macroHits === 0 &&
      governanceHits === 0 &&
      countMatches(normalizedHeadline, GEOPOLITICAL_TERMS) === 0
        ? 0.9
        : 0;
    const countryPulseExternalPenalty =
      isCountryPulseFeed &&
      !headlineCountryMention &&
      macroHits === 0 &&
      governanceHits === 0
        ? 1.45
        : 0;
    const countryPulseSpreadPenalty =
      isCountryPulseFeed && mentionedCountries.length >= 2
        ? headlineCountryMention
          ? 0.55
          : 1.1
        : 0;
    const publicSafetyPenalty = event.eventClass === 'public-safety' ? 2.5 : 0;
    const humanInterestPenalty = Math.min(3.2, (humanInterestHits * 0.9) + lowSignalPenalty);

    const score = Number(
      clamp(
        0.35 +
          configuredBoost +
          countryWireBoost +
          countryPulseSoftBoost +
          mentionBoost +
          domesticPolicyBoost +
          domesticConflictBoost +
          Math.max(0, Number(event.relevanceScore || 0) * 0.22) -
          publicSafetyPenalty -
          humanInterestPenalty -
          externalSpilloverPenalty -
          genericForeignMentionPenalty -
          bodyOnlyMentionPenalty -
          multiCountrySpreadPenalty -
          genericExportPenalty -
          syntheticHeadlinePenalty -
          countryPulseExternalPenalty -
          countryPulseSpreadPenalty -
          weakHeadlinePenalty,
        0,
        8
      ).toFixed(3)
    );

    let qualificationThreshold = 1.8;
    if (isDomesticFeed) {
      qualificationThreshold = 1.25;
    } else if (event.isConflictRelevant) {
      qualificationThreshold = 1.5;
    }
    if (
      !isDomesticFeed &&
      explicitCountryMention &&
      mentionedCountries.length >= 2 &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(qualificationThreshold, 2.4);
    }
    if (
      isCountryWireFeed &&
      !headlineCountryMention &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(qualificationThreshold, 2.75);
    }
    if (
      isCountryWireFeed &&
      mentionedCountries.length >= 2 &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(
        qualificationThreshold,
        headlineCountryMention ? 2.9 : 3.15
      );
    }
    if (
      isCountryPulseFeed &&
      !headlineCountryMention &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(qualificationThreshold, 2.9);
    }
    if (
      isCountryPulseFeed &&
      mentionedCountries.length >= 2 &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(
        qualificationThreshold,
        headlineCountryMention ? 3.1 : 3.35
      );
    }
    if (!isDomesticFeed && explicitCountryMention && !headlineCountryMention) {
      qualificationThreshold = Math.max(qualificationThreshold, 2.85);
    }
    if (
      event.sourceKind === 'gdelt-export' &&
      !isDomesticFeed &&
      event.eventClass === 'general' &&
      macroHits === 0 &&
      governanceHits === 0
    ) {
      qualificationThreshold = Math.max(qualificationThreshold, headlineCountryMention ? 3 : 3.35);
    }

    const qualifiesForCountrySignal = score >= qualificationThreshold;

    let countrySignalClass = 'background';
    if (publicSafetyPenalty || humanInterestPenalty >= 2.4) {
      countrySignalClass = 'background';
    } else if (macroHits + governanceHits >= 2) {
      countrySignalClass = 'macro-policy';
    } else if (event.isConflictRelevant && (isDomesticFeed || headlineCountryMention)) {
      countrySignalClass = 'security-spillover';
    } else if (isDomesticFeed) {
      countrySignalClass = 'domestic-press';
    }

    const signalDrivers = [
      isDomesticFeed ? 'domestic feed' : null,
      isCountryWireFeed ? 'country wire query' : null,
      isCountryPulseFeed ? 'country pulse query' : null,
      headlineCountryMention ? `${countryProfile.name} in headline` : null,
      explicitCountryMention && !headlineCountryMention ? `${countryProfile.name} in body copy` : null,
      macroHits ? 'macro/policy terms' : null,
      governanceHits ? 'domestic politics terms' : null,
      event.isConflictRelevant ? 'conflict-linked' : null,
      syntheticExportHeadline ? 'synthetic export headline' : null,
      publicSafetyPenalty ? 'public-safety downweight' : null,
      humanInterestPenalty >= 2 ? 'human-interest downweight' : null
    ].filter(Boolean);

    return {
      mentionedCountries,
      headlineMentionedCountries,
      countrySignalScore: score,
      countrySignalWeight: Number(clamp(0.1 + score, 0.1, 6).toFixed(3)),
      qualifiesForCountrySignal,
      countrySignalClass,
      signalDrivers
    };
  }

  computeEventConflictScore(event) {
    if (event.eventClass === 'public-safety' || event.isConflictRelevant === false) {
      return Number((Math.max(0, event.volatility || 0) * 0.08).toFixed(3));
    }
    const themeBoost = (event.themes || []).reduce(
      (score, theme) => score + (CONFLICT_THEMES.has(theme) ? 1.2 : 0),
      0
    );
    const toneStress = Math.max(0, -(event.avgTone || 0)) * 0.5;
    const goldsteinStress = Math.max(0, -(event.goldstein || 0)) * 0.6;
    const severityBoost = event.conflictSeverity || 0;
    const classBoost = event.eventClass === 'territory-shift'
      ? 2.8
      : event.eventClass === 'kinetic-strike'
        ? 2.4
        : event.eventClass === 'ground-clash'
          ? 1.9
          : event.eventClass === 'security-incident'
            ? 1.1
            : 0;
    const locationStress = /(gaza|iran|israel|ukraine|russia|yemen|lebanon|sudan|syria)/i.test(
      `${event.snippet || ''} ${event.url || ''}`
    )
      ? 1.4
      : 0;
    const relevanceBoost = Number(event.relevanceScore || 0) * 0.55;
    return Number((themeBoost + toneStress + goldsteinStress + severityBoost + classBoost + locationStress + relevanceBoost).toFixed(3));
  }

  ensureFeedCursorState() {
    if (!this.state.feedCursor) {
      this.state.feedCursor = {
        outlet: 0,
        conflictOutlet: 0,
        pulse: 0,
        shipping: 0
      };
    }
    return this.state.feedCursor;
  }

  rotateSelection(items, cursorKey, count) {
    if (!items.length || count <= 0) {
      return [];
    }

    const cursor = this.ensureFeedCursorState();
    const start = cursor[cursorKey] || 0;
    const selection = [];
    for (let index = 0; index < Math.min(count, items.length); index += 1) {
      selection.push(items[(start + index) % items.length]);
    }
    cursor[cursorKey] = (start + Math.min(count, items.length)) % items.length;
    return selection;
  }

  getRecentCountryWeights(limit = this.config.gdeltPriorityCountryLimit || 18) {
    const recentWeights = new Map();
    for (const event of this.state.recentEvents || []) {
      if (!event?.countryIso3) {
        continue;
      }
      recentWeights.set(
        event.countryIso3,
        (recentWeights.get(event.countryIso3) || 0) +
          1 +
          (event.isConflictRelevant ? 2 : 0) +
          Number(event.relevanceScore || 0)
      );
    }

    return new Map(
      [...recentWeights.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
    );
  }

  sortFeedsByCountryPriority(feeds, recentWeights) {
    return [...feeds].sort((left, right) => {
      const rightWeight = recentWeights.get(right.countryIso3) || 0;
      const leftWeight = recentWeights.get(left.countryIso3) || 0;
      const weightDelta = rightWeight - leftWeight;
      if (weightDelta) {
        return weightDelta;
      }
      const priorityDelta = (left.priority || 99) - (right.priority || 99);
      if (priorityDelta) {
        return priorityDelta;
      }
      return left.name.localeCompare(right.name);
    });
  }

  getPriorityCountries(limit = this.config.gdeltPriorityCountryLimit || 18) {
    const recentCountries = [...this.getRecentCountryWeights(limit).entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([countryIso3]) => countryIso3);

    return [...new Set([...HOTSPOT_COUNTRIES, ...recentCountries])];
  }

  selectConflictOutletFeeds(count) {
    if (!this.config.enableConflictOutletFeeds || !this.conflictOutletFeeds.length || count <= 0) {
      return [];
    }

    const groups = new Map();
    for (const feed of [...this.conflictOutletFeeds].sort((left, right) => {
      const priorityDelta = (left.priority || 99) - (right.priority || 99);
      return priorityDelta || left.name.localeCompare(right.name);
    })) {
      const bucket = groups.get(feed.conflictKey) || [];
      bucket.push(feed);
      groups.set(feed.conflictKey, bucket);
    }

    const selectedFeeds = [];
    for (const [conflictKey, feeds] of groups.entries()) {
      if (selectedFeeds.length >= count) {
        break;
      }
      selectedFeeds.push(...this.rotateSelection(feeds, `conflict:${conflictKey}`, 1));
    }

    for (const [conflictKey, feeds] of groups.entries()) {
      if (selectedFeeds.length >= count) {
        break;
      }

      const remaining = count - selectedFeeds.length;
      const extraSlots = Math.min(remaining, Math.max(0, feeds.length - 1));
      if (!extraSlots) {
        continue;
      }

      const extras = this.rotateSelection(feeds, `conflict:${conflictKey}`, extraSlots)
        .filter((feed) => !selectedFeeds.some((entry) => entry.key === feed.key));
      selectedFeeds.push(...extras);
    }

    return selectedFeeds.slice(0, count);
  }

  buildFeedPlan() {
    const outletBatchSize = Number.isFinite(this.config.gdeltCountryOutletBatchSize)
      ? this.config.gdeltCountryOutletBatchSize
      : 12;
    const conflictOutletBatchSize = Number.isFinite(this.config.gdeltConflictOutletBatchSize)
      ? this.config.gdeltConflictOutletBatchSize
      : 10;
    const pulseBatchSize = Number.isFinite(this.config.gdeltCountryPulseBatchSize)
      ? this.config.gdeltCountryPulseBatchSize
      : 8;
    const shippingBatchSize = Number.isFinite(this.config.gdeltShippingFeedBatchSize)
      ? this.config.gdeltShippingFeedBatchSize
      : 6;
    const socialBatchSize = Number.isFinite(this.config.gdeltSocialFeedBatchSize)
      ? this.config.gdeltSocialFeedBatchSize
      : 4;
    const recentWeights = this.getRecentCountryWeights();
    const priorityCountries = new Set(this.getPriorityCountries());
    const outletPriority = this.sortFeedsByCountryPriority(
      this.countryOutletFeeds.filter((feed) => priorityCountries.has(feed.countryIso3)),
      recentWeights
    );
    const outletOverflow = this.sortFeedsByCountryPriority(
      this.countryOutletFeeds.filter((feed) => !priorityCountries.has(feed.countryIso3)),
      recentWeights
    );
    const pulsePriority = this.sortFeedsByCountryPriority(
      this.countryPulseFeeds.filter((feed) => priorityCountries.has(feed.countryIso3)),
      recentWeights
    );
    const pulseOverflow = this.sortFeedsByCountryPriority(
      this.countryPulseFeeds.filter((feed) => !priorityCountries.has(feed.countryIso3)),
      recentWeights
    );

    const selectedOutletFeeds = [
      ...outletPriority.slice(0, outletBatchSize),
      ...this.rotateSelection(
        outletOverflow,
        'outlet',
        Math.max(0, outletBatchSize - outletPriority.length)
      )
    ].slice(0, outletBatchSize);
    const selectedConflictOutletFeeds = this.selectConflictOutletFeeds(conflictOutletBatchSize);

    const selectedPulseFeeds = this.config.enableCountryPulseFeeds
      ? [
          ...pulsePriority.slice(0, pulseBatchSize),
          ...this.rotateSelection(
            pulseOverflow,
            'pulse',
            Math.max(0, pulseBatchSize - pulsePriority.length)
          )
        ].slice(0, pulseBatchSize)
      : [];

    const selectedSocialFeeds = this.config.enableSocialFeeds
      ? this.socialFeeds.slice(0, socialBatchSize)
      : [];
    const selectedShippingFeeds = this.config.enableShippingFeeds
      ? this.rotateSelection(
          [...this.shippingFeeds].sort((left, right) => (left.priority || 99) - (right.priority || 99)),
          'shipping',
          shippingBatchSize
        )
      : [];

    return {
      globalFeeds: this.globalFeeds,
      outletFeeds: selectedOutletFeeds,
      conflictOutletFeeds: selectedConflictOutletFeeds,
      pulseFeeds: selectedPulseFeeds,
      shippingFeeds: selectedShippingFeeds,
      socialFeeds: selectedSocialFeeds,
      configuredOutletCount: this.countryOutletFeeds.length,
      configuredConflictOutletCount: this.conflictOutletFeeds.length,
      configuredGlobalCount: this.globalFeeds.length,
      configuredPulseCount: this.countryPulseFeeds.length,
      configuredShippingCount: this.shippingFeeds.length,
      configuredSocialCount: this.socialFeeds.length
    };
  }

  async fetchFeedXml(url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 4_500) : null;
    let response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          accept: 'application/rss+xml, application/xml, text/xml',
          'user-agent': 'Kompass/0.2'
        },
        signal: controller?.signal
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    if (!response.ok) {
      throw new Error(`RSS feed request failed with ${response.status}`);
    }

    return response.text();
  }

  async fetchBlueskyFeed(handle, limit = 10) {
    const response = await this.fetchImpl(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=${limit}`,
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'Kompass/0.3'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Bluesky feed request failed with ${response.status}`);
    }

    return response.json();
  }

  normalizeRssEvent(item, feed) {
    const inferredSource = extractGoogleNewsSourceLabel(item);
    const title = cleanRssHeadline(String(item?.title || '').trim(), inferredSource || feed.outletLabel);
    const summary = String(
      item?.contentSnippet || item?.content || item?.summary || item?.description || ''
    ).replace(/<[^>]+>/g, ' ');
    const combinedText = `${title}. ${summary}`.trim();
    if (isLowSignalArticle(combinedText)) {
      return null;
    }
    const derivedCountryIso3 = this.resolveIso3FromText(
      `${combinedText} ${(item?.categories || []).join(' ')} ${feed.name}`
    );
    const countryIso3 = derivedCountryIso3 || feed.countryIso3;

    if (!countryIso3) {
      return null;
    }

    const inferredSignals = this.deriveHeuristicSignals(combinedText);
    const conflictMeta = this.classifyConflict({
      text: `${combinedText} ${item?.link || ''}`,
      themes: inferredSignals.themes
    });
    return {
      id: String(item?.guid || item?.id || item?.link || `${feed.name}|${title}`),
      timestamp: new Date(item?.isoDate || item?.pubDate || Date.now()).toISOString(),
      countryIso3,
      avgTone: inferredSignals.avgTone,
      goldstein: inferredSignals.goldstein,
      themes: inferredSignals.themes,
      headline: title || combinedText.slice(0, 160) || `${feed.name} bulletin`,
      summary: cleanWhitespace(summary).slice(0, 240) || title || `${feed.name} bulletin`,
      snippet: title || combinedText.slice(0, 160) || `${feed.name} bulletin`,
      source: inferredSource || feed.outletLabel || extractDomainFromUrl(item?.link) || feed.name,
      url: String(item?.link || ''),
      sourceKind: feed.sourceKind || 'rss',
      feedName: feed.name,
      configuredCountryIso3: feed.countryIso3 || null,
      configuredOutletLabel: feed.outletLabel || null,
      ...conflictMeta
    };
  }

  normalizeBlueskyEvent(entry, feed) {
    const post = entry?.post || {};
    const record = post.record || {};
    const external = post.embed?.external || record.embed?.external || {};
    const headline = cleanWhitespace(external.title || record.text || '');
    const summary = cleanWhitespace(external.description || record.text || '');
    const combinedText = `${headline}. ${summary}`.trim();
    if (isLowSignalArticle(combinedText)) {
      return null;
    }
    const countryIso3 = this.resolveIso3FromText(
      `${combinedText} ${(feed.countryIso3Hints || []).join(' ')} ${feed.label}`
    ) || feed.countryIso3Hints?.[0];

    if (!countryIso3 || !combinedText) {
      return null;
    }

    const inferredSignals = this.deriveHeuristicSignals(combinedText);
    const conflictMeta = this.classifyConflict({
      text: `${combinedText} ${external.uri || feed.url}`,
      themes: inferredSignals.themes
    });

    return {
      id: String(post.uri || `${feed.handle}|${record.createdAt}|${headline}`),
      timestamp: new Date(record.createdAt || post.indexedAt || Date.now()).toISOString(),
      countryIso3,
      avgTone: inferredSignals.avgTone,
      goldstein: inferredSignals.goldstein,
      themes: inferredSignals.themes,
      headline: headline || `${feed.label} social bulletin`,
      summary: summary || headline || `${feed.label} social bulletin`,
      snippet: headline || summary || `${feed.label} social bulletin`,
      source: feed.label,
      url: external.uri || feed.url,
      sourceKind: feed.sourceKind || 'social-bluesky',
      feedName: feed.label,
      configuredCountryIso3: feed.countryIso3Hints?.[0] || null,
      configuredOutletLabel: feed.label,
      ...conflictMeta
    };
  }

  buildExportThemes({ eventRootCode, quadClass, text }) {
    const rootTheme = EVENT_THEME_MAP[String(eventRootCode || '').padStart(2, '0')] || [];
    const quadThemes = {
      1: ['COOPERATION'],
      2: ['MATERIAL_SUPPORT'],
      3: ['TENSION'],
      4: ['SECURITY']
    };
    const heuristicThemes = this.deriveHeuristicSignals(text).themes || [];
    return [...new Set([...rootTheme, ...(quadThemes[Number(quadClass)] || []), ...heuristicThemes])];
  }

  buildExportHeadline({ actor1Name, actor2Name, actionGeoFullName, url, eventRootCode }) {
    const urlHeadline = extractHeadlineFromUrl(url);
    if (urlHeadline) {
      return urlHeadline;
    }

    const place = prettifyPlaceLabel(actionGeoFullName) || 'the reported area';
    const actors = uniqueActors(actor1Name, actor2Name, place);
    const eventLabel = eventLabelFromCode(eventRootCode);

    if (actors.length >= 2) {
      return `${eventLabel} near ${place}: ${actors[0]} and ${actors[1]}`;
    }
    if (actors.length === 1) {
      return `${eventLabel} near ${place}: ${actors[0]}`;
    }
    return `${eventLabel} near ${place}`;
  }

  buildExportSummary({ actor1Name, actor2Name, actionGeoFullName, eventRootCode, source, conflictMeta = {} }) {
    const place = prettifyPlaceLabel(actionGeoFullName) || 'the reported area';
    const actors = uniqueActors(actor1Name, actor2Name, place);
    const eventLabel = summarizeSignalClass(conflictMeta, eventRootCode);

    if (actors.length >= 2) {
      return `${eventLabel} near ${place}, involving ${actors[0]} and ${actors[1]}. Source: ${source}.`;
    }
    if (actors.length === 1) {
      return `${eventLabel} near ${place}, involving ${actors[0]}. Source: ${source}.`;
    }
    if (source) {
      return `${eventLabel} near ${place}. Source: ${source}.`;
    }
    return `${eventLabel} near ${place}.`;
  }

  normalizeExportEvent(columns) {
    const actor1Name = String(columns[6] || '').trim();
    const actor2Name = String(columns[16] || '').trim();
    const actionGeoFullName = String(columns[52] || '').trim();
    const actor1GeoFullName = String(columns[36] || '').trim();
    const actor2GeoFullName = String(columns[43] || '').trim();
    const url = String(columns[60] || '').trim();
    const countryName =
      extractCountryName(actionGeoFullName) ||
      extractCountryName(actor1GeoFullName) ||
      extractCountryName(actor2GeoFullName);
    const countryIso3 = resolveIso3FromCountryName(countryName);
    const eventRootCode = String(columns[28] || '').trim();
    const eventCode = String(columns[26] || '').trim();
    const quadClass = Number(columns[29] || 0);
    const tone = Number(columns[34] || 0);
    const goldstein = Number(columns[30] || 0);
    const source = extractDomainFromUrl(url) || 'GDELT Export';
    const headline = this.buildExportHeadline({
      actor1Name,
      actor2Name,
      actionGeoFullName: actionGeoFullName || actor1GeoFullName || actor2GeoFullName,
      url,
      eventRootCode
    });
    const classifierText = [
      headline,
      actionGeoFullName || actor1GeoFullName || actor2GeoFullName,
      actor1Name,
      actor2Name,
      url
    ]
      .filter(Boolean)
      .join(' ');
    const themes = this.buildExportThemes({
      eventRootCode,
      quadClass,
      text: classifierText
    });
    const conflictMeta = this.classifyConflict({
      text: classifierText,
      themes,
      eventRootCode: eventRootCode || eventCode,
      quadClass
    });
    const summary = this.buildExportSummary({
      actor1Name,
      actor2Name,
      actionGeoFullName: actionGeoFullName || actor1GeoFullName || actor2GeoFullName,
      eventRootCode,
      source,
      conflictMeta
    });

    if (!countryIso3) {
      return null;
    }

    return {
      id: String(columns[0] || `${countryIso3}|${url}|${columns[59] || Date.now()}`),
      timestamp: parseDateAdded(columns[59]),
      countryIso3,
      avgTone: Number.isFinite(tone) ? tone : 0,
      goldstein: Number.isFinite(goldstein) ? goldstein : 0,
      themes: themes.length ? themes : ['HEADLINES'],
      headline,
      summary,
      snippet: headline,
      source,
      url,
      sourceKind: 'gdelt-export',
      feedName: 'GDELT Export',
      eventRootCode,
      eventCode,
      ...conflictMeta
    };
  }

  deduplicate(events) {
    const deduped = new Map();
    for (const event of events) {
      const sourceKey = String(event.source || '').trim().toLowerCase();
      const headlineKey = normalizeHeadlineKey(event.headline || event.snippet || event.summary);
      const fallbackKey = normalizeHeadlineKey(event.url || event.snippet || event.summary);
      const key = `${sourceKey}|${headlineKey || fallbackKey}|${event.countryIso3}`;
      if (!deduped.has(key)) {
        deduped.set(key, event);
      }
    }
    return [...deduped.values()];
  }

  compactStateEvent(event) {
    return {
      id: String(event.id || '').slice(0, 240),
      timestamp: event.timestamp,
      countryIso3: event.countryIso3,
      avgTone: Number(event.avgTone || 0),
      goldstein: Number(event.goldstein || 0),
      themes: Array.isArray(event.themes) ? event.themes.slice(0, 5) : [],
      headline: String(event.headline || event.snippet || '').slice(0, 128),
      summary: String(event.summary || event.snippet || '').slice(0, 160),
      snippet: String(event.snippet || event.headline || '').slice(0, 128),
      source: String(event.source || '').slice(0, 80),
      url: String(event.url || '').slice(0, 280),
      sourceKind: event.sourceKind || 'gdelt',
      conflictTags: Array.isArray(event.conflictTags) ? event.conflictTags.slice(0, 4) : [],
      eventClass: event.eventClass || 'general',
      conflictSeverity: Number(event.conflictSeverity || 0),
      isViolent: Boolean(event.isViolent),
      isConflictRelevant: event.isConflictRelevant !== false,
      geopoliticalBias: Number(event.geopoliticalBias || 0),
      publicSafetyBias: Number(event.publicSafetyBias || 0),
      relevanceScore: Number(event.relevanceScore || 0),
      toneDelta: Number(event.toneDelta || 0),
      volatility: Number(event.volatility || 0),
      sourceCount: Number(event.sourceCount || 0),
      clusterSize: Number(event.clusterSize || 0),
      corroboratingSources: Array.isArray(event.corroboratingSources)
        ? event.corroboratingSources
          .map((source) => String(source || '').slice(0, 64))
          .filter(Boolean)
          .slice(0, 3)
        : [],
      qualifiesForCountrySignal: Boolean(event.qualifiesForCountrySignal),
      countrySignalClass: event.countrySignalClass || 'background',
      countrySignalScore: Number(event.countrySignalScore || 0),
      signalDrivers: Array.isArray(event.signalDrivers) ? event.signalDrivers.slice(0, 3) : []
    };
  }

  tokenizeClusterText(event) {
    return new Set(
      normalizeHeadlineKey(`${event.headline || ''} ${event.summary || ''}`)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !CLUSTER_STOPWORDS.has(token))
    );
  }

  eventPriorityScore(event) {
    const penalty = event.eventClass === 'public-safety' ? 5 : 0;
    return (
      Number(event.volatility || 0) +
      this.computeEventConflictScore(event) +
      Number(event.relevanceScore || 0) -
      penalty
    );
  }

  clusterSimilarity(left, right) {
    const leftTokens = this.tokenizeClusterText(left);
    const rightTokens = this.tokenizeClusterText(right);
    if (!leftTokens.size || !rightTokens.size) {
      return 0;
    }

    const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
    const themeOverlap = (left.themes || []).filter((theme) => (right.themes || []).includes(theme));
    const tagOverlap = (left.conflictTags || []).filter((tag) => (right.conflictTags || []).includes(tag));
    const overlapRatio = overlap.length / Math.min(leftTokens.size, rightTokens.size);
    const locationBonus = left.countryIso3 && right.countryIso3 && left.countryIso3 === right.countryIso3 ? 0.18 : 0;
    const classBonus = left.eventClass && right.eventClass && left.eventClass === right.eventClass ? 0.12 : 0;
    const tagBonus = tagOverlap.length ? 0.16 : 0;
    const themeBonus = themeOverlap.length ? 0.08 : 0;

    return overlapRatio + locationBonus + classBonus + tagBonus + themeBonus;
  }

  clusterEvents(events, { limit = 5 } = {}) {
    const sorted = [...(events || [])].sort((left, right) => this.eventPriorityScore(right) - this.eventPriorityScore(left));
    const clusters = [];

    for (const event of sorted) {
      const matchingCluster = clusters.find((cluster) => {
        const countryCompatible =
          !cluster.anchor.countryIso3 ||
          !event.countryIso3 ||
          cluster.anchor.countryIso3 === event.countryIso3;
        if (!countryCompatible) {
          return false;
        }

        return this.clusterSimilarity(cluster.anchor, event) >= 0.78;
      });

      if (matchingCluster) {
        matchingCluster.items.push(event);
        matchingCluster.sources.add(event.source);
        matchingCluster.sourceKinds.add(event.sourceKind || 'gdelt');
        if (Date.parse(event.timestamp || 0) > Date.parse(matchingCluster.latestTimestamp || 0)) {
          matchingCluster.latestTimestamp = event.timestamp;
        }
        if (this.eventPriorityScore(event) > this.eventPriorityScore(matchingCluster.anchor)) {
          matchingCluster.anchor = event;
        }
        continue;
      }

      clusters.push({
        anchor: event,
        items: [event],
        latestTimestamp: event.timestamp,
        sources: new Set([event.source]),
        sourceKinds: new Set([event.sourceKind || 'gdelt'])
      });
    }

    return clusters
      .sort((left, right) => {
        const leftScore = this.eventPriorityScore(left.anchor) + (left.sources.size * 0.45) + (left.items.length * 0.12);
        const rightScore = this.eventPriorityScore(right.anchor) + (right.sources.size * 0.45) + (right.items.length * 0.12);
        return rightScore - leftScore;
      })
      .slice(0, limit)
      .map((cluster, index) => {
        const anchor = cluster.anchor;
        const relatedReports = Math.max(0, cluster.items.length - 1);
        const sourceCount = cluster.sources.size || 1;
        const summary = relatedReports > 0
          ? `${(anchor.summary || anchor.snippet || '').slice(0, 180)} Clustered from ${cluster.items.length} matching reports across ${sourceCount} sources.`
          : (anchor.summary || anchor.snippet || '').slice(0, 220);

        return {
          ...anchor,
          id: `${anchor.id || anchor.url || 'cluster'}:cluster:${index}`,
          sourceCount,
          clusterSize: cluster.items.length,
          corroboratingSources: [...cluster.sources],
          corroboratingSourceKinds: [...cluster.sourceKinds],
          latestTimestamp: cluster.latestTimestamp,
          headline: (anchor.headline || anchor.snippet).slice(0, 160),
          summary: summary.slice(0, 240),
          snippet: (anchor.snippet || anchor.headline || '').slice(0, 160)
        };
      });
  }

  pickCountrySignalEvents(events, { includeBackground = false } = {}) {
    const safeEvents = (events || []).filter(Boolean);
    const qualified = safeEvents.filter((event) => event.qualifiesForCountrySignal);

    if (includeBackground) {
      return safeEvents.filter((event) => !event.qualifiesForCountrySignal);
    }

    if (qualified.length >= Math.max(2, Math.floor(safeEvents.length * 0.2))) {
      return qualified;
    }

    const scoredFallback = safeEvents
      .filter((event) => Number(event.countrySignalScore || 0) >= 1.1)
      .sort((left, right) => Number(right.countrySignalScore || 0) - Number(left.countrySignalScore || 0));

    return scoredFallback.length ? scoredFallback : safeEvents;
  }

  buildSourceBreakdown(events, limit = 10) {
    const buckets = new Map();
    const safeEvents = events.filter(Boolean);
    const total = safeEvents.length || 1;

    for (const event of safeEvents) {
      const source = String(event.source || 'Unknown').trim() || 'Unknown';
      const sourceKind = String(event.sourceKind || 'gdelt').trim() || 'gdelt';
      const bucket = buckets.get(source) || {
        source,
        eventCount: 0,
        latestTimestamp: null,
        sampleSnippets: [],
        sourceKinds: new Map()
      };

      bucket.eventCount += 1;
      bucket.sourceKinds.set(sourceKind, (bucket.sourceKinds.get(sourceKind) || 0) + 1);
      if (!bucket.latestTimestamp || Date.parse(event.timestamp) > Date.parse(bucket.latestTimestamp)) {
        bucket.latestTimestamp = event.timestamp;
      }
      if (event.snippet && !bucket.sampleSnippets.includes(event.snippet) && bucket.sampleSnippets.length < 2) {
        bucket.sampleSnippets.push(event.snippet);
      }

      buckets.set(source, bucket);
    }

    return [...buckets.values()]
      .sort((left, right) => right.eventCount - left.eventCount)
      .slice(0, limit)
      .map((bucket) => {
        const sourceKinds = [...bucket.sourceKinds.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([sourceKind, eventCount]) => ({
            sourceKind,
            eventCount,
            share: Number((eventCount / bucket.eventCount).toFixed(3))
          }));

        return {
          source: bucket.source,
          eventCount: bucket.eventCount,
          share: Number((bucket.eventCount / total).toFixed(3)),
          latestTimestamp: bucket.latestTimestamp,
          dominantSourceKind: sourceKinds[0]?.sourceKind || 'gdelt',
          sourceKinds,
          sampleSnippets: bucket.sampleSnippets
        };
      });
  }

  buildSourceLens(events, limit = 10) {
    const safeEvents = events.filter(Boolean);
    return {
      eventCount: safeEvents.length,
      uniqueSources: new Set(safeEvents.map((event) => event.source)).size,
      configuredOutlets: countConfiguredOutlets(safeEvents),
      feedMix: topFeedKindsForEvents(safeEvents),
      topThemes: topThemesForEvents(safeEvents, 4),
      breakdown: this.buildSourceBreakdown(safeEvents, limit),
      lastUpdated: safeEvents[0]?.timestamp || null
    };
  }

  aggregateByCountry(events) {
    const buckets = new Map();

    for (const event of events) {
      const bucket = buckets.get(event.countryIso3) || {
        region: event.countryIso3,
        events: []
      };
      bucket.events.push(event);
      buckets.set(event.countryIso3, bucket);
    }

    return [...buckets.values()].map((bucket) => {
      const signalEvents = this.pickCountrySignalEvents(bucket.events);
      const weights = signalEvents.map((event) => event.countrySignalWeight || 1);
      const avgTone = weightedAverage(
        signalEvents.map((event) => event.avgTone),
        weights
      );
      const goldstein = weightedAverage(
        signalEvents.map((event) => event.goldstein),
        weights
      );
      const volatility = weightedAverage(
        signalEvents.map((event) => Math.abs(event.avgTone) + Math.abs(event.goldstein)),
        weights
      );
      const conflictScore = weightedAverage(
        signalEvents.map((event) => this.computeEventConflictScore(event)),
        weights
      );

      return {
        region: bucket.region,
        avgTone,
        goldstein,
        eventCount: signalEvents.length,
        rawEventCount: bucket.events.length,
        signalShare: Number((signalEvents.length / Math.max(1, bucket.events.length)).toFixed(3)),
        topThemes: topThemesForEvents(signalEvents),
        topConflictTags: topConflictTagsForEvents(signalEvents),
        sourceCount: new Set(signalEvents.map((event) => event.source)).size,
        rawSourceCount: new Set(bucket.events.map((event) => event.source)).size,
        configuredOutletCount: countConfiguredOutlets(signalEvents),
        topSources: topSourcesForEvents(signalEvents, 4).map(({ source, eventCount }) => ({
          source,
          eventCount
        })),
        feedMix: topFeedKindsForEvents(signalEvents),
        conflictScore,
        volatility
      };
    });
  }

  computeGlobalAggregate(events) {
    return {
      avgTone: average(events.map((event) => event.avgTone)),
      goldstein: average(events.map((event) => event.goldstein)),
      eventCount: events.length,
      topThemes: topThemesForEvents(events),
      topConflictTags: topConflictTagsForEvents(events),
      sourceCount: new Set(events.map((event) => event.source)).size,
      configuredOutletCount: countConfiguredOutlets(events),
      topSources: topSourcesForEvents(events, 6),
      feedMix: topFeedKindsForEvents(events),
      conflictScore: average(events.map((event) => this.computeEventConflictScore(event))),
      countryCount: new Set(events.map((event) => event.countryIso3)).size
    };
  }

  deriveConflictScoreFromAggregate({ avgTone, goldstein, topThemes, topConflictTags, eventCount }) {
    const themeBoost = (topThemes || []).reduce(
      (score, theme) => score + (CONFLICT_THEMES.has(theme) ? 0.9 : 0),
      0
    );
    const tagBoost = (topConflictTags || []).length * 1.25;
    const toneStress = Math.max(0, -(avgTone || 0)) * 0.55;
    const goldsteinStress = Math.max(0, -(goldstein || 0)) * 0.7;
    const eventWeight = Math.min(3, Math.log10((eventCount || 0) + 1));
    return Number((themeBoost + tagBoost + toneStress + goldsteinStress + eventWeight).toFixed(3));
  }

  getRegionSourceBreakdown(region, limit = 10) {
    const events = (this.state.lastLiveEvents || this.state.recentEvents || []).filter(
      (event) => event.countryIso3 === region
    );
    return this.buildSourceBreakdown(this.pickCountrySignalEvents(events), limit);
  }

  getRegionSourceLens(region, windowMs = 24 * 60 * 60_000) {
    const liveEvents = (this.state.lastLiveEvents || this.state.recentEvents || []).filter(
      (event) => event.countryIso3 === region
    );
    const cutoff = Date.now() - windowMs;
    const memoryEvents = (this.state.eventArchive || [])
      .filter((event) => event.countryIso3 === region)
      .filter((event) => Date.parse(event.timestamp) >= cutoff);

    const liveSignalEvents = this.pickCountrySignalEvents(liveEvents);
    const memorySignalEvents = this.pickCountrySignalEvents(memoryEvents);

    return {
      liveWindow: this.buildSourceLens(liveSignalEvents),
      memory24h: this.buildSourceLens(memorySignalEvents),
      rawLiveWindow: this.buildSourceLens(liveEvents),
      rawMemory24h: this.buildSourceLens(memoryEvents),
      backgroundLiveWindow: this.buildSourceLens(this.pickCountrySignalEvents(liveEvents, { includeBackground: true })),
      backgroundMemory24h: this.buildSourceLens(this.pickCountrySignalEvents(memoryEvents, { includeBackground: true }))
    };
  }

  getFocusedRegionFeeds(region) {
    const normalizedRegion = this.normalizeCountry(region);
    const outletFeeds = this.countryOutletFeeds
      .filter((feed) => feed.countryIso3 === normalizedRegion)
      .sort((left, right) => (left.priority || 99) - (right.priority || 99))
      .slice(0, 5);
    const pulseFeeds = this.countryPulseFeeds
      .filter((feed) => feed.countryIso3 === normalizedRegion)
      .sort((left, right) => (left.priority || 99) - (right.priority || 99))
      .slice(0, 4);
    const conflictFeeds = this.conflictOutletFeeds
      .filter((feed) => feed.countryIso3 === normalizedRegion)
      .sort((left, right) => (left.priority || 99) - (right.priority || 99))
      .slice(0, 3);

    return {
      rssFeeds: [...outletFeeds, ...pulseFeeds, ...conflictFeeds],
      socialFeeds: this.socialFeeds
        .filter((feed) => (feed.countryIso3Hints || []).includes(normalizedRegion))
        .slice(0, 2)
    };
  }

  async fetchFocusedRegionFeedEvents(region) {
    const normalizedRegion = this.normalizeCountry(region);
    const focusedFeeds = this.getFocusedRegionFeeds(normalizedRegion);
    const rssSettled = await Promise.allSettled(
      focusedFeeds.rssFeeds.map((feed) => this.fetchRssFeedEvents(feed))
    );
    const socialSettled = await Promise.allSettled(
      focusedFeeds.socialFeeds.map((feed) => this.fetchSocialFeedEvents(feed))
    );

    const events = [];
    const failures = [];
    const respondingFeeds = [];

    rssSettled.forEach((result, index) => {
      const feed = focusedFeeds.rssFeeds[index];
      if (result.status === 'fulfilled') {
        const normalizedEvents = result.value
          .map((event) => this.normalizeEvent(event))
          .filter((event) => event.countryIso3 === normalizedRegion);
        if (normalizedEvents.length) {
          respondingFeeds.push({
            key: feed.key,
            name: feed.name,
            outletLabel: feed.outletLabel || feed.name,
            sourceKind: feed.sourceKind,
            url: feed.url
          });
          events.push(...normalizedEvents);
        }
        return;
      }

      failures.push({
        feed: feed.name,
        error: result.reason?.message || String(result.reason)
      });
    });

    socialSettled.forEach((result, index) => {
      const feed = focusedFeeds.socialFeeds[index];
      if (result.status === 'fulfilled') {
        const normalizedEvents = result.value
          .map((event) => this.normalizeEvent(event))
          .filter((event) => event.countryIso3 === normalizedRegion);
        if (normalizedEvents.length) {
          respondingFeeds.push({
            key: feed.key,
            name: feed.label,
            outletLabel: feed.label,
            sourceKind: feed.sourceKind,
            url: feed.url
          });
          events.push(...normalizedEvents);
        }
        return;
      }

      failures.push({
        feed: feed.label,
        error: result.reason?.message || String(result.reason)
      });
    });

    return {
      events: this.deduplicate(events),
      focusedFeeds,
      respondingFeeds,
      failures
    };
  }

  buildFocusedFeedSnapshot(region, sourceLens = null) {
    const normalizedRegion = this.normalizeCountry(region);
    const focusedFeeds = this.getFocusedRegionFeeds(normalizedRegion);
    const configured = [
      ...focusedFeeds.rssFeeds.map((feed) => ({
        key: feed.key,
        name: feed.name,
        outletLabel: feed.outletLabel || feed.name,
        sourceKind: feed.sourceKind,
        url: feed.url
      })),
      ...focusedFeeds.socialFeeds.map((feed) => ({
        key: feed.key,
        name: feed.label,
        outletLabel: feed.label,
        sourceKind: feed.sourceKind,
        url: feed.url
      }))
    ];

    const liveBreakdown = sourceLens?.raw?.breakdown || sourceLens?.qualified?.breakdown || [];
    const responding = configured
      .map((feed) => {
        const feedAliases = [
          normalizeOutletFingerprint(feed.key),
          normalizeOutletFingerprint(feed.name),
          normalizeOutletFingerprint(feed.outletLabel),
          normalizeOutletFingerprint(hostnameFromUrl(feed.url))
        ].filter(Boolean);

        const match = liveBreakdown.find((entry) => {
          const sourceFingerprint = normalizeOutletFingerprint(entry.source);
          return feedAliases.some((alias) =>
            alias && sourceFingerprint && (alias.includes(sourceFingerprint) || sourceFingerprint.includes(alias))
          );
        });

        if (!match) {
          return null;
        }

        return {
          ...feed,
          eventCount: match.eventCount,
          share: match.share,
          latestTimestamp: match.latestTimestamp
        };
      })
      .filter(Boolean);

    return {
      configured,
      responding,
      failures: []
    };
  }

  buildInspectionEventSummary(event, region, qualified) {
    const country = getCountryProfile(region);
    const driverText = (event.signalDrivers || []).slice(0, 2).join(' + ');

    if (!qualified) {
      return `Indirect reference linked to ${country.name}${driverText ? ` via ${driverText}` : ''}. It remains visible for context but is not weighted heavily in the country mood score.`;
    }

    if (event.countrySignalClass === 'macro-policy') {
      return `${country.name} qualified on macro or domestic-policy language${driverText ? ` (${driverText})` : ''}.`;
    }
    if (event.countrySignalClass === 'security-spillover') {
      return `${country.name} qualified as a directly anchored conflict or security signal${driverText ? ` (${driverText})` : ''}.`;
    }
    if (event.countrySignalClass === 'domestic-press') {
      return `${country.name} qualified through domestic outlets or clearly local reporting${driverText ? ` (${driverText})` : ''}.`;
    }
    return `${country.name} qualified for country mood analysis${driverText ? ` (${driverText})` : ''}.`;
  }

  buildInspectionEventHeadline(event, region, qualified) {
    const country = getCountryProfile(region);
    const rawHeadline = String(event.headline || event.snippet || '').trim();
    const headlineText = normalizeLexiconText(rawHeadline);
    const directCountryMention = [
      country.name,
      ...(country.demonyms || [])
    ]
      .map((entry) => normalizeLexiconText(entry))
      .filter(Boolean)
      .some((entry) => headlineText.includes(entry));
    const tagText = (event.conflictTags || [])
      .slice(0, 2)
      .map((tag) => String(tag).replace(/_/g, ' ').toLowerCase())
      .join(' / ');

    if (
      qualified &&
      directCountryMention &&
      !SYNTHETIC_EXPORT_HEADLINE.test(rawHeadline) &&
      rawHeadline.length >= 18 &&
      rawHeadline.length <= 160 &&
      rawHeadline.split(/\s+/).length >= 4
    ) {
      return rawHeadline;
    }

    if (event.countrySignalClass === 'macro-policy') {
      return `${country.name} domestic macro / policy signal${tagText ? ` - ${tagText}` : ''}`;
    }
    if (event.countrySignalClass === 'security-spillover') {
      return `${country.name} directly anchored security signal${tagText ? ` - ${tagText}` : ''}`;
    }
    if (event.countrySignalClass === 'domestic-press') {
      return `${country.name} domestic reporting signal${tagText ? ` - ${tagText}` : ''}`;
    }
    return `Indirect reference linked to ${country.name}${tagText ? ` - ${tagText}` : ''}`;
  }

  decorateInspectionEvent(event, region, qualified) {
    return {
      ...event,
      rawHeadline: event.headline || event.snippet || '',
      displayHeadline: this.buildInspectionEventHeadline(event, region, qualified),
      inspectionSummary: this.buildInspectionEventSummary(event, region, qualified),
      signalConfidence:
        (event.sourceCount || 1) >= 5
          ? 'high'
          : (event.sourceCount || 1) >= 2
            ? 'medium'
            : 'low'
    };
  }

  async getRegionInspection(region, options = {}) {
    const normalizedRegion = this.normalizeCountry(region);
    const windowMs = options.windowMs || (72 * 60 * 60_000);

    return this.cache.wrap(
      `region-inspection:${normalizedRegion}:${windowMs}`,
      async () => {
        const cutoff = Date.now() - windowMs;
        const liveAndArchiveEvents = this.deduplicate([
          ...((this.state.lastLiveEvents || this.state.recentEvents || [])
            .filter((event) => event.countryIso3 === normalizedRegion)
            .filter((event) => Date.parse(event.timestamp) >= cutoff)
            .map((event) => this.normalizeEvent(event))),
          ...((this.state.eventArchive || [])
            .filter((event) => event.countryIso3 === normalizedRegion)
            .filter((event) => Date.parse(event.timestamp) >= cutoff)
            .map((event) => this.normalizeEvent(event)))
        ]);

        const qualifiedEvents = this.pickCountrySignalEvents(liveAndArchiveEvents);
        const backgroundEvents = this.pickCountrySignalEvents(liveAndArchiveEvents, { includeBackground: true });
        const clusteredQualified = this.clusterEvents(qualifiedEvents, { limit: 12 })
          .map((event) => this.decorateInspectionEvent(event, normalizedRegion, true));
        const clusteredBackground = this.clusterEvents(backgroundEvents, { limit: 8 })
          .map((event) => this.decorateInspectionEvent(event, normalizedRegion, false));
        const sourceLens = {
          qualified: this.buildSourceLens(qualifiedEvents),
          background: this.buildSourceLens(backgroundEvents),
          raw: this.buildSourceLens(liveAndArchiveEvents)
        };

        return {
          region: normalizedRegion,
          rawEventCount: liveAndArchiveEvents.length,
          qualifiedEventCount: qualifiedEvents.length,
          backgroundEventCount: backgroundEvents.length,
          signalShare: Number((qualifiedEvents.length / Math.max(1, liveAndArchiveEvents.length)).toFixed(3)),
          qualifiedEvents: clusteredQualified,
          backgroundEvents: clusteredBackground,
          sourceLens,
          focusedFeeds: this.buildFocusedFeedSnapshot(normalizedRegion, sourceLens)
        };
      },
      90_000
    );
  }

  getMockEvents() {
    return [
      {
        id: 'mock-1',
        timestamp: new Date().toISOString(),
        countryIso3: 'USA',
        avgTone: -4.2,
        goldstein: -3.6,
        themes: ['ECONOMY', 'INFLATION', 'POLITICS'],
        snippet: 'US fiscal tensions and inflation headlines drag the public mood lower.',
        source: 'MockWire-US'
      },
      {
        id: 'mock-2',
        timestamp: new Date(Date.now() - 12 * 60_000).toISOString(),
        countryIso3: 'DEU',
        avgTone: 2.3,
        goldstein: 1.8,
        themes: ['ENERGY', 'INDUSTRY', 'TRADE'],
        snippet: 'Industrial optimism offsets broader energy anxiety in Germany.',
        source: 'MockWire-EU'
      },
      {
        id: 'mock-3',
        timestamp: new Date(Date.now() - 20 * 60_000).toISOString(),
        countryIso3: 'JPN',
        avgTone: 3.1,
        goldstein: 2.6,
        themes: ['TECH', 'SUPPLY_CHAIN', 'EXPORTS'],
        snippet: 'Technology exports and supply chain resilience improve sentiment.',
        source: 'MockWire-Asia'
      },
      {
        id: 'mock-4',
        timestamp: new Date(Date.now() - 35 * 60_000).toISOString(),
        countryIso3: 'BRA',
        avgTone: -1.4,
        goldstein: -2.2,
        themes: ['CLIMATE', 'AGRICULTURE', 'POLITICS'],
        snippet: 'Climate volatility and policy pressure weigh on the Brazilian outlook.',
        source: 'MockWire-LatAm'
      }
    ];
  }

  buildDefaultQuery() {
    const countryClauses = (this.config.gdeltCountrySlices || [])
      .map((country) => GDELT_QUERY_COUNTRY_TERMS[country] || country.toLowerCase())
      .filter(Boolean)
      .map((countryTerm) => `sourcecountry:${countryTerm}`);

    if (countryClauses.length) {
      return `(${countryClauses.join(' OR ')}) toneabs>1`;
    }

    return 'toneabs>1';
  }

  buildGdeltRequests() {
    const configured = new URL(this.config.gdeltApiUrl);
    const query = configured.searchParams.get('query') || this.config.gdeltQuery || this.buildDefaultQuery();

    configured.searchParams.set('query', query);
    if (!configured.searchParams.get('mode')) {
      configured.searchParams.set('mode', 'ArtList');
    }
    if (!configured.searchParams.get('maxrecords')) {
      configured.searchParams.set('maxrecords', String(this.config.gdeltMaxRecords));
    }
    if (!configured.searchParams.get('timespan')) {
      configured.searchParams.set('timespan', this.config.gdeltTimespan);
    }
    if (!configured.searchParams.get('format')) {
      configured.searchParams.set('format', 'json');
    }
    if (!configured.searchParams.get('sort')) {
      configured.searchParams.set('sort', 'datedesc');
    }

    return [
      {
        key: 'global',
        country: null,
        url: configured.toString()
      }
    ];
  }

  async waitForRequestSlot() {
    const remaining = this.config.gdeltMinRequestGapMs - (Date.now() - this.lastProviderCallAt);
    if (remaining > 0) {
      await sleep(remaining);
    }
    this.lastProviderCallAt = Date.now();
  }

  async fetchLatestExportUrl() {
    await this.waitForRequestSlot();
    const response = await this.fetchImpl(GDELT_LASTUPDATE_URL, {
      headers: {
        accept: 'text/plain',
        'user-agent': 'Kompass/0.2'
      }
    });

    if (!response.ok) {
      throw new Error(`GDELT lastupdate failed with ${response.status}`);
    }

    const body = await response.text();
    const exportLine = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.includes('.export.CSV.zip'));

    const exportUrl = exportLine?.split(/\s+/).at(-1);
    if (!exportUrl) {
      throw new Error(`GDELT lastupdate missing export URL: ${safePreview(body)}`);
    }

    return exportUrl;
  }

  buildExportUrls(latestExportUrl) {
    const latestTimestamp = parseExportTimestampFromUrl(latestExportUrl);
    if (!latestTimestamp) {
      return [latestExportUrl];
    }

    const count = Math.max(1, this.config.gdeltExportLookbackBatches || 1);
    return Array.from({ length: count }, (_, index) => {
      const timestamp = new Date(latestTimestamp.getTime() - (index * 15 * 60_000));
      return `http://data.gdeltproject.org/gdeltv2/${formatExportTimestamp(timestamp)}.export.CSV.zip`;
    });
  }

  async fetchSingleExport(exportUrl) {
    const response = await this.fetchImpl(exportUrl, {
      headers: {
        accept: 'application/zip, application/octet-stream',
        'user-agent': 'Kompass/0.2'
      }
    });

    if (!response.ok) {
      throw new Error(`GDELT export fetch failed with ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const archive = new AdmZip(buffer);
    const entry = archive.getEntries().find((candidate) => !candidate.isDirectory);
    if (!entry) {
      throw new Error('GDELT export zip contained no CSV entry');
    }

    const csv = entry.getData().toString('utf8');
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const events = lines
      .map((line) => line.split('\t'))
      .map((columns) => this.normalizeExportEvent(columns))
      .filter(Boolean);

    if (!events.length) {
      throw new Error('GDELT export produced no normalizable events');
    }

    return events;
  }

  async fetchExportEvents() {
    const latestExportUrl = await this.fetchLatestExportUrl();
    const exportUrls = this.buildExportUrls(latestExportUrl);
    const rawEvents = [];
    const failures = [];
    let successCount = 0;

    for (const exportUrl of exportUrls) {
      try {
        const events = await this.fetchSingleExport(exportUrl);
        rawEvents.push(...events);
        successCount += 1;
      } catch (error) {
        failures.push({
          country: exportUrl,
          error: error.message
        });
        this.logger.warn('gdelt', 'Export batch fetch failed', {
          exportUrl,
          error: error.message
        });
      }
    }

    if (!rawEvents.length) {
      throw new Error(failures[0]?.error || 'GDELT export batches produced no events');
    }

    return {
      rawEvents,
      requestCount: exportUrls.length,
      successCount,
      failures,
      countries: exportUrls.map((url) => url.match(/\/(\d{14})\.export\.CSV\.zip$/i)?.[1] || url)
    };
  }

  async fetchRssFeedEvents(feed) {
    const xml = await this.fetchFeedXml(feed.url);
    const parsed = await this.rssParser.parseString(xml);
    return (parsed.items || [])
      .map((item) => this.normalizeRssEvent(item, feed))
      .filter(Boolean);
  }

  async fetchSocialFeedEvents(feed) {
    const payload = await this.fetchBlueskyFeed(feed.handle, 8);
    return (payload.feed || [])
      .map((entry) => this.normalizeBlueskyEvent(entry, feed))
      .filter(Boolean);
  }

  async fetchCuratedFeedEvents() {
    const plan = this.buildFeedPlan();
    const rssFeeds = [
      ...plan.globalFeeds,
      ...plan.outletFeeds,
      ...plan.conflictOutletFeeds,
      ...plan.pulseFeeds,
      ...plan.shippingFeeds
    ];
    const rssSettled = await this.settleInBatches(
      rssFeeds,
      (feed) => this.fetchRssFeedEvents(feed),
      CURATED_RSS_BATCH_SIZE
    );
    const socialSettled = await this.settleInBatches(
      plan.socialFeeds,
      (feed) => this.fetchSocialFeedEvents(feed),
      CURATED_SOCIAL_BATCH_SIZE
    );

    const rawEvents = [];
    let successCount = 0;
    const failures = [];
    const respondingOutletKeys = new Set();
    const respondingConflictOutletKeys = new Set();
    const respondingShippingKeys = new Set();
    const respondingSocialKeys = new Set();

    rssSettled.forEach((result, index) => {
      const feed = rssFeeds[index];
      if (result.status === 'fulfilled') {
        rawEvents.push(...result.value);
        if (result.value.length) {
          successCount += 1;
          if (['country-outlet', 'country-wire'].includes(feed.sourceKind)) {
            respondingOutletKeys.add(feed.key);
          }
          if (feed.sourceKind === 'conflict-outlet') {
            respondingConflictOutletKeys.add(feed.key);
          }
          if (feed.sourceKind === 'shipping-lane') {
            respondingShippingKeys.add(feed.key);
          }
        }
        return;
      }

      failures.push({
        country: feed.name,
        error: result.reason?.message || String(result.reason)
      });
      this.logger.warn('gdelt', 'Curated feed fetch failed', {
        feed: feed.name,
        error: result.reason?.message || String(result.reason)
      });
    });

    socialSettled.forEach((result, index) => {
      const feed = plan.socialFeeds[index];
      if (result.status === 'fulfilled') {
        rawEvents.push(...result.value);
        if (result.value.length) {
          successCount += 1;
          respondingSocialKeys.add(feed.key);
        }
        return;
      }

      failures.push({
        country: feed.label,
        error: result.reason?.message || String(result.reason)
      });
      this.logger.warn('gdelt', 'Social feed fetch failed', {
        feed: feed.label,
        error: result.reason?.message || String(result.reason)
      });
    });

    return {
      rawEvents,
      requestCount: rssFeeds.length + plan.socialFeeds.length,
      successCount,
      failures,
      countries: [...new Set(rawEvents.map((event) => event.countryIso3).filter(Boolean))],
      feedPlan: {
        configuredGlobalCount: plan.configuredGlobalCount,
        configuredOutletCount: plan.configuredOutletCount,
        configuredConflictOutletCount: plan.configuredConflictOutletCount,
        configuredPulseCount: plan.configuredPulseCount,
        configuredShippingCount: plan.configuredShippingCount,
        configuredSocialCount: plan.configuredSocialCount,
        selectedGlobalCount: plan.globalFeeds.length,
        selectedOutletCount: plan.outletFeeds.length,
        selectedConflictOutletCount: plan.conflictOutletFeeds.length,
        selectedPulseCount: plan.pulseFeeds.length,
        selectedShippingCount: plan.shippingFeeds.length,
        selectedSocialCount: plan.socialFeeds.length,
        respondingOutletCount: respondingOutletKeys.size,
        respondingConflictOutletCount: respondingConflictOutletKeys.size,
        respondingShippingCount: respondingShippingKeys.size,
        respondingSocialCount: respondingSocialKeys.size
      }
    };
  }

  async fetchSlice(request) {
    await this.waitForRequestSlot();
    return retry(
      async () => {
        const response = await this.fetchImpl(request.url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'Kompass/0.2'
          }
        });

        let body = '';
        let payload = null;
        if (typeof response.text === 'function') {
          body = await response.text();
        } else if (typeof response.json === 'function') {
          payload = await response.json();
          body = JSON.stringify(payload);
        }
        if (!response.ok) {
          throw new Error(
            `GDELT ${request.country || request.key} failed with ${response.status}: ${safePreview(body)}`
          );
        }

        if (!payload) {
          try {
            payload = JSON.parse(body);
          } catch {
            throw new Error(
              `GDELT ${request.country || request.key} returned non-JSON data: ${safePreview(body)}`
            );
          }
        }

        const items = payload.articles || payload.events || payload.results || [];
        return items.map((item) => ({
          ...item,
          _kompassCountrySlice: request.country || item.sourcecountry || item.country
        }));
      },
      {
        attempts: 1,
        baseDelayMs: 1_200,
        onRetry: (error, attempt) => {
          this.logger.warn('gdelt', 'Retrying GDELT slice request', {
            attempt,
            country: request.country || request.key,
            error: error.message
          });
        }
      }
    );
  }

  async fetchDocRawEvents() {
    const requests = this.buildGdeltRequests();
    const rawEvents = [];
    const failures = [];
    let successCount = 0;

    for (const request of requests) {
      try {
        const items = await this.fetchSlice(request);
        rawEvents.push(...items);
        successCount += 1;
      } catch (error) {
        failures.push({
          country: request.country || request.key,
          error: error.message
        });
        this.logger.warn('gdelt', 'Slice fetch failed', {
          country: request.country || request.key,
          error: error.message
        });
      }
    }

    if (!rawEvents.length) {
      throw new Error(failures[0]?.error || 'GDELT returned no events');
    }

    return {
      rawEvents,
      requestCount: requests.length,
      successCount,
      failures,
      countries: requests.map((request) => request.country || request.key)
    };
  }

  async fetchRawEvents() {
    try {
      // Export feed first, DOC API second. DOC is handy, but export is still the better bulk source.
      const [exportResult, curatedResult] = await Promise.all([
        this.fetchExportEvents(),
        this.fetchCuratedFeedEvents()
      ]);
      return {
        rawEvents: [...exportResult.rawEvents, ...curatedResult.rawEvents],
        requestCount: exportResult.requestCount + curatedResult.requestCount,
        successCount: exportResult.successCount + curatedResult.successCount,
        failures: [...exportResult.failures, ...curatedResult.failures],
        countries: [...exportResult.countries, ...curatedResult.countries],
        feedPlan: curatedResult.feedPlan
      };
    } catch (error) {
      this.logger.warn('gdelt', 'Raw export fetch failed, falling back to DOC API', {
        error: error.message
      });
      return this.fetchDocRawEvents();
    }
  }

  async getPreviousBaselines() {
    const rows = await this.db.all(
      `
        SELECT region, avg_tone
        FROM country_snapshots
        WHERE ts = (SELECT MAX(ts) FROM country_snapshots)
      `
    );

    return new Map(rows.map((row) => [row.region, row.avg_tone]));
  }

  async persistSnapshot({ ts, aggregates, globalAggregate }) {
    await this.db.exec('BEGIN TRANSACTION');
    try {
      for (const aggregate of aggregates) {
        await this.db.run(
          `
            INSERT INTO country_snapshots
              (ts, region, avg_tone, goldstein, event_count, top_themes, volatility)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            ts,
            aggregate.region,
            aggregate.avgTone,
            aggregate.goldstein,
            aggregate.eventCount,
            JSON.stringify(aggregate.topThemes),
            aggregate.volatility
          ]
        );
      }

      await this.db.run(
        `
          INSERT OR REPLACE INTO global_snapshots
            (ts, avg_tone, goldstein, event_count, top_themes)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          ts,
          globalAggregate.avgTone,
          globalAggregate.goldstein,
          globalAggregate.eventCount,
          JSON.stringify(globalAggregate.topThemes)
        ]
      );

      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
  }

  canReuseLastLive() {
    if (!this.state.lastLiveEvents?.length || !this.state.lastLiveGdeltFetchAt) {
      return false;
    }
    const age = Date.now() - Date.parse(this.state.lastLiveGdeltFetchAt);
    return Number.isFinite(age) && age <= this.config.gdeltKeepLastLiveMs;
  }

  async refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
    let events;
    let source = 'live';
    let requestStats = {
      requestCount: 0,
      successCount: 0,
      failures: [],
      countries: [],
      feedPlan: null
    };

    try {
      const fetchResult = await this.fetchRawEvents();
      if (Array.isArray(fetchResult)) {
        requestStats = {
          rawEvents: fetchResult,
          requestCount: 1,
          successCount: fetchResult.length ? 1 : 0,
          failures: [],
          countries: ['custom'],
          feedPlan: null
        };
      } else {
        requestStats = fetchResult;
      }
      events = this.deduplicate(
        requestStats.rawEvents
          .map((item) => this.normalizeEvent(item))
          .filter((event) => event.countryIso3 !== 'GLOBAL')
      );
      await this.yieldToLoop();

      if (!events.length) {
        throw new Error('GDELT returned no normalizable events');
      }

      // Note to self: the country slice mix is still a bit brute-force.
      // If coverage starts drifting again, tune the slice priority list first before adding more feed noise.
    } catch (error) {
      if (this.canReuseLastLive()) {
        source = 'stale';
        events = this.state.lastLiveEvents.map((event) => ({ ...event }));
        requestStats = this.state.lastGdeltRequestStats || requestStats;
        this.logger.warn('gdelt', 'Reusing last live GDELT snapshot after fetch failure', {
          error: error.message,
          lastLiveAt: this.state.lastLiveGdeltFetchAt
        });
      } else {
        source = 'mock';
        this.logger.warn('gdelt', 'Falling back to mocked event feed', {
          error: error.message
        });
        events = this.getMockEvents();
      }
    }

    const previousBaselines = await this.getPreviousBaselines();
    const enrichedEvents = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const baseline = previousBaselines.get(event.countryIso3) ?? 0;
      const toneDelta = event.avgTone - baseline;
      enrichedEvents.push({
        ...event,
        toneDelta,
        volatility: Math.abs(toneDelta) + Math.abs(event.goldstein)
      });

      if (index > 0 && index % 500 === 0) {
        await this.yieldToLoop();
      }
    }

    const aggregates = this.aggregateByCountry(enrichedEvents);
    await this.yieldToLoop();
    const globalAggregate = this.computeGlobalAggregate(enrichedEvents);
    const timestampMs = Date.now();

    await this.persistSnapshot({
      ts: timestampMs,
      aggregates,
      globalAggregate
    });
    await this.yieldToLoop();

    const compactedEvents = [];
    for (let index = 0; index < enrichedEvents.length; index += 1) {
      compactedEvents.push(this.compactStateEvent(enrichedEvents[index]));
      if (index > 0 && index % 500 === 0) {
        await this.yieldToLoop();
      }
    }
    const sortedCompactedEvents = compactedEvents
      .slice()
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, MAX_STATE_RECENT_EVENTS);

    this.state.recentEvents = sortedCompactedEvents;
    this.state.eventArchive = this.deduplicate(
      [...compactedEvents, ...(this.state.eventArchive || [])].filter((event) => {
        const age = timestampMs - Date.parse(event.timestamp);
        return Number.isFinite(age) && age <= (24 * 60 * 60_000);
      })
    )
      .slice()
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, MAX_STATE_ARCHIVE_EVENTS);
    this.state.latestCountryMetadata = Object.fromEntries(
      aggregates.map((aggregate) => [
        aggregate.region,
        {
          sourceCount: aggregate.sourceCount,
          rawSourceCount: aggregate.rawSourceCount,
          configuredOutletCount: aggregate.configuredOutletCount,
          topSources: aggregate.topSources,
          eventCount: aggregate.eventCount,
          rawEventCount: aggregate.rawEventCount,
          signalShare: aggregate.signalShare,
          topThemes: aggregate.topThemes,
          topConflictTags: aggregate.topConflictTags,
          feedMix: aggregate.feedMix,
          conflictScore: aggregate.conflictScore,
          dataSource: source
        }
      ])
    );
    this.state.latestGlobalMetadata = {
      sourceCount: globalAggregate.sourceCount,
      configuredOutletCount: requestStats.feedPlan?.configuredOutletCount || globalAggregate.configuredOutletCount,
      topSources: globalAggregate.topSources,
      countryCount: globalAggregate.countryCount,
      eventCount: globalAggregate.eventCount,
      topThemes: globalAggregate.topThemes,
      topConflictTags: globalAggregate.topConflictTags,
      feedMix: globalAggregate.feedMix,
      conflictScore: globalAggregate.conflictScore,
      dataSource: source
    };
    this.state.lastGdeltRequestStats = {
      requestCount: requestStats.requestCount,
      successCount: requestStats.successCount,
      failureCount: requestStats.failures.length,
      failures: requestStats.failures,
      countries: requestStats.countries,
      uniqueSources: globalAggregate.sourceCount,
      feedPlan: requestStats.feedPlan || this.state.lastGdeltRequestStats?.feedPlan || null
    };
    this.state.lastGdeltFetchAt = new Date(timestampMs).toISOString();
    this.state.lastGdeltSource = source;

    if (source === 'live') {
      this.state.lastLiveEvents = sortedCompactedEvents;
      this.state.lastLiveGdeltFetchAt = this.state.lastGdeltFetchAt;
    }

    this.logger.info('gdelt', 'GDELT snapshot refreshed', {
      source,
      eventCount: enrichedEvents.length,
      requestCount: this.state.lastGdeltRequestStats.requestCount,
      successCount: this.state.lastGdeltRequestStats.successCount
    });

    return {
      events: enrichedEvents,
      aggregates,
      globalAggregate,
      source
    };
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  start() {
    this.stop();
    this.intervalHandle = setInterval(() => {
      this.refresh().catch((error) => {
        this.metrics.inc('errors_total');
        this.logger.error('gdelt', 'Scheduled GDELT refresh failed', {
          error: error.message
        });
      });
    }, this.config.pollIntervalGdeltMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async getMetrics({ region, sinceMs }) {
    const now = Date.now();
    const since = sinceMs || now - this.config.metricsLookbackMs;
    const windowMs = Math.max(60_000, now - since);
    const roundedWindowMs = Math.round(windowMs / 60_000) * 60_000;
    const revision = this.state.lastGdeltFetchAt || this.state.lastLiveGdeltFetchAt || 'boot';

    return this.cache.wrap(
      `gdelt:metrics:${region || 'global'}:${roundedWindowMs}:${revision}`,
      async () => {
        const since24h = now - (24 * 60 * 60_000);
        const since7d = now - (7 * 24 * 60 * 60_000);
        const globalSeries = await this.db.all(
          `
            SELECT ts, avg_tone, goldstein, event_count, top_themes
            FROM global_snapshots
            WHERE ts >= ?
            ORDER BY ts ASC
          `,
          [since]
        );

        const regions = await this.db.all(
          `
            SELECT region, avg_tone, goldstein, event_count, top_themes, volatility
            FROM country_snapshots
            WHERE ts = (SELECT MAX(ts) FROM country_snapshots)
            ORDER BY volatility DESC, event_count DESC, region ASC
          `
        );
        const trailing24hRows = await this.db.all(
          `
            SELECT
              region,
              AVG(avg_tone) AS avg_tone,
              AVG(goldstein) AS goldstein,
              SUM(event_count) AS event_count,
              AVG(volatility) AS volatility,
              COUNT(*) AS snapshot_count
            FROM country_snapshots
            WHERE ts >= ?
            GROUP BY region
            ORDER BY volatility DESC, event_count DESC, region ASC
          `,
          [since24h]
        );
        const trailing7dRows = await this.db.all(
          `
            SELECT
              region,
              AVG(avg_tone) AS avg_tone,
              AVG(goldstein) AS goldstein,
              SUM(event_count) AS event_count,
              AVG(volatility) AS volatility,
              COUNT(*) AS snapshot_count
            FROM country_snapshots
            WHERE ts >= ?
            GROUP BY region
            ORDER BY volatility DESC, event_count DESC, region ASC
          `,
          [since7d]
        );

        let regionSeries = [];
        if (region) {
          regionSeries = await this.db.all(
            `
              SELECT ts, region, avg_tone, goldstein, event_count, top_themes, volatility
              FROM country_snapshots
              WHERE region = ? AND ts >= ?
              ORDER BY ts ASC
            `,
            [region, since]
          );
        }

        const mapRegionRow = (row, options = {}) => {
          const metadata = this.state.latestCountryMetadata[row.region] || {};
          const topThemes = options.topThemes || JSON.parse(row.top_themes || '[]');
          const eventCount = row.event_count;
          return {
            region: row.region,
            avgTone: row.avg_tone,
            goldstein: row.goldstein,
            eventCount,
            topThemes,
            sourceCount: metadata.sourceCount || 0,
            rawSourceCount: metadata.rawSourceCount || metadata.sourceCount || 0,
            configuredOutletCount: metadata.configuredOutletCount || 0,
            topSources: metadata.topSources || [],
            topConflictTags: metadata.topConflictTags || [],
            feedMix: metadata.feedMix || [],
            dataSource: metadata.dataSource || this.state.lastGdeltSource,
            rawEventCount: metadata.rawEventCount || eventCount,
            signalShare: metadata.signalShare || 0,
            conflictScore:
              metadata.conflictScore ||
              this.deriveConflictScoreFromAggregate({
                avgTone: row.avg_tone,
                goldstein: row.goldstein,
                topThemes,
                topConflictTags: metadata.topConflictTags || [],
                eventCount
              }),
            heatScore: Number(((Math.abs(row.avg_tone) * 0.6) + (Math.abs(row.goldstein) * 0.4) + (row.volatility || 0)).toFixed(3)),
            volatility: row.volatility,
            snapshotCount: options.snapshotCount || 1
          };
        };

        return {
          region: region || null,
          currentGlobal: globalSeries.at(-1)
            ? {
                timestamp: new Date(globalSeries.at(-1).ts).toISOString(),
                avgTone: globalSeries.at(-1).avg_tone,
                goldstein: globalSeries.at(-1).goldstein,
                eventCount: globalSeries.at(-1).event_count,
                topThemes: JSON.parse(globalSeries.at(-1).top_themes || '[]'),
                topConflictTags: this.state.latestGlobalMetadata?.topConflictTags || [],
                sourceCount: this.state.latestGlobalMetadata?.sourceCount || 0,
                configuredOutletCount: this.state.latestGlobalMetadata?.configuredOutletCount || 0,
                topSources: this.state.latestGlobalMetadata?.topSources || [],
                countryCount: this.state.latestGlobalMetadata?.countryCount || 0,
                conflictScore: this.state.latestGlobalMetadata?.conflictScore || 0,
                feedMix: this.state.latestGlobalMetadata?.feedMix || [],
                dataSource: this.state.latestGlobalMetadata?.dataSource || this.state.lastGdeltSource,
                lastLiveAt: this.state.lastLiveGdeltFetchAt || null
              }
            : null,
          globalSeries: globalSeries.map((row) => ({
            timestamp: new Date(row.ts).toISOString(),
            avgTone: row.avg_tone,
            goldstein: row.goldstein,
            eventCount: row.event_count,
            topThemes: JSON.parse(row.top_themes || '[]')
          })),
          regions: regions.map((row) => mapRegionRow(row)),
          trailing24hRegions: trailing24hRows.map((row) =>
            mapRegionRow(
              {
                region: row.region,
                avg_tone: row.avg_tone,
                goldstein: row.goldstein,
                event_count: row.event_count,
                volatility: row.volatility
              },
              {
                topThemes: this.state.latestCountryMetadata[row.region]?.topThemes || [],
                snapshotCount: row.snapshot_count
              }
            )
          ),
          trailing7dRegions: trailing7dRows.map((row) =>
            mapRegionRow(
              {
                region: row.region,
                avg_tone: row.avg_tone,
                goldstein: row.goldstein,
                event_count: row.event_count,
                volatility: row.volatility
              },
              {
                topThemes: this.state.latestCountryMetadata[row.region]?.topThemes || [],
                snapshotCount: row.snapshot_count
              }
            )
          ),
          trailingRegions: trailing24hRows.map((row) =>
            mapRegionRow(
              {
                region: row.region,
                avg_tone: row.avg_tone,
                goldstein: row.goldstein,
                event_count: row.event_count,
                volatility: row.volatility
              },
              {
                topThemes: this.state.latestCountryMetadata[row.region]?.topThemes || [],
                snapshotCount: row.snapshot_count
              }
            )
          ),
          regionSnapshot: region
            ? {
                region,
                avgTone: regionSeries.at(-1)?.avg_tone ?? null,
                goldstein: regionSeries.at(-1)?.goldstein ?? null,
                eventCount: this.state.latestCountryMetadata[region]?.eventCount || 0,
                topThemes: this.state.latestCountryMetadata[region]?.topThemes || [],
                topConflictTags: this.state.latestCountryMetadata[region]?.topConflictTags || [],
                sourceCount: this.state.latestCountryMetadata[region]?.sourceCount || 0,
                rawSourceCount: this.state.latestCountryMetadata[region]?.rawSourceCount || 0,
                configuredOutletCount: this.state.latestCountryMetadata[region]?.configuredOutletCount || 0,
                topSources: this.state.latestCountryMetadata[region]?.topSources || [],
                sourceBreakdown: this.getRegionSourceBreakdown(region),
                sourceLens: this.getRegionSourceLens(region),
                feedMix: this.state.latestCountryMetadata[region]?.feedMix || [],
                conflictScore: this.state.latestCountryMetadata[region]?.conflictScore || 0,
                rawEventCount: this.state.latestCountryMetadata[region]?.rawEventCount || 0,
                signalShare: this.state.latestCountryMetadata[region]?.signalShare || 0,
                dataSource: this.state.latestCountryMetadata[region]?.dataSource || this.state.lastGdeltSource
              }
            : null,
          regionSeries: regionSeries.map((row) => ({
            timestamp: new Date(row.ts).toISOString(),
            region: row.region,
            avgTone: row.avg_tone,
            goldstein: row.goldstein,
            eventCount: row.event_count,
            topThemes: JSON.parse(row.top_themes || '[]'),
            volatility: row.volatility
          }))
        };
      },
      15_000
    );
  }

  getTopEvents({ limit, windowMs, region, conflictOnly = false }) {
    const cutoff = Date.now() - windowMs;
    const filteredEvents = (this.state.recentEvents || [])
      .filter((event) => Date.parse(event.timestamp) >= cutoff)
      .filter((event) => (region ? event.countryIso3 === region : true))
      .filter((event) =>
        conflictOnly
          ? (
              event.isConflictRelevant !== false &&
              (
                event.isViolent ||
                (event.conflictTags || []).length > 0 ||
                (event.themes || []).some((theme) => CONFLICT_THEMES.has(theme))
              )
            )
          : true
      );

    return this.clusterEvents(filteredEvents, { limit });
  }
}

module.exports = {
  GdeltService
};
