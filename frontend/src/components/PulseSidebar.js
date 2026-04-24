import React from 'react';
import IncidentFeed from './IncidentFeed';

export default function PulseSidebar({ events, loading, autoPoll, setAutoPoll, onRefresh, conflictWatch }) {
  return (
    <IncidentFeed
      label="Pulse feed"
      title={conflictWatch ? 'Conflict watchlist' : 'Signal brief'}
      description={
        conflictWatch
          ? 'Incident-shaped cards with corroboration, source type, and conflict signatures instead of raw article fragments.'
          : 'The strongest live swings from the current Kompass ingest window, rendered as readable incident cards.'
      }
      items={events}
      loading={loading}
      compact
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setAutoPoll(!autoPoll)}
            className={`focus-ring rounded-full border px-3 py-2 text-xs ${
              autoPoll
                ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                : 'border-white/10 text-slate-300'
            }`}
          >
            {autoPoll ? 'Auto-poll on' : 'Auto-poll off'}
          </button>
        </div>
      }
    />
  );
}
