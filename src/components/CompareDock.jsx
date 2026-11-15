import React from 'react';
import { fmtNum } from '../lib/pricing.js';

export default function CompareDock({ rows, s, onOpenMatrix, onClear }) {
  if (!rows.length) return null;

  const isSell = s.mode === 'sell';
  const totals = rows.map((r) => r.total);
  const bestTotal = isSell ? Math.max(...totals) : Math.min(...totals);
  const worstTotal = isSell ? Math.min(...totals) : Math.max(...totals);
  const diff = Math.abs(bestTotal - worstTotal);
  const names = rows.map((r) => r.provider.name.split(' ').slice(0, 2).join(' ')).join(' vs ');

  return (
    <section
      aria-label="Direct comparison dock"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-terminal/95 text-white shadow-[0_-8px_24px_rgba(15,23,42,0.28)] backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Direct Comparison Dock ({rows.length} Selected)
            </div>
            <p className="truncate text-xs text-slate-300">
              {rows.length === 1
                ? `Selected ${rows[0].provider.name}. Select at least 1 more provider to compare side-by-side.`
                : `Comparing ${names} for ${fmtNum(s.amount, 0)} ${s.from} volume.`}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-2.5 shrink-0">
          {rows.length >= 2 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-mono tabular-nums">
              <span className="text-slate-400">Diff: </span>
              <strong className="text-emerald-400">+{fmtNum(diff, 2)} {s.to}</strong>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={rows.length < 2}
              onClick={onOpenMatrix}
              className="btn btn-primary text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Open Full Matrix
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
