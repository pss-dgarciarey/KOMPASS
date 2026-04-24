import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import CountryFlag from '../components/CountryFlag';
import { iso3ToCountryName } from '../lib/countryMeta';
import useBodyScrollLock from '../lib/useBodyScrollLock';

function formatDateTime(value) {
  if (!value) {
    return 'Awaiting refresh';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Awaiting refresh';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatSigned(value, digits = 1, suffix = '') {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`;
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function compactInteger(value) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function sourceKindBadgeClass(sourceKind) {
  // Kept verbose instead of a lookup table because I still tweak these labels/colors one by one.
  if (sourceKind === 'rss') {
    return 'border border-amber-300/25 bg-amber-300/10 text-amber-100';
  }
  if (sourceKind === 'country-outlet') {
    return 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  }
  if (sourceKind === 'country-wire') {
    return 'border border-sky-300/25 bg-sky-300/10 text-sky-100';
  }
  if (sourceKind === 'conflict-outlet') {
    return 'border border-rose-300/25 bg-rose-300/10 text-rose-100';
  }
  if (sourceKind === 'country-pulse') {
    return 'border border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100';
  }
  if (sourceKind === 'social-bluesky') {
    return 'border border-sky-300/25 bg-sky-300/10 text-sky-100';
  }
  if (sourceKind === 'shipping-lane') {
    return 'border border-teal-300/25 bg-teal-300/10 text-teal-100';
  }
  if (sourceKind === 'gdelt-export') {
    return 'border border-cyan-300/25 bg-cyan-300/10 text-cyan-100';
  }
  if (sourceKind === 'structured-live') {
    return 'border border-violet-300/25 bg-violet-300/10 text-violet-100';
  }
  return 'border border-white/10 bg-white/5 text-slate-200';
}

function sourceKindLabel(sourceKind) {
  if (sourceKind === 'rss') {
    return 'RSS';
  }
  if (sourceKind === 'country-outlet') {
    return 'Country outlet';
  }
  if (sourceKind === 'country-wire') {
    return 'Country wire';
  }
  if (sourceKind === 'conflict-outlet') {
    return 'Conflict desk';
  }
  if (sourceKind === 'country-pulse') {
    return 'Country pulse';
  }
  if (sourceKind === 'social-bluesky') {
    return 'Bluesky';
  }
  if (sourceKind === 'shipping-lane') {
    return 'Shipping lane';
  }
  if (sourceKind === 'gdelt-export') {
    return 'GDELT export';
  }
  if (sourceKind === 'structured-live') {
    return 'Structured live';
  }
  return sourceKind || 'source';
}

function scoreToneClass(score) {
  if (!Number.isFinite(Number(score))) {
    return 'text-slate-200';
  }
  const numeric = Number(score);
  if (numeric <= -4) {
    return 'text-rose-200';
  }
  if (numeric < -1.5) {
    return 'text-amber-200';
  }
  if (numeric >= 2) {
    return 'text-emerald-200';
  }
  return 'text-cyan-100';
}

function benchmarkBadgeClass(benchmark) {
  if (benchmark?.marketType === 'tracked') {
    return 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  }
  if (benchmark?.marketType === 'proxy') {
    return 'border border-cyan-300/25 bg-cyan-300/10 text-cyan-100';
  }
  return 'border border-white/10 bg-white/5 text-slate-300';
}

function benchmarkValueLabel(benchmark) {
  if (!benchmark) {
    return '--';
  }
  if (Number.isFinite(Number(benchmark.changePercent))) {
    return formatSigned(benchmark.changePercent, 2, '%');
  }
  if (benchmark.marketType === 'proxy') {
    return 'ETF proxy';
  }
  if (benchmark.marketType === 'untracked') {
    return 'No benchmark';
  }
  return 'Tracking';
}

function benchmarkDetailLabel(benchmark) {
  if (!benchmark) {
    return 'No free benchmark configured';
  }
  if (Number.isFinite(Number(benchmark.latest))) {
    return `${formatNumber(benchmark.latest, 2)} ${benchmark.currency || ''} · ${benchmark.venue || 'Market venue'}`.trim();
  }
  return benchmark.detail || benchmark.venue || 'No free benchmark configured';
}

function buildLinePath(points, valueAccessor, width = 420, height = 156, padding = 16) {
  const sample = points
    .map((point) => ({
      timestamp: point.timestamp,
      value: Number(valueAccessor(point))
    }))
    .filter((point) => Number.isFinite(point.value));

  if (sample.length < 2) {
    return '';
  }

  const min = Math.min(...sample.map((point) => point.value));
  const max = Math.max(...sample.map((point) => point.value));
  const spread = max - min || 1;
  const plotWidth = width - (padding * 2);
  const plotHeight = height - (padding * 2);

  // Simple SVG path is enough here. No need to drag a charting lib into the panel for this.
  return sample
    .map((point, index) => {
      const x = padding + ((index / Math.max(sample.length - 1, 1)) * plotWidth);
      const y = height - padding - (((point.value - min) / spread) * plotHeight);
      return `${x},${y}`;
    })
    .join(' ');
}

function buildLinePoints(points, valueAccessor, width = 420, height = 156, padding = 16) {
  const sample = points
    .map((point) => ({
      timestamp: point.timestamp,
      value: Number(valueAccessor(point))
    }))
    .filter((point) => Number.isFinite(point.value));

  if (sample.length < 2) {
    return [];
  }

  const min = Math.min(...sample.map((point) => point.value));
  const max = Math.max(...sample.map((point) => point.value));
  const spread = max - min || 1;
  const plotWidth = width - (padding * 2);
  const plotHeight = height - (padding * 2);

  return sample.map((point, index) => ({
    ...point,
    x: padding + ((index / Math.max(sample.length - 1, 1)) * plotWidth),
    y: height - padding - (((point.value - min) / spread) * plotHeight)
  }));
}

function MetricTile({ label, value, detail, toneClass = 'text-white' }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="text-kicker text-[10px] text-cyan-200/70">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
      {detail ? (
        <div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

function SeriesPanel({
  title,
  subtitle,
  points,
  valueAccessor,
  stroke,
  formatter,
  currentLabel
}) {
  const values = points
    .map((point) => Number(valueAccessor(point)))
    .filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const latest = values.length ? values.at(-1) : null;
  const path = buildLinePath(points, valueAccessor);
  const linePoints = buildLinePoints(points, valueAccessor);
  const lastPoint = linePoints.at(-1);

  // These panels need to stay readable on iPhone width first, pretty second.
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-kicker text-[10px] text-cyan-200/70">{title}</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Current</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {Number.isFinite(latest) ? formatter(latest) : '--'}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-white/8 bg-black/30 p-3">
        {linePoints.length >= 2 ? (
          <>
            <svg viewBox="0 0 420 156" className="h-44 w-full">
              {[0.2, 0.5, 0.8].map((ratio) => (
                <line
                  key={ratio}
                  x1="16"
                  x2="404"
                  y1={16 + ((156 - 32) * ratio)}
                  y2={16 + ((156 - 32) * ratio)}
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeDasharray="4 8"
                />
              ))}
              <polyline
                fill="none"
                stroke={stroke}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={path}
              />
              {lastPoint ? (
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="4"
                  fill={stroke}
                  stroke="white"
                  strokeWidth="1.5"
                />
              ) : null}
            </svg>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
              <span>Low {Number.isFinite(min) ? formatter(min) : '--'}</span>
              <span>{currentLabel}</span>
              <span>High {Number.isFinite(max) ? formatter(max) : '--'}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-600">
              <span>{points[0]?.timestamp ? formatDateTime(points[0].timestamp) : '--'}</span>
              <span>{points.at(-1)?.timestamp ? formatDateTime(points.at(-1).timestamp) : '--'}</span>
            </div>
          </>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-slate-500">
            Not enough recent data to render this line yet.
          </div>
        )}
      </div>
    </section>
  );
}

function SourceLensWindow({ title, subtitle, lens }) {
  const breakdown = (lens?.breakdown || []).slice(0, 5);
  const feedMix = lens?.feedMix || [];

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">Updated</div>
          <div className="mt-1 text-xs text-slate-300">{formatDateTime(lens?.lastUpdated)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Events</div>
          <div className="mt-2 text-2xl font-semibold text-white">{compactInteger(lens?.eventCount ?? 0)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Sources</div>
          <div className="mt-2 text-2xl font-semibold text-white">{compactInteger(lens?.uniqueSources ?? 0)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Configured</div>
          <div className="mt-2 text-2xl font-semibold text-white">{compactInteger(lens?.configuredOutlets ?? 0)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {feedMix.length ? (
          feedMix.map((entry) => (
            <span
              key={`${title}-${entry.sourceKind}`}
              className={`rounded-full px-2.5 py-1 text-[11px] ${sourceKindBadgeClass(entry.sourceKind)}`}
            >
              {sourceKindLabel(entry.sourceKind)} {entry.eventCount || 0}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
            No feed mix yet
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {breakdown.length ? (
          breakdown.map((entry) => (
            <div
              key={`${title}-${entry.source}-${entry.eventCount}`}
              className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{entry.source}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {sourceKindLabel(entry.dominantSourceKind)} dominant
                  </div>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <div>{entry.eventCount} hits</div>
                  <div>{(entry.share * 100).toFixed(0)}%</div>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/5">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300"
                  style={{ width: `${Math.max(6, entry.share * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] leading-5 text-slate-500">
                Last activity {formatDateTime(entry.latestTimestamp)}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-sm text-slate-400">
            No source metadata yet.
          </div>
        )}
      </div>
    </div>
  );
}

function FeedCard({ feed, responding }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{feed.outletLabel || feed.name}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${sourceKindBadgeClass(feed.sourceKind)}`}>
              {sourceKindLabel(feed.sourceKind)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${
              responding
                ? 'border border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                : 'border border-white/10 bg-white/5 text-slate-300'
            }`}>
              {responding ? 'Responding' : 'Configured'}
            </span>
          </div>
        </div>
        {feed.url ? (
          <a
            href={feed.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-200 hover:border-cyan-300/25 hover:text-cyan-100"
          >
            Open
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EventCard({ event, region, background = false }) {
  const eventSource = event.url ? (
    <a
      href={event.url}
      target="_blank"
      rel="noreferrer"
      className="focus-ring rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-200 transition hover:border-cyan-300/25 hover:text-cyan-100"
    >
      {event.source}
    </a>
  ) : (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-200">
      {event.source}
    </span>
  );

  return (
    <article className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-kicker text-[10px] text-cyan-200/70">
            <span className="inline-flex items-center gap-2">
              <CountryFlag iso3={region} size="sm" />
              <span>{iso3ToCountryName(region)}</span>
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-7 text-white">
            {event.displayHeadline || event.headline || event.snippet || 'Country signal'}
          </h3>
          {event.rawHeadline && event.rawHeadline !== event.displayHeadline ? (
            <div className="mt-2 text-xs leading-5 text-slate-500">
              Source headline: {event.rawHeadline}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[10px] ${sourceKindBadgeClass(event.sourceKind)}`}>
            {sourceKindLabel(event.sourceKind)}
          </span>
          <span className={`rounded-full px-2 py-1 text-[10px] ${
            background
              ? 'border border-white/10 bg-white/5 text-slate-300'
              : 'border border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
          }`}>
            {background ? 'Background' : 'Weighted signal'}
          </span>
          {eventSource}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-slate-500">Updated</div>
          <div className="mt-1 text-slate-300">{formatDateTime(event.timestamp)}</div>
        </div>
        <div>
          <div className="text-slate-500">Corroboration</div>
          <div className="mt-1 text-slate-300">
            {event.sourceCount || 1} source{(event.sourceCount || 1) === 1 ? '' : 's'}
            {event.clusterSize > 1 ? ` / ${event.clusterSize} reports` : ''}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Signal class</div>
          <div className="mt-1 text-slate-300">{event.countrySignalClass || event.eventClass || 'general'}</div>
        </div>
        <div>
          <div className="text-slate-500">Confidence</div>
          <div className="mt-1 text-slate-300 capitalize">{event.signalConfidence || 'medium'}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        {event.inspectionSummary || event.summary || 'No recent data. Try refreshing or check your network.'}
      </p>

      {event.summary && event.summary !== event.inspectionSummary ? (
        <p className="mt-3 text-sm leading-6 text-slate-500">{event.summary}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {(event.conflictTags || []).slice(0, 4).map((tag) => (
          <span
            key={`${event.id}-${tag}`}
            className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-100"
          >
            {String(tag).replace(/_/g, ' ')}
          </span>
        ))}
        {(event.signalDrivers || []).slice(0, 3).map((driver) => (
          <span
            key={`${event.id}-${driver}`}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300"
          >
            {driver}
          </span>
        ))}
      </div>

      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-xs text-cyan-200 transition hover:text-cyan-100"
        >
          Open source
        </a>
      ) : null}
    </article>
  );
}

export default function RegionDetailPanel({ region, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [activeTab, setActiveTab] = useState('signal');

  useBodyScrollLock(Boolean(region));

  useEffect(() => {
    setActiveTab('signal');
  }, [region]);

  useEffect(() => {
    if (!region) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [region, onClose]);

  useEffect(() => {
    if (!region) {
      return undefined;
    }

    let cancelled = false;

    async function loadRegion() {
      setLoading(true);
      setError('');

      try {
        const detail = await api.getRegionDetail(region, {
          since: '7d',
          inspectionWindow: '72h'
        });

        if (!cancelled) {
          setPayload(detail);
        }
        return;
      } catch (primaryError) {
        try {
          const metrics = await api.getMetrics({ region, since: '7d' });
          const events = await api.getTopEvents({ region, limit: 8, window: '72h' });
          const explanation = await api.explain({
            events: events.items || [],
            currentAvgTone: metrics.regionSnapshot?.avgTone,
            previousAvgTone:
              metrics.regionSeries?.at(-2)?.avgTone ??
              metrics.regionSeries?.at(-1)?.avgTone ??
              metrics.regionSnapshot?.avgTone,
            goldstein: metrics.regionSnapshot?.goldstein,
            scope: 'region',
            contextLabel: iso3ToCountryName(region)
          });

          if (!cancelled) {
            setPayload({
              region,
              snapshot: metrics.regionSnapshot || null,
              series: {
                sentiment: metrics.regionSeries || [],
                benchmark: null
              },
              inspection: {
                region,
                rawEventCount: events.items?.length || 0,
                qualifiedEventCount: events.items?.length || 0,
                backgroundEventCount: 0,
                signalShare: 1,
                qualifiedEvents: events.items || [],
                backgroundEvents: [],
                sourceLens: {
                  qualified: metrics.regionSnapshot?.sourceLens?.liveWindow || null,
                  background: metrics.regionSnapshot?.sourceLens?.backgroundLiveWindow || null,
                  raw: metrics.regionSnapshot?.sourceLens?.rawLiveWindow || null
                },
                focusedFeeds: {
                  configured: [],
                  responding: [],
                  failures: []
                }
              },
              context: {
                country: {
                  iso3: region,
                  alpha2: region.slice(0, 2),
                  name: iso3ToCountryName(region)
                },
                macroComposite: {
                  score: 0,
                  label: 'limited-data',
                  components: {}
                },
                unemployment: null,
                inflation: null,
                benchmark: null,
                narrative:
                  'Country macro overlay is unavailable in legacy fallback mode, so this panel is showing the filtered signal stream only.',
                updatedAt: new Date().toISOString()
              },
              explanation,
              narratives: {
                signal: explanation.explanation,
                macro:
                  'Country macro overlay is unavailable in legacy fallback mode, so this panel is showing the filtered signal stream only.',
                combined: `${explanation.explanation} Country macro overlay is unavailable in legacy fallback mode, so this panel is showing the filtered signal stream only.`
              },
              generatedAt: new Date().toISOString()
            });
            setError(primaryError.message);
          }
        } catch (fallbackError) {
          if (!cancelled) {
            setPayload(null);
            setError(fallbackError.message || primaryError.message);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRegion();
    return () => {
      cancelled = true;
    };
  }, [region]);

  if (!region) {
    return null;
  }

  const snapshot = payload?.snapshot || {};
  const inspection = payload?.inspection || {};
  const context = payload?.context || {};
  const country = context.country || {
    iso3: region,
    alpha2: region.slice(0, 2),
    name: iso3ToCountryName(region)
  };
  const sentimentSeries = payload?.series?.sentiment || [];
  const benchmarkSeries = payload?.series?.benchmark?.points || context?.benchmark?.points || [];
  const benchmark = payload?.series?.benchmark || context?.benchmark || country?.benchmark || null;
  const combinedNarrative =
    payload?.narratives?.combined ||
    payload?.explanation?.explanation ||
    'No recent data. Try refreshing or check your network.';
  const qualifiedEvents = inspection.qualifiedEvents || [];
  const backgroundEvents = inspection.backgroundEvents || [];
  const focusedConfigured = inspection.focusedFeeds?.configured || [];
  const respondingKeys = new Set((inspection.focusedFeeds?.responding || []).map((feed) => feed.key));
  const tabCount = {
    signal: inspection.qualifiedEventCount ?? qualifiedEvents.length,
    background: inspection.backgroundEventCount ?? backgroundEvents.length,
    sources: focusedConfigured.length
  };

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black/65 px-2 py-2 backdrop-blur-md sm:px-4 sm:py-4"
      style={{
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
      }}
      onClick={onClose}
    >
      <div
        className="panel mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-[1500px] flex-col overflow-visible rounded-[30px] border border-white/10 bg-[#06090D]/95 shadow-[0_30px_120px_rgba(0,0,0,0.5)] sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#06090D]/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-kicker text-[11px] text-cyan-200/70">Country deep dive</div>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CountryFlag iso3={region} size="lg" className="h-16 w-24 sm:h-20 sm:w-28" />
                <div className="min-w-0">
                  <h2 className="truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {country.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span>{country.iso3 || region}</span>
                    {country.alpha2 ? <span className="text-slate-600">/</span> : null}
                    {country.alpha2 ? <span>{country.alpha2}</span> : null}
                    <span className="text-slate-600">/</span>
                    <span className="capitalize">{snapshot.dataSource || 'boot'}</span>
                    <span className="text-slate-600">/</span>
                    <span>Updated {formatDateTime(payload?.generatedAt || context.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start">
              <div className="rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Signal share</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {formatNumber((inspection.signalShare ?? snapshot.signalShare ?? 0) * 100, 0)}%
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {compactInteger(inspection.qualifiedEventCount ?? snapshot.eventCount ?? 0)} weighted /
                  {' '}
                  {compactInteger(inspection.rawEventCount ?? snapshot.rawEventCount ?? 0)} raw mentions
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div
          className="overflow-visible px-4 py-4 sm:flex-1 sm:overflow-y-auto sm:px-6 sm:py-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading && !payload ? (
            <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-8 text-sm text-slate-300">
              Pulling country signal, macro context, and focused outlet feeds...
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[1.14fr_0.86fr]">
              <section className="grid gap-5">
                <section className="rounded-[26px] border border-white/10 bg-gradient-to-br from-cyan-400/8 via-transparent to-emerald-400/8 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-kicker text-[10px] text-cyan-200/70">Local narrative</div>
                      <p className="mt-3 max-w-4xl text-base leading-7 text-slate-100">
                        {combinedNarrative}
                      </p>
                    </div>
                    {error ? (
                      <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
                        Fallback mode: {error}
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <SeriesPanel
                    title="Country signal drift"
                    subtitle="Trailing 7d AvgTone snapshots for the weighted country signal only."
                    points={sentimentSeries}
                    valueAccessor={(point) => point.avgTone}
                    stroke="#00F6FF"
                    formatter={(value) => formatSigned(value, 1)}
                    currentLabel="AvgTone range"
                  />
                  <SeriesPanel
                    title={benchmark?.label || 'Local benchmark'}
                    subtitle={
                      benchmark?.marketType === 'tracked'
                        ? `Free benchmark history for ${country.name}. This stays separate from the news-tone signal and acts as market context.`
                        : benchmark?.marketType === 'proxy'
                          ? `ETF proxy overlay for ${country.name}. This is a free stand-in for the local market when a direct broad index is not tracked here.`
                          : benchmark?.marketType === 'untracked'
                            ? `${country.name} does not currently have a tracked free benchmark in Kompass, so this slot stays informational only.`
                        : 'No local benchmark history is available yet for this country.'
                    }
                    points={benchmarkSeries}
                    valueAccessor={(point) => point.value}
                    stroke="#FFB86B"
                    formatter={(value) => formatNumber(value, 2)}
                    currentLabel={
                      benchmark?.marketType === 'proxy'
                        ? `${benchmark.historySource || 'proxy'} history`
                        : benchmark?.marketType === 'untracked'
                          ? 'No benchmark configured'
                          : benchmark?.historySource
                            ? `${benchmark.historySource} history`
                            : 'Local context'
                    }
                  />
                </div>

                <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-kicker text-[10px] text-cyan-200/70">Country feed inspection</div>
                      <p className="mt-2 text-sm text-slate-400">
                        Qualified signal stays separate from background mentions so external references do not get mistaken for domestic mood shifts.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['signal', `Weighted signal ${tabCount.signal}`],
                        ['background', `Background ${tabCount.background}`],
                        ['sources', `Source lens ${tabCount.sources}`]
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveTab(key)}
                          className={`focus-ring rounded-full border px-4 py-2 text-sm transition ${
                            activeTab === key
                              ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                              : 'border-white/10 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    {activeTab === 'signal' ? (
                      qualifiedEvents.length ? (
                        <div className="space-y-4">
                          {qualifiedEvents.map((event) => (
                            <EventCard
                              key={`${event.id}-${event.timestamp}`}
                              event={event}
                              region={region}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                          No weighted country-signal events are available yet for this window.
                        </div>
                      )
                    ) : null}

                    {activeTab === 'background' ? (
                      backgroundEvents.length ? (
                        <div className="space-y-4">
                          {backgroundEvents.map((event) => (
                            <EventCard
                              key={`${event.id}-${event.timestamp}`}
                              event={event}
                              region={region}
                              background
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                          No background carryover is currently stored for this country.
                        </div>
                      )
                    ) : null}

                    {activeTab === 'sources' ? (
                      <div className="grid gap-5">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <SourceLensWindow
                            title="Weighted signal"
                            subtitle="Only the events that currently count toward the country score."
                            lens={inspection.sourceLens?.qualified}
                          />
                          <SourceLensWindow
                            title="Background carryover"
                            subtitle="Context mentions that stay visible for analyst inspection but are not weighted heavily."
                            lens={inspection.sourceLens?.background}
                          />
                        </div>

                        <SourceLensWindow
                          title="Raw mention pool"
                          subtitle="Everything collected for this country before the signal-quality filter is applied."
                          lens={inspection.sourceLens?.raw}
                        />

                        <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Focused feed deck</div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Region-specific feeds fetched on demand when you open this country, so the detail view can get locally anchored reporting without waiting for the global polling rotation.
                              </p>
                            </div>
                            <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">
                              {(inspection.focusedFeeds?.responding || []).length} responding /
                              {' '}
                              {(inspection.focusedFeeds?.configured || []).length} configured
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {focusedConfigured.length ? (
                              focusedConfigured.map((feed) => (
                                <FeedCard
                                  key={feed.key}
                                  feed={feed}
                                  responding={respondingKeys.has(feed.key)}
                                />
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-sm text-slate-400">
                                No country-specific feeds are configured for this region yet.
                              </div>
                            )}
                          </div>

                          {(inspection.focusedFeeds?.failures || []).length ? (
                            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">
                              {(inspection.focusedFeeds.failures || []).slice(0, 4).map((item) => `${item.feed}: ${item.error}`).join(' | ')}
                            </div>
                          ) : null}
                        </section>
                      </div>
                    ) : null}
                  </div>
                </section>
              </section>

              <aside className="grid content-start gap-5">
                <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-kicker text-[10px] text-cyan-200/70">Country focus</div>
                      <div className="mt-3">
                        <CountryFlag iso3={region} size="lg" className="h-14 w-20" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Feed mode</div>
                      <div className="mt-1 text-xl font-semibold capitalize text-white">
                        {snapshot.dataSource || 'boot'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <MetricTile
                      label="AvgTone"
                      value={formatSigned(snapshot.avgTone, 1)}
                      toneClass={scoreToneClass(snapshot.avgTone)}
                    />
                    <MetricTile
                      label="Goldstein"
                      value={formatSigned(snapshot.goldstein, 1)}
                      toneClass={scoreToneClass(snapshot.goldstein)}
                    />
                    <MetricTile
                      label="Weighted events"
                      value={compactInteger(inspection.qualifiedEventCount ?? snapshot.eventCount ?? 0)}
                      detail={`${compactInteger(inspection.rawEventCount ?? snapshot.rawEventCount ?? 0)} raw mentions in window`}
                    />
                    <MetricTile
                      label="Distinct sources"
                      value={compactInteger(snapshot.sourceCount ?? 0)}
                      detail={`${compactInteger(snapshot.configuredOutletCount ?? 0)} configured outlets`}
                    />
                    <MetricTile
                      label="Signal share"
                      value={`${formatNumber((inspection.signalShare ?? snapshot.signalShare ?? 0) * 100, 0)}%`}
                      detail="Share of raw mentions that survived the country-quality filter"
                    />
                    <MetricTile
                      label="Conflict score"
                      value={formatNumber(snapshot.conflictScore ?? 0, 1)}
                      detail="Conflict-weighted stress proxy from tone, themes, and event severity"
                    />
                  </div>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-kicker text-[10px] text-cyan-200/70">Macro overlay</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{context.narrative}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] ${benchmarkBadgeClass(benchmark)}`}>
                          {benchmark?.statusLabel || 'No benchmark'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                          {benchmark?.venue || 'No tracked market venue'}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] capitalize text-slate-300">
                      {context.macroComposite?.label || 'limited-data'}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <MetricTile
                      label="Macro stress"
                      value={formatNumber(context.macroComposite?.score ?? 0, 1)}
                      detail="Composite built from free unemployment, inflation, and local benchmark context"
                    />
                    <MetricTile
                      label={benchmark?.label || 'Local benchmark'}
                      value={benchmarkValueLabel(benchmark)}
                      detail={benchmarkDetailLabel(benchmark)}
                      toneClass={
                        Number.isFinite(Number(benchmark?.changePercent))
                          ? benchmark?.changePercent < 0
                            ? 'text-amber-200'
                            : 'text-emerald-200'
                          : benchmark?.marketType === 'proxy'
                            ? 'text-cyan-100'
                            : 'text-slate-200'
                      }
                    />
                    <MetricTile
                      label="Unemployment"
                      value={context.unemployment ? `${formatNumber(context.unemployment.value, 1)}%` : '--'}
                      detail={context.unemployment ? `World Bank ${context.unemployment.year}` : 'No free labor update'}
                    />
                    <MetricTile
                      label="Inflation"
                      value={context.inflation ? `${formatNumber(context.inflation.value, 1)}%` : '--'}
                      detail={context.inflation ? `World Bank ${context.inflation.year}` : 'No free inflation update'}
                      toneClass={context.inflation?.value > 4 ? 'text-amber-200' : 'text-cyan-100'}
                    />
                  </div>
                </section>

                {(snapshot.topConflictTags || []).length ? (
                  <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                    <div className="text-sm text-slate-400">Conflict signatures</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(snapshot.topConflictTags || []).map((tag) => (
                        <span
                          key={`${region}-${tag}`}
                          className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-medium text-amber-100"
                        >
                          {String(tag).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="text-sm font-semibold text-white">Live source memory</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    This is the map-layer view used for the country tooltip and carryover memory, separate from the deeper on-demand source inspection.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <SourceLensWindow
                      title="Live window"
                      subtitle="What is shaping the country map layer right now."
                      lens={snapshot.sourceLens?.liveWindow}
                    />
                    <SourceLensWindow
                      title="24h carryover"
                      subtitle="Signals still shaping the slower map memory layer."
                      lens={snapshot.sourceLens?.memory24h}
                    />
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
