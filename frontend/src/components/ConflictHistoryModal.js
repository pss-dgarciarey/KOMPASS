import React, { useEffect } from 'react';
import useBodyScrollLock from '../lib/useBodyScrollLock';

export default function ConflictHistoryModal({ conflict, onClose }) {
  const history = conflict?.history;

  useBodyScrollLock(Boolean(history));

  useEffect(() => {
    if (!history) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [history, onClose]);

  if (!history || !conflict) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/70 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-6"
      style={{
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
      }}
      onClick={onClose}
    >
      <div
        className="panel mx-auto max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#06090D]/95 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-kicker text-[11px] text-cyan-200/70">Conflict history</div>
            <h2 className="mt-2 text-3xl font-semibold text-white">{conflict.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{history.summary}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Reviewed</div>
              <div className="mt-2 text-sm font-medium text-white">{history.updatedAt}</div>
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

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-5">
            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Scope</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{history.scopeNote}</p>
            </section>

            {(history.sections || []).map((section) => (
              <section
                key={`${conflict.slug}-${section.title}`}
                className="rounded-[24px] border border-white/10 bg-black/20 p-4"
              >
                <div className="text-kicker text-[10px] text-cyan-200/70">{section.title}</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="grid gap-5">
            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Key dates</div>
              <div className="mt-4 space-y-3">
                {(history.timeline || []).map((item) => (
                  <div
                    key={`${conflict.slug}-${item.date}-${item.label}`}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">{item.date}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200">{item.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-kicker text-[10px] text-cyan-200/70">Reference reading</div>
              <div className="mt-4 space-y-3">
                {(history.sources || []).map((source) => (
                  <a
                    key={`${conflict.slug}-${source.label}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-cyan-300/30 hover:bg-cyan-400/5"
                  >
                    <div className="text-sm font-medium text-white">{source.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{source.url}</div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
