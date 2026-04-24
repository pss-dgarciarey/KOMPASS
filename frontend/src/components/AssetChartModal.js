import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ASSET_META } from '../lib/assetMeta';
import useBodyScrollLock from '../lib/useBodyScrollLock';

const TIMEFRAMES = [
  { key: '24h', label: '1D' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' }
];

const CHART_MODES = [
  { key: 'line', label: 'Line' },
  { key: 'candles', label: 'Candles' }
];

const CHART_WIDTH = 920;
const CHART_HEIGHT = 360;
const CHART_MARGIN = {
  top: 12,
  right: 20,
  bottom: 34,
  left: 72
};

function defaultChartMode(asset) {
  return asset === 'btc' || asset === 'kgpi' ? 'line' : 'candles';
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

function formatAxisValue(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }

  const numeric = Number(value);
  if (currency === 'INDEX') {
    return numeric.toFixed(1);
  }

  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: 0
    });
  }

  if (Math.abs(numeric) >= 100) {
    return numeric.toFixed(1);
  }

  return numeric.toFixed(2);
}

function formatChange(value) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
}

function formatTimeLabel(timestamp, rangeMs) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const options = rangeMs <= 24 * 60 * 60 * 1000
    ? { hour: '2-digit', minute: '2-digit' }
    : rangeMs <= 7 * 24 * 60 * 60 * 1000
      ? { month: 'short', day: 'numeric', hour: '2-digit' }
      : { month: 'short', day: 'numeric' };

  return date.toLocaleString(undefined, options);
}

function buildChartFrame(values) {
  const numericValues = values
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);
  const floor = numericValues.length ? Math.min(...numericValues) : 0;
  const ceiling = numericValues.length ? Math.max(...numericValues) : 1;
  const rawSpread = ceiling - floor;
  const pad = rawSpread > 0
    ? rawSpread * 0.12
    : Math.max(Math.abs(ceiling || floor || 1) * 0.015, 1);
  const min = floor - pad;
  const max = ceiling + pad;
  const spread = max - min || 1;
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    return {
      ratio,
      value: max - (spread * ratio)
    };
  });

  return {
    min,
    max,
    spread,
    ticks
  };
}

function EmptyChartState() {
  return (
    <div className="flex h-[360px] items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-400">
      History will populate as this Kompass instance keeps collecting snapshots.
    </div>
  );
}

function ChartShell({ yFrame, currency, rangeMs, startTimestamp, endTimestamp, children }) {
  const chartWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const chartHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="h-[360px] w-full rounded-[24px] bg-black/25"
    >
      {yFrame.ticks.map((tick) => {
        const y = CHART_MARGIN.top + (chartHeight * tick.ratio);
        return (
          <g key={`${tick.value}-${tick.ratio}`}>
            <line
              x1={CHART_MARGIN.left}
              x2={CHART_WIDTH - CHART_MARGIN.right}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.12)"
              strokeDasharray="5 7"
            />
            <text
              x={CHART_MARGIN.left - 12}
              y={y + 4}
              textAnchor="end"
              fill="rgba(148,163,184,0.8)"
              fontSize="11"
            >
              {formatAxisValue(tick.value, currency)}
            </text>
          </g>
        );
      })}

      {children}

      <text
        x={CHART_MARGIN.left}
        y={CHART_HEIGHT - 10}
        fill="rgba(148,163,184,0.8)"
        fontSize="11"
      >
        {formatTimeLabel(startTimestamp, rangeMs)}
      </text>
      <text
        x={CHART_WIDTH - CHART_MARGIN.right}
        y={CHART_HEIGHT - 10}
        textAnchor="end"
        fill="rgba(148,163,184,0.8)"
        fontSize="11"
      >
        {formatTimeLabel(endTimestamp, rangeMs)}
      </text>
    </svg>
  );
}

function CandleChart({ candles, color, currency, rangeMs }) {
  if (!candles.length) {
    return <EmptyChartState />;
  }

  const chartWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const chartHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const yFrame = buildChartFrame(
    candles.flatMap((candle) => [candle.low, candle.high, candle.open, candle.close])
  );
  const step = chartWidth / Math.max(candles.length, 1);
  const bodyWidth = Math.max(4, step * 0.52);
  const scaleY = (value) => {
    const normalized = (Number(value) - yFrame.min) / yFrame.spread;
    return CHART_MARGIN.top + chartHeight - (normalized * chartHeight);
  };

  return (
    <ChartShell
      yFrame={yFrame}
      currency={currency}
      rangeMs={rangeMs}
      startTimestamp={candles[0]?.timestamp}
      endTimestamp={candles.at(-1)?.timestamp}
    >
      {candles.map((candle, index) => {
        const x = CHART_MARGIN.left + (index * step) + (step / 2);
        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const highY = scaleY(candle.high);
        const lowY = scaleY(candle.low);
        const rising = candle.close >= candle.open;
        const stroke = rising ? color : '#FB7185';
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(openY - closeY));

        return (
          <g key={`${candle.timestamp}-${index}`}>
            <line
              x1={x}
              x2={x}
              y1={highY}
              y2={lowY}
              stroke={stroke}
              strokeWidth="1.5"
              opacity="0.9"
            />
            <rect
              x={x - (bodyWidth / 2)}
              y={bodyY}
              width={bodyWidth}
              height={bodyHeight}
              rx="1.5"
              fill={rising ? `${stroke}33` : `${stroke}28`}
              stroke={stroke}
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </ChartShell>
  );
}

function LineChart({ points, color, currency, rangeMs }) {
  if (!points.length) {
    return <EmptyChartState />;
  }

  const chartWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const chartHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const yFrame = buildChartFrame(points.map((point) => point.value));
  const polyline = points
    .map((point, index) => {
      const x = CHART_MARGIN.left + ((index / Math.max(points.length - 1, 1)) * chartWidth);
      const y = CHART_MARGIN.top + chartHeight - (((point.value - yFrame.min) / yFrame.spread) * chartHeight);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <ChartShell
      yFrame={yFrame}
      currency={currency}
      rangeMs={rangeMs}
      startTimestamp={points[0]?.timestamp}
      endTimestamp={points.at(-1)?.timestamp}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        points={polyline}
        className="sparkline-path"
      />
    </ChartShell>
  );
}

export default function AssetChartModal({ asset, snapshot, onClose }) {
  const [timeframe, setTimeframe] = useState('24h');
  const [chartMode, setChartMode] = useState(defaultChartMode(asset));
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const meta = ASSET_META[asset] || { label: asset, color: '#00F6FF', currency: 'USD' };
  const snapshotValue = asset === 'kgpi'
    ? snapshot?.kgpi?.score ?? snapshot?.marketMood?.score
    : snapshot?.[asset]?.value;
  const snapshotChange = asset === 'kgpi' ? null : snapshot?.[asset]?.changePercent;

  useBodyScrollLock(Boolean(asset));

  useEffect(() => {
    if (!asset) {
      return undefined;
    }

    let cancelled = false;
    async function loadHistory() {
      setLoading(true);
      setError('');
      try {
        const history = await api.getFinanceHistory({
          asset,
          range: timeframe
        });
        if (!cancelled) {
          setPayload(history);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [asset, timeframe]);

  useEffect(() => {
    if (!asset) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [asset, onClose]);

  useEffect(() => {
    if (!asset) {
      return;
    }
    setTimeframe('24h');
    setChartMode(defaultChartMode(asset));
  }, [asset]);

  if (!asset) {
    return null;
  }

  const latestValue = payload?.latest ?? snapshotValue;
  const latestChange = payload?.changePercent ?? snapshotChange;
  const chartBody = chartMode === 'candles'
    ? (
      <CandleChart
        candles={payload?.candles || []}
        color={meta.color}
        currency={payload?.currency || meta.currency}
        rangeMs={payload?.rangeMs || 24 * 60 * 60 * 1000}
      />
    )
    : (
      <LineChart
        points={payload?.points || []}
        color={meta.color}
        currency={payload?.currency || meta.currency}
        rangeMs={payload?.rangeMs || 24 * 60 * 60 * 1000}
      />
    );
  const chartCount = chartMode === 'candles' ? (payload?.candles?.length ?? 0) : (payload?.points?.length ?? 0);
  const chartTimestamp = chartMode === 'candles'
    ? payload?.candles?.at(-1)?.timestamp
    : payload?.points?.at(-1)?.timestamp;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black/60 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
      style={{
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
      }}
      onClick={onClose}
    >
      <div
        className="panel mx-auto max-h-[calc(100dvh-0.75rem)] w-full max-w-6xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#06090D]/95 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-white/10 bg-[#06090D]/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-kicker text-[11px] text-cyan-200/70">Expanded asset view</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">{meta.label}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {asset === 'kgpi'
                  ? 'Switch between line price and candles. KGPI history is built from Kompass local snapshots, so deeper windows improve as the instance stays online.'
                  : 'Switch between line price and candles. Market history is pulled from live Yahoo Finance bars, while the dashboard tiles continue to refresh from the Kompass finance ingest.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {formatValue(latestValue, payload?.currency || meta.currency)}
                </div>
                <div className={`mt-1 text-sm ${Number(latestChange) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {formatChange(latestChange)}
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
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {TIMEFRAMES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTimeframe(item.key)}
              className={`focus-ring rounded-full border px-4 py-2 text-sm transition ${
                timeframe === item.key
                  ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="ml-auto flex rounded-full border border-white/10 bg-black/25 p-1">
            {CHART_MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setChartMode(item.key)}
                className={`focus-ring rounded-full px-4 py-2 text-sm transition ${
                  chartMode === item.key
                    ? 'border border-amber-300/30 bg-amber-300/10 text-amber-100'
                    : 'text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-black/20 p-4">
          {loading ? (
            <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
              Pulling {meta.label} history...
            </div>
          ) : error ? (
            <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
              {error}
            </div>
          ) : (
            chartBody
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
            <div className="text-kicker text-[10px] text-cyan-200/70">
              {chartMode === 'candles' ? 'Candles' : 'Visible points'}
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{chartCount}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
            <div className="text-kicker text-[10px] text-cyan-200/70">History range</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {TIMEFRAMES.find((item) => item.key === timeframe)?.label || '1D'}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
            <div className="text-kicker text-[10px] text-cyan-200/70">
              {chartMode === 'candles' ? 'Last bucket' : 'Last update'}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-200">
              {chartTimestamp ? new Date(chartTimestamp).toLocaleString() : 'Awaiting snapshots'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
