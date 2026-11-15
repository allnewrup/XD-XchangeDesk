import React from 'react';
import { Link } from '../lib/router.jsx';
import { Icon } from './ui.jsx';

export default function SyncStrip({
  status,
  pairNote,
  updatedAt,
  fmtTimeSec,
  live,
  userLoc,
  geo,
  onLocate,
  onClearLoc,
  onRefresh,
  refreshing,
  providerCount,
}) {
  const toneDot = {
    info: 'bg-sky',
    ok: 'bg-go',
    err: 'bg-red-600',
  }[status.tone];

  return (
    <div className="border-b border-steel-200 bg-steel-50">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot} ${live ? 'animate-pulse' : ''}`} aria-hidden="true" />
          <span className="font-bold uppercase tracking-wider text-ink">
            {live ? 'Live Auto-Sync' : 'Market Consensus Feeds'}
          </span>
          {updatedAt && (
            <span className="rounded border border-steel-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-steel-600 tabular-nums">
              {fmtTimeSec(updatedAt)} GST
            </span>
          )}
          <span className="hidden sm:inline rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-go">
            5s Spot
          </span>
          <span className="hidden md:inline text-steel-500 truncate max-w-xl" role="status" aria-live="polite">
            {pairNote || status.text}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden xl:inline text-steel-500 font-medium">
            {providerCount} UAE Providers (OSM Directory)
          </span>
          <span className="hidden xl:inline text-steel-300" aria-hidden="true">·</span>

          <button
            type="button"
            onClick={onLocate}
            disabled={geo.busy}
            aria-pressed={!!userLoc}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
              userLoc
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-100 hover:text-ink'
            }`}
          >
            <Icon.pin width="12" height="12" />
            {geo.busy ? 'Locating…' : userLoc ? 'Location Active' : 'Use My Location'}
          </button>
          {userLoc && (
            <button type="button" onClick={onClearLoc} className="text-xs font-semibold text-sky hover:underline">
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-steel-200 bg-white px-2.5 py-1 text-xs font-semibold text-steel-600 transition-colors hover:bg-steel-100 hover:text-ink disabled:opacity-50 whitespace-nowrap"
          >
            <Icon.refresh width="12" height="12" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync Now'}
          </button>

          <Link to="/methodology" className="hidden sm:inline font-semibold text-sky hover:underline whitespace-nowrap">
            Methodology
          </Link>
          <Link to="/sources" className="hidden sm:inline font-semibold text-sky hover:underline whitespace-nowrap">
            Sources
          </Link>
        </div>
      </div>
      {geo.err && (
        <div className="mx-auto max-w-[1440px] px-4 pb-1.5 text-xs text-red-700 sm:px-6" role="alert">
          {geo.err}
        </div>
      )}
    </div>
  );
}
