import React, { useEffect } from 'react';
import useBodyScrollLock from '../lib/useBodyScrollLock';

function scoreTone(score) {
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

const RISK_BANDS = [
  { label: 'Calm', range: '0-41', color: 'bg-emerald-400/70' },
  { label: 'Elevated', range: '42-61', color: 'bg-cyan-300/70' },
  { label: 'Stressed', range: '62-79', color: 'bg-amber-300/70' },
  { label: 'Critical', range: '80-100', color: 'bg-rose-400/70' }
];

export default function ResourceMetricModal({ card, onClose }) {
  useBodyScrollLock(Boolean(card));

  useEffect(() => {
    if (!card) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [card, onClose]);

  if (!card) {
    return null;
  }

  const refreshedLabel = card.updatedAt
    ? new Date(card.updatedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : 'Awaiting refresh';

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto overscroll-contain bg-black/60 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
      style={{
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
      }}
      onClick={onClose}
    >
      <div
        className="panel mx-auto max-h-[calc(100dvh-0.75rem)] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#06090D]/95 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-white/10 bg-[#06090D]/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-kicker text-[11px] text-cyan-200/70">Resource methodology</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">{card.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {card.explanation}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current</div>
                <div className={`mt-2 text-3xl font-semibold ${scoreTone(card.score)}`}>
                  {Math.round(card.score)} / 100
                </div>
                <div className="mt-1 text-sm capitalize text-slate-300">{card.level}</div>
                <div className="mt-2 text-[11px] text-slate-500">Last refreshed {refreshedLabel}</div>
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

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="grid gap-5">
            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">What this means</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.summary}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{card.methodology}</p>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Current inputs</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(card.stats || []).map((stat) => (
                  <div
                    key={`${card.key}-${stat.label}`}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="text-xs text-slate-500">{stat.label}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{stat.value}</div>
                    {stat.detail ? (
                      <div className="mt-1 text-xs leading-5 text-slate-500">{stat.detail}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-5">
            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Risk ladder</div>
              <div className="mt-4 space-y-3">
                {RISK_BANDS.map((band) => (
                  <div
                    key={band.label}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${band.color}`} />
                      <span className="text-slate-200">{band.label}</span>
                    </div>
                    <span className="text-slate-400">{band.range}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Driver stack</div>
              <div className="mt-4 space-y-3">
                {(card.drivers || []).map((driver) => (
                  <div
                    key={`${card.key}-${driver.label}`}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white">{driver.label}</div>
                      <div className={`text-sm font-medium ${scoreTone(driver.score)}`}>
                        {Math.round(driver.score)} / 100
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{driver.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
