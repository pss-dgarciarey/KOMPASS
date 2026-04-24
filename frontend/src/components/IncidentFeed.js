import React from 'react';
import CountryFlag from './CountryFlag';
import { iso3ToCountryName } from '../lib/countryMeta';

function formatTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || 'Unknown';
  }
}

function confidenceLabel(value) {
  if (value >= 0.82) {
    return 'High';
  }
  if (value >= 0.6) {
    return 'Medium';
  }
  return 'Light';
}

function sourceKindLabel(kind) {
  const labels = {
    gdelt: 'news wire',
    rss: 'rss',
    'country-outlet': 'country outlet',
    'country-wire': 'country wire',
    'conflict-outlet': 'conflict desk',
    'country-pulse': 'country pulse',
    'shipping-lane': 'shipping lane',
    'social-bluesky': 'bluesky',
    'structured-live': 'structured live',
    'analysis-feed': 'analysis',
    'reference-map': 'reference'
  };
  return labels[kind] || kind || 'source';
}

function sourceKindClass(kind) {
  if (kind === 'structured-live') {
    return 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (kind === 'analysis-feed') {
    return 'border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100';
  }
  if (kind === 'country-outlet') {
    return 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (kind === 'country-wire') {
    return 'border border-sky-300/20 bg-sky-300/10 text-sky-100';
  }
  if (kind === 'conflict-outlet') {
    return 'border border-rose-300/20 bg-rose-300/10 text-rose-100';
  }
  if (kind === 'country-pulse') {
    return 'border border-violet-300/20 bg-violet-300/10 text-violet-100';
  }
  if (kind === 'social-bluesky') {
    return 'border border-sky-300/20 bg-sky-300/10 text-sky-100';
  }
  if (kind === 'shipping-lane') {
    return 'border border-teal-300/20 bg-teal-300/10 text-teal-100';
  }
  if (kind === 'rss') {
    return 'border border-amber-300/20 bg-amber-300/10 text-amber-100';
  }
  return 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
}

function normalizeItem(item) {
  const iso3 = item.countryIso3 || '';
  return {
    id: item.id || `${item.source || 'source'}-${item.timestamp || ''}`,
    headline: item.headline || item.snippet || 'Untitled signal',
    summary:
      item.summary ||
      item.description ||
      item.insight ||
      item.explanation ||
      (item.keywords?.length
        ? `Keywords: ${item.keywords.join(', ')}`
        : 'Live signal from the current Kompass ingest window.'),
    timestamp: item.timestamp,
    location: item.location || (iso3 ? iso3ToCountryName(iso3) : 'Global'),
    iso3,
    source: item.source || 'Unknown source',
    sourceUrl: item.sourceUrl || item.url || '',
    sourceCount: item.sourceCount || item.corroboratingSources?.length || 1,
    clusterSize: item.clusterSize || item.relatedCount || 1,
    confidence: item.confidence ?? 0.64,
    tags: item.tags || item.conflictTags || item.topThemes || item.themes || [],
    sourceKind: item.sourceKind || 'gdelt',
    mode: item.mode || 'live'
  };
}

export default function IncidentFeed({
  label,
  title,
  description,
  items,
  loading,
  emptyText = 'No recent data. Try refreshing or check your network.',
  actions = null,
  className = '',
  compact = false
}) {
  const normalizedItems = (items || []).map(normalizeItem);

  return (
    <section className={`panel flex min-h-[720px] flex-col rounded-[28px] p-5 ${className}`.trim()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-kicker text-[11px] text-cyan-200/70">{label}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">{description}</p>
        </div>
        {actions}
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {!normalizedItems.length && !loading && (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
            {emptyText}
          </div>
        )}

        {normalizedItems.map((item) => (
          <article
            key={item.id}
            className="rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-kicker text-[10px] text-cyan-200/70">
                  <span className="inline-flex items-center gap-2">
                    {item.iso3 ? <CountryFlag iso3={item.iso3} size="sm" /> : null}
                    <span>{item.location}</span>
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-semibold leading-7 text-white">
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring rounded text-white transition hover:text-cyan-100"
                    >
                      {item.headline}
                    </a>
                  ) : (
                    item.headline
                  )}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${sourceKindClass(item.sourceKind)}`}>
                  {sourceKindLabel(item.sourceKind)}
                </span>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 transition hover:border-cyan-300/25 hover:text-cyan-100"
                  >
                    {item.source}
                  </a>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200">
                    {item.source}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
              <div>
                <span className="text-slate-500">Updated</span>
                <div className="mt-1 text-slate-300">{formatTime(item.timestamp)}</div>
              </div>
              <div>
                <span className="text-slate-500">Corroboration</span>
                <div className="mt-1 text-slate-300">
                  {item.sourceCount} source{item.sourceCount === 1 ? '' : 's'}
                  {item.clusterSize > 1 ? ` / ${item.clusterSize} reports` : ''}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Confidence</span>
                <div className="mt-1 text-slate-300">{confidenceLabel(item.confidence)}</div>
              </div>
            </div>

            <p className={`mt-3 text-sm leading-6 text-slate-200 ${compact ? 'line-clamp-3' : ''}`.trim()}>
              {item.summary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(item.tags || []).slice(0, compact ? 3 : 5).map((tag) => (
                <span
                  key={`${item.id}-${tag}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200"
                >
                  {String(tag).replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-xs text-cyan-200 transition hover:text-cyan-100"
              >
                Open source
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
