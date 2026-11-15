import React from 'react';
import { EMIRATES } from '../data/seed.js';

export default function OperatorFilters({
  s,
  set,
  totalCount,
  counts,
  hasRatings,
}) {
  const isFiltered = s.type !== 'all' || s.openNow || s.areaId !== 'all' || s.query.trim() !== '' || s.minRating > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Title + Active Count + Sort By */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
            Available Operators
          </h2>
          <span className="rounded bg-steel-200/80 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink tabular-nums">
            {totalCount} Active
          </span>
        </div>

        <label className="flex items-center gap-2">
          <span className="label">Sort by:</span>
          <select
            id="sortSel"
            value={s.sort}
            onChange={(e) => set({ sort: e.target.value })}
            className="rounded-lg border border-steel-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-sky"
          >
            <option value="rate">
              {s.mode === 'sell' ? 'Recipient Gets Most (Best Value)' : 'Lowest Total Cost (Best Value)'}
            </option>
            <option value="high">Payout: High → Low</option>
            <option value="low">Payout: Low → High</option>
            {hasRatings && <option value="rating">Top Rated</option>}
            <option value="near">Closest / Most Branches</option>
          </select>
        </label>
      </div>

      {/* Filter pills row */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter operators by category and availability">
        <button
          type="button"
          onClick={() => set({ type: 'all' })}
          aria-pressed={s.type === 'all'}
          className="key"
        >
          All Operators ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => set({ type: 'exchange' })}
          aria-pressed={s.type === 'exchange'}
          className="key"
        >
          Exchange Houses ({counts.exchange})
        </button>
        <button
          type="button"
          onClick={() => set({ type: 'bank' })}
          aria-pressed={s.type === 'bank'}
          className="key"
        >
          UAE Retail Banks ({counts.bank})
        </button>
        <button
          type="button"
          onClick={() => set({ openNow: !s.openNow })}
          aria-pressed={s.openNow}
          className="key"
        >
          Open Now (GST)
        </button>
        <button
          type="button"
          onClick={() => set({ areaId: s.areaId === 'dubai' ? 'all' : 'dubai' })}
          aria-pressed={s.areaId === 'dubai'}
          className="key"
        >
          Dubai
        </button>
        <button
          type="button"
          onClick={() => set({ areaId: s.areaId === 'abudhabi' ? 'all' : 'abudhabi' })}
          aria-pressed={s.areaId === 'abudhabi'}
          className="key"
        >
          Abu Dhabi
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={() => set({
              query: '',
              minRating: 0,
              openNow: false,
              emirates: Object.fromEntries(EMIRATES.map((e) => [e, true])),
              type: 'all',
              sort: 'rate',
              areaId: 'all',
            })}
            className="ml-auto text-xs font-semibold text-sky hover:underline"
          >
            Reset all filters
          </button>
        )}
      </div>
    </div>
  );
}
