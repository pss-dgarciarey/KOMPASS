import React, { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { api, getFallbackDashboard } from './services/api';
import MapComponent from './components/MapComponent';
import PulseSidebar from './components/PulseSidebar';
import FinancePanel from './components/FinancePanel';
import CorrelationCard from './components/CorrelationCard';
import Timeline from './components/Timeline';

const RegionDetailPanel = lazy(() => import('./pages/RegionDetailPanel'));
const ActiveConflictsPage = lazy(() => import('./pages/ActiveConflictsPage'));
const AssetChartModal = lazy(() => import('./components/AssetChartModal'));
const ResourceMetricModal = lazy(() => import('./components/ResourceMetricModal'));

const MAP_WINDOWS = {
  live: {
    label: 'Live',
    title: 'Real-time world pulse',
    subtitle: 'Current live window from the latest ingest. Stronger emphasis on real incidents when Conflict Watch is enabled.'
  },
  '24h': {
    label: '24h',
    title: 'Trailing 24h heat memory',
    subtitle: 'Keeps countries visible if they carried meaningful signal over the trailing day.'
  },
  '7d': {
    label: '7d',
    title: 'Trailing 7d activity',
    subtitle: 'A slower, wider lens that favors sustained pressure and conflict persistence over raw immediacy.'
  }
};

const SIGNAL_MODES = [
  { key: 'conflict', label: 'Conflict' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'coverage', label: 'Coverage' }
];

const BTC_DONATION_ADDRESS = '3AkbSTzYtGzshqKsx72BPpYamB36BXvcka';
const BTC_DONATION_URI = `bitcoin:${BTC_DONATION_ADDRESS}`;
// Quick QR shortcut for now. If this service ever gets flaky, swap it for a local QR renderer.
const BTC_QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(BTC_DONATION_URI)}`;

function formatFeedMode(mode) {
  if (mode === 'live') {
    return 'Real-time';
  }
  if (mode === 'live-partial') {
    return 'Partial live';
  }
  if (mode === 'stale') {
    return 'Stale live';
  }
  if (mode === 'mock') {
    return 'Mock';
  }
  return 'Booting';
}

function formatFetchTime(value) {
  if (!value) {
    return 'waiting';
  }
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function pulseClassForMode(mode, loading) {
  if (loading) {
    return 'status-pulse-warm';
  }
  if (mode === 'live') {
    return 'status-pulse-live';
  }
  if (mode === 'live-partial') {
    return 'status-pulse-hybrid';
  }
  if (mode === 'stale') {
    return 'status-pulse-stale';
  }
  if (mode === 'mock') {
    return 'status-pulse-mock';
  }
  return 'status-pulse-warm';
}

function badgeClassForMode(mode) {
  if (mode === 'live') {
    return 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-200';
  }
  if (mode === 'live-partial') {
    return 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
  }
  if (mode === 'stale' || mode === 'mock') {
    return 'border border-amber-300/20 bg-amber-300/10 text-amber-200';
  }
  return 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
}

function sectionButtonClass(active) {
  return active
    ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
    : 'border-white/10 text-slate-200 hover:bg-white/5';
}

function pickMapRegions(metrics, windowKey) {
  if (windowKey === '24h') {
    return metrics?.trailing24hRegions || metrics?.trailingRegions || [];
  }
  if (windowKey === '7d') {
    return metrics?.trailing7dRegions || metrics?.trailing24hRegions || metrics?.trailingRegions || [];
  }
  return metrics?.regions || [];
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [topEvents, setTopEvents] = useState([]);
  const [finance, setFinance] = useState(null);
  const [correlations, setCorrelations] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [autoPoll, setAutoPoll] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showCorrelationCard, setShowCorrelationCard] = useState(true);
  const [conflictWatch, setConflictWatch] = useState(true);
  const [view, setView] = useState('global');
  const [mapWindow, setMapWindow] = useState('live');
  const [mapSignal, setMapSignal] = useState('sentiment');
  const [conflictsIndex, setConflictsIndex] = useState({ featured: 'iran-israel-us', conflicts: [] });
  const [selectedConflict, setSelectedConflict] = useState('iran-israel-us');
  const [conflictDetail, setConflictDetail] = useState(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedResourceMetric, setSelectedResourceMetric] = useState(null);
  const [walletCopied, setWalletCopied] = useState(false);

  async function loadConflictsIndex() {
    try {
      const payload = await api.getConflicts();
      startTransition(() => {
        setConflictsIndex(payload);
        setSelectedConflict((current) => current || payload.featured || payload.conflicts?.[0]?.slug || 'iran-israel-us');
      });
    } catch {
      const fallback = getFallbackDashboard();
      startTransition(() => {
        setConflictsIndex(fallback.conflictsIndex);
        setSelectedConflict((current) => current || fallback.conflictsIndex.featured);
      });
    }
  }

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }

    try {
      // Main rule here: one slow panel should not blank the whole screen.
      const settled = await Promise.allSettled([
        api.getHealth(),
        api.getMetrics({ since: '7d' }),
        api.getTopEvents({ limit: 6, window: conflictWatch ? '240m' : '90m', conflictOnly: conflictWatch ? '1' : '' }),
        api.getFinance(),
        api.getCorrelations({ window: '6h' }),
        api.getAlerts()
      ]);
      const [healthResult, metricsResult, eventsResult, financeResult, correlationsResult, alertsResult] = settled;
      const fallback = getFallbackDashboard();
      const failedLabels = settled
        .map((result, index) => ({ result, label: ['health', 'metrics', 'events', 'finance', 'correlations', 'alerts'][index] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ label }) => label);

      const nextHealth =
        healthResult.status === 'fulfilled'
          ? healthResult.value
          : (health || fallback.health);
      const nextMetrics =
        metricsResult.status === 'fulfilled'
          ? metricsResult.value
          : (metrics || fallback.metrics);
      const nextEvents =
        eventsResult.status === 'fulfilled'
          ? (eventsResult.value.items || [])
          : (topEvents.length ? topEvents : fallback.events.items);
      const nextFinance =
        financeResult.status === 'fulfilled'
          ? financeResult.value
          : (finance || fallback.finance);
      const nextCorrelations =
        correlationsResult.status === 'fulfilled'
          ? correlationsResult.value
          : (correlations || fallback.correlations);
      const nextAlerts =
        alertsResult.status === 'fulfilled'
          ? (alertsResult.value.recentTriggers || [])
          : alerts;

      startTransition(() => {
        setMetrics(nextMetrics);
        setHealth(nextHealth);
        setTopEvents(nextEvents);
        setFinance(nextFinance);
        setCorrelations(nextCorrelations);
        setAlerts(nextAlerts);
        setError(failedLabels.length ? `Using cached data for: ${failedLabels.join(', ')}` : '');
      });
    } catch (loadError) {
      const fallback = getFallbackDashboard();
      startTransition(() => {
        setHealth(fallback.health);
        setMetrics(fallback.metrics);
        setTopEvents(fallback.events.items);
        setFinance(fallback.finance);
        setCorrelations(fallback.correlations);
        setAlerts([]);
        setConflictsIndex(fallback.conflictsIndex);
        setSelectedConflict(fallback.conflictsIndex.featured);
        setError(loadError.message);
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadConflictDetail(slug) {
    if (!slug) {
      return;
    }
    setConflictLoading(true);
    try {
      const payload = await api.getConflict(slug);
      startTransition(() => {
        setConflictDetail(payload);
      });
    } catch {
      const fallback = getFallbackDashboard();
      startTransition(() => {
        setConflictDetail(fallback.conflictDetails[slug] || fallback.conflictDetails[fallback.conflictsIndex.featured]);
      });
    } finally {
      setConflictLoading(false);
    }
  }

  async function refreshFastPanels() {
    try {
      const [healthPayload, financePayload, correlationsPayload] = await Promise.all([
        api.getHealth(),
        api.getFinance(),
        api.getCorrelations({ window: '6h' })
      ]);

      startTransition(() => {
        setHealth(healthPayload);
        setFinance(financePayload);
        setCorrelations(correlationsPayload);
      });
    } catch {
      // Keep the last rendered data when the quick finance loop misses.
    }
  }

  async function copyDonationAddress() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(BTC_DONATION_ADDRESS);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setWalletCopied(true);
      window.setTimeout(() => setWalletCopied(false), 2200);
    } catch {
      setWalletCopied(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [conflictWatch]);

  useEffect(() => {
    document.title = 'Kompass \u2014 Global Pulse Monitor';
  }, []);

  useEffect(() => {
    if (view !== 'conflicts') {
      return;
    }
    loadConflictsIndex();
  }, [view]);

  useEffect(() => {
    if (view !== 'conflicts' || !selectedConflict) {
      return;
    }
    loadConflictDetail(selectedConflict);
  }, [selectedConflict, view]);

  useEffect(() => {
    if (!autoPoll) {
      return undefined;
    }

    // Slow lane: bigger payloads and conflict pages.
    const slowInterval = setInterval(() => {
      loadDashboard({ silent: true });
      if (view === 'conflicts') {
        loadConflictsIndex();
        if (selectedConflict) {
          loadConflictDetail(selectedConflict);
        }
      }
    }, 45_000);

    // Fast lane: top bar + finance strip. Keep this one cheap or Fly complains.
    const fastInterval = setInterval(() => {
      refreshFastPanels();
    }, 5_000);

    return () => {
      clearInterval(slowInterval);
      clearInterval(fastInterval);
    };
  }, [autoPoll, conflictWatch, selectedConflict, view]);

  const headlineTone = metrics?.currentGlobal?.avgTone ?? 0;
  const currentMapMeta = MAP_WINDOWS[mapWindow];
  const currentMapRegions = pickMapRegions(metrics, mapWindow);
  const selectedConflictCountries =
    conflictDetail?.conflict?.mapCountries || conflictDetail?.conflict?.countries || [];
  const conflictMapRegions = selectedConflictCountries.length
    ? currentMapRegions.filter((item) => selectedConflictCountries.includes(item.region))
    : currentMapRegions;
  const feeds = [
    {
      key: 'gdelt',
      label: 'News',
      mode: health?.sources?.gdelt || 'boot',
      lastFetch: health?.lastFetches?.gdelt,
      lastLiveFetch: health?.lastLiveFetches?.gdelt,
      detail: health?.coverage?.gdelt
        ? `${health.coverage.gdelt.countryCount || 0} countries / ${health.coverage.gdelt.sourceCount || 0} unique / ${health.coverage.gdelt.configuredFeedChannelCount || 0} configured channels${
            health.coverage.gdelt.configuredPulseCount
              ? ` / ${health.coverage.gdelt.configuredPulseCount} pulse queries`
              : ''
          }${
            health.coverage.gdelt.configuredConflictOutletCount
              ? ` / ${health.coverage.gdelt.configuredConflictOutletCount} conflict desks`
              : ''
          }${
            health.coverage.gdelt.requestCount
              ? ` / ${health.coverage.gdelt.successCount}/${health.coverage.gdelt.requestCount} fetch ok`
              : ''
          }${health.coverage.gdelt.respondingOutletCount ? ` / ${health.coverage.gdelt.respondingOutletCount} outlet feeds responding` : ''}${
            health.coverage.gdelt.respondingConflictOutletCount ? ` / ${health.coverage.gdelt.respondingConflictOutletCount} conflict desks responding` : ''
          }${
            health.coverage.gdelt.respondingShippingCount ? ` / ${health.coverage.gdelt.respondingShippingCount} shipping feeds responding` : ''
          }${
            health.coverage.gdelt.respondingSocialCount ? ` / ${health.coverage.gdelt.respondingSocialCount} social feeds responding` : ''
          }${health.coverage.gdelt.feedMix?.length ? ` / ${health.coverage.gdelt.feedMix.map((item) => item.sourceKind).join(' + ')}` : ''}`
        : `${metrics?.currentGlobal?.countryCount || 0} countries / ${metrics?.currentGlobal?.sourceCount || 0} sources`
    },
    {
      key: 'finance',
      label: 'Finance',
      mode: health?.sources?.finance || 'boot',
      lastFetch: health?.lastFetches?.finance,
      lastLiveFetch: health?.lastLiveFetches?.finance,
      detail: health?.coverage?.finance
        ? `${health.coverage.finance.sourceCount || 0} live instruments / ${health.coverage.finance.activeKgpiInputs?.length || 0} KGPI inputs`
        : 'Awaiting market feed'
    }
  ];

  return (
    <div className="app-shell min-h-screen px-4 py-5 text-slate-100 md:px-6">
      <header className="panel neon-outline relative mb-5 overflow-hidden rounded-[28px] px-5 py-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-60" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-kicker text-xs text-cyan-200/70">Public signal deck</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              {'Kompass \u2014 Global Pulse Monitor'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              Global sentiment, active conflict theaters, and market pulse in one public command surface
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-kicker text-[10px] text-cyan-200/70">Global tone</div>
              <div className="mt-2 text-2xl font-semibold">{headlineTone.toFixed(1)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-kicker text-[10px] text-cyan-200/70">Alerts</div>
              <div className="mt-2 text-2xl font-semibold">{alerts.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-kicker text-[10px] text-cyan-200/70">Coverage</div>
              <div className="mt-2 text-2xl font-semibold">
                {metrics?.currentGlobal?.countryCount || metrics?.regions?.length || 0}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {metrics?.currentGlobal?.sourceCount || 0} unique sources
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {(health?.coverage?.gdelt?.configuredFeedChannelCount || 0)} configured feed channels
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => loadDashboard()}
            className="focus-ring rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Refresh Grid
          </button>
          <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setView('global')}
              className={`focus-ring rounded-full px-4 py-2 text-sm transition ${sectionButtonClass(view === 'global')}`}
            >
              Global Pulse
            </button>
            <button
              type="button"
              onClick={() => setView('conflicts')}
              className={`focus-ring rounded-full px-4 py-2 text-sm transition ${sectionButtonClass(view === 'conflicts')}`}
            >
              Active Conflicts
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConflictWatch(!conflictWatch)}
            className={`focus-ring rounded-full border px-4 py-2 text-sm transition ${
              conflictWatch
                ? 'border-amber-300/35 bg-amber-300/12 text-amber-100'
                : 'border-white/10 text-slate-200 hover:bg-white/5'
            }`}
          >
            {conflictWatch ? 'Conflict Watch on' : 'Conflict Watch off'}
          </button>
          {!showCorrelationCard && (
            <button
              type="button"
              onClick={() => setShowCorrelationCard(true)}
              className="focus-ring rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Show Tone vs. Markets
            </button>
          )}
          <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300">
            {error ? `Offline fallback: ${error}` : 'Data cache warm'}
          </span>
          {(alerts[0] || metrics?.currentGlobal) && (
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
              {alerts[0]?.message || `Mood baseline: ${metrics?.currentGlobal?.eventCount || 0} events`}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {feeds.map((feed) => (
            <div
              key={feed.key}
              className="rounded-[22px] border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-kicker text-[10px] text-cyan-200/70">{feed.label} feed</div>
                  <div className="mt-1 text-sm font-medium text-white">{formatFeedMode(feed.mode)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-pulse ${pulseClassForMode(feed.mode, loading)}`} />
                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${badgeClassForMode(feed.mode)}`}>
                    {feed.mode}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">Last fetch: {formatFetchTime(feed.lastFetch)}</div>
              <div className="mt-1 text-xs text-slate-500">{feed.detail}</div>
              {feed.mode === 'stale' && feed.lastLiveFetch && (
                <div className="mt-1 text-[11px] text-amber-200/80">
                  Last live: {formatFetchTime(feed.lastLiveFetch)}
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      <main className="grid gap-5">
        {view === 'global' ? (
          <>
            <FinancePanel
              finance={finance}
              onSelectAsset={setSelectedAsset}
              onSelectResourceMetric={setSelectedResourceMetric}
            />

            <div className="grid gap-5 xl:grid-cols-[1.62fr_0.92fr]">
              <section className="grid gap-5">
                <section className="panel rounded-[28px] p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="text-kicker text-[11px] text-cyan-200/70">Map controls</div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">One map, three temporal lenses</h2>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row">
                      <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
                        {Object.entries(MAP_WINDOWS).map(([key, item]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setMapWindow(key)}
                            className={`focus-ring rounded-full px-4 py-2 text-sm transition ${
                              mapWindow === key ? 'border border-cyan-300/40 bg-cyan-400/10 text-cyan-100' : 'text-slate-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
                        {SIGNAL_MODES.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setMapSignal(item.key)}
                            className={`focus-ring rounded-full px-4 py-2 text-sm transition ${
                              mapSignal === item.key ? 'border border-amber-300/30 bg-amber-300/10 text-amber-100' : 'text-slate-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <MapComponent
                  mapLabel="World atlas"
                  title={currentMapMeta.title}
                  subtitle={currentMapMeta.subtitle}
                  regions={currentMapRegions}
                  selectedRegion={selectedRegion}
                  loading={loading}
                  metricMode={mapSignal}
                  onSelectRegion={(regionCode) => setSelectedRegion(regionCode)}
                  heightClass="h-[460px] sm:h-[560px] lg:h-[680px] xl:h-[760px]"
                />

                {showCorrelationCard && (
                  <CorrelationCard
                    correlations={correlations}
                    onDismiss={() => setShowCorrelationCard(false)}
                  />
                )}

                <Timeline
                  globalSeries={metrics?.globalSeries || []}
                  marketMoodSeries={metrics?.kgpiSeries || metrics?.marketMoodSeries || []}
                />
              </section>

              <PulseSidebar
                events={topEvents}
                loading={loading}
                autoPoll={autoPoll}
                setAutoPoll={setAutoPoll}
                conflictWatch={conflictWatch}
                onRefresh={() => loadDashboard()}
              />
            </div>
          </>
        ) : (
          <Suspense
            fallback={
              <div className="panel rounded-[28px] px-5 py-10 text-sm text-slate-300">
                Loading conflict theater view...
              </div>
            }
          >
            <ActiveConflictsPage
              conflicts={conflictsIndex.conflicts || []}
              selectedConflict={selectedConflict}
              setSelectedConflict={setSelectedConflict}
              conflictDetail={conflictDetail}
              loading={conflictLoading}
              regions={conflictMapRegions}
              onSelectRegion={setSelectedRegion}
              selectedRegion={selectedRegion}
              mapWindowLabel={currentMapMeta.label}
            />
          </Suspense>
        )}
      </main>

      {selectedRegion ? (
        <Suspense fallback={null}>
          <RegionDetailPanel
            region={selectedRegion}
            onClose={() => setSelectedRegion(null)}
          />
        </Suspense>
      ) : null}
      {selectedAsset ? (
        <Suspense fallback={null}>
          <AssetChartModal
            asset={selectedAsset}
            snapshot={finance?.snapshot}
            onClose={() => setSelectedAsset(null)}
          />
        </Suspense>
      ) : null}
      {selectedResourceMetric ? (
        <Suspense fallback={null}>
          <ResourceMetricModal
            card={selectedResourceMetric}
            onClose={() => setSelectedResourceMetric(null)}
          />
        </Suspense>
      ) : null}

      <footer className="panel mt-5 rounded-[28px] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-kicker text-[11px] text-cyan-200/70">Support Kompass</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Bitcoin donations</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Donations are optional. Any funds received here are intended only for the maintenance,
              optimization, and continued development of Kompass.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              BTC wallet on the Bitcoin network.
            </p>
          </div>

          <div className="grid w-full max-w-3xl gap-4 rounded-[24px] border border-cyan-300/20 bg-black/25 p-4 md:grid-cols-[190px_minmax(0,1fr)]">
            <div className="flex items-center justify-center rounded-[22px] border border-white/10 bg-black/35 p-4">
              <img
                src={BTC_QR_URL}
                alt="Bitcoin donation QR for Kompass"
                className="h-[156px] w-[156px] rounded-xl bg-white p-2"
              />
            </div>

            <div>
              <div className="text-kicker text-[10px] text-cyan-200/70">BTC Address</div>
              <div className="mt-3 break-all rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-cyan-100">
                {BTC_DONATION_ADDRESS}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={BTC_DONATION_URI}
                  className="focus-ring inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  Open in wallet
                </a>
                <button
                  type="button"
                  onClick={copyDonationAddress}
                  className="focus-ring inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                >
                  {walletCopied ? 'Address copied' : 'Copy address'}
                </button>
                <span className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs text-slate-400">
                  Network: Bitcoin
                </span>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                Scan the QR from any BTC wallet app or copy the address manually.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
