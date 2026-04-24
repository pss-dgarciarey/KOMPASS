import React from 'react';
import { ASSET_META, ASSET_ORDER } from '../lib/assetMeta';

function buildPolyline(values, width = 220, height = 52) {
  if (!values.length) {
    return '';
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (((value - min) / spread) * height);
      return `${x},${y}`;
    })
    .join(' ');
}

function formatMode(mode) {
  if (mode === 'live') {
    return 'Real-time';
  }
  if (mode === 'live-partial') {
    return 'Partial live';
  }
  if (mode === 'mock') {
    return 'Mock';
  }
  return 'Booting';
}

function formatValue(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  if (currency === 'INDEX') {
    return Number(value).toFixed(1);
  }
  if (Math.abs(Number(value)) >= 1000) {
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2
    });
  }
  return Number(value).toFixed(2);
}

function formatSignedPercent(value) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
}

function formatUpdatedAt(value) {
  if (!value) {
    return 'Awaiting refresh';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Awaiting refresh';
  }

  return `Updated ${date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function riskTone(score) {
  if (score >= 80) {
    return 'text-rose-200';
  }
  if (score >= 62) {
    return 'text-amber-200';
  }
  if (score >= 42) {
    return 'text-cyan-100';
  }
  return 'text-emerald-200';
}

function ResourcePressureCard({ card, onClick }) {
  if (!card) {
    return (
      <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
        <div className="text-kicker text-[10px] text-cyan-200/70">Supply lens</div>
        <div className="mt-2 text-lg font-semibold text-white">Awaiting live energy data</div>
        <div className="mt-1 text-xs text-slate-500">
          Weekly storage and inventory baselines will appear once the first energy fetch completes.
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(card)}
      className="focus-ring rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-left transition hover:border-cyan-300/20 hover:bg-black/30"
      aria-label={`Open ${card.title} methodology`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-kicker text-[10px] text-cyan-200/70">{card.title}</div>
        <div className={`text-sm font-medium uppercase tracking-[0.18em] ${riskTone(card.score)}`}>
          {card.level}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold text-white">{Math.round(card.score)} / 100</div>
        <div className="text-[11px] text-slate-500">Click for methodology</div>
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-400">{card.summary}</p>
      <div className="mt-3 text-[11px] text-slate-500">{formatUpdatedAt(card.updatedAt)}</div>
      <div className="mt-4 space-y-2">
        {(card.drivers || []).slice(0, 2).map((driver) => (
          <div
            key={`${card.key}-${driver.label}`}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs"
          >
            <span className="text-slate-300">{driver.label}</span>
            <span className="font-medium text-white">{Math.round(driver.score)} / 100</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function AssetSparklineCard({ assetKey, values, latestValue, onSelectAsset }) {
  const meta = ASSET_META[assetKey] || { label: assetKey, color: '#00F6FF', currency: 'USD' };

  return (
    <button
      type="button"
      onClick={() => onSelectAsset?.(assetKey)}
      className="focus-ring rounded-[22px] border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/20 hover:bg-black/30"
      aria-label={`Open expanded chart for ${meta.label}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">{meta.label}</span>
        <span className="text-[11px] text-slate-400">{formatValue(latestValue, meta.currency)}</span>
      </div>
      <svg viewBox="0 0 220 52" className="h-14 w-full">
        <polyline
          fill="none"
          stroke={meta.color}
          strokeWidth="2.5"
          points={buildPolyline(values)}
          className="sparkline-path"
        />
      </svg>
      <div className="mt-2 text-[11px] text-slate-500">Click for expanded chart</div>
    </button>
  );
}

function Meter({ label, value, subtitle, accent }) {
  const safeValue = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-semibold text-white">{subtitle}</span>
      </div>
      <div className="h-3 rounded-full bg-gradient-to-r from-[#651217] via-[#FFB86B] to-[#00FF9C]">
        <div
          className="relative h-3"
          style={{ width: `${safeValue}%` }}
        >
          <span
            className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-black"
            style={{ boxShadow: `0 0 1rem ${accent}` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function FinancePanel({ finance, onSelectAsset, onSelectResourceMetric }) {
  const snapshot = finance?.snapshot;
  const history = finance?.history?.series || {};
  const kgpi = snapshot?.kgpi || snapshot?.marketMood;
  const kgpiScore = kgpi?.score ?? 50;
  const fearGreedValue = snapshot?.fearGreedCrypto?.value ?? 50;
  const financeMode = snapshot?.source || 'boot';
  const kgpiComponents = Object.values(kgpi?.components || {})
    .sort((left, right) => Math.abs(right.contribution || 0) - Math.abs(left.contribution || 0))
    .slice(0, 8);
  const resourceProfile = snapshot?.resourceProfile;
  const resourceCards = resourceProfile?.cards || {};
  const assetCards = ASSET_ORDER.filter((assetKey) => assetKey === 'kgpi' || history[assetKey]?.length);

  return (
    <section className="panel rounded-[28px] p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-kicker text-[11px] text-cyan-200/70">KGPI live engine</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Kompass Global Pulse Index</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            KGPI now weights cross-asset volatility, live oil inventory cover, gas storage tightness,
            corridor disruption risk, crypto Fear & Greed, and conflict-weighted global tone so the
            headline number does not drift unrealistically optimistic during obvious macro or geopolitical strain.
          </p>
        </div>

        <div
          className="rounded-[24px] border border-emerald-300/15 bg-black/25 px-4 py-3 text-sm text-slate-200"
          title="Weighted blend of VIX, VXN, OVX, MOVE, energy and commodity stress, crypto Fear & Greed, and conflict-weighted news tone."
        >
          KGPI: <span className="font-semibold text-white">{kgpiScore}</span> /
          <span className="text-emerald-300"> 100</span>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.35fr_0.95fr]">
        <div className="grid gap-4">
          <Meter
            label="Crypto Fear and Greed"
            value={fearGreedValue}
            subtitle={`${fearGreedValue} / ${snapshot?.fearGreedCrypto?.classification || 'Unknown'}`}
            accent="rgba(255, 184, 107, 0.75)"
          />
          <Meter
            label="KGPI composite"
            value={kgpiScore}
            subtitle={`${kgpiScore} / ${kgpi?.label || 'balanced'}`}
            accent="rgba(0, 255, 156, 0.75)"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <ResourcePressureCard
              card={resourceCards.supplyShock}
              onClick={onSelectResourceMetric}
            />
            <ResourcePressureCard
              card={resourceCards.oilPressure}
              onClick={onSelectResourceMetric}
            />
            <ResourcePressureCard
              card={resourceCards.gasPressure}
              onClick={onSelectResourceMetric}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span
                className={`status-pulse ${
                  financeMode === 'live'
                    ? 'status-pulse-live'
                    : financeMode === 'live-partial'
                      ? 'status-pulse-hybrid'
                      : financeMode === 'mock'
                        ? 'status-pulse-mock'
                        : 'status-pulse-warm'
                }`}
              />
              {formatMode(financeMode)}
            </span>
            <span>
              {snapshot?.timestamp
                ? new Date(snapshot.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                : 'waiting'}
            </span>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="text-kicker text-[10px] text-cyan-200/70">KGPI drivers</div>
          <div className="mt-2 text-xs text-slate-400">
            Sentiment bias: {kgpi?.metadata?.sentimentScore ?? '--'} / 100
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Regime caps: {kgpi?.metadata?.regimeCapsApplied ? 'active' : 'inactive'}
          </div>
          <div className="mt-3 grid gap-2">
            {kgpiComponents.length ? (
              kgpiComponents.map((component) => (
                <div
                  key={component.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{component.label}</span>
                  <span className="font-medium text-white">{component.value}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">No recent data. Try refreshing or check your network.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {assetCards.map((assetKey) => (
          <AssetSparklineCard
            key={assetKey}
            assetKey={assetKey}
            values={assetKey === 'kgpi' ? (history.kgpi || history.mood || []) : (history[assetKey] || [])}
            latestValue={
              assetKey === 'kgpi'
                ? kgpiScore
                : snapshot?.[assetKey]?.value
            }
            onSelectAsset={onSelectAsset}
          />
        ))}
      </div>
    </section>
  );
}
