import React, { useMemo } from 'react';
import { AREAS } from '../data/seed.js';
import { currencyGroups } from '../lib/currencies.js';
import { fmtNum, rateDigits } from '../lib/pricing.js';
import { Icon } from './ui.jsx';

const CORRIDORS = [
  { from: 'AED', to: 'INR' },
  { from: 'AED', to: 'PHP' },
  { from: 'AED', to: 'PKR' },
  { from: 'AED', to: 'EGP' },
  { from: 'AED', to: 'GBP' },
];

function CurrencyOptions({ groups }) {
  const opt = (c) => <option key={c.code} value={c.code}>{c.flag} {c.code} · {c.name}</option>;
  return (
    <>
      <optgroup label="Popular">{groups.popular.map(opt)}</optgroup>
      <optgroup label={`All currencies (${groups.popular.length + groups.rest.length})`}>{groups.rest.map(opt)}</optgroup>
    </>
  );
}

export default function HeroMatrix({
  s,
  set,
  codes,
  mid,
  metrics,
  providerCount,
  specificArea,
  areaLabel,
  userLoc,
  onCompareProviders,
  onOpenAlertModal,
}) {
  const groups = useMemo(() => currencyGroups(codes), [codes]);
  const pick = (key, other) => (e) => {
    const v = e.target.value;
    if (v === s[other]) set({ from: s.to, to: s.from });
    else set({ [key]: v });
  };

  const midPair = (mid[s.to] && mid[s.from]) ? mid[s.to] / mid[s.from] : 1;
  const bestRow = metrics.bestRow;
  const bestRate = bestRow ? (s.mode === 'sell' ? bestRow.q.sellRate : bestRow.q.buyRate) : midPair;
  const bestTotal = bestRow ? bestRow.total : s.amount * midPair;
  const pairDigits = rateDigits(Math.max(midPair, bestRate));

  const mostBranchesRow = metrics.bestRow; // fallback
  return (
    <section aria-label="Forex and remittance comparison matrix" className="panel p-5 md:p-6">
      {/* Top title & quick corridor buttons */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em]">
            <span className="rounded bg-sky/10 px-2 py-0.5 text-sky">DXB Terminal</span>
            <span className="text-steel-500">Live UAE Comparison Engine</span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] text-go border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-go animate-pulse" aria-hidden="true" />
              Auto-Updating
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold uppercase tracking-tight text-ink sm:text-3xl">
            Dubai Forex &amp; Remittance Comparison Matrix
          </h1>
          <p className="mt-1 text-sm text-steel-600 max-w-2xl">
            Real-time estimated rates across {providerCount} UAE exchange houses and retail banks. Market mid-rates are cross-checked live; provider quotes include typical spreads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0" role="group" aria-label="Popular remittance corridors">
          <span className="label mr-1">Corridors:</span>
          {CORRIDORS.filter((c) => codes.includes(c.from) && codes.includes(c.to)).map((c) => {
            const active = s.from === c.from && s.to === c.to && s.mode === 'sell';
            return (
              <button
                key={`${c.from}-${c.to}`}
                type="button"
                onClick={() => set({ from: c.from, to: c.to, mode: 'sell' })}
                aria-pressed={active}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-sky bg-sky text-white shadow-sm'
                    : 'border-steel-200 bg-steel-50 text-ink hover:bg-steel-100'
                }`}
              >
                {c.from} → {c.to}
              </button>
            );
          })}
        </div>
      </div>

      {/* Converter Wells + Primary CTAs */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_235px] lg:items-stretch">
        {/* YOU SEND */}
        <div className="well flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="from" className="label">
              {s.mode === 'sell' ? 'You send (base)' : 'Target amount to buy'}
            </label>
            <span className="text-[11px] font-medium text-steel-500">
              {s.channel === 'cash' ? 'Cash at counter' : 'Bank transfer'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <select
              id="from"
              aria-label="From currency"
              className="max-w-[140px] shrink-0 rounded-lg border border-steel-200 bg-white px-2.5 py-1.5 text-sm font-bold text-ink outline-none focus:border-sky"
              value={s.from}
              onChange={pick('from', 'to')}
            >
              <CurrencyOptions groups={groups} />
            </select>
            <input
              id="amount"
              aria-label="Amount to exchange"
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent text-right font-mono text-2xl font-bold text-ink outline-none tabular-nums"
              value={s.amountText}
              onChange={(e) => {
                const t = e.target.value.replace(/[^0-9.]/g, '');
                set({ amountText: t, amount: parseFloat(t) || 0 });
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-steel-200/80 pt-2 text-[11px] text-steel-500">
            <span className="font-mono tabular-nums">
              Interbank: 1 {s.from} = {midPair.toFixed(pairDigits)} {s.to}
            </span>
            <span className="font-semibold text-go">
              {s.channel === 'cash' ? '0.00 Fee (Cash)' : 'Flat Bank Fee'}
            </span>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => set({ from: s.to, to: s.from })}
            aria-label="Swap currencies"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-steel-200 bg-white text-steel-600 shadow-sm transition-colors hover:border-sky hover:text-sky"
          >
            <Icon.swap width="16" height="16" />
          </button>
        </div>

        {/* RECIPIENT RECEIVES */}
        <div className="well flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="to" className="label">
              {s.mode === 'sell' ? 'Recipient receives (est. best)' : 'Estimated cost (best)'}
            </label>
            <span className="text-[11px] font-medium text-steel-500 truncate max-w-[140px]">
              {bestRow ? bestRow.provider.name : 'No match'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <select
              id="to"
              aria-label="To currency"
              className="max-w-[140px] shrink-0 rounded-lg border border-steel-200 bg-white px-2.5 py-1.5 text-sm font-bold text-ink outline-none focus:border-sky"
              value={s.to}
              onChange={pick('to', 'from')}
            >
              <CurrencyOptions groups={groups} />
            </select>
            <div className="min-w-0 flex-1 text-right font-mono text-2xl font-bold text-sky tabular-nums whitespace-nowrap">
              {bestRow ? fmtNum(bestTotal, 2) : '—'}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-steel-200/80 pt-2 text-[11px] text-steel-500">
            <span className="font-mono tabular-nums">
              Best Est. Rate: 1 {s.from} = {bestRate.toFixed(pairDigits)} {s.to}
            </span>
            <span className="font-semibold text-go">
              {bestRow ? `Spread ${bestRow.q.marginPct.toFixed(2)}%` : 'Adjust filters'}
            </span>
          </div>
        </div>

        {/* ACTION STACK */}
        <div className="flex flex-col justify-between gap-2">
          <button
            type="button"
            onClick={onCompareProviders}
            className="btn btn-primary h-12 w-full justify-center font-sans text-xs font-bold tracking-wider uppercase"
          >
            Compare {providerCount} Providers →
          </button>
          <button
            type="button"
            onClick={onOpenAlertModal}
            className="btn h-11 w-full justify-center text-xs font-semibold text-steel-600"
          >
            Set Corridor Rate Alert
          </button>
        </div>
      </div>

      {/* Inline Transaction Controls (Mode, Channel, Emirate/Area) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-steel-200 bg-steel-50/70 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Setup:</span>
            <button
              type="button"
              onClick={() => set({ from: s.from === 'AED' ? 'USD' : s.from, to: 'AED', mode: 'sell' })}
              aria-pressed={s.to === 'AED' && s.mode === 'sell'}
              className="key !py-1"
            >
              Visiting (Cash → AED)
            </button>
            <button
              type="button"
              onClick={() => set({ from: 'AED', to: s.to === 'AED' ? 'INR' : s.to, mode: 'sell' })}
              aria-pressed={s.from === 'AED' && s.mode === 'sell'}
              className="key !py-1"
            >
              Sending AED Home
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="label">Mode:</span>
            <div className="inline-flex rounded-lg border border-steel-200 bg-white p-0.5" role="group" aria-label="Buy or sell mode">
              <button
                type="button"
                onClick={() => set({ mode: 'sell' })}
                aria-pressed={s.mode === 'sell'}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${s.mode === 'sell' ? 'bg-sky text-white' : 'text-steel-600 hover:text-ink'}`}
              >
                Sell {s.from}
              </button>
              <button
                type="button"
                onClick={() => set({ mode: 'buy' })}
                aria-pressed={s.mode === 'buy'}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${s.mode === 'buy' ? 'bg-sky text-white' : 'text-steel-600 hover:text-ink'}`}
              >
                Buy {s.from}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="label">Channel:</span>
            <div className="inline-flex rounded-lg border border-steel-200 bg-white p-0.5" role="group" aria-label="Cash or bank transfer channel">
              <button
                type="button"
                onClick={() => set({ channel: 'cash' })}
                aria-pressed={s.channel === 'cash'}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${s.channel === 'cash' ? 'bg-sky text-white' : 'text-steel-600 hover:text-ink'}`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => set({ channel: 'bank' })}
                aria-pressed={s.channel === 'bank'}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${s.channel === 'bank' ? 'bg-sky text-white' : 'text-steel-600 hover:text-ink'}`}
              >
                Bank Transfer
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <span className="label">Location</span>
          <select
            id="area"
            className="rounded-lg border border-steel-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink outline-none focus:border-sky"
            value={s.areaId}
            onChange={(e) => set({ areaId: e.target.value })}
          >
            <optgroup label="Emirate">
              {AREAS.filter((a) => a.kind === 'all' || a.kind === 'emirate').map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </optgroup>
            {s.areaId === 'multi' && <option value="multi">Selected emirates</option>}
            <optgroup label="Neighbourhoods">
              {AREAS.filter((a) => a.kind === 'area').map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.emirate})</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      {/* 4-column Bottom Summary Strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="well px-3.5 py-2.5">
          <div className="label">Best Live Rate</div>
          <div className="mt-1 font-mono text-sm font-bold text-ink tabular-nums">
            1 {s.from} = {bestRate.toFixed(pairDigits)} {s.to}
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-go">
            {bestRow ? `${bestRow.provider.name} (Est.)` : 'No matching providers'}
          </div>
        </div>

        <div className="well px-3.5 py-2.5">
          <div className="label">Avg Bank Savings</div>
          <div className="mt-1 font-mono text-sm font-bold text-go tabular-nums">
            +{fmtNum(metrics.avgBankSavings, 2)} {s.to}
          </div>
          <div className="mt-0.5 text-xs text-steel-500">
            Best exchange vs bank avg ({fmtNum(s.amount, 0)} {s.from})
          </div>
        </div>

        <div className="well px-3.5 py-2.5">
          <div className="label">{specificArea ? 'Nearest Scope' : 'Branch Footprint'}</div>
          <div className="mt-1 font-mono text-sm font-bold text-ink tabular-nums">
            {userLoc ? 'GPS Active' : areaLabel}
          </div>
          <div className="mt-0.5 text-xs text-sky font-medium">
            {mostBranchesRow ? `${metrics.totalBranches.toLocaleString('en')} UAE branches indexed` : 'Adjust area filters'}
          </div>
        </div>

        <div className="well px-3.5 py-2.5">
          <div className="label">Best Spread Cap</div>
          <div className="mt-1 font-mono text-sm font-bold text-ink tabular-nums">
            {metrics.bestSpreadPct.toFixed(2)}% Spread
          </div>
          <div className="mt-0.5 text-xs text-steel-500">
            {s.channel === 'cash' ? 'Cash counter spread' : 'Bank transfer spread'}
          </div>
        </div>
      </div>
    </section>
  );
}
