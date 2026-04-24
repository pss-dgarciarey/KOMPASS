import React, { useState } from 'react';
import MapComponent from '../components/MapComponent';
import IncidentFeed from '../components/IncidentFeed';
import ConflictHistoryModal from '../components/ConflictHistoryModal';

function statusClass(status) {
  if (status === 'live') {
    return 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (status === 'linked') {
    return 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
  }
  if (status === 'degraded') {
    return 'border border-amber-300/20 bg-amber-300/10 text-amber-100';
  }
  return 'border border-white/10 bg-white/5 text-slate-200';
}

function SourceDeck({ sources }) {
  return (
    <div className="panel rounded-[28px] p-5">
      <div className="text-kicker text-[11px] text-cyan-200/70">Source deck</div>
      <h2 className="mt-2 text-2xl font-semibold text-white">External conflict lenses</h2>
      <p className="mt-2 text-sm text-slate-300">
        Structured feeds are ingested directly where possible. JS-heavy trackers stay linked as high-value
        reference layers with their latest accessible metadata.
      </p>

      <div className="mt-4 space-y-3">
        {(sources || []).map((source) => (
          <article
            key={source.key}
            className="rounded-[24px] border border-white/10 bg-black/25 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{source.label}</div>
                <div className="mt-1 text-xs text-slate-400">{source.kindLabel}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusClass(source.status)}`}>
                {source.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{source.summary}</p>
            {source.latestHeadline && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-200">
                {source.latestHeadline}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>{source.detail}</span>
              <span>{new Date(source.checkedAt).toLocaleString()}</span>
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs text-cyan-200 transition hover:text-cyan-100"
            >
              Open source
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function ActiveConflictsPage({
  conflicts,
  selectedConflict,
  setSelectedConflict,
  conflictDetail,
  loading,
  regions,
  onSelectRegion,
  selectedRegion,
  mapWindowLabel
}) {
  const [showHistory, setShowHistory] = useState(false);
  const currentConflict =
    conflictDetail?.conflict || conflicts.find((item) => item.slug === selectedConflict) || conflicts[0];
  const overview = currentConflict?.overview || {};
  const summaryCards = [
    { label: 'Incidents', value: overview.incidentCount || 0 },
    { label: 'Sources', value: overview.sourceCount || 0 },
    { label: 'Map scope', value: currentConflict?.mapCountries?.length || currentConflict?.countries?.length || 0 },
    { label: 'Pressure', value: overview.pressure?.toFixed?.(1) || '--' }
  ];

  return (
    <section className="grid gap-5">
      <div className="panel rounded-[28px] p-5">
        <div className="text-kicker text-[11px] text-cyan-200/70">Active conflicts</div>
        <h2 className="mt-2 text-3xl font-semibold text-white">Live conflict theaters</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Track major active conflicts through source-linked incident feeds, theater maps, and rolling pressure
          signals. Kompass combines live event ingest with curated public trackers to surface where escalation is
          active now.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Sources in this section combine Kompass live ingest with selected public conflict trackers and reference maps.
        </p>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {conflicts.map((conflict) => (
            <button
              key={conflict.slug}
              type="button"
              onClick={() => setSelectedConflict(conflict.slug)}
              className={`focus-ring min-w-max rounded-full border px-4 py-2 text-sm transition ${
                conflict.slug === selectedConflict
                  ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {conflict.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="grid gap-5">
          <div className="panel rounded-[28px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-kicker text-[11px] text-cyan-200/70">Theater brief</div>
                <h3 className="mt-2 text-2xl font-semibold text-white">{currentConflict?.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {currentConflict?.description || currentConflict?.summary}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Core map follows the direct battlefield. Intervention and spillover states are only included when the reporting explicitly ties them to this conflict.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="focus-ring rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
              >
                See full history
              </button>
            </div>
          </div>

          <MapComponent
            mapLabel="Conflict theater"
            title={`${currentConflict?.title || 'Conflict'} | ${mapWindowLabel}`}
            subtitle={currentConflict?.summary || 'Conflict theater map.'}
            regions={regions}
            selectedRegion={selectedRegion}
            loading={loading}
            metricMode="conflict"
            onSelectRegion={onSelectRegion}
            focusRegions={currentConflict?.mapCountries || currentConflict?.countries || []}
            autoFocusKey={currentConflict?.slug || currentConflict?.title || 'conflict'}
            heightClass="h-[440px] sm:h-[540px] lg:h-[640px] xl:h-[720px]"
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="panel rounded-[24px] px-4 py-4"
              >
                <div className="text-kicker text-[10px] text-cyan-200/70">{card.label}</div>
                <div className="mt-2 text-3xl font-semibold text-white">{card.value}</div>
              </div>
            ))}
          </div>
        </div>

        <SourceDeck sources={currentConflict?.sourceDeck || []} />
      </div>

      <IncidentFeed
        label="Theater wire"
        title={currentConflict?.title || 'Conflict incidents'}
        description="Structured live incidents and editorial context merged into one readable conflict wire."
        items={currentConflict?.incidents || []}
        loading={loading}
        className="min-h-[560px]"
      />

      <ConflictHistoryModal
        conflict={showHistory ? currentConflict : null}
        onClose={() => setShowHistory(false)}
      />
    </section>
  );
}
