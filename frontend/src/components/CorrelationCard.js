import React from 'react';

function formatName(name) {
  if (name === 'kgpi') {
    return 'KGPI';
  }
  return name.toUpperCase();
}

export default function CorrelationCard({ correlations, onDismiss }) {
  const entries = Object.entries(correlations?.indicators || {}).slice(0, 4);

  return (
    <div className="panel rounded-[24px] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-kicker text-[10px] text-cyan-200/70">Cross-signal check</div>
          <div className="mt-2 text-lg font-semibold text-white">Tone vs. markets</div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="focus-ring rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Close
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {entries.length ? (
          entries.map(([name, item]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm"
            >
              <span className="uppercase tracking-[0.18em] text-slate-400">{formatName(name)}</span>
              <span className="font-medium text-white">{item.coefficient}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-400">No recent alignment window yet.</div>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {correlations?.insight || 'No recent data. Try refreshing or check your network.'}
      </p>
    </div>
  );
}
