import React from 'react';
import { AREAS } from '../data/seed.js';
import { Icon } from './ui.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'comparison', label: 'Live Comparison' },
  { id: 'alerts', label: 'Rate Alerts' },
  { id: 'trends', label: 'Historical Trends' },
  { id: 'calculator', label: 'Multi-Transfer Calculator' },
];

export default function HeaderNav({
  activeTab,
  onSelectTab,
  query,
  onQueryChange,
  providers,
  alertCount,
  onOpenAlerts,
  onOpenQr,
  onSearchSubmit,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-steel-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <a
          href="#top"
          onClick={(e) => { e.preventDefault(); onSelectTab('dashboard'); }}
          className="flex items-center gap-2.5 shrink-0 no-underline"
        >
          <span className="badge-gold !rounded-lg !px-2.5 !py-1 !text-lg" aria-hidden="true">XD</span>
          <span className="block font-display text-xl font-bold uppercase leading-none tracking-wide text-ink">Xchange Desk</span>
        </a>

        {/* Primary Navigation */}
        <nav aria-label="Primary workspace navigation" className="order-last flex w-full items-center gap-1 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:pb-0">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-sky text-white shadow-sm'
                    : 'text-steel-600 hover:bg-steel-100 hover:text-ink'
                }`}
              >
                {item.label}
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${active ? 'bg-white text-sky' : 'bg-sky text-white'}`}>
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Search + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <form
            role="search"
            aria-label="Search exchange houses"
            onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-steel-200 bg-steel-50 px-2.5 py-1.5 focus-within:border-sky focus-within:bg-white focus-within:ring-2 focus-within:ring-sky/15"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-steel-400" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M13 13l4.5 4.5" />
            </svg>
            <input
              id="storeSearch"
              type="search"
              list="storeSuggest"
              autoComplete="off"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search providers, kiosks, areas..."
              aria-label="Search exchange houses, areas or addresses"
              className="w-48 md:w-56 bg-transparent text-xs font-medium text-ink outline-none placeholder:text-steel-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="text-[11px] font-semibold text-sky hover:underline"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
            <datalist id="storeSuggest">
              {providers.map((p) => <option key={p.id} value={p.name} />)}
              {AREAS.filter((a) => a.kind === 'area').map((a) => <option key={a.id} value={a.label} />)}
            </datalist>
          </form>

          <button
            type="button"
            onClick={onOpenAlerts}
            aria-label={`Rate alerts (${alertCount} active)`}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-steel-200 bg-white text-steel-600 transition-colors hover:bg-steel-50 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {alertCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {alertCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenQr}
            aria-label="Open mobile app QR code"
            className="hidden md:inline-flex items-center gap-2 rounded-lg border border-steel-200 bg-steel-50 px-2.5 py-1.5 text-left transition-colors hover:bg-steel-100"
          >
            <Icon.qr width="15" height="15" className="text-sky shrink-0" />
            <span className="leading-tight">
              <span className="block text-[11px] font-bold text-ink">UAE Desk</span>
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-steel-500">Mobile QR</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
