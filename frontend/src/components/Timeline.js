import React, { useEffect, useState } from 'react';

function compressSeries(values, maxPoints = 72) {
  if (values.length <= maxPoints) {
    return values;
  }

  const step = values.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => values[Math.floor(index * step)]).filter(
    (value) => Number.isFinite(value)
  );
}

function buildPolyline(values, width = 500, height = 80) {
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

function ChartRow({ title, values, color, cursorIndex }) {
  const safeIndex = values.length ? Math.min(Math.max(cursorIndex, 0), values.length - 1) : 0;
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-100">{title}</span>
        <span className="text-slate-400">{values[safeIndex]?.toFixed?.(1) ?? '--'}</span>
      </div>
      <svg viewBox="0 0 500 80" className="h-24 w-full">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          points={buildPolyline(values)}
          className="sparkline-path"
        />
        {values.length > 0 && (
          <circle
            cx={(safeIndex / Math.max(values.length - 1, 1)) * 500}
            cy={Number(buildPolyline(values).split(' ')[safeIndex]?.split(',')[1] || 40)}
            r="4"
            fill="#ffffff"
          />
        )}
      </svg>
    </div>
  );
}

export default function Timeline({ globalSeries, marketMoodSeries }) {
  const [playing, setPlaying] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [windowKey, setWindowKey] = useState('24h');
  const cutoffMs = windowKey === '7d' ? 7 * 24 * 60 * 60_000 : 24 * 60 * 60_000;
  const now = Date.now();
  const filteredGlobal = globalSeries.filter((point) => now - Date.parse(point.timestamp) <= cutoffMs);
  const filteredMood = marketMoodSeries.filter((point) => now - Date.parse(point.timestamp) <= cutoffMs);
  const globalValues = compressSeries(
    filteredGlobal.map((point) => point.avgTone).filter(Number.isFinite)
  );
  const moodValues = compressSeries(
    filteredMood.map((point) => point.score ?? point.mood).filter(Number.isFinite)
  );
  const frameLength = Math.max(globalValues.length, moodValues.length, 1);

  useEffect(() => {
    if (!playing) {
      setCursorIndex(Math.max(frameLength - 1, 0));
      return undefined;
    }

    const interval = setInterval(() => {
      setCursorIndex((current) => (current + 1) % frameLength);
    }, 700);

    return () => clearInterval(interval);
  }, [frameLength, playing]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    setCursorIndex(0);
    return undefined;
  }, [playing]);

  return (
    <section className="panel rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-kicker text-[11px] text-cyan-200/70">Playback rail</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{windowKey} playback</h2>
        </div>

        <div className="flex gap-3">
          <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
            {['24h', '7d'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setWindowKey(key)}
                className={`focus-ring rounded-full px-4 py-2 text-sm transition ${
                  windowKey === key ? 'border border-cyan-300/40 bg-cyan-400/10 text-cyan-100' : 'text-slate-300'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="focus-ring rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            {playing ? 'Pause' : 'Play'} timeline
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartRow title="Global AvgTone" values={globalValues} color="#00F6FF" cursorIndex={cursorIndex} />
        <ChartRow title="KGPI" values={moodValues} color="#00FF9C" cursorIndex={cursorIndex} />
      </div>
    </section>
  );
}
